#!/usr/bin/env python3
"""Generate and send the Spotlight copy-change/baseline trend report."""

from __future__ import annotations

import argparse
import base64
import html
import json
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REPORT_ROOT = ROOT / "outputs" / "spotlight_copy_change_baseline_daily"

sys.path.insert(0, str(ROOT / "utils"))
sys.path.insert(0, str(ROOT / "Property_Intelligence_Brief"))
from email_sender import EmailSender  # noqa: E402
from templates.executive_template import get_logo_html  # noqa: E402


COLORS = {
    "navy": "#15284B",
    "san": "#3D66B9",
    "bay": "#294782",
    "pink": "#E02472",
    "smoke": "#F6F6F5",
    "terra": "#BD4830",
    "gray": "#D6D6D2",
    "chill": "#3B9189",
    "delta": "#9B9B96",
    "black": "#000000",
    "white": "#FFFFFF",
}

PROPERTIES = [
    {
        "name": "The Whitney",
        "short": "Whitney",
        "code": "GA4TW",
        "ga4": "378701831",
        "state": "Changed",
        "state_note": "Copy change 07/07/2026 PM; first full post day 07/08/2026",
    },
    {
        "name": "The Harrison",
        "short": "Harrison",
        "code": "GA4TH",
        "ga4": "378702475",
        "state": "Changed",
        "state_note": "Copy change 07/07/2026 PM; first full post day 07/08/2026",
    },
    {
        "name": "Cendana District West",
        "short": "Cendana",
        "code": "TX4CD",
        "ga4": "424416990",
        "state": "Baseline",
        "state_note": "Pending content; baseline anchored to 07/07/2026",
    },
    {
        "name": "The Retreat",
        "short": "The Retreat",
        "code": "TX4GM",
        "ga4": "378675172",
        "state": "Baseline",
        "state_note": "Pending content; baseline anchored to 07/07/2026",
    },
]

COPY_CHANGE_DATE = datetime.strptime("2026-07-07", "%Y-%m-%d").date()
POST_START_DATE = COPY_CHANGE_DATE + timedelta(days=1)
PRE_DAYS = 21
DEFAULT_RECIPIENTS = [
    "mlaufhutte@venterraliving.com",
    "AForesi@venterra.com",
    "ahopkins@venterraliving.com",
]


def fmt_date(value: object) -> str:
    return pd.to_datetime(value).strftime("%m/%d/%Y")


def fmt_num(value: object, digits: int = 1) -> str:
    if value is None or pd.isna(value):
        return "N/A"
    number = float(value)
    if digits == 0 or abs(number) >= 100:
        return f"{number:,.0f}"
    return f"{number:,.{digits}f}"


def pct_change(current: float, previous: float) -> Optional[float]:
    if previous == 0 or pd.isna(previous) or pd.isna(current):
        return None
    return ((current - previous) / previous) * 100.0


def pct_label(value: Optional[float]) -> str:
    if value is None or pd.isna(value):
        return "N/A"
    return f"{value:+.1f}%"


def delta_color(value: Optional[float]) -> str:
    if value is None or pd.isna(value):
        return COLORS["delta"]
    if value > 0:
        return COLORS["chill"]
    if value < 0:
        return COLORS["pink"]
    return COLORS["delta"]


def latest_dates(conn: sqlite3.Connection) -> tuple[str, str]:
    gsc_latest = conn.execute("SELECT MAX(metric_date) AS d FROM gsc_daily_metrics").fetchone()["d"]
    ga4_latest = conn.execute("SELECT MAX(metric_date) AS d FROM ga4_traffic_sources").fetchone()["d"]
    return str(gsc_latest), str(ga4_latest)


