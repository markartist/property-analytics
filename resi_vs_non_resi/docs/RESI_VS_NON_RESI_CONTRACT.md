# Resi vs Non-Resi Conversion Efficiency Brief — Contract

**Version:** 1.0 (Exploratory Framework)  
**Date:** January 23, 2026  
**Status:** Baseline — Strengthens as Non-Resi cohort grows  
**Owner:** Mark Laufhutte

---

## Purpose

Establish a baseline framework for comparing conversion efficiency between Venterra properties on the Resi platform (venterraliving.com) versus Venterra properties on standalone domains, using a 30-day rolling window.

**This is an exploratory, directional comparison designed to:**
- Validate the measurement framework
- Establish baseline metrics for both cohorts
- Provide a repeatable methodology that becomes more robust as the Non-Resi cohort expands

**This brief does NOT:**
- Make conclusive claims about platform superiority
- Support executive decision-making without additional data
- Substitute for statistical significance testing

---

## Critical Limitation: Cohort Size

### Current State (January 2026)
- **Resi Cohort:** N=88 properties (robust)
- **Non-Resi Cohort:** N=3 properties (insufficient for inference)

### Implications
With only 3 Non-Resi properties:
- **Medians are unreliable** (middle value of 3 data points)
- **No statistical significance** possible
- **High sensitivity to outliers** (single property can dominate)
- **Cannot substantiate conversion efficiency claims**

### Governance Position
This brief is positioned as an **exploratory framework** that:
- Documents the methodology
- Reports observed directional trends
- Explicitly flags insufficient cohort size
- Becomes stronger as more properties launch on standalone domains

---

## Cohort Definitions

### Cohort A: Resi Properties
**Criteria:**
- Hosted on venterraliving.com domain
- Valid GA4 property ID
- Valid GSC site URL
- Active during 30-day window

**Count:** 88 properties

**Platform Characteristics:**
- Unified Resi platform
- 14 intent events tracked (vs 10 for default)
- Centralized hosting and optimization

### Cohort B: Non-Resi Properties
**Criteria:**
- Hosted on standalone domain (not venterraliving.com)
- Valid GA4 property ID
- Valid GSC site URL
- Active during 30-day window

**Count:** 3 properties
1. Camber Ridge (camberridgeapartments.com)
2. The Delta Pearland (thedeltapearland.com)
3. Monteverde (monteverdesatx.com)

**⚠️ Insufficient for statistical inference**

---

## Time Window

