#!/usr/bin/env python3
"""Build a cross-system Ops Watch packet from governed source packets.

This script is intentionally non-mutating. It assembles source readiness and
Captain-visible watch/action rows from source-specific packets such as the Jira
Captain Watch builder. MS365 lanes are represented by the source contract until
Keeper-backed Microsoft Graph auth exists.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_CONFIG = ROOT / "config" / "ops_watch_sources.json"
DEFAULT_JIRA_ROOT = ROOT / "reports" / "captains_log" / "jira_ticket_watch"
DEFAULT_CONFLUENCE_ROOT = ROOT / "reports" / "ops_watch" / "confluence_ops_watch"
DEFAULT_OUTPUT_ROOT = ROOT / "reports" / "ops_watch"
DISPLAY_TZ = ZoneInfo("America/Chicago")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a governed Ops Watch readout packet.")
    parser.add_argument("--source-config", type=Path, default=DEFAULT_SOURCE_CONFIG)
    parser.add_argument("--jira-packet", type=Path, action="append", default=[], help="Jira Captain Watch packet JSON. Defaults to latest packet.")
    parser.add_argument("--confluence-packet", type=Path, action="append", default=[], help="Confluence Ops Watch packet JSON. Defaults to latest packet when present.")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--run-id", help="Stable run id. Defaults to timestamped id.")
    parser.add_argument("--as-of", help="ISO timestamp for packet generation. Defaults to now.")
    args = parser.parse_args()

    as_of = parse_as_of(args.as_of)
    run_id = args.run_id or f"ops_watch_{as_of.strftime('%Y%m%dT%H%M%SZ')}"
    source_config = read_json(args.source_config)
    jira_packets = [read_json(path) for path in resolve_jira_packets(args.jira_packet)]
    confluence_packets = [read_json(path) for path in resolve_confluence_packets(args.confluence_packet)]
    records = normalize_records(jira_packets, confluence_packets)
    source_signals = normalize_source_signals(confluence_packets)
    source_readiness = build_source_readiness(source_config)
    output_dir = args.output_root / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    packet = {
        "run_id": run_id,
        "as_of": as_of.isoformat().replace("+00:00", "Z"),
        "source_config": str(args.source_config),
        "summary": summarize(records, source_signals, source_readiness, jira_packets, confluence_packets),
        "source_readiness": source_readiness,
        "source_signals": source_signals,
        "captain_records": records,
        "source_packets": source_packet_refs(jira_packets, confluence_packets),
        "governance": {
            "mutation_policy": "read_only_packet_generation",
            "credential_policy": "Keeper/KSM for credentials; Codex connector auth for connected Atlassian reads",
            "property_identity_policy": "source-specific builders must resolve property identity through the governed matrix",
            "publish_policy": "Captain Runtime writes require separate review/approval",
        },
    }

    (output_dir / "ops-watch-packet.json").write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_markdown(output_dir / "OPS_WATCH_READOUT.md", packet)
    write_source_readiness_csv(output_dir / "ops-watch-source-readiness.csv", source_readiness)
    write_source_signals_csv(output_dir / "ops-watch-source-signals.csv", source_signals)
    write_records_csv(output_dir / "ops-watch-captain-records.csv", records)

    print(f"Wrote Ops Watch packet with {len(records)} Captain record(s): {output_dir}")
    return 0


def parse_as_of(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc).replace(microsecond=0)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_jira_packets(explicit: list[Path]) -> list[Path]:
    if explicit:
        return explicit
    candidates = sorted(DEFAULT_JIRA_ROOT.glob("*/jira-captain-watch-packet.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    return candidates[:1]


def resolve_confluence_packets(explicit: list[Path]) -> list[Path]:
    if explicit:
        return explicit
    candidates = sorted(DEFAULT_CONFLUENCE_ROOT.glob("*/confluence-ops-watch-packet.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    return candidates[:1]


def normalize_records(jira_packets: list[dict[str, Any]], confluence_packets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for packet in jira_packets:
        run_id = str(packet.get("run_id") or "")
        for record in packet.get("captain_records", []):
            if not isinstance(record, dict):
                continue
            normalized = dict(record)
            normalized["source_system"] = "jira"
            normalized["source_run_id"] = run_id
            normalized["source_packet_as_of"] = packet.get("as_of")
            rows.append(normalized)
    for packet in confluence_packets:
        run_id = str(packet.get("run_id") or "")
        for record in packet.get("captain_records", []):
            if not isinstance(record, dict):
                continue
            normalized = dict(record)
            normalized["source_system"] = "confluence"
            normalized["source_run_id"] = run_id
            normalized["source_packet_as_of"] = packet.get("as_of")
            normalized["watch_status"] = normalized.get("status")
            rows.append(normalized)
    rows.sort(key=lambda row: (row.get("property_code") == "UNRESOLVED", str(row.get("property_name") or ""), severity_rank(str(row.get("severity") or "")), str(row.get("jira_key") or "")))
    return rows


def normalize_source_signals(confluence_packets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for packet in confluence_packets:
        run_id = str(packet.get("run_id") or "")
        for signal in packet.get("source_signals", []):
            if not isinstance(signal, dict):
                continue
            normalized = dict(signal)
            normalized["source_run_id"] = run_id
            normalized["source_packet_as_of"] = packet.get("as_of")
            rows.append(normalized)
    rows.sort(key=lambda row: (severity_rank(str(row.get("severity") or "")), str(row.get("title") or "")))
    return rows


def build_source_readiness(source_config: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for source in source_config.get("sources", []):
        if not isinstance(source, dict):
            continue
        status = str(source.get("status") or "unknown")
        blocker = ""
        if "blocked_pending_keeper" in status:
            blocker = "Add the Microsoft Graph credential contract to Keeper/KSM before this lane can harvest."
        elif status == "review_required":
            blocker = "Requires reviewed publish approval before mutation."
        elif status == "connector_ready_not_harvested":
            blocker = "Connector is available; define query scope and cadence before scheduled harvest."
        rows.append(
            {
                "source_key": source.get("source_key"),
                "display_name": source.get("display_name"),
                "system": source.get("system"),
                "status": status,
                "credential_source": source.get("credential_source"),
                "harvest_mode": source.get("harvest_mode"),
                "captain_visibility": source.get("captain_visibility"),
                "default_cadence": source.get("default_cadence"),
                "blocker": blocker,
                "action_boundary": source.get("action_boundary"),
            }
        )
    return rows


def summarize(
    records: list[dict[str, Any]],
    source_signals: list[dict[str, Any]],
    readiness: list[dict[str, Any]],
    jira_packets: list[dict[str, Any]],
    confluence_packets: list[dict[str, Any]],
) -> dict[str, Any]:
    properties = {str(row.get("property_code")) for row in records if row.get("property_code") and row.get("property_code") != "UNRESOLVED"}
    critical = [row for row in records if row.get("severity") == "critical"]
    pending_vendor = [row for row in records if str(row.get("jira_status") or "").lower() == "pending vendor"]
    stale = [row for row in records if int(row.get("stale_days") or 0) >= 14]
    blocked_sources = [row for row in readiness if str(row.get("status") or "").startswith("blocked")]
    connector_ready_sources = [row for row in readiness if row.get("status") == "connector_ready_not_harvested"]
    return {
        "source_count": len(readiness),
        "active_source_count": len([row for row in readiness if "active" in str(row.get("status") or "")]),
        "blocked_source_count": len(blocked_sources),
        "connector_ready_not_harvested_count": len(connector_ready_sources),
        "jira_packet_count": len(jira_packets),
        "confluence_packet_count": len(confluence_packets),
        "source_signal_count": len(source_signals),
        "high_source_signal_count": len([row for row in source_signals if row.get("severity") in {"high", "critical"}]),
        "captain_record_count": len(records),
        "property_count": len(properties),
        "critical_record_count": len(critical),
        "pending_vendor_record_count": len(pending_vendor),
        "stale_14_day_record_count": len(stale),
        "unresolved_record_count": len([row for row in records if row.get("property_code") == "UNRESOLVED"]),
    }


def source_packet_refs(jira_packets: list[dict[str, Any]], confluence_packets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    refs = []
    for packet in jira_packets:
        refs.append(
            {
                "source_system": packet.get("source", {}).get("system", "Jira"),
                "run_id": packet.get("run_id"),
                "as_of": packet.get("as_of"),
                "summary": packet.get("summary", {}),
            }
        )
    for packet in confluence_packets:
        refs.append(
            {
                "source_system": packet.get("source", {}).get("system", "Confluence"),
                "run_id": packet.get("run_id"),
                "as_of": packet.get("as_of"),
                "summary": packet.get("summary", {}),
            }
        )
    return refs


def write_markdown(path: Path, packet: dict[str, Any]) -> None:
    summary = packet["summary"]
    lines = [
        "# Ops Watch Readout",
        "",
        f"Generated: {human_datetime(packet['as_of'])}",
        "",
        "## Portfolio Signal",
        "",
        f"- Sources in contract: {summary['source_count']}",
        f"- Active harvest sources: {summary['active_source_count']}",
        f"- Sources blocked on Keeper/Graph or review: {summary['blocked_source_count']}",
        f"- Connector-ready sources not yet harvested: {summary['connector_ready_not_harvested_count']}",
        f"- Source signals in this packet: {summary['source_signal_count']}",
        f"- High source signals: {summary['high_source_signal_count']}",
        f"- Captain records in this packet: {summary['captain_record_count']}",
        f"- Properties with active visibility: {summary['property_count']}",
        f"- Critical records: {summary['critical_record_count']}",
        f"- Pending vendor records: {summary['pending_vendor_record_count']}",
        f"- Stale 14+ day records: {summary['stale_14_day_record_count']}",
        f"- Unresolved property records: {summary['unresolved_record_count']}",
        "",
        "## Source Readiness",
        "",
        "| Source | System | Status | Cadence | Blocker / Next Step |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in packet["source_readiness"]:
        lines.append(
            "| {name} | {system} | {status} | {cadence} | {blocker} |".format(
                name=escape_md(str(row.get("display_name") or "")),
                system=escape_md(str(row.get("system") or "")),
                status=escape_md(str(row.get("status") or "")),
                cadence=escape_md(str(row.get("default_cadence") or "")),
                blocker=escape_md(str(row.get("blocker") or "Ready under current boundary.")),
            )
        )
    lines.extend(
        [
            "",
            "## Source Signals",
            "",
            "| Severity | Source | Category | Item | Owner Lane | Next Move |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
    )
    for row in packet["source_signals"]:
        item = str(row.get("title") or row.get("signal_key") or "")
        url = str(row.get("url") or "")
        linked_item = f"[{escape_md(item)}]({url})" if item and url else escape_md(item)
        lines.append(
            "| {severity} | {source} | {category} | {item} | {owner} | {next_move} |".format(
                severity=escape_md(str(row.get("severity") or "")),
                source=escape_md(str(row.get("source_system") or "")),
                category=escape_md(str(row.get("category") or "")),
                item=linked_item,
                owner=escape_md(str(row.get("owner_role") or "")),
                next_move=escape_md(str(row.get("next_move") or "")),
            )
        )
    if not packet["source_signals"]:
        lines.append("| - | - | - | - | - | No source-signal packet supplied yet. |")
    lines.extend(
        [
            "",
            "## Captain Queue",
            "",
            "| Property | Source | Item | Severity | Status | Updated | Next Move |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for row in packet["captain_records"]:
        item = str(row.get("jira_key") or row.get("watch_key") or "")
        url = str(row.get("jira_url") or row.get("url") or "")
        linked_item = f"[{item}]({url})" if item and url else item
        lines.append(
            "| {property} | {source} | {item} | {severity} | {status} | {updated} | {next_move} |".format(
                property=escape_md(f"{row.get('property_code')} {row.get('property_name')}"),
                source=escape_md(str(row.get("source_system") or "")),
                item=linked_item,
                severity=escape_md(str(row.get("severity") or "")),
                status=escape_md(str(row.get("jira_status") or row.get("watch_status") or "")),
                updated=human_date(row.get("updated")),
                next_move=escape_md(str(row.get("next_move") or "")),
            )
        )
    if not packet["captain_records"]:
        lines.append("| - | - | - | - | - | - | No source packet supplied yet. |")
    lines.extend(
        [
            "",
            "## Guardrails",
            "",
            "- This packet is read-only. It does not write Jira, Confluence, Microsoft 365, D1, Captain Runtime, Cloudflare, or PIB.",
            "- Microsoft 365 lanes require Keeper/KSM-backed Graph credentials before harvest.",
            "- Captain Runtime publish remains a separate reviewed approval step.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def write_source_readiness_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = ["source_key", "display_name", "system", "status", "credential_source", "harvest_mode", "captain_visibility", "default_cadence", "blocker", "action_boundary"]
    write_csv(path, fields, rows)


def write_source_signals_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = ["signal_key", "source_system", "title", "url", "category", "severity", "status", "owner_role", "next_move", "source_run_id"]
    write_csv(path, fields, rows)


def write_records_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = ["property_code", "property_name", "source_system", "jira_key", "jira_url", "title", "url", "severity", "priority", "jira_status", "updated", "stale_days", "category", "owner_role", "next_move", "source_run_id"]
    write_csv(path, fields, rows)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fields})


def human_date(value: Any) -> str:
    if not value:
        return "-"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.astimezone(DISPLAY_TZ).strftime("%m/%d/%Y")


def human_datetime(value: Any) -> str:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.astimezone(DISPLAY_TZ).strftime("%m/%d/%Y %I:%M %p CT").lstrip("0").replace("/0", "/")


def severity_rank(severity: str) -> int:
    return {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(severity.lower(), 4)


def escape_md(value: str) -> str:
    return value.replace("|", "\\|")


if __name__ == "__main__":
    raise SystemExit(main())
