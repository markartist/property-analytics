#!/usr/bin/env python3
"""Outlook-safe Venterra executive report renderer."""

from __future__ import annotations

import html
from dataclasses import dataclass, field
from datetime import datetime
from typing import Sequence

from report_builder import VENTERRA_LOGO_BASE64


BRAND = {
    "navy": "#15284B",
    "san_marino": "#3D66B9",
    "bay": "#294782",
    "indigo": "#5A81CF",
    "monte_carlo": "#7DCAC2",
    "pink": "#E02472",
    "white_smoke": "#F6F6F5",
    "terra_cotta": "#BD4830",
    "quill": "#D6D6D2",
    "blue_chill": "#3B9189",
    "delta": "#9B9B96",
    "black": "#000000",
    "white": "#FFFFFF",
}


@dataclass(frozen=True)
class ReportKpi:
    label: str
    value: str
    note: str | None = None
    primary: bool = False


@dataclass(frozen=True)
class ReportTable:
    title: str
    columns: list[tuple[str, str]]
    rows: list[dict[str, object]]
    intro: str | None = None
    limit: int | None = None


@dataclass(frozen=True)
class ReportSection:
    title: str
    paragraphs: list[str] = field(default_factory=list)
    tables: list[ReportTable] = field(default_factory=list)
    callout: str | None = None
    warning: str | None = None


@dataclass(frozen=True)
class OutlookReport:
    title: str
    subtitle: str
    version: str
    date_range: str
    generated_at: str
    question_answered: str
    kpis: list[ReportKpi]
    sections: list[ReportSection]
    source_note: str


def esc(value: object) -> str:
    return html.escape("" if value is None else str(value))


def _p(text: str) -> str:
    return (
        f'<p style="font-size:13px;line-height:1.45;color:{BRAND["black"]};'
        f'margin:0 0 12px 0;">{esc(text)}</p>'
    )


def _kpi_tile(kpi: ReportKpi) -> str:
    border = f"2px solid {BRAND['san_marino']}" if kpi.primary else f"1px solid {BRAND['quill']}"
    label_color = BRAND["san_marino"] if kpi.primary else BRAND["delta"]
    note_html = ""
    if kpi.note:
        note_html = (
            f'<div style="font-size:11px;line-height:1.3;color:{BRAND["delta"]};'
            f'margin-top:8px;">{esc(kpi.note)}</div>'
        )
    return f"""
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:{border};background:{BRAND['white']};">
        <tr>
          <td style="padding:20px 12px;text-align:center;height:112px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:11px;color:{label_color};text-transform:uppercase;letter-spacing:0;font-weight:700;margin-bottom:10px;">{esc(kpi.label)}</div>
            <div style="font-size:32px;line-height:1;color:{BRAND['black']};font-weight:700;">{esc(kpi.value)}</div>
            {note_html}
          </td>
        </tr>
      </table>
    """


def _kpi_row(kpis: Sequence[ReportKpi]) -> str:
    if not kpis:
        return ""
    width = 100 // len(kpis)
    cells: list[str] = []
    for index, kpi in enumerate(kpis):
        cells.append(f'<td style="width:{width}%;vertical-align:top;">{_kpi_tile(kpi)}</td>')
        if index < len(kpis) - 1:
            cells.append('<td style="width:2%;font-size:1px;line-height:1px;">&nbsp;</td>')
    return f"""
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0 0 26px 0;">
        <tr>{''.join(cells)}</tr>
      </table>
    """


def _data_table(table: ReportTable) -> str:
    rows = table.rows[: table.limit] if table.limit else table.rows
    head = "".join(
        f'<th style="text-align:left;padding:9px 8px;background:{BRAND["white_smoke"]};border:1px solid {BRAND["quill"]};font-size:11px;color:{BRAND["navy"]};font-weight:700;">{esc(label)}</th>'
        for _, label in table.columns
    )
    body_rows: list[str] = []
    for row_index, row in enumerate(rows):
        bg = BRAND["white_smoke"] if row_index % 2 else BRAND["white"]
        cells = "".join(
            f'<td style="padding:8px;border:1px solid {BRAND["quill"]};font-size:11px;color:{BRAND["black"]};vertical-align:top;background:{bg};">{esc(row.get(key, "-"))}</td>'
            for key, _ in table.columns
        )
        body_rows.append(f"<tr>{cells}</tr>")
    intro_html = _p(table.intro) if table.intro else ""
    return f"""
      {intro_html}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 4px 0;">
        <tr>{head}</tr>
        {''.join(body_rows)}
      </table>
    """


