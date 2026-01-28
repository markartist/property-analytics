#!/usr/bin/env python3
"""
Resi vs Legacy Comparison - Report Package Creator
===================================================
Prepares the comparison report for manual email distribution.
Copies files to OneDrive and creates an email draft template.

Usage:
    python3 package_report_for_email.py
"""

import shutil
from datetime import datetime
from pathlib import Path


def package_report():
    """Package report files and create email template"""
    
    print('📦 Packaging Resi vs Legacy Comparison Report...\n')
    
    # Source files
    report_dir = Path(__file__).parent / 'reports' / datetime.now().strftime('%Y-%m-%d')
    html_report = report_dir / 'resi_vs_legacy_comparison.html'
    excel_report = report_dir / 'resi_vs_legacy_comparison.xlsx'
    json_report = report_dir / 'resi_vs_legacy_comparison.json'
    
    # Verify source files exist
    if not html_report.exists():
        print(f'❌ HTML report not found: {html_report}')
        return False
    
    if not excel_report.exists():
        print(f'❌ Excel report not found: {excel_report}')
        return False
    
    # Create OneDrive package directory
    onedrive_dir = Path('/Users/mark/OneDrive - Venterra Realty (Canada) Inc/Resi_vs_Legacy_Report')
    onedrive_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy files to OneDrive
    print('📂 Copying files to OneDrive...')
    shutil.copy2(html_report, onedrive_dir / html_report.name)
    print(f'   ✅ {html_report.name}')
    
    shutil.copy2(excel_report, onedrive_dir / excel_report.name)
    print(f'   ✅ {excel_report.name}')
    
    if json_report.exists():
        shutil.copy2(json_report, onedrive_dir / json_report.name)
        print(f'   ✅ {json_report.name}')
    
    # Create email template
    email_template = f"""
===============================================================================
EMAIL DRAFT TEMPLATE
===============================================================================

TO: [Your Recipients]
FROM: mlaufhutte@venterraliving.com
SUBJECT: Atlas — Resi vs Legacy Executive Comparison ({datetime.now().strftime("%b %d, %Y")})

BODY:
---

Atlas — Resi vs Legacy Executive Comparison Report

This email contains the Resi vs Legacy Site Experience executive comparative performance report.

EXECUTIVE QUESTION
When organic demand exists, do Resi sites convert traffic more efficiently than Legacy sites?

KEY FINDINGS (30-DAY ROLLING)
• Conversion-Eligible Properties: N=3 Resi vs N=13 Legacy (≥300 GSC clicks)
• SERP CTR: Resi 5.79% vs Legacy 10.93% → Legacy stronger
• Engagement Rate: Resi 59.0% vs Legacy 61.8% → Legacy stronger

CONCLUSION
Legacy sites demonstrate stronger conversion efficiency across both metrics when organic demand exists.

ATTACHMENTS (see OneDrive folder)
• resi_vs_legacy_comparison.html — Executive report (open in browser)
• resi_vs_legacy_comparison.xlsx — Full property data

REPORT SPECS
• Data Window: GA4 (2025-12-23 to 2026-01-22), GSC (2025-12-21 to 2026-01-20)
• Controlled Comparison: Identical volume gates applied to both cohorts
• Classification Logic: Conversion-Ready, Ramp-Stage, Visibility-Constrained

---
Atlas Property Analytics
C/O WebOps - Mark Laufhutte

===============================================================================
FILES PACKAGED TO: {onedrive_dir}
===============================================================================

Next Steps:
1. Open Outlook and create a new email
2. Copy the email body above
3. Attach the files from the OneDrive folder
4. Send to your recipients

===============================================================================
"""
    
    # Save email template
    template_file = onedrive_dir / 'EMAIL_TEMPLATE.txt'
    with open(template_file, 'w') as f:
        f.write(email_template)
    
    print(f'\n📧 Email template created: {template_file}')
    print(f'📁 All files saved to: {onedrive_dir}')
    print('\n' + '='*79)
    print('NEXT STEPS:')
    print('='*79)
    print('1. Open Outlook')
    print('2. Create new email and copy content from EMAIL_TEMPLATE.txt')
    print('3. Attach the HTML and Excel files from the OneDrive folder')
    print('4. Send to your recipients')
    print('='*79)
    
    return True


if __name__ == '__main__':
    success = package_report()
    exit(0 if success else 1)
