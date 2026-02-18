# Technical Details for SMTP Email Access Request

**Date:** January 28, 2026  
**Requestor:** Mark Laufhutte  
**Purpose:** Automated reporting system that sends analytics reports via email

---

## Current Configuration

**Protocol:** SMTP over TLS (STARTTLS on port 587)  
**Authentication Method:** Gmail App Password (application-specific password, not standard user password)  
**SMTP Server:** smtp.gmail.com:587  
**Sender Email:** mlaufhutte@venterraliving.com (corporate Gmail account)  
**Implementation:** Python scripts using `smtplib` library with TLS encryption

---

## Technical Details

**Connection Settings:**
- SMTP Server: smtp.gmail.com
- Port: 587
- Encryption: STARTTLS (TLS 1.2+)
- Authentication Method: LOGIN with app-specific password
- Programming Language: Python 3.12
- Libraries: smtplib + email.mime modules

---

## What's Happening

The Property Analytics platform runs automated Python scripts (via macOS launchd scheduler) that:

1. Collect data from various APIs (Google Analytics, Search Console, PageSpeed Insights, SEMRush, etc.)
2. Generate HTML/Excel reports with analytics data
3. Send reports via email using Gmail's SMTP relay service

**Automation Schedule:**
- Daily reports at 8:00 AM
- Weekly reports on Wednesdays and Mondays
- Ad-hoc reports on demand

---

## Code Implementation Example

```python
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Connect to Gmail SMTP server
server = smtplib.SMTP('smtp.gmail.com', 587)

# Upgrade connection to TLS encryption
server.starttls()

# Authenticate using app-specific password
server.login('mlaufhutte@venterraliving.com', app_password)

# Send email
server.sendmail(sender_email, recipient_email, message)

# Close connection
server.quit()
```

---

## Why I Need This

Gmail recently restricted "less secure app access" and now requires either:

1. **OAuth 2.0 authentication** (complex for automated scripts requiring user interaction), OR
2. **App-specific passwords** (what I'm currently using, but may not be sustainable long-term)

The current Gmail-based solution works but is not ideal for enterprise use. I'm seeking an approved Microsoft 365-based solution.

---

## Alternative Solutions I'm Open To

I'm flexible and will implement whatever approach aligns with Venterra's security policies:

### Option 1: Microsoft 365 SMTP Relay
- Server: smtp.office365.com
- Port: 587
- Authentication: App password or basic auth
- Same implementation as current Gmail setup

### Option 2: Microsoft Graph API
- REST API approach for sending emails
- OAuth 2.0 authentication with service principal
- More complex but potentially more secure
- Requires Azure AD app registration and permissions

### Option 3: Other Enterprise Solution
- Any other approved email automation method
- Happy to adapt to existing Venterra infrastructure

---

## Security Considerations

**Current Security Measures:**
- Credentials stored locally on my Mac (not in code or Git repository)
- TLS encryption for all SMTP connections
- App passwords used (not actual account password)
- Emails sent only to internal Venterra recipients
- No sensitive data in email body (reports contain analytics, not PII)

**Additional Security I Can Implement:**
- Service account instead of personal account
- IP restrictions if available
- Certificate-based authentication
- Audit logging of all email sends
- Encrypted credential storage

---

## What I Need from IT

Please provide one of the following:

### Option A: Enable SMTP for M365 Account
- Enable App Passwords for my M365 account (mlaufhutte@venterraliving.com)
- Provide SMTP server details and port configuration
- Confirm authentication method to use

### Option B: Provide Graph API Access
- Create Azure AD app registration for email sending
- Provide Client ID and Tenant ID
- Grant Mail.Send API permissions
- Provide documentation for OAuth flow

### Option C: Alternative Approved Method
- Recommend enterprise-approved solution for automated email sending
- Provide credentials/access needed
- I'll implement according to your specifications

---

## Report Recipients

**Current Recipients (all internal):**
- mlaufhutte@venterraliving.com (me)
- Executive team members
- Marketing team members
- Property managers
- SEO team members

All recipients have @venterraliving.com email addresses.

---

## Email Volume

**Estimated Volume:**
- Automated reports: ~10 emails per week
- Ad-hoc reports: ~2-5 emails per week
- Total: ~15 emails per week maximum
- All emails have reports attached (CSV, Excel, or embedded HTML)

---

## Business Justification

**Property Analytics Platform:**
- Monitors 93 Venterra properties across the portfolio
- Collects data from 6+ external APIs daily
- Generates automated reports for decision-making
- Provides real-time health monitoring and alerts

**Email is Critical For:**
- Delivering daily Portfolio Pulse reports to executives
- Sending weekly Spotlight Properties reports to leadership
- Alerting teams to performance issues
- Distributing ad-hoc analysis reports

**Without Email Automation:**
- Manual report distribution required (unsustainable)
- Delayed insights and decision-making
- Loss of proactive alerting capabilities
- Reduced platform value

---

## Timeline

**Current Status:** Using Gmail SMTP with app password (working but not ideal)  
**Desired Timeline:** Transition to approved M365 solution within 2-4 weeks  
**Urgency:** Medium - current solution works but seeking enterprise-approved method

---

## Contact Information

**Name:** Mark Laufhutte  
**Email:** mlaufhutte@venterraliving.com  
**Department:** Marketing Analytics  
**Phone:** [Your phone number if needed]

I'm available to discuss technical details, provide additional information, or implement any approved solution. Please let me know which approach you'd like me to pursue.

---

## Appendix: Full Technical Stack

**Platform:** Property Analytics  
**Operating System:** macOS  
**Language:** Python 3.12  
**Scheduler:** macOS launchd (similar to Windows Task Scheduler)  
**Database:** SQLite 3 (local database)  
**Email Libraries:** smtplib, email.mime (Python standard library)  
**Credential Storage:** JSON files (local filesystem, not in Git)  
**Recipients:** All internal @venterraliving.com addresses

**External API Integrations:**
- Google Analytics 4 API (service account authentication)
- Google Search Console API (OAuth 2.0)
- Google PageSpeed Insights API (public API)
- SEMRush API (API key authentication)
- Google Ads API (OAuth 2.0)
- Google Business Profile API (service account)

**Data Flow:**
1. APIs → Local Database (automated daily collection)
2. Database → Report Generator (Python scripts)
3. Report Generator → Email Client (smtplib)
4. Email Client → SMTP Server → Recipients
