#!/usr/bin/env python3
"""Ingest the BI Available Units With Low Inquiries report."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from pypdf import PdfReader

try:
    from Data_Collection.utils.property_identity import resolve_property_identity
except ModuleNotFoundError:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from Data_Collection.utils.property_identity import resolve_property_identity

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DROP_DIR = Path("/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports")
DEFAULT_SOURCE_FILE = DROP_DIR / "Available Units With Low Inquiries.pdf"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0029_create_available_unit_interest_metrics.sql"

METRIC_COLUMNS = [
    "unit_count",
    "available_units",
    "pct_available_units_by_bedroom",
    "vacant_available_units",
    "notice_available_units",
    "pct_available",
    "t7_guest_cards_vol",
    "t7_guest_cards_per_available_unit",
    "t7_guest_cards_delta_pct",
    "pct_t7_guest_cards_by_bedrooms",
    "t30_guest_cards_vol",
    "t30_guest_cards_per_available_unit",
    "t30_guest_cards_delta_pct",
    "pct_t30_guest_cards_by_bedrooms",
    "t7_prospect_quote_vol",
    "t7_quote_delta_pct",
    "t30_prospect_quote_vol",
    "t30_quote_delta_pct",
]

TABLE_COLUMNS = [
    "id",
    "report_date",
    "location",
    "current_level",
    "property_id",
    "community_id",
    *METRIC_COLUMNS,
    "source_file",
    "evidence_json",
]


@dataclass
class AvailableUnitInterestIngestResult:
    report_date: str | None = None
    rows_found: int = 0
    rows_upserted: int = 0
    source_file: str | None = None
    property_rows: list[str] = field(default_factory=list)


def parse_pdf_creation_date(raw: str | None) -> str | None:
    if not raw:
        return None
    match = re.search(r"D:(\d{4})(\d{2})(\d{2})", raw)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None


def parse_number(value: str | None) -> float | None:
    if value is None:
        return None
    text = value.strip().replace(",", "").replace("%", "")
    if not text:
        return None
    return float(text)


def parse_int(value: str | None) -> int | None:
    parsed = parse_number(value)
    if parsed is None:
        return None
    return int(round(parsed))


def parse_pct(value: str | None) -> float | None:
    parsed = parse_number(value)
    if parsed is None:
        return None
    return parsed / 100


def clean_row_line(line: str) -> str:
    return (
        line.replace("\uf166", " ")
        .replace("\uf164", " ")
        .replace("\uf165", " ")
        .replace("\xa0", " ")
        .strip()
    )


def split_row(line: str) -> list[str]:
    return [part.strip() for part in re.split(r"\s{2,}", clean_row_line(line)) if part.strip()]


def row_id(report_date: str, location: str, current_level: str, source_file: Path) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", f"{location}_{current_level}".lower()).strip("_")
    source_slug = re.sub(r"[^a-z0-9]+", "_", source_file.stem.lower()).strip("_")
    return f"available_interest_{report_date}_{slug}_{source_slug}"


def map_property(location: str, current_level: str) -> tuple[str | None, str | None]:
    if current_level.lower() != "property":
        return None, None
    identity = resolve_property_identity(location)
    if not identity:
        return None, None
    return identity.marketing_bi_property_id, identity.community_id


def parse_metric_parts(parts: list[str]) -> dict[str, Any] | None:
    if len(parts) < 18:
        return None
    location, current_level = parts[0], parts[1]
    values = parts[2:]

    if len(values) == 16:
        values = [
            *values[:9],
            None,
            *values[9:12],
            None,
            *values[12:],
        ]
    if len(values) != len(METRIC_COLUMNS):
        return None

    int_fields = {
        "unit_count",
        "available_units",
        "vacant_available_units",
        "notice_available_units",
        "t7_guest_cards_vol",
        "t30_guest_cards_vol",
        "t7_prospect_quote_vol",
        "t30_prospect_quote_vol",
    }
    pct_fields = {
        "pct_available_units_by_bedroom",
        "pct_available",
        "t7_guest_cards_delta_pct",
        "pct_t7_guest_cards_by_bedrooms",
        "t30_guest_cards_delta_pct",
        "pct_t30_guest_cards_by_bedrooms",
        "t7_quote_delta_pct",
        "t30_quote_delta_pct",
    }
    metrics: dict[str, Any] = {"location": location, "current_level": current_level}
    for column, value in zip(METRIC_COLUMNS, values):
        if column in int_fields:
            metrics[column] = parse_int(value)
        elif column in pct_fields:
            metrics[column] = parse_pct(value)
        else:
            metrics[column] = parse_number(value)
    return metrics


def parse_pdf(path: Path) -> tuple[str, list[dict[str, Any]]]:
    reader = PdfReader(str(path))
    report_date = parse_pdf_creation_date(str(reader.metadata.get("/CreationDate") if reader.metadata else "")) or datetime.now().date().isoformat()
    rows: list[dict[str, Any]] = []
    for page in reader.pages:
        text = page.extract_text(extraction_mode="layout") or ""
        for line in text.splitlines():
            parts = split_row(line)
            if len(parts) < 18:
                continue
            if parts[1].lower() not in {"region", "property", "total"}:
                continue
            parsed = parse_metric_parts(parts)
            if parsed:
                rows.append(parsed)
    return report_date, rows


def ensure_table(conn: sqlite3.Connection) -> None:
    conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))


def upsert_rows(conn: sqlite3.Connection, report_date: str, source_file: Path, rows: list[dict[str, Any]]) -> int:
    ensure_table(conn)
    placeholders = ", ".join("?" for _ in TABLE_COLUMNS)
    updates = ", ".join(f"{column}=excluded.{column}" for column in TABLE_COLUMNS if column != "id")
    payloads = []
    for row in rows:
        property_id, community_id = map_property(row["location"], row["current_level"])
        evidence = {"raw_location": row["location"], "source": "Available Units With Low Inquiries"}
        payload = {
            "id": row_id(report_date, row["location"], row["current_level"], source_file),
            "report_date": report_date,
            "location": row["location"],
            "current_level": row["current_level"],
            "property_id": property_id,
            "community_id": community_id,
            "source_file": str(source_file.resolve()),
            "evidence_json": json.dumps(evidence, sort_keys=True),
        }
        for column in METRIC_COLUMNS:
            payload[column] = row.get(column)
        payloads.append([payload.get(column) for column in TABLE_COLUMNS])
    conn.executemany(
        f"""
        INSERT INTO available_unit_interest_metrics ({", ".join(TABLE_COLUMNS)})
        VALUES ({placeholders})
        ON CONFLICT(report_date, location, current_level, source_file)
        DO UPDATE SET {updates}, updated_at=datetime('now')
        """,
        payloads,
    )
    conn.commit()
    return len(payloads)


def ingest_available_unit_interest_pdf(path: Path = DEFAULT_SOURCE_FILE, db_path: Path = DB_PATH) -> AvailableUnitInterestIngestResult:
    report_date, rows = parse_pdf(path)
    with sqlite3.connect(str(db_path)) as conn:
        rows_upserted = upsert_rows(conn, report_date, path, rows)
    property_rows = [row["location"] for row in rows if row["current_level"].lower() == "property"]
    return AvailableUnitInterestIngestResult(
        report_date=report_date,
        rows_found=len(rows),
        rows_upserted=rows_upserted,
        source_file=str(path),
        property_rows=property_rows,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Available Units With Low Inquiries PDF into the Pond.")
    parser.add_argument("--source-file", default=str(DEFAULT_SOURCE_FILE))
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source = Path(args.source_file).expanduser().resolve()
    report_date, rows = parse_pdf(source)
    result = AvailableUnitInterestIngestResult(
        report_date=report_date,
        rows_found=len(rows),
        rows_upserted=0,
        source_file=str(source),
        property_rows=[row["location"] for row in rows if row["current_level"].lower() == "property"],
    )
    if not args.dry_run:
        with sqlite3.connect(str(Path(args.db).expanduser().resolve())) as conn:
            result.rows_upserted = upsert_rows(conn, report_date, source, rows)
    print(json.dumps(result.__dict__, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
