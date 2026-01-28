# The Hotlist 🔥 - System Memory

## Overview
**The Hotlist** is a comprehensive executive showcase combining Focus (7 properties) and Spotlight (16 properties) cohorts into a single performance dashboard. It provides at-a-glance status assessment with rich diagnostics including traffic metrics, Core Web Vitals, device analytics, engagement, and traffic composition.

## System Identity
- **Name**: The Hotlist 🔥
- **Type**: Executive Comparative Showcase (one-off/ad-hoc)
- **Version**: 1.0
- **Status**: Active
- **Created**: 2026-01-21
- **Last Updated**: 2026-01-22

## Purpose
Unified monitoring dashboard for high-priority properties (Focus + Spotlight) with:
- Visual status grouping (Red/Yellow/Green)
- Week-over-week performance tracking with 7-day sparklines
- Comprehensive technical health (Core Web Vitals)
- Audience behavior insights (device mix, engagement, traffic sources)
- Cohort-level comparative analytics

## Architecture

### File Structure
```
focus_report/
├── scripts/
│   ├── generate_focus_vs_spotlight_showcase.py  # Main generator (782 lines)
│   └── send_hotlist_email.py                     # Email sender (107 lines)
├── reports/focus_report/YYYY-MM-DD/
│   ├── focus_vs_spotlight_showcase.html          # Visual report
│   └── focus_vs_spotlight_showcase.json          # Raw payload
└── THE_HOTLIST_MEMORY.md                         # This file
```

### Dependencies
- **Database**: `portfolio_analytics.db` (canonical)
- **Tables Used**:
  - `ga4_daily_metrics` - Sessions, 7-day sparklines
  - `gsc_daily_metrics` - Clicks, CTR, position
  - `ga4_device_metrics` - Mobile %, engagement rate
  - `ga4_traffic_sources` - Top channel identification
  - `pagespeed_metrics` - LCP, FID, CLS values
- **Property Registry**: `venterra_properties_official.json`
- **Shared Utilities**: `db_helper.py`, `preflight.py`
- **Libraries**: matplotlib (sparklines), requests (unused PSI API)

### Data Collection Fixes (2026-01-22)
**Critical Fix**: PageSpeed Insights data collection was incomplete
- **Issue**: `collect_daily_psi.py` only stored `lcp_value`, not `fid_value` or `cls_value`
- **Root Cause**: Storage SQL only included LCP column despite extraction logic collecting all three
- **Resolution**: Updated `store_psi_data()` function to write FID and CLS alongside LCP
- **Impact**: 178/180 records (98.9%) now have complete CWV data for 2026-01-21
- **File Modified**: `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py`

## Property Cohorts

### Focus Cohort (7 properties)
Strategic high-priority properties requiring intensive monitoring:
1. Botanic (→ Botanic Luxury)
2. Camber Ridge
3. CoHo
4. Oakleaf (→ The Villages at Oakleaf)
5. Spring Branch (→ Avasa Spring Branch)
6. Stonecreek (→ Stonecreek Ranch)
7. Thomas Glen (→ The Reserves of Thomas Glen)

### Spotlight Cohort (16 properties)
Emerging or strategic properties under enhanced observation:
1. Avasa at 1604
2. Anatole Daytona (→ The Anatole)
3. Apex (→ Apex West Midtown)
4. Belterra
5. Calais Midtown
6. Cane Island
7. Canton Mill Lofts
8. Elation (→ Elation at Grandway West)
9. Fairways (→ Fairways at South Shore)
10. Grand Harbor (→ The Cape at Grand Harbor)
11. Grove West (→ Avasa Grove West)
12. Luma Headwaters
13. Mayfield (→ Mission Mayfield Downs)
14. Northbridge (→ Northbridge at Millenia Lake)
15. Townhomes (→ Townhomes at Lake Park)
16. Trevesta (→ Trevesta Place)

**Total**: 23 properties combined

## Metrics Collected

### Traffic Metrics (WoW Comparison)
- **Sessions** (GA4): Current count, WoW %, 7-day sparkline
- **Clicks** (GSC): Current count, WoW %
- **CTR** (GSC): Current %, WoW delta (pp)
- **Position** (GSC): Current average, WoW delta

### Core Web Vitals (Latest Mobile Lab Data)
- **LCP** (Largest Contentful Paint): ms, thresholds (Good: ≤2500, NI: ≤4000, Poor: >4000)
- **FID** (First Input Delay): ms, thresholds (Good: ≤200, NI: ≤500, Poor: >500)
- **CLS** (Cumulative Layout Shift): ratio, thresholds (Good: ≤0.1, NI: ≤0.25, Poor: >0.25)

