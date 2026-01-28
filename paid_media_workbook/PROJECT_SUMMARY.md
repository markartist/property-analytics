# Project Summary — Paid Media Performance Workbook v1.2

**Date Completed:** January 23, 2026  
**Project Owner:** Mark Laufhutte (mlaufhutte@venterraliving.com)  
**Status:** ✅ Complete

---

## Overview

The Paid Media Performance Workbook is a dual-worksheet Excel system that provides property-level Google Ads visibility for Venterra Properties. It serves two distinct audiences:

1. **Community Managers:** High-level spend summary and inventory alignment (Overview worksheet)
2. **Marketing Operations:** Granular spend classification and transparency (Breakdown worksheet)

The workbook integrates data from Google Ads API, property registry, and availability feeds to deliver actionable insights across 91 properties with a rolling 30-day window.

---

## Final Deliverables

### 1. Generated Workbook (v1.2)
**Location:** `/Users/mark/Property_Analytics/paid_media_workbook/outputs/paid_media_workbook_2026-01-22_v1.2.xlsx`  
**Size:** 29 KB  
**Format:** Excel (.xlsx) with 2 worksheets

#### Worksheet 1: Paid_Media_Overview
- **Rows:** 92 (91 properties + header)
- **Columns:** 22
- **Purpose:** High-level spend summary for community managers
- **Contains:** Spend overview, targeting distribution, performance metrics, inventory context, alignment signals

#### Worksheet 2: Spend_Breakdown
- **Rows:** 209 (property × subtype combinations + header)
- **Columns:** 7
- **Purpose:** Granular spend transparency for marketing operations
- **Contains:** Category, Subtype, Spend ($), Spend (%), Spend Rank, Description

### 2. Documentation Suite

#### Contract (v1.2)
**Location:** `docs/PAID_MEDIA_WORKBOOK_CONTRACT.md`  
**Purpose:** Complete technical specification  
**Contents:**
- Column definitions (both worksheets)
- Classification logic (deterministic patterns)
- Alignment rules (Aligned/Partially Aligned/Not Targeted)
- Data sources and update frequencies
- Explicit non-goals
- Quality bar and validation checklist

#### README
**Location:** `README.md`  
**Purpose:** Usage guide  
**Contents:**
- Quick start instructions
- Worksheet descriptions
- Usage patterns by role (community manager, regional manager, marketing operations)
- Column definitions
- Troubleshooting
- Project structure

#### Quick Start Guide
**Location:** `QUICKSTART.md`  
**Purpose:** Fast reference for generating and using workbook  
**Contents:**
- One-command generation
- Role-based usage instructions
- Key column explanations
- Common troubleshooting scenarios

#### Changelog
**Location:** `CHANGELOG.md`  
**Purpose:** Version history tracking  
**Contents:**
- v1.0: Initial implementation (January 22, 2026)
- v1.1: Market/Region placeholders (January 23, 2026)
- v1.2: Spend_Breakdown worksheet (January 23, 2026)

#### Session Memory
**Location:** `SESSION_MEMORY_PAID_MEDIA_WORKBOOK_2026-01-23.md`  
**Purpose:** Complete development history and technical context  
**Contents:**
- Project evolution (v1.0 → v1.1 → v1.2)
- Technical architecture
- Key decisions and rationale
- Validation results
- Lessons learned
- Next session continuity guidance

### 3. Generator Script (v1.2)
**Location:** `scripts/generate_paid_media_workbook.py`  
**Runtime:** 30-60 seconds  
**Processing:** 91 properties, 6,156 keyword rows  
**Output:** Dual-worksheet Excel workbook

#### Key Functions
- `classify_keyword()` — Floor plan classification (Studio/1BR/2BR)
- `classify_unclassified_keyword()` — Subtype classification (Brand/Competitor/Local Generic/Other Generic)
- `generate_excel_workbook()` — Paid_Media_Overview worksheet generation
- `generate_spend_breakdown_worksheet()` — Spend_Breakdown worksheet generation

---

## Technical Specifications

### Data Sources

| Source | Update Frequency | Purpose |
|--------|-----------------|---------|
| Google Ads API (Customer ID: 9089267423) | On-demand | Spend, clicks, conversions, keyword data |
| Property Registry (`venterra_properties_official.json`) | Static | Property names, markets, regions |
| Availability Feed (`ThirtyLines`) | Every 15 minutes | Occupancy, units available by floor plan |

