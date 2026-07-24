#!/usr/bin/env python3
"""Stand up Captain memory and support-agent rosters for governed property scopes.

The script intentionally resolves every property through the identity matrix. It
does not define source-specific property maps; the only local scope inputs are
the active Spotlight configuration and the documented pilot property names.
"""

from __future__ import annotations

import argparse
import glob
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
API_DIR = ROOT / "apps" / "api"
SCRIPT_DIR = API_DIR / "scripts"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from Data_Collection.utils.property_identity import (  # noqa: E402
    PropertyIdentity,
    load_property_identities,
    resolve_property_identity,
)
from wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


OUT_DIR = ROOT / "reports" / "captains_log" / "activation"
WRANGLER_TOML = API_DIR / "wrangler.toml"
CURRENT_NOW = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

PILOT_PROPERTY_NAMES = [
    "Champions Green",
    "The District Universal",
    "The Harrison",
    "Ventana",
    "Calais Midtown",
]

PORTFOLIO_SOURCE_LABEL = "Portfolio"

ROLES = [
    {
        "suffix": "source_scout",
        "display": "Source Scout",
        "role": "Source intake",
        "cadence": "daily",
        "responsibility": "Confirm expected source arrivals, freshness, identity, and routing before the Captain publishes a read.",
        "scope": {
            "sources": [
                "Guest Cards",
                "unit availability",
                "Marketing BI",
                "GA4",
                "GSC",
                "Google Ads",
                "GBP",
                "PSI",
                "Reputation.com",
                "operating metrics",
            ],
            "watch_items": ["missing source", "stale source", "identity mismatch", "unrouted evidence"],
        },
    },
    {
        "suffix": "truth_reconciler",
        "display": "Truth Reconciler",
        "role": "Source authority",
        "cadence": "daily",
        "responsibility": "Reconcile advisory/vendor claims against Data Pond source-of-record facts and raise conflicts as operating items.",
        "scope": {
            "authorities": ["Data Pond", "official operating metrics", "unit feed", "Marketing BI advisory", "operator decision"],
            "watch_items": ["needs_review claim", "source conflict", "vendor value overridden by Pond"],
        },
    },
    {
        "suffix": "inventory_watch",
        "display": "Inventory Watch",
        "role": "Inventory and concessions",
        "cadence": "daily",
        "responsibility": "Monitor available units, floorplan pressure, vacancy aging, make-ready signals, specials, and unit-level concession visibility.",
        "scope": {
            "sources": ["unit_availability_units", "marketing_bi_vacancy_days_units", "available_unit_interest_metrics"],
            "watch_items": ["floorplan pressure", "aged vacancy", "specials concentration", "make-ready concern"],
        },
    },
    {
        "suffix": "funnel_watch",
        "display": "Funnel Watch",
        "role": "Leasing funnel",
        "cadence": "daily",
        "responsibility": "Monitor guest cards, tours/visits, applications, leases, cancellations/denials, quotes, and source-level leakage.",
        "scope": {
            "sources": ["guest_card_metrics", "marketing_bi_traffic_conversions_full", "marketing_cancel_denial_by_source"],
            "watch_items": ["traffic gap", "application gap", "lease gap", "source leakage", "cancel/denial concentration"],
        },
    },
    {
        "suffix": "media_watch",
        "display": "Media Watch",
        "role": "Demand and visibility",
        "cadence": "daily",
        "responsibility": "Monitor GA4, GSC, Google Ads, GBP, PSI, and property-page visibility for demand or experience shifts.",
        "scope": {
            "sources": ["GA4", "GSC", "Google Ads", "GBP", "PSI", "live property page"],
            "watch_items": ["paid search inactivity", "organic intent", "local visibility", "page experience"],
        },
    },
    {
        "suffix": "reputation_watch",
        "display": "Reputation Watch",
        "role": "Reputation and local trust",
        "cadence": "weekly",
        "responsibility": "Monitor Reputation.com score, response posture, review mix, component gaps, trend movement, and local competitor exposure.",
        "scope": {
            "sources": [
                "reputation_com_location_leaderboard",
                "reputation_com_score_components",
                "reputation_com_score_time_series",
                "reputation_com_local_competition",
                "GBP reviews",
            ],
            "watch_items": [
                "score decline",
                "low response rate",
                "negative review mix",
                "competitor reputation gap",
                "listing completeness gap",
                "review recency gap",
            ],
        },
    },
    {
        "suffix": "navigator_watch",
        "display": "Navigator Watch",
        "role": "Specs, search, content, local entity, and AI visibility",
        "cadence": "daily",
        "responsibility": "Monitor Specs drift, live HTML/content, SERP, OnPage, backlinks, local entity, AI visibility, and exact copy/action opportunities.",
        "scope": {
            "sources": [
                "Specs",
                "live HTML",
                "DataForSEO SERP",
                "DataForSEO OnPage",
                "DataForSEO Labs",
                "DataForSEO Business Data",
                "DataForSEO Backlinks",
                "DataForSEO AI/LLM",
                "GSC",
                "GA4",
                "GBP",
            ],
            "watch_items": ["Specs drift", "generic search gap", "metadata issue", "image gap", "AI visibility", "USP/copy action"],
        },
    },
    {
        "suffix": "experience_watch",
        "display": "Experience Watch",
        "role": "BrowserStack / EVS validation",
        "cadence": "daily",
        "responsibility": "Monitor BrowserStack and EVS proof for mobile/desktop rendering, forms, CTAs, specials visibility, and post-change validation.",
        "scope": {
            "sources": ["BrowserStack", "EVS", "live property page", "Specs"],
            "watch_items": ["mobile rendering", "desktop rendering", "form path", "CTA path", "specials visibility", "post-change proof"],
        },
    },
    {
        "suffix": "boatswain",
        "display": "Boatswain",
        "role": "Execution tracking",
        "cadence": "daily",
        "responsibility": "Track open actions, owners, due dates, blockers, expected lift, and proof so the support team follows through.",
        "scope": {
            "sources": ["captain_actions", "captain_watch_items", "captain_agent_runs"],
            "watch_items": ["overdue action", "blocked action", "missing due date", "owner gap"],
        },
    },
    {
        "suffix": "logkeeper",
        "display": "Logkeeper",
        "role": "Memory, audit, and support-lane freshness",
        "cadence": "weekly",
        "responsibility": "Preserve Captain memory, evidence, decisions, learning, support-lane freshness, and promotion candidates.",
        "scope": {
            "sources": [
                "governed_memory_entries",
                "governed_memory_evidence_refs",
                "captain_agent_runs",
                "captain_watch_items",
                "captain_actions",
                "captain_brief_runs",
            ],
            "watch_items": ["memory freshness", "support lane staleness", "evidence lineage", "doctrine candidate"],
        },
    },
    {
        "suffix": "supervisor_scribe",
        "display": "Supervisor Scribe",
        "role": "Brief assembly",
        "cadence": "weekly",
        "responsibility": "Convert current memory, decisions, watch items, and action state into the Admiral-ready Captain Brief.",
        "scope": {
            "outputs": ["Captain Brief email", "Admiral Read", "decision register", "action register"],
            "style": ["PIB-family discipline", "MM/DD/YYYY dates", "property code identity", "authoritative narrative"],
        },
    },
]


