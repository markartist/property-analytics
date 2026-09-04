#!/usr/bin/env python3
"""Backfill Google Business Profile daily and monthly keyword facts.

This is an evidence-first backfill for executive reporting. It uses the
Keeper-backed GBP OAuth path, resolves properties through the governed identity
matrix, writes only to existing Data Pond GBP tables, and saves a run packet
with source-window proof.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from google.auth.transport.requests import AuthorizedSession, Request

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "utils"))

from Data_Collection.collectors.gbp_collector import GoogleBusinessProfileCollector  # noqa: E402
from Data_Collection.db.database_manager import DatabaseManager  # noqa: E402
from utils.config_manager import Config  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
IDENTITY_MATRIX = ROOT / "config" / "property_identity_matrix.json"
OUTPUT_ROOT = ROOT / "reports" / "adhoc_executive" / "andrew_foresi_search_backfill"

DAILY_METRICS = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "WEBSITE_CLICKS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
    "BUSINESS_FOOD_ORDERS",
    "BUSINESS_FOOD_MENU_CLICKS",
]


@dataclass
class PropertyTarget:
    property_code: str
    property_name: str
    ga4_property_id: str
    gbp_location_id: str


@dataclass
class BackfillSummary:
    run_id: str
    start_date: str
    end_date: str
    daily_enabled: bool
    keywords_enabled: bool
    targets: int
    daily_success: int = 0
    daily_failed: int = 0
    daily_rows_written: int = 0
    daily_metric_sum: int = 0
    keyword_success: int = 0
    keyword_failed: int = 0
    keyword_months_checked: int = 0
    keyword_months_with_rows: int = 0
    keyword_rows_written: int = 0
    keyword_impressions: int = 0


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def daterange(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def monthrange(start: date, end: date):
    current = date(start.year, start.month, 1)
    last = date(end.year, end.month, 1)
    while current <= last:
        yield current.year, current.month
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)


def chunk_dates(start: date, end: date, chunk_days: int):
    current = start
    while current <= end:
        chunk_end = min(end, current + timedelta(days=chunk_days - 1))
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)


def load_targets(limit: int | None = None) -> list[PropertyTarget]:
    payload = json.loads(IDENTITY_MATRIX.read_text(encoding="utf-8"))
    items = payload.get("properties", payload if isinstance(payload, list) else [])
    targets: list[PropertyTarget] = []
    for item in items:
        if str(item.get("status", "")).lower() != "active":
            continue
        ga4_property_id = str(item.get("ga4_property_id") or "")
        gbp_location_id = str(item.get("gbp_location_id") or "")
        if not ga4_property_id or not gbp_location_id:
            continue
        targets.append(
            PropertyTarget(
                property_code=str(item.get("property_code") or item.get("canonical_property_id") or ""),
                property_name=str(item.get("property_name") or item.get("community_name") or ga4_property_id),
                ga4_property_id=ga4_property_id,
                gbp_location_id=gbp_location_id,
            )
        )
    targets.sort(key=lambda item: (item.property_name, item.ga4_property_id))
    return targets[:limit] if limit else targets


def blank_daily_metrics() -> dict[str, int]:
    return {
        "maps_views_desktop": 0,
        "maps_views_mobile": 0,
        "search_views_desktop": 0,
        "search_views_mobile": 0,
        "website_clicks": 0,
        "phone_calls": 0,
        "direction_requests": 0,
        "food_orders": 0,
        "food_menu_clicks": 0,
    }


def parse_daily_payload(payload: dict[str, Any], start: date, end: date) -> dict[str, dict[str, int]]:
    metrics_by_date = {day.isoformat(): blank_daily_metrics() for day in daterange(start, end)}
    for group in payload.get("multiDailyMetricTimeSeries", []):
        for series in group.get("dailyMetricTimeSeries", []):
            metric_type = series.get("dailyMetric")
            for dated_value in series.get("timeSeries", {}).get("datedValues", []):
                value = int(dated_value.get("value") or 0)
                date_obj = dated_value.get("date") or {}
                if not date_obj:
                    continue
                metric_date = (
                    f"{int(date_obj.get('year')):04d}-"
                    f"{int(date_obj.get('month')):02d}-"
                    f"{int(date_obj.get('day')):02d}"
                )
                metrics = metrics_by_date.setdefault(metric_date, blank_daily_metrics())
                if metric_type == "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
                    metrics["maps_views_desktop"] += value
                elif metric_type == "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
                    metrics["maps_views_mobile"] += value
                elif metric_type == "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
                    metrics["search_views_desktop"] += value
                elif metric_type == "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
                    metrics["search_views_mobile"] += value
                elif metric_type == "WEBSITE_CLICKS":
                    metrics["website_clicks"] += value
                elif metric_type == "CALL_CLICKS":
                    metrics["phone_calls"] += value
                elif metric_type == "BUSINESS_DIRECTION_REQUESTS":
                    metrics["direction_requests"] += value
                elif metric_type == "BUSINESS_FOOD_ORDERS":
                    metrics["food_orders"] += value
                elif metric_type == "BUSINESS_FOOD_MENU_CLICKS":
                    metrics["food_menu_clicks"] += value
    return metrics_by_date


def fetch_daily(session: AuthorizedSession, target: PropertyTarget, start: date, end: date) -> dict[str, dict[str, int]]:
    params: list[tuple[str, object]] = [("dailyMetrics", metric) for metric in DAILY_METRICS]
    params.extend(
        [
            ("dailyRange.startDate.year", start.year),
            ("dailyRange.startDate.month", start.month),
            ("dailyRange.startDate.day", start.day),
            ("dailyRange.endDate.year", end.year),
            ("dailyRange.endDate.month", end.month),
            ("dailyRange.endDate.day", end.day),
        ]
    )
    url = (
        "https://businessprofileperformance.googleapis.com/v1/"
        f"locations/{target.gbp_location_id}:fetchMultiDailyMetricsTimeSeries"
    )
    response = session.get(url, params=params, timeout=60)
    payload = response.json() if response.content else {}
    if response.status_code != 200:
        message = payload.get("error", {}).get("message") or f"HTTP {response.status_code}"
        raise RuntimeError(message[:400])
    return parse_daily_payload(payload, start, end)


def fetch_monthly_keywords(
    session: AuthorizedSession,
    target: PropertyTarget,
    year: int,
    month: int,
    *,
    max_retries: int,
    retry_sleep: float,
) -> list[dict[str, Any]]:
    keywords: list[dict[str, Any]] = []
    page_token: str | None = None
    url = (
        "https://businessprofileperformance.googleapis.com/v1/"
        f"locations/{target.gbp_location_id}/searchkeywords/impressions/monthly"
    )
    while True:
        params: list[tuple[str, object]] = [
            ("monthlyRange.startMonth.year", year),
            ("monthlyRange.startMonth.month", month),
            ("monthlyRange.endMonth.year", year),
            ("monthlyRange.endMonth.month", month),
            ("pageSize", 100),
        ]
        if page_token:
            params.append(("pageToken", page_token))
        for attempt in range(max_retries + 1):
            response = session.get(url, params=params, timeout=60)
            payload = response.json() if response.content else {}
            if response.status_code == 429 and attempt < max_retries:
                time.sleep(retry_sleep)
                continue
            if response.status_code != 200:
                message = payload.get("error", {}).get("message") or f"HTTP {response.status_code}"
                raise RuntimeError(message[:400])
            break
        else:
            raise RuntimeError("GBP keyword request exhausted retries")

        for item in payload.get("searchKeywordsCounts", []):
            keyword = str(item.get("searchKeyword") or "").strip()
            if not keyword:
                continue
            value = int(item.get("insightsValue", {}).get("value") or 0)
            keywords.append({"keyword": keyword, "impressions": value})
        page_token = payload.get("nextPageToken")
        if not page_token:
            return keywords


def upsert_daily_rows(conn: sqlite3.Connection, target: PropertyTarget, collection_id: int, rows: dict[str, dict[str, int]]) -> tuple[int, int]:
    written = 0
    metric_sum = 0
    for metric_date, metrics in sorted(rows.items()):
        total_views = (
            metrics["maps_views_desktop"]
            + metrics["maps_views_mobile"]
            + metrics["search_views_desktop"]
            + metrics["search_views_mobile"]
        )
        total_actions = metrics["website_clicks"] + metrics["phone_calls"] + metrics["direction_requests"]
        action_rate = (total_actions / total_views) if total_views else 0
        metric_sum += total_views + total_actions + metrics["food_orders"] + metrics["food_menu_clicks"]
        conn.execute(
            """
            INSERT OR REPLACE INTO gbp_daily_insights (
                property_id, gbp_location_id, account_id, metric_date,
                maps_views_desktop, maps_views_mobile,
                search_views_desktop, search_views_mobile, total_profile_views,
                website_clicks, phone_calls, direction_requests, total_actions, action_rate,
                food_orders, food_menu_clicks, collection_id, collected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                target.ga4_property_id,
                target.gbp_location_id,
                None,
                metric_date,
                metrics["maps_views_desktop"],
                metrics["maps_views_mobile"],
                metrics["search_views_desktop"],
                metrics["search_views_mobile"],
                total_views,
                metrics["website_clicks"],
                metrics["phone_calls"],
                metrics["direction_requests"],
                total_actions,
                action_rate,
                metrics["food_orders"],
                metrics["food_menu_clicks"],
                collection_id,
            ),
        )
        conn.execute(
            """
            INSERT INTO gbp_daily_metrics (
                property_id, gbp_location_id, metric_date, collection_id,
                business_impressions_desktop_maps, business_impressions_desktop_search,
                business_impressions_mobile_maps, business_impressions_mobile_search,
                business_direction_requests, call_clicks, website_clicks,
                business_food_orders, business_food_menu_clicks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(property_id, metric_date) DO UPDATE SET
                gbp_location_id = excluded.gbp_location_id,
                collection_id = excluded.collection_id,
                business_impressions_desktop_maps = excluded.business_impressions_desktop_maps,
                business_impressions_desktop_search = excluded.business_impressions_desktop_search,
                business_impressions_mobile_maps = excluded.business_impressions_mobile_maps,
                business_impressions_mobile_search = excluded.business_impressions_mobile_search,
                business_direction_requests = excluded.business_direction_requests,
                call_clicks = excluded.call_clicks,
                website_clicks = excluded.website_clicks,
                business_food_orders = excluded.business_food_orders,
                business_food_menu_clicks = excluded.business_food_menu_clicks,
                collected_at = CURRENT_TIMESTAMP
            """,
            (
                target.ga4_property_id,
                target.gbp_location_id,
                metric_date,
                collection_id,
                metrics["maps_views_desktop"],
                metrics["search_views_desktop"],
                metrics["maps_views_mobile"],
                metrics["search_views_mobile"],
                metrics["direction_requests"],
                metrics["phone_calls"],
                metrics["website_clicks"],
                metrics["food_orders"],
                metrics["food_menu_clicks"],
            ),
        )
        written += 1
    return written, metric_sum


