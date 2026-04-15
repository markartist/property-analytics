# Dashboard Build Blueprint

## Purpose

This document defines the production dashboard we should build to meet or exceed the inherited Base44 app while preserving its functional intent.

Reviewed sources:
- Live app: [website-pilot-tracker-guestcards-and-conversions.base44.app](https://website-pilot-tracker-guestcards-and-conversions.base44.app)
- Repo snapshot: `/tmp/guest-card-tracker-website-pilot-properties`
- Feature map: [`/Users/mark/Property_Analytics/pilot_control_cwv/docs/BASE44_FEATURE_MAPPING.md`](/Users/mark/Property_Analytics/pilot_control_cwv/docs/BASE44_FEATURE_MAPPING.md)

Target deployment:
- `tracker.venterradev.com`

## Product Goal

Build a dashboard that:
- preserves the operational usefulness of the inherited app
- aligns with the workbook and email report numbers exactly
- presents the 5 pilot properties and their matched sister properties clearly
- supports executive scanning and analyst drilldown
- handles stale or pending data sources gracefully

## Core Product Rules

1. The reporting pipeline remains the source of truth.
2. The dashboard is a presentation layer, not a second metric engine.
3. Every visible KPI should trace back to the same normalized values used in:
- the workbook
- the email summary panels
- the dashboard
4. Pending or stale source data must be shown explicitly.

## Information Architecture

### Page 1: Overview

Purpose:
- executive landing page

Primary user questions:
- How are the pilot properties doing overall?
- Are pilots outperforming sister properties?
- Which areas need attention?

Required content:
- KPI group rollups:
  - `Core Web Vitals`
  - `Traffic & Engagement`
  - `Funnel`
- pilot average vs sister average for each KPI group
- gap status:
  - closing
  - widening
  - stable
  - mixed
- latest available date for each source family
- links into detail pages

Inherited app behavior preserved:
- dashboard landing experience
- trend-first presentation
- benchmark framing

Improvements:
- no hardcoded property bias
- full pilot cohort support
- consistent pending-state handling

### Page 2: Core Web Vitals

Purpose:
- technical health detail

Primary user questions:
- Are pilot properties improving technically?
- Are they outperforming sisters?
- Is PSI or GTMetrix driving the story?

Required content:
- top summary:
  - `PSI Avg` pilot vs sister
  - `GTMetrix Avg` pilot vs sister
- pair-level charts for all 5 pilot/sister pairs
- baseline and floor indicators
- latest values
- current shared comparison window note

Data sources:
- PSI from `pilot_control_psi_metrics`
- GTMetrix from `gtmetrix_metrics`

Inherited app behavior preserved:
- line-chart trend view
- pilot vs benchmark comparison

Improvements:
- actual CWV data
- full pair coverage
- workbook-aligned baselines/floors

### Page 3: Traffic & Engagement

Purpose:
- audience quality and top-of-funnel quality

Primary user questions:
- Is website traffic quality improving?
- Are pilots attracting stronger traffic than sisters?
- Is Heap current or pending?

Required content:
- `Organic Traffic as a % of Unique Users`
- `High Intent User Rate`
- pilot avg vs sister avg
- pair-level detail
- pending state if latest Heap day is not loaded

Data sources:
- Measurement workbook / Heap:
  - [`/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Measurement_Dashboard_1.1.xlsx`](/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Measurement_Dashboard_1.1.xlsx)

Inherited app behavior preserved:
- website-only view
- trend context

Improvements:
- clear stale-data messaging
- pilot/sister rollups across all pairs

### Page 4: Funnel

Purpose:
- website-attributed conversion performance

Primary user questions:
- Are pilots converting better than sisters?
- Which funnel stages are strongest or weakest?
- Is the gap closing?

Required content:
- summary cards or mini trend rows for:
  - `Lead (Guest Card) to Available Unit Rate`
  - `Price Quote`
  - `Visits (Schedule a Tour)`
  - `Completed Applications`
  - `Click to Call / Phone`
  - `Contact Form`
- small-multiple trend panels
- pair-level detail
- pilot vs sister comparison
- baseline where applicable

Data sources:
- BI normalized history
- report-series output derived from:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/reports/pilot_bi_metric_history.csv`
  - `/Users/mark/Property_Analytics/pilot_control_cwv/reports/pilot_bi_report_series.csv`

Inherited app behavior preserved:
- conversion-focused tab
- multi-metric trend panel
- gap-closing framing
- value / previous period / sister context

Improvements:
- real pilot program metrics
- all 5 pilot/sister pairs
- percentage formatting throughout

### Page 5: Property Detail

Purpose:
- preserve the strongest “property scorecard” concept from the inherited app

Primary user questions:
- How is this specific pilot property doing vs its sister?
- What changed recently?

Required content:
- property selector for pilot properties
- matched sister property shown automatically
- KPI scorecards:
  - technical
  - traffic
  - funnel
- current values
- previous period
- YoY where available
- sister gap
- optional contextual fields:
  - occupancy
  - ATR

Data sources:
- normalized reporting outputs
- optional ops context if reliable source is available

Inherited app behavior preserved:
- property card storytelling
- scorecard style
- context fields

Improvements:
- not hardcoded to Champions Green
- uses real pair mapping

### Page 6: Report Archive

Purpose:
- connect dashboard to the daily reporting workflow

Primary user questions:
- What was sent today?
- Can I open the workbook?
- What inputs were used?

Required content:
- latest generated workbook
- latest email preview
- latest PNG summary panels
- source freshness metadata:
  - BI file used
  - Measurement workbook latest date
  - CWV latest date
- prior daily runs if retained

Inherited app behavior preserved:
- none directly

Improvements:
- operational transparency
- auditability

## Global UX Requirements

### Must Preserve

- pilot vs sister comparison in every major view
- trend, not just static KPI cards
- benchmark / gap framing
- distinction between total volume and website-attributed performance
- compact executive readability
- drilldown path to details

### Must Improve

- remove hardcoded property assumptions
- remove mock data
- align all numbers with workbook/email
- support all five pilot/sister pairs
- show pending/stale source states clearly

### Design Direction

- cleaner than the inherited app
- dense but readable
- minimal wasted vertical space
- stronger typography hierarchy
- consistent color mapping:
  - pilot `#4473D0`
  - sister `#7CCAC2`
  - baseline subtle gray
  - floor subtle light red

## Functional Parity Matrix

### Keep As Core

- landing dashboard
- trend charts
- gap-closing messaging
- conversion comparison tables
- property detail storytelling

### Keep But Rebuild

- tab logic
- guest-card volume views
- benchmark cards
- sparkline panels
- delta vs sister framing

### Defer To Phase 2

- manual guest-card entry
- write-back/edit workflows
- source breakdown exploration
- any direct Base44 entity writes

## Data Contract Recommendation

The dashboard should not read raw spreadsheets directly.

Instead, daily pipeline should emit normalized JSON snapshots such as:

- `overview.json`
- `cwv.json`
- `traffic.json`
- `funnel.json`
- `properties.json`
- `archive.json`

Each should include:
- `as_of_date`
- `source_freshness`
- `pilot_values`
- `sister_values`
- `baseline_values`
- `status`
- `series`

## Cloudflare Deployment Plan

### Recommended Stack

- Frontend:
  - React app
  - can reuse layout ideas from Base44 app
- Hosting:
  - Cloudflare Pages
- Domain:
  - `tracker.venterradev.com`
- Data:
  - static JSON snapshots published by current pipeline

### Why This Is Better

- fast and simple hosting
- no duplicated metric logic in the browser
- easy cache invalidation per daily snapshot
- easy to audit against workbook/email outputs

## Build Sequence

### Phase 1: Foundations

1. Lock page structure
2. Define JSON snapshot schema
3. Export daily snapshots from current pipeline
4. Scaffold Cloudflare-ready frontend

### Phase 2: Core Pages

5. Build `Overview`
6. Build `Core Web Vitals`
7. Build `Traffic & Engagement`
8. Build `Funnel`

### Phase 3: Drilldown and Ops

9. Build `Property Detail`
10. Build `Archive`
11. Decide whether manual entry is required

### Phase 4: Deployment

12. Deploy to Cloudflare Pages
13. Bind `tracker.venterradev.com`
14. Validate data freshness workflow

## Final Recommendation

We should aim to exceed the inherited app by:
- preserving its operational usefulness
- improving clarity and coverage
- grounding every surface in the same normalized reporting layer

The inherited app gives us the product shape.
Our current reporting pipeline gives us the trustworthy data engine.
The production solution should combine both.
