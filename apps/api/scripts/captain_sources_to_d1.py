#!/usr/bin/env python3
"""
Captain source-table D1 sync.

This is a narrow bridge for the Captain runtime: it mirrors source-level rows
from the canonical local database into remote D1 for a selected property.
The general PIB mirror writes report tables; Captain support agents need the
source tables they read directly.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Iterable

from wrangler_auth import build_runtime_env, npx_wrangler_prefix

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
REPO_ROOT = API_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402

CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"
OPERATING_METRICS_MIGRATION = API_DIR / "migrations" / "0028_create_property_operating_metrics.sql"
AVAILABLE_UNIT_INTEREST_MIGRATION = API_DIR / "migrations" / "0029_create_available_unit_interest_metrics.sql"
MARKETING_BI_CONVERSION_MIGRATION = API_DIR / "migrations" / "0030_create_marketing_bi_conversion_sources.sql"
MARKETING_BI_PACKET_MIGRATION = API_DIR / "migrations" / "0031_create_marketing_bi_daily_packets.sql"
MARKETING_BI_CONVERSION_SUMMARY_MIGRATION = (
    API_DIR / "migrations" / "0034_create_marketing_bi_conversion_summary.sql"
)
MARKETING_BI_EXCEL_EXPORTS_MIGRATION = API_DIR / "migrations" / "0035_create_marketing_bi_excel_exports.sql"
MARKETING_BI_CONVERSION_DASHBOARD_MIGRATION = (
    API_DIR / "migrations" / "0036_create_marketing_bi_conversion_dashboard.sql"
)
MARKETING_BI_RECOVERY_MIGRATION = API_DIR / "migrations" / "0037_create_marketing_bi_recovery_sources.sql"
MARKETING_BI_COST_PER_CONVERSION_MIGRATION = (
    API_DIR / "migrations" / "0038_create_marketing_bi_cost_per_conversion.sql"
)
MARKETING_OPS_SUMMARY_MIGRATION = API_DIR / "migrations" / "0041_create_marketing_ops_summary.sql"
SPOTLIGHT_WEEKLY_FIELD_NOTES_MIGRATION = API_DIR / "migrations" / "0042_create_spotlight_weekly_field_notes.sql"
REPUTATION_COM_MIGRATION = API_DIR / "migrations" / "0040_create_reputation_com_tables.sql"
COMPETITOR_MARKET_RESEARCH_MIGRATION = (
    API_DIR / "migrations" / "0043_create_competitor_market_research.sql"
)
APTIQ_WATCHLIST_SUMMARY_MIGRATION = API_DIR / "migrations" / "0044_create_aptiq_watchlist_summaries.sql"
MARKETING_BI_SOURCE_PERFORMANCE_MIGRATION = (
    API_DIR / "migrations" / "0045_create_marketing_bi_source_performance.sql"
)

SOURCE_TABLES = [
    "guest_card_metrics",
    "unit_availability_units",
    "ga4_daily_metrics",
    "google_ads_campaigns",
    "pagespeed_metrics",
    "gbp_daily_insights",
    "gbp_reviews",
    "gbp_reviews_summary",
    "gbp_review_sentiment",
]

OPERATING_METRICS_COLUMNS = [
    "id",
    "property_id",
    "community_id",
    "metric_date",
    "period_start",
    "period_end",
    "occupancy_rate",
    "leased_rate",
    "occupied_units",
    "leased_units",
    "available_units",
    "total_units",
    "leases_count",
    "cancellations_count",
    "denials_count",
    "move_ins_count",
    "move_outs_count",
    "booked_concession_dollars",
    "booked_concession_lease_count",
    "source_system",
    "source_file",
    "evidence_json",
    "created_at",
    "updated_at",
]


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{CANONICAL_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def create_table_sql(conn: sqlite3.Connection, table: str) -> str:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    if not row or not row["sql"]:
        raise RuntimeError(f"Missing local source table: {table}")
    return str(row["sql"]).replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1) + ";"


def column_names(conn: sqlite3.Connection, table: str) -> list[str]:
    return [str(row[1]) for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return bool(row)


def insert_rows(table: str, columns: list[str], rows: Iterable[sqlite3.Row]) -> list[str]:
    col_sql = ", ".join(columns)
    statements = []
    for row in rows:
        values = ", ".join(sql_literal(row[col]) for col in columns)
        statements.append(f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({values});")
    return statements


def build_sql(property_code: str, ga4_property_id: str, community_id: str) -> tuple[list[str], dict[str, int]]:
    conn = connect()
    counts: dict[str, int] = {}
    statements: list[str] = ["PRAGMA foreign_keys = OFF;"]
    try:
        for table in SOURCE_TABLES:
            statements.append(create_table_sql(conn, table))

        filters = {
            "guest_card_metrics": ("property_code = ?", (property_code,)),
            "unit_availability_units": ("property_id = ?", (ga4_property_id,)),
            "ga4_daily_metrics": ("property_id = ? AND metric_date >= date((SELECT MAX(metric_date) FROM ga4_daily_metrics WHERE property_id = ?), '-60 day')", (ga4_property_id, ga4_property_id)),
            "google_ads_campaigns": ("property_id = ? AND metric_date >= date((SELECT MAX(metric_date) FROM google_ads_campaigns WHERE property_id = ?), '-90 day')", (ga4_property_id, ga4_property_id)),
            "pagespeed_metrics": ("property_id = ? AND metric_date >= date((SELECT MAX(metric_date) FROM pagespeed_metrics WHERE property_id = ?), '-60 day')", (ga4_property_id, ga4_property_id)),
            "gbp_daily_insights": ("property_id = ? AND metric_date >= date((SELECT MAX(metric_date) FROM gbp_daily_insights WHERE property_id = ?), '-60 day')", (ga4_property_id, ga4_property_id)),
            "gbp_reviews": ("property_id = ? AND review_create_time >= datetime((SELECT MAX(review_create_time) FROM gbp_reviews WHERE property_id = ?), '-180 day')", (ga4_property_id, ga4_property_id)),
            "gbp_reviews_summary": ("property_id = ? AND metric_date >= date((SELECT MAX(metric_date) FROM gbp_reviews_summary WHERE property_id = ?), '-180 day')", (ga4_property_id, ga4_property_id)),
            "gbp_review_sentiment": ("property_id = ? AND review_id IN (SELECT review_id FROM gbp_reviews WHERE property_id = ? AND review_create_time >= datetime((SELECT MAX(review_create_time) FROM gbp_reviews WHERE property_id = ?), '-180 day'))", (ga4_property_id, ga4_property_id, ga4_property_id)),
        }

        for table, (where_sql, params) in filters.items():
            cols = column_names(conn, table)
            rows = conn.execute(f"SELECT * FROM {table} WHERE {where_sql}", params).fetchall()
            counts[table] = len(rows)
            statements.extend(insert_rows(table, cols, rows))

        statements.append(OPERATING_METRICS_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "property_operating_metrics"):
            rows = conn.execute(
                """
                SELECT *
                FROM property_operating_metrics
                WHERE property_id = ?
                ORDER BY metric_date
                """,
                (property_code,),
            ).fetchall()
            cols = [col for col in OPERATING_METRICS_COLUMNS if col in column_names(conn, "property_operating_metrics")]
            counts["property_operating_metrics"] = len(rows)
            statements.extend(insert_rows("property_operating_metrics", cols, rows))
        else:
            counts["property_operating_metrics"] = 0

        # Recreate this advisory mirror table so remote D1 cannot get stuck on
        # older schemas when new descriptive columns are added locally.
        statements.append("DROP TABLE IF EXISTS available_unit_interest_metrics;")
        statements.append(AVAILABLE_UNIT_INTEREST_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "available_unit_interest_metrics"):
            cols = column_names(conn, "available_unit_interest_metrics")
            rows = conn.execute(
                """
                SELECT *
                FROM available_unit_interest_metrics
                WHERE report_date >= date((SELECT MAX(report_date) FROM available_unit_interest_metrics), '-45 day')
                ORDER BY report_date, location, current_level
                """,
            ).fetchall()
            counts["available_unit_interest_metrics"] = len(rows)
            statements.extend(insert_rows("available_unit_interest_metrics", cols, rows))
        else:
            counts["available_unit_interest_metrics"] = 0

        statements.append(MARKETING_BI_CONVERSION_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_cancel_denial_by_source"):
            cols = column_names(conn, "marketing_cancel_denial_by_source")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_cancel_denial_by_source
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_cancel_denial_by_source WHERE property_id = ? OR community_id = ?), '-45 day')
                ORDER BY report_date, marketing_source, cancel_denial_type, cancel_denial_reason
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_cancel_denial_by_source"] = len(rows)
            statements.extend(insert_rows("marketing_cancel_denial_by_source", cols, rows))
        else:
            counts["marketing_cancel_denial_by_source"] = 0

        if table_exists(conn, "marketing_traffic_conversions"):
            cols = column_names(conn, "marketing_traffic_conversions")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_traffic_conversions
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_traffic_conversions WHERE property_id = ? OR community_id = ?), '-45 day')
                ORDER BY report_date, property_name
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_traffic_conversions"] = len(rows)
            statements.extend(insert_rows("marketing_traffic_conversions", cols, rows))
        else:
            counts["marketing_traffic_conversions"] = 0

        statements.append(MARKETING_BI_EXCEL_EXPORTS_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_bi_property_summary_rows"):
            cols = column_names(conn, "marketing_bi_property_summary_rows")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_bi_property_summary_rows
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_bi_property_summary_rows WHERE property_id = ? OR community_id = ?), '-45 day')
                ORDER BY report_date DESC, property_name
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_bi_property_summary_rows"] = len(rows)
            statements.extend(insert_rows("marketing_bi_property_summary_rows", cols, rows))
        else:
            counts["marketing_bi_property_summary_rows"] = 0

        statements.append(MARKETING_BI_RECOVERY_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_bi_ad_spend_performance_month"):
            cols = column_names(conn, "marketing_bi_ad_spend_performance_month")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_bi_ad_spend_performance_month
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_bi_ad_spend_performance_month WHERE property_id = ? OR community_id = ?), '-120 day')
                ORDER BY report_date DESC, calendar_month DESC
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_bi_ad_spend_performance_month"] = len(rows)
            statements.extend(insert_rows("marketing_bi_ad_spend_performance_month", cols, rows))
        else:
            counts["marketing_bi_ad_spend_performance_month"] = 0

        statements.append(MARKETING_BI_COST_PER_CONVERSION_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_bi_cost_per_conversion_rows"):
            cols = column_names(conn, "marketing_bi_cost_per_conversion_rows")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_bi_cost_per_conversion_rows
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_bi_cost_per_conversion_rows WHERE property_id = ? OR community_id = ?), '-120 day')
                ORDER BY report_date DESC, calendar_month, property_name, marketing_source_group
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_bi_cost_per_conversion_rows"] = len(rows)
            statements.extend(insert_rows("marketing_bi_cost_per_conversion_rows", cols, rows))
        else:
            counts["marketing_bi_cost_per_conversion_rows"] = 0

        statements.append(MARKETING_OPS_SUMMARY_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_ops_summary_rows"):
            cols = column_names(conn, "marketing_ops_summary_rows")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_ops_summary_rows
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_ops_summary_rows WHERE property_id = ? OR community_id = ?), '-120 day')
                ORDER BY report_date DESC, property_name
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_ops_summary_rows"] = len(rows)
            statements.extend(insert_rows("marketing_ops_summary_rows", cols, rows))
        else:
            counts["marketing_ops_summary_rows"] = 0

        statements.append(MARKETING_BI_PACKET_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_bi_daily_packets"):
            cols = column_names(conn, "marketing_bi_daily_packets")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_bi_daily_packets
                ORDER BY report_date DESC
                LIMIT 1
                """
            ).fetchall()
            counts["marketing_bi_daily_packets"] = len(rows)
            statements.extend(insert_rows("marketing_bi_daily_packets", cols, rows))
        else:
            counts["marketing_bi_daily_packets"] = 0

        statements.append(MARKETING_BI_SOURCE_PERFORMANCE_MIGRATION.read_text(encoding="utf-8").strip())
        if table_exists(conn, "marketing_bi_source_performance_rows"):
            cols = column_names(conn, "marketing_bi_source_performance_rows")
            rows = conn.execute(
                """
                SELECT *
                FROM marketing_bi_source_performance_rows
                WHERE (property_id = ? OR community_id = ?)
                  AND report_date >= date((SELECT MAX(report_date) FROM marketing_bi_source_performance_rows WHERE property_id = ? OR community_id = ?), '-120 day')
                ORDER BY report_date DESC, source_group, source_desc
                """,
                (property_code, community_id, property_code, community_id),
            ).fetchall()
            counts["marketing_bi_source_performance_rows"] = len(rows)
            statements.extend(insert_rows("marketing_bi_source_performance_rows", cols, rows))
        else:
            counts["marketing_bi_source_performance_rows"] = 0

        statements.append(REPUTATION_COM_MIGRATION.read_text(encoding="utf-8").strip())
        for table in [
            "reputation_com_location_leaderboard",
            "reputation_com_score_components",
            "reputation_com_score_time_series",
            "reputation_com_local_competition",
        ]:
            if table_exists(conn, table):
                cols = column_names(conn, table)
                rows = conn.execute(
                    f"""
                    SELECT *
                    FROM {table}
                    WHERE property_id = ? OR community_id = ?
                    ORDER BY report_date DESC
                    """,
                    (property_code, community_id),
                ).fetchall()
                counts[table] = len(rows)
                statements.extend(insert_rows(table, cols, rows))
            else:
                counts[table] = 0

        statements.append(COMPETITOR_MARKET_RESEARCH_MIGRATION.read_text(encoding="utf-8").strip())
        for table in [
            "competitor_market_research_snapshots",
            "competitor_market_research_observations",
        ]:
            if table_exists(conn, table):
                cols = column_names(conn, table)
                rows = conn.execute(
                    f"""
                    SELECT *
                    FROM {table}
                    WHERE (property_id = ? OR community_id = ?)
                      AND snapshot_date >= date((SELECT MAX(snapshot_date) FROM {table}), '-180 day')
                    ORDER BY snapshot_date DESC
                    """,
                    (property_code, community_id),
                ).fetchall()
                counts[table] = len(rows)
                statements.extend(insert_rows(table, cols, rows))
            else:
                counts[table] = 0

        # Remote D1 already has a compact GSC table used by app surfaces.
        # Populate that shape from the source table, keyed by community_id.
        gsc_rows = conn.execute(
            """
            SELECT metric_date,
                   SUM(clicks) AS clicks,
                   SUM(impressions) AS impressions,
                   CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) ELSE NULL END AS ctr,
                   AVG(average_position) AS average_position
            FROM gsc_daily_metrics
            WHERE (property_id = ? OR ga4_property_id = ?)
              AND metric_date >= date((SELECT MAX(metric_date) FROM gsc_daily_metrics WHERE property_id = ? OR ga4_property_id = ?), '-60 day')
            GROUP BY metric_date
            ORDER BY metric_date
            """,
            (ga4_property_id, ga4_property_id, ga4_property_id, ga4_property_id),
        ).fetchall()
        counts["gsc_daily_metrics"] = len(gsc_rows)
        statements.append(
            """
            CREATE TABLE IF NOT EXISTS gsc_daily_metrics (
              id TEXT PRIMARY KEY,
              community_id TEXT NOT NULL,
              metric_date TEXT NOT NULL,
              clicks INTEGER NOT NULL DEFAULT 0,
              impressions INTEGER NOT NULL DEFAULT 0,
              ctr REAL,
              average_position REAL,
              synced_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """.strip()
        )
        for row in gsc_rows:
            metric_date = str(row["metric_date"])[:10]
            statements.append(
                "INSERT OR REPLACE INTO gsc_daily_metrics "
                "(id, community_id, metric_date, clicks, impressions, ctr, average_position, synced_at) VALUES "
                f"({sql_literal(f'gsc_{community_id}_{metric_date}')}, {sql_literal(community_id)}, {sql_literal(metric_date)}, "
                f"{sql_literal(row['clicks'] or 0)}, {sql_literal(row['impressions'] or 0)}, "
                f"{sql_literal(row['ctr'])}, {sql_literal(row['average_position'])}, datetime('now'));"
            )

        return statements, counts
    finally:
        conn.close()


