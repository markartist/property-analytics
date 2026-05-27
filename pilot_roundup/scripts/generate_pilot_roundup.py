#!/usr/bin/env python3
"""
Generate a PIB-style pilot performance roundup without modifying canonical PIB.
Trend-first version with pilot and sister/control grouping.
"""

from __future__ import annotations

import json
import io
import base64
import argparse
import sqlite3
import requests
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
COHORT_CONFIG = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
EVS_REPORTS = ROOT / "evs" / "reports"
OUTPUT_DIR = ROOT / "pilot_roundup" / "reports"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

import sys
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "utils"))
from utils.ksm import KsmResolutionError, resolve_secret_from_multiple_notations
from report_builder import ReportBuilder, KPITile, Section
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

VENTERRA_BLUE = "#15284B"
LIGHT_BLUE = "#D9E2F3"
SUCCESS_GREEN = "#1E7F4F"
WARNING_AMBER = "#A86400"
RISK_RED = "#A61E2A"
SLATE = "#5B6575"
MUTED_BG = "#F5F7FB"
CARD_BG = "#F8FAFD"
RULE = "#D8DFEA"


@dataclass
class Entry:
    key: str
    display_name: str
    role: str
    property_id: str
    site_url: str


MAIN_PILOT_REFERENCE_LABEL = "Main Pilot Reference"


def load_cohort_config() -> dict:
    return json.loads(COHORT_CONFIG.read_text())


def display_date(value: Optional[str]) -> str:
    if not value:
        return "—"
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%m/%d/%Y")
    except ValueError:
        return value


def display_timestamp(value: datetime) -> str:
    return value.strftime("%m/%d/%Y %I:%M %p")


def load_entries(role: Optional[str] = None) -> List[Entry]:
    config = load_cohort_config()
    entries = [
        Entry(
            key=row["key"],
            display_name=row["display_name"],
            role=row["role"],
            property_id=str(row["property_id"]),
            site_url=row["site_url"],
        )
        for row in config["cohorts"]
        if row.get("active", True)
    ]
    if role is not None:
        entries = [entry for entry in entries if entry.role == role]
    return entries


def load_twin_groups() -> Dict[str, List[Dict[str, str]]]:
    config = load_cohort_config()
    return config.get("twin_groups", {})


def load_main_pilot_reference() -> Dict[str, str]:
    config = load_cohort_config()
    return config.get(
        "main_pilot_reference",
        {
            "label": MAIN_PILOT_REFERENCE_LABEL,
            "property_id": "main_pilot_reference",
            "requested_url": "https://pilot.venterrradev.com/",
            "site_url": "https://pilot.venterradev.com/",
        },
    )


def make_entry(raw: Dict[str, str], role: str) -> Entry:
    return Entry(
        key=raw["key"],
        display_name=raw["display_name"],
        role=role,
        property_id=str(raw["property_id"]),
        site_url=raw["site_url"],
    )


def latest_complete_date(conn: sqlite3.Connection, table: str, id_field: str, ids: List[str]) -> Optional[str]:
    placeholders = ",".join("?" for _ in ids)
    row = conn.execute(
        f"""
        SELECT metric_date
        FROM {table}
        WHERE {id_field} IN ({placeholders})
        GROUP BY metric_date
        HAVING COUNT(DISTINCT {id_field}) >= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        [*ids, len(ids)],
    ).fetchone()
    return row[0] if row else None


def count_rows_for_date(conn: sqlite3.Connection, table: str, id_field: str, ids: List[str], metric_date: str) -> int:
    placeholders = ",".join("?" for _ in ids)
    row = conn.execute(
        f"""
        SELECT COUNT(DISTINCT {id_field})
        FROM {table}
        WHERE metric_date = ?
          AND {id_field} IN ({placeholders})
        """,
        [metric_date, *ids],
    ).fetchone()
    return int(row[0] or 0) if row else 0


def latest_psi_date(conn: sqlite3.Connection, pilot_keys: List[str]) -> Optional[str]:
    placeholders = ",".join("?" for _ in pilot_keys)
    row = conn.execute(
        f"""
        SELECT metric_date
        FROM pilot_control_psi_metrics
        WHERE strategy='mobile'
          AND cohort_key IN ({placeholders})
        GROUP BY metric_date
        HAVING COUNT(DISTINCT cohort_key) >= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        [*pilot_keys, len(pilot_keys)],
    ).fetchone()
    return row[0] if row else None


def get_psi_score(conn: sqlite3.Connection, cohort_key: str, metric_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT performance_score
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        """,
        (cohort_key, metric_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def get_psi_metrics(conn: sqlite3.Connection, cohort_key: str, metric_date: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT performance_score, accessibility_score, best_practices_score, seo_score,
               lcp_value, cls_value, fcp_value, ttfb_value, total_blocking_time, interaction_to_next_paint,
               selected_run_number, render_blocking_wasted_ms,
               unused_javascript_wasted_bytes, unused_javascript_top_url,
               unused_css_wasted_bytes, unused_css_top_url,
               bootup_time_ms, mainthread_work_ms,
               diagnostics_total_byte_weight, diagnostics_num_requests
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        """,
        (cohort_key, metric_date),
    ).fetchone()
    if not row:
        return {}
    return {
        "performance_score": float(row[0]) if row[0] is not None else None,
        "accessibility_score": float(row[1]) if row[1] is not None else None,
        "best_practices_score": float(row[2]) if row[2] is not None else None,
        "seo_score": float(row[3]) if row[3] is not None else None,
        "lcp_value": float(row[4]) if row[4] is not None else None,
        "cls_value": float(row[5]) if row[5] is not None else None,
        "fcp_value": float(row[6]) if row[6] is not None else None,
        "ttfb_value": float(row[7]) if row[7] is not None else None,
        "tbt_value": float(row[8]) if row[8] is not None else None,
        "inp_value": float(row[9]) if row[9] is not None else None,
        "selected_run_number": int(row[10]) if row[10] is not None else None,
        "render_blocking_wasted_ms": float(row[11]) if row[11] is not None else None,
        "unused_javascript_wasted_bytes": int(row[12]) if row[12] is not None else None,
        "unused_javascript_top_url": row[13],
        "unused_css_wasted_bytes": int(row[14]) if row[14] is not None else None,
        "unused_css_top_url": row[15],
        "bootup_time_ms": float(row[16]) if row[16] is not None else None,
        "mainthread_work_ms": float(row[17]) if row[17] is not None else None,
        "diagnostics_total_byte_weight": int(row[18]) if row[18] is not None else None,
        "diagnostics_num_requests": int(row[19]) if row[19] is not None else None,
    }


