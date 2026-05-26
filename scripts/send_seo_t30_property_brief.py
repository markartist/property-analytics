#!/usr/bin/env python3
"""
Generate and send a PIB-style SEO T30 property brief for a selected property set.

The brief uses canonical GSC daily metrics from the master database and compares:
- current T30 vs previous T30
- current T30 vs same-date prior-year T30 when data exists

This stays outside locked PIB generation/rendering paths and reuses the shared
PIB-style email shell for proofing and specialty delivery.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, Optional

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REPORT_DIR = ROOT / "reports" / "seo_t30_property_brief"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

import sys

sys.path.insert(0, str(ROOT / "utils"))
from email_sender import EmailSender  # noqa: E402
from pib_email_shell import wrap_pib_light_email  # noqa: E402


DEFAULT_REQUESTS = [
    "Fairways at South Shore",
    "Townhomes at Lake Park",
    "The Pointe at Bentonville",
    "Elation",
    "Anatole - Daytona",
]

REQUEST_ALIAS_TO_CANONICAL = {
    "Fairways at South Shore": "Fairways at South Shore",
    "Townhomes at Lake Park": "Townhomes at Lake Park",
    "The Pointe at Bentonville": "The Pointe Bentonville",
    "Elation": "Elation at Grandway West",
    "Anatole - Daytona": "The Anatole",
}

CARD_BG = "#F8FAFD"
RULE = "#D8DFEA"
VENTERRA_BLUE = "#15284B"
SUCCESS_GREEN = "#1E7F4F"
WARNING_AMBER = "#A86400"
RISK_RED = "#A61E2A"
SLATE = "#5B6575"
BODY = "#1F2937"
MUTED = "#6B7280"


@dataclass(frozen=True)
class Window:
    label: str
    start: str
    end: str


@dataclass
class PropertyReport:
    request_name: str
    canonical_name: str
    property_id: str
    current: dict
    previous: dict
    yoy: dict
    daily_current: list[dict]
    daily_previous: list[dict]
    daily_yoy: list[dict]
    notes: list[str]


@dataclass(frozen=True)
class ReportContext:
    requested_start: str
    requested_end: str
    effective_end: str
    latest_metric_date: str
    window_days: int
    end_capped: bool


def fmt_int(value: Optional[int]) -> str:
    if value is None:
        return "N/A"
    return f"{int(value):,}"


def fmt_float(value: Optional[float], digits: int = 1, suffix: str = "") -> str:
    if value is None:
        return "N/A"
    return f"{value:.{digits}f}{suffix}"


def fmt_delta(value: Optional[float], digits: int = 1, suffix: str = "%") -> str:
    if value is None:
        return "N/A"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.{digits}f}{suffix}"


def safe_pct_change(current: Optional[float], baseline: Optional[float]) -> Optional[float]:
    if current is None or baseline in (None, 0):
        return None
    return ((current - baseline) / baseline) * 100.0


def safe_diff(current: Optional[float], baseline: Optional[float]) -> Optional[float]:
    if current is None or baseline is None:
        return None
    return current - baseline


def quality_signal(click_delta_pct: Optional[float], impression_delta_pct: Optional[float]) -> tuple[str, str]:
    if click_delta_pct is None and impression_delta_pct is None:
        return "Data Watch", WARNING_AMBER
    if (click_delta_pct or 0) >= 10 and (impression_delta_pct or 0) >= 10:
        return "Growing", SUCCESS_GREEN
    if (click_delta_pct or 0) <= -10 and (impression_delta_pct or 0) <= -10:
        return "Softening", RISK_RED
    return "Mixed", WARNING_AMBER


def daterange(start: datetime, end: datetime) -> Iterable[datetime]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def build_windows(current_start: str, current_end: str) -> tuple[Window, Window, Window]:
    current_start_dt = datetime.strptime(current_start, "%Y-%m-%d")
    current_end_dt = datetime.strptime(current_end, "%Y-%m-%d")
    window_days = (current_end_dt - current_start_dt).days + 1
    previous_end = current_start_dt - timedelta(days=1)
    previous_start = previous_end - timedelta(days=window_days - 1)
    yoy_start = current_start_dt - timedelta(days=365)
    yoy_end = current_end_dt - timedelta(days=365)
    return (
        Window("Current Window", current_start_dt.strftime("%Y-%m-%d"), current_end_dt.strftime("%Y-%m-%d")),
        Window("Previous Window", previous_start.strftime("%Y-%m-%d"), previous_end.strftime("%Y-%m-%d")),
        Window("YoY Window", yoy_start.strftime("%Y-%m-%d"), yoy_end.strftime("%Y-%m-%d")),
    )


def get_latest_metric_date(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT MAX(metric_date) AS max_date FROM gsc_daily_metrics").fetchone()
    if not row or not row["max_date"]:
        raise RuntimeError("No gsc_daily_metrics rows found in canonical database.")
    return row["max_date"]


def resolve_property(conn: sqlite3.Connection, request_name: str) -> tuple[str, str]:
    canonical_name = REQUEST_ALIAS_TO_CANONICAL.get(request_name, request_name)
    row = conn.execute(
        """
        SELECT property_id, property_name
        FROM property_metadata
        WHERE lower(property_name) = lower(?)
        """,
        (canonical_name,),
    ).fetchone()
    if not row:
        raise RuntimeError(f"Property not found in property_metadata for request '{request_name}' -> '{canonical_name}'")
    return row["property_id"], row["property_name"]


def fetch_window_agg(conn: sqlite3.Connection, property_id: str, window: Window) -> dict:
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS days_with_data,
            COALESCE(SUM(clicks), 0) AS clicks,
            COALESCE(SUM(impressions), 0) AS impressions,
            AVG(average_position) AS average_position
        FROM gsc_daily_metrics
        WHERE COALESCE(NULLIF(ga4_property_id, ''), property_id) = ?
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, window.start, window.end),
    ).fetchone()

    days_with_data = int(row["days_with_data"] or 0)
    if days_with_data == 0:
        clicks = None
        impressions = None
        ctr = None
        avg_position = None
    else:
        clicks = int(row["clicks"] or 0)
        impressions = int(row["impressions"] or 0)
        ctr = (100.0 * clicks / impressions) if impressions else None
        avg_position = float(row["average_position"]) if row["average_position"] is not None else None
    return {
        "window": window.label,
        "start": window.start,
        "end": window.end,
        "days_with_data": days_with_data,
        "clicks": clicks,
        "impressions": impressions,
        "ctr": ctr,
        "average_position": avg_position,
    }


def fetch_daily_series(conn: sqlite3.Connection, property_id: str, window: Window) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            metric_date,
            COALESCE(clicks, 0) AS clicks,
            COALESCE(impressions, 0) AS impressions,
            ctr,
            average_position
        FROM gsc_daily_metrics
        WHERE COALESCE(NULLIF(ga4_property_id, ''), property_id) = ?
          AND metric_date BETWEEN ? AND ?
        ORDER BY metric_date
        """,
        (property_id, window.start, window.end),
    ).fetchall()
    by_date = {row["metric_date"]: row for row in rows}

    start_dt = datetime.strptime(window.start, "%Y-%m-%d")
    end_dt = datetime.strptime(window.end, "%Y-%m-%d")
    series: list[dict] = []
    for idx, day in enumerate(daterange(start_dt, end_dt), start=1):
        key = day.strftime("%Y-%m-%d")
        row = by_date.get(key)
        clicks = int(row["clicks"]) if row else 0
        impressions = int(row["impressions"]) if row else 0
        ctr = (100.0 * clicks / impressions) if impressions else None
        avg_position = float(row["average_position"]) if row and row["average_position"] is not None else None
        series.append(
            {
                "day_index": idx,
                "date": key,
                "clicks": clicks,
                "impressions": impressions,
                "ctr": ctr,
                "average_position": avg_position,
            }
        )
    return series


