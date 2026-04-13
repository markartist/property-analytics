#!/usr/bin/env python3
"""
Generate PIB-style GSC Month-over-Month SEO performance report for two months.

Outputs:
- HTML report with trend lines and portfolio/property MoM summaries
- CSV with per-property MoM metrics
"""

from __future__ import annotations

import argparse
import calendar
import csv
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUT_DIR = ROOT / "reports" / "gsc_mom"
OUT_DIR.mkdir(parents=True, exist_ok=True)

import sys
sys.path.insert(0, str(ROOT / "Property_Intelligence_Brief"))
from templates.executive_template import VENTERRA_BLUE, get_logo_html  # type: ignore  # noqa: E402


@dataclass
class MonthAgg:
    month: str
    clicks: int
    impressions: int
    ctr_pct: float
    property_count: int
    active_days: int


def month_bounds(month: str) -> Tuple[str, str]:
    y, m = [int(x) for x in month.split("-")]
    last = calendar.monthrange(y, m)[1]
    return f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{last:02d}"


def pct_delta(curr: float, prev: float) -> float | None:
    if prev == 0:
        return None
    return ((curr - prev) / prev) * 100.0


def fmt_delta(n: float | None, suffix: str = "%") -> str:
    if n is None:
        return "n/a"
    sign = "+" if n > 0 else ""
    return f"{sign}{n:.1f}{suffix}"


def query_month_agg(conn: sqlite3.Connection, month: str) -> MonthAgg:
    start, end = month_bounds(month)
    row = conn.execute(
        """
        SELECT
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          COUNT(DISTINCT COALESCE(NULLIF(ga4_property_id,''), property_id)) AS props,
          COUNT(DISTINCT metric_date) AS days
        FROM gsc_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
        """,
        (start, end),
    ).fetchone()
    clicks = int(row["clicks"] or 0)
    impressions = int(row["impressions"] or 0)
    ctr = (100.0 * clicks / impressions) if impressions else 0.0
    return MonthAgg(month, clicks, impressions, ctr, int(row["props"] or 0), int(row["days"] or 0))


def query_daily(conn: sqlite3.Connection, month: str) -> Dict[int, Dict[str, float]]:
    start, end = month_bounds(month)
    rows = conn.execute(
        """
        SELECT
          CAST(strftime('%d', metric_date) AS INTEGER) AS day,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions
        FROM gsc_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
        GROUP BY metric_date
        ORDER BY metric_date
        """,
        (start, end),
    ).fetchall()

    out: Dict[int, Dict[str, float]] = {}
    for r in rows:
        clicks = float(r["clicks"] or 0)
        impr = float(r["impressions"] or 0)
        out[int(r["day"])] = {
            "clicks": clicks,
            "impressions": impr,
            "ctr": (100.0 * clicks / impr) if impr else 0.0,
        }
    return out


def query_property_mom(conn: sqlite3.Connection, month_curr: str, month_prev: str) -> List[Dict[str, object]]:
    cur_start, cur_end = month_bounds(month_curr)
    prev_start, prev_end = month_bounds(month_prev)
    rows = conn.execute(
        """
        WITH prev AS (
          SELECT
            COALESCE(NULLIF(ga4_property_id,''), property_id) AS pid,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions
          FROM gsc_daily_metrics
          WHERE metric_date BETWEEN ? AND ?
          GROUP BY 1
        ),
        cur AS (
          SELECT
            COALESCE(NULLIF(ga4_property_id,''), property_id) AS pid,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions
          FROM gsc_daily_metrics
          WHERE metric_date BETWEEN ? AND ?
          GROUP BY 1
        ),
        ids AS (
          SELECT pid FROM prev
          UNION
          SELECT pid FROM cur
        )
        SELECT
          ids.pid,
          COALESCE(pm.property_name, ids.pid) AS property_name,
          COALESCE(cur.clicks, 0) AS cur_clicks,
          COALESCE(prev.clicks, 0) AS prev_clicks,
          COALESCE(cur.impressions, 0) AS cur_impressions,
          COALESCE(prev.impressions, 0) AS prev_impressions
        FROM ids
        LEFT JOIN prev ON prev.pid = ids.pid
        LEFT JOIN cur ON cur.pid = ids.pid
        LEFT JOIN property_metadata pm ON pm.property_id = ids.pid
        ORDER BY cur_clicks DESC
        """,
        (prev_start, prev_end, cur_start, cur_end),
    ).fetchall()

    out: List[Dict[str, object]] = []
    for r in rows:
        cur_clicks = int(r["cur_clicks"] or 0)
        prev_clicks = int(r["prev_clicks"] or 0)
        cur_impr = int(r["cur_impressions"] or 0)
        prev_impr = int(r["prev_impressions"] or 0)
        cur_ctr = (100.0 * cur_clicks / cur_impr) if cur_impr else 0.0
        prev_ctr = (100.0 * prev_clicks / prev_impr) if prev_impr else 0.0
        out.append(
            {
                "property_id": r["pid"],
                "property_name": r["property_name"],
                "current_clicks": cur_clicks,
                "previous_clicks": prev_clicks,
                "delta_clicks": cur_clicks - prev_clicks,
                "delta_clicks_pct": pct_delta(float(cur_clicks), float(prev_clicks)),
                "current_impressions": cur_impr,
                "previous_impressions": prev_impr,
                "delta_impressions": cur_impr - prev_impr,
                "delta_impressions_pct": pct_delta(float(cur_impr), float(prev_impr)),
                "current_ctr": round(cur_ctr, 2),
                "previous_ctr": round(prev_ctr, 2),
                "delta_ctr": round(cur_ctr - prev_ctr, 2),
            }
        )
    return out


