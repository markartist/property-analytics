# Paid Media Workbook — Quick Start Guide

**Version:** 1.2  
**Last Updated:** January 23, 2026

---

## Generate the Workbook

```bash
cd /Users/mark/Property_Analytics/paid_media_workbook/scripts
python3 generate_paid_media_workbook.py
```

**Runtime:** 30-60 seconds  
**Output:** `outputs/paid_media_workbook_YYYY-MM-DD_v1.2.xlsx`

---

## What's In The Workbook?

### Two Worksheets, Two Audiences

#### Worksheet 1: Paid_Media_Overview
**For:** Community Managers, Regional Managers  
**Contains:** One row per property (91 properties)  
**Shows:** Spend summary, floor plan targeting, inventory alignment

#### Worksheet 2: Spend_Breakdown  
**For:** Marketing Operations, Paid Media Analysts  
**Contains:** One row per property × spend subtype (209 rows)  
**Shows:** Granular spend classification (Brand, Competitor, Local Generic, Other Generic)

---

## How To Use It

### Community Managers → Paid_Media_Overview Tab
1. Open file in Excel
2. Filter to your property name
3. Read your row (takes <60 seconds):
   - Total ad spend
   - Floor plan targeting (Studio/1BR/2BR)
   - Alignment with inventory
4. Ask informed questions about paid media strategy

### Regional Managers → Paid_Media_Overview Tab
1. Filter by Region (or Market)
2. Sort by Total Ad Spend
3. Filter by Targeting Status to identify opportunities:
   - "Not Targeted" = generic keywords only
   - "Partially Aligned" = targeting but mismatched
   - "Aligned" = targeting matches inventory

### Marketing Operations → Spend_Breakdown Tab
1. Filter to any property
2. Sort by Spend ($) to see dominant subtypes
3. Use for:
   - Validating classification logic
   - Understanding generic spend composition
   - Identifying optimization opportunities (e.g., high competitor spend)

---

## Key Columns Explained

### Paid_Media_Overview

| Column | What It Means |
|--------|---------------|
| **Total Ad Spend ($)** | All Google Ads spend for this property (30 days) |
| **Classified Spend (%)** | % of budget on floor plan keywords (Studio/1BR/2BR) |
| **Generic Spend (%)** | % of budget on non-floor plan keywords |
| **Floor Plans Targeted** | Which floor plans have spend >$0 |
| **Targeting Status** | Aligned (matches inventory), Partially Aligned (mismatched), Not Targeted (generic only) |
| **Occupancy (%)** | Current occupancy from availability feed |
| **Market/Region Source** | How Market/Region were populated (Registry, Placeholder, etc.) |

### Spend_Breakdown

| Column | What It Means |
|--------|---------------|
| **Category** | Classified (floor plan) or Unclassified (generic) |
| **Subtype** | Studio/1BR/2BR or Brand/Competitor/Local Generic/Other Generic |
| **Spend ($)** | Dollar spend for this specific subtype |
| **Spend (%)** | % of property's total spend allocated to this subtype |
| **Spend Rank** | 1 (highest) to 5 (lowest) within property |
| **Description** | Human-readable explanation of subtype |

---

## What This Report Does NOT Do

- ❌ Rank properties
- ❌ Score performance
- ❌ Recommend actions
- ❌ Show campaign IDs or keywords
- ❌ Make forecasts

**This is a visibility tool, not a decision engine.**

---

## Troubleshooting

### No data for my property
- Check that property has active Google Ads campaigns
- Verify campaign name matches property name (case-insensitive)
- Confirm property is in the official registry

### Market/Region shows "TBD (Coming Soon)"
- Normal! These are placeholders until mapping is available
- Check "Market/Region Source" column to see provenance
- To fix: Update property registry with `market` and `region` fields

### Availability data missing
- Property may not have feed_id in registry
- Feed may be temporarily unavailable (retry in 15 minutes)

### Script fails
```bash
# Check Google Ads API credentials
ls -la /Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml

# Check property registry
ls -la /Users/mark/Property_Analytics/config/venterra_properties_official.json
```

---

## Files You Should Know About

| File | Purpose |
|------|---------|
| `scripts/generate_paid_media_workbook.py` | Generator script (run this) |
| `outputs/paid_media_workbook_*.xlsx` | Generated workbooks |
| `docs/PAID_MEDIA_WORKBOOK_CONTRACT.md` | Full specification (v1.2) |
| `README.md` | Detailed usage guide |
| `CHANGELOG.md` | Version history |
| `SESSION_MEMORY_*.md` | Development history and technical details |

---

## Need More Details?

- **Full specification:** `docs/PAID_MEDIA_WORKBOOK_CONTRACT.md`
- **Detailed usage:** `README.md`
- **Technical details:** `SESSION_MEMORY_PAID_MEDIA_WORKBOOK_2026-01-23.md`

---

**Questions?** Contact Mark Laufhutte (mlaufhutte@venterraliving.com)