@dataclass(frozen=True)
class CaptainScope:
    identity: PropertyIdentity
    scope_type: str
    source_label: str
    designation: str | None = None
    market: str | None = None


def resolve_latest_spotlight_config() -> Path:
    pattern = str(ROOT / "Spotlight_Properties_Report" / "config" / "monthly_spotlight_properties_*.json")
    matches = sorted(glob.glob(pattern))
    if not matches:
        raise SystemExit("No monthly Spotlight config found.")
    return Path(matches[-1])


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def slug(value: str) -> str:
    text = re.sub(r"^the\s+", "", value.strip(), flags=re.I)
    text = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return text or "captain"


def captain_token(identity: PropertyIdentity) -> str:
    if identity.marketing_bi_property_id == "AR4PB":
        return "benton"
    base = re.sub(r"^the\s+", "", identity.property_name.strip(), flags=re.I).split()[0]
    return re.sub(r"[^a-z0-9]+", "", base.lower()) or slug(identity.marketing_bi_property_id)


def captain_display_name(identity: PropertyIdentity) -> str:
    if identity.marketing_bi_property_id == "AR4PB":
        return "Captain Benton"
    base = re.sub(r"^the\s+", "", identity.property_name.strip(), flags=re.I).split()[0]
    clean = re.sub(r"[^A-Za-z0-9'-]+", "", base)
    return f"Captain {clean or identity.marketing_bi_property_id}"


