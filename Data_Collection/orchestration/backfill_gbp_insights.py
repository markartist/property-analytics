#!/usr/bin/env python3
"""
Backfill Google Business Profile Insights data.

Usage:
  python3 backfill_gbp_insights.py --start 2025-12-07 --end 2026-02-04 --chunk 7
"""

import argparse
from datetime import date, datetime, timedelta

from daily_master_collection import PortfolioDataCollector


def parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date()


def date_range(start, end):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def main():
    parser = argparse.ArgumentParser(description="Backfill GBP Insights data.")
    parser.add_argument("--start", type=str, default="2025-12-07", help="Start date YYYY-MM-DD")
    parser.add_argument("--end", type=str, default=None, help="End date YYYY-MM-DD (default: today-2)")
    parser.add_argument("--chunk", type=int, default=7, help="Days per API chunk")
    args = parser.parse_args()

    start_date = parse_date(args.start)
    if args.end:
        end_date = parse_date(args.end)
    else:
        end_date = date.today() - timedelta(days=2)

    if end_date < start_date:
        raise SystemExit("End date must be >= start date")

    print(f"GBP Insights backfill: {start_date} to {end_date} (chunk={args.chunk} days)")

    collector = PortfolioDataCollector()

    # Chunk the date range
    chunk_start = start_date
    while chunk_start <= end_date:
        chunk_end = min(chunk_start + timedelta(days=args.chunk - 1), end_date)
        print(f"\n=== Backfill chunk: {chunk_start} to {chunk_end} ===")
        collector.collect_gbp_insights(start_date=chunk_start, end_date=chunk_end)
        chunk_start = chunk_end + timedelta(days=1)

    print("\nBackfill complete.")


if __name__ == "__main__":
    main()

