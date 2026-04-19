# Deployment Provenance Model

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics  
Purpose: Canonical model for deployment provenance, runtime observation, and environment-drift visibility in the platform.

## 1. Why This Exists

Enterprise maturity requires more than:

- clean code
- release lanes
- trust posture

It also requires the platform to know:

- which environment a surface is actually running in
- which API it is actually talking to
- whether runtime policy matches the intended environment
- whether debug or transition flags are still present where they should not be

Without that, release discipline remains mostly procedural instead of operational.

## 2. Canonical Sources

Machine-readable deployment provenance source:

- `/Users/mark/Property_Analytics/config/deployment_provenance_manifest.json`

Runtime observation source:

- `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`

Current operator-facing surface:

- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`

## 3. Current Provenance Signals

The current model tracks:

- expected environments:
  - local
  - preview
  - production
- expected web hosts
- expected API hosts
- canonical release path
- preferred production API base
- production debug flags that must be false
- service-to-environment bindings

It also captures runtime observation for:

- current API request origin and host
- Cloudflare Access team-domain posture
- Access auto-provision runtime toggle
- Access default role

The web layer adds:

- current browser host/origin
- configured API base
- production debug flag posture from build-time env

## 4. Drift Philosophy

Not every difference is a failure.

Examples:

- a Pages preview using the production API can be valid for release review
- a local surface targeting local API is expected

Drift should be elevated when it implies:

- production debug posture
- host/API mismatch that hides where traffic is really going
- silent runtime-policy changes
- release-path ambiguity

## 5. Current Enterprise Value

This model lets Watchtower show:

- what environment the web surface appears to be in
- what API host it is configured to use
- what API host actually answered the control-plane request
- what runtime access policy is active
- what drift signals need review

That turns deployment provenance into a first-class operational concern instead of a release-notes afterthought.
