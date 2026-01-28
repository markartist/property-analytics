# Paid Media Performance Workbook

**30-Day Google Ads Performance Report for Venterra Properties**

---

## Overview

Provides community managers with a clear view of paid media (Google Ads) performance across all Venterra properties. The workbook shows spend distribution, floor plan targeting, and inventory alignment in an easy-to-filter Excel format.

**Target Audience:** Community Managers, Regional Managers, Marketing Operations  
**Format:** Excel (.xlsx)  
**Time Window:** Rolling 30 days  
**Update Frequency:** Manual (on-demand)

---

## Quick Start

### Generate Workbook

```bash
cd /Users/mark/Property_Analytics/paid_media_workbook/scripts
python3 generate_paid_media_workbook.py
```

**Output Location:**  
`/Users/mark/Property_Analytics/paid_media_workbook/outputs/paid_media_workbook_YYYY-MM-DD.xlsx`

**Runtime:** ~30-60 seconds

---

## What's In The Workbook

The workbook contains **two worksheets** designed for different audiences:

### Worksheet 1: Paid_Media_Overview (Community Managers)

**One row per property** with high-level summary:

**Property Context**
- Property name
- Market (city, state) - may show "TBD (Coming Soon)" placeholder
- Region - may show "TBD (Coming Soon)" placeholder

**Spend Overview (30 days)**
- Total ad spend
- Classified spend (floor plan keywords)
- Generic spend (non-floor plan keywords)
- Spend percentages

**Targeting Distribution**
- Which floor plans are targeted (Studio, 1BR, 2BR)
- % of spend on each floor plan

**Performance**
- Total clicks
- Average CPC (cost per click)
- Conversions (if available)
- Cost per conversion (if available)

**Inventory Context**
- Current occupancy %
- Units available
- % of availability by floor plan (1BR, 2BR)

**Alignment Signal**
- Targeting Status: "Aligned" | "Partially Aligned" | "Not Targeted"

**Data Quality**
- Market/Region Source: Indicates how Market and Region were populated

### Worksheet 2: Spend_Breakdown (Marketing Operations)

**One row per property × spend subtype** with granular spend transparency:

**Columns:**
- Property Name
- Category (Classified | Unclassified)
- Subtype (Studio, 1BR, 2BR, Brand, Competitor, Local Generic, Other Generic)
- Spend ($)
- Spend (%)
- Spend Rank (1-5, highest to lowest)
- Description (explanation of subtype)

**Purpose:** Shows exactly where unclassified/generic spend is going (brand terms, competitor terms, local generics, etc.)

---

## How To Use The Workbook

### For Community Managers → Use Paid_Media_Overview

1. **Open the file** in Excel (no special software needed)
2. **Go to the Paid_Media_Overview tab** (first worksheet)
3. **Filter to your property** using the Property Name column
4. **Read your row** in under 60 seconds:
   - How much is being spent on ads?
   - Is spend targeted to specific floor plans?
   - Does targeting align with current availability?
5. **Ask better questions** about your property's paid media strategy

### For Regional Managers → Use Paid_Media_Overview

1. **Filter by Region** to see all your properties
2. **Sort by Total Ad Spend** to see budget distribution
3. **Filter by Targeting Status** to identify opportunities:
   - "Not Targeted" = generic keywords only
   - "Partially Aligned" = some targeting but mismatched
   - "Aligned" = targeting matches inventory

### For Marketing Operations → Use Spend_Breakdown

