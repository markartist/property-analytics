# System Boundary & Integration Report
## Data Collection & Integrity System

**Version**: 1.0  
**Date**: January 27, 2026  
**Scope**: Architectural Review Document  
**System**: Unified Data Collection System  
**Location**: `/Users/mark/Property_Analytics/Data_Collection/`

---

## 1. SYSTEM BOUNDARY

### 1.1 Responsibilities (IN SCOPE)

The Data Collection & Integrity System is **EXCLUSIVELY** responsible for:

1. **Data Acquisition**
   - Collecting raw metrics from external APIs (GA4, GSC, Google Ads, PSI, SEMRush, GTMetrix, GBP)
   - Making API calls with proper authentication and retry logic
   - Handling rate limiting and connection failures
   - Writing raw metric data to database tables

2. **Collection Monitoring**
   - Tracking API call success/failure rates
   - Recording response times and retry attempts
   - Logging errors with full stack traces
   - Measuring collection job duration and resource usage

3. **Data Integrity Validation**
   - Verifying data was collected for all 91 properties
   - Detecting missing dates in time series
   - Identifying impossible values (negative metrics, CTR >100%)
   - Checking data freshness (staleness detection)
   - Cross-source consistency checks (e.g., GSC clicks vs GA4 organic traffic ratio)

4. **Alerting on Collection State**
   - Sending email notifications about collection success/failure
   - Reporting data freshness status
   - Flagging anomalies in collected data volume/patterns
   - Notifying about credential health issues

### 1.2 Non-Responsibilities (OUT OF SCOPE)

The Data Collection & Integrity System is **EXPLICITLY NOT** responsible for:

1. **Performance Scoring**
   - Does NOT compute property performance scores
   - Does NOT rank properties by performance
   - Does NOT calculate performance deltas or trends for business decisions

2. **SEO Risk Assessment**
   - Does NOT assess SEO risk levels
   - Does NOT prioritize SEO fixes
   - Does NOT recommend SEO actions

3. **Portfolio Optimization**
   - Does NOT recommend budget allocation
   - Does NOT suggest property investment priorities
   - Does NOT compute ROI or business value metrics

4. **Reporting & Visualization**
   - Does NOT generate weekly executive reports
   - Does NOT create dashboards (consumes data only)
   - Does NOT format metrics for business stakeholders

5. **Data Transformation**
   - Does NOT compute derived metrics (CIR, engagement rates)
   - Does NOT aggregate data for reporting purposes
   - Does NOT denormalize or reshape data for queries

6. **Business Logic**
   - Does NOT apply property-specific business rules
   - Does NOT interpret metric values in business context
   - Does NOT make recommendations based on collected data

### 1.3 Handoff Points

**Data Collection System STOPS at:**
- Writing raw metrics to database tables
- Recording collection metadata (success/failure, timestamps, error counts)
- Sending binary health status (OK, WARNING, CRITICAL)

**Downstream Systems START at:**
- Reading from database tables
- Computing derived metrics
- Interpreting business meaning
- Generating stakeholder reports
- Making recommendations

---

## 2. INTEGRATION POINTS

### 2.1 Data Outputs (Read by Downstream Systems)

**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

#### Core Data Tables (Raw Metrics)

| Table | Purpose | Consumption Pattern |
|-------|---------|---------------------|
| `ga4_daily_metrics` | GA4 session/user/pageview data | Read for traffic analysis, CIR computation |
| `ga4_traffic_sources` | GA4 channel attribution | Read for source analysis, organic tracking |
| `ga4_device_metrics` | GA4 device breakdown | Read for device-specific reports |
| `gsc_daily_metrics` | GSC aggregate metrics | Read for SEO performance |
| `gsc_queries` | GSC query-level data | Read for keyword analysis |
| `pagespeed_metrics` | PSI performance scores | Read for site speed reports |
| `semrush_domain_metrics` | SEMRush rankings | Read for competitive analysis |
| `google_ads_campaigns` | Ads spend/performance | Read for paid marketing analysis |
| `gbp_reviews` | GBP review data | Read for reputation tracking |
| `gbp_insights` | GBP engagement metrics | Read for local presence analysis |

**Contract**: Downstream systems MUST NOT assume collection succeeded. Always check `data_collections` table for job status before trusting data recency.

#### Metadata Tables (Collection Health)

