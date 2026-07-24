#!/usr/bin/env python3
"""Generate a two-month PSI / GTmetrix report for the pilot sites."""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import mean
from typing import Iterable, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    FrameBreak,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen.canvas import Canvas
from reportlab.graphics.shapes import Drawing, Line, Rect, String


ROOT = Path("/Users/mark/Property_Analytics")
CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REPORT_DIR = ROOT / "reports" / "pilot_performance"
PDF_DIR = ROOT / "output" / "pdf"

BRAND = {
    "navy": "#15284B",
    "san_marino": "#3D66B9",
    "bay": "#294782",
    "indigo": "#5A81CF",
    "monte_carlo": "#7DCAC2",
    "pink": "#E02472",
    "white_smoke": "#F6F6F5",
    "terra_cotta": "#BD4830",
    "quill_gray": "#D6D6D2",
    "blue_chill": "#3B9189",
    "delta": "#9B9B96",
    "black": "#000000",
    "white": "#FFFFFF",
}

SERIES_COLORS = [
    BRAND["san_marino"],
    BRAND["monte_carlo"],
    BRAND["pink"],
    BRAND["terra_cotta"],
    BRAND["indigo"],
    BRAND["blue_chill"],
]


@dataclass(frozen=True)
class Site:
    key: str
    display_name: str
    role: str
    property_id: str
    site_url: str
    include_psi: bool = True


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def fmt_date(value: date | str | None) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, str):
        value = parse_date(value)
    return value.strftime("%b %-d, %Y")


def pct(value: Optional[float], digits: int = 0) -> str:
    if value is None:
        return "n/a"
    return f"{value:.{digits}f}"


def seconds(ms_or_s: Optional[float], source: str) -> str:
    if ms_or_s is None:
        return "n/a"
    value = ms_or_s / 1000 if source == "ms" else ms_or_s
    return f"{value:.2f}s"


def mb(bytes_value: Optional[float]) -> str:
    if bytes_value is None:
        return "n/a"
    return f"{bytes_value / 1024 / 1024:.2f} MB"


def delta_text(value: Optional[float], digits: int = 0) -> str:
    if value is None:
        return "n/a"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.{digits}f}"


def load_sites() -> list[Site]:
    config = json.loads(CONFIG_PATH.read_text())
    pilots = [
        Site(
            key=row["key"],
            display_name=row["display_name"],
            role=row["role"],
            property_id=str(row["property_id"]),
            site_url=row["site_url"],
        )
        for row in config["cohorts"]
        if row.get("active", True) and row.get("role") == "pilot"
    ]
    main = config.get("main_pilot_reference", {})
    pilots.append(
        Site(
            key="main_pilot_reference",
            display_name="Pilot Master",
            role="pilot_master",
            property_id=str(main.get("property_id", "main_pilot_reference")),
            site_url=str(main.get("site_url", "https://pilot.venterradev.com/")),
            include_psi=False,
        )
    )
    return pilots


