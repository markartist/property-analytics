#!/usr/bin/env python3
"""Build a non-mutating GA4/Ahrefs migration capability plan for Phase 2.

The plan answers how much of the analytics profile migration can be handled
programmatically before any public cutover. It only performs read-only roster
lookups against GA4 Admin and Ahrefs, then writes report-scoped evidence.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from google.analytics.admin_v1beta import AnalyticsAdminServiceClient
from google.oauth2 import service_account


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from ahrefs_project_admin import (  # noqa: E402
    AhrefsProjectAdmin,
    ahrefs_url_from_website,
    compact_identity_key,
    normalize_target,
)
from build_resi_edge_phase2_manifest_prep import GOOGLE_LANDSCAPE_AUDIT, load_ga4_measurement_map  # noqa: E402
from build_resi_edge_phase2_preflight import (  # noqa: E402
    DEFAULT_ROLLOUT_WORKBOOK,
    load_rollout_rows,
    resolve_input_path,
)
from utils.config_manager import Config  # noqa: E402
from utils.ksm import ensure_keeper_profile_ready  # noqa: E402


REPORT_ROOT = REPO_ROOT / "reports/resi_edge_performance/phase2-analytics-profile-plan"
LOCAL_TZ = ZoneInfo("America/Chicago")
UTC = timezone.utc
DEFAULT_GA4_SERVICE_ACCOUNT_UID = "mVZqo2oVSqfS6YDvBDer8g"
GA4_READ_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
GA4_APPLY_SCOPE = "https://www.googleapis.com/auth/analytics.edit"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def normalize_uri(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    host = (parsed.netloc or parsed.path.split("/")[0]).lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path if parsed.netloc else ""
    if not path:
        path = "/"
    path = "/" + path.lstrip("/")
    if path != "/":
        path = path.rstrip("/") + "/"
    return f"https://{host}{path}"


def proposed_vanity_uri(domain: str) -> str:
    return f"https://{domain.strip().lower().strip('/')}/"


def provider_error(exc: Exception) -> dict[str, str]:
    return {
        "type": type(exc).__name__,
        "message": str(exc)[:500],
    }


class Ga4AdminReadOnly:
    def __init__(self) -> None:
        os.environ.setdefault("KSM_GA4_SERVICE_ACCOUNT_UID", DEFAULT_GA4_SERVICE_ACCOUNT_UID)
        ensure_keeper_profile_ready(os.getenv("KSM_PROFILE", "marketingops"))
        credentials = service_account.Credentials.from_service_account_file(
            str(Config.get_ga4_credentials_path()),
            scopes=[GA4_READ_SCOPE],
        )
        self.client = AnalyticsAdminServiceClient(credentials=credentials)

    def list_web_streams(self, property_id: str) -> list[dict[str, Any]]:
        streams: list[dict[str, Any]] = []
        for stream in self.client.list_data_streams(parent=f"properties/{property_id}"):
            web = stream.web_stream_data
            if not web or not web.measurement_id:
                continue
            streams.append(
                {
                    "name": stream.name,
                    "display_name": stream.display_name,
                    "measurement_id": web.measurement_id,
                    "default_uri": web.default_uri,
                    "normalized_default_uri": normalize_uri(web.default_uri),
                }
            )
        return streams


def choose_ga4_stream(streams: list[dict[str, Any]], expected_measurement_id: str | None) -> dict[str, Any] | None:
    if expected_measurement_id:
        matches = [item for item in streams if item.get("measurement_id") == expected_measurement_id]
        if len(matches) == 1:
            return matches[0]
    if len(streams) == 1:
        return streams[0]
    return None


def ga4_row(
    *,
    property_id: str | None,
    expected_measurement_id: str | None,
    proposed_uri: str,
    streams: list[dict[str, Any]] | None,
    error: dict[str, str] | None,
) -> dict[str, Any]:
    if not property_id:
        return {
            "status": "blocked_missing_ga4_property_id",
            "property_id": None,
            "expected_measurement_id": expected_measurement_id,
            "web_stream_count": 0,
            "selected_stream": None,
            "proposed_default_uri": proposed_uri,
            "programmatic_action": "none",
            "error": None,
        }
    if error:
        return {
            "status": "blocked_ga4_admin_roster_unavailable",
            "property_id": property_id,
            "expected_measurement_id": expected_measurement_id,
            "web_stream_count": None,
            "selected_stream": None,
            "proposed_default_uri": proposed_uri,
            "programmatic_action": "read_only_probe_failed",
            "error": error,
        }

    stream_rows = streams or []
    selected = choose_ga4_stream(stream_rows, expected_measurement_id)
    if not stream_rows:
        status = "blocked_no_web_data_stream_found"
        action = "none"
    elif not selected:
        status = "needs_decision_multiple_web_streams"
        action = "select_stream_before_apply"
    elif selected["normalized_default_uri"] == normalize_uri(proposed_uri):
        status = "ready_no_ga4_url_change_needed"
        action = "none"
    else:
        status = "ready_programmatic_patch_supported_pending_approval"
        action = "patch_data_stream_default_uri"

    return {
        "status": status,
        "property_id": property_id,
        "expected_measurement_id": expected_measurement_id,
        "web_stream_count": len(stream_rows),
        "selected_stream": selected,
        "all_web_streams": stream_rows,
        "proposed_default_uri": proposed_uri,
        "programmatic_action": action,
        "future_apply_preview": (
            {
                "method": "AnalyticsAdminService.UpdateDataStream",
                "resource_name": selected["name"],
                "update_mask": "web_stream_data.default_uri",
                "body": {
                    "name": selected["name"],
                    "web_stream_data": {"default_uri": proposed_uri},
                },
                "required_oauth_scope": GA4_APPLY_SCOPE,
                "requires_explicit_approval": True,
            }
            if selected and action == "patch_data_stream_default_uri"
            else None
        ),
        "error": None,
    }


def safe_project(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "project_id": str(project.get("project_id") or ""),
        "project_name": project.get("project_name"),
        "url": project.get("url"),
        "normalized_target": normalize_target(str(project.get("url") or "")),
        "protocol": project.get("protocol"),
        "mode": project.get("mode"),
        "verified": project.get("verified"),
        "access": project.get("access"),
        "web_analytics_data_key_present": bool(project.get("web_analytics_data_key")),
    }


def find_heuristic_projects(projects: list[dict[str, Any]], property_name: str, property_code: str | None) -> list[dict[str, Any]]:
    needles = [compact_identity_key(property_name), compact_identity_key(property_code)]
    needles = [value for value in needles if len(value) >= 4]
    matches: list[dict[str, Any]] = []
    for project in projects:
        haystack = compact_identity_key(
            " ".join(
                [
                    str(project.get("project_name") or ""),
                    str(project.get("url") or ""),
                ]
            )
        )
        if any(needle and needle in haystack for needle in needles):
            matches.append(safe_project(project))
    return matches[:10]


def ahrefs_row(
    *,
    projects: list[dict[str, Any]] | None,
    error: dict[str, str] | None,
    source_website_url: str | None,
    vanity_domain: str,
    property_name: str,
    property_code: str | None,
) -> dict[str, Any]:
    vanity_target = f"{vanity_domain}/"
    normalized_vanity = normalize_target(vanity_target)
    source_target = ahrefs_url_from_website(source_website_url) if source_website_url else None
    normalized_source = normalize_target(source_target) if source_target else None

    if error:
        return {
            "status": "blocked_ahrefs_roster_unavailable",
            "programmatic_action": "read_only_probe_failed",
            "vanity_target": vanity_target,
            "source_target": source_target,
            "selected_project": None,
            "vanity_matches": [],
            "source_matches": [],
            "heuristic_matches": [],
            "error": error,
        }

    project_rows = projects or []
    vanity_matches = [safe_project(project) for project in project_rows if normalize_target(project.get("url")) == normalized_vanity]
    source_matches = [
        safe_project(project)
        for project in project_rows
        if normalized_source and normalize_target(project.get("url")) == normalized_source
    ]
    heuristic_matches = find_heuristic_projects(project_rows, property_name, property_code)
    vanity_project = vanity_matches[0] if vanity_matches else None
    legacy_project = source_matches[0] if source_matches else None
    selected = vanity_project or legacy_project

    if vanity_matches:
        status = "ready_existing_vanity_project_found"
        action = "reuse_existing_vanity_project"
    elif source_matches:
        status = "planned_create_new_vanity_project_keep_legacy"
        action = "create_new_vanity_project_pending_approval"
    elif heuristic_matches:
        status = "needs_decision_review_heuristic_project_match_before_create"
        action = "operator_confirm_legacy_context_before_new_project"
    else:
        status = "planned_create_new_vanity_project_no_legacy_match"
        action = "create_new_vanity_project_pending_approval"

    return {
        "status": status,
        "programmatic_action": action,
        "vanity_target": vanity_target,
        "source_target": source_target,
        "selected_project": selected,
        "launch_project": vanity_project,
        "legacy_project": legacy_project,
        "vanity_matches": vanity_matches,
        "source_matches": source_matches,
        "heuristic_matches": heuristic_matches,
        "project_creation_plan": (
            {
                "access": "shared",
                "protocol": "both",
                "mode": "subdomains",
                "url": vanity_target,
                "project_name": f"{property_name} ({property_code})" if property_code else property_name,
                "requires_explicit_approval": True,
                "do_not_delete_legacy_project": True,
            }
            if not vanity_project and status.startswith("planned_create_new_vanity_project")
            else None
        ),
        "future_apply_preview": {
            "read_existing_projects": "supported",
            "read_web_analytics_data_key": "supported_but_report_masks_raw_value",
            "create_missing_vanity_project": "planned_when_no_vanity_project_exists_and_requires_explicit_approval",
            "update_access_or_folder": "supported_by_api",
            "update_existing_project_target_url": "canary_returned_200_but_readback_did_not_change; not_used_for_rollout_policy",
            "retain_legacy_project": "required_for_historical_ahrefs_reads",
        },
        "error": None,
    }


def load_ahrefs_projects(timeout_seconds: int) -> tuple[list[dict[str, Any]] | None, dict[str, str] | None]:
    try:
        admin = AhrefsProjectAdmin(
            access="shared",
            folder_id=None,
            owned_by=None,
            timeout_seconds=timeout_seconds,
            rate_limit_sleep_seconds=0,
        )
        return admin.get_projects(), None
    except Exception as exc:  # pragma: no cover - exercised in local ops
        return None, provider_error(exc)


def load_ga4_client() -> tuple[Ga4AdminReadOnly | None, dict[str, str] | None]:
    try:
        return Ga4AdminReadOnly(), None
    except Exception as exc:  # pragma: no cover - exercised in local ops
        return None, provider_error(exc)


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    lines = [
        "# Resi Edge Phase 2 Analytics Profile Plan",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Phase: {payload['phase']}",
        f"Go-live target: {payload.get('go_live') or 'not provided'}",
        "",
        "## Summary",
        "",
        f"- total_properties: {summary['total_properties']}",
        f"- mutations_performed: {payload['mutations_performed']}",
        f"- ga4_programmatic_patch_ready: {summary['ga4_programmatic_patch_ready']}",
        f"- ga4_ready_no_change_needed: {summary['ga4_ready_no_change_needed']}",
        f"- ga4_needs_decision_or_blocked: {summary['ga4_needs_decision_or_blocked']}",
        f"- ahrefs_existing_vanity_project_found: {summary['ahrefs_existing_vanity_project_found']}",
        f"- ahrefs_new_vanity_projects_planned: {summary['ahrefs_new_vanity_projects_planned']}",
        f"- ahrefs_legacy_source_projects_found: {summary['ahrefs_legacy_source_projects_found']}",
        f"- ahrefs_needs_decision_or_blocked: {summary['ahrefs_needs_decision_or_blocked']}",
        "",
        "## Programmatic Capability",
        "",
        "- GA4: Admin API supports listing web data streams and patching `web_stream_data.default_uri`; apply would require explicit approval and the edit OAuth scope.",
        "- Ahrefs: rollout policy is existing vanity project first; if absent, create a new vanity-domain project and keep the old Venterra-path project as historical/legacy evidence.",
        "- Ahrefs target retargeting is not used for rollout planning because the Zang Triangle canary returned HTTP 200 but readback did not change target URL, protocol, or mode.",
        "- Ahrefs raw Web Analytics data keys are intentionally masked in this report.",
        "",
        "## Cohort Queue",
        "",
        "| Property | Code | Domain | GA4 Status | GA4 Current URL | GA4 Proposed URL | Ahrefs Status | Launch Project | Legacy Project |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in payload["properties"]:
        ga4 = row["ga4"]
        ahrefs = row["ahrefs"]
        selected_stream = ga4.get("selected_stream") or {}
        launch_project = ahrefs.get("launch_project") or {}
        legacy_project = ahrefs.get("legacy_project") or {}
        lines.append(
            "| {property} | `{code}` | `{domain}` | `{ga4_status}` | {ga4_current} | {ga4_proposed} | `{ahrefs_status}` | {launch_project} | {legacy_project} |".format(
                property=row["property_name"],
                code=row.get("property_code") or "unresolved",
                domain=row["domain"],
                ga4_status=ga4["status"],
                ga4_current=selected_stream.get("default_uri") or "",
                ga4_proposed=ga4.get("proposed_default_uri") or "",
                ahrefs_status=ahrefs["status"],
                launch_project=launch_project.get("project_id") or "create planned",
                legacy_project=legacy_project.get("project_id") or "",
            )
        )
    lines.extend(
        [
            "",
            "## Boundary",
            "",
            "- This packet is non-mutating.",
            "- It does not patch GA4, create Ahrefs projects, update Ahrefs projects, change Zaraz, route domains, purge cache, touch WordPress, or deploy workers.",
            "- Any apply step must be approved separately and must stop on the first failed gate.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "phase",
        "property_code",
        "property_name",
        "domain",
        "ga4_property_id",
        "ga4_measurement_id",
        "ga4_status",
        "ga4_current_default_uri",
        "ga4_proposed_default_uri",
        "ga4_selected_stream",
        "ahrefs_status",
        "ahrefs_programmatic_action",
        "ahrefs_launch_project_id",
        "ahrefs_launch_project_url",
        "ahrefs_legacy_project_id",
        "ahrefs_legacy_project_url",
        "ahrefs_legacy_project_data_key_present",
        "ahrefs_project_creation_url",
        "ahrefs_project_creation_protocol",
        "ahrefs_project_creation_mode",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            ga4 = row["ga4"]
            selected_stream = ga4.get("selected_stream") or {}
            ahrefs = row["ahrefs"]
            launch_project = ahrefs.get("launch_project") or {}
            legacy_project = ahrefs.get("legacy_project") or {}
            creation_plan = ahrefs.get("project_creation_plan") or {}
            writer.writerow(
                {
                    "phase": row["phase"],
                    "property_code": row.get("property_code"),
                    "property_name": row["property_name"],
                    "domain": row["domain"],
                    "ga4_property_id": ga4.get("property_id"),
                    "ga4_measurement_id": ga4.get("expected_measurement_id"),
                    "ga4_status": ga4.get("status"),
                    "ga4_current_default_uri": selected_stream.get("default_uri"),
                    "ga4_proposed_default_uri": ga4.get("proposed_default_uri"),
                    "ga4_selected_stream": selected_stream.get("name"),
                    "ahrefs_status": ahrefs.get("status"),
                    "ahrefs_programmatic_action": ahrefs.get("programmatic_action"),
                    "ahrefs_launch_project_id": launch_project.get("project_id"),
                    "ahrefs_launch_project_url": launch_project.get("url"),
                    "ahrefs_legacy_project_id": legacy_project.get("project_id"),
                    "ahrefs_legacy_project_url": legacy_project.get("url"),
                    "ahrefs_legacy_project_data_key_present": legacy_project.get("web_analytics_data_key_present"),
                    "ahrefs_project_creation_url": creation_plan.get("url"),
                    "ahrefs_project_creation_protocol": creation_plan.get("protocol"),
                    "ahrefs_project_creation_mode": creation_plan.get("mode"),
                }
            )


def build_plan(args: argparse.Namespace) -> dict[str, Any]:
    generated_at = datetime.now(UTC)
    generated_at_human = generated_at.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")
    rollout_path = resolve_input_path(Path(args.rollout_workbook))
    landscape_path = resolve_input_path(Path(args.google_landscape_audit))
    rollout_rows, phase_dates = load_rollout_rows(rollout_path, args.phase)
    measurement_map = load_ga4_measurement_map(landscape_path)

    ga4_client, ga4_client_error = (None, {"type": "Skipped", "message": "GA4 roster probe skipped by --skip-ga4"}) if args.skip_ga4 else load_ga4_client()
    ahrefs_projects, ahrefs_error = (None, {"type": "Skipped", "message": "Ahrefs roster probe skipped by --skip-ahrefs"}) if args.skip_ahrefs else load_ahrefs_projects(args.timeout_seconds)

    properties: list[dict[str, Any]] = []
    ga4_cache: dict[str, tuple[list[dict[str, Any]] | None, dict[str, str] | None]] = {}
    for rollout in rollout_rows:
        identity = resolve_property_identity(rollout.property_code or rollout.property_name)
        property_code = identity.property_code if identity else rollout.property_code
        property_id = str(identity.ga4_property_id) if identity and identity.ga4_property_id else None
        expected_measurement_id = measurement_map.get(property_id or "")
        proposed_uri = proposed_vanity_uri(rollout.vanity_domain)

        if property_id and ga4_client and property_id not in ga4_cache:
            try:
                ga4_cache[property_id] = (ga4_client.list_web_streams(property_id), None)
            except Exception as exc:  # pragma: no cover - exercised in local ops
                ga4_cache[property_id] = (None, provider_error(exc))
        streams, stream_error = ga4_cache.get(property_id or "", (None, ga4_client_error))

        ga4 = ga4_row(
            property_id=property_id,
            expected_measurement_id=expected_measurement_id,
            proposed_uri=proposed_uri,
            streams=streams,
            error=stream_error,
        )
        ahrefs = ahrefs_row(
            projects=ahrefs_projects,
            error=ahrefs_error,
            source_website_url=identity.website_url if identity else None,
            vanity_domain=rollout.vanity_domain,
            property_name=identity.property_name if identity else rollout.property_name,
            property_code=property_code,
        )

        properties.append(
            {
                "phase": rollout.phase,
                "go_live": rollout.go_live,
                "property_code": property_code,
                "property_name": identity.property_name if identity else rollout.property_name,
                "domain": rollout.vanity_domain,
                "identity_website_url": identity.website_url if identity else None,
                "ga4": ga4,
                "ahrefs": ahrefs,
            }
        )

    ga4_status_counts = Counter(row["ga4"]["status"] for row in properties)
    ahrefs_status_counts = Counter(row["ahrefs"]["status"] for row in properties)
    payload = {
        "generated_at": generated_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "generated_at_human": generated_at_human,
        "phase": args.phase,
        "go_live": phase_dates.get(args.phase),
        "source_workbook": str(rollout_path),
        "google_landscape_audit": str(landscape_path),
        "mutations_performed": False,
        "provider_roster_state": {
            "ga4": {
                "attempted": not args.skip_ga4,
                "available": ga4_client_error is None,
                "error": ga4_client_error,
                "oauth_scope_used": GA4_READ_SCOPE,
            },
            "ahrefs": {
                "attempted": not args.skip_ahrefs,
                "available": ahrefs_error is None,
                "error": ahrefs_error,
                "project_count": len(ahrefs_projects or []),
            },
        },
        "capability_matrix": {
            "ga4": {
                "list_web_streams": "programmatic_supported",
                "read_measurement_id": "programmatic_supported",
                "patch_default_uri": "programmatic_supported_with_explicit_apply_approval",
                "create_new_property_or_stream": "not_recommended_for_this_rollout_without_exception",
                "delete_stream": "not_allowed_for_this_rollout",
            },
            "ahrefs": {
                "list_projects": "programmatic_supported",
                "read_web_analytics_data_key_presence": "programmatic_supported_raw_value_masked",
                "create_vanity_project": "planned_when_no_vanity_project_exists; requires_explicit_approval_and_duplicate_review",
                "update_access_or_folder": "programmatic_supported",
                "update_existing_project_target_url": "not_used_for_rollout; Zang canary returned 200 but readback_did_not_change",
                "retain_legacy_project": "required_for_historical_ahrefs_reads",
                "delete_project": "not_allowed_for_this_rollout",
            },
        },
        "summary": {
            "total_properties": len(properties),
            "ga4_status_counts": dict(sorted(ga4_status_counts.items())),
            "ahrefs_status_counts": dict(sorted(ahrefs_status_counts.items())),
            "ga4_programmatic_patch_ready": ga4_status_counts.get("ready_programmatic_patch_supported_pending_approval", 0),
            "ga4_ready_no_change_needed": ga4_status_counts.get("ready_no_ga4_url_change_needed", 0),
            "ga4_needs_decision_or_blocked": sum(
                count for status, count in ga4_status_counts.items() if not status.startswith("ready_")
            ),
            "ahrefs_existing_vanity_project_found": ahrefs_status_counts.get("ready_existing_vanity_project_found", 0),
            "ahrefs_new_vanity_projects_planned": sum(
                count for status, count in ahrefs_status_counts.items() if status.startswith("planned_create_new_vanity_project")
            ),
            "ahrefs_legacy_source_projects_found": sum(
                1 for row in properties if (row["ahrefs"].get("legacy_project") or {}).get("project_id")
            ),
            "ahrefs_needs_decision_or_blocked": sum(
                count
                for status, count in ahrefs_status_counts.items()
                if not (status.startswith("ready_") or status.startswith("planned_"))
            ),
        },
        "properties": properties,
        "notes": [
            "This is a read-only capability plan. It does not mutate GA4, Ahrefs, Zaraz, Cloudflare, WordPress, R2, GSC, Captain, or Data Pond.",
            "GA4 apply would patch only the selected web data stream default URI after explicit approval.",
            "Ahrefs raw Web Analytics data keys are not written to the plan; only presence/absence is recorded.",
            "Ahrefs rollout policy is create/reuse vanity-domain projects and retain old Venterra-path projects as historical legacy profiles.",
        ],
    }
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a non-mutating Phase 2 GA4/Ahrefs profile migration plan.")
    parser.add_argument("--phase", type=int, default=2)
    parser.add_argument("--rollout-workbook", default=str(DEFAULT_ROLLOUT_WORKBOOK))
    parser.add_argument("--google-landscape-audit", default=str(GOOGLE_LANDSCAPE_AUDIT))
    parser.add_argument("--output-dir", default=str(REPORT_ROOT))
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--skip-ga4", action="store_true")
    parser.add_argument("--skip-ahrefs", action="store_true")
    args = parser.parse_args()

    payload = build_plan(args)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    output_dir = Path(args.output_dir) / f"phase-2-analytics-profile-plan-{stamp}"
    output_dir.mkdir(parents=True, exist_ok=True)
    plan_path = output_dir / "analytics_profile_plan.json"
    readout_path = output_dir / "ANALYTICS_PROFILE_PLAN_READOUT.md"
    csv_path = output_dir / "analytics_profile_plan.csv"

    write_json(plan_path, payload)
    readout_path.write_text(markdown_report(payload), encoding="utf-8")
    write_csv(csv_path, payload["properties"])

    print(
        json.dumps(
            {
                "plan_path": str(plan_path),
                "readout_path": str(readout_path),
                "csv_path": str(csv_path),
                "summary": payload["summary"],
                "mutations_performed": payload["mutations_performed"],
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
