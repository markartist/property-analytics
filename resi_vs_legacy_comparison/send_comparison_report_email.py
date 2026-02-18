#!/usr/bin/env python3
"""
Resi vs Legacy Comparison - Email Sender
==========================================
Sends the latest executive comparison report via email with HTML attachment.

Usage:
    python3 send_comparison_report_email.py
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent for unified email sender
sys.path.insert(0, str(Path(__file__).parent.parent))
from Data_Collection.utils.email_sender import EmailSender



class ComparisonReportEmailer:
    """Sends Resi vs Legacy comparison report via email"""
    
    def __init__(self):
        self.recipients = ['marklaufhutte@gmail.com']
        
        # Create unified email sender
        self.email_sender = EmailSender(verbose=False)
        
        # Report paths
        self.report_dir = Path(__file__).parent / 'reports' / datetime.now().strftime('%Y-%m-%d')
        self.html_report_path = self.report_dir / 'resi_vs_legacy_comparison.html'
        self.excel_report_path = self.report_dir / 'resi_vs_legacy_comparison.xlsx'
    
    def _create_plain_text_body(self) -> str:
        """Create plain text email body for email clients that don't support HTML"""
        return """
Atlas — Resi vs Legacy Executive Comparison Report

EXECUTIVE QUESTION
When organic demand exists, do Resi sites convert traffic more efficiently than Legacy sites?

KEY FINDINGS (30-DAY ROLLING)
• Conversion-Eligible Properties: N=3 Resi vs N=13 Legacy (≥300 GSC clicks)
• SERP CTR: Resi 5.79% vs Legacy 10.93% → Legacy stronger
• Engagement Rate: Resi 59.0% vs Legacy 61.8% → Legacy stronger

CONCLUSION
Legacy sites demonstrate stronger conversion efficiency across both metrics when organic demand exists.

REPORT SPECS
• Data Window: GA4 (2025-12-23 to 2026-01-22), GSC (2025-12-21 to 2026-01-20)
• Controlled Comparison: Identical volume gates applied to both cohorts

Excel attachment included for full property data.

---
Atlas Property Analytics
C/O WebOps - Mark Laufhutte
"""
    
    def send_email(self):
        """Send the comparison report email"""
        
        print('📧 Preparing Resi vs Legacy Comparison email...')
        
        # Verify report files exist
        if not self.html_report_path.exists():
            print(f'❌ HTML report not found: {self.html_report_path}')
            return False
        
        if not self.excel_report_path.exists():
            print(f'❌ Excel report not found: {self.excel_report_path}')
            return False
        
        # Create subject
        subject = f'Atlas — Resi vs Legacy Executive Comparison ({datetime.now().strftime("%b %d, %Y")})'
        
        # Read HTML content
        with open(self.html_report_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Read Excel attachment
        with open(self.excel_report_path, 'rb') as f:
            excel_content = f.read()
        
        # Prepare plain text fallback
        plain_body = self._create_plain_text_body()
        
        # Send via unified email sender
        recipient_list = ', '.join(self.recipients)
        print(f'📤 Sending to {recipient_list}...')
        
        try:
            self.email_sender.send_email(
                subject=subject,
                html_body=html_content,
                plain_text=plain_body,
                recipients=self.recipients,
                attachments=[('resi_vs_legacy_comparison.xlsx', excel_content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')]
            )
            
            print(f'✅ Email sent successfully!')
            print(f'   To: {recipient_list}')
            print(f'   Subject: {subject}')
            print(f'   Format: HTML email body with Excel attachment')
            
            return True
            
        except Exception as e:
            print(f'❌ Failed to send email: {e}')
            return False


if __name__ == '__main__':
    emailer = ComparisonReportEmailer()
    success = emailer.send_email()
    sys.exit(0 if success else 1)
