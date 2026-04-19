#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
API_ROOT = REPO_ROOT / "apps" / "api"
MIGRATIONS_DIR = API_ROOT / "migrations"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import resolve_secret


DEFAULT_KSM_PROFILE = "marketingops"
DEFAULT_CLOUDFLARE_TOKEN_NOTATION = "keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password"
DEFAULT_ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"
TARGET_MIGRATIONS = [
    "0013_enrich_communities.sql",
    "0014_create_pib_tables.sql",
    "0015_create_fish_tables.sql",
    "0016_create_ad_keyword_performance.sql",
    "0017_create_data_freshness.sql",
    "0018_magic_links_and_roles.sql",
    "0021_create_phase1_platform_tables.sql",
    "0022_create_runtime_release_state.sql",
]


@dataclass(frozen=True)
class MigrationProbe:
    migration_name: str
    checks: tuple[str, ...]


PROBES = {
    "0013_enrich_communities.sql": MigrationProbe(
        migration_name="0013_enrich_communities.sql",
        checks=(
            "communities.manager_name",
            "communities.unit_count",
            "communities.ga4_property_id",
            "communities.full_url",
            "communities.encasa_short_name",
            "communities.encasa_property_code",
            "communities.city",
            "communities.state",
        ),
    ),
    "0014_create_pib_tables.sql": MigrationProbe(
        migration_name="0014_create_pib_tables.sql",
        checks=(
            "table:pib_ga4_metrics",
            "table:pib_site_performance",
            "table:pib_local_presence",
            "table:pib_search_performance",
            "table:pib_cir",
            "table:pib_reviews",
        ),
    ),
    "0015_create_fish_tables.sql": MigrationProbe(
        migration_name="0015_create_fish_tables.sql",
        checks=("table:fish_conversations", "table:fish_messages", "table:fish_audit_log"),
    ),
    "0016_create_ad_keyword_performance.sql": MigrationProbe(
        migration_name="0016_create_ad_keyword_performance.sql",
        checks=(
            "table:ad_keyword_performance",
            "marketing_data.ads_total_clicks",
            "marketing_data.ads_total_conversions",
            "marketing_data.ads_cost_per_conversion",
            "marketing_data.ads_classified_pct",
        ),
    ),
    "0017_create_data_freshness.sql": MigrationProbe(
        migration_name="0017_create_data_freshness.sql",
        checks=("table:data_freshness",),
    ),
    "0018_magic_links_and_roles.sql": MigrationProbe(
        migration_name="0018_magic_links_and_roles.sql",
        checks=("table:magic_tokens", "table:sessions", "table:users", "table:invites"),
    ),
    "0021_create_phase1_platform_tables.sql": MigrationProbe(
        migration_name="0021_create_phase1_platform_tables.sql",
        checks=(
            "table:mirror_domains",
            "table:mirror_batches",
            "table:platform_ga4_daily_metrics",
            "table:platform_psi_daily_metrics",
            "table:agent_contracts",
            "table:system_state_events",
        ),
    ),
    "0022_create_runtime_release_state.sql": MigrationProbe(
        migration_name="0022_create_runtime_release_state.sql",
        checks=("table:runtime_release_state",),
    ),
}


def resolve_cloudflare_token() -> str:
    return resolve_secret(
        description="Cloudflare API token",
        notation_env_var="KSM_CLOUDFLARE_TOKEN_NOTATION",
        default_notation=DEFAULT_CLOUDFLARE_TOKEN_NOTATION,
        direct_env_var="CLOUDFLARE_API_TOKEN",
        default_profile=DEFAULT_KSM_PROFILE,
    )


def wrangler_env(account_id: str) -> dict[str, str]:
    env = os.environ.copy()
    env["CLOUDFLARE_API_TOKEN"] = resolve_cloudflare_token()
    env["CLOUDFLARE_ACCOUNT_ID"] = account_id
    return env


