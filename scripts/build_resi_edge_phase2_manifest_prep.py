#!/usr/bin/env python3
"""Build non-mutating Resi Edge phase manifest prep drafts.

This script creates report-scoped manifest drafts and a gap report for a rollout
phase. Drafts are intentionally not written to the active manifest directory.
They must not be used for live apply until source gaps are resolved, promoted by
explicit approval, and validated by the canonical runner.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from Data_Collection.utils.property_identity import resolve_property_identity
from build_resi_edge_phase2_preflight import (
    CONTRACT_PATH,
    DEFAULT_QA_DOCX,
    DEFAULT_ROLLOUT_WORKBOOK,
    latest_cloudflare_inventory_path,
    load_cloudflare_zones,
    load_qa_rows,
    load_rollout_rows,
    manifest_candidates,
    normalize_domain,
    resolve_input_path,
)


REPORT_ROOT = REPO_ROOT / "reports/resi_edge_performance/phase2-manifest-prep"
SOURCE_LOOKUP_PATH = REPO_ROOT / "reports/resi_source_lookup/latest-resi-source-lookup.kv.json"
GOOGLE_LANDSCAPE_AUDIT = REPO_ROOT / "reports/google_landscape_audit/20260629T202537Z/google_landscape_audit.json"
LOCAL_TZ = ZoneInfo("America/Chicago")
PENDING = "required_before_apply"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def load_source_lookup(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    payload = read_json(path)
    return payload if isinstance(payload, dict) else {}


def load_ga4_measurement_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    payload = read_json(path)
    streams = (((payload.get("ga4") or {}).get("data_streams")) or []) if isinstance(payload, dict) else []
    output: dict[str, str] = {}
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        web = stream.get("webStreamData") if isinstance(stream.get("webStreamData"), dict) else None
        measurement_id = (web or {}).get("measurementId")
        prop = str(stream.get("property") or "")
        if not prop.startswith("properties/") or not measurement_id:
            continue
        output[prop.split("/", 1)[1]] = str(measurement_id)
    return output


def source_lookup_rows(source_lookup: dict[str, Any], property_code: str) -> tuple[str | None, list[dict[str, str]]]:
    by_property = source_lookup.get("byProperty") if isinstance(source_lookup.get("byProperty"), dict) else {}
    record = by_property.get(property_code) if isinstance(by_property, dict) else None
    if not isinstance(record, dict):
        return None, []
    default_tracking = str(record.get("defaultTrackingId") or "")
    sources = record.get("sources") if isinstance(record.get("sources"), dict) else {}
    default_record = sources.get(default_tracking) if isinstance(sources, dict) else None
    default_phone = (default_record or {}).get("phone") or record.get("fallbackPhone")
    rows = []
    for key in sorted(sources):
        item = sources[key]
        if not isinstance(item, dict):
            continue
        phone = item.get("phone") or item.get("fallbackPhone")
        if not phone:
            continue
        rows.append(
            {
                "code": str(item.get("trackingId") or key),
                "source": str(item.get("marketingSourceCd") or ""),
                "phone": str(phone),
            }
        )
    return str(default_phone) if default_phone else None, rows


def expected_asset_path(property_code: str, name: str) -> str:
    return f"/assets/resi-edge-assets/{property_code}/home/{name}.avif"


def zaraz_short_code(property_code: str) -> str:
    return property_code[-2:] if len(property_code) >= 2 else property_code


def build_draft_manifest(
    *,
    row: Any,
    staging_url: str,
    measurement_id: str | None,
    default_phone: str | None,
    source_rows: list[dict[str, str]],
    generated_at_human: str,
) -> dict[str, Any]:
    identity = resolve_property_identity(row.property_code or "")
    if identity is None:
        raise ValueError(f"identity did not resolve for {row.property_code}")
    domain = row.vanity_domain
    property_code = identity.property_code or row.property_code or ""
    canonical_url = f"https://{domain}/"
    gsc_property = f"sc-domain:{domain}"
    measurement = measurement_id or "G-REQUIREDBEFOREAPPLY"
    source_image_placeholder = staging_url or canonical_url
    short_code = zaraz_short_code(property_code)

    return {
        "schema_version": "resi_edge_manifest_v1",
        "package_contract_id": "resi-edge-canonical-upgrade-package",
        "manifest_stage": "draft_not_applyable",
        "draft_notice": (
            "Generated for Phase 2 preparation only. Do not move this draft into the active manifest "
            "directory or use it for stage/apply until every required_before_apply field is replaced "
            "with sourced evidence and Mark explicitly approves promotion."
        ),
        "draft_generated_at": generated_at_human,
        "target": {
            "property_code": property_code,
            "source_property_code": property_code,
            "domain": domain,
            "property_name": identity.property_name,
            "city": identity.city or PENDING,
            "state": identity.state or PENDING,
            "community_id": identity.community_id or PENDING,
            "ga4_property_id": str(identity.ga4_property_id or PENDING),
            "ga4_measurement_id": measurement,
            "gsc_property": gsc_property,
            "canonical_url": canonical_url,
            "governed_reference_url": identity.website_url,
            "staging_kinsta_url": staging_url,
        },
        "routing": {
            "cloudflare_zone_name": domain,
            "route_pattern": f"{domain}/*",
            "existing_worker_script": "not_yet_assigned_in_governed_package",
            "mutation_policy": "selected_target_no_live_mutation_without_explicit_approval_and_all_gates_green",
            "wordpress_control_path_policy": "transparent_no_cache_bypass_required",
        },
        "mobile_shell": {
            "layout_contract": {
                "source_reference": f"{identity.property_name} Phase 2 draft from rollout matrix and Kinsta staging URL, generated {generated_at_human}",
                "mobile_only": True,
                "desktop_topper_allowed": False,
                "property_specific_variants_allowed": False,
                "standalone_edge_owned_initial_response_required": True,
                "promo_bar_height_px": 60,
                "header_height_px": 80,
                "full_height_mobile_hero_required": True,
                "native_wordpress_runtime_in_initial_mobile_html_allowed": False,
                "native_dam_image_references_in_initial_mobile_html_allowed": False,
            },
            "brand_theme": {
                "source": PENDING,
                "promo_background": "#15284B",
                "promo_text": "#FFFFFF",
                "promo_surface": "#F6F6F5",
                "promo_panel_text": "#15284B",
                "primary_text": "#15284B",
                "button_background": "#FFFFFF",
                "button_text": "#15284B",
                "drawer_background": "#15284B",
                "drawer_text": "#FFFFFF",
                "hero_background": "#15284B",
                "hero_overlay": "rgba(21,40,75,.38)",
                "body_text": "#15284B",
                "panel_background": "#F6F6F5",
            },
            "fonts": [
                {
                    "family": "Lato",
                    "url": f"https://{normalize_domain(staging_url)}/wp-content/themes/resi-child-theme/fonts/lato-regular.woff2",
                    "weight": 400,
                    "style": "normal",
                }
            ],
            "body_font": "Lato",
            "heading_font": "Noto Serif",
            "awards": {
                "present": False,
                "source": PENDING,
                "assets": [],
            },
            "promo": {
                "present": False,
                "source": PENDING,
            },
            "hero": {
                "image_mobile": expected_asset_path(property_code, "hero-mobile-750x1000"),
                "source_image": source_image_placeholder,
                "tm_allowed": False,
                "headline": PENDING,
                "primary_cta_label": "Find Your Home",
                "primary_cta_url": f"{canonical_url}apartments/",
                "title_text": "Live Better. Live Easy.",
            },
            "reviews": {
                "present": False,
                "source": PENDING,
                "last_verified": PENDING,
                "fractional_stars_required": True,
                "full_star_rounding_allowed": False,
                "link_required": False,
            },
            "navigation": {
                "tour_url": f"https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/{property_code}",
                "apply_url": f"https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/{property_code}",
                "links": [
                    {"label": "Apartments & Pricing", "url": f"{canonical_url}apartments/"},
                    {"label": "Features", "url": f"{canonical_url}features/"},
                    {"label": "Amenities", "url": f"{canonical_url}amenities/"},
                    {"label": "Gallery", "url": f"{canonical_url}gallery/"},
                    {"label": "Location", "url": f"{canonical_url}neighborhood/"},
                    {"label": "Contact", "url": f"{canonical_url}contact/"},
                ],
            },
            "content_blocks": [
                {
                    "sequence": 1,
                    "kind": "welcome",
                    "heading": PENDING,
                    "body": PENDING,
                    "cta_label": "See Available Homes",
                    "cta_url": f"{canonical_url}apartments/",
                    "image_url": expected_asset_path(property_code, "welcome-640"),
                    "source_image_url": source_image_placeholder,
                    "image_alt": PENDING,
                },
                {
                    "sequence": 2,
                    "kind": "features",
                    "heading": PENDING,
                    "body": PENDING,
                    "bullets": [PENDING],
                    "cta_label": "See Features",
                    "cta_url": f"{canonical_url}features/",
                    "image_url": expected_asset_path(property_code, "features-900"),
                    "source_image_url": source_image_placeholder,
                    "image_alt": PENDING,
                },
            ],
            "native_continuation": {
                "required_after_edge_shell": True,
                "dedupe_required": True,
                "first_two_blocks_must_not_repeat": True,
            },
        },
        "desktop": {
            "mode": "native_passthrough_with_analytics_guards",
            "desktop_topper_allowed": False,
            "native_render_required": True,
            "visual_mutation_allowed_without_explicit_approval": False,
        },
        "phone_attribution": {
            "default_source": "VWS",
            "default_display_phone": default_phone or PENDING,
            "office_phone_must_not_be_default": "default display must be the VWS attribution phone from the governed source lookup",
            "lookup_trigger": "incoming URL source/id string",
            "source_lookup": source_rows,
        },
        "analytics": {
            "owner": "cloudflare_zaraz",
            "ga4": {
                "owner": "cloudflare_zaraz",
                "property_id": str(identity.ga4_property_id or PENDING),
                "measurement_id": measurement,
                "measurement_id_status": "configured_in_manifest_pending_zaraz_readback",
                "zaraz_tool_name": f"GA4{short_code}",
            },
            "heap": {
                "owner": "cloudflare_zaraz",
                "app_id": "286627304",
                "mode": "interaction_only_queue_v6_input_only_cs_verify_home_204",
                "passive_timer_allowed": False,
                "contentsquare_verify_guard": {
                    "enabled": True,
                    "endpoint_pattern": "tcvsapi.contentsquare.com/v2/projects/*/verify-installation/auto",
                    "same_origin_path": "/?vtr_cs_verify_suppressed=1",
                    "expected_status": 204,
                },
                "zaraz_tool_name": f"H{short_code}",
            },
            "ahrefs": {
                "owner": "cloudflare_zaraz",
                "project_policy": "lookup_existing_project_before_create",
                "existing_project_id": PENDING,
                "target": f"{domain}/",
                "verified": False,
                "profile_policy": "use_existing_vanity_project_if_present_else_create_new_vanity_project_with_explicit_approval; retain_legacy_venterra_path_project_for_history",
                "zaraz_tool_name": f"AH{short_code}",
            },
            "cloudflare_analytics": {
                "owner": "cloudflare",
                "state_record_required": True,
            },
            "resi_event_bridge": {
                "owner": "worker_or_zaraz_bridge",
                "zaraz_tool_name": f"RB{property_code}",
                "required_events": [
                    "page_view",
                    "find_your_home_click",
                    "schedule_tour_click",
                    "apply_now_click",
                    "phone_click",
                    "menu_open",
                ],
            },
        },
        "consent": {
            "owner": "cloudflare_zaraz_consent",
            "mode": "finalized_cmp_required",
            "purposes": ["analytics", "measurement", "leasing_activity"],
            "required_proofs": [
                "first_visit_ui",
                "accept_behavior",
                "reject_behavior",
                "preferences_behavior",
                "no_pre_consent_leakage",
            ],
            "widget_version": "compact_shell_pill_v28_2026_08_18",
        },
        "seo": {
            "llms_url": f"{canonical_url}llms.txt",
            "sitemap_url": f"{canonical_url}sitemap_index.xml",
            "schema_url_policy": "absolute_current_domain_urls_only",
            "meta_og_policy": "current_property_identity_only",
            "meta_title": identity.property_name,
            "meta_description": PENDING,
            "og_image": source_image_placeholder,
            "stale_identity_scan_required": True,
            "gsc_indexing_record": PENDING,
        },
        "captain": {
            "id": f"{property_code}-captain",
            "evidence_path": PENDING,
            "fresh_update_record": PENDING,
        },
        "concessions": {
            "lease_up_or_newer_property_policy": {
                "reviews": "If no sourced review row exists, set mobile_shell.reviews.present=false, link_required=false, and do not emit aggregateRating.",
                "awards": "If no sourced award exists, set mobile_shell.awards.present=false with empty assets; do not render a placeholder badge.",
                "specials": "If no active feed-backed special exists, set mobile_shell.promo.present=false; do not scrape the Specials page or invent copy.",
                "content_blocks": "First two source-owned content blocks remain mandatory unless an approved exception file names the missing block and replacement source.",
            }
        },
        "evidence": {
            "required_live_proofs": [
                PENDING,
                "reports/resi_source_lookup/latest-resi-source-lookup.kv.json",
            ]
        },
        "rollback": {
            "strategy": "no_live_mutation_yet; before any explicit apply, record existing route/worker state and restore prior route/script if any live proof fails",
            "previous_worker_script": PENDING,
            "no_wordpress_mutation_required": False,
        },
    }


def pending_paths(value: Any, path: str = "") -> list[str]:
    if isinstance(value, dict):
        found: list[str] = []
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            found.extend(pending_paths(child, child_path))
        return found
    if isinstance(value, list):
        found = []
        for index, child in enumerate(value):
            found.extend(pending_paths(child, f"{path}[{index}]"))
        return found
    if isinstance(value, str) and value == PENDING:
        return [path or "<root>"]
    return []


def gap_labels(paths: list[str]) -> list[str]:
    labels = set()
    for path in paths:
        if path.startswith("mobile_shell.hero") or path.startswith("mobile_shell.content_blocks"):
            labels.add("staging source audit for hero/content/assets")
        elif path.startswith("mobile_shell.reviews"):
            labels.add("review row source proof")
        elif path.startswith("mobile_shell.awards"):
            labels.add("award/source concession proof")
        elif path.startswith("mobile_shell.promo"):
            labels.add("feed-backed special/concession proof")
        elif path.startswith("analytics.ahrefs"):
            labels.add("Ahrefs existing profile lookup/readback")
        elif path.startswith("seo.gsc"):
            labels.add("GSC URL Inspection evidence")
        elif path.startswith("captain"):
            labels.add("Captain/Data Pond handoff evidence")
        elif path.startswith("rollback"):
            labels.add("rollback route/worker snapshot")
        elif path.startswith("evidence.required_live_proofs"):
            labels.add("stage/live proof evidence placeholders")
        elif path.startswith("mobile_shell.brand_theme"):
            labels.add("brand/theme token source audit")
        elif path.startswith("phone_attribution"):
            labels.add("source phone attribution lookup")
        elif path.startswith("seo.meta"):
            labels.add("SEO/meta source audit")
        else:
            labels.add(path)
    return sorted(labels)


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    lines = [
        "# Resi Edge Phase 2 Manifest Prep",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Phase: {payload['phase']}",
        f"Go-live target: {payload.get('go_live') or 'not provided'}",
        "",
        "## Summary",
        "",
        f"- total: {summary['total']}",
        f"- draft_manifests_written: {summary['draft_manifests_written']}",
        f"- active_manifest_matches: {summary['active_manifest_matches']}",
        f"- promote_ready_now: {summary['promote_ready_now']}",
        f"- mutations_performed: {payload['mutations_performed']}",
        "",
        "## Draft Queue",
        "",
        "| Property | Code | Domain | Draft | Pending Fields | Main Gaps |",
        "| --- | --- | --- | --- | ---: | --- |",
    ]
    for row in payload["properties"]:
        lines.append(
            "| {property} | `{code}` | `{domain}` | `{draft}` | {count} | {gaps} |".format(
                property=row["property_name"],
                code=row["property_code"],
                domain=row["domain"],
                draft=row["draft_manifest"],
                count=row["pending_field_count"],
                gaps="; ".join(row["gap_labels"]) or "none",
            )
        )
    lines.extend(
        [
            "",
            "## Boundary",
            "",
            "- Drafts are report-scoped and intentionally not active manifests.",
            "- Do not copy drafts into `config/portfolio_resi_edge_stabilization/` until every `required_before_apply` value is replaced with sourced evidence and Mark explicitly approves promotion.",
            "- This packet does not deploy, route, cache, purge, upload R2 assets, change WordPress, configure Zaraz, create Ahrefs profiles, query GSC live, or mutate any live domain.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "phase",
        "property_code",
        "property_name",
        "domain",
        "staging_kinsta_url",
        "draft_manifest",
        "pending_field_count",
        "gap_labels",
        "active_manifest_matches",
        "ga4_measurement_id",
        "default_display_phone",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    **{key: row.get(key) for key in fieldnames},
                    "gap_labels": "; ".join(row.get("gap_labels") or []),
                    "active_manifest_matches": "; ".join(row.get("active_manifest_matches") or []),
                }
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build non-mutating Resi Edge phase manifest prep drafts.")
    parser.add_argument("--phase", type=int, default=2)
    parser.add_argument("--rollout-workbook", type=Path, default=DEFAULT_ROLLOUT_WORKBOOK)
    parser.add_argument("--qa-docx", type=Path, default=DEFAULT_QA_DOCX)
    parser.add_argument("--cloudflare-inventory", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    args = parser.parse_args()

    rollout_rows, phase_dates = load_rollout_rows(args.rollout_workbook, args.phase)
    qa_rows = load_qa_rows(args.qa_docx)
    cloudflare_inventory_path = resolve_input_path(args.cloudflare_inventory) or latest_cloudflare_inventory_path()
    cloudflare_zones = load_cloudflare_zones(cloudflare_inventory_path)
    source_lookup = load_source_lookup(SOURCE_LOOKUP_PATH)
    measurement_map = load_ga4_measurement_map(GOOGLE_LANDSCAPE_AUDIT)
    contract = read_json(CONTRACT_PATH)

    generated_at = datetime.now(timezone.utc)
    stamp = generated_at.strftime("%Y%m%dT%H%M%SZ")
    generated_at_human = generated_at.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")
    output_dir = args.output_dir or REPORT_ROOT / f"phase-{args.phase}-manifest-prep-{stamp}"
    if not output_dir.is_absolute():
        output_dir = REPO_ROOT / output_dir
    draft_dir = output_dir / "draft-manifests"
    draft_dir.mkdir(parents=True, exist_ok=True)

    properties: list[dict[str, Any]] = []
    for row in rollout_rows:
        if not row.property_code:
            continue
        qa = qa_rows.get(row.property_code) or {}
        identity = resolve_property_identity(row.property_code)
        if identity is None:
            continue
        default_phone, phone_rows = source_lookup_rows(source_lookup, row.property_code)
        measurement_id = measurement_map.get(str(identity.ga4_property_id or ""))
        active_matches = manifest_candidates(row.vanity_domain, row.property_code)
        draft = build_draft_manifest(
            row=row,
            staging_url=str(qa.get("staging_kinsta_url") or ""),
            measurement_id=measurement_id,
            default_phone=default_phone,
            source_rows=phone_rows,
            generated_at_human=generated_at_human,
        )
        paths = pending_paths(draft)
        draft_name = f"{slug(row.vanity_domain)}.manifest-draft.json"
        draft_path = draft_dir / draft_name
        write_json(draft_path, draft)
        zone = cloudflare_zones.get(row.vanity_domain)
        properties.append(
            {
                "phase": row.phase,
                "property_code": row.property_code,
                "property_name": identity.property_name,
                "domain": row.vanity_domain,
                "staging_kinsta_url": qa.get("staging_kinsta_url"),
                "cloudflare_zone_status": zone.get("status") if zone else None,
                "active_manifest_matches": active_matches,
                "draft_manifest": str(draft_path.relative_to(output_dir)),
                "draft_manifest_repo_path": str(draft_path.relative_to(REPO_ROOT)),
                "pending_field_count": len(paths),
                "pending_fields": paths,
                "gap_labels": gap_labels(paths),
                "ga4_measurement_id": measurement_id,
                "default_display_phone": default_phone,
                "source_lookup_rows": len(phone_rows),
                "promote_ready_now": len(paths) == 0,
            }
        )

    counts = Counter()
    for item in properties:
        if item["active_manifest_matches"]:
            counts["active_manifest_matches"] += 1
        if item["promote_ready_now"]:
            counts["promote_ready_now"] += 1
    payload = {
        "schema": "resi_edge_phase_manifest_prep_v1",
        "phase": args.phase,
        "go_live": phase_dates.get(args.phase),
        "generated_at": generated_at.isoformat(),
        "generated_at_human": generated_at_human,
        "mutations_performed": False,
        "active_manifest_directory_mutated": False,
        "current_contract_gate_count": len(contract.get("required_gates") or []),
        "sources": {
            "rollout_workbook": str(args.rollout_workbook),
            "qa_docx": str(args.qa_docx),
            "identity_matrix": str(REPO_ROOT / "config/property_identity_matrix.json"),
            "source_lookup": str(SOURCE_LOOKUP_PATH),
            "ga4_landscape_audit": str(GOOGLE_LANDSCAPE_AUDIT),
            "cloudflare_inventory": str(cloudflare_inventory_path) if cloudflare_inventory_path else None,
            "contract": str(CONTRACT_PATH),
        },
        "summary": {
            "total": len(properties),
            "draft_manifests_written": len(properties),
            "active_manifest_matches": counts["active_manifest_matches"],
            "promote_ready_now": counts["promote_ready_now"],
        },
        "properties": properties,
    }
    write_json(output_dir / "manifest-prep.json", payload)
    write_csv(output_dir / "manifest-prep.csv", properties)
    (output_dir / "MANIFEST_PREP_READOUT.md").write_text(markdown_report(payload), encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "passed",
                "output_dir": str(output_dir.relative_to(REPO_ROOT)),
                "summary": payload["summary"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
