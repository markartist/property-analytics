#!/usr/bin/env python3
"""
Guest Card → D1 Sync
=======================
Reads daily guest card metrics from the canonical portfolio_analytics.db,
aggregates them into T7 and T30 windows aligned to Fridays, and pushes
the results to the POP Brief D1 database (t7_metrics and t30_metrics tables).

Data flow:
  canonical DB (prefers guest_card_metrics_dw_direct, falls back to guest_card_metrics)
    → aggregate into T7 window (Friday−6 → Friday)
    → aggregate into T30 window (Friday−29 → Friday)
    → compute conversion rates (v/gc, a/gc)
    → compute WoW/MoM deltas vs previous window
    → compute portfolio averages across all communities
    → generate SQL upserts
    → push to D1 via wrangler

Usage:
  # Sync most recent Friday:
  python3 guest_cards_to_d1.py

  # Sync specific Friday:
  python3 guest_cards_to_d1.py --date 2026-02-14

  # Backfill last N Fridays:
  python3 guest_cards_to_d1.py --weeks 8

  # Backfill all available Fridays:
  python3 guest_cards_to_d1.py --all

  # Dry run (generate SQL but don't execute):
  python3 guest_cards_to_d1.py --weeks 4 --dry-run
"""

import argparse
import json
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from wrangler_auth import build_runtime_env, npx_wrangler_prefix

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
API_DIR = SCRIPT_DIR.parent
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
REPO_ROOT = API_DIR.parent.parent  # ~/Property_Analytics
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"

ACTOR = "guest-card-sync"


# ---------------------------------------------------------------------------
# D1 community mapping
# ---------------------------------------------------------------------------

def _get_community_map() -> Dict[str, str]:
    """Fetch encasa_property_code → D1 community_id mapping from D1 via wrangler."""
    env = build_runtime_env()
    result = subprocess.run(
        npx_wrangler_prefix(env) + [
            "d1", "execute", "pop-brief-db", "--remote",
            "--command", "SELECT id, encasa_property_code FROM communities "
                         "WHERE encasa_property_code IS NOT NULL AND deleted_at IS NULL;",
            "--config", str(WRANGLER_TOML),
            "--json",
        ],
        capture_output=True, text=True, timeout=30,
        env=env,
    )
    if result.returncode != 0:
        print(f"❌ Wrangler query failed: {result.stderr[:200]}")
        return {}

    try:
        data = json.loads(result.stdout)
        rows = data[0]["results"] if isinstance(data, list) else data.get("results", [])
        mapping = {}
        for row in rows:
            code = row["encasa_property_code"].strip().upper()
            mapping[code] = row["id"]
        print(f"📊 Loaded {len(mapping)} community encasa codes from D1")
        return mapping
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"❌ Failed to parse wrangler output: {e}")
        return {}


# ---------------------------------------------------------------------------
# Canonical DB queries
# ---------------------------------------------------------------------------

def _connect_canonical() -> sqlite3.Connection:
    """Open a read-only connection to the canonical portfolio_analytics.db."""
    if not CANONICAL_DB.exists():
        print(f"❌ Canonical DB not found: {CANONICAL_DB}")
        sys.exit(1)
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def _guest_card_source_table(conn: sqlite3.Connection) -> str:
    """Prefer the Data Warehouse direct guest-card feed when it has rows."""
    if _table_exists(conn, "guest_card_metrics_dw_direct"):
        row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM guest_card_metrics_dw_direct"
        ).fetchone()
        if row and int(row["cnt"] or 0) > 0:
            return "guest_card_metrics_dw_direct"
    return "guest_card_metrics"


def get_available_fridays(conn: sqlite3.Connection) -> List[str]:
    """Return all Fridays that fall within the guest card data date range."""
    table = _guest_card_source_table(conn)
    row = conn.execute(
        f"SELECT MIN(run_date) as min_d, MAX(run_date) as max_d FROM {table}"
    ).fetchone()
    if not row or not row["min_d"]:
        return []

    min_d = date.fromisoformat(row["min_d"])
    max_d = date.fromisoformat(row["max_d"])

    # Find first Friday >= min_d + 6  (need 7 days of data for T7 current window)
    first_viable = min_d + timedelta(days=6)
    # Advance to next Friday
    while first_viable.weekday() != 4:  # 4 = Friday
        first_viable += timedelta(days=1)

    fridays = []
    d = first_viable
    while d <= max_d:
        fridays.append(d.isoformat())
        d += timedelta(days=7)

    return fridays


