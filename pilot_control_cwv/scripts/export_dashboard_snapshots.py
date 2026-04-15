from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from measurement_dashboard_parser import (
    MEASUREMENT_PATH,
    ingest_measurement_workbook,
    latest_heap_status,
)


ROOT = Path("/Users/mark/Property_Analytics")
CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUTPUT_ROOTS = [
    ROOT / "apps" / "web" / "public" / "pilot-kpi",
    ROOT / "apps" / "pilot-tracker-standalone" / "public" / "pilot-kpi",
]

PILOT_COLOR = "#4473D0"
SISTER_COLOR = "#7CCAC2"
BASELINE_COLOR = "#A3A3A3"
FLOOR_COLOR = "#F4A6A6"

UNIT_COUNTS = {
    "Calais Midtown": 356,
    "Champions Green": 426,
    "The District Universal Boulevard": 425,
    "The Harrison": 505,
    "Ventana": 390,
    "Avasa Spring Branch": 361,
    "Axial Buckhead": 169,
    "Northbridge at Millenia Lake": 607,
    "The Whitney": 310,
    "Park on Wurzbach": 264,
}

PROPERTY_CODES = {
    "Calais Midtown": "TX4MI",
    "Champions Green": "GA4CG",
    "The District Universal Boulevard": "FL4DU",
    "The Harrison": "GA4TH",
    "Ventana": "TX4VE",
    "Avasa Spring Branch": "TX4BM",
    "Axial Buckhead": "GA4AB",
    "Northbridge at Millenia Lake": "FL4NB",
    "The Whitney": "GA4TW",
    "Park on Wurzbach": "TX4WZ",
}

CWV_BASELINES = {
    "psi": {"baseline": 90.0, "floor": 60.0, "title": "PSI Avg"},
    "gtmetrix": {"baseline": 94.0, "floor": 70.0, "title": "GTMetrix Avg"},
}

FUNNEL_TITLES = {
    "lead_to_available_unit_rate": "Lead (Guest Card) to Available Unit Rate",
    "website_sales_funnel_price_quote": "Website Sales Funnel - Price Quote",
    "website_sales_funnel_visits_schedule_tour": "Website Sales Funnel - Visits (Schedule a Tour)",
    "website_sales_funnel_completed_applications": "Website Sales Funnel - Completed Applications",
    "website_funnel_conversions_click_to_call": "Website Funnel Conversions - Click to Call / Phone",
    "website_funnel_conversions_contact_form": "Website Funnel Conversions - Contact Form",
}

