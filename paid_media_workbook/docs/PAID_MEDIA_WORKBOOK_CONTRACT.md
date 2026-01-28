# Paid Media Performance Workbook — Contract

**Version:** 1.2  
**Date:** January 23, 2026  
**Owner:** Mark Laufhutte  
**Audience:** Community Managers, Regional Managers, Operations Leaders

---

## Purpose

Provide a clear, property-level view of paid media (Google Ads) performance for Venterra properties over a rolling 30-day window.

This workbook enables community managers to:
- Understand their property's ad spend and targeting
- See how spend is distributed across floor plans
- Identify alignment between targeting and current inventory
- Ask informed questions about paid media strategy

**This is a visibility tool, not a decision engine.**

---

## Audience

**Primary:** Community Managers  
**Secondary:** Regional Managers, Marketing Operations

**Not For:** Executives (use PIB or Portfolio Pulse instead)

---

## Data Sources

### 1. Google Ads API
- **Customer ID:** 9089267423
- **Metrics:** Spend, clicks, conversions, campaign names
- **Keyword Data:** Used for floor plan classification
- **Window:** Rolling last 30 days from run date

### 2. Property Registry
- **Location:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- **Fields:** Property name, market, region, GA4 ID

### 3. Availability Feed
- **URL:** https://online.venterraliving.com/encasa-external/ThirtyLines
- **Update Frequency:** Every 15 minutes
- **Fields:** Total units, available units by floor plan, occupancy %

### 4. Classification Logic
- **Method:** Deterministic regex pattern matching on keywords (same as PIB)
- **Categories:** Studio, 1BR, 2BR, Unclassified (generic)

---

## Time Window

**Rolling 30-day lookback** from run date.

- Run on January 23, 2026 → window is December 24, 2025 to January 22, 2026
- Applied consistently across all properties
- No partial periods — always complete 30 days

---

## Excel Output

### File Format
- **Format:** Excel (.xlsx)
- **Location:** `outputs/paid_media_workbook_YYYY-MM-DD_vX.X.xlsx`
- **Worksheets:** Two sheets (see below)

### Worksheet 1: Paid_Media_Overview
- **Purpose:** High-level summary for community managers
- **Rows:** One row per property (up to 91 properties)
- **Columns:** 22 total (property context, spend, targeting, performance, inventory, alignment)

### Worksheet 2: Spend_Breakdown
- **Purpose:** Granular spend transparency for marketing operations and regional managers
- **Rows:** One row per property × spend subtype (up to 455 rows: 91 properties × 5 subtypes)
- **Columns:** 7 total (property name, category, subtype, spend, spend %, spend rank, description)

### Header Row
Frozen at top for scrolling

---

## Column Definitions — Paid_Media_Overview

### Property Context

#### Property Name
**Type:** Text  
**Source:** Property registry  
**Example:** "Avasa Hammock Landing"

#### Market
**Type:** Text  
**Source:** Property registry (when available), otherwise placeholder  
**Example:** "Orlando, FL" | "TBD (Coming Soon)"  
**Note:** Included now to support future slicing and rollups. Values may be placeholders until authoritative mapping is available.

#### Region
**Type:** Text  
**Source:** Property registry (when available), otherwise placeholder  
**Example:** "Southeast" | "TBD (Coming Soon)"  
**Note:** Included now to support future slicing and rollups. Values may be placeholders until authoritative mapping is available.

---

### Spend Overview (30 days)

#### Total Ad Spend ($)
**Type:** Currency  
**Source:** Google Ads API (sum of cost_micros / 1,000,000)  
**Calculation:** Sum of all keyword spend for property campaigns over 30 days  
**Example:** $2,456.78  
**Note:** Includes all keywords (classified and generic)

#### Classified Spend ($)
**Type:** Currency  
**Calculation:** Sum of spend for keywords classified as Studio, 1BR, or 2BR  
**Example:** $1,504.23  
**Note:** Excludes generic/unclassified keywords

#### Classified Spend (%)
**Type:** Percentage  
**Calculation:** (Classified Spend / Total Ad Spend) × 100  
**Example:** 61.2%  
**Range:** 0% to 100%

#### Generic Spend ($)
**Type:** Currency  
**Calculation:** Total Ad Spend - Classified Spend  
**Example:** $952.55  
**Note:** Spend on non-floor-plan-specific keywords

#### Generic Spend (%)
**Type:** Percentage  
**Calculation:** (Generic Spend / Total Ad Spend) × 100  
**Example:** 38.8%  
**Range:** 0% to 100%

---

### Targeting Distribution

