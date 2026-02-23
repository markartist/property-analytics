#!/usr/bin/env python3
"""
Marketing Data → D1 Sync
==========================
Reads multiple data sources from the canonical portfolio_analytics.db
and populates the POP Brief D1 marketing_data table.

Data sources (all keyed by ga4_property_id):
  1. Occupancy + ATR + most-vacant floorplans  ← unit_availability
  2. Google review count + score               ← gbp_reviews
  3. Google Ads spend (PPC + remarketing)       ← google_ads_campaigns
  4. Website/SEO session deltas                 ← ga4_traffic_sources
  5. GC per door                                ← guest_card_metrics + unit_count
  6. SEMRush visibility + SERP traffic          ← semrush_domain_metrics

Usage:
  # Sync most recent Friday:
  python3 marketing_data_to_d1.py

  # Sync specific Friday:
  python3 marketing_data_to_d1.py --date 2026-02-21

  # Backfill last N Fridays:
  python3 marketing_data_to_d1.py --weeks 8

  # Backfill all available Fridays:
  python3 marketing_data_to_d1.py --all

  # Dry run (generate SQL but don't execute):
  python3 marketing_data_to_d1.py --dry-run
"""

import argparse
import json
import os
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
API_DIR = SCRIPT_DIR.parent
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
REPO_ROOT = API_DIR.parent.parent  # ~/Property_Analytics
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"

ACTOR = "marketing-data-sync"


# ---------------------------------------------------------------------------
# D1 community mapping
# ---------------------------------------------------------------------------

def _get_community_map() -> Dict[str, dict]:
    """
    Fetch ga4_property_id → {id, unit_count, encasa_property_code} from D1.
    Returns: { ga4_property_id: { id, unit_count, encasa_property_code } }
    """
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
            "--command", "SELECT id, ga4_property_id, unit_count, encasa_property_code "
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
            mapping[ga4_id] = {
                "id": row["id"],
                "unit_count": row.get("unit_count") or 0,
                "encasa_property_code": (row.get("encasa_property_code") or "").strip().upper(),
            }
        print(f"📊 Loaded {len(mapping)} communities from D1 (by ga4_property_id)")
        return mapping
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"❌ Failed to parse wrangler output: {e}")
        return {}


# ---------------------------------------------------------------------------
# Canonical DB helpers
# ---------------------------------------------------------------------------

def _connect_canonical() -> sqlite3.Connection:
    """Open a read-only connection to the canonical portfolio_analytics.db."""
    if not CANONICAL_DB.exists():
        print(f"❌ Canonical DB not found: {CANONICAL_DB}")
        sys.exit(1)
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def get_available_fridays(conn: sqlite3.Connection) -> List[str]:
    """Return all Fridays within the unit_availability date range."""
    row = conn.execute(
        "SELECT MIN(snapshot_date) as min_d, MAX(snapshot_date) as max_d FROM unit_availability"
    ).fetchone()
    if not row or not row["min_d"]:
        return []

    min_d = date.fromisoformat(row["min_d"])
    max_d = date.fromisoformat(row["max_d"])

    # Find first Friday >= min_d
    d = min_d
    while d.weekday() != 4:  # 4 = Friday
        d += timedelta(days=1)

    fridays = []
    while d <= max_d:
        fridays.append(d.isoformat())
        d += timedelta(days=7)

    return fridays


# ---------------------------------------------------------------------------
# Source 1: Occupancy + ATR + most-vacant floorplans
# ---------------------------------------------------------------------------

