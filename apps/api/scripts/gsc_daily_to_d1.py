#!/usr/bin/env python3
"""
GSC Daily Metrics → D1 Sync
============================
Mirrors raw gsc_daily_metrics from canonical portfolio_analytics.db into D1
so the GSC Snapshot API can compute trailing 30-day aggregations on-the-fly.

Usage:
  # Sync all available daily data:
  python3 gsc_daily_to_d1.py

  # Sync last N days only:
  python3 gsc_daily_to_d1.py --days 90

  # Dry run:
  python3 gsc_daily_to_d1.py --dry-run
"""

import argparse
import json
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SCRIPT_DIR = Path(__file__).parent
API_DIR = SCRIPT_DIR.parent
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
REPO_ROOT = API_DIR.parent.parent
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"


def _get_community_map() -> Dict[str, dict]:
    """Fetch ga4_property_id → {id, name} from D1 communities."""
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
            "--command", "SELECT id, ga4_property_id, name "
                         "FROM communities "
                         "WHERE ga4_property_id IS NOT NULL AND deleted_at IS NULL;",
            "--config", str(WRANGLER_TOML),
            "--json",
        ],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        print(f"❌ Wrangler query failed: {result.stderr[:200]}")
        return {}

    try:
        data = json.loads(result.stdout)
        rows = data[0]["results"] if isinstance(data, list) else data.get("results", [])
        mapping = {}
        for row in rows:
            ga4_id = row["ga4_property_id"].strip()
            mapping[ga4_id] = {"id": row["id"], "name": row.get("name", "")}
        print(f"📊 Loaded {len(mapping)} communities from D1")
        return mapping
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"❌ Failed to parse wrangler output: {e}")
        return {}


