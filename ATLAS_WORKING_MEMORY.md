# ATLAS WORKING MEMORY
**Last Updated:** 2026-01-31 17:30 UTC  
**Purpose:** Single source of truth for Atlas AI - read this FIRST in every session

---

## 🎯 READ THIS FIRST

**If you're starting a new session:**
1. Read this entire file (5 min)
2. Check "Current System State" for what's broken/working
3. Review "Session Log" for recent changes
4. Update this file after EVERY significant action

**Critical Paths:**
- Master DB: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Property Registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- New Collection System: `/Users/mark/Property_Analytics/Data_Collection/`
- Legacy (Broken): `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`

---

## 📊 CURRENT SYSTEM STATE

### Master Database ✅
**Location:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Size:** 166 MB  
**Last Updated:** 2026-01-28 21:59  
**Schema:** 60+ tables (Phases 1-4 complete)  
**Properties:** 92 in database, 91 in registry

### Data Freshness (AS OF 2026-01-28 22:51)
**GA4:**
- ✅ FRESH: 92/92 properties have Jan 27 data (collected at 21:59 today)
- Jan 27: 92 properties with fresh data
- **Status:** Collection working correctly

**GSC:**
- ✅ FRESH: 93 properties with data through Jan 25 (collected at 21:18 today)
- 3-day lag confirmed (latest available: Jan 25)
- **Status:** Collection working correctly

**Overall Status:** All data sources fresh and collecting properly

### Data Collection System
**Primary (NEW):** `/Users/mark/Property_Analytics/Data_Collection/`
- ✅ Structure unified and clean
- ⚠️ GSC collection partially working but unstable
- ✅ GA4 collection working well
- ⚠️ Scheduled job at 5:00 AM - status unknown for today
- ✅ Writing to master DB correctly

**Legacy (BROKEN):** `/Users/mark/Property_Analytics/Portfolio_Monitoring/`
- 🔴 `collect_daily_data.py` has module import errors
- 🔴 Not in use, not scheduled
- ℹ️ Should be deprecated

### Scheduled Jobs (launchd)
```
✅ com.venterra.portfolio.collection  - 5:00 AM (Data_Collection)
✅ com.venterra.portfolio.pulse       - 8:00 AM (Portfolio Pulse)
✅ com.venterra.daily.health          - 9:00 AM (Health Reports)
✅ com.venterra.weekly.progress       - 10:00 AM Mon (Progress)
⚠️ com.venterra.portfolio.psi         - Multiple runs (needs investigation)
🔴 com.venterra.semrush_weekly        - Exit 1
🔴 com.venterra.registry_validation   - Exit 1
🔴 com.venterra.psi_daily            - Exit 1
```

---

## 🏗️ SYSTEM ARCHITECTURE

### Core Components

