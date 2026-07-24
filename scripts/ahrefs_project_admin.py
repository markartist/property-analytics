#!/usr/bin/env python3
"""Plan and create Ahrefs projects from the governed property identity matrix."""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import (  # noqa: E402
    load_property_identities,
    normalize_property_key,
    resolve_property_identity,
)
from utils.ahrefs_auth import resolve_ahrefs_credentials  # noqa: E402

API_BASE_URL = "https://api.ahrefs.com/v3"
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "ahrefs_admin"
APPLY_CONFIRMATION = "CREATE_AHREFS_PROJECTS"


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def normalize_target(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    host = (parsed.netloc or parsed.path.split("/")[0]).lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path or "/"
    path = "/" + path.lstrip("/")
    while "//" in path:
        path = path.replace("//", "/")
    if path != "/":
        path = path.rstrip("/") + "/"
    return f"{host}{path}"


def ahrefs_url_from_website(website_url: str) -> str:
    parsed = urlparse(website_url if "://" in website_url else f"https://{website_url}")
    host = (parsed.netloc or parsed.path.split("/")[0]).lower()
    path = parsed.path or "/"
    if path and path != "/":
        return f"{host}{path.rstrip('/')}/"
    return f"{host}/"


def infer_project_scope(website_url: str) -> tuple[str, str]:
    parsed = urlparse(website_url if "://" in website_url else f"https://{website_url}")
    host = (parsed.netloc or "").lower()
    path = parsed.path or "/"
    if host.endswith("venterraliving.com") and path.rstrip("/").startswith("/apartments/"):
        return "https", "prefix"
    return "both", "subdomains"


def project_name_for_property(identity: Any) -> str:
    code = identity.property_code or identity.display_property_id or identity.canonical_property_id
    return f"{identity.property_name} ({code})"


def compact_identity_key(value: str | None) -> str:
    return "".join(ch for ch in normalize_property_key(value) if ch.isalnum())


def identity_for_legacy_project(
    project: dict[str, Any],
    desired_by_property_id: dict[str, dict[str, Any]],
) -> tuple[Any | None, str | None, str | None]:
    """Best-effort review match for existing standalone/pilot Ahrefs projects.

    This does not create a source mapping. It only helps the admin plan show
    likely projects whose current standalone target may need a future canonical
    prefix project or a manual Ahrefs UI rename.
    """
    project_name = str(project.get("project_name") or "")
    target_url = str(project.get("url") or "")
    normalized_target = normalize_target(target_url)
    host = normalized_target.split("/", 1)[0]
    host_without_tld = host.rsplit(".", 1)[0] if "." in host else host
    candidates = [project_name, host_without_tld, target_url]
    for candidate in candidates:
        identity = resolve_property_identity(candidate)
        if identity and identity.marketing_bi_property_id in desired_by_property_id:
            return identity, "property_identity_lookup", candidate

    project_compacts = [compact_identity_key(candidate) for candidate in candidates]
    best: tuple[Any | None, str | None, str | None] = (None, None, None)
    for desired in desired_by_property_id.values():
        property_compacts = [
            compact_identity_key(desired["property_name"]),
            compact_identity_key(desired["project_name"]),
        ]
        for property_compact in property_compacts:
            if len(property_compact) < 5:
                continue
            for project_compact in project_compacts:
                if len(project_compact) < 5:
                    continue
                if property_compact in project_compact or project_compact in property_compact:
                    identity = desired["_identity"]
                    return identity, "compact_name_heuristic", project_name or target_url
    return best


@dataclass
class AhrefsProjectAdmin:
    access: str
    folder_id: int | None
    owned_by: str | None
    timeout_seconds: int
    rate_limit_sleep_seconds: float

    def __post_init__(self) -> None:
        credentials = resolve_ahrefs_credentials()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-AhrefsProjectAdmin/1.0",
            }
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> tuple[int, dict[str, Any] | None]:
        response = self.session.request(
            method,
            f"{API_BASE_URL}{path}",
            timeout=self.timeout_seconds,
            **kwargs,
        )
        payload = response.json() if response.content else None
        return response.status_code, payload

    def get_projects(self) -> list[dict[str, Any]]:
        status, payload = self._request("GET", "/management/projects")
        if status >= 400 or not payload:
            raise RuntimeError(f"Ahrefs project roster failed with status {status}: {payload}")
        projects = payload.get("projects") or []
        if not isinstance(projects, list):
            return []
        return projects

    def create_project(self, planned: dict[str, Any]) -> dict[str, Any]:
        body = {
            "access": self.access,
            "protocol": planned["protocol"],
            "url": planned["url"],
            "mode": planned["mode"],
            "project_name": planned["project_name"],
        }
        if self.folder_id is not None:
            body["folder_id"] = self.folder_id
        if self.owned_by:
            body["owned_by"] = self.owned_by
        status, payload = self._request("POST", "/management/projects", json=body)
        if self.rate_limit_sleep_seconds:
            time.sleep(self.rate_limit_sleep_seconds)
        if status >= 400:
            raise RuntimeError(f"Ahrefs project create failed with status {status}: {payload}")
        return payload or {}


