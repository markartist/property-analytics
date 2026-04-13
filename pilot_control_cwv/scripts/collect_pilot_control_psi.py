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
    lighthouse_final_url TEXT,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cohort_key, metric_date, strategy)
);
CREATE INDEX IF NOT EXISTS idx_pilot_control_psi_key_date
    ON pilot_control_psi_metrics(cohort_key, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_control_psi_role
    ON pilot_control_psi_metrics(role);
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

    return {
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


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(TABLE_DDL)
    conn.commit()


def upsert_metric(
    conn: sqlite3.Connection,
    entry: CohortEntry,
    metric_date: str,
    strategy: str,
    metrics: Dict[str, object],
) -> None:
    conn.execute(
        """
        INSERT INTO pilot_control_psi_metrics (
            cohort_key, display_name, role, property_id, site_url, metric_date, strategy,
            performance_score, accessibility_score, best_practices_score, seo_score, pwa_score,
            lcp_value, cls_value, fcp_value, ttfb_value, speed_index, time_to_interactive,
            total_blocking_time, interaction_to_next_paint, lighthouse_final_url
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
            metrics["lighthouse_final_url"],
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
                payload = collect_psi(
                    api_key,
                    entry.site_url,
                    strategy,
                    retries=args.retries,
                    retry_delay=args.retry_delay,
                )
                metrics = extract_metrics(payload)
                upsert_metric(conn, entry, args.date, strategy, metrics)
                conn.commit()
                success += 1
                print(
                    f"  {strategy:<7} score={metrics['performance_score']} "
                    f"lcp={metrics['lcp_value']} cls={metrics['cls_value']}"
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
