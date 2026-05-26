# Data Warehouse Direct Guest-Card Supply

Status: Active shadow supplier
Date: 2026-05-26
Owner: Data Collection / Data Warehouse
Script: `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`

## Purpose

Supply guest-card metrics from Data Warehouse directly into local records without creating, moving, or harvesting a CSV file.

This is the replacement path for the daily `Website Data CSV` file drop, but it remains shadow-only by default until reconciliation explains the remaining quote, pipeline-app, and tour drift.

## Current Behavior

Default command:

```bash
node scripts/supply_guest_card_metrics_from_data_warehouse.mjs --days-back 1
```

Default mode:

```text
shadow_only
```

The default mode writes to:

```text
guest_card_metrics_dw_direct
```

It does not update:

```text
guest_card_metrics
```

## Why Shadow First

The historical export reconciliation proved:

- property rows match
- property metadata matches
- guest-card counts match
- online application counts match
- some pipeline app, quote, and tour counts drift against historical files

Therefore the direct supplier separates:

- trusted core fields
- degraded advisory fields

## Trusted Core Fields

These can be promoted first once the operator chooses canonical apply mode:

- `run_date`
- `days_in_period`
- `property_code`
- `property_name`
- `gc_this_period`
- `init_cont_quote`
- `init_cont_phone`
- `init_cont_apply`
- `init_cont_tour`
- `gc_prev_period`
- `prev_init_cont_quote`
- `prev_init_cont_phone`
- `prev_init_cont_apply`
- `prev_init_cont_tour`
- `apps_this_period`
- `prev_apps`

## Advisory Fields

These remain `degraded_advisory` until source drift is explained:

- `quotes_this_period`
- `prev_quotes`
- `pipe_apps_this_period`
- `pipe_prev_apps`
- `ipt_appt_this_period`
- `prev_ipt_appt`
- `sgt_appt_this_period`
- `prev_sgt_appt`

## First Shadow Supply Run

Command:

```bash
node scripts/supply_guest_card_metrics_from_data_warehouse.mjs --run-date 2026-05-26
```

Report:

```text
/Users/mark/Property_Analytics/outputs/data_warehouse/direct_supply/guest_card_metrics/2026-05-26_20260526_172120/direct_supply_report.json
```

Results:

- mode: `shadow_only`
- rows supplied to `guest_card_metrics_dw_direct`: 92
- canonical rows upserted: 0
- trusted guest cards: 363
- trusted online apps: 89
- advisory quotes: 185
- advisory pipeline apps: 3
- advisory tours: 103

## Canonical Apply Mode

Canonical apply is intentionally explicit:

```bash
node scripts/supply_guest_card_metrics_from_data_warehouse.mjs --run-date YYYY-MM-DD --apply-canonical --trusted-core-only
```

This mode updates only the trusted core fields in `guest_card_metrics`.

For existing rows, it preserves advisory columns already supplied by the CSV path. For new rows, advisory columns are left `NULL` instead of fabricating or backfilling values that have not yet reconciled.

Do not use canonical apply as the default daily job until the owner accepts field-level trust behavior.

## Daily Automation

Codex local automation `data-warehouse-daily-shadow-harvest` now runs:

1. Data Warehouse shadow harvest
2. direct guest-card shadow supply
3. Captain advisory generation

The automation is still forbidden from canonical apply unless an operator explicitly requests that mode for the current run.
