#!/usr/bin/env python3
"""
Generate and send a daily copy change impact brief for selected properties.

Purpose:
- Track directional SEO impact after registered copy-change waves
- Keep the email readable and evidence-led, not a raw metric dump
- Store underlying observations locally while keeping the email concise
"""

from __future__ import annotations

import argparse
import html
import json
import math
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REPORT_DIR = ROOT / "reports" / "copy_change_impact_brief"
REPORT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_TEMPLATE_VERSION = "1.3"
REPORT_SCHEMA_VERSION = "copy_change_impact_brief_v1_3_decision_read"

import sys

sys.path.insert(0, str(ROOT / "utils"))
sys.path.insert(0, str(ROOT / "Property_Intelligence_Brief"))
sys.path.append(str(ROOT / "Data_Collection" / "utils"))
from copy_change_monitoring import (  # noqa: E402
    CopyChangeIntervention,
    ensure_copy_change_schema,
    list_interventions,
    seed_april_17_wave,
    store_observation,
)
from email_sender import EmailSender  # noqa: E402
from property_identity import resolve_property_identity  # noqa: E402
from templates.executive_template import get_logo_html  # noqa: E402


VENTERRA_BLUE = "#15284B"
CARD_BG = "#F8FAFD"
RULE = "#D8DFEA"
BODY = "#1F2937"
MUTED = "#6B7280"
SLATE = "#5B6575"
GREEN = "#1E7F4F"
AMBER = "#A86400"
RED = "#A61E2A"


@dataclass(frozen=True)
class Window:
    start: str
    end: str
    days: int


@dataclass
class PropertyImpact:
    intervention_id: str
    wave_id: str
    wave_name: str
    request_name: str
    canonical_name: str
    property_id: str
    property_code: str
    page_url: Optional[str]
    publish_timestamp: str
    first_full_post_day: str
    change_type: str
    changed_fields: tuple[str, ...]
    change_summary: str
    headline: str
    headline_color: str
    gsc_current: dict
    gsc_prior: dict
    ga4_current: dict
    ga4_prior: dict
    decision: Optional[dict] = None


def fmt_int(value: Optional[int]) -> str:
    if value is None:
        return "N/A"
    return f"{int(value):,}"


def fmt_float(value: Optional[float], digits: int = 1, suffix: str = "") -> str:
    if value is None:
        return "N/A"
    return f"{value:.{digits}f}{suffix}"


def fmt_delta_pct(curr: Optional[float], prev: Optional[float], digits: int = 1) -> str:
    if curr is None or prev in (None, 0):
        return "N/A"
    pct = ((curr - prev) / prev) * 100.0
    sign = "+" if pct > 0 else ""
    return f"{sign}{pct:.{digits}f}%"


def fmt_diff(curr: Optional[float], prev: Optional[float], digits: int = 2, suffix: str = "") -> str:
    if curr is None or prev is None:
        return "N/A"
    diff = curr - prev
    sign = "+" if diff > 0 else ""
    return f"{sign}{diff:.{digits}f}{suffix}"


def get_latest_dates(conn: sqlite3.Connection) -> tuple[date, date]:
    gsc_latest = conn.execute("SELECT MAX(metric_date) AS d FROM gsc_daily_metrics").fetchone()["d"]
    ga4_latest = conn.execute("SELECT MAX(metric_date) AS d FROM ga4_traffic_sources").fetchone()["d"]
    return datetime.strptime(gsc_latest, "%Y-%m-%d").date(), datetime.strptime(ga4_latest, "%Y-%m-%d").date()


def build_windows_for_post_start(
    gsc_latest: date,
    ga4_latest: date,
    post_start: date,
) -> tuple[Window, Window, Window, Window]:
    """Build source-specific post/prior windows for one intervention."""
    gsc_post_end = max(gsc_latest, post_start)
    gsc_post_days = (gsc_post_end - post_start).days + 1
    gsc_pre_end = post_start - timedelta(days=2)
    gsc_pre_start = gsc_pre_end - timedelta(days=gsc_post_days - 1)

    ga4_post_end = max(min(ga4_latest, date.today()), post_start)
    ga4_post_days = (ga4_post_end - post_start).days + 1
    ga4_pre_end = post_start - timedelta(days=2)
    ga4_pre_start = ga4_pre_end - timedelta(days=ga4_post_days - 1)

    return (
        Window(post_start.isoformat(), gsc_post_end.isoformat(), gsc_post_days),
        Window(gsc_pre_start.isoformat(), gsc_pre_end.isoformat(), gsc_post_days),
        Window(post_start.isoformat(), ga4_post_end.isoformat(), ga4_post_days),
        Window(ga4_pre_start.isoformat(), ga4_pre_end.isoformat(), ga4_post_days),
    )


def fetch_gsc_window(conn: sqlite3.Connection, property_id: str, window: Window) -> dict:
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS days,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            AVG(average_position) AS position
        FROM gsc_daily_metrics
        WHERE ga4_property_id = ?
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, window.start, window.end),
    ).fetchone()
    days = int(row["days"] or 0)
    clicks = int(row["clicks"] or 0) if days else None
    impressions = int(row["impressions"] or 0) if days else None
    ctr = (100.0 * clicks / impressions) if days and impressions else None
    position = float(row["position"]) if row["position"] is not None else None
    return {
        "window": window.__dict__,
        "days": days,
        "clicks": clicks,
        "impressions": impressions,
        "ctr": ctr,
        "position": position,
    }


def fetch_ga4_window(conn: sqlite3.Connection, property_id: str, window: Window) -> dict:
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS rows,
            SUM(sessions) AS sessions,
            SUM(engaged_sessions) AS engaged_sessions,
            SUM(conversions) AS conversions,
            SUM(new_users) AS new_users,
            SUM(total_users) AS total_users
        FROM ga4_traffic_sources
        WHERE property_id = ?
          AND channel_group = 'Organic Search'
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, window.start, window.end),
    ).fetchone()
    rows = int(row["rows"] or 0)
    sessions = int(row["sessions"] or 0) if rows else None
    engaged = int(row["engaged_sessions"] or 0) if rows else None
    conversions = int(row["conversions"] or 0) if rows else None
    new_users = int(row["new_users"] or 0) if rows else None
    total_users = int(row["total_users"] or 0) if rows else None
    engagement_rate = (100.0 * engaged / sessions) if rows and sessions else None
    conversion_rate = (100.0 * conversions / sessions) if rows and sessions else None
    return {
        "window": window.__dict__,
        "rows": rows,
        "sessions": sessions,
        "engaged_sessions": engaged,
        "conversions": conversions,
        "new_users": new_users,
        "total_users": total_users,
        "engagement_rate": engagement_rate,
        "conversion_rate": conversion_rate,
    }