BI_SECTION_METRICS = {
    "lead_to_available_unit_rate": {"metric_code": "GC/AU", "daily_window": "T7D_DAILY_AVG", "baseline_window": "T90D"},
    "website_sales_funnel_price_quote": {"metric_code": "PQ/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_sales_funnel_visits_schedule_tour": {"metric_code": "ST/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_sales_funnel_completed_applications": {"metric_code": "A/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_funnel_conversions_click_to_call": {"metric_code": "C2C/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_funnel_conversions_contact_form": {"metric_code": "CFrm/GC", "daily_window": "T7D", "baseline_window": "T90D"},
}


@dataclass
class Pair:
    pair_key: str
    pilot_name: str
    pilot_id: str
    sister_name: str
    sister_id: str


def load_pairs() -> list[Pair]:
    cfg = json.loads(CONFIG_PATH.read_text())
    cohorts = {c["key"]: c for c in cfg["cohorts"] if c.get("active")}
    pairs: list[Pair] = []
    for cohort in cohorts.values():
        if cohort["role"] != "pilot":
            continue
        sister = cohorts[cohort["sister_key"]]
        pair_key = (
            cohort["display_name"].lower().replace(" ", "_").replace("-", "_")
            + "__"
            + sister["display_name"].lower().replace(" ", "_").replace("-", "_")
        )
        pairs.append(
            Pair(
                pair_key=pair_key,
                pilot_name=cohort["display_name"],
                pilot_id=cohort["property_id"],
                sister_name=sister["display_name"],
                sister_id=sister["property_id"],
            )
        )
    return pairs


def load_bi_history_rows(conn: sqlite3.Connection) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT
            snapshot_date,
            property_name,
            property_id,
            role,
            sister_property_name,
            conv_source,
            metric_code,
            window,
            comparison_type,
            value,
            source_file,
            source_sheet,
            source_row,
            source_column,
            header_raw
        FROM bi_normalized_metrics
        ORDER BY snapshot_date, property_name, conv_source, metric_code, window, comparison_type
        """
    ).fetchall()
    return [{k: ("" if row[k] is None else str(row[k])) for k in row.keys()} for row in rows]


def load_measurement_rows(conn: sqlite3.Connection) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT
            snapshot_date,
            property_name_raw,
            property_name,
            row_role,
            metric_key,
            metric_label,
            value_type,
            value_numeric,
            value_text,
            source_file,
            source_sheet,
            header_raw
        FROM measurement_daily_metrics
        ORDER BY snapshot_date, property_name_raw, metric_key
        """
    ).fetchall()
    result: list[dict[str, str]] = []
    for row in rows:
        payload = {}
        for key in row.keys():
            value = row[key]
            payload[key] = "" if value is None else str(value)
        result.append(payload)
    return result


def latest_measurement_source_file(measurement_rows: list[dict[str, str]]) -> str | None:
    candidates = [row for row in measurement_rows if row.get("source_file")]
    if not candidates:
        return None
    latest = max(candidates, key=lambda row: (row["snapshot_date"], row["source_file"]))
    return latest["source_file"]


def latest_bi_source_file(history_rows: list[dict[str, str]]) -> str | None:
    candidates = [row for row in history_rows if row.get("source_file")]
    if not candidates:
        return None
    latest = max(candidates, key=lambda row: (row["snapshot_date"], row["source_file"]))
    return latest["source_file"]


def build_bi_series_rows(history_rows: list[dict[str, str]], pairs: list[Pair]) -> list[dict[str, str]]:
    latest_baseline: dict[tuple[str, str, str], tuple[str, float]] = {}
    value_index: dict[tuple[str, str, str, str, str, str], float] = {}
    dates = sorted({row["snapshot_date"] for row in history_rows})

    for row in history_rows:
        key = (
            row["snapshot_date"],
            row["property_name"],
            row["conv_source"],
            row["metric_code"],
            row["window"],
            row["comparison_type"],
        )
        value_index[key] = float(row["value"])
        if (
            row["conv_source"] == "Website Conversion"
            and row["comparison_type"] in {"current", "sister"}
            and row["window"] in {"T90D", "T90D_DAILY_AVG"}
        ):
            latest_key = (row["property_name"], row["metric_code"], row["comparison_type"])
            snapshot_date = row["snapshot_date"]
            value = float(row["value"])
            if latest_key not in latest_baseline or snapshot_date > latest_baseline[latest_key][0]:
                latest_baseline[latest_key] = (snapshot_date, value)

    series_rows: list[dict[str, str]] = []
    for pair in pairs:
        for section_key, metric in BI_SECTION_METRICS.items():
            metric_code = metric["metric_code"]
            daily_window = metric["daily_window"]
            pilot_baseline = latest_baseline.get((pair.pilot_name, metric_code, "current"))
            sister_baseline = (
                latest_baseline.get((pair.pilot_name, metric_code, "sister"))
                or latest_baseline.get((pair.sister_name, metric_code, "current"))
            )
            for snapshot_date in dates:
                pilot_daily = value_index.get(
                    (snapshot_date, pair.pilot_name, "Website Conversion", metric_code, daily_window, "current")
                )
                sister_daily = value_index.get(
                    (snapshot_date, pair.pilot_name, "Website Conversion", metric_code, daily_window, "sister")
                )
                series_rows.append(
                    {
                        "snapshot_date": snapshot_date,
                        "section_key": section_key,
                        "metric_code": metric_code,
                        "pilot_property_name": pair.pilot_name,
                        "pilot_property_id": pair.pilot_id,
                        "sister_property_name": pair.sister_name,
                        "sister_property_id": pair.sister_id,
                        "daily_window": daily_window,
                        "baseline_window": metric["baseline_window"],
                        "pilot_daily_value": "" if pilot_daily is None else str(pilot_daily),
                        "sister_daily_value": "" if sister_daily is None else str(sister_daily),
                        "pilot_baseline_value": "" if not pilot_baseline else str(pilot_baseline[1]),
                        "sister_baseline_value": "" if not sister_baseline else str(sister_baseline[1]),
                        "baseline_source_date": "" if not pilot_baseline else pilot_baseline[0],
                        "row_filter": "Website Conversion",
                    }
                )
    return series_rows


def fmt_score(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.1f}".rstrip("0").rstrip(".")


def fmt_pct(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value * 100:.1f}%"


def fmt_count(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.0f}"


def fmt_points(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.1f} pts"


def fmt_ratio(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.6f}"


def fmt_metric_value(value: float | None, format_name: str) -> str | None:
    if format_name == "percent":
        return fmt_pct(value)
    if format_name == "count":
        return fmt_count(value)
    if format_name == "points":
        return fmt_points(value)
    return fmt_score(value)


def status_from_gap(pilot: float | None, sister: float | None, higher_is_better: bool = True) -> dict[str, str]:
    if pilot is None or sister is None:
        return {"state": "pending", "label": "Pending", "reason": "One or more source values are missing."}
    gap = pilot - sister
    if not higher_is_better:
        gap *= -1
    if abs(gap) < 0.01:
        return {"state": "stable", "label": "Stable", "reason": "Pilot and sister are performing at roughly the same level."}
    if gap > 0:
        return {"state": "closing", "label": "Pilot Leading", "reason": "Pilot is outperforming its sister comparison."}
    return {"state": "widening", "label": "Sister Leading", "reason": "Sister is currently outperforming the pilot property."}


def source_status(latest_date: str, as_of_date: str, pending_today: bool = False) -> dict[str, str]:
    latest = datetime.fromisoformat(latest_date).date()
    as_of = datetime.fromisoformat(as_of_date).date()
    delta = (as_of - latest).days
    if pending_today:
        return {"latest_date": latest_date, "status": "pending_today"}
    if delta <= 1:
        return {"latest_date": latest_date, "status": "fresh"}
    return {"latest_date": latest_date, "status": "stale"}


def query_cwv_series(conn: sqlite3.Connection, pairs: list[Pair], table: str, value_col: str) -> tuple[list[str], dict[str, list[dict[str, Any]]]]:
    property_ids = [p.pilot_id for p in pairs] + [p.sister_id for p in pairs]
    placeholders = ",".join("?" for _ in property_ids)
    if table == "pilot_control_psi_metrics":
        date_rows = conn.execute(
            f"""
            SELECT metric_date
            FROM {table}
            WHERE strategy='mobile' AND property_id IN ({placeholders})
            GROUP BY metric_date
            HAVING COUNT(DISTINCT property_id) >= ?
            ORDER BY metric_date DESC
            LIMIT 6
            """,
            [*property_ids, len(property_ids)],
        ).fetchall()
        rows = conn.execute(
            f"""
            SELECT metric_date, property_id, display_name, {value_col}
            FROM {table}
            WHERE strategy='mobile' AND metric_date IN ({",".join("?" for _ in date_rows)}) AND property_id IN ({placeholders})
            ORDER BY metric_date
            """,
            [*(r[0] for r in reversed(date_rows)), *property_ids],
        ).fetchall()
    else:
        date_rows = conn.execute(
            f"""
            SELECT metric_date
            FROM {table}
            WHERE property_id IN ({placeholders})
            GROUP BY metric_date
            HAVING COUNT(DISTINCT property_id) >= ?
            ORDER BY metric_date DESC
            LIMIT 6
            """,
            [*property_ids, len(property_ids)],
        ).fetchall()
        rows = conn.execute(
            f"""
            SELECT metric_date, property_id, {value_col}
            FROM {table}
            WHERE metric_date IN ({",".join("?" for _ in date_rows)}) AND property_id IN ({placeholders})
            ORDER BY metric_date
            """,
            [*(r[0] for r in reversed(date_rows)), *property_ids],
        ).fetchall()

    dates = [r[0] for r in reversed(date_rows)]
    by_prop: dict[str, dict[str, float]] = defaultdict(dict)
    for row in rows:
        date, property_id, value = row[0], row[1], row[-1]
        if value is None:
            continue
        by_prop[str(property_id)][date] = float(value)

    pair_series: dict[str, list[dict[str, Any]]] = {}
    for pair in pairs:
        series: list[dict[str, Any]] = []
        for date in dates:
            pv = by_prop.get(pair.pilot_id, {}).get(date)
            sv = by_prop.get(pair.sister_id, {}).get(date)
            if pv is None or sv is None:
                continue
            series.append(
                {
                    "date": date,
                    "label": datetime.fromisoformat(date).strftime("%-m/%-d"),
                    "pilot_value": pv,
                    "sister_value": sv,
                    "pilot_value_display": fmt_score(pv),
                    "sister_value_display": fmt_score(sv),
                }
            )
        pair_series[pair.pair_key] = series
    return dates, pair_series


def rollup_from_pairs(pair_series: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    by_date: dict[str, dict[str, list[float]]] = defaultdict(lambda: {"pilot": [], "sister": []})
    labels: dict[str, str] = {}
    for series in pair_series.values():
        for point in series:
            by_date[point["date"]]["pilot"].append(point["pilot_value"])
            by_date[point["date"]]["sister"].append(point["sister_value"])
            labels[point["date"]] = point["label"]
    output = []
    for date in sorted(by_date):
        pv = sum(by_date[date]["pilot"]) / len(by_date[date]["pilot"])
        sv = sum(by_date[date]["sister"]) / len(by_date[date]["sister"])
        output.append(
            {
                "date": date,
                "label": labels[date],
                "pilot_value": pv,
                "sister_value": sv,
                "pilot_value_display": fmt_score(pv),
                "sister_value_display": fmt_score(sv),
            }
        )
    return output


def build_measurement_index(rows: list[dict[str, str]]) -> dict[tuple[str, str], list[dict[str, str]]]:
    idx: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        property_name = row.get("property_name")
        metric_key = row.get("metric_key")
        if not property_name or not metric_key:
            continue
        idx[(property_name, metric_key)].append(row)
    for bucket in idx.values():
        bucket.sort(key=lambda row: row["snapshot_date"])
    return idx


def measurement_series(
    idx: dict[tuple[str, str], list[dict[str, str]]],
    pair: Pair,
    metric_key: str,
) -> list[dict[str, Any]]:
    pilot_rows = idx.get((pair.pilot_name, metric_key), [])
    sister_rows = idx.get((pair.sister_name, metric_key), [])
    sister_by_date = {
        row["snapshot_date"]: float(row["value_numeric"])
        for row in sister_rows
        if row.get("value_numeric") not in ("", None)
    }
    series: list[dict[str, Any]] = []
    for row in pilot_rows:
        if row.get("value_numeric") in ("", None):
            continue
        date = row["snapshot_date"]
        sister_value = sister_by_date.get(date)
        if sister_value is None:
            continue
        pilot_value = float(row["value_numeric"])
        series.append(
            {
                "date": date,
                "label": datetime.fromisoformat(date).strftime("%-m/%-d"),
                "pilot_value": pilot_value,
                "sister_value": sister_value,
            }
        )
    return series


def measurement_average_series(
    idx: dict[tuple[str, str], list[dict[str, str]]],
    metric_key: str,
    pilot_label: str = "PILOT AVERAGE",
    sister_label: str = "SISTER AVERAGE",
) -> list[dict[str, Any]]:
    pilot_rows = idx.get((pilot_label, metric_key), [])
    sister_rows = idx.get((sister_label, metric_key), [])
    sister_by_date = {
        row["snapshot_date"]: float(row["value_numeric"])
        for row in sister_rows
        if row.get("value_numeric") not in ("", None)
    }
    series: list[dict[str, Any]] = []
    for row in pilot_rows:
        if row.get("value_numeric") in ("", None):
            continue
        date = row["snapshot_date"]
        sister_value = sister_by_date.get(date)
        if sister_value is None:
            continue
        pilot_value = float(row["value_numeric"])
        series.append(
            {
                "date": date,
                "label": datetime.fromisoformat(date).strftime("%-m/%-d"),
                "pilot_value": pilot_value,
                "sister_value": sister_value,
            }
        )
    return series


def latest_measurement_value(
    idx: dict[tuple[str, str], list[dict[str, str]]],
    property_name: str,
    metric_key: str,
) -> float | None:
    rows = idx.get((property_name, metric_key), [])
    if not rows:
        return None
    latest_row = rows[-1]
    if latest_row.get("value_numeric") not in ("", None):
        return float(latest_row["value_numeric"])
    return None


def latest_measurement_text(
    idx: dict[tuple[str, str], list[dict[str, str]]],
    property_name: str,
    metric_key: str,
) -> str | None:
    rows = idx.get((property_name, metric_key), [])
    if not rows:
        return None
    latest_row = rows[-1]
    text = latest_row.get("value_text")
    if text:
        return text
    return None


def subtract_one_year(date_str: str) -> str:
    dt = datetime.fromisoformat(date_str)
    return dt.replace(year=dt.year - 1).date().isoformat()


def load_ga4_daily_rollups(
    conn: sqlite3.Connection,
    pairs: list[Pair],
    lookback_days: int = 40,
    display_points: int = 6,
    rolling_window: int = 7,
) -> dict[str, Any]:
    property_ids = sorted({p.pilot_id for p in pairs} | {p.sister_id for p in pairs})
    placeholders = ",".join("?" for _ in property_ids)

    date_rows = conn.execute(
        f"""
        SELECT metric_date
        FROM ga4_daily_metrics
        WHERE property_id IN ({placeholders})
        GROUP BY metric_date
        HAVING COUNT(DISTINCT property_id) >= ?
        ORDER BY metric_date DESC
        LIMIT ?
        """,
        [*property_ids, len(property_ids), lookback_days],
    ).fetchall()
    common_dates = sorted(row[0] for row in date_rows)
    if not common_dates:
        return {"latest_date": None, "pair_metrics": {}}

    prior_dates = sorted({subtract_one_year(date_str) for date_str in common_dates})
    all_dates = sorted(set(common_dates) | set(prior_dates))
    all_date_placeholders = ",".join("?" for _ in all_dates)

    rows = conn.execute(
        f"""
        SELECT
            d.property_id,
            d.metric_date,
            d.new_users AS total_new_users,
            d.total_users AS total_users,
            COALESCE(ts.new_users, 0) AS organic_new_users,
            COALESCE(ts.total_users, 0) AS organic_total_users
        FROM ga4_daily_metrics d
        LEFT JOIN ga4_traffic_sources ts
          ON ts.property_id = d.property_id
         AND ts.metric_date = d.metric_date
         AND ts.channel_group = 'Organic Search'
        WHERE d.property_id IN ({placeholders})
          AND d.metric_date IN ({all_date_placeholders})
        ORDER BY d.property_id, d.metric_date
        """,
        [*property_ids, *all_dates],
    ).fetchall()

    by_property: dict[str, dict[str, dict[str, float]]] = defaultdict(dict)
    for row in rows:
        by_property[str(row["property_id"])][str(row["metric_date"])] = {
            "total_new_users": float(row["total_new_users"] or 0),
            "total_users": float(row["total_users"] or 0),
            "organic_new_users": float(row["organic_new_users"] or 0),
            "organic_total_users": float(row["organic_total_users"] or 0),
        }

    def rolling_sum(property_id: str, end_date: str, metric_name: str) -> float | None:
        try:
            end_idx = common_dates.index(end_date)
        except ValueError:
            return None
        if end_idx < rolling_window - 1:
            return None
        window_dates = common_dates[end_idx - rolling_window + 1 : end_idx + 1]
        total = 0.0
        for date_key in window_dates:
            day = by_property.get(property_id, {}).get(date_key)
            if day is None:
                return None
            total += float(day.get(metric_name, 0) or 0)
        return total

    def rolling_sum_explicit(property_id: str, end_date: str, metric_name: str) -> float | None:
        end_dt = datetime.fromisoformat(end_date).date()
        window_dates = [(end_dt).fromordinal(end_dt.toordinal() - offset).isoformat() for offset in range(rolling_window - 1, -1, -1)]
        total = 0.0
        for date_key in window_dates:
            day = by_property.get(property_id, {}).get(date_key)
            if day is None:
                return None
            total += float(day.get(metric_name, 0) or 0)
        return total

    def current_volume(property_id: str, end_date: str) -> float | None:
        return rolling_sum(property_id, end_date, "organic_new_users")

    def current_share(property_id: str, end_date: str) -> float | None:
        organic = rolling_sum(property_id, end_date, "organic_total_users")
        total = rolling_sum(property_id, end_date, "total_users")
        if organic is None or total in (None, 0):
            return None
        return organic / total

    def current_share_points(property_id: str, end_date: str) -> float | None:
        share = current_share(property_id, end_date)
        return None if share is None else share * 100.0

    def prior_volume(property_id: str, end_date: str) -> float | None:
        return rolling_sum_explicit(property_id, subtract_one_year(end_date), "organic_new_users")

    def prior_share(property_id: str, end_date: str) -> float | None:
        organic = rolling_sum_explicit(property_id, subtract_one_year(end_date), "organic_total_users")
        total = rolling_sum_explicit(property_id, subtract_one_year(end_date), "total_users")
        if organic is None or total in (None, 0):
            return None
        return organic / total

    def yoy_delta(current: float | None, previous: float | None) -> float | None:
        if current is None or previous in (None, 0):
            return None
        return (current - previous) / previous

    def yoy_points(current: float | None, previous: float | None) -> float | None:
        if current is None or previous is None:
            return None
        return (current - previous) * 100.0

    valid_dates = common_dates[rolling_window - 1 :]
    display_dates = valid_dates[-display_points:]

    pair_metrics: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for pair in pairs:
        metrics = {
            "organic_volume_t7": [],
            "organic_pct_unique_users": [],
            "organic_yoy_vol_delta": [],
            "organic_share_yoy_points_delta": [],
        }
        for date_key in display_dates:
            pilot_volume = current_volume(pair.pilot_id, date_key)
            sister_volume = current_volume(pair.sister_id, date_key)
            if pilot_volume is not None and sister_volume is not None:
                metrics["organic_volume_t7"].append(
                    {
                        "date": date_key,
                        "label": datetime.fromisoformat(date_key).strftime("%-m/%-d"),
                        "pilot_value": pilot_volume,
                        "sister_value": sister_volume,
                    }
                )

            pilot_share = current_share(pair.pilot_id, date_key)
            sister_share = current_share(pair.sister_id, date_key)
            if pilot_share is not None and sister_share is not None:
                metrics["organic_pct_unique_users"].append(
                    {
                        "date": date_key,
                        "label": datetime.fromisoformat(date_key).strftime("%-m/%-d"),
                        "pilot_value": pilot_share,
                        "sister_value": sister_share,
                    }
                )

            pilot_yoy = yoy_delta(pilot_volume, prior_volume(pair.pilot_id, date_key))
            sister_yoy = yoy_delta(sister_volume, prior_volume(pair.sister_id, date_key))
            if pilot_yoy is not None and sister_yoy is not None:
                metrics["organic_yoy_vol_delta"].append(
                    {
                        "date": date_key,
                        "label": datetime.fromisoformat(date_key).strftime("%-m/%-d"),
                        "pilot_value": pilot_yoy,
                        "sister_value": sister_yoy,
                    }
                )

            pilot_share_yoy = yoy_points(pilot_share, prior_share(pair.pilot_id, date_key))
            sister_share_yoy = yoy_points(sister_share, prior_share(pair.sister_id, date_key))
            if pilot_share_yoy is not None and sister_share_yoy is not None:
                metrics["organic_share_yoy_points_delta"].append(
                    {
                        "date": date_key,
                        "label": datetime.fromisoformat(date_key).strftime("%-m/%-d"),
                        "pilot_value": pilot_share_yoy,
                        "sister_value": sister_share_yoy,
                    }
                )
        pair_metrics[pair.pair_key] = metrics

    return {
        "latest_date": display_dates[-1] if display_dates else common_dates[-1],
        "pair_metrics": pair_metrics,
    }


def build_cwv_snapshot(as_of_date: str, meta: dict[str, Any], pairs: list[Pair]) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    _, psi_pair_series = query_cwv_series(conn, pairs, "pilot_control_psi_metrics", "performance_score")
    _, gt_pair_series = query_cwv_series(conn, pairs, "gtmetrix_metrics", "pagespeed_score")

    psi_rollup = rollup_from_pairs(psi_pair_series)
    gt_rollup = rollup_from_pairs(gt_pair_series)

    payload = {
        "meta": meta,
        "rollups": {
            "psi": {
                "title": CWV_BASELINES["psi"]["title"],
                "format": "score",
                "baseline": CWV_BASELINES["psi"]["baseline"],
                "floor": CWV_BASELINES["psi"]["floor"],
                "series": psi_rollup,
                "pilot_current": psi_rollup[-1]["pilot_value"] if psi_rollup else None,
                "sister_current": psi_rollup[-1]["sister_value"] if psi_rollup else None,
                "status": status_from_gap(
                    psi_rollup[-1]["pilot_value"] if psi_rollup else None,
                    psi_rollup[-1]["sister_value"] if psi_rollup else None,
                ),
            },
            "gtmetrix": {
                "title": CWV_BASELINES["gtmetrix"]["title"],
                "format": "score",
                "baseline": CWV_BASELINES["gtmetrix"]["baseline"],
                "floor": CWV_BASELINES["gtmetrix"]["floor"],
                "series": gt_rollup,
                "pilot_current": gt_rollup[-1]["pilot_value"] if gt_rollup else None,
                "sister_current": gt_rollup[-1]["sister_value"] if gt_rollup else None,
                "status": status_from_gap(
                    gt_rollup[-1]["pilot_value"] if gt_rollup else None,
                    gt_rollup[-1]["sister_value"] if gt_rollup else None,
                ),
            },
        },
        "pairs": [],
    }
    for pair in pairs:
        psi_series = psi_pair_series[pair.pair_key]
        gt_series = gt_pair_series[pair.pair_key]
        payload["pairs"].append(
            {
                "identity": {
                    "pair_key": pair.pair_key,
                    "pilot": {"name": pair.pilot_name, "property_id": pair.pilot_id},
                    "sister": {"name": pair.sister_name, "property_id": pair.sister_id},
                },
                "metrics": {
                    "psi": {
                        "format": "score",
                        "baseline": CWV_BASELINES["psi"]["baseline"],
                        "floor": CWV_BASELINES["psi"]["floor"],
                        "series": psi_series,
                        "pilot_current": psi_series[-1]["pilot_value"] if psi_series else None,
                        "sister_current": psi_series[-1]["sister_value"] if psi_series else None,
                    },
                    "gtmetrix": {
                        "format": "score",
                        "baseline": CWV_BASELINES["gtmetrix"]["baseline"],
                        "floor": CWV_BASELINES["gtmetrix"]["floor"],
                        "series": gt_series,
                        "pilot_current": gt_series[-1]["pilot_value"] if gt_series else None,
                        "sister_current": gt_series[-1]["sister_value"] if gt_series else None,
                    },
                },
            }
        )
    return payload


def build_traffic_snapshot(
    conn: sqlite3.Connection,
    meta: dict[str, Any],
    pairs: list[Pair],
    measurement_rows: list[dict[str, str]],
) -> dict[str, Any]:
    idx = build_measurement_index(measurement_rows)
    latest = latest_heap_status()
    ga4_rollups = load_ga4_daily_rollups(conn, pairs)
    ga4_latest = ga4_rollups.get("latest_date")

    metric_specs = [
        {
            "metric_key": "organic_pct_unique_users",
            "snapshot_key": "organic_pct_unique_users",
            "title": "Organic Traffic as a % of Unique Users",
            "format": "percent",
            "baseline_key": None,
            "source_note": f"Exact GA4 Organic Search unique-user share through {ga4_latest or 'latest available date'}.",
            "source": "ga4",
        },
        {
            "metric_key": "organic_volume_t7",
            "snapshot_key": "organic_volume_t7",
            "title": "Organic Volume #",
            "format": "count",
            "baseline_key": None,
            "source_note": f"Exact GA4 Organic Search new users, rolling 7-day total through {ga4_latest or 'latest available date'}.",
            "source": "ga4",
        },
        {
            "metric_key": "high_intent_click_rate_t7",
            "snapshot_key": "high_intent_user_rate",
            "title": "High Intent User Rate",
            "format": "percent",
            "baseline_key": "high_intent_click_rate_baseline",
            "source_note": f"Heap Measurement latest available {latest.latest_date_label}",
            "source": "measurement",
        },
        {
            "metric_key": "organic_yoy_vol_delta",
            "snapshot_key": "organic_yoy_vol_delta",
            "title": "YoY - Vol Δ to Organic Traffic Vol",
            "format": "percent",
            "baseline_key": None,
            "source_note": "Exact GA4 Organic Search new-user YoY delta from rolling 7-day totals. Blank until prior-year GA4 is available in the Data Pond.",
            "source": "ga4",
        },
        {
            "metric_key": "organic_share_yoy_points_delta",
            "snapshot_key": "organic_share_yoy_points_delta",
            "title": "YoY - Vol Δ - Percent Points to Organic Share",
            "format": "points",
            "baseline_key": None,
            "source_note": "Exact GA4 Organic Search unique-user share YoY delta in percentage points. Blank until prior-year GA4 is available in the Data Pond.",
            "source": "ga4",
        },
    ]

    metrics = []
    for spec in metric_specs:
        pair_entries = []
        pair_series_rollup = {}
        if spec["source"] == "ga4":
            for pair in pairs:
                series = ga4_rollups["pair_metrics"].get(pair.pair_key, {}).get(spec["metric_key"], [])
                pair_series_rollup[pair.pair_key] = series
                pilot_current = series[-1]["pilot_value"] if series else None
                sister_current = series[-1]["sister_value"] if series else None
                pair_entries.append(
                    {
                        "identity": {
                            "pair_key": pair.pair_key,
                            "pilot": {"name": pair.pilot_name, "property_id": pair.pilot_id},
                            "sister": {"name": pair.sister_name, "property_id": pair.sister_id},
                        },
                        "pilot_current": pilot_current,
                        "pilot_current_display": fmt_metric_value(pilot_current, spec["format"]),
                        "sister_current": sister_current,
                        "sister_current_display": fmt_metric_value(sister_current, spec["format"]),
                        "pilot_baseline": None,
                        "pilot_baseline_display": None,
                        "sister_baseline": None,
                        "sister_baseline_display": None,
                        "series": [
                            {
                                **point,
                                "pilot_value_display": fmt_metric_value(point["pilot_value"], spec["format"]),
                                "sister_value_display": fmt_metric_value(point["sister_value"], spec["format"]),
                            }
                            for point in series
                        ],
                        "status": status_from_gap(pilot_current, sister_current),
                    }
                )
            rollup = rollup_from_pairs(pair_series_rollup)
            pilot_rollup_current = rollup[-1]["pilot_value"] if rollup else None
            sister_rollup_current = rollup[-1]["sister_value"] if rollup else None
            pilot_rollup_baseline = None
            sister_rollup_baseline = None
        else:
            for pair in pairs:
                series = measurement_series(idx, pair, spec["metric_key"])
                pair_series_rollup[pair.pair_key] = series
                pilot_current = latest_measurement_value(idx, pair.pilot_name, spec["metric_key"])
                sister_current = latest_measurement_value(idx, pair.sister_name, spec["metric_key"])
                pilot_baseline = (
                    latest_measurement_value(idx, pair.pilot_name, spec["baseline_key"])
                    if spec["baseline_key"]
                    else None
                )
                sister_baseline = (
                    latest_measurement_value(idx, pair.sister_name, spec["baseline_key"])
                    if spec["baseline_key"]
                    else None
                )
                pair_entries.append(
                    {
                        "identity": {
                            "pair_key": pair.pair_key,
                            "pilot": {"name": pair.pilot_name, "property_id": pair.pilot_id},
                            "sister": {"name": pair.sister_name, "property_id": pair.sister_id},
                        },
                        "pilot_current": pilot_current,
                        "pilot_current_display": fmt_metric_value(pilot_current, spec["format"]),
                        "sister_current": sister_current,
                        "sister_current_display": fmt_metric_value(sister_current, spec["format"]),
                        "pilot_baseline": pilot_baseline,
                        "pilot_baseline_display": fmt_metric_value(pilot_baseline, spec["format"]),
                        "sister_baseline": sister_baseline,
                        "sister_baseline_display": fmt_metric_value(sister_baseline, spec["format"]),
                        "series": [
                            {
                                **point,
                                "pilot_value_display": fmt_metric_value(point["pilot_value"], spec["format"]),
                                "sister_value_display": fmt_metric_value(point["sister_value"], spec["format"]),
                            }
                            for point in series
                        ],
                        "status": status_from_gap(pilot_current, sister_current),
                    }
                )
            rollup = rollup_from_pairs(pair_series_rollup)
            pilot_rollup_current = rollup[-1]["pilot_value"] if rollup else None
            sister_rollup_current = rollup[-1]["sister_value"] if rollup else None
            pilot_rollup_baseline = pair_entries[0]["pilot_baseline"] if pair_entries else None
            sister_rollup_baseline = pair_entries[0]["sister_baseline"] if pair_entries else None

        metrics.append(
            {
                "metric_key": spec["snapshot_key"],
                "title": spec["title"],
                "format": spec["format"],
                "pilot_current": pilot_rollup_current,
                "pilot_current_display": fmt_metric_value(pilot_rollup_current, spec["format"]),
                "sister_current": sister_rollup_current,
                "sister_current_display": fmt_metric_value(sister_rollup_current, spec["format"]),
                "pilot_baseline": pilot_rollup_baseline,
                "pilot_baseline_display": fmt_metric_value(pilot_rollup_baseline, spec["format"]),
                "sister_baseline": sister_rollup_baseline,
                "sister_baseline_display": fmt_metric_value(sister_rollup_baseline, spec["format"]),
                "status": status_from_gap(
                    pilot_rollup_current,
                    sister_rollup_current,
                ),
                "series": [
                    {
                        **point,
                        "pilot_value_display": fmt_metric_value(point["pilot_value"], spec["format"]),
                        "sister_value_display": fmt_metric_value(point["sister_value"], spec["format"]),
                    }
                    for point in rollup
                ],
                "pairs": pair_entries,
                "source_note": spec["source_note"],
                "benchmark_note": latest_measurement_text(idx, "PILOT AVERAGE", "high_intent_click_rate_benchmark")
                if spec["snapshot_key"] == "high_intent_user_rate"
                else None,
                "pilot_notes": latest_measurement_text(idx, "PILOT AVERAGE", "organic_traffic_notes")
                if spec["snapshot_key"] == "organic_pct_unique_users"
                else None,
            }
        )
    return {"meta": meta, "metrics": metrics}


def build_funnel_snapshot(meta: dict[str, Any], pairs: list[Pair], bi_rows: list[dict[str, str]]) -> dict[str, Any]:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    pair_lookup = {(p.pilot_name, p.sister_name): p for p in pairs}
    for row in bi_rows:
        grouped[row["section_key"]][(row["pilot_property_name"], row["sister_property_name"])].append(row)

    metrics = []
    for section_key, title in FUNNEL_TITLES.items():
        pair_entries = []
        pair_series_rollup = {}
        for (pilot_name, sister_name), rows in grouped.get(section_key, {}).items():
            pair = pair_lookup[(pilot_name, sister_name)]
            rows.sort(key=lambda r: r["snapshot_date"])
            series = []
            for r in rows:
                if r["pilot_daily_value"] == "" or r["sister_daily_value"] == "":
                    continue
                pv = float(r["pilot_daily_value"])
                sv = float(r["sister_daily_value"])
                label = datetime.fromisoformat(r["snapshot_date"]).strftime("%-m/%-d")
                series.append(
                    {
                        "date": r["snapshot_date"],
                        "label": label,
                        "pilot_value": pv,
                        "sister_value": sv,
                        "pilot_value_display": fmt_pct(pv),
                        "sister_value_display": fmt_pct(sv),
                    }
                )
            pair_series_rollup[pair.pair_key] = series
            current_row = rows[-1]
            pilot_current = float(current_row["pilot_daily_value"]) if current_row["pilot_daily_value"] else None
            sister_current = float(current_row["sister_daily_value"]) if current_row["sister_daily_value"] else None
            pilot_baseline = float(current_row["pilot_baseline_value"]) if current_row["pilot_baseline_value"] else None
            sister_baseline = float(current_row["sister_baseline_value"]) if current_row["sister_baseline_value"] else None
            pair_entries.append(
                {
                    "identity": {
                        "pair_key": pair.pair_key,
                        "pilot": {"name": pair.pilot_name, "property_id": pair.pilot_id},
                        "sister": {"name": pair.sister_name, "property_id": pair.sister_id},
                    },
                    "pilot_current": pilot_current,
                    "pilot_current_display": fmt_pct(pilot_current),
                    "sister_current": sister_current,
                    "sister_current_display": fmt_pct(sister_current),
                    "pilot_baseline": pilot_baseline,
                    "pilot_baseline_display": fmt_pct(pilot_baseline),
                    "sister_baseline": sister_baseline,
                    "sister_baseline_display": fmt_pct(sister_baseline),
                    "series": series,
                    "status": status_from_gap(pilot_current, sister_current),
                }
            )
        rollup = rollup_from_pairs(pair_series_rollup)
        latest_pair = pair_entries[0] if pair_entries else {}
        metrics.append(
            {
                "metric_key": section_key,
                "title": title,
                "format": "percent",
                "pilot_current": rollup[-1]["pilot_value"] if rollup else None,
                "pilot_current_display": fmt_pct(rollup[-1]["pilot_value"]) if rollup else None,
                "sister_current": rollup[-1]["sister_value"] if rollup else None,
                "sister_current_display": fmt_pct(rollup[-1]["sister_value"]) if rollup else None,
                "pilot_baseline": latest_pair.get("pilot_baseline"),
                "pilot_baseline_display": latest_pair.get("pilot_baseline_display"),
                "sister_baseline": latest_pair.get("sister_baseline"),
                "sister_baseline_display": latest_pair.get("sister_baseline_display"),
                "status": status_from_gap(
                    rollup[-1]["pilot_value"] if rollup else None,
                    rollup[-1]["sister_value"] if rollup else None,
                ),
                "series": rollup,
                "pairs": pair_entries,
            }
        )
    return {"meta": meta, "metrics": metrics}


def build_overview_snapshot(meta: dict[str, Any], cwv: dict[str, Any], traffic: dict[str, Any], funnel: dict[str, Any]) -> dict[str, Any]:
    return {
        "meta": meta,
        "sections": [
            {
                "section_key": "core_web_vitals",
                "title": "Core Web Vitals",
                "detail_href": "/tracker/cwv",
                "metrics": [
                    {
                        "metric_key": "cwv_psi",
                        "title": cwv["rollups"]["psi"]["title"],
                        "format": "score",
                        "series": cwv["rollups"]["psi"]["series"],
                        "pilot_current": cwv["rollups"]["psi"]["pilot_current"],
                        "sister_current": cwv["rollups"]["psi"]["sister_current"],
                        "baseline": cwv["rollups"]["psi"]["baseline"],
                        "floor": cwv["rollups"]["psi"]["floor"],
                        "status": cwv["rollups"]["psi"]["status"],
                    },
                    {
                        "metric_key": "cwv_gtmetrix",
                        "title": cwv["rollups"]["gtmetrix"]["title"],
                        "format": "score",
                        "series": cwv["rollups"]["gtmetrix"]["series"],
                        "pilot_current": cwv["rollups"]["gtmetrix"]["pilot_current"],
                        "sister_current": cwv["rollups"]["gtmetrix"]["sister_current"],
                        "baseline": cwv["rollups"]["gtmetrix"]["baseline"],
                        "floor": cwv["rollups"]["gtmetrix"]["floor"],
                        "status": cwv["rollups"]["gtmetrix"]["status"],
                    },
                ],
            },
            {
                "section_key": "traffic_engagement",
                "title": "Traffic & Engagement",
                "detail_href": "/tracker/traffic",
                "metrics": traffic["metrics"],
            },
            {
                "section_key": "funnel",
                "title": "Funnel",
                "detail_href": "/tracker/funnel",
                "metrics": funnel["metrics"],
            },
        ],
    }


def build_properties_snapshot(cwv: dict[str, Any], traffic: dict[str, Any], funnel: dict[str, Any]) -> dict[str, Any]:
    traffic_pairs = {p["identity"]["pair_key"]: p for p in traffic["metrics"][0]["pairs"]} if traffic["metrics"] else {}
    funnel_by_pair: dict[str, dict[str, Any]] = defaultdict(dict)
    for metric in funnel["metrics"]:
        for pair in metric["pairs"]:
            funnel_by_pair[pair["identity"]["pair_key"]][metric["metric_key"]] = pair

    output = {"pairs": []}
    for pair in cwv["pairs"]:
        key = pair["identity"]["pair_key"]
        output["pairs"].append(
            {
                "identity": pair["identity"],
                "cwv": pair["metrics"],
                "traffic": traffic_pairs.get(key),
                "funnel": funnel_by_pair.get(key, {}),
            }
        )
    return output


def build_archive_snapshot(as_of_date: str) -> dict[str, Any]:
    workbook = ROOT / "pilot_control_cwv" / "reports" / f"Pilot_KPI_Summary_Details_Full_{as_of_date}.xlsx"
    email_preview = ROOT / "pilot_control_cwv" / "reports" / f"pilot_kpi_email_preview_{as_of_date}.html"
    return {
        "latest": {
            "date": as_of_date,
            "workbook_path": str(workbook) if workbook.exists() else None,
            "email_preview_path": str(email_preview) if email_preview.exists() else None,
        },
        "runs": [
            {
                "date": as_of_date,
                "workbook_path": str(workbook) if workbook.exists() else None,
                "email_preview_path": str(email_preview) if email_preview.exists() else None,
            }
        ],
    }


def load_available_unit_counts(conn: sqlite3.Connection, pairs: list[Pair]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for pair in pairs:
        for prop_id, name in [(pair.pilot_id, pair.pilot_name), (pair.sister_id, pair.sister_name)]:
            latest_seen = conn.execute(
                "SELECT MAX(last_seen_date) FROM available_units WHERE property_id = ?",
                (prop_id,),
            ).fetchone()[0]
            if not latest_seen:
                counts[name] = 0
                continue
            count = conn.execute(
                """
                SELECT COUNT(DISTINCT unit_id)
                FROM available_units
                WHERE property_id = ? AND last_seen_date = ?
                """,
                (prop_id, latest_seen),
            ).fetchone()[0]
            counts[name] = int(count or 0)
    return counts


def pct_delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return ((current - previous) / abs(previous)) * 100.0


def status_label_from_gap(current_gap: float | None, previous_gap: float | None) -> str:
    if current_gap is None:
        return "Stable"
    if abs(current_gap) < 0.0001:
        return "Gap Closed"
    if previous_gap is None:
        return "Closing" if current_gap > 0 else "Widening"
    if abs(current_gap) < abs(previous_gap):
        return "Closing"
    if abs(current_gap) > abs(previous_gap):
        return "Widening"
    return "Stable"


def build_bi_history_index(rows: list[dict[str, str]]) -> dict[tuple[str, str, str, str, str, str], list[dict[str, str]]]:
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = (
            row["property_name"],
            row["sister_property_name"],
            row["conv_source"],
            row["metric_code"],
            row["window"],
            row["comparison_type"],
        )
        idx[key].append(row)
    for rows_list in idx.values():
        rows_list.sort(key=lambda r: r["snapshot_date"])
    return idx


def extract_bi_series(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
) -> list[dict[str, Any]]:
    current_rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, "current"), [])
    sister_rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, "sister"), [])
    sister_by_date = {
        row["snapshot_date"]: float(row["value"]) for row in sister_rows if row["value"] not in ("", None)
    }
    series: list[dict[str, Any]] = []
    for row in current_rows:
        if row["value"] in ("", None):
            continue
        date = row["snapshot_date"]
        pilot_value = float(row["value"])
        sister_value = sister_by_date.get(date)
        if sister_value is None:
            continue
        series.append(
            {
                "date": date,
                "label": datetime.fromisoformat(date).strftime("%-m/%-d"),
                "pilot_value": pilot_value,
                "sister_value": sister_value,
            }
        )
    return series


def latest_row(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
    comparison_type: str = "current",
) -> dict[str, str] | None:
    rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, comparison_type), [])
    return rows[-1] if rows else None


