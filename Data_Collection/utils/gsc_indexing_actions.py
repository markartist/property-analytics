#!/usr/bin/env python3
"""Build daily GSC indexing action packets from URL Inspection results."""

from __future__ import annotations

import csv
import json
import sqlite3
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from Data_Collection.utils.property_identity import resolve_property_identity


STANDARD_RESI_CORE_PATHS: tuple[str, ...] = (
    "/",
    "/apartments/",
    "/features/",
    "/amenities/",
    "/gallery/",
    "/neighborhood/",
    "/faqs/",
    "/reviews/",
    "/contact/",
    "/specials/",
    "/about/",
)

ACTION_PACKET_ROOT = Path("/Users/mark/Property_Analytics/reports/gsc_indexing/daily_actions")


@dataclass
class IndexingAction:
    property_id: str
    property_code: str
    property_name: str
    gsc_site_url: str
    url: str
    inspection_date: str
    standard_page: bool
    page_path: str
    verdict: str
    coverage_state: str
    indexing_state: str
    page_fetch_state: str
    robots_txt_state: str
    google_canonical: str
    user_canonical: str
    last_crawl_time: str
    referring_urls_count: int
    sitemaps_count: int
    priority: str
    action_type: str
    action_owner: str
    action: str
    rationale: str


def normalize_path(path: str) -> str:
    path = (path or "/").strip()
    if not path.startswith("/"):
        path = f"/{path}"
    if "." not in path.rsplit("/", 1)[-1] and not path.endswith("/"):
        path = f"{path}/"
    return path


def canonical_url(base_url: str, path: str) -> str:
    parsed = urlparse(base_url)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}{normalize_path(path)}"


def is_resi_site(prop: dict[str, Any]) -> bool:
    domain = str(prop.get("domain") or urlparse(str(prop.get("full_url") or "")).netloc).lower()
    return str(prop.get("site_type") or "").lower() == "resi" or (domain and domain != "venterraliving.com")


def expected_standard_urls(prop: dict[str, Any]) -> list[str]:
    full_url = str(prop.get("full_url") or "").strip()
    if not full_url or not is_resi_site(prop):
        return []
    return [canonical_url(full_url, path) for path in STANDARD_RESI_CORE_PATHS]


def path_for_url(url: str) -> str:
    return normalize_path(urlparse(url).path or "/")


def _identity_bits(prop: dict[str, Any]) -> tuple[str, str]:
    ga4_id = str(prop.get("ga4_property_id") or "").strip()
    identity = resolve_property_identity(ga4_id) if ga4_id else None
    if not identity:
        identity = resolve_property_identity(str(prop.get("name") or ""))
    property_code = identity.property_code if identity and identity.property_code else str(prop.get("property_code") or "")
    property_name = identity.property_name if identity else str(prop.get("name") or ga4_id)
    return property_code, property_name


