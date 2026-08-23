#!/usr/bin/env python3
"""Plan or delete Ahrefs projects from the Legacy folder.

Default mode is non-mutating. Apply mode deletes one project at a time and
stops on the first failed absence readback.
"""

from __future__ import annotations

import argparse
import csv
import json
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
DEFAULT_OUTPUT_DIR = ROOT / "reports/ahrefs_admin/legacy_project_purge"
APPLY_CONFIRMATION = "PURGE_AHREFS_LEGACY_PROJECTS"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def human_time(value: datetime) -> str:
    return value.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")


def folder_id_from_project(project: dict[str, Any] | None) -> int | None:
    if not project:
        return None
    folder = project.get("folder")
    if isinstance(folder, dict):
        for key in ("id", "folder_id", "folderId"):
            value = folder.get(key)
            if isinstance(value, int):
                return value
            if isinstance(value, str) and value.isdigit():
                return int(value)
    for key in ("folder_id", "folderId"):
        value = project.get(key)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return None


def scrub_ahrefs_payload(value: Any) -> Any:
    if isinstance(value, list):
        return [scrub_ahrefs_payload(item) for item in value]
    if not isinstance(value, dict):
        return value
    scrubbed: dict[str, Any] = {}
    for key, item in value.items():
        if key == "web_analytics_data_key":
            scrubbed["web_analytics_data_key_present"] = bool(item)
        else:
            scrubbed[key] = scrub_ahrefs_payload(item)
    return scrubbed


