#!/usr/bin/env python3
"""
Source-specific freshness expectations for manually updated feeds.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
import os
from zoneinfo import ZoneInfo


LOCAL_TZ = ZoneInfo("America/Chicago")
MANUAL_MORNING_SOURCE_KEYS = {
    "guest_cards",
    "guest_card",
    "gift_cards",
    "gift_card",
    "bi_report",
    "bi_manual",
    "measurement_dashboard",
    "bi_metrics",
}


@dataclass
class FreshnessExpectation:
    source_key: str
    latest_date: date | None
    expected_latest_date: date
    business_lag_days: int | None
    status: str


def is_guest_card_harvest_suspended() -> bool:
    value = (os.getenv("GUEST_CARD_HARVEST_SUSPENDED", "1") or "").strip().lower()
    return value not in {"0", "false", "no", "off"}


def is_source_suspended(source_key: str) -> bool:
    normalized = (source_key or "").strip().lower()
    if normalized in {"guest_card", "guest_cards"}:
        return is_guest_card_harvest_suspended()
    return False


def _previous_business_day(d: date) -> date:
    current = d - timedelta(days=1)
    while current.weekday() >= 5:
        current -= timedelta(days=1)
    return current


def expected_latest_date_for_source(source_key: str, now_dt: datetime | None = None) -> date:
    now_local = now_dt.astimezone(LOCAL_TZ) if now_dt else datetime.now(LOCAL_TZ)
    today_local = now_local.date()
    source = (source_key or "").strip().lower()

    if source in MANUAL_MORNING_SOURCE_KEYS:
        if today_local.weekday() >= 5:
            return _previous_business_day(today_local)
        if now_local.hour < 8:
            return _previous_business_day(today_local)
        return today_local

    return today_local - timedelta(days=1)


def evaluate_source_freshness(
    source_key: str,
    latest_date_value: str | None,
    now_dt: datetime | None = None,
) -> FreshnessExpectation:
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

    latest_date: date | None = None
    if latest_date_value:
        latest_date = date.fromisoformat(str(latest_date_value)[:10])

    if latest_date is None:
        return FreshnessExpectation(
            source_key=source_key,
            latest_date=None,
            expected_latest_date=expected_latest,
            business_lag_days=None,
            status="missing",
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
