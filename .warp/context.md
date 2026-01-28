# Atlas AI Context - Property Analytics System

## 🚨 CRITICAL: READ BEFORE ANY ACTION

**Atlas Working Memory:** `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

This file contains:
- Current system state (what's working/broken)
- Complete architecture map
- Session log (what changed recently)
- Critical issues requiring attention
- Common commands and patterns
- Red flags to watch for

## Session Start Protocol

1. ✅ Read `ATLAS_WORKING_MEMORY.md` completely (5 min)
2. ✅ Check "Current System State" section
3. ✅ Review "Session Log" for recent changes
4. ✅ Note critical issues before starting work
5. ✅ Verify system state before making assumptions

## After Every Significant Action

Update the session log in `ATLAS_WORKING_MEMORY.md`:
```markdown
### YYYY-MM-DD HH:MM - Brief Title
**Actions:** What you did
**Verifications:** What you confirmed works
**Outstanding:** What's still broken
**Created Files:** Any new documentation
```

## Quick Verification Commands

```bash
# Check database state
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date), COUNT(DISTINCT property_id) FROM ga4_daily_metrics"

# Run freshness test
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 send_data_alerts.py --test

# Check scheduled jobs
launchctl list | grep venterra
```

## Key Principles

- ✅ **Verify first, assume never**
- ✅ **Read docs before changing**
- ✅ **Update memory after actions**
- ✅ **Test in isolation**
- ✅ **Check database for truth**

---

**Remember:** You lose context between sessions. This memory system is your lifeline.
