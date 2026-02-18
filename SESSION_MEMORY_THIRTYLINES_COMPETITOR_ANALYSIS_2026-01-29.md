# Session Memory: ThirtyLines Integration & Competitor Analysis

**Date:** January 29, 2026  
**Status:** Phase 1 Complete - Awaiting Competitor Mapping Data

---

## Session Overview

Built ThirtyLines unit availability collector and explored SEMRush competitor analysis capabilities. ThirtyLines collector is fully operational and collecting data for all 91 properties. Competitor analysis tested and ready for integration pending manual competitor mapping data.

---

## Accomplishments

### 1. ThirtyLines Unit Availability Collector ✅ COMPLETE

**Database Schema Created:**
- `property_floorplans` - Floorplan specifications (beds, baths, sqft, pricing)
- `unit_availability` - Daily availability snapshots
- `available_units` - Individual unit tracking with first/last seen dates
- `floorplan_pricing_history` - Price trends over time
- `v_latest_availability` - View for current availability

**Collector Built:**
- Location: `/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py`
- Fetches from: `https://online.venterraliving.com/encasa-external/ThirtyLines`
- Maps ThirtyLines IDs to `property_metadata` table (GA4 property IDs)

**Property Mapping:**
- All 91/91 properties successfully mapped
- ThirtyLines IDs stored in `property_metadata.thirtylines_id`
- Used fuzzy name matching + manual fixes for edge cases (CoHo, The Parker)

**Collection Results:**
- ✅ 91/91 properties collected (0 failures)
- ✅ 933 floorplans tracked
- ✅ 1,607 units available across portfolio
- ✅ 2,547 individual units tracked with availability dates

**Key Insight:**
- CoHo is a Venterra property (not "CoHo Apartments")
- ThirtyLines feed has 91 properties vs 93 in registry (2 properties not in feed)

### 2. SEMRush Competitor Analysis Testing ✅ TESTED & VALIDATED

**API Endpoints Tested:**
- ✅ `domain_organic_organic` - WORKS for domain-level competitors
- ❌ `domain_competitors` - Does not exist
- ❌ URL-level competitor analysis - Not supported by SEMRush

**Key Findings:**

**For Independent Domains (e.g., monteverdesatx.com):**
- ✅ Can get property-specific competitors
- ✅ Returns relevance score, common keywords, traffic estimates
- Example: Found 15 competitors including legacyatsciencepark.com, avistaronthehillsapts.com

**For Subfolder Properties (e.g., venterraliving.com/apartments/apex-west-midtown/):**
- ❌ Cannot get property-specific competitors
- ✅ Can only get domain-level competitors (venterraliving.com)
- ⚠️ Requires manual competitor mapping for accurate analysis

**Competitor Data Available from SEMRush:**
- Competitor domain
- Relevance score (0-1)
- Common keywords (overlap with our property)
- Organic keywords total
- Traffic estimate (monthly)
- Traffic cost estimate (USD)
- Paid keywords count

**Smart Filtering Logic Built:**

Exclusions:
- Venterra domains: nicolawealth.com, venterra.com, venterraliving.com
- Service providers: Keywords like "promove", "integrity", "management", "realty", "broker"
- Aggregators: apartments.com, zillow.com, trulia.com, etc.
- Mega-sites: Traffic >500K (likely marketplaces)

Inclusions:
- Domains with apartment keywords: "apartment", "living", "apts", "homes", "communities", "residence"
- Reasonable traffic: 1K-100K (suggests property portfolio)
- Real apartment properties and management companies

**Test Results:**
- venterraliving.com: Found 19 valid competitors after filtering
  - Top: advenirliving.com (35,143 traffic, 82 common keywords)
  - Also: irtliving.com (113,377 traffic - major competitor!)
- monteverdesatx.com: Found 15 valid competitors
  - Top: monteverdeapts.net (55% relevance, 284 traffic)

**Test Script Created:**
- Location: `/Users/mark/Property_Analytics/Data_Collection/collectors/test_competitor_analysis.py`
- Standalone script with CompetitorAnalyzer class
- Intelligent filtering logic
- Ready for integration

### 3. Competitor Analysis Strategy Defined

**Current Limitation:**
- SEMRush can only find competitors at domain level, not URL/subfolder level
- Most Venterra properties (70+) are on venterraliving.com subfolders
- Domain-level competitors not useful for individual property analysis

