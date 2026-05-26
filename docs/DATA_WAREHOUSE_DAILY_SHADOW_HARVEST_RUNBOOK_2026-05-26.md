# Data Warehouse Daily Shadow Harvest Runbook

Status: Active shadow routine
Date: 2026-05-26
Owner: Data Collection / Data Pond
Routine: `/Users/mark/Property_Analytics/scripts/run_data_warehouse_daily_harvest.mjs`

## Purpose

Run a daily, read-only, aggregate-only Data Warehouse harvest that gives The Pond empirical leasing-funnel evidence without replacing approved source contracts before reconciliation is complete.

This routine is a shadow routine. It is not yet the canonical guest-card collector and does not write to production Pond tables.

## Access And Credentials

- SQL Server alias: `sqlreport.ocs-vr.onecornerstone.com`
- Database: `data_warehouse`
- Login: `dw_reader`
- Network path: AWS VPN
- Credential source: Keeper/KSM record `Data Warehouse`

Raw credential values must not be written to docs, logs, command arguments, manifests, workbook connection strings, or local credential files.

## Manual Run

From `/Users/mark/Property_Analytics`:

```bash
node scripts/run_data_warehouse_daily_harvest.mjs --days-back 1
```

The script installs its SQL client dependency into `/Users/mark/.cache/venterra-dw-harvest` if needed. The dependency cache does not contain Data Warehouse credentials.

## Scheduled Run

Codex local automation `data-warehouse-daily-shadow-harvest` runs the same command daily in the morning from `/Users/mark/Property_Analytics`, then runs `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs` in shadow-only mode, then runs `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_captain_advisory.mjs` so Captains receive a current advisory signal packet.

The run depends on local VPN reachability and Keeper/KSM availability. If either is unavailable, the automation should report sanitized failure context only.

## Output Packet

Each run writes a timestamped folder under:

```text
/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/
```

Current packet files:

- `summary.json`: run metadata, aggregate totals, watch counts, data-quality counts, top aggregate slices, and output file paths
- `property_funnel.csv`: active-property aggregate funnel metrics
- `source_mix.csv`: property/source aggregate guest-card counts
- `watch_items.csv`: business watch items for funnel gaps and low rates
- `data_quality_items.csv`: source integrity checks such as future-dated warehouse timestamps
- `source_freshness.csv`: row counts and min/max timestamps by source object

Direct supply without CSV:

- `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`
- Runbook: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DIRECT_GUEST_CARD_SUPPLY_2026-05-26.md`
- Default target: `guest_card_metrics_dw_direct`
- Default mode: `shadow_only`
- Canonical table `guest_card_metrics` is not updated unless the operator explicitly runs `--apply-canonical --trusted-core-only`.

## Property Identity Governance

Property identity for this lane resolves through:

- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`
- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh`

Run:

```bash
bash scripts/check_property_identity_governance.sh
```

The check validates the matrix and the latest `property_funnel.csv` packet by exact property-code resolution. It does not fuzzy-match property names or invent missing mappings.

Current status:

- The latest warehouse harvest has 92 property rows and all 92 resolve through the matrix.
- The Vine Kyle Parkway now carries the empirically observed Data Warehouse `property_cd` `TX4EK`.
- Sundara at Spring Cypress now carries the empirically observed Data Warehouse `property_cd` `TX4CY`; the warehouse currently reports it as `PENDING`, so it did not appear in the latest active-property harvest.

## First Clean Run

Packet:

```text
/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/2026-05-26_20260526_152346
```

Completed window: `2026-05-25` to `2026-05-26`

Aggregate results:

- active properties: 92
- properties with guest cards: 86
- guest cards: 363
- previous guest cards: 328
- guest-card delta: 35
- portal quotes: 185
- online apps: 89
- pipeline apps: 3
- IPT appointments: 62
- SGT appointments: 41
- advisory lease events: 24
- business watch items: 18
- data-quality items: 1

The first data-quality item flags `dbo.dw_prospect_log_entry.created_dtt` because the source max timestamp is future-dated relative to SQL Server time. This does not invalidate the completed-window tour counts by itself, but it must remain visible before this lane is promoted to trusted Captain use.

## Promotion Gates

Before this routine becomes canonical Data Collection:

1. Compare generated guest-card metrics against at least 5 historical daily export files.
2. Resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
3. Add validation artifacts for unmapped properties, row counts, duplicate keys, source freshness, and contract version.
4. Decide whether promotion writes the existing OneDrive CSV contract or writes directly to Pond tables.
5. Expose source health in Watchtower before Captain routines consume the lane as trusted evidence.

Current reconciliation result:

- `/Users/mark/Property_Analytics/scripts/reconcile_data_warehouse_guest_card_exports.mjs` performs the historical export comparison.
- Latest proof-set notes live at `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_GUEST_CARD_RECONCILIATION_2026-05-26.md`.
- The first 10-file proof set did not pass trusted promotion: row/metadata coverage matched, but 36 metric deltas remained, concentrated in pipeline apps, quotes, and one IPT appointment.
- Keep this lane `degraded_advisory` until source-owner review or same-day repeated reconciliation explains the deltas.

## Integrity Rules

- Do not include prospect names, emails, phone numbers, notes, or raw application data.
- Keep all outputs aggregate-only until a specific approved source contract requires a narrower exception.
- Treat `advisory_lease_events` as advisory only; it uses `prospect_bv.leased_dt` and is not yet an approved lease metric.
- Never fabricate missing rows, rates, or mappings. Missing or questionable data should be flagged as missing, stale, degraded, advisory, or validation-failed.
