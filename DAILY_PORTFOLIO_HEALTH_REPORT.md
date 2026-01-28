# Daily Portfolio Health Report System

## Overview
Automated daily diagnostic report providing portfolio-wide performance monitoring with trend tracking. Designed for internal technical diagnostics and proactive monitoring of Venterra's 91-property portfolio.

**Report Style**: PIB visual layout (clean, professional)  
**Content**: Technical/diagnostic (not executive-facing)  
**Frequency**: Daily at 9:00 AM CST  
**Recipients**: Mark (mlaufhutte@venterraliving.com)

## Features

### Portfolio Overview
- **Portfolio Average Score** with day-over-day trend indicator
- **Score Range** (min to max across portfolio)
- **Average Core Web Vitals** (LCP, CLS) with color coding and trends
- **Score Distribution** visualization (Poor <50, Needs Improvement 50-89, Good 90+) with count deltas

### Performance Analysis
- **Bottom 10 Performers** - Properties requiring immediate attention
- **Top 10 Performers** - Benchmark properties for comparison

### Complete PageSpeed Insights Metrics (per property)
**PSI Scores**:
- Performance Score (0-100)
- Accessibility Score (0-100)
- Best Practices Score (0-100)
- SEO Score (0-100)

**Core Web Vitals**:
- LCP (Largest Contentful Paint) - Target: ≤2.5s
- CLS (Cumulative Layout Shift) - Target: ≤0.1
- FID (First Input Delay) - Target: ≤100ms
- FCP (First Contentful Paint) - Target: ≤1.8s

**Additional Performance Metrics**:
- TTFB (Time to First Byte) - Target: ≤800ms
- Speed Index - Target: ≤3.4s
- TTI (Time to Interactive) - Target: ≤3.8s
- TBT (Total Blocking Time) - Target: ≤200ms

### Trend Tracking (Day-over-Day)
All metrics include automatic comparison with previous day's data:
- **Portfolio-level trends**: Average scores, LCP, CLS, distribution counts
- **Property-level trends**: Performance score and LCP changes for each property
- **Color-coded indicators**:
  - Green ↑ = Score improvement (higher is better)
  - Green ↓ = Metric improvement (lower is better for LCP, CLS, etc.)
  - Red = Regression
- **Delta values**: Actual change amounts (e.g., ↑2.5, ↓0.3s)

### Color Coding Standards
**Performance Scores** (0-100):
- 🟢 Good: 90+
- 🟡 Needs Improvement: 50-89
- 🔴 Poor: <50

**LCP** (Largest Contentful Paint):
- 🟢 Good: ≤2.5s
- 🟡 Needs Improvement: 2.5-4.0s
- 🔴 Poor: >4.0s

**CLS** (Cumulative Layout Shift):
- 🟢 Good: ≤0.1
- 🟡 Needs Improvement: 0.1-0.25
- 🔴 Poor: >0.25

**FID** (First Input Delay):
- 🟢 Good: ≤100ms
- 🟡 Needs Improvement: 100-300ms
- 🔴 Poor: >300ms

**FCP** (First Contentful Paint):
- 🟢 Good: ≤1.8s
- 🟡 Needs Improvement: 1.8-3.0s
- 🔴 Poor: >3.0s

**TTFB** (Time to First Byte):
- 🟢 Good: ≤800ms
- 🟡 Needs Improvement: 800-1800ms
- 🔴 Poor: >1800ms

**Speed Index**:
- 🟢 Good: ≤3.4s
- 🟡 Needs Improvement: 3.4-5.8s
- 🔴 Poor: >5.8s

**TTI** (Time to Interactive):
- 🟢 Good: ≤3.8s
- 🟡 Needs Improvement: 3.8-7.3s
- 🔴 Poor: >7.3s

**TBT** (Total Blocking Time):
- 🟢 Good: ≤200ms
- 🟡 Needs Improvement: 200-600ms
- 🔴 Poor: >600ms

