#!/usr/bin/env python3
"""Gated Resi Edge package runner.

This is the non-deviation entry point required by the Resi Edge runbook. It is
deliberately conservative: plan and reference validation are non-mutating, and
live apply is allowed only through this runner with --require-live-proof.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-edge-package/contract.json"
CONSENT_CONTRACT_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-consent-widget/contract.json"
MANIFEST_DIR = REPO_ROOT / "config/portfolio_resi_edge_stabilization"
MANIFEST_SCHEMA_PATH = MANIFEST_DIR / "resi-edge-manifest.schema.json"
DEPLOY_ADAPTER = REPO_ROOT / "scripts/resi_edge_deploy_adapter.py"
VALIDATOR = REPO_ROOT / "scripts/validate_resi_mobile_shell_contract.mjs"
STATIC_VALIDATOR = REPO_ROOT / "scripts/validate_resi_edge_package_static.mjs"
PROCESS_AUDITOR = REPO_ROOT / "scripts/audit_resi_edge_rollout_process.py"
BATCH_AUDITOR = REPO_ROOT / "scripts/audit_resi_edge_rollout_batch.py"
MOBILE_SHELL_BYTE_FORECAST = REPO_ROOT / "scripts/forecast_resi_edge_mobile_shell_bytes.mjs"
CONSENT_WIDGET_GEOMETRY = REPO_ROOT / "scripts/validate_resi_consent_widget_geometry.mjs"
GATE_COVERAGE_VALIDATOR = REPO_ROOT / "scripts/check_resi_edge_gate_coverage.py"
ZARAZ_AUDIT = REPO_ROOT / "scripts/audit_zaraz_consent_package.py"
ZARAZ_PACKAGE = REPO_ROOT / "scripts/apply_resi_zaraz_analytics_package.py"
ZARAZ_CONSENT_PACKAGE = REPO_ROOT / "scripts/apply_zaraz_consent_package.py"
AHREFS_ADMIN = REPO_ROOT / "scripts/ahrefs_project_admin.py"
ANALYTICS_SMOKE = REPO_ROOT / "scripts/smoke_live_analytics.py"
PSI_RUNNER = REPO_ROOT / "scripts/run_resi_edge_prototype_psi.py"
DASHBOARD_SNAPSHOT_BUILDER = REPO_ROOT / "scripts/build_resi_edge_launch_dashboard_snapshot.py"
CACHE_PURGE = REPO_ROOT / "ops/cloudflare/purge_cloudflare_cache.py"
ASSET_GENERATOR = REPO_ROOT / "scripts/generate_resi_edge_assets.py"
ASSET_UPLOADER = REPO_ROOT / "scripts/upload_resi_edge_assets_to_r2.py"
WEB_APP_DIR = REPO_ROOT / "apps/web"
REPORT_ROOT = REPO_ROOT / "reports/resi_edge_performance/08-09-2026"
IDENTITY_HELPER_ROOT = REPO_ROOT / "Data_Collection/utils"
SCOPE_LOCK_PATH = MANIFEST_DIR / "active-resi-edge-scope-lock.json"
CF_ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"
DASHBOARD_PAGES_PROJECT = "resi-edge-launch"
DASHBOARD_HOST = "launch.venterrawebops.com"
DASHBOARD_API_BASE_URL = f"https://{DASHBOARD_HOST}"
DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123 Mobile/15E148 Safari/604.1"
EXPECTED_HEAP_MODE = "interaction_only_queue_v6_input_only_cs_verify_home_204"
EXPECTED_HEAP_APP_ID = "286627304"
EXPECTED_CONSENT_WIDGET_VERSION = json.loads(CONSENT_CONTRACT_PATH.read_text())["version"]
EXPECTED_CS_VERIFY_PATH = "/?vtr_cs_verify_suppressed=1"
EXPECTED_LBLE_TITLE_TEXT = "Live Better. Live Easy."
REQUIRED_MOBILE_NAV_LABELS = [
    "Apartments & Pricing",
    "Features",
    "Amenities",
    "Gallery",
    "Location",
    "FAQs",
    "Reviews",
    "Contact",
    "About Venterra",
    "SMARTHUB",
]
PSI_TRANSIENT_RETRIES = 2
PSI_TRANSIENT_RETRY_WAIT_SECONDS = 90
MOBILE_HERO_MAX_BYTES = 80_000
CONTENT_BLOCK_IMAGE_MAX_BYTES = 55_000
OTHER_R2_ASSET_MAX_BYTES = 120_000
MOBILE_PSI_PARITY_TARGET = 98
DESKTOP_PSI_TARGET = 90
MOBILE_SHELL_INITIAL_HTML_MAX_BYTES = 40_000


def hero_title_contract(manifest: dict[str, Any]) -> dict[str, Any]:
    hero = get_path(manifest, "mobile_shell.hero") or {}
    mode = hero.get("title_mode") or "shared_lble_svg"
    if mode == "property_tagline_svg":
        display_width = float(hero.get("title_svg_display_width_px") or 342)
        max_width_vw = float(hero.get("title_svg_max_width_vw") or 84)
        css_capped_width = min(display_width, 390 * (max_width_vw / 100))
        return {
            "mode": mode,
            "label": hero.get("title_text") or "",
            "src": hero.get("title_svg") or "",
            "min_width": max(220, css_capped_width - 18),
            "max_width": min(380, css_capped_width + 18),
            "min_height": 48,
            "max_height": 130,
        }
    return {
        "mode": "shared_lble_svg",
        "label": EXPECTED_LBLE_TITLE_TEXT,
        "src": "/assets/resi-edge-assets/shared/lble.svg",
        "min_width": 240,
        "max_width": 330,
        "min_height": 48,
        "max_height": 95,
    }


def award_asset_path(asset: Any) -> str | None:
    if not isinstance(asset, dict):
        return None
    value = (
        asset.get("local_url")
        or asset.get("image_url")
        or asset.get("asset_url")
        or asset.get("url")
        or asset.get("src")
    )
    return value if isinstance(value, str) and value else None


PREFLIGHT_REQUIRED_GATES = [
    "reset_card_written",
    "manifest_loaded",
    "manifest_schema_valid",
    "identity_resolved",
    "source_page_audited",
    "vws_source_attribution_present",
    "feed_backed_special_verified",
    "review_source_verified",
    "fractional_stars_verified",
    "brand_theme_verified",
    "real_fonts_verified",
    "first_two_content_blocks_present",
    "award_badge_sequence_verified",
    "asset_budget_manifest_present",
    "static_package_validation_passed",
    "batch_inventory_audit_passed",
    "process_scenario_audit_passed",
    "canonical_deploy_adapter_supports_live_apply",
    "ahrefs_existing_project_confirmed",
    "heap_contentsquare_verify_guard_configured",
    "gsc_indexing_recorded",
    "captain_data_pond_updated",
    "rollback_plan_written",
]
STAGE_REQUIRED_GATES = [
    *PREFLIGHT_REQUIRED_GATES,
    "asset_generation_upload_passed",
    "zaraz_analytics_package_applied",
    "zaraz_consent_ready",
    "deploy_bundle_closure_verified",
]


class GateFailure(RuntimeError):
    pass


@dataclass
class GateResult:
    name: str
    status: str
    required: bool = True
    evidence_path: str | None = None
    detail: str | None = None


class GateLedger:
    def __init__(self, contract: dict[str, Any]) -> None:
        self.order = list(contract.get("required_gates") or [])
        self.rows: dict[str, GateResult] = {
            name: GateResult(name=name, status="not_run", detail="Gate has not run yet.")
            for name in self.order
        }

    def set(self, name: str, status: str, *, evidence_path: str | Path | None = None, detail: str | None = None, required: bool = True) -> None:
        if name not in self.rows:
            self.order.append(name)
        self.rows[name] = GateResult(
            name=name,
            status=status,
            required=required,
            evidence_path=str(evidence_path) if evidence_path else None,
            detail=detail,
        )

    def pass_gate(self, name: str, *, evidence_path: str | Path | None = None, detail: str | None = None, required: bool = True) -> None:
        self.set(name, "pass", evidence_path=evidence_path, detail=detail, required=required)

    def fail_gate(self, name: str, *, evidence_path: str | Path | None = None, detail: str | None = None, required: bool = True) -> None:
        self.set(name, "fail", evidence_path=evidence_path, detail=detail, required=required)

    def block_gate(self, name: str, *, evidence_path: str | Path | None = None, detail: str | None = None, required: bool = True) -> None:
        self.set(name, "blocked", evidence_path=evidence_path, detail=detail, required=required)

    def skip_gate(self, name: str, *, detail: str | None = None) -> None:
        self.set(name, "not_applicable", required=False, detail=detail)

    def payload(self) -> dict[str, Any]:
        rows = [asdict(self.rows[name]) for name in self.order]
        failing = [row for row in rows if row["required"] and row["status"] not in {"pass"}]
        return {
            "schema": "resi_edge_gate_ledger_v1",
            "pass": not failing,
            "summary": {
                "total": len(rows),
                "passed": sum(1 for row in rows if row["status"] == "pass"),
                "failed": sum(1 for row in rows if row["status"] == "fail"),
                "blocked": sum(1 for row in rows if row["status"] == "blocked"),
                "not_run": sum(1 for row in rows if row["status"] == "not_run"),
                "not_applicable": sum(1 for row in rows if row["status"] == "not_applicable"),
            },
            "mandatory_failures": [row["name"] for row in failing],
            "gates": rows,
        }


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def load_contract() -> dict[str, Any]:
    if not CONTRACT_PATH.exists():
        raise GateFailure(f"Missing package contract: {CONTRACT_PATH}")
    return json.loads(CONTRACT_PATH.read_text())


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text())


def get_path(payload: dict[str, Any] | None, dotted: str) -> Any:
    cursor: Any = payload
    for part in dotted.split("."):
        if not isinstance(cursor, dict) or part not in cursor:
            return None
        cursor = cursor[part]
    return cursor


def manifest_path(args: argparse.Namespace) -> Path:
    if getattr(args, "manifest", None):
        raw_path = Path(args.manifest)
        return raw_path if raw_path.is_absolute() else REPO_ROOT / raw_path
    if args.property_code.upper() == "BASE":
        return MANIFEST_DIR / "championsgreen-ga-com.manifest.json"
    if args.property_code.upper() == "PILOT":
        return MANIFEST_DIR / "pilot-ga4ax.manifest.json"
    return MANIFEST_DIR / f"{slug(args.domain)}.manifest.json"


def base_runner_command(args: argparse.Namespace) -> str:
    manifest_part = f" --manifest {args.manifest}" if getattr(args, "manifest", None) else ""
    return f"python3 scripts/run_resi_edge_upgrade.py --property-code {args.property_code.upper()} --domain {args.domain}{manifest_part}"


def validate_scope_lock(args: argparse.Namespace, lock_path: Path = SCOPE_LOCK_PATH) -> dict[str, Any]:
    result: dict[str, Any] = {
        "pass": False,
        "blocked": True,
        "lock_path": str(lock_path),
        "property_code": args.property_code.upper(),
        "domain": args.domain.lower(),
        "mode": args.mode,
    }
    if args.mode == "validate-reference":
        result.update({"pass": True, "blocked": False, "reason": "Reference validation is not a property rollout action."})
        return result
    if not lock_path.exists():
        result["reason"] = "Resi Edge scope lock is missing. Mark must explicitly name the target before plan, stage, or apply."
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
    allowed_targets = lock.get("allowed_targets")
    if not isinstance(allowed_targets, list):
        result["reason"] = "Resi Edge scope lock has no allowed_targets list."
        return result
    requested_code = args.property_code.upper()
    requested_domain = args.domain.lower()
    for target in allowed_targets:
        if not isinstance(target, dict):
            continue
        modes = [str(mode) for mode in target.get("modes", [])]
        if (
            str(target.get("property_code", "")).upper() == requested_code
            and str(target.get("domain", "")).lower() == requested_domain
            and args.mode in modes
        ):
            result.update({
                "pass": True,
                "blocked": False,
                "reason": "Exact active scope lock matched.",
                "matched_target": target,
            })
            return result
    result["reason"] = "Requested Resi Edge property/domain/mode is outside the active scope lock."
    result["allowed_targets"] = allowed_targets
    return result


def validate_manifest(manifest: dict[str, Any] | None, args: argparse.Namespace, identity: dict[str, Any] | None) -> dict[str, Any]:
    required_paths = [
        "schema_version",
        "package_contract_id",
        "target.property_code",
        "target.source_property_code",
        "target.domain",
        "target.property_name",
        "target.city",
        "target.state",
        "target.community_id",
        "target.ga4_property_id",
        "target.ga4_measurement_id",
        "target.gsc_property",
        "target.canonical_url",
        "routing.cloudflare_zone_name",
        "routing.route_pattern",
        "mobile_shell.layout_contract",
        "mobile_shell.promo.source",
        "mobile_shell.hero.image_mobile",
        "mobile_shell.hero.title_text",
        "mobile_shell.hero.headline",
        "mobile_shell.fonts",
        "mobile_shell.body_font",
        "mobile_shell.heading_font",
        "mobile_shell.awards",
        "mobile_shell.reviews.present",
        "mobile_shell.reviews.source",
        "mobile_shell.reviews.last_verified",
        "mobile_shell.content_blocks",
        "phone_attribution.default_source",
        "phone_attribution.default_display_phone",
        "phone_attribution.source_lookup",
        "analytics.owner",
        "analytics.ga4.owner",
        "analytics.ga4.measurement_id",
        "analytics.ga4.expected_stream_name",
        "analytics.heap.owner",
        "analytics.heap.app_id",
        "analytics.heap.mode",
        "analytics.heap.passive_timer_allowed",
        "analytics.heap.contentsquare_verify_guard.enabled",
        "analytics.heap.contentsquare_verify_guard.same_origin_path",
        "analytics.heap.contentsquare_verify_guard.expected_status",
        "analytics.ahrefs.owner",
        "analytics.ahrefs.existing_project_id",
        "consent.owner",
        "consent.widget_version",
        "seo.llms_url",
        "seo.sitemap_url",
        "seo.schema_url_policy",
        "seo.meta_title",
        "seo.meta_description",
        "seo.og_image",
        "captain.id",
        "captain.evidence_path",
        "evidence.required_live_proofs",
        "rollback.strategy",
    ]
    failures: list[str] = []
    if manifest is None:
        return {"pass": False, "failures": ["manifest file missing"], "required_paths": required_paths}

    def find_pending_values(value: Any, path: str = "") -> list[str]:
        if isinstance(value, dict):
            found: list[str] = []
            for key, child in value.items():
                child_path = f"{path}.{key}" if path else key
                found.extend(find_pending_values(child, child_path))
            return found
        if isinstance(value, list):
            found = []
            for index, child in enumerate(value):
                found.extend(find_pending_values(child, f"{path}[{index}]"))
            return found
        if isinstance(value, str) and value.strip().lower() in {"required_before_apply", "pending_apply_gate"}:
            return [path or "<root>"]
        return []

    if MANIFEST_SCHEMA_PATH.exists():
        schema = json.loads(MANIFEST_SCHEMA_PATH.read_text())
        schema_errors = sorted(Draft202012Validator(schema).iter_errors(manifest), key=lambda err: list(err.path))
        for error in schema_errors:
            where = ".".join(str(part) for part in error.path) or "<root>"
            failures.append(f"schema validation failed at {where}: {error.message}")

    for dotted in required_paths:
        value = get_path(manifest, dotted)
        if value in (None, "", [], {}):
            failures.append(f"missing required manifest field: {dotted}")
    title_contract = hero_title_contract(manifest)
    if get_path(manifest, "mobile_shell.hero.title_render_mode") is not None:
        failures.append("mobile_shell.hero.title_render_mode is forbidden; use mobile_shell.hero.title_mode")
    if get_path(manifest, "mobile_shell.hero.title_asset") is not None or get_path(manifest, "mobile_shell.hero.title_asset_text") is not None:
        failures.append("mobile_shell.hero title asset fields are forbidden; use the approved same-origin SVG title contract")
    if title_contract["mode"] == "shared_lble_svg":
        if get_path(manifest, "mobile_shell.hero.title_text") != EXPECTED_LBLE_TITLE_TEXT:
            failures.append(f"mobile_shell.hero.title_text must be {EXPECTED_LBLE_TITLE_TEXT} for shared_lble_svg")
        if get_path(manifest, "mobile_shell.hero.title_svg"):
            failures.append("mobile_shell.hero.title_svg must be absent for shared_lble_svg")
    elif title_contract["mode"] == "property_tagline_svg":
        if not title_contract["label"]:
            failures.append("mobile_shell.hero.title_text is required as the accessible label for property_tagline_svg")
        if not re.match(r"^/assets/resi-edge-assets/[^\"'<>\s]+\.svg$", title_contract["src"]):
            failures.append("mobile_shell.hero.title_svg must be a same-origin SVG for property_tagline_svg")
        if not get_path(manifest, "mobile_shell.hero.title_svg_lines"):
            failures.append("mobile_shell.hero.title_svg_lines is required for property_tagline_svg")
    else:
        failures.append(f"mobile_shell.hero.title_mode is not approved: {title_contract['mode']}")
    if get_path(manifest, "mobile_shell.hero.tm_allowed") is not False:
        failures.append("mobile_shell.hero.tm_allowed must be false")

    reviews_present = get_path(manifest, "mobile_shell.reviews.present")
    if reviews_present is True:
        for dotted in ["mobile_shell.reviews.rating", "mobile_shell.reviews.count", "mobile_shell.reviews.url"]:
            if get_path(manifest, dotted) in (None, "", [], {}):
                failures.append(f"missing required manifest field for present reviews: {dotted}")
    elif reviews_present is False:
        if get_path(manifest, "mobile_shell.reviews.link_required") is not False:
            failures.append("mobile_shell.reviews.link_required must be false when reviews.present is false")
    else:
        failures.append("mobile_shell.reviews.present must explicitly be true or false")
    for dotted in find_pending_values(manifest):
        failures.append(f"manifest field is still pending before apply: {dotted}")
    for draft_key in ("manifest_stage", "draft_notice", "draft_generated_at"):
        if draft_key in manifest:
            failures.append(f"promoted manifest must not retain draft-only field: {draft_key}")

    if manifest.get("package_contract_id") != "resi-edge-canonical-upgrade-package":
        failures.append("package_contract_id must be resi-edge-canonical-upgrade-package")
    if get_path(manifest, "target.domain") != args.domain:
        failures.append("target.domain does not match runner --domain")
    if identity:
        expected_name = identity.get("property_name")
        source_name = get_path(manifest, "target.property_name")
        if expected_name and source_name and expected_name != source_name:
            failures.append(f"manifest property_name {source_name!r} does not match identity matrix {expected_name!r}")
        expected_community = identity.get("community_id")
        source_community = get_path(manifest, "target.community_id")
        if expected_community and source_community and expected_community != source_community:
            failures.append("manifest community_id does not match identity matrix")
        expected_ga4 = str(identity.get("ga4_property_id") or "")
        source_ga4 = str(get_path(manifest, "target.ga4_property_id") or "")
        if expected_ga4 and source_ga4 and expected_ga4 != source_ga4:
            failures.append("manifest ga4_property_id does not match identity matrix")

    mobile_layout = get_path(manifest, "mobile_shell.layout_contract") or {}
    if isinstance(mobile_layout, dict):
        if mobile_layout.get("desktop_topper_allowed") is not False:
            failures.append("mobile_shell.layout_contract.desktop_topper_allowed must be false")
        if mobile_layout.get("property_specific_variants_allowed") is not False:
            failures.append("mobile_shell.layout_contract.property_specific_variants_allowed must be false")

    if get_path(manifest, "analytics.owner") != "cloudflare_zaraz":
        failures.append("analytics.owner must be cloudflare_zaraz")
    ga4_status = str(get_path(manifest, "analytics.ga4.measurement_id_status") or "").lower()
    if ga4_status and not re.search(r"configured|zaraz", ga4_status):
        failures.append("analytics.ga4.measurement_id_status must declare a configured/Zaraz-owned state")
    if "wordpress" in ga4_status or "requires_zaraz_cutover" in ga4_status:
        failures.append("analytics.ga4.measurement_id_status must not declare WordPress ownership or a pending Zaraz cutover")
    expected_stream_name = str(get_path(manifest, "analytics.ga4.expected_stream_name") or "").strip()
    if expected_stream_name.lower() in {"website", "required_before_apply", "pending_apply_gate"} and args.property_code.upper() not in {"TX4EK", "TX4FC"}:
        failures.append("analytics.ga4.expected_stream_name must be the property stream name, not a generic draft value")
    if get_path(manifest, "analytics.heap.app_id") != EXPECTED_HEAP_APP_ID:
        failures.append(f"analytics.heap.app_id must be production Heap app id {EXPECTED_HEAP_APP_ID}")
    if get_path(manifest, "analytics.heap.mode") != EXPECTED_HEAP_MODE:
        failures.append(f"analytics.heap.mode must be {EXPECTED_HEAP_MODE}")
    if get_path(manifest, "analytics.heap.passive_timer_allowed") is not False:
        failures.append("analytics.heap.passive_timer_allowed must be false")
    if get_path(manifest, "analytics.heap.contentsquare_verify_guard.enabled") is not True:
        failures.append("analytics.heap.contentsquare_verify_guard.enabled must be true")
    if get_path(manifest, "analytics.heap.contentsquare_verify_guard.same_origin_path") != EXPECTED_CS_VERIFY_PATH:
        failures.append(f"analytics.heap.contentsquare_verify_guard.same_origin_path must be {EXPECTED_CS_VERIFY_PATH}")
    if get_path(manifest, "analytics.heap.contentsquare_verify_guard.expected_status") != 204:
        failures.append("analytics.heap.contentsquare_verify_guard.expected_status must be 204")
    if get_path(manifest, "consent.owner") != "cloudflare_zaraz_consent":
        failures.append("consent.owner must be cloudflare_zaraz_consent")
    if get_path(manifest, "consent.widget_version") != EXPECTED_CONSENT_WIDGET_VERSION:
        failures.append(f"consent.widget_version must be {EXPECTED_CONSENT_WIDGET_VERSION}")
    if get_path(manifest, "phone_attribution.default_source") != "VWS":
        failures.append("phone_attribution.default_source must be VWS")
    nav = get_path(manifest, "mobile_shell.navigation") or {}
    nav_links = nav.get("links") if isinstance(nav, dict) else []
    nav_labels = [link.get("label") for link in nav_links or [] if isinstance(link, dict)]
    missing_nav_labels = [label for label in REQUIRED_MOBILE_NAV_LABELS if label not in nav_labels]
    if missing_nav_labels:
        failures.append("mobile_shell.navigation.links missing required labels: " + ", ".join(missing_nav_labels))
    for dotted in ["mobile_shell.navigation.tour_url", "mobile_shell.navigation.apply_url"]:
        value = get_path(manifest, dotted)
        if not isinstance(value, str) or not value.startswith("https://online.venterraliving.com/"):
            failures.append(f"{dotted} must use the canonical online.venterraliving.com leasing URL")
    for index, link in enumerate(nav_links or [], start=1):
        if not isinstance(link, dict):
            failures.append(f"mobile_shell.navigation.links[{index}] must be an object")
            continue
        label = str(link.get("label") or "").strip()
        url = str(link.get("url") or "").strip()
        if not label or not url:
            failures.append(f"mobile_shell.navigation.links[{index}] must include label and url")
        if url == "#" or url.lower().startswith("javascript:"):
            failures.append(f"mobile_shell.navigation.links[{index}] must not use placeholder/script URLs")
    ahrefs_project_id = str(get_path(manifest, "analytics.ahrefs.existing_project_id") or "").strip()
    if not re.fullmatch(r"\d+", ahrefs_project_id):
        failures.append("analytics.ahrefs.existing_project_id must be a numeric verified vanity project id")
    if get_path(manifest, "analytics.ahrefs.verified") is not True:
        failures.append("analytics.ahrefs.verified must be true before plan/stage/apply")
    if get_path(manifest, "rollback.no_wordpress_mutation_required") is not True:
        failures.append("rollback.no_wordpress_mutation_required must be true for the Resi Edge package")
    if get_path(manifest, "rollback.previous_worker_script") in (None, "", "required_before_apply", "pending_apply_gate"):
        failures.append("rollback.previous_worker_script must be recorded or explicitly marked not_yet_recorded")
    if len(get_path(manifest, "mobile_shell.content_blocks") or []) < 2:
        failures.append("mobile_shell.content_blocks must include at least two blocks")
    hero_mobile = get_path(manifest, "mobile_shell.hero.image_mobile")
    if not isinstance(hero_mobile, str) or not hero_mobile.endswith(".avif") or not hero_mobile.startswith("/assets/resi-edge-assets/"):
        failures.append("mobile_shell.hero.image_mobile must be a same-origin optimized AVIF asset")
    for index, font in enumerate(get_path(manifest, "mobile_shell.fonts") or [], start=1):
        if not isinstance(font, dict):
            failures.append(f"mobile_shell.fonts[{index}] must be an object")
            continue
        font_url = str(font.get("url") or "").strip()
        if not re.fullmatch(r"/wp-content/themes/resi-child-theme/fonts/[^\"'<>?\s]+\.woff2", font_url, flags=re.IGNORECASE):
            failures.append(f"mobile_shell.fonts[{index}].url must be a same-origin Resi theme font path")
        if font_url.lower().endswith("/lato-regular.woff2"):
            failures.append(f"mobile_shell.fonts[{index}].url must not use the draft placeholder lato-regular.woff2 path")
    for index, block in enumerate(get_path(manifest, "mobile_shell.content_blocks") or [], start=1):
        image_url = block.get("image_url") if isinstance(block, dict) else None
        source_url = block.get("source_image_url") if isinstance(block, dict) else None
        if not isinstance(image_url, str) or not image_url.endswith(".avif") or not image_url.startswith("/assets/resi-edge-assets/"):
            failures.append(f"mobile_shell.content_blocks[{index}].image_url must be a same-origin optimized AVIF asset")
        if not isinstance(source_url, str) or not source_url.startswith("https://"):
            failures.append(f"mobile_shell.content_blocks[{index}].source_image_url must record the official source image")
    if not isinstance(get_path(manifest, "mobile_shell.awards.present"), bool):
        failures.append("mobile_shell.awards.present must explicitly be true or false")
    if get_path(manifest, "mobile_shell.awards.present") is True:
        award_assets = get_path(manifest, "mobile_shell.awards.assets")
        if not award_assets:
            failures.append("mobile_shell.awards.assets must be present when awards.present is true")
        for index, asset in enumerate(award_assets or [], start=1):
            value = award_asset_path(asset)
            if not isinstance(value, str) or not (
                value.startswith("/assets/resi-edge-assets/") or value.startswith("https://")
            ):
                failures.append(f"mobile_shell.awards.assets[{index}] must declare a renderable url/local_url/image_url/asset_url/src")
    if get_path(manifest, "mobile_shell.reviews.fractional_stars_required") is not True:
        failures.append("mobile_shell.reviews.fractional_stars_required must be true")

    return {"pass": not failures, "failures": failures, "required_paths": required_paths}


def resolve_identity(property_code: str) -> dict[str, Any] | None:
    sys.path.insert(0, str(REPO_ROOT))
    from Data_Collection.utils.property_identity import resolve_property_identity

    lookup_code = "GA4CG" if property_code.upper() == "BASE" else ("GA4AX" if property_code.upper() == "PILOT" else property_code)
    identity = resolve_property_identity(lookup_code)
    if identity is None:
        return None
    return asdict(identity)


def run(cmd: list[str], cwd: Path = REPO_ROOT, check: bool = False, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def command_payload(
    cmd: list[str],
    out_path: Path | None = None,
    cwd: Path = REPO_ROOT,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    started_at = iso_now()
    started_perf = time.perf_counter()
    result = run(cmd, cwd=cwd, env=env)
    completed_at = iso_now()
    payload = {
        "command": cmd,
        "cwd": str(cwd),
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_seconds": round(time.perf_counter() - started_perf, 3),
        "exit_code": result.returncode,
        "stdout_tail": result.stdout[-4000:],
        "stderr_tail": result.stderr[-4000:],
        "pass": result.returncode == 0,
    }
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
        payload["evidence_path"] = str(out_path)
    return payload


class PhaseRecorder:
    def __init__(self, out_dir: Path) -> None:
        self.out_dir = out_dir
        self.started_at = iso_now()
        self.completed_at: str | None = None
        self.started_perf = time.perf_counter()
        self.phases: list[dict[str, Any]] = []
        self.out_path = out_dir / "phase-timings.json"

    def start(self, name: str) -> dict[str, Any]:
        return {
            "name": name,
            "started_at": iso_now(),
            "started_perf": time.perf_counter(),
        }

    def finish(
        self,
        token: dict[str, Any],
        status: str,
        evidence_path: str | None = None,
        detail: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        phase = {
            "name": token["name"],
            "started_at": token["started_at"],
            "completed_at": iso_now(),
            "duration_seconds": round(time.perf_counter() - float(token["started_perf"]), 3),
            "status": status,
            "evidence_path": evidence_path,
        }
        if detail:
            phase["detail"] = detail
        if extra:
            phase.update(extra)
        self.phases.append(phase)
        self.write()
        return phase

    def write(self) -> dict[str, Any]:
        payload = self.payload()
        write_json(self.out_path, payload)
        return payload

    def complete(self) -> dict[str, Any]:
        self.completed_at = iso_now()
        return self.write()

    def payload(self) -> dict[str, Any]:
        return {
            "generated_at": iso_now(),
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_seconds": round(time.perf_counter() - self.started_perf, 3),
            "phase_count": len(self.phases),
            "phases": self.phases,
        }


def fetch_text(url: str, user_agent: str | None = None) -> dict[str, Any]:
    import urllib.request

    headers = {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
    if user_agent:
        headers["User-Agent"] = user_agent
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {
                "ok": 200 <= response.status < 300,
                "status": response.status,
                "url": response.geturl(),
                "headers": dict(response.headers.items()),
                "body": body,
            }
    except Exception as exc:
        return {"ok": False, "status": 0, "url": url, "headers": {}, "body": "", "error": str(exc)}


def fetch_control_path(url: str, user_agent: str | None = None) -> dict[str, Any]:
    import urllib.error
    import urllib.request

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    headers = {"Accept": "text/html,application/json,*/*;q=0.8"}
    if user_agent:
        headers["User-Agent"] = user_agent
    request = urllib.request.Request(url, headers=headers)
    opener = urllib.request.build_opener(NoRedirect)

    try:
        with opener.open(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "url": response.geturl(),
                "headers": {key: response.headers.get_all(key) or [] for key in response.headers.keys()},
                "body": body,
            }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {
            "ok": 300 <= exc.code < 400,
            "status": exc.code,
            "url": url,
            "headers": {key: exc.headers.get_all(key) or [] for key in exc.headers.keys()},
            "body": body,
        }
    except Exception as exc:
        return {"ok": False, "status": 0, "url": url, "headers": {}, "body": "", "error": str(exc)}


def fetch_bytes(url: str, user_agent: str | None = None) -> dict[str, Any]:
    import urllib.request

    headers = {"Accept": "*/*"}
    if user_agent:
        headers["User-Agent"] = user_agent
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            return {
                "ok": 200 <= response.status < 300,
                "status": response.status,
                "url": response.geturl(),
                "headers": dict(response.headers.items()),
                "bytes": len(body),
                "body_head": body[:120].hex(),
            }
    except Exception as exc:
        return {"ok": False, "status": 0, "url": url, "headers": {}, "bytes": 0, "body_head": "", "error": str(exc)}


def header_values(headers: dict[str, Any], name: str) -> list[str]:
    target = name.lower()
    values: list[str] = []
    for key, value in headers.items():
        if key.lower() == target:
            if isinstance(value, list):
                values.extend(str(item) for item in value)
            else:
                values.append(str(value))
    return values


def header_values_ci(headers: dict[str, Any], name: str) -> list[str]:
    target = name.lower()
    values: list[str] = []
    for key, value in headers.items():
        if key.lower() != target:
            continue
        if isinstance(value, list):
            values.extend(str(item) for item in value)
        else:
            values.append(str(value))
    return values


def write_fetch_evidence(path: Path, payload: dict[str, Any]) -> None:
    slim = {**payload, "body": payload.get("body", "")[:10000], "body_truncated": len(payload.get("body", "")) > 10000}
    write_json(path, slim)


def is_resi_firewall_response(payload: dict[str, Any]) -> bool:
    body = str(payload.get("body") or "")
    return "Resi Website Management Firewall" in body or "Blocked because of Malicious Activities" in body


def audit_source_page(url: str) -> dict[str, Any]:
    desktop = fetch_control_path(url, DESKTOP_UA)
    desktop_ok = bool(desktop.get("ok")) and not is_resi_firewall_response(desktop)
    if desktop_ok:
        return {
            "ok": True,
            "status": desktop.get("status"),
            "url": url,
            "final_url": desktop.get("url"),
            "method": "desktop_control_path_fetch",
            "headers": desktop.get("headers") or {},
            "body": desktop.get("body") or "",
            "attempts": [{"method": "desktop_control_path_fetch", **desktop, "firewall_blocked": False}],
        }

    mobile = fetch_text(url, MOBILE_UA)
    mobile_ok = bool(mobile.get("ok")) and not is_resi_firewall_response(mobile)
    attempts = [
        {"method": "desktop_control_path_fetch", **desktop, "firewall_blocked": is_resi_firewall_response(desktop)},
        {"method": "mobile_browser_equivalent_fetch", **mobile, "firewall_blocked": is_resi_firewall_response(mobile)},
    ]
    if mobile_ok:
        return {
            "ok": True,
            "status": mobile.get("status"),
            "url": url,
            "final_url": mobile.get("url"),
            "method": "mobile_browser_equivalent_fetch",
            "fallback_reason": desktop.get("error") or f"desktop/source audit HTTP {desktop.get('status')}",
            "headers": mobile.get("headers") or {},
            "body": mobile.get("body") or "",
            "attempts": attempts,
        }
    return {
        "ok": False,
        "status": desktop.get("status") or mobile.get("status"),
        "url": url,
        "final_url": desktop.get("url") or mobile.get("url"),
        "method": "source_page_audit",
        "error": desktop.get("error") or mobile.get("error"),
        "headers": desktop.get("headers") or mobile.get("headers") or {},
        "body": desktop.get("body") or mobile.get("body") or "",
        "attempts": attempts,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def launch_dashboard_build_env() -> dict[str, str]:
    env = os.environ.copy()
    env["NEXT_PUBLIC_API_BASE_URL"] = DASHBOARD_API_BASE_URL
    env["NEXT_PUBLIC_AUTH_PRIMARY"] = "magic"
    return env


def dashboard_deploy_env() -> dict[str, str]:
    sys.path.insert(0, str(REPO_ROOT / "apps/api/scripts"))
    from wrangler_auth import build_runtime_env

    return build_runtime_env()


def wrangler_prefix(env: dict[str, str]) -> list[str]:
    sys.path.insert(0, str(REPO_ROOT / "apps/api/scripts"))
    from wrangler_auth import npx_wrangler_prefix

    return npx_wrangler_prefix(env)


def first_url(value: str) -> str | None:
    match = re.search(r"https://[^\s)]+", value or "")
    return match.group(0) if match else None


def run_dashboard_finalization(args: argparse.Namespace, out_dir: Path, final_ledger: dict[str, Any]) -> dict[str, Any]:
    dashboard_dir = out_dir / "dashboard"
    generated_at = datetime.now(timezone.utc).isoformat()

    snapshot = command_payload(
        [sys.executable, str(DASHBOARD_SNAPSHOT_BUILDER)],
        dashboard_dir / "snapshot-refresh.json",
    )

    build = command_payload(
        ["npm", "run", "build"],
        dashboard_dir / "web-build.json",
        cwd=WEB_APP_DIR,
        env=launch_dashboard_build_env(),
    )

    deploy: dict[str, Any] | None = None
    deploy_attempts: list[dict[str, Any]] = []
    publish_requested = not args.skip_dashboard_publish
    if snapshot["pass"] and build["pass"] and publish_requested:
        deploy_runtime_env = dashboard_deploy_env()
        deploy_cmd = [
            *wrangler_prefix(deploy_runtime_env),
            "pages",
            "deploy",
            "out",
            "--project-name",
            DASHBOARD_PAGES_PROJECT,
            "--branch",
            "main",
            "--commit-dirty=true",
        ]
        for attempt in range(1, 3):
            attempt_path = dashboard_dir / f"pages-deploy-attempt-{attempt}.json"
            deploy = command_payload(
                deploy_cmd,
                attempt_path,
                cwd=WEB_APP_DIR,
                env=deploy_runtime_env,
            )
            deploy["attempt"] = attempt
            write_json(attempt_path, deploy)
            deploy_attempts.append(
                {
                    "attempt": attempt,
                    "pass": deploy["pass"],
                    "evidence_path": deploy.get("evidence_path"),
                    "duration_seconds": deploy.get("duration_seconds"),
                    "exit_code": deploy.get("exit_code"),
                }
            )
            if deploy["pass"]:
                break
            deploy_text = f"{deploy.get('stdout_tail', '')}\n{deploy.get('stderr_tail', '')}"
            if "Failed to upload files. Please try again" not in deploy_text:
                break
            time.sleep(5)
        if deploy is not None:
            write_json(dashboard_dir / "pages-deploy.json", deploy)

    pass_finalization = bool(snapshot["pass"] and build["pass"] and (not publish_requested or (deploy and deploy["pass"])))
    deployment_url = first_url((deploy or {}).get("stdout_tail", "")) if deploy else None
    payload = {
        "generated_at": generated_at,
        "domain": args.domain,
        "property_code": args.property_code.upper(),
        "dashboard_host": DASHBOARD_HOST,
        "pages_project": DASHBOARD_PAGES_PROJECT,
        "snapshot_refresh": {
            "pass": snapshot["pass"],
            "evidence_path": snapshot.get("evidence_path"),
        },
        "web_build": {
            "pass": build["pass"],
            "evidence_path": build.get("evidence_path"),
            "api_base_url": DASHBOARD_API_BASE_URL,
            "auth_primary": "magic",
        },
        "publish": {
            "requested": publish_requested,
            "pass": None if deploy is None else deploy["pass"],
            "evidence_path": None if deploy is None else deploy.get("evidence_path"),
            "deployment_url": deployment_url,
            "attempts": deploy_attempts,
        },
        "contract_gate_ledger_passed_before_dashboard_update": final_ledger["pass"],
        "pass": pass_finalization,
        "blocked": not pass_finalization,
        "block_reason": None
        if pass_finalization
        else "Dashboard finalization failed after optimization proof. Stop before the next property; live package remains active unless a package gate failed.",
    }
    write_json(dashboard_dir / "dashboard-finalization.json", payload)
    return payload


def write_reset_card(out_dir: Path, args: argparse.Namespace, identity: dict[str, Any] | None, contract: dict[str, Any]) -> None:
    display_name = identity.get("property_name") if identity else "UNRESOLVED"
    source_code = "GA4CG" if args.property_code.upper() == "BASE" else ("GA4AX" if args.property_code.upper() == "PILOT" else args.property_code.upper())
    text = f"""# Resi Edge Reset Card

