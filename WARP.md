# Property Analytics - AI Assistant Guide

**Last Updated**: January 31, 2026  
**Purpose**: This document helps AI assistants understand the Property Analytics ecosystem and how to work within it effectively.

## Overview

**Property Analytics** is a modular analytics platform for **93 Venterra real estate properties** (updated from 91). It's designed as a **shared codebase and infrastructure** from which multiple reporting systems, dashboards, and ad-hoc analyses can be built.

### Core Philosophy

This is **not** a single application. It's an **analytics platform** with:
- **Shared data collectors** (GA4, GTMetrix, PageSpeed, SEMRush, GSC)
- **Common credentials and configurations**
- **Reusable code patterns**
- **Independent reporting systems** that draw from shared resources
- **On-demand analytics** capabilities

Think of it as a **toolkit** where new reports, dashboards, or analyses can be created quickly by combining existing collectors and data sources.

## Directory Structure

```
~/Property_Analytics/
├── credentials/                    # Shared API credentials (NOT in git)
│   ├── authentic-reach-*.json     # GA4 service account (read-only)
│   ├── client_secret*.json        # Google OAuth clients
│   ├── email_config.json          # SMTP for automated emails
│   └── gbp_api_config.json        # Google Business Profile API
│
├── config/                         # Shared property configurations (NOT in git)
│   ├── venterra_properties_official.json  # Official registry: 93 properties
│   ├── properties_registry.json   # 39 spotlight properties (legacy)
│   ├── venterra_all_properties_ga4.json  # All properties (legacy)
│   └── all_ga4_properties.json    # GA4 property mappings
│
├── data/                           # Unified database (NEW - Jan 2026)
│   └── portfolio_analytics.db     # Single source of truth for all data
│
├── Data_Collection/                # PRODUCTION: Unified data collection (NEW - Jan 2026)
│   ├── Status: MISSION CRITICAL - Corporate Scrutiny Ready
│   ├── Schedule: Daily 5:00 AM CST
│   ├── Collectors: GA4, GSC, PSI, SEMRush, Google Ads, GBP (Reviews/Insights), ThirtyLines, GTMetrix
│   ├── Database: /Users/mark/Property_Analytics/data/portfolio_analytics.db
│   ├── Monitoring: 9 sources, 45+ validation rules, full audit trail
│   └── See: Data_Collection/WARP.md for complete details
│
├── Spotlight_Properties_Report/   # Production: Weekly reporting system
│   ├── Repository: github.com/markartist/spotlight-properties-report
│   ├── Purpose: Deep-dive weekly reports for key properties
│   ├── Schedule: Weekly (typically Wednesday)
│   └── Output: CSV reports to OneDrive
│
├── Property_Intelligence_Brief/   # Production: Executive intelligence reports (NEW - Jan 2026)
│   ├── Status: v2.0.0 LOCKED - Production Ready
│   ├── Purpose: Comprehensive executive reports with 10 sections
│   ├── Features: 9 data sources, competitor intelligence, portfolio benchmarking
│   ├── Schedule: On-demand (monthly/quarterly property reviews)
│   └── See: Property_Intelligence_Brief/WARP.md for complete details
│
├── Portfolio_Monitoring/          # DEPRECATED - Migrated to Data_Collection (Jan 2026)
│   ├── Status: Legacy system, no longer maintained
│   ├── Replaced by: Data_Collection/ unified system
│   └── Reason: Import conflicts caused 3-day data outage (Jan 25-27, 2026)
│
└── [Future Projects]              # Ad-hoc reports, dashboards, analyses
    └── Can be created on-demand using shared resources
```

## How This Platform Works

### 1. Unified Data Collection System (NEW - January 2026)

**IMPORTANT**: As of January 27, 2026, all data collection has been consolidated into `Data_Collection/` to resolve import conflicts that caused a 3-day data outage.

**Key Changes**:
- Single `DatabaseManager` class (no more import conflicts)
- All collectors in `Data_Collection/collectors/`
- Unified monitoring with `CollectionMonitor`
- Single database: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Official registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

