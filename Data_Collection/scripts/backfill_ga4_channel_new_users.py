#!/usr/bin/env python3
"""Backfill GA4 traffic-source rows with exact channel-level users and new users."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from google.analytics.data_v1beta import BetaAnalyticsDataClient, RunReportRequest, DateRange, Metric, Dimension
from google.oauth2 import service_account

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from Data_Collection.db.database_manager import DatabaseManager
from utils.config_manager import Config


REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
DB_PATH = ROOT / "data" / "portfolio_analytics.db"


def load_properties():
    with REGISTRY_PATH.open() as fh:
        data = json.load(fh)
    return [prop for prop in data["properties"] if prop.get("ga4_property_id")]


def fmt_date(date_str: str) -> str:
    return f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill GA4 channel-level total/new users into ga4_traffic_sources")
    parser.add_argument("--start-date", default="2026-01-01", help="Start date inclusive (YYYY-MM-DD)")
    parser.add_argument(
        "--end-date",
        default=(datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
        help="End date inclusive (YYYY-MM-DD)",
    )
    parser.add_argument("--limit", type=int, default=0, help="Optional property limit for testing")
    args = parser.parse_args()

    properties = load_properties()
    if args.limit > 0:
        properties = properties[: args.limit]

    credentials = service_account.Credentials.from_service_account_file(str(Config.get_ga4_credentials_path()))
    ga4_client = BetaAnalyticsDataClient(credentials=credentials)
    db = DatabaseManager(DB_PATH)

    success = 0
    failures = 0

    print(f"Backfilling GA4 channel new users from {args.start_date} to {args.end_date}")
    print(f"Properties: {len(properties)}")

    for i, prop in enumerate(properties, start=1):
        name = prop["name"]
        ga4_id = prop["ga4_property_id"]
        print(f"\n{i}/{len(properties)}. {name} (GA4: {ga4_id})")
        try:
            request = RunReportRequest(
                property=f"properties/{ga4_id}",
                dimensions=[
                    Dimension(name="date"),
                    Dimension(name="sessionDefaultChannelGroup"),
                ],
                date_ranges=[DateRange(start_date=args.start_date, end_date=args.end_date)],
                metrics=[
                    Metric(name="sessions"),
                    Metric(name="totalUsers"),
                    Metric(name="newUsers"),
                    Metric(name="engagedSessions"),
                    Metric(name="conversions"),
                    Metric(name="engagementRate"),
                    Metric(name="bounceRate"),
                ],
            )

            response = ga4_client.run_report(request)
            rows = 0
            for row in response.rows:
                metric_date = fmt_date(row.dimension_values[0].value)
                channel_group = row.dimension_values[1].value
                db.insert_ga4_traffic_source(
                    property_id=ga4_id,
                    metric_date=metric_date,
                    channel_group=channel_group,
                    data={
                        "sessions": int(row.metric_values[0].value),
                        "total_users": int(row.metric_values[1].value),
                        "new_users": int(row.metric_values[2].value),
                        "engaged_sessions": int(row.metric_values[3].value),
                        "conversions": int(row.metric_values[4].value),
                        "engagement_rate": float(row.metric_values[5].value),
                        "bounce_rate": float(row.metric_values[6].value),
                    },
                )
                rows += 1

            print(f"   ✅ Backfilled {rows} channel/day rows")
            success += 1
        except Exception as exc:
            failures += 1
            print(f"   ❌ {str(exc)[:160]}")

    print(f"\nDone. Success={success} Failed={failures}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
