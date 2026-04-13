# Experience Validation Service (EVS)

EVS is a shared platform service for staging-first experiential validation.

## MVP shape

- Consumer: Property Advocate
- Persistence: D1-backed request and result history
- Execution target: staging URLs only
- Properties: five pilot properties
- Profiles:
  - `broad_experiential_homepage`
  - `critical_cta_smoke`
  - `header_navigation_integrity`
- Devices:
  - `iphone_safari`
  - `android_chrome`
  - `desktop_chrome`
- Triggers:
  - manual
  - post-deploy
  - weekly scheduled

## Repo structure

- `apps/api/src/evs`
  - API-facing request intake, normalization, provider abstraction, and persistence helpers
- `apps/api/src/routes/evs.ts`
  - EVS HTTP endpoints
- `apps/api/migrations/0020_create_evs_tables.sql`
  - D1 persistence for properties, requests, and results
- `evs/config`
  - staging pilot property registry
- `evs/config/browserstack-site-patterns.json`
  - shared and property-level BrowserStack selector patterns
- `evs/docs/BROWSERSTACK_STABILIZATION_PLAN.md`
  - roadmap for hardening the pilot suite into a portfolio-grade testing system
- `evs/providers/browserstack`
  - experiential runner script
- `evs/orchestration`
  - GitHub Actions matrix helpers
- `evs/samples`
  - sample request and normalized result payloads

## API endpoints

- `GET /v1/evs/properties`
- `GET /v1/evs/requests`
- `POST /v1/evs/requests`
- `GET /v1/evs/requests/:requestId`
- `POST /v1/evs/ingest/:requestId`
- `GET /v1/evs/adapters/property-advocate/:propertyId`

## Workflow notes

- GitHub Actions is the orchestrator.
- BrowserStack is the execution provider.
- EVS persists requests immediately and can ingest workflow results later.
- MVP is wired for staging URLs only.
- BrowserStack secrets are expected as `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`.
- Optional result-ingest secret is `EVS_SHARED_TOKEN`.

## Current constraint

Workflow dispatch from the API is not enabled yet because repo credentials and dispatch tokens are still pending. The API returns a workflow execution plan so the orchestrator can be connected without reshaping contracts later.