def merge_scope_type(existing: str, new_value: str) -> str:
    merged: list[str] = []
    for value in [*existing.split(","), *new_value.split(",")]:
        normalized = value.strip()
        if normalized and normalized not in merged:
            merged.append(normalized)
    return ",".join(merged)


def merge_source_label(existing: str, new_value: str) -> str:
    merged: list[str] = []
    for value in [*existing.split(";"), *new_value.split(";")]:
        normalized = value.strip()
        if normalized and normalized not in merged:
            merged.append(normalized)
    return "; ".join(merged)


def upsert_scope(
    scopes: dict[str, CaptainScope],
    identity: PropertyIdentity,
    *,
    scope_type: str,
    source_label: str,
    designation: str | None = None,
    market: str | None = None,
) -> None:
    prior = scopes.get(identity.marketing_bi_property_id)
    if not prior:
        scopes[identity.marketing_bi_property_id] = CaptainScope(
            identity=identity,
            scope_type=scope_type,
            source_label=source_label,
            designation=designation,
            market=market,
        )
        return
    scopes[identity.marketing_bi_property_id] = CaptainScope(
        identity=identity,
        scope_type=merge_scope_type(prior.scope_type, scope_type),
        source_label=merge_source_label(prior.source_label, source_label),
        designation=designation or prior.designation,
        market=market or prior.market,
    )


def load_scopes(include_spotlight: bool, include_pilot: bool, include_portfolio: bool) -> list[CaptainScope]:
    scopes: dict[str, CaptainScope] = {}
    if include_portfolio:
        for identity in load_property_identities():
            upsert_scope(
                scopes,
                identity,
                scope_type="portfolio",
                source_label=PORTFOLIO_SOURCE_LABEL,
            )
    if include_spotlight:
        spotlight_config = resolve_latest_spotlight_config()
        raw = json.loads(spotlight_config.read_text(encoding="utf-8"))
        period = raw.get("metadata", {}).get("period", "current")
        for ga4_id, row in raw.get("spotlight_properties", {}).items():
            if not row.get("active", False):
                continue
            identity = resolve_property_identity(str(ga4_id))
            if not identity:
                raise SystemExit(f"Unable to resolve active Spotlight property {ga4_id}: {row}")
            designation = (row.get("designation") or "").strip() or None
            market = (row.get("market") or "").strip() or None
            label_parts = [f"{period} Spotlight"]
            if designation:
                label_parts.append(designation)
            if market:
                label_parts.append(market)
            upsert_scope(
                scopes,
                identity,
                scope_type="spotlight",
                source_label=" | ".join(label_parts),
                designation=designation,
                market=market,
            )
    if include_pilot:
        for name in PILOT_PROPERTY_NAMES:
            identity = resolve_property_identity(name)
            if not identity:
                raise SystemExit(f"Unable to resolve pilot property: {name}")
            upsert_scope(
                scopes,
                identity,
                scope_type="pilot",
                source_label="Pilot",
            )
    return sorted(scopes.values(), key=lambda scope: scope.identity.marketing_bi_property_id)


def community_upsert(identity: PropertyIdentity, now: str) -> str:
    values = [
        identity.community_id,
        identity.property_name,
        identity.ga4_property_id,
        identity.encasa_region,
        "active",
        now,
        "captain-roster-standup",
        now,
        "captain-roster-standup",
        None,
        None,
        None,
        identity.unit_count,
        identity.ga4_property_id,
        identity.website_url,
        identity.encasa_short_name,
        identity.marketing_bi_property_id,
        identity.city,
        identity.state,
    ]
    columns = [
        "id",
        "name",
        "external_key",
        "region",
        "status",
        "created_at",
        "created_by",
        "updated_at",
        "updated_by",
        "deleted_at",
        "deleted_by",
        "manager_name",
        "unit_count",
        "ga4_property_id",
        "full_url",
        "encasa_short_name",
        "encasa_property_code",
        "city",
        "state",
    ]
    update_cols = [col for col in columns if col not in {"id", "created_at", "created_by"}]
    return (
        f"INSERT OR REPLACE INTO communities ({', '.join(columns)}) VALUES "
        f"({', '.join(sql_literal(v) for v in values)}) "
        "ON CONFLICT(id) DO UPDATE SET "
        + ", ".join(f"{col} = excluded.{col}" for col in update_cols)
        + ";"
    )


