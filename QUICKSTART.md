# Quick Start Diagnostic Checklist

## When User Reports: "Spotlight Report Doesn't Work"

Run these commands in order to diagnose:

### 1. Check Database Has Recent Data
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(*) as properties, MAX(metric_date) as latest_date FROM ga4_daily_metrics"
```
**Expected:** 90-91 properties, latest_date = yesterday

**If stale:** Daily collection didn't run → Check step 2

### 2. Check Daily Collection Is Running
```bash
launchctl list | grep venterra
```
**Expected:** Two entries with PIDs or "0" status
- com.venterra.portfolio.collection
- com.venterra.portfolio.psi

**If missing:** Launchd jobs not loaded
```bash
launchctl load ~/Library/LaunchAgents/com.venterra.portfolio.collection.plist
launchctl load ~/Library/LaunchAgents/com.venterra.portfolio.psi.plist
```

### 3. Check Traffic Sources Data Exists
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(DISTINCT property_id) as properties, 
   COUNT(DISTINCT metric_date) as days,
   MIN(metric_date) as earliest, 
   MAX(metric_date) as latest 
   FROM ga4_traffic_sources"
```
**Expected:** 90-91 properties, 60+ days of data

**If empty or < 60 days:** Run backfill
```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 backfill_traffic_sources.py
```

### 4. Check Monthly Config Exists
```bash
ls -l /Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_*.json
```
**Expected:** File for current month (e.g., `monthly_spotlight_properties_2026-01.json`)

**If missing:** Create new config (see below)

### 5. Generate Report
```bash
cd /Users/mark/Property_Analytics/Spotlight_Properties_Report
python3 generate_weekly_spotlight_report_from_db.py \
  --config config/monthly_spotlight_properties_2026-01.json
```
**Expected:** CSV file in `/Users/mark/Library/CloudStorage/OneDrive-Personal/Website_Analytics_Reports/`

## Creating New Monthly Config

### You Need:
1. Text file with property names (one per line)
2. Month in YYYY-MM format

### Steps:
```bash
cd /Users/mark/Property_Analytics/Spotlight_Properties_Report

# Create or edit text file
# Example: config/January_26_Spotlight_Properties.txt

# Generate config
python3 create_monthly_config.py \
  config/January_26_Spotlight_Properties.txt \
  2026-01

# Verify output
ls -l config/monthly_spotlight_properties_2026-01.json
```

## Manual Data Collection (If Daily Failed)

```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring

# Full collection (takes ~5 minutes)
python3 collect_daily_data.py

# Test mode (3 properties, faster)
python3 collect_daily_data.py --test
```

## Common Error Messages

### "Could not resolve: {PropertyName}"
**Cause:** Property name not in registry
**Fix:** Check exact name in `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

### "Organic traffic columns empty"
**Cause:** ga4_traffic_sources table empty
**Fix:** Run `python3 backfill_traffic_sources.py`

### "Report date wrong"
**Cause:** Report auto-calculates Friday date
**Fix:** This is expected behavior - report always dated for upcoming Friday

## Key File Locations

- **Database:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Property Registry:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- **Daily Collector:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`
- **Report Generator:** `/Users/mark/Property_Analytics/Spotlight_Properties_Report/generate_weekly_spotlight_report_from_db.py`
- **Report Output:** `/Users/mark/Library/CloudStorage/OneDrive-Personal/Website_Analytics_Reports/`

## Last Known Good State
- Date: 2026-01-13
- Database: 90 properties, 25,489 traffic source records
- Data range: 2025-11-14 to 2026-01-12 (60 days)
- Report: All 22 January properties generating correctly
- Features: Auto-archiving, capitalized insights, property names stripped
