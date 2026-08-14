#!/usr/bin/env python3
"""Build a read-only Cloudflare DNS migration readiness packet.

The GoDaddy collector is the current source of truth for registrar/DNS inventory.
This script transforms the latest snapshots into an operator-facing migration
matrix without mutating GoDaddy, Cloudflare, DNS, forwarding, or registrar state.
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"

PLATFORM_DOMAINS = {
    "venterradev.com",
    "app.venterradev.com",
    "api.venterradev.com",
    "resources.venterradev.com",
    "pilot.venterradev.com",
    "venterraliving.com",
    "venterraliving.io",
    "yournamehere.vip",
    "steps.yournamehere.vip",
}

EMAIL_RECORD_TYPES = {"MX", "SPF"}
TXT_EMAIL_MARKERS = ("v=spf1", "dkim", "dmarc", "google-site-verification", "ms=", "apple-domain-verification")
HIGH_CARE_RECORD_TYPES = {"MX", "SRV", "CAA"}


@dataclass
class DomainReadinessRow:
    domain: str
    classification: str
    readiness_status: str
    recommended_batch: str
    risk_level: str
    risk_flags: str
    migration_notes: str
    snapshot_date: str
    property_id: Optional[str]
    property_name: Optional[str]
    domain_status: Optional[str]
    expires: Optional[str]
    locked: Optional[int]
    renew_auto: Optional[int]
    privacy: Optional[int]
    transfer_protected: Optional[int]
    dns_http_status: Optional[int]
    dns_record_count: int
    dns_record_type_counts: str
    nameservers: str
    uses_cloudflare_nameservers: int
    forwarding_statuses: str
    forwarding_count: int
    forwarding_urls: str
    has_mx: int
    has_spf: int
    has_dkim: int
    has_dmarc: int
    has_caa: int
    has_srv: int
    has_txt_verification: int
    cloudflare_zone_status: str
    cloudflare_zone_name: Optional[str]
    cloudflare_zone_tag_present: int
    cloudflare_current_plan: Optional[str]
    recommended_cloudflare_plan: str
    cloudflare_snapshot_date: Optional[str]


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def parse_json(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def latest_date(conn: sqlite3.Connection, table: str, column: str) -> Optional[str]:
    row = conn.execute(f"SELECT MAX({column}) AS latest FROM {table}").fetchone()
    return str(row["latest"]) if row and row["latest"] else None


def load_domains(conn: sqlite3.Connection, snapshot_date: str) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            """
            SELECT *
            FROM godaddy_domain_snapshots
            WHERE snapshot_date = ?
            ORDER BY domain
            """,
            (snapshot_date,),
        )
    )


def load_dns_records(conn: sqlite3.Connection, snapshot_date: str) -> dict[str, list[sqlite3.Row]]:
    records: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in conn.execute(
        """
        SELECT *
        FROM godaddy_dns_records
        WHERE snapshot_date = ?
        ORDER BY domain, record_type, record_name, record_data
        """,
        (snapshot_date,),
    ):
        records[str(row["domain"])].append(row)
    return records


def load_forwarding(conn: sqlite3.Connection, snapshot_date: str) -> dict[str, dict[str, Any]]:
    latest_forwarding = conn.execute(
        """
        SELECT MAX(snapshot_date) AS latest
        FROM godaddy_forwarding_snapshots
        WHERE snapshot_date <= ?
        """,
        (snapshot_date,),
    ).fetchone()
    forwarding_date = latest_forwarding["latest"] if latest_forwarding else None
    output: dict[str, dict[str, Any]] = {}
    if not forwarding_date:
        return output
    for row in conn.execute(
        """
        SELECT requested_domain, forwarding_status, forwarding_count, forwarding_url
        FROM godaddy_forwarding_snapshots
        WHERE snapshot_date = ?
        ORDER BY requested_domain, fqdn
        """,
        (forwarding_date,),
    ):
        domain = str(row["requested_domain"])
        entry = output.setdefault(
            domain,
            {
                "snapshot_date": forwarding_date,
                "statuses": Counter(),
                "count": 0,
                "urls": [],
            },
        )
        entry["statuses"][str(row["forwarding_status"])] += 1
        entry["count"] += int(row["forwarding_count"] or 0)
        if row["forwarding_url"]:
            entry["urls"].append(str(row["forwarding_url"]))
    return output


def load_cloudflare_local(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT normalized_domain, zone_name, zone_tag, snapshot_date, snapshot_status
        FROM cloudflare_zone_config_snapshots
        WHERE snapshot_date = (
            SELECT MAX(inner_snapshot.snapshot_date)
            FROM cloudflare_zone_config_snapshots AS inner_snapshot
            WHERE inner_snapshot.normalized_domain = cloudflare_zone_config_snapshots.normalized_domain
        )
        ORDER BY normalized_domain
        """
    ).fetchall()
    return {
        str(row["normalized_domain"]): {
            "zone_name": row["zone_name"],
            "zone_tag": row["zone_tag"],
            "snapshot_date": row["snapshot_date"],
            "snapshot_status": row["snapshot_status"],
            "source": "local_config_snapshot",
            "plan_name": None,
        }
        for row in rows
    }