def latest_snapshot_date(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
    comparison_types: list[str] | tuple[str, ...] = ("current", "sister", "prior_year"),
) -> str | None:
    dates: set[str] = set()
    for comparison_type in comparison_types:
        rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, comparison_type), [])
        dates.update(row["snapshot_date"] for row in rows if row.get("snapshot_date"))
    return max(dates) if dates else None


def row_at_snapshot(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
    comparison_type: str,
    snapshot_date: str | None,
) -> dict[str, str] | None:
    if not snapshot_date:
        return None
    rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, comparison_type), [])
    for row in rows:
        if row.get("snapshot_date") == snapshot_date:
            return row
    return None


def previous_row(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
    comparison_type: str = "current",
) -> dict[str, str] | None:
    rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, comparison_type), [])
    return rows[-2] if len(rows) > 1 else None


def previous_row_before(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
    comparison_type: str,
    snapshot_date: str | None,
) -> dict[str, str] | None:
    rows = idx.get((pair.pilot_name, pair.sister_name, conv_source, metric_code, window, comparison_type), [])
    if snapshot_date is None:
        return rows[-1] if rows else None
    earlier = [row for row in rows if row.get("snapshot_date") and row["snapshot_date"] < snapshot_date]
    return earlier[-1] if earlier else None


def metric_card_payload(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    conv_source: str,
    metric_code: str,
    window: str,
    format_type: str,
    available_units: dict[str, int],
    total_units: dict[str, int],
    title: str,
) -> dict[str, Any]:
    snapshot_date = latest_snapshot_date(idx, pair, conv_source, metric_code, window)
    current = row_at_snapshot(idx, pair, conv_source, metric_code, window, "current", snapshot_date)
    sister = row_at_snapshot(idx, pair, conv_source, metric_code, window, "sister", snapshot_date)
    prev = previous_row_before(idx, pair, conv_source, metric_code, window, "current", snapshot_date)
    current_val = float(current["value"]) if current and current["value"] else None
    sister_val = float(sister["value"]) if sister and sister["value"] else None
    prev_val = float(prev["value"]) if prev and prev["value"] else None
    avail_pilot = available_units.get(pair.pilot_name, 0)
    avail_sister = available_units.get(pair.sister_name, 0)
    total_pilot = total_units.get(pair.pilot_name, 0)
    total_sister = total_units.get(pair.sister_name, 0)
    def build_side(name: str, value: float | None, other: float | None, avail: int, total: int, is_pilot: bool) -> dict[str, Any]:
        display = fmt_ratio(value) if format_type == "ratio" else fmt_pct(value)
        atr = round((avail / total) * 100) if total else None
        occupancy = (100 - atr) if atr is not None else None
        delta = pct_delta(value, other) if is_pilot else None
        prev_delta = pct_delta(value, prev_val) if is_pilot else None
        return {
            "name": name,
            "value": value,
            "display": display,
            "subtitle": f"{avail} avail. units ({total} total)",
            "vs_sister_pct": delta,
            "previous_period_pct": prev_delta,
            "yoy_pct": None,
            "occupancy_pct": occupancy,
            "atr_pct": atr,
        }
    return {
        "title": title,
        "pilot": build_side(pair.pilot_name, current_val, sister_val, avail_pilot, total_pilot, True),
        "sister": build_side(pair.sister_name, sister_val, current_val, avail_sister, total_sister, False),
    }


