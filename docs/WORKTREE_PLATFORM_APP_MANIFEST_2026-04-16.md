# Platform-App Worktree Manifest

Date: 2026-04-16
Compartment: `platform-app`

## Purpose

This manifest defines the current platform / app rollout lane so it can be worked, reviewed, and committed independently from Data Collection, Pilot reporting, and Content Operations.

## Included Files

### API / Platform Core

- `/Users/mark/Property_Analytics/apps/api/src/env.ts`
- `/Users/mark/Property_Analytics/apps/api/src/index.ts`
- `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/platform.ts`
- `/Users/mark/Property_Analytics/apps/api/wrangler.toml`

### API / Platform Scripts and Tests

- `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/verify_phase1_platform_cutover.sh`
- `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`
- `/Users/mark/Property_Analytics/apps/api/test/helpers/platform-route-env.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/platform-phase1-client-smoke.test.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/platform-routes.test.ts`
- `/Users/mark/Property_Analytics/apps/api/test/auth/`
- `/Users/mark/Property_Analytics/apps/api/test/helpers/cloudflare-access-jwt.ts`

### Frontend / Auth / Watchtower

- `/Users/mark/Property_Analytics/apps/web/.env.production`
- `/Users/mark/Property_Analytics/apps/web/package.json`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/verify/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/components/auth-provider.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`

### Shared Platform Dependency

- `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`

### Zero Trust / Platform Docs

- `/Users/mark/Property_Analytics/docs/D1_MIRROR_RUNBOOK.md`
- `/Users/mark/Property_Analytics/docs/PHASE1_CUTOVER_RUNBOOK.md`
- `/Users/mark/Property_Analytics/docs/PHASE1_EFFICIENCY_IMPROVEMENTS.md`
- `/Users/mark/Property_Analytics/docs/PHASE1_PRODUCTION_ENABLEMENT_CHECKLIST.md`
- `/Users/mark/Property_Analytics/docs/PHASE1_PROPERTY_ADVOCATE_ENABLEMENT_PLAN.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
- `/Users/mark/Property_Analytics/scripts/bootstrap_cloudflare.sh`
- `/Users/mark/Property_Analytics/scripts/check_env.md`
- `/Users/mark/Property_Analytics/.github/workflows/context-discipline.yml`

## Included Themes

- Watchtower evolution
- browser auth/bootstrap flow
- Cloudflare Zero Trust rollout
- D1/platform cutover support
- service-auth support shared with adjacent lanes

## Excluded Themes

These should not be folded into `platform-app` commits unless they are directly needed:

- Data Collection orchestration and alerting
- Pilot/CWV report generation
- Site Content / Intelligence Office / VACS feature work
- EVS / BrowserStack execution and orchestration work

## Recommended Finish Order

1. stabilize auth/bootstrap and service-auth behavior
2. stabilize Watchtower route + UI contract
3. verify platform scripts/tests and Wrangler/runtime config
4. finalize EVS/browserstack support if still intended in this lane
5. commit platform docs with the matching shipped behavior

## Current Assessment

The core `platform-app` lane is now coherent enough to work as a discrete stream:

- Watchtower health contract and UI are aligned
- Cloudflare browser bootstrap is aligned across API and frontend
- platform route and client smoke coverage are green

What remains in this lane is mostly adjacent or optional:

- any deployment/runbook cleanup tied to the shipped Watchtower and auth/bootstrap surface

Separated follow-on lane:

- `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_MANIFEST_2026-04-16.md`

Companion finish-order doc:

- `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_FINISH_ORDER_2026-04-16.md`
