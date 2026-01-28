# Portfolio Analytics Database Schema Reference

**Last Updated:** 2026-01-27  
**Database:** `data/portfolio_analytics.db` (SQLite)

---

## Critical: Property ID Normalization

### THE MASTER KEY: GA4 Property ID
**All analytics queries MUST use GA4 Property ID as the canonical identifier.**

```
GA4 Property ID = Numeric string (e.g., "424416990", "441503068")
```

### ID Mapping Across Data Sources

| Data Source | Primary Key Column | Contains | Join To Other Tables |
|-------------|-------------------|----------|---------------------|
| **properties** | `property_id` | GA4 Property ID | Direct match to all other tables |
| **ga4_daily_metrics** | `property_id` | GA4 Property ID | ✓ Direct match |
| **pagespeed_metrics** | `property_id` | GA4 Property ID | ✓ Direct match |
| **gsc_daily_metrics** | `property_id` | **URL** (NOT GA4 ID!) | ⚠️ Use `ga4_property_id` column |
| **gsc_device_metrics** | `property_id` | **URL** (NOT GA4 ID!) | ⚠️ Use `ga4_property_id` column |
| **gsc_queries** | `property_id` | **URL** (NOT GA4 ID!) | ⚠️ Use `ga4_property_id` column |
| **gbp_daily_metrics** | `property_id` | GA4 Property ID | ✓ Direct match |
| **gbp_daily_insights** | `property_id` | GA4 Property ID | ✓ Direct match |
| **gbp_reviews** | `property_id` | GA4 Property ID | ✓ Direct match |

### GSC JOIN PATTERN (CRITICAL!)

**WRONG:**
```sql
SELECT * FROM gsc_daily_metrics 
WHERE property_id = '424416990'  -- This will FAIL!
```

**CORRECT:**
```sql
SELECT * FROM gsc_daily_metrics 
WHERE ga4_property_id = '424416990'  -- Use ga4_property_id column!
```

**GSC property_id contains URLs:**
- `https://thedeltapearland.com/`
- `sc-domain:cendanalife.com`
- `https://venterraliving.com/apartments/property-name/`

---

## Core Tables & Schemas

### 1. GA4 Daily Metrics
**Table:** `ga4_daily_metrics`  
**Primary Key:** `(property_id, metric_date)`  
**Date Column:** `metric_date` (DATE format: 'YYYY-MM-DD')

#### Key Columns:
```sql
property_id TEXT           -- GA4 Property ID (canonical)
metric_date DATE           -- Date of metrics
sessions INTEGER           -- Total sessions
engaged_sessions INTEGER   -- Engaged sessions
total_users INTEGER        -- Total users
new_users INTEGER
engagement_rate REAL       -- Often NULL, calculate: (engaged_sessions/sessions)*100
conversions INTEGER        -- Total conversions
conversion_rate REAL
avg_session_duration REAL  -- In seconds
pageviews INTEGER
```

#### Calculated Fields (Not in DB):
```python
engagement_rate = (engaged_sessions / sessions) * 100  # if NULL
cir_per_100_sessions = (conversions / sessions) * 100
cir_per_100_engaged = (conversions / engaged_sessions) * 100
```

#### ⚠️ CRITICAL: GA4 Conversions Column Issue
**The `conversions` column in `ga4_daily_metrics` is ALWAYS 0 (not tracked/configured).**

**DO NOT USE:**
```sql
SELECT conversions FROM ga4_daily_metrics  -- Always returns 0!
```

**CORRECT APPROACH - Use ga4_event_facts:**
Calculate conversions from event tracking in `ga4_event_facts` table using specific event names.

---

### GA4 Event Facts (For Conversion Tracking)
**Table:** `ga4_event_facts`  
**Purpose:** Individual event tracking - USE THIS for conversion calculations  
**Primary Key:** `(property_id, event_date, event_name, event_timestamp)`

#### Schema:
```sql
id INTEGER PRIMARY KEY
property_id TEXT          -- GA4 Property ID
event_date DATE           -- Date of event
event_name TEXT           -- Event name (see conversion events below)
event_timestamp BIGINT    -- Unix timestamp (microseconds)
user_pseudo_id TEXT
session_id TEXT
page_location TEXT
page_title TEXT
```

#### Conversion Event Mapping (CRITICAL!)

**Resi Properties** (Camber Ridge, Delta Pearland, Cendana District West, Monteverde):
```python
RESI_CONVERSION_EVENTS = [
    'resi_price_quote',          # Price quote request
    'resi_application_start',    # Application started
    'resi_apt_tour_click'        # Tour scheduled
]
```

