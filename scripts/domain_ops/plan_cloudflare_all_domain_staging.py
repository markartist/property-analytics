#!/usr/bin/env python3
"""Build a Cloudflare staging plan for every GoDaddy-managed domain.

This planner is intentionally broader than the redirect-only import planner:
redirect-only vanity domains get standardized Cloudflare redirect payloads,
while active/service domains get DNS-only source record preservation payloads.
It performs no Cloudflare or GoDaddy mutations.
"""

from __future__ import annotations

import argparse
import csv
import ipaddress
import json
import sqlite3
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from plan_cloudflare_zone_import import (  # noqa: E402
    PLACEHOLDER_A,
    activation_record,
    build_domain_plan as build_redirect_domain_plan,
    connect,
    fqdn_for,
    latest_readiness_matrix,
    load_dns_records,
    load_forwarding,
    normalize_ttl,
    parse_json,
    safe_filename,
)


DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"

SUPPORTED_PRESERVE_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX"}
SKIP_TYPES = {"NS"}
UNSUPPORTED_REVIEW_TYPES = {"CAA", "SRV"}
EMAIL_RECORD_TYPES = {"MX", "SPF"}
EMAIL_CNAME_NAMES = {"calendar", "email", "imap", "mail", "mobilemail", "pop", "smtp"}
TXT_EMAIL_MARKERS = ("v=spf1", "dkim", "dmarc")


@dataclass
class AllDomainPlanRow:
    domain: str
    plan_status: str
    mode: str
    recommended_batch: str
    readiness_status: str
    classification: str
    source_dns_records: int
    planned_activation_dns_records: int
    planned_preserve_dns_records: int
    skipped_records: int
    redirect_rules: int
    forwarding_targets: int
    transfer_protected: int
    dns_http_status: str
    has_email_records: int
    cloudflare_zone_status: str
    delegate_now_recommended: int
    delegation_blockers: str
    review_flags: str
    dns_payload_file: str
    redirect_payload_file: str
    notes: str


@dataclass
class RedirectPlanRow:
    domain: str
    fqdn: str
    forwarding_type: str
    source_url: str
    target_url: str
    target_url_modernized: int
    status_code: int
    cloudflare_expression: str
    preserve_query_string: int
    path_behavior: str
    target_url_expression: str
    redirect_payload_file: str


