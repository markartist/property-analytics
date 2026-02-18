#!/usr/bin/env python3
"""
Unified Email Sender Utility
==============================
Central email solution for all Property Analytics reporting systems.

Features:
- Supports AWS SES, Gmail, and Office 365 SMTP providers
- Automatic provider detection from config
- Multiple recipient support
- HTML and plain text email support
- Attachment support
- Consistent error handling and logging
- Environment variable override support

Configuration:
    Uses /Users/mark/Property_Analytics/credentials/email_config.json
    
    **PRIMARY METHOD - AWS SES** (Recommended for @venterraliving.com emails):
    {
        "provider": "aws_ses",
        "smtp_server": "email-smtp.us-east-2.amazonaws.com",
        "smtp_port": 587,
        "smtp_username": "AKIAYJAGT54HEDH7GXFV",
        "smtp_password": "<AWS_SES_SMTP_PASSWORD>",
        "sender_email": "mlaufhutte@venterraliving.com",
        "sender_display_name": "Mark Laufhutte - Venterra Analytics",
        "default_recipients": ["mlaufhutte@venterraliving.com"]
    }
    
    **BACKUP METHOD - Gmail** (Fallback option):
    Backup config saved at: credentials/email_config.json.gmail_backup
    {
        "provider": "gmail",
        "smtp_server": "smtp.gmail.com",
        "smtp_port": 587,
        "sender_email": "sender@gmail.com",
        "sender_password": "app_password",
        "default_recipients": ["recipient@example.com"]
    }
    
    Office 365 format:
    {
        "provider": "office365",
        "smtp_server": "smtp.office365.com",
        "smtp_port": 587,
        "sender_email": "sender@company.com",
        "sender_password": "password",
        "default_recipients": ["recipient@example.com"]
    }

Usage:
    from Data_Collection.utils.email_sender import EmailSender
    
    # Simple usage
    sender = EmailSender()
    sender.send_email(
        subject="Report Title",
        html_body="<h1>Report</h1>",
        recipients=["user@example.com"]
    )
    
    # With attachments
    sender.send_email(
        subject="Report with Data",
        html_body="<h1>Report</h1>",
        plain_text="Fallback text",
        recipients=["user@example.com"],
        attachments=[("data.json", b'{"key": "value"}', "application/json")]
    )
    
    # Override provider
    sender = EmailSender(provider="office365")
"""

import os
import sys
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formataddr
from pathlib import Path
from typing import List, Optional, Tuple
from datetime import datetime


class EmailSenderError(Exception):
    """Base exception for email sender errors"""
    pass


class EmailConfigError(EmailSenderError):
    """Configuration-related errors"""
    pass


class EmailSendError(EmailSenderError):
    """Email sending errors"""
    pass


