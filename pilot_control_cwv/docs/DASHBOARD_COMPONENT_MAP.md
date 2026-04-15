# Dashboard Component Map

## Purpose

This document maps each planned dashboard page to concrete UI components and
their data dependencies.

It should be read alongside:
- [`/Users/mark/Property_Analytics/pilot_control_cwv/docs/DASHBOARD_BUILD_BLUEPRINT.md`](/Users/mark/Property_Analytics/pilot_control_cwv/docs/DASHBOARD_BUILD_BLUEPRINT.md)
- [`/Users/mark/Property_Analytics/pilot_control_cwv/docs/DASHBOARD_DATA_CONTRACT.md`](/Users/mark/Property_Analytics/pilot_control_cwv/docs/DASHBOARD_DATA_CONTRACT.md)

## Global Design System

### Core colors

- pilot: `#4473D0`
- sister: `#7CCAC2`
- baseline: neutral gray
- floor: light red
- body text: deep navy / near-black

### Reusable primitives

- `PageShell`
- `TopNav`
- `SectionHeader`
- `StatusBadge`
- `MetricValue`
- `MiniTrendChart`
- `PairTrendChart`
- `StatRail`
- `PendingStateCard`
- `SourceFreshnessBadge`
- `PropertyPairLabel`
- `ArchiveItem`

## Page: Overview

Route:
- `/`

Data:
- `overview.json`

Components:

### `OverviewPage`
- loads `overview.json`
- renders three KPI group sections

### `KpiGroupCard`
Props:
- `title`
- `detailHref`
- `metrics`
- `sourceStatus`

Contents:
- group title
- mini charts for each metric in the group
- right-side current values
- status badge
- `View Details` CTA

### `MiniTrendChart`
Used for:
- `PSI Avg`
- `GTMetrix Avg`
- `Organic Traffic as a % of Unique Users`
- funnel rollups

Requirements:
- extremely compact
- no legend
- end-state values shown in stat rail

### `StatRail`
Used for:
- Pilot Avg
- Sister Avg
- Baseline
- Floor

## Page: Core Web Vitals

Route:
- `/cwv`

Data:
- `cwv.json`

Components:

### `CwvPage`
Sections:
- summary band
- pair detail stack

### `CwvRollupCard`
One for:
- `PSI Avg`
- `GTMetrix Avg`

Contents:
- title
- rollup chart
- stat rail
- status badge

### `CwvPairCard`
One per pair:
- pilot/sister label
- `PSI` trend
- `GTMetrix` trend
- latest values

Inherited intent preserved:
- trend-first story
- pilot vs sister comparison

## Page: Traffic & Engagement

Route:
- `/traffic`

Data:
- `traffic.json`

Components:

### `TrafficPage`
Sections:
- Organic Traffic card
- High Intent card
- pair detail stack

### `TrafficMetricCard`
Used for:
- Organic Traffic as % of Unique Users
- High Intent User Rate

Contents:
- title
- rollup chart
- current and baseline stats
- source freshness label

### `PendingMetricCard`
Used when Heap lag prevents current-day values

Contents:
- metric title
- pending label
- latest available date
- plain-language reason

## Page: Funnel

Route:
- `/funnel`

Data:
- `funnel.json`

Components:

### `FunnelPage`
Sections:
- small-multiple summary
- pair detail by metric

### `FunnelMetricSection`
One per metric:
- Lead to AU
- Price Quote
- Schedule Tour
- Completed Applications
- Click to Call
- Contact Form

Contents:
- metric title
- rollup mini chart
- pilot current
- sister current
- baselines
- gap status

### `FunnelTrendGrid`
Purpose:
- preserve and improve the inherited `ConversionsTrendPanel` concept

Structure:
- one compact small-multiple tile per funnel metric
- each tile shows pilot vs sister trend
- each tile has status label:
  - closing
  - widening
  - stable
  - closed

### `FunnelPairCard`
One per pair and per selected metric view or stacked metric section

Contents:
- pair label
- trend line
- latest values
- baseline

## Page: Property Detail

Route:
- `/property/:pairKey` or `/property/:pilotPropertyId`

Data:
- `properties.json`

Components:

### `PropertyDetailPage`
Purpose:
- preserve the inherited property scorecard concept

Sections:
- property header
- KPI summary cards
- trend panels
- context stats

### `PropertyHeader`
Contents:
- pilot property name
- sister property name
- pilot color / sister color treatment

### `PropertyScorecardGrid`
Cards for:
- PSI
- GTMetrix
- Organic Traffic %
- High Intent
- Lead to AU
- Price Quote
- Schedule Tour
- Completed Applications
- Click to Call
- Contact Form

### `ContextStatBlock`
Optional:
- occupancy
- ATR
- source freshness

## Page: Report Archive

Route:
- `/archive`

Data:
- `archive.json`

Components:

### `ArchivePage`
Sections:
- latest run
- historical runs

### `LatestRunCard`
Contents:
- workbook link
- email preview link
- source freshness metadata

### `RunTable`
Columns:
- date
- workbook
- BI source
- Heap latest date
- notes

## Component Reuse From Inherited App

These ideas should be preserved conceptually:

### Reuse conceptually

- `PropertyCard`
  - scorecard layout
- `DailyTrendChart`
  - trend-first panel
- `ConversionsTrendPanel`
  - small-multiple comparison concept
- `GapBenchmarkCard`
  - closing/widening storytelling

### Do not reuse literally

- hardcoded data arrays
- Base44 entity assumptions
- single-property-centric layout
- mock trend values

## Suggested File Structure

If we build a new frontend app, a clean structure would be:

```text
src/
  app/
    routes/
      overview/
      cwv/
      traffic/
      funnel/
      property/
      archive/
  components/
    charts/
      MiniTrendChart.tsx
      PairTrendChart.tsx
      FunnelTrendGrid.tsx
    cards/
      KpiGroupCard.tsx
      CwvRollupCard.tsx
      FunnelMetricSection.tsx
      PendingMetricCard.tsx
    layout/
      PageShell.tsx
      TopNav.tsx
      SectionHeader.tsx
    shared/
      StatusBadge.tsx
      SourceFreshnessBadge.tsx
      PropertyPairLabel.tsx
      StatRail.tsx
  lib/
    api/
      snapshots.ts
    format/
    status/
    colors/
```

## Priority Build Order

### Highest priority

1. `OverviewPage`
2. `CwvPage`
3. `FunnelPage`

### Next

4. `TrafficPage`
5. `PropertyDetailPage`

### Later

6. `ArchivePage`
7. manual entry / write-back if required

## Success Criteria

The dashboard is ready when:
- it preserves the strongest behaviors of the inherited app
- all page numbers match workbook/email outputs
- pending/stale data is obvious
- pilot vs sister comparison is visible everywhere
- an executive can scan the overview in under a minute
