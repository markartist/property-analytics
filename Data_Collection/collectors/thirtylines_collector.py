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
import hashlib
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

FEED_URL = "https://online.venterraliving.com/encasa-external/ThirtyLines"
REGISTRY_PATH = Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/properties_registry.json")


@dataclass
class AvailabilityIngestResult:
    properties_seen: int = 0
    properties_mapped: int = 0
    properties_unmapped: int = 0
    floorplans_seen: int = 0
    floorplans_upserted: int = 0
    units_seen: int = 0
    unit_snapshots_upserted: int = 0
    units_with_specials: int = 0
    raw_snapshot_id: Optional[int] = None
    payload_sha256: Optional[str] = None
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

    @staticmethod
    def _to_float(value: object) -> Optional[float]:
        try:
            if value is None or value == "":
                return None
            return float(value)
        except Exception:
            return None

    @staticmethod
    def _clean_text(value: object) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text if text else None

    @staticmethod
    def _json_compact(value: object) -> str:
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

    @staticmethod
    def _parse_concession_amount(message: Optional[str]) -> Optional[float]:
        if not message:
            return None
        match = re.search(r"\$\s*([0-9,]+(?:\.[0-9]+)?)", message)
        if not match:
            return None
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None

    @staticmethod
    def _availability_bucket(snapshot_date: str, available_date: Optional[str]) -> Tuple[Optional[int], str]:
        if not available_date:
            return None, "unknown"
        try:
            snap = date.fromisoformat(snapshot_date)
            avail = date.fromisoformat(available_date)
        except ValueError:
            return None, "unknown"

        days = (avail - snap).days
        if days <= 0:
            return days, "current"
        if days <= 30:
            return days, "30d"
        if days <= 60:
            return days, "60d"
        return days, "after60d"

    @staticmethod
    def _unit_id(feed_id: str, unit: Dict[str, object]) -> str:
        explicit = ThirtyLinesCollector._clean_text(unit.get("unitID"))
        if explicit:
            return explicit
        building = ThirtyLinesCollector._clean_text(unit.get("building")) or ""
        apt = ThirtyLinesCollector._clean_text(unit.get("aptNumber")) or ""
        return f"{feed_id}{building}{apt}" if feed_id or building or apt else "unknown"

    def _ensure_schema(self, cur: sqlite3.Cursor) -> None:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS thirtylines_feed_snapshots (
                snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date DATE NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                feed_url TEXT NOT NULL,
                payload_sha256 TEXT NOT NULL,
                raw_payload_json TEXT NOT NULL,
                properties_seen INTEGER DEFAULT 0,
                properties_mapped INTEGER DEFAULT 0,
                properties_unmapped INTEGER DEFAULT 0,
                floorplans_seen INTEGER DEFAULT 0,
                units_seen INTEGER DEFAULT 0,
                units_with_specials INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(snapshot_date, payload_sha256)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS unit_availability_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date DATE NOT NULL,
                property_id TEXT NOT NULL,
                feed_property_id TEXT,
                feed_property_name TEXT,
                floorplan_id TEXT,
                floorplan_name TEXT NOT NULL,
                unit_id TEXT NOT NULL,
                building TEXT,
                apt_number TEXT,
                level TEXT,
                rent_from REAL,
                rent_to REAL,
                moved_out_date DATE,
                available_date DATE,
                days_until_available INTEGER,
                availability_bucket TEXT,
                pricing_and_specials_message TEXT,
                concession_amount REAL,
                tour_url TEXT,
                quote_url TEXT,
                application_url TEXT,
                matterport_url TEXT,
                features_json TEXT,
                images_json TEXT,
                videos_json TEXT,
                raw_unit_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(property_id, snapshot_date, unit_id)
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_unit_availability_units_property_date
                ON unit_availability_units(property_id, snapshot_date DESC)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_unit_availability_units_floorplan
                ON unit_availability_units(property_id, snapshot_date DESC, floorplan_name)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_unit_availability_units_specials
                ON unit_availability_units(property_id, snapshot_date DESC, concession_amount)
            """
        )

    def ingest(self, snapshot_date: Optional[str] = None, timeout_sec: int = 60) -> AvailabilityIngestResult:
        result = AvailabilityIngestResult()
        snap = snapshot_date or date.today().isoformat()

        resp = requests.get(FEED_URL, timeout=timeout_sec)
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, list):
            raise RuntimeError("Unexpected ThirtyLines payload shape (expected list)")
        raw_payload_json = self._json_compact(payload)
        payload_sha256 = hashlib.sha256(raw_payload_json.encode("utf-8")).hexdigest()
        result.payload_sha256 = payload_sha256

        conn = sqlite3.connect(str(self.db_path))
        try:
            cur = conn.cursor()
            self._ensure_schema(cur)
            fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

            for prop in payload:
                result.properties_seen += 1
                feed_id = self._clean_text(prop.get("id")) or ""
                feed_name = self._clean_text(prop.get("name")) or ""
                ga4_id = self._resolve_ga4_id_from_payload(prop)
                if not ga4_id:
                    result.properties_unmapped += 1
                    result.errors.append(f"Unmapped property: id={feed_id or 'n/a'} name={feed_name}")
                    continue

                result.properties_mapped += 1
                for fp in prop.get("floorplans", []) or []:
                    result.floorplans_seen += 1
                    fp_id = self._clean_text(fp.get("id"))
                    fp_name = self._clean_text(fp.get("name") or fp.get("floorplanName")) or "Unknown"
                    units_now = self._to_int(fp.get("unitsAvailable"))
                    units_30 = self._to_int(fp.get("unitsAvailable30"))
                    units_60 = self._to_int(fp.get("unitsAvailable60"))
                    units_after_60 = self._to_int(fp.get("unitsAvailableAfter60"))
                    available_apartments = fp.get("availableApartments", []) or []

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
                            self._json_compact(fp),
                        ),
                    )
                    result.floorplans_upserted += 1

                    for unit in available_apartments:
                        if not isinstance(unit, dict):
                            continue
                        result.units_seen += 1
                        message = self._clean_text(unit.get("pricingAndSpecialsMessage"))
                        concession_amount = self._parse_concession_amount(message)
                        if message:
                            result.units_with_specials += 1
                        available_date = self._clean_text(unit.get("availableDate"))
                        days_until_available, availability_bucket = self._availability_bucket(snap, available_date)
                        unit_id = self._unit_id(feed_id, unit)

                        cur.execute(
                            """
                            INSERT INTO unit_availability_units (
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
                                moved_out_date,
                                available_date,
                                days_until_available,
                                availability_bucket,
                                pricing_and_specials_message,
                                concession_amount,
                                tour_url,
                                quote_url,
                                application_url,
                                matterport_url,
                                features_json,
                                images_json,
                                videos_json,
                                raw_unit_json,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(property_id, snapshot_date, unit_id) DO UPDATE SET
                                feed_property_id = excluded.feed_property_id,
                                feed_property_name = excluded.feed_property_name,
                                floorplan_id = excluded.floorplan_id,
                                floorplan_name = excluded.floorplan_name,
                                building = excluded.building,
                                apt_number = excluded.apt_number,
                                level = excluded.level,
                                rent_from = excluded.rent_from,
                                rent_to = excluded.rent_to,
                                moved_out_date = excluded.moved_out_date,
                                available_date = excluded.available_date,
                                days_until_available = excluded.days_until_available,
                                availability_bucket = excluded.availability_bucket,
                                pricing_and_specials_message = excluded.pricing_and_specials_message,
                                concession_amount = excluded.concession_amount,
                                tour_url = excluded.tour_url,
                                quote_url = excluded.quote_url,
                                application_url = excluded.application_url,
                                matterport_url = excluded.matterport_url,
                                features_json = excluded.features_json,
                                images_json = excluded.images_json,
                                videos_json = excluded.videos_json,
                                raw_unit_json = excluded.raw_unit_json,
                                updated_at = CURRENT_TIMESTAMP
                            """,
                            (
                                snap,
                                ga4_id,
                                feed_id,
                                feed_name,
                                fp_id,
                                fp_name,
                                unit_id,
                                self._clean_text(unit.get("building")),
                                self._clean_text(unit.get("aptNumber")),
                                self._clean_text(unit.get("level")),
                                self._to_float(unit.get("rentFrom")),
                                self._to_float(unit.get("rentTo")),
                                self._clean_text(unit.get("movedOutDate")),
                                available_date,
                                days_until_available,
                                availability_bucket,
                                message,
                                concession_amount,
                                self._clean_text(unit.get("tourURL")),
                                self._clean_text(unit.get("quoteURL")),
                                self._clean_text(unit.get("applicationURL")),
                                self._clean_text(unit.get("matterportUrl")),
                                self._json_compact(unit.get("features") or []),
                                self._json_compact(unit.get("availableApartmentImages") or []),
                                self._json_compact(unit.get("availableApartmentVideos") or []),
                                self._json_compact(unit),
                            ),
                        )
                        result.unit_snapshots_upserted += 1

            cur.execute(
                """
                INSERT INTO thirtylines_feed_snapshots (
                    snapshot_date,
                    fetched_at,
                    feed_url,
                    payload_sha256,
                    raw_payload_json,
                    properties_seen,
                    properties_mapped,
                    properties_unmapped,
                    floorplans_seen,
                    units_seen,
                    units_with_specials
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_date, payload_sha256) DO UPDATE SET
                    fetched_at = excluded.fetched_at,
                    raw_payload_json = excluded.raw_payload_json,
                    properties_seen = excluded.properties_seen,
                    properties_mapped = excluded.properties_mapped,
                    properties_unmapped = excluded.properties_unmapped,
                    floorplans_seen = excluded.floorplans_seen,
                    units_seen = excluded.units_seen,
                    units_with_specials = excluded.units_with_specials
                """,
                (
                    snap,
                    fetched_at,
                    FEED_URL,
                    payload_sha256,
                    raw_payload_json,
                    result.properties_seen,
                    result.properties_mapped,
                    result.properties_unmapped,
                    result.floorplans_seen,
                    result.units_seen,
                    result.units_with_specials,
                ),
            )
            result.raw_snapshot_id = cur.lastrowid or cur.execute(
                """
                SELECT snapshot_id
                FROM thirtylines_feed_snapshots
                WHERE snapshot_date = ? AND payload_sha256 = ?
                """,
                (snap, payload_sha256),
            ).fetchone()[0]

            conn.commit()
        finally:
            conn.close()

        return result


if __name__ == "__main__":
    collector = ThirtyLinesCollector(Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db"))
    out = collector.ingest()
    print(out)
