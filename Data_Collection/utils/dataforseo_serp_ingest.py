#!/usr/bin/env python3
"""Collect DataForSEO SERP evidence into the canonical Data Pond."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import (  # noqa: E402
    PropertyIdentity,
    resolve_property_identity,
)
from utils.dataforseo_auth import resolve_dataforseo_credentials  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
APRIL_SPOTLIGHT_CONFIG = ROOT / "Spotlight_Properties_Report" / "config" / "monthly_spotlight_properties_2026-04.json"
RAW_OUTPUT_DIR = ROOT / "reports" / "dataforseo"
SERP_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"
DEFAULT_LOCATION_CODE = 2840
DEFAULT_LOCATION_NAME = "United States"


@dataclass(frozen=True)
class SerpRequest:
    identity: PropertyIdentity
    keyword: str
    location_code: int
    location_name: str
    language_code: str
    device: str
    os: str
    depth: int


def stable_id(*parts: Any) -> str:
    raw = "|".join("" if part is None else str(part) for part in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def host_from_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urllib.parse.urlparse(value)
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def url_path_contains_target(candidate_url: str | None, target_url: str | None) -> bool:
    if not candidate_url or not target_url:
        return False
    candidate = urllib.parse.urlparse(candidate_url)
    target = urllib.parse.urlparse(target_url)
    return bool(target.path and candidate.netloc.lower().endswith(target.netloc.lower()) and target.path.rstrip("/") in candidate.path)


def apply_schema(conn: sqlite3.Connection, schema_path: Path) -> None:
    conn.executescript(schema_path.read_text(encoding="utf-8"))
    conn.commit()


def load_spotlight_identities(config_path: Path) -> list[PropertyIdentity]:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    identities: list[PropertyIdentity] = []
    for ga4_id, row in payload.get("spotlight_properties", {}).items():
        if row.get("active") is False:
            continue
        identity = resolve_property_identity(str(ga4_id)) or resolve_property_identity(str(row.get("canonical_name", "")))
        if identity is None:
            raise RuntimeError(f"Could not resolve Spotlight property identity for {ga4_id}: {row}")
        identities.append(identity)
    return identities


def keyword_set(
    identity: PropertyIdentity,
    extra_keywords: list[str] | None = None,
    keyword_mode: str = "all",
) -> list[str]:
    brand_candidates = [
        identity.property_name,
        f"{identity.property_name} apartments",
        identity.encasa_short_name,
        f"{identity.encasa_short_name} apartments" if identity.encasa_short_name else None,
    ]
    local_candidates = [
        f"apartments in {identity.city} {identity.state}" if identity.city and identity.state else None,
        f"{identity.city} apartments" if identity.city else None,
        f"luxury apartments {identity.city} {identity.state}" if identity.city and identity.state else None,
        f"pet friendly apartments {identity.city} {identity.state}" if identity.city and identity.state else None,
    ]
    if keyword_mode == "brand":
        candidates = brand_candidates
    elif keyword_mode == "local_market":
        candidates = local_candidates
    else:
        candidates = [*brand_candidates, *local_candidates]
    if extra_keywords:
        candidates.extend(extra_keywords)
    seen: set[str] = set()
    keywords: list[str] = []
    for candidate in candidates:
        value = " ".join(str(candidate or "").split())
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            keywords.append(value)
    return keywords


def call_dataforseo(requests: list[SerpRequest], authorization_header: str) -> dict[str, Any]:
    tasks = [
        {
            "keyword": request.keyword,
            "location_code": request.location_code,
            "language_code": request.language_code,
            "device": request.device,
            "os": request.os,
            "depth": request.depth,
        }
        for request in requests
    ]
    req = urllib.request.Request(
        SERP_ENDPOINT,
        data=json.dumps(tasks).encode("utf-8"),
        headers={
            "Authorization": authorization_header,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DataForSEO HTTP {exc.code}: {detail}") from exc


def call_dataforseo_one(request: SerpRequest, authorization_header: str) -> dict[str, Any]:
    """Call the live SERP endpoint for one task.

    DataForSEO's live advanced endpoint rejects multi-task batches. Keeping this
    wrapper explicit prevents accidental partial runs where one task succeeds and
    the remaining tasks are returned as zero-cost 40000 responses.
    """
    return call_dataforseo([request], authorization_header)


def flatten_items(task: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for result in task.get("result") or []:
        items.extend(result.get("items") or [])
    return items


def task_check_url(task: dict[str, Any]) -> str | None:
    for result in task.get("result") or []:
        check_url = result.get("check_url")
        if check_url:
            return str(check_url)
    return None


def summarize_target(items: list[dict[str, Any]], identity: PropertyIdentity) -> dict[str, Any]:
    target_host = host_from_url(identity.website_url or identity.gsc_url)
    target_url = identity.website_url or identity.gsc_url
    target_items: list[dict[str, Any]] = []
    local_pack_present = False
    target_in_local_pack = False
    organic_target_items: list[dict[str, Any]] = []

    for item in items:
        result_type = item.get("type") or "unknown"
        if result_type in {"local_pack", "map"}:
            local_pack_present = True
        domain = str(item.get("domain") or "").lower()
        if domain.startswith("www."):
            domain = domain[4:]
        item_url = item.get("url")
        is_target = bool(target_host and domain == target_host) or url_path_contains_target(item_url, target_url)
        if is_target:
            target_items.append(item)
            if result_type in {"local_pack", "map"}:
                target_in_local_pack = True
            if result_type == "organic":
                organic_target_items.append(item)

    best = min(target_items, key=lambda item: item.get("rank_absolute") or 999999, default=None)
    organic_best = min(organic_target_items, key=lambda item: item.get("rank_absolute") or 999999, default=None)
    return {
        "target_found": 1 if best else 0,
        "best_rank_absolute": best.get("rank_absolute") if best else None,
        "best_rank_group": best.get("rank_group") if best else None,
        "best_result_type": best.get("type") if best else None,
        "target_url": best.get("url") if best else None,
        "organic_rank_absolute": organic_best.get("rank_absolute") if organic_best else None,
        "organic_rank_group": organic_best.get("rank_group") if organic_best else None,
        "local_pack_present": 1 if local_pack_present else 0,
        "target_in_local_pack": 1 if target_in_local_pack else 0,
    }


def store_task(
    conn: sqlite3.Connection,
    request: SerpRequest,
    task: dict[str, Any],
    payload_status_code: int | None,
    payload_status_message: str | None,
    raw_path: Path,
    run_date: str,
    run_at: str,
) -> None:
    property_id = request.identity.marketing_bi_property_id
    run_id = stable_id(run_date, property_id, request.keyword, request.location_code, request.device, request.os)
    cost = task.get("cost")
    check_url = task_check_url(task)
    items = flatten_items(task)
    summary = summarize_target(items, request.identity)
    conn.execute(
        """
        INSERT INTO dataforseo_serp_runs (
          id, run_date, run_at, property_id, community_id, ga4_property_id, property_name,
          keyword, location_name, location_code, language_code, device, os, depth,
          api_endpoint, status_code, status_message, task_status_code, task_status_message,
          cost, check_url, raw_response_path, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(run_date, property_id, keyword, location_code, device, os) DO UPDATE SET
          run_at=excluded.run_at,
          community_id=excluded.community_id,
          ga4_property_id=excluded.ga4_property_id,
          property_name=excluded.property_name,
          depth=excluded.depth,
          status_code=excluded.status_code,
          status_message=excluded.status_message,
          task_status_code=excluded.task_status_code,
          task_status_message=excluded.task_status_message,
          cost=excluded.cost,
          check_url=excluded.check_url,
          raw_response_path=excluded.raw_response_path,
          updated_at=datetime('now')
        """,
        (
            run_id,
            run_date,
            run_at,
            property_id,
            request.identity.community_id,
            request.identity.ga4_property_id,
            request.identity.property_name,
            request.keyword,
            request.location_name,
            request.location_code,
            request.language_code,
            request.device,
            request.os,
            request.depth,
            SERP_ENDPOINT,
            payload_status_code,
            payload_status_message,
            task.get("status_code"),
            task.get("status_message"),
            cost,
            check_url,
            str(raw_path),
        ),
    )
    conn.execute("DELETE FROM dataforseo_serp_results WHERE run_id = ?", (run_id,))
    target_host = host_from_url(request.identity.website_url or request.identity.gsc_url)
    target_url = request.identity.website_url or request.identity.gsc_url
    for index, item in enumerate(items):
        domain = str(item.get("domain") or "").lower()
        if domain.startswith("www."):
            domain = domain[4:]
        item_url = item.get("url")
        is_target_domain = 1 if target_host and domain == target_host else 0
        is_target_url = 1 if url_path_contains_target(item_url, target_url) else 0
        result_id = stable_id(run_id, index, item.get("rank_absolute"), item.get("type"), item_url)
        conn.execute(
            """
            INSERT INTO dataforseo_serp_results (
              id, run_id, run_date, property_id, community_id, keyword, result_type,
              rank_group, rank_absolute, domain, title, url, description,
              is_target_domain, is_target_url, item_json, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                result_id,
                run_id,
                run_date,
                property_id,
                request.identity.community_id,
                request.keyword,
                item.get("type") or "unknown",
                item.get("rank_group"),
                item.get("rank_absolute"),
                domain or None,
                item.get("title"),
                item_url,
                item.get("description"),
                is_target_domain,
                is_target_url,
                json.dumps(item, sort_keys=True),
            ),
        )
    ranking_id = stable_id("ranking", run_id)
    conn.execute(
        """
        INSERT INTO dataforseo_property_keyword_rankings (
          id, run_id, run_date, property_id, community_id, ga4_property_id, property_name,
          keyword, location_name, location_code, device, os, target_found,
          best_rank_absolute, best_rank_group, best_result_type, target_url,
          organic_rank_absolute, organic_rank_group, local_pack_present, target_in_local_pack,
          result_count, cost, raw_response_path, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(run_date, property_id, keyword, location_code, device, os) DO UPDATE SET
          run_id=excluded.run_id,
          community_id=excluded.community_id,
          ga4_property_id=excluded.ga4_property_id,
          property_name=excluded.property_name,
          target_found=excluded.target_found,
          best_rank_absolute=excluded.best_rank_absolute,
          best_rank_group=excluded.best_rank_group,
          best_result_type=excluded.best_result_type,
          target_url=excluded.target_url,
          organic_rank_absolute=excluded.organic_rank_absolute,
          organic_rank_group=excluded.organic_rank_group,
          local_pack_present=excluded.local_pack_present,
          target_in_local_pack=excluded.target_in_local_pack,
          result_count=excluded.result_count,
          cost=excluded.cost,
          raw_response_path=excluded.raw_response_path,
          updated_at=datetime('now')
        """,
        (
            ranking_id,
            run_id,
            run_date,
            property_id,
            request.identity.community_id,
            request.identity.ga4_property_id,
            request.identity.property_name,
            request.keyword,
            request.location_name,
            request.location_code,
            request.device,
            request.os,
            summary["target_found"],
            summary["best_rank_absolute"],
            summary["best_rank_group"],
            summary["best_result_type"],
            summary["target_url"],
            summary["organic_rank_absolute"],
            summary["organic_rank_group"],
            summary["local_pack_present"],
            summary["target_in_local_pack"],
            len(items),
            cost,
            str(raw_path),
        ),
    )


