#!/usr/bin/env python3
"""Publish the latest Resi source phone lookup run to remote D1 and optional KV."""

from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from wrangler_auth import build_runtime_env, npx_wrangler_prefix

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
REPO_ROOT = API_DIR.parent.parent
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
MIGRATION_SQL = API_DIR / "migrations" / "0062_create_resi_source_lookup_tables.sql"
DEFAULT_D1_NAME = "pop-brief-db"
DEFAULT_KV_KEY = "resi-source-lookup/latest"
ALLOWED_DEFAULT_PHONE_SOURCES = {"trackingCodes.VWS", "resi_v2.lead_sources.VWS"}

RUN_COLUMNS = [
    "run_id",
    "feed_snapshot_id",
    "feed_snapshot_date",
    "feed_fetched_at",
    "feed_url",
    "feed_payload_sha256",
    "generated_at",
    "external_source_field",
    "properties_seen",
    "properties_resolved",
    "properties_feed_only",
    "tracking_codes_seen",
    "rows_upserted",
    "warnings_json",
    "kv_artifact_path",
]

LOOKUP_COLUMNS = [
    "property_code",
    "tracking_id",
    "external_source_field",
    "marketing_source_cd",
    "source_phone",
    "source_email",
    "fallback_phone",
    "fallback_email",
    "default_tracking_id",
    "default_marketing_source_cd",
    "default_phone_source",
    "default_email_source",
    "concierge_phone",
    "property_name",
    "canonical_property_id",
    "ga4_property_id",
    "community_id",
    "website_url",
    "hostnames_json",
    "url_prefixes_json",
    "feed_property_id",
    "feed_property_name",
    "feed_snapshot_id",
    "feed_snapshot_date",
    "feed_fetched_at",
    "feed_payload_sha256",
    "source_has_phone",
    "source_has_email",
    "identity_status",
    "is_active",
    "raw_tracking_code_json",
    "run_id",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(CANONICAL_DB), help="Canonical local SQLite database.")
    parser.add_argument("--run-id", help="Specific lookup run id. Defaults to latest local run.")
    parser.add_argument("--d1-name", default=DEFAULT_D1_NAME, help="Remote D1 database name.")
    parser.add_argument("--apply", action="store_true", help="Execute the generated SQL against remote D1.")
    parser.add_argument("--kv-namespace-id", help="Optional Cloudflare KV namespace id for the cache payload.")
    parser.add_argument("--kv-key", default=DEFAULT_KV_KEY, help="KV key for the latest lookup payload.")
    parser.add_argument("--apply-kv", action="store_true", help="Upload the KV payload. Requires --kv-namespace-id.")
    return parser.parse_args()


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def connect(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise RuntimeError(f"Canonical DB not found: {db_path}")
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def latest_run_id(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        """
        SELECT run_id
        FROM resi_source_lookup_runs
        ORDER BY created_at DESC, generated_at DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        raise RuntimeError("No local resi_source_lookup_runs rows found. Run build_resi_source_lookup_table.py first.")
    return str(row["run_id"])


def fetch_one(conn: sqlite3.Connection, sql: str, params: tuple[object, ...]) -> sqlite3.Row:
    row = conn.execute(sql, params).fetchone()
    if not row:
        raise RuntimeError("Requested Resi source lookup run was not found.")
    return row


def insert_or_replace(table: str, columns: list[str], rows: Iterable[sqlite3.Row]) -> list[str]:
    col_sql = ", ".join(columns)
    statements: list[str] = []
    for row in rows:
        values = ", ".join(sql_literal(row[column]) for column in columns)
        statements.append(f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({values});")
    return statements


def build_sql(db_path: Path, run_id: str | None) -> tuple[str, list[str], dict[str, object]]:
    with connect(db_path) as conn:
        resolved_run_id = run_id or latest_run_id(conn)
        run = fetch_one(
            conn,
            f"SELECT {', '.join(RUN_COLUMNS)} FROM resi_source_lookup_runs WHERE run_id = ?",
            (resolved_run_id,),
        )
        rows = conn.execute(
            f"""
            SELECT {', '.join(LOOKUP_COLUMNS)}
            FROM resi_source_phone_lookup
            WHERE run_id = ?
            ORDER BY property_code, tracking_id
            """,
            (resolved_run_id,),
        ).fetchall()

    if not rows:
        raise RuntimeError(f"Run {resolved_run_id} has no lookup rows.")

    non_vws_default = sum(1 for row in rows if row["default_phone_source"] not in ALLOWED_DEFAULT_PHONE_SOURCES)
    if non_vws_default:
        raise RuntimeError(f"Refusing to publish: {non_vws_default} rows do not default to a VWS source.")

    statements = [
        "-- Auto-generated: Resi source phone lookup to D1",
        f"-- Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"-- Run: {resolved_run_id}",
        "-- Default visible phone rule: VWS source only. No office-phone display fallback.",
        "",
        MIGRATION_SQL.read_text(encoding="utf-8").strip(),
        "",
    ]
    statements.extend(insert_or_replace("resi_source_lookup_runs", RUN_COLUMNS, [run]))
    statements.extend(insert_or_replace("resi_source_phone_lookup", LOOKUP_COLUMNS, rows))
    summary = {
        "run_id": resolved_run_id,
        "rows": len(rows),
        "properties_seen": run["properties_seen"],
        "properties_resolved": run["properties_resolved"],
        "properties_feed_only": run["properties_feed_only"],
        "warnings": json.loads(run["warnings_json"] or "[]"),
        "kv_artifact_path": run["kv_artifact_path"],
    }
    return resolved_run_id, statements, summary


def execute_d1(sql_file: Path, d1_name: str) -> bool:
    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        raise RuntimeError("Cloudflare API token was not resolved through the Keeper-backed Wrangler helper.")
    for attempt in range(1, 4):
        result = subprocess.run(
            [
                *npx_wrangler_prefix(env),
                "d1",
                "execute",
                d1_name,
                "--remote",
                "--yes",
                f"--file={sql_file}",
                "--config",
                str(WRANGLER_TOML),
            ],
            capture_output=True,
            text=True,
            timeout=900,
            env=env,
        )
        if result.returncode == 0:
            return True
        tail = (result.stderr or result.stdout)[-1200:]
        print(f"D1 execute failed on attempt {attempt}/3: {tail}", file=sys.stderr)
        if attempt < 3:
            time.sleep(5)
    return False


def publish_kv(kv_path: Path, namespace_id: str, latest_key: str, run_id: str) -> dict[str, object]:
    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        raise RuntimeError("Cloudflare API token was not resolved through the Keeper-backed Wrangler helper.")
    commands = [
        [*npx_wrangler_prefix(env), "kv", "key", "put", latest_key, "--path", str(kv_path), "--namespace-id", namespace_id, "--remote"],
        [
            *npx_wrangler_prefix(env),
            "kv",
            "key",
            "put",
            f"resi-source-lookup/runs/{run_id}",
            "--path",
            str(kv_path),
            "--namespace-id",
            namespace_id,
            "--remote",
        ],
    ]
    written = 0
    failures: list[str] = []
    for command in commands:
        result = subprocess.run(command, capture_output=True, text=True, timeout=180, env=env)
        if result.returncode == 0:
            written += 1
        else:
            failures.append((result.stderr or result.stdout).strip()[-800:])
    return {"written": written, "failures": failures}


def main() -> int:
    args = parse_args()
    run_id, statements, summary = build_sql(Path(args.db), args.run_id)

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    sql_file = GENERATED_DIR / f"resi_source_lookup_to_d1_{run_id}_{stamp}.sql"
    sql_file.write_text("\n".join(statements) + "\n", encoding="utf-8")

    kv_path = Path(str(summary["kv_artifact_path"]))
    manifest = {
        "mode": "apply" if args.apply else "dry-run",
        "run_id": run_id,
        "d1_name": args.d1_name,
        "sql_file": str(sql_file),
        "kv_artifact_path": str(kv_path),
        "kv_key": args.kv_key,
        "kv_namespace_configured": bool(args.kv_namespace_id),
        **summary,
    }

    if args.apply:
        manifest["d1_apply_succeeded"] = execute_d1(sql_file, args.d1_name)
        if not manifest["d1_apply_succeeded"]:
            print(json.dumps(manifest, indent=2), file=sys.stderr)
            return 1
    else:
        manifest["d1_apply_succeeded"] = None

    if args.apply_kv:
        if not args.kv_namespace_id:
            raise RuntimeError("--apply-kv requires --kv-namespace-id; no Resi source lookup KV namespace is defined in this repo.")
        if not kv_path.exists():
            raise RuntimeError(f"KV artifact not found: {kv_path}")
        kv_result = publish_kv(kv_path, args.kv_namespace_id, args.kv_key, run_id)
        manifest["kv_apply"] = kv_result
        if kv_result["failures"]:
            print(json.dumps(manifest, indent=2), file=sys.stderr)
            return 1
    else:
        manifest["kv_apply"] = None

    manifest_path = GENERATED_DIR / f"resi_source_lookup_publish_manifest_{run_id}_{stamp}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest["manifest_path"] = str(manifest_path)
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
