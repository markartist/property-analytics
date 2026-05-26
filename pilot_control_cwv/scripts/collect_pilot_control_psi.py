#!/usr/bin/env python3
"""
Collect PageSpeed Insights metrics for the pilot/control CWV cohort.

Writes into a dedicated table so new vanity-domain history stays separate from
portfolio-wide `pagespeed_metrics`.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

import requests

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"
REQUEST_TIMEOUT = 120
DEFAULT_RETRIES = 3
DEFAULT_RETRY_DELAY = 3.0


TABLE_DDL = """
CREATE TABLE IF NOT EXISTS pilot_control_psi_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cohort_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    property_id TEXT,
    site_url TEXT NOT NULL,
    metric_date DATE NOT NULL,
    strategy TEXT NOT NULL,
    performance_score INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    seo_score INTEGER,
    pwa_score INTEGER,
    lcp_value REAL,
    cls_value REAL,
    fcp_value REAL,
    ttfb_value REAL,
    speed_index REAL,
    time_to_interactive REAL,
    total_blocking_time REAL,
    interaction_to_next_paint REAL,
    selected_run_number INTEGER,
    lcp_element_snippet TEXT,
    lcp_element_url TEXT,
    render_blocking_wasted_ms REAL,
    unused_javascript_wasted_bytes INTEGER,
    unused_javascript_top_url TEXT,
    unused_css_wasted_bytes INTEGER,
    unused_css_top_url TEXT,
    bootup_time_ms REAL,
    mainthread_work_ms REAL,
    diagnostics_total_byte_weight INTEGER,
    diagnostics_num_requests INTEGER,
    diagnostics_main_document_transfer_size INTEGER,
    lighthouse_final_url TEXT,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cohort_key, metric_date, strategy)
);
CREATE INDEX IF NOT EXISTS idx_pilot_control_psi_key_date
    ON pilot_control_psi_metrics(cohort_key, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_control_psi_role
    ON pilot_control_psi_metrics(role);

CREATE TABLE IF NOT EXISTS pilot_control_psi_raw_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cohort_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    property_id TEXT,
    site_url TEXT NOT NULL,
    metric_date DATE NOT NULL,
    strategy TEXT NOT NULL,
    run_number INTEGER NOT NULL,
    performance_score INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    seo_score INTEGER,
    pwa_score INTEGER,
    lcp_value REAL,
    cls_value REAL,
    fcp_value REAL,
    ttfb_value REAL,
    speed_index REAL,
    time_to_interactive REAL,
    total_blocking_time REAL,
    interaction_to_next_paint REAL,
    lcp_element_snippet TEXT,
    lcp_element_url TEXT,
    render_blocking_wasted_ms REAL,
    unused_javascript_wasted_bytes INTEGER,
    unused_javascript_top_url TEXT,
    unused_css_wasted_bytes INTEGER,
    unused_css_top_url TEXT,
    bootup_time_ms REAL,
    mainthread_work_ms REAL,
    diagnostics_total_byte_weight INTEGER,
    diagnostics_num_requests INTEGER,
    diagnostics_main_document_transfer_size INTEGER,
    lighthouse_final_url TEXT,
    raw_payload_json TEXT NOT NULL,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cohort_key, metric_date, strategy, run_number)
);
CREATE INDEX IF NOT EXISTS idx_pilot_control_psi_raw_key_date
    ON pilot_control_psi_raw_runs(cohort_key, metric_date DESC, run_number ASC);
