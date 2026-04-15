#!/usr/bin/env python3
from __future__ import annotations

import json
import smtplib
import sys
import uuid
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
CONFIG_PATH = ROOT / "credentials" / "email_config.json"
REPORTS_DIR = ROOT / "pilot_control_cwv" / "reports"
PANELS_DIR = REPORTS_DIR / "email_panels"


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def resolve_workbook(stamp: str) -> Path:
    preferred = REPORTS_DIR / f"Pilot_KPI_Summary_Details_Full_{stamp}.xlsx"
    if preferred.exists():
        return preferred
    legacy = REPORTS_DIR / f"Pilot_KPI_Combined_Prototype_{stamp}.xlsx"
    if legacy.exists():
        return legacy
    raise FileNotFoundError(f"Missing workbook for {stamp}: {preferred.name}")


def build_paths(stamp: str) -> dict[str, Path]:
    return {
        "workbook": resolve_workbook(stamp),
        "technical": PANELS_DIR / f"technical_health_panel_{stamp}.png",
        "traffic": PANELS_DIR / f"traffic_and_engagement_panel_{stamp}.png",
        "funnel": PANELS_DIR / f"funnel_quality_panel_{stamp}.png",
        "actions": PANELS_DIR / f"conversion_actions_panel_{stamp}.png",
    }


def validate_paths(paths: dict[str, Path]) -> None:
    if not paths["workbook"].exists():
        raise FileNotFoundError(f"Missing required workbook: {paths['workbook']}")


def existing_panel_keys(paths: dict[str, Path]) -> list[str]:
    return [key for key in ("technical", "traffic", "funnel", "actions") if paths[key].exists()]


def build_section(title: str, body: str, cid: str, alt: str) -> str:
    return f"""
          <tr>
            <td style="padding:0 28px 18px 28px;">
              <div style="font-size:18px;line-height:22px;font-weight:700;color:#0f172a;padding-bottom:8px;">{title}</div>
              <div style="font-size:14px;line-height:20px;color:#334155;padding-bottom:10px;">
                {body}
              </div>
              <img src="cid:{cid}" alt="{alt}" style="display:block;width:100%;max-width:980px;height:auto;border:0;" />
            </td>
          </tr>"""


def build_html(stamp: str, paths: dict[str, Path], cids: dict[str, str], panel_keys: list[str]) -> str:
    friendly_date = datetime.strptime(stamp, "%Y-%m-%d").strftime("%B %-d, %Y")
    sections: list[str] = []

    if "technical" in panel_keys:
        sections.append(
            build_section(
                "Technical Health",
                "Core Web Vitals are included below using the latest pilot-versus-paired-sister trend window in the workbook.",
                cids["technical"],
                "Technical Health",
            )
        )
    if "traffic" in panel_keys:
        sections.append(
            build_section(
                "Traffic & Engagement",
                "Organic share, organic volume, and high-intent fields reflect the latest Measurement workbook daily tab currently available.",
                cids["traffic"],
                "Traffic and Engagement",
            )
        )
    if "funnel" in panel_keys:
        sections.append(
            build_section(
                "Funnel Quality",
                "Website-conversion funnel metrics are sourced directly from the latest BI report, with blanks left blank where the source file is incomplete.",
                cids["funnel"],
                "Funnel Quality",
            )
        )
    if "actions" in panel_keys:
        sections.append(
            build_section(
                "Conversion Actions",
                "Action-oriented conversion metrics are included below from the same BI source package as the workbook attachment.",
                cids["actions"],
                "Conversion Actions",
            )
        )

    if not sections:
        sections.append(
            """
          <tr>
            <td style="padding:0 28px 24px 28px;font-size:14px;line-height:21px;color:#334155;">
              This send includes the current workbook as the source-of-truth attachment. Same-day inline panel PNGs are not available for this run, so the workbook is the primary deliverable.
            </td>
          </tr>"""
        )

    return f"""<html>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:Calibri,Arial,sans-serif;color:#0f172a;">
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
              Attachment: <strong>{paths['workbook'].name}</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_plain_text(stamp: str, workbook_name: str) -> str:
    return (
        f"Pilot KPI Daily Report - {stamp}\n\n"
        "Attached is today's pilot KPI workbook covering the five pilot properties and their paired sister properties.\n"
        "Included: Core Web Vitals, organic traffic, and BI funnel metrics.\n"
        "Source gaps remain blank rather than inferred.\n\n"
        f"Attachment: {workbook_name}\n"
    )


def send_test_email(stamp: str | None = None, recipients: list[str] | None = None) -> bool:
    if stamp is None:
        stamp = datetime.now().strftime("%Y-%m-%d")
    config = load_config()
    recipients = recipients or config.get("default_recipients") or [config["sender_email"]]

    paths = build_paths(stamp)
    validate_paths(paths)
    panel_keys = existing_panel_keys(paths)

    cids = {
        "technical": f"technical-{uuid.uuid4().hex}",
        "traffic": f"traffic-{uuid.uuid4().hex}",
        "funnel": f"funnel-{uuid.uuid4().hex}",
        "actions": f"actions-{uuid.uuid4().hex}",
    }

    msg = MIMEMultipart("related")
    msg["Subject"] = f"Pilot KPI Daily Report | {datetime.strptime(stamp, '%Y-%m-%d').strftime('%B %-d, %Y')} [TEST]"
    sender_email = config["sender_email"]
    display_name = config.get("sender_display_name")
    msg["From"] = formataddr((display_name, sender_email)) if display_name else sender_email
    msg["To"] = ", ".join(recipients)
    msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S %z")

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(build_plain_text(stamp, paths["workbook"].name), "plain"))
    alt.attach(MIMEText(build_html(stamp, paths, cids, panel_keys), "html"))
    msg.attach(alt)

    for key in panel_keys:
        img_part = MIMEImage(paths[key].read_bytes(), _subtype="png")
        img_part.add_header("Content-ID", f"<{cids[key]}>")
        img_part.add_header("Content-Disposition", "inline", filename=paths[key].name)
        msg.attach(img_part)

    attachment = MIMEApplication(paths["workbook"].read_bytes(), _subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    attachment.add_header("Content-Disposition", "attachment", filename=paths["workbook"].name)
    msg.attach(attachment)

    smtp_server = config.get("smtp_server", "email-smtp.us-east-1.amazonaws.com")
    smtp_port = config.get("smtp_port", 587)
    smtp_username = config.get("smtp_username", sender_email)
    smtp_password = config.get("smtp_password", config.get("sender_password"))
    if not smtp_password:
        raise RuntimeError("Missing SMTP password in email config")

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg, to_addrs=recipients)

    print(f"Sent test email to: {', '.join(recipients)}")
    print(f"Workbook: {paths['workbook']}")
    return True


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Send pilot KPI test email with optional inline PNG panels.")
    parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"))
    parser.add_argument("--recipients", help="Comma-separated recipients; defaults to email config recipients")
    args = parser.parse_args()

    recipients = [r.strip() for r in args.recipients.split(",")] if args.recipients else None
    ok = send_test_email(stamp=args.date, recipients=recipients)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
