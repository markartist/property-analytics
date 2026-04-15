#!/usr/bin/env python3
"""
Generate a merged daily pilot evaluation report.

This consolidates:
- live HTTP reachability across known pilot pages
- GSC URL inspection coverage/indexing state
- GSC search visibility
- GA4 new users
- dedicated pilot PSI
- GTmetrix
- BrowserStack critical CTA smoke status
- data freshness across the underlying feeds
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
COHORT_CONFIG = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
EVS_REPORTS = ROOT / "evs" / "reports"
OUTPUT_DIR = ROOT / "pilot_roundup" / "reports" / "daily_evaluation"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
GSC_OUTPUT_DIR = ROOT / "outputs"

import sys

sys.path.insert(0, str(ROOT / "utils"))
from report_builder import KPITile, ReportBuilder, Section, create_data_table  # noqa: E402


HTTP_TIMEOUT = 20
USER_AGENT = "PropertyAnalyticsPilotEvaluator/1.0"
FRESHNESS_RULES = {
    "gsc_daily_metrics": 4,
    "gsc_url_inspection": 1,
    "site_audit_results": 7,
    "pagespeed_metrics": 3,
    "gtmetrix_metrics": 2,
    "pilot_control_psi_metrics": 2,
    "ga4_daily_metrics": 2,
    "pilot_homepage_audit_evidence": 2,
}


@dataclass
class Entry:
    key: str
    display_name: str
    property_id: str
    site_url: str


@dataclass
class HttpResult:
    url: str
    status_code: Optional[int]
    final_url: Optional[str]
    ok: bool
    error: Optional[str] = None


def load_pilot_entries() -> List[Entry]:
    config = json.loads(COHORT_CONFIG.read_text())
    entries: List[Entry] = []
    for row in config["cohorts"]:
        if row.get("role") != "pilot" or not row.get("active", True):
            continue
        entries.append(
            Entry(
                key=row["key"],
                display_name=row["display_name"],
                property_id=str(row["property_id"]),
                site_url=row["site_url"],
            )
        )
    return entries


def load_registry() -> Dict[str, dict]:
    registry = json.loads(REGISTRY_PATH.read_text())
    mapped: Dict[str, dict] = {}
    for prop in registry["properties"]:
        key = prop.get("ga4_property_id") or prop.get("property_id")
        if key:
            mapped[str(key)] = prop
    return mapped


def parse_browserstack_summary(path: Path) -> Dict[str, Dict[str, object]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    results: Dict[str, Dict[str, object]] = {}
    for item in data.get("results", []):
        payload = item.get("payload")
        if not payload and item.get("stdout"):
            try:
                payload = json.loads(item["stdout"])
            except Exception:
                payload = None
        if not payload:
            continue
        target = payload.get("target_url") or item.get("target_url")
        host = urlparse(target).netloc if target else ""
        findings = []
        for run in payload.get("device_runs", []):
            findings.extend(run.get("findings", []))
        functional_findings = [f for f in findings if f.get("kind") != "artifact_capture"]
        warn_count = sum(1 for f in functional_findings if f.get("status") == "warn")
        fail_count = sum(1 for f in functional_findings if f.get("status") == "fail")
        status = "Pass"
        if fail_count > 0:
            status = "Fail"
        elif warn_count > 0:
            status = "Warn"
        results[host] = {
            "status": status,
            "warn_count": warn_count,
            "fail_count": fail_count,
        }
    return results


def load_browserstack_status() -> Tuple[Dict[str, Dict[str, object]], Dict[str, Dict[str, object]]]:
    desktop = parse_browserstack_summary(
        EVS_REPORTS / "browserstack-pilot-critical_cta_smoke-production-desktop_chrome.json"
    )
    iphone = parse_browserstack_summary(
        EVS_REPORTS / "browserstack-pilot-critical_cta_smoke-production-iphone_safari.json"
    )
    return desktop, iphone


def status_badge(status: str) -> str:
    colors = {
        "Healthy": ("#EAF6F0", "#1E7F4F"),
        "Watch": ("#FFF2DF", "#A86400"),
        "Action Needed": ("#FBE9EB", "#A61E2A"),
        "Pass": ("#EAF6F0", "#1E7F4F"),
        "Warn": ("#FFF2DF", "#A86400"),
        "Fail": ("#FBE9EB", "#A61E2A"),
        "Fresh": ("#EAF6F0", "#1E7F4F"),
        "Lagged": ("#FFF2DF", "#A86400"),
        "Stale": ("#FBE9EB", "#A61E2A"),
        "Missing": ("#FBE9EB", "#A61E2A"),
    }
    bg, fg = colors.get(status, ("#EEF2F7", "#5B6575"))
    return (
        f'<span style="display:inline-block;padding:4px 10px;border-radius:999px;'
        f'font-size:12px;font-weight:700;background:{bg};color:{fg};">{status}</span>'
    )


def fmt_int(value: Optional[int]) -> str:
    if value is None:
        return "N/A"
    return f"{value:,}"


def fmt_float(value: Optional[float], digits: int = 1, suffix: str = "") -> str:
    if value is None:
        return "N/A"
    return f"{value:.{digits}f}{suffix}"


def get_table_latest_date(conn: sqlite3.Connection, table: str, date_field: str) -> Optional[str]:
    row = conn.execute(f"SELECT MAX({date_field}) FROM {table}").fetchone()
    return row[0] if row and row[0] else None


def classify_freshness(latest_date: Optional[str], max_age_days: int, today: date) -> Tuple[str, Optional[int]]:
    if not latest_date:
        return "Missing", None
    age = (today - datetime.strptime(latest_date, "%Y-%m-%d").date()).days
    if age <= max_age_days:
        return "Fresh", age
    if age <= max_age_days + 2:
        return "Lagged", age
    return "Stale", age


def run_http_check(url: str) -> HttpResult:
    try:
        response = requests.get(
            url,
            timeout=HTTP_TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        )
        return HttpResult(
            url=url,
            status_code=response.status_code,
            final_url=response.url,
            ok=response.status_code == 200,
        )
    except Exception as exc:  # pragma: no cover - network/runtime
        return HttpResult(
            url=url,
            status_code=None,
            final_url=None,
            ok=False,
            error=str(exc),
        )


def get_http_results(base_url: str, page_paths: List[str], skip_http: bool) -> List[HttpResult]:
    if skip_http:
        return []
    results: List[HttpResult] = []
    for path in page_paths:
        results.append(run_http_check(urljoin(base_url, path)))
    return results


def get_gsc_7d_metrics(conn: sqlite3.Connection, property_id: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT
            MAX(metric_date) AS latest_date,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            AVG(average_position) AS avg_position
        FROM (
            SELECT metric_date, clicks, impressions, average_position
            FROM gsc_daily_metrics
            WHERE property_id = ?
            ORDER BY metric_date DESC
            LIMIT 7
        )
        """,
        (property_id,),
    ).fetchone()
    if not row or row[0] is None:
        return {"latest_date": None, "clicks": None, "impressions": None, "ctr": None, "avg_position": None}
    clicks = int(row[1] or 0)
    impressions = int(row[2] or 0)
    ctr = (clicks / impressions * 100.0) if impressions else None
    return {
        "latest_date": row[0],
        "clicks": clicks,
        "impressions": impressions,
        "ctr": ctr,
        "avg_position": float(row[3]) if row[3] is not None else None,
    }