#### 1. Master Database (Single Source of Truth)
**Path:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Writers:**
- Data_Collection system (primary)
- Legacy collectors (deprecated, don't use)

**Readers:**
- Property Intelligence Brief (PIB)
- Portfolio Pulse
- Daily Health Reports
- Weekly Progress Reports
- Spotlight Properties Report
- All monitoring/alert systems

**Schema Phases:**
- Phase 1: Collection Monitoring ✅
- Phase 2: Single-Source Quality Validation ✅
- Phase 3: Cross-Source Correlation ✅
- Phase 4: Anomaly Detection (SOFT/INFO only) ✅

#### 2. Property Registry (Single Source of Truth)
**Path:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`  
**Properties:** 91 Venterra properties  
**Contains:** GA4 IDs, GSC URLs, names, aliases, site types

**Used By:** EVERYTHING - never hardcode property lists

#### 3. Data Collection System (Unified)
**Path:** `/Users/mark/Property_Analytics/Data_Collection/`

**Structure:**
```
Data_Collection/
├── db/                  # DatabaseManager (primary, use this)
├── collectors/          # Individual source collectors
├── orchestration/       # daily_master_collection.py (main script)
├── monitoring/          # Anomaly detection, alerts, health checks
├── utils/              # Shared utilities
└── logs/               # Collection logs
```

**Main Script:** `orchestration/daily_master_collection.py`
- Scheduled: 5:00 AM daily
- Collects: GA4, GSC, Google Ads, PSI, SEMRush, GBP
- Database: Hardcoded to master DB (line 66)

### 4. Reporting Systems

**Property Intelligence Brief (PIB):**
- Path: `/Users/mark/Property_Analytics/Property_Intelligence_Brief/`
- Version: 1.9.0 (LOCKED OFFICIAL - 2026-01-31)
- Database: ✅ Master DB
- Email: ✅ AWS SES (mlaufhutte@venterraliving.com)
- Template: `templates/executive_email_template.py`
- Documentation: `docs/PIB_V1_9_STYLING_LOCKED.md`

**Portfolio Pulse:**
- Path: `/Users/mark/Property_Analytics/Portfolio_Monitoring/`
- Schedule: 8:00 AM daily (DISABLED - replaced by Daily Collection Report)
- Database: ✅ Master DB
- Delivery: Email + OneDrive
- Status: ⚠️ LaunchAgent disabled (com.venterra.portfolio.pulse.plist.disabled)

**Daily Collection Report:**
- Path: `/Users/mark/Property_Analytics/Data_Collection/monitoring/daily_collection_report.py`
- Schedule: Integrated into Phase 8 of daily_master_collection.py (after 5:00 AM collection)
- Database: ✅ Master DB
- Email: ✅ AWS SES (mlaufhutte@venterraliving.com)
- Purpose: Comprehensive collection status + data freshness + database health
- Sections: Data Freshness (8 sources), Collection Results (24h), DB Health Snapshot

**Daily Health Reports:**
- Schedule: 9:00 AM daily
- Database: ✅ Master DB
- Email: ✅ AWS SES

**Weekly Progress:**
- Schedule: 10:00 AM Mondays
- Database: ✅ Master DB

**Spotlight Properties Report (Weekly):**
- Path: `/Users/mark/Property_Analytics/Spotlight_Properties_Report/`
- Schedule: Wednesdays at 12:00 PM (launchd: com.venterra.spotlight.weekly)
- Script: `generate_weekly_spotlight_report_from_db.py`
- Database: ✅ Master DB (reads only, no collection)
- Output: OneDrive

**Core Web Vitals Snapshot:**
- Scripts: `generate_cwv_snapshot.py`, `send_cwv_snapshot_email.py`
- Purpose: Portfolio-wide PageSpeed/CWV rankings
- Database: ✅ Master DB
- Output: HTML + Excel via email

**GSC Portfolio Snapshot:**
- Scripts: `generate_gsc_snapshot.py`, `send_gsc_snapshot_email.py`
- Purpose: Portfolio-wide GSC organic search performance (30 days)
- Database: ✅ Master DB
- Output: HTML + Excel via email
- Features: Ranked by clicks, actual property names from registry, trend indicators

#### 5. Monitoring & Alerts

**Data Freshness Test:**
- Script: `Portfolio_Monitoring/send_data_alerts.py`
- Database: ✅ Master DB
- Status: ✅ Working correctly
- Last Run: Identified 103 issues (2026-01-28)

**Anomaly Detection:**
- Path: `Data_Collection/monitoring/anomaly_detector.py`
- Database: ✅ Master DB via DatabaseManager
- Status: ✅ Implemented (SOFT/INFO classifications)

---

## 📋 DATA SOURCES

### Google Analytics 4 (GA4)
- **API:** Google Analytics Data API v1
- **Properties:** 90 unique (91 registry, 1 shared ID)
- **Expected Lag:** 1 day (yesterday's data)
- **Tables:** `ga4_daily_metrics`, `ga4_traffic_sources`, `ga4_device_metrics`
- **Collection:** ✅ Working well (76/92 properties)

### Google Search Console (GSC)
- **API:** GSC API v1
- **Properties:** 93 registered
- **Expected Lag:** 3 days (T-3, confirmed by API testing)
- **Tables:** `gsc_daily_metrics`, `gsc_queries`
- **Collection:** ✅ Working (93 properties, collected 2026-01-28 21:18)

### Google Ads
- **API:** Google Ads API v22
- **Manager Account:** 9089267423
- **Properties:** 57 mapped
- **Expected Lag:** 1 day
- **Tables:** `google_ads_campaigns`, `google_ads_keywords`
- **Collection:** Status unknown (not verified recently)

### PageSpeed Insights (PSI)
- **API:** PSI API v5
- **Properties:** 89-90
- **Expected Lag:** Real-time
- **Tables:** `pagespeed_metrics`
- **Collection:** ✅ Working (12 runs on 2026-01-28)

### SEMRush
- **API:** SEMRush API v3
- **Properties:** 90
- **Expected Lag:** 0-1 days
- **Tables:** `semrush_domain_metrics`, `semrush_keyword_rankings`
- **Collection:** Status unknown

### Google Business Profile (GBP)
- **API:** GBP API
- **Properties:** 22+ with reviews
- **Tables:** `gbp_reviews`, `review_sentiment`, `gbp_insights`
- **Collection:** Status unknown
- **Historical:** 22,509 reviews backfilled (2009-2026)

---

## 🚨 CRITICAL ISSUES (Priority Order)

### 1. GSC Collection Unstable (CRITICAL)
**Impact:** Only 3-5 properties collecting, 90 properties stale  
**Evidence:** Jan 25 data shows only 3 properties  
**Root Cause:** Collection hangs or fails during GSC processing  
**Owner:** Mark is debugging in parallel thread  
**Next Steps:** Wait for Mark's fix from other session

### 2. GA4 Collection Incomplete (HIGH)
**Impact:** 15 properties not collecting  
**Evidence:** 76/92 properties have recent data  
**Root Cause:** Unknown - need to check logs  
**Next Steps:** Review collection logs for those 15 properties

### 3. Multiple Scheduled Jobs Failing (MEDIUM)
**Failing Jobs:**
- com.venterra.semrush_weekly (exit 1)
- com.venterra.registry_validation (exit 1)
- com.venterra.psi_daily (exit 1)

**Next Steps:** Check logs for each

### 4. Legacy Collection System Broken (LOW)
**Impact:** Cannot use as fallback  
**Evidence:** ModuleNotFoundError in Portfolio_Monitoring  
**Action:** Deprecate or fix import paths

---

## ✅ VERIFIED WORKING

1. **Master Database:** All systems reference correct path
2. **Property Registry:** Unified, no hardcoded lists
3. **Email System:** `utils/email_sender.py` used by all
4. **Data_Collection Structure:** Clean imports, no conflicts
5. **DatabaseManager:** Primary version in Data_Collection working
6. **Reporting Systems:** All reading from master DB
7. **Alert Systems:** Freshness monitoring operational
8. **GA4 Collection:** 76/92 properties collecting successfully
9. **PSI Collection:** Running and logging properly

---

## 📝 SESSION LOG

### 2026-01-28 22:51 - GSC Portfolio Snapshot Report Creation
**Actions:**
- Created new GSC Portfolio Snapshot report (modeled after CWV Snapshot)
- Built comprehensive report showing 30-day GSC performance for all properties
- Ranked by organic clicks (descending)
- Includes: clicks, impressions, CTR, average position with trend indicators
- Generates both HTML and Excel outputs
- Maps GSC URLs to actual property names from registry
- Created email sender script for automated delivery

**Debugging Session:**
- Initially showed 82 properties instead of 93
- User caught the error and insisted on verification
- Found that `HAVING clicks > 0` filter was incorrectly excluding 11 properties
- Removed filter - all 93 properties now included
- Fixed property names to show "San Palmilla" instead of URLs
- Verified data freshness: GSC collected today at 21:18 PM

**Created Files:**
- `/Users/mark/Property_Analytics/generate_gsc_snapshot.py`
- `/Users/mark/Property_Analytics/send_gsc_snapshot_email.py`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/Portfolio_GSC_Snapshot_2026-01-28.html`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/Portfolio_GSC_Snapshot_2026-01-28.xlsx`

**Report Features:**
- 93 properties with 30-day GSC metrics (Dec 29 - Jan 27)
- Total: 18,574 clicks, 655,153 impressions, 2.84% CTR
- Performance bands: 16 Excellent (CTR ≥5%), 23 Good (3-5%), 54 Needs Improvement (<3%)
- Trend indicators vs. previous 30 days
- Color-coded grades and metrics
- Excel with all data, color-coded, sortable

**Verifications:**
- ✅ All 93 properties included (including Sundara with no data yet)
- ✅ GSC data fresh (collected 2026-01-28 21:18, latest metric: Jan 25)
- ✅ Property names correctly mapped from registry
- ✅ Data accuracy confirmed for top 5 properties
- ✅ Report emailed successfully with Excel attachment
- ✅ 3-day GSC lag confirmed (latest available: Jan 25)

**Key Learnings:**
- Always verify property counts match expected totals
- Test SQL queries directly when Python results seem wrong
- GSC has 3-day lag (immutable API constraint)
- HAVING clauses can behave unexpectedly - verify results
- User's instinct to question data discrepancies was correct

**Outstanding:**
- None - report complete and verified

### 2026-01-28 22:24 - Spotlight Report Automation & Critical Fix Discovery
**Actions:**
- Discovered main collection job was NOT running at scheduled 5:00 AM time
- Root cause: XML escaping errors in launchd plist (&&, >>, 2>> not escaped)
- Fixed plist with proper XML entities (&amp;&amp;, &gt;&gt;, 2&gt;&gt;)
- Validated and reloaded main collection job successfully
- Removed old Spotlight collection cron job (Wednesdays at noon)
- Created NEW Spotlight weekly report launchd job (database-based, no collection)
- Loaded com.venterra.spotlight.weekly job

**What Was Wrong:**
- The main data collection at 5:00 AM hasn't been running for days
- XML syntax errors prevented launchd from loading the job properly
- GA4 data was being collected by something else (likely manual Spotlight runs)
- This explains why data_collections table showed last run on Jan 24

**What's Fixed:**
1. Main collection plist now has proper XML escaping
2. Job loads successfully with `launchctl load`
3. Will run tomorrow at 5:00 AM for the first time in days
4. Spotlight report now automated via launchd (not cron)
5. Spotlight reads from database, doesn't collect data

**Created Files:**
- `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.weekly.plist`
- `/tmp/crontab_backup_20260128_220135.txt`
- `/tmp/scheduled_jobs_summary.txt`

**Verifications:**
- ✅ Plist validates with plutil -lint
- ✅ Main collection job loaded (launchctl list shows it)
- ✅ Spotlight weekly job loaded and scheduled
- ✅ Old cron job removed from crontab
- ✅ GA4 data IS fresh (Jan 27 collected at 21:59 today)

**Critical Insight:**
- Data collection was happening somehow (GA4 fresh to Jan 27)
- But NOT via the scheduled Data_Collection job
- Likely from manual report runs that collect data directly
- Now unified: Data_Collection at 5 AM, reports read from DB

**Outstanding:**
- Verify 5:00 AM collection runs successfully tomorrow (2026-01-29)
- Check that logs populate correctly
- Verify Spotlight report runs next Wednesday (Feb 5)
- GSC data still 4 days old - will be fresh after tomorrow's run

### 2026-01-28 21:49 - Scheduled Jobs Cleanup & Logging Fix
**Actions:**
- Removed duplicate PSI collectors (com.venterra.psi_daily, com.venterra.portfolio.psi)
- Fixed main collector logging with Python unbuffered mode (-u flag)
- Added explicit log redirection to plist (>> append mode)
- Reloaded main collector job with new configuration
- Created comprehensive scheduled jobs audit document

**Verifications:**
- ✅ Duplicate PSI collectors unloaded and disabled
- ✅ No PSI jobs showing in launchctl list
- ✅ Main collector reloaded successfully (exit code 0)
- ✅ Log file writable and accepting appends
- ✅ Python -u flag added for unbuffered output
- ✅ 7/9 jobs now showing exit code 0 (was 7/11)

**What Changed:**
1. Disabled PSI collectors: `*.plist.disabled` (no longer running)
2. Updated main collector plist with:
   - Python -u (unbuffered output)
   - Explicit log redirection (>> for append)
   - Added Python bin to PATH
3. Backed up old plist before changes

**Created Files:**
- `/Users/mark/Property_Analytics/SCHEDULED_JOBS_AUDIT.md`
- `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist.backup-20260128`

**Outstanding:**
- 2 jobs still exit code 1 (registry_validation, semrush_weekly)
- Need to verify logs populate after next scheduled run (5:00 AM)
- Orphaned "in_progress" database records (low priority)

### 2026-01-28 21:18 - Atlas Memory System Integration
**Actions:**
- Created comprehensive Atlas memory system
- Integrated with Warp (.warp/context.md)
- Added git post-checkout hook for reminders
- Created atlas_session_start.sh helper script
- Updated main README with AI assistant section
- Initialized git repository
- Created first commit with memory system

**Created Files:**
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md` (master memory)
- `/Users/mark/Property_Analytics/.warp/context.md` (Warp integration)
- `/Users/mark/Property_Analytics/.git/hooks/post-checkout` (git hook)
- `/Users/mark/Property_Analytics/atlas_session_start.sh` (helper script)
- Updated `README.md` with AI section at top

**How It Works:**
1. Warp shows context file pointing to ATLAS_WORKING_MEMORY.md
2. Git checkout triggers reminder to read memory
3. Helper script provides quick health check
4. README has prominent AI section
5. Atlas updates session log after every action

**Verifications:**
- ✅ atlas_session_start.sh works correctly
- ✅ Shows database size (176M), latest data (2026-01-27)
- ✅ Detects critical issues in memory file
- ✅ Git repository initialized with first commit
- ✅ All files tracked and committed

**Outstanding:**
- None - integration complete

### 2026-01-28 21:06 - Data Collection Debug (with Mark)
**Actions:**
- Mark debugged Data_Collection system in parallel session
- GA4 collection now working for 76 properties (was 4-14)
- GSC still unstable but improved from 0 properties
- Verified all systems using master database

**Verifications:**
- ✅ Data_Collection writes to master DB
- ✅ DatabaseManager correctly resolves path
- ✅ Fresh data visible in ga4_daily_metrics
- ✅ Freshness test correctly identifies issues (103 down from 179)

**Outstanding:**
- GSC collection needs stabilization
- 15 GA4 properties not collecting
- Multiple scheduled jobs showing exit code 1

### 2026-01-28 20:55 - System Unification Verification
**Actions:**
- Created comprehensive verification document
- Audited all 119 references to master database
- Confirmed unified architecture across all components
- Documented system boundaries and integration points

**Created Files:**
- `/Users/mark/Property_Analytics/SYSTEM_UNIFICATION_VERIFICATION.md`

**Key Findings:**
- System 95% unified
- All major components using master DB
- Only critical issue is data collection stability

### 2026-01-28 20:38 - Data Freshness Test
**Actions:**
- Ran initial data freshness test
- Identified 179 issues (later reduced to 103)
- Discovered collection system issues

**Key Findings:**
- Database was 4 days stale (last full collection Jan 24)
- Portfolio_Monitoring collector broken
- Data_Collection system not completing runs

---

## 🎯 IMPORTANT PATTERNS TO REMEMBER

### 1. Always Check Master DB First
```bash
# Verify database exists
ls -lh /Users/mark/Property_Analytics/data/portfolio_analytics.db

# Check latest data
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date), COUNT(DISTINCT property_id) FROM ga4_daily_metrics"
```

### 2. Use Data_Collection DatabaseManager
```python
# CORRECT (use this)
from Data_Collection.db.database_manager import DatabaseManager

# WRONG (legacy, deprecated)
from Portfolio_Monitoring.src.db.database_manager import DatabaseManager
```

### 3. Read Documentation Before Changing
- Check `ATLAS_WORKING_MEMORY.md` (this file)
- Check relevant README in component directory
- Check phase completion docs for context
- Check `SYSTEM_UNIFICATION_VERIFICATION.md` for architecture

### 4. Update This File After Every Action
```markdown
### YYYY-MM-DD HH:MM - Brief Title
**Actions:** What did you do
**Verifications:** What did you confirm works
**Outstanding:** What's still broken
**Created Files:** Any new documentation
```

### 5. Test Before Assuming
- Don't trust exit codes alone (launchd shows 0 even when nothing runs)
- Check database for actual data
- Check logs for errors
- Run freshness test to verify

---

## 📚 KEY DOCUMENTATION

### Must-Read for Every Session
1. This file (`ATLAS_WORKING_MEMORY.md`)
2. `WARP.md` - Platform overview and AI assistant guide
3. `SYSTEM_UNIFICATION_VERIFICATION.md` - Architecture verification
4. `README.md` - System overview

### Component-Specific
- **Data Collection:** `Data_Collection/README.md`, `DATA_COLLECTION_README.md`
- **PIB:** `Property_Intelligence_Brief/docs/PIB_V1_9_STYLING_LOCKED.md`
- **Portfolio Pulse:** `Portfolio_Monitoring/docs/PORTFOLIO_PULSE_CONTRACT.md`
- **Database:** `data/README.md`, `docs/DATABASE_SCHEMA_REFERENCE.md`

### Phase Documentation
- `Portfolio_Monitoring/PHASE_1_COMPLETE.md` - Collection monitoring
- `Portfolio_Monitoring/PHASE_2_COMPLETE.md` - Quality validation
- `Portfolio_Monitoring/PHASE_3_COMPLETE.md` - Cross-source correlation
- `Portfolio_Monitoring/PHASE_4_COMPLETE.md` - Anomaly detection

### System Architecture
- `SYSTEM_ARCHITECTURE_MEMORY.md` - Detailed architecture
- `CAPABILITIES_INVENTORY_2026-01-23.md` - Complete capabilities list
- `memory/PROJECT_STATE.md` - Production status tracking

---

## 🔧 COMMON COMMANDS

### Check System Health
```bash
# Data freshness test
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 send_data_alerts.py --test

# Check scheduled jobs
launchctl list | grep venterra

# Check latest collection
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT metric_date, COUNT(*) FROM ga4_daily_metrics GROUP BY metric_date ORDER BY metric_date DESC LIMIT 7"
```

### Run Collections Manually
```bash
# Test mode (3 properties)
cd /Users/mark/Property_Analytics
python3 Data_Collection/orchestration/daily_master_collection.py --test

# Quick mode (GA4 + GSC only)
python3 Data_Collection/orchestration/daily_master_collection.py --quick

# Full collection
python3 Data_Collection/orchestration/daily_master_collection.py
```

### Check Logs
```bash
# New collection system
tail -100 /Users/mark/Property_Analytics/Data_Collection/logs/collection_stdout.log

# Legacy system
tail -100 /Users/mark/Property_Analytics/Portfolio_Monitoring/logs/collection_stdout.log

# PSI collection
tail -100 /Users/mark/Property_Analytics/logs/psi_daily_collection.log
```

---

## 🧠 ATLAS OPERATIONAL NOTES

### When Starting a New Session
1. ✅ Read this file completely
2. ✅ Check "Current System State" section
3. ✅ Review "Session Log" for recent changes
4. ✅ Run data freshness test if needed
5. ✅ Don't assume anything - verify first

### When Making Changes
1. ✅ Read relevant documentation first
2. ✅ Understand what's currently working
3. ✅ Test changes in isolation
4. ✅ Verify with database queries
5. ✅ Update this file immediately after

### When Debugging Issues
1. ✅ Check "Critical Issues" section first
2. ✅ Review recent session log entries
3. ✅ Check database for actual state
4. ✅ Check logs for errors
5. ✅ Don't make assumptions about "operational" systems

### Red Flags (Stop and Ask)
- ❌ No data in database for recent dates
- ❌ Logs are empty when job shows exit 0
- ❌ Multiple scheduled jobs failing
- ❌ Import errors in Python scripts
- ❌ Can't find expected files/tables

### Success Patterns
- ✅ Fresh data in database tables
- ✅ Scheduled jobs with substantive logs
- ✅ Freshness test shows <10 issues
- ✅ All major reports generating successfully
- ✅ Clear documentation of what changed

---

## 🎯 PROJECT SCOPE & SCALE

**System Type:** Production-grade portfolio analytics platform  
**Organization:** Venterra Living (multifamily real estate)  
**Properties:** 91 active properties across multiple states  
**Data Volume:** ~500MB daily processing  
**Database Size:** 161 MB (growing)  
**API Calls:** ~2,000/day across 6 external services

**Key Stakeholders:**
- Mark Laufhutte (WebOps, System Owner)
- Marketing team (report consumers)
- SEO team (report consumers)
- Property managers (PIB recipients)

**Critical SLAs:**
- Daily data must be <24 hours stale
- Reports must generate by 9:00 AM
- Alerts sent within 30 min of collection failure
- Database must be accessible 24/7

---

## 🚀 NEXT PRIORITIES

### Immediate (This Week)
1. **Stabilize GSC collection** - Get all 90+ properties collecting
2. **Fix 15 missing GA4 properties** - Investigate why they're not collecting
3. **Investigate failed scheduled jobs** - Fix exit code 1 jobs
4. **Verify scheduled collection runs** - Confirm 5:00 AM job actually executes

### Short Term (Next 2 Weeks)
1. **Deprecate Portfolio_Monitoring collectors** - Document as legacy
2. **Clean up duplicate code** - Remove conflicting modules
3. **Add integration tests** - Verify end-to-end data flow
4. **Document Data_Collection as primary** - Update all READMEs

### Long Term (This Month)
1. **Implement collection retry logic** - Auto-recover from failures
2. **Add real-time monitoring** - Dashboard for collection status
3. **Automate property onboarding** - Self-service property addition
4. **Optimize API usage** - Reduce quota consumption

---

## 📞 CONTACT & SUPPORT

**System Owner:** Mark Laufhutte  
**Email:** mlaufhutte@venterraliving.com  
**Location:** Local development environment (macOS)  
**Repository:** Local Git only (contains credentials, not remote)

**Atlas AI:**
- Read this file at start of every session
- Update after every significant action
- Ask Mark when documentation is unclear
- Never assume - always verify first

---

**END OF ATLAS WORKING MEMORY**

**Remember:** This is YOUR memory. Keep it current. Use it religiously. It's the difference between being helpful and being lost.

---

## Session: January 29, 2026 - ThirtyLines Integration & Competitor Analysis

**Duration:** ~2 hours  
**Status:** Phase 1 Complete - Awaiting Competitor Excel Sheet  
**Session Memory:** `SESSION_MEMORY_THIRTYLINES_COMPETITOR_ANALYSIS_2026-01-29.md`

### Major Accomplishments

#### 1. ThirtyLines Unit Availability Collector - PRODUCTION READY
- **Built:** Complete data collector for unit availability across all properties
- **Database:** 4 new tables + 1 view for floorplan and availability tracking
- **Coverage:** 91/91 properties successfully mapped and collecting
- **Data:** 933 floorplans, 1,607 units available, 2,547 individual units tracked
- **Location:** `Data_Collection/collectors/thirtylines_collector.py`

**Key Achievement:** Full property mapping using fuzzy matching + manual fixes. All 91 ThirtyLines properties mapped to GA4 property IDs in `property_metadata` table.

#### 2. SEMRush Competitor Analysis - TESTED & VALIDATED
- **Built:** Standalone competitor analyzer with intelligent filtering
- **API:** Validated SEMRush `domain_organic_organic` endpoint works
- **Filtering:** Smart logic excludes Venterra domains, service providers, aggregators
- **Test Results:** Successfully identified real apartment competitors
- **Location:** `Data_Collection/collectors/test_competitor_analysis.py`

**Key Finding:** SEMRush cannot analyze competitors at URL/subfolder level. Requires manual competitor mapping for venterraliving.com subfolder properties (70+ properties).

#### 3. Documentation Created
- Executive summary (MD + DOCX)
- SMTP access request for IT (MD + DOCX)
- Comprehensive session memory document
- Updated Atlas working memory

### Technical Details

**Database Schema Added:**
```
property_floorplans (10 cols) - Floorplan specs
unit_availability (9 cols) - Daily snapshots
available_units (16 cols) - Individual unit tracking
floorplan_pricing_history (7 cols) - Price trends
v_latest_availability - View for current data
```

**Property Mapping:**
- Master table: `property_metadata` (91 properties)
- Added column: `thirtylines_id` for feed mapping
- Mapping method: Exact match (76) + fuzzy match (14) + manual fixes (CoHo, The Parker)

**SEMRush Competitor Analysis:**
- Independent domains: ✅ Can get property-specific competitors
- Subfolder properties: ❌ Only domain-level competitors (not useful)
- Solution: Manual Excel sheet with competitor mappings

**Filtering Logic:**
- Excludes: nicolawealth.com, venterra.com, venterraliving.com (Venterra-owned)
- Excludes: Service keywords (promove, integrity, management, realty)
- Excludes: Aggregators (apartments.com, zillow.com, etc.)
- Excludes: Mega-sites (>500K traffic)
- Includes: Apartment-related domains with 1K-100K traffic

**Test Results:**
- venterraliving.com: 19 valid competitors (top: advenirliving.com with 35K traffic)
- monteverdesatx.com: 15 valid competitors (top: monteverdeapts.net)

### Decisions Made

1. **Use `property_metadata` as master table** - Not the old 15-row `properties` table
2. **Manual competitor mapping required** - SEMRush can't do URL-level analysis
3. **Standalone testing first** - Validate before integrating into daily collection
4. **Smart filtering essential** - Too many false positives without it

### Next Steps (Blocked)

**Immediate - Awaiting Data:**
- User locating Excel sheet with competitor mappings
- Need to understand structure/format before building importer

**Phase 2 - After Excel Sheet:**
1. Import competitor mappings to database
2. Build competitor metrics collector (SEMRush)
3. Add competitive intelligence to PIB report

**Phase 3 - Integration:**
1. Integrate ThirtyLines into daily 5 AM collection
2. Add availability section to PIB
3. Add leasing velocity metrics

### Files Created

- `Data_Collection/collectors/thirtylines_collector.py` - Production collector
- `Data_Collection/collectors/test_competitor_analysis.py` - Standalone test script
- `EXECUTIVE_SUMMARY.md` + `.docx` - Platform overview
- `SMTP_Access_Request.md` + `.docx` - IT documentation
- `SESSION_MEMORY_THIRTYLINES_COMPETITOR_ANALYSIS_2026-01-29.md` - Full session details

### Key Context for Future

**The Goal:** Enhance PIB with unit availability + competitive intelligence

**Current State:**
- ThirtyLines: READY (fully operational, not yet scheduled)
- Competitor analysis: READY (tested, awaiting manual mappings)
- PIB integration: PENDING

**Important Notes:**
- Most properties (70+) are venterraliving.com subfolders - need manual competitor maps
- CoHo is Venterra property, not "CoHo Apartments"
- ThirtyLines feed has 91 properties vs 93 in registry (2 missing from feed)

**Blocker:** Waiting for user to locate competitor Excel sheet

---

## Session: January 31, 2026 - PIB v1.9.0 LOCKED OFFICIAL

**Duration:** ~2 hours  
**Status:** Complete - v1.9.0 Locked as Official Standard  
**Commit:** `5498769`

### Major Accomplishments

#### 1. Unit Type Classified KPI - REPLACED LOCAL DISCOVERY
- **Change:** Replaced Local Discovery KPI with Unit Type Classified
- **Purpose:** Shows percentage of Google Ads spend that is unit-classified
- **Display:** Large percentage with color-coded status (Critical/Poor/Fair/Good/Excellent)
- **Details:** Shows spend breakdown and number of unit types targeted
- **Thresholds:**
  - 🔴 Critical (<20%) - Red
  - 🟠 Poor (20-40%) - Orange
  - 🟡 Fair (40-60%) - Yellow
  - 🟢 Good (60-80%) - Light Green
  - 🟢 Excellent (≥80%) - Dark Green

**Impact:** Makes unit classification issues immediately visible to stakeholders

#### 2. Confidence & Data Integrity - ENHANCED WITH GRADIENTS
- **Added:** Creative emoji and gradient styling to all 4 subsections
- **Data Source Coverage:** Purple gradient (#667eea → #764ba2) with 📈 emoji
- **Data Freshness:** Teal-green gradient (#11998e → #38ef7d) with 🕐 emoji
- **Methodology & Limitations:** Pink-red gradient (#f093fb → #f5576c) with ⚠️ emoji
- **Data Quality Confidence:** Blue gradient (#4facfe → #00f2fe) with ✅ emoji
- **All collectors added:** GA4, GSC, CIR, PageSpeed, Google Ads, GBP Insights, Review Sentiment

**Impact:** Section now visually impressive with professional gradients and emojis

#### 3. Data Freshness Table - ALL 7 COLLECTORS
- **Added collectors:** PageSpeed, Google Ads, GBP Insights, Review Sentiment
- **Display:** Each with emoji, timestamp/date, and lag indicator
- **Format:** Clean table with color-coded lag status (green ✓, yellow ⚠️)
- **Coverage:** Complete transparency on all data source freshness

#### 4. Device Breakdown - FIXED CALCULATION
- **Issue:** Was showing 0.0% for all device types (Desktop/Mobile/Tablet)
- **Root Cause:** Template looking for non-existent `device_*_pct` fields
- **Solution:** Calculate percentages from `desktop_events`, `mobile_events`, `tablet_events`
- **Location:** Technical Appendix

**Impact:** Device breakdown now shows correct distribution

### Technical Details

**Files Modified:**
- `templates/executive_email_template.py` (Lines 106-220, 1300-1489)
- `docs/PIB_V1_9_STYLING_LOCKED.md` (Updated with all v1.9.0 features)

**Code Changes:**
1. Replaced `gbp_insights` reference with `google_ads` in KPI tile generation
2. Added 5-tier color-coded classification thresholds
3. Added gradient backgrounds to Confidence section (4 subsections)
4. Added emoji-specific data source indicators throughout
5. Added device percentage calculation logic (lines 1310-1324)
6. Extended Data Freshness table from 3 to 7 collectors

**Data Fields Used:**
- `google_ads.classified_pct` - Percentage classified
- `google_ads.classified_spend` - Dollar amount classified
- `google_ads.total_spend` - Total ad spend
- `google_ads.unit_type_breakdown` - Array of unit types
- `pagespeed.test_date` - PageSpeed test date
- `google_ads.window_end` - Ads data end date
- `gbp_insights.window_end` - GBP data end date

### Decisions Made

1. **Unit Type Classified > Local Discovery** - More actionable metric for paid media optimization
2. **5-tier color scheme** - Provides clear visual signal of classification health
3. **All 7 collectors in freshness** - Complete transparency, no data source hidden
4. **Gradient styling for Confidence** - Makes technical section visually appealing
5. **Device calc in template** - Avoids data pipeline changes, pure presentation fix

### Version Control

**Commit:** `5498769`
**Message:** "PIB v1.9.0 LOCKED: Unit Type Classified KPI, enhanced Confidence section, device breakdown fix"
**Branch:** main
**Co-Author:** Warp <agent@warp.dev>

### Documentation Updated

✅ `docs/PIB_V1_9_STYLING_LOCKED.md` - Complete v1.9.0 reference
✅ `ATLAS_WORKING_MEMORY.md` - This entry
✅ Git commit with detailed message

### Status

**PIB v1.9.0:** 🔒 LOCKED OFFICIAL STANDARD  
**Template:** `templates/executive_email_template.py`  
**Generator:** `generate_property_intelligence_brief.py`  
**Last Verified:** 2026-01-31 01:16 UTC

**Critical Rules:**
- NO changes to KPI tiles without approval
- NO changes to Confidence section gradients/emojis
- NO changes to section headers (no status pills)
- NO changes to Search Performance (full-width)
- NO changes to PageSpeed (side-by-side with colored emojis)

**Next PIB Work:** v2.0 development (separate template file)

---

## Session: January 31, 2026 - AWS SES Email Migration & Daily Collection Report

**Duration:** ~3 hours  
**Status:** Complete - All Systems Migrated to AWS SES  
**Session Memory:** Conversation summary stored in Warp

### Major Accomplishments

#### 1. Daily Collection Report System - PRODUCTION READY
- **Purpose:** Replace fragmented alert systems with comprehensive daily status report
- **Location:** `Data_Collection/monitoring/daily_collection_report.py`
- **Integration:** Phase 8 of `daily_master_collection.py` (lines 1657-1675)
- **Schedule:** Runs automatically after 5:00 AM daily collection completes
- **Email:** Sends via AWS SES to mlaufhutte@venterraliving.com

**Report Sections:**
1. **Data Freshness Status** (Top section)
   - All 8 data sources with age indicators
   - Color-coded freshness (green ✓, yellow ⚠️, red ✗)
   - Respects lag expectations (GSC: 3-day, GBP Insights: 2-day, SEMRush: 7-day)

2. **Collection Results** (Last 48 Hours)
   - Only shows collections with actual data (properties_total > 0)
   - Displays: Properties collected, success rate, duration, API metrics
   - Fixed to use correct column names (`properties_success`, not `properties_successful`)
   - Fixed table names (pagespeed_metrics, gbp_daily_insights, semrush_domain_metrics)

3. **Database Health Snapshot**
   - Current record counts for all 8 sources
   - Date ranges showing historical coverage
   - Total records: ~500K+ across all tables

**Design:**
- Solid header color (#15284B) for Outlook compatibility (no gradients)
- Professional Venterra branding
- Clear tabular data with proper formatting
- "Data Age" column (changed from "Days Old")

**Changes Made:**
- Disabled Portfolio Pulse LaunchAgent (renamed to .plist.disabled)
- Added daily_collection_report to Phase 8 of master collection
- Fixed data freshness queries for all 8 sources
- Extended collection window from 24h to 48h to catch morning runs

#### 2. AWS SES Email Migration - COMPLETE
- **Provider:** Amazon SES (Simple Email Service)
- **Endpoint:** email-smtp.us-east-2.amazonaws.com:587
- **Authentication:** SMTP username + password (IAM user: ses-smtp-user.20260129-223535)
- **Sender:** mlaufhutte@venterraliving.com
- **Display Name:** "Mark Laufhutte - Venterra Analytics"

**Changes Implemented:**
1. Updated `Data_Collection/utils/email_sender.py`:
   - Added `aws_ses` provider support
   - Separate username/password authentication (lines 118-124)
   - Maintained Gmail backup support

2. Created new email configuration:
   - Primary: `/Users/mark/Property_Analytics/credentials/email_config.json` (AWS SES)
   - Backup: `/Users/mark/Property_Analytics/credentials/email_config.json.gmail_backup` (Gmail)

3. Removed duplicate email sender:
   - Deleted: `/Users/mark/Property_Analytics/utils/email_sender.py`
   - Updated 10+ import statements from `utils.email_sender` to `Data_Collection.utils.email_sender`

4. Updated all scripts:
   - Property_Intelligence_Brief/send_property_assessment.py
   - Portfolio_Monitoring/* (multiple scripts)
   - Spotlight_Properties_Report/send_weekly_spotlight_email.py
   - All ad-hoc report emailers

**Configuration Details:**
```json
{
  "provider": "aws_ses",
  "smtp_server": "email-smtp.us-east-2.amazonaws.com",
  "smtp_port": 587,
  "smtp_username": "AKIAYJAGT54HEDH7GXFV",
  "smtp_password": "BF9JvyCFjFz/7TvTPutfOR3Ut7Jz1Vqq3VhRC4FWAEpF",
  "sender_email": "mlaufhutte@venterraliving.com",
  "sender_display_name": "Mark Laufhutte - Venterra Analytics"
}
```

**Benefits:**
- ✅ Professional email from @venterraliving.com domain
- ✅ IT-approved SMTP solution
- ✅ Gmail backup preserved for fallback
- ✅ No code changes needed in report generators
- ✅ All automated emails now use corporate domain

#### 3. Documentation Updates - COMPLETE
- **Updated:** `WARP.md` - Email configuration section (lines 344-354)
- **Updated:** `Data_Collection/README.md` - Email sender documentation
- **Updated:** `Data_Collection/utils/email_sender.py` - Inline docs with AWS SES examples
- **Created:** `docs/AWS_SES_EMAIL_MIGRATION.md` - Comprehensive migration guide
- **Updated:** All project WARP.md files referencing email system

### Technical Details

**Email Sender Updates:**
```python
# Primary config (AWS SES)
config = {
    "provider": "aws_ses",
    "smtp_server": "email-smtp.us-east-2.amazonaws.com",
    "smtp_port": 587,
    "smtp_username": "AKIAYJAGT54HEDH7GXFV",
    "smtp_password": "...",
    "sender_email": "mlaufhutte@venterraliving.com"
}

# Backup config (Gmail) - available at email_config.json.gmail_backup
```

**Daily Collection Report Integration:**
```python
# Phase 8 in daily_master_collection.py (line 1657)
logger.info("\n" + "="*80)
logger.info("PHASE 8: DAILY COLLECTION REPORT")
logger.info("="*80)

try:
    from monitoring.daily_collection_report import send_daily_collection_report
    logger.info("Sending comprehensive daily collection report...")
    send_daily_collection_report()
    logger.info("✅ Daily collection report sent successfully")
except Exception as e:
    logger.error(f"❌ Failed to send daily report: {e}")
```

**Import Path Standardization:**
All email sending now uses:
```python
from Data_Collection.utils.email_sender import EmailSender
```

### Files Created/Modified

**Created:**
- `Data_Collection/monitoring/daily_collection_report.py` - Main report generator
- `docs/AWS_SES_EMAIL_MIGRATION.md` - Migration documentation
- `credentials/email_config.json` - AWS SES configuration
- `credentials/email_config.json.gmail_backup` - Gmail fallback

**Modified:**
- `Data_Collection/utils/email_sender.py` - Added aws_ses provider
- `Data_Collection/orchestration/daily_master_collection.py` - Added Phase 8
- `WARP.md` - Updated email configuration section
- `Data_Collection/README.md` - Updated email documentation
- 10+ scripts with import path updates

**Deleted:**
- `/Users/mark/Property_Analytics/utils/email_sender.py` - Duplicate removed

**Disabled:**
- `~/Library/LaunchAgents/com.venterra.portfolio.pulse.plist` - Renamed to .disabled

### Decisions Made

1. **AWS SES as Primary** - Corporate email domain requirement
2. **Keep Gmail Backup** - Failover option if AWS SES issues occur
3. **Solid Header Colors** - Outlook doesn't render CSS gradients
4. **Data Age vs Days Old** - More professional terminology
5. **48-hour collection window** - Catches morning runs that happen after midnight
6. **Single Daily Report** - Replaces Portfolio Pulse and fragmented alerts
7. **Phase 8 Integration** - Report runs automatically after collection

### Status

**Email System:** ✅ Fully migrated to AWS SES  
**Daily Report:** ✅ Production ready and integrated  
**Documentation:** ✅ All files updated  
**Cleanup:** ✅ Duplicate code removed  
**Testing:** ✅ Email delivery verified  
**Last Verified:** 2026-01-31 17:30 UTC

**Critical Rules:**
- All automated emails now send from mlaufhutte@venterraliving.com
- Gmail backup available at `credentials/email_config.json.gmail_backup`
- Daily Collection Report is the ONLY morning alert (Portfolio Pulse disabled)
- All imports use `Data_Collection.utils.email_sender` (not `utils.email_sender`)

### Monitoring

**Email Delivery:**
- Provider: AWS SES (Simple Email Service)
- Region: us-east-2
- Authentication: IAM user with SMTP credentials
- TLS: Required (STARTTLS)
- Port: 587

**Daily Collection Report:**
- Timing: After 5:00 AM collection completes (Phase 8)
- Recipient: mlaufhutte@venterraliving.com
- Data Sources Checked: 8 (GA4, GSC, Google Ads, PSI, GBP Insights, GBP Reviews, ThirtyLines, SEMRush)
- Collection Window: Last 48 hours
- Database: portfolio_analytics.db

### Next Steps

None - session complete. All systems operational with AWS SES.

