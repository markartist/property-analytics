#!/usr/bin/env python3
"""Plan and add Ahrefs project competitors from governed local mappings."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

UTC = timezone.utc

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import (  # noqa: E402
    PropertyIdentity,
    load_property_identities,
    resolve_property_identity,
)
from scripts.ahrefs_project_admin import (  # noqa: E402
    ahrefs_url_from_website,
    normalize_target,
    project_name_for_property,
)
from utils.ahrefs_auth import resolve_ahrefs_credentials  # noqa: E402

API_BASE_URL = "https://api.ahrefs.com/v3"
DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "ahrefs_admin"
APPLY_CONFIRMATION = "ADD_AHREFS_COMPETITORS"


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def compact_project_id(value: str | int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid Ahrefs project_id: {value}") from exc


def competitor_target(value: str | None) -> tuple[str, str, str]:
    """Return Ahrefs competitor URL, mode, and normalized comparison key."""
    raw = (value or "").strip()
    if not raw:
        return "", "", ""
    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    host = (parsed.netloc or parsed.path.split("/")[0]).lower()
    if host.startswith("www."):
        host = host[4:]
    if not host or "." not in host:
        return "", "", ""
    path = parsed.path or "/"
    path = "/" + path.lstrip("/")
    while "//" in path:
        path = path.replace("//", "/")
    if path != "/":
        path = path.rstrip("/") + "/"
        return f"https://{host}{path}", "prefix", f"{host}{path}"
    return f"https://{host}/", "subdomains", f"{host}/"


def identity_payload(identity: PropertyIdentity) -> dict[str, Any]:
    return {
        "property_id": identity.marketing_bi_property_id,
        "canonical_property_id": identity.canonical_property_id,
        "property_code": identity.property_code,
        "community_id": identity.community_id,
        "property_name": identity.property_name,
        "desired_project_name": project_name_for_property(identity),
        "website_url": identity.website_url or identity.gsc_url,
    }


def read_local_ahrefs_projects(db_path: Path) -> list[dict[str, Any]]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT project_id, project_name, target_url, mode, protocol,
                   property_id, community_id, property_name, identity_match_source
            FROM ahrefs_projects
            """
        ).fetchall()
    return [dict(row) for row in rows]


