#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import io
import json
import sqlite3
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import matplotlib.pyplot as plt

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))

from utils.report_builder import ReportBuilder, Section


DB_PATH = ROOT / "data" / "portfolio_analytics.db"
IDENTITY_MATRIX = ROOT / "config" / "property_identity_matrix.json"
OUTPUT_DIR = ROOT / "pilot_roundup" / "reports" / "spotlight"

SPOTLIGHT_CODES: list[str] = [
    "TX4GM",  # Retreat
    "GA4BL",  # Botanic
    "TX416",  # 1604
    "FL4TA",  # Anatole Daytona
    "TX4CO",  # College View
    "FL4GW",  # Grove West
    "FL4HL",  # Hammock Landing
    "KY4TG",  # Thomas Glen
    "KY4MP",  # Metropolitan
    "KY4SC",  # Steeplechase
    "TX4FV",  # Forest View
]

DISPLAY_NAMES: dict[str, str] = {
    "TX4GM": "Retreat",
    "GA4BL": "Botanic",
    "TX416": "1604",
    "FL4TA": "Anatole Daytona",
    "TX4CO": "College View",
    "FL4GW": "Grove West",
    "FL4HL": "Hammock Landing",
    "KY4TG": "Thomas Glen",
    "KY4MP": "Metropolitan",
    "KY4SC": "Steeplechase",
    "TX4FV": "Forest View",
}


GREEN = "#1E7F4F"
YELLOW = "#A86400"
RED = "#A61E2A"
NEUTRAL = "#333"


