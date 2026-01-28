#!/usr/bin/env python3
"""
The Hotlist Email Sender
=========================
Sends The Hotlist (Focus + Spotlight showcase) via email using SMTP.

Usage:
    python3 send_hotlist_email.py [--report-html PATH]
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
from utils.email_sender import EmailSender


class HotlistEmailer:
    """Sends The Hotlist via email"""
    
    def __init__(self):
        # Create unified email sender (reads REPORT_RECIPIENTS from config)
        self.email_sender = EmailSender(verbose=False)
        self.recipients = self.email_sender.recipients
    
    def send_report(self, html_path: Optional[str] = None):
        """
        Send The Hotlist email
        
        Args:
            html_path: Path to HTML file. If None, uses latest report.
        """
        # Load report
        if not html_path:
            # Find latest showcase
            reports_dir = Path(__file__).parent.parent / 'reports' / 'focus_report'
            latest_dir = max(reports_dir.glob('*'), key=lambda p: p.name)
            html_path = latest_dir / 'focus_vs_spotlight_showcase.html'
        
        print(f"Loading report from: {html_path}")
        with open(html_path, 'r') as f:
            html_content = f.read()
        
        # Extract date from filename or use current date
        report_date = datetime.now().strftime('%B %d, %Y')
        
        # Create subject
        subject = f"🔥 The Hotlist — {report_date}"
        
        # Send email via unified sender
        print(f"Sending The Hotlist to: {', '.join(self.recipients)}")
        
        try:
            self.email_sender.send_email(
                subject=subject,
                html_body=html_content,
                recipients=self.recipients
            )
            
            print("✅ The Hotlist email sent successfully!")
            
        except Exception as e:
            print(f"❌ Failed to send email: {e}")
            sys.exit(1)


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Send The Hotlist via email')
    parser.add_argument('--report-html', help='Path to existing HTML report (optional)')
    args = parser.parse_args()
    
    emailer = HotlistEmailer()
    emailer.send_report(html_path=args.report_html)


if __name__ == '__main__':
    main()