def _connect_canonical() -> sqlite3.Connection:
    if not CANONICAL_DB.exists():
        print(f"❌ Canonical DB not found: {CANONICAL_DB}")
        sys.exit(1)
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _sql_val(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"


def fetch_daily_rows(
    conn: sqlite3.Connection,
    community_map: Dict[str, dict],
    days: Optional[int] = None,
) -> List[dict]:
    """
    Read gsc_daily_metrics from canonical DB.
    Groups by COALESCE(ga4_property_id, property_id) to match the report logic,
    then maps to D1 community_id.
    """
    date_filter = ""
    params: tuple = ()
    if days:
        date_filter = "WHERE metric_date >= date('now', ?)"
        params = (f"-{days} days",)

    query = f"""
        SELECT
            COALESCE(ga4_property_id, property_id) AS pid,
            metric_date,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            CASE WHEN SUM(impressions) > 0
                THEN ROUND(SUM(clicks) * 1.0 / SUM(impressions) * 100, 4)
                ELSE NULL END AS ctr,
            ROUND(AVG(average_position), 1) AS average_position
        FROM gsc_daily_metrics
        {date_filter}
        GROUP BY pid, metric_date
    """
    rows = conn.execute(query, params).fetchall()

    result = []
    unmapped = set()
    for r in rows:
        pid = r["pid"]
        info = community_map.get(pid)
        if not info:
            unmapped.add(pid)
            continue
        result.append({
            "community_id": info["id"],
            "metric_date": r["metric_date"],
            "clicks": r["clicks"] or 0,
            "impressions": r["impressions"] or 0,
            "ctr": r["ctr"],
            "average_position": r["average_position"],
        })

    if unmapped:
        print(f"⚠️  {len(unmapped)} unmapped property IDs skipped")
    print(f"📊 {len(result)} daily rows ready for D1")
    return result


def generate_sql(rows: List[dict], now: str) -> List[str]:
    """Generate INSERT OR REPLACE SQL for gsc_daily_metrics."""
    sql_lines = [
        "-- Auto-generated: GSC Daily Metrics → D1 sync",
        f"-- Generated: {now}",
        f"-- Rows: {len(rows)}",
        "",
    ]
    for row in rows:
        new_id = str(uuid.uuid4())
        sql_lines.append(
            f"INSERT OR REPLACE INTO gsc_daily_metrics "
            f"(id, community_id, metric_date, clicks, impressions, ctr, average_position, synced_at) "
            f"VALUES ("
            f"COALESCE("
            f"(SELECT id FROM gsc_daily_metrics WHERE community_id = {_sql_val(row['community_id'])} AND metric_date = {_sql_val(row['metric_date'])}), "
            f"'{new_id}'), "
            f"{_sql_val(row['community_id'])}, "
            f"{_sql_val(row['metric_date'])}, "
            f"{_sql_val(row['clicks'])}, "
            f"{_sql_val(row['impressions'])}, "
            f"{_sql_val(row['ctr'])}, "
            f"{_sql_val(row['average_position'])}, "
            f"'{now}');"
        )
    return sql_lines


def execute_sql(sql_file: Path) -> bool:
    for attempt in range(1, 4):
        print(f"🚀 Executing against D1... (attempt {attempt}/3)")
        result = subprocess.run(
            [
                "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
                f"--file={sql_file}",
                "--config", str(WRANGLER_TOML),
            ],
            capture_output=True, text=True, timeout=600,
            input="y\n",
        )
        if result.returncode == 0:
            print("✅ D1 execute succeeded")
            return True

        stderr_tail = (result.stderr or "")[-800:]
        stdout_tail = (result.stdout or "")[-400:]
        print(f"❌ D1 execute failed: {stderr_tail or stdout_tail}")
        if attempt < 3:
            print("   Retrying in 5s...")
            time.sleep(5)

    print(f"   SQL file saved at: {sql_file}")
    return False


def main():
    parser = argparse.ArgumentParser(description="GSC Daily Metrics → D1 Sync")
    parser.add_argument("--days", type=int, help="Sync last N days only (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Generate SQL but don't execute")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"📊 GSC DAILY METRICS → D1 SYNC")
    print(f"{'='*60}")

    community_map = _get_community_map()
    if not community_map:
        print("❌ No community mapping — aborting")
        sys.exit(1)

    conn = _connect_canonical()
    print(f"📁 Canonical DB: {CANONICAL_DB}")

    rows = fetch_daily_rows(conn, community_map, days=args.days)
    conn.close()

    if not rows:
        print("❌ No data to sync")
        sys.exit(1)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    sql_lines = generate_sql(rows, now)

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if args.dry_run:
        sql_file = GENERATED_DIR / f"gsc_daily_{ts}.sql"
        with open(sql_file, "w") as f:
            f.write("\n".join(sql_lines))
        print(f"\n🏷️  DRY RUN — SQL written to {sql_file}")
        return

    # D1 has statement limits; batch large payloads
    data_lines = [l for l in sql_lines if l.startswith("INSERT")]
    header = [l for l in sql_lines if not l.startswith("INSERT")]

    BATCH_SIZE = 500
    if len(data_lines) <= BATCH_SIZE:
        sql_file = GENERATED_DIR / f"gsc_daily_{ts}.sql"
        with open(sql_file, "w") as f:
            f.write("\n".join(sql_lines))
        success = execute_sql(sql_file)
    else:
        batch_num = 0
        success = True
        for i in range(0, len(data_lines), BATCH_SIZE):
            batch_num += 1
            batch_lines = header + data_lines[i:i + BATCH_SIZE]
            batch_file = GENERATED_DIR / f"gsc_daily_{ts}_batch{batch_num}.sql"
            with open(batch_file, "w") as f:
                f.write("\n".join(batch_lines))
            print(f"\n📦 Batch {batch_num}: {len(data_lines[i:i + BATCH_SIZE])} rows")
            if batch_num > 1:
                time.sleep(3)
            if not execute_sql(batch_file):
                success = False
                break

    if not success:
        sys.exit(1)

    print(f"\n✅ GSC daily metrics sync complete! ({len(data_lines)} rows)")


if __name__ == "__main__":
    main()