def fetch_gsc_query_window(conn: sqlite3.Connection, property_id: str, window: Window) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            query,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            AVG(average_position) AS position
        FROM gsc_queries
        WHERE (property_id = ? OR ga4_property_id = ?)
          AND metric_date BETWEEN ? AND ?
        GROUP BY query
        """,
        (property_id, property_id, window.start, window.end),
    ).fetchall()
    output = []
    for row in rows:
        clicks = int(row["clicks"] or 0)
        impressions = int(row["impressions"] or 0)
        output.append(
            {
                "query": row["query"] or "",
                "clicks": clicks,
                "impressions": impressions,
                "ctr": (100.0 * clicks / impressions) if impressions else None,
                "position": float(row["position"]) if row["position"] is not None else None,
            }
        )
    return output


def pct_change(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev in (None, 0):
        return None
    return ((curr - prev) / prev) * 100.0


def build_relative_window(end_date_str: str, days: int) -> Window:
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    start_date = end_date - timedelta(days=days - 1)
    return Window(start_date.isoformat(), end_date.isoformat(), days)


def build_pre_window(days: int, first_full_post_day: str) -> Window:
    end_date = datetime.strptime(first_full_post_day, "%Y-%m-%d").date() - timedelta(days=2)
    start_date = end_date - timedelta(days=days - 1)
    return Window(start_date.isoformat(), end_date.isoformat(), days)


def summarize_window(
    conn: sqlite3.Connection,
    property_id: str,
    gsc_end: str,
    ga4_end: str,
    requested_days: int,
    available_gsc_days: int,
    available_ga4_days: int,
    first_full_post_day: str,
) -> tuple[str, str, str]:
    used_days = min(requested_days, available_gsc_days, available_ga4_days)
    if used_days < requested_days:
        return "Pending", AMBER, "Awaiting full window"

    gsc_current = fetch_gsc_window(conn, property_id, build_relative_window(gsc_end, used_days))
    gsc_prior = fetch_gsc_window(conn, property_id, build_pre_window(used_days, first_full_post_day))
    ga4_current = fetch_ga4_window(conn, property_id, build_relative_window(ga4_end, used_days))
    ga4_prior = fetch_ga4_window(conn, property_id, build_pre_window(used_days, first_full_post_day))

    gsc_delta = pct_change(gsc_current.get("clicks"), gsc_prior.get("clicks"))
    ga4_delta = pct_change(ga4_current.get("sessions"), ga4_prior.get("sessions"))
    value = fmt_delta_pct(gsc_current.get("clicks"), gsc_prior.get("clicks"))
    note = (
        f"GSC clicks {fmt_delta_pct(gsc_current.get('clicks'), gsc_prior.get('clicks'))}<br>"
        f"GA4 sessions {fmt_delta_pct(ga4_current.get('sessions'), ga4_prior.get('sessions'))}"
    )

    signals = [delta for delta in (gsc_delta, ga4_delta) if delta is not None]
    avg_signal = sum(signals) / len(signals) if signals else 0.0
    color = GREEN if avg_signal > 5 else RED if avg_signal < -5 else VENTERRA_BLUE
    return value, color, note


def build_property_impact(
    conn: sqlite3.Connection,
    intervention: CopyChangeIntervention,
    gsc_current_window: Window,
    gsc_prior_window: Window,
    ga4_current_window: Window,
    ga4_prior_window: Window,
) -> PropertyImpact:
    property_id = intervention.ga4_property_id
    canonical_name = intervention.property_name
    gsc_current = fetch_gsc_window(conn, property_id, gsc_current_window)
    gsc_prior = fetch_gsc_window(conn, property_id, gsc_prior_window)
    ga4_current = fetch_ga4_window(conn, property_id, ga4_current_window)
    ga4_prior = fetch_ga4_window(conn, property_id, ga4_prior_window)
    comparisons = [
        (gsc_current.get("impressions"), gsc_prior.get("impressions"), True),
        (gsc_current.get("clicks"), gsc_prior.get("clicks"), True),
        (gsc_current.get("ctr"), gsc_prior.get("ctr"), True),
        (ga4_current.get("sessions"), ga4_prior.get("sessions"), True),
        (ga4_current.get("engaged_sessions"), ga4_prior.get("engaged_sessions"), True),
        (ga4_current.get("conversions"), ga4_prior.get("conversions"), True),
    ]
    positives = 0
    negatives = 0
    for curr, prev, higher_is_better in comparisons:
        if curr is None or prev is None or curr == prev:
            continue
        improved = curr > prev if higher_is_better else curr < prev
        if improved:
            positives += 1
        else:
            negatives += 1

    shared_post_days = min(gsc_current.get("days") or 0, ga4_current.get("rows") or 0)
    if shared_post_days <= 0:
        headline, headline_color = "Pending", AMBER
    elif positives >= 4 and negatives <= 1:
        headline, headline_color = "Early Positive", GREEN
    elif negatives >= 4 and positives <= 1:
        headline, headline_color = "Early Softness", RED
    else:
        headline, headline_color = "Early Mixed", VENTERRA_BLUE

    change_summary = build_change_summary(intervention)
    return PropertyImpact(
        intervention_id=intervention.intervention_id,
        wave_id=intervention.wave_id,
        wave_name=intervention.wave_name,
        request_name=intervention.property_name,
        canonical_name=canonical_name,
        property_id=property_id,
        property_code=intervention.property_code,
        page_url=intervention.page_url,
        publish_timestamp=intervention.publish_timestamp,
        first_full_post_day=intervention.first_full_post_day,
        change_type=intervention.change_type,
        changed_fields=intervention.changed_fields,
        change_summary=change_summary,
        headline=headline,
        headline_color=headline_color,
        gsc_current=gsc_current,
        gsc_prior=gsc_prior,
        ga4_current=ga4_current,
        ga4_prior=ga4_prior,
    )


def format_publish_date(publish_timestamp: str) -> str:
    try:
        parsed = datetime.fromisoformat(publish_timestamp.replace("Z", "+00:00"))
    except ValueError:
        return publish_timestamp[:10]
    return parsed.strftime("%m/%d/%Y")


def join_human(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def human_changed_fields(changed_fields: tuple[str, ...]) -> str:
    fields = {item.strip().lower() for item in changed_fields if item.strip()}
    if "legacy_tracked_copy_update" in fields:
        return "legacy copy update"

    parts: list[str] = []
    if "hero" in fields or "upper_copy" in fields:
        parts.append("hero copy")
    if "romance" in fields:
        parts.append("romance copy")
    if "title" in fields and "meta" in fields:
        parts.append("title/meta")
    elif "title" in fields:
        parts.append("page title")
    elif "meta" in fields:
        parts.append("meta description")
    if "faq" in fields:
        parts.append("FAQ copy")
    if "cta" in fields:
        parts.append("CTA copy")
    if "og" in fields:
        parts.append("Open Graph metadata")

    known = {"hero", "upper_copy", "romance", "title", "meta", "faq", "cta", "og", "legacy_tracked_copy_update"}
    for field in changed_fields:
        normalized = field.strip().lower()
        if normalized and normalized not in known:
            parts.append(normalized.replace("_", " "))
    return join_human(parts) or "copy"


def build_change_summary(intervention: CopyChangeIntervention) -> str:
    summary_note = intervention.confounds.get("summary_note") if intervention.confounds else None
    if isinstance(summary_note, str) and summary_note.strip():
        return summary_note.strip()
    changed = human_changed_fields(intervention.changed_fields)
    date_label = format_publish_date(intervention.publish_timestamp)
    return f"Updated {changed} on {date_label}."


def trend_meta(curr: Optional[float], prev: Optional[float], higher_is_better: bool = True) -> tuple[str, str, str]:
    if curr is None or prev is None:
        return "N/A", MUTED, "N/A"
    if curr == prev:
        return "→", MUTED, "flat"
    improved = curr > prev if higher_is_better else curr < prev
    return ("↑", GREEN, "up") if improved else ("↓", RED, "down")


def readiness_status(available_days: int, needed_days: int) -> tuple[str, str]:
    if available_days >= needed_days:
        return "Live", GREEN
    return "Pending", AMBER


def build_exec_cards(impacts: list[PropertyImpact]) -> str:
    act_now = sum(1 for item in impacts if decision_value(item, "action") in {"Investigate", "Revise"})
    promising = sum(1 for item in impacts if decision_value(item, "action") in {"Hold", "Amplify"})
    watch = sum(1 for item in impacts if decision_value(item, "action") == "Watch")
    too_early = sum(1 for item in impacts if decision_value(item, "action") == "Too Early")
    card_width = 25

    def card(label: str, value: str, note: str, accent: str = VENTERRA_BLUE) -> str:
        return f"""
        <td style="width:{card_width:.2f}%;padding:8px;vertical-align:top;">
          <div style="background:#ffffff;border:1px solid #d9dee5;border-radius:6px;padding:18px 16px;text-align:center;">
            <div style="font-size:11px;color:{MUTED};text-transform:uppercase;font-weight:700;letter-spacing:0.3px;">{label}</div>
            <div style="font-size:30px;color:{accent};font-weight:700;margin-top:10px;">{value}</div>
            <div style="margin-top:8px;font-size:12px;color:{SLATE};line-height:1.45;">{note}</div>
          </div>
        </td>
        """

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
      <tr>
        {card("Act Now", f"{act_now}/{len(impacts)}", "Investigate or revise before treating the copy read as clean.", RED if act_now else VENTERRA_BLUE)}
        {card("Promising", f"{promising}/{len(impacts)}", "Hold or amplify patterns that are showing useful lift.", GREEN if promising else VENTERRA_BLUE)}
        {card("Watch", f"{watch}/{len(impacts)}", "Let the next milestone mature before changing copy.", AMBER if watch else VENTERRA_BLUE)}
        {card("Too Early", f"{too_early}/{len(impacts)}", "Registered, but not enough shared post-change history.", AMBER if too_early else VENTERRA_BLUE)}
      </tr>
    </table>
    """


