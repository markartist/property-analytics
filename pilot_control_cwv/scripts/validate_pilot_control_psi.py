#!/usr/bin/env python3
"""
Validate pilot/control PSI completeness before report generation or send.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"


def load_config(path: Path) -> dict:
    with path.open() as fh:
        return json.load(fh)


def active_entries(config: dict) -> list[dict]:
    return [row for row in config.get("cohorts", []) if row.get("active", True)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate pilot/control PSI completeness")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--date", default=date.today().isoformat(), help="Metric date to validate")
    parser.add_argument(
        "--strategies",
        nargs="+",
        default=["mobile"],
        choices=["mobile", "desktop"],
        help="Strategies that must be present for all active cohort rows",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))
    entries = active_entries(config)
    expected = {(entry["key"], strategy) for entry in entries for strategy in args.strategies}

    conn = sqlite3.connect(config["db_path"])
    rows = conn.execute(
        """
        SELECT cohort_key, strategy
        FROM pilot_control_psi_metrics
        WHERE metric_date = ?
        """,
        (args.date,),
    ).fetchall()
    conn.close()

    found = {(row[0], row[1]) for row in rows}
    missing = sorted(expected - found)

    print(f"Validation date: {args.date}")
    print(f"Expected rows: {len(expected)}")
    print(f"Found rows:    {len(found & expected)}")
    print(f"Missing rows:  {len(missing)}")
    if missing:
        print("Missing detail:")
        for cohort_key, strategy in missing:
            print(f"  - {cohort_key} [{strategy}]")
        return 1

    print("Validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
