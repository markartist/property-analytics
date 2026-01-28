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

def main():
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
    
    try:
        sender = EmailSender()
        print(f"\n📤 Sending email...")
        print(f"   To: {', '.join(sender.default_recipients)}")
        print(f"   Subject: {subject}")
        
        sender.send_email(
            subject=subject,
            html_body=html_content,
            recipients=None  # Use default from config
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