def run_remote_sql(sql: str, *, account_id: str) -> list[dict]:
    result = subprocess.run(
        [
            "npx",
            "wrangler",
            "d1",
            "execute",
            "pop-brief-db",
            "--remote",
            "--command",
            sql,
            "--json",
        ],
        cwd=API_ROOT,
        env=wrangler_env(account_id),
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    if isinstance(payload, dict):
        payload = [payload]
    return payload


def fetch_tables(*, account_id: str) -> set[str]:
    rows = run_remote_sql(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
        account_id=account_id,
    )[0]["results"]
    return {row["name"] for row in rows}


def fetch_columns(table_name: str, *, account_id: str) -> set[str]:
    rows = run_remote_sql(f"PRAGMA table_info('{table_name}');", account_id=account_id)[0]["results"]
    return {row["name"] for row in rows}


def fetch_applied_migrations(*, account_id: str) -> list[str]:
    rows = run_remote_sql(
        "SELECT name FROM d1_migrations ORDER BY id;",
        account_id=account_id,
    )[0]["results"]
    return [row["name"] for row in rows]


def escape_sql(value: str) -> str:
    return value.replace("'", "''")


def evaluate_probe(
    probe: MigrationProbe,
    *,
    tables: set[str],
    columns_cache: dict[str, set[str]],
    account_id: str,
) -> tuple[bool, list[str]]:
    missing: list[str] = []
    for check in probe.checks:
        if check.startswith("table:"):
            table_name = check.split(":", 1)[1]
            if table_name not in tables:
                missing.append(check)
            continue

        table_name, column_name = check.split(".", 1)
        if table_name not in tables:
            missing.append(check)
            continue
        if table_name not in columns_cache:
            columns_cache[table_name] = fetch_columns(table_name, account_id=account_id)
        if column_name not in columns_cache[table_name]:
            missing.append(check)

    return (not missing, missing)


def reconcile_sql(migration_names: list[str]) -> str:
    values = ",\n".join(f"  ('{escape_sql(name)}', CURRENT_TIMESTAMP)" for name in migration_names)
    return (
        "INSERT INTO d1_migrations (name, applied_at)\n"
        "VALUES\n"
        f"{values}\n"
        "ON CONFLICT(name) DO NOTHING;"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reconcile remote D1 migration ledger rows when legacy schema already exists but d1_migrations is incomplete."
    )
    parser.add_argument("--apply", action="store_true", help="Insert eligible missing migration rows into d1_migrations.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable output.")
    parser.add_argument("--account-id", default=os.getenv("CLOUDFLARE_ACCOUNT_ID", DEFAULT_ACCOUNT_ID))
    args = parser.parse_args()

    tables = fetch_tables(account_id=args.account_id)
    applied = fetch_applied_migrations(account_id=args.account_id)
    applied_set = set(applied)
    columns_cache: dict[str, set[str]] = {}

    evaluation = []
    eligible_to_insert: list[str] = []
    blocked: list[dict[str, object]] = []

    for migration_name in TARGET_MIGRATIONS:
        local_exists = (MIGRATIONS_DIR / migration_name).exists()
        probe = PROBES[migration_name]
        already_applied = migration_name in applied_set

        eligible = False
        missing_checks: list[str] = []
        if not already_applied:
            eligible, missing_checks = evaluate_probe(
                probe,
                tables=tables,
                columns_cache=columns_cache,
                account_id=args.account_id,
            )
            if eligible:
                eligible_to_insert.append(migration_name)
            else:
                blocked.append({"migration": migration_name, "missing_checks": missing_checks})

        evaluation.append(
            {
                "migration": migration_name,
                "local_file_present": local_exists,
                "already_in_ledger": already_applied,
                "probe_checks": list(probe.checks),
                "eligible_for_reconcile": eligible,
                "missing_checks": missing_checks,
            }
        )

    inserted: list[str] = []
    failed_after_apply: list[str] = []
    if args.apply and eligible_to_insert:
        run_remote_sql(reconcile_sql(eligible_to_insert), account_id=args.account_id)
        applied_after = set(fetch_applied_migrations(account_id=args.account_id))
        inserted = [name for name in eligible_to_insert if name in applied_after]
        failed_after_apply = [name for name in eligible_to_insert if name not in applied_after]

    result = {
        "status": "healthy" if not blocked and not failed_after_apply else "review",
        "remote_table_count": len(tables),
        "remote_ledger_count": len(applied) + len(inserted),
        "eligible_to_insert": eligible_to_insert,
        "inserted": inserted,
        "failed_after_apply": failed_after_apply,
        "blocked": blocked,
        "evaluation": evaluation,
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"status={result['status']}")
        print(f"eligible_to_insert={len(eligible_to_insert)}")
        for name in eligible_to_insert:
            prefix = "inserted" if name in inserted else "eligible"
            print(f"{prefix}: {name}")
        for name in failed_after_apply:
            print(f"failed_after_apply: {name}")
        for item in blocked:
            print(f"blocked: {item['migration']} missing={', '.join(item['missing_checks'])}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
