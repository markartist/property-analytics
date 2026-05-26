# EVS / BrowserStack Finish Order

Date: 2026-04-16
Compartment: `evs-browserstack`

## Current Shape

This lane has four connected pieces:

1. EVS API contracts and persistence
2. service-auth-protected ingest
3. BrowserStack execution helpers
4. GitHub workflow orchestration

Current governed visibility:

- EVS is now represented in The Pond through `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx`
- the bridge should stay thin and governance-oriented while deeper execution maturity continues in the EVS lane itself

## Verified Today

- `POST /v1/evs/ingest/:requestId` service-auth behavior is green for:
  - missing credentials rejection
  - Cloudflare Access service-token headers
  - Cloudflare Access JWT assertion flow
- EVS request lifecycle now supports explicit external-orchestrator handoff via:
  - `POST /v1/evs/requests/:requestId/handoff`
  - derived request dispatch state in the API view

## Main Gap

The EVS API persists requests, returns an execution plan, and can now record orchestrator handoff explicitly, but it does not dispatch the GitHub workflow directly yet.

That gap is explicit in:

- `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
- `/Users/mark/Property_Analytics/evs/README.md`

This should be treated as a product/orchestration decision, not a hidden bug.

## Finish Sequence

### Phase 1

Lock the EVS API contract:

- `apps/api/src/routes/evs.ts`
- `apps/api/src/evs/repository.ts`
- `apps/api/test/platform/evs-auth.test.ts`

### Phase 2

Decide dispatch posture:

- keep API as request-persistence plus execution-plan only
- or add explicit GitHub workflow dispatch from the API with the required credentials and audit behavior

### Phase 3

If dispatch stays external, tighten operator docs and runner scripts:

- `evs/README.md`
- `ops/browserstack/README.md`
- `.github/workflows/evs-browserstack-experiential.yml`

### Phase 4

If dispatch moves into the API, add:

- route-level tests for dispatch behavior
- clear failure handling and request status transitions
- audit/logging expectations for workflow launch

## Rule For Commits

- keep EVS API contract changes separate from BrowserStack runner changes when possible
- do not mix EVS orchestration work with Watchtower or Cloudflare browser auth changes