def load_cloudflare_inventory(path: Optional[Path]) -> dict[str, dict[str, Any]]:
    if not path:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Cloudflare inventory must be a list: {path}")
    output: dict[str, dict[str, Any]] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip().lower()
        if not name:
            continue
        output[name] = {
            "zone_name": name,
            "zone_tag": item.get("zone_id"),
            "snapshot_date": item.get("modified_on") or item.get("created_on"),
            "snapshot_status": item.get("status"),
            "source": "cloudflare_account_inventory",
            "plan_name": item.get("plan_name"),
        }
    return output


def recommended_plan_for(classification: str, cf: Optional[dict[str, Any]]) -> str:
    current_plan = str((cf or {}).get("plan_name") or "").strip()
    if current_plan and current_plan.lower() != "free website":
        return "preserve_existing_plan_review"
    if classification == "platform_domain":
        return "free_website_default_platform_review"
    return "free_website_default"


def bool_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    return 1 if bool(value) else 0


def compact_counter(counter: Counter[str]) -> str:
    return ";".join(f"{key}:{counter[key]}" for key in sorted(counter))


def compact_list(values: Iterable[str], *, limit: int = 8) -> str:
    cleaned = []
    seen = set()
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text and text not in seen:
            cleaned.append(text)
            seen.add(text)
    if len(cleaned) > limit:
        return ";".join(cleaned[:limit] + [f"...+{len(cleaned) - limit}"])
    return ";".join(cleaned)


def record_markers(records: list[sqlite3.Row]) -> dict[str, int]:
    types = {str(record["record_type"] or "").upper() for record in records}
    txt_values = " ".join(
        str(record["record_data"] or "").lower()
        for record in records
        if str(record["record_type"] or "").upper() == "TXT"
    )
    txt_names = " ".join(
        str(record["record_name"] or "").lower()
        for record in records
        if str(record["record_type"] or "").upper() == "TXT"
    )
    return {
        "has_mx": 1 if "MX" in types else 0,
        "has_spf": 1 if "SPF" in types or "v=spf1" in txt_values else 0,
        "has_dkim": 1 if "dkim" in txt_names or "dkim" in txt_values else 0,
        "has_dmarc": 1 if "_dmarc" in txt_names or "v=dmarc" in txt_values else 0,
        "has_caa": 1 if "CAA" in types else 0,
        "has_srv": 1 if "SRV" in types else 0,
        "has_txt_verification": 1 if any(marker in txt_values for marker in TXT_EMAIL_MARKERS[3:]) else 0,
    }


