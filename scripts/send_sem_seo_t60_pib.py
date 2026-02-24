#!/usr/bin/env python3
"""
Send SEM/SEO T60 portfolio audit in PIB-style email format.
"""

from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import sys

ROOT = Path("/Users/mark/Property_Analytics")
REPORT_DIR = ROOT / "reports" / "audits"

sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "utils"))
sys.path.insert(0, str(ROOT / "Property_Intelligence_Brief"))
from utils.email_sender import EmailSender  # noqa: E402
from templates.executive_email_template import generate_email_section_header  # noqa: E402
from templates.executive_template import VENTERRA_BLUE, get_logo_html  # noqa: E402


def latest_audit_csv() -> Path:
    files = sorted(REPORT_DIR.glob("sem_seo_t60_audit_*.csv"))
    if not files:
        raise FileNotFoundError("No sem_seo_t60_audit CSV found")
    return files[-1]


def load_rows(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def status_counts(rows: List[Dict[str, str]], key: str) -> Dict[str, int]:
    out = {"improved": 0, "mixed": 0, "declined": 0, "insufficient_data": 0}
    for r in rows:
        out[r.get(key, "insufficient_data")] = out.get(r.get(key, "insufficient_data"), 0) + 1
    return out


def table_rows(rows: List[Dict[str, str]]) -> str:
    html = []
    for r in rows:
        sem_status = r.get("sem_status", "n/a")
        seo_status = r.get("seo_status", "n/a")
        sem_color = "#28a745" if sem_status == "improved" else "#dc3545" if sem_status == "declined" else "#ffc107" if sem_status == "mixed" else "#6c757d"
        seo_color = "#28a745" if seo_status == "improved" else "#dc3545" if seo_status == "declined" else "#ffc107" if seo_status == "mixed" else "#6c757d"
        html.append(
            f"""
            <tr>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;">{r.get('request_name','')}</td>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;">{r.get('property_name','')}</td>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;">{r.get('sem_source','')}</td>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;color:{sem_color};font-weight:700;">{sem_status}</td>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;color:{seo_color};font-weight:700;">{seo_status}</td>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;">{r.get('sem_how','')}</td>
              <td style="padding:10px;border-bottom:1px solid #e9ecef;">{r.get('seo_how','')}</td>
            </tr>
            """
        )
    return "".join(html)


def build_html(rows: List[Dict[str, str]], csv_name: str) -> str:
    sem = status_counts(rows, "sem_status")
    seo = status_counts(rows, "seo_status")
    generated = datetime.now().strftime("%B %d, %Y %I:%M %p")
    logo = get_logo_html() or ""
    sem_source_split = {
        "google_ads": sum(1 for r in rows if r.get("sem_source") == "google_ads"),
        "ga4_paid_search_proxy": sum(1 for r in rows if r.get("sem_source") == "ga4_paid_search_proxy"),
    }
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1100px;margin:0 auto;background:#ffffff;">
<tr><td style="padding:30px 24px;">
{logo}
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;">
  <tr><td style="text-align:center;">
    <div style="color:{VENTERRA_BLUE};font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Property Intelligence Brief</div>
    <h1 style="margin:8px 0 4px 0;color:{VENTERRA_BLUE};font-size:28px;">Portfolio SEM/SEO T60 Audit</h1>
    <div style="color:#6c757d;font-size:13px;">Generated {generated}</div>
  </td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0;border:3px solid {VENTERRA_BLUE};border-radius:8px;">
  <tr><td style="background:{VENTERRA_BLUE};padding:14px 18px;"><h2 style="margin:0;color:#fff;font-size:20px;text-align:center;">Executive At-a-Glance</h2></td></tr>
  <tr><td style="padding:20px;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="width:50%;padding:6px 10px;"><div style="font-size:11px;color:#868e96;text-transform:uppercase;">SEM Improved</div><div style="font-size:22px;font-weight:700;">{sem.get('improved',0)}/{len(rows)}</div></td>
        <td style="width:50%;padding:6px 10px;"><div style="font-size:11px;color:#868e96;text-transform:uppercase;">SEO Improved</div><div style="font-size:22px;font-weight:700;">{seo.get('improved',0)}/{len(rows)}</div></td>
      </tr>
      <tr>
        <td style="width:50%;padding:6px 10px;"><div style="font-size:11px;color:#868e96;text-transform:uppercase;">SEM Coverage</div><div style="font-size:15px;font-weight:600;">Google Ads: {sem_source_split['google_ads']} | GA4 Paid Search Proxy: {sem_source_split['ga4_paid_search_proxy']}</div></td>
        <td style="width:50%;padding:6px 10px;"><div style="font-size:11px;color:#868e96;text-transform:uppercase;">Companion CSV</div><div style="font-size:15px;font-weight:600;">{csv_name}</div></td>
      </tr>
    </table>
  </td></tr>
</table>

{generate_email_section_header("Search Performance", "SEMrush T60 vs previous T60 directional movement", "ok")}
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:12px;font-size:13px;">
  <tr style="background:#f8f9fa;">
    <th style="padding:10px;text-align:left;">Requested Name</th>
    <th style="padding:10px;text-align:left;">Matched Property</th>
    <th style="padding:10px;text-align:left;">SEM Source</th>
    <th style="padding:10px;text-align:left;">SEM Status</th>
    <th style="padding:10px;text-align:left;">SEO Status</th>
    <th style="padding:10px;text-align:left;">SEM How</th>
    <th style="padding:10px;text-align:left;">SEO How</th>
  </tr>
  {table_rows(rows)}
</table>

{generate_email_section_header("Ad Performance", "Paid search trend from Google Ads where mapped; GA4 Paid Search proxy otherwise", "ok")}
<div style="padding:14px 6px 0 6px;font-size:13px;color:#333;line-height:1.6;">
  <ul style="margin:0;padding-left:18px;">
    <li>Direct Google Ads mappings exist for 2 properties (CoHo, Villa Lago).</li>
    <li>Remaining 7 properties use GA4 Paid Search proxy for directional SEM trend until Ads mapping is onboarded.</li>
    <li>Status labels are directional, not forecasted outcomes.</li>
  </ul>
</div>

{generate_email_section_header("Confidence & Data Integrity", "Data coverage, caveats, and interpretation safeguards", "ok")}
<div style="padding:14px 6px 0 6px;font-size:13px;color:#333;line-height:1.6;">
  <ul style="margin:0;padding-left:18px;">
    <li>SEMrush history now includes monthly snapshots back to March 2025 for these properties.</li>
    <li>Previous-T60 SEO baseline is monthly-grain (snapshot-based), so movement is directional rather than daily-granular.</li>
    <li>Three early Botanic monthly snapshots were unavailable from SEMrush API response.</li>
  </ul>
</div>

<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;font-style:italic;text-align:center;">
PIB-style portfolio brief generated from unified data sources.
</div>

</td></tr></table></body></html>"""


def send_pib_email(csv_path: Path) -> Path:
    rows = load_rows(csv_path)
    html = build_html(rows, csv_path.name)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = REPORT_DIR / f"sem_seo_t60_pib_{ts}.html"
    html_path.write_text(html, encoding="utf-8")

    sender = EmailSender(verbose=True)
    sender.send_email(
        subject=f"PIB — Portfolio SEM/SEO T60 Audit ({datetime.now().strftime('%Y-%m-%d')})",
        html_body=html,
        recipients=["mlaufhutte@venterraliving.com"],
        attachments=[
            (csv_path.name, csv_path.read_bytes(), "text/csv"),
            (html_path.name, html_path.read_bytes(), "text/html"),
        ],
    )
    return html_path


def main() -> int:
    csv_path = latest_audit_csv()
    rows = load_rows(csv_path)
    _ = rows  # keep local flow explicit for CLI path
    html_path = send_pib_email(csv_path)
    print(f"PIB_HTML: {html_path}")
    print(f"CSV: {csv_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
