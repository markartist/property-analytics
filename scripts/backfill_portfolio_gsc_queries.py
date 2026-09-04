#!/usr/bin/env python3
"""Backfill portfolio GSC query rows for an executive search report window.

This runner is intentionally scoped to Search Console query rows. It uses the
existing Keeper-backed GSC collector initialization and DatabaseManager insert
path, then writes a durable run packet under reports/adhoc_executive.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
RUN_ROOT = ROOT / "reports" / "adhoc_executive" / "andrew_foresi_search_backfill"

sys.path.insert(0, str(ROOT))
from Data_Collection.collectors.gsc_collector import GoogleSearchConsoleCollector  # noqa: E402
from Data_Collection.db.database_manager import DatabaseManager  # noqa: E402
from Data_Collection.utils.source_freshness_policy import is_prelaunch_registry_property  # noqa: E402


@dataclass(frozen=True)
class GscProperty:
    name: str
    ga4_property_id: str
    gsc_url: str


def parse_iso(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def iter_chunks(start: date, end: date, chunk_days: int) -> list[tuple[date, date]]:
    chunks: list[tuple[date, date]] = []
    current = start
    while current <= end:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end)
        chunks.append((current, chunk_end))
        current = chunk_end + timedelta(days=1)
    return chunks


def load_properties(limit: int = 0) -> list[GscProperty]:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    output: list[GscProperty] = []
    for prop in registry.get("properties", []):
        if not prop.get("ga4_property_id") or not prop.get("gsc_url"):
            continue
        if prop.get("gsc_access") == "none":
            continue
        if is_prelaunch_registry_property(prop):
            continue
        output.append(
            GscProperty(
                name=str(prop.get("name") or prop.get("property_name") or prop["ga4_property_id"]),
                ga4_property_id=str(prop["ga4_property_id"]),
                gsc_url=str(prop["gsc_url"]),
            )
        )
    output.sort(key=lambda item: item.name.lower())
    return output[:limit] if limit else output


def table_coverage(conn: sqlite3.Connection) -> dict[str, Any]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT
          COUNT(*) AS rows,
          COUNT(DISTINCT COALESCE(ga4_property_id, property_id)) AS properties,
          MIN(metric_date) AS min_date,
          MAX(metric_date) AS max_date
        FROM gsc_queries
        """
    ).fetchone()
    return dict(rows) if rows else {}


