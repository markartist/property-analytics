#!/usr/bin/env python3
"""Build dry-run Cloudflare DNS/redirect import plans.

This planner consumes the Domain Ops readiness matrix plus GoDaddy DNS and
forwarding snapshots. It writes proposed Cloudflare DNS payloads and redirect
rule candidates only; it does not call GoDaddy or Cloudflare mutating APIs.
"""

from __future__ import annotations

import argparse
import csv
import ipaddress
import json
import re
import sqlite3
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"
CLOUDFLARE_REDIRECT_DOC = "https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/"

GODADDY_FORWARDING_A_VALUES = {"3.33.251.168", "15.197.225.128"}
PLACEHOLDER_A = "192.0.2.1"
SUPPORTED_PRESERVE_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX"}
REVIEW_TYPES = {"CAA", "SRV"}
EMAIL_RECORD_TYPES = {"MX", "SPF"}
EMAIL_CNAME_NAMES = {"calendar", "email", "imap", "mail", "mobilemail", "pop", "smtp"}
TXT_EMAIL_MARKERS = ("v=spf1", "dkim", "dmarc")


@dataclass
class DomainPlanRow:
    domain: str
    plan_status: str
    recommended_batch: str
    readiness_status: str
    classification: str
    source_dns_records: int
    planned_activation_dns_records: int
    planned_preserve_dns_records: int
    skipped_records: int
    redirect_rules: int
    forwarding_targets: int
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


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def latest_readiness_matrix() -> Path:
    candidates = sorted(DEFAULT_REPORT_ROOT.glob("*_cloudflare_dns_migration_readiness/readiness_matrix.csv"))
    if not candidates:
        raise SystemExit("No readiness matrix found under reports/domain_ops.")
    return candidates[-1]


def read_readiness(path: Path, batch: str, limit: Optional[int]) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if row.get("recommended_batch") == batch
        ]
    if limit:
        rows = rows[:limit]
    return rows


def load_dns_records(conn: sqlite3.Connection, snapshot_date: str, domains: list[str]) -> dict[str, list[sqlite3.Row]]:
    if not domains:
        return {}
    placeholders = ",".join("?" for _ in domains)
    records: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in conn.execute(
        f"""
        SELECT *
        FROM godaddy_dns_records
        WHERE snapshot_date = ?
          AND domain IN ({placeholders})
        ORDER BY domain, record_type, record_name, record_data
        """,
        [snapshot_date, *domains],
    ):
        records[str(row["domain"])].append(row)
    return records


def latest_forwarding_date(conn: sqlite3.Connection, snapshot_date: str) -> Optional[str]:
    row = conn.execute(
        """
        SELECT MAX(snapshot_date) AS latest
        FROM godaddy_forwarding_snapshots
        WHERE snapshot_date <= ?
        """,
        (snapshot_date,),
    ).fetchone()
    return str(row["latest"]) if row and row["latest"] else None


def load_forwarding(conn: sqlite3.Connection, snapshot_date: str, domains: list[str]) -> dict[str, list[sqlite3.Row]]:
    forwarding_date = latest_forwarding_date(conn, snapshot_date)
    if not forwarding_date or not domains:
        return {}
    placeholders = ",".join("?" for _ in domains)
    output: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in conn.execute(
        f"""
        SELECT *
        FROM godaddy_forwarding_snapshots
        WHERE snapshot_date = ?
          AND requested_domain IN ({placeholders})
          AND forwarding_count > 0
        ORDER BY requested_domain, fqdn, forwarding_url
        """,
        [forwarding_date, *domains],
    ):
        output[str(row["requested_domain"])].append(row)
    return output


