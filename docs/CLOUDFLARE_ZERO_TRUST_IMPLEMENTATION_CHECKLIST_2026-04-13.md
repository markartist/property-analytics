# Cloudflare Zero Trust Implementation Checklist

Status: Draft v1
Date: 2026-04-13
Owner: MarketingOps / Property Analytics
Depends on:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`

## 1. Purpose

Provide the concrete build checklist for implementing the Cloudflare Zero Trust policy in this repo and deployment environment.

This document is intentionally operational.

It is meant to be worked through item by item.

## 2. Scope of Immediate Rollout

This checklist covers:

- Cloudflare Access applications
- internal and external user access
- service-token rollout for machine endpoints
- Keeper record requirements
- WARP and posture sequencing
- repo-level hardening follow-up

This checklist does not require PIB locked-file changes.

## 3. Confirmed Current Integration Points

Observed in repo:

- frontend host: `app.venterradev.com`
- API host: `api.venterradev.com`
- API worker env in `/Users/mark/Property_Analytics/apps/api/src/env.ts`
- runtime vars in `/Users/mark/Property_Analytics/apps/api/wrangler.toml`

Relevant current app secrets or trust inputs:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SESSION_SIGNING_SECRET`
- `PLATFORM_ACCESS_CLIENT_ID`
- `PLATFORM_ACCESS_CLIENT_SECRET`
- `VACS_ACCESS_CLIENT_ID`
- `VACS_ACCESS_CLIENT_SECRET`
- `EVS_ACCESS_CLIENT_ID`
- `EVS_ACCESS_CLIENT_SECRET`
- transitional fallback only:
- `PLATFORM_SHARED_TOKEN`
- `EVS_SHARED_TOKEN`

Relevant app trust behavior already present:

- browser session auth
- app roles: `admin`, `editor`, `viewer`
- Cloudflare-style service-token header support for `platform`, `vacs`, and `evs`
- legacy shared bearer-token fallback for `platform` and `evs` during cutover
- cookie-based frontend API traffic to `/v1/*`

## 4. Cloudflare Access Applications To Create

### 4.1 Application: Main App

Create:

- name: `Data Pond - Main App`
- domain: `app.venterradev.com`

Use for:

- normal internal users
- approved external users
- standard browser access to PIB, analysis, marketing, communities, fish, and related app surfaces

### 4.2 Application: Admin and Ops

Create:

- name: `Data Pond - Admin and Ops`
- paths:
  - `app.venterradev.com/admin/*`
  - `app.venterradev.com/watchtower*`
  - `app.venterradev.com/intelligence-office*`
  - `app.venterradev.com/site-content*`
  - `app.venterradev.com/metrics-import*`
  - `app.venterradev.com/backup*`

Use for:

- admin console
- operational control surfaces
- governed editorial workspaces
- bulk import/export areas

### 4.3 Application: Browser API

Create:

- name: `Data Pond - Browser API`
- domain or path scope:
  - `api.venterradev.com/v1/*`

Use for:

- frontend-to-API browser traffic that should remain reachable only for approved human users

### 4.4 Application: Service API

Create:

- name: `Data Pond - Service API`
- target service-only endpoints on:
  - `api.venterradev.com/v1/platform/*`
  - `api.venterradev.com/v1/vacs/*`
  - future machine-only endpoints as needed

Use for:

- automation
- scripts
- service-to-service flows
- agent access

## 5. Identity Provider Rollout

### 5.1 Internal users

Configure:

- primary IdP for internal staff SSO

Require:

- company identity login
- MFA for admins and elevated operators

### 5.2 External users

Configure:

- Cloudflare Access email one-time PIN

Use for:

- approved external users who need app access without being forced into a corporate IdP

Approval rule:

- do not allow open self-enrollment
- maintain an explicit approved-email list or approved-domain policy, depending on the external audience

## 6. Access Policy Templates To Configure

### 6.1 Main app policy

Configure:

- include internal SSO groups
- include approved external users
- default session duration for standard use
- no bypass rules

### 6.2 Admin and ops policy

Configure:

- include only internal admins and approved operator/editor groups
- require MFA
- shorter session duration than standard app access
- require managed-device posture after WARP rollout

### 6.3 External user policy

Configure:

- email OTP login
- approved emails or external domains only
- no access to admin, Watchtower, Intelligence Office, Site Content, backup, or import routes unless explicitly approved

### 6.4 Service policy

Configure:

- service token only
- no interactive human login
- one policy per automation family where possible

## 7. API Route Decisions To Implement

### 7.1 Keep public but hardened

These routes may remain public if app-native bootstrap is preserved:

- `/health`
- `/v1/auth/login`
- `/v1/auth/magic-link`
- `/v1/auth/verify`
- `/v1/auth/redeem-invite`

For these routes, configure:

- WAF
- rate limiting
- logging/monitoring
- no extra data disclosure

### 7.2 Protected browser routes

Put behind browser-oriented Access coverage:

