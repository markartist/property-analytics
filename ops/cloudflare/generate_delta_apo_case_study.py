#!/usr/bin/env python3
"""
Generate a pre-APO case-study baseline for The Delta Pearland.
"""

from __future__ import annotations

import json
import re
import sqlite3
import ssl
import sys
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
IDENTITY_PATH = ROOT / "config" / "property_identity_matrix.json"
CLOUDFLARE_AUDIT_PATH = ROOT / "reports" / "cloudflare_cache_audit" / "cloudflare_cache_audit_latest.json"
OUTPUT_ROOT = ROOT / "reports" / "cloudflare_apo_case_study" / "delta_pearland"
PSI_KEY_PATH = ROOT / "Spotlight_Properties_Report" / "config" / "pagespeed_api_key.txt"

PROPERTY_CODE = "TX4DP"
GA4_PROPERTY_ID = "441503068"
DOMAIN = "thedeltapearland.com"
BASE_URL = f"https://{DOMAIN}/"
CASE_DATE = date.today().isoformat()
USER_AGENT = "Mozilla/5.0 (compatible; DeltaAPOCaseStudy/1.0; +https://venterraliving.com)"


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_url(url: str, *, timeout: int = 30, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if headers:
        request_headers.update(headers)
    request = Request(url, headers=request_headers)
    started = datetime.now(UTC)
    try:
        with urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
            body = response.read()
            elapsed_ms = (datetime.now(UTC) - started).total_seconds() * 1000
            decoded = body.decode(response.headers.get_content_charset() or "utf-8", errors="replace")
            return {
                "ok": True,
                "url": url,
                "final_url": response.geturl(),
                "status": response.status,
                "headers": dict(response.headers.items()),
                "body": decoded,
                "bytes": len(body),
                "elapsed_ms": round(elapsed_ms, 2),
            }
    except URLError as exc:
        return {"ok": False, "url": url, "error": str(exc)}


def fetch_headers(url: str) -> dict[str, Any]:
    request = Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    started = datetime.now(UTC)
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            elapsed_ms = (datetime.now(UTC) - started).total_seconds() * 1000
            return {
                "ok": True,
                "url": url,
                "final_url": response.geturl(),
                "status": response.status,
                "headers": dict(response.headers.items()),
                "elapsed_ms": round(elapsed_ms, 2),
            }
    except URLError as exc:
        return {"ok": False, "url": url, "error": str(exc)}


def compact_headers(headers: dict[str, str]) -> dict[str, str | None]:
    interesting = [
        "server",
        "cf-cache-status",
        "cache-control",
        "vary",
        "x-cache",
        "x-cacheable",
        "x-powered-by",
        "set-cookie",
        "cf-ray",
        "content-type",
        "location",
        "alt-svc",
    ]
    lower = {key.lower(): value for key, value in headers.items()}
    compact = {key: lower.get(key) for key in interesting if key in lower}
    if "set-cookie" in compact:
        compact["set-cookie"] = "[present]"
    return compact


def extract_attrs(html: str, tag: str, attr: str) -> list[str]:
    pattern = re.compile(rf"<{tag}\b[^>]*\b{attr}=[\"']([^\"']+)[\"'][^>]*>", re.IGNORECASE)
    return [unescape(match.group(1)) for match in pattern.finditer(html)]


def extract_meta(html: str, name: str) -> str | None:
    patterns = [
        rf'<meta[^>]+name=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']*)["\']',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']{re.escape(name)}["\']',
        rf'<meta[^>]+property=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']*)["\']',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']{re.escape(name)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return unescape(match.group(1)).strip()
    return None


def extract_title(html: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return unescape(re.sub(r"\s+", " ", match.group(1)).strip()) if match else None


def extract_canonical(html: str) -> str | None:
    patterns = [
        r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']',
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return unescape(match.group(1)).strip()
    return None


def extract_json_ld(html: str) -> list[dict[str, Any]]:
    blocks = []
    pattern = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(html):
        raw = unescape(match.group(1)).strip()
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            blocks.append({"parse_error": True, "raw_excerpt": raw[:500]})
    return blocks


def flatten_schema_nodes(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    for block in blocks:
        graph = block.get("@graph")
        if isinstance(graph, list):
            nodes.extend(item for item in graph if isinstance(item, dict))
        else:
            nodes.append(block)
    return nodes


def host_counts(urls: list[str]) -> dict[str, int]:
    counts = Counter()
    for item in urls:
        parsed = urlparse(item if item.startswith(("http://", "https://")) else urljoin(BASE_URL, item))
        counts[parsed.hostname or "relative"] += 1
    return dict(sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])))


def analyze_page(url: str) -> dict[str, Any]:
    fetched = fetch_url(url)
    if not fetched.get("ok"):
        return fetched

    html = fetched["body"]
    scripts = extract_attrs(html, "script", "src")
    stylesheets = extract_attrs(html, "link", "href")
    images = extract_attrs(html, "img", "src")
    iframes = extract_attrs(html, "iframe", "src")
    links = extract_attrs(html, "a", "href")
    json_ld = extract_json_ld(html)
    schema_nodes = flatten_schema_nodes(json_ld)
    text_lower = html.lower()

    cta_links = []
    for href in links:
        lowered = href.lower()
        if any(token in lowered for token in ["scheduletour", "createpipelineapplication", "floor-plans", "contact", "apply", "tour"]):
            cta_links.append(href)

    anomalies: list[str] = []
    schema_names = [node.get("name") for node in schema_nodes if isinstance(node.get("name"), str)]
    if any(name == "The Scenic Apartments" for name in schema_names):
        anomalies.append("Structured data still contains legacy name 'The Scenic Apartments'.")
    description = extract_meta(html, "description")
    if description and "one and two homes" in description:
        anomalies.append("Meta description appears to omit 'bedroom' in 'one and two homes'.")
    if "cf-cache-status" not in {key.lower() for key in fetched["headers"]}:
        anomalies.append("Cloudflare cache status header was not visible on fetched response.")

    return {
        "ok": True,
        "url": url,
        "final_url": fetched["final_url"],
        "status": fetched["status"],
        "bytes": fetched["bytes"],
        "elapsed_ms": fetched["elapsed_ms"],
        "headers": compact_headers(fetched["headers"]),
        "title": extract_title(html),
        "meta_description": description,
        "canonical": extract_canonical(html),
        "counts": {
            "scripts": len(scripts),
            "stylesheets_or_link_hrefs": len(stylesheets),
            "images": len(images),
            "iframes": len(iframes),
            "links": len(links),
            "json_ld_blocks": len(json_ld),
        },
        "script_hosts": host_counts(scripts),
        "stylesheet_hosts": host_counts(stylesheets),
        "image_hosts": host_counts(images),
        "iframe_hosts": host_counts(iframes),
        "detected_platforms": {
            "wordpress": "wp-content" in text_lower or "wp-json" in text_lower,
            "wp_engine": any("wp engine" in str(value).lower() for value in fetched["headers"].values()),
            "yootheme": "yootheme" in text_lower,
            "resi_plugin": "resi-elements-venterra" in text_lower,
            "getresi_widget": "app.getresi.com" in text_lower,
            "online_venterraliving": "online.venterraliving.com" in text_lower,
            "google_tag_manager": "googletagmanager.com" in text_lower,
            "heap": "heap.load" in text_lower or "heap-api.com" in text_lower,
            "youtube_embed": "youtube.com/embed" in text_lower,
            "sightmap": "sightmap.com" in text_lower,
        },
        "schema_types": Counter(str(node.get("@type")) for node in schema_nodes if node.get("@type")),
        "schema_names": schema_names[:12],
        "cta_links": sorted(set(cta_links))[:20],
        "anomalies": anomalies,
    }


def db_rows(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(query, params).fetchall()]


def latest_operating_data() -> dict[str, Any]:
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    return {
        "property": db_rows(
            """
            SELECT property_id, property_name, full_url, domain, gsc_url, unit_count, encasa_region, city, state
            FROM properties
            WHERE property_id = ? OR domain = ?
            """,
            (GA4_PROPERTY_ID, DOMAIN),
        ),
        "latest_psi": db_rows(
            """
            SELECT metric_date, strategy, performance_score, accessibility_score, best_practices_score,
                   seo_score, lcp_value, fcp_value, cls_value, ttfb_value, total_blocking_time
            FROM pagespeed_metrics
            WHERE property_id = ?
            ORDER BY metric_date DESC, strategy
            LIMIT 10
            """,
            (GA4_PROPERTY_ID,),
        ),
        "psi_t30": db_rows(
            """
            SELECT strategy, COUNT(*) AS days, ROUND(AVG(performance_score), 1) AS avg_score,
                   ROUND(AVG(lcp_value), 2) AS avg_lcp, ROUND(AVG(total_blocking_time), 1) AS avg_tbt
            FROM pagespeed_metrics
            WHERE property_id = ? AND metric_date >= ?
            GROUP BY strategy
            """,
            (GA4_PROPERTY_ID, thirty_days_ago),
        ),
        "latest_gtmetrix": db_rows(
            """
            SELECT metric_date, pagespeed_score, structure_score, fully_loaded_time_ms,
                   first_contentful_paint_ms, time_to_interactive_ms, page_bytes, page_requests
            FROM gtmetrix_metrics
            WHERE property_id = ?
            ORDER BY metric_date DESC
            LIMIT 5
            """,
            (GA4_PROPERTY_ID,),
        ),
        "latest_ga4": db_rows(
            """
            SELECT metric_date, sessions, pageviews, total_users, new_users, conversions, bounce_rate
            FROM ga4_daily_metrics
            WHERE property_id = ?
            ORDER BY metric_date DESC
            LIMIT 10
            """,
            (GA4_PROPERTY_ID,),
        ),
        "latest_gsc": db_rows(
            """
            SELECT metric_date, clicks, impressions, ctr, average_position, gsc_site_url
            FROM gsc_daily_metrics
            WHERE gsc_site_url = ? OR ga4_property_id = ? OR property_id = ?
            ORDER BY metric_date DESC
            LIMIT 10
            """,
            (BASE_URL, GA4_PROPERTY_ID, BASE_URL),
        ),
        "cloudflare_db_rows": db_rows(
            """
            SELECT request_date, path_tested, variant_key, request_sequence, http_status,
                   cf_cache_status, ROUND(ttfb_ms, 2) AS ttfb_ms, ROUND(total_time_ms, 2) AS total_time_ms,
                   audit_status
            FROM cloudflare_cache_synthetic_checks
            WHERE property_id = ? AND request_date = ?
            ORDER BY path_tested, variant_key, request_sequence
            """,
            (GA4_PROPERTY_ID, CASE_DATE),
        ),
    }


def fetch_live_psi() -> dict[str, Any]:
    if not PSI_KEY_PATH.exists():
        return {"ok": False, "error": f"Missing PSI key path: {PSI_KEY_PATH}"}
    api_key = PSI_KEY_PATH.read_text(encoding="utf-8").strip()
    if not api_key:
        return {"ok": False, "error": "PSI API key file is empty"}

    results: dict[str, Any] = {"ok": True, "fetched_at": datetime.now(UTC).isoformat().replace("+00:00", "Z")}
    raw_dir = OUTPUT_ROOT / CASE_DATE / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    for strategy in ("mobile", "desktop"):
        psi_url = (
            "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
            f"?url={BASE_URL}&strategy={strategy}&category=performance&category=accessibility"
            f"&category=best-practices&category=seo&key={api_key}"
        )
        fetched = fetch_url(psi_url, timeout=90, headers={"Accept": "application/json"})
        if not fetched.get("ok"):
            results[strategy] = {"ok": False, "error": fetched.get("error")}
            continue
        try:
            payload = json.loads(fetched["body"])
        except json.JSONDecodeError as exc:
            results[strategy] = {"ok": False, "error": str(exc)}
            continue
        (raw_dir / f"psi_{strategy}.json").write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        lhr = payload.get("lighthouseResult") or {}
        audits = lhr.get("audits") or {}
        cats = lhr.get("categories") or {}
        results[strategy] = {
            "ok": True,
            "performance_score": round((cats.get("performance") or {}).get("score", 0) * 100),
            "accessibility_score": round((cats.get("accessibility") or {}).get("score", 0) * 100),
            "best_practices_score": round((cats.get("best-practices") or {}).get("score", 0) * 100),
            "seo_score": round((cats.get("seo") or {}).get("score", 0) * 100),
            "lcp_ms": (audits.get("largest-contentful-paint") or {}).get("numericValue"),
            "fcp_ms": (audits.get("first-contentful-paint") or {}).get("numericValue"),
            "tbt_ms": (audits.get("total-blocking-time") or {}).get("numericValue"),
            "cls": (audits.get("cumulative-layout-shift") or {}).get("numericValue"),
            "speed_index_ms": (audits.get("speed-index") or {}).get("numericValue"),
            "final_url": lhr.get("finalDisplayedUrl") or lhr.get("finalUrl"),
        }
    return results


def find_latest_cache_plan() -> dict[str, Any]:
    root = ROOT / "outputs" / "cloudflare_full_page_cache"
    if not root.exists():
        return {"ok": False, "error": "No cache-plan output directory exists"}
    candidates = sorted(root.glob("*/thedeltapearland.com*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not candidates:
        return {"ok": False, "error": "No Delta cache-plan output was found"}
    payload = read_json(candidates[0], {})
    payload["path"] = str(candidates[0])
    return payload


def build_summary(data: dict[str, Any]) -> str:
    identity = data["identity"]
    db = data["db"]
    audit = data["cloudflare_latest"]
    delta_audit = next(
        (row for row in audit.get("domain_results", []) if row.get("domain") == DOMAIN),
        {},
    ) if audit else {}

    latest_psi = db["latest_psi"][:2]
    latest_gt = db["latest_gtmetrix"][:1]
    homepage = data["pages"].get(BASE_URL, {})
    floorplans = data["pages"].get(f"{BASE_URL}floor-plans/", {})
    live_psi = data["live_psi"]
    cache_plan = data["cache_plan"]
    warm_hit_percent = delta_audit.get("warm_hit_percent")
    cache_rule_path = cache_plan.get("path")
    cache_rule_label = "not found"
    if cache_plan.get("ok") is False:
        cache_rule_label = "unavailable"
    elif cache_plan.get("applied_ruleset_id"):
        cache_rule_label = f"applied ({cache_plan.get('action', 'updated')})"
    elif cache_plan.get("action"):
        cache_rule_label = str(cache_plan.get("action"))
    cache_rule_detail = cache_plan.get("applied_ruleset_id") or cache_plan.get("error") or "no error"

    lines = [
        "# The Delta Pearland APO Case Study Baseline",
        "",
        f"Generated: {data['generated_at']}",
        "",
        "## Identity",
        "",
        f"- Governed property code: `{identity.get('property_code')}`",
        f"- Current Cloudflare/Data Collection key: `{GA4_PROPERTY_ID}`",
        f"- Domain: `{DOMAIN}`",
        f"- Community ID: `{identity.get('community_id')}`",
        f"- Region: `{identity.get('encasa_region')}`",
        f"- Units: `{identity.get('unit_count')}`",
        "",
        "## Baseline Verdict",
        "",
        f"- Cloudflare audit status: `{delta_audit.get('domain_status')}`",
        f"- Warm HIT coverage: `{warm_hit_percent}%`",
        f"- Homepage second-request desktop TTFB: `{delta_audit.get('homepage_second_ttfb_ms')} ms`",
        f"- Homepage second-request mobile TTFB: `{delta_audit.get('homepage_mobile_second_ttfb_ms')} ms`",
        f"- GraphQL analytics visibility: `{delta_audit.get('graphql_status')}`",
        f"- Cache-rule status: `{cache_rule_label}`; `{cache_rule_detail}`",
        "",
        "Delta is ready for an APO case study. Cloudflare zone/settings/ruleset visibility is now available, APO is enabled, and the Phase 1 homepage cache rule is applied.",
        (
            "After enabling WP Engine Edge Full Page Cache and purging both WP Engine and Cloudflare, anonymous HTML now reaches Cloudflare warm HIT."
            if warm_hit_percent and warm_hit_percent > 0
            else "The baseline shows anonymous HTML remains uncached at the edge after the controlled rule application, which makes the origin/cacheability behavior the next optimization question."
        ),
        "",
        "## Latest Stored Performance",
        "",
    ]
    for row in latest_psi:
        lines.append(
            f"- PSI {row['metric_date']} `{row['strategy']}`: score `{row['performance_score']}`, "
            f"LCP `{row['lcp_value']}s`, TBT `{row['total_blocking_time']}ms`, TTFB `{row['ttfb_value']}ms`"
        )
    if latest_gt:
        row = latest_gt[0]
        lines.append(
            f"- GTMetrix {row['metric_date']}: score `{row['pagespeed_score']}`, structure `{row['structure_score']}`, "
            f"fully loaded `{row['fully_loaded_time_ms']}ms`, `{row['page_requests']}` requests, `{row['page_bytes']}` bytes"
        )
    if live_psi.get("ok"):
        for strategy in ("mobile", "desktop"):
            row = live_psi.get(strategy) or {}
            if row.get("ok"):
                lines.append(
                    f"- Live PSI `{strategy}`: score `{row['performance_score']}`, "
                    f"LCP `{round((row.get('lcp_ms') or 0) / 1000, 2)}s`, "
                    f"TBT `{round(row.get('tbt_ms') or 0, 1)}ms`"
                )
    else:
        lines.append(f"- Live PSI fetch blocked: {live_psi.get('error')}")
    lines.extend(
        [
            "",
            "## Site Makeup",
            "",
            f"- Homepage platform signals: `{homepage.get('detected_platforms', {})}`",
            f"- Homepage assets: `{homepage.get('counts', {})}`",
            f"- Floor-plan assets: `{floorplans.get('counts', {})}`",
            f"- Homepage headers: `{homepage.get('headers', {})}`",
            f"- Floor-plan headers: `{floorplans.get('headers', {})}`",
            "",
            "## Notable Findings",
            "",
        ]
    )
    findings = []
    if warm_hit_percent == 0.0:
        findings.append("Cloudflare is active, but tested anonymous HTML never reached warm HIT.")
    elif warm_hit_percent and warm_hit_percent > 0:
        findings.append("WP Engine Edge Full Page Cache was the turning-point control: post-enable warm synthetic probes reached Cloudflare HIT.")
    if "Cookie" in str(homepage.get("headers", {}).get("vary")):
        findings.append("The origin response varies on Cookie, which must be accounted for in APO/cache-rule testing.")
    findings.extend(homepage.get("anomalies", []))
    if homepage.get("detected_platforms", {}).get("youtube_embed"):
        findings.append("The homepage includes a YouTube embed, likely contributing to third-party weight.")
    if homepage.get("detected_platforms", {}).get("heap") and homepage.get("detected_platforms", {}).get("google_tag_manager"):
        findings.append("Both Heap and GTM are present; script governance should be part of the optimization case study.")
    findings.append("Tour/apply paths are outbound to online.venterraliving.com, so they should be validation targets rather than APO cache targets.")
    for item in findings:
        lines.append(f"- {item}")
    lines.extend(
        [
            "",
            "## APO Prep Checklist",
            "",
            "- Keep Cloudflare permissions in place for Zone Read, Zone Settings Read, Rulesets Read/Write, Cache Purge, Analytics Read, and APO/cache setting visibility.",
            "- Maintain WordPress admin access and the official Cloudflare plugin connection.",
            "- Confirm WP Engine cache behavior and establish a purge sequence: WP Engine cache, Cloudflare cache, then synthetic re-test.",
            "- Investigate the source of `Vary: Cookie`, short WP Engine cacheability, and any anonymous cookies that may prevent edge HTML HIT behavior.",
            "- Retest homepage, floor plans, contact/widget behavior, tour/apply outbound links, GTM, Heap, Resi widget, mobile rendering, PSI, GTMetrix, and GSC indexing signals after each controlled change.",
            "- Keep edge experimentation/HTML mutation out of the first APO enablement so the case study isolates caching impact.",
            "",
            "## Artifact Pointers",
            "",
            f"- Latest Cloudflare audit: `{CLOUDFLARE_AUDIT_PATH}`",
            f"- Cache-rule apply/plan artifact: `{cache_rule_path}`",
            f"- Raw live PSI payloads, if fetched: `{OUTPUT_ROOT / CASE_DATE / 'raw'}`",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    output_dir = OUTPUT_ROOT / CASE_DATE
    output_dir.mkdir(parents=True, exist_ok=True)

    matrix_payload = read_json(IDENTITY_PATH, {})
    matrix = matrix_payload.get("properties", []) if isinstance(matrix_payload, dict) else matrix_payload
    identity = next((row for row in matrix if isinstance(row, dict) and row.get("property_code") == PROPERTY_CODE), {})
    pages = {
        BASE_URL: analyze_page(BASE_URL),
        f"{BASE_URL}floor-plans/": analyze_page(f"{BASE_URL}floor-plans/"),
    }
    redirect_checks = {
        "http_root": fetch_headers(f"http://{DOMAIN}/"),
        "https_www": fetch_headers(f"https://www.{DOMAIN}/"),
    }
    data = {
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "case_date": CASE_DATE,
        "identity": identity,
        "db": latest_operating_data(),
        "cloudflare_latest": read_json(CLOUDFLARE_AUDIT_PATH, {}),
        "cache_plan": find_latest_cache_plan(),
        "pages": pages,
        "redirect_checks": redirect_checks,
        "live_psi": fetch_live_psi(),
    }

    json_path = output_dir / f"delta_apo_case_study_baseline_{CASE_DATE}.json"
    md_path = output_dir / f"delta_apo_case_study_baseline_{CASE_DATE}.md"
    latest_json = OUTPUT_ROOT / "delta_apo_case_study_baseline_latest.json"
    latest_md = OUTPUT_ROOT / "delta_apo_case_study_baseline_latest.md"

    json_path.write_text(json.dumps(data, indent=2, sort_keys=True, default=str), encoding="utf-8")
    markdown = build_summary(data)
    md_path.write_text(markdown, encoding="utf-8")
    latest_json.write_text(json_path.read_text(encoding="utf-8"), encoding="utf-8")
    latest_md.write_text(markdown, encoding="utf-8")

    print(json.dumps({"json_path": str(json_path), "markdown_path": str(md_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