def fetch_psi(conn: sqlite3.Connection, sites: list[Site], start: date, end: date) -> list[dict]:
    keys = [site.key for site in sites if site.include_psi]
    placeholders = ",".join("?" for _ in keys)
    rows = conn.execute(
        f"""
        SELECT cohort_key, display_name, metric_date, performance_score,
               lcp_value, cls_value, fcp_value, total_blocking_time,
               diagnostics_total_byte_weight, diagnostics_num_requests
        FROM pilot_control_psi_metrics
        WHERE strategy = 'mobile'
          AND cohort_key IN ({placeholders})
          AND metric_date BETWEEN ? AND ?
        ORDER BY metric_date
        """,
        [*keys, start.isoformat(), end.isoformat()],
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_gt(conn: sqlite3.Connection, sites: list[Site], start: date, end: date) -> list[dict]:
    ids = [site.property_id for site in sites]
    placeholders = ",".join("?" for _ in ids)
    rows = conn.execute(
        f"""
        SELECT property_id, metric_date, pagespeed_score, fully_loaded_time_ms,
               first_contentful_paint_ms, time_to_interactive_ms, page_bytes,
               page_requests
        FROM gtmetrix_metrics
        WHERE property_id IN ({placeholders})
          AND metric_date BETWEEN ? AND ?
        ORDER BY metric_date
        """,
        [*ids, start.isoformat(), end.isoformat()],
    ).fetchall()
    return [dict(row) for row in rows]


def number_from_line(pattern: str, text: str, scale: float = 1.0) -> Optional[float]:
    match = re.search(pattern, text)
    if not match:
        return None
    value = match.group(1).strip()
    if value in {"-", "—", ""}:
        return None
    return float(value) * scale


def master_row(day: date, score: float, lcp: Optional[float] = None, fcp: Optional[float] = None, tbt: Optional[float] = None) -> dict:
    return {
        "cohort_key": "main_pilot_reference",
        "display_name": "Pilot Master",
        "metric_date": day.isoformat(),
        "performance_score": float(score),
        "lcp_value": lcp,
        "cls_value": None,
        "fcp_value": fcp,
        "total_blocking_time": tbt,
        "diagnostics_total_byte_weight": None,
        "diagnostics_num_requests": None,
    }


def fetch_master_psi_from_reports(start: date, end: date) -> list[dict]:
    """Read Pilot Master PSI rows captured by existing daily pilot roundup reports."""
    rows_by_date: dict[date, dict] = {}
    report_dir = ROOT / "pilot_roundup" / "reports"
    if report_dir.exists():
        for path in sorted(report_dir.glob("Pilot_Performance_Roundup_2026-*.md")):
            try:
                day = parse_date(path.stem.removeprefix("Pilot_Performance_Roundup_"))
            except ValueError:
                continue
            if not (start <= day <= end):
                continue
            text = path.read_text(errors="ignore")
            section_match = re.search(r"## Main Pilot Reference(?P<section>.*?)(?:\n## |\Z)", text, re.S)
            if not section_match:
                continue
            section = section_match.group("section")
            score = number_from_line(r"- PSI:\s*([0-9.]+|—|-)", section)
            if score is None:
                continue
            rows_by_date[day] = master_row(
                day,
                score,
                lcp=number_from_line(r"- LCP:\s*([0-9.]+|—|-)", section),
                fcp=number_from_line(r"- FCP:\s*([0-9.]+|—|-)", section),
                tbt=number_from_line(r"- TBT:\s*([0-9.]+|—|-)", section),
            )

    # CSV exports are less complete locally, but keep them as a fallback for dates
    # where the daily roundup reference fetch failed or the Markdown is absent.
    export_dirs = [Path.home() / "Downloads", ROOT / "pilot_control_cwv" / "reports"]
    for export_dir in export_dirs:
        if not export_dir.exists():
            continue
        for path in sorted(export_dir.glob("PSI_Day_Over_Day_Scores_2026-*.csv")):
            try:
                day = parse_date(path.stem.removeprefix("PSI_Day_Over_Day_Scores_"))
            except ValueError:
                continue
            if day in rows_by_date or not (start <= day <= end):
                continue
            with path.open(newline="") as fh:
                reader = csv.DictReader(fh)
                for raw in reader:
                    if raw.get("Group") != "main_pilot_reference":
                        continue
                    value = (raw.get("Today PSI") or "").strip()
                    if not value:
                        continue
                    rows_by_date[day] = master_row(day, float(value))
                    break
    return [rows_by_date[day] for day in sorted(rows_by_date)]


def group_series(rows: Iterable[dict], key_field: str, value_field: str) -> dict[str, list[tuple[date, float]]]:
    grouped: dict[str, list[tuple[date, float]]] = {}
    for row in rows:
        value = row.get(value_field)
        if value is None:
            continue
        grouped.setdefault(str(row[key_field]), []).append((parse_date(str(row["metric_date"])), float(value)))
    return grouped


def rolling(points: list[tuple[date, float]], window: int = 7) -> list[tuple[date, float]]:
    out: list[tuple[date, float]] = []
    values: list[float] = []
    for point_date, value in sorted(points):
        values.append(value)
        out.append((point_date, mean(values[-window:])))
    return out


def first_last(rows: list[dict], value_field: str) -> tuple[Optional[dict], Optional[dict]]:
    valid = [row for row in rows if row.get(value_field) is not None]
    if not valid:
        return None, None
    valid.sort(key=lambda row: row["metric_date"])
    return valid[0], valid[-1]


def avg(rows: list[dict], field: str) -> Optional[float]:
    values = [float(row[field]) for row in rows if row.get(field) is not None]
    return mean(values) if values else None


def summarize(sites: list[Site], psi_rows: list[dict], gt_rows: list[dict]) -> list[dict]:
    psi_by_key: dict[str, list[dict]] = {site.key: [] for site in sites}
    for row in psi_rows:
        psi_by_key.setdefault(str(row["cohort_key"]), []).append(row)

    gt_by_id: dict[str, list[dict]] = {site.property_id: [] for site in sites}
    for row in gt_rows:
        gt_by_id.setdefault(str(row["property_id"]), []).append(row)

    summaries: list[dict] = []
    for site in sites:
        psi_first, psi_latest = first_last(psi_by_key.get(site.key, []), "performance_score")
        gt_first, gt_latest = first_last(gt_by_id.get(site.property_id, []), "pagespeed_score")
        summaries.append(
            {
                "name": site.display_name,
                "url": site.site_url,
                "psi_count": len(psi_by_key.get(site.key, [])),
                "psi_first_date": psi_first["metric_date"] if psi_first else None,
                "psi_latest_date": psi_latest["metric_date"] if psi_latest else None,
                "psi_first": float(psi_first["performance_score"]) if psi_first else None,
                "psi_latest": float(psi_latest["performance_score"]) if psi_latest else None,
                "psi_avg": avg(psi_by_key.get(site.key, []), "performance_score"),
                "psi_delta": (
                    float(psi_latest["performance_score"]) - float(psi_first["performance_score"])
                    if psi_first and psi_latest
                    else None
                ),
                "psi_lcp": float(psi_latest["lcp_value"]) if psi_latest and psi_latest.get("lcp_value") is not None else None,
                "psi_fcp": float(psi_latest["fcp_value"]) if psi_latest and psi_latest.get("fcp_value") is not None else None,
                "psi_cls": float(psi_latest["cls_value"]) if psi_latest and psi_latest.get("cls_value") is not None else None,
                "psi_tbt": float(psi_latest["total_blocking_time"])
                if psi_latest and psi_latest.get("total_blocking_time") is not None
                else None,
                "gt_count": len(gt_by_id.get(site.property_id, [])),
                "gt_first_date": gt_first["metric_date"] if gt_first else None,
                "gt_latest_date": gt_latest["metric_date"] if gt_latest else None,
                "gt_first": float(gt_first["pagespeed_score"]) if gt_first else None,
                "gt_latest": float(gt_latest["pagespeed_score"]) if gt_latest else None,
                "gt_avg": avg(gt_by_id.get(site.property_id, []), "pagespeed_score"),
                "gt_delta": (
                    float(gt_latest["pagespeed_score"]) - float(gt_first["pagespeed_score"])
                    if gt_first and gt_latest
                    else None
                ),
                "gt_loaded": float(gt_latest["fully_loaded_time_ms"])
                if gt_latest and gt_latest.get("fully_loaded_time_ms") is not None
                else None,
                "gt_fcp": float(gt_latest["first_contentful_paint_ms"])
                if gt_latest and gt_latest.get("first_contentful_paint_ms") is not None
                else None,
                "gt_tti": float(gt_latest["time_to_interactive_ms"])
                if gt_latest and gt_latest.get("time_to_interactive_ms") is not None
                else None,
                "gt_bytes": float(gt_latest["page_bytes"]) if gt_latest and gt_latest.get("page_bytes") is not None else None,
                "gt_requests": float(gt_latest["page_requests"]) if gt_latest and gt_latest.get("page_requests") is not None else None,
            }
        )
    return summaries


def svg_line_chart(
    title: str,
    series: dict[str, list[tuple[date, float]]],
    labels: dict[str, str],
    start: date,
    end: date,
    color_map: dict[str, str],
    y_min: float = 0,
    y_max: float = 100,
    width: int = 1100,
    height: int = 430,
) -> str:
    left, right, top, bottom = 62, 24, 44, 68
    plot_w = width - left - right
    plot_h = height - top - bottom
    days = max((end - start).days, 1)

    def x_for(d: date) -> float:
        return left + ((d - start).days / days) * plot_w

    def y_for(v: float) -> float:
        return top + (1 - ((v - y_min) / (y_max - y_min))) * plot_h

    parts = [
        f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(title)}">',
        f'<rect width="{width}" height="{height}" fill="{BRAND["white"]}" rx="10"/>',
        f'<text x="{left}" y="26" fill="{BRAND["navy"]}" font-size="18" font-weight="700">{html.escape(title)}</text>',
    ]
    for tick in range(0, 101, 20):
        y = y_for(tick)
        parts.append(f'<line x1="{left}" y1="{y:.1f}" x2="{width-right}" y2="{y:.1f}" stroke="{BRAND["quill_gray"]}" stroke-width="1"/>')
        parts.append(f'<text x="{left-12}" y="{y+4:.1f}" text-anchor="end" fill="{BRAND["delta"]}" font-size="12">{tick}</text>')
    for offset in [0, 15, 31, 45, 61]:
        d = start + timedelta(days=min(offset, days))
        x = x_for(d)
        parts.append(f'<line x1="{x:.1f}" y1="{top}" x2="{x:.1f}" y2="{height-bottom}" stroke="{BRAND["quill_gray"]}" stroke-width="1"/>')
        parts.append(f'<text x="{x:.1f}" y="{height-36}" text-anchor="middle" fill="{BRAND["delta"]}" font-size="12">{d.strftime("%b %-d")}</text>')
    for key, points in series.items():
        clean = [(d, v) for d, v in rolling(points) if start <= d <= end and y_min <= v <= y_max]
        if len(clean) < 2:
            continue
        coords = " ".join(f'{x_for(d):.1f},{y_for(v):.1f}' for d, v in clean)
        color = color_map[key]
        parts.append(f'<polyline fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="{coords}"/>')
        last_d, last_v = clean[-1]
        parts.append(f'<circle cx="{x_for(last_d):.1f}" cy="{y_for(last_v):.1f}" r="4" fill="{color}"/>')
    legend_x = left
    legend_y = height - 14
    for i, key in enumerate(series):
        x = legend_x + (i % 3) * 330
        y = legend_y - (1 if i >= 3 else 0) * 20
        parts.append(f'<circle cx="{x}" cy="{y-4}" r="5" fill="{color_map[key]}"/>')
        parts.append(f'<text x="{x+12}" y="{y}" fill="{BRAND["navy"]}" font-size="12">{html.escape(labels[key])}</text>')
    parts.append("</svg>")
    return "".join(parts)


