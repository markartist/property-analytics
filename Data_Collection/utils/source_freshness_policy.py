#!/usr/bin/env python3
"""
Source-specific freshness expectations and registry-driven reporting suppressions.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
import os
from pathlib import Path
from zoneinfo import ZoneInfo


LOCAL_TZ = ZoneInfo("America/Chicago")
ROOT = Path("/Users/mark/Property_Analytics")
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
MANUAL_MORNING_SOURCE_KEYS = {
    "guest_cards",
    "guest_card",
    "gift_cards",
    "gift_card",
    "bi_report",
    "bi_manual",
    "measurement_dashboard",
    "bi_metrics",
    "property_operating_metrics",
}
SUNSET_SOURCE_KEYS = {
    "semrush",
}
PRELAUNCH_LIFECYCLE_TOKENS = (
    "prelaunch",
    "pre-launch",
    "coming soon",
    "not live",
    "lease up",
    "lease-up",
    "under construction",
    "future",
)
@dataclass
class FreshnessExpectation:
    source_key: str
    latest_date: date | None
    expected_latest_date: date
    business_lag_days: int | None
    status: str


@dataclass(frozen=True)
class RegistrySuppressionPolicy:
    prelaunch_property_names: frozenset[str]
    prelaunch_gsc_urls: frozenset[str]


@dataclass(frozen=True)
class AdvisorySourcePolicy:
    source_key: str
    cadence_key: str
    cadence_label: str
    latest_data_table: str | None = None
    latest_data_column: str | None = None


@dataclass
class AdvisorySourceStatus:
    source: str
    status: str
    run_recorded: bool
    latest_recorded_date: str | None
    expected_latest_date: str | None
    freshness_status: str
    cadence_key: str
    cadence_label: str


ADVISORY_SOURCE_POLICIES: dict[str, AdvisorySourcePolicy] = {
    "bi_report": AdvisorySourcePolicy("bi_report", "same_day_manual", "Same-day manual"),
    "property_operating_metrics": AdvisorySourcePolicy(
        "property_operating_metrics",
        "same_day_manual",
        "Same-day manual",
        latest_data_table="property_operating_metrics",
        latest_data_column="metric_date",
    ),
    "measurement_dashboard": AdvisorySourcePolicy(
        "measurement_dashboard",
        "weekly_manual",
        "Weekly manual workbook",
        latest_data_table="measurement_daily_metrics",
        latest_data_column="snapshot_date",
    ),
    "psi": AdvisorySourcePolicy(
        "psi",
        "daily_diagnostic",
        "Daily diagnostic",
        latest_data_table="pagespeed_metrics",
        latest_data_column="metric_date",
    ),
    "gsc_url_inspection": AdvisorySourcePolicy(
        "gsc_url_inspection",
        "targeted_manual",
        "Targeted manual audit",
        latest_data_table="gsc_url_inspection",
        latest_data_column="inspection_date",
    ),
    "dataforseo": AdvisorySourcePolicy(
        "dataforseo",
        "weekly_automated",
        "Weekly automated search intelligence",
        latest_data_table="dataforseo_serp_runs",
        latest_data_column="run_date",
    ),
    "gbp_reviews": AdvisorySourcePolicy(
        "gbp_reviews",
        "weekly_automated",
        "Weekly automated",
        latest_data_table="gbp_reviews",
        latest_data_column="review_create_time",
    ),
    "gbp_insights": AdvisorySourcePolicy(
        "gbp_insights",
        "weekly_automated",
        "Weekly automated",
        latest_data_table="gbp_daily_insights",
        latest_data_column="metric_date",
    ),
    "cloudflare_cache_audit": AdvisorySourcePolicy("cloudflare_cache_audit", "weekly_automated", "Weekly automated"),
    "browserstack": AdvisorySourcePolicy("browserstack", "targeted_manual", "Targeted manual audit"),
    "evs": AdvisorySourcePolicy("evs", "targeted_manual", "Targeted manual audit"),
    "sightmap": AdvisorySourcePolicy("sightmap", "targeted_manual", "Targeted manual audit"),
}


def is_guest_card_harvest_suspended() -> bool:
    value = (os.getenv("GUEST_CARD_HARVEST_SUSPENDED", "0") or "").strip().lower()
    return value not in {"0", "false", "no", "off"}


def is_semrush_sunset() -> bool:
    value = (os.getenv("SEMRUSH_DEPRECATED", "1") or "").strip().lower()
    return value not in {"0", "false", "no", "off"}


def is_source_suspended(source_key: str) -> bool:
    normalized = (source_key or "").strip().lower()
    if normalized in {"guest_card", "guest_cards"}:
        return is_guest_card_harvest_suspended()
    if normalized in SUNSET_SOURCE_KEYS:
        return is_semrush_sunset()
    return False


def get_advisory_source_policy(source_key: str) -> AdvisorySourcePolicy | None:
    return ADVISORY_SOURCE_POLICIES.get((source_key or "").strip().lower())


def advisory_source_keys() -> tuple[str, ...]:
    return tuple(ADVISORY_SOURCE_POLICIES.keys())


def _normalize_url_key(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if raw.startswith("sc-domain:"):
        return raw.rstrip("/").lower()
    return raw.rstrip("/").lower()


@lru_cache(maxsize=1)
def get_registry_suppression_policy() -> RegistrySuppressionPolicy:
    property_names: set[str] = set()
    gsc_urls: set[str] = set()

    try:
        with REGISTRY_PATH.open() as handle:
            registry = json.load(handle)
    except Exception:
        return RegistrySuppressionPolicy(frozenset(), frozenset())

    for prop in registry.get("properties", []):
        lifecycle = " ".join(
            [
                str(prop.get("lifecycle") or ""),
                str(prop.get("operational_status") or ""),
                str(prop.get("status") or ""),
            ]
        ).lower()
        if not any(token in lifecycle for token in PRELAUNCH_LIFECYCLE_TOKENS):
            continue

        name = (prop.get("name") or "").strip().lower()
        if name:
            property_names.add(name)

        for key in (prop.get("gsc_url"), prop.get("full_url")):
            normalized = _normalize_url_key(str(key or ""))
            if normalized:
                gsc_urls.add(normalized)

    return RegistrySuppressionPolicy(
        prelaunch_property_names=frozenset(property_names),
        prelaunch_gsc_urls=frozenset(gsc_urls),
    )


def is_prelaunch_property_name(property_name: str | None) -> bool:
    name = (property_name or "").strip().lower()
    if not name:
        return False
    return name in get_registry_suppression_policy().prelaunch_property_names


def is_prelaunch_gsc_url(gsc_url: str | None) -> bool:
    normalized = _normalize_url_key(str(gsc_url or ""))
    if not normalized:
        return False
    return normalized in get_registry_suppression_policy().prelaunch_gsc_urls


def is_prelaunch_registry_property(prop: dict | None) -> bool:
    if not prop:
        return False
    if is_prelaunch_property_name(prop.get("name")):
        return True
    if is_prelaunch_gsc_url(prop.get("gsc_url")):
        return True
    lifecycle = " ".join(
        [
            str(prop.get("lifecycle") or ""),
            str(prop.get("operational_status") or ""),
            str(prop.get("status") or ""),
        ]
    ).lower()
    return any(token in lifecycle for token in PRELAUNCH_LIFECYCLE_TOKENS)


def _previous_business_day(d: date) -> date:
    current = d - timedelta(days=1)
    while current.weekday() >= 5:
        current -= timedelta(days=1)
    return current


def expected_latest_date_for_source(source_key: str, now_dt: datetime | None = None) -> date:
    now_local = now_dt.astimezone(LOCAL_TZ) if now_dt else datetime.now(LOCAL_TZ)
    today_local = now_local.date()
    source = (source_key or "").strip().lower()
    policy = get_advisory_source_policy(source)

    if source == "gsc":
        return today_local - timedelta(days=3)

    if policy and policy.cadence_key == "targeted_manual":
        return today_local

    if source in MANUAL_MORNING_SOURCE_KEYS:
        if today_local.weekday() >= 5:
            return _previous_business_day(today_local)
        if now_local.hour < 8:
            return _previous_business_day(today_local)
        return today_local

    if policy and policy.cadence_key in {"weekly_manual", "weekly_automated"}:
        return _previous_business_day(today_local)

    return today_local - timedelta(days=1)


def evaluate_source_freshness(
    source_key: str,
    latest_date_value: str | None,
    now_dt: datetime | None = None,
) -> FreshnessExpectation:
    now_local = now_dt.astimezone(LOCAL_TZ) if now_dt and now_dt.tzinfo else (now_dt or datetime.now(LOCAL_TZ))
    if is_source_suspended(source_key):
        latest_date = date.fromisoformat(str(latest_date_value)[:10]) if latest_date_value else None
        expected_latest = expected_latest_date_for_source(source_key, now_dt=now_dt)
        return FreshnessExpectation(
            source_key=source_key,
            latest_date=latest_date,
            expected_latest_date=expected_latest,
            business_lag_days=None,
            status="suspended",
        )

    expected_latest = expected_latest_date_for_source(source_key, now_dt=now_dt)
    policy = get_advisory_source_policy(source_key)

    latest_date: date | None = None
    if latest_date_value:
        latest_date = date.fromisoformat(str(latest_date_value)[:10])

    if latest_date is None:
        if policy and policy.cadence_key == "targeted_manual":
            return FreshnessExpectation(
                source_key=source_key,
                latest_date=None,
                expected_latest_date=expected_latest,
                business_lag_days=None,
                status="idle",
            )
        return FreshnessExpectation(
            source_key=source_key,
            latest_date=None,
            expected_latest_date=expected_latest,
            business_lag_days=None,
            status="missing",
        )

    age_days = max(0, (now_local.date() - latest_date).days)
    if policy and policy.cadence_key == "weekly_manual":
        if age_days >= 11:
            status = "stale"
        elif age_days >= 8:
            status = "warning"
        else:
            status = "fresh"
        return FreshnessExpectation(
            source_key=source_key,
            latest_date=latest_date,
            expected_latest_date=expected_latest,
            business_lag_days=None,
            status=status,
        )

    if policy and policy.cadence_key == "weekly_automated":
        if age_days >= 10:
            status = "stale"
        elif age_days >= 7:
            status = "warning"
        else:
            status = "fresh"
        return FreshnessExpectation(
            source_key=source_key,
            latest_date=latest_date,
            expected_latest_date=expected_latest,
            business_lag_days=None,
            status=status,
        )

    if policy and policy.cadence_key == "targeted_manual":
        if age_days >= 30:
            status = "stale"
        elif age_days >= 14:
            status = "warning"
        else:
            status = "fresh"
        return FreshnessExpectation(
            source_key=source_key,
            latest_date=latest_date,
            expected_latest_date=expected_latest,
            business_lag_days=None,
            status=status,
        )

    lag_days = (expected_latest - latest_date).days
    if lag_days <= 0:
        status = "fresh"
    elif lag_days == 1:
        status = "warning"
    else:
        status = "stale"

    return FreshnessExpectation(
        source_key=source_key,
        latest_date=latest_date,
        expected_latest_date=expected_latest,
        business_lag_days=max(0, lag_days),
        status=status,
    )


def latest_recorded_date_for_source(conn: sqlite3.Connection, source_key: str) -> str | None:
    source = (source_key or "").strip().lower()
    policy = get_advisory_source_policy(source)

    if policy and policy.latest_data_table and policy.latest_data_column:
        try:
            row = conn.execute(
                f"SELECT MAX({policy.latest_data_column}) FROM {policy.latest_data_table}"
            ).fetchone()
            if row and row[0]:
                return str(row[0])[:10]
        except sqlite3.OperationalError:
            pass

    try:
        row = conn.execute(
            """
            SELECT MAX(collection_date)
            FROM data_collections
            WHERE data_source = ?
            """,
            (source,),
        ).fetchone()
    except sqlite3.OperationalError:
        return None

    if row and row[0]:
        return str(row[0])[:10]
    return None


def build_advisory_source_status(
    conn: sqlite3.Connection,
    source_key: str,
    today_run: dict | None = None,
    now_dt: datetime | None = None,
) -> AdvisorySourceStatus:
    source = (source_key or "").strip().lower()
    policy = get_advisory_source_policy(source) or AdvisorySourcePolicy(
        source_key=source,
        cadence_key="targeted_manual",
        cadence_label="Targeted manual audit",
    )
    latest_recorded_date = latest_recorded_date_for_source(conn, source)
    freshness = evaluate_source_freshness(source, latest_recorded_date, now_dt=now_dt)
    return AdvisorySourceStatus(
        source=source,
        status=str(
            (today_run or {}).get("status")
            or ("historical" if latest_recorded_date else ("not_scheduled" if policy.cadence_key == "targeted_manual" else "missing"))
        ).lower(),
        run_recorded=today_run is not None,
        latest_recorded_date=latest_recorded_date,
        expected_latest_date=freshness.expected_latest_date.isoformat(),
        freshness_status=freshness.status,
        cadence_key=policy.cadence_key,
        cadence_label=policy.cadence_label,
    )