**Solution Identified:**
- User has Excel sheet with manual competitor mappings
- Manual mapping is BETTER than automated (local market knowledge)
- Waiting for user to locate Excel file

**When Excel Sheet is Provided:**
1. Import property-to-competitor mappings
2. Create `property_competitor_mapping` table
3. Fetch SEMRush metrics for mapped competitors
4. Build comparative analysis for PIB reports
5. Track competitor changes over time

**Expected Excel Structure (to be confirmed):**
- Property name/ID
- Competitor name
- Competitor domain/URL
- Possibly: market, priority, notes

---

## Technical Details

### Database Changes

**New Tables:**
```sql
property_floorplans (10 columns)
unit_availability (9 columns)
available_units (16 columns)
floorplan_pricing_history (7 columns)
```

**New Column:**
- `property_metadata.thirtylines_id` - Maps to ThirtyLines feed IDs

**Views:**
- `v_latest_availability` - Current availability across all properties

### Property Mapping Specifics

**Master Table:** `property_metadata` (91 properties)
- Uses GA4 property ID as primary key
- ThirtyLines IDs mapped via property name matching
- Fuzzy matching used for slight name variations

**Mapping Process:**
1. Exact name match (76/91 properties)
2. Fuzzy string matching with 50%+ similarity (14 properties)
3. Manual fixes for edge cases (CoHo, The Parker)

### ThirtyLines Feed Structure

**Per Property:**
- Property ID, name, address, contact info
- Unit count, lease terms, amenities
- Floorplans array with:
  - Specs: beds, baths, sqft, rent range
  - Availability: now, 30d, 60d, 60d+
  - Available units array with specific unit details
  - Matterport tours, floor plan diagrams

**Data Collection Frequency:**
- Daily at 5:00 AM (when integrated)
- Tracks unit lifecycle (first seen → last seen → leased)
- Historical pricing trends

### SEMRush API Details

**API Key Location:**
- `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/semrush_api_key.txt`

**Endpoint Used:**
```
https://api.semrush.com/?type=domain_organic_organic
&key={api_key}&domain={domain}&database=us
&display_limit=30&export_columns=Dn,Cr,Np,Or,Ot,Oc,Ad
```

**Response Format:**
- Semicolon-delimited CSV
- Header row + data rows
- Columns: Domain, Competitor Relevance, Common Keywords, Organic Keywords, Traffic, Cost, Adwords

**Rate Limits:**
- Not encountered during testing
- Collecting for 91 properties may require throttling

---

## Files Created

1. `/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py`
   - Main collector class
   - Fetches feed, parses floorplans, stores data
   - Includes main() for standalone testing

2. `/Users/mark/Property_Analytics/Data_Collection/collectors/test_competitor_analysis.py`
   - Standalone competitor analyzer
   - CompetitorAnalyzer class with filtering logic
   - Test script for venterraliving.com and monteverdesatx.com

3. `/Users/mark/Property_Analytics/EXECUTIVE_SUMMARY.md` (updated earlier)
   - Platform overview document

4. `/Users/mark/Property_Analytics/EXECUTIVE_SUMMARY.docx`
   - Word format of executive summary

5. `/Users/mark/Property_Analytics/SMTP_Access_Request.md` & `.docx`
   - IT documentation for email access

---

## Next Steps

### Immediate (Blocked - Awaiting Data)
1. **Receive competitor Excel sheet from user**
   - Determine structure and format
   - Identify columns and coverage

### Phase 2 (After Excel Sheet Received)
1. **Build competitor mapping importer**
   - Parse Excel file
   - Create `property_competitor_mapping` table
   - Load mappings into database

2. **Build competitor metrics collector**
   - Fetch SEMRush data for each mapped competitor
   - Store in `competitor_metrics` table
   - Run daily/weekly to track changes

3. **Add competitive intelligence to PIB report**
   - Top competitor section
   - "Why they're winning" analysis
   - Keyword gaps and recommendations
   - Traffic/authority comparison

### Phase 3 (Future Enhancement)
1. **Integrate ThirtyLines into daily collection**
   - Add to `daily_master_collection.py`
   - Schedule at 5:00 AM
   - Monitor for errors

