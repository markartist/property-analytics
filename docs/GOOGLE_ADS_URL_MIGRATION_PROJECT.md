# Google Ads URL Migration Project

## Objective
Migrate legacy ad destination URLs to a new canonical URL scheme (including future `-city-state` slugs) using a controlled, auditable process.

## Current State (as of 2026-03-04)
- Live Google Ads account confirmed: `9089267423`.
- Deterministic campaign attribution is in place (`campaign_id -> property_id`).
- High-spend unmatched campaign guardrail is enabled in collector.
- URL discovery from active ads is implemented.

## Completed Deliverables
1. Deterministic campaign mapping
- File: `/Users/mark/Property_Analytics/config/google_ads_campaign_property_mapping.json`
- Coverage: 112 mapped campaigns, 85 mapped properties, 0 unmatched campaigns.

2. Collector guardrail for mapping drift
- File: `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_google_ads_data.py`
- Behavior: hard-fails when unmatched campaigns exceed spend threshold.
- Env override: `GOOGLE_ADS_UNMATCHED_SPEND_THRESHOLD` (default `$1000`).

3. Asset/ad edit exploration tooling (safe by default)
- File: `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/google_ads_asset_editor.py`
- Supports list + validate-only mutations for ad status and campaign-asset status.

4. Live URL inventory + migration lookup
- Generated lookup: `/Users/mark/Property_Analytics/config/google_ads_url_lookup.csv`
- Planning lookup for upcoming master URL list: `/Users/mark/Property_Analytics/config/google_ads_url_migration_lookup.csv`

## Confirmed Constraints
- Registry currently has city/state populated for only 3/93 properties.
- Therefore, final `-city-state` URL values must come from the external master lookup table provided by business/marketing.

## Agreed Source of Truth
User will supply a **master lookup table** with `legacy_url -> new_url` mappings.

Minimum required columns:
- `legacy_url`
- `new_url`

Recommended columns:
- `property_name`
- `campaign_id`
- `enabled`
- `notes`

## Execution Plan (No live changes until approved)
1. Ingest and validate master lookup
- URL parse validation
- duplicate/conflict detection
- null/blank checks

2. Build impact plan
- match `legacy_url` to active ads/campaigns
- produce `would_update` report by property/campaign

3. Validate-only Google Ads mutations
- run API `validate_only` updates
- export pass/fail diagnostics

4. Execute after explicit approval
- apply updates in batches
- produce post-run audit (`updated`, `skipped`, `failed`)

## Safety Rules
- No mutations without explicit user approval.
- Always run validate-only pass first.
- Keep rollback/audit CSVs for every execution batch.

## Next Trigger
When master lookup table is provided, execute the ingestion/validation workflow and produce an execution-ready plan.
