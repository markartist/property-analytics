# Phase 1 Real-Chain Validation Note

Date: 2026-03-30

## Outcome

Phase 1 MVP has been operationally validated in the real local job chain.

The following completed successfully in one uninterrupted Wrangler-backed run of
[`d1_mirror_sync.py`](/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py):

- local database validation
- local database maintenance
- Wrangler authentication and remote D1 access
- governed Phase 1 HTTP sync
- downstream legacy D1 sync scripts
- D1 verification and expected-max verification

## Governed Phase 1 HTTP Sync Result

The governed Phase 1 path executed end to end for both MVP domains:

- `ga4`
  - intake
  - reconcile
  - activate
- `psi`
  - intake
  - reconcile
  - activate

Request attribution was present on the governed route calls:

- `requestId`
- `actorTag`
- `sourceTag`

Observed route actor/source tags:

- `actorTag: d1_mirror_sync`
- `sourceTag: d1_mirror_sync`

No unexpected blocked or failure outcomes were observed in the completed run.

## Evidence

Primary artifacts:

- [d1_mirror_report_20260330_172710.json](/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260330_172710.json)
- [platform_phase1_activity_20260330_172618.json](/Users/mark/Property_Analytics/apps/api/scripts/generated/platform_phase1_activity_20260330_172618.json)

Key report result:

- `success: true`

## Scope Boundary

This validation confirms the Phase 1 MVP runtime spine is working in the real
local job chain for:

- `ga4`
- `psi`
- governed mirror intake/reconciliation/activation

The `property_advocate` path remained intentionally disabled for this run and is
the next controlled enablement step.
