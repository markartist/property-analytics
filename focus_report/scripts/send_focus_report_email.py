#!/usr/bin/env python3
"""
Focus Report Email Sender v0.1
===============================
Sends Focus Report via email using SMTP.

Contract: docs/FOCUS_REPORT_CONTRACT.md v0.1

Usage:
    python3 send_focus_report_email.py [--report-html PATH]
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add parent directory to path for shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'Portfolio_Dashboard' / 'utils'))
from preflight import validate_credential_file

# Add for unified email sender
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from Data_Collection.utils.email_sender import EmailSender

from generate_focus_report import FocusReportGenerator


class FocusReportEmailer:
    """Sends Focus Report via email"""
    
    def __init__(self):
        # Support multiple recipients (comma-separated)
        recipient_str = os.getenv('REPORT_RECIPIENT_EMAIL', 'mlaufhutte@venterraliving.com')
        self.recipients = [email.strip() for email in recipient_str.split(',')]
        
        # Create unified email sender
        self.email_sender = EmailSender(verbose=False)
    
    def send_report(self, html_path: Optional[str] = None):
        """
        Send Focus Report email
        
        Args:
            html_path: Path to HTML file. If None, generates new report.
        """
        # Generate or load report
        if html_path:
            print(f"Loading report from: {html_path}")
            with open(html_path, 'r') as f:
                html_content = f.read()
            report_date = datetime.now().strftime('%B %d, %Y')
        else:
            print("Generating fresh Focus Report...")
            generator = FocusReportGenerator()
            payload = generator.generate_report_payload()
            html_content = generator.render_html(payload)
            html_path, json_path = generator.save_report(payload, html_content)
            report_date = datetime.fromisoformat(payload['report_date']).strftime('%B %d, %Y')
        
        # Create subject
        subject = f"Venterra Living Focus Report — {report_date}"
        
        # Send email via unified sender
        print(f"Sending Focus Report to: {', '.join(self.recipients)}")
        
        try:
            self.email_sender.send_email(
                subject=subject,
                html_body=html_content,
                recipients=self.recipients
            )
            
            print("✅ Focus Report email sent successfully!")
            
        except Exception as e:
            print(f"❌ Failed to send email: {e}")
            sys.exit(1)


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Send Focus Report via email')
    parser.add_argument('--report-html', help='Path to existing HTML report (optional)')
    args = parser.parse_args()
    
    emailer = FocusReportEmailer()
    emailer.send_report(html_path=args.report_html)


if __name__ == '__main__':
    main()
