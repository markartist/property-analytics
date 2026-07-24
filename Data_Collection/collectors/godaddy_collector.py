#!/usr/bin/env python3
"""GoDaddy domain and DNS inventory collector.

This collector is intentionally read-only. It snapshots GoDaddy source payloads
into the canonical portfolio SQLite database so launch work can reason from the
complete registrar/DNS state without introducing a parallel credential path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import time
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.utils.property_identity import resolve_property_identity
from utils.godaddy_auth import resolve_godaddy_credentials, resolve_godaddy_customer_id


GODADDY_API_BASE = "https://api.godaddy.com"


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _bool_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    return 1 if bool(value) else 0


def _as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _record_hash(record: dict[str, Any]) -> str:
    material = _json(record)
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


@dataclass
class GoDaddyCollectorSettings:
    db_path: Optional[Path] = None
    request_timeout_seconds: int = 30
    request_spacing_seconds: float = 1.1
    max_retries: int = 3
    per_page_limit: int = 1000
    user_agent: str = "PropertyAnalytics-GoDaddyCollector/1.0"


class GoDaddyCollector:
    """Collect GoDaddy domain detail and DNS records into SQLite."""

    def __init__(
        self,
        settings: Optional[GoDaddyCollectorSettings] = None,
        db: Optional[DatabaseManager] = None,
        logger: Optional[logging.Logger] = None,
    ):
        self.settings = settings or GoDaddyCollectorSettings()
        self.db = db or DatabaseManager(self.settings.db_path)
        self.logger = logger or self._build_logger()
        self.session: Optional[requests.Session] = None
        self.last_request_at = 0.0

    @staticmethod
    def _build_logger() -> logging.Logger:
        logger = logging.getLogger("godaddy_collector")
        if logger.handlers:
            return logger
        logger.setLevel(logging.INFO)
        log_dir = ROOT / "Data_Collection" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_dir / "godaddy_collector.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler(sys.stdout))
        return logger

    def _ensure_session(self) -> requests.Session:
        if self.session is not None:
            return self.session
        credentials = resolve_godaddy_credentials()
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "User-Agent": self.settings.user_agent,
            }
        )
        self.session = session
        self.logger.info("GoDaddy credentials resolved from %s", credentials.source)
        return session

    def _request_json(self, path: str, *, allowed_statuses: Optional[set[int]] = None) -> tuple[int, Any]:
        session = self._ensure_session()
        url = f"{GODADDY_API_BASE}{path}"
        last_error: Optional[Exception] = None
        allowed_statuses = allowed_statuses or set()
        for attempt in range(1, self.settings.max_retries + 1):
            elapsed = time.monotonic() - self.last_request_at
            if elapsed < self.settings.request_spacing_seconds:
                time.sleep(self.settings.request_spacing_seconds - elapsed)
            response: Optional[requests.Response] = None
            try:
                response = session.get(url, timeout=self.settings.request_timeout_seconds)
                self.last_request_at = time.monotonic()
                if response.status_code == 429 and attempt < self.settings.max_retries:
                    retry_after = _as_int(response.headers.get("Retry-After")) or 5
                    time.sleep(max(retry_after, self.settings.request_spacing_seconds))
                    continue
                if response.status_code in allowed_statuses:
                    payload = response.json() if response.content else None
                    return response.status_code, payload
                response.raise_for_status()
                return response.status_code, response.json() if response.content else None
            except Exception as exc:
                last_error = exc
                if attempt >= self.settings.max_retries:
                    status = response.status_code if response is not None else 0
                    body = ""
                    if response is not None:
                        body = response.text[:500]
                    raise RuntimeError(f"GoDaddy request failed for {path}: status={status} {body}") from exc
                time.sleep(2 * attempt)
        raise RuntimeError(f"GoDaddy request failed for {path}: {last_error}")

    def list_domains(self) -> list[dict[str, Any]]:
        status, payload = self._request_json(f"/v1/domains?limit={self.settings.per_page_limit}")
        if status != 200 or not isinstance(payload, list):
            raise RuntimeError(f"Unexpected GoDaddy domain list response status={status}")
        return payload

    def _snapshot_domains(self, snapshot_date: date) -> list[str]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT domain
                FROM godaddy_domain_snapshots
                WHERE snapshot_date = ?
                ORDER BY domain
                """,
                (snapshot_date.isoformat(),),
            ).fetchall()
        return [str(row["domain"]) for row in rows]

    def _resolve_forwarding_customer_id(
        self,
        customer_id: Optional[str] = None,
        customer_id_source: Optional[str] = None,
    ) -> tuple[str, str]:
        if customer_id:
            candidate = customer_id.strip()
            source = customer_id_source or "current task argument"
        else:
            candidate, source = resolve_godaddy_customer_id()
        if not candidate:
            raise RuntimeError("GoDaddy forwarding collection requires a customer/shopper id")

        if candidate.isdigit():
            status, payload = self._request_json(
                f"/v1/shoppers/{quote(candidate, safe='')}?includes=customerId",
                allowed_statuses={400, 401, 403, 404, 422},
            )
            if status == 200 and isinstance(payload, dict) and payload.get("customerId"):
                return str(payload["customerId"]), f"{source}; shopper_id_to_customer_id"
            raise RuntimeError(
                "GoDaddy forwarding collection could not derive customerId from shopperId "
                f"(shopper lookup status={status})"
            )

        return candidate, source

    @staticmethod
    def _identity_for_domain(domain_name: str):
        candidates = [
            domain_name,
            f"https://{domain_name}/",
            f"https://www.{domain_name}/" if not domain_name.startswith("www.") else None,
        ]
        for candidate in candidates:
            if not candidate:
                continue
            identity = resolve_property_identity(candidate)
            if identity:
                return identity, "property_identity_matrix"
        return None, None

    def _upsert_domain_snapshot(
        self,
        *,
        snapshot_date: date,
        collection_id: Optional[int],
        list_row: dict[str, Any],
        detail_status: int,
        detail_payload: Any,
        dns_status: int,
        dns_payload: Any,
        collection_status: str = "ok",
        error_message: Optional[str] = None,
    ) -> None:
        domain = str(list_row.get("domain") or "").strip().lower()
        detail = detail_payload if isinstance(detail_payload, dict) else {}
        dns_records = dns_payload if isinstance(dns_payload, list) else []
        type_counts = Counter(str(record.get("type") or "<missing>") for record in dns_records if isinstance(record, dict))
        identity, match_source = self._identity_for_domain(domain)
        property_id = identity.marketing_bi_property_id if identity else None
        property_name = identity.property_name if identity else None
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO godaddy_domain_snapshots (
                    snapshot_date, collection_id, domain, domain_id, property_id, property_name,
                    identity_match_source, detail_http_status, dns_http_status, domain_status,
                    expires, renew_auto, locked, privacy, renewable, redeemable,
                    transfer_protected, expiration_protected, hold_registrar, expose_whois,
                    nameservers_json, dns_record_count, dns_record_type_counts_json,
                    list_domain_json, detail_domain_json, dns_records_json,
                    collection_status, error_message, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(snapshot_date, domain) DO UPDATE SET
                    collection_id = excluded.collection_id,
                    domain_id = excluded.domain_id,
                    property_id = excluded.property_id,
                    property_name = excluded.property_name,
                    identity_match_source = excluded.identity_match_source,
                    detail_http_status = excluded.detail_http_status,
                    dns_http_status = excluded.dns_http_status,
                    domain_status = excluded.domain_status,
                    expires = excluded.expires,
                    renew_auto = excluded.renew_auto,
                    locked = excluded.locked,
                    privacy = excluded.privacy,
                    renewable = excluded.renewable,
                    redeemable = excluded.redeemable,
                    transfer_protected = excluded.transfer_protected,
                    expiration_protected = excluded.expiration_protected,
                    hold_registrar = excluded.hold_registrar,
                    expose_whois = excluded.expose_whois,
                    nameservers_json = excluded.nameservers_json,
                    dns_record_count = excluded.dns_record_count,
                    dns_record_type_counts_json = excluded.dns_record_type_counts_json,
                    list_domain_json = excluded.list_domain_json,
                    detail_domain_json = excluded.detail_domain_json,
                    dns_records_json = excluded.dns_records_json,
                    collection_status = excluded.collection_status,
                    error_message = excluded.error_message,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    snapshot_date.isoformat(),
                    collection_id,
                    domain,
                    str(detail.get("domainId")) if detail.get("domainId") is not None else None,
                    property_id,
                    property_name,
                    match_source,
                    detail_status,
                    dns_status,
                    detail.get("status") or list_row.get("status"),
                    detail.get("expires") or list_row.get("expires"),
                    _bool_int(detail.get("renewAuto", list_row.get("renewAuto"))),
                    _bool_int(detail.get("locked", list_row.get("locked"))),
                    _bool_int(detail.get("privacy", list_row.get("privacy"))),
                    _bool_int(detail.get("renewable")),
                    _bool_int(detail.get("redeemable")),
                    _bool_int(detail.get("transferProtected")),
                    _bool_int(detail.get("expirationProtected")),
                    _bool_int(detail.get("holdRegistrar")),
                    _bool_int(detail.get("exposeWhois")),
                    _json(detail.get("nameServers") or []),
                    len(dns_records),
                    _json(dict(sorted(type_counts.items()))),
                    _json(list_row),
                    _json(detail_payload),
                    _json(dns_payload),
                    collection_status,
                    error_message,
                ),
            )
            cursor.execute(
                "DELETE FROM godaddy_dns_records WHERE snapshot_date = ? AND domain = ?",
                (snapshot_date.isoformat(), domain),
            )
            for record in dns_records:
                if not isinstance(record, dict):
                    continue
                cursor.execute(
                    """
                    INSERT INTO godaddy_dns_records (
                        snapshot_date, collection_id, domain, record_hash, record_type,
                        record_name, record_data, ttl, priority, service, protocol,
                        port, weight, raw_record_json, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(snapshot_date, domain, record_hash) DO UPDATE SET
                        collection_id = excluded.collection_id,
                        record_type = excluded.record_type,
                        record_name = excluded.record_name,
                        record_data = excluded.record_data,
                        ttl = excluded.ttl,
                        priority = excluded.priority,
                        service = excluded.service,
                        protocol = excluded.protocol,
                        port = excluded.port,
                        weight = excluded.weight,
                        raw_record_json = excluded.raw_record_json,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        snapshot_date.isoformat(),
                        collection_id,
                        domain,
                        _record_hash(record),
                        record.get("type"),
                        record.get("name"),
                        record.get("data"),
                        _as_int(record.get("ttl")),
                        _as_int(record.get("priority")),
                        record.get("service"),
                        record.get("protocol"),
                        _as_int(record.get("port")),
                        _as_int(record.get("weight")),
                        _json(record),
                    ),
                )

    def collect_all(self, snapshot_date: Optional[date] = None, collection_id: Optional[int] = None) -> dict[str, Any]:
        snapshot_date = snapshot_date or datetime.now(timezone.utc).date()
        domains = self.list_domains()
        total = len(domains)
        successes = 0
        failures = 0
        dns_records = 0
        matched_properties = 0
        errors: list[str] = []
        self.logger.info("GoDaddy domain snapshot started for %s domains", total)

        for index, list_row in enumerate(domains, start=1):
            domain = str(list_row.get("domain") or "").strip().lower()
            if not domain:
                failures += 1
                continue
            try:
                detail_status, detail_payload = self._request_json(
                    f"/v1/domains/{domain}",
                    allowed_statuses={403, 404},
                )
                dns_status, dns_payload = self._request_json(
                    f"/v1/domains/{domain}/records",
                    allowed_statuses={400, 403, 404},
                )
                self._upsert_domain_snapshot(
                    snapshot_date=snapshot_date,
                    collection_id=collection_id,
                    list_row=list_row,
                    detail_status=detail_status,
                    detail_payload=detail_payload,
                    dns_status=dns_status,
                    dns_payload=dns_payload,
                    collection_status=(
                        "ok" if detail_status < 400 and dns_status < 400 else "source_limited"
                    ),
                )
                successes += 1
                dns_records += len(dns_payload) if isinstance(dns_payload, list) else 0
                if self._identity_for_domain(domain)[0]:
                    matched_properties += 1
                if index == 1 or index % 25 == 0 or index == total:
                    self.logger.info("GoDaddy snapshot progress: %s/%s domains", index, total)
            except Exception as exc:
                failures += 1
                message = str(exc)[:500]
                errors.append(f"{domain}: {message}")
                self.logger.warning("GoDaddy snapshot failed for %s: %s", domain, message)
                self._upsert_domain_snapshot(
                    snapshot_date=snapshot_date,
                    collection_id=collection_id,
                    list_row=list_row,
                    detail_status=0,
                    detail_payload={},
                    dns_status=0,
                    dns_payload=[],
                    collection_status="failed",
                    error_message=message,
                )

        return {
            "snapshot_date": snapshot_date.isoformat(),
            "domains_total": total,
            "domains_success": successes,
            "domains_failed": failures,
            "dns_records_written": dns_records,
            "matched_properties": matched_properties,
            "errors": errors[:20],
        }

    def _upsert_forwarding_snapshot(
        self,
        *,
        snapshot_date: date,
        collection_id: Optional[int],
        requested_domain: str,
        customer_id_source: str,
        http_status: int,
        forwarding_status: str,
        forwarding_count: int,
        forwarding_payload: Any,
    ) -> int:
        rows_written = 0
        entries = forwarding_payload if isinstance(forwarding_payload, list) else []
        if not entries:
            entries = [
                {
                    "fqdn": requested_domain,
                    "_status_only": True,
                    "_raw": forwarding_payload,
                }
            ]
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                fqdn = str(entry.get("fqdn") or requested_domain).strip().lower()
                error_code = None
                error_message = None
                if isinstance(forwarding_payload, dict):
                    error_code = forwarding_payload.get("code")
                    error_message = forwarding_payload.get("message")
                cursor.execute(
                    """
                    INSERT INTO godaddy_forwarding_snapshots (
                        snapshot_date, collection_id, requested_domain, fqdn, customer_id_source,
                        forwarding_http_status, forwarding_status, forwarding_count,
                        forwarding_type, forwarding_url, mask_json, raw_forwarding_json,
                        error_code, error_message, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(snapshot_date, requested_domain, fqdn) DO UPDATE SET
                        collection_id = excluded.collection_id,
                        customer_id_source = excluded.customer_id_source,
                        forwarding_http_status = excluded.forwarding_http_status,
                        forwarding_status = excluded.forwarding_status,
                        forwarding_count = excluded.forwarding_count,
                        forwarding_type = excluded.forwarding_type,
                        forwarding_url = excluded.forwarding_url,
                        mask_json = excluded.mask_json,
                        raw_forwarding_json = excluded.raw_forwarding_json,
                        error_code = excluded.error_code,
                        error_message = excluded.error_message,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        snapshot_date.isoformat(),
                        collection_id,
                        requested_domain,
                        fqdn,
                        customer_id_source,
                        http_status,
                        forwarding_status,
                        forwarding_count,
                        entry.get("type"),
                        entry.get("url"),
                        _json(entry.get("mask")),
                        _json(entry if not entry.get("_status_only") else forwarding_payload),
                        error_code,
                        error_message,
                    ),
                )
                rows_written += 1
        return rows_written

    def collect_forwarding(
        self,
        *,
        snapshot_date: Optional[date] = None,
        collection_id: Optional[int] = None,
        customer_id: Optional[str] = None,
        customer_id_source: Optional[str] = None,
        domains: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        snapshot_date = snapshot_date or datetime.now(timezone.utc).date()
        resolved_customer_id, resolved_source = self._resolve_forwarding_customer_id(
            customer_id=customer_id,
            customer_id_source=customer_id_source,
        )

        domain_names = domains or self._snapshot_domains(snapshot_date)
        if not domain_names:
            domain_names = [
                str(row.get("domain") or "").strip().lower()
                for row in self.list_domains()
                if row.get("domain")
            ]
        total = len(domain_names)
        successes = 0
        source_limited = 0
        failures = 0
        forwarding_rows = 0
        forwarding_records = 0
        errors: list[str] = []
        self.logger.info("GoDaddy forwarding snapshot started for %s domains", total)

        for index, domain in enumerate(domain_names, start=1):
            try:
                path = (
                    f"/v2/customers/{quote(resolved_customer_id, safe='')}"
                    f"/domains/forwards/{quote(domain, safe='')}?includeSubs=true"
                )
                status, payload = self._request_json(path, allowed_statuses={400, 403, 404, 422})
                if status == 200 and isinstance(payload, list):
                    forwarding_status = "ok" if payload else "no_forwarding"
                    forwarding_count = len(payload)
                    successes += 1
                    forwarding_records += forwarding_count
                elif status in {403, 404, 422}:
                    forwarding_status = "source_limited" if status == 403 else "no_forwarding"
                    forwarding_count = 0
                    source_limited += 1 if status == 403 else 0
                    successes += 1
                else:
                    forwarding_status = "source_limited"
                    forwarding_count = 0
                    source_limited += 1
                    successes += 1
                forwarding_rows += self._upsert_forwarding_snapshot(
                    snapshot_date=snapshot_date,
                    collection_id=collection_id,
                    requested_domain=domain,
                    customer_id_source=resolved_source,
                    http_status=status,
                    forwarding_status=forwarding_status,
                    forwarding_count=forwarding_count,
                    forwarding_payload=payload,
                )
                if index == 1 or index % 25 == 0 or index == total:
                    self.logger.info("GoDaddy forwarding snapshot progress: %s/%s domains", index, total)
            except Exception as exc:
                failures += 1
                message = str(exc)[:500]
                errors.append(f"{domain}: {message}")
                self.logger.warning("GoDaddy forwarding snapshot failed for %s: %s", domain, message)

        return {
            "snapshot_date": snapshot_date.isoformat(),
            "domains_total": total,
            "domains_success": successes,
            "domains_source_limited": source_limited,
            "domains_failed": failures,
            "forwarding_rows_written": forwarding_rows,
            "forwarding_records_found": forwarding_records,
            "errors": errors[:20],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect GoDaddy domain and DNS inventory into SQLite")
    parser.add_argument("--date", dest="snapshot_date", help="Snapshot date, YYYY-MM-DD. Defaults to current UTC date.")
    parser.add_argument("--db-path", type=Path, help="Optional SQLite database path.")
    parser.add_argument("--spacing-seconds", type=float, default=1.1, help="Minimum seconds between GoDaddy requests.")
    parser.add_argument("--no-collection-row", action="store_true", help="Do not create a data_collections row.")
    parser.add_argument("--forwarding-only", action="store_true", help="Collect only GoDaddy forwarding records.")
    parser.add_argument("--include-forwarding", action="store_true", help="Collect forwarding after domain/DNS snapshot.")
    parser.add_argument("--customer-id", help="GoDaddy customer/shopper id for v2 forwarding endpoints.")
    args = parser.parse_args()

    snapshot_date = date.fromisoformat(args.snapshot_date) if args.snapshot_date else datetime.now(timezone.utc).date()
    db = DatabaseManager(args.db_path)
    collection_id: Optional[int] = None
    if not args.no_collection_row:
        data_source = "godaddy_forwarding" if args.forwarding_only else "godaddy"
        collection_id = db.start_data_collection(snapshot_date, "snapshot", data_source)

    collector = GoDaddyCollector(
        settings=GoDaddyCollectorSettings(
            db_path=args.db_path,
            request_spacing_seconds=args.spacing_seconds,
        ),
        db=db,
    )
    try:
        if args.forwarding_only:
            summary = collector.collect_forwarding(
                snapshot_date=snapshot_date,
                collection_id=collection_id,
                customer_id=args.customer_id,
            )
        else:
            summary = collector.collect_all(snapshot_date=snapshot_date, collection_id=collection_id)
            if args.include_forwarding:
                forwarding_summary = collector.collect_forwarding(
                    snapshot_date=snapshot_date,
                    collection_id=collection_id,
                    customer_id=args.customer_id,
                )
                summary["forwarding"] = {k: v for k, v in forwarding_summary.items() if k != "errors"}
                summary["errors"].extend(forwarding_summary.get("errors", []))
        if collection_id is not None:
            notes_payload = {
                "source": "GoDaddy Domains API",
            }
            if "dns_records_written" in summary:
                notes_payload["dns_records_written"] = summary["dns_records_written"]
            if "matched_properties" in summary:
                notes_payload["matched_properties"] = summary["matched_properties"]
            if "forwarding_rows_written" in summary:
                notes_payload["forwarding_rows_written"] = summary["forwarding_rows_written"]
            if "forwarding_records_found" in summary:
                notes_payload["forwarding_records_found"] = summary["forwarding_records_found"]
            if summary.get("forwarding"):
                notes_payload["forwarding"] = summary["forwarding"]
            db.complete_data_collection(
                collection_id,
                properties_collected=summary["domains_success"],
                properties_failed=summary["domains_failed"],
                properties_total=summary["domains_total"],
                properties_success=summary["domains_success"],
                status="completed" if summary["domains_failed"] == 0 else "partial",
                notes=json.dumps(notes_payload, sort_keys=True),
            )
        print(json.dumps({k: v for k, v in summary.items() if k != "errors"}, indent=2))
        if summary["errors"]:
            print(json.dumps({"sample_errors": summary["errors"]}, indent=2), file=sys.stderr)
        return 0 if summary["domains_failed"] == 0 else 2
    except Exception as exc:
        if collection_id is not None:
            db.complete_data_collection(
                collection_id,
                properties_collected=0,
                properties_failed=1,
                properties_total=1,
                status="failed",
                error_message=str(exc)[:1000],
            )
        raise


if __name__ == "__main__":
    raise SystemExit(main())
