#!/usr/bin/env python3
"""Audit active Captain routines against local Data Pond source freshness.

This is an orchestration/readiness utility, not a report renderer. It checks
whether the Captain has the current source lanes needed to watch, research,
validate, and brief a property from the governed Data Pond.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
MANIFEST_PATH = ROOT / "config" / "captain_active_routine_manifest.json"
ACTIVATION_DIR = ROOT / "reports" / "captains_log" / "activation"
OUTPUT_DIR = ROOT / "reports" / "captains_log" / "routines"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import PropertyIdentity, load_property_identities, resolve_property_identity  # noqa: E402


@dataclass(frozen=True)
class SourceCheck:
    source_key: str
    cadence: str
    latest_date: str | None
    age_days: int | None
    band: str
    table_name: str | None
    note: str | None = None


def today_iso() -> str:
    return date.today().isoformat()


def display_date(value: str | None) -> str:
    parsed = parse_date(value)
    return parsed.strftime("%m/%d/%Y") if parsed else "-"


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if "T" in text:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def age_days(value: str | None) -> int | None:
    parsed = parse_date(value)
    if parsed is None:
        return None
    return (date.today() - parsed).days


def freshness_band(age: int | None, cadence: str, bands: dict[str, dict[str, int]]) -> str:
    if age is None:
        return "missing"
    rule = bands.get(cadence, bands["weekly"])
    if age <= int(rule["current_days"]):
        return "current"
    if age <= int(rule["aging_days"]):
        return "aging"
    return "stale"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone()
    return bool(row)


def scalar_date(conn: sqlite3.Connection, table: str, sql: str, params: tuple[Any, ...]) -> str | None:
    if not table_exists(conn, table):
        return None
    row = conn.execute(sql, params).fetchone()
    value = row[0] if row else None
    return str(value) if value else None


def latest_activation_properties() -> list[str]:
    candidates = sorted(ACTIVATION_DIR.glob("captain_activation_roster_*.json"))
    if not candidates:
        return []
    payload = json.loads(candidates[-1].read_text(encoding="utf-8"))
    return [str(row["property_code"]) for row in payload.get("properties", []) if row.get("property_code")]


def selected_identities(property_ref: str | None, all_properties: bool) -> list[PropertyIdentity]:
    identities = list(load_property_identities())
    if property_ref:
        identity = resolve_property_identity(property_ref)
        if not identity:
            raise SystemExit(f"Could not resolve property through identity matrix: {property_ref}")
        return [identity]
    if all_properties:
        return identities
    active_codes = set(latest_activation_properties())
    if active_codes:
        return [identity for identity in identities if identity.marketing_bi_property_id in active_codes]
    return identities


def latest_source_date(conn: sqlite3.Connection, source_key: str, identity: PropertyIdentity) -> tuple[str | None, str | None, str | None]:
    code = identity.marketing_bi_property_id
    ga4 = identity.ga4_property_id or code
    community = identity.community_id or ""

    queries: dict[str, tuple[str, str, tuple[Any, ...], str | None]] = {
        "property_identity_matrix": ("identity_matrix", "SELECT date('now')", (), "Identity resolved through governed matrix."),
        "captain_memory": ("governed_memory_entries", "SELECT MAX(created_at) FROM governed_memory_entries WHERE property_id = ? OR json_extract(structured_payload_json, '$.property_code') = ?", (community, code), None),
        "captain_actions": ("captain_actions", "SELECT MAX(updated_at) FROM captain_actions WHERE property_id = ?", (code,), None),
        "captain_watch_items": ("captain_watch_items", "SELECT MAX(updated_at) FROM captain_watch_items WHERE property_id = ?", (code,), None),
        "captain_agent_runs": ("captain_agent_runs", "SELECT MAX(finished_at) FROM captain_agent_runs WHERE property_id = ?", (code,), None),
        "captain_brief_runs": ("captain_brief_runs", "SELECT MAX(created_at) FROM captain_brief_runs WHERE property_id = ?", (code,), None),
        "guest_cards": ("guest_card_metrics", "SELECT MAX(run_date) FROM guest_card_metrics WHERE property_code = ?", (code,), None),
        "unit_feed": ("unit_availability_units", "SELECT MAX(snapshot_date) FROM unit_availability_units WHERE property_id = ?", (ga4,), None),
        "available_unit_interest": ("available_unit_interest_metrics", "SELECT MAX(report_date) FROM available_unit_interest_metrics WHERE property_id = ? OR community_id = ?", (code, community), None),
        "marketing_ops_summary": ("marketing_ops_summary_rows", "SELECT MAX(report_date) FROM marketing_ops_summary_rows WHERE property_id = ? OR community_id = ?", (code, community), None),
        "marketing_bi_source_performance": ("marketing_bi_source_performance_rows", "SELECT MAX(report_date) FROM marketing_bi_source_performance_rows WHERE property_id = ? OR community_id = ?", (code, community), None),
        "marketing_cancel_denial": ("marketing_cancel_denial_by_source", "SELECT MAX(report_date) FROM marketing_cancel_denial_by_source WHERE property_id = ? OR community_id = ?", (code, community), None),
        "portfolio_box_score": ("portfolio_box_score_rows", "SELECT MAX(report_date) FROM portfolio_box_score_rows WHERE property_id = ? OR community_id = ?", (code, community), "Portfolio box score table is optional and present only after current export ingestion."),
        "monthly_ad_spend": ("marketing_bi_monthly_ad_spend_source_rows", "SELECT MAX(report_date) FROM marketing_bi_monthly_ad_spend_source_rows WHERE property_id = ? OR property_code = ? OR community_id = ?", (code, code, community), None),
        "google_ads": ("google_ads_campaigns", "SELECT MAX(metric_date) FROM google_ads_campaigns WHERE property_id = ?", (ga4,), None),
        "ga4_daily": ("ga4_daily_metrics", "SELECT MAX(metric_date) FROM ga4_daily_metrics WHERE property_id = ?", (ga4,), None),
        "ga4_traffic_sources": ("ga4_traffic_sources", "SELECT MAX(metric_date) FROM ga4_traffic_sources WHERE property_id = ?", (ga4,), None),
        "gsc_daily": ("gsc_daily_metrics", "SELECT MAX(metric_date) FROM gsc_daily_metrics WHERE property_id = ? OR ga4_property_id = ?", (ga4, ga4), None),
        "pagespeed": ("pagespeed_metrics", "SELECT MAX(metric_date) FROM pagespeed_metrics WHERE property_id = ?", (ga4,), None),
        "gbp_insights": ("gbp_daily_insights", "SELECT MAX(metric_date) FROM gbp_daily_insights WHERE property_id = ?", (ga4,), None),
        "gbp_reviews": ("gbp_reviews", "SELECT MAX(review_create_time) FROM gbp_reviews WHERE property_id = ?", (ga4,), None),
        "gbp_reviews_summary": ("gbp_reviews_summary", "SELECT MAX(metric_date) FROM gbp_reviews_summary WHERE property_id = ?", (ga4,), None),
        "gbp_review_sentiment": ("gbp_review_sentiment", "SELECT MAX(analyzed_at) FROM gbp_review_sentiment WHERE property_id = ?", (ga4,), None),
        "reputation_com": ("reputation_com_location_leaderboard", "SELECT MAX(report_date) FROM reputation_com_location_leaderboard WHERE property_id = ? OR community_id = ?", (code, community), None),
        "service_delivery": ("marketing_bi_service_delivery_rows", "SELECT MAX(report_date) FROM marketing_bi_service_delivery_rows WHERE property_id = ? OR community_id = ?", (code, community), "Service delivery is optional until the weekly BI export is present."),
        "dataforseo_onpage": ("dataforseo_onpage_page_snapshots", "SELECT MAX(run_date) FROM dataforseo_onpage_page_snapshots WHERE property_id = ?", (code,), None),
        "dataforseo_rankings": ("dataforseo_property_keyword_rankings", "SELECT MAX(run_date) FROM dataforseo_property_keyword_rankings WHERE property_id = ?", (code,), None),
        "dataforseo_business": ("dataforseo_business_profiles", "SELECT MAX(run_date) FROM dataforseo_business_profiles WHERE property_id = ?", (code,), None),
        "competitor_market_research": ("competitor_market_research_snapshots", "SELECT MAX(snapshot_date) FROM competitor_market_research_snapshots WHERE property_id = ?", (code,), None),
        "evs": ("evs_validation_results", "SELECT MAX(created_at) FROM evs_validation_results WHERE property_id = ? OR community_id = ?", (code, community), "EVS is a validation lane and may be on-demand until formal scheduling is enabled."),
        "browserstack": ("browserstack_validation_results", "SELECT MAX(created_at) FROM browserstack_validation_results WHERE property_id = ? OR community_id = ?", (code, community), "BrowserStack is a validation lane and may be on-demand until formal scheduling is enabled."),
    }

    item = queries.get(source_key)
    if not item:
        return None, None, "No query mapped for this source."
    table, sql, params, note = item
    if table == "identity_matrix":
        return today_iso(), table, note
    if not table_exists(conn, table):
        return None, table, note or f"Table not present: {table}."
    return scalar_date(conn, table, sql, params), table, note


def source_cadence(source_key: str) -> str:
    monthly = {"reputation_com", "portfolio_box_score"}
    weekly = {"competitor_market_research", "gbp_reviews", "gbp_reviews_summary", "gbp_review_sentiment", "service_delivery", "evs", "browserstack"}
    manual = {"property_identity_matrix", "captain_memory", "captain_actions", "captain_watch_items", "captain_agent_runs", "captain_brief_runs"}
    if source_key in monthly:
        return "monthly"
    if source_key in weekly:
        return "weekly"
    if source_key in manual:
        return "manual_on_arrival"
    return "daily"


def build_source_checks(conn: sqlite3.Connection, identity: PropertyIdentity, manifest: dict[str, Any]) -> dict[str, SourceCheck]:
    bands = manifest["freshness_bands"]
    source_keys = sorted({
        source
        for routine in manifest["routines"]
        for source in [*routine.get("required_sources", []), *routine.get("optional_sources", [])]
    })
    checks: dict[str, SourceCheck] = {}
    for source_key in source_keys:
        latest, table_name, note = latest_source_date(conn, source_key, identity)
        cadence = source_cadence(source_key)
        age = age_days(latest)
        band = freshness_band(age, cadence, bands)
        if source_key.startswith("captain_") and latest is None and table_name and not table_exists(conn, table_name):
            band = "remote_runtime"
            note = "Captain runtime state is stored in remote D1 and checked by scripts/audit_captain_readiness.py."
        checks[source_key] = SourceCheck(
            source_key=source_key,
            cadence=cadence,
            latest_date=latest[:10] if latest else None,
            age_days=age,
            band=band,
            table_name=table_name,
            note=note,
        )
    return checks


def routine_status(required_sources: list[str], checks: dict[str, SourceCheck]) -> tuple[str, list[str]]:
    issue_sources = [source for source in required_sources if checks[source].band in {"missing", "stale"}]
    aging_sources = [source for source in required_sources if checks[source].band == "aging"]
    if issue_sources:
        return "not_ready", issue_sources
    if aging_sources:
        return "watch", aging_sources
    return "ready", []


def build_property_payload(conn: sqlite3.Connection, identity: PropertyIdentity, manifest: dict[str, Any]) -> dict[str, Any]:
    checks = build_source_checks(conn, identity, manifest)
    routines = []
    for routine in manifest["routines"]:
        status, issues = routine_status(routine["required_sources"], checks)
        routines.append({
            "routine_key": routine["routine_key"],
            "routine_name": routine["routine_name"],
            "captain_role": routine["captain_role"],
            "cadence": routine["cadence"],
            "status": status,
            "issue_sources": issues,
            "required_sources": routine["required_sources"],
            "optional_sources": routine.get("optional_sources", []),
        })
    readiness = Counter(row["status"] for row in routines)
    return {
        "property_id": identity.marketing_bi_property_id,
        "property_name": identity.property_name,
        "community_id": identity.community_id,
        "ga4_property_id": identity.ga4_property_id,
        "region": identity.encasa_region,
        "city": identity.city,
        "state": identity.state,
        "unit_count": identity.unit_count,
        "website_url": identity.website_url,
        "source_checks": {
            key: {
                "latest_date": check.latest_date,
                "age_days": check.age_days,
                "band": check.band,
                "cadence": check.cadence,
                "table_name": check.table_name,
                "note": check.note,
            }
            for key, check in checks.items()
        },
        "routine_summary": dict(readiness),
        "routines": routines,
        "overall_status": "not_ready" if readiness.get("not_ready") else "watch" if readiness.get("watch") else "ready",
    }


def write_outputs(payload: dict[str, Any], output_stem: Path) -> None:
    output_stem.parent.mkdir(parents=True, exist_ok=True)
    output_stem.with_suffix(".json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Captain Active Routine Audit",
        "",
        f"Date: {display_date(payload['generated_on'])}",
        f"Routine manifest: `{payload['manifest_version']}`",
        "",
        "## Summary",
        "",
        f"- Properties audited: `{payload['property_count']}`",
        f"- Ready: `{payload['overall_summary'].get('ready', 0)}`",
        f"- Watch: `{payload['overall_summary'].get('watch', 0)}`",
        f"- Not ready: `{payload['overall_summary'].get('not_ready', 0)}`",
        "",
        "## Property Routine Posture",
        "",
        "| Property | Overall | Ready | Watch | Not Ready | Main Gaps |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for row in payload["properties"]:
        gap_counter: Counter[str] = Counter()
        for routine in row["routines"]:
            for source in routine["issue_sources"]:
                gap_counter[source] += 1
        main_gaps = ", ".join(source for source, _ in gap_counter.most_common(5)) or "none"
        lines.append(
            f"| {row['property_id']} - {row['property_name']} | {row['overall_status']} | "
            f"{row['routine_summary'].get('ready', 0)} | {row['routine_summary'].get('watch', 0)} | "
            f"{row['routine_summary'].get('not_ready', 0)} | {main_gaps} |"
        )
    output_stem.with_suffix(".md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit active Captain routines and source freshness.")
    parser.add_argument("--property", help="Property name/code/alias to audit.")
    parser.add_argument("--all-properties", action="store_true", help="Audit all governed active identities instead of the current Captain activation roster.")
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR / f"captain_active_routine_audit_{today_iso()}")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    conn = connect()
    properties = [build_property_payload(conn, identity, manifest) for identity in selected_identities(args.property, args.all_properties)]
    overall = Counter(row["overall_status"] for row in properties)
    payload = {
        "generated_on": today_iso(),
        "manifest_version": manifest["version"],
        "property_count": len(properties),
        "overall_summary": dict(overall),
        "properties": properties,
    }
    write_outputs(payload, args.output)
    print(json.dumps({
        "json": str(args.output.with_suffix(".json")),
        "markdown": str(args.output.with_suffix(".md")),
        "property_count": len(properties),
        "overall_summary": dict(overall),
    }, indent=2))


if __name__ == "__main__":
    main()
