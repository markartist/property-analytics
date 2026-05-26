#!/usr/bin/env python3
"""
Generate a PIB-style roundup for the five pilot properties' SightMap signals.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path


DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
OUT_DIR = Path("/Users/mark/Property_Analytics/reports/roundups")
PILOT_PROPERTIES = [
    ("The District Universal Boulevard", "378644585"),
    ("Champions Green", "378404769"),
    ("The Harrison", "378702475"),
    ("Calais Midtown", "378381499"),
    ("Ventana", "378380644"),
]


def fetch_property_metrics(conn: sqlite3.Connection, property_name: str, property_id: str) -> dict:
    row = conn.execute(
        """
        SELECT
            MIN(event_date) AS first_sightmap_date,
            MAX(event_date) AS last_sightmap_date,
            COUNT(DISTINCT event_date) AS active_days,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_filters_change' THEN event_count ELSE 0 END), 0) AS filters_changed,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_matches_impression' THEN event_count ELSE 0 END), 0) AS unit_matches_impressions,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_list_impression' THEN event_count ELSE 0 END), 0) AS unit_list_impressions,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_map_unit_click' THEN event_count ELSE 0 END), 0) AS unit_map_clicks,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_list_change' THEN event_count ELSE 0 END), 0) AS unit_list_changes,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_details_outbound_click' THEN event_count ELSE 0 END), 0) AS details_outbound_clicks,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_list_unit_click' THEN event_count ELSE 0 END), 0) AS unit_list_unit_clicks,
            COALESCE(SUM(CASE WHEN event_name = 'sightmap_unit_details_apply_click' THEN event_count ELSE 0 END), 0) AS details_apply_clicks
        FROM ga4_event_facts
        WHERE property_id = ?
          AND event_name LIKE 'sightmap_%'
          AND event_date BETWEEN date('now','-30 day') AND date('now','-1 day')
        """,
        (property_id,),
    ).fetchone()
    sessions_30 = conn.execute(
        """
        SELECT COALESCE(SUM(sessions), 0) AS sessions
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND metric_date BETWEEN date('now','-30 day') AND date('now','-1 day')
        """,
        (property_id,),
    ).fetchone()["sessions"]
    recent = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN event_name IN ('sightmap_unit_map_unit_click','sightmap_unit_list_unit_click') THEN event_count ELSE 0 END), 0) AS unit_clicks,
            COALESCE(SUM(CASE WHEN event_name IN ('sightmap_unit_details_outbound_click','sightmap_unit_details_apply_click') THEN event_count ELSE 0 END), 0) AS conversion_clicks,
            COALESCE(SUM(CASE WHEN event_name IN ('sightmap_filters_change','sightmap_unit_list_change') THEN event_count ELSE 0 END), 0) AS filter_actions
        FROM ga4_event_facts
        WHERE property_id = ?
          AND event_name LIKE 'sightmap_%'
          AND event_date BETWEEN '2026-04-06' AND '2026-04-12'
        """,
        (property_id,),
    ).fetchone()
    prior = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN event_name IN ('sightmap_unit_map_unit_click','sightmap_unit_list_unit_click') THEN event_count ELSE 0 END), 0) AS unit_clicks,
            COALESCE(SUM(CASE WHEN event_name IN ('sightmap_unit_details_outbound_click','sightmap_unit_details_apply_click') THEN event_count ELSE 0 END), 0) AS conversion_clicks,
            COALESCE(SUM(CASE WHEN event_name IN ('sightmap_filters_change','sightmap_unit_list_change') THEN event_count ELSE 0 END), 0) AS filter_actions
        FROM ga4_event_facts
        WHERE property_id = ?
          AND event_name LIKE 'sightmap_%'
          AND event_date BETWEEN '2026-03-30' AND '2026-04-05'
        """,
        (property_id,),
    ).fetchone()
    recent_sessions = conn.execute(
        """
        SELECT COALESCE(SUM(sessions), 0) AS sessions
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND metric_date BETWEEN '2026-04-06' AND '2026-04-12'
        """,
        (property_id,),
    ).fetchone()["sessions"]
    prior_sessions = conn.execute(
        """
        SELECT COALESCE(SUM(sessions), 0) AS sessions
        FROM ga4_daily_metrics
        WHERE property_id = ?
          AND metric_date BETWEEN '2026-03-30' AND '2026-04-05'
        """,
        (property_id,),
    ).fetchone()["sessions"]

    unit_clicks = row["unit_map_clicks"] + row["unit_list_unit_clicks"]
    conversion_clicks = row["details_outbound_clicks"] + row["details_apply_clicks"]
    filter_actions = row["filters_changed"] + row["unit_list_changes"]
    impressions = row["unit_matches_impressions"] + row["unit_list_impressions"]

    def pct_change(current: int, prior: int) -> str:
        if prior <= 0:
            return "new"
        return f"{((current - prior) / prior) * 100:+.0f}%"

    return {
        "property_name": property_name,
        "property_id": property_id,
        "first_sightmap_date": row["first_sightmap_date"],
        "last_sightmap_date": row["last_sightmap_date"],
        "active_days": row["active_days"],
        "sessions_30": sessions_30,
        "filter_actions": filter_actions,
        "impressions": impressions,
        "unit_clicks": unit_clicks,
        "conversion_clicks": conversion_clicks,
        "unit_click_rate": (unit_clicks * 100.0 / sessions_30) if sessions_30 else 0.0,
        "conversion_rate": (conversion_clicks * 100.0 / sessions_30) if sessions_30 else 0.0,
        "unit_click_share": (unit_clicks * 100.0 / impressions) if impressions else 0.0,
        "conversion_from_clicks": (conversion_clicks * 100.0 / unit_clicks) if unit_clicks else 0.0,
        "recent7_unit_clicks": recent["unit_clicks"],
        "prior7_unit_clicks": prior["unit_clicks"],
        "recent7_conversion_clicks": recent["conversion_clicks"],
        "prior7_conversion_clicks": prior["conversion_clicks"],
        "recent7_filter_actions": recent["filter_actions"],
        "prior7_filter_actions": prior["filter_actions"],
        "recent7_sessions": recent_sessions,
        "prior7_sessions": prior_sessions,
        "recent7_unit_rate": (recent["unit_clicks"] * 100.0 / recent_sessions) if recent_sessions else 0.0,
        "prior7_unit_rate": (prior["unit_clicks"] * 100.0 / prior_sessions) if prior_sessions else 0.0,
        "recent7_conversion_rate": (recent["conversion_clicks"] * 100.0 / recent_sessions) if recent_sessions else 0.0,
        "prior7_conversion_rate": (prior["conversion_clicks"] * 100.0 / prior_sessions) if prior_sessions else 0.0,
        "unit_click_change_label": pct_change(recent["unit_clicks"], prior["unit_clicks"]),
        "conversion_change_label": pct_change(recent["conversion_clicks"], prior["conversion_clicks"]),
        "filter_change_label": pct_change(recent["filter_actions"], prior["filter_actions"]),
    }


def trend_note(metric: dict) -> str:
    if metric["property_name"] == "Ventana":
        return "Highest shopping depth in the pilot set; still converting well despite softer week-over-week click volume."
    if metric["property_name"] == "The District Universal Boulevard":
        return "Strongest downstream action quality; shoppers are turning unit clicks into outbound/apply actions more efficiently than the rest."
    if metric["property_name"] == "Calais Midtown":
        return "Balanced middle performer; browsing is solid and downstream conversion remains efficient."
    if metric["property_name"] == "Champions Green":
        return "Inventory exploration is present, but shoppers are not progressing into unit clicks at the same rate as the leaders."
    return "Very light adoption so far; the main opportunity is getting users from filters/impressions into actual unit-level engagement."


def build_html(metrics: list[dict]) -> str:
    generated_at = datetime.now().strftime("%m/%d/%Y %I:%M %p")
    top_unit = max(metrics, key=lambda m: m["unit_click_rate"])
    top_conv = max(metrics, key=lambda m: m["conversion_from_clicks"])
    total_unit_clicks = sum(m["unit_clicks"] for m in metrics)
    total_conv_clicks = sum(m["conversion_clicks"] for m in metrics)
    total_filters = sum(m["filter_actions"] for m in metrics)
    total_impressions = sum(m["impressions"] for m in metrics)

    rows = ""
    for m in sorted(metrics, key=lambda item: item["unit_click_rate"], reverse=True):
        rows += f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-size: 14px; color: #1a1a1a; font-weight: 600;">{m['property_name']}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['sessions_30']:,}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['filter_actions']:,}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['unit_clicks']:,}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['conversion_clicks']:,}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: 600;">{m['unit_click_rate']:.1f}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['conversion_rate']:.1f}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['unit_click_share']:.1f}%</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; text-align: right;">{m['conversion_from_clicks']:.1f}%</td>
        </tr>
        """

    cards = ""
    for m in metrics:
        cards += f"""
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 18px 0; border: 1px solid #e9ecef; border-radius: 8px;">
            <tr>
                <td style="padding: 16px 18px;">
                    <div style="font-size: 18px; font-weight: 700; color: #15284B; margin-bottom: 8px;">{m['property_name']}</div>
                    <div style="font-size: 13px; color: #6c757d; margin-bottom: 12px;">SightMap active {m['active_days']} days since {m['first_sightmap_date']}</div>
                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                        <tr>
                            <td style="width: 25%; padding: 8px 6px; background: #f8f9fa; text-align: center;">
                                <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Unit Clicks</div>
                                <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">{m['unit_clicks']}</div>
                                <div style="font-size: 12px; color: #6c757d;">WoW {m['unit_click_change_label']}</div>
                            </td>
                            <td style="width: 25%; padding: 8px 6px; background: #f8f9fa; text-align: center;">
                                <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Conv Clicks</div>
                                <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">{m['conversion_clicks']}</div>
                                <div style="font-size: 12px; color: #6c757d;">WoW {m['conversion_change_label']}</div>
                            </td>
                            <td style="width: 25%; padding: 8px 6px; background: #f8f9fa; text-align: center;">
                                <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Clicks / 100 Sessions</div>
                                <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">{m['unit_click_rate']:.1f}</div>
                                <div style="font-size: 12px; color: #6c757d;">Last 30 days</div>
                            </td>
                            <td style="width: 25%; padding: 8px 6px; background: #f8f9fa; text-align: center;">
                                <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Click to Action</div>
                                <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">{m['conversion_from_clicks']:.1f}%</div>
                                <div style="font-size: 12px; color: #6c757d;">Conv / unit clicks</div>
                            </td>
                        </tr>
                    </table>
                    <div style="margin-top: 12px; padding: 12px; background: #F3F7FB; border-left: 4px solid #15284B; font-size: 13px; color: #334155;">{trend_note(m)}</div>
                </td>
            </tr>
        </table>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SightMap Pilot Roundup</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 20px; background: #f5f5f5;">
  <table cellpadding="0" cellspacing="0" border="0" style="max-width: 960px; width: 100%; margin: 0 auto; background: #ffffff; padding: 30px 36px 40px 36px; border-radius: 8px;">
    <tr><td>
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e9ecef; padding-bottom: 18px;">
        <tr><td>
          <h1 style="font-size: 14px; color: #0066cc; margin: 0 0 10px 0; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">Property Intelligence</h1>
          <div style="font-size: 30px; color: #495057; margin: 10px 0; font-weight: 700;">SightMap Pilot Roundup</div>
          <div style="font-size: 11px; color: #adb5bd; margin: 10px 0;">PIB-style pilot summary</div>
          <div style="font-size: 13px; color: #6c757d; margin: 5px 0;">Five pilot properties • 30-day window through 04/12/2026 • Generated {generated_at}</div>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 24px;">
        <tr>
          <td style="width: 25%; padding: 10px 8px; background: #f8f9fa; text-align: center;">
            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Filter Actions</div>
            <div style="font-size: 34px; font-weight: 700; color: #1a1a1a;">{total_filters:,}</div>
          </td>
          <td style="width: 25%; padding: 10px 8px; background: #f8f9fa; text-align: center;">
            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Impressions</div>
            <div style="font-size: 34px; font-weight: 700; color: #1a1a1a;">{total_impressions:,}</div>
          </td>
          <td style="width: 25%; padding: 10px 8px; background: #f8f9fa; text-align: center;">
            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Unit Clicks</div>
            <div style="font-size: 34px; font-weight: 700; color: #1a1a1a;">{total_unit_clicks:,}</div>
          </td>
          <td style="width: 25%; padding: 10px 8px; background: #f8f9fa; text-align: center;">
            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase;">Outbound / Apply Clicks</div>
            <div style="font-size: 34px; font-weight: 700; color: #1a1a1a;">{total_conv_clicks:,}</div>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 24px 0;">
        <tr>
          <td style="padding: 16px 18px; background: #F3F7FB; border-left: 4px solid #15284B;">
            <div style="font-size: 16px; font-weight: 700; color: #15284B; margin-bottom: 8px;">Executive Readout</div>
            <p style="font-size: 14px; color: #334155; margin: 0 0 8px 0;">SightMap instrumentation is live but still early. All five pilot properties first show SightMap activity on 03/25/2026, so this read is strong enough for directional comparison but not for deep historical trend judgments yet.</p>
            <p style="font-size: 14px; color: #334155; margin: 0;">The best browsing-depth property is <strong>{top_unit['property_name']}</strong> at <strong>{top_unit['unit_click_rate']:.1f}</strong> unit clicks per 100 sessions. The best downstream click-to-action property is <strong>{top_conv['property_name']}</strong> at <strong>{top_conv['conversion_from_clicks']:.1f}%</strong> of unit clicks turning into outbound/apply actions.</p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 24px;">
        <tr><td style="padding: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #15284B;">Pilot Ranking</td></tr>
        <tr><td>
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #495057; text-transform: uppercase;">Property</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Sessions</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Filters</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Unit Clicks</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Conv Clicks</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Clicks / 100</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Conv / 100</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Clicks / Impr.</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #495057; text-transform: uppercase;">Conv / Clicks</th>
            </tr>
            {rows}
          </table>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 14px;">
        <tr><td style="padding: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #15284B;">Property Notes</td></tr>
      </table>
      {cards}

      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 26px; border-top: 1px solid #e9ecef; padding-top: 16px;">
        <tr><td style="font-size: 12px; color: #6c757d;">
          Source: <code>ga4_event_facts</code> and <code>ga4_daily_metrics</code> in <code>portfolio_analytics.db</code>.<br>
          SightMap window coverage for all five pilots begins on 03/25/2026, so prior-period comparisons should be interpreted as launch-phase directional signals.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    metrics = [fetch_property_metrics(conn, name, pid) for name, pid in PILOT_PROPERTIES]
    conn.close()

    html = build_html(metrics)
    out_path = OUT_DIR / "2026-04-13__sightmap_pilot_roundup__pib_style.html"
    out_path.write_text(html)
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
