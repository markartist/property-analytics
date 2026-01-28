# Resi vs Portfolio Comparison - REBUILD NOTE

**Date:** 2026-01-27  
**Status:** CORRECTED

---

## Why Previous Output Was Invalid

The previous Phase 2 report (dated 2026-01-27 14:39) was **fundamentally flawed**:

### Critical Error: Resi-to-Resi Comparisons
- **Cendana District West** was compared to **The Delta Pearland** (also a Resi property!)
- **The Delta Pearland** was compared to **Camber Ridge** (also a Resi property!)
- This created circular comparisons between Resi properties instead of Resi vs Portfolio comparisons

### Root Cause
- The matching algorithm in Phase 1.1 did not exclude other Resi properties from the candidate pool
- Phase 2 used Phase 1.1 results without validation
- No checks were in place to prevent Resi-to-Resi matches

---

## What Changed in This Rebuild

### 1. Hard Constraint: Resi Exclusion
- Explicitly tracked all 3 Resi property IDs: ['441503068', '445473253', '424416990', '488649687']
- Match candidate pool restricted to **88 portfolio properties only**
- Added validation check that fails if any Resi-to-Resi comparison is detected

### 2. Updated Match Results
**Before (INVALID):**
- Cendana: Delta Pearland (Resi!), Gateway North
- Camber Ridge: Monteverde, Luma Headwaters  
- Delta Pearland: Luma Headwaters, Camber Ridge (Resi!)

**After (CORRECT):**
- Cendana: Gateway North, Luma Headwaters (both portfolio)
- Camber Ridge: Monteverde, Luma Headwaters (both portfolio)
- Delta Pearland: Luma Headwaters, Gateway North (both portfolio)

### 3. Data Source Corrections
- Removed all GTMetrix references (not collected)
- Confirmed PSI collects daily (30/30 days expected, not 12/30)
- No changes to GA4, GSC, GBP collection patterns

---

## Validation Checks Implemented

### Pre-Delivery Checks (All Passed):
✅ Zero Resi-to-Resi comparisons confirmed  
✅ GTMetrix not referenced anywhere in report  
✅ Each Resi property compared only to portfolio peers  
✅ 3 Resi properties × 2 portfolio matches each = 6 valid comparisons  

---

## Remaining Data Caveats

### Conversion Data Issue
- All properties show CIR = 0 (GA4 conversion tracking requires investigation)
- This affects Intent/Conversion category winner determination

### GBP Data Limited
- Missing or incomplete across most properties
- Limits Trust Context analysis

### GSC 3-Day Lag
- Expected 27/27 days (not 30/30) due to API delay

---

**Generated:** 2026-01-27  
**Valid Comparisons:** Resi vs Portfolio only
