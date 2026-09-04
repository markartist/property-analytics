#!/usr/bin/env python3
"""Canonical Resi Edge deploy adapter boundary.

This file is intentionally a hard gate until the shared renderer/deployer is
extracted from the approved TowneStone/Vine references. It prevents a property
operator from quietly applying a lookalike Worker or hand-built variant.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC_VALIDATOR = ROOT / "scripts/validate_resi_edge_package_static.mjs"
CANONICAL_WORKER = ROOT / "ops/cloudflare/resi-edge-canonical-worker/worker.js"
CANONICAL_RUNTIME = ROOT / "ops/cloudflare/shared/resi-edge-package/runtime.mjs"
THIN_PROPERTY_WORKER = ROOT / "ops/cloudflare/resi-edge-thin-property-worker/worker.js"
CENTRAL_TOPPER_SERVICE = ROOT / "ops/cloudflare/resi-edge-topper-service/worker.js"
CENTRAL_TOPPER_CONTRACT = ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json"
CENTRAL_TOPPER_PROOF_ROOT = ROOT / "reports/resi_edge_performance/central-topper-local-proof"
DESKTOP_NATIVE_VISUAL_PROOF_ROOT = ROOT / "reports/resi_edge_performance/desktop-native-visual-gate"
CONSENT_WIDGET = ROOT / "ops/cloudflare/shared/resi-consent-widget/widget.mjs"
RELEASE_TOKENS = ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json"
SCOPE_LOCK_PATH = ROOT / "config/portfolio_resi_edge_stabilization/active-resi-edge-scope-lock.json"
ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"
D1_DATABASE_ID = "dad3e7d1-147b-438d-8cd0-2cbf537a87b2"
UNASSIGNED_WORKER_SENTINELS = {
    "not_yet_assigned_in_governed_package",
    "not_yet_recorded",
    "not_assigned",
    "pending",
    "none",
    "null",
}
STALE_ROUTE_OWNER_SENTINELS = {"not_yet_recorded"}

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


def run(cmd: list[str], cwd: Path = ROOT, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "target"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def central_topper_proof_key(manifest: dict) -> str:
    target = manifest.get("target") or {}
    code = target.get("source_property_code") or target.get("property_code") or "unknown"
    domain = target.get("domain") or "unknown"
    return f"{slugify(str(code))}-{slugify(str(domain))}"


def central_topper_proof_path(manifest: dict) -> Path:
    return CENTRAL_TOPPER_PROOF_ROOT / central_topper_proof_key(manifest) / "latest-central-topper-local-proof.json"


def desktop_native_visual_proof_path(manifest: dict) -> Path:
    return DESKTOP_NATIVE_VISUAL_PROOF_ROOT / central_topper_proof_key(manifest) / "latest-desktop-native-visual-gate.json"


def selected_worker_name(routing: dict, domain: str) -> str:
    existing = str(routing.get("existing_worker_script") or "").strip()
    if existing and existing.lower() not in UNASSIGNED_WORKER_SENTINELS:
        return existing
    return f"resi-edge-canonical-{slugify(domain)}"


def cloudflare_api(token: str, path: str, *, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def zone_id_for_domain(token: str, domain: str) -> str | None:
    payload = cloudflare_api(token, f"/zones?name={urllib.parse.quote(domain)}&page=1&per_page=50")
    zones = payload.get("result") or []
    return zones[0].get("id") if zones else None


def remove_stale_sentinel_route(token: str, manifest: dict) -> dict:
    target = manifest["target"]
    routing = manifest["routing"]
    domain = target["domain"]
    route_pattern = routing["route_pattern"]
    desired_worker = selected_worker_name(routing, domain)
    zone_id = zone_id_for_domain(token, domain)
    result: dict = {
        "domain": domain,
        "route_pattern": route_pattern,
        "desired_worker": desired_worker,
        "pass": True,
        "deleted_routes": [],
        "kept_routes": [],
    }
    if not zone_id:
        result.update({"pass": False, "reason": "Cloudflare zone could not be resolved for target domain."})
        return result
    routes_payload = cloudflare_api(token, f"/zones/{zone_id}/workers/routes")
    for route in routes_payload.get("result") or []:
        if route.get("pattern") != route_pattern:
            continue
        script = str(route.get("script") or "")
        route_id = route.get("id")
        if script == desired_worker:
            result["kept_routes"].append({"id": route_id, "script": script, "reason": "already_desired_worker"})
            continue
        if script.lower() in STALE_ROUTE_OWNER_SENTINELS and route_id:
            delete_payload = cloudflare_api(token, f"/zones/{zone_id}/workers/routes/{route_id}", method="DELETE")
            result["deleted_routes"].append({
                "id": route_id,
                "script": script,
                "success": bool(delete_payload.get("success")),
            })
            if not delete_payload.get("success"):
                result.update({"pass": False, "reason": "Failed to delete stale sentinel-owned Cloudflare route."})
            continue
        result["kept_routes"].append({"id": route_id, "script": script, "reason": "non_sentinel_owner"})
    return result


def validate_apply_scope_lock(manifest: dict | None, lock_path: Path = SCOPE_LOCK_PATH) -> dict:
    target = (manifest or {}).get("target") or {}
    result: dict = {
        "pass": False,
        "blocked": True,
        "lock_path": str(lock_path),
        "property_code": str(target.get("property_code") or "").upper(),
        "domain": str(target.get("domain") or "").lower(),
        "mode": "apply",
    }
    if not manifest:
        result["reason"] = "Manifest could not be loaded for scope-lock validation."
        return result
    if not lock_path.exists():
        result["reason"] = "Resi Edge scope lock is missing. Direct deploy adapter apply is blocked."
        return result
    try:
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        result["reason"] = f"Resi Edge scope lock is invalid JSON: {exc}"
        return result
    result["scope_id"] = lock.get("scope_id")
    if lock.get("status") != "ACTIVE":
        result["reason"] = "Resi Edge scope lock is not ACTIVE."
        return result
    expires_at = lock.get("expires_at")
    if expires_at:
        try:
            expires = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        except ValueError:
            result["reason"] = "Resi Edge scope lock has an invalid expires_at timestamp."
            return result
        if datetime.now(timezone.utc) > expires:
            result["reason"] = "Resi Edge scope lock is expired."
            return result
    for allowed in lock.get("allowed_targets") or []:
        modes = [str(mode) for mode in allowed.get("modes", [])] if isinstance(allowed, dict) else []
        if (
            isinstance(allowed, dict)
            and str(allowed.get("property_code") or "").upper() == result["property_code"]
            and str(allowed.get("domain") or "").lower() == result["domain"]
            and "apply" in modes
        ):
            result.update({"pass": True, "blocked": False, "reason": "Exact active scope lock matched."})
            return result
    result["reason"] = "Deploy adapter apply target is outside the active Resi Edge scope lock."
    result["allowed_targets"] = lock.get("allowed_targets")
    return result


def validate_centralized_apply_proof(manifest_path: Path, manifest: dict | None) -> dict:
    target = (manifest or {}).get("target") or {}
    result: dict = {
        "pass": False,
        "blocked": True,
        "proof_path": str(central_topper_proof_path(manifest or {"target": target})),
        "property_code": str(target.get("property_code") or "").upper(),
        "domain": str(target.get("domain") or "").lower(),
        "manifest_path": str(manifest_path),
    }
    if not manifest:
        result["reason"] = "Manifest could not be loaded for centralized proof validation."
        return result
    proof_path = central_topper_proof_path(manifest)
    if not proof_path.exists():
        result["reason"] = "Centralized apply requires a passing local central topper proof artifact."
        return result
    try:
        proof = json.loads(proof_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        result["reason"] = f"Centralized proof artifact is invalid JSON: {exc}"
        return result
    expected = {
        "manifest_sha256": sha256_file(manifest_path),
        "runtime_sha256": sha256_file(CANONICAL_RUNTIME),
        "central_service_sha256": sha256_file(CENTRAL_TOPPER_SERVICE),
        "thin_worker_sha256": sha256_file(THIN_PROPERTY_WORKER),
    }
    actual = {
        "manifest_sha256": proof.get("manifest_sha256"),
        "runtime_sha256": proof.get("runtime_sha256"),
        "central_service_sha256": proof.get("central_service_sha256"),
        "thin_worker_sha256": proof.get("thin_worker_sha256"),
    }
    result.update({
        "artifact_schema": proof.get("artifact_schema"),
        "generated_at": proof.get("generated_at"),
        "expected_hashes": expected,
        "actual_hashes": actual,
    })
    failures: list[str] = []
    if proof.get("artifact_schema") != "resi_edge_central_topper_local_proof.v1":
        failures.append("proof artifact has the wrong schema")
    if proof.get("pass") is not True:
        failures.append("proof artifact did not pass")
    if str(proof.get("property_code") or "").upper() != result["property_code"]:
        failures.append("proof property_code does not match manifest")
    if str(proof.get("domain") or "").lower() != result["domain"]:
        failures.append("proof domain does not match manifest")
    for key, expected_value in expected.items():
        if actual.get(key) != expected_value:
            failures.append(f"proof {key} is stale or mismatched")
    if failures:
        result.update({"reason": "Centralized proof artifact is missing, failed, or stale.", "failures": failures})
        return result
    result.update({"pass": True, "blocked": False, "reason": "Current local central topper proof artifact matched."})
    return result


def validate_desktop_native_visual_gate(manifest_path: Path, manifest: dict | None) -> dict:
    target = (manifest or {}).get("target") or {}
    result: dict = {
        "pass": False,
        "blocked": True,
        "proof_path": str(desktop_native_visual_proof_path(manifest or {"target": target})),
        "property_code": str(target.get("property_code") or "").upper(),
        "domain": str(target.get("domain") or "").lower(),
        "manifest_path": str(manifest_path),
    }
    if not manifest:
        result["reason"] = "Manifest could not be loaded for desktop native visual gate validation."
        return result
    proof_path = desktop_native_visual_proof_path(manifest)
    if not proof_path.exists():
        result["reason"] = "Apply requires a passing local desktop native visual gate artifact."
        return result
    try:
        proof = json.loads(proof_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        result["reason"] = f"Desktop native visual gate artifact is invalid JSON: {exc}"
        return result
    expected = {
        "manifest_sha256": sha256_file(manifest_path),
        "runtime_sha256": sha256_file(CANONICAL_RUNTIME),
        "thin_worker_sha256": sha256_file(THIN_PROPERTY_WORKER),
        "canonical_worker_sha256": sha256_file(CANONICAL_WORKER),
    }
    actual = {
        "manifest_sha256": proof.get("manifest_sha256"),
        "runtime_sha256": proof.get("runtime_sha256"),
        "thin_worker_sha256": proof.get("thin_worker_sha256"),
        "canonical_worker_sha256": proof.get("canonical_worker_sha256"),
    }
    result.update({
        "artifact_schema": proof.get("artifact_schema"),
        "generated_at": proof.get("generated_at"),
        "expected_hashes": expected,
        "actual_hashes": actual,
    })
    failures: list[str] = []
    if proof.get("artifact_schema") != "resi_edge_desktop_native_visual_gate.v1":
        failures.append("proof artifact has the wrong schema")
    if proof.get("pass") is not True:
        failures.append("proof artifact did not pass")
    if str(proof.get("property_code") or "").upper() != result["property_code"]:
        failures.append("proof property_code does not match manifest")
    if str(proof.get("domain") or "").lower() != result["domain"]:
        failures.append("proof domain does not match manifest")
    for key, expected_value in expected.items():
        if actual.get(key) != expected_value:
            failures.append(f"proof {key} is stale or mismatched")
    if failures:
        result.update({"reason": "Desktop native visual gate artifact is missing, failed, or stale.", "failures": failures})
        return result
    result.update({"pass": True, "blocked": False, "reason": "Current desktop native visual gate artifact matched."})
    return result


def load_manifest(path: str | None) -> dict | None:
    if not path:
        return None
    manifest_path = Path(path)
    if not manifest_path.is_absolute():
        manifest_path = ROOT / manifest_path
    with manifest_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def is_base_reference(manifest: dict | None) -> bool:
    return "base_reference" in str(((manifest or {}).get("routing") or {}).get("mutation_policy") or "")


def render_routes(routes: list[dict]) -> str:
    rows: list[str] = []
    for route in routes:
        parts = [f'pattern = "{route["pattern"]}"']
        if route.get("zone_name"):
            parts.append(f'zone_name = "{route["zone_name"]}"')
        if route.get("zone_id"):
            parts.append(f'zone_id = "{route["zone_id"]}"')
        rows.append("  { " + ", ".join(parts) + " }")
    return ",\n".join(rows)


def static_validation(manifest_path: str | None = None) -> dict:
    command = ["node", str(STATIC_VALIDATOR)]
    if manifest_path:
        command.extend(["--manifest", str(Path(manifest_path).resolve())])
    result = run(command)
    payload = {
        "command": command,
        "exit_code": result.returncode,
        "pass": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
    if result.returncode == 0:
        try:
            payload["details"] = json.loads(result.stdout)
        except json.JSONDecodeError:
            payload["details"] = None
    return payload


def capabilities(manifest_path: str | None = None) -> dict:
    manifest = load_manifest(manifest_path)
    validation = static_validation(manifest_path)
    desktop_native_visual_gate = (
        validate_desktop_native_visual_gate(Path(manifest_path).resolve(), manifest)
        if manifest_path and manifest
        else None
    )
    target_selected = bool(manifest_path and manifest)
    base_reference = is_base_reference(manifest)
    supports_live_apply = bool(
        target_selected
        and not base_reference
        and validation["pass"]
        and CANONICAL_WORKER.exists()
        and CANONICAL_RUNTIME.exists()
        and CONSENT_WIDGET.exists()
    )
    if supports_live_apply:
        blocked_reason = None
    elif base_reference:
        blocked_reason = "Selected manifest is a protected golden reference. References may be validated/captured only, never overwritten by a generated package."
    elif not target_selected:
        blocked_reason = "No live apply target manifest has been explicitly selected."
    else:
        blocked_reason = "Canonical package static validation or required runtime files are missing."
    return {
        "name": "resi_edge_deploy_adapter",
        "canonical_deploy_adapter": True,
        "supports_live_apply": supports_live_apply,
        "status": "live_capable" if supports_live_apply else "blocked",
        "blocked_reason": blocked_reason,
        "target_manifest": str(Path(manifest_path).resolve()) if manifest_path else None,
        "target_domain": ((manifest or {}).get("target") or {}).get("domain"),
        "reference_mutation_allowed": False,
        "static_validation": validation,
        "desktop_native_visual_gate": desktop_native_visual_gate,
        "non_deviation": {
            "property_specific_worker_rebuilds_allowed": False,
            "desktop_topper_allowed": False,
            "continue_after_failed_gate_allowed": False,
            "protected_reference_mutation_allowed": False,
        },
    }


def build_deploy_bundle(manifest_path: Path, out_dir: Path, topper_mode: str = "bundled") -> Path:
    manifest = load_manifest(str(manifest_path))
    if not manifest:
        raise ValueError("manifest could not be loaded")
    if is_base_reference(manifest):
        raise ValueError("protected golden reference manifests may not build deploy bundles")
    target = manifest["target"]
    routing = manifest["routing"]
    bundle_dir = out_dir / "deploy-bundle"
    bundle_dir.mkdir(parents=True, exist_ok=True)
    if topper_mode == "centralized":
        return build_centralized_deploy_bundle(manifest_path, manifest, bundle_dir)
    if topper_mode != "bundled":
        raise ValueError(f"unsupported topper mode: {topper_mode}")
    consent_dir = bundle_dir / "resi-consent-widget"
    consent_dir.mkdir(parents=True, exist_ok=True)
    runtime = CANONICAL_RUNTIME.read_text(encoding="utf-8")
    runtime = runtime.replace("../resi-consent-widget/widget.mjs", "./resi-consent-widget/widget.mjs")
    runtime = runtime.replace(
        "../../../../config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json",
        "./release-tokens.json",
    )
    (bundle_dir / "runtime.mjs").write_text(runtime, encoding="utf-8")
    shutil.copy2(CONSENT_WIDGET, consent_dir / "widget.mjs")
    shutil.copy2(RELEASE_TOKENS, bundle_dir / "release-tokens.json")
    shutil.copy2(manifest_path, bundle_dir / "manifest.json")
    worker = CANONICAL_WORKER.read_text(encoding="utf-8")
    worker = worker.replace(
        'import manifest from "../../../config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json";',
        'import manifest from "./manifest.json";',
    )
    worker = worker.replace('from "../shared/resi-edge-package/runtime.mjs";', 'from "./runtime.mjs";')
    (bundle_dir / "worker.js").write_text(worker, encoding="utf-8")
    worker_name = selected_worker_name(routing, target["domain"])
    routes = [{"pattern": routing["route_pattern"], "zone_name": routing["cloudflare_zone_name"]}]
    wrangler = f'''name = "{worker_name}"
main = "worker.js"
compatibility_date = "2024-12-01"
account_id = "{ACCOUNT_ID}"
workers_dev = false

routes = [
{render_routes(routes)}
]

[[d1_databases]]
binding = "POP_BRIEF_DB"
database_name = "pop-brief-db"
database_id = "{D1_DATABASE_ID}"

[[r2_buckets]]
binding = "RESI_EDGE_ASSETS"
bucket_name = "resi-edge-assets"

'''
    config_path = bundle_dir / "wrangler.toml"
    config_path.write_text(wrangler, encoding="utf-8")
    return config_path


def build_centralized_deploy_bundle(manifest_path: Path, manifest: dict, bundle_dir: Path) -> Path:
    target = manifest["target"]
    routing = manifest["routing"]
    consent_dir = bundle_dir / "resi-consent-widget"
    consent_dir.mkdir(parents=True, exist_ok=True)
    runtime = CANONICAL_RUNTIME.read_text(encoding="utf-8")
    runtime = runtime.replace("../resi-consent-widget/widget.mjs", "./resi-consent-widget/widget.mjs")
    runtime = runtime.replace(
        "../../../../config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json",
        "./release-tokens.json",
    )
    (bundle_dir / "runtime.mjs").write_text(runtime, encoding="utf-8")
    shutil.copy2(CONSENT_WIDGET, consent_dir / "widget.mjs")
    shutil.copy2(RELEASE_TOKENS, bundle_dir / "release-tokens.json")
    shutil.copy2(manifest_path, bundle_dir / "manifest.json")
    worker = THIN_PROPERTY_WORKER.read_text(encoding="utf-8")
    worker = worker.replace(
        'import manifest from "../../../config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json";',
        'import manifest from "./manifest.json";',
    )
    worker = worker.replace('from "../shared/resi-edge-package/runtime.mjs";', 'from "./runtime.mjs";')
    (bundle_dir / "worker.js").write_text(worker, encoding="utf-8")
    worker_name = selected_worker_name(routing, target["domain"])
    routes = [{"pattern": routing["route_pattern"], "zone_name": routing["cloudflare_zone_name"]}]
    wrangler = f'''name = "{worker_name}"
main = "worker.js"
compatibility_date = "2024-12-01"
account_id = "{ACCOUNT_ID}"
workers_dev = false

routes = [
{render_routes(routes)}
]

services = [
  {{ binding = "RESI_EDGE_TOPPER", service = "resi-edge-topper-service" }}
]

[[r2_buckets]]
binding = "RESI_EDGE_ASSETS"
bucket_name = "resi-edge-assets"

'''
    config_path = bundle_dir / "wrangler.toml"
    config_path.write_text(wrangler, encoding="utf-8")
    return config_path


def validate_deploy_bundle(manifest_path: Path, out_dir: Path, topper_mode: str = "bundled") -> dict:
    result: dict = {
        "pass": False,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(manifest_path),
        "out_dir": str(out_dir),
        "topper_mode": topper_mode,
    }
    try:
        config_path = build_deploy_bundle(manifest_path, out_dir, topper_mode=topper_mode)
    except Exception as exc:
        result.update({"reason": f"Bundle build failed: {exc}"})
        return result

    bundle_dir = config_path.parent
    worker = bundle_dir / "worker.js"
    runtime = bundle_dir / "runtime.mjs"
    widget = bundle_dir / "resi-consent-widget/widget.mjs"
    release_tokens = bundle_dir / "release-tokens.json"
    if topper_mode == "centralized":
        expected_files = [worker, runtime, widget, release_tokens, bundle_dir / "manifest.json", bundle_dir / "wrangler.toml"]
    else:
        expected_files = [worker, runtime, widget, release_tokens, bundle_dir / "manifest.json", bundle_dir / "wrangler.toml"]
    missing = [str(path.relative_to(bundle_dir)) for path in expected_files if not path.exists()]
    if missing:
        result.update({"reason": "Deploy bundle is missing required files.", "missing_files": missing, "wrangler_config": str(config_path)})
        return result

    config_text = config_path.read_text(encoding="utf-8")
    if topper_mode == "centralized":
        worker_text = worker.read_text(encoding="utf-8")
        runtime_text = runtime.read_text(encoding="utf-8")
        if 'from "./runtime.mjs"' not in worker_text:
            result.update({"reason": "Centralized deploy bundle property Worker must import the local traffic-owner runtime.", "wrangler_config": str(config_path)})
            return result
        if "renderMobileShell(" in worker_text:
            result.update({"reason": "Centralized property Worker must delegate mobile shell rendering to the central service.", "wrangler_config": str(config_path)})
            return result
        if "../resi-consent-widget/widget.mjs" in runtime_text:
            result.update({"reason": "Centralized deploy bundle runtime still contains an unresolved source-relative consent widget import.", "wrangler_config": str(config_path)})
            return result
        if "resi-edge-release-tokens.v1.json" in runtime_text or "./release-tokens.json" not in runtime_text:
            result.update({"reason": "Centralized deploy bundle runtime does not consume the bundled release token file.", "wrangler_config": str(config_path)})
            return result
        if 'binding = "RESI_EDGE_TOPPER"' not in config_text or 'service = "resi-edge-topper-service"' not in config_text:
            result.update({"reason": "Centralized deploy bundle is missing the RESI_EDGE_TOPPER service binding.", "wrangler_config": str(config_path)})
            return result
        if 'binding = "RESI_EDGE_ASSETS"' not in config_text:
            result.update({"reason": "Centralized deploy bundle is missing the RESI_EDGE_ASSETS binding for assets/config.", "wrangler_config": str(config_path)})
            return result
    else:
        runtime_text = runtime.read_text(encoding="utf-8")
        if "../resi-consent-widget/widget.mjs" in runtime_text:
            result.update({"reason": "Deploy bundle runtime still contains an unresolved source-relative consent widget import.", "wrangler_config": str(config_path)})
            return result
        if "resi-edge-release-tokens.v1.json" in runtime_text or "./release-tokens.json" not in runtime_text:
            result.update({"reason": "Deploy bundle runtime does not consume the bundled release token file.", "wrangler_config": str(config_path)})
            return result
        if 'OFFICIAL_LBLE_SVG_PATH = "/assets/resi-edge-assets/shared/lble.svg"' not in runtime_text:
            result.update({"reason": "Deploy bundle does not reference the official same-origin LBLE SVG asset.", "wrangler_config": str(config_path)})
            return result

    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        result.update({"reason": "Cloudflare API token was not resolved through Keeper-backed Wrangler auth.", "wrangler_config": str(config_path)})
        return result
    command = [*npx_wrangler_prefix(env), "deploy", "--dry-run", "--config", str(config_path)]
    dry_run = run(command, cwd=bundle_dir, env=env)
    result.update(
        {
            "pass": dry_run.returncode == 0,
            "command": command,
            "wrangler_config": str(config_path),
            "exit_code": dry_run.returncode,
            "stdout": dry_run.stdout,
            "stderr": dry_run.stderr,
            "files": [str(path.relative_to(bundle_dir)) for path in expected_files],
        }
    )
    if dry_run.returncode != 0:
        result["reason"] = "Wrangler dry-run failed for the generated deploy bundle."
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resi Edge deploy adapter gate")
    parser.add_argument("--capabilities", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--validate-bundle", action="store_true")
    parser.add_argument("--manifest")
    parser.add_argument("--out-dir")
    parser.add_argument("--topper-mode", choices=["bundled", "centralized"], default="bundled")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    caps = capabilities(args.manifest)
    if args.capabilities:
        print(json.dumps({**caps, "generated_at": datetime.now(timezone.utc).isoformat()}, indent=2))
        return 0
    if args.validate_bundle:
        out_dir = (Path(args.out_dir) if args.out_dir else ROOT / "reports/resi_edge_performance/08-09-2026/deploy-bundle-validation").resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        if not args.manifest:
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "reason": "Deploy bundle validation requires --manifest for the selected target.",
            }
        elif not caps["supports_live_apply"]:
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "capabilities": caps,
                "reason": caps["blocked_reason"],
            }
        else:
            payload = validate_deploy_bundle(Path(args.manifest).resolve(), out_dir, topper_mode=args.topper_mode)
            payload["blocked"] = not payload.get("pass", False)
            payload["capabilities"] = caps
        (out_dir / "deploy-bundle-validation.json").write_text(json.dumps(payload, indent=2) + "\n")
        print(json.dumps(payload, indent=2))
        return 0 if payload.get("pass") else 3
    if args.apply:
        out_dir = (Path(args.out_dir) if args.out_dir else ROOT / "reports/resi_edge_performance/08-09-2026/deploy-adapter").resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        if not caps["supports_live_apply"]:
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "capabilities": caps,
                "reason": caps["blocked_reason"],
            }
            (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
            print(json.dumps(payload, indent=2))
            return 3
        env = build_runtime_env()
        if not env.get("CLOUDFLARE_API_TOKEN"):
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "reason": "Cloudflare API token was not resolved through Keeper-backed Wrangler auth.",
            }
            (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
            print(json.dumps(payload, indent=2))
            return 3
        if not args.manifest:
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "reason": "Apply requires --manifest for the selected target.",
            }
            (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
            print(json.dumps(payload, indent=2))
            return 3
        manifest = load_manifest(args.manifest)
        scope_lock = validate_apply_scope_lock(manifest)
        if not scope_lock.get("pass"):
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "reason": scope_lock.get("reason"),
                "scope_lock": scope_lock,
                "capabilities": caps,
            }
            (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
            print(json.dumps(payload, indent=2))
            return 3
        desktop_native_visual_gate = validate_desktop_native_visual_gate(Path(args.manifest).resolve(), manifest)
        if not desktop_native_visual_gate.get("pass"):
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "reason": desktop_native_visual_gate.get("reason"),
                "desktop_native_visual_gate": desktop_native_visual_gate,
                "scope_lock": scope_lock,
                "capabilities": caps,
            }
            (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
            print(json.dumps(payload, indent=2))
            return 3
        if args.topper_mode == "centralized":
            central_proof = validate_centralized_apply_proof(Path(args.manifest).resolve(), manifest)
            if not central_proof.get("pass"):
                payload = {
                    "pass": False,
                    "blocked": True,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "reason": central_proof.get("reason"),
                    "centralized_local_proof": central_proof,
                    "scope_lock": scope_lock,
                    "capabilities": caps,
                }
                (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
                print(json.dumps(payload, indent=2))
                return 3
        route_cleanup = remove_stale_sentinel_route(env["CLOUDFLARE_API_TOKEN"], manifest) if manifest else {
            "pass": False,
            "reason": "Manifest could not be loaded for route cleanup.",
        }
        if not route_cleanup.get("pass"):
            payload = {
                "pass": False,
                "blocked": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "reason": route_cleanup.get("reason") or "Cloudflare stale route cleanup failed.",
                "route_cleanup": route_cleanup,
                "desktop_native_visual_gate": desktop_native_visual_gate,
                "capabilities": caps,
            }
            (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
            print(json.dumps(payload, indent=2))
            return 3
        wrangler_config = build_deploy_bundle(Path(args.manifest).resolve(), out_dir, topper_mode=args.topper_mode)
        command = [*npx_wrangler_prefix(env), "deploy", "--config", str(wrangler_config)]
        result = run(command, cwd=wrangler_config.parent, env=env)
        payload = {
            "pass": result.returncode == 0,
            "blocked": result.returncode != 0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "command": command,
            "wrangler_config": str(wrangler_config),
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "route_cleanup": route_cleanup,
            "desktop_native_visual_gate": desktop_native_visual_gate,
            "centralized_local_proof": (
                validate_centralized_apply_proof(Path(args.manifest).resolve(), manifest)
                if args.topper_mode == "centralized"
                else None
            ),
            "capabilities": caps,
        }
        (out_dir / "deploy-adapter-readout.json").write_text(json.dumps(payload, indent=2) + "\n")
        print(
            json.dumps(payload, indent=2)
        )
        return 0 if payload["pass"] else 3
    print(json.dumps(caps, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
