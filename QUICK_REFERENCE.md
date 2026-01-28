# Quick Reference - Portfolio Analytics Data Collection

## Daily Collection Status
```bash
# Check if running
launchctl list | grep venterra.portfolio.collection

# View last run
tail -50 ~/Property_Analytics/Portfolio_Monitoring/logs/collection_stdout.log

# Check data freshness
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db "
SELECT 'GA4' as source, MAX(metric_date) as latest, COUNT(DISTINCT property_id) as props FROM ga4_daily_metrics
UNION SELECT 'GSC', MAX(metric_date), COUNT(DISTINCT gsc_site_url) FROM gsc_daily_metrics
UNION SELECT 'Google Ads', MAX(metric_date), COUNT(DISTINCT property_id) FROM google_ads_campaigns
UNION SELECT 'PSI', MAX(metric_date), COUNT(DISTINCT property_id) FROM pagespeed_metrics
UNION SELECT 'SEMRush', MAX(metric_date), COUNT(DISTINCT property_id) FROM semrush_domain_metrics"
```

## Manual Collection
```bash
cd ~/Property_Analytics/Portfolio_Monitoring
./run_full_daily_collection.sh
```

## Test Email Alerts
```bash
cd ~/Property_Analytics/Portfolio_Monitoring
python3 send_data_alerts.py --test
```

## Regenerate Google Ads Mapping
```bash
cd ~/Property_Analytics/Portfolio_Dashboard/scripts
python3 analyze_google_ads_campaigns.py
```

## Expected Data Freshness
- **GA4**: Yesterday (T-1)
- **GSC**: 3 days ago (T-3) ← Google API lag
- **Google Ads**: Yesterday (T-1)
- **PSI**: Today (T-0)
- **SEMRush**: Today (T-0)

## Key Files
- **Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Registry**: `config/venterra_properties_official.json`
- **Google Ads Mapping**: `config/google_ads_campaign_analysis.json`
- **Main Collector**: `Portfolio_Monitoring/collect_daily_data.py`
- **Shell Wrapper**: `Portfolio_Monitoring/run_full_daily_collection.sh`

## Documentation
- **Full README**: `/Users/mark/Property_Analytics/DATA_COLLECTION_README.md`
- **Session Memory**: `Portfolio_Monitoring/SESSION_MEMORY_GOOGLE_ADS_INTEGRATION_2026-01-23.md`
- **Lessons Learned**: `/Users/mark/Property_Analytics/LESSONS_LEARNED_2026-01-23.md`

## Troubleshooting
1. Check launchd: `launchctl list | grep venterra`
2. Check logs: `tail -100 logs/collection_stdout.log`
3. Check errors: `tail -100 logs/collection_stderr.log`
4. Test collectors: `python3 collect_daily_data.py --test`
5. Manual run: `./run_full_daily_collection.sh`
