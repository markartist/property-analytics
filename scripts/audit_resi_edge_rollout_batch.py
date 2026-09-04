#!/usr/bin/env python3
"""Read-only batch inventory audit for Resi Edge rollout manifests."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = REPO_ROOT / "config/portfolio_resi_edge_stabilization"
PROCESS_AUDITOR = REPO_ROOT / "scripts/audit_resi_edge_rollout_process.py"
RELEASE_TOKENS = MANIFEST_DIR / "resi-edge-release-tokens.v1.json"
REGISTER = MANIFEST_DIR / "resi-edge-pilot-rollout-register.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def slug(value: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def is_production_domain(domain: str) -> bool:
    return bool(domain) and "venterradev" not in domain and not domain.endswith(".kinsta.cloud")


def active_manifest_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        manifest = load_json(path)
        if manifest.get("schema_version") != "resi_edge_manifest_v1":
            continue
        if manifest.get("manifest_status") in {"archived", "retired"}:
            continue
        target = manifest.get("target") or {}
        domain = str(target.get("domain") or "")
        if not is_production_domain(domain):
            continue
        rows.append(
            {
                "path": path,
                "relative_path": str(path.relative_to(REPO_ROOT)),
                "manifest": manifest,
                "domain": domain,
                "property_code": str(target.get("property_code") or ""),
                "property_name": str(target.get("property_name") or ""),
            }
        )
    return rows


def run_process_audit(row: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    cmd = [
        sys.executable,
        str(PROCESS_AUDITOR),
        "--property-code",
        row["property_code"],
        "--domain",
        row["domain"],
        "--manifest",
        str(row["path"]),
        "--out",
        str(out_dir / slug(row["domain"])),
    ]
    proc = subprocess.run(cmd, cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        payload = {"pass": False, "error": proc.stderr[-2000:] or proc.stdout[-2000:]}
    return {
        "manifest": row["relative_path"],
        "property_code": row["property_code"],
        "domain": row["domain"],
        "property_name": row["property_name"],
        "exit_code": proc.returncode,
        "pass": bool(payload.get("pass")),
        "scenario_passed": payload.get("summary", {}).get("scenario_passed"),
        "scenario_total": payload.get("summary", {}).get("scenario_total"),
        "invariant_passed": payload.get("summary", {}).get("invariant_passed"),
        "invariant_total": payload.get("summary", {}).get("invariant_total"),
        "baseline_failures": payload.get("baseline_validation", {}).get("failures", [])[:8],
        "error": payload.get("error"),
    }


def duplicate_errors(rows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    by_domain: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_domain[row["domain"]].append(row)
        by_code[row["property_code"]].append(row)
        expected_name = f"{slug(row['domain'])}.manifest.json"
        if row["path"].name != expected_name:
            errors.append(f"{row['relative_path']} filename does not match target.domain; expected {expected_name}")
    for domain, matches in sorted(by_domain.items()):
        if len(matches) > 1:
            errors.append("duplicate active production domain manifest: " + domain + " -> " + ", ".join(row["relative_path"] for row in matches))
    for property_code, matches in sorted(by_code.items()):
        if property_code and len(matches) > 1:
            errors.append("duplicate active production property-code manifest: " + property_code + " -> " + ", ".join(row["relative_path"] for row in matches))
    return errors


def release_reference_errors(rows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    active_paths = {row["relative_path"] for row in rows}
    if RELEASE_TOKENS.exists():
        tokens = load_json(RELEASE_TOKENS)
        source = tokens.get("source_of_truth") or {}
        canary_manifest = source.get("canary_manifest")
        if canary_manifest and canary_manifest not in active_paths:
            errors.append(f"release token canary_manifest is not an active production manifest: {canary_manifest}")
    if REGISTER.exists():
        register = load_json(REGISTER)
        for index, prop in enumerate(register.get("properties") or []):
            manifest = prop.get("manifest")
            domain = str(prop.get("domain") or "")
            if manifest and manifest not in active_paths and "venterradev" not in str(manifest) and "venterradev" not in domain:
                errors.append(f"rollout register property[{index}] points outside active production manifests: {manifest}")
    return errors


def render_markdown(payload: dict[str, Any]) -> str:
    generated = payload["generated_at"]
    try:
        generated = datetime.fromisoformat(generated).strftime("%m/%d/%Y %-I:%M %p UTC")
    except ValueError:
        pass
    lines = [
        f"# Resi Edge Batch Rollout Audit - {'PASS' if payload['pass'] else 'FAIL'}",
        "",
        f"- Generated: {generated}",
        f"- Production manifests: `{payload['summary']['manifest_count']}`",
        f"- Process audits passed: `{payload['summary']['process_passed']}/{payload['summary']['process_total']}`",
        f"- Inventory errors: `{len(payload['inventory_errors'])}`",
        f"- External mutation: `{payload['external_mutation']}`",
        "",
        "## Inventory Errors",
    ]
    if payload["inventory_errors"]:
        lines.extend(f"- {error}" for error in payload["inventory_errors"])
    else:
        lines.append("- None")
    lines.append("")
    lines.append("## Manifest Results")
    for row in payload["process_results"]:
        lines.append(f"- {'PASS' if row['pass'] else 'FAIL'}: {row['property_code']} {row['domain']} ({row['manifest']})")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit the Resi Edge production manifest inventory.")
    parser.add_argument("--out")
    parser.add_argument("--skip-process-audits", action="store_true")
    args = parser.parse_args()

    out_dir = Path(args.out) if args.out else REPO_ROOT / "reports/resi_edge_performance" / f"batch-process-audit-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    if not out_dir.is_absolute():
        out_dir = REPO_ROOT / out_dir

    rows = active_manifest_rows()
    inventory_errors = duplicate_errors(rows) + release_reference_errors(rows)
    process_results = [] if args.skip_process_audits else [run_process_audit(row, out_dir / "manifests") for row in rows]
    process_passed = sum(1 for row in process_results if row["pass"])
    summary = {
        "manifest_count": len(rows),
        "process_total": len(process_results),
        "process_passed": process_passed,
    }
    payload = {
        "schema": "resi_edge_batch_rollout_audit_v1",
        "generated_at": utc_now(),
        "external_mutation": False,
        "manifest_rows": [
            {
                "manifest": row["relative_path"],
                "property_code": row["property_code"],
                "domain": row["domain"],
                "property_name": row["property_name"],
            }
            for row in rows
        ],
        "inventory_errors": inventory_errors,
        "process_results": process_results,
        "summary": summary,
        "pass": bool(not inventory_errors and (args.skip_process_audits or process_passed == len(process_results))),
    }
    write_json(out_dir / "batch-process-audit-summary.json", payload)
    (out_dir / "BATCH_PROCESS_AUDIT_READOUT.md").write_text(render_markdown(payload))
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if payload["pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