**Standard Import Pattern**:
```python
from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.collectors.ga4_collector import GA4Collector
from Data_Collection.monitoring.collection_monitor import CollectionMonitor

# Initialize database
db = DatabaseManager('/Users/mark/Property_Analytics/data/portfolio_analytics.db')

# Load official registry
import json
with open('/Users/mark/Property_Analytics/config/venterra_properties_official.json') as f:
    properties = json.load(f)
```

**Legacy GA4 Pattern** (still works but deprecated):
```python
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.oauth2 import service_account

# Standard pattern used across all projects
credentials = service_account.Credentials.from_service_account_file(
    "../credentials/authentic-reach-474618-r6-16e824bab2c3.json"
)
ga4_client = BetaAnalyticsDataClient(credentials=credentials)
```

**Property Configuration**:
```python
import json

# Load from shared config
with open('../config/venterra_all_properties_ga4.json', 'r') as f:
    properties = json.load(f)['spotlight_properties']
```

**Email Reporting** (AWS SES - Primary Method):
```python
# Unified Email Sender with AWS SES
from Data_Collection.utils.email_sender import EmailSender

# Uses /Users/mark/Property_Analytics/credentials/email_config.json
sender = EmailSender()
sender.send_email(
    subject="Report Title",
    html_body="<h1>Report Content</h1>",
    recipients=["mlaufhutte@venterraliving.com"]
)

# Backup Gmail config available at:
# credentials/email_config.json.gmail_backup
```

### 2. Data Sources Available (Daily Collection)

**Status**: ✅ Mission Critical - Corporate Scrutiny Ready (Validated Jan 29, 2026)

| Source | Purpose | Collection Status | Quality Score | Data Location |
|--------|---------|------------------|---------------|---------------|
| **GA4** | Traffic, conversions, engagement | 92/93 properties | 99% | `portfolio_analytics.db` |
| **GSC** | Search performance, keywords | 91/93 properties | 81% | `portfolio_analytics.db` |
| **PageSpeed Insights** | Core Web Vitals, performance | 93/93 properties | 100% ✅ | `portfolio_analytics.db` |
| **Google Ads** | Ad spend, conversions, CTR | 57/93 properties | N/A | `portfolio_analytics.db` |
| **SEMRush** | SEO rankings, organic traffic | 92/93 properties | N/A | `portfolio_analytics.db` |
| **GBP Reviews** | Customer reviews, ratings | 19/93 properties | 100% ✅ | `portfolio_analytics.db` |
| **GBP Insights** | Business profile views, actions | 91/93 properties | 100% ✅ | `portfolio_analytics.db` |
| **ThirtyLines** | Unit availability, floor plans | 92/93 properties | 88% | `portfolio_analytics.db` |
| **GTMetrix** | Performance testing | Weekly/Monthly | N/A | `portfolio_analytics.db` |

**Overall Quality**: 94.5% (2,198 passed / 2,333 validation checks)  
**Last Validated**: January 29, 2026 at 11:23 AM CST  
**Monitoring**: 45+ validation rules, full audit trail, automated alerts

### Credentials & API Access

| Credential | Purpose | Location |
|------------|---------|----------|
| **GA4 Service Account** | Read-only GA4 access | `credentials/authentic-reach-*.json` |
| **Google OAuth** | GSC, GBP access | `credentials/client_secret*.json` |
| **Email Config (AWS SES)** | SMTP for alerts (PRIMARY) | `credentials/email_config.json` |
| **Email Config (Gmail)** | SMTP backup | `credentials/email_config.json.gmail_backup` |
| **GBP API** | Business Profile data | `credentials/gbp_api_config.json` |
| **AWS SES Credentials** | Venterra email sending | Configured in email_config.json |

### 3. Property Data Structure

**OFFICIAL REGISTRY: 93 Properties** (`venterra_properties_official.json`):
- **Single source of truth** for all property data
- Created: January 2026
- Includes: Property ID, canonical name, GA4 ID, URL, location, status
- Used by: Data_Collection system, all new projects
- Status: 92 properties collecting data, 1 new property not yet configured

