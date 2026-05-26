# Phase 1 Property Advocate Enablement Plan

Date: 2026-03-30

## Objective

Enable the `property_advocate` path in the real local job chain in one
controlled, auditable step after Phase 1 mirror validation.

## Current State

Confirmed working in the real chain:

- Wrangler-backed [`d1_mirror_sync.py`](/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py)
- governed Phase 1 HTTP sync for `ga4` and `psi`
- downstream legacy sync and verification

Intentionally still disabled:

- `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN`

## Controlled Next Step

Run one explicit enablement pass with:

```bash
export ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN="true"
```

All other working inputs should remain unchanged:

- `CLOUDFLARE_API_TOKEN`
- `PLATFORM_BASE_URL`
- preferred:
  - `PLATFORM_ACCESS_CLIENT_ID`
  - `PLATFORM_ACCESS_CLIENT_SECRET`
- fallback only if the Access credential path is not live yet:
  - `PLATFORM_SHARED_TOKEN`
- `ENABLE_PHASE1_PLATFORM_SYNC=true`

## Preconditions

Before enabling `property_advocate`, confirm:

- governed platform surface is reachable
- preferred Access service-token auth succeeds
- shared-token fallback succeeds only if still retained during transition
- `agent_prop_1` is present and active
- `cb_phase1_v1` remains active
- `exec_policy_property_advocate` remains present
- latest `ga4` and `psi` mirror path is healthy

## Enablement Sequence

1. Run preflight against the local governed server.
2. Run one full Wrangler-backed [`d1_mirror_sync.py`](/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py) with `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true`.
3. Inspect generated artifacts immediately.

## Hard-Gate Inspection

Required checks after the run:

1. Mirror report
   - must still succeed overall
2. Platform activity artifact
   - must include `property_advocate`
   - must include request attribution
3. Governed property advocate result
   - execution snapshot created
   - agent runtime started
   - no unexpected blocked/failure outcomes

## Success Criteria

Enablement is successful only if:

- the overall mirror run still finishes with `success: true`
- `property_advocate` executes through the governed surface
- no new unexpected blocked/failure outcomes appear
- artifacts remain auditable and attributable

## Rollback

If any enablement step fails:

```bash
export ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN="false"
```

Then rerun the real chain with the previously validated Phase 1 mirror-only
configuration.

## Scope Boundary

This plan enables only the existing single-agent `property_advocate` MVP path.
It does not expand to:

- supervisor workflows
- multi-agent orchestration
- full Issue workflow
- broader portfolio rollout
