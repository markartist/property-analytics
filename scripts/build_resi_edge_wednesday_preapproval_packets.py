#!/usr/bin/env python3
"""Build non-mutating Wednesday preapproval packets for Resi Edge batch 1."""

from __future__ import annotations

import csv
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
LOCAL_TZ = ZoneInfo("America/Chicago")
READINESS_ROOT = ROOT / "reports/resi_edge_performance/wednesday-readiness"
MANIFEST_ROOT = ROOT / "reports/resi_edge_performance/phase2-manifest-prep"
OUT_ROOT = ROOT / "reports/resi_edge_performance/wednesday-preapproval"
DB_PATH = ROOT / "data/portfolio_analytics.db"
IDENTITY_PATH = ROOT / "config/property_identity_matrix.json"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def latest_packet(root: Path, filename: str) -> Path:
    matches = sorted(root.glob(f"*/{filename}"))
    if not matches:
        raise FileNotFoundError(f"No {filename} found under {root}")
    return matches[-1]


def repo_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def human_date(value: str | None) -> str:
    if not value:
        return ""
    if "T" in value:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").strftime("%m/%d/%Y")
    except ValueError:
        return value


def current_url_from_name(name: str) -> str:
    slug = (
        name.lower()
        .replace("&", "and")
        .replace("'", "")
        .replace(".", "")
        .replace(",", "")
    )
    slug = "-".join(part for part in slug.split() if part)
    return f"https://venterraliving.com/apartments/{slug}/"


def index_by_code(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row.get("property_code")): row for row in rows if row.get("property_code")}


def load_identities() -> dict[str, dict[str, Any]]:
    payload = read_json(IDENTITY_PATH)
    return {
        str(row.get("property_code") or row.get("canonical_property_id")): row
        for row in payload.get("properties", [])
        if row.get("property_code") or row.get("canonical_property_id")
    }


def field_status(pending: set[str], prefixes: list[str], has_source: bool = True) -> str:
    if any(field == prefix or field.startswith(prefix) for field in pending for prefix in prefixes):
        return "needs_final_signoff"
    return "evidence_present_needs_signoff" if has_source else "needs_source"


def source_review(readiness: dict[str, Any], manifest: dict[str, Any], identities: dict[str, dict[str, Any]]) -> dict[str, Any]:
    manifest_by_code = index_by_code(manifest.get("properties", []))
    rows: list[dict[str, Any]] = []
    for ready_row in readiness["rows"]:
        code = ready_row["property_code"]
        manifest_row = manifest_by_code.get(code, {})
        identity = identities.get(code, {})
        pending = set(str(field) for field in manifest_row.get("pending_fields", []))
        source_rows = int(manifest_row.get("source_lookup_rows") or 0)
        phone_present = bool(manifest_row.get("default_display_phone"))
        property_detail_source = bool(identity.get("city") and identity.get("state") and identity.get("unit_count"))

        categories = {
            "content": field_status(pending, ["mobile_shell.content_blocks", "mobile_shell.hero.headline"]),
            "hero_media": field_status(pending, ["mobile_shell.hero", "mobile_shell.content_blocks[0].image_alt", "mobile_shell.content_blocks[1].image_alt"]),
            "reviews": field_status(pending, ["mobile_shell.reviews"]),
            "awards": field_status(pending, ["mobile_shell.awards"]),
            "specials": field_status(pending, ["mobile_shell.promo"]),
            "seo_meta": field_status(pending, ["seo.meta_description", "seo.gsc_indexing_record"]),
            "phone_display": "evidence_present_needs_signoff" if phone_present and source_rows > 0 else "needs_source",
            "property_details": "evidence_present_needs_signoff" if property_detail_source else "needs_source",
        }
        final_status = "needs_final_signoff" if any(value != "ready" for value in categories.values()) else "ready"
        rows.append(
            {
                "property_code": code,
                "property_name": ready_row["property_name"],
                "vanity_domain": ready_row["vanity_domain"],
                "current_url": identity.get("website_url") or identity.get("gsc_url") or current_url_from_name(ready_row["property_name"]),
                "new_url": f"https://{ready_row['vanity_domain']}/",
                "city": identity.get("city"),
                "state": identity.get("state"),
                "unit_count": identity.get("unit_count"),
                "source_lookup_rows": source_rows,
                "default_display_phone": manifest_row.get("default_display_phone"),
                "draft_manifest_repo_path": manifest_row.get("draft_manifest_repo_path"),
                "pending_field_count": len(pending),
                "pending_fields": sorted(pending),
                "review_categories": categories,
                "status": final_status,
                "next_action": "Final human signoff required for content, media, reviews, awards, specials, SEO/meta, phone display, and property details.",
            }
        )

    category_counts: dict[str, dict[str, int]] = {}
    for category in rows[0]["review_categories"]:
        category_counts[category] = dict(Counter(row["review_categories"][category] for row in rows))
    return {
        "schema": "resi_edge_source_property_review_v1",
        "mutations_performed": False,
        "summary": {
            "properties": len(rows),
            "ready": sum(1 for row in rows if row["status"] == "ready"),
            "needs_final_signoff": sum(1 for row in rows if row["status"] != "ready"),
            "category_counts": category_counts,
        },
        "rows": rows,
    }


