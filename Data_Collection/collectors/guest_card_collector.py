#!/usr/bin/env python3
"""
Guest Card Metrics Collector

Parses daily guest card CSV exports from OneDrive and stores metrics in
portfolio_analytics.db, then archives the processed CSV for housekeeping.
"""

from __future__ import annotations

import csv
import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class GuestCardIngestResult:
    files_found: int = 0
    files_processed: int = 0
    files_failed: int = 0
    rows_upserted: int = 0
    errors: Optional[List[str]] = None

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []


class GuestCardCollector:
    """CSV-based collector for Guest Card Metrics exports."""

    def __init__(
        self,
        db_path: Path,
        source_dir: Path = Path(
            "/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports"
        ),
        archive_dir: Optional[Path] = None,
        file_glob: str = "Website Data CSV-*.csv",
    ):
        self.db_path = Path(db_path)
        self.source_dir = Path(source_dir)
        self.archive_dir = archive_dir or (self.source_dir / "Archive")
        self.file_glob = file_glob

    def _ensure_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guest_card_metrics (
                guest_card_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_date DATE NOT NULL,
                days_in_period INTEGER,
                property_code TEXT NOT NULL,
                property_name TEXT,
                gc_this_period INTEGER,
                init_cont_quote INTEGER,
                init_cont_phone INTEGER,
                init_cont_apply INTEGER,
                init_cont_tour INTEGER,
                gc_prev_period INTEGER,
                prev_init_cont_quote INTEGER,
                prev_init_cont_phone INTEGER,
                prev_init_cont_apply INTEGER,
                prev_init_cont_tour INTEGER,
                quotes_this_period INTEGER,
                prev_quotes INTEGER,
                apps_this_period INTEGER,
                prev_apps INTEGER,
                pipe_apps_this_period INTEGER,
                pipe_prev_apps INTEGER,
                ipt_appt_this_period INTEGER,
                prev_ipt_appt INTEGER,
                sgt_appt_this_period INTEGER,
                prev_sgt_appt INTEGER,
                source_file TEXT,
                collection_id INTEGER,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(run_date, property_code)
            )
            """
        )

    def get_pending_files(self) -> List[Path]:
        if not self.source_dir.exists():
            return []
        return sorted(
            [p for p in self.source_dir.glob(self.file_glob) if p.is_file()],
            key=lambda p: p.stat().st_mtime,
        )

    @staticmethod
    def _to_int(value: object) -> int:
        if value is None:
            return 0
        text = str(value).strip()
        if text == "":
            return 0
        try:
            return int(float(text))
        except ValueError:
            return 0

    @staticmethod
    def _clean_headers(row: Dict[str, object]) -> Dict[str, object]:
        return {(k or "").strip(): v for k, v in row.items()}

    def _archive_file(self, file_path: Path) -> None:
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        destination = self.archive_dir / file_path.name
        if destination.exists():
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            destination = self.archive_dir / f"{file_path.stem}_{ts}{file_path.suffix}"
        shutil.move(str(file_path), str(destination))

    def ingest_pending_files(self, collection_id: Optional[int] = None) -> GuestCardIngestResult:
        result = GuestCardIngestResult()
        pending_files = self.get_pending_files()
        result.files_found = len(pending_files)

        if not pending_files:
            return result

        conn = sqlite3.connect(str(self.db_path))
        try:
            self._ensure_table(conn)
            cursor = conn.cursor()

            for csv_file in pending_files:
                try:
                    rows_upserted_file = 0
                    with open(csv_file, "r", encoding="utf-8-sig", newline="") as f:
                        reader = csv.DictReader(f)
                        for raw_row in reader:
                            row = self._clean_headers(raw_row)
                            run_date = (row.get("RunDt") or "").strip()
                            property_code = (row.get("property_cd") or "").strip()
                            property_name = (row.get("property_name") or "").strip()

                            if not run_date or not property_code:
                                continue

                            cursor.execute(
                                """
                                INSERT INTO guest_card_metrics (
                                    run_date, days_in_period, property_code, property_name,
                                    gc_this_period, init_cont_quote, init_cont_phone, init_cont_apply, init_cont_tour,
                                    gc_prev_period, prev_init_cont_quote, prev_init_cont_phone, prev_init_cont_apply, prev_init_cont_tour,
                                    quotes_this_period, prev_quotes, apps_this_period, prev_apps,
                                    pipe_apps_this_period, pipe_prev_apps, ipt_appt_this_period, prev_ipt_appt,
                                    sgt_appt_this_period, prev_sgt_appt, source_file, collection_id, imported_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                ON CONFLICT(run_date, property_code) DO UPDATE SET
                                    days_in_period = excluded.days_in_period,
                                    property_name = excluded.property_name,
                                    gc_this_period = excluded.gc_this_period,
                                    init_cont_quote = excluded.init_cont_quote,
                                    init_cont_phone = excluded.init_cont_phone,
                                    init_cont_apply = excluded.init_cont_apply,
                                    init_cont_tour = excluded.init_cont_tour,
                                    gc_prev_period = excluded.gc_prev_period,
                                    prev_init_cont_quote = excluded.prev_init_cont_quote,
                                    prev_init_cont_phone = excluded.prev_init_cont_phone,
                                    prev_init_cont_apply = excluded.prev_init_cont_apply,
                                    prev_init_cont_tour = excluded.prev_init_cont_tour,
                                    quotes_this_period = excluded.quotes_this_period,
                                    prev_quotes = excluded.prev_quotes,
                                    apps_this_period = excluded.apps_this_period,
                                    prev_apps = excluded.prev_apps,
                                    pipe_apps_this_period = excluded.pipe_apps_this_period,
                                    pipe_prev_apps = excluded.pipe_prev_apps,
                                    ipt_appt_this_period = excluded.ipt_appt_this_period,
                                    prev_ipt_appt = excluded.prev_ipt_appt,
                                    sgt_appt_this_period = excluded.sgt_appt_this_period,
                                    prev_sgt_appt = excluded.prev_sgt_appt,
                                    source_file = excluded.source_file,
                                    collection_id = excluded.collection_id,
                                    imported_at = CURRENT_TIMESTAMP
                                """,
                                (
                                    run_date,
                                    self._to_int(row.get("Days in Period")),
                                    property_code,
                                    property_name,
                                    self._to_int(row.get("GC This Period")),
                                    self._to_int(row.get("Init Cont-Quote")),
                                    self._to_int(row.get("Init Cont- Phone")),
                                    self._to_int(row.get("Init Cont-Apply")),
                                    self._to_int(row.get("Init Cont-Tour")),
                                    self._to_int(row.get("GC Prev Period")),
                                    self._to_int(row.get("Prev Init Cont-Quote")),
                                    self._to_int(row.get("Prev Init Cont- Phone")),
                                    self._to_int(row.get("Prev Init Cont-Apply")),
                                    self._to_int(row.get("Prev Init Cont-Tour")),
                                    self._to_int(row.get("Quotes This Period")),
                                    self._to_int(row.get("Prev Quotes")),
                                    self._to_int(row.get("Apps This Period")),
                                    self._to_int(row.get("Prev Apps")),
                                    self._to_int(row.get("Pipe Apps This Period")),
                                    self._to_int(row.get("Pipe Prev Apps")),
                                    self._to_int(row.get("IPT Appt This Period")),
                                    self._to_int(row.get("Prev IPT Appt")),
                                    self._to_int(row.get("SGT Appt This Period")),
                                    self._to_int(row.get("Prev SGT Appt")),
                                    csv_file.name,
                                    collection_id,
                                ),
                            )
                            rows_upserted_file += 1

                    conn.commit()
                    self._archive_file(csv_file)
                    result.files_processed += 1
                    result.rows_upserted += rows_upserted_file
                except Exception as e:
                    conn.rollback()
                    result.files_failed += 1
                    result.errors.append(f"{csv_file.name}: {e}")
        finally:
            conn.close()

        return result
