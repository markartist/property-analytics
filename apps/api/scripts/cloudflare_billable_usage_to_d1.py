#!/usr/bin/env python3
"""
Cloudflare Billable Usage to D1 sync.

Mirrors governed, read-only Cloudflare billable usage source facts from the
canonical local SQLite database into D1 for Watchtower advisory freshness and
FinOps visibility.
"""

from __future__ import annotations

import argparse
import sqlite3
import subprocess
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from wrangler_auth import build_runtime_env, npx_wrangler_prefix

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
REPO_ROOT = API_DIR.parent.parent
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
MIGRATION_SQL = API_DIR / "migrations" / "0061_create_cloudflare_billable_usage_tables.sql"

DAILY_COLUMNS = [
    "charge_period_start",
    "charge_period_end",
    "billing_period_start",
    "billing_period_end",
    "account_id",
    "account_name",
    "service_name",
    "service_family_name",
    "billing_currency",
    "pricing_quantity",
    "consumed_quantity",
    "consumed_unit",
    "contracted_cost",
    "cumulated_pricing_quantity",
    "cumulated_contracted_cost",
    "zone_id",
    "zone_name",
    "collection_id",
    "collection_status",
    "raw_json",
    "collected_at",
    "updated_at",
]

COLLECTION_COLUMNS = [
    "collection_date",
    "account_id",
    "account_name",
    "window_start",
    "window_end",
    "rows_returned",
    "rows_upserted",
    "total_contracted_cost",
    "billing_currency",
    "api_status",
    "credential_source",
    "error_message",
    "collection_id",
    "collected_at",
    "updated_at",
]


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def connect() -> sqlite3.Connection:
    if not CANONICAL_DB.exists():
        raise RuntimeError(f"Canonical DB not found: {CANONICAL_DB}")
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return bool(row)


def resolve_since_date(explicit_date: str | None, weeks: int | None, days: int | None) -> str:
    if explicit_date:
        date.fromisoformat(explicit_date)
        return explicit_date
    if weeks and weeks > 0:
        return (date.today() - timedelta(days=weeks * 7)).isoformat()
    resolved_days = days if days is not None else 90
    return (date.today() - timedelta(days=resolved_days)).isoformat()


def fetch_rows(conn: sqlite3.Connection, table: str, columns: list[str], date_column: str, since_date: str) -> list[sqlite3.Row]:
    if not table_exists(conn, table):
        return []
    column_sql = ", ".join(columns)
    return conn.execute(
        f"""
        SELECT {column_sql}
        FROM {table}
        WHERE date({date_column}) >= date(?)
        ORDER BY {date_column}, account_id
        """,
        (since_date,),
    ).fetchall()


def insert_or_replace(table: str, columns: list[str], rows: Iterable[sqlite3.Row]) -> list[str]:
    col_sql = ", ".join(columns)
    statements: list[str] = []
    for row in rows:
        values = ", ".join(sql_literal(row[column]) for column in columns)
        statements.append(f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({values});")
    return statements


def build_sql(since_date: str) -> tuple[list[str], dict[str, int]]:
    with connect() as conn:
        daily_rows = fetch_rows(
            conn,
            "cloudflare_billable_usage_daily",
            DAILY_COLUMNS,
            "charge_period_start",
            since_date,
        )
        collection_rows = fetch_rows(
            conn,
            "cloudflare_billable_usage_collections",
            COLLECTION_COLUMNS,
            "collection_date",
            since_date,
        )

    statements = [
        "-- Auto-generated: Cloudflare Billable Usage to D1 sync",
        f"-- Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"-- Since: {since_date}",
        "",
        MIGRATION_SQL.read_text(encoding="utf-8").strip(),
        "",
    ]
    statements.extend(insert_or_replace("cloudflare_billable_usage_daily", DAILY_COLUMNS, daily_rows))
    statements.extend(insert_or_replace("cloudflare_billable_usage_collections", COLLECTION_COLUMNS, collection_rows))
    return statements, {
        "cloudflare_billable_usage_daily": len(daily_rows),
        "cloudflare_billable_usage_collections": len(collection_rows),
    }


def execute_sql(sql_file: Path) -> bool:
    env = build_runtime_env()
    for attempt in range(1, 4):
        result = subprocess.run(
            [
                *npx_wrangler_prefix(env),
                "d1",
                "execute",
                "pop-brief-db",
                "--remote",
                "--yes",
                f"--file={sql_file}",
                "--config",
                str(WRANGLER_TOML),
            ],
            capture_output=True,
            text=True,
            timeout=600,
            env=env,
        )
        if result.returncode == 0:
            print("D1 execute succeeded")
            return True

        tail = (result.stderr or result.stdout)[-800:]
        print(f"D1 execute failed on attempt {attempt}/3: {tail}")
        if attempt < 3:
            time.sleep(5)
    print(f"SQL file saved at: {sql_file}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Mirror Cloudflare billable usage source facts to D1.")
    parser.add_argument("--date", help="Sync rows on or after this date, YYYY-MM-DD.")
    parser.add_argument("--weeks", type=int, default=0, help="Sync rows from the last N weeks.")
    parser.add_argument("--days", type=int, help="Sync rows from the last N days; default 90.")
    parser.add_argument("--dry-run", action="store_true", help="Generate SQL without executing it.")
    args = parser.parse_args()

    since_date = resolve_since_date(args.date, args.weeks, args.days)
    statements, counts = build_sql(since_date)

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    sql_file = GENERATED_DIR / f"cloudflare_billable_usage_to_d1_{stamp}.sql"
    sql_file.write_text("\n".join(statements) + "\n", encoding="utf-8")

    print(f"Since: {since_date}")
    print(f"Daily rows: {counts['cloudflare_billable_usage_daily']}")
    print(f"Collection rows: {counts['cloudflare_billable_usage_collections']}")
    print(f"SQL: {sql_file}")

    if args.dry_run:
        return 0
    return 0 if execute_sql(sql_file) else 1


if __name__ == "__main__":
    raise SystemExit(main())