def _svg_path(points: List[float | None], width: int, height: int, pad: int = 28) -> str:
    valid = [p for p in points if p is not None]
    if not valid:
        return ""
    min_v = min(valid)
    max_v = max(valid)
    span = max(max_v - min_v, 1e-9)
    step = (width - 2 * pad) / max(len(points) - 1, 1)

    coords = []
    for i, v in enumerate(points):
        if v is None:
            continue
        x = pad + i * step
        y = height - pad - ((v - min_v) / span) * (height - 2 * pad)
        coords.append(f"{x:.1f},{y:.1f}")
    return " ".join(coords)


def make_trend_svg(title: str, prev_vals: List[float | None], cur_vals: List[float | None], prev_label: str, cur_label: str) -> str:
    width, height = 900, 230
    all_vals = [v for v in (prev_vals + cur_vals) if v is not None]
    min_v = min(all_vals) if all_vals else 0
    max_v = max(all_vals) if all_vals else 1
    p1 = _svg_path(prev_vals, width, height)
    p2 = _svg_path(cur_vals, width, height)

    return f"""
    <div style=\"margin-top:18px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#ffffff;\">
      <div style=\"font-size:14px;font-weight:700;color:#1f2937;margin-bottom:6px;\">{title}</div>
      <svg width=\"100%\" viewBox=\"0 0 {width} {height}\" role=\"img\" aria-label=\"{title} trend\">
        <rect x=\"0\" y=\"0\" width=\"{width}\" height=\"{height}\" fill=\"#ffffff\" />
        <line x1=\"28\" y1=\"28\" x2=\"28\" y2=\"202\" stroke=\"#d1d5db\" stroke-width=\"1\" />
        <line x1=\"28\" y1=\"202\" x2=\"872\" y2=\"202\" stroke=\"#d1d5db\" stroke-width=\"1\" />
        <polyline points=\"{p1}\" fill=\"none\" stroke=\"#60a5fa\" stroke-width=\"3\" />
        <polyline points=\"{p2}\" fill=\"none\" stroke=\"#10b981\" stroke-width=\"3\" />
        <text x=\"36\" y=\"24\" fill=\"#6b7280\" font-size=\"11\">max {max_v:.2f}</text>
        <text x=\"36\" y=\"218\" fill=\"#6b7280\" font-size=\"11\">min {min_v:.2f}</text>
        <text x=\"700\" y=\"20\" fill=\"#60a5fa\" font-size=\"12\">{prev_label}</text>
        <text x=\"790\" y=\"20\" fill=\"#10b981\" font-size=\"12\">{cur_label}</text>
      </svg>
      <div style=\"font-size:11px;color:#6b7280;\">X-axis: Day of month (1-{max(len(prev_vals), len(cur_vals))}).</div>
    </div>
    """


