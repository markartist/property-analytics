#!/usr/bin/env python3
"""
Backfill web-critical data sources (GA4 + GSC) for a specified window.

Usage:
  python3 backfill_web_critical.py --days 60
  python3 backfill_web_critical.py --start 2025-12-07 --end 2026-02-04
"""

import argparse
from datetime import datetime, timedelta

from daily_master_collection import PortfolioDataCollector


def parse_date(value):
    return datetime.strptime(value, "%Y-%m-%d")


def main():
    parser = argparse.ArgumentParser(description="Backfill web-critical sources (GA4 + GSC)")
    parser.add_argument("--days", type=int, default=60, help="Number of days to backfill")
    parser.add_argument("--start", type=str, default=None, help="Start date YYYY-MM-DD")
    parser.add_argument("--end", type=str, default=None, help="End date YYYY-MM-DD")
    parser.add_argument("--fast", action="store_true", help="Skip GA4 traffic/device breakdowns for faster backfill")
    args = parser.parse_args()

    if args.start or args.end:
        if not (args.start and args.end):
            raise SystemExit("Both --start and --end are required when specifying dates.")
        start_date = parse_date(args.start)
        end_date = parse_date(args.end)
    else:
        # Defaults: GA4 through yesterday, GSC through 3 days ago
        end_date = datetime.now() - timedelta(days=1)
        start_date = end_date - timedelta(days=args.days - 1)

    if end_date < start_date:
        raise SystemExit("End date must be >= start date")

    print(f"Web-critical backfill window: {start_date:%Y-%m-%d} to {end_date:%Y-%m-%d}")

    collector = PortfolioDataCollector()
    collector.initialize_collectors()
    properties = collector.load_properties()

    # GA4 backfill (full window)
    collector.collect_ga4_data(properties, start_date=start_date, end_date=end_date, include_details=(not args.fast))

    # GSC backfill uses 3-day lag; adjust end if necessary
    gsc_end = min(end_date, datetime.now() - timedelta(days=3))
    gsc_start = start_date
    if gsc_end < gsc_start:
        print("GSC backfill skipped: window is within delay period.")
    else:
        collector.collect_gsc_data(properties, start_date=gsc_start, end_date=gsc_end)


if __name__ == "__main__":
    main()