def canonical_project_by_property(
    identities: tuple[PropertyIdentity, ...],
    ahrefs_projects: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    projects_by_target: dict[str, list[dict[str, Any]]] = {}
    for project in ahrefs_projects:
        key = normalize_target(str(project.get("target_url") or ""))
        if key:
            projects_by_target.setdefault(key, []).append(project)

    canonical: dict[str, dict[str, Any]] = {}
    warnings: list[dict[str, Any]] = []
    for identity in identities:
        website_url = identity.website_url or identity.gsc_url
        if not website_url:
            warnings.append(identity_payload(identity) | {"warning": "missing_property_website_url"})
            continue
        desired_target = normalize_target(ahrefs_url_from_website(website_url))
        matches = projects_by_target.get(desired_target, [])
        if not matches:
            warnings.append(
                identity_payload(identity)
                | {
                    "warning": "missing_canonical_ahrefs_project",
                    "desired_target_url": desired_target,
                }
            )
            continue
        selected = sorted(matches, key=lambda item: str(item.get("project_id") or ""))[0]
        canonical[identity.marketing_bi_property_id] = {
            **selected,
            "desired_target_url": desired_target,
            "identity": identity_payload(identity),
        }
        if len(matches) > 1:
            warnings.append(
                identity_payload(identity)
                | {
                    "warning": "duplicate_canonical_ahrefs_project_targets",
                    "desired_target_url": desired_target,
                    "selected_project_id": selected.get("project_id"),
                    "all_project_ids": [project.get("project_id") for project in matches],
                }
            )
    return canonical, warnings


def load_local_competitors(
    db_path: Path,
    identities: tuple[PropertyIdentity, ...],
    canonical_projects: dict[str, dict[str, Any]],
) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]], list[dict[str, Any]]]:
    identity_ids = {identity.marketing_bi_property_id for identity in identities}
    competitors_by_property: dict[str, list[dict[str, Any]]] = {property_id: [] for property_id in identity_ids}
    skipped: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    seen_by_property: dict[str, set[str]] = {}

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT pc.id AS property_competitor_id,
                   pc.property_id AS source_property_id,
                   pc.competitor_rank,
                   pc.data_source,
                   c.competitor_id,
                   c.competitor_name,
                   c.competitor_domain,
                   c.competitor_url
            FROM property_competitors pc
            JOIN competitors c ON c.competitor_id = pc.competitor_id
            ORDER BY pc.property_id, COALESCE(pc.competitor_rank, 9999), c.competitor_name
            """
        ).fetchall()

    for row in rows:
        source_property_id = str(row["source_property_id"] or "")
        identity = resolve_property_identity(source_property_id)
        if not identity:
            unresolved.append(
                {
                    "property_competitor_id": row["property_competitor_id"],
                    "source_property_id": source_property_id,
                    "competitor_id": row["competitor_id"],
                    "competitor_name": row["competitor_name"],
                }
            )
            continue

        property_id = identity.marketing_bi_property_id
        source_target = row["competitor_url"] or row["competitor_domain"]
        url, mode, normalized = competitor_target(source_target)
        if not normalized:
            skipped.append(
                {
                    "property_id": property_id,
                    "property_name": identity.property_name,
                    "source_property_id": source_property_id,
                    "competitor_id": row["competitor_id"],
                    "competitor_name": row["competitor_name"],
                    "reason": "missing_or_invalid_competitor_url",
                }
            )
            continue

        project_target = str(canonical_projects.get(property_id, {}).get("desired_target_url") or "")
        if normalized == project_target:
            skipped.append(
                {
                    "property_id": property_id,
                    "property_name": identity.property_name,
                    "source_property_id": source_property_id,
                    "competitor_id": row["competitor_id"],
                    "competitor_name": row["competitor_name"],
                    "competitor_url": url,
                    "reason": "self_target",
                }
            )
            continue

        dedupe_key = f"{normalized}|{mode}"
        if dedupe_key in seen_by_property.setdefault(property_id, set()):
            skipped.append(
                {
                    "property_id": property_id,
                    "property_name": identity.property_name,
                    "source_property_id": source_property_id,
                    "competitor_id": row["competitor_id"],
                    "competitor_name": row["competitor_name"],
                    "competitor_url": url,
                    "mode": mode,
                    "reason": "duplicate_competitor_target_for_property",
                }
            )
            continue
        seen_by_property[property_id].add(dedupe_key)

        competitors_by_property.setdefault(property_id, []).append(
            {
                "url": url,
                "mode": mode,
                "normalized_target": normalized,
                "competitor_id": row["competitor_id"],
                "competitor_name": row["competitor_name"],
                "competitor_rank": row["competitor_rank"],
                "data_source": row["data_source"],
                "source_property_id": source_property_id,
            }
        )

    return competitors_by_property, skipped, unresolved


@dataclass
class AhrefsCompetitorAdmin:
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
                "User-Agent": "PropertyAnalytics-AhrefsCompetitorAdmin/1.0",
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

    def get_competitors(self, project_id: str | int) -> list[dict[str, Any]]:
        status, payload = self._request(
            "GET",
            "/management/project-competitors",
            params={"project_id": compact_project_id(project_id)},
        )
        if self.rate_limit_sleep_seconds:
            time.sleep(self.rate_limit_sleep_seconds)
        if status >= 400 or not payload:
            raise RuntimeError(f"Ahrefs competitor roster failed with status {status}: {payload}")
        competitors = payload.get("competitors") or []
        return competitors if isinstance(competitors, list) else []

    def add_competitors(self, project_id: str | int, competitors: list[dict[str, str]]) -> dict[str, Any]:
        status, payload = self._request(
            "POST",
            "/management/project-competitors",
            params={"project_id": compact_project_id(project_id)},
            json={"competitors": competitors},
        )
        if self.rate_limit_sleep_seconds:
            time.sleep(self.rate_limit_sleep_seconds)
        if status >= 400:
            raise RuntimeError(f"Ahrefs competitor add failed with status {status}: {payload}")
        return payload or {}


def current_competitor_key(competitor: dict[str, Any]) -> str:
    _url, inferred_mode, normalized = competitor_target(str(competitor.get("url") or ""))
    mode = str(competitor.get("mode") or inferred_mode)
    return f"{normalized}|{mode}"


def build_plan(
    admin: AhrefsCompetitorAdmin,
    *,
    db_path: Path,
    limit_properties: int | None = None,
    limit_competitors_per_property: int | None = None,
) -> dict[str, Any]:
    identities = load_property_identities()
    local_projects = read_local_ahrefs_projects(db_path)
    canonical_projects, project_warnings = canonical_project_by_property(identities, local_projects)
    local_competitors, skipped_competitors, unresolved_competitor_links = load_local_competitors(
        db_path,
        identities,
        canonical_projects,
    )

    property_rows: list[dict[str, Any]] = []
    current_errors: list[dict[str, Any]] = []
    all_additions: list[dict[str, Any]] = []
    selected_identity_ids = [identity.marketing_bi_property_id for identity in identities]
    if limit_properties is not None:
        selected_identity_ids = selected_identity_ids[: max(limit_properties, 0)]

    for property_id in selected_identity_ids:
        identity = next(identity for identity in identities if identity.marketing_bi_property_id == property_id)
        project = canonical_projects.get(property_id)
        local_items = local_competitors.get(property_id, [])
        if limit_competitors_per_property is not None:
            local_items = local_items[: max(limit_competitors_per_property, 0)]
        current: list[dict[str, Any]] = []
        existing_keys: set[str] = set()
        if project:
            try:
                current = admin.get_competitors(str(project["project_id"]))
                existing_keys = {current_competitor_key(item) for item in current}
            except Exception as exc:
                current_errors.append(
                    {
                        "property_id": property_id,
                        "property_name": identity.property_name,
                        "project_id": project.get("project_id"),
                        "error": str(exc)[:500],
                    }
                )

        additions = [
            {
                "url": item["url"],
                "mode": item["mode"],
                "competitor_id": item["competitor_id"],
                "competitor_name": item["competitor_name"],
                "competitor_rank": item["competitor_rank"],
                "data_source": item["data_source"],
                "source_property_id": item["source_property_id"],
            }
            for item in local_items
            if f"{item['normalized_target']}|{item['mode']}" not in existing_keys
        ]
        for item in additions:
            all_additions.append(
                {
                    "project_id": project.get("project_id") if project else None,
                    "property_id": property_id,
                    "property_name": identity.property_name,
                    **item,
                }
            )

        property_rows.append(
            {
                **identity_payload(identity),
                "project_id": project.get("project_id") if project else None,
                "project_name": project.get("project_name") if project else None,
                "project_target_url": project.get("target_url") if project else None,
                "local_competitors_with_targets": len(local_items),
                "current_ahrefs_competitors": len(current),
                "competitors_to_add": additions,
                "competitors_to_add_count": len(additions),
            }
        )

    missing_competitor_links = [
        identity_payload(identity)
        for identity in identities
        if not local_competitors.get(identity.marketing_bi_property_id)
    ]
    properties_with_competitors = [
        row for row in property_rows if row["local_competitors_with_targets"] > 0
    ]
    properties_with_additions = [
        row for row in property_rows if row["competitors_to_add_count"] > 0
    ]

    return {
        "generated_at": utc_timestamp(),
        "mode": "plan",
        "source": "local property_competitors + competitors tables",
        "db_path": str(db_path),
        "identity_properties": len(identities),
        "local_ahrefs_projects": len(local_projects),
        "canonical_ahrefs_projects_found": len(canonical_projects),
        "properties_with_local_competitor_targets": len(properties_with_competitors),
        "properties_missing_local_competitor_targets": len(missing_competitor_links),
        "total_local_competitors_with_targets": sum(
            len(items) for items in local_competitors.values()
        ),
        "current_ahrefs_competitors": sum(row["current_ahrefs_competitors"] for row in property_rows),
        "competitors_to_add": len(all_additions),
        "properties_with_competitors_to_add": len(properties_with_additions),
        "current_ahrefs_errors": current_errors,
        "project_warnings": project_warnings,
        "skipped_competitors": skipped_competitors,
        "unresolved_competitor_links": unresolved_competitor_links,
        "missing_competitor_links": missing_competitor_links,
        "all_additions": all_additions,
        "properties": property_rows,
        "notes": [
            "Ahrefs GET and POST project competitor endpoints are documented as free and do not consume API units.",
            f"Live competitor writes require --apply plus --confirm {APPLY_CONFIRMATION}.",
            "Root competitor targets are sent as mode=subdomains; path targets are sent as mode=prefix.",
            "Existing competitors are compared by normalized target and mode to avoid duplicate adds.",
        ],
    }


def write_artifact(payload: dict[str, Any], output_dir: Path, prefix: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = output_dir / f"{prefix}_{stamp}.json"
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return path


def print_summary(plan: dict[str, Any], path: Path, *, mode: str) -> None:
    print(
        json.dumps(
            {
                "mode": mode,
                "plan_path": str(path),
                "identity_properties": plan["identity_properties"],
                "canonical_ahrefs_projects_found": plan["canonical_ahrefs_projects_found"],
                "properties_with_local_competitor_targets": plan["properties_with_local_competitor_targets"],
                "properties_missing_local_competitor_targets": plan["properties_missing_local_competitor_targets"],
                "total_local_competitors_with_targets": plan["total_local_competitors_with_targets"],
                "current_ahrefs_competitors": plan["current_ahrefs_competitors"],
                "competitors_to_add": plan["competitors_to_add"],
                "properties_with_competitors_to_add": plan["properties_with_competitors_to_add"],
                "current_ahrefs_error_count": len(plan["current_ahrefs_errors"]),
                "project_warning_count": len(plan["project_warnings"]),
                "skipped_competitor_count": len(plan["skipped_competitors"]),
                "unresolved_competitor_link_count": len(plan["unresolved_competitor_links"]),
                "missing_competitor_links": plan["missing_competitor_links"],
                "first_additions": plan["all_additions"][:20],
            },
            indent=2,
            sort_keys=True,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan or add Ahrefs competitors for canonical property projects.")
    parser.add_argument("--apply", action="store_true", help="Add missing competitors. Default is dry-run.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--rate-limit-sleep-seconds", type=float, default=0.35)
    parser.add_argument("--limit-properties", type=int, help="Limit properties inspected or mutated.")
    parser.add_argument("--limit-competitors-per-property", type=int, help="Limit competitors per property.")
    parser.add_argument("--max-total-adds", type=int, help="Abort --apply if additions exceed this value.")
    args = parser.parse_args()

    db_path = Path(args.db_path)
    output_dir = Path(args.output_dir)
    admin = AhrefsCompetitorAdmin(
        timeout_seconds=args.timeout_seconds,
        rate_limit_sleep_seconds=args.rate_limit_sleep_seconds,
    )
    plan = build_plan(
        admin,
        db_path=db_path,
        limit_properties=args.limit_properties,
        limit_competitors_per_property=args.limit_competitors_per_property,
    )
    plan_path = write_artifact(plan, output_dir, "ahrefs_competitor_plan")
    print_summary(plan, plan_path, mode="apply" if args.apply else "dry-run")

    if not args.apply:
        return
    if args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")
    if plan["current_ahrefs_errors"]:
        raise SystemExit("Refusing to apply while current Ahrefs competitor reads have errors.")
    if args.max_total_adds is not None and plan["competitors_to_add"] > args.max_total_adds:
        raise SystemExit(
            f"Refusing to apply {plan['competitors_to_add']} additions; --max-total-adds is {args.max_total_adds}."
        )

    added: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for row in plan["properties"]:
        project_id = row.get("project_id")
        additions = row.get("competitors_to_add") or []
        if not project_id or not additions:
            continue
        body_competitors = [
            {"url": item["url"], "mode": item["mode"]}
            for item in additions
        ]
        try:
            response = admin.add_competitors(project_id, body_competitors)
            added.append(
                {
                    "property_id": row["property_id"],
                    "property_name": row["property_name"],
                    "project_id": project_id,
                    "requested_count": len(body_competitors),
                    "response_competitors": response.get("competitors", []),
                    "requested_competitors": additions,
                }
            )
        except Exception as exc:
            failures.append(
                {
                    "property_id": row["property_id"],
                    "property_name": row["property_name"],
                    "project_id": project_id,
                    "requested_competitors": additions,
                    "error": str(exc)[:500],
                }
            )

    apply_result = {
        "generated_at": utc_timestamp(),
        "plan_path": str(plan_path),
        "added_property_count": len(added),
        "added_competitor_count": sum(item["requested_count"] for item in added),
        "failure_count": len(failures),
        "added": added,
        "failures": failures,
    }
    result_path = write_artifact(apply_result, output_dir, "ahrefs_competitor_apply")
    print(json.dumps(apply_result | {"result_path": str(result_path)}, indent=2, sort_keys=True))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