def load_registry(registry_path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    return {
        str(prop.get("ga4_property_id") or "").strip(): prop
        for prop in payload.get("properties", [])
        if prop.get("ga4_property_id")
    }


def latest_inspection_date(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT MAX(inspection_date) AS d FROM gsc_url_inspection").fetchone()
    return str(row["d"]) if row and row["d"] else None


def classify_action(row: sqlite3.Row, *, standard_page: bool) -> tuple[str, str, str, str, str]:
    verdict = str(row["verdict"] or "").upper()
    coverage = str(row["coverage_state"] or "")
    indexing = str(row["indexing_state"] or "")
    fetch = str(row["page_fetch_state"] or "")
    robots = str(row["robots_txt_state"] or "")
    google_canonical = str(row["google_canonical"] or "")
    user_canonical = str(row["user_canonical"] or "")
    state = " ".join([coverage, indexing, fetch, robots]).lower()

    if "noindex" in state or (robots and robots not in {"ALLOWED", "ROBOTS_TXT_STATE_UNSPECIFIED"}):
        return (
            "P0",
            "fix_indexability",
            "WebOps / source owner",
            "Remove robots/noindex blockers or confirm the URL is intentionally excluded.",
            f"URL Inspection reports an indexing blocker: {coverage or verdict}; {indexing or 'indexing n/a'}; {robots or 'robots n/a'}.",
        )
    if fetch and fetch not in {"SUCCESSFUL", "PAGE_FETCH_STATE_UNSPECIFIED"}:
        return (
            "P0",
            "fix_fetch",
            "WebOps / platform owner",
            "Fix Googlebot fetchability before requesting additional discovery.",
            f"Google could not fetch the URL cleanly: {fetch}.",
        )
    if google_canonical and user_canonical and google_canonical.rstrip("/") != user_canonical.rstrip("/") and standard_page:
        return (
            "P1",
            "verify_canonical",
            "WebOps / SEO",
            "Reconcile Google-selected canonical with the page canonical and internal linking.",
            "Google selected a different canonical than the page declares.",
        )
    if verdict == "PASS":
        return (
            "P3",
            "monitor_indexed",
            "SEO",
            "Keep monitoring indexed status, last crawl time, and query/page impressions.",
            coverage or "URL is indexed.",
        )
    if "unknown to google" in coverage.lower():
        return (
            "P1" if standard_page else "P2",
            "submit_sitemap_and_strengthen_discovery",
            "SEO / WebOps",
            "Confirm the URL is in the vanity sitemap, submit or refresh the sitemap in GSC, and add crawlable internal links.",
            "Google does not know this URL yet.",
        )
    if "discovered" in coverage.lower() and "not indexed" in coverage.lower():
        return (
            "P1" if standard_page else "P2",
            "strengthen_internal_links",
            "SEO / Site Content",
            "Add stronger crawlable internal links and monitor for first crawl before escalating content changes.",
            "Google discovered the URL but has not indexed it.",
        )
    if "crawled" in coverage.lower() and "not indexed" in coverage.lower():
        return (
            "P1" if standard_page else "P2",
            "improve_content_distinctiveness",
            "Site Content / SEO",
            "Improve unique page value, local proof, FAQ/detail depth, and internal anchors.",
            "Google crawled the URL but chose not to index it.",
        )
    if standard_page:
        return (
            "P2",
            "review_standard_page",
            "SEO",
            "Review the standard page's GSC state and decide whether discovery, content, or technical follow-up is needed.",
            coverage or verdict or "Standard page returned a non-indexed inspection state.",
        )
    return (
        "P3",
        "monitor_nonstandard_url",
        "SEO",
        "Monitor this non-standard URL without escalation unless it becomes business-critical.",
        coverage or verdict or "Non-standard URL returned a non-PASS state.",
    )


def build_daily_indexing_action_packet(
    *,
    db_path: Path,
    registry_path: Path,
    output_root: Path = ACTION_PACKET_ROOT,
    inspection_date: str | None = None,
) -> dict[str, Any]:
    output_root.mkdir(parents=True, exist_ok=True)
    registry = load_registry(registry_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        target_date = inspection_date or latest_inspection_date(conn)
        if not target_date:
            raise RuntimeError("No GSC URL Inspection rows are available.")

        rows = conn.execute(
            """
            SELECT
                property_id,
                gsc_site_url,
                inspected_url,
                verdict,
                coverage_state,
                indexing_state,
                page_fetch_state,
                robots_txt_state,
                google_canonical,
                user_canonical,
                last_crawl_time,
                referring_urls_count,
                sitemaps_count
            FROM gsc_url_inspection
            WHERE inspection_date = ?
            ORDER BY property_id, inspected_url
            """,
            (target_date,),
        ).fetchall()
    finally:
        conn.close()

    expected_by_property = {
        property_id: {url.rstrip("/") for url in expected_standard_urls(prop)}
        for property_id, prop in registry.items()
    }
    inspected_by_property: dict[str, set[str]] = defaultdict(set)
    actions: list[IndexingAction] = []

    for row in rows:
        property_id = str(row["property_id"] or "")
        prop = registry.get(property_id, {})
        property_code, property_name = _identity_bits(prop)
        inspected_url = str(row["inspected_url"] or "")
        standard_page = inspected_url.rstrip("/") in expected_by_property.get(property_id, set())
        inspected_by_property[property_id].add(inspected_url.rstrip("/"))
        priority, action_type, owner, action, rationale = classify_action(row, standard_page=standard_page)
        actions.append(
            IndexingAction(
                property_id=property_id,
                property_code=property_code,
                property_name=property_name,
                gsc_site_url=str(row["gsc_site_url"] or ""),
                url=inspected_url,
                inspection_date=target_date,
                standard_page=standard_page,
                page_path=path_for_url(inspected_url),
                verdict=str(row["verdict"] or ""),
                coverage_state=str(row["coverage_state"] or ""),
                indexing_state=str(row["indexing_state"] or ""),
                page_fetch_state=str(row["page_fetch_state"] or ""),
                robots_txt_state=str(row["robots_txt_state"] or ""),
                google_canonical=str(row["google_canonical"] or ""),
                user_canonical=str(row["user_canonical"] or ""),
                last_crawl_time=str(row["last_crawl_time"] or ""),
                referring_urls_count=int(row["referring_urls_count"] or 0),
                sitemaps_count=int(row["sitemaps_count"] or 0),
                priority=priority,
                action_type=action_type,
                action_owner=owner,
                action=action,
                rationale=rationale,
            )
        )

    missing_standard_rows: list[IndexingAction] = []
    for property_id, expected_urls in expected_by_property.items():
        if not expected_urls:
            continue
        prop = registry.get(property_id, {})
        property_code, property_name = _identity_bits(prop)
        inspected = inspected_by_property.get(property_id, set())
        for missing_url in sorted(expected_urls - inspected):
            missing_standard_rows.append(
                IndexingAction(
                    property_id=property_id,
                    property_code=property_code,
                    property_name=property_name,
                    gsc_site_url=str(prop.get("gsc_url") or ""),
                    url=missing_url + "/",
                    inspection_date=target_date,
                    standard_page=True,
                    page_path=path_for_url(missing_url),
                    verdict="NOT_INSPECTED",
                    coverage_state="Daily standard page target was not inspected",
                    indexing_state="",
                    page_fetch_state="",
                    robots_txt_state="",
                    google_canonical="",
                    user_canonical="",
                    last_crawl_time="",
                    referring_urls_count=0,
                    sitemaps_count=0,
                    priority="P2",
                    action_type="inspect_standard_page",
                    action_owner="WebOps",
                    action="Add this standard page to the daily URL Inspection target set or investigate inspection quota/API failures.",
                    rationale="All migrated Resi sites should share this standard page contract.",
                )
            )

    all_actions = actions + missing_standard_rows
    actionable = [item for item in all_actions if item.action_type not in {"monitor_indexed", "monitor_nonstandard_url"}]
    standard_actions = [item for item in all_actions if item.standard_page]
    indexed_standard = [
        item
        for item in standard_actions
        if item.verdict.upper() == "PASS"
    ]
    priority_counts = Counter(item.priority for item in actionable)
    action_type_counts = Counter(item.action_type for item in actionable)
    property_action_counts = Counter(item.property_name for item in actionable)

    generated_at = datetime.now().astimezone()
    run_id = generated_at.strftime("%Y%m%d_%H%M%S_gsc_indexing_actions")
    output_dir = output_root / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = {
        "run_type": "gsc_daily_indexing_actions",
        "generated_at": generated_at.isoformat(timespec="seconds"),
        "generated_at_human": generated_at.strftime("%m/%d/%Y %I:%M %p %Z"),
        "inspection_date": target_date,
        "inspection_date_human": datetime.strptime(target_date, "%Y-%m-%d").strftime("%m/%d/%Y"),
        "mutations_performed": False,
        "properties_with_inspections": len({str(row["property_id"] or "") for row in rows}),
        "inspected_urls": len(rows),
        "standard_page_targets": sum(len(urls) for urls in expected_by_property.values()),
        "standard_pages_inspected": len([item for item in standard_actions if item.verdict != "NOT_INSPECTED"]),
        "standard_pages_indexed": len(indexed_standard),
        "standard_pages_missing_inspection": len(missing_standard_rows),
        "actionable_urls": len(actionable),
        "priority_counts": dict(priority_counts),
        "action_type_counts": dict(action_type_counts),
        "top_properties": property_action_counts.most_common(10),
        "packet_dir": str(output_dir),
    }

    action_dicts = [asdict(item) for item in all_actions]
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (output_dir / "actions.json").write_text(json.dumps({"summary": summary, "actions": action_dicts}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    with (output_dir / "actions.csv").open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(action_dicts[0].keys()) if action_dicts else list(IndexingAction.__dataclass_fields__.keys())
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(action_dicts)

    readout_lines = [
        "# Daily GSC Indexing Actions",
        "",
        f"Generated: {summary['generated_at_human']}",
        f"Inspection date: {summary['inspection_date_human']}",
        f"Properties with inspections: {summary['properties_with_inspections']}",
        f"Inspected URLs: {summary['inspected_urls']}",
        f"Standard pages inspected: {summary['standard_pages_inspected']} / {summary['standard_page_targets']}",
        f"Standard pages indexed: {summary['standard_pages_indexed']}",
        f"Standard pages missing inspection: {summary['standard_pages_missing_inspection']}",
        f"Actionable URLs: {summary['actionable_urls']}",
        "",
        "## Action Types",
        "",
    ]
    if action_type_counts:
        for action_type, count in action_type_counts.most_common():
            readout_lines.append(f"- {action_type}: {count}")
    else:
        readout_lines.append("- No actionable indexing follow-up.")
    readout_lines.extend(
        [
            "",
            "This packet is read-only. It does not submit URLs, mutate sitemaps, request indexing, edit site content, or change Cloudflare/Resi/WordPress state.",
        ]
    )
    (output_dir / "INDEXING_ACTIONS_READOUT.md").write_text("\n".join(readout_lines) + "\n", encoding="utf-8")

    latest_payload = {"latest_packet": str(output_dir), "summary": summary}
    (output_root / "latest.json").write_text(json.dumps(latest_payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return latest_payload


def load_latest_indexing_action_summary(output_root: Path = ACTION_PACKET_ROOT) -> dict[str, Any] | None:
    latest = output_root / "latest.json"
    if not latest.exists():
        return None
    try:
        return json.loads(latest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
