# Portfolio Analytics Data Collection System

## Overview
Automated daily data collection system for 91 Venterra properties across multiple analytics platforms.

**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Schedule**: Daily at 5:00 AM via launchd  
**Monitoring**: Email alerts sent after each collection run

---

## Data Sources Collected

| Source | Properties | Freshness | Notes |
|--------|-----------|-----------|-------|
| **Google Analytics 4** | 90 unique | Yesterday (T-1) | 91 registry entries, 1 shared GA4 ID |
| **Google Search Console** | 92 | 3 days ago (T-3) | Google API has inherent 3-day lag |
| **Google Ads** | 57 | Yesterday (T-1) | Single manager account (9089267423) |
| **PageSpeed Insights** | 90 | Today (T-0) | Mobile + Desktop strategies |
| **SEMRush** | 90 | Today (T-0) | Domain metrics + rankings |
| **GTMetrix** | Disabled | N/A | Skipped with --no-gtmetrix flag |

**Total Records in DB**: 
- GA4: 11,257 records
- GSC: 11,261 records  
- Google Ads: 508 records
- PSI: 1,646 records
- SEMRush: Active

---

## Collection Architecture

### Main Script: `collect_daily_data.py`
Consolidated collector that runs all data sources in sequence:

```python
# Collection Order (with pauses between each):
1. GA4 Analytics (14 days with daily breakdown)
2. Google Search Console (14 days with daily breakdown)
3. Google Ads (yesterday's campaign data)
4. PageSpeed Insights (calls collect_daily_psi.py)
5. SEMRush (domain metrics)
6. GTMetrix (disabled via --no-gtmetrix)
```

### Shell Wrapper: `run_full_daily_collection.sh`
Orchestrates the full workflow:

```bash
# Main workflow
1. Run collect_daily_data.py --no-gtmetrix
2. Legacy GA4 rollup collection (for CIR)
3. CIR (Conversion Intent Rate) computation
4. Data verification (checks row counts per table)
5. Email alert system (send_data_alerts.py)
```

### Scheduled Execution
**LaunchAgent**: `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist`
- Runs daily at 5:00 AM
- Logs to: `/Users/mark/Property_Analytics/Portfolio_Monitoring/logs/`
- Exit code 0 = success, 1 = verification failed

---

## Data Validation

### Automated Verification
After collection, the system verifies:

```bash
# Expected row counts per table:
✓ ga4_daily_metrics: ≥85 rows for yesterday
✓ gsc_daily_metrics: ≥85 rows for T-3 days
✓ google_ads_campaigns: (verified by alert system)
✓ pagespeed_metrics: ≥85 rows for today
✓ semrush_domain_metrics: ≥85 rows for today
```

### Email Alerts
System sends email after each collection run:

**Alert Thresholds**:
- GA4: Missing if no data for yesterday
- GSC: Missing if no data for T-3, stale if > T-5
- Google Ads: Missing if no data for yesterday
- PSI: Stale if > 7 days old
- SEMRush: (basic monitoring)

**Email Recipient**: mlaufhutte@venterraliving.com  
**SMTP**: Gmail (credentials in `/Users/mark/Property_Analytics/credentials/email_config.json`)

---

## Google Ads Architecture

### Single Manager Account Model
All properties share one Google Ads account:
- **Manager Account ID**: 9089267423
- **73 campaigns** mapped to **57 properties**
- **Mapping method**: Campaign names contain property names

### Campaign-to-Property Mapping
Generated via: `Portfolio_Dashboard/scripts/analyze_google_ads_campaigns.py`
- Creates: `config/google_ads_campaign_analysis.json`
- Maps campaigns to properties by name matching
- Used by collector to filter campaigns per property

### Collection Process
```python
# For each property:
1. Load campaign IDs from mapping file
2. Query Google Ads API with campaign ID filter
3. Collect: impressions, clicks, conversions, cost, CTR, CPC
4. Store in google_ads_campaigns table with property_id
```

---

## Key Data Delays & Considerations

### API Lag Times (Confirmed by Testing)
| Source | Expected Lag | Reason |
|--------|-------------|---------|
| GA4 | 1 day | Standard processing time |
| GSC | **3 days** | Google API limitation (tested & confirmed) |
| Google Ads | 1 day | Campaign performance available next day |
| PSI | 0 days | Real-time test |
| SEMRush | 0-1 days | Daily updates |

### GSC 3-Day Lag Verification
On Jan 23, 2026:
- Attempted to collect Jan 21-22 data
- Google API returned 403 Forbidden
- Only Jan 20 data available
- **Conclusion**: 3-day lag is real, not a collection error

---

## Database Schema