def parse_json(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def safe_filename(domain: str) -> str:
    return re.sub(r"[^a-zA-Z0-9.-]+", "_", domain)


def fqdn_for(domain: str, record_name: str) -> str:
    name = (record_name or "").strip().lower()
    if name in {"", "@"}:
        return domain
    if name.endswith(f".{domain}") or name == domain:
        return name.rstrip(".")
    return f"{name}.{domain}".rstrip(".")


def normalize_ttl(ttl: Any) -> int:
    try:
        value = int(ttl)
    except (TypeError, ValueError):
        return 1
    if value <= 1:
        return 1
    return max(value, 60)


def is_forwarding_a_record(record: sqlite3.Row) -> bool:
    if str(record["record_type"] or "").upper() != "A":
        return False
    return str(record["record_data"] or "").strip() in GODADDY_FORWARDING_A_VALUES


def should_skip_authority_ns(record: sqlite3.Row) -> bool:
    return str(record["record_type"] or "").upper() == "NS"


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


def preserve_record_payload(domain: str, record: sqlite3.Row) -> Optional[dict[str, Any]]:
    record_type = str(record["record_type"] or "").upper()
    name = fqdn_for(domain, str(record["record_name"] or ""))
    content = str(record["record_data"] or "").strip()
    if not content:
        return None
    if record_type not in SUPPORTED_PRESERVE_TYPES:
        return None
    if record_type == "A" and content.lower() == "parked":
        return None
    if record_type == "MX":
        try:
            ipaddress.ip_address(content)
            return None
        except ValueError:
            pass
    if record_type == "CNAME" and content in {"@", domain}:
        content = domain
    payload: dict[str, Any] = {
        "type": record_type,
        "name": name,
        "content": content,
        "ttl": normalize_ttl(record["ttl"]),
        "proxied": False,
        "source": "godaddy_dns_snapshot_preserve",
    }
    if record_type == "MX" and record["priority"] is not None:
        payload["priority"] = int(record["priority"])
    return payload


def activation_record(name: str) -> dict[str, Any]:
    return {
        "type": "A",
        "name": name,
        "content": PLACEHOLDER_A,
        "ttl": 1,
        "proxied": True,
        "source": "cloudflare_redirect_activation_placeholder",
        "source_reference": CLOUDFLARE_REDIRECT_DOC,
    }


def status_code_for(forwarding_type: str) -> int:
    return 302 if forwarding_type == "TEMPORARY_REDIRECT" else 301


def modernize_target_url(target: str) -> tuple[str, bool]:
    parsed = urlsplit(target.strip())
    if parsed.scheme.lower() != "http":
        return target.strip(), False
    modernized = parsed._replace(scheme="https")
    return urlunsplit(modernized), True


def dynamic_target_base(target: str) -> str:
    parsed = urlsplit(target.strip())
    base_path = parsed.path.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, base_path, "", ""))


def ruleset_string_literal(value: str) -> str:
    return json.dumps(value)


def passthrough_target_expression(target: str) -> str:
    return f"concat({ruleset_string_literal(dynamic_target_base(target))}, http.request.uri.path)"


def redirect_rule_payload(row: sqlite3.Row) -> dict[str, Any]:
    fqdn = str(row["fqdn"] or row["requested_domain"]).strip().lower()
    original_target = str(row["forwarding_url"] or "").strip()
    target, modernized = modernize_target_url(original_target)
    code = status_code_for(str(row["forwarding_type"] or ""))
    target_expression = passthrough_target_expression(target)
    return {
        "description": f"Redirect {fqdn} to {target}",
        "expression": f'(http.host eq "{fqdn}")',
        "action": "redirect",
        "action_parameters": {
            "from_value": {
                "status_code": code,
                "target_url": {"expression": target_expression},
                "preserve_query_string": True,
            }
        },
        "source": "godaddy_forwarding_snapshot",
        "source_target_url": original_target,
        "target_url": target,
        "target_url_modernized": modernized,
        "path_behavior": "source_path_passthrough_to_modernized_base_target",
    }


def redirect_rule_payload_for_alias(fqdn: str, target: str, status_code: int = 301) -> dict[str, Any]:
    modernized_target, modernized = modernize_target_url(target)
    target_expression = passthrough_target_expression(modernized_target)
    return {
        "description": f"Redirect {fqdn} to {modernized_target}",
        "expression": f'(http.host eq "{fqdn}")',
        "action": "redirect",
        "action_parameters": {
            "from_value": {
                "status_code": status_code,
                "target_url": {"expression": target_expression},
                "preserve_query_string": True,
            }
        },
        "source": "derived_alias_from_source_dns",
        "source_target_url": target,
        "target_url": modernized_target,
        "target_url_modernized": modernized,
        "path_behavior": "source_path_passthrough_to_modernized_base_target",
    }


