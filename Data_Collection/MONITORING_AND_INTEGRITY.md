# Data Collection Monitoring & Integrity System

**Last Updated**: January 27, 2026  
**Priority**: CRITICAL - Data Integrity is #1 Priority

## Overview

Multi-layered monitoring system ensures NO data collection failures go undetected. Every stage of collection is monitored, validated, and alerted.

---

## 🛡️ 8-Phase Integrity Validation

### PHASE 1: Pre-Flight Checks
**When**: Before collection starts  
**File**: `Data_Collection/utils/preflight.py`  
**Checks**:
- ✅ Database path exists and is writable
- ✅ Registry file exists and is valid JSON
- ✅ Required environment variables set

**Alerts**: Script exits if pre-flight fails (prevents bad runs)

---

### PHASE 2: Credential Health Check
**When**: During collector initialization  
**File**: `Data_Collection/monitoring/credential_monitor.py`  
**Checks**:
- ✅ GA4 service account credentials valid
- ✅ GSC OAuth token exists and not expired (warns if expired but has refresh token)
- ✅ API keys accessible
- ✅ Credential files readable

**Alerts**: 
- CRITICAL if credentials missing → collection exits
- WARNING if token expired but refreshable → collection continues

---

### PHASE 3: Real-Time Collection Monitoring
**When**: During active data collection  
**File**: `Data_Collection/monitoring/collection_monitor.py`  
**Tracks Per-Property**:
- ✅ API call success/failure
- ✅ Response times
- ✅ Rate limit hits
- ✅ Retry attempts
- ✅ Records collected count
- ✅ Error types and messages

**Database Tables**:
- `data_collections` - Overall job status
- `collection_performance` - Per-property performance
- `collection_errors` - Detailed error logging

**Alerts**: 
- Immediate email if error_count > threshold via `CollectionAlerter`
- Real-time slack/email for critical failures

---

### PHASE 4: Anomaly Detection
**When**: After collection completes  
**File**: `Data_Collection/monitoring/anomaly_detector.py`  
**Checks**:
- ✅ Statistical anomalies in collected metrics
- ✅ Sudden drops/spikes compared to historical baselines
- ✅ Impossible values detection
- ✅ Cross-source correlation issues

**Alerts**: 
- CRITICAL anomalies logged to `anomalies` table
- Included in post-collection report

---

### PHASE 5: Anomaly Detection (Additional)
**When**: After Phase 4  
**Purpose**: ML-based anomaly detection on collected data

**Status**: Integrated into collection flow

---

### PHASE 6: Registry Completeness Validation
**When**: After collection finishes  
**File**: `Portfolio_Monitoring/validate_registry_completeness.py`  
**Checks**:
- ✅ All 91 properties have recent data
- ✅ No properties silently missing from collection
- ✅ Registry configuration vs actual collection match
- ✅ GSC access flags match actual GSC data

**Database Table**: `registry_validation_failures`

**Alerts**: Warnings for properties not collecting data

---

### PHASE 7: Enhanced Data Quality Validation
**When**: After Phase 6  
**File**: `Portfolio_Monitoring/validate_data_quality.py`  
**Checks**:
- ✅ **Gap Detection**: Missing dates in time series (30-day window)
- ✅ **Sanity Checks**: Negative values, impossible CTR (>100%), zero sessions with high pageviews
- ✅ **Cross-Source Consistency**: GSC clicks vs GA4 organic traffic correlation
- ✅ **Query Data Depth**: API limit detection, impression mismatches

**Alerts**: Issues logged, summary included in output

---

### PHASE 8: Post-Collection Data Integrity Monitoring & Alerts  🆕
**When**: Final step after all validation  
**File**: `Data_Collection/monitoring/alert_sender.py`  
**Checks**:

#### A) Collection Job Failures (Last 3 Days)
- ✅ Jobs with status='failed'
- ✅ Jobs where >20% of properties failed
- ✅ Checks `data_collections` table

#### B) Data Freshness (All Properties)
- ✅ **GA4**: Data should be from yesterday (or today-1)
- ✅ **GSC**: Data should be from 3 days ago (accounts for API delay)
  - Missing if < 3 days ago
  - Stale if < 5 days ago