"""


@dataclass
class CohortEntry:
    key: str
    display_name: str
    role: str
    property_id: Optional[str]
    site_url: str
    history_source: str
    sister_key: Optional[str]
    active: bool


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def active_entries(config: Dict[str, object]) -> List[CohortEntry]:
    entries: List[CohortEntry] = []
    for row in config.get("cohorts", []):
        if not row.get("active", True):
            continue
        entries.append(
            CohortEntry(
                key=row["key"],
                display_name=row["display_name"],
                role=row["role"],
                property_id=row.get("property_id"),
                site_url=row["site_url"],
                history_source=row.get("history_source", "dedicated"),
                sister_key=row.get("sister_key"),
                active=bool(row.get("active", True)),
            )
        )
    return entries


def score_to_pct(value: Optional[float]) -> Optional[int]:
    if value is None:
        return None
    return int(round(value * 100))


def audit_value(payload: Dict[str, object], name: str) -> Optional[float]:
    audits = payload.get("lighthouseResult", {}).get("audits", {})
    metric = audits.get(name, {})
    numeric = metric.get("numericValue")
    if numeric is None:
        return None
    return float(numeric)


def audit_details(payload: Dict[str, object], name: str) -> Dict[str, object]:
    audits = payload.get("lighthouseResult", {}).get("audits", {})
    metric = audits.get(name, {})
    details = metric.get("details")
    return details if isinstance(details, dict) else {}


def first_detail_item(payload: Dict[str, object], name: str) -> Dict[str, object]:
    details = audit_details(payload, name)
    items = details.get("items")
    if isinstance(items, list) and items:
        first = items[0]
        if isinstance(first, dict):
            return first
    return {}


def aggregate_wasted_bytes(payload: Dict[str, object], name: str) -> Optional[int]:
    details = audit_details(payload, name)
    items = details.get("items")
    if not isinstance(items, list):
        return None
    wasted = 0
    found = False
    for item in items:
        if not isinstance(item, dict):
            continue
        value = item.get("wastedBytes")
        if value is None:
            continue
        wasted += int(round(float(value)))
        found = True
    return wasted if found else None


def lcp_element_fields(payload: Dict[str, object]) -> tuple[Optional[str], Optional[str]]:
    item = first_detail_item(payload, "largest-contentful-paint-element")
    if not item:
        return None, None
    node = item.get("node")
    snippet = None
    if isinstance(node, dict):
        snippet = node.get("snippet") or node.get("nodeLabel")
    url = item.get("url")
    return snippet, url if isinstance(url, str) else None


def extract_diagnostics(payload: Dict[str, object]) -> Dict[str, object]:
    lcp_snippet, lcp_url = lcp_element_fields(payload)
    diagnostics_item = first_detail_item(payload, "diagnostics")
    return {
        "lcp_element_snippet": lcp_snippet,
        "lcp_element_url": lcp_url,
        "render_blocking_wasted_ms": audit_value(payload, "render-blocking-resources"),
        "unused_javascript_wasted_bytes": aggregate_wasted_bytes(payload, "unused-javascript"),
        "unused_javascript_top_url": first_detail_item(payload, "unused-javascript").get("url"),
        "unused_css_wasted_bytes": aggregate_wasted_bytes(payload, "unused-css-rules"),
        "unused_css_top_url": first_detail_item(payload, "unused-css-rules").get("url"),
        "bootup_time_ms": audit_value(payload, "bootup-time"),
        "mainthread_work_ms": audit_value(payload, "mainthread-work-breakdown"),
        "diagnostics_total_byte_weight": diagnostics_item.get("totalByteWeight"),
        "diagnostics_num_requests": diagnostics_item.get("numRequests"),
        "diagnostics_main_document_transfer_size": diagnostics_item.get("mainDocumentTransferSize"),
    }


def collect_psi(
    api_key: str,
    url: str,
    strategy: str,
    retries: int = DEFAULT_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> Dict[str, object]:
    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(
                "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
                params={
                    "url": url,
                    "strategy": strategy,
                    "key": api_key,
                    "category": ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"],
                },
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # pragma: no cover - runtime/network errors
            last_error = exc
            if attempt == retries:
                break
            sleep_for = retry_delay * attempt
            print(f"    retry {attempt}/{retries - 1} in {sleep_for:.1f}s after: {exc}")
            time.sleep(sleep_for)
    raise RuntimeError(f"PSI collection failed after {retries} attempts: {last_error}")


def extract_metrics(payload: Dict[str, object]) -> Dict[str, object]:
    categories = payload.get("lighthouseResult", {}).get("categories", {})
    perf = categories.get("performance", {})
    access = categories.get("accessibility", {})
    best = categories.get("best-practices", {})
    seo = categories.get("seo", {})
    pwa = categories.get("pwa", {})

    metrics = {
        "performance_score": score_to_pct(perf.get("score")),
        "accessibility_score": score_to_pct(access.get("score")),
        "best_practices_score": score_to_pct(best.get("score")),
        "seo_score": score_to_pct(seo.get("score")),
        "pwa_score": score_to_pct(pwa.get("score")),
        "lcp_value": (audit_value(payload, "largest-contentful-paint") or 0.0) / 1000 or None,
        "cls_value": audit_value(payload, "cumulative-layout-shift"),
        "fcp_value": (audit_value(payload, "first-contentful-paint") or 0.0) / 1000 or None,
        "ttfb_value": audit_value(payload, "server-response-time"),
        "speed_index": (audit_value(payload, "speed-index") or 0.0) / 1000 or None,
        "time_to_interactive": (audit_value(payload, "interactive") or 0.0) / 1000 or None,
        "total_blocking_time": audit_value(payload, "total-blocking-time"),
        "interaction_to_next_paint": audit_value(payload, "interaction-to-next-paint"),
        "lighthouse_final_url": payload.get("lighthouseResult", {}).get("finalUrl"),
    }
    metrics.update(extract_diagnostics(payload))
    return metrics


def best_metric_run(run_records: List[Dict[str, object]]) -> Dict[str, object]:
    if not run_records:
        raise ValueError("metric_runs cannot be empty")

    # Use the strongest single Lighthouse run so stored scores align more closely
    # with the best manual PSI result the team sees in the UI.
    ranked = sorted(
        enumerate(run_records),
        key=lambda item: (
            item[1]["metrics"].get("performance_score") is not None,
            item[1]["metrics"].get("performance_score", -1),
        ),
        reverse=True,
    )
    return dict(run_records[ranked[0][0]])


def ensure_column(
    conn: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_type: str,
) -> None:
    existing = {
        row[1]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in existing:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(TABLE_DDL)
    metric_columns = {
        "selected_run_number": "INTEGER",
        "lcp_element_snippet": "TEXT",
        "lcp_element_url": "TEXT",
        "render_blocking_wasted_ms": "REAL",
        "unused_javascript_wasted_bytes": "INTEGER",
        "unused_javascript_top_url": "TEXT",
        "unused_css_wasted_bytes": "INTEGER",
        "unused_css_top_url": "TEXT",
        "bootup_time_ms": "REAL",
        "mainthread_work_ms": "REAL",
        "diagnostics_total_byte_weight": "INTEGER",
        "diagnostics_num_requests": "INTEGER",
        "diagnostics_main_document_transfer_size": "INTEGER",
    }
    for column_name, column_type in metric_columns.items():
        ensure_column(conn, "pilot_control_psi_metrics", column_name, column_type)
    conn.commit()


def upsert_metric(
    conn: sqlite3.Connection,
    entry: CohortEntry,
    metric_date: str,
    strategy: str,
    selected_run_number: int,
    metrics: Dict[str, object],
) -> None:
    conn.execute(
        """
        INSERT INTO pilot_control_psi_metrics (
            cohort_key, display_name, role, property_id, site_url, metric_date, strategy,
            performance_score, accessibility_score, best_practices_score, seo_score, pwa_score,
            lcp_value, cls_value, fcp_value, ttfb_value, speed_index, time_to_interactive,
            total_blocking_time, interaction_to_next_paint, selected_run_number,
            lcp_element_snippet, lcp_element_url, render_blocking_wasted_ms,
            unused_javascript_wasted_bytes, unused_javascript_top_url,
            unused_css_wasted_bytes, unused_css_top_url,
            bootup_time_ms, mainthread_work_ms,
            diagnostics_total_byte_weight, diagnostics_num_requests,
            diagnostics_main_document_transfer_size, lighthouse_final_url
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(cohort_key, metric_date, strategy) DO UPDATE SET
            display_name = excluded.display_name,
            role = excluded.role,
            property_id = excluded.property_id,
            site_url = excluded.site_url,
            performance_score = excluded.performance_score,
            accessibility_score = excluded.accessibility_score,
            best_practices_score = excluded.best_practices_score,
            seo_score = excluded.seo_score,
            pwa_score = excluded.pwa_score,
            lcp_value = excluded.lcp_value,
            cls_value = excluded.cls_value,
            fcp_value = excluded.fcp_value,
            ttfb_value = excluded.ttfb_value,
            speed_index = excluded.speed_index,
            time_to_interactive = excluded.time_to_interactive,
            total_blocking_time = excluded.total_blocking_time,
            interaction_to_next_paint = excluded.interaction_to_next_paint,
            selected_run_number = excluded.selected_run_number,
            lcp_element_snippet = excluded.lcp_element_snippet,
            lcp_element_url = excluded.lcp_element_url,
            render_blocking_wasted_ms = excluded.render_blocking_wasted_ms,
            unused_javascript_wasted_bytes = excluded.unused_javascript_wasted_bytes,
            unused_javascript_top_url = excluded.unused_javascript_top_url,
            unused_css_wasted_bytes = excluded.unused_css_wasted_bytes,
            unused_css_top_url = excluded.unused_css_top_url,
            bootup_time_ms = excluded.bootup_time_ms,
            mainthread_work_ms = excluded.mainthread_work_ms,
            diagnostics_total_byte_weight = excluded.diagnostics_total_byte_weight,
            diagnostics_num_requests = excluded.diagnostics_num_requests,
            diagnostics_main_document_transfer_size = excluded.diagnostics_main_document_transfer_size,
            lighthouse_final_url = excluded.lighthouse_final_url,
            collected_at = CURRENT_TIMESTAMP
        """,
        (
            entry.key,
            entry.display_name,
            entry.role,
            entry.property_id,
            entry.site_url,
            metric_date,
            strategy,
            metrics["performance_score"],
            metrics["accessibility_score"],
            metrics["best_practices_score"],
            metrics["seo_score"],
            metrics["pwa_score"],
            metrics["lcp_value"],
            metrics["cls_value"],
            metrics["fcp_value"],
            metrics["ttfb_value"],
            metrics["speed_index"],
            metrics["time_to_interactive"],
            metrics["total_blocking_time"],
            metrics["interaction_to_next_paint"],
            selected_run_number,
            metrics["lcp_element_snippet"],
            metrics["lcp_element_url"],
            metrics["render_blocking_wasted_ms"],
            metrics["unused_javascript_wasted_bytes"],
            metrics["unused_javascript_top_url"],
            metrics["unused_css_wasted_bytes"],
            metrics["unused_css_top_url"],
            metrics["bootup_time_ms"],
            metrics["mainthread_work_ms"],
            metrics["diagnostics_total_byte_weight"],
            metrics["diagnostics_num_requests"],
            metrics["diagnostics_main_document_transfer_size"],
            metrics["lighthouse_final_url"],
        ),
    )


def upsert_raw_run(
    conn: sqlite3.Connection,
    entry: CohortEntry,
    metric_date: str,
    strategy: str,
    run_number: int,
    metrics: Dict[str, object],
    payload: Dict[str, object],
) -> None:
    conn.execute(
        """
        INSERT INTO pilot_control_psi_raw_runs (
            cohort_key, display_name, role, property_id, site_url, metric_date, strategy, run_number,
            performance_score, accessibility_score, best_practices_score, seo_score, pwa_score,
            lcp_value, cls_value, fcp_value, ttfb_value, speed_index, time_to_interactive,
            total_blocking_time, interaction_to_next_paint,
            lcp_element_snippet, lcp_element_url, render_blocking_wasted_ms,
            unused_javascript_wasted_bytes, unused_javascript_top_url,
            unused_css_wasted_bytes, unused_css_top_url,
            bootup_time_ms, mainthread_work_ms,
            diagnostics_total_byte_weight, diagnostics_num_requests,
            diagnostics_main_document_transfer_size, lighthouse_final_url,
            raw_payload_json
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(cohort_key, metric_date, strategy, run_number) DO UPDATE SET
            display_name = excluded.display_name,
            role = excluded.role,
            property_id = excluded.property_id,
            site_url = excluded.site_url,
            performance_score = excluded.performance_score,
            accessibility_score = excluded.accessibility_score,
            best_practices_score = excluded.best_practices_score,
            seo_score = excluded.seo_score,
            pwa_score = excluded.pwa_score,
            lcp_value = excluded.lcp_value,
            cls_value = excluded.cls_value,
            fcp_value = excluded.fcp_value,
            ttfb_value = excluded.ttfb_value,
            speed_index = excluded.speed_index,
            time_to_interactive = excluded.time_to_interactive,
            total_blocking_time = excluded.total_blocking_time,
            interaction_to_next_paint = excluded.interaction_to_next_paint,
            lcp_element_snippet = excluded.lcp_element_snippet,
            lcp_element_url = excluded.lcp_element_url,
            render_blocking_wasted_ms = excluded.render_blocking_wasted_ms,
            unused_javascript_wasted_bytes = excluded.unused_javascript_wasted_bytes,
            unused_javascript_top_url = excluded.unused_javascript_top_url,
            unused_css_wasted_bytes = excluded.unused_css_wasted_bytes,
            unused_css_top_url = excluded.unused_css_top_url,
            bootup_time_ms = excluded.bootup_time_ms,
            mainthread_work_ms = excluded.mainthread_work_ms,
            diagnostics_total_byte_weight = excluded.diagnostics_total_byte_weight,
            diagnostics_num_requests = excluded.diagnostics_num_requests,
            diagnostics_main_document_transfer_size = excluded.diagnostics_main_document_transfer_size,
            lighthouse_final_url = excluded.lighthouse_final_url,
            raw_payload_json = excluded.raw_payload_json,
            collected_at = CURRENT_TIMESTAMP
        """,
        (
            entry.key,
            entry.display_name,
            entry.role,
            entry.property_id,
            entry.site_url,
            metric_date,
            strategy,
            run_number,
            metrics["performance_score"],
            metrics["accessibility_score"],
            metrics["best_practices_score"],
            metrics["seo_score"],
            metrics["pwa_score"],
            metrics["lcp_value"],
            metrics["cls_value"],
            metrics["fcp_value"],
            metrics["ttfb_value"],
            metrics["speed_index"],
            metrics["time_to_interactive"],
            metrics["total_blocking_time"],
            metrics["interaction_to_next_paint"],
            metrics["lcp_element_snippet"],
            metrics["lcp_element_url"],
            metrics["render_blocking_wasted_ms"],
            metrics["unused_javascript_wasted_bytes"],
            metrics["unused_javascript_top_url"],
            metrics["unused_css_wasted_bytes"],
            metrics["unused_css_top_url"],
            metrics["bootup_time_ms"],
            metrics["mainthread_work_ms"],
            metrics["diagnostics_total_byte_weight"],
            metrics["diagnostics_num_requests"],
            metrics["diagnostics_main_document_transfer_size"],
            metrics["lighthouse_final_url"],
            json.dumps(payload, separators=(",", ":"), sort_keys=True),
        ),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect PSI for the pilot/control cohort")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to cohort config JSON")
    parser.add_argument(
        "--date",
        default=date.today().isoformat(),
        help="Metric date to stamp on collected rows (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--strategies",
        nargs="+",
        default=["mobile"],
        choices=["mobile", "desktop"],
        help="PSI strategies to collect",
    )
    parser.add_argument("--limit", type=int, default=0, help="Optional limit for testing")
    parser.add_argument(
        "--runs",
        type=int,
        default=3,
        help="Number of PSI runs per property/strategy; the best run is stored as the reported score",
    )
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="Retry attempts per PSI request")
    parser.add_argument(
        "--retry-delay",
        type=float,
        default=DEFAULT_RETRY_DELAY,
        help="Base seconds between PSI retries; multiplies by attempt number",
    )
    args = parser.parse_args()

    config_path = Path(args.config)
    config = load_config(config_path)
    entries = active_entries(config)
    if args.limit > 0:
        entries = entries[: args.limit]

    api_key_path = Path(config["pagespeed_api_key_path"])
    api_key = api_key_path.read_text().strip()
    db_path = Path(config["db_path"])

    conn = sqlite3.connect(db_path)
    ensure_schema(conn)

    success = 0
    failures = 0
    missing: List[str] = []

    for entry in entries:
        print(f"\n[{entry.display_name}] {entry.site_url}")
        for strategy in args.strategies:
            try:
                run_records: List[Dict[str, object]] = []
                run_scores: List[Optional[int]] = []
                for run_idx in range(1, args.runs + 1):
                    payload = collect_psi(
                        api_key,
                        entry.site_url,
                        strategy,
                        retries=args.retries,
                        retry_delay=args.retry_delay,
                    )
                    metrics = extract_metrics(payload)
                    run_records.append(
                        {
                            "run_number": run_idx,
                            "metrics": metrics,
                            "payload": payload,
                        }
                    )
                    run_scores.append(metrics["performance_score"])
                    upsert_raw_run(conn, entry, args.date, strategy, run_idx, metrics, payload)

                best_run = best_metric_run(run_records)
                metrics = best_run["metrics"]
                upsert_metric(conn, entry, args.date, strategy, best_run["run_number"], metrics)
                conn.commit()
                success += 1
                print(
                    f"  {strategy:<7} score={metrics['performance_score']} "
                    f"best_run={best_run['run_number']} "
                    f"runs={run_scores} lcp={metrics['lcp_value']} cls={metrics['cls_value']}"
                )
            except Exception as exc:  # pragma: no cover - runtime/network errors
                failures += 1
                missing.append(f"{entry.display_name} [{strategy}]")
                print(f"  {strategy:<7} FAILED: {exc}")

    conn.close()
    expected = len(entries) * len(args.strategies)
    print(f"\nExpected rows={expected} Success={success} Failed={failures}")
    if missing:
        print("Missing:")
        for item in missing:
            print(f"  - {item}")
    print(f"\nDone. Success={success} Failed={failures}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
