#!/usr/bin/env python3
"""Create or clear the explicit Resi Edge rollout scope lock."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / "config/portfolio_resi_edge_stabilization/active-resi-edge-scope-lock.json"
LOCK_VERSION = "2026-08-27.explicit-scope-lock-v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Set the explicit Resi Edge property/action scope lock.")
    parser.add_argument("--property-code", action="append", default=[], help="Allowed property code. Repeat with --domain.")
    parser.add_argument("--domain", action="append", default=[], help="Allowed domain. Repeat with --property-code.")
    parser.add_argument("--modes", nargs="+", choices=["plan", "stage", "apply"], default=["plan", "stage", "apply"])
    parser.add_argument("--reason", default="", help="Short current-turn approval note.")
    parser.add_argument("--hours", type=int, default=8, help="Expiration window. Default: 8 hours.")
    parser.add_argument("--clear", action="store_true", help="Clear the active scope lock.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    if args.clear:
        payload = {
            "version": LOCK_VERSION,
            "status": "INACTIVE",
            "scope_id": f"resi-edge-scope-cleared-{now.strftime('%Y%m%dT%H%M%SZ')}",
            "updated_at": now.isoformat(),
            "allowed_targets": [],
            "reason": args.reason or "Scope cleared.",
        }
        LOCK_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(payload, indent=2))
        return 0
    if not args.property_code or not args.domain or len(args.property_code) != len(args.domain):
        raise SystemExit("--property-code and --domain are required in matching pairs unless --clear is used.")
    if args.hours <= 0 or args.hours > 24:
        raise SystemExit("--hours must be between 1 and 24.")
    allowed_targets = [
        {
            "property_code": code.upper(),
            "domain": domain.lower(),
            "modes": args.modes,
        }
        for code, domain in zip(args.property_code, args.domain)
    ]
    payload = {
        "version": LOCK_VERSION,
        "status": "ACTIVE",
        "scope_id": f"resi-edge-scope-{now.strftime('%Y%m%dT%H%M%SZ')}",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=args.hours)).isoformat(),
        "reason": args.reason or "Explicit current-turn scope lock.",
        "allowed_targets": allowed_targets,
        "non_negotiables": [
            "Only the property/domain/mode listed here may run.",
            "No completed-site audit or repair is implied by this lock.",
            "Discovered adjacent evidence is not scope.",
            "Use the governed Resi Edge runner and stop on failed gates.",
        ],
    }
    LOCK_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
