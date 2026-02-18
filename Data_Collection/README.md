# Unified Data Collection System

**Created**: January 27, 2026  
**Purpose**: Consolidated data collection system for Venterra's 91-property portfolio

## Overview

This unified system consolidates all data collection logic that was previously scattered across:
- `Portfolio_Monitoring/` 
- `Spotlight_Properties_Report/`
- `Portfolio_Dashboard/`

## Structure

```
Data_Collection/
├── collectors/          # Individual data source collectors
├── db/                  # Database manager (single source of truth)
├── orchestration/       # Main collection scripts and scheduling
├── monitoring/          # Collection monitoring, alerting, validation
├── utils/               # Shared utilities (preflight, quality checks)
├── config/              # Configuration files
├── logs/                # Collection logs
└── tests/               # Unit and integration tests
```

## Key Benefits

1. **No Import Conflicts**: Single, clean import path
2. **Single DatabaseManager**: One canonical version with all methods
3. **Unified Monitoring**: Consistent monitoring across all collectors
4. **Easier Maintenance**: All collection logic in one place
5. **Better Testing**: Isolated components, easier to test

## Usage

### Running Collections

```bash
# Test mode (3 properties)
python3 orchestration/daily_master_collection.py --test

# Quick mode (GA4 + GSC only)
python3 orchestration/daily_master_collection.py --quick

# Full collection
python3 orchestration/daily_master_collection.py
```

### Imports

```python
from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.collectors.gsc_collector import GoogleSearchConsoleCollector
from Data_Collection.monitoring.collection_monitor import CollectionMonitor
```

## Scheduled Jobs

- **Main Collection**: 5:00 AM daily (`com.venterra.portfolio.collection`)
  - Includes comprehensive daily report sent after collection completes
- **Health Reports**: 9:00 AM daily (`com.venterra.daily.health`)
- **Weekly Progress**: 10:00 AM Mondays (`com.venterra.weekly.progress`)

## Database

**Location**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Registry**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

## Migration Notes

This system was created to resolve import path conflicts that caused a 3-day data collection outage (Jan 25-27, 2026).

**Root cause**: Multiple `collectors` and `db` packages in different locations caused Python to import incomplete versions.

**Solution**: Unified structure with single import path eliminates conflicts.

## Monitoring

### System Status: ✅ MISSION CRITICAL - CORPORATE SCRUTINY READY

**Last Validated**: February 2, 2026 at 12:00 PM CST

- ✅ Collection success/failure tracked in `data_collections` table
- ✅ Errors logged to `collection_errors` table  
- ✅ Data quality validation via `data_quality_validator`
- ✅ **Daily Collection Report** sent after each run to `mlaufhutte@venterraliving.com`
  - **Sent from**: mlaufhutte@venterraliving.com (AWS SES)
  - Shows collection results (success/failure by source)
  - Database health snapshot (record counts, latest dates)
  - Data freshness status (all sources)
- ✅ **9 data sources** monitored with **45+ validation rules**
- ✅ **93 properties** validated against official registry
- ✅ **API delay handling**: GSC (3-day), GBP Insights (2-day)
- ✅ **Quality score**: 94.5% average across all sources
- ✅ **Audit trail**: Complete collection history with timestamps, API metrics, performance data

### Daily Collection Report (NEW - Feb 2, 2026)

After each collection run, a comprehensive HTML email report is sent showing:

1. **Collection Results** (Last 24 Hours)
   - Status by data source (GA4, GSC, Ads, PSI, GBP, ThirtyLines, etc.)
   - Success/failure counts per property
   - Duration and completion time
   
2. **Database Health Snapshot**
   - Current record counts for all sources
   - Latest data dates
   - Data range (earliest to latest)
   
3. **Data Freshness Status**
   - Days since last update for each source
   - Fresh/Stale/Missing indicators
   - Expected lag notes (e.g., GSC 3-5 day API lag)

**Location**: `monitoring/daily_collection_report.py`  
**Run manually**: `python3 monitoring/daily_collection_report.py [--test]`

**Replaces**: Old alert-only system that only sent emails on failures

### Email Configuration

**Primary Method: AWS SES**
- **Config File**: `/Users/mark/Property_Analytics/credentials/email_config.json`
- **Provider**: `aws_ses`
- **Sender**: `mlaufhutte@venterraliving.com`
- **Display Name**: Mark Laufhutte - Venterra Analytics
- **All systems use**: `from Data_Collection.utils.email_sender import EmailSender`

**Backup Method: Gmail**
- **Config File**: `/Users/mark/Property_Analytics/credentials/email_config.json.gmail_backup`
- **Provider**: `gmail`
- **To restore**: Copy `.gmail_backup` to `email_config.json`

### Recent Collection Status:
- GA4: 92/93 properties (99% quality)
- GSC: 91/93 properties (81% quality, 3-day API delay)
- PSI: 93/93 properties (100% quality - PERFECT)
- GBP Insights: 91/93 properties (100% quality, 2-day API delay)
- GBP Reviews: 19 properties with recent reviews (100% quality)
- SEMRush: 92/93 properties (fresh data)
- Google Ads: 57/93 active campaigns (fresh data)
- ThirtyLines: 92/93 properties (88% quality)
- GTMetrix: Weekly/monthly only (not daily)

See `BULLETPROOF_MONITORING_SYSTEM.md` and `DATA_FRESHNESS_REPORT_2026-01-29.md` for complete details.

## Development

### Adding a New Collector

1. Create collector class in `collectors/your_collector.py`
2. Inherit from base patterns (see existing collectors)
3. Use `DatabaseManager` for all database operations
4. Use `CollectionMonitor` for tracking
5. Add to orchestration script
6. Write tests

### Testing

```bash
# Run unit tests
pytest tests/

# Test specific collector
python3 -m collectors.your_collector --test
```

## Support

**Issues**: Check `/Users/mark/Property_Analytics/Data_Collection/logs/`  
**Database**: Use `sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Monitoring**: Review `collection_errors` and `data_collections` tables