def fetch_property_daily(conn: sqlite3.Connection, ga4_property_id: str, start: str, gsc_end: str, ga4_end: str) -> pd.DataFrame:
    dates = pd.date_range(start, ga4_end, freq="D")
    daily = pd.DataFrame({"metric_date": dates})
    ga4 = pd.read_sql_query(
        """
        SELECT
            metric_date,
            SUM(sessions) AS sessions,
            SUM(engaged_sessions) AS engaged_sessions,
            SUM(conversions) AS key_events,
            SUM(new_users) AS new_users
        FROM ga4_traffic_sources
        WHERE property_id = ?
          AND channel_group = 'Organic Search'
          AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        conn,
        params=(ga4_property_id, start, ga4_end),
        parse_dates=["metric_date"],
    )
    gsc = pd.read_sql_query(
        """
        SELECT
            metric_date,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions
        FROM gsc_daily_metrics
        WHERE ga4_property_id = ?
          AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        conn,
        params=(ga4_property_id, start, gsc_end),
        parse_dates=["metric_date"],
    )
    daily = daily.merge(ga4, on="metric_date", how="left").merge(gsc, on="metric_date", how="left")
    for column in ["sessions", "engaged_sessions", "key_events", "new_users", "clicks", "impressions"]:
        daily[column] = daily[column].fillna(0)
    return daily


def fetch_portfolio_daily(conn: sqlite3.Connection, start: str, gsc_end: str, ga4_end: str) -> pd.DataFrame:
    dates = pd.date_range(start, ga4_end, freq="D")
    daily = pd.DataFrame({"metric_date": dates})
    ga4 = pd.read_sql_query(
        """
        SELECT
            metric_date,
            SUM(sessions) * 1.0 / COUNT(DISTINCT property_id) AS sessions,
            SUM(conversions) * 1.0 / COUNT(DISTINCT property_id) AS key_events,
            COUNT(DISTINCT property_id) AS property_count
        FROM ga4_traffic_sources
        WHERE channel_group = 'Organic Search'
          AND metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        conn,
        params=(start, ga4_end),
        parse_dates=["metric_date"],
    )
    gsc = pd.read_sql_query(
        """
        SELECT
            metric_date,
            SUM(clicks) * 1.0 / COUNT(DISTINCT ga4_property_id) AS clicks,
            SUM(impressions) * 1.0 / COUNT(DISTINCT ga4_property_id) AS impressions,
            COUNT(DISTINCT ga4_property_id) AS gsc_property_count
        FROM gsc_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
          AND ga4_property_id IS NOT NULL
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        conn,
        params=(start, gsc_end),
        parse_dates=["metric_date"],
    )
    daily = daily.merge(ga4, on="metric_date", how="left").merge(gsc, on="metric_date", how="left")
    for column in ["sessions", "key_events", "property_count", "clicks", "impressions", "gsc_property_count"]:
        daily[column] = daily[column].fillna(0)
    return daily


def mean_or_zero(values: pd.Series) -> float:
    if values.empty:
        return 0.0
    return float(values.mean())


def build_summary_row(prop: dict, daily: pd.DataFrame, gsc_end: str) -> dict:
    pre_mask = daily["metric_date"].dt.date < COPY_CHANGE_DATE
    post_mask = daily["metric_date"].dt.date >= POST_START_DATE
    gsc_mask = daily["metric_date"] <= pd.to_datetime(gsc_end)
    gsc_pre_mask = pre_mask & gsc_mask
    gsc_post_mask = post_mask & gsc_mask
    pre_sessions = mean_or_zero(daily.loc[pre_mask, "sessions"])
    post_sessions = mean_or_zero(daily.loc[post_mask, "sessions"])
    pre_clicks = mean_or_zero(daily.loc[gsc_pre_mask, "clicks"])
    post_clicks = mean_or_zero(daily.loc[gsc_post_mask, "clicks"])
    return {
        **prop,
        "pre_start": fmt_date(daily["metric_date"].min()),
        "pre_end": fmt_date(COPY_CHANGE_DATE - timedelta(days=1)),
        "post_start": fmt_date(POST_START_DATE),
        "ga4_post_end": fmt_date(daily["metric_date"].max()),
        "gsc_post_end": fmt_date(gsc_end),
        "ga4_pre_days": int(pre_mask.sum()),
        "ga4_post_days": int(post_mask.sum()),
        "gsc_pre_days": int(gsc_pre_mask.sum()),
        "gsc_post_days": int(gsc_post_mask.sum()),
        "ga4_pre_avg_sessions": pre_sessions,
        "ga4_post_avg_sessions": post_sessions,
        "ga4_session_change_pct": pct_change(post_sessions, pre_sessions),
        "ga4_pre_key_events": float(daily.loc[pre_mask, "key_events"].sum()),
        "ga4_post_key_events": float(daily.loc[post_mask, "key_events"].sum()),
        "gsc_pre_avg_clicks": pre_clicks,
        "gsc_post_avg_clicks": post_clicks,
        "gsc_click_change_pct": pct_change(post_clicks, pre_clicks),
        "gsc_pre_impressions": float(daily.loc[gsc_pre_mask, "impressions"].sum()),
        "gsc_post_impressions": float(daily.loc[gsc_post_mask, "impressions"].sum()),
    }