def build_requests(args: argparse.Namespace) -> list[SerpRequest]:
    if args.property:
        identities = []
        for key in args.property:
            identity = resolve_property_identity(key)
            if identity is None:
                raise RuntimeError(f"Could not resolve property identity: {key}")
            identities.append(identity)
    else:
        identities = load_spotlight_identities(args.spotlight_config)

    requests: list[SerpRequest] = []
    for identity in identities:
        keywords = args.keyword if args.keyword else keyword_set(identity, keyword_mode=args.keyword_mode)
        for keyword in keywords[: args.max_keywords_per_property]:
            requests.append(
                SerpRequest(
                    identity=identity,
                    keyword=keyword,
                    location_code=args.location_code,
                    location_name=args.location_name,
                    language_code=args.language_code,
                    device=args.device,
                    os=args.os,
                    depth=args.depth,
                )
            )
    return requests


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DB_PATH)
    parser.add_argument("--schema", type=Path, default=ROOT / "apps/api/migrations/0032_create_dataforseo_serp_tables.sql")
    parser.add_argument("--spotlight-config", type=Path, default=APRIL_SPOTLIGHT_CONFIG)
    parser.add_argument("--property", action="append", help="Property key to collect. Defaults to active Spotlight config.")
    parser.add_argument("--keyword", action="append", help="Explicit keyword. If supplied, applies to every selected property.")
    parser.add_argument("--keyword-mode", choices=["all", "brand", "local_market"], default="all")
    parser.add_argument("--max-keywords-per-property", type=int, default=3)
    parser.add_argument("--location-code", type=int, default=DEFAULT_LOCATION_CODE)
    parser.add_argument("--location-name", default=DEFAULT_LOCATION_NAME)
    parser.add_argument("--language-code", default="en")
    parser.add_argument("--device", default="desktop")
    parser.add_argument("--os", default="windows")
    parser.add_argument("--depth", type=int, default=20)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    requests = build_requests(args)
    if args.dry_run:
        print(json.dumps({"request_count": len(requests), "requests": [request.__dict__ | {"identity": request.identity.as_mapping()} for request in requests]}, indent=2))
        return

    run_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    run_date = run_at[:10]
    raw_dir = RAW_OUTPUT_DIR / run_date
    raw_dir.mkdir(parents=True, exist_ok=True)
    credentials = resolve_dataforseo_credentials()
    responses = [call_dataforseo_one(request, credentials.authorization_header) for request in requests]
    payload = {
        "status_code": 20000 if all(response.get("status_code") == 20000 for response in responses) else None,
        "status_message": "Ok." if all(response.get("status_code") == 20000 for response in responses) else "One or more DataForSEO tasks failed.",
        "responses": responses,
        "tasks": [task for response in responses for task in (response.get("tasks") or [])],
    }
    raw_path = raw_dir / f"dataforseo_serp_{run_date}_{stable_id(run_at, len(requests))}.json"
    raw_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    tasks = payload.get("tasks") or []
    if len(tasks) != len(requests):
        raise RuntimeError(f"DataForSEO task/request mismatch: {len(tasks)} tasks for {len(requests)} requests")

    with sqlite3.connect(args.db) as conn:
        apply_schema(conn, args.schema)
        for index, (request, task) in enumerate(zip(requests, tasks, strict=True)):
            response_payload = responses[index]
            store_task(
                conn,
                request,
                task,
                response_payload.get("status_code"),
                response_payload.get("status_message"),
                raw_path,
                run_date,
                run_at,
            )
        conn.commit()

    total_cost = sum(float(task.get("cost") or 0) for task in tasks)
    target_found = sum(
        1
        for request, task in zip(requests, tasks, strict=True)
        if summarize_target(flatten_items(task), request.identity)["target_found"]
    )
    print(
        json.dumps(
            {
                "status_code": payload.get("status_code"),
                "status_message": payload.get("status_message"),
                "run_date": run_date,
                "request_count": len(requests),
                "target_found_count": target_found,
                "total_cost": round(total_cost, 6),
                "raw_response_path": str(raw_path),
                "db_path": str(args.db),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
