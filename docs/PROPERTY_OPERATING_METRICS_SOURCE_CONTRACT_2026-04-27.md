# Property Operating Metrics Source Contract

Date: 2026-04-27
Owner: Data Pond + Captain's Log
Initial property: The Pointe Bentonville (`AR4PB`)

## Purpose

This contract defines the official operating source file needed by Captain Benton and future Captain Briefs. These values are source-of-record internal operating facts. They must not be inferred from AptIQ, ApartmentIQ, public unit-feed specials, or vendor-estimated occupancy.

## Drop Location

Files are monitored in:

`/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports`

## Accepted Files

Accepted extensions:

- `.csv`
- `.xlsx`
- `.xlsm`

The filename must include operating intent plus a property/report signal. Recommended pattern:

`Property-Operating-Metrics-AR4PB-YYYYMMDD.csv`

Examples:

- `Property-Operating-Metrics-AR4PB-20260427.csv`
- `Operating-Metrics-The-Pointe-Bentonville-20260427.xlsx`

## Drop-Ready Template

The current AR4PB template is:

`/Users/mark/Property_Analytics/docs/contracts/property_operating_metrics_template_AR4PB.csv`

To copy a blank dated template into the monitored drop:

```bash
python3 scripts/operating_metrics_brief_intake.py --create-template --date 2026-04-30
```

This writes:

`/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Property-Operating-Metrics-AR4PB-20260430.csv`

## Required Columns

At minimum, each file must include:

- `Property Code`
- `Report Date`
- `Occupancy`
- `Leased %`
- `Total Units`
- `Leases`
- `Cancellations`
- `Booked Concession Dollars`

Recommended additional columns:

- `Occupied Units`
- `Leased Units`
- `Available Units`
- `Denials`
- `Move Ins`
- `Move Outs`
- `Booked Concession Lease Count`

Template column order:

```csv
Property Code,Report Date,Period Start,Period End,Occupancy,Leased %,Occupied Units,Leased Units,Available Units,Total Units,Leases,Cancellations,Denials,Move Ins,Move Outs,Booked Concession Dollars,Booked Concession Lease Count
```

## Date Semantics

`Report Date` is the operating snapshot date and maps to `property_operating_metrics.metric_date`.

If the file covers a date range, include:

- `Period Start`
- `Period End`

When `Report Date` is absent, `Period End` may be used as the metric date.

## Storage Target

The canonical table is:

`property_operating_metrics`

The ingestion path is:

- Manual/API script: `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py`
- Operator wrapper: `/Users/mark/Property_Analytics/scripts/operating_metrics_brief_intake.py`
- Daily collection wrapper: `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py`
- Daily orchestration: `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- Retry orchestration: `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`

## Validate, Ingest, And Regenerate Brief

Validate only:

```bash
python3 scripts/operating_metrics_brief_intake.py \
  --source-file "/path/to/Property-Operating-Metrics-AR4PB-20260430.csv"
```

Ingest locally and mirror to remote D1:

```bash
python3 scripts/operating_metrics_brief_intake.py \
  --source-file "/path/to/Property-Operating-Metrics-AR4PB-20260430.csv" \
  --ingest \
  --remote
```

Ingest, mirror, regenerate the Captain Brief, and email the Outlook-safe version:

```bash
python3 scripts/operating_metrics_brief_intake.py \
  --source-file "/path/to/Property-Operating-Metrics-AR4PB-20260430.csv" \
  --ingest \
  --remote \
  --regenerate-brief \
  --send
```

## Escalation Rule

If no official operating metrics file has been received for `AR4PB` by the morning collection window, Data Collection must record:

`No official operating metrics file received for AR4PB.`

This is a source-routing/manual dependency, not a reason to use AptIQ-estimated internal operating values.
