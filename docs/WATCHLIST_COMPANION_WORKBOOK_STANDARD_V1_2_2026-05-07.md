# Watchlist Companion Workbook Standard v1.2

Date: 2026-05-07
Owner: Captain's Log / Data Pond / Watchlist Reporting
Status: Active v1.2

## Purpose

The Watchlist companion workbook is the auditable evidence file attached beside the human-readable Watchlist Decision Output email. The email is for decision flow; the workbook is for inspection, reconciliation, and deeper analyst review.

This workbook does not replace the Data Pond, Captain Brief, POP Brief, PIB, or VP retrieval JSON contract. It packages governed Pond facts into a structured Excel companion so the team can trace the numbers behind the report without reading long prose.

## Canonical v1.2 Proof Artifact

First v1.2 proof workbook:

`/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_v1_2_2026-05-07.xlsx`

First v1.2 proof data export:

`/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_data_2026-05-07.json`

Current builder:

`/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/xlsx_build/build_elation_watchlist_companion.mjs`

Current data exporter:

`/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/xlsx_build/export_elation_watchlist_data.py`

## v1.2 Changes

- Added `Demand_vs_Availability` as a first-class workbook tab.
- Promoted Guest Cards per Available Unit into the Summary sheet.
- Preserved property-total and bedroom-level available-interest rows from the current `guest-cards-per-unit.xlsx` export.
- Added a governed `bedrooms` column to `available_unit_interest_metrics`.
- Updated the Marketing BI Excel ingester so bedroom rows inherit property identity from the parent property row instead of becoming unscoped evidence.
- Updated Captain Brief source reads to use `current_level = 'Property'` when a property-level available-interest read is needed.
- Refreshed the 11 current Spotlight Captain Brief vNext artifacts after the new data lane was loaded.

## Required Sheets

The active workbook should include:

1. `Summary`
2. `Funnel`
3. `Inventory_Readiness`
4. `Demand_vs_Availability`
5. `Spend_Output`
6. `Source_Output`
7. `Unit_Type_Targeting`
8. `Organic_Demand`
9. `Website_Performance`
10. `Reputation`
11. `Competitive_Market`
12. `Recommendations`
13. `Sources`

## Data Rules

- Use Data Pond facts where available.
- Resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Do not invent values.
- Do not use property-scoped abandoned-application counts unless the source export contains a reliable property key.
- Spend must come from the spend workbook route when available.
- PSI/Core Web Vitals must come from `pagespeed_metrics` unless a documented fallback is required.
- Source dates must be carried into the workbook.
- The `Sources` tab is the bottom-line audit panel. Do not top-load source-readiness narratives into the human report unless needed to prevent a wrong decision.

## Demand vs Availability Rule

Use `available_unit_interest_metrics` for the advisory demand-vs-supply lane:

- `current_level = 'Property'` for property-total KPI/report reads.
- `current_level = 'Bedrooms'` for unit mix / bedroom-level investigation.
- `t30_guest_cards_per_available_unit` and `t7_guest_cards_per_available_unit` are demand-intensity measures, not conversion rates.
- Bedroom rows may not always carry unit count or availability if the BI export did not expose them. Preserve that as blank source truth rather than estimating it.

## Boundary

This is a Watchlist companion workbook standard. It does not modify locked canonical PIB generator, template, or sender files. Watchlist emails must still use the documented Watchlist report-family sender and PIB-style header discipline.
