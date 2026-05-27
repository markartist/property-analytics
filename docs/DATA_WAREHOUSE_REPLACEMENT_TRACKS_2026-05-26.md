# Data Warehouse Replacement Tracks

Date: 2026-05-26

Purpose: document the first concrete replacements for manual/file-drop jobs now that the corporate Data Warehouse is available through Keeper/KSM-backed read-only access.

## Integrity Posture

All replacement lanes remain empirical and source-bound:

- no metric is promoted without a named source object and identity match
- unknown or ambiguous fields stay null or advisory
- manual exports are not deleted until contract parity is proven
- canonical mutations remain explicit, especially for guest-card fields with known reconciliation drift

## Track 1: Guest Card CSV Drop

Replacement path:

- `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`
- `/Users/mark/Property_Analytics/apps/api/scripts/guest_cards_to_d1.py`

Status:

- direct DW shadow supply is active in `guest_card_metrics_dw_direct`
- canonical `guest_card_metrics` is untouched unless explicitly run with `--apply-canonical --trusted-core-only`
- D1 guest-card sync now reads a unified source that prefers `guest_card_metrics_dw_direct` rows by date/property and falls back to `guest_card_metrics`

Latest proof:

- 2026-05-26 DW direct supply wrote 92 shadow rows
- trusted guest cards: 363
- trusted online apps: 89
- advisory quotes: 185
- advisory pipeline apps: 3
- advisory tours: 103
- local D1-source smoke test for 2026-05-20 through 2026-05-26 saw 92 properties and 964 guest cards

Promotion gate:

- quote, pipeline-application, and tour deltas remain `degraded_advisory` until source-owner review explains the drift

## Track 4: Property Operating Metrics

Replacement path:

- `/Users/mark/Property_Analytics/scripts/supply_property_operating_metrics_from_data_warehouse.mjs`

Source:

- `dw_read.leasingstatistics_daily_bv`

Target:

- `property_operating_metrics`

Status:

- direct supply is active
- daily default falls back to the latest available DW operating date when the requested run date has not landed yet
- only direct, unambiguous fields are promoted
- unavailable fields remain null and supporting source fields are retained in `evidence_json`

Latest proof:

- requested date: 2026-05-26
- effective source date: 2026-05-25
- source rows: 95
- rows upserted: 91
- unresolved DW property codes: none
- governed exclusions: `FL4CA`, `FL4P9`, `TX4FP`, `TX4PW`
- lifecycle count check: 93 governed active matrix properties minus 2 pre-live properties not expected in DW operating yet (`TX4EK`, `TX4CY`) = 91 expected live operating properties
- local aggregate: 22,878 occupied units, 27,122 total units, average occupancy 91.18, average leased 94.09

Resolution note:

- the four excluded codes appear in `dw_read.leasingstatistics_daily_bv` but do not have rows in `dw_read.property_bv`, `dbo.dw_property`, `dw_read.TO_DELETE_rentlytics_property_list_v`, `dw_read.dw_Property_Revenue_And_Expense_src`, or `dw_read.prov_user_report_property_access_including_sold_bv`
- they also have no exact match in `config/property_identity_matrix.json`
- they are classified in `/Users/mark/Property_Analytics/config/data_warehouse_property_code_resolution.json` as `exclude_from_canonical_property_operating_metrics` pending source-owner review
- `TX4EK` / The Vine Kyle Parkway and `TX4CY` / Sundara at Spring Cypress are classified as user-confirmed pre-live lifecycle gaps; they are governed active/upcoming properties but are not expected in daily DW operating metrics until live

Promotion gate:

- validate whether downstream consumers want `vacantavailable` as `available_units` or a broader availability definition

## Track 5: Property Metadata And Region Identity

Replacement path:

- `/Users/mark/Property_Analytics/scripts/supply_property_metadata_from_data_warehouse.mjs`

Source:

- `dw_read.property_bv`

Target:

- `property_metadata_dw_direct`
- non-destructive annotations in `config/property_identity_matrix.json` when run with `--apply-matrix-annotations`

Status:

- direct metadata shadow supply is active
- exact `property_cd` identity matching is required
- personal/staff email fields are intentionally suppressed from reports and local evidence

Latest proof:

- source rows: 92
- rows supplied: 92
- unresolved property codes: 0
- matrix deltas flagged: 10, mostly unit-count differences plus The Vine Kyle Parkway region/value maturation

Promotion gate:

- review the 10 matrix deltas before overwriting any canonical identity fields

## Track 6: Manual CSV Seed Paths

Replacement path:

- `/Users/mark/Property_Analytics/config/manual_source_replacement_manifest.json`
- `/Users/mark/Property_Analytics/scripts/audit_manual_source_replacements.mjs`

Status:

- six manual/file-drop lanes are now inventoried with replacement paths and promotion gates
- latest audit found 6 candidates, 5 concrete replacement paths present, and 0 missing replacement paths after policy-only lanes were classified correctly

Included lanes:

- guest-card CSV drop
- property operating metrics manual gap
- property region / identity workbook dependency
- Base44 Website & SEO seed CSV
- Spotlight CSV-to-D1 bridge
- web metrics CSV upload UI

Promotion gate:

- legacy seed/bridge scripts should remain available for historical recovery, but recurring jobs should use source-native collectors, DW suppliers, or typed Pond APIs

## Watchtower Visibility

Replacement posture is now exposed through the Watchtower health API and web surface:

- API block: `data_warehouse_replacements` in `/v1/health/status`
- Web surface: `/watchtower` DW Guest Cards, DW Operating Metrics, and DW Property Metadata cards

The API reads replacement tables safely. If a remote/mirrored database does not yet contain the local DW replacement tables, the cards show a not-mirrored state instead of failing the Watchtower page.

## Daily Review Packet

Replacement-review generator:

- `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_replacement_review.mjs`

Latest packet:

- `/Users/mark/Property_Analytics/outputs/data_warehouse/replacement_reviews/20260526_175725/data_warehouse_replacement_review.md`
- `/Users/mark/Property_Analytics/outputs/data_warehouse/replacement_reviews/20260526_175725/data_warehouse_replacement_review.json`

This packet summarizes guest-card direct supply, operating baseline, metadata deltas, governed operating exclusions, and the source-owner question for unresolved operating-stat-only codes.
