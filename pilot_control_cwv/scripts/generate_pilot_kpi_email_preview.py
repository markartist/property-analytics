from __future__ import annotations

from datetime import datetime
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
REPORTS = ROOT / "pilot_control_cwv" / "reports"
PANELS = REPORTS / "email_panels"
STAMP = datetime.now().strftime("%Y-%m-%d")
OUTPUT_PATH = REPORTS / f"pilot_kpi_email_preview_{STAMP}.html"


def html_img(path: Path, alt: str) -> str:
    return f'<img src="{path.as_uri()}" alt="{alt}" style="display:block;width:100%;max-width:980px;height:auto;border:0;" />'


def resolve_workbook(stamp: str) -> Path:
    preferred = REPORTS / f"Pilot_KPI_Summary_Details_Full_{stamp}.xlsx"
    if preferred.exists():
        return preferred
    legacy = REPORTS / f"Pilot_KPI_Combined_Prototype_{stamp}.xlsx"
    if legacy.exists():
        return legacy
    return preferred


def build_section(title: str, body: str, path: Path, alt: str) -> str:
    return f"""
          <tr>
            <td style="padding:0 28px 18px 28px;">
              <div style="font-size:18px;line-height:22px;font-weight:700;color:#0f172a;padding-bottom:8px;">{title}</div>
              <div style="font-size:14px;line-height:20px;color:#334155;padding-bottom:10px;">
                {body}
              </div>
              {html_img(path, alt)}
            </td>
          </tr>"""


def build_html() -> str:
    workbook = resolve_workbook(STAMP)
    technical = PANELS / f"technical_health_panel_{STAMP}.png"
    traffic = PANELS / f"traffic_and_engagement_panel_{STAMP}.png"
    funnel = PANELS / f"funnel_quality_panel_{STAMP}.png"
    actions = PANELS / f"conversion_actions_panel_{STAMP}.png"

    friendly_date = datetime.now().strftime("%B %-d, %Y")
    sections: list[str] = []

    if technical.exists():
        sections.append(
            build_section(
                "Technical Health",
                "Core Web Vitals are included below using the latest pilot-versus-paired-sister trend window in the workbook.",
                technical,
                "Technical Health",
            )
        )
    if traffic.exists():
        sections.append(
            build_section(
                "Traffic & Engagement",
                "Organic share, organic volume, and high-intent fields reflect the latest Measurement workbook daily tab currently available.",
                traffic,
                "Traffic and Engagement",
            )
        )
    if funnel.exists():
        sections.append(
            build_section(
                "Funnel Quality",
                "Website-conversion funnel metrics are sourced directly from the latest BI report, with blanks left blank where the source file is incomplete.",
                funnel,
                "Funnel Quality",
            )
        )
    if actions.exists():
        sections.append(
            build_section(
                "Conversion Actions",
                "Action-oriented conversion metrics are included below from the same BI source package as the workbook attachment.",
                actions,
                "Conversion Actions",
            )
        )

    if not sections:
        sections.append(
            """
          <tr>
            <td style="padding:0 28px 24px 28px;font-size:14px;line-height:21px;color:#334155;">
              This preview includes the current workbook attachment only. Same-day inline panel PNGs are not available for this run.
            </td>
          </tr>"""
        )

    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pilot KPI Daily Report</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:Calibri, Arial, sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8fb;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1020px;background:#ffffff;">
          <tr>
            <td style="padding:24px 28px 10px 28px;">
              <div style="font-size:30px;line-height:34px;font-weight:700;color:#0f172a;">Pilot KPI Daily Report</div>
              <div style="font-size:16px;line-height:22px;color:#64748b;padding-top:4px;">{friendly_date}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 14px 28px;font-size:15px;line-height:22px;color:#334155;">
              Attached is today&apos;s pilot KPI workbook covering the five pilot properties and their paired sister properties.
              This version reflects the latest available BI and Measurement sources, with source gaps left blank rather than inferred.
            </td>
          </tr>
{''.join(sections)}
          <tr>
            <td style="padding:0 28px 28px 28px;font-size:14px;line-height:20px;color:#475569;">
              Attachment: <strong>{workbook.name}</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def main() -> None:
    OUTPUT_PATH.write_text(build_html())
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
