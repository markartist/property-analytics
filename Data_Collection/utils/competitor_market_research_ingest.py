#!/usr/bin/env python3
"""Ingest sourced competitor market research packets into the canonical Data Pond."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_SOURCE_DIR = ROOT / "Data_Collection" / "manual_sources" / "competitor_market_research"
MIGRATION_PATH = ROOT / "apps" / "api" / "migrations" / "0043_create_competitor_market_research.sql"


@dataclass
class IngestResult:
    packets_seen: int = 0
    snapshots_upserted: int = 0
    observations_upserted: int = 0
    unmapped_packets: list[str] | None = None

    def __post_init__(self) -> None:
        if self.unmapped_packets is None:
            self.unmapped_packets = []


def stable_id(*parts: Any) -> str:
    raw = "|".join("" if part is None else str(part) for part in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def as_json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def integer(value: Any) -> int | None:
    numeric = num(value)
    return int(numeric) if numeric is not None else None


def text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).split())
    return cleaned or None


def apply_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(MIGRATION_PATH.read_text(encoding="utf-8"))
    conn.commit()


def packet_paths(source_dir: Path) -> list[Path]:
    if source_dir.is_file():
        return [source_dir]
    return sorted(source_dir.glob("*.json"))


def ingest_packet(conn: sqlite3.Connection, path: Path, result: IngestResult) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    result.packets_seen += 1

    identity_value = payload.get("property_id") or payload.get("property_name")
    identity = resolve_property_identity(str(identity_value or ""))
    if identity is None:
        result.unmapped_packets.append(str(path))
        return

    snapshot_date = text(payload.get("snapshot_date"))
    captured_at = text(payload.get("captured_at")) or f"{snapshot_date}T00:00:00-05:00"
    if not snapshot_date:
        raise ValueError(f"Missing snapshot_date in {path}")

    snapshot_id = stable_id("competitor_market_snapshot", snapshot_date, identity.property_code, path.name)
    conn.execute(
        """
        INSERT INTO competitor_market_research_snapshots (
          id, snapshot_date, captured_at, property_id, community_id, property_name,
          market_name, research_scope, source_file, source_author, notes, evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date, property_id, source_file) DO UPDATE SET
          captured_at=excluded.captured_at,
          community_id=excluded.community_id,
          property_name=excluded.property_name,
          market_name=excluded.market_name,
          research_scope=excluded.research_scope,
          source_author=excluded.source_author,
          notes=excluded.notes,
          evidence_json=excluded.evidence_json,
          updated_at=datetime('now')
        """,
        (
            snapshot_id,
            snapshot_date,
            captured_at,
            identity.property_code,
            identity.community_id,
            identity.property_name,
            text(payload.get("market_name")),
            text(payload.get("research_scope")) or "competitive_market_slice",
            str(path),
            text(payload.get("source_author")),
            text(payload.get("notes")),
            as_json(payload.get("evidence")),
        ),
    )
    result.snapshots_upserted += 1
    conn.execute(
        "DELETE FROM competitor_market_research_observations WHERE snapshot_id = ?",
        (snapshot_id,),
    )

    for row in payload.get("observations", []):
        raw_claim = text(row.get("raw_claim"))
        source_url = text(row.get("source_url"))
        competitor_name = text(row.get("competitor_name"))
        category = text(row.get("evidence_category"))
        if not raw_claim or not source_url or not competitor_name or not category:
            raise ValueError(f"Observation missing required fields in {path}: {row}")
        observation_id = stable_id(
            "competitor_market_observation",
            snapshot_id,
            competitor_name,
            source_url,
            category,
            raw_claim,
        )
        conn.execute(
            """
            INSERT INTO competitor_market_research_observations (
              id, snapshot_id, snapshot_date, captured_at, property_id, community_id,
              subject_property_name, competitor_name, competitor_url, source_name,
              source_url, source_type, evidence_category, captured_date, floorplan_name,
              bedroom_count, bathroom_count, sqft_min, sqft_max, rent_min, rent_max,
              availability_status, special_text, rating, review_count, package_indicator,
              media_indicators_json, usp_text, raw_claim, confidence, source_freshness_label,
              evidence_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(snapshot_id, competitor_name, source_url, evidence_category, raw_claim) DO UPDATE SET
              captured_at=excluded.captured_at,
              competitor_url=excluded.competitor_url,
              source_name=excluded.source_name,
              source_type=excluded.source_type,
              captured_date=excluded.captured_date,
              floorplan_name=excluded.floorplan_name,
              bedroom_count=excluded.bedroom_count,
              bathroom_count=excluded.bathroom_count,
              sqft_min=excluded.sqft_min,
              sqft_max=excluded.sqft_max,
              rent_min=excluded.rent_min,
              rent_max=excluded.rent_max,
              availability_status=excluded.availability_status,
              special_text=excluded.special_text,
              rating=excluded.rating,
              review_count=excluded.review_count,
              package_indicator=excluded.package_indicator,
              media_indicators_json=excluded.media_indicators_json,
              usp_text=excluded.usp_text,
              confidence=excluded.confidence,
              source_freshness_label=excluded.source_freshness_label,
              evidence_json=excluded.evidence_json,
              updated_at=datetime('now')
            """,
            (
                observation_id,
                snapshot_id,
                snapshot_date,
                captured_at,
                identity.property_code,
                identity.community_id,
                identity.property_name,
                competitor_name,
                text(row.get("competitor_url")),
                text(row.get("source_name")) or "unknown",
                source_url,
                text(row.get("source_type")) or "web",
                category,
                text(row.get("captured_date")) or snapshot_date,
                text(row.get("floorplan_name")),
                num(row.get("bedroom_count")),
                num(row.get("bathroom_count")),
                integer(row.get("sqft_min")),
                integer(row.get("sqft_max")),
                num(row.get("rent_min")),
                num(row.get("rent_max")),
                text(row.get("availability_status")),
                text(row.get("special_text")),
                num(row.get("rating")),
                integer(row.get("review_count")),
                text(row.get("package_indicator")),
                as_json(row.get("media_indicators")),
                text(row.get("usp_text")),
                raw_claim,
                text(row.get("confidence")) or "directional",
                text(row.get("source_freshness_label")),
                as_json(row.get("evidence")),
            ),
        )
        result.observations_upserted += 1


def ingest(source_dir: Path, db_path: Path) -> IngestResult:
    result = IngestResult()
    conn = sqlite3.connect(db_path)
    try:
        apply_schema(conn)
        for path in packet_paths(source_dir):
            ingest_packet(conn, path, result)
        conn.commit()
    finally:
        conn.close()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--db", type=Path, default=DB_PATH)
    args = parser.parse_args()
    result = ingest(args.source, args.db)
    print(
        json.dumps(
            {
                "packets_seen": result.packets_seen,
                "snapshots_upserted": result.snapshots_upserted,
                "observations_upserted": result.observations_upserted,
                "unmapped_packets": result.unmapped_packets,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
