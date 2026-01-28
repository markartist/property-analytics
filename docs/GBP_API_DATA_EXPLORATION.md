# Google Business Profile API - Data Exploration
**Date**: 2026-01-25  
**Status**: Currently collecting reviews only, many more metrics available

---

## 🎯 CURRENT STATE

### What We're Collecting Now ✅
- **Reviews** (via My Business v4 API)
  - Review ID, reviewer name, profile photo
  - Star rating (1-5)
  - Review text (comment)
  - Create time, update time
  - Review reply and reply time
  - **Status**: 22,509 reviews backfilled (2009-2026), daily collection active

### What We're NOT Collecting Yet ❌
- **Performance Insights** (profile views, actions, search queries)
- **Location Information** (full business details, photos, posts)
- **Photo Views** (merchant vs customer photos)
- **Search Keywords** (how people find your listings)

---

## 📊 AVAILABLE GBP APIs

### 1. My Business Account Management API
**Endpoint**: `https://mybusinessaccountmanagement.googleapis.com/v1/accounts`

**Purpose**: Account and location management

**What it provides**:
- List all GBP accounts
- List all locations under an account
- Account metadata and permissions

**Current Use**: ✅ Used for account discovery and location listing

---

### 2. Business Information API  
**Endpoint**: `https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations`

**Purpose**: Detailed location/business information

**What it provides**:
```python
readMask fields available:
- name                    # Full resource name
- title                   # Business name
- storefrontAddress       # Full address object
- storeCode               # Custom location code
- phoneNumbers            # Primary + additional phones
- websiteUri              # Website URL
- categories              # Primary + additional categories
- profile                 # Profile description, opening hours
- metadata               # Verification state, maps URI
- latlng                  # Geographic coordinates
- serviceArea            # Service delivery area
- regularHours           # Operating hours
- specialHours           # Holiday/special hours
- moreHours              # Additional hours (e.g., delivery)
- openInfo               # Current open/closed status
```

**Potential Value**:
- ✅ Operating hours → Show in PIB if property is open/closed
- ✅ Verification state → Track unverified locations
- ✅ Categories → Ensure proper categorization
- ✅ Photos → Track photo count/quality
- ✅ Service area → Understand delivery/service coverage

**Current Use**: ⚠️ Partially used (name, title, address only in backfill)

---

### 3. Business Profile Performance API ⭐⭐⭐
**Endpoint**: `https://businessprofileperformance.googleapis.com/v1/locations/{locationId}:fetchMultiDailyMetricsTimeSeries`

**Purpose**: Performance insights and analytics (BIGGEST OPPORTUNITY)

**Daily Metrics Available**:

#### Profile Views
```python
BUSINESS_IMPRESSIONS_DESKTOP_MAPS    # Views from Google Maps desktop
BUSINESS_IMPRESSIONS_MOBILE_MAPS     # Views from Google Maps mobile
BUSINESS_IMPRESSIONS_DESKTOP_SEARCH  # Views from Google Search desktop
BUSINESS_IMPRESSIONS_MOBILE_SEARCH   # Views from Google Search mobile
```
**Value**: Track how many people view your GBP listing each day

#### Customer Actions
```python
WEBSITE_CLICKS                       # Clicks to website
CALL_CLICKS                          # Phone call clicks
BUSINESS_DIRECTION_REQUESTS          # Direction requests
DRIVING_DIRECTIONS_CLICKS            # Driving directions
BUSINESS_BOOKINGS                    # Booking button clicks
BUSINESS_FOOD_ORDERS                 # Food ordering clicks
BUSINESS_FOOD_MENU_CLICKS            # Menu view clicks
```
**Value**: Track conversion actions from GBP listing (similar to CIR!)

#### Search Discovery
```python
QUERIES_DIRECT                       # Searches for your business name
QUERIES_INDIRECT                     # Discovery searches (generic terms)
QUERIES_CHAIN                        # Searches for your brand
```
**Value**: Understand how people find you (brand vs discovery)

#### Photo Engagement
```python
BUSINESS_PHOTOS_VIEWS_MERCHANT       # Views of your photos
BUSINESS_PHOTOS_VIEWS_CUSTOMERS      # Views of customer photos
PHOTOS_COUNT_MERCHANT                # Your photo count
PHOTOS_COUNT_CUSTOMERS               # Customer photo count
```
**Value**: Photo engagement correlation with bookings

#### Local Posts
```python
LOCAL_POST_VIEWS_SEARCH              # Post views from search
LOCAL_POST_ACTIONS_CALL_TO_ACTION    # CTA clicks on posts
```
**Value**: Track effectiveness of GBP posts

**Data Granularity**:
- Daily time series (historical data available)
- 2-day lag (same as GSC)
- Can aggregate to weekly/monthly

**Potential PIB Section**: "Local Presence & Discovery"

**Current Use**: ❌ NOT COLLECTING

---

### 4. My Business v4 API (Reviews)
**Endpoint**: `https://mybusiness.googleapis.com/v4/{account}/locations/{location}/reviews`

