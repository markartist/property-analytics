#!/usr/bin/env python3
"""Audit Google Ads attribution and conversion-health from local source tables."""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_OUTPUT_ROOT = ROOT / "reports" / "google_ads_integrity"


def money(value: Any) -> str:
    try:
        return f"${float(value):,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS google_ads_conversion_health (
            id TEXT PRIMARY KEY,
            audit_date TEXT NOT NULL,
            window_start TEXT NOT NULL,
            window_end TEXT NOT NULL,
            property_id TEXT,
            ga4_property_id TEXT,
            property_name TEXT,
            campaign_id TEXT NOT NULL,
            campaign_name TEXT NOT NULL,
            campaign_status TEXT,
            campaign_type TEXT,
            impressions INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            conversions REAL DEFAULT 0,
            cost_micros INTEGER DEFAULT 0,
            cost REAL DEFAULT 0,
            attribution_confidence TEXT,
            match_score REAL,
            health_status TEXT NOT NULL,
            reasons_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_google_ads_health_property
        ON google_ads_conversion_health(property_id, ga4_property_id, window_end)
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_google_ads_health_status
        ON google_ads_conversion_health(health_status, cost DESC, clicks DESC)
        """
    )


def query_rows(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def load_campaign_health(conn: sqlite3.Connection, start: date, end: date) -> list[dict[str, Any]]:
    return query_rows(
        conn,
        """
        SELECT
            c.property_id AS ga4_property_id,
            COALESCE(a.property_id, c.property_id) AS property_id,
            a.property_name,
            c.campaign_id,
            c.campaign_name,
            c.campaign_status,
            c.campaign_type,
            SUM(c.impressions) AS impressions,
            SUM(c.clicks) AS clicks,
            SUM(c.conversions) AS conversions,
            SUM(c.cost_micros) AS cost_micros,
            ROUND(SUM(c.cost_micros) / 1000000.0, 2) AS cost,
            a.confidence AS attribution_confidence,
            a.match_score,
            a.is_unmatched
        FROM google_ads_campaigns c
        LEFT JOIN google_ads_campaign_property_attribution a
            ON a.campaign_id = c.campaign_id
        WHERE c.metric_date BETWEEN ? AND ?
        GROUP BY
            c.property_id,
            COALESCE(a.property_id, c.property_id),
            a.property_name,
            c.campaign_id,
            c.campaign_name,
            c.campaign_status,
            c.campaign_type,
            a.confidence,
            a.match_score,
            a.is_unmatched
        ORDER BY cost DESC, clicks DESC
        """,
        (start.isoformat(), end.isoformat()),
    )


def load_unmatched_attribution(conn: sqlite3.Connection, spend_threshold: float, click_threshold: int) -> list[dict[str, Any]]:
    return query_rows(
        conn,
        """
        SELECT *
        FROM google_ads_campaign_property_attribution
        WHERE is_unmatched = 1
          AND (COALESCE(spend_30d, 0) >= ? OR COALESCE(clicks_30d, 0) >= ?)
        ORDER BY COALESCE(spend_30d, 0) DESC, COALESCE(clicks_30d, 0) DESC
        """,
        (spend_threshold, click_threshold),
    )


def classify(row: dict[str, Any], spend_threshold: float, click_threshold: int) -> tuple[str, list[str]]:
    reasons: list[str] = []
    cost = float(row.get("cost") or 0)
    clicks = int(row.get("clicks") or 0)
    conversions = float(row.get("conversions") or 0)
    confidence = str(row.get("attribution_confidence") or "")

    if row.get("is_unmatched") == 1 or confidence == "unmatched":
        reasons.append("campaign is unmatched in attribution table")
        return "attribution_gap", reasons
    if not confidence:
        reasons.append("campaign has performance rows but no attribution evidence row")
        return "attribution_missing", reasons
    if conversions == 0 and (cost >= spend_threshold or clicks >= click_threshold):
        reasons.append(f"active spend/clicks with zero conversions: {money(cost)}, {clicks} clicks")
        return "active_zero_conversions", reasons
    if conversions == 0 and (cost > 0 or clicks > 0):
        reasons.append("low-volume active campaign with zero conversions")
        return "watch_zero_conversions", reasons
    return "healthy", reasons


def persist_health(
    conn: sqlite3.Connection,
    rows: list[dict[str, Any]],
    audit_date: date,
    start: date,
    end: date,
    spend_threshold: float,
    click_threshold: int,
) -> list[dict[str, Any]]:
    ensure_schema(conn)
    output: list[dict[str, Any]] = []
    for row in rows:
        health_status, reasons = classify(row, spend_threshold, click_threshold)
        record = {
            **row,
            "audit_date": audit_date.isoformat(),
            "window_start": start.isoformat(),
            "window_end": end.isoformat(),
            "health_status": health_status,
            "reasons": reasons,
            "reasons_json": json.dumps(reasons),
        }
        record["id"] = "|".join([str(record["campaign_id"]), start.isoformat(), end.isoformat()])
        conn.execute(
            """
            INSERT OR REPLACE INTO google_ads_conversion_health (
                id, audit_date, window_start, window_end, property_id, ga4_property_id, property_name,
                campaign_id, campaign_name, campaign_status, campaign_type, impressions, clicks,
                conversions, cost_micros, cost, attribution_confidence, match_score, health_status,
                reasons_json, updated_at
            ) VALUES (
                :id, :audit_date, :window_start, :window_end, :property_id, :ga4_property_id, :property_name,
                :campaign_id, :campaign_name, :campaign_status, :campaign_type, :impressions, :clicks,
                :conversions, :cost_micros, :cost, :attribution_confidence, :match_score, :health_status,
                :reasons_json, datetime('now')
            )
            """,
            record,
        )
        output.append(record)
    return output


def write_outputs(output_dir: Path, rows: list[dict[str, Any]], unmatched: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "summary.json").write_text(
        json.dumps({"summary": summary, "campaigns": rows, "unmatched_campaigns": unmatched}, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    fields = [
        "health_status",
        "property_id",
        "ga4_property_id",
        "property_name",
        "campaign_id",
        "campaign_name",
        "campaign_status",
        "campaign_type",
        "impressions",
        "clicks",
        "conversions",
        "cost",
        "attribution_confidence",
        "match_score",
        "reasons_json",
    ]
    with (output_dir / "campaign_health.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fields})

    lines = [
        "# Google Ads Integrity Audit",
        "",
        f"Audit date: {summary['audit_date']}",
        f"Window: {summary['window_start']} to {summary['window_end']}",
        "",
        "## Summary",
        "",
        f"- Campaigns audited: {summary['campaigns_audited']}",
        f"- Active zero-conversion campaigns: {summary['active_zero_conversions']}",
        f"- Attribution missing/gap campaigns: {summary['attribution_gaps']}",
        f"- Unmatched active campaigns from mapping: {summary['unmatched_active_campaigns']}",
        "",
        "## Top Issues",
        "",
    ]
    issue_rows = [row for row in rows if row["health_status"] != "healthy"]
    if not issue_rows and not unmatched:
        lines.append("No material Google Ads integrity issues found.")
    for row in issue_rows[:30]:
        lines.append(
            f"- {row['health_status']}: {row.get('property_name') or row.get('property_id')} / "
            f"{row['campaign_name']} / {money(row.get('cost'))} / {row.get('clicks') or 0} clicks / "
            f"{'; '.join(row.get('reasons') or [])}"
        )
    for row in unmatched[:30]:
        lines.append(
            f"- unmatched_active_campaign: {row.get('campaign_name')} / "
            f"{money(row.get('spend_30d'))} / {row.get('clicks_30d') or 0} clicks"
        )
    (output_dir / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--lookback-days", type=int, default=7)
    parser.add_argument("--end-date", default=date.today().isoformat())
    parser.add_argument("--active-spend-threshold", type=float, default=25.0)
    parser.add_argument("--active-click-threshold", type=int, default=10)
    parser.add_argument("--output-dir", default=None)
    args = parser.parse_args()

    end = datetime.strptime(args.end_date, "%Y-%m-%d").date()
    start = end - timedelta(days=args.lookback_days - 1)
    audit_date = date.today()
    output_dir = Path(args.output_dir) if args.output_dir else DEFAULT_OUTPUT_ROOT / f"{audit_date.isoformat()}_{datetime.now().strftime('%H%M%S')}"

    with sqlite3.connect(args.db) as conn:
        ensure_schema(conn)
        rows = load_campaign_health(conn, start, end)
        health_rows = persist_health(
            conn,
            rows,
            audit_date,
            start,
            end,
            args.active_spend_threshold,
            args.active_click_threshold,
        )
        unmatched = load_unmatched_attribution(conn, args.active_spend_threshold, args.active_click_threshold)

    summary = {
        "audit_date": audit_date.isoformat(),
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "campaigns_audited": len(health_rows),
        "active_zero_conversions": sum(1 for row in health_rows if row["health_status"] == "active_zero_conversions"),
        "watch_zero_conversions": sum(1 for row in health_rows if row["health_status"] == "watch_zero_conversions"),
        "attribution_gaps": sum(1 for row in health_rows if row["health_status"] in {"attribution_gap", "attribution_missing"}),
        "unmatched_active_campaigns": len(unmatched),
        "active_spend_threshold": args.active_spend_threshold,
        "active_click_threshold": args.active_click_threshold,
        "output_dir": str(output_dir),
    }
    write_outputs(output_dir, health_rows, unmatched, summary)
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
