#!/usr/bin/env python3
"""
Render the two-property keyword deep dive as a PIB-style HTML report.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List

ROOT = Path("/Users/mark/Property_Analytics")
REPORT_DIR = ROOT / "reports" / "search_intelligence"
DEFAULT_BASE = "2026-04-14__cane-island__luma-headwaters__keyword-deep-dive"

import sys

sys.path.insert(0, str(ROOT / "Property_Intelligence_Brief"))
from templates.executive_email_template import generate_email_section_header  # noqa: E402
from templates.executive_template import VENTERRA_BLUE, get_logo_html  # noqa: E402


def inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text


def render_markdown_table(lines: List[str]) -> str:
    headers = [cell.strip() for cell in lines[0].strip().strip("|").split("|")]
    body_rows = lines[2:]
    thead = "".join(
        f'<th style="padding:10px;text-align:left;border-bottom:2px solid #d9dee5;background:#f8f9fb;color:#495057;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;">{inline(cell)}</th>'
        for cell in headers
    )
    rows_html = []
    for row in body_rows:
        cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
        cell_html = "".join(
            f'<td style="padding:10px;border-bottom:1px solid #edf1f5;font-size:13px;color:#2f3b45;vertical-align:top;">{inline(cell)}</td>'
            for cell in cells
        )
        rows_html.append(f"<tr>{cell_html}</tr>")
    return f'<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0 18px 0;"><tr>{thead}</tr>{"".join(rows_html)}</table>'


def render_body(markdown_text: str) -> str:
    lines = markdown_text.splitlines()
    output: List[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if stripped.startswith("|") and i + 2 < len(lines) and lines[i + 1].strip().startswith("|"):
            table_lines = [stripped]
            i += 1
            table_lines.append(lines[i].strip())
            i += 1
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            output.append(render_markdown_table(table_lines))
            continue

        if stripped.startswith("## "):
            output.append(
                generate_email_section_header(
                    stripped[3:].strip(),
                    "",
                    "ok",
                )
            )
            i += 1
            continue

        if stripped.startswith("### "):
            output.append(
                f'<h3 style="color:{VENTERRA_BLUE};font-size:24px;margin:24px 0 8px 0;">{inline(stripped[4:].strip())}</h3>'
            )
            i += 1
            continue

        if stripped.startswith("#### "):
            output.append(
                f'<h4 style="color:#495057;font-size:17px;margin:18px 0 8px 0;text-transform:none;">{inline(stripped[5:].strip())}</h4>'
            )
            i += 1
            continue

        if stripped.startswith("- "):
            bullets = []
            while i < len(lines) and lines[i].strip().startswith("- "):
                bullets.append(lines[i].strip()[2:])
                i += 1
            items = "".join(
                f'<li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">{inline(item)}</li>'
                for item in bullets
            )
            output.append(f'<ul style="margin:10px 0 16px 20px;padding:0;">{items}</ul>')
            continue

        if stripped.startswith("**") and stripped.endswith("**"):
            output.append(
                f'<p style="margin:10px 0;color:#6c757d;font-size:13px;">{inline(stripped)}</p>'
            )
            i += 1
            continue

        paragraph_lines = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or nxt.startswith(("#", "-", "|")):
                break
            paragraph_lines.append(nxt)
            i += 1
        output.append(
            f'<p style="margin:10px 0 14px 0;color:#2f3b45;font-size:14px;line-height:1.7;">{inline(" ".join(paragraph_lines))}</p>'
        )

    return "\n".join(output)


def build_html(markdown_text: str, payload: dict) -> str:
    generated = datetime.now().strftime("%B %d, %Y %I:%M %p")
    logo = get_logo_html() or ""
    property_names = ", ".join(prop["name"] for prop in payload.get("properties", []))
    competitor_sets = sum(len(prop.get("competitors_used", [])) for prop in payload.get("properties", []))
    properties_count = len(payload.get("properties", []))

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1120px;margin:0 auto;background:#ffffff;">
<tr><td style="padding:28px 24px;">
{logo}
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:18px;">
  <tr><td style="text-align:center;">
    <div style="color:{VENTERRA_BLUE};font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Property Intelligence</div>
    <h1 style="margin:8px 0 6px 0;color:{VENTERRA_BLUE};font-size:30px;line-height:1.2;">Keyword Performance Deep Dive</h1>
    <div style="color:#6c757d;font-size:14px;">{inline(property_names)} | Generated {generated}</div>
  </td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 24px 0;border:3px solid {VENTERRA_BLUE};border-radius:8px;">
  <tr><td style="background:{VENTERRA_BLUE};padding:14px 18px;">
    <h2 style="margin:0;color:#fff;font-size:20px;text-align:center;">Executive At-a-Glance</h2>
  </td></tr>
  <tr><td style="padding:18px;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="width:33.33%;padding:8px 10px;">
          <div style="font-size:11px;color:#868e96;text-transform:uppercase;">Properties Covered</div>
          <div style="font-size:28px;font-weight:700;color:#1f2933;">{properties_count}</div>
        </td>
        <td style="width:33.33%;padding:8px 10px;">
          <div style="font-size:11px;color:#868e96;text-transform:uppercase;">Competitor Sets Pulled</div>
          <div style="font-size:28px;font-weight:700;color:#1f2933;">{competitor_sets}</div>
        </td>
        <td style="width:33.33%;padding:8px 10px;">
          <div style="font-size:11px;color:#868e96;text-transform:uppercase;">Primary Story</div>
          <div style="font-size:17px;font-weight:700;color:#1f2933;">Brand strength, non-brand gap</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

{render_body(markdown_text)}

<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;font-style:italic;text-align:center;">
PIB-style search intelligence brief generated from live SEMrush and local marketing warehouse data.
</div>

</td></tr></table>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate PIB-style HTML for the keyword deep dive.")
    parser.add_argument("--base-name", default=DEFAULT_BASE)
    args = parser.parse_args()

    md_path = REPORT_DIR / f"{args.base_name}.md"
    json_path = REPORT_DIR / f"{args.base_name}.json"
    html_path = REPORT_DIR / f"{args.base_name}__pib_style.html"

    markdown_text = md_path.read_text(encoding="utf-8")
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    html_text = build_html(markdown_text, payload)
    html_path.write_text(html_text, encoding="utf-8")

    print(f"HTML: {html_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