- `/v1/auth/me`
- `/v1/auth/logout`
- `/v1/communities`
- `/v1/metrics`
- `/v1/marketing`
- `/v1/analysis`
- `/v1/pib`
- `/v1/pond`
- `/v1/gsc-snapshot`
- `/v1/gbp-posts`
- `/v1/t7-metrics`
- `/v1/t30-metrics`

### 7.3 Stricter privileged routes

Put behind stricter Access policy:

- `/v1/admin/*`
- `/v1/admin/intelligence/*`
- `/v1/admin/site-content/*`
- `/v1/exports/*`
- `/v1/intelligence-memory/*`
- `/v1/health/*`
- `/v1/evs/*`

### 7.4 Service-only routes

Move toward service-token-only policy:

- `/v1/platform/*`
- `/v1/vacs/*`

## 8. Keeper Record Inventory

Create or confirm canonical Keeper records for:

- Cloudflare Zero Trust admin API token
- Cloudflare Access service token: `platform`
- Cloudflare Access service token: `vacs`
- Cloudflare Access service token: `evs` for machine ingest inside the mixed EVS lane
- Cloudflare Tunnel token(s) if private connectors are introduced
- `SESSION_SIGNING_SECRET`
- Resend runtime credentials

Each record should capture:

- record name
- owner
- system or route family
- where it is injected
- rotation policy
- notes on dependent workflows

## 9. Runtime Secret Injection Checklist

For deployed runtime:

- keep Keeper as source of truth
- use `wrangler secret put` for deployed worker copies where needed
- avoid persistent local plaintext secret files

Review current worker secret and variable posture:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SESSION_SIGNING_SECRET`
- `PLATFORM_ACCESS_CLIENT_ID`
- `PLATFORM_ACCESS_CLIENT_SECRET`
- `VACS_ACCESS_CLIENT_ID`
- `VACS_ACCESS_CLIENT_SECRET`
- `EVS_ACCESS_CLIENT_ID`
- `EVS_ACCESS_CLIENT_SECRET`
- fallback only during migration:
- `PLATFORM_SHARED_TOKEN`
- `VACS_SHARED_TOKEN`
- `EVS_SHARED_TOKEN`

Migration direction:

- preserve runtime injection
- treat Cloudflare Access service-token credentials as the steady-state machine identity model
- retain shared tokens only as temporary migration fallback
- retire ad hoc token handling once Access-backed service identity is verified in production

## 10. Repo-Level Hardening Tasks

### 10.1 Debug bypass review

Status:

- completed for Site Content on 2026-04-17
- `x-debug-site-content` bypass logic was removed from `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
- the related `DEBUG_SITE_CONTENT_BYPASS_ENABLED` runtime flag was removed from `/Users/mark/Property_Analytics/apps/api/wrangler.toml`

Current posture:

- Site Content is now expected to operate only as an authenticated governed human-access lane
- any future debug access should use a clearly separate local/dev-only mechanism rather than a production route bypass

### 10.2 Shared token alignment

Review:

- `PLATFORM_SHARED_TOKEN`
- `VACS_SHARED_TOKEN`
- `EVS_SHARED_TOKEN`

Target decision:

- each one should remain Keeper-backed only for transitional fallback coverage
- preferred machine identity is now Access service-token policy with dedicated client id/secret pairs
- retire the shared bearer tokens family by family after production verification

### 10.3 Public route minimization

Confirm no additional routes are unintentionally public beyond the bootstrap endpoints already listed.

## 11. WARP and Device Posture Rollout

### 11.1 Phase 1

Deploy WARP for:

- your box
- internal operators
- admins

Goals:

- secure egress
- visibility
- safer local-to-cloud traffic

### 11.2 Phase 2

Enable posture checks for:

- admin areas
- Watchtower
- Intelligence Office
- Site Content
- import/export tools

### 11.3 Phase 3

Expand posture requirements if needed to broader internal app access.

## 12. Cloudflare Configuration Sequence

Recommended order:

1. Configure internal IdP in Cloudflare Zero Trust
2. Configure email OTP for approved external users
3. Create `Data Pond - Main App`
4. Create `Data Pond - Admin and Ops`
5. Create `Data Pond - Browser API`
6. Create `Data Pond - Service API`
7. Apply WAF and rate limits to the intentionally public auth/bootstrap routes
8. Create Keeper records and injection mapping for service credentials
9. Roll service tokens onto `platform` and `vacs`
10. Review debug bypass and shared-token cleanup
11. Roll out WARP for admins/operators
12. Add posture requirements for high-risk areas

## 13. Acceptance Criteria

The initial rollout should be considered complete when:

- `app.venterradev.com` is behind Cloudflare Access
- external users can log in through an approved user-friendly path
- internal users use SSO
- admin and ops areas have stricter Access policy than the general app
- `platform` and `vacs` have documented service identity
- Cloudflare-related secrets are inventoried in Keeper
- public routes are intentionally minimal and hardened
- debug bypass behavior has an explicit production decision

## 14. Next Repo Artifact

After this checklist, the next useful repo artifact is:

- a Keeper record manifest specifically for Cloudflare Zero Trust and service-identity artifacts

Current artifact now available:

- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