def normalized_line(daily: pd.DataFrame, metric: str) -> pd.Series:
    pre_avg = daily.loc[daily["metric_date"].dt.date < COPY_CHANGE_DATE, metric].mean()
    if pd.isna(pre_avg) or pre_avg == 0:
        pre_avg = 1.0
    return daily[metric].rolling(7, min_periods=1).mean() / pre_avg * 100.0


def build_bar_chart(summary: list[dict], output_path: Path) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(12, 7.8), dpi=160)
    for ax, item in zip(axes.flatten(), summary):
        labels = ["GA4\nSessions/day", "GSC\nClicks/day"]
        pre = [item["ga4_pre_avg_sessions"], item["gsc_pre_avg_clicks"]]
        post = [item["ga4_post_avg_sessions"], item["gsc_post_avg_clicks"]]
        deltas = [item["ga4_session_change_pct"], item["gsc_click_change_pct"]]
        x = np.arange(len(labels))
        width = 0.34
        ax.bar(x - width / 2, pre, width, color=COLORS["gray"], label="Pre")
        ax.bar(x + width / 2, post, width, color=[delta_color(value) for value in deltas], label="Post")
        for i, (pre_value, post_value, delta_value) in enumerate(zip(pre, post, deltas)):
            ymax = max(pre_value, post_value, 1)
            ax.text(i + width / 2, max(pre_value, post_value) + ymax * 0.08, pct_label(delta_value), ha="center", va="bottom", fontsize=9, fontweight="bold", color=delta_color(delta_value))
        ax.set_title(f"{item['short']} - {item['state']}", loc="left", fontsize=11, fontweight="bold", color=COLORS["navy"])
        ax.set_xticks(x, labels)
        ax.grid(axis="y", color=COLORS["gray"], alpha=0.45, linewidth=0.6)
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(colors=COLORS["bay"], labelsize=8)
        ax.set_ylim(0, max(max(pre), max(post), 1) * 1.35)
    axes[0, 0].legend(loc="upper right", frameon=False, fontsize=8)
    fig.subplots_adjust(top=0.82, hspace=0.36, wspace=0.18)
    fig.text(0.02, 0.965, "Spotlight Pre/Post Change Read", fontsize=14.5, fontweight="bold", color=COLORS["navy"], ha="left")
    fig.text(0.02, 0.936, "Pre-launch window compares to the post-change/baseline window using average per day.", fontsize=9, color=COLORS["bay"], ha="left")
    fig.text(0.02, 0.912, "Whitney/Harrison are changed; Cendana/The Retreat are baseline-only pending content.", fontsize=8.5, color=COLORS["delta"], ha="left")
    fig.savefig(output_path, facecolor="white", bbox_inches="tight")
    plt.close(fig)