def aggregate_window(
    conn: sqlite3.Connection, start_date: str, end_date: str
) -> Dict[str, Dict]:
    """
    Aggregate guest card data for a date window, grouped by property_code.

    Returns: { property_code: { g_cards, visits, first_tours, apps } }
    """
    query = """
        SELECT
            property_code,
            SUM(gc_this_period)                                AS g_cards,
            SUM(ipt_appt_this_period + sgt_appt_this_period)  AS visits,
            SUM(init_cont_tour)                                AS first_tours,
            SUM(apps_this_period)                              AS apps
        FROM {table}
        WHERE run_date BETWEEN ? AND ?
        GROUP BY property_code
    """.format(table=_guest_card_source_table(conn))
    rows = conn.execute(query, (start_date, end_date)).fetchall()
    return {
        row["property_code"]: {
            "g_cards": row["g_cards"] or 0,
            "visits": row["visits"] or 0,
            "first_tours": row["first_tours"] or 0,
            "apps": row["apps"] or 0,
        }
        for row in rows
    }


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------

def _safe_pct(numerator: int, denominator: int) -> Optional[float]:
    """Compute (numerator / denominator) * 100, or None if denominator is 0."""
    if not denominator:
        return None
    return round((numerator / denominator) * 100, 2)


def _safe_delta(current: Optional[float], prev: Optional[float]) -> Optional[float]:
    """Compute percentage change: ((current - prev) / prev) * 100."""
    if prev is None or current is None:
        return None
    if prev == 0:
        return None  # avoid division by zero
    return round(((current - prev) / prev) * 100, 2)


def _safe_rate_delta(
    current_rate: Optional[float], prev_rate: Optional[float]
) -> Optional[float]:
    """Compute absolute change in a rate (percentage points)."""
    if current_rate is None or prev_rate is None:
        return None
    return round(current_rate - prev_rate, 2)


def compute_community_metrics(
    current: Dict, prev: Optional[Dict]
) -> Dict:
    """
    Given current-window and previous-window aggregates for a single community,
    compute all metrics, conversion rates, and deltas.
    """
    g = current["g_cards"]
    v = current["visits"]
    ft = current["first_tours"]
    a = current["apps"]

    # Conversion rates (only g_cards-based ones are computable from guest card data)
    v_gc_conv = _safe_pct(v, g)
    a_gc_conv = _safe_pct(a, g)

    metrics = {
        # Counts
        "g_cards": g,
        "visits": v,
        "first_tours": ft,
        "apps": a,
        "leases": None,       # not available from guest card data
        "c_and_ds": None,     # not available
        "move_ins": None,     # not available
        # Conversion rates
        "v_gc_conv": v_gc_conv,
        "a_gc_conv": a_gc_conv,
        "l_gc_conv": None,    # needs leases
        "l_v_ratio": None,    # needs leases
        "c_d_pct_of_gcs": None,
        "mi_gc_conv": None,
        "mi_v_ratio": None,
    }

    # Deltas (vs previous window)
    if prev:
        pg = prev["g_cards"]
        pv = prev["visits"]
        pa = prev["apps"]
        prev_v_gc = _safe_pct(pv, pg)
        prev_a_gc = _safe_pct(pa, pg)

        metrics.update({
            "g_cards_delta": _safe_delta(g, pg),
            "visits_delta": _safe_delta(v, pv),
            "apps_delta": _safe_delta(a, pa),
            "leases_delta": None,
            "c_and_ds_delta": None,
            "move_ins_delta": None,
            "v_gc_conv_delta": _safe_rate_delta(v_gc_conv, prev_v_gc),
            "a_gc_conv_delta": _safe_rate_delta(a_gc_conv, prev_a_gc),
            "l_gc_conv_delta": None,
            "l_v_ratio_delta": None,
            "c_d_pct_of_gcs_delta": None,
            "mi_gc_conv_delta": None,
            "mi_v_ratio_delta": None,
        })
    else:
        # No previous window — nulls for all deltas
        for f in [
            "g_cards_delta", "visits_delta", "apps_delta",
            "leases_delta", "c_and_ds_delta", "move_ins_delta",
            "v_gc_conv_delta", "a_gc_conv_delta", "l_gc_conv_delta",
            "l_v_ratio_delta", "c_d_pct_of_gcs_delta",
            "mi_gc_conv_delta", "mi_v_ratio_delta",
        ]:
            metrics[f] = None

    return metrics


