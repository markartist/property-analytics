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

- Collection success/failure tracked in `data_collections` table
- Errors logged to `collection_errors` table  
- Data quality validation via `data_quality_validator`
- Email alerts sent to `mlaufhutte@venterraliving.com`

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