def metric_path(
    points_a: list[Optional[float]],
    points_b: list[Optional[float]],
    points_c: list[Optional[float]],
    width: int = 820,
    height: int = 190,
    pad: int = 22,
) -> tuple[str, str, str, float, float]:
    all_vals = [v for v in points_a + points_b + points_c if v is not None and not math.isnan(v)]
    if not all_vals:
        return "", "", "", 0.0, 1.0
    min_v = min(all_vals)
    max_v = max(all_vals)
    span = max(max_v - min_v, 1e-9)
    step = (width - 2 * pad) / max(len(points_a) - 1, 1)

    def make(vals: list[Optional[float]]) -> str:
        coords: list[str] = []
        for idx, value in enumerate(vals):
            if value is None or math.isnan(value):
                continue
            x = pad + idx * step
            y = height - pad - ((value - min_v) / span) * (height - 2 * pad)
            coords.append(f"{x:.1f},{y:.1f}")
        return " ".join(coords)

    return make(points_a), make(points_b), make(points_c), min_v, max_v


def build_chart(
    title: str,
    current_series: list[dict],
    previous_series: list[dict],
    yoy_series: list[dict],
    field: str,
    current_label: str,
    previous_label: str,
    yoy_label: str,
) -> str:
    current_vals = [row.get(field) for row in current_series]
    previous_vals = [row.get(field) for row in previous_series]
    yoy_vals = [row.get(field) for row in yoy_series]
    p_current, p_previous, p_yoy, min_v, max_v = metric_path(current_vals, previous_vals, yoy_vals)

    return f"""
    <div style="margin-top:14px;border:1px solid {RULE};border-radius:6px;background:#ffffff;padding:12px;">
      <div style="font-size:13px;font-weight:700;color:{BODY};margin-bottom:6px;">{title}</div>
      <svg width="100%" viewBox="0 0 820 190" role="img" aria-label="{title}">
        <rect x="0" y="0" width="820" height="190" fill="#ffffff"></rect>
        <line x1="22" y1="22" x2="22" y2="168" stroke="#d4dbe5" stroke-width="1"></line>
        <line x1="22" y1="168" x2="798" y2="168" stroke="#d4dbe5" stroke-width="1"></line>
        <polyline points="{p_yoy}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4"></polyline>
        <polyline points="{p_previous}" fill="none" stroke="#60a5fa" stroke-width="2.5"></polyline>
        <polyline points="{p_current}" fill="none" stroke="#10b981" stroke-width="3"></polyline>
        <text x="30" y="18" fill="{MUTED}" font-size="11">max {max_v:.2f}</text>
        <text x="30" y="182" fill="{MUTED}" font-size="11">min {min_v:.2f}</text>
        <text x="500" y="18" fill="#10b981" font-size="11">{current_label}</text>
        <text x="620" y="18" fill="#60a5fa" font-size="11">{previous_label}</text>
        <text x="740" y="18" fill="#94a3b8" font-size="11">{yoy_label}</text>
      </svg>
      <div style="font-size:11px;color:{MUTED};margin-top:4px;">Aligned by day index across the selected comparison windows.</div>
    </div>
    """


