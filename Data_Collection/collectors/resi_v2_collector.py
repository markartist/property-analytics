#!/usr/bin/env python3
"""Read-only Resi V2 API collector for Data Pond source facts."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.resi_auth import resolve_resi_credentials  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0063_create_resi_v2_api_snapshots.sql"
API_BASE_URL = "https://v2.getresi.com/api/v2"


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def json_compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def payload_sha256(value: Any) -> str:
    return hashlib.sha256(json_compact(value).encode("utf-8")).hexdigest()


@dataclass
class ResiV2SnapshotResult:
    snapshot_id: str
    fetched_at: str
    account_id: str | None
    account_name: str | None
    properties_seen: int = 0
    lead_sources_seen: int = 0
    requests_made: int = 0
    errors: list[str] = field(default_factory=list)


class ResiV2Collector:
    """Collect account-scoped Resi V2 resources through Keeper-backed auth."""

    def __init__(
        self,
        db_path: Path = DB_PATH,
        base_url: str = API_BASE_URL,
        timeout_seconds: int = 45,
        max_retries: int = 2,
        rate_limit_sleep_seconds: float = 0.2,
    ) -> None:
        self.db_path = Path(db_path)
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.rate_limit_sleep_seconds = rate_limit_sleep_seconds
        self.session: requests.Session | None = None
        self.requests_made = 0

    def _ensure_session(self) -> None:
        if self.session is not None:
            return
        credentials = resolve_resi_credentials()
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-ResiV2Collector/1.0",
            }
        )
        self.session = session

    def _request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._ensure_session()
        assert self.session is not None
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.get(url, params=params or {}, timeout=self.timeout_seconds)
                self.requests_made += 1
                if response.status_code == 429 and attempt < self.max_retries:
                    retry_after = response.headers.get("retry-after")
                    try:
                        delay = float(retry_after) if retry_after else 30.0
                    except ValueError:
                        delay = 30.0
                    time.sleep(delay)
                    continue
                if response.status_code == 401:
                    raise RuntimeError("Resi V2 token was rejected with 401; stopping without retry.")
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise RuntimeError(f"Unexpected Resi V2 response shape for {path}: {type(payload).__name__}")
                if self.rate_limit_sleep_seconds:
                    time.sleep(self.rate_limit_sleep_seconds)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
        raise RuntimeError(f"GET {path} failed: {last_error}") from last_error

    def _paginated_get(self, path: str, params: dict[str, Any] | None = None) -> Iterable[dict[str, Any]]:
        page = 1
        while True:
            query = dict(params or {})
            query.setdefault("per_page", 200)
            query["page"] = page
            payload = self._request(path, params=query)
            rows = payload.get("data") or []
            if not isinstance(rows, list):
                raise RuntimeError(f"Unexpected Resi V2 collection shape for {path}.")
            for row in rows:
                if isinstance(row, dict):
                    yield row

            meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
            last_page = meta.get("last_page")
            if last_page is not None:
                if page >= int(last_page):
                    break
                page += 1
                continue

            links = payload.get("links") if isinstance(payload.get("links"), dict) else {}
            if not links.get("next"):
                break
            page += 1

    def ensure_schema(self, conn: sqlite3.Connection) -> None:
        conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))

    @staticmethod
    def _account_context(me: dict[str, Any]) -> tuple[str | None, str | None]:
        data = me.get("data") if isinstance(me.get("data"), dict) else {}
        accounts = data.get("accounts") if isinstance(data.get("accounts"), list) else []
        if not accounts or not isinstance(accounts[0], dict):
            return None, None
        return accounts[0].get("id"), accounts[0].get("name")

    def ingest(self) -> ResiV2SnapshotResult:
        fetched_at = utc_timestamp()
        snapshot_date = date.today().isoformat()
        me = self._request("/me")
        properties = list(self._paginated_get("/properties"))
        lead_sources = list(self._paginated_get("/lead-sources"))
        properties_hash = payload_sha256(properties)
        lead_sources_hash = payload_sha256(lead_sources)
        snapshot_id = f"resi_v2_{hashlib.sha256(f'{properties_hash}:{lead_sources_hash}:{fetched_at}'.encode('utf-8')).hexdigest()[:12]}"
        account_id, account_name = self._account_context(me)
        user = me.get("data") if isinstance(me.get("data"), dict) else {}

        with sqlite3.connect(self.db_path) as conn:
            self.ensure_schema(conn)
            conn.execute(
                """
                INSERT INTO resi_v2_api_snapshots (
                  snapshot_id, snapshot_date, fetched_at, api_base_url, account_id,
                  account_name, user_id, user_email, properties_seen, lead_sources_seen,
                  properties_payload_sha256, lead_sources_payload_sha256,
                  raw_me_json, raw_properties_json, raw_lead_sources_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_id) DO UPDATE SET
                  properties_seen=excluded.properties_seen,
                  lead_sources_seen=excluded.lead_sources_seen
                """,
                (
                    snapshot_id,
                    snapshot_date,
                    fetched_at,
                    self.base_url,
                    account_id,
                    account_name,
                    user.get("id"),
                    user.get("email"),
                    len(properties),
                    len(lead_sources),
                    properties_hash,
                    lead_sources_hash,
                    json_compact(me),
                    json_compact(properties),
                    json_compact(lead_sources),
                ),
            )
            conn.commit()

        return ResiV2SnapshotResult(
            snapshot_id=snapshot_id,
            fetched_at=fetched_at,
            account_id=account_id,
            account_name=account_name,
            properties_seen=len(properties),
            lead_sources_seen=len(lead_sources),
            requests_made=self.requests_made,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DB_PATH), help="Canonical local SQLite database.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = ResiV2Collector(db_path=Path(args.db)).ingest()
    print(json.dumps(result.__dict__, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
