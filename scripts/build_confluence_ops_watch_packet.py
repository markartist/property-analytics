#!/usr/bin/env python3
"""Build a read-only Ops Watch packet from Confluence/Rovo search output."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
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
)

DEFAULT_OUTPUT_ROOT = ROOT / "reports" / "ops_watch" / "confluence_ops_watch"
DISPLAY_TZ = ZoneInfo("America/Chicago")


@dataclass(frozen=True)
class PropertyMention:
    identity: PropertyIdentity
    alias: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Confluence Ops Watch packet from Rovo/Confluence search JSON.")
    parser.add_argument("--input", type=Path, help="Rovo/Confluence search JSON. Reads stdin when omitted.")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--run-id", help="Stable run id. Defaults to timestamped id.")
    parser.add_argument("--as-of", help="ISO timestamp for packet generation. Defaults to now.")
    args = parser.parse_args()

    as_of = parse_as_of(args.as_of)
    run_id = args.run_id or f"confluence_ops_watch_{as_of.strftime('%Y%m%dT%H%M%SZ')}"
    payload = read_payload(args.input)
    pages = extract_pages(payload)
    signals, captain_records = build_packet_rows(pages, as_of)
    output_dir = args.output_root / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    packet = {
        "run_id": run_id,
        "as_of": as_of.isoformat().replace("+00:00", "Z"),
        "source": {
            "system": "Confluence",
            "harvest_mode": "Atlassian Rovo or Confluence search JSON",
            "mutation_policy": "read_only",
        },
        "summary": summarize(signals, captain_records, pages),
        "source_signals": signals,
        "captain_records": captain_records,
    }

    (output_dir / "confluence-ops-watch-packet.json").write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_markdown(output_dir / "CONFLUENCE_OPS_WATCH_READOUT.md", packet)
    write_signals_csv(output_dir / "confluence-ops-watch-signals.csv", signals)
    write_captain_csv(output_dir / "confluence-ops-watch-captain-records.csv", captain_records)

    print(f"Wrote Confluence Ops Watch packet with {len(signals)} signal(s): {output_dir}")
    return 0


def parse_as_of(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc).replace(microsecond=0)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0)


def read_payload(path: Path | None) -> Any:
    text = path.read_text(encoding="utf-8") if path else sys.stdin.read()
    if not text.strip():
        raise SystemExit("No Confluence search JSON supplied.")
    return json.loads(text)


def extract_pages(payload: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    candidates: Any = payload
    if isinstance(payload, dict):
        candidates = payload.get("results") or payload.get("pages") or payload.get("nodes") or []
    if not isinstance(candidates, list):
        return rows
    for item in candidates:
        if not isinstance(item, dict):
            continue
        item_type = str(item.get("type") or item.get("contentType") or "page").lower()
        if item_type and item_type != "page":
            continue
        rows.append(item)
    return rows


def build_packet_rows(pages: list[dict[str, Any]], as_of: datetime) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    signals: list[dict[str, Any]] = []
    captain_records: list[dict[str, Any]] = []
    for page in pages:
        title = clean_text(page.get("title") or "Untitled Confluence page")
        text = clean_text(page.get("text") or page.get("excerpt") or page.get("body") or "")
        url = str(page.get("url") or "")
        category, severity, owner_role, next_move = classify_page(title, text)
        signal_key = stable_key(title, url)
        signal = {
            "signal_key": signal_key,
            "source_system": "confluence",
            "title": title,
            "url": url,
            "category": category,
            "severity": severity,
            "status": "monitoring",
            "owner_role": owner_role,
            "next_move": next_move,
            "updated": page_updated(page),
            "created_or_seen": as_of.isoformat().replace("+00:00", "Z"),
            "excerpt": text[:500],
            "evidence": {
                "source_system": "confluence",
                "title": title,
                "url": url,
                "metadata": page.get("metadata") if isinstance(page.get("metadata"), dict) else {},
            },
        }
        signals.append(signal)
        for mention in find_property_mentions(f"{title}\n{text}"):
            captain_records.append(captain_record(signal, mention, as_of))
    signals.sort(key=lambda row: (severity_rank(row["severity"]), row["title"]))
    captain_records.sort(key=lambda row: (row["property_name"], severity_rank(row["severity"]), row["title"]))
    return signals, captain_records


def classify_page(title: str, text: str) -> tuple[str, str, str, str]:
    haystack = f"{title} {text}".lower()
    if any(term in haystack for term in ("entra", "sso", "iam", "login", "access package", "entitlement", "app registration")):
        return (
            "identity_access",
            "high",
            "IT / IAM",
            "Confirm the access owner, approval path, and whether a Jira request or Entra entitlement is the source of truth.",
        )
    if any(term in haystack for term in ("microsoft 365", "copilot", "graph", "teams", "sharepoint", "outlook")):
        return (
            "microsoft_365",
            "medium",
            "IT / Collaboration Systems",
            "Confirm the operating owner and capture the approved integration or support path before automation uses the lane.",
        )
    if any(term in haystack for term in ("proc", "process", "support process", "runbook", "procedure")):
        return (
            "operating_process",
            "medium",
            "Process Owner",
            "Review the process page for current ownership, request type, and evidence needed to close related tickets.",
        )
    if any(term in haystack for term in ("jira", "confluence", "service desk", "service management")):
        return (
            "collaboration_systems",
            "medium",
            "ITSM / Jira Admin",
            "Confirm the request type or project access path and link it to any active operational ticket.",
        )
    return (
        "documentation_watch",
        "low",
        "Documentation Owner",
        "Review for relevance to current Ops Watch lanes and attach source-of-truth context if it informs a Captain action.",
    )


def find_property_mentions(text: str) -> list[PropertyMention]:
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
                score = len(normalized_alias)
                current = matches.get(key)
                if current is None or score > current[2]:
                    matches[key] = (identity, str(alias), score)
    return [PropertyMention(identity, alias) for identity, alias, _score in matches.values()]


def captain_record(signal: dict[str, Any], mention: PropertyMention, as_of: datetime) -> dict[str, Any]:
    identity = mention.identity
    watch_key = f"confluence_{signal['signal_key']}"
    return {
        "property_code": identity.property_code,
        "community_id": identity.community_id,
        "property_name": identity.property_name,
        "source_system": "confluence",
        "signal_key": signal["signal_key"],
        "watch_key": watch_key,
        "title": signal["title"],
        "url": signal["url"],
        "category": signal["category"],
        "severity": signal["severity"],
        "status": "monitoring",
        "updated": signal.get("updated") or as_of.isoformat().replace("+00:00", "Z"),
        "match_source": "text_mention",
        "match_value": mention.alias,
        "owner_role": signal["owner_role"],
        "next_move": signal["next_move"],
        "evidence": signal["evidence"],
    }


def summarize(signals: list[dict[str, Any]], captain_records: list[dict[str, Any]], pages: list[dict[str, Any]]) -> dict[str, Any]:
    properties = {row["property_code"] for row in captain_records if row.get("property_code")}
    return {
        "page_count": len(pages),
        "signal_count": len(signals),
        "captain_record_count": len(captain_records),
        "property_count": len(properties),
        "high_severity_signal_count": len([row for row in signals if row.get("severity") in {"high", "critical"}]),
        "identity_access_signal_count": len([row for row in signals if row.get("category") == "identity_access"]),
    }


def write_markdown(path: Path, packet: dict[str, Any]) -> None:
    summary = packet["summary"]
    lines = [
        "# Confluence Ops Watch Readout",
        "",
        f"Generated: {human_datetime(packet['as_of'])}",
        "",
        "## Summary",
        "",
        f"- Confluence pages reviewed: {summary['page_count']}",
        f"- Source signals produced: {summary['signal_count']}",
        f"- Property Captain records produced: {summary['captain_record_count']}",
        f"- Properties mentioned: {summary['property_count']}",
        f"- High-severity signals: {summary['high_severity_signal_count']}",
        f"- Identity/access signals: {summary['identity_access_signal_count']}",
        "",
        "## Source Signals",
        "",
        "| Severity | Category | Page | Owner Lane | Next Move |",
        "| --- | --- | --- | --- | --- |",
    ]
    for signal in packet["source_signals"]:
        page = f"[{escape_md(signal['title'])}]({signal['url']})" if signal.get("url") else escape_md(signal["title"])
        lines.append(
            f"| {signal['severity']} | {signal['category']} | {page} | {escape_md(signal['owner_role'])} | {escape_md(signal['next_move'])} |"
        )
    if packet["captain_records"]:
        lines.extend(
            [
                "",
                "## Property Mentions",
                "",
                "| Property | Page | Severity | Next Move |",
                "| --- | --- | --- | --- |",
            ]
        )
        for row in packet["captain_records"]:
            page = f"[{escape_md(row['title'])}]({row['url']})" if row.get("url") else escape_md(row["title"])
            lines.append(
                f"| {row['property_code']} {escape_md(row['property_name'])} | {page} | {row['severity']} | {escape_md(row['next_move'])} |"
            )
    lines.extend(
        [
            "",
            "## Guardrails",
            "",
            "- This packet is read-only. It does not edit Confluence, Jira, Captain Runtime, D1, Cloudflare, or PIB.",
            "- Property mentions are advisory routing signals and must resolve through the governed property identity matrix.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def write_signals_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = ["signal_key", "title", "url", "category", "severity", "status", "owner_role", "next_move", "updated"]
    write_csv(path, fields, rows)


def write_captain_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = ["property_code", "property_name", "source_system", "title", "url", "category", "severity", "status", "owner_role", "next_move", "match_value"]
    write_csv(path, fields, rows)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fields})


def page_updated(page: dict[str, Any]) -> str | None:
    metadata = page.get("metadata") if isinstance(page.get("metadata"), dict) else {}
    for key in ("lastModified", "modified-date", "updated", "created"):
        value = page.get(key) or metadata.get(key)
        if value:
            return str(value)
    return None


def clean_text(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\u200c", " ")
    return re.sub(r"\s+", " ", text).strip()


def stable_key(title: str, url: str) -> str:
    digest = hashlib.sha1(f"{title}|{url}".encode("utf-8")).hexdigest()[:12]
    return f"conf_{digest}"


def severity_rank(severity: str) -> int:
    return {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(severity.lower(), 4)


def human_datetime(value: Any) -> str:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.astimezone(DISPLAY_TZ).strftime("%m/%d/%Y %I:%M %p CT").lstrip("0").replace("/0", "/")


def escape_md(value: str) -> str:
    return value.replace("|", "\\|")


if __name__ == "__main__":
    raise SystemExit(main())
