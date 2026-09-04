#!/usr/bin/env python3
"""Collect or import Resi Edge GSC URL Inspection rows into the canonical DB.

This is read-only against Google Search Console: it inspects URLs only. It does
not request indexing, submit URLs, edit sitemaps, or mutate live site state.
"""

from __future__ import annotations

import argparse
import csv
import json
import pickle
import sys
import time
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.utils.gsc_indexing_actions import STANDARD_RESI_CORE_PATHS
from google.auth.transport.requests import AuthorizedSession, Request
from utils.keeper_file_materializer import materialize_keeper_file

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
MANIFEST_DIR = ROOT / "config" / "portfolio_resi_edge_stabilization"
REPORT_ROOT = ROOT / "reports" / "gsc_indexing" / "resi_edge_20"
LOCAL_TZ = ZoneInfo("America/Chicago")


def latest_dashboard_snapshot() -> Path:
    snapshots = sorted(
        (ROOT / "reports" / "resi_edge_performance" / "launch-dashboard-snapshot").glob(
            "*/launch-snapshot.json"
        ),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not snapshots:
        raise RuntimeError("No launch dashboard snapshot found.")
    return snapshots[0]


def manifest_for_domain(domain: str) -> dict:
    path = MANIFEST_DIR / f"{domain.replace('.', '-')}.manifest.json"
    if not path.exists():
        raise RuntimeError(f"Missing Resi Edge manifest for {domain}: {path}")
    return json.loads(path.read_text())


def load_targets(snapshot_path: Path) -> list[dict]:
    snapshot = json.loads(snapshot_path.read_text())
    targets = []
    for prop in snapshot.get("properties", []):
        url = str((prop.get("newUrl") or {}).get("url") or "").strip()
        domain = (urlparse(url).hostname or "").lower()
        if not domain:
            continue
        manifest = manifest_for_domain(domain)
        target = manifest.get("target") or {}
        canonical = str(target.get("canonical_url") or f"https://{domain}/").rstrip("/")
        urls = [
            canonical + "/" if path == "/" else canonical + path
            for path in STANDARD_RESI_CORE_PATHS
        ]
        targets.append(
            {
                "property_code": target.get("property_code") or prop.get("propertyCode"),
                "property_name": target.get("property_name") or prop.get("propertyName"),
                "market": prop.get("market") or target.get("state"),
                "domain": domain,
                "ga4_property_id": str(target.get("ga4_property_id") or ""),
                "gsc_property": target.get("gsc_property") or f"sc-domain:{domain}",
                "urls": urls,
            }
        )
    return targets


def get_oauth_session() -> AuthorizedSession:
    client_secret_path = materialize_keeper_file(
        uid_env_var="KSM_GSC_CLIENT_SECRET_UID",
        fallback_path=str(
            ROOT
            / "config"
            / "client_secret_911627664995-s8derelblr6nfpf7hg8di7bs338jica5.apps.googleusercontent.com.json"
        ),
    )
    token_path = materialize_keeper_file(
        uid_env_var="KSM_GSC_TOKEN_UID",
        fallback_path=str(ROOT / "config" / "gsc_token.pickle"),
    )
    del client_secret_path  # materialized for the same Keeper-backed path contract.
    with open(token_path, "rb") as token_file:
        creds = pickle.load(token_file)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return AuthorizedSession(creds)


def parse_result(payload: dict) -> dict:
    result = (payload or {}).get("inspectionResult", {})
    idx = result.get("indexStatusResult", {}) or {}
    mobile = result.get("mobileUsabilityResult", {}) or {}
    rich = result.get("richResultsResult", {}) or {}
    return {
        "verdict": idx.get("verdict"),
        "coverage_state": idx.get("coverageState"),
        "indexing_state": idx.get("indexingState"),
        "page_fetch_state": idx.get("pageFetchState"),
        "robots_txt_state": idx.get("robotsTxtState"),
        "crawled_as": idx.get("crawledAs"),
        "last_crawl_time": idx.get("lastCrawlTime"),
        "google_canonical": idx.get("googleCanonical"),
        "user_canonical": idx.get("userCanonical"),
        "mobile_usability_verdict": mobile.get("verdict"),
        "rich_results_verdict": rich.get("verdict"),
        "referring_urls_count": len(idx.get("referringUrls") or []),
        "sitemaps_count": len(idx.get("sitemap") or []),
        "raw_response_json": json.dumps(payload, separators=(",", ":")),
    }


def status_bucket(parsed: dict) -> str:
    coverage = str(parsed.get("coverage_state") or "").lower()
    verdict = str(parsed.get("verdict") or "").upper()
    indexing = str(parsed.get("indexing_state") or "").upper()
    robots = str(parsed.get("robots_txt_state") or "").upper()
    fetch = str(parsed.get("page_fetch_state") or "").upper()
    if verdict == "PASS" or ("indexed" in coverage and "not indexed" not in coverage):
        return "indexed"
    if robots and robots != "ALLOWED" and "UNSPECIFIED" not in robots:
        return "blocked"
    if indexing and indexing not in {"INDEXING_ALLOWED", "INDEXING_STATE_UNSPECIFIED"}:
        return "blocked"
    if fetch and fetch not in {"SUCCESSFUL", "PAGE_FETCH_STATE_UNSPECIFIED"}:
        return "fetch_issue"
    if "unknown to google" in coverage:
        return "unknown_to_google"
    if "discovered" in coverage and "not indexed" in coverage:
        return "discovered_not_indexed"
    if "crawled" in coverage and "not indexed" in coverage:
        return "crawled_not_indexed"
    return "review"


def inspect_url(session: AuthorizedSession, gsc_property: str, url: str) -> dict:
    response = session.post(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        json={"inspectionUrl": url, "siteUrl": gsc_property, "languageCode": "en-US"},
        timeout=(8, 20),
    )
    response.raise_for_status()
    return response.json()


def write_outputs(out_dir: Path, records: list[dict], started_at: datetime, mutation_note: str) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = [record["row"] for record in records]
    status_counts = Counter(row["status_bucket"] for row in rows)
    property_codes = sorted({row["property_code"] for row in rows})
    property_summary = []
    for code in property_codes:
        group = [row for row in rows if row["property_code"] == code]
        root = next((row for row in group if row["path"] == "/"), group[0])
        indexed = sum(1 for row in group if row["status_bucket"] == "indexed")
        property_summary.append(
            {
                "property_code": code,
                "property_name": root["property_name"],
                "domain": root["domain"],
                "gsc_property": root["gsc_property"],
                "root_status": root["status_bucket"],
                "root_verdict": root.get("verdict") or "",
                "root_coverage_state": root.get("coverage_state") or "",
                "root_last_crawl_time": root.get("last_crawl_time") or "",
                "urls_inspected": len(group),
                "indexed_urls": indexed,
                "non_indexed_urls": len(group) - indexed,
                "blocked_urls": sum(1 for row in group if row["status_bucket"] == "blocked"),
                "fetch_issue_urls": sum(1 for row in group if row["status_bucket"] == "fetch_issue"),
                "unknown_to_google_urls": sum(1 for row in group if row["status_bucket"] == "unknown_to_google"),
                "api_error_urls": sum(1 for row in group if row["status_bucket"] == "api_error"),
                "needs_review_urls": sum(1 for row in group if row["status_bucket"] in {"blocked", "fetch_issue", "review", "api_error"}),
            }
        )

    started_at_local = started_at.astimezone(LOCAL_TZ)
    summary = {
        "schema": "resi_edge_gsc_indexing_db_watch_v1",
        "generated_at_human": started_at_local.strftime("%m/%d/%Y %-I:%M %p CDT"),
        "generated_at_utc": started_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scope": "first 20 Resi Edge live vanity domains",
        "properties": len(property_summary),
        "total_properties": len(property_summary),
        "standard_paths_per_property": len(STANDARD_RESI_CORE_PATHS),
        "urls_inspected": len(rows),
        "total_urls": len(rows),
        "api_ok_urls": sum(1 for row in rows if row.get("api_ok")),
        "api_error_urls": sum(1 for row in rows if not row.get("api_ok")),
        "root_indexed_properties": sum(1 for row in property_summary if row["root_status"] == "indexed"),
        "properties_with_all_standard_paths_indexed": sum(
            1 for row in property_summary if row["indexed_urls"] == row["urls_inspected"]
        ),
        "properties_with_non_indexed_standard_paths": sum(
            1 for row in property_summary if row["indexed_urls"] != row["urls_inspected"]
        ),
        "status_counts": dict(sorted(status_counts.items())),
        "database_mutation_performed": mutation_note,
        "url_submission_performed": False,
        "sitemap_mutation_performed": False,
        "site_mutation_performed": False,
        "output_dir": str(out_dir),
    }

    (out_dir / "raw-url-inspection.jsonl").write_text(
        "".join(json.dumps(record, sort_keys=True) + "\n" for record in records)
    )
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    (out_dir / "gsc-indexing-report.json").write_text(json.dumps(rows, indent=2, sort_keys=True) + "\n")

    row_fields = [
        "property_code", "property_name", "market", "domain", "ga4_property_id", "gsc_property",
        "path", "url", "api_ok", "verdict", "coverage_state", "indexing_state",
        "page_fetch_state", "robots_txt_state", "last_crawl_time", "google_canonical",
        "user_canonical", "status_bucket", "error",
    ]
    with open(out_dir / "gsc-indexing-report.csv", "w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=row_fields)
        writer.writeheader()
        writer.writerows({key: row.get(key, "") for key in row_fields} for row in rows)

    prop_fields = list(property_summary[0].keys()) if property_summary else []
    with open(out_dir / "gsc-indexing-property-summary.csv", "w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=prop_fields)
        writer.writeheader()
        writer.writerows(property_summary)

    lines = [
        "# Resi Edge GSC Indexing DB Watch",
        "",
        f"Generated: {summary['generated_at_human']}",
        f"Scope: {summary['scope']}",
        "",
        "This packet is read-only for Google and live sites. It stores URL Inspection evidence in the canonical database.",
        "",
        "## Summary",
        "",
        f"- Properties inspected: {summary['properties']}",
        f"- URLs inspected: {summary['urls_inspected']}",
        f"- API successes: {summary['api_ok_urls']}",
        f"- API errors: {summary['api_error_urls']}",
        f"- Root pages indexed: {summary['root_indexed_properties']} / {summary['properties']}",
        f"- Fully indexed standard-path sets: {summary['properties_with_all_standard_paths_indexed']} / {summary['properties']}",
        "",
        "## Property Summary",
        "",
    ]
    for row in property_summary:
        lines.append(
            f"- {row['property_name']} ({row['property_code']}): root {row['root_status']}; "
            f"indexed {row['indexed_urls']}/{row['urls_inspected']}; "
            f"non-indexed {row['non_indexed_urls']}."
        )
    (out_dir / "GSC_INDEXING_DB_WATCH.md").write_text("\n".join(lines) + "\n")
    (REPORT_ROOT / "latest-db-watch.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    return summary


def upsert_records(db: DatabaseManager, records: list[dict], inspection_date: str, collection_id: int) -> None:
    for record in records:
        row = record["row"]
        if not row.get("ga4_property_id") or not row.get("api_ok"):
            continue
        parsed = parse_result(record["raw_response"])
        db.insert_gsc_url_inspection(
            property_id=row["ga4_property_id"],
            gsc_site_url=row["gsc_property"],
            inspected_url=row["url"],
            inspection_date=inspection_date,
            inspection_data=parsed,
            collection_id=collection_id,
        )


def collect_live(targets: list[dict], out_dir: Path) -> tuple[list[dict], int]:
    session = get_oauth_session()
    records = []
    api_errors = 0
    for target in targets:
        for url in target["urls"]:
            path = urlparse(url).path or "/"
            try:
                payload = inspect_url(session, target["gsc_property"], url)
                parsed = parse_result(payload)
                bucket = status_bucket(parsed)
                row = {
                    **{key: target[key] for key in ["property_code", "property_name", "market", "domain", "ga4_property_id", "gsc_property"]},
                    "path": path if path.endswith("/") else path + "/",
                    "url": url,
                    "api_ok": True,
                    **{key: parsed.get(key) for key in parsed if key != "raw_response_json"},
                    "status_bucket": bucket,
                    "error": "",
                }
                records.append({"raw_response": payload, "row": row})
            except Exception as exc:
                api_errors += 1
                row = {
                    **{key: target[key] for key in ["property_code", "property_name", "market", "domain", "ga4_property_id", "gsc_property"]},
                    "path": path if path.endswith("/") else path + "/",
                    "url": url,
                    "api_ok": False,
                    "status_bucket": "api_error",
                    "error": str(exc)[:300],
                }
                records.append({"raw_response": {}, "row": row})
            if len(records) % 10 == 0:
                print(f"{len(records)} URLs processed")
            time.sleep(0.2)
    return records, api_errors


def import_report(report_dir: Path, targets: list[dict]) -> list[dict]:
    target_by_code = {str(target["property_code"]).upper(): target for target in targets}
    records = []
    with open(report_dir / "raw-url-inspection.jsonl") as file:
        for line in file:
            if not line.strip():
                continue
            item = json.loads(line)
            row = item.get("row") or {}
            target = target_by_code.get(str(row.get("property_code") or "").upper())
            if not target:
                continue
            parsed = parse_result(item.get("raw_response") or {})
            bucket = status_bucket(parsed) if parsed.get("verdict") or parsed.get("coverage_state") else row.get("status_bucket", "api_error")
            merged = {
                **{key: target[key] for key in ["property_code", "property_name", "market", "domain", "ga4_property_id", "gsc_property"]},
                "path": row.get("path") or _path_from_url(row.get("url")),
                "url": row.get("url"),
                "api_ok": bool(row.get("api_ok", True)),
                **{key: parsed.get(key) for key in parsed if key != "raw_response_json"},
                "status_bucket": bucket,
                "error": row.get("error") or "",
            }
            records.append({"raw_response": item.get("raw_response") or {}, "row": merged})
    return records


def _path_from_url(url: str) -> str:
    path = urlparse(str(url or "")).path or "/"
    return path if path.endswith("/") else path + "/"


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect/import Resi Edge GSC indexing watch rows.")
    parser.add_argument("--snapshot", type=Path, default=None, help="Launch dashboard snapshot JSON.")
    parser.add_argument("--from-report", type=Path, default=None, help="Import an existing report directory instead of calling GSC.")
    parser.add_argument("--no-db", action="store_true", help="Generate report files without writing the database.")
    args = parser.parse_args()

    started_at = datetime.now(timezone.utc)
    snapshot = args.snapshot or latest_dashboard_snapshot()
    targets = load_targets(snapshot)
    if not targets:
        raise RuntimeError("No Resi Edge targets resolved.")

    run_id = started_at.strftime("%Y%m%dT%H%M%SZ")
    out_dir = REPORT_ROOT / run_id
    inspection_date = started_at.date().isoformat()

    if args.from_report:
        records = import_report(args.from_report, targets)
        if not records:
            raise RuntimeError(f"No importable records found in {args.from_report}")
    else:
        records, _ = collect_live(targets, out_dir)

    collection_id = None
    if not args.no_db:
        db = DatabaseManager(DB_PATH)
        collection_id = db.start_data_collection(
            collection_date=date.fromisoformat(inspection_date),
            collection_type="daily",
            data_source="resi_edge_gsc_url_inspection",
        )
        upsert_records(db, records, inspection_date, collection_id)
        property_success = len({r["row"]["property_code"] for r in records if r["row"].get("api_ok")})
        property_failed = len(targets) - property_success
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=property_success,
            properties_failed=property_failed,
            properties_total=len(targets),
            notes="Resi Edge standard-path URL Inspection watch.",
        )

    summary = write_outputs(
        out_dir=out_dir,
        records=records,
        started_at=started_at,
        mutation_note="canonical_db_upsert" if collection_id else "none",
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