### Classification System

#### Floor Plans (Classified)
- **Studio:** `\bstudio\b|\beff\b|\befficiency\b`
- **1BR:** `\b1\s*b(ed)?r?(oom)?\b|\bone\s*bed(room)?\b`
- **2BR:** `\b2\s*b(ed)?r?(oom)?\b|\btwo\s*bed(room)?\b`

#### Subtypes (Unclassified)
Priority-based classification:
1. **Brand:** Contains property name
2. **Competitor:** Matches known competitor list (camden, greystar, equity residential, etc.)
3. **Local Generic:** Geographic term + apartment term
4. **Other Generic:** Fallback

### Alignment Logic

| Status | Criteria |
|--------|----------|
| **Not Targeted** | Classified Spend < 15% |
| **Aligned** | Classified Spend ≥ 15% AND max floor plan delta ≤ 15% |
| **Partially Aligned** | Classified Spend ≥ 15% AND max floor plan delta > 15% |

---

## Usage Patterns

### Community Managers (Overview Worksheet)
**Goal:** Understand property-level ad spend and targeting in <60 seconds

**Steps:**
1. Open workbook → Paid_Media_Overview tab
2. Filter to property name
3. Review row for spend, targeting, alignment
4. Ask informed questions about paid media strategy

### Regional Managers (Overview Worksheet)
**Goal:** Monitor portfolio budget distribution and targeting opportunities

**Steps:**
1. Filter by Region or Market
2. Sort by Total Ad Spend
3. Filter by Targeting Status
4. Identify properties needing attention

### Marketing Operations (Breakdown Worksheet)
**Goal:** Audit spend classification and identify optimization opportunities

**Steps:**
1. Open workbook → Spend_Breakdown tab
2. Filter to any property
3. Sort by Spend ($) to see dominant subtypes
4. Analyze Brand, Competitor, Local Generic, Other Generic distribution

---

## Validation Results

