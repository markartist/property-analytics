# Weekly Portfolio Progress Report System

## Overview
Automated weekly roundup showing optimization progress across the portfolio. This report provides week-over-week comparison, highlights top performers and concerns, and tracks movement between performance categories.

**Report Style**: PIB visual layout with executive-friendly format  
**Content**: Strategic progress tracking with clear wins and action items  
**Frequency**: Weekly on Mondays at 10:00 AM CST  
**Recipients**: Mark (mlaufhutte@venterraliving.com)

## Features

### Executive Summary
- **Weekly Trend Badge**: Overall status (Strong Progress, Improving, Stable, Declining)
- **Portfolio Average Score**: Current vs. week-ago with delta
- **Average LCP**: Current vs. week-ago with delta
- **Average CLS**: Current vs. week-ago with delta
- **Good Sites Count (90+)**: Current vs. week-ago with delta

### Performance Analysis

#### 🏆 Top Performers This Week
Top 5 properties with the most score improvement
- Medal rankings (🥇🥈🥉)
- Score progression (before → after)
- LCP improvements if significant
- Shows actual point gains

#### 📊 Category Changes
Properties that moved between performance categories:
- **Moved Up**: Poor → Needs Improvement or Good, Needs Improvement → Good
- **Moved Down**: Good → Needs Improvement or Poor, Needs Improvement → Poor
- Shows current score for each property

#### ⚠️ Properties Needing Attention
Top 5 properties with score declines
- Score regression (before → after)
- LCP changes if significant
- Identifies sites requiring investigation

### Report Period
Covers 7 days (Monday-Sunday) with comparison to previous week's data

## Files

### Generator
**Location**: `/Users/mark/Property_Analytics/generate_weekly_progress_report.py`  
**Version**: 1.0  
**Purpose**: Generates HTML weekly progress report with week-over-week comparisons

### Email Sender
**Location**: `/Users/mark/Property_Analytics/send_weekly_progress_report.py`  
**Purpose**: Emails report to Mark using Gmail SMTP

### Automation
**Shell Script**: `/Users/mark/Property_Analytics/run_weekly_progress_report.sh`  
**LaunchAgent**: `/Users/mark/Library/LaunchAgents/com.venterra.weekly.progress.plist`  
**Schedule**: Every Monday at 10:00 AM CST (16:00 UTC)

### Output
**Directory**: `/Users/mark/Property_Analytics/reports/weekly_progress/`  
**Format**: `Weekly_Progress_YYYY-MM-DD_to_YYYY-MM-DD.html`

## Database Requirements

### Tables Used
**pagespeed_metrics**:
- property_id (TEXT)
- metric_date (DATE)
- strategy (TEXT) - uses 'mobile'
- performance_score (INTEGER)
- lcp_value (REAL) - in seconds
- cls_value (REAL)
- fid_value (REAL) - in milliseconds

**property_metadata**:
- property_id (TEXT PRIMARY KEY)
- property_name (TEXT)

### Data Requirements
- Minimum 14 days of PageSpeed data for week-over-week comparison
- Data should be current through Sunday before Monday report runs

## Metrics Tracked

### Score Improvements (week-over-week)
- Portfolio average performance score
- Individual property score changes
- Category movements (Poor/Needs Improvement/Good)

### Core Web Vitals Trends
- LCP (Largest Contentful Paint) - Target: ≤2.5s
- CLS (Cumulative Layout Shift) - Target: ≤0.1
- Portfolio-wide averages with deltas

## Interpretation Guide

### Trend Badges
- **📈 Strong Progress**: Average score +2 or more
- **📈 Improving**: Average score +0.1 to +1.9
- **➡️ Stable**: No change in average score
- **📉 Slight Decline**: Average score -0.1 to -1.9
- **📉 Declining**: Average score -2 or worse

### Color Coding
- **Green ↑**: Improvement (higher score is better)
- **Green ↓**: Improvement (lower LCP/CLS is better)
- **Red ↑/↓**: Regression
- **Gray —**: No data or no change

## Manual Execution

Generate report for current week:
```bash
python3 /Users/mark/Property_Analytics/generate_weekly_progress_report.py
```

Send latest report via email:
```bash
python3 /Users/mark/Property_Analytics/send_weekly_progress_report.py
```

Generate and send (automated wrapper):
```bash
/Users/mark/Property_Analytics/run_weekly_progress_report.sh
```

## Automation Management

Check automation status:
```bash
launchctl list | grep com.venterra.weekly.progress
```

Reload automation (after changes):
```bash
launchctl unload ~/Library/LaunchAgents/com.venterra.weekly.progress.plist
launchctl load ~/Library/LaunchAgents/com.venterra.weekly.progress.plist
```

View logs:
```bash
tail -f ~/Library/Logs/Venterra/weekly_progress_stdout.log
tail -f ~/Library/Logs/Venterra/weekly_progress_stderr.log
```

## Using the Report

### Weekly Review Process
1. **Check Overall Trend**: Review executive summary badge
2. **Celebrate Wins**: Note properties in Top Performers section
3. **Plan Actions**: Review Properties Needing Attention
4. **Track Progress**: Monitor category movements week-over-week

### Key Questions to Ask
- Is the portfolio average trending up?
- Are any properties consistently in Top Performers? (benchmark sites)
- Are any properties repeatedly in Needing Attention? (prioritize these)
- Are more sites moving from "Needs Improvement" to "Good"?
- What's the LCP trend? (primary optimization target)

### Combining with Daily Reports
- **Daily Health Reports**: Track day-to-day changes and immediate issues
- **Weekly Progress Reports**: See bigger picture, identify sustained trends
- Use daily reports for tactical optimization
- Use weekly reports for strategic planning

## Version History

### v1.0 (2026-01-27)
- Initial release
- Week-over-week portfolio comparison
- Top gainers and losers tracking
- Category movement detection
- Automated Monday morning delivery

## Relationship to Other Reports

### Daily Portfolio Health Report
- **Frequency**: Every day at 9 AM CST
- **Focus**: Current state, day-over-day trends, diagnostic details
- **Use Case**: Daily optimization monitoring

### Weekly Portfolio Progress Report
- **Frequency**: Every Monday at 10 AM CST
- **Focus**: Week-over-week progress, strategic wins/concerns
- **Use Case**: Strategic review and planning

## Support

**Created By**: Mark Laufhutte / Atlas  
**Date**: 2026-01-27  
**Contact**: mlaufhutte@venterraliving.com
