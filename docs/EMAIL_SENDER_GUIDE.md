# Unified Email Sender - Documentation & Migration Guide

## Overview

The unified email sender (`utils/email_sender.py`) provides a centralized solution for sending emails across all Property Analytics reporting systems. It eliminates code duplication and provides consistent email functionality with easy provider switching.

**Created**: January 24, 2026  
**Status**: Production-ready

## Features

- ✅ **Multi-provider support**: Gmail and Office 365 SMTP
- ✅ **Provider switching**: Change email providers via config file
- ✅ **Multiple recipients**: Send to multiple recipients with CC/BCC support
- ✅ **HTML & plain text**: Automatic plain text fallback generation
- ✅ **Attachments**: Support for file attachments with MIME types
- ✅ **Display name**: Customize sender display name
- ✅ **Error handling**: Consistent exception handling with detailed error messages
- ✅ **CLI testing utility**: Command-line tool for testing email configuration

## Configuration

### Location
`/Users/mark/Property_Analytics/credentials/email_config.json`

### Format

```json
{
    "provider": "gmail",
    "enabled": true,
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "marklaufhutte@gmail.com",
    "sender_password": "app_password_here",
    "sender_display_name": "Mark Laufhutte - Venterra",
    "default_recipients": [
        "mlaufhutte@venterraliving.com"
    ],
    "recipient_emails": [
        "marklaufhutte@gmail.com"
    ],
    "send_critical_only": false,
    "subject_prefix": "[Spotlight Properties Alert]"
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `provider` | Yes | Email provider: "gmail" or "office365" |
| `smtp_server` | Yes | SMTP server hostname |
| `smtp_port` | Yes | SMTP port (typically 587) |
| `sender_email` | Yes | Sender email address |
| `sender_password` | Yes | SMTP password or app-specific password |
| `sender_display_name` | No | Display name for From header |
| `default_recipients` | No | Default recipient list |
| `recipient_emails` | No | Legacy field for compatibility |
| `enabled` | No | Legacy field for compatibility |
| `send_critical_only` | No | Legacy field for compatibility |
| `subject_prefix` | No | Legacy field for compatibility |

### Switching Providers

To switch from Gmail to Office 365:

```json
{
    "provider": "office365",
    "smtp_server": "smtp.office365.com",
    "smtp_port": 587,
    "sender_email": "mlaufhutte@venterraliving.com",
    "sender_password": "your_password",
    ...
}
```

The `EmailSender` class will automatically use the correct SMTP settings based on the provider.

## Usage

### Basic Usage

```python
from utils.email_sender import EmailSender

# Create sender (uses default config)
sender = EmailSender()

# Send simple email
sender.send_email(
    subject="Report Title",
    html_body="<h1>My Report</h1><p>Content here</p>",
    recipients=["user@example.com"]
)
```

### With Plain Text Fallback

```python
sender.send_email(
    subject="Report Title",
    html_body="<h1>My Report</h1>",
    plain_text="My Report\n\nContent here",
    recipients=["user@example.com"]
)
```

### With Attachments

```python
# Read file content
with open('report.json', 'rb') as f:
    json_content = f.read()

sender.send_email(
    subject="Report with Attachment",
    html_body="<h1>See attached</h1>",
    recipients=["user@example.com"],
    attachments=[
        ("report.json", json_content, "application/json")
    ]
)
```

### Multiple Recipients with CC/BCC

```python
sender.send_email(
    subject="Team Report",
    html_body="<h1>Report</h1>",
    recipients=["user1@example.com", "user2@example.com"],
    cc=["manager@example.com"],
    bcc=["archive@example.com"],
    reply_to="noreply@example.com"
)
```

### Simple Text Email

```python
sender.send_simple_email(
    subject="Test Message",
    body="This is a simple text email",
    recipients=["user@example.com"],
    is_html=False
)
```

### Override Provider

```python
# Force Office 365 even if config says Gmail
sender = EmailSender(provider="office365")
```

### Suppress Verbose Output

```python
# Silent mode (useful for automated scripts)
sender = EmailSender(verbose=False)
```

### Custom Config Path

```python
sender = EmailSender(
    config_path="/path/to/custom/email_config.json"
)
```

## Error Handling

The email sender uses custom exceptions for better error handling:

```python
from utils.email_sender import EmailSender, EmailSenderError, EmailConfigError, EmailSendError