def memory_sql(scope: CaptainScope, now: str) -> list[str]:
    identity = scope.identity
    property_code = identity.marketing_bi_property_id
    token = captain_token(identity)
    captain_name = captain_display_name(identity)
    memory_id = f"mem_{property_code.lower()}_captain_{token}_activation"
    identity_id = f"identity_{property_code.lower()}_captain_{token}"
    payload = {
        "property_code": property_code,
        "property_name": identity.property_name,
        "captain": captain_name,
        "activation_date": now[:10],
        "scope_type": scope.scope_type,
        "source_label": scope.source_label,
        "designation": scope.designation,
        "market": scope.market,
        "operating_charge": "Own the full property-life read: operational truth, demand, inventory, pricing/concessions, source performance, website/content/search/entity quality, experience validation, action follow-through, and memory.",
        "required_questions": [
            "What changed in the last 30 days?",
            "What recovery math is required to get exposure below 10%?",
            "Which traffic/source mix and spend shift supports that recovery?",
            "Should pricing, concessions, operations, or advertising move first?",
            "What exact web/content/SEO/local actions are urgent?",
            "Are make-readies, hold times, reviews, images, source quality, or people/process issues constraining recovery?",
        ],
        "support_lanes": [role["suffix"] for role in ROLES],
        "source_authority_posture": "Data Pond governs internal facts; Marketing BI and DataForSEO provide advisory and market/search evidence; memory must reconcile against current source-of-record values.",
    }
    summary = (
        f"{captain_name} is activated for {identity.property_name} ({property_code}) as a {scope.scope_type} Captain. "
        "The Captain owns an evidence-backed Log, daily support-lane awareness, source freshness, recovery questions, "
        "and action follow-through across operations, marketing, search, content, reputation, and experience validation."
    )
    if scope.designation:
        summary += f" Current designation: {scope.designation}."
    return [
        (
            "UPDATE governed_memory_entries "
            "SET status = 'deprecated', updated_at = "
            f"{sql_literal(now)} "
            "WHERE source_system = 'captain_activation' "
            f"AND json_extract(structured_payload_json, '$.property_code') = {sql_literal(property_code)};"
        ),
        (
            "DELETE FROM governed_memory_identity_bindings "
            f"WHERE scope = 'property' AND property_id = {sql_literal(identity.community_id)} "
            ";"
        ),
        (
            "INSERT OR REPLACE INTO governed_memory_identity_bindings "
            "(id, scope, property_id, fleet_key, ledger_key, role_family, display_name, internal_name, metadata_json, created_at, updated_at) VALUES "
            f"({sql_literal(identity_id)}, 'property', {sql_literal(identity.community_id)}, NULL, NULL, 'Captain', "
            f"{sql_literal(captain_name)}, {sql_literal(f'captain_{token}')}, "
            f"{sql_literal(json.dumps({'property_code': property_code, 'property_name': identity.property_name, 'scope_type': scope.scope_type, 'designation': scope.designation, 'market': scope.market}, separators=(',', ':')))}, "
            f"{sql_literal(now)}, {sql_literal(now)});"
        ),
        (
            "INSERT OR REPLACE INTO governed_memory_entries "
            "(id, scope, property_id, fleet_key, ledger_key, summary, structured_payload_json, source_system, created_by, confidence, status, dedupe_signature, parent_entry_id, originating_candidate_id, created_at, updated_at) VALUES "
            f"({sql_literal(memory_id)}, 'property', {sql_literal(identity.community_id)}, NULL, NULL, {sql_literal(summary)}, "
            f"{sql_literal(json.dumps(payload, separators=(',', ':')))}, 'captain_activation', 'captain-roster-standup', 0.9, 'active', "
            f"{sql_literal(f'captain_activation:{property_code}:{now[:10]}')}, NULL, NULL, {sql_literal(now)}, {sql_literal(now)});"
        ),
        (
            "INSERT OR REPLACE INTO governed_memory_evidence_refs "
            "(id, memory_entry_id, evidence_type, evidence_source, evidence_ref, evidence_excerpt, metadata_json, created_at) VALUES "
            f"({sql_literal(f'ev_{property_code.lower()}_captain_activation')}, {sql_literal(memory_id)}, "
            "'captain_activation', 'Captain activation roster', "
            f"{sql_literal(str(OUT_DIR / f'captain_activation_roster_{now[:10]}.sql'))}, "
            f"{sql_literal(f'{captain_name} activation seed for {identity.property_name}.')}, "
            f"{sql_literal(json.dumps({'scope_type': scope.scope_type, 'source_label': scope.source_label, 'designation': scope.designation, 'market': scope.market}, separators=(',', ':')))}, "
            f"{sql_literal(now)});"
        ),
    ]