def build_line_chart(frames: list[pd.DataFrame], portfolio_daily: pd.DataFrame, output_path: Path, gsc_end: str) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(12, 7.8), dpi=160)
    portfolio = portfolio_daily.copy()
    portfolio["session_index"] = normalized_line(portfolio, "sessions")
    gsc_end_date = pd.to_datetime(gsc_end)
    for ax, daily in zip(axes.flatten(), frames):
        item = daily.iloc[0]
        property_daily = daily.copy()
        property_daily["session_index"] = normalized_line(property_daily, "sessions")
        gsc_daily = property_daily.loc[property_daily["metric_date"] <= gsc_end_date].copy()
        gsc_daily["click_index"] = normalized_line(gsc_daily, "clicks")
        marker_label = "Copy change 07/07/2026" if item["state"] == "Changed" else "Baseline anchor 07/07/2026"
        ax.plot(property_daily["metric_date"], property_daily["session_index"], color=COLORS["san"], linewidth=2.2, label=f"{item['short']} GA4 sessions")
        ax.plot(gsc_daily["metric_date"], gsc_daily["click_index"], color=COLORS["chill"], linewidth=2.0, label=f"{item['short']} GSC clicks")
        ax.plot(portfolio["metric_date"], portfolio["session_index"], color=COLORS["delta"], linewidth=2.0, linestyle="--", label="Portfolio GA4 avg")
        ax.axhline(100, color=COLORS["gray"], linewidth=0.8, linestyle=":")
        ax.axvline(pd.to_datetime(COPY_CHANGE_DATE), color=COLORS["pink"] if item["state"] == "Changed" else COLORS["terra"], linewidth=1.4)
        ax.text(pd.to_datetime(COPY_CHANGE_DATE) + pd.Timedelta(hours=8), ax.get_ylim()[1] * 0.97, marker_label, color=COLORS["pink"] if item["state"] == "Changed" else COLORS["terra"], fontsize=7.2, rotation=90, va="top", ha="left")
        ax.set_title(f"{item['short']} - {item['state']}", loc="left", fontsize=11, fontweight="bold", color=COLORS["navy"])
        ax.xaxis.set_major_locator(mdates.DayLocator(interval=5))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%d"))
        ax.grid(axis="y", color=COLORS["gray"], alpha=0.45, linewidth=0.6)
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(colors=COLORS["bay"], labelsize=8)
    axes[0, 1].legend(loc="upper right", frameon=False, fontsize=7.5)
    fig.subplots_adjust(top=0.82, hspace=0.36, wspace=0.18)
    fig.text(0.02, 0.965, "GA4 Organic Sessions and GSC Clicks Trend", fontsize=14.5, fontweight="bold", color=COLORS["navy"], ha="left")
    fig.text(0.02, 0.936, "7-day rolling index; each line is normalized to its own pre-launch average = 100.", fontsize=9, color=COLORS["bay"], ha="left")
    fig.text(0.02, 0.912, "GSC click lines stop at the latest available GSC day; dashed line is portfolio GA4 average.", fontsize=8.5, color=COLORS["bay"], ha="left")
    fig.savefig(output_path, facecolor="white", bbox_inches="tight")
    plt.close(fig)


def image_data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def table_row(item: dict, is_portfolio: bool = False) -> str:
    state_color = COLORS["bay"] if is_portfolio else COLORS["pink"] if item["state"] == "Changed" else COLORS["terra"]
    ga4_color = delta_color(item["ga4_session_change_pct"])
    gsc_color = delta_color(item["gsc_click_change_pct"])
    state_note = item.get("state_note") or "Average per property across the portfolio"
    return f"""
<tr bgcolor="{COLORS['white']}" style="background-color:{COLORS['white']};">
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};font-weight:700;color:{COLORS['navy']};vertical-align:top;background-color:{COLORS['white']};">{html.escape(item['short'])}</td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};vertical-align:top;color:{state_color};font-weight:700;background-color:{COLORS['white']};">{html.escape(item['state'])}<br><span style="color:{COLORS['bay']};font-size:11px;font-weight:400;">{html.escape(state_note)}</span></td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};text-align:right;vertical-align:top;color:{COLORS['black']};background-color:{COLORS['white']};font-weight:700;">{fmt_num(item['ga4_pre_avg_sessions'])}<br><span style="color:{COLORS['bay']};font-size:11px;font-weight:400;">pre avg/day</span></td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};text-align:right;vertical-align:top;color:{COLORS['black']};background-color:{COLORS['white']};font-weight:700;">{fmt_num(item['ga4_post_avg_sessions'])}<br><span style="color:{COLORS['bay']};font-size:11px;font-weight:400;">post avg/day</span></td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};text-align:right;vertical-align:top;color:{ga4_color};font-weight:700;background-color:{COLORS['white']};">{pct_label(item['ga4_session_change_pct'])}</td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};text-align:right;vertical-align:top;color:{COLORS['black']};background-color:{COLORS['white']};font-weight:700;">{fmt_num(item['gsc_pre_avg_clicks'])}<br><span style="color:{COLORS['bay']};font-size:11px;font-weight:400;">pre avg/day</span></td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};text-align:right;vertical-align:top;color:{COLORS['black']};background-color:{COLORS['white']};font-weight:700;">{fmt_num(item['gsc_post_avg_clicks'])}<br><span style="color:{COLORS['bay']};font-size:11px;font-weight:400;">post avg/day</span></td>
  <td bgcolor="{COLORS['white']}" style="padding:9px 8px;border-bottom:1px solid {COLORS['gray']};text-align:right;vertical-align:top;color:{gsc_color};font-weight:700;background-color:{COLORS['white']};">{pct_label(item['gsc_click_change_pct'])}</td>
</tr>"""


