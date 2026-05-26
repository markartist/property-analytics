# ThirtyLines Feed Ingestion Contract

Date: 2026-04-24

## Purpose

ThirtyLines is the canonical internal feed for public availability, unit-level pricing, and unit-level specials visibility. It should support both legacy floorplan availability reporting and Captain-ready unit analysis.

## Current Ingest Shape

The collector is:

`/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py`

It reads:

`https://online.venterraliving.com/encasa-external/ThirtyLines`

## Persistence Layers

### Raw Feed Snapshot

Table:

`thirtylines_feed_snapshots`

Purpose:

- preserve the full feed response for audit and replay
- store feed hash and run counts
- make it possible to prove whether the normalized rows match the source payload

Key fields:

- `snapshot_date`
- `fetched_at`
- `payload_sha256`
- `raw_payload_json`
- `properties_seen`
- `properties_mapped`
- `properties_unmapped`
- `floorplans_seen`
- `units_seen`
- `units_with_specials`

### Floorplan Summary

Table:

`unit_availability`

Purpose:

- keep existing floorplan-level availability behavior stable
- support current, 30-day, 60-day, and after-60-day availability summaries
- preserve the full floorplan JSON in `available_units_json`

This remains the compatibility layer for existing availability consumers.

### Unit-Level Snapshot

Table:

`unit_availability_units`

Purpose:

- normalize each returned available apartment into a queryable daily snapshot
- support Captain, POP Brief, and Property Evaluation Brief analysis by unit, floorplan, available date, rent, and concession message

Key fields:

- `property_id`
- `feed_property_id`
- `floorplan_id`
- `floorplan_name`
- `unit_id`
- `building`
- `apt_number`
- `level`
- `rent_from`
- `rent_to`
- `moved_out_date`
- `available_date`
- `days_until_available`
- `availability_bucket`
- `pricing_and_specials_message`
- `concession_amount`
- `features_json`
- `images_json`
- `videos_json`
- `raw_unit_json`

## Important Interpretation Rules

1. `pricing_and_specials_message` confirms public unit-level offer visibility.
2. `concession_amount` is parsed from the public message and should be treated as advertised eligibility, not booked lease cost.
3. Actual concession dollars used on signed leases still require leasing / revenue system reconciliation.
4. `available_units` is not the canonical current unit snapshot table; it may contain older/stale unit records unless explicitly refreshed by a separate workflow.
5. The Captain should use `unit_availability_units` for current unit-level specials and inventory analysis.

## 2026-04-24 Validation

Initial hardened ingest wrote:

- 92 feed properties seen
- 91 properties mapped
- 1 unmapped training property
- 905 mapped floorplans
- 2,858 normalized unit snapshots
- 2,074 units with specials language

For The Pointe Bentonville (`482958962` / `AR4PB`) the normalized unit table now exposes current unit-level `$3,000` offer visibility by floorplan.
