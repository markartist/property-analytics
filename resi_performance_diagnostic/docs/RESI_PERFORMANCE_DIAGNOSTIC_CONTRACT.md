# RESI PERFORMANCE DIAGNOSTIC — CONTRACT DOCUMENT

**Version**: 1.0  
**Created**: 2026-01-23  
**Framework**: Atlas Governed Execution

---

## 1. OBJECTIVE

This diagnostic evaluates Resi site performance by **explicitly separating conversion efficiency from demand visibility/ramp health**.

### What This Report Can Claim
- Conversion efficiency for Resi properties with sufficient organic demand
- Visibility and ramp health for all Resi properties
- Whether underperformance is driven by conversion failure vs. demand constraints

### What This Report Cannot Claim
- Resi superiority over Legacy (no comparison)
- Portfolio-wide performance (only Resi properties)
- Statistical significance (N is small by design)

---

## 2. TIME WINDOW

**Rolling last 30 days** with respect to data source lags:
- **GA4**: T-1 (1-day lag)
- **GSC**: T-3 (3-day lag)
- **Google Ads**: T-1 (standard lag)
- **CWV (PageSpeed Insights)**: Best-effort (latest CrUX data)

---

## 3. PROPERTY SCOPE

### Resi Properties (All)
Include all properties identified as Resi via:
- Property registry `site_type = "resi"` field
- Expected: Camber Ridge, The Delta Pearland, Cendana District West, Monteverde

**No global exclusions** — properties excluded per-section based on volume gates only.

---

## 4. REPORT STRUCTURE

### SECTION A — CONVERSION EFFICIENCY (HIGH CONFIDENCE)

**Inclusion Rule**: Properties passing GSC organic volume gate (≥300 clicks in 30 days)

**Metrics**:
- **SERP CTR** (GSC)
- **Average Position** (GSC, context only)
- **Engagement Rate** (GA4: engaged_sessions / sessions)
- **Meaningful Actions per Session** (GA4 intent events / sessions)
- **Paid Efficiency** (optional, if Ads ↔ GA4 linkage exists)

**Output**:
- Property-level scorecard (no medians, small N)
- Statement: "These results represent Resi performance when sufficient demand exists."

### SECTION B — VISIBILITY & RAMP HEALTH (DIRECTIONAL)

**Inclusion Rule**: All Resi properties, regardless of volume

**Metrics**:
- **GSC Impressions** (30-day)
- **GSC Clicks** (30-day)
- **Click Velocity** (clicks per day)
- **Days Since Tracking Start** (first GSC data date to present)
- **CWV Status** (LCP ≤ 2.5s, FID ≤ 100ms, CLS ≤ 0.1)
- **Engagement Rate** (if ≥1,500 sessions)

**Classification Logic** (Deterministic):

1. **Conversion-Ready**
   - Passed volume gate (≥300 clicks)
   - Has sufficient data for conversion analysis

2. **Ramp-Stage**
   - < 45 days since tracking start
   - Positive click velocity trend
   - Building visibility

3. **Visibility-Constrained**
   - ≥ 60 days tracked
   - Low clicks (< 300)
   - Low velocity (< 5 clicks/day)

**Thresholds** (No Subjective Judgment):
- Days tracked: Based on first GSC metric_date
- Click velocity: Total clicks / days tracked
- CWV pass: All three metrics pass "Good" thresholds

---

## 5. INTEGRITY & GUARDRAILS

### Mandatory Rules
- ✅ **Do not relax volume gates**
- ✅ **Do not infer missing data**
- ✅ **Do not compute medians where N is insufficient**
- ✅ **Log all exclusions with reasons**
- ✅ **Explicitly state what data can and cannot support**

### Data Quality Gates
- **GSC Volume Gate**: ≥300 clicks (30 days)
- **GA4 Volume Gate**: ≥1,500 sessions (30 days)
- **CWV**: Best-effort (no volume gate, report if available)

### Exclusions
- Section A: Properties below GSC volume gate
- Section B: No exclusions (all properties included)
- Log all exclusion reasons in JSON artifact

---

## 6. DELIVERABLES

### HTML Executive Brief
**File**: `resi_performance_diagnostic.html`

**Structure**:
1. **Header**
   - Title: "Resi Performance Diagnostic — Conversion Efficiency & Demand Ramp"
   - Date
   - Property count summary

2. **Section A: Conversion Efficiency (When Demand Exists)**
   - Property-level scorecard
   - 1–2 sentence deterministic narrative

3. **Section B: Visibility & Ramp Health**
   - Table with columns:
     - Property
     - Days Tracked
     - Clicks (30d)
     - Click Velocity
     - CWV Status
     - Classification
   - Executive interpretation

**Style**: Outlook-safe HTML (inline CSS, no external dependencies)

### Excel Appendix
**File**: `resi_performance_diagnostic.xlsx`

**Contents**:
- Mirror Section B table for operational use
- Property-level data with formulas for click velocity
- Classification logic documented in Notes sheet

### JSON Debug Artifact
**File**: `resi_performance_diagnostic.json`

**Contents**:
- Property-level data (all metrics)
- Classifications with reasoning
- Exclusions with reasons
- Metadata (run date, time windows, thresholds)

---

## 7. EXPLICIT NON-GOALS

**Do NOT**:
- Compare to Legacy or external competitors
- Claim portfolio-wide superiority
- Relax volume gates
- Normalize weak data
- Create composite scores
- Make subjective performance judgments

---

## 8. CLASSIFICATION EXAMPLES

### Example 1: Camber Ridge
- **Days Tracked**: 126
- **Clicks (30d)**: 578
- **Click Velocity**: 18.6 clicks/day
- **Classification**: **Conversion-Ready** (≥300 clicks)

### Example 2: Monteverde
- **Days Tracked**: 22
- **Clicks (30d)**: 150
- **Click Velocity**: 6.8 clicks/day
- **Classification**: **Ramp-Stage** (< 45 days tracked)

### Example 3: Cendana District West
- **Days Tracked**: 126
- **Clicks (30d)**: 9
- **Click Velocity**: 0.3 clicks/day
- **Classification**: **Visibility-Constrained** (≥60 days, < 300 clicks, low velocity)

---

## 9. MAINTENANCE & VERSIONING

**Version History**:
- v1.0 (2026-01-23): Initial diagnostic framework

**Update Triggers**:
- New Resi properties added to registry
- Classification thresholds need adjustment (document changes)
- Data source schema changes

---

**Contract Approved**: Atlas Execution Engine  
**Implementation**: Generate via `scripts/generate_resi_diagnostic_brief.py`