- ✅ **Google Ads**: Data from yesterday
- ✅ **PSI**: Data within 7 days
- ✅ **SEMRush**: Data from today

**Email Alerts**:
- ✅ **CRITICAL** subject if collection job failed
- ✅ **CRITICAL** subject if >20 data issues
- ✅ **WARNING** subject if <20 issues
- ✅ **ALL CLEAR** email if everything is healthy
- Sent to: `mlaufhutte@venterraliving.com`

**HTML Email Includes**:
- Collection job failure details (if any)
- Per-source breakdown of missing/stale data
- Per-property list of issues
- Recommended actions
- Links to logs and database

---

## 📊 What Gets Monitored

### During Collection (Real-Time)
1. ✅ API connection failures
2. ✅ Authentication failures
3. ✅ Rate limiting (429 errors)
4. ✅ Timeout errors
5. ✅ HTTP error codes (4xx, 5xx)
6. ✅ Empty responses
7. ✅ Malformed data
8. ✅ Property-level failures
9. ✅ Retry attempts
10. ✅ Response time degradation

### After Collection (Validation)
1. ✅ Data existence for all 91 properties
2. ✅ Data recency (staleness detection)
3. ✅ Date gaps in time series
4. ✅ Impossible/negative values
5. ✅ Cross-source consistency (GSC vs GA4)
6. ✅ Statistical anomalies
7. ✅ Registry completeness
8. ✅ Collection job success/failure rates
9. ✅ Query data comprehensiveness

---

## 🚨 Alert Types

### IMMEDIATE ALERTS (During Collection)
**Trigger**: Critical errors during active collection  
**Method**: Email via `CollectionAlerter`  
**Recipient**: mlaufhutte@venterraliving.com  
**Subject**: "🔴 IMMEDIATE: {SOURCE} Collection Failures"  
**Contents**:
- Error count
- Error types
- Failed property list (up to 10)
- Timestamp
- Action required message

### POST-COLLECTION ALERTS (After Validation)
**Trigger**: Data integrity issues detected  
**Method**: Email via `DataAlertEmailer`  
**Recipient**: mlaufhutte@venterraliving.com  
**Subject Varies**:
- "🔴 CRITICAL: Collection System Failure" (job failed)
- "🔴 CRITICAL: X Data Collection Issues Detected" (>20 issues)
- "⚠️ Data Collection Alert: X Issues Found" (<20 issues)
- "✅ Data Collection Status: All Clear" (no issues)

**Contents**:
- Collection job failures (if any) - HIGHLIGHTED IN RED
- Data freshness summary by source
- Per-property breakdown
- Missing vs stale classification
- Recommended actions
- Database and log paths

### ALL CLEAR EMAILS
**When**: Every morning after successful collection  
**Why**: Confirms monitoring system is working  
**Contents**: 
- Green checkmark
- "All data collectors are up-to-date"
- No missing or stale data
- Timestamp

---

## 📁 Monitoring Data Storage

### Database Tables

**`data_collections`** - Overall collection tracking
```sql
collection_id, data_source, started_at, completed_at, 
status, error_message, properties_total, properties_successful, 
properties_failed, duration_seconds, api_calls_total, 
api_calls_failed, rate_limit_hits, retry_attempts
```

**`collection_errors`** - Detailed error logging
```sql
error_id, collection_id, property_id, data_source, error_type,
error_code, error_message, stack_trace, api_response, 
retry_count, resolved, occurred_at
```

**`collection_performance`** - Per-property metrics
```sql
perf_id, collection_id, property_id, data_source,
started_at, completed_at, duration_seconds, api_calls,
records_collected, status, error_summary
```

**`anomalies`** - Statistical anomaly detection
```sql
anomaly_id, property_id, metric_name, metric_date,
current_value, baseline_mean, baseline_stddev, z_score,
severity, anomaly_type, detected_at
```

**`registry_validation_failures`** - Registry issues
```sql
failure_id, property_name, ga4_id, issue_type, 
issue_details, detected_at
```