def conversions_row_payload(
    idx: dict[tuple[str, str, str, str, str, str], list[dict[str, str]]],
    pair: Pair,
    metric_code: str,
    window: str,
) -> dict[str, Any]:
    snapshot_date = latest_snapshot_date(idx, pair, "Website Conversion", metric_code, window)
    current = row_at_snapshot(idx, pair, "Website Conversion", metric_code, window, "current", snapshot_date)
    sister = row_at_snapshot(idx, pair, "Website Conversion", metric_code, window, "sister", snapshot_date)
    prior_year = row_at_snapshot(idx, pair, "Website Conversion", metric_code, window, "prior_year", snapshot_date)
    prev = previous_row_before(idx, pair, "Website Conversion", metric_code, window, "current", snapshot_date)
    current_val = float(current["value"]) if current and current["value"] else None
    sister_val = float(sister["value"]) if sister and sister["value"] else None
    prior_val = float(prior_year["value"]) if prior_year and prior_year["value"] else None
    prev_val = float(prev["value"]) if prev and prev["value"] else None
    return {
        "pilot_value": current_val,
        "pilot_display": fmt_ratio(current_val),
        "sister_value": sister_val,
        "sister_display": fmt_ratio(sister_val),
        "vs_prev_pct": pct_delta(current_val, prev_val),
        "yoy_pct": pct_delta(current_val, prior_val),
        "vs_sister_pct": pct_delta(current_val, sister_val),
    }