def delta_label(label: str, curr: Optional[float], prev: Optional[float]) -> str:
    return f"{label} {fmt_delta_pct(curr, prev)}"


def build_window_maturity_note(item: PropertyImpact) -> str:
    shared_post_days = min(item.gsc_current.get("days") or 0, item.ga4_current.get("rows") or 0)
    if shared_post_days >= 30:
        return "Clean milestone reads live: T7, T14, and T30."
    if shared_post_days >= 14:
        return "Clean milestone reads live: T7 and T14; later read pending."
    if shared_post_days >= 7:
        return "Clean milestone read live: T7; later reads pending."
    if shared_post_days <= 0:
        return "Awaiting first shared post-change data."
    return "Milestone reads pending."


def build_at_glance_read(item: PropertyImpact) -> str:
    shared_post_days = min(item.gsc_current.get("days") or 0, item.ga4_current.get("rows") or 0)
    if shared_post_days <= 0:
        return "No shared post-change data yet."
    metrics = [
        delta_label("GSC clicks", item.gsc_current.get("clicks"), item.gsc_prior.get("clicks")),
        delta_label("CTR", item.gsc_current.get("ctr"), item.gsc_prior.get("ctr")),
        delta_label("GA4 sessions", item.ga4_current.get("sessions"), item.ga4_prior.get("sessions")),
        delta_label("conversions", item.ga4_current.get("conversions"), item.ga4_prior.get("conversions")),
    ]
    return f"Since change: {'; '.join(metrics)}. {build_window_maturity_note(item)}"


def safe_pct(value: Optional[float]) -> float:
    return value if value is not None else 0.0


def latest_unit_context(conn: sqlite3.Connection, item: PropertyImpact) -> dict:
    latest = conn.execute(
        """
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM unit_availability_units
        WHERE property_id = ?
        """,
        (item.property_id,),
    ).fetchone()["snapshot_date"]
    if not latest:
        return {"available": None, "special_units": None, "latest_date": None, "prior_available": None}

    current = conn.execute(
        """
        SELECT
            COUNT(*) AS available,
            SUM(CASE WHEN COALESCE(concession_amount, 0) > 0
                      OR COALESCE(pricing_and_specials_message, '') <> ''
                     THEN 1 ELSE 0 END) AS special_units
        FROM unit_availability_units
        WHERE property_id = ?
          AND snapshot_date = ?
        """,
        (item.property_id, latest),
    ).fetchone()
    prior = conn.execute(
        """
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM unit_availability_units
        WHERE property_id = ?
          AND snapshot_date < ?
        """,
        (item.property_id, item.first_full_post_day),
    ).fetchone()["snapshot_date"]
    prior_available = None
    if prior:
        prior_row = conn.execute(
            """
            SELECT COUNT(*) AS available
            FROM unit_availability_units
            WHERE property_id = ?
              AND snapshot_date = ?
            """,
            (item.property_id, prior),
        ).fetchone()
        prior_available = int(prior_row["available"] or 0)
    return {
        "available": int(current["available"] or 0),
        "special_units": int(current["special_units"] or 0),
        "latest_date": latest,
        "prior_available": prior_available,
    }


