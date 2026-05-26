#!/usr/bin/env python3
"""Shared BI workbook discovery and ingest helpers for the manual morning drop."""

from __future__ import annotations

import re
import sqlite3
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from openpyxl.utils.exceptions import InvalidFileException

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
BI_DROP_DIR = Path(
    "/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports"
)
REPORTS_DIR = ROOT / "pilot_control_cwv" / "reports"
SCRIPT_DIR = ROOT / "pilot_control_cwv" / "scripts"
BI_FILE_RE = re.compile(r"BI-Metrics-Run(?P<yyyymmdd>\d{8})(?:-[A-Za-z0-9_-]+)?\.xlsx$", re.IGNORECASE)

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from append_bi_snapshot_history import append_history
from bi_database import connect_db, ensure_bi_tables, upsert_bi_normalized_records, upsert_bi_raw_records
from normalize_bi_export_snapshot import extract_bi_export_records, write_csv


@dataclass
class BiIngestResult:
    files_found: int = 0
    files_processed: int = 0
    files_failed: int = 0
    files_skipped: int = 0
    raw_upserted: int = 0
    normalized_upserted: int = 0
    snapshot_dates: list[str] = field(default_factory=list)
    processed_files: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def derive_bi_snapshot_date(path: Path) -> str | None:
    match = BI_FILE_RE.search(path.name)
    if not match:
        return None
    raw = match.group("yyyymmdd")
    return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"


def list_bi_workbooks(input_dir: Path = BI_DROP_DIR) -> list[Path]:
    if not input_dir.exists():
        return []
    return sorted(
        [path for path in input_dir.iterdir() if path.is_file() and BI_FILE_RE.search(path.name)],
        key=lambda path: path.name,
    )


def get_pending_bi_workbooks(db_path: Path = DB_PATH, input_dir: Path = BI_DROP_DIR) -> list[Path]:
    files = list_bi_workbooks(input_dir=input_dir)
    if not files:
        return []

    pending: list[Path] = []
    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.cursor()
        tables_present = cursor.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='bi_raw_snapshot_values' LIMIT 1"
        ).fetchone()
        if not tables_present:
            return files
        for path in files:
            snapshot_date = derive_bi_snapshot_date(path)
            if not snapshot_date:
                pending.append(path)
                continue
            ingested = cursor.execute(
                """
                SELECT 1
                FROM bi_raw_snapshot_values
                WHERE snapshot_date = ?
                  AND source_file = ?
                LIMIT 1
                """,
                (snapshot_date, str(path)),
            ).fetchone()
            if not ingested:
                pending.append(path)
    return pending


def ingest_bi_workbooks(
    db_path: Path = DB_PATH,
    input_dir: Path = BI_DROP_DIR,
    workbook_paths: list[Path] | None = None,
) -> BiIngestResult:
    paths = workbook_paths if workbook_paths is not None else get_pending_bi_workbooks(db_path=db_path, input_dir=input_dir)
    result = BiIngestResult(files_found=len(list_bi_workbooks(input_dir=input_dir)))
    if not paths:
        result.files_skipped = result.files_found
        return result

    conn = connect_db(db_path)
    ensure_bi_tables(conn)
    try:
        for path in paths:
            snapshot_date = derive_bi_snapshot_date(path)
            if not snapshot_date:
                result.files_failed += 1
                result.errors.append(f"Could not derive BI snapshot date from filename: {path.name}")
                continue
            try:
                raw_records, normalized_records = extract_bi_export_records(path, snapshot_date)
                snapshot_output = REPORTS_DIR / f"pilot_bi_snapshot_normalized_{snapshot_date}.csv"
                history_output = REPORTS_DIR / "pilot_bi_metric_history.csv"
                write_csv(normalized_records, snapshot_output)
                append_history(snapshot_output, history_output)
                result.raw_upserted += upsert_bi_raw_records(conn, raw_records)
                result.normalized_upserted += upsert_bi_normalized_records(conn, normalized_records)
                result.files_processed += 1
                result.snapshot_dates.append(snapshot_date)
                result.processed_files.append(str(path))
            except (zipfile.BadZipFile, InvalidFileException) as exc:
                result.files_failed += 1
                result.errors.append(
                    f"{path.name}: unreadable workbook ({str(exc)[:180]}). Replace or remove the file from the shared drop before retrying."
                )
            except Exception as exc:
                result.files_failed += 1
                result.errors.append(f"{path.name}: {str(exc)[:300]}")
    finally:
        conn.close()

    result.files_skipped = max(0, result.files_found - result.files_processed - result.files_failed)
    return result