def build_legacy_ui_snapshot(
    as_of_date: str,
    meta: dict[str, Any],
    pairs: list[Pair],
    cwv: dict[str, Any],
    traffic: dict[str, Any],
    funnel: dict[str, Any],
    bi_history_rows: list[dict[str, str]],
    available_units: dict[str, int],
) -> dict[str, Any]:
    idx = build_bi_history_index(bi_history_rows)
    cwv_pairs = {pair["identity"]["pair_key"]: pair for pair in cwv["pairs"]}
    traffic_pairs = {pair["identity"]["pair_key"]: pair for pair in traffic["metrics"][0]["pairs"]}
    funnel_pairs: dict[str, dict[str, Any]] = defaultdict(dict)
    for metric in funnel["metrics"]:
        for pair in metric["pairs"]:
            funnel_pairs[pair["identity"]["pair_key"]][metric["metric_key"]] = pair

    # Legacy tracker rows must mirror the inherited BI acronyms exactly.
    metric_map = [
        ("PQ/GC", "PQ/GC"),
        ("V/GC", "Visits/GC"),
        ("A/GC", "Completed Apps/GC"),
        ("C2C/GC", "C2C/GC"),
        ("CFrm/GC", "Contact Form/GC"),
        ("L/GC", "Leases/GC"),
        ("M/GC", "MI/GC"),
    ]

    pair_payloads = []
    for pair in pairs:
        key = pair.pair_key
        pair_cwv = cwv_pairs[key]
        pair_traffic = traffic_pairs.get(key)
        total_units = {
            pair.pilot_name: UNIT_COUNTS.get(pair.pilot_name, 0),
            pair.sister_name: UNIT_COUNTS.get(pair.sister_name, 0),
        }
        all_sections = [
            metric_card_payload(idx, pair, "Total", "GC/AU", "Yesterday", "ratio", available_units, total_units, "Yesterday's Total Guest Cards per Available Unit"),
            metric_card_payload(idx, pair, "Total", "GC/AU", "T7D_DAILY_AVG", "ratio", available_units, total_units, "T7 Total Guest Cards per Available Unit"),
            metric_card_payload(idx, pair, "Total", "GC/AU", "T30D_DAILY_AVG", "ratio", available_units, total_units, "T30 Total Guest Cards per Available Unit"),
        ]
        website_sections = [
            metric_card_payload(idx, pair, "Website Conversion", "GC/AU", "Yesterday", "ratio", available_units, total_units, "Yesterday's Website Guest Cards per Available Unit"),
            metric_card_payload(idx, pair, "Website Conversion", "GC/AU", "T7D_DAILY_AVG", "ratio", available_units, total_units, "T7 Website Guest Cards per Available Unit"),
            metric_card_payload(idx, pair, "Website Conversion", "GC/AU", "T30D_DAILY_AVG", "ratio", available_units, total_units, "T30 Website Guest Cards per Available Unit"),
        ]
        all_trend = []
        for window in ["T30D_DAILY_AVG", "T60D_DAILY_AVG", "T90D_DAILY_AVG"]:
            series = extract_bi_series(idx, pair, "Total", "GC/AU", window)
            current_gap = (series[-1]["pilot_value"] - series[-1]["sister_value"]) if series else None
            previous_gap = (series[0]["pilot_value"] - series[0]["sister_value"]) if len(series) > 1 else None
            all_trend.append(
                {
                    "label": window.replace("_DAILY_AVG", ""),
                    "pilot_current": series[-1]["pilot_value"] if series else None,
                    "sister_current": series[-1]["sister_value"] if series else None,
                    "series": series,
                    "status_label": status_label_from_gap(current_gap, previous_gap),
                    "gap_pct": pct_delta(series[-1]["pilot_value"], series[-1]["sister_value"]) if series else None,
                }
            )
        website_trend = []
        for window in ["T30D_DAILY_AVG", "T60D_DAILY_AVG", "T90D_DAILY_AVG"]:
            series = extract_bi_series(idx, pair, "Website Conversion", "GC/AU", window)
            current_gap = (series[-1]["pilot_value"] - series[-1]["sister_value"]) if series else None
            previous_gap = (series[0]["pilot_value"] - series[0]["sister_value"]) if len(series) > 1 else None
            website_trend.append(
                {
                    "label": window.replace("_DAILY_AVG", ""),
                    "pilot_current": series[-1]["pilot_value"] if series else None,
                    "sister_current": series[-1]["sister_value"] if series else None,
                    "series": series,
                    "status_label": status_label_from_gap(current_gap, previous_gap),
                    "gap_pct": pct_delta(series[-1]["pilot_value"], series[-1]["sister_value"]) if series else None,
                }
            )
        conversion_trend = []
        for code, label in metric_map:
            series = extract_bi_series(idx, pair, "Website Conversion", code, "T30D")
            current_gap = (series[-1]["pilot_value"] - series[-1]["sister_value"]) if series else None
            previous_gap = (series[0]["pilot_value"] - series[0]["sister_value"]) if len(series) > 1 else None
            conversion_trend.append(
                {
                    "metric": label,
                    "series": series,
                    "pilot_current": series[-1]["pilot_value"] if series else None,
                    "sister_current": series[-1]["sister_value"] if series else None,
                    "status_label": status_label_from_gap(current_gap, previous_gap),
                }
            )
        conversion_sections = []
        for window, title in [("Yesterday", "Yesterday's Conversions"), ("T7D", "T7 Conversions"), ("T30D", "T30 Conversions")]:
            rows = []
            for code, label in metric_map:
                rows.append({"metric": label, **conversions_row_payload(idx, pair, code, window)})
            conversion_sections.append({"title": title, "rows": rows})
        pair_payloads.append(
            {
                "pair_key": key,
                "pilot": {
                    "name": pair.pilot_name,
                    "total_units": UNIT_COUNTS.get(pair.pilot_name, 0),
                    "available_units": available_units.get(pair.pilot_name, 0),
                },
                "sister": {
                    "name": pair.sister_name,
                    "total_units": UNIT_COUNTS.get(pair.sister_name, 0),
                    "available_units": available_units.get(pair.sister_name, 0),
                },
                "cwv": pair_cwv,
                "traffic": pair_traffic,
                "all_sources": {
                    "trend": all_trend,
                    "sections": all_sections,
                },
                "website_source": {
                    "trend": website_trend,
                    "sections": website_sections,
                },
                "conversions": {
                    "trend": conversion_trend,
                    "sections": conversion_sections,
                },
            }
        )
    return {
        "meta": meta,
        "default_pair_key": "champions_green__axial_buckhead",
        "pairs": pair_payloads,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2))


