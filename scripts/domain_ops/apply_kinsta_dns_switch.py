#!/usr/bin/env python3
"""Apply a reviewed Kinsta DNS switch packet in Cloudflare.

Default mode is dry-run and performs no Cloudflare mutations. Use --apply only
after the corresponding prep packet has been reviewed and approved.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
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
WEBSITE_CONFLICT_TYPES = {"A", "AAAA", "CNAME"}


@dataclass
class ApplyResult:
    domain: str
    stage: str
    status: str
    deletes_completed: int
    adds_completed: int
    error: str


class CloudflareClient:
    def __init__(self, token: str, spacing_seconds: float = 0.2) -> None:
        self.token = token
        self.spacing_seconds = spacing_seconds
        self.last_request_at = 0.0

    def api(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
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
        req = urllib.request.Request(f"{CLOUDFLARE_API_BASE}{path}{query}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                self.last_request_at = time.monotonic()
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            self.last_request_at = time.monotonic()
            body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = body
            raise RuntimeError(f"Cloudflare {method} {path} failed status={exc.code}: {compact_error(parsed)}") from exc

    def delete_dns_record(self, zone_id: str, record_id: str) -> None:
        payload = self.api("DELETE", f"/zones/{zone_id}/dns_records/{record_id}")
        if not payload.get("success"):
            raise RuntimeError(f"DNS delete failed for record {record_id}: {compact_error(payload)}")

    def list_name_records(self, zone_id: str, name: str) -> list[dict[str, Any]]:
        payload = self.api("GET", f"/zones/{zone_id}/dns_records", params={"name": name, "per_page": 100})
        if not payload.get("success"):
            raise RuntimeError(f"DNS record lookup failed for {name}: {compact_error(payload)}")
        return list(payload.get("result") or [])

    def create_dns_record(self, zone_id: str, record: dict[str, Any]) -> dict[str, Any]:
        payload = self.api("POST", f"/zones/{zone_id}/dns_records", payload=record)
        if not payload.get("success"):
            raise RuntimeError(f"DNS create failed for {record.get('name')}: {compact_error(payload)}")
        return payload["result"]

    def dynamic_redirect_entrypoint(self, zone_id: str) -> dict[str, Any] | None:
        try:
            payload = self.api("GET", f"/zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint")
        except RuntimeError as exc:
            if "status=404" in str(exc):
                return None
            raise
        if not payload.get("success"):
            return None
        result = payload.get("result")
        return result if isinstance(result, dict) else None

    def update_dynamic_redirect_entrypoint(self, zone_id: str, ruleset_id: str, rules: list[dict[str, Any]]) -> dict[str, Any]:
        payload = self.api(
            "PUT",
            f"/zones/{zone_id}/rulesets/{ruleset_id}",
            payload={
                "name": "Domain Ops vanity redirects",
                "kind": "zone",
                "phase": "http_request_dynamic_redirect",
                "rules": rules,
            },
        )
        if not payload.get("success"):
            raise RuntimeError(f"Redirect ruleset update failed for zone {zone_id}: {compact_error(payload)}")
        return payload["result"]


def compact_error(payload: Any) -> str:
    if isinstance(payload, dict):
        if payload.get("errors"):
            return json.dumps(payload["errors"], sort_keys=True)[:700]
        if payload.get("messages"):
            return json.dumps(payload["messages"], sort_keys=True)[:700]
    return str(payload)[:700]


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return [{key: (value or "").strip() for key, value in row.items()} for row in csv.DictReader(handle)]


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def write_csv(path: Path, rows: list[ApplyResult]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(ApplyResult.__annotations__.keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def filter_domain(rows: list[dict[str, str]], domains: set[str]) -> list[dict[str, str]]:
    if not domains:
        return rows
    return [row for row in rows if row.get("domain", "").lower() in domains]


def exact_cname_exists(records: list[dict[str, Any]], name: str, content: str) -> bool:
    return any(
        str(record.get("type") or "").upper() == "CNAME"
        and str(record.get("name") or "").lower().rstrip(".") == name.lower().rstrip(".")
        and str(record.get("content") or "").lower().rstrip(".") == content.lower().rstrip(".")
        for record in records
    )


def website_conflicts(records: list[dict[str, Any]], desired_content: str) -> list[dict[str, Any]]:
    conflicts = []
    for record in records:
        record_type = str(record.get("type") or "").upper()
        content = str(record.get("content") or "").lower().rstrip(".")
        if record_type in WEBSITE_CONFLICT_TYPES and not (record_type == "CNAME" and content == desired_content.lower().rstrip(".")):
            conflicts.append(record)
    return conflicts


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply reviewed Cloudflare Kinsta DNS switch packet.")
    parser.add_argument("--prep-dir", required=True, type=Path, help="Prep packet directory from build_kinsta_dns_switch_prep.py.")
    parser.add_argument("--domain", action="append", default=[], help="Optional domain subset. Repeatable.")
    parser.add_argument("--delete-forwarding-rules", action="store_true", help="Remove reviewed Domain Ops Cloudflare redirect rules listed in forwarding_review_rules.csv.")
    parser.add_argument("--apply", action="store_true", help="Perform Cloudflare DNS mutations. Omit for dry-run.")
    parser.add_argument("--output-dir", type=Path, help="Output directory. Defaults under reports/domain_ops.")
    args = parser.parse_args()

    delete_path = args.prep_dir / "planned_delete_conflicts.csv"
    add_path = args.prep_dir / "planned_add_kinsta_cnames.csv"
    forwarding_path = args.prep_dir / "forwarding_review_rules.csv"
    if not delete_path.exists() or not add_path.exists():
        raise SystemExit(f"Prep directory is missing required plan files: {args.prep_dir}")

    domains = {domain.lower().strip() for domain in args.domain if domain.strip()}
    delete_rows = filter_domain(load_csv(delete_path), domains)
    add_rows = filter_domain(load_csv(add_path), domains)
    forwarding_rows = filter_domain(load_csv(forwarding_path), domains) if forwarding_path.exists() else []

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_kinsta_dns_switch_apply")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    summary: dict[str, Any] = {
        "run_type": "kinsta_dns_switch_apply",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "prep_dir": str(args.prep_dir),
        "mode": "apply" if args.apply else "dry_run",
        "mutations_performed": False,
        "domains": sorted(set(row["domain"] for row in [*delete_rows, *add_rows])),
        "planned_deletes": len(delete_rows),
        "planned_adds": len(add_rows),
        "planned_forwarding_rule_deletes": len(forwarding_rows) if args.delete_forwarding_rules else 0,
        "forwarding_rules_present": len(forwarding_rows),
        "forwarding_cleanup_requested": args.delete_forwarding_rules,
        "output_dir": str(output_dir),
    }

    if not args.apply:
        write_json(output_dir / "summary.json", summary)
        print(json.dumps(summary, indent=2, sort_keys=True))
        return 0

    try:
        resolved = resolve_cloudflare_token()
    except CloudflareAuthError as exc:
        raise SystemExit(f"Cloudflare credential resolution failed: {exc}") from exc

    client = CloudflareClient(resolved.token)
    summary["credential_source"] = resolved.source
    results: list[ApplyResult] = []
    completed_delete_records: list[dict[str, str]] = []
    completed_add_records: list[dict[str, Any]] = []
    completed_forwarding_rules: list[dict[str, str]] = []

    try:
        if args.delete_forwarding_rules:
            rows_by_zone: dict[tuple[str, str], list[dict[str, str]]] = {}
            for row in forwarding_rows:
                if row.get("source") != "dynamic_redirect_ruleset":
                    raise RuntimeError(f"Unsupported forwarding cleanup source for {row.get('domain')}: {row.get('source')}")
                rows_by_zone.setdefault((row["zone_id"], row["ruleset_id"]), []).append(row)
            for (zone_id, ruleset_id), rows in rows_by_zone.items():
                entrypoint = client.dynamic_redirect_entrypoint(zone_id)
                if not entrypoint:
                    continue
                current_rules = list(entrypoint.get("rules") or [])
                remove_ids = {row["rule_id"] for row in rows if row.get("rule_id")}
                remove_refs = {row["ref"] for row in rows if row.get("ref")}
                kept_rules = [
                    rule
                    for rule in current_rules
                    if str(rule.get("id") or "") not in remove_ids and str(rule.get("ref") or "") not in remove_refs
                ]
                removed_count = len(current_rules) - len(kept_rules)
                if removed_count:
                    client.update_dynamic_redirect_entrypoint(zone_id, ruleset_id, kept_rules)
                    completed_forwarding_rules.extend(rows)
                for row in rows:
                    results.append(ApplyResult(row["domain"], "delete_forwarding_rule", "completed" if removed_count else "already_absent", 0, 0, ""))

        for row in delete_rows:
            client.delete_dns_record(row["zone_id"], row["record_id"])
            completed_delete_records.append(row)
            results.append(ApplyResult(row["domain"], "delete_conflict", "completed", 1, 0, ""))

        for row in add_rows:
            name = row["name"].lower().rstrip(".")
            content = row["content"].lower().rstrip(".")
            existing = client.list_name_records(row["zone_id"], name)
            if exact_cname_exists(existing, name, content):
                results.append(ApplyResult(row["domain"], "add_cname", "already_exists", 0, 0, ""))
                continue
            conflicts = website_conflicts(existing, content)
            if conflicts:
                names = ", ".join(f"{record.get('type')}:{record.get('name')}->{record.get('content')}" for record in conflicts)
                raise RuntimeError(f"Unplanned website DNS conflict remains for {name}: {names}")
            created = client.create_dns_record(
                row["zone_id"],
                {
                    "type": "CNAME",
                    "name": name,
                    "content": content,
                    "ttl": int(row.get("ttl") or 1),
                    "proxied": str(row.get("proxied")).lower() == "true",
                },
            )
            completed_add_records.append(created)
            results.append(ApplyResult(row["domain"], "add_cname", "completed", 0, 1, ""))
    except Exception as exc:
        results.append(ApplyResult("batch", "abort", "failed", len(completed_delete_records), len(completed_add_records), str(exc)))
        summary["mutations_performed"] = bool(completed_delete_records or completed_add_records)
        summary["status"] = "failed"
        summary["error"] = str(exc)
        summary["completed_deletes"] = len(completed_delete_records)
        summary["completed_adds"] = len(completed_add_records)
        summary["completed_forwarding_rule_deletes"] = len(completed_forwarding_rules)
        write_csv(output_dir / "apply-results.csv", results)
        write_json(output_dir / "summary.json", summary)
        write_json(output_dir / "created_records.json", completed_add_records)
        raise SystemExit(json.dumps(summary, indent=2, sort_keys=True)) from exc

    summary["mutations_performed"] = True
    summary["status"] = "completed"
    summary["completed_deletes"] = len(completed_delete_records)
    summary["completed_adds"] = len(completed_add_records)
    summary["completed_forwarding_rule_deletes"] = len(completed_forwarding_rules)
    write_csv(output_dir / "apply-results.csv", results)
    write_json(output_dir / "summary.json", summary)
    write_json(output_dir / "created_records.json", completed_add_records)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
