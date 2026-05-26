# Platform-App Finish Order

Date: 2026-04-16
Compartment: `platform-app`

## Status Snapshot

Core platform-app stabilization is now substantially complete:

- Phase 1 complete: `/v1/health/status` closure contract stabilized for Watchtower
- Phase 2 complete: Watchtower now consumes that richer closure context directly
- Phase 3 complete: Cloudflare auth/bootstrap backend and frontend loop hardened across multi-host browser access, session bootstrap, and signed-out retry behavior
- Phase 4 substantially complete: core route/client/test verification is green for the Watchtower + auth/bootstrap path

Remaining `platform-app` work is secondary rather than blocking:

- any follow-on runbook/doc tightening that should match future deployment steps

EVS / BrowserStack is no longer treated as unfinished `platform-app` core work.
It should be handled as its own compartmented follow-on lane:

- `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_MANIFEST_2026-04-16.md`

## Current Shape

The original `platform-app` lane contained three related sub-lanes:

1. `watchtower-health-contract`
2. `cloudflare-auth-bootstrap`
3. `evs-browserstack-adjacent`

The first two are the center of gravity. The third proved to be a real but separate stream and should not distract from Watchtower and browser access.

## Sub-Lane 1: Watchtower / Health Contract

Primary files:

- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`

Observed direction:

- `/v1/health/status` is being expanded from a basic freshness snapshot into an operational control-plane payload:
  - source freshness evaluation with expected-latest-date logic
  - daily collection summary
  - closure state
  - retry queue visibility
  - source history / coverage telemetry
- Watchtower is being redesigned around that richer payload, with command-deck style operational UI, auto-refresh, source pods, retry posture, and drill-in states.

Why it matters:

- This is the clearest active product surface in the lane.
- It likely underpins how the team sees collection state before touching deeper collection hardening.

Recommended finish order inside this sub-lane:

1. stabilize the `/v1/health/status` response shape
2. ensure `apps/web/src/lib/api.ts` matches it exactly
3. then finish the Watchtower UI against that stable contract

## Sub-Lane 2: Cloudflare Auth / Bootstrap

Primary files:

- `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/index.ts`
- `/Users/mark/Property_Analytics/apps/api/src/env.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/auth-provider.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- related Cloudflare docs/scripts

Observed direction:

- browser bootstrap is moving to `/v1/auth/access-bootstrap`
- `/v1/auth/me` is now able to bootstrap a session from Cloudflare Access
- logout and login pages are being reshaped around explicit signed-out and retry-aware flow
- cookie/domain/frontend-origin behavior is being made environment-aware
- auto-provisioning of app users from Cloudflare Access is present in the same stream

Why it matters:

- This is foundational product access behavior, so ambiguity here will ripple into every app surface.
- It should be considered a runtime-hardening lane, not a UI polish lane.

Recommended finish order inside this sub-lane:

1. settle backend bootstrap/session semantics
2. settle frontend login/auth-provider behavior around retry, logout, and bootstrap markers
3. verify redirect/origin/cookie behavior against both localhost and production app hosts
4. only then finalize the related docs/runbooks

## Former Sub-Lane 3: EVS / Browserstack Adjacent

Primary files:

- `/Users/mark/Property_Analytics/apps/api/src/evs/`
- `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
- `/Users/mark/Property_Analytics/apps/api/migrations/0020_create_evs_tables.sql`
- `/Users/mark/Property_Analytics/ops/browserstack/`
- `/Users/mark/Property_Analytics/evs/config/pilot-properties.json`
- related workflow files

Observed direction:

- platform support for experiential validation is landing alongside the auth/platform work
- this appears real, but it is not central to Watchtower or Cloudflare browser access

Recommendation:

- move this work into its own EVS / BrowserStack manifest and finish order
- do not hold the core `platform-app` lane open for EVS-specific orchestration

## Concrete Finish Sequence

### Phase 1

Lock the health contract:

- `apps/api/src/routes/health.ts`
- `apps/web/src/lib/api.ts`

### Phase 2

Lock Watchtower against that contract:

- `apps/web/src/app/watchtower/page.tsx`

### Phase 3

Lock Cloudflare/bootstrap runtime behavior:

- `apps/api/src/routes/auth.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/web/src/components/auth-provider.tsx`
- `apps/web/src/app/login/`
- `apps/web/src/lib/api.ts`

### Phase 4

Reconcile docs/scripts with the shipped behavior:

- runbooks
- bootstrap scripts
- env/Wrangler updates

### Phase 5

Keep EVS / BrowserStack separate:

- finish in an EVS-specific lane
- do not mix EVS execution/orchestration with Watchtower or browser-auth commits

## Rule For Commits

Do not mix these sub-lanes in one commit unless the dependency is direct:

- health contract + Watchtower can pair
- auth/bootstrap should usually stand on its own
- EVS/browserstack should not ride along with unrelated Watchtower polish

Follow-on lane docs:

- `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_MANIFEST_2026-04-16.md`
- `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_FINISH_ORDER_2026-04-16.md`
