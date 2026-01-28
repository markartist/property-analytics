# Resi vs Portfolio Comparative Performance Analysis

**Project Type:** Ad Hoc Comparative Performance Report  
**Analysis Period:** 15-day rolling window (Jan 12-24, 2026 initial run)  
**Status:** Completed - Delivered 2026-01-27  
**Owner:** Mark Laufhutte  
**Deliverables:** HTML report + CSV data spreadsheet

---

## Overview

Comparative performance analysis evaluating Resi-hosted properties against matched Portfolio properties using a matched-pairs design to determine relative performance and conversion effectiveness.

---

## Critical Learnings & Pitfalls

### 🔴 CONVERSION CALCULATION ERRORS (CRITICAL!)

**PROBLEM:** Initial analysis showed Portfolio converting 3-4x WORSE than Resi, which was completely inverted.

**ROOT CAUSE:** Used wrong events for Portfolio CIR calculation:
- ❌ **WRONG:** Only used `form_submit` event
- ✅ **CORRECT:** Must use `pricequote_click`, `applyonline_click`, `scheduletour_click`

**IMPACT:** Complete inversion of conclusions - actual finding is Portfolio converts 2-4x BETTER than Resi.

### Event Mapping (NEVER FORGET THIS!)

```python
# Resi Properties
RESI_CONVERSION_EVENTS = [
    'resi_price_quote',
    'resi_application_start', 
    'resi_apt_tour_click'
]

# Portfolio Properties  
PORTFOLIO_CONVERSION_EVENTS = [
    'pricequote_click',
    'applyonline_click',
    'scheduletour_click'
]

# DO NOT USE 'form_submit' alone for Portfolio - captures ALL forms!
```

**Code Location:** Lines 26-36 in `resi_phase2_CORRECTED.py`

---

## Property Configuration

### Resi Properties (4 total, 3 operational)

| Property | Property ID | Domain | Status |
|----------|-------------|--------|--------|
| Camber Ridge | 445473253 | camberridgeapartments.com | Operational |
| The Delta Pearland | 441503068 | thedeltapearland.com | Operational |
| Cendana District West | 424416990 | cendanalife.com | Operational |
| Monteverde | 488649687 | monteverdesatx.com | Pre-opening (EXCLUDE) |

### Portfolio Match Pool
- **Total:** 87 non-Resi properties
- **Exclusion Logic:** All properties with domains in `RESI_DOMAINS` array excluded from matching
- **Validation:** Zero Resi-to-Resi comparisons (critical requirement)

---

## Matching Algorithm

### Weights (100 points total)
1. **Metro Match** (40 pts) - Same metropolitan area
2. **Unit Similarity** (30 pts) - Within 20% unit count
3. **Traffic Similarity** (20 pts) - Within 50% session volume
4. **GBP Data Availability** (10 pts) - Both have or both lack GBP data

### Minimum Threshold
- 50 points required for valid match
- Each Resi property matched to 2 best Portfolio peers

### Top Matches Generated

**Camber Ridge (Houston):**
- Luma Headwaters (378404769) - Score: 80
- Avasa Grove West (426692912) - Score: 75

**The Delta Pearland (Houston):**
- Luma Headwaters (378404769) - Score: 78
- Gateway North (378713160) - Score: 73

**Cendana District West (Houston):**
- Gateway North (378713160) - Score: 82
- Luma Headwaters (378404769) - Score: 76

---

## Analysis Framework

### Categories (5 total)

1. **Demand Generation**
   - Metrics: Sessions, Users, GSC Impressions
   - Winner: Higher total sessions

2. **Engagement**
   - Metrics: Engagement Rate, Avg Session Duration, Pageviews
   - Winner: Higher engagement rate

3. **Intent & Conversion**
   - Metrics: CIR (%), Conversions, GSC CTR
   - Winner: Higher CIR

4. **Performance**
   - Metrics: PSI Performance Score, LCP, CLS
   - Winner: Higher PSI mobile performance score

5. **Trust Context**
   - Metrics: GBP Actions/Day, Avg Rating
   - Winner: Higher GBP actions/day

### Winner Logic
- **ALWAYS declare a winner** - no "Mixed" for differences >3 percentage points
- Overall winner: Property that wins ≥3/5 categories
- If 2-3 split: Report "No Clear Winner" with category breakdown

---

## Data Requirements

### Analysis Window
- **Recommended:** 15 days (provides 87%+ coverage)
- **Initial run:** Jan 12-24, 2026
- **Rolling:** Always use `date('now', '-15 days')` for current analysis

### Coverage Thresholds

| Source | Expected Days | Required Coverage |
|--------|---------------|-------------------|
| GA4 | 15/15 | ≥85% (13+ days) |
| GSC | 12/12* | ≥85% (10+ days) |
| PSI | 15/15 | ≥80% (12+ days) |
| GBP | 15/15 | ≥80% (12+ days) |

*GSC has 3-day API lag, so 12 days available in 15-day window

### Data Quality Gates
- Validate completeness before analysis
- Document gaps in Data Caveats section
- Do NOT dismiss data sources as "too limited" if above thresholds

