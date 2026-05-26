# Property Analytics

> Historical document only.
> Current secret-management standard is Keeper Secrets Manager via the local `marketingops` profile.
> Prefer `/Users/mark/Property_Analytics/README.md` and `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`.
> File-based credential paths in this document should be treated as legacy fallback, not default setup.

Comprehensive analytics and monitoring systems for 91 Venterra real estate properties.

## Overview

This repository contains two independent but complementary systems:

### 1. **Spotlight Properties Report** (`Spotlight_Properties_Report/`)
Weekly reporting system for spotlight properties with comprehensive performance analysis.

**Purpose**: Deep-dive weekly reports for key properties
**Frequency**: Weekly (typically Wednesday)
**Properties**: 39 spotlight properties
**Output**: CSV reports with recommendations
**Data Sources**: GA4, GTMetrix, PageSpeed Insights, SEMRush
**Repository**: https://github.com/markartist/spotlight-properties-report

**Key Features:**
- Weekly traffic analysis with 30-day trends
- Performance scoring (GTMetrix, PageSpeed Insights)
- SEO metrics (SEMRush rankings)
- Automated recommendations
- OneDrive integration for report delivery

### 2. **Portfolio Monitoring** (`Portfolio_Monitoring/`)
Daily monitoring and alerting system for the entire portfolio.

**Purpose**: Daily health monitoring and alerts
**Frequency**: Daily (runs at 6 AM)
**Properties**: All 91 properties
**Output**: Email alerts, SQLite database
**Data Sources**: GA4, historical trends
**Repository**: https://github.com/markartist/portfolio-monitoring

**Key Features:**
- Daily GA4 traffic monitoring
- Health scoring (0-100) with status indicators
- Anomaly detection (traffic drops, conversion issues)
- Automated email briefs
- SQLite database for historical analysis

## Directory Structure

```
Property_Analytics/
├── credentials/                    # Shared API credentials
│   ├── authentic-reach-*.json     # GA4 service account
│   ├── client_secret*.json        # Google OAuth clients
│   ├── email_config.json          # SMTP settings
│   └── gbp_api_config.json        # Google Business Profile API
│
├── config/                         # Shared property configurations
│   ├── properties_registry.json   # 39 spotlight properties
│   ├── venterra_all_properties_ga4.json  # All 91 properties
│   └── all_ga4_properties.json    # GA4 property mappings
│
├── Spotlight_Properties_Report/   # Weekly reporting system
│   ├── generate_weekly_spotlight_report_registry.py
│   ├── src/                       # Source code
│   ├── config/                    # Local configs (symlinks to ../config)
│   ├── data/                      # Weekly report data
│   └── reports/                   # Generated CSV reports
│
└── Portfolio_Monitoring/          # Daily monitoring system
    ├── portfolio_daily_monitor.py # Daily monitoring script
    ├── portfolio_email_reports.py # Email reporter
    ├── src/db/                    # Database operations
    ├── schema/                    # SQLite schema
    ├── data/                      # Database and snapshots
    └── docs/                      # Documentation
```

## Shared Resources

Both systems share:

### Credentials (`credentials/`)
- **GA4 Service Account**: `authentic-reach-474618-r6-16e824bab2c3.json`
- **Google OAuth**: `client_secret.json` and variants
- **Email Config**: `email_config.json` (SMTP settings)
- **GBP API**: `gbp_api_config.json`

### Configuration (`config/`)
- **Spotlight Properties**: `properties_registry.json` (39 properties)
- **Full Portfolio**: `venterra_all_properties_ga4.json` (91 properties)
- **GA4 Mappings**: `all_ga4_properties.json`

## Quick Start

### Spotlight Properties Report (Weekly)
```bash
cd ~/Property_Analytics/Spotlight_Properties_Report
python3 generate_weekly_spotlight_report_registry.py
```

### Portfolio Monitoring (Daily)
```bash
cd ~/Property_Analytics/Portfolio_Monitoring

# Run daily monitoring
python3 portfolio_daily_monitor.py

# Send email report
python3 portfolio_email_reports.py
```

## Setup

### Initial Setup
```bash
cd ~/Property_Analytics

# Install Python dependencies (both projects)
pip3 install google-analytics-data google-auth pandas openpyxl

# Verify credentials exist
ls -l credentials/
ls -l config/

# Test Spotlight system
cd Spotlight_Properties_Report
python3 generate_weekly_spotlight_report_registry.py

# Test Portfolio Monitoring
cd ../Portfolio_Monitoring
python3 src/db/database_manager.py
python3 portfolio_daily_monitor.py
```

### Automated Scheduling

Add to crontab (`crontab -e`):

