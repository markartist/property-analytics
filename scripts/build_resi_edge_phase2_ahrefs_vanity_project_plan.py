#!/usr/bin/env python3
"""Plan or create Phase 2 vanity-domain Ahrefs projects.

This is scoped to the Phase 2 analytics profile packet. Default mode is
read-only. Apply requires an explicit confirmation token and verifies readback.
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
DEFAULT_ANALYTICS_PLAN_ROOT = ROOT / "reports/resi_edge_performance/phase2-analytics-profile-plan"
DEFAULT_OUTPUT_DIR = ROOT / "reports/ahrefs_admin/phase2_vanity_projects"
APPLY_CONFIRMATION = "CREATE_PHASE2_AHREFS_VANITY_PROJECTS"


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


def extract_rows(analytics_plan: dict[str, Any], only_property_codes: set[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in analytics_plan.get("properties") or []:
        property_code = str(row.get("property_code") or "").strip()
        if only_property_codes and property_code not in only_property_codes:
            continue
        ahrefs = row.get("ahrefs") or {}
        creation = ahrefs.get("project_creation_plan") or {}
        if not creation:
            continue
        rows.append(
            {
                "phase": row.get("phase"),
                "go_live": row.get("go_live"),
                "property_code": property_code,
                "property_name": row.get("property_name"),
                "vanity_domain": row.get("domain"),
                "legacy_project_id": ((ahrefs.get("legacy_project") or {}).get("project_id")),
                "project_name": creation.get("project_name"),
                "url": creation.get("url"),
                "normalized_target": normalize_target(str(creation.get("url") or "")),
                "protocol": creation.get("protocol") or "both",
                "mode": creation.get("mode") or "subdomains",
                "access": creation.get("access") or "shared",
            }
        )
    return rows


@dataclass
class AhrefsVanityProjectAdmin:
    timeout_seconds: int
    readback_delay_seconds: float
    rate_limit_sleep_seconds: float
    folder_id: int | None
    owned_by: str | None

    def __post_init__(self) -> None:
        credentials = resolve_ahrefs_credentials()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-Phase2AhrefsVanityProjects/1.0",
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

    def create_project(self, row: dict[str, Any]) -> tuple[int, dict[str, Any] | None, dict[str, Any]]:
        body: dict[str, Any] = {
            "access": row["access"],
            "protocol": row["protocol"],
            "url": row["url"],
            "mode": row["mode"],
            "project_name": row["project_name"],
        }
        if self.folder_id is not None:
            body["folder_id"] = self.folder_id
        if self.owned_by:
            body["owned_by"] = self.owned_by
        status, payload = self.request("POST", "/management/projects", json=body)
        if self.rate_limit_sleep_seconds:
            time.sleep(self.rate_limit_sleep_seconds)
        return status, payload, body


def status_for_row(row: dict[str, Any], matches: list[dict[str, Any]], duplicate_matches: list[dict[str, Any]]) -> str:
    if duplicate_matches:
        return "blocked_duplicate_vanity_target_matches"
    if matches:
        return "ready_existing_vanity_project_found"
    return "planned_create_vanity_project_pending_approval"


def build_plan(args: argparse.Namespace) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    generated_at = datetime.now(UTC)
    analytics_plan_path = Path(args.analytics_plan) if args.analytics_plan else latest_analytics_plan(DEFAULT_ANALYTICS_PLAN_ROOT)
    analytics_plan = read_json(analytics_plan_path)
    only_property_codes = {value.strip() for value in (args.only_property_code or []) if value.strip()}

    admin = AhrefsVanityProjectAdmin(
        timeout_seconds=args.timeout_seconds,
        readback_delay_seconds=args.readback_delay_seconds,
        rate_limit_sleep_seconds=args.rate_limit_sleep_seconds,
        folder_id=args.folder_id,
        owned_by=args.owned_by,
    )
    roster_error: dict[str, str] | None = None
    try:
        projects = admin.get_projects()
    except Exception as exc:  # pragma: no cover - exercised in local ops
        projects = []
        roster_error = provider_error(exc)

    projects_by_target: dict[str, list[dict[str, Any]]] = {}
    for project in projects:
        target = normalize_target(str(project.get("url") or ""))
        if target:
            projects_by_target.setdefault(target, []).append(project)

    rows: list[dict[str, Any]] = []
    for source in extract_rows(analytics_plan, only_property_codes):
        matches = projects_by_target.get(source["normalized_target"], [])
        status = "blocked_ahrefs_roster_unavailable" if roster_error else status_for_row(source, matches, matches[1:])
        rows.append(
            {
                **source,
                "status": status,
                "programmatic_action": (
                    "create_project"
                    if status == "planned_create_vanity_project_pending_approval"
                    else "none"
                ),
                "existing_matches": [safe_project(project) for project in matches],
                "future_apply_preview": (
                    {
                        "access": source["access"],
                        "protocol": source["protocol"],
                        "url": source["url"],
                        "mode": source["mode"],
                        "project_name": source["project_name"],
                        **({"folder_id": args.folder_id} if args.folder_id is not None else {}),
                        **({"owned_by": args.owned_by} if args.owned_by else {}),
                    }
                    if status == "planned_create_vanity_project_pending_approval"
                    else None
                ),
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
        "analytics_profile_plan": str(analytics_plan_path),
        "provider_roster_state": {
            "attempted": True,
            "available": roster_error is None,
            "error": roster_error,
            "project_count": len(projects),
        },
        "filters": {
            "only_property_codes": sorted(only_property_codes),
        },
        "summary": {
            "total_properties": len(rows),
            "status_counts": dict(sorted(status_counts.items())),
            "planned_creates": status_counts.get("planned_create_vanity_project_pending_approval", 0),
            "existing_vanity_projects": status_counts.get("ready_existing_vanity_project_found", 0),
            "blocked": sum(count for status, count in status_counts.items() if status.startswith("blocked_")),
        },
        "rows": rows,
        "apply_guard": {
            "requires_apply": True,
            "confirmation_required": APPLY_CONFIRMATION,
            "stop_on_first_failed_readback": True,
        },
        "notes": [
            "This packet is non-mutating unless --apply and the confirmation token are supplied.",
            "Project creation is scoped only to rows in the Phase 2 analytics profile plan.",
            "Existing exact vanity target matches are reused and not recreated.",
            "Raw Ahrefs Web Analytics data keys are not persisted; only presence is recorded on readback.",
            "Use --only-property-code for a one-project canary before bulk creation.",
        ],
    }
    return payload, rows


def apply_creates(payload: dict[str, Any], rows: list[dict[str, Any]], args: argparse.Namespace, output_dir: Path) -> int:
    if args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")
    admin = AhrefsVanityProjectAdmin(
        timeout_seconds=args.timeout_seconds,
        readback_delay_seconds=args.readback_delay_seconds,
        rate_limit_sleep_seconds=args.rate_limit_sleep_seconds,
        folder_id=args.folder_id,
        owned_by=args.owned_by,
    )
    payload["mutations_performed"] = True
    results: list[dict[str, Any]] = []
    for row in rows:
        if row["status"] != "planned_create_vanity_project_pending_approval":
            continue
        status, response_payload, request_body = admin.create_project(row)
        if args.readback_delay_seconds:
            time.sleep(args.readback_delay_seconds)
        projects = admin.get_projects()
        matches = [
            project
            for project in projects
            if normalize_target(str(project.get("url") or "")) == row["normalized_target"]
        ]
        create_proven = bool(matches)
        failure = None
        if status >= 400:
            failure = {"type": "HttpError", "message": f"Ahrefs POST returned status {status}"}
        elif not create_proven:
            failure = {"type": "ReadbackMismatch", "message": "Project target was not found in roster readback."}
        result = {
            "property_code": row.get("property_code"),
            "property_name": row.get("property_name"),
            "target_url": row.get("url"),
            "request_body": request_body,
            "post_status": status,
            "post_response": scrub_ahrefs_payload(response_payload),
            "readback_matches": [safe_project(project) for project in matches],
            "create_proven": create_proven,
            "failure": failure,
        }
        results.append(result)
        payload["apply_results"] = results
        write_json(output_dir / "phase2_ahrefs_vanity_project_plan.json", payload)
        if failure:
            return 1
    payload["apply_results"] = results
    return 0


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    lines = [
        "# Phase 2 Ahrefs Vanity Project Plan",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Mode: `{payload['mode']}`",
        f"Mutations performed: `{payload['mutations_performed']}`",
        f"Source plan: `{payload['analytics_profile_plan']}`",
        "",
        "## Summary",
        "",
        f"- total_properties: {summary['total_properties']}",
        f"- planned_creates: {summary['planned_creates']}",
        f"- existing_vanity_projects: {summary['existing_vanity_projects']}",
        f"- blocked: {summary['blocked']}",
        "",
        "## Queue",
        "",
        "| Property | Code | Vanity Target | Status | Existing Project |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in payload["rows"]:
        matches = row.get("existing_matches") or []
        existing = ", ".join(match.get("project_id") or "" for match in matches) if matches else ""
        lines.append(
            "| {property} | `{code}` | {target} | `{status}` | {existing} |".format(
                property=row.get("property_name") or "",
                code=row.get("property_code") or "",
                target=row.get("url") or "",
                status=row.get("status") or "",
                existing=existing,
            )
        )
    lines.extend(
        [
            "",
            "## Boundary",
            "",
            "- This lane creates/reuses Ahrefs vanity-domain projects only.",
            "- It does not retarget legacy projects, delete projects, change GA4, update Zaraz, route domains, touch WordPress, purge cache, or deploy Workers.",
            f"- Apply requires `--apply --confirm {APPLY_CONFIRMATION}` and stops on the first failed readback.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "property_code",
        "property_name",
        "vanity_domain",
        "url",
        "protocol",
        "mode",
        "project_name",
        "legacy_project_id",
        "status",
        "programmatic_action",
        "existing_project_ids",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            matches = row.get("existing_matches") or []
            writer.writerow(
                {
                    "property_code": row.get("property_code"),
                    "property_name": row.get("property_name"),
                    "vanity_domain": row.get("vanity_domain"),
                    "url": row.get("url"),
                    "protocol": row.get("protocol"),
                    "mode": row.get("mode"),
                    "project_name": row.get("project_name"),
                    "legacy_project_id": row.get("legacy_project_id"),
                    "status": row.get("status"),
                    "programmatic_action": row.get("programmatic_action"),
                    "existing_project_ids": ",".join(match.get("project_id") or "" for match in matches),
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan or create Phase 2 Ahrefs vanity-domain projects.")
    parser.add_argument("--analytics-plan", help="analytics_profile_plan.json path. Defaults to latest Phase 2 plan.")
    parser.add_argument("--only-property-code", action="append", help="Limit planning/apply to one or more property codes.")
    parser.add_argument("--folder-id", type=int, help="Optional Ahrefs folder ID for created vanity projects.")
    parser.add_argument("--owned-by", help="Ahrefs owner email. Defaults to workspace owner when omitted.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--apply", action="store_true", help="Create planned projects. Default is dry-run.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--readback-delay-seconds", type=float, default=2.0)
    parser.add_argument("--rate-limit-sleep-seconds", type=float, default=1.1)
    args = parser.parse_args()

    output_dir = Path(args.output_dir) / f"phase2-ahrefs-vanity-projects-{utc_stamp()}"
    output_dir.mkdir(parents=True, exist_ok=True)
    payload, rows = build_plan(args)
    exit_code = 0
    if args.apply:
        exit_code = apply_creates(payload, rows, args, output_dir)

    plan_path = output_dir / "phase2_ahrefs_vanity_project_plan.json"
    readout_path = output_dir / "PHASE2_AHREFS_VANITY_PROJECT_READOUT.md"
    csv_path = output_dir / "phase2_ahrefs_vanity_project_plan.csv"
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
