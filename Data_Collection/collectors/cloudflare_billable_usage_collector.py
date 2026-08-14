#!/usr/bin/env python3
"""Cloudflare Billable Usage collector for governed Data Pond FinOps facts."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
import yaml

UTC = timezone.utc

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ksm import KsmResolutionError, resolve_secret  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "config" / "cloudflare_billable_usage.yaml"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0061_create_cloudflare_billable_usage_tables.sql"
CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
DEFAULT_BILLING_TOKEN_NOTATION_ENV = "KSM_CLOUDFLARE_BILLING_TOKEN_NOTATION"
DEFAULT_BILLING_TOKEN_NOTATION = "keeper://LttlGLhno7Ddd-GYZPWFTw/field/password"


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def json_dumps(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def sanitized_errors(payload: dict[str, Any] | None) -> str | None:
    if not isinstance(payload, dict):
        return None
    errors = payload.get("errors")
    if not isinstance(errors, list) or not errors:
        return None
    return "; ".join(str((error or {}).get("message") or error) for error in errors[:3])[:500]


def clean_token(raw: str) -> str:
    text = raw.strip()
    if "Bearer " in text:
        text = text.split("Bearer ", 1)[1]
    return text.strip().strip('"').strip("'")


@dataclass
class CloudflareBillableUsageResult:
    rows_returned: int = 0
    rows_upserted: int = 0
    accounts_total: int = 0
    accounts_failed: int = 0
    skipped: bool = False
    total_contracted_cost: float | None = None
    billing_currency: str | None = None
    credential_source: str | None = None
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.skipped or self.accounts_failed == 0 or self.rows_upserted > 0


class CloudflareBillableUsageCollector:
    """Collect read-only Cloudflare Billable Usage rows."""

    def __init__(
        self,
        *,
        db_path: Path = DB_PATH,
        config_path: Path = CONFIG_PATH,
        logger: logging.Logger | None = None,
    ) -> None:
        self.db_path = Path(db_path)
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.timeout_seconds = int(self.config.get("timeout_seconds", 45))
        self.max_retries = int(self.config.get("max_retries", 2))
        self.session: requests.Session | None = None
        self.credential_source: str | None = None
        self.logger = logger or self._build_logger()

    def _load_config(self) -> dict[str, Any]:
        if not self.config_path.exists():
            return {"enabled": False}
        with self.config_path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}

    def _build_logger(self) -> logging.Logger:
        logger = logging.getLogger("cloudflare_billable_usage")
        if logger.handlers:
            return logger
        logger.setLevel(logging.INFO)
        log_dir = ROOT / "Data_Collection" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_dir / "cloudflare_billable_usage.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler(sys.stdout))
        return logger

    def enabled(self) -> bool:
        return bool(self.config.get("enabled", False))

    def _resolve_billing_token(self) -> tuple[str, str]:
        notation_env_var = str(self.config.get("token_notation_env") or DEFAULT_BILLING_TOKEN_NOTATION_ENV).strip()
        default_notation = str(self.config.get("token_notation") or DEFAULT_BILLING_TOKEN_NOTATION).strip()
        profile = str(self.config.get("ksm_profile") or os.getenv("KSM_PROFILE") or "marketingops").strip()
        token = resolve_secret(
            description="Cloudflare Billing API token",
            notation_env_var=notation_env_var,
            default_notation=default_notation,
            direct_env_var="CLOUDFLARE_BILLING_API_TOKEN",
            default_profile=profile,
        )
        return clean_token(token), f"keeper:{profile}:{notation_env_var}"

    def _ensure_session(self) -> bool:
        if self.session is not None:
            return True
        try:
            token, source = self._resolve_billing_token()
        except KsmResolutionError as exc:
            self.logger.warning("Cloudflare billable usage skipped: %s", exc)
            return False

        session = requests.Session()
        session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "User-Agent": "PropertyAnalytics-CloudflareBillableUsage/1.0",
            }
        )
        self.session = session
        self.credential_source = source
        return True

    def _request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.session is None:
            raise RuntimeError("Cloudflare session has not been initialized")
        url = f"{CLOUDFLARE_API_BASE}{path}"
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.get(url, params=params or {}, timeout=self.timeout_seconds)
                payload = response.json() if response.content else {}
                if response.status_code == 429 and attempt < self.max_retries:
                    retry_after = response.headers.get("retry-after")
                    try:
                        delay = float(retry_after) if retry_after else 5.0
                    except ValueError:
                        delay = 5.0
                    self.logger.warning("Cloudflare rate limited on %s; sleeping %.0fs", path, delay)
                    time.sleep(delay)
                    continue
                if response.status_code >= 500 and attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                if response.status_code >= 400 or not payload.get("success", False):
                    message = sanitized_errors(payload) or f"Cloudflare request failed with status {response.status_code}"
                    raise RuntimeError(message)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
        raise RuntimeError(str(last_error)) from last_error

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=120)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 120000")
        conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))
        return conn

    def _configured_account_id(self) -> str | None:
        explicit = str(self.config.get("account_id") or "").strip()
        if explicit:
            return explicit
        env_var = str(self.config.get("account_id_env") or "CLOUDFLARE_ACCOUNT_ID").strip()
        env_value = str(os.getenv(env_var) or "").strip() if env_var else ""
        return env_value or None

    def _resolve_account(self) -> tuple[str, str | None]:
        configured = self._configured_account_id()
        if configured:
            account_name = str(self.config.get("account_name") or "").strip() or None
            return configured, account_name

        payload = self._request("/accounts", {"per_page": 50})
        accounts = payload.get("result") or []
        if len(accounts) != 1:
            names = ", ".join(str(account.get("name") or account.get("id")) for account in accounts[:8])
            raise RuntimeError(f"Could not infer a single Cloudflare account; set CLOUDFLARE_ACCOUNT_ID. Visible accounts: {names}")
        account = accounts[0]
        account_id = str(account.get("id") or "")
        if not account_id:
            raise RuntimeError("Cloudflare account discovery returned an account without an id")
        return account_id, account.get("name")

    def _window(self, collection_date: date | None = None) -> tuple[str | None, str | None, date]:
        window = self.config.get("window") if isinstance(self.config.get("window"), dict) else {}
        from_value = str(window.get("from") or "").strip()
        to_value = str(window.get("to") or "").strip()
        if from_value or to_value:
            resolved_date = date.fromisoformat((from_value or to_value)[:10])
            return from_value or None, to_value or None, resolved_date

        metric_date = collection_date
        if metric_date is None:
            metric_date = datetime.now(UTC).date()
            if self.config.get("query_current_billing_period", True):
                return None, None, metric_date
        if collection_date is None and self.config.get("use_previous_day_window", True):
            metric_date = metric_date - timedelta(days=1)
        return metric_date.isoformat(), (metric_date + timedelta(days=1)).isoformat(), metric_date

    def _usage_rows(
        self,
        *,
        account_id: str,
        account_name: str | None,
        payload: dict[str, Any],
        collection_id: int | None,
    ) -> list[dict[str, Any]]:
        rows = []
        for item in payload.get("result") or []:
            if not isinstance(item, dict):
                continue
            row = {
                "charge_period_start": item.get("ChargePeriodStart"),
                "charge_period_end": item.get("ChargePeriodEnd"),
                "billing_period_start": item.get("BillingPeriodStart"),
                "billing_period_end": item.get("BillingPeriodEnd"),
                "account_id": account_id,
                "account_name": account_name or item.get("BillingAccountName"),
                "service_name": item.get("ServiceName") or "__unknown__",
                "service_family_name": item.get("ServiceFamilyName"),
                "billing_currency": item.get("BillingCurrency"),
                "pricing_quantity": as_float(item.get("PricingQuantity")),
                "consumed_quantity": as_float(item.get("ConsumedQuantity")),
                "consumed_unit": item.get("ConsumedUnit"),
                "contracted_cost": as_float(item.get("ContractedCost")),
                "cumulated_pricing_quantity": as_float(item.get("CumulatedPricingQuantity")),
                "cumulated_contracted_cost": as_float(item.get("CumulatedContractedCost")),
                "zone_id": item.get("ZoneId") or "__account__",
                "zone_name": item.get("ZoneName"),
                "collection_id": collection_id,
                "collection_status": "ok",
                "raw_json": json_dumps(item),
            }
            if row["charge_period_start"] and row["charge_period_end"]:
                rows.append(row)
        return rows

    def _upsert_usage_rows(self, conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(f"{column}=excluded.{column}" for column in columns if column not in {"collected_at"})
        conn.executemany(
            f"""
            INSERT INTO cloudflare_billable_usage_daily ({", ".join(columns)})
            VALUES ({placeholders})
            ON CONFLICT(account_id, charge_period_start, charge_period_end, service_name, zone_id)
            DO UPDATE SET {updates}, updated_at = CURRENT_TIMESTAMP
            """,
            [tuple(row[column] for column in columns) for row in rows],
        )
        return len(rows)

    def _upsert_collection(
        self,
        conn: sqlite3.Connection,
        *,
        collection_date: date,
        account_id: str,
        account_name: str | None,
        window_start: str | None,
        window_end: str | None,
        rows_returned: int,
        rows_upserted: int,
        total_contracted_cost: float | None,
        billing_currency: str | None,
        api_status: str,
        error_message: str | None,
        collection_id: int | None,
    ) -> None:
        conn.execute(
            """
            INSERT INTO cloudflare_billable_usage_collections
            (
              collection_date, account_id, account_name, window_start, window_end,
              rows_returned, rows_upserted, total_contracted_cost, billing_currency,
              api_status, credential_source, error_message, collection_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(collection_date, account_id, window_start, window_end) DO UPDATE SET
              account_name = excluded.account_name,
              rows_returned = excluded.rows_returned,
              rows_upserted = excluded.rows_upserted,
              total_contracted_cost = excluded.total_contracted_cost,
              billing_currency = excluded.billing_currency,
              api_status = excluded.api_status,
              credential_source = excluded.credential_source,
              error_message = excluded.error_message,
              collection_id = excluded.collection_id,
              updated_at = CURRENT_TIMESTAMP
            """,
            (
                collection_date.isoformat(),
                account_id,
                account_name,
                window_start,
                window_end,
                rows_returned,
                rows_upserted,
                total_contracted_cost,
                billing_currency,
                api_status,
                self.credential_source,
                error_message,
                collection_id,
            ),
        )

    def run(self, *, collection_date: date | None = None, collection_id: int | None = None) -> CloudflareBillableUsageResult:
        result = CloudflareBillableUsageResult()
        if not self.enabled():
            result.skipped = True
            return result
        if not self._ensure_session():
            result.skipped = True
            return result
        result.credential_source = self.credential_source

        window_start, window_end, resolved_collection_date = self._window(collection_date)
        params: dict[str, Any] = {}
        if window_start:
            params["from"] = window_start
        if window_end:
            params["to"] = window_end

        account_id = ""
        account_name: str | None = None
        try:
            account_id, account_name = self._resolve_account()
            result.accounts_total = 1
            payload = self._request(f"/accounts/{account_id}/billable-usage", params)
            rows = self._usage_rows(account_id=account_id, account_name=account_name, payload=payload, collection_id=collection_id)
            result.rows_returned = len(payload.get("result") or [])
            currencies = sorted({str(row["billing_currency"]) for row in rows if row.get("billing_currency")})
            result.billing_currency = currencies[0] if len(currencies) == 1 else None
            total = sum(float(row["contracted_cost"] or 0) for row in rows)
            result.total_contracted_cost = round(total, 6)

            with self._connect() as conn:
                result.rows_upserted = self._upsert_usage_rows(conn, rows)
                self._upsert_collection(
                    conn,
                    collection_date=resolved_collection_date,
                    account_id=account_id,
                    account_name=account_name,
                    window_start=window_start,
                    window_end=window_end,
                    rows_returned=result.rows_returned,
                    rows_upserted=result.rows_upserted,
                    total_contracted_cost=result.total_contracted_cost,
                    billing_currency=result.billing_currency,
                    api_status="ok",
                    error_message=None,
                    collection_id=collection_id,
                )
        except Exception as exc:
            result.accounts_failed = 1
            message = str(exc)[:500]
            result.errors.append(message)
            self.logger.warning("Cloudflare billable usage failed: %s", message)
            if account_id:
                with self._connect() as conn:
                    self._upsert_collection(
                        conn,
                        collection_date=resolved_collection_date,
                        account_id=account_id,
                        account_name=account_name,
                        window_start=window_start,
                        window_end=window_end,
                        rows_returned=0,
                        rows_upserted=0,
                        total_contracted_cost=None,
                        billing_currency=None,
                        api_status="error",
                        error_message=message,
                        collection_id=collection_id,
                    )
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect Cloudflare Billable Usage source facts.")
    parser.add_argument("--config", default=str(CONFIG_PATH), help="Path to Cloudflare billable usage YAML config.")
    parser.add_argument("--db", default=str(DB_PATH), help="Path to canonical Data Pond SQLite database.")
    parser.add_argument("--date", help="Collection date, YYYY-MM-DD. Defaults to previous UTC day.")
    args = parser.parse_args()

    collection_date = date.fromisoformat(args.date) if args.date else None
    collector = CloudflareBillableUsageCollector(db_path=Path(args.db), config_path=Path(args.config))
    result = collector.run(collection_date=collection_date)
    print(json.dumps({**result.__dict__, "ok": result.ok}, indent=2, sort_keys=True))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
