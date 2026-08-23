#!/usr/bin/env python3
"""Build the non-mutating Resi Edge Wednesday readiness queue.

This merges the latest Phase 2 preflight, manifest prep, analytics profile,
Ahrefs, and GA4 evidence packets into a property-level launch-room board. It
does not call external providers or mutate live domains.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCAL_TZ = ZoneInfo("America/Chicago")

PREFLIGHT_ROOT = REPO_ROOT / "reports/resi_edge_performance/phase2-preflight"
MANIFEST_PREP_ROOT = REPO_ROOT / "reports/resi_edge_performance/phase2-manifest-prep"
ANALYTICS_ROOT = REPO_ROOT / "reports/resi_edge_performance/phase2-analytics-profile-plan"
AHREFS_VANITY_ROOT = REPO_ROOT / "reports/ahrefs_admin/phase2_vanity_projects"
AHREFS_LEGACY_PURGE_ROOT = REPO_ROOT / "reports/ahrefs_admin/legacy_project_purge"
GA4_DEFAULT_URI_ROOT = REPO_ROOT / "reports/ga4_admin/phase2_default_uri"
REPORT_ROOT = REPO_ROOT / "reports/resi_edge_performance/wednesday-readiness"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def repo_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def latest_packet(root: Path, filename: str) -> Path:
    candidates = sorted(root.glob(f"*/{filename}"))
    if not candidates:
        raise FileNotFoundError(f"No {filename} packet found under {root}")
    return candidates[-1]


def index_by_code(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row.get("property_code")): row for row in rows if row.get("property_code")}


def status_bool(value: bool, complete_label: str, open_label: str) -> str:
    return complete_label if value else open_label


def row_status(row: dict[str, Any]) -> str:
    if row["hard_blockers"]:
        return "blocked"
    if row["open_preapproval_gates"]:
        return "needs_evidence"
    if row["launch_day_gates_after_approval"]:
        return "ready_for_approval_gate"
    return "ready"


def next_action(row: dict[str, Any]) -> str:
    if row["hard_blockers"]:
        return "Resolve hard blockers before launch-room review."
    if "source_manifest_closeout" in row["open_preapproval_gates"]:
        return "Close source manifest evidence: content, hero/media, reviews, awards, specials, SEO, and source phone proof."
    if "gsc_captain_data_pond" in row["open_preapproval_gates"]:
        return "Attach GSC URL Inspection, Captain handoff, and Data Pond evidence."
    if "rollback_snapshot" in row["open_preapproval_gates"]:
        return "Attach rollback route/worker snapshot before approval."
    return "Hold for explicit launch approval, then run current-contract live proof gates."


def build_queue() -> tuple[dict[str, Any], Path]:
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    generated_human = now.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")

    preflight_path = latest_packet(PREFLIGHT_ROOT, "phase-preflight.json")
    manifest_path = latest_packet(MANIFEST_PREP_ROOT, "manifest-prep.json")
    analytics_path = latest_packet(ANALYTICS_ROOT, "analytics_profile_plan.json")
    ahrefs_vanity_path = latest_packet(AHREFS_VANITY_ROOT, "phase2_ahrefs_vanity_project_plan.json")
    ahrefs_legacy_path = latest_packet(AHREFS_LEGACY_PURGE_ROOT, "ahrefs_legacy_project_purge_plan.json")
    ga4_path = latest_packet(GA4_DEFAULT_URI_ROOT, "phase2_ga4_default_uri_plan.json")

    preflight = read_json(preflight_path)
    manifest = read_json(manifest_path)
    analytics = read_json(analytics_path)
    ahrefs_vanity = read_json(ahrefs_vanity_path)
    ahrefs_legacy = read_json(ahrefs_legacy_path)
    ga4 = read_json(ga4_path)

    manifest_by_code = index_by_code(manifest.get("properties", []))
    analytics_by_code = index_by_code(analytics.get("properties", []))
    ahrefs_vanity_by_code = index_by_code(ahrefs_vanity.get("rows", []))
    ga4_by_code = index_by_code(ga4.get("rows", []))

    rows: list[dict[str, Any]] = []
    for preflight_row in preflight.get("properties", []):
        code = str(preflight_row.get("property_code") or "")
        manifest_row = manifest_by_code.get(code, {})
        analytics_row = analytics_by_code.get(code, {})
        ahrefs_row = ahrefs_vanity_by_code.get(code, {})
        ga4_row = ga4_by_code.get(code, {})

        cloudflare_ready = bool(preflight_row.get("cloudflare_zone_present")) and preflight_row.get("cloudflare_zone_status") == "active"
        staging_ready = bool((preflight_row.get("staging_probe") or {}).get("pass"))
        ahrefs_ready = ahrefs_row.get("status") == "existing_vanity_project_found" or (analytics_row.get("ahrefs") or {}).get("status") == "ready_existing_vanity_project_found"
        ga4_ready = ga4_row.get("status") == "ready_no_ga4_url_change_needed"
        draft_manifest_written = bool(manifest_row.get("draft_manifest_repo_path"))
        source_phone_ready = int(manifest_row.get("source_lookup_rows") or 0) > 0 and bool(manifest_row.get("default_display_phone"))
        promote_ready = bool(manifest_row.get("promote_ready_now"))

        hard_blockers: list[str] = []
        if preflight_row.get("blockers"):
            hard_blockers.extend(str(item) for item in preflight_row.get("blockers", []))
        if not cloudflare_ready:
            hard_blockers.append("cloudflare_zone_not_active")
        if not staging_ready:
            hard_blockers.append("staging_kinsta_probe_not_passing")
        if not ahrefs_ready:
            hard_blockers.append("ahrefs_vanity_project_not_ready")
        if not ga4_ready:
            hard_blockers.append("ga4_default_uri_not_current")
        if not draft_manifest_written:
            hard_blockers.append("draft_manifest_not_written")
        if not source_phone_ready:
            hard_blockers.append("source_phone_lookup_missing")

        open_preapproval_gates: list[str] = []
        if not promote_ready:
            open_preapproval_gates.append("source_manifest_closeout")
        manifest_gaps = set(str(item) for item in manifest_row.get("gap_labels", []))
        if "GSC URL Inspection evidence" in manifest_gaps or "Captain/Data Pond handoff evidence" in manifest_gaps:
            open_preapproval_gates.append("gsc_captain_data_pond")
        if "rollback route/worker snapshot" in manifest_gaps:
            open_preapproval_gates.append("rollback_snapshot")

        launch_day_gates_after_approval = [
            "wordpress_admin_control_bypass_live_proof",
            "zaraz_consent_source_attribution_browser_proof",
            "r2_asset_readback",
            "mobile_shell_visual_proof",
            "desktop_no_topper_proof",
            "psi_mobile_desktop",
            "current_contract_batch_readout",
        ]

        completed_setup = [
            status_bool(cloudflare_ready, "cloudflare_zone_active", "cloudflare_zone_open"),
            status_bool(staging_ready, "staging_kinsta_probe_passed", "staging_kinsta_probe_open"),
            status_bool(ahrefs_ready, "ahrefs_vanity_project_ready", "ahrefs_vanity_project_open"),
            status_bool(ga4_ready, "ga4_default_uri_current", "ga4_default_uri_open"),
            status_bool(draft_manifest_written, "draft_manifest_written", "draft_manifest_open"),
            status_bool(source_phone_ready, "source_phone_lookup_present", "source_phone_lookup_open"),
        ]

        row = {
            "property_code": code,
            "property_name": manifest_row.get("property_name") or preflight_row.get("canonical_name") or preflight_row.get("property_name"),
            "vanity_domain": preflight_row.get("vanity_domain") or manifest_row.get("domain") or analytics_row.get("domain"),
            "go_live": preflight_row.get("go_live") or ga4_row.get("go_live"),
            "market_or_region": preflight_row.get("region"),
            "units": preflight_row.get("units"),
            "cloudflare_zone_status": preflight_row.get("cloudflare_zone_status"),
            "staging_kinsta_status": "passed" if staging_ready else "open",
            "pastel_url_present": bool(preflight_row.get("pastel_url")),
            "draft_manifest_repo_path": manifest_row.get("draft_manifest_repo_path"),
            "pending_manifest_fields": manifest_row.get("pending_field_count", 0),
            "manifest_gap_labels": sorted(manifest_gaps),
            "default_display_phone_present": bool(manifest_row.get("default_display_phone")),
            "source_lookup_rows": manifest_row.get("source_lookup_rows", 0),
            "ahrefs_project_status": ahrefs_row.get("status") or (analytics_row.get("ahrefs") or {}).get("status"),
            "ahrefs_project_id": ahrefs_row.get("project_id") or (((analytics_row.get("ahrefs") or {}).get("launch_project") or {}).get("project_id")),
            "ga4_status": ga4_row.get("status"),
            "ga4_property_id": ga4_row.get("ga4_property_id"),
            "ga4_measurement_id": ga4_row.get("measurement_id") or manifest_row.get("ga4_measurement_id"),
            "completed_setup": completed_setup,
            "open_preapproval_gates": sorted(set(open_preapproval_gates)),
            "launch_day_gates_after_approval": launch_day_gates_after_approval,
            "hard_blockers": sorted(set(hard_blockers)),
        }
        row["status"] = row_status(row)
        row["next_action"] = next_action(row)
        rows.append(row)

    status_counts = Counter(row["status"] for row in rows)
    open_gate_counts = Counter(gate for row in rows for gate in row["open_preapproval_gates"])
    hard_blocker_counts = Counter(blocker for row in rows for blocker in row["hard_blockers"])

    payload = {
        "schema": "resi_edge_wednesday_readiness_queue_v1",
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "generated_at_human": generated_human,
        "mutations_performed": False,
        "phase": 2,
        "go_live": preflight.get("go_live") or "08/19/2026",
        "launch_room_posture": "approval_gate_not_launch_button",
        "sources": {
            "preflight": repo_path(preflight_path),
            "manifest_prep": repo_path(manifest_path),
            "analytics_profile": repo_path(analytics_path),
            "ahrefs_vanity": repo_path(ahrefs_vanity_path),
            "ahrefs_legacy_purge": repo_path(ahrefs_legacy_path),
            "ga4_default_uri": repo_path(ga4_path),
        },
        "summary": {
            "total_properties": len(rows),
            "ready": status_counts.get("ready", 0),
            "ready_for_approval_gate": status_counts.get("ready_for_approval_gate", 0),
            "needs_evidence": status_counts.get("needs_evidence", 0),
            "blocked": status_counts.get("blocked", 0),
            "status_counts": dict(sorted(status_counts.items())),
            "open_preapproval_gate_counts": dict(sorted(open_gate_counts.items())),
            "hard_blocker_counts": dict(sorted(hard_blocker_counts.items())),
            "setup_complete_counts": {
                "cloudflare_zone_active": sum(1 for row in rows if row["cloudflare_zone_status"] == "active"),
                "staging_kinsta_probe_passed": sum(1 for row in rows if row["staging_kinsta_status"] == "passed"),
                "ahrefs_vanity_project_ready": sum(1 for row in rows if row["ahrefs_project_status"] in {"existing_vanity_project_found", "ready_existing_vanity_project_found"}),
                "ga4_default_uri_current": sum(1 for row in rows if row["ga4_status"] == "ready_no_ga4_url_change_needed"),
                "draft_manifest_written": sum(1 for row in rows if row["draft_manifest_repo_path"]),
                "source_phone_lookup_present": sum(1 for row in rows if row["default_display_phone_present"]),
            },
        },
        "rows": rows,
    }

    out_dir = REPORT_ROOT / f"phase2-wednesday-readiness-{stamp}"
    return payload, out_dir


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = [
        "property_code",
        "property_name",
        "vanity_domain",
        "go_live",
        "status",
        "next_action",
        "cloudflare_zone_status",
        "staging_kinsta_status",
        "ahrefs_project_status",
        "ga4_status",
        "pending_manifest_fields",
        "open_preapproval_gates",
        "hard_blockers",
        "launch_day_gates_after_approval",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            output = {field: row.get(field) for field in fields}
            for field in ["open_preapproval_gates", "hard_blockers", "launch_day_gates_after_approval"]:
                output[field] = "; ".join(row.get(field, []))
            writer.writerow(output)


def write_markdown(path: Path, payload: dict[str, Any]) -> None:
    summary = payload["summary"]
    lines = [
        "# Resi Edge Phase 2 Wednesday Readiness Queue",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Go-live target: {payload['go_live']}",
        "Mutation posture: none; this packet is local evidence synthesis only.",
        "",
        "## Summary",
        "",
        f"- Total properties: `{summary['total_properties']}`",
        f"- Ready: `{summary['ready']}`",
        f"- Ready for approval gate: `{summary['ready_for_approval_gate']}`",
        f"- Needs evidence: `{summary['needs_evidence']}`",
        f"- Blocked: `{summary['blocked']}`",
        "",
        "## Setup Coverage",
        "",
    ]
    for label, value in summary["setup_complete_counts"].items():
        lines.append(f"- {label}: `{value}/{summary['total_properties']}`")
    lines.extend(["", "## Open Pre-Approval Gates", ""])
    if summary["open_preapproval_gate_counts"]:
        for label, value in summary["open_preapproval_gate_counts"].items():
            lines.append(f"- {label}: `{value}`")
    else:
        lines.append("- None")
    lines.extend(
        [
            "",
            "## Property Queue",
            "",
            "| Code | Property | Domain | Status | Pending fields | Open gates | Next action |",
            "| --- | --- | --- | --- | ---: | --- | --- |",
        ]
    )
    for row in payload["rows"]:
        open_gates = ", ".join(row["open_preapproval_gates"]) or "None"
        lines.append(
            "| {code} | {name} | {domain} | {status} | {pending} | {gates} | {action} |".format(
                code=row["property_code"],
                name=row["property_name"],
                domain=row["vanity_domain"],
                status=row["status"],
                pending=row["pending_manifest_fields"],
                gates=open_gates,
                action=row["next_action"],
            )
        )
    lines.extend(["", "## Source Packets", ""])
    for label, source in payload["sources"].items():
        lines.append(f"- {label}: `{source}`")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    payload, out_dir = build_queue()
    write_json(out_dir / "wednesday-readiness-queue.json", payload)
    write_csv(out_dir / "wednesday-readiness-queue.csv", payload["rows"])
    write_markdown(out_dir / "WEDNESDAY_READINESS_QUEUE.md", payload)
    print(json.dumps({"out_dir": repo_path(out_dir), "summary": payload["summary"]}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