### Core Tables
```sql
-- GA4 daily metrics per property
ga4_daily_metrics (property_id, metric_date, sessions, users, ...)

-- GSC daily metrics per site
gsc_daily_metrics (gsc_site_url, metric_date, clicks, impressions, ...)

-- Google Ads campaign performance
google_ads_campaigns (property_id, campaign_id, metric_date, cost_micros, ...)

-- PageSpeed Insights
pagespeed_metrics (property_id, metric_date, strategy, performance_score, ...)

-- SEMRush domain metrics
semrush_domain_metrics (property_id, metric_date, organic_keywords_count, ...)
```

### Supporting Tables
```sql
-- Google Ads mapping
google_ads_property_mapping (property_id, customer_id, ...)

-- Additional Google Ads tables (Phase 2)
google_ads_ad_groups, google_ads_ads, google_ads_keywords
```

---

## Configuration Files

### Property Registry
**Master**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- 91 properties total
- Contains: GA4 IDs, GSC URLs, full URLs, names
- Single source of truth for all collectors

### Credentials
```
Google Ads API: Portfolio_Monitoring/google-ads.yaml
Gmail SMTP: credentials/email_config.json
GA4: Spotlight_Properties_Report/config/venterra-property-analytics-*.json
PSI API: Spotlight_Properties_Report/config/pagespeed_api_key.txt
SEMRush API: Spotlight_Properties_Report/config/semrush_api_key.txt
```

---

## Logs & Monitoring

### Log Locations
```
Daily collection: logs/full_collection_YYYYMMDD_HHMMSS.log
Collection stdout: logs/collection_stdout.log
Collection stderr: logs/collection_stderr.log
Monitoring: logs/monitoring_stdout.log
PSI collection: ~/Property_Analytics/logs/psi_daily_collection.log
```

### Monitoring Commands
```bash
# Check last collection status
tail -50 ~/Property_Analytics/Portfolio_Monitoring/logs/collection_stdout.log

# Test email alerts
cd ~/Property_Analytics/Portfolio_Monitoring
python3 send_data_alerts.py --test

# Check launchd job status
launchctl list | grep venterra.portfolio.collection

# Manual collection run
./run_full_daily_collection.sh
```

---

## Maintenance & Troubleshooting

### Common Issues

**1. GSC data appears stale**
- Check if it's within 3-day window (normal)
- GSC API has confirmed 3-day lag
- Only alert if > 5 days old

**2. Google Ads not collecting**
- Verify campaign mapping file exists: `config/google_ads_campaign_analysis.json`
- Check credentials: `Portfolio_Monitoring/google-ads.yaml`
- Regenerate mapping: `python3 Portfolio_Dashboard/scripts/analyze_google_ads_campaigns.py`

**3. PSI collection slow/timing out**
- PSI tests 90 properties × 2 strategies = 180 API calls
- Expected duration: ~8-10 minutes
- Timeout set to 10 minutes

**4. Missing data for specific property**
- Check property registry has correct IDs
- Verify property still active
- Check collector logs for specific errors

### Data Backfill
```bash
# GA4 backfill (not yet implemented)
# GSC backfill (API limitations apply)
# Google Ads backfill
cd Portfolio_Dashboard/scripts
python3 collect_google_ads_data.py --backfill 30
```

---

## Scripts Reference

### Main Collectors
```
collect_daily_data.py              # Main consolidated collector
collect_google_ads_data.py         # Google Ads standalone (also called by main)
collect_daily_psi.py              # PSI collector (called by main via subprocess)
```

### Analysis & Utilities
```
analyze_google_ads_campaigns.py   # Generate campaign-to-property mapping
discover_google_ads_accounts.py   # List accessible Google Ads accounts
send_data_alerts.py               # Email alert system
monitor_data_collection.py        # Data freshness monitoring
```

### Supporting Scripts
```
collect_ga4_rollup_data.py        # Legacy GA4 rollup (for CIR)
compute_cir.py                    # Conversion Intent Rate calculation
```

---

## Development Notes

### Adding New Data Sources
1. Add collection method to `collect_daily_data.py`
2. Add to results tracking dict
3. Add to run() method workflow
4. Update print_final_summary()
5. Add verification to shell script if needed
6. Update alert thresholds in `send_data_alerts.py`

### Testing Changes
```bash
# Test mode (3 properties)
python3 collect_daily_data.py --test

# Quick mode (GA4 + GSC only)
python3 collect_daily_data.py --quick

# Skip GTMetrix
python3 collect_daily_data.py --no-gtmetrix
```

---

## System Requirements

**Python 3.12+**
**Key Dependencies**:
- google-analytics-data
- google-api-python-client
- google-ads
- requests
- sqlite3 (built-in)

**External Services**:
- Google Analytics 4 API
- Google Search Console API
- Google Ads API (v22)
- PageSpeed Insights API
- SEMRush API

---

## Contact & Support

**System Owner**: Mark Laufhutte (mlaufhutte@venterraliving.com)  
**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Last Updated**: 2026-01-23  
**Version**: 2.0 (with Google Ads integration)
