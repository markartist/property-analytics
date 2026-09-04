#!/usr/bin/env python3
"""Verify the Resi Edge contract gates are represented by the runner."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-edge-package/contract.json"
CONSENT_CONTRACT_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-consent-widget/contract.json"
STANDARDS_REGISTRY_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-standards/registry.json"
RUNNER_PATH = REPO_ROOT / "scripts/run_resi_edge_upgrade.py"
PROCESS_AUDITOR_PATH = REPO_ROOT / "scripts/audit_resi_edge_rollout_process.py"
BATCH_AUDITOR_PATH = REPO_ROOT / "scripts/audit_resi_edge_rollout_batch.py"
MANIFEST_DIR = REPO_ROOT / "config/portfolio_resi_edge_stabilization"
ASSET_GENERATOR_PATH = REPO_ROOT / "scripts/generate_resi_edge_assets.py"
ASSET_UPLOADER_PATH = REPO_ROOT / "scripts/upload_resi_edge_assets_to_r2.py"
DEPLOY_ADAPTER_PATH = REPO_ROOT / "scripts/resi_edge_deploy_adapter.py"
MANIFEST_SCHEMA_PATH = MANIFEST_DIR / "resi-edge-manifest.schema.json"


def gate_quoted(text: str, gate: str) -> bool:
    return bool(re.search(rf"['\"]{re.escape(gate)}['\"]", text))


def main() -> int:
    contract = json.loads(CONTRACT_PATH.read_text())
    consent_contract = json.loads(CONSENT_CONTRACT_PATH.read_text())
    standards_registry = json.loads(STANDARDS_REGISTRY_PATH.read_text())
    runner = RUNNER_PATH.read_text()
    process_auditor = PROCESS_AUDITOR_PATH.read_text()
    batch_auditor = BATCH_AUDITOR_PATH.read_text()
    generator = ASSET_GENERATOR_PATH.read_text()
    uploader = ASSET_UPLOADER_PATH.read_text()
    deploy_adapter = DEPLOY_ADAPTER_PATH.read_text()
    manifest_schema = MANIFEST_SCHEMA_PATH.read_text()
    gates = contract.get("required_gates") or []

    missing = [gate for gate in gates if not gate_quoted(runner, gate)]
    if missing:
        print("Resi Edge gate coverage failed. Missing gates:")
        for gate in missing:
            print(f"- {gate}")
        return 1

    if "--require-live-proof" not in runner:
        print("Resi Edge gate coverage failed. Runner does not enforce --require-live-proof.")
        return 1

    stage_required_terms = [
        "choices=[\"plan\", \"stage\", \"validate-reference\", \"apply\"]",
        "def mode_stage",
        "STAGE_REQUIRED_GATES",
        "asset_generation_upload_passed",
        "zaraz_analytics_package_applied",
        "deploy_bundle_closure_verified",
        "run_deploy_bundle_validation",
    ]
    for term in stage_required_terms:
        if term not in runner:
            print(f"Resi Edge gate coverage failed. Runner is missing staged-readiness enforcement term: {term}")
            return 1

    if "MOBILE_PSI_PARITY_TARGET = 98" not in runner:
        print("Resi Edge gate coverage failed. Runner does not preserve mobile PSI reference parity target.")
        return 1

    if "EXPECTED_HEAP_MODE = \"interaction_only_queue_v6_input_only_cs_verify_home_204\"" not in runner:
        print("Resi Edge gate coverage failed. Runner does not preserve Heap v6 interaction-only mode.")
        return 1
    process_audit_terms = [
        "PROCESS_AUDITOR",
        "BATCH_AUDITOR",
        "batch_inventory_audit_passed",
        "process_scenario_audit_passed",
        "run_batch_inventory_audit",
        "run_process_scenario_audit",
        "run_dashboard_finalization",
        "dashboard-finalization.json",
        "phase-timings.json",
        "phase_timings",
    ]
    for term in process_audit_terms:
        if term not in runner:
            print(f"Resi Edge gate coverage failed. Runner does not enforce the process scenario audit term: {term}")
            return 1
    process_auditor_terms = [
        "draft_stage_retained",
        "stale_consent_version",
        "ga4_status_wordpress_owned",
        "wrong_heap_id",
        "incomplete_drawer_nav_reviews_missing",
        "bad_tour_url",
        "desktop_topper_allowed",
        "property_specific_variant_allowed",
        "hero_asset_not_same_origin_avif",
    ]
    for term in process_auditor_terms:
        if term not in process_auditor:
            print(f"Resi Edge gate coverage failed. Process scenario audit is missing required drift scenario: {term}")
            return 1
    batch_auditor_terms = [
        "resi_edge_batch_rollout_audit_v1",
        "duplicate active production domain manifest",
        "duplicate active production property-code manifest",
        "filename does not match target.domain",
        "release token canary_manifest is not an active production manifest",
        "rollout register property",
    ]
    for term in batch_auditor_terms:
        if term not in batch_auditor:
            print(f"Resi Edge gate coverage failed. Batch rollout audit is missing required inventory guard: {term}")
            return 1

    if "CONSENT_CONTRACT_PATH" not in runner or "EXPECTED_CONSENT_WIDGET_VERSION" not in runner:
        print("Resi Edge gate coverage failed. Runner does not load the shared consent widget contract.")
        return 1
    if "hero_title_contract" not in runner or "heroStack" not in runner or "approved SVG title geometry is outside approved mobile template bounds" not in runner:
        print("Resi Edge gate coverage failed. Runner does not enforce the approved SVG hero title geometry proof.")
        return 1
    if "heroFullHeight" not in runner or "mobile hero does not fill first viewport below promo/header" not in runner:
        print("Resi Edge gate coverage failed. Runner does not enforce the full-height mobile hero proof.")
        return 1
    wordpress_terms = [
        "validate_wordpress_control_path_bypass",
        "fetch_control_path",
        "wordpress_control_path_bypass_proven",
        "/wp-login.php",
        "/wp-admin/",
        "/wp-json/",
        "wordpress_test_cookie",
        "edge_marker_present",
    ]
    for term in wordpress_terms:
        if term not in runner:
            print(f"Resi Edge gate coverage failed. Runner does not enforce WordPress control-path bypass proof term: {term}")
            return 1

    consent_version = consent_contract.get("version")
    if not consent_version:
        print("Resi Edge gate coverage failed. Shared consent widget contract has no version.")
        return 1
    if consent_version not in manifest_schema:
        print("Resi Edge gate coverage failed. Manifest schema does not enforce the shared consent widget version.")
        return 1
    registry_text = json.dumps(standards_registry)
    if "resi-zaraz-consent-widget" not in registry_text or consent_version not in registry_text:
        print("Resi Edge gate coverage failed. Shared standards registry does not include the active consent widget version.")
        return 1
    if "resi-zaraz-analytics-package" not in registry_text or "resi-source-attribution" not in registry_text:
        print("Resi Edge gate coverage failed. Shared standards registry is missing required package families.")
        return 1

    if "apply_browser_gate" not in runner:
        print("Resi Edge gate coverage failed. Browser acceptance gate mapping is missing.")
        return 1

    forbidden_runner_terms = ["--allow-desktop-direct-analytics", "allow_desktop_direct_analytics"]
    forbidden_runner_terms.extend(["level-set-reference", "reference_level_set_requested", "allow_reference_level_set"])
    for term in forbidden_runner_terms:
        if term in runner:
            print(f"Resi Edge gate coverage failed. Runner contains forbidden analytics bypass term: {term}")
            return 1
    if "--allow-reference-level-set" in deploy_adapter or "allow_reference_level_set" in deploy_adapter:
        print("Resi Edge gate coverage failed. Deploy adapter contains forbidden protected-reference mutation support.")
        return 1

    forbidden_asset_terms = ["DESKTOP_HERO", "hero_desktop", "image_desktop"]
    for term in forbidden_asset_terms:
        if term in generator:
            print(f"Resi Edge gate coverage failed. Asset generator contains forbidden desktop asset term: {term}")
            return 1

    if "MOBILE_HERO_WEBP_MAX_BYTES = 80_000" not in generator or "save_webp_to_budget" not in generator:
        print("Resi Edge gate coverage failed. Asset generator does not enforce the mobile WebP hero byte budget.")
        return 1
    if "\"--force\"" in uploader:
        print("Resi Edge gate coverage failed. R2 uploader still contains obsolete Wrangler --force usage.")
        return 1
    if (
        "CONSENT_WIDGET" not in deploy_adapter
        or "def validate_deploy_bundle" not in deploy_adapter
        or "--validate-bundle" not in deploy_adapter
        or "./resi-consent-widget/widget.mjs" not in deploy_adapter
        or ".resolve()" not in deploy_adapter
    ):
        print("Resi Edge gate coverage failed. Deploy adapter does not prove generated bundle closure for shared runtime dependencies.")
        return 1

    desktop_manifest_fields: list[str] = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        manifest = json.loads(path.read_text())
        if manifest.get("schema_version") != "resi_edge_manifest_v1":
            continue
        hero = ((manifest.get("mobile_shell") or {}).get("hero") or {})
        if "image_desktop" in hero:
            desktop_manifest_fields.append(str(path.relative_to(REPO_ROOT)))
        title_mode = hero.get("title_mode") or "shared_lble_svg"
        if title_mode == "shared_lble_svg":
            if hero.get("title_text") != "Live Better. Live Easy.":
                print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} does not use the official LBLE SVG accessible label.")
                return 1
            if hero.get("title_svg"):
                print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} declares title_svg in shared_lble_svg mode.")
                return 1
        elif title_mode == "property_tagline_svg":
            if not hero.get("title_text"):
                print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} is missing a property tagline accessible label.")
                return 1
            if not re.match(r"^/assets/resi-edge-assets/[^\"'<>\s]+\.svg$", str(hero.get("title_svg") or "")):
                print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} is missing a same-origin property tagline SVG.")
                return 1
            if not isinstance(hero.get("title_svg_lines"), list) or not hero.get("title_svg_lines"):
                print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} is missing title_svg_lines for property tagline SVG mode.")
                return 1
        else:
            print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} uses an unknown title mode: {title_mode}")
            return 1
        if "title_asset" in hero or "title_asset_text" in hero or "title_render_mode" in hero:
            print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} still contains stale LBLE asset-mode drift.")
            return 1
        if hero.get("tm_allowed") is not False:
            print(f"Resi Edge gate coverage failed. Active manifest {path.relative_to(REPO_ROOT)} does not explicitly disallow edge-added TM.")
            return 1
        routing = manifest.get("routing") or {}
        if "base_reference" in str(routing.get("mutation_policy") or ""):
            rollback = manifest.get("rollback") or {}
            restore_config = rollback.get("reference_restore_wrangler_config")
            if not routing.get("existing_worker_script"):
                print(f"Resi Edge gate coverage failed. Reference manifest {path.relative_to(REPO_ROOT)} is missing routing.existing_worker_script.")
                return 1
            if not restore_config or not (REPO_ROOT / restore_config).exists():
                print(f"Resi Edge gate coverage failed. Reference manifest {path.relative_to(REPO_ROOT)} is missing a valid rollback.reference_restore_wrangler_config.")
                return 1
            restore_text = (REPO_ROOT / restore_config).read_text()
            if "route" in restore_text and not routing.get("reference_preserve_routes"):
                print(f"Resi Edge gate coverage failed. Reference manifest {path.relative_to(REPO_ROOT)} is missing routing.reference_preserve_routes for a route-bearing restore config.")
                return 1
    if desktop_manifest_fields:
        print("Resi Edge gate coverage failed. Active manifests contain forbidden desktop hero fields:")
        for path in desktop_manifest_fields:
            print(f"- {path}")
        return 1

    print(f"Resi Edge gate coverage passed: {len(gates)} required gates represented; active manifests are mobile-asset only.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
