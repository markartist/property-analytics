#!/usr/bin/env python3
"""Read-only scenario audit for the Resi Edge rollout process.

The point of this audit is not to validate one happy-path manifest. It proves
the promoted manifest and runner guardrails reject the common drift states that
have caused rollout friction before any stage/apply work is allowed.
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

REPO_ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = REPO_ROOT / "scripts/run_resi_edge_upgrade.py"
STATIC_VALIDATOR_PATH = REPO_ROOT / "scripts/validate_resi_edge_package_static.mjs"
CONTRACT_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-edge-package/contract.json"
WORKER_PATH = REPO_ROOT / "ops/cloudflare/resi-edge-canonical-worker/worker.js"


def load_runner() -> Any:
    spec = importlib.util.spec_from_file_location("resi_edge_runner_for_process_audit", RUNNER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import runner from {RUNNER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def get_path(data: dict[str, Any], dotted: str) -> Any:
    current: Any = data
    for part in dotted.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def set_path(data: dict[str, Any], dotted: str, value: Any) -> None:
    current: Any = data
    parts = dotted.split(".")
    for part in parts[:-1]:
        if not isinstance(current.get(part), dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def delete_path(data: dict[str, Any], dotted: str) -> None:
    current: Any = data
    parts = dotted.split(".")
    for part in parts[:-1]:
        if not isinstance(current, dict):
            return
        current = current.get(part)
    if isinstance(current, dict):
        current.pop(parts[-1], None)


def mutate_nav_links(manifest: dict[str, Any], label_to_remove: str | None = None, url_override: str | None = None) -> None:
    links = get_path(manifest, "mobile_shell.navigation.links") or []
    if label_to_remove:
        links = [link for link in links if not (isinstance(link, dict) and link.get("label") == label_to_remove)]
    if url_override and links and isinstance(links[0], dict):
        links[0]["url"] = url_override
    set_path(manifest, "mobile_shell.navigation.links", links)


def mutate_first_font_url(manifest: dict[str, Any], url: str) -> None:
    fonts = get_path(manifest, "mobile_shell.fonts") or []
    if fonts and isinstance(fonts[0], dict):
        fonts[0]["url"] = url
    set_path(manifest, "mobile_shell.fonts", fonts)


def scenario(name: str, expected: str, mutate: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
    return {"name": name, "expected_failure": expected, "mutate": mutate}


def run_manifest_validation(
    runner: Any,
    manifest: dict[str, Any],
    *,
    property_code: str,
    domain: str,
    identity: dict[str, Any] | None,
) -> dict[str, Any]:
    args = argparse.Namespace(property_code=property_code.upper(), domain=domain, mode="process-audit")
    return runner.validate_manifest(manifest, args, identity)


def build_scenarios(property_code: str) -> list[dict[str, Any]]:
    scenarios = [
        scenario("draft_stage_retained", "promoted manifest must not retain draft-only field", lambda m: m.update({"manifest_stage": "draft"})),
        scenario("draft_notice_retained", "promoted manifest must not retain draft-only field", lambda m: m.update({"draft_notice": "not promoted"})),
        scenario("pending_required_value", "manifest field is still pending before apply", lambda m: set_path(m, "mobile_shell.hero.headline", "required_before_apply")),
        scenario("stale_consent_version", "consent.widget_version must be", lambda m: set_path(m, "consent.widget_version", "compact_finalized_pill_v27_2026_08_12")),
        scenario("ga4_status_not_configured_or_zaraz", "analytics.ga4.measurement_id_status must declare a configured/Zaraz-owned state", lambda m: set_path(m, "analytics.ga4.measurement_id_status", "default_uri_ready_no_ga4_url_change_needed_08_17_2026")),
        scenario("ga4_status_wordpress_owned", "analytics.ga4.measurement_id_status must not declare WordPress ownership", lambda m: set_path(m, "analytics.ga4.measurement_id_status", "configured_direct_wordpress_load")),
        scenario("missing_ga4_stream_name", "missing required manifest field: analytics.ga4.expected_stream_name", lambda m: delete_path(m, "analytics.ga4.expected_stream_name")),
        scenario("wrong_heap_id", "analytics.heap.app_id must be production Heap app id", lambda m: set_path(m, "analytics.heap.app_id", "676880719")),
        scenario("wrong_heap_mode", "analytics.heap.mode must be", lambda m: set_path(m, "analytics.heap.mode", "passive_timer_dev_mode")),
        scenario("heap_passive_timer_allowed", "analytics.heap.passive_timer_allowed must be false", lambda m: set_path(m, "analytics.heap.passive_timer_allowed", True)),
        scenario("incomplete_drawer_nav_reviews_missing", "mobile_shell.navigation.links missing required labels", lambda m: mutate_nav_links(m, "Reviews")),
        scenario("placeholder_nav_url", "must not use placeholder/script URLs", lambda m: mutate_nav_links(m, None, "#")),
        scenario("script_nav_url", "must not use placeholder/script URLs", lambda m: mutate_nav_links(m, None, "javascript:void(0)")),
        scenario("bad_tour_url", "mobile_shell.navigation.tour_url must use the canonical online.venterraliving.com leasing URL", lambda m: set_path(m, "mobile_shell.navigation.tour_url", "https://example.com/tour")),
        scenario("bad_apply_url", "mobile_shell.navigation.apply_url must use the canonical online.venterraliving.com leasing URL", lambda m: set_path(m, "mobile_shell.navigation.apply_url", "https://example.com/apply")),
        scenario("ahrefs_project_missing", "analytics.ahrefs.existing_project_id must be a numeric verified vanity project id", lambda m: set_path(m, "analytics.ahrefs.existing_project_id", "required_before_apply")),
        scenario("ahrefs_unverified", "analytics.ahrefs.verified must be true before plan/stage/apply", lambda m: set_path(m, "analytics.ahrefs.verified", False)),
        scenario("rollback_wordpress_mutation_boundary_missing", "rollback.no_wordpress_mutation_required must be true", lambda m: set_path(m, "rollback.no_wordpress_mutation_required", False)),
        scenario("rollback_script_state_missing", "rollback.previous_worker_script must be recorded", lambda m: set_path(m, "rollback.previous_worker_script", "required_before_apply")),
        scenario("desktop_topper_allowed", "mobile_shell.layout_contract.desktop_topper_allowed must be false", lambda m: set_path(m, "mobile_shell.layout_contract.desktop_topper_allowed", True)),
        scenario("property_specific_variant_allowed", "mobile_shell.layout_contract.property_specific_variants_allowed must be false", lambda m: set_path(m, "mobile_shell.layout_contract.property_specific_variants_allowed", True)),
        scenario("wrong_phone_default_source", "phone_attribution.default_source must be VWS", lambda m: set_path(m, "phone_attribution.default_source", "ILS")),
        scenario("content_blocks_missing", "mobile_shell.content_blocks must include at least two blocks", lambda m: set_path(m, "mobile_shell.content_blocks", (get_path(m, "mobile_shell.content_blocks") or [])[:1])),
        scenario("hero_asset_not_same_origin_avif", "mobile_shell.hero.image_mobile must be a same-origin optimized AVIF asset", lambda m: set_path(m, "mobile_shell.hero.image_mobile", "https://assets.example.com/hero.jpg")),
        scenario("font_asset_not_same_origin", "mobile_shell.fonts[1].url must be a same-origin Resi theme font path", lambda m: mutate_first_font_url(m, "https://example.kinsta.cloud/wp-content/themes/resi-child-theme/fonts/lato-regular.woff2")),
    ]
    if property_code.upper() not in {"TX4EK", "TX4FC"}:
        scenarios.append(
            scenario(
                "generic_ga4_stream_name",
                "analytics.ga4.expected_stream_name must be the property stream name",
                lambda m: set_path(m, "analytics.ga4.expected_stream_name", "Website"),
            )
        )
    return scenarios


def check_source_invariants() -> list[dict[str, Any]]:
    files = {
        "runner": RUNNER_PATH.read_text(),
        "static_validator": STATIC_VALIDATOR_PATH.read_text(),
        "contract": CONTRACT_PATH.read_text(),
        "worker": WORKER_PATH.read_text(),
    }
    worker = files["worker"]
    control_index = worker.find("if (isTargetHost(url) && isWordPressControlRequest(request, url))")
    shell_index = worker.find("if (isHomepage(url) && isMobileRequest(request))")
    control_before_shell = control_index >= 0 and shell_index >= 0 and control_index < shell_index
    checks = [
        ("runner_requires_live_proof_for_apply", "if not args.require_live_proof" in files["runner"] and "Apply requires --require-live-proof" in files["runner"]),
        ("runner_blocks_stage_before_mutation_on_preflight_failure", "Stage preflight failed. No asset upload, Zaraz setup, route probe, or Worker deploy was attempted." in files["runner"]),
        ("runner_blocks_apply_setup_before_route_or_deploy", "No route probe or Worker deploy was attempted." in files["runner"]),
        ("runner_requires_wordpress_control_path_bypass_proof", "wordpress_control_path_bypass_proven" in files["runner"]),
        ("runner_records_phase_timings", "class PhaseRecorder" in files["runner"] and "phase-timings.json" in files["runner"] and "phase_timings" in files["runner"]),
        ("runner_finalizes_launch_dashboard_after_apply", "run_dashboard_finalization" in files["runner"] and "dashboard-finalization.json" in files["runner"] and "Stop before the next property" in files["runner"]),
        ("runner_uses_promoted_manifest_drift_guard", "promoted manifest must not retain draft-only field" in files["runner"]),
        ("static_validator_protects_promoted_manifest_drift_guard", "promoted-manifest drift guard" in files["static_validator"]),
        ("contract_keeps_no_desktop_topper", '"desktop_topper_allowed": false' in files["contract"]),
        ("contract_keeps_no_property_variants", '"property_specific_variants_allowed": false' in files["contract"]),
        ("contract_keeps_no_continue_after_failed_gate", '"continue_after_failed_gate": false' in files["contract"]),
        ("worker_imports_canonical_runtime", "../shared/resi-edge-package/runtime.mjs" in files["worker"]),
        (
            "worker_has_control_path_bypass_support",
            "function isWordPressControlRequest" in worker
            and "/wp-login.php" in worker
            and "/wp-admin/" in worker
            and "/wp-json/" in worker
            and "fetchOriginTransparent" in worker,
        ),
        ("worker_checks_control_paths_before_mobile_shell", control_before_shell),
    ]
    return [{"name": name, "pass": bool(passed)} for name, passed in checks]


def render_markdown(payload: dict[str, Any]) -> str:
    status = "PASS" if payload["pass"] else "FAIL"
    generated_label = payload["generated_at"]
    try:
        generated_dt = datetime.fromisoformat(generated_label)
        generated_label = generated_dt.strftime("%m/%d/%Y %-I:%M %p UTC")
    except ValueError:
        pass
    lines = [
        f"# Resi Edge Process Scenario Audit - {status}",
        "",
        f"- Generated: {generated_label}",
        f"- Property: {payload['property_code']} / {payload['domain']}",
        f"- Manifest: `{payload['manifest_path']}`",
        f"- External mutation: `{payload['external_mutation']}`",
        f"- Baseline manifest validation: `{'pass' if payload['baseline_validation']['pass'] else 'fail'}`",
        f"- Scenario checks: `{payload['summary']['scenario_passed']}/{payload['summary']['scenario_total']}`",
        f"- Source invariants: `{payload['summary']['invariant_passed']}/{payload['summary']['invariant_total']}`",
        "",
        "## Failed Checks",
    ]
    failures = [row for row in payload["scenario_results"] if not row["pass"]]
    failures.extend(row for row in payload["source_invariants"] if not row["pass"])
    if not failures:
        lines.append("- None")
    else:
        for failure in failures:
            lines.append(f"- {failure['name']}: {failure.get('reason') or 'failed'}")
    lines.append("")
    lines.append("## Guarded Scenarios")
    for row in payload["scenario_results"]:
        mark = "PASS" if row["pass"] else "FAIL"
        lines.append(f"- {mark}: {row['name']}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit known Resi Edge rollout process drift scenarios.")
    parser.add_argument("--property-code", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.is_absolute():
        manifest_path = REPO_ROOT / manifest_path
    manifest = load_json(manifest_path)
    runner = load_runner()
    identity = runner.resolve_identity(args.property_code)

    baseline = run_manifest_validation(
        runner,
        manifest,
        property_code=args.property_code,
        domain=args.domain,
        identity=identity,
    )

    scenario_results: list[dict[str, Any]] = []
    if baseline["pass"]:
        for row in build_scenarios(args.property_code):
            candidate = copy.deepcopy(manifest)
            row["mutate"](candidate)
            result = run_manifest_validation(
                runner,
                candidate,
                property_code=args.property_code,
                domain=args.domain,
                identity=identity,
            )
            failures = result.get("failures") or []
            matched = any(row["expected_failure"] in failure for failure in failures)
            passed = bool(not result["pass"] and matched)
            scenario_results.append(
                {
                    "name": row["name"],
                    "pass": passed,
                    "expected_failure": row["expected_failure"],
                    "observed_pass": bool(result["pass"]),
                    "observed_failures": failures,
                    "reason": None if passed else "scenario was not blocked by the expected guard",
                }
            )

    source_invariants = check_source_invariants()
    summary = {
        "scenario_total": len(scenario_results),
        "scenario_passed": sum(1 for row in scenario_results if row["pass"]),
        "invariant_total": len(source_invariants),
        "invariant_passed": sum(1 for row in source_invariants if row["pass"]),
    }
    payload = {
        "schema": "resi_edge_process_scenario_audit_v1",
        "generated_at": utc_now(),
        "property_code": args.property_code.upper(),
        "domain": args.domain,
        "manifest_path": str(manifest_path),
        "external_mutation": False,
        "baseline_validation": baseline,
        "scenario_results": scenario_results,
        "source_invariants": source_invariants,
        "summary": summary,
        "pass": bool(
            baseline["pass"]
            and scenario_results
            and summary["scenario_total"] == summary["scenario_passed"]
            and summary["invariant_total"] == summary["invariant_passed"]
        ),
    }

    if args.out:
        out_dir = Path(args.out)
        if not out_dir.is_absolute():
            out_dir = REPO_ROOT / out_dir
        write_json(out_dir / "process-audit.json", payload)
        (out_dir / "PROCESS_AUDIT_READOUT.md").write_text(render_markdown(payload))

    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if payload["pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