def latest_ads_context(conn: sqlite3.Connection, item: PropertyImpact) -> dict:
    row = conn.execute(
        """
        SELECT
            MAX(metric_date) AS latest_date,
            SUM(clicks) AS clicks,
            SUM(conversions) AS conversions
        FROM google_ads_campaigns
        WHERE property_id = ?
        """,
        (item.property_id,),
    ).fetchone()
    latest = row["latest_date"]
    stale = True
    if latest:
        stale = (date.today() - datetime.strptime(latest, "%Y-%m-%d").date()).days > 30
    return {
        "latest_date": latest,
        "clicks": int(row["clicks"] or 0) if latest else None,
        "conversions": float(row["conversions"] or 0) if latest else None,
        "stale": stale,
    }


def latest_onpage_context(conn: sqlite3.Connection, item: PropertyImpact) -> dict:
    row = conn.execute(
        """
        SELECT run_date, status_code, title_length, description_length
        FROM dataforseo_onpage_page_snapshots
        WHERE property_id IN (?, ?)
        ORDER BY run_date DESC, updated_at DESC
        LIMIT 1
        """,
        (item.property_code, item.property_id),
    ).fetchone()
    if not row:
        return {"latest_date": None}
    issues: list[str] = []
    if row["status_code"] and int(row["status_code"]) >= 400:
        issues.append(f"DataForSEO status {row['status_code']}")
    title_length = row["title_length"]
    description_length = row["description_length"]
    if title_length is not None and (int(title_length) < 30 or int(title_length) > 65):
        issues.append("title length review")
    if description_length is not None and (int(description_length) < 80 or int(description_length) > 170):
        issues.append("meta length review")
    return {
        "latest_date": row["run_date"],
        "status_code": row["status_code"],
        "title_length": title_length,
        "description_length": description_length,
        "issues": issues,
    }


def build_query_signal(conn: sqlite3.Connection, item: PropertyImpact) -> dict:
    current_window = Window(**item.gsc_current["window"])
    prior_window = Window(**item.gsc_prior["window"])
    current = aggregate_query_cohorts(fetch_gsc_query_window(conn, item.property_id, current_window), item)
    prior = aggregate_query_cohorts(fetch_gsc_query_window(conn, item.property_id, prior_window), item)

    def cohort_delta(name: str, metric: str) -> Optional[float]:
        return pct_change(current.get(name, {}).get(metric), prior.get(name, {}).get(metric))

    local_delta = cohort_delta("local_non_brand", "clicks")
    amenity_delta = cohort_delta("amenity_floorplan", "clicks")
    brand_delta = cohort_delta("brand", "clicks")
    nonbrand_clicks = sum(current.get(name, {}).get("clicks") or 0 for name in ("local_non_brand", "amenity_floorplan", "non_brand_other"))
    brand_clicks = current.get("brand", {}).get("clicks") or 0

    if nonbrand_clicks and (safe_pct(local_delta) > 0 or safe_pct(amenity_delta) > 0):
        label = "Nonbrand demand is contributing"
    elif brand_clicks and brand_clicks >= nonbrand_clicks:
        label = "Lift is mostly brand-led"
    elif nonbrand_clicks:
        label = "Nonbrand demand is present but not clearly improving"
    else:
        label = "Query mix is thin"

    return {
        "label": label,
        "brand_clicks": brand_clicks,
        "nonbrand_clicks": nonbrand_clicks,
        "brand_click_delta_pct": brand_delta,
        "local_nonbrand_click_delta_pct": local_delta,
        "amenity_click_delta_pct": amenity_delta,
    }


def compact_flags(flags: list[str], max_items: int = 3) -> str:
    if not flags:
        return "No major confound flagged."
    visible = flags[:max_items]
    extra = len(flags) - len(visible)
    suffix = f"; +{extra} more" if extra > 0 else ""
    return "; ".join(visible) + suffix