| Table | Purpose | Consumption Pattern |
|-------|---------|---------------------|
| `data_collections` | Job-level success/failure | Check before using metrics |
| `collection_errors` | Error details | Review for debugging |
| `collection_performance` | Per-property metrics | Monitor collection health |
| `anomalies` | Statistical outliers detected | Flag suspicious data |

**Contract**: These tables provide **descriptive** information only. Do NOT use for prescriptive decisions (e.g., do not auto-exclude properties based on anomaly flags).

### 2.2 Signal Outputs

#### Email Alerts (Post-Collection)

**Recipients**: `mlaufhutte@venterraliving.com`  
**Frequency**: After every collection run (daily at ~5:15 AM)

**Signal Types**:

| Subject Pattern | Meaning | Downstream Action |
|-----------------|---------|-------------------|
| `✅ Data Collection Status: All Clear` | All 91 properties collected successfully, data is fresh | Proceed with all reports |
| `⚠️ Data Collection Alert: X Issues Found` | 1-20 properties have stale/missing data | Review property list, proceed with caution |
| `🔴 CRITICAL: X Data Collection Issues Detected` | >20 properties have stale/missing data | Delay reports, investigate |
| `🔴 CRITICAL: Collection System Failure` | Collection job failed to run or crashed | Do NOT use data, investigate immediately |

**Email Body Contains**:
- Collection job failures (if any) - system-level issues
- Per-source data freshness status (GA4, GSC, etc.)
- Per-property issue list
- Recommended manual actions

**Contract**: Email is **informational** only. Downstream systems MUST query database tables for programmatic decisions. Do NOT parse email for automation.

#### Database Status Queries

**To check if data is safe to use**:
```sql
-- Check most recent collection status
SELECT status, properties_successful, properties_failed, completed_at
FROM data_collections
WHERE data_source = 'ga4'  -- or 'gsc', etc.
ORDER BY started_at DESC LIMIT 1;

-- Result interpretation:
-- status = 'completed' AND properties_successful >= 86 (95%) → SAFE
-- status = 'failed' → UNSAFE
-- properties_failed > 10 → UNSAFE
```

**Binary Decision Rule**:
- `status = 'completed' AND properties_successful/properties_total >= 0.95` → **PROCEED**
- Otherwise → **DO NOT PROCEED**

### 2.3 Configuration Inputs (Read by Collection System)

| File | Purpose | Owner |
|------|---------|-------|
| `/Users/mark/Property_Analytics/config/venterra_properties_official.json` | Property registry (91 properties) | Manual (Mark) |
| `/Users/mark/Property_Analytics/credentials/` | API credentials | Manual (Mark) |
| `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist` | Schedule config | Manual (Mark) |

**Contract**: Collection system reads these as-is. Invalid config causes collection to fail (by design).

---

## 3. OVERLAP CHECK

### 3.1 Potential Overlaps Identified

#### ⚠️ OVERLAP #1: Anomaly Detection (Phase 4)

**Current Location**: `Data_Collection/monitoring/anomaly_detector.py`

**What It Does**:
- Computes statistical baselines (mean, stddev) for metrics
- Calculates z-scores for current values
- Flags values >3 standard deviations from baseline
- Stores in `anomalies` table with severity (critical/warning)

**Overlap Concern**:
- Anomaly detection could be interpreted as **performance assessment**
- Z-scores could be used for **ranking** properties
- Severity flags could drive **prioritization** decisions

**Recommendation**:
- **KEEP** in Data Collection System (it validates data quality, not business performance)
- **CLARIFY** that anomalies flag **suspicious data collection**, not business issues
- Example: "Sessions dropped 90%" could be data error OR actual traffic drop
- Downstream systems should interpret anomalies, not collection system

**Boundary Statement**:
> Anomaly detection identifies statistical outliers in collected data to flag potential collection errors or data quality issues. It does NOT assess whether metric values are "good" or "bad" for business purposes.

#### ⚠️ OVERLAP #2: Cross-Source Consistency Check (Phase 7)

**Current Location**: `Portfolio_Monitoring/validate_data_quality.py`

**What It Does**:
- Compares GSC clicks to GA4 organic sessions
- Flags if ratio is >10x or <0.1x different
- Checks if one source shows traffic but other shows zero

