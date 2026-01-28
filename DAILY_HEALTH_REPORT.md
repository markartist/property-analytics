# Daily Portfolio Health Report

## Overview
Automated technical diagnostic report for proactive portfolio monitoring. Runs daily at 9:00 AM and emails results to Mark. Uses PIB visual styling with signal-heavy, noise-light content focused on early warning and actionable insights.

**Purpose:** Early warning system for portfolio issues  
**Audience:** Engineers, web ops, analytics stakeholders (internal technical)  
**Style:** PIB layout, technical/diagnostic tone  
**Automation:** Daily at 9:00 AM via launchd

---

## Report Structure

### 1. Summary
- Overall health status (critical issues count)
- Data sources status (PageSpeed, GSC, GA4)
- Collection health indicators

### 2. Core Web Vitals Watchlist
**Signal-only:** Only shows properties with issues

- **🔴 CWV Failing (Field Data):** Properties failing Google's actual CWV assessment
- **🟡 CWV At Risk (Lab Data):** Properties with concerning lab metrics but no field failures yet
- **Mobile LCP Risk Bands:**
  - Severe (>4.0s)
  - Elevated (2.5-4.0s)

### 3. Suggested Actions (Prioritized)
Risk-ranked action list with:
- Priority level (1-4)
- Specific action to take
- Reason/impact explanation

Priorities:
1. **Critical:** Failing CWV - immediate SEO risk
2. **High:** Severe LCP issues - likely to fail when field data accumulates
3. **Medium:** At-risk properties - monitoring needed
4. **Low:** Data collection issues - incomplete monitoring

---

## Files & Components

### Core Scripts

**`generate_daily_portfolio_health.py`** (532 lines)
- Main report generator
- Queries portfolio_analytics.db
- Generates PIB-styled HTML
- Output: `reports/daily_health/Portfolio_Health_Daily_YYYY-MM-DD.html`

**`send_daily_health_report.py`** (71 lines)
- Email sender
- Subject: "Portfolio Health Daily - YYYY-MM-DD"
- Recipient: mlaufhutte@venterraliving.com

**`run_daily_health_report.sh`** (55 lines)
- Automation wrapper
- Calls generator + sender
- Logs to: `~/Library/Logs/Venterra/daily_health_report_YYYY-MM-DD.log`

### Automation

**Launchd:** `~/Library/LaunchAgents/com.venterra.daily.health.plist`
- Runs daily at 9:00 AM
- Executes `run_daily_health_report.sh`
- Logs stdout/stderr to `~/Library/Logs/Venterra/`

---

## Data Sources

Report queries the canonical database: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

**Tables Used:**
- `pagespeed_metrics` - CWV field + lab data, mobile scores
- `gsc_daily_metrics` - Search Console metrics
- `ga4_daily_metrics` - Analytics metrics
- `properties` - Property names and metadata

**Data Freshness Check:**
Report validates each data source and shows status:
- **OK:** 80+ properties collected within 2 days
- **PARTIAL:** Some properties collected
- **FAILED:** No recent data

---

## Manual Usage

### Generate Report Only
```bash
cd /Users/mark/Property_Analytics
python3 generate_daily_portfolio_health.py
```

### Generate for Specific Date
```bash
python3 generate_daily_portfolio_health.py --date 2026-01-26
```

### Generate and Email
```bash
./run_daily_health_report.sh
```

### Email Existing Report
```bash
python3 send_daily_health_report.py --date 2026-01-26
```

---

## Launchd Management

### Load (Enable) Automation
```bash
launchctl load ~/Library/LaunchAgents/com.venterra.daily.health.plist
```

### Unload (Disable) Automation
```bash
launchctl unload ~/Library/LaunchAgents/com.venterra.daily.health.plist
```

### Check Status
```bash
launchctl list | grep venterra
```

### View Logs
```bash
# Daily execution logs
ls -lh ~/Library/Logs/Venterra/daily_health_report_*.log

# Most recent log
tail -f ~/Library/Logs/Venterra/daily_health_report_$(date +%Y-%m-%d).log

# Launchd stdout/stderr
tail -f ~/Library/Logs/Venterra/daily_health_stdout.log
tail -f ~/Library/Logs/Venterra/daily_health_stderr.log
```

### Test Manually (Bypass Schedule)
```bash
launchctl start com.venterra.daily.health
```

---

## Report Logic

### CWV Failing Detection
Properties are flagged as **failing** if they have:
- Field data (CrUX) showing "poor" for LCP, CLS, or FID
- Data from last 7 days

**Why it matters:** These properties are actively hurting SEO rankings.

### CWV At Risk Detection
Properties are flagged as **at risk** if they have:
- Mobile PSI score < 90
- No field data failures (yet)
- Lab data showing concerning metrics:
  - LCP > 2.5s
  - CLS > 0.1
  - FID > 100ms

**Why it matters:** Lab data predicts field failures when real user data accumulates.

### LCP Risk Bands
Properties categorized by mobile LCP severity:
- **Severe:** > 4.0s - Very high risk of CWV failure
- **Elevated:** 2.5-4.0s - Moderate risk, needs monitoring

---

## Quiet Days vs. Noisy Days

### Expected Behavior

