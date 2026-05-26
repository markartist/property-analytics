#!/usr/bin/env python3
"""Generate the pilot performance roundup view for the current Spotlight 11."""

from __future__ import annotations

import argparse
import html
import json
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT / "pilot_roundup" / "scripts"))

import generate_pilot_roundup as pilot_roundup  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
IDENTITY_MATRIX = ROOT / "config" / "property_identity_matrix.json"
OUTPUT_DIR = ROOT / "pilot_roundup" / "reports" / "spotlight"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SPOTLIGHT_11_CODES = [
    "TX416",  # Avasa at 1604
    "FL4TA",  # The Anatole
    "GA4BL",  # Botanic Luxury
    "TX4CO",  # College View
    "KY4TG",  # The Reserves of Thomas Glen
    "FL4GW",  # Avasa Grove West
    "FL4HL",  # Avasa Hammock Landing
    "KY4MP",  # The Metropolitan
    "TX4FV",  # Forest View
    "TX4GM",  # The Retreat
    "KY4SC",  # Steeplechase
]

DISPLAY_NAMES = {
    "TX416": "1604",
    "FL4TA": "Anatole Daytona",
    "GA4BL": "Botanic",
    "TX4CO": "College View",
    "KY4TG": "Thomas Glen",
    "FL4GW": "Grove West",
    "FL4HL": "Hammock Landing",
    "KY4MP": "Metropolitan",
    "TX4FV": "Forest View",
    "TX4GM": "Retreat",
    "KY4SC": "Steeplechase",
}


def load_identity_by_code() -> Dict[str, dict]:
    matrix = json.loads(IDENTITY_MATRIX.read_text(encoding="utf-8"))
    return {
        row["property_code"]: row
        for row in matrix.get("properties", [])
        if row.get("property_code")
    }


def spotlight_entries() -> List[pilot_roundup.Entry]:
    by_code = load_identity_by_code()
    entries: List[pilot_roundup.Entry] = []
    missing: List[str] = []
    for code in SPOTLIGHT_11_CODES:
        row = by_code.get(code)
        if not row:
            missing.append(code)
            continue
        property_id = str(row.get("ga4_property_id") or "").strip()
        site_url = str(row.get("website_url") or "").strip()
        if not property_id or not site_url:
            missing.append(code)
            continue
        entries.append(
            pilot_roundup.Entry(
                key=f"spotlight_{code.lower()}",
                display_name=DISPLAY_NAMES.get(code) or row.get("property_name") or code,
                role="spotlight",
                property_id=property_id,
                site_url=site_url,
            )
        )
    if missing:
        raise SystemExit(f"Unable to resolve Spotlight identities: {', '.join(missing)}")
    return entries


def latest_date_for_table(conn: sqlite3.Connection, table: str, date_col: str, ids: List[str], id_col: str = "property_id") -> Optional[str]:
    placeholders = ",".join("?" for _ in ids)
    row = conn.execute(
        f"""
        SELECT MAX({date_col})
        FROM {table}
        WHERE {id_col} IN ({placeholders})
        """,
        ids,
    ).fetchone()
    return row[0] if row and row[0] else None


def data_date_line(conn: sqlite3.Connection, entries: List[pilot_roundup.Entry], report_date: str) -> str:
    ids = [entry.property_id for entry in entries]
    latest_psi = latest_date_for_table(conn, "pagespeed_metrics", "metric_date", ids)
    latest_ga = latest_date_for_table(conn, "ga4_daily_metrics", "metric_date", ids)
    return (
        f"Report run date: {report_date}. "
        f"Latest available source dates across this Spotlight set: "
        f"PSI {latest_psi or '-'}, GA4 {latest_ga or '-'}."
    )