def classify_domain(
    domain: str,
    row: sqlite3.Row,
    markers: dict[str, int],
    forwarding_count: int,
) -> str:
    nameservers = [str(item).lower() for item in parse_json(row["nameservers_json"], [])]
    if domain in PLATFORM_DOMAINS or any(domain.endswith(f".{item}") for item in PLATFORM_DOMAINS):
        return "platform_domain"
    if row["property_id"]:
        return "property_site"
    if forwarding_count > 0:
        return "redirect_only"
    if int(row["dns_record_count"] or 0) == 0 and not any(markers.values()):
        return "parked_or_defensive"
    if nameservers and all("domaincontrol.com" in item for item in nameservers):
        return "active_production"
    return "active_production"


def readiness_for(
    row: sqlite3.Row,
    markers: dict[str, int],
    forwarding_count: int,
    cloudflare_status: str,
) -> tuple[str, str, str, str]:
    flags: list[str] = []
    notes: list[str] = []
    dns_status = int(row["dns_http_status"] or 0)
    domain_status = str(row["domain_status"] or "").upper()

    if domain_status and domain_status != "ACTIVE":
        flags.append(f"domain_status_{domain_status.lower()}")
    if dns_status != 200:
        flags.append(f"dns_source_limited_{dns_status or 'unknown'}")
        notes.append("GoDaddy DNS records are not fully readable from the API.")
    if markers["has_mx"] or markers["has_srv"]:
        flags.append("email_or_service_records")
        notes.append("Email/service records require careful validation before nameserver cutover.")
    if markers["has_caa"]:
        flags.append("caa_records")
        notes.append("CAA records may affect Cloudflare certificate issuance.")
    if row["locked"]:
        flags.append("registrar_locked")
    if row["transfer_protected"]:
        flags.append("transfer_protected")
        notes.append("GoDaddy transfer protection blocks automated nameserver cutover until protection is removed or manually cleared.")
    if cloudflare_status == "local_snapshot_known":
        notes.append("Cloudflare local config snapshot already exists for this domain.")
    elif cloudflare_status == "account_inventory_known":
        notes.append("Domain is present in Cloudflare account inventory; reconcile records and nameservers before mutation.")
    elif cloudflare_status == "delegated_to_cloudflare_nameservers":
        notes.append("Domain nameservers already point to Cloudflare; reconcile zone ownership and records first.")
    else:
        flags.append("cloudflare_zone_not_in_local_inventory")

    try:
        expires = date.fromisoformat(str(row["expires"])[:10]) if row["expires"] else None
    except ValueError:
        expires = None
    if expires:
        days_to_expiry = (expires - datetime.now(timezone.utc).date()).days
        if days_to_expiry < 30:
            flags.append("expires_within_30_days")
            notes.append("Domain expires within 30 days; review renewal posture before migration.")
        elif days_to_expiry < 60:
            flags.append("expires_within_60_days")
            notes.append("Domain expires within 60 days; include renewal posture in batch review.")

    if dns_status != 200 or "transfer_protected" in flags or "expires_within_30_days" in flags or (domain_status and domain_status != "ACTIVE"):
        readiness = "manual_review"
    elif markers["has_mx"] or markers["has_srv"] or markers["has_caa"]:
        readiness = "ready_with_care"
    else:
        readiness = "ready"

    if readiness == "manual_review":
        risk = "high"
    elif markers["has_mx"] or markers["has_srv"] or markers["has_caa"]:
        risk = "medium"
    elif forwarding_count > 0:
        risk = "medium"
    else:
        risk = "low"

    if readiness == "manual_review":
        batch = "manual_review"
    elif cloudflare_status in {"local_snapshot_known", "account_inventory_known", "delegated_to_cloudflare_nameservers"}:
        batch = "batch_0_cloudflare_seen"
    elif forwarding_count > 0 and not markers["has_mx"]:
        batch = "batch_1_redirect_only"
    elif int(row["dns_record_count"] or 0) <= 2 and not any(markers[name] for name in ("has_mx", "has_srv", "has_caa")):
        batch = "batch_2_parked_or_defensive"
    elif row["property_id"]:
        batch = "batch_3_property_sites"
    else:
        batch = "batch_4_active_dns"

    if not notes:
        notes.append("No blocking readiness condition found in local snapshots.")
    return readiness, batch, risk, compact_list(flags), " ".join(notes)


