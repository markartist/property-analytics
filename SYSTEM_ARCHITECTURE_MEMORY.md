# Property Analytics System - Architecture Memory
**Last Updated**: 2026-01-25  
**Purpose**: Quick reference for AI agents and developers

---

## 🎯 SYSTEM OVERVIEW

This is a **production-grade portfolio analytics platform** for Venterra Living, tracking 90+ multifamily properties across digital marketing channels.

**Core Philosophy**:
- ✅ Universal daily data collection → centralized database → on-demand report generation
- ✅ NO direct API calls during report generation (speed + reliability)
- ✅ Single source of truth: `portfolio_analytics.db` SQLite database
- ✅ Email-safe HTML reports (table-based layouts, inline styles)

---

## 📦 MAJOR COMPONENTS

### 1. Universal Data Collector ⭐
**Path**: `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`

**What it does**:
- Runs DAILY via cron/scheduler
- Collects data from 5 APIs for all 90+ properties
- Writes to centralized SQLite database
- Monitored wrapper: `collect_daily_data_monitored.py`

**Data Sources**:
1. **Google Analytics 4** → `ga4_daily_metrics` (sessions, events, devices)
2. **Google Search Console** → `gsc_daily_metrics` (rankings, clicks, impressions)
3. **PageSpeed Insights** → `pagespeed_results` (mobile/desktop performance)
4. **Google Ads API** → `google_ads_keywords` (spend, clicks, conversions by keyword)
5. **Google Business Profile** → `gbp_reviews` (reviews with star ratings)

**Integration Added (2026-01-25)**:
- GBP review collection now runs daily after PageSpeed (lines 1185)
- 22,509 historical reviews backfilled (2009-2026)
- Validation checks added to `validate_registry_completeness.py`

### 2. Property Intelligence Brief (PIB) ⭐⭐⭐
**Path**: `/Users/mark/Property_Analytics/Property_Intelligence_Brief/`

**What it does**:
- Generates executive email reports for individual properties
- Reads ONLY from database (no API calls)
- Outputs HTML + JSON files
- Can be emailed directly to stakeholders

**Current Version**: v1.8.0 (LOCKED STANDARD)

**Key Files**:
- `generate_property_intelligence_brief.py` - Main orchestrator
- `templates/executive_email_template.py` - Email HTML generator (v1.8.0)
- `send_pib_email.py` - Email delivery CLI
- `docs/PIB_v1.8.0_LOCKED_STANDARD.md` - Complete specification

**Locked Sections** (DO NOT REORDER):
1. Header (property name, dates)
2. Top KPI Tiles (Sessions, CIR%, Avg Position)
3. Site Performance (PageSpeed mobile/desktop)
4. Search Performance (GSC rankings + keywords)
5. Ad Performance (spend + unit type classification + keyword breakdown)
6. Conversion & Sentiment (CIR + behavior + reviews)
7. Confidence & Data Integrity
8. Technical Appendix

**Usage**:
```bash
# Generate report
python3 generate_property_intelligence_brief.py --property 378702475 --days 30

# Send via email
python3 send_pib_email.py --html-file reports/... --recipients email@domain.com
```

### 3. Review Sentiment Analyzer
**Path**: `/Users/mark/Property_Analytics/Reviews/analyze_reviews.py`

**What it does**:
- Uses OpenAI GPT-4 to analyze review sentiment (-1.0 to +1.0)
- Extracts themes (maintenance, staff, location, amenities)
- Identifies critical reviews for follow-up
- Writes to `review_sentiment` table

**Cost**: ~$0.003-0.005 per review  
**Backfill Status**: Not yet run on all 22,509 reviews (analyze on-demand)

**Integration**:
- PIB checks `review_sentiment` table for analyzed reviews
- Shows aggregate sentiment, themes, critical reviews
- Falls back gracefully if no sentiment data available

### 4. Email Delivery System
**Path**: `/Users/mark/Property_Analytics/utils/email_sender.py`  
**Config**: `/Users/mark/Property_Analytics/credentials/email_config.json`

**Features**:
- Multi-provider support (Gmail, Outlook, custom SMTP)
- HTML email with inline styles (Outlook-compatible)
- Multiple recipients
- Attachment support

**Current Setup**: Gmail SMTP (marklaufhutte@gmail.com)

### 5. Property Registry
**Path**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

**Structure**: JSON array of 90+ properties
```json
{
  "name": "The Harrison",
  "ga4_property_id": "378702475",
  "gsc_property_url": "https://theharrisonapts.com/",
  "site_type": "resi",
  "market": "San Antonio",
  "state": "TX"
}
```

**Used By**: All components for property lookup, site type detection, market context

---

## 🗄️ DATABASE SCHEMA

**Location**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

### Core Tables

