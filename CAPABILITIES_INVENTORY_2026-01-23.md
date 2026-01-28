# Property Analytics System — Comprehensive Capabilities Inventory
**Date:** January 23, 2026  
**Prepared For:** Technical Architecture Review  
**Purpose:** Complete inventory of all capabilities, data sources, integrity checks, insights, and guardrails

---

## Executive Summary

The Property Analytics System is an integrated platform monitoring 91 Venterra properties across 7 automated capabilities using 5 external data sources. The system processes ~500MB of data daily, generates 120+ actionable insights, and delivers 5 automated reports to stakeholders. All capabilities share a single canonical database (`portfolio_analytics.db`) with comprehensive data integrity checks and deterministic guardrails.

**System Scale:**
- **Properties:** 91 active properties
- **Data Sources:** 5 external APIs (GA4, GSC, SEMRush, PageSpeed Insights, Google Ads)
- **Database Tables:** 15+ tables with rollup aggregations
- **Daily Processing:** ~500MB data ingestion
- **Automated Capabilities:** 7 daily/weekly pipelines
- **Insights Generated:** 120+ daily actionable insights
- **Reports Delivered:** 5 automated report types

---

## 1. Data Collection Layer

### 1.1 Google Analytics 4 (GA4)

#### **Source Information**
- **API:** Google Analytics Data API v1
- **Authentication:** Service account OAuth 2.0
- **Rate Limits:** 10 requests/second, 25,000 requests/day
- **Credentials:** `/Users/mark/Property_Analytics/credentials/[service_account].json`

#### **Data Points Collected**
| Metric | Type | Frequency | Retention | Description |
|--------|------|-----------|-----------|-------------|
| Sessions | Integer | Daily | 14 days rolling | Website visits (ga:sessions) |
| Engaged Sessions | Integer | Daily | 14 days rolling | Sessions >10s or 2+ pageviews or conversion |
| Users | Integer | Daily | 14 days rolling | Unique visitors |
| Pageviews | Integer | Daily | 14 days rolling | Total pages viewed |
| Bounce Rate | Percentage | Daily | 14 days rolling | Single-page sessions |
| Traffic Sources | Dimensions | Daily | 14 days rolling | Organic, Direct, Paid, Social, Referral, Email |
| Event Counts | Integer | Daily | 14 days rolling | Intent events (CTAs, form submissions) |
| Device Categories | Dimensions | Daily | 14 days rolling | Desktop, Mobile, Tablet |

#### **Collection Schedule**
- **Frequency:** Daily at 5:00 AM CT
- **Script:** `Portfolio_Monitoring/collect_daily_data.py`
- **Automation:** launchd (`com.venterra.portfolio.collection.plist`)
- **Runtime:** ~15-20 minutes for 91 properties
- **Last Run Check:** `sqlite3 portfolio_analytics.db "SELECT MAX(metric_date) FROM ga4_daily_metrics"`

#### **Data Integrity Checks**
1. **Completeness Gate:** All 91 properties must return data or error logged
2. **Date Validation:** metric_date must match expected collection date (yesterday)
3. **Non-Negative Values:** Sessions, users, pageviews ≥ 0
4. **Reasonable Bounds:** Sessions <100,000/day (outlier detection)
5. **Traffic Source Sum:** All channel sessions must sum to total sessions (±1% tolerance)
6. **Duplicate Prevention:** Idempotent writes (UPSERT on property_id + metric_date)
7. **Missing Data Detection:** Zero sessions triggers insight "missing_data" category

#### **Database Tables**
- **Primary:** `ga4_daily_metrics` (property-level daily aggregates)
- **Traffic Sources:** `ga4_traffic_sources` (channel-level breakdown)
- **Events:** `ga4_event_facts` (event-level detail, 14 days)
- **Rollups:** `ga4_daily_rollup`, `ga4_property_daily_summary`

#### **Known Issues & Guardrails**
- **Data Lag:** GA4 has inherent 24-48 hour processing delay
- **Sampling:** Properties with <10K sessions/day are unsampled (guaranteed accuracy)
- **Session Definition Change:** GA4 sessions reset at midnight UTC, not local time
- **Guardrail:** Collection script exits with code 2 if ≥10 properties fail

---

### 1.2 Google Search Console (GSC)

#### **Source Information**
- **API:** Google Search Console API v1
- **Authentication:** OAuth 2.0 (user consent)
- **Rate Limits:** 200 requests/minute, 10,000 requests/day
- **Credentials:** `/Users/mark/Property_Analytics/credentials/gsc_oauth_token.json`

#### **Data Points Collected**
| Metric | Type | Frequency | Retention | Description |
|--------|------|-----------|-----------|-------------|
| Clicks | Integer | Daily | 14 days rolling | Clicks from Google search results |
| Impressions | Integer | Daily | 14 days rolling | Times property appeared in search |
| CTR | Percentage | Daily | 14 days rolling | Click-through rate (clicks/impressions) |
| Average Position | Decimal | Daily | 14 days rolling | Average ranking position (1-100) |
| Search Queries | Text | On-demand | N/A | Top 1000 queries driving traffic |
| Device Breakdown | Dimensions | Daily | 14 days rolling | Desktop vs Mobile |

#### **Collection Schedule**
- **Frequency:** Daily at 5:00 AM CT (same run as GA4)
- **Script:** `Portfolio_Monitoring/collect_daily_data.py`
- **Automation:** launchd (`com.venterra.portfolio.collection.plist`)
- **Runtime:** ~10-15 minutes for 91 properties
- **Data Lag:** 3 days (GSC data available T-3)

#### **Data Integrity Checks**
1. **Property URL Validation:** GSC property URL must match canonical registry URL
2. **Data Freshness:** metric_date must be exactly T-3 (no T-2 or T-4)
3. **CTR Calculation Verification:** CTR = (clicks/impressions) * 100, validated client-side
4. **Position Bounds:** Average position must be between 1.0 and 100.0
5. **Impressions ≥ Clicks:** Logical constraint enforced (impressions must be ≥ clicks)
6. **Missing Data Handling:** Zero impressions flagged as "no_search_visibility" insight
7. **Duplicate Prevention:** UPSERT on property_id + metric_date

#### **Database Tables**
- **Primary:** `gsc_daily_metrics` (property-level daily aggregates)
- **Queries:** `gsc_top_queries` (optional, on-demand collection)

#### **Known Issues & Guardrails**
- **3-Day Lag:** GSC data is always 3 days behind (Google limitation)
- **Query Data Limits:** Top queries limited to 1000 per property per day
- **Fresh Property Delay:** New properties may not appear in GSC for 1-2 weeks
- **Guardrail:** If property has GSC property registered but zero impressions for 7+ days, generate "search_visibility_issue" insight

---

### 1.3 SEMRush

#### **Source Information**
- **API:** SEMRush API v3
- **Authentication:** API key
- **Rate Limits:** Based on units (2,000,000 units/month subscription)
- **Credentials:** `/Users/mark/Property_Analytics/credentials/semrush_api_key.txt`

