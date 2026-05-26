#!/usr/bin/env python3
"""
Export GTMetrix scores for the pilot roundup cohorts.

Output now mirrors the roundup structure:
- Pilot properties
- Sister/control properties
- Twin properties
- Main pilot reference row at the bottom
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"


@dataclass
class ExportRow:
    group: str
    parent_pilot: str
    property_name: str
    yesterday: Optional[float]
    today: Optional[float]
    rolling_t7: Optional[float]


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def active_cohorts(config: Dict[str, object]) -> List[Dict[str, object]]:
    return [row for row in config.get("cohorts", []) if row.get("active", True) and row.get("property_id")]


def pilot_entries(config: Dict[str, object]) -> List[Dict[str, object]]:
    return [row for row in active_cohorts(config) if row.get("role") == "pilot"]


def control_map(config: Dict[str, object]) -> Dict[str, Dict[str, object]]:
    return {row["key"]: row for row in active_cohorts(config) if row.get("role") == "control"}


def twin_groups(config: Dict[str, object]) -> Dict[str, List[Dict[str, object]]]:
    return config.get("twin_groups", {})


def main_reference(config: Dict[str, object]) -> Dict[str, str]:
    return config.get(
        "main_pilot_reference",
        {
            "label": "Main Pilot Reference",
            "property_id": "main_pilot_reference",
            "requested_url": "https://pilot.venterrradev.com/",
            "site_url": "https://pilot.venterradev.com/",
        },
    )


def latest_complete_date(conn: sqlite3.Connection, property_ids: Iterable[str]) -> Optional[str]:
    ids = list(property_ids)
    placeholders = ",".join("?" for _ in ids)
    row = conn.execute(
        f"""
        SELECT metric_date
        FROM gtmetrix_metrics
        WHERE property_id IN ({placeholders})
        GROUP BY metric_date
        HAVING COUNT(DISTINCT property_id) >= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        [*ids, len(ids)],
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


def latest_gt_date_for_property(conn: sqlite3.Connection, property_id: str, through_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date <= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, through_date),
    ).fetchone()
    return row[0] if row else None


def get_gt_score(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT pagespeed_score
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date = ?
        LIMIT 1
        """,
        (property_id, metric_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def get_previous_gt_score(conn: sqlite3.Connection, property_id: str, before_date: str) -> tuple[Optional[str], Optional[float]]:
    row = conn.execute(
        """
        SELECT metric_date, pagespeed_score
        FROM gtmetrix_metrics
        WHERE property_id = ?
          AND metric_date < ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, before_date),
    ).fetchone()
    if not row:
        return None, None
    return row[0], (float(row[1]) if row[1] is not None else None)


