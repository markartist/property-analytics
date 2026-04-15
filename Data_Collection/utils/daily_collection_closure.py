#!/usr/bin/env python3
"""Shared daily collection closure logic for Watchtower, retries, and summary gating."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime, time as dt_time
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo
from Data_Collection.utils.source_freshness_policy import is_source_suspended


LOCAL_TIMEZONE = ZoneInfo("America/Chicago")
CORE_SOURCES = (
    "ga4",
    "gsc",
    "google_ads",
    "guest_card",
    "unit_availability",
    "d1_mirror",
)
ADVISORY_SOURCES = (
    "bi_report",
    "measurement_dashboard",
    "psi",
    "gsc_url_inspection",
    "semrush",
    "gbp_reviews",
    "gbp_insights",
    "cloudflare_cache_audit",
)
MANUAL_DEPENDENCY_SOURCES = {
    "guest_card",
    "guest_cards",
    "gift_card",
    "gift_cards",
    "bi_report",
    "bi_manual",
    "measurement_dashboard",
    "bi_metrics",
}
ACTIVE_STATUSES = {"in_progress", "partial", "retry_scheduled"}
BLOCKED_STATUSES = {"blocked", "failed", "exhausted"}
UNRESOLVED_QUEUE_STATUSES = {"pending", "retrying", "blocked"}
DEFAULT_CLOSURE_CUTOFF_HOUR = 11
SOURCE_LEVEL_PROPERTY_ID = "__source__"


def local_now(now: Optional[datetime] = None) -> datetime:
    current = now or datetime.now(LOCAL_TIMEZONE)
    if current.tzinfo is None:
        return current.replace(tzinfo=LOCAL_TIMEZONE)
    return current.astimezone(LOCAL_TIMEZONE)


def local_collection_date(now: Optional[datetime] = None) -> date:
    return local_now(now).date()


def _cutoff_datetime(target_date: date, cutoff_hour: int = DEFAULT_CLOSURE_CUTOFF_HOUR) -> datetime:
    return datetime.combine(target_date, dt_time(hour=cutoff_hour), tzinfo=LOCAL_TIMEZONE)


def load_latest_collection_runs(conn: sqlite3.Connection, target_date: date) -> List[Dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT *
        FROM data_collections
        WHERE collection_date = ?
        ORDER BY started_at DESC, collection_id DESC
        """,
        (target_date.isoformat(),),
    ).fetchall()
    latest_by_source: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        payload = dict(row)
        source = str(payload.get("data_source") or "").strip().lower()
        if source and source not in latest_by_source:
            latest_by_source[source] = payload
    return list(latest_by_source.values())


def load_retry_queue(conn: sqlite3.Connection, target_date: date) -> List[Dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT *
        FROM collection_retry_queue
        WHERE collection_date = ?
          AND status NOT IN ('resolved', 'exhausted')
        ORDER BY COALESCE(next_attempt_at, created_at) ASC, queue_id ASC
        """,
        (target_date.isoformat(),),
    ).fetchall()
    return [dict(row) for row in rows]


def evaluate_daily_collection_closure(
    db_path: Path | str,
    target_date: Optional[date] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Evaluate whether the current day is still open for retries or ready for summary."""
    effective_now = local_now(now)
    effective_date = target_date or effective_now.date()
    cutoff_at = _cutoff_datetime(effective_date)

    with sqlite3.connect(str(db_path)) as conn:
        latest_runs = load_latest_collection_runs(conn, effective_date)
        retry_queue = load_retry_queue(conn, effective_date)

    latest_by_source = {
        str(row.get("data_source") or "").strip().lower(): row
        for row in latest_runs
        if row.get("data_source")
    }
    advisory_sources: List[Dict[str, Any]] = []
    for source in ADVISORY_SOURCES:
        run = latest_by_source.get(source)
        advisory_sources.append({
            "source": source,
            "status": str((run or {}).get("status") or "missing").lower(),
            "run_recorded": run is not None,
        })
    unresolved_queue = [row for row in retry_queue if str(row.get("status") or "").lower() in UNRESOLVED_QUEUE_STATUSES]
    unresolved_queue_by_source: Dict[str, List[Dict[str, Any]]] = {}
    for item in unresolved_queue:
        unresolved_queue_by_source.setdefault(str(item.get("data_source") or "").lower(), []).append(item)

    unresolved_sources: List[Dict[str, Any]] = []
    for source in CORE_SOURCES:
        if is_source_suspended(source):
            continue
        run = latest_by_source.get(source)
        queue_items = unresolved_queue_by_source.get(source, [])
        if run is None:
            unresolved_sources.append({
                "source": source,
                "status": "missing",
                "reason": "no_run_recorded",
            })
            continue

        status = str(run.get("status") or "unknown").lower()
        if status == "completed" and not queue_items:
            continue

        reason = "retry_queue_open" if queue_items else ("manual_dependency" if source in MANUAL_DEPENDENCY_SOURCES else "run_not_closed")
        unresolved_sources.append({
            "source": source,
            "status": status,
            "reason": reason,
        })

    next_retry_at = None
    if unresolved_queue:
        retry_values = [item.get("next_attempt_at") for item in unresolved_queue if item.get("next_attempt_at")]
        next_retry_at = min(retry_values) if retry_values else None

    if not unresolved_sources and not unresolved_queue:
        return {
            "target_date": effective_date.isoformat(),
            "state": "complete",
            "ready_for_summary": True,
            "summary_reason": "all_core_sources_closed",
            "cutoff_at_local": cutoff_at.isoformat(),
            "next_retry_at": None,
            "unresolved_sources": [],
            "queue_depth": 0,
            "advisory_sources": advisory_sources,
        }

    if effective_date < effective_now.date() and effective_now >= cutoff_at:
        return {
            "target_date": effective_date.isoformat(),
            "state": "archived",
            "ready_for_summary": True,
            "summary_reason": "historical_date_outside_retry_window",
            "cutoff_at_local": cutoff_at.isoformat(),
            "next_retry_at": next_retry_at,
            "unresolved_sources": unresolved_sources,
            "queue_depth": len(unresolved_queue),
            "advisory_sources": advisory_sources,
        }

    if effective_now >= cutoff_at:
        return {
            "target_date": effective_date.isoformat(),
            "state": "blocked",
            "ready_for_summary": True,
            "summary_reason": "retry_window_closed_with_unresolved_work",
            "cutoff_at_local": cutoff_at.isoformat(),
            "next_retry_at": next_retry_at,
            "unresolved_sources": unresolved_sources,
            "queue_depth": len(unresolved_queue),
            "advisory_sources": advisory_sources,
        }

    summary_reason = "waiting_on_manual_source" if any(
        item.get("reason") == "manual_dependency" for item in unresolved_sources
    ) else "retry_window_open"
    return {
        "target_date": effective_date.isoformat(),
        "state": "open",
        "ready_for_summary": False,
        "summary_reason": summary_reason,
        "cutoff_at_local": cutoff_at.isoformat(),
        "next_retry_at": next_retry_at,
        "unresolved_sources": unresolved_sources,
        "queue_depth": len(unresolved_queue),
        "advisory_sources": advisory_sources,
    }
