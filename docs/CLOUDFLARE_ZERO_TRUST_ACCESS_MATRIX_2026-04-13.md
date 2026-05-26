# Cloudflare Zero Trust Access Matrix

Status: Draft v1
Date: 2026-04-13
Owner: MarketingOps / Property Analytics
Depends on: `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`

Related role model:

- `/Users/mark/Property_Analytics/docs/DATA_POND_ROLE_MODEL_2026-04-14.md`
- `/Users/mark/Property_Analytics/docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md`

## 1. Purpose

Translate the canonical Cloudflare Zero Trust security architecture into a concrete host, route, and policy map for the current platform.

This document is the implementation bridge between security strategy and Cloudflare configuration.

## 2. Current Production Surfaces

Observed active platform hosts:

- Frontend: `app.venterradev.com`
- API: `api.venterradev.com`

Observed deployment shape:

- frontend is Cloudflare Pages
- API is Cloudflare Workers
- runtime config path: `/Users/mark/Property_Analytics/apps/api/wrangler.toml`

## 3. Access Classification Standard

Every surface is assigned one of these classes:

- `A1`: human app surface behind Cloudflare Access
- `A2`: human app surface behind stricter Cloudflare Access rules
- `B1`: machine/service endpoint behind Cloudflare Access service identity
- `C1`: intentionally public but hardened
- `D1`: private origin or private service exposed through Tunnel if needed

## 4. Host-Level Policy Map

| Host | Role | Access Class | Recommended Cloudflare Control | Notes |
| --- | --- | --- | --- | --- |
| `app.venterradev.com` | primary human-facing application | `A1` | Cloudflare Access application | Default entry for team and approved external users |
| `api.venterradev.com` | API host for frontend, admin, ops, and automation | mixed | Split by route class below | Should not be treated as one flat policy zone |

## 5. Cloudflare Access Application Design

Create distinct Access applications instead of one monolithic rule set.

### 5.1 App 1: Main Human App

Suggested name:

- `Data Pond - Main App`

Target:

- `app.venterradev.com/*`

Audience:

- internal team users via SSO
- approved external users via email OTP

Default policy:

- allow internal staff group(s), preferably Microsoft Entra-backed cohorts
- allow named external users or approved external domains
- require MFA for admins and elevated operator cohorts

### 5.2 App 2: Admin and Ops Web Areas

Suggested name:

- `Data Pond - Admin and Ops`

Target:

- `app.venterradev.com/admin/*`
- `app.venterradev.com/watchtower*`
- `app.venterradev.com/intelligence-office*`
- `app.venterradev.com/site-content*`
- `app.venterradev.com/metrics-import*`

Audience:

- internal operators only by default

Policy:

- allow internal Steward/Curator groups only
- require MFA
- require managed-device posture once WARP rollout is in place
- shorter session duration than the main app

### 5.3 App 3: API Browser Access

Suggested name:

- `Data Pond - Browser API`

Target:

- `api.venterradev.com/v1/*`

Audience:

- frontend/browser sessions only

Policy:

- allow only identities already approved for app access
- keep browser-driven endpoints under Access even if the app also uses its own session cookie

### 5.4 App 4: Machine API

Suggested name:

- `Data Pond - Service API`

Target:

- service-only routes on `api.venterradev.com`

Audience:

- automation, scripts, agents, platform jobs

Policy:

- service-token only
- no human login path
- separate token per system family

## 6. Frontend Route Classification

The frontend itself is a human-facing application and should sit behind Access by default.

The route-level classification below is used to decide whether some areas need a stricter Access application or additional in-app restrictions.

