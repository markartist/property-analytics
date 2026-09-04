#!/usr/bin/env python3
"""Validate Resi Edge release-control files before any rollout work."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json"
REGISTER = ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json"
CONSENT_CONTRACT_PATH = ROOT / "ops/cloudflare/shared/resi-consent-widget/contract.json"
CENTRAL_TOPPER_CONTRACT = ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json"

REQUIRED_PROPERTY_FIELDS = {
    "id",
    "property_code",
    "property_name",
    "domain",
    "manifest",
    "status",
    "token_version",
    "runtime_contract",
    "desktop_state",
    "mobile_state",
    "analytics_state",
    "consent_state",
    "freshness_state",
    "ahrefs_state",
    "rollback_state",
    "next_action",
}

APPROVED_COLORS = {
    "#15284B",
    "#3D66B9",
    "#294782",
    "#5A81CF",
    "#7DCAC2",
    "#E02472",
    "#F6F6F5",
    "#BD4830",
    "#D6D6D2",
    "#3B9189",
    "#9B9B96",
    "#000000",
    "#FFFFFF",
}


def load_json(path: Path) -> dict:
    with path.open() as handle:
        return json.load(handle)


def rel_exists(path_text: str | None) -> bool:
    if not path_text:
        return False
    return (ROOT / path_text).exists()


def main() -> int:
    errors: list[str] = []

    if not TOKENS.exists():
        errors.append(f"missing token file: {TOKENS}")
        tokens = {}
    else:
        tokens = load_json(TOKENS)
    consent_contract = load_json(CONSENT_CONTRACT_PATH) if CONSENT_CONTRACT_PATH.exists() else {}
    if not consent_contract:
        errors.append(f"missing consent contract: {CONSENT_CONTRACT_PATH}")

    if not REGISTER.exists():
        errors.append(f"missing register file: {REGISTER}")
        register = {}
    else:
        register = load_json(REGISTER)

    if tokens.get("schema_version") != "resi_edge_release_tokens_v1":
        errors.append("token file schema_version must be resi_edge_release_tokens_v1")
    if register.get("schema_version") != "resi_edge_pilot_rollout_register_v1":
        errors.append("register schema_version must be resi_edge_pilot_rollout_register_v1")

    token_contract = tokens.get("package_contract_id")
    if token_contract != "resi-edge-canonical-upgrade-package":
        errors.append("token package_contract_id must be resi-edge-canonical-upgrade-package")
    active_token_version = tokens.get("active_token_version")
    if not isinstance(active_token_version, str) or not active_token_version:
        errors.append("token active_token_version must be a non-empty string")

    release_rules = tokens.get("release_rules", {})
    for rule in (
        "desktop_topper_allowed",
        "property_specific_worker_rebuilds_allowed",
        "continue_after_failed_gate_allowed",
        "protected_reference_mutation_allowed",
        "live_apply_without_stage_allowed",
        "analytics_direct_wp_scripts_allowed",
        "consent_widget_local_forks_allowed",
    ):
        if release_rules.get(rule) is not False:
            errors.append(f"release rule {rule} must be false")

    defaults = tokens.get("defaults", {})
    mobile_shell = defaults.get("mobile_shell", {})
    promo_bar = mobile_shell.get("promo_bar", {})
    header = mobile_shell.get("header", {})
    for label, value in {
        "promo_bar.background": promo_bar.get("background"),
        "promo_bar.text_color": promo_bar.get("text_color"),
        "header.background": header.get("background"),
        "header.text_color": header.get("text_color"),
        "header.tour_button_border_color": header.get("tour_button_border_color"),
        "header.tour_button_text_color": header.get("tour_button_text_color"),
    }.items():
        if value not in APPROVED_COLORS:
            errors.append(f"{label} uses non-approved color {value!r}")
    consent_defaults = mobile_shell.get("consent", {})
    consent_version = consent_contract.get("version")
    if consent_defaults.get("version") != consent_version:
        errors.append(f"defaults.mobile_shell.consent.version must match shared consent contract {consent_version}")
    if consent_defaults.get("source") != "ops/cloudflare/shared/resi-consent-widget/widget.mjs":
        errors.append("defaults.mobile_shell.consent.source must point to the shared consent widget")

    source = tokens.get("source_of_truth", {})
    for field in (
        "runtime",
        "worker",
        "central_topper_contract",
        "central_topper_service_worker",
        "thin_property_worker",
        "central_topper_record_builder",
        "manifest_schema",
        "canary_manifest",
        "canary_evidence",
    ):
        if not rel_exists(source.get(field)):
            errors.append(f"source_of_truth.{field} does not exist: {source.get(field)}")
    central_contract = load_json(CENTRAL_TOPPER_CONTRACT) if CENTRAL_TOPPER_CONTRACT.exists() else {}
    if central_contract.get("schema_version") != "resi_edge_central_topper_runtime_v1":
        errors.append("central topper contract schema_version must be resi_edge_central_topper_runtime_v1")
    if central_contract.get("non_deviation_contract", {}).get("property_specific_topper_scripts_allowed") is not False:
        errors.append("central topper contract must forbid property-specific topper scripts")
    if central_contract.get("delivery_model", {}).get("production_default") != "bundled_until_mark_approves_central_canary":
        errors.append("central topper contract production_default must preserve bundled mode until Mark approves a central canary")
    topper_delivery = tokens.get("topper_delivery", {})
    if topper_delivery.get("current_default") != "bundled_property_worker":
        errors.append("topper_delivery.current_default must remain bundled_property_worker until central canary approval")
    if topper_delivery.get("migration_target") != "centralized_topper_service_with_thin_property_workers":
        errors.append("topper_delivery.migration_target must be centralized_topper_service_with_thin_property_workers")
    if topper_delivery.get("canary_required_before_default_change") is not True:
        errors.append("topper_delivery.canary_required_before_default_change must be true")

    properties = register.get("properties", [])
    if not properties:
        errors.append("register must contain at least one property")

    seen_ids: set[str] = set()
    for index, prop in enumerate(properties):
        missing = REQUIRED_PROPERTY_FIELDS - set(prop)
        if missing:
            errors.append(f"property[{index}] missing fields: {sorted(missing)}")
        prop_id = prop.get("id")
        if prop_id in seen_ids:
            errors.append(f"duplicate property id: {prop_id}")
        seen_ids.add(prop_id)
        if not rel_exists(prop.get("manifest")):
            errors.append(f"{prop_id} manifest missing: {prop.get('manifest')}")
        if prop.get("runtime_contract") != token_contract:
            errors.append(f"{prop_id} runtime_contract does not match token contract")
        if prop.get("status") == "live_canary_passed":
            if not rel_exists(prop.get("live_evidence")):
                errors.append(f"{prop_id} live canary evidence missing: {prop.get('live_evidence')}")
            if prop.get("mobile_psi", 0) < defaults.get("performance", {}).get("mobile_psi_target", 100):
                errors.append(f"{prop_id} mobile PSI is below canary target")
            if prop.get("desktop_psi", 0) < defaults.get("performance", {}).get("desktop_psi_target", 90):
                errors.append(f"{prop_id} desktop PSI is below target")

    excluded = register.get("excluded_manifests", [])
    for item in excluded:
        if not rel_exists(item.get("manifest")):
            errors.append(f"excluded manifest missing: {item.get('manifest')}")
        if not item.get("reason"):
            errors.append(f"excluded manifest has no reason: {item.get('manifest')}")

    result = {
        "pass": not errors,
        "token_file": str(TOKENS),
        "register_file": str(REGISTER),
        "property_count": len(properties),
        "excluded_manifest_count": len(excluded),
        "errors": errors,
    }
    print(json.dumps(result, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
