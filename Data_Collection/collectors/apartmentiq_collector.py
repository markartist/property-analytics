#!/usr/bin/env python3
"""ApartmentIQ API collector for Data Pond advisory market/comps facts."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sqlite3
import tempfile
import sys
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Iterable

import requests
import yaml

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from utils.apartmentiq_auth import resolve_apartmentiq_credentials  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "Data_Collection" / "config" / "apartmentiq.yaml"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0055_create_apartmentiq_tables.sql"
API_BASE_URL = "https://data.apartmentiq.io/apartmentiq/api/v1"


def stable_id(*parts: Any) -> str:
    raw = "|".join("" if part is None else str(part) for part in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def json_dumps(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def bool_int(value: Any) -> int | None:
    if value is None:
        return None
    return 1 if bool(value) else 0


def as_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    number = as_number(value)
    return int(number) if number is not None else None


def api_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def attributes(row: dict[str, Any]) -> dict[str, Any]:
    attrs = row.get("attributes")
    return attrs if isinstance(attrs, dict) else row


@dataclass
class ApartmentIqCollectionResult:
    accounts_upserted: int = 0
    comp_sets_upserted: int = 0
    market_survey_items_upserted: int = 0
    units_upserted: int = 0
    floorplans_upserted: int = 0
    identity_links_upserted: int = 0
    accounts_seen: int = 0
    comp_sets_seen: int = 0
    comp_sets_sampled: int = 0
    requests_made: int = 0
    skipped: bool = False
    errors: list[str] = field(default_factory=list)
    account_ids: list[int] = field(default_factory=list)
    comp_set_examples: list[dict[str, Any]] = field(default_factory=list)


class ApartmentIqCollector:
    """Collect ApartmentIQ API source facts into the canonical SQLite pond."""

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
        self.base_url = str(self.config.get("api_base_url") or API_BASE_URL).rstrip("/")
        collection = self.config.get("collection") or {}
        self.timeout_seconds = int(collection.get("request_timeout_seconds", 45))
        self.rate_limit_sleep_seconds = float(collection.get("rate_limit_sleep_seconds", 1.0))
        self.max_retries = int(collection.get("max_retries", 2))
        self.session: requests.Session | None = None
        self.logger = logger or self._build_logger()

    def _load_config(self) -> dict[str, Any]:
        if not self.config_path.exists():
            return {"enabled": False, "collection": {}}
        with self.config_path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}

    def _build_logger(self) -> logging.Logger:
        logger = logging.getLogger("apartmentiq_collector")
        if logger.handlers:
            return logger
        logger.setLevel(logging.INFO)
        log_dir = ROOT / "Data_Collection" / "logs"
        log_path = log_dir / "apartmentiq_collector.log"
        try:
            log_dir.mkdir(parents=True, exist_ok=True)
            handler = logging.FileHandler(log_path)
        except OSError:
            fallback_dir = Path(tempfile.gettempdir()) / "property_analytics_logs"
            fallback_dir.mkdir(parents=True, exist_ok=True)
            handler = logging.FileHandler(fallback_dir / "apartmentiq_collector.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler(sys.stdout))
        return logger

    def enabled(self) -> bool:
        return bool(self.config.get("enabled", False))

    def _ensure_session(self) -> None:
        if self.session is not None:
            return
        credentials = resolve_apartmentiq_credentials()
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-ApartmentIQConnector/1.0",
            }
        )
        self.session = session

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        self._ensure_session()
        assert self.session is not None
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.request(method, url, timeout=self.timeout_seconds, **kwargs)
                if response.status_code == 429 and attempt < self.max_retries:
                    retry_after = response.headers.get("retry-after")
                    delay = float(retry_after) if retry_after and retry_after.isdigit() else 330.0
                    self.logger.warning("ApartmentIQ rate limited on %s %s; sleeping %.0fs", method, path, delay)
                    time.sleep(delay)
                    continue
                response.raise_for_status()
                payload = response.json()
                if self.rate_limit_sleep_seconds:
                    time.sleep(self.rate_limit_sleep_seconds)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
        raise RuntimeError(f"{method} {path} failed: {last_error}") from last_error

    def _paginated_get(self, path: str, params: dict[str, Any] | None = None) -> Iterable[dict[str, Any]]:
        page = 1
        while True:
            query = dict(params or {})
            query.setdefault("page", page)
            payload = self._request("GET", path, params=query)
            data = api_data(payload) or []
            if not isinstance(data, list):
                break
            yield from data
            pagination = payload.get("pagination") if isinstance(payload, dict) else None
            total_pages = int((pagination or {}).get("total_pages") or page)
            if page >= total_pages:
                break
            page += 1

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))
        return conn

    def _cached_comp_sets(self, conn: sqlite3.Connection, account_id: int) -> list[dict[str, Any]]:
        rows = []
        for row in conn.execute(
            """
            SELECT raw_json
            FROM apartmentiq_comp_sets
            WHERE account_id = ?
            ORDER BY comp_set_name
            """,
            (account_id,),
        ):
            if not row["raw_json"]:
                continue
            try:
                rows.append(json.loads(row["raw_json"]))
            except json.JSONDecodeError:
                continue
        return rows

    def _subject_linked_comp_set_ids(self, conn: sqlite3.Connection) -> set[str]:
        rows = conn.execute(
            """
            SELECT DISTINCT comp_set_id
            FROM apartmentiq_property_identity_links
            WHERE comp_set_id IS NOT NULL
            """
        ).fetchall()
        return {str(row["comp_set_id"]) for row in rows if row["comp_set_id"] is not None}

    def _latest_collection_date_by_comp_set(self, conn: sqlite3.Connection) -> dict[str, str]:
        rows = conn.execute(
            """
            SELECT comp_set_id, MAX(collection_date) AS latest_collection_date
            FROM apartmentiq_market_survey_items
            GROUP BY comp_set_id
            """
        ).fetchall()
        return {
            str(row["comp_set_id"]): str(row["latest_collection_date"])
            for row in rows
            if row["comp_set_id"] is not None and row["latest_collection_date"] is not None
        }

    def _latest_collection_date_by_comp_set_for_table(self, conn: sqlite3.Connection, table: str) -> dict[str, str]:
        rows = conn.execute(
            f"""
            SELECT comp_set_id, MAX(collection_date) AS latest_collection_date
            FROM {table}
            GROUP BY comp_set_id
            """
        ).fetchall()
        return {
            str(row["comp_set_id"]): str(row["latest_collection_date"])
            for row in rows
            if row["comp_set_id"] is not None and row["latest_collection_date"] is not None
        }

    def _comp_set_priority(
        self,
        *,
        comp_set_id: str,
        market_dates: dict[str, str],
        unit_dates: dict[str, str],
        floorplan_dates: dict[str, str],
        include_market_survey: bool,
        include_units: bool,
        include_floorplans: bool,
        collection_date: date,
    ) -> tuple[int, str, str]:
        relevant_dates: list[str] = []
        if include_market_survey:
            relevant_dates.append(market_dates.get(comp_set_id, ""))
        if include_units:
            relevant_dates.append(unit_dates.get(comp_set_id, ""))
        if include_floorplans:
            relevant_dates.append(floorplan_dates.get(comp_set_id, ""))
        nonempty_dates = [value for value in relevant_dates if value]
        if not nonempty_dates:
            return (0, "", comp_set_id)
        freshest_date = max(nonempty_dates)
        is_fresh_today = 1 if freshest_date >= collection_date.isoformat() else 0
        return (is_fresh_today, freshest_date, comp_set_id)

    def _prioritize_comp_sets(
        self,
        conn: sqlite3.Connection,
        comp_sets_to_sample: list[tuple[int, dict[str, Any]]],
        *,
        include_market_survey: bool,
        include_units: bool,
        include_floorplans: bool,
        collection_date: date,
    ) -> list[tuple[int, dict[str, Any]]]:
        if not comp_sets_to_sample:
            return []
        market_dates = (
            self._latest_collection_date_by_comp_set(conn)
            if include_market_survey
            else {}
        )
        unit_dates = (
            self._latest_collection_date_by_comp_set_for_table(conn, "apartmentiq_units")
            if include_units
            else {}
        )
        floorplan_dates = (
            self._latest_collection_date_by_comp_set_for_table(conn, "apartmentiq_floorplans")
            if include_floorplans
            else {}
        )
        return sorted(
            comp_sets_to_sample,
            key=lambda entry: self._comp_set_priority(
                comp_set_id=str(entry[1].get("id")),
                market_dates=market_dates,
                unit_dates=unit_dates,
                floorplan_dates=floorplan_dates,
                include_market_survey=include_market_survey,
                include_units=include_units,
                include_floorplans=include_floorplans,
                collection_date=collection_date,
            ),
        )

    def _upsert(self, conn: sqlite3.Connection, table: str, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(f"{column}=excluded.{column}" for column in columns if column != "id")
        if table == "apartmentiq_accounts":
            conflict = "account_id"
        elif table == "apartmentiq_comp_sets":
            conflict = "comp_set_id"
        elif table == "apartmentiq_property_identity_links":
            conflict = "apartmentiq_property_id"
            updates = ", ".join(
                f"{column}=excluded.{column}"
                for column in columns
                if column not in {"apartmentiq_property_id", "first_seen_at"}
            )
        else:
            conflict = "id"
        conn.executemany(
            f"""
            INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})
            ON CONFLICT({conflict}) DO UPDATE SET {updates}
            """,
            [[row.get(column) for column in columns] for row in rows],
        )
        return len(rows)

    def _identity_from_candidates(self, candidates: Iterable[str | None]) -> tuple[str | None, str | None, str | None]:
        for candidate in candidates:
            if not candidate:
                continue
            identity = resolve_property_identity(str(candidate))
            if identity:
                return identity.marketing_bi_property_id, identity.community_id, identity.property_name
        return None, None, None

    def _account_rows(self, accounts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        rows = []
        for account in accounts:
            rows.append(
                {
                    "account_id": int(account.get("id")),
                    "account_name": str(account.get("name") or ""),
                    "raw_json": json_dumps(account),
                    "updated_at": utc_timestamp(),
                }
            )
        return rows

    def _comp_set_row(self, account_id: int, comp_set: dict[str, Any]) -> dict[str, Any]:
        attrs = attributes(comp_set)
        comp_set_id = str(comp_set.get("id") or attrs.get("id"))
        owned_addresses = attrs.get("owned_property_addresses") or []
        address_candidates = []
        for row in owned_addresses if isinstance(owned_addresses, list) else []:
            if isinstance(row, dict):
                address_candidates.extend(
                    [
                        " ".join(
                            str(row.get(key) or "")
                            for key in ("address", "city", "state", "zip_code")
                            if row.get(key)
                        ),
                        row.get("address"),
                    ]
                )
        property_id, community_id, property_name = self._identity_from_candidates(
            [
                attrs.get("name"),
                *(attrs.get("addresses") or []),
                *address_candidates,
            ]
        )
        return {
            "comp_set_id": comp_set_id,
            "account_id": account_id,
            "comp_set_name": attrs.get("name"),
            "property_id": property_id,
            "community_id": community_id,
            "min_floorplan": as_int(attrs.get("min_floorplan")),
            "max_floorplan": as_int(attrs.get("max_floorplan")),
            "category": attrs.get("category"),
            "market_survey": bool_int(attrs.get("market_survey")),
            "custom_property": bool_int(attrs.get("custom_property")),
            "value_add": bool_int(attrs.get("value_add")),
            "subject_property_ids_json": json_dumps(attrs.get("subject_property_ids")),
            "owned_property_addresses_json": json_dumps(owned_addresses),
            "addresses_json": json_dumps(attrs.get("addresses")),
            "image_url": attrs.get("image"),
            "show_recommendations_link": bool_int(attrs.get("show_recommendations_link")),
            "raw_json": json_dumps(comp_set),
            "updated_at": utc_timestamp(),
        }

    def _market_survey_rows(
        self,
        *,
        account_id: int,
        comp_set_id: str,
        payload: dict[str, Any],
        collection_date: date,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        data = api_data(payload) or {}
        attrs = attributes(data)
        items = attrs.get("market_survey_items") or []
        if attrs.get("comp_average_column"):
            average = dict(attrs["comp_average_column"])
            average["id"] = "comp_average"
            average["subject_property"] = False
            average["property_name"] = "Comp Average"
            items.append(average)
        rows: list[dict[str, Any]] = []
        links: list[dict[str, Any]] = []
        for item in items:
            item_attrs = attributes(item)
            apartmentiq_property_id = str(item.get("id") or item_attrs.get("id") or stable_id(comp_set_id, item_attrs))
            candidate_name = item_attrs.get("property_name")
            candidate_address = " ".join(
                str(item_attrs.get(key) or "")
                for key in ("address", "city", "state", "zip_code")
                if item_attrs.get(key)
            )
            property_id, community_id, resolved_name = self._identity_from_candidates([candidate_name, candidate_address])
            is_subject = bool(item_attrs.get("subject_property"))
            exposure = item_attrs.get("exposure") or {}
            review = item_attrs.get("review") or {}
            rows.append(
                {
                    "id": stable_id(collection_date, comp_set_id, apartmentiq_property_id),
                    "collection_date": collection_date.isoformat(),
                    "account_id": account_id,
                    "comp_set_id": comp_set_id,
                    "apartmentiq_property_id": apartmentiq_property_id,
                    "property_id": property_id if is_subject else None,
                    "community_id": community_id if is_subject else None,
                    "subject_property": bool_int(is_subject) or 0,
                    "property_name": candidate_name,
                    "management_company_name": item_attrs.get("management_company_name"),
                    "address": item_attrs.get("address"),
                    "city": item_attrs.get("city"),
                    "state": item_attrs.get("state"),
                    "zip_code": item_attrs.get("zip_code"),
                    "distance": as_number(item_attrs.get("distance")),
                    "year_built": as_int(item_attrs.get("year_built")),
                    "total_units": as_int(item_attrs.get("total_units")),
                    "number_of_stories": as_int(item_attrs.get("number_of_stories")),
                    "avg_rent": as_number(item_attrs.get("avg_rent")),
                    "avg_sq_ft": as_number(item_attrs.get("avg_sq_ft")),
                    "avg_rent_per_sq_ft": as_number(item_attrs.get("avg_rent_per_sq_ft")),
                    "exposure_current": as_number(exposure.get("current") if isinstance(exposure, dict) else None),
                    "exposure_next_30_days": as_number(exposure.get("next_30_days") if isinstance(exposure, dict) else None),
                    "exposure_next_60_days": as_number(exposure.get("next_60_days") if isinstance(exposure, dict) else None),
                    "leased_percent": as_number(item_attrs.get("leased_percent")),
                    "advertised_occupancy_percent": as_number(item_attrs.get("advertised_occupancy_percent")),
                    "concession_percentage": as_number(item_attrs.get("concession_percentage")),
                    "cancelled_applications_percentage_last_30_days": as_number(
                        item_attrs.get("cancelled_applications_percentage_last_30_days")
                    ),
                    "review_average_rating": as_number(review.get("average_rating") if isinstance(review, dict) else None),
                    "review_count": as_int(review.get("review_count") if isinstance(review, dict) else None),
                    "concessions_json": json_dumps(item_attrs.get("concessions")),
                    "exposure_json": json_dumps(exposure),
                    "review_json": json_dumps(review),
                    "amenities_json": json_dumps(item_attrs.get("amenities")),
                    "fees_and_deposits_json": json_dumps(item_attrs.get("fees_and_deposits")),
                    "raw_json": json_dumps(item),
                    "updated_at": utc_timestamp(),
                }
            )
            if is_subject and property_id and apartmentiq_property_id != "comp_average":
                links.append(
                    {
                        "apartmentiq_property_id": apartmentiq_property_id,
                        "property_id": property_id,
                        "community_id": community_id,
                        "property_name": resolved_name,
                        "apartmentiq_property_name": candidate_name,
                        "account_id": account_id,
                        "comp_set_id": comp_set_id,
                        "match_method": "subject_property_resolver",
                        "evidence_json": json_dumps({"candidate_name": candidate_name, "candidate_address": candidate_address}),
                        "last_seen_at": utc_timestamp(),
                    }
                )
        return rows, links

    def _unit_rows(self, *, account_id: int, comp_set_id: str, payload: dict[str, Any], collection_date: date) -> list[dict[str, Any]]:
        rows = []
        for item in api_data(payload) or []:
            attrs = attributes(item)
            apartmentiq_property_id = str(attrs.get("property_id") or "")
            is_subject = bool(attrs.get("subject_property"))
            property_id, community_id, _ = self._identity_from_candidates(
                [f"apartmentiq:{apartmentiq_property_id}", attrs.get("property_name")]
            )
            rows.append(
                {
                    "id": stable_id(collection_date, comp_set_id, item.get("id")),
                    "collection_date": collection_date.isoformat(),
                    "account_id": account_id,
                    "comp_set_id": comp_set_id,
                    "apartmentiq_unit_id": str(item.get("id")),
                    "apartmentiq_property_id": apartmentiq_property_id or None,
                    "property_id": property_id if is_subject else None,
                    "community_id": community_id if is_subject else None,
                    "subject_property": bool_int(is_subject) or 0,
                    "property_name": attrs.get("property_name"),
                    "unit_name": attrs.get("unit_name"),
                    "status": attrs.get("status"),
                    "is_leased": bool_int(attrs.get("is_leased")),
                    "date_leased": attrs.get("date_leased"),
                    "date_available": attrs.get("date_available"),
                    "days_on_market": as_int(attrs.get("days_on_market")),
                    "bedroom_count": as_int(attrs.get("bedroom_count")),
                    "bathroom_count": as_number(attrs.get("bathroom_count")),
                    "min_rent": as_number(attrs.get("min_rent")),
                    "sq_ft": as_int(attrs.get("sq_ft")),
                    "floorplan_name": attrs.get("floorplan_name"),
                    "avg_rent_per_sq_ft": as_number(attrs.get("avg_rent_per_sq_ft")),
                    "last_rent_change_date": attrs.get("last_rent_change_date"),
                    "last_rent_change": attrs.get("last_rent_change"),
                    "total_30_day_rent_change": attrs.get("total_30_day_rent_change"),
                    "rent_changes_last_30_days": as_int(attrs.get("rent_changes_last_30_days")),
                    "is_trucomp": bool_int(attrs.get("is_trucomp")),
                    "net_effective_rent": as_number(attrs.get("net_effective_rent")),
                    "net_effective_rent_per_sq_ft": as_number(attrs.get("net_effective_rent_per_sq_ft")),
                    "annual_rent_reduction_value": as_number(attrs.get("annual_rent_reduction_value")),
                    "concessions_json": json_dumps(attrs.get("concessions")),
                    "amenity_names_json": json_dumps(attrs.get("amenity_names")),
                    "raw_json": json_dumps(item),
                    "updated_at": utc_timestamp(),
                }
            )
        return rows

    def _floorplan_rows(
        self,
        *,
        account_id: int,
        comp_set_id: str,
        payload: dict[str, Any],
        collection_date: date,
    ) -> list[dict[str, Any]]:
        data = api_data(payload) or {}
        attrs = attributes(data)
        buckets = attrs.get("floor_plans_by_bed_bath") or attrs.get("floor_plans_by_bed") or []
        rows = []
        for bucket_index, bucket in enumerate(buckets):
            bucket_label = f"bucket_{bucket_index}"
            floorplans = list(bucket.get("floor_plans") or [])
            if bucket.get("floor_plan_summary"):
                summary = dict(bucket["floor_plan_summary"])
                summary["_aggregation_bucket_role"] = "summary"
                floorplans.append(summary)
            for fp_index, fp in enumerate(floorplans):
                apartmentiq_property_id = str(fp.get("property_id") or "")
                is_subject = bool(fp.get("subject_property"))
                property_id, community_id, _ = self._identity_from_candidates(
                    [f"apartmentiq:{apartmentiq_property_id}", fp.get("property_name")]
                )
                rows.append(
                    {
                        "id": stable_id(collection_date, comp_set_id, bucket_label, fp_index, apartmentiq_property_id, fp.get("name")),
                        "collection_date": collection_date.isoformat(),
                        "account_id": account_id,
                        "comp_set_id": comp_set_id,
                        "apartmentiq_property_id": apartmentiq_property_id or None,
                        "property_id": property_id if is_subject else None,
                        "community_id": community_id if is_subject else None,
                        "subject_property": bool_int(is_subject) or 0,
                        "property_name": fp.get("property_name"),
                        "floorplan_name": fp.get("name"),
                        "bedroom_count": as_int(fp.get("bedroom_count") or bucket.get("bedroom_count")),
                        "bathroom_count": as_number(fp.get("bathroom_count") or bucket.get("bathroom_count")),
                        "asking_rent": as_number(fp.get("asking_rent")),
                        "asking_rent_change": as_number(fp.get("asking_rent_change")),
                        "asking_rent_change_percent": as_number(fp.get("asking_rent_change_percent")),
                        "asking_rent_per_sq_ft": as_number(fp.get("asking_rent_per_sq_ft")),
                        "net_effective_rent": as_number(fp.get("net_effective_rent")),
                        "net_effective_rent_change": as_number(fp.get("net_effective_rent_change")),
                        "net_effective_rent_change_percent": as_number(fp.get("net_effective_rent_change_percent")),
                        "net_effective_rent_per_sq_ft": as_number(fp.get("net_effective_rent_per_sq_ft")),
                        "sqft": as_number(fp.get("sqft")),
                        "days_on_market": as_int(fp.get("days_on_market")),
                        "unit_count": as_int(fp.get("unit_count")),
                        "unit_mix_est": as_number(fp.get("unit_mix_est")),
                        "unit_mix_percent": as_number(fp.get("unit_mix_percent")),
                        "aggregation_bucket": json_dumps(
                            {
                                "bucket_index": bucket_index,
                                "bedroom_count": bucket.get("bedroom_count"),
                                "bathroom_count": bucket.get("bathroom_count"),
                                "role": fp.get("_aggregation_bucket_role", "property_floorplan"),
                            }
                        ),
                        "raw_json": json_dumps(fp),
                        "updated_at": utc_timestamp(),
                    }
                )
        return rows

    def collect(
        self,
        *,
        max_comp_sets: int | None = None,
        include_market_survey: bool | None = None,
        include_units: bool | None = None,
        include_floorplans: bool | None = None,
        subject_comp_sets_only: bool = False,
        discovery_only: bool = False,
        collection_date: date | None = None,
    ) -> ApartmentIqCollectionResult:
        result = ApartmentIqCollectionResult()
        collection = self.config.get("collection") or {}
        if not self.enabled():
            result.skipped = True
            return result

        include_market_survey = bool(collection.get("include_market_survey", True)) if include_market_survey is None else include_market_survey
        include_units = bool(collection.get("include_units", False)) if include_units is None else include_units
        include_floorplans = bool(collection.get("include_floorplans", False)) if include_floorplans is None else include_floorplans
        max_comp_sets = int(collection.get("max_comp_sets_per_run", 20)) if max_comp_sets is None else max_comp_sets
        collection_date = collection_date or date.today()

        account_ids_config = [int(value) for value in collection.get("account_ids") or []]
        comp_set_ids_config = {str(value) for value in collection.get("comp_set_ids") or []}
        use_cached_comp_sets = bool(collection.get("use_cached_comp_sets_on_list_error", True))

        with self._connect() as conn:
            subject_comp_set_ids = self._subject_linked_comp_set_ids(conn) if subject_comp_sets_only else set()
            accounts = list(self._paginated_get("/accounts", params={"per_page": 100}))
            result.requests_made += 1
            if account_ids_config:
                accounts = [account for account in accounts if int(account.get("id")) in account_ids_config]
            result.accounts_seen = len(accounts)
            result.account_ids = [int(account.get("id")) for account in accounts]
            result.accounts_upserted = self._upsert(conn, "apartmentiq_accounts", self._account_rows(accounts))

            comp_sets_to_sample: list[tuple[int, dict[str, Any]]] = []
            for account in accounts:
                account_id = int(account.get("id"))
                try:
                    payload = self._request("GET", f"/accounts/{account_id}/comp_sets")
                    result.requests_made += 1
                    comp_sets = api_data(payload) or []
                    if comp_set_ids_config:
                        comp_sets = [row for row in comp_sets if str(row.get("id")) in comp_set_ids_config]
                    if subject_comp_set_ids:
                        comp_sets = [row for row in comp_sets if str(row.get("id")) in subject_comp_set_ids]
                    result.comp_sets_seen += len(comp_sets)
                    comp_rows = [self._comp_set_row(account_id, row) for row in comp_sets]
                    result.comp_sets_upserted += self._upsert(conn, "apartmentiq_comp_sets", comp_rows)
                    for row in comp_sets[:5]:
                        attrs = attributes(row)
                        result.comp_set_examples.append(
                            {"account_id": account_id, "comp_set_id": str(row.get("id")), "name": attrs.get("name")}
                        )
                    comp_sets_to_sample.extend((account_id, row) for row in comp_sets)
                except Exception as exc:
                    if use_cached_comp_sets:
                        comp_sets = self._cached_comp_sets(conn, account_id)
                        if comp_set_ids_config:
                            comp_sets = [row for row in comp_sets if str(row.get("id")) in comp_set_ids_config]
                        if subject_comp_set_ids:
                            comp_sets = [row for row in comp_sets if str(row.get("id")) in subject_comp_set_ids]
                        if comp_sets:
                            message = f"account {account_id}: live comp set list failed; using {len(comp_sets)} cached comp sets ({exc})"
                            self.logger.warning(message)
                            result.comp_sets_seen += len(comp_sets)
                            comp_sets_to_sample.extend((account_id, row) for row in comp_sets)
                            continue
                    message = f"account {account_id}: {exc}"
                    self.logger.warning(message)
                    result.errors.append(message)

            if discovery_only:
                conn.commit()
                return result

            comp_sets_to_sample = self._prioritize_comp_sets(
                conn,
                comp_sets_to_sample,
                include_market_survey=include_market_survey,
                include_units=include_units,
                include_floorplans=include_floorplans,
                collection_date=collection_date,
            )
            if max_comp_sets >= 0:
                comp_sets_to_sample = comp_sets_to_sample[:max_comp_sets]

            total_to_sample = len(comp_sets_to_sample)
            for index, (account_id, comp_set) in enumerate(comp_sets_to_sample, start=1):
                comp_set_id = str(comp_set.get("id"))
                result.comp_sets_sampled += 1
                if index == 1 or index % 25 == 0 or index == total_to_sample:
                    self.logger.info("ApartmentIQ sampling comp set %s/%s: %s", index, total_to_sample, comp_set_id)
                try:
                    if include_market_survey:
                        survey = self._request("GET", f"/comp_sets/{comp_set_id}/market_survey")
                        result.requests_made += 1
                        rows, links = self._market_survey_rows(
                            account_id=account_id,
                            comp_set_id=comp_set_id,
                            payload=survey,
                            collection_date=collection_date,
                        )
                        result.market_survey_items_upserted += self._upsert(conn, "apartmentiq_market_survey_items", rows)
                        result.identity_links_upserted += self._upsert(conn, "apartmentiq_property_identity_links", links)
                    if include_units:
                        units = self._request("GET", f"/comp_sets/{comp_set_id}/units")
                        result.requests_made += 1
                        result.units_upserted += self._upsert(
                            conn,
                            "apartmentiq_units",
                            self._unit_rows(
                                account_id=account_id,
                                comp_set_id=comp_set_id,
                                payload=units,
                                collection_date=collection_date,
                            ),
                        )
                    if include_floorplans:
                        floorplans = self._request("GET", f"/comp_sets/{comp_set_id}/floor_plans")
                        result.requests_made += 1
                        result.floorplans_upserted += self._upsert(
                            conn,
                            "apartmentiq_floorplans",
                            self._floorplan_rows(
                                account_id=account_id,
                                comp_set_id=comp_set_id,
                                payload=floorplans,
                                collection_date=collection_date,
                            ),
                        )
                except Exception as exc:
                    message = f"comp_set {comp_set_id}: {exc}"
                    self.logger.warning(message)
                    result.errors.append(message)
            conn.commit()
        return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect ApartmentIQ API source facts into Data Pond.")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--max-comp-sets", type=int)
    parser.add_argument("--discovery-only", action="store_true")
    parser.add_argument("--include-market-survey", action="store_true")
    parser.add_argument("--include-units", action="store_true")
    parser.add_argument("--include-floorplans", action="store_true")
    parser.add_argument("--subject-comp-sets-only", action="store_true")
    args = parser.parse_args()

    collector = ApartmentIqCollector(db_path=Path(args.db), config_path=Path(args.config))
    result = collector.collect(
        max_comp_sets=args.max_comp_sets,
        include_market_survey=args.include_market_survey or None,
        include_units=args.include_units or None,
        include_floorplans=args.include_floorplans or None,
        subject_comp_sets_only=args.subject_comp_sets_only,
        discovery_only=args.discovery_only,
    )
    print(json.dumps(result.__dict__, indent=2, sort_keys=True))
    if result.errors and result.comp_sets_sampled == 0 and not args.discovery_only:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