def make_kpi_sparkline(prev_vals: List[float | None], cur_vals: List[float | None], prev_label: str, cur_label: str) -> str:
    width, height, pad = 320, 84, 8
    all_vals = [v for v in (prev_vals + cur_vals) if v is not None]
    if not all_vals:
        return ""

    min_v = min(all_vals)
    max_v = max(all_vals)
    span = max(max_v - min_v, 1e-9)

    def path(vals: List[float | None]) -> str:
        step = (width - 2 * pad) / max(len(vals) - 1, 1)
        pts: List[str] = []
        for i, v in enumerate(vals):
            if v is None:
                continue
            x = pad + i * step
            y = height - pad - ((v - min_v) / span) * (height - 2 * pad)
            pts.append(f"{x:.1f},{y:.1f}")
        return " ".join(pts)

    p_prev = path(prev_vals)
    p_cur = path(cur_vals)
    return f"""
      <div style="margin-top:8px;">
        <svg width="100%" viewBox="0 0 {width} {height}" role="img" aria-label="KPI sparkline">
          <line x1="{pad}" y1="{height-pad}" x2="{width-pad}" y2="{height-pad}" stroke="#d1d5db" stroke-width="1" />
          <polyline points="{p_prev}" fill="none" stroke="#60a5fa" stroke-width="2.2" />
          <polyline points="{p_cur}" fill="none" stroke="#10b981" stroke-width="2.2" />
        </svg>
        <div style="font-size:10px;color:#6b7280;">
          <span style="color:#60a5fa;font-weight:600;">{prev_label}</span> vs
          <span style="color:#10b981;font-weight:600;">{cur_label}</span>
        </div>
      </div>
    """