**Overlap Concern**:
- This validates **data integrity** (are sources aligned?)
- Could be misinterpreted as **SEO analysis** (is organic traffic performing well?)

**Recommendation**:
- **KEEP** in Data Collection System (it's data validation)
- **CLARIFY** that this checks for collection errors, not SEO performance
- Example: GSC=0 clicks but GA4=1000 organic sessions → likely collection error

**Boundary Statement**:
> Cross-source consistency checks validate that related data sources show correlated values, indicating successful collection. Large discrepancies suggest data collection issues, not business insights.

#### ✅ NO OVERLAP: Registry Completeness Validation (Phase 6)

**Current Location**: `Portfolio_Monitoring/validate_registry_completeness.py`

**What It Does**:
- Checks if all 91 properties from registry have recent data
- Flags properties missing from collection

**Conclusion**: Pure data collection validation. No overlap.

#### ✅ NO OVERLAP: Data Quality Checks (Gap Detection, Sanity Checks)

**Current Location**: `Portfolio_Monitoring/validate_data_quality.py`

**What It Does**:
- Detects missing dates in time series
- Flags impossible values (negative metrics, CTR >100%)

**Conclusion**: Pure data integrity checks. No overlap.

---

## 4. FAILURE SCENARIOS

### 4.1 Scenario: One API Partially Fails

**Example**: GSC API fails for 15 properties out of 91

**System Behavior**:
1. Collection continues for remaining 76 properties
2. Errors logged to `collection_errors` table with stack traces
3. `data_collections.properties_failed = 15`
4. Job status = 'completed' (not 'failed' - job ran to completion)

**Email Sent**:
- Subject: `⚠️ Data Collection Alert: 15 Issues Found`
- Body lists 15 properties with missing GSC data
- Classification: "Missing Yesterday's Data"

**Signal Emitted**:
- `data_collections.status = 'completed'`
- `data_collections.properties_failed = 15`
- `data_collections.properties_successful = 76`

**Downstream Action**:
- Query: `properties_successful/properties_total = 76/91 = 83.5%`
- Decision: **83.5% < 95% threshold → DO NOT PROCEED with GSC-dependent reports**
- Alternative: Generate reports for 76 properties only, flag 15 as "data unavailable"

---

### 4.2 Scenario: One Property Consistently Fails

**Example**: Property "Gateway North" fails GA4 collection for 7 consecutive days

**System Behavior**:
1. Each day: error logged, property counted in `properties_failed`
2. Anomaly detector may flag as pattern
3. Registry validation flags property as incomplete

**Email Sent** (Daily):
- Subject: `⚠️ Data Collection Alert: 1 Issue Found`
- Body: "Gateway North: Last GA4 data from 2026-01-20"

**Signal Emitted**:
- `data_collections.properties_failed = 1` (each day)
- `anomalies` table: may have entries for Gateway North

**Downstream Action**:
- Query: `properties_successful = 90/91 = 98.9%`
- Decision: **98.9% >= 95% threshold → PROCEED with reports**
- Note: Include disclaimer "Gateway North data from 2026-01-20"
- Manual investigation required (check credentials, property access)

---

### 4.3 Scenario: Entire Source Unavailable

**Example**: Google Analytics API is down (all 91 properties fail GA4 collection)

**System Behavior**:
1. Collection attempts all 91 properties
2. All fail with same error (e.g., "503 Service Unavailable")
3. `data_collections.properties_failed = 91`
4. Job status = 'completed' (job ran, API was down)

**Email Sent**:
- Subject: `🔴 CRITICAL: 91 Data Collection Issues Detected`
- Body: Lists all 91 properties as "Missing Yesterday's Data"
- Error type visible in logs: "503 Service Unavailable"

**Signal Emitted**:
- `data_collections.status = 'completed'`
- `data_collections.properties_failed = 91`
- `collection_errors` table: 91 rows with same error message

**Downstream Action**:
- Query: `properties_successful = 0/91 = 0%`
- Decision: **0% << 95% threshold → HALT all GA4-dependent reports**
- Manual: Check Google Analytics API status page
- Manual: Re-run collection when API recovers
- Do NOT treat as individual property issues

---

### 4.4 Scenario: Data Delayed but Eventually Backfilled

**Example**: GSC API provides data 5 days late (normal is 3 days)

**System Behavior**:
1. Day 1-2: GSC data appears stale, emails report "GSC: 91 missing"
2. Day 5: GSC API backfills, collection succeeds
3. Database now has continuous time series (no gaps)

**Email Sent**:
- Days 1-2: `⚠️ Data Collection Alert: 91 GSC Issues` (stale)
- Day 5: `✅ Data Collection Status: All Clear`

**Signal Emitted**:
- Days 1-2: `properties_successful = 0` for GSC
- Day 5: `properties_successful = 91` for GSC

**Downstream Action**:
- Days 1-2: **PROCEED with caution** - use most recent GSC data available (3+ days old)
- Day 5: **PROCEED normally** - full data now available
- Historical reports: No action needed (data backfilled automatically)
- Real-time dashboards: May show temporary dip, then recovery

---

### 4.5 Scenario: Collection Job Fails to Start

**Example**: Python import error prevents collection script from running (like Jan 25-27 outage)

**System Behavior**:
1. Launchd runs script, script exits with error code 1
2. NO data written to database
3. NO entry in `data_collections` table (job never started)
4. Error logged to stderr: `/Users/mark/Property_Analytics/Data_Collection/logs/collection_stderr.log`

**Email Sent**:
- Next day: `⚠️ Data Collection Alert: X Issues Found` (data now stale)
- Day 2+: `🔴 CRITICAL: X Issues` (staleness exceeds threshold)
- Email checks `data_collections` table and finds NO recent job

**Signal Emitted**:
- Query: `SELECT * FROM data_collections WHERE started_at >= date('now', '-1 day')`
- Result: **0 rows** (no job ran)

**Downstream Action**:
- Detection: Query returns 0 rows → **CRITICAL: Collection did not run**
- Decision: **HALT all reports** - no new data collected
- Manual: Check stderr log, investigate import/credential errors
- Manual: Fix issue and re-run collection manually

**NOTE**: Phase 8 alert system now checks for this scenario explicitly.

---

## 5. ARTIFACT LIST

### 5.1 Core Scripts

| Script | Purpose | Trigger |
|--------|---------|---------|
| `Data_Collection/orchestration/daily_master_collection.py` | Main collection orchestrator | Daily 5:00 AM via launchd |
| `Data_Collection/collectors/gsc_collector.py` | GSC data collection | Called by main script |
| `Data_Collection/collectors/gbp_collector.py` | GBP data collection | Called by main script |
| `Data_Collection/monitoring/alert_sender.py` | Post-collection alerts | Called by main script (Phase 8) |
| `Data_Collection/monitoring/collection_monitor.py` | Real-time collection tracking | Used during collection |
| `Data_Collection/monitoring/credential_monitor.py` | Pre-flight credential check | Called by main script (Phase 2) |
| `Data_Collection/monitoring/anomaly_detector.py` | Statistical anomaly detection | Called by main script (Phase 4) |
| `Data_Collection/utils/preflight.py` | Pre-flight validation | Called by main script (Phase 1) |
| `Data_Collection/utils/data_quality_validator.py` | Quality validation rules | Used by Phase 7 |
| `Portfolio_Monitoring/validate_registry_completeness.py` | Registry validation | Called by main script (Phase 6) |
| `Portfolio_Monitoring/validate_data_quality.py` | Enhanced quality checks | Called by main script (Phase 7) |

### 5.2 Supporting Utilities

| File | Purpose |
|------|---------|
| `Data_Collection/db/database_manager.py` | Database operations wrapper |
| `Data_Collection/utils/email_sender.py` | Email delivery utility |

### 5.3 Scheduled Jobs

| LaunchAgent | Script | Schedule | Purpose |
|-------------|--------|----------|---------|
| `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist` | `daily_master_collection.py` | Daily 5:00 AM | Main collection |
| `~/Library/LaunchAgents/com.venterra.psi_daily.plist` | `Portfolio_Dashboard/scripts/collect_daily_psi.py` | Daily 7:30 AM | PSI collection (separate) |
| `~/Library/LaunchAgents/com.venterra.daily.health.plist` | `generate_daily_portfolio_health.py` | Daily 9:00 AM | Health report email |
| `~/Library/LaunchAgents/com.venterra.weekly.progress.plist` | `generate_weekly_progress_report.py` | Monday 10:00 AM | Weekly progress email |

**NOTE**: PSI collector runs separately but writes to same database. Daily/weekly reports are **downstream systems** (out of scope for Data Collection system).

### 5.4 Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `/Users/mark/Property_Analytics/config/venterra_properties_official.json` | Property registry (91 properties) | JSON |
| `/Users/mark/Property_Analytics/credentials/client_secret.json` | GSC OAuth config | JSON |
| `/Users/mark/Property_Analytics/credentials/gsc_token_main.pickle` | GSC OAuth token | Pickle |
| `/Users/mark/Spotlight_Properties_Report/config/venterra-property-analytics-8e67b1bcc684.json` | GA4 service account | JSON |

### 5.5 Logs

| File | Purpose |
|------|---------|
| `Data_Collection/logs/collection_stdout.log` | Collection output |
| `Data_Collection/logs/collection_stderr.log` | Collection errors |

### 5.6 Documentation

| File | Purpose |
|------|---------|
| `Data_Collection/README.md` | System overview |
| `Data_Collection/MONITORING_AND_INTEGRITY.md` | 8-phase monitoring documentation |
| `Data_Collection/SYSTEM_BOUNDARY_AND_INTEGRATION_REPORT.md` | This document |
| `Data_Collection/MIGRATION_TODO.md` | Migration notes (historical) |

### 5.7 Database Schema

**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

**Core Tables**: 38+ tables (see `schema/portfolio_database_schema.sql`)

**Key Tables for Integration**:
- Data: `ga4_daily_metrics`, `gsc_daily_metrics`, `pagespeed_metrics`, etc.
- Metadata: `data_collections`, `collection_errors`, `collection_performance`
- Validation: `anomalies`, `data_quality_checks`, `registry_validation_failures`

---

## 6. ARCHITECTURAL DECISIONS

### 6.1 Design Principles

1. **Fail Loudly**: Collection failures emit explicit signals (emails, DB status)
2. **No Silent Failures**: Every collection run records status to `data_collections` table
3. **Data Over Interpretation**: System collects and validates data, does NOT interpret business meaning
4. **Binary Health Status**: Signals are OK/WARNING/CRITICAL, not semantic (e.g., "SEO risk high")
5. **Downstream Autonomy**: Downstream systems decide threshold for "usable data" (e.g., 95% success rate)

### 6.2 Key Constraints

1. **Single Database**: All collectors write to `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
2. **91 Properties**: System expects 91 active properties from registry
3. **Daily Collection**: Runs once per day at 5:00 AM (no intraday updates)
4. **API Delays**: GSC data has 3-day API delay (expected, not an error)
5. **Email Delivery**: Alerts require working SMTP credentials in `email_sender.py`

### 6.3 Trade-offs

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Single monolithic collector script | Simplifies scheduling, ensures atomic execution | Harder to parallelize, restart single source |
| 95% success threshold | Allows minor failures without halting reports | May proceed with incomplete data |
| Email alerts only | Simple, reliable, human-readable | No programmatic alerting (Slack, PagerDuty, etc.) |
| SQLite database | Simple, file-based, no server needed | Not horizontally scalable |
| 8 validation phases | Comprehensive coverage | Collection takes ~25-30 minutes |

---

## 7. DOWNSTREAM SYSTEM CONTRACTS

### 7.1 Reporting Systems (Spotlight, Weekly Health, Daily Health)

**Contract**:
1. Query `data_collections` table before generating reports
2. If latest collection has `properties_successful/properties_total < 0.95` → include disclaimer
3. If latest collection is `status = 'failed'` → do NOT generate report, send error email
4. Always check data recency: `MAX(metric_date)` in relevant table
5. Do NOT interpret anomalies or quality check failures (display only)

**Example Check**:
```sql
-- Before generating GA4 report
SELECT status, properties_successful, properties_total, completed_at
FROM data_collections
WHERE data_source = 'ga4'
ORDER BY started_at DESC LIMIT 1;

-- If completed_at < 24 hours ago AND properties_successful/properties_total >= 0.95 → PROCEED
-- Otherwise → HALT or add disclaimer
```

### 7.2 Dashboard Systems

**Contract**:
1. Display `data_collections.completed_at` timestamp on dashboards (data freshness indicator)
2. If data is >48 hours old, show warning banner
3. Do NOT compute derived metrics in collection system (compute in dashboard layer)
4. Respect `anomalies` table flags (display anomaly indicator, do NOT auto-exclude data)

### 7.3 Alert/Notification Systems (Future)

**Contract**:
1. Read from `data_collections` table (do NOT parse email alerts)
2. Binary decision logic: `status='completed' AND success_rate>=95%` → OK
3. Escalate only on CRITICAL: `status='failed' OR success_rate<80%`
4. Do NOT alert on individual property failures (only system-wide)

---

## 8. TESTING & VALIDATION

### 8.1 How to Test System Health

**Test 1: End-to-End Collection**
```bash
cd /Users/mark/Property_Analytics
python3 Data_Collection/orchestration/daily_master_collection.py --test
# Expected: Runs 3 properties, completes 8 phases, sends test email
```

**Test 2: Alert System**
```bash
python3 Data_Collection/monitoring/alert_sender.py --test
# Expected: Generates email preview at /tmp/alert_preview.html
```

**Test 3: Database Status**
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT data_source, status, properties_successful, properties_total, completed_at 
   FROM data_collections 
   ORDER BY started_at DESC LIMIT 5;"
# Expected: Recent jobs with status='completed'
```

### 8.2 Success Criteria

- ✅ Collection completes all 8 phases in <30 minutes
- ✅ Email alert sent after every run (check inbox daily)
- ✅ `data_collections` table updated with job status
- ✅ Data exists for ≥95% of properties (86+ out of 91)
- ✅ No gaps in daily time series (accounting for API delays)

---

## 9. KNOWN LIMITATIONS

1. **No Real-Time Collection**: Data updates once daily (5:00 AM)
2. **No Retry Logic for Full Job**: If job fails, must re-run manually (individual API calls have retries)
3. **Email-Only Alerts**: No Slack, PagerDuty, or programmatic alerting
4. **Single Threaded**: Collectors run sequentially (not parallelized)
5. **No Historical Backfill**: System collects "yesterday's data" only (no automatic backfill for gaps)
6. **GSC 3-Day Delay**: GSC data is expected to be 3 days old (API limitation, not system issue)
7. **SQLite Locks**: Concurrent writes will fail (only one collection job should run at a time)

---

## 10. CHANGE MANAGEMENT

### 10.1 Modifying Collection Logic

**If you need to change collection behavior**:
1. Edit relevant collector in `Data_Collection/collectors/`
2. Test with `--test` flag first
3. Update `MONITORING_AND_INTEGRITY.md` if validation logic changes
4. Do NOT modify database schema without updating downstream systems

### 10.2 Adding New Data Source

**Procedure**:
1. Create new collector in `Data_Collection/collectors/new_source_collector.py`
2. Add table(s) to database schema
3. Integrate into `daily_master_collection.py`
4. Add freshness checks to `alert_sender.py` (Phase 8)
5. Update this document (Section 2.1 - Data Outputs)

### 10.3 Changing Alert Thresholds

**Files to Edit**:
- `Data_Collection/monitoring/alert_sender.py` (lines 109-114: staleness thresholds)
- `Data_Collection/monitoring/anomaly_detector.py` (z-score thresholds)

**Notify Downstream**:
- Update this document (Section 4 - Failure Scenarios)
- Inform report owners of new thresholds

---

## 11. SUMMARY

### System Purpose
Collect raw metrics from 8 data sources for 91 properties, validate data integrity, and emit health signals.

### System Boundary
- **IN SCOPE**: Data acquisition, integrity validation, alerting on collection state
- **OUT OF SCOPE**: Performance scoring, SEO risk, portfolio optimization, reporting

### Integration
- **Outputs**: Database tables (raw metrics + metadata), email alerts (informational)
- **Inputs**: Property registry, API credentials
- **Contract**: Downstream systems query `data_collections` table before using data

### Failure Behavior
- Partial failures: Job completes, failures logged, alerts sent
- Full failures: Job status='failed', CRITICAL alert, downstream HALTS

### Maintenance
- Daily: Review email alerts
- Weekly: Check error patterns in `collection_errors` table
- Monthly: Adjust anomaly thresholds if needed

---

**Document Version**: 1.0  
**Last Review**: January 27, 2026  
**Next Review**: March 1, 2026  
**Owner**: Mark Laufhutte (mlaufhutte@venterraliving.com)  
**Status**: APPROVED - System Deployed
