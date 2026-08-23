#!/usr/bin/env python3
"""Build a Captain-ready watch/action packet from Jira issue search output.

The script is intentionally non-mutating by default. It turns Jira issue JSON
into property-scoped Captain watch items/actions using the governed property
identity matrix, then writes report artifacts and optional SQL upserts for a
separate approved publish step.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import (  # noqa: E402
    PropertyIdentity,
    load_property_identities,
    normalize_property_key,
    resolve_property_identity,
)

DEFAULT_OUTPUT_ROOT = ROOT / "reports" / "captains_log" / "jira_ticket_watch"
DEFAULT_CLOUD_URL = "https://venterra.atlassian.net"
DEFAULT_PROPERTY_FIELDS = ("customfield_10106",)
DISPLAY_TZ = ZoneInfo("America/Chicago")


@dataclass(frozen=True)
class PropertyMatch:
    identity: PropertyIdentity
    source: str
    raw_value: str
    confidence: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Jira ticket awareness packet for Captains.")
    parser.add_argument("--input", type=Path, help="Jira issue JSON. Reads stdin when omitted.")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--run-id", help="Stable run id. Defaults to timestamped id.")
    parser.add_argument("--as-of", help="ISO timestamp for the packet. Defaults to now.")
    parser.add_argument("--cloud-url", default=DEFAULT_CLOUD_URL)
    parser.add_argument("--property-field", action="append", default=[], help="Jira field id/name that contains the property option.")
    parser.add_argument("--emit-sql", action="store_true", help="Also write SQL upserts for captain_watch_items and captain_actions.")
    parser.add_argument("--primary-only", action="store_true", help="Only create Captain records for the Jira property field, not text mentions.")
    args = parser.parse_args()

    as_of = parse_as_of(args.as_of)
    run_id = args.run_id or f"jira_captain_watch_{compact_timestamp(as_of)}"
    payload = read_payload(args.input)
    issues = extract_issues(payload)
    property_fields = tuple(args.property_field or DEFAULT_PROPERTY_FIELDS)
    records = build_records(issues, property_fields=property_fields, cloud_url=args.cloud_url, primary_only=args.primary_only, as_of=as_of)
    output_dir = args.output_root / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    packet = {
        "run_id": run_id,
        "as_of": as_of.isoformat().replace("+00:00", "Z"),
        "source": {
            "system": "Jira",
            "cloud_url": args.cloud_url,
            "property_fields": list(property_fields),
            "primary_only": args.primary_only,
        },
        "summary": summarize(records, issues),
        "captain_records": records,
    }

    (output_dir / "jira-captain-watch-packet.json").write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_markdown(output_dir / "JIRA_CAPTAIN_WATCH_READOUT.md", packet)
    write_csv(output_dir / "jira-captain-watch-rows.csv", records)
    if args.emit_sql:
        (output_dir / "captain-watch-upserts.sql").write_text(render_sql(records, as_of), encoding="utf-8")

    print(f"Wrote {len(records)} Captain Jira record(s) from {len(issues)} issue(s): {output_dir}")
    return 0


def parse_as_of(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc).replace(microsecond=0)
    text = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0)


def read_payload(path: Path | None) -> Any:
    text = path.read_text(encoding="utf-8") if path else sys.stdin.read()
    if not text.strip():
        raise SystemExit("No Jira JSON supplied.")
    return json.loads(text)


def extract_issues(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    issues = payload.get("issues")
    if isinstance(issues, dict):
        nodes = issues.get("nodes")
        if isinstance(nodes, list):
            return [item for item in nodes if isinstance(item, dict)]
    if isinstance(issues, list):
        return [item for item in issues if isinstance(item, dict)]
    nodes = payload.get("nodes")
    if isinstance(nodes, list):
        return [item for item in nodes if isinstance(item, dict)]
    return []


def build_records(
    issues: list[dict[str, Any]],
    *,
    property_fields: tuple[str, ...],
    cloud_url: str,
    primary_only: bool,
    as_of: datetime,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for issue in issues:
        fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
        key = str(issue.get("key") or fields.get("key") or "").strip()
        if not key:
            continue
        title = clean_text(fields.get("summary") or issue.get("summary") or key)
        description = clean_text(fields.get("description") or "")
        matches = property_matches(fields, title, description, property_fields, primary_only=primary_only)
        if not matches:
            records.append(unresolved_record(issue, fields, title, description, cloud_url, as_of))
            continue
        for match in matches:
            records.append(captain_record(issue, fields, title, description, match, cloud_url, as_of))
    records.sort(key=lambda row: (row["property_code"] == "UNRESOLVED", row["property_name"], priority_rank(row["priority"]), row["jira_key"]))
    return records


def property_matches(
    fields: dict[str, Any],
    title: str,
    description: str,
    property_fields: tuple[str, ...],
    *,
    primary_only: bool,
) -> list[PropertyMatch]:
    seen: dict[str, PropertyMatch] = {}
    for field in property_fields:
        raw = extract_field_text(fields.get(field))
        for candidate in property_candidates(raw):
            identity = resolve_property_identity(candidate)
            if identity:
                seen[identity.property_code or identity.canonical_property_id] = PropertyMatch(identity, field, raw, "high")
                break
    if primary_only:
        return list(seen.values())
    text = f"{title}\n{description}"
    for identity, raw_alias in find_text_property_mentions(text):
        key = identity.property_code or identity.canonical_property_id
        seen.setdefault(key, PropertyMatch(identity, "text_mention", raw_alias, "medium"))
    return list(seen.values())


def extract_field_text(value: Any) -> str:
    if isinstance(value, dict):
        if value.get("value"):
            return str(value["value"])
        if value.get("name"):
            return str(value["name"])
    if isinstance(value, str):
        return value
    return ""


def property_candidates(raw: str) -> list[str]:
    text = clean_text(raw)
    if not text:
        return []
    candidates = [text]
    without_code = re.sub(r"\s+-\s+\d+\s*$", "", text).strip()
    if without_code and without_code != text:
        candidates.insert(0, without_code)
    return candidates


def find_text_property_mentions(text: str) -> list[tuple[PropertyIdentity, str]]:
    normalized_text = f" {normalize_property_key(text)} "
    matches: dict[str, tuple[PropertyIdentity, str, int]] = {}
    for identity in load_property_identities():
        aliases = {
            identity.property_name,
            identity.community_name,
            identity.encasa_short_name,
            *(identity.aliases or ()),
        }
        for alias in aliases:
            if not alias:
                continue
            normalized_alias = normalize_property_key(str(alias))
            if len(normalized_alias) < 4:
                continue
            if f" {normalized_alias} " in normalized_text:
                key = identity.property_code or identity.canonical_property_id
                current = matches.get(key)
                score = len(normalized_alias)
                if current is None or score > current[2]:
                    matches[key] = (identity, str(alias), score)
    return [(identity, alias) for identity, alias, _score in matches.values()]


def captain_record(
    issue: dict[str, Any],
    fields: dict[str, Any],
    title: str,
    description: str,
    match: PropertyMatch,
    cloud_url: str,
    as_of: datetime,
) -> dict[str, Any]:
    key = str(issue.get("key"))
    status = field_name(fields.get("status"))
    priority = field_name(fields.get("priority")) or "Medium"
    category, owner_role, next_move = classify_issue(title, description, status)
    identity = match.identity
    evidence = evidence_payload(issue, fields, match, cloud_url)
    severity = priority_to_severity(priority)
    stale_days = days_between(parse_jira_datetime(fields.get("updated")), as_of)
    if stale_days is not None and stale_days >= 14 and severity != "critical":
        severity = "high"
    watch_status = "monitoring" if status.lower() == "pending vendor" else "open"
    action_status = "blocked" if status.lower() == "pending vendor" else "open"
    current_state = f"Jira {key} is {status or 'Unknown'} / {priority}: {title}"
    if stale_days is not None and stale_days >= 7:
        current_state += f" Last updated {stale_days} day(s) ago."
    return {
        "property_code": identity.property_code,
        "community_id": identity.community_id,
        "property_name": identity.property_name,
        "jira_key": key,
        "jira_url": str(issue.get("webUrl") or f"{cloud_url.rstrip('/')}/browse/{key}"),
        "jira_status": status,
        "priority": priority,
        "severity": severity,
        "created": jira_date(fields.get("created")),
        "updated": jira_date(fields.get("updated")),
        "stale_days": stale_days,
        "match_source": match.source,
        "match_value": match.raw_value,
        "match_confidence": match.confidence,
        "category": category,
        "watch_key": f"jira_{key.lower()}",
        "watch_title": f"Jira: {title}",
        "watch_status": watch_status,
        "current_state": current_state,
        "next_move": next_move,
        "owner_role": owner_role,
        "action_key": f"jira_{key.lower()}_next_move",
        "action_title": f"Resolve Jira {key}: {title}",
        "action_status": action_status,
        "action_priority": severity,
        "evidence": evidence,
    }


def unresolved_record(issue: dict[str, Any], fields: dict[str, Any], title: str, description: str, cloud_url: str, as_of: datetime) -> dict[str, Any]:
    key = str(issue.get("key"))
    priority = field_name(fields.get("priority")) or "Medium"
    status = field_name(fields.get("status"))
    return {
        "property_code": "UNRESOLVED",
        "community_id": None,
        "property_name": "Unresolved Property",
        "jira_key": key,
        "jira_url": str(issue.get("webUrl") or f"{cloud_url.rstrip('/')}/browse/{key}"),
        "jira_status": status,
        "priority": priority,
        "severity": priority_to_severity(priority),
        "created": jira_date(fields.get("created")),
        "updated": jira_date(fields.get("updated")),
        "stale_days": days_between(parse_jira_datetime(fields.get("updated")), as_of),
        "match_source": "unresolved",
        "match_value": "",
        "match_confidence": "none",
        "category": "jira_property_resolution",
        "watch_key": f"jira_{key.lower()}",
        "watch_title": f"Jira needs property resolution: {title}",
        "watch_status": "open",
        "current_state": f"Jira {key} could not be resolved to the governed property identity matrix.",
        "next_move": "Add or correct the Jira property field before routing to a Captain.",
        "owner_role": "WebOps / Jira intake",
        "action_key": f"jira_{key.lower()}_resolve_property",
        "action_title": f"Resolve property for Jira {key}",
        "action_status": "open",
        "action_priority": priority_to_severity(priority),
        "evidence": evidence_payload(issue, fields, PropertyMatchPlaceholder(), cloud_url),
    }


class PropertyMatchPlaceholder:
    source = "unresolved"
    raw_value = ""
    confidence = "none"


def evidence_payload(issue: dict[str, Any], fields: dict[str, Any], match: Any, cloud_url: str) -> dict[str, Any]:
    key = str(issue.get("key"))
    return {
        "source_system": "jira",
        "issue_key": key,
        "issue_url": str(issue.get("webUrl") or f"{cloud_url.rstrip('/')}/browse/{key}"),
        "jira_status": field_name(fields.get("status")),
        "jira_priority": field_name(fields.get("priority")),
        "created": jira_date(fields.get("created")),
        "updated": jira_date(fields.get("updated")),
        "property_match": {
            "source": match.source,
            "value": match.raw_value,
            "confidence": match.confidence,
        },
        "summary": clean_text(fields.get("summary") or ""),
        "description_excerpt": clean_text(fields.get("description") or "")[:500],
    }


def classify_issue(title: str, description: str, status: str) -> tuple[str, str, str]:
    text = f"{title} {description}".lower()
    if any(word in text for word in ("photo", "picture", "gallery", "image")):
        return (
            "website_media",
            "WebOps / Site Content",
            "Identify the exact image/location, coordinate vendor or content-system change, and attach visual readback proof after update.",
        )
    if any(word in text for word in ("special", "concession", "banner", "quote", "rent", "bedroom", "free")):
        return (
            "website_specials_pricing",
            "WebOps / Revenue / Property",
            "Confirm the approved offer and affected floorplans/units, then update the website/banner or quoting rule with public readback proof.",
        )
    if any(word in text for word in ("phone", "address", "wrong property", "rate us", "venterra listens")):
        return (
            "website_nap_identity",
            "Navigator / WebOps",
            "Verify the governed property NAP/source value, correct the public surface, and capture before/after proof.",
        )
    if any(word in text for word in ("google", "gps", "drop pin", "map")):
        return (
            "local_entity_gbp",
            "GBP / Navigator",
            "Confirm the leasing-office pin coordinates and route the update through the governed GBP/local-entity lane.",
        )
    if status.lower() == "pending vendor":
        return (
            "vendor_followup",
            "WebOps / Vendor",
            "Chase vendor status, record blocker/proof needed, and close the Captain watch once public readback is clean.",
        )
    return (
        "jira_followup",
        "WebOps / Property",
        "Clarify the requested outcome, identify the owning source system, and record the proof needed to close the ticket.",
    )


def summarize(records: list[dict[str, Any]], issues: list[dict[str, Any]]) -> dict[str, Any]:
    properties = {row["property_code"] for row in records if row["property_code"] != "UNRESOLVED"}
    critical = [row for row in records if row["severity"] == "critical"]
    stale = [row for row in records if row.get("stale_days") is not None and row["stale_days"] >= 14]
    pending_vendor = [row for row in records if str(row.get("jira_status", "")).lower() == "pending vendor"]
    return {
        "issue_count": len(issues),
        "captain_record_count": len(records),
        "property_count": len(properties),
        "critical_record_count": len(critical),
        "stale_14_day_record_count": len(stale),
        "pending_vendor_record_count": len(pending_vendor),
        "unresolved_record_count": len([row for row in records if row["property_code"] == "UNRESOLVED"]),
    }


def write_markdown(path: Path, packet: dict[str, Any]) -> None:
    summary = packet["summary"]
    lines = [
        "# Jira Captain Watch Readout",
        "",
        f"Generated: {human_datetime(packet['as_of'])}",
        "",
        "## Summary",
        "",
        f"- Jira issues reviewed: {summary['issue_count']}",
        f"- Captain records produced: {summary['captain_record_count']}",
        f"- Properties with Jira visibility: {summary['property_count']}",
        f"- Critical Captain records: {summary['critical_record_count']}",
        f"- Pending vendor records: {summary['pending_vendor_record_count']}",
        f"- Stale 14+ day records: {summary['stale_14_day_record_count']}",
        f"- Unresolved property records: {summary['unresolved_record_count']}",
        "",
        "## Property Captain Queue",
        "",
        "| Property | Ticket | Priority | Status | Updated | Category | Next Move |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in packet["captain_records"]:
        lines.append(
            "| {property} | [{key}]({url}) | {priority} | {status} | {updated} | {category} | {next_move} |".format(
                property=f"{row['property_code']} {row['property_name']}",
                key=row["jira_key"],
                url=row["jira_url"],
                priority=row["priority"],
                status=row["jira_status"],
                updated=human_date(row["updated"]),
                category=row["category"],
                next_move=escape_md(row["next_move"]),
            )
        )
    lines.extend([
        "",
        "## Publish Notes",
        "",
        "- This packet is non-mutating unless the SQL output is reviewed and applied separately.",
        "- Jira remains the work-order source. Captain records are property awareness, next-move, and proof-routing records.",
        "- Dates shown to humans use MM/DD/YYYY; raw JSON preserves source timestamps for machines.",
        "",
    ])
    path.write_text("\n".join(lines), encoding="utf-8")


def write_csv(path: Path, records: list[dict[str, Any]]) -> None:
    fields = [
        "property_code",
        "property_name",
        "jira_key",
        "jira_url",
        "priority",
        "jira_status",
        "updated",
        "stale_days",
        "match_source",
        "category",
        "owner_role",
        "next_move",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in records:
            writer.writerow({field: row.get(field) for field in fields})


def render_sql(records: list[dict[str, Any]], as_of: datetime) -> str:
    now = as_of.isoformat().replace("+00:00", "Z")
    lines = [
        "-- Review before applying. Generated Captain Jira watch/action upserts.",
        "BEGIN TRANSACTION;",
    ]
    for row in records:
        if row["property_code"] == "UNRESOLVED":
            continue
        evidence = json.dumps(row["evidence"], sort_keys=True)
        watch_id = stable_id("captain_watch", row["property_code"], row["watch_key"])
        action_id = stable_id("captain_action", row["property_code"], row["action_key"])
        lines.append(
            "INSERT INTO captain_watch_items (id, property_id, community_id, watch_key, title, category, severity, status, current_state, evidence_json, next_move, owner_role, due_date, source_agent_key, first_seen_at, last_seen_at, resolved_at, created_at, updated_at, updated_by) VALUES "
            f"({sql(watch_id)}, {sql(row['property_code'])}, {sql(row['community_id'])}, {sql(row['watch_key'])}, {sql(row['watch_title'])}, {sql(row['category'])}, {sql(row['severity'])}, {sql(row['watch_status'])}, {sql(row['current_state'])}, {sql(evidence)}, {sql(row['next_move'])}, {sql(row['owner_role'])}, NULL, 'jira_watch', {sql(now)}, {sql(now)}, NULL, {sql(now)}, {sql(now)}, 'jira-captain-watch') "
            "ON CONFLICT(property_id, watch_key) DO UPDATE SET status=excluded.status, current_state=excluded.current_state, evidence_json=excluded.evidence_json, next_move=excluded.next_move, owner_role=excluded.owner_role, last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at, updated_by=excluded.updated_by;"
        )
        lines.append(
            "INSERT INTO captain_actions (id, property_id, community_id, action_key, title, owner_role, due_date, status, priority, evidence_json, source_agent_key, created_from_run_id, created_at, updated_at, updated_by) VALUES "
            f"({sql(action_id)}, {sql(row['property_code'])}, {sql(row['community_id'])}, {sql(row['action_key'])}, {sql(row['action_title'])}, {sql(row['owner_role'])}, NULL, {sql(row['action_status'])}, {sql(row['action_priority'])}, {sql(evidence)}, 'jira_watch', NULL, {sql(now)}, {sql(now)}, 'jira-captain-watch') "
            "ON CONFLICT(property_id, action_key) DO UPDATE SET status=excluded.status, priority=excluded.priority, evidence_json=excluded.evidence_json, owner_role=excluded.owner_role, updated_at=excluded.updated_at, updated_by=excluded.updated_by;"
        )
    lines.extend(["COMMIT;", ""])
    return "\n".join(lines)


def field_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or value.get("value") or "").strip()
    return str(value or "").strip()


def clean_text(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\u200c", " ")
    return re.sub(r"\s+", " ", text).strip()


def parse_jira_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value)
    try:
        if re.search(r"[+-]\d{4}$", text):
            text = f"{text[:-5]}{text[-5:-2]}:{text[-2:]}"
        return datetime.fromisoformat(text).astimezone(timezone.utc)
    except ValueError:
        return None


def jira_date(value: Any) -> str | None:
    parsed = parse_jira_datetime(value)
    return parsed.isoformat().replace("+00:00", "Z") if parsed else None


def days_between(start: datetime | None, end: datetime) -> int | None:
    if not start:
        return None
    return max(0, int((end - start).total_seconds() // 86400))


def human_date(value: Any) -> str:
    if not value:
        return "-"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.astimezone(DISPLAY_TZ).strftime("%m/%d/%Y")


def human_datetime(value: Any) -> str:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.astimezone(DISPLAY_TZ).strftime("%m/%d/%Y %I:%M %p CT").lstrip("0").replace("/0", "/")


def priority_to_severity(priority: str) -> str:
    text = priority.lower()
    if text in {"critical", "highest", "blocker"}:
        return "critical"
    if text in {"high", "major"}:
        return "high"
    if text in {"medium", "minor"}:
        return "medium"
    return "low"


def priority_rank(priority: str) -> int:
    return {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}.get(priority, 4)


def compact_timestamp(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%SZ")


def stable_id(prefix: str, property_code: str, key: str) -> str:
    digest = hashlib.sha1(f"{property_code}:{key}".encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{property_code}_{digest}"


def sql(value: Any) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def escape_md(value: str) -> str:
    return value.replace("|", "\\|")


if __name__ == "__main__":
    raise SystemExit(main())