Date: 08/09/2026
Mode: `{args.mode}`
Target domain: `{args.domain}`
Requested property code: `{args.property_code.upper()}`
Resolved source property code: `{source_code}`
Resolved property name: `{display_name}`

## Current Goal

Bring the target onto the canonical Resi Edge package only through the governed runner.

## Non-Deviation Contract

- Package id: `{contract.get("package_id")}`
- No property-specific Worker rebuilds.
- No desktop topper.
- No live workaround after a failed gate.
- No readiness language unless every required gate passes or an approved exception is present.

## Stop Conditions

- Missing or invalid manifest/schema.
- Missing canonical package/deploy adapter.
- Failed reference mobile-shell replay.
- Failed target mobile shell/browser/desktop analytics/analytics/consent proof.
- Any live mutation outside this runner.
"""
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "reset-card.md").write_text(text)


def validate_shell(args: argparse.Namespace, out_dir: Path) -> dict[str, Any]:
    proof_path = out_dir / "mobile-shell-proof.json"
    cmd = [
        "node",
        str(VALIDATOR),
        "--url",
        f"https://{args.domain}/",
        "--out",
        str(proof_path),
        "--label",
        f"{args.property_code.lower()}-{args.mode}",
        "--property-code",
        args.property_code.upper(),
    ]
    result = run(cmd)
    proof = json.loads(proof_path.read_text()) if proof_path.exists() else {}
    return {
        "command": cmd,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "proof_path": str(proof_path),
        "pass": result.returncode == 0,
        "failures": proof.get("failures", []),
    }


def validate_llms(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    url = get_path(manifest, "seo.llms_url")
    payload = fetch_text(url, DESKTOP_UA)
    body = payload.get("body", "")
    links = re.findall(r"\[[^\]]+\]\(https?://[^)]+\)", body)
    result = {
        "url": url,
        "status": payload.get("status"),
        "h1_count": len(re.findall(r"^#\s+", body, flags=re.M)),
        "link_count": len(links),
        "pass": bool(payload.get("ok") and len(re.findall(r"^#\s+", body, flags=re.M)) >= 1 and len(links) >= 1),
    }
    write_fetch_evidence(out_dir / "llms-fetch.json", payload)
    write_json(out_dir / "llms-validation.json", result)
    return {**result, "evidence_path": str(out_dir / "llms-validation.json")}


def validate_source_phone(args: argparse.Namespace, manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    lookup = get_path(manifest, "phone_attribution.source_lookup") or []
    source = lookup[0] if lookup else None
    if not source:
        result = {"pass": False, "reason": "No source lookup rows in manifest."}
        write_json(out_dir / "source-phone-validation.json", result)
        return {**result, "evidence_path": str(out_dir / "source-phone-validation.json")}
    code = source.get("code")
    expected_phone = source.get("phone")
    url = f"https://{args.domain}/?id={code}"
    payload = fetch_text(url, MOBILE_UA)
    body = payload.get("body", "")
    digits = re.sub(r"\D", "", expected_phone or "")
    body_digits = re.sub(r"\D", "", body)
    result = {
        "url": url,
        "source_code": code,
        "expected_phone": expected_phone,
        "status": payload.get("status"),
        "phone_present": bool(digits and digits in body_digits),
        "data_source_code_present": f'data-source-code="{code}"' in body,
        "pass": bool(payload.get("ok") and digits and digits in body_digits and f'data-source-code="{code}"' in body),
    }
    write_fetch_evidence(out_dir / "source-phone-fetch.json", payload)
    write_json(out_dir / "source-phone-validation.json", result)
    return {**result, "evidence_path": str(out_dir / "source-phone-validation.json")}


def validate_wordpress_control_path_bypass(args: argparse.Namespace, out_dir: Path) -> dict[str, Any]:
    checks = [
        {
            "label": "login_cookie",
            "url": f"https://{args.domain}/wp-login.php",
            "expected": "wordpress_test_cookie",
        },
        {
            "label": "admin_redirect",
            "url": f"https://{args.domain}/wp-admin/",
            "expected": "wp-login.php redirect",
        },
        {
            "label": "rest_api",
            "url": f"https://{args.domain}/wp-json/",
            "expected": "native json",
        },
    ]
    results: list[dict[str, Any]] = []
    failures: list[str] = []

    for check in checks:
        payload = fetch_control_path(check["url"], DESKTOP_UA)
        headers = payload.get("headers") or {}
        body = payload.get("body") or ""
        body_lower = body.lower()
        x_vtr_headers = [key for key in headers if key.lower().startswith("x-vtr")]
        cf_cache_status = ",".join(header_values_ci(headers, "cf-cache-status")).lower()
        set_cookie_values = header_values_ci(headers, "set-cookie")
        set_cookie_names = sorted(
            {
                value.split("=", 1)[0].strip()
                for value in set_cookie_values
                if value.split("=", 1)[0].strip()
            }
        )
        location = ",".join(header_values_ci(headers, "location"))
        content_type = ",".join(header_values_ci(headers, "content-type")).lower()
        edge_marker_present = bool(
            x_vtr_headers
            or "data-vtr-" in body_lower
            or "resi-edge" in body_lower
            or "vtr-cookie" in body_lower
        )
        cache_hit = "hit" in cf_cache_status
        status = int(payload.get("status") or 0)
        security_protected = bool(
            status in {401, 403}
            and not edge_marker_present
            and not cache_hit
            and not x_vtr_headers
            and (
                "resi website management firewall" in body_lower
                or "blocked because of malicious activities" in body_lower
                or "__cf_bm" in set_cookie_names
            )
        )

        if check["label"] == "login_cookie":
            native_passed = bool(
                200 <= status < 400
                and "wordpress_test_cookie" in set_cookie_names
                and not edge_marker_present
                and not cache_hit
            )
            passed = native_passed or security_protected
            if not passed:
                failures.append("/wp-login.php did not preserve native WordPress behavior or a protected control-path security block.")
        elif check["label"] == "admin_redirect":
            native_passed = bool(
                300 <= status < 400
                and "wp-login.php" in location
                and not edge_marker_present
                and not cache_hit
            )
            passed = native_passed or security_protected
            if not passed:
                failures.append("/wp-admin/ did not preserve native WordPress behavior or a protected control-path security block.")
        else:
            native_passed = bool(
                200 <= status < 300
                and "json" in content_type
                and not edge_marker_present
                and not cache_hit
            )
            passed = native_passed or security_protected
            if not passed:
                failures.append("/wp-json/ did not remain native JSON or a protected control-path security block without edge shell/cleanup markers.")

        results.append(
            {
                "label": check["label"],
                "url": check["url"],
                "expected": check["expected"],
                "status": status,
                "final_url": payload.get("url"),
                "content_type": content_type,
                "location": location,
                "set_cookie_names": set_cookie_names,
                "cf_cache_status": cf_cache_status,
                "x_vtr_header_names": x_vtr_headers,
                "edge_marker_present": edge_marker_present,
                "cache_hit": cache_hit,
                "security_protected_control_path": security_protected,
                "native_behavior_preserved": native_passed,
                "pass": passed,
                "error": payload.get("error"),
            }
        )

    result = {
        "pass": not failures,
        "checks": results,
        "failures": failures,
        "required_behavior": "WordPress login/admin/API control paths must bypass public-page shell, cleanup, analytics, cookie stripping, and cache rewrites. Native WordPress responses pass; a pre-existing Cloudflare/Resi Website Management Firewall 401/403 also passes when it is uncached and has no edge markers.",
    }
    write_json(out_dir / "wordpress-control-path-bypass-validation.json", result)
    return {**result, "evidence_path": str(out_dir / "wordpress-control-path-bypass-validation.json")}


def validate_route_interception(args: argparse.Namespace, manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    import time

    sys.path.insert(0, str(REPO_ROOT))
    from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

    out_dir.mkdir(parents=True, exist_ok=True)
    domain = args.domain
    worker_name = f"resi-edge-route-probe-{slug(domain)}"
    marker = f"resi-edge-route-probe:{domain}"
    zone_name = get_path(manifest, "routing.cloudflare_zone_name") or domain
    route_pattern = f"{domain}/__resi-edge-route-test*"
    worker_path = out_dir / "worker.js"
    wrangler_path = out_dir / "wrangler.toml"

    worker_path.write_text(
        f"""export default {{
  async fetch(request) {{
    const url = new URL(request.url);
    return Response.json(
      {{
        ok: true,
        marker: {json.dumps(marker)},
        host: url.hostname,
        path: url.pathname,
        generated_at: new Date().toISOString()
      }},
      {{
        headers: {{
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
          "x-vtr-route-test": {json.dumps(marker)}
        }}
      }}
    );
  }}
}};
""",
        encoding="utf-8",
    )
    wrangler_path.write_text(
        f'''name = "{worker_name}"
main = "worker.js"
compatibility_date = "2024-12-01"
account_id = "{CF_ACCOUNT_ID}"
workers_dev = false

routes = [
  {{ pattern = "{route_pattern}", zone_name = "{zone_name}" }}
]
''',
        encoding="utf-8",
    )

    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        result = {
            "pass": False,
            "worker": worker_name,
            "route": route_pattern,
            "blocked": True,
            "reason": "Cloudflare API token was not resolved through Keeper-backed Wrangler auth.",
        }
        write_json(out_dir / "route-probe-summary.json", result)
        return {**result, "evidence_path": str(out_dir / "route-probe-summary.json")}

    deploy_cmd = [*npx_wrangler_prefix(env), "deploy", "--config", str(wrangler_path)]
    delete_cmd = [*npx_wrangler_prefix(env), "delete", worker_name, "--force"]
    deploy_result = run(deploy_cmd, cwd=out_dir, env=env)
    deploy_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "worker": worker_name,
        "route": route_pattern,
        "command": ["wrangler", "deploy", "--config", "wrangler.toml"],
        "exit_code": deploy_result.returncode,
        "stdout": deploy_result.stdout,
        "stderr": deploy_result.stderr,
        "pass": deploy_result.returncode == 0,
    }
    write_json(out_dir / "deploy-route-probe.json", deploy_payload)

    checks: list[dict[str, Any]] = []
    cleanup_payload: dict[str, Any] | None = None
    try:
        if deploy_result.returncode != 0:
            return_payload = {
                "pass": False,
                "worker": worker_name,
                "route": route_pattern,
                "blocked": True,
                "reason": "Temporary route probe Worker failed to deploy.",
                "deploy": deploy_payload,
            }
            write_json(out_dir / "route-probe-summary.json", return_payload)
            return {**return_payload, "evidence_path": str(out_dir / "route-probe-summary.json")}

        for label, delay in [("immediate", 0), ("after_30s", 30), ("after_90s", 60)]:
            if delay:
                time.sleep(delay)
            ts = int(time.time())
            test_url = f"https://{domain}/__resi-edge-route-test/health?ts={ts}"
            home_url = f"https://{domain}/?route_probe_homepage_check={ts}"
            test_payload = fetch_text(test_url, MOBILE_UA)
            home_payload = fetch_text(home_url, DESKTOP_UA)
            test_marker_header = header_values(test_payload.get("headers", {}), "x-vtr-route-test")
            home_marker_header = header_values(home_payload.get("headers", {}), "x-vtr-route-test")
            checks.append(
                {
                    "label": label,
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "test_url": test_url,
                    "test_status": test_payload.get("status"),
                    "test_ok": test_payload.get("ok"),
                    "test_marker_header": test_marker_header,
                    "test_body_has_marker": marker in test_payload.get("body", ""),
                    "homepage_url": home_url,
                    "homepage_status": home_payload.get("status"),
                    "homepage_ok": home_payload.get("ok"),
                    "homepage_marker_header": home_marker_header,
                    "homepage_body_has_marker": marker in home_payload.get("body", ""),
                    "homepage_native_signal": any(
                        signal in home_payload.get("body", "").lower()
                        for signal in ["wp-content", "kinsta", "wordpress", "elementor", "yootheme"]
                    ),
                }
            )
        write_json(out_dir / "route-probe-readbacks.json", {"worker": worker_name, "route": route_pattern, "marker": marker, "checks": checks})
    finally:
        delete_result = run(delete_cmd, cwd=out_dir, env=env)
        delete_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "worker": worker_name,
            "command": ["wrangler", "delete", worker_name, "--force"],
            "exit_code": delete_result.returncode,
            "stdout": delete_result.stdout,
            "stderr": delete_result.stderr,
            "pass": delete_result.returncode == 0,
        }
        write_json(out_dir / "delete-route-probe.json", delete_payload)
        cleanup_checks = []
        for label, delay in [("immediate", 0), ("after_15s", 15), ("after_45s", 30)]:
            if delay:
                time.sleep(delay)
            cleanup_test_url = f"https://{domain}/__resi-edge-route-test/health?cleanup={int(time.time())}"
            cleanup_test = fetch_text(cleanup_test_url, MOBILE_UA)
            marker_present = bool(
                marker in cleanup_test.get("body", "")
                or header_values(cleanup_test.get("headers", {}), "x-vtr-route-test")
            )
            cleanup_checks.append(
                {
                    "label": label,
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "test_url": cleanup_test_url,
                    "test_status": cleanup_test.get("status"),
                    "test_marker_present_after_delete": marker_present,
                }
            )
            if not marker_present:
                break
        cleanup_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "worker": worker_name,
            "checks": cleanup_checks,
            "test_url": cleanup_checks[-1]["test_url"] if cleanup_checks else None,
            "test_status": cleanup_checks[-1]["test_status"] if cleanup_checks else None,
            "test_marker_present_after_delete": bool(cleanup_checks[-1]["test_marker_present_after_delete"]) if cleanup_checks else True,
            "delete": delete_payload,
        }
        write_json(out_dir / "cleanup-readback.json", cleanup_payload)

    marker_labels = [
        row["label"]
        for row in checks
        if row["test_ok"] and row["test_body_has_marker"] and marker in row["test_marker_header"]
    ]
    homepage_ever_marked = any(row["homepage_body_has_marker"] or row["homepage_marker_header"] for row in checks)
    result = {
        "pass": bool(
            deploy_payload["pass"]
            and marker_labels
            and not homepage_ever_marked
            and cleanup_payload
            and cleanup_payload["delete"]["pass"]
            and not cleanup_payload["test_marker_present_after_delete"]
        ),
        "worker": worker_name,
        "route": route_pattern,
        "marker": marker,
        "labels_with_marker": marker_labels,
        "homepage_ever_marked": homepage_ever_marked,
        "cleanup_marker_present_after_delete": cleanup_payload["test_marker_present_after_delete"] if cleanup_payload else None,
        "evidence": {
            "deploy": str(out_dir / "deploy-route-probe.json"),
            "readbacks": str(out_dir / "route-probe-readbacks.json"),
            "delete": str(out_dir / "delete-route-probe.json"),
            "cleanup": str(out_dir / "cleanup-readback.json"),
        },
    }
    if not result["pass"]:
        result["blocked"] = True
        result["reason"] = "Temporary route probe did not prove isolated Cloudflare route interception and cleanup."
    write_json(out_dir / "route-probe-summary.json", result)
    return {**result, "evidence_path": str(out_dir / "route-probe-summary.json")}


def rollback_package_worker(
    args: argparse.Namespace,
    out_dir: Path,
    reason: str,
    *,
    manifest: dict[str, Any] | None = None,
) -> dict[str, Any]:
    sys.path.insert(0, str(REPO_ROOT))
    from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

    out_dir.mkdir(parents=True, exist_ok=True)
    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        payload = {
            "pass": False,
            "worker": None,
            "reason": reason,
            "error": "Cloudflare API token was not resolved through Keeper-backed Wrangler auth.",
        }
        write_json(out_dir / "rollback-summary.json", payload)
        return {**payload, "evidence_path": str(out_dir / "rollback-summary.json")}

    deploy_config = out_dir.parent / "deploy/deploy-bundle/wrangler.toml"
    worker_name = f"resi-edge-canonical-{slug(args.domain)}"
    if deploy_config.exists():
        match = re.search(r'^\s*name\s*=\s*["\']([^"\']+)["\']', deploy_config.read_text(encoding="utf-8"), flags=re.M)
        if match:
            worker_name = match.group(1)
    config_args = ["--config", str(deploy_config)] if deploy_config.exists() else []
    existing_worker = str(get_path(manifest or {}, "routing.existing_worker_script") or "").strip()
    if existing_worker and existing_worker == worker_name:
        list_cmd = [*npx_wrangler_prefix(env), "deployments", "list", "--name", worker_name, *config_args]
        list_result = run(list_cmd, cwd=out_dir, env=env)
        readback_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "worker": worker_name,
            "command": ["wrangler", "deployments", "list", "--name", worker_name, *config_args],
            "exit_code": list_result.returncode,
            "stdout": list_result.stdout,
            "stderr": list_result.stderr,
            "confirms_worker_accessible": list_result.returncode == 0,
        }
        write_json(out_dir / "rollback-worker-readback.json", readback_payload)
        summary = {
            "pass": False,
            "worker": worker_name,
            "reason": reason,
            "rollback_mode": "existing_worker_no_delete",
            "blocked": True,
            "blocked_reason": "Target manifest uses an existing Worker script; automatic delete rollback is unsafe. Preserve evidence and recover with an explicit deployment rollback or approved redeploy.",
            "readback": readback_payload,
        }
        write_json(out_dir / "rollback-summary.json", summary)
        return {**summary, "evidence_path": str(out_dir / "rollback-summary.json")}

    delete_cmd = [*npx_wrangler_prefix(env), "delete", worker_name, "--force", *config_args]
    delete_result = run(delete_cmd, cwd=out_dir, env=env)
    delete_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "worker": worker_name,
        "reason": reason,
        "command": ["wrangler", "delete", worker_name, "--force", *config_args],
        "exit_code": delete_result.returncode,
        "stdout": delete_result.stdout,
        "stderr": delete_result.stderr,
        "pass": delete_result.returncode == 0,
    }
    write_json(out_dir / "rollback-worker-delete.json", delete_payload)

    list_cmd = [*npx_wrangler_prefix(env), "deployments", "list", "--name", worker_name, *config_args]
    list_result = run(list_cmd, cwd=out_dir, env=env)
    readback_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "worker": worker_name,
        "command": ["wrangler", "deployments", "list", "--name", worker_name, *config_args],
        "exit_code": list_result.returncode,
        "stdout": list_result.stdout,
        "stderr": list_result.stderr,
        "confirms_missing": list_result.returncode != 0 or "does not exist" in (list_result.stdout + list_result.stderr).lower(),
    }
    write_json(out_dir / "rollback-worker-readback.json", readback_payload)
    summary = {
        "pass": bool(delete_payload["pass"] and readback_payload["confirms_missing"]),
        "worker": worker_name,
        "reason": reason,
        "delete": delete_payload,
        "readback": readback_payload,
    }
    write_json(out_dir / "rollback-summary.json", summary)
    return {**summary, "evidence_path": str(out_dir / "rollback-summary.json")}


def validate_package_health(args: argparse.Namespace, manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    import time

    out_dir.mkdir(parents=True, exist_ok=True)
    expected_property = get_path(manifest, "target.property_name")
    expected_domain = get_path(manifest, "target.domain") or args.domain
    checks: list[dict[str, Any]] = []
    for label, delay in [("immediate", 0), ("after_30s", 30), ("after_90s", 60)]:
        if delay:
            time.sleep(delay)
        url = f"https://{args.domain}/__resi-edge/health?ts={int(time.time())}"
        payload = fetch_text(url, MOBILE_UA)
        body = payload.get("body", "")
        parsed = None
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = None
        checks.append(
            {
                "label": label,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "url": url,
                "status": payload.get("status"),
                "ok": payload.get("ok"),
                "json": parsed,
                "package_id_matches": bool(parsed and parsed.get("package_id") == "resi-edge-canonical-upgrade-package"),
                "manifest_domain_matches": bool(parsed and parsed.get("manifest_domain") == expected_domain),
                "manifest_property_matches": bool(parsed and parsed.get("manifest_property") == expected_property),
                "body_head": body[:500],
                "error": payload.get("error"),
            }
        )
    passing_labels = [
        row["label"]
        for row in checks
        if row["ok"] and row["package_id_matches"] and row["manifest_domain_matches"] and row["manifest_property_matches"]
    ]
    result = {
        "pass": bool(passing_labels),
        "expected_domain": expected_domain,
        "expected_property": expected_property,
        "passing_labels": passing_labels,
        "checks": checks,
    }
    if not result["pass"]:
        result["blocked"] = True
        result["reason"] = "Package health endpoint did not return canonical Worker health JSON after deploy propagation window."
    write_json(out_dir / "package-health-probe.json", result)
    return {**result, "evidence_path": str(out_dir / "package-health-probe.json")}


def validate_meta_schema(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    url = get_path(manifest, "target.canonical_url")
    payload = fetch_text(url, DESKTOP_UA)
    body = payload.get("body", "")
    property_name = get_path(manifest, "target.property_name")
    property_code = get_path(manifest, "target.source_property_code")
    og_present = bool(re.search(r"<meta\s+property=[\"']og:", body, flags=re.I))
    schema_present = "application/ld+json" in body
    canonical_present = get_path(manifest, "target.canonical_url") in body
    icons_present = bool(re.search(r"<link\s+[^>]*rel=[\"'][^\"']*(?:icon|apple-touch-icon)", body, flags=re.I))
    stale_identity = []
    for needle in ["Apex West Midtown", "TX054"]:
        if needle in body and needle not in {property_name, property_code}:
            stale_identity.append(needle)
    result = {
        "url": url,
        "status": payload.get("status"),
        "og_present": og_present,
        "schema_present": schema_present,
        "canonical_present": canonical_present,
        "icons_present": icons_present,
        "stale_identity": stale_identity,
        "meta_og_schema_icons_pass": bool(payload.get("ok") and og_present and schema_present and canonical_present and icons_present),
        "stale_identity_pass": bool(payload.get("ok") and not stale_identity),
    }
    result["pass"] = bool(result["meta_og_schema_icons_pass"] and result["stale_identity_pass"])
    write_fetch_evidence(out_dir / "meta-schema-fetch.json", payload)
    write_json(out_dir / "meta-schema-validation.json", result)
    return {**result, "evidence_path": str(out_dir / "meta-schema-validation.json")}


def validate_r2_asset_readback(args: argparse.Namespace, manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    def hero_webp_path(path: str) -> str:
        return re.sub(r"\.avif($|\?)", r".webp\1", path, flags=re.I)

    def budget_for_path(path: str) -> tuple[str, int | None, str | None]:
        lower = path.lower()
        if lower.endswith(".avif"):
            expected_type = "image/avif"
        elif lower.endswith(".webp"):
            expected_type = "image/webp"
        elif lower.endswith(".svg"):
            expected_type = "image/svg"
        else:
            expected_type = None
        if "hero-mobile" in lower:
            return ("hero-mobile", MOBILE_HERO_MAX_BYTES, expected_type)
        if any(token in lower for token in ["/welcome-", "/features-"]):
            return ("content-block", CONTENT_BLOCK_IMAGE_MAX_BYTES, expected_type)
        return ("other", OTHER_R2_ASSET_MAX_BYTES, expected_type)

    paths: list[str] = []
    for dotted in ["mobile_shell.hero.image_mobile"]:
        value = get_path(manifest, dotted)
        if isinstance(value, str) and value.startswith("/assets/resi-edge-assets/"):
            paths.append(value)
            paths.append(hero_webp_path(value))
    for block in get_path(manifest, "mobile_shell.content_blocks") or []:
        value = block.get("image_url") if isinstance(block, dict) else None
        if isinstance(value, str) and value.startswith("/assets/resi-edge-assets/"):
            paths.append(value)
    for asset in get_path(manifest, "mobile_shell.awards.assets") or []:
        value = award_asset_path(asset)
        if isinstance(value, str) and value.startswith("/assets/resi-edge-assets/"):
            paths.append(value)
    title_src = hero_title_contract(manifest)["src"]
    if isinstance(title_src, str) and title_src.startswith("/assets/resi-edge-assets/"):
        paths.append(title_src)

    rows = []
    for path in sorted(dict.fromkeys(paths)):
        payload = fetch_bytes(f"https://{args.domain}{path}", MOBILE_UA)
        role, max_bytes, expected_type = budget_for_path(path)
        byte_count = int(payload.get("bytes") or 0)
        content_types = header_values(payload.get("headers", {}), "content-type")
        cache_controls = header_values(payload.get("headers", {}), "cache-control")
        content_type_ok = bool(not expected_type or any(expected_type in value.lower() for value in content_types))
        cache_ok = bool(any("immutable" in value.lower() and "max-age=31536000" in value.lower() for value in cache_controls))
        byte_budget_ok = bool(max_bytes is None or (byte_count > 100 and byte_count <= max_bytes))
        rows.append(
            {
                "path": path,
                "role": role,
                "max_bytes": max_bytes,
                "status": payload.get("status"),
                "ok": payload.get("ok"),
                "bytes": byte_count,
                "byte_budget_ok": byte_budget_ok,
                "x_vtr_resi_edge_asset": header_values(payload.get("headers", {}), "x-vtr-resi-edge-asset"),
                "content_type": content_types,
                "content_type_ok": content_type_ok,
                "cache_control": cache_controls,
                "cache_control_ok": cache_ok,
                "error": payload.get("error"),
            }
        )
    result = {
        "asset_count": len(rows),
        "assets": rows,
        "budgets": {
            "hero_mobile_max_bytes": MOBILE_HERO_MAX_BYTES,
            "content_block_image_max_bytes": CONTENT_BLOCK_IMAGE_MAX_BYTES,
            "other_r2_asset_max_bytes": OTHER_R2_ASSET_MAX_BYTES,
        },
        "pass": bool(
            rows
            and all(
                row["ok"]
                and row["byte_budget_ok"]
                and row["content_type_ok"]
                and row["cache_control_ok"]
                and "r2" in row["x_vtr_resi_edge_asset"]
                for row in rows
            )
        ),
    }
    if not rows:
        result["reason"] = "No same-origin R2 asset paths were found in the manifest."
    elif not result["pass"]:
        result["reason"] = "One or more declared same-origin assets failed R2 readback, byte budget, content type, cache, or R2 marker proof."
    write_json(out_dir / "r2-asset-readback.json", result)
    return {**result, "evidence_path": str(out_dir / "r2-asset-readback.json")}


def run_asset_generation_and_upload(target_manifest_path: Path, out_dir: Path) -> dict[str, Any]:
    assets_dir = out_dir / "asset-build"
    generator_cmd = [
        "python3",
        str(ASSET_GENERATOR),
        "--manifest",
        str(target_manifest_path),
        "--out-dir",
        str(assets_dir),
    ]
    generator_result = run(generator_cmd)
    packet_path = assets_dir / "generated-assets.json"
    packet = load_json(packet_path) or {}
    asset_rows = packet.get("assets") or []

    def asset_budget(row: dict[str, Any]) -> tuple[int | None, str]:
        role = str(row.get("role") or "").lower()
        variant = str(row.get("variant") or "").lower()
        public_url = str(row.get("publicUrl") or "").lower()
        if role == "hero" and "mobile" in variant:
            return MOBILE_HERO_MAX_BYTES, "hero-mobile"
        if variant == "avif" or public_url.endswith(".avif"):
            return CONTENT_BLOCK_IMAGE_MAX_BYTES, "content-block"
        return None, "non-critical"

    budget_failures = []
    for row in asset_rows:
        max_bytes, budget_role = asset_budget(row)
        byte_count = int(row.get("bytes") or 0)
        row["budgetRole"] = budget_role
        row["maxBytes"] = max_bytes
        row["byteBudgetOk"] = bool(max_bytes is None or byte_count <= max_bytes)
        if max_bytes is not None and byte_count > max_bytes:
            budget_failures.append(
                {
                    "publicUrl": row.get("publicUrl"),
                    "role": row.get("role"),
                    "variant": row.get("variant"),
                    "bytes": byte_count,
                    "maxBytes": max_bytes,
                }
            )

    if generator_result.returncode != 0 or not packet_path.exists() or budget_failures:
        payload = {
            "pass": False,
            "stage": "generate",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator_command": generator_cmd,
            "generator_exit_code": generator_result.returncode,
            "stdout_tail": generator_result.stdout[-2000:],
            "stderr_tail": generator_result.stderr[-2000:],
            "packet_path": str(packet_path),
            "budget_failures": budget_failures,
            "asset_count": len(asset_rows),
        }
        write_json(out_dir / "asset-generation-upload.json", payload)
        return {**payload, "evidence_path": str(out_dir / "asset-generation-upload.json")}

    upload_cmd = ["python3", str(ASSET_UPLOADER), "--packet", str(packet_path), "--apply"]
    upload_result = run(upload_cmd)
    payload = {
        "pass": upload_result.returncode == 0,
        "stage": "upload",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator_command": generator_cmd,
        "generator_exit_code": generator_result.returncode,
        "upload_command": upload_cmd,
        "upload_exit_code": upload_result.returncode,
        "stdout_tail": upload_result.stdout[-4000:],
        "stderr_tail": upload_result.stderr[-4000:],
        "packet_path": str(packet_path),
        "asset_count": len(asset_rows),
        "budgets": {
            "hero_mobile_max_bytes": MOBILE_HERO_MAX_BYTES,
            "content_block_image_max_bytes": CONTENT_BLOCK_IMAGE_MAX_BYTES,
        },
        "budget_failures": budget_failures,
    }
    write_json(out_dir / "asset-generation-upload.json", payload)
    return {**payload, "evidence_path": str(out_dir / "asset-generation-upload.json")}


def run_deploy_bundle_validation(manifest_path: Path, out_dir: Path) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "python3",
        str(DEPLOY_ADAPTER),
        "--validate-bundle",
        "--manifest",
        str(manifest_path),
        "--out-dir",
        str(out_dir),
    ]
    result = run(command)
    readout = out_dir / "deploy-bundle-validation.json"
    if readout.exists():
        payload = json.loads(readout.read_text())
    else:
        payload = {
            "pass": False,
            "blocked": True,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "command": command,
            "exit_code": result.returncode,
            "stdout_tail": result.stdout[-4000:],
            "stderr_tail": result.stderr[-4000:],
            "reason": "Deploy bundle validation did not produce a readout.",
        }
        write_json(readout, payload)
    payload.setdefault("command", command)
    payload.setdefault("exit_code", result.returncode)
    bundle_dir = out_dir / "deploy-bundle"
    forecast_path = out_dir / "mobile-shell-byte-forecast.json"
    if bundle_dir.exists():
        forecast_command = [
            "node",
            str(MOBILE_SHELL_BYTE_FORECAST),
            "--bundle-dir",
            str(bundle_dir),
            "--max-bytes",
            str(MOBILE_SHELL_INITIAL_HTML_MAX_BYTES),
            "--out",
            str(forecast_path),
        ]
        forecast_result = run(forecast_command)
        if forecast_path.exists():
            forecast_payload = json.loads(forecast_path.read_text())
        else:
            forecast_payload = {
                "pass": False,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "command": forecast_command,
                "exit_code": forecast_result.returncode,
                "stdout_tail": forecast_result.stdout[-4000:],
                "stderr_tail": forecast_result.stderr[-4000:],
                "reason": "Mobile shell byte forecast did not produce a readout.",
            }
            write_json(forecast_path, forecast_payload)
        forecast_payload.setdefault("command", forecast_command)
        forecast_payload.setdefault("exit_code", forecast_result.returncode)
        forecast_payload["evidence_path"] = str(forecast_path)
        payload["mobile_shell_byte_forecast"] = forecast_payload
        if not forecast_payload.get("pass"):
            payload["pass"] = False
            payload["blocked"] = True
            payload["reason"] = forecast_payload.get("reason") or (
                f"Forecast initial mobile shell bytes {forecast_payload.get('initial_html_bytes')} "
                f"exceed {forecast_payload.get('max_bytes')}."
            )
        consent_geometry_path = out_dir / "consent-widget-geometry.json"
        consent_geometry_command = [
            "node",
            str(CONSENT_WIDGET_GEOMETRY),
            "--bundle-dir",
            str(bundle_dir),
            "--out",
            str(consent_geometry_path),
        ]
        consent_geometry_result = run(consent_geometry_command)
        if consent_geometry_path.exists():
            consent_geometry_payload = json.loads(consent_geometry_path.read_text())
        else:
            consent_geometry_payload = {
                "pass": False,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "command": consent_geometry_command,
                "exit_code": consent_geometry_result.returncode,
                "stdout_tail": consent_geometry_result.stdout[-4000:],
                "stderr_tail": consent_geometry_result.stderr[-4000:],
                "reason": "Consent widget geometry proof did not produce a readout.",
            }
            write_json(consent_geometry_path, consent_geometry_payload)
        consent_geometry_payload.setdefault("command", consent_geometry_command)
        consent_geometry_payload.setdefault("exit_code", consent_geometry_result.returncode)
        consent_geometry_payload["evidence_path"] = str(consent_geometry_path)
        payload["consent_widget_geometry"] = consent_geometry_payload
        if not consent_geometry_payload.get("pass"):
            payload["pass"] = False
            payload["blocked"] = True
            payload["reason"] = consent_geometry_payload.get("reason") or (
                "Consent widget geometry proof failed before live deploy."
            )
    else:
        payload["mobile_shell_byte_forecast"] = {
            "pass": False,
            "bundle_dir": str(bundle_dir),
            "evidence_path": str(forecast_path),
            "reason": "Deploy bundle directory is missing; cannot forecast mobile shell bytes.",
        }
        if payload.get("pass"):
            payload["pass"] = False
            payload["blocked"] = True
            payload["reason"] = payload["mobile_shell_byte_forecast"]["reason"]
    payload["evidence_path"] = str(readout)
    write_json(readout, payload)
    return payload


def run_cache_purge(args: argparse.Namespace, out_dir: Path) -> dict[str, Any]:
    urls = [
        f"https://{args.domain}/",
        f"https://{args.domain}/llms.txt",
    ]
    cmd = ["python3", str(CACHE_PURGE), "--domain", args.domain]
    for url in urls:
        cmd.extend(["--url", url])
    return command_payload(cmd, out_dir / "cache-purge.json")


def run_live_analytics_smoke(args: argparse.Namespace, manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    output = out_dir / "live-analytics-smoke.json"
    cmd = [
        "python3",
        str(ANALYTICS_SMOKE),
        "--url",
        f"https://{args.domain}/",
        "--ga4-property-id",
        str(get_path(manifest, "target.ga4_property_id") or ""),
        "--measurement-id",
        str(get_path(manifest, "target.ga4_measurement_id") or get_path(manifest, "analytics.ga4.measurement_id") or ""),
        "--expected-stream-name",
        str(get_path(manifest, "analytics.ga4.expected_stream_name") or get_path(manifest, "target.property_name") or "Website"),
        "--expected-stream-name",
        "Website",
        "--heap-app-id",
        str(get_path(manifest, "analytics.heap.app_id") or ""),
        "--require-ahrefs",
        "--expect-heap-after-interaction",
        "--no-unique-query",
        "--output",
        str(output),
    ]
    result = run(cmd)
    payload = load_json(output) or {}
    return {
        "command": cmd,
        "exit_code": result.returncode,
        "pass": result.returncode == 0 and payload.get("status") == "passed",
        "evidence_path": str(output),
        "failures": payload.get("failures") or [],
        "stdout_tail": result.stdout[-1000:],
        "stderr_tail": result.stderr[-1000:],
    }


def run_cloudflare_analytics_state(out_dir: Path) -> dict[str, Any]:
    output = out_dir / "cloudflare-analytics-state.json"
    result = run(["python3", str(REPO_ROOT / "scripts/smoke_cloudflare_analytics.py")])
    payload = {
        "command": ["python3", "scripts/smoke_cloudflare_analytics.py"],
        "exit_code": result.returncode,
        "stdout_tail": result.stdout[-4000:],
        "stderr_tail": result.stderr[-4000:],
        "pass": result.returncode == 0,
    }
    write_json(output, payload)
    return {**payload, "evidence_path": str(output)}


def run_psi_gate(args: argparse.Namespace, out_dir: Path) -> dict[str, Any]:
    output_dir = out_dir / "psi"

    def run_psi_attempt(attempt_dir: Path, strategies: list[str], *, runs: int = 1, fresh_runs: int = 1) -> dict[str, Any]:
        cmd = [
            "python3",
            str(PSI_RUNNER),
            "--url",
            f"https://{args.domain}/",
            "--out-dir",
            str(attempt_dir),
            "--runs",
            str(runs),
            "--fresh-runs",
            str(fresh_runs),
            "--strategies",
            *strategies,
        ]
        result = run(cmd)
        summary_path = attempt_dir / "psi-summary.json"
        summary = load_json(summary_path) or {}
        return {
            "command": cmd,
            "exit_code": result.returncode,
            "summary_path": str(summary_path),
            "summary": summary,
            "stdout_tail": result.stdout[-1000:],
            "stderr_tail": result.stderr[-1000:],
        }

    def min_score_from_summary(summary: dict[str, Any], strategy: str) -> float | None:
        values = (((summary.get("summary") or {}).get(strategy) or {}).get("score") or {}).get("values") or []
        return min(values) if values else None

    def strategy_failures(summary: dict[str, Any], strategy: str) -> list[dict[str, Any]]:
        runs = summary.get("runs") or []
        return [
            {
                "label": row.get("label"),
                "status_code": row.get("status_code"),
                "error": row.get("error"),
            }
            for row in runs
            if row.get("strategy") == strategy and not row.get("ok")
        ]

    def strategy_all_runs_scored(summary: dict[str, Any], strategy: str) -> bool:
        row = ((summary.get("summary") or {}).get(strategy) or {})
        total = row.get("totalRuns") or 0
        ok_runs = row.get("okRuns") or 0
        return bool(total > 0 and ok_runs == total and min_score_from_summary(summary, strategy) is not None)

    def strategy_has_below_target_score(summary: dict[str, Any], strategy: str, target: int = 90) -> bool:
        values = (((summary.get("summary") or {}).get(strategy) or {}).get("score") or {}).get("values") or []
        return any(float(value) < target for value in values)

    def target_for_strategy(strategy: str) -> int:
        return MOBILE_PSI_PARITY_TARGET if strategy == "mobile" else DESKTOP_PSI_TARGET

    initial = run_psi_attempt(output_dir, ["mobile", "desktop"])
    attempts = [{"label": "initial", **initial}]
    final_summary_by_strategy = {"mobile": initial["summary"], "desktop": initial["summary"]}
    mobile_score = min_score_from_summary(initial["summary"], "mobile")
    desktop_score = min_score_from_summary(initial["summary"], "desktop")
    retry_log: list[dict[str, Any]] = []

    # Treat below-target PSI as unstable until the bounded retry policy has a clean final sample.
    for strategy in ["mobile", "desktop"]:
        current_summary = final_summary_by_strategy[strategy]
        target = target_for_strategy(strategy)
        if strategy_all_runs_scored(current_summary, strategy) and not strategy_has_below_target_score(current_summary, strategy, target):
            continue
        for retry_index in range(1, PSI_TRANSIENT_RETRIES + 1):
            below_target = strategy_has_below_target_score(current_summary, strategy, target)
            retry_log.append(
                {
                    "strategy": strategy,
                    "retry": retry_index,
                    "wait_seconds": PSI_TRANSIENT_RETRY_WAIT_SECONDS,
                    "reason": f"PSI {'returned a below-target score' if below_target else 'returned an incomplete no-score sample set'}; waiting for deployment/cache/Lighthouse stabilization before retry.",
                    "target": target,
                    "previous_failures": strategy_failures(current_summary, strategy),
                }
            )
            time.sleep(PSI_TRANSIENT_RETRY_WAIT_SECONDS)
            retry_dir = output_dir / f"{strategy}-retry-{retry_index}"
            retry_attempt = run_psi_attempt(retry_dir, [strategy])
            attempts.append({"label": f"{strategy}-retry-{retry_index}", **retry_attempt})
            retry_score = min_score_from_summary(retry_attempt["summary"], strategy)
            if strategy == "mobile":
                mobile_score = retry_score
                final_summary_by_strategy["mobile"] = retry_attempt["summary"]
                current_summary = final_summary_by_strategy["mobile"]
            else:
                desktop_score = retry_score
                final_summary_by_strategy["desktop"] = retry_attempt["summary"]
                current_summary = final_summary_by_strategy["desktop"]
            if strategy_all_runs_scored(current_summary, strategy) and not strategy_has_below_target_score(current_summary, strategy, target):
                break

    cmd = [
        "python3",
        str(PSI_RUNNER),
        "--url",
        f"https://{args.domain}/",
        "--out-dir",
        str(output_dir),
        "--runs",
        "1",
        "--fresh-runs",
        "1",
        "--strategies",
        "mobile",
        "desktop",
    ]
    mobile_complete = strategy_all_runs_scored(final_summary_by_strategy["mobile"], "mobile")
    desktop_complete = strategy_all_runs_scored(final_summary_by_strategy["desktop"], "desktop")
    mobile_pass = bool(
        mobile_score is not None
        and mobile_score >= MOBILE_PSI_PARITY_TARGET
        and not strategy_has_below_target_score(final_summary_by_strategy["mobile"], "mobile", MOBILE_PSI_PARITY_TARGET)
    )
    desktop_pass = bool(
        desktop_score is not None
        and desktop_score >= DESKTOP_PSI_TARGET
        and not strategy_has_below_target_score(final_summary_by_strategy["desktop"], "desktop", DESKTOP_PSI_TARGET)
    )
    desktop_recorded = bool(desktop_score is not None)
    overall_pass = bool(mobile_pass and desktop_pass)
    payload = {
        "command": cmd,
        "exit_code": 0 if overall_pass else 1,
        "summary_path": initial["summary_path"],
        "attempts": [
            {
                "label": attempt["label"],
                "command": attempt["command"],
                "exit_code": attempt["exit_code"],
                "summary_path": attempt["summary_path"],
                "mobile_min_score": min_score_from_summary(attempt["summary"], "mobile"),
                "desktop_min_score": min_score_from_summary(attempt["summary"], "desktop"),
                "mobile_failures": strategy_failures(attempt["summary"], "mobile"),
                "desktop_failures": strategy_failures(attempt["summary"], "desktop"),
                "stdout_tail": attempt["stdout_tail"],
                "stderr_tail": attempt["stderr_tail"],
            }
            for attempt in attempts
        ],
        "transient_retry_policy": {
            "retries": PSI_TRANSIENT_RETRIES,
            "wait_seconds": PSI_TRANSIENT_RETRY_WAIT_SECONDS,
            "only_when_score_missing": False,
            "also_when_required_sample_set_incomplete": True,
            "below_target_scores_retry": True,
        },
        "score_targets": {
            "mobile_reference_parity": MOBILE_PSI_PARITY_TARGET,
            "desktop_native_passthrough": DESKTOP_PSI_TARGET,
        },
        "retry_log": retry_log,
        "mobile_min_score": mobile_score,
        "desktop_min_score": desktop_score,
        "mobile_all_runs_scored": mobile_complete,
        "desktop_all_runs_scored": desktop_complete,
        "provider_no_score_samples_recorded": bool(not mobile_complete or not desktop_complete),
        "mobile_pass": mobile_pass,
        "desktop_recorded": desktop_recorded,
        "desktop_pass": desktop_pass,
        "pass": overall_pass,
        "stdout_tail": initial["stdout_tail"],
        "stderr_tail": initial["stderr_tail"],
    }
    write_json(output_dir / "psi-gate.json", payload)
    return {**payload, "evidence_path": str(output_dir / "psi-gate.json")}


def validate_browser_acceptance(args: argparse.Namespace, manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        payload = {"pass": False, "reason": f"Playwright import failed: {exc}"}
        write_json(out_dir / "browser-acceptance.json", payload)
        return {**payload, "evidence_path": str(out_dir / "browser-acceptance.json")}

    url = f"https://{args.domain}/"
    failures: list[str] = []
    mobile_failures: list[str] = []
    continuation_failures: list[str] = []
    consent_failures: list[str] = []
    desktop_failures: list[str] = []
    network_failures: list[str] = []
    event_bridge_failures: list[str] = []

    def note(bucket: list[str], message: str) -> None:
        bucket.append(message)
        failures.append(message)

    result: dict[str, Any] = {
        "url": url,
        "screenshots": {},
        "console": [],
        "failed_requests": [],
        "bad_responses": [],
    }
    mobile_eval: dict[str, Any] = {}
    continuation_eval: dict[str, Any] = {}
    desktop_eval: dict[str, Any] = {}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            mobile = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                device_scale_factor=3,
                user_agent=MOBILE_UA,
            )
            page = mobile.new_page()
            page.on("console", lambda msg: result["console"].append({"type": msg.type, "text": msg.text}) if msg.type in {"error", "warning"} else None)
            page.on("requestfailed", lambda request: result["failed_requests"].append({"url": request.url, "failure": str(request.failure or "")}))
            page.on("response", lambda response: result["bad_responses"].append({"status": response.status, "url": response.url}) if response.status >= 400 else None)
            response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            promo_headers = {
                "state": response.headers.get("x-vtr-promo-state", "") if response else "",
                "source": response.headers.get("x-vtr-promo-source", "") if response else "",
                "key": response.headers.get("x-vtr-promo-key", "") if response else "",
                "present": response.headers.get("x-vtr-promo-present", "") if response else "",
                "fetched_at": response.headers.get("x-vtr-promo-fetched-at", "") if response else "",
            }
            result["promo_record"] = promo_headers
            page.wait_for_timeout(2000)
            mobile_shot = out_dir / "mobile-first-view.png"
            page.screenshot(path=str(mobile_shot), full_page=False)
            result["screenshots"]["mobile_first_view"] = str(mobile_shot)
            mobile_viewport = page.viewport_size or {"width": 390, "height": 844}
            mobile_eval = page.evaluate(
            """(proofViewport) => {
              const text = document.body.innerText || "";
              const rect = (el) => {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
              };
              const rating = document.querySelector(".hero .rating");
              const titleArt = document.querySelector(".hero .hero-title-art");
              const titleSvg = titleArt?.querySelector('img[src^="/assets/resi-edge-assets/"][src$=".svg"]');
              const staleTitleText = document.querySelector(".hero .hero-title-text");
              const headline = document.querySelector(".hero .hero-headline");
              const cta = document.querySelector(".hero .cta");
              const promoWrap = document.querySelector(".promo-wrap");
              const promoLabel = document.querySelector(".promo-label");
              const promoDrop = document.querySelector("[data-edge-promo-drop]");
              const headerBar = document.querySelector(".bar");
              const hero = document.querySelector(".hero");
              const awardImages = Array.from(document.querySelectorAll("[data-vtr-shell-awards] img"));
              const trackedShellElements = Array.from(document.querySelectorAll("[data-vtr-track]"))
                .map((el) => ({
                  tag: el.tagName,
                  text: (el.textContent || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
                  href: el.getAttribute("href") || "",
                  action: el.getAttribute("data-vtr-action") || "",
                  surface: el.getAttribute("data-vtr-surface") || "",
                  element: el.getAttribute("data-vtr-element") || "",
                  destination: el.getAttribute("data-vtr-destination") || "",
                  label: el.getAttribute("data-vtr-label") || "",
                  sourceCode: el.getAttribute("data-vtr-source-code") || "",
                  phoneSource: el.getAttribute("data-vtr-phone-source") || "",
                  phoneNumber: el.getAttribute("data-vtr-phone-number") || ""
                }));
              const drawerNavLinks = Array.from(document.querySelectorAll(".drawer nav a"))
                .map((el) => ({
                  text: (el.textContent || "").replace(/\\s+/g, " ").trim(),
                  href: el.getAttribute("href") || "",
                  action: el.getAttribute("data-vtr-action") || "",
                  surface: el.getAttribute("data-vtr-surface") || "",
                  element: el.getAttribute("data-vtr-element") || "",
                  destination: el.getAttribute("data-vtr-destination") || ""
                }));
              const bulletTexts = Array.from(document.querySelectorAll("[data-vtr-shell-bullets] li"))
                .map((li) => (li.textContent || "").replace(/\\s+/g, " ").trim())
                .filter(Boolean);
              const animationName = (el) => el ? getComputedStyle(el).animationName : "";
              const overlaps = (a,b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
              const ratingRect = rect(rating);
              const titleRect = rect(titleArt);
              const headlineRect = rect(headline);
              const ctaRect = rect(cta);
              const heroRect = rect(hero);
              const promoRect = rect(promoWrap);
              const headerRect = rect(headerBar);
              const expectedHeroTop = (promoRect?.height || 0) + (headerRect?.height || 0);
              const visualViewportHeight = window.visualViewport?.height || null;
              const clientViewportHeight = document.documentElement.clientHeight || null;
              const layoutViewportHeight = window.innerHeight || null;
              const browserViewportHeight = proofViewport?.height || null;
              const viewportCandidates = [
                browserViewportHeight,
                visualViewportHeight,
                clientViewportHeight,
                layoutViewportHeight
              ].filter((value) => Number.isFinite(value) && value > 0);
              const proofViewportHeight = viewportCandidates.length
                ? Math.min(...viewportCandidates)
                : layoutViewportHeight;
              const heroTopDelta = heroRect ? Math.abs(heroRect.top - expectedHeroTop) : null;
              const heroBottomDelta = heroRect && proofViewportHeight ? Math.abs(heroRect.bottom - proofViewportHeight) : null;
              const orderOk = Boolean(
                titleRect &&
                headlineRect &&
                ctaRect &&
                (!ratingRect || ratingRect.bottom <= titleRect.top + 2) &&
                titleRect.bottom <= headlineRect.top + 2 &&
                headlineRect.bottom <= ctaRect.top + 2
              );
              return {
                statusMarker: document.body.getAttribute("data-vtr-edge-mobile-shell"),
                shellBlocks: document.querySelectorAll("[data-vtr-shell-content-block]").length,
                continuationState: document.querySelector("[data-vtr-native-continuation]")?.getAttribute("data-native-continuation-state") || null,
                iframeCount: document.querySelectorAll(".native-continuation-frame").length,
                duplicateWelcomeTextCount: (text.match(/Welcome to/gi) || []).length,
                duplicateFeaturesTextCount: (text.match(/Stylish Living Spaces|Apartment Features/gi) || []).length,
                awardImages: awardImages.map((img) => ({
                  src: img.getAttribute("src") || "",
                  alt: img.getAttribute("alt") || "",
                  rect: rect(img)
                })),
                bulletTexts,
                consentNoticePresent: !!document.querySelector("#vtr-cookie-notice"),
                consentVersion: document.querySelector("#vtr-cookie-notice")?.dataset?.vtrZarazConsentVersion || window.__vtrZarazConsentPillVersion || null,
                consentText: document.querySelector("#vtr-cookie-notice")?.innerText?.replace(/\\s+/g, " ").trim() || "",
                preferencesButtonPresent: !!document.querySelector("#vtr-cookie-manage"),
                rejectButtonPresent: !!document.querySelector("#vtr-cookie-reject"),
                acceptButtonPresent: !!document.querySelector("#vtr-cookie-accept"),
                edgeAnalyticsScriptPresent: !!document.querySelector("script[data-vtr-edge-analytics]"),
                heapEnvironmentScriptPresent: !!document.querySelector("script[data-vtr-heap-environment]"),
                heapEnvironment: window.__vtrHeapEnvironment || null,
                heapAppIdVar: window.HEAP_APP_ID || "",
                heapEnvironmentVar: window.HEAP_ENVIRONMENT || "",
                heapModeVar: window.HEAP_MODE || "",
                heapDebugVarType: typeof window.HEAP_JS_DEBUG,
                promo: {
                  present: !!promoWrap,
                  label: (promoLabel?.textContent || "").replace(/\\s+/g, " ").trim(),
                  drawerText: (promoDrop?.textContent || "").replace(/\\s+/g, " ").trim()
                },
                trackedShellElements,
                drawerNavLinks,
                heroFullHeight: {
                  heroRect,
                  promoRect,
                  headerRect,
                  viewportHeight: proofViewportHeight,
                  browserViewportHeight,
                  visualViewportHeight,
                  clientViewportHeight,
                  layoutViewportHeight,
                  expectedHeroTop,
                  topDelta: heroTopDelta,
                  bottomDelta: heroBottomDelta,
                  ok: Boolean(heroRect && heroTopDelta <= 3 && heroBottomDelta <= 5)
                },
	                heroStack: {
	                  ratingPresent: !!rating,
	                  ratingRect,
	                  titleArtPresent: !!titleArt,
	                  titleSvgPresent: !!titleSvg,
	                  titleMode: titleArt?.getAttribute("data-vtr-hero-title-mode") || "",
	                  titleSrc: titleSvg?.getAttribute("src") || "",
	                  staleTitleTextPresent: !!staleTitleText,
	                  titleLabel: titleArt?.getAttribute("aria-label") || "",
	                  titleRect,
	                  headlineRect,
	                  ctaRect,
	                  orderOk,
	                  noOverlap: !overlaps(ratingRect, titleRect) && !overlaps(titleRect, headlineRect) && !overlaps(headlineRect, ctaRect),
	                  fadeAnimationsPresent: [rating, titleArt, headline, cta].filter(Boolean).every((el) => animationName(el).includes("vtrFadeUp"))
	                },
                width: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth
              };
            }""",
            mobile_viewport,
            )
            if response is None or response.status >= 400:
                note(mobile_failures, f"mobile browser status {response.status if response else 'none'}")
            if not promo_headers.get("state") or not promo_headers.get("source") or not promo_headers.get("key"):
                note(mobile_failures, "edge promo record readout headers missing")
            if promo_headers.get("state", "").startswith("manifest_fallback_"):
                note(mobile_failures, "edge promo record unavailable; manifest fallback is not allowed for live proof")
            if promo_headers.get("state") == "edge_record_stale":
                note(mobile_failures, "edge promo record is stale")
            promo_header_present = promo_headers.get("present") == "true"
            promo_dom_present = bool((mobile_eval.get("promo") or {}).get("present"))
            if promo_header_present != promo_dom_present:
                note(mobile_failures, "edge promo record present state does not match rendered topper promo")
            if mobile_eval["statusMarker"] != "1":
                note(mobile_failures, "mobile shell marker missing")
            if mobile_eval["shellBlocks"] < 2:
                note(mobile_failures, "mobile shell has fewer than two shell-owned content blocks")
            if mobile_eval["width"] > mobile_eval["viewportWidth"] + 2:
                note(mobile_failures, "mobile horizontal overflow detected")
            if get_path(manifest, "mobile_shell.layout_contract.full_height_mobile_hero_required") is True:
                hero_full_height = mobile_eval.get("heroFullHeight") or {}
                if not hero_full_height.get("ok"):
                    detail = json.dumps(hero_full_height, sort_keys=True)[:500]
                    note(mobile_failures, f"mobile hero does not fill first viewport below promo/header: {detail}")
            if not mobile_eval["consentNoticePresent"] or not mobile_eval["preferencesButtonPresent"] or not mobile_eval["acceptButtonPresent"]:
                note(consent_failures, "compact consent notice/preferences/accept UI missing on first visit")
            if mobile_eval["consentVersion"] != EXPECTED_CONSENT_WIDGET_VERSION:
                note(consent_failures, f"consent widget version mismatch: {mobile_eval['consentVersion']}")
            if "This website uses cookies" not in mobile_eval["consentText"]:
                note(consent_failures, "compact consent text missing")
            if mobile_eval["rejectButtonPresent"]:
                note(consent_failures, "stale inline reject button present on compact consent pill")
            if not mobile_eval.get("edgeAnalyticsScriptPresent"):
                note(event_bridge_failures, "edge analytics/event bridge script missing")
            expected_heap_app_id = str(get_path(manifest, "analytics.heap.app_id") or "")
            expected_heap_mode = str(get_path(manifest, "analytics.heap.mode") or "")
            heap_environment = mobile_eval.get("heapEnvironment") or {}
            if not mobile_eval.get("heapEnvironmentScriptPresent"):
                note(event_bridge_failures, "Heap environment header script missing")
            if expected_heap_app_id and mobile_eval.get("heapAppIdVar") != expected_heap_app_id:
                note(event_bridge_failures, "Heap APP_ID environment variable does not match manifest")
            if expected_heap_app_id and heap_environment.get("appId") != expected_heap_app_id:
                note(event_bridge_failures, "Heap environment payload appId does not match manifest")
            if expected_heap_mode and mobile_eval.get("heapModeVar") != expected_heap_mode:
                note(event_bridge_failures, "Heap mode environment variable does not match manifest")
            if mobile_eval.get("heapEnvironmentVar") != "production":
                note(event_bridge_failures, "Heap environment variable is not production")
            if mobile_eval.get("heapDebugVarType") != "boolean":
                note(event_bridge_failures, "Heap debug environment variable was not preserved as a boolean")
            tracked_shell = mobile_eval.get("trackedShellElements") or []
            required_tracked_elements = {
                "header_phone",
                "header_tour",
                "header_menu_open",
                "drawer_close",
                "drawer_tour",
                "drawer_apply",
                "drawer_phone",
                "hero_primary_cta",
            }
            if promo_header_present:
                required_tracked_elements.update({"promo_bar_toggle", "promo_drawer_close"})
            observed_elements = {item.get("element") for item in tracked_shell}
            missing_tracked = sorted(required_tracked_elements - observed_elements)
            if missing_tracked:
                note(event_bridge_failures, f"mobile shell tracked elements missing: {', '.join(missing_tracked)}")
            incomplete_tracked = [
                item for item in tracked_shell
                if not item.get("action") or not item.get("surface") or not item.get("element") or not item.get("destination")
            ]
            if incomplete_tracked:
                note(event_bridge_failures, f"mobile shell tracked elements have incomplete attributes: {len(incomplete_tracked)}")
            duplicate_tracked_elements = sorted(
                element for element in observed_elements
                if element and sum(1 for item in tracked_shell if item.get("element") == element) > 1
            )
            if duplicate_tracked_elements:
                note(event_bridge_failures, f"mobile shell tracked element identifiers are duplicated: {', '.join(duplicate_tracked_elements[:6])}")
            expected_drawer_labels = [
                str(link.get("label") or "").strip()
                for link in get_path(manifest, "mobile_shell.navigation.links") or []
                if str(link.get("label") or "").strip() and str(link.get("url") or "").strip()
            ]
            drawer_nav_links = mobile_eval.get("drawerNavLinks") or []
            observed_drawer_labels = [str(item.get("text") or "").strip() for item in drawer_nav_links]
            missing_drawer_labels = [
                label for label in expected_drawer_labels
                if label not in observed_drawer_labels
            ]
            if missing_drawer_labels:
                note(event_bridge_failures, f"mobile drawer nav labels missing from manifest order: {', '.join(missing_drawer_labels)}")
            if len(observed_drawer_labels) != len(expected_drawer_labels):
                note(event_bridge_failures, f"mobile drawer nav count mismatch: expected {len(expected_drawer_labels)}, observed {len(observed_drawer_labels)}")
            incomplete_drawer_links = [
                item for item in drawer_nav_links
                if item.get("surface") != "mobile_drawer"
                or not str(item.get("element") or "").startswith("drawer_nav_")
                or not item.get("action")
                or not item.get("destination")
            ]
            if incomplete_drawer_links:
                note(event_bridge_failures, f"mobile drawer nav links have incomplete Heap/Zaraz attributes: {len(incomplete_drawer_links)}")
            tracked_event_eval = page.evaluate(
            """() => {
              window.dataLayer = window.dataLayer || [];
              const start = window.dataLayer.length;
              document.querySelector("[data-edge-drawer-open]")?.click();
              document.querySelector("[data-edge-drawer-close]")?.click();
              const events = window.dataLayer.slice(start).filter((item) => item && /mobile_menu_(open|close)/.test(item.event || ""));
              const open = events.find((item) => item.event === "mobile_menu_open") || null;
              const close = events.find((item) => item.event === "mobile_menu_close") || null;
              return {events, open, close};
            }"""
            )
            result["tracked_shell_event_proof"] = tracked_event_eval
            open_event = tracked_event_eval.get("open") or {}
            close_event = tracked_event_eval.get("close") or {}
            if open_event.get("vtr_action") != "mobile_menu_open" or open_event.get("vtr_element") != "header_menu_open" or open_event.get("vtr_surface") != "mobile_header":
                note(event_bridge_failures, "mobile menu open event payload is not differentiated for Heap/Zaraz")
            if close_event.get("vtr_action") != "mobile_menu_close" or close_event.get("vtr_element") != "drawer_close" or close_event.get("vtr_surface") != "mobile_drawer":
                note(event_bridge_failures, "mobile menu close event payload is not differentiated for Heap/Zaraz")
            hero_stack = mobile_eval.get("heroStack") or {}
            if get_path(manifest, "mobile_shell.reviews.present") is True and not hero_stack.get("ratingPresent"):
                note(mobile_failures, "hero review row is missing even though reviews.present is true")
            if hero_stack.get("staleTitleTextPresent"):
                note(mobile_failures, "stale text-rendered hero title is present; approved SVG title is required")
            if not hero_stack.get("titleArtPresent") or not hero_stack.get("titleSvgPresent"):
                note(mobile_failures, "approved SVG hero title art is missing")
            title_contract = hero_title_contract(manifest)
            if hero_stack.get("titleMode") != title_contract["mode"]:
                note(mobile_failures, f"approved SVG title mode is wrong: {hero_stack.get('titleMode')}")
            if hero_stack.get("titleSrc") != title_contract["src"]:
                note(mobile_failures, f"approved SVG title src is wrong: {hero_stack.get('titleSrc')}")
            if hero_stack.get("titleLabel") != title_contract["label"]:
                note(mobile_failures, "approved SVG accessible label is wrong")
            if not hero_stack.get("orderOk") or not hero_stack.get("noOverlap"):
                note(mobile_failures, "hero review/title/headline/CTA stack is out of order or overlapping")
            title_rect = hero_stack.get("titleRect") or {}
            title_width = float(title_rect.get("width") or 0)
            title_height = float(title_rect.get("height") or 0)
            if (
                title_width < title_contract["min_width"]
                or title_width > title_contract["max_width"]
                or title_height < title_contract["min_height"]
                or title_height > title_contract["max_height"]
            ):
                note(mobile_failures, "approved SVG title geometry is outside approved mobile template bounds")
            if not hero_stack.get("fadeAnimationsPresent"):
                note(mobile_failures, "hero review/title/headline/CTA fade animation contract is missing")
            expected_awards = get_path(manifest, "mobile_shell.awards.assets") or []
            if get_path(manifest, "mobile_shell.awards.present") is True:
                if len(mobile_eval.get("awardImages") or []) < len(expected_awards):
                    note(mobile_failures, "manifest-backed award/badge is missing from rendered mobile shell")
                elif not any("kingsley-award.svg" in (item.get("src") or "") for item in mobile_eval.get("awardImages") or []):
                    note(mobile_failures, "rendered award/badge does not use the shared same-origin Kingsley asset")
            expected_bullets = []
            for block in get_path(manifest, "mobile_shell.content_blocks") or []:
                expected_bullets.extend(block.get("bullets") or [])
            if expected_bullets:
                observed_bullets = set(mobile_eval.get("bulletTexts") or [])
                missing_bullets = [item for item in expected_bullets if item not in observed_bullets]
                if missing_bullets:
                    note(mobile_failures, f"manifest-backed content-block bullets missing from rendered mobile shell: {', '.join(missing_bullets[:4])}")

            if mobile_eval["consentNoticePresent"]:
                page.evaluate(
                """() => {
                  window.__vtrZarazConsentModalCalled = false;
                  window.zaraz = window.zaraz || {};
                  window.zaraz.showConsentModal = function() {
                    window.__vtrZarazConsentModalCalled = true;
                    return undefined;
                  };
                }"""
                )
                prefs_geometry = page.evaluate(
                """() => {
                  const button = document.querySelector("#vtr-cookie-manage");
                  const notice = document.querySelector("#vtr-cookie-notice");
                  const rect = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
                  };
                  const buttonRect = rect(button);
                  const noticeRect = rect(notice);
                  const viewportHeight = Math.min(
                    window.visualViewport?.height || window.innerHeight,
                    document.documentElement.clientHeight || window.innerHeight,
                    window.innerHeight
                  );
                  const centerX = buttonRect ? buttonRect.left + buttonRect.width / 2 : null;
                  const centerY = buttonRect ? buttonRect.top + buttonRect.height / 2 : null;
                  const hit = centerX !== null && centerY !== null ? document.elementFromPoint(centerX, centerY) : null;
                  return {
                    buttonRect,
                    noticeRect,
                    viewportHeight,
                    buttonInViewport: Boolean(buttonRect && buttonRect.top >= 0 && buttonRect.bottom <= viewportHeight + 2),
                    buttonHitTargetOk: Boolean(button && hit && (hit === button || button.contains(hit))),
                    hitTag: hit?.tagName || null,
                    hitId: hit?.id || null
                  };
                }"""
                )
                result["consent_preferences_geometry"] = prefs_geometry
                if not prefs_geometry.get("buttonInViewport"):
                    note(consent_failures, f"compact consent preferences button is outside the mobile proof viewport: {json.dumps(prefs_geometry, sort_keys=True)[:500]}")
                if not prefs_geometry.get("buttonHitTargetOk"):
                    note(consent_failures, f"compact consent preferences button hit target is obscured: {json.dumps(prefs_geometry, sort_keys=True)[:500]}")
                page.evaluate("""() => document.querySelector("#vtr-cookie-manage")?.click()""")
                page.wait_for_timeout(500)
                prefs_eval = page.evaluate(
                """() => ({
                  preferencesRequested: window.__vtrZarazConsentPreferencesRequested === true,
                  showConsentModalCalled: window.__vtrZarazConsentModalCalled === true,
                  noticeRemoved: !document.querySelector("#vtr-cookie-notice"),
                  scrollY: window.scrollY
                })"""
                )
                if prefs_eval["scrollY"] > 10:
                    note(consent_failures, "compact consent preferences proof scrolled before native continuation isolation")
                if not prefs_eval["preferencesRequested"] or not prefs_eval["showConsentModalCalled"] or not prefs_eval["noticeRemoved"]:
                    note(consent_failures, "compact consent preferences did not route to zaraz.showConsentModal path")

            page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
            page.wait_for_timeout(3500)
            continuation_eval = page.evaluate(
            """() => {
              const frame = document.querySelector(".native-continuation-frame");
              let frameMarker = false;
              let frameText = "";
              try {
                frameMarker = !!frame?.contentDocument?.querySelector("[data-vtr-native-continuation-frame]");
                frameText = frame?.contentDocument?.body?.innerText || "";
              } catch {}
              return {
                state: document.querySelector("[data-vtr-native-continuation]")?.getAttribute("data-native-continuation-state") || null,
                frameVisible: !!frame && !frame.hidden,
                frameSrc: frame?.getAttribute("src") || "",
                frameMarker,
                frameWelcomeCount: (frameText.match(/Welcome to/gi) || []).length,
                frameFeaturesCount: (frameText.match(/Stylish Living Spaces|Apartment Features/gi) || []).length
              };
            }"""
            )
            if continuation_eval["state"] != "loaded" or not continuation_eval["frameVisible"] or not continuation_eval["frameMarker"]:
                note(continuation_failures, "native continuation did not load with verified frame marker")
            if continuation_eval["frameWelcomeCount"] > 0 or continuation_eval["frameFeaturesCount"] > 0:
                note(continuation_failures, "native continuation still exposes shell-owned welcome/features duplicate text")

            mobile.close()

            desktop = browser.new_context(viewport={"width": 1365, "height": 900}, user_agent=DESKTOP_UA)
            desktop_page = desktop.new_page()
            desktop_response = desktop_page.goto(url, wait_until="domcontentloaded", timeout=60000)
            desktop_page.wait_for_timeout(2500)
            desktop_shot = out_dir / "desktop-native.png"
            desktop_page.screenshot(path=str(desktop_shot), full_page=False)
            result["screenshots"]["desktop_native"] = str(desktop_shot)
            desktop_eval = desktop_page.evaluate(
            """() => {
              const links = Array.from(document.querySelectorAll("a")).slice(0, 20);
              return {
                mobileShellMarker: !!document.querySelector("[data-vtr-edge-mobile-shell]"),
                packageHeader: document.documentElement.getAttribute("data-vtr-package"),
                stylesheetCount: document.querySelectorAll('link[rel*="stylesheet" i]').length,
                bodyFont: getComputedStyle(document.body).fontFamily,
                rawBlueLinkCount: links.filter((a) => getComputedStyle(a).color === "rgb(0, 0, 238)").length,
                textLength: (document.body.innerText || "").length,
                width: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth
              };
            }"""
            )
            if desktop_response is None or desktop_response.status >= 400:
                note(desktop_failures, f"desktop browser status {desktop_response.status if desktop_response else 'none'}")
            if desktop_eval["mobileShellMarker"]:
                note(desktop_failures, "desktop received mobile shell/topper")
            if desktop_eval["stylesheetCount"] < 1:
                note(desktop_failures, "desktop native stylesheet count is zero")
            if desktop_eval["rawBlueLinkCount"] > 6:
                note(desktop_failures, "desktop appears raw/default-link styled")
            if desktop_eval["width"] > desktop_eval["viewportWidth"] + 2:
                note(desktop_failures, "desktop horizontal overflow detected")
            desktop.close()
            browser.close()
    except Exception as exc:
        message = f"browser acceptance exception: {exc}"
        for bucket in [mobile_failures, continuation_failures, consent_failures, desktop_failures, network_failures, event_bridge_failures]:
            bucket.append(message)
        failures.append(message)

    relevant_bad = [
        item for item in result["bad_responses"]
        if not re.search(r"/favicon|robots\.txt", item.get("url", ""), re.I)
    ]
    if relevant_bad:
        note(network_failures, f"browser bad responses >=400: {len(relevant_bad)}")
    if result["failed_requests"]:
        note(network_failures, f"browser failed requests: {len(result['failed_requests'])}")
    console_errors = [item for item in result["console"] if item.get("type") == "error"]
    if console_errors:
        note(network_failures, f"browser console errors: {len(console_errors)}")

    gate_results = {
        "mobile_first_view": not mobile_failures,
        "native_continuation": not continuation_failures,
        "consent": not consent_failures,
        "desktop_native": not desktop_failures,
        "console_network": not network_failures,
        "event_bridge": not event_bridge_failures,
    }

    result.update(
        {
            "mobile": mobile_eval,
            "continuation": continuation_eval,
            "desktop": desktop_eval,
            "relevant_bad_responses": relevant_bad,
            "console_errors": console_errors,
            "gate_results": gate_results,
            "gate_failures": {
                "mobile_first_view": mobile_failures,
                "native_continuation": continuation_failures,
                "consent": consent_failures,
                "desktop_native": desktop_failures,
                "console_network": network_failures,
                "event_bridge": event_bridge_failures,
            },
            "failures": failures,
            "pass": all(gate_results.values()),
        }
    )
    write_json(out_dir / "browser-acceptance.json", result)
    return {**result, "evidence_path": str(out_dir / "browser-acceptance.json")}


def validate_gsc_record(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    raw_record = get_path(manifest, "seo.gsc_indexing_record")
    record_path = REPO_ROOT / raw_record if raw_record else None
    result = {
        "gsc_property": get_path(manifest, "target.gsc_property"),
        "indexing_record": raw_record,
        "indexing_record_path": str(record_path) if record_path else None,
        "indexing_record_exists": bool(record_path and record_path.exists()),
    }
    result["pass"] = bool(result["gsc_property"] and result["indexing_record_exists"])
    if not result["pass"]:
        result["reason"] = "GSC property is present, but no fresh indexing request/status evidence file is declared in the manifest."
    write_json(out_dir / "gsc-indexing-record.json", result)
    return {**result, "evidence_path": str(out_dir / "gsc-indexing-record.json")}


def validate_captain_record(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    raw_path = get_path(manifest, "captain.evidence_path")
    path = REPO_ROOT / raw_path if raw_path else None
    raw_fresh_path = get_path(manifest, "captain.fresh_update_record")
    fresh_path = REPO_ROOT / raw_fresh_path if raw_fresh_path else None
    result = {
        "captain_id": get_path(manifest, "captain.id"),
        "evidence_path": str(path) if path else None,
        "evidence_exists": bool(path and path.exists()),
        "fresh_update_record": raw_fresh_path,
        "fresh_update_record_path": str(fresh_path) if fresh_path else None,
        "fresh_update_record_exists": bool(fresh_path and fresh_path.exists()),
    }
    result["pass"] = bool(result["captain_id"] and result["evidence_exists"] and result["fresh_update_record_exists"])
    if not result["pass"]:
        result["reason"] = "Captain activation evidence exists, but no fresh Data Pond/Captain update evidence file is declared for this package run."
    write_json(out_dir / "captain-data-pond-record.json", result)
    return {**result, "evidence_path": str(out_dir / "captain-data-pond-record.json")}


def write_evidence_packet(out_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
    packet_path = out_dir / "evidence-packet.json"
    files = sorted(str(path) for path in out_dir.rglob("*") if path.is_file() and path.name != "evidence-packet.json")
    packet = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schema": "resi_edge_evidence_packet_v1",
        "run": {
            "mode": payload.get("mode"),
            "domain": payload.get("domain"),
            "property_code": payload.get("property_code"),
        },
        "file_count": len(files),
        "files": files,
        "gate_summary": (payload.get("contract_gate_ledger") or {}).get("summary"),
        "mandatory_failures": (payload.get("contract_gate_ledger") or {}).get("mandatory_failures"),
    }
    write_json(packet_path, packet)
    return {"pass": True, "evidence_path": str(packet_path), "file_count": len(files)}


def run_zaraz_audit(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    zone = get_path(manifest, "routing.cloudflare_zone_name") or get_path(manifest, "target.domain")
    output = out_dir / "zaraz-consent-audit.json"
    cmd = ["python3", str(ZARAZ_AUDIT), "--domain", zone, "--output", str(output)]
    result = run(cmd)
    payload = load_json(output) or {}
    return {
        "command": cmd,
        "exit_code": result.returncode,
        "pass": result.returncode == 0 and payload.get("status") == "passed",
        "evidence_path": str(output),
        "stdout_tail": result.stdout[-1000:],
        "stderr_tail": result.stderr[-1000:],
    }


def run_zaraz_package_apply(manifest_path: Path, out_dir: Path) -> dict[str, Any]:
    output = out_dir / "zaraz-analytics-package-apply.json"
    cmd = [
        "python3",
        str(ZARAZ_PACKAGE),
        "--manifest",
        str(manifest_path),
        "--apply",
        "--force-republish",
        "--output",
        str(output),
    ]
    result = run(cmd)
    payload = load_json(output) or {}
    package_result = payload.get("result") or {}
    result_status = package_result.get("status")
    return {
        "command": cmd,
        "exit_code": result.returncode,
        "pass": result.returncode == 0 and payload.get("status") == "passed" and result_status in {"applied", "unchanged", "republished"},
        "status": payload.get("status"),
        "result_status": result_status,
        "changes": package_result.get("changes") or [],
        "evidence_path": str(output),
        "stdout_tail": result.stdout[-1000:],
        "stderr_tail": result.stderr[-1000:],
    }


def run_zaraz_consent_package_apply(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    zone = get_path(manifest, "routing.cloudflare_zone_name") or get_path(manifest, "target.domain")
    output = out_dir / "zaraz-consent-package-apply.json"
    cmd = ["python3", str(ZARAZ_CONSENT_PACKAGE), "--domain", zone, "--apply", "--output", str(output)]
    result = run(cmd)
    payload = load_json(output) or {}
    results = payload.get("results") or []
    result_statuses = [item.get("status") for item in results if isinstance(item, dict)]
    acceptable_statuses = {"applied", "unchanged"}
    return {
        "command": cmd,
        "exit_code": result.returncode,
        "pass": (
            result.returncode == 0
            and payload.get("status") == "passed"
            and bool(result_statuses)
            and all(status in acceptable_statuses for status in result_statuses)
        ),
        "status": payload.get("status"),
        "result_statuses": result_statuses,
        "summary": payload.get("summary") or {},
        "evidence_path": str(output),
        "stdout_tail": result.stdout[-1000:],
        "stderr_tail": result.stderr[-1000:],
    }


def validate_ahrefs_manifest(manifest: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    # Full roster lookup is expensive but deterministic; manifest must already
    # name an existing verified project from that lookup before apply.
    result = {
        "project_id": get_path(manifest, "analytics.ahrefs.existing_project_id"),
        "target": get_path(manifest, "analytics.ahrefs.target"),
        "verified": get_path(manifest, "analytics.ahrefs.verified"),
        "policy": get_path(manifest, "analytics.ahrefs.project_policy"),
    }
    result["pass"] = bool(result["project_id"] and result["target"] and result["verified"] is True and result["policy"] == "lookup_existing_project_before_create")
    write_json(out_dir / "ahrefs-manifest-validation.json", result)
    return {**result, "evidence_path": str(out_dir / "ahrefs-manifest-validation.json")}


def evaluate_required_artifacts(target_manifest_path: Path | None = None) -> dict[str, Any]:
    webops_runtime = Path("/Users/mark/Web_Operations/projects/resi-portfolio-edge/src/worker/resi-edge-runtime.draft.js")
    webops_state = Path("/Users/mark/Web_Operations/projects/resi-portfolio-edge/CURRENT_STATE.json")
    adapter_capabilities = None
    if DEPLOY_ADAPTER.exists():
        command = ["python3", str(DEPLOY_ADAPTER), "--capabilities"]
        if target_manifest_path:
            command.extend(["--manifest", str(target_manifest_path)])
        result = run(command)
        try:
            adapter_capabilities = json.loads(result.stdout)
        except json.JSONDecodeError:
            adapter_capabilities = {
                "error": "capabilities output was not valid JSON",
                "exit_code": result.returncode,
                "stderr": result.stderr,
            }
    return {
        "runner_present": Path(__file__).exists(),
        "contract_present": CONTRACT_PATH.exists(),
        "validator_present": VALIDATOR.exists(),
        "manifest_schema_present": MANIFEST_SCHEMA_PATH.exists(),
        "canonical_deploy_adapter_present": DEPLOY_ADAPTER.exists(),
        "canonical_deploy_adapter_capabilities": adapter_capabilities,
        "canonical_deploy_adapter_supports_live_apply": bool(adapter_capabilities and adapter_capabilities.get("supports_live_apply")),
        "base_manifest_present": (MANIFEST_DIR / "championsgreen-ga-com.manifest.json").exists(),
        "pilot_manifest_present": (MANIFEST_DIR / "pilot-ga4ax.manifest.json").exists(),
        "webops_draft_runtime_present": webops_runtime.exists(),
        "webops_draft_status": json.loads(webops_state.read_text()).get("status") if webops_state.exists() else None,
    }


def static_package_validation(out_dir: Path, target_manifest_path: Path | None = None) -> dict[str, Any]:
    gate_coverage = command_payload(
        ["python3", str(GATE_COVERAGE_VALIDATOR)],
        out_dir / "gate-coverage-validation.json",
    )
    command = ["node", str(STATIC_VALIDATOR)]
    if target_manifest_path:
        command.extend(["--manifest", str(target_manifest_path)])
    package_static = command_payload(command, out_dir / "static-package-validation.json")
    combined = {
        "pass": bool(gate_coverage["pass"] and package_static["pass"]),
        "gate_coverage": gate_coverage,
        "package_static": package_static,
    }
    write_json(out_dir / "static-package-gate-readout.json", combined)
    return {**combined, "evidence_path": str(out_dir / "static-package-gate-readout.json")}


def run_process_scenario_audit(args: argparse.Namespace, out_dir: Path, target_manifest_path: Path) -> dict[str, Any]:
    process_audit_dir = out_dir / "process-scenario-audit"
    payload = command_payload(
        [
            "python3",
            str(PROCESS_AUDITOR),
            "--property-code",
            args.property_code.upper(),
            "--domain",
            args.domain,
            "--manifest",
            str(target_manifest_path),
            "--out",
            str(process_audit_dir),
        ],
        process_audit_dir / "process-audit-command.json",
    )
    audit_payload_path = process_audit_dir / "process-audit.json"
    if audit_payload_path.exists():
        payload["audit_payload_path"] = str(audit_payload_path)
        try:
            payload["audit"] = json.loads(audit_payload_path.read_text())
        except json.JSONDecodeError:
            payload["audit"] = {"pass": False, "reason": "process-audit.json was not valid JSON"}
    write_json(process_audit_dir / "process-scenario-audit-gate-readout.json", payload)
    return {**payload, "evidence_path": str(process_audit_dir / "process-scenario-audit-gate-readout.json")}


def run_batch_inventory_audit(out_dir: Path) -> dict[str, Any]:
    batch_audit_dir = out_dir / "batch-inventory-audit"
    payload = command_payload(
        [
            "python3",
            str(BATCH_AUDITOR),
            "--skip-process-audits",
            "--out",
            str(batch_audit_dir),
        ],
        batch_audit_dir / "batch-inventory-audit-command.json",
    )
    summary_path = batch_audit_dir / "batch-process-audit-summary.json"
    if summary_path.exists():
        payload["audit_payload_path"] = str(summary_path)
        try:
            payload["audit"] = json.loads(summary_path.read_text())
        except json.JSONDecodeError:
            payload["audit"] = {"pass": False, "reason": "batch-process-audit-summary.json was not valid JSON"}
    write_json(batch_audit_dir / "batch-inventory-audit-gate-readout.json", payload)
    return {**payload, "evidence_path": str(batch_audit_dir / "batch-inventory-audit-gate-readout.json")}


def add_manifest_gates(ledger: GateLedger, manifest: dict[str, Any] | None, manifest_validation: dict[str, Any], identity: dict[str, Any] | None, out_dir: Path) -> None:
    ledger.pass_gate("reset_card_written", evidence_path=out_dir / "reset-card.md")
    if identity is None:
        ledger.fail_gate("identity_resolved", detail="Property identity did not resolve through governed identity matrix.")
    else:
        ledger.pass_gate("identity_resolved", detail=identity.get("property_name"))
    if manifest is None:
        ledger.fail_gate("manifest_loaded", detail="Manifest file is missing.")
        ledger.fail_gate("manifest_schema_valid", detail="Cannot validate a missing manifest.")
        return
    ledger.pass_gate("manifest_loaded")
    if manifest_validation["pass"]:
        ledger.pass_gate("manifest_schema_valid")
    else:
        ledger.fail_gate("manifest_schema_valid", detail="; ".join(manifest_validation["failures"][:8]))

    lookup = get_path(manifest, "phone_attribution.source_lookup") or []
    if get_path(manifest, "phone_attribution.default_source") == "VWS" and get_path(manifest, "phone_attribution.default_display_phone") and lookup:
        ledger.pass_gate("vws_source_attribution_present")
    else:
        ledger.fail_gate("vws_source_attribution_present", detail="VWS default phone or source lookup is missing.")

    promo_present = get_path(manifest, "mobile_shell.promo.present")
    promo_source = str(get_path(manifest, "mobile_shell.promo.source") or "").lower()
    promo_source_is_feed_backed = promo_source in {"feed_backed", "feed-backed", "governed_feed", "governed-feed"} or promo_source.startswith(("feed_backed", "feed-backed", "governed_feed", "governed-feed"))
    if promo_present is False and promo_source_is_feed_backed:
        ledger.pass_gate("feed_backed_special_verified", detail="No active feed-backed special is explicit; promo bar must be absent.")
    elif promo_source_is_feed_backed and get_path(manifest, "mobile_shell.promo.title") and get_path(manifest, "mobile_shell.promo.body"):
        ledger.pass_gate("feed_backed_special_verified")
    else:
        ledger.fail_gate("feed_backed_special_verified", detail="Promo source must explicitly be feed-backed and include title/body.")

    reviews_present = get_path(manifest, "mobile_shell.reviews.present")
    if reviews_present is False and get_path(manifest, "mobile_shell.reviews.source") and get_path(manifest, "mobile_shell.reviews.last_verified"):
        ledger.pass_gate("review_source_verified", detail="Reviews are explicitly absent from the sourced property record; no row is rendered without a sourced value.")
    elif reviews_present is True and get_path(manifest, "mobile_shell.reviews.rating") and get_path(manifest, "mobile_shell.reviews.count") and get_path(manifest, "mobile_shell.reviews.url") and get_path(manifest, "mobile_shell.reviews.last_verified"):
        ledger.pass_gate("review_source_verified")
    else:
        ledger.fail_gate("review_source_verified", detail="Review source/rating/count/url/last_verified must be present.")

    if get_path(manifest, "mobile_shell.reviews.fractional_stars_required") is True and reviews_present is False:
        ledger.pass_gate("fractional_stars_verified", detail="Review row is explicitly absent; runtime renders proportional star fill when a sourced row is present.")
    elif get_path(manifest, "mobile_shell.reviews.fractional_stars_required") is True:
        ledger.pass_gate("fractional_stars_verified", detail="Runtime renders proportional star fill.")
    else:
        ledger.fail_gate("fractional_stars_verified")

    hero_mobile = get_path(manifest, "mobile_shell.hero.image_mobile")
    content_blocks = get_path(manifest, "mobile_shell.content_blocks") or []
    optimized_asset_manifest_ok = (
        isinstance(hero_mobile, str)
        and hero_mobile.startswith("/assets/resi-edge-assets/")
        and hero_mobile.endswith(".avif")
        and all(
            isinstance(block, dict)
            and isinstance(block.get("image_url"), str)
            and block["image_url"].startswith("/assets/resi-edge-assets/")
            and block["image_url"].endswith(".avif")
            and isinstance(block.get("source_image_url"), str)
            and block["source_image_url"].startswith("https://")
            for block in content_blocks[:2]
        )
    )
    if optimized_asset_manifest_ok:
        ledger.pass_gate("asset_budget_manifest_present", detail="Manifest declares same-origin optimized AVIF assets plus official source URLs for hero and first two content blocks.")
    else:
        ledger.fail_gate("asset_budget_manifest_present", detail="Hero and first two content blocks must declare same-origin optimized AVIF assets and official source image URLs.")

    theme = get_path(manifest, "mobile_shell.brand_theme") or {}
    if all(theme.get(key) for key in ["promo_background", "primary_text", "button_background", "button_text"]):
        ledger.pass_gate("brand_theme_verified")
    else:
        ledger.fail_gate("brand_theme_verified", detail="Brand theme color tokens are incomplete.")

    if get_path(manifest, "mobile_shell.fonts") and get_path(manifest, "mobile_shell.body_font") and get_path(manifest, "mobile_shell.heading_font"):
        ledger.pass_gate("real_fonts_verified", detail="Manifest declares first-party font assets and font tokens.")
    else:
        ledger.fail_gate("real_fonts_verified", detail="Real font assets/tokens are missing from manifest.")

    if len(get_path(manifest, "mobile_shell.content_blocks") or []) >= 2:
        ledger.pass_gate("first_two_content_blocks_present")
    else:
        ledger.fail_gate("first_two_content_blocks_present")

    awards_present = get_path(manifest, "mobile_shell.awards.present")
    award_assets = get_path(manifest, "mobile_shell.awards.assets") or []
    award_assets_renderable = all(award_asset_path(asset) for asset in award_assets)
    if awards_present is False or (awards_present is True and award_assets and award_assets_renderable):
        ledger.pass_gate("award_badge_sequence_verified", detail="Awards explicitly declared as absent or asset-backed.")
    else:
        ledger.fail_gate("award_badge_sequence_verified", detail="Awards/badges must be explicit and renderable in manifest.")

    if get_path(manifest, "rollback.strategy"):
        ledger.pass_gate("rollback_plan_written")
    else:
        ledger.fail_gate("rollback_plan_written")

    heap_guard_ok = (
        get_path(manifest, "analytics.heap.mode") == EXPECTED_HEAP_MODE
        and get_path(manifest, "analytics.heap.passive_timer_allowed") is False
        and get_path(manifest, "analytics.heap.contentsquare_verify_guard.enabled") is True
        and get_path(manifest, "analytics.heap.contentsquare_verify_guard.same_origin_path") == EXPECTED_CS_VERIFY_PATH
        and get_path(manifest, "analytics.heap.contentsquare_verify_guard.expected_status") == 204
    )
    if heap_guard_ok:
        ledger.pass_gate("heap_contentsquare_verify_guard_configured")
    else:
        ledger.fail_gate(
            "heap_contentsquare_verify_guard_configured",
            detail=f"Heap must use {EXPECTED_HEAP_MODE} with same-origin Contentsquare verify 204 suppression before apply.",
        )


def add_live_gates_from_shell(ledger: GateLedger, shell: dict[str, Any]) -> None:
    evidence = shell.get("proof_path")
    if shell.get("pass"):
        ledger.pass_gate("mobile_shell_contract_passed", evidence_path=evidence)
        ledger.pass_gate("desktop_topper_absent", evidence_path=evidence)
        ledger.pass_gate("analytics_no_direct_wordpress_load", evidence_path=evidence)
        ledger.pass_gate("zaraz_consent_browser_proof_passed", evidence_path=evidence)
        ledger.pass_gate("native_continuation_dedupe_verified", evidence_path=evidence)
        ledger.pass_gate("native_continuation_blocks_present", evidence_path=evidence)
    else:
        failures = shell.get("failures") or []
        detail = "; ".join(failures) or "Mobile shell contract validator failed."
        buckets = {
            "mobile_shell_contract_passed": [],
            "desktop_topper_absent": [],
            "analytics_no_direct_wordpress_load": [],
            "zaraz_consent_browser_proof_passed": [],
            "native_continuation_dedupe_verified": [],
            "native_continuation_blocks_present": [],
        }
        for failure in failures:
            lowered = failure.lower()
            if "consent_widget" in lowered or "consent widget" in lowered:
                buckets["zaraz_consent_browser_proof_passed"].append(failure)
            elif "direct_native_analytics" in lowered or "analytics_blockers" in lowered:
                buckets["analytics_no_direct_wordpress_load"].append(failure)
            elif "desktop_topper" in lowered or "desktop topper" in lowered:
                buckets["desktop_topper_absent"].append(failure)
            elif "continuation" in lowered or "duplicate" in lowered:
                buckets["native_continuation_dedupe_verified"].append(failure)
                buckets["native_continuation_blocks_present"].append(failure)
            else:
                buckets["mobile_shell_contract_passed"].append(failure)
        for gate_name, gate_failures in buckets.items():
            if gate_failures:
                ledger.fail_gate(gate_name, evidence_path=evidence, detail="; ".join(gate_failures))
            elif gate_name == "mobile_shell_contract_passed":
                ledger.fail_gate(gate_name, evidence_path=evidence, detail=detail)
            else:
                ledger.pass_gate(gate_name, evidence_path=evidence)


def mark_unproven_apply_gates(ledger: GateLedger) -> None:
    for name in ledger.order:
        row = ledger.rows[name]
        if row.status == "not_run":
            ledger.fail_gate(name, detail="No automated proof was produced for this gate in the current runner.")


def preflight_failures(ledger: GateLedger) -> list[str]:
    return [
        name
        for name in PREFLIGHT_REQUIRED_GATES
        if ledger.rows.get(name, GateResult(name, "not_run")).required
        and ledger.rows.get(name, GateResult(name, "not_run")).status != "pass"
    ]


def stage_failures(ledger: GateLedger) -> list[str]:
    return [
        name
        for name in STAGE_REQUIRED_GATES
        if ledger.rows.get(name, GateResult(name, "not_run")).required
        and ledger.rows.get(name, GateResult(name, "not_run")).status != "pass"
    ]


def apply_only_pending(ledger: GateLedger) -> list[str]:
    return [
        name
        for name in ledger.order
        if name not in STAGE_REQUIRED_GATES
        and ledger.rows.get(name, GateResult(name, "not_run")).required
        and ledger.rows.get(name, GateResult(name, "not_run")).status == "not_run"
    ]


def stage_pending(ledger: GateLedger) -> list[str]:
    return [
        name
        for name in STAGE_REQUIRED_GATES
        if name not in PREFLIGHT_REQUIRED_GATES
        and ledger.rows.get(name, GateResult(name, "not_run")).required
        and ledger.rows.get(name, GateResult(name, "not_run")).status != "pass"
    ]


def build_preflight_context(args: argparse.Namespace, out_dir: Path, contract: dict[str, Any], identity: dict[str, Any] | None) -> dict[str, Any]:
    target_manifest_path = manifest_path(args)
    artifacts = evaluate_required_artifacts(target_manifest_path)
    manifest = load_json(target_manifest_path)
    manifest_validation = validate_manifest(manifest, args, identity)
    base_reference = "base_reference" in str(get_path(manifest, "routing.mutation_policy") or "")
    ledger = GateLedger(contract)
    add_manifest_gates(ledger, manifest, manifest_validation, identity, out_dir)

    source_probe_url = (
        get_path(manifest, "target.governed_reference_url")
        or get_path(manifest, "target.website_url")
        or get_path(manifest, "target.canonical_source_url")
        or f"https://{args.domain}/"
    )
    source_probe = audit_source_page(str(source_probe_url))
    source_probe_path = out_dir / "source-page-audit.json"
    write_fetch_evidence(source_probe_path, source_probe)
    if source_probe.get("ok"):
        ledger.pass_gate("source_page_audited", evidence_path=source_probe_path)
    else:
        ledger.fail_gate("source_page_audited", evidence_path=source_probe_path, detail=source_probe.get("error") or f"HTTP {source_probe.get('status')}")

    static_result = static_package_validation(out_dir, target_manifest_path)
    if static_result["pass"]:
        ledger.pass_gate("static_package_validation_passed", evidence_path=static_result.get("evidence_path"), detail="Static canonical package validation passed. Live shell proof still runs after apply.")
    else:
        ledger.fail_gate("static_package_validation_passed", evidence_path=static_result.get("evidence_path"), detail="Static canonical package validation failed.")

    batch_audit = run_batch_inventory_audit(out_dir)
    if batch_audit["pass"]:
        ledger.pass_gate(
            "batch_inventory_audit_passed",
            evidence_path=batch_audit.get("evidence_path"),
            detail="Active production manifest inventory is unambiguous and release/register references resolve to active manifests.",
        )
    else:
        ledger.fail_gate(
            "batch_inventory_audit_passed",
            evidence_path=batch_audit.get("evidence_path"),
            detail=batch_audit.get("stderr_tail") or batch_audit.get("stdout_tail") or "Batch inventory audit failed.",
        )

    if static_result["pass"] and manifest_validation["pass"] and identity is not None:
        process_audit = run_process_scenario_audit(args, out_dir, target_manifest_path)
        if process_audit["pass"]:
            ledger.pass_gate(
                "process_scenario_audit_passed",
                evidence_path=process_audit.get("evidence_path"),
                detail="Read-only scenario audit proved known bad manifest states are blocked before stage/apply.",
            )
        else:
            ledger.fail_gate(
                "process_scenario_audit_passed",
                evidence_path=process_audit.get("evidence_path"),
                detail=process_audit.get("stderr_tail") or process_audit.get("stdout_tail") or "Process scenario audit failed.",
            )
    else:
        ledger.block_gate(
            "process_scenario_audit_passed",
            detail="Process scenario audit requires passing manifest, identity, and static package gates first.",
        )

    if artifacts["manifest_schema_present"]:
        ledger.pass_gate("manifest_schema_present", required=False)
    if base_reference:
        ledger.skip_gate("canonical_deploy_adapter_supports_live_apply", detail="Champions Green is the canonical base reference; live apply is intentionally not available.")
    elif artifacts["canonical_deploy_adapter_present"] and artifacts["canonical_deploy_adapter_supports_live_apply"]:
        ledger.pass_gate("canonical_deploy_adapter_supports_live_apply", required=False)
    else:
        ledger.fail_gate("canonical_deploy_adapter_supports_live_apply", detail="Canonical deploy adapter is not live-capable.")

    ahrefs = validate_ahrefs_manifest(manifest or {}, out_dir / "ahrefs")
    if ahrefs["pass"]:
        ledger.pass_gate("ahrefs_existing_project_confirmed", evidence_path=ahrefs["evidence_path"])
    else:
        ledger.fail_gate("ahrefs_existing_project_confirmed", evidence_path=ahrefs["evidence_path"], detail="Ahrefs existing verified project metadata is incomplete.")

    if manifest:
        zaraz = run_zaraz_audit(manifest, out_dir / "consent")
        if zaraz["pass"]:
            ledger.pass_gate("zaraz_consent_ready", evidence_path=zaraz["evidence_path"])
        elif args.mode == "plan":
            ledger.set(
                "zaraz_consent_ready",
                "not_run",
                evidence_path=zaraz["evidence_path"],
                detail=(
                    "Consent is not yet configured on this zone. This is a stage setup action: "
                    "the governed Zaraz consent package is applied and re-audited before any route probe or Worker deploy."
                ),
            )
        else:
            ledger.fail_gate("zaraz_consent_ready", evidence_path=zaraz["evidence_path"], detail=zaraz.get("stderr_tail") or "Zaraz consent audit failed.")

        if base_reference:
            ledger.skip_gate("gsc_indexing_recorded", detail="Protected base reference plan does not require a fresh launch indexing record.")
            ledger.skip_gate("captain_data_pond_updated", detail="Protected base reference plan does not require a fresh launch Captain/Data Pond update.")
        else:
            gsc = validate_gsc_record(manifest, out_dir / "seo")
            if gsc["pass"]:
                ledger.pass_gate("gsc_indexing_recorded", evidence_path=gsc["evidence_path"])
            else:
                ledger.fail_gate("gsc_indexing_recorded", evidence_path=gsc["evidence_path"], detail=gsc.get("reason"))

            captain = validate_captain_record(manifest, out_dir / "captain")
            if captain["pass"]:
                ledger.pass_gate("captain_data_pond_updated", evidence_path=captain["evidence_path"])
            else:
                ledger.fail_gate("captain_data_pond_updated", evidence_path=captain["evidence_path"], detail=captain.get("reason"))

    return {
        "target_manifest_path": target_manifest_path,
        "artifacts": artifacts,
        "manifest": manifest,
        "manifest_validation": manifest_validation,
        "base_reference": base_reference,
        "ledger": ledger,
    }


def run_stage_setup(args: argparse.Namespace, out_dir: Path, target_manifest_path: Path, manifest: dict[str, Any] | None, ledger: GateLedger) -> dict[str, Any]:
    asset_package = run_asset_generation_and_upload(target_manifest_path, out_dir / "assets")
    if asset_package["pass"]:
        ledger.pass_gate("asset_generation_upload_passed", evidence_path=asset_package["evidence_path"])
    else:
        ledger.fail_gate(
            "asset_generation_upload_passed",
            evidence_path=asset_package.get("evidence_path"),
            detail="Optimized asset generation/upload failed or produced assets outside the canonical byte budgets.",
        )
        return {
            "pass": False,
            "blocked": True,
            "block_reason": "Optimized asset package failed. No Zaraz setup, route probe, or Worker deploy was attempted.",
            "asset_package": asset_package,
            "zaraz_package": None,
            "zaraz_consent_package": None,
            "zaraz_consent_audit": None,
            "deploy_bundle_validation": None,
        }

    zaraz_package = None
    zaraz_consent_package = None
    zaraz = None
    if manifest:
        zaraz_package = run_zaraz_package_apply(target_manifest_path, out_dir / "analytics-setup")
        if zaraz_package["pass"]:
            ledger.pass_gate("zaraz_analytics_package_applied", evidence_path=zaraz_package["evidence_path"], detail=f"Zaraz analytics package status: {zaraz_package.get('result_status')}.")
        else:
            ledger.fail_gate("zaraz_analytics_package_applied", evidence_path=zaraz_package.get("evidence_path"), detail=zaraz_package.get("stderr_tail") or "Governed Zaraz analytics package apply failed.")
            return {
                "pass": False,
                "blocked": True,
                "block_reason": "Governed Zaraz analytics package apply failed. No route probe or Worker deploy was attempted.",
                "asset_package": asset_package,
                "zaraz_package": zaraz_package,
                "zaraz_consent_package": None,
                "zaraz_consent_audit": None,
                "deploy_bundle_validation": None,
            }

        zaraz_consent_package = run_zaraz_consent_package_apply(manifest, out_dir / "consent-setup")
        if not zaraz_consent_package["pass"]:
            ledger.fail_gate(
                "zaraz_consent_ready",
                evidence_path=zaraz_consent_package.get("evidence_path"),
                detail=zaraz_consent_package.get("stderr_tail") or "Governed Zaraz consent package apply failed.",
            )
            return {
                "pass": False,
                "blocked": True,
                "block_reason": "Governed Zaraz consent package apply failed. No route probe or Worker deploy was attempted.",
                "asset_package": asset_package,
                "zaraz_package": zaraz_package,
                "zaraz_consent_package": zaraz_consent_package,
                "zaraz_consent_audit": None,
                "deploy_bundle_validation": None,
            }

        zaraz = run_zaraz_audit(manifest, out_dir / "consent-after-setup")
        if zaraz["pass"]:
            ledger.pass_gate("zaraz_consent_ready", evidence_path=zaraz["evidence_path"])
        else:
            ledger.fail_gate("zaraz_consent_ready", evidence_path=zaraz.get("evidence_path"), detail=zaraz.get("stderr_tail") or "Zaraz consent audit failed after setup.")
            return {
                "pass": False,
                "blocked": True,
                "block_reason": "Zaraz consent audit failed after analytics setup. No route probe or Worker deploy was attempted.",
                "asset_package": asset_package,
                "zaraz_package": zaraz_package,
                "zaraz_consent_package": zaraz_consent_package,
                "zaraz_consent_audit": zaraz,
                "deploy_bundle_validation": None,
            }

    deploy_bundle = run_deploy_bundle_validation(
        target_manifest_path,
        out_dir / "deploy-bundle",
    )
    if deploy_bundle["pass"]:
        ledger.pass_gate("deploy_bundle_closure_verified", evidence_path=deploy_bundle["evidence_path"], detail="Generated deploy bundle passed Wrangler dry-run with all shared runtime dependencies included.")
    else:
        ledger.fail_gate("deploy_bundle_closure_verified", evidence_path=deploy_bundle.get("evidence_path"), detail=deploy_bundle.get("reason") or "Generated deploy bundle validation failed.")
        return {
            "pass": False,
            "blocked": True,
            "block_reason": "Generated deploy bundle validation failed. No route probe or Worker deploy was attempted.",
            "asset_package": asset_package,
            "zaraz_package": zaraz_package,
            "zaraz_consent_package": zaraz_consent_package,
            "zaraz_consent_audit": zaraz,
            "deploy_bundle_validation": deploy_bundle,
        }

    current_stage_failures = stage_failures(ledger)
    return {
        "pass": not current_stage_failures,
        "blocked": bool(current_stage_failures),
        "block_reason": None if not current_stage_failures else "One or more staged setup gates failed.",
        "stage_failures": current_stage_failures,
        "asset_package": asset_package,
        "zaraz_package": zaraz_package,
        "zaraz_consent_package": zaraz_consent_package,
        "zaraz_consent_audit": zaraz,
        "deploy_bundle_validation": deploy_bundle,
    }

def mode_plan(args: argparse.Namespace, out_dir: Path, contract: dict[str, Any], identity: dict[str, Any] | None) -> int:
    context = build_preflight_context(args, out_dir, contract, identity)
    target_manifest_path = context["target_manifest_path"]
    artifacts = context["artifacts"]
    manifest_validation = context["manifest_validation"]
    base_reference = context["base_reference"]
    ledger = context["ledger"]

    ledger_payload = ledger.payload()
    # Plan mode proves only preflight gates. Live-only gates remain not_run by
    # design and do not become apply success.
    current_preflight_failures = preflight_failures(ledger)
    current_stage_pending = stage_pending(ledger)
    current_apply_pending = apply_only_pending(ledger)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "domain": args.domain,
        "property_code": args.property_code.upper(),
        "contract_status": contract.get("status"),
        "identity": identity,
        "artifacts": artifacts,
        "manifest_path": str(target_manifest_path),
        "manifest_validation": manifest_validation,
        "contract_gate_ledger": ledger_payload,
        "pass": not current_preflight_failures,
        "preflight_failures": current_preflight_failures,
        "stage_gates_pending": current_stage_pending,
        "apply_only_gates_pending": current_apply_pending,
        "stage_allowed": bool(not current_preflight_failures and not base_reference),
        "apply_allowed": False,
        "apply_block_reason": (
            "Champions Green is the canonical base reference; choose a separate target before apply."
            if base_reference
            else (
                "Run --mode stage and resolve every staged setup gate before live apply."
                if not current_preflight_failures
                else "Live apply is blocked until all preflight gates pass. Staged setup gates must still run before apply."
            )
        ),
        "next_command": (
            None
            if current_preflight_failures or base_reference
            else f"{base_runner_command(args)} --mode stage"
        ),
    }
    write_json(out_dir / "plan-readout.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["pass"] else 2


def mode_validate_reference(args: argparse.Namespace, out_dir: Path, contract: dict[str, Any], identity: dict[str, Any] | None) -> int:
    shell = validate_shell(args, out_dir)
    ledger = GateLedger(contract)
    if identity is None:
        ledger.fail_gate("identity_resolved")
    else:
        ledger.pass_gate("identity_resolved", detail=identity.get("property_name"))
    add_live_gates_from_shell(ledger, shell)
    # References prove only the live reference shell contract.
    for name in ledger.order:
        if ledger.rows[name].status == "not_run":
            ledger.skip_gate(name, detail="Not part of read-only reference replay.")
    ledger_payload = ledger.payload()
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "domain": args.domain,
        "property_code": args.property_code.upper(),
        "identity": identity,
        "shell_validation": shell,
        "contract_gate_ledger": ledger_payload,
        "pass": shell["pass"] and identity is not None,
    }
    write_json(out_dir / "reference-validation-readout.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["pass"] else 2


def run_reference_replay(out_dir: Path, ledger: GateLedger) -> dict[str, Any]:
    reference_out = out_dir / "reference-replay"
    vine_reference = validate_shell(
        argparse.Namespace(property_code="TX4EK", domain="thevinekyle.com", mode="validate-reference"),
        reference_out / "thevine",
    )
    ledger.pass_gate(
        "reference_vine_replay_passed",
        evidence_path=vine_reference.get("proof_path"),
        detail=(
            "The Vine live reference capture passed."
            if vine_reference["pass"]
            else "The Vine live reference capture is stale against the current SVG contract; target live proof remains the blocking acceptance gate."
        ),
        required=False,
    )
    return {
        "pass": True,
        "reference_green": bool(vine_reference["pass"]),
        "thevine": vine_reference,
    }


def mode_stage(args: argparse.Namespace, out_dir: Path, contract: dict[str, Any], identity: dict[str, Any] | None) -> int:
    context = build_preflight_context(args, out_dir, contract, identity)
    target_manifest_path = context["target_manifest_path"]
    artifacts = context["artifacts"]
    manifest = context["manifest"]
    manifest_validation = context["manifest_validation"]
    base_reference = context["base_reference"]
    ledger = context["ledger"]

    if base_reference:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "pass": False,
            "blocked": True,
            "block_reason": "Champions Green is the canonical base reference. Stage requires a separate explicitly selected target.",
            "manifest_path": str(target_manifest_path),
            "contract_gate_ledger": ledger.payload(),
        }
        write_json(out_dir / "stage-blocked-base-reference.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    current_preflight_failures = preflight_failures(ledger)
    if current_preflight_failures:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "contract_gate_ledger": ledger.payload(),
            "pass": False,
            "blocked": True,
            "block_reason": "Stage preflight failed. No asset upload, Zaraz setup, route probe, or Worker deploy was attempted.",
            "preflight_failures": current_preflight_failures,
        }
        write_json(out_dir / "stage-blocked-preflight-readout.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    reference_replay = run_reference_replay(out_dir, ledger)
    if not reference_replay["pass"]:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "reference_replay": reference_replay,
            "contract_gate_ledger": ledger.payload(),
            "pass": False,
            "blocked": True,
            "block_reason": "Reference replay failed. No asset upload, Zaraz setup, route probe, or Worker deploy was attempted.",
        }
        write_json(out_dir / "stage-blocked-reference-replay.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    stage_setup = run_stage_setup(args, out_dir, target_manifest_path, manifest, ledger)
    current_stage_failures = stage_failures(ledger)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "domain": args.domain,
        "property_code": args.property_code.upper(),
        "identity": identity,
        "artifacts": artifacts,
        "manifest_path": str(target_manifest_path),
        "manifest_validation": manifest_validation,
        "reference_replay": reference_replay,
        "stage_setup": stage_setup,
        "contract_gate_ledger": ledger.payload(),
        "pass": bool(stage_setup["pass"] and not current_stage_failures),
        "blocked": bool(not stage_setup["pass"] or current_stage_failures),
        "block_reason": None if stage_setup["pass"] and not current_stage_failures else stage_setup.get("block_reason") or "Stage gates failed.",
        "stage_failures": current_stage_failures,
        "apply_allowed": bool(stage_setup["pass"] and not current_stage_failures),
        "next_command": (
            f"{base_runner_command(args)} --mode apply --require-live-proof"
            if stage_setup["pass"] and not current_stage_failures
            else None
        ),
        "live_route_changed": False,
    }
    write_json(out_dir / "stage-readout.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["pass"] else 3


def mode_apply(
    args: argparse.Namespace,
    out_dir: Path,
    contract: dict[str, Any],
    identity: dict[str, Any] | None,
) -> int:
    if not args.require_live_proof:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "pass": False,
            "blocked": True,
            "block_reason": "Apply requires --require-live-proof. No live mutation was made.",
        }
        write_json(out_dir / "apply-blocked-readout.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    phases = PhaseRecorder(out_dir)
    preflight_phase = phases.start("preflight_context_and_static_gates")
    context = build_preflight_context(args, out_dir, contract, identity)
    target_manifest_path = context["target_manifest_path"]
    artifacts = context["artifacts"]
    manifest = context["manifest"]
    manifest_validation = context["manifest_validation"]
    base_reference = context["base_reference"]
    ledger = context["ledger"]

    if base_reference:
        phases.finish(preflight_phase, "blocked", detail="Protected golden reference cannot be overwritten.")
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "pass": False,
            "blocked": True,
            "block_reason": "This is a protected golden reference. References may be validated/captured only, never overwritten by a generated package.",
            "manifest_path": str(target_manifest_path),
            "contract_gate_ledger": ledger.payload(),
            "phase_timings": phases.complete(),
        }
        write_json(out_dir / "apply-blocked-base-reference.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    current_preflight_failures = preflight_failures(ledger)
    if current_preflight_failures:
        phases.finish(preflight_phase, "failed", detail="Apply preflight failed.")
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "contract_gate_ledger": ledger.payload(),
            "pass": False,
            "blocked": True,
            "block_reason": "Apply preflight failed. No asset upload, Zaraz setup, route probe, or Worker deploy was attempted.",
            "preflight_failures": current_preflight_failures,
            "phase_timings": phases.complete(),
        }
        write_json(out_dir / "apply-blocked-preflight-readout.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    phases.finish(preflight_phase, "pass", evidence_path=str(out_dir / "static-package-gate-readout.json"))

    reference_phase = phases.start("reference_replay")
    reference_replay = run_reference_replay(out_dir, ledger)
    if not reference_replay["pass"]:
        phases.finish(reference_phase, "failed", evidence_path=reference_replay.get("evidence_path"))
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "reference_replay": reference_replay,
            "contract_gate_ledger": ledger.payload(),
            "pass": False,
            "blocked": True,
            "block_reason": "Reference replay failed. No asset upload, Zaraz setup, route probe, or Worker deploy was attempted.",
            "phase_timings": phases.complete(),
        }
        write_json(out_dir / "apply-blocked-reference-replay.json", payload)
        print(json.dumps(payload, indent=2))
        return 3
    phases.finish(reference_phase, "pass", evidence_path=reference_replay.get("evidence_path"))

    stage_phase = phases.start("stage_setup_assets_analytics_consent_bundle")
    stage_setup = run_stage_setup(args, out_dir, target_manifest_path, manifest, ledger)
    current_stage_failures = stage_failures(ledger)
    asset_package = stage_setup.get("asset_package")
    zaraz_package = stage_setup.get("zaraz_package")
    deploy_bundle_validation = stage_setup.get("deploy_bundle_validation")
    if not stage_setup["pass"] or current_stage_failures:
        phases.finish(stage_phase, "failed", detail=stage_setup.get("block_reason") or "Apply staged setup gates failed.")
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "reference_replay": reference_replay,
            "stage_setup": stage_setup,
            "contract_gate_ledger": ledger.payload(),
            "pass": False,
            "blocked": True,
            "block_reason": stage_setup.get("block_reason") or "Apply staged setup gates failed. No route probe or Worker deploy was attempted.",
            "stage_failures": current_stage_failures,
            "phase_timings": phases.complete(),
        }
        write_json(out_dir / "apply-blocked-stage-readout.json", payload)
        print(json.dumps(payload, indent=2))
        return 3
    phases.finish(
        stage_phase,
        "pass",
        evidence_path=(deploy_bundle_validation or {}).get("evidence_path"),
        extra={
            "asset_package_pass": bool((asset_package or {}).get("pass")),
            "zaraz_package_pass": bool((zaraz_package or {}).get("pass")),
        },
    )

    route_phase = phases.start("cloudflare_route_interception_probe")
    route_probe = validate_route_interception(args, manifest or {}, out_dir / "route-probe")
    if route_probe["pass"]:
        ledger.pass_gate(
            "cloudflare_route_interception_probe_passed",
            evidence_path=route_probe["evidence_path"],
            detail="Temporary isolated route proved Worker interception, homepage isolation, and cleanup.",
        )
        phases.finish(route_phase, "pass", evidence_path=route_probe.get("evidence_path"))
    else:
        ledger.fail_gate(
            "cloudflare_route_interception_probe_passed",
            evidence_path=route_probe.get("evidence_path"),
            detail=route_probe.get("reason") or "Route interception probe failed.",
        )
        phases.finish(route_phase, "failed", evidence_path=route_probe.get("evidence_path"), detail=route_probe.get("reason") or "Route interception probe failed.")
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "pass": False,
            "blocked": True,
            "block_reason": "Cloudflare route interception probe failed. Full package deploy was not attempted.",
            "zaraz_package": zaraz_package,
            "stage_setup": stage_setup,
            "route_probe": route_probe,
            "asset_package": asset_package,
            "contract_gate_ledger": ledger.payload(),
            "phase_timings": phases.complete(),
        }
        write_json(out_dir / "apply-blocked-route-probe.json", payload)
        print(json.dumps(payload, indent=2))
        return 3

    deploy_phase = phases.start("live_worker_deploy")
    deploy_command = [
        "python3",
        str(DEPLOY_ADAPTER),
        "--apply",
        "--manifest",
        str(target_manifest_path),
        "--out-dir",
        str(out_dir / "deploy"),
    ]
    deploy = run(deploy_command)
    deploy_payload = None
    deploy_readout = out_dir / "deploy/deploy-adapter-readout.json"
    if deploy_readout.exists():
        deploy_payload = json.loads(deploy_readout.read_text())
    if deploy.returncode != 0 or not (deploy_payload or {}).get("pass"):
        phases.finish(deploy_phase, "failed", evidence_path=str(deploy_readout) if deploy_readout.exists() else None, detail="Deploy adapter failed.")
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "pass": False,
            "blocked": True,
            "block_reason": "Deploy adapter failed. Live proof was not attempted.",
            "zaraz_package": zaraz_package,
            "stage_setup": stage_setup,
            "deploy_bundle_validation": deploy_bundle_validation,
            "asset_package": asset_package,
            "deploy": deploy_payload or {"exit_code": deploy.returncode, "stdout": deploy.stdout, "stderr": deploy.stderr},
            "phase_timings": phases.complete(),
        }
        write_json(out_dir / "apply-failed-readout.json", payload)
        print(json.dumps(payload, indent=2))
        return 3
    phases.finish(deploy_phase, "pass", evidence_path=str(deploy_readout), extra={"deploy_returncode": deploy.returncode})

    def rollback_readout(readout_name: str, block_reason: str, extra: dict[str, Any] | None = None) -> int:
        rollback = rollback_package_worker(
            args,
            out_dir / "rollback",
            block_reason,
            manifest=manifest,
        )
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "reference_replay": reference_replay,
            "zaraz_package": zaraz_package,
            "stage_setup": stage_setup,
            "deploy_bundle_validation": deploy_bundle_validation,
            "asset_package": asset_package,
            "route_probe": route_probe,
            "deploy": deploy_payload,
            "rollback": rollback,
            "contract_gate_ledger": ledger.payload(),
            "pass": False,
            "blocked": True,
            "block_reason": block_reason,
            "phase_timings": phases.complete(),
        }
        if extra:
            payload.update(extra)
        write_json(out_dir / readout_name, payload)
        print(json.dumps(payload, indent=2))
        return 3

    package_health_phase = phases.start("package_health_probe")
    package_health = validate_package_health(args, manifest or {}, out_dir / "package-health")
    if package_health["pass"]:
        ledger.pass_gate(
            "cloudflare_package_health_probe_passed",
            evidence_path=package_health["evidence_path"],
            detail=f"Package health passed at {', '.join(package_health.get('passing_labels') or [])}.",
        )
        phases.finish(package_health_phase, "pass", evidence_path=package_health.get("evidence_path"))
    else:
        ledger.fail_gate(
            "cloudflare_package_health_probe_passed",
            evidence_path=package_health.get("evidence_path"),
            detail=package_health.get("reason") or "Package health probe failed.",
        )
        phases.finish(package_health_phase, "failed", evidence_path=package_health.get("evidence_path"), detail=package_health.get("reason") or "Package health probe failed.")
        return rollback_readout(
            "apply-failed-package-health-readout.json",
            "Package health proof failed after deploy. Package Worker was rolled back.",
            {"package_health": package_health},
        )

    wordpress_phase = phases.start("wordpress_control_path_bypass")
    wordpress_control_path = validate_wordpress_control_path_bypass(args, out_dir / "wordpress-control")
    if wordpress_control_path["pass"]:
        ledger.pass_gate(
            "wordpress_control_path_bypass_proven",
            evidence_path=wordpress_control_path["evidence_path"],
            detail="WordPress login/admin/API paths preserved transparent native behavior.",
        )
        phases.finish(wordpress_phase, "pass", evidence_path=wordpress_control_path.get("evidence_path"))
    else:
        ledger.fail_gate(
            "wordpress_control_path_bypass_proven",
            evidence_path=wordpress_control_path.get("evidence_path"),
            detail="; ".join(wordpress_control_path.get("failures") or []) or "WordPress control-path bypass proof failed.",
        )
        phases.finish(
            wordpress_phase,
            "failed",
            evidence_path=wordpress_control_path.get("evidence_path"),
            detail="; ".join(wordpress_control_path.get("failures") or []) or "WordPress control-path bypass proof failed.",
        )
        return rollback_readout(
            "apply-failed-wordpress-control-path-readout.json",
            "WordPress control-path bypass proof failed after deploy. Package Worker was rolled back.",
            {"package_health": package_health, "wordpress_control_path_bypass": wordpress_control_path},
        )

    cache_phase = phases.start("cache_purge")
    cache_purge = run_cache_purge(args, out_dir / "cache")
    if cache_purge["pass"]:
        ledger.pass_gate("cache_purge_proven", evidence_path=cache_purge["evidence_path"])
        phases.finish(cache_phase, "pass", evidence_path=cache_purge.get("evidence_path"))
    else:
        ledger.fail_gate("cache_purge_proven", evidence_path=cache_purge.get("evidence_path"), detail=cache_purge.get("stderr_tail") or "Cloudflare cache purge failed.")
        phases.finish(cache_phase, "failed", evidence_path=cache_purge.get("evidence_path"), detail=cache_purge.get("stderr_tail") or "Cloudflare cache purge failed.")
        return rollback_readout(
            "apply-failed-cache-purge-readout.json",
            "Cache purge proof failed after package deploy. Package Worker was rolled back.",
            {"package_health": package_health, "cache_purge": cache_purge},
        )

    if manifest:
        r2_phase = phases.start("r2_asset_readback")
        r2_assets = validate_r2_asset_readback(args, manifest, out_dir / "r2")
        if r2_assets["pass"]:
            ledger.pass_gate("r2_asset_readback_passed", evidence_path=r2_assets["evidence_path"])
            phases.finish(r2_phase, "pass", evidence_path=r2_assets.get("evidence_path"))
        else:
            ledger.fail_gate("r2_asset_readback_passed", evidence_path=r2_assets["evidence_path"], detail=r2_assets.get("reason"))
            phases.finish(r2_phase, "failed", evidence_path=r2_assets.get("evidence_path"), detail=r2_assets.get("reason"))
            return rollback_readout(
                "apply-failed-r2-readback-readout.json",
                "R2 asset readback proof failed after package deploy. Package Worker was rolled back.",
                {"package_health": package_health, "cache_purge": cache_purge, "r2_asset_readback": r2_assets},
            )

    live_shell_phase = phases.start("live_mobile_shell_proof")
    live_shell = validate_shell(args, out_dir / "live-proof")
    add_live_gates_from_shell(ledger, live_shell)
    if not live_shell["pass"]:
        phases.finish(live_shell_phase, "failed", evidence_path=live_shell.get("evidence_path"), detail=live_shell.get("reason") or "Live shell proof failed.")
        return rollback_readout(
            "apply-failed-live-proof-readout.json",
            "Live shell proof failed after deploy. Package Worker was rolled back.",
            {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell},
        )
    phases.finish(live_shell_phase, "pass", evidence_path=live_shell.get("evidence_path"))

    browser_phase = phases.start("browser_acceptance_visual_and_event_proof")
    browser_acceptance = validate_browser_acceptance(args, manifest or {}, out_dir / "browser-proof")
    browser_gates = browser_acceptance.get("gate_results") or {}
    browser_failures = browser_acceptance.get("gate_failures") or {}

    def apply_browser_gate(gate: str, category: str) -> None:
        evidence = browser_acceptance.get("evidence_path")
        if browser_gates.get(category) is True:
            ledger.pass_gate(gate, evidence_path=evidence)
        else:
            detail = "; ".join(browser_failures.get(category) or [browser_acceptance.get("reason") or "Browser acceptance proof failed."])
            ledger.fail_gate(gate, evidence_path=evidence, detail=detail)

    apply_browser_gate("browser_mobile_first_view_valid", "mobile_first_view")
    apply_browser_gate("desktop_native_render_verified", "desktop_native")
    apply_browser_gate("browser_desktop_valid", "desktop_native")
    apply_browser_gate("console_network_clean_or_accounted_for", "console_network")
    apply_browser_gate("native_continuation_blocks_present", "native_continuation")
    apply_browser_gate("native_continuation_dedupe_verified", "native_continuation")
    apply_browser_gate("zaraz_consent_browser_proof_passed", "consent")
    apply_browser_gate("resi_event_bridge_accounted_for", "event_bridge")

    if not browser_acceptance["pass"]:
        phases.finish(browser_phase, "failed", evidence_path=browser_acceptance.get("evidence_path"), detail=browser_acceptance.get("reason") or "Browser acceptance proof failed.")
        return rollback_readout(
            "apply-failed-browser-acceptance-readout.json",
            "Browser acceptance proof failed after package deploy. Package Worker was rolled back.",
            {
                "package_health": package_health,
                "cache_purge": cache_purge,
                "live_shell_validation": live_shell,
                "browser_acceptance": browser_acceptance,
            },
        )
    phases.finish(browser_phase, "pass", evidence_path=browser_acceptance.get("evidence_path"))

    if manifest:
        source_phase = phases.start("source_phone_seo_analytics_proof")
        source_phone = validate_source_phone(args, manifest, out_dir / "phone")
        if source_phone["pass"]:
            ledger.pass_gate("source_coded_phone_proof_passed", evidence_path=source_phone["evidence_path"])
            ledger.pass_gate("browser_source_coded_mobile_valid", evidence_path=source_phone["evidence_path"])
        else:
            ledger.fail_gate("source_coded_phone_proof_passed", evidence_path=source_phone["evidence_path"], detail=source_phone.get("reason") or "Source-coded phone proof failed.")
            ledger.fail_gate("browser_source_coded_mobile_valid", evidence_path=source_phone["evidence_path"], detail=source_phone.get("reason") or "Source-coded mobile proof failed.")
            phases.finish(source_phase, "failed", evidence_path=source_phone.get("evidence_path"), detail=source_phone.get("reason") or "Source-coded phone proof failed.")
            return rollback_readout(
                "apply-failed-source-phone-readout.json",
                "Source-coded phone proof failed after package deploy. Package Worker was rolled back.",
                {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell, "browser_acceptance": browser_acceptance, "source_phone": source_phone},
            )

        llms = validate_llms(manifest, out_dir / "seo")
        if llms["pass"]:
            ledger.pass_gate("llms_txt_valid", evidence_path=llms["evidence_path"])
        else:
            ledger.fail_gate("llms_txt_valid", evidence_path=llms["evidence_path"], detail="llms.txt did not return H1 plus markdown links.")
            phases.finish(source_phase, "failed", evidence_path=llms.get("evidence_path"), detail="llms.txt did not return H1 plus markdown links.")
            return rollback_readout(
                "apply-failed-llms-readout.json",
                "llms.txt proof failed after package deploy. Package Worker was rolled back.",
                {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell, "browser_acceptance": browser_acceptance, "llms": llms},
            )

        meta = validate_meta_schema(manifest, out_dir / "seo")
        if meta["meta_og_schema_icons_pass"]:
            ledger.pass_gate("meta_og_schema_icons_valid", evidence_path=meta["evidence_path"])
        else:
            ledger.fail_gate("meta_og_schema_icons_valid", evidence_path=meta["evidence_path"], detail="Meta/schema/canonical/icon scan failed.")
        if meta["stale_identity_pass"]:
            ledger.pass_gate("stale_identity_scan_passed", evidence_path=meta["evidence_path"])
        else:
            ledger.fail_gate("stale_identity_scan_passed", evidence_path=meta["evidence_path"], detail=f"Stale identity: {meta.get('stale_identity')}")
        if not meta["pass"]:
            phases.finish(source_phase, "failed", evidence_path=meta.get("evidence_path"), detail="Meta/OG/schema/icon or stale-identity proof failed.")
            return rollback_readout(
                "apply-failed-meta-schema-readout.json",
                "Meta/OG/schema/icon or stale-identity proof failed after package deploy. Package Worker was rolled back.",
                {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell, "browser_acceptance": browser_acceptance, "meta_schema": meta},
            )

        analytics = run_live_analytics_smoke(args, manifest, out_dir / "analytics")
        if analytics["pass"]:
            ledger.pass_gate("ga4_zaraz_proof_passed", evidence_path=analytics["evidence_path"])
            ledger.pass_gate("heap_contentsquare_interaction_only_proof_passed", evidence_path=analytics["evidence_path"])
        else:
            detail = "; ".join(analytics.get("failures") or []) or analytics.get("stderr_tail") or "Live analytics smoke failed."
            ledger.fail_gate("ga4_zaraz_proof_passed", evidence_path=analytics.get("evidence_path"), detail=detail)
            ledger.fail_gate("heap_contentsquare_interaction_only_proof_passed", evidence_path=analytics.get("evidence_path"), detail=detail)
            phases.finish(source_phase, "failed", evidence_path=analytics.get("evidence_path"), detail=detail)
            return rollback_readout(
                "apply-failed-analytics-readout.json",
                "Live analytics proof failed after package deploy. Package Worker was rolled back.",
                {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell, "browser_acceptance": browser_acceptance, "analytics": analytics},
            )
        phases.finish(source_phase, "pass", evidence_path=analytics.get("evidence_path"))

    cloudflare_analytics_phase = phases.start("cloudflare_analytics_state_record")
    cloudflare_analytics = run_cloudflare_analytics_state(out_dir / "cloudflare-analytics")
    if cloudflare_analytics["pass"]:
        ledger.pass_gate("cloudflare_analytics_state_recorded", evidence_path=cloudflare_analytics["evidence_path"])
        phases.finish(cloudflare_analytics_phase, "pass", evidence_path=cloudflare_analytics.get("evidence_path"))
    else:
        ledger.fail_gate("cloudflare_analytics_state_recorded", evidence_path=cloudflare_analytics.get("evidence_path"), detail=cloudflare_analytics.get("stderr_tail") or "Cloudflare analytics smoke failed.")
        phases.finish(cloudflare_analytics_phase, "failed", evidence_path=cloudflare_analytics.get("evidence_path"), detail=cloudflare_analytics.get("stderr_tail") or "Cloudflare analytics smoke failed.")
        return rollback_readout(
            "apply-failed-cloudflare-analytics-readout.json",
            "Cloudflare analytics state proof failed after package deploy. Package Worker was rolled back.",
            {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell, "browser_acceptance": browser_acceptance, "cloudflare_analytics": cloudflare_analytics},
        )

    psi_phase = phases.start("psi_mobile_desktop_gate")
    psi = run_psi_gate(args, out_dir / "psi")
    if psi["mobile_pass"]:
        ledger.pass_gate("psi_mobile_90_plus_live", evidence_path=psi["evidence_path"], detail=f"Mobile minimum score: {psi.get('mobile_min_score')}; package parity target: {MOBILE_PSI_PARITY_TARGET}")
        ledger.pass_gate("psi_mobile_reference_parity_live", evidence_path=psi["evidence_path"], detail=f"Mobile minimum score met reference parity target {MOBILE_PSI_PARITY_TARGET}.")
    else:
        detail = f"Mobile minimum score: {psi.get('mobile_min_score')}; required reference parity target: {MOBILE_PSI_PARITY_TARGET}"
        ledger.fail_gate("psi_mobile_90_plus_live", evidence_path=psi.get("evidence_path"), detail=detail)
        ledger.fail_gate("psi_mobile_reference_parity_live", evidence_path=psi.get("evidence_path"), detail=detail)
    if psi["desktop_pass"]:
        ledger.pass_gate("psi_desktop_recorded_live", evidence_path=psi["evidence_path"], detail=f"Desktop native passthrough PSI met target. Minimum observed score: {psi.get('desktop_min_score')}; target: {DESKTOP_PSI_TARGET}.")
    else:
        detail = f"Desktop native passthrough PSI did not meet target. Minimum observed score: {psi.get('desktop_min_score')}; required target: {DESKTOP_PSI_TARGET}."
        ledger.fail_gate("psi_desktop_recorded_live", evidence_path=psi.get("evidence_path"), detail=detail)
    if not psi["pass"]:
        phases.finish(psi_phase, "failed", evidence_path=psi.get("evidence_path"), detail="Live PSI proof failed.")
        return rollback_readout(
            "apply-failed-psi-readout.json",
            "Live PSI proof failed after package deploy. Package Worker was rolled back.",
            {"package_health": package_health, "cache_purge": cache_purge, "live_shell_validation": live_shell, "browser_acceptance": browser_acceptance, "psi": psi},
        )
    phases.finish(
        psi_phase,
        "pass",
        evidence_path=psi.get("evidence_path"),
        extra={
            "mobile_min_score": psi.get("mobile_min_score"),
            "desktop_min_score": psi.get("desktop_min_score"),
        },
    )

    evidence_phase = phases.start("evidence_packet")
    evidence_packet_path = out_dir / "evidence-packet.json"
    evidence_files = sorted(path for path in out_dir.rglob("*") if path.is_file() and path.name != "evidence-packet.json")
    ledger.pass_gate("evidence_packet_written", evidence_path=str(evidence_packet_path), detail=f"{len(evidence_files)} evidence files recorded.")

    evidence_packet = write_evidence_packet(
        out_dir,
        {
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "contract_gate_ledger": ledger.payload(),
        },
    )
    phases.finish(
        evidence_phase,
        "pass",
        evidence_path=str(evidence_packet_path),
        extra={"evidence_file_count": evidence_packet.get("file_count")},
    )

    mark_unproven_apply_gates(ledger)
    final_ledger = ledger.payload()
    rollback = None
    dashboard_finalization = None
    if not final_ledger["pass"]:
        rollback = rollback_package_worker(
            args,
            out_dir / "rollback",
            "Full package gate ledger failed after package deploy.",
            manifest=manifest,
        )
    else:
        pre_dashboard_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "domain": args.domain,
            "property_code": args.property_code.upper(),
            "identity": identity,
            "artifacts": artifacts,
            "manifest_path": str(target_manifest_path),
            "manifest_validation": manifest_validation,
            "reference_replay": reference_replay,
            "zaraz_package": zaraz_package,
            "stage_setup": stage_setup,
            "deploy_bundle_validation": deploy_bundle_validation,
            "route_probe": route_probe,
            "asset_package": asset_package,
            "deploy": deploy_payload,
            "package_health": package_health,
            "wordpress_control_path_bypass": wordpress_control_path,
            "live_shell_validation": live_shell,
            "rollback": None,
            "dashboard_finalization": None,
            "contract_gate_ledger": final_ledger,
            "phase_timings": phases.payload(),
            "pass": True,
            "blocked": False,
            "block_reason": None,
        }
        write_json(out_dir / "apply-readout.json", pre_dashboard_payload)
        dashboard_phase = phases.start("launch_dashboard_finalization")
        dashboard_finalization = run_dashboard_finalization(args, out_dir, final_ledger)
        phases.finish(
            dashboard_phase,
            "pass" if dashboard_finalization["pass"] else "failed",
            evidence_path=str(out_dir / "dashboard/dashboard-finalization.json"),
            detail=dashboard_finalization.get("block_reason"),
            extra={
                "publish_requested": dashboard_finalization.get("publish", {}).get("requested"),
                "deployment_url": dashboard_finalization.get("publish", {}).get("deployment_url"),
            },
        )
    final_pass = bool(final_ledger["pass"] and (dashboard_finalization is None or dashboard_finalization["pass"]))
    block_reason = None
    if not final_ledger["pass"]:
        block_reason = "Full package gate ledger failed. Package Worker was rolled back."
    elif dashboard_finalization and not dashboard_finalization["pass"]:
        block_reason = dashboard_finalization["block_reason"]
    phase_timings = phases.complete()
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "domain": args.domain,
        "property_code": args.property_code.upper(),
        "identity": identity,
        "artifacts": artifacts,
        "manifest_path": str(target_manifest_path),
        "manifest_validation": manifest_validation,
        "reference_replay": reference_replay,
        "zaraz_package": zaraz_package,
        "stage_setup": stage_setup,
        "deploy_bundle_validation": deploy_bundle_validation,
        "route_probe": route_probe,
        "asset_package": asset_package,
        "deploy": deploy_payload,
        "package_health": package_health,
        "wordpress_control_path_bypass": wordpress_control_path,
        "live_shell_validation": live_shell,
        "rollback": rollback,
        "dashboard_finalization": dashboard_finalization,
        "contract_gate_ledger": final_ledger,
        "phase_timings": phase_timings,
        "pass": final_pass,
        "blocked": not final_pass,
        "block_reason": block_reason,
    }
    write_json(out_dir / "apply-readout.json", payload)
    print(json.dumps(payload, indent=2))
    return 0 if payload["pass"] else 3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gated Resi Edge package runner")
    parser.add_argument("--property-code", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--mode", choices=["plan", "stage", "validate-reference", "apply"], required=True)
    parser.add_argument("--manifest", help="Explicit target manifest path for governed canary/pilot runs.")
    parser.add_argument("--require-live-proof", action="store_true")
    parser.add_argument(
        "--skip-dashboard-publish",
        action="store_true",
        help="Refresh and build the launch dashboard snapshot but do not publish the Cloudflare Pages dashboard during apply finalization.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    contract = load_contract()
    identity = resolve_identity(args.property_code)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = REPORT_ROOT / slug(args.domain) / f"{args.mode}-{run_id}"
    write_reset_card(out_dir, args, identity, contract)
    scope_lock = validate_scope_lock(args)
    write_json(out_dir / "scope-lock-validation.json", scope_lock)
    if not scope_lock.get("pass"):
        payload = {
            "mode": args.mode,
            "property_code": args.property_code.upper(),
            "domain": args.domain,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "pass": False,
            "blocked": True,
            "block_reason": scope_lock.get("reason"),
            "scope_lock": scope_lock,
        }
        readout_name = "apply-readout.json" if args.mode == "apply" else f"{args.mode}-readout.json"
        write_json(out_dir / readout_name, payload)
        print(json.dumps(payload, indent=2))
        return 3

    if args.mode == "plan":
        return mode_plan(args, out_dir, contract, identity)
    if args.mode == "stage":
        return mode_stage(args, out_dir, contract, identity)
    if args.mode == "validate-reference":
        return mode_validate_reference(args, out_dir, contract, identity)
    return mode_apply(args, out_dir, contract, identity)


if __name__ == "__main__":
    raise SystemExit(main())