def _section(section: ReportSection) -> str:
    callout = ""
    if section.callout:
        callout = f"""
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:{BRAND['white_smoke']};border:1px solid {BRAND['quill']};border-left:5px solid {BRAND['blue_chill']};margin:0 0 16px 0;">
            <tr><td style="padding:13px 14px;font-size:13px;line-height:1.45;color:{BRAND['black']};font-family:Arial,Helvetica,sans-serif;">{esc(section.callout)}</td></tr>
          </table>
        """
    warning = ""
    if section.warning:
        warning = f"""
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:{BRAND['white']};border:1px solid {BRAND['quill']};border-left:4px solid {BRAND['terra_cotta']};margin:12px 0 0 0;">
            <tr><td style="padding:12px 14px;font-size:12px;line-height:1.45;color:{BRAND['bay']};font-family:Arial,Helvetica,sans-serif;">{esc(section.warning)}</td></tr>
          </table>
        """
    paragraphs = "".join(_p(item) for item in section.paragraphs)
    tables = "".join(_data_table(table) for table in section.tables)
    return f"""
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:26px 0 0 0;">
        <tr>
          <td style="background:{BRAND['navy']};padding:14px 18px;font-family:Arial,Helvetica,sans-serif;">
            <h2 style="font-size:20px;color:{BRAND['white']};margin:0;font-weight:700;">{esc(section.title)}</h2>
          </td>
        </tr>
        <tr>
          <td style="background:{BRAND['white']};border:1px solid {BRAND['quill']};border-top:0;padding:18px;font-family:Arial,Helvetica,sans-serif;">
            {callout}
            {paragraphs}
            {tables}
            {warning}
          </td>
        </tr>
      </table>
    """


def render_outlook_report(report: OutlookReport) -> str:
    generated = report.generated_at or datetime.now().strftime("%Y-%m-%d %H:%M")
    sections = "".join(_section(section) for section in report.sections)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{esc(report.title)}</title>
</head>
<body style="margin:0;padding:20px;background:{BRAND['white_smoke']};font-family:Arial,Helvetica,sans-serif;color:{BRAND['black']};">
  <table cellpadding="0" cellspacing="0" border="0" align="center" width="720" style="width:720px;max-width:720px;margin:0 auto;background:{BRAND['white']};">
    <tr>
      <td style="padding:30px 40px 42px 40px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;text-align:center;border-bottom:2px solid {BRAND['quill']};margin:0 0 28px 0;">
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;">
              <img src="data:image/png;base64,{VENTERRA_LOGO_BASE64}" alt="Venterra" style="height:15px;width:auto;display:inline-block;border:0;margin:0 0 22px 0;">
              <div style="font-size:16px;color:{BRAND['san_marino']};font-weight:700;text-transform:uppercase;margin:0 0 20px 0;">{esc(report.subtitle)}</div>
              <div style="font-size:34px;line-height:1.12;color:{BRAND['black']};font-weight:700;margin:0;">{esc(report.title)}</div>
              <div style="font-size:11px;color:{BRAND['delta']};margin:20px 0 0 0;font-weight:700;">v{esc(report.version)}</div>
              <div style="font-size:14px;color:{BRAND['delta']};margin:14px 0 0 0;font-weight:700;">{esc(report.date_range)} - Generated {esc(generated)}</div>
            </td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:{BRAND['white_smoke']};border:1px solid {BRAND['quill']};border-left:5px solid {BRAND['blue_chill']};margin:0 0 24px 0;">
          <tr><td style="padding:13px 14px;font-size:14px;line-height:1.45;color:{BRAND['black']};font-family:Arial,Helvetica,sans-serif;"><strong style="color:{BRAND['navy']};">Question answered:</strong> {esc(report.question_answered)}</td></tr>
        </table>
        {_kpi_row(report.kpis)}
        {sections}
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:24px 0 0 0;border-top:1px solid {BRAND['quill']};">
          <tr><td style="padding:12px 0 0 0;font-size:11px;line-height:1.45;color:{BRAND['delta']};font-family:Arial,Helvetica,sans-serif;"><strong>Sources:</strong> {esc(report.source_note)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
