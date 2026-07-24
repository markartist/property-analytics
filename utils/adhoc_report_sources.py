#!/usr/bin/env python3
"""Source registry for governed ad hoc executive reports."""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import warnings
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from outlook_report_builder import OutlookReport, ReportKpi, ReportSection, ReportTable


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
PILOT_CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"

sys.path.insert(0, str(ROOT))
from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402


@dataclass(frozen=True)
class ReportRequest:
    subject: str
    report_type: str = "auto"
    period: str = "trailing_30_days"
    start_date: str | None = None
    end_date: str | None = None
    scope: str = "portfolio"
    include_workbook: bool = True


@dataclass(frozen=True)
class ReportBuild:
    report_type: str
    report: OutlookReport
    workbook_sheets: dict[str, list[dict[str, object]]]
    spec: dict[str, object]


def parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def fmt_date(value: date | str) -> str:
    if isinstance(value, str):
        value = parse_iso_date(value)
    return value.strftime("%m/%d/%Y")


def fmt_date_range(start: date, end: date) -> str:
    return f"{fmt_date(start)} through {fmt_date(end)}"


def fmt_generated_at() -> str:
    now = datetime.now()
    return now.strftime("%m/%d/%Y %-I:%M %p").replace(" 0", " ")


def fmt_num(value: Any, decimals: int = 0) -> str:
    if value is None:
        return "-"
    return f"{float(value):,.{decimals}f}"


def fmt_pct(value: Any, decimals: int = 1) -> str:
    if value is None:
        return "-"
    return f"{float(value) * 100:,.{decimals}f}%"


def fmt_pp(value: Any, decimals: int = 1) -> str:
    if value is None:
        return "-"
    return f"{float(value) * 100:+,.{decimals}f} pts"