class EmailSender:
    """Unified email sender supporting multiple SMTP providers"""
    
    # Provider configurations
    PROVIDERS = {
        'gmail': {
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': 587,
            'display_name': 'Gmail'
        },
        'office365': {
            'smtp_server': 'smtp.office365.com',
            'smtp_port': 587,
            'display_name': 'Office 365'
        },
        'aws_ses': {
            'smtp_server': 'email-smtp.us-east-2.amazonaws.com',
            'smtp_port': 587,
            'display_name': 'AWS SES'
        }
    }
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        provider: Optional[str] = None,
        verbose: bool = True
    ):
        """
        Initialize email sender.
        
        Args:
            config_path: Path to email config JSON. Defaults to credentials/email_config.json
            provider: Override provider from config ('gmail' or 'office365')
            verbose: Print status messages
        """
        self.verbose = verbose
        
        # Determine config path
        if config_path is None:
            config_path = '/Users/mark/Property_Analytics/credentials/email_config.json'
        
        self.config_path = Path(config_path)
        if not self.config_path.exists():
            raise EmailConfigError(f"Email config not found: {self.config_path}")
        
        # Load configuration
        with open(self.config_path) as f:
            self.config = json.load(f)
        
        # Determine provider
        if provider:
            self.provider = provider.lower()
        else:
            self.provider = self.config.get('provider', 'gmail').lower()
        
        if self.provider not in self.PROVIDERS:
            raise EmailConfigError(
                f"Unknown provider: {self.provider}. "
                f"Supported: {', '.join(self.PROVIDERS.keys())}"
            )
        
        # Set SMTP configuration
        provider_config = self.PROVIDERS[self.provider]
        self.smtp_server = self.config.get('smtp_server', provider_config['smtp_server'])
        self.smtp_port = self.config.get('smtp_port', provider_config['smtp_port'])
        self.sender_email = self.config['sender_email']
        
        # AWS SES uses separate username/password
        if self.provider == 'aws_ses':
            self.smtp_username = self.config.get('smtp_username', self.config['sender_email'])
            self.smtp_password = self.config['smtp_password']
        else:
            self.smtp_username = self.sender_email
            self.smtp_password = self.config['sender_password']
        
        self.default_recipients = self.config.get('default_recipients', [])
        
        # Optional display name for From header
        self.sender_display_name = self.config.get('sender_display_name', None)
        
        if self.verbose:
            print(f"📧 Email Configuration:")
            print(f"   Provider: {provider_config['display_name']} ({self.provider})")
            print(f"   SMTP Server: {self.smtp_server}:{self.smtp_port}")
            print(f"   From: {self.sender_email}")
            if self.default_recipients:
                print(f"   Default Recipients: {', '.join(self.default_recipients)}")
            print()
    
    def send_email(
        self,
        subject: str,
        html_body: str,
        recipients: Optional[List[str]] = None,
        plain_text: Optional[str] = None,
        attachments: Optional[List[Tuple[str, bytes, str]]] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        Send an email.
        
        Args:
            subject: Email subject line
            html_body: HTML content of email
            recipients: List of recipient email addresses (uses default if None)
            plain_text: Plain text version of email (auto-generated if None)
            attachments: List of (filename, content_bytes, mime_type) tuples
            reply_to: Reply-To email address
            cc: List of CC recipients
            bcc: List of BCC recipients
            
        Returns:
            True if email sent successfully
            
        Raises:
            EmailSendError: If email sending fails
        """
        # Determine recipients
        if recipients is None:
            recipients = self.default_recipients
        
        if not recipients:
            raise EmailConfigError("No recipients specified and no default recipients configured")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        
        # Set From header with optional display name
        if self.sender_display_name:
            msg['From'] = formataddr((self.sender_display_name, self.sender_email))
        else:
            msg['From'] = self.sender_email
        
        msg['To'] = ', '.join(recipients)
        msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')
        
        if reply_to:
            msg['Reply-To'] = reply_to
        
        if cc:
            msg['Cc'] = ', '.join(cc)
        
        # Generate plain text version if not provided
        if plain_text is None:
            plain_text = f"{subject}\n\nThis email contains an HTML report. Please view in an HTML-capable email client."
        
        # Attach text parts
        text_part = MIMEText(plain_text, 'plain')
        msg.attach(text_part)
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        # Attach files if provided
        if attachments:
            for filename, content, mime_type in attachments:
                if self.verbose:
                    print(f"   Attaching: {filename}")
                
                if '/' in mime_type:
                    maintype, subtype = mime_type.split('/', 1)
                else:
                    maintype, subtype = 'application', 'octet-stream'
                
                attachment = MIMEBase(maintype, subtype)
                attachment.set_payload(content)
                encoders.encode_base64(attachment)
                attachment.add_header(
                    'Content-Disposition',
                    f'attachment; filename="{filename}"'
                )
                msg.attach(attachment)
        
        # Send email
        try:
            if self.verbose:
                recipient_list = ', '.join(recipients)
                print(f"📤 Sending email...")
                print(f"   To: {recipient_list}")
                print(f"   Subject: {subject}")
            
            # Build complete recipient list for sending
            all_recipients = recipients.copy()
            if cc:
                all_recipients.extend(cc)
            if bcc:
                all_recipients.extend(bcc)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg, to_addrs=all_recipients)
            
            if self.verbose:
                print(f"✅ Email sent successfully!")
                print(f"   From: {self.sender_email}")
                print(f"   To: {', '.join(recipients)}")
            
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"SMTP authentication failed for {self.sender_email}: {e}"
            if self.verbose:
                print(f"❌ {error_msg}")
            raise EmailSendError(error_msg) from e
            
        except smtplib.SMTPException as e:
            error_msg = f"SMTP error: {e}"
            if self.verbose:
                print(f"❌ {error_msg}")
            raise EmailSendError(error_msg) from e
            
        except Exception as e:
            error_msg = f"Failed to send email: {e}"
            if self.verbose:
                print(f"❌ {error_msg}")
            raise EmailSendError(error_msg) from e
    
    def send_simple_email(
        self,
        subject: str,
        body: str,
        recipients: Optional[List[str]] = None,
        is_html: bool = False
    ) -> bool:
        """
        Send a simple email (convenience method).
        
        Args:
            subject: Email subject
            body: Email body (text or HTML)
            recipients: List of recipients (uses default if None)
            is_html: If True, treat body as HTML
            
        Returns:
            True if sent successfully
        """
        if is_html:
            return self.send_email(
                subject=subject,
                html_body=body,
                recipients=recipients
            )
        else:
            return self.send_email(
                subject=subject,
                html_body=f"<pre>{body}</pre>",
                plain_text=body,
                recipients=recipients
            )


def main():
    """CLI for testing email sender"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Unified Email Sender - Test utility',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--provider', choices=['gmail', 'office365'],
                       help='Override email provider')
    parser.add_argument('--subject', required=True, help='Email subject')
    parser.add_argument('--body', required=True, help='Email body')
    parser.add_argument('--html', action='store_true', help='Body is HTML')
    parser.add_argument('--recipients', help='Comma-separated recipient emails')
    parser.add_argument('--config', help='Path to email config JSON')
    
    args = parser.parse_args()
    
    # Parse recipients
    recipients = None
    if args.recipients:
        recipients = [r.strip() for r in args.recipients.split(',')]
    
    # Create sender and send email
    try:
        sender = EmailSender(
            config_path=args.config,
            provider=args.provider,
            verbose=True
        )
        
        sender.send_simple_email(
            subject=args.subject,
            body=args.body,
            recipients=recipients,
            is_html=args.html
        )
        
        sys.exit(0)
        
    except EmailSenderError as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