**Legacy Configurations** (deprecated but still referenced by older systems):
- `properties_registry.json` - 39 spotlight properties (used by Spotlight Report)
- `venterra_all_properties_ga4.json` - 91 properties (old Portfolio Monitoring)

### 4. Database Infrastructure

**PRIMARY DATABASE**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Status**: PRODUCTION - Mission Critical
- **Created**: January 27, 2026 (unified system)
- **Last Validated**: January 29, 2026 at 11:23 AM CST

**Schema Overview**:
- **Core Tables**: properties, ga4_daily_metrics, gsc_daily_data, psi_daily_metrics
- **Additional Sources**: google_ads_daily, semrush_rankings, gbp_reviews, gbp_insights, gtmetrix_reports, property_floorplans, unit_availability
- **Monitoring Tables**: data_collections, collection_errors, data_quality_checks, data_quality_scores, validation_rules
- **Historical Data**: 30+ days across all sources
- **Audit Trail**: Complete collection history with timestamps, API metrics, success rates

**Validation & Quality**:
- **9 data sources** monitored
- **45+ validation rules** active
- **94.5% quality score** (as of Jan 29, 2026)
- **Full audit trail** for corporate scrutiny

**Legacy Database** (deprecated): `Portfolio_Monitoring/data/portfolio_monitoring.db`
- No longer maintained as of January 27, 2026
- Replaced by unified `portfolio_analytics.db`

## Creating Ad-Hoc Reports

When a user requests an analytics report, follow this pattern:

### Step 1: Determine Scope
- Which properties? (Subset of 39 spotlight, all 91, or specific properties)
- What metrics? (Traffic, conversions, performance, SEO, all of above)
- Time period? (Daily, weekly, monthly, date range)
- Output format? (CSV, PDF, email, dashboard, database query)

### Step 2: Choose Data Sources
Use the unified `Data_Collection/` system:
- **GA4 traffic**: `Data_Collection/collectors/ga4_collector.py`
- **GSC data**: `Data_Collection/collectors/gsc_collector.py`
- **Performance**: `Data_Collection/collectors/psi_collector.py` or `gtmetrix_collector.py`
- **SEO**: `Data_Collection/collectors/semrush_collector.py`
- **Historical data**: Query `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **All collectors**: See `Data_Collection/collectors/` directory

### Step 3: Create Report Script
Store in a new directory or temporary location:
```
~/Property_Analytics/AdHoc_Reports/
├── 2025-12-18_traffic_analysis/
│   ├── generate_report.py
│   ├── output/
│   └── README.md
```

### Step 4: Use Shared Resources
All scripts should reference shared resources:
```python
import os
from pathlib import Path

# Get parent directory
PARENT_DIR = Path(__file__).parent.parent

# Load shared credentials
GA4_CREDS = PARENT_DIR / "credentials" / "authentic-reach-*.json"
PROPERTY_CONFIG = PARENT_DIR / "config" / "venterra_all_properties_ga4.json"
EMAIL_CONFIG = PARENT_DIR / "credentials" / "email_config.json"

# Access unified database
DB_PATH = PARENT_DIR / "data" / "portfolio_analytics.db"

# Or use DatabaseManager
from Data_Collection.db.database_manager import DatabaseManager
db = DatabaseManager(str(DB_PATH))
```

### Step 5: Document and Store
- Create `README.md` explaining what the report does
- Store output in `output/` directory
- Add to `.gitignore` if contains sensitive data
- Optionally create Git repo if report will be reused

## Code Patterns and Examples

### Pattern 1: Fetch GA4 Data for Multiple Properties

```python
#!/usr/bin/env python3
"""
Ad-hoc GA4 traffic report for specified properties
"""
import json
from datetime import datetime, timedelta, date
from pathlib import Path
from google.analytics.data_v1beta import BetaAnalyticsDataClient, RunReportRequest, DateRange, Metric
from google.oauth2 import service_account

# Setup paths
PARENT_DIR = Path(__file__).parent.parent
GA4_CREDS = PARENT_DIR / "credentials" / "authentic-reach-474618-r6-16e824bab2c3.json"
PROPERTY_CONFIG = PARENT_DIR / "config" / "venterra_all_properties_ga4.json"

