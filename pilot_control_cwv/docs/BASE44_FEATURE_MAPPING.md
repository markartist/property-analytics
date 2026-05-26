# Base44 Feature Mapping

## Purpose

This document treats the inherited Base44 app as a functional requirements source.
We should preserve the intent of what was built, even where we replace the implementation.

Source repo reviewed:
- `/tmp/guest-card-tracker-website-pilot-properties`

Primary page:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/pages/Dashboard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/pages/Dashboard.jsx)

## Key Principle

Do not copy the current app literally.
Do preserve the user-facing jobs it is trying to solve:
- compare pilot vs sister performance
- separate total volume from website-attributed behavior
- show trend, not just snapshot
- show benchmark and gap-closing context
- support operational drilldown

## Feature Inventory

### 1. Single Landing Dashboard

Current implementation:
- One main route at [`/tmp/guest-card-tracker-website-pilot-properties/src/App.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/App.jsx)
- Dashboard page at [`/tmp/guest-card-tracker-website-pilot-properties/src/pages/Dashboard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/pages/Dashboard.jsx)

Intent:
- give users one default place to start
- expose comparison and trend data immediately

Recommendation:
- Keep, but evolve into a true `Overview` page for the pilot program

New implementation:
- `Overview`
- `Core Web Vitals`
- `Traffic & Engagement`
- `Funnel`
- `Property Detail`
- `Report Archive`

Decision:
- `Adapt`

### 2. Tabbed Metric Modes

