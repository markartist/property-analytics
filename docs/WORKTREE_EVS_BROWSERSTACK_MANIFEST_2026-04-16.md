# EVS / BrowserStack Worktree Manifest

Date: 2026-04-16
Compartment: `evs-browserstack`

## Purpose

This manifest defines the experiential validation lane so it can be worked, reviewed, and committed independently from the core `platform-app` lane.

## Included Files

### API / EVS Core

- `/Users/mark/Property_Analytics/apps/api/migrations/0020_create_evs_tables.sql`
- `/Users/mark/Property_Analytics/apps/api/src/evs/`
- `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/evs-auth.test.ts`

### BrowserStack / Runner Support

- `/Users/mark/Property_Analytics/ops/browserstack/`
- `/Users/mark/Property_Analytics/evs/`
- `/Users/mark/Property_Analytics/.github/workflows/evs-browserstack-experiential.yml`
- `/Users/mark/Property_Analytics/run_pilot_browserstack_daily.sh`

### Shared Dependency

- `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`

## Included Themes

- EVS validation request persistence
- EVS ingest authentication and result normalization
- BrowserStack execution support
- GitHub workflow orchestration for experiential runs

## Excluded Themes

These should not be folded into `evs-browserstack` commits unless the dependency is direct:

- Watchtower and `/v1/health/status`
- Cloudflare browser bootstrap and login flow
- Data Collection orchestration and closure logic
- Site Content / Intelligence Office / VACS work

## Current Assessment

This lane is real, but it is not blocking `platform-app` core completion:

- EVS ingest auth coverage is green
- EVS request/result persistence shape is in place
- BrowserStack workflow scaffolding exists
- workflow dispatch from the API is still intentionally not wired

Companion finish-order doc:

- `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_FINISH_ORDER_2026-04-16.md`
