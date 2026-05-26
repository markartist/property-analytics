from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")


def connect_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def ensure_bi_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS bi_raw_snapshot_values (
            raw_id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date DATE NOT NULL,
            source_file TEXT NOT NULL,
            source_sheet TEXT NOT NULL,
            source_row INTEGER NOT NULL,
            source_column INTEGER NOT NULL,
            header_raw TEXT NOT NULL,
            property_name_raw TEXT NOT NULL,
            conv_source_raw TEXT NOT NULL,
            value_raw REAL NOT NULL,
            ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(snapshot_date, source_file, source_sheet, source_row, source_column)
        );

        CREATE INDEX IF NOT EXISTS idx_bi_raw_snapshot_date
            ON bi_raw_snapshot_values(snapshot_date DESC);

        CREATE INDEX IF NOT EXISTS idx_bi_raw_source_file
            ON bi_raw_snapshot_values(source_file);

        CREATE TABLE IF NOT EXISTS bi_normalized_metrics (
            bi_metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date DATE NOT NULL,
            property_name TEXT NOT NULL,
            property_id TEXT,
            role TEXT,
            sister_property_name TEXT,
            conv_source TEXT NOT NULL,
            metric_code TEXT NOT NULL,
            window TEXT NOT NULL,
            comparison_type TEXT NOT NULL,
            value REAL NOT NULL,
            source_file TEXT NOT NULL,
            source_sheet TEXT NOT NULL,
            source_row INTEGER NOT NULL,
            source_column INTEGER NOT NULL,
            header_raw TEXT NOT NULL,
            ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(snapshot_date, property_name, conv_source, metric_code, window, comparison_type, source_file, source_row, source_column)
        );

        CREATE INDEX IF NOT EXISTS idx_bi_normalized_snapshot_date
            ON bi_normalized_metrics(snapshot_date DESC);

        CREATE INDEX IF NOT EXISTS idx_bi_normalized_lookup
            ON bi_normalized_metrics(property_name, conv_source, metric_code, window, comparison_type, snapshot_date DESC);
        """
    )
    conn.commit()


def upsert_bi_raw_records(conn: sqlite3.Connection, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    cur.executemany(
        """
        INSERT INTO bi_raw_snapshot_values (
            snapshot_date, source_file, source_sheet, source_row, source_column,
            header_raw, property_name_raw, conv_source_raw, value_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date, source_file, source_sheet, source_row, source_column)
        DO UPDATE SET
            header_raw = excluded.header_raw,
            property_name_raw = excluded.property_name_raw,
            conv_source_raw = excluded.conv_source_raw,
            value_raw = excluded.value_raw,
            ingested_at = CURRENT_TIMESTAMP
        """,
        [
            (
                row["snapshot_date"],
                row["source_file"],
                row["source_sheet"],
                row["source_row"],
                row["source_column"],
                row["header_raw"],
                row["property_name_raw"],
                row["conv_source_raw"],
                row["value_raw"],
            )
            for row in records
        ],
    )
    conn.commit()
    return cur.rowcount


def upsert_bi_normalized_records(conn: sqlite3.Connection, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    cur.executemany(
        """
        INSERT INTO bi_normalized_metrics (
            snapshot_date, property_name, property_id, role, sister_property_name,
            conv_source, metric_code, window, comparison_type, value,
            source_file, source_sheet, source_row, source_column, header_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date, property_name, conv_source, metric_code, window, comparison_type, source_file, source_row, source_column)
        DO UPDATE SET
            property_id = excluded.property_id,
            role = excluded.role,
            sister_property_name = excluded.sister_property_name,
            value = excluded.value,
            header_raw = excluded.header_raw,
            ingested_at = CURRENT_TIMESTAMP
        """,
        [
            (
                row["snapshot_date"],
                row["property_name"],
                row["property_id"],
                row["role"],
                row["sister_property_name"],
                row["conv_source"],
                row["metric_code"],
                row["window"],
                row["comparison_type"],
                row["value"],
                row["source_file"],
                row["source_sheet"],
                row["source_row"],
                row["source_column"],
                row["header_raw"],
            )
            for row in records
        ],
    )
    conn.commit()
    return cur.rowcount