def read_all_readiness(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def latest_domain_snapshot_date(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT MAX(snapshot_date) AS latest FROM godaddy_domain_snapshots").fetchone()
    if not row or not row["latest"]:
        raise RuntimeError("No GoDaddy domain snapshot is available.")
    return str(row["latest"])


def load_latest_domains(conn: sqlite3.Connection, snapshot_date: str) -> dict[str, sqlite3.Row]:
    return {
        str(row["domain"]).lower(): row
        for row in conn.execute(
            """
            SELECT *
            FROM godaddy_domain_snapshots
            WHERE snapshot_date = ?
            ORDER BY domain
            """,
            (snapshot_date,),
        )
    }


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def write_csv(path: Path, rows: list[Any], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def bool_text_int(value: Any) -> int:
    text = str(value or "").strip().lower()
    return 1 if text in {"1", "true", "yes"} else 0


def dns_status(row: dict[str, str]) -> str:
    return str(row.get("dns_http_status") or "").strip()


def has_email(row: dict[str, str]) -> int:
    fields = ("has_mx", "has_spf", "has_dkim", "has_dmarc")
    return 1 if any(bool_text_int(row.get(field)) for field in fields) else 0


def cloudflare_zone_present(status: str) -> bool:
    return str(status or "").strip() in {"account_inventory_known", "local_snapshot_known"}


def is_domainconnect(record: sqlite3.Row) -> bool:
    return (
        str(record["record_type"] or "").upper() == "CNAME"
        and str(record["record_name"] or "").strip().lower() == "_domainconnect"
    )


def is_email_related_record(record: sqlite3.Row) -> bool:
    record_type = str(record["record_type"] or "").upper()
    record_name = str(record["record_name"] or "").strip().lower()
    record_data = str(record["record_data"] or "").strip().lower()
    if record_type in EMAIL_RECORD_TYPES:
        return True
    if record_type == "CNAME" and record_name in EMAIL_CNAME_NAMES:
        return True
    if record_type == "TXT" and (record_name == "_dmarc" or any(marker in record_data for marker in TXT_EMAIL_MARKERS)):
        return True
    return False


def source_record_groups(domain: str, dns_records: list[sqlite3.Row]) -> dict[str, set[str]]:
    groups: dict[str, set[str]] = defaultdict(set)
    for record in dns_records:
        record_type = str(record["record_type"] or "").upper()
        if record_type in SKIP_TYPES or is_domainconnect(record):
            continue
        if is_email_related_record(record):
            continue
        groups[fqdn_for(domain, str(record["record_name"] or ""))].add(record_type)
    return groups


def preserve_payload(domain: str, record: sqlite3.Row, groups: dict[str, set[str]]) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    record_type = str(record["record_type"] or "").upper()
    name = fqdn_for(domain, str(record["record_name"] or ""))
    content = str(record["record_data"] or "").strip()
    if record_type in SKIP_TYPES:
        return None, "cloudflare_managed_authority_ns"
    if is_domainconnect(record):
        return None, "dropped_godaddy_domainconnect"
    if is_email_related_record(record):
        return None, "dropped_email_record_no_email_use"
    if not content:
        return None, "empty_record_content"
    if record_type == "A" and content.lower() == "parked":
        return None, "invalid_godaddy_parked_a_record"
    if record_type == "MX":
        try:
            ipaddress.ip_address(content)
            return None, "mx_record_content_is_ip_address"
        except ValueError:
            pass
    if record_type in UNSUPPORTED_REVIEW_TYPES:
        return None, f"{record_type.lower()}_record_requires_manual_mapping"
    if record_type not in SUPPORTED_PRESERVE_TYPES:
        return None, "unsupported_record_type"
    if record_type == "CNAME" and content in {"@", domain}:
        content = domain
    if record_type == "CNAME" and len(groups.get(name, set()) - {"CNAME"}) > 0:
        return None, "cname_conflicts_with_other_source_records"
    if record_type != "CNAME" and "CNAME" in groups.get(name, set()):
        return None, "record_conflicts_with_source_cname"
    payload: dict[str, Any] = {
        "type": record_type,
        "name": name,
        "content": content,
        "ttl": normalize_ttl(record["ttl"]),
        "proxied": False,
        "source": "godaddy_dns_snapshot_preserve",
    }
    if record_type == "MX":
        payload["priority"] = int(record["priority"] or 0)
    return payload, None


def empty_redirect_payload(domain: str) -> dict[str, Any]:
    return {
        "domain": domain,
        "mode": "cloudflare_redirect_rules_candidate",
        "mutations_performed": False,
        "rules": [],
    }


def build_preserve_domain_plan(
    readiness_row: dict[str, str],
    dns_records: list[sqlite3.Row],
    forwarding_count: int,
    dns_dir: Path,
    redirect_dir: Path,
) -> tuple[AllDomainPlanRow, list[str]]:
    domain = readiness_row["domain"].lower()
    skipped: list[dict[str, Any]] = []
    preserve_records: list[dict[str, Any]] = []
    review_flags: list[str] = []
    notes: list[str] = []
    groups = source_record_groups(domain, dns_records)

    for record in dns_records:
        raw = parse_json(record["raw_record_json"], {})
        payload, skip_reason = preserve_payload(domain, record, groups)
        if payload:
            preserve_records.append(payload)
        elif skip_reason:
            skipped.append({"reason": skip_reason, "record": raw})
            if skip_reason.endswith("_requires_manual_mapping") or "conflict" in skip_reason or skip_reason == "unsupported_record_type":
                review_flags.append(skip_reason)

    deduped = {json.dumps(item, sort_keys=True): item for item in preserve_records}
    preserve_records = list(deduped.values())

    activation_records: list[dict[str, Any]] = []
    if not preserve_records and forwarding_count == 0 and readiness_row.get("classification") in {"parked_or_defensive"}:
        notes.append("No usable source DNS records were found; zone can be staged but nameserver delegation is not recommended yet.")

    dns_payload = {
        "domain": domain,
        "mode": "dns_preserve_cloudflare_staging",
        "mutations_performed": False,
        "activation_records": activation_records,
        "preserve_records": preserve_records,
        "skipped_source_records": skipped,
        "standardization_policy": {
            "active_dns_shape": "preserve_readable_godaddy_records_dns_only",
            "proxied_by_default": False,
            "unsupported_complex_record_types_require_review": sorted(UNSUPPORTED_REVIEW_TYPES),
            "godaddy_domainconnect_dropped": True,
        },
    }
    redirect_payload = empty_redirect_payload(domain)
    dns_file = dns_dir / f"{safe_filename(domain)}.json"
    redirect_file = redirect_dir / f"{safe_filename(domain)}.json"
    write_json(dns_file, dns_payload)
    write_json(redirect_file, redirect_payload)

    blockers = delegation_blockers(readiness_row, review_flags, preserve_records, redirect_rules=0)
    delegate_now = 1 if not blockers else 0
    if preserve_records:
        notes.append("Readable GoDaddy DNS records are staged as DNS-only Cloudflare records.")
    if has_email(readiness_row):
        notes.append("Email-related DNS is preserved; validate MX/TXT after any delegation.")
    if review_flags:
        notes.append("Manual review is required before delegation because at least one source record could not be safely translated.")

    row = AllDomainPlanRow(
        domain=domain,
        plan_status="planned" if not review_flags else "planned_with_review",
        mode="dns_preserve_cloudflare_staging",
        recommended_batch=readiness_row.get("recommended_batch", ""),
        readiness_status=readiness_row.get("readiness_status", ""),
        classification=readiness_row.get("classification", ""),
        source_dns_records=len(dns_records),
        planned_activation_dns_records=0,
        planned_preserve_dns_records=len(preserve_records),
        skipped_records=len(skipped),
        redirect_rules=0,
        forwarding_targets=forwarding_count,
        transfer_protected=bool_text_int(readiness_row.get("transfer_protected")),
        dns_http_status=dns_status(readiness_row),
        has_email_records=has_email(readiness_row),
        cloudflare_zone_status=readiness_row.get("cloudflare_zone_status", ""),
        delegate_now_recommended=delegate_now,
        delegation_blockers=";".join(blockers),
        review_flags=";".join(sorted(set(review_flags))),
        dns_payload_file=f"dns_payloads/{dns_file.name}",
        redirect_payload_file=f"redirect_payloads/{redirect_file.name}",
        notes=" ".join(notes),
    )
    manual_notes = []
    if row.review_flags or row.delegation_blockers:
        manual_notes.append(f"- `{domain}`: blockers=`{row.delegation_blockers or 'none'}` review=`{row.review_flags or 'none'}`. {row.notes}")
    return row, manual_notes


def delegation_blockers(
    readiness_row: dict[str, str],
    review_flags: list[str],
    preserve_records: list[dict[str, Any]],
    redirect_rules: int,
) -> list[str]:
    blockers: list[str] = []
    if bool_text_int(readiness_row.get("transfer_protected")):
        blockers.append("godaddy_transfer_protected")
    if review_flags:
        blockers.append("manual_dns_record_review")
    if readiness_row.get("classification") != "redirect_only" and dns_status(readiness_row) not in {"200"}:
        blockers.append("godaddy_dns_unreadable")
    if not preserve_records and redirect_rules == 0:
        blockers.append("no_cloudflare_dns_or_redirect_payload")
    return blockers


def convert_redirect_plan(
    readiness_row: dict[str, str],
    dns_records: list[sqlite3.Row],
    forwarding_rows: list[sqlite3.Row],
    dns_dir: Path,
    redirect_dir: Path,
) -> tuple[AllDomainPlanRow, list[RedirectPlanRow], list[str]]:
    base_plan, redirect_rows, manual_notes = build_redirect_domain_plan(
        readiness_row,
        dns_records,
        forwarding_rows,
        dns_dir,
        redirect_dir,
        preserve_nonessential_dns=False,
    )
    dns_payload = json.loads((dns_dir / Path(base_plan.dns_payload_file).name).read_text(encoding="utf-8"))
    redirect_payload = json.loads((redirect_dir / Path(base_plan.redirect_payload_file).name).read_text(encoding="utf-8"))
    blockers = delegation_blockers(
        readiness_row,
        [flag for flag in base_plan.review_flags.split(";") if flag],
        dns_payload.get("preserve_records") or dns_payload.get("activation_records") or [],
        len(redirect_payload.get("rules") or []),
    )
    row = AllDomainPlanRow(
        domain=base_plan.domain,
        plan_status=base_plan.plan_status,
        mode="redirect_only_cloudflare_native",
        recommended_batch=base_plan.recommended_batch,
        readiness_status=base_plan.readiness_status,
        classification=base_plan.classification,
        source_dns_records=base_plan.source_dns_records,
        planned_activation_dns_records=base_plan.planned_activation_dns_records,
        planned_preserve_dns_records=base_plan.planned_preserve_dns_records,
        skipped_records=base_plan.skipped_records,
        redirect_rules=base_plan.redirect_rules,
        forwarding_targets=base_plan.forwarding_targets,
        transfer_protected=bool_text_int(readiness_row.get("transfer_protected")),
        dns_http_status=dns_status(readiness_row),
        has_email_records=has_email(readiness_row),
        cloudflare_zone_status=readiness_row.get("cloudflare_zone_status", ""),
        delegate_now_recommended=1 if not blockers else 0,
        delegation_blockers=";".join(blockers),
        review_flags=base_plan.review_flags,
        dns_payload_file=base_plan.dns_payload_file,
        redirect_payload_file=base_plan.redirect_payload_file,
        notes=base_plan.notes,
    )
    if row.delegation_blockers:
        manual_notes.append(f"- `{row.domain}`: blockers=`{row.delegation_blockers}` review=`{row.review_flags or 'none'}`. {row.notes}")
    return row, [RedirectPlanRow(**asdict(item)) for item in redirect_rows], manual_notes


def human_utc(value: str) -> str:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return value
    return parsed.strftime("%m/%d/%Y %-I:%M %p UTC")


def write_manual_review(path: Path, summary: dict[str, Any], manual_notes: list[str]) -> None:
    lines = [
        "# Cloudflare All-Domain Staging Review",
        "",
        f"- Generated at UTC: {human_utc(summary['generated_at_utc'])}",
        f"- Domains planned: `{summary['domains_planned']}`",
        f"- Delegate-now recommended: `{summary['delegate_now_recommended']}`",
        f"- Mutations performed: `{str(summary['mutations_performed']).lower()}`",
        "",
        "## Review Items",
        "",
    ]
    lines.extend(manual_notes or ["No manual-review flags were emitted for this all-domain plan."])
    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Redirect-only domains use standardized Cloudflare redirect activation DNS and managed redirect rules.",
            "- Active/service domains preserve readable GoDaddy records as DNS-only Cloudflare records.",
            "- GoDaddy authority `NS` records and `_domainconnect` records are intentionally omitted.",
            "- `CAA` and `SRV` records are review-gated because they need provider-specific structured mapping before delegation.",
            "- Delegation recommendations are advisory gates; this packet itself performs no Cloudflare or GoDaddy mutations.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a dry-run all-domain Cloudflare staging packet.")
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--readiness-matrix", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    readiness_path = args.readiness_matrix or latest_readiness_matrix()
    readiness_rows = read_all_readiness(readiness_path)
    if args.limit:
        readiness_rows = readiness_rows[: args.limit]
    if not readiness_rows:
        raise SystemExit(f"No readiness rows found: {readiness_path}")
    snapshot_dates = {row["snapshot_date"] for row in readiness_rows}
    if len(snapshot_dates) != 1:
        raise SystemExit(f"Expected one snapshot date in readiness rows, found {sorted(snapshot_dates)}")
    snapshot_date = snapshot_dates.pop()
    domains = [row["domain"] for row in readiness_rows]

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_cloudflare_all_domain_staging_plan")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    dns_dir = output_dir / "dns_payloads"
    redirect_dir = output_dir / "redirect_payloads"
    dns_dir.mkdir(parents=True, exist_ok=True)
    redirect_dir.mkdir(parents=True, exist_ok=True)

    with connect(args.db_path) as conn:
        domain_snapshot_date = latest_domain_snapshot_date(conn)
        latest_domain_count = len(load_latest_domains(conn, domain_snapshot_date))
        dns_records = load_dns_records(conn, snapshot_date, domains)
        forwarding = load_forwarding(conn, snapshot_date, domains)

    domain_plans: list[AllDomainPlanRow] = []
    redirect_plans: list[RedirectPlanRow] = []
    manual_notes: list[str] = []
    for row in readiness_rows:
        domain = row["domain"].lower()
        forwarding_rows = forwarding.get(domain, [])
        if row.get("classification") == "redirect_only" and forwarding_rows:
            plan, redirects, notes = convert_redirect_plan(row, dns_records.get(domain, []), forwarding_rows, dns_dir, redirect_dir)
            domain_plans.append(plan)
            redirect_plans.extend(redirects)
            manual_notes.extend(notes)
            continue
        plan, notes = build_preserve_domain_plan(
            row,
            dns_records.get(domain, []),
            forwarding_count=len(forwarding_rows),
            dns_dir=dns_dir,
            redirect_dir=redirect_dir,
        )
        domain_plans.append(plan)
        manual_notes.extend(notes)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary = {
        "run_type": "cloudflare_all_domain_staging_plan",
        "generated_at_utc": generated_at,
        "mutations_performed": False,
        "readiness_matrix": str(readiness_path),
        "snapshot_date": snapshot_date,
        "domains_planned": len(domain_plans),
        "godaddy_snapshot_domains": latest_domain_count,
        "already_in_cloudflare_inventory": sum(1 for row in domain_plans if cloudflare_zone_present(row.cloudflare_zone_status)),
        "not_yet_in_cloudflare_inventory": sum(1 for row in domain_plans if not cloudflare_zone_present(row.cloudflare_zone_status)),
        "transfer_protected_domains": sum(row.transfer_protected for row in domain_plans),
        "dns_readable_domains": sum(1 for row in domain_plans if row.dns_http_status == "200"),
        "email_related_domains": sum(row.has_email_records for row in domain_plans),
        "delegate_now_recommended": sum(row.delegate_now_recommended for row in domain_plans),
        "redirect_rules_planned": sum(row.redirect_rules for row in domain_plans),
        "activation_dns_records_planned": sum(row.planned_activation_dns_records for row in domain_plans),
        "preserve_dns_records_planned": sum(row.planned_preserve_dns_records for row in domain_plans),
        "skipped_source_records": sum(row.skipped_records for row in domain_plans),
        "plan_status_counts": dict(Counter(row.plan_status for row in domain_plans)),
        "mode_counts": dict(Counter(row.mode for row in domain_plans)),
        "classification_counts": dict(Counter(row.classification for row in domain_plans)),
        "delegation_blocker_counts": dict(
            Counter(flag for row in domain_plans for flag in row.delegation_blockers.split(";") if flag)
        ),
        "review_flag_counts": dict(Counter(flag for row in domain_plans for flag in row.review_flags.split(";") if flag)),
        "standardization_policy": {
            "redirect_only_domains": "cloudflare_native_redirects_with_path_and_query_passthrough",
            "non_redirect_domains": "preserve_readable_godaddy_records_dns_only",
            "city_state_targets_applied": False,
            "registrar_transfer_started": False,
        },
    }
    write_csv(output_dir / "domain_import_plan.csv", domain_plans, list(AllDomainPlanRow.__annotations__.keys()))
    write_csv(output_dir / "redirect_plan.csv", redirect_plans, list(RedirectPlanRow.__annotations__.keys()))
    write_json(output_dir / "summary.json", summary)
    write_manual_review(output_dir / "manual_review.md", summary, manual_notes)
    print(json.dumps({"output_dir": str(output_dir), **summary}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