def build_decision_read(conn: sqlite3.Connection, item: PropertyImpact) -> dict:
    shared_post_days = min(item.gsc_current.get("days") or 0, item.ga4_current.get("rows") or 0)
    gsc_click_delta = pct_change(item.gsc_current.get("clicks"), item.gsc_prior.get("clicks"))
    impression_delta = pct_change(item.gsc_current.get("impressions"), item.gsc_prior.get("impressions"))
    ctr_delta = pct_change(item.gsc_current.get("ctr"), item.gsc_prior.get("ctr"))
    session_delta = pct_change(item.ga4_current.get("sessions"), item.ga4_prior.get("sessions"))
    conversion_delta = pct_change(item.ga4_current.get("conversions"), item.ga4_prior.get("conversions"))
    query_signal = build_query_signal(conn, item)
    units = latest_unit_context(conn, item)
    ads = latest_ads_context(conn, item)
    onpage = latest_onpage_context(conn, item)

    if shared_post_days < 7:
        confidence = "Too Early"
    elif shared_post_days < 14:
        confidence = "Directional"
    elif shared_post_days < 30:
        confidence = "Directional"
    else:
        confidence = "Reliable"

    flags: list[str] = []
    available = units.get("available")
    prior_available = units.get("prior_available")
    if available is None:
        flags.append("availability source missing")
    else:
        if available <= 3:
            flags.append(f"low inventory ({available} units)")
        if prior_available is not None and abs(available - prior_available) >= 5:
            direction = "up" if available > prior_available else "down"
            flags.append(f"inventory {direction} {abs(available - prior_available)} units")
        if units.get("special_units"):
            flags.append(f"{units['special_units']} units with specials")
    if not ads.get("latest_date"):
        flags.append("no Google Ads detail")
    elif ads.get("stale"):
        flags.append(f"Google Ads stale ({ads['latest_date']})")
    if onpage.get("issues"):
        flags.extend(onpage["issues"])

    driver = query_signal["label"]
    if impression_delta is not None and impression_delta > 10 and ctr_delta is not None and ctr_delta < -5:
        driver = "Visibility widened but click appeal softened"
    elif gsc_click_delta is not None and gsc_click_delta > 10 and session_delta is not None and session_delta < -5:
        driver = "Search clicks improved but sessions did not follow"
    elif session_delta is not None and session_delta > 10 and conversion_delta is not None and conversion_delta < -10:
        driver = "Organic traffic improved but conversion quality softened"

    if confidence == "Too Early":
        action = "Too Early"
        recommendation = "Hold changes and wait for the first clean T7 read before interpreting performance."
    elif item.headline == "Early Positive" and (session_delta is None or session_delta >= -5) and (conversion_delta is None or conversion_delta >= -10):
        action = "Amplify" if shared_post_days >= 14 else "Hold"
        recommendation = "Keep the copy live; if the T14/T30 read holds, reuse the title/meta and upper-copy pattern on similar spotlight pages."
    elif item.headline == "Early Softness":
        action = "Revise" if shared_post_days >= 30 else "Investigate"
        recommendation = "Audit query mix, title CTR, availability/specials, and page health before changing copy again."
    elif gsc_click_delta is not None and gsc_click_delta < -10 and session_delta is not None and session_delta > 5:
        action = "Watch"
        recommendation = "Do not rewrite yet; traffic quality may be holding while search demand is noisy."
    elif session_delta is not None and session_delta < -10:
        action = "Investigate"
        recommendation = "Check whether the new search promise matches on-page proof, current specials, and available floor plans."
    else:
        action = "Watch"
        recommendation = "Let the next milestone read mature; look for nonbrand query lift before borrowing this pattern."

    if flags and action in {"Hold", "Amplify"} and confidence != "Too Early":
        recommendation = "Keep the copy live, but separate copy impact from the flagged confounds before scaling the pattern."

    return {
        "action": action,
        "confidence": confidence,
        "driver": driver,
        "recommendation": recommendation,
        "watch_flags": flags,
        "watch_flags_label": compact_flags(flags),
        "query_signal": query_signal,
        "supporting_context": {
            "unit_availability": units,
            "google_ads": ads,
            "dataforseo_onpage": onpage,
        },
    }


def decision_value(item: PropertyImpact, key: str, default: str = "Pending") -> str:
    if not item.decision:
        return default
    return str(item.decision.get(key) or default)


