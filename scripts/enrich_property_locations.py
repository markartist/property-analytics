#!/usr/bin/env python3
"""Backfill property city/state from governed local location sources."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_DB = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_GBP_LOCATIONS = ROOT / "config" / "gbp_location_names.json"
DEFAULT_SPOTLIGHT_REGISTRY = ROOT / "Spotlight_Properties_Report" / "config" / "properties_registry.json"

STATE_BY_CODE_PREFIX = {
    "AR": "AR",
    "FL": "FL",
    "GA": "GA",
    "KY": "KY",
    "NC": "NC",
    "OK": "OK",
    "TX": "TX",
}

STATE_BY_REGION = {
    "arkansas": "AR",
    "atlanta, ga": "GA",
    "austin, tx": "TX",
    "dallas, tx": "TX",
    "florida": "FL",
    "houston, tx": "TX",
    "kansas city": "MO",
    "kentucky": "KY",
    "killeen": "TX",
    "nashville, tn": "TN",
    "north carolina": "NC",
    "oklahoma": "OK",
    "raleigh, nc": "NC",
    "san antonio, tx": "TX",
    "savannah, ga": "GA",
}


def normalize(value: str | None) -> str:
    if not value:
        return ""
    text = value.lower()
    text = re.sub(r"\b(apartments|apartment|at|the)\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def state_from_location(location: str | None) -> str | None:
    if not location:
        return None
    parts = [part.strip() for part in location.split(",")]
    if len(parts) >= 2 and re.fullmatch(r"[A-Za-z]{2}", parts[-1]):
        return parts[-1].upper()
    return None


def city_from_location(location: str | None) -> str | None:
    if not location:
        return None
    city = location.split(",")[0].strip()
    return city or None


def infer_state(property_code: str | None, encasa_region: str | None, spotlight_location: str | None) -> str | None:
    explicit = state_from_location(spotlight_location)
    if explicit:
        return explicit
    if property_code and len(property_code) >= 2:
        prefix = property_code[:2].upper()
        if prefix in STATE_BY_CODE_PREFIX:
            return STATE_BY_CODE_PREFIX[prefix]
    if encasa_region:
        key = encasa_region.strip().lower()
        if key in STATE_BY_REGION:
            return STATE_BY_REGION[key]
        explicit = state_from_location(encasa_region)
        if explicit:
            return explicit
    return None


def load_gbp_locations(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {str(location_id): row for location_id, row in raw.items()}


def load_spotlight_locations(path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    if not path.exists():
        return {}, {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = raw.get("properties", raw) if isinstance(raw, dict) else raw
    by_url: dict[str, dict[str, Any]] = {}
    by_name: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("full_url"):
            by_url[str(row["full_url"]).rstrip("/").lower()] = row
        names = [row.get("canonical_name"), *(row.get("aliases") or [])]
        for name in names:
            key = normalize(str(name) if name else None)
            if key:
                by_name.setdefault(key, row)
    return by_url, by_name


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill properties.city/state from GBP and Spotlight metadata.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--gbp-locations", type=Path, default=DEFAULT_GBP_LOCATIONS)
    parser.add_argument("--spotlight-registry", type=Path, default=DEFAULT_SPOTLIGHT_REGISTRY)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    gbp_by_id = load_gbp_locations(args.gbp_locations)
    spotlight_by_url, spotlight_by_name = load_spotlight_locations(args.spotlight_registry)
    updates: list[dict[str, Any]] = []

    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT property_id, property_name, thirtylines_id, gbp_location_id, city, state,
                   encasa_region, full_url, gsc_url
            FROM properties
            ORDER BY property_name
            """
        ).fetchall()
        for row in rows:
            prop = dict(row)
            current_city = prop.get("city")
            current_state = prop.get("state")
            gbp = gbp_by_id.get(str(prop.get("gbp_location_id") or ""))
            spotlight = spotlight_by_url.get(str(prop.get("full_url") or "").rstrip("/").lower())
            if not spotlight:
                spotlight = spotlight_by_name.get(normalize(prop.get("property_name")))

            city = current_city or (gbp or {}).get("city") or city_from_location((spotlight or {}).get("location"))
            state = current_state or infer_state(
                prop.get("thirtylines_id"),
                prop.get("encasa_region"),
                (spotlight or {}).get("location"),
            )
            if city != current_city or state != current_state:
                updates.append(
                    {
                        "property_id": prop["property_id"],
                        "property_name": prop["property_name"],
                        "old_city": current_city,
                        "old_state": current_state,
                        "city": city,
                        "state": state,
                        "city_source": "gbp_location_names" if (gbp or {}).get("city") else "spotlight_registry",
                        "state_source": "spotlight_registry/property_code/encasa_region",
                    }
                )

        if not args.dry_run:
            for update in updates:
                conn.execute(
                    """
                    UPDATE properties
                    SET city = COALESCE(?, city),
                        state = COALESCE(?, state),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE property_id = ?
                    """,
                    (update["city"], update["state"], update["property_id"]),
                )
            conn.commit()

    print(
        json.dumps(
            {
                "db": str(args.db),
                "dry_run": args.dry_run,
                "updates": len(updates),
                "with_city": sum(1 for update in updates if update.get("city")),
                "with_state": sum(1 for update in updates if update.get("state")),
                "sample": updates[:12],
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