def build_domain_plan(
    readiness_row: dict[str, str],
    dns_records: list[sqlite3.Row],
    forwarding_rows: list[sqlite3.Row],
    dns_dir: Path,
    redirect_dir: Path,
    *,
    preserve_nonessential_dns: bool = False,
) -> tuple[DomainPlanRow, list[RedirectPlanRow], list[str]]:
    domain = readiness_row["domain"]
    review_flags: list[str] = []
    notes: list[str] = []
    skipped: list[dict[str, Any]] = []
    activation_records: list[dict[str, Any]] = []
    preserve_records: list[dict[str, Any]] = []
    redirect_rules: list[dict[str, Any]] = []
    redirect_rows: list[RedirectPlanRow] = []

    forwarding_fqdns = sorted(
        {
            str(row["fqdn"] or row["requested_domain"]).strip().lower()
            for row in forwarding_rows
            if row["forwarding_url"]
        }
    )
    source_names = {
        fqdn_for(domain, str(record["record_name"] or ""))
        for record in dns_records
    }
    activation_names = sorted(set(forwarding_fqdns) | {name for name in source_names if name in {domain, f"www.{domain}"}})
    for name in activation_names:
        activation_records.append(activation_record(name))

    for record in dns_records:
        record_type = str(record["record_type"] or "").upper()
        record_fqdn = fqdn_for(domain, str(record["record_name"] or ""))
        raw = parse_json(record["raw_record_json"], {})
        if should_skip_authority_ns(record):
            skipped.append({"reason": "cloudflare_managed_authority_ns", "record": raw})
            continue
        if is_email_related_record(record):
            skipped.append({"reason": "dropped_email_record_no_email_use", "record": raw})
            continue
        if is_forwarding_a_record(record):
            skipped.append({"reason": "replaced_by_cloudflare_redirect_placeholder", "record": raw})
            continue
        if record_fqdn in activation_names and record_type in {"A", "AAAA", "CNAME"}:
            skipped.append({"reason": "replaced_by_cloudflare_redirect_placeholder", "record": raw})
            continue
        if record_type == "CNAME" and str(record["record_name"] or "").lower() == "_domainconnect":
            skipped.append({"reason": "dropped_godaddy_domainconnect_standardized_redirect_dns", "record": raw})
            continue
        if record_type in REVIEW_TYPES:
            skipped.append({"reason": "record_type_requires_manual_mapping", "record": raw})
            review_flags.append(f"{record_type.lower()}_record_review")
            continue
        if not preserve_nonessential_dns:
            skipped.append({"reason": "dropped_nonessential_record_standardized_redirect_dns", "record": raw})
            continue
        payload = preserve_record_payload(domain, record)
        if payload:
            preserve_records.append(payload)
        else:
            skipped.append({"reason": "unsupported_or_empty_record", "record": raw})
            review_flags.append("unsupported_record_review")

    for row in forwarding_rows:
        if not row["forwarding_url"]:
            continue
        payload = redirect_rule_payload(row)
        redirect_rules.append(payload)
        redirect_rows.append(
            RedirectPlanRow(
                domain=domain,
                fqdn=str(row["fqdn"] or row["requested_domain"]).strip().lower(),
                forwarding_type=str(row["forwarding_type"] or ""),
                source_url=str(row["forwarding_url"] or ""),
                target_url=payload["target_url"],
                target_url_modernized=1 if payload["target_url_modernized"] else 0,
                status_code=payload["action_parameters"]["from_value"]["status_code"],
                cloudflare_expression=payload["expression"],
                preserve_query_string=1,
                path_behavior=payload["path_behavior"],
                target_url_expression=payload["action_parameters"]["from_value"]["target_url"]["expression"],
                redirect_payload_file=f"redirect_payloads/{safe_filename(domain)}.json",
            )
        )

    explicit_redirect_hosts = {
        str(row["fqdn"] or row["requested_domain"]).strip().lower()
        for row in forwarding_rows
        if row["forwarding_url"]
    }
    unique_targets = {str(row["forwarding_url"] or "").strip() for row in forwarding_rows if row["forwarding_url"]}
    unique_status_codes = {
        status_code_for(str(row["forwarding_type"] or ""))
        for row in forwarding_rows
        if row["forwarding_url"]
    }
    if len(unique_targets) == 1:
        target = next(iter(unique_targets))
        status_code = next(iter(unique_status_codes)) if len(unique_status_codes) == 1 else 301
        for alias_host in activation_names:
            if alias_host in explicit_redirect_hosts:
                continue
            payload = redirect_rule_payload_for_alias(alias_host, target, status_code)
            redirect_rules.append(payload)
            redirect_rows.append(
                RedirectPlanRow(
                    domain=domain,
                    fqdn=alias_host,
                    forwarding_type="DERIVED_ALIAS",
                    source_url=target,
                    target_url=payload["target_url"],
                    target_url_modernized=1 if payload["target_url_modernized"] else 0,
                    status_code=status_code,
                    cloudflare_expression=payload["expression"],
                    preserve_query_string=1,
                    path_behavior=payload["path_behavior"],
                    target_url_expression=payload["action_parameters"]["from_value"]["target_url"]["expression"],
                    redirect_payload_file=f"redirect_payloads/{safe_filename(domain)}.json",
                )
            )

    if not redirect_rules:
        review_flags.append("missing_forwarding_rule")
        notes.append("No forwarding rows were available for this redirect-only domain.")
    modernized_target_count = sum(
        1
        for row in forwarding_rows
        if modernize_target_url(str(row["forwarding_url"] or ""))[1]
    )
    if modernized_target_count:
        notes.append(f"{modernized_target_count} source target(s) modernized from http:// to https:// in proposed redirect payloads.")
    if preserve_records:
        notes.append("Non-forwarding DNS records are preserved as DNS-only payloads.")
    elif not preserve_nonessential_dns:
        notes.append("DNS standardized for redirect-only use; nonessential source records intentionally dropped from proposed payload.")
    notes.append("Redirect rules preserve source paths and query strings.")

    dedup_key = lambda item: json.dumps(item, sort_keys=True)
    activation_records = list({dedup_key(item): item for item in activation_records}.values())
    preserve_records = list({dedup_key(item): item for item in preserve_records}.values())
    redirect_rules = list({dedup_key(item): item for item in redirect_rules}.values())

    dns_payload = {
        "domain": domain,
        "mode": "redirect_only_cloudflare_native",
        "mutations_performed": False,
        "activation_records": activation_records,
        "preserve_records": preserve_records,
        "skipped_source_records": skipped,
        "standardization_policy": {
            "redirect_only_dns_shape": "apex_and_www_proxied_A_192.0.2.1",
            "nonessential_source_dns_preserved": preserve_nonessential_dns,
            "query_string_preserved_by_redirect_rules": True,
            "path_passthrough": "enabled_base_target_plus_source_path",
            "http_targets_modernized_to_https": True,
        },
    }
    redirect_payload = {
        "domain": domain,
        "mode": "cloudflare_redirect_rules_candidate",
        "mutations_performed": False,
        "rules": redirect_rules,
    }
    dns_file = dns_dir / f"{safe_filename(domain)}.json"
    redirect_file = redirect_dir / f"{safe_filename(domain)}.json"
    dns_file.write_text(json.dumps(dns_payload, indent=2, sort_keys=True), encoding="utf-8")
    redirect_file.write_text(json.dumps(redirect_payload, indent=2, sort_keys=True), encoding="utf-8")

    plan_status = "planned" if redirect_rules and not any(flag.endswith("_review") for flag in review_flags) else "planned_with_review"
    plan_row = DomainPlanRow(
        domain=domain,
        plan_status=plan_status,
        recommended_batch=readiness_row["recommended_batch"],
        readiness_status=readiness_row["readiness_status"],
        classification=readiness_row["classification"],
        source_dns_records=len(dns_records),
        planned_activation_dns_records=len(activation_records),
        planned_preserve_dns_records=len(preserve_records),
        skipped_records=len(skipped),
        redirect_rules=len(redirect_rules),
        forwarding_targets=len(unique_targets),
        review_flags=";".join(sorted(set(review_flags))),
        dns_payload_file=f"dns_payloads/{dns_file.name}",
        redirect_payload_file=f"redirect_payloads/{redirect_file.name}",
        notes=" ".join(notes),
    )
    manual_notes = []
    if review_flags:
        manual_notes.append(f"- `{domain}`: `{plan_row.review_flags}`. {plan_row.notes}")
    return plan_row, redirect_rows, manual_notes


