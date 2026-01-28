# Focus Report Contract v0.1

**Document Version:** 0.1  
**Last Updated:** 2026-01-20  
**Owner:** WebOps (Mark Laufhutte)  
**System:** Venterra Property Analytics

---

## Purpose & Audience

**Primary Question:**  
"How are our Focus properties performing right now, and which ones require attention?"

**Audience:**  
Executive leadership and property management teams who need situational awareness without deep analysis.

**Intent:**  
This report is an **at-a-glance status board** for a curated set of Focus properties. It provides executive-level situational awareness, not alerts and not deep diagnostics.

**Safe to Forward:**  
This report must be safe to forward to leadership without additional explanation or context.

---

## Scope

### What This Report Includes

- **Focus Properties Only:** A curated list of properties defined in `config/focus_properties.yml`
- **All Focus Properties Always Shown:** Every property in the Focus list appears in every report (no filtering by performance)
- **Fixed KPI Strip:** Four metrics always displayed in the same order
- **Deterministic Status:** Green / Yellow / Red based on explicit rules
- **One Insight Line:** Single-sentence summary per property
- **Optional Watch Flags:** Shown only when deterministic triggers fire

### What This Report Does NOT Include

- Portfolio-level aggregates or comparisons
- Movers/shakers lists (top gainers/decliners)
- Tier classifications (minor/major movers)
- Multi-metric diagnostics
- Sparklines or trend visualizations
- "Why this appeared" debug metadata in rendered output
- Alert notifications or thresholds
- Competitive benchmarking
- Traffic source breakdowns
- Conversion funnel metrics

---

## Cadence

**Default Schedule:** Weekly (every Monday at 8:00 AM)  
**Configurable:** Can be run on-demand or scheduled differently via launchd/cron

**Report Date Logic:**  
- Current Week: Last complete 7 days ending yesterday
- Prior Week: Previous complete 7 days

---

## Data Sources

