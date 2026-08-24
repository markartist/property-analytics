#!/usr/bin/env python3
"""Build the static Data Pond Ops Watch snapshot from the latest local packet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACKET_ROOT = ROOT / "reports" / "ops_watch"
DEFAULT_OUTPUT = ROOT / "apps" / "web" / "src" / "lib" / "ops-watch" / "generated-snapshot.ts"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the Data Pond Ops Watch TypeScript snapshot.")
    parser.add_argument("--packet", type=Path, help="Explicit ops-watch-packet.json path. Defaults to latest packet.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    packet_path = (args.packet or latest_packet(DEFAULT_PACKET_ROOT)).resolve()
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    snapshot = build_snapshot(packet, packet_path)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_typescript(snapshot), encoding="utf-8")
    print(f"Wrote Ops Watch Pond snapshot from {packet_path} to {args.output}")
    return 0


def latest_packet(root: Path) -> Path:
    candidates = sorted(root.glob("ops-watch-*/ops-watch-packet.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not candidates:
        raise SystemExit(f"No ops-watch-packet.json files found under {root}")
    return candidates[0]


def build_snapshot(packet: dict[str, Any], packet_path: Path) -> dict[str, Any]:
    records = [record for record in packet.get("captain_records", []) if isinstance(record, dict)]
    signals = [signal for signal in packet.get("source_signals", []) if isinstance(signal, dict)]
    readiness = [row for row in packet.get("source_readiness", []) if isinstance(row, dict)]
    return {
        "runId": str(packet.get("run_id") or ""),
        "asOf": str(packet.get("as_of") or ""),
        "generatedFrom": str(packet_path.relative_to(ROOT)),
        "readoutPath": str((packet_path.parent / "OPS_WATCH_READOUT.md").relative_to(ROOT)),
        "summary": packet.get("summary") or {},
        "sourceReadiness": [readiness_row(row) for row in readiness],
        "sourceSignals": [source_signal(row) for row in signals[:12]],
        "captainRecords": [captain_record(row) for row in records[:36]],
        "sourcePackets": [source_packet_ref(row) for row in packet.get("source_packets", []) if isinstance(row, dict)],
        "governance": {
            "mutationPolicy": str(packet.get("governance", {}).get("mutation_policy") or "read_only_packet_generation"),
            "publishPolicy": str(packet.get("governance", {}).get("publish_policy") or "Captain Runtime writes require separate review/approval"),
            "actionMode": "assisted_action_drafts_only",
        },
    }


def readiness_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceKey": clean(row.get("source_key")),
        "displayName": clean(row.get("display_name")),
        "system": clean(row.get("system")),
        "status": clean(row.get("status")),
        "credentialSource": clean(row.get("credential_source")),
        "harvestMode": clean(row.get("harvest_mode")),
        "captainVisibility": clean(row.get("captain_visibility")),
        "defaultCadence": clean(row.get("default_cadence")),
        "blocker": clean(row.get("blocker")),
        "actionBoundary": clean(row.get("action_boundary")),
    }


def source_signal(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "signalKey": clean(row.get("signal_key")),
        "title": clean(row.get("title")),
        "url": clean(row.get("url")),
        "category": clean(row.get("category")),
        "severity": clean(row.get("severity")),
        "status": clean(row.get("status")),
        "ownerRole": clean(row.get("owner_role")),
        "nextMove": clean(row.get("next_move")),
        "updated": nullable(row.get("updated")),
    }


def captain_record(row: dict[str, Any]) -> dict[str, Any]:
    item_key = row.get("jira_key") or row.get("watch_key") or row.get("signal_key")
    item_url = row.get("jira_url") or row.get("url")
    return {
        "propertyCode": clean(row.get("property_code")),
        "propertyName": clean(row.get("property_name")),
        "sourceSystem": clean(row.get("source_system")),
        "itemKey": clean(item_key),
        "itemUrl": clean(item_url),
        "severity": clean(row.get("severity")),
        "priority": clean(row.get("priority")),
        "status": clean(row.get("jira_status") or row.get("watch_status") or row.get("status")),
        "updated": nullable(row.get("updated")),
        "staleDays": row.get("stale_days") if isinstance(row.get("stale_days"), int) else None,
        "category": clean(row.get("category")),
        "ownerRole": clean(row.get("owner_role")),
        "nextMove": clean(row.get("next_move")),
    }


def source_packet_ref(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceSystem": clean(row.get("source_system")),
        "runId": clean(row.get("run_id")),
        "asOf": nullable(row.get("as_of")),
        "summary": row.get("summary") if isinstance(row.get("summary"), dict) else {},
    }


def clean(value: Any) -> str:
    return str(value or "")


def nullable(value: Any) -> str | None:
    return str(value) if value else None


def render_typescript(snapshot: dict[str, Any]) -> str:
    payload = json.dumps(snapshot, indent=2, sort_keys=True)
    return (
        "import type { OpsWatchSnapshot } from \"./types\";\n\n"
        "// Generated by scripts/build_ops_watch_pond_snapshot.py. Do not edit by hand.\n"
        f"export const OPS_WATCH_SNAPSHOT: OpsWatchSnapshot = {payload};\n"
    )


if __name__ == "__main__":
    raise SystemExit(main())
