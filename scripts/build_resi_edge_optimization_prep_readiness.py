#!/usr/bin/env python3
"""Build a non-mutating Resi Edge optimization prep readiness packet.

This script intentionally performs read-only checks only. It inventories the
Phase 2 draft manifests, current active prep manifests when present, existing
launch/PSI evidence, and public vanity HTML signals needed before optimization.
"""

from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
LATEST_DRAFT_DIR = (
    REPO_ROOT
    / "reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T175534Z/draft-manifests"
)
ACTIVE_MANIFEST_DIR = REPO_ROOT / "config/portfolio_resi_edge_stabilization"
STATIC_VALIDATOR = REPO_ROOT / "scripts/validate_resi_edge_package_static.mjs"
PRE_SWITCH_PSI = (
    REPO_ROOT
    / "reports/resi_edge_performance/performance-baselines/performance-baseline-20260818T175339Z/performance-baseline-results.csv"
)
FINAL_VANITY_PSI = (
    REPO_ROOT
    / "reports/resi_edge_performance/performance-baselines/performance-baseline-20260820T160054Z-final-vanity-merged/performance-baseline-results.csv"
)
LATEST_VANITY_QA = REPO_ROOT / "reports/domain_ops/20260821_143906_vanity_qa/vanity-qa-results.csv"
MANIFEST_PREP = (
    REPO_ROOT
    / "reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T175534Z/manifest-prep.json"
)
AHREFS_PHASE2_PLAN = (
    REPO_ROOT
    / "reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T234731Z/phase2_ahrefs_vanity_project_plan.json"
)
REPORT_ROOT = REPO_ROOT / "reports/resi_edge_performance/optimization-prep"
EXPECTED_HEAP_ID = "286627304"
OLD_HEAP_ID = "676880719"
EXPECTED_CONSENT = "compact_shell_pill_v29_2026_08_20"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123 Safari/537.36"
)
EXPECTED_PAGES = [
    ("Home", "/"),
    ("Apartments & Pricing", "/apartments/"),
    ("Features", "/features/"),
    ("Amenities", "/amenities/"),
    ("Gallery", "/gallery/"),
    ("Location", "/neighborhood/"),
    ("FAQs", "/faqs/"),
    ("Reviews", "/reviews/"),
    ("Contact", "/contact/"),
    ("Specials", "/specials/"),
    ("About Venterra", "/about/"),
]
REQUIRED_NAV_LABELS = {label for label, _path in EXPECTED_PAGES if label != "Home"} | {"SMARTHUB"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self._current: dict[str, str] | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr = {k.lower(): v or "" for k, v in attrs}
        self._current = {
            "href": attr.get("href", ""),
            "data_subsection": attr.get("data-subsection", ""),
            "data_component_name": attr.get("data-component-name", ""),
            "data_action": attr.get("data-action", ""),
        }
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._current is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or self._current is None:
            return
        text = re.sub(r"\s+", " ", " ".join(self._text)).strip()
        row = {**self._current, "text": text}
        self.links.append(row)
        self._current = None
        self._text = []


def slug_domain(domain: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", domain.lower()).strip("-")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def find_pending(value: Any, path: str = "") -> list[str]:
    if isinstance(value, dict):
        found: list[str] = []
        for key, child in value.items():
            found.extend(find_pending(child, f"{path}.{key}" if path else key))
        return found
    if isinstance(value, list):
        found = []
        for index, child in enumerate(value):
            found.extend(find_pending(child, f"{path}[{index}]"))
        return found
    if isinstance(value, str) and value.strip().lower() in {"required_before_apply", "pending_apply_gate"}:
        return [path or "<root>"]
    return []


def read_csv_index(path: Path, key: str) -> dict[str, list[dict[str, str]]]:
    if not path.exists():
        return {}
    index: dict[str, list[dict[str, str]]] = {}
    with path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            index.setdefault(row.get(key, ""), []).append(row)
    return index


def read_manifest_prep_index(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = load_json(path)
    return {row.get("property_code", ""): row for row in data.get("properties", [])}


def read_ahrefs_index(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = load_json(path)
    index: dict[str, dict[str, Any]] = {}
    for row in data.get("rows", []):
        matches = row.get("existing_matches") or []
        match = matches[0] if matches else {}
        index[row.get("property_code", "")] = {
            "status": row.get("status", ""),
            "project_id": match.get("project_id", ""),
            "project_name": match.get("project_name", row.get("project_name", "")),
            "verified": match.get("verified"),
            "web_analytics_data_key_present": match.get("web_analytics_data_key_present"),
            "url": match.get("url") or row.get("url", ""),
            "access": match.get("access", row.get("access", "")),
        }
    return index


def fetch_html(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {
                "ok": 200 <= response.status < 300,
                "status": response.status,
                "final_url": response.geturl(),
                "html": body,
                "error": "",
            }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {
            "ok": False,
            "status": exc.code,
            "final_url": url,
            "html": body,
            "error": f"HTTP {exc.code}",
        }
    except Exception as exc:  # noqa: BLE001 - report-only script
        return {"ok": False, "status": 0, "final_url": url, "html": "", "error": str(exc)}


def fetch_status(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            response.read(8192)
            return {
                "ok": 200 <= response.status < 300,
                "status": response.status,
                "final_url": response.geturl(),
                "error": "",
            }
    except urllib.error.HTTPError as exc:
        return {"ok": False, "status": exc.code, "final_url": url, "error": f"HTTP {exc.code}"}
    except Exception as exc:  # noqa: BLE001 - report-only script
        return {"ok": False, "status": 0, "final_url": url, "error": str(exc)}


def meta_content(html: str, attr: str, value: str) -> str:
    pattern = rf"<meta[^>]+{attr}=[\"']{re.escape(value)}[\"'][^>]+content=[\"']([^\"']*)"
    match = re.search(pattern, html, re.I)
    return match.group(1) if match else ""


def link_href(html: str, rel: str) -> str:
    pattern = rf"<link[^>]+rel=[\"']{re.escape(rel)}[\"'][^>]+href=[\"']([^\"']*)"
    match = re.search(pattern, html, re.I)
    return match.group(1) if match else ""


def extract_live_signals(domain: str) -> dict[str, Any]:
    url = f"https://{domain}/"
    fetched = fetch_html(url)
    html = fetched["html"]
    parser = LinkParser()
    parser.feed(html)
    nav_labels: list[str] = []
    nav_hrefs: list[str] = []
    nav_map: dict[str, str] = {}
    attributed_links = 0
    attributed_nav_labels: list[str] = []
    for link in parser.links:
        href = link["href"]
        text = link["text"]
        if not text or not href:
            continue
        has_data_attributes = bool(
            link.get("data_subsection") or link.get("data_component_name") or link.get("data_action")
        )
        if has_data_attributes:
            attributed_links += 1
        if href.startswith("/") or domain in href or "smarthub/login" in href:
            normalized = text.upper() if text.upper() == "SMARTHUB" else text
            if normalized in REQUIRED_NAV_LABELS and has_data_attributes:
                attributed_nav_labels.append(normalized)
            if normalized not in nav_labels and normalized in REQUIRED_NAV_LABELS:
                nav_labels.append(normalized)
                nav_hrefs.append(href)
                nav_map[normalized] = href
    heap_ids = sorted(set(re.findall(r"heap\.load\([\"'](\d+)[\"']", html)))
    gtm_ids = sorted(set(re.findall(r"GTM-[A-Z0-9]+", html)))
    gtag_ids = sorted(set(re.findall(r"G-[A-Z0-9]+", html)))
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
    return {
        "fetch_ok": fetched["ok"],
        "status": fetched["status"],
        "final_url": fetched["final_url"],
        "title": title,
        "meta_description": meta_content(html, "name", "description"),
        "meta_robots": meta_content(html, "name", "robots"),
        "canonical": link_href(html, "canonical"),
        "og_image": meta_content(html, "property", "og:image"),
        "heap_ids": heap_ids,
        "has_expected_heap": EXPECTED_HEAP_ID in heap_ids,
        "has_old_heap": OLD_HEAP_ID in heap_ids,
        "heap_debug_true": "HEAP_JS_DEBUG = true" in html or "HEAP_JS_DEBUG=true" in html,
        "gtm_ids": gtm_ids,
        "gtag_ids": gtag_ids,
        "nav_labels": nav_labels,
        "nav_count": len(nav_labels),
        "nav_hrefs": nav_hrefs,
        "nav_map": nav_map,
        "missing_nav_labels": sorted(REQUIRED_NAV_LABELS - set(nav_labels)),
        "attributed_links": attributed_links,
        "attributed_nav_labels": sorted(set(attributed_nav_labels)),
        "has_specials_nav": "Specials" in nav_labels,
        "has_smarthub_nav": "SMARTHUB" in nav_labels,
        "html_bytes": len(html.encode("utf-8")),
    }


def resolve_page_url(domain: str, href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if not href.startswith("/"):
        href = f"/{href}"
    return f"https://{domain}{href}"


def page_shape_for(domain: str, nav_map: dict[str, str]) -> dict[str, Any]:
    pages: list[dict[str, Any]] = []
    for label, fallback_path in EXPECTED_PAGES:
        href = nav_map.get(label, fallback_path)
        url = resolve_page_url(domain, href)
        result = fetch_status(url)
        pages.append(
            {
                "label": label,
                "url": url,
                "ok": result["ok"],
                "status": result["status"],
                "final_url": result["final_url"],
                "error": result["error"],
            }
        )
    failed = [page for page in pages if not page["ok"]]
    return {
        "expected_page_count": len(pages),
        "page_ok_count": sum(1 for page in pages if page["ok"]),
        "pages": pages,
        "failed_pages": failed,
    }


def run_static_validator(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"present": False, "pass": False, "exit_code": None, "summary": "active manifest missing"}
    result = subprocess.run(
        ["node", str(STATIC_VALIDATOR), "--manifest", str(path.relative_to(REPO_ROOT))],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    summary = result.stderr.strip() or result.stdout.strip().splitlines()[-1] if (result.stderr.strip() or result.stdout.strip()) else ""
    return {
        "present": True,
        "pass": result.returncode == 0,
        "exit_code": result.returncode,
        "summary": summary[:500],
    }


def psi_for(rows: list[dict[str, str]], label: str, strategy: str) -> dict[str, Any]:
    for row in rows:
        if row.get("target_label") == label and row.get("strategy") == strategy:
            return {
                "score": row.get("score", ""),
                "lcp_ms": row.get("largest_contentful_paint_ms", ""),
                "tbt_ms": row.get("total_blocking_time_ms", ""),
                "requests": row.get("network_requests", ""),
                "bytes": row.get("total_byte_weight", ""),
                "ok": row.get("ok", ""),
            }
    return {"score": "", "lcp_ms": "", "tbt_ms": "", "requests": "", "bytes": "", "ok": ""}


def status_for(row: dict[str, Any]) -> str:
    blockers = row["blockers"]
    if blockers:
        return "blocked"
    if not row["active_manifest_present"]:
        return "needs_manifest"
    if row["active_static_pass"]:
        return "prep_static_ready"
    return "needs_manifest_fix"


def next_action_for(row: dict[str, Any]) -> str:
    if not row["active_manifest_present"]:
        return "Promote the draft manifest only after source/property review fills the remaining sourced content, analytics, rollback, and evidence fields."
    if row["active_pending_field_count"]:
        return "Finish active manifest source fields before any runner plan."
    if not row["active_static_pass"]:
        return "Fix static package validation before any runner plan."
    if row["live_signals"].get("has_old_heap") or row["live_signals"].get("heap_debug_true"):
        return "Hold apply until Resi removes old/direct Heap and debug mode or the exception is explicitly documented."
    if row["page_shape"].get("failed_pages"):
        return "Resolve failed vanity pages before using this property as an optimization candidate."
    if row["vanity_qa_result"] not in {"green", ""}:
        return "Resolve vanity QA issue before optimization planning."
    return "Ready for governed runner plan; do not stage/apply without explicit approval and fresh proof gates."


def write_packet(rows: list[dict[str, Any]], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "Resi Edge 20-site optimization prep readiness",
        "mutation_policy": "read_only_no_live_domain_mutation",
        "totals": {
            "properties": len(rows),
            "active_manifest_present": sum(1 for row in rows if row["active_manifest_present"]),
            "active_static_pass": sum(1 for row in rows if row["active_static_pass"]),
            "old_heap_present": sum(1 for row in rows if row["live_signals"].get("has_old_heap")),
            "expected_heap_present": sum(1 for row in rows if row["live_signals"].get("has_expected_heap")),
            "debug_true_present": sum(1 for row in rows if row["live_signals"].get("heap_debug_true")),
            "vanity_green": sum(1 for row in rows if row["vanity_qa_result"] == "green"),
            "page_shape_all_ok": sum(
                1
                for row in rows
                if row["page_shape"].get("page_ok_count") == row["page_shape"].get("expected_page_count")
            ),
            "ahrefs_data_key_present": sum(
                1 for row in rows if row["analytics_readiness"].get("ahrefs_web_analytics_data_key_present")
            ),
            "blocked": sum(1 for row in rows if row["status"] == "blocked"),
        },
        "rows": rows,
    }
    (out_dir / "optimization-prep-readiness.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    csv_path = out_dir / "optimization-prep-readiness.csv"
    with csv_path.open("w", newline="") as handle:
        fieldnames = [
            "property_code",
            "property_name",
            "domain",
            "status",
            "vanity_qa_result",
            "active_manifest_present",
            "active_static_pass",
            "legacy_mobile",
            "legacy_desktop",
            "staging_mobile",
            "staging_desktop",
            "vanity_mobile",
            "vanity_desktop",
            "live_heap_ids",
            "old_heap_present",
            "expected_heap_present",
            "heap_debug_true",
            "page_ok_count",
            "expected_page_count",
            "failed_pages",
            "nav_count",
            "nav_labels",
            "missing_nav_labels",
            "attributed_links",
            "ga4_measurement_id",
            "ahrefs_project_id",
            "ahrefs_verified",
            "ahrefs_data_key_present",
            "staging_kinsta_url",
            "review_items",
            "next_action",
            "blockers",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "property_code": row["property_code"],
                    "property_name": row["property_name"],
                    "domain": row["domain"],
                    "status": row["status"],
                    "vanity_qa_result": row["vanity_qa_result"],
                    "active_manifest_present": row["active_manifest_present"],
                    "active_static_pass": row["active_static_pass"],
                    "legacy_mobile": row["psi"]["legacy_mobile"]["score"],
                    "legacy_desktop": row["psi"]["legacy_desktop"]["score"],
                    "staging_mobile": row["psi"]["staging_mobile"]["score"],
                    "staging_desktop": row["psi"]["staging_desktop"]["score"],
                    "vanity_mobile": row["psi"]["vanity_mobile"]["score"],
                    "vanity_desktop": row["psi"]["vanity_desktop"]["score"],
                    "live_heap_ids": ";".join(row["live_signals"].get("heap_ids") or []),
                    "old_heap_present": row["live_signals"].get("has_old_heap"),
                    "expected_heap_present": row["live_signals"].get("has_expected_heap"),
                    "heap_debug_true": row["live_signals"].get("heap_debug_true"),
                    "page_ok_count": row["page_shape"].get("page_ok_count"),
                    "expected_page_count": row["page_shape"].get("expected_page_count"),
                    "failed_pages": "; ".join(
                        f"{page['label']}:{page['status']}" for page in row["page_shape"].get("failed_pages", [])
                    ),
                    "nav_count": row["live_signals"].get("nav_count"),
                    "nav_labels": "; ".join(row["live_signals"].get("nav_labels") or []),
                    "missing_nav_labels": "; ".join(row["live_signals"].get("missing_nav_labels") or []),
                    "attributed_links": row["live_signals"].get("attributed_links"),
                    "ga4_measurement_id": row["analytics_readiness"].get("ga4_measurement_id"),
                    "ahrefs_project_id": row["analytics_readiness"].get("ahrefs_project_id"),
                    "ahrefs_verified": row["analytics_readiness"].get("ahrefs_verified"),
                    "ahrefs_data_key_present": row["analytics_readiness"].get("ahrefs_web_analytics_data_key_present"),
                    "staging_kinsta_url": row["source_prep"].get("staging_kinsta_url"),
                    "review_items": "; ".join(row["review_items"]),
                    "next_action": row["next_action"],
                    "blockers": "; ".join(row["blockers"]),
                }
            )
    lines = [
        "# Resi Edge Optimization Prep Readiness",
        "",
        f"Human date: {datetime.now().strftime('%m/%d/%Y')}",
        "",
        "Read-only packet. No DNS, Cloudflare, WordPress/Kinsta, Zaraz, GA4, Ahrefs, R2, cache, or Worker mutation was performed.",
        "",
        "## Summary",
        "",
        f"- Properties checked: `{len(rows)}`",
        f"- Active prep manifests present: `{sum(1 for row in rows if row['active_manifest_present'])}/{len(rows)}`",
        f"- Static package validation passed: `{sum(1 for row in rows if row['active_static_pass'])}/{len(rows)}`",
        f"- Vanity QA green: `{sum(1 for row in rows if row['vanity_qa_result'] == 'green')}/{len(rows)}`",
        f"- Live pages still showing old Heap `{OLD_HEAP_ID}`: `{sum(1 for row in rows if row['live_signals'].get('has_old_heap'))}/{len(rows)}`",
        f"- Live pages showing expected Heap `{EXPECTED_HEAP_ID}`: `{sum(1 for row in rows if row['live_signals'].get('has_expected_heap'))}/{len(rows)}`",
        f"- Live pages showing `HEAP_JS_DEBUG=true`: `{sum(1 for row in rows if row['live_signals'].get('heap_debug_true'))}/{len(rows)}`",
        f"- Full expected page shape OK: `{sum(1 for row in rows if row['page_shape'].get('page_ok_count') == row['page_shape'].get('expected_page_count'))}/{len(rows)}`",
        f"- Ahrefs Web Analytics data key present in readback: `{sum(1 for row in rows if row['analytics_readiness'].get('ahrefs_web_analytics_data_key_present'))}/{len(rows)}`",
        "",
        "## Readiness Table",
        "",
        "| Property | Domain | Status | QA | Pages | PSI legacy | PSI staging | PSI vanity | Heap | Ahrefs | Next |",
        "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
    ]
    for row in rows:
        heap = ",".join(row["live_signals"].get("heap_ids") or []) or "none"
        ahrefs = row["analytics_readiness"]
        lines.append(
            "| {property_name} (`{property_code}`) | `{domain}` | `{status}` | `{qa}` | {pages}/{expected} | {lm}/{ld} | {sm}/{sd} | {vm}/{vd} | `{heap}` | `{ahrefs_project}` / key `{ahrefs_key}` | {next_action} |".format(
                property_name=row["property_name"],
                property_code=row["property_code"],
                domain=row["domain"],
                status=row["status"],
                qa=row["vanity_qa_result"] or "",
                pages=row["page_shape"].get("page_ok_count") or 0,
                expected=row["page_shape"].get("expected_page_count") or 0,
                lm=row["psi"]["legacy_mobile"]["score"] or "",
                ld=row["psi"]["legacy_desktop"]["score"] or "",
                sm=row["psi"]["staging_mobile"]["score"] or "",
                sd=row["psi"]["staging_desktop"]["score"] or "",
                vm=row["psi"]["vanity_mobile"]["score"] or "",
                vd=row["psi"]["vanity_desktop"]["score"] or "",
                heap=heap,
                ahrefs_project=ahrefs.get("ahrefs_project_id") or "",
                ahrefs_key=ahrefs.get("ahrefs_web_analytics_data_key_present"),
                next_action=row["next_action"],
            )
        )
    lines.extend(["", "## Property Detail", ""])
    for row in rows:
        failed_pages = row["page_shape"].get("failed_pages") or []
        failed_text = ", ".join(f"{page['label']} ({page['status']})" for page in failed_pages) or "none"
        review_text = "; ".join(row["review_items"]) or "none"
        blockers = "; ".join(row["blockers"]) or "none"
        lines.extend(
            [
                f"### {row['property_name']} (`{row['property_code']}`)",
                "",
                f"- Live URL: `https://{row['domain']}/`",
                f"- Staging URL: `{row['source_prep'].get('staging_kinsta_url') or ''}`",
                f"- Pages OK: `{row['page_shape'].get('page_ok_count')}/{row['page_shape'].get('expected_page_count')}`; failed: {failed_text}",
                f"- PSI progression: legacy `{row['psi']['legacy_mobile']['score']}/{row['psi']['legacy_desktop']['score']}`, staging `{row['psi']['staging_mobile']['score']}/{row['psi']['staging_desktop']['score']}`, vanity `{row['psi']['vanity_mobile']['score']}/{row['psi']['vanity_desktop']['score']}`",
                f"- Analytics: GA4 `{row['analytics_readiness'].get('ga4_measurement_id') or ''}`, Heap IDs `{','.join(row['live_signals'].get('heap_ids') or []) or 'none'}`, Ahrefs project `{row['analytics_readiness'].get('ahrefs_project_id') or ''}`",
                f"- Review items: {review_text}",
                f"- Blockers: {blockers}",
                f"- Next action: {row['next_action']}",
                "",
            ]
        )
    lines.extend(
        [
            "",
            "## Responsible Next Work",
            "",
            "1. Promote missing active manifests using sourced live values only.",
            "2. Keep optimization apply blocked until old/direct Heap and debug mode are removed by Resi or explicitly accounted for.",
            "3. Re-run final vanity PSI after analytics cleanup before judging optimization lift.",
            "4. Use the static validator and runner plan before any stage/apply approval.",
        ]
    )
    (out_dir / "OPTIMIZATION_PREP_READINESS.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    if not LATEST_DRAFT_DIR.exists():
        print(f"Missing draft directory: {LATEST_DRAFT_DIR}", file=sys.stderr)
        return 2
    pre_psi = read_csv_index(PRE_SWITCH_PSI, "property_code")
    final_psi = read_csv_index(FINAL_VANITY_PSI, "property_code")
    vanity_qa = {rows[0].get("property_code", ""): rows[0] for rows in read_csv_index(LATEST_VANITY_QA, "property_code").values() if rows}
    manifest_prep = read_manifest_prep_index(MANIFEST_PREP)
    ahrefs_index = read_ahrefs_index(AHREFS_PHASE2_PLAN)
    rows: list[dict[str, Any]] = []
    for draft_path in sorted(LATEST_DRAFT_DIR.glob("*.json")):
        draft = load_json(draft_path)
        target = draft.get("target", {})
        code = target.get("property_code", "")
        domain = target.get("domain", "")
        active_path = ACTIVE_MANIFEST_DIR / f"{slug_domain(domain)}.manifest.json"
        active = load_json(active_path) if active_path.exists() else None
        live = extract_live_signals(domain) if domain else {}
        page_shape = page_shape_for(domain, live.get("nav_map", {})) if domain and live.get("fetch_ok") else {
            "expected_page_count": len(EXPECTED_PAGES),
            "page_ok_count": 0,
            "pages": [],
            "failed_pages": [],
        }
        static = run_static_validator(active_path)
        prep = manifest_prep.get(code, {})
        ahrefs = ahrefs_index.get(code, {})
        active_analytics = (active or {}).get("analytics", {}) if active else {}
        draft_analytics = draft.get("analytics", {})
        active_ga4 = active_analytics.get("ga4", {}) if isinstance(active_analytics, dict) else {}
        draft_ga4 = draft_analytics.get("ga4", {}) if isinstance(draft_analytics, dict) else {}
        active_ahrefs = active_analytics.get("ahrefs", {}) if isinstance(active_analytics, dict) else {}
        blockers: list[str] = []
        review_items: list[str] = []
        pending_fields = find_pending(active) if active else []
        if not active:
            blockers.append("active_manifest_missing")
        if pending_fields:
            blockers.append(f"active_manifest_has_pending_fields:{len(pending_fields)}")
        if active and not static["pass"]:
            blockers.append("static_package_validation_failed")
        if live.get("has_old_heap"):
            blockers.append(f"old_heap_{OLD_HEAP_ID}_present")
        if live.get("heap_debug_true"):
            blockers.append("heap_debug_true_present")
        if not live.get("fetch_ok"):
            blockers.append("live_root_fetch_failed")
        if vanity_qa.get(code, {}).get("result") not in {"green", ""}:
            blockers.append(f"vanity_qa_{vanity_qa.get(code, {}).get('result')}")
        if page_shape.get("failed_pages"):
            blockers.append(f"page_shape_failed:{len(page_shape['failed_pages'])}")
        if live.get("missing_nav_labels"):
            review_items.append("missing_nav_labels:" + ",".join(live.get("missing_nav_labels") or []))
        if live.get("attributed_links", 0) == 0:
            review_items.append("no_live_link_data_attributes_detected")
        if ahrefs and ahrefs.get("verified") is False and active_ahrefs.get("verified") is not True:
            review_items.append("ahrefs_project_not_verified_but_web_analytics_key_present")
        if not ahrefs.get("web_analytics_data_key_present") and not active_ahrefs.get("verified"):
            review_items.append("ahrefs_data_key_not_confirmed_in_phase2_readback")
        row = {
            "property_code": code,
            "property_name": target.get("property_name", ""),
            "domain": domain,
            "draft_manifest": str(draft_path.relative_to(REPO_ROOT)),
            "active_manifest": str(active_path.relative_to(REPO_ROOT)) if active_path.exists() else "",
            "active_manifest_present": bool(active),
            "active_static_pass": bool(static["pass"]),
            "active_static_summary": static["summary"],
            "active_pending_field_count": len(pending_fields),
            "live_signals": live,
            "page_shape": page_shape,
            "vanity_qa_result": vanity_qa.get(code, {}).get("result", ""),
            "source_prep": {
                "staging_kinsta_url": prep.get("staging_kinsta_url", ""),
                "source_lookup_rows": prep.get("source_lookup_rows"),
                "pending_field_count": prep.get("pending_field_count"),
                "gap_labels": prep.get("gap_labels", []),
                "default_display_phone": prep.get("default_display_phone", ""),
            },
            "analytics_readiness": {
                "ga4_measurement_id": active_ga4.get("measurement_id") or draft_ga4.get("measurement_id") or prep.get("ga4_measurement_id", ""),
                "heap_expected_id": EXPECTED_HEAP_ID,
                "heap_live_ids": live.get("heap_ids", []),
                "heap_old_present": live.get("has_old_heap"),
                "heap_debug_true": live.get("heap_debug_true"),
                "ahrefs_project_id": active_ahrefs.get("existing_project_id") or ahrefs.get("project_id", ""),
                "ahrefs_verified": active_ahrefs.get("verified", ahrefs.get("verified")),
                "ahrefs_web_analytics_data_key_present": ahrefs.get("web_analytics_data_key_present") or bool(active_ahrefs.get("data_key_status")),
                "ahrefs_status": ahrefs.get("status", ""),
            },
            "psi": {
                "legacy_mobile": psi_for(pre_psi.get(code, []), "legacy Venterra URL", "mobile"),
                "legacy_desktop": psi_for(pre_psi.get(code, []), "legacy Venterra URL", "desktop"),
                "staging_mobile": psi_for(pre_psi.get(code, []), "staging Kinsta URL", "mobile"),
                "staging_desktop": psi_for(pre_psi.get(code, []), "staging Kinsta URL", "desktop"),
                "vanity_mobile": psi_for(final_psi.get(code, []), "final vanity URL", "mobile"),
                "vanity_desktop": psi_for(final_psi.get(code, []), "final vanity URL", "desktop"),
            },
            "review_items": review_items,
            "blockers": blockers,
        }
        row["status"] = status_for(row)
        row["next_action"] = next_action_for(row)
        rows.append(row)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = REPORT_ROOT / f"optimization-prep-{stamp}"
    write_packet(rows, out_dir)
    print(json.dumps({"out_dir": str(out_dir), "rows": len(rows)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