def build_html(summary: list[dict], portfolio_summary: dict, bar_chart: Path, line_chart: Path, gsc_latest: str, ga4_latest: str) -> str:
    generated = datetime.now().strftime("%m/%d/%Y %-I:%M %p")
    pre_window = f"{summary[0]['pre_start']} to {summary[0]['pre_end']}"
    post_window = f"{summary[0]['post_start']} to {summary[0]['ga4_post_end']}"
    logo = get_logo_html() or ""
    return f"""<!DOCTYPE html>
<html><body bgcolor="{COLORS['white']}" style="margin:0;padding:0;background-color:{COLORS['white']};font-family:Arial,sans-serif;color:{COLORS['black']};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="{COLORS['white']}" style="background-color:{COLORS['white']};"><tr><td align="center" bgcolor="{COLORS['white']}" style="padding:18px;background-color:{COLORS['white']};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" bgcolor="{COLORS['white']}" style="width:700px;max-width:700px;background-color:{COLORS['white']};">
<tr><td bgcolor="{COLORS['white']}" style="padding:24px 22px 18px 22px;background-color:{COLORS['white']};">
{logo}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:18px;">
  <tr><td align="center" style="text-align:center;">
    <div style="font-size:14px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:{COLORS['navy']};">Property Intelligence</div>
    <h1 style="margin:8px 0 6px 0;font-size:30px;line-height:1.2;font-weight:700;color:{COLORS['navy']};">Spotlight Copy Change and Baseline Trends</h1>
    <div style="font-size:14px;line-height:1.5;color:{COLORS['navy']};">Whitney and Harrison have live copy-change history from the 07/07/2026 afternoon change. Cendana and The Retreat remain baseline-only until content is supplied.</div>
  </td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="{COLORS['white']}" style="margin-top:16px;border-collapse:collapse;font-size:11px;line-height:1.35;background-color:{COLORS['white']};">
<tr bgcolor="{COLORS['navy']}" style="background-color:{COLORS['navy']};color:{COLORS['white']};"><th align="left" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">Property</th><th align="left" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">State</th><th align="right" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">GA4 Pre</th><th align="right" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">GA4 Post</th><th align="right" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">GA4 Change</th><th align="right" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">GSC Pre</th><th align="right" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">GSC Post</th><th align="right" bgcolor="{COLORS['navy']}" style="padding:8px;color:{COLORS['white']};background-color:{COLORS['navy']};">GSC Change</th></tr>
{table_row(portfolio_summary, is_portfolio=True)}
{''.join(table_row(item) for item in summary)}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="{COLORS['white']}" style="margin-top:16px;border:1px solid {COLORS['gray']};background-color:{COLORS['white']};"><tr><td bgcolor="{COLORS['white']}" style="padding:14px 16px;background-color:{COLORS['white']};">
<div style="font-size:18px;font-weight:700;color:{COLORS['navy']};line-height:1.2;">Pre vs Post Average Per Day</div>
<div style="font-size:12px;color:{COLORS['navy']};margin-top:4px;line-height:1.45;">Bars show pre-launch average/day against post-change or baseline average/day.</div>
<div style="margin-top:10px;"><img src="{image_data_uri(bar_chart)}" width="640" style="display:block;width:100%;max-width:640px;border:0;outline:none;text-decoration:none;" alt="Spotlight pre versus post bar chart"></div>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="{COLORS['white']}" style="margin-top:16px;border:1px solid {COLORS['gray']};background-color:{COLORS['white']};"><tr><td bgcolor="{COLORS['white']}" style="padding:14px 16px;background-color:{COLORS['white']};">
<div style="font-size:18px;font-weight:700;color:{COLORS['navy']};line-height:1.2;">GA4 Organic Sessions and GSC Clicks vs Portfolio Average</div>
<div style="font-size:12px;color:{COLORS['navy']};margin-top:4px;line-height:1.45;">Lines are indexed to each property's pre-launch average. GSC click lines stop at the latest available GSC day; dashed line is the portfolio GA4 average.</div>
<div style="margin-top:10px;"><img src="{image_data_uri(line_chart)}" width="640" style="display:block;width:100%;max-width:640px;border:0;outline:none;text-decoration:none;" alt="GA4 Organic Search and GSC click line chart with portfolio average"></div>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="{COLORS['white']}" style="margin-top:16px;border-top:1px solid {COLORS['gray']};background-color:{COLORS['white']};"><tr><td bgcolor="{COLORS['white']}" style="padding:10px 0 0 0;background-color:{COLORS['white']};font-size:11px;line-height:1.45;color:{COLORS['bay']};">
<strong style="color:{COLORS['navy']};">Report context:</strong> Generated {generated}. Measurement windows: pre {pre_window}; post/baseline {post_window}. Source freshness: GA4 through {fmt_date(ga4_latest)}; GSC through {fmt_date(gsc_latest)}. Sources: GA4 Organic Search and GSC daily metrics.
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>"""


