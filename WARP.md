# Property Analytics - AI Assistant Guide

**Last Updated**: December 18, 2025  
**Purpose**: This document helps AI assistants understand the Property Analytics ecosystem and how to work within it effectively.

## Overview

**Property Analytics** is a modular analytics platform for 91 Venterra real estate properties. It's designed as a **shared codebase and infrastructure** from which multiple reporting systems, dashboards, and ad-hoc analyses can be built.

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
│   ├── properties_registry.json   # 39 spotlight properties
│   ├── venterra_all_properties_ga4.json  # All 91 properties
│   └── all_ga4_properties.json    # GA4 property mappings
│
├── Spotlight_Properties_Report/   # Production: Weekly reporting system
│   ├── Repository: github.com/markartist/spotlight-properties-report
│   ├── Purpose: Deep-dive weekly reports for key properties
│   ├── Schedule: Weekly (typically Wednesday)
│   └── Output: CSV reports to OneDrive
│
├── Portfolio_Monitoring/          # Production: Daily monitoring system
│   ├── Repository: github.com/markartist/portfolio-monitoring
│   ├── Purpose: Daily health monitoring and alerts
│   ├── Schedule: Daily (6 AM monitoring, 7 AM email)
│   └── Output: Email alerts + SQLite database
│
└── [Future Projects]              # Ad-hoc reports, dashboards, analyses
    └── Can be created on-demand using shared resources
```

## How This Platform Works

### 1. Shared Data Collectors

Both existing systems use common patterns for data collection:

**GA4 Traffic Data**:
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

**Email Reporting**:
```python
# Shared SMTP configuration
with open('../credentials/email_config.json', 'r') as f:
    email_config = json.load(f)
```

### 2. Data Sources Available

| Source | Purpose | Location | Access Method |
|--------|---------|----------|---------------|
| **GA4** | Traffic, conversions, engagement | `credentials/authentic-reach-*.json` | Service account (read-only) |
| **GTMetrix** | Performance testing | API key in Spotlight code | HTTP API |
| **PageSpeed Insights** | Core Web Vitals | Public API | No auth required |
| **SEMRush** | SEO rankings, keywords | API key in Spotlight code | HTTP API |
| **Google Search Console** | Search performance | OAuth in `credentials/` | OAuth2 client |
| **Google Business Profile** | Location data, reviews | `credentials/gbp_api_config.json` | Service account |
| **SQLite DB** | Historical analytics | `Portfolio_Monitoring/data/` | Direct SQL access |

### 3. Property Data Structure

**39 Spotlight Properties** (`properties_registry.json`):
- Key properties with detailed tracking
- Includes: GA4 ID, URL, location, manager, tags
- Used by: Weekly Spotlight Report

**91 Full Portfolio** (`venterra_all_properties_ga4.json`):
- Complete property list
- Includes: GA4 ID, name, location, active status
- Used by: Portfolio Monitoring, ad-hoc reports

### 4. Database Infrastructure

**Portfolio Monitoring Database** (`Portfolio_Monitoring/data/portfolio_monitoring.db`):
- **20 tables**: GA4 metrics, performance, SEO, health scores
- **3 views**: Latest metrics, trends, active issues
- **Historical data**: 30+ days of daily metrics
- **Query-ready**: Optimized indexes for fast analysis

## Creating Ad-Hoc Reports

When a user requests an analytics report, follow this pattern:

### Step 1: Determine Scope
- Which properties? (Subset of 39 spotlight, all 91, or specific properties)
- What metrics? (Traffic, conversions, performance, SEO, all of above)
- Time period? (Daily, weekly, monthly, date range)
- Output format? (CSV, PDF, email, dashboard, database query)

### Step 2: Choose Data Sources
Use existing patterns from `Spotlight_Properties_Report/` or `Portfolio_Monitoring/`:
- **GA4 traffic**: See `portfolio_daily_monitor.py` for API calls
- **Performance**: See `gtmetrix_collector.py` in Spotlight repo
- **SEO**: See `semrush_collector.py` in Spotlight repo
- **Historical data**: Query `Portfolio_Monitoring/data/portfolio_monitoring.db`

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

# Access database
DB_PATH = PARENT_DIR / "Portfolio_Monitoring" / "data" / "portfolio_monitoring.db"
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
DB_PATH = PARENT_DIR / "Portfolio_Monitoring" / "data" / "portfolio_monitoring.db"

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

### Portfolio Monitoring

**When to use**:
- Need real-time health monitoring
- Want automated daily alerts
- Tracking all 91 properties
- Building dashboards on historical data

**How to extend**:
- Add new metrics to database schema
- Create custom email alert templates
- Build new queries/views
- See `Portfolio_Monitoring/README.md` for details

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

### Full Portfolio (91)
Complete property list:
- Located in: `config/venterra_all_properties_ga4.json`
- Structure: GA4 IDs, names, locations, active status
- Used by: Portfolio Monitoring, ad-hoc reports

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

The Portfolio Monitoring database contains:

### Core Tables
- `properties` - Property master list
- `ga4_daily_metrics` - Daily traffic data
- `property_health` - Health scores and status
- `health_issues` - Detected problems

### Useful Views
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
| `email_config.json` | SMTP settings | Automated emails |
| `gbp_api_config.json` | Google Business Profile | Location data, reviews |

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
- ✅ Shared data collectors and credentials
- ✅ Reusable code patterns
- ✅ Common property configurations
- ✅ Historical database of metrics
- ✅ Two production systems (Spotlight, Portfolio)
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
- This is a modular analytics platform for 91 properties
- Two production systems exist (Spotlight weekly, Portfolio daily)
- Shared resources enable rapid ad-hoc report creation
- You can build new analytics on-demand using existing patterns
- Everything is documented and follows consistent structure
- New projects reference shared credentials/config via relative paths

You are now equipped to create any analytics report the user requests by drawing from available data sources and following established patterns.
