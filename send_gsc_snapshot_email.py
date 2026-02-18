#!/usr/bin/env python3
"""
Send Portfolio GSC Snapshot via Email
======================================

Sends the GSC Snapshot HTML report and Excel attachment via email.

Usage:
    python3 send_gsc_snapshot_email.py [--date YYYY-MM-DD]
"""

import sys
from pathlib import Path
from datetime import datetime

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent / "utils"))
from email_sender import EmailSender

# Configuration
REPORTS_DIR = Path(__file__).parent / "reports" / "gsc_snapshot"


def send_gsc_snapshot_email(report_date: str = None):
    """Send GSC Snapshot report via email"""
    
    # Determine date
    if report_date is None:
        report_date = datetime.now().strftime("%Y-%m-%d")
    
    # Locate files
    html_file = REPORTS_DIR / f"Portfolio_GSC_Snapshot_{report_date}.html"
    excel_file = REPORTS_DIR / f"Portfolio_GSC_Snapshot_{report_date}.xlsx"
    
    # Check files exist
    if not html_file.exists():
        print(f"❌ HTML report not found: {html_file}")
        print(f"   Run: python3 generate_gsc_snapshot.py --date {report_date}")
        return False
    
    if not excel_file.exists():
        print(f"❌ Excel file not found: {excel_file}")
        print(f"   Run: python3 generate_gsc_snapshot.py --date {report_date}")
        return False
    
    # Read HTML report
    with open(html_file, 'r', encoding='utf-8') as f:
        html_body = f.read()
    
    # Read Excel file
    with open(excel_file, 'rb') as f:
        excel_content = f.read()
    
    # Prepare email
    subject = f"Portfolio Google Search Console Snapshot - {report_date}"
    
    # Prepare attachment
    attachments = [
        (excel_file.name, excel_content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ]
    
    # Send email
    print(f"\n{'='*70}")
    print(f"SENDING PORTFOLIO GSC SNAPSHOT")
    print(f"{'='*70}\n")
    
    sender = EmailSender()
    
    try:
        sender.send_email(
            subject=subject,
            html_body=html_body,
            attachments=attachments,
            recipients=["mlaufhutte@venterraliving.com"]
        )
        
        print(f"\n✅ Portfolio GSC Snapshot email sent successfully!")
        print(f"   Report Date: {report_date}")
        print(f"   Attachment: {excel_file.name}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Failed to send email: {e}")
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Send GSC Snapshot Report via Email")
    parser.add_argument('--date', help='Report date (YYYY-MM-DD), defaults to today')
    
    args = parser.parse_args()
    
    success = send_gsc_snapshot_email(args.date)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
