# Session Memory — Paid Media Performance Workbook v1.2
**Date:** January 23, 2026  
**Project:** Paid Media Performance Workbook for Venterra Properties  
**Location:** `/Users/mark/Property_Analytics/paid_media_workbook/`

---

## Executive Summary

Completed development of Paid Media Performance Workbook v1.2, a dual-worksheet Excel system providing both high-level paid media visibility for community managers and granular spend transparency for marketing operations. The workbook integrates Google Ads data with property registry and availability feeds to show spend distribution, floor plan targeting, inventory alignment, and detailed spend subtype classification across all 91 Venterra properties.

**Key Deliverable:** Excel workbook with 2 worksheets, 22 columns (Overview), 7 columns (Breakdown), covering 30-day rolling window.

---

## Project Evolution

### Version 1.0 (January 22-23, 2026)
**Status:** ✅ Completed

**Scope:** Initial implementation of single-worksheet workbook with property-level Google Ads summary for community managers.

**Key Features:**
- One row per property (91 properties)
- 22 columns covering property context, spend overview, targeting distribution, performance, inventory context, alignment signal, data quality
- Rolling 30-day window
- Deterministic floor plan classification (Studio/1BR/2BR)
- Alignment logic (Aligned/Partially Aligned/Not Targeted)

**Issues Resolved:**
1. **Empty data rows:** Fixed property registry loading (changed from `canonical_name` to `name` field)
2. **Missing availability:** Fixed availability matching (changed from feed_id-based to property name-based matching)
3. **Incorrect occupancy percentages:** Removed `*100` multiplication since Excel percentage format handles it automatically

**Results:** Successfully generated workbook with 91 properties, 6,156 keyword rows processed, correct occupancy percentages (87-94% range).

### Version 1.1 (January 23, 2026)
**Status:** ✅ Completed

**Scope:** Added Market/Region placeholders with data provenance tracking.

**Key Features:**
- Added "Market/Region Source" column to track data origin
- Implemented placeholders "TBD (Coming Soon)" for missing market/region values
- All 91 properties show "Placeholder" status (registry lacks these fields currently)

**Rationale:** Executive-safe placeholder strategy allows filtering/rollup infrastructure to be built now while awaiting authoritative mapping data.

### Version 1.2 (January 23, 2026)
**Status:** ✅ Completed

**Scope:** Added granular spend breakdown worksheet for marketing operations transparency.

**Key Features:**
- **New Worksheet:** Spend_Breakdown (209 rows: property × subtype combinations)
- **Enhanced Classification:** 
  - Classified subtypes: Studio, 1BR, 2BR (floor plan keywords)
  - Unclassified subtypes: Brand, Competitor, Local Generic, Other Generic
- **7 Columns:** Property Name, Category, Subtype, Spend ($), Spend (%), Spend Rank (1-5), Description
- **Dual Audience:** Overview sheet for community managers, Breakdown sheet for marketing operations

**Technical Implementation:**
- Modified `classify_keyword()` to classify floor plans
- Added `classify_unclassified_keyword()` for subtype classification
- Updated data collection to track spend in `subtypes` dictionary
- Created `generate_spend_breakdown_worksheet()` function
- Modified main() to generate both worksheets

**Classification Logic:**
- **Brand:** Contains property name (lowercase, partial match)
- **Competitor:** Matches known competitor list (camden, greystar, equity residential, etc.)
- **Local Generic:** Contains geographic terms (city/region) + apartment terms
- **Other Generic:** Fallback for all other unclassified keywords

**Results:**
- Paid_Media_Overview: 92 rows × 22 columns
- Spend_Breakdown: 209 rows × 7 columns
- Both worksheets successfully generated and validated

---

## Technical Architecture

### Data Sources

