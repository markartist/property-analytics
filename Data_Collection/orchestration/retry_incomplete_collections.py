#!/usr/bin/env python3
"""Execute same-morning retries for incomplete daily collections."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

_data_collection_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, _data_collection_root)

from Data_Collection.collectors.guest_card_collector import GuestCardCollector
from Data_Collection.collectors.thirtylines_collector import ThirtyLinesCollector
from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.orchestration.daily_master_collection import PortfolioDataCollector
from Data_Collection.utils.bi_manual_ingest import get_pending_bi_workbooks, ingest_bi_workbooks
from apps.api.scripts.wrangler_auth import build_runtime_env as build_wrangler_runtime_env
from Data_Collection.utils.daily_collection_closure import (
    ACTIVE_STATUSES,
    CORE_SOURCES,
    MANUAL_DEPENDENCY_SOURCES,
    SOURCE_LEVEL_PROPERTY_ID,
    evaluate_daily_collection_closure,
    local_now,
)
from Data_Collection.utils.source_freshness_policy import (
    is_guest_card_harvest_suspended,
    is_prelaunch_registry_property,
)


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"


def _get_initialized_collector() -> PortfolioDataCollector:
    collector = PortfolioDataCollector(test_mode=False, quick_mode=True, no_gtmetrix=True)
    collector.initialize_collectors()
    return collector


def _next_retry_time(now: datetime, source: str, minutes: int | None = None) -> datetime:
    if minutes is not None:
        return now + timedelta(minutes=minutes)
    if source in MANUAL_DEPENDENCY_SOURCES:
        return now + timedelta(minutes=30)
    return now + timedelta(minutes=20)


def _queue_retry(
    db: DatabaseManager,
    collection_date,
    source: str,
    property_id: str,
    property_name: str,
    attempt_count: int,
    retry_disposition: str,
    note: str,
    next_attempt_at: datetime,
    status: str = "pending",
) -> None:
    db.upsert_collection_retry_queue(
        collection_date=collection_date,
        data_source=source,
        property_id=property_id,
        property_name=property_name,
        attempt_count=attempt_count,
        status=status,
        retry_disposition=retry_disposition,
        next_attempt_at=next_attempt_at,
        last_error_type=retry_disposition,
        last_error_message=note,
        notes=note,
    )


def _record_initial_retry_queue(
    db: DatabaseManager,
    collection_date,
    latest_runs: Dict[str, Dict[str, object]],
    now: datetime,
) -> List[Dict[str, object]]:
    actions: List[Dict[str, object]] = []
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True)
    existing_keys = {
        (str(item.get("data_source") or "").lower(), str(item.get("property_id") or ""))
        for item in queue_items
    }

    for source in CORE_SOURCES:
        if is_guest_card_harvest_suspended() and source == "guest_card":
            continue
        run = latest_runs.get(source)
        if run is None:
            property_id = SOURCE_LEVEL_PROPERTY_ID
            key = (source, property_id)
            if key not in existing_keys:
                retry_disposition = "manual_dependency" if source in MANUAL_DEPENDENCY_SOURCES else "retryable_later"
                note = "No collection run recorded yet for this core source; keeping the day open for follow-up."
                _queue_retry(
                    db,
                    collection_date,
                    source,
                    property_id,
                    f"{source} source retry",
                    1,
                    retry_disposition,
                    note,
                    _next_retry_time(now, source),
                )
                actions.append({"source": source, "action": "queue_missing_source", "note": note})
            continue

        status = str(run.get("status") or "").lower()
        if status == "completed":
            continue

        property_id = SOURCE_LEVEL_PROPERTY_ID
        key = (source, property_id)
        if key not in existing_keys:
            note = (
                f"{source} still open ({int(run.get('properties_failed') or 0)}/"
                f"{int(run.get('properties_total') or 0)} failed); retry worker has kept this source scheduled."
            )
            retry_disposition = "manual_dependency" if source in MANUAL_DEPENDENCY_SOURCES else "retryable_now"
            _queue_retry(
                db,
                collection_date,
                source,
                property_id,
                f"{source} source retry",
                1,
                retry_disposition,
                note,
                _next_retry_time(now, source),
            )
            actions.append({"source": source, "action": "schedule_retry", "status_before": status, "note": note})
    return actions


def _archive_historical_retry_debt(db: DatabaseManager, now: datetime) -> List[Dict[str, object]]:
    actions: List[Dict[str, object]] = []
    today = now.date()
    with db.get_connection() as conn:
        rows = conn.execute(
            """
            SELECT collection_date, data_source, property_id
            FROM collection_retry_queue
            WHERE collection_date < ?
              AND status NOT IN ('resolved', 'exhausted')
            ORDER BY collection_date ASC, data_source ASC, queue_id ASC
            """,
            (today,),
        ).fetchall()

    for row in rows:
        collection_date = row["collection_date"]
        data_source = str(row["data_source"] or "").strip().lower()
        property_id = str(row["property_id"] or "").strip()
        resolved_property_id = None if property_id == SOURCE_LEVEL_PROPERTY_ID else property_id
        db.resolve_collection_retry_queue(
            collection_date,
            data_source,
            resolved_property_id,
            notes="Retry window closed; archived historical retry debt during reconciliation.",
            exhausted=True,
        )
        actions.append({
            "source": data_source,
            "action": "archived_historical_retry_debt",
            "collection_date": str(collection_date),
            "property_id": property_id or SOURCE_LEVEL_PROPERTY_ID,
        })
    return actions


def _retry_ga4(db: DatabaseManager, collection_date, now: datetime, collector: PortfolioDataCollector) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="ga4")
    property_items = [item for item in queue_items if str(item.get("property_id") or "") != SOURCE_LEVEL_PROPERTY_ID]
    if not property_items:
        return []

    properties = collector.load_properties()
    property_by_id = {
        str(prop.get("ga4_property_id") or "").strip(): prop
        for prop in properties
        if prop.get("ga4_property_id")
    }
    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=29)
    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "ga4"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "ga4")
    if latest_run:
        db.update_data_collection_status(collection_id, "in_progress", notes="GA4 targeted retry worker is running.")

    actions: List[Dict[str, object]] = []
    remaining = 0
    for item in property_items:
        property_id = str(item.get("property_id") or "").strip()
        prop = property_by_id.get(property_id)
        property_name = item.get("property_name") or property_id
        if not prop:
            db.resolve_collection_retry_queue(collection_date, "ga4", property_id, notes="Property no longer found in registry", exhausted=True)
            actions.append({"source": "ga4", "property": property_name, "action": "exhausted_missing_registry"})
            continue
        try:
            status, details = collector._collect_ga4_for_property(prop, start_date, end_date, collection_id)
            if status == "success":
                db.resolve_collection_retry_queue(collection_date, "ga4", property_id, notes="Recovered by retry worker")
                actions.append({"source": "ga4", "property": property_name, "action": "retried_success", "note": details})
            else:
                remaining += 1
                db.upsert_collection_retry_queue(
                    collection_date=collection_date,
                    data_source="ga4",
                    property_id=property_id,
                    property_name=str(property_name),
                    attempt_count=int(item.get("attempt_count") or 0) + 1,
                    status="pending",
                    retry_disposition="retryable_later",
                    next_attempt_at=_next_retry_time(now, "ga4", 45),
                    last_error_type="retryable_later",
                    last_error_message=str(details or "Retry returned no data")[:400],
                    notes="GA4 retry returned no data; leaving queued for a later attempt.",
                )
                actions.append({"source": "ga4", "property": property_name, "action": "retried_no_data"})
        except Exception as exc:
            remaining += 1
            retry_disposition = "retryable_now" if collector._is_transient_ga4_error(str(exc)) else "retryable_later"
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="ga4",
                property_id=property_id,
                property_name=str(property_name),
                attempt_count=int(item.get("attempt_count") or 0) + 1,
                status="pending",
                retry_disposition=retry_disposition,
                next_attempt_at=_next_retry_time(now, "ga4", 20 if retry_disposition == "retryable_now" else 45),
                last_error_type=retry_disposition,
                last_error_message=str(exc)[:400],
                notes="GA4 retry worker attempt failed.",
            )
            actions.append({"source": "ga4", "property": property_name, "action": "retried_failed", "note": str(exc)[:160]})

    db.update_data_collection_status(
        collection_id,
        "completed" if remaining == 0 else "retry_scheduled",
        notes="GA4 retry worker cleared all queued properties." if remaining == 0 else f"GA4 retry worker ran; {remaining} property retry item(s) still queued.",
    )
    return actions


def _retry_gsc(db: DatabaseManager, collection_date, now: datetime, collector: PortfolioDataCollector) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="gsc")
    property_items = [item for item in queue_items if str(item.get("property_id") or "") != SOURCE_LEVEL_PROPERTY_ID]
    if not property_items:
        return []

    properties = collector.load_properties()
    property_by_gsc_url = {
        str(prop.get("gsc_url") or "").strip(): prop
        for prop in properties
        if prop.get("gsc_url")
    }
    end_date = datetime.now() - timedelta(days=3)
    start_date = end_date - timedelta(days=29)
    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "gsc"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "gsc")
    if latest_run:
        db.update_data_collection_status(collection_id, "in_progress", notes="GSC targeted retry worker is running.")

    actions: List[Dict[str, object]] = []
    remaining = 0
    for item in property_items:
        property_id = str(item.get("property_id") or "").strip()
        prop = property_by_gsc_url.get(property_id)
        property_name = item.get("property_name") or property_id
        if not prop:
            db.resolve_collection_retry_queue(collection_date, "gsc", property_id, notes="Property no longer found in registry", exhausted=True)
            actions.append({"source": "gsc", "property": property_name, "action": "exhausted_missing_registry"})
            continue
        if is_prelaunch_registry_property(prop):
            db.resolve_collection_retry_queue(
                collection_date,
                "gsc",
                property_id,
                notes="Prelaunch property intentionally suppressed from GSC reporting.",
            )
            actions.append({"source": "gsc", "property": property_name, "action": "resolved_prelaunch_suppressed"})
            continue
        try:
            response = collector.gsc_service.searchanalytics().query(
                siteUrl=property_id,
                body={
                    'startDate': start_date.strftime('%Y-%m-%d'),
                    'endDate': end_date.strftime('%Y-%m-%d'),
                    'dimensions': ['date']
                }
            ).execute()
            rows = response.get('rows', [])
            if rows:
                for row in rows:
                    date_str = row.get('keys', [''])[0]
                    collector.db.insert_gsc_daily_metrics(
                        property_id=property_id,
                        metric_date=date_str,
                        data={
                            'clicks': row.get('clicks', 0),
                            'impressions': row.get('impressions', 0),
                            'ctr': row.get('ctr', 0) * 100,
                            'position': row.get('position', 0)
                        }
                    )
                collector._collect_gsc_queries(prop, property_id, start_date, end_date)
                db.resolve_collection_retry_queue(collection_date, "gsc", property_id, notes="Recovered by GSC retry worker")
                actions.append({"source": "gsc", "property": property_name, "action": "retried_success", "note": f"{len(rows)} day rows"})
            else:
                remaining += 1
                db.upsert_collection_retry_queue(
                    collection_date=collection_date,
                    data_source="gsc",
                    property_id=property_id,
                    property_name=str(property_name),
                    attempt_count=int(item.get("attempt_count") or 0) + 1,
                    status="pending",
                    retry_disposition="retryable_later",
                    next_attempt_at=_next_retry_time(now, "gsc", 45),
                    last_error_type="retryable_later",
                    last_error_message="GSC retry returned no data.",
                    notes="GSC retry returned no data; leaving queued for a later attempt.",
                )
                actions.append({"source": "gsc", "property": property_name, "action": "retried_no_data"})
        except Exception as exc:
            remaining += 1
            retry_disposition = "retryable_now" if collector._is_transient_gsc_error(str(exc)) else "retryable_later"
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="gsc",
                property_id=property_id,
                property_name=str(property_name),
                attempt_count=int(item.get("attempt_count") or 0) + 1,
                status="pending",
                retry_disposition=retry_disposition,
                next_attempt_at=_next_retry_time(now, "gsc", 20 if retry_disposition == "retryable_now" else 45),
                last_error_type=retry_disposition,
                last_error_message=str(exc)[:400],
                notes="GSC retry worker attempt failed.",
            )
            actions.append({"source": "gsc", "property": property_name, "action": "retried_failed", "note": str(exc)[:160]})

    if remaining == 0:
        db.resolve_collection_retry_queue(
            collection_date,
            "gsc",
            None,
            notes="GSC retry worker cleared all queued source-level work.",
        )
    else:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="gsc",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="gsc source retry",
            attempt_count=1,
            status="pending",
            retry_disposition="retryable_now",
            next_attempt_at=_next_retry_time(now, "gsc", 20),
            last_error_type="retryable_now",
            last_error_message=f"gsc still open ({remaining} property retry item(s) queued).",
            notes=f"gsc still open ({remaining} property retry item(s) queued).",
        )

    db.update_data_collection_status(
        collection_id,
        "completed" if remaining == 0 else "retry_scheduled",
        notes="GSC retry worker cleared all queued properties." if remaining == 0 else f"GSC retry worker ran; {remaining} property retry item(s) still queued.",
    )
    return actions


def _retry_google_ads(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="google_ads")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    property_items = [item for item in queue_items if str(item.get("property_id") or "") != SOURCE_LEVEL_PROPERTY_ID]
    if not property_items and not source_item:
        return []

    property_names = [str(item.get("property_name") or item.get("property_id") or "").strip() for item in property_items]
    property_names = [name for name in property_names if name]
    full_source_retry = bool(source_item) and not property_names
    if not property_names and not full_source_retry:
        return []

    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "google_ads"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "google_ads")
    db.update_data_collection_status(
        collection_id,
        "in_progress",
        notes="Google Ads targeted retry worker is running." if not full_source_retry else "Google Ads source-level retry worker is running.",
        increment_retry_attempts=True,
    )

    sys.path.insert(0, str(ROOT / "Portfolio_Dashboard" / "scripts"))
    from collect_google_ads_data import GoogleAdsCollector, GoogleAdsCollectorBootstrapError

    yesterday = datetime.now().date() - timedelta(days=1)
    try:
        collector = GoogleAdsCollector(test_mode=False, property_names=None if full_source_retry else property_names)
    except GoogleAdsCollectorBootstrapError as exc:
        error_text = str(exc)[:400]
        for item in property_items:
            property_name = str(item.get("property_name") or item.get("property_id") or "").strip()
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="google_ads",
                property_id=property_name,
                property_name=property_name,
                attempt_count=int(item.get("attempt_count") or 0) + 1,
                status="pending",
                retry_disposition="retryable_later",
                next_attempt_at=_next_retry_time(now, "google_ads", 60),
                last_error_type="bootstrap_blocked",
                last_error_message=error_text,
                notes="Google Ads retry worker was blocked before collector bootstrap completed.",
            )
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="google_ads",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="google_ads source retry",
            attempt_count=1,
            status="pending",
            retry_disposition="retryable_later",
            next_attempt_at=_next_retry_time(now, "google_ads", 60),
            last_error_type="bootstrap_blocked",
            last_error_message=error_text,
                notes="Google Ads retry worker was blocked before collector bootstrap completed.",
            )
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="google_ads",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="google_ads source retry",
            attempt_count=int((source_item or {}).get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="retryable_later",
            next_attempt_at=_next_retry_time(now, "google_ads", 60),
            last_error_type="bootstrap_blocked",
            last_error_message=error_text,
            notes="Google Ads retry worker was blocked before collector bootstrap completed.",
        )
        db.update_data_collection_status(
            collection_id,
            "blocked",
            notes="Google Ads retry worker blocked before collector bootstrap completed.",
            error_message=error_text,
        )
        return [{"source": "google_ads", "action": "bootstrap_blocked", "note": error_text[:160]}]
    collector.run(start_date=yesterday, end_date=yesterday)

    actions: List[Dict[str, object]] = []
    for property_name in collector.results.get("success_properties") or []:
        db.resolve_collection_retry_queue(collection_date, "google_ads", property_name, notes="Recovered by Google Ads retry worker")
        actions.append({"source": "google_ads", "property": property_name, "action": "retried_success"})
    for property_name in collector.results.get("no_activity_properties") or []:
        db.resolve_collection_retry_queue(
            collection_date,
            "google_ads",
            property_name,
            notes="Google Ads retry found no activity for the date; resolved as non-failure.",
        )
        actions.append({"source": "google_ads", "property": property_name, "action": "resolved_no_activity"})
    remaining_failed = set(collector.results.get("failed_properties") or [])
    summary_error = '; '.join(
        f"{err.get('property')}: {err.get('error')}"
        for err in (collector.results.get('errors') or [])[:5]
    ) or None
    for item in property_items:
        property_name = str(item.get("property_name") or item.get("property_id") or "").strip()
        if property_name in remaining_failed:
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="google_ads",
                property_id=property_name,
                property_name=property_name,
                attempt_count=int(item.get("attempt_count") or 0) + 1,
                status="pending",
                retry_disposition="retryable_later",
                next_attempt_at=_next_retry_time(now, "google_ads", 60),
                last_error_type="retryable_later",
                last_error_message="Google Ads retry worker did not recover the property.",
                notes="Google Ads retry worker attempt did not recover the property.",
            )
            actions.append({"source": "google_ads", "property": property_name, "action": "retried_failed"})
    if full_source_retry:
        for property_name in remaining_failed:
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="google_ads",
                property_id=property_name,
                property_name=property_name,
                attempt_count=1,
                status="pending",
                retry_disposition="retryable_later",
                next_attempt_at=_next_retry_time(now, "google_ads", 60),
                last_error_type="retryable_later",
                last_error_message="Initial Google Ads source-level retry did not recover the property.",
                notes="Initial Google Ads source-level retry did not recover the property.",
            )
            actions.append({"source": "google_ads", "property": property_name, "action": "queued_property_after_source_retry"})

    if not remaining_failed:
        db.resolve_collection_retry_queue(
            collection_date,
            "google_ads",
            None,
            notes="Google Ads retry worker cleared all queued source-level work.",
        )
    else:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="google_ads",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="google_ads source retry",
            attempt_count=1,
            status="pending",
            retry_disposition="retryable_later",
            next_attempt_at=_next_retry_time(now, "google_ads", 60),
            last_error_type="retryable_later",
            last_error_message=f"Google Ads still open ({len(remaining_failed)} property retry item(s) queued).",
            notes=f"Google Ads still open ({len(remaining_failed)} property retry item(s) queued).",
        )

    total_properties = len(collector.get_properties_with_google_ads())
    db.complete_data_collection(
        collection_id=collection_id,
        properties_collected=len(collector.results.get("success_properties") or []),
        properties_failed=len(remaining_failed),
        error_message=summary_error,
        properties_total=total_properties,
        properties_success=len(collector.results.get("success_properties") or []),
        properties_skipped=len(collector.results.get("no_activity_properties") or []),
        status="completed" if not remaining_failed else "retry_scheduled",
        notes=(
            "Google Ads retry worker cleared all queued properties; no-activity cases were resolved as non-failures."
            if not remaining_failed
            else f"Google Ads retry worker ran; {len(remaining_failed)} property retry item(s) still queued after resolving no-activity cases."
        ),
    )
    return actions


def _retry_guest_card(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    if is_guest_card_harvest_suspended():
        queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="guest_card")
        for item in queue_items:
            property_id = str(item.get("property_id") or "")
            db.resolve_collection_retry_queue(
                collection_date,
                "guest_card",
                None if property_id == SOURCE_LEVEL_PROPERTY_ID else property_id,
                notes="Guest card harvest is intentionally suspended.",
            )
        return [{"source": "guest_card", "action": "suspended"}] if queue_items else []

    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="guest_card")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    if not source_item:
        return []

    collector = GuestCardCollector(db_path=DB_PATH)
    pending_files = collector.get_pending_files()
    actions: List[Dict[str, object]] = []
    if not pending_files:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="guest_card",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="guest_card source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "guest_card", 30),
            last_error_type="manual_dependency",
            last_error_message="Guest card files have not landed yet.",
            notes="Guest card retry worker checked the drop; files have not landed yet.",
        )
        actions.append({"source": "guest_card", "action": "waiting_for_manual_drop"})
        return actions

    result = collector.ingest_pending_files(collection_id=None)
    if result.files_processed > 0 and result.files_failed == 0:
        db.resolve_collection_retry_queue(collection_date, "guest_card", None, notes=f"Processed {result.files_processed} guest card file(s).")
        actions.append({"source": "guest_card", "action": "retried_success", "note": f"files_processed={result.files_processed}"})
    else:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="guest_card",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="guest_card source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "guest_card", 30),
            last_error_type="manual_dependency",
            last_error_message="Guest card retry did not clear all pending files.",
            notes=f"Guest card retry processed {result.files_processed} file(s) with {result.files_failed} failures.",
        )
        actions.append({"source": "guest_card", "action": "retried_partial"})
    return actions


def _retry_bi_report(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="bi_report")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    if not source_item:
        return []

    actions: List[Dict[str, object]] = []
    pending_files = get_pending_bi_workbooks(db_path=DB_PATH)
    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "bi_report"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "bi_report")
    db.update_data_collection_status(
        collection_id,
        "in_progress",
        notes="BI report retry worker is running.",
        increment_retry_attempts=True,
    )

    if not pending_files:
        db.resolve_collection_retry_queue(collection_date, "bi_report", None, notes="No pending BI workbooks remain in the drop.")
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=0,
            properties_failed=0,
            properties_total=0,
            properties_success=0,
            properties_skipped=1,
            status="completed",
            notes="No pending BI workbooks remained for retry.",
        )
        actions.append({"source": "bi_report", "action": "resolved_no_pending_files"})
        return actions

    result = ingest_bi_workbooks(db_path=DB_PATH, workbook_paths=pending_files)
    if result.files_processed > 0 and result.files_failed == 0:
        db.resolve_collection_retry_queue(collection_date, "bi_report", None, notes=f"Processed {result.files_processed} BI workbook(s).")
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=result.files_processed,
            properties_failed=0,
            properties_total=result.files_found,
            properties_success=result.files_processed,
            properties_skipped=result.files_skipped,
            status="completed",
            notes=(
                f"BI retry worker processed snapshots for: {', '.join(result.snapshot_dates)}."
                if result.snapshot_dates else "BI retry worker completed successfully."
            ),
        )
        actions.append({"source": "bi_report", "action": "retried_success", "note": f"files_processed={result.files_processed}"})
    else:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="bi_report",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="bi_report source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "bi_report", 30),
            last_error_type="manual_dependency",
            last_error_message="BI retry did not clear all pending workbooks.",
            notes=f"BI retry processed {result.files_processed} workbook(s) with {result.files_failed} failures.",
        )
        db.update_data_collection_status(
            collection_id,
            "partial" if result.files_processed > 0 else "blocked",
            notes="BI retry worker did not clear all pending workbooks.",
            error_message="; ".join(result.errors)[:400] if result.errors else "BI retry did not clear all pending workbooks.",
        )
        actions.append({"source": "bi_report", "action": "retried_partial", "note": "; ".join(result.errors)[:160]})
    return actions


def _retry_unit_availability(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="unit_availability")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    if not source_item:
        return []

    actions: List[Dict[str, object]] = []
    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "unit_availability"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "unit_availability")
    db.update_data_collection_status(
        collection_id,
        "in_progress",
        notes="Unit availability retry worker is running.",
        increment_retry_attempts=True,
    )
    try:
        result = ThirtyLinesCollector(db_path=DB_PATH).ingest()
        if int(result.properties_mapped or 0) > 0:
            db.resolve_collection_retry_queue(collection_date, "unit_availability", None, notes=f"ThirtyLines retry mapped {result.properties_mapped} properties.")
            db.complete_data_collection(
                collection_id=collection_id,
                properties_collected=int(result.properties_mapped or 0),
                properties_failed=0,
                properties_total=int(result.properties_mapped or 0),
                properties_success=int(result.properties_mapped or 0),
                status="completed",
                notes="Unit availability retry worker completed successfully.",
            )
            actions.append({"source": "unit_availability", "action": "retried_success"})
        else:
            raise RuntimeError("ThirtyLines retry produced no mapped properties")
    except Exception as exc:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="unit_availability",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="unit_availability source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="retryable_later",
            next_attempt_at=_next_retry_time(now, "unit_availability", 45),
            last_error_type="retryable_later",
            last_error_message=str(exc)[:400],
            notes="Unit availability retry worker attempt failed.",
        )
        db.update_data_collection_status(
            collection_id,
            "blocked",
            notes="Unit availability retry worker attempt failed.",
            error_message=str(exc)[:400],
        )
        actions.append({"source": "unit_availability", "action": "retried_failed", "note": str(exc)[:160]})
    return actions


def _retry_d1_mirror(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="d1_mirror")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    if not source_item:
        return []

    d1_script = ROOT / "apps" / "api" / "scripts" / "d1_mirror_sync.py"
    actions: List[Dict[str, object]] = []
    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "d1_mirror"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "d1_mirror")
    db.update_data_collection_status(
        collection_id,
        "in_progress",
        notes="D1 mirror retry worker is running.",
        increment_retry_attempts=True,
    )
    result = subprocess.run(
        [sys.executable, str(d1_script)],
        capture_output=True,
        text=True,
        timeout=2700,
        env=build_wrangler_runtime_env(),
    )
    if result.returncode == 0:
        db.resolve_collection_retry_queue(collection_date, "d1_mirror", None, notes="D1 mirror retry worker completed successfully.")
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=1,
            properties_failed=0,
            properties_total=1,
            properties_success=1,
            status="completed",
            notes="D1 mirror retry worker completed successfully.",
        )
        actions.append({"source": "d1_mirror", "action": "retried_success"})
    else:
        tail = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()[-300:]
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="d1_mirror",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="d1_mirror source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="retryable_later",
            next_attempt_at=_next_retry_time(now, "d1_mirror", 45),
            last_error_type="retryable_later",
            last_error_message=tail or f"exit={result.returncode}",
            notes="D1 mirror retry worker attempt failed.",
        )
        db.update_data_collection_status(
            collection_id,
            "blocked",
            notes="D1 mirror retry worker attempt failed.",
            error_message=tail or f"exit={result.returncode}",
        )
        actions.append({"source": "d1_mirror", "action": "retried_failed", "note": tail or f"exit={result.returncode}"})
    return actions


def run_retry_worker(dry_run: bool = False) -> Dict[str, object]:
    now = local_now()
    collection_date = now.date()
    db = DatabaseManager(DB_PATH)

    actions: List[Dict[str, object]] = []
    if not dry_run:
        actions.extend(_archive_historical_retry_debt(db, now))

    latest_runs = {
        str(row.get("data_source") or "").strip().lower(): row
        for row in db.get_latest_collection_runs(collection_date)
    }

    if not dry_run:
        actions.extend(_record_initial_retry_queue(db, collection_date, latest_runs, now))

    pending_guest_card_files = [] if is_guest_card_harvest_suspended() else GuestCardCollector(db_path=DB_PATH).get_pending_files()
    if pending_guest_card_files and not dry_run:
        _queue_retry(
            db,
            collection_date,
            "guest_card",
            SOURCE_LEVEL_PROPERTY_ID,
            "guest_card source retry",
            1,
            "manual_dependency",
            f"{len(pending_guest_card_files)} pending guest card file(s) detected in drop.",
            _next_retry_time(now, "guest_card"),
        )
    pending_bi_workbooks = get_pending_bi_workbooks(db_path=DB_PATH)
    if pending_bi_workbooks and not dry_run:
        _queue_retry(
            db,
            collection_date,
            "bi_report",
            SOURCE_LEVEL_PROPERTY_ID,
            "bi_report source retry",
            1,
            "manual_dependency",
            f"{len(pending_bi_workbooks)} pending BI workbook(s) detected in drop.",
            _next_retry_time(now, "bi_report"),
        )

    if not dry_run:
        needs_canonical_retry = any(
            db.get_retry_queue_items(collection_date, unresolved_only=True, data_source=source)
            for source in ("ga4", "gsc")
        )
        canonical_collector = _get_initialized_collector() if needs_canonical_retry else None
        if canonical_collector is not None:
            actions.extend(_retry_ga4(db, collection_date, now, canonical_collector))
            actions.extend(_retry_gsc(db, collection_date, now, canonical_collector))
        actions.extend(_retry_google_ads(db, collection_date, now))
        actions.extend(_retry_guest_card(db, collection_date, now))
        actions.extend(_retry_bi_report(db, collection_date, now))
        actions.extend(_retry_unit_availability(db, collection_date, now))
        actions.extend(_retry_d1_mirror(db, collection_date, now))

    closure = evaluate_daily_collection_closure(DB_PATH, target_date=collection_date, now=now)
    return {
        "ran_at": now.isoformat(),
        "collection_date": collection_date.isoformat(),
        "dry_run": dry_run,
        "actions": actions,
        "closure": closure,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Retry incomplete daily collections")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and plan retries without mutating state")
    parser.add_argument("--json", action="store_true", help="Print JSON summary")
    args = parser.parse_args()

    result = run_retry_worker(dry_run=args.dry_run)
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print(f"Retry worker ran at {result['ran_at']}")
        print(f"Collection date: {result['collection_date']}")
        print(f"Actions recorded: {len(result['actions'])}")
        for action in result["actions"]:
            print(f" - {action['source']}: {action['action']} | {action.get('note', '')}")
        print(f"Closure state: {result['closure']['state']} ({result['closure']['summary_reason']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
