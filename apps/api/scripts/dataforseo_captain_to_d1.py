#!/usr/bin/env python3
"""Mirror DataForSEO Captain evidence tables from local Pond to remote D1."""

from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable

from wrangler_auth import build_runtime_env, npx_wrangler_prefix

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
REPO_ROOT = API_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402

CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
SERP_MIGRATION = API_DIR / "migrations" / "0032_create_dataforseo_serp_tables.sql"
ENRICHMENT_MIGRATION = API_DIR / "migrations" / "0033_create_dataforseo_enrichment_tables.sql"

TABLES = [
    "dataforseo_serp_runs",
    "dataforseo_serp_results",
    "dataforseo_property_keyword_rankings",
    "dataforseo_keyword_metrics",
    "dataforseo_labs_ranked_keywords",
    "dataforseo_onpage_page_snapshots",
    "dataforseo_business_profiles",
    "dataforseo_ai_visibility_probes",
]


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone()
    return bool(row)


def column_names(conn: sqlite3.Connection, table: str) -> list[str]:
    return [str(row[1]) for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def insert_rows(table: str, columns: list[str], rows: Iterable[sqlite3.Row]) -> list[str]:
    col_sql = ", ".join(columns)
    statements = []
    for row in rows:
        values = ", ".join(sql_literal(row[col]) for col in columns)
        statements.append(f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({values});")
    return statements


def latest_run_date(conn: sqlite3.Connection) -> str | None:
    candidates: list[str] = []
    for table in TABLES:
        if table_exists(conn, table):
            row = conn.execute(f"SELECT MAX(run_date) AS run_date FROM {table}").fetchone()
            if row and row["run_date"]:
                candidates.append(str(row["run_date"])[:10])
    return max(candidates) if candidates else None


def build_sql(property_codes: list[str], run_date: str | None) -> tuple[str, dict[str, int]]:
    conn = connect()
    counts: dict[str, int] = {}
    statements: list[str] = [
        "PRAGMA foreign_keys = OFF;",
        SERP_MIGRATION.read_text(encoding="utf-8").strip(),
        ENRICHMENT_MIGRATION.read_text(encoding="utf-8").strip(),
    ]
    try:
        effective_run_date = run_date or latest_run_date(conn)
        if not effective_run_date:
            raise SystemExit("No local DataForSEO run_date found.")
        placeholders = ", ".join("?" for _ in property_codes)
        params = [effective_run_date, *property_codes]
        for table in TABLES:
            if not table_exists(conn, table):
                counts[table] = 0
                continue
            cols = column_names(conn, table)
            rows = conn.execute(
                f"""
                SELECT *
                FROM {table}
                WHERE run_date = ?
                  AND property_id IN ({placeholders})
                ORDER BY property_id
                """,
                params,
            ).fetchall()
            counts[table] = len(rows)
            statements.extend(insert_rows(table, cols, rows))
        return "\n".join(statements) + "\n", counts
    finally:
        conn.close()


def execute_remote(sql: str) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, dir=GENERATED_DIR) as fp:
        fp.write(sql)
        temp_path = Path(fp.name)
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--file",
        str(temp_path),
        "--config",
        str(WRANGLER_TOML),
    ]
    result = subprocess.run(cmd, cwd=str(API_DIR), env=env, text=True, capture_output=True, timeout=1800)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def property_codes_from_args(args: argparse.Namespace) -> list[str]:
    if args.roster:
        payload = json.loads(args.roster.read_text(encoding="utf-8"))
        return [str(row["property_code"]) for row in payload.get("properties", [])]
    codes: list[str] = []
    for key in args.property or []:
        identity = resolve_property_identity(key)
        codes.append(identity.marketing_bi_property_id if identity else key)
    if not codes:
        raise SystemExit("Provide --roster or at least one --property.")
    return sorted(set(codes))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property", action="append", help="Property key/code to mirror.")
    parser.add_argument("--roster", type=Path, help="Captain activation roster JSON.")
    parser.add_argument("--run-date", help="DataForSEO run date. Defaults to latest local run date.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    property_codes = property_codes_from_args(args)
    sql, counts = build_sql(property_codes, args.run_date)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out = GENERATED_DIR / f"dataforseo_captain_sources_{args.run_date or 'latest'}.sql"
    out.write_text(sql, encoding="utf-8")
    print(json.dumps({"sql": str(out), "property_count": len(property_codes), "counts": counts}, indent=2))
    if not args.dry_run:
        execute_remote(sql)


if __name__ == "__main__":
    main()