def fmt_duration_seconds(value: Any) -> str:
    if value is None:
        return "-"
    seconds = float(value)
    minutes = int(seconds // 60)
    remainder = int(round(seconds % 60))
    if minutes:
        return f"{minutes}m {remainder:02d}s"
    return f"{remainder}s"


def resolve_date_window(conn: sqlite3.Connection, request: ReportRequest) -> tuple[date, date, str]:
    if request.start_date and request.end_date:
        start = parse_iso_date(request.start_date)
        end = parse_iso_date(request.end_date)
        return start, end, fmt_date_range(start, end)

    row = conn.execute("SELECT MAX(metric_date) FROM ga4_daily_metrics WHERE sessions IS NOT NULL").fetchone()
    if not row or not row[0]:
        raise RuntimeError("No GA4 daily metrics are available.")
    end = parse_iso_date(str(row[0]))
    days_by_period = {
        "trailing_7_days": 7,
        "trailing_30_days": 30,
        "trailing_90_days": 90,
        "trailing_12_months": 365,
        "trailing_24_months": 730,
    }
    days = days_by_period.get(request.period, 30)
    start = end - timedelta(days=days - 1)
    return start, end, fmt_date_range(start, end)


def classify_report_type(request: ReportRequest) -> str:
    if request.report_type and request.report_type != "auto":
        return request.report_type
    subject = request.subject.lower()
    if (
        "property intel pack" in subject
        or "content intelligence" in subject
        or "content pack" in subject
        or "research pack" in subject
    ):
        return "content_intelligence_pack"
    if "content manager" in subject or "content workup" in subject or "workup" in subject:
        return "content_manager_workup"
    if (
        "zillow" in subject
        or "apartments.com" in subject
        or "ils" in subject
        or "direct-start" in subject
        or "direct traffic" in subject
        or ("where" in subject and "search" in subject and "apartment" in subject)
    ):
        return "ils_search_behavior"
    if "organic" in subject and "search" in subject:
        return "organic_search_share"
    if "traffic" in subject or "sessions" in subject or "channel" in subject:
        return "ga4_traffic_summary"
    raise ValueError(
        "This preliminary ad hoc registry cannot resolve that subject yet. "
        "Supported report types: organic_search_share, ga4_traffic_summary, ils_search_behavior, "
        "content_manager_workup, content_intelligence_pack."
    )


def load_portfolio_properties() -> list[dict[str, str]]:
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    properties: list[dict[str, str]] = []
    for row in payload.get("properties", []):
        ga4 = row.get("ga4_property_id")
        if not ga4 or row.get("property_type") == "new_development":
            continue
        identity = resolve_property_identity(str(ga4)) or resolve_property_identity(str(row.get("name", "")))
        properties.append(
            {
                "property_id": str(ga4),
                "property_name": (identity.property_name if identity else row.get("name")) or str(ga4),
                "property_code": (identity.property_code if identity else "") or "",
            }
        )
    return sorted(properties, key=lambda item: item["property_name"])


def resolve_scoped_properties(request: ReportRequest) -> tuple[list[dict[str, str]], str]:
    properties = load_portfolio_properties()
    scope = (request.scope or "portfolio").strip()
    if not scope or scope.lower() == "portfolio":
        return properties, "Portfolio"

    scoped: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw_part in scope.replace(";", ",").split(","):
        part = raw_part.strip()
        if not part:
            continue
        identity = resolve_property_identity(part)
        property_id = identity.ga4_property_id if identity else ""
        if not property_id:
            lowered = part.lower()
            matched = next(
                (
                    prop
                    for prop in properties
                    if lowered
                    in {
                        prop["property_id"].lower(),
                        prop["property_name"].lower(),
                        prop["property_code"].lower(),
                    }
                ),
                None,
            )
            if not matched:
                raise ValueError(f"Could not resolve report scope to a governed property: {part}")
            property_id = matched["property_id"]
        prop = next((item for item in properties if item["property_id"] == str(property_id)), None)
        if not prop:
            raise ValueError(f"Resolved property is not in the governed portfolio registry: {part}")
        if prop["property_id"] not in seen:
            scoped.append(prop)
            seen.add(prop["property_id"])

    if not scoped:
        raise ValueError(f"Could not resolve report scope: {scope}")
    label = scoped[0]["property_name"] if len(scoped) == 1 else f"{len(scoped)} Selected Properties"
    return scoped, label


def placeholders(items: list[str]) -> str:
    return ",".join("?" for _ in items)


def fetch_share_summary(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> dict[str, Any]:
    ph = placeholders(property_ids)
    row = conn.execute(
        f"""
        WITH total AS (
          SELECT SUM(sessions) AS total_sessions, SUM(new_users) AS total_new_users
          FROM ga4_daily_metrics
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        ),
        organic AS (
          SELECT SUM(sessions) AS organic_sessions, SUM(new_users) AS organic_new_users
          FROM ga4_traffic_sources
          WHERE property_id IN ({ph}) AND channel_group = 'Organic Search' AND metric_date BETWEEN ? AND ?
        )
        SELECT
          total.total_sessions,
          total.total_new_users,
          COALESCE(organic.organic_sessions, 0) AS organic_sessions,
          COALESCE(organic.organic_new_users, 0) AS organic_new_users,
          CASE WHEN total.total_sessions > 0 THEN CAST(COALESCE(organic.organic_sessions, 0) AS REAL) / total.total_sessions END AS organic_share,
          CASE WHEN total.total_new_users > 0 THEN CAST(COALESCE(organic.organic_new_users, 0) AS REAL) / total.total_new_users END AS organic_new_user_share
        FROM total CROSS JOIN organic
        """,
        (*property_ids, start.isoformat(), end.isoformat(), *property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    return dict(row or {})


def build_property_organic_rows(conn: sqlite3.Connection, properties: list[dict[str, str]], start: date, end: date) -> list[dict[str, object]]:
    property_ids = [item["property_id"] for item in properties]
    name_map = {item["property_id"]: item for item in properties}
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        WITH total AS (
          SELECT property_id, SUM(sessions) AS total_sessions, SUM(new_users) AS total_new_users
          FROM ga4_daily_metrics
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY property_id
        ),
        organic AS (
          SELECT property_id, SUM(sessions) AS organic_sessions, SUM(new_users) AS organic_new_users
          FROM ga4_traffic_sources
          WHERE property_id IN ({ph}) AND channel_group = 'Organic Search' AND metric_date BETWEEN ? AND ?
          GROUP BY property_id
        )
        SELECT
          total.property_id,
          total.total_sessions,
          COALESCE(organic.organic_sessions, 0) AS organic_sessions,
          CASE WHEN total.total_sessions > 0 THEN CAST(COALESCE(organic.organic_sessions, 0) AS REAL) / total.total_sessions END AS organic_share,
          total.total_new_users,
          COALESCE(organic.organic_new_users, 0) AS organic_new_users,
          CASE WHEN total.total_new_users > 0 THEN CAST(COALESCE(organic.organic_new_users, 0) AS REAL) / total.total_new_users END AS organic_new_user_share
        FROM total
        LEFT JOIN organic ON organic.property_id = total.property_id
        ORDER BY organic_share DESC
        """,
        (*property_ids, start.isoformat(), end.isoformat(), *property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    output: list[dict[str, object]] = []
    for rank, row in enumerate(rows, start=1):
        prop = name_map[str(row["property_id"])]
        output.append(
            {
                "rank": rank,
                "property": prop["property_name"],
                "property_code": prop["property_code"],
                "organic_share": fmt_pct(row["organic_share"]),
                "organic_sessions": fmt_num(row["organic_sessions"]),
                "total_sessions": fmt_num(row["total_sessions"]),
                "organic_new_user_share": fmt_pct(row["organic_new_user_share"]),
            }
        )
    return output


def load_pilot_pairs() -> list[dict[str, str]]:
    if not PILOT_CONFIG_PATH.exists():
        return []
    payload = json.loads(PILOT_CONFIG_PATH.read_text(encoding="utf-8"))
    cohorts = {item["key"]: item for item in payload.get("cohorts", []) if item.get("active")}
    pairs: list[dict[str, str]] = []
    for pilot in [item for item in cohorts.values() if item.get("role") == "pilot"]:
        control = cohorts.get(str(pilot.get("sister_key")))
        if not control:
            continue
        pilot_identity = resolve_property_identity(str(pilot["property_id"])) or resolve_property_identity(str(pilot["display_name"]))
        control_identity = resolve_property_identity(str(control["property_id"])) or resolve_property_identity(str(control["display_name"]))
        pairs.append(
            {
                "pilot_id": str(pilot["property_id"]),
                "pilot": pilot_identity.property_name if pilot_identity else str(pilot["display_name"]),
                "control_id": str(control["property_id"]),
                "control": control_identity.property_name if control_identity else str(control["display_name"]),
            }
        )
    return sorted(pairs, key=lambda item: item["pilot"])


def build_pilot_organic_rows(conn: sqlite3.Connection, start: date, end: date) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for pair in load_pilot_pairs():
        pilot = fetch_share_summary(conn, [pair["pilot_id"]], start, end)
        control = fetch_share_summary(conn, [pair["control_id"]], start, end)
        gap = None
        if pilot.get("organic_share") is not None and control.get("organic_share") is not None:
            gap = float(pilot["organic_share"]) - float(control["organic_share"])
        rows.append(
            {
                "pilot": pair["pilot"],
                "control": pair["control"],
                "pilot_organic_share": fmt_pct(pilot.get("organic_share")),
                "control_organic_share": fmt_pct(control.get("organic_share")),
                "point_gap": fmt_pp(gap),
                "pilot_organic_sessions": fmt_num(pilot.get("organic_sessions")),
                "pilot_total_sessions": fmt_num(pilot.get("total_sessions")),
            }
        )
    return rows


def fetch_gsc_summary(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> dict[str, Any]:
    ph = placeholders(property_ids)
    row = conn.execute(
        f"""
        SELECT
          COUNT(DISTINCT metric_date) AS days,
          COUNT(DISTINCT COALESCE(ga4_property_id, property_id)) AS properties,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS ctr,
          CASE WHEN SUM(impressions) > 0 THEN SUM(average_position * impressions) / SUM(impressions) END AS avg_position,
          MIN(metric_date) AS min_date,
          MAX(metric_date) AS max_date
        FROM gsc_daily_metrics
        WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    return dict(row or {})


def build_channel_mix_rows(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        SELECT
          channel_group,
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(conversions) AS key_events
        FROM ga4_traffic_sources
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY channel_group
        ORDER BY sessions DESC
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    total_sessions = sum(float(row["sessions"] or 0) for row in rows)
    return [
        {
            "channel": row["channel_group"] or "Unassigned",
            "sessions": fmt_num(row["sessions"]),
            "share": fmt_pct((float(row["sessions"] or 0) / total_sessions) if total_sessions else None),
            "new_users": fmt_num(row["new_users"]),
            "engagement_rate": fmt_pct((float(row["engaged_sessions"] or 0) / float(row["sessions"] or 0)) if row["sessions"] else None),
            "key_events": fmt_num(row["key_events"]),
        }
        for row in rows
    ]


def build_organic_monthly_rows(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        WITH total AS (
          SELECT substr(metric_date, 1, 7) AS month, SUM(sessions) AS total_sessions, SUM(new_users) AS total_new_users
          FROM ga4_daily_metrics
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY month
        ),
        organic AS (
          SELECT substr(metric_date, 1, 7) AS month, SUM(sessions) AS organic_sessions, SUM(new_users) AS organic_new_users,
                 SUM(engaged_sessions) AS organic_engaged_sessions, SUM(conversions) AS organic_key_events
          FROM ga4_traffic_sources
          WHERE property_id IN ({ph}) AND channel_group = 'Organic Search' AND metric_date BETWEEN ? AND ?
          GROUP BY month
        ),
        gsc AS (
          SELECT substr(metric_date, 1, 7) AS month, SUM(clicks) AS gsc_clicks, SUM(impressions) AS gsc_impressions
          FROM gsc_daily_metrics
          WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY month
        )
        SELECT
          total.month,
          total.total_sessions,
          COALESCE(organic.organic_sessions, 0) AS organic_sessions,
          COALESCE(organic.organic_new_users, 0) AS organic_new_users,
          COALESCE(organic.organic_engaged_sessions, 0) AS organic_engaged_sessions,
          COALESCE(organic.organic_key_events, 0) AS organic_key_events,
          CASE WHEN total.total_sessions > 0 THEN CAST(COALESCE(organic.organic_sessions, 0) AS REAL) / total.total_sessions END AS organic_share,
          COALESCE(gsc.gsc_clicks, 0) AS gsc_clicks,
          COALESCE(gsc.gsc_impressions, 0) AS gsc_impressions
        FROM total
        LEFT JOIN organic ON organic.month = total.month
        LEFT JOIN gsc ON gsc.month = total.month
        ORDER BY total.month
        """,
        (
            *property_ids,
            start.isoformat(),
            end.isoformat(),
            *property_ids,
            start.isoformat(),
            end.isoformat(),
            *property_ids,
            start.isoformat(),
            end.isoformat(),
        ),
    ).fetchall()
    output: list[dict[str, object]] = []
    previous_sessions: float | None = None
    for row in rows:
        organic_sessions = float(row["organic_sessions"] or 0)
        output.append(
            {
                "month": str(row["month"]),
                "organic_sessions": fmt_num(organic_sessions),
                "organic_sessions_mom": fmt_change(pct_change(organic_sessions, previous_sessions)),
                "organic_new_users": fmt_num(row["organic_new_users"]),
                "organic_share": fmt_pct(row["organic_share"]),
                "organic_engagement_rate": fmt_pct((float(row["organic_engaged_sessions"] or 0) / organic_sessions) if organic_sessions else None),
                "organic_key_events": fmt_num(row["organic_key_events"]),
                "gsc_clicks": fmt_num(row["gsc_clicks"]),
                "gsc_impressions": fmt_num(row["gsc_impressions"]),
            }
        )
        previous_sessions = organic_sessions
    return output


def build_gsc_query_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    start: date,
    end: date,
    *,
    opportunity: bool = False,
) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    order = "query_rollup.impressions DESC, query_rollup.clicks ASC" if opportunity else "query_rollup.clicks DESC, query_rollup.impressions DESC"
    filter_clause = "WHERE query_rollup.impressions >= 250 AND query_rollup.ctr < 0.04 AND query_rollup.avg_position <= 25" if opportunity else ""
    rows = conn.execute(
        f"""
        WITH property_query AS (
          SELECT
            COALESCE(ga4_property_id, property_id) AS resolved_property_id,
            query,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS ctr,
            CASE WHEN SUM(impressions) > 0 THEN SUM(average_position * impressions) / SUM(impressions) END AS avg_position
          FROM gsc_queries
          WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY COALESCE(ga4_property_id, property_id), query
        ),
        query_rollup AS (
          SELECT
            query,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS ctr,
            CASE WHEN SUM(impressions) > 0 THEN SUM(avg_position * impressions) / SUM(impressions) END AS avg_position,
            COUNT(DISTINCT resolved_property_id) AS property_count,
            COUNT(DISTINCT CASE WHEN clicks > 0 THEN resolved_property_id END) AS clicking_property_count
          FROM property_query
          GROUP BY query
        ),
        dominant_property AS (
          SELECT query, resolved_property_id, clicks, impressions, avg_position
          FROM (
            SELECT
              property_query.*,
              ROW_NUMBER() OVER (PARTITION BY query ORDER BY clicks DESC, impressions DESC, avg_position ASC) AS row_num
            FROM property_query
          )
          WHERE row_num = 1
        )
        SELECT
          query_rollup.*,
          COALESCE(properties.property_name, dominant_property.resolved_property_id) AS dominant_property,
          dominant_property.clicks AS dominant_clicks,
          dominant_property.impressions AS dominant_impressions
        FROM query_rollup
        LEFT JOIN dominant_property ON dominant_property.query = query_rollup.query
        LEFT JOIN properties ON properties.property_id = dominant_property.resolved_property_id
        {filter_clause}
        ORDER BY {order}
        LIMIT 35
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    return [
        {
            "query": row["query"],
            "clicks": fmt_num(row["clicks"]),
            "impressions": fmt_num(row["impressions"]),
            "ctr": fmt_pct(row["ctr"]),
            "avg_position": fmt_num(row["avg_position"], 1),
            "property_count": fmt_num(row["property_count"]),
            "clicking_properties": fmt_num(row["clicking_property_count"]),
            "dominant_property": row["dominant_property"] or "-",
            "dominant_clicks": fmt_num(row["dominant_clicks"]),
            "dominant_impressions": fmt_num(row["dominant_impressions"]),
        }
        for row in rows
    ]


def build_organic_property_opportunity_rows(
    conn: sqlite3.Connection,
    properties: list[dict[str, str]],
    start: date,
    end: date,
) -> list[dict[str, object]]:
    property_ids = [item["property_id"] for item in properties]
    name_map = {item["property_id"]: item for item in properties}
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        WITH total AS (
          SELECT property_id, SUM(sessions) AS total_sessions
          FROM ga4_daily_metrics
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY property_id
        ),
        organic AS (
          SELECT property_id, SUM(sessions) AS organic_sessions, SUM(new_users) AS organic_new_users,
                 SUM(engaged_sessions) AS organic_engaged_sessions, SUM(conversions) AS organic_key_events
          FROM ga4_traffic_sources
          WHERE property_id IN ({ph}) AND channel_group = 'Organic Search' AND metric_date BETWEEN ? AND ?
          GROUP BY property_id
        ),
        gsc AS (
          SELECT COALESCE(ga4_property_id, property_id) AS property_id, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                 CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS ctr,
                 CASE WHEN SUM(impressions) > 0 THEN SUM(average_position * impressions) / SUM(impressions) END AS avg_position
          FROM gsc_daily_metrics
          WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY COALESCE(ga4_property_id, property_id)
        )
        SELECT
          total.property_id,
          total.total_sessions,
          COALESCE(organic.organic_sessions, 0) AS organic_sessions,
          COALESCE(organic.organic_new_users, 0) AS organic_new_users,
          COALESCE(organic.organic_engaged_sessions, 0) AS organic_engaged_sessions,
          COALESCE(organic.organic_key_events, 0) AS organic_key_events,
          CASE WHEN total.total_sessions > 0 THEN CAST(COALESCE(organic.organic_sessions, 0) AS REAL) / total.total_sessions END AS organic_share,
          COALESCE(gsc.clicks, 0) AS gsc_clicks,
          COALESCE(gsc.impressions, 0) AS gsc_impressions,
          gsc.ctr,
          gsc.avg_position
        FROM total
        LEFT JOIN organic ON organic.property_id = total.property_id
        LEFT JOIN gsc ON gsc.property_id = total.property_id
        ORDER BY organic_sessions DESC
        """,
        (
            *property_ids,
            start.isoformat(),
            end.isoformat(),
            *property_ids,
            start.isoformat(),
            end.isoformat(),
            *property_ids,
            start.isoformat(),
            end.isoformat(),
        ),
    ).fetchall()
    output: list[dict[str, object]] = []
    for rank, row in enumerate(rows, start=1):
        prop = name_map[str(row["property_id"])]
        organic_sessions = float(row["organic_sessions"] or 0)
        total_sessions = float(row["total_sessions"] or 0)
        impressions = float(row["gsc_impressions"] or 0)
        share = (organic_sessions / total_sessions) if total_sessions else 0
        if impressions >= 10000 and share < 0.30:
            opportunity = "High impressions, low organic share"
        elif impressions >= 10000 and float(row["ctr"] or 0) < 0.03:
            opportunity = "High impressions, low CTR"
        elif float(row["avg_position"] or 99) <= 15 and float(row["ctr"] or 0) < 0.04:
            opportunity = "Ranking visibility needs click lift"
        else:
            opportunity = "Maintain / monitor"
        output.append(
            {
                "rank": rank,
                "property": prop["property_name"],
                "property_code": prop["property_code"],
                "organic_sessions": fmt_num(organic_sessions),
                "organic_share": fmt_pct(share),
                "organic_new_users": fmt_num(row["organic_new_users"]),
                "organic_engagement_rate": fmt_pct((float(row["organic_engaged_sessions"] or 0) / organic_sessions) if organic_sessions else None),
                "organic_key_events": fmt_num(row["organic_key_events"]),
                "gsc_clicks": fmt_num(row["gsc_clicks"]),
                "gsc_impressions": fmt_num(impressions),
                "gsc_ctr": fmt_pct(row["ctr"]),
                "gsc_avg_position": fmt_num(row["avg_position"], 1),
                "opportunity_read": opportunity,
            }
        )
    return output


def build_dataforseo_organic_rows(conn: sqlite3.Connection) -> tuple[list[dict[str, object]], dict[str, Any], list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    latest_keyword = conn.execute("SELECT MAX(run_date) FROM dataforseo_keyword_metrics").fetchone()[0]
    latest_labs = conn.execute("SELECT MAX(run_date) FROM dataforseo_labs_ranked_keywords").fetchone()[0]
    latest_serp = conn.execute("SELECT MAX(run_date) FROM dataforseo_property_keyword_rankings").fetchone()[0]
    latest_onpage = conn.execute("SELECT MAX(run_date) FROM dataforseo_onpage_page_snapshots").fetchone()[0]
    latest_ai = conn.execute("SELECT MAX(run_date) FROM dataforseo_ai_visibility_probes").fetchone()[0]

    serp_summary = conn.execute(
        """
        SELECT
          COUNT(*) AS checks,
          COUNT(DISTINCT property_id) AS properties,
          SUM(target_found) AS found,
          SUM(local_pack_present) AS local_pack_present,
          SUM(target_in_local_pack) AS target_in_local_pack,
          AVG(best_rank_absolute) AS avg_best_rank
        FROM dataforseo_property_keyword_rankings
        WHERE run_date = ?
        """,
        (latest_serp,),
    ).fetchone() if latest_serp else None
    keyword_summary = conn.execute(
        """
        SELECT COUNT(*) AS keywords, COUNT(DISTINCT property_id) AS properties, SUM(search_volume) AS search_volume
        FROM dataforseo_keyword_metrics
        WHERE run_date = ?
        """,
        (latest_keyword,),
    ).fetchone() if latest_keyword else None
    onpage_summary = conn.execute(
        """
        SELECT COUNT(*) AS pages, COUNT(DISTINCT property_id) AS properties, AVG(word_count) AS avg_word_count,
               SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS ok_pages
        FROM dataforseo_onpage_page_snapshots
        WHERE run_date = ?
        """,
        (latest_onpage,),
    ).fetchone() if latest_onpage else None
    ai_summary = conn.execute(
        """
        SELECT COUNT(*) AS probes, COUNT(DISTINCT property_id) AS properties, SUM(target_mentioned) AS mentioned
        FROM dataforseo_ai_visibility_probes
        WHERE run_date = ?
        """,
        (latest_ai,),
    ).fetchone() if latest_ai else None

    summary_rows = [
        {
            "lane": "SERP rank checks",
            "latest": fmt_date(latest_serp) if latest_serp else "-",
            "coverage": f"{fmt_num(serp_summary['properties'] if serp_summary else None)} properties / {fmt_num(serp_summary['checks'] if serp_summary else None)} checks",
            "read": (
                f"Target found in {fmt_num(serp_summary['found'])} checks; local pack present in "
                f"{fmt_num(serp_summary['local_pack_present'])}; target in local pack {fmt_num(serp_summary['target_in_local_pack'])}."
                if serp_summary else "No stored SERP checks."
            ),
        },
        {
            "lane": "Keyword demand",
            "latest": fmt_date(latest_keyword) if latest_keyword else "-",
            "coverage": f"{fmt_num(keyword_summary['properties'] if keyword_summary else None)} properties / {fmt_num(keyword_summary['keywords'] if keyword_summary else None)} keywords",
            "read": f"{fmt_num(keyword_summary['search_volume'] if keyword_summary else None)} combined monthly searches in stored keyword rows.",
        },
        {
            "lane": "OnPage snapshots",
            "latest": fmt_date(latest_onpage) if latest_onpage else "-",
            "coverage": f"{fmt_num(onpage_summary['properties'] if onpage_summary else None)} properties / {fmt_num(onpage_summary['pages'] if onpage_summary else None)} pages",
            "read": f"{fmt_num(onpage_summary['ok_pages'] if onpage_summary else None)} OK pages; average word count {fmt_num(onpage_summary['avg_word_count'] if onpage_summary else None)}.",
        },
        {
            "lane": "AI visibility probes",
            "latest": fmt_date(latest_ai) if latest_ai else "-",
            "coverage": f"{fmt_num(ai_summary['properties'] if ai_summary else None)} properties / {fmt_num(ai_summary['probes'] if ai_summary else None)} probes",
            "read": f"Target mentioned in {fmt_num(ai_summary['mentioned'] if ai_summary else None)} stored AI probes.",
        },
    ]

    top_keywords = [
        {
            "keyword": row["keyword"],
            "property_code": row["property_id"],
            "search_volume": fmt_num(row["search_volume"]),
            "competition": row["competition"] or "-",
            "cpc": f"${float(row['cpc'] or 0):,.2f}" if row["cpc"] is not None else "-",
        }
        for row in conn.execute(
            """
            SELECT keyword, property_id, search_volume, competition, cpc
            FROM dataforseo_keyword_metrics
            WHERE run_date = ?
            ORDER BY COALESCE(search_volume, 0) DESC, COALESCE(cpc, 0) DESC
            LIMIT 35
            """,
            (latest_keyword,),
        ).fetchall()
    ] if latest_keyword else []
    serp_domains = [
        {
            "domain": row["domain"],
            "appearances": fmt_num(row["appearances"]),
            "best_rank": fmt_num(row["best_rank"]),
            "keywords_seen": row["keywords_seen"],
        }
        for row in conn.execute(
            """
            SELECT domain, COUNT(*) AS appearances, MIN(rank_absolute) AS best_rank, GROUP_CONCAT(DISTINCT keyword) AS keywords_seen
            FROM dataforseo_serp_results
            WHERE run_date = ? AND domain IS NOT NULL
            GROUP BY domain
            ORDER BY appearances DESC, best_rank ASC
            LIMIT 25
            """,
            (latest_serp,),
        ).fetchall()
    ] if latest_serp else []
    serp_gaps = [
        {
            "property_code": row["property_id"],
            "keyword": row["keyword"],
            "found": "Yes" if row["target_found"] else "No",
            "best_rank": fmt_num(row["best_rank_absolute"]) if row["best_rank_absolute"] is not None else "-",
            "organic_rank": fmt_num(row["organic_rank_absolute"]) if row["organic_rank_absolute"] is not None else "-",
            "local_pack": "Present" if row["local_pack_present"] else "No",
            "target_in_local_pack": "Yes" if row["target_in_local_pack"] else "No",
        }
        for row in conn.execute(
            """
            SELECT property_id, keyword, target_found, best_rank_absolute, organic_rank_absolute, local_pack_present, target_in_local_pack
            FROM dataforseo_property_keyword_rankings
            WHERE run_date = ?
            ORDER BY target_found ASC, COALESCE(best_rank_absolute, 9999), property_id, keyword
            LIMIT 35
            """,
            (latest_serp,),
        ).fetchall()
    ] if latest_serp else []
    summary = {
        "latest_keyword": latest_keyword,
        "latest_labs": latest_labs,
        "latest_serp": latest_serp,
        "latest_onpage": latest_onpage,
        "latest_ai": latest_ai,
        "serp_checks": int(serp_summary["checks"] or 0) if serp_summary else 0,
        "serp_found": int(serp_summary["found"] or 0) if serp_summary else 0,
        "keyword_properties": int(keyword_summary["properties"] or 0) if keyword_summary else 0,
        "serp_properties": int(serp_summary["properties"] or 0) if serp_summary else 0,
    }
    return summary_rows, summary, top_keywords, serp_domains, serp_gaps


def build_organic_growth_actions(
    summary: dict[str, Any],
    gsc: dict[str, Any],
    opportunity_rows: list[dict[str, object]],
    gsc_opportunity_rows: list[dict[str, object]],
    dataforseo_summary: dict[str, Any],
) -> list[dict[str, object]]:
    top_property = opportunity_rows[0]["property"] if opportunity_rows else "top organic properties"
    top_query = gsc_opportunity_rows[0]["query"] if gsc_opportunity_rows else "high-impression apartment queries"
    low_share = next((row for row in opportunity_rows if row.get("opportunity_read") != "Maintain / monitor"), None)
    low_share_property = low_share["property"] if low_share else top_property
    return [
        {
            "priority": "1",
            "growth_lane": "Scale query-to-page content",
            "action": f"Build refresh briefs for high-impression GSC terms, starting with '{top_query}'.",
            "why_it_matters": f"GSC shows {fmt_num(gsc.get('impressions'))} impressions and {fmt_num(gsc.get('clicks'))} clicks in the report window; CTR is {fmt_pct(gsc.get('ctr'))}.",
        },
        {
            "priority": "2",
            "growth_lane": "Property opportunity list",
            "action": f"Prioritize title/meta/H1/FAQ refreshes for {low_share_property} and other high-impression properties with low organic share or CTR.",
            "why_it_matters": "These properties already have demand visibility, so click-through and page relevance work can lift traffic faster than net-new demand creation.",
        },
        {
            "priority": "3",
            "growth_lane": "DataForSEO SERP gaps",
            "action": "Use stored DataForSEO SERP gaps to identify where Venterra is absent from top local/apartment results and where aggregators dominate.",
            "why_it_matters": f"Latest DataForSEO SERP checks found the target in {dataforseo_summary.get('serp_found', 0)} of {dataforseo_summary.get('serp_checks', 0)} stored checks.",
        },
        {
            "priority": "4",
            "growth_lane": "Local pack / GBP support",
            "action": "For terms where local packs appear, align GBP categories, services, photos, review-response language, and site location copy.",
            "why_it_matters": "Organic apartment discovery is split between blue-link rankings and local/entity surfaces; local-pack presence needs a GBP plus website answer.",
        },
        {
            "priority": "5",
            "growth_lane": "Technical and OnPage readiness",
            "action": "Fix OnPage consistency before adding volume: title length, meta description, H1 alignment, internal links, image alt coverage, and mobile performance.",
            "why_it_matters": "DataForSEO OnPage and PageSpeed signals are advisory, but weak page structure can waste demand that GSC already proves exists.",
        },
        {
            "priority": "6",
            "growth_lane": "Coverage expansion",
            "action": "Extend DataForSEO keyword, SERP, OnPage, business profile, and AI visibility coverage to the full governed portfolio after credit/scope approval.",
            "why_it_matters": f"Stored DataForSEO demand covers {dataforseo_summary.get('keyword_properties', 0)} properties and SERP checks cover {dataforseo_summary.get('serp_properties', 0)} properties, so the current DataForSEO read is advisory rather than complete portfolio coverage.",
        },
    ]


COMMON_BRAND_WORDS = {
    "apartment",
    "apartments",
    "at",
    "the",
    "and",
    "of",
    "a",
    "an",
    "in",
    "on",
    "by",
    "district",
    "homes",
    "home",
    "living",
}


def organic_tokenize(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) >= 3}


def brand_tokens_for_property(property_name: str) -> set[str]:
    tokens = organic_tokenize(property_name)
    return {token for token in tokens if token not in COMMON_BRAND_WORDS}


def classify_organic_query(query: str, property_name: str, city: str | None = None, state: str | None = None) -> tuple[str, str]:
    text = f" {query.lower()} "
    tokens = organic_tokenize(query)
    brand_tokens = brand_tokens_for_property(property_name)
    if "venterra" in tokens or (brand_tokens and len(tokens & brand_tokens) >= min(2, len(brand_tokens))):
        return "Brand / property", "Brand capture"
    if city and city.lower() in text:
        return "Non-brand", "City / local market"
    if state and re.search(rf"\b{re.escape(state.lower())}\b", text):
        return "Non-brand", "City / local market"
    if any(term in text for term in (" near me ", " nearby ", " apartments in ", " apartment in ")):
        return "Non-brand", "City / local market"
    if any(term in text for term in ("pet friendly", " pet ", " dogs ", " cats ")):
        return "Non-brand", "Pet-friendly"
    if any(term in text for term in ("luxury", "modern", "upscale")):
        return "Non-brand", "Luxury / lifestyle"
    if any(term in text for term in ("floor plan", "floorplan", "studio", "1 bedroom", "2 bedroom", "3 bedroom", "one bedroom", "two bedroom", "availability", "available")):
        return "Non-brand", "Floorplan / availability"
    if any(term in text for term in ("rent", "price", "pricing", "cheap", "affordable", "special", "specials", "deal", "move in")):
        return "Non-brand", "Price / specials"
    if any(term in text for term in ("review", "reviews", "rating", "ratings")):
        return "Non-brand", "Reputation"
    if any(term in text for term in ("amenity", "amenities", "pool", "gym", "garage", "parking")):
        return "Non-brand", "Amenities"
    return "Non-brand", "Other discovery"


def build_brand_nonbrand_intent_rows(
    conn: sqlite3.Connection,
    properties: list[dict[str, str]],
    start: date,
    end: date,
) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, Any]]:
    property_ids = [item["property_id"] for item in properties]
    ph = placeholders(property_ids)
    prop_context: dict[str, dict[str, str | None]] = {}
    for prop in properties:
        identity = resolve_property_identity(prop["property_id"]) or resolve_property_identity(prop["property_name"])
        prop_context[prop["property_id"]] = {
            "name": prop["property_name"],
            "city": identity.city if identity else None,
            "state": identity.state if identity else None,
        }
    rows = conn.execute(
        f"""
        SELECT
          COALESCE(ga4_property_id, property_id) AS resolved_property_id,
          query,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          CASE WHEN SUM(impressions) > 0 THEN SUM(average_position * impressions) / SUM(impressions) END AS avg_position
        FROM gsc_queries
        WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY COALESCE(ga4_property_id, property_id), query
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    segment: dict[str, dict[str, Any]] = {}
    intent: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        context = prop_context.get(str(row["resolved_property_id"]), {})
        segment_name, intent_name = classify_organic_query(
            str(row["query"] or ""),
            str(context.get("name") or ""),
            context.get("city"),
            context.get("state"),
        )
        clicks = float(row["clicks"] or 0)
        impressions = float(row["impressions"] or 0)
        position_weight = float(row["avg_position"] or 0) * impressions
        for bucket_key, bucket in (
            (segment_name, segment),
            ((segment_name, intent_name), intent),
        ):
            if bucket_key not in bucket:
                bucket[bucket_key] = {
                    "clicks": 0.0,
                    "impressions": 0.0,
                    "position_weight": 0.0,
                    "properties": set(),
                    "top_query": "",
                    "top_query_impressions": -1.0,
                }
            item = bucket[bucket_key]
            item["clicks"] += clicks
            item["impressions"] += impressions
            item["position_weight"] += position_weight
            item["properties"].add(str(row["resolved_property_id"]))
            if impressions > float(item["top_query_impressions"]):
                item["top_query"] = row["query"]
                item["top_query_impressions"] = impressions

    total_clicks = sum(float(item["clicks"]) for item in segment.values())
    total_impressions = sum(float(item["impressions"]) for item in segment.values())
    segment_rows: list[dict[str, object]] = []
    for key, item in sorted(segment.items(), key=lambda pair: float(pair[1]["clicks"]), reverse=True):
        impressions = float(item["impressions"] or 0)
        segment_rows.append(
            {
                "segment": key,
                "clicks": fmt_num(item["clicks"]),
                "click_share": fmt_pct((float(item["clicks"]) / total_clicks) if total_clicks else None),
                "impressions": fmt_num(impressions),
                "impression_share": fmt_pct((impressions / total_impressions) if total_impressions else None),
                "ctr": fmt_pct((float(item["clicks"]) / impressions) if impressions else None),
                "avg_position": fmt_num((float(item["position_weight"]) / impressions) if impressions else None, 1),
                "properties": fmt_num(len(item["properties"])),
                "top_query": item["top_query"],
            }
        )
    intent_rows: list[dict[str, object]] = []
    for (segment_name, intent_name), item in sorted(intent.items(), key=lambda pair: float(pair[1]["clicks"]), reverse=True):
        impressions = float(item["impressions"] or 0)
        intent_rows.append(
            {
                "segment": segment_name,
                "intent_cluster": intent_name,
                "clicks": fmt_num(item["clicks"]),
                "click_share": fmt_pct((float(item["clicks"]) / total_clicks) if total_clicks else None),
                "impressions": fmt_num(impressions),
                "ctr": fmt_pct((float(item["clicks"]) / impressions) if impressions else None),
                "avg_position": fmt_num((float(item["position_weight"]) / impressions) if impressions else None, 1),
                "properties": fmt_num(len(item["properties"])),
                "top_query": item["top_query"],
            }
        )
    nonbrand_clicks = sum(float(item["clicks"]) for key, item in segment.items() if str(key).startswith("Non-brand"))
    return segment_rows, intent_rows, {
        "brand_clicks": sum(float(item["clicks"]) for key, item in segment.items() if str(key).startswith("Brand")),
        "nonbrand_clicks": nonbrand_clicks,
        "total_clicks": total_clicks,
        "nonbrand_click_share": (nonbrand_clicks / total_clicks) if total_clicks else None,
    }


def classify_landing_page(value: str) -> str:
    path = (value or "").lower()
    if not path or path in {"/", "(not set)"}:
        return "Homepage"
    if any(term in path for term in ("floorplan", "floor-plan", "apartments", "availability")):
        return "Floorplans / availability"
    if any(term in path for term in ("amenit", "feature")):
        return "Amenities / features"
    if any(term in path for term in ("neighborhood", "location", "directions")):
        return "Neighborhood / location"
    if any(term in path for term in ("review", "reputation")):
        return "Reviews"
    if any(term in path for term in ("contact", "schedule", "tour")):
        return "Contact / tour"
    if any(term in path for term in ("gallery", "photo")):
        return "Gallery"
    if any(term in path for term in ("special", "offer")):
        return "Specials"
    return "Other pages"


def build_organic_landing_page_rows(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        SELECT
          COALESCE(NULLIF(landing_page, ''), NULLIF(page_path, ''), '/') AS page,
          COUNT(DISTINCT CASE WHEN session_id IS NOT NULL AND session_id <> '' THEN session_id END) AS distinct_sessions,
          SUM(event_count) AS events,
          SUM(CASE WHEN event_name NOT IN ('page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll') THEN event_count ELSE 0 END) AS action_events,
          COUNT(DISTINCT property_id) AS properties
        FROM ga4_event_facts
        WHERE property_id IN ({ph})
          AND event_date BETWEEN ? AND ?
          AND default_channel_group = 'Organic Search'
        GROUP BY page
        ORDER BY COALESCE(distinct_sessions, events) DESC
        LIMIT 80
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    detail_rows: list[dict[str, object]] = []
    type_rollup: dict[str, dict[str, float | set[str]]] = {}
    if not rows:
        return [
            {
                "page_type": "Source gap",
                "organic_sessions_proxy": "-",
                "share": "-",
                "organic_events": "-",
                "action_events": "-",
                "action_events_per_session": "-",
                "distinct_pages": "-",
            }
        ], []
    for row in rows:
        page = str(row["page"] or "/")
        page_type = classify_landing_page(page)
        sessions = float(row["distinct_sessions"] or row["events"] or 0)
        action_events = float(row["action_events"] or 0)
        detail_rows.append(
            {
                "page_type": page_type,
                "landing_page": page,
                "organic_sessions_proxy": fmt_num(sessions),
                "organic_events": fmt_num(row["events"]),
                "action_events": fmt_num(action_events),
                "action_events_per_session": fmt_pct((action_events / sessions) if sessions else None),
                "properties": fmt_num(row["properties"]),
            }
        )
        bucket = type_rollup.setdefault(page_type, {"sessions": 0.0, "events": 0.0, "actions": 0.0, "pages": set()})
        bucket["sessions"] = float(bucket["sessions"]) + sessions
        bucket["events"] = float(bucket["events"]) + float(row["events"] or 0)
        bucket["actions"] = float(bucket["actions"]) + action_events
        cast_pages = bucket["pages"]
        if isinstance(cast_pages, set):
            cast_pages.add(page)
    type_rows = []
    total_sessions = sum(float(item["sessions"]) for item in type_rollup.values())
    for page_type, item in sorted(type_rollup.items(), key=lambda pair: float(pair[1]["sessions"]), reverse=True):
        sessions = float(item["sessions"])
        actions = float(item["actions"])
        pages = item["pages"]
        type_rows.append(
            {
                "page_type": page_type,
                "organic_sessions_proxy": fmt_num(sessions),
                "share": fmt_pct((sessions / total_sessions) if total_sessions else None),
                "organic_events": fmt_num(item["events"]),
                "action_events": fmt_num(actions),
                "action_events_per_session": fmt_pct((actions / sessions) if sessions else None),
                "distinct_pages": fmt_num(len(pages) if isinstance(pages, set) else None),
            }
        )
    return type_rows, detail_rows


def build_paid_organic_overlap_rows(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        WITH paid AS (
          SELECT lower(keyword_text) AS keyword, SUM(clicks) AS paid_clicks, SUM(impressions) AS paid_impressions,
                 SUM(cost_micros) / 1000000.0 AS cost, SUM(conversions) AS conversions, COUNT(DISTINCT property_id) AS paid_properties
          FROM google_ads_keywords
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY lower(keyword_text)
        ),
        organic AS (
          SELECT lower(query) AS keyword, SUM(clicks) AS organic_clicks, SUM(impressions) AS organic_impressions,
                 CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS organic_ctr,
                 CASE WHEN SUM(impressions) > 0 THEN SUM(average_position * impressions) / SUM(impressions) END AS organic_position,
                 COUNT(DISTINCT COALESCE(ga4_property_id, property_id)) AS organic_properties
          FROM gsc_queries
          WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY lower(query)
        )
        SELECT paid.keyword, paid.paid_clicks, paid.paid_impressions, paid.cost, paid.conversions, paid.paid_properties,
               organic.organic_clicks, organic.organic_impressions, organic.organic_ctr, organic.organic_position, organic.organic_properties
        FROM paid
        JOIN organic ON organic.keyword = paid.keyword
        ORDER BY paid.cost DESC, organic.organic_impressions DESC
        LIMIT 35
        """,
        (*property_ids, start.isoformat(), end.isoformat(), *property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    output = []
    for row in rows:
        organic_position = float(row["organic_position"] or 99)
        organic_ctr = float(row["organic_ctr"] or 0)
        if organic_position <= 5 and organic_ctr >= 0.08:
            read = "Possible paid defense / overlap"
        elif organic_position <= 15 and float(row["organic_impressions"] or 0) >= 500:
            read = "Organic can reduce paid pressure with CTR work"
        else:
            read = "Paid filling organic gap"
        output.append(
            {
                "keyword": row["keyword"],
                "paid_cost": f"${float(row['cost'] or 0):,.0f}",
                "paid_clicks": fmt_num(row["paid_clicks"]),
                "paid_conversions": fmt_num(row["conversions"]),
                "organic_clicks": fmt_num(row["organic_clicks"]),
                "organic_impressions": fmt_num(row["organic_impressions"]),
                "organic_ctr": fmt_pct(row["organic_ctr"]),
                "organic_position": fmt_num(row["organic_position"], 1),
                "read": read,
            }
        )
    return output


def build_organic_forecast_rows(gsc_opportunity_rows: list[dict[str, object]]) -> tuple[list[dict[str, object]], dict[str, float]]:
    scenarios = [0.005, 0.01, 0.02]
    totals = {scenario: 0.0 for scenario in scenarios}
    rows: list[dict[str, object]] = []
    for row in gsc_opportunity_rows[:25]:
        impressions = float(str(row.get("impressions", "0")).replace(",", "") or 0)
        ctr = float(str(row.get("ctr", "0")).replace("%", "").replace(",", "") or 0) / 100
        target = min(max(ctr + 0.01, 0.035), 0.08)
        incremental = max(0.0, impressions * (target - ctr))
        for scenario in scenarios:
            totals[scenario] += impressions * scenario
        rows.append(
            {
                "query": row.get("query"),
                "impressions": row.get("impressions"),
                "current_ctr": row.get("ctr"),
                "modeled_ctr": fmt_pct(target),
                "incremental_clicks": fmt_num(incremental),
                "avg_position": row.get("avg_position"),
                "clicking_properties": row.get("clicking_properties"),
                "property_count": row.get("property_count"),
                "dominant_property": row.get("dominant_property"),
            }
        )
    totals["query_level_model"] = sum(float(str(row.get("incremental_clicks", "0")).replace(",", "") or 0) for row in rows)
    return rows, totals


def build_ahrefs_overlay_rows(conn: sqlite3.Connection) -> tuple[list[dict[str, object]], dict[str, Any]]:
    latest_health = conn.execute("SELECT MAX(snapshot_date) FROM ahrefs_site_audit_project_health").fetchone()[0]
    latest_dr = conn.execute("SELECT MAX(snapshot_date) FROM ahrefs_domain_rating_snapshots").fetchone()[0]
    latest_gsc = conn.execute("SELECT MAX(metric_date) FROM ahrefs_gsc_daily_summary").fetchone()[0]
    health = conn.execute(
        """
        SELECT COUNT(*) AS projects, AVG(health_score) AS avg_health, SUM(urls_with_errors) AS errors,
               SUM(urls_with_warnings) AS warnings, SUM(total_urls) AS urls
        FROM ahrefs_site_audit_project_health
        WHERE snapshot_date = ?
        """,
        (latest_health,),
    ).fetchone() if latest_health else None
    dr = conn.execute(
        """
        SELECT COUNT(*) AS targets, AVG(domain_rating) AS avg_dr,
               SUM(CASE WHEN has_license THEN 1 ELSE 0 END) AS licensed
        FROM ahrefs_domain_rating_snapshots
        WHERE snapshot_date = ?
        """,
        (latest_dr,),
    ).fetchone() if latest_dr else None
    gsc = conn.execute(
        """
        SELECT COUNT(DISTINCT property_id) AS properties, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
               CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS ctr
        FROM ahrefs_gsc_daily_summary
        WHERE metric_date = ?
        """,
        (latest_gsc,),
    ).fetchone() if latest_gsc else None
    rows = [
        {
            "lane": "Ahrefs Site Audit",
            "latest": fmt_date(latest_health) if latest_health else "-",
            "coverage": f"{fmt_num(health['projects'] if health else None)} projects / {fmt_num(health['urls'] if health else None)} URLs",
            "read": f"Average health {fmt_num(health['avg_health'] if health else None, 1)}; {fmt_num(health['errors'] if health else None)} errors and {fmt_num(health['warnings'] if health else None)} warnings.",
        },
        {
            "lane": "Ahrefs Domain Rating",
            "latest": fmt_date(latest_dr) if latest_dr else "-",
            "coverage": f"{fmt_num(dr['targets'] if dr else None)} targets",
            "read": f"Average DR {fmt_num(dr['avg_dr'] if dr else None, 1)}; licensed rows {fmt_num(dr['licensed'] if dr else None)}.",
        },
        {
            "lane": "Ahrefs GSC summary",
            "latest": fmt_date(latest_gsc) if latest_gsc else "-",
            "coverage": f"{fmt_num(gsc['properties'] if gsc else None)} properties",
            "read": f"{fmt_num(gsc['clicks'] if gsc else None)} clicks, {fmt_num(gsc['impressions'] if gsc else None)} impressions, CTR {fmt_pct(gsc['ctr'] if gsc else None)}.",
        },
    ]
    return rows, {
        "latest_health": latest_health,
        "latest_dr": latest_dr,
        "latest_gsc": latest_gsc,
        "avg_health": float(health["avg_health"] or 0) if health else None,
        "avg_dr": float(dr["avg_dr"] or 0) if dr else None,
    }


def build_executive_heatmap_rows(property_rows: list[dict[str, object]]) -> list[dict[str, object]]:
    output = []
    for row in property_rows:
        organic_share = float(str(row.get("organic_share", "0")).replace("%", "").replace(",", "") or 0)
        ctr = float(str(row.get("gsc_ctr", "0")).replace("%", "").replace(",", "") or 0)
        impressions = float(str(row.get("gsc_impressions", "0")).replace(",", "") or 0)
        engagement = float(str(row.get("organic_engagement_rate", "0")).replace("%", "").replace(",", "") or 0)
        if organic_share >= 40 and engagement >= 55:
            action = "Protect"
            reason = "Organic is already a major quality channel."
        elif impressions >= 10000 and ctr < 3:
            action = "Fix CTR"
            reason = "Google visibility exists, but clicks are under-captured."
        elif impressions >= 10000 and organic_share < 30:
            action = "Grow discovery"
            reason = "Search demand exists, but organic share is below portfolio opportunity."
        elif engagement < 45 and organic_share >= 25:
            action = "Fix post-click quality"
            reason = "Organic gets traffic, but engagement is weak."
        else:
            action = "Maintain / monitor"
            reason = "No single executive action flag dominates."
        output.append(
            {
                "property": row.get("property"),
                "property_code": row.get("property_code"),
                "action_bucket": action,
                "reason": reason,
                "organic_sessions": row.get("organic_sessions"),
                "organic_share": row.get("organic_share"),
                "gsc_impressions": row.get("gsc_impressions"),
                "gsc_ctr": row.get("gsc_ctr"),
                "organic_engagement_rate": row.get("organic_engagement_rate"),
            }
        )
    return output


def pct_change(current: float | int | None, previous: float | int | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return (float(current) - float(previous)) / float(previous)


def fmt_change(value: float | None, decimals: int = 1) -> str:
    if value is None:
        return "-"
    return f"{value * 100:+,.{decimals}f}%"


def fmt_signed_num(value: float | int | None, decimals: int = 0) -> str:
    if value is None:
        return "-"
    return f"{float(value):+,.{decimals}f}"


def first_weekday_in_window(start: date, end: date, weekday: int) -> date | None:
    current = start
    while current <= end:
        if current.weekday() == weekday:
            return current
        current += timedelta(days=1)
    return None


def summarize_daily_trend(daily_rows_raw: list[sqlite3.Row]) -> tuple[str, str]:
    if not daily_rows_raw:
        return "No daily GA4 session rows were available for the selected scope and date range.", ""
    first = daily_rows_raw[0]
    last = daily_rows_raw[-1]
    peak = max(daily_rows_raw, key=lambda row: float(row["sessions"] or 0))
    trough = min(daily_rows_raw, key=lambda row: float(row["sessions"] or 0))
    week_change = pct_change(last["sessions"], first["sessions"])
    summary = (
        f"Daily sessions started at {fmt_num(first['sessions'])} on {fmt_date(first['metric_date'])} and ended at "
        f"{fmt_num(last['sessions'])} on {fmt_date(last['metric_date'])} ({fmt_change(week_change)} across the window). "
        f"The high point was {fmt_num(peak['sessions'])} sessions on {fmt_date(peak['metric_date'])}; "
        f"the low point was {fmt_num(trough['sessions'])} on {fmt_date(trough['metric_date'])}."
    )
    callout = f"Trend marker: {fmt_change(week_change)} from first day to final day in the selected window."
    return summary, callout


def build_daily_trend_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    start: date,
    end: date,
    copy_change_date: date | None,
    conversions_by_day: dict[str, float] | None = None,
) -> tuple[list[dict[str, object]], list[sqlite3.Row]]:
    ph = placeholders(property_ids)
    daily_rows_raw = conn.execute(
        f"""
        SELECT
          metric_date,
          SUM(sessions) AS sessions,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(new_users) AS new_users,
          SUM(pageviews) AS pageviews,
          SUM(conversions) AS conversions,
          AVG(engagement_rate) AS engagement_rate,
          AVG(bounce_rate) AS bounce_rate,
          AVG(avg_session_duration) AS avg_session_duration
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()

    daily_rows: list[dict[str, object]] = []
    previous_sessions: float | None = None
    for row in daily_rows_raw:
        row_date = parse_iso_date(str(row["metric_date"]))
        sessions = float(row["sessions"] or 0)
        engaged = float(row["engaged_sessions"] or 0)
        engagement_rate = row["engagement_rate"] if row["engagement_rate"] is not None else ((engaged / sessions) if sessions else None)
        if copy_change_date and row_date < copy_change_date:
            period = "Pre-copy"
        elif copy_change_date and row_date == copy_change_date:
            period = "Copy change"
        elif copy_change_date and row_date > copy_change_date:
            period = "Post-copy"
        else:
            period = "In window"
        daily_rows.append(
            {
                "date": fmt_date(row["metric_date"]),
                "trend_marker": period,
                "sessions": fmt_num(row["sessions"]),
                "day_over_day": fmt_change(pct_change(row["sessions"], previous_sessions)),
                "new_users": fmt_num(row["new_users"]),
                "engaged_sessions": fmt_num(row["engaged_sessions"]),
                "engagement_rate": fmt_pct(engagement_rate),
                "bounce_rate": fmt_pct(row["bounce_rate"]),
                "avg_session_duration": fmt_duration_seconds(row["avg_session_duration"]),
                "pageviews": fmt_num(row["pageviews"]),
                "key_events": fmt_num((conversions_by_day or {}).get(str(row["metric_date"]), row["conversions"])),
            }
        )
        previous_sessions = float(row["sessions"] or 0)
    return daily_rows, daily_rows_raw


def build_copy_change_read(
    daily_rows_raw: list[sqlite3.Row],
    copy_change_date: date | None,
) -> str | None:
    if not copy_change_date or not daily_rows_raw:
        return None
    pre = [float(row["sessions"] or 0) for row in daily_rows_raw if parse_iso_date(str(row["metric_date"])) < copy_change_date]
    change_day = next(
        (float(row["sessions"] or 0) for row in daily_rows_raw if parse_iso_date(str(row["metric_date"])) == copy_change_date),
        None,
    )
    post = [float(row["sessions"] or 0) for row in daily_rows_raw if parse_iso_date(str(row["metric_date"])) > copy_change_date]
    if not pre or not post:
        return f"Copy-change marker: {fmt_date(copy_change_date)} is inside the selected window, but there are not enough days on both sides for a clean pre/post read."
    pre_avg = sum(pre) / len(pre)
    post_avg = sum(post) / len(post)
    return (
        f"Copy-change marker: {fmt_date(copy_change_date)} is treated as the transition day "
        f"({fmt_num(change_day)} sessions). Average daily sessions were {fmt_num(pre_avg, 1)} before the change "
        f"and {fmt_num(post_avg, 1)} after the change, a directional {fmt_change(pct_change(post_avg, pre_avg))} shift. "
        "Because this is a short post-change window, read it as early trend evidence rather than final impact."
    )


def detect_copy_change_marker(request: ReportRequest, start: date, end: date) -> tuple[date | None, int | None, str | None]:
    subject = request.subject.lower()
    if "copy" not in subject:
        return None, None, None

    marker_date: date | None = None
    if "july 7" in subject or "jul 7" in subject or "7th" in subject:
        candidate = date(start.year, 7, 7)
        if start <= candidate <= end:
            marker_date = candidate

    if marker_date is None:
        marker_date = first_weekday_in_window(start, end, 3)

    marker_hour = 12 if "afternoon" in subject else None
    if marker_date and marker_hour is not None:
        return marker_date, marker_hour, f"{fmt_date(marker_date)} {marker_hour:02d}:00"
    if marker_date:
        return marker_date, None, fmt_date(marker_date)
    return None, None, None


def get_ga4_hourly_client():
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        from google.analytics.data_v1beta import BetaAnalyticsDataClient, DateRange, Dimension, Metric, RunReportRequest
        from google.oauth2 import service_account
        from utils.config_manager import Config

    credentials = service_account.Credentials.from_service_account_file(str(Config.get_ga4_credentials_path()))
    client = BetaAnalyticsDataClient(credentials=credentials)
    return client, RunReportRequest, DateRange, Dimension, Metric


def fetch_ga4_hourly_rows(
    properties: list[dict[str, str]],
    start: date,
    end: date,
    copy_change_date: date | None,
    copy_change_hour: int | None,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    if not copy_change_date or copy_change_hour is None:
        return [], {}

    client, RunReportRequest, DateRange, Dimension, Metric = get_ga4_hourly_client()
    by_hour: dict[tuple[str, int], dict[str, float]] = defaultdict(
        lambda: {
            "sessions": 0.0,
            "engaged_sessions": 0.0,
            "total_users": 0.0,
            "new_users": 0.0,
            "pageviews": 0.0,
            "conversions": 0.0,
            "duration_weighted": 0.0,
        }
    )
    property_ids = [prop["property_id"] for prop in properties]
    for property_id in property_ids:
        request = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="date"), Dimension(name="hour")],
            date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
            metrics=[
                Metric(name="sessions"),
                Metric(name="engagedSessions"),
                Metric(name="totalUsers"),
                Metric(name="newUsers"),
                Metric(name="screenPageViews"),
                Metric(name="conversions"),
                Metric(name="averageSessionDuration"),
            ],
        )
        response = client.run_report(request)
        for row in response.rows:
            raw_date = row.dimension_values[0].value
            row_date = f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            hour = int(row.dimension_values[1].value)
            sessions = float(row.metric_values[0].value or 0)
            avg_duration = float(row.metric_values[6].value or 0)
            bucket = by_hour[(row_date, hour)]
            bucket["sessions"] += sessions
            bucket["engaged_sessions"] += float(row.metric_values[1].value or 0)
            bucket["total_users"] += float(row.metric_values[2].value or 0)
            bucket["new_users"] += float(row.metric_values[3].value or 0)
            bucket["pageviews"] += float(row.metric_values[4].value or 0)
            bucket["conversions"] += float(row.metric_values[5].value or 0)
            bucket["duration_weighted"] += avg_duration * sessions

    rows: list[dict[str, object]] = []
    summary = {
        "pre": {"hours": 0, "sessions": 0.0, "engaged_sessions": 0.0, "new_users": 0.0, "pageviews": 0.0, "conversions": 0.0},
        "post": {"hours": 0, "sessions": 0.0, "engaged_sessions": 0.0, "new_users": 0.0, "pageviews": 0.0, "conversions": 0.0},
    }
    current = datetime.combine(start, datetime.min.time())
    final = datetime.combine(end, datetime.min.time()).replace(hour=23)
    while current <= final:
        row_date = current.date().isoformat()
        hour = current.hour
        values = by_hour.get((row_date, hour), {})
        sessions = float(values.get("sessions", 0) or 0)
        engaged = float(values.get("engaged_sessions", 0) or 0)
        period = "pre" if current < datetime.combine(copy_change_date, datetime.min.time()).replace(hour=copy_change_hour) else "post"
        summary[period]["hours"] += 1
        for key in ("sessions", "engaged_sessions", "new_users", "pageviews", "conversions"):
            summary[period][key] += float(values.get(key, 0) or 0)
        rows.append(
            {
                "date": fmt_date(row_date),
                "hour": f"{hour:02d}:00",
                "period": "Pre-copy" if period == "pre" else "Post-copy",
                "sessions": fmt_num(sessions),
                "engaged_sessions": fmt_num(engaged),
                "engagement_rate": fmt_pct((engaged / sessions) if sessions else None),
                "new_users": fmt_num(values.get("new_users", 0)),
                "pageviews": fmt_num(values.get("pageviews", 0)),
                "key_events": fmt_num(values.get("conversions", 0)),
            }
        )
        current += timedelta(hours=1)

    comparison_rows: list[dict[str, object]] = []
    for key, label in (("pre", "Pre-copy"), ("post", "Post-copy")):
        item = summary[key]
        hours = int(item["hours"] or 0)
        sessions = float(item["sessions"] or 0)
        engaged = float(item["engaged_sessions"] or 0)
        comparison_rows.append(
            {
                "period": label,
                "hours": hours,
                "sessions": fmt_num(sessions),
                "avg_sessions_per_day_equiv": fmt_num((sessions / hours * 24) if hours else None, 1),
                "engaged_sessions": fmt_num(engaged),
                "engagement_rate": fmt_pct((engaged / sessions) if sessions else None),
                "new_users": fmt_num(item["new_users"]),
                "pageviews": fmt_num(item["pageviews"]),
                "key_events": fmt_num(item["conversions"]),
            }
        )

    pre = summary["pre"]
    post = summary["post"]
    pre_daily = (float(pre["sessions"]) / int(pre["hours"]) * 24) if pre["hours"] else None
    post_daily = (float(post["sessions"]) / int(post["hours"]) * 24) if post["hours"] else None
    comparison = {
        "rows": comparison_rows,
        "hourly_rows": rows,
        "copy_change_marker": f"{fmt_date(copy_change_date)} {copy_change_hour:02d}:00",
        "pre_avg_daily_sessions_equiv": pre_daily,
        "post_avg_daily_sessions_equiv": post_daily,
        "avg_daily_session_shift": pct_change(post_daily, pre_daily),
    }
    return rows, comparison


def build_event_action_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    start: date,
    end: date,
) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    excluded = {"page_view", "session_start", "first_visit", "user_engagement", "scroll"}
    rows = conn.execute(
        f"""
        SELECT event_name, SUM(event_count) AS event_count, COUNT(DISTINCT event_date) AS active_days
        FROM ga4_event_facts
        WHERE property_id IN ({ph}) AND event_date BETWEEN ? AND ?
        GROUP BY event_name
        ORDER BY event_count DESC
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    output: list[dict[str, object]] = []
    for row in rows:
        event_name = str(row["event_name"] or "")
        if event_name in excluded:
            continue
        output.append(
            {
                "event_name": event_name,
                "event_count": fmt_num(row["event_count"]),
                "active_days": fmt_num(row["active_days"]),
            }
        )
    return output


ACTION_EVENT_EXCLUSIONS = {"page_view", "session_start", "first_visit", "user_engagement", "scroll"}


def summarize_period_metrics(
    conn: sqlite3.Connection,
    property_ids: list[str],
    start: date,
    end: date,
) -> dict[str, float]:
    ph = placeholders(property_ids)
    daily = conn.execute(
        f"""
        SELECT
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(pageviews) AS pageviews,
          AVG(avg_session_duration) AS avg_session_duration
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    key_events = conn.execute(
        f"""
        SELECT SUM(conversions) AS key_events
        FROM ga4_traffic_sources
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    excluded = tuple(ACTION_EVENT_EXCLUSIONS)
    action_events = conn.execute(
        f"""
        SELECT SUM(event_count) AS action_events
        FROM ga4_event_facts
        WHERE property_id IN ({ph})
          AND event_date BETWEEN ? AND ?
          AND event_name NOT IN ({placeholders(list(excluded))})
        """,
        (*property_ids, start.isoformat(), end.isoformat(), *excluded),
    ).fetchone()
    sessions = float(daily["sessions"] or 0)
    engaged = float(daily["engaged_sessions"] or 0)
    return {
        "sessions": sessions,
        "new_users": float(daily["new_users"] or 0),
        "engaged_sessions": engaged,
        "engagement_rate": (engaged / sessions) if sessions else 0.0,
        "pageviews": float(daily["pageviews"] or 0),
        "avg_session_duration": float(daily["avg_session_duration"] or 0),
        "key_events": float(key_events["key_events"] or 0),
        "action_events": float(action_events["action_events"] or 0),
    }


def build_week_over_week_metric_rows(pre: dict[str, float], post: dict[str, float]) -> list[dict[str, object]]:
    metrics = [
        ("sessions", "Sessions", "number"),
        ("new_users", "New users", "number"),
        ("engagement_rate", "Engagement rate", "pct"),
        ("pageviews", "Pageviews", "number"),
        ("key_events", "GA4 key events", "number"),
        ("action_events", "Action events", "number"),
        ("avg_session_duration", "Avg session duration", "duration"),
    ]
    rows: list[dict[str, object]] = []
    for key, label, kind in metrics:
        pre_value = pre.get(key)
        post_value = post.get(key)
        if kind == "pct":
            delta = (post_value or 0) - (pre_value or 0)
            change = fmt_pp(delta)
            pre_fmt = fmt_pct(pre_value)
            post_fmt = fmt_pct(post_value)
        elif kind == "duration":
            change = fmt_change(pct_change(post_value, pre_value))
            pre_fmt = fmt_duration_seconds(pre_value)
            post_fmt = fmt_duration_seconds(post_value)
        else:
            change = fmt_change(pct_change(post_value, pre_value))
            pre_fmt = fmt_num(pre_value)
            post_fmt = fmt_num(post_value)
        rows.append(
            {
                "metric": label,
                "prior_week": pre_fmt,
                "copy_week": post_fmt,
                "change": change,
            }
        )
    return rows


def build_weekly_channel_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    pre_start: date,
    pre_end: date,
    post_start: date,
    post_end: date,
) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        WITH pre AS (
          SELECT channel_group, SUM(sessions) AS sessions, SUM(new_users) AS new_users, SUM(engaged_sessions) AS engaged_sessions, SUM(conversions) AS key_events
          FROM ga4_traffic_sources
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY channel_group
        ),
        post AS (
          SELECT channel_group, SUM(sessions) AS sessions, SUM(new_users) AS new_users, SUM(engaged_sessions) AS engaged_sessions, SUM(conversions) AS key_events
          FROM ga4_traffic_sources
          WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
          GROUP BY channel_group
        ),
        joined AS (
          SELECT pre.channel_group AS channel_group, pre.sessions AS pre_sessions, post.sessions AS post_sessions,
                 pre.new_users AS pre_new_users, post.new_users AS post_new_users,
                 pre.engaged_sessions AS pre_engaged, post.engaged_sessions AS post_engaged,
                 pre.key_events AS pre_key_events, post.key_events AS post_key_events
          FROM pre LEFT JOIN post ON post.channel_group = pre.channel_group
          UNION
          SELECT post.channel_group AS channel_group, pre.sessions AS pre_sessions, post.sessions AS post_sessions,
                 pre.new_users AS pre_new_users, post.new_users AS post_new_users,
                 pre.engaged_sessions AS pre_engaged, post.engaged_sessions AS post_engaged,
                 pre.key_events AS pre_key_events, post.key_events AS post_key_events
          FROM post LEFT JOIN pre ON post.channel_group = pre.channel_group
        )
        SELECT * FROM joined
        ORDER BY COALESCE(post_sessions, 0) DESC
        """,
        (
            *property_ids,
            pre_start.isoformat(),
            pre_end.isoformat(),
            *property_ids,
            post_start.isoformat(),
            post_end.isoformat(),
        ),
    ).fetchall()
    output: list[dict[str, object]] = []
    for row in rows:
        pre_sessions = float(row["pre_sessions"] or 0)
        post_sessions = float(row["post_sessions"] or 0)
        pre_engaged = float(row["pre_engaged"] or 0)
        post_engaged = float(row["post_engaged"] or 0)
        output.append(
            {
                "channel": row["channel_group"] or "Unassigned",
                "prior_sessions": fmt_num(pre_sessions),
                "copy_sessions": fmt_num(post_sessions),
                "session_change": fmt_signed_num(post_sessions - pre_sessions),
                "session_change_pct": fmt_change(pct_change(post_sessions, pre_sessions)),
                "engagement_change": fmt_pp(((post_engaged / post_sessions) if post_sessions else 0) - ((pre_engaged / pre_sessions) if pre_sessions else 0)),
                "key_event_change": fmt_signed_num(float(row["post_key_events"] or 0) - float(row["pre_key_events"] or 0)),
            }
        )
    return output


def build_weekly_event_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    pre_start: date,
    pre_end: date,
    post_start: date,
    post_end: date,
) -> list[dict[str, object]]:
    ph = placeholders(property_ids)
    excluded = tuple(ACTION_EVENT_EXCLUSIONS)
    rows = conn.execute(
        f"""
        WITH pre AS (
          SELECT event_name, SUM(event_count) AS event_count
          FROM ga4_event_facts
          WHERE property_id IN ({ph}) AND event_date BETWEEN ? AND ? AND event_name NOT IN ({placeholders(list(excluded))})
          GROUP BY event_name
        ),
        post AS (
          SELECT event_name, SUM(event_count) AS event_count
          FROM ga4_event_facts
          WHERE property_id IN ({ph}) AND event_date BETWEEN ? AND ? AND event_name NOT IN ({placeholders(list(excluded))})
          GROUP BY event_name
        ),
        joined AS (
          SELECT pre.event_name AS event_name, pre.event_count AS pre_count, post.event_count AS post_count
          FROM pre LEFT JOIN post ON post.event_name = pre.event_name
          UNION
          SELECT post.event_name AS event_name, pre.event_count AS pre_count, post.event_count AS post_count
          FROM post LEFT JOIN pre ON post.event_name = pre.event_name
        )
        SELECT * FROM joined
        ORDER BY COALESCE(post_count, 0) DESC
        """,
        (
            *property_ids,
            pre_start.isoformat(),
            pre_end.isoformat(),
            *excluded,
            *property_ids,
            post_start.isoformat(),
            post_end.isoformat(),
            *excluded,
        ),
    ).fetchall()
    output: list[dict[str, object]] = []
    for row in rows:
        pre_count = float(row["pre_count"] or 0)
        post_count = float(row["post_count"] or 0)
        output.append(
            {
                "event": row["event_name"],
                "prior_week": fmt_num(pre_count),
                "copy_week": fmt_num(post_count),
                "change": fmt_signed_num(post_count - pre_count),
                "change_pct": fmt_change(pct_change(post_count, pre_count)),
            }
        )
    return output


def top_movers(rows: list[dict[str, object]], key: str, limit: int = 3) -> str:
    parsed: list[tuple[float, str]] = []
    for row in rows:
        value = str(row.get(key, "0")).replace(",", "")
        try:
            parsed.append((float(value), str(row.get("channel") or row.get("event") or row.get("metric"))))
        except ValueError:
            continue
    parsed.sort(key=lambda item: abs(item[0]), reverse=True)
    items = [f"{label} ({value:+.0f})" for value, label in parsed[:limit] if value]
    return ", ".join(items) if items else "no material movers"


def copy_impact_verdict(pre: dict[str, float], post: dict[str, float]) -> tuple[str, str]:
    session_change = pct_change(post.get("sessions"), pre.get("sessions"))
    action_change = pct_change(post.get("action_events"), pre.get("action_events"))
    engagement_delta = (post.get("engagement_rate") or 0) - (pre.get("engagement_rate") or 0)
    if (session_change or 0) > 0.05 and (action_change or 0) > -0.05 and engagement_delta >= -0.01:
        return "Positive", "Traffic improved without a meaningful deterioration in engagement or action quality."
    if (session_change or 0) > 0.05 and (action_change or 0) < -0.05:
        return "Mixed", "Traffic improved, but downstream action volume fell, so the copy week did not produce a clean positive outcome."
    if (session_change or 0) < -0.05 or (action_change or 0) < -0.05 or engagement_delta < -0.03:
        return "Negative", "The copy week underperformed on at least one primary demand-quality signal."
    return "Inconclusive", "The week-over-week movement was not strong enough to call a clear positive or negative effect."


def is_copy_week_over_week_request(request: ReportRequest) -> bool:
    subject = request.subject.lower()
    return "copy" in subject and (
        "week over week" in subject
        or "week-over-week" in subject
        or "wow" in subject
        or ("week" in subject and "effect" in subject)
    )


def copy_impact_windows(start: date, end: date, copy_change_date: date | None) -> tuple[date, date, date, date]:
    if copy_change_date:
        post_start = copy_change_date
        post_end = min(end, post_start + timedelta(days=6))
        pre_end = post_start - timedelta(days=1)
        pre_start = pre_end - timedelta(days=6)
        return pre_start, pre_end, post_start, post_end
    post_end = end
    post_start = post_end - timedelta(days=6)
    pre_end = post_start - timedelta(days=1)
    pre_start = pre_end - timedelta(days=6)
    return pre_start, pre_end, post_start, post_end


def build_ga4_copy_impact_summary(
    conn: sqlite3.Connection,
    request: ReportRequest,
    start: date,
    end: date,
    date_range: str,
    properties: list[dict[str, str]],
    scope_label: str,
    property_ids: list[str],
) -> ReportBuild:
    copy_change_date, copy_change_hour, copy_marker = detect_copy_change_marker(request, start, end)
    pre_start, pre_end, post_start, post_end = copy_impact_windows(start, end, copy_change_date)
    pre = summarize_period_metrics(conn, property_ids, pre_start, pre_end)
    post = summarize_period_metrics(conn, property_ids, post_start, post_end)
    verdict, verdict_reason = copy_impact_verdict(pre, post)
    wow_rows = build_week_over_week_metric_rows(pre, post)
    channel_wow_rows = build_weekly_channel_rows(conn, property_ids, pre_start, pre_end, post_start, post_end)
    event_wow_rows = build_weekly_event_rows(conn, property_ids, pre_start, pre_end, post_start, post_end)
    conversion_rows = conn.execute(
        f"""
        SELECT metric_date, SUM(conversions) AS conversions
        FROM ga4_traffic_sources
        WHERE property_id IN ({placeholders(property_ids)}) AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    conversions_by_day = {str(row["metric_date"]): float(row["conversions"] or 0) for row in conversion_rows}
    daily_rows, daily_rows_raw = build_daily_trend_rows(conn, property_ids, start, end, copy_change_date, conversions_by_day)
    trend_summary, _trend_callout = summarize_daily_trend(daily_rows_raw)
    hourly_rows, hourly_comparison = fetch_ga4_hourly_rows(properties, start, end, copy_change_date, copy_change_hour)

    session_delta = float(post.get("sessions") or 0) - float(pre.get("sessions") or 0)
    action_delta = float(post.get("action_events") or 0) - float(pre.get("action_events") or 0)
    engagement_delta = float(post.get("engagement_rate") or 0) - float(pre.get("engagement_rate") or 0)
    session_change = pct_change(post.get("sessions"), pre.get("sessions"))
    action_change = pct_change(post.get("action_events"), pre.get("action_events"))
    key_event_change = pct_change(post.get("key_events"), pre.get("key_events"))

    if verdict == "Positive":
        answer = (
            f"Positive week over week: after the {fmt_date(copy_change_date) if copy_change_date else 'copy'} change, "
            f"sessions increased {fmt_change(session_change)} and action events held up at {fmt_change(action_change)}."
        )
    elif verdict == "Mixed":
        answer = (
            f"Mixed week over week: after the {fmt_date(copy_change_date) if copy_change_date else 'copy'} change, "
            f"sessions increased {fmt_change(session_change)} ({fmt_signed_num(session_delta)} sessions), but action events fell "
            f"{fmt_change(action_change)} ({fmt_signed_num(action_delta)} events). That is not a clean positive copy effect."
        )
    elif verdict == "Negative":
        answer = (
            f"Negative week over week: after the {fmt_date(copy_change_date) if copy_change_date else 'copy'} change, "
            f"sessions moved {fmt_change(session_change)}, engagement changed {fmt_pp(engagement_delta)}, and action events moved "
            f"{fmt_change(action_change)} ({fmt_signed_num(action_delta)} events)."
        )
    else:
        answer = (
            f"Inconclusive week over week: the movement after the {fmt_date(copy_change_date) if copy_change_date else 'copy'} "
            "change is not strong enough to call positive or negative."
        )

    channel_movers = top_movers(channel_wow_rows, "session_change")
    action_movers = top_movers(event_wow_rows, "change")
    key_event_sentence = (
        f"Key events moved {fmt_change(key_event_change)}"
        if key_event_change is not None
        else f"Key events were {fmt_num(pre.get('key_events'))} in the prior week and {fmt_num(post.get('key_events'))} in the copy week"
    )
    why = (
        f"The why is mostly in source mix and action quality. The largest session movers were {channel_movers}. "
        f"The largest on-site action movers were {action_movers}. {key_event_sentence}, "
        f"while engagement shifted {fmt_pp(engagement_delta)}. This separates demand volume from visitor intent: "
        "more sessions only count as a positive copy signal if engagement and high-intent actions move with them."
    )
    caveat = (
        f"The copy change was reported as happening in the afternoon of {fmt_date(copy_change_date) if copy_change_date else 'the change day'}. "
        f"For the week-over-week read, {fmt_date(post_start)} is treated as the transition day and included in the copy week. "
        "The hourly split is supporting evidence for the transition timing; the verdict is based on full-week movement."
    )

    report = OutlookReport(
        title=f"{scope_label} Copy Change Impact Report",
        subtitle="Property Intelligence Brief",
        version="1.1.0",
        date_range=date_range,
        generated_at=fmt_generated_at(),
        question_answered=f"Did the {fmt_date(copy_change_date) if copy_change_date else 'copy'} change have a positive or negative effect, week over week?",
        kpis=[
            ReportKpi("Verdict", verdict, primary=True, note=verdict_reason),
            ReportKpi("Sessions WoW", fmt_change(session_change), note=f"{fmt_signed_num(session_delta)} sessions"),
            ReportKpi("Engagement", fmt_pp(engagement_delta), note="Copy week minus prior week"),
            ReportKpi("Action Events WoW", fmt_change(action_change), note=f"{fmt_signed_num(action_delta)} events"),
        ],
        sections=[
            ReportSection(
                title="Executive Answer",
                paragraphs=[answer, verdict_reason],
                callout=f"Verdict: {verdict}. Prior week: {fmt_date_range(pre_start, pre_end)}. Copy week: {fmt_date_range(post_start, post_end)}.",
            ),
            ReportSection(
                title="What Changed Week Over Week",
                paragraphs=[trend_summary],
                tables=[
                    ReportTable(
                        title="Week-Over-Week Metrics",
                        intro="Primary demand, engagement, and action-quality measures before and after the copy change.",
                        columns=[
                            ("metric", "Metric"),
                            ("prior_week", f"Prior week ({fmt_date_range(pre_start, pre_end)})"),
                            ("copy_week", f"Copy week ({fmt_date_range(post_start, post_end)})"),
                            ("change", "Change"),
                        ],
                        rows=wow_rows,
                    )
                ],
            ),
            ReportSection(
                title="How And Why",
                paragraphs=[why],
                tables=[
                    ReportTable(
                        title="Channel Drivers",
                        intro="Channel-level movement explains whether the change came from source mix or broader demand.",
                        columns=[
                            ("channel", "Channel"),
                            ("prior_sessions", "Prior sessions"),
                            ("copy_sessions", "Copy sessions"),
                            ("session_change", "Session change"),
                            ("session_change_pct", "Session change %"),
                            ("engagement_change", "Engagement change"),
                            ("key_event_change", "Key event change"),
                        ],
                        rows=channel_wow_rows,
                    )
                ],
            ),
            ReportSection(
                title="Action Quality",
                paragraphs=[
                    "These are the on-site behaviors most useful for judging whether the copy change improved visitor intent, not just traffic volume."
                ],
                tables=[
                    ReportTable(
                        title="Action Event Movement",
                        intro="GA4 event facts excluding page_view/session_start-style traffic events.",
                        columns=[
                            ("event", "Event"),
                            ("prior_week", "Prior week"),
                            ("copy_week", "Copy week"),
                            ("change", "Change"),
                            ("change_pct", "Change %"),
                        ],
                        rows=event_wow_rows,
                    )
                ],
            ),
            ReportSection(
                title="Timing Caveat",
                paragraphs=[caveat],
                tables=[
                    ReportTable(
                        title="Hourly Pre/Post Summary",
                        intro="Normalized hourly GA4 read around the afternoon transition point.",
                        columns=[
                            ("period", "Period"),
                            ("hours", "Hours"),
                            ("sessions", "Sessions"),
                            ("avg_sessions_per_day_equiv", "Sessions/day equiv."),
                            ("engaged_sessions", "Engaged sessions"),
                            ("engagement_rate", "Engagement rate"),
                            ("new_users", "New users"),
                            ("pageviews", "Pageviews"),
                            ("key_events", "Key events"),
                        ],
                        rows=hourly_comparison.get("rows", []) if hourly_comparison else [],
                    )
                ]
                if hourly_comparison
                else [],
                warning=None
                if hourly_comparison
                else "Hourly GA4 rows were not available for this request, so the timing caveat is based on daily data only.",
            ),
            ReportSection(
                title="Daily Context",
                tables=[
                    ReportTable(
                        title="Daily Trend",
                        intro="Daily GA4 traffic and engagement with the copy-change day marked.",
                        columns=[
                            ("date", "Date"),
                            ("trend_marker", "Trend marker"),
                            ("sessions", "Sessions"),
                            ("day_over_day", "Day-over-day"),
                            ("new_users", "New users"),
                            ("engaged_sessions", "Engaged sessions"),
                            ("engagement_rate", "Engagement rate"),
                            ("bounce_rate", "Bounce rate"),
                            ("avg_session_duration", "Avg duration"),
                            ("pageviews", "Pageviews"),
                            ("key_events", "Key events"),
                        ],
                        rows=daily_rows,
                    )
                ],
            ),
        ],
        source_note="GA4 daily metrics, GA4 traffic source channel-group rows, GA4 event facts, and GA4 hourly API rows where available.",
    )
    executive_rows = [
        {"field": "Verdict", "value": verdict},
        {"field": "Answer", "value": answer},
        {"field": "Why", "value": why},
        {"field": "Timing caveat", "value": caveat},
    ]
    workbook_sheets = {
        "Executive Answer": executive_rows,
        "Week Over Week": wow_rows,
        "Channel Drivers": channel_wow_rows,
        "Action Events WoW": event_wow_rows,
        "Hourly Pre Post": hourly_comparison.get("rows", []) if hourly_comparison else [],
        "Hourly Detail": hourly_rows,
        "Daily Trend": daily_rows,
    }
    return ReportBuild(
        report_type="ga4_traffic_summary",
        report=report,
        workbook_sheets=workbook_sheets,
        spec={
            "request": asdict(request),
            "report_type": "ga4_traffic_summary",
            "analysis_mode": "copy_change_week_over_week",
            "sources": ["ga4_daily_metrics", "ga4_traffic_sources", "ga4_event_facts", "Google Analytics Data API hourly report"],
            "date_range": date_range,
            "scope_label": scope_label,
            "property_count": len(properties),
            "property_ids": property_ids,
            "copy_change_date": copy_change_date.isoformat() if copy_change_date else None,
            "copy_change_hour": copy_change_hour,
            "copy_change_marker": copy_marker,
            "prior_week": {"start": pre_start.isoformat(), "end": pre_end.isoformat()},
            "copy_week": {"start": post_start.isoformat(), "end": post_end.isoformat()},
            "verdict": verdict,
            "engagement_rate_method": "Computed as SUM(engaged_sessions) / SUM(sessions).",
        },
    )


def build_organic_search_share(conn: sqlite3.Connection, request: ReportRequest) -> ReportBuild:
    start, end, date_range = resolve_date_window(conn, request)
    properties = load_portfolio_properties()
    property_ids = [item["property_id"] for item in properties]
    summary = fetch_share_summary(conn, property_ids, start, end)
    gsc_summary = fetch_gsc_summary(conn, property_ids, start, end)
    channel_rows = build_channel_mix_rows(conn, property_ids, start, end)
    monthly_rows = build_organic_monthly_rows(conn, property_ids, start, end)
    property_rows = build_organic_property_opportunity_rows(conn, properties, start, end)
    top_queries = build_gsc_query_rows(conn, property_ids, start, end)
    opportunity_queries = build_gsc_query_rows(conn, property_ids, start, end, opportunity=True)
    segment_rows, intent_rows, brand_summary = build_brand_nonbrand_intent_rows(conn, properties, start, end)
    landing_type_rows, landing_detail_rows = build_organic_landing_page_rows(conn, property_ids, start, end)
    landing_available = bool(landing_detail_rows)
    paid_overlap_rows = build_paid_organic_overlap_rows(conn, property_ids, start, end)
    forecast_rows, forecast_summary = build_organic_forecast_rows(opportunity_queries)
    ahrefs_rows, ahrefs_summary = build_ahrefs_overlay_rows(conn)
    heatmap_rows = build_executive_heatmap_rows(property_rows)
    dataforseo_rows, dataforseo_summary, dataforseo_keywords, dataforseo_domains, dataforseo_gaps = build_dataforseo_organic_rows(conn)
    recommendation_rows = build_organic_growth_actions(summary, gsc_summary, property_rows, opportunity_queries, dataforseo_summary)
    pilot_rows = build_pilot_organic_rows(conn, start, end)

    pilot_share = "-"
    control_share = "-"
    if pilot_rows:
        pilot_ids = [pair["pilot_id"] for pair in load_pilot_pairs()]
        control_ids = [pair["control_id"] for pair in load_pilot_pairs()]
        pilot_share = fmt_pct(fetch_share_summary(conn, pilot_ids, start, end).get("organic_share"))
        control_share = fmt_pct(fetch_share_summary(conn, control_ids, start, end).get("organic_share"))

    organic_sessions = float(summary.get("organic_sessions") or 0)
    organic_aggregate = conn.execute(
        f"""
        SELECT SUM(engaged_sessions) AS engaged_sessions, SUM(conversions) AS key_events
        FROM ga4_traffic_sources
        WHERE property_id IN ({placeholders(property_ids)}) AND channel_group = 'Organic Search' AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    organic_engaged = float(organic_aggregate["engaged_sessions"] or 0)
    organic_key_events = organic_aggregate["key_events"]
    latest_month = monthly_rows[-1] if monthly_rows else {}
    strongest_property = property_rows[0]["property"] if property_rows else "the portfolio"
    organic_channel_rank = next((idx + 1 for idx, row in enumerate(channel_rows) if row["channel"] == "Organic Search"), None)
    organic_channel_sentence = (
        f"Organic Search is the #{organic_channel_rank} GA4 channel by sessions in this window."
        if organic_channel_rank else "Organic Search is present in GA4 channel rows for this window."
    )
    executive = (
        f"Across {len(properties)} governed portfolio properties, Organic Search represented "
        f"{fmt_pct(summary.get('organic_share'))} of total traffic from {date_range} "
        f"({fmt_num(summary.get('organic_sessions'))} Organic Search sessions out of "
        f"{fmt_num(summary.get('total_sessions'))} total sessions). {organic_channel_sentence} "
        f"GSC adds {fmt_num(gsc_summary.get('clicks'))} Google organic clicks and "
        f"{fmt_num(gsc_summary.get('impressions'))} impressions over the available GSC portion of the window."
    )
    if pilot_rows:
        executive += f" The active pilot sites were {pilot_share} organic versus {control_share} for controls."

    dataforseo_read = (
        f"DataForSEO is advisory here, not the source of record for traffic. The latest stored DataForSEO SERP read "
        f"({fmt_date(dataforseo_summary.get('latest_serp')) if dataforseo_summary.get('latest_serp') else '-'}) found target properties in "
        f"{dataforseo_summary.get('serp_found', 0)} of {dataforseo_summary.get('serp_checks', 0)} stored keyword checks. "
        f"Keyword-demand rows currently cover {dataforseo_summary.get('keyword_properties', 0)} properties, so DataForSEO is strongest for "
        "specific search-opportunity diagnosis, not a complete portfolio traffic count."
    )
    growth_read = (
        f"The fastest growth path is a sequence: protect the properties already producing volume "
        f"({strongest_property} leads the stored property table), improve CTR on high-impression GSC queries, close DataForSEO SERP gaps, "
        "then scale the same brief pattern across properties with low organic share but proven search demand."
    )
    nonbrand_read = (
        f"GSC query classification shows non-brand discovery is {fmt_pct(brand_summary.get('nonbrand_click_share'))} of classified Google organic clicks "
        f"({fmt_num(brand_summary.get('nonbrand_clicks'))} non-brand clicks versus {fmt_num(brand_summary.get('brand_clicks'))} brand/property clicks). "
        "This matters because brand demand is defensive capture; non-brand demand is the scalable growth pool."
    )
    forecast_read = (
        f"A conservative CTR lift model across the high-impression query opportunity table identifies roughly "
        f"{fmt_num(forecast_summary.get('query_level_model'))} incremental Google organic clicks if those queries move to reachable CTR targets. "
        f"A flat +1 point CTR improvement across those opportunity rows would be worth about {fmt_num(forecast_summary.get(0.01))} clicks."
    )
    ahrefs_read = (
        f"Ahrefs is now useful as the technical/authority overlay: latest average Site Audit health is "
        f"{fmt_num(ahrefs_summary.get('avg_health'), 1)} and latest average Domain Rating is {fmt_num(ahrefs_summary.get('avg_dr'), 1)}. "
        "Use it to decide whether a property needs technical cleanup, authority support, or content/CTR work."
    )

    report = OutlookReport(
        title="Executive Organic Growth Intelligence Report",
        subtitle="Property Intelligence Brief",
        version="3.0.0",
        date_range=date_range,
        generated_at=fmt_generated_at(),
        question_answered=request.subject,
        kpis=[
            ReportKpi("Organic Sessions", fmt_num(summary.get("organic_sessions")), primary=True),
            ReportKpi("Organic % Of Traffic", fmt_pct(summary.get("organic_share"))),
            ReportKpi("GSC Clicks", fmt_num(gsc_summary.get("clicks")), note=f"CTR {fmt_pct(gsc_summary.get('ctr'))}"),
            ReportKpi("Non-Brand Click Share", fmt_pct(brand_summary.get("nonbrand_click_share")), note=f"{fmt_num(forecast_summary.get('query_level_model'))} modeled incremental clicks"),
        ],
        sections=[
            ReportSection(
                title="Executive Read",
                paragraphs=[executive, nonbrand_read, growth_read, forecast_read],
                callout=(
                    f"Current latest month in the workbook: {latest_month.get('month', '-')}; "
                    f"organic sessions {latest_month.get('organic_sessions', '-')}; GSC clicks {latest_month.get('gsc_clicks', '-')}. "
                    f"Pilot organic share: {pilot_share}; control organic share: {control_share}."
                ),
            ),
            ReportSection(
                title="Where Organic Traffic Comes From",
                paragraphs=[
                    "GA4 identifies Organic Search as a channel after arrival; GSC explains the Google queries creating visibility; DataForSEO explains the live SERP surfaces, competitor domains, local-pack conditions, and keyword-demand context around those queries.",
                    "The channel table shows the full traffic mix so organic can be understood as a share of total demand, not an isolated number.",
                ],
                tables=[
                    ReportTable(
                        title="GA4 Channel Mix",
                        columns=[
                            ("channel", "Channel"),
                            ("sessions", "Sessions"),
                            ("share", "Share"),
                            ("new_users", "New users"),
                            ("engagement_rate", "Engagement"),
                            ("key_events", "Key events"),
                        ],
                        rows=channel_rows,
                    ),
                    ReportTable(
                        title="Top GSC Queries",
                        intro="Google Search Console query rollup for the selected window, ranked by clicks.",
                        columns=[
                            ("query", "Query"),
                            ("clicks", "Clicks"),
                            ("impressions", "Impressions"),
                            ("ctr", "CTR"),
                            ("avg_position", "Avg position"),
                            ("clicking_properties", "Properties with clicks"),
                            ("property_count", "Properties with impressions"),
                            ("dominant_property", "Dominant property"),
                        ],
                        rows=top_queries,
                        limit=15,
                    ),
                ],
            ),
            ReportSection(
                title="Brand Vs Discovery",
                paragraphs=[
                    "This separates defensive brand/property-name capture from scalable discovery demand. Executives should read non-brand as the growth engine and brand as protection of known demand.",
                ],
                tables=[
                    ReportTable(
                        title="Brand / Non-Brand Mix",
                        columns=[
                            ("segment", "Segment"),
                            ("clicks", "Clicks"),
                            ("click_share", "Click share"),
                            ("impressions", "Impressions"),
                            ("impression_share", "Impression share"),
                            ("ctr", "CTR"),
                            ("avg_position", "Avg position"),
                            ("properties", "Properties"),
                            ("top_query", "Top query"),
                        ],
                        rows=segment_rows,
                    ),
                    ReportTable(
                        title="Intent Cluster Mix",
                        intro="Classified GSC query clusters, grouped by brand/discovery and renter intent.",
                        columns=[
                            ("segment", "Segment"),
                            ("intent_cluster", "Intent cluster"),
                            ("clicks", "Clicks"),
                            ("click_share", "Click share"),
                            ("impressions", "Impressions"),
                            ("ctr", "CTR"),
                            ("avg_position", "Avg position"),
                            ("properties", "Properties"),
                            ("top_query", "Top query"),
                        ],
                        rows=intent_rows,
                        limit=12,
                    ),
                ],
            ),
            ReportSection(
                title="Where Organic Lands",
                paragraphs=[
                    "This lens uses GA4 event-level organic landing-page data as a session proxy. It shows whether organic demand lands mostly on homepages or on deeper pages that can scale discovery intent."
                ]
                if landing_available
                else [
                    "Landing-page distribution is the next high-value collection gap. The current stored GA4 event facts have event volume, but channel/source/landing-page fields are blank for this 12-month window, so the report does not infer page-level organic performance.",
                    "Recommendation: add a governed GA4 landing-page-by-sessionDefaultChannelGroup extraction so future executive reads can separate homepage brand capture from scalable floorplan, amenities, neighborhood, specials, and contact-page discovery.",
                ],
                tables=[
                    ReportTable(
                        title="Organic Landing Page Types",
                        columns=[
                            ("page_type", "Page type"),
                            ("organic_sessions_proxy", "Organic sessions proxy"),
                            ("share", "Share"),
                            ("organic_events", "Organic events"),
                            ("action_events", "Action events"),
                            ("action_events_per_session", "Action / session"),
                            ("distinct_pages", "Distinct pages"),
                        ],
                        rows=landing_type_rows,
                    )
                ],
            ),
            ReportSection(
                title="DataForSEO Read",
                paragraphs=[dataforseo_read, ahrefs_read],
                tables=[
                    ReportTable(
                        title="DataForSEO Source Summary",
                        intro="Stored DataForSEO rows in the local Data Pond. Fresh paid pulls should be scoped and approved before expanding coverage.",
                        columns=[
                            ("lane", "Lane"),
                            ("latest", "Latest"),
                            ("coverage", "Coverage"),
                            ("read", "What it says"),
                        ],
                        rows=dataforseo_rows,
                    ),
                    ReportTable(
                        title="Ahrefs Overlay",
                        intro="Ahrefs is a second advisory SEO lens for technical health, GSC summaries, and domain authority.",
                        columns=[
                            ("lane", "Lane"),
                            ("latest", "Latest"),
                            ("coverage", "Coverage"),
                            ("read", "What it says"),
                        ],
                        rows=ahrefs_rows,
                    ),
                    ReportTable(
                        title="DataForSEO Keyword Demand",
                        columns=[
                            ("keyword", "Keyword"),
                            ("property_code", "Property code"),
                            ("search_volume", "Search volume"),
                            ("competition", "Competition"),
                            ("cpc", "CPC"),
                        ],
                        rows=dataforseo_keywords,
                        limit=15,
                    ),
                    ReportTable(
                        title="Domains Occupying Stored SERPs",
                        intro="Domains DataForSEO saw most often across stored SERP result rows.",
                        columns=[
                            ("domain", "Domain"),
                            ("appearances", "Appearances"),
                            ("best_rank", "Best rank"),
                            ("keywords_seen", "Keywords seen"),
                        ],
                        rows=dataforseo_domains,
                        limit=12,
                    ),
                ],
            ),
            ReportSection(
                title="How To Increase Organic",
                paragraphs=[
                    "The action plan below is ordered by likely speed to impact and source confidence. GSC and GA4 tell us where owned demand already exists; DataForSEO tells us what the outside search page looks like and where Venterra is missing.",
                ],
                tables=[
                    ReportTable(
                        title="Organic Growth Action Plan",
                        columns=[
                            ("priority", "Priority"),
                            ("growth_lane", "Growth lane"),
                            ("action", "Action"),
                            ("why_it_matters", "Why it matters"),
                        ],
                        rows=recommendation_rows,
                    ),
                    ReportTable(
                        title="Incremental Click Forecast",
                        intro="Modeled lift if high-impression, low-CTR queries reach practical CTR targets. This is directional planning math, not a guarantee.",
                        columns=[
                            ("query", "Query"),
                            ("impressions", "Impressions"),
                            ("current_ctr", "Current CTR"),
                            ("modeled_ctr", "Modeled CTR"),
                            ("incremental_clicks", "Incremental clicks"),
                            ("avg_position", "Avg position"),
                            ("clicking_properties", "Properties with clicks"),
                            ("property_count", "Properties with impressions"),
                            ("dominant_property", "Dominant property"),
                        ],
                        rows=forecast_rows,
                        limit=12,
                    ),
                    ReportTable(
                        title="High-Impression Query Opportunities",
                        intro="Queries with meaningful impressions, low CTR, and reachable average positions.",
                        columns=[
                            ("query", "Query"),
                            ("clicks", "Clicks"),
                            ("impressions", "Impressions"),
                            ("ctr", "CTR"),
                            ("avg_position", "Avg position"),
                            ("clicking_properties", "Properties with clicks"),
                            ("property_count", "Properties with impressions"),
                            ("dominant_property", "Dominant property"),
                        ],
                        rows=opportunity_queries,
                        limit=15,
                    ),
                ],
            ),
            ReportSection(
                title="Executive Action Map",
                paragraphs=[
                    "Use this as the operating map: protect high-quality organic winners, fix CTR where visibility already exists, grow discovery where demand is visible but under-captured, and repair post-click quality where organic traffic is not engaging.",
                ],
                tables=[
                    ReportTable(
                        title="Property Action Buckets",
                        columns=[
                            ("property", "Property"),
                            ("property_code", "Property code"),
                            ("action_bucket", "Action bucket"),
                            ("reason", "Reason"),
                            ("organic_sessions", "Organic sessions"),
                            ("organic_share", "Organic share"),
                            ("gsc_impressions", "GSC impressions"),
                            ("gsc_ctr", "GSC CTR"),
                        ],
                        rows=heatmap_rows,
                        limit=25,
                    ),
                    ReportTable(
                        title="Paid / Organic Overlap",
                        intro="Where paid keywords and GSC organic queries overlap exactly, this flags whether paid may be defending strong organic terms or filling gaps.",
                        columns=[
                            ("keyword", "Keyword"),
                            ("paid_cost", "Paid cost"),
                            ("paid_clicks", "Paid clicks"),
                            ("paid_conversions", "Paid conversions"),
                            ("organic_clicks", "Organic clicks"),
                            ("organic_impressions", "Organic impressions"),
                            ("organic_ctr", "Organic CTR"),
                            ("organic_position", "Organic position"),
                            ("read", "Read"),
                        ],
                        rows=paid_overlap_rows,
                        limit=12,
                    ),
                ],
            ),
            ReportSection(
                title="Monthly Organic Trend",
                tables=[
                    ReportTable(
                        title="Monthly Trend",
                        columns=[
                            ("month", "Month"),
                            ("organic_sessions", "Organic sessions"),
                            ("organic_sessions_mom", "MoM"),
                            ("organic_new_users", "Organic new users"),
                            ("organic_share", "Organic share"),
                            ("organic_engagement_rate", "Engagement"),
                            ("organic_key_events", "Key events"),
                            ("gsc_clicks", "GSC clicks"),
                            ("gsc_impressions", "GSC impressions"),
                        ],
                        rows=monthly_rows,
                    )
                ],
            ),
            ReportSection(
                title="Property Opportunity Table",
                tables=[
                    ReportTable(
                        title="Property Organic Performance And Opportunity",
                        intro="All governed portfolio properties with GA4 coverage, ranked by Organic Search sessions.",
                        columns=[
                            ("rank", "Rank"),
                            ("property", "Property"),
                            ("property_code", "Property code"),
                            ("organic_sessions", "Organic sessions"),
                            ("organic_share", "Organic share"),
                            ("organic_new_users", "Organic new users"),
                            ("organic_engagement_rate", "Engagement"),
                            ("organic_key_events", "Key events"),
                            ("gsc_clicks", "GSC clicks"),
                            ("gsc_impressions", "GSC impressions"),
                            ("gsc_ctr", "GSC CTR"),
                            ("gsc_avg_position", "GSC avg position"),
                            ("opportunity_read", "Opportunity read"),
                        ],
                        rows=property_rows,
                        limit=25,
                    )
                ],
            ),
            ReportSection(
                title="Pilot And Control Organic Share",
                tables=[
                    ReportTable(
                        title="Pilot And Control Organic Share",
                        intro="Active pilot/control pairs ranked by pilot Organic Search share.",
                        columns=[
                            ("pilot", "Pilot"),
                            ("control", "Control"),
                            ("pilot_organic_share", "Pilot organic %"),
                            ("control_organic_share", "Control organic %"),
                            ("point_gap", "Point gap"),
                            ("pilot_organic_sessions", "Pilot organic sessions"),
                            ("pilot_total_sessions", "Pilot total sessions"),
                        ],
                        rows=pilot_rows,
                    )
                ],
            ),
        ],
        source_note=(
            "Data Pond tables: ga4_daily_metrics, ga4_traffic_sources, gsc_daily_metrics, gsc_queries, "
            "ga4_event_facts, google_ads_keywords, ahrefs_site_audit_project_health, ahrefs_domain_rating_snapshots, "
            "dataforseo_property_keyword_rankings, dataforseo_serp_results, dataforseo_keyword_metrics, "
            "dataforseo_onpage_page_snapshots, and dataforseo_ai_visibility_probes. GA4 is authoritative for sessions; "
            "GSC is authoritative for owned Google search clicks/impressions; DataForSEO is advisory for SERP composition and keyword demand."
        ),
    )
    return ReportBuild(
        report_type="organic_search_share",
        report=report,
        workbook_sheets={
            "Executive Actions": recommendation_rows,
            "Executive Action Map": heatmap_rows,
            "Brand Nonbrand": segment_rows,
            "Intent Clusters": intent_rows,
            "Landing Page Types": landing_type_rows,
            "Landing Page Detail": landing_detail_rows,
            "Incremental Forecast": forecast_rows,
            "Paid Organic Overlap": paid_overlap_rows,
            "Ahrefs Overlay": ahrefs_rows,
            "Monthly Trend": monthly_rows,
            "Channel Mix": channel_rows,
            "Property Opportunities": property_rows,
            "Top GSC Queries": top_queries,
            "GSC Query Opportunities": opportunity_queries,
            "DataForSEO Summary": dataforseo_rows,
            "DataForSEO Keywords": dataforseo_keywords,
            "DataForSEO SERP Domains": dataforseo_domains,
            "DataForSEO SERP Gaps": dataforseo_gaps,
            "Pilot Post Launch": pilot_rows,
        },
        spec={
            "request": asdict(request),
            "report_type": "organic_search_share",
            "sources": [
                "ga4_daily_metrics",
                "ga4_traffic_sources",
                "ga4_event_facts",
                "gsc_daily_metrics",
                "gsc_queries",
                "google_ads_keywords",
                "ahrefs_site_audit_project_health",
                "ahrefs_domain_rating_snapshots",
                "ahrefs_gsc_daily_summary",
                "dataforseo_property_keyword_rankings",
                "dataforseo_serp_results",
                "dataforseo_keyword_metrics",
                "dataforseo_onpage_page_snapshots",
                "dataforseo_ai_visibility_probes",
                "pilot_control_cwv_config",
            ],
            "date_range": date_range,
            "portfolio_property_count": len(properties),
            "gsc_window": {
                "start": gsc_summary.get("min_date"),
                "end": gsc_summary.get("max_date"),
                "properties": gsc_summary.get("properties"),
            },
            "dataforseo_latest": {
                "keyword_metrics": dataforseo_summary.get("latest_keyword"),
                "labs_ranked_keywords": dataforseo_summary.get("latest_labs"),
                "serp_rankings": dataforseo_summary.get("latest_serp"),
                "onpage": dataforseo_summary.get("latest_onpage"),
                "ai_visibility": dataforseo_summary.get("latest_ai"),
            },
            "ahrefs_latest": {
                "site_audit": ahrefs_summary.get("latest_health"),
                "domain_rating": ahrefs_summary.get("latest_dr"),
                "gsc_summary": ahrefs_summary.get("latest_gsc"),
            },
            "brand_nonbrand_method": "GSC queries are classified by property-name tokens and generic renter-intent language. Treat as directional because ambiguous queries may be misclassified.",
            "landing_page_method": (
                "GA4 event-level organic landing_page/page_path rows are used as a session proxy when populated. "
                "For this run, stored event facts had blank channel/source/landing-page dimensions, so landing-page performance is reported as a collection gap."
                if not landing_available
                else "GA4 event-level organic landing_page/page_path rows are used as a session proxy because the stored daily channel table does not carry landing-page dimensions."
            ),
            "forecast_method": "Incremental clicks are modeled from high-impression low-CTR GSC opportunities using practical CTR targets, not a guaranteed forecast.",
            "method": "GA4 Organic Search channel rows for traffic share; GSC query/daily rows for Google organic demand; GA4 event facts for landing-page proxy; Google Ads keyword overlap; Ahrefs technical/authority overlay; DataForSEO stored rows for advisory SERP and demand diagnosis.",
        },
    )


def build_ga4_traffic_summary(conn: sqlite3.Connection, request: ReportRequest) -> ReportBuild:
    start, end, date_range = resolve_date_window(conn, request)
    properties, scope_label = resolve_scoped_properties(request)
    property_ids = [item["property_id"] for item in properties]
    if is_copy_week_over_week_request(request):
        return build_ga4_copy_impact_summary(conn, request, start, end, date_range, properties, scope_label, property_ids)
    ph = placeholders(property_ids)
    channel_rows_raw = conn.execute(
        f"""
        SELECT
          channel_group,
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(conversions) AS conversions
        FROM ga4_traffic_sources
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY channel_group
        ORDER BY sessions DESC
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    total_sessions = sum(float(row["sessions"] or 0) for row in channel_rows_raw)
    channel_rows = [
        {
            "channel": row["channel_group"] or "Unassigned",
            "sessions": fmt_num(row["sessions"]),
            "share": fmt_pct((float(row["sessions"] or 0) / total_sessions) if total_sessions else None),
            "new_users": fmt_num(row["new_users"]),
            "engaged_sessions": fmt_num(row["engaged_sessions"]),
            "engagement_rate": fmt_pct((float(row["engaged_sessions"] or 0) / float(row["sessions"] or 0)) if row["sessions"] else None),
            "key_events": fmt_num(row["conversions"]),
        }
        for row in channel_rows_raw
    ]
    conversion_rows = conn.execute(
        f"""
        SELECT metric_date, SUM(conversions) AS conversions
        FROM ga4_traffic_sources
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    conversions_by_day = {str(row["metric_date"]): float(row["conversions"] or 0) for row in conversion_rows}
    total_key_events = sum(conversions_by_day.values())
    daily = conn.execute(
        f"""
        SELECT
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(pageviews) AS pageviews,
          AVG(avg_session_duration) AS avg_session_duration,
          AVG(bounce_rate) AS bounce_rate
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    summary_sessions = float(daily["sessions"] or 0)
    summary_engaged = float(daily["engaged_sessions"] or 0)
    summary_engagement_rate = (summary_engaged / summary_sessions) if summary_sessions else None
    copy_change_date, copy_change_hour, copy_marker = detect_copy_change_marker(request, start, end)
    daily_rows, daily_rows_raw = build_daily_trend_rows(conn, property_ids, start, end, copy_change_date, conversions_by_day)
    trend_summary, trend_callout = summarize_daily_trend(daily_rows_raw)
    hourly_rows, hourly_comparison = fetch_ga4_hourly_rows(properties, start, end, copy_change_date, copy_change_hour)
    action_rows = build_event_action_rows(conn, property_ids, start, end)
    if hourly_comparison:
        copy_read = (
            f"Copy-change marker: {hourly_comparison['copy_change_marker']} is treated as the transition point. "
        f"The pre-copy period averaged {fmt_num(hourly_comparison['pre_avg_daily_sessions_equiv'], 1)} sessions per day-equivalent; "
        f"the post-copy period averaged {fmt_num(hourly_comparison['post_avg_daily_sessions_equiv'], 1)}, "
        f"a directional {fmt_change(hourly_comparison['avg_daily_session_shift'])} shift. "
            f"This uses GA4 hourly rows so the {fmt_date(copy_change_date) if copy_change_date else 'copy-change'} afternoon change is not blended into the full day."
        )
    else:
        copy_read = build_copy_change_read(daily_rows_raw, copy_change_date)
    executive_paragraphs = [
        f"{scope_label} traffic produced {fmt_num(daily['sessions'])} sessions and {fmt_num(daily['new_users'])} new users from {date_range}.",
        trend_summary,
        "Channel mix is shown below so the report can separate source composition from total demand volume.",
    ]
    if copy_read:
        executive_paragraphs.insert(2, copy_read)
    title = "Portfolio Traffic Summary Report" if scope_label == "Portfolio" else f"{scope_label} Web Traffic Trend Report"
    report = OutlookReport(
        title=title,
        subtitle="Property Intelligence Brief",
        version="1.0.0",
        date_range=date_range,
        generated_at=fmt_generated_at(),
        question_answered=request.subject,
        kpis=[
            ReportKpi("Total Sessions", fmt_num(daily["sessions"]), primary=True),
            ReportKpi("New Users", fmt_num(daily["new_users"])),
            ReportKpi("Engagement Rate", fmt_pct(summary_engagement_rate), note="Computed as engaged sessions divided by sessions."),
            ReportKpi("Key Events", fmt_num(total_key_events), note="GA4 conversions summed from channel rows."),
        ],
        sections=[
            ReportSection(
                title="Executive Read",
                paragraphs=executive_paragraphs,
                callout=trend_callout or None,
            ),
            ReportSection(
                title="Copy Change Split",
                paragraphs=[
                    f"The copy change was reported as happening in the afternoon of {fmt_date(copy_change_date) if copy_change_date else 'the change day'}. This report uses 12:00 as the split point for the hourly pre/post read."
                ]
                if hourly_comparison
                else [],
                tables=[
                    ReportTable(
                        title="Hourly Pre/Post Summary",
                        intro="Pre/post comparison normalized to sessions per day-equivalent so the partial transition day is not over-weighted.",
                        columns=[
                            ("period", "Period"),
                            ("hours", "Hours"),
                            ("sessions", "Sessions"),
                            ("avg_sessions_per_day_equiv", "Sessions/day equiv."),
                            ("engaged_sessions", "Engaged sessions"),
                            ("engagement_rate", "Engagement rate"),
                            ("new_users", "New users"),
                            ("pageviews", "Pageviews"),
                            ("key_events", "Key events"),
                        ],
                        rows=hourly_comparison.get("rows", []) if hourly_comparison else [],
                    )
                ],
            )
            if hourly_comparison
            else ReportSection(
                title="Copy Change Split",
                warning="Hourly GA4 rows were not available for this request, so the copy-change read is daily only.",
            ),
            ReportSection(
                title="Daily Trend",
                tables=[
                    ReportTable(
                        title="Daily Trend",
                        intro="Daily GA4 traffic and engagement with the copy-change day marked when requested.",
                        columns=[
                            ("date", "Date"),
                            ("trend_marker", "Trend marker"),
                            ("sessions", "Sessions"),
                            ("day_over_day", "Day-over-day"),
                            ("new_users", "New users"),
                            ("engaged_sessions", "Engaged sessions"),
                            ("engagement_rate", "Engagement rate"),
                            ("bounce_rate", "Bounce rate"),
                            ("avg_session_duration", "Avg duration"),
                            ("pageviews", "Pageviews"),
                            ("key_events", "Key events"),
                        ],
                        rows=daily_rows,
                    )
                ],
            ),
            ReportSection(
                title="Channel Performance",
                tables=[
                    ReportTable(
                        title="Channel Performance",
                        columns=[
                            ("channel", "Channel"),
                            ("sessions", "Sessions"),
                            ("share", "Share of sessions"),
                            ("new_users", "New users"),
                            ("engaged_sessions", "Engaged sessions"),
                            ("engagement_rate", "Engagement rate"),
                            ("key_events", "Key events"),
                        ],
                        rows=channel_rows,
                    )
                ],
            ),
            ReportSection(
                title="On-Site Action Events",
                tables=[
                    ReportTable(
                        title="On-Site Action Events",
                        intro="GA4 event facts excluding page_view/session_start-style traffic events.",
                        columns=[
                            ("event_name", "Event"),
                            ("event_count", "Count"),
                            ("active_days", "Active days"),
                        ],
                        rows=action_rows,
                    )
                ],
            ),
        ],
        source_note="GA4 daily metrics and GA4 traffic source channel-group rows from portfolio_analytics.db.",
    )
    workbook_sheets = {
        "Daily Trend": daily_rows,
        "Hourly Pre Post": hourly_comparison.get("rows", []) if hourly_comparison else [],
        "Hourly Detail": hourly_rows,
        "Channel Performance": channel_rows,
        "Action Events": action_rows,
    }
    return ReportBuild(
        report_type="ga4_traffic_summary",
        report=report,
        workbook_sheets=workbook_sheets,
        spec={
            "request": asdict(request),
            "report_type": "ga4_traffic_summary",
            "sources": ["ga4_daily_metrics", "ga4_traffic_sources", "ga4_event_facts", "Google Analytics Data API hourly report"],
            "date_range": date_range,
            "scope_label": scope_label,
            "property_count": len(properties),
            "property_ids": property_ids,
            "copy_change_date": copy_change_date.isoformat() if copy_change_date else None,
            "copy_change_hour": copy_change_hour,
            "copy_change_marker": copy_marker,
            "engagement_rate_method": "Computed as SUM(engaged_sessions) / SUM(sessions) when daily engagement_rate is not materialized.",
        },
    )


def _json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _latest_run_date(conn: sqlite3.Connection, table: str, property_id: str) -> str | None:
    row = conn.execute(f"SELECT MAX(run_date) AS run_date FROM {table} WHERE property_id = ?", (property_id,)).fetchone()
    return str(row["run_date"]) if row and row["run_date"] else None


def _content_recommendations(
    property_name: str,
    keyword_rows: list[dict[str, object]],
    gsc_rows: list[dict[str, object]],
    onpage: sqlite3.Row | None,
    ai_row: sqlite3.Row | None,
) -> list[dict[str, object]]:
    recommendations: list[dict[str, object]] = []
    nonbrand = [
        row for row in keyword_rows
        if property_name.lower().replace("the ", "") not in str(row.get("keyword", "")).lower().replace("the ", "")
    ]
    if nonbrand:
        top = nonbrand[0]
        recommendations.append(
            {
                "priority": "1",
                "lane": "Non-brand search demand",
                "action": f"Build or refresh copy blocks around '{top.get('keyword')}'.",
                "evidence": f"DataForSEO reports {top.get('search_volume')} monthly searches and CPC {top.get('cpc')}.",
            }
        )
    if gsc_rows:
        top_gsc = gsc_rows[0]
        recommendations.append(
            {
                "priority": "2",
                "lane": "Organic query capture",
                "action": f"Use '{top_gsc.get('query')}' language in page headings, FAQs, and local proof points.",
                "evidence": f"GSC shows {top_gsc.get('impressions')} impressions and {top_gsc.get('clicks')} clicks in the report window.",
            }
        )
    if onpage:
        checks = _json_loads(onpage["checks_json"], {})
        active = ", ".join(sorted(checks.keys())[:5]) if isinstance(checks, dict) else ""
        recommendations.append(
            {
                "priority": "3",
                "lane": "OnPage readiness",
                "action": "Tighten title/meta/H1 alignment before writing net-new supporting copy.",
                "evidence": f"DataForSEO OnPage found {onpage['word_count'] or '-'} words; active checks: {active or 'none summarized'}.",
            }
        )
    if ai_row:
        mentioned = "mentioned" if ai_row["target_mentioned"] else "not clearly mentioned"
        recommendations.append(
            {
                "priority": "4",
                "lane": "AI search visibility",
                "action": "Add concise local-differentiator language that can be cited by answer engines.",
                "evidence": f"DataForSEO AI visibility probe {mentioned} the property in an apartment-recommendation prompt.",
            }
        )
    return recommendations


def build_content_manager_workup(conn: sqlite3.Connection, request: ReportRequest) -> ReportBuild:
    start, end, date_range = resolve_date_window(conn, request)
    properties, scope_label = resolve_scoped_properties(request)
    if len(properties) != 1:
        raise ValueError("content_manager_workup requires a single governed property in --scope.")

    prop = properties[0]
    identity = resolve_property_identity(prop["property_id"]) or resolve_property_identity(prop["property_name"])
    if not identity:
        raise ValueError(f"Could not resolve governed property identity for {prop['property_name']}.")
    ga4_id = str(identity.ga4_property_id or prop["property_id"])
    property_code = identity.marketing_bi_property_id
    property_name = identity.property_name

    ga4 = conn.execute(
        """
        SELECT
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(pageviews) AS pageviews,
          AVG(avg_session_duration) AS avg_session_duration
        FROM ga4_daily_metrics
        WHERE property_id = ? AND metric_date BETWEEN ? AND ?
        """,
        (ga4_id, start.isoformat(), end.isoformat()),
    ).fetchone()
    channel_rows = conn.execute(
        """
        SELECT channel_group, SUM(sessions) AS sessions, SUM(new_users) AS new_users, SUM(engaged_sessions) AS engaged_sessions, SUM(conversions) AS key_events
        FROM ga4_traffic_sources
        WHERE property_id = ? AND metric_date BETWEEN ? AND ?
        GROUP BY channel_group
        ORDER BY sessions DESC
        """,
        (ga4_id, start.isoformat(), end.isoformat()),
    ).fetchall()
    total_channel_sessions = sum(float(row["sessions"] or 0) for row in channel_rows)
    channel_table = [
        {
            "channel": row["channel_group"] or "Unassigned",
            "sessions": fmt_num(row["sessions"]),
            "share": fmt_pct((float(row["sessions"] or 0) / total_channel_sessions) if total_channel_sessions else None),
            "new_users": fmt_num(row["new_users"]),
            "engagement_rate": fmt_pct((float(row["engaged_sessions"] or 0) / float(row["sessions"] or 0)) if row["sessions"] else None),
            "key_events": fmt_num(row["key_events"]),
        }
        for row in channel_rows
    ]
    action_rows = build_event_action_rows(conn, [ga4_id], start, end)
    gsc_rows_raw = conn.execute(
        """
        SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
               CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) END AS ctr,
               AVG(average_position) AS avg_position
        FROM gsc_queries
        WHERE (property_id = ? OR ga4_property_id = ?) AND metric_date BETWEEN ? AND ?
        GROUP BY query
        ORDER BY impressions DESC, clicks DESC
        LIMIT 25
        """,
        (ga4_id, ga4_id, start.isoformat(), end.isoformat()),
    ).fetchall()
    gsc_rows = [
        {
            "query": row["query"],
            "clicks": fmt_num(row["clicks"]),
            "impressions": fmt_num(row["impressions"]),
            "ctr": fmt_pct(row["ctr"]),
            "avg_position": fmt_num(row["avg_position"], 1),
        }
        for row in gsc_rows_raw
    ]

    keyword_date = _latest_run_date(conn, "dataforseo_keyword_metrics", property_code)
    labs_date = _latest_run_date(conn, "dataforseo_labs_ranked_keywords", property_code)
    onpage_date = _latest_run_date(conn, "dataforseo_onpage_page_snapshots", property_code)
    business_date = _latest_run_date(conn, "dataforseo_business_profiles", property_code)
    ai_date = _latest_run_date(conn, "dataforseo_ai_visibility_probes", property_code)
    keyword_rows_raw = conn.execute(
        """
        SELECT keyword, search_volume, competition, competition_index, cpc, low_top_of_page_bid, high_top_of_page_bid
        FROM dataforseo_keyword_metrics
        WHERE property_id = ? AND run_date = ?
        ORDER BY COALESCE(search_volume, 0) DESC, COALESCE(cpc, 0) DESC
        LIMIT 25
        """,
        (property_code, keyword_date),
    ).fetchall() if keyword_date else []
    keyword_rows = [
        {
            "keyword": row["keyword"],
            "search_volume": fmt_num(row["search_volume"]),
            "competition": row["competition"] or "-",
            "competition_index": fmt_num(row["competition_index"]),
            "cpc": f"${float(row['cpc'] or 0):,.2f}" if row["cpc"] is not None else "-",
            "low_bid": f"${float(row['low_top_of_page_bid'] or 0):,.2f}" if row["low_top_of_page_bid"] is not None else "-",
            "high_bid": f"${float(row['high_top_of_page_bid'] or 0):,.2f}" if row["high_top_of_page_bid"] is not None else "-",
        }
        for row in keyword_rows_raw
    ]
    labs_rows = [
        {
            "keyword": row["keyword"],
            "rank": fmt_num(row["rank_absolute"]),
            "type": row["result_type"] or "-",
            "volume": fmt_num(row["search_volume"]),
            "cpc": f"${float(row['cpc'] or 0):,.2f}" if row["cpc"] is not None else "-",
            "url": row["url"] or "-",
        }
        for row in conn.execute(
            """
            SELECT keyword, rank_absolute, result_type, search_volume, cpc, url
            FROM dataforseo_labs_ranked_keywords
            WHERE property_id = ? AND run_date = ?
            ORDER BY COALESCE(rank_absolute, 9999), COALESCE(search_volume, 0) DESC
            LIMIT 25
            """,
            (property_code, labs_date),
        ).fetchall()
    ] if labs_date else []
    onpage = conn.execute(
        """
        SELECT * FROM dataforseo_onpage_page_snapshots
        WHERE property_id = ? AND run_date = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (property_code, onpage_date),
    ).fetchone() if onpage_date else None
    business = conn.execute(
        """
        SELECT * FROM dataforseo_business_profiles
        WHERE property_id = ? AND run_date = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (property_code, business_date),
    ).fetchone() if business_date else None
    ai_row = conn.execute(
        """
        SELECT * FROM dataforseo_ai_visibility_probes
        WHERE property_id = ? AND run_date = ?
        ORDER BY run_at DESC
        LIMIT 1
        """,
        (property_code, ai_date),
    ).fetchone() if ai_date else None

    competitor_rows = [
        {
            "rank": row["competitor_rank"],
            "competitor": row["competitor_name"],
            "domain": row["competitor_domain"] or "-",
            "url": row["competitor_url"] or "-",
        }
        for row in conn.execute(
            """
            SELECT pc.competitor_rank, c.competitor_name, c.competitor_domain, c.competitor_url
            FROM property_competitors pc
            JOIN competitors c ON pc.competitor_id = c.competitor_id
            WHERE pc.property_id IN (?, ?)
            ORDER BY pc.competitor_rank
            LIMIT 12
            """,
            (property_code, ga4_id),
        ).fetchall()
    ]
    availability_date_row = conn.execute(
        """
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM unit_availability_units
        WHERE property_id = ? OR feed_property_id = ?
        """,
        (ga4_id, property_code),
    ).fetchone()
    availability_date = availability_date_row["snapshot_date"] if availability_date_row else None
    availability_rows = [
        {
            "floorplan": row["floorplan_name"],
            "available_units": fmt_num(row["units"]),
            "min_rent": f"${float(row['min_rent'] or 0):,.0f}" if row["min_rent"] is not None else "-",
            "max_rent": f"${float(row['max_rent'] or 0):,.0f}" if row["max_rent"] is not None else "-",
            "concession": row["special"] or "-",
        }
        for row in conn.execute(
            """
            SELECT floorplan_name, COUNT(*) AS units, MIN(rent_from) AS min_rent, MAX(rent_to) AS max_rent, MAX(pricing_and_specials_message) AS special
            FROM unit_availability_units
            WHERE (property_id = ? OR feed_property_id = ?) AND snapshot_date = ?
            GROUP BY floorplan_name
            ORDER BY units DESC, min_rent
            LIMIT 25
            """,
            (ga4_id, property_code, availability_date),
        ).fetchall()
    ] if availability_date else []
    pagespeed_rows = [
        {
            "strategy": row["strategy"],
            "date": fmt_date(row["metric_date"]),
            "performance": fmt_num(row["performance_score"]),
            "seo": fmt_num(row["seo_score"]),
            "lcp": fmt_num(row["lcp_value"], 2),
            "cls": fmt_num(row["cls_value"], 3),
            "tbt": fmt_num(row["total_blocking_time"], 0),
        }
        for row in conn.execute(
            """
            SELECT *
            FROM pagespeed_metrics
            WHERE property_id = ? AND metric_date = (SELECT MAX(metric_date) FROM pagespeed_metrics WHERE property_id = ?)
            ORDER BY strategy
            """,
            (ga4_id, ga4_id),
        ).fetchall()
    ]
    guest = conn.execute(
        """
        SELECT *
        FROM guest_card_metrics_dw_direct
        WHERE property_code = ?
        ORDER BY run_date DESC, days_in_period DESC
        LIMIT 1
        """,
        (property_code,),
    ).fetchone()
    operating = conn.execute(
        """
        SELECT *
        FROM property_operating_metrics
        WHERE property_id = ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_code,),
    ).fetchone()

    sessions = float(ga4["sessions"] or 0)
    engaged = float(ga4["engaged_sessions"] or 0)
    ai_mentioned = bool(ai_row and ai_row["target_mentioned"])
    recommendation_rows = _content_recommendations(property_name, keyword_rows, gsc_rows, onpage, ai_row)
    onpage_rows = []
    if onpage:
        h1 = _json_loads(onpage["h1_json"], [])
        checks = _json_loads(onpage["checks_json"], {})
        timing = _json_loads(onpage["page_timing_json"], {})
        onpage_rows.append(
            {
                "url": onpage["url"],
                "status": onpage["status_code"],
                "title": onpage["title"],
                "meta_description": onpage["meta_description"],
                "h1": ", ".join(h1) if isinstance(h1, list) else h1,
                "word_count": fmt_num(onpage["word_count"]),
                "active_checks": ", ".join(sorted(checks.keys())[:8]) if isinstance(checks, dict) else "-",
                "load_time": fmt_num(timing.get("time_to_interactive"), 0) if isinstance(timing, dict) else "-",
            }
        )
    business_rows = []
    if business:
        also = _json_loads(business["people_also_search_json"], [])
        business_rows.append(
            {
                "title": business["title"],
                "category": business["category"],
                "address": business["address"],
                "domain": business["domain"],
                "rating": fmt_num(business["rating"], 1),
                "reviews": fmt_num(business["votes_count"]),
                "photos": fmt_num(business["total_photos"]),
                "claimed": "Yes" if business["is_claimed"] else "No" if business["is_claimed"] is not None else "-",
                "people_also_search": ", ".join(item.get("title", "") for item in also[:8] if isinstance(item, dict)),
            }
        )
    data_pond_rows = [
        {"source": "GA4 daily metrics", "latest": fmt_date(end), "note": "Traffic and engagement window selected by report request."},
        {"source": "GSC queries", "latest": fmt_date(end), "note": "Query table may lag GA4 by source availability."},
        {"source": "DataForSEO keyword metrics", "latest": fmt_date(keyword_date) if keyword_date else "-", "note": "Fresh deep pull completed before report generation."},
        {"source": "DataForSEO ranked keywords", "latest": fmt_date(labs_date) if labs_date else "-", "note": "Domain/page visibility from DataForSEO Labs."},
        {"source": "DataForSEO OnPage", "latest": fmt_date(onpage_date) if onpage_date else "-", "note": "Instant page crawl against property URL."},
        {"source": "DataForSEO business profile", "latest": fmt_date(business_date) if business_date else "-", "note": "Google business profile evidence."},
        {"source": "DataForSEO AI visibility", "latest": fmt_date(ai_date) if ai_date else "-", "note": "Apartment recommendation prompt with web search enabled."},
        {"source": "Unit availability", "latest": fmt_date(availability_date) if availability_date else "-", "note": "Current floorplan/unit availability table."},
    ]
    if guest:
        data_pond_rows.append({"source": "Data Warehouse guest cards", "latest": fmt_date(guest["run_date"]), "note": f"{fmt_num(guest['gc_this_period'])} guest cards in latest supplied period."})
    if operating:
        data_pond_rows.append({"source": "Data Warehouse operating metrics", "latest": fmt_date(operating["metric_date"]), "note": f"{fmt_pct((operating['occupancy_rate'] or 0) / 100)} occupancy, {fmt_pct((operating['leased_rate'] or 0) / 100)} leased."})

    ai_excerpt = ""
    if ai_row and ai_row["response_text"]:
        ai_excerpt = str(ai_row["response_text"]).replace("\n", " ")[:700]

    report = OutlookReport(
        title=f"{property_name} Content Manager Workup",
        subtitle="Property Intelligence Brief",
        version="1.0.0",
        date_range=date_range,
        generated_at=fmt_generated_at(),
        question_answered=request.subject,
        kpis=[
            ReportKpi("Sessions", fmt_num(ga4["sessions"]), primary=True, note=f"{fmt_date_range(start, end)}"),
            ReportKpi("Engagement Rate", fmt_pct((engaged / sessions) if sessions else None), note="Engaged sessions / sessions"),
            ReportKpi("DataForSEO Keywords", fmt_num(len(keyword_rows)), note=f"Latest pull {fmt_date(keyword_date) if keyword_date else '-'}"),
            ReportKpi("AI Visibility", "Mentioned" if ai_mentioned else "Not Mentioned", note="DataForSEO AI probe"),
        ],
        sections=[
            ReportSection(
                title="Content Direction",
                paragraphs=[
                    f"{property_name} needs content work that connects current demand signals to local search intent in {identity.city}, {identity.state}.",
                    f"GA4 shows {fmt_num(ga4['sessions'])} sessions, {fmt_num(ga4['new_users'])} new users, and {fmt_num(ga4['pageviews'])} pageviews in the selected window.",
                    "Use the workbook attachment as Alex's working table set for keyword demand, GSC language, competitors, availability, and Data Pond source checks.",
                ],
                tables=[
                    ReportTable(
                        title="Recommended Content Priorities",
                        columns=[
                            ("priority", "Priority"),
                            ("lane", "Lane"),
                            ("action", "Action"),
                            ("evidence", "Evidence"),
                        ],
                        rows=recommendation_rows,
                    )
                ],
            ),
            ReportSection(
                title="Search Demand And Visibility",
                tables=[
                    ReportTable(
                        title="Keyword Demand",
                        intro="Fresh DataForSEO search-volume and paid-demand evidence.",
                        columns=[
                            ("keyword", "Keyword"),
                            ("search_volume", "Volume"),
                            ("competition", "Competition"),
                            ("competition_index", "Index"),
                            ("cpc", "CPC"),
                            ("low_bid", "Low bid"),
                            ("high_bid", "High bid"),
                        ],
                        rows=keyword_rows,
                    ),
                    ReportTable(
                        title="GSC Query Language",
                        intro="Stored GSC query performance from the selected window.",
                        columns=[
                            ("query", "Query"),
                            ("clicks", "Clicks"),
                            ("impressions", "Impressions"),
                            ("ctr", "CTR"),
                            ("avg_position", "Avg position"),
                        ],
                        rows=gsc_rows,
                        limit=12,
                    ),
                ],
            ),
            ReportSection(
                title="Competitive And Local Context",
                paragraphs=[f"AI visibility excerpt: {ai_excerpt}" if ai_excerpt else "AI visibility response text was not available."],
                tables=[
                    ReportTable(
                        title="Governed Competitor Set",
                        columns=[("rank", "Rank"), ("competitor", "Competitor"), ("domain", "Domain"), ("url", "URL")],
                        rows=competitor_rows,
                    ),
                    ReportTable(
                        title="Business Profile",
                        columns=[
                            ("title", "Title"),
                            ("category", "Category"),
                            ("rating", "Rating"),
                            ("reviews", "Reviews"),
                            ("photos", "Photos"),
                            ("claimed", "Claimed"),
                            ("people_also_search", "People also search"),
                        ],
                        rows=business_rows,
                    ),
                ],
            ),
            ReportSection(
                title="Page And Conversion Signals",
                tables=[
                    ReportTable(
                        title="OnPage Snapshot",
                        columns=[
                            ("status", "Status"),
                            ("title", "Title"),
                            ("h1", "H1"),
                            ("word_count", "Words"),
                            ("active_checks", "Active checks"),
                        ],
                        rows=onpage_rows,
                    ),
                    ReportTable(
                        title="Top Channels",
                        columns=[
                            ("channel", "Channel"),
                            ("sessions", "Sessions"),
                            ("share", "Share"),
                            ("new_users", "New users"),
                            ("engagement_rate", "Engagement"),
                            ("key_events", "Key events"),
                        ],
                        rows=channel_table,
                    ),
                    ReportTable(
                        title="Top Action Events",
                        columns=[("event_name", "Event"), ("event_count", "Count"), ("active_days", "Active days")],
                        rows=action_rows,
                        limit=12,
                    ),
                ],
            ),
            ReportSection(
                title="Availability And Data Pond",
                tables=[
                    ReportTable(
                        title="Current Availability",
                        columns=[
                            ("floorplan", "Floorplan"),
                            ("available_units", "Available units"),
                            ("min_rent", "Min rent"),
                            ("max_rent", "Max rent"),
                            ("concession", "Concession / special"),
                        ],
                        rows=availability_rows,
                    ),
                    ReportTable(
                        title="Data Pond Source Check",
                        columns=[("source", "Source"), ("latest", "Latest"), ("note", "Note")],
                        rows=data_pond_rows,
                    ),
                    ReportTable(
                        title="PageSpeed Snapshot",
                        columns=[
                            ("strategy", "Strategy"),
                            ("date", "Date"),
                            ("performance", "Performance"),
                            ("seo", "SEO"),
                            ("lcp", "LCP"),
                            ("cls", "CLS"),
                            ("tbt", "TBT"),
                        ],
                        rows=pagespeed_rows,
                    ),
                ],
            ),
        ],
        source_note=(
            "Data Pond tables: ga4_daily_metrics, ga4_traffic_sources, ga4_event_facts, gsc_queries, "
            "DataForSEO enrichment tables, property_competitors, unit_availability_units, guest_card_metrics_dw_direct, "
            "property_operating_metrics, and pagespeed_metrics."
        ),
    )
    workbook_sheets = {
        "Content Priorities": recommendation_rows,
        "Keyword Demand": keyword_rows,
        "Ranked Keywords": labs_rows,
        "GSC Queries": gsc_rows,
        "Channels": channel_table,
        "Action Events": action_rows,
        "Competitors": competitor_rows,
        "Business Profile": business_rows,
        "OnPage": onpage_rows,
        "Availability": availability_rows,
        "PageSpeed": pagespeed_rows,
        "Data Pond Sources": data_pond_rows,
    }
    return ReportBuild(
        report_type="content_manager_workup",
        report=report,
        workbook_sheets=workbook_sheets,
        spec={
            "request": asdict(request),
            "report_type": "content_manager_workup",
            "property_name": property_name,
            "property_code": property_code,
            "ga4_property_id": ga4_id,
            "date_range": date_range,
            "sources": [
                "ga4_daily_metrics",
                "ga4_traffic_sources",
                "ga4_event_facts",
                "gsc_queries",
                "dataforseo_keyword_metrics",
                "dataforseo_labs_ranked_keywords",
                "dataforseo_onpage_page_snapshots",
                "dataforseo_business_profiles",
                "dataforseo_ai_visibility_probes",
                "property_competitors",
                "unit_availability_units",
                "guest_card_metrics_dw_direct",
                "property_operating_metrics",
                "pagespeed_metrics",
            ],
            "latest_dataforseo": {
                "keyword_metrics": keyword_date,
                "ranked_keywords": labs_date,
                "onpage": onpage_date,
                "business_profile": business_date,
                "ai_visibility": ai_date,
            },
        },
    )


def _content_intelligence_actions(
    property_name: str,
    city: str | None,
    state: str | None,
    serp_rows: list[dict[str, object]],
    keyword_rows: list[dict[str, object]],
    competitor_rows: list[dict[str, object]],
    review_theme_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    missing_terms = [str(row.get("keyword")) for row in serp_rows if row.get("found") == "No"][:4]
    ranked_terms = [str(row.get("keyword")) for row in serp_rows if row.get("found") == "Yes"][:4]
    top_keyword = str(keyword_rows[0].get("keyword")) if keyword_rows else f"apartments in {city} {state}".strip()
    competitor_signal = str(competitor_rows[0].get("evidence")) if competitor_rows else "Competitor official-page evidence was limited."
    review_signal = str(review_theme_rows[0].get("theme")) if review_theme_rows else "review language"
    locality = f"{city}, {state}" if city and state else "the local market"
    return [
        {
            "priority": "1",
            "page_or_asset": "Homepage / primary landing copy",
            "assignment": f"Add a stronger {locality} apartment-search block that names the neighborhood/market plainly.",
            "evidence": f"DataForSEO SERP gaps: {', '.join(missing_terms) if missing_terms else 'priority terms need reinforcement'}.",
            "draft_direction": f"Lead with {property_name} as a practical apartment choice in {locality}; include proximity, lifestyle, floor-plan breadth, and pet/luxury qualifiers where true.",
        },
        {
            "priority": "2",
            "page_or_asset": "Neighborhood / location section",
            "assignment": "Create a search-intent section for the local submarket, commute anchors, and nearby demand phrases.",
            "evidence": f"Search terms with current visibility: {', '.join(ranked_terms) if ranked_terms else 'none in the latest top-30 pull'}; top demand row: {top_keyword}.",
            "draft_direction": "Use concise headers and scannable bullets that answer where the property is, what it is near, and who it is best for.",
        },
        {
            "priority": "3",
            "page_or_asset": "Amenities and lifestyle proof",
            "assignment": "Rewrite amenities copy around differentiated lived benefits instead of generic amenity lists.",
            "evidence": competitor_signal,
            "draft_direction": "Pair amenity names with resident outcomes: easier pet routines, remote-work comfort, pool/social use, storage, parking, and package convenience where available.",
        },
        {
            "priority": "4",
            "page_or_asset": "FAQ / answer-engine blocks",
            "assignment": "Add short FAQ answers for high-intent modifiers and AI-answer readability.",
            "evidence": f"Review and AI signals point to {review_signal}; DataForSEO AI visibility and business-profile rows are available in the workbook.",
            "draft_direction": "Write 45-70 word answers with direct nouns: pet-friendly apartments, luxury apartments, Richmond apartments, pricing/specials, touring, parking, and nearby landmarks.",
        },
        {
            "priority": "5",
            "page_or_asset": "Specials / availability support copy",
            "assignment": "Connect visible availability and concessions to content modules without overpromising.",
            "evidence": "Current unit availability and competitor special observations are included in the Data Pond evidence.",
            "draft_direction": "Use modular copy that can be refreshed when specials change; avoid static claims that will drift from the feed.",
        },
    ]


def _review_theme_rows(conn: sqlite3.Connection, ga4_id: str) -> list[dict[str, object]]:
    row = conn.execute(
        """
        SELECT
          COUNT(*) AS analyzed_reviews,
          SUM(theme_maintenance) AS maintenance,
          SUM(theme_staff) AS staff,
          SUM(theme_amenities) AS amenities,
          SUM(theme_noise) AS noise,
          SUM(theme_location) AS location,
          SUM(theme_value) AS value,
          SUM(theme_move_in) AS move_in,
          SUM(theme_move_out) AS move_out,
          SUM(theme_pets) AS pets,
          SUM(theme_parking) AS parking,
          SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) AS positive,
          SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) AS negative
        FROM gbp_review_sentiment
        WHERE property_id = ?
        """,
        (ga4_id,),
    ).fetchone()
    if not row or not row["analyzed_reviews"]:
        return []
    theme_labels = [
        ("staff", "Staff / service"),
        ("maintenance", "Maintenance"),
        ("amenities", "Amenities"),
        ("location", "Location"),
        ("value", "Value"),
        ("move_in", "Move-in"),
        ("pets", "Pets"),
        ("parking", "Parking"),
        ("noise", "Noise"),
        ("move_out", "Move-out"),
    ]
    rows = [
        {
            "theme": label,
            "mentions": fmt_num(row[key]),
            "share_of_analyzed": fmt_pct((float(row[key] or 0) / float(row["analyzed_reviews"] or 1))),
        }
        for key, label in theme_labels
        if row[key]
    ]
    rows.sort(key=lambda item: float(str(item["mentions"]).replace(",", "") or 0), reverse=True)
    rows.append(
        {
            "theme": "Sentiment mix",
            "mentions": f"{fmt_num(row['positive'])} positive / {fmt_num(row['negative'])} negative",
            "share_of_analyzed": f"{fmt_num(row['analyzed_reviews'])} analyzed reviews",
        }
    )
    return rows


def build_content_intelligence_pack(conn: sqlite3.Connection, request: ReportRequest) -> ReportBuild:
    start, end, date_range = resolve_date_window(conn, request)
    properties, _scope_label = resolve_scoped_properties(request)
    if len(properties) != 1:
        raise ValueError("content_intelligence_pack requires a single governed property in --scope.")
    identity = resolve_property_identity(properties[0]["property_id"]) or resolve_property_identity(properties[0]["property_name"])
    if not identity:
        raise ValueError(f"Could not resolve governed property identity for {properties[0]['property_name']}.")

    property_name = identity.property_name
    property_code = identity.marketing_bi_property_id
    ga4_id = str(identity.ga4_property_id or properties[0]["property_id"])

    serp_date = _latest_run_date(conn, "dataforseo_property_keyword_rankings", property_code)
    serp_rows = [
        {
            "keyword": row["keyword"],
            "found": "Yes" if row["target_found"] else "No",
            "best_rank": fmt_num(row["best_rank_absolute"]) if row["best_rank_absolute"] is not None else "-",
            "result_type": row["best_result_type"] or "-",
            "organic_rank": fmt_num(row["organic_rank_absolute"]) if row["organic_rank_absolute"] is not None else "-",
            "local_pack": "Present" if row["local_pack_present"] else "No",
            "target_in_local_pack": "Yes" if row["target_in_local_pack"] else "No",
        }
        for row in conn.execute(
            """
            SELECT *
            FROM dataforseo_property_keyword_rankings
            WHERE property_id = ? AND run_date = ?
            ORDER BY target_found ASC, COALESCE(best_rank_absolute, 9999), keyword
            """,
            (property_code, serp_date),
        ).fetchall()
    ] if serp_date else []
    found_count = sum(1 for row in serp_rows if row["found"] == "Yes")

    serp_domain_rows = [
        {
            "domain": row["domain"],
            "appearances": fmt_num(row["appearances"]),
            "best_rank": fmt_num(row["best_rank"]),
            "keywords_seen": row["keywords_seen"],
        }
        for row in conn.execute(
            """
            SELECT domain, COUNT(*) AS appearances, MIN(rank_absolute) AS best_rank, GROUP_CONCAT(DISTINCT keyword) AS keywords_seen
            FROM dataforseo_serp_results
            WHERE property_id = ? AND run_date = ? AND domain IS NOT NULL
            GROUP BY domain
            ORDER BY appearances DESC, best_rank ASC
            LIMIT 18
            """,
            (property_code, serp_date),
        ).fetchall()
    ] if serp_date else []

    keyword_date = _latest_run_date(conn, "dataforseo_keyword_metrics", property_code)
    keyword_rows = [
        {
            "keyword": row["keyword"],
            "volume": fmt_num(row["search_volume"]),
            "competition": row["competition"] or "-",
            "cpc": f"${float(row['cpc'] or 0):,.2f}" if row["cpc"] is not None else "-",
            "high_bid": f"${float(row['high_top_of_page_bid'] or 0):,.2f}" if row["high_top_of_page_bid"] is not None else "-",
        }
        for row in conn.execute(
            """
            SELECT keyword, search_volume, competition, cpc, high_top_of_page_bid
            FROM dataforseo_keyword_metrics
            WHERE property_id = ? AND run_date = ?
            ORDER BY COALESCE(search_volume, 0) DESC, COALESCE(cpc, 0) DESC
            LIMIT 20
            """,
            (property_code, keyword_date),
        ).fetchall()
    ] if keyword_date else []

    latest_market = conn.execute(
        "SELECT MAX(snapshot_date) AS snapshot_date FROM competitor_market_research_observations WHERE property_id = ?",
        (property_code,),
    ).fetchone()
    market_date = latest_market["snapshot_date"] if latest_market else None
    competitor_rows = [
        {
            "category": row["evidence_category"],
            "competitor": row["competitor_name"],
            "rent_range": (
                f"${float(row['rent_min']):,.0f}-${float(row['rent_max']):,.0f}"
                if row["rent_min"] is not None and row["rent_max"] is not None
                else "-"
            ),
            "evidence": row["special_text"] or row["usp_text"] or row["raw_claim"],
            "confidence": row["confidence"],
        }
        for row in conn.execute(
            """
            SELECT evidence_category, competitor_name, rent_min, rent_max, special_text, usp_text, raw_claim, confidence
            FROM competitor_market_research_observations
            WHERE property_id = ? AND snapshot_date = ? AND evidence_category <> 'source_gap'
            ORDER BY
              CASE evidence_category WHEN 'subject_position' THEN 0 WHEN 'special' THEN 1 WHEN 'rent' THEN 2 WHEN 'usp' THEN 3 ELSE 4 END,
              competitor_name
            LIMIT 30
            """,
            (property_code, market_date),
        ).fetchall()
    ] if market_date else []

    review_rows = _review_theme_rows(conn, ga4_id)
    onpage_date = _latest_run_date(conn, "dataforseo_onpage_page_snapshots", property_code)
    onpage = conn.execute(
        """
        SELECT title, meta_description, h1_json, word_count, checks_json
        FROM dataforseo_onpage_page_snapshots
        WHERE property_id = ? AND run_date = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (property_code, onpage_date),
    ).fetchone() if onpage_date else None
    onpage_rows = []
    if onpage:
        h1 = _json_loads(onpage["h1_json"], [])
        checks = _json_loads(onpage["checks_json"], {})
        onpage_rows.append(
            {
                "title": onpage["title"],
                "meta_description": onpage["meta_description"],
                "h1": ", ".join(h1) if isinstance(h1, list) else h1,
                "word_count": fmt_num(onpage["word_count"]),
                "active_checks": ", ".join(sorted(checks.keys())[:8]) if isinstance(checks, dict) else "-",
            }
        )

    ai_date = _latest_run_date(conn, "dataforseo_ai_visibility_probes", property_code)
    ai = conn.execute(
        """
        SELECT target_mentioned, response_text, cited_domains_json
        FROM dataforseo_ai_visibility_probes
        WHERE property_id = ? AND run_date = ?
        ORDER BY run_at DESC
        LIMIT 1
        """,
        (property_code, ai_date),
    ).fetchone() if ai_date else None
    ai_rows = []
    if ai:
        cited = _json_loads(ai["cited_domains_json"], [])
        ai_rows.append(
            {
                "target_mentioned": "Yes" if ai["target_mentioned"] else "No",
                "cited_domains": ", ".join(cited[:8]) if isinstance(cited, list) else "-",
                "response_excerpt": str(ai["response_text"] or "").replace("\n", " ")[:900],
            }
        )

    action_rows = _content_intelligence_actions(
        property_name,
        identity.city,
        identity.state,
        serp_rows,
        keyword_rows,
        competitor_rows,
        review_rows,
    )
    missing_count = len(serp_rows) - found_count
    if not serp_rows:
        verdict = "Needs SERP evidence"
        verdict_note = "No fresh SERP rows were found for this property."
    elif missing_count == len(serp_rows):
        verdict = "Visibility gap"
        verdict_note = "The target was not found in the latest top-30 pulls for the tested priority terms."
    elif missing_count:
        verdict = "Partial visibility"
        verdict_note = f"The target was found for {found_count} of {len(serp_rows)} tested priority terms."
    else:
        verdict = "Visible"
        verdict_note = "The target was found for all tested priority terms."

    report = OutlookReport(
        title=f"{property_name} Property Intel Pack",
        subtitle="Property Intel Pack",
        version="1.0.0",
        date_range=date_range,
        generated_at=fmt_generated_at(),
        question_answered=request.subject,
        kpis=[
            ReportKpi("SERP Verdict", verdict, primary=True, note=verdict_note),
            ReportKpi("Priority Terms Found", f"{found_count}/{len(serp_rows)}", note=f"DataForSEO SERP pull {fmt_date(serp_date) if serp_date else '-'}"),
            ReportKpi("Competitor Observations", fmt_num(len(competitor_rows)), note=f"Official-page packet {fmt_date(market_date) if market_date else '-'}"),
            ReportKpi("Review Themes", fmt_num(len(review_rows)), note="GBP review sentiment rows"),
        ],
        sections=[
            ReportSection(
                title="Executive Read For Alex",
                paragraphs=[
                    f"{property_name} should be handled as a content-intent project for {identity.city}, {identity.state}, not only as a page polish task.",
                    verdict_note,
                    "The workbook is the working file: it includes SERP rows, top domains, keyword demand, competitor evidence, OnPage details, AI visibility, and review themes.",
                ],
                callout=f"Recommended stance: prioritize content that directly answers the tested apartment-search terms and local-market modifiers before broader lifestyle copy.",
            ),
            ReportSection(
                title="Content Assignments",
                tables=[
                    ReportTable(
                        title="Alex Action Brief",
                        columns=[
                            ("priority", "Priority"),
                            ("page_or_asset", "Page / asset"),
                            ("assignment", "Assignment"),
                            ("evidence", "Evidence"),
                            ("draft_direction", "Draft direction"),
                        ],
                        rows=action_rows,
                    )
                ],
            ),
            ReportSection(
                title="SERP And Keyword Evidence",
                tables=[
                    ReportTable(
                        title="Priority SERP Checks",
                        columns=[
                            ("keyword", "Keyword"),
                            ("found", "Found"),
                            ("best_rank", "Best rank"),
                            ("result_type", "Type"),
                            ("organic_rank", "Organic rank"),
                            ("local_pack", "Local pack"),
                            ("target_in_local_pack", "Target in local pack"),
                        ],
                        rows=serp_rows,
                    ),
                    ReportTable(
                        title="Keyword Demand",
                        columns=[
                            ("keyword", "Keyword"),
                            ("volume", "Volume"),
                            ("competition", "Competition"),
                            ("cpc", "CPC"),
                            ("high_bid", "High bid"),
                        ],
                        rows=keyword_rows,
                    ),
                    ReportTable(
                        title="Domains Occupying The SERP",
                        columns=[
                            ("domain", "Domain"),
                            ("appearances", "Appearances"),
                            ("best_rank", "Best rank"),
                            ("keywords_seen", "Keywords seen"),
                        ],
                        rows=serp_domain_rows,
                    ),
                ],
            ),
            ReportSection(
                title="Competitor And Review Language",
                tables=[
                    ReportTable(
                        title="Competitor Page Evidence",
                        columns=[
                            ("category", "Category"),
                            ("competitor", "Competitor"),
                            ("rent_range", "Rent range"),
                            ("evidence", "Evidence"),
                            ("confidence", "Confidence"),
                        ],
                        rows=competitor_rows,
                    ),
                    ReportTable(
                        title="Review Language Themes",
                        columns=[
                            ("theme", "Theme"),
                            ("mentions", "Mentions"),
                            ("share_of_analyzed", "Share / note"),
                        ],
                        rows=review_rows,
                    ),
                ],
            ),
            ReportSection(
                title="OnPage And AI Visibility",
                tables=[
                    ReportTable(
                        title="DataForSEO OnPage Snapshot",
                        columns=[
                            ("title", "Title"),
                            ("meta_description", "Meta description"),
                            ("h1", "H1"),
                            ("word_count", "Words"),
                            ("active_checks", "Active checks"),
                        ],
                        rows=onpage_rows,
                    ),
                    ReportTable(
                        title="DataForSEO AI Visibility Probe",
                        columns=[
                            ("target_mentioned", "Target mentioned"),
                            ("cited_domains", "Cited domains"),
                            ("response_excerpt", "Response excerpt"),
                        ],
                        rows=ai_rows,
                    ),
                ],
            ),
        ],
        source_note=(
            "DataForSEO SERP and enrichment rows, official-page competitor market packets, GBP review sentiment, "
            "and governed property identity from the Data Pond."
        ),
    )
    workbook_sheets = {
        "Alex Action Brief": action_rows,
        "SERP Checks": serp_rows,
        "SERP Domains": serp_domain_rows,
        "Keyword Demand": keyword_rows,
        "Competitor Evidence": competitor_rows,
        "Review Themes": review_rows,
        "OnPage": onpage_rows,
        "AI Visibility": ai_rows,
    }
    return ReportBuild(
        report_type="content_intelligence_pack",
        report=report,
        workbook_sheets=workbook_sheets,
        spec={
            "request": asdict(request),
            "report_type": "content_intelligence_pack",
            "product_name": "Property Intel Pack",
            "property_name": property_name,
            "property_code": property_code,
            "ga4_property_id": ga4_id,
            "date_range": date_range,
            "sources": [
                "dataforseo_property_keyword_rankings",
                "dataforseo_serp_results",
                "dataforseo_keyword_metrics",
                "dataforseo_onpage_page_snapshots",
                "dataforseo_ai_visibility_probes",
                "competitor_market_research_observations",
                "gbp_review_sentiment",
            ],
            "latest_evidence": {
                "serp": serp_date,
                "keyword_metrics": keyword_date,
                "competitor_market": market_date,
                "onpage": onpage_date,
                "ai_visibility": ai_date,
            },
        },
    )


ILS_TRAFFIC_BENCHMARKS: list[dict[str, object]] = [
    {
        "platform": "Zillow",
        "domain": "zillow.com",
        "source": "Semrush Traffic Analytics",
        "source_period": "June 2026",
        "metric": "Direct share of visits",
        "value": "43.70%",
        "numeric_value": 0.4370,
        "interpretation": "Platform-level direct-start behavior: typed URL, bookmark, app-like brand habit, or unattributed direct visit.",
        "url": "https://www.semrush.com/website/zillow.com/overview/",
    },
    {
        "platform": "Zillow",
        "domain": "zillow.com",
        "source": "Semrush Traffic Analytics",
        "source_period": "June 2026",
        "metric": "Google referral / organic-like share",
        "value": "35.34%",
        "numeric_value": 0.3534,
        "interpretation": "Google remains a major discovery path into Zillow, even though direct is larger in this view.",
        "url": "https://www.semrush.com/website/zillow.com/overview/",
    },
    {
        "platform": "Zillow",
        "domain": "zillow.com",
        "source": "Similarweb",
        "source_period": "June 2026",
        "metric": "Organic Search share of desktop visits",
        "value": "39.74%",
        "numeric_value": 0.3974,
        "interpretation": "Corroborates a roughly 35%-40% search-driven discovery band for Zillow.",
        "url": "https://www.similarweb.com/website/zillow.com/",
    },
    {
        "platform": "Apartments.com",
        "domain": "apartments.com",
        "source": "Semrush Traffic Analytics",
        "source_period": "June 2026",
        "metric": "Direct share of visits",
        "value": "41.13%",
        "numeric_value": 0.4113,
        "interpretation": "Platform-level direct-start behavior: renters intentionally start on Apartments.com or arrive as unattributed direct traffic.",
        "url": "https://www.semrush.com/website/apartments.com/overview/",
    },
    {
        "platform": "Apartments.com",
        "domain": "apartments.com",
        "source": "Semrush Traffic Analytics",
        "source_period": "June 2026",
        "metric": "Google referral / organic-like share",
        "value": "36.08%",
        "numeric_value": 0.3608,
        "interpretation": "Google is still a large Apartments.com acquisition path.",
        "url": "https://www.semrush.com/website/apartments.com/overview/",
    },
    {
        "platform": "Apartments.com",
        "domain": "apartments.com",
        "source": "Similarweb",
        "source_period": "June 2026",
        "metric": "Organic Search share of desktop visits",
        "value": "35.33%",
        "numeric_value": 0.3533,
        "interpretation": "Corroborates a roughly 35%-36% search-driven discovery band for Apartments.com.",
        "url": "https://www.similarweb.com/website/apartments.com/",
    },
]


RENTER_SEARCH_BEHAVIOR_ROWS: list[dict[str, object]] = [
    {
        "source": "Zillow 2026 Consumer Housing Trends Report preview",
        "finding": "Survey scope",
        "value": "24,000+ renters surveyed",
        "executive_read": "The renter-search market is broad enough that a single-source attribution view will understate channel overlap.",
        "url": "https://www.zillow.com/rentals-network/zillow-rentals-consumer-housing-trends-report/",
    },
    {
        "source": "Zillow News, 2026 CHTR reference",
        "finding": "Mobile web usage",
        "value": "81% of renters searched on a mobile website",
        "executive_read": "Mobile search experience and listing-page completeness matter across Google, direct ILS, and property-site journeys.",
        "url": "https://www.zillow.com/news/rental-search-has-evolved/",
    },
    {
        "source": "Zillow News, 2026 CHTR reference",
        "finding": "App usage",
        "value": "73% of renters searched on an app",
        "executive_read": "A material portion of demand is happening inside app ecosystems where ranking, listing quality, availability, photos, reviews, and response speed matter.",
        "url": "https://www.zillow.com/news/rental-search-has-evolved/",
    },
    {
        "source": "Zillow News, 2026 CHTR reference",
        "finding": "Multisite search",
        "value": "Typical renter used five different sites or apps",
        "executive_read": "Renter journeys are not Google-only or ILS-only; they are multi-touch comparison paths.",
        "url": "https://www.zillow.com/news/rental-search-has-evolved/",
    },
    {
        "source": "Zillow Rentals 2024 report PDF",
        "finding": "Online search and narrowing",
        "value": "86% of renters searched and narrowed options online",
        "executive_read": "Digital visibility is not an upper-funnel nicety; it is the core apartment-shopping behavior.",
        "url": "https://www.zillowstatic.com/bedrock/app/uploads/sites/42/2023/11/Zillow-Rentals-Consumer-Housing-Trends-Report-2024.pdf",
    },
]


ILS_MARKET_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("Pearland, TX", ("pearland",)),
    ("Atlanta / Vinings, GA", ("atlanta", "vinings")),
    ("Peachtree City, GA", ("peachtree city",)),
    ("Louisville, KY", ("louisville",)),
    ("Clermont, FL", ("clermont",)),
    ("Broken Arrow, OK", ("broken arrow",)),
    ("Melbourne / West Melbourne, FL", ("melbourne", "west melbourne")),
    ("Orlando, FL", ("orlando",)),
    ("League City, TX", ("league city",)),
    ("Edmond, OK", ("edmond",)),
    ("The Woodlands, TX", ("woodlands", "the woodlands")),
    ("Richmond, TX", ("richmond",)),
    ("Fort Worth, TX", ("fort worth",)),
    ("Stafford, TX", ("stafford",)),
    ("Pooler, GA", ("pooler",)),
    ("Houston, TX", ("houston",)),
    ("Flowery Branch, GA", ("flowery branch",)),
    ("San Antonio, TX", ("san antonio",)),
    ("Bentonville, AR", ("bentonville",)),
    ("Cary, NC", ("cary",)),
    ("Norman, OK", ("norman",)),
    ("Kissimmee, FL", ("kissimmee",)),
]

ILS_RENTER_INTENT_TERMS = (
    "apartment",
    "apartments",
    "apt",
    "apts",
    "rent",
    "rental",
    "rentals",
    "townhome",
    "townhomes",
    "townhouse",
    "near me",
)


def classify_ils_market(query: str) -> str:
    lowered = query.lower()
    if "near me" in lowered or "nearby" in lowered:
        return "Near-me / unnamed local"
    for market, patterns in ILS_MARKET_PATTERNS:
        if any(pattern in lowered for pattern in patterns):
            return market
    if any(term in lowered for term in ILS_RENTER_INTENT_TERMS):
        return "Generic / no explicit market"
    return "Other"


def build_ils_platform_summary_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for platform in ("Zillow", "Apartments.com"):
        direct = next(
            row for row in ILS_TRAFFIC_BENCHMARKS if row["platform"] == platform and row["metric"] == "Direct share of visits"
        )
        semrush_google = next(
            row
            for row in ILS_TRAFFIC_BENCHMARKS
            if row["platform"] == platform and row["metric"] == "Google referral / organic-like share"
        )
        similarweb_organic = next(
            row
            for row in ILS_TRAFFIC_BENCHMARKS
            if row["platform"] == platform and row["metric"] == "Organic Search share of desktop visits"
        )
        rows.append(
            {
                "platform": platform,
                "direct_start_share": direct["value"],
                "semrush_google_share": semrush_google["value"],
                "similarweb_organic_share": similarweb_organic["value"],
                "executive_read": "Roughly 4 in 10 visits start at the platform; roughly another 35%-40% arrive from Google/search.",
                "primary_source": "Semrush for direct share; Semrush and Similarweb for search band",
            }
        )
    return rows


def build_ils_channel_rows(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> tuple[list[dict[str, object]], dict[str, float]]:
    ph = placeholders(property_ids)
    total_row = conn.execute(
        f"""
        SELECT
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(conversions) AS key_events
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    total_sessions = float(total_row["sessions"] or 0)
    rows = conn.execute(
        f"""
        SELECT
          channel_group,
          SUM(sessions) AS sessions,
          SUM(new_users) AS new_users,
          SUM(engaged_sessions) AS engaged_sessions,
          SUM(conversions) AS key_events
        FROM ga4_traffic_sources
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY channel_group
        ORDER BY sessions DESC
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    output: list[dict[str, object]] = []
    metrics = {"total_sessions": total_sessions, "direct_sessions": 0.0, "organic_sessions": 0.0}
    for row in rows:
        sessions = float(row["sessions"] or 0)
        channel = str(row["channel_group"] or "Unassigned")
        if channel == "Direct":
            metrics["direct_sessions"] = sessions
        if channel == "Organic Search":
            metrics["organic_sessions"] = sessions
        output.append(
            {
                "channel": channel,
                "sessions": fmt_num(sessions),
                "share_of_total_ga4_sessions": fmt_pct(sessions / total_sessions if total_sessions else None),
                "new_users": fmt_num(row["new_users"]),
                "engaged_sessions": fmt_num(row["engaged_sessions"]),
                "key_events": fmt_num(row["key_events"]),
            }
        )
    metrics["direct_share"] = metrics["direct_sessions"] / total_sessions if total_sessions else 0.0
    metrics["organic_share"] = metrics["organic_sessions"] / total_sessions if total_sessions else 0.0
    return output, metrics


def build_ils_gsc_market_rows(conn: sqlite3.Connection, property_ids: list[str], start: date, end: date) -> tuple[list[dict[str, object]], dict[str, object]]:
    ph = placeholders(property_ids)
    coverage = conn.execute(
        f"""
        SELECT MIN(metric_date) AS min_date, MAX(metric_date) AS max_date, COUNT(DISTINCT COALESCE(ga4_property_id, property_id)) AS properties
        FROM gsc_queries
        WHERE COALESCE(ga4_property_id, property_id) IN ({ph}) AND metric_date BETWEEN ? AND ?
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchone()
    query_rows = conn.execute(
        f"""
        SELECT
          LOWER(query) AS query,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          CASE WHEN SUM(impressions) > 0 THEN SUM(average_position * impressions) / SUM(impressions) END AS avg_position
        FROM gsc_queries
        WHERE COALESCE(ga4_property_id, property_id) IN ({ph})
          AND metric_date BETWEEN ? AND ?
          AND impressions > 0
          AND (
            LOWER(query) LIKE '%apartment%'
            OR LOWER(query) LIKE '%apartments%'
            OR LOWER(query) LIKE '% apt%'
            OR LOWER(query) LIKE '% apts%'
            OR LOWER(query) LIKE '%rent%'
            OR LOWER(query) LIKE '%rental%'
            OR LOWER(query) LIKE '%near me%'
          )
        GROUP BY LOWER(query)
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    by_market: dict[str, dict[str, float]] = defaultdict(lambda: {"clicks": 0.0, "impressions": 0.0, "weighted_position": 0.0, "queries": 0.0})
    for row in query_rows:
        market = classify_ils_market(str(row["query"] or ""))
        clicks = float(row["clicks"] or 0)
        impressions = float(row["impressions"] or 0)
        avg_position = float(row["avg_position"] or 0)
        by_market[market]["clicks"] += clicks
        by_market[market]["impressions"] += impressions
        by_market[market]["weighted_position"] += avg_position * impressions
        by_market[market]["queries"] += 1

    output: list[dict[str, object]] = []
    for market, values in sorted(by_market.items(), key=lambda item: item[1]["impressions"], reverse=True):
        impressions = values["impressions"]
        clicks = values["clicks"]
        output.append(
            {
                "market_or_search_shape": market,
                "gsc_clicks": fmt_num(clicks),
                "gsc_impressions": fmt_num(impressions),
                "ctr": fmt_pct(clicks / impressions if impressions else None),
                "avg_position": fmt_num(values["weighted_position"] / impressions if impressions else None, 1),
                "distinct_queries": fmt_num(values["queries"]),
                "read": (
                    "Strong click capture"
                    if impressions and clicks / impressions >= 0.03
                    else "High demand / weak click capture"
                    if impressions >= 25000
                    else "Emerging or narrower demand"
                ),
            }
        )
    summary = {
        "gsc_min_date": coverage["min_date"] if coverage else None,
        "gsc_max_date": coverage["max_date"] if coverage else None,
        "gsc_properties": coverage["properties"] if coverage else 0,
        "aggregated_queries": len(query_rows),
    }
    return output, summary


def build_ils_action_rows() -> list[dict[str, object]]:
    return [
        {
            "priority": "1",
            "lane": "Own direct-start ILS behavior",
            "action": "Treat Zillow and Apartments.com as search engines in their own right: audit listing completeness, lead response paths, live pricing, availability, photo order, review copy, concessions, and paid-placement rules.",
            "supporting_data": "Semrush estimates direct traffic at 43.70% for Zillow and 41.13% for Apartments.com in June 2026.",
        },
        {
            "priority": "2",
            "lane": "Keep winning Google discovery",
            "action": "Continue organic-market content work because Zillow/Apartments.com still receive roughly 35%-40% of platform visits from search, while Venterra already gets 37.0% of portfolio sessions from Organic Search.",
            "supporting_data": "Similarweb/Semrush external search bands plus Venterra GA4 channel mix.",
        },
        {
            "priority": "3",
            "lane": "Attack high-demand local SERPs",
            "action": "Use GSC market demand to prioritize city and neighborhood pages where impressions are high but CTR is weak, starting with the largest explicit-market opportunity clusters.",
            "supporting_data": "GSC market rollup in the workbook.",
        },
        {
            "priority": "4",
            "lane": "Close the ILS measurement gap",
            "action": "Pull account-level Zillow/Apartments.com listing views, search-result impressions, lead starts, calls, emails, and tour requests by property so platform-direct behavior can be tied back to Venterra communities.",
            "supporting_data": "Third-party tools expose platform-level mix, not Venterra listing-level share inside those ecosystems.",
        },
        {
            "priority": "5",
            "lane": "Match renter multi-touch behavior",
            "action": "Align Google Business Profiles, ILS listings, property pages, pricing feeds, and review language so a renter who checks five sites/apps sees the same current story everywhere.",
            "supporting_data": "Zillow's 2026 renter research says the typical renter used five sites or apps during search.",
        },
    ]


def build_ils_search_behavior(conn: sqlite3.Connection, request: ReportRequest) -> ReportBuild:
    start, end, date_range = resolve_date_window(conn, request)
    properties, scope_label = resolve_scoped_properties(request)
    property_ids = [item["property_id"] for item in properties]
    share_summary = fetch_share_summary(conn, property_ids, start, end)
    platform_summary_rows = build_ils_platform_summary_rows()
    channel_rows, channel_metrics = build_ils_channel_rows(conn, property_ids, start, end)
    market_rows, gsc_summary = build_ils_gsc_market_rows(conn, property_ids, start, end)
    action_rows = build_ils_action_rows()

    zillow_direct = 0.437
    apartments_direct = 0.4113
    direct_avg = (zillow_direct + apartments_direct) / 2
    gsc_coverage = (
        f"{fmt_date(gsc_summary['gsc_min_date'])} through {fmt_date(gsc_summary['gsc_max_date'])}"
        if gsc_summary.get("gsc_min_date") and gsc_summary.get("gsc_max_date")
        else "No GSC query coverage"
    )
    top_market = market_rows[0]["market_or_search_shape"] if market_rows else "No market demand rows"

    report = OutlookReport(
        title="Apartment Search Behavior And ILS Direct-Start Intelligence",
        subtitle="Organic / ILS Search Intelligence",
        version="1.0",
        date_range=date_range,
        generated_at=fmt_generated_at(),
        question_answered=(
            "Where are renters searching for apartments, how much of Zillow and Apartments.com demand appears to start directly on those platforms, "
            "and what does that mean for Venterra's organic and ILS growth strategy?"
        ),
        kpis=[
            ReportKpi(
                label="Avg Zillow / Apartments Direct",
                value=fmt_pct(direct_avg),
                note="Semrush platform-level benchmark, June 2026",
                primary=True,
            ),
            ReportKpi(
                label="Zillow Direct",
                value="43.7%",
                note="Semrush Traffic Analytics",
            ),
            ReportKpi(
                label="Apartments.com Direct",
                value="41.1%",
                note="Semrush Traffic Analytics",
            ),
            ReportKpi(
                label="Venterra Organic Share",
                value=fmt_pct(share_summary.get("organic_share")),
                note=f"{fmt_num(share_summary.get('organic_sessions'))} Organic Search sessions",
            ),
        ],
        sections=[
            ReportSection(
                title="Executive Read",
                paragraphs=[
                    "Apartment search is not a single-channel journey. The current evidence points to three overlapping behaviors: Google discovery, direct-start ILS search, and local/mobile comparison across multiple sites or apps.",
                    "For Zillow and Apartments.com, direct traffic is not a minor edge case. Semrush estimates that 43.70% of Zillow visits and 41.13% of Apartments.com visits came from Direct in June 2026. That means roughly four in ten platform visits are likely starting at the platform, from a saved habit, app-like behavior, bookmark, typed URL, or unattributed direct path.",
                    f"That does not reduce the importance of Google. Venterra's own GA4 data shows {fmt_num(share_summary.get('organic_sessions'))} Organic Search sessions, or {fmt_pct(share_summary.get('organic_share'))} of all sessions, over {date_range}. The ILS platforms also still show large Google/search bands: Zillow is roughly 35%-40% search-driven by Semrush/Similarweb, and Apartments.com is roughly 35%-36%.",
                ],
                callout=(
                    "The executive implication: keep investing in organic search, but manage Zillow and Apartments.com like separate search ecosystems with their own ranking, listing-quality, and conversion levers."
                ),
            ),
            ReportSection(
                title="Platform Benchmarks",
                paragraphs=[
                    "Semrush and Similarweb are modeled third-party estimates, not first-party analytics. They are still useful here because they answer a question GA4 cannot answer for external platforms: how much traffic appears to start directly on Zillow and Apartments.com versus arriving from Google/search.",
                ],
                tables=[
                    ReportTable(
                        title="Zillow and Apartments.com traffic-source benchmark",
                        columns=[
                            ("platform", "Platform"),
                            ("direct_start_share", "Direct-start share"),
                            ("semrush_google_share", "Semrush Google share"),
                            ("similarweb_organic_share", "Similarweb Organic Search share"),
                            ("executive_read", "Executive read"),
                        ],
                        rows=platform_summary_rows,
                    )
                ],
            ),
            ReportSection(
                title="Venterra First-Party Baseline",
                paragraphs=[
                    f"For {scope_label}, GA4 is the authoritative source for Venterra sessions and channel mix. Direct traffic on our owned sites is materially smaller than the ILS direct-start benchmark, while Organic Search is already a major source of owned-site demand.",
                ],
                tables=[
                    ReportTable(
                        title="GA4 channel mix",
                        columns=[
                            ("channel", "Channel"),
                            ("sessions", "Sessions"),
                            ("share_of_total_ga4_sessions", "Share of total GA4 sessions"),
                            ("new_users", "New users"),
                            ("engaged_sessions", "Engaged sessions"),
                            ("key_events", "Key events"),
                        ],
                        rows=channel_rows,
                        limit=12,
                    )
                ],
            ),
            ReportSection(
                title="Where Apartment Demand Shows Up",
                paragraphs=[
                    f"Google Search Console query data gives the clearest first-party read on named markets and local search shapes for owned Google organic demand. Current GSC query coverage in this packet is {gsc_coverage} across {fmt_num(gsc_summary.get('gsc_properties'))} properties.",
                    f"The largest apartment-search bucket in the rollup is {top_market}. Explicit city and neighborhood demand matters because it shows where renters are describing the apartment search in their own words, not just where our properties are located.",
                ],
                tables=[
                    ReportTable(
                        title="GSC apartment-search market demand",
                        columns=[
                            ("market_or_search_shape", "Market / search shape"),
                            ("gsc_clicks", "GSC clicks"),
                            ("gsc_impressions", "GSC impressions"),
                            ("ctr", "CTR"),
                            ("avg_position", "Avg position"),
                            ("distinct_queries", "Distinct queries"),
                            ("read", "Read"),
                        ],
                        rows=market_rows,
                        limit=25,
                    )
                ],
                warning=(
                    "This is query-language demand, not physical searcher location. It tells us which markets renters mention in searches and where Google is showing Venterra results."
                ),
            ),
            ReportSection(
                title="Renter Behavior Context",
                paragraphs=[
                    "Zillow's renter research supports the same multi-touch picture: renters search online, on mobile web, in apps, and across multiple sites. That is why the strategy should not frame ILS and organic as substitutes.",
                ],
                tables=[
                    ReportTable(
                        title="Renter-search behavior signals",
                        columns=[
                            ("source", "Source"),
                            ("finding", "Finding"),
                            ("value", "Value"),
                            ("executive_read", "Executive read"),
                        ],
                        rows=RENTER_SEARCH_BEHAVIOR_ROWS,
                    )
                ],
            ),
            ReportSection(
                title="Recommended Executive Actions",
                tables=[
                    ReportTable(
                        title="Actions to improve organic and ILS capture",
                        columns=[
                            ("priority", "Priority"),
                            ("lane", "Lane"),
                            ("action", "Action"),
                            ("supporting_data", "Supporting data"),
                        ],
                        rows=action_rows,
                    )
                ],
            ),
            ReportSection(
                title="Measurement Gaps",
                paragraphs=[
                    "The biggest open gap is not whether Zillow and Apartments.com have direct-start audiences; the external benchmarks say they do. The gap is Venterra's property-level visibility inside those platforms.",
                    "To complete the picture, we should request or export Zillow and Apartments.com listing-level impressions, search-result appearances, listing views, leads, calls, emails, tour starts, lead-to-tour conversion, and spend/placement by property. That would let the next version compare platform-direct ILS demand to Venterra-owned organic demand at the property and market level.",
                ],
            ),
        ],
        source_note=(
            "Venterra GA4 daily/channel tables and GSC query tables in the local Data Pond; Semrush Traffic Analytics June 2026 pages for zillow.com and apartments.com; Similarweb June 2026 pages for zillow.com and apartments.com; Zillow 2026 renter research references."
        ),
    )

    workbook_sheets = {
        "Platform Benchmarks": ILS_TRAFFIC_BENCHMARKS,
        "Platform Summary": platform_summary_rows,
        "GA4 Channel Mix": channel_rows,
        "GSC Market Demand": market_rows,
        "Renter Behavior": RENTER_SEARCH_BEHAVIOR_ROWS,
        "Actions": action_rows,
        "Source Notes": [
            {
                "source": "Data boundary",
                "note": "External platform traffic shares are modeled estimates; Venterra GA4/GSC rows are first-party portfolio data.",
            },
            {
                "source": "GSC boundary",
                "note": "GSC market rollup is query-language demand, not physical searcher location.",
            },
            {
                "source": "ILS gap",
                "note": "Venterra listing-level Zillow/Apartments.com impressions and leads require vendor/account exports.",
            },
        ],
    }

    return ReportBuild(
        report_type="ils_search_behavior",
        report=report,
        workbook_sheets=workbook_sheets,
        spec={
            "report_type": "ils_search_behavior",
            "scope": scope_label,
            "date_range": {"start": start.isoformat(), "end": end.isoformat(), "display": date_range},
            "question": report.question_answered,
            "first_party_metrics": {
                "total_sessions": share_summary.get("total_sessions"),
                "organic_sessions": share_summary.get("organic_sessions"),
                "organic_share": share_summary.get("organic_share"),
                "direct_sessions": channel_metrics.get("direct_sessions"),
                "direct_share": channel_metrics.get("direct_share"),
                "gsc_query_coverage": gsc_summary,
            },
            "external_benchmarks": ILS_TRAFFIC_BENCHMARKS,
            "sources": [
                "Local Data Pond: ga4_daily_metrics, ga4_traffic_sources, gsc_queries",
                "Semrush zillow.com Traffic Analytics, June 2026: https://www.semrush.com/website/zillow.com/overview/",
                "Semrush apartments.com Traffic Analytics, June 2026: https://www.semrush.com/website/apartments.com/overview/",
                "Similarweb zillow.com Traffic Analytics, June 2026: https://www.similarweb.com/website/zillow.com/",
                "Similarweb apartments.com Traffic Analytics, June 2026: https://www.similarweb.com/website/apartments.com/",
                "Zillow 2026 Consumer Housing Trends Report preview: https://www.zillow.com/rentals-network/zillow-rentals-consumer-housing-trends-report/",
                "Zillow News rental search evolution article: https://www.zillow.com/news/rental-search-has-evolved/",
                "Zillow Rentals Consumer Housing Trends Report 2024 PDF: https://www.zillowstatic.com/bedrock/app/uploads/sites/42/2023/11/Zillow-Rentals-Consumer-Housing-Trends-Report-2024.pdf",
            ],
            "limitations": [
                "Semrush and Similarweb are third-party modeled estimates and should be used directionally.",
                "GSC market rollup reflects query language, not physical searcher location.",
                "Vendor/account exports are required for Venterra listing-level Zillow and Apartments.com performance.",
            ],
        },
    )


def build_report(request: ReportRequest) -> ReportBuild:
    report_type = classify_report_type(request)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        if report_type == "organic_search_share":
            return build_organic_search_share(conn, request)
        if report_type == "ga4_traffic_summary":
            return build_ga4_traffic_summary(conn, request)
        if report_type == "ils_search_behavior":
            return build_ils_search_behavior(conn, request)
        if report_type == "content_manager_workup":
            return build_content_manager_workup(conn, request)
        if report_type == "content_intelligence_pack":
            return build_content_intelligence_pack(conn, request)
        raise ValueError(f"Unsupported report type: {report_type}")
    finally:
        conn.close()
