#!/usr/bin/env python3
"""Smoke test for Cloudflare GraphQL edge analytics collection."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.collectors.cloudflare_analytics_collector import CloudflareAnalyticsCollector
from Data_Collection.db.database_manager import DatabaseManager
from ops.cloudflare.cloudflare_auth import CloudflareAuthError, resolve_cloudflare_token


def _credentials_present() -> tuple[bool, str]:
    if os.getenv("CLOUDFLARE_API_TOKEN"):
        return True, "env:CLOUDFLARE_API_TOKEN"
    if os.getenv("CLOUDFLARE_API_TOKEN_FILE"):
        return True, "env:CLOUDFLARE_API_TOKEN_FILE"
    if os.getenv("KSM_CLOUDFLARE_TOKEN_NOTATION"):
        return True, "env:KSM_CLOUDFLARE_TOKEN_NOTATION"
    return False, "missing"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Cloudflare edge analytics collection.")
    parser.add_argument("--date", help="Metric date, YYYY-MM-DD. Defaults to previous UTC day.")
    parser.add_argument("--config", default=str(ROOT / "config" / "cloudflare_analytics.yaml"))
    parser.add_argument("--db", default=str(ROOT / "data" / "portfolio_analytics.db"))
    args = parser.parse_args()

    present, source_hint = _credentials_present()
    if not present:
        print("FAIL: Cloudflare credentials are not configured.")
        print("Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_API_TOKEN_FILE, or KSM_CLOUDFLARE_TOKEN_NOTATION.")
        return 2

    try:
        resolved = resolve_cloudflare_token()
        print(f"Credentials: ok ({resolved.source}; detected {source_hint})")
    except CloudflareAuthError as exc:
        print(f"FAIL: Cloudflare credential resolution failed: {exc}")
        return 2

    metric_date = date.fromisoformat(args.date) if args.date else datetime.now(UTC).date() - timedelta(days=1)
    db = DatabaseManager(Path(args.db))
    collection_id = db.start_data_collection(
        collection_date=metric_date,
        collection_type="smoke",
        data_source="cloudflare_edge_analytics_smoke",
    )

    collector = CloudflareAnalyticsCollector(config_path=Path(args.config), db=db)
    result = collector.run(metric_date=metric_date, collection_id=collection_id)
    rows_written = int(result.get("rows_written") or 0)
    zones_failed = int(result.get("zones_failed") or 0)
    status = "completed" if rows_written > 0 and result.get("ok") else "partial"
    db.complete_data_collection(
        collection_id=collection_id,
        properties_collected=rows_written,
        properties_failed=zones_failed,
        properties_total=int(result.get("zones_total") or 0),
        properties_success=rows_written,
        status=status,
        error_message="; ".join(result.get("errors", [])[:3]) if result.get("errors") else None,
        notes="Cloudflare edge analytics smoke test.",
    )

    with sqlite3.connect(args.db) as conn:
        count = conn.execute(
            """
            SELECT COUNT(*)
            FROM cloudflare_edge_daily_metrics
            WHERE metric_date = ?
              AND collection_id = ?
            """,
            (metric_date.isoformat(), collection_id),
        ).fetchone()[0]

    print(json.dumps(result, indent=2, sort_keys=True))
    print(f"Rows written for smoke collection_id={collection_id}: {count}")

    if count <= 0:
        print("FAIL: GraphQL query completed but no Cloudflare rows were written.")
        return 1
    if zones_failed:
        print("WARN: Some Cloudflare zones failed, but rows were written.")
    print("PASS: Cloudflare credentials, GraphQL query, and DB write path are working.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