def build_compact_metrics_strip(item: PropertyImpact) -> str:
    shared_post_days = min(item.gsc_current.get("days") or 0, item.ga4_current.get("rows") or 0)
    since_change_note = (
        f"GSC clicks {fmt_delta_pct(item.gsc_current.get('clicks'), item.gsc_prior.get('clicks'))}<br>"
        f"GA4 sessions {fmt_delta_pct(item.ga4_current.get('sessions'), item.ga4_prior.get('sessions'))}"
    )

    def chip(label: str, value: str, note: str, value_color: str = BODY) -> str:
        return f"""
        <td style="padding:4px;vertical-align:top;">
          <div style="background:#ffffff;border:1px solid #d9dee5;border-radius:6px;padding:8px 10px;min-height:50px;">
            <div style="font-size:9px;color:{MUTED};text-transform:uppercase;font-weight:700;letter-spacing:0.3px;">{label}</div>
            <div style="font-size:15px;color:{value_color};font-weight:700;margin-top:5px;line-height:1.15;">{value}</div>
            <div style="font-size:10px;color:{SLATE};line-height:1.35;margin-top:5px;">{note}</div>
          </div>
        </td>
        """

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        t7_value, t7_color, t7_note = summarize_window(
            conn,
            item.property_id,
            item.gsc_current["window"]["end"],
            item.ga4_current["window"]["end"],
            7,
            item.gsc_current.get("days") or 0,
            item.ga4_current.get("rows") or 0,
            item.first_full_post_day,
        )
        t14_value, t14_color, t14_note = summarize_window(
            conn,
            item.property_id,
            item.gsc_current["window"]["end"],
            item.ga4_current["window"]["end"],
            14,
            item.gsc_current.get("days") or 0,
            item.ga4_current.get("rows") or 0,
            item.first_full_post_day,
        )
        t30_value, t30_color, t30_note = summarize_window(
            conn,
            item.property_id,
            item.gsc_current["window"]["end"],
            item.ga4_current["window"]["end"],
            30,
            item.gsc_current.get("days") or 0,
            item.ga4_current.get("rows") or 0,
            item.first_full_post_day,
        )
    finally:
        conn.close()

    t30_label = t30_value
    t30_note = t30_note if shared_post_days >= 30 else "Awaiting full window"

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <tr>
        {chip("Since Change", f"GSC D{item.gsc_current.get('days') or 0}<br>GA4 D{item.ga4_current.get('rows') or 0}", since_change_note)}
        {chip("T7 Window", t7_value, t7_note, t7_color)}
        {chip("T14 Window", t14_value, t14_note, t14_color)}
        {chip("T30 Window", t30_label, t30_note, t30_color)}
      </tr>
    </table>
    """


def build_bottom_notes(impacts: list[PropertyImpact], gsc_latest: date, ga4_latest: date) -> str:
    positive_count = sum(1 for item in impacts if item.headline == "Early Positive")
    mixed_count = sum(1 for item in impacts if item.headline == "Early Mixed")
    soft_count = sum(1 for item in impacts if item.headline == "Early Softness")
    pending_count = sum(1 for item in impacts if item.headline == "Pending")
    act_now = sum(1 for item in impacts if decision_value(item, "action") in {"Investigate", "Revise"})
    promising = sum(1 for item in impacts if decision_value(item, "action") in {"Hold", "Amplify"})
    property_count = len(impacts)
    gsc_days = max(((item.gsc_current.get("days") or 0) for item in impacts), default=0)
    ga4_days = max(((item.ga4_current.get("rows") or 0) for item in impacts), default=0)
    pending_sentence = (
        f" <strong>{pending_count}/{property_count} Pending</strong> awaiting first shared post-change data."
        if pending_count
        else ""
    )
    return f"""
    <div style="margin-top:22px;border:1px solid #d9dee5;border-radius:6px;background:#ffffff;padding:18px;">
      <div style="font-size:11px;color:{MUTED};text-transform:uppercase;font-weight:700;letter-spacing:0.3px;">Brief</div>
      <div style="margin-top:8px;font-size:14px;line-height:1.7;color:{BODY};">
        This read is now decision-led: <strong>{act_now}/{property_count} need action</strong> and
        <strong>{promising}/{property_count} are promising enough to hold or amplify</strong>.
        The underlying evidence mix is <strong>{positive_count}/{property_count} Early Positive</strong>,
        <strong>{mixed_count}/{property_count} Early Mixed</strong>, and <strong>{soft_count}/{property_count} Early Softness</strong>.{pending_sentence}
        Since-change movement is live now, while milestone reads stay pending until enough shared post-change history exists.
      </div>
      <div style="margin-top:16px;font-size:11px;color:{MUTED};text-transform:uppercase;font-weight:700;letter-spacing:0.3px;">Notes</div>
      <ul style="margin:8px 0 0 18px;padding:0;font-size:13px;line-height:1.65;color:{SLATE};">
        <li>Each intervention uses the first full day after the publish timestamp as its post-change start.</li>
        <li>Current canonical depth in this brief is up to GSC D{gsc_days} through {gsc_latest.isoformat()} and GA4 D{ga4_days} through {ga4_latest.isoformat()}.</li>
        <li>Milestone read labels appear only after each intervention has enough shared post-change history to support a clean read.</li>
      </ul>
    </div>
    """


def build_portfolio_decision_summary(impacts: list[PropertyImpact]) -> str:
    action_groups: dict[str, list[str]] = {"Investigate": [], "Revise": [], "Amplify": [], "Hold": [], "Watch": [], "Too Early": []}
    drivers: dict[str, int] = {}
    for item in impacts:
        action = decision_value(item, "action")
        action_groups.setdefault(action, []).append(item.request_name)
        driver = decision_value(item, "driver", "")
        if driver:
            drivers[driver] = drivers.get(driver, 0) + 1

    act_now = action_groups.get("Revise", []) + action_groups.get("Investigate", [])
    promising = action_groups.get("Amplify", []) + action_groups.get("Hold", [])
    watch = action_groups.get("Watch", [])
    pattern_line = "No dominant repeat pattern yet."
    if drivers:
        top_driver, top_count = sorted(drivers.items(), key=lambda kv: (-kv[1], kv[0]))[0]
        pattern_line = f"Most common driver: {html.escape(top_driver)} ({top_count} properties)."

    def names(items: list[str]) -> str:
        if not items:
            return "None"
        shown = ", ".join(html.escape(name) for name in items[:4])
        if len(items) > 4:
            shown += f", +{len(items) - 4} more"
        return shown

    return f"""
    <div style="margin-top:14px;border:1px solid #d9dee5;border-radius:6px;background:#ffffff;padding:14px 16px;">
      <div style="font-size:11px;color:{MUTED};text-transform:uppercase;font-weight:700;letter-spacing:0.3px;">Executive Read</div>
      <div style="margin-top:7px;font-size:13px;line-height:1.6;color:{BODY};">
        <strong>Act now:</strong> {names(act_now)}<br>
        <strong>Promising:</strong> {names(promising)}<br>
        <strong>Watch:</strong> {names(watch)}<br>
        <strong>Pattern:</strong> {pattern_line}
      </div>
    </div>
    """


def build_property_card(item: PropertyImpact) -> str:
    change_summary = html.escape(item.change_summary)
    source_depth = f"GSC D{item.gsc_current.get('days') or 0}; GA4 D{item.ga4_current.get('rows') or 0}"
    action = html.escape(decision_value(item, "action"))
    confidence = html.escape(decision_value(item, "confidence"))
    driver = html.escape(decision_value(item, "driver", "Awaiting clean signal."))
    recommendation = html.escape(decision_value(item, "recommendation", "Hold until more data is available."))
    watch_flags = html.escape(decision_value(item, "watch_flags_label", "No major confound flagged."))
    return f"""
    <div style="margin-top:12px;border:1px solid #d9dee5;border-radius:6px;background:#ffffff;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:20px;font-weight:700;color:{VENTERRA_BLUE};line-height:1.15;">{item.request_name}</div>
          <div style="margin-top:5px;font-size:12px;color:{SLATE};line-height:1.45;">Post-change start {item.first_full_post_day}; {source_depth}</div>
        </div>
      </div>
      <div style="margin-top:10px;font-size:13px;color:{BODY};line-height:1.55;">
        <strong>{change_summary}</strong>
      </div>
      <div style="margin-top:8px;">
        <div style="display:inline-block;padding:5px 10px;border:1px solid #d9dee5;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;color:{item.headline_color};background:#ffffff;white-space:nowrap;">{item.headline}</div>
      </div>
      <div style="margin-top:8px;border-left:3px solid {item.headline_color};padding:8px 10px;background:#f8fafc;">
        <div style="font-size:12px;color:{BODY};line-height:1.45;"><strong>Action: {action}</strong> <span style="color:{MUTED};">({confidence})</span> - {driver}</div>
        <div style="font-size:12px;color:{SLATE};line-height:1.45;margin-top:3px;">Next: {recommendation}</div>
        <div style="font-size:11px;color:{MUTED};line-height:1.4;margin-top:3px;">Watch: {watch_flags}</div>
      </div>
      {build_compact_metrics_strip(item)}
        </div>
    """


def build_html(impacts: list[PropertyImpact], gsc_latest: date, ga4_latest: date) -> str:
    generated = datetime.now().strftime("%B %d, %Y %I:%M %p")
    logo = get_logo_html() or ""
    body_html = f"""
    <div style="font-family:Arial,sans-serif;color:{BODY};">
      {build_exec_cards(impacts)}
      {build_portfolio_decision_summary(impacts)}
      {''.join(build_property_card(item) for item in impacts)}
      {build_bottom_notes(impacts, gsc_latest, ga4_latest)}
    </div>
    """
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px;margin:0 auto;background:#ffffff;">
<tr><td style="padding:28px 24px;">
{logo}
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:18px;">
  <tr><td style="text-align:center;">
    <div style="color:{VENTERRA_BLUE};font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Property Intelligence</div>
    <h1 style="margin:8px 0 6px 0;color:{VENTERRA_BLUE};font-size:30px;line-height:1.2;">Copy Change Impact Brief</h1>
    <div style="color:#6c757d;font-size:14px;">Daily quick read for active copy-change waves; Template v{REPORT_TEMPLATE_VERSION}; Generated {generated}</div>
  </td></tr>
</table>
{body_html}
<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;font-style:italic;text-align:center;">
PIB-style copy-change impact brief v{REPORT_TEMPLATE_VERSION} generated from canonical GSC and GA4 organic search data.
</div>
</td></tr></table>
</body>
</html>"""