def svg_bar_chart(title: str, rows: list[dict], width: int = 1100, height: int = 430) -> str:
    left, right, top, bottom = 210, 36, 50, 48
    plot_w = width - left - right
    row_h = (height - top - bottom) / len(rows)
    parts = [
        f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(title)}">',
        f'<rect width="{width}" height="{height}" fill="{BRAND["white"]}" rx="10"/>',
        f'<text x="{left}" y="28" fill="{BRAND["navy"]}" font-size="18" font-weight="700">{html.escape(title)}</text>',
    ]
    for tick in range(0, 101, 20):
        x = left + (tick / 100) * plot_w
        parts.append(f'<line x1="{x:.1f}" y1="{top}" x2="{x:.1f}" y2="{height-bottom}" stroke="{BRAND["quill_gray"]}" stroke-width="1"/>')
        parts.append(f'<text x="{x:.1f}" y="{height-18}" text-anchor="middle" fill="{BRAND["delta"]}" font-size="12">{tick}</text>')
    for i, row in enumerate(rows):
        y = top + i * row_h + 8
        parts.append(f'<text x="{left-16}" y="{y+17:.1f}" text-anchor="end" fill="{BRAND["navy"]}" font-size="13">{html.escape(row["name"])}</text>')
        for j, (field, color) in enumerate([("psi_latest", BRAND["san_marino"]), ("gt_latest", BRAND["monte_carlo"])]):
            value = row.get(field)
            if value is None:
                continue
            bar_y = y + j * 17
            bar_w = max(1, (float(value) / 100) * plot_w)
            parts.append(f'<rect x="{left}" y="{bar_y:.1f}" width="{bar_w:.1f}" height="12" fill="{color}" rx="2"/>')
            parts.append(f'<text x="{left+bar_w+8:.1f}" y="{bar_y+10:.1f}" fill="{BRAND["navy"]}" font-size="12">{value:.0f}</text>')
    parts.append(f'<rect x="{left}" y="{height-36}" width="12" height="12" fill="{BRAND["san_marino"]}"/><text x="{left+18}" y="{height-25}" font-size="12" fill="{BRAND["navy"]}">PSI mobile latest</text>')
    parts.append(f'<rect x="{left+150}" y="{height-36}" width="12" height="12" fill="{BRAND["monte_carlo"]}"/><text x="{left+168}" y="{height-25}" font-size="12" fill="{BRAND["navy"]}">GTmetrix latest</text>')
    parts.append("</svg>")
    return "".join(parts)