# Initialize GA4 client
credentials = service_account.Credentials.from_service_account_file(str(GA4_CREDS))
ga4_client = BetaAnalyticsDataClient(credentials=credentials)

# Load properties
with open(PROPERTY_CONFIG) as f:
    properties = json.load(f)['spotlight_properties']

# Date range (last 7 days)
end_date = date.today() - timedelta(days=1)
start_date = end_date - timedelta(days=7)

# Fetch data for each property
results = []
for prop_name, prop_data in properties.items():
    ga4_id = prop_data['ga4_property_id']
    
    request = RunReportRequest(
        property=f"properties/{ga4_id}",
        date_ranges=[DateRange(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )],
        metrics=[
            Metric(name="sessions"),
            Metric(name="conversions"),
            Metric(name="engagementRate")
        ]
    )
    
    try:
        response = ga4_client.run_report(request)
        if response.rows:
            row = response.rows[0]
            results.append({
                'property': prop_name,
                'sessions': int(row.metric_values[0].value),
                'conversions': int(row.metric_values[1].value),
                'engagement_rate': float(row.metric_values[2].value)
            })
    except Exception as e:
        print(f"Error fetching {prop_name}: {e}")

# Output results
import csv
with open('output/traffic_report.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['property', 'sessions', 'conversions', 'engagement_rate'])
    writer.writeheader()
    writer.writerows(results)

print(f"Report generated: {len(results)} properties")
```

### Pattern 2: Query Historical Database

```python
#!/usr/bin/env python3
"""
Query historical trends from Portfolio Monitoring database
"""
import sqlite3
from pathlib import Path
from datetime import date, timedelta

# Database path
PARENT_DIR = Path(__file__).parent.parent
DB_PATH = PARENT_DIR / "data" / "portfolio_analytics.db"

# Connect to database
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# Query: 30-day traffic trends for all properties
query = """
SELECT 
    p.canonical_name,
    g.metric_date,
    g.sessions,
    g.conversions,
    g.conversion_rate
FROM ga4_daily_metrics g
JOIN properties p ON g.property_id = p.property_id
WHERE g.metric_date >= DATE('now', '-30 days')
ORDER BY p.canonical_name, g.metric_date DESC
"""

cursor = conn.execute(query)
results = [dict(row) for row in cursor.fetchall()]

# Analyze trends
from collections import defaultdict
property_trends = defaultdict(list)

for row in results:
    property_trends[row['canonical_name']].append({
        'date': row['metric_date'],
        'sessions': row['sessions']
    })

# Calculate 7-day vs 30-day averages
for prop_name, data in property_trends.items():
    if len(data) >= 30:
        recent_7 = sum(d['sessions'] for d in data[:7]) / 7
        full_30 = sum(d['sessions'] for d in data) / 30
        change_pct = ((recent_7 - full_30) / full_30) * 100
        print(f"{prop_name}: 7d avg {recent_7:.0f} vs 30d avg {full_30:.0f} ({change_pct:+.1f}%)")

conn.close()
```

### Pattern 3: Email Report with Shared Config

```python
#!/usr/bin/env python3
"""
Send ad-hoc email report using shared SMTP config
"""
import json
import smtplib
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load email config
PARENT_DIR = Path(__file__).parent.parent
EMAIL_CONFIG = PARENT_DIR / "credentials" / "email_config.json"

with open(EMAIL_CONFIG) as f:
    config = json.load(f)

# Create email
msg = MIMEMultipart('alternative')
msg['From'] = config['sender_email']
msg['To'] = config['recipient_email']
msg['Subject'] = "[Ad-Hoc] Custom Analytics Report"

# Plain text version
text = """
Custom Analytics Report
=======================

[Your report content here]
"""

# HTML version (optional)
html = """
<html>
<body>
<h1>Custom Analytics Report</h1>
<p>[Your HTML report here]</p>
</body>
</html>
"""

msg.attach(MIMEText(text, 'plain'))
msg.attach(MIMEText(html, 'html'))

# Send email
server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
server.starttls()
server.login(config['sender_email'], config['sender_password'])
server.sendmail(config['sender_email'], config['recipient_email'], msg.as_string())
server.quit()

print("✅ Email sent")
```

## Common Use Cases

### 1. "Show me traffic for all properties in November"
- Query Portfolio Monitoring database
- Filter by date range
- Export to CSV or create visualization
- Store in `AdHoc_Reports/2025-11-traffic/`

### 2. "Compare top 10 vs bottom 10 performers this week"
- Query latest GA4 data via API
- Calculate performance metrics
- Generate comparison report
- Email results using shared config

### 3. "Create a conversion funnel report for spotlight properties"
- Use GA4 API with spotlight property list
- Query detailed conversion paths
- Analyze drop-off points
- Generate interactive dashboard

### 4. "Which properties have declining organic traffic?"
- Query database for 30-day trends
- Filter for negative traffic changes
- Cross-reference with SEO data
- Create alert report

### 5. "Performance audit for specific property"
- Fetch GA4 traffic data
- Run GTMetrix test
- Get PageSpeed Insights
- Query SEMRush rankings
- Combine into comprehensive PDF

## Working with Existing Systems

### Spotlight Properties Report

**When to use**:
- Need comprehensive weekly analysis
- Want performance + SEO + traffic combined
- Generating reports for spotlight properties only
- Need OneDrive integration

**How to extend**:
- Add new collectors in `src/collectors/`
- Modify report templates in `src/report_generator/`
- See `Spotlight_Properties_Report/WARP.md` for details

### Data Collection System (NEW - January 2026)

**Status**: PRODUCTION - Mission Critical - Corporate Scrutiny Ready

**When to use**:
- Need daily data collection for any/all 9 sources
- Want monitored, validated data with audit trail
- Tracking all 93 properties
- Building dashboards or reports on fresh data

**Features**:
- ✅ 9 data sources (GA4, GSC, PSI, SEMRush, Google Ads, GBP Reviews/Insights, ThirtyLines, GTMetrix)
- ✅ 45+ validation rules with quality scoring
- ✅ Full audit trail (collection tracking, API metrics, performance data)
- ✅ Automated email alerts (mlaufhutte@venterraliving.com)
- ✅ CollectionMonitor for bulletproof tracking
- ✅ 94.5% quality score (validated Jan 29, 2026)

**How to extend**:
- Add new collectors in `Data_Collection/collectors/`
- Add validation rules to database `validation_rules` table
- Extend `DataQualityValidator` in `Data_Collection/utils/`
- See `Data_Collection/README.md` and `Data_Collection/BULLETPROOF_MONITORING_SYSTEM.md`

### Portfolio Monitoring (DEPRECATED)

**Status**: ⚠️ Legacy system, no longer maintained as of January 27, 2026

**Replaced by**: `Data_Collection/` unified system

**Reason**: Import path conflicts caused 3-day data collection outage (Jan 25-27, 2026). The unified system eliminates these conflicts with single import paths.

## AI Assistant Guidelines

When returning to this directory:

### 1. Read This Document First
This `WARP.md` provides the complete context of how the platform works.

### 2. Understand the Request
- Is it a one-time ad-hoc analysis? → Create temporary script
- Is it a recurring report? → Consider new project directory
- Can existing systems handle it? → Extend Spotlight or Portfolio Monitoring
- Is it a dashboard/visualization? → Create new project with shared resources

### 3. Leverage Existing Code
- Copy patterns from `Spotlight_Properties_Report/src/collectors/`
- Use database queries from `Portfolio_Monitoring/src/db/`
- Reference email templates from both systems
- Don't reinvent - reuse and adapt

### 4. Maintain Structure
- New ad-hoc reports: `AdHoc_Reports/YYYY-MM-DD_description/`
- New recurring systems: Create new project directory at parent level
- Always use shared `credentials/` and `config/`
- Document what you create

### 5. Follow Patterns
- Import shared credentials via relative paths (`../credentials/`)
- Load properties from shared config (`../config/`)
- Save outputs to project-specific directories
- Create `README.md` for any new project
- Use `.gitignore` for sensitive data

## Property Information Reference

### Spotlight Properties (39)
High-priority properties with detailed tracking:
- Located in: `config/properties_registry.json`
- Structure: Detailed metadata including URLs, locations, managers, tags
- Used by: Weekly Spotlight Report

### Full Portfolio (93)
Complete property list (OFFICIAL REGISTRY):
- Located in: `config/venterra_properties_official.json`
- Structure: Property ID, canonical name, GA4 ID, URL, location, active status
- Used by: Data_Collection system, all new projects
- Status: 92 properties collecting, 1 new (Sundara at Spring Cypress)

### Legacy Configurations (deprecated):
- `config/venterra_all_properties_ga4.json` - 91 properties (old system)
- Used by: Spotlight Report (until migrated)

### Key Property Fields
```json
{
  "property_name": {
    "ga4_property_id": "378403365",
    "full_url": "https://propertyname.com",
    "location": "City, State",
    "manager": "Manager Name",
    "active": true
  }
}
```

## Database Schema Reference

**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

### Core Tables
- `properties` - Official property registry (93 properties)
- `ga4_daily_metrics` - Daily GA4 traffic data
- `gsc_daily_data` - Google Search Console data
- `psi_daily_metrics` - PageSpeed Insights scores
- `google_ads_daily` - Google Ads performance
- `semrush_rankings` - SEO keyword rankings
- `gbp_reviews` - Google Business Profile reviews
- `gbp_insights` - GBP views and actions
- `property_floorplans` - ThirtyLines floor plan data
- `unit_availability` - ThirtyLines unit availability
- `gtmetrix_reports` - GTMetrix performance tests

### Monitoring & Quality Tables
- `data_collections` - Collection execution tracking (start/end times, success rates, API metrics)
- `collection_errors` - Error logs with stack traces
- `data_quality_checks` - Per-property validation results
- `data_quality_scores` - Quality scores by property/source/date
- `validation_rules` - 45+ active validation rules

### Legacy Views (from old Portfolio Monitoring)
- `v_latest_property_metrics` - Most recent data for all properties
- `v_property_trends_7d` - 7-day rolling statistics
- `v_active_issues` - Current problems across portfolio

### Example Queries

**Get latest metrics:**
```sql
SELECT * FROM v_latest_property_metrics 
ORDER BY health_score 
LIMIT 10;
```

**30-day traffic trend:**
```sql
SELECT metric_date, SUM(sessions) as total_sessions
FROM ga4_daily_metrics
WHERE metric_date >= DATE('now', '-30 days')
GROUP BY metric_date
ORDER BY metric_date;
```

**Properties with issues:**
```sql
SELECT canonical_name, issue_type, severity, description
FROM v_active_issues
WHERE severity IN ('critical', 'high');
```

## Credentials Reference

All credentials are in `credentials/` directory (NOT in Git):

| File | Purpose | Used By |
|------|---------|---------|
| `authentic-reach-*.json` | GA4 service account (read-only) | All GA4 data collection |
| `client_secret*.json` | Google OAuth tokens | GSC, GBP, OAuth flows |
| `email_config.json` | **AWS SES SMTP** (PRIMARY) | All automated emails from @venterraliving.com |
| `email_config.json.gmail_backup` | Gmail SMTP (BACKUP) | Fallback email configuration |
| `gbp_api_config.json` | Google Business Profile | Location data, reviews |

**Email Configuration**:
- **Primary**: AWS SES (`email_config.json`) - Sends from `mlaufhutte@venterraliving.com`
- **Backup**: Gmail (`email_config.json.gmail_backup`) - Can be restored if AWS SES fails
- **Location**: All scripts use `from Data_Collection.utils.email_sender import EmailSender`

**Never commit credentials to Git!** Always reference via `../credentials/`.

## Creating New Projects

When creating a new recurring system (like a monthly dashboard):

1. **Create project directory** at parent level:
   ```
   ~/Property_Analytics/Monthly_Dashboard/
   ```

2. **Initialize Git repo** (optional but recommended):
   ```bash
   cd ~/Property_Analytics/Monthly_Dashboard
   git init
   git remote add origin git@github.com:markartist/monthly-dashboard.git
   ```

3. **Create `.gitignore`**:
   ```
   credentials/
   config/
   data/*.json
   data/*.csv
   *.log
   ```

4. **Reference shared resources**:
   ```python
   PARENT_DIR = Path(__file__).parent.parent
   CREDENTIALS = PARENT_DIR / "credentials"
   CONFIG = PARENT_DIR / "config"
   ```

5. **Document in `README.md`** with:
   - Purpose and schedule
   - Data sources used
   - Output format and location
   - How to run manually

6. **Add to parent `README.md`** so others know it exists

## Troubleshooting

### "Cannot find credentials"
- Ensure working directory is correct: `pwd` should show project folder
- Credentials are in `~/Property_Analytics/credentials/`
- Use relative path: `../credentials/filename.json`

### "Property not found"
- Check which config file you're using
- Spotlight properties (39): `properties_registry.json`
- Full portfolio (91): `venterra_all_properties_ga4.json`
- Verify property name spelling matches exactly

### "Database locked"
- Another process has the database open
- Close connections properly: `conn.close()`
- Use context managers: `with sqlite3.connect(db) as conn:`

### "API quota exceeded"
- GA4: 250K tokens/day (shared across all projects)
- Check usage in Google Cloud Console
- Implement caching to reduce calls
- Space out requests if running multiple reports

## Summary

**Property Analytics is a platform, not an application.**

It provides:
- ✅ **Unified data collection system** (Data_Collection/) - Mission Critical, Corporate Scrutiny Ready
- ✅ **9 data sources** with daily collection: GA4, GSC, PSI, SEMRush, Google Ads, GBP (Reviews/Insights), ThirtyLines, GTMetrix
- ✅ **93 properties** tracked in official registry
- ✅ **94.5% quality score** with 45+ validation rules and full audit trail
- ✅ **Single database** (`portfolio_analytics.db`) - no more import conflicts
- ✅ Shared credentials and configurations
- ✅ Reusable code patterns
- ✅ Three production reporting systems:
  - Data Collection (daily monitoring)
  - Spotlight Properties Report (weekly deep-dive)
  - Property Intelligence Brief (on-demand executive reports) ⭐ NEW
- ✅ Framework for ad-hoc reports and dashboards

**When working in this directory:**
1. Read this document to understand the ecosystem
2. Leverage existing collectors and patterns
3. Use shared resources (credentials, config, database)
4. Create new projects as needed
5. Document everything you create
6. Follow established patterns

**This is a living platform.** New reports, dashboards, and analyses can be created on-demand by combining the available data sources and building on proven patterns.

---

**For AI Assistants**: When you return to this directory and read this document, you should understand:
- This is a modular analytics platform for **93 properties** (updated from 91)
- **Data_Collection/** is the primary system - MISSION CRITICAL, Corporate Scrutiny Ready
- **9 data sources** collecting daily with 94.5% quality score and full audit trail
- **Single database** (`data/portfolio_analytics.db`) - single source of truth
- **Official registry** (`config/venterra_properties_official.json`) - 93 properties
- **Portfolio_Monitoring/** is DEPRECATED (replaced by Data_Collection as of Jan 27, 2026)
- Three production reporting systems:
  - Data_Collection (daily monitoring)
  - Spotlight Properties Report (weekly deep-dive)
  - Property Intelligence Brief v2.0.0 (on-demand executive reports) ⭐ NEW
- Shared resources enable rapid ad-hoc report creation
- You can build new analytics on-demand using existing patterns
- Everything is documented and follows consistent structure
- New projects reference shared credentials/config via relative paths

**IMPORTANT**: Always use `Data_Collection/` for data access. The unified system eliminates import conflicts and provides bulletproof monitoring with audit trail suitable for corporate scrutiny.

You are now equipped to create any analytics report the user requests by drawing from the validated, monitored data sources in the unified collection system.
