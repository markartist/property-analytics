#!/usr/bin/env python3
"""
Export simple PSI scores for pilot and control properties using one canonical
source: the dedicated pilot/control PSI table.

For both pilots and controls:
- Today comes from the latest complete pilot_control_psi_metrics mobile cohort
- Yesterday comes from the previous available row before that cohort date
- Rolling T7 comes from the latest 7 available rows through that cohort date
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def active_properties(config: Dict[str, object]) -> List[Dict[str, object]]:
    return [row for row in config.get("cohorts", []) if row.get("active", True) and row.get("property_id")]


def latest_complete_psi_date(conn: sqlite3.Connection, expected_count: int) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM pilot_control_psi_metrics
        WHERE strategy = 'mobile'
        GROUP BY metric_date
        HAVING COUNT(DISTINCT cohort_key) >= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (expected_count,),
    ).fetchone()
    return row[0] if row else None


def get_psi_for_date(conn: sqlite3.Connection, cohort_key: str, metric_date: str) -> tuple[Optional[str], Optional[float]]:
    row = conn.execute(
        """
        SELECT metric_date, performance_score
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        LIMIT 1
        """,
        (cohort_key, metric_date),
    ).fetchone()
    if not row:
        return None, None
    return row[0], (float(row[1]) if row[1] is not None else None)


def get_previous_dedicated_psi(conn: sqlite3.Connection, cohort_key: str, before_date: str) -> tuple[Optional[str], Optional[float]]:
    row = conn.execute(
        """
        SELECT metric_date, performance_score
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date < ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (cohort_key, before_date),
    ).fetchone()
    if not row:
        return None, None
    return row[0], (float(row[1]) if row[1] is not None else None)


def get_t7_dedicated_psi(conn: sqlite3.Connection, cohort_key: str, through_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT AVG(performance_score)
        FROM (
            SELECT performance_score
            FROM pilot_control_psi_metrics
            WHERE cohort_key = ?
              AND strategy = 'mobile'
              AND metric_date <= ?
            ORDER BY metric_date DESC
            LIMIT 7
        )
        """,
        (cohort_key, through_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Export simple day-over-day PSI scores")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--output-dir", default=str(Path.home() / "Downloads"), help="Directory for CSV output")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    entries = active_properties(config)

    conn = sqlite3.connect(Path(config["db_path"]))
    metric_date = latest_complete_psi_date(conn, len(entries))
    if not metric_date:
        raise SystemExit("No complete PSI cohort found")

    lines = ["Property Name,Yesterday PSI,Today PSI,Rolling T7 PSI"]
    for entry in entries:
        _today_date, today_score = get_psi_for_date(conn, entry["key"], metric_date)
        _previous_date, yesterday_score = get_previous_dedicated_psi(conn, entry["key"], metric_date)
        t7_score = get_t7_dedicated_psi(conn, entry["key"], metric_date)

        lines.append(
            ",".join(
                [
                    entry["display_name"],
                    "" if yesterday_score is None else f"{yesterday_score:.1f}",
                    "" if today_score is None else f"{today_score:.1f}",
                    "" if t7_score is None else f"{t7_score:.1f}",
                ]
            )
        )

    conn.close()

    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    dated_path = output_dir / f"PSI_Day_Over_Day_Scores_{metric_date}.csv"
    latest_path = output_dir / "PSI_Day_Over_Day_Scores_latest.csv"
    content = "\n".join(lines) + "\n"
    dated_path.write_text(content, encoding="utf-8")
    latest_path.write_text(content, encoding="utf-8")

    print(f"Saved dated CSV:  {dated_path}")
    print(f"Saved latest CSV: {latest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
