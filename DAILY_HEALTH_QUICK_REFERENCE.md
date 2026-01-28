# Daily Portfolio Health Report - Quick Reference

## Status: ✅ ACTIVE
**Schedule**: Every day at 9:00 AM CST  
**Recipient**: mlaufhutte@venterraliving.com  
**Version**: 2.1 (with trend tracking)

---

## What You'll See Each Morning

### Email Subject
`Portfolio Health Daily - YYYY-MM-DD`

### Report Sections
1. **Portfolio Average** - Overall score with trend arrow (↑↓)
2. **Key Metrics** - Average LCP, CLS with day-over-day changes
3. **Score Distribution** - How many sites are Poor/Needs Improvement/Good
4. **Bottom 10 Performers** - Sites needing attention (with all PSI metrics)
5. **Top 10 Performers** - Benchmark sites (with all PSI metrics)

### Reading the Trends
- **Green ↑** on scores = improvement (higher is better)
- **Green ↓** on metrics = improvement (lower LCP/CLS/etc. is better)
- **Red arrows** = regression
- Numbers show actual change (e.g., ↑2.5 or ↓0.3s)

---

## Quick Commands

### Run Manually Right Now
```bash
/Users/mark/Property_Analytics/run_daily_health_report.sh
```

### Check if Automation is Running
```bash
launchctl list | grep com.venterra.daily.health
```
*Should show: `-    0    com.venterra.daily.health`*

### View Recent Logs
```bash
tail -20 ~/Library/Logs/Venterra/daily_health_stdout.log
tail -20 ~/Library/Logs/Venterra/daily_health_stderr.log
```

### View Previous Reports
```bash
open /Users/mark/Property_Analytics/reports/daily_health/
```

---

## Monitoring Your Optimization Progress

As you make site improvements, watch for:

✅ **Portfolio average moving up** (e.g., 63 → 65 → 68)  
✅ **Average LCP trending down** (target: <2.5s)  
✅ **Properties moving from "Needs Improvement" to "Good"**  
✅ **Bottom 10 list changing** (sites improving and moving off)  
✅ **Green trend indicators** on individual properties

---

## Troubleshooting

### No Email Arrived?
1. Check logs: `tail ~/Library/Logs/Venterra/daily_health_stderr.log`
2. Verify automation: `launchctl list | grep com.venterra.daily.health`
3. Run manually to test: `/Users/mark/Property_Analytics/run_daily_health_report.sh`

### Want to Change Schedule?
Edit: `~/Library/LaunchAgents/com.venterra.daily.health.plist`  
Then reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.venterra.daily.health.plist
launchctl load ~/Library/LaunchAgents/com.venterra.daily.health.plist
```

### Need Different Recipients?
Edit: `/Users/mark/Property_Analytics/.email_config.json`  
Update the `default_recipients` field

---

## Color Coding Cheat Sheet

### Performance Scores
- 🟢 Good: 90+
- 🟡 Needs Improvement: 50-89  
- 🔴 Poor: <50

### LCP (Largest Contentful Paint)
- 🟢 Good: ≤2.5s
- 🟡 Needs Improvement: 2.5-4.0s
- 🔴 Poor: >4.0s

### CLS (Cumulative Layout Shift)
- 🟢 Good: ≤0.1
- 🟡 Needs Improvement: 0.1-0.25
- 🔴 Poor: >0.25

---

## Files Location
- **Documentation**: `/Users/mark/Property_Analytics/DAILY_PORTFOLIO_HEALTH_REPORT.md`
- **Generator**: `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py`
- **Reports**: `/Users/mark/Property_Analytics/reports/daily_health/`
- **Automation**: `~/Library/LaunchAgents/com.venterra.daily.health.plist`

---

**Last Updated**: 2026-01-27  
**Created By**: Mark Laufhutte / Atlas
