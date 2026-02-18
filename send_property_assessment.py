#!/usr/bin/env python3
"""
Send Property Assessment Report via Email
==========================================

Sends the generated Property Assessment HTML report via email.

Usage:
    python3 send_property_assessment.py
"""

import sys
from pathlib import Path

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

from Data_Collection.utils.email_sender import EmailSender


def main():
    report_path = "/Users/mark/Downloads/report/Property_Assessment_Executive.html"
    
    # Read the HTML report
    with open(report_path, 'r') as f:
        html_content = f.read()
    
    # Create email sender and send
    sender = EmailSender()
    
    sender.send_email(
        subject="Property Assessment - Performance & Technical SEO Analysis",
        html_body=html_content,
        plain_text="Property Assessment report attached. Please view in an HTML-capable email client."
    )
    
    print(f"\n✅ Report emailed successfully from {report_path}")


if __name__ == "__main__":
    main()
