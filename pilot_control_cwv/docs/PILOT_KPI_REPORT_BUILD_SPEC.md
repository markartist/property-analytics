# Pilot KPI Report Build Spec

## Purpose

This document defines the first-pass metric sections for the commissioned pilot
report workbook. It locks the initial section order, source mapping, and any
known `Pending` dependencies before broader workbook automation begins.

## Reporting Pattern

- each metric section is shown as pilot vs sister/control property pairs
- each pair uses a compact daily line chart treatment
- the workbook is the primary deliverable
- daily input files can come from local spreadsheet drops as well as the shared
  analytics database

## Section Order

1. `Core Web Vitals - PSI`
2. `Core Web Vitals - GTMetrix`
3. `Organic Traffic as a % of Unique Users`
4. `High Intent User Rate`
5. `Lead (Guest Card) to Available Unit Rate`
6. `Website Sales Funnel - Price Quote`
7. `Website Sales Funnel - Visits (Schedule a Tour)`
8. `Website Sales Funnel - Completed Applications`
9. `Website Funnel Conversions - Click to Call / Phone`
10. `Website Funnel Conversions - Contact Form`

## Source Decisions

### Ready Now

- `Core Web Vitals - PSI`
  - source: `pilot_control_psi_metrics`
  - headline metric: `performance_score`

- `Core Web Vitals - GTMetrix`
  - source: `gtmetrix_metrics`
  - headline metric: `pagespeed_score`

- `Organic Traffic as a % of Unique Users`
  - source: `ga4_traffic_sources` + `ga4_daily_metrics`
  - formula: `Organic Search sessions / total_users`
  - organic filter: `channel_group = 'Organic Search'`

- `Lead (Guest Card) to Available Unit Rate`
  - source: BI spreadsheet export
  - metric code: `GC/AU`
  - row selection: `Website Conversion`

- `Website Sales Funnel - Price Quote`
  - source: BI spreadsheet export
  - metric code: `PQ/GC`
  - row selection: `Website Conversion`

- `Website Sales Funnel - Visits (Schedule a Tour)`
  - source: BI spreadsheet export
  - metric code: `ST/GC`
  - row selection: `Website Conversion`
  - note: this is currently mapped to Schedule Tour, not completed onsite Visit

- `Website Sales Funnel - Completed Applications`
  - source: BI spreadsheet export
  - metric code: `A/GC`
  - row selection: `Website Conversion`

- `Website Funnel Conversions - Click to Call / Phone`
  - source: BI spreadsheet export
  - metric code: `C2C/GC`
  - row selection: `Website Conversion`

- `Website Funnel Conversions - Contact Form`
  - source: BI spreadsheet export
  - metric code: `CFrm/GC`
  - row selection: `Website Conversion`

### Pending

- `High Intent User Rate`
  - status: `Pending`
  - dependency: Heap export
  - blocker: final numerator event definition and file shape not yet locked

## BI Export Interpretation

The current BI spreadsheet sample at:

- [`bi-03-31-mc.xlsx`](/Users/mark/Downloads/bi-03-31-mc.xlsx)

contains a wide metric matrix keyed by:

- `Property`
- `Conv Src (website vs other)`

and supports these key ratio families:

- `GC/AU`
- `PQ/GC`
- `ST/GC`
- `V/GC`
- `A/GC`
- `L/GC`
- `M/GC`
- `C2C/GC`
- `CFrm/GC`

The `Conv Src (website vs other)` split includes:

- `Total`
- `Website Conversion`
- `Other Conversion`

## Trend Construction Rule

The BI export is not a native daily-history table. It provides snapshot values
such as:

- `Yesterday`
- `T7D`
- `T15D`
- `T30D`
- `T60D`
- `T90D`

For workbook charting, the daily trend for BI-based sections should be built by
retaining each day’s delivered spreadsheet and appending that day’s snapshot into
a local normalized history layer.

## Template Pull Rules

The stakeholder BI template at:

- [`bi-03-31-Template.xlsx`](/Users/mark/Downloads/bi-03-31-Template.xlsx)

uses font color as the extraction key.

### Daily Pull

Use the red fields:

- `GC/AU Daily Avg T7D`
- `PQ/GC T7D`
- `ST/GC T7D`
- `A/GC T7D`
- `C2C/GC T7D`
- `CFrm/GC T7D`

and always pair each current value with its corresponding `Sister` column.

### Baseline Pull

Use the purple-styled `Website Conversion` row values for:

- `GC/AU Daily Avg T90D`
- `PQ/GC T90D`
- `ST/GC T90D`
- `A/GC T90D`
- `C2C/GC T90D`
- `CFrm/GC T90D`

These are baseline seed values, not daily refreshed chart points.

### BI Row Selection

For the current commissioned workbook build, the BI-based metric sections should
follow the template literally:

- use `Conv Src (website vs other) = Website Conversion`
- use `T7D` for daily plotted values
- use `T90D` from the baseline seed file for the baseline reference line

## CWV Thresholds

The current CWV prototype uses these approved thresholds:

- PSI baseline: `90`
- PSI floor: `60`
- GTMetrix baseline: `94`
- GTMetrix floor: `70`

## Current Open Decisions

- if business wants `Visits` to mean completed onsite visits instead of schedule
  tours, switch `ST/GC` to `V/GC`
- define the final Heap event bundle for `High Intent User Rate`
- use the `2026-03-26` BI file as the preferred first baseline seed when it is provided

## Implementation Notes

- use the exact workbook shell the stakeholders supplied unless directed otherwise
- prefer a single metric-mapping layer for workbook generation so spreadsheet and
  database sources feed the same renderer
- mark Heap-dependent sections explicitly as `Pending` rather than approximating
  the values from another source