#### 1. Google Ads API
- **Customer ID:** 9089267423
- **Config:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml`
- **Metrics:** Spend (cost_micros), clicks, conversions, campaign names, keywords
- **Window:** Rolling 30 days from run date
- **Processing:** 6,156 keyword rows across 91 properties

#### 2. Property Registry
- **Location:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- **Fields Used:** `name` (property name), `market`, `region`, `ga4_property_id`
- **Properties:** 91 active properties

#### 3. Availability Feed
- **URL:** `https://online.venterraliving.com/encasa-external/ThirtyLines`
- **Update Frequency:** Every 15 minutes
- **Fields:** Total units, available units by floor plan (Studio, 1BR, 2BR, 3BR+), occupancy %
- **Matching:** Property name-based (case-insensitive partial match)

### Classification System

#### Floor Plan Keywords (Classified)
Uses deterministic regex patterns (case-insensitive):
- **Studio:** `\bstudio\b|\beff\b|\befficiency\b`
- **1BR:** `\b1\s*b(ed)?r?(oom)?\b|\bone\s*bed(room)?\b`
- **2BR:** `\b2\s*b(ed)?r?(oom)?\b|\btwo\s*bed(room)?\b`

#### Unclassified Subtypes
Priority-based classification:
1. **Brand:** Contains property name (e.g., "avasa hammock landing apartments")
2. **Competitor:** Matches known competitor list
3. **Local Generic:** Geographic term + apartment term (e.g., "orlando apartments", "tampa fl rentals")
4. **Other Generic:** Fallback (e.g., "pet friendly apartments", "luxury apartments")

### Alignment Logic

**Deterministic thresholds:**

1. **Not Targeted:**
   - Classified Spend < 15%
   - Property has generic keywords only

2. **Aligned:**
   - Classified Spend ≥ 15%
   - AND max absolute delta ≤ 15%
   - Delta = |floor_plan_spend_pct - floor_plan_availability_pct|

3. **Partially Aligned:**
   - Classified Spend ≥ 15%
   - AND max absolute delta > 15%

---

## File Outputs

### Generated Workbook
**Location:** `/Users/mark/Property_Analytics/paid_media_workbook/outputs/paid_media_workbook_2026-01-22_v1.2.xlsx`

**Worksheet 1: Paid_Media_Overview**
- **Rows:** 92 (91 properties + header)
- **Columns:** 22
- **Audience:** Community managers, regional managers
- **Purpose:** High-level spend summary, targeting distribution, inventory alignment

**Worksheet 2: Spend_Breakdown**
- **Rows:** 209 (property × subtype combinations + header)
- **Columns:** 7
- **Audience:** Marketing operations, paid media analysts
- **Purpose:** Granular spend transparency, subtype classification validation

### Documentation
1. **Contract:** `/Users/mark/Property_Analytics/paid_media_workbook/docs/PAID_MEDIA_WORKBOOK_CONTRACT.md` (v1.2)
2. **README:** `/Users/mark/Property_Analytics/paid_media_workbook/README.md` (updated for dual-worksheet usage)
3. **Session Memory:** `/Users/mark/Property_Analytics/paid_media_workbook/SESSION_MEMORY_PAID_MEDIA_WORKBOOK_2026-01-23.md` (this file)

---

## Key Decisions & Rationale

### Two-Worksheet Design
**Decision:** Split into Overview (community managers) + Breakdown (marketing operations)

**Rationale:**
- Community managers need fast, high-level visibility (one row per property)
- Marketing operations needs granular spend transparency (one row per property × subtype)
- Separating audiences prevents information overload for community managers
- Allows marketing operations to audit classification logic without exposing raw keywords

### Placeholder Strategy for Market/Region
**Decision:** Use "TBD (Coming Soon)" placeholders with "Market/Region Source" provenance column

**Rationale:**
- Builds filtering/rollup infrastructure now while awaiting authoritative data
- Executive-safe: clearly labeled as placeholders, not missing data
- Provenance column makes data quality transparent
- Prevents confusion about partial vs complete data