def build_plan(
    existing_projects: list[dict[str, Any]],
    *,
    include_unresolved_website_urls: bool = False,
) -> dict[str, Any]:
    existing_by_target: dict[str, list[dict[str, Any]]] = {}
    for project in existing_projects:
        key = normalize_target(str(project.get("url") or ""))
        if key:
            existing_by_target.setdefault(key, []).append(project)

    desired: list[dict[str, Any]] = []
    desired_by_property_id: dict[str, dict[str, Any]] = {}
    skipped: list[dict[str, Any]] = []
    for identity in load_property_identities():
        website_url = identity.website_url or identity.gsc_url
        if not website_url:
            skipped.append(
                {
                    "property_id": identity.marketing_bi_property_id,
                    "property_name": identity.property_name,
                    "reason": "missing_website_url",
                }
            )
            continue
        protocol, mode = infer_project_scope(website_url)
        target_url = ahrefs_url_from_website(website_url)
        normalized_target = normalize_target(target_url)
        item = {
            "_identity": identity,
            "property_id": identity.marketing_bi_property_id,
            "canonical_property_id": identity.canonical_property_id,
            "community_id": identity.community_id,
            "property_name": identity.property_name,
            "website_url": website_url,
            "url": target_url,
            "normalized_target": normalized_target,
            "protocol": protocol,
            "mode": mode,
            "project_name": project_name_for_property(identity),
        }
        desired.append(item)
        desired_by_property_id[identity.marketing_bi_property_id] = item

    existing_matches: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    name_normalization_needed: list[dict[str, Any]] = []
    standalone_property_projects: list[dict[str, Any]] = []
    matched_existing_project_ids: set[str] = set()
    for item in desired:
        matches = existing_by_target.get(item["normalized_target"], [])
        if matches:
            matched_existing_project_ids.update(str(project.get("project_id")) for project in matches)
            existing_matches.append(
                {
                    **{k: v for k, v in item.items() if k != "_identity"},
                    "existing_project_ids": [str(project.get("project_id")) for project in matches],
                    "existing_project_names": [project.get("project_name") for project in matches],
                }
            )
            for project in matches:
                if project.get("project_name") != item["project_name"]:
                    name_normalization_needed.append(
                        {
                            "project_id": str(project.get("project_id")),
                            "current_project_name": project.get("project_name"),
                            "desired_project_name": item["project_name"],
                            "property_id": item["property_id"],
                            "property_name": item["property_name"],
                            "target_url": project.get("url"),
                            "api_status": "manual_or_ui_only",
                            "note": "Ahrefs public PATCH update-project currently documents access updates only.",
                        }
                    )
                if item["mode"] != "prefix":
                    standalone_property_projects.append(
                        {
                            "project_id": str(project.get("project_id")),
                            "current_project_name": project.get("project_name"),
                            "desired_project_name": item["project_name"],
                            "property_id": item["property_id"],
                            "property_name": item["property_name"],
                            "current_target_url": project.get("url"),
                            "current_protocol": project.get("protocol"),
                            "current_mode": project.get("mode"),
                            "matrix_website_url": item["website_url"],
                            "future_subdirectory_status": "requires_property_identity_matrix_website_url_update_first",
                            "note": "Create a canonical prefix project only after the governed identity matrix moves this property to a venterraliving.com/apartments/... website URL.",
                        }
                    )
        else:
            missing.append(item)

    duplicate_existing_targets = [
        {
            "normalized_target": target,
            "project_ids": [str(project.get("project_id")) for project in projects],
            "project_names": [project.get("project_name") for project in projects],
        }
        for target, projects in sorted(existing_by_target.items())
        if len(projects) > 1
    ]
    existing_unmatched_projects: list[dict[str, Any]] = []
    legacy_target_candidates: list[dict[str, Any]] = []
    review_only_projects: list[dict[str, Any]] = []
    for project in existing_projects:
        if str(project.get("project_id")) in matched_existing_project_ids:
            continue
        unmatched = {
            "project_id": str(project.get("project_id")),
            "project_name": project.get("project_name"),
            "target_url": project.get("url"),
            "normalized_target": normalize_target(str(project.get("url") or "")),
            "mode": project.get("mode"),
            "protocol": project.get("protocol"),
            "verified": project.get("verified"),
        }
        existing_unmatched_projects.append(unmatched)
        identity, match_method, match_value = identity_for_legacy_project(project, desired_by_property_id)
        if identity:
            desired_item = desired_by_property_id[identity.marketing_bi_property_id]
            legacy_target_candidates.append(
                {
                    **unmatched,
                    "property_id": desired_item["property_id"],
                    "property_name": desired_item["property_name"],
                    "desired_project_name": desired_item["project_name"],
                    "desired_target_url": desired_item["url"],
                    "desired_protocol": desired_item["protocol"],
                    "desired_mode": desired_item["mode"],
                    "match_method": match_method,
                    "match_value": match_value,
                    "canonical_target_already_exists": bool(existing_by_target.get(desired_item["normalized_target"])),
                    "recommended_next_step": "create_canonical_prefix_project_then_review_legacy_project",
                    "api_status": "target_and_name_edits_not_documented_in_public_api",
                }
            )
        else:
            review_only_projects.append(unmatched)

    missing_by_mode: dict[str, int] = {}
    for item in missing:
        missing_by_mode[item["mode"]] = missing_by_mode.get(item["mode"], 0) + 1

    serializable_desired = [{k: v for k, v in item.items() if k != "_identity"} for item in desired]
    serializable_missing = [{k: v for k, v in item.items() if k != "_identity"} for item in missing]

    return {
        "generated_at": utc_timestamp(),
        "source": "property_identity_matrix",
        "mode": "plan",
        "desired_property_projects": len(serializable_desired),
        "existing_ahrefs_projects": len(existing_projects),
        "matched_property_projects": len(existing_matches),
        "missing_property_projects": len(serializable_missing),
        "missing_by_mode": missing_by_mode,
        "name_normalization_needed_count": len(name_normalization_needed),
        "standalone_property_project_count": len(standalone_property_projects),
        "legacy_target_candidate_count": len(legacy_target_candidates),
        "review_only_existing_projects_count": len(review_only_projects),
        "admin_api_capabilities": {
            "create_projects": "supported_free_endpoint",
            "update_access": "supported_free_endpoint",
            "rename_project": "not_documented_in_public_update_project_request_body",
            "update_target_url_protocol_or_mode": "not_documented_in_public_update_project_request_body",
        },
        "skipped_properties": skipped,
        "duplicate_existing_targets": duplicate_existing_targets,
        "existing_unmatched_projects": existing_unmatched_projects,
        "name_normalization_needed": name_normalization_needed,
        "standalone_property_projects": standalone_property_projects,
        "legacy_target_candidates": legacy_target_candidates,
        "review_only_existing_projects": review_only_projects,
        "existing_matches": existing_matches,
        "missing": serializable_missing,
        "notes": [
            "Project creation is a live Ahrefs account mutation and requires --apply plus --confirm CREATE_AHREFS_PROJECTS.",
            "Standalone domains default to protocol=both, mode=subdomains.",
            "venterraliving.com/apartments/... property pages default to protocol=https, mode=prefix.",
            "Ahrefs public PATCH /management/update-project currently documents access updates only; project name and target normalization are review/manual until Ahrefs exposes those fields.",
        ],
    }