def get_t7_gt_score(conn: sqlite3.Connection, property_id: str, through_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT AVG(pagespeed_score)
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
    return float(row[0]) if row and row[0] is not None else None


def csv_value(value: Optional[float]) -> str:
    return "" if value is None else f"{value:.1f}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Export roundup-aligned GTMetrix scores")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--output-dir", default=str(Path.home() / "Downloads"), help="Directory for CSV output")
    parser.add_argument("--date", help="Specific metric date to export (YYYY-MM-DD). Defaults to today.")
    parser.add_argument(
        "--allow-latest-complete",
        action="store_true",
        help="Allow fallback to the latest complete pilot cohort if the requested date is incomplete.",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))
    pilots = pilot_entries(config)
    controls_by_key = control_map(config)
    conn = sqlite3.connect(Path(config["db_path"]))

    pilot_property_ids = [str(entry["property_id"]) for entry in pilots]
    metric_date = args.date or date.today().isoformat()
    if count_rows_for_date(conn, metric_date, pilot_property_ids) < len(pilot_property_ids):
        if args.allow_latest_complete:
            metric_date = latest_complete_date(conn, pilot_property_ids)
            if not metric_date:
                raise SystemExit("No complete GTMetrix cohort found")
        else:
            actual_count = count_rows_for_date(conn, metric_date, pilot_property_ids)
            raise SystemExit(
                f"Requested GTMetrix date {metric_date} is incomplete: expected={len(pilot_property_ids)} found={actual_count}"
            )

    rows: List[ExportRow] = []

    for pilot in pilots:
        _previous_date, previous_score = get_previous_gt_score(conn, str(pilot["property_id"]), metric_date)
        rows.append(
            ExportRow(
                group="pilot",
                parent_pilot=pilot["display_name"],
                property_name=pilot["display_name"],
                yesterday=previous_score,
                today=get_gt_score(conn, str(pilot["property_id"]), metric_date),
                rolling_t7=get_t7_gt_score(conn, str(pilot["property_id"]), metric_date),
            )
        )

        sister_key = pilot.get("sister_key")
        sister = controls_by_key.get(sister_key) if sister_key else None
        if sister:
            sister_date = latest_gt_date_for_property(conn, str(sister["property_id"]), metric_date)
            _sister_prev_date, sister_prev = (
                get_previous_gt_score(conn, str(sister["property_id"]), sister_date)
                if sister_date
                else (None, None)
            )
            rows.append(
                ExportRow(
                    group="sister",
                    parent_pilot=pilot["display_name"],
                    property_name=sister["display_name"],
                    yesterday=sister_prev,
                    today=get_gt_score(conn, str(sister["property_id"]), sister_date) if sister_date else None,
                    rolling_t7=get_t7_gt_score(conn, str(sister["property_id"]), sister_date) if sister_date else None,
                )
            )

        for twin in twin_groups(config).get(pilot["key"], []):
            twin_date = latest_gt_date_for_property(conn, str(twin["property_id"]), metric_date)
            _twin_prev_date, twin_prev = (
                get_previous_gt_score(conn, str(twin["property_id"]), twin_date)
                if twin_date
                else (None, None)
            )
            rows.append(
                ExportRow(
                    group="twin",
                    parent_pilot=pilot["display_name"],
                    property_name=twin["display_name"],
                    yesterday=twin_prev,
                    today=get_gt_score(conn, str(twin["property_id"]), twin_date) if twin_date else None,
                    rolling_t7=get_t7_gt_score(conn, str(twin["property_id"]), twin_date) if twin_date else None,
                )
            )

    reference = main_reference(config)
    reference_property_id = str(reference.get("property_id") or "").strip()
    reference_date = latest_gt_date_for_property(conn, reference_property_id, metric_date) if reference_property_id else None
    _reference_prev_date, reference_prev = (
        get_previous_gt_score(conn, reference_property_id, reference_date)
        if reference_date and reference_property_id
        else (None, None)
    )
    rows.append(
        ExportRow(
            group="main_pilot_reference",
            parent_pilot="",
            property_name=reference.get("label", "Main Pilot Reference"),
            yesterday=reference_prev,
            today=get_gt_score(conn, reference_property_id, reference_date) if reference_date and reference_property_id else None,
            rolling_t7=get_t7_gt_score(conn, reference_property_id, reference_date) if reference_date and reference_property_id else None,
        )
    )

    conn.close()

    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    dated_path = output_dir / f"GTMetrix_Daily_Scores_{metric_date}.csv"
    latest_path = output_dir / "GTMetrix_Daily_Scores_latest.csv"

    lines = ["Group,Parent Pilot,Property Name,Yesterday GTMetrix,Today GTMetrix,Rolling T7 GTMetrix"]
    for row in rows:
        lines.append(
            ",".join(
                [
                    row.group,
                    row.parent_pilot,
                    row.property_name,
                    csv_value(row.yesterday),
                    csv_value(row.today),
                    csv_value(row.rolling_t7),
                ]
            )
        )

    content = "\n".join(lines) + "\n"
    dated_path.write_text(content, encoding="utf-8")
    latest_path.write_text(content, encoding="utf-8")

    print(f"Saved dated CSV:  {dated_path}")
    print(f"Saved latest CSV: {latest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
