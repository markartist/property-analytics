# Phase 1 Cutover Runbook

## Purpose
Safely enable the governed Phase 1 runtime in the real local job chain.

## Scope
This runbook covers:
- local Mac validated-batch mirror path for `ga4` and `psi`
- optional governed `property_advocate` run
- first-run inspection and rollback

## Prechecks
Before cutover:
1. Confirm the real D1 migration is applied:
   - [`0021_create_phase1_platform_tables.sql`](/Users/mark/Property_Analytics/apps/api/migrations/0021_create_phase1_platform_tables.sql)
2. Confirm control-plane seed data exists in D1.
3. Confirm the API is reachable at `PLATFORM_BASE_URL`.
4. Confirm the shared bearer token is valid for `/v1/platform/*`.
5. Confirm the local Mac environment includes:
   - `PLATFORM_BASE_URL`
   - `PLATFORM_SHARED_TOKEN`
   - `ENABLE_PHASE1_PLATFORM_SYNC=true`
6. Decide whether `property_advocate` is enabled on first cutover:
   - mirror-only rollout: keep `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=false`
   - full Phase 1 rollout: set `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true`

## Enablement Sequence
1. Apply D1 migration.
2. Apply Phase 1 seed/control-plane rows.
3. Export the required Phase 1 environment variables into the local job environment.
4. Run the operational smoke verification script once manually.
5. If smoke passes, run:
   - [`d1_mirror_sync.py`](/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py)
6. If that passes, allow the next scheduled daily job to run with Phase 1 enabled.

## First-Run Verification
Inspect:
- latest mirror report:
  - `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_*.json`
- latest Phase 1 activity report:
  - `/Users/mark/Property_Analytics/apps/api/scripts/generated/platform_phase1_activity_*.json`
- route logs containing:
  - `component=platform_route`
  - request id
  - actor/source
  - blocked/failure outcomes

Confirm:
- `phase1_platform.enabled = true`
- `ga4` path includes:
  - intake result
  - reconcile result
  - activate result
- `psi` path includes:
  - intake result
  - reconcile result
  - activate result
- if advocate enabled:
  - `property_advocate.response.result.runtime.agentId` exists
  - `pipelineHealth.length = 2`

## Success Criteria
Cutover is successful when:
- `d1_mirror_sync.py` exits `0`
- Phase 1 activity artifact exists
- no blocked/failure outcomes appear in the activity artifact for the enabled path
- `ga4` and `psi` both reach activation
- if advocate enabled, `property_advocate/run` returns success

## Rollback Criteria
Rollback immediately if any of the following occur:
- missing or invalid `PLATFORM_SHARED_TOKEN`
- `/v1/platform/*` returns blocked or unauthorized unexpectedly
- mirror intake/reconcile/activate fails for `ga4` or `psi`
- Phase 1 activity artifact records an error
- `d1_mirror_sync.py` exits non-zero because of Phase 1 path failure

## Rollback Actions
1. Set `ENABLE_PHASE1_PLATFORM_SYNC=false`
2. Set `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=false`
3. Re-run `d1_mirror_sync.py` to confirm Phase 1 is skipped cleanly
4. Preserve the latest:
   - `d1_mirror_report_*.json`
   - `platform_phase1_activity_*.json`
5. Inspect route logs using the request ids captured in the activity artifact

## Notes
- Rollback is configuration-based; no schema rollback is required for disabling the path.
- The governed HTTP surface remains the only valid integration path for Phase 1.