def upsert_keywords(conn: sqlite3.Connection, target: PropertyTarget, collection_id: int, year: int, month: int, keywords: list[dict[str, Any]]) -> tuple[int, int]:
    conn.execute(
        "DELETE FROM gbp_search_keywords WHERE property_id = ? AND year = ? AND month = ?",
        (target.ga4_property_id, year, month),
    )
    written = 0
    impressions = 0
    for item in keywords:
        keyword = str(item.get("keyword") or "").strip()
        if not keyword:
            continue
        value = int(item.get("impressions") or 0)
        impressions += value
        conn.execute(
            """
            INSERT INTO gbp_search_keywords (
                property_id, gbp_location_id, year, month, keyword, impressions, collection_id, collected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(property_id, year, month, keyword) DO UPDATE SET
                gbp_location_id = excluded.gbp_location_id,
                impressions = excluded.impressions,
                collection_id = excluded.collection_id,
                collected_at = CURRENT_TIMESTAMP
            """,
            (target.ga4_property_id, target.gbp_location_id, year, month, keyword, value, collection_id),
        )
        written += 1
    return written, impressions


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill portfolio Google Business Profile facts.")
    parser.add_argument("--start-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--chunk-days", type=int, default=92)
    parser.add_argument("--sleep", type=float, default=0.1)
    parser.add_argument("--retry-sleep", type=float, default=65.0)
    parser.add_argument("--max-retries", type=int, default=2)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--daily", action="store_true", help="Backfill daily GBP insight metrics.")
    parser.add_argument("--keywords", action="store_true", help="Backfill monthly GBP search keywords.")
    args = parser.parse_args()

    if not args.daily and not args.keywords:
        args.daily = True
        args.keywords = True

    start = parse_date(args.start_date)
    end = parse_date(args.end_date)
    if end < start:
        raise SystemExit("--end-date must be on or after --start-date")
    if args.chunk_days < 1:
        raise SystemExit("--chunk-days must be positive")

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S_gbp")
    output_dir = OUTPUT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    targets = load_targets(args.limit)
    summary = BackfillSummary(
        run_id=run_id,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        daily_enabled=bool(args.daily),
        keywords_enabled=bool(args.keywords),
        targets=len(targets),
    )
    details: list[dict[str, Any]] = []

    collector = GoogleBusinessProfileCollector(
        Config.get_gbp_credentials_path(),
        Config.get_gbp_token_path(),
        allow_interactive_auth=False,
    )
    creds = collector.creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        collector.save_credentials(Config.get_gbp_token_path(), creds)
    session = AuthorizedSession(creds)

    db = DatabaseManager(DB_PATH)
    daily_collection_id = None
    keyword_collection_id = None
    if args.daily:
        daily_collection_id = db.start_data_collection(date.today(), "backfill", "gbp_insights")
    if args.keywords:
        keyword_collection_id = db.start_data_collection(date.today(), "backfill", "gbp_search_keywords")

    with sqlite3.connect(DB_PATH, timeout=120) as conn:
        for index, target in enumerate(targets, start=1):
            target_detail: dict[str, Any] = {
                "property_code": target.property_code,
                "property_name": target.property_name,
                "ga4_property_id": target.ga4_property_id,
                "daily": {"status": "not_requested"},
                "keywords": {"status": "not_requested"},
            }
            print(f"{index}/{len(targets)} {target.property_code} {target.property_name}")
            if args.daily and daily_collection_id is not None:
                try:
                    prop_rows = 0
                    prop_metric_sum = 0
                    for chunk_start, chunk_end in chunk_dates(start, end, args.chunk_days):
                        rows = fetch_daily(session, target, chunk_start, chunk_end)
                        rows_written, metric_sum = upsert_daily_rows(conn, target, daily_collection_id, rows)
                        prop_rows += rows_written
                        prop_metric_sum += metric_sum
                        conn.commit()
                        time.sleep(args.sleep)
                    summary.daily_success += 1
                    summary.daily_rows_written += prop_rows
                    summary.daily_metric_sum += prop_metric_sum
                    target_detail["daily"] = {
                        "status": "success",
                        "rows_written": prop_rows,
                        "metric_sum": prop_metric_sum,
                    }
                except Exception as exc:
                    summary.daily_failed += 1
                    target_detail["daily"] = {"status": "failed", "error": str(exc)[:400]}
                    conn.rollback()
            if args.keywords and keyword_collection_id is not None:
                try:
                    prop_months = 0
                    prop_months_with_rows = 0
                    prop_rows = 0
                    prop_impressions = 0
                    for year, month in monthrange(start, end):
                        keywords = fetch_monthly_keywords(
                            session,
                            target,
                            year,
                            month,
                            max_retries=args.max_retries,
                            retry_sleep=args.retry_sleep,
                        )
                        rows_written, impressions = upsert_keywords(
                            conn,
                            target,
                            keyword_collection_id,
                            year,
                            month,
                            keywords,
                        )
                        conn.commit()
                        prop_months += 1
                        prop_rows += rows_written
                        prop_impressions += impressions
                        if rows_written:
                            prop_months_with_rows += 1
                        time.sleep(args.sleep)
                    summary.keyword_success += 1
                    summary.keyword_months_checked += prop_months
                    summary.keyword_months_with_rows += prop_months_with_rows
                    summary.keyword_rows_written += prop_rows
                    summary.keyword_impressions += prop_impressions
                    target_detail["keywords"] = {
                        "status": "success",
                        "months_checked": prop_months,
                        "months_with_rows": prop_months_with_rows,
                        "rows_written": prop_rows,
                        "impressions": prop_impressions,
                    }
                except Exception as exc:
                    summary.keyword_failed += 1
                    target_detail["keywords"] = {"status": "failed", "error": str(exc)[:400]}
                    conn.rollback()
            details.append(target_detail)

    if daily_collection_id is not None:
        db.complete_data_collection(
            daily_collection_id,
            properties_collected=summary.daily_success,
            properties_failed=summary.daily_failed,
            properties_total=len(targets),
            properties_success=summary.daily_success,
            status="partial" if summary.daily_failed else "completed",
            notes=f"GBP daily backfill {start.isoformat()} through {end.isoformat()}",
        )
    if keyword_collection_id is not None:
        db.complete_data_collection(
            keyword_collection_id,
            properties_collected=summary.keyword_success,
            properties_failed=summary.keyword_failed,
            properties_total=len(targets),
            properties_success=summary.keyword_success,
            status="partial" if summary.keyword_failed else "completed",
            notes=f"GBP monthly keyword backfill {start.isoformat()} through {end.isoformat()}",
        )

    payload = {"summary": asdict(summary), "details": details}
    (output_dir / "gbp_backfill_summary.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"run_dir": str(output_dir), "summary": asdict(summary)}, indent=2, ensure_ascii=True))
    return 1 if summary.daily_failed or summary.keyword_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
