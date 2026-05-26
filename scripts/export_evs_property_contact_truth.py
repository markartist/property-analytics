#!/usr/bin/env python3
"""Export governed property contact/navigation truth for EVS BrowserStack checks."""

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
DEFAULT_OUTPUT_PATH = ROOT / "evs" / "reports" / "property-contact-truth-latest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="SQLite Pond mirror containing ThirtyLines snapshots.")
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
                "property_code": identity.property_code,
                "active": True,
                "source": "property_identity_matrix",
            }
        )
    return synthesized


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


def identity_value(identity: Any, key: str) -> Any:
    if identity is None:
        return None
    if isinstance(identity, dict):
        return identity.get(key)
    return getattr(identity, key, None)


def latest_thirtylines_properties(conn: sqlite3.Connection) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    row = conn.execute(
        """
        SELECT snapshot_id, snapshot_date, fetched_at, feed_url, raw_payload_json
        FROM thirtylines_feed_snapshots
        ORDER BY snapshot_date DESC, snapshot_id DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        return None, []
    payload = json.loads(row["raw_payload_json"])
    properties = payload if isinstance(payload, list) else payload.get("properties", [])
    snapshot = {
        "snapshot_id": row["snapshot_id"],
        "snapshot_date": row["snapshot_date"],
        "fetched_at": row["fetched_at"],
        "feed_url": row["feed_url"],
    }
    return snapshot, [item for item in properties if isinstance(item, dict)]


def main() -> int:
    args = parse_args()
    db_path = Path(args.db)
    pilot_config = Path(args.pilot_config)
    output_path = Path(args.output)
    filters = set(args.property_id or [])

    if not db_path.exists():
        raise FileNotFoundError(f"Pond DB not found: {db_path}")
    if not pilot_config.exists():
        raise FileNotFoundError(f"Pilot config not found: {pilot_config}")

    pilot_properties = load_pilot_properties(pilot_config, filters)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    warnings: list[dict[str, Any]] = []
    properties: list[dict[str, Any]] = []

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        snapshot, feed_properties = latest_thirtylines_properties(conn)
        by_code = {str(row.get("id") or ""): row for row in feed_properties}

        for property_row in pilot_properties:
            identity = resolve_pilot_identity(property_row)
            if not identity:
                warnings.append({"property_id": property_row.get("property_id"), "warning": "identity_not_resolved"})
                continue

            property_code = identity_value(identity, "property_code")
            feed_row = by_code.get(str(property_code or ""))
            if not feed_row:
                warnings.append(
                    {
                        "property_id": property_row.get("property_id"),
                        "property_code": property_code,
                        "warning": "feed_property_not_found",
                    }
                )
                continue

            properties.append(
                {
                    "property_id": property_row.get("property_id"),
                    "property_name": property_row.get("property_name"),
                    "canonical_property_id": identity_value(identity, "canonical_property_id"),
                    "property_code": property_code,
                    "ga4_property_id": identity_value(identity, "ga4_property_id"),
                    "community_id": identity_value(identity, "community_id"),
                    "feed_property_id": feed_row.get("id"),
                    "feed_property_name": feed_row.get("name"),
                    "office_phone": feed_row.get("officePhone"),
                    "concierge_phone": feed_row.get("conciergePhone"),
                    "leasing_email": feed_row.get("email"),
                    "property_banner_special": feed_row.get("propertyBannerSpecial"),
                    "latitude": feed_row.get("latitude"),
                    "longitude": feed_row.get("longitude"),
                    "pipeline_url": feed_row.get("pipelineURL"),
                    "schedule_tour_url": feed_row.get("tourURL"),
                    "source": {
                        "system": "thirtylines_feed_snapshots",
                        "snapshot": snapshot,
                    },
                }
            )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "db_path": str(db_path),
        "pilot_config_path": str(pilot_config),
        "property_count": len(properties),
        "properties": properties,
        "warnings": warnings,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"output_path": str(output_path), "properties": len(properties), "warnings": warnings}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