try:
    sender = EmailSender()
    sender.send_email(
        subject="Test",
        html_body="<h1>Test</h1>",
        recipients=["user@example.com"]
    )
except EmailConfigError as e:
    print(f"Configuration error: {e}")
except EmailSendError as e:
    print(f"Failed to send email: {e}")
except EmailSenderError as e:
    print(f"General email error: {e}")
```

## Command-Line Testing

Test your email configuration from the command line:

```bash
# Send test email using default recipients
python3 utils/email_sender.py \
    --subject "Test Email" \
    --body "This is a test message"

# Send to specific recipients
python3 utils/email_sender.py \
    --subject "Test Email" \
    --body "Test message" \
    --recipients "user1@example.com,user2@example.com"

# Send HTML email
python3 utils/email_sender.py \
    --subject "Test HTML" \
    --body "<h1>Hello</h1><p>This is HTML</p>" \
    --html

# Override provider
python3 utils/email_sender.py \
    --subject "Test" \
    --body "Test" \
    --provider office365

# Use custom config
python3 utils/email_sender.py \
    --subject "Test" \
    --body "Test" \
    --config /path/to/config.json
```

## Migration Guide

### Scripts Migrated (✅ All Complete)

All email scripts have been successfully migrated to use the unified email sender:

1. **Portfolio Pulse Email** (`Portfolio_Monitoring/send_daily_pulse_email.py`)
   - Uses: Unified sender with verbose=False
   - Recipient: mlaufhutte@venterraliving.com

2. **PIB Email - Portfolio Monitoring** (`Portfolio_Monitoring/send_pib_email.py`)
   - Uses: Unified sender with reply-to
   - Recipient: mlaufhutte@venterraliving.com

3. **Data Alerts** (`Portfolio_Monitoring/send_data_alerts.py`)
   - Uses: Unified sender with test mode support
   - Recipient: mlaufhutte@venterraliving.com

4. **Property Intelligence Brief Email** (`Property_Intelligence_Brief/send_pib_email.py`)
   - Uses: Unified sender with attachment support
   - Recipients: Configurable via env var

5. **Insights Email** (`Portfolio_Monitoring/send_insights_email.py`)
   - Uses: Unified sender with HTML and text attachments
   - Recipient: Configurable via env var

6. **Focus Report Email** (`focus_report/scripts/send_focus_report_email.py`)
   - Uses: Unified sender with verbose=False
   - Recipients: Configurable via env var

7. **Hotlist Email** (`focus_report/scripts/send_hotlist_email.py`)
   - Uses: Unified sender with verbose=False
   - Recipients: Configurable via env var

8. **Spotlight Email Notification** (`Spotlight_Properties_Report/send_email_notification.py`)
   - Uses: Unified sender with verbose=True
   - Recipient: mlaufhutte@venterraliving.com

9. **Comparison Report Email** (`resi_vs_legacy_comparison/send_comparison_report_email.py`)
   - Uses: Unified sender with Excel attachments
   - Recipient: marklaufhutte@gmail.com

### Migration Steps

For each script:

1. **Add import** at the top:
   ```python
   import sys
   from pathlib import Path
   
   sys.path.insert(0, str(Path(__file__).parent.parent))
   from utils.email_sender import EmailSender
   ```

2. **Remove old imports**:
   ```python
   # Remove these:
   import smtplib
   from email.mime.multipart import MIMEMultipart
   from email.mime.text import MIMEText
   from email.utils import formataddr
   ```

3. **Replace SMTP configuration** with:
   ```python
   sender = EmailSender(verbose=True)  # or False for silent mode
   ```

4. **Replace sending logic**:
   ```python
   # Old way:
   msg = MIMEMultipart('alternative')
   msg['Subject'] = subject
   msg['From'] = sender_email
   msg['To'] = recipients
   msg.attach(MIMEText(plain_text, 'plain'))
   msg.attach(MIMEText(html_body, 'html'))
   
   with smtplib.SMTP(smtp_server, smtp_port) as server:
       server.starttls()
       server.login(sender_email, password)
       server.send_message(msg)
   
   # New way:
   sender.send_email(
       subject=subject,
       html_body=html_body,
       plain_text=plain_text,
       recipients=recipients
   )
   ```

5. **Test thoroughly** before committing changes

## Benefits

### Before (Duplicated Code)
- Each script implemented its own SMTP logic
- Hard to change email providers
- Inconsistent error handling
- No centralized configuration
- Code duplication across 10+ files

### After (Unified Sender)
- Single implementation to maintain
- Change provider in one config file
- Consistent error handling everywhere
- Centralized configuration
- Easier testing with CLI utility
- Better code reusability

## Testing

### Test Email Configuration

```bash
cd /Users/mark/Property_Analytics
python3 utils/email_sender.py \
    --subject "Test" \
    --body "Testing unified sender" \
    --recipients "your@email.com"