def aggregate_gsc(conn: sqlite3.Connection, site_url: str, start: str, end: str) -> dict[str, Any]:
    cur = conn.execute(
        """
        select
          count(*) as days,
          coalesce(sum(clicks), 0) as clicks,
          coalesce(sum(impressions), 0) as impressions,
          coalesce(avg(ctr), 0) as ctr,
          coalesce(avg(average_position), 0) as average_position
        from gsc_daily_metrics
        where gsc_site_url = ? and metric_date between ? and ?
        """,
        (site_url, start, end),
    )
    row = cur.fetchone()
    days, clicks, impressions, ctr, position = row
    return {
        "days": days,
        "clicks": clicks,
        "impressions": impressions,
        "ctr": round(float(ctr or 0), 4),
        "average_position": round(float(position or 0), 2),
    }


def latest_inspection(conn: sqlite3.Connection, url: str) -> dict[str, Any] | None:
    cur = conn.execute(
        """
        select inspection_date, verdict, coverage_state, indexing_state, page_fetch_state,
               robots_txt_state, google_canonical, user_canonical, last_crawl_time
        from gsc_url_inspection
        where inspected_url = ?
        order by inspection_date desc, collected_at desc
        limit 1
        """,
        (url,),
    )
    row = cur.fetchone()
    if not row:
        return None
    keys = [
        "inspection_date",
        "verdict",
        "coverage_state",
        "indexing_state",
        "page_fetch_state",
        "robots_txt_state",
        "google_canonical",
        "user_canonical",
        "last_crawl_time",
    ]
    return dict(zip(keys, row))


