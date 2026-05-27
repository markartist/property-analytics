#!/usr/bin/env python3
"""
Send a follow-up recovery notice when the pilot morning workflow later completes successfully.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
DELIVERY_LOG_DIR = ROOT / "logs" / "email_delivery"
sys.path.insert(0, str(ROOT / "utils"))
from email_sender import EmailSender


def display_date(value: str) -> str:
    for pattern in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(value, pattern).strftime("%m/%d/%Y")
        except ValueError:
            continue
    return value


def log_date_key(value: str) -> str:
    for pattern in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(value, pattern).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return value.replace("/", "-")


def send_recovery_email(
    report_date: str,
    failed_stage: str,
    completed_at: str,
    details: str,
) -> bool:
    sender = EmailSender(verbose=True)
    report_display_date = display_date(report_date)
    subject = f"RESOLVED: Pilot Morning Workflow Recovered - {report_display_date}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937;">
        <p><strong>The pilot morning workflow recovered later the same day.</strong></p>
        <ul>
          <li>Date: {report_display_date}</li>
          <li>Earlier alert stage: {failed_stage}</li>
          <li>Recovered at: {completed_at}</li>
        </ul>
        <p>Fresh same-day pilot data and outputs are now available. The earlier failure alert for this date no longer represents the final workflow state.</p>
        <pre style="white-space: pre-wrap; font-family: Menlo, Consolas, monospace; background: #f3f4f6; padding: 12px; border-radius: 6px;">{details}</pre>
      </body>
    </html>
    """
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{log_date_key(report_date)}.jsonl"
    sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        plain_text=(
            f"Pilot morning workflow recovered for {report_display_date}.\n"
            f"Earlier alert stage: {failed_stage}\n"
            f"Recovered at: {completed_at}\n\n{details}"
        ),
        recipients=["mlaufhutte@venterraliving.com"],
        log_path=log_path,
    )
    print(f"✅ Pilot collection recovery email sent for {report_display_date}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Send pilot collection recovery email")
    parser.add_argument("--date", default=datetime.now().strftime("%m/%d/%Y"), help="Metric date MM/DD/YYYY")
    parser.add_argument("--failed-stage", required=True, help="Earlier failing stage label")
    parser.add_argument("--completed-at", required=True, help="Recovery completion timestamp")
    parser.add_argument("--details", required=True, help="Recovery details")
    args = parser.parse_args()
    return 0 if send_recovery_email(args.date, args.failed_stage, args.completed_at, args.details) else 1


if __name__ == "__main__":
    raise SystemExit(main())