| Frontend Route Area | Primary Purpose | Recommended Class | Notes |
| --- | --- | --- | --- |
| `/` | landing shell | `A1` | protected main app shell |
| `/login` and `/login/verify` | current app-native login | `A1` | should remain reachable after Access if app login is preserved as an internal authorization/session layer |
| `/dock` | launch surface | `A1` | general authenticated users |
| `/pib` and `/pib/property` | canonical PIB views | `A1` | mixed internal/external depending on audience approval |
| `/analysis`, `/marketing`, `/communities`, `/gsc`, `/gbp-posts`, `/fish` | analytical user surfaces | `A1` | normal authenticated app audience |
| `/tracker/*` | pilot monitoring | `A1` | likely internal by default unless specific external audience exists |
| `/admin/*` | user and admin control surfaces | `A2` | stricter Access and MFA |
| `/watchtower` | operational control tower | `A2` | internal ops only by default |
| `/intelligence-office` | governed guidance and directives | `A2` | likely internal/editorial only |
| `/site-content` | governed content workspace | `A2` | internal/editorial only |
| `/metrics-import` | import tooling | `A2` | internal operator/admin only |
| `/backup` | bulk export UI | `A2` | admin-only posture at edge plus in app |

## 7. API Route Classification

This matrix is based on the current route definitions in `/Users/mark/Property_Analytics/apps/api/src/routes/`.

### 7.1 Public or narrowly public routes

| API Route | Current App Guard | Recommended Class | Cloudflare Policy |
| --- | --- | --- | --- |
| `/health` | public | `C1` | keep public but minimal; WAF/rate limit only |
| `/v1/auth/login` | public | `C1` | public but rate limited and monitored |
| `/v1/auth/magic-link` | public | `C1` | public but rate limited and monitored |
| `/v1/auth/verify` | public | `C1` | public bootstrap path if app-native login remains |
| `/v1/auth/redeem-invite` | public | `C1` | public bootstrap path with strict validation |

These are the only routes that should remain public by default, and only because they bootstrap auth or provide health status.

### 7.2 Standard authenticated browser routes

| API Route Family | Current App Guard | Recommended Class | Notes |
| --- | --- | --- | --- |
| `/v1/auth/me` and `/v1/auth/logout` | `requireAuth` | `A1` | normal user session flows |
| `/v1/communities` | mixed write/read in app | `A1` | browser API under Access; in-app role checks still apply |
| `/v1/metrics` | `requireAuth` and some admin writes | `A1` | general authenticated app use with admin sub-actions |
| `/v1/marketing` | `requireAuth` | `A1` | general authenticated app use |
| `/v1/analysis` | `requireAuth` | `A1` | general authenticated app use |
| `/v1/pib` | route-specific app auth expected | `A1` | supports protected PIB web surfaces |
| `/v1/pond` | route-specific app auth expected | `A1` | app landing insights |
| `/v1/health` | `requireAuth` | `A2` | operational data should be stricter than general app traffic |
| `/v1/gsc-snapshot` | route-specific app auth expected | `A1` | analytical data |
| `/v1/gbp-posts` | route-specific app auth expected | `A1` | content/marketing app use |
| `/v1/evs` | mixed authenticated browser routes plus service-protected ingest | `A2` | experiential validation is ops-sensitive and intentionally spans human request/review plus machine ingest |
| `/v1/t7-metrics` and `/v1/t30-metrics` | `requireAuth`; admin for imports/deletes | `A1` | reads for general users, stricter controls for writes |

### 7.3 Admin and privileged browser routes

| API Route Family | Current App Guard | Recommended Class | Cloudflare Policy |
| --- | --- | --- | --- |
| `/v1/admin/*` | `requireAuth` + `requireAdmin` | `A2` | admin-only Access policy, MFA required |
| `/v1/admin/intelligence/*` | privileged app path | `A2` | admin/editor internal-only |
| `/v1/admin/site-content/*` | privileged app path | `A2` | admin/editor internal-only |
| `/v1/exports/*` | `requireAuth` + `requireAdmin` | `A2` | admin-only plus short sessions |
| `/v1/intelligence-memory/*` | `requireAuth` with elevated write roles | `A2` | editorial/ops sensitive |

### 7.4 Machine and hybrid service routes

| API Route Family | Current App Guard | Recommended Class | Notes |
| --- | --- | --- | --- |
| `/v1/platform/*` | shared token or `admin`/`editor` session | `B1` | should become a first-class service-token protected surface |
| `/v1/vacs/*` | bearer token when configured | `B1` | keep as machine-oriented service route |