### Audience Insights (Current Week)
- **Mobile %**: Percentage of sessions from mobile devices (visual progress bar)
- **Engagement Rate**: Average engaged session rate (color-coded: 💚≥60%, 💛40-59%, 🔴<40%)
- **Top Traffic Channel**: Dominant channel (🔍 Organic Search, 💰 Paid Search, 🔗 Direct, etc.) with %

## Status Determination Logic

### Red (Requires Attention) - Critical Issues
- Sessions ≤-15% WoW AND <100 absolute
- Clicks ≤-20% WoW
- CTR ≤-1.0pp WoW AND clicks >50
- Position ≥+3.0 WoW (worse ranking)

### Yellow (Monitor) - Warning Signs
- Sessions -10% to -14.9% WoW
- Clicks -10% to -19.9% WoW
- CTR -0.5pp to -0.99pp WoW
- Position +1.5 to +2.9 WoW

### Green (Performing Well) - Default
- All other scenarios

## Visual Design

### Header
- **Background**: Venterra corporate navy (#15284B)
- **Title**: 🔥 The Hotlist 🔥 (28px, bold, white)
- **Subtitle**: Focus + Spotlight Properties (16px, white)
- **Date**: Current report date (12px, white)
- **Notation**: "All % changes are Week-over-Week" (10px, 70% opacity)

### Property Cards
- **Left Border**: 4px solid status color (red/yellow/green)
- **Cohort Badge**: Blue (Focus) or Orange (Spotlight) pill badge
- **Metrics Grid**: 2-column layout for traffic metrics
- **Sparkline**: 80x25px inline PNG, color-coded (green/red/gray)
- **CWV Row**: ⚡ icon with color-coded metrics
- **Mobile Bar**: Progress bar with percentage
- **Bottom Row**: Engagement heart emoji + traffic channel icon

### Sparklines (Matplotlib PNG)
- **Size**: 80x25 pixels
- **Color Logic**:
  - Green (#16a34a): Positive WoW growth
  - Red (#dc2626): Negative WoW decline
  - Gray (#9ca3af): Flat/neutral (<2% change)
- **Format**: Inline base64 PNG (email-safe)
- **Data**: 7 daily values (current week)

### Executive Scorecard
- Located below all property cards
- Bordered section with 📊 emoji
- Comparison table: Focus vs Spotlight medians
- Metrics: Sessions, Clicks, CTR, Position WoW + CWV (LCP, INP, CLS)
- Comparative signals: "Focus stronger", "Spotlight stronger", "Comparable"
- Executive narrative: 2-3 sentence summary

## Data Windows

### GA4 Metrics (1-day lag)
- **Current Week**: 7 days ending yesterday
- **Prior Week**: 7 days ending 8 days ago
- **Example**: Report on 2026-01-22 uses data through 2026-01-21

### GSC Metrics (3-day lag)
- **Current Week**: 7 days ending 3 days ago
- **Prior Week**: 7 days ending 10 days ago
- **Example**: Report on 2026-01-22 uses data through 2026-01-19

### PageSpeed Metrics
- **Latest Available**: Most recent mobile strategy test per property
- **Update Frequency**: Daily (via `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py`)

## Usage

### Generate Report
```bash
cd /Users/mark/Property_Analytics/focus_report
python3 scripts/generate_focus_vs_spotlight_showcase.py
```

**Output**:
- HTML: `reports/focus_report/YYYY-MM-DD/focus_vs_spotlight_showcase.html`
- JSON: `reports/focus_report/YYYY-MM-DD/focus_vs_spotlight_showcase.json`

### Send Email
```bash
python3 scripts/send_hotlist_email.py [--report-html PATH]
```

**Email Configuration** (environment variables):
- `REPORT_SENDER_EMAIL`: Sender address (default: mlaufhutte@venterraliving.com)
- `REPORT_RECIPIENT_EMAIL`: Recipients (comma-separated)
- `REPORT_PASSWORD_FILE`: Path to password file

**Email Subject**: "🔥 The Hotlist — [Date]"

## Key Differences from Focus Report

| Aspect | Focus Report | The Hotlist |
|--------|--------------|-------------|
| Properties | 23 Focus properties | 7 Focus + 16 Spotlight |
| Grouping | Single list by status | Status sections + cohort badges |
| Insights | Property-level insight text | Removed (cleaner cards) |
| Watch Flags | CTR erosion, ranking slip, etc. | Removed (visual status sufficient) |
| Sparklines | None | 7-day matplotlib PNG sparklines |
| Device Data | None | Mobile % progress bar |
| Engagement | None | Engagement rate with emoji |
| Traffic Source | None | Top channel with icon + % |
| CWV Data | None | LCP, FID, CLS with color-coding |
| Scorecard | None | Focus vs Spotlight comparison |
| Narrative | None | Executive summary |
| Purpose | Operational monitoring | Executive comparative analysis |

## Recent Changes

### 2026-01-22: Complete System Build
1. **Initial Creation**
   - Built from Focus Report base
   - Added Spotlight cohort (16 properties)
   - Integrated Core Web Vitals from pagespeed_metrics table

2. **CWV Data Integrity Fix**
   - Discovered FID/CLS values were NULL despite LCP being collected
   - Fixed `collect_daily_psi.py` storage function to write all three metrics
   - Re-ran collection for 2026-01-21 → 178/180 complete records

3. **Enhanced Metrics Addition**
   - Added device breakdown queries (mobile %, engagement rate)
   - Added traffic source queries (top channel identification)
   - Integrated 7-day sparkline data collection

4. **Visual Polish**
   - Renamed from "Focus vs Spotlight Showcase" to "The Hotlist 🔥"
   - Changed header from red gradient to Venterra corporate navy (#15284B)
   - Attempted logo embedding (base64) - removed due to email rendering issues
   - Added "All % changes are Week-over-Week" notation to header
   - Upgraded from Unicode sparklines (▁▂▃▄▅▆▇█) to matplotlib PNG sparklines
   - Styled property cards with cohort badges, mobile progress bars, engagement emojis, channel icons

5. **Email Delivery**
   - Created `send_hotlist_email.py` based on Focus Report email sender
   - Subject line: "🔥 The Hotlist — [Date]"
   - Successfully delivered with all inline graphics (sparklines, progress bars)

## Status Distribution (2026-01-21 Report)
- **Red (Requires Attention)**: 9 properties
- **Yellow (Monitor)**: 4 properties
- **Green (Performing Well)**: 10 properties

## Executive Scorecard Results (2026-01-21)

### Focus Cohort Medians
- Sessions WoW: -4.8%
- Clicks WoW: +14.8%
- CTR WoW: +0.39pp
- Position WoW: -1.72
- LCP p75: 7,700ms
- CLS p75: 0.054

### Spotlight Cohort Medians
- Sessions WoW: -9.4%
- Clicks WoW: -7.4%
- CTR WoW: +0.03pp
- Position WoW: -1.26
- LCP p75: 5,480ms
- CLS p75: 0.056

### Comparative Signals
- **Sessions**: Focus stronger
- **Clicks**: Focus stronger
- **CTR**: Focus stronger
- **Position**: Comparable
- **LCP**: Spotlight stronger (faster)
- **INP**: Insufficient data
- **CLS**: Comparable

## Future Enhancements (Potential)

### Data Additions
- [ ] INP (Interaction to Next Paint) when available in PageSpeed API
- [ ] Desktop CWV comparison alongside mobile
- [ ] Conversion data if available
- [ ] 4-week sparklines instead of 7-day (longer trend context)

### Visual Improvements
- [ ] Click-through sparklines (expand to full 30-day chart)
- [ ] Color-coded WoW percentage text (not just deltas)
- [ ] Property-level alerts/flags for critical issues
- [ ] Cohort summary cards above property lists

### Functionality
- [ ] Scheduled daily generation + email
- [ ] Historical archiving system
- [ ] Trend detection (consecutive week declines)
- [ ] Automated insights generation

## Notes
- This is a **showcase** system, not a production report class
- Designed for ad-hoc executive review, not daily operational monitoring
- For operational monitoring, use Focus Report (23 properties) or Portfolio Pulse (full portfolio)
- Sparkline generation adds ~2-3 seconds per property (matplotlib overhead) - acceptable for 23 properties
- Email rendering tested in Outlook (Office 365) - all graphics display correctly

## Contact
**System Owner**: Mark Laufhutte (WebOps)  
**Email**: mlaufhutte@venterraliving.com  
**Location**: `/Users/mark/Property_Analytics/focus_report/`

---
*Last Updated: 2026-01-22 01:03 UTC*  
*The Hotlist v1.0 - Venterra Living*