def build_rows(
    conn: sqlite3.Connection,
    snapshot_date: str,
    cloudflare_inventory_path: Optional[Path] = None,
) -> list[DomainReadinessRow]:
    domains = load_domains(conn, snapshot_date)
    dns_records = load_dns_records(conn, snapshot_date)
    forwarding = load_forwarding(conn, snapshot_date)
    cloudflare = load_cloudflare_local(conn)
    account_inventory = load_cloudflare_inventory(cloudflare_inventory_path)
    for name, item in account_inventory.items():
        cloudflare.setdefault(name, item)
    rows: list[DomainReadinessRow] = []

    for domain_row in domains:
        domain = str(domain_row["domain"])
        records = dns_records.get(domain, [])
        markers = record_markers(records)
        forwarding_entry = forwarding.get(domain, {"statuses": Counter(), "count": 0, "urls": []})
        forwarding_count = int(forwarding_entry["count"] or 0)
        cf = cloudflare.get(domain)
        nameservers = [str(item).lower() for item in parse_json(domain_row["nameservers_json"], [])]
        uses_cloudflare_nameservers = 1 if any("cloudflare.com" in item for item in nameservers) else 0
        if cf:
            cf_status = "local_snapshot_known" if cf.get("source") == "local_config_snapshot" else "account_inventory_known"
        elif uses_cloudflare_nameservers:
            cf_status = "delegated_to_cloudflare_nameservers"
        else:
            cf_status = "not_in_local_inventory"
        classification = classify_domain(domain, domain_row, markers, forwarding_count)
        readiness, batch, risk, flags, notes = readiness_for(domain_row, markers, forwarding_count, cf_status)
        type_counts = parse_json(domain_row["dns_record_type_counts_json"], {})
        rows.append(
            DomainReadinessRow(
                domain=domain,
                classification=classification,
                readiness_status=readiness,
                recommended_batch=batch,
                risk_level=risk,
                risk_flags=flags,
                migration_notes=notes,
                snapshot_date=snapshot_date,
                property_id=domain_row["property_id"],
                property_name=domain_row["property_name"],
                domain_status=domain_row["domain_status"],
                expires=domain_row["expires"],
                locked=bool_int(domain_row["locked"]),
                renew_auto=bool_int(domain_row["renew_auto"]),
                privacy=bool_int(domain_row["privacy"]),
                transfer_protected=bool_int(domain_row["transfer_protected"]),
                dns_http_status=domain_row["dns_http_status"],
                dns_record_count=int(domain_row["dns_record_count"] or 0),
                dns_record_type_counts=json.dumps(type_counts, sort_keys=True),
                nameservers=compact_list(nameservers, limit=6),
                uses_cloudflare_nameservers=uses_cloudflare_nameservers,
                forwarding_statuses=compact_counter(forwarding_entry["statuses"]),
                forwarding_count=forwarding_count,
                forwarding_urls=compact_list(forwarding_entry["urls"], limit=6),
                has_mx=markers["has_mx"],
                has_spf=markers["has_spf"],
                has_dkim=markers["has_dkim"],
                has_dmarc=markers["has_dmarc"],
                has_caa=markers["has_caa"],
                has_srv=markers["has_srv"],
                has_txt_verification=markers["has_txt_verification"],
                cloudflare_zone_status=cf_status,
                cloudflare_zone_name=cf["zone_name"] if cf else None,
                cloudflare_zone_tag_present=1 if cf and cf.get("zone_tag") else 0,
                cloudflare_current_plan=cf.get("plan_name") if cf else None,
                recommended_cloudflare_plan=recommended_plan_for(classification, cf),
                cloudflare_snapshot_date=cf["snapshot_date"] if cf else None,
            )
        )
    return rows