#### **Data Points Collected**
| Metric | Type | Frequency | Retention | Units Cost | Description |
|--------|------|-----------|-----------|------------|-------------|
| Domain Keywords | Integer | Weekly | 90 days | 500/property | Total keywords ranking |
| Top 50 Keywords | List | Weekly | 90 days | 500/property | Top ranking keywords with positions |
| Organic Traffic Estimate | Integer | Weekly | 90 days | 500/property | Estimated monthly organic traffic |
| Keyword Positions | Integer (1-100) | Weekly | 90 days | Included | Position for each keyword |
| Search Volume | Integer | Weekly | 90 days | Included | Monthly search volume per keyword |
| Brand vs Generic Classification | Boolean | Weekly | 90 days | Computed | Deterministic brand keyword detection |

#### **Collection Schedule**
- **Frequency:** Weekly (Wednesday 7:00 AM CT)
- **Script:** `Spotlight_Properties_Report/semrush_spotlight_collector/collect_weekly_semrush_data.py`
- **Automation:** Cron (optional, primarily on-demand)
- **Runtime:** ~30 seconds for 20 properties
- **Budget Usage:** ~10,000 units/week (0.5% of monthly budget)

#### **Data Integrity Checks**
1. **API Units Monitoring:** Track unit consumption, alert if >80% monthly budget used
2. **Property URL Matching:** Filter results to exact property domain only
3. **Keyword Classification:** Deterministic brand keyword detection (contains property name)
4. **Position Bounds:** All positions must be 1-100
5. **Search Volume Validation:** Search volume ≥ 0
6. **Duplicate Keyword Prevention:** Same keyword + property + date = single row
7. **Missing Data Handling:** Zero keywords triggers "no_semrush_data" note in reports

#### **Database Tables**
- **Primary:** `semrush_domain_metrics` (property-level summary)
- **Keywords:** `keyword_rankings` (keyword-level detail)

#### **Known Issues & Guardrails**
- **Unit Budget:** Carefully monitor unit consumption (500 units per property)
- **Competitive Contamination:** Must filter to exact domain (e.g., exclude competitor results)
- **Brand Keyword Inflation:** Brand keywords excluded from "organic performance" calculations
- **Guardrail:** Stop collection if <10,000 units remaining in monthly budget

---

### 1.4 PageSpeed Insights (PSI)

#### **Source Information**
- **API:** PageSpeed Insights API v5
- **Authentication:** API key
- **Rate Limits:** 25,000 requests/day (free tier)
- **Credentials:** `/Users/mark/Property_Analytics/config/pagespeed_api_key.txt`

#### **Data Points Collected**
| Metric | Type | Frequency | Retention | Strategy | Description |
|--------|------|-----------|-----------|----------|-------------|
| Performance Score | Integer (0-100) | Daily | 90 days | Mobile + Desktop | Lighthouse performance score |
| SEO Score | Integer (0-100) | Daily | 90 days | Mobile + Desktop | Lighthouse SEO score |
| Accessibility Score | Integer (0-100) | Daily | 90 days | Mobile + Desktop | Lighthouse accessibility score |
| Best Practices Score | Integer (0-100) | Daily | 90 days | Mobile + Desktop | Lighthouse best practices score |
| Largest Contentful Paint (LCP) | Seconds | Daily | 90 days | Mobile + Desktop | Core Web Vital: loading performance |
| First Input Delay (FID) | Milliseconds | Daily | 90 days | Mobile + Desktop | Core Web Vital: interactivity |
| Cumulative Layout Shift (CLS) | Score | Daily | 90 days | Mobile + Desktop | Core Web Vital: visual stability |
| First Contentful Paint (FCP) | Seconds | Daily | 90 days | Mobile + Desktop | First paint time |
| Time to First Byte (TTFB) | Seconds | Daily | 90 days | Mobile + Desktop | Server response time |

#### **Collection Schedule**
- **Frequency:** Daily at 5:10 AM CT
- **Script:** `Portfolio_Monitoring/collect_daily_data.py` (PageSpeed module)
- **Automation:** launchd (`com.venterra.portfolio.psi.plist`)
- **Runtime:** ~45 seconds per property (2-second rate limit), ~60-90 minutes for 91 properties
- **Data Lag:** Real-time (tests live page at collection time)

#### **Data Integrity Checks**
1. **Score Bounds:** All scores must be 0-100
2. **Strategy Validation:** Must collect both "mobile" and "desktop" strategies
3. **Core Web Vitals Thresholds:**
   - LCP: Good (<2.5s), Needs Improvement (2.5-4.0s), Poor (>4.0s)
   - FID: Good (<100ms), Needs Improvement (100-300ms), Poor (>300ms)
   - CLS: Good (<0.1), Needs Improvement (0.1-0.25), Poor (>0.25)
4. **Missing Data Handling:** If PSI returns null, mark status="N/A" (never suppress)
5. **Timeout Handling:** If page load >30s, mark as "timeout" (not missing data)
6. **Duplicate Prevention:** UPSERT on property_id + metric_date + strategy
7. **Best-Effort Policy:** PSI failures never block other collectors or reports

#### **Database Tables**
- **Primary:** `pagespeed_metrics` (property + strategy + date level)

#### **Known Issues & Guardrails**
- **Sparse Data:** Some properties have intermittent PSI failures (network, server timeouts)
- **Field vs Lab Data:** Prefer Field data (real user metrics), fallback to Lab data (simulated)
- **Rate Limiting:** 2-second delay between requests to avoid API throttling
- **Guardrail:** If >50% of properties fail PSI collection, alert but DO NOT block reports

---

### 1.5 Google Ads

#### **Source Information**
- **API:** Google Ads API v14
- **Authentication:** OAuth 2.0 + Developer Token
- **Rate Limits:** 10,000 operations/day, 250 operations/second
- **Credentials:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml`
- **Customer ID:** 9089267423

#### **Data Points Collected**
| Metric | Type | Frequency | Retention | Description |
|--------|------|-----------|-----------|-------------|
| Campaign Spend | Currency (USD) | On-demand | 90 days | Total ad spend per campaign |
| Campaign Clicks | Integer | On-demand | 90 days | Total clicks per campaign |
| Campaign Conversions | Integer | On-demand | 90 days | Total conversions (may be unreliable) |
| Keyword Spend | Currency (USD) | On-demand | 90 days | Spend per keyword (cost_micros / 1,000,000) |
| Keyword Clicks | Integer | On-demand | 90 days | Clicks per keyword |
| Keyword Text | String | On-demand | 90 days | Actual keyword text (for floor plan classification) |
| Campaign Name | String | On-demand | 90 days | Campaign identifier (used for property matching) |

#### **Collection Schedule**
- **Frequency:** On-demand (PIB: weekly, Paid Media Workbook: weekly)
- **Scripts:**
  - `Portfolio_Monitoring/generate_pib_*.py` (Property Intelligence Briefs)
  - `paid_media_workbook/scripts/generate_paid_media_workbook.py`
- **Automation:** None (manual trigger)
- **Runtime:** ~30-60 seconds for property-level query
- **Data Window:** Configurable (typically 14 days for PIB, 30 days for workbook)

#### **Data Integrity Checks**
1. **Campaign Property Matching:** Campaign name must contain property name (lowercase, partial match)
2. **Spend Reconciliation:** Sum of keyword spend must equal campaign spend (±1% tolerance)
3. **Classification Completeness:** All keywords classified (Studio/1BR/2BR/Unclassified)
4. **Spend Non-Negative:** All spend values ≥ 0
5. **Conversion Reliability:** Conversions marked as "unreliable" if blank or zero (common issue)
6. **Date Range Validation:** Start date < End date, both within last 90 days
7. **Currency Consistency:** All spend in USD (micros converted to dollars)

#### **Floor Plan Classification Logic (Deterministic)**
```python
# Studio Keywords
Pattern: \bstudio\b|\beff\b|\befficiency\b (case-insensitive)

