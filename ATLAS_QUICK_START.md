# Atlas Memory System - Quick Start Guide

**For:** Mark (human) and Atlas (AI)  
**Purpose:** How to use the Atlas memory system effectively

---

## 🚀 For Mark: How to Use This System

### Starting a New Session with Atlas

**Option 1: Run the Helper Script**
```bash
cd /Users/mark/Property_Analytics
./atlas_session_start.sh
```

This shows:
- Memory file location
- Quick database health check
- Latest data date
- Critical issue alert

**Option 2: Just Tell Atlas**
```
"Read your Atlas memory and let me know the current system state"
```

---

### When Atlas Makes Changes

Atlas will automatically update `ATLAS_WORKING_MEMORY.md` with:
- What was changed
- What was verified
- What's still broken
- Any new files created

**You don't need to do anything** - just check the Session Log section to see what happened.

---

### When to Update the Memory Manually

Update **Current System State** section when:
- ✅ You fix a critical issue (mark it resolved)
- ✅ You discover new problems (add to critical issues)
- ✅ Data freshness changes significantly
- ✅ You add/remove scheduled jobs

---

## 🤖 For Atlas: Memory System Usage

### Session Start (MANDATORY)

1. **Read** `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
2. **Check** "Current System State" section
3. **Review** "Session Log" for recent changes
4. **Note** any critical issues

**Do this EVERY time, no exceptions.**

---

### After Every Significant Action (MANDATORY)

Update the **Session Log** in `ATLAS_WORKING_MEMORY.md`:

```markdown
### YYYY-MM-DD HH:MM - Brief Title
**Actions:**
- Bullet list of what you did

**Verifications:**
- ✅ What you confirmed works
- ❌ What failed

**Outstanding:**
- What's still broken/incomplete

**Created Files:**
- Any new documentation or code files
```

---

### When to Update System State

Update **Current System State** section when:
- Data freshness changes (verify with queries)
- Collection status changes (check database)
- Critical issues are resolved or discovered
- Scheduled jobs change

---

## 📁 File Structure

```
Property_Analytics/
├── ATLAS_WORKING_MEMORY.md          # Master memory (read/update this)
├── ATLAS_QUICK_START.md             # This file
├── SYSTEM_UNIFICATION_VERIFICATION.md # Architecture reference
├── atlas_session_start.sh            # Helper script
├── .warp/context.md                  # Warp integration
├── .git/hooks/post-checkout          # Git reminder
└── README.md                         # Has AI section at top
```

---

## 🎯 Common Workflows

### Atlas: Starting Fresh After Being Away
```bash
1. Read ATLAS_WORKING_MEMORY.md completely
2. Check Current System State section
3. Review last 2-3 Session Log entries
4. Run verification commands to confirm state
5. Note any critical issues before starting
```

### Mark: Getting Quick Status
```bash
./atlas_session_start.sh
```

Shows:
- Database size and latest data
- Number of scheduled jobs
- Critical issues flag

### Atlas: Making a Change
```bash
1. Read relevant docs FIRST
2. Understand current state
3. Make the change
4. Verify it worked (database/logs)
5. Update Session Log immediately
6. Update System State if needed
```

---

## ⚠️ Critical Rules

### For Atlas
- ✅ **ALWAYS read memory at session start**
- ✅ **ALWAYS update session log after actions**
- ✅ **ALWAYS verify with database, not assumptions**
- ✅ **ALWAYS check logs when something fails**
- ❌ **NEVER assume something works without checking**
- ❌ **NEVER skip reading the memory file**
- ❌ **NEVER forget to update after making changes**

### For Mark
- ✅ Point Atlas to memory file at session start
- ✅ Check session log to see what changed
- ✅ Update critical issues when you fix things
- ✅ Keep memory file current
- ❌ Don't let memory get stale

---

## 🔍 Verification Commands

**Check Database State:**
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date), COUNT(DISTINCT property_id) FROM ga4_daily_metrics"
```

**Run Freshness Test:**
```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 send_data_alerts.py --test
```

**Check Scheduled Jobs:**
```bash
launchctl list | grep venterra
```

---

## 📞 Contact

**System Owner:** Mark Laufhutte  
**Email:** mlaufhutte@venterraliving.com

---

**Remember:** The memory system only works if it's used religiously. Make it a habit.
