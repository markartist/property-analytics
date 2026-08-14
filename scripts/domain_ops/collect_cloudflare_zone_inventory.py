#!/usr/bin/env python3
"""Collect a read-only Cloudflare zone inventory packet.

This script lists zones visible to the Keeper-backed Cloudflare token and writes
sanitized operational inventory artifacts. It does not create zones, edit DNS
records, update settings, or mutate account state.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ops.cloudflare.cloudflare_auth import CloudflareAuthError, resolve_cloudflare_token


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"


@dataclass
class ZoneInventoryRow:
    name: str
    status: Optional[str]
    paused: Optional[bool]
    type: Optional[str]
    development_mode: Optional[int]
    original_registrar: Optional[str]
    original_dnshost: Optional[str]
    plan_name: Optional[str]
    account_name: Optional[str]
    zone_id: Optional[str]
    name_servers: str
    original_name_servers: str
    created_on: Optional[str]
    modified_on: Optional[str]


def fetch_json(path: str, token: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    request = urllib.request.Request(
        f"{CLOUDFLARE_API_BASE}{path}{query}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "PropertyAnalytics-DomainOps/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def compact_list(values: Any) -> str:
    if not isinstance(values, list):
        return ""
    return ";".join(str(value).strip().lower() for value in values if str(value).strip())


def collect_zones(token: str) -> list[ZoneInventoryRow]:
    rows: list[ZoneInventoryRow] = []
    page = 1
    while True:
        payload = fetch_json("/zones", token, {"page": page, "per_page": 50})
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare zone list failed: {payload.get('errors')}")
        for zone in payload.get("result") or []:
            plan = zone.get("plan") if isinstance(zone.get("plan"), dict) else {}
            account = zone.get("account") if isinstance(zone.get("account"), dict) else {}
            rows.append(
                ZoneInventoryRow(
                    name=str(zone.get("name") or "").lower(),
                    status=zone.get("status"),
                    paused=zone.get("paused"),
                    type=zone.get("type"),
                    development_mode=zone.get("development_mode"),
                    original_registrar=zone.get("original_registrar"),
                    original_dnshost=zone.get("original_dnshost"),
                    plan_name=plan.get("name"),
                    account_name=account.get("name"),
                    zone_id=zone.get("id"),
                    name_servers=compact_list(zone.get("name_servers")),
                    original_name_servers=compact_list(zone.get("original_name_servers")),
                    created_on=zone.get("created_on"),
                    modified_on=zone.get("modified_on"),
                )
            )
        info = payload.get("result_info") or {}
        total_pages = int(info.get("total_pages") or page)
        if page >= total_pages:
            break
        page += 1
    return rows


def write_csv(path: Path, rows: list[ZoneInventoryRow]) -> None:
    fieldnames = list(ZoneInventoryRow.__annotations__.keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row.__dict__)


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect read-only Cloudflare zone inventory.")
    parser.add_argument("--output-dir", type=Path, help="Output directory. Defaults to reports/domain_ops/<run_id>.")
    args = parser.parse_args()

    try:
        resolved = resolve_cloudflare_token()
    except CloudflareAuthError as exc:
        raise SystemExit(f"Cloudflare credential resolution failed: {exc}") from exc

    rows = collect_zones(resolved.token)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_cloudflare_zone_inventory")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary = {
        "run_type": "cloudflare_zone_inventory",
        "generated_at_utc": generated_at,
        "credential_source": resolved.source,
        "mutations_performed": False,
        "zones_total": len(rows),
        "zones_active": sum(1 for row in rows if row.status == "active"),
        "zones_pending": sum(1 for row in rows if row.status == "pending"),
        "zones_paused": sum(1 for row in rows if row.paused),
    }
    write_csv(output_dir / "cloudflare_zones.csv", rows)
    write_json(output_dir / "cloudflare_zones.json", [row.__dict__ for row in rows])
    write_json(output_dir / "summary.json", summary)
    print(json.dumps({"output_dir": str(output_dir), **summary}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