def fetch_occupancy(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Compute occupancy, ATR, and most-vacant floorplans from unit_availability.
    Uses the snapshot closest to (and <= ) the given Friday.

    Returns: { ga4_property_id: { occupancy, atr, most_common_floorplans } }
    """
    # Find the closest snapshot date <= friday
    row = conn.execute(
        "SELECT MAX(snapshot_date) as sd FROM unit_availability WHERE snapshot_date <= ?",
        (friday,),
    ).fetchone()
    snap_date = row["sd"] if row else None
    if not snap_date:
        return {}

    # Aggregate per property
    query = """
        SELECT
            ua.property_id,
            p.unit_count,
            SUM(ua.units_available_now)  AS avail_now,
            SUM(ua.units_available_60d)  AS avail_60d
        FROM unit_availability ua
        JOIN properties p ON ua.property_id = p.property_id
        WHERE ua.snapshot_date = ?
        GROUP BY ua.property_id
    """
    rows = conn.execute(query, (snap_date,)).fetchall()

    # Top vacant floorplans per property
    fp_query = """
        SELECT property_id, floorplan_name, units_available_now
        FROM unit_availability
        WHERE snapshot_date = ? AND units_available_now > 0
        ORDER BY property_id, units_available_now DESC
    """
    fp_rows = conn.execute(fp_query, (snap_date,)).fetchall()
    fp_by_prop = {}
    for r in fp_rows:
        pid = r["property_id"]
        if pid not in fp_by_prop:
            fp_by_prop[pid] = []
        if len(fp_by_prop[pid]) < 3:
            fp_by_prop[pid].append(f"{r['floorplan_name']} ({r['units_available_now']})")

    results = {}
    for r in rows:
        pid = r["property_id"]
        uc = r["unit_count"] or 0
        avail_now = r["avail_now"] or 0
        avail_60d = r["avail_60d"] or 0

        if uc > 0:
            occupancy = round((1.0 - avail_now / uc) * 100, 1)
            atr = round((avail_60d / uc) * 100, 1)
        else:
            occupancy = None
            atr = None

        fps = fp_by_prop.get(pid, [])
        results[pid] = {
            "occupancy": occupancy,
            "atr": atr,
            "most_common_floorplans": ", ".join(fps) if fps else None,
        }

    return results


# ---------------------------------------------------------------------------
# Source 2: Google reviews
# ---------------------------------------------------------------------------

def fetch_reviews(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Compute review count and average score from gbp_reviews up to the Friday.

    Returns: { ga4_property_id: { google_review_count, google_review_score } }
    """
    query = """
        SELECT
            property_id,
            COUNT(*) AS review_count,
            ROUND(AVG(star_rating_numeric), 2) AS avg_score
        FROM gbp_reviews
        WHERE review_create_time <= ?
        GROUP BY property_id
    """
    # Include reviews up to end of Friday
    end_ts = friday + "T23:59:59"
    rows = conn.execute(query, (end_ts,)).fetchall()

    return {
        r["property_id"]: {
            "google_review_count": r["review_count"],
            "google_review_score": r["avg_score"],
        }
        for r in rows
    }


# ---------------------------------------------------------------------------
# Source 3: Google Ads spend (PPC + remarketing)
# ---------------------------------------------------------------------------

def fetch_ads_spend(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Aggregate Google Ads spend in the T30 window ending on Friday,
    split by PPC vs Remarketing based on campaign_name patterns.

    Returns: { ga4_property_id: { google_ppc, google_remarketing } }
    """
    f = date.fromisoformat(friday)
    start = (f - timedelta(days=29)).isoformat()

    query = """
        SELECT
            property_id,
            SUM(CASE
                WHEN LOWER(campaign_name) LIKE '%remarketing%'
                THEN cost_micros ELSE 0
            END) AS remarketing_micros,
            SUM(CASE
                WHEN LOWER(campaign_name) NOT LIKE '%remarketing%'
                THEN cost_micros ELSE 0
            END) AS ppc_micros
        FROM google_ads_campaigns
        WHERE metric_date BETWEEN ? AND ?
        GROUP BY property_id
    """
    rows = conn.execute(query, (start, friday)).fetchall()

    return {
        r["property_id"]: {
            "google_ppc": round(r["ppc_micros"] / 1_000_000, 2) if r["ppc_micros"] else None,
            "google_remarketing": round(r["remarketing_micros"] / 1_000_000, 2)
                if r["remarketing_micros"] else None,
        }
        for r in rows
    }


# ---------------------------------------------------------------------------
# Source 4: Website / SEO session deltas
# ---------------------------------------------------------------------------

def _session_sums(
    conn: sqlite3.Connection, start: str, end: str
) -> Dict[str, dict]:
    """
    Sum total sessions and organic sessions from ga4_traffic_sources in a window.
    Returns: { ga4_property_id: { engaged_sessions, organic_sessions } }
    """
    query = """
        SELECT
            property_id,
            SUM(engaged_sessions) AS engaged,
            SUM(CASE WHEN channel_group = 'Organic Search' THEN sessions ELSE 0 END) AS organic
        FROM ga4_traffic_sources
        WHERE metric_date BETWEEN ? AND ?
        GROUP BY property_id
    """
    rows = conn.execute(query, (start, end)).fetchall()
    return {
        r["property_id"]: {
            "engaged_sessions": r["engaged"] or 0,
            "organic_sessions": r["organic"] or 0,
        }
        for r in rows
    }


def _pct_change(current: float, prev: float) -> Optional[float]:
    if prev == 0:
        return None
    return round(((current - prev) / prev) * 100, 2)


def fetch_session_deltas(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Compute T7 and T30 WoW/MoM deltas for engaged + organic sessions.

    Returns: { ga4_property_id: {
        t7_engaged_sessions_delta, t7_organic_sessions_delta,
        t30_engaged_sessions_delta, t30_organic_sessions_delta
    } }
    """
    f = date.fromisoformat(friday)

    # T7 windows
    t7_cur = _session_sums(conn, (f - timedelta(days=6)).isoformat(), friday)
    t7_prev = _session_sums(conn, (f - timedelta(days=13)).isoformat(),
                            (f - timedelta(days=7)).isoformat())

    # T30 windows
    t30_cur = _session_sums(conn, (f - timedelta(days=29)).isoformat(), friday)
    t30_prev = _session_sums(conn, (f - timedelta(days=59)).isoformat(),
                             (f - timedelta(days=30)).isoformat())

    results = {}
    all_pids = set(t7_cur) | set(t30_cur)

    for pid in all_pids:
        r = {}

        # T7 deltas
        cur7 = t7_cur.get(pid, {})
        prev7 = t7_prev.get(pid, {})
        if cur7 and prev7:
            r["t7_engaged_sessions_delta"] = _pct_change(
                cur7.get("engaged_sessions", 0), prev7.get("engaged_sessions", 0))
            r["t7_organic_sessions_delta"] = _pct_change(
                cur7.get("organic_sessions", 0), prev7.get("organic_sessions", 0))
        else:
            r["t7_engaged_sessions_delta"] = None
            r["t7_organic_sessions_delta"] = None

        # T30 deltas
        cur30 = t30_cur.get(pid, {})
        prev30 = t30_prev.get(pid, {})
        if cur30 and prev30:
            r["t30_engaged_sessions_delta"] = _pct_change(
                cur30.get("engaged_sessions", 0), prev30.get("engaged_sessions", 0))
            r["t30_organic_sessions_delta"] = _pct_change(
                cur30.get("organic_sessions", 0), prev30.get("organic_sessions", 0))
        else:
            r["t30_engaged_sessions_delta"] = None
            r["t30_organic_sessions_delta"] = None

        results[pid] = r

    return results


# ---------------------------------------------------------------------------
# Source 5: GC per door
# ---------------------------------------------------------------------------

def fetch_gc_per_door(
    conn: sqlite3.Connection,
    friday: str,
    community_map: Dict[str, dict],
    occupancy_data: Dict[str, dict],
) -> Dict[str, dict]:
    """
    Compute guest-card-per-door and per-available-door for T7 and T30.
    Requires encasa_property_code mapping and unit_count.

    Returns: { ga4_property_id: {
        t7_community_gc_per_door, t7_community_gc_per_avail_door,
        t30_community_gc_per_door, t30_community_gc_per_avail_door,
        t7_portfolio_gc_per_door, t7_portfolio_gc_per_avail_door,
        t30_portfolio_gc_per_door, t30_portfolio_gc_per_avail_door,
    } }
    """
    f = date.fromisoformat(friday)

    # Build reverse map: encasa_code → ga4_property_id
    encasa_to_ga4 = {}
    for ga4_id, info in community_map.items():
        code = info.get("encasa_property_code", "")
        if code:
            encasa_to_ga4[code] = ga4_id

    def _gc_window(start: str, end: str) -> Dict[str, int]:
        """Sum guest cards per encasa code in a date range."""
        query = """
            SELECT property_code, SUM(gc_this_period) AS g_cards
            FROM guest_card_metrics
            WHERE run_date BETWEEN ? AND ?
            GROUP BY property_code
        """
        rows = conn.execute(query, (start, end)).fetchall()
        return {
            r["property_code"].strip().upper(): r["g_cards"] or 0
            for r in rows
        }

    # T7 and T30 guest card totals
    t7_gc = _gc_window((f - timedelta(days=6)).isoformat(), friday)
    t30_gc = _gc_window((f - timedelta(days=29)).isoformat(), friday)

    results = {}
    t7_pd_vals = []
    t7_pad_vals = []
    t30_pd_vals = []
    t30_pad_vals = []

    for code, ga4_id in encasa_to_ga4.items():
        info = community_map[ga4_id]
        unit_count = info["unit_count"] or 0
        if unit_count == 0:
            continue

        occ = occupancy_data.get(ga4_id, {})
        avail_now = occ.get("occupancy")
        # Reverse: avail_units = unit_count * (1 - occupancy/100)
        if avail_now is not None:
            avail_units = max(1, round(unit_count * (1 - avail_now / 100)))
        else:
            avail_units = None

        r = {}

        # T7
        gc7 = t7_gc.get(code, 0)
        r["t7_community_gc_per_door"] = round(gc7 / unit_count, 4) if gc7 else None
        if avail_units:
            r["t7_community_gc_per_avail_door"] = round(gc7 / avail_units, 4) if gc7 else None
        else:
            r["t7_community_gc_per_avail_door"] = None

        if r["t7_community_gc_per_door"] is not None:
            t7_pd_vals.append(r["t7_community_gc_per_door"])
        if r["t7_community_gc_per_avail_door"] is not None:
            t7_pad_vals.append(r["t7_community_gc_per_avail_door"])

        # T30
        gc30 = t30_gc.get(code, 0)
        r["t30_community_gc_per_door"] = round(gc30 / unit_count, 4) if gc30 else None
        if avail_units:
            r["t30_community_gc_per_avail_door"] = round(gc30 / avail_units, 4) if gc30 else None
        else:
            r["t30_community_gc_per_avail_door"] = None

        if r["t30_community_gc_per_door"] is not None:
            t30_pd_vals.append(r["t30_community_gc_per_door"])
        if r["t30_community_gc_per_avail_door"] is not None:
            t30_pad_vals.append(r["t30_community_gc_per_avail_door"])

        results[ga4_id] = r

    # Portfolio averages
    t7_port_pd = round(sum(t7_pd_vals) / len(t7_pd_vals), 4) if t7_pd_vals else None
    t7_port_pad = round(sum(t7_pad_vals) / len(t7_pad_vals), 4) if t7_pad_vals else None
    t30_port_pd = round(sum(t30_pd_vals) / len(t30_pd_vals), 4) if t30_pd_vals else None
    t30_port_pad = round(sum(t30_pad_vals) / len(t30_pad_vals), 4) if t30_pad_vals else None

    for ga4_id in results:
        results[ga4_id]["t7_portfolio_gc_per_door"] = t7_port_pd
        results[ga4_id]["t7_portfolio_gc_per_avail_door"] = t7_port_pad
        results[ga4_id]["t30_portfolio_gc_per_door"] = t30_port_pd
        results[ga4_id]["t30_portfolio_gc_per_avail_door"] = t30_port_pad

    return results


# ---------------------------------------------------------------------------
# Source 6: SEMRush visibility + SERP traffic
# ---------------------------------------------------------------------------

def fetch_semrush(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Get the latest SEMRush visibility score and organic traffic estimate
    on or before the given Friday.

    Returns: { ga4_property_id: { t7_organic_visibility, t7_serp_traffic } }
    """
    query = """
        SELECT property_id, visibility_score, organic_traffic_estimate
        FROM semrush_domain_metrics
        WHERE metric_date = (
            SELECT MAX(metric_date) FROM semrush_domain_metrics WHERE metric_date <= ?
        )
    """
    rows = conn.execute(query, (friday,)).fetchall()
    return {
        r["property_id"]: {
            "t7_organic_visibility": r["visibility_score"],
            "t7_serp_traffic": r["organic_traffic_estimate"],
        }
        for r in rows
    }


# ---------------------------------------------------------------------------
# SQL generation
# ---------------------------------------------------------------------------

def _sql_val(v) -> str:
    """Format a Python value as a SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    # Escape single quotes in strings
    s = str(v).replace("'", "''")
    return f"'{s}'"


# All automated fields in marketing_data that this script manages
AUTOMATED_FIELDS = [
    # Section 1: Advertising (partial)
    "google_ppc", "google_remarketing",
    # Section 2: Property Performance
    "occupancy", "atr", "most_common_floorplans",
    # Section 3: GC per door
    "t7_community_gc_per_door", "t7_community_gc_per_avail_door",
    "t7_portfolio_gc_per_door", "t7_portfolio_gc_per_avail_door",
    "t30_community_gc_per_door", "t30_community_gc_per_avail_door",
    "t30_portfolio_gc_per_door", "t30_portfolio_gc_per_avail_door",
    # Section 4: Website & SEO
    "t7_engaged_sessions_delta", "t7_organic_sessions_delta",
    "t30_engaged_sessions_delta", "t30_organic_sessions_delta",
    "t7_organic_visibility", "t7_serp_traffic",
    # Section 6: Reputation
    "google_review_count", "google_review_score",
]


def generate_upserts(
    rows: List[Dict], now: str
) -> List[str]:
    """
    Generate INSERT-or-UPDATE SQL for marketing_data.
    Each row: { community_id, week_date, ...automated fields }

    Only updates non-null automated fields to avoid clobbering manual entries.
    """
    sql_lines = []

    for row in rows:
        cid = row["community_id"]
        wd = row["week_date"]
        new_id = str(uuid.uuid4())

        # Build INSERT columns/values (create row if not exists)
        insert_cols = ["id", "community_id", "week_date"]
        insert_vals = [f"'{new_id}'", f"'{cid}'", f"'{wd}'"]

        for f in AUTOMATED_FIELDS:
            insert_cols.append(f)
            insert_vals.append(_sql_val(row.get(f)))

        insert_cols.extend(["created_at", "created_by", "updated_at", "updated_by"])
        insert_vals.extend([f"'{now}'", f"'{ACTOR}'", f"'{now}'", f"'{ACTOR}'"])

        cols_str = ", ".join(insert_cols)
        vals_str = ", ".join(insert_vals)

        # INSERT if not exists
        sql_lines.append(
            f"INSERT INTO marketing_data ({cols_str}) "
            f"SELECT {vals_str} "
            f"WHERE NOT EXISTS ("
            f"SELECT 1 FROM marketing_data "
            f"WHERE community_id = '{cid}' AND week_date = '{wd}'"
            f");"
        )

        # UPDATE only non-null automated fields
        sets = []
        for f in AUTOMATED_FIELDS:
            v = row.get(f)
            if v is not None:
                sets.append(f"{f} = {_sql_val(v)}")
        sets.append(f"updated_at = '{now}'")
        sets.append(f"updated_by = '{ACTOR}'")
        set_str = ", ".join(sets)

        sql_lines.append(
            f"UPDATE marketing_data SET {set_str} "
            f"WHERE community_id = '{cid}' AND week_date = '{wd}';"
        )

    return sql_lines


# ---------------------------------------------------------------------------
# Main sync logic
# ---------------------------------------------------------------------------

def sync_friday(
    conn: sqlite3.Connection,
    community_map: Dict[str, dict],
    friday: str,
    now: str,
) -> Tuple[List[str], int]:
    """
    Gather all data sources for a single Friday and return SQL upsert lines.
    Returns: (sql_lines, community_count)
    """
    # Fetch all data sources
    occ_data = fetch_occupancy(conn, friday)
    review_data = fetch_reviews(conn, friday)
    ads_data = fetch_ads_spend(conn, friday)
    session_data = fetch_session_deltas(conn, friday)
    gc_data = fetch_gc_per_door(conn, friday, community_map, occ_data)
    semrush_data = fetch_semrush(conn, friday)

    # Merge all sources into per-community rows
    rows = []
    for ga4_id, info in community_map.items():
        cid = info["id"]

        merged = {
            "community_id": cid,
            "week_date": friday,
        }

        # Merge occupancy
        if ga4_id in occ_data:
            merged.update(occ_data[ga4_id])

        # Merge reviews
        if ga4_id in review_data:
            merged.update(review_data[ga4_id])

        # Merge ads spend
        if ga4_id in ads_data:
            merged.update(ads_data[ga4_id])

        # Merge session deltas
        if ga4_id in session_data:
            merged.update(session_data[ga4_id])

        # Merge GC per door
        if ga4_id in gc_data:
            merged.update(gc_data[ga4_id])

        # Merge SEMRush
        if ga4_id in semrush_data:
            merged.update(semrush_data[ga4_id])

        # Only create a row if we have at least one non-null automated field
        has_data = any(
            merged.get(f) is not None for f in AUTOMATED_FIELDS
        )
        if has_data:
            rows.append(merged)

    sql_lines = generate_upserts(rows, now)

    sources = {
        "occupancy": len(occ_data),
        "reviews": len(review_data),
        "ads": len(ads_data),
        "sessions": len(session_data),
        "gc_door": len(gc_data),
        "semrush": len(semrush_data),
    }
    src_str = " | ".join(f"{k}={v}" for k, v in sources.items())
    print(f"  📊 {friday}: {len(rows)} communities [{src_str}]")

    return sql_lines, len(rows)


def execute_sql(sql_file: Path) -> bool:
    """Execute a SQL file against D1 via wrangler."""
    print(f"🚀 Executing against D1...")
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
            f"--file={sql_file}",
            "--config", str(WRANGLER_TOML),
        ],
        capture_output=True, text=True, timeout=120,
        input="y\n",
    )

    if result.returncode == 0:
        print(f"✅ D1 execute succeeded")
        return True
    else:
        print(f"❌ D1 execute failed: {result.stderr[:300]}")
        print(f"   SQL file saved at: {sql_file}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Marketing Data → D1 Sync")
    parser.add_argument("--date", help="Sync a specific Friday (YYYY-MM-DD)")
    parser.add_argument("--weeks", type=int, help="Backfill last N Fridays")
    parser.add_argument("--all", action="store_true", help="Backfill all available Fridays")
    parser.add_argument("--dry-run", action="store_true", help="Generate SQL but don't execute")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"📈 MARKETING DATA → D1 SYNC")
    print(f"{'='*60}")

    # Get community mapping
    community_map = _get_community_map()
    if not community_map:
        print("❌ No community mapping — aborting")
        sys.exit(1)

    # Open canonical DB
    conn = _connect_canonical()
    print(f"📁 Canonical DB: {CANONICAL_DB}")

    # Determine Fridays
    all_fridays = get_available_fridays(conn)
    if not all_fridays:
        print("❌ No Fridays available in data range")
        sys.exit(1)

    print(f"📅 Available Fridays: {all_fridays[0]} → {all_fridays[-1]} ({len(all_fridays)} total)")

    if args.date:
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
        fridays = [all_fridays[-1]]

    print(f"🎯 Processing {len(fridays)} Friday(s): {fridays[0]}" +
          (f" → {fridays[-1]}" if len(fridays) > 1 else ""))

    # Process each Friday
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_sql = [
        f"-- Auto-generated: Marketing Data → D1 sync",
        f"-- Generated: {now}",
        f"-- Fridays: {len(fridays)}",
        "",
    ]
    total_communities = 0

    for friday in fridays:
        sql_lines, count = sync_friday(conn, community_map, friday, now)
        all_sql.extend(sql_lines)
        total_communities += count

    conn.close()

    if total_communities == 0:
        print("❌ No data generated — nothing to push")
        sys.exit(1)

    # Write SQL file
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    sql_file = GENERATED_DIR / f"marketing_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    with open(sql_file, "w") as f:
        f.write("\n".join(all_sql))

    upsert_count = total_communities
    print(f"\n📋 Summary:")
    print(f"   Fridays processed: {len(fridays)}")
    print(f"   Total community-weeks: {total_communities}")
    print(f"   SQL statements: {len([l for l in all_sql if l.startswith(('INSERT', 'UPDATE'))])}")
    print(f"   SQL file: {sql_file.name}")

    if args.dry_run:
        print(f"\n🏁 Dry run — SQL saved but not executed")
        return

    # Execute in batches
    data_lines = [l for l in all_sql if l.startswith(("INSERT", "UPDATE"))]
    header = [l for l in all_sql if not l.startswith(("INSERT", "UPDATE"))]

    BATCH_SIZE = 400  # upserts per batch (= 800 SQL statements)

    if len(data_lines) <= BATCH_SIZE * 2:
        success = execute_sql(sql_file)
    else:
        batch_num = 0
        success = True
        for i in range(0, len(data_lines), BATCH_SIZE * 2):
            batch_num += 1
            batch_lines = header + data_lines[i:i + BATCH_SIZE * 2]
            batch_file = GENERATED_DIR / f"marketing_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}_batch{batch_num}.sql"
            with open(batch_file, "w") as f:
                f.write("\n".join(batch_lines))
            print(f"\n📦 Batch {batch_num}: {len(data_lines[i:i + BATCH_SIZE * 2]) // 2} upserts")
            if batch_num > 1:
                time.sleep(3)
            if not execute_sql(batch_file):
                success = False
                break

    if success:
        print(f"\n{'='*60}")
        print(f"🏁 Done — {upsert_count} community-weeks pushed to D1")
        print(f"{'='*60}")
    else:
        print(f"\n{'='*60}")
        print(f"⚠️  Completed with errors — check SQL files in {GENERATED_DIR}")
        print(f"{'='*60}")


if __name__ == "__main__":
    main()