#### Floor Plans Targeted
**Type:** Text  
**Values:** "Studio, 1BR, 2BR" | "1BR, 2BR" | "1BR" | "None"  
**Logic:** Lists floor plans with spend > $0  
**Example:** "1BR, 2BR"

#### % Spend on Studio
**Type:** Percentage  
**Calculation:** (Studio Spend / Total Ad Spend) × 100  
**Example:** 0.0%  
**Note:** Blank if no studio spend

#### % Spend on 1BR
**Type:** Percentage  
**Calculation:** (1BR Spend / Total Ad Spend) × 100  
**Example:** 27.7%  
**Note:** Blank if no 1BR spend

#### % Spend on 2BR
**Type:** Percentage  
**Calculation:** (2BR Spend / Total Ad Spend) × 100  
**Example:** 33.5%  
**Note:** Blank if no 2BR spend

---

### Performance

#### Clicks
**Type:** Integer  
**Source:** Google Ads API (sum of clicks metric)  
**Example:** 1,234  
**Note:** Total clicks across all keywords for property

#### CPC ($)
**Type:** Currency  
**Calculation:** Total Ad Spend / Clicks  
**Example:** $1.99  
**Note:** Average cost per click. Blank if no clicks.

#### Conversions
**Type:** Integer  
**Source:** Google Ads API (sum of conversions metric)  
**Example:** 42  
**Note:** Left BLANK if conversion tracking is unreliable or unavailable

#### Cost per Conversion ($)
**Type:** Currency  
**Calculation:** Total Ad Spend / Conversions  
**Example:** $58.50  
**Note:** Left BLANK if conversions unavailable

---

### Inventory Context

#### Occupancy (%)
**Type:** Percentage  
**Source:** Availability feed  
**Calculation:** ((Total Units - Available Units) / Total Units) × 100  
**Example:** 94.3%  
**Range:** 0% to 100%

#### Units Available
**Type:** Integer  
**Source:** Availability feed (sum of units available now + within 30 days)  
**Example:** 17

#### % 1BR Available
**Type:** Percentage  
**Calculation:** (1BR Available / Total Available) × 100  
**Example:** 52.9%  
**Note:** Blank if no units available

#### % 2BR Available
**Type:** Percentage  
**Calculation:** (2BR Available / Total Available) × 100  
**Example:** 47.1%  
**Note:** Blank if no units available

---

### Alignment Signal

#### Targeting Status
**Type:** Text  
**Values:** "Aligned" | "Partially Aligned" | "Not Targeted"  
**Logic:** See alignment classification rules below

---

### Data Quality

#### Market/Region Source
**Type:** Text  
**Values:** "Registry" | "Registry (Partial)" | "Placeholder" | "Mapping Table"  
**Purpose:** Indicates provenance of Market and Region values  
**Logic:**
- **Registry:** Both market and region populated from property registry
- **Registry (Partial):** Only one field populated from registry
- **Placeholder:** Both fields use "TBD (Coming Soon)" placeholder
- **Mapping Table:** Populated from internal mapping table (future)

**Note:** This column makes placeholders and partial data completion executive-safe and self-explanatory.

---

## Column Definitions — Spend_Breakdown

This worksheet provides transparency into classified vs unclassified spend subtypes for marketing operations and regional managers.

### Property Name
**Type:** Text  
**Source:** Property registry  
**Example:** "Avasa Hammock Landing"

### Category
**Type:** Text  
**Values:** "Classified" | "Unclassified"  
**Logic:**
- **Classified:** Keyword matched Studio, 1BR, or 2BR patterns
- **Unclassified:** Keyword did not match floor plan patterns

### Subtype
**Type:** Text  
**Values:**
- Classified: "Studio", "1BR", "2BR"
- Unclassified: "Brand", "Competitor", "Local Generic", "Other Generic"

**Subtype Classification Logic:**

#### Floor Plan Keywords (Classified)
- **Studio:** Matches regex `\bstudio\b|\beff\b|\befficiency\b` (case-insensitive)
- **1BR:** Matches regex `\b1\s*b(ed)?r?(oom)?\b|\bone\s*bed(room)?\b` (case-insensitive)
- **2BR:** Matches regex `\b2\s*b(ed)?r?(oom)?\b|\btwo\s*bed(room)?\b` (case-insensitive)

#### Generic Keywords (Unclassified)
- **Brand:** Contains property name (lowercase, partial match)
- **Competitor:** Matches known competitor list (e.g., "camden", "greystar", "equity residential")
- **Local Generic:** Contains geographic terms (city/region) + apartment terms (e.g., "orlando apartments", "tampa fl rentals")
- **Other Generic:** All other unclassified keywords (e.g., "pet friendly apartments", "luxury apartments")