**Rolling 30 days** from run date, respecting known data lags:
- **GA4:** 1-day lag (yesterday's data)
- **GSC:** 3-day lag (T-3 data)
- **Google Ads:** Standard attribution delay
- **PageSpeed Insights:** Best-effort CrUX availability

Applied consistently across both cohorts.

---

## Metrics & Conversion Proxies

All metrics computed at property level first, then aggregated to **cohort medians**.

### A) SERP-Level Conversion (Primary)
**Source:** Google Search Console  
**Window:** Last 30 days (T-3 to T-33)

| Metric | Purpose |
|--------|---------|
| Impressions | Search visibility volume |
| Clicks | Demand capture volume |
| **CTR** | **Primary signal: SERP conversion efficiency** |
| Average Position | Context only (not conversion proxy) |

**Interpretation:** Higher CTR = more efficient conversion of search visibility into clicks.

### B) On-Site Conversion Proxies (Primary)
**Source:** Google Analytics 4  
**Window:** Last 30 days (T-1 to T-31)

| Metric | Purpose |
|--------|---------|
| Sessions | Traffic volume |
| Engaged Sessions | Quality traffic volume |
| **Engagement Rate** | **engaged_sessions / sessions** |
| **Meaningful Actions per Session** | **intent_events / sessions** |

**Intent Events Framework:**
- Use registry-defined intent events
- Resi properties: 14 events (apply_cta, contact_form, phone_call, email, schedule_tour, check_availability, floor_plan_details, brochure_download, resident_portal, pay_online, price_quote, directions, pdf_download, 3d_tour)
- Non-Resi properties: 10 events (first 10 from above list, if tracked)
- Do NOT invent or infer events

**Interpretation:** Higher engagement rate + more meaningful actions per session = stronger on-site conversion efficiency.

### C) Paid Traffic Efficiency (Supporting)
**Source:** Google Ads + GA4  
**Window:** Last 30 days

| Metric | Purpose |
|--------|---------|
| Spend ($) | Paid investment |
| Clicks | Paid traffic volume |
| CPC ($) | Cost efficiency |
| **Meaningful Actions per Paid Click** | **intent_events / paid_clicks** |
| **Meaningful Actions per Dollar** | **intent_events / spend** |

**Inclusion Criteria:**
- Only properties with reliable Google Ads ↔ GA4 linkage
- Exclude properties without attribution from paid comparisons
- Log exclusions

**Interpretation:** More meaningful actions per paid click/dollar = stronger paid conversion efficiency.

### D) Site Health (Supporting)
**Source:** PageSpeed Insights / CrUX Field Data  
**Window:** Best-effort (last available)

| Metric | Threshold ("Good") |
|--------|-------------------|
| **LCP (p75)** | ≤2.5s |
| **INP (p75)** | ≤200ms |
| **CLS (p75)** | ≤0.1 |
| **% Passing All CWV** | All 3 "Good" |

**Best-Effort Policy:**
- Exclude properties without CrUX field data
- Report coverage counts
- Do NOT block brief generation

**Interpretation:** Better Core Web Vitals = reduced friction = supports conversion (not primary signal).

---

## Data Integrity & Exclusions

### Volume Gates (Enforced)
- **Sessions:** ≥50/day (T30 avg) for engagement rate
- **Clicks:** ≥10/day (T30 avg) for CTR analysis
- **Paid Spend:** ≥$100 total for paid efficiency

### Exclusion Reasons (Logged)
1. Missing GA4 property ID
2. Missing GSC site URL
3. Insufficient traffic volume
4. Missing CrUX field data (CWV only)
5. Missing Google Ads ↔ GA4 linkage (paid only)

### Guardrails
- **Use medians** (not averages)
- **Do NOT relax gates**
- **Do NOT backfill data**
- **Do NOT infer missing data**
- **Log all exclusions explicitly**

---

## Deliverable Format

### Executive Brief (HTML)
**Structure:**
1. **Header:**
   - Title: "Resi vs Non-Resi — Exploratory Comparison (30-Day)"
   - Subtitle: "Baseline Framework — Strengthens as Non-Resi Cohort Grows"
   - Run date
   - **Prominent cohort size disclaimer**

2. **Cohort Summary:**
   - Resi: N=88 (robust)
   - Non-Resi: N=3 (insufficient for inference)
   - Coverage counts per metric

3. **Executive Scorecard (Medians):**
   - SERP CTR
   - Engagement Rate
   - Meaningful Actions per Session
   - Paid Efficiency (if available)
   - CWV Pass Rate
   - Columns: Resi Median | Non-Resi Median | Directional Indicator
   - **No rankings, no scores**

4. **Narrative (Conservative):**
   - 2-3 sentences
   - Acknowledge cohort size limitation
   - Frame as directional, exploratory
   - Avoid superiority claims

5. **Guardrails & Interpretation:**
   - Medians used
   - Volume gates enforced
   - Conversion proxies (not leases)
   - Cohort size limitation explicit
   - Framework strengthens with cohort growth

### Artifacts
- `resi_vs_non_resi_brief.html` (executive)
- `resi_vs_non_resi_brief.json` (full debug/trace)
- `appendix_resi_vs_non_resi.xlsx` (property-level data, coverage, exclusions)

---

## Email Delivery

**Subject:** Exploratory — Resi vs Non-Resi Baseline (30-Day)  
**Recipient:** mlaufhutte@venterraliving.com  
**Credentials:** Existing PIB email infrastructure

---

## Explicit Non-Goals

❌ Do NOT claim platform superiority  
❌ Do NOT make conclusive conversion efficiency claims  
❌ Do NOT compare to external competitors  
❌ Do NOT rank properties  
❌ Do NOT use averages  
❌ Do NOT relax integrity gates  
❌ Do NOT introduce subjective scoring  
❌ Do NOT claim lease conversion impact  

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-23 | Initial exploratory framework — N=3 Non-Resi cohort |

---

**End of Contract**
