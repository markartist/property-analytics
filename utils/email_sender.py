#!/usr/bin/env python3
"""
Unified Email Sender Utility
==============================
Central email solution for all Property Analytics reporting systems.

Features:
- Supports Gmail, Office 365, and AWS SES SMTP providers
- Automatic provider detection from config
- Multiple recipient support
- HTML and plain text email support
- Attachment support
- Consistent error handling and logging
- Environment variable override support

Configuration:
    Uses /Users/mark/Property_Analytics/credentials/email_config.json

    Gmail format:
    {
        "provider": "gmail",  // or "office365"
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
    from utils.email_sender import EmailSender

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
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formataddr
from pathlib import Path
from typing import Dict, List, Optional, Tuple
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
            'smtp_server': 'email-smtp.us-east-1.amazonaws.com',
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
            provider: Override provider from config ('gmail', 'office365', or 'aws_ses')
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
        # Support both legacy and current key names.
        self.smtp_username = self.config.get('smtp_username', self.sender_email)
        self.smtp_password = self.config.get('smtp_password', self.config.get('sender_password'))
        if not self.smtp_password:
            raise EmailConfigError("Missing SMTP password in config (smtp_password or sender_password)")
        self.default_recipients = self.config.get('default_recipients', [])

        # Optional display name for From header
        self.sender_display_name = self.config.get('sender_display_name', None)

        if self.verbose:
            print(f"📧 Email Configuration:")
            print(f"   Provider: {provider_config['display_name']} ({self.provider})")
            print(f"   SMTP Server: {self.smtp_server}:{self.smtp_port}")
            print(f"   From: {self.sender_email}")
            print(f"   SMTP User: {self.smtp_username}")
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
        metadata = self.send_email_with_tracking(
            subject=subject,
            html_body=html_body,
            recipients=recipients,
            plain_text=plain_text,
            attachments=attachments,
            reply_to=reply_to,
            cc=cc,
            bcc=bcc,
            log_path=None,
        )
        return bool(metadata.get("success"))

    def send_email_with_tracking(
        self,
        subject: str,
        html_body: str,
        recipients: Optional[List[str]] = None,
        plain_text: Optional[str] = None,
        attachments: Optional[List[Tuple[str, bytes, str]]] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        log_path: Optional[Path] = None,
    ) -> Dict[str, object]:
        """Send email and return delivery metadata with a stable message ID."""

        if recipients is None:
            recipients = self.default_recipients

        if not recipients:
            raise EmailConfigError("No recipients specified and no default recipients configured")

        message_id = f"{uuid.uuid4()}@property-analytics.local"
        sent_at = datetime.now().isoformat(timespec="seconds")
        if attachments:
            msg = MIMEMultipart('mixed')
            body_container = MIMEMultipart('alternative')
            msg.attach(body_container)
        else:
            msg = MIMEMultipart('alternative')
            body_container = msg
        msg['Subject'] = subject
        msg['Message-ID'] = f"<{message_id}>"

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
        body_container.attach(text_part)

        html_part = MIMEText(html_body, 'html')
        body_container.attach(html_part)

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

        try:
            if self.verbose:
                recipient_list = ', '.join(recipients)
                print(f"📤 Sending email...")
                print(f"   To: {recipient_list}")
                print(f"   Subject: {subject}")
                print(f"   Message ID: {message_id}")

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

            metadata: Dict[str, object] = {
                "success": True,
                "message_id": message_id,
                "subject": subject,
                "sent_at": sent_at,
                "provider": self.provider,
                "smtp_server": self.smtp_server,
                "from": self.sender_email,
                "to": recipients,
                "cc": cc or [],
                "bcc_count": len(bcc or []),
            }
            self._append_delivery_log(log_path=log_path, metadata=metadata)
            return metadata

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

    def _append_delivery_log(self, log_path: Optional[Path], metadata: Dict[str, object]) -> None:
        """Persist one-line JSON send metadata for post-run acceptance checks."""
        if not log_path:
            return
        log_path = Path(log_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(metadata, ensure_ascii=True) + "\n")

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

    parser.add_argument('--provider', choices=['gmail', 'office365', 'aws_ses'],
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