```

### Test Provider Switching

```bash
# Test with Gmail (current)
python3 utils/email_sender.py \
    --subject "Test Gmail" \
    --body "Testing Gmail SMTP" \
    --provider gmail

# Test with Office 365 (after updating config)
python3 utils/email_sender.py \
    --subject "Test O365" \
    --body "Testing Office 365 SMTP" \
    --provider office365
```

### Test Migrated Scripts

```bash
# Test Portfolio Pulse
cd Portfolio_Monitoring
python3 send_daily_pulse_email.py

# Test PIB Email (requires HTML file)
python3 send_pib_email.py /path/to/report.html "Property Name"

# Test Data Alerts
python3 send_data_alerts.py --test  # Test mode (no actual send)
python3 send_data_alerts.py         # Live mode
```

## Troubleshooting

### Authentication Errors

**Error**: `SMTP authentication failed`

**Solutions**:
- Gmail: Ensure using App Password, not regular password
- Office 365: Verify account has SMTP enabled
- Check credentials in email_config.json

### Connection Errors

**Error**: `Connection refused` or `Timeout`

**Solutions**:
- Verify smtp_server and smtp_port are correct
- Check firewall/network allows outbound SMTP
- Test connectivity: `telnet smtp.gmail.com 587`

### Configuration Errors

**Error**: `Email config not found`

**Solutions**:
- Verify file exists: `/Users/mark/Property_Analytics/credentials/email_config.json`
- Check file permissions
- Validate JSON syntax

### Provider Errors

**Error**: `Unknown provider: xyz`

**Solutions**:
- Supported providers: "gmail", "office365"
- Check provider field in config matches exactly (lowercase)

## Maintenance

### Adding New Provider

To add support for a new email provider:

1. Edit `utils/email_sender.py`
2. Add provider to `PROVIDERS` dict:
   ```python
   PROVIDERS = {
       'gmail': {...},
       'office365': {...},
       'sendgrid': {  # New provider
           'smtp_server': 'smtp.sendgrid.net',
           'smtp_port': 587,
           'display_name': 'SendGrid'
       }
   }
   ```
3. Update this documentation
4. Test thoroughly

### Updating Configuration Schema

If adding new config fields:

1. Update `email_config.json`
2. Update `EmailSender.__init__()` to read new fields
3. Update this documentation
4. Add backward compatibility if needed

## Security Notes

- **Never commit** `email_config.json` to version control
- Use **App Passwords** for Gmail (not account password)
- Store credentials file with restricted permissions: `chmod 600`
- Rotate passwords regularly
- Use environment-specific configs for production

## Support

For issues or questions:
- Check this guide first
- Review error messages carefully
- Test with CLI utility
- Check email provider documentation
- Review migrated scripts as examples

## Version History

- **v1.0** (Jan 24, 2026): Initial release
  - Gmail and Office 365 support
  - Migrated 3 core scripts (pulse, PIB, alerts)
  - CLI testing utility
  - Comprehensive documentation
