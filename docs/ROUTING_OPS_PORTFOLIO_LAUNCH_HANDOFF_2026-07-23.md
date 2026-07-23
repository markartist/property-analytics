# Routing Ops Portfolio Launch Handoff

Date: 07/23/2026

## Current Live State

- Data Pond route: `https://app.venterradev.com/routing-ops/portfolio-launch`
- Latest Pages preview: `https://2f8206ce.property-analytics.pages.dev/routing-ops/portfolio-launch`
- Access posture: Data Pond operator route remains behind Cloudflare Access.
- Live beta domain: `https://venterraliving.io`
- Live beta Worker: `https://portfolio-launch-proxy-beta.mlaufhutte.workers.dev`
- Beta Worker version: `e8894245-d94b-4c74-9160-00717d6e0b44`

## What Is Stored In This Repository

- Routing Ops navigation entry and permission surface.
- Portfolio Launch command center at `/routing-ops/portfolio-launch`.
- Portfolio launch readiness data used by the page.
- Programmatic control-plane status strip showing:
  - `80 legacy active`
  - `State file ready`
  - `D1/KV next`

## What Is Stored In WebOps

WebOps source shelf:

`/Users/mark/web-ops/projects/portfolio-launch-proxy`

Committed WebOps checkpoint:

`306c165 Add programmatic routing state control scaffold`

The WebOps project contains the durable route/proxy contracts:

- generated beta route manifest
- generated beta route state
- route-state engine
- route-state schema
- routing audit-event schema
- D1 schema contract
- CLI build/switch/rollback tools
- Routing control-plane documentation

## Current Operating Model

The live beta proves this URL behavior:

1. Old `.io` path is clicked.
2. Worker redirects to the new `.io` city/state path.
3. The city/state path serves `legacy_baseline` by default.
4. A switch can make the same city/state path serve `candidate_origin`.
5. Rollback returns the same path to `legacy_baseline`.

Current live dashboard buttons use the beta session-scoped switch endpoint.
The global production switch is not live yet.

## Next Build Step

Wire the committed WebOps route-state contract to a live authenticated control
plane:

- D1 as authoritative route-state and audit store
- KV as optional fast edge cache
- protected switch/rollback API
- dashboard mutation buttons backed by Cloudflare Access/app authorization
- audit event capture for every activation and rollback

## Boundaries

No production `venterraliving.com` route was changed.
No GoDaddy forwarding was changed.
No vanity redirect was changed.
No global D1/KV route-state mutation is live yet.
No secrets or account ids are stored in this handoff.
