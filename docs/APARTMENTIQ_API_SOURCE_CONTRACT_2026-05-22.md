# ApartmentIQ API Source Contract

Date: 2026-05-22
Owner: Data Collection / Data Pond / Captain's Log
Status: Active advisory source route

## Purpose

The ApartmentIQ API connector stores live ApartmentIQ market survey, unit, and floorplan source facts in the Pond. This route extends the existing AptIQ / ApartmentIQ advisory evidence lane from static watchlist PDFs to API-backed market/comps data.

ApartmentIQ remains advisory. It can support competitive-set, pricing, concession, exposure, days-on-market, and market-position reads, but it does not override Venterra source-of-record operating facts, unit availability, guest-card metrics, Marketing BI funnel exports, or official operating metrics.

## Source Authority

ApartmentIQ API documentation:

- `https://developers.apartmentiq.io/getting-started`
- `https://developers.apartmentiq.io/api-reference/accounts/list-accounts`
- `https://developers.apartmentiq.io/api-reference/market-surveys/list-competitive-sets`
- `https://developers.apartmentiq.io/api-reference/market-surveys/get-market-survey-data`
- `https://developers.apartmentiq.io/api-reference/market-surveys/list-units-in-competitive-set`
- `https://developers.apartmentiq.io/api-reference/market-surveys/list-floorplans`
- `https://developers.apartmentiq.io/api-reference/bulk-data-export/create-batch-job`

Base URL:

- `https://data.apartmentiq.io/apartmentiq/api/v1`

Authentication:

- Bearer token
- Keeper record: `ApartmentIQ API`
- Default local notation: `keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password`
- Override env var: `KSM_APARTMENTIQ_API_KEY_NOTATION`
- Plain local fallback for one-off smoke tests: `APARTMENTIQ_API_KEY`

## Implementation

Canonical connector:

- `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py`

Config:

- `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml`

Schema:

- `/Users/mark/Property_Analytics/apps/api/migrations/0055_create_apartmentiq_tables.sql`
- `/Users/mark/Property_Analytics/infra/migrations/034_create_apartmentiq_tables.sql`

Daily orchestration:

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

The initial scheduled posture collects accounts, comp sets, and market survey items. Unit and floorplan collection are implemented and can be enabled in config after request volume and table growth are reviewed.

## Pond Tables

- `apartmentiq_accounts`
- `apartmentiq_comp_sets`
- `apartmentiq_market_survey_items`
- `apartmentiq_units`
- `apartmentiq_floorplans`
- `apartmentiq_property_identity_links`

The tables preserve raw JSON alongside selected typed fields so downstream reads can use stable columns while retaining auditability against the vendor response.

## Identity Governance

Subject-property matching uses:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

The connector writes stable ApartmentIQ subject property IDs to `apartmentiq_property_identity_links` only when the source row is marked `subject_property` and the subject name/address resolves through the governed matrix.

The matrix generation path now reads those links and publishes prefixed source identifiers as `apartmentiq_property_ids`. Future downstream code must resolve ApartmentIQ IDs through `apartmentiq:{id}` / `aptiq:{id}` keys rather than adding one-off property maps.

## Collection Notes

Default guardrails:

- `max_comp_sets_per_run: 20`
- `rate_limit_sleep_seconds: 8.0`
- `max_retries: 4`
- market survey enabled
- units and floorplans disabled by default

The public docs state a 100 requests per 5 minutes rate limit on API errors. Immediate full-run testing on 2026-05-22 showed a stricter rolling-window behavior after bursty exploratory pulls, so broad unit/floorplan collection uses conservative pacing and a long 429 backoff.

## Operating Cadence

Daily light touch:

- `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh`
- refreshes accounts, comp sets, and market survey rows for governed subject-linked comp sets only
- defaults to `APARTMENTIQ_DAILY_MAX_COMP_SETS=5`
- generates `/Users/mark/Property_Analytics/reports/apartmentiq/<date>/apartmentiq_enrichment_summary_<date>.md`

Weekly dive:

- `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh`
- runs a stale-first staggered portfolio pass for accounts, comp sets, market survey rows, unit rows, and floorplan rows
- defaults to `APARTMENTIQ_WEEKLY_MAX_COMP_SETS=60`
- rebuilds the governed identity matrix so stable ApartmentIQ subject IDs can resolve through `apartmentiq:{id}`

Active Codex automations:

- `apartmentiq-daily-light-refresh`: daily 06:35 local
- `apartmentiq-weekly-portfolio-dive`: Monday 07:15 local
- `apartmentiq-full-baseline-retry-today`: temporary Friday 12:30 local retry for the 2026-05-22 first full baseline; delete or pause after success

## Captain Use

Captain Briefs may use ApartmentIQ API facts to:

- compare subject-property rents, NER, concessions, exposure, and review context against current comp sets
- identify competitive-unit or floorplan pressure
- explain advisory market hypotheses beside Pond source-of-record performance facts
- preserve vendor-only market claims without treating them as official internal operating truth
