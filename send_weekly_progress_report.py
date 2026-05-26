#!/usr/bin/env python3
"""
Email sender for Weekly Portfolio Progress Report
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent / "utils"))
from email_sender import EmailSender
from summary_email_guard import successful_delivery_exists

DELIVERY_LOG_DIR = Path(__file__).parent / "logs" / "email_delivery"

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Email sender for Weekly Portfolio Progress Report")
    parser.add_argument("--force", action="store_true", help="Send even if this weekly summary was already delivered")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print details without sending")
    args = parser.parse_args()

    # Calculate report dates
    report_date = datetime.now()
    # Calculate start of week (previous Monday, not current day)
    # weekday() returns 0 for Monday
    days_since_monday = report_date.weekday()
    if days_since_monday == 0:
        # Today is Monday, use previous Monday
        week_start = report_date - timedelta(days=7)
    else:
        # Use most recent Monday
        week_start = report_date - timedelta(days=days_since_monday)
    date_str = report_date.strftime("%Y-%m-%d")

    # Find report file
    report_dir = Path(__file__).parent / "reports" / "weekly_progress"
    report_file = report_dir / f"Weekly_Progress_{week_start.strftime('%Y-%m-%d')}_to_{date_str}.html"

    if not report_file.exists():
        print(f"❌ Report file not found: {report_file}")
        print("   Run generate_weekly_progress_report.py first")
        sys.exit(1)

    print(f"📧 Sending Weekly Portfolio Progress Report for week ending {date_str}...")

    # Read report HTML
    with open(report_file, 'r') as f:
        html_content = f.read()

    # Send email
    subject = f"Weekly Portfolio Progress - Week of {week_start.strftime('%b %d, %Y')}"
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{date_str}.jsonl"

    if args.dry_run:
        print("Dry run only (no email sent)")
        print(f"Report: {report_file}")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return

    if not args.force and successful_delivery_exists(log_path, subject):
        print("Weekly progress report already delivered successfully for this date; skipping duplicate send")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return

    try:
        sender = EmailSender()
        print(f"\n📤 Sending email...")
        print(f"   To: {', '.join(sender.default_recipients)}")
        print(f"   Subject: {subject}")

        sender.send_email_with_tracking(
            subject=subject,
            html_body=html_content,
            recipients=None,  # Use default from config
            log_path=log_path,
        )

        print(f"✅ Email sent successfully!")
        print(f"   From: {sender.sender_email}")
        print(f"   To: {', '.join(sender.default_recipients)}")

        print(f"✅ Weekly Progress Report emailed successfully!")
        print(f"   Report: {report_file.name}")
        print(f"   Sent to: {', '.join(sender.default_recipients)}")

    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