| Table | Purpose | Updated By | Read By |
|-------|---------|------------|---------|
| `ga4_daily_metrics` | GA4 sessions, events | Universal collector | PIB, dashboards |
| `gsc_daily_metrics` | Search rankings, clicks | Universal collector | PIB |
| `pagespeed_results` | Site performance scores | Universal collector | PIB |
| `google_ads_keywords` | Keyword spend/performance | Universal collector | PIB |
| `gbp_reviews` | All GBP reviews | Universal collector | Review analyzer, PIB |
| `review_sentiment` | Analyzed sentiment data | Review analyzer | PIB |
| `insights` | Automated insights | Insight generator | PIB |
| `google_ads_property_mapping` | GA4 → Ads linkage | Manual/script | PIB (ads section) |

### Views
- `data_freshness` - Latest date for each data source per property

---

## 🔗 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                  DAILY DATA COLLECTION                       │
│                (collect_daily_data.py)                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   GA4    │  │   GSC    │  │   PSI    │  │ Ads API  │   │
│  │   API    │  │   API    │  │   API    │  │          │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │  portfolio_analytics  │                       │
│              │        .db            │                       │
│              └───────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (reads)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│             PROPERTY INTELLIGENCE BRIEF (PIB)                │
│        (generate_property_intelligence_brief.py)             │
│                                                              │
│  Data Gathering Functions:                                  │
│  • gather_ga4_metrics()                                     │
│  • gather_cir_metrics()                                     │
│  • gather_gsc_metrics()                                     │
│  • gather_pagespeed_metrics()                               │
│  • gather_google_ads_metrics()                              │
│  • gather_review_sentiment_data()                           │
│  • compute_portfolio_standing()                             │
│                                                              │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │  executive_email_     │                       │
│              │  template.py          │                       │
│              │  (v1.8.0 LOCKED)      │                       │
│              └───────────────────────┘                       │
│                          │                                   │
│                          ▼                                   │
│           ┌──────────────────────────┐                       │
│           │  HTML Report + JSON      │                       │
│           │  reports/<property>/...  │                       │
│           └──────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (optional)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    EMAIL DELIVERY                            │
│                  (send_pib_email.py)                         │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │  Gmail SMTP Server    │                       │
│              │  smtp.gmail.com:587   │                       │
│              └───────────────────────┘                       │
│                          │                                   │
│                          ▼                                   │
│              mlaufhutte@venterraliving.com                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 CRITICAL INTERDEPENDENCIES

### 1. Google Ads Integration
**Requires**:
- `google_ads_property_mapping` table populated (GA4 ID → Customer ID)
- Daily collection via `collect_daily_data.py`
- Keyword classification function `classify_keyword()` imported from portfolio monitoring

**PIB Behavior**:
- Checks mapping table first (line 446 in `generate_property_intelligence_brief.py`)
- If no mapping: Shows "No Google Ads tracking configured"
- If mapping but no data: Shows "No spend in 14-day window"

### 2. Review Sentiment
**Requires**:
- `gbp_reviews` table populated (daily collection + historical backfill complete)
- `review_sentiment` table populated (requires running `analyze_reviews.py`)

**PIB Behavior**:
- Shows basic stats even without sentiment (total reviews, avg rating)
- Full sentiment section only if analyzed reviews exist
- Graceful fallback: "No sentiment analysis performed yet"

### 3. CIR Calculation
**Requires**:
- Minimum 50 sessions in period for reliable calculation
- GA4 conversion events tracked (price_quotes, tour_clicks, apply_clicks, etc.)
- Site type (`resi` vs `senior`) determines which events count

**PIB Behavior**:
- Shows "—" if insufficient sessions
- CIR tile always visible (top tiles + Conversion section)

### 4. Portfolio Benchmarks
**Requires**:
- Multiple properties with data in same time window
- Site type matching (resi compared to resi only)

**PIB Behavior**:
- Calculates percentile rankings across portfolio
- Shows "vs portfolio avg" comparisons
- Falls back gracefully if insufficient portfolio data

---

## 🔧 VALUABLE EXISTING SCRIPTS

### Portfolio Monitoring (`/Portfolio_Monitoring/`)
- `collect_daily_data.py` - ⭐ Universal collector (runs daily)
- `collect_daily_data_monitored.py` - Wrapper with error handling
- `validate_registry_completeness.py` - Property validation
- `backfill_*.py` - Historical data backfill scripts
- `classify_keyword.py` - Google Ads keyword classifier

### Reviews (`/Reviews/`)
- `analyze_reviews.py` - ⭐ OpenAI sentiment analyzer
- `backfill_gbp_reviews.py` - Historical review collection (COMPLETE)

### Utilities (`/utils/`)
- `email_sender.py` - ⭐ Multi-provider email delivery
- `registry_loader.py` - Property registry loader
- `database_utils.py` - SQLite helper functions

### Google Ads (`/Google_Ads/`)
- `google_ads_collector.py` - Daily keyword collection
- `sync_property_mappings.py` - Mapping table management

---

## 📝 COMMON WORKFLOWS