**Purpose**: Review collection

**What it provides**:
- Review ID, reviewer name, profile photo
- Star rating, review text
- Create/update timestamps
- Review replies

**Current Use**: ✅ FULLY IMPLEMENTED (22,509 reviews backfilled)

---

## 🎨 WHAT WE COULD ADD TO PIB

### New Section: "Local Presence & Discovery"

```
┌─────────────────────────────────────────────────────────┐
│  Local Presence & Discovery                    Healthy  │
├─────────────────────────────────────────────────────────┤
│  How residents discover and engage with your GBP listing│
└─────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ PROFILE VIEWS    │  │ DISCOVERY RATE   │  │ ACTION RATE      │
│                  │  │                  │  │                  │
│     2,847        │  │      73.2%       │  │      8.5%        │
│                  │  │                  │  │                  │
│ Maps: 1,892      │  │ Indirect searches│  │ 242 total actions│
│ Search: 955      │  │ vs direct        │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘

Action Breakdown:
┌─────────────────────────────────────────────────────────┐
│ Website Clicks        142                               │
│ Phone Calls            67                               │
│ Direction Requests     33                               │
└─────────────────────────────────────────────────────────┘

Discovery Source:
┌─────────────────────────────────────────────────────────┐
│ Direct Searches     758  (26.6%)  "The Harrison"        │
│ Indirect Searches 2,089  (73.4%)  "apartments near me"  │
└─────────────────────────────────────────────────────────┘
```

### Benefits:
1. **Complete Discovery Funnel**: Website → Search → GBP → Website/Call
2. **Local SEO Performance**: Track discovery rate (indirect searches)
3. **Action Conversion**: Similar to CIR, but for GBP listing
4. **Competitive Intelligence**: Compare GBP performance across portfolio
5. **Photo Engagement**: Which properties get more photo views = higher intent?

---

## 🔗 INTEGRATION APPROACH

### Option 1: Add to Universal Collector (RECOMMENDED)
```python
# In collect_daily_data.py, add after GBP reviews collection:

def collect_gbp_insights(self):
    """Collect GBP performance insights"""
    
    # For each property with gbp_location_id:
    for prop in properties:
        location_id = prop['gbp_location_id']
        
        # Fetch insights via Business Profile Performance API
        insights = fetch_gbp_insights(location_id)
        
        # Store in gbp_daily_insights table
        self.db.execute("""
            INSERT INTO gbp_daily_insights (
                property_id, metric_date,
                maps_views, search_views,
                website_clicks, phone_calls, direction_requests,
                queries_direct, queries_indirect,
                merchant_photo_views, customer_photo_views
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ...)
```

### Option 2: Separate GBP Collector (ALREADY EXISTS)
- Script exists: `/Spotlight_Properties_Report/gbp_data_collector/gbp_collector.py`
- Has full implementation for insights collection
- Just needs to be adapted for Venterra properties

---

## 📋 IMPLEMENTATION ROADMAP

### Phase 1: Data Collection (Week 1)
**Goal**: Start collecting GBP performance insights daily

1. ✅ **Review backfill** - COMPLETE
2. ⏳ **Add GBP insights to universal collector**
   - Create `gbp_daily_insights` table
   - Add `collect_gbp_insights()` method to `collect_daily_data.py`
   - Test with 5-10 properties
3. ⏳ **Backfill 30 days of insights data**
   - Historical data to establish baseline

**Estimated Effort**: 4-6 hours
**API Quota Impact**: ~100 API calls/day (within free tier)

### Phase 2: PIB Integration (Week 2)
**Goal**: Add "Local Presence & Discovery" section to PIB v1.9.0

1. ⏳ **Create data gathering function**
   - `gather_gbp_insights()` in `generate_property_intelligence_brief.py`
2. ⏳ **Design email template section**
   - Profile views tile (maps + search breakdown)
   - Discovery rate tile (indirect % vs direct %)
   - Action rate tile (website clicks, calls, directions)
   - Action breakdown table
3. ⏳ **Add to PIB template**
   - New section after "Ad Performance" or after "Conversion & Sentiment"
   - Portfolio comparison for views/actions

**Estimated Effort**: 6-8 hours

### Phase 3: Analysis & Optimization (Week 3+)
**Goal**: Derive insights from GBP data

1. ⏳ **Correlation analysis**
   - GBP views → Website sessions
   - Phone calls from GBP → Leasing conversions
   - Photo views → Conversion rate
2. ⏳ **Competitive benchmarking**
   - Top performers for discovery rate
   - Properties with high action rate
3. ⏳ **Recommendations engine**
   - Identify properties with low GBP engagement
   - Suggest photo uploads, post creation

**Estimated Effort**: Ongoing

---

## 💡 KEY INSIGHTS & OPPORTUNITIES

### 1. Complete the Discovery Funnel
**Current Gap**: We track website visitors (GA4) but don't know how many people see us on Google Maps/Search first

