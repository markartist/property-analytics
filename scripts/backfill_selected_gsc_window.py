#!/usr/bin/env python3
"""
Safely backfill canonical GSC daily metrics for a selected property set and date window.

This script is intentionally narrow:
- uses the canonical property registry
- uses the canonical master DB via Data_Collection DatabaseManager
- writes only GSC daily metrics through the canonical insert path
- defaults to the five-property SEO YoY repair set
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/mark/Property_Analytics")
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"

import sys

sys.path.insert(0, str(ROOT))
from Data_Collection.collectors.gsc_collector import GoogleSearchConsoleCollector  # noqa: E402
from Data_Collection.db.database_manager import DatabaseManager  # noqa: E402


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


@dataclass(frozen=True)
class SelectedProperty:
    request_name: str
    canonical_name: str
    gsc_url: str
    ga4_property_id: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill canonical GSC daily metrics for a selected window.")
    parser.add_argument("--start-date", required=True, help="Window start date in YYYY-MM-DD")
    parser.add_argument("--end-date", required=True, help="Window end date in YYYY-MM-DD")
    parser.add_argument("--properties", help="Comma-separated requested property names.")
    parser.add_argument("--dry-run", action="store_true", help="Query GSC but do not write to the database.")
    return parser.parse_args()


def load_selected_properties(request_names: list[str]) -> list[SelectedProperty]:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    by_name = {item.get("name") or item.get("property_name"): item for item in registry["properties"]}
    selected: list[SelectedProperty] = []

    for request_name in request_names:
        canonical_name = REQUEST_ALIAS_TO_CANONICAL.get(request_name, request_name)
        record = by_name.get(canonical_name)
        if not record:
            raise RuntimeError(f"Property not found in registry: request={request_name!r} canonical={canonical_name!r}")
        gsc_url = record.get("gsc_url")
        ga4_property_id = record.get("ga4_property_id")
        if not gsc_url or not ga4_property_id:
            raise RuntimeError(f"Registry record missing gsc_url or ga4_property_id for {canonical_name}")
        selected.append(
            SelectedProperty(
                request_name=request_name,
                canonical_name=canonical_name,
                gsc_url=gsc_url,
                ga4_property_id=str(ga4_property_id),
            )
        )

    return selected


def validate_dates(start_date: str, end_date: str) -> tuple[str, str]:
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    if start_dt > end_dt:
        raise RuntimeError(f"start-date {start_date} is after end-date {end_date}")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def main() -> int:
    args = parse_args()
    start_date, end_date = validate_dates(args.start_date, args.end_date)
    request_names = (
        [item.strip() for item in args.properties.split(",") if item.strip()]
        if args.properties
        else DEFAULT_REQUESTS
    )
    selected_properties = load_selected_properties(request_names)

    collector = GoogleSearchConsoleCollector()
    if not collector.service:
        raise RuntimeError("Google Search Console service could not be initialized.")

    db: Optional[DatabaseManager] = None if args.dry_run else DatabaseManager()

    print(f"Window: {start_date} -> {end_date}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'WRITE'}")
    print(f"Properties: {len(selected_properties)}")
    print("=" * 80)

    total_rows = 0
    for idx, prop in enumerate(selected_properties, start=1):
        print(f"{idx}/{len(selected_properties)} {prop.request_name}")
        print(f"   Canonical: {prop.canonical_name}")
        print(f"   GSC URL: {prop.gsc_url}")
        response = collector.service.searchanalytics().query(
            siteUrl=prop.gsc_url,
            body={
                "startDate": start_date,
                "endDate": end_date,
                "dimensions": ["date"],
            },
        ).execute()
        rows = response.get("rows", [])
        print(f"   Returned rows: {len(rows)}")

        if rows and db is not None:
            for row in rows:
                metric_date = row.get("keys", [""])[0]
                db.insert_gsc_daily_metrics(
                    property_id=prop.gsc_url,
                    metric_date=metric_date,
                    data={
                        "clicks": row.get("clicks", 0),
                        "impressions": row.get("impressions", 0),
                        "ctr": row.get("ctr", 0) * 100,
                        "position": row.get("position", 0),
                    },
                )
        total_rows += len(rows)

    print("=" * 80)
    print(f"Total rows returned: {total_rows}")
    print("Completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
