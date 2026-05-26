# Data Warehouse Guest-Card Export Reconciliation

Status: Shadow validation result
Date: 2026-05-26
Owner: Data Collection / Data Warehouse / Captain Runtime
Script: `/Users/mark/Property_Analytics/scripts/reconcile_data_warehouse_guest_card_exports.mjs`

## Purpose

Compare the Data Warehouse-generated guest-card export contract against the historical daily `Website Data CSV-YYYYMMDD_HHMMSS.csv` files before promoting the Data Warehouse lane from advisory to trusted.

This is the promotion gate for replacing the manual Excel / Power Automate Desktop export path.

## Method

The reconciliation script:

1. discovers recent historical `Website Data CSV` files in the shared `Guest_Card_Reports` folder and archive
2. reads each file's `RunDt` and `Days in Period`
3. regenerates the same 24-column export contract from Data Warehouse using Keeper/KSM credentials
4. compares rows by `property_cd`
5. compares each metric with zero tolerance
6. writes generated exports and delta artifacts

No prospect, applicant, resident, phone, email, or note-level data is extracted.

## Latest 10-File Run

Output packet:

```text
/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126
```

Summary:

- files checked: 10
- exact-match files: 2
- mismatch files: 8
- expected rows vs generated rows: matched for all files
- metadata deltas: 0
- row deltas: 0
- metric deltas: 36
- total absolute metric delta: 47

Exact-match files:

- `2026-05-18`
- `2026-05-26`

Important positive finding:

- Active-property coverage and `property_cd`/`property_name` contract shape matched across the proof set.
- `GC This Period` matched in all 10 files.
- `Apps This Period` matched in all 10 files.

Observed deltas by metric family:

| Metric | Delta Rows | Absolute Delta |
| --- | ---: | ---: |
| `Pipe Apps This Period` | 21 | 24 |
| `Pipe Prev Apps` | 10 | 10 |
| `Quotes This Period` | 2 | 6 |
| `Prev Quotes` | 2 | 6 |
| `IPT Appt This Period` | 1 | 1 |

Interpretation:

- The row contract is stable.
- The core guest-card and online-application counts are stable across the sample.
- The largest drift is in pipeline applications, which may indicate mutable source rows, timing differences between original export time and current Data Warehouse state, or a hidden filter/schema difference in the original Power Automate/Excel execution context.
- Quote and tour drift is small but real and must be explained before trusted promotion.

## Current Trust Decision

The Data Warehouse leasing-funnel lane remains:

```text
degraded_advisory
```

It should not yet replace the manual CSV as the canonical source of truth. Captains may use generated signal packs as advisory evidence with lineage and caveats.

## Next Reconciliation Work

1. Ask Data Warehouse / BI owner whether `dw_pipeline_applications`, `prospect_quote_bv`, or `dw_prospect_log_entry` are mutable after the original export run time.
2. Confirm whether the old Excel / PAD query ran against the same schema bindings now used by the script (`dw_read` views plus selected `dbo` objects).
3. Compare same-day exports immediately after generation for several days to separate historical mutability from query-definition mismatch.
4. Add a promotion threshold, for example:
   - `GC This Period`, `GC Prev Period`, and online apps must be exact.
   - Pipeline app, quote, and tour deltas require source-owner explanation or accepted tolerance.
5. Only after reconciliation passes, promote `dw_leasing_funnel_shadow` from `degraded_advisory` to a trusted or partially trusted Captain lane.

## Key Artifacts

- File summary: `/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126/file_results.csv`
- Metric deltas: `/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126/metric_deltas.csv`
- Metadata deltas: `/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126/metadata_deltas.csv`
- Row deltas: `/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126/row_deltas.csv`
- Summary JSON: `/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126/reconciliation_summary.json`
