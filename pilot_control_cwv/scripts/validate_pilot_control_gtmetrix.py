#!/usr/bin/env python3
"""
Validate that a complete GTMetrix cohort exists for a target date.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import date
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def active_properties(config: Dict[str, object]) -> List[Dict[str, object]]:
    return [row for row in config.get("cohorts", []) if row.get("active", True) and row.get("property_id")]


def build_validation_summary(config: Dict[str, object], metric_date: str) -> Dict[str, object]:
    entries = active_properties(config)
    expected_entries = [
        {
            "property_id": str(row["property_id"]),
            "display_name": row.get("display_name") or str(row["property_id"]),
            "role": row.get("role"),
        }
        for row in entries
    ]
    expected_ids = {row["property_id"] for row in expected_entries}

    conn = sqlite3.connect(Path(config["db_path"]))
    conn.row_factory = sqlite3.Row
    try:
        found_rows = conn.execute(
            """
            SELECT DISTINCT property_id
            FROM gtmetrix_metrics
            WHERE metric_date = ?
            """,
            (metric_date,),
        ).fetchall()
    finally:
        conn.close()

    found_ids = {str(row["property_id"]) for row in found_rows if row["property_id"]}
    missing_entries = [row for row in expected_entries if row["property_id"] not in found_ids]

    return {
        "date": metric_date,
        "expected": len(expected_entries),
        "found": len(found_ids),
        "missing_count": len(missing_entries),
        "found_property_ids": sorted(found_ids),
        "missing_property_ids": [row["property_id"] for row in missing_entries],
        "missing_properties": missing_entries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate GTMetrix cohort completeness")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--date", default=date.today().isoformat(), help="Metric date to validate")
    parser.add_argument("--json", action="store_true", help="Emit JSON summary to stdout")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    summary = build_validation_summary(config, args.date)

    if args.json:
        json.dump(summary, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print(
            f"GTMetrix validation for {args.date}: "
            f"expected={summary['expected']} found={summary['found']}"
        )
        if summary["missing_property_ids"]:
            missing_names = ", ".join(
                row["display_name"] for row in summary["missing_properties"]
            )
            print(f"Missing properties: {missing_names}")

    if summary["found"] < summary["expected"]:
        raise SystemExit(1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