def build_plain_text(impacts: list[PropertyImpact], gsc_latest: date, ga4_latest: date) -> str:
    lines = [
        "Copy Change Impact Brief",
        f"GSC current day: {gsc_latest.isoformat()}",
        f"GA4 current day: {ga4_latest.isoformat()}",
        "",
    ]
    for item in impacts:
        lines.append(
            f"- {item.request_name}: "
            f"{decision_value(item, 'action')} / {decision_value(item, 'confidence')}. "
            f"{decision_value(item, 'driver', 'Awaiting clean signal.')}. "
            f"Next: {decision_value(item, 'recommendation', 'Hold until more data is available.')} "
            f"{build_at_glance_read(item)}"
        )
    return "\n".join(lines)


def parse_sortable_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min


def dedupe_interventions_latest(interventions: list[CopyChangeIntervention]) -> list[CopyChangeIntervention]:
    """Keep one visible report card per property, preferring the latest active intervention."""
    selected: dict[str, CopyChangeIntervention] = {}
    order: list[str] = []
    for intervention in interventions:
        key = (intervention.property_code or intervention.ga4_property_id or intervention.property_name).lower()
        current = selected.get(key)
        if current is None:
            selected[key] = intervention
            order.append(key)
            continue
        current_sort = (
            parse_sortable_timestamp(current.publish_timestamp),
            current.first_full_post_day,
            current.wave_id,
        )
        candidate_sort = (
            parse_sortable_timestamp(intervention.publish_timestamp),
            intervention.first_full_post_day,
            intervention.wave_id,
        )
        if candidate_sort > current_sort:
            selected[key] = intervention
    return [selected[key] for key in order]


def build_filter_identity_keys(property_filters: list[str]) -> set[str]:
    keys = {item.lower() for item in property_filters}
    for item in property_filters:
        identity = resolve_property_identity(item)
        if not identity:
            continue
        for value in (
            identity.property_name,
            identity.property_code,
            identity.ga4_property_id,
            identity.canonical_property_id,
            identity.community_id,
            identity.website_url,
            *identity.aliases,
        ):
            if value:
                keys.add(str(value).lower())
    return keys


def intervention_matches_filter(intervention: CopyChangeIntervention, wanted: set[str]) -> bool:
    values = {
        intervention.property_name,
        intervention.property_code,
        intervention.ga4_property_id,
        intervention.canonical_property_id,
        intervention.community_id,
        intervention.page_url,
    }
    return any(str(value).lower() in wanted for value in values if value)


def normalized_words(value: str) -> set[str]:
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in value)
    stop = {"the", "at", "and", "apartments", "apartment", "homes", "home"}
    return {word for word in cleaned.split() if len(word) >= 4 and word not in stop}


def query_cohort(query: str, impact: PropertyImpact) -> str:
    text = query.lower()
    brand_tokens = normalized_words(impact.canonical_name)
    if any(token in text for token in brand_tokens):
        return "brand"
    if any(term in text for term in ("bedroom", "studio", "floor plan", "floorplan", "washer", "dryer", "garage", "pet", "dog", "pool")):
        return "amenity_floorplan"
    if any(term in text for term in ("near me", " tx", " fl", " ar", " ky", "league city", "bentonville", "daytona", "katy", "clear lake", "kemah")):
        return "local_non_brand"
    return "non_brand_other"


def aggregate_query_cohorts(rows: list[dict], impact: PropertyImpact) -> dict[str, dict]:
    cohorts: dict[str, dict] = {}
    for row in rows:
        cohort = query_cohort(row["query"], impact)
        bucket = cohorts.setdefault(
            cohort,
            {"clicks": 0, "impressions": 0, "position_weighted_sum": 0.0, "position_weight": 0},
        )
        impressions = row.get("impressions") or 0
        bucket["clicks"] += row.get("clicks") or 0
        bucket["impressions"] += impressions
        if row.get("position") is not None and impressions:
            bucket["position_weighted_sum"] += row["position"] * impressions
            bucket["position_weight"] += impressions
    for bucket in cohorts.values():
        impressions = bucket["impressions"]
        bucket["ctr"] = (100.0 * bucket["clicks"] / impressions) if impressions else None
        bucket["position"] = (
            bucket["position_weighted_sum"] / bucket["position_weight"]
            if bucket["position_weight"]
            else None
        )
    return cohorts


def record_gsc_query_cohort_observations(conn: sqlite3.Connection, impact: PropertyImpact, observation_date: str) -> None:
    current_window = Window(**impact.gsc_current["window"])
    prior_window = Window(**impact.gsc_prior["window"])
    current = aggregate_query_cohorts(fetch_gsc_query_window(conn, impact.property_id, current_window), impact)
    prior = aggregate_query_cohorts(fetch_gsc_query_window(conn, impact.property_id, prior_window), impact)
    for cohort in sorted(set(current) | set(prior)):
        current_bucket = current.get(cohort, {})
        prior_bucket = prior.get(cohort, {})
        for metric_name in ("clicks", "impressions", "ctr", "position"):
            store_observation(
                conn,
                intervention_id=impact.intervention_id,
                observation_date=observation_date,
                window_label="since_change",
                metric_source="gsc_queries",
                metric_scope=f"query_cohort:{cohort}",
                metric_name=metric_name,
                current_value=current_bucket.get(metric_name),
                prior_value=prior_bucket.get(metric_name),
                current_window_start=current_window.start,
                current_window_end=current_window.end,
                prior_window_start=prior_window.start,
                prior_window_end=prior_window.end,
                evidence={
                    "cohort": cohort,
                    "wave_id": impact.wave_id,
                    "property_code": impact.property_code,
                    "property_id": impact.property_id,
                    "classification": "heuristic_v1",
                },
            )