### Data Quality
✅ **Total Properties:** 91  
✅ **Keyword Rows Processed:** 6,156  
✅ **Occupancy Range:** 87-94%  
✅ **Spend Reconciliation:** Classified + Generic = Total for all properties  
✅ **Formatting:** Currency ($#,##0.00), Percentages (0.0%), Frozen headers  

### Known Good Properties
- **Avasa Hammock Landing:** 61.2% classified spend, aligned targeting
- **Avasa at 1604:** Multiple subtypes, comprehensive test case for Breakdown worksheet

### Sample Data (Avasa at 1604)
- **Classified:** 1BR ($170.34), 2BR ($408.88)
- **Unclassified:** Brand ($449.33), Local Generic ($2,314.56), Other Generic ($6,856.71)

---

## Project Structure

```
paid_media_workbook/
├── docs/
│   └── PAID_MEDIA_WORKBOOK_CONTRACT.md         # v1.2 specification
├── scripts/
│   └── generate_paid_media_workbook.py         # v1.2 generator
├── outputs/
│   ├── paid_media_workbook_2026-01-22.xlsx     # v1.0
│   ├── paid_media_workbook_2026-01-22_v1.1.xlsx # v1.1
│   └── paid_media_workbook_2026-01-22_v1.2.xlsx # v1.2 (FINAL)
├── CHANGELOG.md                                  # Version history
├── PROJECT_SUMMARY.md                            # This file
├── QUICKSTART.md                                 # Quick reference
├── README.md                                     # Usage guide
└── SESSION_MEMORY_PAID_MEDIA_WORKBOOK_2026-01-23.md # Development history
```

---

## Key Achievements

### v1.0 (Initial Implementation)
✅ Single-worksheet workbook with 22 columns  
✅ Fixed property registry loading (`name` vs `canonical_name`)  
✅ Fixed availability matching (property name-based)  
✅ Fixed occupancy percentages (Excel format handling)  
✅ 91 properties with correct data  

### v1.1 (Market/Region Placeholders)
✅ Added Market/Region Source column for data provenance  
✅ Implemented "TBD (Coming Soon)" placeholders  
✅ Executive-safe presentation of incomplete data  

### v1.2 (Spend Breakdown)
✅ Added Spend_Breakdown worksheet (209 rows)  
✅ Enhanced classification (Brand/Competitor/Local Generic/Other Generic)  
✅ Dual-audience design (community managers vs marketing operations)  
✅ Complete documentation suite  
✅ Validation and testing across known good properties  

---

## Dependencies

### Python Packages
- `google-ads` — Google Ads API client
- `openpyxl` — Excel workbook generation
- `requests` — Availability feed fetching

### Configuration Files
- `/Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml` — Google Ads API credentials
- `/Users/mark/Property_Analytics/config/venterra_properties_official.json` — Property registry

---

## Command Reference

### Generate Workbook
```bash
cd /Users/mark/Property_Analytics/paid_media_workbook/scripts
python3 generate_paid_media_workbook.py
```

### Verify Workbook
```python
import openpyxl
wb = openpyxl.load_workbook("outputs/paid_media_workbook_2026-01-22_v1.2.xlsx")
print(wb.sheetnames)  # ['Paid_Media_Overview', 'Spend_Breakdown']
```

### Check File Size
```bash
ls -lh outputs/paid_media_workbook_2026-01-22_v1.2.xlsx
# Expected: ~29 KB
```

---

## Future Enhancements

### Immediate Opportunities
1. **Market/Region Mapping:** Populate from authoritative source (replaces "TBD" placeholders)
2. **3BR+ Classification:** Add if volume warrants
3. **Automation:** Scheduled runs (weekly/monthly)
4. **Email Delivery:** Send to regional managers automatically

### Advanced Features
1. **Time Series:** Track targeting alignment trends over time
2. **Campaign Structure:** Add campaign-level details for marketing operations
3. **Budget Pacing:** Show spend vs budget allocation
4. **Competitor Intelligence:** Expand competitor list, track share of voice

---

## Related Projects

### Property Intelligence Brief (PIB)
**Location:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/`  
**Relationship:** Uses same classification logic for floor plan targeting analysis  
**Session Memory:** `SESSION_MEMORY_PIB_GOOGLE_ADS_2026-01-22.md`  

Shared components:
- Google Ads API config
- Property registry
- Classification methodology (deterministic patterns)

---

## Lessons Learned

### What Worked Well
1. **Iterative development:** v1.0 → v1.1 → v1.2 allowed validation and feedback at each stage
2. **Dual-worksheet design:** Cleanly separated audiences without separate workbooks
3. **Placeholder strategy:** Executive-safe approach to incomplete data
4. **Deterministic classification:** Transparent, auditable, fast
5. **Contract-first approach:** Clear specification prevented scope creep

### What Required Adjustment
1. **Property matching:** Feed_id failed, property name-based worked
2. **Occupancy calculation:** Excel percentage format already multiplies by 100
3. **Subtype classification:** Required priority-based logic (Brand → Competitor → Local Generic → Other Generic)

### Best Practices Established
1. Always validate against known properties
2. Document data provenance explicitly
3. Write computed values directly (no formulas)
4. Freeze header rows for usability
5. Provide dual-audience documentation

---

## Success Metrics

✅ **Completeness:** All 91 properties with complete data  
✅ **Accuracy:** Spend reconciliation passes (Classified + Generic = Total)  
✅ **Usability:** Community managers can understand row in <60 seconds  
✅ **Transparency:** Marketing operations can audit classification logic  
✅ **Documentation:** Complete specification, usage guide, session memory  
✅ **Maintainability:** Clear code structure, version history, change log  

---

## Next Steps

### For Immediate Use
1. Generate workbook for current 30-day window
2. Share with pilot community managers for feedback
3. Train regional managers on Overview worksheet
4. Train marketing operations on Breakdown worksheet

### For Enhancement
1. Gather user feedback on v1.2
2. Prioritize Market/Region mapping source
3. Evaluate automation cadence (weekly vs monthly)
4. Consider email delivery requirements

### For Maintenance
1. Monitor Google Ads API changes
2. Update property registry as new properties launch
3. Refine competitor list as needed
4. Track classification accuracy over time

---

## Contact

**Project Owner:** Mark Laufhutte  
**Email:** mlaufhutte@venterraliving.com  
**Organization:** Venterra Living

---

**Project Status:** ✅ Complete  
**Current Version:** 1.2  
**Last Updated:** January 23, 2026

---

**End of Project Summary**