def build_plain_text(summary: list[dict], portfolio_summary: dict, gsc_latest: str, ga4_latest: str) -> str:
    lines = [
        "Spotlight Copy Change and Baseline Trends",
        f"GA4 through {fmt_date(ga4_latest)}; GSC through {fmt_date(gsc_latest)}.",
        f"Portfolio GA4 average/day: {fmt_num(portfolio_summary['ga4_pre_avg_sessions'])} pre to {fmt_num(portfolio_summary['ga4_post_avg_sessions'])} post ({pct_label(portfolio_summary['ga4_session_change_pct'])}).",
        "",
    ]
    for item in summary:
        lines.append(
            f"- {item['short']} ({item['state']}): "
            f"GA4 sessions/day {fmt_num(item['ga4_pre_avg_sessions'])} to {fmt_num(item['ga4_post_avg_sessions'])} ({pct_label(item['ga4_session_change_pct'])}); "
            f"GSC clicks/day {fmt_num(item['gsc_pre_avg_clicks'])} to {fmt_num(item['gsc_post_avg_clicks'])} ({pct_label(item['gsc_click_change_pct'])})."
        )
    return "\n".join(lines)


def generate_report() -> tuple[Path, Path, Path, Path, Path, list[dict], dict, str, str]:
    output_dir = REPORT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        gsc_latest, ga4_latest = latest_dates(conn)
        pre_start = (COPY_CHANGE_DATE - timedelta(days=PRE_DAYS)).isoformat()
        summary: list[dict] = []
        daily_frames: list[pd.DataFrame] = []
        for prop in PROPERTIES:
            daily = fetch_property_daily(conn, prop["ga4"], pre_start, gsc_latest, ga4_latest)
            daily["property"] = prop["name"]
            daily["short"] = prop["short"]
            daily["state"] = prop["state"]
            daily["date_label"] = daily["metric_date"].dt.strftime("%m/%d/%Y")
            daily_frames.append(daily)
            summary.append(build_summary_row(prop, daily, gsc_latest))

        portfolio_daily = fetch_portfolio_daily(conn, pre_start, gsc_latest, ga4_latest)
        portfolio_daily["property"] = "Portfolio Average"
        portfolio_daily["short"] = "Portfolio Avg"
        portfolio_daily["state"] = "Portfolio"
        portfolio_summary = build_summary_row(
            {
                "name": "Portfolio Average",
                "short": "Portfolio Avg",
                "code": "PORTFOLIO",
                "ga4": "",
                "state": "Portfolio",
                "state_note": "Average per property across the broader portfolio",
            },
            portfolio_daily,
            gsc_latest,
        )
    finally:
        conn.close()

    bar_chart = output_dir / "spotlight_pre_post_bar_chart.png"
    line_chart = output_dir / "spotlight_ga4_sessions_portfolio_line_chart.png"
    build_bar_chart(summary, bar_chart)
    build_line_chart(daily_frames, portfolio_daily, line_chart, gsc_latest)

    summary_path = output_dir / "spotlight_copy_change_baseline_summary.csv"
    daily_path = output_dir / "spotlight_copy_change_baseline_daily.csv"
    portfolio_path = output_dir / "spotlight_portfolio_average_daily.csv"
    html_path = output_dir / "spotlight_copy_change_baseline_email.html"
    pd.DataFrame([portfolio_summary, *summary]).to_csv(summary_path, index=False)
    pd.concat(daily_frames, ignore_index=True).to_csv(daily_path, index=False)
    portfolio_daily.to_csv(portfolio_path, index=False)
    html_path.write_text(build_html(summary, portfolio_summary, bar_chart, line_chart, gsc_latest, ga4_latest), encoding="utf-8")
    (output_dir / "summary.json").write_text(json.dumps({"portfolio": portfolio_summary, "properties": summary}, indent=2), encoding="utf-8")
    return html_path, bar_chart, line_chart, summary_path, daily_path, portfolio_path, summary, portfolio_summary, gsc_latest, ga4_latest


