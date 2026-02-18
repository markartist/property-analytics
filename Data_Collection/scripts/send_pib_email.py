#!/usr/bin/env python3
"""
Send PIB v2 report via email

Usage: python3 send_pib_email.py <report_file.md>
"""

import sys
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

def convert_md_to_html(markdown_content: str) -> str:
    """Convert markdown report to HTML email"""
    
    # Simple markdown to HTML conversion
    html = markdown_content
    
    # Headers
    html = html.replace('# ', '<h1>').replace('\n## ', '</h1>\n<h2>').replace('\n### ', '</h2>\n<h3>')
    html = html.replace('\n#### ', '</h3>\n<h4>')
    
    # Bold
    html = html.replace('**', '<strong>').replace('**', '</strong>')
    
    # Lists
    lines = html.split('\n')
    in_list = False
    new_lines = []
    in_table = False
    table_lines = []
    
    for line in lines:
        # Handle tables
        if line.strip().startswith('|'):
            if not in_table:
                in_table = True
                table_lines = []
            table_lines.append(line)
            continue
        else:
            if in_table:
                # Convert table
                new_lines.append(convert_table_to_html(table_lines))
                in_table = False
                table_lines = []
        
        # Handle lists
        if line.strip().startswith('- '):
            if not in_list:
                new_lines.append('<ul>')
                in_list = True
            new_lines.append(f'<li>{line.strip()[2:]}</li>')
        else:
            if in_list:
                new_lines.append('</ul>')
                in_list = False
            
            # Horizontal rules
            if line.strip() == '---':
                new_lines.append('<hr style="border: 1px solid #ddd; margin: 20px 0;">')
            # Blockquotes
            elif line.strip().startswith('> '):
                new_lines.append(f'<blockquote style="border-left: 3px solid #0066cc; padding-left: 15px; margin: 10px 0; color: #555;">{line.strip()[2:]}</blockquote>')
            # Paragraphs
            elif line.strip():
                new_lines.append(f'<p>{line}</p>')
            else:
                new_lines.append('<br>')
    
    if in_list:
        new_lines.append('</ul>')
    if in_table:
        new_lines.append(convert_table_to_html(table_lines))
    
    html = '\n'.join(new_lines)
    
    # Wrap in HTML structure
    html_email = f"""
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }}
            h1 {{ color: #0066cc; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }}
            h2 {{ color: #0066cc; margin-top: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 8px; }}
            h3 {{ color: #0088cc; margin-top: 20px; }}
            h4 {{ color: #555; }}
            table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
            th {{ background-color: #0066cc; color: white; padding: 10px; text-align: left; font-weight: 600; }}
            td {{ border: 1px solid #ddd; padding: 8px; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            tr:hover {{ background-color: #f0f0f0; }}
            ul {{ margin: 10px 0; padding-left: 30px; }}
            li {{ margin: 5px 0; }}
            strong {{ color: #0066cc; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; color: #777; font-size: 0.9em; font-style: italic; }}
        </style>
    </head>
    <body>
        {html}
    </body>
    </html>
    """
    
    return html_email

def convert_table_to_html(table_lines: list) -> str:
    """Convert markdown table to HTML"""
    if not table_lines:
        return ""
    
    html = ['<table>']
    
    for i, line in enumerate(table_lines):
        cells = [cell.strip() for cell in line.split('|')[1:-1]]
        
        # Skip separator line
        if i == 1 and all(set(cell.replace('-', '')) == set() for cell in cells):
            continue
        
        # Header row
        if i == 0:
            html.append('<tr>')
            for cell in cells:
                html.append(f'<th>{cell}</th>')
            html.append('</tr>')
        else:
            html.append('<tr>')
            for cell in cells:
                html.append(f'<td>{cell}</td>')
            html.append('</tr>')
    
    html.append('</table>')
    return '\n'.join(html)

def send_pib_email(report_path: str):
    """Send PIB v2 report via email"""
    
    # Load email config
    config_path = Path(__file__).parent.parent.parent / "credentials" / "email_config.json"
    with open(config_path) as f:
        config = json.load(f)
    
    # Read report
    with open(report_path) as f:
        report_content = f.read()
    
    # Extract property name from report
    property_name = "Property"
    for line in report_content.split('\n'):
        if line.startswith('**Property**:'):
            property_name = line.split(':', 1)[1].strip()
            break
    
    # Create email
    msg = MIMEMultipart('alternative')
    msg['From'] = f"{config['sender_display_name']} <{config['sender_email']}>"
    msg['To'] = config['default_recipients'][0]
    msg['Subject'] = f"PIB v2: {property_name}"
    
    # Plain text version
    text_part = MIMEText(report_content, 'plain')
    msg.attach(text_part)
    
    # HTML version
    html_content = convert_md_to_html(report_content)
    html_part = MIMEText(html_content, 'html')
    msg.attach(html_part)
    
    # Send email
    try:
        server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
        server.starttls()
        server.login(config['sender_email'], config['sender_password'])
        server.sendmail(
            config['sender_email'],
            config['default_recipients'][0],
            msg.as_string()
        )
        server.quit()
        
        print(f"✅ Email sent to {config['default_recipients'][0]}")
        print(f"   Subject: PIB v2: {property_name}")
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 send_pib_email.py <report_file.md>")
        sys.exit(1)
    
    report_path = sys.argv[1]
    
    if not Path(report_path).exists():
        print(f"Error: Report file not found: {report_path}")
        sys.exit(1)
    
    send_pib_email(report_path)

if __name__ == "__main__":
    main()
