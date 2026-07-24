#!/usr/bin/env python3
"""
GBP Reviews to D1 Sync
======================
Mirrors canonical local Google Business Profile review history into remote D1.

This is portfolio-wide source-table backfill for Pond/Captain reputation reads.
Credentials are resolved through the standard Wrangler/Keeper helper.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
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

REVIEW_COLUMNS = [
    "property_id",
    "gbp_location_id",
    "review_id",
    "collection_id",
    "star_rating",
    "star_rating_numeric",
    "comment",
    "reviewer_display_name",
    "reviewer_profile_photo_url",
    "reviewer_is_anonymous",
    "has_reply",
    "reply_comment",
    "reply_update_time",
    "review_create_time",
    "review_update_time",
    "review_name",
    "collected_at",
]

SUMMARY_COLUMNS = [
    "property_id",
    "gbp_location_id",
    "metric_date",
    "collection_id",
    "total_review_count",
    "average_rating",
    "new_reviews_count",
    "collected_at",
]


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_sql(conn: sqlite3.Connection, table: str) -> str:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    if not row or not row["sql"]:
        raise RuntimeError(f"Missing canonical table: {table}")
    return str(row["sql"]).replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1) + ";"


def upsert_statement(table: str, columns: list[str], conflict: str, row: sqlite3.Row) -> str:
    col_sql = ", ".join(columns)
    values = ", ".join(sql_literal(row[col]) for col in columns)
    update_sql = ", ".join(f"{col} = excluded.{col}" for col in columns if col != conflict)
    return (
        f"INSERT INTO {table} ({col_sql}) VALUES ({values}) "
        f"ON CONFLICT({conflict}) DO UPDATE SET {update_sql};"
    )


def build_statements(since_date: str | None = None) -> tuple[list[str], dict[str, object]]:
    conn = connect()
    try:
        where_reviews = ""
        params: tuple[object, ...] = ()
        if since_date:
            where_reviews = "WHERE date(review_create_time) >= date(?)"
            params = (since_date,)

        review_rows = conn.execute(
            f"""
            SELECT {", ".join(REVIEW_COLUMNS)}
            FROM gbp_reviews
            {where_reviews}
            ORDER BY review_create_time, property_id, review_id
            """,
            params,
        ).fetchall()

        summary_where = ""
        summary_params: tuple[object, ...] = ()
        if since_date:
            summary_where = "WHERE date(metric_date) >= date(?)"
            summary_params = (since_date,)
        summary_rows = conn.execute(
            f"""
            SELECT {", ".join(SUMMARY_COLUMNS)}
            FROM gbp_reviews_summary
            {summary_where}
            ORDER BY metric_date, property_id
            """,
            summary_params,
        ).fetchall()

        latest_row = conn.execute(
            "SELECT MAX(date(review_create_time)) AS latest, COUNT(*) AS cnt, COUNT(DISTINCT property_id) AS props FROM gbp_reviews"
        ).fetchone()

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        statements = [
            "PRAGMA foreign_keys = OFF;",
            table_sql(conn, "gbp_reviews"),
            table_sql(conn, "gbp_reviews_summary"),
            "CREATE INDEX IF NOT EXISTS idx_gbp_reviews_property ON gbp_reviews(property_id);",
            "CREATE INDEX IF NOT EXISTS idx_gbp_reviews_create_time ON gbp_reviews(review_create_time);",
            "CREATE INDEX IF NOT EXISTS idx_gbp_reviews_summary_property_date ON gbp_reviews_summary(property_id, metric_date);",
            "DELETE FROM data_freshness WHERE source_key = 'semrush';",
        ]

        statements.extend(upsert_statement("gbp_reviews", REVIEW_COLUMNS, "review_id", row) for row in review_rows)
        statements.extend(
            upsert_statement("gbp_reviews_summary", SUMMARY_COLUMNS, "property_id, metric_date", row)
            for row in summary_rows
        )

        latest = latest_row["latest"] if latest_row else None
        cnt = int(latest_row["cnt"] or 0) if latest_row else 0
        props = int(latest_row["props"] or 0) if latest_row else 0
        latest_sql = sql_literal(latest)
        statements.append(
            "INSERT INTO data_freshness (source_key, source_label, latest_date, row_count, property_count, updated_at) "
            f"VALUES ('gbp_reviews', 'GBP Reviews', {latest_sql}, {cnt}, {props}, '{now}') "
            "ON CONFLICT(source_key) DO UPDATE SET "
            f"source_label = 'GBP Reviews', latest_date = {latest_sql}, row_count = {cnt}, "
            f"property_count = {props}, updated_at = '{now}';"
        )

        return statements, {
            "gbp_reviews": len(review_rows),
            "gbp_reviews_summary": len(summary_rows),
            "canonical_total_rows": cnt,
            "canonical_property_count": props,
            "canonical_latest_date": latest,
            "since_date": since_date,
        }
    finally:
        conn.close()


def chunk_statements(statements: Iterable[str], max_statements: int = 1500, max_bytes: int = 8_000_000) -> list[list[str]]:
    chunks: list[list[str]] = []
    current: list[str] = []
    current_bytes = 0
    for statement in statements:
        size = len(statement.encode("utf-8")) + 1
        if current and (len(current) >= max_statements or current_bytes + size > max_bytes):
            chunks.append(current)
            current = []
            current_bytes = 0
        current.append(statement)
        current_bytes += size
    if current:
        chunks.append(current)
    return chunks


def run_remote_file(sql_file: Path) -> int:
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--file",
        str(sql_file),
        "--config",
        str(WRANGLER_TOML),
    ]
    for attempt in range(1, 4):
        proc = subprocess.Popen(
            cmd,
            cwd=str(API_DIR),
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        try:
            stdout, stderr = proc.communicate(timeout=1800)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            stdout, stderr = proc.communicate(timeout=10)
            stderr = f"Command timed out after 1800s\n{stderr or ''}"
            returncode = 124
        else:
            returncode = proc.returncode

        if stdout:
            print(stdout)
        if stderr:
            print(stderr, file=sys.stderr)
        if returncode == 0:
            return 0

        combined_output = f"{stdout}\n{stderr}"
        transient = any(
            marker in combined_output
            for marker in (
                "Not currently importing anything",
                "fetch failed",
                "connectivity issue",
                "connection reset",
                "timed out",
            )
        )
        if attempt < 3 and transient:
            time.sleep(3 * attempt)
            continue
        return returncode
    return 1


def execute_remote(statements: list[str], start_batch: int = 1) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    prefix = [stmt for stmt in statements if not stmt.lstrip().upper().startswith("INSERT ")]
    data = [stmt for stmt in statements if stmt.lstrip().upper().startswith("INSERT ")]
    batches = chunk_statements(data)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    for index, batch in enumerate(batches, start=1):
        if index < start_batch:
            continue
        lines = (prefix if index == 1 else ["PRAGMA foreign_keys = OFF;"]) + batch
        path = GENERATED_DIR / f"gbp_reviews_to_d1_{timestamp}_batch{index}.sql"
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(json.dumps({"batch": index, "total_batches": len(batches), "statements": len(batch), "sql_file": str(path)}))
        rc = run_remote_file(path)
        if rc != 0:
            raise SystemExit(rc)
        if index < len(batches):
            time.sleep(2)


def resolve_since_date(args: argparse.Namespace) -> str | None:
    if args.since_date:
        date.fromisoformat(args.since_date)
        return args.since_date
    if args.date:
        date.fromisoformat(args.date)
        return args.date
    if args.weeks and args.weeks > 0:
        return (date.today() - timedelta(days=args.weeks * 7)).isoformat()
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Mirror canonical GBP reviews into remote D1.")
    parser.add_argument("--since-date", help="Optional YYYY-MM-DD lower bound for review_create_time/summary metric_date.")
    parser.add_argument("--date", help="Accepted for d1_mirror_sync compatibility; used as the lower-bound date.")
    parser.add_argument("--weeks", type=int, help="Accepted for d1_mirror_sync compatibility; sync rows from the last N weeks.")
    parser.add_argument("--start-batch", type=int, default=1, help="Resume execution from a generated batch number.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    since_date = resolve_since_date(args)
    statements, counts = build_statements(since_date)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out = GENERATED_DIR / "gbp_reviews_to_d1.sql"
    out.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(json.dumps({"sql": str(out), "counts": counts}, indent=2))

    if not args.dry_run:
        execute_remote(statements, start_batch=max(args.start_batch, 1))


if __name__ == "__main__":
    main()