def google_visibility(readiness: dict[str, Any], identities: dict[str, dict[str, Any]]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    with sqlite3.connect(DB_PATH) as conn:
        latest = conn.execute("select max(metric_date) from gsc_daily_metrics").fetchone()[0]
        latest_dt = datetime.strptime(latest, "%Y-%m-%d").date()
        t28_end = latest_dt
        t28_start = t28_end - timedelta(days=27)
        p28_end = t28_start - timedelta(days=1)
        p28_start = p28_end - timedelta(days=27)

        for ready_row in readiness["rows"]:
            code = ready_row["property_code"]
            identity = identities.get(code, {})
            current_url = identity.get("gsc_url") or identity.get("website_url") or current_url_from_name(ready_row["property_name"])
            new_url = f"https://{ready_row['vanity_domain']}/"
            current_t28 = aggregate_gsc(conn, current_url, t28_start.isoformat(), t28_end.isoformat())
            current_p28 = aggregate_gsc(conn, current_url, p28_start.isoformat(), p28_end.isoformat())
            current_inspection = latest_inspection(conn, current_url)
            new_inspection = latest_inspection(conn, new_url)
            rows.append(
                {
                    "property_code": code,
                    "property_name": ready_row["property_name"],
                    "current_url": current_url,
                    "new_url": new_url,
                    "gsc_site_url": current_url,
                    "current_t28": current_t28,
                    "current_prior_28": current_p28,
                    "current_latest_inspection": current_inspection,
                    "new_domain_latest_inspection": new_inspection,
                    "status": "baseline_captured" if current_t28["days"] > 0 and current_inspection else "needs_visibility_evidence",
                    "notes": "Current Venterra URL baseline captured. New vanity domain has no prelaunch GSC history unless explicitly present below.",
                }
            )

    status_counts = Counter(row["status"] for row in rows)
    return {
        "schema": "resi_edge_google_visibility_baseline_v1",
        "mutations_performed": False,
        "warehouse": repo_path(DB_PATH),
        "data_delay_note": "GSC daily performance data is expected to lag by roughly three days.",
        "windows": {
            "current_28_start": human_date(t28_start.isoformat()),
            "current_28_end": human_date(t28_end.isoformat()),
            "prior_28_start": human_date(p28_start.isoformat()),
            "prior_28_end": human_date(p28_end.isoformat()),
        },
        "summary": {
            "properties": len(rows),
            "baseline_captured": status_counts.get("baseline_captured", 0),
            "needs_visibility_evidence": status_counts.get("needs_visibility_evidence", 0),
            "current_indexed_count": sum(
                1
                for row in rows
                if (row.get("current_latest_inspection") or {}).get("verdict") == "PASS"
            ),
            "new_domain_inspection_count": sum(1 for row in rows if row.get("new_domain_latest_inspection")),
            "t28_clicks": sum(row["current_t28"]["clicks"] for row in rows),
            "t28_impressions": sum(row["current_t28"]["impressions"] for row in rows),
        },
        "rows": rows,
    }


def rollback_snapshot(readiness: dict[str, Any], source_review_payload: dict[str, Any]) -> dict[str, Any]:
    source_by_code = index_by_code(source_review_payload["rows"])
    rows = []
    for row in readiness["rows"]:
        source = source_by_code[row["property_code"]]
        rows.append(
            {
                "property_code": row["property_code"],
                "property_name": row["property_name"],
                "current_url": source["current_url"],
                "new_url": source["new_url"],
                "cloudflare_zone_status": row["cloudflare_zone_status"],
                "draft_manifest_repo_path": row["draft_manifest_repo_path"],
                "preapproval_state": "no_live_routing_mutation_from_this_packet",
                "pause_action": "Do not enable public routing for this property; keep current Venterra URL as the public canonical path.",
                "recovery_action": "If a post-approval gate fails, stop the batch, preserve that property's evidence packet, roll back the changed Cloudflare route/Worker binding to the previous recorded state, and leave WordPress/admin/control paths uncached.",
                "required_before_approval": "Attach route/Worker snapshot and approval owner.",
            }
        )
    return {
        "schema": "resi_edge_rollback_recovery_snapshot_v1",
        "mutations_performed": False,
        "summary": {
            "properties": len(rows),
            "snapshots_prepared": len(rows),
            "live_mutations_performed": 0,
            "approval_required_before_live_change": True,
        },
        "rows": rows,
    }


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_source_md(path: Path, payload: dict[str, Any], generated_human: str) -> None:
    lines = [
        "# Resi Edge Wednesday Source And Property Review",
        "",
        f"Generated: {generated_human}",
        "Mutation posture: none.",
        "",
        "## Summary",
        "",
        f"- Properties: `{payload['summary']['properties']}`",
        f"- Ready: `{payload['summary']['ready']}`",
        f"- Needs final signoff: `{payload['summary']['needs_final_signoff']}`",
        "",
        "## Property Signoff Queue",
        "",
        "| Code | Property | Current URL | New URL | Pending fields | Status |",
        "| --- | --- | --- | --- | ---: | --- |",
    ]
    for row in payload["rows"]:
        lines.append(
            f"| {row['property_code']} | {row['property_name']} | {row['current_url']} | {row['new_url']} | {row['pending_field_count']} | {row['status']} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_google_md(path: Path, payload: dict[str, Any], generated_human: str) -> None:
    lines = [
        "# Resi Edge Wednesday Google Visibility Baseline",
        "",
        f"Generated: {generated_human}",
        "Mutation posture: none.",
        "",
        "## Summary",
        "",
        f"- Properties with current URL baseline: `{payload['summary']['baseline_captured']}/{payload['summary']['properties']}`",
        f"- Current indexed count: `{payload['summary']['current_indexed_count']}/{payload['summary']['properties']}`",
        f"- New-domain inspection rows already present: `{payload['summary']['new_domain_inspection_count']}/{payload['summary']['properties']}`",
        f"- T28 clicks: `{payload['summary']['t28_clicks']}`",
        f"- T28 impressions: `{payload['summary']['t28_impressions']}`",
        f"- GSC window: `{payload['windows']['current_28_start']}` to `{payload['windows']['current_28_end']}`",
        "",
        "## Property Baseline",
        "",
        "| Code | Property | Current URL | New URL | T28 Clicks | T28 Impr. | Inspection | Status |",
        "| --- | --- | --- | --- | ---: | ---: | --- | --- |",
    ]
    for row in payload["rows"]:
        inspection = row.get("current_latest_inspection") or {}
        inspection_label = " / ".join(
            part for part in [inspection.get("verdict"), inspection.get("coverage_state")] if part
        ) or "missing"
        lines.append(
            f"| {row['property_code']} | {row['property_name']} | {row['current_url']} | {row['new_url']} | {row['current_t28']['clicks']} | {row['current_t28']['impressions']} | {inspection_label} | {row['status']} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_rollback_md(path: Path, payload: dict[str, Any], generated_human: str) -> None:
    lines = [
        "# Resi Edge Wednesday Rollback And Recovery Snapshot",
        "",
        f"Generated: {generated_human}",
        "Mutation posture: none.",
        "",
        "## Batch Rule",
        "",
        "If any post-approval live gate fails, stop the batch, preserve evidence, and discuss before continuing.",
        "",
        "## Snapshot Queue",
        "",
        "| Code | Property | New URL | Cloudflare | Preapproval State | Required Before Approval |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in payload["rows"]:
        lines.append(
            f"| {row['property_code']} | {row['property_name']} | {row['new_url']} | {row['cloudflare_zone_status']} | {row['preapproval_state']} | {row['required_before_approval']} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_approval_packet(path: Path, generated_human: str, readiness: dict[str, Any], source_payload: dict[str, Any], google_payload: dict[str, Any], rollback_payload: dict[str, Any], sources: dict[str, str]) -> None:
    lines = [
        "# Resi Edge Wednesday Approval Packet",
        "",
        f"Generated: {generated_human}",
        "Launch target: 08/19/2026",
        "Mutation posture for this packet: none.",
        "",
        "## Approval Required",
        "",
        "- Business launch owner approves the 20-property batch.",
        "- WebOps approves Cloudflare routing and rollback posture.",
        "- Marketing/Ops approves content, hero/media, reviews, awards, specials, SEO/meta, phone display, and property details.",
        "",
        "## Scope",
        "",
        f"- Properties in batch: `{readiness['summary']['total_properties']}`",
        f"- Source/property signoff still open: `{source_payload['summary']['needs_final_signoff']}`",
        f"- Google visibility baselines captured: `{google_payload['summary']['baseline_captured']}`",
        f"- Rollback snapshots prepared: `{rollback_payload['summary']['snapshots_prepared']}`",
        "",
        "## Stop Conditions",
        "",
        "- Any source/property owner rejects content, media, phone, special, awards, reviews, SEO/meta, or details.",
        "- Any Cloudflare zone is not active or cannot be snapshotted before approval.",
        "- Any current URL lacks Google visibility/indexing baseline evidence.",
        "- Any PSI baseline run fails or returns an unavailable result.",
        "- Any post-approval live gate fails. Do not continue to the next property until reviewed.",
        "",
        "## After Approval Only",
        "",
        "- Run routing live proof.",
        "- Run WordPress admin/control bypass proof.",
        "- Run consent, Zaraz analytics, and source attribution proof.",
        "- Run R2 asset readback.",
        "- Run mobile shell visual proof and desktop no-topper proof.",
        "- Run PSI mobile/desktop readout.",
        "- Run batch readout and publish evidence packet.",
        "",
        "## Source Packets",
        "",
    ]
    for label, source in sources.items():
        lines.append(f"- {label}: `{source}`")
    lines.extend(["", "## Properties", "", "| Code | Property | Current URL | New URL |", "| --- | --- | --- | --- |"])
    source_by_code = index_by_code(source_payload["rows"])
    for row in readiness["rows"]:
        source = source_by_code[row["property_code"]]
        lines.append(f"| {row['property_code']} | {row['property_name']} | {source['current_url']} | {source['new_url']} |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    generated_human = now.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")
    out_dir = OUT_ROOT / f"wednesday-preapproval-{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    readiness_path = latest_packet(READINESS_ROOT, "wednesday-readiness-queue.json")
    manifest_path = latest_packet(MANIFEST_ROOT, "manifest-prep.json")
    readiness = read_json(readiness_path)
    manifest = read_json(manifest_path)
    identities = load_identities()

    source_payload = source_review(readiness, manifest, identities)
    google_payload = google_visibility(readiness, identities)
    rollback_payload = rollback_snapshot(readiness, source_payload)
    sources = {
        "readiness_queue": repo_path(readiness_path),
        "manifest_prep": repo_path(manifest_path),
        "property_identity_matrix": repo_path(IDENTITY_PATH),
        "data_pond_warehouse": repo_path(DB_PATH),
        "source_review": repo_path(out_dir / "source-property-review.json"),
        "google_visibility": repo_path(out_dir / "google-visibility-baseline.json"),
        "rollback_snapshot": repo_path(out_dir / "rollback-recovery-snapshot.json"),
    }

    write_json(out_dir / "source-property-review.json", source_payload)
    write_json(out_dir / "google-visibility-baseline.json", google_payload)
    write_json(out_dir / "rollback-recovery-snapshot.json", rollback_payload)
    write_json(
        out_dir / "preapproval-summary.json",
        {
            "schema": "resi_edge_wednesday_preapproval_summary_v1",
            "generated_at": now.isoformat().replace("+00:00", "Z"),
            "generated_at_human": generated_human,
            "mutations_performed": False,
            "source_review": source_payload["summary"],
            "google_visibility": google_payload["summary"],
            "rollback": rollback_payload["summary"],
            "sources": sources,
        },
    )

    write_csv(
        out_dir / "source-property-review.csv",
        source_payload["rows"],
        ["property_code", "property_name", "current_url", "new_url", "city", "state", "unit_count", "source_lookup_rows", "default_display_phone", "pending_field_count", "status", "next_action"],
    )
    google_csv_rows = []
    for row in google_payload["rows"]:
        inspection = row.get("current_latest_inspection") or {}
        google_csv_rows.append(
            {
                "property_code": row["property_code"],
                "property_name": row["property_name"],
                "current_url": row["current_url"],
                "new_url": row["new_url"],
                "t28_clicks": row["current_t28"]["clicks"],
                "t28_impressions": row["current_t28"]["impressions"],
                "prior28_clicks": row["current_prior_28"]["clicks"],
                "prior28_impressions": row["current_prior_28"]["impressions"],
                "inspection_date": inspection.get("inspection_date"),
                "inspection_verdict": inspection.get("verdict"),
                "coverage_state": inspection.get("coverage_state"),
                "status": row["status"],
            }
        )
    write_csv(
        out_dir / "google-visibility-baseline.csv",
        google_csv_rows,
        ["property_code", "property_name", "current_url", "new_url", "t28_clicks", "t28_impressions", "prior28_clicks", "prior28_impressions", "inspection_date", "inspection_verdict", "coverage_state", "status"],
    )
    write_csv(
        out_dir / "rollback-recovery-snapshot.csv",
        rollback_payload["rows"],
        ["property_code", "property_name", "current_url", "new_url", "cloudflare_zone_status", "preapproval_state", "pause_action", "recovery_action", "required_before_approval"],
    )

    write_source_md(out_dir / "SOURCE_PROPERTY_REVIEW.md", source_payload, generated_human)
    write_google_md(out_dir / "GOOGLE_VISIBILITY_BASELINE.md", google_payload, generated_human)
    write_rollback_md(out_dir / "ROLLBACK_RECOVERY_SNAPSHOT.md", rollback_payload, generated_human)
    write_approval_packet(out_dir / "WEDNESDAY_APPROVAL_PACKET.md", generated_human, readiness, source_payload, google_payload, rollback_payload, sources)
    write_json(OUT_ROOT / "latest.json", {"latest": repo_path(out_dir)})

    print(json.dumps({"out_dir": repo_path(out_dir), "summary": read_json(out_dir / "preapproval-summary.json")}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
