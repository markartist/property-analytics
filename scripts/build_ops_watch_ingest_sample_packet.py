#!/usr/bin/env python3
"""
Build a sanitized sample Ops Watch mirror/push packet.

This does not send data and does not read secrets. It gives internal scheduled
jobs a stable payload shape to produce before signing and pushing to Cloudflare.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_packet(source: str, run_id: str) -> dict:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {
        "source": source,
        "source_label": "Internal IT Help mirror",
        "run_id": run_id,
        "generated_at": now,
        "producer": "internal-ops-watch-exporter",
        "schema_version": "ops-watch-ingest-v1",
        "records": [
            {
                "source_id": "BITS-116269",
                "source_url": "https://venterra.atlassian.net/browse/BITS-116269",
                "title": "Request Microsoft Entra app registration access for Ops Watch",
                "status": "Open",
                "owner": "Business IT Services",
                "updated_at": now,
                "property_refs": [],
                "severity": "high",
                "signal_type": "access_blocker",
                "summary": "Need a dedicated app registration or least-privilege role path for Microsoft Graph Ops Watch setup.",
                "allowed_next_actions": ["follow_up", "request_status_update"],
            }
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a sample Ops Watch ingest packet.")
    parser.add_argument("--source", default="intranet_it_help")
    parser.add_argument("--run-id", default=f"sample-{utc_stamp()}")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    packet = build_packet(args.source, args.run_id)
    rendered = json.dumps(packet, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(args.output)
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
