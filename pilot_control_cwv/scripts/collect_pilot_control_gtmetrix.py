#!/usr/bin/env python3
"""
Collect GTMetrix metrics for the pilot/control cohort and persist them to the shared DB.
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import sys

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
sys.path.insert(0, str(REPO_ROOT))

from Data_Collection.collectors.gtmetrix_collector import GTMetrixCollector, GTMetrixSettings
from Data_Collection.db.database_manager import DatabaseManager


DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"
OUTPUT_DIR = BASE_DIR / "reports"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RATE_LIMIT_DIR = OUTPUT_DIR / "gtmetrix_credit_guard"
RATE_LIMIT_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class GTMetrixTarget:
    key: str
    display_name: str
    role: str
    property_id: Optional[str]
    site_url: str
    active: bool


@dataclass
class GTMetrixErrorDecision:
    category: str
    retryable_now: bool
    stop_queue_for_day: bool


EXIT_PARTIAL_FAILURE = 1
EXIT_RATE_LIMITED = 2
EXIT_CREDITS_EXHAUSTED = 3


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def load_targets(config: Dict[str, object], roles: Optional[set[str]] = None) -> List[GTMetrixTarget]:
    rows: List[GTMetrixTarget] = []
    for row in config.get("cohorts", []):
        if not row.get("active", True):
            continue
        if roles and row["role"] not in roles:
            continue
        rows.append(
            GTMetrixTarget(
                key=row["key"],
                display_name=row["display_name"],
                role=row["role"],
                property_id=row.get("property_id"),
                site_url=row["site_url"],
                active=bool(row.get("active", True)),
            )
        )
    return rows


def filter_targets_by_property_ids(
    targets: List[GTMetrixTarget], property_ids: set[str]
) -> List[GTMetrixTarget]:
    return [target for target in targets if target.property_id and target.property_id in property_ids]


def existing_gtmetrix_property_ids(db_path: Path, metric_date: str) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            """
            SELECT DISTINCT property_id
            FROM gtmetrix_metrics
            WHERE metric_date = ?
            """,
            (metric_date,),
        ).fetchall()
        return {str(row[0]) for row in rows if row and row[0]}
    finally:
        conn.close()


def write_csv(rows: List[Dict[str, object]], out_path: Path) -> None:
    if not rows:
        out_path.write_text("", encoding="utf-8")
        return
    fieldnames = [
        "metric_date",
        "cohort_key",
        "display_name",
        "role",
        "property_id",
        "site_url",
        "pagespeed_score",
        "yslow_score",
        "structure_score",
        "fully_loaded_time_ms",
        "onload_time_ms",
        "first_contentful_paint_ms",
        "time_to_interactive_ms",
        "page_bytes",
        "page_requests",
        "test_server_location",
        "test_browser",
        "report_url",
        "test_id",
        "raw_state",
        "runs_requested",
        "runs_completed",
        "run_pagespeed_scores",
        "run_structure_scores",
        "run_fully_loaded_time_ms",
        "status",
        "error",
    ]
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def append_rate_limit_snapshots(run_date: str, target: GTMetrixTarget, snapshots: List[Dict[str, object]]) -> None:
    if not snapshots:
        return
    out_path = RATE_LIMIT_DIR / f"gtmetrix_rate_limit_{run_date}.jsonl"
    with out_path.open("a", encoding="utf-8") as fh:
        for snapshot in snapshots:
            payload = {
                "logged_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "metric_date": run_date,
                "property_id": target.property_id,
                "display_name": target.display_name,
                "site_url": target.site_url,
                **snapshot,
            }
            fh.write(json.dumps(payload) + "\n")


def average_metric(results: List[Dict[str, object]], key: str) -> Optional[float]:
    values = [result.get(key) for result in results if result.get(key) is not None]
    if not values:
        return None
    return sum(values) / len(values)


def merge_results(results: List[Dict[str, object]]) -> Dict[str, object]:
    merged = {
        "pagespeed_score": average_metric(results, "pagespeed_score"),
        "yslow_score": average_metric(results, "yslow_score"),
        "structure_score": average_metric(results, "structure_score"),
        "fully_loaded_time_ms": average_metric(results, "fully_loaded_time_ms"),
        "onload_time_ms": average_metric(results, "onload_time_ms"),
        "first_contentful_paint_ms": average_metric(results, "first_contentful_paint_ms"),
        "time_to_interactive_ms": average_metric(results, "time_to_interactive_ms"),
        "page_bytes": average_metric(results, "page_bytes"),
        "page_requests": average_metric(results, "page_requests"),
        "test_server_location": results[-1].get("test_server_location") if results else None,
        "test_browser": results[-1].get("test_browser") if results else None,
        "report_url": results[-1].get("report_url") if results else None,
        "test_id": results[-1].get("test_id") if results else None,
        "raw_state": results[-1].get("raw_state") if results else None,
        "runs_completed": len(results),
        "run_pagespeed_scores": "|".join(str(result.get("pagespeed_score", "")) for result in results),
        "run_structure_scores": "|".join(str(result.get("structure_score", "")) for result in results),
        "run_fully_loaded_time_ms": "|".join(str(result.get("fully_loaded_time_ms", "")) for result in results),
    }
    return merged


def classify_gtmetrix_error(message: str) -> GTMetrixErrorDecision:
    text = (message or "").lower()

    if "insufficient api credits" in text or "credits exhausted" in text:
        return GTMetrixErrorDecision(
            category="credits_exhausted",
            retryable_now=False,
            stop_queue_for_day=True,
        )
    if "429" in text or "too many requests" in text or "retry_after=" in text:
        return GTMetrixErrorDecision(
            category="rate_limited",
            retryable_now=False,
            stop_queue_for_day=True,
        )
    if "timed out" in text or "read timeout" in text:
        return GTMetrixErrorDecision(
            category="timeout",
            retryable_now=True,
            stop_queue_for_day=False,
        )
    if "connection aborted" in text or "remote end closed connection" in text or "broken pipe" in text:
        return GTMetrixErrorDecision(
            category="connection",
            retryable_now=True,
            stop_queue_for_day=False,
        )
    return GTMetrixErrorDecision(
        category="other",
        retryable_now=False,
        stop_queue_for_day=False,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect GTMetrix metrics for pilot/control properties")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to pilot/control config")
    parser.add_argument("--date", default=date.today().isoformat(), help="Metric date label (YYYY-MM-DD)")
    parser.add_argument("--roles", nargs="+", choices=["pilot", "control"], default=["pilot", "control"])
    parser.add_argument("--limit", type=int, default=0, help="Optional target limit for testing")
    parser.add_argument("--max-wait-seconds", type=int, default=480, help="GTMetrix test wait timeout")
    parser.add_argument("--poll-interval-seconds", type=int, default=10, help="GTMetrix poll interval")
    parser.add_argument("--runs", type=int, default=3, help="Number of GTMetrix runs per property")
    parser.add_argument("--batch-size", type=int, default=2, help="Properties per batch before pausing")
    parser.add_argument("--batch-delay-seconds", type=int, default=120, help="Pause between batches")
    parser.add_argument("--property-retries", type=int, default=1, help="Additional full-property retry attempts after failure")
    parser.add_argument("--retry-delay-seconds", type=int, default=30, help="Pause before retrying a failed property")
    parser.add_argument("--property-ids", nargs="+", help="Optional subset of property_ids to collect")
    parser.add_argument(
        "--missing-only-for-date",
        action="store_true",
        help="Only collect targets that do not already have GTMetrix rows for --date",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))
    targets = load_targets(config, set(args.roles))
    db_path = Path(config["db_path"])
    requested_property_ids = {pid.strip() for pid in (args.property_ids or []) if pid and pid.strip()}
    if requested_property_ids:
        targets = filter_targets_by_property_ids(targets, requested_property_ids)
    if args.missing_only_for_date:
        existing_ids = existing_gtmetrix_property_ids(db_path, args.date)
        targets = [target for target in targets if target.property_id and target.property_id not in existing_ids]
    if args.limit > 0:
        targets = targets[: args.limit]

    if not targets:
        print(f"No GTMetrix targets require collection for {args.date}.")
        return 0

    db = DatabaseManager(db_path)
    collector = GTMetrixCollector(
        GTMetrixSettings(
            api_key_path=Path(
                config.get(
                    "gtmetrix_api_key_path",
                    "/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/GTMetrix_API_Key.txt",
                )
            ),
            location=str(config.get("gtmetrix_location", "4")),
            browser=str(config.get("gtmetrix_browser", "3")),
            simulate_device=config.get("gtmetrix_simulate_device"),
            throttle=config.get("gtmetrix_throttle"),
            poll_interval_seconds=args.poll_interval_seconds,
            max_wait_seconds=args.max_wait_seconds,
        )
    )
    gtmetrix_preset_label = str(config.get("gtmetrix_preset_label", "default"))

    collection_id = db.start_data_collection(args.date, "daily", "gtmetrix")
    successes = 0
    failures = 0
    error_messages: List[str] = []
    output_rows: List[Dict[str, object]] = []
    stop_reason: Optional[str] = None

    print(
        f"Collecting GTMetrix for {len(targets)} pilot/control properties on {args.date} "
        f"with {args.runs} runs/property, batch_size={args.batch_size}, batch_delay={args.batch_delay_seconds}s, "
        f"preset={gtmetrix_preset_label}"
    )
    for idx, target in enumerate(targets, start=1):
        if stop_reason:
            failures += 1
            output_rows.append(
                {
                    "metric_date": args.date,
                    "cohort_key": target.key,
                    "display_name": target.display_name,
                    "role": target.role,
                    "property_id": target.property_id or "",
                    "site_url": target.site_url,
                    "runs_requested": args.runs,
                    "runs_completed": 0,
                    "run_pagespeed_scores": "",
                    "run_structure_scores": "",
                    "run_fully_loaded_time_ms": "",
                    "status": "deferred",
                    "error": f"Deferred after queue stop: {stop_reason}",
                }
            )
            print(f"{idx}/{len(targets)}. {target.display_name} ({target.role})")
            print(f"   ⏸️  Deferred after queue stop: {stop_reason}")
            continue

        if idx > 1 and args.batch_size > 0 and (idx - 1) % args.batch_size == 0:
            print(f"Pausing {args.batch_delay_seconds}s before next batch...")
            time.sleep(args.batch_delay_seconds)

        print(f"{idx}/{len(targets)}. {target.display_name} ({target.role})")
        if not target.property_id:
            failures += 1
            error = "Missing property_id"
            error_messages.append(f"{target.display_name}: {error}")
            output_rows.append(
                {
                    "metric_date": args.date,
                    "cohort_key": target.key,
                    "display_name": target.display_name,
                    "role": target.role,
                    "property_id": "",
                    "site_url": target.site_url,
                    "runs_requested": args.runs,
                    "runs_completed": 0,
                    "run_pagespeed_scores": "",
                    "run_structure_scores": "",
                    "run_fully_loaded_time_ms": "",
                    "status": "failed",
                    "error": error,
                }
            )
            print(f"   ❌ {error}")
            continue

        last_error = ""
        result: Optional[Dict[str, object]] = None
        for attempt in range(args.property_retries + 1):
            try:
                if attempt > 0:
                    print(f"   Retry {attempt}/{args.property_retries} after failure...")
                    time.sleep(args.retry_delay_seconds)
                run_results: List[Dict[str, object]] = []
                for run_index in range(1, args.runs + 1):
                    print(f"   Run {run_index}/{args.runs}...")
                    run_results.append(collector.run_test(target.site_url))
                    append_rate_limit_snapshots(args.date, target, collector.consume_rate_limit_snapshots())
                result = merge_results(run_results)
                break
            except Exception as exc:
                append_rate_limit_snapshots(args.date, target, collector.consume_rate_limit_snapshots())
                last_error = str(exc)[:200]
                decision = classify_gtmetrix_error(last_error)
                print(f"   ❌ {last_error}")
                print(f"   ↳ classified as {decision.category}")
                if decision.stop_queue_for_day:
                    stop_reason = decision.category
                    print(f"GTMETRIX_STOP_REASON={stop_reason}")
                    break
                if not decision.retryable_now:
                    break

        if result is not None:
            db.insert_gtmetrix_metrics(
                property_id=target.property_id,
                metric_date=args.date,
                data=result,
                collection_id=collection_id,
            )
            successes += 1
            output_rows.append(
                {
                    "metric_date": args.date,
                    "cohort_key": target.key,
                    "display_name": target.display_name,
                    "role": target.role,
                    "property_id": target.property_id,
                    "site_url": target.site_url,
                    **result,
                    "runs_requested": args.runs,
                    "status": "success",
                    "error": "",
                }
            )
            print(
                f"   ✅ Avg PS {result.get('pagespeed_score'):.1f} | "
                f"Avg Structure {result.get('structure_score'):.1f} | "
                f"Avg Load {result.get('fully_loaded_time_ms'):.1f}ms"
            )
        else:
            failures += 1
            error = last_error or "Unknown GTMetrix collection failure"
            error_messages.append(f"{target.display_name}: {error}")
            output_rows.append(
                {
                    "metric_date": args.date,
                    "cohort_key": target.key,
                    "display_name": target.display_name,
                    "role": target.role,
                    "property_id": target.property_id,
                    "site_url": target.site_url,
                    "runs_requested": args.runs,
                    "runs_completed": 0,
                    "run_pagespeed_scores": "",
                    "run_structure_scores": "",
                    "run_fully_loaded_time_ms": "",
                    "status": "failed",
                    "error": error,
                }
            )

    db.complete_data_collection(
        collection_id=collection_id,
        properties_collected=successes,
        properties_failed=failures,
        error_message="; ".join(error_messages[:5]) if error_messages else None,
    )

    out_path = OUTPUT_DIR / f"Pilot_Control_GTMetrix_{args.date}.csv"
    write_csv(output_rows, out_path)
    print(f"\nSaved GTMetrix CSV: {out_path}")
    print(f"Collection summary: success={successes} failed={failures}")
    if stop_reason == "rate_limited":
        return EXIT_RATE_LIMITED
    if stop_reason == "credits_exhausted":
        return EXIT_CREDITS_EXHAUSTED
    return 0 if failures == 0 else EXIT_PARTIAL_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
