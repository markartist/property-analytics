#!/usr/bin/env python3
"""Seed Agent Readiness target rows from governed property identity sources."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import load_property_identities, resolve_property_identity
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

MANIFEST_ROOT = ROOT / "config" / "portfolio_resi_edge_stabilization"
REPORT_ROOT = ROOT / "reports" / "agent_readiness" / "target_seed"
DEFAULT_CADENCE_DAYS = 7


@dataclass(frozen=True)
class Target:
    target_id: str
    property_id: str | None
    community_id: str | None
    property_code: str | None
    property_name: str | None
    target_url: str
    target_host: str
    target_kind: str
    source_system: str
    cadence_days: int
    notes: str | None = None


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_url(value: str | None) -> str | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    parsed = urlparse(raw if raw.startswith(("http://", "https://")) else f"https://{raw}")
    if not parsed.netloc:
        return None
    path = parsed.path or "/"
    return f"{parsed.scheme}://{parsed.netloc.lower()}{path}"


def host_for(value: str) -> str:
    return urlparse(value).netloc.lower()


def target_id_for(target_url: str, target_kind: str, property_code: str | None) -> str:
    digest = hashlib.sha256(f"{target_kind}:{property_code or ''}:{target_url.lower()}".encode("utf-8")).hexdigest()
    return f"agent_ready_{digest[:24]}"


def sql_quote(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def target_sql(target: Target, timestamp: str) -> str:
    values = [
        target.target_id,
        target.property_id,
        target.community_id,
        target.property_code,
        target.property_name,
        target.target_url,
        target.target_host,
        target.target_kind,
        target.source_system,
        "active",
        target.cadence_days,
        timestamp,
        target.notes,
        timestamp,
        timestamp,
    ]
    return f"""INSERT INTO agent_readiness_targets (
  target_id, property_id, community_id, property_code, property_name,
  target_url, target_host, target_kind, source_system, status,
  cadence_days, next_scan_after, notes, created_at, updated_at
) VALUES ({", ".join(sql_quote(value) for value in values)})
ON CONFLICT(target_id) DO UPDATE SET
  property_id = excluded.property_id,
  community_id = excluded.community_id,
  property_code = excluded.property_code,
  property_name = excluded.property_name,
  target_url = excluded.target_url,
  target_host = excluded.target_host,
  target_kind = excluded.target_kind,
  source_system = excluded.source_system,
  status = excluded.status,
  cadence_days = excluded.cadence_days,
  notes = excluded.notes,
  updated_at = excluded.updated_at;
"""


def corporate_targets(cadence_days: int) -> Iterable[Target]:
    for identity in load_property_identities():
        target_url = normalize_url(identity.website_url)
        if not target_url:
            continue
        property_code = identity.property_code
        yield Target(
            target_id=target_id_for(target_url, "corporate_property_page", property_code),
            property_id=identity.marketing_bi_property_id,
            community_id=identity.community_id,
            property_code=property_code,
            property_name=identity.property_name,
            target_url=target_url,
            target_host=host_for(target_url),
            target_kind="corporate_property_page",
            source_system="property_identity_matrix.website_url",
            cadence_days=cadence_days,
        )


def manifest_targets(cadence_days: int) -> Iterable[Target]:
    for path in sorted(MANIFEST_ROOT.glob("*.manifest.json")):
        if path.name == "active-resi-edge-scope-lock.json":
            continue
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        target = manifest.get("target") if isinstance(manifest, dict) else {}
        if not isinstance(target, dict):
            continue
        canonical_url = normalize_url(target.get("canonical_url") or target.get("url") or target.get("domain"))
        domain = str(target.get("domain") or "").strip().lower()
        if not canonical_url and domain:
            canonical_url = normalize_url(domain)
        if not canonical_url:
            continue
        property_code = target.get("property_code")
        identity = resolve_property_identity(str(property_code or target.get("property_name") or ""))
        property_name = target.get("property_name") or identity.property_name if identity else target.get("property_name")
        resolved_property_code = identity.property_code if identity and identity.property_code else property_code
        community_id = identity.community_id if identity else target.get("community_id")
        property_id = identity.marketing_bi_property_id if identity else resolved_property_code or community_id
        yield Target(
            target_id=target_id_for(canonical_url, "resi_vanity", resolved_property_code),
            property_id=str(property_id) if property_id else None,
            community_id=str(community_id) if community_id else None,
            property_code=str(resolved_property_code) if resolved_property_code else None,
            property_name=str(property_name) if property_name else None,
            target_url=canonical_url,
            target_host=host_for(canonical_url),
            target_kind="resi_vanity",
            source_system=f"resi_edge_manifest:{path.name}",
            cadence_days=cadence_days,
            notes="Seeded from active Resi Edge manifest for read-only Agent Readiness monitoring.",
        )


def dedupe(targets: Iterable[Target]) -> list[Target]:
    by_id: dict[str, Target] = {}
    for target in targets:
        by_id[target.target_id] = target
    return sorted(by_id.values(), key=lambda item: (item.target_kind, item.property_code or "", item.target_url))


def write_packet(targets: list[Target], output_dir: Path) -> Path:
    timestamp = now_iso()
    output_dir.mkdir(parents=True, exist_ok=True)
    sql_path = output_dir / "agent-readiness-target-seed.sql"
    summary_path = output_dir / "target-seed-summary.json"
    sql = [target_sql(target, timestamp) for target in targets]
    sql_path.write_text("\n".join(sql), encoding="utf-8")
    summary = {
        "generated_at": timestamp,
        "target_count": len(targets),
        "counts_by_kind": {
            kind: sum(1 for target in targets if target.target_kind == kind)
            for kind in sorted({target.target_kind for target in targets})
        },
        "sql_path": str(sql_path),
    }
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return sql_path


def apply_sql(sql_path: Path) -> int:
    env = build_runtime_env()
    cmd = npx_wrangler_prefix(env) + [
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--file",
        str(sql_path),
    ]
    return subprocess.call(cmd, cwd=ROOT, env=env)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply the generated SQL to remote pop-brief-db.")
    parser.add_argument("--output-dir", type=Path, help="Packet output directory.")
    parser.add_argument("--cadence-days", type=int, default=DEFAULT_CADENCE_DAYS)
    parser.add_argument("--skip-corporate", action="store_true")
    parser.add_argument("--skip-resi-vanity", action="store_true")
    args = parser.parse_args()

    if args.cadence_days <= 0:
        raise SystemExit("--cadence-days must be positive")

    targets: list[Target] = []
    if not args.skip_corporate:
        targets.extend(corporate_targets(args.cadence_days))
    if not args.skip_resi_vanity:
        targets.extend(manifest_targets(args.cadence_days))

    packet_dir = args.output_dir or REPORT_ROOT / dt.datetime.now().strftime("target-seed-%Y%m%d-%H%M%S")
    sql_path = write_packet(dedupe(targets), packet_dir)
    print(f"Wrote {sql_path}")

    if args.apply:
        return apply_sql(sql_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