def _run_remote_file(temp_path: Path) -> int:
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--file",
        str(temp_path),
        "--config",
        str(WRANGLER_TOML),
    ]
    attempts = 3
    for attempt in range(1, attempts + 1):
        proc = subprocess.Popen(
            cmd,
            cwd=str(API_DIR),
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        timed_out = False
        try:
            stdout, stderr = proc.communicate(timeout=1800)
            returncode = proc.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                stdout, stderr = proc.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                stdout, stderr = proc.communicate()
            returncode = 124
            stderr = f"Command timed out after 1800s: {' '.join(cmd)}\n{stderr or ''}"
        print(stdout)
        if stderr:
            print(stderr, file=sys.stderr)
        if returncode == 0:
            return
        lowered = f"{stdout}\n{stderr}".lower()
        transient = any(
            marker in lowered
            for marker in (
                "fetch failed",
                "connectivity issue",
                "remote end closed connection",
                "connection reset",
                "timed out",
            )
        )
        if timed_out:
            transient = True
        if attempt < attempts and transient:
            time.sleep(2 * attempt)
            continue
        return returncode
    return 1


def _is_insert_statement(statement: str) -> bool:
    return statement.lstrip().upper().startswith("INSERT ")


def _chunk_statements(
    data_statements: list[str],
    *,
    max_statements: int = 15_000,
    max_bytes: int = 20_000_000,
) -> list[list[str]]:
    chunks: list[list[str]] = []
    current: list[str] = []
    current_bytes = 0
    for statement in data_statements:
        statement_bytes = len(statement.encode("utf-8")) + 1
        if current and (len(current) >= max_statements or current_bytes + statement_bytes > max_bytes):
            chunks.append(current)
            current = []
            current_bytes = 0
        current.append(statement)
        current_bytes += statement_bytes
    if current:
        chunks.append(current)
    return chunks


def execute_remote(statements: list[str], property_code: str, ga4_property_id: str) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    prefix_statements = [statement for statement in statements if not _is_insert_statement(statement)]
    data_statements = [statement for statement in statements if _is_insert_statement(statement)]
    batches = _chunk_statements(data_statements)
    if not batches:
        batches = [[]]

    total_batches = len(batches)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    for batch_index, batch_statements in enumerate(batches, start=1):
        lines = list(prefix_statements if batch_index == 1 else [])
        lines.extend(batch_statements)
        batch_path = GENERATED_DIR / (
            f"captain_sources_{property_code}_{ga4_property_id}_{timestamp}_batch{batch_index}.sql"
        )
        batch_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(
            json.dumps(
                {
                    "batch": batch_index,
                    "total_batches": total_batches,
                    "insert_statements": len(batch_statements),
                    "sql_file": str(batch_path),
                }
            )
        )
        returncode = _run_remote_file(batch_path)
        if returncode != 0:
            raise SystemExit(returncode)
        if batch_index < total_batches:
            time.sleep(2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mirror Captain source tables to remote D1 for one property.")
    parser.add_argument("--property-key", default="AR4PB", help="Any known property identity: property code, GA4 id, GSC URL, name, or alias.")
    parser.add_argument("--property-code", help="Optional override. Defaults from the identity matrix.")
    parser.add_argument("--ga4-property-id", help="Optional override. Defaults from the identity matrix.")
    parser.add_argument("--community-id", help="Optional override. Defaults from the identity matrix when known.")
    parser.add_argument("--date", help="Accepted for d1_mirror_sync compatibility; Captain source sync uses latest source rows.")
    parser.add_argument("--weeks", help="Accepted for d1_mirror_sync compatibility; Captain source sync uses built-in source windows.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    identity = resolve_property_identity(args.property_key)
    property_code = args.property_code or (identity.marketing_bi_property_id if identity else args.property_key)
    ga4_property_id = args.ga4_property_id or (identity.ga4_property_id if identity else args.property_key)
    community_id = args.community_id or (identity.community_id if identity else None)
    if not ga4_property_id:
        raise SystemExit(f"Unable to resolve GA4 property id for {args.property_key}")
    if not community_id:
        raise SystemExit(f"Unable to resolve community id for {args.property_key}")

    statements, counts = build_sql(property_code, ga4_property_id, community_id)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out = GENERATED_DIR / f"captain_sources_{property_code}_{ga4_property_id}.sql"
    out.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(json.dumps({"sql": str(out), "counts": counts}, indent=2))
    if not args.dry_run:
        execute_remote(statements, property_code, ga4_property_id)


if __name__ == "__main__":
    main()