def support_agent_sql(scope: CaptainScope, now: str) -> list[str]:
    identity = scope.identity
    property_code = identity.marketing_bi_property_id
    token = captain_token(identity)
    captain_name = captain_display_name(identity)
    memory_id = f"mem_{property_code.lower()}_captain_{token}_activation"
    statements: list[str] = []
    for role in ROLES:
        agent_key = f"{token}_{role['suffix']}"
        agent_name = f"{captain_name.replace('Captain ', '')} {role['display']}"
        scope_payload = {
            **role["scope"],
            "property_code": property_code,
            "property_name": identity.property_name,
            "captain": captain_name,
            "scope_type": scope.scope_type,
            "designation": scope.designation,
            "market": scope.market,
        }
        statements.append(
            "INSERT OR REPLACE INTO captain_support_agents "
            "(id, property_id, captain_memory_entry_id, agent_key, agent_name, role, responsibility, source_scope_json, cadence, status, created_at, updated_at) VALUES "
            f"({sql_literal(f'agent_{property_code.lower()}_{agent_key}')}, {sql_literal(property_code)}, {sql_literal(memory_id)}, "
            f"{sql_literal(agent_key)}, {sql_literal(agent_name)}, "
            f"{sql_literal(role['role'])}, {sql_literal(role['responsibility'])}, "
            f"{sql_literal(json.dumps(scope_payload, separators=(',', ':')))}, {sql_literal(role['cadence'])}, 'active', {sql_literal(now)}, {sql_literal(now)});"
        )
    return statements


def spotlight_cleanup_sql(scopes: list[CaptainScope], now: str) -> list[str]:
    keep_codes = {scope.identity.marketing_bi_property_id for scope in scopes}
    for name in PILOT_PROPERTY_NAMES:
        identity = resolve_property_identity(name)
        if identity:
            keep_codes.add(identity.marketing_bi_property_id)
    keep_sql = ", ".join(sql_literal(code) for code in sorted(keep_codes))
    if not keep_sql:
        return []
    return [
        (
            "UPDATE captain_support_agents "
            "SET status = 'retired', updated_at = "
            f"{sql_literal(now)} "
            "WHERE (json_extract(source_scope_json, '$.scope_type') LIKE '%spotlight%' "
            "OR json_extract(source_scope_json, '$.scope_type') LIKE '%portfolio%') "
            f"AND property_id NOT IN ({keep_sql});"
        ),
        (
            "UPDATE governed_memory_entries "
            "SET status = 'deprecated', updated_at = "
            f"{sql_literal(now)} "
            "WHERE source_system = 'captain_activation' "
            "AND (json_extract(structured_payload_json, '$.scope_type') LIKE '%spotlight%' "
            "OR json_extract(structured_payload_json, '$.scope_type') LIKE '%portfolio%') "
            f"AND json_extract(structured_payload_json, '$.property_code') NOT IN ({keep_sql});"
        ),
    ]


