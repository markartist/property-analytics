"""
Lightweight schema migration runner for portfolio_analytics.db.
Keeps a schema_migrations table with applied IDs.
"""

import sqlite3
from datetime import datetime
from pathlib import Path


def _ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
    """)


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def _apply_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if not _column_exists(conn, table, column):
        conn.execute(ddl)


def apply_migrations(db_path: Path) -> None:
    conn = sqlite3.connect(str(db_path))
    _ensure_table(conn)
    conn.commit()

    migrations = [
        ("001_add_notes_to_data_collections",
         lambda c: _apply_if_missing(
             c, "data_collections", "notes",
             "ALTER TABLE data_collections ADD COLUMN notes TEXT"
         )),
        ("002_add_pageviews_to_ga4_daily_metrics",
         lambda c: _apply_if_missing(
             c, "ga4_daily_metrics", "pageviews",
             "ALTER TABLE ga4_daily_metrics ADD COLUMN pageviews INTEGER DEFAULT 0"
         )),
        ("003_add_new_users_to_ga4_daily_metrics",
         lambda c: _apply_if_missing(
             c, "ga4_daily_metrics", "new_users",
             "ALTER TABLE ga4_daily_metrics ADD COLUMN new_users INTEGER DEFAULT 0"
         )),
    ]

    cur = conn.execute("SELECT id FROM schema_migrations")
    applied = {row[0] for row in cur.fetchall()}

    for mid, fn in migrations:
        if mid in applied:
            continue
        fn(conn)
        conn.execute(
            "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
            (mid, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.commit()

    conn.close()
