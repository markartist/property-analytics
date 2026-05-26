#!/usr/bin/env python3
"""Execute same-morning retries for incomplete daily collections."""

from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set

_data_collection_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, _data_collection_root)

from Data_Collection.collectors.guest_card_collector import GuestCardCollector
from Data_Collection.collectors.thirtylines_collector import ThirtyLinesCollector
from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.orchestration.daily_master_collection import PortfolioDataCollector
from Data_Collection.utils.bi_manual_ingest import get_pending_bi_workbooks, ingest_bi_workbooks
from Data_Collection.utils.operating_metrics_ingest import (
    OPERATING_MISSING_FILE_MESSAGE,
    OPERATING_RECOMMENDED_FILENAME,
    get_pending_operating_metric_files,
    ingest_operating_metric_files,
)
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
    evaluate_source_freshness,
    is_guest_card_harvest_suspended,
    is_prelaunch_registry_property,
)


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
RETRY_ELIGIBLE_ADVISORY_SOURCES = ("psi", "property_operating_metrics")


def _get_initialized_collector() -> PortfolioDataCollector:
    collector = PortfolioDataCollector(test_mode=False, quick_mode=True, no_gtmetrix=True)
    collector.initialize_collectors()
    return collector


def _latest_guest_card_date() -> str | None:
    with sqlite3.connect(str(DB_PATH)) as conn:
        row = conn.execute("SELECT MAX(run_date) FROM guest_card_metrics").fetchone()
    return row[0] if row and row[0] else None


def _next_retry_time(now: datetime, source: str, minutes: int | None = None) -> datetime:
    if minutes is not None:
        return now + timedelta(minutes=minutes)
    if source in MANUAL_DEPENDENCY_SOURCES:
        return now + timedelta(minutes=30)
    return now + timedelta(minutes=20)