# 1BR Keywords
Pattern: \b1\s*b(ed)?r?(oom)?\b|\bone\s*bed(room)?\b (case-insensitive)

# 2BR Keywords
Pattern: \b2\s*b(ed)?r?(oom)?\b|\btwo\s*bed(room)?\b (case-insensitive)

# Unclassified (Generic)
- Brand: Contains property name
- Competitor: Matches known competitor list (camden, greystar, equity residential, etc.)
- Local Generic: Geographic term + apartment term (e.g., "orlando apartments")
- Other Generic: Fallback
```

#### **Database Tables**
- **None:** Google Ads data not stored in portfolio_analytics.db
- **Artifacts:** HTML/JSON/Excel artifacts stored in report directories

#### **Known Issues & Guardrails**
- **Property Matching Fragility:** Campaign names must contain property name (fuzzy matching)
- **Conversion Tracking Unreliable:** Many campaigns have zero conversions (tracking issues)
- **3BR+ Not Classified:** Currently only Studio/1BR/2BR classified (low volume)
- **Competitor List Maintenance:** Competitor list requires manual updates
- **Guardrail:** If classified spend <15%, mark as "Not Targeted" (not enough floor plan focus)

---

## 2. Aggregation & Rollup Layer

### 2.1 GA4 Daily Rollups

#### **Purpose**
Pre-aggregate GA4 raw event data into property-level daily summaries for fast querying by dashboards and reports.

#### **Processing Schedule**
- **Frequency:** Daily at 8:00 AM CT (after collection)
- **Script:** `Portfolio_Dashboard/scripts/update_ga4_rollups.py`
- **Automation:** launchd (`com.venterra.portfolio.rollups.plist`)
- **Runtime:** ~2-5 minutes for 91 properties

#### **Tables Generated**
1. **ga4_daily_rollup:**
   - Columns: property_id, metric_date, sessions, engaged_sessions, users, pageviews, bounce_rate, organic_sessions, direct_sessions, paid_sessions, social_sessions, referral_sessions, email_sessions, mobile_sessions, desktop_sessions, tablet_sessions
   - Aggregation: SUM of event-level metrics per property per day
   - Primary Key: property_id + metric_date

2. **cir_daily_rollup:**
   - Columns: property_id, metric_date, sessions, intent_events, cir (Conversion Intent Rate)
   - Calculation: `cir = intent_events / sessions` (NULL if sessions <50)
   - Primary Key: property_id + metric_date

3. **ga4_property_daily_summary:**
   - Columns: property_id, metric_date, total_sessions, total_users, avg_engagement_time, top_page, top_source
   - Purpose: Executive-level property summaries
   - Primary Key: property_id + metric_date

4. **portfolio_daily_summary:**
   - Columns: metric_date, total_sessions, total_users, avg_cir, properties_with_data
   - Purpose: Portfolio-wide aggregates
   - Primary Key: metric_date

#### **Data Integrity Checks**
1. **Incremental Processing:** Only process dates not yet in rollup tables
2. **Completeness Validation:** All properties in ga4_daily_metrics must appear in rollups
3. **Sum Validation:** Rollup totals must match source table totals (±0.1% tolerance)
4. **CIR Bounds:** CIR must be 0.0-1.0 (0-100%)
5. **Volume Gate:** CIR = NULL if sessions <50 (not suppressed, marked insufficient_volume)
6. **Date Alignment:** All rollup dates must match source dates exactly
7. **Staleness Check:** Alert if max(metric_date) in rollup < max(metric_date) in source -1 day

---

## 3. Insights Engine

### 3.1 Automated Insights Generation

#### **Purpose**
Detect anomalies, threshold violations, and missing data patterns across all 91 properties. Generate deterministic, actionable insights with complete context.

#### **Processing Schedule**
- **Frequency:** Daily at 8:10 AM CT (after rollups)
- **Script:** `Portfolio_Dashboard/scripts/generate_insights.py`
- **Automation:** launchd (`com.venterra.portfolio.insights.plist`)
- **Runtime:** ~5-10 minutes for 91 properties

#### **Insight Categories**

##### **Phase 1: Anomaly Detection**
| Insight Type | Detection Logic | Severity | Description |
|--------------|----------------|----------|-------------|
| **sessions_wow_decline** | Sessions declined ≥10% WoW | Warning | Week-over-week session decline |
| **sessions_wow_spike** | Sessions increased ≥20% WoW | Info | Week-over-week session spike |
| **clicks_wow_decline** | Organic clicks declined ≥10% WoW | Warning | Week-over-week organic traffic decline |
| **clicks_wow_spike** | Organic clicks increased ≥20% WoW | Info | Week-over-week organic traffic spike |

##### **Phase 2A: Threshold Violations**
| Insight Type | Threshold | Severity | Description |
|--------------|-----------|----------|-------------|
| **low_sessions** | Sessions <100/day (T7 avg) | Error | Critically low traffic volume |
| **low_clicks** | Organic clicks <10/day (T7 avg) | Error | Critically low organic visibility |
| **low_ctr** | CTR <1.0% (T7 avg) | Warning | Poor click-through rate |
| **poor_position** | Avg position >20.0 (T7 avg) | Warning | Poor search rankings |
| **missing_ga4_data** | Zero sessions for 2+ consecutive days | Critical | GA4 data collection failure |
| **missing_gsc_data** | Zero clicks AND zero impressions for 2+ consecutive days | Critical | GSC data collection failure or no search visibility |

##### **Phase 2B: Priority Scoring**
```python
# Priority Score Formula (0-120 scale)
base_score = {
    "Critical": 100,
    "Error": 80,
    "Warning": 50,
    "Info": 20
}

magnitude_boost = min(abs(delta_pct) / 10 * 10, 20)  # Up to +20 points
recency_decay = 0 if days_old == 0 else -5 * days_old  # -5 per day old

