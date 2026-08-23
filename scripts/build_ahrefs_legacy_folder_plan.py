#!/usr/bin/env python3
"""Plan or move legacy Ahrefs projects into a manually-created folder.

Default mode is non-mutating. Apply mode requires an explicit confirmation
token and stops on the first failed readback.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests


ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.ahrefs_project_admin import API_BASE_URL, normalize_target  # noqa: E402
from utils.ahrefs_auth import resolve_ahrefs_credentials  # noqa: E402


UTC = timezone.utc
LOCAL_TZ = ZoneInfo("America/Chicago")
DEFAULT_ANALYTICS_PLAN_ROOT = ROOT / "reports/resi_edge_performance/phase2-analytics-profile-plan"
DEFAULT_OUTPUT_DIR = ROOT / "reports/ahrefs_admin/legacy_folder"
APPLY_CONFIRMATION = "MOVE_AHREFS_LEGACY_PROJECTS"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def human_time(value: datetime) -> str:
    return value.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")


def latest_analytics_plan(root: Path) -> Path:
    candidates = sorted(root.glob("phase-2-analytics-profile-plan-*/analytics_profile_plan.json"))
    if not candidates:
        raise FileNotFoundError(f"No analytics profile plan found under {root}")
    return candidates[-1]


def parse_folder_id(value: str | None) -> int | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)
    match = re.search(r"/folders/(\d+)", raw)
    if match:
        return int(match.group(1))
    raise ValueError("Legacy folder ID must be a numeric ID or an Ahrefs /dashboard/folders/<id> URL.")


def folder_id_from_project(project: dict[str, Any] | None) -> int | None:
    if not project:
        return None
    for key in ("folder_id", "folderId"):
        value = project.get(key)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    folder = project.get("folder")
    if isinstance(folder, dict):
        for key in ("folder_id", "id", "folderId"):
            value = folder.get(key)
            if isinstance(value, int):
                return value
            if isinstance(value, str) and value.isdigit():
                return int(value)
    return None


def safe_folder(project: dict[str, Any] | None) -> dict[str, Any] | None:
    if not project:
        return None
    folder = project.get("folder")
    if isinstance(folder, dict):
        return {
            "folder_id": folder_id_from_project(project),
            "name": folder.get("name") or folder.get("folder_name"),
        }
    folder_id = folder_id_from_project(project)
    if folder_id is not None:
        return {"folder_id": folder_id, "name": None}
    return None


def safe_project(project: dict[str, Any] | None) -> dict[str, Any] | None:
    if not project:
        return None
    return {
        "access": project.get("access"),
        "folder": safe_folder(project),
        "keyword_count": project.get("keyword_count"),
        "mode": project.get("mode"),
        "owned_by_present": bool(project.get("owned_by")),
        "project_id": str(project.get("project_id") or project.get("id") or ""),
        "project_name": project.get("project_name") or project.get("name"),
        "protocol": project.get("protocol"),
        "url": project.get("url"),
        "normalized_target": normalize_target(str(project.get("url") or "")),
        "verified": project.get("verified"),
        "web_analytics_data_key_present": bool(project.get("web_analytics_data_key")),
    }


def provider_error(exc: Exception) -> dict[str, str]:
    return {"type": type(exc).__name__, "message": str(exc)[:700]}


def extract_legacy_rows(analytics_plan: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in analytics_plan.get("properties") or []:
        legacy = ((row.get("ahrefs") or {}).get("legacy_project") or {})
        project_id = str(legacy.get("project_id") or "").strip()
        if not project_id or project_id in seen:
            continue
        seen.add(project_id)
        rows.append(
            {
                "phase": row.get("phase"),
                "go_live": row.get("go_live"),
                "property_code": row.get("property_code"),
                "property_name": row.get("property_name"),
                "vanity_domain": row.get("domain"),
                "identity_website_url": row.get("identity_website_url"),
                "legacy_project_id": project_id,
                "legacy_project_name": legacy.get("project_name"),
                "legacy_project_url": legacy.get("url"),
                "legacy_project_normalized_target": legacy.get("normalized_target"),
                "legacy_project_data_key_present": bool(legacy.get("web_analytics_data_key_present")),
            }
        )
    return rows


@dataclass
class AhrefsFolderAdmin:
    timeout_seconds: int
    readback_delay_seconds: float

    def __post_init__(self) -> None:
        credentials = resolve_ahrefs_credentials()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-AhrefsLegacyFolderPlan/1.0",
            }
        )

    def request(self, method: str, path: str, **kwargs: Any) -> tuple[int, dict[str, Any] | None]:
        response = self.session.request(method, f"{API_BASE_URL}{path}", timeout=self.timeout_seconds, **kwargs)
        try:
            payload = response.json() if response.content else None
        except ValueError:
            payload = {"raw_text": response.text[:1000]}
        return response.status_code, payload

    def get_projects(self) -> list[dict[str, Any]]:
        status, payload = self.request("GET", "/management/projects")
        if status >= 400:
            raise RuntimeError(f"Ahrefs project roster failed with status {status}: {payload}")
        projects = (payload or {}).get("projects") or []
        return projects if isinstance(projects, list) else []

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        status, payload = self.request("GET", "/management/projects", params={"project_id": project_id})
        if status >= 400:
            raise RuntimeError(f"Ahrefs project read failed with status {status}: {payload}")
        projects = (payload or {}).get("projects") or []
        if not projects:
            return None
        return projects[0] if isinstance(projects[0], dict) else None

    def move_project_to_folder(self, project_id: str, folder_id: int) -> tuple[int, dict[str, Any] | None]:
        body = {
            "project_id": int(project_id),
            "folder": {
                "operation": "move",
                "folder_id": folder_id,
            },
        }
        return self.request("PATCH", "/management/update-project", json=body)


def build_move_body(project_id: str, folder_id: int) -> dict[str, Any]:
    return {
        "project_id": int(project_id),
        "folder": {
            "operation": "move",
            "folder_id": folder_id,
        },
    }


def row_status(project: dict[str, Any] | None, folder_id: int | None) -> str:
    if not project:
        return "blocked_legacy_project_not_found_in_ahrefs_roster"
    if folder_id is None:
        return "needs_manual_legacy_folder_id"
    if folder_id_from_project(project) == folder_id:
        return "ready_already_in_legacy_folder"
    return "planned_move_to_legacy_folder_pending_approval"


def build_plan(args: argparse.Namespace) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    generated_at = datetime.now(UTC)
    analytics_plan_path = Path(args.analytics_plan) if args.analytics_plan else latest_analytics_plan(DEFAULT_ANALYTICS_PLAN_ROOT)
    analytics_plan = read_json(analytics_plan_path)
    legacy_folder_id = parse_folder_id(args.legacy_folder_id)

    admin = AhrefsFolderAdmin(
        timeout_seconds=args.timeout_seconds,
        readback_delay_seconds=args.readback_delay_seconds,
    )
    roster_error: dict[str, str] | None = None
    try:
        projects = admin.get_projects()
    except Exception as exc:  # pragma: no cover - exercised in local ops
        projects = []
        roster_error = provider_error(exc)
    projects_by_id = {str(project.get("project_id") or project.get("id") or ""): project for project in projects}

    only_project_ids = {str(value).strip() for value in (args.only_project_id or []) if str(value).strip()}
    legacy_rows = [
        row for row in extract_legacy_rows(analytics_plan) if not only_project_ids or row["legacy_project_id"] in only_project_ids
    ]

    plan_rows: list[dict[str, Any]] = []
    for source in legacy_rows:
        project = projects_by_id.get(source["legacy_project_id"])
        status = "blocked_ahrefs_roster_unavailable" if roster_error else row_status(project, legacy_folder_id)
        plan_rows.append(
            {
                **source,
                "status": status,
                "programmatic_action": (
                    "move_project_to_legacy_folder"
                    if status == "planned_move_to_legacy_folder_pending_approval"
                    else "none"
                ),
                "current_project": safe_project(project),
                "current_folder_id": folder_id_from_project(project),
                "target_folder_id": legacy_folder_id,
                "target_folder_name": args.legacy_folder_name,
                "future_apply_preview": (
                    build_move_body(source["legacy_project_id"], legacy_folder_id)
                    if legacy_folder_id is not None and project and folder_id_from_project(project) != legacy_folder_id
                    else None
                ),
            }
        )

    status_counts: dict[str, int] = {}
    for row in plan_rows:
        status_counts[row["status"]] = status_counts.get(row["status"], 0) + 1

    payload = {
        "generated_at": generated_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "generated_at_human": human_time(generated_at),
        "mutations_performed": False,
        "mode": "apply" if args.apply else "dry_run",
        "analytics_profile_plan": str(analytics_plan_path),
        "legacy_folder": {
            "name": args.legacy_folder_name,
            "folder_id": legacy_folder_id,
            "source": "manual_ahrefs_folder_creation",
            "folder_creation_programmatic_status": "manual_required_no_public_folder_create_endpoint_in_current_runbook",
        },
        "filters": {
            "only_project_ids": sorted(only_project_ids),
        },
        "provider_roster_state": {
            "attempted": True,
            "available": roster_error is None,
            "error": roster_error,
            "project_count": len(projects),
        },
        "summary": {
            "total_legacy_projects": len(plan_rows),
            "status_counts": dict(sorted(status_counts.items())),
            "planned_moves": status_counts.get("planned_move_to_legacy_folder_pending_approval", 0),
            "already_in_legacy_folder": status_counts.get("ready_already_in_legacy_folder", 0),
            "needs_manual_folder_id": status_counts.get("needs_manual_legacy_folder_id", 0),
            "blocked": sum(count for status, count in status_counts.items() if status.startswith("blocked_")),
        },
        "rows": plan_rows,
        "apply_guard": {
            "requires_apply": True,
            "confirmation_required": APPLY_CONFIRMATION,
            "stop_on_first_failed_readback": True,
        },
        "notes": [
            "This packet is non-mutating unless --apply and the confirmation token are supplied.",
            "Legacy Ahrefs projects are retained for historical reads; this only plans folder housekeeping.",
            "Raw Ahrefs Web Analytics data keys are not persisted; only presence is recorded.",
            "Folder creation is treated as a manual Ahrefs UI step; provide the numeric folder ID or folder URL for move planning.",
            "Use --only-project-id for a one-project canary before a bulk folder move.",
        ],
    }
    return payload, plan_rows


def apply_moves(payload: dict[str, Any], rows: list[dict[str, Any]], args: argparse.Namespace, output_dir: Path) -> int:
    if args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")
    folder_id = payload["legacy_folder"]["folder_id"]
    if folder_id is None:
        raise SystemExit("--apply requires --legacy-folder-id.")

    admin = AhrefsFolderAdmin(
        timeout_seconds=args.timeout_seconds,
        readback_delay_seconds=args.readback_delay_seconds,
    )
    results: list[dict[str, Any]] = []
    payload["mutations_performed"] = True
    for row in rows:
        if row["status"] != "planned_move_to_legacy_folder_pending_approval":
            continue
        project_id = row["legacy_project_id"]
        before = admin.get_project(project_id)
        status: int | None = None
        response_payload: dict[str, Any] | None = None
        failure: dict[str, Any] | None = None
        try:
            status, response_payload = admin.move_project_to_folder(project_id, folder_id)
            if args.readback_delay_seconds:
                time.sleep(args.readback_delay_seconds)
            after = admin.get_project(project_id)
        except Exception as exc:  # pragma: no cover - exercised in local ops
            after = None
            failure = provider_error(exc)
        move_proven = bool(after and folder_id_from_project(after) == folder_id)
        if status is not None and status >= 400:
            failure = {"type": "HttpError", "message": f"Ahrefs PATCH returned status {status}"}
        if not move_proven and failure is None:
            failure = {"type": "ReadbackMismatch", "message": "Project folder readback did not match target folder."}
        result = {
            "project_id": project_id,
            "property_code": row.get("property_code"),
            "property_name": row.get("property_name"),
            "before": safe_project(before),
            "patch_body": build_move_body(project_id, folder_id),
            "patch_status": status,
            "patch_response": response_payload,
            "after": safe_project(after),
            "move_proven": move_proven,
            "failure": failure,
        }
        results.append(result)
        payload["apply_results"] = results
        write_json(output_dir / "ahrefs_legacy_folder_plan.json", payload)
        if failure or not move_proven:
            return 1
    payload["apply_results"] = results
    return 0


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    folder = payload["legacy_folder"]
    lines = [
        "# Ahrefs Legacy Folder Housekeeping Plan",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Mode: `{payload['mode']}`",
        f"Mutations performed: `{payload['mutations_performed']}`",
        f"Source plan: `{payload['analytics_profile_plan']}`",
        "",
        "## Summary",
        "",
        f"- legacy_folder_name: `{folder['name']}`",
        f"- legacy_folder_id: `{folder['folder_id'] or 'needed'}`",
        f"- total_legacy_projects: {summary['total_legacy_projects']}",
        f"- planned_moves: {summary['planned_moves']}",
        f"- already_in_legacy_folder: {summary['already_in_legacy_folder']}",
        f"- needs_manual_folder_id: {summary['needs_manual_folder_id']}",
        f"- blocked: {summary['blocked']}",
        "",
        "## Queue",
        "",
        "| Property | Code | Legacy Project | Current Folder | Status |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in payload["rows"]:
        project = row.get("current_project") or {}
        folder_id = row.get("current_folder_id")
        lines.append(
            "| {property} | `{code}` | `{project_id}` {project_name} | {folder} | `{status}` |".format(
                property=row.get("property_name") or "",
                code=row.get("property_code") or "",
                project_id=row.get("legacy_project_id") or "",
                project_name=project.get("project_name") or row.get("legacy_project_name") or "",
                folder=folder_id if folder_id is not None else "",
                status=row.get("status") or "",
            )
        )
    lines.extend(
        [
            "",
            "## Boundary",
            "",
            "- This is Ahrefs housekeeping only.",
            "- It does not create vanity projects, retarget projects, delete projects, change GA4, update Zaraz, route domains, touch WordPress, purge cache, or deploy Workers.",
            f"- Apply requires `--apply --confirm {APPLY_CONFIRMATION}` and stops on the first failed readback.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "property_code",
        "property_name",
        "vanity_domain",
        "legacy_project_id",
        "legacy_project_name",
        "legacy_project_url",
        "legacy_project_data_key_present",
        "current_folder_id",
        "target_folder_id",
        "status",
        "programmatic_action",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan or move Phase 2 legacy Ahrefs projects into a Legacy folder.")
    parser.add_argument("--analytics-plan", help="analytics_profile_plan.json path. Defaults to latest Phase 2 plan.")
    parser.add_argument("--legacy-folder-id", help="Numeric Ahrefs folder ID, or a /dashboard/folders/<id> URL.")
    parser.add_argument("--legacy-folder-name", default="Legacy")
    parser.add_argument("--only-project-id", action="append", help="Limit planning/apply to one or more legacy project IDs.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--apply", action="store_true", help="Move planned projects. Default is dry-run.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--readback-delay-seconds", type=float, default=2.0)
    args = parser.parse_args()

    output_dir = Path(args.output_dir) / f"ahrefs-legacy-folder-plan-{utc_stamp()}"
    output_dir.mkdir(parents=True, exist_ok=True)
    payload, rows = build_plan(args)
    exit_code = 0
    if args.apply:
        exit_code = apply_moves(payload, rows, args, output_dir)

    plan_path = output_dir / "ahrefs_legacy_folder_plan.json"
    readout_path = output_dir / "AHREFS_LEGACY_FOLDER_READOUT.md"
    csv_path = output_dir / "ahrefs_legacy_folder_plan.csv"
    write_json(plan_path, payload)
    readout_path.write_text(markdown_report(payload), encoding="utf-8")
    write_csv(csv_path, payload["rows"])

    print(
        json.dumps(
            {
                "plan_path": str(plan_path),
                "readout_path": str(readout_path),
                "csv_path": str(csv_path),
                "summary": payload["summary"],
                "mutations_performed": payload["mutations_performed"],
                "legacy_folder": payload["legacy_folder"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": provider_error(exc)}, indent=2, sort_keys=True), file=sys.stderr)
        raise