---

## Implementation

### Core Script
**File:** `/Users/mark/Property_Analytics/resi_phase2_CORRECTED.py`

**Key Configuration:**
```python
ANALYSIS_WINDOW_DAYS = 15  # Line 24

RESI_DOMAINS = [  # Lines 18-23
    'cendanalife.com',
    'camberridgeapartments.com', 
    'thedeltapearland.com',
    'monteverdesatx.com'
]

CONVERSION_EVENTS_RESI = [  # Lines 26-30
    'resi_price_quote',
    'resi_application_start',
    'resi_apt_tour_click'
]

CONVERSION_EVENTS_PORTFOLIO = [  # Lines 32-36
    'pricequote_click',
    'applyonline_click', 
    'scheduletour_click'
]
```

**Critical Functions:**
- `get_property_matches()` - Lines 85-180 (matching algorithm)
- `calculate_cir()` - Lines 359-376 (dynamic event selection based on is_resi flag)
- `generate_html_report()` - Lines 600+ (report generation)

### Execution
```bash
cd /Users/mark/Property_Analytics
python3 resi_phase2_CORRECTED.py
```

### Outputs
- **HTML Report:** `reports/resi_comparison/resi_vs_portfolio_CORRECTED_FINAL_YYYY-MM-DD.html`
- **CSV Data:** `reports/resi_comparison/resi_vs_portfolio_data_YYYY-MM-DD.csv`

---

## Delivery Process

### Report Structure (CRITICAL!)
**Executive Summary FIRST:**
1. Overall findings
2. Key metrics summary 
3. Category winners
4. Synthesis & recommendations

**Then supporting data:**
5. Match methodology
6. Per-property detailed analysis
7. Data caveats

### Email Delivery
```python
from utils.email_sender import EmailSender

sender = EmailSender()
sender.send_email(
    subject='Ad Hoc Comparative Performance Report – Resi vs Portfolio (Corrected) - YYYY-MM-DD',
    html_body=html_content,
    recipients=['mlaufhutte@venterraliving.com'],
    attachments=[
        ('resi_vs_portfolio_data_YYYY-MM-DD.csv', csv_bytes, 'text/csv')
    ]
)
```

**Email Configuration:** Uses `/Users/mark/Property_Analytics/credentials/email_config.json`

---

## Final Validated Results

### Jan 12-24, 2026 Analysis

**Camber Ridge vs Portfolio:**
- Portfolio wins: 5/5 categories
- CIR: 0.24% (Resi) vs 0.58% (Portfolio) = Portfolio 2.4x better

**The Delta Pearland vs Portfolio:**
- Portfolio wins: 3/5 categories  
- CIR: 0.16% (Resi) vs 0.58% (Portfolio) = Portfolio 3.6x better

**Cendana District West vs Portfolio:**
- Portfolio wins: 4/5 categories
- CIR: 0.54% (Resi) vs 0.58% (Portfolio) = Competitive

**Overall Finding:**
Portfolio wins 12/15 category comparisons (80%). Portfolio properties convert 2-4x better than Resi.

**Portfolio Baseline:** 0.627% CIR (553 conversions / 88,172 sessions across 87 properties)

---

## Common Mistakes to Avoid

### ❌ DON'T:
1. Use `conversions` column from `ga4_daily_metrics` (always 0)
2. Use `form_submit` event alone for Portfolio CIR
3. Match Resi properties to other Resi properties
4. Include Monteverde in operational property comparisons
5. Reference analysis window as 30 days when using 15
6. Declare "Mixed" winners for differences >3 percentage points
7. Dismiss data sources as "too limited" without checking coverage
8. Use wrong date references in analysis text (e.g., "through Dec 31" when window is Jan 12-24)
9. Put detailed data before executive summary

### ✅ DO:
1. Use `ga4_event_facts` table with proper event mappings for CIR
2. Validate zero Resi-to-Resi matches in output
3. Exclude all RESI_DOMAINS from portfolio match pool
4. Document actual analysis window dates in report
5. Always declare category winners (no "Mixed" for >3pt differences)
6. Validate data coverage before generating conclusions
7. Include GBP metrics when coverage meets thresholds
8. Lead with executive summary, supporting data below

---

## Future Enhancements

### Potential Additions:
- Weekly automated comparison tracking
- Trend analysis (compare current vs prior period)
- Cost per conversion if ad spend data becomes available
- Seasonal adjustment factors
- Metro-specific benchmarking

### Database Improvements Needed:
- Fix GA4 `conversions` column configuration
- Add metro/location field to property_metadata table
- Implement automated Resi property flagging in registry

---

## Version History

- **2026-01-27:** Initial project completion
  - Delivered corrected report with proper CIR calculations
  - 3 complete rebuilds required to fix critical errors:
    1. Resi-to-Resi matching bug
    2. Monteverde inclusion bug  
    3. Portfolio CIR event mapping error (most critical)
  - Final validated results: Portfolio converts 2-4x better than Resi
  - Documented all learnings and pitfalls for future runs