def get_latest_ga4_new_users(conn: sqlite3.Connection, property_id: str) -> Dict[str, Optional[int]]:
    row = conn.execute(
        """
        SELECT metric_date, new_users
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND new_users IS NOT NULL
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id,),
    ).fetchone()
    if not row:
        return {"latest_date": None, "new_users": None}
    return {"latest_date": row[0], "new_users": int(row[1]) if row[1] is not None else None}


def get_latest_psi(conn: sqlite3.Connection, cohort_key: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT metric_date, performance_score, accessibility_score, seo_score,
               lcp_value, cls_value, ttfb_value, total_blocking_time,
               diagnostics_total_byte_weight, diagnostics_num_requests
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (cohort_key,),
    ).fetchone()
    if not row:
        return {
            "latest_date": None,
            "performance_score": None,
            "accessibility_score": None,
            "seo_score": None,
            "lcp_value": None,
            "cls_value": None,
            "ttfb_value": None,
            "tbt_value": None,
            "page_weight": None,
            "requests": None,
        }
    return {
        "latest_date": row[0],
        "performance_score": float(row[1]) if row[1] is not None else None,
        "accessibility_score": float(row[2]) if row[2] is not None else None,
        "seo_score": float(row[3]) if row[3] is not None else None,
        "lcp_value": float(row[4]) if row[4] is not None else None,
        "cls_value": float(row[5]) if row[5] is not None else None,
        "ttfb_value": float(row[6]) if row[6] is not None else None,
        "tbt_value": float(row[7]) if row[7] is not None else None,
        "page_weight": int(row[8]) if row[8] is not None else None,
        "requests": int(row[9]) if row[9] is not None else None,
    }


def get_latest_gtmetrix(conn: sqlite3.Connection, property_id: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT metric_date, pagespeed_score, structure_score, fully_loaded_time_ms, page_requests, page_bytes
        FROM gtmetrix_metrics
        WHERE property_id = ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id,),
    ).fetchone()
    if not row:
        return {
            "latest_date": None,
            "pagespeed_score": None,
            "structure_score": None,
            "fully_loaded_time_ms": None,
            "page_requests": None,
            "page_bytes": None,
        }
    return {
        "latest_date": row[0],
        "pagespeed_score": float(row[1]) if row[1] is not None else None,
        "structure_score": float(row[2]) if row[2] is not None else None,
        "fully_loaded_time_ms": float(row[3]) if row[3] is not None else None,
        "page_requests": int(row[4]) if row[4] is not None else None,
        "page_bytes": int(row[5]) if row[5] is not None else None,
    }


def get_latest_site_audit(conn: sqlite3.Connection, property_name: str) -> Dict[str, object]:
    latest_date_row = conn.execute(
        """
        SELECT MAX(audit_date)
        FROM site_audit_results
        WHERE property_name = ?
        """,
        (property_name,),
    ).fetchone()
    latest_date = latest_date_row[0] if latest_date_row and latest_date_row[0] else None
    if not latest_date:
        return {"latest_date": None, "critical_count": 0, "warning_count": 0, "issue_count": 0}

    count_row = conn.execute(
        """
        SELECT
            SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,
            SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) AS warning_count,
            COUNT(*) AS issue_count
        FROM site_audit_results
        WHERE property_name = ?
          AND audit_date = ?
        """,
        (property_name, latest_date),
    ).fetchone()
    return {
        "latest_date": latest_date,
        "critical_count": int(count_row[0] or 0),
        "warning_count": int(count_row[1] or 0),
        "issue_count": int(count_row[2] or 0),
    }


def get_latest_homepage_audit_evidence(conn: sqlite3.Connection, property_id: str) -> Dict[str, object]:
    row = conn.execute(
        """
        SELECT metric_date, page_url, device_profile, lcp_start_time_ms, lcp_size, lcp_url,
               lcp_tag_name, lcp_class_name, lcp_text, lcp_background_image, screenshot_path,
               total_request_count, failed_request_count, total_transfer_size, console_errors_json,
               browserstack_desktop_classification, browserstack_desktop_screenshot_path,
               browserstack_iphone_classification, browserstack_iphone_screenshot_path
        FROM pilot_homepage_audit_evidence
        WHERE property_id = ?
        ORDER BY metric_date DESC, collected_at DESC
        LIMIT 1
        """,
        (property_id,),
    ).fetchone()
    if not row:
        return {
            "latest_date": None,
            "page_url": None,
            "device_profile": None,
            "lcp_start_time_ms": None,
            "lcp_size": None,
            "lcp_url": None,
            "lcp_tag_name": None,
            "lcp_class_name": None,
            "lcp_text": None,
            "lcp_background_image": None,
            "screenshot_path": None,
            "total_request_count": None,
            "failed_request_count": None,
            "total_transfer_size": None,
            "console_errors_json": "[]",
            "browserstack_desktop_classification": None,
            "browserstack_desktop_screenshot_path": None,
            "browserstack_iphone_classification": None,
            "browserstack_iphone_screenshot_path": None,
        }
    return {
        "latest_date": row[0],
        "page_url": row[1],
        "device_profile": row[2],
        "lcp_start_time_ms": float(row[3]) if row[3] is not None else None,
        "lcp_size": float(row[4]) if row[4] is not None else None,
        "lcp_url": row[5],
        "lcp_tag_name": row[6],
        "lcp_class_name": row[7],
        "lcp_text": row[8],
        "lcp_background_image": row[9],
        "screenshot_path": row[10],
        "total_request_count": int(row[11]) if row[11] is not None else None,
        "failed_request_count": int(row[12]) if row[12] is not None else None,
        "total_transfer_size": int(row[13]) if row[13] is not None else None,
        "console_errors_json": row[14] or "[]",
        "browserstack_desktop_classification": row[15],
        "browserstack_desktop_screenshot_path": row[16],
        "browserstack_iphone_classification": row[17],
        "browserstack_iphone_screenshot_path": row[18],
    }


def get_latest_gsc_inspection(conn: sqlite3.Connection, property_id: str, url: str) -> Dict[str, object]:
    row = conn.execute(
        """
        SELECT inspection_date, verdict, coverage_state, indexing_state, robots_txt_state,
               page_fetch_state, google_canonical, user_canonical, last_crawl_time
        FROM gsc_url_inspection
        WHERE property_id = ?
          AND inspected_url = ?
        ORDER BY inspection_date DESC, collected_at DESC
        LIMIT 1
        """,
        (property_id, url),
    ).fetchone()
    if not row:
        return {
            "inspection_date": None,
            "verdict": None,
            "coverage_state": None,
            "indexing_state": None,
            "robots_txt_state": None,
            "page_fetch_state": None,
            "google_canonical": None,
            "user_canonical": None,
            "last_crawl_time": None,
        }
    return {
        "inspection_date": row[0],
        "verdict": row[1],
        "coverage_state": row[2],
        "indexing_state": row[3],
        "robots_txt_state": row[4],
        "page_fetch_state": row[5],
        "google_canonical": row[6],
        "user_canonical": row[7],
        "last_crawl_time": row[8],
    }


def load_gsc_inspection_artifact(report_date: str) -> Dict[Tuple[str, str], Dict[str, object]]:
    path = GSC_OUTPUT_DIR / f"pilot_live_gsc_url_inspection_{report_date}.json"
    if not path.exists():
        return {}
    rows = json.loads(path.read_text())
    mapped: Dict[Tuple[str, str], Dict[str, object]] = {}
    for row in rows:
        mapped[(row["property"], row["url"])] = {
            "inspection_date": report_date,
            "verdict": row.get("verdict"),
            "coverage_state": row.get("coverage_state"),
            "indexing_state": row.get("indexing_state"),
            "robots_txt_state": row.get("robots_txt_state"),
            "page_fetch_state": row.get("page_fetch_state"),
            "google_canonical": row.get("google_canonical"),
            "user_canonical": row.get("user_canonical"),
            "last_crawl_time": row.get("last_crawl_time"),
        }
    return mapped


def evaluate_property_status(
    http_results: List[HttpResult],
    inspection_results: List[Dict[str, object]],
    psi: Dict[str, Optional[float]],
    desktop_status: str,
    iphone_status: str,
    site_audit: Dict[str, object],
    today: date,
) -> Tuple[str, List[str]]:
    findings: List[str] = []

    if any(not result.ok for result in http_results):
        findings.append("One or more known URLs failed the live HTTP check.")

    non_pass = [
        row for row in inspection_results
        if row.get("coverage_state") in {"URL is unknown to Google", "Crawled - currently not indexed"}
    ]
    if non_pass:
        findings.append(f"{len(non_pass)} known URLs are not fully indexed in Google yet.")

    if psi.get("performance_score") is not None and psi["performance_score"] < 75:
        findings.append(f"PSI mobile performance is low at {psi['performance_score']:.0f}.")
    if psi.get("lcp_value") is not None and psi["lcp_value"] > 2.5:
        findings.append(f"LCP is elevated at {psi['lcp_value']:.2f}s.")

    if desktop_status == "Fail" or iphone_status == "Fail":
        findings.append("BrowserStack critical CTA smoke reported a failure.")
    elif desktop_status == "Warn" or iphone_status == "Warn":
        findings.append("BrowserStack critical CTA smoke reported a warning.")

    audit_date = site_audit.get("latest_date")
    if audit_date:
        age = (today - datetime.strptime(audit_date, "%Y-%m-%d").date()).days
        if age > FRESHNESS_RULES["site_audit_results"]:
            findings.append(f"Site audit findings are stale ({age} days old).")
        elif site_audit.get("critical_count", 0) > 0:
            findings.append(f"Latest site audit still has {site_audit['critical_count']} critical findings.")
        elif site_audit.get("warning_count", 0) > 0:
            findings.append(f"Latest site audit still has {site_audit['warning_count']} warning findings.")
    else:
        findings.append("No site audit history is available for this property.")

    if any("failed the live HTTP check" in f or "not fully indexed" in f or "reported a failure" in f for f in findings):
        return "Action Needed", findings
    if findings:
        return "Watch", findings
    return "Healthy", findings


def build_property_record(
    conn: sqlite3.Connection,
    entry: Entry,
    registry_entry: dict,
    desktop_status_map: Dict[str, Dict[str, object]],
    iphone_status_map: Dict[str, Dict[str, object]],
    inspection_artifact_map: Dict[Tuple[str, str], Dict[str, object]],
    skip_http: bool,
    today: date,
) -> Dict[str, object]:
    page_paths = registry_entry.get("known_page_paths") or ["/"]
    http_results = get_http_results(entry.site_url, page_paths, skip_http=skip_http)

    inspection_results = []
    for path in page_paths:
        url = urljoin(entry.site_url, path)
        inspection_results.append(
            inspection_artifact_map.get((entry.display_name, url)) or get_latest_gsc_inspection(conn, entry.property_id, url)
        )

    gsc_metrics = get_gsc_7d_metrics(conn, entry.property_id)
    ga4_metrics = get_latest_ga4_new_users(conn, entry.property_id)
    psi_metrics = get_latest_psi(conn, entry.key)
    gtmetrix_metrics = get_latest_gtmetrix(conn, entry.property_id)
    site_audit = get_latest_site_audit(conn, entry.display_name)
    homepage_audit = get_latest_homepage_audit_evidence(conn, entry.property_id)

    host = urlparse(entry.site_url).netloc
    desktop_status = desktop_status_map.get(host, {}).get("status", "Unknown")
    iphone_status = iphone_status_map.get(host, {}).get("status", "Unknown")

    overall_status, findings = evaluate_property_status(
        http_results=http_results,
        inspection_results=inspection_results,
        psi=psi_metrics,
        desktop_status=desktop_status,
        iphone_status=iphone_status,
        site_audit=site_audit,
        today=today,
    )

    indexed_count = sum(1 for row in inspection_results if row.get("coverage_state") == "Submitted and indexed")
    unknown_count = sum(1 for row in inspection_results if row.get("coverage_state") == "URL is unknown to Google")
    crawled_not_indexed_count = sum(
        1 for row in inspection_results if row.get("coverage_state") == "Crawled - currently not indexed"
    )
    http_ok_count = sum(1 for row in http_results if row.ok)

    opportunities: List[str] = []
    for path, inspection in zip(page_paths, inspection_results):
        coverage = inspection.get("coverage_state")
        if coverage in {"URL is unknown to Google", "Crawled - currently not indexed"}:
            opportunities.append(f"{path}: {coverage}")
    if psi_metrics.get("performance_score") is not None and psi_metrics["performance_score"] < 75:
        opportunities.append(f"Improve mobile PSI performance score ({psi_metrics['performance_score']:.0f}).")
    if psi_metrics.get("lcp_value") is not None and psi_metrics["lcp_value"] > 2.5:
        opportunities.append(f"Improve LCP on mobile ({psi_metrics['lcp_value']:.2f}s).")
    if homepage_audit.get("lcp_tag_name") == "DIV" and homepage_audit.get("lcp_url"):
        opportunities.append("Homepage hero background is the browser-reported LCP candidate.")
    if homepage_audit.get("failed_request_count"):
        opportunities.append(f"Homepage browser evidence captured {homepage_audit['failed_request_count']} failed request(s).")
    if gsc_metrics.get("impressions") and gsc_metrics.get("ctr") is not None and gsc_metrics["impressions"] >= 500 and gsc_metrics["ctr"] < 1.5:
        opportunities.append(f"Search CTR is low against current visibility ({gsc_metrics['ctr']:.2f}%).")
    if desktop_status in {"Warn", "Fail"} or iphone_status in {"Warn", "Fail"}:
        opportunities.append(f"BrowserStack critical CTA coverage is Desktop {desktop_status} / iPhone {iphone_status}.")

    return {
        "property_name": entry.display_name,
        "property_id": entry.property_id,
        "cohort_key": entry.key,
        "site_url": entry.site_url,
        "page_paths": page_paths,
        "overall_status": overall_status,
        "http": {
            "checked_count": len(http_results),
            "ok_count": http_ok_count,
            "results": [result.__dict__ for result in http_results],
        },
        "gsc_search": gsc_metrics,
        "gsc_inspection": {
            "indexed_count": indexed_count,
            "unknown_count": unknown_count,
            "crawled_not_indexed_count": crawled_not_indexed_count,
            "results": inspection_results,
        },
        "ga4": ga4_metrics,
        "psi": psi_metrics,
        "gtmetrix": gtmetrix_metrics,
        "browserstack": {
            "desktop_status": desktop_status,
            "iphone_status": iphone_status,
        },
        "site_audit": site_audit,
        "homepage_audit": homepage_audit,
        "findings": findings,
        "opportunities": opportunities,
    }


def build_freshness(conn: sqlite3.Connection, today: date) -> List[Dict[str, object]]:
    feeds = [
        ("gsc_daily_metrics", "metric_date", "GSC Search"),
        ("gsc_url_inspection", "inspection_date", "GSC URL Inspection"),
        ("ga4_daily_metrics", "metric_date", "GA4"),
        ("pilot_control_psi_metrics", "metric_date", "Pilot PSI"),
        ("pilot_homepage_audit_evidence", "metric_date", "Homepage Audit Evidence"),
        ("gtmetrix_metrics", "metric_date", "GTmetrix"),
        ("site_audit_results", "audit_date", "Site Audit"),
    ]
    rows = []
    for table, date_field, label in feeds:
        latest_date = get_table_latest_date(conn, table, date_field)
        status, age_days = classify_freshness(latest_date, FRESHNESS_RULES[table], today)
        rows.append(
            {
                "feed": label,
                "table": table,
                "latest_date": latest_date,
                "age_days": age_days,
                "status": status,
            }
        )
    return rows


def build_html(report_date: str, properties: List[Dict[str, object]], freshness: List[Dict[str, object]]) -> str:
    total_urls = sum(prop["http"]["checked_count"] for prop in properties)
    healthy_urls = sum(prop["http"]["ok_count"] for prop in properties)
    indexed_urls = sum(prop["gsc_inspection"]["indexed_count"] for prop in properties)
    psi_scores = [prop["psi"]["performance_score"] for prop in properties if prop["psi"]["performance_score"] is not None]
    avg_psi = sum(psi_scores) / len(psi_scores) if psi_scores else None
    action_count = sum(1 for prop in properties if prop["overall_status"] == "Action Needed")
    watch_count = sum(1 for prop in properties if prop["overall_status"] == "Watch")

    builder = ReportBuilder(
        title="Pilot Daily Evaluation",
        subtitle="Live Site, Search, Performance, and QA",
        version="1.0.0",
        date_range=report_date,
    )
    builder.add_kpi_tiles(
        [
            KPITile(label="Pilots", value=str(len(properties)), comparison=f"{action_count} action / {watch_count} watch"),
            KPITile(label="Live URLs Healthy", value=f"{healthy_urls}/{total_urls}"),
            KPITile(label="Indexed URLs", value=f"{indexed_urls}/{total_urls}"),
            KPITile(label="Avg PSI Mobile", value=fmt_float(avg_psi, 0) if avg_psi is not None else "N/A"),
        ],
        columns=4,
    )

    freshness_rows = [
        [
            row["feed"],
            row["latest_date"] or "N/A",
            "N/A" if row["age_days"] is None else str(row["age_days"]),
            status_badge(row["status"]),
        ]
        for row in freshness
    ]
    freshness_status = "healthy"
    if any(row["status"] == "Stale" for row in freshness):
        freshness_status = "action_needed"
    elif any(row["status"] in {"Lagged", "Missing"} for row in freshness):
        freshness_status = "watch"
    builder.add_section(
        Section(
            title="Data Freshness",
            status=freshness_status,
            description="Daily evaluator confidence depends on the recency of each underlying feed.",
            content=create_data_table(["Feed", "Latest Date", "Age (Days)", "Status"], freshness_rows),
        )
    )

    property_rows = []
    for prop in properties:
        property_rows.append(
            [
                prop["property_name"],
                status_badge(prop["overall_status"]),
                f"{prop['http']['ok_count']}/{prop['http']['checked_count']}",
                f"{prop['gsc_inspection']['indexed_count']}/{len(prop['page_paths'])}",
                fmt_int(prop["gsc_search"]["clicks"]),
                fmt_int(prop["gsc_search"]["impressions"]),
                fmt_float(prop["gsc_search"]["ctr"], 2, "%"),
                fmt_float(prop["psi"]["performance_score"], 0),
                fmt_float(prop["psi"]["lcp_value"], 2, "s"),
                prop["homepage_audit"]["lcp_tag_name"] or "N/A",
                f"{prop['browserstack']['desktop_status']} / {prop['browserstack']['iphone_status']}",
            ]
        )
    builder.add_section(
        Section(
            title="Pilot Snapshot",
            status="healthy" if action_count == 0 and watch_count == 0 else "watch" if action_count == 0 else "action_needed",
            description="Merged operational view across URL health, indexing, search visibility, performance, and real-device QA.",
            content=create_data_table(
                [
                    "Property",
                    "Overall",
                    "HTTP",
                    "Indexed",
                    "GSC Clicks",
                    "GSC Impr.",
                    "CTR",
                    "PSI",
                    "LCP",
                    "LCP Node",
                    "BrowserStack",
                ],
                property_rows,
            ),
        )
    )

    detail_blocks: List[str] = []
    for prop in properties:
        detail_blocks.append(
            f"""
            <div style="margin: 0 0 24px 0; padding: 18px 20px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: 700; color: #15284B; margin-bottom: 8px;">{prop['property_name']}</div>
                <div style="margin-bottom: 10px;">{status_badge(prop['overall_status'])}</div>
                <div style="font-size: 13px; color: #5B6575; margin-bottom: 12px;">
                    Site: <a href="{prop['site_url']}">{prop['site_url']}</a>
                </div>
                <div style="font-size: 13px; color: #5B6575; margin-bottom: 12px;">
                    Browser LCP evidence: {prop['homepage_audit']['lcp_tag_name'] or 'N/A'}
                    {f" via <a href=\"{prop['homepage_audit']['lcp_url']}\">hero asset</a>" if prop['homepage_audit']['lcp_url'] else ""}
                </div>
                <div style="font-size: 13px; color: #5B6575; margin-bottom: 12px;">
                    Browser evidence: {prop['homepage_audit']['total_request_count'] if prop['homepage_audit']['total_request_count'] is not None else 'N/A'} requests,
                    {prop['homepage_audit']['failed_request_count'] if prop['homepage_audit']['failed_request_count'] is not None else 'N/A'} failed,
                    {fmt_int(prop['homepage_audit']['total_transfer_size'])} bytes transferred.
                </div>
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Key Findings</div>
                <ul style="margin: 0 0 12px 18px; padding: 0;">
                    {''.join(f"<li>{item}</li>" for item in (prop['findings'] or ['No immediate issues surfaced.']))}
                </ul>
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Improvement Opportunities</div>
                <ul style="margin: 0 0 12px 18px; padding: 0;">
                    {''.join(f"<li>{item}</li>" for item in (prop['opportunities'] or ['No additional opportunities flagged today.']))}
                </ul>
            </div>
            """
        )
    builder.add_section(
        Section(
            title="Property Findings",
            status="healthy" if action_count == 0 else "action_needed",
            description="Action-oriented notes from the daily evaluator.",
            content="".join(detail_blocks),
        )
    )

    return builder.generate()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate merged daily pilot evaluation report.")
    parser.add_argument("--date", help="Override report date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--skip-http", action="store_true", help="Skip live HTTP checks and use stored metrics only.")
    args = parser.parse_args()

    report_date = args.date or date.today().isoformat()
    today = datetime.strptime(report_date, "%Y-%m-%d").date()

    entries = load_pilot_entries()
    registry = load_registry()
    desktop_status_map, iphone_status_map = load_browserstack_status()
    inspection_artifact_map = load_gsc_inspection_artifact(report_date)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    freshness = build_freshness(conn, today)

    properties: List[Dict[str, object]] = []
    for entry in entries:
        registry_entry = registry.get(entry.property_id)
        if not registry_entry:
            raise SystemExit(f"Missing registry entry for pilot property_id={entry.property_id}")
        properties.append(
            build_property_record(
                conn=conn,
                entry=entry,
                registry_entry=registry_entry,
                desktop_status_map=desktop_status_map,
                iphone_status_map=iphone_status_map,
                inspection_artifact_map=inspection_artifact_map,
                skip_http=args.skip_http,
                today=today,
            )
        )
    conn.close()

    payload = {
        "report_date": report_date,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "freshness": freshness,
        "properties": properties,
    }

    dated_json = OUTPUT_DIR / f"pilot_daily_evaluation_{report_date}.json"
    latest_json = OUTPUT_DIR / "pilot_daily_evaluation_latest.json"
    dated_html = OUTPUT_DIR / f"pilot_daily_evaluation_{report_date}.html"
    latest_html = OUTPUT_DIR / "pilot_daily_evaluation_latest.html"

    dated_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    latest_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    html = build_html(report_date, properties, freshness)
    dated_html.write_text(html, encoding="utf-8")
    latest_html.write_text(html, encoding="utf-8")

    print(f"Wrote {dated_json}")
    print(f"Wrote {dated_html}")


if __name__ == "__main__":
    main()