**`data_quality_checks`** - Quality validation results
```sql
check_id, rule_id, property_id, data_source, metric_date,
passed, metric_value, expected_value, severity, failure_reason
```

---

## 🔍 How to Check System Health

### Check Most Recent Collection
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT * FROM data_collections ORDER BY started_at DESC LIMIT 1;"
```

### Check Collection Errors
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(*) as error_count, data_source, error_type 
   FROM collection_errors 
   WHERE DATE(occurred_at) = DATE('now') 
   GROUP BY data_source, error_type;"
```

### Check Data Freshness
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT 'GA4' as source, MAX(metric_date) as latest 
   FROM ga4_daily_metrics
   UNION ALL
   SELECT 'GSC', MAX(metric_date) FROM gsc_daily_metrics
   UNION ALL  
   SELECT 'PSI', MAX(metric_date) FROM pagespeed_metrics;"
```

### View Collection Logs
```bash
tail -f /Users/mark/Property_Analytics/Data_Collection/logs/collection_stdout.log
```

### Test Alert System
```bash
cd /Users/mark/Property_Analytics
python3 Data_Collection/monitoring/alert_sender.py --test
```

---

## ⚙️ Configuration

### Alert Recipient
File: `Data_Collection/monitoring/alert_sender.py` line 39
```python
self.recipient = 'mlaufhutte@venterraliving.com'
```

### Collection Schedule
File: `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist`
```xml
<key>StartCalendarInterval</key>
<dict>
    <key>Hour</key>
    <integer>5</integer>
    <key>Minute</key>
    <integer>0</integer>
</dict>
```

### Data Staleness Thresholds
File: `Data_Collection/monitoring/alert_sender.py` lines 109-114
```python
yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
two_days_ago = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
gsc_expected = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
gsc_stale_threshold = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
```

---

## 🎯 Success Criteria

**Data integrity is maintained if**:
1. ✅ Collection runs daily at 5:00 AM without failure
2. ✅ All 91 properties collect data successfully
3. ✅ No gaps in date series (accounting for API delays)
4. ✅ No anomalies detected
5. ✅ Alert emails sent after every collection run
6. ✅ "All Clear" emails indicate healthy state
7. ✅ Collection job success rate >95%
8. ✅ Property-level success rate >95%

---

## 🚑 Troubleshooting

### If No Alert Email Received
1. Check email_sender credentials: `/Users/mark/Property_Analytics/utils/email_sender.py`
2. Check collection logs: `Data_Collection/logs/collection_stdout.log`
3. Test alert system: `python3 Data_Collection/monitoring/alert_sender.py --test`

### If Collection Fails
1. Check stdout log: `Data_Collection/logs/collection_stdout.log`
2. Check stderr log: `Data_Collection/logs/collection_stderr.log`
3. Query errors: `SELECT * FROM collection_errors WHERE DATE(occurred_at) = DATE('now');`
4. Check credential monitor output in logs

### If Data is Stale
1. Check if collection ran: `launchctl list | grep venterra`
2. Check collection status: `SELECT * FROM data_collections ORDER BY started_at DESC LIMIT 5;`
3. Check for errors in specific source
4. Re-run manually: `python3 Data_Collection/orchestration/daily_master_collection.py`

---

## 📝 Maintenance

### Daily
- Review alert emails (automatic)
- Verify "All Clear" or address issues

### Weekly  
- Review `collection_errors` table for patterns
- Check anomaly trends
- Verify all 91 properties collecting data

### Monthly
- Review false positive rates in anomaly detection
- Adjust thresholds if needed
- Clean up old logs (>90 days)

---

## 🔐 Data Integrity Guarantee

**With this 8-phase monitoring system:**
- ❌ **CANNOT** have silent failures
- ❌ **CANNOT** have data gaps without alerts
- ❌ **CANNOT** have collection errors without notification
- ❌ **CANNOT** have stale data without detection
- ✅ **WILL** receive email after every collection
- ✅ **WILL** know immediately if something fails
- ✅ **WILL** have detailed error information
- ✅ **WILL** maintain data quality

**The 3-day silent failure that occurred Jan 25-27 cannot happen again.**