final_score = base_score + magnitude_boost + recency_decay
```

##### **Phase 3D: Context Enforcement**
Every insight MUST have `context_json` populated:
```json
{
  "ga4_metrics": {
    "sessions": {"current": 1234, "prior": 1500, "delta_pct": -17.7},
    "users": {"current": 980, "prior": 1200, "delta_pct": -18.3}
  },
  "gsc_metrics": {
    "clicks": {"current": 234, "prior": 280, "delta_pct": -16.4},
    "impressions": {"current": 12000, "prior": 11500, "delta_pct": 4.3}
  },
  "psi_data": {
    "mobile_performance": 62,
    "desktop_performance": 85,
    "status": "partial"
  },
  "freshness": {
    "ga4_lag_days": 1,
    "gsc_lag_days": 3,
    "psi_lag_days": 1,
    "status": "OK"
  },
  "cause_label": "visibility_decline"  // Derived label
}
```

**Cause Labels (Deterministic Derivation):**
- `visibility_decline`: Clicks/impressions declined but sessions stable → SEO issue
- `demand_decline`: Sessions declined but clicks stable → On-site issue
- `threshold_violation`: Absolute value below threshold (not delta)
- `partial_coverage`: Some metrics available, others N/A
- `missing_data`: Critical data missing (zero sessions/clicks)

#### **Database Tables**
- **Primary:** `insights` (property_id, insight_date, insight_type, severity, message, priority_score, confidence, context_json, surfaced_flag)

#### **Data Integrity Checks**
1. **Confidence Gate:** Insights with confidence <0.5 are NOT surfaced (suppressed = hidden)
2. **Context Completeness:** ALL insights must have context_json populated or marked "N/A"
3. **Freshness Gate:** Exit code 2 if data lag ≥5 days (prevents stale insights)
4. **Duplicate Prevention:** INSERT OR IGNORE on property_id + insight_date + insight_type
5. **Priority Bounds:** Priority score must be 0-120
6. **Severity Validation:** Severity must be one of: Critical, Error, Warning, Info
7. **Message Format:** Message must start with property name: "{property_name}: {insight_text}"

#### **Guardrails**
- **No Guessing:** If context data missing, mark status="N/A" (never infer)
- **Best-Effort PSI:** PSI failures never block insight generation
- **Deterministic Only:** All detection rules are objective measurements (no ML/heuristics)
- **Recompute Safety:** `--recompute` flag deletes and regenerates (idempotent)

---

## 4. Reporting & Consumption Layer

### 4.1 Portfolio Pulse (Daily Email Report)

#### **Purpose**
Daily email showing top 3 improving + top 3 declining properties for Sessions and one diagnostic metric (Organic Clicks or Search Position).

#### **Delivery Schedule**
- **Frequency:** Daily at 8:00 AM CT
- **Script:** `Portfolio_Monitoring/generate_daily_pulse.py`
- **Automation:** launchd (`com.venterra.portfolio.pulse.plist`)
- **Recipients:** Configured via environment variable (`REPORT_RECIPIENT_EMAIL`)
- **Archival:** All reports saved to OneDrive (`Portfolio_Pulse/`)

#### **Metrics Reported**
1. **Primary Metric:** Sessions (top 3 improving + top 3 declining)
2. **Diagnostic Metric (ONE per email):**
   - Organic Clicks OR Search Position (alternates daily)
3. **Portfolio Snapshot:**
   - Total sessions (WoW %)
   - Total clicks (WoW %)
   - Average CTR
   - Average search position
   - 14-day micro-sparklines per property

#### **Selection Logic (Tiered Movers)**
```python
# Tier 1: Major Movers (≥10% WoW change)
# Tier 2: Minor Movers (5-10% WoW change) - only if <3 Tier 1 available

# For each metric:
top_improving = sorted(properties, key=lambda p: p.delta_pct, reverse=True)[:3]
top_declining = sorted(properties, key=lambda p: p.delta_pct)[:3]

# Filter out "NEW" properties (zero prior week) from declining list
# Include "NEW" in improving list
```

#### **Key Insights Section (1-3 Deterministic Bullets)**
```python
# Generated Insights (Priority Order):
1. Portfolio-wide acceleration: "Sessions up X% across portfolio"
2. Concentration signal: "Top 5 properties drove Y% of portfolio growth"
3. Divergence signal: "Sessions up but organic down" (mixed signals)
4. Stability signal: "Portfolio stable week-over-week"
```

#### **Data Sources**
- GA4: `ga4_daily_metrics` (T7 Sessions)
- GSC: `gsc_daily_metrics` (T7 Clicks, Position)
- Lag: GA4 = 1 day, GSC = 3 days

#### **Data Integrity Checks**
1. **Completeness:** All 91 properties must have data or be excluded with reason
2. **WoW Calculation:** Current week (T-1 to T-7) vs Prior week (T-8 to T-14)
3. **NEW Flag Logic:** "NEW" appears only if prior week = 0 AND current week > 0
4. **Position Inversion:** Lower position = better (inverse metric handled correctly)
5. **Sparkline Validation:** All 14 days must have data or show gap
6. **Recipient Validation:** REPORT_RECIPIENT_EMAIL must be set
7. **Archive Integrity:** Every run must create timestamped HTML file in OneDrive

#### **Guardrails**
- **Top 3 Only:** Never show more than 3 improving + 3 declining (prevents information overload)
- **Tier Labels:** Minor movers (5-10%) visually distinguished with lighter colors
- **No Scores/Rankings:** No property rankings or performance scores (objective measurements only)
- **Safe to Forward:** Content suitable for executive audiences without additional context

---

### 4.2 Focus Report (Weekly Executive Dashboard)

#### **Purpose**
Weekly status board for 23 curated Focus properties showing 4-KPI strip, status badge (Red/Yellow/Green), and watch flags.

#### **Delivery Schedule**
- **Frequency:** Weekly (Monday 8:00 AM CT recommended, currently manual)
- **Script:** `focus_report/scripts/generate_focus_report.py` + `send_focus_report_email.py`
- **Automation:** Optional launchd (not currently scheduled)
- **Recipients:** Configured via environment variable (`REPORT_RECIPIENT_EMAIL`)
- **Archival:** All reports saved to `focus_report/reports/focus_report/YYYY-MM-DD/`

#### **Fixed 4-KPI Strip (Order Matters)**
1. **Sessions (WoW %)** - GA4, 1-day lag
2. **Organic Clicks (WoW %)** - GSC, 3-day lag
3. **CTR (WoW Δ)** - GSC, 3-day lag
4. **Avg Position (WoW Δ)** - GSC, 3-day lag

#### **Status Rules (Deterministic)**
| Status | Badge | Trigger Conditions |
|--------|-------|-------------------|
| 🔴 Red | Requires Attention | Sessions declined ≥15% WoW AND <100 absolute<br>OR Organic Clicks declined ≥20% WoW<br>OR CTR declined ≥1.0pp WoW AND clicks >50<br>OR Position worsened ≥3.0 positions WoW |
| 🟡 Yellow | Monitor | Sessions declined 10-14.9% WoW<br>OR Organic Clicks declined 10-19.9% WoW<br>OR CTR declined 0.5-0.99pp WoW<br>OR Position worsened 1.5-2.9 positions WoW<br>OR Mixed signals (one metric +15%, another -10%) |
| 🟢 Green | Performing Well | Default (no Red or Yellow triggers) |

#### **Insight Rules (One Per Property, Priority Order)**
1. **Acceleration:** Sessions OR Clicks +20% WoW → "Strong growth momentum this week"
2. **Divergence:** Sessions/Clicks moved opposite directions by ≥10% → "Traffic divergence: [description]"
3. **Concentration:** CTR +0.5pp OR Position improved 1.5+ → "Search visibility strengthening"
4. **Stable:** Default → "Steady performance, no significant changes"

#### **Watch Flags (Optional, Max 1 Per Property)**
1. **"CTR erosion"** → CTR declined ≥0.5pp WoW
2. **"Ranking slip with volume"** → Position worsened ≥1.5 AND impressions +10%
3. **"Demand softness"** → Sessions AND Clicks both declined ≥10% WoW

#### **Property Ordering**
1. Red properties first
2. Yellow properties second
3. Green properties last
4. Alphabetical within each tier

#### **Data Sources**
- GA4: `ga4_daily_metrics` (T7 Sessions, T-1 lag)
- GSC: `gsc_daily_metrics` (T7 Clicks, CTR, Position, T-3 lag)
- Focus List: `focus_report/config/focus_properties.yml` (23 properties)

#### **Data Integrity Checks**
1. **Focus List Validation:** All 23 properties must resolve to canonical registry names
2. **Data Completeness:** All 23 properties must have GA4 + GSC data or be flagged
3. **WoW Calculation:** Current week (T-1 to T-7) vs Prior week (T-8 to T-14) for GA4, T-3 to T-10 vs T-10 to T-17 for GSC
4. **Status Determinism:** Every property must have exactly ONE status badge
5. **Insight Determinism:** Every property must have exactly ONE insight line
6. **Watch Flag Limit:** Max 1 watch flag per property (priority order enforced)
7. **Archive Integrity:** Every run creates timestamped HTML + JSON in dated directory

#### **Guardrails**
- **Fixed 4-KPI Strip:** Never change KPI order or add/remove KPIs (contract locked)
- **Deterministic Rules Only:** No ML, no heuristics (all rules objective)
- **Executive Safe:** Content suitable for leadership without explanation
- **No Action Items:** Watch flags signal areas of interest, not prescriptive recommendations

---

### 4.3 Spotlight Properties Report (Weekly CSV Export)

#### **Purpose**
Weekly performance report for 20-25 curated properties with GA4, GTMetrix, PageSpeed, and SEMRush data exported to CSV for manual analysis.

#### **Delivery Schedule**
- **Frequency:** Weekly (Wednesday 12:00 PM CT)
- **Script:** `Spotlight_Properties_Report/run_weekly_automated.sh`
- **Automation:** Cron (`0 12 * * 3`)
- **Output:** CSV file to OneDrive (`Website_Analytics_Reports/`)
- **Archival:** Timestamped data files in `Spotlight_Properties_Report/data/`

#### **Workflow**
1. **Pre-flight Check:** Validate registry, credentials, config
2. **GA4 Collection:** Collect T7/T30 engaged sessions and organic traffic (~3 min)
3. **Verification Checkpoint:** Manual approval required (email notification sent)
4. **GTMetrix Collection:** Performance scores for all properties (~10-15 min)
5. **PageSpeed Collection:** Core Web Vitals for all properties (~8-12 min)
6. **Report Generation:** Combine data into CSV (~1 min)
7. **Email Notification:** Completion + executive summary sent

#### **Columns Exported**
1. property_name
2. property_url
3. date (Friday of current week)
4. t7_engaged_sessions_delta (%)
5. t7_organic_sessions_delta (%)
6. t30_engaged_sessions_delta (%)
7. t30_organic_sessions_delta (%)
8. t7_organic_visibility (SEMRush, optional)
9. t7_serp_traffic (SEMRush, optional)
10. website_notes (actionable insights)
11. seo_notes (SEMRush insights, optional)

#### **Data Sources**
- GA4: `data/weekly_ga4_data_TIMESTAMP.json` (not database)
- GTMetrix: `data/weekly_gtmetrix_data_TIMESTAMP.csv`
- PageSpeed: `data/weekly_psi_data_TIMESTAMP.json`
- SEMRush: `data/weekly_semrush_data_TIMESTAMP.json` (optional)
- Config: `config/weekly_spotlight_properties_YYYY-MM-DD.json`

#### **Data Integrity Checks**
1. **Property Registry Validation:** All properties must resolve to canonical names
2. **Date Range Verification:** GA4 date ranges must match manual reports exactly
3. **T7 Calculation:** Last 7 days ending yesterday vs prior 7 days
4. **T30 Calculation:** Last 30 days ending yesterday vs prior 30 days
5. **CSV Format:** No emojis, empty cells instead of zeros
6. **URL Validation:** All property URLs must be correct in master config
7. **Archive Integrity:** All timestamped data files preserved

#### **Verification Workflow**
```bash
# After GA4 collection, manual verification required:
python3 verify_ga4_data.py