### Workflow 1: Daily Operations
```bash
# 1. Daily data collection (automated via cron)
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 collect_daily_data_monitored.py

# 2. Optional: Analyze new reviews (as needed)
cd /Users/mark/Property_Analytics/Reviews
python3 analyze_reviews.py --property-id 378702475 --limit 25

# 3. Generate PIB for specific property
cd /Users/mark/Property_Analytics/Property_Intelligence_Brief
python3 generate_property_intelligence_brief.py --property 378702475 --days 30

# 4. Send via email
python3 send_pib_email.py --html-file reports/... --recipients email@domain.com
```

### Workflow 2: Backfill Historical Data
```bash
# Already complete for GBP reviews (22,509 reviews, 2009-2026)
# If needed for other data sources:
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 backfill_ga4_data.py --start-date 2024-01-01 --end-date 2024-12-31
python3 backfill_gsc_data.py --start-date 2024-01-01 --end-date 2024-12-31
```

### Workflow 3: Adding New Property
```bash
# 1. Add to registry
nano /Users/mark/Property_Analytics/config/venterra_properties_official.json

# 2. Validate registry
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 validate_registry_completeness.py

# 3. Backfill historical data
python3 collect_daily_data.py  # Will pick up new property

# 4. Optional: Add Google Ads mapping
# (Manual insertion into google_ads_property_mapping table)
```

---

## ⚠️ IMPORTANT CONSTRAINTS

### Email Template (PIB v1.8.0)
- ❌ NO flexbox, grid, or modern CSS (breaks Outlook)
- ✅ Table-based layouts only
- ✅ Inline styles only (no `<style>` tags)
- ✅ No JavaScript
- ✅ No external images (use data URIs for logos)

### Google Ads
- Fixed 14-day window (not configurable via `--days` flag)
- Requires property mapping in `google_ads_property_mapping` table
- Keyword classification: Studio, 1BR, 2BR, 3BR, Generic

### Review Sentiment
- OpenAI API required (~$0.003-0.005 per review)
- Not all reviews analyzed yet (analyze on-demand)
- PIB shows raw stats if sentiment unavailable

### CIR Calculation
- Requires minimum 50 sessions
- Event-based (doesn't attribute to specific sessions)
- Different events for `resi` vs `senior` sites

---

## 🎯 DESIGN PATTERNS

### Pattern 1: Graceful Degradation
Every PIB section handles missing data elegantly:
- Shows "Data unavailable" message
- Never crashes or shows empty sections
- Provides context for why data is missing

### Pattern 2: Database-First
- Universal collector writes to database daily
- Report generators read from database only
- No API calls during report generation = fast + reliable

### Pattern 3: Single Source of Truth
- Property registry: `venterra_properties_official.json`
- Database: `portfolio_analytics.db`
- All components reference these, never duplicate data

### Pattern 4: Email-Safe HTML
- Table-based layouts (48% + 4% gap pattern for side-by-side)
- Inline styles only
- Outlook-tested (most restrictive email client)

---

## 🔐 VERSION CONTROL NOTES

**Repository**: Local Git repo at `/Users/mark/Property_Analytics/`  
**Branch**: `main`  
**No remote**: All code is local-only (contains API credentials)

**Key Tags**:
- `pib-v1.8.0-locked` - Current locked standard (2026-01-25)

---

## 📚 DOCUMENTATION INDEX

1. **PIB v1.8.0 Locked Standard** - `/Property_Intelligence_Brief/docs/PIB_v1.8.0_LOCKED_STANDARD.md`
2. **PIB v1.8.0 Release Notes** - `/Property_Intelligence_Brief/docs/PIB_v1.8.0_RELEASE_NOTES.md`
3. **GBP Daily Collection Setup** - `/Portfolio_Monitoring/docs/GBP_DAILY_COLLECTION_SETUP.md`
4. **System Architecture** - This file

---

## 🧠 MEMORY NOTES FOR AI AGENTS

### When modifying PIB:
1. Check `PIB_v1.8.0_LOCKED_STANDARD.md` for constraints
2. Test with The Harrison (378702475) - has all data sources
3. Test with property missing data sources
4. Send test emails to Gmail + Outlook
5. Verify Unit Type Distribution shows Generic keyword breakdown

### When adding new data sources:
1. Add to `collect_daily_data.py` 
2. Create database table/view
3. Add to `data_freshness` view
4. Update PIB data gathering functions
5. Update documentation

### When debugging:
1. Check `portfolio_analytics.db` for data availability
2. Verify property exists in `venterra_properties_official.json`
3. Check Google Ads mapping table if ads issue
4. Review sentiment table if reviews issue
5. Look at data freshness view for lag issues

### Remember:
- ✅ We have 22,509 reviews backfilled (2009-2026)
- ✅ Universal collector runs daily for all 90+ properties
- ✅ PIB v1.8.0 is LOCKED - don't reorder sections
- ✅ Generic keywords MUST show top 5 breakdown in PIB
- ✅ Email templates MUST be table-based (Outlook compatibility)

---

**END OF SYSTEM ARCHITECTURE MEMORY**