def build_summary_table(prop: PropertyReport, current_label: str, previous_label: str, yoy_label: str) -> str:
    metrics = [
        ("Clicks", "clicks", 0, ""),
        ("Impressions", "impressions", 0, ""),
        ("CTR", "ctr", 2, "%"),
        ("Avg Position", "average_position", 2, ""),
    ]
    rows: list[str] = []
    for label, key, digits, suffix in metrics:
        current_value = prop.current.get(key)
        previous_value = prop.previous.get(key)
        yoy_value = prop.yoy.get(key)
        mom_change = safe_pct_change(current_value, previous_value)
        yoy_change = safe_pct_change(current_value, yoy_value)

        def render_value(value: Optional[float | int]) -> str:
            if value is None:
                return "N/A"
            if isinstance(value, int):
                return fmt_int(value)
            return fmt_float(value, digits, suffix)

        rows.append(
            f"""
            <tr>
              <td style="padding:10px;border-bottom:1px solid #edf1f5;font-weight:700;color:{BODY};">{label}</td>
              <td style="padding:10px;border-bottom:1px solid #edf1f5;color:{BODY};">{render_value(current_value)}</td>
              <td style="padding:10px;border-bottom:1px solid #edf1f5;color:{BODY};">{render_value(previous_value)}</td>
              <td style="padding:10px;border-bottom:1px solid #edf1f5;color:{BODY};">{render_value(yoy_value)}</td>
              <td style="padding:10px;border-bottom:1px solid #edf1f5;color:{BODY};">{fmt_delta(mom_change)}</td>
              <td style="padding:10px;border-bottom:1px solid #edf1f5;color:{BODY};">{fmt_delta(yoy_change)}</td>
            </tr>
            """
        )

    return f"""
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:12px;">
      <tr style="background:#f7f9fc;">
        <th style="padding:10px;text-align:left;font-size:12px;color:{MUTED};text-transform:uppercase;">Metric</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:{MUTED};text-transform:uppercase;">{current_label}</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:{MUTED};text-transform:uppercase;">{previous_label}</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:{MUTED};text-transform:uppercase;">{yoy_label}</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:{MUTED};text-transform:uppercase;">Vs Prev Δ%</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:{MUTED};text-transform:uppercase;">YoY Δ%</th>
      </tr>
      {''.join(rows)}
    </table>
    """