### Google Analytics 4 (GA4)
- **Metric:** Sessions
- **Data Lag:** 1 day (yesterday's data available today)
- **Table:** `ga4_daily_metrics`
- **Rollup:** 7-day sum for current and prior periods

### Google Search Console (GSC)
- **Metrics:** Organic Clicks, CTR, Average Position
- **Data Lag:** 3 days (use T-3 to T-10 for current week)
- **Table:** `gsc_daily_metrics`
- **Rollup:** 7-day sum/average for current and prior periods

### Insights Engine
- **Table:** `insights`
- **Purpose:** Provide structured insight lines and watch flag triggers
- **Filters:** Use only insights for Focus properties within the current week

---

## KPI Strip (Fixed Order)

The following four metrics are **always shown** for every Focus property, in this exact order:

1. **Sessions (WoW %)**
   - Current week total sessions
   - Week-over-week percentage change
   - Format: `1,234 sessions (+12.3%)`

2. **Organic Clicks (WoW %)**
   - Current week total organic clicks from GSC
   - Week-over-week percentage change
   - Format: `567 clicks (-5.2%)`

3. **CTR (WoW Δ)**
   - Current week average CTR
   - Week-over-week absolute change (not percentage)
   - Format: `4.5% CTR (+0.3pp)`

4. **Avg Position (WoW Δ)**
   - Current week average position
   - Week-over-week absolute change (negative = improved)
   - Format: `Pos 5.2 (-0.8)`

**Display Rules:**
- Use color coding: Green for improvements, Red for declines, Gray for neutral (<±2% or <0.2 position change)
- Always show absolute value + delta
- Format large numbers with commas
- Round percentages to 1 decimal place
- Round positions to 1 decimal place

---

## Status Rules (Deterministic)

Each property is assigned **one status** based on the following rules, evaluated in priority order:

### 🔴 Red (Requires Attention)
Trigger if **any** of these conditions are met:
1. Sessions declined ≥15% WoW AND absolute sessions <100
2. Organic Clicks declined ≥20% WoW
3. CTR declined ≥1.0pp WoW AND clicks >50
4. Position worsened ≥3.0 positions WoW

### 🟡 Yellow (Monitor)
Trigger if **any** of these conditions are met (and no Red triggers):
1. Sessions declined 10-14.9% WoW
2. Organic Clicks declined 10-19.9% WoW
3. CTR declined 0.5-0.99pp WoW
4. Position worsened 1.5-2.9 positions WoW
5. Mixed signals: One metric improved ≥15% while another declined ≥10%

### 🟢 Green (Performing Well)
All other cases (no Red or Yellow triggers)

---

## Insight Line Rules (Deterministic)

Each property displays **one insight line** (max 1 sentence, <80 characters). Select in priority order:

### Priority 1: Acceleration
- **Condition:** Sessions OR Clicks improved ≥20% WoW AND prior week also showed growth >5%
- **Template:** "Sustained growth momentum (Xth consecutive week)"

### Priority 2: Divergence
- **Condition:** Sessions and Clicks moved in opposite directions by ≥10%
- **Template:** "Traffic divergence: sessions [up/down], clicks [opposite direction]"

### Priority 3: Concentration
- **Condition:** CTR improved ≥0.5pp OR Position improved ≥1.5 positions
- **Template:** "Search visibility strengthening (CTR/Position gains)"

### Priority 4: Stable
- **Default:** If no other insights apply
- **Template:** "Steady performance, no significant changes"

**Insight Source:**
- Primary: Insights Engine (`insights` table) filtered for `property_id` and `generated_at` within report period
- Fallback: If no insights exist, generate using deterministic templates above based on KPI data

---

## Watch Flags (Optional, Deterministic)

Watch flags are **only shown** when a specific trigger condition is met. They appear below the Insight Line in a muted style.

### Flag Triggers

1. **"CTR erosion"**
   - CTR declined ≥0.5pp WoW for 2+ consecutive weeks

2. **"Ranking slip with volume"**
   - Position worsened ≥1.5 AND Impressions increased ≥10% (visibility paradox)

3. **"Demand softness"**
   - Sessions AND Clicks both declined ≥10% WoW

4. **"Low engagement signal"**
   - Sessions increased ≥10% BUT Engagement Rate declined ≥5pp (if available)

**Display Rules:**
- Show max 1 flag per property (highest priority)
- Use muted gray text, small font
- Format: `⚠️ Watch: [flag name]`

---

## Ordering Rules

Properties are displayed in **stable, consistent order** across all reports:

1. **Primary Sort:** Status (Red → Yellow → Green)
2. **Secondary Sort:** Alphabetical by property name

This ensures that properties requiring attention always appear at the top, and the order is predictable for regular readers.

---

## Debug Metadata Requirements

Every generated report includes a **JSON payload** alongside the HTML output. The JSON must contain:

- Report generation timestamp
- Data window definitions (current_week_start, current_week_end, prior_week_start, prior_week_end)
- Per-property payload with:
  - All KPI raw values and deltas
  - Status and triggering rule
  - Insight line and source (template ID or insight_id)
  - Watch flag and triggering condition (if shown)
- Data lag acknowledgments (GA4: 1 day, GSC: 3 days)
- Property count (should equal Focus list count)

**Purpose:** Governance, traceability, and debugging. Not rendered in HTML.

---

## HTML Output Requirements

### Outlook Compatibility
- Inline CSS only (no external stylesheets)
- Table-based layout for Outlook rendering
- Avoid flexbox, grid, or advanced CSS
- Base64-encoded images only (no external links)
- Test in Outlook 365 (Windows) and Apple Mail

### Styling Conventions
- Follow Portfolio Pulse color palette and typography
- Dark mode support via `prefers-color-scheme` media queries
- Mobile-responsive (single-column on narrow viewports)
- Print-friendly (remove backgrounds, use black text)

### Content Structure
1. Header (Venterra branding, report title, date)
2. Property cards (one per Focus property)
3. Footer (version, property count, contact)

---

## Archive Requirements

Every report execution must:
1. Create a dated folder: `reports/focus_report/YYYY-MM-DD/`
2. Write `focus_report.html` (rendered HTML)
3. Write `focus_report.json` (full payload)
4. Preserve existing archives (never overwrite)

**Retention:** Keep all archives indefinitely (no automatic cleanup).

---

## Version History

**v0.1 (2026-01-20):**
- Initial contract definition
- Four-KPI strip (Sessions, Clicks, CTR, Position)
- Three-tier status system (Red/Yellow/Green)
- Deterministic insight lines and watch flags
- Weekly cadence default

---

## Contract Change Control

**Who Can Modify:** Only Mark Laufhutte (WebOps) or designated system owner  
**Approval Required:** Yes, before implementation  
**Version Increment:** Any scope or logic change requires new version number  
**Breaking Changes:** Must not retroactively invalidate existing archives

---

## Exclusions (Explicit)

This report will **never** include:
- Real-time data (always uses completed time periods)
- Subjective quality assessments
- Competitive property comparisons
- Traffic source attribution beyond GA4 channel groups
- User behavior beyond engagement rate
- Revenue or conversion data
- Manual overrides or adjustments
- Properties outside the Focus list
- Aggregated portfolio-level KPIs in header

**Rationale:** Maintain simplicity, determinism, and executive-readiness.
