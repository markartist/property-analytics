#!/usr/bin/env python3
"""
PIB Data → D1 Sync
=====================
Reads PIB-relevant data from canonical portfolio_analytics.db and populates
six D1 tables for the Property Intelligence Brief dashboard.

Tables populated:
  1. pib_ga4_metrics         ← ga4_daily_rollup + ga4_traffic_sources
  2. pib_site_performance    ← pagespeed_metrics
  3. pib_local_presence      ← gbp_daily_insights
  4. pib_search_performance  ← gsc_daily_metrics + gsc_queries
  5. pib_cir                 ← cir_daily_rollup
  6. pib_reviews             ← gbp_reviews + gbp_review_sentiment

Usage:
  # Sync most recent Friday:
  python3 pib_data_to_d1.py

  # Sync specific Friday:
  python3 pib_data_to_d1.py --date 2026-02-21

  # Backfill last N Fridays:
  python3 pib_data_to_d1.py --weeks 8

  # Backfill all available Fridays:
  python3 pib_data_to_d1.py --all

  # Dry run (generate SQL but don't execute):
  python3 pib_data_to_d1.py --dry-run
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


# ---------------------------------------------------------------------------
# D1 community mapping
# ---------------------------------------------------------------------------

def _get_community_map() -> Dict[str, dict]:
    """
    Fetch ga4_property_id → {id, unit_count} from D1.
    Returns: { ga4_property_id: { id, unit_count } }
    """
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
            "--command", "SELECT id, ga4_property_id, unit_count, name "
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
                "name": row.get("name", ""),
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
    """Return all Fridays in the ga4_daily_rollup date range."""
    row = conn.execute(
        "SELECT MIN(event_date) as min_d, MAX(event_date) as max_d FROM ga4_daily_rollup"
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


def _pct_change(current: float, prev: float) -> Optional[float]:
    if prev == 0:
        return None
    return round(((current - prev) / prev) * 100, 2)


# ---------------------------------------------------------------------------
# Source 1: GA4 Traffic & Engagement (pib_ga4_metrics)
# ---------------------------------------------------------------------------

def fetch_ga4_metrics(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Aggregate GA4 daily rollup data for the 30-day window ending on Friday.
    Also compute trends vs prior 30-day window.

    Returns: { ga4_property_id: { ...metrics } }
    """
    f = date.fromisoformat(friday)
    cur_start = (f - timedelta(days=29)).isoformat()
    prior_start = (f - timedelta(days=59)).isoformat()
    prior_end = (f - timedelta(days=30)).isoformat()

    def _agg_window(start: str, end: str) -> Dict[str, dict]:
        query = """
            SELECT
                property_id,
                SUM(sessions) AS total_sessions,
                SUM(users) AS total_users,
                SUM(new_users) AS new_users,
                CASE WHEN SUM(sessions) > 0
                    THEN ROUND(SUM(total_engagement_time_msec) * 1.0 / SUM(sessions) / 1000, 1)
                    ELSE NULL END AS avg_session_duration,
                SUM(organic_search_events) AS organic_sessions,
                SUM(direct_events) AS direct_sessions,
                SUM(paid_events) AS paid_sessions,
                SUM(referral_events) AS referral_sessions,
                SUM(social_events) AS social_sessions,
                SUM(desktop_events) AS desktop_sessions,
                SUM(mobile_events) AS mobile_sessions,
                SUM(tablet_events) AS tablet_sessions,
                SUM(scheduletour_click_events) AS tour_clicks,
                SUM(phonecall_events) AS phone_calls,
                SUM(applyonline_click_events) AS apply_clicks,
                SUM(pricequote_click_events) AS price_quotes,
                SUM(form_start_events) AS form_starts,
                SUM(COALESCE(form_start_events, 0)) AS form_submits
            FROM ga4_daily_rollup
            WHERE event_date BETWEEN ? AND ?
            GROUP BY property_id
        """
        rows = conn.execute(query, (start, end)).fetchall()
        return {r["property_id"]: dict(r) for r in rows}

    current = _agg_window(cur_start, friday)
    prior = _agg_window(prior_start, prior_end)

    results = {}
    for pid, cur in current.items():
        prev = prior.get(pid, {})
        cur["sessions_trend_pct"] = _pct_change(
            cur.get("total_sessions") or 0,
            prev.get("total_sessions") or 0
        )
        cur["users_trend_pct"] = _pct_change(
            cur.get("total_users") or 0,
            prev.get("total_users") or 0
        )
        # Remove property_id key from the dict
        cur.pop("property_id", None)
        results[pid] = cur

    return results