def summarize(rows: list[DomainReadinessRow], snapshot_date: str) -> dict[str, Any]:
    summary = {
        "run_type": "cloudflare_dns_migration_readiness",
        "snapshot_date": snapshot_date,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mutations_performed": False,
        "domains_total": len(rows),
        "counts_by_readiness": dict(Counter(row.readiness_status for row in rows)),
        "counts_by_batch": dict(Counter(row.recommended_batch for row in rows)),
        "counts_by_classification": dict(Counter(row.classification for row in rows)),
        "counts_by_risk": dict(Counter(row.risk_level for row in rows)),
        "counts_by_recommended_cloudflare_plan": dict(Counter(row.recommended_cloudflare_plan for row in rows)),
        "dns_readable_domains": sum(1 for row in rows if row.dns_http_status == 200),
        "domains_with_forwarding": sum(1 for row in rows if row.forwarding_count > 0),
        "domains_with_email_records": sum(1 for row in rows if row.has_mx or row.has_spf or row.has_dkim or row.has_dmarc),
        "domains_with_cloudflare_local_snapshot": sum(1 for row in rows if row.cloudflare_zone_status == "local_snapshot_known"),
        "domains_in_cloudflare_account_inventory": sum(
            1 for row in rows if row.cloudflare_zone_status in {"local_snapshot_known", "account_inventory_known"}
        ),
        "domains_delegated_to_cloudflare_nameservers": sum(
            1 for row in rows if row.cloudflare_zone_status == "delegated_to_cloudflare_nameservers"
        ),
        "domains_using_cloudflare_nameservers": sum(1 for row in rows if row.uses_cloudflare_nameservers),
        "locked_domains": sum(1 for row in rows if row.locked),
        "transfer_protected_domains": sum(1 for row in rows if row.transfer_protected),
        "auto_renew_domains": sum(1 for row in rows if row.renew_auto),
    }
    return summary