def build_sql(scopes: list[CaptainScope], now: str) -> str:
    statements: list[str] = [
        "PRAGMA foreign_keys = OFF;",
        (API_DIR / "migrations" / "0022_create_governed_memory_tables.sql").read_text(encoding="utf-8"),
        (API_DIR / "migrations" / "0026_create_captain_support_agents.sql").read_text(encoding="utf-8"),
        (API_DIR / "migrations" / "0027_create_captain_runtime_tables.sql").read_text(encoding="utf-8"),
    ]
    statements.extend(spotlight_cleanup_sql(scopes, now))
    for scope in scopes:
        statements.append(community_upsert(scope.identity, now))
        statements.extend(memory_sql(scope, now))
        statements.extend(support_agent_sql(scope, now))
    statements.append("PRAGMA foreign_keys = ON;")
    return "\n\n".join(statements) + "\n"


def write_manifest(scopes: list[CaptainScope], sql_path: Path, now: str) -> Path:
    rows = []
    for scope in scopes:
        identity = scope.identity
        rows.append(
            {
                "property_code": identity.marketing_bi_property_id,
                "property_name": identity.property_name,
                "community_id": identity.community_id,
                "ga4_property_id": identity.ga4_property_id,
                "captain": captain_display_name(identity),
                "scope_type": scope.scope_type,
                "designation": scope.designation,
                "market": scope.market,
                "agent_count": len(ROLES),
            }
        )
    manifest = {
        "generated_at": now,
        "sql": str(sql_path),
        "property_count": len(rows),
        "agent_count": len(rows) * len(ROLES),
        "properties": rows,
    }
    path = sql_path.with_suffix(".json")
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return path


def apply_remote(sql_path: Path) -> None:
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--file",
        str(sql_path),
        "--config",
        str(WRANGLER_TOML),
    ]
    result = subprocess.run(cmd, cwd=str(API_DIR), env=env, text=True, capture_output=True, timeout=1800)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def build_seed_only_sql(scope: CaptainScope) -> str:
    now = CURRENT_NOW
    statements = [
        "PRAGMA foreign_keys = OFF;",
        community_upsert(scope.identity, now),
        *memory_sql(scope, now),
        *support_agent_sql(scope, now),
        "PRAGMA foreign_keys = ON;",
    ]
    return "\n\n".join(statements) + "\n"


def apply_remote_chunks(scopes: list[CaptainScope], chunk_dir: Path) -> None:
    chunk_dir.mkdir(parents=True, exist_ok=True)
    for index, scope in enumerate(scopes, start=1):
        property_code = scope.identity.marketing_bi_property_id
        chunk_path = chunk_dir / f"captain_activation_{property_code.lower()}_{CURRENT_NOW[:10]}.sql"
        chunk_path.write_text(build_seed_only_sql(scope), encoding="utf-8")
        print(f"Applying {index}/{len(scopes)} {property_code}: {chunk_path}")
        apply_remote(chunk_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Stand up Captain memory and support-agent rosters.")
    parser.add_argument("--portfolio", action="store_true", help="Include the full governed portfolio.")
    parser.add_argument("--spotlight", action="store_true", help="Include active Spotlight properties.")
    parser.add_argument("--pilot", action="store_true", help="Include documented pilot properties.")
    parser.add_argument("--apply-remote", action="store_true", help="Apply the generated SQL to remote D1.")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    explicit_scope = args.portfolio or args.spotlight or args.pilot
    include_portfolio = args.portfolio
    include_spotlight = args.spotlight or not explicit_scope
    include_pilot = args.pilot or not explicit_scope
    scopes = load_scopes(include_spotlight, include_pilot, include_portfolio)
    output_path = args.output or (OUT_DIR / f"captain_activation_roster_{CURRENT_NOW[:10]}.sql")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sql = build_sql(scopes, CURRENT_NOW)
    output_path.write_text(sql, encoding="utf-8")
    manifest_path = write_manifest(scopes, output_path, CURRENT_NOW)
    print(json.dumps({"sql": str(output_path), "manifest": str(manifest_path), "properties": len(scopes), "agents": len(scopes) * len(ROLES)}, indent=2))
    if args.apply_remote:
        apply_remote_chunks(scopes, output_path.parent / "chunks_seed_only")


if __name__ == "__main__":
    main()
