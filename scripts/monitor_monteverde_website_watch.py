#!/usr/bin/env python3
"""Monteverde website change-watch baseline and monitor runner.

This script resolves Monteverde through the governed property identity matrix,
captures a forensic public-site snapshot, summarizes latest Data Pond metrics,
and writes a Markdown report plus machine-readable artifacts.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import difflib
import hashlib
import json
import os
import re
import socket
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "config" / "website_change_watch_properties.json"
REPORT_ROOT = ROOT / "reports" / "website_change_watch"
USER_AGENT = "VenterraWebsiteChangeWatch/1.0 (+https://venterra.com)"
REQUEST_TIMEOUT = 30
PREFLIGHT_TIMEOUT = 6
MIN_HTML_BYTES_FOR_PARSE = 256
MIN_HEALTHY_HTTP_200_PAGES = 1
PAGE_FETCH_WORKERS = max(2, min(12, int(os.getenv("WEBSITE_WATCH_FETCH_WORKERS", "6"))))
MAX_PAGES_PER_SITE = int(os.getenv("WEBSITE_WATCH_MAX_PAGES_PER_SITE", "0"))  # 0 means unlimited


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def sha256_text(value: str | bytes | None) -> str:
    if value is None:
        value = ""
    if isinstance(value, str):
        value = value.encode("utf-8", errors="replace")
    return hashlib.sha256(value).hexdigest()


def slugify(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return text or "property"


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_path(url: str, base_url: str) -> str:
    parsed = urlparse(url)
    base = urlparse(base_url)
    if parsed.netloc and parsed.netloc != base.netloc:
        return url
    path = parsed.path or "/"
    return path if path.startswith("/") else f"/{path}"


def display_path(url: str, primary_base_url: str) -> str:
    parsed = urlparse(url)
    primary = urlparse(primary_base_url)
    host = (parsed.netloc or "").lower()
    primary_host = (primary.netloc or "").lower()
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = f"/{path}"
    if host and primary_host and host != primary_host:
        return f"{host}{path}"
    return path


def load_watch_config(property_key: str) -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        if property_key.lower() == "monteverde":
            return {"property_key": "Monteverde", "property_code": "TX4MV", "base_url": "https://monteverdesatx.com/"}
        return {}
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    for row in payload.get("properties", []):
        keys = {
            row.get("property_key", ""),
            row.get("property_code", ""),
            row.get("domain", ""),
            row.get("base_url", ""),
        }
        if property_key.lower() in {str(key).lower() for key in keys if key}:
            return row
    return {}


def watched_sites(watch_config: dict[str, Any], identity: Any) -> list[dict[str, Any]]:
    sites = watch_config.get("sites")
    if isinstance(sites, list) and sites:
        normalized: list[dict[str, Any]] = []
        for site in sites:
            if not isinstance(site, dict):
                continue
            base_url = site.get("base_url")
            if not base_url:
                continue
            normalized.append(
                {
                    "site_key": site.get("site_key") or urlparse(base_url).netloc,
                    "domain": site.get("domain") or urlparse(base_url).netloc,
                    "base_url": base_url,
                    "critical_paths": site.get("critical_paths") or [],
                }
            )
        if normalized:
            return normalized

    base_url = watch_config.get("base_url") or identity.website_url
    if not base_url:
        return []
    return [
        {
            "site_key": "main",
            "domain": watch_config.get("domain") or urlparse(base_url).netloc,
            "base_url": base_url,
            "critical_paths": watch_config.get("critical_paths") or [],
        }
    ]


def dns_diagnostics(hostname: str) -> dict[str, Any]:
    hostname = (hostname or "").strip()
    if not hostname:
        return {"hostname": hostname, "ok": False, "error": "empty hostname", "addresses": []}
    try:
        infos = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
    except Exception as exc:
        return {"hostname": hostname, "ok": False, "error": f"{type(exc).__name__}: {exc}", "addresses": []}
    addresses: list[str] = []
    for info in infos:
        sockaddr = info[4]
        if isinstance(sockaddr, tuple) and sockaddr:
            addr = str(sockaddr[0])
            if addr not in addresses:
                addresses.append(addr)
    return {"hostname": hostname, "ok": True, "error": None, "addresses": addresses}


def build_http_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )
    retry = Retry(
        total=2,
        connect=2,
        read=1,
        status=1,
        backoff_factor=0.6,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("HEAD", "GET"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def preflight_site(session: requests.Session, base_url: str) -> dict[str, Any]:
    """Quick reachability check to avoid spending time on a doomed crawl."""
    started = time.perf_counter()
    try:
        response = session.get(base_url, timeout=PREFLIGHT_TIMEOUT, allow_redirects=True)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        ok = 200 <= response.status_code < 500
        return {
            "ok": ok,
            "status_code": response.status_code,
            "final_url": response.url,
            "elapsed_ms": elapsed_ms,
            "error": None,
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return {
            "ok": False,
            "status_code": None,
            "final_url": None,
            "elapsed_ms": elapsed_ms,
            "error": f"{type(exc).__name__}: {exc}",
        }


def fetch(session: requests.Session, url: str) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        response = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return {
            "ok": True,
            "url": url,
            "final_url": response.url,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
            "headers": dict(response.headers),
            "content_type": response.headers.get("content-type", ""),
            "text": response.text,
            "bytes": response.content,
            "redirect_chain": [
                {"status_code": item.status_code, "url": item.url, "location": item.headers.get("location")}
                for item in response.history
            ],
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return {
            "ok": False,
            "url": url,
            "final_url": None,
            "status_code": None,
            "elapsed_ms": elapsed_ms,
            "headers": {},
            "content_type": "",
            "text": "",
            "bytes": b"",
            "redirect_chain": [],
            "error": f"{type(exc).__name__}: {exc}",
        }


def is_capture_healthy(snapshot: dict[str, Any]) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    pages = snapshot.get("pages") or []
    if not pages:
        reasons.append("no pages captured")
        return False, reasons

    http_200_pages = 0
    for page in pages:
        if (page or {}).get("status_code") == 200:
            http_200_pages += 1

    if http_200_pages < MIN_HEALTHY_HTTP_200_PAGES:
        reasons.append("no pages returned HTTP 200")

    sitemaps = snapshot.get("sitemaps") or []
    sitemap_ok = False
    for sitemap in sitemaps:
        for entry in (sitemap or {}).get("sitemaps", []) or []:
            if (entry or {}).get("status_code") == 200:
                sitemap_ok = True
                break
        if sitemap_ok:
            break
    if not sitemap_ok:
        reasons.append("no sitemaps returned HTTP 200")

    return not reasons, reasons


def most_recent_healthy_snapshot(property_slug: str, exclude_dir: Path | None = None) -> Path | None:
    base_dir = REPORT_ROOT / property_slug
    if not base_dir.exists():
        return None
    candidates = sorted(base_dir.glob("*/baseline_snapshot.json"), key=lambda path: path.parent.name, reverse=True)
    for candidate in candidates:
        if exclude_dir and candidate.parent == exclude_dir:
            continue
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            continue
        healthy, _reasons = is_capture_healthy(payload)
        if healthy:
            return candidate
    return None


def latest_snapshot_paths(property_slug: str) -> tuple[Path, Path]:
    property_dir = REPORT_ROOT / property_slug
    return (
        property_dir / "latest_baseline_report.md",
        property_dir / "latest_baseline_snapshot.json",
    )


def discover_sitemap_urls(session: requests.Session, base_url: str) -> tuple[list[str], dict[str, Any]]:
    robots_url = urljoin(base_url, "/robots.txt")
    robots = fetch(session, robots_url)
    sitemap_candidates = []
    for line in robots.get("text", "").splitlines():
        if line.lower().startswith("sitemap:"):
            sitemap_candidates.append(line.split(":", 1)[1].strip())
    sitemap_candidates.append(urljoin(base_url, "/sitemap.xml"))

    seen_sitemaps: set[str] = set()
    page_urls: list[str] = []
    sitemap_evidence: dict[str, Any] = {
        "robots_url": robots_url,
        "robots_status": robots.get("status_code"),
        "robots_hash": sha256_text(robots.get("text", "")),
        "sitemaps": [],
    }

    def parse_sitemap(sitemap_url: str) -> None:
        if sitemap_url in seen_sitemaps:
            return
        seen_sitemaps.add(sitemap_url)
        result = fetch(session, sitemap_url)
        sitemap_evidence["sitemaps"].append(
            {
                "url": sitemap_url,
                "status_code": result.get("status_code"),
                "content_type": result.get("content_type"),
                "hash": sha256_text(result.get("text", "")),
            }
        )
        if not result.get("ok") or result.get("status_code") != 200:
            return
        try:
            root = ET.fromstring(result.get("text", "").encode("utf-8"))
        except ET.ParseError:
            return
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for loc in root.findall(".//sm:sitemap/sm:loc", ns):
            if loc.text:
                parse_sitemap(loc.text.strip())
        for loc in root.findall(".//sm:url/sm:loc", ns):
            if loc.text:
                page_urls.append(loc.text.strip())

    for candidate in sitemap_candidates:
        parse_sitemap(candidate)

    base_host = urlparse(base_url).netloc.lower()
    unique: list[str] = []
    seen: set[str] = set()
    for url in page_urls or [base_url]:
        parsed = urlparse(url)
        if parsed.netloc.lower() != base_host:
            continue
        normalized = url.split("#", 1)[0]
        key = normalized.rstrip("/") or normalized
        if key not in seen:
            seen.add(key)
            unique.append(normalized)
            if MAX_PAGES_PER_SITE and len(unique) >= MAX_PAGES_PER_SITE:
                break
    return unique, sitemap_evidence | {"page_count": len(unique), "page_urls": unique}


def meta_content(soup: BeautifulSoup, **attrs: str) -> str | None:
    tag = soup.find("meta", attrs=attrs)
    return clean_text(tag.get("content")) if tag and tag.get("content") is not None else None


def extract_meta(soup: BeautifulSoup) -> list[dict[str, str]]:
    rows = []
    for tag in soup.find_all("meta"):
        key = tag.get("name") or tag.get("property") or tag.get("http-equiv") or tag.get("charset")
        content = tag.get("content") if tag.get("content") is not None else ""
        if key:
            rows.append({"key": str(key), "content": clean_text(str(content))})
    return rows


def extract_json_ld(soup: BeautifulSoup) -> list[dict[str, Any]]:
    rows = []
    for index, tag in enumerate(soup.find_all("script", attrs={"type": re.compile(r"application/ld\+json", re.I)})):
        raw = tag.string or tag.get_text("", strip=False)
        parsed: Any = None
        parse_error = None
        try:
            parsed = json.loads(raw)
        except Exception as exc:
            parse_error = f"{type(exc).__name__}: {exc}"
        rows.append(
            {
                "index": index,
                "hash": sha256_text(raw),
                "parse_ok": parse_error is None,
                "parse_error": parse_error,
                "types": json_ld_types(parsed),
                "raw": raw,
            }
        )
    return rows


def json_ld_types(value: Any) -> list[str]:
    found: list[str] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            node_type = node.get("@type")
            if isinstance(node_type, str):
                found.append(node_type)
            elif isinstance(node_type, list):
                found.extend(str(item) for item in node_type)
            for item in node.values():
                visit(item)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(value)
    return sorted(set(found))


def extract_custom_schema_scripts(soup: BeautifulSoup) -> list[dict[str, Any]]:
    rows = []
    for index, tag in enumerate(soup.find_all("script")):
        raw = tag.string or tag.get_text("", strip=False)
        if "injectJsonLd" not in raw and "schema.org" not in raw and "ApartmentComplex" not in raw:
            continue
        rows.append(
            {
                "index": index,
                "hash": sha256_text(raw),
                "length": len(raw),
                "excerpt": clean_text(raw[:1000]),
            }
        )
    return rows


def css_path(tag: Any) -> str:
    parts = []
    node = tag
    while node is not None and getattr(node, "name", None) not in {None, "[document]"}:
        label = node.name
        if node.get("id"):
            label += f"#{node.get('id')}"
            parts.append(label)
            break
        classes = node.get("class") or []
        if classes:
            label += "." + ".".join(str(item) for item in classes[:2])
        parts.append(label)
        node = node.parent
    return " > ".join(reversed(parts[-5:]))


def extract_text_blocks(soup: BeautifulSoup) -> list[dict[str, Any]]:
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    tags = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "label", "figcaption"])
    rows = []
    seen: set[tuple[str, str]] = set()
    for index, tag in enumerate(tags):
        text = clean_text(tag.get_text(" ", strip=True))
        if not text or len(text) < 2:
            continue
        key = (tag.name, text)
        if key in seen and tag.name in {"a", "button", "li"}:
            continue
        seen.add(key)
        rows.append(
            {
                "order": index,
                "tag": tag.name,
                "text": text,
                "hash": sha256_text(text),
                "path": css_path(tag),
                "href": tag.get("href") if tag.name == "a" else None,
            }
        )
    return rows


def extract_links(soup: BeautifulSoup, page_url: str) -> list[dict[str, Any]]:
    rows = []
    for index, tag in enumerate(soup.find_all("a")):
        href = tag.get("href")
        text = clean_text(tag.get_text(" ", strip=True)) or clean_text(tag.get("aria-label"))
        if not href:
            continue
        absolute = urljoin(page_url, href)
        rows.append(
            {
                "order": index,
                "text": text,
                "href": href,
                "absolute_url": absolute,
                "is_cta_candidate": bool(re.search(r"apply|tour|schedule|contact|floor|available|quote|call|tel:", f"{text} {href}", re.I)),
            }
        )
    return rows


def extract_images(soup: BeautifulSoup, page_url: str) -> list[dict[str, Any]]:
    rows = []
    for index, tag in enumerate(soup.find_all("img")):
        src = tag.get("src") or tag.get("data-src")
        rows.append(
            {
                "order": index,
                "src": urljoin(page_url, src) if src else None,
                "alt": clean_text(tag.get("alt")),
                "width": tag.get("width"),
                "height": tag.get("height"),
                "loading": tag.get("loading"),
            }
        )
    return rows


def extract_forms(soup: BeautifulSoup, page_url: str) -> list[dict[str, Any]]:
    rows = []
    for index, form in enumerate(soup.find_all("form")):
        fields = []
        for field in form.find_all(["input", "select", "textarea", "button"]):
            fields.append(
                {
                    "tag": field.name,
                    "type": field.get("type"),
                    "name": field.get("name"),
                    "id": field.get("id"),
                    "label": clean_text(field.get("aria-label") or field.get("placeholder") or field.get_text(" ", strip=True)),
                    "required": field.has_attr("required"),
                }
            )
        rows.append(
            {
                "order": index,
                "method": form.get("method"),
                "action": urljoin(page_url, form.get("action", "")) if form.get("action") else None,
                "fields": fields,
            }
        )
    return rows


def extract_page_snapshot(page_url: str, result: dict[str, Any], raw_html_path: str) -> dict[str, Any]:
    html = result.get("text", "")
    soup = BeautifulSoup(html, "lxml")
    title = clean_text(soup.title.get_text(" ", strip=True)) if soup.title else None
    canonical_tag = soup.find("link", rel=lambda value: value and "canonical" in value)
    headings = {
        f"h{level}": [clean_text(tag.get_text(" ", strip=True)) for tag in soup.find_all(f"h{level}")]
        for level in range(1, 7)
    }
    meta_rows = extract_meta(soup)
    json_ld = extract_json_ld(soup)
    custom_schema = extract_custom_schema_scripts(soup)
    links = extract_links(soup, page_url)
    images = extract_images(soup, page_url)
    forms = extract_forms(soup, page_url)
    scripts = [
        {"src": urljoin(page_url, tag.get("src")) if tag.get("src") else None, "id": tag.get("id"), "type": tag.get("type")}
        for tag in soup.find_all("script")
    ]
    stylesheets = [
        {"href": urljoin(page_url, tag.get("href")) if tag.get("href") else None, "id": tag.get("id"), "rel": tag.get("rel")}
        for tag in soup.find_all("link")
        if tag.get("rel") and any(str(rel).lower() == "stylesheet" for rel in tag.get("rel"))
    ]
    body_soup = BeautifulSoup(html, "lxml")
    text_blocks = extract_text_blocks(body_soup)
    visible_text = "\n".join(block["text"] for block in text_blocks)
    word_count = len(re.findall(r"\b[\w'-]+\b", visible_text))

    return {
        "url": page_url,
        "final_url": result.get("final_url"),
        "fetch_ok": bool(result.get("ok")),
        "fetch_error": result.get("error"),
        "status_code": result.get("status_code"),
        "elapsed_ms": result.get("elapsed_ms"),
        "content_type": result.get("content_type"),
        "redirect_chain": result.get("redirect_chain", []),
        "headers": result.get("headers", {}),
        "raw_html_path": raw_html_path,
        "raw_html_size": len((result.get("bytes") or b"")),
        "html_hash": sha256_text(html),
        "visible_text_hash": sha256_text(visible_text),
        "visible_word_count": word_count,
        "title": title,
        "meta_description": meta_content(soup, name="description"),
        "robots": meta_content(soup, name="robots"),
        "canonical": canonical_tag.get("href") if canonical_tag else None,
        "open_graph": {row["key"]: row["content"] for row in meta_rows if row["key"].startswith("og:")},
        "twitter": {row["key"]: row["content"] for row in meta_rows if row["key"].startswith("twitter:")},
        "meta": meta_rows,
        "headings": headings,
        "json_ld": json_ld,
        "custom_schema_scripts": custom_schema,
        "text_blocks": text_blocks,
        "links": links,
        "cta_links": [link for link in links if link["is_cta_candidate"]],
        "images": images,
        "forms": forms,
        "scripts": scripts,
        "stylesheets": stylesheets,
        "risk_flags": page_risk_flags(
            page_url,
            result.get("status_code"),
            title,
            meta_content(soup, name="description"),
            meta_content(soup, name="robots"),
            canonical_tag.get("href") if canonical_tag else None,
            json_ld,
        ),
    }


def minimal_page_snapshot(page_url: str, result: dict[str, Any], raw_html_path: str) -> dict[str, Any]:
    status_code = result.get("status_code")
    title = None
    meta_description = None
    robots = None
    canonical = None
    json_ld: list[dict[str, Any]] = []
    return {
        "url": page_url,
        "final_url": result.get("final_url"),
        "fetch_ok": bool(result.get("ok")),
        "fetch_error": result.get("error"),
        "status_code": status_code,
        "elapsed_ms": result.get("elapsed_ms"),
        "content_type": result.get("content_type"),
        "redirect_chain": result.get("redirect_chain", []),
        "headers": result.get("headers", {}),
        "raw_html_path": raw_html_path,
        "raw_html_size": len((result.get("bytes") or b"")),
        "html_hash": sha256_text(result.get("text", "")),
        "visible_text_hash": sha256_text(""),
        "visible_word_count": 0,
        "title": title,
        "meta_description": meta_description,
        "robots": robots,
        "canonical": canonical,
        "open_graph": {},
        "twitter": {},
        "meta": [],
        "headings": {},
        "json_ld": json_ld,
        "custom_schema_scripts": [],
        "text_blocks": [],
        "links": [],
        "cta_links": [],
        "images": [],
        "forms": [],
        "scripts": [],
        "stylesheets": [],
        "risk_flags": page_risk_flags(page_url, status_code, title, meta_description, robots, canonical, json_ld),
    }


def page_risk_flags(
    page_url: str,
    status_code: int | None,
    title: str | None,
    meta_description: str | None,
    robots: str | None,
    canonical: str | None,
    json_ld: list[dict[str, Any]],
) -> list[str]:
    flags = []
    if status_code is None or status_code >= 400:
        flags.append("page_not_successful")
    if not title:
        flags.append("missing_title")
    if not meta_description:
        flags.append("missing_meta_description")
    if robots and re.search(r"\bnoindex\b|\bnofollow\b", robots, re.I):
        flags.append("robots_blocks_indexing_or_follow")
    if canonical:
        page_host = urlparse(page_url).netloc.lower()
        canonical_host = urlparse(canonical).netloc.lower()
        if canonical_host and canonical_host != page_host:
            flags.append("canonical_points_off_domain")
    if any(not item.get("parse_ok") for item in json_ld):
        flags.append("invalid_json_ld")
    return flags


def latest_previous_snapshot(property_slug: str, current_dir: Path) -> Path | None:
    root = REPORT_ROOT / property_slug
    if not root.exists():
        return None
    candidates = sorted(
        (
            path / "baseline_snapshot.json"
            for path in root.iterdir()
            if path.is_dir() and path != current_dir and (path / "baseline_snapshot.json").exists()
        ),
        key=lambda path: path.parent.name,
        reverse=True,
    )
    for candidate in candidates:
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            continue
        healthy, _reasons = is_capture_healthy(payload)
        if healthy:
            return candidate
    return candidates[0] if candidates else None


def comparable_page(page: dict[str, Any]) -> dict[str, Any]:
    return {
        "status_code": page.get("status_code"),
        "final_url": page.get("final_url"),
        "title": page.get("title"),
        "meta_description": page.get("meta_description"),
        "robots": page.get("robots"),
        "canonical": page.get("canonical"),
        "html_hash": page.get("html_hash"),
        "visible_text_hash": page.get("visible_text_hash"),
        "visible_word_count": page.get("visible_word_count"),
        "headings": page.get("headings"),
        "json_ld_hashes": [item.get("hash") for item in page.get("json_ld", [])],
        "custom_schema_hashes": [item.get("hash") for item in page.get("custom_schema_scripts", [])],
        "cta_links": [(item.get("text"), item.get("absolute_url")) for item in page.get("cta_links", [])],
        "image_alt": [(item.get("src"), item.get("alt")) for item in page.get("images", [])],
        "script_sources": [item.get("src") for item in page.get("scripts", []) if item.get("src")],
    }


def compare_snapshots(previous_path: Path | None, current: dict[str, Any]) -> list[dict[str, Any]]:
    if previous_path is None:
        return []
    previous = json.loads(previous_path.read_text(encoding="utf-8"))
    events = []
    previous_pages = {page["url"]: page for page in previous.get("pages", [])}
    current_pages = {page["url"]: page for page in current.get("pages", [])}
    for url in sorted(set(previous_pages) | set(current_pages)):
        if url not in previous_pages:
            events.append({"severity": "medium", "type": "page_added", "url": url})
            continue
        if url not in current_pages:
            events.append({"severity": "high", "type": "page_removed", "url": url})
            continue
        before = comparable_page(previous_pages[url])
        after = comparable_page(current_pages[url])
        for field, before_value in before.items():
            after_value = after.get(field)
            if before_value == after_value:
                continue
            severity = "low"
            if field in {"status_code", "robots", "canonical", "title", "meta_description", "json_ld_hashes", "custom_schema_hashes", "cta_links"}:
                severity = "high"
            elif field in {"visible_text_hash", "headings", "script_sources"}:
                severity = "medium"
            event: dict[str, Any] = {
                "severity": severity,
                "type": "field_changed",
                "url": url,
                "field": field,
                "before": before_value,
                "after": after_value,
            }
            if field in {"title", "meta_description"} and isinstance(before_value, str) and isinstance(after_value, str):
                event["diff"] = "\n".join(difflib.unified_diff([before_value], [after_value], lineterm=""))
            events.append(event)
    return events


def query_one(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
    try:
        row = conn.execute(sql, params).fetchone()
    except sqlite3.Error:
        return None
    return dict(row) if row else None


def query_all(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    try:
        rows = conn.execute(sql, params).fetchall()
    except sqlite3.Error:
        return []
    return [dict(row) for row in rows]


def summarize_data_pond(identity: Any) -> dict[str, Any]:
    if not DB_PATH.exists():
        return {"status": "missing_db", "db_path": str(DB_PATH)}
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ga4_id = identity.ga4_property_id or ""
    property_code = identity.property_code or identity.canonical_property_id
    gsc_url = identity.gsc_url or ""
    gsc_candidates = tuple(dict.fromkeys([item for item in [gsc_url, gsc_url.rstrip("/"), f"{gsc_url.rstrip('/')}/"] if item]))
    domain = urlparse(identity.website_url or "").netloc
    candidates = tuple(dict.fromkeys([item for item in [ga4_id, property_code, identity.canonical_property_id] if item]))
    placeholders = ",".join("?" for _ in candidates)
    gsc_placeholders = ",".join("?" for _ in gsc_candidates) if gsc_candidates else "?"

    metrics: dict[str, Any] = {"db_path": str(DB_PATH), "property_id_candidates": candidates}
    if candidates:
        metrics["ga4_latest"] = query_one(
            conn,
            f"""SELECT property_id, metric_date, sessions, total_users, new_users, pageviews,
                       engaged_sessions, engagement_rate, conversions, conversion_rate, bounce_rate
                FROM ga4_daily_metrics
                WHERE property_id IN ({placeholders})
                ORDER BY metric_date DESC
                LIMIT 1""",
            candidates,
        )
        metrics["ga4_t30"] = query_one(
            conn,
            f"""SELECT COUNT(DISTINCT metric_date) AS days, MIN(metric_date) AS start_date, MAX(metric_date) AS end_date,
                       SUM(sessions) AS sessions, SUM(total_users) AS total_users, SUM(new_users) AS new_users,
                       SUM(pageviews) AS pageviews, SUM(conversions) AS conversions,
                       AVG(engagement_rate) AS avg_engagement_rate, AVG(bounce_rate) AS avg_bounce_rate
                FROM (
                  SELECT * FROM ga4_daily_metrics
                  WHERE property_id IN ({placeholders})
                  ORDER BY metric_date DESC
                  LIMIT 30
                )""",
            candidates,
        )
        metrics["ga4_traffic_t30"] = query_all(
            conn,
            f"""SELECT channel_group, SUM(sessions) AS sessions, SUM(new_users) AS new_users,
                       SUM(conversions) AS conversions, AVG(engagement_rate) AS avg_engagement_rate
                FROM ga4_traffic_sources
                WHERE property_id IN ({placeholders})
                  AND metric_date >= date((SELECT MAX(metric_date) FROM ga4_traffic_sources WHERE property_id IN ({placeholders})), '-29 day')
                GROUP BY channel_group
                ORDER BY sessions DESC
                LIMIT 12""",
            candidates + candidates,
        )
        if gsc_candidates:
            metrics["gsc_latest"] = query_one(
                conn,
                f"""SELECT property_id, gsc_site_url, ga4_property_id, metric_date, clicks, impressions, ctr, average_position
                    FROM gsc_daily_metrics
                    WHERE property_id IN ({gsc_placeholders}) OR gsc_site_url IN ({gsc_placeholders}) OR ga4_property_id = ?
                    ORDER BY metric_date DESC
                    LIMIT 1""",
                gsc_candidates + gsc_candidates + (ga4_id,),
            )
            metrics["gsc_t30"] = query_one(
                conn,
                f"""SELECT COUNT(DISTINCT metric_date) AS days, MIN(metric_date) AS start_date, MAX(metric_date) AS end_date,
                           SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                           AVG(ctr) AS avg_ctr, AVG(average_position) AS avg_position
                    FROM (
                      SELECT * FROM gsc_daily_metrics
                      WHERE property_id IN ({gsc_placeholders}) OR gsc_site_url IN ({gsc_placeholders}) OR ga4_property_id = ?
                      ORDER BY metric_date DESC
                      LIMIT 30
                    )""",
                gsc_candidates + gsc_candidates + (ga4_id,),
            )
            metrics["gsc_top_queries_t30"] = query_all(
                conn,
                f"""SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                           AVG(ctr) AS avg_ctr, AVG(average_position) AS avg_position
                    FROM gsc_queries
                    WHERE (property_id IN ({placeholders}) OR gsc_site_url IN ({gsc_placeholders}) OR ga4_property_id = ?)
                      AND metric_date >= date((SELECT MAX(metric_date) FROM gsc_queries WHERE property_id IN ({placeholders}) OR gsc_site_url IN ({gsc_placeholders}) OR ga4_property_id = ?), '-29 day')
                    GROUP BY query
                    ORDER BY clicks DESC, impressions DESC
                    LIMIT 15""",
                candidates + gsc_candidates + (ga4_id,) + candidates + gsc_candidates + (ga4_id,),
            )
        metrics["pagespeed_latest"] = query_all(
            conn,
            f"""SELECT property_id, metric_date, strategy, performance_score, accessibility_score,
                       best_practices_score, seo_score, lcp_value, cls_value, fcp_value,
                       ttfb_value, speed_index, total_blocking_time
                FROM pagespeed_metrics
                WHERE property_id IN ({placeholders})
                  AND metric_date = (SELECT MAX(metric_date) FROM pagespeed_metrics WHERE property_id IN ({placeholders}))
                ORDER BY strategy""",
            candidates + candidates,
        )
        metrics["gtmetrix_latest"] = query_one(
            conn,
            f"""SELECT property_id, metric_date, pagespeed_score, yslow_score, structure_score,
                       fully_loaded_time_ms, onload_time_ms, first_contentful_paint_ms,
                       time_to_interactive_ms, page_bytes, page_requests, test_server_location, test_browser
                FROM gtmetrix_metrics
                WHERE property_id IN ({placeholders})
                ORDER BY metric_date DESC
                LIMIT 1""",
            candidates,
        )
        metrics["dataforseo_onpage_latest"] = query_all(
            conn,
            f"""SELECT run_date, property_id, url, status_code, title, meta_description, title_length,
                       description_length, word_count, internal_links_count, external_links_count, images_count,
                       checks_json, page_timing_json
                FROM dataforseo_onpage_page_snapshots
                WHERE property_id IN ({placeholders})
                  AND run_date = (SELECT MAX(run_date) FROM dataforseo_onpage_page_snapshots WHERE property_id IN ({placeholders}))
                ORDER BY url
                LIMIT 20""",
            candidates + candidates,
        )
        metrics["dataforseo_serp_latest"] = query_all(
            conn,
            f"""SELECT run_date, property_id, keyword, location_name, device, status_code,
                       task_status_code, cost, check_url
                FROM dataforseo_serp_runs
                WHERE property_id IN ({placeholders})
                  AND run_date = (SELECT MAX(run_date) FROM dataforseo_serp_runs WHERE property_id IN ({placeholders}))
                ORDER BY keyword, device
                LIMIT 20""",
            candidates + candidates,
        )
        metrics["dataforseo_labs_latest"] = query_all(
            conn,
            f"""SELECT run_date, keyword, result_type, rank_absolute, rank_group, url, search_volume
                FROM dataforseo_labs_ranked_keywords
                WHERE property_id IN ({placeholders})
                  AND run_date = (SELECT MAX(run_date) FROM dataforseo_labs_ranked_keywords WHERE property_id IN ({placeholders}))
                ORDER BY rank_absolute ASC
                LIMIT 20""",
            candidates + candidates,
        )
        metrics["dataforseo_business_latest"] = query_all(
            conn,
            f"""SELECT run_date, keyword, title, category, address, city, region, zip, domain,
                       is_claimed, total_photos, rating, votes_count
                FROM dataforseo_business_profiles
                WHERE property_id IN ({placeholders})
                  AND run_date = (SELECT MAX(run_date) FROM dataforseo_business_profiles WHERE property_id IN ({placeholders}))
                ORDER BY keyword
                LIMIT 10""",
            candidates + candidates,
        )
        metrics["gbp_insights_t30"] = query_one(
            conn,
            """SELECT COUNT(DISTINCT metric_date) AS days, MIN(metric_date) AS start_date, MAX(metric_date) AS end_date,
                      SUM(total_profile_views) AS total_profile_views, SUM(website_clicks) AS website_clicks,
                      SUM(phone_calls) AS phone_calls, SUM(direction_requests) AS direction_requests,
                      SUM(total_actions) AS total_actions, SUM(total_queries) AS total_queries
               FROM (
                 SELECT * FROM gbp_daily_insights
                 WHERE property_id = ? OR gbp_location_id = ?
                 ORDER BY metric_date DESC
                 LIMIT 30
               )""",
            (ga4_id, identity.gbp_location_id or ""),
        )
        metrics["gbp_reviews_latest"] = query_one(
            conn,
            f"""SELECT property_id, gbp_location_id, metric_date, total_review_count,
                       average_rating, new_reviews_count
                FROM gbp_reviews_summary
                WHERE property_id IN ({placeholders}) OR gbp_location_id = ?
                ORDER BY metric_date DESC
                LIMIT 1""",
            candidates + (identity.gbp_location_id or "",),
        )
        metrics["google_ads_t30"] = query_one(
            conn,
            f"""SELECT COUNT(DISTINCT metric_date) AS days, MIN(metric_date) AS start_date, MAX(metric_date) AS end_date,
                       SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(conversions) AS conversions,
                       SUM(cost_micros) / 1000000.0 AS cost,
                       AVG(ctr) AS avg_ctr, AVG(conversion_rate) AS avg_conversion_rate
                FROM google_ads_campaigns
                WHERE property_id IN ({placeholders})
                  AND metric_date >= date((SELECT MAX(metric_date) FROM google_ads_campaigns WHERE property_id IN ({placeholders})), '-29 day')""",
            candidates + candidates,
        )
        metrics["availability_latest"] = query_one(
            conn,
            f"""SELECT property_id, snapshot_date, COUNT(*) AS available_units,
                       MIN(rent_from) AS min_rent, MAX(rent_to) AS max_rent,
                       SUM(CASE WHEN concession_amount IS NOT NULL AND concession_amount > 0 THEN 1 ELSE 0 END) AS units_with_concessions
                FROM unit_availability_units
                WHERE property_id IN ({placeholders})
                  AND snapshot_date = (SELECT MAX(snapshot_date) FROM unit_availability_units WHERE property_id IN ({placeholders}))
                GROUP BY property_id, snapshot_date
                LIMIT 1""",
            candidates + candidates,
        )
    if domain:
        metrics["cloudflare_cache_latest"] = query_all(
            conn,
            """SELECT property_id, property_name, request_date, path_tested, variant_key,
                      request_sequence, final_url, http_status, cf_cache_status,
                      ttfb_ms, total_time_ms, audit_status
               FROM cloudflare_cache_synthetic_checks
               WHERE normalized_domain = ?
                 AND request_date = (SELECT MAX(request_date) FROM cloudflare_cache_synthetic_checks WHERE normalized_domain = ?)
               ORDER BY path_tested, request_sequence
               LIMIT 20""",
            (domain, domain),
        )
    conn.close()
    return metrics


def fmt(value: Any) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:,.2f}"
    if isinstance(value, int):
        return f"{value:,}"
    return str(value)


def markdown_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> str:
    if not rows:
        return "_No rows found._"
    header = "| " + " | ".join(label for _, label in columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    lines = [header, divider]
    for row in rows:
        lines.append("| " + " | ".join(markdown_cell(row.get(key)) for key, _ in columns) + " |")
    return "\n".join(lines)


def markdown_cell(value: Any) -> str:
    return fmt(value).replace("\n", " ").replace("|", "\\|")


def build_report(snapshot: dict[str, Any], metrics: dict[str, Any], diff_events: list[dict[str, Any]]) -> str:
    identity = snapshot["identity"]
    pages = snapshot["pages"]
    primary_base_url = identity.get("website_url") or ""
    status_counts: dict[str, int] = {}
    for page in pages:
        status_counts[str(page.get("status_code"))] = status_counts.get(str(page.get("status_code")), 0) + 1
    risk_rows = [
        {"url": page["url"], "flags": ", ".join(page.get("risk_flags", []))}
        for page in pages
        if page.get("risk_flags")
    ]
    total_text_blocks = sum(len(page.get("text_blocks", [])) for page in pages)
    total_words = sum(int(page.get("visible_word_count") or 0) for page in pages)
    total_json_ld = sum(len(page.get("json_ld", [])) for page in pages)
    total_custom_schema = sum(len(page.get("custom_schema_scripts", [])) for page in pages)
    total_links = sum(len(page.get("links", [])) for page in pages)
    total_ctas = sum(len(page.get("cta_links", [])) for page in pages)
    total_images = sum(len(page.get("images", [])) for page in pages)
    sitemap_evidence = snapshot.get("sitemap")
    sitemaps_evidence = snapshot.get("sitemaps")
    robots_hashes: list[str] = []
    if isinstance(sitemap_evidence, dict) and sitemap_evidence.get("robots_hash"):
        robots_hashes.append(str(sitemap_evidence.get("robots_hash")))
    if isinstance(sitemaps_evidence, list):
        for site in sitemaps_evidence:
            if isinstance(site, dict) and site.get("robots_hash"):
                robots_hashes.append(str(site.get("robots_hash")))
    robots_hashes = list(dict.fromkeys([h for h in robots_hashes if h]))

    lines = [
        f"# Monteverde Website Change Watch Baseline - {snapshot['captured_at']}",
        "",
        "## Scope",
        "",
        f"- Property: {identity['property_name']} (`{identity.get('property_code')}`)",
        f"- Website: {identity.get('website_url')}",
        f"- GA4: {identity.get('ga4_property_id')}",
        f"- GSC: {identity.get('gsc_url')}",
        f"- Community ID: {identity.get('community_id')}",
        f"- Baseline artifact: `{snapshot['artifact_dir']}`",
        "",
        "## Public Site Baseline",
        "",
        f"- Sitemap pages captured: {len(pages)}",
        f"- Status distribution: {status_counts}",
        f"- Rendered text blocks watched: {total_text_blocks:,}",
        f"- Visible word count baseline: {total_words:,}",
        f"- Links watched: {total_links:,}",
        f"- CTA-like links watched: {total_ctas:,}",
        f"- Images/alt text watched: {total_images:,}",
        f"- JSON-LD blocks: {total_json_ld:,}",
        f"- Custom schema-bearing scripts: {total_custom_schema:,}",
        f"- Robots hash: `{robots_hashes[0]}`" if robots_hashes else "- Robots hash: `n/a`",
        "",
        "## Page Inventory",
        "",
        markdown_table(
            [
                {
                    "path": display_path(page["url"], primary_base_url),
                    "status": page.get("status_code"),
                    "title": page.get("title"),
                    "robots": page.get("robots"),
                    "words": page.get("visible_word_count"),
                    "json_ld": len(page.get("json_ld", [])),
                    "ctas": len(page.get("cta_links", [])),
                    "risk": ", ".join(page.get("risk_flags", [])),
                }
                for page in pages
            ],
            [
                ("path", "Path"),
                ("status", "Status"),
                ("title", "Title"),
                ("robots", "Robots"),
                ("words", "Words"),
                ("json_ld", "JSON-LD"),
                ("ctas", "CTAs"),
                ("risk", "Risk Flags"),
            ],
        ),
        "",
        "## Risk Flags",
        "",
        markdown_table(risk_rows, [("url", "URL"), ("flags", "Flags")]) if risk_rows else "_No public crawl risk flags found._",
        "",
        "## Data Pond Metric Baseline",
        "",
        "### GA4",
        "",
        f"- Latest: `{metrics.get('ga4_latest')}`",
        f"- T30: `{metrics.get('ga4_t30')}`",
        "",
        "Top traffic sources T30:",
        "",
        markdown_table(
            metrics.get("ga4_traffic_t30", []),
            [
                ("channel_group", "Channel"),
                ("sessions", "Sessions"),
                ("new_users", "New Users"),
                ("conversions", "Conversions"),
                ("avg_engagement_rate", "Avg Engagement"),
            ],
        ),
        "",
        "### GSC",
        "",
        f"- Latest: `{metrics.get('gsc_latest')}`",
        f"- T30: `{metrics.get('gsc_t30')}`",
        "",
        "Top queries T30:",
        "",
        markdown_table(
            metrics.get("gsc_top_queries_t30", []),
            [
                ("query", "Query"),
                ("clicks", "Clicks"),
                ("impressions", "Impressions"),
                ("avg_ctr", "Avg CTR"),
                ("avg_position", "Avg Position"),
            ],
        ),
        "",
        "### Performance",
        "",
        "PSI latest:",
        "",
        markdown_table(
            metrics.get("pagespeed_latest", []),
            [
                ("metric_date", "Date"),
                ("strategy", "Strategy"),
                ("performance_score", "Perf"),
                ("accessibility_score", "A11y"),
                ("best_practices_score", "Best"),
                ("seo_score", "SEO"),
                ("lcp_value", "LCP"),
                ("cls_value", "CLS"),
                ("ttfb_value", "TTFB"),
            ],
        ),
        "",
        f"GTMetrix latest: `{metrics.get('gtmetrix_latest')}`",
        "",
        "### SEO Evidence",
        "",
        "DataForSEO OnPage latest:",
        "",
        markdown_table(
            metrics.get("dataforseo_onpage_latest", []),
            [
                ("run_date", "Run"),
                ("url", "URL"),
                ("status_code", "Status"),
                ("title_length", "Title Len"),
                ("description_length", "Desc Len"),
                ("word_count", "Words"),
                ("images_count", "Images"),
            ],
        ),
        "",
        "DataForSEO SERP latest:",
        "",
        markdown_table(
            metrics.get("dataforseo_serp_latest", []),
            [
                ("run_date", "Run"),
                ("keyword", "Keyword"),
                ("location_name", "Location"),
                ("device", "Device"),
                ("task_status_code", "Task"),
                ("cost", "Cost"),
            ],
        ),
        "",
        "DataForSEO ranked keyword latest:",
        "",
        markdown_table(
            metrics.get("dataforseo_labs_latest", []),
            [
                ("run_date", "Run"),
                ("keyword", "Keyword"),
                ("result_type", "Type"),
                ("rank_absolute", "Rank"),
                ("url", "URL"),
                ("search_volume", "Volume"),
            ],
        ),
        "",
        "DataForSEO business latest:",
        "",
        markdown_table(
            metrics.get("dataforseo_business_latest", []),
            [
                ("run_date", "Run"),
                ("keyword", "Keyword"),
                ("title", "Title"),
                ("rating", "Rating"),
                ("votes_count", "Votes"),
                ("is_claimed", "Claimed"),
                ("total_photos", "Photos"),
            ],
        ),
        "",
        "### Local, Ads, Inventory, Cache",
        "",
        f"- GBP insights T30: `{metrics.get('gbp_insights_t30')}`",
        f"- GBP reviews latest: `{metrics.get('gbp_reviews_latest')}`",
        f"- Google Ads T30: `{metrics.get('google_ads_t30')}`",
        f"- Availability latest: `{metrics.get('availability_latest')}`",
        "",
        "Cloudflare/cache latest:",
        "",
        markdown_table(
            metrics.get("cloudflare_cache_latest", []),
            [
                ("request_date", "Date"),
                ("path_tested", "Path"),
                ("http_status", "Status"),
                ("cf_cache_status", "CF Cache"),
                ("ttfb_ms", "TTFB ms"),
                ("total_time_ms", "Total ms"),
                ("audit_status", "Audit"),
            ],
        ),
        "",
        "## Diff Against Prior Run",
        "",
    ]
    if snapshot.get("diff_suppressed"):
        reasons = snapshot.get("diff_suppressed_reasons") or snapshot.get("capture_health", {}).get("reasons") or []
        if reasons:
            reason_text = ", ".join(str(item) for item in reasons)
        else:
            reason_text = "capture was unhealthy"
        lines.append(f"_Diff suppressed because {reason_text}._")
    elif snapshot.get("previous_snapshot_path") is None:
        lines.append("_No prior run was available, so this is the initial baseline._")
    elif not diff_events:
        lines.append("_No diff events detected._")
    else:
        severity_order = {"high": 0, "medium": 1, "low": 2}
        rows = sorted(diff_events, key=lambda row: (severity_order.get(row.get("severity", "low"), 9), row.get("url", ""), row.get("field", "")))
        lines.append(
            markdown_table(
                [
                    {
                        "severity": row.get("severity"),
                        "type": row.get("type"),
                        "url": row.get("url"),
                        "field": row.get("field"),
                    }
                    for row in rows[:80]
                ],
                [("severity", "Severity"), ("type", "Type"), ("url", "URL"), ("field", "Field")],
            )
        )
    lines.extend(
        [
            "",
            "## Backend Coverage Caveat",
            "",
            "This run captures public rendered output and Data Pond metrics. It will detect backend changes that alter public HTML, metadata, schema, sitemap, robots, headers, public WordPress REST output, or measured performance/search signals. Full backend accountability requires WordPress/WP Engine revision or activity-log access.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Monteverde website change-watch baseline.")
    parser.add_argument("--property", default="Monteverde", help="Property key to resolve through governed identity matrix.")
    parser.add_argument("--no-compare", action="store_true", help="Do not compare against the prior snapshot.")
    args = parser.parse_args()

    identity = resolve_property_identity(args.property)
    if identity is None:
        raise SystemExit(f"Could not resolve property identity for {args.property!r}")
    watch_config = load_watch_config(args.property)
    sites = watched_sites(watch_config, identity)
    if not sites:
        raise SystemExit(f"Resolved property {identity.property_name} has no website_url")

    property_slug = slugify(identity.property_name)
    stamp = utc_stamp()
    artifact_dir = REPORT_ROOT / property_slug / stamp
    raw_dir = artifact_dir / "raw_pages"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    session = build_http_session()

    page_urls: list[str] = []
    sitemaps: list[dict[str, Any]] = []
    for site in sites:
        site_base_url = site.get("base_url")
        if not site_base_url:
            continue
        site_host = urlparse(site_base_url).netloc
        site["dns_diagnostics"] = dns_diagnostics(site_host)
        site["preflight"] = preflight_site(session, site_base_url)

        if not site["dns_diagnostics"].get("ok") or not site["preflight"].get("ok"):
            sitemaps.append(
                {
                    "site_key": site.get("site_key"),
                    "base_url": site_base_url,
                    "robots_url": urljoin(site_base_url, "/robots.txt"),
                    "robots_status": None,
                    "robots_hash": None,
                    "sitemaps": [],
                    "page_count": 1,
                    "page_urls": [site_base_url],
                    "preflight": site["preflight"],
                    "dns_diagnostics": site["dns_diagnostics"],
                    "skipped": True,
                    "skip_reason": "dns_or_preflight_failed",
                }
            )
            page_urls.append(site_base_url)
            continue

        urls, site_sitemap = discover_sitemap_urls(session, site_base_url)
        sitemaps.append(
            {"site_key": site.get("site_key"), "base_url": site_base_url, "preflight": site["preflight"], "dns_diagnostics": site["dns_diagnostics"]}
            | site_sitemap
        )
        page_urls.extend(urls)

    page_urls = list(dict.fromkeys(page_urls))

    def capture_one(item: tuple[int, str]) -> dict[str, Any]:
        index, page_url = item
        result = fetch(session, page_url)
        host_slug = slugify(urlparse(page_url).netloc or "site")
        site_raw_dir = raw_dir / host_slug
        site_raw_dir.mkdir(parents=True, exist_ok=True)
        page_name = f"{index:03d}-{slugify(urlparse(page_url).path or 'home')}.html"
        raw_path = site_raw_dir / page_name
        html_text = result.get("text", "")
        raw_path.write_text(html_text, encoding="utf-8")
        html_bytes = result.get("bytes") or b""
        if result.get("status_code") != 200 or len(html_bytes) < MIN_HTML_BYTES_FOR_PARSE:
            return minimal_page_snapshot(page_url, result, str(raw_path))
        return extract_page_snapshot(page_url, result, str(raw_path))

    pages: list[dict[str, Any]] = []
    if page_urls:
        workers = min(PAGE_FETCH_WORKERS, max(1, len(page_urls)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            for page in executor.map(capture_one, list(enumerate(page_urls, start=1))):
                pages.append(page)

    metrics = summarize_data_pond(identity)
    snapshot = {
        "schema_version": "website_change_watch_baseline_v1",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "run_date": run_date(),
        "artifact_dir": str(artifact_dir),
        "identity": identity.as_mapping("property_identity_matrix"),
        "watch_config": watch_config,
        "sitemap": sitemaps[0] if sitemaps else {},
        "sitemaps": sitemaps,
        "pages": pages,
        "metrics": metrics,
    }

    previous_path = None if args.no_compare else latest_previous_snapshot(property_slug, artifact_dir)
    snapshot["previous_snapshot_path"] = str(previous_path) if previous_path else None
    healthy, health_reasons = is_capture_healthy(snapshot)
    snapshot["capture_health"] = {"healthy": healthy, "reasons": health_reasons}
    snapshot["diff_suppressed"] = False
    snapshot["diff_suppressed_reasons"] = []

    diff_events: list[dict[str, Any]] = []
    if not args.no_compare and previous_path is not None:
        if healthy:
            diff_events = compare_snapshots(previous_path, snapshot)
        else:
            snapshot["diff_suppressed"] = True
            snapshot["diff_suppressed_reasons"] = health_reasons
    snapshot["diff_event_count"] = len(diff_events)

    (artifact_dir / "baseline_snapshot.json").write_text(json.dumps(snapshot, indent=2, sort_keys=True), encoding="utf-8")
    (artifact_dir / "diff_events.json").write_text(json.dumps(diff_events, indent=2, sort_keys=True), encoding="utf-8")
    (artifact_dir / "metrics_baseline.json").write_text(json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8")
    report = build_report(snapshot, metrics, diff_events)
    report_path = artifact_dir / "baseline_report.md"
    report_path.write_text(report, encoding="utf-8")

    latest_report_path, latest_snapshot_path = latest_snapshot_paths(property_slug)
    if healthy:
        latest_report_path.write_text(report, encoding="utf-8")
        latest_snapshot_path.write_text(json.dumps(snapshot, indent=2, sort_keys=True), encoding="utf-8")
    else:
        # Never clobber the canonical latest baseline pointer with a failed/empty capture.
        # If the current latest pointer is already unhealthy, restore it to the most recent healthy baseline.
        try:
            current = json.loads(latest_snapshot_path.read_text(encoding="utf-8")) if latest_snapshot_path.exists() else None
        except Exception:
            current = None
        current_healthy = False
        if isinstance(current, dict):
            current_healthy, _ = is_capture_healthy(current)
        if not current_healthy:
            restored = most_recent_healthy_snapshot(property_slug, exclude_dir=artifact_dir)
            if restored:
                restored_snapshot = json.loads(restored.read_text(encoding="utf-8"))
                restored_report_path = restored.parent / "baseline_report.md"
                if restored_report_path.exists():
                    latest_report_path.write_text(restored_report_path.read_text(encoding="utf-8"), encoding="utf-8")
                else:
                    restored_report = build_report(restored_snapshot, restored_snapshot.get("metrics") or {}, [])
                    latest_report_path.write_text(restored_report, encoding="utf-8")
                latest_snapshot_path.write_text(json.dumps(restored_snapshot, indent=2, sort_keys=True), encoding="utf-8")

    print(json.dumps({"artifact_dir": str(artifact_dir), "report_path": str(report_path), "pages": len(pages), "diff_events": len(diff_events)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