def compute_portfolio_averages(community_metrics: List[Dict]) -> Dict:
    """
    Compute portfolio-wide averages from a list of community metric dicts.
    Only averages over non-None values.
    """
    if not community_metrics:
        return {}

    fields = [
        "g_cards", "visits", "first_tours", "apps",
        "v_gc_conv", "a_gc_conv",
        "g_cards_delta", "visits_delta", "apps_delta",
        "v_gc_conv_delta", "a_gc_conv_delta",
    ]

    avgs = {}
    for f in fields:
        vals = [m[f] for m in community_metrics if m.get(f) is not None]
        if vals:
            avgs[f] = round(sum(vals) / len(vals), 2)
        else:
            avgs[f] = None

    # Fill in null fields that we can't compute
    for f in [
        "leases", "c_and_ds", "move_ins",
        "l_gc_conv", "l_v_ratio", "c_d_pct_of_gcs", "mi_gc_conv", "mi_v_ratio",
        "leases_delta", "c_and_ds_delta", "move_ins_delta",
        "l_gc_conv_delta", "l_v_ratio_delta", "c_d_pct_of_gcs_delta",
        "mi_gc_conv_delta", "mi_v_ratio_delta",
    ]:
        if f not in avgs:
            avgs[f] = None

    return avgs


# ---------------------------------------------------------------------------
# SQL generation
# ---------------------------------------------------------------------------