def write_csv(path: Path, rows: list[Any], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def human_utc(value: str) -> str:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return value
    return parsed.strftime("%m/%d/%Y %-I:%M %p UTC")


def write_markdown(path: Path, summary: dict[str, Any], manual_notes: list[str]) -> None:
    lines = [
        "# Cloudflare Import Plan Manual Review",
        "",
        f"- Generated at UTC: {human_utc(summary['generated_at_utc'])}",
        f"- Batch: `{summary['batch']}`",
        f"- Domains planned: `{summary['domains_planned']}`",
        f"- Mutations performed: `{str(summary['mutations_performed']).lower()}`",
        "",
        "## Review Items",
        "",
    ]
    if manual_notes:
        lines.extend(manual_notes)
    else:
        lines.append("No manual-review flags were emitted for this dry-run batch.")
    lines.extend(
        [
            "",
            "## Notes",
            "",
            f"- Redirect activation DNS uses proxied `A` records to `{PLACEHOLDER_A}` following Cloudflare's redirect-domain guidance.",
            "- GoDaddy authority `NS` records are intentionally skipped because Cloudflare assigns zone nameservers.",
            "- GoDaddy forwarding-service `A` records are intentionally replaced by Cloudflare redirect activation placeholders.",
            "- Nonessential source DNS records are intentionally dropped by default for standardized redirect-only zones.",
            "- Redirect rules modernize `http://` targets to `https://`, preserve query strings, and pass the source path through to the configured destination base URL.",
            "- Apply remains out of scope for this packet.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build dry-run Cloudflare DNS and redirect import plans.")
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--readiness-matrix", type=Path, default=None)
    parser.add_argument("--batch", default="batch_1_redirect_only")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument(
        "--preserve-nonessential-dns",
        action="store_true",
        help="Carry non-forwarding source DNS records into payloads. Default is clean redirect-only DNS.",
    )
    args = parser.parse_args()

    readiness_path = args.readiness_matrix or latest_readiness_matrix()
    readiness_rows = read_readiness(readiness_path, args.batch, args.limit)
    if not readiness_rows:
        raise SystemExit(f"No readiness rows found for batch {args.batch}: {readiness_path}")
    snapshot_dates = {row["snapshot_date"] for row in readiness_rows}
    if len(snapshot_dates) != 1:
        raise SystemExit(f"Expected one snapshot date in readiness rows, found {sorted(snapshot_dates)}")
    snapshot_date = snapshot_dates.pop()
    domains = [row["domain"] for row in readiness_rows]

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_cloudflare_import_plan")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    dns_dir = output_dir / "dns_payloads"
    redirect_dir = output_dir / "redirect_payloads"
    dns_dir.mkdir(parents=True, exist_ok=True)
    redirect_dir.mkdir(parents=True, exist_ok=True)

    with connect(args.db_path) as conn:
        dns_records = load_dns_records(conn, snapshot_date, domains)
        forwarding = load_forwarding(conn, snapshot_date, domains)

    domain_plans: list[DomainPlanRow] = []
    redirect_rows: list[RedirectPlanRow] = []
    manual_notes: list[str] = []
    for row in readiness_rows:
        plan, redirects, notes = build_domain_plan(
            row,
            dns_records.get(row["domain"], []),
            forwarding.get(row["domain"], []),
            dns_dir,
            redirect_dir,
            preserve_nonessential_dns=args.preserve_nonessential_dns,
        )
        domain_plans.append(plan)
        redirect_rows.extend(redirects)
        manual_notes.extend(notes)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary = {
        "run_type": "cloudflare_import_plan",
        "generated_at_utc": generated_at,
        "mutations_performed": False,
        "batch": args.batch,
        "readiness_matrix": str(readiness_path),
        "snapshot_date": snapshot_date,
        "domains_planned": len(domain_plans),
        "redirect_rules_planned": sum(row.redirect_rules for row in domain_plans),
        "activation_dns_records_planned": sum(row.planned_activation_dns_records for row in domain_plans),
        "preserve_dns_records_planned": sum(row.planned_preserve_dns_records for row in domain_plans),
        "skipped_source_records": sum(row.skipped_records for row in domain_plans),
        "http_targets_modernized": sum(row.target_url_modernized for row in redirect_rows),
        "plan_status_counts": dict(Counter(row.plan_status for row in domain_plans)),
        "review_flag_counts": dict(
            Counter(flag for row in domain_plans for flag in row.review_flags.split(";") if flag)
        ),
        "cloudflare_redirect_reference": CLOUDFLARE_REDIRECT_DOC,
        "standardization_policy": {
            "redirect_only_dns_shape": "apex_and_www_proxied_A_192.0.2.1",
            "preserve_nonessential_dns": bool(args.preserve_nonessential_dns),
            "query_string_preservation": "enabled",
            "path_passthrough": "enabled_base_target_plus_source_path",
            "http_targets_modernized_to_https": True,
        },
    }
    write_csv(output_dir / "domain_import_plan.csv", domain_plans, list(DomainPlanRow.__annotations__.keys()))
    write_csv(output_dir / "redirect_plan.csv", redirect_rows, list(RedirectPlanRow.__annotations__.keys()))
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    write_markdown(output_dir / "manual_review.md", summary, manual_notes)
    print(json.dumps({"output_dir": str(output_dir), **summary}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
