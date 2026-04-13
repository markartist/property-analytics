# Property Analytics System

## 🤖 FOR AI ASSISTANTS (ATLAS)

**⚠️ CRITICAL: Read this FIRST before any action in a new session**

📖 **Atlas Working Memory:** `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

This file contains:
- Current system state (what's working/broken)
- Complete architecture map
- Session log (recent changes)
- Critical issues
- Common commands
- Operational patterns

**Session Start Protocol:**
1. Read `ATLAS_WORKING_MEMORY.md` completely (5 min)
2. Run `./atlas_session_start.sh` for quick health check
3. Check "Current System State" section
4. Review "Session Log" for recent changes
5. Note critical issues before starting work

**After EVERY significant action:**
- Update the session log in `ATLAS_WORKING_MEMORY.md`
- Document what changed, what works, what's broken
- Verify with database queries, not assumptions

**Key Principle:** Verify first, assume never.

---

## System Purpose
Automated daily data collection and weekly reporting for Venterra's 91 property portfolio, tracking GA4 analytics, Google Search Console, SEMRush, and PageSpeed metrics.

## Cloudflare Pilot Cache Work

For the five Resi pilot domains, Cloudflare cache observability and rollout tooling now exist in-repo.

Start here:

- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md`

Key implementation areas:

- Daily audit collector: `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- GraphQL analytics client: `/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py`
- Rollout tooling: `/Users/mark/Property_Analytics/ops/cloudflare/`

## Critical Information

### Single Source of Truth
**Database:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- ALL collectors write here
- ALL reports read from here
- Never use JSON/CSV files as primary data source

### Property Registry
**File:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- 91 properties with GA4 IDs, GSC URLs, canonical names, aliases
- Used by: ALL collectors, ALL reports, PropertyRegistry class
- Never hardcode property lists

### Daily Automated Collection
**When:** 5:00 AM daily via launchd
**What:** GA4 (14 days + traffic sources), GSC (14 days), SEMRush (50 keywords)
**Script:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`
**Launchd:** `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist`

PageSpeed runs separately at 5:10 AM:
**Launchd:** `~/Library/LaunchAgents/com.venterra.portfolio.psi.plist`

### Weekly Manual Report
**When:** User generates manually (typically Monday for Friday delivery)
**What:** Spotlight Properties report for 20-25 properties
**Script:** `/Users/mark/Property_Analytics/Spotlight_Properties_Report/generate_weekly_spotlight_report_from_db.py`
**Config:** `config/monthly_spotlight_properties_YYYY-MM.json` (one per month, reused weekly)
**Output:** `/Users/mark/Library/CloudStorage/OneDrive-Personal/Website_Analytics_Reports/`
**Behavior:** Auto-archives old reports to `archive/` subdirectory

## Architecture Overview

```
Data Flow:
1. Daily Collection (5 AM) → portfolio_analytics.db
   - GA4: ga4_daily_metrics + ga4_traffic_sources (14 days rolling)
   - GSC: gsc_daily_metrics (14 days rolling)
   - SEMRush: semrush_domain_metrics
   - PageSpeed: pagespeed_metrics

2. Insights Engine → insights table
   - Analyzes data daily
   - Generates warnings/errors for anomalies
   
3. Report Generator reads:
   - ga4_daily_metrics (T7/T30 engaged sessions)
   - ga4_traffic_sources (T7/T30 organic traffic)
   - insights (top 3 per property)
   - Outputs CSV to OneDrive
```

## Key Database Tables

### ga4_daily_metrics
- Primary: property_id + metric_date
- Contains: sessions, engaged_sessions, users, pageviews, bounce_rate
- Written by: collect_daily_data.py (daily)
- Read by: Spotlight report, Insights Engine

### ga4_traffic_sources
- Primary: property_id + metric_date + channel_group
- Contains: sessions, engaged_sessions by channel (Organic Search, Direct, Paid, etc.)
- Written by: collect_daily_data.py (daily)
- Read by: Spotlight report (for organic traffic metrics)
- **CRITICAL:** Without this data, organic columns in report are empty

### gsc_daily_metrics
- Primary: property_id + metric_date
- Contains: clicks, impressions, ctr, average_position
- Written by: collect_daily_data.py (daily)
- Read by: Insights Engine, reports

### insights
- Contains: AI-generated warnings/errors about anomalies
- Written by: Insights Engine (daily)
- Read by: Spotlight report (top 3 per property)
- Format: "{property_name}: {message}" → property name stripped in report

## Common Issues & Solutions

### Issue: "Organic traffic columns empty in report"
**Cause:** ga4_traffic_sources table missing data
**Check:** `sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db "SELECT COUNT(*) FROM ga4_traffic_sources"`
**Fix:** Run backfill script: `python3 Portfolio_Monitoring/backfill_traffic_sources.py`

### Issue: "Report shows stale data"
**Cause:** Daily collection not running or reading wrong table
**Check:** 
1. `launchctl list | grep venterra` (verify launchd jobs)
2. `sqlite3 portfolio_analytics.db "SELECT MAX(metric_date) FROM ga4_daily_metrics"`
**Fix:** Manually run: `python3 Portfolio_Monitoring/collect_daily_data.py`

### Issue: "Property not in Spotlight report"
**Cause:** Not in monthly config
**Fix:** 
1. Add to text file: `config/January_26_Spotlight_Properties.txt`
2. Regenerate: `python3 create_monthly_config.py config/January_26_Spotlight_Properties.txt 2026-01`

## Report Generation (Weekly Process)

1. Verify data freshness:
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date) FROM ga4_daily_metrics"
```

2. Generate report:
```bash
cd /Users/mark/Property_Analytics/Spotlight_Properties_Report
python3 generate_weekly_spotlight_report_from_db.py \
  --config config/monthly_spotlight_properties_2026-01.json
```

3. Report outputs to: `/Users/mark/Library/CloudStorage/OneDrive-Personal/Website_Analytics_Reports/`

## Creating New Monthly Config

1. Create text file with property names (one per line): `config/January_26_Spotlight_Properties.txt`
2. Run: `python3 create_monthly_config.py config/January_26_Spotlight_Properties.txt 2026-01`
3. Output: `config/monthly_spotlight_properties_2026-01.json`
4. Use this config for ALL weekly reports that month

## Verification Commands

Check daily collection ran:
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(*) as properties, MAX(metric_date) as latest FROM ga4_daily_metrics"
```

Check traffic sources exist:
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(DISTINCT property_id) as properties, COUNT(DISTINCT metric_date) as days,
   MIN(metric_date) as earliest, MAX(metric_date) as latest FROM ga4_traffic_sources"
```

## Report Request System (New)

**Purpose:** Queue report generation tasks that Agent can execute in new sessions without context.

**Location:** `/Users/mark/Property_Analytics/REPORT_REQUESTS/`

**Usage:**
1. Create JSON request file in REPORT_REQUESTS/ directory
2. In new session, tell Agent: "Check for report requests" or "Process REPORT_REQUESTS"
3. Agent runs: `python3 process_report_requests.py`
4. Completed requests archived to `REPORT_REQUESTS/completed/`

**Documentation:** `REPORT_REQUESTS/README.md`

**Supported Reports:**
- Property Assessment (active sites) - `/Users/mark/Property_Analytics/generate_executive_assessment.py`
- Custom ad-hoc reports - Uses `utils/report_builder.py` framework
- PIB reports - Integration pending

**See also:** `PROPERTY_ASSESSMENT_REPORTS.md` for Property Assessment details

---

## Last Updated
2026-01-27 - Added Report Request System and Property Assessment framework (logo rendering issue resolved)