def _psi_actual_coverage(collection_date) -> Dict[str, object]:
    registry = json.loads((ROOT / "config" / "venterra_properties_official.json").read_text(encoding="utf-8"))
    expected_ids = [prop.get("ga4_property_id") for prop in registry.get("properties", []) if prop.get("ga4_property_id")]
    if not expected_ids:
        return {
            "expected_total": 0,
            "full_success": 0,
            "incomplete_property_ids": [],
        }

    placeholders = ",".join("?" for _ in expected_ids)
    with sqlite3.connect(str(DB_PATH)) as conn:
        rows = conn.execute(
            f"""
            SELECT property_id,
                   SUM(CASE WHEN strategy='mobile' THEN 1 ELSE 0 END) AS mobile_rows,
                   SUM(CASE WHEN strategy='desktop' THEN 1 ELSE 0 END) AS desktop_rows
            FROM pagespeed_metrics
            WHERE metric_date = ?
              AND property_id IN ({placeholders})
            GROUP BY property_id
            """,
            [collection_date.isoformat(), *expected_ids],
        ).fetchall()

    coverage = {
        str(row[0]): {
            "mobile": int(row[1] or 0),
            "desktop": int(row[2] or 0),
        }
        for row in rows
    }
    incomplete_property_ids = [
        ga4_id
        for ga4_id in expected_ids
        if not (coverage.get(ga4_id, {}).get("mobile", 0) > 0 and coverage.get(ga4_id, {}).get("desktop", 0) > 0)
    ]
    return {
        "expected_total": len(expected_ids),
        "full_success": len(expected_ids) - len(incomplete_property_ids),
        "incomplete_property_ids": incomplete_property_ids,
    }


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
    queue_status = "manual_wait" if retry_disposition == "manual_dependency" else status
    db.upsert_collection_retry_queue(
        collection_date=collection_date,
        data_source=source,
        property_id=property_id,
        property_name=property_name,
        attempt_count=attempt_count,
        status=queue_status,
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

    for source in (*CORE_SOURCES, *RETRY_ELIGIBLE_ADVISORY_SOURCES):
        if is_guest_card_harvest_suspended() and source == "guest_card":
            continue
        run = latest_runs.get(source)
        if run is None:
            property_id = SOURCE_LEVEL_PROPERTY_ID
            key = (source, property_id)
            if key not in existing_keys:
                retry_disposition = "manual_dependency" if source in MANUAL_DEPENDENCY_SOURCES else "retryable_later"
                note = (
                    f"{OPERATING_MISSING_FILE_MESSAGE} Expected filename pattern: {OPERATING_RECOMMENDED_FILENAME}"
                    if source == "property_operating_metrics"
                    else "No collection run recorded yet for this tracked source; keeping the day open for follow-up."
                )
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


def _retry_psi(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="psi")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    if not source_item:
        return []

    psi_script = ROOT / "Portfolio_Dashboard" / "scripts" / "collect_daily_psi.py"
    if not psi_script.exists():
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="psi",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="psi source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="retryable_later",
            next_attempt_at=_next_retry_time(now, "psi", 45),
            last_error_type="missing_script",
            last_error_message=f"PSI collector script missing: {psi_script}",
            notes="PSI retry worker could not find collect_daily_psi.py.",
        )
        return [{"source": "psi", "action": "missing_script"}]

    actual_coverage = _psi_actual_coverage(collection_date)
    incomplete_property_ids = list(actual_coverage["incomplete_property_ids"])
    if not incomplete_property_ids:
        latest_run = next(
            (
                row
                for row in db.get_latest_collection_runs(collection_date)
                if str(row.get("data_source") or "").strip().lower() == "psi"
            ),
            None,
        )
        if latest_run and str(latest_run.get("status") or "").strip().lower() != "completed":
            db.complete_data_collection(
                int(latest_run["collection_id"]),
                properties_collected=int(actual_coverage["full_success"]),
                properties_failed=0,
                status="completed",
                properties_total=int(actual_coverage["expected_total"]),
                properties_success=int(actual_coverage["full_success"]),
                properties_skipped=0,
                notes="PSI run reconciled to completed after confirming same-day mobile and desktop coverage in stored data.",
                error_message=None,
            )
        db.resolve_collection_retry_queue(collection_date, "psi", None, notes="PSI retry queue resolved after confirming same-day mobile and desktop coverage in stored data.")
        return [{"source": "psi", "action": "resolved_from_actual_coverage"}]

    command = [sys.executable, str(psi_script), "--date", collection_date.isoformat()]
    for property_id in incomplete_property_ids:
        command.extend(["--property-id", property_id])

    result = subprocess.run(
        command,
        timeout=1800,
    )
    latest_run = next(
        (
            row
            for row in db.get_latest_collection_runs(collection_date)
            if str(row.get("data_source") or "").strip().lower() == "psi"
        ),
        None,
    )

    if latest_run:
        latest_status = str(latest_run.get("status") or "").strip().lower()
        latest_notes = str(latest_run.get("notes") or "").strip()
        latest_error = str(latest_run.get("error_message") or "").strip()
        latest_total = int(latest_run.get("properties_total") or 0)
        latest_success = int(latest_run.get("properties_success") or 0)
        latest_failed = int(latest_run.get("properties_failed") or 0)
        note = latest_notes or latest_error or f"PSI retry ended {latest_status}."

        post_retry_coverage = _psi_actual_coverage(collection_date)
        if not post_retry_coverage["incomplete_property_ids"]:
            db.complete_data_collection(
                int(latest_run["collection_id"]),
                properties_collected=int(post_retry_coverage["full_success"]),
                properties_failed=0,
                status="completed",
                properties_total=int(post_retry_coverage["expected_total"]),
                properties_success=int(post_retry_coverage["full_success"]),
                properties_skipped=0,
                notes="PSI retry reconciled to completed after confirming same-day mobile and desktop coverage in stored data.",
                error_message=None,
            )
            db.resolve_collection_retry_queue(collection_date, "psi", None, notes="PSI retry worker completed successfully after actual-coverage reconciliation.")
            return [{"source": "psi", "action": "retried_success", "note": "PSI same-day coverage is now complete."}]

        if latest_status == "completed":
            db.resolve_collection_retry_queue(collection_date, "psi", None, notes="PSI retry worker completed successfully.")
            return [{"source": "psi", "action": "retried_success", "note": note}]

        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="psi",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="psi source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="pending",
            retry_disposition="retryable_later" if latest_status in {"blocked", "failed"} else "retryable_now",
            next_attempt_at=_next_retry_time(now, "psi", 45 if latest_status in {"blocked", "failed"} else 30),
            last_error_type=latest_status or "retryable_now",
            last_error_message=note[:400],
            notes=(
                f"PSI retry worker still incomplete: status={latest_status}, "
                f"success={latest_success}, failed={latest_failed}, total={latest_total}. {note}"
            )[:400],
        )
        return [{"source": "psi", "action": "retried_incomplete", "note": note[:160], "status": latest_status}]

    db.upsert_collection_retry_queue(
        collection_date=collection_date,
        data_source="psi",
        property_id=SOURCE_LEVEL_PROPERTY_ID,
        property_name="psi source retry",
        attempt_count=int(source_item.get("attempt_count") or 0) + 1,
        status="pending",
        retry_disposition="retryable_now",
        next_attempt_at=_next_retry_time(now, "psi", 30),
        last_error_type="missing_run_record",
        last_error_message=f"PSI retry exited {result.returncode} without creating a data_collections row.",
        notes="PSI retry worker did not find a same-day psi run row after executing the collector.",
    )
    return [{"source": "psi", "action": "missing_run_record", "note": f"exit={result.returncode}"}]


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
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    property_items = [item for item in queue_items if str(item.get("property_id") or "") != SOURCE_LEVEL_PROPERTY_ID]
    properties = collector.load_properties()
    property_by_gsc_url = {
        str(prop.get("gsc_url") or "").strip(): prop
        for prop in properties
        if prop.get("gsc_url")
    }
    end_date = datetime.now() - timedelta(days=3)
    start_date = end_date - timedelta(days=29)
    expected_latest = end_date.strftime('%Y-%m-%d')

    if not property_items and source_item:
        latest_dates_by_gsc_url = {}
        with db.get_connection() as conn:
            cursor = conn.cursor()
            for row in cursor.execute(
                """
                SELECT property_id, MAX(metric_date) AS latest_date
                FROM gsc_daily_metrics
                GROUP BY property_id
                """
            ).fetchall():
                latest_dates_by_gsc_url[str(row["property_id"] or "").strip()] = row["latest_date"]

        derived_items: List[Dict[str, object]] = []
        for prop in properties:
            gsc_url = str(prop.get("gsc_url") or "").strip()
            if not gsc_url or is_prelaunch_registry_property(prop):
                continue
            latest_date = latest_dates_by_gsc_url.get(gsc_url)
            if latest_date and str(latest_date) >= expected_latest:
                continue
            derived_items.append({
                "property_id": gsc_url,
                "property_name": prop.get("name") or gsc_url,
                "attempt_count": int(source_item.get("attempt_count") or 0),
            })

        if not derived_items:
            latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "gsc"), None)
            db.resolve_collection_retry_queue(
                collection_date,
                "gsc",
                None,
                notes="No lagging GSC properties remained; cleared stale source-level retry marker.",
            )
            if latest_run:
                db.complete_data_collection(
                    collection_id=int(latest_run["collection_id"]),
                    properties_collected=int(latest_run.get("properties_collected") or latest_run.get("properties_success") or 0),
                    properties_failed=0,
                    properties_total=int(latest_run.get("properties_total") or 0),
                    properties_success=int(latest_run.get("properties_success") or latest_run.get("properties_collected") or 0),
                    properties_skipped=int(latest_run.get("properties_skipped") or 0),
                    status="completed",
                    error_message=None,
                    notes="Stale source-level GSC retry marker cleared; no lagging properties remained.",
                )
            return [{"source": "gsc", "action": "resolved_stale_source_marker"}]

        for item in derived_items:
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="gsc",
                property_id=str(item["property_id"]),
                property_name=str(item["property_name"]),
                attempt_count=int(item.get("attempt_count") or 0),
                status="pending",
                retry_disposition="retryable_now",
                next_attempt_at=_next_retry_time(now, "gsc", 5),
                last_error_type="stale_source_marker",
                last_error_message=f"GSC source-level retry expanded to property-level follow-up for {item['property_name']}.",
                notes=f"Derived from stale source-level GSC retry marker; latest date is older than {expected_latest}.",
            )
        property_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="gsc")
        property_items = [item for item in property_items if str(item.get("property_id") or "") != SOURCE_LEVEL_PROPERTY_ID]

    if not property_items:
        return []

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

    latest_run = next((row for row in db.get_latest_collection_runs(collection_date) if str(row.get("data_source") or "").lower() == "guest_card"), None)
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(collection_date, "daily", "guest_card")
    collector = GuestCardCollector(db_path=DB_PATH)
    pending_files = collector.get_pending_files()
    actions: List[Dict[str, object]] = []
    if not pending_files:
        expectation = evaluate_source_freshness("guest_cards", _latest_guest_card_date())
        if expectation.status in {"fresh", "warning"}:
            db.resolve_collection_retry_queue(
                collection_date,
                "guest_card",
                None,
                notes="Guest card retry marker cleared; no pending files remained and freshness is current.",
            )
            db.complete_data_collection(
                collection_id=collection_id,
                properties_collected=0,
                properties_failed=0,
                properties_total=0,
                properties_success=0,
                properties_skipped=1,
                status="completed",
                error_message=None,
                notes="Guest card retry marker cleared; no pending files remained and freshness was already current.",
            )
            actions.append({"source": "guest_card", "action": "resolved_stale_source_marker"})
        else:
            db.upsert_collection_retry_queue(
                collection_date=collection_date,
                data_source="guest_card",
                property_id=SOURCE_LEVEL_PROPERTY_ID,
                property_name="guest_card source retry",
                attempt_count=int(source_item.get("attempt_count") or 0) + 1,
                status="manual_wait",
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
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=result.files_processed,
            properties_failed=0,
            properties_total=result.files_found,
            properties_success=result.files_processed,
            properties_skipped=max(0, result.files_found - result.files_processed),
            status="completed",
            error_message=None,
            notes=f"Guest card retry worker processed {result.files_processed} guest card file(s).",
        )
        actions.append({"source": "guest_card", "action": "retried_success", "note": f"files_processed={result.files_processed}"})
    else:
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="guest_card",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="guest_card source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="manual_wait",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "guest_card", 30),
            last_error_type="manual_dependency",
            last_error_message="Guest card retry did not clear all pending files.",
            notes=f"Guest card retry processed {result.files_processed} file(s) with {result.files_failed} failures.",
        )
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=result.files_processed,
            properties_failed=max(1, result.files_failed),
            properties_total=result.files_found,
            properties_success=result.files_processed,
            properties_skipped=max(0, result.files_found - result.files_processed - result.files_failed),
            status="blocked" if result.files_processed == 0 else "partial",
            error_message="; ".join(result.errors[:3])[:400] if result.errors else "Guest card retry did not clear all pending files.",
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
        error_text = "; ".join(result.errors[:3])[:400] if result.errors else "BI retry did not clear all pending workbooks."
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="bi_report",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="bi_report source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="manual_wait",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "bi_report", 30),
            last_error_type="invalid_workbook" if result.errors else "manual_dependency",
            last_error_message=error_text,
            notes=(
                f"BI retry processed {result.files_processed} workbook(s) with {result.files_failed} failures. "
                f"{error_text}"
            )[:400],
        )
        db.update_data_collection_status(
            collection_id,
            "partial" if result.files_processed > 0 else "blocked",
            notes="BI retry worker did not clear all pending workbooks.",
            error_message=error_text,
        )
        actions.append({"source": "bi_report", "action": "retried_partial", "note": error_text[:160]})
    return actions