def query_gsc_chunk(
    service: Any,
    *,
    site_url: str,
    start: date,
    end: date,
    row_limit: int,
    max_pages: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start_row = 0
    for _page in range(max_pages):
        response = service.searchanalytics().query(
            siteUrl=site_url,
            body={
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "dimensions": ["date", "query"],
                "searchType": "web",
                "aggregationType": "auto",
                "rowLimit": row_limit,
                "startRow": start_row,
            },
        ).execute()
        page_rows = response.get("rows", [])
        rows.extend(page_rows)
        if len(page_rows) < row_limit:
            break
        start_row += row_limit
    return rows


def write_gsc_query_rows(
    db_path: Path,
    *,
    property_id: str,
    gsc_site_url: str,
    ga4_property_id: str,
    collection_id: int | None,
    rows: list[dict[str, Any]],
) -> int:
    """Replace returned property/date query rows in one transaction."""
    parsed_rows: list[tuple[str, str, int | None, int, int, float, float, str, str]] = []
    dates_seen: set[str] = set()
    for row in rows:
        keys = row.get("keys") or []
        if len(keys) < 2:
            continue
        metric_date = str(keys[0])
        query = str(keys[1])
        dates_seen.add(metric_date)
        parsed_rows.append(
            (
                property_id,
                metric_date,
                query,
                collection_id,
                int(row.get("clicks", 0) or 0),
                int(row.get("impressions", 0) or 0),
                float(row.get("ctr", 0) or 0),
                float(row.get("position", 0) or 0),
                gsc_site_url,
                ga4_property_id,
            )
        )
    if not parsed_rows:
        return 0

    with sqlite3.connect(db_path, timeout=60) as conn:
        conn.execute("PRAGMA busy_timeout = 60000")
        cursor = conn.cursor()
        for metric_date in sorted(dates_seen):
            cursor.execute(
                "DELETE FROM gsc_queries WHERE property_id = ? AND metric_date = ?",
                (property_id, metric_date),
            )
        cursor.executemany(
            """
            INSERT INTO gsc_queries
            (property_id, metric_date, query, collection_id,
             clicks, impressions, ctr, average_position,
             gsc_site_url, ga4_property_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            parsed_rows,
        )
    return len(parsed_rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill GSC query rows for the portfolio.")
    parser.add_argument("--start-date", required=True, help="Start date, YYYY-MM-DD")
    parser.add_argument("--end-date", required=True, help="End date, YYYY-MM-DD")
    parser.add_argument("--chunk-days", type=int, default=31, help="Days per API query chunk")
    parser.add_argument("--row-limit", type=int, default=25000, help="GSC API page size, max 25000")
    parser.add_argument("--max-pages", type=int, default=3, help="Max paginated pages per property/chunk")
    parser.add_argument("--limit", type=int, default=0, help="Optional property limit for testing")
    parser.add_argument("--sleep", type=float, default=0.2, help="Delay between property chunks")
    parser.add_argument("--dry-run", action="store_true", help="Fetch rows but do not write them")
    args = parser.parse_args()

    start = parse_iso(args.start_date)
    end = parse_iso(args.end_date)
    if start > end:
        raise RuntimeError("--start-date must be on or before --end-date")
    if args.chunk_days < 1 or args.chunk_days > 92:
        raise RuntimeError("--chunk-days must be between 1 and 92")
    if args.row_limit < 1 or args.row_limit > 25000:
        raise RuntimeError("--row-limit must be between 1 and 25000")
    if args.max_pages < 1:
        raise RuntimeError("--max-pages must be positive")

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = RUN_ROOT / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    props = load_properties(limit=args.limit)
    chunks = iter_chunks(start, end, args.chunk_days)
    request = {
        "run_id": run_id,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "chunk_days": args.chunk_days,
        "row_limit": args.row_limit,
        "max_pages": args.max_pages,
        "property_count": len(props),
        "dry_run": args.dry_run,
    }
    (run_dir / "request.json").write_text(json.dumps(request, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    db = DatabaseManager(DB_PATH)
    with sqlite3.connect(DB_PATH) as conn:
        coverage_before = table_coverage(conn)
    (run_dir / "coverage_before.json").write_text(
        json.dumps(coverage_before, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )

    collector = GoogleSearchConsoleCollector()
    if not collector.service:
        raise RuntimeError("Google Search Console service could not be initialized.")

    collection_id = None
    if not args.dry_run:
        collection_id = db.start_data_collection(
            collection_date=date.today(),
            collection_type="backfill",
            data_source="gsc_queries",
        )

    property_results: list[dict[str, Any]] = []
    total_rows_returned = 0
    total_rows_written = 0
    failed = 0
    success = 0
    skipped = 0

    print(f"GSC query backfill: {start.isoformat()} through {end.isoformat()}")
    print(f"Properties: {len(props)} | chunks/property: {len(chunks)} | dry_run={args.dry_run}")

    for index, prop in enumerate(props, start=1):
        prop_returned = 0
        prop_written = 0
        prop_errors: list[str] = []
        print(f"{index}/{len(props)} {prop.name}")
        for chunk_start, chunk_end in chunks:
            try:
                rows = query_gsc_chunk(
                    collector.service,
                    site_url=prop.gsc_url,
                    start=chunk_start,
                    end=chunk_end,
                    row_limit=args.row_limit,
                    max_pages=args.max_pages,
                )
                prop_returned += len(rows)
                total_rows_returned += len(rows)
                if rows and not args.dry_run:
                    written = write_gsc_query_rows(
                        DB_PATH,
                        property_id=prop.ga4_property_id,
                        gsc_site_url=prop.gsc_url,
                        ga4_property_id=prop.ga4_property_id,
                        collection_id=collection_id,
                        rows=rows,
                    )
                    prop_written += written
                    total_rows_written += written
                print(f"  {chunk_start.isoformat()}..{chunk_end.isoformat()}: {len(rows)} rows")
            except Exception as exc:  # noqa: BLE001 - continue per property/chunk
                message = str(exc)[:300]
                prop_errors.append(f"{chunk_start.isoformat()}..{chunk_end.isoformat()}: {message}")
                print(f"  {chunk_start.isoformat()}..{chunk_end.isoformat()}: ERROR {message[:120]}")
            time.sleep(args.sleep)

        status = "failed" if prop_errors and prop_returned == 0 else "partial" if prop_errors else "success"
        if status == "failed":
            failed += 1
        elif status == "partial":
            success += 1
        elif prop_returned:
            success += 1
        else:
            skipped += 1
        property_results.append(
            {
                **asdict(prop),
                "status": status,
                "rows_returned": prop_returned,
                "rows_written": prop_written,
                "errors": prop_errors,
            }
        )
        print(f"  total: returned={prop_returned} written={prop_written} status={status}")

    summary = {
        **request,
        "collection_id": collection_id,
        "properties_success": success,
        "properties_failed": failed,
        "properties_skipped": skipped,
        "rows_returned": total_rows_returned,
        "rows_written": total_rows_written,
        "completed_at": datetime.now().isoformat(timespec="seconds"),
        "property_results": property_results,
    }
    (run_dir / "backfill_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )

    with sqlite3.connect(DB_PATH) as conn:
        coverage_after = table_coverage(conn)
    (run_dir / "coverage_after.json").write_text(
        json.dumps(coverage_after, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )

    if collection_id is not None:
        error_message = "; ".join(
            f"{row['name']}: {row['errors'][0]}" for row in property_results if row["errors"]
        )[:400] or None
        db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=success,
            properties_failed=failed,
            properties_total=len(props),
            properties_success=success,
            properties_skipped=skipped,
            status="partial" if failed else "completed",
            error_message=error_message,
            notes=f"Andrew Foresi executive search report GSC query backfill; rows_written={total_rows_written}.",
        )

    print(json.dumps({k: summary[k] for k in ("run_id", "rows_returned", "rows_written", "properties_success", "properties_failed", "properties_skipped")}, indent=2))
    print(f"Run packet: {run_dir}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
