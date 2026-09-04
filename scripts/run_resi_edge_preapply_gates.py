#!/usr/bin/env python3
"""Run the local Resi Edge pre-apply gate bundle for one named property."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = ROOT / "config" / "portfolio_resi_edge_stabilization"
DEFAULT_OUT_ROOT = ROOT / "reports" / "resi_edge_performance" / "preapply-gates"
DEPLOY_ADAPTER = ROOT / "scripts" / "resi_edge_deploy_adapter.py"
STATIC_VALIDATOR = ROOT / "scripts" / "validate_resi_edge_package_static.mjs"
GATE_COVERAGE = ROOT / "scripts" / "check_resi_edge_gate_coverage.py"
PROCESS_AUDITOR = ROOT / "scripts" / "audit_resi_edge_rollout_process.py"
BATCH_AUDITOR = ROOT / "scripts" / "audit_resi_edge_rollout_batch.py"
CENTRAL_PROOF = ROOT / "scripts" / "validate_resi_edge_central_topper_local.mjs"
DESKTOP_NATIVE_GATE = ROOT / "scripts" / "validate_resi_edge_desktop_native_visual_gate.mjs"
SCOPE_LOCK = MANIFEST_DIR / "active-resi-edge-scope-lock.json"


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "unknown"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_last_json_object(text: str) -> Any | None:
    decoder = json.JSONDecoder()
    parsed: Any | None = None
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            value, end = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        if not text[index + end :].strip():
            return value
        parsed = value
    return parsed


def domain_matches(left: str, right: str) -> bool:
    return clean(left).lower().removeprefix("www.") == clean(right).lower().removeprefix("www.")


def manifest_matches(path: Path, property_code: str, domain: str) -> bool:
    manifest = load_json(path)
    if manifest.get("schema_version") != "resi_edge_manifest_v1":
        return False
    if manifest.get("manifest_status") in {"archived", "retired"}:
        return False
    target = manifest.get("target") or {}
    codes = {
        clean(target.get("property_code")).upper(),
        clean(target.get("source_property_code")).upper(),
    }
    return property_code.upper() in codes and domain_matches(clean(target.get("domain")), domain)


def resolve_manifest(args: argparse.Namespace) -> Path:
    if args.manifest:
        path = args.manifest if args.manifest.is_absolute() else ROOT / args.manifest
        if not path.exists():
            raise SystemExit(f"Manifest not found: {path}")
        if not manifest_matches(path, args.property_code, args.domain):
            raise SystemExit("Manifest does not match the requested property code/domain.")
        return path.resolve()

    matches: list[Path] = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        if path.name.startswith("pilot-") or "-v2-canary" in path.name:
            continue
        try:
            if manifest_matches(path, args.property_code, args.domain):
                matches.append(path.resolve())
        except (json.JSONDecodeError, OSError):
            continue
    if not matches:
        raise SystemExit(f"No active manifest matched {args.property_code} / {args.domain}.")
    if len(matches) > 1:
        joined = ", ".join(str(path.relative_to(ROOT)) for path in matches)
        raise SystemExit(f"Multiple active manifests matched {args.property_code} / {args.domain}: {joined}")
    return matches[0]


def command_record(label: str, command: list[str], out_dir: Path, timeout: int) -> dict[str, Any]:
    started = time.time()
    try:
        result = subprocess.run(
            command,
            cwd=str(ROOT),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
        record = {
            "label": label,
            "command": command,
            "returncode": result.returncode,
            "pass": result.returncode == 0,
            "duration_seconds": round(time.time() - started, 3),
            "stdout_tail": result.stdout[-12000:],
            "stderr_tail": result.stderr[-12000:],
            "parsed_json": parse_last_json_object(result.stdout),
        }
    except subprocess.TimeoutExpired as exc:
        record = {
            "label": label,
            "command": command,
            "returncode": None,
            "pass": False,
            "duration_seconds": round(time.time() - started, 3),
            "stdout_tail": (exc.stdout or "")[-12000:] if isinstance(exc.stdout, str) else "",
            "stderr_tail": (exc.stderr or "")[-12000:] if isinstance(exc.stderr, str) else "",
            "timeout_seconds": timeout,
            "reason": "command timed out",
        }
    write_json(out_dir / "commands" / f"{label}.json", record)
    return record


def load_deploy_adapter_module() -> Any:
    spec = importlib.util.spec_from_file_location("resi_edge_deploy_adapter_for_preapply", DEPLOY_ADAPTER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import deploy adapter from {DEPLOY_ADAPTER}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def scope_lock_status(manifest: dict[str, Any], manifest_path: Path) -> dict[str, Any]:
    adapter = load_deploy_adapter_module()
    result = adapter.validate_apply_scope_lock(manifest, SCOPE_LOCK)
    result["manifest_path"] = str(manifest_path)
    result["external_mutation"] = False
    return result


def gate_summary(label: str, record: dict[str, Any], evidence_path: Path | None = None) -> dict[str, Any]:
    parsed = record.get("parsed_json")
    parsed_pass = parsed.get("pass") if isinstance(parsed, dict) else None
    return {
        "label": label,
        "pass": bool(record.get("pass") and (parsed_pass is not False)),
        "returncode": record.get("returncode"),
        "duration_seconds": record.get("duration_seconds"),
        "evidence_path": str(evidence_path) if evidence_path else None,
        "command_record": None,
        "summary": parsed if isinstance(parsed, dict) else None,
        "reason": record.get("reason") or (record.get("stderr_tail") or record.get("stdout_tail") or "")[-600:],
    }


def render_markdown(payload: dict[str, Any]) -> str:
    generated = payload["generated_at"]
    try:
        generated = datetime.fromisoformat(generated).strftime("%m/%d/%Y %-I:%M %p UTC")
    except ValueError:
        pass
    lines = [
        f"# Resi Edge Pre-Apply Gates - {'PASS' if payload['pass'] else 'BLOCKED'}",
        "",
        f"- Generated: {generated}",
        f"- Property: `{payload['property_code']}` / `{payload['domain']}`",
        f"- Manifest: `{payload['manifest_path']}`",
        f"- Topper mode: `{payload['topper_mode']}`",
        f"- External mutation: `{payload['external_mutation']}`",
        "",
        "## Gate Results",
    ]
    for gate in payload["gates"]:
        lines.append(f"- {'PASS' if gate['pass'] else 'BLOCKED'}: `{gate['label']}`")
    failures = [gate for gate in payload["gates"] if not gate["pass"]]
    lines.extend(["", "## Blockers"])
    if not failures:
        lines.append("- None")
    else:
        for gate in failures:
            reason = clean(gate.get("reason") or "See evidence.")
            lines.append(f"- `{gate['label']}`: {reason[:500]}")
    lines.append("")
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property-code", required=True, help="Exact Resi Edge property code, e.g. GA4BV.")
    parser.add_argument("--domain", required=True, help="Exact vanity domain, e.g. balmoralvillageapts.com.")
    parser.add_argument("--manifest", type=Path, help="Optional exact manifest path. Must match property code/domain.")
    parser.add_argument("--out-root", type=Path, default=DEFAULT_OUT_ROOT)
    parser.add_argument("--topper-mode", choices=["centralized", "bundled"], default="centralized")
    parser.add_argument("--timeout", type=int, default=900, help="Per-command timeout in seconds.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    property_code = clean(args.property_code).upper()
    domain = clean(args.domain).lower()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = (args.out_root / slug(domain) / run_id).resolve()
    manifest_path = resolve_manifest(args)
    manifest = load_json(manifest_path)
    target = manifest.get("target") or {}
    target_code = clean(target.get("property_code")).upper()
    target_domain = clean(target.get("domain")).lower()
    target_name = clean(target.get("property_name"))

    commands: dict[str, dict[str, Any]] = {}
    gates: list[dict[str, Any]] = []

    def run_gate(label: str, command: list[str], evidence_path: Path | None = None) -> dict[str, Any]:
        record = command_record(label, command, out_dir, args.timeout)
        commands[label] = record
        gate = gate_summary(label, record, evidence_path)
        gate["command_record"] = str(out_dir / "commands" / f"{label}.json")
        gates.append(gate)
        return record

    static_record = run_gate(
        "static_package_validation",
        ["node", str(STATIC_VALIDATOR), "--manifest", str(manifest_path)],
        out_dir / "commands" / "static_package_validation.json",
    )
    gate_coverage_record = run_gate(
        "gate_coverage",
        ["python3", str(GATE_COVERAGE)],
        out_dir / "commands" / "gate_coverage.json",
    )
    process_dir = out_dir / "process-scenario-audit"
    run_gate(
        "process_scenario_audit",
        [
            "python3",
            str(PROCESS_AUDITOR),
            "--property-code",
            property_code,
            "--domain",
            domain,
            "--manifest",
            str(manifest_path),
            "--out",
            str(process_dir),
        ],
        process_dir / "process-audit.json",
    )
    batch_dir = out_dir / "batch-inventory-audit"
    run_gate(
        "batch_inventory_audit",
        ["python3", str(BATCH_AUDITOR), "--skip-process-audits", "--out", str(batch_dir)],
        batch_dir / "batch-process-audit-summary.json",
    )
    central_dir = out_dir / "central-topper-local-proof"
    run_gate(
        "central_topper_local_proof",
        ["node", str(CENTRAL_PROOF), "--manifest", str(manifest_path), "--out-dir", str(central_dir)],
        central_dir / "central-topper-local-proof.json",
    )
    desktop_dir = out_dir / "desktop-native-visual-gate"
    run_gate(
        "desktop_native_visual_gate",
        ["node", str(DESKTOP_NATIVE_GATE), "--manifest", str(manifest_path), "--out-dir", str(desktop_dir)],
        desktop_dir / "desktop-native-visual-gate.json",
    )
    deploy_dir = out_dir / "deploy-bundle-validation"
    run_gate(
        "deploy_bundle_dry_run",
        [
            "python3",
            str(DEPLOY_ADAPTER),
            "--validate-bundle",
            "--topper-mode",
            args.topper_mode,
            "--manifest",
            str(manifest_path),
            "--out-dir",
            str(deploy_dir),
        ],
        deploy_dir / "deploy-bundle-validation.json",
    )

    scope_status = scope_lock_status(manifest, manifest_path)
    write_json(out_dir / "scope-lock-status.json", scope_status)
    gates.append(
        {
            "label": "scope_lock_status",
            "pass": bool(scope_status.get("pass")),
            "returncode": None,
            "duration_seconds": None,
            "evidence_path": str(out_dir / "scope-lock-status.json"),
            "command_record": None,
            "summary": scope_status,
            "reason": scope_status.get("reason"),
        }
    )

    payload = {
        "schema_version": "resi_edge_preapply_gates.v1",
        "generated_at": utc_now(),
        "run_id": run_id,
        "property_code": target_code,
        "requested_property_code": property_code,
        "domain": target_domain,
        "requested_domain": domain,
        "property_name": target_name,
        "manifest_path": str(manifest_path.relative_to(ROOT)),
        "topper_mode": args.topper_mode,
        "external_mutation": False,
        "out_dir": str(out_dir),
        "pass": all(gate["pass"] for gate in gates),
        "blocked": not all(gate["pass"] for gate in gates),
        "summary": {
            "gate_count": len(gates),
            "passed_count": sum(1 for gate in gates if gate["pass"]),
            "blocked_count": sum(1 for gate in gates if not gate["pass"]),
            "static_pass": bool(static_record.get("pass")),
            "gate_coverage_pass": bool(gate_coverage_record.get("pass")),
            "scope_lock_pass": bool(scope_status.get("pass")),
        },
        "gates": gates,
        "mutation_boundaries": {
            "allowed": ["local evidence files", "local deploy-bundle dry-run output"],
            "excluded": [
                "live Worker deploy",
                "Cloudflare route mutation",
                "DNS mutation",
                "WordPress/Kinsta mutation",
                "R2 asset/config/record upload",
                "Zaraz/GA4/Ahrefs admin mutation",
                "dashboard production publish",
                "source content mutation",
                "locked PIB mutation",
            ],
        },
    }
    write_json(out_dir / "preapply-gates.json", payload)
    (out_dir / "PREAPPLY_GATES_READOUT.md").write_text(render_markdown(payload), encoding="utf-8")
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if payload["pass"] else 3


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
