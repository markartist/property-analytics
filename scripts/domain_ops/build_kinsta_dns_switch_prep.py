#!/usr/bin/env python3
"""Build a read-only Cloudflare DNS switch prep packet for Kinsta CNAMEs."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ops.cloudflare.cloudflare_auth import CloudflareAuthError, resolve_cloudflare_token


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"
KINSTA_TARGET_SUFFIX = ".hosting.kinsta.cloud"
WEBSITE_CONFLICT_TYPES = {"A", "AAAA", "CNAME"}


@dataclass
class DesiredRecord:
    site: str
    domain: str
    type: str
    name: str
    fqdn: str
    value: str


@dataclass
class ExistingRecord:
    id: str
    zone_name: str
    type: str
    name: str
    content: str
    proxied: bool | None
    ttl: int | None
    comment: str
    tags: str
    created_on: str
    modified_on: str


@dataclass
class PlanRow:
    site: str
    domain: str
    zone_status: str
    universal_ssl_enabled: str
    universal_ssl_status: str
    ssl_mode: str
    desired_records: int
    existing_target_records: int
    delete_candidates: int
    preserve_review_records: int
    already_correct_records: int
    missing_records: int
    risk_flags: str
    next_action: str


class CloudflareClient:
    def __init__(self, token: str, spacing_seconds: float = 0.15) -> None:
        self.token = token
        self.spacing_seconds = spacing_seconds
        self.last_request_at = 0.0

    def api(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        elapsed = time.monotonic() - self.last_request_at
        if elapsed < self.spacing_seconds:
            time.sleep(self.spacing_seconds - elapsed)
        req = urllib.request.Request(
            f"{CLOUDFLARE_API_BASE}{path}{query}",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json",
                "User-Agent": "PropertyAnalytics-DomainOps/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            self.last_request_at = time.monotonic()
            return json.loads(resp.read().decode("utf-8"))

    def find_zone(self, domain: str) -> dict[str, Any] | None:
        payload = self.api("/zones", {"name": domain, "page": 1, "per_page": 50})
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare zone lookup failed for {domain}: {payload.get('errors')}")
        zones = payload.get("result") or []
        return zones[0] if zones else None

    def list_dns(self, zone_id: str) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = self.api(f"/zones/{zone_id}/dns_records", {"page": page, "per_page": 500})
            if not payload.get("success"):
                raise RuntimeError(f"Cloudflare DNS lookup failed for zone {zone_id}: {payload.get('errors')}")
            records.extend(payload.get("result") or [])
            info = payload.get("result_info") or {}
            total_pages = int(info.get("total_pages") or page)
            if page >= total_pages:
                return records
            page += 1

    def zone_setting(self, zone_id: str, setting: str) -> dict[str, Any] | None:
        try:
            payload = self.api(f"/zones/{zone_id}/settings/{setting}")
        except Exception:
            return None
        if not payload.get("success"):
            return None
        result = payload.get("result")
        return result if isinstance(result, dict) else None

    def universal_ssl_settings(self, zone_id: str) -> dict[str, Any] | None:
        try:
            payload = self.api(f"/zones/{zone_id}/ssl/universal/settings")
        except Exception:
            return None
        if not payload.get("success"):
            return None
        result = payload.get("result")
        return result if isinstance(result, dict) else None

    def dynamic_redirect_entrypoint(self, zone_id: str) -> dict[str, Any] | None:
        try:
            payload = self.api(f"/zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint")
        except Exception:
            return None
        if not payload.get("success"):
            return None
        result = payload.get("result")
        return result if isinstance(result, dict) else None

    def page_rules(self, zone_id: str) -> list[dict[str, Any]]:
        rules: list[dict[str, Any]] = []
        page = 1
        while True:
            try:
                payload = self.api(f"/zones/{zone_id}/pagerules", {"page": page, "per_page": 100})
            except Exception:
                return rules
            if not payload.get("success"):
                return rules
            rules.extend(payload.get("result") or [])
            info = payload.get("result_info") or {}
            total_pages = int(info.get("total_pages") or page)
            if page >= total_pages:
                return rules
            page += 1


def read_desired_records(path: Path) -> list[DesiredRecord]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = []
        for line_no, row in enumerate(csv.DictReader(handle), start=2):
            clean = {key: (value or "").strip() for key, value in row.items()}
            missing = [name for name in ["Site", "Domain", "Type", "Name", "Value"] if not clean.get(name)]
            if missing:
                raise SystemExit(f"Missing {missing} on CSV line {line_no}")
            record_type = clean["Type"].upper()
            name = clean["Name"]
            domain = clean["Domain"].lower()
            value = clean["Value"].lower().rstrip(".")
            if record_type != "CNAME":
                raise SystemExit(f"Unsupported record type on CSV line {line_no}: {record_type}")
            if not value.endswith(KINSTA_TARGET_SUFFIX):
                raise SystemExit(f"Non-Kinsta target on CSV line {line_no}: {value}")
            fqdn = domain if name == "@" else f"{name.lower()}.{domain}"
            rows.append(
                DesiredRecord(
                    site=clean["Site"],
                    domain=domain,
                    type=record_type,
                    name=name,
                    fqdn=fqdn,
                    value=value,
                )
            )
        return rows


def write_csv(path: Path, rows: list[Any], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row if isinstance(row, dict) else asdict(row))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def record_comment(record: dict[str, Any]) -> str:
    value = record.get("comment")
    return str(value or "")


def record_tags(record: dict[str, Any]) -> str:
    tags = record.get("tags")
    if not isinstance(tags, list):
        return ""
    return ";".join(str(tag) for tag in tags)


def existing_row(zone_name: str, record: dict[str, Any]) -> ExistingRecord:
    return ExistingRecord(
        id=str(record.get("id") or ""),
        zone_name=zone_name,
        type=str(record.get("type") or "").upper(),
        name=str(record.get("name") or "").lower().rstrip("."),
        content=str(record.get("content") or "").lower().rstrip("."),
        proxied=record.get("proxied") if isinstance(record.get("proxied"), bool) else None,
        ttl=record.get("ttl") if isinstance(record.get("ttl"), int) else None,
        comment=record_comment(record),
        tags=record_tags(record),
        created_on=str(record.get("created_on") or ""),
        modified_on=str(record.get("modified_on") or ""),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build read-only Kinsta DNS switch prep packet.")
    parser.add_argument("--csv", required=True, type=Path, help="CSV with Site,Domain,Type,Name,Value columns.")
    parser.add_argument("--output-dir", type=Path, help="Output directory. Defaults under reports/domain_ops.")
    parser.add_argument(
        "--delete-email-at-target-names",
        action="store_true",
        help="Treat MX/SPF records at desired apex/www CNAME names as approved delete candidates.",
    )
    args = parser.parse_args()

    desired = read_desired_records(args.csv)
    desired_by_domain: dict[str, list[DesiredRecord]] = defaultdict(list)
    for record in desired:
        desired_by_domain[record.domain].append(record)

    shape_issues = []
    for domain, records in sorted(desired_by_domain.items()):
        names = sorted(record.name for record in records)
        targets = Counter(record.value for record in records)
        if names != ["@", "www"]:
            shape_issues.append({"domain": domain, "issue": "Expected exactly @ and www records", "names": names})
        if len(targets) != 1:
            shape_issues.append({"domain": domain, "issue": "Apex and www targets differ", "targets": dict(targets)})
    if shape_issues:
        raise SystemExit(json.dumps({"shape_issues": shape_issues}, indent=2))

    try:
        resolved = resolve_cloudflare_token()
    except CloudflareAuthError as exc:
        raise SystemExit(f"Cloudflare credential resolution failed: {exc}") from exc

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_kinsta_dns_switch_prep")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    client = CloudflareClient(resolved.token)

    existing_rows: list[ExistingRecord] = []
    delete_rows: list[dict[str, Any]] = []
    add_rows: list[dict[str, Any]] = []
    preserve_rows: list[dict[str, Any]] = []
    forwarding_rows: list[dict[str, Any]] = []
    plan_rows: list[PlanRow] = []
    zone_snapshots: dict[str, Any] = {}

    for domain, records in sorted(desired_by_domain.items()):
        zone = client.find_zone(domain)
        if not zone:
            plan_rows.append(
                PlanRow(
                    site=records[0].site,
                    domain=domain,
                    zone_status="missing",
                    universal_ssl_enabled="unknown",
                    universal_ssl_status="unknown",
                    ssl_mode="unknown",
                    desired_records=len(records),
                    existing_target_records=0,
                    delete_candidates=0,
                    preserve_review_records=0,
                    already_correct_records=0,
                    missing_records=len(records),
                    risk_flags="cloudflare_zone_missing",
                    next_action="Create/import Cloudflare zone before DNS switch.",
                )
            )
            continue

        zone_id = str(zone.get("id") or "")
        dns_records = client.list_dns(zone_id)
        ssl_setting = client.zone_setting(zone_id, "ssl") or {}
        universal_ssl = client.universal_ssl_settings(zone_id) or {}
        redirect_entrypoint = client.dynamic_redirect_entrypoint(zone_id)
        page_rules = client.page_rules(zone_id)
        zone_snapshots[domain] = {
            "zone": {
                "id": zone_id,
                "name": zone.get("name"),
                "status": zone.get("status"),
                "paused": zone.get("paused"),
                "type": zone.get("type"),
                "plan": (zone.get("plan") or {}).get("name") if isinstance(zone.get("plan"), dict) else None,
            },
            "ssl_setting": ssl_setting,
            "universal_ssl_settings": universal_ssl,
            "dynamic_redirect_entrypoint": redirect_entrypoint,
            "page_rules": page_rules,
            "dns_records": dns_records,
        }

        if redirect_entrypoint:
            for rule in redirect_entrypoint.get("rules") or []:
                forwarding_rows.append(
                    {
                        "site": records[0].site,
                        "domain": domain,
                        "zone_id": zone_id,
                        "source": "dynamic_redirect_ruleset",
                        "ruleset_id": redirect_entrypoint.get("id", ""),
                        "rule_id": rule.get("id", ""),
                        "ref": rule.get("ref", ""),
                        "enabled": rule.get("enabled", True),
                        "description": rule.get("description", ""),
                        "expression": rule.get("expression", ""),
                        "action": rule.get("action", ""),
                        "action_parameters": json.dumps(rule.get("action_parameters") or {}, sort_keys=True),
                        "status": "forwarding_review_before_dns_switch",
                    }
                )
        for rule in page_rules:
            actions = rule.get("actions") if isinstance(rule.get("actions"), list) else []
            forwarding_actions = [action for action in actions if action.get("id") == "forwarding_url"]
            if not forwarding_actions:
                continue
            targets = rule.get("targets") if isinstance(rule.get("targets"), list) else []
            forwarding_rows.append(
                {
                    "site": records[0].site,
                    "domain": domain,
                    "zone_id": zone_id,
                    "source": "page_rule_forwarding_url",
                    "ruleset_id": "",
                    "rule_id": rule.get("id", ""),
                    "ref": "",
                    "enabled": rule.get("status") == "active",
                    "description": "",
                    "expression": json.dumps(targets, sort_keys=True),
                    "action": "forwarding_url",
                    "action_parameters": json.dumps(forwarding_actions, sort_keys=True),
                    "status": "forwarding_review_before_dns_switch",
                }
            )

        desired_fqdns = {record.fqdn for record in records}
        existing_at_names = [record for record in dns_records if str(record.get("name") or "").lower().rstrip(".") in desired_fqdns]
        existing_rows.extend(existing_row(domain, record) for record in existing_at_names)
        existing_lookup = {
            (str(record.get("type") or "").upper(), str(record.get("name") or "").lower().rstrip("."), str(record.get("content") or "").lower().rstrip(".")): record
            for record in existing_at_names
        }

        already_correct = 0
        for record in records:
            key = ("CNAME", record.fqdn, record.value)
            if key in existing_lookup:
                already_correct += 1
                continue
            add_rows.append(
                {
                    "site": record.site,
                    "domain": domain,
                    "zone_id": zone_id,
                    "type": "CNAME",
                    "name": record.fqdn,
                    "content": record.value,
                    "ttl": 1,
                    "proxied": True,
                    "status": "planned_add_after_conflict_cleanup",
                }
            )

        for record in existing_at_names:
            row = existing_row(domain, record)
            if row.type in WEBSITE_CONFLICT_TYPES:
                desired_same = any(row.type == desired_record.type and row.name == desired_record.fqdn and row.content == desired_record.value for desired_record in records)
                if not desired_same:
                    delete_rows.append(
                        {
                            "site": records[0].site,
                            "domain": domain,
                            "zone_id": zone_id,
                            "record_id": row.id,
                            "type": row.type,
                            "name": row.name,
                            "content": row.content,
                            "proxied": row.proxied,
                            "ttl": row.ttl,
                            "status": "planned_delete_conflicting_website_record",
                        }
                    )
            else:
                email_at_target = row.type in {"MX", "SPF"} or (row.type == "TXT" and "v=spf1" in row.content.lower())
                if args.delete_email_at_target_names and email_at_target:
                    delete_rows.append(
                        {
                            "site": records[0].site,
                            "domain": domain,
                            "zone_id": zone_id,
                            "record_id": row.id,
                            "type": row.type,
                            "name": row.name,
                            "content": row.content,
                            "proxied": row.proxied,
                            "ttl": row.ttl,
                            "status": "planned_delete_approved_email_record_at_cname_name",
                        }
                    )
                else:
                    preserve_rows.append(
                        {
                            "site": records[0].site,
                            "domain": domain,
                            "zone_id": zone_id,
                            "type": row.type,
                            "name": row.name,
                            "content": row.content,
                            "status": "preserve_review_non_website_record_at_target_name",
                        }
                    )

        risk_flags: list[str] = []
        if zone.get("status") != "active":
            risk_flags.append(f"zone_status_{zone.get('status')}")
        if universal_ssl.get("enabled") is False:
            risk_flags.append("universal_ssl_disabled")
        if preserve_rows and any(row["domain"] == domain for row in preserve_rows):
            risk_flags.append("non_website_records_at_apex_or_www_review")
        if forwarding_rows and any(row["domain"] == domain for row in forwarding_rows):
            risk_flags.append("forwarding_rules_review")
        if already_correct == 2 and not any(row["domain"] == domain for row in delete_rows):
            next_action = "Already aligned; QA only unless proxy/SSL posture needs adjustment."
        else:
            next_action = "On approval, delete planned website conflicts, add missing proxied Kinsta CNAMEs, then QA apex/www."

        plan_rows.append(
            PlanRow(
                site=records[0].site,
                domain=domain,
                zone_status=str(zone.get("status") or "unknown"),
                universal_ssl_enabled=str(universal_ssl.get("enabled", "unknown")),
                universal_ssl_status=str(universal_ssl.get("certificate_status", universal_ssl.get("status", "unknown"))),
                ssl_mode=str(ssl_setting.get("value", "unknown")),
                desired_records=len(records),
                existing_target_records=len(existing_at_names),
                delete_candidates=sum(1 for row in delete_rows if row["domain"] == domain),
                preserve_review_records=sum(1 for row in preserve_rows if row["domain"] == domain),
                already_correct_records=already_correct,
                missing_records=sum(1 for row in add_rows if row["domain"] == domain),
                risk_flags=";".join(risk_flags),
                next_action=next_action,
            )
        )

    write_csv(output_dir / "desired_kinsta_cnames.csv", desired, list(DesiredRecord.__annotations__.keys()))
    write_csv(output_dir / "current_target_name_records.csv", existing_rows, list(ExistingRecord.__annotations__.keys()))
    write_csv(output_dir / "planned_delete_conflicts.csv", delete_rows, ["site", "domain", "zone_id", "record_id", "type", "name", "content", "proxied", "ttl", "status"])
    write_csv(output_dir / "planned_add_kinsta_cnames.csv", add_rows, ["site", "domain", "zone_id", "type", "name", "content", "ttl", "proxied", "status"])
    write_csv(output_dir / "preserve_review_records.csv", preserve_rows, ["site", "domain", "zone_id", "type", "name", "content", "status"])
    write_csv(
        output_dir / "forwarding_review_rules.csv",
        forwarding_rows,
        ["site", "domain", "zone_id", "source", "ruleset_id", "rule_id", "ref", "enabled", "description", "expression", "action", "action_parameters", "status"],
    )
    write_csv(output_dir / "dns_switch_plan.csv", plan_rows, list(PlanRow.__annotations__.keys()))
    write_json(output_dir / "cloudflare_zone_dns_snapshot.json", zone_snapshots)

    summary = {
        "run_type": "kinsta_dns_switch_prep",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "credential_source": resolved.source,
        "mutations_performed": False,
        "input_csv": str(args.csv),
        "domains": len(desired_by_domain),
        "desired_records": len(desired),
        "zones_missing": sum(1 for row in plan_rows if row.zone_status == "missing"),
        "delete_candidates": len(delete_rows),
        "add_candidates": len(add_rows),
        "preserve_review_records": len(preserve_rows),
        "forwarding_review_rules": len(forwarding_rows),
        "already_correct_records": sum(row.already_correct_records for row in plan_rows),
        "universal_ssl_disabled": [row.domain for row in plan_rows if row.universal_ssl_enabled == "False"],
        "risk_domains": [row.domain for row in plan_rows if row.risk_flags],
        "output_dir": str(output_dir),
    }
    write_json(output_dir / "summary.json", summary)

    lines = [
        "# Kinsta DNS Switch Prep",
        "",
        f"Generated UTC: `{summary['generated_at_utc']}`",
        "",
        "No Cloudflare mutations were performed.",
        "",
        f"- Domains: `{summary['domains']}`",
        f"- Desired CNAME records: `{summary['desired_records']}`",
        f"- Planned website-record deletes: `{summary['delete_candidates']}`",
        f"- Planned Kinsta CNAME adds: `{summary['add_candidates']}`",
        f"- Already-correct records: `{summary['already_correct_records']}`",
        f"- Preserve/review non-website records at target names: `{summary['preserve_review_records']}`",
        f"- Forwarding rules requiring review: `{summary['forwarding_review_rules']}`",
        f"- Missing zones: `{summary['zones_missing']}`",
        f"- Risk domains: `{len(summary['risk_domains'])}`",
        "",
        "Execution rule: delete only planned conflicting website records, preserve non-website records for review, add the Kinsta CNAMEs, then QA apex and www before legacy forwarding.",
    ]
    (output_dir / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
