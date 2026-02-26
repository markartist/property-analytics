#!/usr/bin/env python3
"""
Collect GSC URL Inspection data for indexation/coverage reporting.

Usage:
  python3 collect_gsc_url_inspection.py
  python3 collect_gsc_url_inspection.py --property "Elation at Grandway West" --max-urls 25
"""

import argparse

from daily_master_collection import PortfolioDataCollector


def main():
    parser = argparse.ArgumentParser(description="Collect GSC URL Inspection data")
    parser.add_argument("--property", help="Exact property name filter")
    parser.add_argument("--max-urls", type=int, default=10, help="Max URLs to inspect per property")
    parser.add_argument("--test", action="store_true", help="Use test mode (first 3 properties)")
    args = parser.parse_args()

    collector = PortfolioDataCollector(test_mode=args.test, quick_mode=True)
    collector.initialize_collectors()
    properties = collector.load_properties()

    if args.property:
        properties = [p for p in properties if p.get("name", "").lower() == args.property.lower()]
        if not properties:
            raise SystemExit(f"Property not found: {args.property}")

    collector.collect_gsc_url_inspection_data(properties, max_urls_per_property=args.max_urls)


if __name__ == "__main__":
    main()

