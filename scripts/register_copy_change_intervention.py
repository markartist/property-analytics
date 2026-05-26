#!/usr/bin/env python3
"""Register a property website copy-change intervention in the local Data Pond."""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"

import sys

sys.path.insert(0, str(ROOT / "Data_Collection" / "utils"))
from copy_change_monitoring import ensure_copy_change_schema, upsert_intervention, upsert_wave  # noqa: E402


def parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def load_json_file(path: str | None) -> dict:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Register a copy-change wave/intervention.")
    parser.add_argument("--wave-id", required=True, help="Stable id, for example copy_wave_2026_05_18.")
    parser.add_argument("--wave-name", required=True, help="Human-readable wave name.")
    parser.add_argument("--change-date", required=True, help="Date the wave is being changed, YYYY-MM-DD.")
    parser.add_argument("--property", required=True, help="Property name, code, GA4 id, or URL resolved through the identity matrix.")
    parser.add_argument("--publish-timestamp", required=True, help="Timestamp when the change went or will go live.")
    parser.add_argument("--page-url", help="Changed page URL. Defaults to governed property website URL.")
    parser.add_argument("--first-full-post-day", help="First full post-change date. Defaults to the day after publish timestamp.")
    parser.add_argument("--page-type", default="property_homepage")
    parser.add_argument("--change-type", default="copy_refresh")
    parser.add_argument("--changed-fields", help="Comma-separated fields, for example title,meta,h1,hero,romance,faq.")
    parser.add_argument("--target-queries", help="Comma-separated target query/intents.")
    parser.add_argument("--old-content-json", help="Optional path to JSON with old title/meta/copy fields.")
    parser.add_argument("--new-content-json", help="Optional path to JSON with new title/meta/copy fields.")
    parser.add_argument("--hypothesis", help="Plain-English expected impact.")
    parser.add_argument("--owner", default="MarketingOps")
    parser.add_argument("--confounds-json", help="Optional path to JSON describing pricing/specials/ads/technical confounds.")
    parser.add_argument("--status", default="active", choices=["active", "monitoring", "paused", "complete", "archived"])
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    change_date = date.fromisoformat(args.change_date)
    first_full = args.first_full_post_day or (change_date + timedelta(days=1)).isoformat()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        ensure_copy_change_schema(conn)
        upsert_wave(
            conn,
            wave_id=args.wave_id,
            wave_name=args.wave_name,
            change_date=args.change_date,
            default_first_full_post_day=first_full,
            status="active" if args.status in {"active", "monitoring"} else args.status,
            owner=args.owner,
        )
        intervention_id = upsert_intervention(
            conn,
            wave_id=args.wave_id,
            property_name_or_id=args.property,
            publish_timestamp=args.publish_timestamp,
            page_url=args.page_url,
            first_full_post_day=args.first_full_post_day,
            page_type=args.page_type,
            change_type=args.change_type,
            changed_fields=parse_csv(args.changed_fields),
            target_queries=parse_csv(args.target_queries),
            old_content=load_json_file(args.old_content_json),
            new_content=load_json_file(args.new_content_json),
            hypothesis=args.hypothesis,
            owner=args.owner,
            status=args.status,
            confounds=load_json_file(args.confounds_json),
            source_system="manual_copy_change_registration",
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Registered copy-change intervention: {intervention_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