def build_property_card(prop: PropertyReport, context: ReportContext) -> str:
    clicks_mom = safe_pct_change(prop.current.get("clicks"), prop.previous.get("clicks"))
    impressions_mom = safe_pct_change(prop.current.get("impressions"), prop.previous.get("impressions"))
    signal_text, signal_color = quality_signal(clicks_mom, impressions_mom)
    notes_html = "".join(f"<li>{note}</li>" for note in prop.notes)
    current_label = f"Current {context.window_days}D"
    previous_label = f"Previous {context.window_days}D"
    yoy_label = "YoY Match"

    return f"""
    <div style="margin-top:18px;border:1px solid {RULE};border-radius:6px;background:{CARD_BG};padding:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <div style="font-size:22px;font-weight:700;color:{VENTERRA_BLUE};">{prop.request_name}</div>
          <div style="font-size:12px;color:{MUTED};margin-top:4px;">Canonical record: {prop.canonical_name} ({prop.property_id})</div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#ffffff;background:{signal_color};padding:6px 10px;border-radius:999px;">{signal_text}</div>
      </div>
      <div style="margin-top:10px;font-size:14px;line-height:1.65;color:{BODY};">
        Current window: {prop.current['start']} to {prop.current['end']} |
        Previous window: {prop.previous['start']} to {prop.previous['end']} |
        YoY match: {prop.yoy['start']} to {prop.yoy['end']}
      </div>
      {build_summary_table(prop, current_label, previous_label, yoy_label)}
      {build_chart("Daily Clicks", prop.daily_current, prop.daily_previous, prop.daily_yoy, "clicks", current_label, previous_label, yoy_label)}
      {build_chart("Daily Impressions", prop.daily_current, prop.daily_previous, prop.daily_yoy, "impressions", current_label, previous_label, yoy_label)}
      <div style="margin-top:14px;font-size:14px;font-weight:700;color:{VENTERRA_BLUE};">Readout</div>
      <ul style="margin:8px 0 0 18px;padding:0;font-size:13px;line-height:1.6;color:{BODY};">
        {notes_html}
      </ul>
    </div>
    """