### Deterministic Classification (No ML)
**Decision:** Use regex patterns for floor plan classification and rule-based logic for subtype classification

**Rationale:**
- Proven methodology (same as PIB)
- Transparent and auditable
- No model drift or retraining required
- Fast execution (processes 6,156 keywords in ~30 seconds)
- Sufficient accuracy for business needs

### Spend Rank (1-5)
**Decision:** Rank subtypes by spend within each property (descending)

**Rationale:**
- Helps marketing operations quickly identify dominant spend subtypes
- No cross-property ranking (avoids "league table" dynamic)
- Property-level focus maintains community manager perspective

---

## Usage Patterns

### For Community Managers
1. Open workbook → Paid_Media_Overview tab
2. Filter to property name
3. Read row in <60 seconds:
   - Total ad spend
   - Floor plan targeting (Studio/1BR/2BR)
   - Alignment with inventory
4. Ask informed questions about paid media strategy

### For Regional Managers
1. Open workbook → Paid_Media_Overview tab
2. Filter by Region (when mapping available)
3. Sort by Total Ad Spend to see budget distribution
4. Filter by Targeting Status to identify opportunities

### For Marketing Operations
1. Open workbook → Spend_Breakdown tab
2. Filter to any property
3. Sort by Spend ($) to see dominant subtypes
4. Use for:
   - Validating classification logic
   - Understanding generic spend composition
   - Identifying optimization opportunities (e.g., high competitor spend)
   - Auditing spend transparency

---

## Validation Results

### v1.2 Workbook Verification
✅ **File Generated:** `paid_media_workbook_2026-01-22_v1.2.xlsx`  
✅ **Worksheets:** Both Paid_Media_Overview and Spend_Breakdown present  
✅ **Data Quality:**
- Overview: 92 rows × 22 columns
- Breakdown: 209 rows × 7 columns
- Sample data spot-checked (Avasa at 1604):
  - Classified: 1BR ($170.34), 2BR ($408.88)
  - Unclassified: Brand ($449.33), Local Generic ($2,314.56), Other Generic ($6,856.71)

✅ **Formatting:**
- Currency formatted as `$#,##0.00`
- Percentages formatted as `0.0%`
- Header rows frozen
- No broken formulas (all values computed and written directly)

✅ **Logic Reconciliation:**
- Total spend = Classified + Generic for all properties
- Subtype spend sums match category totals
- Spend ranks correctly ordered (1 = highest, 5 = lowest)

---

## Project Structure

```
paid_media_workbook/
├── docs/
│   └── PAID_MEDIA_WORKBOOK_CONTRACT.md    # v1.2 specification
├── scripts/
│   └── generate_paid_media_workbook.py    # v1.2 generator script
├── outputs/
│   └── paid_media_workbook_2026-01-22_v1.2.xlsx    # Generated workbook
├── README.md                                # Usage guide (updated for v1.2)
└── SESSION_MEMORY_PAID_MEDIA_WORKBOOK_2026-01-23.md    # This file
```

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **Market/Region Placeholders:** All 91 properties show "TBD (Coming Soon)" until registry mapping available
2. **Manual Execution:** No scheduled runs or email delivery (by design)
3. **Conversion Tracking:** Left blank if unreliable (common Google Ads issue)
4. **3BR+ Classification:** Currently excluded from floor plan classification (low volume)

### Future Enhancement Opportunities
1. **Market/Region Mapping:** Populate from authoritative source when available
2. **Automation:** Add scheduled runs (weekly/monthly)
3. **Email Delivery:** Send to regional managers automatically
4. **Time Series:** Track targeting alignment trends over time
5. **3BR+ Classification:** Add if volume warrants
6. **Campaign Structure:** Add campaign-level details for marketing operations

---

## Testing & Quality Assurance