def write_plan(plan: dict[str, Any], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = output_dir / f"ahrefs_project_plan_{stamp}.json"
    path.write_text(json.dumps(plan, indent=2, sort_keys=True), encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan or create Ahrefs projects from the property identity matrix.")
    parser.add_argument("--apply", action="store_true", help="Create missing Ahrefs projects. Default is dry-run.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--access", choices=["private", "shared"], default="shared")
    parser.add_argument("--folder-id", type=int)
    parser.add_argument("--owned-by", help="Ahrefs owner email. Defaults to workspace owner when omitted.")
    parser.add_argument("--limit", type=int, help="Limit number of missing projects to create during --apply.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--rate-limit-sleep-seconds", type=float, default=1.1)
    args = parser.parse_args()

    admin = AhrefsProjectAdmin(
        access=args.access,
        folder_id=args.folder_id,
        owned_by=args.owned_by,
        timeout_seconds=args.timeout_seconds,
        rate_limit_sleep_seconds=args.rate_limit_sleep_seconds,
    )
    existing_projects = admin.get_projects()
    plan = build_plan(existing_projects)
    plan_path = write_plan(plan, Path(args.output_dir))

    print(json.dumps(
        {
            "mode": "apply" if args.apply else "dry-run",
            "plan_path": str(plan_path),
            "desired_property_projects": plan["desired_property_projects"],
            "existing_ahrefs_projects": plan["existing_ahrefs_projects"],
            "matched_property_projects": plan["matched_property_projects"],
            "missing_property_projects": plan["missing_property_projects"],
            "missing_by_mode": plan["missing_by_mode"],
            "name_normalization_needed_count": plan["name_normalization_needed_count"],
            "standalone_property_project_count": plan["standalone_property_project_count"],
            "legacy_target_candidate_count": plan["legacy_target_candidate_count"],
            "review_only_existing_projects_count": plan["review_only_existing_projects_count"],
            "duplicate_existing_targets": len(plan["duplicate_existing_targets"]),
            "admin_api_capabilities": plan["admin_api_capabilities"],
            "existing_unmatched_projects": plan["existing_unmatched_projects"],
            "name_normalization_needed": plan["name_normalization_needed"],
            "standalone_property_projects": plan["standalone_property_projects"],
            "legacy_target_candidates": plan["legacy_target_candidates"],
            "review_only_existing_projects": plan["review_only_existing_projects"],
            "first_missing": plan["missing"][:20],
        },
        indent=2,
        sort_keys=True,
    ))

    if not args.apply:
        return
    if args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")

    missing = plan["missing"]
    if args.limit is not None:
        missing = missing[: max(args.limit, 0)]

    created: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for item in missing:
        try:
            response = admin.create_project(item)
            created.append(
                {
                    "property_id": item["property_id"],
                    "property_name": item["property_name"],
                    "url": item["url"],
                    "response_project_ids": [
                        str(project.get("project_id"))
                        for project in response.get("projects", [])
                        if isinstance(project, dict)
                    ],
                }
            )
        except Exception as exc:
            failures.append(
                {
                    "property_id": item["property_id"],
                    "property_name": item["property_name"],
                    "url": item["url"],
                    "error": str(exc)[:500],
                }
            )

    apply_result = {
        "generated_at": utc_timestamp(),
        "plan_path": str(plan_path),
        "created_count": len(created),
        "failure_count": len(failures),
        "created": created,
        "failures": failures,
    }
    result_path = Path(args.output_dir) / f"ahrefs_project_apply_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    result_path.write_text(json.dumps(apply_result, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(apply_result | {"result_path": str(result_path)}, indent=2, sort_keys=True))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
