# Marketing Ops Summary Source Contract

Date: 2026-05-04
Owner: Data Pond + Captain's Log
Source workbook: `/Users/mark/Downloads/Marketing Ops Summary.xlsx`

## Purpose

The Marketing Ops Summary workbook is a promoted Marketing BI advisory source for portfolio and Captain reads. It combines property performance, demand, conversion, pricing, ad-spend, and Kingsley experience signals into one property-level operating table.

This source is advisory. It does not replace official operating metrics, raw guest-card facts, unit-level availability, or booked financial source-of-record feeds when those authoritative Pond routes exist.

## Grain

One row per property per report date.

The first local load from the 2026-05-04 workbook produced:

- `91` property rows
- `91` governed property identity matches
- source-as-of date `2026-05-03`

## Canonical Table

`marketing_ops_summary_rows`

Primary paths:

- `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_ops_summary_ingest.py`
- `/Users/mark/Property_Analytics/apps/api/migrations/0041_create_marketing_ops_summary.sql`
- `/Users/mark/Property_Analytics/infra/migrations/028_create_marketing_ops_summary.sql`
- `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`
- `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`

## Preserved Sections

The workbook uses multi-row grouped headers. The ingester preserves those sections as explicit columns instead of storing the sheet as a generic row ledger:

- Property Performance: units, occupancy, ATR30, ATR
- Traffic: T30/T7 leads YoY, lead-to-visit conversion, visits YoY, leases YoY, traffic-per-unit benchmark, close ratio, projected traffic gap
- Pricing: expirations, trade-off, offered-vs-book, 60/30/7-day deltas
- Financial: ad-spend benchmark, actual vs budget, T1/T3 trend
- Kingsley Data: ease of finding property, asked to leave deposit, given a tour

## Initial Portfolio Read

From the 2026-05-04 local load:

- Units: `27,074`
- Weighted occupancy: `90.5%`
- T30 leads: `13,633`, up `8.4%` YoY
- T7 leads: `3,306`, up `14.8%` YoY
- T30 visits: `3,875`, up `11.8%` YoY
- T7 visits: `889`, up `9.1%` YoY
- T7 leases: `325`, up `7.3%` YoY
- T1 ad spend: `$266.6K` actual vs `$190.9K` budget
- T3 ad spend: `$791.2K` actual vs `$559.8K` budget

## Captain Runtime Use

The Captain source mirror now includes `marketing_ops_summary_rows`. The Captain runtime exposes:

- `sources.marketingOpsSummary`
- `marketingInsight.opsSummary`
- `marketingInsight.opsRead`

The normalized `opsRead` summarizes occupancy, ATR30, T30/T7 leads, visits, leases, close ratio, projected traffic gap, ad-spend variance, and Kingsley ease-of-finding posture.

Remote D1 was updated on 2026-05-04 with `91` rows and `91` mapped property identities.

## Governance

Property identity must resolve through:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Run after source-shape changes:

- `bash scripts/check_property_identity_governance.sh`
- `bash scripts/check_context_discipline.sh`
- `bash scripts/check_pib_guardrails.sh`
