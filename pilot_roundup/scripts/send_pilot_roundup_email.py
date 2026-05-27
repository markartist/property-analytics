#!/usr/bin/env python3
"""
Send Pilot Performance Roundup via email.
"""

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT / "utils"))
from email_sender import EmailSender
from specialty_email_policy import specialty_summary_emails_enabled
from summary_email_guard import successful_delivery_exists

REPORTS_DIR = ROOT / "pilot_roundup" / "reports"
DELIVERY_LOG_DIR = ROOT / "logs" / "email_delivery"
DOWNLOADS_DIR = Path("/Users/mark/Downloads")


def display_date(value: str) -> str:
    return datetime.strptime(value, "%Y-%m-%d").strftime("%m/%d/%Y")


def build_csv_attachments() -> list[tuple[str, bytes, str]]:
    attachment_paths = [
        DOWNLOADS_DIR / "PSI_Day_Over_Day_Scores_latest.csv",
        DOWNLOADS_DIR / "GTMetrix_Daily_Scores_latest.csv",
    ]
    attachments: list[tuple[str, bytes, str]] = []
    for path in attachment_paths:
        if not path.exists():
            raise FileNotFoundError(f"Expected CSV export not found: {path}")
        attachments.append((path.name, path.read_bytes(), "text/csv"))
    return attachments


def send_pilot_roundup_email(
    report_date: Optional[str] = None,
    *,
    force: bool = False,
    dry_run: bool = False,
) -> bool:
    if report_date is None:
        report_date = datetime.now().strftime("%Y-%m-%d")
    subject_date = display_date(report_date)

    html_file = REPORTS_DIR / f"Pilot_Performance_Roundup_{report_date}.html"
    if not html_file.exists():
        print(f"❌ HTML report not found: {html_file}")
        print(f"   Run: python3 {ROOT / 'pilot_roundup' / 'scripts' / 'generate_pilot_roundup.py'}")
        return False

    html_body = html_file.read_text(encoding="utf-8")
    attachments = build_csv_attachments()

    subject = f"Pilot Performance Roundup - {subject_date}"
    legacy_subject = f"Pilot Performance Roundup - {subject_date.replace('/', '-')}"
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{report_date}.jsonl"

    if dry_run:
        print("Dry run only (no email sent)")
        print(f"Report: {html_file}")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return True

    if not force and not specialty_summary_emails_enabled():
        print("Pilot roundup email suppressed by policy; artifact generated but not emailed")
        print(f"Report: {html_file}")
        return True

    if not force and successful_delivery_exists(log_path, subject, alternate_subjects=[legacy_subject]):
        print("Pilot roundup email already delivered successfully for this date; skipping duplicate send")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return True

    sender = EmailSender(verbose=True)
    sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        recipients=["mlaufhutte@venterraliving.com", "cgriffin@venterraliving.com"],
        attachments=attachments,
        log_path=log_path,
    )
    print(f"✅ Pilot roundup email sent for {subject_date}")
    return True


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Email Pilot Performance Roundup")
    parser.add_argument("--date", help="Report date YYYY-MM-DD; defaults to today")
    parser.add_argument("--force", action="store_true", help="Send even if specialty summary emails are suppressed")
    parser.add_argument("--dry-run", action="store_true", help="Validate without sending")
    args = parser.parse_args()

    return 0 if send_pilot_roundup_email(args.date, force=args.force, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(main())
