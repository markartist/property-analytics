# Portfolio Monitoring Consolidation Map

Status: Draft v1
Date: 2026-04-18
Owner: MarketingOps / Property Analytics

## Purpose

Define how `Portfolio_Monitoring` should be treated during enterprise consolidation.

This directory still matters, but it should no longer quietly present itself as the canonical owner of major platform outcomes.

## Enterprise Disposition

`Portfolio_Monitoring` is:

- `Legacy-Reusable`

It is not:

- the canonical collection system
- the canonical operational health surface
- the canonical portfolio navigation layer

## Canonical Replacements

### Collection orchestration

Old pattern:

- `Portfolio_Monitoring/collect_daily_data.py`

Canonical owner now:

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`

### Operational health and closure

Old pattern:

- local monitoring and pulse logic inside `Portfolio_Monitoring`

Canonical owner now:

- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/`
- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- `/Users/mark/Property_Analytics/Data_Collection/monitoring/`

### Portfolio insight and navigation

Old pattern:

- Portfolio_Monitoring as a practical operator starting point

Canonical owner now:

- `/Users/mark/Property_Analytics/apps/web/src/app/dock/`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/`

## What To Preserve

Preserve these categories as reusable/reference assets:

- local backfills and repair utilities
- report-generation patterns
- legacy analysis helpers
- migration-useful docs and signal logic

## What To Stop Growing

Do not continue growing these outcomes in `Portfolio_Monitoring`:

- canonical daily collection ownership
- canonical alert ownership
- canonical operational dashboard ownership
- canonical report discovery/navigation ownership

## Practical Next Moves

1. keep updating root and local docs so canonical entrypoints point to Data Collection, Watchtower, Dock, and app-native surfaces
2. preserve targeted utilities here until each one is either retired or absorbed
3. treat this directory as a migration boundary and reference lane, not a default build target