# ---------------------------------------------------------------------------
# Source 2: Site Performance / PageSpeed (pib_site_performance)
# ---------------------------------------------------------------------------

def fetch_site_performance(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Get the latest PageSpeed scores on or before Friday.
    Pivots mobile/desktop rows into one record per property.

    Returns: { ga4_property_id: { mobile_score, desktop_score, ...cwv } }
    """
    # Find closest date <= friday
    row = conn.execute(
        "SELECT MAX(metric_date) as md FROM pagespeed_metrics WHERE metric_date <= ?",
        (friday,)
    ).fetchone()
    snap_date = row["md"] if row else None
    if not snap_date:
        return {}

    query = """
        SELECT property_id, strategy,
               performance_score, lcp_value, cls_value, fid_value, fcp_value
        FROM pagespeed_metrics
        WHERE metric_date = ?
    """
    rows = conn.execute(query, (snap_date,)).fetchall()

    # Pivot: group by property, split by mobile/desktop
    data = {}
    for r in rows:
        pid = r["property_id"]
        if pid not in data:
            data[pid] = {}
        prefix = r["strategy"].lower()  # 'mobile' or 'desktop'
        data[pid][f"{prefix}_score"] = r["performance_score"]
        data[pid][f"{prefix}_lcp"] = r["lcp_value"]
        data[pid][f"{prefix}_cls"] = r["cls_value"]
        data[pid][f"{prefix}_fid"] = r["fid_value"]
        data[pid][f"{prefix}_fcp"] = r["fcp_value"]

    return data


# ---------------------------------------------------------------------------
# Source 3: Local Presence / GBP (pib_local_presence)
# ---------------------------------------------------------------------------

def fetch_local_presence(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Aggregate GBP daily insights for 30-day window ending on Friday.
    Compute trends vs prior 30-day window.

    Returns: { ga4_property_id: { ...gbp_metrics } }
    """
    f = date.fromisoformat(friday)
    cur_start = (f - timedelta(days=29)).isoformat()
    prior_start = (f - timedelta(days=59)).isoformat()
    prior_end = (f - timedelta(days=30)).isoformat()

    def _agg_window(start: str, end: str) -> Dict[str, dict]:
        query = """
            SELECT
                property_id,
                SUM(total_profile_views) AS total_profile_views,
                SUM(maps_views_desktop + maps_views_mobile) AS maps_views,
                SUM(search_views_desktop + search_views_mobile) AS search_views,
                SUM(website_clicks) AS website_clicks,
                SUM(phone_calls) AS phone_calls,
                SUM(direction_requests) AS direction_requests,
                SUM(total_actions) AS total_actions
            FROM gbp_daily_insights
            WHERE metric_date BETWEEN ? AND ?
            GROUP BY property_id
        """
        rows = conn.execute(query, (start, end)).fetchall()
        return {r["property_id"]: dict(r) for r in rows}

    current = _agg_window(cur_start, friday)
    prior = _agg_window(prior_start, prior_end)

    results = {}
    for pid, cur in current.items():
        views = cur.get("total_profile_views") or 0
        actions = cur.get("total_actions") or 0
        cur["action_rate"] = round(actions / views * 100, 2) if views > 0 else None

        prev = prior.get(pid, {})
        cur["views_trend_pct"] = _pct_change(
            views, prev.get("total_profile_views") or 0
        )
        cur["actions_trend_pct"] = _pct_change(
            actions, prev.get("total_actions") or 0
        )
        cur.pop("property_id", None)
        cur.pop("total_actions", None)
        results[pid] = cur

    return results


# ---------------------------------------------------------------------------
# Source 4: Search Performance / GSC (pib_search_performance)
# ---------------------------------------------------------------------------

def fetch_search_performance(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Aggregate GSC metrics for 30-day window and top 10 keywords per property.

    GSC tables use either URL or ga4_property_id as property_id.
    We use the ga4_property_id column when available, otherwise map through properties table.

    Returns: { ga4_property_id: { total_clicks, total_impressions, avg_ctr, avg_position, top_keywords_json } }
    """
    f = date.fromisoformat(friday)
    cur_start = (f - timedelta(days=29)).isoformat()

    # Build URL → ga4_id mapping from properties table
    url_map = {}
    url_rows = conn.execute(
        "SELECT property_id, gsc_url FROM properties WHERE gsc_url IS NOT NULL"
    ).fetchall()
    for r in url_rows:
        url_map[r["gsc_url"]] = r["property_id"]

    # Aggregate daily metrics
    agg_query = """
        SELECT
            COALESCE(ga4_property_id, property_id) AS pid,
            SUM(clicks) AS total_clicks,
            SUM(impressions) AS total_impressions,
            CASE WHEN SUM(impressions) > 0
                THEN ROUND(SUM(clicks) * 1.0 / SUM(impressions) * 100, 2)
                ELSE NULL END AS avg_ctr,
            ROUND(AVG(average_position), 1) AS avg_position
        FROM gsc_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
        GROUP BY pid
    """
    agg_rows = conn.execute(agg_query, (cur_start, friday)).fetchall()

    results = {}
    for r in agg_rows:
        pid = r["pid"]
        # Map URL-based pids to GA4 IDs
        if pid.startswith("http"):
            pid = url_map.get(pid, pid)

        results[pid] = {
            "total_clicks": r["total_clicks"],
            "total_impressions": r["total_impressions"],
            "avg_ctr": r["avg_ctr"],
            "avg_position": r["avg_position"],
        }

    # Top 10 keywords per property (from gsc_queries using ga4_property_id)
    kw_query = """
        SELECT
            COALESCE(ga4_property_id, property_id) AS pid,
            query,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            CASE WHEN SUM(impressions) > 0
                THEN ROUND(SUM(clicks) * 1.0 / SUM(impressions) * 100, 2)
                ELSE 0 END AS ctr,
            ROUND(AVG(average_position), 1) AS position
        FROM gsc_queries
        WHERE metric_date BETWEEN ? AND ?
        GROUP BY pid, query
        ORDER BY pid, clicks DESC
    """
    kw_rows = conn.execute(kw_query, (cur_start, friday)).fetchall()

    # Group by property, take top 10
    kw_by_prop = {}
    for r in kw_rows:
        pid = r["pid"]
        if pid.startswith("http"):
            pid = url_map.get(pid, pid)
        if pid not in kw_by_prop:
            kw_by_prop[pid] = []
        if len(kw_by_prop[pid]) < 10:
            kw_by_prop[pid].append({
                "query": r["query"],
                "clicks": r["clicks"],
                "impressions": r["impressions"],
                "ctr": r["ctr"],
                "position": r["position"],
            })

    for pid in results:
        results[pid]["top_keywords_json"] = json.dumps(
            kw_by_prop.get(pid, []), ensure_ascii=False
        )

    return results


# ---------------------------------------------------------------------------
# Source 5: CIR - Conversion Intent Rate (pib_cir)
# ---------------------------------------------------------------------------

CIR_THRESHOLDS = {
    "strong": 15.0,
    "moderate": 10.0,
    "low": 5.0,
}


def _cir_status(cir_val: Optional[float]) -> Optional[str]:
    if cir_val is None:
        return None
    if cir_val >= CIR_THRESHOLDS["strong"]:
        return "strong"
    if cir_val >= CIR_THRESHOLDS["moderate"]:
        return "moderate"
    if cir_val >= CIR_THRESHOLDS["low"]:
        return "low"
    return "critical"


def fetch_cir(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Aggregate CIR from cir_daily_rollup for 30-day window.
    CIR = intent_event_count / sessions * 100.

    Returns: { ga4_property_id: { total_sessions, intent_events, cir_value, cir_status, prior_cir_value, cir_trend_pct } }
    """
    f = date.fromisoformat(friday)
    cur_start = (f - timedelta(days=29)).isoformat()
    prior_start = (f - timedelta(days=59)).isoformat()
    prior_end = (f - timedelta(days=30)).isoformat()

    def _agg_window(start: str, end: str) -> Dict[str, dict]:
        query = """
            SELECT
                property_id,
                SUM(sessions) AS total_sessions,
                SUM(intent_event_count) AS intent_events
            FROM cir_daily_rollup
            WHERE metric_date BETWEEN ? AND ?
            GROUP BY property_id
        """
        rows = conn.execute(query, (start, end)).fetchall()
        result = {}
        for r in rows:
            sess = r["total_sessions"] or 0
            intent = r["intent_events"] or 0
            cir_val = round(intent / sess * 100, 2) if sess > 0 else None
            result[r["property_id"]] = {
                "total_sessions": sess,
                "intent_events": intent,
                "cir_value": cir_val,
            }
        return result

    current = _agg_window(cur_start, friday)
    prior = _agg_window(prior_start, prior_end)

    results = {}
    for pid, cur in current.items():
        prev = prior.get(pid, {})
        prior_cir = prev.get("cir_value")
        results[pid] = {
            "total_sessions": cur["total_sessions"],
            "intent_events": cur["intent_events"],
            "cir_value": cur["cir_value"],
            "cir_status": _cir_status(cur["cir_value"]),
            "prior_cir_value": prior_cir,
            "cir_trend_pct": _pct_change(
                cur["cir_value"] or 0, prior_cir or 0
            ),
        }

    return results


# ---------------------------------------------------------------------------
# Source 6: Reviews & Sentiment (pib_reviews)
# ---------------------------------------------------------------------------

def fetch_reviews(
    conn: sqlite3.Connection, friday: str
) -> Dict[str, dict]:
    """
    Aggregate review data from gbp_reviews + gbp_review_sentiment.

    Returns: { ga4_property_id: { total_reviews, avg_rating, five_star_count, one_star_count,
               recent_30d_count, avg_rating_trend, sentiment_score, themes_json, critical_reviews_json } }
    """
    f = date.fromisoformat(friday)
    cur_start = (f - timedelta(days=29)).isoformat()
    prior_start = (f - timedelta(days=59)).isoformat()
    prior_end = (f - timedelta(days=30)).isoformat()
    end_ts = friday + "T23:59:59"
    cur_start_ts = cur_start + "T00:00:00"
    prior_start_ts = prior_start + "T00:00:00"
    prior_end_ts = prior_end + "T23:59:59"

    # All-time stats up to friday
    all_time_query = """
        SELECT
            property_id,
            COUNT(*) AS total_reviews,
            ROUND(AVG(star_rating_numeric), 2) AS avg_rating,
            SUM(CASE WHEN star_rating_numeric = 5 THEN 1 ELSE 0 END) AS five_star_count,
            SUM(CASE WHEN star_rating_numeric = 1 THEN 1 ELSE 0 END) AS one_star_count
        FROM gbp_reviews
        WHERE review_create_time <= ?
        GROUP BY property_id
    """
    all_rows = conn.execute(all_time_query, (end_ts,)).fetchall()
    data = {}
    for r in all_rows:
        data[r["property_id"]] = {
            "total_reviews": r["total_reviews"],
            "avg_rating": r["avg_rating"],
            "five_star_count": r["five_star_count"],
            "one_star_count": r["one_star_count"],
        }

    # Recent 30d count
    recent_query = """
        SELECT property_id, COUNT(*) AS cnt,
               ROUND(AVG(star_rating_numeric), 2) AS recent_avg
        FROM gbp_reviews
        WHERE review_create_time BETWEEN ? AND ?
        GROUP BY property_id
    """
    recent_rows = conn.execute(recent_query, (cur_start_ts, end_ts)).fetchall()
    for r in recent_rows:
        pid = r["property_id"]
        if pid in data:
            data[pid]["recent_30d_count"] = r["cnt"]

    # Prior 30d avg for trend
    prior_query = """
        SELECT property_id, ROUND(AVG(star_rating_numeric), 2) AS prior_avg
        FROM gbp_reviews
        WHERE review_create_time BETWEEN ? AND ?
        GROUP BY property_id
    """
    prior_rows = conn.execute(prior_query, (prior_start_ts, prior_end_ts)).fetchall()
    prior_avgs = {r["property_id"]: r["prior_avg"] for r in prior_rows}
    for pid in data:
        cur_avg = data[pid].get("avg_rating") or 0
        prev_avg = prior_avgs.get(pid) or 0
        data[pid]["avg_rating_trend"] = round(cur_avg - prev_avg, 2) if prev_avg else None

    # Sentiment scores (aggregate per property)
    sentiment_query = """
        SELECT
            s.property_id,
            ROUND(AVG(s.sentiment_score), 2) AS sentiment_score,
            SUM(s.theme_maintenance) AS t_maintenance,
            SUM(s.theme_staff) AS t_staff,
            SUM(s.theme_amenities) AS t_amenities,
            SUM(s.theme_noise) AS t_noise,
            SUM(s.theme_location) AS t_location,
            SUM(s.theme_value) AS t_value,
            SUM(s.theme_move_in) AS t_move_in,
            SUM(s.theme_move_out) AS t_move_out,
            SUM(s.theme_pets) AS t_pets,
            SUM(s.theme_parking) AS t_parking
        FROM gbp_review_sentiment s
        JOIN gbp_reviews r ON s.review_id = r.review_id
        WHERE r.review_create_time <= ?
        GROUP BY s.property_id
    """
    sent_rows = conn.execute(sentiment_query, (end_ts,)).fetchall()
    for r in sent_rows:
        pid = r["property_id"]
        if pid in data:
            data[pid]["sentiment_score"] = r["sentiment_score"]
            themes = {}
            for theme in ["maintenance", "staff", "amenities", "noise", "location",
                          "value", "move_in", "move_out", "pets", "parking"]:
                count = r[f"t_{theme}"] or 0
                if count > 0:
                    themes[theme] = count
            data[pid]["themes_json"] = json.dumps(themes, ensure_ascii=False)

    # Critical reviews (1-2 star, last 30 days, max 5 per property)
    critical_query = """
        SELECT property_id, star_rating_numeric, comment,
               reviewer_display_name, review_create_time
        FROM gbp_reviews
        WHERE review_create_time BETWEEN ? AND ?
          AND star_rating_numeric <= 2
          AND comment IS NOT NULL AND comment != ''
        ORDER BY property_id, review_create_time DESC
    """
    crit_rows = conn.execute(critical_query, (cur_start_ts, end_ts)).fetchall()
    crit_by_prop = {}
    for r in crit_rows:
        pid = r["property_id"]
        if pid not in crit_by_prop:
            crit_by_prop[pid] = []
        if len(crit_by_prop[pid]) < 5:
            crit_by_prop[pid].append({
                "reviewer": r["reviewer_display_name"],
                "rating": r["star_rating_numeric"],
                "comment": (r["comment"] or "")[:200],  # Truncate for D1 storage
                "date": r["review_create_time"][:10] if r["review_create_time"] else None,
            })
    for pid in data:
        if pid in crit_by_prop:
            data[pid]["critical_reviews_json"] = json.dumps(
                crit_by_prop[pid], ensure_ascii=False
            )

    return data


# ---------------------------------------------------------------------------
# SQL generation
# ---------------------------------------------------------------------------

def _sql_val(v) -> str:
    """Format a Python value as a SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"


# Table definitions: (table_name, fields_list)
PIB_TABLES = {
    "pib_ga4_metrics": [
        "total_sessions", "total_users", "new_users", "avg_session_duration",
        "organic_sessions", "direct_sessions", "paid_sessions", "referral_sessions", "social_sessions",
        "desktop_sessions", "mobile_sessions", "tablet_sessions",
        "tour_clicks", "phone_calls", "apply_clicks", "price_quotes", "form_starts", "form_submits",
        "sessions_trend_pct", "users_trend_pct",
    ],
    "pib_site_performance": [
        "mobile_score", "desktop_score",
        "mobile_lcp", "mobile_cls", "mobile_fid", "mobile_fcp",
        "desktop_lcp", "desktop_cls", "desktop_fid", "desktop_fcp",
    ],
    "pib_local_presence": [
        "total_profile_views", "maps_views", "search_views",
        "website_clicks", "phone_calls", "direction_requests",
        "action_rate", "views_trend_pct", "actions_trend_pct",
    ],
    "pib_search_performance": [
        "total_clicks", "total_impressions", "avg_ctr", "avg_position",
        "top_keywords_json",
    ],
    "pib_cir": [
        "total_sessions", "intent_events", "cir_value", "cir_status",
        "prior_cir_value", "cir_trend_pct",
    ],
    "pib_reviews": [
        "total_reviews", "avg_rating", "five_star_count", "one_star_count",
        "recent_30d_count", "avg_rating_trend", "sentiment_score",
        "themes_json", "critical_reviews_json",
    ],
}


def generate_upserts(
    table: str, fields: List[str], rows: List[Dict], now: str
) -> List[str]:
    """
    Generate INSERT-or-UPDATE SQL for a PIB table.
    Each row: { community_id, snapshot_date, ...fields }
    """
    sql_lines = []

    for row in rows:
        cid = row["community_id"]
        sd = row["snapshot_date"]
        new_id = str(uuid.uuid4())

        # INSERT columns
        insert_cols = ["id", "community_id", "snapshot_date"]
        insert_vals = [f"'{new_id}'", f"'{cid}'", f"'{sd}'"]
        for f in fields:
            insert_cols.append(f)
            insert_vals.append(_sql_val(row.get(f)))
        insert_cols.append("synced_at")
        insert_vals.append(f"'{now}'")

        cols_str = ", ".join(insert_cols)
        vals_str = ", ".join(insert_vals)

        # INSERT if not exists
        sql_lines.append(
            f"INSERT INTO {table} ({cols_str}) "
            f"SELECT {vals_str} "
            f"WHERE NOT EXISTS ("
            f"SELECT 1 FROM {table} "
            f"WHERE community_id = '{cid}' AND snapshot_date = '{sd}'"
            f");"
        )

        # UPDATE non-null fields
        sets = []
        for f in fields:
            v = row.get(f)
            if v is not None:
                sets.append(f"{f} = {_sql_val(v)}")
        sets.append(f"synced_at = '{now}'")
        set_str = ", ".join(sets)

        sql_lines.append(
            f"UPDATE {table} SET {set_str} "
            f"WHERE community_id = '{cid}' AND snapshot_date = '{sd}';"
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
) -> Tuple[List[str], Dict[str, int]]:
    """
    Gather all 6 PIB data sources for a single Friday and return SQL upserts.
    Returns: (sql_lines, {table: count})
    """
    # Fetch all data sources
    ga4_data = fetch_ga4_metrics(conn, friday)
    perf_data = fetch_site_performance(conn, friday)
    local_data = fetch_local_presence(conn, friday)
    search_data = fetch_search_performance(conn, friday)
    cir_data = fetch_cir(conn, friday)
    review_data = fetch_reviews(conn, friday)

    # Map source data to tables
    source_map = {
        "pib_ga4_metrics": ga4_data,
        "pib_site_performance": perf_data,
        "pib_local_presence": local_data,
        "pib_search_performance": search_data,
        "pib_cir": cir_data,
        "pib_reviews": review_data,
    }

    all_sql = []
    table_counts = {}

    for table, fields in PIB_TABLES.items():
        source = source_map[table]
        rows = []

        for ga4_id, info in community_map.items():
            if ga4_id in source:
                row = {
                    "community_id": info["id"],
                    "snapshot_date": friday,
                }
                row.update(source[ga4_id])
                rows.append(row)

        if rows:
            sql_lines = generate_upserts(table, fields, rows, now)
            all_sql.extend(sql_lines)

        table_counts[table] = len(rows)

    counts_str = " | ".join(f"{k.replace('pib_', '')}={v}" for k, v in table_counts.items())
    print(f"  📊 {friday}: [{counts_str}]")

    return all_sql, table_counts


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
    parser = argparse.ArgumentParser(description="PIB Data → D1 Sync")
    parser.add_argument("--date", help="Sync a specific Friday (YYYY-MM-DD)")
    parser.add_argument("--weeks", type=int, help="Backfill last N Fridays")
    parser.add_argument("--all", action="store_true", help="Backfill all available Fridays")
    parser.add_argument("--dry-run", action="store_true", help="Generate SQL but don't execute")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"📊 PIB DATA → D1 SYNC")
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
        f"-- Auto-generated: PIB Data → D1 sync",
        f"-- Generated: {now}",
        f"-- Fridays: {len(fridays)}",
        "",
    ]
    total_counts = {t: 0 for t in PIB_TABLES}

    for friday in fridays:
        sql_lines, counts = sync_friday(conn, community_map, friday, now)
        all_sql.extend(sql_lines)
        for t, c in counts.items():
            total_counts[t] += c

    conn.close()

    total_rows = sum(total_counts.values())
    if total_rows == 0:
        print("❌ No data generated — nothing to push")
        sys.exit(1)

    # Write SQL file
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    sql_file = GENERATED_DIR / f"pib_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    with open(sql_file, "w") as f:
        f.write("\n".join(all_sql))

    stmt_count = len([l for l in all_sql if l.startswith(("INSERT", "UPDATE"))])
    print(f"\n📋 Summary:")
    print(f"   Fridays processed: {len(fridays)}")
    for t, c in total_counts.items():
        print(f"   {t}: {c} community-weeks")
    print(f"   SQL statements: {stmt_count}")
    print(f"   SQL file: {sql_file.name}")

    if args.dry_run:
        print(f"\n🏷️  DRY RUN — SQL written but not executed")
        print(f"   Review: {sql_file}")
        return

    success = execute_sql(sql_file)
    if not success:
        sys.exit(1)

    print(f"\n✅ PIB data sync complete!")


if __name__ == "__main__":
    main()