def join_human(items: List[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def field_note(changed_fields: List[str]) -> str:
    fields = {item.strip().lower() for item in changed_fields if item.strip()}
    parts: List[str] = []
    if "hero" in fields or "upper_copy" in fields:
        parts.append("hero copy")
    if "romance" in fields:
        parts.append("romance copy")
    if "title" in fields and "meta" in fields:
        parts.append("title/meta")
    elif "title" in fields:
        parts.append("page title")
    elif "meta" in fields:
        parts.append("meta description")
    if "faq" in fields:
        parts.append("FAQ copy")
    if "og" in fields:
        parts.append("Open Graph metadata")
    return join_human(parts) or "copy"


def publish_date_label(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%m/%d/%Y")
    except ValueError:
        return value[:10]


def load_copy_change_notes(conn: sqlite3.Connection) -> Dict[str, str]:
    required_tables = {"copy_change_interventions", "copy_change_waves"}
    existing = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('copy_change_interventions', 'copy_change_waves')"
        ).fetchall()
    }
    if existing != required_tables:
        return {}
    rows = conn.execute(
        """
        SELECT
            cci.ga4_property_id,
            cci.publish_timestamp,
            cci.changed_fields_json,
            cci.confounds_json
        FROM copy_change_interventions cci
        INNER JOIN copy_change_waves ccw ON ccw.wave_id = cci.wave_id
        WHERE cci.status IN ('active', 'monitoring')
          AND ccw.status IN ('active', 'monitoring')
        ORDER BY cci.publish_timestamp DESC
        """
    ).fetchall()
    notes: Dict[str, str] = {}
    for row in rows:
        property_id = str(row["ga4_property_id"])
        if property_id in notes:
            continue
        try:
            confounds = json.loads(row["confounds_json"] or "{}")
        except json.JSONDecodeError:
            confounds = {}
        summary_note = confounds.get("summary_note")
        if isinstance(summary_note, str) and summary_note.strip():
            notes[property_id] = summary_note.strip()
            continue
        try:
            changed_fields = json.loads(row["changed_fields_json"] or "[]")
        except json.JSONDecodeError:
            changed_fields = []
        notes[property_id] = f"Updated {field_note(changed_fields)} on {publish_date_label(row['publish_timestamp'])}."
    return notes


def safe_best(properties: List[dict], field: str, reverse: bool = True) -> Optional[dict]:
    present = [p for p in properties if p.get(field) is not None]
    if not present:
        return None
    return sorted(present, key=lambda p: p[field], reverse=reverse)[0]


def sort_by_psi_desc(properties: List[dict]) -> List[dict]:
    return sorted(
        properties,
        key=lambda p: p.get("psi_today") if p.get("psi_today") is not None else -1,
        reverse=True,
    )


def psi_primary_performance_card(p: Dict[str, object]) -> str:
    today_metrics = p["psi_metrics_today"]
    prev_metrics = p["psi_metrics_yesterday"]

    def score_col(score: Optional[float]) -> str:
        return pilot_roundup.score_color(score)

    def lcp_col(val: Optional[float]) -> str:
        return pilot_roundup.threshold_color(val, 2.5, 4.0)

    def cls_col(val: Optional[float]) -> str:
        return pilot_roundup.threshold_color(val, 0.1, 0.25)

    def fcp_col(val: Optional[float]) -> str:
        return pilot_roundup.threshold_color(val, 1.8, 3.0)

    def tbt_col(val: Optional[float]) -> str:
        return pilot_roundup.threshold_color(val, 200, 600)

    lcp_delta = None
    cls_delta = None
    fcp_delta = None
    tbt_delta = None
    if today_metrics and prev_metrics:
        if today_metrics.get("lcp_value") is not None and prev_metrics.get("lcp_value") is not None:
            lcp_delta = today_metrics["lcp_value"] - prev_metrics["lcp_value"]
        if today_metrics.get("cls_value") is not None and prev_metrics.get("cls_value") is not None:
            cls_delta = today_metrics["cls_value"] - prev_metrics["cls_value"]
        if today_metrics.get("fcp_value") is not None and prev_metrics.get("fcp_value") is not None:
            fcp_delta = today_metrics["fcp_value"] - prev_metrics["fcp_value"]
        if today_metrics.get("tbt_value") is not None and prev_metrics.get("tbt_value") is not None:
            tbt_delta = today_metrics["tbt_value"] - prev_metrics["tbt_value"]

    psi_today_value = p.get("psi_today")
    headline_color = p.get("overall_color") or score_col(psi_today_value)

    psi_trend_values = [float(v) for v in p.get("psi_history", []) if v is not None]
    if len(psi_trend_values) < 2:
        if p.get("psi_yesterday") is not None:
            psi_trend_values.append(float(p["psi_yesterday"]))
        if p.get("psi_today") is not None:
            psi_trend_values.append(float(p["psi_today"]))
    trend_panel = pilot_roundup.metric_trend_block(psi_trend_values, p.get("psi_delta"), headline_color)
    diagnostic_reasons = pilot_roundup.build_diagnostic_reasons(today_metrics)
    copy_change_note = p.get("copy_change_note")
    if isinstance(copy_change_note, str) and copy_change_note.strip():
        diagnostic_reasons.insert(0, copy_change_note.strip())
    diagnostic_html = ""
    if diagnostic_reasons:
        diagnostic_html = (
            '<div style="margin-top:8px; padding-top:8px; border-top:1px solid #e9ecef; '
            'font-size:11px; line-height:1.5; color:#5b6575;">'
            + " ".join(html.escape(reason) for reason in diagnostic_reasons)
            + "</div>"
        )

    return f"""
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:12px; background:#ffffff; border-left:4px solid {headline_color}; border-radius:4px;">
        <tr>
            <td style="padding:12px;">
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                    <tr>
                        <td style="vertical-align:top;">
                            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:8px;">
                                <tr>
                                    <td style="vertical-align:top;">
                                        <div style="font-weight:600; color:#333; font-size:14px; margin-bottom:6px;">
                                            {p['property_name']}
                                            {pilot_roundup.format_portfolio_trend(p.get('psi_delta'), invert=False)}
                                        </div>
                                        <div style="font-size:12px; color:#6c757d;">
                                            New Users {pilot_roundup.fmt_int(p.get('new_users_today'))}{pilot_roundup.format_portfolio_trend(p.get('new_users_delta'), invert=False, digits=0)}
                                        </div>
                                    </td>
                                    <td style="width:130px; vertical-align:top; text-align:right;">
                                        {trend_panel}
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-size:11px;">
                                <tr>
                                    <td style="padding:2px 8px 2px 0;"><strong>Perf:</strong> <span style="color:{score_col(today_metrics.get('performance_score'))};">{pilot_roundup.fmt_num(today_metrics.get('performance_score'), 0) if today_metrics.get('performance_score') is not None else 'N/A'}</span></td>
                                    <td style="padding:2px 8px 2px 0;"><strong>A11y:</strong> <span style="color:{score_col(today_metrics.get('accessibility_score'))};">{pilot_roundup.fmt_num(today_metrics.get('accessibility_score'), 0) if today_metrics.get('accessibility_score') is not None else 'N/A'}</span></td>
                                    <td style="padding:2px 8px 2px 0;"><strong>BP:</strong> <span style="color:{score_col(today_metrics.get('best_practices_score'))};">{pilot_roundup.fmt_num(today_metrics.get('best_practices_score'), 0) if today_metrics.get('best_practices_score') is not None else 'N/A'}</span></td>
                                    <td style="padding:2px 0;"><strong>SEO:</strong> <span style="color:{score_col(today_metrics.get('seo_score'))};">{pilot_roundup.fmt_num(today_metrics.get('seo_score'), 0) if today_metrics.get('seo_score') is not None else 'N/A'}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 8px 2px 0;"><strong>LCP:</strong> <span style="color:{lcp_col(today_metrics.get('lcp_value'))};">{pilot_roundup.fmt_num(today_metrics.get('lcp_value')) if today_metrics.get('lcp_value') is not None else 'N/A'}{'' if today_metrics.get('lcp_value') is None else 's'}</span>{pilot_roundup.format_portfolio_trend(lcp_delta, invert=True, digits=1, suffix='s')}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>CLS:</strong> <span style="color:{cls_col(today_metrics.get('cls_value'))};">{pilot_roundup.fmt_num(today_metrics.get('cls_value'), 3) if today_metrics.get('cls_value') is not None else 'N/A'}</span>{pilot_roundup.format_portfolio_trend(cls_delta, invert=True, digits=3)}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>FCP:</strong> <span style="color:{fcp_col(today_metrics.get('fcp_value'))};">{pilot_roundup.fmt_num(today_metrics.get('fcp_value')) if today_metrics.get('fcp_value') is not None else 'N/A'}{'' if today_metrics.get('fcp_value') is None else 's'}</span>{pilot_roundup.format_portfolio_trend(fcp_delta, invert=True, digits=1, suffix='s')}</td>
                                    <td style="padding:2px 0;"><strong>TBT:</strong> <span style="color:{tbt_col(today_metrics.get('tbt_value'))};">{pilot_roundup.fmt_num(today_metrics.get('tbt_value'), 0) if today_metrics.get('tbt_value') is not None else 'N/A'}{'' if today_metrics.get('tbt_value') is None else 'ms'}</span>{pilot_roundup.format_portfolio_trend(tbt_delta, invert=True, digits=0, suffix='ms')}</td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 8px 2px 0;"><strong>PSI:</strong> <span style="color:{score_col(p.get('psi_today'))};">{pilot_roundup.fmt_num(p.get('psi_today'))}</span>{pilot_roundup.format_portfolio_trend(p.get('psi_delta'), invert=False)}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>Users:</strong> <span style="color:#333;">{pilot_roundup.fmt_int(p.get('new_users_today'))}</span>{pilot_roundup.format_portfolio_trend(p.get('new_users_delta'), invert=False, digits=0)}</td>
                                    <td style="padding:2px 8px 2px 0;"><strong>Desktop:</strong> {p.get('desktop_status')}</td>
                                    <td style="padding:2px 0;"><strong>iPhone:</strong> {p.get('iphone_status')}</td>
                                </tr>
                            </table>
                            {diagnostic_html}
                        </td>
                        <td style="width:64px; vertical-align:top; text-align:right; padding-left:15px;">
                            <div style="font-size:32px; font-weight:700; color:{headline_color};">
                                {pilot_roundup.fmt_num(psi_today_value, 0) if psi_today_value is not None else '-'}
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """


def build_report(report_date: str) -> tuple[Path, Path]:
    entries = spotlight_entries()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    desktop_status, iphone_status = pilot_roundup.load_browserstack_status()

    copy_change_notes = load_copy_change_notes(conn)
    properties = []
    for entry in entries:
        payload = pilot_roundup.build_legacy_property_payload(
            conn,
            entry,
            report_date=report_date,
            desktop_status=desktop_status,
            iphone_status=iphone_status,
        )
        payload["copy_change_note"] = copy_change_notes.get(entry.property_id)
        properties.append(payload)
    display_properties = sort_by_psi_desc(properties)

    data_note = data_date_line(conn, entries, report_date)
    conn.close()

    best_psi = safe_best(properties, "psi_today", reverse=True)
    worst_psi = safe_best(properties, "psi_today", reverse=False)
    strongest_traffic = safe_best(properties, "new_users_today", reverse=True)

    avg_psi = pilot_roundup.average_or_none([p.get("psi_today") for p in properties])
    avg_psi_prev = pilot_roundup.average_or_none([p.get("psi_yesterday") for p in properties])
    avg_psi_delta = avg_psi - avg_psi_prev if avg_psi is not None and avg_psi_prev is not None else None
    avg_users = pilot_roundup.average_or_none([p.get("new_users_today") for p in properties])
    green_count = sum(1 for p in properties if p["overall_label"] == "Green")
    yellow_count = sum(1 for p in properties if p["overall_label"] == "Yellow")
    red_count = sum(1 for p in properties if p["overall_label"] == "Red")

    overview_tiles = [
        pilot_roundup.KPITile(
            label="Spotlight Avg PSI",
            value=f"{avg_psi:.1f}" if avg_psi is not None else "-",
            trend=pilot_roundup.format_kpi_trend(avg_psi_delta, digits=1),
            is_primary=False,
            value_color_override=pilot_roundup.score_color(avg_psi),
        ),
        pilot_roundup.KPITile(
            label="Top PSI",
            value=pilot_roundup.fmt_num(best_psi["psi_today"], 0) if best_psi else "-",
            sublabel=best_psi["property_name"] if best_psi else None,
            value_color_override=pilot_roundup.score_color(best_psi["psi_today"]) if best_psi else pilot_roundup.SLATE,
        ),
        pilot_roundup.KPITile(
            label="Lowest PSI",
            value=pilot_roundup.fmt_num(worst_psi["psi_today"], 0) if worst_psi else "-",
            sublabel=worst_psi["property_name"] if worst_psi else None,
            value_color_override=pilot_roundup.score_color(worst_psi["psi_today"]) if worst_psi else pilot_roundup.SLATE,
        ),
        pilot_roundup.KPITile(
            label="Avg New Users",
            value=f"{avg_users:.0f}" if avg_users is not None else "-",
            sublabel=strongest_traffic["property_name"] if strongest_traffic else None,
            is_primary=False,
        ),
    ]
    status_tiles = [
        pilot_roundup.KPITile(
            label="Green",
            value=str(green_count),
            sublabel="Current overall",
            value_color_override=pilot_roundup.SUCCESS_GREEN,
        ),
        pilot_roundup.KPITile(
            label="Yellow",
            value=str(yellow_count),
            sublabel="Current overall",
            value_color_override=pilot_roundup.WARNING_AMBER,
        ),
        pilot_roundup.KPITile(
            label="Red",
            value=str(red_count),
            sublabel="Current overall",
            value_color_override=pilot_roundup.RISK_RED,
        ),
        pilot_roundup.KPITile(label="Properties", value=str(len(properties)), sublabel="Spotlight set"),
    ]

    overview_html = (
        pilot_roundup.render_kpi_row(overview_tiles, columns=4)
        + pilot_roundup.render_kpi_row(status_tiles, columns=4)
        + f'<p style="font-size:13px;line-height:1.5;color:{pilot_roundup.SLATE};margin:8px 0 0 0;">{data_note}</p>'
    )

    executive_bullets = []
    if best_psi:
        executive_bullets.append(
            f"{best_psi['property_name']} is the strongest current Spotlight PSI mobile performer at {pilot_roundup.fmt_num(best_psi['psi_today'])}."
        )
    if worst_psi:
        executive_bullets.append(
            f"{worst_psi['property_name']} is the weakest current Spotlight PSI mobile performer at {pilot_roundup.fmt_num(worst_psi['psi_today'])}."
        )
    if strongest_traffic:
        executive_bullets.append(
            f"{strongest_traffic['property_name']} leads new-user volume with {pilot_roundup.fmt_int(strongest_traffic['new_users_today'])} latest-day new users."
        )

    performers_html = '<div style="margin-bottom:25px;">'
    for payload in display_properties:
        performers_html += psi_primary_performance_card(payload)
    performers_html += "</div>"

    diagnostics_html = pilot_roundup.diagnostic_summary_html(properties)
    methodology_html = """
    <ul style="margin:0; padding-left:18px; line-height:1.8; font-size:14px; color:#495057;">
        <li>This report reuses the Pilot Performance Roundup visual style for the governed Spotlight 11 property set.</li>
        <li>PSI mobile is the dominant displayed metric and is sourced from portfolio <code>pagespeed_metrics</code>.</li>
        <li>GTMetrix is intentionally omitted for this Spotlight run because current canonical GT coverage is incomplete for the set.</li>
        <li>New Users are sourced from GA4 daily metrics using governed GA4 property IDs.</li>
        <li>BrowserStack status is shown only where the latest EVS pilot smoke files contain a matching host; otherwise it is displayed as unavailable.</li>
    </ul>
    """

    builder = pilot_roundup.ReportBuilder(
        title="Spotlight Performance Roundup",
        subtitle="PageSpeed Insights Performance",
        version="1.0",
        date_range=datetime.now().strftime("%B %d, %Y %I:%M %p"),
    )
    builder.add_section(pilot_roundup.Section(title="Spotlight Overview", content=overview_html, status=None))
    builder.add_section(
        pilot_roundup.Section(
            title="Individual Spotlight Performance",
            content=performers_html,
            status=None,
            description="PSI is the dominant displayed metric. New Users and BrowserStack remain available as supporting internal context; GTMetrix is omitted for this Spotlight run.",
        )
    )
    builder.add_section(
        pilot_roundup.Section(
            title="Diagnostic Insights",
            content=diagnostics_html,
            status=None,
            description="Likely Lighthouse drivers behind the current Spotlight PSI scores",
        )
    )
    builder.add_section(
        pilot_roundup.Section(
            title="Methodology Notes",
            content=methodology_html,
            status=None,
            description="Data provenance and scope notes",
        )
    )

    html = builder.generate()
    display_date = datetime.strptime(report_date, "%Y-%m-%d").strftime("%m-%d-%Y")
    html = pilot_roundup.apply_custom_header(
        html,
        title="Spotlight Performance Roundup",
        subtitle="PageSpeed Insights Performance",
        version="1.0",
        report_display_date=display_date,
    )

    md_lines = [
        "# Spotlight Performance Roundup",
        "",
        f"- Generated: {datetime.now().strftime('%B %d, %Y %I:%M %p')}",
        f"- {data_note}",
        "",
        "## Executive Summary",
    ]
    md_lines.extend([f"- {bullet}" for bullet in executive_bullets])
    md_lines.extend(
        [
            "",
            "## Snapshot",
            "",
            "| Property | PSI Today | PSI Δ | New Users Today | New Users Δ | Desktop QA | iPhone QA | Overall |",
            "|---|---:|---:|---:|---:|---|---|---|",
        ]
    )
    for p in display_properties:
        md_lines.append(
            f"| {p['property_name']} | {pilot_roundup.fmt_num(p['psi_today'])} | {pilot_roundup.fmt_delta(p['psi_delta'])} | {pilot_roundup.fmt_int(p['new_users_today'])} | {pilot_roundup.fmt_delta(p['new_users_delta'], 0)} | {p['desktop_status']} | {p['iphone_status']} | {p['overall_label']} |"
        )
    copy_note_lines = [
        f"- {p['property_name']}: {p['copy_change_note']}"
        for p in display_properties
        if isinstance(p.get("copy_change_note"), str) and p["copy_change_note"].strip()
    ]
    if copy_note_lines:
        md_lines.extend(["", "## Copy Change Notes", ""])
        md_lines.extend(copy_note_lines)

    html_path = OUTPUT_DIR / f"Spotlight_Performance_Roundup_{report_date}.html"
    md_path = OUTPUT_DIR / f"Spotlight_Performance_Roundup_{report_date}.md"
    html_path.write_text(html, encoding="utf-8")
    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    return html_path, md_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the pilot performance view for the Spotlight 11.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Report date YYYY-MM-DD; defaults to today")
    args = parser.parse_args()
    html_path, md_path = build_report(args.date)
    print(f"Saved HTML: {html_path}")
    print(f"Saved MD:   {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