def build_exec_cards(reports: list[PropertyReport], context: ReportContext) -> str:
    click_growers = sum(
        1
        for prop in reports
        if (safe_pct_change(prop.current.get("clicks"), prop.previous.get("clicks")) or -999) > 0
    )
    covered_yoy = sum(1 for prop in reports if prop.yoy.get("days_with_data", 0) > 0)
    total_clicks = sum(prop.current.get("clicks", 0) or 0 for prop in reports)
    total_impressions = sum(prop.current.get("impressions", 0) or 0 for prop in reports)
    blended_ctr = (100.0 * total_clicks / total_impressions) if total_impressions else None

    def card(label: str, value: str, note: str) -> str:
        return f"""
        <td style="width:25%;padding:8px;vertical-align:top;">
          <div style="background:{CARD_BG};border:1px solid {RULE};border-radius:6px;padding:14px 12px;">
            <div style="font-size:11px;color:{MUTED};text-transform:uppercase;font-weight:700;">{label}</div>
            <div style="font-size:28px;color:{VENTERRA_BLUE};font-weight:700;margin-top:8px;">{value}</div>
            <div style="font-size:12px;color:{SLATE};line-height:1.45;margin-top:6px;">{note}</div>
          </div>
        </td>
        """

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
      <tr>
        {card("Properties Covered", str(len(reports)), "Requested five-property proof set using canonical GSC daily metrics.")}
        {card(f"Current {context.window_days}D Clicks", fmt_int(total_clicks), "Combined organic clicks across the selected properties for the active reporting window.")}
        {card("Blended CTR", fmt_float(blended_ctr, 2, "%"), "Weighted CTR across the active reporting window.")}
        {card("YoY Coverage", f"{covered_yoy}/{len(reports)}", "Properties with same-date prior-year data available in the current warehouse.")}
      </tr>
      <tr>
        {card("Vs Prev Growers", f"{click_growers}/{len(reports)}", "Properties with current-window clicks above the immediately preceding matched window.")}
        {card("Warehouse Freshness", context.latest_metric_date, "Latest canonical GSC metric date available in the warehouse.")}
        {card("Data Source", "GSC Daily", "Canonical table: gsc_daily_metrics in portfolio_analytics.db.")}
        {card("Delivery Mode", "Proof Email", "PIB-style specialty brief sent outside the locked PIB renderer.")}
      </tr>
    </table>
    """


def build_html(reports: list[PropertyReport], current_window: Window, context: ReportContext) -> str:
    coverage_line = (
        f"Requested end date was {context.requested_end}, but canonical GSC data is currently available only through {context.effective_end}, so the report is capped at the freshest available date."
        if context.end_capped
        else f"Canonical GSC data was available through the requested end date of {context.effective_end}."
    )
    body_html = f"""
    <div style="font-family:Arial,sans-serif;color:{BODY};">
      <div style="font-size:15px;line-height:1.7;color:{BODY};">
        This proof packages a daily SEO performance readout for five requested properties using canonical Search Console data.
        The active window is compared to the immediately preceding matched-length window and to the same-date prior-year window when the warehouse has coverage.
      </div>
      <ul style="margin:12px 0 0 18px;padding:0;font-size:14px;line-height:1.65;color:{BODY};">
        <li>Requested window: {context.requested_start} through {context.requested_end}.</li>
        <li>Effective reporting window: {current_window.start} through {current_window.end} ({context.window_days} days).</li>
        <li>{coverage_line}</li>
        <li>YoY in this proof is explicitly marked unavailable when the database does not yet contain the same-date 2025 baseline.</li>
        <li>Requested name aliases were resolved to canonical properties before query execution to avoid parallel report definitions.</li>
      </ul>
      {build_exec_cards(reports, context)}
      <div style="margin-top:24px;font-size:18px;font-weight:700;color:{VENTERRA_BLUE};">Property Detail</div>
      {''.join(build_property_card(report, context) for report in reports)}
      <div style="margin-top:18px;padding:14px 16px;background:#ffffff;border:1px solid {RULE};border-radius:6px;">
        <div style="font-size:15px;font-weight:700;color:{VENTERRA_BLUE};">Interpretation Guardrail</div>
        <div style="margin-top:6px;font-size:14px;line-height:1.65;color:{BODY};">
          This is a directional SEO performance brief focused on organic search demand and click capture.
          It does not attempt to infer causality, rankings, or landing-page quality beyond what the canonical GSC signals support.
        </div>
      </div>
    </div>
    """

    return wrap_pib_light_email(
        title="SEO Performance Window Brief",
        subtitle=f"PIB-style proof for selected properties | {current_window.start} through {current_window.end}",
        body_html=body_html,
        badge_text="Proof Draft",
        badge_fg="#ffffff",
        badge_bg=VENTERRA_BLUE,
    )


def build_plain_text(reports: list[PropertyReport], current_window: Window, context: ReportContext) -> str:
    lines = [
        "SEO Performance Window Brief",
        f"Requested window: {context.requested_start} to {context.requested_end}",
        f"Effective window: {current_window.start} to {current_window.end}",
        f"Latest canonical GSC date: {context.latest_metric_date}",
        "",
        "Property summary:",
    ]
    for prop in reports:
        click_mom = fmt_delta(safe_pct_change(prop.current.get("clicks"), prop.previous.get("clicks")))
        impression_mom = fmt_delta(safe_pct_change(prop.current.get("impressions"), prop.previous.get("impressions")))
        yoy_days = prop.yoy.get("days_with_data", 0)
        yoy_note = "YoY unavailable" if yoy_days == 0 else "YoY available"
        lines.append(
            f"- {prop.request_name}: clicks {fmt_int(prop.current.get('clicks'))} ({click_mom} vs previous matched window), "
            f"impressions {fmt_int(prop.current.get('impressions'))} ({impression_mom}), "
            f"CTR {fmt_float(prop.current.get('ctr'), 2, '%')}, {yoy_note}"
        )
    return "\n".join(lines)


def build_notes(prop: PropertyReport, context: ReportContext) -> list[str]:
    notes: list[str] = []
    clicks_mom = safe_pct_change(prop.current.get("clicks"), prop.previous.get("clicks"))
    impressions_mom = safe_pct_change(prop.current.get("impressions"), prop.previous.get("impressions"))
    ctr_mom = safe_diff(prop.current.get("ctr"), prop.previous.get("ctr"))
    avg_pos_mom = safe_diff(prop.current.get("average_position"), prop.previous.get("average_position"))

    notes.append(
        f"Current window delivered {fmt_int(prop.current.get('clicks'))} clicks on {fmt_int(prop.current.get('impressions'))} impressions, "
        f"with CTR at {fmt_float(prop.current.get('ctr'), 2, '%')}."
    )
    notes.append(
        f"Versus the previous matched window, clicks moved {fmt_delta(clicks_mom)} and impressions moved {fmt_delta(impressions_mom)}; "
        f"CTR shifted {fmt_float(ctr_mom, 2, ' pts')} and average position shifted {fmt_float(avg_pos_mom, 2)}."
    )
    if prop.yoy.get("days_with_data", 0) == 0:
        notes.append(
            "YoY baseline is unavailable in the current warehouse because canonical GSC daily history begins on 2025-09-17, after the matching 2025 spring window."
        )
    else:
        notes.append(
            f"YoY comparison is based on {prop.yoy.get('days_with_data')} days of same-date prior-year data."
        )
    if prop.current.get("days_with_data", 0) < 30:
        notes.append(
            f"Current window contains {prop.current.get('days_with_data')} populated days in GSC across a {context.window_days}-day reporting range."
        )
    return notes


def build_property_report(
    conn: sqlite3.Connection,
    request_name: str,
    windows: tuple[Window, Window, Window],
    context: ReportContext,
) -> PropertyReport:
    property_id, canonical_name = resolve_property(conn, request_name)
    current_window, previous_window, yoy_window = windows
    current = fetch_window_agg(conn, property_id, current_window)
    previous = fetch_window_agg(conn, property_id, previous_window)
    yoy = fetch_window_agg(conn, property_id, yoy_window)

    report = PropertyReport(
        request_name=request_name,
        canonical_name=canonical_name,
        property_id=property_id,
        current=current,
        previous=previous,
        yoy=yoy,
        daily_current=fetch_daily_series(conn, property_id, current_window),
        daily_previous=fetch_daily_series(conn, property_id, previous_window),
        daily_yoy=fetch_daily_series(conn, property_id, yoy_window),
        notes=[],
    )
    report.notes = build_notes(report, context)
    return report


def write_csv(path: Path, reports: list[PropertyReport]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "request_name",
                "canonical_name",
                "property_id",
                "current_start",
                "current_end",
                "current_clicks",
                "previous_clicks",
                "yoy_clicks",
                "current_impressions",
                "previous_impressions",
                "yoy_impressions",
                "current_ctr",
                "previous_ctr",
                "yoy_ctr",
                "current_average_position",
                "previous_average_position",
                "yoy_average_position",
                "clicks_mom_pct",
                "clicks_yoy_pct",
                "impressions_mom_pct",
                "impressions_yoy_pct",
            ]
        )
        for prop in reports:
            writer.writerow(
                [
                    prop.request_name,
                    prop.canonical_name,
                    prop.property_id,
                    prop.current["start"],
                    prop.current["end"],
                    prop.current["clicks"],
                    prop.previous["clicks"],
                    prop.yoy["clicks"],
                    prop.current["impressions"],
                    prop.previous["impressions"],
                    prop.yoy["impressions"],
                    prop.current["ctr"],
                    prop.previous["ctr"],
                    prop.yoy["ctr"],
                    prop.current["average_position"],
                    prop.previous["average_position"],
                    prop.yoy["average_position"],
                    safe_pct_change(prop.current["clicks"], prop.previous["clicks"]),
                    safe_pct_change(prop.current["clicks"], prop.yoy["clicks"]),
                    safe_pct_change(prop.current["impressions"], prop.previous["impressions"]),
                    safe_pct_change(prop.current["impressions"], prop.yoy["impressions"]),
                ]
            )


def build_context(conn: sqlite3.Connection, requested_start: str, requested_end: str) -> ReportContext:
    latest_metric_date = get_latest_metric_date(conn)
    latest_dt = datetime.strptime(latest_metric_date, "%Y-%m-%d")
    requested_start_dt = datetime.strptime(requested_start, "%Y-%m-%d")
    requested_end_dt = datetime.strptime(requested_end, "%Y-%m-%d")
    effective_end_dt = min(requested_end_dt, latest_dt)
    if requested_start_dt > effective_end_dt:
        raise RuntimeError(
            f"Requested start {requested_start} is after latest available canonical GSC date {latest_metric_date}."
        )
    return ReportContext(
        requested_start=requested_start_dt.strftime("%Y-%m-%d"),
        requested_end=requested_end_dt.strftime("%Y-%m-%d"),
        effective_end=effective_end_dt.strftime("%Y-%m-%d"),
        latest_metric_date=latest_metric_date,
        window_days=(effective_end_dt - requested_start_dt).days + 1,
        end_capped=effective_end_dt < requested_end_dt,
    )


def generate_report(
    request_names: list[str],
    requested_start: Optional[str] = None,
    requested_end: Optional[str] = None,
) -> tuple[Path, Path, Path, list[PropertyReport], Window, ReportContext]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        latest_metric_date = get_latest_metric_date(conn)
        effective_end = requested_end or latest_metric_date
        effective_start = requested_start or (datetime.strptime(effective_end, "%Y-%m-%d") - timedelta(days=29)).strftime("%Y-%m-%d")
        context = build_context(conn, effective_start, effective_end)
        windows = build_windows(context.requested_start, context.effective_end)
        reports = [build_property_report(conn, name, windows, context) for name in request_names]
    finally:
        conn.close()

    generated_at = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = REPORT_DIR / f"seo_t30_property_brief_{generated_at}.html"
    json_path = REPORT_DIR / f"seo_t30_property_brief_{generated_at}.json"
    csv_path = REPORT_DIR / f"seo_t30_property_brief_{generated_at}.csv"

    html_path.write_text(build_html(reports, windows[0], context), encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now().isoformat(),
                "latest_metric_date": latest_metric_date,
                "context": context.__dict__,
                "windows": {
                    "current": windows[0].__dict__,
                    "previous": windows[1].__dict__,
                    "yoy": windows[2].__dict__,
                },
                "properties": [
                    {
                        "request_name": report.request_name,
                        "canonical_name": report.canonical_name,
                        "property_id": report.property_id,
                        "current": report.current,
                        "previous": report.previous,
                        "yoy": report.yoy,
                        "notes": report.notes,
                    }
                    for report in reports
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    write_csv(csv_path, reports)
    return html_path, json_path, csv_path, reports, windows[0], context


def send_report(
    html_path: Path,
    json_path: Path,
    csv_path: Path,
    reports: list[PropertyReport],
    current_window: Window,
    context: ReportContext,
    recipients: Optional[list[str]],
) -> None:
    sender = EmailSender(verbose=True)
    sender.send_email(
        subject=f"PIB-Style SEO Performance Brief - {current_window.start} to {current_window.end}",
        html_body=html_path.read_text(encoding="utf-8"),
        plain_text=build_plain_text(reports, current_window, context),
        recipients=recipients,
        attachments=[
            (json_path.name, json_path.read_bytes(), "application/json"),
            (csv_path.name, csv_path.read_bytes(), "text/csv"),
        ],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate and send PIB-style SEO performance property brief.")
    parser.add_argument(
        "--properties",
        help="Comma-separated requested property names. Defaults to the current proof set.",
    )
    parser.add_argument(
        "--start-date",
        help="Reporting window start date in YYYY-MM-DD. Defaults to latest-date-minus-29 days.",
    )
    parser.add_argument(
        "--end-date",
        help="Reporting window end date in YYYY-MM-DD. Defaults to latest available canonical GSC date.",
    )
    parser.add_argument(
        "--recipients",
        help="Comma-separated recipients. Defaults to the email sender configuration default recipients.",
    )
    parser.add_argument(
        "--no-send",
        action="store_true",
        help="Generate artifacts without emailing them.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    request_names = (
        [item.strip() for item in args.properties.split(",") if item.strip()]
        if args.properties
        else DEFAULT_REQUESTS
    )
    recipients = [item.strip() for item in args.recipients.split(",") if item.strip()] if args.recipients else None

    html_path, json_path, csv_path, reports, current_window, context = generate_report(
        request_names,
        requested_start=args.start_date,
        requested_end=args.end_date,
    )

    if not args.no_send:
        send_report(html_path, json_path, csv_path, reports, current_window, context, recipients)

    print(f"HTML: {html_path}")
    print(f"JSON: {json_path}")
    print(f"CSV: {csv_path}")
    print(f"CURRENT_WINDOW: {current_window.start} -> {current_window.end}")
    print(f"REQUESTED_WINDOW: {context.requested_start} -> {context.requested_end}")
    print(f"LATEST_METRIC_DATE: {context.latest_metric_date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
