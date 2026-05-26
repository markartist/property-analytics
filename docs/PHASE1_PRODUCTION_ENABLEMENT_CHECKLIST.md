# Phase 1 Production Enablement Checklist

## Purpose
Enable the governed Phase 1 runtime in the real local job chain without changing the locked architecture.

## 1. D1 Schema
- [ ] Apply [`0021_create_phase1_platform_tables.sql`](/Users/mark/Property_Analytics/apps/api/migrations/0021_create_phase1_platform_tables.sql) to the real `pop-brief-db`
- [ ] Apply [`0023_seed_phase1_platform_control_plane.sql`](/Users/mark/Property_Analytics/apps/api/migrations/0023_seed_phase1_platform_control_plane.sql) to the real `pop-brief-db`
- [ ] Confirm all Phase 1 tables exist in D1
- [ ] Confirm the migration was applied exactly once

## 2. Control-Plane Seed Data
- [ ] Confirm `0023_seed_phase1_platform_control_plane.sql` inserted:
  - `mirror_domains` for `ga4` and `psi`
  - `contract_bundles`
  - `contract_bundle_resolution_policies`
  - `pipeline_health_policies`
  - `execution_snapshot_policies`
  - `agent_noise_budget_policies`
  - `agent_evaluation_profiles`
  - `agent_contracts`
  - `agent_identities`
  - `issue_family_registry`
  - `issue_lifecycle_policies`
- [ ] Confirm seed rows match the expected Phase 1 ids:
  - `cb_phase1_v1`
  - `exec_policy_property_advocate`
  - `nb_property_advocate_default`
  - `eval_property_advocate_default`
  - `ac_property_advocate_v1`
  - `agent_prop_1`

## 3. Environment Variables
- [ ] Set `PLATFORM_BASE_URL` on the local Mac job environment
- [ ] Preferred: set `PLATFORM_ACCESS_CLIENT_ID` on the local Mac job environment
- [ ] Preferred: set `PLATFORM_ACCESS_CLIENT_SECRET` on the local Mac job environment
- [ ] Transitional fallback only: set `PLATFORM_SHARED_TOKEN` on the local Mac job environment if Access credentials are not live yet
- [ ] Set `ENABLE_PHASE1_PLATFORM_SYNC=true`
- [ ] Set `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true` only when ready to enable the governed advocate path
- [ ] Optionally set:
  - `PLATFORM_ROUTE_ACTOR`
  - `PLATFORM_ROUTE_SOURCE`
  - `PLATFORM_OPERATOR_ID`
  - `PHASE1_CONTRACT_BUNDLE_ID`
  - `PHASE1_EXECUTION_POLICY_ID`
  - `PHASE1_PROPERTY_ADVOCATE_AGENT_ID`
  - `PHASE1_PROPERTY_ADVOCATE_PROPERTY_ID`

## 4. Route Auth Expectations
- [ ] Confirm `/v1/platform/*` is reachable at `PLATFORM_BASE_URL`
- [ ] Preferred: confirm Cloudflare Access client credentials match:
  - `PLATFORM_ACCESS_CLIENT_ID`
  - `PLATFORM_ACCESS_CLIENT_SECRET`
- [ ] Transitional fallback: confirm the shared bearer token matches `PLATFORM_SHARED_TOKEN` if still used
- [ ] Confirm the local job sends one of:
  - `CF-Access-Client-Id` plus `CF-Access-Client-Secret`
  - or `Authorization: Bearer <PLATFORM_SHARED_TOKEN>` during transition
- [ ] Confirm the local job also sends:
  - `X-Platform-Actor`
  - `X-Platform-Source`

## 5. Rollout Flags
- [ ] First rollout: set `ENABLE_PHASE1_PLATFORM_SYNC=true`
- [ ] First rollout: leave `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=false` if you want mirror-only cutover
- [ ] Second rollout: set `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true`

## 6. Smoke Verification After Enablement
- [ ] Run the Phase 1 smoke verification script
- [ ] Confirm `ga4` mirror intake/reconcile/activate succeeds
- [ ] Confirm `psi` mirror intake/reconcile/activate succeeds
- [ ] Confirm `platform_phase1_activity_*.json` is written
- [ ] Confirm the normal `d1_mirror_report_*.json` includes `phase1_platform`
- [ ] If advocate enabled, confirm `/v1/platform/property-advocate/run` succeeds

## 7. Operator Inspection
- [ ] Inspect route logs for request ids and blocked/failure outcomes
- [ ] Inspect the latest `platform_phase1_activity_*.json`
- [ ] Inspect the latest `d1_mirror_report_*.json`
- [ ] Inspect `GET /v1/platform/agents/agent_prop_1/noise-budget-summary`

## 8. Rollback / Disable
- [ ] To disable governed mirror path, set `ENABLE_PHASE1_PLATFORM_SYNC=false`
- [ ] To disable governed advocate path only, set `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=false`
- [ ] Re-run `d1_mirror_sync.py` to confirm the script cleanly skips Phase 1
- [ ] Preserve the latest activity/report artifacts for audit
