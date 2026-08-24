#!/usr/bin/env python3
"""Audit Captain fleet readiness using governed identity, local source freshness, and remote D1 activation state."""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from captain_fleet_support import DB_PATH, ROOT, age_days, build_fleet_context, freshness_band, remote_d1_query, today_ymd

OUTPUT_DIR = ROOT / "reports" / "captains_log" / "readiness"
EXPECTED_SUPPORT_AGENTS = 11


def today_display() -> str:
    return date.today().strftime("%m/%d/%Y")


def fetch_local_dates() -> dict[str, dict[str, str | None]]:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    def latest_map(query: str) -> dict[str, str | None]:
        return {str(row[0]): row[1] for row in cur.execute(query).fetchall()}

    return {
        "ga4": latest_map("SELECT property_id, MAX(metric_date) FROM ga4_daily_metrics GROUP BY property_id"),
        "gsc": latest_map(
            "SELECT COALESCE(ga4_property_id, property_id), MAX(metric_date) FROM gsc_daily_metrics GROUP BY COALESCE(ga4_property_id, property_id)"
        ),
        "guest_cards": latest_map("SELECT property_code, MAX(run_date) FROM guest_card_metrics GROUP BY property_code"),
        "unit_feed": latest_map("SELECT property_id, MAX(snapshot_date) FROM unit_availability_units GROUP BY property_id"),
    }


def fetch_remote_status() -> dict[str, dict[str, Any]]:
    support_rows = remote_d1_query(
        """
        SELECT property_id,
               COUNT(*) AS support_agent_count,
               MAX(CASE WHEN role = 'Brief assembly' THEN json_extract(source_scope_json, '$.scope_type') END) AS scope_type,
               MAX(CASE WHEN role = 'Brief assembly' THEN json_extract(source_scope_json, '$.designation') END) AS designation,
               MAX(CASE WHEN role = 'Brief assembly' THEN json_extract(source_scope_json, '$.market') END) AS market
        FROM captain_support_agents
        WHERE status = 'active'
        GROUP BY property_id
        """
    )
    memory_rows = remote_d1_query(
        """
        SELECT json_extract(structured_payload_json, '$.property_code') AS property_code,
               COUNT(*) AS active_memory_count,
               MAX(created_at) AS latest_memory_at
        FROM governed_memory_entries
        WHERE source_system = 'captain_activation' AND status = 'active'
        GROUP BY json_extract(structured_payload_json, '$.property_code')
        """
    )
    run_rows = remote_d1_query(
        """
        SELECT property_id,
               COUNT(*) AS lifetime_runs,
               SUM(CASE WHEN finished_at >= datetime('now', '-14 day') THEN 1 ELSE 0 END) AS runs_last_14d,
               MAX(finished_at) AS latest_run_at
        FROM captain_agent_runs
        GROUP BY property_id
        """
    )
    watch_rows = remote_d1_query(
        """
        SELECT property_id,
               SUM(CASE WHEN status IN ('open', 'monitoring', 'escalated') THEN 1 ELSE 0 END) AS open_watch_items,
               SUM(CASE WHEN status IN ('open', 'monitoring', 'escalated') AND severity IN ('high', 'critical') THEN 1 ELSE 0 END) AS high_watch_items
        FROM captain_watch_items
        GROUP BY property_id
        """
    )
    action_rows = remote_d1_query(
        """
        SELECT property_id,
               SUM(CASE WHEN status IN ('open', 'in_progress', 'blocked') THEN 1 ELSE 0 END) AS open_actions,
               SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_actions,
               SUM(CASE WHEN status IN ('open', 'in_progress', 'blocked') AND priority IN ('high', 'critical') THEN 1 ELSE 0 END) AS high_priority_actions
        FROM captain_actions
        GROUP BY property_id
        """
    )

    merged: dict[str, dict[str, Any]] = {}
    for rows in [support_rows, memory_rows, run_rows, watch_rows, action_rows]:
        for row in rows:
            key = str(row.get("property_id") or row.get("property_code") or "")
            if not key:
                continue
            merged.setdefault(key, {}).update(row)
    return merged


def classify(row: dict[str, Any]) -> str:
    hard_fail = row["support_agent_count"] < EXPECTED_SUPPORT_AGENTS or row["active_memory_count"] < 1
    source_bands = [row["ga4_band"], row["gsc_band"], row["guest_cards_band"], row["unit_feed_band"]]
    stale_count = sum(1 for band in source_bands if band in {"stale", "missing"})
    if hard_fail:
        return "activation_gap"
    if stale_count == 0 and row["runs_last_14d"] > 0:
        return "ready"
    if stale_count <= 1:
        return "partial"
    return "source_gap"


