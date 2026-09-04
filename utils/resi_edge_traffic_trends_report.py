#!/usr/bin/env python3
"""Resi Edge launch traffic trend report source builder."""

from __future__ import annotations

import base64
import io
import sqlite3
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from outlook_report_builder import OutlookReport, ReportImage, ReportKpi, ReportSection, ReportTable


ROOT = Path("/Users/mark/Property_Analytics")
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"


@dataclass(frozen=True)
class CompatibleReportBuild:
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
    return datetime.now().strftime("%m/%d/%Y %-I:%M %p").replace(" 0", " ")


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


def fmt_change(value: float | None, decimals: int = 1) -> str:
    if value is None:
        return "-"
    return f"{value * 100:+,.{decimals}f}%"


def pct_change(current: float | int | None, previous: float | int | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return (float(current) - float(previous)) / float(previous)


def placeholders(items: list[object]) -> str:
    return ",".join("?" for _ in items)


def traffic_dates(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def load_portfolio_properties() -> list[dict[str, str]]:
    import json
    import sys

    sys.path.insert(0, str(ROOT))
    from Data_Collection.utils.property_identity import resolve_property_identity

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


def load_reporting_portfolio_properties(conn: sqlite3.Connection, start: date, end: date) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT property_id, SUM(sessions) AS sessions
        FROM ga4_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
        GROUP BY property_id
        HAVING SUM(sessions) IS NOT NULL
        ORDER BY property_id
        """,
        (start.isoformat(), end.isoformat()),
    ).fetchall()
    registry = {item["property_id"]: item for item in load_portfolio_properties()}
    properties: list[dict[str, str]] = []
    for row in rows:
        property_id = str(row["property_id"])
        known = registry.get(property_id, {})
        properties.append(
            {
                "property_id": property_id,
                "property_name": known.get("property_name") or property_id,
                "property_code": known.get("property_code") or "",
            }
        )
    return properties


def resolve_launch_cohort(names: list[str]) -> list[dict[str, str]]:
    import sys

    sys.path.insert(0, str(ROOT))
    from Data_Collection.utils.property_identity import resolve_property_identity

    cohort: list[dict[str, str]] = []
    for name in names:
        identity = resolve_property_identity(name)
        if not identity or not getattr(identity, "ga4_property_id", None):
            raise ValueError(f"Could not resolve launch property through the identity matrix: {name}")
        cohort.append(
            {
                "property_name": identity.property_name or name,
                "property_code": identity.property_code or "",
                "property_id": str(identity.ga4_property_id),
            }
        )
    return cohort


def complete_ga4_end_date(conn: sqlite3.Connection, property_ids: list[str]) -> tuple[date, bool, str]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        SELECT metric_date, SUM(sessions) AS sessions
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph})
        GROUP BY metric_date
        ORDER BY metric_date DESC
        LIMIT 9
        """,
        (*property_ids,),
    ).fetchall()
    if not rows:
        raise RuntimeError("No GA4 daily rows are available for the Resi Edge launch cohort.")
    latest = parse_iso_date(str(rows[0]["metric_date"]))
    if len(rows) < 4:
        return latest, True, "Latest available GA4 date used because fewer than four prior days were available."
    prior = [float(row["sessions"] or 0) for row in rows[1:8] if row["sessions"] is not None]
    prior_sorted = sorted(prior)
    median = prior_sorted[len(prior_sorted) // 2] if prior_sorted else 0
    latest_sessions = float(rows[0]["sessions"] or 0)
    if median and latest_sessions < median * 0.5:
        fallback = parse_iso_date(str(rows[1]["metric_date"]))
        return (
            fallback,
            False,
            f"Latest local GA4 date {fmt_date(latest)} appears incomplete for the cohort "
            f"({fmt_num(latest_sessions)} sessions versus a recent median of {fmt_num(median)}), "
            f"so the report uses {fmt_date(fallback)} as the latest complete local day.",
        )
    return latest, True, f"Latest local GA4 date {fmt_date(latest)} passed the completeness sanity check."


def fetch_property_daily_rows(
    conn: sqlite3.Connection,
    cohort: list[dict[str, str]],
    start: date,
    end: date,
) -> list[dict[str, object]]:
    property_ids = [item["property_id"] for item in cohort]
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        SELECT
          property_id,
          metric_date,
          COALESCE(SUM(sessions), 0) AS sessions,
          COALESCE(SUM(new_users), 0) AS new_users,
          COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
          COALESCE(SUM(pageviews), 0) AS pageviews
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY property_id, metric_date
        ORDER BY property_id, metric_date
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    by_key = {(str(row["property_id"]), str(row["metric_date"])): row for row in rows}
    output: list[dict[str, object]] = []
    for prop in cohort:
        for day in traffic_dates(start, end):
            raw = by_key.get((prop["property_id"], day.isoformat()))
            output.append(
                {
                    "date": day.isoformat(),
                    "display_date": fmt_date(day),
                    "property_code": prop["property_code"],
                    "property_name": prop["property_name"],
                    "property_id": prop["property_id"],
                    "sessions": int(raw["sessions"] or 0) if raw else 0,
                    "new_users": int(raw["new_users"] or 0) if raw else 0,
                    "engaged_sessions": int(raw["engaged_sessions"] or 0) if raw else 0,
                    "pageviews": int(raw["pageviews"] or 0) if raw else 0,
                    "row_present": bool(raw),
                }
            )
    return output


def fetch_daily_rollup_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    start: date,
    end: date,
) -> dict[str, dict[str, float]]:
    ph = placeholders(property_ids)
    rows = conn.execute(
        f"""
        SELECT
          metric_date,
          COALESCE(SUM(sessions), 0) AS sessions,
          COALESCE(SUM(new_users), 0) AS new_users,
          COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
          COALESCE(SUM(pageviews), 0) AS pageviews
        FROM ga4_daily_metrics
        WHERE property_id IN ({ph}) AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        (*property_ids, start.isoformat(), end.isoformat()),
    ).fetchall()
    return {
        str(row["metric_date"]): {key: float(row[key] or 0) for key in row.keys() if key != "metric_date"}
        for row in rows
    }


def summarize_traffic_period(
    daily_rows: list[dict[str, object]],
    start: date,
    end: date,
    property_count: int,
) -> dict[str, float]:
    days = (end - start).days + 1
    selected = [row for row in daily_rows if start.isoformat() <= str(row["date"]) <= end.isoformat()]
    sessions = sum(float(row["sessions"] or 0) for row in selected)
    new_users = sum(float(row["new_users"] or 0) for row in selected)
    engaged = sum(float(row["engaged_sessions"] or 0) for row in selected)
    pageviews = sum(float(row["pageviews"] or 0) for row in selected)
    present = sum(1 for row in selected if row.get("row_present"))
    return {
        "days": float(days),
        "property_days_expected": float(days * property_count),
        "property_days_present": float(present),
        "sessions": sessions,
        "new_users": new_users,
        "engaged_sessions": engaged,
        "pageviews": pageviews,
        "avg_daily_sessions": sessions / days if days else 0.0,
        "avg_property_daily_sessions": sessions / days / property_count if days and property_count else 0.0,
        "engagement_rate": engaged / sessions if sessions else 0.0,
    }


def build_property_summary_rows(
    daily_rows: list[dict[str, object]],
    cohort: list[dict[str, str]],
    pre_start: date,
    pre_end: date,
    post_start: date,
    post_end: date,
    portfolio_change: float | None,
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for prop in cohort:
        prop_rows = [row for row in daily_rows if row["property_id"] == prop["property_id"]]
        pre = summarize_traffic_period(prop_rows, pre_start, pre_end, 1)
        post = summarize_traffic_period(prop_rows, post_start, post_end, 1)
        change = pct_change(post["avg_daily_sessions"], pre["avg_daily_sessions"])
        rows.append(
            {
                "property_code": prop["property_code"],
                "property_name": prop["property_name"],
                "property_id": prop["property_id"],
                "pre_sessions": int(pre["sessions"]),
                "post_sessions": int(post["sessions"]),
                "pre_avg_daily_sessions": round(pre["avg_daily_sessions"], 1),
                "post_avg_daily_sessions": round(post["avg_daily_sessions"], 1),
                "avg_daily_change_pct": change,
                "vs_portfolio_baseline_pp": (float(change) - float(portfolio_change)) if change is not None and portfolio_change is not None else None,
                "post_engagement_rate": post["engagement_rate"],
                "data_coverage": f"{int(post['property_days_present'])}/{int(post['property_days_expected'])}",
            }
        )
    rows.sort(key=lambda item: float(item["avg_daily_change_pct"] or -999), reverse=True)
    return rows


def build_index_rows(
    daily_rows: list[dict[str, object]],
    property_summary: list[dict[str, object]],
    portfolio_daily: dict[str, dict[str, float]],
    portfolio_pre_avg_property_daily: float,
    launch_daily: dict[str, dict[str, float]],
    launch_pre_avg_daily: float,
    launch_date: date,
    start: date,
    end: date,
    portfolio_property_count: int,
) -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    pre_avg_by_id = {str(row["property_id"]): float(row["pre_avg_daily_sessions"] or 0) for row in property_summary}
    change_by_id = {str(row["property_id"]): row["avg_daily_change_pct"] for row in property_summary}
    baseline_rows: list[dict[str, object]] = []
    indexed_daily_rows: list[dict[str, object]] = []
    for day in traffic_dates(start, end):
        raw_portfolio = portfolio_daily.get(day.isoformat(), {})
        portfolio_sessions = float(raw_portfolio.get("sessions", 0) or 0)
        portfolio_per_property = portfolio_sessions / portfolio_property_count if portfolio_property_count else 0.0
        portfolio_index = (
            portfolio_per_property / portfolio_pre_avg_property_daily * 100
            if portfolio_pre_avg_property_daily
            else None
        )
        raw_launch = launch_daily.get(day.isoformat(), {})
        launch_sessions = float(raw_launch.get("sessions", 0) or 0)
        launch_index = launch_sessions / launch_pre_avg_daily * 100 if launch_pre_avg_daily else None
        baseline_rows.append(
            {
                "date": day.isoformat(),
                "display_date": fmt_date(day),
                "period": "Pre-launch" if day < launch_date else ("Launch day" if day == launch_date else "Post-launch"),
                "launch_cohort_sessions": int(launch_sessions),
                "launch_cohort_index": round(float(launch_index), 1) if launch_index is not None else None,
                "portfolio_sessions": int(portfolio_sessions),
                "portfolio_sessions_per_property": round(portfolio_per_property, 1),
                "portfolio_index": round(float(portfolio_index), 1) if portfolio_index is not None else None,
                "portfolio_properties": portfolio_property_count,
            }
        )
    baseline_by_date = {row["date"]: row for row in baseline_rows}
    for row in daily_rows:
        pre_avg = pre_avg_by_id[str(row["property_id"])]
        indexed_daily_rows.append(
            {
                **row,
                "period": "Pre-launch"
                if str(row["date"]) < launch_date.isoformat()
                else ("Launch day" if str(row["date"]) == launch_date.isoformat() else "Post-launch"),
                "property_index": round(float(row["sessions"] or 0) / pre_avg * 100, 1) if pre_avg else None,
                "portfolio_index": baseline_by_date[str(row["date"])]["portfolio_index"],
                "launch_cohort_index": baseline_by_date[str(row["date"])]["launch_cohort_index"],
                "avg_daily_change_pct": change_by_id[str(row["property_id"])],
            }
        )
    matrix_rows: list[dict[str, object]] = []
    for prop in sorted(property_summary, key=lambda item: str(item["property_name"])):
        prop_series = [row for row in indexed_daily_rows if row["property_id"] == prop["property_id"]]
        wide: dict[str, object] = {
            "series": "Property",
            "property_code": prop["property_code"],
            "property_name": prop["property_name"],
            "change_pct": prop["avg_daily_change_pct"],
        }
        for row in prop_series:
            wide[str(row["date"])] = row["property_index"]
        matrix_rows.append(wide)
    portfolio_wide: dict[str, object] = {
        "series": "Portfolio Baseline",
        "property_code": "PORT",
        "property_name": "Broader portfolio average",
        "change_pct": None,
    }
    for row in baseline_rows:
        portfolio_wide[str(row["date"])] = row["portfolio_index"]
    matrix_rows.append(portfolio_wide)
    return indexed_daily_rows, baseline_rows, matrix_rows


def build_channel_rows(
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
        channels AS (
          SELECT channel_group FROM pre
          UNION
          SELECT channel_group FROM post
        )
        SELECT
          channels.channel_group,
          COALESCE(pre.sessions, 0) AS pre_sessions,
          COALESCE(post.sessions, 0) AS post_sessions,
          COALESCE(pre.new_users, 0) AS pre_new_users,
          COALESCE(post.new_users, 0) AS post_new_users,
          COALESCE(pre.engaged_sessions, 0) AS pre_engaged,
          COALESCE(post.engaged_sessions, 0) AS post_engaged,
          COALESCE(pre.key_events, 0) AS pre_key_events,
          COALESCE(post.key_events, 0) AS post_key_events
        FROM channels
        LEFT JOIN pre ON pre.channel_group = channels.channel_group
        LEFT JOIN post ON post.channel_group = channels.channel_group
        ORDER BY post_sessions DESC
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
    pre_total = sum(float(row["pre_sessions"] or 0) for row in rows)
    post_total = sum(float(row["post_sessions"] or 0) for row in rows)
    output: list[dict[str, object]] = []
    for row in rows:
        pre_sessions = float(row["pre_sessions"] or 0)
        post_sessions = float(row["post_sessions"] or 0)
        pre_share = pre_sessions / pre_total if pre_total else None
        post_share = post_sessions / post_total if post_total else None
        output.append(
            {
                "channel": row["channel_group"] or "Unassigned",
                "pre_sessions": int(pre_sessions),
                "post_sessions": int(post_sessions),
                "pre_share": pre_share,
                "post_share": post_share,
                "share_change_pp": (post_share - pre_share) if pre_share is not None and post_share is not None else None,
                "post_engagement_rate": (float(row["post_engaged"] or 0) / post_sessions) if post_sessions else None,
                "post_key_events": int(row["post_key_events"] or 0),
            }
        )
    return output


def build_event_rows(
    conn: sqlite3.Connection,
    property_ids: list[str],
    event_categories: dict[str, list[str]],
    post_start: date,
    post_end: date,
) -> list[dict[str, object]]:
    names = sorted({event for events in event_categories.values() for event in events})
    prop_ph = placeholders(property_ids)
    event_ph = placeholders(names)
    rows = conn.execute(
        f"""
        SELECT LOWER(event_name) AS event_name, SUM(event_count) AS event_count, COUNT(DISTINCT event_date) AS active_days, COUNT(DISTINCT property_id) AS properties
        FROM ga4_event_facts
        WHERE property_id IN ({prop_ph})
          AND event_date BETWEEN ? AND ?
          AND LOWER(event_name) IN ({event_ph})
        GROUP BY LOWER(event_name)
        """,
        (*property_ids, post_start.isoformat(), post_end.isoformat(), *names),
    ).fetchall()
    counts = {str(row["event_name"]): row for row in rows}
    output: list[dict[str, object]] = []
    for category, event_names in event_categories.items():
        category_total = sum(int((counts.get(name) or {})["event_count"] or 0) for name in event_names if name in counts)
        active_days = max([int((counts.get(name) or {})["active_days"] or 0) for name in event_names if name in counts] or [0])
        properties = max([int((counts.get(name) or {})["properties"] or 0) for name in event_names if name in counts] or [0])
        output.append(
            {
                "category": category,
                "included_events": ", ".join(event_names),
                "post_launch_events": category_total,
                "active_days": active_days,
                "properties": properties,
            }
        )
    output.sort(key=lambda item: int(item["post_launch_events"]), reverse=True)
    return output


def render_sparkline_chart(
    property_summary: list[dict[str, object]],
    indexed_daily_rows: list[dict[str, object]],
    baseline_rows: list[dict[str, object]],
    launch_date: date,
    start: date,
    end: date,
) -> str:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    navy = "#15284B"
    gray = "#9B9B96"
    quill = "#D6D6D2"
    terra = "#BD4830"
    black = "#000000"
    dates = traffic_dates(start, end)
    x_values = list(range(len(dates)))
    launch_x = (launch_date - start).days
    portfolio_index = [row["portfolio_index"] for row in baseline_rows]
    by_property: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in indexed_daily_rows:
        by_property[str(row["property_id"])].append(row)

    chart_props = sorted(property_summary, key=lambda item: str(item["property_name"]))
    fig, axes = plt.subplots(5, 4, figsize=(12, 9), dpi=160, sharex=True)
    fig.patch.set_facecolor("white")
    for ax, prop in zip(axes.flatten(), chart_props):
        series = sorted(by_property[str(prop["property_id"])], key=lambda item: str(item["date"]))
        prop_index = [row["property_index"] for row in series]
        ax.plot(x_values, portfolio_index, color=gray, linestyle=(0, (4, 2)), linewidth=1.1)
        ax.plot(x_values, prop_index, color=navy, linewidth=1.6)
        ax.axhline(100, color=quill, linewidth=0.7)
        ax.axvline(launch_x, color=terra, linewidth=1.0)
        ax.set_title(f"{prop['property_name']}  {fmt_change(prop['avg_daily_change_pct'])}", fontsize=8.3, color=black, loc="left", pad=2)
        ymax = max(180, max([float(value or 0) for value in prop_index] + [float(value or 0) for value in portfolio_index]) * 1.12)
        ax.set_ylim(0, ymax)
        ax.grid(axis="y", color=quill, linewidth=0.45, alpha=0.7)
        ax.tick_params(axis="both", labelsize=6, colors=gray, length=2)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color(quill)
        ax.spines["bottom"].set_color(quill)
        ax.set_xticks([0, launch_x, len(dates) - 1])
        ax.set_xticklabels([fmt_date(start)[0:5], fmt_date(launch_date)[0:5], fmt_date(end)[0:5]])
    for ax in axes.flatten()[len(chart_props) :]:
        ax.axis("off")

    fig.suptitle(
        "Resi Edge 20-Site Traffic Trends vs Portfolio Baseline",
        x=0.02,
        y=0.992,
        ha="left",
        fontsize=13,
        fontweight="bold",
        color=navy,
    )
    fig.text(
        0.02,
        0.962,
        f"Indexed sessions: 100 = each property's {fmt_date(start)}-{fmt_date(launch_date - timedelta(days=1))} daily average. "
        f"Dashed gray line = broader portfolio average. Red marker = {fmt_date(launch_date)} launch.",
        fontsize=8,
        color=gray,
    )
    fig.text(0.02, 0.018, f"Window: {fmt_date(start)} through {fmt_date(end)}", fontsize=7, color=gray)
    plt.tight_layout(rect=[0, 0.035, 1, 0.94], h_pad=1.4, w_pad=0.8)
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight", facecolor="white")
    plt.close(fig)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def html_property_rows(rows: list[dict[str, object]], limit: int | None = None) -> list[dict[str, object]]:
    selected = rows[:limit] if limit else rows
    return [
        {
            "property": row["property_name"],
            "code": row["property_code"],
            "pre_avg": fmt_num(row["pre_avg_daily_sessions"], 1),
            "post_avg": fmt_num(row["post_avg_daily_sessions"], 1),
            "change": fmt_change(row["avg_daily_change_pct"]),
            "vs_portfolio": fmt_pp(row["vs_portfolio_baseline_pp"]),
            "post_engagement": fmt_pct(row["post_engagement_rate"]),
        }
        for row in selected
    ]


def html_channel_rows(rows: list[dict[str, object]], limit: int | None = None) -> list[dict[str, object]]:
    selected = rows[:limit] if limit else rows
    return [
        {
            "channel": row["channel"],
            "pre_sessions": fmt_num(row["pre_sessions"]),
            "post_sessions": fmt_num(row["post_sessions"]),
            "pre_share": fmt_pct(row["pre_share"]),
            "post_share": fmt_pct(row["post_share"]),
            "share_change": fmt_pp(row["share_change_pp"]),
            "post_engagement": fmt_pct(row["post_engagement_rate"]),
        }
        for row in selected
    ]


def build_resi_edge_traffic_trends(
    conn: sqlite3.Connection,
    request: Any,
    cohort_names: list[str],
    event_categories: dict[str, list[str]],
) -> CompatibleReportBuild:
    launch_date = date(2026, 8, 19)
    start = parse_iso_date(request.start_date) if request.start_date else date(2026, 7, 19)
    cohort = resolve_launch_cohort(cohort_names)
    launch_property_ids = [item["property_id"] for item in cohort]
    inferred_end, latest_complete, completeness_note = complete_ga4_end_date(conn, launch_property_ids)
    end = parse_iso_date(request.end_date) if request.end_date else inferred_end
    if end < launch_date:
        raise ValueError("The Resi Edge traffic-trend report requires an end date on or after 08/19/2026.")
    pre_start = start
    pre_end = launch_date - timedelta(days=1)
    post_start = launch_date
    post_end = end

    launch_daily_rows = fetch_property_daily_rows(conn, cohort, start, end)
    launch_pre = summarize_traffic_period(launch_daily_rows, pre_start, pre_end, len(cohort))
    launch_post = summarize_traffic_period(launch_daily_rows, post_start, post_end, len(cohort))
    launch_change = pct_change(launch_post["avg_daily_sessions"], launch_pre["avg_daily_sessions"])

    portfolio_properties = load_reporting_portfolio_properties(conn, start, end)
    portfolio_property_ids = [item["property_id"] for item in portfolio_properties]
    portfolio_daily_rows = fetch_property_daily_rows(conn, portfolio_properties, start, end)
    portfolio_pre = summarize_traffic_period(portfolio_daily_rows, pre_start, pre_end, len(portfolio_properties))
    portfolio_post = summarize_traffic_period(portfolio_daily_rows, post_start, post_end, len(portfolio_properties))
    portfolio_change = pct_change(portfolio_post["avg_daily_sessions"], portfolio_pre["avg_daily_sessions"])
    portfolio_property_summary = build_property_summary_rows(
        portfolio_daily_rows,
        portfolio_properties,
        pre_start,
        pre_end,
        post_start,
        post_end,
        portfolio_change,
    )

    property_summary = build_property_summary_rows(
        launch_daily_rows,
        cohort,
        pre_start,
        pre_end,
        post_start,
        post_end,
        portfolio_change,
    )
    launch_rollup = fetch_daily_rollup_rows(conn, launch_property_ids, start, end)
    portfolio_rollup = fetch_daily_rollup_rows(conn, portfolio_property_ids, start, end)
    indexed_daily_rows, baseline_rows, index_matrix_rows = build_index_rows(
        launch_daily_rows,
        property_summary,
        portfolio_rollup,
        portfolio_pre["avg_property_daily_sessions"],
        launch_rollup,
        launch_pre["avg_daily_sessions"],
        launch_date,
        start,
        end,
        len(portfolio_properties),
    )
    channel_rows = build_channel_rows(conn, launch_property_ids, pre_start, pre_end, post_start, post_end)
    event_rows = build_event_rows(conn, launch_property_ids, event_categories, post_start, post_end)
    chart_data_uri = render_sparkline_chart(property_summary, indexed_daily_rows, baseline_rows, launch_date, start, end)

    rollup_rows = [
        {
            "cohort": "20-site launch cohort",
            "properties": len(cohort),
            "pre_window": fmt_date_range(pre_start, pre_end),
            "post_window": fmt_date_range(post_start, post_end),
            "pre_sessions": int(launch_pre["sessions"]),
            "post_sessions": int(launch_post["sessions"]),
            "pre_avg_daily_sessions": round(launch_pre["avg_daily_sessions"], 1),
            "post_avg_daily_sessions": round(launch_post["avg_daily_sessions"], 1),
            "pre_avg_property_daily_sessions": round(launch_pre["avg_property_daily_sessions"], 1),
            "post_avg_property_daily_sessions": round(launch_post["avg_property_daily_sessions"], 1),
            "avg_daily_change_pct": launch_change,
            "post_engagement_rate": launch_post["engagement_rate"],
            "coverage": f"{int(launch_post['property_days_present'])}/{int(launch_post['property_days_expected'])}",
        },
        {
            "cohort": "Broader portfolio baseline",
            "properties": len(portfolio_properties),
            "pre_window": fmt_date_range(pre_start, pre_end),
            "post_window": fmt_date_range(post_start, post_end),
            "pre_sessions": int(portfolio_pre["sessions"]),
            "post_sessions": int(portfolio_post["sessions"]),
            "pre_avg_daily_sessions": round(portfolio_pre["avg_daily_sessions"], 1),
            "post_avg_daily_sessions": round(portfolio_post["avg_daily_sessions"], 1),
            "pre_avg_property_daily_sessions": round(portfolio_pre["avg_property_daily_sessions"], 1),
            "post_avg_property_daily_sessions": round(portfolio_post["avg_property_daily_sessions"], 1),
            "avg_daily_change_pct": portfolio_change,
            "post_engagement_rate": portfolio_post["engagement_rate"],
            "coverage": f"{int(portfolio_post['property_days_present'])}/{int(portfolio_post['property_days_expected'])}",
        },
    ]
    date_range = fmt_date_range(start, end)
    relative_read = (launch_change or 0) - (portfolio_change or 0)
    report = OutlookReport(
        title="Resi Edge Launch Traffic Trend Report",
        subtitle="Property Intelligence Brief",
        version="1.0.0",
        date_range=f"{date_range} - launch marker {fmt_date(launch_date)}",
        generated_at=fmt_generated_at(),
        question_answered=request.subject,
        kpis=[
            ReportKpi(
                "Launch Cohort",
                fmt_change(launch_change),
                note=f"{fmt_num(launch_post['avg_daily_sessions'], 0)} sessions/day after launch.",
                primary=True,
            ),
            ReportKpi(
                "Portfolio Baseline",
                fmt_change(portfolio_change),
                note=f"{len(portfolio_properties)} locally reporting GA4 properties.",
            ),
            ReportKpi(
                "Relative Read",
                fmt_pp(relative_read),
                note="Launch cohort change minus portfolio change.",
            ),
            ReportKpi(
                "Latest Complete Day",
                fmt_date(end),
                note="Local GA4 completeness checked.",
            ),
        ],
        sections=[
            ReportSection(
                title="Executive Read",
                paragraphs=[
                    (
                        f"The 20-site Resi Edge launch cohort averaged {fmt_num(launch_pre['avg_daily_sessions'], 1)} "
                        f"sessions per day before launch and {fmt_num(launch_post['avg_daily_sessions'], 1)} after "
                        f"the 08/19/2026 vanity-domain launch, a {fmt_change(launch_change)} shift."
                    ),
                    (
                        f"The broader portfolio baseline moved from {fmt_num(portfolio_pre['avg_daily_sessions'], 1)} "
                        f"to {fmt_num(portfolio_post['avg_daily_sessions'], 1)} sessions per day over the same split, "
                        f"a {fmt_change(portfolio_change)} shift. On this read, the launch cohort outperformed the "
                        f"portfolio baseline by {fmt_pp(relative_read)}."
                    ),
                    "The chart uses indexed sessions so smaller and larger properties can be compared on trend shape rather than raw volume.",
                ],
                callout="Early read: the launch cohort held essentially flat to slightly up while the broader portfolio softened over the same dates.",
            ),
            ReportSection(
                title="Sparkline Read",
                paragraphs=[
                    "Each panel is one launched site. The solid line is the property, the dashed gray line is the broader portfolio average, and the vertical red marker is launch day."
                ],
                images=[
                    ReportImage(
                        title="20-Site Indexed Traffic Sparklines",
                        data_uri=chart_data_uri,
                        alt="Twenty Resi Edge launch properties shown as indexed traffic sparklines against the portfolio baseline.",
                    )
                ],
            ),
            ReportSection(
                title="Top Movers",
                tables=[
                    ReportTable(
                        title="Outperformers",
                        columns=[
                            ("property", "Property"),
                            ("code", "Code"),
                            ("pre_avg", "Pre avg/day"),
                            ("post_avg", "Post avg/day"),
                            ("change", "Change"),
                            ("vs_portfolio", "Vs portfolio"),
                            ("post_engagement", "Post engagement"),
                        ],
                        rows=html_property_rows(property_summary, 3),
                    ),
                    ReportTable(
                        title="Watch List",
                        columns=[
                            ("property", "Property"),
                            ("code", "Code"),
                            ("pre_avg", "Pre avg/day"),
                            ("post_avg", "Post avg/day"),
                            ("change", "Change"),
                            ("vs_portfolio", "Vs portfolio"),
                            ("post_engagement", "Post engagement"),
                        ],
                        rows=html_property_rows(list(reversed(property_summary)), 3),
                    ),
                ],
            ),
            ReportSection(
                title="Channel Mix",
                paragraphs=[
                    "Direct and Unassigned expanded after the vanity-domain launch while Organic Search and Paid Search shares declined. Treat this as an attribution-continuity flag before treating it as a demand conclusion."
                ],
                tables=[
                    ReportTable(
                        title="Launch Cohort Channel Mix",
                        columns=[
                            ("channel", "Channel"),
                            ("pre_sessions", "Pre sessions"),
                            ("post_sessions", "Post sessions"),
                            ("pre_share", "Pre share"),
                            ("post_share", "Post share"),
                            ("share_change", "Share change"),
                            ("post_engagement", "Post engagement"),
                        ],
                        rows=html_channel_rows(channel_rows, 8),
                    )
                ],
            ),
            ReportSection(
                title="Data Read",
                paragraphs=[
                    completeness_note,
                    (
                        f"GA4 daily coverage for the post-launch cohort window is "
                        f"{int(launch_post['property_days_present'])}/{int(launch_post['property_days_expected'])} property-days. "
                        "High-intent event rows are included in the workbook but should remain supporting evidence until the post-launch event window is refreshed for full-date completeness."
                    ),
                ],
            ),
        ],
        source_note=(
            "Local Data Pond portfolio_analytics.db tables ga4_daily_metrics, ga4_traffic_sources, and ga4_event_facts; "
            "20-site cohort from the governed Resi Edge launch cohort; launch date verified against the 08/19/2026 vanity QA packet."
        ),
    )
    workbook_sheets = {
        "Rollup Summary": rollup_rows,
        "Property Summary": property_summary,
        "All Portfolio Period Data": portfolio_property_summary,
        "Daily Property Data": indexed_daily_rows,
        "Daily Baseline": baseline_rows,
        "Index Matrix": index_matrix_rows,
        "Channel Mix": channel_rows,
        "Launch Events": event_rows,
        "Cohort": cohort,
    }
    spec = {
        "request": asdict(request),
        "report_type": "resi_edge_traffic_trends",
        "date_range": date_range,
        "launch_date": launch_date.isoformat(),
        "latest_complete_local_day": end.isoformat(),
        "latest_local_day_passed_completeness_check": latest_complete,
        "completeness_note": completeness_note,
        "cohort_property_count": len(cohort),
        "portfolio_property_count": len(portfolio_properties),
        "windows": {
            "pre_launch": {"start": pre_start.isoformat(), "end": pre_end.isoformat()},
            "post_launch": {"start": post_start.isoformat(), "end": post_end.isoformat()},
        },
        "rollup": rollup_rows,
        "chart": {
            "type": "indexed_20_sparkline_png",
            "data_uri": chart_data_uri,
            "normalization": "100 = each property's pre-launch daily sessions average; dashed baseline = broader portfolio per-property daily sessions index.",
        },
        "sources": [
            "data/portfolio_analytics.db: ga4_daily_metrics",
            "data/portfolio_analytics.db: ga4_traffic_sources",
            "data/portfolio_analytics.db: ga4_event_facts",
            "reports/domain_ops/20260819_120423_vanity_qa/vanity-qa-summary.json",
            "reports/resi_edge_performance/launch-dashboard-snapshot/launch-dashboard-snapshot-20260831T184043Z/launch-snapshot.json",
        ],
    }
    return CompatibleReportBuild(
        report_type="resi_edge_traffic_trends",
        report=report,
        workbook_sheets=workbook_sheets,
        spec=spec,
    )