def _sql_val(v) -> str:
    """Format a Python value as a SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return f"'{str(v)}'"


def generate_upserts(
    rows: List[Dict], table: str, now: str
) -> List[str]:
    """
    Generate INSERT-or-UPDATE SQL statements for t7_metrics or t30_metrics.

    Each row dict must contain: community_id, week_date, type, + metric fields.
    """
    sql_lines = []

    metric_fields = [
        "g_cards", "visits", "first_tours", "apps", "leases", "c_and_ds", "move_ins",
        "v_gc_conv", "a_gc_conv", "l_gc_conv", "l_v_ratio",
        "c_d_pct_of_gcs", "mi_gc_conv", "mi_v_ratio",
        "g_cards_delta", "visits_delta", "apps_delta",
        "leases_delta", "c_and_ds_delta", "move_ins_delta",
        "v_gc_conv_delta", "a_gc_conv_delta", "l_gc_conv_delta",
        "l_v_ratio_delta", "c_d_pct_of_gcs_delta",
        "mi_gc_conv_delta", "mi_v_ratio_delta",
    ]

    for row in rows:
        cid = row["community_id"]
        wd = row["week_date"]
        typ = row["type"]
        new_id = str(uuid.uuid4())

        # Build column/value lists for INSERT
        all_cols = ["id", "community_id", "week_date", "type"]
        all_vals = [f"'{new_id}'", f"'{cid}'", f"'{wd}'", f"'{typ}'"]

        for f in metric_fields:
            all_cols.append(f)
            all_vals.append(_sql_val(row.get(f)))

        all_cols.extend(["source_import_run_id", "created_at", "created_by", "updated_at", "updated_by"])
        all_vals.extend(["NULL", f"'{now}'", f"'{ACTOR}'", f"'{now}'", f"'{ACTOR}'"])

        # Build SET clause for UPDATE (only metric fields + audit)
        sets = []
        for f in metric_fields:
            v = row.get(f)
            # Only update non-null fields to avoid clobbering manually-entered data
            # (e.g. leases, c_and_ds, move_ins might be entered manually)
            if v is not None:
                sets.append(f"{f} = {_sql_val(v)}")
        sets.append(f"updated_at = '{now}'")
        sets.append(f"updated_by = '{ACTOR}'")

        # Upsert: INSERT if not exists, then UPDATE
        cols_str = ", ".join(all_cols)
        vals_str = ", ".join(all_vals)
        set_str = ", ".join(sets)

        sql_lines.append(
            f"INSERT INTO {table} ({cols_str}) "
            f"SELECT {vals_str} "
            f"WHERE NOT EXISTS ("
            f"SELECT 1 FROM {table} "
            f"WHERE community_id = '{cid}' AND week_date = '{wd}' AND type = '{typ}'"
            f");"
        )
        sql_lines.append(
            f"UPDATE {table} SET {set_str} "
            f"WHERE community_id = '{cid}' AND week_date = '{wd}' AND type = '{typ}';"
        )

    return sql_lines


# ---------------------------------------------------------------------------
# Main sync logic
# ---------------------------------------------------------------------------

def sync_friday(
    conn: sqlite3.Connection,
    community_map: Dict[str, str],
    friday: str,
    now: str,
) -> Tuple[List[str], int, int]:
    """
    Aggregate guest card data for a single Friday and return SQL upsert lines.

    Returns: (sql_lines, t7_community_count, t30_community_count)
    """
    f = date.fromisoformat(friday)
    sql_lines = []
    t7_count = 0
    t30_count = 0

    # ── T7 ──────────────────────────────────────────────────────────────
    t7_start = (f - timedelta(days=6)).isoformat()
    t7_end = friday
    t7_prev_start = (f - timedelta(days=13)).isoformat()
    t7_prev_end = (f - timedelta(days=7)).isoformat()

    t7_current = aggregate_window(conn, t7_start, t7_end)
    t7_prev = aggregate_window(conn, t7_prev_start, t7_prev_end)

    # Compute per-community T7 metrics
    t7_community_rows = []
    t7_all_metrics = []

    for code, cur in t7_current.items():
        cid = community_map.get(code.upper())
        if not cid:
            continue

        prev = t7_prev.get(code)
        metrics = compute_community_metrics(cur, prev)
        metrics["community_id"] = cid
        metrics["week_date"] = friday
        metrics["type"] = "community"
        t7_community_rows.append(metrics)
        t7_all_metrics.append(metrics)

    # Compute T7 portfolio averages
    t7_portfolio = compute_portfolio_averages(t7_all_metrics)

    # Create portfolio rows (one per community, all with same avg values)
    t7_portfolio_rows = []
    for cm in t7_community_rows:
        prow = dict(t7_portfolio)
        prow["community_id"] = cm["community_id"]
        prow["week_date"] = friday
        prow["type"] = "portfolio"
        t7_portfolio_rows.append(prow)

    sql_lines.extend(generate_upserts(t7_community_rows, "t7_metrics", now))
    sql_lines.extend(generate_upserts(t7_portfolio_rows, "t7_metrics", now))
    t7_count = len(t7_community_rows)

    # ── T30 ─────────────────────────────────────────────────────────────
    t30_start = (f - timedelta(days=29)).isoformat()
    t30_end = friday
    t30_prev_start = (f - timedelta(days=59)).isoformat()
    t30_prev_end = (f - timedelta(days=30)).isoformat()

    t30_current = aggregate_window(conn, t30_start, t30_end)
    t30_prev = aggregate_window(conn, t30_prev_start, t30_prev_end)

    # Compute per-community T30 metrics
    t30_community_rows = []
    t30_all_metrics = []

    for code, cur in t30_current.items():
        cid = community_map.get(code.upper())
        if not cid:
            continue

        prev = t30_prev.get(code)
        metrics = compute_community_metrics(cur, prev)
        metrics["community_id"] = cid
        metrics["week_date"] = friday
        metrics["type"] = "community"
        t30_community_rows.append(metrics)
        t30_all_metrics.append(metrics)

    # Compute T30 portfolio averages
    t30_portfolio = compute_portfolio_averages(t30_all_metrics)

    t30_portfolio_rows = []
    for cm in t30_community_rows:
        prow = dict(t30_portfolio)
        prow["community_id"] = cm["community_id"]
        prow["week_date"] = friday
        prow["type"] = "portfolio"
        t30_portfolio_rows.append(prow)

    sql_lines.extend(generate_upserts(t30_community_rows, "t30_metrics", now))
    sql_lines.extend(generate_upserts(t30_portfolio_rows, "t30_metrics", now))
    t30_count = len(t30_community_rows)

    return sql_lines, t7_count, t30_count


def execute_sql(sql_file: Path) -> bool:
    """Execute a SQL file against D1 via wrangler."""
    print(f"🚀 Executing against D1...")
    env = build_runtime_env()
    result = subprocess.run(
        npx_wrangler_prefix(env) + [
            "d1", "execute", "pop-brief-db", "--remote",
            f"--file={sql_file}",
            "--config", str(WRANGLER_TOML),
        ],
        capture_output=True, text=True, timeout=120,
        input="y\n",  # Auto-confirm
        env=env,
    )

    if result.returncode == 0:
        print(f"✅ D1 execute succeeded")
        return True
    else:
        print(f"❌ D1 execute failed: {result.stderr[:300]}")
        print(f"   SQL file saved at: {sql_file}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Guest Card → D1 Sync")
    parser.add_argument("--date", help="Sync a specific Friday (YYYY-MM-DD)")
    parser.add_argument("--weeks", type=int, help="Backfill last N Fridays")
    parser.add_argument("--all", action="store_true", help="Backfill all available Fridays")
    parser.add_argument("--dry-run", action="store_true", help="Generate SQL but don't execute")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"🃏 GUEST CARD → D1 SYNC")
    print(f"{'='*60}")

    # Get community mapping
    community_map = _get_community_map()
    if not community_map:
        print("❌ No community mapping — aborting")
        sys.exit(1)

    # Open canonical DB
    conn = _connect_canonical()
    print(f"📁 Canonical DB: {CANONICAL_DB}")

    # Determine which Fridays to process
    all_fridays = get_available_fridays(conn)
    if not all_fridays:
        print("❌ No Fridays available in guest card data")
        sys.exit(1)

    print(f"📅 Available Fridays: {all_fridays[0]} → {all_fridays[-1]} ({len(all_fridays)} total)")

    if args.date:
        # Validate it's a Friday
        d = date.fromisoformat(args.date)
        if d.weekday() != 4:
            print(f"❌ {args.date} is not a Friday")
            sys.exit(1)
        fridays = [args.date]
    elif args.weeks:
        fridays = all_fridays[-args.weeks:]
    elif args.all:
        fridays = all_fridays
    else:
        # Default: most recent Friday only
        fridays = [all_fridays[-1]]

    print(f"🎯 Processing {len(fridays)} Friday(s): {fridays[0]}" +
          (f" → {fridays[-1]}" if len(fridays) > 1 else ""))

    # Process each Friday
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_sql = [
        f"-- Auto-generated: Guest Card → D1 sync",
        f"-- Generated: {now}",
        f"-- Fridays: {len(fridays)}",
        "",
    ]
    total_t7 = 0
    total_t30 = 0

    for friday in fridays:
        sql_lines, t7_c, t30_c = sync_friday(conn, community_map, friday, now)
        all_sql.extend(sql_lines)
        total_t7 += t7_c
        total_t30 += t30_c
        print(f"  📊 {friday}: T7={t7_c} communities, T30={t30_c} communities")

    conn.close()

    if total_t7 == 0 and total_t30 == 0:
        print("❌ No data generated — nothing to push")
        sys.exit(1)

    # Write SQL file
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    sql_file = GENERATED_DIR / f"guest_cards_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    with open(sql_file, "w") as f:
        f.write("\n".join(all_sql))

    # Stats
    upsert_count = total_t7 * 2 + total_t30 * 2  # community + portfolio for each
    print(f"\n📋 Summary:")
    print(f"   T7 rows:  {total_t7} community + {total_t7} portfolio = {total_t7 * 2}")
    print(f"   T30 rows: {total_t30} community + {total_t30} portfolio = {total_t30 * 2}")
    print(f"   Total upserts: {upsert_count}")
    print(f"   SQL file: {sql_file.name}")

    if args.dry_run:
        print(f"\n🏁 Dry run — SQL saved but not executed")
        return

    # Execute
    # Split into batches if very large (D1 has statement limits)
    # Each upsert = 2 SQL statements, ~500 char each
    BATCH_SIZE = 400  # ~800 SQL statements per batch
    rows_to_process = total_t7 + total_t30  # community rows (portfolio adds same count)
    total_rows = rows_to_process * 2  # community + portfolio

    if total_rows <= BATCH_SIZE:
        success = execute_sql(sql_file)
    else:
        # Split SQL into batches
        # Find statement boundaries (each upsert = 2 lines: INSERT + UPDATE)
        data_lines = [l for l in all_sql if l.startswith(("INSERT", "UPDATE"))]
        header = [l for l in all_sql if not l.startswith(("INSERT", "UPDATE"))]

        batch_num = 0
        success = True
        for i in range(0, len(data_lines), BATCH_SIZE * 2):
            batch_num += 1
            batch_lines = header + data_lines[i:i + BATCH_SIZE * 2]
            batch_file = GENERATED_DIR / f"guest_cards_{datetime.now().strftime('%Y%m%d_%H%M%S')}_batch{batch_num}.sql"
            with open(batch_file, "w") as f:
                f.write("\n".join(batch_lines))
            print(f"\n📦 Batch {batch_num}: {len(data_lines[i:i + BATCH_SIZE * 2]) // 2} upserts")
            if batch_num > 1:
                time.sleep(3)  # Avoid D1 rate-limiting between batches
            if not execute_sql(batch_file):
                success = False
                break

    if success:
        print(f"\n{'='*60}")
        print(f"🏁 Done — {upsert_count} rows pushed to D1")
        print(f"{'='*60}")
    else:
        print(f"\n{'='*60}")
        print(f"⚠️  Completed with errors — check SQL files in {GENERATED_DIR}")
        print(f"{'='*60}")


if __name__ == "__main__":
    main()