2. **Add availability section to PIB report**
   - Current availability by floorplan
   - Pricing analysis
   - Leasing velocity metrics
   - 30/60 day pipeline

3. **Enhanced competitive analysis**
   - PageSpeed comparison (test competitor URLs)
   - Content depth analysis (scrape competitor sites)
   - Backlink comparison via SEMRush
   - Local SEO signals

---

## Questions for User

1. **Competitor Excel Sheet:**
   - Where is it located?
   - What's the structure/format?
   - How many properties have competitor mappings?
   - Are competitor domains/URLs included?

2. **Integration Priorities:**
   - Should ThirtyLines collector run daily now?
   - Or wait until PIB integration is complete?

3. **Competitor Analysis Scope:**
   - How many competitors per property? (Top 3? Top 5?)
   - Should we track competitors over time?
   - Weekly or monthly collection frequency?

---

## Key Decisions Made

1. **Use property_metadata as master table**
   - Not the old 15-row `properties` table
   - GA4 property ID as primary key
   - All 91 properties present

2. **ThirtyLines ID mapping strategy**
   - Fuzzy name matching + manual fixes
   - Store in `property_metadata.thirtylines_id`
   - One-time mapping, persistent in database

3. **Competitor analysis approach**
   - Use manual Excel mappings for subfolder properties
   - Use SEMRush API for independent domain properties
   - Smart filtering to exclude service providers
   - Focus on actual apartment competitors

4. **Standalone testing first**
   - Build and test collectors independently
   - Integrate into daily collection later
   - Validates logic before automation

---

## Testing Performed

### ThirtyLines Collector
- ✅ API connection successful
- ✅ JSON parsing correct
- ✅ Property mapping working (91/91)
- ✅ Database inserts successful
- ✅ Data verification: Queries return accurate results

### Competitor Analysis
- ✅ SEMRush API working
- ✅ Filtering logic effective
- ✅ Tested with multiple domains
- ✅ Edge cases handled (Venterra exclusions, service providers)

### Data Validation
- ✅ Floorplan data: Mission Mayfield Downs has 5 floorplans (S1, B1, A1, B2, C1)
- ✅ Availability: 2-8 units per floorplan
- ✅ Unit tracking: 2,547 individual units with availability dates
- ✅ Competitor data: venterraliving.com has 19 valid competitors after filtering

---

## Outstanding Items

- [ ] Locate competitor Excel sheet
- [ ] Import competitor mappings
- [ ] Build competitor metrics collector
- [ ] Integrate ThirtyLines into daily collection
- [ ] Add availability section to PIB
- [ ] Add competitive intelligence to PIB

---

## Context for Future Sessions

**The Big Picture:**
We're enhancing the Property Intelligence Brief (PIB) to include:
1. **Unit Availability** - Real-time floorplan availability and pricing from ThirtyLines feed
2. **Competitive Intelligence** - Top competitor analysis with "why they're winning" insights

**Current State:**
- ThirtyLines data collection: READY (fully operational, not yet scheduled)
- Competitor analysis: READY (tested, awaiting manual mappings)
- PIB integration: PENDING (waiting on above)

**Data Flow:**
1. ThirtyLines API → Database (daily) ✅ Built
2. Excel Sheet → Competitor Mappings → Database ⏳ Awaiting data
3. SEMRush API → Competitor Metrics → Database ⏳ Next step
4. Database → PIB Report → Email 🎯 Final goal

**Key Files to Remember:**
- ThirtyLines collector: `Data_Collection/collectors/thirtylines_collector.py`
- Competitor test: `Data_Collection/collectors/test_competitor_analysis.py`
- Master database: `data/portfolio_analytics.db`
- Property metadata table: `property_metadata` (91 properties, GA4 IDs as keys)

**API Resources Available:**
- SEMRush API: `/Spotlight_Properties_Report/config/semrush_api_key.txt`
- ThirtyLines feed: Public HTTPS endpoint (no auth required)
- GA4, GSC, PageSpeed: Already integrated

**Important Notes:**
- nicolawealth.com and venterra.com are Venterra-owned (exclude from competitors)
- promove, yourintegrityhome are services (exclude from competitors)
- CoHo is a Venterra property, not "CoHo Apartments"
- Most properties are on venterraliving.com subfolders (can't use SEMRush for property-specific competitors)

