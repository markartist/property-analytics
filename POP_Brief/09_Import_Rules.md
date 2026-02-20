# 09 Import Rules
Title: POP Brief Import Rules
Version: 1.0.0
Status: Authoritative for v1 Imports
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Data Operations Steward: TBD
- Engineering Steward: TBD
## Week-Ending Friday Enforcement
- `metric_date` and `week_ending` values must be Friday.
- Any non-Friday date causes hard validation failure for the row and import run.
- No auto-correction or nearest-Friday coercion is allowed.
## Supported Import Modes
- Paste TSV:
  - Admin pastes tab-separated content into import endpoint payload.
- CSV upload:
  - Admin uploads CSV file.
  - File is stored in R2, then parsed and validated by API.
## Required Columns
### weekly_metrics required columns
- `metric_date`
- `window_days`
- `type`
- `occupancy_rate` (or defined required metric subset for configured schema)
Conditional:
- `community_external_key` required when `type=community`.
### marketing_weekly required columns
- `week_ending`
- `community_external_key`
- `leads_count`
## Validation Rules
- Date rules:
  - ISO date format required.
  - Friday-only enforcement required.
- Numeric coercion:
  - Accept numeric strings and normalize.
  - Percent fields accept `95` or `95%` and normalize to decimal (`0.95`) if configured; reject ambiguous mixed formats within same field policy.
- Enum constraints:
  - `type` must be `community` or `portfolio`.
  - `window_days` must be `7` or `30`.
- Referential integrity:
  - `community_external_key` must resolve to existing active community for community-scoped rows.
## Transaction Rules
- Import executes in a single transaction per scoped entity/date/window/type set.
- Existing rows matching composite keys are deleted and new rows inserted atomically.
- On any validation or write error, transaction rolls back fully.
- Import response must include run identifier and final status.
## Import Run Logging
Fields captured in `import_runs`:
- `id`
- `entity_type`
- `mode`
- `status`
- `requested_by_user_id`
- `request_idempotency_key`
- `source_filename`
- `source_r2_key`
- `rows_received`
- `rows_applied`
- `error_summary`
- `started_at`
- `finished_at`
Lifecycle statuses:
- `queued`
- `validating`
- `applied`
- `failed`
