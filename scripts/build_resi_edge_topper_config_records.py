#!/usr/bin/env python3
"""Build central Resi Edge topper config records from approved manifests.

Default mode is local/evidence only. Use --upload only when Mark explicitly
approves R2 mutation through the Keeper-backed Wrangler path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = ROOT / "config/portfolio_resi_edge_stabilization"
CENTRAL_CONTRACT = MANIFEST_DIR / "resi-edge-central-topper-runtime.v1.json"
RELEASE_TOKENS = MANIFEST_DIR / "resi-edge-release-tokens.v1.json"
DEFAULT_OUTPUT_DIR = ROOT / "reports/resi_edge_performance/topper-config-records"
BUCKET_NAME = "resi-edge-assets"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


def slug(value: Any) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(value or ""))
    return "-".join(part for part in cleaned.split("-") if part) or "unknown"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def manifest_key(manifest: dict[str, Any]) -> str:
    target = manifest.get("target") or {}
    code = target.get("source_property_code") or target.get("property_code") or "unknown"
    domain = target.get("domain") or "unknown"
    return f"{slug(code)}-{slug(domain)}"


def config_record_key(manifest: dict[str, Any]) -> str:
    return f"resi-edge-topper-config/{manifest_key(manifest)}/current.json"


def promo_record_key(manifest: dict[str, Any]) -> str:
    return f"resi-edge-promo/{manifest_key(manifest)}/current.json"


def hero_freshness_record_key(manifest: dict[str, Any]) -> str:
    return f"resi-edge-hero-freshness/{manifest_key(manifest)}/current.json"


def hero_media_state_record_key(manifest: dict[str, Any]) -> str:
    return f"resi-edge-media-state/{manifest_key(manifest)}/current.json"


def active_manifest_paths(manifest_arg: str | None) -> list[Path]:
    if manifest_arg:
        path = Path(manifest_arg)
        return [path if path.is_absolute() else ROOT / path]
    paths: list[Path] = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        if path.name.startswith("pilot-") or "-v2-canary" in path.name:
            continue
        try:
            manifest = load_json(path)
        except json.JSONDecodeError:
            continue
        if manifest.get("package_contract_id") == "resi-edge-canonical-upgrade-package":
            paths.append(path)
    return paths


def build_record(path: Path, generated_at: str, release_tokens: dict[str, Any], central_contract: dict[str, Any]) -> dict[str, Any]:
    manifest_text = path.read_text(encoding="utf-8")
    manifest = json.loads(manifest_text)
    target = manifest.get("target") or {}
    runtime_version = central_contract.get("delivery_model", {}).get("shared_runtime_version")
    return {
        "schema_version": central_contract["edge_record_contract"]["record_schema_version"],
        "generated_at": generated_at,
        "property_code": target.get("property_code"),
        "source_property_code": target.get("source_property_code") or target.get("property_code"),
        "domain": target.get("domain"),
        "property_name": target.get("property_name"),
        "runtime_version": runtime_version,
        "release_token_version": release_tokens.get("active_token_version"),
        "manifest_path": str(path.relative_to(ROOT)),
        "manifest_sha256": sha256_text(manifest_text),
        "target": manifest.get("target"),
        "routing": {
            "cloudflare_zone_name": manifest.get("routing", {}).get("cloudflare_zone_name"),
            "route_pattern": manifest.get("routing", {}).get("route_pattern"),
            "mutation_policy": manifest.get("routing", {}).get("mutation_policy"),
        },
        "mobile_shell": manifest.get("mobile_shell"),
        "desktop": manifest.get("desktop"),
        "phone_attribution": manifest.get("phone_attribution"),
        "analytics": manifest.get("analytics"),
        "consent": manifest.get("consent"),
        "seo": manifest.get("seo"),
        "record_keys": {
            "config": config_record_key(manifest),
            "promo": promo_record_key(manifest),
            "hero_freshness": hero_freshness_record_key(manifest),
            "hero_media_state": hero_media_state_record_key(manifest),
        },
        "centralization": {
            "delivery_model": central_contract.get("delivery_model", {}).get("target_state"),
            "production_default": central_contract.get("delivery_model", {}).get("production_default"),
            "freshness_records_are_data_not_runtime": central_contract.get("non_deviation_contract", {}).get("freshness_records_are_data_not_runtime"),
        },
    }


def validate_record(record: dict[str, Any], central_contract: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    allowed = set(central_contract.get("allowed_record_fields") or [])
    extra = sorted(set(record) - allowed - {"manifest_path", "centralization"})
    if extra:
        errors.append(f"unexpected top-level record fields: {extra}")
    for field in ("property_code", "source_property_code", "domain", "property_name", "runtime_version", "release_token_version"):
        if not record.get(field):
            errors.append(f"missing required record field: {field}")
    mobile_shell = record.get("mobile_shell") or {}
    if len((mobile_shell.get("navigation") or {}).get("links") or []) < 10:
        errors.append("mobile_shell.navigation.links must carry the full source nav set")
    heap = (record.get("analytics") or {}).get("heap") or {}
    if str(heap.get("app_id")) != "286627304":
        errors.append("analytics.heap.app_id must remain the production Heap id")
    if (record.get("analytics") or {}).get("owner") != "cloudflare_zaraz":
        errors.append("analytics.owner must remain cloudflare_zaraz")
    if (record.get("consent") or {}).get("widget_version") != "compact_shell_pill_v29_2026_08_20":
        errors.append("consent.widget_version must remain compact_shell_pill_v29_2026_08_20")
    record_keys = record.get("record_keys") or {}
    expected_config = f"resi-edge-topper-config/{manifest_key({'target': record})}/current.json"
    if record_keys.get("config") != expected_config:
        errors.append("record_keys.config does not match property code/domain")
    return errors


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def upload_record(key: str, path: Path) -> dict[str, Any]:
    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        return {"pass": False, "key": key, "reason": "Cloudflare API token was not resolved through Keeper-backed Wrangler auth."}
    command = [
        *npx_wrangler_prefix(env),
        "r2",
        "object",
        "put",
        f"{BUCKET_NAME}/{key}",
        "--file",
        str(path),
        "--content-type",
        "application/json",
        "--remote",
    ]
    result = subprocess.run(command, cwd=str(ROOT), env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return {
        "pass": result.returncode == 0,
        "key": key,
        "file": str(path),
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build central Resi Edge topper config records.")
    parser.add_argument("--manifest", help="Optional single manifest. Omit to build all active production manifests.")
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--upload", action="store_true", help="Upload records to R2. Requires explicit user approval.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    generated_at = datetime.now(timezone.utc).isoformat()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = (args.output_dir or DEFAULT_OUTPUT_DIR / run_id).resolve()
    central_contract = load_json(CENTRAL_CONTRACT)
    release_tokens = load_json(RELEASE_TOKENS)
    manifest_paths = active_manifest_paths(args.manifest)
    records: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    uploads: list[dict[str, Any]] = []

    for path in manifest_paths:
        try:
            record = build_record(path, generated_at, release_tokens, central_contract)
            errors = validate_record(record, central_contract)
            key = record["record_keys"]["config"]
            record_path = out_dir / key
            write_json(record_path, record)
            records.append({"property_code": record["property_code"], "domain": record["domain"], "key": key, "file": str(record_path), "pass": not errors, "errors": errors})
            if errors:
                failures.append({"manifest": str(path), "key": key, "errors": errors})
            elif args.upload:
                uploads.append(upload_record(key, record_path))
        except Exception as exc:
            failures.append({"manifest": str(path), "errors": [str(exc)]})

    upload_failures = [row for row in uploads if not row.get("pass")]
    summary = {
        "schema_version": "resi_edge_topper_config_build_summary.v1",
        "pass": not failures and not upload_failures,
        "generated_at": generated_at,
        "run_id": run_id,
        "central_contract": str(CENTRAL_CONTRACT.relative_to(ROOT)),
        "record_count": len(records),
        "failure_count": len(failures),
        "upload_requested": args.upload,
        "upload_count": len(uploads),
        "upload_failure_count": len(upload_failures),
        "records": records,
        "failures": failures,
        "uploads": uploads,
    }
    write_json(out_dir / "summary.json", summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["pass"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
