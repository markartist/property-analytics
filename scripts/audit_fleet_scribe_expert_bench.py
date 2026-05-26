#!/usr/bin/env python3
"""Audit Fleet Scribe expert-bench readiness from Captain routine source checks."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
BENCH_MANIFEST_PATH = ROOT / "config" / "fleet_scribe_expert_bench_manifest.json"
ROUTINE_OUTPUT_DIR = ROOT / "reports" / "captains_log" / "routines"
OUTPUT_DIR = ROOT / "reports" / "fleet_scribe" / "expert_bench"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from scripts.audit_captain_active_routines import connect, display_date, selected_identities, today_iso  # noqa: E402
from scripts.audit_captain_active_routines import build_property_payload as build_routine_payload  # noqa: E402


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def latest_routine_payload() -> dict[str, Any] | None:
    candidates = sorted(ROUTINE_OUTPUT_DIR.glob("captain_active_routine_audit_*.json"))
    if not candidates:
        return None
    return load_json(candidates[-1])


def source_status(source_key: str, routine_payload: dict[str, Any]) -> dict[str, Any]:
    checks = routine_payload.get("source_checks", {})
    if source_key in checks:
        return checks[source_key]
    return {
        "latest_date": None,
        "age_days": None,
        "band": "unmapped",
        "cadence": None,
        "table_name": None,
        "note": "This expert source is conceptual or not yet mapped to a Data Pond source check.",
    }


def expert_status(expert: dict[str, Any], routine_payload: dict[str, Any]) -> tuple[str, list[str]]:
    issue_sources = []
    advisory_sources = []
    for source in expert.get("primary_sources", []):
        status = source_status(source, routine_payload)
        band = str(status.get("band") or "")
        if band in {"missing", "stale"}:
            issue_sources.append(source)
        elif band in {"unmapped", "aging", "remote_runtime"}:
            advisory_sources.append(source)
    for source in expert.get("optional_sources", []):
        status = source_status(source, routine_payload)
        band = str(status.get("band") or "")
        if band in {"missing", "stale", "unmapped", "aging", "remote_runtime"}:
            advisory_sources.append(source)
    if issue_sources:
        return "not_ready", issue_sources
    if advisory_sources:
        return "watch", advisory_sources
    return "ready", []


def build_property_bench(property_payload: dict[str, Any], bench_manifest: dict[str, Any]) -> dict[str, Any]:
    experts = []
    for expert in bench_manifest["experts"]:
        status, issue_sources = expert_status(expert, property_payload)
        experts.append({
            "expert_key": expert["expert_key"],
            "display_name": expert["display_name"],
            "plain_role": expert["plain_role"],
            "adjustment_point": expert["adjustment_point"],
            "status": status,
            "issue_sources": issue_sources,
            "primary_sources": expert["primary_sources"],
            "optional_sources": expert.get("optional_sources", []),
            "output_contract": expert["output_contract"],
            "do_not_allow": expert.get("do_not_allow", []),
        })
    summary = Counter(row["status"] for row in experts)
    return {
        "property_id": property_payload["property_id"],
        "property_name": property_payload["property_name"],
        "region": property_payload.get("region"),
        "overall_status": "not_ready" if summary.get("not_ready") else "watch" if summary.get("watch") else "ready",
        "expert_summary": dict(summary),
        "experts": experts,
    }


def build_payload(property_ref: str | None, all_properties: bool) -> dict[str, Any]:
    bench_manifest = load_json(BENCH_MANIFEST_PATH)
    routine_manifest = load_json(ROOT / "config" / "captain_active_routine_manifest.json")
    conn = connect()
    identities = selected_identities(property_ref, all_properties)
    routine_properties = [build_routine_payload(conn, identity, routine_manifest) for identity in identities]
    properties = [build_property_bench(row, bench_manifest) for row in routine_properties]
    overall = Counter(row["overall_status"] for row in properties)
    return {
        "generated_on": today_iso(),
        "bench_manifest_version": bench_manifest["version"],
        "property_count": len(properties),
        "overall_summary": dict(overall),
        "publication_chain": bench_manifest["publication_chain"],
        "fleet_scribe_office": bench_manifest["fleet_scribe_office"],
        "properties": properties,
    }


def write_outputs(payload: dict[str, Any], output_stem: Path) -> None:
    output_stem.parent.mkdir(parents=True, exist_ok=True)
    output_stem.with_suffix(".json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    lines = [
        "# Fleet Scribe Expert Bench Audit",
        "",
        f"Date: {display_date(payload['generated_on'])}",
        f"Bench manifest: `{payload['bench_manifest_version']}`",
        "",
        "## Summary",
        "",
        f"- Properties audited: `{payload['property_count']}`",
        f"- Ready: `{payload['overall_summary'].get('ready', 0)}`",
        f"- Watch: `{payload['overall_summary'].get('watch', 0)}`",
        f"- Not ready: `{payload['overall_summary'].get('not_ready', 0)}`",
        "",
        "## Property Expert-Bench Posture",
        "",
        "| Property | Overall | Ready | Watch | Not Ready | Main Expert Gaps |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for row in payload["properties"]:
        gap_counter: Counter[str] = Counter()
        for expert in row["experts"]:
            if expert["status"] == "not_ready":
                gap_counter[expert["display_name"]] += len(expert["issue_sources"]) or 1
        main_gaps = ", ".join(name for name, _ in gap_counter.most_common(5)) or "none"
        lines.append(
            f"| {row['property_id']} - {row['property_name']} | {row['overall_status']} | "
            f"{row['expert_summary'].get('ready', 0)} | {row['expert_summary'].get('watch', 0)} | "
            f"{row['expert_summary'].get('not_ready', 0)} | {main_gaps} |"
        )
    output_stem.with_suffix(".md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit Fleet Scribe expert-bench readiness.")
    parser.add_argument("--property", help="Property name/code/alias to audit.")
    parser.add_argument("--all-properties", action="store_true", help="Audit all governed identities instead of the active Captain roster.")
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR / f"fleet_scribe_expert_bench_audit_{today_iso()}")
    args = parser.parse_args()
    if args.property and not resolve_property_identity(args.property):
        raise SystemExit(f"Could not resolve property through identity matrix: {args.property}")
    payload = build_payload(args.property, args.all_properties)
    write_outputs(payload, args.output)
    print(json.dumps({
        "json": str(args.output.with_suffix(".json")),
        "markdown": str(args.output.with_suffix(".md")),
        "property_count": payload["property_count"],
        "overall_summary": payload["overall_summary"],
    }, indent=2))


if __name__ == "__main__":
    main()