# Shows worst T30 performer by % - user must verify and answer "yes"
# Approval creates .verification_approved_TIMESTAMP file
# Script checks for approval file every 5 minutes, timeout after 4 hours
```

#### **Guardrails**
- **Manual Approval Required:** Cannot proceed past GA4 collection without verification
- **No Database Dependency:** Uses timestamped JSON/CSV files (audit trail)
- **Empty Instead of Zero:** Better visual presentation in Excel
- **Actionable Insights Only:** website_notes provides marketing-focused recommendations (not just percentages)
- **Email Confirmation:** User receives email at each major step (verification, completion, summary)

---

### 4.4 Property Intelligence Brief (PIB) with Google Ads

#### **Purpose**
Executive-level HTML report for individual properties showing Google Ads floor plan targeting analysis + standard KPIs (sessions, organic traffic, PageSpeed, insights).

#### **Delivery Schedule**
- **Frequency:** On-demand (typically weekly for priority properties)
- **Script:** `Portfolio_Monitoring/generate_pib_[property_name].py` + `send_pib_email.py`
- **Automation:** None (manual trigger)
- **Delivery:** Email (HTML + JSON artifacts)
- **Archival:** `Portfolio_Monitoring/reports/pib_[property_name]/YYYY-MM-DD/`

#### **Sections Generated**
1. **Google Ads Floor Plan Targeting (Lead Section):**
   - Total spend (14 days)
   - Classified spend % (Studio/1BR/2BR)
   - Floor plan distribution (% of classified spend)
   - Alignment analysis vs current availability
   - Actionable insights

2. **Standard PIB KPIs:**
   - T7 Engaged Sessions (WoW %)
   - T7 Organic Search Traffic (WoW %)
   - Mobile PageSpeed Score (0-100)
   - Desktop PageSpeed Score (0-100)

3. **Top Insights:**
   - Priority insights from database (top 3)
   - Contextual recommendations

4. **Contrast Table (Optional):**
   - Compare property vs portfolio average or negative control

#### **Google Ads Classification (Deterministic)**
```python
# Floor Plan Keywords (Classified):
Studio: \bstudio\b|\beff\b|\befficiency\b
1BR: \b1\s*b(ed)?r?(oom)?\b|\bone\s*bed(room)?\b
2BR: \b2\s*b(ed)?r?(oom)?\b|\btwo\s*bed(room)?\b

# Generic Keywords (Unclassified):
Everything else (brand, competitor, local generic, other generic)
```

#### **Alignment Logic**
| Alignment Status | Criteria | Color |
|-----------------|----------|-------|
| **Aligned** | Classified spend ≥15% AND max delta ≤10% | Green ✅ |
| **Watch** | Classified spend ≥15% AND max delta 10-20% | Yellow ⚠️ |
| **Mismatch** | Classified spend ≥15% AND max delta >20% | Red 🔴 |
| **Not Targeted** | Classified spend <15% | Gray - |

**Delta Calculation:**
```python
# For each floor plan (Studio, 1BR, 2BR):
delta = abs(floor_plan_spend_pct - floor_plan_availability_pct)

