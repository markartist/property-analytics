from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
REPORTS = ROOT / "pilot_control_cwv" / "reports"
STAMP = datetime.now().strftime("%Y-%m-%d")
MATRIX_JSON = REPORTS / f"calais_cross_source_matrix_{STAMP}.json"
WORKBOOK = REPORTS / f"Pilot_Diagnostic_Package_{STAMP}.xlsx"
OUTPUT = REPORTS / f"pilot_diagnostic_email_preview_{STAMP}.html"


def load_payload() -> dict:
    return json.loads(MATRIX_JSON.read_text())


def build_html() -> str:
    payload = load_payload()
    reports = {r["property_name"]: r for r in payload["reports"]}
    district = reports["The District Universal Boulevard"]
    harrison = reports["The Harrison"]
    calais = reports["Calais Midtown"]
    friendly_date = datetime.now().strftime("%B %-d, %Y")

    findings_html = "".join(
        f'<li style="margin:0 0 8px 0;">{finding}</li>' for finding in payload["findings"]
    )

    return f"""<!doctype html>
<html>
<head><meta charset="utf-8" /><title>Pilot Diagnostic Memo</title></head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:Calibri,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8fb;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1020px;background:#ffffff;">
          <tr>
            <td style="padding:24px 28px 10px 28px;">
              <div style="font-size:30px;line-height:34px;font-weight:700;color:#0f172a;">Pilot Diagnostic Executive Memo</div>
              <div style="font-size:16px;line-height:22px;color:#64748b;padding-top:4px;">{friendly_date}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 18px 28px;font-size:15px;line-height:22px;color:#334155;">
              This diagnostic package compares <strong>Calais Midtown</strong>, <strong>The District Universal Boulevard</strong>, and <strong>The Harrison</strong> across GA4, GSC, PSI / GTMetrix, BrowserStack / EVS, and the structural comparator audit. The companion Excel workbook is attached.
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <div style="font-size:18px;line-height:22px;font-weight:700;color:#0f172a;padding-bottom:8px;">Executive Summary</div>
              <div style="font-size:14px;line-height:21px;color:#334155;">
                District is the strongest attribution / classification concern. Harrison is the strongest discoverability concern. Calais is the best operational comparator, but not a perfect SEO control because GA4 and GSC still diverge there as well.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <div style="font-size:18px;line-height:22px;font-weight:700;color:#0f172a;padding-bottom:8px;">What We Can Say Confidently</div>
              <ul style="margin:0;padding-left:18px;font-size:14px;line-height:21px;color:#334155;">
                {findings_html}
              </ul>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <div style="font-size:18px;line-height:22px;font-weight:700;color:#0f172a;padding-bottom:8px;">Key Evidence</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:10px;border:1px solid #D8DFEA;background:#F8FAFD;font-weight:700;color:#15284B;">District</td>
                  <td style="padding:10px;border:1px solid #D8DFEA;font-size:14px;color:#334155;">
                    GA4 organic 30d: <strong>{district['ga_30d_organic']:,}</strong> vs prior <strong>{district['ga_30d_organic_prev']:,}</strong><br/>
                    GSC clicks 30d: <strong>{district['gsc_30d_clicks']:,}</strong> vs prior <strong>{district['gsc_30d_clicks_prev']:,}</strong><br/>
                    GSC impressions 30d: <strong>{district['gsc_30d_impressions']:,}</strong> vs prior <strong>{district['gsc_30d_impressions_prev']:,}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px;border:1px solid #D8DFEA;background:#F8FAFD;font-weight:700;color:#15284B;">Harrison</td>
                  <td style="padding:10px;border:1px solid #D8DFEA;font-size:14px;color:#334155;">
                    GA4 organic 30d: <strong>{harrison['ga_30d_organic']:,}</strong> vs prior <strong>{harrison['ga_30d_organic_prev']:,}</strong><br/>
                    GSC clicks 30d: <strong>{harrison['gsc_30d_clicks']:,}</strong> vs prior <strong>{harrison['gsc_30d_clicks_prev']:,}</strong><br/>
                    PSI performance: <strong>{harrison['psi_performance']}</strong> | GTMetrix: <strong>{harrison['gt_score']:.1f}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px;border:1px solid #D8DFEA;background:#F8FAFD;font-weight:700;color:#15284B;">Calais</td>
                  <td style="padding:10px;border:1px solid #D8DFEA;font-size:14px;color:#334155;">
                    GA4 organic 30d: <strong>{calais['ga_30d_organic']:,}</strong> vs prior <strong>{calais['ga_30d_organic_prev']:,}</strong><br/>
                    GSC clicks 30d: <strong>{calais['gsc_30d_clicks']:,}</strong> vs prior <strong>{calais['gsc_30d_clicks_prev']:,}</strong><br/>
                    Apartments internal links: <strong>{calais['apartments_internal_links']}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <div style="font-size:18px;line-height:22px;font-weight:700;color:#0f172a;padding-bottom:8px;">Recommended Next Actions</div>
              <ul style="margin:0;padding-left:18px;font-size:14px;line-height:21px;color:#334155;">
                <li>SEO: Compare GSC page-level performance for homepage, apartments listing, and unit-detail templates.</li>
                <li>Analytics: Validate District source classification by comparing Organic vs Direct vs Referral shifts over the same window.</li>
                <li>Web: Diff apartments / floorplan template output, canonical behavior, and internal-link modules.</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;font-size:14px;line-height:20px;color:#475569;">
              Attachment: <strong>{WORKBOOK.name}</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def main() -> None:
    OUTPUT.write_text(build_html())
    print(OUTPUT)


if __name__ == "__main__":
    main()
