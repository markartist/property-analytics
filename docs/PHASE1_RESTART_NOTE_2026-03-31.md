# Phase 1 Restart Note

Date: 2026-03-31

## Current Confirmed State

Phase 1 is operationally validated in the real local job chain.

Confirmed milestones:

- mirror-only real-chain validation completed successfully
- `property_advocate` controlled enablement run completed successfully
- real Wrangler-backed [`d1_mirror_sync.py`](/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py) completed with:
  - governed Phase 1 HTTP sync for `ga4` and `psi`
  - downstream legacy syncs
  - D1 verification

## Most Recent Key Artifacts

Mirror chain with advocate enabled:

- [d1_mirror_report_20260330_205120.json](/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260330_205120.json)
- [platform_phase1_activity_20260330_205019.json](/Users/mark/Property_Analytics/apps/api/scripts/generated/platform_phase1_activity_20260330_205019.json)

Mirror-only real-chain milestone:

- [d1_mirror_report_20260330_172710.json](/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260330_172710.json)
- [platform_phase1_activity_20260330_172618.json](/Users/mark/Property_Analytics/apps/api/scripts/generated/platform_phase1_activity_20260330_172618.json)

## Key Runtime IDs From Advocate Enablement

- execution snapshot id:
  - `03d4ef34-e3ea-4c67-905e-c4b2e3200dbe`
- agent runtime binding id:
  - `b5461d76-be45-437f-8a33-49fc8c34fee1`

## Current Recommended Runtime Flags

- `ENABLE_PHASE1_PLATFORM_SYNC=true`
- `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true`

Cloudflare access should use:

- `CLOUDFLARE_API_TOKEN`

Do not rely on the stale Wrangler cached login token.

## Next Resume Point

Resume from post-validation monitoring and controlled follow-through, not from
architecture or initial build work.

Immediate likely next tasks:

- monitor a few real runs with advocate enabled
- watch for any unexpected lifecycle emissions
- decide when to begin Issue workflow / richer observability work

## Guardrails

- PIB canonical files remain locked
- continue running:
  - `bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh`

## Branch

- `codex/pilot-control-cwv-reporting`