def build_rows() -> list[dict[str, Any]]:
    context = build_fleet_context()
    local_dates = fetch_local_dates()
    remote = fetch_remote_status()
    manifest_rows_by_code = {
        str(row["property_code"]): row
        for row in context.manifest.get("properties", [])
        if row.get("property_code")
    }
    active_remote_codes = sorted(
        code
        for code, row in remote.items()
        if int(row.get("support_agent_count") or 0) > 0 or int(row.get("active_memory_count") or 0) > 0
    )
    if len(active_remote_codes) > len(manifest_rows_by_code):
        source_rows = [
            {
                "property_code": code,
                "property_name": (
                    context.identities.get(code).property_name
                    if context.identities.get(code)
                    else manifest_rows_by_code.get(code, {}).get("property_name", code)
                ),
                "captain": manifest_rows_by_code.get(code, {}).get("captain", f"Captain {code}"),
                "scope_type": manifest_rows_by_code.get(code, {}).get("scope_type"),
                "designation": manifest_rows_by_code.get(code, {}).get("designation"),
                "market": manifest_rows_by_code.get(code, {}).get("market"),
                "ga4_property_id": (
                    context.identities.get(code).ga4_property_id
                    if context.identities.get(code)
                    else manifest_rows_by_code.get(code, {}).get("ga4_property_id")
                ),
            }
            for code in active_remote_codes
        ]
    else:
        source_rows = context.manifest.get("properties", [])
    rows: list[dict[str, Any]] = []
    for manifest_row in source_rows:
        code = manifest_row["property_code"]
        identity = context.identities.get(code)
        remote_row = remote.get(code, {})
        ga4_latest = local_dates["ga4"].get(manifest_row["ga4_property_id"])
        gsc_latest = local_dates["gsc"].get(manifest_row["ga4_property_id"])
        guest_latest = local_dates["guest_cards"].get(code)
        unit_latest = local_dates["unit_feed"].get(manifest_row["ga4_property_id"])
        row = {
            "property_code": code,
            "property_name": manifest_row["property_name"],
            "captain": manifest_row["captain"],
            "scope_type": remote_row.get("scope_type") or manifest_row.get("scope_type"),
            "designation": remote_row.get("designation") or manifest_row.get("designation"),
            "market": remote_row.get("market") or manifest_row.get("market"),
            "community_id_present": bool(identity and identity.community_id),
            "property_code_present": bool(identity and identity.property_code),
            "ga4_property_id_present": bool(identity and identity.ga4_property_id),
            "support_agent_count": int(remote_row.get("support_agent_count") or 0),
            "active_memory_count": int(remote_row.get("active_memory_count") or 0),
            "lifetime_runs": int(remote_row.get("lifetime_runs") or 0),
            "runs_last_14d": int(remote_row.get("runs_last_14d") or 0),
            "latest_run_at": remote_row.get("latest_run_at"),
            "open_watch_items": int(remote_row.get("open_watch_items") or 0),
            "high_watch_items": int(remote_row.get("high_watch_items") or 0),
            "open_actions": int(remote_row.get("open_actions") or 0),
            "blocked_actions": int(remote_row.get("blocked_actions") or 0),
            "high_priority_actions": int(remote_row.get("high_priority_actions") or 0),
            "ga4_latest": ga4_latest,
            "gsc_latest": gsc_latest,
            "guest_cards_latest": guest_latest,
            "unit_feed_latest": unit_latest,
        }
        for prefix, latest in [
            ("ga4", ga4_latest),
            ("gsc", gsc_latest),
            ("guest_cards", guest_latest),
            ("unit_feed", unit_latest),
        ]:
            age = age_days(latest)
            row[f"{prefix}_age_days"] = age
            row[f"{prefix}_band"] = freshness_band(age, current_days=7, aging_days=14)
        row["readiness"] = classify(row)
        issues: list[str] = []
        if row["support_agent_count"] < EXPECTED_SUPPORT_AGENTS:
            issues.append("support-agent gap")
        if row["active_memory_count"] < 1:
            issues.append("activation memory missing")
        if row["runs_last_14d"] < 1:
            issues.append("no recent runtime")
        for label in ["ga4", "gsc", "guest_cards", "unit_feed"]:
            if row[f"{label}_band"] in {"stale", "missing"}:
                issues.append(f"{label} {row[f'{label}_band']}")
        if "spotlight" in str(row["scope_type"] or "") and not row["designation"]:
            issues.append("spotlight designation missing")
        row["issues"] = issues
        rows.append(row)
    return rows


def write_outputs(rows: list[dict[str, Any]], output_stem: Path) -> None:
    summary = Counter(row["readiness"] for row in rows)
    designation_mix = Counter((row["designation"] or "Unspecified") for row in rows)
    payload = {
        "generated_on": today_ymd(),
        "property_count": len(rows),
        "expected_support_agents_per_property": EXPECTED_SUPPORT_AGENTS,
        "readiness_summary": dict(summary),
        "designation_mix": dict(designation_mix),
        "properties": rows,
    }
    output_stem.with_suffix(".json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    worst = sorted(rows, key=lambda row: (row["readiness"], -len(row["issues"]), -row["high_watch_items"], -row["blocked_actions"]))
    lines = [
        "# Captain Readiness Audit",
        "",
        f"Date: {today_display()}",
        "",
        "## Summary",
        "",
        f"- Properties audited: `{len(rows)}`",
        f"- Ready: `{summary.get('ready', 0)}`",
        f"- Partial: `{summary.get('partial', 0)}`",
        f"- Source gap: `{summary.get('source_gap', 0)}`",
        f"- Activation gap: `{summary.get('activation_gap', 0)}`",
        "",
        "## Designation Mix",
        "",
    ]
    for key, value in sorted(designation_mix.items()):
        lines.append(f"- `{key}`: `{value}`")
    lines.extend([
        "",
        "## Top Readiness Gaps",
        "",
        "| Property | Scope | Readiness | Key Issues |",
        "| --- | --- | --- | --- |",
    ])
    for row in worst[:20]:
        issues = ", ".join(row["issues"][:4]) or "none"
        lines.append(f"| {row['property_code']} - {row['property_name']} | {row['scope_type'] or 'unknown'} | {row['readiness']} | {issues} |")
    output_stem.with_suffix(".md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit Captain fleet readiness.")
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR / f"captain_readiness_audit_{today_ymd()}")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    rows = build_rows()
    write_outputs(rows, args.output)
    summary = Counter(row["readiness"] for row in rows)
    print(json.dumps({
        "json": str(args.output.with_suffix('.json')),
        "markdown": str(args.output.with_suffix('.md')),
        "property_count": len(rows),
        "readiness_summary": dict(summary),
    }, indent=2))


if __name__ == "__main__":
    main()