def build_html(month_prev: MonthAgg, month_cur: MonthAgg, daily_prev: Dict[int, Dict[str, float]], daily_cur: Dict[int, Dict[str, float]], props: List[Dict[str, object]]) -> str:
    logo = get_logo_html() or ""
    ts = datetime.now().strftime("%B %d, %Y %I:%M %p")

    delta_clicks_pct = pct_delta(float(month_cur.clicks), float(month_prev.clicks))
    delta_impr_pct = pct_delta(float(month_cur.impressions), float(month_prev.impressions))
    delta_ctr = month_cur.ctr_pct - month_prev.ctr_pct

    prev_month_label = datetime.strptime(month_prev.month, "%Y-%m").strftime("%b %Y")
    cur_month_label = datetime.strptime(month_cur.month, "%Y-%m").strftime("%b %Y")

    max_days = max(
        calendar.monthrange(int(month_prev.month[:4]), int(month_prev.month[5:7]))[1],
        calendar.monthrange(int(month_cur.month[:4]), int(month_cur.month[5:7]))[1],
    )
    prev_days = calendar.monthrange(int(month_prev.month[:4]), int(month_prev.month[5:7]))[1]
    cur_days = calendar.monthrange(int(month_cur.month[:4]), int(month_cur.month[5:7]))[1]

    prev_click_series = [daily_prev.get(d, {}).get("clicks", None) if d <= prev_days else None for d in range(1, max_days + 1)]
    cur_click_series = [daily_cur.get(d, {}).get("clicks", None) if d <= cur_days else None for d in range(1, max_days + 1)]
    prev_impr_series = [daily_prev.get(d, {}).get("impressions", None) if d <= prev_days else None for d in range(1, max_days + 1)]
    cur_impr_series = [daily_cur.get(d, {}).get("impressions", None) if d <= cur_days else None for d in range(1, max_days + 1)]
    prev_ctr_series = [daily_prev.get(d, {}).get("ctr", None) if d <= prev_days else None for d in range(1, max_days + 1)]
    cur_ctr_series = [daily_cur.get(d, {}).get("ctr", None) if d <= cur_days else None for d in range(1, max_days + 1)]

    ranked = sorted(props, key=lambda x: int(x["current_clicks"]), reverse=True)

    click_kpi_spark = make_kpi_sparkline(prev_click_series, cur_click_series, prev_month_label, cur_month_label)
    impr_kpi_spark = make_kpi_sparkline(prev_impr_series, cur_impr_series, prev_month_label, cur_month_label)
    ctr_kpi_spark = make_kpi_sparkline(prev_ctr_series, cur_ctr_series, prev_month_label, cur_month_label)

    def grade(ctr: float) -> str:
        if ctr > 5:
            return "excellent"
        if ctr >= 3:
            return "good"
        return "needs_improvement"

    cur_grades = {"excellent": 0, "good": 0, "needs_improvement": 0}
    prev_grades = {"excellent": 0, "good": 0, "needs_improvement": 0}
    for r in ranked:
        cur_grades[grade(float(r["current_ctr"]))] += 1
        prev_grades[grade(float(r["previous_ctr"]))] += 1

    def grade_color(ctr: float) -> str:
        if ctr > 5:
            return "#16a34a"
        if ctr >= 3:
            return "#d97706"
        return "#dc2626"

    def row_html(r: Dict[str, object], rank: int) -> str:
        dc = int(r["delta_clicks"])
        dc_pct = r["delta_clicks_pct"]
        di = int(r["delta_impressions"])
        dctr = float(r["delta_ctr"])
        zebra = "#ffffff" if rank % 2 == 1 else "#f8fafc"
        dc_color = "#16a34a" if dc > 0 else "#dc2626" if dc < 0 else "#64748b"
        di_color = "#16a34a" if di > 0 else "#dc2626" if di < 0 else "#64748b"
        dctr_color = "#16a34a" if dctr > 0 else "#dc2626" if dctr < 0 else "#64748b"
        ctr = float(r["current_ctr"])
        ctr_color = grade_color(ctr)
        return (
            f"<tr style='background:{zebra};'>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;color:#94a3b8;font-weight:700;'>#{rank}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;'>{r['property_name']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b;'>{int(r['previous_clicks']):,}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0ea5e9;font-weight:700;'>{int(r['current_clicks']):,}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:{dc_color};font-weight:700;'>{dc:+,}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:{dc_color};font-weight:700;'>{fmt_delta(dc_pct)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b;'>{float(r['previous_ctr']):.2f}%</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:{ctr_color};font-weight:700;'>{float(r['current_ctr']):.2f}%</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:{dctr_color};font-weight:700;'>{dctr:+.2f} pts</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b;'>{int(r['previous_impressions']):,}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;'>{int(r['current_impressions']):,}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:{di_color};font-weight:700;'>{di:+,}</td>"
            "</tr>"
        )

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:linear-gradient(180deg,#eef2f7 0%,#f8fafc 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1380px;margin:0 auto;">
<tr><td style="padding:16px;">
<div style="background:#ffffff;border:1px solid #dbe4ef;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,0.06);padding:16px;">
{logo}
<div style="text-align:center;margin-bottom:10px;">
  <div style="color:#0f172a;font-size:22px;font-weight:800;letter-spacing:0.2px;">Portfolio Google Search Console Snapshot</div>
  <div style="color:#64748b;font-size:12px;margin-top:2px;">{prev_month_label} vs {cur_month_label} | Generated {ts}</div>
</div>

<div style="border:3px solid {VENTERRA_BLUE};border-radius:12px;overflow:hidden;">
  <div style="background:{VENTERRA_BLUE};color:#fff;padding:10px 16px;font-size:19px;font-weight:800;text-align:center;">Executive At-a-Glance</div>
  <table style="width:100%;border-collapse:collapse;background:#ffffff;">
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Clicks</div>
        <div style="font-size:42px;line-height:1.05;font-weight:800;color:#0f172a;white-space:nowrap;">{month_prev.clicks:,} → {month_cur.clicks:,}</div>
        <div style="font-size:18px;font-weight:800;color:{'#16a34a' if (delta_clicks_pct or 0) >= 0 else '#dc2626'};">{fmt_delta(delta_clicks_pct)}</div>
        {click_kpi_spark}
      </td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Impressions</div>
        <div style="font-size:42px;line-height:1.05;font-weight:800;color:#0f172a;white-space:nowrap;">{month_prev.impressions:,} → {month_cur.impressions:,}</div>
        <div style="font-size:18px;font-weight:800;color:{'#16a34a' if (delta_impr_pct or 0) >= 0 else '#dc2626'};">{fmt_delta(delta_impr_pct)}</div>
        {impr_kpi_spark}
      </td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Portfolio CTR</div>
        <div style="font-size:42px;line-height:1.05;font-weight:800;color:#0f172a;white-space:nowrap;">{month_prev.ctr_pct:.2f}% → {month_cur.ctr_pct:.2f}%</div>
        <div style="font-size:18px;font-weight:800;color:{'#16a34a' if delta_ctr >= 0 else '#dc2626'};">{delta_ctr:+.2f} pts</div>
        {ctr_kpi_spark}
      </td>
    </tr>
    <tr>
      <td style="padding:11px;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Properties with Data</div>
        <div style="font-size:30px;font-weight:800;color:#0f172a;">{month_prev.property_count} → {month_cur.property_count}</div>
      </td>
      <td style="padding:11px;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Days Loaded</div>
        <div style="font-size:30px;font-weight:800;color:#0f172a;">{month_prev.active_days} / {month_cur.active_days}</div>
      </td>
      <td style="padding:11px;">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Month Pair</div>
        <div style="font-size:30px;font-weight:800;color:#0f172a;">{prev_month_label} vs {cur_month_label}</div>
      </td>
    </tr>
  </table>
</div>

<div style="margin-top:12px;border:1px solid #dbe4ef;border-radius:10px;padding:10px 12px;background:#f8fbff;">
  <div style="font-size:13px;font-weight:800;color:#0f172a;">Portfolio Overview ({cur_month_label})</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
    <span style="display:inline-block;padding:6px 10px;border:1px solid #fecaca;background:#fef2f2;border-radius:9999px;color:#b91c1c;font-size:12px;font-weight:700;">Needs Improvement {cur_grades['needs_improvement']} ({cur_grades['needs_improvement'] - prev_grades['needs_improvement']:+d})</span>
    <span style="display:inline-block;padding:6px 10px;border:1px solid #fde68a;background:#fffbeb;border-radius:9999px;color:#92400e;font-size:12px;font-weight:700;">Good {cur_grades['good']} ({cur_grades['good'] - prev_grades['good']:+d})</span>
    <span style="display:inline-block;padding:6px 10px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:9999px;color:#166534;font-size:12px;font-weight:700;">Excellent {cur_grades['excellent']} ({cur_grades['excellent'] - prev_grades['excellent']:+d})</span>
  </div>
</div>

<div style="margin-top:12px;border:2px solid {VENTERRA_BLUE};border-radius:10px;overflow:hidden;">
  <div style="background:{VENTERRA_BLUE};color:#ffffff;padding:9px 12px;font-size:14px;font-weight:800;letter-spacing:0.2px;">Search Performance by Property ({cur_month_label} vs {prev_month_label})</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr style="background:#ecf4ff;color:#0f172a;">
      <th style="padding:8px;text-align:left;">#</th>
      <th style="padding:8px;text-align:left;">Property</th>
      <th style="padding:8px;text-align:right;">{prev_month_label} Clicks</th>
      <th style="padding:8px;text-align:right;">{cur_month_label} Clicks</th>
      <th style="padding:8px;text-align:right;">Δ Clicks</th>
      <th style="padding:8px;text-align:right;">Δ Clicks %</th>
      <th style="padding:8px;text-align:right;">{prev_month_label} CTR</th>
      <th style="padding:8px;text-align:right;">{cur_month_label} CTR</th>
      <th style="padding:8px;text-align:right;">Δ CTR</th>
      <th style="padding:8px;text-align:right;">{prev_month_label} Impr.</th>
      <th style="padding:8px;text-align:right;">{cur_month_label} Impr.</th>
      <th style="padding:8px;text-align:right;">Δ Impr.</th>
    </tr>
    {''.join(row_html(r, i + 1) for i, r in enumerate(ranked))}
  </table>
</div>

<div style="margin-top:10px;font-size:11px;color:#64748b;text-align:center;">Daily trend lines are embedded in KPI cards above (Clicks, Impressions, CTR).</div>
</div>
</td></tr>
</table>
</body>
</html>
"""


def write_csv(path: Path, rows: List[Dict[str, object]]) -> None:
    headers = [
        "property_id",
        "property_name",
        "previous_clicks",
        "current_clicks",
        "delta_clicks",
        "delta_clicks_pct",
        "previous_impressions",
        "current_impressions",
        "delta_impressions",
        "delta_impressions_pct",
        "previous_ctr",
        "current_ctr",
        "delta_ctr",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate PIB-style GSC MoM report")
    parser.add_argument("--current", default="2026-02", help="Current month YYYY-MM")
    parser.add_argument("--previous", default="2026-01", help="Previous month YYYY-MM")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cur = query_month_agg(conn, args.current)
    prev = query_month_agg(conn, args.previous)
    daily_cur = query_daily(conn, args.current)
    daily_prev = query_daily(conn, args.previous)
    prop_rows = query_property_mom(conn, args.current, args.previous)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"gsc_mom_pib_{args.previous}_vs_{args.current}_{stamp}"

    csv_path = OUT_DIR / f"{base}.csv"
    html_path = OUT_DIR / f"{base}.html"

    write_csv(csv_path, prop_rows)
    html_path.write_text(build_html(prev, cur, daily_prev, daily_cur, prop_rows), encoding="utf-8")

    print(f"REPORT_HTML: {html_path}")
    print(f"REPORT_CSV: {csv_path}")
    print(f"SUMMARY: prev={prev.clicks} clicks, cur={cur.clicks} clicks, delta_pct={fmt_delta(pct_delta(cur.clicks, prev.clicks))}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
