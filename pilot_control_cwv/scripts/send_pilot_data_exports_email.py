#!/usr/bin/env python3
"""
Email the latest pilot CSV exports.
"""

from __future__ import annotations

import sys
import re
from datetime import datetime
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT / "utils"))
from email_sender import EmailSender
from specialty_email_policy import specialty_summary_emails_enabled
from summary_email_guard import successful_delivery_exists

DOWNLOADS = Path("/Users/mark/Downloads")
DELIVERY_LOG_DIR = ROOT / "logs" / "email_delivery"


def display_date(value: str | None) -> str | None:
    if not value:
        return None
    for pattern in ("%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, pattern).strftime("%m/%d/%Y")
        except ValueError:
            continue
    return value


def log_date_key(value: str) -> str:
    for pattern in ("%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, pattern).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return value.replace("/", "-")


def latest_dated_export_date(prefix: str) -> str | None:
    pattern = re.compile(rf"^{re.escape(prefix)}_(\d{{4}}-\d{{2}}-\d{{2}})\.csv$")
    dated_paths = []
    for path in DOWNLOADS.glob(f"{prefix}_*.csv"):
        match = pattern.match(path.name)
        if match:
            dated_paths.append((match.group(1), path))
    if not dated_paths:
        return None
    dated_paths.sort(key=lambda item: item[0])
    return dated_paths[-1][0]


def build_attachments() -> list[tuple[str, bytes, str]]:
    attachment_paths = [
        DOWNLOADS / "PSI_Day_Over_Day_Scores_latest.csv",
        DOWNLOADS / "GTMetrix_Daily_Scores_latest.csv",
    ]
    attachments: list[tuple[str, bytes, str]] = []
    for path in attachment_paths:
        if not path.exists():
            raise FileNotFoundError(f"Expected export not found: {path}")
        attachments.append((path.name, path.read_bytes(), "text/csv"))
    return attachments


def send_pilot_data_exports(
    report_date: str | None = None,
    *,
    force: bool = False,
    dry_run: bool = False,
) -> bool:
    if report_date is None:
        report_date = datetime.now().strftime("%m/%d/%Y")

    psi_date = latest_dated_export_date("PSI_Day_Over_Day_Scores")
    gt_date = latest_dated_export_date("GTMetrix_Daily_Scores")
    report_display_date = display_date(report_date) or report_date
    psi_display_date = display_date(psi_date) or "date unavailable"
    gt_display_date = display_date(gt_date) or "date unavailable"
    subject = f"Pilot Data Exports - {report_display_date}"
    legacy_subject = f"Pilot Data Exports - {report_display_date.replace('/', '-')}"
    log_date = log_date_key(report_date)
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{log_date}.jsonl"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937;">
        <p>Pilot CSV exports for {report_display_date} are attached.</p>
        <ul>
          <li>PSI Day-over-Day Scores ({psi_display_date})</li>
          <li>GTMetrix Daily Scores ({gt_display_date})</li>
        </ul>
        <p style="font-size: 13px; color: #4b5563;">
          Attachments reflect the exact dated files listed above. Fresh same-day data is required before these exports are sent.
        </p>
      </body>
    </html>
    """

    if dry_run:
        attachments = build_attachments()
        print("Dry run only (no email sent)")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        for filename, content, mime_type in attachments:
            print(f"Attachment: {filename} ({len(content)} bytes, {mime_type})")
        return True

    if not force and not specialty_summary_emails_enabled():
        print("Pilot data exports email suppressed by policy; exports remain on disk for retrieval")
        print(f"Expected PSI date: {psi_display_date}")
        print(f"Expected GTMetrix date: {gt_display_date}")
        return True

    if not force and successful_delivery_exists(log_path, subject, alternate_subjects=[legacy_subject]):
        print("Pilot data exports email already delivered successfully for this date; skipping duplicate send")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return True

    sender = EmailSender(verbose=True)
    sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        recipients=[
            "mlaufhutte@venterraliving.com",
            "cgriffin@venterraliving.com",
        ],
        attachments=build_attachments(),
        log_path=log_path,
    )
    print(f"✅ Pilot data exports email sent for {report_display_date}")
    return True


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Email pilot CSV exports")
    parser.add_argument("--date", help="Display date MM/DD/YYYY; defaults to today")
    parser.add_argument("--force", action="store_true", help="Send even if specialty summary emails are suppressed")
    parser.add_argument("--dry-run", action="store_true", help="Validate without sending")
    args = parser.parse_args()
    report_date = args.date or datetime.now().strftime("%m/%d/%Y")
    return 0 if send_pilot_data_exports(report_date, force=args.force, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(main())
