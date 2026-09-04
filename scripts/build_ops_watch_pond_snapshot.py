#!/usr/bin/env python3
"""Build the static Data Pond Ops Watch snapshot from the latest local packet."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACKET_ROOT = ROOT / "reports" / "ops_watch"
DEFAULT_OUTPUT = ROOT / "apps" / "web" / "src" / "lib" / "ops-watch" / "generated-snapshot.ts"
PROPERTY_IDENTITY_MATRIX = ROOT / "config" / "property_identity_matrix.json"
COMMODORE_ROSTER = ROOT / "config" / "commodore_roster.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the Data Pond Ops Watch TypeScript snapshot.")
    parser.add_argument("--packet", type=Path, help="Explicit ops-watch-packet.json path. Defaults to latest packet.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    packet_path = (args.packet or latest_packet(DEFAULT_PACKET_ROOT)).resolve()
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    snapshot = build_snapshot(packet, packet_path)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_typescript(snapshot), encoding="utf-8")
    print(f"Wrote Ops Watch Pond snapshot from {packet_path} to {args.output}")
    return 0


def latest_packet(root: Path) -> Path:
    candidates = sorted(root.glob("ops-watch-*/ops-watch-packet.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not candidates:
        raise SystemExit(f"No ops-watch-packet.json files found under {root}")
    return candidates[0]


def build_snapshot(packet: dict[str, Any], packet_path: Path) -> dict[str, Any]:
    records = [record for record in packet.get("captain_records", []) if isinstance(record, dict)]
    signals = [signal for signal in packet.get("source_signals", []) if isinstance(signal, dict)]
    readiness = [row for row in packet.get("source_readiness", []) if isinstance(row, dict)]
    captain_records = [captain_record(row) for row in records[:36]]
    ticket_care = build_ticket_care(captain_records)
    return {
        "runId": str(packet.get("run_id") or ""),
        "asOf": str(packet.get("as_of") or ""),
        "generatedFrom": str(packet_path.relative_to(ROOT)),
        "readoutPath": str((packet_path.parent / "OPS_WATCH_READOUT.md").relative_to(ROOT)),
        "summary": packet.get("summary") or {},
        "sourceReadiness": [readiness_row(row) for row in readiness],
        "sourceSignals": [source_signal(row) for row in signals[:12]],
        "captainRecords": captain_records,
        "ticketCare": ticket_care,
        "commodoreBridge": build_commodore_bridge(ticket_care, captain_records),
        "sourcePackets": [source_packet_ref(row) for row in packet.get("source_packets", []) if isinstance(row, dict)],
        "governance": {
            "mutationPolicy": str(packet.get("governance", {}).get("mutation_policy") or "read_only_packet_generation"),
            "publishPolicy": str(packet.get("governance", {}).get("publish_policy") or "Captain Runtime writes require separate review/approval"),
            "actionMode": "assisted_action_drafts_only",
        },
    }


def readiness_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceKey": clean(row.get("source_key")),
        "displayName": clean(row.get("display_name")),
        "system": clean(row.get("system")),
        "status": clean(row.get("status")),
        "credentialSource": clean(row.get("credential_source")),
        "harvestMode": clean(row.get("harvest_mode")),
        "captainVisibility": clean(row.get("captain_visibility")),
        "defaultCadence": clean(row.get("default_cadence")),
        "blocker": clean(row.get("blocker")),
        "actionBoundary": clean(row.get("action_boundary")),
    }


def source_signal(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "signalKey": clean(row.get("signal_key")),
        "title": clean(row.get("title")),
        "url": clean(row.get("url")),
        "category": clean(row.get("category")),
        "severity": clean(row.get("severity")),
        "status": clean(row.get("status")),
        "ownerRole": clean(row.get("owner_role")),
        "nextMove": clean(row.get("next_move")),
        "updated": nullable(row.get("updated")),
    }


def captain_record(row: dict[str, Any]) -> dict[str, Any]:
    item_key = row.get("jira_key") or row.get("watch_key") or row.get("signal_key")
    item_url = row.get("jira_url") or row.get("url")
    record = {
        "propertyCode": clean(row.get("property_code")),
        "propertyName": clean(row.get("property_name")),
        "sourceSystem": clean(row.get("source_system")),
        "itemKey": clean(item_key),
        "itemUrl": clean(item_url),
        "title": clean(row.get("watch_title") or row.get("title") or row.get("action_title")),
        "severity": clean(row.get("severity")),
        "priority": clean(row.get("priority")),
        "status": clean(row.get("jira_status") or row.get("watch_status") or row.get("status")),
        "updated": nullable(row.get("updated")),
        "staleDays": row.get("stale_days") if isinstance(row.get("stale_days"), int) else None,
        "category": clean(row.get("category")),
        "ownerRole": clean(row.get("owner_role")),
        "nextMove": clean(row.get("next_move")),
    }
    record["ticketCare"] = ticket_care_for_record(record)
    return record


def ticket_care_for_record(record: dict[str, Any]) -> dict[str, Any]:
    text = " ".join(
        str(record.get(key) or "")
        for key in ("itemKey", "title", "status", "priority", "severity", "category", "ownerRole", "nextMove")
    ).lower()
    flags: list[str] = []
    stale_days = record.get("staleDays") if isinstance(record.get("staleDays"), int) else 0
    status = str(record.get("status") or "").lower()
    priority = str(record.get("priority") or record.get("severity") or "").lower()
    category = str(record.get("category") or "").lower()
    pending_vendor = "pending vendor" in status or category == "vendor_followup"

    if "critical" in priority:
        flags.append("critical")
    if pending_vendor:
        flags.append("pending_vendor")
    if stale_days >= 14:
        flags.append("stale_14_day")
    if stale_days >= 7 and pending_vendor:
        flags.append("vendor_idle")
    if status in {"response", "waiting for customer", "customer response"} or "customer" in text:
        flags.append("customer_waiting")
    if any(term in text for term in ("photo", "picture", "head shot", "headshot", "image", "gallery", "banner", "website", "google number")):
        flags.append("proof_needed")
    if any(term in text for term in ("employee photo", "head shot", "headshot", "cm/mm", "contact section picture")):
        flags.append("employee_photo")
    if any(term in text for term in ("pricing", "concession", "special", "floor plan type")):
        flags.append("routing_check")
    if not flags:
        flags.append("monitor")

    flags = unique(flags)
    label_map = {
        "critical": "Critical",
        "pending_vendor": "Pending vendor",
        "stale_14_day": "Stale 14+ days",
        "vendor_idle": "Vendor idle",
        "customer_waiting": "Customer waiting",
        "proof_needed": "Proof needed",
        "employee_photo": "Employee photo",
        "routing_check": "Routing check",
        "monitor": "Monitor",
    }

    if "customer_waiting" in flags:
        blocker_owner = "WebOps / requester follow-up"
        recommended_action = "Answer the requester, confirm the next step, then keep the ticket visible until the customer or workflow closes cleanly."
    elif "vendor_idle" in flags or "stale_14_day" in flags:
        blocker_owner = "Vendor / owning support lane"
        recommended_action = "Post a concise status inquiry, ask for ETA or blocker, and keep the Captain flag raised until a response or proof arrives."
    elif "pending_vendor" in flags:
        blocker_owner = "Vendor / owning support lane"
        recommended_action = "Monitor vendor progress and prepare the completion proof path before closing."
    elif "proof_needed" in flags:
        blocker_owner = "WebOps proof owner"
        recommended_action = "Verify the live public page, capture proof, post the image-only customer reply, then close with the standard completion comment."
    elif "routing_check" in flags:
        blocker_owner = "WebOps triage"
        recommended_action = "Confirm whether this belongs in WebOps or a separate pricing/content-system request path before taking action."
    else:
        blocker_owner = clean(record.get("ownerRole")) or "WebOps"
        recommended_action = clean(record.get("nextMove")) or "Monitor for the next governed update."

    evidence_needed = ["Current Jira status and latest customer/vendor comment"]
    if "proof_needed" in flags:
        evidence_needed.append("Live public-page screenshot or equivalent visual proof")
    if "routing_check" in flags:
        evidence_needed.append("Correct owner lane and requester expectation")

    return {
        "flags": flags,
        "flagLabels": [label_map.get(flag, flag.replace("_", " ").title()) for flag in flags],
        "blockerOwner": blocker_owner,
        "customerPromise": "Keep the requester informed without promising completion until source proof exists.",
        "evidenceNeeded": evidence_needed,
        "recommendedAction": recommended_action,
        "captainStance": "Champion the property by keeping this ticket visible until the owner, proof, or requester response clears the concern.",
        "urgencyRank": urgency_rank(flags, stale_days),
    }


def build_ticket_care(records: list[dict[str, Any]]) -> dict[str, Any]:
    property_groups: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        code = clean(record.get("propertyCode")) or "UNRESOLVED"
        property_groups.setdefault(code, []).append(record)

    property_queues = []
    for property_code, rows in sorted(property_groups.items(), key=lambda item: (-len(item[1]), item[0])):
        all_flags = [flag for row in rows for flag in row.get("ticketCare", {}).get("flags", [])]
        stale_count = sum(1 for row in rows if isinstance(row.get("staleDays"), int) and row["staleDays"] >= 14)
        pending_vendor_count = all_flags.count("pending_vendor")
        proof_needed_count = all_flags.count("proof_needed")
        customer_waiting_count = all_flags.count("customer_waiting")
        posture = property_posture(rows)
        property_queues.append({
            "propertyCode": property_code,
            "propertyName": clean(rows[0].get("propertyName")),
            "posture": posture,
            "topFlag": top_flag(all_flags),
            "ticketCount": len(rows),
            "staleCount": stale_count,
            "pendingVendorCount": pending_vendor_count,
            "proofNeededCount": proof_needed_count,
            "customerWaitingCount": customer_waiting_count,
            "nextBestAction": property_next_best_action(rows),
            "records": sorted(rows, key=lambda row: row.get("ticketCare", {}).get("urgencyRank", 0), reverse=True),
        })

    summary_flags = [flag for row in records for flag in row.get("ticketCare", {}).get("flags", [])]
    return {
        "summary": {
            "ticketCount": len(records),
            "propertyCount": len(property_groups),
            "criticalCount": summary_flags.count("critical"),
            "pendingVendorCount": summary_flags.count("pending_vendor"),
            "stale14DayCount": summary_flags.count("stale_14_day"),
            "vendorIdleCount": summary_flags.count("vendor_idle"),
            "proofNeededCount": summary_flags.count("proof_needed"),
            "customerWaitingCount": summary_flags.count("customer_waiting"),
            "routingCheckCount": summary_flags.count("routing_check"),
            "employeePhotoCount": summary_flags.count("employee_photo"),
        },
        "propertyQueues": property_queues,
        "patterns": ticket_care_patterns(records),
    }


def build_commodore_bridge(ticket_care: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    region_by_property, active_count_by_region = load_property_region_index()
    roster_by_region, roster_meta = load_commodore_roster()
    rows_by_property = {queue.get("propertyCode"): queue for queue in ticket_care.get("propertyQueues", []) if isinstance(queue, dict)}
    regions: dict[str, dict[str, Any]] = {}

    for region_name, active_count in active_count_by_region.items():
        regions[region_name] = commodore_region_base(region_name, active_count, roster_by_region.get(region_name))
        regions[region_name].update({
            "regionKey": slug(region_name),
            "regionName": region_name,
            "activePropertyCount": active_count,
            "signaledPropertyCount": 0,
            "activeTicketCount": 0,
            "criticalCount": 0,
            "stale14DayCount": 0,
            "pendingVendorCount": 0,
            "proofNeededCount": 0,
            "customerWaitingCount": 0,
            "attentionPropertyCount": 0,
            "posture": "pass",
            "topPattern": "monitor",
            "nextBestAction": "No mapped Ops Watch ticket pressure is visible for this region.",
            "properties": [],
        })

    for property_code, queue in rows_by_property.items():
        code = clean(property_code) or "UNRESOLVED"
        region_name = region_by_property.get(code) or "Unresolved Region"
        if region_name not in regions:
            regions[region_name] = commodore_region_base(region_name, active_count_by_region.get(region_name, 0), roster_by_region.get(region_name))
            regions[region_name].update({
                "regionKey": slug(region_name),
                "regionName": region_name,
                "activePropertyCount": active_count_by_region.get(region_name, 0),
                "signaledPropertyCount": 0,
                "activeTicketCount": 0,
                "criticalCount": 0,
                "stale14DayCount": 0,
                "pendingVendorCount": 0,
                "proofNeededCount": 0,
                "customerWaitingCount": 0,
                "attentionPropertyCount": 0,
                "posture": "pass",
                "topPattern": "monitor",
                "nextBestAction": "Resolve property identity before regional ownership is assigned.",
                "properties": [],
            })

        region = regions[region_name]
        records_for_property = queue.get("records") if isinstance(queue.get("records"), list) else []
        critical_count = sum(1 for row in records_for_property if clean(row.get("severity")).lower() == "critical")
        signal = {
            "propertyCode": code,
            "propertyName": clean(queue.get("propertyName")),
            "regionName": region_name,
            "captainHref": f"/captains/{code}",
            "posture": clean(queue.get("posture")),
            "topFlag": clean(queue.get("topFlag")),
            "ticketCount": int(queue.get("ticketCount") or 0),
            "criticalCount": critical_count,
            "stale14DayCount": int(queue.get("staleCount") or 0),
            "pendingVendorCount": int(queue.get("pendingVendorCount") or 0),
            "proofNeededCount": int(queue.get("proofNeededCount") or 0),
            "customerWaitingCount": int(queue.get("customerWaitingCount") or 0),
            "nextBestAction": clean(queue.get("nextBestAction")),
            "records": records_for_property,
        }
        region["properties"].append(signal)
        region["signaledPropertyCount"] += 1
        region["activeTicketCount"] += signal["ticketCount"]
        region["criticalCount"] += signal["criticalCount"]
        region["stale14DayCount"] += signal["stale14DayCount"]
        region["pendingVendorCount"] += signal["pendingVendorCount"]
        region["proofNeededCount"] += signal["proofNeededCount"]
        region["customerWaitingCount"] += signal["customerWaitingCount"]
        if signal["posture"] in {"blocked", "warn"}:
            region["attentionPropertyCount"] += 1

    for region in regions.values():
        region["properties"] = sorted(
            region["properties"],
            key=lambda row: (
                posture_weight(clean(row.get("posture"))),
                int(row.get("stale14DayCount") or 0),
                int(row.get("criticalCount") or 0),
                int(row.get("ticketCount") or 0),
            ),
            reverse=True,
        )
        region["posture"] = commodore_region_posture(region)
        region["topPattern"] = commodore_region_top_pattern(region)
        region["nextBestAction"] = commodore_region_next_best_action(region)

    sorted_regions = sorted(
        regions.values(),
        key=lambda region: (
            posture_weight(clean(region.get("posture"))),
            int(region.get("stale14DayCount") or 0),
            int(region.get("criticalCount") or 0),
            int(region.get("activeTicketCount") or 0),
            clean(region.get("regionName")),
        ),
        reverse=True,
    )
    patterns = commodore_patterns(records, region_by_property)
    escalations = commodore_escalations(sorted_regions)

    summary = ticket_care.get("summary", {}) if isinstance(ticket_care.get("summary"), dict) else {}
    return {
        "summary": {
            "regionCount": len(sorted_regions),
            "activePropertyCount": sum(active_count_by_region.values()),
            "signaledPropertyCount": int(summary.get("propertyCount") or 0),
            "activeTicketCount": int(summary.get("ticketCount") or 0),
            "criticalCount": int(summary.get("criticalCount") or 0),
            "stale14DayCount": int(summary.get("stale14DayCount") or 0),
            "pendingVendorCount": int(summary.get("pendingVendorCount") or 0),
            "proofNeededCount": int(summary.get("proofNeededCount") or 0),
            "customerWaitingCount": int(summary.get("customerWaitingCount") or 0),
            "escalationCount": len(escalations),
            "crossRegionPatternCount": sum(1 for pattern in patterns if pattern["regionCount"] > 1),
            "activeCommodoreCount": sum(1 for region in sorted_regions if clean(region.get("activationStatus")) == "active"),
        },
        "regions": sorted_regions,
        "patterns": patterns,
        "escalations": escalations,
        "roster": {
            "version": clean(roster_meta.get("version")),
            "authority": clean(roster_meta.get("authority")),
            "status": clean(roster_meta.get("status")),
            "cadence": clean(roster_meta.get("cadence")),
        },
        "operatingModel": {
            "role": "Commodore",
            "owns": "Regional pattern validation, shared lessons, outlier detection, and escalation packaging.",
            "boundary": "Commodores do not overwrite Data Pond truth, mutate Jira, or replace Captain property ownership.",
            "actionMode": "Read-only regional intelligence with approval-gated escalation drafts.",
        },
    }


def load_commodore_roster() -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    fallback_meta = {
        "version": "generated-fallback",
        "authority": "config/property_identity_matrix.json",
        "status": "fallback",
        "cadence": "review_after_each_ops_watch_packet",
    }
    if not COMMODORE_ROSTER.exists():
        return {}, fallback_meta
    roster = json.loads(COMMODORE_ROSTER.read_text(encoding="utf-8"))
    if not isinstance(roster, dict):
        return {}, fallback_meta
    defaults = roster.get("defaults") if isinstance(roster.get("defaults"), dict) else {}
    regions = roster.get("regions") if isinstance(roster.get("regions"), list) else []
    roster_by_region: dict[str, dict[str, Any]] = {}
    for row in regions:
        if not isinstance(row, dict):
            continue
        region_name = clean(row.get("regionName"))
        if not region_name:
            continue
        merged = dict(defaults)
        merged.update(row)
        roster_by_region[region_name] = merged
    meta = {
        "version": clean(roster.get("version") or fallback_meta["version"]),
        "authority": clean(roster.get("authority") or fallback_meta["authority"]),
        "status": clean(roster.get("status") or fallback_meta["status"]),
        "cadence": clean(defaults.get("cadence") or fallback_meta["cadence"]),
    }
    return roster_by_region, meta


def commodore_region_base(region_name: str, active_count: int, roster_row: dict[str, Any] | None) -> dict[str, Any]:
    row = roster_row or {}
    name = clean(row.get("commodoreName")) or f"Commodore {region_name}"
    key = clean(row.get("commodoreKey")) or f"commodore-{slug(region_name)}"
    orders = row.get("standingOrders") if isinstance(row.get("standingOrders"), list) else []
    return {
        "commodoreKey": key,
        "commodoreName": name,
        "commodoreCallSign": clean(row.get("callSign")) or region_name,
        "activationStatus": clean(row.get("activationStatus")) or "active",
        "ordersStatus": clean(row.get("ordersStatus")) or "standing_orders_active",
        "cadence": clean(row.get("cadence")) or "review_after_each_ops_watch_packet",
        "humanOwner": clean(row.get("humanOwner")) or None,
        "standingOrders": [clean(order) for order in orders if clean(order)],
        "activePropertyCount": active_count,
    }


def load_property_region_index() -> tuple[dict[str, str], dict[str, int]]:
    if not PROPERTY_IDENTITY_MATRIX.exists():
        return {}, {}
    matrix = json.loads(PROPERTY_IDENTITY_MATRIX.read_text(encoding="utf-8"))
    properties = matrix.get("properties") if isinstance(matrix, dict) else []
    region_by_property: dict[str, str] = {}
    active_count_by_region: dict[str, int] = {}
    for row in properties:
        if not isinstance(row, dict):
            continue
        if clean(row.get("status")).lower() not in {"", "active"}:
            continue
        code = clean(row.get("property_code") or row.get("canonical_property_id") or row.get("display_property_id"))
        if not code:
            continue
        data_warehouse = row.get("data_warehouse_property_bv") if isinstance(row.get("data_warehouse_property_bv"), dict) else {}
        region = clean(row.get("encasa_region") or data_warehouse.get("region_desc") or row.get("state") or "Unassigned Region")
        region_by_property[code] = region
        active_count_by_region[region] = active_count_by_region.get(region, 0) + 1
    return region_by_property, active_count_by_region


def commodore_patterns(records: list[dict[str, Any]], region_by_property: dict[str, str]) -> list[dict[str, Any]]:
    pattern_defs = [
        ("employee_photo", "Employee photo / people-image updates", "high", "Commodore Review", "Bundle production proof expectations and share the proof-closeout SOP with affected Captains."),
        ("pending_vendor", "Vendor-owned ticket pressure", "high", "Commodore Watch", "Ask the owning lane for ETA/blocker patterns and escalate repeated idle ownership if it persists."),
        ("stale_14_day", "Aging unresolved ticket pressure", "critical", "Admiral Read candidate", "Package stale items by owner and request a decision or unblocker path."),
        ("proof_needed", "Visible-site proof required", "medium", "Fleet Scribe / Captain SOP", "Keep proof requirements explicit before any customer-facing closeout."),
        ("routing_check", "Routing-sensitive requests", "medium", "Commodore Review", "Confirm correct ownership lane before Captains spend cycles on the wrong action path."),
        ("customer_waiting", "Customer response owed", "critical", "Admiral Read candidate", "Make requester response the immediate next action and keep the Captain flag raised until answered."),
    ]
    patterns = []
    for flag, title, severity, escalation_path, recommended_action in pattern_defs:
        rows = [row for row in records if flag in row.get("ticketCare", {}).get("flags", [])]
        if not rows:
            continue
        regions = sorted({region_by_property.get(clean(row.get("propertyCode")), "Unresolved Region") for row in rows})
        properties = sorted({clean(row.get("propertyCode")) for row in rows if clean(row.get("propertyCode"))})
        patterns.append({
            "patternKey": flag,
            "title": title,
            "recordCount": len(rows),
            "propertyCount": len(properties),
            "regionCount": len(regions),
            "severity": severity,
            "escalationPath": escalation_path,
            "recommendedAction": recommended_action,
            "affectedRegions": regions,
        })
    return sorted(patterns, key=lambda row: (severity_weight(row["severity"]), row["regionCount"], row["recordCount"]), reverse=True)


def commodore_escalations(regions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    escalations = []
    for region in regions:
        if int(region.get("customerWaitingCount") or 0) > 0:
            title = "Customer response is owed"
            severity = "critical"
            path = "Admiral Read candidate"
            action = "Verify the exact requester response needed and prepare a concise response path for the affected Captain."
        elif int(region.get("stale14DayCount") or 0) > 0:
            title = "Stale ticket pressure needs owner review"
            severity = "critical"
            path = "Commodore escalation"
            action = "Package stale tickets by owner, ask for ETA or blocker, and escalate if ownership is unclear."
        elif int(region.get("criticalCount") or 0) >= 2:
            title = "Critical ticket cluster"
            severity = "high"
            path = "Commodore Review"
            action = "Review whether this is a repeated operational pattern before sending it higher."
        elif int(region.get("pendingVendorCount") or 0) >= 2:
            title = "Vendor queue pressure"
            severity = "medium"
            path = "Commodore Watch"
            action = "Monitor vendor response timing and prepare a shared follow-up if the region stalls."
        else:
            continue

        properties = region.get("properties") if isinstance(region.get("properties"), list) else []
        escalations.append({
            "escalationKey": f"{region.get('regionKey')}-{slug(title)}",
            "title": title,
            "regionName": clean(region.get("regionName")),
            "severity": severity,
            "escalationPath": path,
            "affectedPropertyCount": len(properties),
            "recommendedAction": action,
            "captainHrefs": [clean(row.get("captainHref")) for row in properties[:6] if clean(row.get("captainHref"))],
        })
    return sorted(escalations, key=lambda row: severity_weight(row["severity"]), reverse=True)


def commodore_region_posture(region: dict[str, Any]) -> str:
    if int(region.get("customerWaitingCount") or 0) > 0 or int(region.get("stale14DayCount") or 0) > 0:
        return "blocked"
    if int(region.get("criticalCount") or 0) > 0 or int(region.get("pendingVendorCount") or 0) > 0 or int(region.get("proofNeededCount") or 0) > 0:
        return "warn"
    return "pass"


def commodore_region_top_pattern(region: dict[str, Any]) -> str:
    candidates = [
        ("customer_waiting", int(region.get("customerWaitingCount") or 0)),
        ("stale_14_day", int(region.get("stale14DayCount") or 0)),
        ("pending_vendor", int(region.get("pendingVendorCount") or 0)),
        ("proof_needed", int(region.get("proofNeededCount") or 0)),
        ("critical", int(region.get("criticalCount") or 0)),
    ]
    return next((key for key, count in candidates if count > 0), "monitor")


def commodore_region_next_best_action(region: dict[str, Any]) -> str:
    top_property = (region.get("properties") or [None])[0]
    if isinstance(top_property, dict) and clean(top_property.get("nextBestAction")):
        return f"Start with {clean(top_property.get('propertyCode'))}: {clean(top_property.get('nextBestAction'))}"
    if int(region.get("activeTicketCount") or 0) > 0:
        return "Review the signaled properties, confirm owner lane, and package only decision-ready escalations."
    return "No mapped Ops Watch ticket pressure is visible for this region."


def posture_weight(posture: str) -> int:
    return {"blocked": 3, "warn": 2, "pass": 1}.get(posture, 0)


def severity_weight(severity: str) -> int:
    return {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(severity, 0)


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-")
    return cleaned or "unassigned"


def property_posture(records: list[dict[str, Any]]) -> str:
    flags = {flag for row in records for flag in row.get("ticketCare", {}).get("flags", [])}
    if "stale_14_day" in flags or "customer_waiting" in flags or "vendor_idle" in flags:
        return "blocked"
    if "critical" in flags or "pending_vendor" in flags or "proof_needed" in flags:
        return "warn"
    return "pass"


def property_next_best_action(records: list[dict[str, Any]]) -> str:
    rows = sorted(records, key=lambda row: row.get("ticketCare", {}).get("urgencyRank", 0), reverse=True)
    if not rows:
        return "No open Jira ticket needs Captain attention."
    top = rows[0]
    key = clean(top.get("itemKey"))
    action = clean(top.get("ticketCare", {}).get("recommendedAction"))
    return f"{key}: {action}" if key else action


def ticket_care_patterns(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pattern_defs = [
        ("employee_photo", "Employee photo updates", "Bundle related photo tickets, watch the production image move, and close only after visual proof is attached."),
        ("pending_vendor", "Pending vendor follow-up", "Use concise status inquiries and keep Captains aware until the owning lane responds."),
        ("stale_14_day", "Stale tickets", "Escalate or re-check owner status before letting property concerns age silently."),
        ("proof_needed", "Proof-based closeout", "Follow the image-only reply plus closure-comment SOP for visible website changes."),
        ("routing_check", "Routing checks", "Confirm whether the ticket belongs in WebOps or a pricing/content-system lane."),
    ]
    patterns = []
    for flag, title, recommended_action in pattern_defs:
        rows = [row for row in records if flag in row.get("ticketCare", {}).get("flags", [])]
        if not rows:
            continue
        property_codes = sorted({clean(row.get("propertyCode")) for row in rows if clean(row.get("propertyCode"))})
        patterns.append({
            "patternKey": flag,
            "title": title,
            "recordCount": len(rows),
            "propertyCount": len(property_codes),
            "recommendedAction": recommended_action,
        })
    return patterns


def top_flag(flags: list[str]) -> str:
    priority = ["customer_waiting", "stale_14_day", "vendor_idle", "critical", "pending_vendor", "proof_needed", "routing_check", "employee_photo", "monitor"]
    flag_set = set(flags)
    return next((flag for flag in priority if flag in flag_set), "monitor")


def urgency_rank(flags: list[str], stale_days: int) -> int:
    weight = 0
    weights = {
        "customer_waiting": 70,
        "stale_14_day": 60,
        "vendor_idle": 55,
        "critical": 50,
        "pending_vendor": 35,
        "proof_needed": 30,
        "routing_check": 20,
        "employee_photo": 15,
    }
    for flag in flags:
        weight += weights.get(flag, 0)
    return weight + min(stale_days, 30)


def unique(values: list[str]) -> list[str]:
    seen = set()
    output = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def source_packet_ref(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceSystem": clean(row.get("source_system")),
        "runId": clean(row.get("run_id")),
        "asOf": nullable(row.get("as_of")),
        "summary": row.get("summary") if isinstance(row.get("summary"), dict) else {},
    }


def clean(value: Any) -> str:
    return str(value or "")


def nullable(value: Any) -> str | None:
    return str(value) if value else None


def render_typescript(snapshot: dict[str, Any]) -> str:
    payload = json.dumps(snapshot, indent=2, sort_keys=True)
    return (
        "import type { OpsWatchSnapshot } from \"./types\";\n\n"
        "// Generated by scripts/build_ops_watch_pond_snapshot.py. Do not edit by hand.\n"
        f"export const OPS_WATCH_SNAPSHOT: OpsWatchSnapshot = {payload};\n"
    )


if __name__ == "__main__":
    raise SystemExit(main())
