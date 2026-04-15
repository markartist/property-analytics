from __future__ import annotations

import sqlite3


def ensure_measurement_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS measurement_daily_raw_values (
            measurement_raw_id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date DATE NOT NULL,
            source_file TEXT NOT NULL,
            source_sheet TEXT NOT NULL,
            source_row INTEGER NOT NULL,
            source_column INTEGER NOT NULL,
            property_name_raw TEXT NOT NULL,
            row_role TEXT NOT NULL,
            section_label TEXT,
            header_raw TEXT NOT NULL,
            value_raw_text TEXT,
            value_numeric REAL,
            ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(snapshot_date, source_file, source_sheet, source_row, source_column)
        );

        CREATE INDEX IF NOT EXISTS idx_measurement_raw_snapshot_date
            ON measurement_daily_raw_values(snapshot_date DESC);

        CREATE INDEX IF NOT EXISTS idx_measurement_raw_property
            ON measurement_daily_raw_values(property_name_raw, snapshot_date DESC);

        CREATE TABLE IF NOT EXISTS measurement_daily_metrics (
            measurement_metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date DATE NOT NULL,
            source_file TEXT NOT NULL,
            source_sheet TEXT NOT NULL,
            property_name_raw TEXT NOT NULL,
            property_name TEXT,
            row_role TEXT NOT NULL,
            metric_key TEXT NOT NULL,
            metric_label TEXT NOT NULL,
            value_type TEXT NOT NULL,
            value_numeric REAL,
            value_text TEXT,
            header_raw TEXT NOT NULL,
            ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(snapshot_date, source_file, source_sheet, property_name_raw, metric_key)
        );

        CREATE INDEX IF NOT EXISTS idx_measurement_metrics_snapshot_date
            ON measurement_daily_metrics(snapshot_date DESC);

        CREATE INDEX IF NOT EXISTS idx_measurement_metrics_lookup
            ON measurement_daily_metrics(property_name, metric_key, snapshot_date DESC);
        """
    )
    conn.commit()


def replace_measurement_source_rows(conn: sqlite3.Connection, source_file: str) -> None:
    conn.execute(
        "DELETE FROM measurement_daily_raw_values WHERE source_file = ?",
        (source_file,),
    )
    conn.execute(
        "DELETE FROM measurement_daily_metrics WHERE source_file = ?",
        (source_file,),
    )
    conn.commit()


def upsert_measurement_raw_records(conn: sqlite3.Connection, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    cur.executemany(
        """
        INSERT INTO measurement_daily_raw_values (
            snapshot_date, source_file, source_sheet, source_row, source_column,
            property_name_raw, row_role, section_label, header_raw, value_raw_text, value_numeric
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date, source_file, source_sheet, source_row, source_column)
        DO UPDATE SET
            property_name_raw = excluded.property_name_raw,
            row_role = excluded.row_role,
            section_label = excluded.section_label,
            header_raw = excluded.header_raw,
            value_raw_text = excluded.value_raw_text,
            value_numeric = excluded.value_numeric,
            ingested_at = CURRENT_TIMESTAMP
        """,
        [
            (
                row["snapshot_date"],
                row["source_file"],
                row["source_sheet"],
                row["source_row"],
                row["source_column"],
                row["property_name_raw"],
                row["row_role"],
                row.get("section_label"),
                row["header_raw"],
                row.get("value_raw_text"),
                row.get("value_numeric"),
            )
            for row in records
        ],
    )
    conn.commit()
    return cur.rowcount


def upsert_measurement_metric_records(conn: sqlite3.Connection, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    cur.executemany(
        """
        INSERT INTO measurement_daily_metrics (
            snapshot_date, source_file, source_sheet, property_name_raw, property_name,
            row_role, metric_key, metric_label, value_type, value_numeric, value_text, header_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date, source_file, source_sheet, property_name_raw, metric_key)
        DO UPDATE SET
            property_name = excluded.property_name,
            row_role = excluded.row_role,
            metric_label = excluded.metric_label,
            value_type = excluded.value_type,
            value_numeric = excluded.value_numeric,
            value_text = excluded.value_text,
            header_raw = excluded.header_raw,
            ingested_at = CURRENT_TIMESTAMP
        """,
        [
            (
                row["snapshot_date"],
                row["source_file"],
                row["source_sheet"],
                row["property_name_raw"],
                row.get("property_name"),
                row["row_role"],
                row["metric_key"],
                row["metric_label"],
                row["value_type"],
                row.get("value_numeric"),
                row.get("value_text"),
                row["header_raw"],
            )
            for row in records
        ],
    )
    conn.commit()
    return cur.rowcount