def parse_recipients(value: str | None) -> list[str]:
    if not value:
        return DEFAULT_RECIPIENTS
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Send the Spotlight copy-change/baseline trend report.")
    parser.add_argument("--recipients", help="Comma-separated recipients. Defaults to the approved daily distribution list.")
    parser.add_argument("--no-send", action="store_true", help="Generate artifacts without sending email.")
    args = parser.parse_args()

    (
        html_path,
        bar_chart,
        line_chart,
        summary_path,
        daily_path,
        portfolio_path,
        summary,
        portfolio_summary,
        gsc_latest,
        ga4_latest,
    ) = generate_report()

    if not args.no_send:
        recipients = parse_recipients(args.recipients)
        sender = EmailSender(verbose=False)
        metadata = sender.send_email_with_tracking(
            subject=f"Spotlight Copy Change and Baseline Trends - {datetime.now().strftime('%m/%d/%Y')}",
            html_body=html_path.read_text(encoding="utf-8"),
            plain_text=build_plain_text(summary, portfolio_summary, gsc_latest, ga4_latest),
            recipients=recipients,
            attachments=[
                (bar_chart.name, bar_chart.read_bytes(), "image/png"),
                (line_chart.name, line_chart.read_bytes(), "image/png"),
                (summary_path.name, summary_path.read_bytes(), "text/csv"),
                (daily_path.name, daily_path.read_bytes(), "text/csv"),
                (portfolio_path.name, portfolio_path.read_bytes(), "text/csv"),
            ],
            log_path=html_path.parent / "delivery_log.jsonl",
        )
        (html_path.parent / "delivery_latest.json").write_text(
            json.dumps({key: value for key, value in metadata.items() if key != "smtp_server"}, indent=2),
            encoding="utf-8",
        )
        print(f"Sent: {', '.join(recipients)}")
    print(f"HTML: {html_path}")
    print(f"Bar chart: {bar_chart}")
    print(f"Line chart: {line_chart}")
    print(f"Summary: {summary_path}")
    print(f"Daily: {daily_path}")
    print(f"Portfolio daily: {portfolio_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