def main() -> None:
    as_of_date = datetime.now().date().isoformat()
    pairs = load_pairs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ingest_measurement_workbook(conn)
    bi_history_rows = load_bi_history_rows(conn)
    measurement_rows = load_measurement_rows(conn)
    bi_rows = build_bi_series_rows(bi_history_rows, pairs)
    psi_latest = conn.execute("SELECT MAX(metric_date) FROM pilot_control_psi_metrics WHERE strategy='mobile'").fetchone()[0]
    gt_latest = conn.execute("SELECT MAX(metric_date) FROM gtmetrix_metrics").fetchone()[0]
    bi_latest = max((r["snapshot_date"] for r in bi_rows), default="")
    bi_source_file = latest_bi_source_file(bi_history_rows)
    measurement_latest = max((row["snapshot_date"] for row in measurement_rows), default="")
    measurement_source_file = latest_measurement_source_file(measurement_rows)
    heap = latest_heap_status()
    ga4_latest = conn.execute("SELECT MAX(metric_date) FROM ga4_daily_metrics").fetchone()[0]
    meta = {
        "as_of_date": as_of_date,
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "sources": {
            "psi": source_status(psi_latest, as_of_date),
            "gtmetrix": source_status(gt_latest, as_of_date),
            "bi": {
                **source_status(bi_latest, as_of_date),
                "source_file": bi_source_file,
            },
            "heap_measurement": {
                **source_status(
                    measurement_latest or datetime.strptime(heap.latest_date_label + "/2026", "%m/%d/%Y").date().isoformat(),
                    as_of_date,
                    pending_today=not heap.today_present,
                ),
                "source_file": measurement_source_file or str(MEASUREMENT_PATH),
            },
            "ga4": {
                **source_status(ga4_latest, as_of_date),
                "source_file": str(DB_PATH),
            },
        },
        "theme": {
            "pilot": PILOT_COLOR,
            "sister": SISTER_COLOR,
            "baseline": BASELINE_COLOR,
            "floor": FLOOR_COLOR,
        },
    }

    cwv = build_cwv_snapshot(as_of_date, meta, pairs)
    traffic = build_traffic_snapshot(conn, meta, pairs, measurement_rows)
    funnel = build_funnel_snapshot(meta, pairs, bi_rows)
    available_units = load_available_unit_counts(conn, pairs)
    overview = build_overview_snapshot(meta, cwv, traffic, funnel)
    properties = build_properties_snapshot(cwv, traffic, funnel)
    archive = build_archive_snapshot(as_of_date)
    legacy_ui = build_legacy_ui_snapshot(as_of_date, meta, pairs, cwv, traffic, funnel, bi_history_rows, available_units)

    payloads = {
        "overview.json": overview,
        "cwv.json": cwv,
        "traffic.json": traffic,
        "funnel.json": funnel,
        "properties.json": properties,
        "archive.json": archive,
        "legacy_ui.json": legacy_ui,
    }
    written_roots = []
    for output_root in OUTPUT_ROOTS:
        latest_root = output_root / "latest"
        dated_root = output_root / as_of_date
        for name, payload in payloads.items():
            write_json(latest_root / name, payload)
            write_json(dated_root / name, payload)
        written_roots.append(str(latest_root))

    print(f"Wrote dashboard snapshots for {as_of_date} to: {', '.join(written_roots)}")


if __name__ == "__main__":
    main()
