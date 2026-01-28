# Resi vs Legacy Site Experience — Conversion Efficiency Brief Contract

**Version:** 1.0  
**Date:** January 23, 2026  
**Owner:** Mark Laufhutte  
**Status:** Production-Ready Framework

---

## Purpose

Compare conversion efficiency between Venterra properties on the **Resi site experience** versus properties on the **Legacy site experience**, using a 30-day rolling window.

**This brief demonstrates:**
- Measurable conversion efficiency differences between site experiences
- Impact of Resi platform features on demand capture and on-site conversion
- Framework validates as both cohorts represent meaningful sample sizes

**This brief does NOT:**
- Compare to external competitors
- Claim lease conversion impact
- Rank individual properties
- Use subjective scoring

---

## Cohort Definitions

### Cohort A: Resi Site Experience
**Criteria:**
- `site_type = "resi"` in property registry
- Valid GA4 property ID
- Valid GSC site URL
- Active during 30-day window

**Count:** N=4 properties
1. Camber Ridge (camberridgeapartments.com)
2. The Delta Pearland (thedeltapearland.com)
3. Cendana District West
4. Monteverde (monteverdesatx.com)

**⚠️ Small but growing cohort — results directional**

**Platform Characteristics:**
- Resi site experience and features
- 14 intent events tracked
- Modern UX/UI patterns

### Cohort B: Legacy Site Experience
**Criteria:**
- `site_type = missing/null` in property registry
- Valid GA4 property ID
- Valid GSC site URL  
- Active during 30-day window

**Count:** N=87 properties (robust)

**Platform Characteristics:**
- Legacy site experience
- 10 intent events tracked (default)
- Older templates and UX patterns

---

## Time Window

**Rolling 30 days** from run date, respecting known data lags:
- **GA4:** 1-day lag (T-1 to T-31)
- **GSC:** 3-day lag (T-3 to T-33)
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
| **CTR (%)** | **Primary: SERP conversion efficiency** |
| Average Position | Context only |

**Volume Gate:** ≥300 clicks total (30 days)

### B) On-Site Conversion Proxies (Primary)
**Source:** Google Analytics 4  
**Window:** Last 30 days (T-1 to T-31)

| Metric | Purpose |
|--------|---------|
| Sessions | Traffic volume |
| Engaged Sessions | Quality traffic volume |
| **Engagement Rate (%)** | **engaged_sessions / sessions** |
| **Meaningful Actions per Session** | **intent_events / sessions** |

**Intent Events Framework:**
- **Resi properties (14 events):** apply_cta, contact_form, phone_call, email, schedule_tour, check_availability, floor_plan_details, brochure_download, resident_portal, pay_online, **price_quote, directions, pdf_download, 3d_tour**
- **Legacy properties (10 events):** First 10 events from above list
- Use registry-defined events only (no invention or inference)

**Volume Gate:** ≥1,500 sessions total (30 days)

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

**Inclusion:** Only properties with reliable Google Ads ↔ GA4 linkage  
**Volume Gate:** ≥$500 spend total (30 days)

### D) Site Health (Supporting)
**Source:** PageSpeed Insights / CrUX Field Data  
**Window:** Best-effort (last available)

| Metric | Threshold ("Good") |
|--------|-------------------|
| **LCP (p75)** | ≤2.5s |
| **INP (p75)** | ≤200ms |
| **CLS (p75)** | ≤0.1 |
| **% Passing All CWV** | All 3 "Good" |

**Best-Effort Policy:** Exclude properties without CrUX field data

---

## Data Integrity & Exclusions

### Volume Gates (Enforced)
- **GSC:** ≥300 clicks total (30 days)
- **GA4:** ≥1,500 sessions total (30 days)
- **Paid:** ≥$500 spend total (30 days)

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
   - Title: "Resi vs Legacy Site Experience — Conversion Efficiency (30-Day)"
   - Run date
   - Cohort sizes: Resi (N=4, directional), Legacy (N=87, robust)

2. **Cohort Summary:**
   - Resi: N=4 (small but growing)
   - Legacy: N=87 (robust baseline)
   - Coverage counts per metric

3. **Executive Scorecard (Medians):**
   - SERP CTR (%)
   - Engagement Rate (%)
   - Meaningful Actions per Session
   - Paid Actions per Click (if available)
   - Paid Actions per Dollar (if available)
   - CWV Pass Rate (%)
   
   **Columns:**
   - Resi Median
   - Legacy Median
   - Directional Indicator ("Resi stronger" / "Comparable" / "Legacy stronger")
   
   **No rankings, no composite scores**

4. **Executive Narrative (2-3 sentences):**
   - Deterministic, evidence-based
   - Acknowledge Resi cohort size (N=4)
   - Frame as directional with strengthening as cohort grows
   - Measured language, avoid absolute claims

5. **Guardrails & Interpretation:**
   - Medians used
   - Volume gates enforced
   - Conversion proxies (not leases)
   - Internal portfolio comparison
   - Small Resi cohort noted

### Artifacts
- `resi_vs_legacy_brief.html` (executive)
- `resi_vs_legacy_brief.json` (full debug/trace)
- `appendix_resi_vs_legacy.xlsx` (property-level data, coverage, exclusions)

---

## Email Delivery

**Subject:** PIB — Resi vs Legacy Conversion Efficiency (30-Day)  
**Recipient:** mlaufhutte@venterraliving.com  
**Credentials:** Existing PIB email infrastructure

---

## Cohort Size Consideration

**Resi Cohort (N=4):**
- Small but sufficient for directional insights
- Medians are interpretable (unlike N=3)
- Framework strengthens as more properties migrate to Resi
- Results positioned as "early indicators" rather than conclusive proof

**Legacy Cohort (N=87):**
- Robust baseline for comparison
- Medians are statistically stable
- Represents mature legacy experience

**Interpretation:**
- Directional trends are valid
- Statistical significance testing not appropriate (small N)
- Frame as "emerging pattern" that validates with cohort growth

---

## Explicit Non-Goals

❌ Do NOT compare to external competitors  
❌ Do NOT claim lease conversion superiority  
❌ Do NOT rank properties  
❌ Do NOT use averages  
❌ Do NOT relax integrity gates  
❌ Do NOT introduce subjective scoring  
❌ Do NOT claim statistical significance with N=4

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-23 | Initial framework — Resi (N=4) vs Legacy (N=87) |

---

**End of Contract**