# Take max delta across all three floor plans
alignment_status = determine_from_max_delta(max_delta)
```

#### **Data Sources**
- Google Ads API: Keywords, spend, clicks (14-day window)
- Availability Feed: `https://online.venterraliving.com/encasa-external/ThirtyLines` (real-time)
- Database: `portfolio_analytics.db` (GA4, GSC, PSI, insights)

#### **Data Integrity Checks**
1. **Campaign Matching:** Campaign name must contain property name (lowercase, partial match)
2. **Spend Reconciliation:** Keyword spend must sum to campaign spend (±1% tolerance)
3. **Classification Completeness:** All keywords classified (no NULL categories)
4. **Availability Freshness:** Availability data must be <1 hour old
5. **Alignment Calculation:** Max delta must be computed across all three floor plans (not just 1BR/2BR)
6. **Artifact Generation:** HTML + JSON must both be created and archived
7. **Email Delivery:** HTML email must be sent (currently via Gmail due to Office 365 SMTP disabled at tenant level)

#### **Guardrails**
- **15% Classified Threshold:** Properties with <15% classified spend marked "Not Targeted" (insufficient floor plan focus)
- **3BR+ Excluded:** Currently only Studio/1BR/2BR classified (low volume, not enough data)
- **Conversion Tracking Unreliable:** Conversions left blank (Google Ads tracking issues common)
- **Availability Dependency:** If availability data unavailable, show "Data Unavailable" (not "0%")
- **Email Routing:** Temporarily via Gmail (smtp.gmail.com) until Office 365 SMTP re-enabled at tenant level

---

### 4.5 Paid Media Performance Workbook (Excel, v1.2)

#### **Purpose**
Dual-worksheet Excel system providing property-level Google Ads visibility for community managers (Overview) and granular spend transparency for marketing operations (Breakdown).

#### **Delivery Schedule**
- **Frequency:** On-demand (typically weekly or monthly)
- **Script:** `paid_media_workbook/scripts/generate_paid_media_workbook.py`
- **Automation:** None (manual trigger)
- **Output:** Excel (.xlsx) to `paid_media_workbook/outputs/`
- **Runtime:** ~30-60 seconds for 91 properties, 6,156 keyword rows

#### **Worksheet 1: Paid_Media_Overview (Community Managers)**
**Rows:** 92 (91 properties + header)  
**Columns:** 22

| Column Group | Columns | Description |
|--------------|---------|-------------|
| **Property Context** | Property Name, Market, Region | Property identification |
| **Spend Overview** | Total Ad Spend ($), Classified Spend ($), Classified Spend (%), Generic Spend ($), Generic Spend (%) | 30-day spend breakdown |
| **Targeting Distribution** | Floor Plans Targeted, % Spend on Studio, % Spend on 1BR, % Spend on 2BR | Floor plan targeting allocation |
| **Performance** | Clicks, CPC ($), Conversions, Cost per Conversion ($) | Campaign performance metrics |
| **Inventory Context** | Occupancy (%), Units Available, % 1BR Available, % 2BR Available | Current availability from feed |
| **Alignment Signal** | Targeting Status | Aligned / Partially Aligned / Not Targeted |
| **Data Quality** | Market/Region Source | Registry / Placeholder / Mapping Table |

#### **Worksheet 2: Spend_Breakdown (Marketing Operations)**
**Rows:** 209 (property × subtype combinations + header)  
**Columns:** 7

| Column | Description |
|--------|-------------|
| Property Name | Property identifier |
| Category | Classified / Unclassified |
| Subtype | Studio/1BR/2BR (classified) or Brand/Competitor/Local Generic/Other Generic (unclassified) |
| Spend ($) | Dollar spend for this subtype |
| Spend (%) | % of property's total spend |
| Spend Rank | 1-5 (highest to lowest within property) |
| Description | Human-readable explanation |

#### **Subtype Classification (Priority-Based)**
```python
# Classified Subtypes (Floor Plans):
Studio: \bstudio\b|\beff\b|\befficiency\b
1BR: \b1\s*b(ed)?r?(oom)?\b|\bone\s*bed(room)?\b
2BR: \b2\s*b(ed)?r?(oom)?\b|\btwo\s*bed(room)?\b

# Unclassified Subtypes (Priority Order):
1. Brand: Contains property name (e.g., "avasa hammock landing apartments")
2. Competitor: Matches known competitor list (camden, greystar, equity residential)
3. Local Generic: Geographic term + apartment term (e.g., "orlando apartments", "tampa fl rentals")
4. Other Generic: Fallback (e.g., "pet friendly apartments", "luxury apartments")
```

#### **Alignment Logic (Same as PIB)**
| Alignment Status | Criteria |
|-----------------|----------|
| **Not Targeted** | Classified Spend <15% |
| **Aligned** | Classified Spend ≥15% AND max floor plan delta ≤15% |
| **Partially Aligned** | Classified Spend ≥15% AND max floor plan delta >15% |

#### **Data Sources**
- Google Ads API: Keywords, spend, clicks, conversions (30-day window)
- Availability Feed: `https://online.venterraliving.com/encasa-external/ThirtyLines` (real-time)
- Property Registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