def get_legacy_psi_metrics(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT performance_score, accessibility_score, best_practices_score, seo_score,
               lcp_value, cls_value, fcp_value, ttfb_value, total_blocking_time
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        """,
        (property_id, metric_date),
    ).fetchone()
    if not row:
        return {}
    return {
        "performance_score": float(row[0]) if row[0] is not None else None,
        "accessibility_score": float(row[1]) if row[1] is not None else None,
        "best_practices_score": float(row[2]) if row[2] is not None else None,
        "seo_score": float(row[3]) if row[3] is not None else None,
        "lcp_value": float(row[4]) if row[4] is not None else None,
        "cls_value": float(row[5]) if row[5] is not None else None,
        "fcp_value": float(row[6]) if row[6] is not None else None,
        "ttfb_value": float(row[7]) if row[7] is not None else None,
        "tbt_value": float(row[8]) if row[8] is not None else None,
        "inp_value": None,
    }


def get_legacy_psi_score(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT performance_score
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        """,
        (property_id, metric_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def get_gt_score(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT pagespeed_score
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date = ?
        """,
        (property_id, metric_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def get_new_users(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Optional[int]:
    row = conn.execute(
        """
        SELECT new_users
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND metric_date = ?
        """,
        (property_id, metric_date),
    ).fetchone()
    return int(row[0]) if row and row[0] is not None else None


def get_yoy_new_users(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Optional[int]:
    target = (datetime.strptime(metric_date, "%Y-%m-%d").date() - timedelta(days=365)).isoformat()
    return get_new_users(conn, property_id, target)


def get_recent_legacy_psi_history(conn: sqlite3.Connection, property_id: str, end_date: str, limit: int = 6) -> List[float]:
    rows = conn.execute(
        """
        SELECT performance_score
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date <= ?
          AND performance_score IS NOT NULL
        ORDER BY metric_date DESC
        LIMIT ?
        """,
        (property_id, end_date, limit),
    ).fetchall()
    return [float(r[0]) for r in reversed(rows)]


def get_recent_new_user_history(conn: sqlite3.Connection, property_id: str, end_date: str, limit: int = 6) -> List[int]:
    rows = conn.execute(
        """
        SELECT new_users
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND metric_date <= ?
          AND new_users IS NOT NULL
        ORDER BY metric_date DESC
        LIMIT ?
        """,
        (property_id, end_date, limit),
    ).fetchall()
    return [int(r[0]) for r in reversed(rows)]


def get_recent_gt_history(conn: sqlite3.Connection, property_id: str, end_date: str, limit: int = 6) -> List[float]:
    rows = conn.execute(
        """
        SELECT pagespeed_score
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date <= ?
          AND pagespeed_score IS NOT NULL
        ORDER BY metric_date DESC
        LIMIT ?
        """,
        (property_id, end_date, limit),
    ).fetchall()
    return [float(r[0]) for r in reversed(rows)]


def get_latest_legacy_psi_date(conn: sqlite3.Connection, property_id: str, end_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date <= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, end_date),
    ).fetchone()
    return row[0] if row else None


def get_previous_legacy_psi_date(conn: sqlite3.Connection, property_id: str, before_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date < ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, before_date),
    ).fetchone()
    return row[0] if row else None


def get_latest_gt_date_for_property(conn: sqlite3.Connection, property_id: str, end_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date <= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, end_date),
    ).fetchone()
    return row[0] if row else None


def get_latest_ga_date_for_property(conn: sqlite3.Connection, property_id: str, end_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND metric_date <= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, end_date),
    ).fetchone()
    return row[0] if row else None


def get_previous_gt_score(conn: sqlite3.Connection, property_id: str, before_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT pagespeed_score
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date < ?
          AND pagespeed_score IS NOT NULL
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, before_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def parse_browserstack_summary(path: Path) -> Dict[str, Dict[str, object]]:
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
        pass_count = sum(1 for f in findings if f.get("status") == "pass")
        warn_count = sum(1 for f in functional_findings if f.get("status") == "warn")
        fail_count = sum(1 for f in functional_findings if f.get("status") == "fail")
        status = "Pass"
        if fail_count > 0:
            status = "Fail"
        elif warn_count > 0:
            status = "Warn"
        results[host] = {
            "status": status,
            "pass_count": pass_count,
            "warn_count": warn_count,
            "fail_count": fail_count,
        }
    return results


def load_browserstack_status() -> Tuple[Dict[str, Dict[str, object]], Dict[str, Dict[str, object]]]:
    desktop = parse_browserstack_summary(EVS_REPORTS / "browserstack-pilot-critical_cta_smoke-production-desktop_chrome.json")
    iphone = parse_browserstack_summary(EVS_REPORTS / "browserstack-pilot-critical_cta_smoke-production-iphone_safari.json")
    return desktop, iphone


def status_chip(text: str, color: str) -> str:
    return (
        f'<span style="display:inline-block;padding:4px 10px;border-radius:999px;'
        f'font-size:12px;font-weight:700;background:{color};color:#fff;">{text}</span>'
    )


def qa_chip(text: str) -> str:
    color = SUCCESS_GREEN if text == "Pass" else WARNING_AMBER if text == "Warn" else RISK_RED if text == "Fail" else SLATE
    bg = "#EAF6F0" if text == "Pass" else "#FFF2DF" if text == "Warn" else "#FBE9EB" if text == "Fail" else "#EEF2F7"
    return (
        f'<span style="display:inline-block;padding:4px 10px;border-radius:999px;'
        f'font-size:12px;font-weight:700;background:{bg};color:{color};">{text}</span>'
    )


def delta_color(delta: Optional[float], good_when_positive: bool = True) -> str:
    if delta is None:
        return SLATE
    if delta == 0:
        return SLATE
    improved = delta > 0 if good_when_positive else delta < 0
    return SUCCESS_GREEN if improved else RISK_RED


def classify_overall(psi_today: Optional[float], psi_delta: Optional[float], desktop: str, iphone: str) -> Tuple[str, str]:
    if desktop == "Fail" or iphone == "Fail":
        return "Red", RISK_RED
    if psi_today is not None and psi_today < 60:
        return "Red", RISK_RED
    if psi_delta is not None and psi_delta < -5:
        return "Red", RISK_RED
    if psi_today is not None and psi_today < 75:
        return "Yellow", WARNING_AMBER
    if desktop == "Warn" or iphone == "Warn":
        return "Yellow", WARNING_AMBER
    return "Green", SUCCESS_GREEN


def fmt_num(value: Optional[float], digits: int = 1) -> str:
    if value is None:
        return "—"
    return f"{value:.{digits}f}"


def fmt_int(value: Optional[int]) -> str:
    return "—" if value is None else f"{value:,}"


def fmt_delta(value: Optional[float], digits: int = 1) -> str:
    if value is None:
        return "—"
    return f"{value:+.{digits}f}"


def fmt_kib(value: Optional[int]) -> str:
    if value is None:
        return "—"
    return f"{value / 1024:.0f} KiB"


def summary_card(label: str, value: str, subtext: str, accent: str) -> str:
    return f"""
    <td style="width:25%;vertical-align:top;padding-right:12px;">
      <div style="background:{CARD_BG};border:1px solid {RULE};border-top:4px solid {accent};padding:16px 16px 14px 16px;min-height:102px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:{SLATE};margin-bottom:8px;">{label}</div>
        <div style="font-size:28px;line-height:1.0;font-weight:800;color:#132238;margin-bottom:8px;">{value}</div>
        <div style="font-size:13px;line-height:1.5;color:{SLATE};">{subtext}</div>
      </div>
    </td>
    """


def compact_url_label(url: Optional[str]) -> str:
    if not url:
        return "unknown source"
    parsed = urlparse(url)
    host = parsed.netloc or url
    path = parsed.path or ""
    if path and path != "/":
        name = path.rstrip("/").split("/")[-1]
        return f"{host}/{name}"[:48]
    return host[:48]


def build_diagnostic_reasons(metrics: Dict[str, Optional[float]]) -> List[str]:
    reasons: List[str] = []
    lcp = metrics.get("lcp_value")
    if lcp is not None and lcp > 4.0:
        reasons.append(f"LCP is the main drag at {lcp:.1f}s.")
    unused_js = metrics.get("unused_javascript_wasted_bytes")
    if unused_js is not None and unused_js >= 150 * 1024:
        reasons.append(
            f"Unused JS is high at {fmt_kib(unused_js)} led by {compact_url_label(metrics.get('unused_javascript_top_url'))}."
        )
    mainthread = metrics.get("mainthread_work_ms")
    if mainthread is not None and mainthread >= 1500:
        reasons.append(f"Main-thread work is heavy at {mainthread / 1000:.1f}s.")
    bootup = metrics.get("bootup_time_ms")
    if bootup is not None and bootup >= 900:
        reasons.append(f"JavaScript bootup time is elevated at {bootup / 1000:.1f}s.")
    unused_css = metrics.get("unused_css_wasted_bytes")
    if unused_css is not None and unused_css >= 25 * 1024:
        reasons.append(
            f"Unused CSS is high at {fmt_kib(unused_css)} led by {compact_url_label(metrics.get('unused_css_top_url'))}."
        )
    reqs = metrics.get("diagnostics_num_requests")
    weight = metrics.get("diagnostics_total_byte_weight")
    if reqs is not None and reqs >= 50 and weight is not None and weight >= 2_500_000:
        reasons.append(f"Page weight is about {weight / (1024 * 1024):.1f} MB across {reqs} requests.")
    render_block = metrics.get("render_blocking_wasted_ms")
    if render_block is not None and render_block >= 250:
        reasons.append(f"Render-blocking resources are adding about {render_block:.0f} ms.")
    return reasons[:3]


def diagnostic_summary_html(properties: List[Dict[str, object]]) -> str:
    lines: List[str] = []
    ranked_lcp = sorted(
        [p for p in properties if p["psi_metrics_today"].get("lcp_value") is not None],
        key=lambda p: p["psi_metrics_today"]["lcp_value"],
        reverse=True,
    )
    if ranked_lcp:
        worst = ranked_lcp[0]
        lines.append(
            f"<li>Largest mobile LCP issue: <strong>{worst['property_name']}</strong> at <strong>{worst['psi_metrics_today']['lcp_value']:.1f}s</strong>.</li>"
        )

    heaviest_js = sorted(
        [p for p in properties if p["psi_metrics_today"].get("unused_javascript_wasted_bytes") is not None],
        key=lambda p: p["psi_metrics_today"]["unused_javascript_wasted_bytes"],
        reverse=True,
    )
    if heaviest_js:
        worst = heaviest_js[0]
        lines.append(
            f"<li>Biggest unused JavaScript burden: <strong>{worst['property_name']}</strong> with about <strong>{fmt_kib(worst['psi_metrics_today']['unused_javascript_wasted_bytes'])}</strong> wasted.</li>"
        )

    heaviest_thread = sorted(
        [p for p in properties if p["psi_metrics_today"].get("mainthread_work_ms") is not None],
        key=lambda p: p["psi_metrics_today"]["mainthread_work_ms"],
        reverse=True,
    )
    if heaviest_thread:
        worst = heaviest_thread[0]
        lines.append(
            f"<li>Heaviest main-thread workload: <strong>{worst['property_name']}</strong> at <strong>{worst['psi_metrics_today']['mainthread_work_ms'] / 1000:.1f}s</strong>.</li>"
        )

    if not lines:
        lines.append("<li>Detailed Lighthouse diagnostics are not yet available for the latest PSI rows.</li>")

    return (
        '<ul style="margin:0; padding-left:18px; line-height:1.8; font-size:14px; color:#495057;">'
        + "".join(lines)
        + "</ul>"
    )


def score_color(score: Optional[float]) -> str:
    if score is None:
        return SLATE
    if score >= 90:
        return SUCCESS_GREEN
    if score >= 50:
        return WARNING_AMBER
    return RISK_RED


def threshold_color(value: Optional[float], good: float, watch: float, lower_is_better: bool = True) -> str:
    if value is None:
        return SLATE
    if lower_is_better:
        if value <= good:
            return SUCCESS_GREEN
        if value <= watch:
            return WARNING_AMBER
        return RISK_RED
    if value >= good:
        return SUCCESS_GREEN
    if value >= watch:
        return WARNING_AMBER
    return RISK_RED


def trend_html(delta: Optional[float], invert: bool = False, digits: int = 1, suffix: str = "") -> str:
    if delta is None or delta == 0:
        return f'<span style="font-size:13px;color:{SLATE};">Flat vs yesterday</span>'
    improved = delta < 0 if invert else delta > 0
    color = SUCCESS_GREEN if improved else RISK_RED
    arrow = "↓" if delta < 0 else "↑"
    return f'<span style="font-size:13px;color:{color};font-weight:700;">{arrow}{abs(delta):.{digits}f}{suffix} vs yesterday</span>'


def format_portfolio_trend(delta: Optional[float], invert: bool = False, digits: int = 1, suffix: str = "") -> str:
    if delta is None or delta == 0:
        return ""
    improved = delta < 0 if invert else delta > 0
    color = "#28a745" if improved else "#dc3545"
    arrow = "↓" if delta < 0 else "↑"
    return f'<span style="font-size: 14px; color: {color}; margin-left: 8px;">{arrow}{abs(delta):.{digits}f}{suffix}</span>'


def sparkline_png(values: List[float], color: str, width_px: int = 128, height_px: int = 28) -> str:
    if not values or len(values) < 2:
        return ""
    fig, ax = plt.subplots(figsize=(width_px / 100, height_px / 100), dpi=100)
    fig.patch.set_alpha(0)
    ax.set_axis_off()
    ax.plot(
        values,
        color=color,
        linewidth=2.0,
        marker="o",
        markersize=3.2,
        markerfacecolor=color,
        markeredgecolor=color,
        markeredgewidth=0,
    )
    ax.set_xlim(0, len(values) - 1)
    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        padding = max(max_val * 0.05, 1)
    else:
        padding = (max_val - min_val) * 0.15
    ax.set_ylim(min_val - padding, max_val + padding)
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", transparent=True, bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")
    return (
        f'<img src="data:image/png;base64,{img_base64}" width="{width_px}" height="{height_px}" '
        f'style="display:block; margin-left:auto;" alt="Trend"/>'
    )


def metric_trend_block(values: List[float], delta: Optional[float], color: str) -> str:
    sparkline = sparkline_png(values, color=color)
    if delta is None:
        detail = "Awaiting previous day"
        detail_color = SLATE
    elif delta == 0:
        detail = "→ 0.0 vs yesterday"
        detail_color = color
    else:
        arrow = "↑" if delta > 0 else "↓"
        detail = f"{arrow} {abs(delta):.1f} vs yesterday"
        detail_color = color

    return f"""
    <table cellpadding="0" cellspacing="0" border="0" align="right" style="width:152px;">
        <tr>
            <td align="right" style="padding:0 0 4px 0;">
                {sparkline}
            </td>
        </tr>
        <tr>
            <td align="right" style="font-size:11px; line-height:12px; color:{detail_color}; font-weight:700; padding:0;">
                {detail}
            </td>
        </tr>
    </table>
    """


def render_kpi_row(tiles: List[KPITile], columns: int = 4) -> str:
    gap_pct = 2
    col_width = (100 - (gap_pct * (columns - 1))) // columns
    html = '<table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 30px 0 18px 0;">\n<tr>'
    for i, tile in enumerate(tiles):
        tile_html = tile.to_html().replace(
            "border: 1px solid #e9ecef;",
            "border: 1px solid #3D66B9;",
        ).replace(
            "background: white;",
            "background: #ffffff;",
        )
        html += f'<td style="width: {col_width}%; vertical-align: top;">{tile_html}</td>'
        if i < len(tiles) - 1:
            html += f'<td style="width: {gap_pct}%;"></td>'
    html += '</tr>\n</table>'
    return html


def format_kpi_trend(delta: Optional[float], digits: int = 1) -> Optional[str]:
    if delta is None:
        return None
    if delta == 0:
        return f"→0.{''.join(['0' for _ in range(max(digits-1, 0))])}" if digits > 0 else "→0"
    arrow = "↑" if delta > 0 else "↓"
    return f"{arrow}{abs(delta):.{digits}f}"


def average_or_none(values: List[Optional[float]]) -> Optional[float]:
    present = [float(value) for value in values if value is not None]
    if not present:
        return None
    return sum(present) / len(present)


def build_property_payload(
    conn: sqlite3.Connection,
    entry: Entry,
    *,
    psi_date: Optional[str],
    psi_yesterday_date: Optional[str],
    gt_date: Optional[str],
    ga_date: Optional[str],
    ga_yesterday_date: Optional[str],
    desktop_status: Dict[str, Dict[str, object]],
    iphone_status: Dict[str, Dict[str, object]],
) -> Dict[str, object]:
    host = urlparse(entry.site_url).netloc

    psi_today = get_psi_score(conn, entry.key, psi_date) if psi_date else None
    psi_yesterday = get_legacy_psi_score(conn, entry.property_id, psi_yesterday_date) if psi_yesterday_date else None
    psi_delta = (psi_today - psi_yesterday) if psi_today is not None and psi_yesterday is not None else None
    psi_metrics_today = get_psi_metrics(conn, entry.key, psi_date) if psi_date else {}
    psi_metrics_yesterday = get_legacy_psi_metrics(conn, entry.property_id, psi_yesterday_date) if psi_yesterday_date else {}

    gt_today = get_gt_score(conn, entry.property_id, gt_date) if gt_date else None
    gt_yesterday = get_previous_gt_score(conn, entry.property_id, gt_date) if gt_date else None
    gt_delta = (gt_today - gt_yesterday) if gt_today is not None and gt_yesterday is not None else None

    new_users_today = get_new_users(conn, entry.property_id, ga_date) if ga_date else None
    new_users_yesterday = get_new_users(conn, entry.property_id, ga_yesterday_date) if ga_yesterday_date else None
    new_users_delta = (
        new_users_today - new_users_yesterday
        if new_users_today is not None and new_users_yesterday is not None
        else None
    )
    yoy_users = get_yoy_new_users(conn, entry.property_id, ga_date) if ga_date else None
    new_users_yoy = (
        new_users_today - yoy_users
        if new_users_today is not None and yoy_users is not None
        else None
    )
    psi_history = get_recent_legacy_psi_history(conn, entry.property_id, psi_yesterday_date or psi_date, limit=6) if (psi_yesterday_date or psi_date) else []
    if psi_today is not None:
        psi_history = (psi_history + [psi_today])[-6:]
    users_history = get_recent_new_user_history(conn, entry.property_id, ga_date, limit=6) if ga_date else []
    gt_history = get_recent_gt_history(conn, entry.property_id, gt_date, limit=6) if gt_date else []

    desktop = desktop_status.get(host, {}).get("status", "—")
    iphone = iphone_status.get(host, {}).get("status", "—")
    overall_label, overall_color = classify_overall(psi_today, psi_delta, desktop, iphone)

    return {
        "property_name": entry.display_name,
        "role": entry.role,
        "psi_today": psi_today,
        "psi_yesterday": psi_yesterday,
        "psi_delta": psi_delta,
        "psi_metrics_today": psi_metrics_today,
        "psi_metrics_yesterday": psi_metrics_yesterday,
        "gt_today": gt_today,
        "gt_yesterday": gt_yesterday,
        "gt_delta": gt_delta,
        "gt_history": gt_history,
        "new_users_today": new_users_today,
        "new_users_yesterday": new_users_yesterday,
        "new_users_delta": new_users_delta,
        "new_users_yoy": new_users_yoy,
        "psi_history": psi_history,
        "users_history": users_history,
        "desktop_status": desktop,
        "iphone_status": iphone,
        "overall_label": overall_label,
        "overall_color": overall_color,
    }


def build_legacy_property_payload(
    conn: sqlite3.Connection,
    entry: Entry,
    *,
    report_date: str,
    desktop_status: Dict[str, Dict[str, object]],
    iphone_status: Dict[str, Dict[str, object]],
) -> Dict[str, object]:
    host = urlparse(entry.site_url).netloc

    psi_current_date = get_latest_legacy_psi_date(conn, entry.property_id, report_date)
    psi_previous_date = get_previous_legacy_psi_date(conn, entry.property_id, psi_current_date) if psi_current_date else None
    psi_today = get_legacy_psi_score(conn, entry.property_id, psi_current_date) if psi_current_date else None
    psi_yesterday = get_legacy_psi_score(conn, entry.property_id, psi_previous_date) if psi_previous_date else None
    psi_delta = (psi_today - psi_yesterday) if psi_today is not None and psi_yesterday is not None else None
    psi_metrics_today = get_legacy_psi_metrics(conn, entry.property_id, psi_current_date) if psi_current_date else {}
    psi_metrics_yesterday = get_legacy_psi_metrics(conn, entry.property_id, psi_previous_date) if psi_previous_date else {}

    gt_current_date = get_latest_gt_date_for_property(conn, entry.property_id, report_date)
    gt_previous = get_previous_gt_score(conn, entry.property_id, gt_current_date) if gt_current_date else None
    gt_today = get_gt_score(conn, entry.property_id, gt_current_date) if gt_current_date else None
    gt_delta = (gt_today - gt_previous) if gt_today is not None and gt_previous is not None else None

    ga_current_date = get_latest_ga_date_for_property(conn, entry.property_id, report_date)
    ga_previous_date = (datetime.strptime(ga_current_date, "%Y-%m-%d").date() - timedelta(days=1)).isoformat() if ga_current_date else None
    new_users_today = get_new_users(conn, entry.property_id, ga_current_date) if ga_current_date else None
    new_users_yesterday = get_new_users(conn, entry.property_id, ga_previous_date) if ga_previous_date else None
    new_users_delta = (
        new_users_today - new_users_yesterday
        if new_users_today is not None and new_users_yesterday is not None
        else None
    )
    yoy_users = get_yoy_new_users(conn, entry.property_id, ga_current_date) if ga_current_date else None
    new_users_yoy = (
        new_users_today - yoy_users
        if new_users_today is not None and yoy_users is not None
        else None
    )

    psi_history = get_recent_legacy_psi_history(conn, entry.property_id, psi_current_date or report_date, limit=6) if (psi_current_date or report_date) else []
    gt_history = get_recent_gt_history(conn, entry.property_id, gt_current_date or report_date, limit=6) if (gt_current_date or report_date) else []
    users_history = get_recent_new_user_history(conn, entry.property_id, ga_current_date or report_date, limit=6) if (ga_current_date or report_date) else []

    desktop = desktop_status.get(host, {}).get("status", "—")
    iphone = iphone_status.get(host, {}).get("status", "—")
    overall_label, overall_color = classify_overall(psi_today, psi_delta, desktop, iphone)

    return {
        "property_name": entry.display_name,
        "role": entry.role,
        "psi_today": psi_today,
        "psi_yesterday": psi_yesterday,
        "psi_delta": psi_delta,
        "psi_metrics_today": psi_metrics_today,
        "psi_metrics_yesterday": psi_metrics_yesterday,
        "gt_today": gt_today,
        "gt_yesterday": gt_previous,
        "gt_delta": gt_delta,
        "gt_history": gt_history,
        "new_users_today": new_users_today,
        "new_users_yesterday": new_users_yesterday,
        "new_users_delta": new_users_delta,
        "new_users_yoy": new_users_yoy,
        "psi_history": psi_history,
        "users_history": users_history,
        "desktop_status": desktop,
        "iphone_status": iphone,
        "overall_label": overall_label,
        "overall_color": overall_color,
        "data_source_note": "portfolio_property",
    }


def load_pagespeed_api_key() -> Optional[str]:
    path = ROOT / "Spotlight_Properties_Report" / "config" / "pagespeed_api_key.txt"
    try:
        return resolve_secret_from_multiple_notations(
            description="PageSpeed API key",
            notation_env_vars=[
                "KSM_PAGESPEED_API_KEY_NOTATION",
                "KSM_PAGESPEED_API_KEY_FILE_NOTATION",
            ],
            direct_env_var="PAGESPEED_API_KEY",
            file_path=path,
            default_profile="marketingops",
        )
    except KsmResolutionError:
        return None


def fetch_live_reference_psi(url: str) -> Dict[str, Optional[float]]:
    api_key = load_pagespeed_api_key()
    if not api_key:
        return {}
    response = requests.get(
        "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
        params={
            "url": url,
            "key": api_key,
            "strategy": "mobile",
            "category": ["performance", "accessibility", "best-practices", "seo"],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    lighthouse = payload.get("lighthouseResult", {})
    categories = lighthouse.get("categories", {})
    audits = lighthouse.get("audits", {})
    return {
        "performance_score": float(int((categories.get("performance", {}).get("score") or 0) * 100)),
        "accessibility_score": float(int((categories.get("accessibility", {}).get("score") or 0) * 100)),
        "best_practices_score": float(int((categories.get("best-practices", {}).get("score") or 0) * 100)),
        "seo_score": float(int((categories.get("seo", {}).get("score") or 0) * 100)),
        "lcp_value": round((audits.get("largest-contentful-paint", {}).get("numericValue") or 0) / 1000, 2),
        "cls_value": round((audits.get("cumulative-layout-shift", {}).get("numericValue") or 0), 3),
        "fcp_value": round((audits.get("first-contentful-paint", {}).get("numericValue") or 0) / 1000, 2),
        "ttfb_value": round((audits.get("server-response-time", {}).get("numericValue") or 0), 2),
        "tbt_value": round((audits.get("total-blocking-time", {}).get("numericValue") or 0), 0),
        "inp_value": None,
        "resolved_url": lighthouse.get("finalDisplayedUrl") or url,
    }


def reference_property_card(reference: Dict[str, object]) -> str:
    metrics = reference.get("psi_metrics_today", {}) or {}
    note = reference.get("note") or ""
    url = reference.get("resolved_url") or reference.get("site_url")
    perf = metrics.get("performance_score")
    gt_today = reference.get("gt_today")
    gt_yesterday = reference.get("gt_yesterday")
    gt_delta = (gt_today - gt_yesterday) if gt_today is not None and gt_yesterday is not None else None
    gt_delta_html = (
        ""
        if gt_delta is None
        else f' <span style="color:{delta_color(gt_delta)};">{fmt_delta(gt_delta, digits=1)}</span>'
    )
    return f"""
    <div style="margin-bottom:18px;">
        <div style="font-size:12px; font-weight:800; color:{VENTERRA_BLUE}; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8px 0;">
            Main Pilot Reference Site
        </div>
        <div style="font-size:13px; color:{SLATE}; margin:0 0 10px 0;">
            This site is shown separately and is <strong>not included</strong> in pilot, sister, or twin averages.
        </div>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#ffffff; border-left:4px solid {VENTERRA_BLUE}; border-radius:4px;">
            <tr>
                <td style="padding:14px 16px;">
                    <div style="font-size:16px; font-weight:700; color:#333; margin-bottom:6px;">{reference['property_name']}</div>
                    <div style="font-size:12px; color:{SLATE}; margin-bottom:10px;">{url}</div>
                    <table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-size:12px;">
                        <tr>
                            <td style="padding:2px 10px 2px 0;"><strong>PSI:</strong> <span style="color:{score_color(perf)};">{fmt_num(perf, 0) if perf is not None else '—'}</span></td>
                            <td style="padding:2px 10px 2px 0;"><strong>LCP:</strong> <span style="color:{threshold_color(metrics.get('lcp_value'), 2.5, 4.0)};">{fmt_num(metrics.get('lcp_value')) if metrics.get('lcp_value') is not None else '—'}{'' if metrics.get('lcp_value') is None else 's'}</span></td>
                            <td style="padding:2px 10px 2px 0;"><strong>FCP:</strong> <span style="color:{threshold_color(metrics.get('fcp_value'), 1.8, 3.0)};">{fmt_num(metrics.get('fcp_value')) if metrics.get('fcp_value') is not None else '—'}{'' if metrics.get('fcp_value') is None else 's'}</span></td>
                            <td style="padding:2px 0;"><strong>TBT:</strong> <span style="color:{threshold_color(metrics.get('tbt_value'), 200, 600)};">{fmt_num(metrics.get('tbt_value'), 0) if metrics.get('tbt_value') is not None else '—'}{'' if metrics.get('tbt_value') is None else 'ms'}</span></td>
                        </tr>
                        <tr>
                            <td style="padding:2px 10px 2px 0;"><strong>A11y:</strong> {fmt_num(metrics.get('accessibility_score'), 0) if metrics.get('accessibility_score') is not None else '—'}</td>
                            <td style="padding:2px 10px 2px 0;"><strong>BP:</strong> {fmt_num(metrics.get('best_practices_score'), 0) if metrics.get('best_practices_score') is not None else '—'}</td>
                            <td style="padding:2px 10px 2px 0;"><strong>SEO:</strong> {fmt_num(metrics.get('seo_score'), 0) if metrics.get('seo_score') is not None else '—'}</td>
                            <td style="padding:2px 0;"><strong>GTMetrix:</strong> <span style="color:{score_color(gt_today)};">{fmt_num(gt_today) if gt_today is not None else '—'}</span>{gt_delta_html}</td>
                        </tr>
                    </table>
                    <div style="margin-top:10px; font-size:11px; line-height:1.5; color:{SLATE};">{note}</div>
                </td>
            </tr>
        </table>
    </div>
    """


def twin_summary_table(twins: List[Dict[str, object]]) -> str:
    if not twins:
        return ""
    rows = []
    for twin in twins:
        rows.append(
            f"""
            <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-size:12px;color:#333;"><strong>{twin['property_name']}</strong></td>
                <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-size:12px;color:{score_color(twin.get('psi_today'))};">{fmt_num(twin.get('psi_today'), 0)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-size:12px;color:{threshold_color(twin['psi_metrics_today'].get('lcp_value'), 2.5, 4.0)};">{fmt_num(twin['psi_metrics_today'].get('lcp_value')) if twin['psi_metrics_today'].get('lcp_value') is not None else '—'}{'' if twin['psi_metrics_today'].get('lcp_value') is None else 's'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-size:12px;color:{score_color(twin.get('gt_today'))};">{fmt_num(twin.get('gt_today'))}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-size:12px;color:#333;">{fmt_int(twin.get('new_users_today'))}</td>
            </tr>
            """
        )
    return f"""
    <div style="margin-top:8px; padding:10px 12px; background:{CARD_BG}; border:1px solid {RULE}; border-radius:4px;">
        <div style="font-size:12px; font-weight:800; color:{VENTERRA_BLUE}; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8px 0;">
            Twin Properties
        </div>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
            <tr>
                <th style="text-align:left; padding:6px 8px; font-size:11px; color:{SLATE}; border-bottom:1px solid {RULE};">Property</th>
                <th style="text-align:left; padding:6px 8px; font-size:11px; color:{SLATE}; border-bottom:1px solid {RULE};">PSI</th>
                <th style="text-align:left; padding:6px 8px; font-size:11px; color:{SLATE}; border-bottom:1px solid {RULE};">LCP</th>
                <th style="text-align:left; padding:6px 8px; font-size:11px; color:{SLATE}; border-bottom:1px solid {RULE};">GT</th>
                <th style="text-align:left; padding:6px 8px; font-size:11px; color:{SLATE}; border-bottom:1px solid {RULE};">Users</th>
            </tr>
            {''.join(rows)}
        </table>
    </div>
    """


def performance_card(p: Dict[str, object]) -> str:
    today_metrics = p["psi_metrics_today"]
    prev_metrics = p["psi_metrics_yesterday"]

    def score_col(score: Optional[float]) -> str:
        return score_color(score)

    def lcp_col(val: Optional[float]) -> str:
        return threshold_color(val, 2.5, 4.0)

    def cls_col(val: Optional[float]) -> str:
        return threshold_color(val, 0.1, 0.25)

    def fcp_col(val: Optional[float]) -> str:
        return threshold_color(val, 1.8, 3.0)

    def tbt_col(val: Optional[float]) -> str:
        return threshold_color(val, 200, 600)

    perf_delta = p["psi_delta"]
    lcp_delta = None
    cls_delta = None
    fcp_delta = None
    tbt_delta = None
    if today_metrics and prev_metrics:
        if today_metrics.get("lcp_value") is not None and prev_metrics.get("lcp_value") is not None:
            lcp_delta = today_metrics["lcp_value"] - prev_metrics["lcp_value"]
        if today_metrics.get("cls_value") is not None and prev_metrics.get("cls_value") is not None:
            cls_delta = today_metrics["cls_value"] - prev_metrics["cls_value"]
        if today_metrics.get("fcp_value") is not None and prev_metrics.get("fcp_value") is not None:
            fcp_delta = today_metrics["fcp_value"] - prev_metrics["fcp_value"]
        if today_metrics.get("tbt_value") is not None and prev_metrics.get("tbt_value") is not None:
            tbt_delta = today_metrics["tbt_value"] - prev_metrics["tbt_value"]

    psi_today_value = p.get("psi_today")
    if psi_today_value is None:
        psi_line_color = SLATE
    elif psi_today_value >= 90:
        psi_line_color = SUCCESS_GREEN
    elif psi_today_value >= 50:
        psi_line_color = WARNING_AMBER
    else:
        psi_line_color = RISK_RED
    border_color = psi_line_color if psi_today_value is not None else SLATE
    psi_headline_trend = format_portfolio_trend(perf_delta, invert=False)
    lcp_trend = format_portfolio_trend(lcp_delta, invert=True, digits=1, suffix="s")
    psi_trend_values = [float(v) for v in p.get("psi_history", []) if v is not None]
    if len(psi_trend_values) < 2:
        psi_trend_values = []
        if p.get("psi_yesterday") is not None:
            psi_trend_values.append(float(p["psi_yesterday"]))
        if p.get("psi_today") is not None:
            psi_trend_values.append(float(p["psi_today"]))
    psi_trend_panel = metric_trend_block(psi_trend_values, perf_delta, psi_line_color)
    users_delta_inline = format_portfolio_trend(p.get("new_users_delta"), invert=False, digits=0)
    diagnostic_reasons = build_diagnostic_reasons(today_metrics)
    diagnostic_html = ""
    if diagnostic_reasons:
        diagnostic_html = (
            '<div style="margin-top:8px; padding-top:8px; border-top:1px solid #e9ecef; '
            'font-size:11px; line-height:1.5; color:#5b6575;">'
            + " ".join(diagnostic_reasons)
            + "</div>"
        )

    return f"""
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:12px; background:#ffffff; border-left:4px solid {border_color}; border-radius:4px;">
        <tr>
            <td style="padding:12px;">
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                    <tr>
                        <td style="vertical-align:top;">
                            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:8px;">
                                <tr>
                                    <td style="vertical-align:top;">
                                        <div style="font-weight:600; color:#333; font-size:14px; margin-bottom:6px;">
                                            {p['property_name']}
                                            {psi_headline_trend}
                                        </div>
                                        <div style="font-size:12px; color:#6c757d;">
                                            GTMetrix {fmt_num(p.get('gt_today'))} {format_portfolio_trend(p.get('gt_delta'), invert=False)} &nbsp;•&nbsp; New Users {fmt_int(p.get('new_users_today'))}{users_delta_inline}
                                        </div>
                                    </td>
                                    <td style="width:130px; vertical-align:top; text-align:right;">
                                        {psi_trend_panel}
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-size:11px;">
                                <tr>
                                    <td style="padding:2px 8px 2px 0;"><strong>Perf:</strong> <span style="color:{score_col(today_metrics.get('performance_score'))};">{fmt_num(today_metrics.get('performance_score'), 0) if today_metrics.get('performance_score') is not None else 'N/A'}</span></td>
                                    <td style="padding:2px 8px 2px 0;"><strong>A11y:</strong> <span style="color:{score_col(today_metrics.get('accessibility_score'))};">{fmt_num(today_metrics.get('accessibility_score'), 0) if today_metrics.get('accessibility_score') is not None else 'N/A'}</span></td>
                                    <td style="padding:2px 8px 2px 0;"><strong>BP:</strong> <span style="color:{score_col(today_metrics.get('best_practices_score'))};">{fmt_num(today_metrics.get('best_practices_score'), 0) if today_metrics.get('best_practices_score') is not None else 'N/A'}</span></td>
                                    <td style="padding:2px 0;"><strong>SEO:</strong> <span style="color:{score_col(today_metrics.get('seo_score'))};">{fmt_num(today_metrics.get('seo_score'), 0) if today_metrics.get('seo_score') is not None else 'N/A'}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 8px 2px 0;"><strong>LCP:</strong> <span style="color:{lcp_col(today_metrics.get('lcp_value'))};">{fmt_num(today_metrics.get('lcp_value')) if today_metrics.get('lcp_value') is not None else 'N/A'}{'' if today_metrics.get('lcp_value') is None else 's'}</span>{lcp_trend}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>CLS:</strong> <span style="color:{cls_col(today_metrics.get('cls_value'))};">{fmt_num(today_metrics.get('cls_value'), 3) if today_metrics.get('cls_value') is not None else 'N/A'}</span>{format_portfolio_trend(cls_delta, invert=True, digits=3)}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>FCP:</strong> <span style="color:{fcp_col(today_metrics.get('fcp_value'))};">{fmt_num(today_metrics.get('fcp_value')) if today_metrics.get('fcp_value') is not None else 'N/A'}{'' if today_metrics.get('fcp_value') is None else 's'}</span>{format_portfolio_trend(fcp_delta, invert=True, digits=1, suffix='s')}</td>
                                    <td style="padding:2px 0;"><strong>TBT:</strong> <span style="color:{tbt_col(today_metrics.get('tbt_value'))};">{fmt_num(today_metrics.get('tbt_value'), 0) if today_metrics.get('tbt_value') is not None else 'N/A'}{'' if today_metrics.get('tbt_value') is None else 'ms'}</span>{format_portfolio_trend(tbt_delta, invert=True, digits=0, suffix='ms')}</td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 8px 2px 0;"><strong>GTMetrix:</strong> <span style="color:{score_col(p.get('gt_today'))};">{fmt_num(p.get('gt_today'))}</span>{format_portfolio_trend(p.get('gt_delta'), invert=False)}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>Users:</strong> <span style="color:#333;">{fmt_int(p.get('new_users_today'))}</span>{format_portfolio_trend(p.get('new_users_delta'), invert=False, digits=0)}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>Desktop:</strong> {p.get('desktop_status')}</td>
                                    <td style="padding:2px 0;"><strong>iPhone:</strong> {p.get('iphone_status')}</td>
                                </tr>
                            </table>
                            {diagnostic_html}
                        </td>
                        <td style="width:64px; vertical-align:top; text-align:right; padding-left:15px;">
                            <div style="font-size:32px; font-weight:700; color:{psi_line_color};">
                                {fmt_num(psi_today_value, 0) if psi_today_value is not None else '—'}
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """


def performance_pair_card(pilot: Dict[str, object], sister: Dict[str, object]) -> str:
    return f"""
    <div style="margin-bottom:18px;">
        <div style="font-size:12px; font-weight:800; color:{VENTERRA_BLUE}; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8px 0;">
            Pilot + Sister Pair
        </div>
        <div style="font-size:13px; color:{SLATE}; margin:0 0 8px 0;">
            <strong>Pilot:</strong> {pilot['property_name']} &nbsp;•&nbsp; <strong>Sister:</strong> {sister['property_name']}
        </div>
        {performance_card(pilot)}
        {performance_card(sister)}
    </div>
    """


def apply_custom_header(html: str, title: str, subtitle: str, version: str, report_display_date: str) -> str:
    old = f"""                <!-- Header -->
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 20px;">
                    <tr>
                        <td>

                            <div style="font-size: 32px; color: #495057; margin: 10px 0; font-weight: 700;">{title}</div>
        <div style="font-size: 16px; color: #0066cc; margin: 10px 0 15px 0; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase;">{subtitle}</div>
                            <div style="font-size: 11px; color: #adb5bd; margin: 10px 0;">v{version}</div>
                        </td>
                    </tr>
                </table>
        """

    new = f"""                <!-- Header -->
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; text-align: center; margin-bottom: 34px; border-bottom: 2px solid #e9ecef; padding-bottom: 26px;">
                    <tr>
                        <td>
                            <div style="font-size: 54px; line-height: 1.08; color: #495057; margin: 12px 0 18px 0; font-weight: 800;">{title}</div>
                            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin: 0 0 16px 0;">
                                <tr>
                                    <td style="width:33%; vertical-align:middle;"><div style="height:2px; background:#e9ecef;"></div></td>
                                    <td style="width:34%; text-align:center; padding:0 16px;">
                                        <div style="font-size: 16px; color: #3D66B9; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap;">{subtitle}</div>
                                    </td>
                                    <td style="width:33%; vertical-align:middle;"><div style="height:2px; background:#e9ecef;"></div></td>
                                </tr>
                            </table>
                            <div style="font-size: 14px; color: #6c757d; font-weight: 600; margin: 0 0 12px 0;">{report_display_date}</div>
                            <div style="font-size: 12px; color: #adb5bd; margin: 8px 0 8px 0;">v{version}</div>
                            <div style="font-size: 15px; color: #9aa3af; margin: 0;">
                                Powered by <span style="color:#495057; font-weight:700;">MarketingOps</span>
                            </div>
                        </td>
                    </tr>
                </table>
        """
    return html.replace(old, new, 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate pilot roundup")
    parser.add_argument("--date", help="Report date YYYY-MM-DD; defaults to today")
    args = parser.parse_args()

    report_date = args.date or date.today().isoformat()
    config = load_cohort_config()
    all_entries = load_entries()
    entries = [entry for entry in all_entries if entry.role == "pilot"]
    control_entries = {entry.key: entry for entry in all_entries if entry.role == "control"}
    sister_by_pilot = {
        row["key"]: row.get("sister_key")
        for row in config["cohorts"]
        if row.get("active", True) and row["role"] == "pilot"
    }
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    report_display_date = display_date(report_date)

    psi_date = latest_psi_date(conn, [entry.key for entry in all_entries])
    gt_ids = [entry.property_id for entry in all_entries]
    gt_date = report_date if count_rows_for_date(conn, "gtmetrix_metrics", "property_id", gt_ids, report_date) >= len(gt_ids) else None
    ga_date = latest_complete_date(conn, "ga4_daily_metrics", "property_id", [entry.property_id for entry in all_entries])
    desktop_status, iphone_status = load_browserstack_status()

    psi_yesterday_date = (datetime.strptime(psi_date, "%Y-%m-%d").date() - timedelta(days=1)).isoformat() if psi_date else None
    ga_yesterday_date = (datetime.strptime(ga_date, "%Y-%m-%d").date() - timedelta(days=1)).isoformat() if ga_date else None

    properties: List[Dict[str, object]] = []
    sisters: List[Dict[str, object]] = []
    twins: List[Dict[str, object]] = []
    paired_properties: List[Tuple[Dict[str, object], Dict[str, object], List[Dict[str, object]]]] = []
    twin_groups = load_twin_groups()
    for pilot in entries:
        pilot_payload = build_property_payload(
            conn,
            pilot,
            psi_date=psi_date,
            psi_yesterday_date=psi_yesterday_date,
            gt_date=gt_date,
            ga_date=ga_date,
            ga_yesterday_date=ga_yesterday_date,
            desktop_status=desktop_status,
            iphone_status=iphone_status,
        )
        properties.append(pilot_payload)

        sister_key = sister_by_pilot.get(pilot.key)
        sister_entry = control_entries.get(sister_key) if sister_key else None
        if sister_entry:
            sister_payload = build_property_payload(
                conn,
                sister_entry,
                psi_date=psi_date,
                psi_yesterday_date=psi_yesterday_date,
                gt_date=gt_date,
                ga_date=ga_date,
                ga_yesterday_date=ga_yesterday_date,
                desktop_status=desktop_status,
                iphone_status=iphone_status,
            )
            sisters.append(sister_payload)
            twin_payloads: List[Dict[str, object]] = []
            for raw_twin in twin_groups.get(pilot.key, []):
                twin_entry = make_entry(raw_twin, role="twin")
                twin_payload = build_legacy_property_payload(
                    conn,
                    twin_entry,
                    report_date=report_date,
                    desktop_status=desktop_status,
                    iphone_status=iphone_status,
                )
                twin_payloads.append(twin_payload)
                twins.append(twin_payload)
            paired_properties.append((pilot_payload, sister_payload, twin_payloads))
    reference_note = ""
    reference_metrics = {}
    main_reference = load_main_pilot_reference()
    reference_property_id = str(main_reference.get("property_id") or "").strip()
    reference_url = main_reference.get("site_url", "https://pilot.venterradev.com/")
    requested_reference_url = main_reference.get("requested_url", reference_url)
    try:
        reference_metrics = fetch_live_reference_psi(reference_url)
        if requested_reference_url != reference_url:
            reference_note = (
                f"Requested host {requested_reference_url} did not resolve locally; "
                f"using {reference_url} for the live PSI reference read."
            )
    except Exception as exc:
        reference_note = f"Live PSI reference fetch failed for {reference_url}: {exc}"
    reference_gt_date = get_latest_gt_date_for_property(conn, reference_property_id, report_date) if reference_property_id else None
    reference_gt_today = get_gt_score(conn, reference_property_id, reference_gt_date) if reference_gt_date else None
    reference_gt_yesterday = get_previous_gt_score(conn, reference_property_id, reference_gt_date) if reference_gt_date else None
    reference_payload = {
        "property_name": main_reference.get("label", MAIN_PILOT_REFERENCE_LABEL),
        "site_url": reference_url,
        "resolved_url": reference_metrics.get("resolved_url") if reference_metrics else reference_url,
        "psi_metrics_today": reference_metrics,
        "gt_today": reference_gt_today,
        "gt_yesterday": reference_gt_yesterday,
        "note": reference_note or "Live PSI reference site shown separately from pilot, sister, and twin cohort calculations.",
    }
    conn.close()

    best_psi = max(properties, key=lambda p: p["psi_today"] if p["psi_today"] is not None else -1)
    best_gt = max(properties, key=lambda p: p["gt_today"] if p["gt_today"] is not None else -1)
    strongest_traffic = max(properties, key=lambda p: p["new_users_today"] if p["new_users_today"] is not None else -1)
    riskiest = [p for p in properties if p["overall_label"] == "Red"]
    worst_psi = min(properties, key=lambda p: p["psi_today"] if p["psi_today"] is not None else 999)

    best_sister_psi = max(sisters, key=lambda p: p["psi_today"] if p["psi_today"] is not None else -1) if sisters else None
    worst_sister_psi = min(sisters, key=lambda p: p["psi_today"] if p["psi_today"] is not None else 999) if sisters else None
    best_twin_psi = max(twins, key=lambda p: p["psi_today"] if p["psi_today"] is not None else -1) if twins else None
    worst_twin_psi = min(twins, key=lambda p: p["psi_today"] if p["psi_today"] is not None else 999) if twins else None

    executive_bullets = [
        f"{best_psi['property_name']} is the strongest current pilot PSI mobile performer at {fmt_num(best_psi['psi_today'])}.",
        f"{worst_psi['property_name']} is the weakest current pilot PSI mobile performer at {fmt_num(worst_psi['psi_today'])}.",
        f"{strongest_traffic['property_name']} leads pilot new-user volume with {fmt_int(strongest_traffic['new_users_today'])} new users on {display_date(ga_date)}.",
        "BrowserStack production critical journey coverage remains active across desktop Chrome and iPhone Safari.",
    ]
    if best_sister_psi and worst_sister_psi:
        executive_bullets.insert(2, f"{best_sister_psi['property_name']} is the strongest current sister PSI mobile performer at {fmt_num(best_sister_psi['psi_today'])}.")
        executive_bullets.insert(3, f"{worst_sister_psi['property_name']} is the weakest current sister PSI mobile performer at {fmt_num(worst_sister_psi['psi_today'])}.")
    if not gt_date:
        executive_bullets.append(f"Fresh GTMetrix was unavailable for {display_date(report_date)}, so today's GT values are shown as -.")
    if riskiest:
        executive_bullets.append("Watchlist: " + ", ".join(p["property_name"] for p in riskiest) + ".")
    for p in sorted(properties, key=lambda item: item["psi_today"] if item["psi_today"] is not None else 999)[:2]:
        reasons = build_diagnostic_reasons(p["psi_metrics_today"])
        if reasons:
            executive_bullets.append(f"{p['property_name']} diagnostic read: {reasons[0]}")

    generated_at = display_timestamp(datetime.now())

    green_count = sum(1 for p in properties if p["overall_label"] == "Green")
    yellow_count = sum(1 for p in properties if p["overall_label"] == "Yellow")
    red_count = sum(1 for p in properties if p["overall_label"] == "Red")

    avg_psi = average_or_none([p["psi_today"] for p in properties])
    avg_psi_prev = average_or_none([p["psi_yesterday"] for p in properties])
    avg_psi_delta = avg_psi - avg_psi_prev if avg_psi_prev is not None else None
    avg_gt = average_or_none([p["gt_today"] for p in properties])
    avg_gt_prev = average_or_none([p["gt_yesterday"] for p in properties])
    avg_gt_delta = avg_gt - avg_gt_prev if avg_gt_prev is not None else None
    avg_sister_psi = average_or_none([p["psi_today"] for p in sisters])
    avg_sister_psi_prev = average_or_none([p["psi_yesterday"] for p in sisters])
    avg_sister_psi_delta = avg_sister_psi - avg_sister_psi_prev if avg_sister_psi_prev is not None else None
    avg_sister_gt = average_or_none([p["gt_today"] for p in sisters])
    avg_sister_gt_prev = average_or_none([p["gt_yesterday"] for p in sisters])
    avg_sister_gt_delta = avg_sister_gt - avg_sister_gt_prev if avg_sister_gt_prev is not None else None
    avg_twin_psi = average_or_none([p["psi_today"] for p in twins])
    avg_twin_psi_prev = average_or_none([p["psi_yesterday"] for p in twins])
    avg_twin_psi_delta = avg_twin_psi - avg_twin_psi_prev if avg_twin_psi_prev is not None else None
    avg_twin_gt = average_or_none([p["gt_today"] for p in twins])
    avg_twin_gt_prev = average_or_none([p["gt_yesterday"] for p in twins])
    avg_twin_gt_delta = avg_twin_gt - avg_twin_gt_prev if avg_twin_gt_prev is not None else None
    avg_users = average_or_none([p["new_users_today"] for p in properties])
    qa_passes = sum(1 for p in properties if p["desktop_status"] == "Pass" and p["iphone_status"] == "Pass")
    gt_green_count = sum(1 for p in properties if p["gt_today"] is not None and p["gt_today"] >= 95)
    gt_watch_count = sum(1 for p in properties if p["gt_today"] is not None and 90 <= p["gt_today"] < 95)
    gt_action_count = sum(1 for p in properties if p["gt_today"] is not None and p["gt_today"] < 90)
    overview_tiles = [
        KPITile(
            label="Pilot Avg PSI",
            value=f"{avg_psi:.1f}",
            trend=format_kpi_trend(avg_psi_delta, digits=1),
            is_primary=False,
        ),
        KPITile(
            label="Top PSI",
            value=f"{fmt_num(best_psi['psi_today'], 0)}",
            sublabel=best_psi["property_name"],
        ),
        KPITile(
            label="Lowest PSI",
            value=f"{fmt_num(worst_psi['psi_today'], 0)}",
            sublabel=worst_psi["property_name"],
        ),
        KPITile(
            label="Pilot Avg GT",
            value=fmt_num(avg_gt),
            trend=format_kpi_trend(avg_gt_delta, digits=1),
            is_primary=False,
        ),
    ]
    sister_tiles = [
        KPITile(
            label="Sister Avg PSI",
            value=f"{avg_sister_psi:.1f}" if avg_sister_psi is not None else "—",
            trend=format_kpi_trend(avg_sister_psi_delta, digits=1),
            is_primary=False,
        ),
        KPITile(
            label="Top Sister PSI",
            value=f"{fmt_num(best_sister_psi['psi_today'], 0)}" if best_sister_psi else "—",
            sublabel=best_sister_psi["property_name"] if best_sister_psi else None,
        ),
        KPITile(
            label="Lowest Sister PSI",
            value=f"{fmt_num(worst_sister_psi['psi_today'], 0)}" if worst_sister_psi else "—",
            sublabel=worst_sister_psi["property_name"] if worst_sister_psi else None,
        ),
        KPITile(
            label="Sister Avg GT",
            value=fmt_num(avg_sister_gt),
            trend=format_kpi_trend(avg_sister_gt_delta, digits=1),
            is_primary=False,
        ),
    ]
    twin_tiles = [
        KPITile(
            label="Twin Avg PSI",
            value=f"{avg_twin_psi:.1f}" if avg_twin_psi is not None else "—",
            trend=format_kpi_trend(avg_twin_psi_delta, digits=1),
            is_primary=False,
        ),
        KPITile(
            label="Top Twin PSI",
            value=f"{fmt_num(best_twin_psi['psi_today'], 0)}" if best_twin_psi else "—",
            sublabel=best_twin_psi["property_name"] if best_twin_psi else None,
        ),
        KPITile(
            label="Lowest Twin PSI",
            value=f"{fmt_num(worst_twin_psi['psi_today'], 0)}" if worst_twin_psi else "—",
            sublabel=worst_twin_psi["property_name"] if worst_twin_psi else None,
        ),
        KPITile(
            label="Twin Avg GT",
            value=fmt_num(avg_twin_gt),
            trend=format_kpi_trend(avg_twin_gt_delta, digits=1),
            is_primary=False,
        ),
    ]
    overview_html = (
        render_kpi_row(overview_tiles, columns=4)
        + render_kpi_row(sister_tiles, columns=4)
        + render_kpi_row(twin_tiles, columns=4)
    )

    performers_html = '<div style="margin-bottom: 25px;">'
    for pilot_payload, sister_payload, twin_payloads in paired_properties:
        performers_html += performance_pair_card(pilot_payload, sister_payload)
        performers_html += twin_summary_table(twin_payloads)
    performers_html += '</div>'
    diagnostics_html = diagnostic_summary_html(properties)
    reference_html = reference_property_card(reference_payload)

    methodology_html = """
    <ul style="margin:0; padding-left:18px; line-height:1.8; font-size:14px; color:#495057;">
        <li>PSI mobile is the primary score in this roundup and uses the current pilot mobile run history.</li>
        <li>GTMetrix remains supporting context for technical health, not the headline performance score.</li>
        <li>New Users are sourced from GA4 daily metrics using the mapped legacy GA4 property IDs.</li>
        <li>BrowserStack QA status is sourced from the latest production critical journey runs on desktop Chrome and iPhone Safari.</li>
    </ul>
    """

    builder = ReportBuilder(
        title="Pilot Performance Roundup",
        subtitle="Pilot Site Health & Performance Overview",
        version="1.0",
        date_range=generated_at,
    )
    builder.add_section(Section(
        title="Pilot Overview",
        content=overview_html,
        status=None,
        description=None,
    ))
    builder.add_section(Section(
        title="Individual Pilot And Sister Performance",
        content=performers_html,
        status=None,
        description="PSI mobile is the primary displayed metric. Each pilot is grouped with its matched sister/control property and same-region twin properties, while GTMetrix, New Users, and BrowserStack remain supporting context.",
    ))
    builder.add_section(Section(
        title="Main Pilot Reference",
        content=reference_html,
        status=None,
        description="Standalone reference read for the main pilot archetype site. This site is shown separately and is not included in cohort averages.",
    ))
    builder.add_section(Section(
        title="Diagnostic Insights",
        content=diagnostics_html,
        status=None,
        description="Likely Lighthouse drivers behind the current pilot PSI scores",
    ))
    builder.add_section(Section(
        title="Methodology Notes",
        content=methodology_html,
        status=None,
        description="Data provenance and temporary modeling assumptions",
    ))
    html = builder.generate()
    html = apply_custom_header(
        html,
        title="Pilot Performance Roundup",
        subtitle="Pilot Site Health & Performance Overview",
        version="1.0",
        report_display_date=report_display_date,
    )

    md_lines = [
        "# Pilot Performance Roundup",
        "",
        f"- Generated: {generated_at}",
        f"- PSI date: {display_date(psi_date)}",
        f"- GTMetrix date: {display_date(gt_date)}",
        f"- GA4 date: {display_date(ga_date)}",
        "",
        "## Executive Summary",
    ]
    md_lines.extend([f"- {bullet}" for bullet in executive_bullets])
    md_lines.extend(
        [
            "",
            "## Snapshot",
            "",
            "| Property | Role | PSI Today | PSI Δ | GTMetrix Today | GTMetrix Δ | New Users Today | New Users Δ | Desktop QA | iPhone QA | Overall |",
            "|---|---|---:|---:|---:|---:|---:|---:|---|---|---|",
        ]
    )
    for p in properties + sisters + twins:
        md_lines.append(
            f"| {p['property_name']} | {p['role']} | {fmt_num(p['psi_today'])} | {fmt_delta(p['psi_delta'])} | {fmt_num(p['gt_today'])} | {fmt_delta(p['gt_delta'])} | {fmt_int(p['new_users_today'])} | {fmt_delta(p['new_users_delta'], 0)} | {p['desktop_status']} | {p['iphone_status']} | {p['overall_label']} |"
        )
    md_lines.extend(["", "## Property Detail"])
    for p in properties + sisters + twins:
        reasons = build_diagnostic_reasons(p["psi_metrics_today"])
        md_lines.extend(
            [
                "",
                f"### {p['property_name']}",
                f"- Role: {p['role']}",
                f"- PSI Today: {fmt_num(p['psi_today'])}",
                f"- PSI Yesterday: {fmt_num(p['psi_yesterday'])}",
                f"- PSI Δ vs Yesterday: {fmt_delta(p['psi_delta'])}",
                f"- GTMetrix Today: {fmt_num(p['gt_today'])}",
                f"- GTMetrix Yesterday: {fmt_num(p['gt_yesterday'])}",
                f"- GTMetrix Δ vs Yesterday: {fmt_delta(p['gt_delta'])}",
                f"- New Users Today: {fmt_int(p['new_users_today'])}",
                f"- New Users Yesterday: {fmt_int(p['new_users_yesterday'])}",
                f"- New Users Δ vs Yesterday: {fmt_delta(p['new_users_delta'], 0)}",
                f"- New Users YoY: {fmt_delta(p['new_users_yoy'], 0)}",
                f"- BrowserStack QA: Desktop {p['desktop_status']} / iPhone {p['iphone_status']}",
                f"- Overall: {p['overall_label']}",
                f"- Diagnostic Insight: {reasons[0] if reasons else 'No strong Lighthouse diagnostic signal captured yet.'}",
            ]
        )
    md_lines.extend(
        [
            "",
            "## Main Pilot Reference",
            f"- Label: {reference_payload['property_name']}",
            f"- URL: {reference_payload.get('resolved_url') or reference_payload.get('site_url')}",
            f"- PSI: {fmt_num(reference_payload['psi_metrics_today'].get('performance_score'), 0) if reference_payload.get('psi_metrics_today') else '—'}",
            f"- LCP: {fmt_num(reference_payload['psi_metrics_today'].get('lcp_value')) if reference_payload.get('psi_metrics_today') else '—'}{'s' if reference_payload.get('psi_metrics_today', {}).get('lcp_value') is not None else ''}",
            f"- FCP: {fmt_num(reference_payload['psi_metrics_today'].get('fcp_value')) if reference_payload.get('psi_metrics_today') else '—'}{'s' if reference_payload.get('psi_metrics_today', {}).get('fcp_value') is not None else ''}",
            f"- TBT: {fmt_num(reference_payload['psi_metrics_today'].get('tbt_value'), 0) if reference_payload.get('psi_metrics_today') else '—'}{'ms' if reference_payload.get('psi_metrics_today', {}).get('tbt_value') is not None else ''}",
            f"- Note: {reference_payload['note']}",
        ]
    )

    label_date = report_date
    html_path = OUTPUT_DIR / f"Pilot_Performance_Roundup_{label_date}.html"
    md_path = OUTPUT_DIR / f"Pilot_Performance_Roundup_{label_date}.md"
    html_path.write_text(html, encoding="utf-8")
    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    print(f"Saved HTML: {html_path}")
    print(f"Saved MD:   {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
