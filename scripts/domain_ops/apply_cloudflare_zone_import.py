#!/usr/bin/env python3
"""Apply a prepared Cloudflare redirect-only domain import packet.

The script is intentionally resumable and scoped. Cloudflare preparation creates
or reuses zones, writes the approved activation DNS records, and installs
Domain Ops-managed Single Redirect rules. GoDaddy nameserver cutover is a
separate phase because GoDaddy v3 requires a PAT with nameserver-update scope.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib import error, parse, request


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ops.cloudflare.cloudflare_auth import resolve_cloudflare_token
from utils.godaddy_auth import resolve_godaddy_pat
from utils.ksm import KsmResolutionError


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
GODADDY_API_BASE = "https://api.godaddy.com"
DOMAINOPS_RULE_REF_PREFIX = "domainops_vanity_redirect_"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"


@dataclass
class ApplyRow:
    domain: str
    stage: str
    status: str
    zone_id_present: int
    cloudflare_zone_status: str
    cloudflare_nameservers: str
    dns_created: int
    dns_existing: int
    dns_conflicts: int
    redirect_rules_managed: int
    nameserver_operation_id: str
    error: str


def latest_import_plan() -> Path:
    candidates = sorted(DEFAULT_REPORT_ROOT.glob("*_cloudflare_import_plan/summary.json"))
    if not candidates:
        raise SystemExit("No Cloudflare import plan found under reports/domain_ops.")
    return candidates[-1].parent


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def write_csv(path: Path, rows: list[ApplyRow]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(ApplyRow.__annotations__.keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def compact_error(payload: Any) -> str:
    if isinstance(payload, dict):
        errors = payload.get("errors")
        if errors:
            return json.dumps(errors, sort_keys=True)[:700]
        messages = payload.get("messages")
        if messages:
            return json.dumps(messages, sort_keys=True)[:700]
    return str(payload)[:700]


class CloudflareClient:
    def __init__(self, token: str, spacing_seconds: float = 0.25) -> None:
        self.token = token
        self.spacing_seconds = spacing_seconds
        self.last_request_at = 0.0

    def api(self, method: str, path: str, payload: Optional[dict[str, Any]] = None, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        query = f"?{parse.urlencode(params)}" if params else ""
        data = None
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "User-Agent": "PropertyAnalytics-DomainOps/1.0",
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elapsed = time.monotonic() - self.last_request_at
        if elapsed < self.spacing_seconds:
            time.sleep(self.spacing_seconds - elapsed)
        req = request.Request(f"{CLOUDFLARE_API_BASE}{path}{query}", data=data, headers=headers, method=method)
        try:
            with request.urlopen(req, timeout=45) as resp:
                self.last_request_at = time.monotonic()
                return json.loads(resp.read().decode("utf-8"))
        except error.HTTPError as exc:
            self.last_request_at = time.monotonic()
            body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = body
            raise RuntimeError(f"Cloudflare {method} {path} failed status={exc.code}: {compact_error(parsed)}") from exc

    def account_id(self, configured: Optional[str]) -> str:
        if configured:
            return configured
        payload = self.api("GET", "/accounts", params={"page": 1, "per_page": 50})
        accounts = payload.get("result") or []
        if not payload.get("success") or not accounts:
            raise RuntimeError("Cloudflare account lookup returned no usable account.")
        if len(accounts) > 1:
            names = ", ".join(str(account.get("name") or "unnamed") for account in accounts)
            raise RuntimeError(f"Multiple Cloudflare accounts visible; rerun with --cloudflare-account-id. Accounts: {names}")
        account_id = str(accounts[0].get("id") or "")
        if not account_id:
            raise RuntimeError("Cloudflare account lookup did not return an account id.")
        return account_id

    def find_zone(self, domain: str) -> Optional[dict[str, Any]]:
        payload = self.api("GET", "/zones", params={"name": domain, "page": 1, "per_page": 50})
        zones = payload.get("result") or []
        return zones[0] if zones else None

    def create_zone(self, domain: str, account_id: str) -> dict[str, Any]:
        payload = self.api(
            "POST",
            "/zones",
            {
                "name": domain,
                "account": {"id": account_id},
                "jump_start": False,
                "type": "full",
            },
        )
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare zone create failed for {domain}: {compact_error(payload)}")
        return payload["result"]

    def list_dns(self, zone_id: str, name: str, record_type: str) -> list[dict[str, Any]]:
        payload = self.api("GET", f"/zones/{zone_id}/dns_records", params={"name": name, "type": record_type, "per_page": 100})
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare DNS list failed for {name}: {compact_error(payload)}")
        return list(payload.get("result") or [])

    def create_dns(self, zone_id: str, record: dict[str, Any]) -> dict[str, Any]:
        payload = self.api("POST", f"/zones/{zone_id}/dns_records", record)
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare DNS create failed for {record.get('name')}: {compact_error(payload)}")
        return payload["result"]

    def entrypoint_ruleset(self, zone_id: str) -> Optional[dict[str, Any]]:
        try:
            payload = self.api("GET", f"/zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint")
        except RuntimeError as exc:
            if "status=404" in str(exc):
                return None
            raise
        if not payload.get("success"):
            return None
        return payload.get("result")

    def put_redirect_ruleset(self, zone_id: str, rules: list[dict[str, Any]], ruleset_id: Optional[str]) -> dict[str, Any]:
        body = {
            "name": "Domain Ops vanity redirects",
            "kind": "zone",
            "phase": "http_request_dynamic_redirect",
            "rules": rules,
        }
        path = f"/zones/{zone_id}/rulesets/{ruleset_id}" if ruleset_id else f"/zones/{zone_id}/rulesets"
        method = "PUT" if ruleset_id else "POST"
        payload = self.api(method, path, body)
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare redirect ruleset update failed: {compact_error(payload)}")
        return payload["result"]


class GoDaddyV3Client:
    def __init__(self, pat: str, spacing_seconds: float = 1.1) -> None:
        self.pat = pat
        self.spacing_seconds = spacing_seconds
        self.last_request_at = 0.0

    def api(self, method: str, path: str, payload: Optional[Any] = None, idempotency_key: Optional[str] = None) -> dict[str, Any]:
        data = None
        headers = {
            "Authorization": f"Bearer {self.pat}",
            "Accept": "application/json",
            "User-Agent": "PropertyAnalytics-DomainOps/1.0",
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        elapsed = time.monotonic() - self.last_request_at
        if elapsed < self.spacing_seconds:
            time.sleep(self.spacing_seconds - elapsed)
        req = request.Request(f"{GODADDY_API_BASE}{path}", data=data, headers=headers, method=method)
        try:
            with request.urlopen(req, timeout=45) as resp:
                self.last_request_at = time.monotonic()
                body = resp.read()
                return json.loads(body.decode("utf-8")) if body else {}
        except error.HTTPError as exc:
            self.last_request_at = time.monotonic()
            body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = body
            raise RuntimeError(f"GoDaddy {method} {path} failed status={exc.code}: {compact_error(parsed)}") from exc

    def replace_nameservers(self, domain: str, nameservers: list[str], idempotency_key: str) -> dict[str, Any]:
        return self.api("PUT", f"/v3/domains/domain-names/{domain}/nameservers", nameservers, idempotency_key=idempotency_key)

    def poll_operation(self, operation_id: str, *, timeout_seconds: int = 120) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_seconds
        last_payload: dict[str, Any] = {}
        while time.monotonic() < deadline:
            last_payload = self.api("GET", f"/v3/domains/operations/{operation_id}")
            status = str(last_payload.get("status") or "").upper()
            if status in {"COMPLETED", "FAILED"}:
                return last_payload
            time.sleep(5)
        return last_payload


def domainops_rule_ref(fqdn: str) -> str:
    safe = "".join(ch if ch.isalnum() else "_" for ch in fqdn.lower())
    return f"{DOMAINOPS_RULE_REF_PREFIX}{safe}"[:128]


def managed_redirect_rules(domain: str, redirect_payload: dict[str, Any]) -> list[dict[str, Any]]:
    output = []
    for rule in redirect_payload.get("rules") or []:
        managed = {
            "ref": domainops_rule_ref(rule["expression"].split('"')[1]),
            "description": rule.get("description") or f"Domain Ops redirect for {domain}",
            "expression": rule["expression"],
            "action": "redirect",
            "action_parameters": rule["action_parameters"],
            "enabled": True,
        }
        output.append(managed)
    return output


def desired_dns_records(dns_payload: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    records.extend(list(dns_payload.get("activation_records") or []))
    records.extend(list(dns_payload.get("preserve_records") or []))
    records.extend(list(dns_payload.get("planned_records") or []))
    deduped: dict[str, dict[str, Any]] = {}
    for record in records:
        key = json.dumps(
            {
                "type": record.get("type"),
                "name": record.get("name"),
                "content": record.get("content"),
                "priority": record.get("priority"),
                "proxied": record.get("proxied"),
            },
            sort_keys=True,
        )
        deduped[key] = record
    return list(deduped.values())


def cloudflare_dns_record_payload(source_record: dict[str, Any]) -> dict[str, Any]:
    record = {
        "type": source_record["type"],
        "name": source_record["name"],
        "content": source_record["content"],
        "ttl": source_record["ttl"],
    }
    if "proxied" in source_record:
        record["proxied"] = bool(source_record.get("proxied"))
    if source_record.get("priority") is not None:
        record["priority"] = int(source_record["priority"])
    return record


def allows_parallel_records(record_type: str) -> bool:
    return record_type.upper() in {"A", "AAAA", "TXT", "MX"}


def reconcile_dns(client: CloudflareClient, zone_id: str, records: list[dict[str, Any]], apply: bool) -> tuple[int, int, int, list[dict[str, Any]]]:
    created = 0
    existing = 0
    conflicts = 0
    details = []
    for source_record in records:
        record = cloudflare_dns_record_payload(source_record)
        current = client.list_dns(zone_id, record["name"], record["type"])
        matching = [
            item
            for item in current
            if str(item.get("content")) == str(record["content"])
            and bool(item.get("proxied")) == bool(record.get("proxied"))
            and (record.get("priority") is None or int(item.get("priority") or 0) == int(record.get("priority") or 0))
        ]
        if matching:
            existing += 1
            details.append({"name": record["name"], "type": record["type"], "status": "existing"})
            continue
        if current and (bool(record.get("proxied")) or not allows_parallel_records(str(record["type"]))):
            conflicts += 1
            details.append({"name": record["name"], "type": record["type"], "status": "conflict_existing_record"})
            continue
        if apply:
            client.create_dns(zone_id, record)
            created += 1
            details.append({"name": record["name"], "type": record["type"], "status": "created"})
        else:
            details.append({"name": record["name"], "type": record["type"], "status": "would_create"})
    return created, existing, conflicts, details


def reconcile_redirects(client: CloudflareClient, zone_id: str, domain: str, redirect_payload: dict[str, Any], apply: bool) -> tuple[int, list[dict[str, Any]]]:
    desired = managed_redirect_rules(domain, redirect_payload)
    if not desired:
        return 0, []
    current = client.entrypoint_ruleset(zone_id)
    current_rules = list((current or {}).get("rules") or [])
    retained = [rule for rule in current_rules if not str(rule.get("ref") or "").startswith(DOMAINOPS_RULE_REF_PREFIX)]
    merged_by_ref = {str(rule["ref"]): rule for rule in desired}
    merged = retained + list(merged_by_ref.values())
    if apply:
        client.put_redirect_ruleset(zone_id, merged, (current or {}).get("id"))
    return len(desired), [{"ref": rule["ref"], "expression": rule["expression"]} for rule in desired]


def nameservers_from_zone(zone: dict[str, Any]) -> list[str]:
    return [str(item).strip().lower() for item in (zone.get("name_servers") or []) if str(item).strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply a Cloudflare redirect-only import packet.")
    parser.add_argument("--import-plan-dir", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--cloudflare-account-id")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--domain", action="append", help="Limit to one or more domains.")
    parser.add_argument("--domain-file", type=Path, help="One domain per line to select from the import plan.")
    parser.add_argument("--only-delegate-now", action="store_true", help="Only include plan rows with delegate_now_recommended=1.")
    parser.add_argument("--only-not-in-cloudflare", action="store_true", help="Only include plan rows not already known in Cloudflare inventory.")
    parser.add_argument("--apply-cloudflare", action="store_true")
    parser.add_argument("--apply-godaddy-nameservers", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()

    cloudflare_confirms = {"APPLY_CLOUDFLARE_REDIRECT_DOMAINS", "APPLY_CLOUDFLARE_DOMAINS"}
    if args.apply_cloudflare and args.confirm not in cloudflare_confirms:
        raise SystemExit("Cloudflare apply requires --confirm APPLY_CLOUDFLARE_DOMAINS")
    if args.apply_godaddy_nameservers and args.confirm != "APPLY_GODADDY_NAMESERVERS":
        raise SystemExit("GoDaddy nameserver apply requires --confirm APPLY_GODADDY_NAMESERVERS")
    if args.apply_cloudflare and args.apply_godaddy_nameservers:
        raise SystemExit("Run Cloudflare preparation and GoDaddy nameserver cutover as separate phases.")

    plan_dir = args.import_plan_dir or latest_import_plan()
    plan_rows = load_csv(plan_dir / "domain_import_plan.csv")
    selected_domains = {domain.lower() for domain in args.domain or []}
    if args.domain_file:
        selected_domains.update(
            line.strip().lower()
            for line in args.domain_file.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        )
    if selected_domains:
        plan_rows = [row for row in plan_rows if row["domain"].lower() in selected_domains]
    if args.only_delegate_now:
        plan_rows = [row for row in plan_rows if str(row.get("delegate_now_recommended") or "").strip() == "1"]
    if args.only_not_in_cloudflare:
        plan_rows = [
            row
            for row in plan_rows
            if str(row.get("cloudflare_zone_status") or "").strip() not in {"account_inventory_known", "local_snapshot_known"}
        ]
    if args.limit:
        plan_rows = plan_rows[: args.limit]
    if not plan_rows:
        raise SystemExit("No domain plan rows selected.")

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_cloudflare_apply")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    resolved_cf = resolve_cloudflare_token()
    cf = CloudflareClient(resolved_cf.token)
    account_id = cf.account_id(args.cloudflare_account_id)
    godaddy: Optional[GoDaddyV3Client] = None
    godaddy_auth_source = None
    if args.apply_godaddy_nameservers:
        try:
            pat, godaddy_auth_source = resolve_godaddy_pat()
        except KsmResolutionError as exc:
            raise SystemExit(f"GoDaddy nameserver credential missing: {exc}") from exc
        godaddy = GoDaddyV3Client(pat)

    rows: list[ApplyRow] = []
    details: dict[str, Any] = {
        "run_type": "cloudflare_import_apply",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "import_plan_dir": str(plan_dir),
        "cloudflare_credential_source": resolved_cf.source,
        "godaddy_credential_source": godaddy_auth_source,
        "godaddy_idempotency_scope": run_id if args.apply_godaddy_nameservers else None,
        "apply_cloudflare": args.apply_cloudflare,
        "apply_godaddy_nameservers": args.apply_godaddy_nameservers,
        "target_strategy": "current_live",
        "city_state_targets_applied": False,
        "domains": {},
    }

    for plan_row in plan_rows:
        domain = plan_row["domain"].lower()
        try:
            dns_payload = json.loads((plan_dir / plan_row["dns_payload_file"]).read_text(encoding="utf-8"))
            redirect_payload = json.loads((plan_dir / plan_row["redirect_payload_file"]).read_text(encoding="utf-8"))
            zone = cf.find_zone(domain)
            zone_created = False
            if not zone:
                if args.apply_cloudflare:
                    zone = cf.create_zone(domain, account_id)
                    zone_created = True
                else:
                    zone = {"id": "", "status": "would_create", "name_servers": []}
            zone_id = str(zone.get("id") or "")
            dns_created = dns_existing = dns_conflicts = redirect_count = 0
            dns_details: list[dict[str, Any]] = []
            redirect_details: list[dict[str, Any]] = []
            operation_id = ""
            if zone_id and (args.apply_cloudflare or not args.apply_godaddy_nameservers):
                dns_created, dns_existing, dns_conflicts, dns_details = reconcile_dns(
                    cf,
                    zone_id,
                    desired_dns_records(dns_payload),
                    args.apply_cloudflare,
                )
                redirect_count, redirect_details = reconcile_redirects(cf, zone_id, domain, redirect_payload, args.apply_cloudflare)
            cloudflare_ns = nameservers_from_zone(zone)
            if args.apply_godaddy_nameservers:
                if not cloudflare_ns:
                    raise RuntimeError("Cloudflare zone does not expose nameservers yet.")
                assert godaddy is not None
                idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"domainops:{run_id}:{domain}:{','.join(cloudflare_ns)}"))
                response = godaddy.replace_nameservers(domain, cloudflare_ns, idempotency_key)
                operation_id = str(response.get("operationId") or response.get("id") or "")
                if operation_id:
                    poll_payload = godaddy.poll_operation(operation_id)
                    details.setdefault("godaddy_operations", {})[operation_id] = {
                        "domain": domain,
                        "status": poll_payload.get("status"),
                        "type": poll_payload.get("type"),
                        "error": poll_payload.get("error"),
                    }
                    operation_status = str(poll_payload.get("status") or "").upper()
                    if operation_status == "FAILED":
                        raise RuntimeError(f"GoDaddy nameserver operation failed: {compact_error(poll_payload.get('error') or poll_payload)}")
                    if operation_status != "COMPLETED":
                        raise RuntimeError(f"GoDaddy nameserver operation did not complete before timeout: status={operation_status or 'unknown'}")
            details["domains"][domain] = {
                "zone_created": zone_created,
                "zone_id_present": bool(zone_id),
                "cloudflare_zone_status": zone.get("status"),
                "cloudflare_nameservers": cloudflare_ns,
                "dns": dns_details,
                "redirects": redirect_details,
                "nameserver_operation_id": operation_id,
            }
            rows.append(
                ApplyRow(
                    domain=domain,
                    stage="godaddy_nameservers" if args.apply_godaddy_nameservers else "cloudflare_prepare",
                    status="applied" if (args.apply_cloudflare or args.apply_godaddy_nameservers) else "dry_run",
                    zone_id_present=1 if zone_id else 0,
                    cloudflare_zone_status=str(zone.get("status") or ""),
                    cloudflare_nameservers=";".join(cloudflare_ns),
                    dns_created=dns_created,
                    dns_existing=dns_existing,
                    dns_conflicts=dns_conflicts,
                    redirect_rules_managed=redirect_count,
                    nameserver_operation_id=operation_id,
                    error="",
                )
            )
        except Exception as exc:
            details["domains"][domain] = {"error": str(exc)}
            rows.append(
                ApplyRow(
                    domain=domain,
                    stage="godaddy_nameservers" if args.apply_godaddy_nameservers else "cloudflare_prepare",
                    status="failed",
                    zone_id_present=0,
                    cloudflare_zone_status="",
                    cloudflare_nameservers="",
                    dns_created=0,
                    dns_existing=0,
                    dns_conflicts=0,
                    redirect_rules_managed=0,
                    nameserver_operation_id="",
                    error=str(exc)[:700],
                )
            )

    summary = {
        "output_dir": str(output_dir),
        "import_plan_dir": str(plan_dir),
        "apply_cloudflare": args.apply_cloudflare,
        "apply_godaddy_nameservers": args.apply_godaddy_nameservers,
        "domains_selected": len(plan_rows),
        "domains_applied": sum(1 for row in rows if row.status == "applied"),
        "domains_failed": sum(1 for row in rows if row.status == "failed"),
        "dns_created": sum(row.dns_created for row in rows),
        "dns_existing": sum(row.dns_existing for row in rows),
        "dns_conflicts": sum(row.dns_conflicts for row in rows),
        "redirect_rules_managed": sum(row.redirect_rules_managed for row in rows),
        "nameserver_operations_started": sum(1 for row in rows if row.nameserver_operation_id),
        "city_state_targets_applied": False,
        "target_strategy": "current_live",
    }
    details["summary"] = summary
    write_csv(output_dir / "apply_results.csv", rows)
    write_json(output_dir / "apply_details.json", details)
    write_json(output_dir / "summary.json", summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["domains_failed"] == 0 and summary["dns_conflicts"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