```bash
# Weekly Spotlight Report (Wednesday 9 AM)
0 9 * * 3 cd ~/Property_Analytics/Spotlight_Properties_Report && python3 generate_weekly_spotlight_report_registry.py >> logs/weekly_report.log 2>&1

# Daily Portfolio Monitoring (6 AM)
0 6 * * * cd ~/Property_Analytics/Portfolio_Monitoring && python3 portfolio_daily_monitor.py >> logs/monitor.log 2>&1

# Daily Portfolio Email (7 AM)
0 7 * * * cd ~/Property_Analytics/Portfolio_Monitoring && python3 portfolio_email_reports.py >> logs/email.log 2>&1
```

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│                   Property Analytics                 │
└─────────────────────────────────────────────────────┘
                           │
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌───────────────────┐              ┌──────────────────┐
│ Spotlight Report  │              │ Portfolio Monitor│
│   (Weekly)        │              │    (Daily)       │
└───────────────────┘              └──────────────────┘
        │                                     │
        │                                     │
   ┌────┴────┐                          ┌────┴────┐
   ▼         ▼                          ▼         ▼
┌──────┐ ┌──────┐                  ┌──────┐ ┌──────┐
│ CSV  │ │OneDrive│               │SQLite│ │Email │
│Reports│ │      │                 │  DB  │ │Alerts│
└──────┘ └──────┘                  └──────┘ └──────┘
```

## System Comparison

| Feature | Spotlight Report | Portfolio Monitor |
|---------|------------------|-------------------|
| **Frequency** | Weekly | Daily |
| **Properties** | 39 spotlight | All 91 |
| **Focus** | Deep analysis | Health monitoring |
| **Output** | CSV reports | Email alerts + DB |
| **Data Sources** | GA4, GTM, PSI, SEMRush | GA4 only |
| **Storage** | JSON snapshots | SQLite database |
| **Delivery** | OneDrive | Email |
| **Run Time** | ~15-20 min | ~5 min |

## Credentials Management

### Updating Shared Credentials

When updating credentials, update in the shared directory:

```bash
# Update GA4 service account
cp new-service-account.json ~/Property_Analytics/credentials/

# Update email config
nano ~/Property_Analytics/credentials/email_config.json

# Both systems will automatically use updated credentials
```

### Adding New Properties

1. Update `config/venterra_all_properties_ga4.json` for all 91 properties
2. Update `config/properties_registry.json` for spotlight subset
3. Both systems will pick up new properties automatically

## Repository Information

### Spotlight Properties Report
- **GitHub**: https://github.com/markartist/spotlight-properties-report
- **Branch**: main
- **Remote**: git@github.com:markartist/spotlight-properties-report.git

### Portfolio Monitoring
- **GitHub**: https://github.com/markartist/portfolio-monitoring
- **Branch**: main
- **Remote**: git@github.com:markartist/portfolio-monitoring.git

## Documentation

### Platform Overview
- **`WARP.md`** - Complete platform guide for AI assistants (START HERE)
- `README.md` - This file (quick reference)
- `MIGRATION_COMPLETE.md` - Project reorganization summary

### Spotlight Properties Report
- `Spotlight_Properties_Report/WARP.md` - System documentation
- `Spotlight_Properties_Report/README.md` - Quick reference

### Portfolio Monitoring
- `Portfolio_Monitoring/README.md` - System overview
- `Portfolio_Monitoring/docs/DATABASE_QUICKSTART.md` - Database reference
- `Portfolio_Monitoring/docs/DATABASE_MIGRATION_GUIDE.md` - Complete guide
- `Portfolio_Monitoring/docs/PORTFOLIO_MONITORING_PLAN.md` - Architecture

## Troubleshooting

### Credentials Not Found
```bash
# Verify shared credentials exist
ls -l ~/Property_Analytics/credentials/
ls -l ~/Property_Analytics/config/

# If missing, copy from Spotlight repo
cp ~/Property_Analytics/Spotlight_Properties_Report/config/*.json ~/Property_Analytics/credentials/
```

### Import Errors
```bash
# Ensure you're in the correct project directory
cd ~/Property_Analytics/Spotlight_Properties_Report  # or Portfolio_Monitoring
pwd  # Verify location

# Check Python path
python3 -c "import sys; print('\n'.join(sys.path))"
```

### Database Issues (Portfolio Monitoring)
```bash
cd ~/Property_Analytics/Portfolio_Monitoring

# Rebuild database
python3 src/db/database_manager.py

# Check integrity
sqlite3 data/portfolio_monitoring.db "PRAGMA integrity_check;"
```

## Support

For issues with specific systems:
- **Spotlight Report**: See `Spotlight_Properties_Report/WARP.md`
- **Portfolio Monitor**: See `Portfolio_Monitoring/README.md`

## Git Workflow

### Committing Changes

**Spotlight Properties Report:**
```bash
cd ~/Property_Analytics/Spotlight_Properties_Report
git add .
git commit -m "Description

Co-Authored-By: Warp <agent@warp.dev>"
git push origin main
```

**Portfolio Monitoring:**
```bash
cd ~/Property_Analytics/Portfolio_Monitoring
git add .
git commit -m "Description

Co-Authored-By: Warp <agent@warp.dev>"
git push origin main
```

### Shared Resources
Credentials and config are **not** in git (excluded by `.gitignore`). Changes must be made manually on the server.

## Maintenance

### Weekly
- Review Spotlight reports in OneDrive
- Check Portfolio email alerts

### Monthly
- Verify both systems running via cron
- Check database size: `du -h ~/Property_Analytics/Portfolio_Monitoring/data/`
- Archive old data if needed

### Quarterly
- Review API quota usage
- Update property configs as needed
- Audit credential expiration dates