1. **Go to the Spend_Breakdown tab** (second worksheet)
2. **Filter to any property** to see granular spend allocation
3. **Sort by Spend ($)** to see which subtypes consume the most budget
4. **Use this to:**
   - Validate classification logic (see exactly what's classified vs not)
   - Understand generic spend composition (brand vs competitor vs local)
   - Identify optimization opportunities (e.g., high competitor spend)
   - Audit spend transparency without needing raw keywords

---

## Column Definitions

See full definitions in `/Users/mark/Property_Analytics/paid_media_workbook/docs/PAID_MEDIA_WORKBOOK_CONTRACT.md`

### Key Columns Explained

**Classified Spend (%)** = Percent of budget spent on floor plan keywords (Studio, 1BR, 2BR)  
**Generic Spend (%)** = Percent of budget spent on non-floor plan keywords  
**Targeting Status** = Alignment between targeting and availability:
- **Aligned:** Classified spend ≥15% AND floor plan distribution matches availability (within 15%)
- **Partially Aligned:** Classified spend ≥15% BUT distribution doesn't match availability
- **Not Targeted:** Classified spend <15% (mostly generic keywords)

**Market/Region Source** = How Market and Region values were populated:
- **Registry:** From property registry metadata
- **Placeholder:** Shows "TBD (Coming Soon)" until mapping is available
- **Mapping Table:** From internal mapping (future enhancement)

---

## Data Sources

### Google Ads API
- Customer ID: 9089267423
- Pulls keyword-level data for all campaigns
- 30-day rolling window

### Property Registry
- `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- Provides property names, markets, regions

### Availability Feed
- `https://online.venterraliving.com/encasa-external/ThirtyLines`
- Real-time occupancy and floor plan availability
- Updated every 15 minutes

---

## Requirements

### Python Packages
```bash
pip install google-ads openpyxl requests
```

### Configuration Files
- `google-ads.yaml` - Google Ads API credentials (already configured)
- Property registry (already in place)

---

## What This Report Does NOT Do

Per contract, this workbook is a **visibility tool**, not a decision engine.

**It does NOT:**
- Rank properties
- Score performance
- Recommend actions
- Show campaign IDs, keywords, or match types
- Make forecasts or predictions
- Send emails automatically

**Use this workbook to understand current state and ask informed questions.**

---

## Project Structure

```
paid_media_workbook/
├── docs/
│   └── PAID_MEDIA_WORKBOOK_CONTRACT.md    # Full specification
├── scripts/
│   └── generate_paid_media_workbook.py    # Generator script
├── outputs/
│   └── paid_media_workbook_YYYY-MM-DD.xlsx    # Generated workbooks
└── README.md                                # This file
```

---

## Troubleshooting

### No Data For My Property
- Check that property has active Google Ads campaigns
- Verify campaign name matches property name (case-insensitive partial match)
- Confirm property is in the official registry

### Availability Data Missing
- Property may not have feed_id in registry
- Feed may be temporarily unavailable (retry in 15 minutes)

### Market/Region Shows "TBD (Coming Soon)"
- Normal! These fields are included now to support future filtering
- Authoritative mapping not yet available in property registry
- To add mappings: Update property registry with `market` and `region` fields
- Check "Market/Region Source" column to see how each property was populated

### Script Fails
```bash
# Check Google Ads API credentials
ls -la /Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml

# Verify property registry exists
ls -la /Users/mark/Property_Analytics/config/venterra_properties_official.json

# Check Python packages
python3 -c "import google.ads.googleads; import openpyxl; import requests; print('OK')"
```

---

## Validation Checklist

Before using any generated workbook:
- [ ] Total Spend = Classified + Generic for all properties
- [ ] Currency formatted correctly ($)
- [ ] Percentages formatted correctly (%)
- [ ] Header row frozen at top
- [ ] All properties from registry included (91 expected)

---

## Related Documentation

- **Contract:** `docs/PAID_MEDIA_WORKBOOK_CONTRACT.md` - Full specification
- **PIB Project:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/` - Property Intelligence Briefs
- **Portfolio Pulse:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/` - Daily executive reports

---

## Support

**Owner:** Mark Laufhutte (mlaufhutte@venterraliving.com)  
**Google Ads Partner:** Annus Rehman (arehman@venterraliving.com)

For questions about:
- **Workbook contents:** See contract documentation
- **Targeting strategy:** Contact Google Ads partner
- **Property data:** Verify in property registry

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-22 | Initial release |
| 1.1 | 2026-01-23 | Added Market/Region placeholders and source tracking column |

---

**Last Updated:** January 23, 2026