### Spend ($)
**Type:** Currency  
**Source:** Google Ads API (sum of cost_micros / 1,000,000)  
**Calculation:** Sum of keyword spend for this property + category + subtype over 30 days  
**Example:** $504.23  
**Note:** Shows dollar spend for this specific subtype

### Spend (%)
**Type:** Percentage  
**Calculation:** (Subtype Spend / Property Total Spend) × 100  
**Example:** 20.5%  
**Range:** 0% to 100%  
**Note:** Percentage of property's total ad spend allocated to this subtype

### Spend Rank
**Type:** Integer  
**Values:** 1 (highest spend) to 5 (lowest spend)  
**Calculation:** Rank of this subtype's spend within the property (descending)  
**Example:** 1  
**Note:** 1 = highest spend subtype for this property, 5 = lowest

### Description
**Type:** Text  
**Purpose:** Human-readable explanation of subtype  
**Examples:**
- "Keywords targeting studio/efficiency units"
- "Brand keywords containing property name"
- "Competitor brand terms"
- "Geographic + apartment keywords (e.g., 'orlando apartments')"
- "Other generic keywords"

---

## Alignment Classification Rules

**Deterministic logic based on spend distribution vs availability:**

### "Not Targeted"
- Classified Spend = 0%
- Property has generic keywords only or no active campaigns

### "Aligned"
- Classified Spend ≥ 15%
- AND maximum absolute delta between any floor plan spend % and availability % ≤ 15%
- Example: 45% spend on 1BR, 52% availability → 7% delta = Aligned

### "Partially Aligned"
- Classified Spend ≥ 15%
- AND maximum absolute delta > 15%
- Example: 60% spend on 1BR, 30% availability → 30% delta = Partially Aligned

### Delta Calculation
For each floor plan (Studio, 1BR, 2BR):
```
delta = |floor_plan_spend_pct - floor_plan_availability_pct|
```

Take the maximum delta across all three floor plans to determine alignment.

---

## Formatting

### Currency
- Format: `$#,##0.00`
- Example: $1,234.56

### Percentages
- Format: `0.0%`
- Example: 61.2%

### Integers
- Format: `#,##0`
- Example: 1,234

### Header Row
- Frozen at top
- Bold text
- No conditional coloring in v1

---

## Explicit Non-Goals

### What This Report Does NOT Do

1. **No Rankings**
   - Does not rank properties by performance
   - Does not identify "best" or "worst"

2. **No Scores**
   - No performance scores
   - No quality grades
   - No efficiency ratings

3. **No Recommendations**
   - Does not suggest budget changes
   - Does not recommend keywords to add/remove
   - Does not prescribe actions

4. **No Technical Details**
   - No campaign IDs
   - No keyword lists
   - No match types
   - No ad group structures

5. **No Automation (Yet)**
   - Manual execution only
   - No scheduled runs
   - No email delivery

6. **No Predictive Analysis**
   - No forecasts
   - No trend projections
   - No "what-if" scenarios

---

## Quality Bar

### Paid_Media_Overview (Community Managers)
A community manager should be able to:
1. Open the file (no special software needed)
2. Filter to their property
3. Understand spend and targeting in under 60 seconds
4. Ask better questions without needing explanation

### Spend_Breakdown (Marketing Operations)
A marketing operations analyst should be able to:
1. Filter to any property
2. See exact spend allocation across subtypes
3. Identify where generic spend is going (brand vs competitor vs local)
4. Validate classification logic without needing to see raw keywords

**If any column requires explanation beyond this document, it should be simplified.**

---

## Assumptions

1. **Campaign Naming:** Properties identified by campaign name matching (lowercase, partial match)
2. **Conversion Tracking:** May be unreliable — left blank if unavailable
3. **Availability Data:** Refreshed every 15 minutes, assumes current snapshot is representative
4. **Classification Logic:** Same deterministic patterns as PIB (proven methodology)

---

## Validation Checklist

Before releasing any workbook:
- [ ] Total spend reconciles with Google Ads UI
- [ ] Classified + Generic = Total for every property
- [ ] All percentages sum to 100% where applicable
- [ ] Currency formatted correctly
- [ ] Header row frozen
- [ ] No broken formulas (all computed values written directly)
- [ ] Alignment logic applied consistently

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-22 | Initial contract with Paid_Media_Overview worksheet |
| 1.1 | 2026-01-23 | Added Market/Region placeholders and Market/Region Source column |
| 1.2 | 2026-01-23 | Added Spend_Breakdown worksheet with granular subtype classification |

---

**End of Contract**