**Most days should be quiet:**
- ✅ No Critical Issues
- Few or zero properties in watchlists
- Minimal suggested actions

**Noisy days are exceptional:**
- ⚠️ Multiple Critical Issues
- Many properties flagged
- Multiple high-priority actions

**This is by design.** The report is an exception-based early warning system, not a daily firehose of metrics.

---

## Integration with Existing Systems

### Data Dependencies
- **Requires:** Daily PageSpeed collection (5:10 AM)
- **Requires:** Daily GA4 collection (5:00 AM)
- **Requires:** Daily GSC collection (5:00 AM)

### Timing
- **5:00 AM:** GA4 + GSC collection
- **5:10 AM:** PageSpeed collection
- **9:00 AM:** Daily Health Report ← NEW

This ensures fresh data for health checks.

### Complementary Reports
- **Property Intelligence Brief (PIB):** Deep-dive single property, generated on-demand
- **Spotlight Properties Report:** Weekly executive summary for 20-25 properties
- **Daily Health Report:** Portfolio-wide early warning system ← NEW

---

## Alert Thresholds

### CWV Thresholds (Google Standard)
- **LCP:** Good <2.5s, Needs Improvement 2.5-4.0s, Poor >4.0s
- **FID:** Good <100ms, Needs Improvement 100-300ms, Poor >300ms
- **CLS:** Good <0.1, Needs Improvement 0.1-0.25, Poor >0.25

### Mobile PSI Score
- **90-100:** Good
- **50-89:** Needs improvement (flagged as "at risk")
- **0-49:** Poor (high priority)

### Data Freshness
- **OK:** Data within 2 days for 80+ properties
- **PARTIAL:** Data within 2 days for 1-79 properties
- **FAILED:** No data within 2 days

---

## Output & Archiving

### Report Location
```
/Users/mark/Property_Analytics/reports/daily_health/
├── Portfolio_Health_Daily_2026-01-27.html
├── Portfolio_Health_Daily_2026-01-26.html
└── Portfolio_Health_Daily_2026-01-25.html
```

Reports are automatically archived (not deleted). Naming convention ensures chronological sorting.

### Log Location
```
~/Library/Logs/Venterra/
├── daily_health_report_2026-01-27.log
├── daily_health_stdout.log
└── daily_health_stderr.log
```

---

## Troubleshooting

### Report Not Generated
**Check:**
1. Database exists and has recent data
   ```bash
   sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
     "SELECT MAX(collection_date) FROM pagespeed_metrics"
   ```

2. Python script runs manually
   ```bash
   python3 generate_daily_portfolio_health.py
   ```

3. Check logs for errors
   ```bash
   tail -50 ~/Library/Logs/Venterra/daily_health_stderr.log
   ```

### Email Not Sent
**Check:**
1. Report file exists
   ```bash
   ls -lh reports/daily_health/Portfolio_Health_Daily_$(date +%Y-%m-%d).html
   ```

2. Email sender works manually
   ```bash
   python3 send_daily_health_report.py
   ```

3. Email credentials configured in `utils/email_sender.py`

### Launchd Not Running
**Check:**
1. Launchd job loaded
   ```bash
   launchctl list | grep com.venterra.daily.health
   ```

2. Plist syntax valid
   ```bash
   plutil -lint ~/Library/LaunchAgents/com.venterra.daily.health.plist
   ```

3. Manually trigger
   ```bash
   launchctl start com.venterra.daily.health
   ```

4. Check launchd logs
   ```bash
   tail -f ~/Library/Logs/Venterra/daily_health_stdout.log
   ```

---

## Future Enhancements (Planned)

### Phase 2 Additions
- **SEO Hygiene Exceptions:** noindex, canonical, robots.txt, schema issues
- **GSC Anomalies:** Coverage spikes, CTR drops, impression changes
- **Paid Performance:** Spend vs conversion mismatches, CPC spikes
- **Review Sentiment:** Negative review themes, rating changes
- **Trend Detection:** Week-over-week regressions, threshold crossings

### Implementation Notes
These features are designed but not yet implemented pending:
- GTmetrix data collection
- Review data pipeline
- Google Ads integration
- Enhanced schema validation

---

## Version History

**v1.0** (2026-01-27)
- Initial release
- CWV watchlist (failing, at-risk, LCP bands)
- Data source health checks
- Prioritized action suggestions
- PIB-style layout
- Daily automation at 9 AM
- Email delivery

---

## Quick Reference

**Generate Report:**
```bash
python3 generate_daily_portfolio_health.py
```

**Send Email:**
```bash
python3 send_daily_health_report.py
```

**Full Automation:**
```bash
./run_daily_health_report.sh
```

**Enable Automation:**
```bash
launchctl load ~/Library/LaunchAgents/com.venterra.daily.health.plist
```

**View Today's Log:**
```bash
cat ~/Library/Logs/Venterra/daily_health_report_$(date +%Y-%m-%d).log
```

---

## Contact / Support

**System Owner:** Mark Laufhutte (mlaufhutte@venterraliving.com)  
**Created:** 2026-01-27 by Atlas  
**Documentation:** This file + inline code comments  
**Related Docs:** `README.md`, `PROPERTY_ASSESSMENT_REPORTS.md`, `utils/ADHOC_REPORT_BUILDER_README.md`
