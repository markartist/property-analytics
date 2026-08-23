#!/usr/bin/env python3
"""Probe or apply an Ahrefs project target update with readback evidence.

This is intentionally separate from the project-creation planner because target
updates are account mutations. Default mode is dry-run. Apply requires an
explicit confirmation token and writes before/after evidence without persisting
raw Web Analytics data keys.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.ahrefs_project_admin import API_BASE_URL, normalize_target  # noqa: E402
from utils.ahrefs_auth import resolve_ahrefs_credentials  # noqa: E402


UTC = timezone.utc
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "ahrefs_admin" / "target_updates"
APPLY_CONFIRMATION = "UPDATE_AHREFS_PROJECT_TARGET"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def utc_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_project(project: dict[str, Any] | None) -> dict[str, Any] | None:
    if not project:
        return None
    return {
        "access": project.get("access"),
        "folder": project.get("folder"),
        "id": project.get("id"),
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
class AhrefsTargetUpdater:
    timeout_seconds: int

    def __post_init__(self) -> None:
        credentials = resolve_ahrefs_credentials()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-AhrefsTargetUpdater/1.0",
            }
        )

    def request(self, method: str, path: str, **kwargs: Any) -> tuple[int, dict[str, Any] | None]:
        response = self.session.request(method, f"{API_BASE_URL}{path}", timeout=self.timeout_seconds, **kwargs)
        try:
            payload = response.json() if response.content else None
        except ValueError:
            payload = {"raw_text": response.text[:1000]}
        return response.status_code, payload

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        status, payload = self.request("GET", "/management/projects", params={"project_id": project_id})
        if status >= 400:
            raise RuntimeError(f"Ahrefs project read failed with status {status}: {payload}")
        projects = (payload or {}).get("projects") or []
        if not projects:
            return None
        return projects[0] if isinstance(projects[0], dict) else None

    def patch_project(self, body: dict[str, Any]) -> tuple[int, dict[str, Any] | None]:
        return self.request("PATCH", "/management/update-project", json=body)


def build_patch_body(args: argparse.Namespace, before: dict[str, Any]) -> dict[str, Any]:
    body: dict[str, Any] = {
        "project_id": int(args.project_id),
        "url": args.url,
    }
    if args.protocol:
        body["protocol"] = args.protocol
    if args.mode:
        body["mode"] = args.mode
    if args.project_name:
        body["project_name"] = args.project_name
    elif args.keep_project_name:
        current_name = before.get("project_name") or before.get("name")
        if current_name:
            body["project_name"] = current_name
    if args.include_access:
        body["access"] = args.include_access
    return body


def main() -> None:
    parser = argparse.ArgumentParser(description="Dry-run or apply an Ahrefs project target URL update.")
    parser.add_argument("--project-id", required=True, help="Ahrefs project id.")
    parser.add_argument("--url", required=True, help="New Ahrefs project target URL, e.g. example.com/")
    parser.add_argument("--protocol", choices=["both", "http", "https"], help="New protocol, if supported.")
    parser.add_argument("--mode", choices=["exact", "prefix", "domain", "subdomains"], help="New scope mode, if supported.")
    parser.add_argument("--project-name", help="New project name, if supported.")
    parser.add_argument("--keep-project-name", action="store_true", help="Send the current project name in the patch body.")
    parser.add_argument("--include-access", choices=["private", "shared"], help="Include access in the patch body.")
    parser.add_argument("--apply", action="store_true", help="Perform the PATCH. Default only writes the proposed body.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--readback-delay-seconds", type=float, default=2.0)
    args = parser.parse_args()

    generated = utc_iso()
    output_dir = Path(args.output_dir) / f"ahrefs-target-update-{args.project_id}-{utc_stamp()}"
    updater = AhrefsTargetUpdater(timeout_seconds=args.timeout_seconds)
    before_raw = updater.get_project(args.project_id)
    if not before_raw:
        raise SystemExit(f"Ahrefs project {args.project_id} was not found.")

    patch_body = build_patch_body(args, before_raw)
    before = safe_project(before_raw)
    proposed = {
        "project_id": str(args.project_id),
        "new_url": args.url,
        "new_normalized_target": normalize_target(args.url),
        "new_protocol": args.protocol,
        "new_mode": args.mode,
        "new_project_name": args.project_name,
    }

    result: dict[str, Any] = {
        "generated_at": generated,
        "mutations_performed": False,
        "mode": "apply" if args.apply else "dry_run",
        "project_id": str(args.project_id),
        "before": before,
        "proposed": proposed,
        "patch_body": patch_body,
        "confirmation_required": APPLY_CONFIRMATION,
        "patch_status": None,
        "patch_response": None,
        "after": None,
        "target_update_proven": False,
        "notes": [
            "Raw Ahrefs Web Analytics data keys are not persisted; only presence is recorded.",
            "This script mutates Ahrefs only when --apply and the confirmation token are supplied.",
        ],
    }

    if args.apply:
        if args.confirm != APPLY_CONFIRMATION:
            raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")
        status, payload = updater.patch_project(patch_body)
        result["mutations_performed"] = True
        result["patch_status"] = status
        result["patch_response"] = payload
        if args.readback_delay_seconds:
            time.sleep(args.readback_delay_seconds)
        after_raw = updater.get_project(args.project_id)
        result["after"] = safe_project(after_raw)
        result["target_update_proven"] = bool(
            result["after"]
            and result["after"].get("normalized_target") == normalize_target(args.url)
            and (not args.protocol or result["after"].get("protocol") == args.protocol)
            and (not args.mode or result["after"].get("mode") == args.mode)
        )
        if status >= 400 or not result["target_update_proven"]:
            result["failure"] = {
                "reason": "patch_failed_or_readback_did_not_match",
                "status": status,
            }
    else:
        result["after"] = before

    evidence_path = output_dir / "ahrefs_target_update_evidence.json"
    write_json(evidence_path, result)
    print(
        json.dumps(
            {
                "evidence_path": str(evidence_path),
                "mode": result["mode"],
                "mutations_performed": result["mutations_performed"],
                "patch_status": result["patch_status"],
                "target_update_proven": result["target_update_proven"],
                "before": before,
                "proposed": proposed,
                "after": result["after"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    if args.apply and (result.get("failure") or not result["target_update_proven"]):
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": provider_error(exc)}, indent=2, sort_keys=True), file=sys.stderr)
        raise
