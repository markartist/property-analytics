#!/usr/bin/env python3
"""Build or upload Resi Edge promo records from the governed ThirtyLines feed."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT / "data/portfolio_analytics.db"
MANIFEST_DIR = ROOT / "config/portfolio_resi_edge_stabilization"
DEFAULT_OUT_DIR = ROOT / "reports/resi_edge_performance/promo-record-sync"
R2_BUCKET = "resi-edge-assets"
SCHEMA_VERSION = "resi_edge_promo_record.v1"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-") or "unknown"


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def edge_promo_record_key(manifest: dict[str, Any]) -> str:
    target = manifest.get("target") or {}
    code = slug(target.get("source_property_code") or target.get("property_code") or "unknown")
    domain = slug(target.get("domain") or "unknown")
    return f"resi-edge-promo/{code}-{domain}/current.json"


def active_manifest_paths(args: argparse.Namespace) -> list[Path]:
    if args.manifest:
        return [Path(path).resolve() for path in args.manifest]
    paths = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        if path.name.startswith(("pilot-", "champions-green-ga4cg", "calais-midtown-tx4mi")):
            continue
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if manifest.get("package_contract_id") == "resi-edge-canonical-upgrade-package":
            paths.append(path)
    return paths


def latest_feed_properties(db_path: Path) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT snapshot_id, snapshot_date, fetched_at, feed_url, raw_payload_json
            FROM thirtylines_feed_snapshots
            ORDER BY snapshot_date DESC, snapshot_id DESC
            LIMIT 1
            """
        ).fetchone()
    if not row:
        raise RuntimeError("No ThirtyLines feed snapshot found in Data Pond.")
    payload = json.loads(row["raw_payload_json"])
    properties = payload if isinstance(payload, list) else payload.get("properties", [])
    snapshot = {
        "snapshot_id": row["snapshot_id"],
        "snapshot_date": row["snapshot_date"],
        "fetched_at": row["fetched_at"],
        "feed_url": row["feed_url"],
    }
    by_code = {clean(item.get("id")).upper(): item for item in properties if isinstance(item, dict) and item.get("id")}
    return snapshot, by_code


def build_record(manifest: dict[str, Any], feed_row: dict[str, Any] | None, snapshot: dict[str, Any]) -> dict[str, Any]:
    target = manifest.get("target") or {}
    promo = ((manifest.get("mobile_shell") or {}).get("promo") or {})
    nav = ((manifest.get("mobile_shell") or {}).get("navigation") or {})
    special = clean((feed_row or {}).get("propertyBannerSpecial"))
    present = bool(special)
    primary_url = clean(promo.get("primary_cta_url")) or f"https://{target.get('domain')}/apartments/?has_specials=true"
    secondary_url = clean(promo.get("secondary_cta_url")) or clean(nav.get("tour_url")) or f"https://{target.get('domain')}/contact/"
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "property_code": target.get("source_property_code") or target.get("property_code"),
        "domain": target.get("domain"),
        "property_name": target.get("property_name"),
        "key": edge_promo_record_key(manifest),
        "present": present,
        "propertyBannerSpecial": special,
        "bar_label": special,
        "title": special,
        "body": special,
        "disclaimer": clean(promo.get("disclaimer")) or "*Restrictions apply. Contact us for details.",
        "primary_cta_label": clean(promo.get("primary_cta_label")) or "See Availability",
        "primary_cta_url": primary_url,
        "secondary_cta_label": clean(promo.get("secondary_cta_label")) or "Contact Us",
        "secondary_cta_url": secondary_url,
        "source": {
            "system": "thirtylines_feed_snapshots",
            "field": "propertyBannerSpecial",
            **snapshot,
            "feed_property_id": clean((feed_row or {}).get("id")),
            "feed_property_name": clean((feed_row or {}).get("name")),
        },
    }


def run(cmd: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=str(ROOT), env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def upload_record(path: Path, key: str, env: dict[str, str]) -> dict[str, Any]:
    command = [
        *npx_wrangler_prefix(env),
        "r2",
        "object",
        "put",
        f"{R2_BUCKET}/{key}",
        "--file",
        str(path),
        "--content-type",
        "application/json; charset=utf-8",
    ]
    result = run(command, env)
    return {
        "command": command,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "pass": result.returncode == 0,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Resi Edge feed-backed promo records.")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    parser.add_argument("--manifest", action="append", help="Specific active manifest path. Repeatable.")
    parser.add_argument("--upload", action="store_true", help="Upload generated records to the existing RESI_EDGE_ASSETS R2 bucket.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).resolve()
    out_dir = Path(args.out_dir).resolve() / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir.mkdir(parents=True, exist_ok=True)
    snapshot, feed_by_code = latest_feed_properties(db_path)
    env = build_runtime_env() if args.upload else {}
    if args.upload and not env.get("CLOUDFLARE_API_TOKEN"):
        raise RuntimeError("Cloudflare API token was not resolved through Keeper-backed Wrangler auth.")

    rows: list[dict[str, Any]] = []
    exit_code = 0
    for manifest_path in active_manifest_paths(args):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        target = manifest.get("target") or {}
        code = clean(target.get("source_property_code") or target.get("property_code")).upper()
        feed_row = feed_by_code.get(code)
        record = build_record(manifest, feed_row, snapshot)
        record_path = out_dir / f"{slug(target.get('domain'))}.promo.json"
        record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        row = {
            "property_code": code,
            "domain": target.get("domain"),
            "property_name": target.get("property_name"),
            "manifest": str(manifest_path),
            "record_path": str(record_path),
            "key": record["key"],
            "feed_property_found": feed_row is not None,
            "present": record["present"],
            "propertyBannerSpecial": record["propertyBannerSpecial"],
        }
        if args.upload:
            upload = upload_record(record_path, record["key"], env)
            row["upload"] = upload
            if not upload["pass"]:
                exit_code = 3
        rows.append(row)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schema_version": SCHEMA_VERSION,
        "db_path": str(db_path),
        "source_snapshot": snapshot,
        "upload_requested": args.upload,
        "property_count": len(rows),
        "present_count": sum(1 for row in rows if row["present"]),
        "missing_feed_count": sum(1 for row in rows if not row["feed_property_found"]),
        "rows": rows,
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