def color_for_delta(value: Optional[float]) -> str:
    if value is None:
        return BRAND["delta"]
    if value >= 3:
        return BRAND["blue_chill"]
    if value <= -3:
        return BRAND["terra_cotta"]
    return BRAND["delta"]


def write_summary_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "name",
        "url",
        "psi_count",
        "psi_first_date",
        "psi_latest_date",
        "psi_first",
        "psi_latest",
        "psi_avg",
        "psi_delta",
        "psi_lcp",
        "psi_fcp",
        "psi_cls",
        "psi_tbt",
        "gt_count",
        "gt_first_date",
        "gt_latest_date",
        "gt_first",
        "gt_latest",
        "gt_avg",
        "gt_delta",
        "gt_loaded",
        "gt_fcp",
        "gt_tti",
        "gt_bytes",
        "gt_requests",
    ]
    with path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fields})


def write_html(
    path: Path,
    rows: list[dict],
    start: date,
    end: date,
    psi_svg: str,
    gt_svg: str,
    bar_svg: str,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    avg_psi = avg([{"v": row["psi_latest"]} for row in rows if row.get("psi_latest") is not None], "v")
    avg_pilot_psi = avg(
        [{"v": row["psi_latest"]} for row in rows if row.get("psi_latest") is not None and row["name"] != "Pilot Master"],
        "v",
    )
    avg_gt = avg([{"v": row["gt_latest"]} for row in rows if row.get("gt_latest") is not None], "v")
    improving_psi = sum(1 for row in rows if row.get("psi_delta") is not None and row["psi_delta"] > 0)
    improving_gt = sum(1 for row in rows if row.get("gt_delta") is not None and row["gt_delta"] > 0)
    row_cards = []
    for row in rows:
        row_cards.append(
            f"""
            <section class="site-card">
              <div>
                <h3>{html.escape(row["name"])}</h3>
                <a href="{html.escape(row["url"])}">{html.escape(row["url"])}</a>
              </div>
              <div class="metric-grid">
                <div><span>PSI latest</span><strong>{pct(row.get("psi_latest"))}</strong><em style="color:{color_for_delta(row.get("psi_delta"))}">{delta_text(row.get("psi_delta"))}</em></div>
                <div><span>PSI avg</span><strong>{pct(row.get("psi_avg"), 1)}</strong><em>{row.get("psi_count", 0)} rows</em></div>
                <div><span>PSI LCP</span><strong>{seconds(row.get("psi_lcp"), "s")}</strong><em>TBT {seconds(row.get("psi_tbt"), "ms")}</em></div>
                <div><span>GT latest</span><strong>{pct(row.get("gt_latest"))}</strong><em style="color:{color_for_delta(row.get("gt_delta"))}">{delta_text(row.get("gt_delta"))}</em></div>
                <div><span>GT avg</span><strong>{pct(row.get("gt_avg"), 1)}</strong><em>{row.get("gt_count", 0)} rows</em></div>
                <div><span>GT load</span><strong>{seconds(row.get("gt_loaded"), "ms")}</strong><em>{mb(row.get("gt_bytes"))}, {pct(row.get("gt_requests"))} req</em></div>
              </div>
            </section>
            """
        )

    table_rows = "\n".join(
        f"""
        <tr>
          <td>{html.escape(row["name"])}</td>
          <td>{pct(row.get("psi_latest"))}</td>
          <td>{pct(row.get("psi_avg"), 1)}</td>
          <td>{delta_text(row.get("psi_delta"))}</td>
          <td>{seconds(row.get("psi_lcp"), "s")}</td>
          <td>{seconds(row.get("psi_tbt"), "ms")}</td>
          <td>{pct(row.get("gt_latest"))}</td>
          <td>{pct(row.get("gt_avg"), 1)}</td>
          <td>{delta_text(row.get("gt_delta"))}</td>
          <td>{seconds(row.get("gt_loaded"), "ms")}</td>
          <td>{mb(row.get("gt_bytes"))}</td>
        </tr>
        """
        for row in rows
    )
    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pilot PSI / GTmetrix Report</title>
  <style>
    :root {{
      --navy: {BRAND["navy"]};
      --bay: {BRAND["bay"]};
      --san-marino: {BRAND["san_marino"]};
      --indigo: {BRAND["indigo"]};
      --monte-carlo: {BRAND["monte_carlo"]};
      --pink: {BRAND["pink"]};
      --white-smoke: {BRAND["white_smoke"]};
      --terra-cotta: {BRAND["terra_cotta"]};
      --quill-gray: {BRAND["quill_gray"]};
      --blue-chill: {BRAND["blue_chill"]};
      --delta: {BRAND["delta"]};
      --white: {BRAND["white"]};
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: var(--navy);
      background: var(--white-smoke);
      font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
      line-height: 1.45;
    }}
    .hero {{
      background: var(--navy);
      color: var(--white);
      padding: 42px 46px 34px;
      border-bottom: 8px solid var(--monte-carlo);
    }}
    .hero p {{ max-width: 980px; margin: 10px 0 0; color: var(--quill-gray); }}
    h1 {{ margin: 0; font-size: 38px; line-height: 1.05; letter-spacing: 0; }}
    h2 {{ margin: 0 0 16px; font-size: 24px; letter-spacing: 0; }}
    h3 {{ margin: 0; font-size: 18px; letter-spacing: 0; }}
    main {{ width: min(1180px, calc(100% - 36px)); margin: 28px auto 46px; }}
    .summary-grid, .metric-grid {{ display: grid; gap: 12px; }}
    .summary-grid {{ grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 20px; }}
    .summary-card, .site-card, .chart-card, table {{
      background: var(--white);
      border: 1px solid var(--quill-gray);
      border-radius: 8px;
    }}
    .summary-card {{ padding: 18px; }}
    .summary-card span, .metric-grid span {{ display: block; color: var(--delta); font-size: 12px; text-transform: uppercase; letter-spacing: 0; }}
    .summary-card strong {{ display: block; font-size: 32px; margin-top: 4px; }}
    .summary-card em, .metric-grid em {{ display: block; color: var(--delta); font-size: 12px; font-style: normal; }}
    .chart-grid {{ display: grid; gap: 18px; margin: 22px 0; }}
    .chart-card {{ padding: 14px; overflow: hidden; }}
    .chart-card svg {{ display: block; width: 100%; height: auto; }}
    .site-list {{ display: grid; gap: 12px; margin: 20px 0; }}
    .site-card {{ padding: 18px; }}
    .site-card a {{ color: var(--san-marino); text-decoration: none; overflow-wrap: anywhere; }}
    .metric-grid {{ grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 16px; }}
    .metric-grid div {{ border-left: 4px solid var(--monte-carlo); padding: 4px 10px; min-width: 0; }}
    .metric-grid strong {{ display: block; font-size: 22px; margin: 2px 0; }}
    .note {{
      border-left: 5px solid var(--pink);
      background: var(--white);
      padding: 14px 18px;
      margin: 18px 0;
      border-radius: 0 8px 8px 0;
    }}
    table {{ width: 100%; border-collapse: collapse; overflow: hidden; }}
    th, td {{ padding: 10px 9px; border-bottom: 1px solid var(--quill-gray); text-align: right; font-size: 13px; }}
    th:first-child, td:first-child {{ text-align: left; }}
    th {{ background: var(--bay); color: var(--white); font-weight: 700; }}
    footer {{ color: var(--delta); font-size: 12px; margin-top: 18px; }}
    @media (max-width: 900px) {{
      .summary-grid, .metric-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
      .hero {{ padding: 28px 24px; }}
      h1 {{ font-size: 30px; }}
      main {{ width: min(100% - 24px, 1180px); }}
    }}
  </style>
</head>
<body>
  <header class="hero">
    <h1>Pilot PSI / GTmetrix Performance Report</h1>
    <p>Two-month view for the five pilot sites plus Pilot Master <strong>pilot.venterradev.com</strong>. Window: {fmt_date(start)} to {fmt_date(end)}. PSI is mobile PageSpeed from <code>pilot_control_psi_metrics</code>; GTmetrix is sourced from <code>gtmetrix_metrics</code>.</p>
  </header>
  <main>
    <section class="summary-grid">
      <div class="summary-card"><span>Sites covered</span><strong>{len(rows)}</strong><em>5 pilot sites + Pilot Master</em></div>
      <div class="summary-card"><span>Latest avg PSI</span><strong>{pct(avg_pilot_psi, 1)}</strong><em>pilot sites only; all scored rows {pct(avg_psi, 1)}</em></div>
      <div class="summary-card"><span>Latest avg GTmetrix</span><strong>{pct(avg_gt, 1)}</strong><em>all covered sites</em></div>
      <div class="summary-card"><span>Positive movement</span><strong>{improving_psi}/{sum(1 for row in rows if row.get("psi_delta") is not None)}</strong><em>PSI; GTmetrix {improving_gt}/{sum(1 for row in rows if row.get("gt_delta") is not None)}</em></div>
    </section>
    <div class="note">Pilot Master PSI is sourced from the existing daily <code>Pilot_Performance_Roundup_*.md</code> Main Pilot Reference section, with <code>PSI_Day_Over_Day_Scores_*.csv</code> as fallback where needed. The two-month Master GTmetrix series is sourced from <code>gtmetrix_metrics</code>. No two-month Master PSI history was found in <code>pagespeed_metrics</code> or <code>pilot_control_psi_metrics</code>.</div>
    <section class="chart-grid">
      <div class="chart-card">{psi_svg}</div>
      <div class="chart-card">{gt_svg}</div>
      <div class="chart-card">{bar_svg}</div>
    </section>
    <section>
      <h2>Site Detail</h2>
      <div class="site-list">{''.join(row_cards)}</div>
    </section>
    <section>
      <h2>Stats Table</h2>
      <table>
        <thead><tr><th>Site</th><th>PSI latest</th><th>PSI avg</th><th>PSI delta</th><th>PSI LCP</th><th>PSI TBT</th><th>GT latest</th><th>GT avg</th><th>GT delta</th><th>GT load</th><th>GT bytes</th></tr></thead>
        <tbody>{table_rows}</tbody>
      </table>
    </section>
    <footer>Generated {datetime.now().strftime("%b %-d, %Y %-I:%M %p")} from local canonical pilot performance tables. Charts use 7-row rolling score trends to make daily synthetic noise easier to read.</footer>
  </main>
</body>
</html>
"""
    path.write_text(html_doc)


def hex_color(value: str) -> colors.Color:
    return colors.HexColor(value)


def draw_footer(canvas: Canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(hex_color(BRAND["delta"]))
    canvas.drawString(0.55 * inch, 0.32 * inch, "Pilot PSI / GTmetrix Performance Report")
    canvas.drawRightString(doc.pagesize[0] - 0.55 * inch, 0.32 * inch, f"Page {doc.page}")
    canvas.restoreState()


def make_pdf_line_chart(
    title: str,
    series: dict[str, list[tuple[date, float]]],
    labels: dict[str, str],
    start: date,
    end: date,
    color_map: dict[str, str],
    width: int = 650,
    height: int = 250,
) -> Drawing:
    drawing = Drawing(width, height)
    drawing.add(Rect(0, 0, width, height, fillColor=hex_color(BRAND["white"]), strokeColor=hex_color(BRAND["quill_gray"])))
    left, right, top, bottom = 44, 18, 34, 44
    plot_w = width - left - right
    plot_h = height - top - bottom
    days = max((end - start).days, 1)

    def x_for(d: date) -> float:
        return left + ((d - start).days / days) * plot_w

    def y_for(v: float) -> float:
        return bottom + (v / 100) * plot_h

    drawing.add(String(left, height - 22, title, fontName="Helvetica-Bold", fontSize=12, fillColor=hex_color(BRAND["navy"])))
    for tick in range(0, 101, 20):
        y = y_for(tick)
        drawing.add(Line(left, y, width - right, y, strokeColor=hex_color(BRAND["quill_gray"]), strokeWidth=0.5))
        drawing.add(String(left - 22, y - 3, str(tick), fontSize=7, fillColor=hex_color(BRAND["delta"])))
    for key, points in series.items():
        clean = [(d, v) for d, v in rolling(points) if start <= d <= end]
        if len(clean) < 2:
            continue
        previous = clean[0]
        for current in clean[1:]:
            drawing.add(
                Line(
                    x_for(previous[0]),
                    y_for(previous[1]),
                    x_for(current[0]),
                    y_for(current[1]),
                    strokeColor=hex_color(color_map[key]),
                    strokeWidth=1.4,
                )
            )
            previous = current
    legend_y = 16
    for i, key in enumerate(series):
        x = left + (i % 3) * 198
        y = legend_y + (0 if i < 3 else 13)
        drawing.add(Rect(x, y - 4, 6, 6, fillColor=hex_color(color_map[key]), strokeColor=hex_color(color_map[key])))
        drawing.add(String(x + 9, y - 4, labels[key], fontSize=7, fillColor=hex_color(BRAND["navy"])))
    return drawing


def write_pdf(path: Path, rows: list[dict], start: date, end: date, psi_series, gt_series, labels, color_map) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleWhite", parent=styles["Title"], textColor=hex_color(BRAND["white"]), fontSize=24, leading=28, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="SmallWhite", parent=styles["BodyText"], textColor=hex_color(BRAND["quill_gray"]), fontSize=9, leading=12))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], textColor=hex_color(BRAND["navy"]), fontSize=15, leading=18, spaceAfter=8))
    styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], textColor=hex_color(BRAND["navy"]), fontSize=9, leading=12))
    styles.add(ParagraphStyle(name="Center", parent=styles["BodyText"], alignment=TA_CENTER, textColor=hex_color(BRAND["navy"]), fontSize=8, leading=10))

    doc = BaseDocTemplate(
        str(path),
        pagesize=landscape(letter),
        rightMargin=0.45 * inch,
        leftMargin=0.45 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.5 * inch,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=draw_footer)])

    elements = []
    hero = Table(
        [[Paragraph("Pilot PSI / GTmetrix Performance Report", styles["TitleWhite"]), Paragraph(f"{fmt_date(start)} to {fmt_date(end)}<br/>Five pilot sites plus Pilot Master", styles["SmallWhite"])]],
        colWidths=[6.9 * inch, 3.0 * inch],
        rowHeights=[0.86 * inch],
    )
    hero.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), hex_color(BRAND["navy"])),
                ("BOX", (0, 0), (-1, -1), 0, hex_color(BRAND["navy"])),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    elements.append(hero)
    elements.append(Spacer(1, 0.16 * inch))
    elements.append(Paragraph("Score Trends", styles["Section"]))
    elements.append(make_pdf_line_chart("PSI Mobile Performance - 7-row rolling", psi_series, labels, start, end, color_map, width=720, height=238))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(make_pdf_line_chart("GTmetrix PageSpeed - 7-row rolling", gt_series, labels, start, end, color_map, width=720, height=238))
    elements.append(PageBreak())

    elements.append(Paragraph("Latest Stats", styles["Section"]))
    table_data = [
        [
            "Site",
            "PSI latest",
            "PSI avg",
            "PSI delta",
            "PSI LCP",
            "GT latest",
            "GT avg",
            "GT delta",
            "GT load",
            "GT bytes",
        ]
    ]
    for row in rows:
        table_data.append(
            [
                Paragraph(row["name"], styles["Body"]),
                pct(row.get("psi_latest")),
                pct(row.get("psi_avg"), 1),
                delta_text(row.get("psi_delta")),
                seconds(row.get("psi_lcp"), "s"),
                pct(row.get("gt_latest")),
                pct(row.get("gt_avg"), 1),
                delta_text(row.get("gt_delta")),
                seconds(row.get("gt_loaded"), "ms"),
                mb(row.get("gt_bytes")),
            ]
        )
    table = Table(table_data, colWidths=[1.95 * inch, 0.62 * inch, 0.62 * inch, 0.62 * inch, 0.72 * inch, 0.67 * inch, 0.62 * inch, 0.62 * inch, 0.72 * inch, 0.86 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), hex_color(BRAND["bay"])),
                ("TEXTCOLOR", (0, 0), (-1, 0), hex_color(BRAND["white"])),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("GRID", (0, 0), (-1, -1), 0.35, hex_color(BRAND["quill_gray"])),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [hex_color(BRAND["white"]), hex_color(BRAND["white_smoke"])]),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 0.16 * inch))
    elements.append(
        Paragraph(
            "Note: Pilot Master PSI is sourced from the existing daily Pilot_Performance_Roundup Markdown Main Pilot Reference section, with PSI_Day_Over_Day_Scores CSV exports as fallback where needed. No two-month Master PSI history was found in pagespeed_metrics or pilot_control_psi_metrics.",
            styles["Body"],
        )
    )
    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        Paragraph(
            "Source: local canonical pilot tables pilot_control_psi_metrics and gtmetrix_metrics, plus existing daily roundup/export artifacts for the Pilot Master PSI row. GTmetrix credits and PSI API calls were not consumed for this report.",
            styles["Body"],
        )
    )
    doc.build(elements)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate pilot PSI / GTmetrix two-month report.")
    parser.add_argument("--end-date", default=date.today().isoformat())
    parser.add_argument("--days", type=int, default=61)
    args = parser.parse_args()

    end = parse_date(args.end_date)
    start = end - timedelta(days=args.days)

    sites = load_sites()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        psi_rows = fetch_psi(conn, sites, start, end)
        gt_rows = fetch_gt(conn, sites, start, end)
    finally:
        conn.close()
    psi_rows.extend(fetch_master_psi_from_reports(start, end))

    rows = summarize(sites, psi_rows, gt_rows)
    labels = {site.key: site.display_name for site in sites}
    labels.update({site.property_id: site.display_name for site in sites})
    color_map = {site.key: SERIES_COLORS[i % len(SERIES_COLORS)] for i, site in enumerate(sites)}
    color_map.update({site.property_id: SERIES_COLORS[i % len(SERIES_COLORS)] for i, site in enumerate(sites)})

    psi_series = group_series(psi_rows, "cohort_key", "performance_score")
    gt_series = group_series(gt_rows, "property_id", "pagespeed_score")
    psi_svg = svg_line_chart("PSI Mobile Performance - 7-row rolling", psi_series, labels, start, end, color_map)
    gt_svg = svg_line_chart("GTmetrix PageSpeed - 7-row rolling", gt_series, labels, start, end, color_map)
    bar_svg = svg_bar_chart("Latest Scores by Site", rows)

    stamp = end.strftime("%Y%m%d")
    html_path = REPORT_DIR / f"pilot_psi_gtmetrix_two_month_report_{stamp}.html"
    csv_path = REPORT_DIR / f"pilot_psi_gtmetrix_two_month_summary_{stamp}.csv"
    pdf_path = PDF_DIR / f"pilot_psi_gtmetrix_two_month_report_{stamp}.pdf"

    write_html(html_path, rows, start, end, psi_svg, gt_svg, bar_svg)
    write_summary_csv(csv_path, rows)
    write_pdf(pdf_path, rows, start, end, psi_series, gt_series, labels, color_map)

    print(json.dumps({"html": str(html_path), "csv": str(csv_path), "pdf": str(pdf_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
