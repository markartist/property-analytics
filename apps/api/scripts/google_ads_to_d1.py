#!/usr/bin/env python3
"""
Google Ads to D1 Sync
=====================
Mirrors canonical local Google Ads campaign and keyword source rows into remote D1.

This preserves source-level Ads drill-down data for Pond/Captain/report reads.
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

CAMPAIGN_COLUMNS = [
    "property_id",
    "customer_id",
    "campaign_id",
    "campaign_name",
    "campaign_status",
    "campaign_type",
    "metric_date",
    "impressions",
    "clicks",
    "conversions",
    "cost_micros",
    "ctr",
    "average_cpc",
    "cost_per_conversion",
    "conversion_rate",
    "average_cpm",
    "impression_share",
    "search_impression_share",
    "collected_at",
]

KEYWORD_COLUMNS = [
    "property_id",
    "customer_id",
    "campaign_id",
    "ad_group_id",
    "keyword_id",
    "keyword_text",
    "match_type",
    "keyword_status",
    "metric_date",
    "impressions",
    "clicks",
    "conversions",
    "cost_micros",
    "ctr",
    "average_cpc",
    "cost_per_conversion",
    "conversion_rate",
    "quality_score",
    "average_position",
    "top_impression_percentage",
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


def upsert_statement(table: str, columns: list[str], conflict_columns: list[str], row: sqlite3.Row) -> str:
    col_sql = ", ".join(columns)
    values = ", ".join(sql_literal(row[col]) for col in columns)
    conflict_sql = ", ".join(conflict_columns)
    update_sql = ", ".join(f"{col} = excluded.{col}" for col in columns if col not in conflict_columns)
    return (
        f"INSERT INTO {table} ({col_sql}) VALUES ({values}) "
        f"ON CONFLICT({conflict_sql}) DO UPDATE SET {update_sql};"
    )


def rows_for_table(conn: sqlite3.Connection, table: str, columns: list[str], since_date: str | None) -> list[sqlite3.Row]:
    where = ""
    params: tuple[object, ...] = ()
    if since_date:
        where = "WHERE date(metric_date) >= date(?)"
        params = (since_date,)
    return conn.execute(
        f"""
        SELECT {", ".join(columns)}
        FROM {table}
        {where}
        ORDER BY metric_date, property_id
        """,
        params,
    ).fetchall()


def build_statements(since_date: str | None = None) -> tuple[list[str], dict[str, object]]:
    conn = connect()
    try:
        campaign_rows = rows_for_table(conn, "google_ads_campaigns", CAMPAIGN_COLUMNS, since_date)
        keyword_rows = rows_for_table(conn, "google_ads_keywords", KEYWORD_COLUMNS, since_date)
        campaign_latest = conn.execute(
            "SELECT MAX(date(metric_date)) AS latest, COUNT(*) AS cnt, COUNT(DISTINCT property_id) AS props FROM google_ads_campaigns"
        ).fetchone()
        keyword_latest = conn.execute(
            "SELECT MAX(date(metric_date)) AS latest, COUNT(*) AS cnt, COUNT(DISTINCT property_id) AS props FROM google_ads_keywords"
        ).fetchone()
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        statements = [
            "PRAGMA foreign_keys = OFF;",
            table_sql(conn, "google_ads_campaigns"),
            table_sql(conn, "google_ads_keywords"),
            "CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_property_date ON google_ads_campaigns(property_id, metric_date);",
            "CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_customer ON google_ads_campaigns(customer_id);",
            "CREATE INDEX IF NOT EXISTS idx_google_ads_keywords_property_date ON google_ads_keywords(property_id, metric_date);",
            "CREATE INDEX IF NOT EXISTS idx_google_ads_keywords_text ON google_ads_keywords(keyword_text);",
        ]

        statements.extend(
            upsert_statement(
                "google_ads_campaigns",
                CAMPAIGN_COLUMNS,
                ["property_id", "campaign_id", "metric_date"],
                row,
            )
            for row in campaign_rows
        )
        statements.extend(
            upsert_statement(
                "google_ads_keywords",
                KEYWORD_COLUMNS,
                ["property_id", "keyword_id", "metric_date"],
                row,
            )
            for row in keyword_rows
        )

        for key, label, row in (
            ("google_ads", "Google Ads", campaign_latest),
            ("ads_keywords", "Google Ads Keywords", keyword_latest),
        ):
            latest = row["latest"] if row else None
            cnt = int(row["cnt"] or 0) if row else 0
            props = int(row["props"] or 0) if row else 0
            latest_sql = sql_literal(latest)
            statements.append(
                "INSERT INTO data_freshness (source_key, source_label, latest_date, row_count, property_count, updated_at) "
                f"VALUES ({sql_literal(key)}, {sql_literal(label)}, {latest_sql}, {cnt}, {props}, {sql_literal(now)}) "
                "ON CONFLICT(source_key) DO UPDATE SET "
                f"source_label = {sql_literal(label)}, latest_date = {latest_sql}, row_count = {cnt}, "
                f"property_count = {props}, updated_at = {sql_literal(now)};"
            )

        return statements, {
            "google_ads_campaigns": len(campaign_rows),
            "google_ads_keywords": len(keyword_rows),
            "canonical_campaign_rows": int(campaign_latest["cnt"] or 0) if campaign_latest else 0,
            "canonical_keyword_rows": int(keyword_latest["cnt"] or 0) if keyword_latest else 0,
            "canonical_campaign_properties": int(campaign_latest["props"] or 0) if campaign_latest else 0,
            "canonical_keyword_properties": int(keyword_latest["props"] or 0) if keyword_latest else 0,
            "canonical_campaign_latest_date": campaign_latest["latest"] if campaign_latest else None,
            "canonical_keyword_latest_date": keyword_latest["latest"] if keyword_latest else None,
            "since_date": since_date,
        }
    finally:
        conn.close()


def resolve_since_date(
    explicit_since_date: str | None,
    target_date: str | None,
    weeks: int | None,
) -> str | None:
    """Resolve the lower-bound sync date from the supported CLI shapes."""
    if explicit_since_date:
        date.fromisoformat(explicit_since_date)
        return explicit_since_date
    if target_date:
        date.fromisoformat(target_date)
        return target_date
    if weeks and weeks > 0:
        return (date.today() - timedelta(days=weeks * 7)).isoformat()
    return None


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
            returncode = proc.returncode
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            stdout, stderr = proc.communicate(timeout=10)
            stderr = f"Command timed out after 1800s\n{stderr or ''}"
            returncode = 124

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
        path = GENERATED_DIR / f"google_ads_to_d1_{timestamp}_batch{index}.sql"
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(json.dumps({"batch": index, "total_batches": len(batches), "statements": len(batch), "sql_file": str(path)}))
        rc = run_remote_file(path)
        if rc != 0:
            raise SystemExit(rc)
        if index < len(batches):
            time.sleep(2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mirror canonical Google Ads source rows into remote D1.")
    parser.add_argument("--since-date", help="Optional YYYY-MM-DD lower bound for metric_date.")
    parser.add_argument("--date", help="Accepted for d1_mirror_sync compatibility; sync rows on/after this date.")
    parser.add_argument("--weeks", type=int, help="Sync rows from the last N weeks.")
    parser.add_argument("--start-batch", type=int, default=1, help="Resume execution from a generated batch number.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    since_date = resolve_since_date(args.since_date, args.date, args.weeks)
    statements, counts = build_statements(since_date)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out = GENERATED_DIR / "google_ads_to_d1.sql"
    out.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(json.dumps({"sql": str(out), "counts": counts}, indent=2))

    if not args.dry_run:
        execute_remote(statements, start_batch=max(args.start_batch, 1))


if __name__ == "__main__":
    main()