def safe_project(project: dict[str, Any] | None) -> dict[str, Any] | None:
    if not project:
        return None
    folder = project.get("folder")
    folder_row = None
    if isinstance(folder, dict):
        folder_row = {
            "folder_id": folder.get("id") or folder.get("folder_id"),
            "name": folder.get("name") or folder.get("folder_name"),
        }
    return {
        "access": project.get("access"),
        "folder": folder_row,
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


@dataclass
class AhrefsLegacyPurgeAdmin:
    timeout_seconds: int
    readback_delay_seconds: float
    rate_limit_sleep_seconds: float

    def __post_init__(self) -> None:
        credentials = resolve_ahrefs_credentials()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-AhrefsLegacyProjectPurge/1.0",
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

    def delete_project(self, project_id: str) -> tuple[int, dict[str, Any] | None]:
        return self.request("DELETE", "/management/projects", params={"project_ids": project_id})


def build_plan(args: argparse.Namespace) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    generated_at = datetime.now(UTC)
    only_project_ids = {str(value).strip() for value in (args.only_project_id or []) if str(value).strip()}
    admin = AhrefsLegacyPurgeAdmin(
        timeout_seconds=args.timeout_seconds,
        readback_delay_seconds=args.readback_delay_seconds,
        rate_limit_sleep_seconds=args.rate_limit_sleep_seconds,
    )
    roster_error: dict[str, str] | None = None
    try:
        projects = admin.get_projects()
    except Exception as exc:  # pragma: no cover - exercised in local ops
        projects = []
        roster_error = provider_error(exc)

    rows: list[dict[str, Any]] = []
    for project in projects:
        project_id = str(project.get("project_id") or project.get("id") or "")
        if folder_id_from_project(project) != args.legacy_folder_id:
            continue
        if only_project_ids and project_id not in only_project_ids:
            continue
        rows.append(
            {
                "project_id": project_id,
                "project_name": project.get("project_name") or project.get("name"),
                "url": project.get("url"),
                "normalized_target": normalize_target(str(project.get("url") or "")),
                "protocol": project.get("protocol"),
                "mode": project.get("mode"),
                "keyword_count": project.get("keyword_count"),
                "folder_id": folder_id_from_project(project),
                "current_project": safe_project(project),
                "status": "blocked_ahrefs_roster_unavailable" if roster_error else "planned_delete_pending_approval",
                "programmatic_action": "delete_project",
            }
        )

    status_counts: dict[str, int] = {}
    for row in rows:
        status_counts[row["status"]] = status_counts.get(row["status"], 0) + 1

    payload = {
        "generated_at": generated_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "generated_at_human": human_time(generated_at),
        "mutations_performed": False,
        "mode": "apply" if args.apply else "dry_run",
        "legacy_folder_id": args.legacy_folder_id,
        "provider_roster_state": {
            "attempted": True,
            "available": roster_error is None,
            "error": roster_error,
            "project_count": len(projects),
        },
        "filters": {
            "only_project_ids": sorted(only_project_ids),
        },
        "summary": {
            "legacy_folder_projects": len(rows),
            "status_counts": dict(sorted(status_counts.items())),
            "planned_deletes": status_counts.get("planned_delete_pending_approval", 0),
            "blocked": sum(count for status, count in status_counts.items() if status.startswith("blocked_")),
        },
        "rows": rows,
        "apply_guard": {
            "requires_apply": True,
            "confirmation_required": APPLY_CONFIRMATION,
            "stop_on_first_failed_absence_readback": True,
        },
        "notes": [
            "This packet is non-mutating unless --apply and the confirmation token are supplied.",
            "Deletion is scoped only to projects currently in the configured Legacy folder.",
            "Deleted Ahrefs projects may lose project-specific Web Analytics and Rank Tracker history; preserve evidence before apply.",
            "Raw Ahrefs Web Analytics data keys are not persisted; only presence is recorded.",
            "Use --only-project-id for a one-project canary before bulk purge.",
        ],
        "source_docs": [
            "https://docs.ahrefs.com/en/api/reference/management/delete-projects",
        ],
    }
    return payload, rows


def apply_deletes(payload: dict[str, Any], rows: list[dict[str, Any]], args: argparse.Namespace, output_dir: Path) -> int:
    if args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")
    admin = AhrefsLegacyPurgeAdmin(
        timeout_seconds=args.timeout_seconds,
        readback_delay_seconds=args.readback_delay_seconds,
        rate_limit_sleep_seconds=args.rate_limit_sleep_seconds,
    )
    payload["mutations_performed"] = True
    results: list[dict[str, Any]] = []
    for row in rows:
        if row["status"] != "planned_delete_pending_approval":
            continue
        project_id = row["project_id"]
        status, response_payload = admin.delete_project(project_id)
        if args.rate_limit_sleep_seconds:
            time.sleep(args.rate_limit_sleep_seconds)
        if args.readback_delay_seconds:
            time.sleep(args.readback_delay_seconds)
        projects = admin.get_projects()
        still_present = [
            project
            for project in projects
            if str(project.get("project_id") or project.get("id") or "") == project_id
        ]
        delete_proven = not still_present
        failure = None
        if status >= 400:
            failure = {"type": "HttpError", "message": f"Ahrefs DELETE returned status {status}"}
        elif not delete_proven:
            failure = {"type": "ReadbackMismatch", "message": "Project still appeared in roster after delete."}
        result = {
            "project_id": project_id,
            "project_name": row.get("project_name"),
            "target_url": row.get("url"),
            "delete_status": status,
            "delete_response": scrub_ahrefs_payload(response_payload),
            "still_present": [safe_project(project) for project in still_present],
            "delete_proven": delete_proven,
            "failure": failure,
        }
        results.append(result)
        payload["apply_results"] = results
        write_json(output_dir / "ahrefs_legacy_project_purge_plan.json", payload)
        if failure:
            return 1
    payload["apply_results"] = results
    return 0


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    lines = [
        "# Ahrefs Legacy Project Purge Plan",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Mode: `{payload['mode']}`",
        f"Mutations performed: `{payload['mutations_performed']}`",
        f"Legacy folder ID: `{payload['legacy_folder_id']}`",
        "",
        "## Summary",
        "",
        f"- legacy_folder_projects: {summary['legacy_folder_projects']}",
        f"- planned_deletes: {summary['planned_deletes']}",
        f"- blocked: {summary['blocked']}",
        "",
        "## Queue",
        "",
        "| Project ID | Project | Target | Status |",
        "| --- | --- | --- | --- |",
    ]
    for row in payload["rows"]:
        lines.append(
            "| `{project_id}` | {name} | {target} | `{status}` |".format(
                project_id=row.get("project_id") or "",
                name=row.get("project_name") or "",
                target=row.get("url") or "",
                status=row.get("status") or "",
            )
        )
    lines.extend(
        [
            "",
            "## Boundary",
            "",
            "- This lane deletes Ahrefs projects currently in the configured Legacy folder only.",
            "- It does not delete vanity-domain launch projects, retarget projects, change GA4, update Zaraz, route domains, touch WordPress, purge cache, or deploy Workers.",
            f"- Apply requires `--apply --confirm {APPLY_CONFIRMATION}` and stops on the first failed absence readback.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "project_id",
        "project_name",
        "url",
        "protocol",
        "mode",
        "keyword_count",
        "folder_id",
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
    parser = argparse.ArgumentParser(description="Plan or purge Ahrefs projects from a Legacy folder.")
    parser.add_argument("--legacy-folder-id", type=int, required=True)
    parser.add_argument("--only-project-id", action="append", help="Limit planning/apply to one or more project IDs.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--apply", action="store_true", help="Delete planned projects. Default is dry-run.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--readback-delay-seconds", type=float, default=2.0)
    parser.add_argument("--rate-limit-sleep-seconds", type=float, default=1.1)
    args = parser.parse_args()

    output_dir = Path(args.output_dir) / f"ahrefs-legacy-project-purge-{utc_stamp()}"
    output_dir.mkdir(parents=True, exist_ok=True)
    payload, rows = build_plan(args)
    exit_code = 0
    if args.apply:
        exit_code = apply_deletes(payload, rows, args, output_dir)

    plan_path = output_dir / "ahrefs_legacy_project_purge_plan.json"
    readout_path = output_dir / "AHREFS_LEGACY_PROJECT_PURGE_READOUT.md"
    csv_path = output_dir / "ahrefs_legacy_project_purge_plan.csv"
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