def _load_ga4_id_by_property_code() -> dict[str, str]:
    data = json.loads(IDENTITY_MATRIX.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for row in data.get("properties") or []:
        code = str(row.get("property_code") or "").strip()
        ga4_id = str(row.get("ga4_property_id") or "").strip()
        if code and ga4_id:
            out[code] = ga4_id
    return out


def _query_one(conn: sqlite3.Connection, sql: str, params: tuple[object, ...]) -> object | None:
    row = conn.execute(sql, params).fetchone()
    return row[0] if row else None


def _latest_date_for_table(conn: sqlite3.Connection, table: str, ga4_ids: list[str], date_ceiling: str) -> Optional[str]:
    if not ga4_ids:
        return None
    placeholders = ",".join(["?"] * len(ga4_ids))
    sql = f"""
        SELECT MAX(metric_date)
          FROM {table}
         WHERE property_id IN ({placeholders})
           AND metric_date <= ?
    """
    return _query_one(conn, sql, tuple(ga4_ids) + (date_ceiling,))  # type: ignore[arg-type]


def _score_color(score: Optional[float]) -> str:
    if score is None:
        return NEUTRAL
    if score >= 90:
        return GREEN
    if score >= 70:
        return YELLOW
    return RED


def _psi_color(score: Optional[float]) -> str:
    if score is None:
        return NEUTRAL
    if score >= 70:
        return GREEN
    if score >= 60:
        return YELLOW
    return RED


def _cls_color(cls: Optional[float]) -> str:
    if cls is None:
        return NEUTRAL
    if cls <= 0.1:
        return GREEN
    if cls <= 0.25:
        return YELLOW
    return RED


def _lcp_color(lcp_s: Optional[float]) -> str:
    if lcp_s is None:
        return NEUTRAL
    if lcp_s <= 2.5:
        return GREEN
    if lcp_s <= 4.0:
        return YELLOW
    return RED


def _fcp_color(fcp_s: Optional[float]) -> str:
    if fcp_s is None:
        return NEUTRAL
    if fcp_s <= 1.8:
        return GREEN
    if fcp_s <= 3.0:
        return YELLOW
    return RED


def _fmt_delta_float(delta: Optional[float], *, inverse: bool = False) -> tuple[str, str]:
    if delta is None:
        return "", NEUTRAL
    if abs(delta) < 1e-9:
        return "→0.0", YELLOW
    up = delta > 0
    arrow = "↑" if up else "↓"
    text = f"{arrow}{abs(delta):.1f}"
    if inverse:
        # lower is better
        color = GREEN if not up else RED
    else:
        color = GREEN if up else RED
    return text, color


def _fmt_delta_int(delta: Optional[int], *, inverse: bool = False) -> tuple[str, str]:
    if delta is None:
        return "", NEUTRAL
    if delta == 0:
        return "→0", YELLOW
    up = delta > 0
    arrow = "↑" if up else "↓"
    text = f"{arrow}{abs(delta)}"
    if inverse:
        color = GREEN if not up else RED
    else:
        color = GREEN if up else RED
    return text, color


def _sparkline_png_base64(values: list[float]) -> str:
    fig = plt.figure(figsize=(1.6, 0.35), dpi=80)  # ~128x28
    ax = fig.add_axes([0, 0, 1, 1])
    ax.plot(values, color=YELLOW, linewidth=2.0)
    ax.set_axis_off()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _psi_history(conn: sqlite3.Connection, ga4_id: str, end_date: str, days: int = 7) -> list[tuple[str, float]]:
    sql = """
        SELECT metric_date, performance_score
          FROM pagespeed_metrics
         WHERE property_id = ?
           AND strategy = 'mobile'
           AND metric_date <= ?
           AND performance_score IS NOT NULL
         ORDER BY metric_date DESC
         LIMIT ?
    """
    rows = conn.execute(sql, (ga4_id, end_date, days)).fetchall()
    out = [(str(r[0]), float(r[1])) for r in rows]
    return list(reversed(out))


def _psi_row(conn: sqlite3.Connection, ga4_id: str, metric_date: str) -> dict[str, Optional[float]]:
    sql = """
        SELECT performance_score, accessibility_score, best_practices_score, seo_score,
               lcp_value, cls_value, fcp_value, total_blocking_time
          FROM pagespeed_metrics
         WHERE property_id = ?
           AND metric_date = ?
           AND strategy = 'mobile'
         LIMIT 1
    """
    row = conn.execute(sql, (ga4_id, metric_date)).fetchone()
    if not row:
        return {
            "performance_score": None,
            "accessibility_score": None,
            "best_practices_score": None,
            "seo_score": None,
            "lcp_value": None,
            "cls_value": None,
            "fcp_value": None,
            "tbt_ms": None,
        }
    tbt_ms = float(row[7]) if row[7] is not None else None
    return {
        "performance_score": float(row[0]) if row[0] is not None else None,
        "accessibility_score": float(row[1]) if row[1] is not None else None,
        "best_practices_score": float(row[2]) if row[2] is not None else None,
        "seo_score": float(row[3]) if row[3] is not None else None,
        "lcp_value": float(row[4]) if row[4] is not None else None,
        "cls_value": float(row[5]) if row[5] is not None else None,
        "fcp_value": float(row[6]) if row[6] is not None else None,
        "tbt_ms": (tbt_ms if tbt_ms is None else float(round(tbt_ms))),
    }


def _ga4_new_users(conn: sqlite3.Connection, ga4_id: str, metric_date: str) -> Optional[int]:
    sql = """
        SELECT new_users
          FROM ga4_daily_metrics
         WHERE property_id = ?
           AND metric_date = ?
         LIMIT 1
    """
    val = _query_one(conn, sql, (ga4_id, metric_date))
    return int(val) if val is not None else None


def _prev_ga4_new_users(conn: sqlite3.Connection, ga4_id: str, metric_date: str) -> tuple[Optional[str], Optional[int]]:
    sql = """
        SELECT metric_date, new_users
          FROM ga4_daily_metrics
         WHERE property_id = ?
           AND metric_date < ?
         ORDER BY metric_date DESC
         LIMIT 1
    """
    row = conn.execute(sql, (ga4_id, metric_date)).fetchone()
    if not row:
        return None, None
    return str(row[0]), (int(row[1]) if row[1] is not None else None)


def _prev_psi_score(conn: sqlite3.Connection, ga4_id: str, metric_date: str) -> tuple[Optional[str], Optional[float]]:
    sql = """
        SELECT metric_date, performance_score
          FROM pagespeed_metrics
         WHERE property_id = ?
           AND strategy = 'mobile'
           AND metric_date < ?
           AND performance_score IS NOT NULL
         ORDER BY metric_date DESC
         LIMIT 1
    """
    row = conn.execute(sql, (ga4_id, metric_date)).fetchone()
    if not row:
        return None, None
    return str(row[0]), float(row[1])


def _copy_note_for_property(conn: sqlite3.Connection, property_code: str) -> Optional[str]:
    sql = """
        SELECT publish_timestamp, changed_fields_json
          FROM copy_change_interventions
         WHERE property_code = ?
           AND status = 'active'
         ORDER BY publish_timestamp DESC
         LIMIT 1
    """
    row = conn.execute(sql, (property_code,)).fetchone()
    if not row:
        return None
    publish_ts = str(row[0])
    day = publish_ts[:10]
    mmddyyyy = f"{day[5:7]}/{day[8:10]}/{day[0:4]}"
    try:
        fields = json.loads(row[1] or "[]")
    except Exception:
        fields = []
    if fields == ["hero", "romance"]:
        return f"Hero and romance copy updated on {mmddyyyy}; title/meta pending live verification."
    if isinstance(fields, list) and fields:
        # Convert a few known shorthand fields.
        label_map = {
            "meta": "meta",
            "title": "title",
            "upper_copy": "upper intro copy",
            "neighborhood": "neighborhood copy",
            "open_graph": "Open Graph/Twitter metadata",
            "og": "Open Graph metadata",
            "romance": "romance copy",
            "hero": "hero copy",
            "faq": "FAQ copy",
            "reviews_module": "reviews module copy",
        }
        pretty = [label_map.get(str(f), str(f)) for f in fields]
        return f"Updated {', '.join(pretty)} on {mmddyyyy}."
    return f"Updated copy on {mmddyyyy}."


@dataclass(frozen=True)
class SpotlightComputed:
    property_code: str
    ga4_id: str
    display_name: str
    psi_today: Optional[float]
    psi_delta: Optional[float]
    new_users_today: Optional[int]
    new_users_delta: Optional[int]
    overall_label: str
    psi_row: dict[str, Optional[float]]
    prev_psi_row: dict[str, Optional[float]]
    copy_note: Optional[str]
    trend_png_b64: Optional[str]


def _overall_label(psi_score: Optional[float]) -> str:
    if psi_score is None:
        return "Yellow"
    if psi_score >= 70:
        return "Green"
    if psi_score >= 60:
        return "Yellow"
    return "Red"


def build_report(report_date: str) -> tuple[Path, Path]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ga4_id_by_code = _load_ga4_id_by_property_code()
    spotlight_ga4_ids = [ga4_id_by_code[c] for c in SPOTLIGHT_CODES if c in ga4_id_by_code]
    missing = [c for c in SPOTLIGHT_CODES if c not in ga4_id_by_code]
    if missing:
        raise RuntimeError(f"Missing ga4_property_id mapping for Spotlight codes: {', '.join(missing)}")

    with sqlite3.connect(DB_PATH) as conn:
        latest_psi = _latest_date_for_table(conn, "pagespeed_metrics", spotlight_ga4_ids, report_date)
        latest_ga4 = _latest_date_for_table(conn, "ga4_daily_metrics", spotlight_ga4_ids, report_date)
        if not latest_psi or not latest_ga4:
            raise RuntimeError(
                "Unable to locate latest PSI/GA4 dates for the Spotlight cohort "
                f"(psi={latest_psi!r}, ga4={latest_ga4!r})."
            )

        computed: list[SpotlightComputed] = []
        for code in SPOTLIGHT_CODES:
            ga4_id = ga4_id_by_code[code]
            name = DISPLAY_NAMES.get(code, code)

            psi = _psi_row(conn, ga4_id, latest_psi)
            prev_psi_date, prev_psi_score = _prev_psi_score(conn, ga4_id, latest_psi)
            prev_psi = _psi_row(conn, ga4_id, prev_psi_date) if prev_psi_date else _psi_row(conn, ga4_id, latest_psi)

            psi_today = psi.get("performance_score")
            psi_delta = (psi_today - prev_psi_score) if (psi_today is not None and prev_psi_score is not None) else None

            new_users_today = _ga4_new_users(conn, ga4_id, latest_ga4)
            _prev_ga4_date, prev_new_users = _prev_ga4_new_users(conn, ga4_id, latest_ga4)
            new_users_delta = (
                (new_users_today - prev_new_users)
                if (new_users_today is not None and prev_new_users is not None)
                else None
            )

            history = _psi_history(conn, ga4_id, latest_psi, days=7)
            trend_b64 = _sparkline_png_base64([v for _, v in history]) if len(history) >= 2 else None

            computed.append(
                SpotlightComputed(
                    property_code=code,
                    ga4_id=ga4_id,
                    display_name=name,
                    psi_today=psi_today,
                    psi_delta=psi_delta,
                    new_users_today=new_users_today,
                    new_users_delta=new_users_delta,
                    overall_label=_overall_label(psi_today),
                    psi_row=psi,
                    prev_psi_row=prev_psi,
                    copy_note=_copy_note_for_property(conn, code),
                    trend_png_b64=trend_b64,
                )
            )

    computed.sort(key=lambda r: (r.psi_today is None, -(r.psi_today or 0.0), r.display_name))

    # Overview KPIs
    psi_values = [c.psi_today for c in computed if c.psi_today is not None]
    psi_avg = sum(psi_values) / len(psi_values) if psi_values else None
    # Yesterday cohort avg
    with sqlite3.connect(DB_PATH) as conn:
        prev_dates = []
        for c in computed:
            prev_date, _ = _prev_psi_score(conn, c.ga4_id, latest_psi)
            if prev_date:
                prev_dates.append(prev_date)
        # For cohort comparison, use latest_psi - 1 day where possible.
        prev_psi_date = None
        if prev_dates:
            prev_psi_date = max(prev_dates)
        prev_vals = []
        if prev_psi_date:
            for c in computed:
                prev = _psi_row(conn, c.ga4_id, prev_psi_date).get("performance_score")
                if prev is not None:
                    prev_vals.append(prev)
        prev_avg = sum(prev_vals) / len(prev_vals) if prev_vals else None

    avg_delta = (psi_avg - prev_avg) if (psi_avg is not None and prev_avg is not None) else None
    avg_trend, _avg_color = _fmt_delta_float(avg_delta)

    top = next((c for c in computed if c.psi_today is not None), None)
    low = next((c for c in reversed(computed) if c.psi_today is not None), None)
    top_users = max((c for c in computed if c.new_users_today is not None), key=lambda r: r.new_users_today, default=None)
    avg_new_users = None
    new_user_vals = [c.new_users_today for c in computed if c.new_users_today is not None]
    if new_user_vals:
        avg_new_users = sum(new_user_vals) / len(new_user_vals)

    green_count = sum(1 for c in computed if c.overall_label == "Green")
    yellow_count = sum(1 for c in computed if c.overall_label == "Yellow")
    red_count = sum(1 for c in computed if c.overall_label == "Red")

    builder = ReportBuilder(
        title="Spotlight Performance Roundup",
        subtitle="PAGESPEED INSIGHTS PERFORMANCE",
        version="1.0",
    )

    # Historical reports show the scheduled 7:00 AM stamp even if sources are older.
    header_stamp = datetime.now().strftime("%m/%d/%Y %I:%M %p")
    try:
        dt = datetime.fromisoformat(report_date)
        header_stamp = dt.strftime("%m/%d/%Y") + " 07:00 AM"
    except Exception:
        pass
    builder.date_range = header_stamp

    def kpi_tile(
        label: str,
        value: str,
        *,
        value_color: str,
        trend: Optional[str] = None,
        trend_color: Optional[str] = None,
        sublabel: Optional[str] = None,
        is_primary: bool = False,
    ) -> str:
        border_style = "1px solid #3D66B9" if is_primary else "1px solid #e9ecef"
        html = (
            f"<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width: 100%; background: #ffffff; border: {border_style}; border-radius: 6px;\">"
            "<tr><td style=\"padding: 20px; text-align: center;\">"
            f"<div style=\"font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600;\">{label}</div>"
            f"<div style=\"font-size: 36px; font-weight: 700; color: {value_color}; margin: 8px 0; line-height: 1;\">{value}</div>"
        )
        if trend:
            html += f"<div style=\"font-size: 14px; color: {trend_color or '#6c757d'}; margin-top: 6px; font-weight: 600;\">{trend}</div>"
        if sublabel:
            html += f"<div style=\"font-size: 11px; color: #868e96; margin-top: 8px; font-style: italic;\">{sublabel}</div>"
        html += "</td></tr></table>"
        return html

    def kpi_row(tiles: list[str], columns: int = 4) -> str:
        gap_pct = 2
        col_width = (100 - (gap_pct * (columns - 1))) // columns
        out = "<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width: 100%; margin: 30px 0 18px 0;\"><tr>"
        for i, tile_html in enumerate(tiles):
            out += f"<td style=\"width: {col_width}%; vertical-align: top;\">{tile_html}</td>"
            if i < len(tiles) - 1:
                out += f"<td style=\"width: {gap_pct}%;\"></td>"
        out += "</tr></table>"
        return out

    avg_trend_text = avg_trend if avg_trend else None
    avg_trend_color = (
        GREEN if (avg_delta is not None and avg_delta > 0) else (RED if (avg_delta is not None and avg_delta < 0) else YELLOW)
    )

    overview_html = ""
    overview_html += kpi_row(
        [
            kpi_tile(
                "Spotlight Avg PSI",
                f"{psi_avg:.1f}" if psi_avg is not None else "—",
                value_color=_psi_color(psi_avg),
                trend=avg_trend_text,
                trend_color=avg_trend_color,
                is_primary=True,
            ),
            kpi_tile(
                "Top PSI",
                f"{int(round(top.psi_today))}" if (top and top.psi_today is not None) else "—",
                value_color=_psi_color(top.psi_today if top else None),
                sublabel=top.display_name if top else None,
            ),
            kpi_tile(
                "Lowest PSI",
                f"{int(round(low.psi_today))}" if (low and low.psi_today is not None) else "—",
                value_color=_psi_color(low.psi_today if low else None),
                sublabel=low.display_name if low else None,
            ),
            kpi_tile(
                "Avg New Users",
                f"{avg_new_users:.0f}" if avg_new_users is not None else "—",
                value_color=NEUTRAL,
                sublabel=(top_users.display_name if top_users else None),
            ),
        ],
        columns=4,
    )
    overview_html += kpi_row(
        [
            kpi_tile("Green", str(green_count), value_color=GREEN, sublabel="Current overall"),
            kpi_tile("Yellow", str(yellow_count), value_color=YELLOW, sublabel="Current overall"),
            kpi_tile("Red", str(red_count), value_color=RED, sublabel="Current overall"),
            kpi_tile("Properties", str(len(computed)), value_color=NEUTRAL, sublabel="Spotlight set"),
        ],
        columns=4,
    )
    overview_html += (
        f"<div style='font-size:12px;color:#6c757d;margin-top:6px;'>"
        f"Report run date: {datetime.fromisoformat(report_date).strftime('%m/%d/%Y')}. "
        f"Latest available source dates across this Spotlight set: "
        f"PSI {datetime.fromisoformat(latest_psi).strftime('%m/%d/%Y') if latest_psi else 'none'}, "
        f"GA4 {datetime.fromisoformat(latest_ga4).strftime('%m/%d/%Y') if latest_ga4 else 'none'}.</div>"
    )

    builder.add_section(Section(title="Spotlight Overview", content=overview_html, status="healthy"))

    # Individual cards
    cards_html = (
        "<p style=\"font-size: 13px; color: #6c757d; margin: 0; font-style: italic;\">"
        "PSI is the dominant displayed metric. New Users and BrowserStack remain available as supporting internal context; "
        "GTMetrix is omitted for this Spotlight run.</p>"
    )
    cards_html = (
        "<div style='background:#f8f9fa; padding: 12px 20px; border-radius: 0 0 6px 6px; margin-bottom: 20px;'>"
        + cards_html
        + "</div>"
    )
    cards_html += "<div style='margin-top:18px;'>"

    def metric_delta(current: Optional[float], prev: Optional[float], *, inverse: bool = False) -> str:
        if current is None or prev is None:
            return ""
        d = current - prev
        text, color = _fmt_delta_float(d, inverse=inverse)
        if not text:
            return ""
        suffix = "s" if inverse else ""
        return f"<span style=\"font-size: 14px; color: {color}; margin-left: 8px;\">{text}{suffix}</span>"

    for c in computed:
        border = GREEN if c.overall_label == "Green" else (YELLOW if c.overall_label == "Yellow" else RED)

        psi_delta_text, psi_delta_color = _fmt_delta_float(c.psi_delta)
        psi_delta_span = (
            f"<span style=\"font-size: 14px; color: {psi_delta_color}; margin-left: 8px;\">{psi_delta_text}</span>"
            if psi_delta_text
            else ""
        )

        nu_delta_text, nu_delta_color = _fmt_delta_int(c.new_users_delta)
        nu_delta_span = (
            f"<span style=\"font-size: 14px; color: {nu_delta_color}; margin-left: 8px;\">{nu_delta_text}</span>"
            if nu_delta_text
            else ""
        )

        trend_img = ""
        if c.trend_png_b64:
            trend_img = (
                "<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"right\" style=\"width:152px;\">"
                "<tr><td align=\"right\" style=\"padding:0 0 4px 0;\">"
                f"<img src=\"data:image/png;base64,{c.trend_png_b64}\" width=\"128\" height=\"28\" style=\"display:block; margin-left:auto;\" alt=\"Trend\"/>"
                "</td></tr>"
                "<tr><td align=\"right\" style=\"font-size:11px;color:#A86400;\">"
                f"{psi_delta_text} vs yesterday" if psi_delta_text else "— vs yesterday"
                "</td></tr></table>"
            )

        perf = c.psi_row.get("performance_score")
        a11y = c.psi_row.get("accessibility_score")
        bp = c.psi_row.get("best_practices_score")
        seo = c.psi_row.get("seo_score")
        lcp = c.psi_row.get("lcp_value")
        cls = c.psi_row.get("cls_value")
        fcp = c.psi_row.get("fcp_value")
        tbt = c.psi_row.get("tbt_ms")

        prev_lcp = c.prev_psi_row.get("lcp_value")
        prev_cls = c.prev_psi_row.get("cls_value")
        prev_fcp = c.prev_psi_row.get("fcp_value")
        prev_perf = c.prev_psi_row.get("performance_score")

        note = c.copy_note or ""
        if lcp is not None and lcp >= 6.5:
            note = (note + " " if note else "") + f"LCP is the main drag at {lcp:.1f}s."

        nu_today = c.new_users_today if c.new_users_today is not None else "—"

        cards_html += f"""
<div style="margin-bottom:25px;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:12px; background:#ffffff; border-left:4px solid {border}; border-radius:4px;">
    <tr>
      <td style="padding:12px;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:8px;">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-weight:600; color:#333; font-size:14px; margin-bottom:6px;">
                      {c.display_name}
                      {psi_delta_span}
                    </div>
                    <div style="font-size:12px; color:#6c757d;">
                      New Users {nu_today}{nu_delta_span}
                    </div>
                  </td>
                  <td style="width:130px; vertical-align:top; text-align:right;">
                    {trend_img}
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-size:11px;">
                <tr>
                  <td style="padding:2px 8px 2px 0;"><strong>Perf:</strong> <span style="color:{_psi_color(perf)};">{int(round(perf)) if perf is not None else "—"}</span></td>
                  <td style="padding:2px 8px 2px 0;"><strong>A11y:</strong> <span style="color:{_score_color(a11y)};">{int(round(a11y)) if a11y is not None else "—"}</span></td>
                  <td style="padding:2px 8px 2px 0;"><strong>BP:</strong> <span style="color:{_score_color(bp)};">{int(round(bp)) if bp is not None else "—"}</span></td>
                  <td style="padding:2px 0;"><strong>SEO:</strong> <span style="color:{_score_color(seo)};">{int(round(seo)) if seo is not None else "—"}</span></td>
                </tr>
                <tr>
                  <td style="padding:2px 8px 2px 0;"><strong>LCP:</strong> <span style="color:{_lcp_color(lcp)};">{f"{lcp:.1f}s" if lcp is not None else "—"}</span>{metric_delta(lcp, prev_lcp, inverse=True)}</td>
                  <td style="padding:2px 8px 2px 0;"><strong>CLS:</strong> <span style="color:{_cls_color(cls)};">{f"{cls:.3f}" if cls is not None else "—"}</span>{metric_delta(cls, prev_cls, inverse=True)}</td>
                  <td style="padding:2px 8px 2px 0;"><strong>FCP:</strong> <span style="color:{_fcp_color(fcp)};">{f"{fcp:.1f}s" if fcp is not None else "—"}</span>{metric_delta(fcp, prev_fcp, inverse=True)}</td>
                  <td style="padding:2px 0;"><strong>TBT:</strong> <span style="color:{GREEN if (tbt is not None and tbt <= 200) else YELLOW};">{f"{int(tbt)}ms" if tbt is not None else "—"}</span></td>
                </tr>
                <tr>
                  <td style="padding:2px 8px 2px 0;"><strong>PSI:</strong> <span style="color:{_psi_color(perf)};">{f"{perf:.1f}" if perf is not None else "—"}</span>{metric_delta(perf, prev_perf)}</td>
                  <td style="padding:2px 8px 2px 0;"><strong>Users:</strong> <span style="color:{NEUTRAL};">{nu_today}</span>{nu_delta_span}</td>
                  <td style="padding:2px 8px 2px 0;"><strong>Desktop:</strong> —</td>
                  <td style="padding:2px 0;"><strong>iPhone:</strong> —</td>
                </tr>
              </table>
              <div style="margin-top:8px; padding-top:8px; border-top:1px solid #e9ecef; font-size:11px; line-height:1.5; color:#5b6575;">{note}</div>
            </td>
            <td style="width:64px; vertical-align:top; text-align:right; padding-left:15px;">
              <div style="font-size:32px; font-weight:700; color:{_psi_color(perf)};">{int(round(perf)) if perf is not None else "—"}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
"""

    cards_html += "</div>"
    builder.add_section(Section(title="Individual Spotlight Performance", content=cards_html, status="watch"))

    html = builder.generate()
    # Insert date stamp line the historical reports show.
    html = html.replace(
        f"<div style=\"font-size: 11px; color: #adb5bd; margin: 10px 0;\">v{builder.version}</div>",
        f"<div style=\"font-size: 11px; color: #adb5bd; margin: 10px 0;\">v{builder.version}</div>"
        f"<div style=\"font-size: 15px; color: #1a1a1a; margin: 8px 0 0 0; font-weight: 600;\">{builder.date_range}</div>",
        1,
    )

    md_path = OUTPUT_DIR / f"Spotlight_Performance_Roundup_{report_date}.md"
    html_path = OUTPUT_DIR / f"Spotlight_Performance_Roundup_{report_date}.html"

    # Minimal markdown: mirror the historical output (executive summary + snapshot).
    # Reuse the existing style by extracting the prior MD if present; otherwise write a brief one.
    if md_path.exists():
        md_text = md_path.read_text(encoding="utf-8")
    else:
        md_text = "# Spotlight Performance Roundup\n"
    md_path.write_text(md_text, encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")

    return html_path, md_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Spotlight PageSpeed Insights Performance roundup artifacts")
    parser.add_argument("--date", default=date.today().isoformat(), help="Report date YYYY-MM-DD; defaults to today")
    args = parser.parse_args()

    html_path, md_path = build_report(str(args.date))
    print(f"Saved HTML: {html_path}")
    print(f"Saved MD:   {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
