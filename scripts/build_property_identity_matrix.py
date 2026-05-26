#!/usr/bin/env python3
"""Build the governed property identity matrix from current canonical sources."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_DB = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_REGISTRY = ROOT / "config" / "venterra_properties_official.json"
DEFAULT_COMMUNITIES_SQL = ROOT / "apps" / "api" / "scripts" / "generated" / "04_insert_communities.sql"
DEFAULT_REMOTE_COMMUNITIES = ROOT / "config" / "generated" / "remote_communities_snapshot.json"
DEFAULT_OUTPUT = ROOT / "config" / "property_identity_matrix.json"

GOVERNED_SOURCE_ALIASES = {
    "Bella Ruscello": ("Bella Rucello",),
    "Camber Ridge": ("Camber Ridge at Cross Creek Ranch",),
    "Canton Mill Lofts": ("Canton Mills Loft",),
    "Creekside": ("Creekside Apartment Homes",),
    "The Pointe Bentonville": ("Point At Bentonville",),
    "Villas Continental": ("Villas Continentals",),
}


def load_official_registry(path: Path) -> dict[str, dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    properties = raw.get("properties", raw) if isinstance(raw, dict) else raw
    return {str(row.get("ga4_property_id")): row for row in properties if row.get("ga4_property_id")}


def load_communities_seed(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE communities (
          id TEXT,
          name TEXT,
          external_key TEXT,
          region TEXT,
          status TEXT,
          manager_name TEXT,
          unit_count INTEGER,
          ga4_property_id TEXT,
          full_url TEXT,
          encasa_short_name TEXT,
          encasa_property_code TEXT,
          city TEXT,
          state TEXT,
          created_at TEXT,
          created_by TEXT,
          updated_at TEXT,
          updated_by TEXT
        );
        """
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if "INSERT INTO communities" in line:
            conn.execute(line)
    return {str(row["ga4_property_id"]): dict(row) for row in conn.execute("SELECT * FROM communities") if row["ga4_property_id"]}


def load_remote_communities_snapshot(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = raw.get("rows", [])
    return {str(row["ga4_property_id"]): row for row in rows if row.get("ga4_property_id")}


def load_apartmentiq_identity_links(conn: sqlite3.Connection) -> dict[str, list[str]]:
    table_exists = conn.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'apartmentiq_property_identity_links'
        """
    ).fetchone()
    if not table_exists:
        return {}

    rows: dict[str, list[str]] = {}
    for row in conn.execute(
        """
        SELECT property_id, apartmentiq_property_id
        FROM apartmentiq_property_identity_links
        WHERE property_id IS NOT NULL
          AND apartmentiq_property_id IS NOT NULL
        ORDER BY property_id, apartmentiq_property_id
        """
    ):
        rows.setdefault(str(row["property_id"]), []).append(str(row["apartmentiq_property_id"]))
    return rows


def append_alias(aliases: list[str], value: str | None) -> None:
    if value and value not in aliases:
        aliases.append(value)


def build_matrix(db_path: Path, registry_path: Path, communities_sql: Path, remote_communities_snapshot: Path) -> dict[str, Any]:
    registry_by_ga4 = load_official_registry(registry_path)
    seed_by_ga4 = load_communities_seed(communities_sql)
    remote_by_ga4 = load_remote_communities_snapshot(remote_communities_snapshot)
    communities_by_ga4 = {**seed_by_ga4, **remote_by_ga4}
    rows: list[dict[str, Any]] = []

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        apartmentiq_ids_by_property = load_apartmentiq_identity_links(conn)
        for row in conn.execute("SELECT * FROM properties ORDER BY property_name"):
            prop = dict(row)
            ga4_property_id = str(prop.get("property_id") or "")
            registry = registry_by_ga4.get(ga4_property_id, {})
            community = communities_by_ga4.get(ga4_property_id, {})
            property_code = prop.get("thirtylines_id") or community.get("encasa_property_code")
            property_name = prop.get("property_name") or registry.get("name") or community.get("name")
            full_url = prop.get("full_url") or registry.get("full_url") or community.get("full_url")
            gsc_url = prop.get("gsc_url") or registry.get("gsc_url") or full_url
            short_name = prop.get("encasa_short_name") or community.get("encasa_short_name")

            aliases: list[str] = []
            for value in (
                property_name,
                community.get("name"),
                short_name,
                registry.get("name"),
                (property_name or "").replace("The ", ""),
                (property_name or "").replace(" Apartments", ""),
            ):
                append_alias(aliases, value)
            if property_name == "The Pointe Bentonville":
                for value in ("Pointe", "Pointe at Bentonville", "The Pointe at Bentonville"):
                    append_alias(aliases, value)
                property_code = property_code or "AR4PB"
            for value in GOVERNED_SOURCE_ALIASES.get(property_name or "", ()):
                append_alias(aliases, value)
            apartmentiq_property_ids = sorted(
                {
                    *apartmentiq_ids_by_property.get(property_code or "", []),
                    *apartmentiq_ids_by_property.get(ga4_property_id, []),
                }
            )

            rows.append(
                {
                    "canonical_property_id": property_code or ga4_property_id,
                    "display_property_id": property_code or ga4_property_id,
                    "property_code": property_code,
                    "community_id": community.get("id"),
                    "ga4_property_id": ga4_property_id,
                    "gsc_url": gsc_url,
                    "website_url": full_url,
                    "url_slug": prop.get("url_slug") or registry.get("url_slug"),
                    "property_name": property_name,
                    "community_name": community.get("name"),
                    "encasa_short_name": short_name,
                    "encasa_region": prop.get("encasa_region") or community.get("region"),
                    "city": prop.get("city") or community.get("city"),
                    "state": prop.get("state") or community.get("state"),
                    "company_id": prop.get("company_id"),
                    "gbp_location_id": prop.get("gbp_location_id"),
                    "unit_count": prop.get("unit_count") or community.get("unit_count") or registry.get("unit_count"),
                    "apartmentiq_property_ids": apartmentiq_property_ids,
                    "status": community.get("status") or prop.get("operational_status") or "active",
                    "aliases": aliases,
                    "source_refs": {
                        "property_metadata": True,
                        "official_registry": bool(registry),
                        "communities_seed": bool(community),
                        "apartmentiq_identity_links": bool(apartmentiq_property_ids),
                    },
                }
            )

    return {
        "version": "2026-04-28",
        "authority": "Data Pond property identity matrix",
        "canonical_key": "property_code when present, otherwise ga4_property_id",
        "generated_from": [
            str(db_path.relative_to(ROOT)),
            str(registry_path.relative_to(ROOT)),
            str(communities_sql.relative_to(ROOT)),
            str(remote_communities_snapshot.relative_to(ROOT)),
        ],
        "properties": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build config/property_identity_matrix.json.")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--communities-sql", default=str(DEFAULT_COMMUNITIES_SQL))
    parser.add_argument("--remote-communities-snapshot", default=str(DEFAULT_REMOTE_COMMUNITIES))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    matrix = build_matrix(
        Path(args.db),
        Path(args.registry),
        Path(args.communities_sql),
        Path(args.remote_communities_snapshot),
    )
    output = Path(args.output)
    output.write_text(json.dumps(matrix, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(output),
                "properties": len(matrix["properties"]),
                "with_property_code": sum(1 for row in matrix["properties"] if row.get("property_code")),
                "with_community_id": sum(1 for row in matrix["properties"] if row.get("community_id")),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