Current implementation:
- Tabs in [`/tmp/guest-card-tracker-website-pilot-properties/src/pages/Dashboard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/pages/Dashboard.jsx)
- Modes:
  - `Volumes: All Sources`
  - `Volumes: Website Source Only`
  - `Conversions: Website Source Only`

Intent:
- separate volume metrics from website-attributed funnel metrics
- make scope obvious to the user

Recommendation:
- Keep this separation, but express it as sections/pages instead of only tabs

New implementation:
- `Traffic & Engagement` page:
  - Organic Traffic as % of Unique Users
  - High Intent User Rate
- `Funnel` page:
  - Lead to AU
  - Price Quote
  - Schedule Tour
  - Completed Applications
  - Click to Call
  - Contact Form

Decision:
- `Keep and adapt`

### 3. Manual Guest Card Entry

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/AddGuestCardForm.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/AddGuestCardForm.jsx)
- writes to Base44 `GuestCard` entity

Intent:
- let operations add or correct guest-card records directly in the UI

Questions to resolve:
- Is manual entry still required in the new product?
- If yes, should it write to:
  - a local correction store
  - a new backend table
  - or simply be excluded from v1?

Recommendation:
- Preserve this as a requirement, but treat it as phase 2 unless explicitly needed for launch
- v1 should focus on read-only reporting unless business confirms write-back is required

Decision:
- `Preserve requirement, defer implementation`

### 4. Property Comparison Cards

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/PropertyCard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/PropertyCard.jsx)

Features present:
- property name
- core value
- guest cards / units
- rank among sister properties
- delta vs sister property average
- YoY
- previous period
- occupancy
- ATR

Intent:
- make one property card feel like an executive scorecard

What we must preserve:
- pilot vs sister comparison
- delta framing
- period-over-period framing

What we should change:
- remove hardcoded values
- expand from one pilot-centric property set to all five pilot/sister pairs
- make cards use normalized reporting data

Recommendation:
- Reuse the scorecard concept in `Property Detail`
- Also use lighter versions of this in the `Overview`

Decision:
- `Keep and redesign`

### 5. Daily Trend Chart

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/DailyTrendChart.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/DailyTrendChart.jsx)

Intent:
- show directional movement over time
- compare property behavior against peers

Problems in current implementation:
- partly hardcoded
- centered on one property and three peers
- uses mock comparison counts

What we must preserve:
- daily trend context
- visual comparison of pilot vs sister or pilot vs cohort

Recommendation:
- Keep trend charts as a primary pattern
- Rebase them on real CWV, BI, and Heap series

Decision:
- `Keep and replace data plumbing`

### 6. Gap Benchmark / Gap Closing Framing

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/GapBenchmarkCard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/GapBenchmarkCard.jsx)
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/GapBenchmark.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/GapBenchmark.jsx)
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/GapSparkline.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/GapSparkline.jsx)

Intent:
- answer a strategic question, not just present a metric
- is the pilot property closing the gap to its benchmark / sister average?

This is important.

We should preserve:
- gap-to-sister framing
- status language:
  - closing
  - widening
  - stable
  - closed

Recommendation:
- Keep this as a first-class concept in the new interface
- Build status badges from real calculated deltas in the normalized reporting layer

Decision:
- `Keep`

### 7. Conversion Metric Table

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/ConversionsCard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/ConversionsCard.jsx)

Features present:
- value
- vs previous period
- YoY
- vs sister average
- occupancy and ATR context

Intent:
- provide compact, decision-ready operational context

What we must preserve:
- multiple comparison contexts on one screen
- ability to read beyond the headline value

Recommendation:
- Keep this pattern for a `Property Detail` or `Table View`
- Not every page needs this density, but the capability should exist

Decision:
- `Keep and modernize`

### 8. Conversion Trend Panel

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/ConversionsTrendPanel.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/ConversionsTrendPanel.jsx)

Intent:
- small-multiple trend view for several funnel metrics at once
- compare pilot against sister average
- annotate whether the gap is closing or widening

This is one of the best ideas in the inherited app.

Recommendation:
- Preserve this pattern on the `Funnel` page
- Use real metrics:
  - PQ/GC
  - ST/GC
  - A/GC
  - C2C/GC
  - CFrm/GC

Decision:
- `Keep`

### 9. Source Breakdown

Current implementation:
- [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/SourceBreakdown.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/SourceBreakdown.jsx)

Intent:
- show marketing-source composition

Relevance to the new pilot dashboard:
- maybe useful later
- not part of the currently commissioned KPI set

Recommendation:
- Do not prioritize for v1
- Keep on backlog as optional supporting analysis

Decision:
- `Defer`

### 10. Occupancy / ATR Context

Current implementation:
- hardcoded in [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/PropertyCard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/PropertyCard.jsx)
- also visually surfaced in [`/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/ConversionsCard.jsx`](/tmp/guest-card-tracker-website-pilot-properties/src/components/dashboard/ConversionsCard.jsx)

Intent:
- add operational context to KPI interpretation

Recommendation:
- Preserve as optional contextual fields in `Property Detail`
- Do not block v1 on these unless we already have reliable data sources

Decision:
- `Preserve requirement, likely phase 2`

## Mapping to Our Current Data Model

### Source-Ready Now

- `Core Web Vitals - PSI`
  - source: `pilot_control_psi_metrics`
- `Core Web Vitals - GTMetrix`
  - source: `gtmetrix_metrics`
- `Lead (Guest Card) to Available Unit Rate`
  - source: BI `GC/AU`
- `Website Sales Funnel - Price Quote`
  - source: BI `PQ/GC`
- `Website Sales Funnel - Visits (Schedule a Tour)`
  - source: BI `ST/GC`
- `Website Sales Funnel - Completed Applications`
  - source: BI `A/GC`
- `Website Funnel Conversions - Click to Call / Phone`
  - source: BI `C2C/GC`
- `Website Funnel Conversions - Contact Form`
  - source: BI `CFrm/GC`
- `Organic Traffic as a % of Unique Users`
  - source: Measurement workbook / Heap

### Source-Ready But Lagging

- `High Intent User Rate`
  - source: Measurement workbook / Heap
  - currently pending latest day when the workbook lags

### Not Yet Fully Mapped

- occupancy
- ATR
- manual guest-card corrections / direct write-back
- broader source breakdown

## Proposed Information Architecture

### 1. Overview

Purpose:
- executive landing page

Content:
- KPI group rollups
- current pilot avg vs sister avg
- gap status
- quick links to detail pages

### 2. Core Web Vitals

Purpose:
- technical health view

Content:
- PSI avg trend
- GTMetrix avg trend
- pilot vs sister pair cards/charts
- baseline and floor

### 3. Traffic & Engagement

Purpose:
- audience quality and website share

Content:
- Organic Traffic as % of Unique Users
- High Intent User Rate
- pending-state handling for delayed Heap drops

### 4. Funnel

Purpose:
- website-attributed conversion performance

Content:
- Price Quote
- Schedule Tour
- Completed Applications
- Click to Call
- Contact Form
- Lead to AU as a bridge metric
- small-multiple trend panel

### 5. Property Detail

Purpose:
- preserve the property scorecard concept from the Base44 app

Content:
- one selected pilot property
- matched sister property
- current KPI stack
- gap vs sister
- previous period
- YoY where available
- contextual fields like occupancy / ATR if available

### 6. Report Archive

Purpose:
- connect dashboard to daily operational output

Content:
- generated workbook
- sent email preview
- summary panels / PNGs
- latest source file metadata

## Must-Keep Functionality

These are the things we should explicitly preserve in the rebuild:

- dashboard landing experience
- pilot vs sister comparison throughout
- trend charts
- gap/benchmark framing
- website-only conversion analysis
- period-over-period context
- property-level drilldown
- some path for manual operational input, if confirmed needed

## What We Can Improve

- replace hardcoded values with normalized pipeline outputs
- expand from one-property-centric logic to full pilot cohort logic
- unify workbook, email, and dashboard on one metric definition layer
- support stale/pending source states clearly
- add archive/history views
- move deployment to Cloudflare Pages

## Recommended Technical Approach

### Data

Use the existing reporting pipeline as the canonical layer:
- CWV normalization
- BI normalization
- Measurement/Heap parsing
- workbook generation
- email generation

Add:
- dashboard-ready JSON snapshot export

### Frontend

Use the inherited app as a reference for:
- card structure
- trend panel pattern
- property-detail layout
- KPI table density

Do not reuse its hardcoded business logic.

### Deployment

Deploy a frontend at:
- `tracker.venterradev.com`

Recommended stack:
- Cloudflare Pages for the app
- daily generated JSON snapshots as the data source

## Build Sequence

1. Lock feature parity requirements from this document
2. Define dashboard JSON contracts from current pipeline
3. Build `Overview`
4. Build `Core Web Vitals`
5. Build `Traffic & Engagement`
6. Build `Funnel`
7. Build `Property Detail`
8. Build `Archive`
9. Deploy to Cloudflare Pages
10. Point `tracker.venterradev.com` at the deployed app

## Conclusion

We should not replace the reporting pipeline with the inherited Base44 app.
We should preserve its functional intent and rebuild those capabilities on top of our normalized pilot KPI data model.
