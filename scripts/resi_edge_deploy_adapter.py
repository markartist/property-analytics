#!/usr/bin/env python3
"""Canonical Resi Edge deploy adapter boundary.

This file is intentionally a hard gate until the shared renderer/deployer is
extracted from the approved TowneStone/Vine references. It prevents a property
operator from quietly applying a lookalike Worker or hand-built variant.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC_VALIDATOR = ROOT / "scripts/validate_resi_edge_package_static.mjs"
CANONICAL_WORKER = ROOT / "ops/cloudflare/resi-edge-canonical-worker/worker.js"
CANONICAL_RUNTIME = ROOT / "ops/cloudflare/shared/resi-edge-package/runtime.mjs"
CONSENT_WIDGET = ROOT / "ops/cloudflare/shared/resi-consent-widget/widget.mjs"
RELEASE_TOKENS = ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json"
ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"
D1_DATABASE_ID = "dad3e7d1-147b-438d-8cd0-2cbf537a87b2"
UNASSIGNED_WORKER_SENTINELS = {
    "not_yet_assigned_in_governed_package",
    "not_assigned",
    "pending",
    "none",
    "null",
}

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


def selected_worker_name(routing: dict, domain: str) -> str:
    existing = str(routing.get("existing_worker_script") or "").strip()
    if existing and existing.lower() not in UNASSIGNED_WORKER_SENTINELS:
        return existing
    return f"resi-edge-canonical-{slugify(domain)}"


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
        "non_deviation": {
            "property_specific_worker_rebuilds_allowed": False,
            "desktop_topper_allowed": False,
            "continue_after_failed_gate_allowed": False,
            "protected_reference_mutation_allowed": False,
        },
    }


def build_deploy_bundle(manifest_path: Path, out_dir: Path) -> Path:
    manifest = load_manifest(str(manifest_path))
    if not manifest:
        raise ValueError("manifest could not be loaded")
    if is_base_reference(manifest):
        raise ValueError("protected golden reference manifests may not build deploy bundles")
    target = manifest["target"]
    routing = manifest["routing"]
    bundle_dir = out_dir / "deploy-bundle"
    bundle_dir.mkdir(parents=True, exist_ok=True)
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


def validate_deploy_bundle(manifest_path: Path, out_dir: Path) -> dict:
    result: dict = {
        "pass": False,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(manifest_path),
        "out_dir": str(out_dir),
    }
    try:
        config_path = build_deploy_bundle(manifest_path, out_dir)
    except Exception as exc:
        result.update({"reason": f"Bundle build failed: {exc}"})
        return result

    bundle_dir = config_path.parent
    worker = bundle_dir / "worker.js"
    runtime = bundle_dir / "runtime.mjs"
    widget = bundle_dir / "resi-consent-widget/widget.mjs"
    release_tokens = bundle_dir / "release-tokens.json"
    expected_files = [worker, runtime, widget, release_tokens, bundle_dir / "manifest.json", bundle_dir / "wrangler.toml"]
    missing = [str(path.relative_to(bundle_dir)) for path in expected_files if not path.exists()]
    if missing:
        result.update({"reason": "Deploy bundle is missing required files.", "missing_files": missing, "wrangler_config": str(config_path)})
        return result

    runtime_text = runtime.read_text(encoding="utf-8")
    if "../resi-consent-widget/widget.mjs" in runtime_text:
        result.update({"reason": "Deploy bundle runtime still contains an unresolved source-relative consent widget import.", "wrangler_config": str(config_path)})
        return result
    if "resi-edge-release-tokens.v1.json" in runtime_text or "./release-tokens.json" not in runtime_text:
        result.update({"reason": "Deploy bundle runtime does not consume the bundled release token file.", "wrangler_config": str(config_path)})
        return result
    config_text = config_path.read_text(encoding="utf-8")
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
            payload = validate_deploy_bundle(Path(args.manifest).resolve(), out_dir)
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
        wrangler_config = build_deploy_bundle(Path(args.manifest).resolve(), out_dir)
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
