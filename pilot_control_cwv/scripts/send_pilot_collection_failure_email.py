#!/usr/bin/env python3
"""
Send an immediate alert when the pilot morning workflow cannot produce fresh data.
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


def send_failure_alert(stage: str, report_date: str, details: str) -> bool:
    sender = EmailSender(verbose=True)
    subject = f"CRITICAL: Consolidated Morning Failure Alert - Pilot {stage} - {report_date}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937;">
        <p><strong>Fresh pilot morning data was not available.</strong></p>
        <ul>
          <li>Date: {report_date}</li>
          <li>Failed stage: {stage}</li>
        </ul>
        <p>The workflow retried automatically and still could not produce a complete fresh cohort.</p>
        <pre style="white-space: pre-wrap; font-family: Menlo, Consolas, monospace; background: #f3f4f6; padding: 12px; border-radius: 6px;">{details}</pre>
        <p>No stale fallback exports should be trusted for this date until the failing stage is rerun successfully.</p>
      </body>
    </html>
    """
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{report_date}.jsonl"
    sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        plain_text=f"Fresh pilot morning data unavailable for {report_date}.\nStage: {stage}\n\n{details}",
        recipients=[
            "mlaufhutte@venterraliving.com",
        ],
        log_path=log_path,
    )
    print(f"✅ Pilot collection failure alert sent for {report_date} ({stage})")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Send pilot collection failure alert email")
    parser.add_argument("--stage", required=True, help="Failing stage label")
    parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"), help="Metric date YYYY-MM-DD")
    parser.add_argument("--details", required=True, help="Details to include in the alert")
    args = parser.parse_args()
    return 0 if send_failure_alert(args.stage, args.date, args.details) else 1


if __name__ == "__main__":
    raise SystemExit(main())