#### **Data Integrity Checks**
1. **Spend Reconciliation:** Classified + Generic = Total for every property
2. **Subtype Spend Sum:** Sum of all subtype spend must equal total spend (±0.1% tolerance)
3. **Availability Matching:** Property name-based matching (case-insensitive partial match)
4. **Occupancy Bounds:** Occupancy % must be 0-100%
5. **Spend Rank Validation:** Each property must have ranks 1-5 (or fewer if <5 subtypes with spend)
6. **Formatting Validation:** Currency ($#,##0.00), Percentages (0.0%), Header rows frozen
7. **Market/Region Placeholder:** All 91 properties show "TBD (Coming Soon)" until registry mapping available

#### **Guardrails**
- **Dual-Worksheet Design:** Community managers see Overview only (prevents information overload)
- **No Cross-Property Ranking:** Spend Rank is within-property only (not portfolio-wide)
- **Placeholder Strategy:** Market/Region placeholders clearly labeled as "TBD" (executive-safe)
- **Deterministic Classification:** No ML/heuristics (transparent, auditable)
- **15% Classified Threshold:** Same as PIB (consistency across reports)

---

## 5. Canonical Database

### 5.1 Database Architecture

#### **Database File**
- **Location:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Type:** SQLite 3.x
- **Size:** ~500MB (grows with historical data)
- **Environment Variable:** `PORTFOLIO_ANALYTICS_DB_PATH`

#### **Access Pattern**
```python
# Standard access via helper module:
from src.db.db_helper import connect_db
conn = connect_db()  # Reads environment variable or uses default path
```

#### **Tables (15+ Total)**

##### **Collection Tables (Raw Data)**
1. **ga4_daily_metrics:**
   - Primary Key: property_id + metric_date
   - Columns: sessions, engaged_sessions, users, pageviews, bounce_rate
   - Retention: 14 days rolling
   - Written by: `collect_daily_data.py` (daily 5:00 AM)

2. **ga4_traffic_sources:**
   - Primary Key: property_id + metric_date + channel_group
   - Columns: sessions, engaged_sessions by channel
   - Channels: Organic Search, Direct, Paid Search, Social, Referral, Email, Other
   - Retention: 14 days rolling
   - **CRITICAL:** Without this data, organic columns in reports are empty

3. **ga4_event_facts:**
   - Primary Key: event_id (auto-increment)
   - Columns: property_id, event_date, event_name, event_count, user_count
   - Retention: 14 days rolling
   - Purpose: Event-level detail for CIR calculations

4. **gsc_daily_metrics:**
   - Primary Key: property_id + metric_date
   - Columns: clicks, impressions, ctr, average_position
   - Retention: 14 days rolling
   - Data Lag: Always T-3

5. **pagespeed_metrics:**
   - Primary Key: property_id + metric_date + strategy (mobile/desktop)
   - Columns: performance_score, seo_score, accessibility_score, best_practices_score, lcp, fid, cls, fcp, ttfb
   - Retention: 90 days
   - Best-effort (sparse data OK)

6. **semrush_domain_metrics:**
   - Primary Key: property_id + metric_date
   - Columns: total_keywords, organic_traffic_estimate, top_keyword, avg_position
   - Retention: 90 days
   - Collection: Weekly (optional)

7. **keyword_rankings:**
   - Primary Key: property_id + metric_date + keyword
   - Columns: position, search_volume, cpc, traffic_pct, keyword_type (brand/generic)
   - Retention: 90 days
   - Collection: Weekly (optional)

##### **Rollup Tables (Aggregated Data)**
8. **ga4_daily_rollup:**
   - Primary Key: property_id + metric_date
   - Columns: sessions, engaged_sessions, users, pageviews, bounce_rate, organic_sessions, direct_sessions, paid_sessions, mobile_sessions, desktop_sessions
   - Purpose: Fast query aggregates for dashboards
   - Updated by: `update_ga4_rollups.py` (daily 8:00 AM)

9. **cir_daily_rollup:**
   - Primary Key: property_id + metric_date
   - Columns: sessions, intent_events, cir (Conversion Intent Rate)
   - Purpose: CIR calculations with volume gate
   - Formula: `cir = intent_events / sessions` (NULL if sessions <50)

10. **ga4_property_daily_summary:**
    - Primary Key: property_id + metric_date
    - Columns: total_sessions, total_users, avg_engagement_time, top_page, top_source
    - Purpose: Executive-level property summaries

11. **portfolio_daily_summary:**
    - Primary Key: metric_date
    - Columns: total_sessions, total_users, avg_cir, properties_with_data
    - Purpose: Portfolio-wide aggregates

##### **Insights & Analysis Tables**
12. **insights:**
    - Primary Key: property_id + insight_date + insight_type
    - Columns: severity, message, priority_score, confidence, context_json, surfaced_flag, created_at
    - Purpose: Automated insights storage
    - Retention: 90 days
    - Generated by: `generate_insights.py` (daily 8:10 AM)

13. **insight_actions:**
    - Primary Key: action_id (auto-increment)
    - Columns: insight_id, action_taken, action_date, notes
    - Purpose: Track actions taken on insights (future)

14. **property_metadata:**
    - Primary Key: property_id
    - Columns: name, canonical_name, url, ga4_property_id, gsc_property_url, site_type, intent_events_json, manager, region, market
    - Purpose: Property registry cache (mirrors JSON file)

15. **data_quality_log:**
    - Primary Key: log_id (auto-increment)
    - Columns: check_date, check_type, property_id, status, details
    - Purpose: Data integrity audit trail

### 5.2 Data Integrity Checks (Database-Level)

#### **Daily Integrity Checks**
1. **Completeness Check:**
   ```sql
   -- All 91 properties must have data for yesterday
   SELECT COUNT(DISTINCT property_id) FROM ga4_daily_metrics WHERE metric_date = DATE('now', '-1 day');
   -- Expected: 91
   ```

2. **Freshness Check:**
   ```sql
   -- Max date in database must be yesterday (or today for real-time sources)
   SELECT MAX(metric_date) FROM ga4_daily_metrics;
   -- Expected: yesterday's date
   ```

3. **Rollup Alignment Check:**
   ```sql
   -- Rollup totals must match source totals
   SELECT SUM(sessions) FROM ga4_daily_metrics WHERE metric_date = '2026-01-22';
   SELECT SUM(sessions) FROM ga4_daily_rollup WHERE metric_date = '2026-01-22';
   -- Difference must be <0.1%
   ```

4. **Traffic Source Sum Check:**
   ```sql
   -- Sum of all channel sessions must equal total sessions
   SELECT property_id, metric_date, SUM(sessions) as channel_sum
   FROM ga4_traffic_sources
   GROUP BY property_id, metric_date;
   
   SELECT property_id, metric_date, sessions as total
   FROM ga4_daily_metrics;
   
   -- channel_sum must equal total (±1% tolerance)
   ```

5. **Duplicate Detection:**
   ```sql
   -- No duplicate property + date combinations
   SELECT property_id, metric_date, COUNT(*)
   FROM ga4_daily_metrics
   GROUP BY property_id, metric_date
   HAVING COUNT(*) > 1;
   -- Expected: 0 rows
   ```

6. **Staleness Detection:**
   ```sql
   -- Alert if data lag exceeds threshold
   SELECT julianday('now') - julianday(MAX(metric_date)) as lag_days
   FROM ga4_daily_metrics;
   -- Warning if ≥2 days, Critical if ≥5 days
   ```

#### **Weekly Integrity Checks**
1. **Historical Consistency:**
   - Verify 14-day rolling window maintained
   - Check for gaps in date sequences
   - Validate no future dates in database

2. **Cross-Table Consistency:**
   - All property_ids in rollup tables must exist in source tables
   - All property_ids in insights table must exist in ga4_daily_metrics

3. **Value Bounds:**
   - All percentages: 0-100
   - All scores: 0-100
   - All counts: ≥0
   - Occupancy: 0-100%
   - CIR: 0.0-1.0

---

## 6. Property Registry (Single Source of Truth)

### 6.1 Registry Structure

#### **Location**
`/Users/mark/Property_Analytics/config/venterra_properties_official.json`

#### **Purpose**
Centralized metadata for all 91 properties. All collectors, rollups, and reports load property data from this registry (zero hardcoding).

#### **Schema**
```json
{
  "name": "Avasa Hammock Landing",
  "canonical_name": "avasa_hammock_landing",
  "ga4_property_id": "445473253",
  "gsc_property_url": "sc-domain:avasahammocklanding.com",
  "url": "https://www.avasahammocklanding.com",
  "site_type": "default",
  "intent_events": ["apply_cta_clicked", "contact_form_submitted", ...],
  "manager": "Jane Doe",
  "region": "Southeast",
  "market": "Orlando, FL",
  "aliases": ["Avasa at Hammock Landing", "Hammock Landing"]
}
```

#### **Key Fields**
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| name | String | Yes | Display name (used in reports) |
| canonical_name | String | Yes | Normalized ID (used in database) |
| ga4_property_id | String | Yes | GA4 property identifier |
| gsc_property_url | String | Yes | GSC property URL |
| url | String | Yes | Property website URL |
| site_type | String | Yes | "default" or "resi" (drives intent event override) |
| intent_events | Array | Yes | List of GA4 event names considered "conversion intent" |
| manager | String | No | Property manager name |
| region | String | No | Geographic region (e.g., "Southeast") |
| market | String | No | City, State (e.g., "Orlando, FL") |
| aliases | Array | No | Alternative names for fuzzy matching |

### 6.2 Registry Usage

#### **Loading Pattern**
```python
from src.utils.property_registry import PropertyRegistry

registry = PropertyRegistry()
property = registry.get_property_by_name("Avasa Hammock Landing")

# Access fields:
ga4_id = property["ga4_property_id"]
canonical_name = property["canonical_name"]
intent_events = property["intent_events"]
```

#### **Intent Event Overrides**
```python
# Default properties (site_type="default"): 10 intent events
default_intent_events = [
    "apply_cta_clicked",
    "contact_form_submitted",
    "phone_call_clicked",
    "email_clicked",
    "schedule_tour_clicked",
    "check_availability_clicked",
    "floor_plan_details_viewed",
    "brochure_download",
    "resident_portal_link_clicked",
    "pay_online_clicked"
]

# Resi properties (site_type="resi"): 14 intent events (additional 4)
resi_additional_events = [
    "resi_price_quote",
    "resi_directions",
    "resi_pdf_download",
    "resi_3d_tour"
]
```

**Rationale:** Resi platform has different conversion funnel (price quotes, directions more prominent). Results in 3-7x CIR increase (accurate, not inflated).

### 6.3 Registry Integrity Checks

1. **Uniqueness:**
   - All ga4_property_ids must be unique
   - All canonical_names must be unique
   - All gsc_property_urls must be unique

2. **Required Fields:**
   - name, canonical_name, ga4_property_id, gsc_property_url, url, site_type, intent_events all required

3. **Site Type Validation:**
   - site_type must be "default" or "resi"

4. **Intent Events Validation:**
   - Must be non-empty array
   - All event names must be valid GA4 event names (alphanumeric + underscores)

5. **URL Validation:**
   - Must be valid HTTPS URL
   - Must resolve (200 OK response)

6. **GA4 Property ID Format:**
   - Must be numeric string (9 digits)

---

## 7. Guardrails & Safety Mechanisms

### 7.1 Data Collection Guardrails

1. **Rate Limiting:**
   - GA4: 10 requests/second max
   - GSC: 200 requests/minute max
   - PageSpeed: 2-second delay between requests
   - Google Ads: 250 operations/second max
   - SEMRush: Exponential backoff on 429 errors

2. **Failure Handling:**
   - Individual property failures logged but DO NOT block collection
   - If ≥10 properties fail, collection exits with code 2 (alert)
   - Best-effort policy: Collect as much as possible, flag missing data

3. **Timeout Handling:**
   - API timeouts: 30 seconds per request
   - Total collection timeout: 2 hours (exit if exceeded)

4. **Duplicate Prevention:**
   - All writes use UPSERT (INSERT OR REPLACE) on primary key
   - Idempotent: Safe to re-run collection for same date

### 7.2 Aggregation Guardrails

1. **Staleness Gate:**
   - Exit with code 2 if source data lag ≥5 days (prevents stale aggregations)

2. **Incremental Processing:**
   - Only process dates not yet in rollup tables (efficiency)

3. **Completeness Validation:**
   - All properties in source tables must appear in rollup tables
   - Alert if discrepancy detected

4. **Sum Validation:**
   - Rollup totals must match source totals (±0.1% tolerance)
   - If validation fails, log error and do NOT overwrite existing rollup

### 7.3 Insights Guardrails

1. **Confidence Threshold:**
   - Insights with confidence <0.5 are suppressed (not surfaced)

2. **Context Requirement:**
   - ALL surfaced insights must have context_json populated or marked "N/A"
   - If context cannot be computed, insight is NOT generated

3. **Freshness Gate:**
   - Exit with code 2 if data lag ≥5 days (prevents stale insights)

4. **Priority Bounds:**
   - Priority score clamped to 0-120 (cannot exceed bounds)

5. **No Guessing:**
   - If data missing, mark as "N/A" (never infer or estimate)

### 7.4 Report Guardrails

1. **Read-Only Consumption:**
   - ALL reports are read-only consumers (no writes during report generation)

2. **Recipient Validation:**
   - Email reports require REPORT_RECIPIENT_EMAIL environment variable set
   - Fail fast if not configured

3. **Archive Integrity:**
   - Every report run creates timestamped archive file
   - Archives never overwritten (audit trail)

4. **Safe to Forward:**
   - All email reports suitable for executive audiences (no technical jargon)

5. **No Prescriptive Actions:**
   - Reports provide insights, not recommendations (advisory only)

### 7.5 Database Guardrails

1. **Single Database:**
   - ALL components write to canonical database (no fragmentation)

2. **No Cascade Deletes:**
   - Deletes must be explicit (prevent accidental data loss)

3. **Transaction Safety:**
   - All multi-row writes use transactions (all-or-nothing)

4. **Backup Policy:**
   - Database backed up before any schema changes

5. **Lock Handling:**
   - Retry on SQLITE_BUSY (5 attempts with exponential backoff)

---

## 8. Operational Procedures

### 8.1 Daily Monitoring

#### **Health Checks (Every Morning)**
```bash
# 1. Check data freshness
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date) FROM ga4_daily_metrics"
# Expected: Yesterday's date

# 2. Check collection logs
tail -50 /Users/mark/Property_Analytics/logs/collection_*.log

# 3. Check Portfolio Pulse delivery
ls -lt ~/OneDrive*/Portfolio_Pulse/ | head -5

# 4. Verify launchd jobs running
launchctl list | grep venterra
```

### 8.2 Troubleshooting

#### **Issue: Data not collected**
```bash
# Manual run collection script
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 collect_daily_data.py

# Check for API errors in output
```

#### **Issue: Reports missing data**
```bash
# Verify database has recent data
sqlite3 portfolio_analytics.db "SELECT COUNT(*) FROM ga4_daily_metrics WHERE metric_date = DATE('now', '-1 day')"

# Check rollups exist
sqlite3 portfolio_analytics.db "SELECT COUNT(*) FROM ga4_daily_rollup WHERE metric_date = DATE('now', '-1 day')"

# Run backfill if needed
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 backfill_traffic_sources.py
```

#### **Issue: Insights not generating**
```bash
# Check data lag
sqlite3 portfolio_analytics.db "SELECT julianday('now') - julianday(MAX(metric_date)) FROM ga4_daily_metrics"

# If lag ≥5 days, collection failed - run manually first

# Generate insights manually
cd /Users/mark/Property_Analytics/Portfolio_Dashboard/scripts
python3 generate_insights.py --recompute
```

### 8.3 Maintenance

#### **Weekly Maintenance**
1. Check launchd logs for errors
2. Verify email delivery for all reports
3. Review database size (alert if >1GB)
4. Check API rate limits consumption

#### **Monthly Maintenance**
1. Review insights effectiveness (are they actionable?)
2. Update competitor list for Google Ads classification
3. Review property registry for accuracy (new properties, name changes)
4. Archive old logs (>90 days)

---

**End of Capabilities Inventory**

This document provides the complete technical specification for presentation to architecture review. All capabilities, data sources, integrity checks, insights, and guardrails are explicitly documented.
