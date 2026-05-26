#!/usr/bin/env python3
"""
Export PSI scores for the pilot roundup cohorts.

Output now mirrors the roundup structure:
- Pilot properties
- Sister/control properties
- Twin properties
- Main pilot reference row at the bottom

Pilots continue to use the dedicated pilot/control PSI table.
Sisters and twins use the canonical portfolio PSI table.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests

BASE_DIR = Path(__file__).resolve().parents[1]
ROOT = BASE_DIR.parent
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


def control_entries(config: Dict[str, object]) -> List[Dict[str, object]]:
    return [row for row in active_cohorts(config) if row.get("role") == "control"]


def control_map(config: Dict[str, object]) -> Dict[str, Dict[str, object]]:
    return {row["key"]: row for row in control_entries(config)}


def twin_groups(config: Dict[str, object]) -> Dict[str, List[Dict[str, object]]]:
    return config.get("twin_groups", {})


def main_reference(config: Dict[str, object]) -> Dict[str, str]:
    return config.get(
        "main_pilot_reference",
        {
            "label": "Main Pilot Reference",
            "requested_url": "https://pilot.venterrradev.com/",
            "site_url": "https://pilot.venterradev.com/",
        },
    )


def latest_complete_pilot_psi_date(conn: sqlite3.Connection, pilot_keys: Iterable[str]) -> Optional[str]:
    keys = list(pilot_keys)
    placeholders = ",".join("?" for _ in keys)
    row = conn.execute(
        f"""
        SELECT metric_date
        FROM pilot_control_psi_metrics
        WHERE strategy = 'mobile'
          AND cohort_key IN ({placeholders})
        GROUP BY metric_date
        HAVING COUNT(DISTINCT cohort_key) >= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        [*keys, len(keys)],
    ).fetchone()
    return row[0] if row else None


def get_dedicated_score(conn: sqlite3.Connection, cohort_key: str, metric_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT performance_score
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        LIMIT 1
        """,
        (cohort_key, metric_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def get_dedicated_previous_score(conn: sqlite3.Connection, cohort_key: str, before_date: str) -> tuple[Optional[str], Optional[float]]:
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


def get_dedicated_t7(conn: sqlite3.Connection, cohort_key: str, through_date: str) -> Optional[float]:
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


def latest_legacy_psi_date(conn: sqlite3.Connection, property_id: str, through_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT metric_date
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date <= ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, through_date),
    ).fetchone()
    return row[0] if row else None


def get_legacy_score(conn: sqlite3.Connection, property_id: str, metric_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT performance_score
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        LIMIT 1
        """,
        (property_id, metric_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def get_legacy_previous_score(conn: sqlite3.Connection, property_id: str, before_date: str) -> tuple[Optional[str], Optional[float]]:
    row = conn.execute(
        """
        SELECT metric_date, performance_score
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date < ?
        ORDER BY metric_date DESC
        LIMIT 1
        """,
        (property_id, before_date),
    ).fetchone()
    if not row:
        return None, None
    return row[0], (float(row[1]) if row[1] is not None else None)


def get_legacy_t7(conn: sqlite3.Connection, property_id: str, through_date: str) -> Optional[float]:
    row = conn.execute(
        """
        SELECT AVG(performance_score)
        FROM (
            SELECT performance_score
            FROM pagespeed_metrics
            WHERE property_id = ?
              AND strategy = 'mobile'
              AND metric_date <= ?
            ORDER BY metric_date DESC
            LIMIT 7
        )
        """,
        (property_id, through_date),
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def load_pagespeed_api_key(config: Dict[str, object]) -> Optional[str]:
    path = Path(config["pagespeed_api_key_path"])
    if not path.exists():
        return None
    key = path.read_text().strip()
    return key or None


def fetch_live_reference_score(url: str, api_key: str) -> Optional[float]:
    response = requests.get(
        "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
        params={"url": url, "key": api_key, "strategy": "mobile", "category": "performance"},
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    score = (
        payload.get("lighthouseResult", {})
        .get("categories", {})
        .get("performance", {})
        .get("score")
    )
    if score is None:
        return None
    return round(float(score) * 100, 1)


def csv_value(value: Optional[float]) -> str:
    return "" if value is None else f"{value:.1f}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Export roundup-aligned PSI scores")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--output-dir", default=str(Path.home() / "Downloads"), help="Directory for CSV output")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    pilots = pilot_entries(config)
    controls_by_key = control_map(config)
    conn = sqlite3.connect(Path(config["db_path"]))

    metric_date = latest_complete_pilot_psi_date(conn, [entry["key"] for entry in pilots])
    if not metric_date:
        raise SystemExit("No complete PSI cohort found")

    rows: List[ExportRow] = []

    for pilot in pilots:
        _previous_date, previous_score = get_dedicated_previous_score(conn, pilot["key"], metric_date)
        rows.append(
            ExportRow(
                group="pilot",
                parent_pilot=pilot["display_name"],
                property_name=pilot["display_name"],
                yesterday=previous_score,
                today=get_dedicated_score(conn, pilot["key"], metric_date),
                rolling_t7=get_dedicated_t7(conn, pilot["key"], metric_date),
            )
        )

        sister_key = pilot.get("sister_key")
        sister = controls_by_key.get(sister_key) if sister_key else None
        if sister:
            sister_date = latest_legacy_psi_date(conn, str(sister["property_id"]), metric_date)
            _sister_prev_date, sister_prev = (
                get_legacy_previous_score(conn, str(sister["property_id"]), sister_date)
                if sister_date
                else (None, None)
            )
            rows.append(
                ExportRow(
                    group="sister",
                    parent_pilot=pilot["display_name"],
                    property_name=sister["display_name"],
                    yesterday=sister_prev,
                    today=get_legacy_score(conn, str(sister["property_id"]), sister_date) if sister_date else None,
                    rolling_t7=get_legacy_t7(conn, str(sister["property_id"]), sister_date) if sister_date else None,
                )
            )

        for twin in twin_groups(config).get(pilot["key"], []):
            twin_date = latest_legacy_psi_date(conn, str(twin["property_id"]), metric_date)
            _twin_prev_date, twin_prev = (
                get_legacy_previous_score(conn, str(twin["property_id"]), twin_date)
                if twin_date
                else (None, None)
            )
            rows.append(
                ExportRow(
                    group="twin",
                    parent_pilot=pilot["display_name"],
                    property_name=twin["display_name"],
                    yesterday=twin_prev,
                    today=get_legacy_score(conn, str(twin["property_id"]), twin_date) if twin_date else None,
                    rolling_t7=get_legacy_t7(conn, str(twin["property_id"]), twin_date) if twin_date else None,
                )
            )

    reference = main_reference(config)
    api_key = load_pagespeed_api_key(config)
    reference_today = None
    if api_key:
        try:
            reference_today = fetch_live_reference_score(reference["site_url"], api_key)
        except Exception:
            reference_today = None

    rows.append(
        ExportRow(
            group="main_pilot_reference",
            parent_pilot="",
            property_name=reference.get("label", "Main Pilot Reference"),
            yesterday=None,
            today=reference_today,
            rolling_t7=None,
        )
    )

    conn.close()

    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    dated_path = output_dir / f"PSI_Day_Over_Day_Scores_{metric_date}.csv"
    latest_path = output_dir / "PSI_Day_Over_Day_Scores_latest.csv"

    lines = ["Group,Parent Pilot,Property Name,Yesterday PSI,Today PSI,Rolling T7 PSI"]
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
