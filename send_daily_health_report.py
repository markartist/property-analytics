#!/usr/bin/env python3
"""
Daily Portfolio Health Report Email Sender
===========================================

Sends the most recent Daily Portfolio Health Report via email.

Usage:
    python3 send_daily_health_report.py [--date YYYY-MM-DD]

Author: Mark Laufhutte / Atlas
Date: 2026-01-27
"""

import sys
from datetime import datetime
from pathlib import Path

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent / "utils"))
from email_sender import EmailSender


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Email Daily Portfolio Health Report")
    parser.add_argument('--date', help='Report date (YYYY-MM-DD), defaults to today')
    
    args = parser.parse_args()
    
    # Determine report date
    if args.date:
        report_date = datetime.strptime(args.date, "%Y-%m-%d")
    else:
        report_date = datetime.now()
    
    date_str = report_date.strftime("%Y-%m-%d")
    
    # Find report file
    report_dir = Path(__file__).parent / "reports" / "daily_health"
    report_file = report_dir / f"Portfolio_Health_Daily_{date_str}.html"
    
    if not report_file.exists():
        print(f"❌ Report not found: {report_file}")
        print(f"   Generate it first with: python3 generate_daily_portfolio_health.py")
        return 1
    
    # Send email
    print(f"📧 Sending Daily Portfolio Health Report for {date_str}...")
    
    try:
        # Read HTML content
        with open(report_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Send email
        sender = EmailSender(verbose=True)
        sender.send_email(
            subject=f"Portfolio Health Daily - {date_str}",
            html_body=html_content,
            recipients=["mlaufhutte@venterraliving.com"]
        )
        
        print(f"✅ Daily Health Report emailed successfully!")
        print(f"   Report: {report_file.name}")
        print(f"   Sent to: mlaufhutte@venterraliving.com")
        
        return 0
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