**Portfolio Properties** (All others):
```python
PORTFOLIO_CONVERSION_EVENTS = [
    'pricequote_click',      # Price quote clicked
    'applyonline_click',     # Apply online clicked  
    'scheduletour_click'     # Schedule tour clicked
]
```

**DO NOT use `form_submit` for Portfolio CIR calculations** - it captures all form submissions, not just conversion actions.

#### Resi Property Identification:
```python
RESI_DOMAINS = [
    'cendanalife.com',
    'camberridgeapartments.com', 
    'thedeltapearland.com',
    'monteverdesatx.com'
]

RESI_PROPERTY_IDS = [
    '445473253',  # Camber Ridge
    '441503068',  # The Delta Pearland
    '424416990',  # Cendana District West
    '488649687'   # Monteverde (pre-opening, exclude from comparisons)
]
```

#### CIR Calculation Pattern:
```python
# Determine property type
is_resi = property_id in RESI_PROPERTY_IDS

# Select appropriate events
if is_resi:
    events = "('resi_price_quote', 'resi_application_start', 'resi_apt_tour_click')"
else:
    events = "('pricequote_click', 'applyonline_click', 'scheduletour_click')"

# Count conversions
cursor.execute(f'''
    SELECT COUNT(*) 
    FROM ga4_event_facts 
    WHERE property_id = ? 
      AND event_name IN {events}
      AND event_date >= date('now', '-15 days')
''', (property_id,))

conversions = cursor.fetchone()[0]

# Calculate CIR
cir_percentage = (conversions / sessions) * 100
```

---

### 2. Google Search Console
**Tables:** `gsc_daily_metrics`, `gsc_device_metrics`, `gsc_queries`  
**Date Column:** `metric_date` (DATE)  
**⚠️ CRITICAL:** Uses `ga4_property_id` for joins, NOT `property_id`!

#### gsc_daily_metrics Schema:
```sql
id INTEGER PRIMARY KEY
property_id TEXT           -- ⚠️ Contains URL, not GA4 ID!
ga4_property_id TEXT       -- ✓ Use this for joins!
metric_date DATE
clicks INTEGER
impressions INTEGER
ctr REAL                   -- Click-through rate
average_position REAL      -- Avg search position
gsc_site_url TEXT         -- Full GSC property URL
```

#### GSC Lag Handling:
- GSC data has a **3-day API delay**
- When querying last 30 days, exclude last 3 days:
```sql
WHERE metric_date >= date('now', '-30 days')
  AND metric_date <= date('now', '-3 days')
```
- Expected records: 27 days (not 30)

---

### 3. PageSpeed Insights (PSI)
**Table:** `pagespeed_metrics`  
**Primary Key:** `(property_id, metric_date, strategy)`  
**Date Column:** `metric_date` (DATE)

#### Key Columns:
```sql
property_id TEXT           -- GA4 Property ID
metric_date DATE
strategy TEXT              -- 'mobile' or 'desktop'
performance_score INTEGER  -- 0-100
accessibility_score INTEGER
best_practices_score INTEGER
seo_score INTEGER
pwa_score INTEGER
lcp_value REAL             -- Largest Contentful Paint (seconds)
lcp_score REAL             -- 0-1 normalized score
cls_value REAL             -- Cumulative Layout Shift
cls_score REAL
fid_value REAL             -- First Input Delay (ms)
fcp_value REAL             -- First Contentful Paint (seconds)
ttfb_value REAL            -- Time to First Byte (ms)
```

#### Common Query Pattern:
```sql
-- Get mobile performance only
SELECT * FROM pagespeed_metrics
WHERE property_id = '424416990'
  AND strategy = 'mobile'
  AND metric_date >= date('now', '-30 days')
```

---

### 4. Google Business Profile (GBP)
**Tables:** `gbp_daily_metrics`, `gbp_daily_insights`, `gbp_reviews`  
**Date Column:** `metric_date` (DATE)  
**Property ID:** Uses GA4 Property ID directly

#### gbp_daily_metrics Schema:
```sql
property_id TEXT           -- GA4 Property ID
gbp_location_id TEXT       -- GBP-specific location ID
metric_date DATE
business_impressions_desktop_maps INTEGER
business_impressions_mobile_maps INTEGER
call_clicks INTEGER
website_clicks INTEGER
business_direction_requests INTEGER
```

#### gbp_daily_insights Schema:
```sql
property_id TEXT           -- GA4 Property ID
gbp_location_id TEXT
metric_date DATE
total_profile_views INTEGER
total_actions INTEGER
action_rate REAL
website_clicks INTEGER
phone_calls INTEGER
direction_requests INTEGER
queries_direct INTEGER
queries_indirect INTEGER
```