**With GBP Insights**:
```
Google Search → GBP Profile View → Website Click → Session (GA4) → Conversion
     ↓              ↓                    ↓
  Impressions   2,847 views         142 clicks
```

### 2. Local SEO Performance
**Current**: GSC shows search rankings for website
**New**: GBP shows how many people find your LISTING (not website)

**Discovery Rate = Indirect Searches / Total Searches**
- High % = Good visibility for "apartments near me" searches
- Low % = Only found by brand name (opportunity for local SEO)

### 3. GBP Action Rate (like CIR for GBP)
**Formula**: `(Website Clicks + Phone Calls + Directions) / Profile Views`

**Portfolio Benchmark**:
- Top 25%: 10%+ action rate
- Middle 50%: 5-10%
- Bottom 25%: <5% (needs optimization)

### 4. Photo Engagement Impact
**Hypothesis**: Properties with more photo views convert better

**Test**:
- Correlate photo views with action rate
- Identify properties needing more professional photos
- Track customer photo contribution rate

### 5. Local Post Effectiveness
**Currently**: No way to know if GBP posts drive engagement
**With Insights**: Track views and CTAs for each post type

---

## 🎯 RECOMMENDED NEXT STEPS

### Immediate (This Week)
1. **Validate API Access**
   - Run `test_gbp_connection.py` with a location ID
   - Confirm insights API works with current credentials
   - Document API quota limits

2. **Create Database Schema**
   ```sql
   CREATE TABLE gbp_daily_insights (
       property_id TEXT NOT NULL,
       metric_date DATE NOT NULL,
       maps_views INTEGER DEFAULT 0,
       search_views INTEGER DEFAULT 0,
       total_views INTEGER DEFAULT 0,
       website_clicks INTEGER DEFAULT 0,
       phone_calls INTEGER DEFAULT 0,
       direction_requests INTEGER DEFAULT 0,
       total_actions INTEGER DEFAULT 0,
       action_rate REAL,
       queries_direct INTEGER DEFAULT 0,
       queries_indirect INTEGER DEFAULT 0,
       discovery_rate REAL,
       merchant_photo_views INTEGER DEFAULT 0,
       customer_photo_views INTEGER DEFAULT 0,
       collected_at TIMESTAMP,
       PRIMARY KEY (property_id, metric_date)
   );
   ```

3. **Test Collection for 3-5 Properties**
   - Run backfill for last 30 days
   - Validate data quality
   - Check for anomalies

### Short-term (Next 2 Weeks)
1. **Integrate into Universal Collector**
   - Add to daily collection routine
   - Monitor API quota usage
   - Set up error alerting

2. **Add to PIB v1.9.0**
   - Design "Local Presence & Discovery" section
   - Create email template
   - Test with stakeholders

### Long-term (Next Month+)
1. **Advanced Analytics**
   - Funnel analysis (Search → GBP → Website → Conversion)
   - Photo engagement correlation
   - Competitive benchmarking

2. **Optimization Recommendations**
   - Automated alerts for declining GBP views
   - Photo upload suggestions
   - Local post content ideas

---

## 📊 ESTIMATED VALUE

### Data Completeness
**Current**: 60% of local discovery funnel tracked
- ✅ Website sessions (GA4)
- ✅ Search rankings (GSC)
- ❌ GBP profile views
- ❌ GBP actions

**After GBP Insights**: 95% of funnel tracked

### PIB Enhancement
**Current**: 7 sections in PIB v1.8.0
**Potential**: 8 sections in PIB v1.9.0 with "Local Presence & Discovery"

### Business Impact
- **Visibility**: Understand local market presence beyond website
- **Actions**: Track phone calls and direction requests (not in GA4)
- **Optimization**: Identify low-performing GBP listings for improvement
- **Competitive Intel**: Benchmark GBP performance across portfolio

---

## 🔐 API CREDENTIALS & ACCESS

**Required Scopes**:
```python
https://www.googleapis.com/auth/business.manage
```

**Current Status**: ✅ Credentials configured
- OAuth2 client: `credentials/client_secret_gbp.json`
- Token file: `credentials/gbp_token.pickle`
- Account access: Confirmed (22,509 reviews collected)

**APIs to Enable**:
- ✅ My Business Account Management API
- ✅ Business Information API
- ⚠️ Business Profile Performance API (needs verification)
- ✅ My Business v4 API (reviews)

---

## 📚 REFERENCE DOCUMENTATION

**Official Docs**:
- [Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rest)
- [Business Information API](https://developers.google.com/my-business/reference/businessinformation/rest)
- [Account Management API](https://developers.google.com/my-business/reference/accountmanagement/rest)

**Existing Scripts**:
- `/Portfolio_Monitoring/discover_all_gbp_locations.py` - Location discovery
- `/Portfolio_Monitoring/test_gbp_connection.py` - API connection test
- `/Spotlight_Properties_Report/gbp_data_collector/gbp_collector.py` - Full collector

**Database Schema**:
- `/Spotlight_Properties_Report/src/database/gbp_schema.sql` - Complete GBP tables

---

**END OF EXPLORATION DOCUMENT**
