#!/usr/bin/env python3
"""
ThirtyLines Availability Collector

Fetches live availability from the ThirtyLines feed and upserts unit-level
availability snapshots into the canonical `unit_availability` table.
"""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

import requests

FEED_URL = "https://online.venterraliving.com/encasa-external/ThirtyLines"
REGISTRY_PATH = Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/properties_registry.json")


@dataclass
class AvailabilityIngestResult:
    properties_seen: int = 0
    properties_mapped: int = 0
    properties_unmapped: int = 0
    floorplans_upserted: int = 0
    errors: Optional[List[str]] = None

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []


class ThirtyLinesCollector:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.alias_to_ga4 = self._load_alias_map()
        self.feed_id_to_ga4 = self._load_feed_id_map()

    @staticmethod
    def _normalize_name(name: str) -> str:
        s = (name or "").strip().lower()
        s = s.replace("&", " and ")
        s = re.sub(r"\bapartments?\b", "", s)
        s = re.sub(r"\s+", " ", s)
        return s.strip()

    def _load_alias_map(self) -> Dict[str, str]:
        if not REGISTRY_PATH.exists():
            raise RuntimeError(f"Registry not found: {REGISTRY_PATH}")

        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            registry = json.load(f)

        alias_map: Dict[str, str] = {}
        for ga4_id, prop in registry.get("properties", {}).items():
            aliases = prop.get("aliases", []) + [prop.get("canonical_name", "")]
            for alias in aliases:
                norm = self._normalize_name(alias)
                if norm:
                    alias_map[norm] = ga4_id
        return alias_map

    def _load_feed_id_map(self) -> Dict[str, str]:
        """
        Prefer stable ThirtyLines feed IDs from property_metadata over name matching.
        """
        mapping: Dict[str, str] = {}
        if not self.db_path.exists():
            return mapping

        conn = sqlite3.connect(str(self.db_path))
        try:
            rows = conn.execute(
                """
                SELECT property_id, thirtylines_id
                FROM property_metadata
                WHERE thirtylines_id IS NOT NULL
                  AND TRIM(thirtylines_id) != ''
                """
            ).fetchall()
        except sqlite3.Error:
            return mapping
        finally:
            conn.close()

        for property_id, feed_id in rows:
            mapping[str(feed_id).strip()] = str(property_id).strip()
        return mapping

    def _resolve_ga4_id(self, feed_name: str) -> Optional[str]:
        norm = self._normalize_name(feed_name)
        if norm in self.alias_to_ga4:
            return self.alias_to_ga4[norm]

        # Fallback contains matching for mild naming drift.
        for alias, ga4 in self.alias_to_ga4.items():
            if norm and (norm in alias or alias in norm):
                return ga4
        return None

    def _resolve_ga4_id_from_payload(self, prop: Dict[str, object]) -> Optional[str]:
        feed_id = str(prop.get("id") or "").strip()
        if feed_id and feed_id in self.feed_id_to_ga4:
            return self.feed_id_to_ga4[feed_id]
        feed_name = str(prop.get("name") or "").strip()
        return self._resolve_ga4_id(feed_name)

    @staticmethod
    def _to_int(value: object) -> int:
        try:
            if value is None or value == "":
                return 0
            return int(float(value))
        except Exception:
            return 0

    def ingest(self, snapshot_date: Optional[str] = None, timeout_sec: int = 60) -> AvailabilityIngestResult:
        result = AvailabilityIngestResult()
        snap = snapshot_date or date.today().isoformat()

        resp = requests.get(FEED_URL, timeout=timeout_sec)
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, list):
            raise RuntimeError("Unexpected ThirtyLines payload shape (expected list)")

        conn = sqlite3.connect(str(self.db_path))
        try:
            cur = conn.cursor()
            for prop in payload:
                result.properties_seen += 1
                feed_name = (prop.get("name") or "").strip()
                ga4_id = self._resolve_ga4_id_from_payload(prop)
                if not ga4_id:
                    result.properties_unmapped += 1
                    feed_id = str(prop.get("id") or "").strip()
                    result.errors.append(f"Unmapped property: id={feed_id or 'n/a'} name={feed_name}")
                    continue

                result.properties_mapped += 1
                for fp in prop.get("floorplans", []) or []:
                    fp_name = (fp.get("name") or fp.get("floorplanName") or "Unknown").strip()
                    units_now = self._to_int(fp.get("unitsAvailable"))
                    units_30 = self._to_int(fp.get("unitsAvailable30"))
                    units_60 = self._to_int(fp.get("unitsAvailable60"))
                    units_after_60 = self._to_int(fp.get("unitsAvailableAfter60"))

                    cur.execute(
                        """
                        INSERT INTO unit_availability (
                            property_id,
                            floorplan_name,
                            snapshot_date,
                            units_available_now,
                            units_available_30d,
                            units_available_60d,
                            units_available_after_60d,
                            available_units_json,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(property_id, floorplan_name, snapshot_date) DO UPDATE SET
                            units_available_now = excluded.units_available_now,
                            units_available_30d = excluded.units_available_30d,
                            units_available_60d = excluded.units_available_60d,
                            units_available_after_60d = excluded.units_available_after_60d,
                            available_units_json = excluded.available_units_json,
                            created_at = CURRENT_TIMESTAMP
                        """,
                        (
                            ga4_id,
                            fp_name,
                            snap,
                            units_now,
                            units_30,
                            units_60,
                            units_after_60,
                            json.dumps(fp, separators=(",", ":")),
                        ),
                    )
                    result.floorplans_upserted += 1

            conn.commit()
        finally:
            conn.close()

        return result


if __name__ == "__main__":
    collector = ThirtyLinesCollector(Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db"))
    out = collector.ingest()
    print(out)
