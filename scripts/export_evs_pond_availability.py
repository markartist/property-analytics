#!/usr/bin/env python3
"""Export governed Pond unit availability for EVS BrowserStack comparisons."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity


DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_PILOT_CONFIG = ROOT / "evs" / "config" / "pilot-properties.json"
DEFAULT_OUTPUT_PATH = ROOT / "evs" / "reports" / "pond-availability-latest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="SQLite Pond mirror containing unit_availability_units.")
    parser.add_argument("--pilot-config", default=str(DEFAULT_PILOT_CONFIG), help="Pilot property config JSON.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Output JSON path.")
    parser.add_argument("--property-id", action="append", default=[], help="Optional pilot property slug filter.")
    return parser.parse_args()


def load_pilot_properties(path: Path, filters: set[str]) -> list[dict[str, Any]]:
    properties = json.loads(path.read_text(encoding="utf-8"))
    selected = [
        property_row
        for property_row in properties
        if property_row.get("active") and (not filters or property_row.get("property_id") in filters)
    ]
    if filters and selected:
        return selected
    if not filters:
        return selected

    synthesized: list[dict[str, Any]] = []
    for property_id in sorted(filters):
        identity = resolve_property_identity(property_id)
        if not identity:
            synthesized.append({"property_id": property_id, "property_name": property_id, "active": True})
            continue
        synthesized.append(
            {
                "property_id": identity.canonical_property_id,
                "property_name": identity.property_name,
                "active": True,
                "source": "property_identity_matrix",
            }
        )
    return synthesized


def fetch_latest_units(conn: sqlite3.Connection, ga4_property_id: str, property_code: str) -> tuple[str | None, list[dict[str, Any]]]:
    latest_row = conn.execute(
        """
        SELECT MAX(snapshot_date) AS latest_snapshot_date
        FROM unit_availability_units
        WHERE property_id = ? OR feed_property_id = ?
        """,
        (ga4_property_id, property_code),
    ).fetchone()
    latest_snapshot_date = latest_row["latest_snapshot_date"] if latest_row else None
    if not latest_snapshot_date:
        return None, []

    rows = conn.execute(
        """
        SELECT
          snapshot_date,
          property_id,
          feed_property_id,
          feed_property_name,
          floorplan_id,
          floorplan_name,
          unit_id,
          building,
          apt_number,
          level,
          rent_from,
          rent_to,
          available_date,
          days_until_available,
          availability_bucket,
          pricing_and_specials_message,
          concession_amount,
          tour_url,
          quote_url,
          application_url,
          matterport_url
        FROM unit_availability_units
        WHERE snapshot_date = ?
          AND (property_id = ? OR feed_property_id = ?)
        ORDER BY apt_number
        """,
        (latest_snapshot_date, ga4_property_id, property_code),
    ).fetchall()
    return latest_snapshot_date, [dict(row) for row in rows]


def resolve_pilot_identity(property_row: dict[str, Any]):
    raw_candidates = [
        property_row.get("property_name"),
        property_row.get("property_id"),
        str(property_row.get("property_id") or "").replace("-", " "),
    ]
    candidates: list[str] = []
    for value in raw_candidates:
        if not value:
            continue
        text = str(value)
        candidates.append(text)
        candidates.append(text.replace("'", ""))
        candidates.append(text.replace("'s", "s"))

    for candidate in candidates:
        identity = resolve_property_identity(candidate)
        if identity:
            return identity
    return None


def main() -> int:
    args = parse_args()
    db_path = Path(args.db)
    pilot_config = Path(args.pilot_config)
    output_path = Path(args.output)
    filters = set(args.property_id or [])

    if not db_path.exists():
        raise FileNotFoundError(f"Pond availability DB not found: {db_path}")
    if not pilot_config.exists():
        raise FileNotFoundError(f"Pilot config not found: {pilot_config}")

    pilot_properties = load_pilot_properties(pilot_config, filters)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    properties: list[dict[str, Any]] = []
    units: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("SELECT 1 FROM unit_availability_units LIMIT 1").fetchone()

        for property_row in pilot_properties:
            identity = resolve_pilot_identity(property_row)
            if not identity:
                warnings.append(
                    {
                        "property_id": property_row.get("property_id"),
                        "property_name": property_row.get("property_name"),
                        "warning": "property_identity_unresolved",
                    }
                )
                continue

            latest_snapshot_date, property_units = fetch_latest_units(
                conn,
                identity.ga4_property_id or "",
                identity.property_code or "",
            )
            if not latest_snapshot_date:
                warnings.append(
                    {
                        "property_id": property_row.get("property_id"),
                        "property_name": property_row.get("property_name"),
                        "property_code": identity.property_code,
                        "ga4_property_id": identity.ga4_property_id,
                        "warning": "no_unit_availability_rows",
                    }
                )

            properties.append(
                {
                    "input_property_id": property_row.get("property_id"),
                    "property_name": property_row.get("property_name"),
                    "property_code": identity.property_code,
                    "ga4_property_id": identity.ga4_property_id,
                    "canonical_property_id": identity.canonical_property_id,
                    "latest_snapshot_date": latest_snapshot_date,
                    "unit_count": len(property_units),
                }
            )
            for unit in property_units:
                units.append(
                    {
                        **unit,
                        "input_property_id": property_row.get("property_id"),
                        "canonical_property_id": identity.canonical_property_id,
                        "property_code": identity.property_code,
                        "ga4_property_id": identity.ga4_property_id,
                    }
                )

    payload = {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": {
            "db_path": str(db_path),
            "table": "unit_availability_units",
            "identity_resolver": str(ROOT / "Data_Collection" / "utils" / "property_identity.py"),
            "pilot_config": str(pilot_config),
        },
        "properties": properties,
        "units": units,
        "warnings": warnings,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"output_path": str(output_path), "properties": len(properties), "units": len(units), "warnings": warnings}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