def write_csv(path: Path, rows: list[DomainReadinessRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(asdict(rows[0]).keys()) if rows else list(DomainReadinessRow.__annotations__.keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def write_markdown(path: Path, summary: dict[str, Any], rows: list[DomainReadinessRow]) -> None:
    batch_counts = Counter(row.recommended_batch for row in rows)
    readiness_counts = Counter(row.readiness_status for row in rows)
    risk_counts = Counter(row.risk_level for row in rows)
    plan_counts = Counter(row.recommended_cloudflare_plan for row in rows)
    manual_examples = [row for row in rows if row.readiness_status == "manual_review"][:20]
    batch_order = [
        "batch_0_cloudflare_seen",
        "batch_1_redirect_only",
        "batch_2_parked_or_defensive",
        "batch_3_property_sites",
        "batch_4_active_dns",
        "manual_review",
    ]

    lines = [
        "# Cloudflare DNS Migration Readiness",
        "",
        f"- Snapshot date: `{summary['snapshot_date']}`",
        f"- Generated at UTC: `{summary['generated_at_utc']}`",
        f"- Mutations performed: `{str(summary['mutations_performed']).lower()}`",
        f"- Domains assessed: `{summary['domains_total']}`",
        f"- GoDaddy DNS readable domains: `{summary['dns_readable_domains']}`",
        f"- Domains with active forwarding: `{summary['domains_with_forwarding']}`",
        f"- Domains with email-related records: `{summary['domains_with_email_records']}`",
        f"- Transfer-protected domains: `{summary['transfer_protected_domains']}`",
        f"- Domains with local Cloudflare config evidence: `{summary['domains_with_cloudflare_local_snapshot']}`",
        f"- Domains in Cloudflare account inventory/local snapshots: `{summary['domains_in_cloudflare_account_inventory']}`",
        f"- Domains delegated to Cloudflare nameservers without local config snapshot: `{summary['domains_delegated_to_cloudflare_nameservers']}`",
        f"- Cloudflare zones outside GoDaddy snapshot: `{summary.get('cloudflare_zones_outside_godaddy_snapshot_count', 0)}`",
        "",
        "## Readiness Counts",
        "",
    ]
    for key in sorted(readiness_counts):
        lines.append(f"- `{key}`: `{readiness_counts[key]}`")
    lines.extend(["", "## Risk Counts", ""])
    for key in sorted(risk_counts):
        lines.append(f"- `{key}`: `{risk_counts[key]}`")
    lines.extend(["", "## Cloudflare Plan Recommendation", ""])
    for key in sorted(plan_counts):
        lines.append(f"- `{key}`: `{plan_counts[key]}`")
    lines.extend(["", "## Recommended Batches", ""])
    for key in batch_order:
        if batch_counts[key]:
            lines.append(f"- `{key}`: `{batch_counts[key]}`")
    lines.extend(
        [
            "",
            "## Batch Meaning",
            "",
            "- `batch_0_cloudflare_seen`: domain already has Cloudflare account, local config, or nameserver evidence; reconcile first.",
            "- `batch_1_redirect_only`: forwarding-heavy domains suitable for Cloudflare Redirect Rules or Bulk Redirect planning.",
            "- `batch_2_parked_or_defensive`: low-record domains suitable for early controlled migration.",
            "- `batch_3_property_sites`: property domains tied to governed identity; migrate with website validation.",
            "- `batch_4_active_dns`: active DNS domains without a tighter batch; migrate after low-risk batches.",
            "- `manual_review`: blocked from automated cutover planning until source limits or risk conditions are resolved.",
            "",
            "## Manual Review Sample",
            "",
        ]
    )
    if manual_examples:
        lines.append("| Domain | Flags | Notes |")
        lines.append("| --- | --- | --- |")
        for row in manual_examples:
            lines.append(f"| `{row.domain}` | `{row.risk_flags}` | {row.migration_notes} |")
    else:
        lines.append("No manual-review domains in this packet.")
    lines.extend(
        [
            "",
            "## Next Implementation Step",
            "",
            "Select the first approved dry-run batch from the readiness matrix, generate Cloudflare DNS import plans "
            "for those domains, and validate GoDaddy-vs-Cloudflare DNS diffs before any nameserver mutation.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build read-only Cloudflare DNS migration readiness artifacts.")
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--snapshot-date", help="GoDaddy snapshot date, YYYY-MM-DD. Defaults to latest local snapshot.")
    parser.add_argument("--cloudflare-inventory-json", type=Path, help="Optional cloudflare_zones.json from collect_cloudflare_zone_inventory.py.")
    parser.add_argument("--output-dir", type=Path, help="Output directory. Defaults to reports/domain_ops/<run_id>.")
    args = parser.parse_args()

    with connect(args.db_path) as conn:
        snapshot_date = args.snapshot_date or latest_date(conn, "godaddy_domain_snapshots", "snapshot_date")
        if not snapshot_date:
            raise SystemExit("No GoDaddy domain snapshots found. Run the GoDaddy collector first.")
        rows = build_rows(conn, snapshot_date, args.cloudflare_inventory_json)

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_cloudflare_dns_migration_readiness")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    summary = summarize(rows, snapshot_date)
    summary["cloudflare_inventory_json"] = str(args.cloudflare_inventory_json) if args.cloudflare_inventory_json else None
    if args.cloudflare_inventory_json:
        inventory = load_cloudflare_inventory(args.cloudflare_inventory_json)
        row_domains = {row.domain for row in rows}
        outside_godaddy = sorted(name for name in inventory if name not in row_domains)
        summary["cloudflare_zones_outside_godaddy_snapshot"] = outside_godaddy
        summary["cloudflare_zones_outside_godaddy_snapshot_count"] = len(outside_godaddy)
    write_csv(output_dir / "readiness_matrix.csv", rows)
    write_json(output_dir / "readiness_matrix.json", [asdict(row) for row in rows])
    write_json(output_dir / "summary.json", summary)
    write_markdown(output_dir / "batch_plan.md", summary, rows)
    print(json.dumps({"output_dir": str(output_dir), **summary}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