#### gbp_reviews_summary Schema:
```sql
property_id TEXT
metric_date DATE
total_review_count INTEGER
average_rating REAL        -- 0.0 to 5.0
new_reviews_count INTEGER
```

---

### 5. GTMetrix
**Table:** `gtmetrix_metrics`  
**Status:** ⚠️ **NOT ACTIVELY COLLECTED** - Table exists but contains no data

**DO NOT USE GTMetrix in queries - it will always return empty results.**

---

## Property Registry

### Official Property List
**File:** `config/venterra_properties_official.json`  
**Structure:** Array of property objects

```json
{
  "properties": [
    {
      "name": "Cendana District West",
      "ga4_property_id": "424416990",
      "unit_count": 349,
      "full_url": "https://cendanalife.com/",
      "search_domain": "cendanalife.com"
    }
  ]
}
```

### Property Metadata Table
**Table:** `property_metadata`  
```sql
property_id TEXT PRIMARY KEY  -- GA4 Property ID
property_name TEXT
unit_count INTEGER
```

---

## Common Query Patterns

### 1. Multi-Source Property Analysis
```sql
-- Get all metrics for a property (last 30 days)
WITH ga4 AS (
  SELECT 
    property_id,
    SUM(sessions) as total_sessions,
    SUM(engaged_sessions) as total_engaged,
    SUM(conversions) as total_conversions
  FROM ga4_daily_metrics
  WHERE property_id = ?
    AND metric_date >= date('now', '-30 days')
),
gsc AS (
  SELECT 
    ga4_property_id as property_id,
    SUM(clicks) as total_clicks,
    SUM(impressions) as total_impressions,
    AVG(average_position) as avg_position
  FROM gsc_daily_metrics
  WHERE ga4_property_id = ?  -- Note: ga4_property_id!
    AND metric_date >= date('now', '-30 days')
    AND metric_date <= date('now', '-3 days')
),
psi AS (
  SELECT 
    property_id,
    AVG(performance_score) as avg_performance,
    AVG(lcp_value) as avg_lcp,
    AVG(cls_value) as avg_cls
  FROM pagespeed_metrics
  WHERE property_id = ?
    AND strategy = 'mobile'
    AND metric_date >= date('now', '-30 days')
)
SELECT * FROM ga4
LEFT JOIN gsc USING(property_id)
LEFT JOIN psi USING(property_id)
```

### 2. Data Completeness Check
```sql
-- Check how many days of data exist for each source
SELECT 
  'GA4' as source,
  COUNT(DISTINCT metric_date) as days_with_data
FROM ga4_daily_metrics
WHERE property_id = ?
  AND metric_date >= date('now', '-30 days')

UNION ALL

SELECT 
  'GSC' as source,
  COUNT(DISTINCT metric_date) as days_with_data
FROM gsc_daily_metrics
WHERE ga4_property_id = ?  -- Note: ga4_property_id!
  AND metric_date >= date('now', '-30 days')
  AND metric_date <= date('now', '-3 days')

UNION ALL

SELECT 
  'PSI' as source,
  COUNT(DISTINCT metric_date) as days_with_data
FROM pagespeed_metrics
WHERE property_id = ?
  AND strategy = 'mobile'
  AND metric_date >= date('now', '-30 days')
```

---

## Readiness Gates / Data Quality

### Coverage Thresholds
- **GA4:** Expect 30/30 days (100%)
- **GSC:** Expect 27/27 days (100% accounting for 3-day lag)
- **PSI:** Expect 30/30 days (100%)
- **GBP:** Variable, often incomplete

### Status Definitions
- **FULL:** ≥95% coverage (28+ days for GA4/PSI, 26+ for GSC)
- **PARTIAL:** >0% but <95% coverage
- **MISSING:** 0% coverage

---

## Common Pitfalls

### ❌ DON'T:
```sql
-- Using property_id with GSC
SELECT * FROM gsc_daily_metrics WHERE property_id = '424416990'

-- Forgetting strategy filter for PSI
SELECT * FROM pagespeed_metrics WHERE property_id = '424416990'

-- Not accounting for GSC lag
SELECT * FROM gsc_daily_metrics 
WHERE metric_date >= date('now', '-30 days')

-- Using GTMetrix (no data)
SELECT * FROM gtmetrix_metrics WHERE property_id = '424416990'
```