## Files

### Generator
**Location**: `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py`  
**Version**: 2.1 (with trend tracking)  
**Purpose**: Generates HTML report with complete PSI metrics and day-over-day trends

### Email Sender
**Location**: `/Users/mark/Property_Analytics/send_daily_health_report.py`  
**Purpose**: Emails report to Mark using Gmail SMTP

### Automation
**Shell Script**: `/Users/mark/Property_Analytics/run_daily_health_report.sh`  
**LaunchAgent**: `/Users/mark/Library/LaunchAgents/com.venterra.daily.health.plist`  
**Schedule**: Daily at 9:00 AM CST (15:00 UTC)

### Output
**Directory**: `/Users/mark/Property_Analytics/reports/daily_health/`  
**Format**: `Portfolio_Health_Daily_YYYY-MM-DD.html`

## Database Schema

### Tables Used
**pagespeed_metrics**:
- property_id (TEXT)
- metric_date (DATE)
- strategy (TEXT) - 'mobile' or 'desktop'
- performance_score (INTEGER)
- accessibility_score (INTEGER)
- best_practices_score (INTEGER)
- seo_score (INTEGER)
- lcp_value (REAL) - in seconds
- lcp_score (REAL)
- fid_value (REAL) - in milliseconds
- fid_score (REAL)
- cls_value (REAL)
- cls_score (REAL)
- fcp_value (REAL) - in seconds
- ttfb_value (REAL) - in milliseconds
- speed_index (REAL) - in seconds
- time_to_interactive (REAL) - in seconds
- total_blocking_time (REAL) - in milliseconds

**property_metadata**:
- property_id (TEXT PRIMARY KEY)
- property_name (TEXT)
- unit_count (INTEGER)
- updated_at (TIMESTAMP)

## Manual Execution

Generate report for latest date:
```bash
python3 /Users/mark/Property_Analytics/generate_daily_portfolio_health.py
```

Send latest report via email:
```bash
python3 /Users/mark/Property_Analytics/send_daily_health_report.py
```

Generate and send (automated wrapper):
```bash
/Users/mark/Property_Analytics/run_daily_health_report.sh
```

## Automation Management

Check automation status:
```bash
launchctl list | grep com.venterra.daily.health
```

Reload automation (after changes):
```bash
launchctl unload ~/Library/LaunchAgents/com.venterra.daily.health.plist
launchctl load ~/Library/LaunchAgents/com.venterra.daily.health.plist
```

View logs:
```bash
tail -f /tmp/venterra_daily_health_report.log
tail -f /tmp/venterra_daily_health_report.err
```

## Version History

### v2.1 (2026-01-27)
- Added day-over-day trend tracking for all key metrics
- Property-level trend indicators (score and LCP changes)
- Portfolio-level delta indicators with color coding
- Comparison date display

### v2.0 (2026-01-27)
- Complete rebuild with portfolio state focus
- All PageSpeed Insights metrics displayed
- Color-coded indicators for each metric
- Real property names from property_metadata table
- Portfolio overview with averages and distribution
- Top 10 and Bottom 10 performers

### v1.0 (2026-01-26)
- Initial exception-based report (deprecated)

## Data Requirements

- PageSpeed Insights data must be collected and stored in `portfolio_analytics.db`
- Data should be refreshed before 9:00 AM CST daily for accurate reporting
- Minimum two days of data required for trend tracking

## Monitoring Progress

As you make site optimizations, monitor these key indicators daily:

1. **Portfolio Average Score** - Overall health trending up
2. **Average LCP** - Primary CWV metric, target <2.5s
3. **Score Distribution** - Shift from "Needs Improvement" to "Good"
4. **Bottom 10 List** - Properties moving off this list
5. **Property-Level Trends** - Individual site improvements showing green indicators

## Support

**Created By**: Mark Laufhutte / Atlas  
**Date**: 2026-01-27  
**Contact**: mlaufhutte@venterraliving.com
