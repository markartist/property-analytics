#!/usr/bin/env python3
"""Harvest rendered Resi topper facts with Cloudflare Browser Rendering.

This is intentionally non-mutating. It writes a local evidence packet and a
KV-shaped payload, but it does not publish to KV/D1 or change any Worker route.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api.scripts.wrangler_auth import build_runtime_env  # noqa: E402

CF_ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"
BROWSER_CONTENT_ENDPOINT = (
    "https://api.cloudflare.com/client/v4/accounts/"
    f"{CF_ACCOUNT_ID}/browser-rendering/content"
)
DEFAULT_MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)


@dataclass
class HarvestTarget:
    url: str
    property_code: str | None = None
    label: str | None = None


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def human_date() -> str:
    return datetime.now().strftime("%m-%d-%Y")


def normalize_space(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def page_text(element: Any) -> str:
    return normalize_space(element.get_text(" ", strip=True)) if element else ""


def abs_url(base_url: str, href: str | None) -> str | None:
    if not href:
        return None
    return urljoin(base_url, href)


def clean_filename(value: str) -> str:
    host = urlparse(value).netloc or value
    return re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")


def cloudflare_rendered_html(
    target_url: str,
    token: str,
    width: int,
    height: int,
    user_agent: str,
) -> dict[str, Any]:
    payload = {
        "url": target_url,
        "viewport": {"width": width, "height": height},
        "userAgent": user_agent,
    }
    response = requests.post(
        BROWSER_CONTENT_ENDPOINT,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    body_text = response.text
    try:
        body = response.json()
    except ValueError:
        body = {"success": False, "errors": [{"message": body_text[:300]}], "result": ""}
    if response.status_code >= 400 or not body.get("success"):
        raise RuntimeError(
            f"Cloudflare Browser Rendering failed: status={response.status_code} "
            f"errors={body.get('errors')}"
        )
    html = body.get("result") or ""
    if not html:
        raise RuntimeError("Cloudflare Browser Rendering returned an empty HTML result.")
    return {
        "html": html,
        "status_code": response.status_code,
        "content_type": response.headers.get("content-type"),
    }


def link_inventory(base_url: str, element: Any) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    if not element:
        return links
    for a in element.select("a[href]"):
        label = page_text(a)
        href = abs_url(base_url, a.get("href"))
        if label or href:
            links.append({"label": label, "url": href or ""})
    return links


def score_section_for_promo(text: str) -> int:
    low = text.lower()
    score = 0
    for term in ["free", "special", "limited time", "select homes", "availability", "contact us"]:
        if term in low:
            score += 1
    if re.search(r"\bup to\b|\$\s*\d+|\d+\s*(?:weeks?|months?)\s+free", low):
        score += 2
    return score


def extract_promo(base_url: str, soup: BeautifulSoup) -> dict[str, Any]:
    candidates = []
    selectors = [
        '[data-page-section="promo_bar"]',
        '[data-component-name*="promo" i]',
        ".popup-element",
        ".tm-popdown",
        "[class*=promo i]",
    ]
    for selector in selectors:
        for element in soup.select(selector):
            text = page_text(element)
            if text and score_section_for_promo(text) >= 2:
                candidates.append((score_section_for_promo(text), selector, element, text))

    if not candidates:
        body_text = page_text(soup.body)
        match = re.search(
            r"((?:Up to\s+)?(?:\$[\d,]+\s+off|\d+\s+(?:weeks?|months?)\s+free)[^.!\n]{0,90}[.!]?)",
            body_text,
            flags=re.I,
        )
        if not match:
            return {"present": False, "source": "cloudflare_browser_rendered_html", "confidence": 0.0}
        title = normalize_space(match.group(1))
        return {
            "present": True,
            "source": "cloudflare_browser_rendered_html_text_pattern",
            "title": title,
            "body": "",
            "disclaimer": "",
            "links": [],
            "confidence": 0.45,
        }

    candidates.sort(key=lambda item: (item[0], len(item[3])), reverse=True)
    _, selector, element, text = candidates[0]
    headings = [page_text(h) for h in element.select("h1,h2,h3,summary,button") if page_text(h)]
    paragraphs = [page_text(p) for p in element.select("p") if page_text(p)]
    emphasis = [page_text(e) for e in element.select("em,i") if page_text(e)]

    title = headings[0] if headings else ""
    if not title:
        match = re.search(
            r"((?:Up to\s+)?(?:\$[\d,]+\s+off|\d+\s+(?:weeks?|months?)\s+free)[^.!\n]{0,90}[.!]?)",
            text,
            flags=re.I,
        )
        title = normalize_space(match.group(1)) if match else text[:120]

    body = ""
    for p in paragraphs:
        if p != title and "limited time offer" not in p.lower():
            body = p
            break

    disclaimer = ""
    for value in emphasis + paragraphs:
        if "limited time" in value.lower() or "select homes" in value.lower():
            disclaimer = value
            break

    return {
        "present": True,
        "source": "cloudflare_browser_rendered_html",
        "selector": selector,
        "title": normalize_space(title),
        "body": normalize_space(body),
        "disclaimer": normalize_space(disclaimer),
        "links": link_inventory(base_url, element),
        "confidence": 0.85 if body or disclaimer else 0.65,
        "raw_text": text[:500],
    }


def extract_reviews(base_url: str, soup: BeautifulSoup) -> dict[str, Any]:
    text = page_text(soup.body)
    match = re.search(r"\((\d(?:\.\d)?)\)\s+([\d,]+)\s+Reviews", text, flags=re.I)
    if not match:
        return {
            "present": False,
            "source": "cloudflare_browser_rendered_html",
            "confidence": 0.0,
        }
    rating = float(match.group(1))
    count = int(match.group(2).replace(",", ""))
    review_link = None
    for a in soup.select("a[href]"):
        label = page_text(a)
        href = a.get("href") or ""
        if "review" in label.lower() or "review" in href.lower():
            review_link = abs_url(base_url, href)
            break
    return {
        "present": True,
        "source": "cloudflare_browser_rendered_html",
        "rating": rating,
        "count": count,
        "url": review_link or abs_url(base_url, "/reviews/"),
        "fractional_stars_required": True,
        "full_star_rounding_allowed": False,
        "confidence": 0.85,
    }


def extract_awards(base_url: str, soup: BeautifulSoup) -> dict[str, Any]:
    assets = []
    for img in soup.select("img[src], svg"):
        outer = str(img)[:1000]
        label = " ".join(
            filter(
                None,
                [
                    img.get("alt") if hasattr(img, "get") else "",
                    img.get("aria-label") if hasattr(img, "get") else "",
                    img.get("src") if hasattr(img, "get") else "",
                    outer,
                ],
            )
        )
        if "kingsley" in label.lower() or "award" in label.lower():
            src = img.get("src") if hasattr(img, "get") else None
            assets.append(
                {
                    "label": normalize_space(img.get("alt") or "Award"),
                    "url": abs_url(base_url, src) if src else None,
                    "alt": normalize_space(img.get("alt") or "Award badge"),
                }
            )
    text = page_text(soup.body)
    if not assets and re.search(r"\bKingsley\b|\bAward\b", text, flags=re.I):
        assets.append({"label": "Award", "url": None, "alt": "Award badge"})
    return {
        "present": bool(assets),
        "source": "cloudflare_browser_rendered_html",
        "assets": assets,
        "confidence": 0.8 if assets else 0.0,
    }


def section_label(text: str) -> str:
    if not text:
        return ""
    words = text.split()
    return " ".join(words[:8])


def extract_content_blocks(base_url: str, soup: BeautifulSoup) -> list[dict[str, Any]]:
    blocks = []
    skip_terms = [
        "apartments & pricing",
        "live better",
        "find your home",
        "schedule a tour",
        "apply now",
        "smarthub",
        "this website uses cookies",
    ]
    for section in soup.select("[data-page-section], section, main > div"):
        text = page_text(section)
        low = text.lower()
        if len(text) < 120:
            continue
        if any(term in low for term in skip_terms):
            continue
        heading = ""
        h = section.select_one("h1,h2,h3,h4")
        if h:
            heading = page_text(h)
        if not heading:
            heading = section_label(text)
        eyebrow = ""
        for candidate in section.select("p,span,div"):
            ctext = page_text(candidate)
            if 3 <= len(ctext) <= 50 and ctext.upper() == ctext and ctext != heading.upper():
                eyebrow = ctext
                break
        bullets = [page_text(li) for li in section.select("li") if page_text(li)]
        image = section.select_one("img[src]")
        image_url = abs_url(base_url, image.get("src")) if image else None
        body = text
        if heading and body.startswith(heading):
            body = normalize_space(body[len(heading) :])
        blocks.append(
            {
                "heading": heading,
                "eyebrow": eyebrow,
                "body": body[:900],
                "bullets": bullets[:8],
                "image_url": image_url,
                "source_selector": section.get("data-page-section") or section.name,
                "confidence": 0.7,
            }
        )
        if len(blocks) >= 2:
            break
    return blocks


def extract_phone(soup: BeautifulSoup) -> dict[str, Any]:
    links = []
    for a in soup.select('a[href^="tel:"]'):
        links.append({"label": page_text(a), "href": a.get("href")})
    visible = links[0]["label"] if links else ""
    return {
        "visible_phone": visible,
        "tel_links": links,
        "source": "cloudflare_browser_rendered_html",
        "confidence": 0.8 if links else 0.0,
    }


def build_fact_payload(
    target: HarvestTarget,
    html: str,
    width: int,
    height: int,
    user_agent: str,
) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    captured_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    html_sha = hashlib.sha256(html.encode("utf-8")).hexdigest()
    text = page_text(soup.body)
    return {
        "schema_version": "resi_topper_facts.v0.proof",
        "property_code": target.property_code,
        "label": target.label,
        "url": target.url,
        "captured_at": captured_at,
        "capture": {
            "provider": "cloudflare_browser_rendering_content",
            "viewport": {"width": width, "height": height},
            "user_agent": user_agent,
            "html_sha256": html_sha,
            "text_length": len(text),
        },
        "topper_facts": {
            "promo": extract_promo(target.url, soup),
            "reviews": extract_reviews(target.url, soup),
            "awards": extract_awards(target.url, soup),
            "phone": extract_phone(soup),
            "content_blocks": extract_content_blocks(target.url, soup),
        },
    }


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Canonical homepage URL to render.")
    parser.add_argument("--property-code", help="Property code for evidence/payload.")
    parser.add_argument("--label", help="Human label for evidence.")
    parser.add_argument("--width", type=int, default=390)
    parser.add_argument("--height", type=int, default=844)
    parser.add_argument("--user-agent", default=DEFAULT_MOBILE_UA)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=ROOT / "reports" / "resi_edge_freshness",
        help="Evidence root. A dated/run directory is created under this path.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env = build_runtime_env()
    token = env.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise SystemExit("Cloudflare API token was not resolved through Keeper-backed Wrangler auth.")

    target = HarvestTarget(url=args.url, property_code=args.property_code, label=args.label)
    rendered = cloudflare_rendered_html(target.url, token, args.width, args.height, args.user_agent)
    payload = build_fact_payload(target, rendered["html"], args.width, args.height, args.user_agent)

    slug = clean_filename(target.url)
    run_dir = args.out_dir / human_date() / slug / f"harvest-{utc_stamp()}"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "rendered.html").write_text(rendered["html"], encoding="utf-8")
    write_json(run_dir / "topper-facts.json", payload)
    write_json(
        run_dir / "kv-payload.preview.json",
        {
            "key": f"resi:topper:{target.property_code or slug}",
            "value": payload,
            "publish_status": "preview_only_not_published",
        },
    )
    write_json(
        run_dir / "capture-response.json",
        {
            "status_code": rendered["status_code"],
            "content_type": rendered["content_type"],
            "html_bytes": len(rendered["html"].encode("utf-8")),
        },
    )
    print(json.dumps({"ok": True, "run_dir": str(run_dir), "payload": payload}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