These are strong candidates for dedicated Access service-token policies instead of relying on one shared application token pattern alone.

## 8.5 Role mapping guidance

Use the canonical app authorization keys:

- `viewer`
- `editor`
- `admin`

Render them in the product as:

- `Observer`
- `Curator`
- `Steward`

Recommended audience posture:

- `Observer` is the default external role and the most common internal read role
- `Curator` is the governed write role for editorial and intelligence work
- `Steward` is the tightly limited internal operator/admin role

Recommended Microsoft Entra to Cloudflare cohort mapping:

| Workforce IdP Group | Cloudflare Access Cohort | Intended App Role |
| --- | --- | --- |
| `Data Pond Observers` | `Data Pond Observers` | `viewer` / `Observer` |
| `Data Pond Curators` | `Data Pond Curators` | `editor` / `Curator` |
| `Data Pond Stewards` | `Data Pond Stewards` | `admin` / `Steward` |

Recommended policy use:

- `Data Pond - Main App` includes `Observers`, `Curators`, and `Stewards`
- `Data Pond - Admin and Ops` includes `Stewards` by default, with narrowly approved `Curators` only where editorial work truly requires elevated surfaces
- external OTP users should not be placed into workforce SSO cohorts

Recommended surface posture:

- `A1` surfaces are suitable for `Observer`, `Curator`, and `Steward` depending on in-app authorization
- `A2` surfaces should generally be limited to `Curator` and `Steward`
- highest-risk operational surfaces like Watchtower, backup, imports, and top-level admin should launch as `Steward` only unless a clear operational need emerges

## 9. Recommended Cloudflare Policy Rules

### 8.1 Main app policy

- include internal SSO groups
- include approved external users via OTP
- default session duration for normal users
- no broad bypass

### 8.2 Admin/operator policy

- include internal admins and approved operators only
- require MFA
- require managed-device posture when available
- shorter session duration

### 8.3 External user policy

- include named emails or approved external domain list
- use Cloudflare Access email OTP
- only grant to approved app surfaces, not admin/operator areas

### 8.4 Service policy

- include specific service token only
- separate service token for:
  - D1 mirror and sync flows
  - platform orchestration
  - VACS
  - future agents or connectors

## 10. Keeper Mapping Requirements

Store or formalize these records in Keeper:

- Cloudflare Zero Trust admin token
- Cloudflare Access service token for `platform`
- Cloudflare Access service token for `vacs`
- Cloudflare Tunnel credentials if any private services are added
- WARP/Gateway admin credentials or supporting platform records if needed

Each record should have:

- owner
- purpose
- rotation expectation
- linked system

## 11. Repo-Observed Hardening Follow-Up

The current app layer already has useful auth controls, and one earlier review item has now been closed:

- the Site Content debug bypass path (`x-debug-site-content` plus its runtime toggle) was retired on 2026-04-17
- `PLATFORM_SHARED_TOKEN` remains a transitional app-level shared-token concept and should continue toward retirement in favor of the Keeper + Cloudflare service-token model
- `VACS` route fallback was retired on 2026-04-17; VACS now expects Access service-token auth as its canonical machine path

## 11. Recommended Implementation Order

### Step 1

Create Cloudflare Access applications for:

- main app
- admin/ops app areas
- browser API
- service API

### Step 2

Wire internal identity provider for staff SSO.

### Step 3

Configure external user OTP policies for approved app audiences.

### Step 4

Move machine integrations toward per-system service identity backed by Keeper.

### Step 5

Review and constrain or remove debug bypass behavior from production trust paths.

### Step 6

Add WARP and device posture requirements for admin/operator surfaces.

## 12. Decision Summary

- `app.venterradev.com` should be behind Cloudflare Access now
- `api.venterradev.com` should be split by route class, not treated as a single flat exposure
- admin, exports, ops, and governed-memory surfaces should be stricter than normal user analytics views
- platform and VACS routes should evolve toward explicit service identity
- Keeper remains the source of truth for all Cloudflare-related secrets and service credentials

Implementation checklist now available:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