### ✅ DO:
```sql
-- Using ga4_property_id with GSC
SELECT * FROM gsc_daily_metrics WHERE ga4_property_id = '424416990'

-- Always specify strategy for PSI
SELECT * FROM pagespeed_metrics 
WHERE property_id = '424416990' AND strategy = 'mobile'

-- Account for 3-day GSC lag
SELECT * FROM gsc_daily_metrics 
WHERE metric_date >= date('now', '-30 days')
  AND metric_date <= date('now', '-3 days')

-- Don't use GTMetrix at all
-- (Skip it in multi-source queries)
```

---

## Quick Reference: Column Names by Source

| Metric | GA4 Column | GSC Column | PSI Column |
|--------|-----------|-----------|-----------|
| Property ID | `property_id` | `ga4_property_id` ⚠️ | `property_id` |
| Date | `metric_date` | `metric_date` | `metric_date` |
| Sessions | `sessions` | N/A | N/A |
| Clicks | N/A | `clicks` | N/A |
| Performance | N/A | N/A | `performance_score` |
| Position | N/A | `average_position` | N/A |
| LCP | N/A | N/A | `lcp_value` |
| Conversions | `conversions` | N/A | N/A |

---

## Property Matching Metadata

### Available Fields for Matching:
- `unit_count` - From `property_metadata` or registry
- Metro/Location - Must be inferred from URL or property name
- Traffic volume - Calculate from `ga4_daily_metrics.sessions`
- GBP data - From `gbp_daily_metrics` or `gbp_reviews_summary`

### Metro Inference Logic:
- Houston metro includes: Houston, Richmond, Pearland, Katy
- Check URLs for city keywords
- Fallback to "Unknown" if no match

---

---

## Resi vs Portfolio Comparative Analysis Reference

### Analysis Design Pattern
When comparing Resi properties to Portfolio properties, use matched-pairs design:

#### Matching Algorithm Weights:
1. **Metro Match** (40 points) - Same metropolitan area
2. **Unit Similarity** (30 points) - Within 20% unit count
3. **Traffic Similarity** (20 points) - Within 50% session volume  
4. **GBP Data Availability** (10 points) - Both have or both lack GBP data

#### Exclusion Rules:
- **NEVER match Resi-to-Resi** - All portfolio matches must be from non-Resi properties
- **Exclude pre-opening properties** - Monteverde (488649687) not comparable until operational
- Minimum match score threshold: 50 points

#### Analysis Window Recommendations:
- Use 15-day windows for complete data coverage
- Account for GSC 3-day lag (12 days of GSC data in 15-day window)
- Validate data completeness before declaring findings:
  - GA4: ≥85% coverage (≥13/15 days)
  - GSC: ≥85% coverage (≥10/12 available days)  
  - PSI: ≥80% coverage (≥12/15 days)
  - GBP: ≥80% coverage (≥12/15 days)

#### Category Winner Logic:
- **Always declare a winner** - no "Mixed" or "Tie" for differences >3 percentage points
- Demand: Higher sessions wins
- Engagement: Higher engagement rate wins (calculate from engaged_sessions/sessions)
- Intent/Conversion: Higher CIR wins (use proper event mappings!)
- Performance: Higher PSI mobile performance score wins
- Trust Context: Higher GBP actions/day wins

#### Portfolio Baseline Calculation:
```sql
-- Portfolio-wide CIR (excluding all Resi properties)
SELECT 
    COUNT(*) as total_conversions,
    (SELECT SUM(sessions) FROM ga4_daily_metrics 
     WHERE property_id NOT IN ('445473253','441503068','424416990','488649687')
       AND metric_date >= date('now', '-15 days')) as total_sessions,
    ROUND((COUNT(*) * 100.0 / 
          (SELECT SUM(sessions) FROM ga4_daily_metrics 
           WHERE property_id NOT IN ('445473253','441503068','424416990','488649687')
             AND metric_date >= date('now', '-15 days'))), 3) as portfolio_cir
FROM ga4_event_facts
WHERE property_id NOT IN ('445473253','441503068','424416990','488649687')
  AND event_name IN ('pricequote_click', 'applyonline_click', 'scheduletour_click')
  AND event_date >= date('now', '-15 days')
```

---

## Version History
- **2026-01-27:** Initial schema reference created
  - Documented GSC ID normalization issue (property_id vs ga4_property_id)
  - Added GSC lag handling pattern
  - Removed GTMetrix (no data collected)
  - Added calculated field formulas
  - **Added ga4_event_facts table documentation**
  - **Added Resi vs Portfolio conversion event mappings (CRITICAL)**
  - **Documented conversions column always = 0 issue**
  - **Added Resi property identification (domains + IDs)**
  - **Added comparative analysis design patterns**
