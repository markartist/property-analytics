#!/usr/bin/env python3
"""
Export pilot/control GTMetrix daily scores to simple CSVs.

Each row includes:
- Today from the requested GTMetrix cohort date
- Yesterday from the previous available row before that date
- Rolling T7 from the latest 7 available rows through that date
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def active_properties(config: Dict[str, object]) -> List[Dict[str, object]]:
    return [row for row in config.get("cohorts", []) if row.get("active", True) and row.get("property_id")]


def latest_complete_date(conn: sqlite3.Connection, expected_count: int) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM gtmetrix_metrics
        GROUP BY metric_date
        HAVING COUNT(DISTINCT property_id) >= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (expected_count,),
    ).fetchone()
    return row[0] if row else None


def count_rows_for_date(conn: sqlite3.Connection, metric_date: str, property_ids: List[str]) -> int:
    placeholders = ",".join("?" for _ in property_ids)
    row = conn.execute(
        f"""
        SELECT COUNT(DISTINCT property_id)
        FROM gtmetrix_metrics
        WHERE metric_date = ?
          AND property_id IN ({placeholders})
        """,
        [metric_date, *property_ids],
    ).fetchone()
    return int(row[0] or 0) if row else 0


def get_previous_gt_score(conn: sqlite3.Connection, property_id: str, before_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT pagespeed_score
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date < ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, before_date),
    ).fetchone()
    return float(row["pagespeed_score"]) if row and row["pagespeed_score"] is not None else None


def get_t7_gt_score(conn: sqlite3.Connection, property_id: str, through_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT AVG(pagespeed_score) AS avg_score
        FROM (
            SELECT pagespeed_score
            FROM gtmetrix_metrics
            WHERE property_id = ?
              AND metric_date <= ?
            ORDER BY metric_date DESC
            LIMIT 7
        )
        """,
        (property_id, through_date),
    ).fetchone()
    return float(row["avg_score"]) if row and row["avg_score"] is not None else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Export GTMetrix daily scores")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--output-dir", default=str(Path.home() / "Downloads"), help="Directory for CSV output")
    parser.add_argument("--date", help="Specific metric date to export (YYYY-MM-DD). Defaults to today.")
    parser.add_argument(
        "--allow-latest-complete",
        action="store_true",
        help="Allow fallback to the latest complete cohort if the requested date is incomplete.",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))
    entries = active_properties(config)
    conn = sqlite3.connect(Path(config["db_path"]))
    conn.row_factory = sqlite3.Row

    property_ids = [str(entry["property_id"]) for entry in entries]
    expected_count = len(property_ids)
    metric_date = args.date or date.today().isoformat()
    actual_count = count_rows_for_date(conn, metric_date, property_ids)
    if actual_count < expected_count:
        if args.allow_latest_complete:
            metric_date = latest_complete_date(conn, expected_count)
            if not metric_date:
                raise SystemExit("No complete GTMetrix cohort found")
        else:
            raise SystemExit(
                f"Requested GTMetrix date {metric_date} is incomplete: expected={expected_count} found={actual_count}"
            )

    placeholders = ",".join("?" for _ in property_ids)
    rows = conn.execute(
        f"""
        SELECT property_id, pagespeed_score
        FROM gtmetrix_metrics
        WHERE metric_date = ?
          AND property_id IN ({placeholders})
        """,
        [metric_date, *property_ids],
    ).fetchall()
    scores = {row["property_id"]: row["pagespeed_score"] for row in rows}
    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    dated_path = output_dir / f"GTMetrix_Daily_Scores_{metric_date}.csv"
    latest_path = output_dir / "GTMetrix_Daily_Scores_latest.csv"

    lines = ["Property Name,Yesterday GTMetrix,Today GTMetrix,Rolling T7 GTMetrix"]
    for entry in entries:
        property_id = str(entry["property_id"])
        score = scores.get(property_id)
        yesterday_score = get_previous_gt_score(conn, property_id, metric_date)
        t7_score = get_t7_gt_score(conn, property_id, metric_date)
        lines.append(
            ",".join(
                [
                    entry["display_name"],
                    "" if yesterday_score is None else f"{yesterday_score:.1f}",
                    "" if score is None else f"{score:.1f}",
                    "" if t7_score is None else f"{t7_score:.1f}",
                ]
            )
        )
    content = "\n".join(lines) + "\n"
    conn.close()

    dated_path.write_text(content, encoding="utf-8")
    latest_path.write_text(content, encoding="utf-8")

    print(f"Saved dated CSV:  {dated_path}")
    print(f"Saved latest CSV: {latest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