### Test Scenarios Executed
1. ✅ Property registry loading (name field vs canonical_name)
2. ✅ Availability matching (property name-based vs feed_id-based)
3. ✅ Occupancy percentage calculation (Excel percentage format)
4. ✅ Classification logic (Studio/1BR/2BR regex patterns)
5. ✅ Subtype classification (Brand/Competitor/Local Generic/Other Generic)
6. ✅ Spend reconciliation (Classified + Generic = Total)
7. ✅ Worksheet generation (both Overview and Breakdown)
8. ✅ Formatting (currency, percentages, header freeze)

### Known Good Properties (Validation)
- **Avasa Hammock Landing:** 61.2% classified spend, aligned targeting
- **Avasa at 1604:** Multiple subtypes, good test case for Breakdown worksheet

---

## Command Reference

### Generate Workbook
```bash
cd /Users/mark/Property_Analytics/paid_media_workbook/scripts
python3 generate_paid_media_workbook.py
```

**Expected Runtime:** 30-60 seconds  
**Output:** `/Users/mark/Property_Analytics/paid_media_workbook/outputs/paid_media_workbook_YYYY-MM-DD_vX.X.xlsx`

### Verify Workbook
```python
import openpyxl
wb = openpyxl.load_workbook("outputs/paid_media_workbook_YYYY-MM-DD_vX.X.xlsx")
print(wb.sheetnames)  # Should show ['Paid_Media_Overview', 'Spend_Breakdown']
```

---

## Dependencies

### Python Packages
- `google-ads` (Google Ads API client)
- `openpyxl` (Excel workbook generation)
- `requests` (availability feed fetching)

### Configuration Files
- `/Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml` (Google Ads API credentials)
- `/Users/mark/Property_Analytics/config/venterra_properties_official.json` (property registry)

---

## Lessons Learned

### What Worked Well
1. **Iterative development:** v1.0 → v1.1 → v1.2 allowed for incremental validation and user feedback
2. **Dual-worksheet design:** Cleanly separates audiences without creating two separate workbooks
3. **Deterministic classification:** Transparent, auditable, fast
4. **Placeholder strategy:** Executive-safe approach to incomplete data
5. **Contract-first approach:** Clear specification before implementation prevented scope creep

### What Required Adjustment
1. **Property matching:** Feed_id-based matching failed, property name-based matching worked
2. **Occupancy calculation:** Excel percentage format already multiplies by 100
3. **Subtype classification:** Required priority-based logic (Brand → Competitor → Local Generic → Other Generic)

### Best Practices Established
1. **Always validate against known properties** (Avasa Hammock Landing, Avasa at 1604)
2. **Document data provenance** (Market/Region Source column)
3. **Write computed values directly** (no formulas in workbook)
4. **Freeze header rows** (improves usability)
5. **Provide dual-audience documentation** (community managers vs marketing operations)

---

## Next Session Continuity

If continuing this work:

1. **Check for new requirements:** User may want additional subtypes, time series tracking, or automation
2. **Review outputs location:** `outputs/` directory for latest workbook
3. **Check contract version:** Currently v1.2, may need updates for new features
4. **Validate Google Ads API access:** Credentials in `google-ads.yaml`, Customer ID 9089267423
5. **Property registry updates:** Check for new properties or market/region mappings

**Key files to review:**
- `docs/PAID_MEDIA_WORKBOOK_CONTRACT.md` (current specification)
- `README.md` (usage guide)
- `scripts/generate_paid_media_workbook.py` (generator script)
- This session memory document

---

## Related Projects

### Property Intelligence Brief (PIB)
- **Location:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/`
- **Relationship:** Uses same classification logic for floor plan targeting analysis
- **Session Memory:** `SESSION_MEMORY_PIB_GOOGLE_ADS_2026-01-22.md`

### Portfolio Monitoring
- **Location:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/`
- **Shared Resources:** Google Ads API config, property registry
- **Classification Methodology:** Proven in PIB, reused in Paid Media Workbook

---

**End of Session Memory**