def record_metric_observations(conn: sqlite3.Connection, impact: PropertyImpact, observation_date: str) -> None:
    windows = [
        (
            "since_change",
            impact.gsc_current,
            impact.gsc_prior,
            "gsc",
            "property_aggregate",
            {
                "clicks": "clicks",
                "impressions": "impressions",
                "ctr": "ctr",
                "average_position": "position",
            },
        ),
        (
            "since_change",
            impact.ga4_current,
            impact.ga4_prior,
            "ga4",
            "organic_search_property_aggregate",
            {
                "sessions": "sessions",
                "engaged_sessions": "engaged_sessions",
                "conversions": "conversions",
                "new_users": "new_users",
                "total_users": "total_users",
                "engagement_rate": "engagement_rate",
                "conversion_rate": "conversion_rate",
            },
        ),
    ]
    for window_label, current, prior, source, scope, metrics in windows:
        for metric_name, key in metrics.items():
            store_observation(
                conn,
                intervention_id=impact.intervention_id,
                observation_date=observation_date,
                window_label=window_label,
                metric_source=source,
                metric_scope=scope,
                metric_name=metric_name,
                current_value=current.get(key),
                prior_value=prior.get(key),
                current_window_start=current["window"]["start"],
                current_window_end=current["window"]["end"],
                prior_window_start=prior["window"]["start"],
                prior_window_end=prior["window"]["end"],
                evidence={
                    "wave_id": impact.wave_id,
                    "property_code": impact.property_code,
                    "property_id": impact.property_id,
                    "page_url": impact.page_url,
                    "change_type": impact.change_type,
                    "changed_fields": list(impact.changed_fields),
                },
            )
    record_gsc_query_cohort_observations(conn, impact, observation_date)


def generate_report(
    property_filters: list[str] | None = None,
    wave_ids: list[str] | None = None,
) -> tuple[Path, Path, list[PropertyImpact], date, date]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=30000")
    write_limited = False
    write_warnings: list[str] = []
    try:
        try:
            ensure_copy_change_schema(conn)
            seed_april_17_wave(conn)
        except sqlite3.OperationalError as exc:
            if "locked" not in str(exc).lower():
                raise
            write_limited = True
            write_warnings.append("Copy-change registry writes skipped because the local database was locked.")
            conn.rollback()
        gsc_latest, ga4_latest = get_latest_dates(conn)
        interventions = list_interventions(conn, wave_ids=wave_ids)
        if property_filters:
            wanted = build_filter_identity_keys(property_filters)
            interventions = [
                item
                for item in interventions
                if intervention_matches_filter(item, wanted)
            ]
        interventions = dedupe_interventions_latest(interventions)
        impacts: list[PropertyImpact] = []
        for intervention in interventions:
            post_start = datetime.strptime(intervention.first_full_post_day, "%Y-%m-%d").date()
            gsc_current_window, gsc_prior_window, ga4_current_window, ga4_prior_window = build_windows_for_post_start(
                gsc_latest,
                ga4_latest,
                post_start,
            )
            impact = build_property_impact(
                conn,
                intervention,
                gsc_current_window,
                gsc_prior_window,
                ga4_current_window,
                ga4_prior_window,
            )
            impact.decision = build_decision_read(conn, impact)
            impacts.append(impact)
        observation_date = datetime.now().date().isoformat()
        if not write_limited:
            try:
                for impact in impacts:
                    record_metric_observations(conn, impact, observation_date)
                conn.commit()
            except sqlite3.OperationalError as exc:
                if "locked" not in str(exc).lower():
                    raise
                write_limited = True
                write_warnings.append("Observation writes skipped because the local database was locked.")
                conn.rollback()
    finally:
        conn.close()

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = REPORT_DIR / f"copy_change_impact_brief_{ts}.html"
    json_path = REPORT_DIR / f"copy_change_impact_brief_{ts}.json"

    html_path.write_text(
        build_html(impacts, gsc_latest, ga4_latest),
        encoding="utf-8",
    )
    json_path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now().isoformat(),
                "schema_version": REPORT_SCHEMA_VERSION,
                "template_version": REPORT_TEMPLATE_VERSION,
                "write_limited": write_limited,
                "write_warnings": write_warnings,
                "gsc_latest": gsc_latest.isoformat(),
                "ga4_latest": ga4_latest.isoformat(),
                "active_wave_ids": sorted({item.wave_id for item in impacts}),
                "properties": [
                    {
                        "intervention_id": item.intervention_id,
                        "wave_id": item.wave_id,
                        "wave_name": item.wave_name,
                        "request_name": item.request_name,
                        "canonical_name": item.canonical_name,
                        "property_id": item.property_id,
                        "property_code": item.property_code,
                        "page_url": item.page_url,
                        "publish_timestamp": item.publish_timestamp,
                        "first_full_post_day": item.first_full_post_day,
                        "change_type": item.change_type,
                        "changed_fields": list(item.changed_fields),
                        "change_summary": item.change_summary,
                        "headline": item.headline,
                        "headline_color": item.headline_color,
                        "decision": item.decision,
                        "gsc_current": item.gsc_current,
                        "gsc_prior": item.gsc_prior,
                        "ga4_current": item.ga4_current,
                        "ga4_prior": item.ga4_prior,
                    }
                    for item in impacts
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return html_path, json_path, impacts, gsc_latest, ga4_latest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send PIB-style copy change impact brief.")
    parser.add_argument("--properties", help="Comma-separated property names.")
    parser.add_argument("--wave-ids", help="Comma-separated copy-change wave ids to include.")
    parser.add_argument("--recipients", help="Comma-separated recipient list.")
    parser.add_argument("--attach-json", action="store_true", help="Attach the report JSON to the email.")
    parser.add_argument("--no-send", action="store_true", help="Generate artifacts without emailing.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    property_filters = [item.strip() for item in args.properties.split(",") if item.strip()] if args.properties else None
    wave_ids = [item.strip() for item in args.wave_ids.split(",") if item.strip()] if args.wave_ids else None
    recipients = [item.strip() for item in args.recipients.split(",") if item.strip()] if args.recipients else None

    html_path, json_path, impacts, gsc_latest, ga4_latest = generate_report(property_filters, wave_ids)

    if not args.no_send:
        sender = EmailSender(verbose=True)
        attachments = [(json_path.name, json_path.read_bytes(), "application/json")] if args.attach_json else None
        sender.send_email(
            subject=f"Copy Change Impact Brief - {datetime.now().strftime('%Y-%m-%d')}",
            html_body=html_path.read_text(encoding="utf-8"),
            plain_text=build_plain_text(
                impacts,
                gsc_latest,
                ga4_latest,
            ),
            recipients=recipients,
            attachments=attachments,
        )

    print(f"HTML: {html_path}")
    print(f"JSON: {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
