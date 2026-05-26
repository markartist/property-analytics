#!/usr/bin/env python3
"""Shared operating-metrics discovery and ingest helpers for the morning drop."""

from __future__ import annotations

import re
import sqlite3
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OPERATING_DROP_DIR = Path(
    "/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports"
)
OPERATING_FILE_RE = re.compile(
    r"(?=.*(?:operating|operations|occupancy|leased|lease|concession))(?=.*(?:metric|metrics|snapshot|report|export|AR4PB|Pointe)).*\.(?:csv|xlsx|xlsm)$",
    re.IGNORECASE,
)
OPERATING_MISSING_FILE_MESSAGE = "No official operating metrics file received for AR4PB."
OPERATING_RECOMMENDED_FILENAME = "Property-Operating-Metrics-AR4PB-YYYYMMDD.csv"
OPERATING_REQUIRED_COLUMNS = (
    "Property Code",
    "Report Date",
    "Occupancy",
    "Leased %",
    "Total Units",
    "Leases",
    "Cancellations",
    "Booked Concession Dollars",
)

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
API_SCRIPTS_DIR = ROOT / "apps" / "api" / "scripts"
if str(API_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(API_SCRIPTS_DIR))

from apps.api.scripts.operating_metrics_to_d1 import (  # noqa: E402
    DEFAULT_PROPERTY_KEY,
    DEFAULT_SOURCE_SYSTEM,
    load_metrics,
    write_local,
)


@dataclass
class OperatingMetricsIngestResult:
    files_found: int = 0
    files_processed: int = 0
    files_failed: int = 0
    files_skipped: int = 0
    rows_upserted: int = 0
    metric_dates: list[str] = field(default_factory=list)
    processed_files: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class OperatingMetricsArgs:
    source_file: str
    sheet: str | None = None
    property_key: str = DEFAULT_PROPERTY_KEY
    property_code: str | None = None
    property_name: str | None = None
    community_id: str | None = None
    source_system: str = DEFAULT_SOURCE_SYSTEM


def list_operating_metric_files(input_dir: Path = OPERATING_DROP_DIR) -> list[Path]:
    if not input_dir.exists():
        return []
    return sorted(
        [path for path in input_dir.iterdir() if path.is_file() and OPERATING_FILE_RE.search(path.name)],
        key=lambda path: path.name,
    )


def get_pending_operating_metric_files(db_path: Path = DB_PATH, input_dir: Path = OPERATING_DROP_DIR) -> list[Path]:
    files = list_operating_metric_files(input_dir=input_dir)
    if not files:
        return []

    pending: list[Path] = []
    with sqlite3.connect(str(db_path)) as conn:
        table_present = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='property_operating_metrics' LIMIT 1"
        ).fetchone()
        if not table_present:
            return files
        for path in files:
            ingested = conn.execute(
                """
                SELECT 1
                FROM property_operating_metrics
                WHERE source_file = ?
                LIMIT 1
                """,
                (str(path.resolve()),),
            ).fetchone()
            if not ingested:
                pending.append(path)
    return pending


def ingest_operating_metric_files(
    db_path: Path = DB_PATH,
    input_dir: Path = OPERATING_DROP_DIR,
    file_paths: list[Path] | None = None,
    property_key: str = DEFAULT_PROPERTY_KEY,
    property_code: str | None = None,
    property_name: str | None = None,
    community_id: str | None = None,
    source_system: str = DEFAULT_SOURCE_SYSTEM,
) -> OperatingMetricsIngestResult:
    paths = (
        file_paths
        if file_paths is not None
        else get_pending_operating_metric_files(db_path=db_path, input_dir=input_dir)
    )
    result = OperatingMetricsIngestResult(files_found=len(list_operating_metric_files(input_dir=input_dir)))
    if not paths:
        result.files_skipped = result.files_found
        return result

    for path in paths:
        try:
            args = OperatingMetricsArgs(
                source_file=str(path),
                property_key=property_key,
                property_code=property_code,
                property_name=property_name,
                community_id=community_id,
                source_system=source_system,
            )
            metrics = load_metrics(args)
            write_local(metrics, db_path)
            result.rows_upserted += len(metrics)
            result.files_processed += 1
            result.processed_files.append(str(path))
            for metric in metrics:
                metric_date = str(metric.get("metric_date") or "")
                if metric_date and metric_date not in result.metric_dates:
                    result.metric_dates.append(metric_date)
        except Exception as exc:
            result.files_failed += 1
            result.errors.append(f"{path.name}: {str(exc)[:300]}")

    result.metric_dates.sort()
    result.files_skipped = max(0, result.files_found - result.files_processed - result.files_failed)
    return result
