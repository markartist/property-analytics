# Resi vs Legacy Site Experience — Exploratory Brief

## Overview
This project generates an exploratory conversion efficiency comparison between **Resi** (N=4) and **Legacy** (N=87) site experiences using GSC, GA4, and Core Web Vitals metrics.

## Quick Start
```bash
cd /Users/mark/Property_Analytics/resi_vs_legacy_experience
python3 scripts/generate_exploratory_brief.py
```

## Output
- **HTML Brief**: `reports/resi_vs_legacy/YYYY-MM-DD/resi_vs_legacy_brief.html`
- **JSON Debug Artifact**: `reports/resi_vs_legacy/YYYY-MM-DD/resi_vs_legacy_brief.json`

## Metrics Included
1. **SERP CTR** (Google Search Console)
   - 30-day window with T-3 lag
   - Volume gate: ≥300 clicks
   - Coverage: Resi N=2, Legacy N=13

2. **Engagement Rate** (GA4)
   - 30-day window with T-1 lag
   - Volume gate: ≥1,500 sessions
   - Coverage: Resi N=4, Legacy N=52

3. **CWV Pass Rate** (PageSpeed Insights)
   - LCP ≤ 2.5s + CLS ≤ 0.1
   - Best-effort (latest data)
   - Coverage: Resi N=4, Legacy N=87

## Cohort Definitions
- **Resi**: Properties with `site_type = "resi"` in property registry
  - Camber Ridge
  - The Delta Pearland
  - Cendana District West
  - Monteverde

- **Legacy**: Properties with `site_type` missing/null
  - 87 properties on venterraliving.com subdirectories

## Guardrails
- **N=4 disclaimer**: Resi cohort is insufficient for statistical inference
- **Medians used**: Not averages
- **Conversion proxies**: SERP CTR, engagement rate, CWV (not lease conversions)
- **Internal comparison**: Venterra portfolio only (no competitors)

## Deferred Features
- Google Ads efficiency comparison
- Meaningful actions per session (requires event mapping validation)
- Excel appendix
- Email automation

## Dependencies
- Python 3.x
- SQLite3
- Property registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- Database: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

## Contract
See `docs/RESI_VS_LEGACY_CONTRACT.md` for full specifications.

## Version
v1.0 — Lean exploratory implementation (GSC + GA4 + CWV only)
