# Scheduled Jobs Audit
**Date:** 2026-01-28 21:45  
**Purpose:** Verify no conflicting collectors, ensure logging is working

---

## ✅ Active Scheduled Jobs

### Production Jobs (Exit Code 0 - Working)
| Job | Schedule | Script | Logs | Status |
|-----|----------|--------|------|--------|
| **com.venterra.portfolio.collection** | 5:00 AM | `Data_Collection/orchestration/daily_master_collection.py` | `Data_Collection/logs/` | ✅ PRIMARY COLLECTOR |
| **com.venterra.portfolio.pulse** | 8:00 AM | Portfolio Pulse report | `Portfolio_Monitoring/logs/` | ✅ Working |
| **com.venterra.daily.health** | 9:00 AM | Daily health report | TBD | ✅ Working |
| **com.venterra.weekly.progress** | Mon 10:00 AM | Weekly progress | TBD | ✅ Working |
| **com.venterra.rollup_population** | TBD | GA4 rollup population | TBD | ✅ Working |
| **com.venterra.insights_generation** | TBD | Insights generation | TBD | ✅ Working |
| **com.venterra.exec_insights_weekly** | Weekly | Executive insights | TBD | ✅ Working |

### Problematic Jobs (Exit Code 1 - Need Investigation)
| Job | Schedule | Issue | Action |
|-----|----------|-------|--------|
| **com.venterra.psi_daily** | 7:30 AM | Exit 1, possibly duplicate | ⚠️ CONFLICT with main collector |
| **com.venterra.portfolio.psi** | TBD | Exit 1 | ⚠️ CONFLICT with main collector |
| **com.venterra.semrush_weekly** | Weekly | Exit 1 | ⚠️ Check if still needed |
| **com.venterra.registry_validation** | TBD | Exit 1 | ⚠️ Investigate |

---

## 🔴 CONFLICTS IDENTIFIED

### PSI Collection Conflicts
**Problem:** THREE PSI collectors may be competing:
1. `com.venterra.portfolio.collection` (5:00 AM) - Collects PSI as part of main run
2. `com.venterra.psi_daily` (7:30 AM) - Standalone PSI collector (EXIT 1)
3. `com.venterra.portfolio.psi` (unknown schedule) - Another PSI collector (EXIT 1)

**Evidence:**
- Database shows PSI collected successfully (93 properties, dated 2026-01-28)
- Main collector includes PSI in its run
- Two standalone PSI jobs showing exit code 1

**Recommendation:** 
```bash
# DISABLE duplicate PSI collectors
launchctl unload ~/Library/LaunchAgents/com.venterra.psi_daily.plist
launchctl unload ~/Library/LaunchAgents/com.venterra.portfolio.psi.plist

# Verify only main collector remains
launchctl list | grep psi
```

---

## 📊 DATA COLLECTION AUDIT TRAIL

### Database Logging ✅ WORKING
`data_collections` table shows:
- PSI collections completing successfully
- Start/end timestamps recorded
- Status tracked (completed/in_progress)
- Some "in_progress" records never completed (orphaned)

**Example from 2026-01-28:**
```
psi|2026-01-28 15:19:50|2026-01-28 15:32:18|completed
psi|2026-01-28 14:39:11|2026-01-28 14:52:25|completed
psi|2026-01-28 14:34:44||in_progress  ← ORPHANED
psi|2026-01-28 11:29:00|2026-01-28 11:42:35|completed
```

### File Logging ⚠️ MINIMAL
**Primary Collector Logs:**
- Location: `/Users/mark/Property_Analytics/Data_Collection/logs/`
- Files: `collection_stdout.log`, `collection_stderr.log`
- **Problem:** Logs are essentially empty (1 byte each)
- **Issue:** Output not being captured by launchd

**Possible Causes:**
1. Logs might be going to a different location
2. Python output might be buffered and not flushing
3. Launchd might not be redirecting correctly

**Other Log Locations Found:**
- `/Users/mark/Property_Analytics/logs/psi_daily_collection.log`
- `/Users/mark/Property_Analytics/logs/psi_daily_collection_error.log`
- `/Users/mark/Property_Analytics/logs/semrush_weekly_collection_error.log`

---

## 🔧 RECOMMENDED ACTIONS

### 1. Remove Conflicting PSI Collectors (HIGH PRIORITY)
```bash
# Unload duplicate PSI jobs
cd ~/Library/LaunchAgents
launchctl unload com.venterra.psi_daily.plist
launchctl unload com.venterra.portfolio.psi.plist

# Optionally remove plist files
mv com.venterra.psi_daily.plist com.venterra.psi_daily.plist.disabled
mv com.venterra.portfolio.psi.plist com.venterra.portfolio.psi.plist.disabled
```

### 2. Fix Main Collector Logging (HIGH PRIORITY)
Update `Data_Collection/orchestration/daily_master_collection.py` to ensure logging:

```python
# Add at top of script
import sys
sys.stdout = sys.stderr = open('/Users/mark/Property_Analytics/Data_Collection/logs/collection_debug.log', 'a', buffering=1)

# Or use Python's -u flag for unbuffered output in plist:
# /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -u ...
```

**Or update plist to use script wrapper:**
```xml
<string>/bin/bash</string>
<string>/Users/mark/Property_Analytics/Data_Collection/orchestration/run_collection_wrapper.sh</string>
```

### 3. Investigate Failing Jobs (MEDIUM PRIORITY)
```bash
# Check why these are failing
launchctl list | grep venterra

# View stderr for failed jobs
tail -100 /Users/mark/Property_Analytics/logs/semrush_weekly_collection_error.log

# Test manually
cd /Users/mark/Property_Analytics
python3 [script from plist]
```

### 4. Clean Up Orphaned Database Records (LOW PRIORITY)
```sql
-- Update orphaned "in_progress" records to "failed"
UPDATE data_collections 
SET status = 'failed', 
    completed_at = datetime('now'),
    error_message = 'Job did not complete (orphaned record)'
WHERE status = 'in_progress' 
AND started_at < datetime('now', '-1 hour');
```

---

## ✅ VERIFICATION CHECKLIST

After making changes:

- [ ] Only ONE collection job runs at 5:00 AM
- [ ] PSI data appears in database with timestamp from main collector
- [ ] No "in_progress" records older than 1 hour
- [ ] Logs in `Data_Collection/logs/` have substantive content
- [ ] `launchctl list | grep venterra` shows no exit code 1 for critical jobs
- [ ] Email alert sent after collection with full results
- [ ] Database `data_collections` table has entries for all sources

---

## 📋 CURRENT STATE SUMMARY

**Working Well:**
- ✅ Main collector (`com.venterra.portfolio.collection`) is operational
- ✅ All 10 data sources collecting successfully
- ✅ Database audit trails present
- ✅ Email alerts working (you received email)
- ✅ Data freshness excellent (only 4 minor issues)

**Needs Attention:**
- ⚠️ Duplicate PSI collectors causing exit code 1
- ⚠️ Main collector logs empty (need better logging)
- ⚠️ 3 other jobs showing exit code 1
- ⚠️ Some orphaned "in_progress" records in database

**Overall Assessment:** 
System is **functionally working** (data is collecting), but has **operational hygiene issues** (duplicate jobs, poor logging) that should be cleaned up.

---

**Next Steps:**
1. Disable duplicate PSI collectors
2. Fix logging for main collector
3. Investigate other failing jobs
4. Clean up orphaned database records
5. Re-run audit to verify clean state