def _retry_property_operating_metrics(db: DatabaseManager, collection_date, now: datetime) -> List[Dict[str, object]]:
    queue_items = db.get_retry_queue_items(collection_date, unresolved_only=True, data_source="property_operating_metrics")
    source_item = next((item for item in queue_items if str(item.get("property_id") or "") == SOURCE_LEVEL_PROPERTY_ID), None)
    if not source_item:
        return []

    actions: List[Dict[str, object]] = []
    pending_files = get_pending_operating_metric_files(db_path=DB_PATH)
    latest_run = next(
        (
            row
            for row in db.get_latest_collection_runs(collection_date)
            if str(row.get("data_source") or "").lower() == "property_operating_metrics"
        ),
        None,
    )
    collection_id = int(latest_run["collection_id"]) if latest_run else db.start_data_collection(
        collection_date,
        "daily",
        "property_operating_metrics",
    )
    db.update_data_collection_status(
        collection_id,
        "in_progress",
        notes="Property operating metrics retry worker is running.",
        increment_retry_attempts=True,
    )

    if not pending_files:
        note = f"{OPERATING_MISSING_FILE_MESSAGE} Expected filename pattern: {OPERATING_RECOMMENDED_FILENAME}"
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="property_operating_metrics",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="property_operating_metrics source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="manual_wait",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "property_operating_metrics", 30),
            last_error_type="missing_operating_metrics_file",
            last_error_message=note,
            notes=note,
        )
        db.update_data_collection_status(
            collection_id,
            "blocked",
            notes=note,
            error_message=OPERATING_MISSING_FILE_MESSAGE,
            increment_retry_attempts=False,
        )
        actions.append({"source": "property_operating_metrics", "action": "waiting_for_official_file", "note": note})
        return actions

    result = ingest_operating_metric_files(db_path=DB_PATH, file_paths=pending_files)
    if result.files_processed > 0 and result.files_failed == 0:
        db.resolve_collection_retry_queue(
            collection_date,
            "property_operating_metrics",
            None,
            notes=f"Processed {result.files_processed} operating metrics file(s).",
        )
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=result.files_processed,
            properties_failed=0,
            properties_total=result.files_found,
            properties_success=result.files_processed,
            properties_skipped=result.files_skipped,
            status="completed",
            notes=(
                f"Operating metrics retry worker processed metric dates: {', '.join(result.metric_dates)}."
                if result.metric_dates else "Operating metrics retry worker completed successfully."
            ),
        )
        actions.append({
            "source": "property_operating_metrics",
            "action": "retried_success",
            "note": f"files_processed={result.files_processed}",
        })
    else:
        error_text = "; ".join(result.errors[:3])[:400] if result.errors else "Operating metrics retry did not clear all pending files."
        db.upsert_collection_retry_queue(
            collection_date=collection_date,
            data_source="property_operating_metrics",
            property_id=SOURCE_LEVEL_PROPERTY_ID,
            property_name="property_operating_metrics source retry",
            attempt_count=int(source_item.get("attempt_count") or 0) + 1,
            status="manual_wait",
            retry_disposition="manual_dependency",
            next_attempt_at=_next_retry_time(now, "property_operating_metrics", 30),
            last_error_type="invalid_operating_metrics_file" if result.errors else "manual_dependency",
            last_error_message=error_text,
            notes=(
                f"Operating metrics retry processed {result.files_processed} file(s) with {result.files_failed} failures. "
                f"{error_text}"
            )[:400],
        )
        db.update_data_collection_status(
            collection_id,
            "partial" if result.files_processed > 0 else "blocked",
            notes="Operating metrics retry worker did not clear all pending files.",
            error_message=error_text,
        )
        actions.append({"source": "property_operating_metrics", "action": "retried_partial", "note": error_text[:160]})
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
    pending_operating_metric_files = get_pending_operating_metric_files(db_path=DB_PATH)
    if pending_operating_metric_files and not dry_run:
        _queue_retry(
            db,
            collection_date,
            "property_operating_metrics",
            SOURCE_LEVEL_PROPERTY_ID,
            "property_operating_metrics source retry",
            1,
            "manual_dependency",
            f"{len(pending_operating_metric_files)} pending operating metrics file(s) detected in drop.",
            _next_retry_time(now, "property_operating_metrics"),
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
        actions.extend(_retry_psi(db, collection_date, now))
        actions.extend(_retry_property_operating_metrics(db, collection_date, now))

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
