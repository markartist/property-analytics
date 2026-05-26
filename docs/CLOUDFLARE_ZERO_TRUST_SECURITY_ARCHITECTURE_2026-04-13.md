# Cloudflare Zero Trust Security Architecture

Status: Draft v1
Date: 2026-04-13
Owner: MarketingOps / Property Analytics
Scope: Human access, service access, device trust, secret handling, and origin protection for the Property Analytics platform

## 1. Purpose

Define the canonical security system for platform surfaces hosted on Cloudflare and adjacent local automation.

Related role model:

- `/Users/mark/Property_Analytics/docs/DATA_POND_ROLE_MODEL_2026-04-14.md`
- `/Users/mark/Property_Analytics/docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md`

This document answers:

- how internal team users should access apps
- how external users should access apps
- how automation and agents should authenticate
- how Keeper and Cloudflare fit together
- how local-machine-to-cloud traffic should be secured
- what rollout path should be used from the current repo state

## 2. Security Thesis

The platform should use a layered security model:

- `Keeper` is the source of truth for secrets
- `Cloudflare Zero Trust` is the outer trust boundary
- `apps/api` and `apps/web` remain responsible for application authorization
- `Cloudflare Tunnel`, `WARP`, `Gateway`, and service identity enforce transport and network trust

Cloudflare should become the first gate that determines who or what may reach the platform.

The app should remain the place where product roles, scope, and action permissions are enforced.

## 3. Current Repo Reality

### 3.1 Active platform surfaces

Observed production-facing platform shape:

- Frontend: `app.venterradev.com` via Cloudflare Pages
- API: `api.venterradev.com` via Cloudflare Workers
- Worker config: `/Users/mark/Property_Analytics/apps/api/wrangler.toml`

### 3.2 Existing app auth

Current in-app auth and authorization already exist:

- session cookie auth in `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
- route protection in `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
- application roles: `admin`, `editor`, `viewer`
- product display titles should map to:
  - `admin` -> `Steward`
  - `editor` -> `Curator`
  - `viewer` -> `Observer`

This app auth should be preserved as the authorization layer.

### 3.3 Existing secret posture

Current canonical secret posture already favors Keeper:

- Keeper KSM is the preferred secret source
- Cloudflare tokens are already Keeper-backed for active automation
- Wrangler/platform-native secret injection is still valid for deployed runtime copies

## 4. Canonical Security Roles

### 4.1 Keeper

Keeper owns:

- Cloudflare API tokens
- Cloudflare Access service tokens
- Tunnel tokens and connector credentials
- SMTP / Resend / email-provider secrets
- app secrets such as `SESSION_SIGNING_SECRET`
- other API keys, temp credential materialization, and rotation source-of-truth

Keeper does not replace end-user authentication.

### 4.2 Cloudflare Zero Trust

Cloudflare owns:

- edge authentication and policy enforcement
- device trust checks
- service identity enforcement for protected apps
- protected connectivity to private origins
- secure outbound-device posture through WARP/Gateway
- outer deny-by-default boundary for app and API hosts

### 4.3 Application authorization

The app owns:

- product roles
- route-level authorization
- action permissions
- data scoping
- audit logging of business operations

Cloudflare answers "may this identity reach the app."

The app answers "what may this identity do once inside."

## 5. Canonical Access Model

### 5.1 Human users

Use separate identity experiences by audience:

- Internal team users: SSO through the company identity provider, preferably Microsoft Entra ID when available
- External users: Cloudflare Access one-time PIN email as the default low-friction external path
- High-trust external partners: optional future move to a dedicated IdP or federated SSO

Recommended internal group posture:

- `Data Pond Observers`
- `Data Pond Curators`
- `Data Pond Stewards`

These groups should flow from the workforce IdP into Cloudflare Access and then
map into app authorization.

### 5.2 Application roles

All humans who pass Cloudflare Access still require application authorization:

- `admin` / `Steward`: destructive/admin actions, user management, exports, high-risk controls
- `editor` / `Curator`: operational and content workflows with restricted write scope
- `viewer` / `Observer`: read-only product access

Canonical rule:

- keep `admin`, `editor`, and `viewer` as the durable authorization keys
- use `Steward`, `Curator`, and `Observer` as the user-facing role titles

### 5.3 Machine identities

Non-human actors must use service identity, not user cookies:

- Cloudflare Access service tokens for protected app/API access
- separate service token per system or automation family
- optional future mTLS for the most sensitive machine-to-machine paths

## 6. Surface Classification Policy

Every host, route, and endpoint should be classified into one of four classes.

### 6.1 Class A: Access-protected human applications

These should require Cloudflare Access before the request reaches the app:

- `app.venterradev.com`
- admin and operator product surfaces
- internal dashboards such as Watchtower, Intelligence Office, Site Content, and governed data tools

### 6.2 Class B: Access-protected machine endpoints

These should require service-token or equivalent non-human auth:

- internal APIs used by automation
- scheduled import/export endpoints
- write-capable control endpoints
- agent-facing or ops-only API paths

### 6.3 Class C: Public but hardened endpoints

Only endpoints that truly must remain public should stay public.

These must still use:

- Cloudflare WAF
- rate limiting
- bot/challenge controls where appropriate
- application-level validation and auth where applicable

### 6.4 Class D: Private origins

Services that do not need to be directly internet-reachable should be exposed through Cloudflare Tunnel instead of open inbound ports.

## 7. Recommended Host and Route Policy For This Repo

### 7.1 Frontend host

`app.venterradev.com` should be a Cloudflare Access application.

Default user policy:

- allow internal staff via SSO
- allow approved external users via one-time PIN email
- require MFA for admins and high-risk cohorts

### 7.2 API host

`api.venterradev.com` should not be treated as a single flat security zone.

Recommended split:

- browser-driven authenticated app traffic stays reachable from the frontend under Access protection
- sensitive admin, export, write, and internal-only endpoints get stricter Access policy
- machine-only endpoints use service tokens
- any unavoidable public endpoints remain explicitly listed and hardened

### 7.3 Sensitive route families

The following route families should be treated as high-sensitivity surfaces:

- `/v1/admin`
- `/v1/admin/intelligence`
- `/v1/admin/site-content`
- `/v1/exports`
- `/v1/intelligence-memory`
- `/v1/platform`
- import or write-capable metric endpoints

### 7.4 Public route candidates

Only keep these public if there is a real product reason:

- `/health`
- any non-sensitive auth bootstrap endpoint required before Access is in front

Even public health endpoints should disclose minimal information only.

## 8. Identity and User Experience Policy

### 8.1 Internal users

Internal users should have the smoothest and strongest path:

- SSO login through Cloudflare Access using the workforce IdP
- managed-device preference over unmanaged devices
- stronger MFA posture for admins and operators

Recommended implementation pattern:

1. Microsoft Entra ID authenticates the workforce identity
2. Cloudflare Access evaluates group and policy membership
3. Data Pond assigns the canonical app role:
   - `viewer` / `Observer`
   - `editor` / `Curator`
   - `admin` / `Steward`

### 8.2 External users

External users should not be forced into VPN-style access.

Preferred experience:

- Cloudflare Access email one-time PIN for approved recipients
- app-level role assignment inside the platform after Access identity is verified

### 8.3 Why not replace app auth entirely

Cloudflare Access should not replace app roles because:

- edge identity does not fully express product permissions
- different users may need different data visibility after entering the same app
- business audit logs and authorization checks still belong in the app

Cloudflare should reduce the attack surface.

The app should continue to enforce business rules.

## 9. Device and Data Transfer Policy

### 9.1 Local machine to cloud

For your box and internal team devices, use Cloudflare WARP plus Gateway as the preferred outbound protection path.

This should be used to improve:

- encrypted device egress
- DNS and HTTP policy enforcement
- visibility into destinations
- safer transfer paths from local automation to cloud services

### 9.2 Admin and operator posture

Require stronger posture for high-risk surfaces:

- admins should use MFA
- admin/operator tools should prefer managed devices
- posture checks should be required before granting elevated access to sensitive apps

### 9.3 Inbound access to local or private services

If a local or self-hosted service must be reached remotely:

- use Cloudflare Tunnel
- do not expose direct inbound ports if the Tunnel path is viable

## 10. Secret and Credential Policy

### 10.1 Canonical storage

Store these in Keeper:

- Cloudflare API admin tokens
- Cloudflare Access service token secrets
- tunnel credentials or bootstrap materials
- email-provider secrets
- worker/app signing secrets
- third-party API keys

### 10.2 Deployment copies

Platform-native secret stores remain acceptable for runtime copies:

- `wrangler secret put`
- Cloudflare-managed secret/config channels

But Keeper remains the source of truth for ownership and rotation.

### 10.3 Secret hygiene rules

- no long-lived tokens in `Downloads`
- no shared team credentials when individual or per-system credentials are possible
- no repo-local plaintext secrets committed to git
- no long-lived local `.env` drift where Keeper-backed resolution exists

## 11. Origin Protection Policy

Cloudflare Access alone is not sufficient if the origin remains directly reachable outside Cloudflare controls.

Required posture:

- prefer Cloudflare Tunnel for private origins
- otherwise restrict origin reachability so only Cloudflare is the path in
- validate Access tokens or equivalent trust at the protected service boundary when applicable

## 12. Immediate Hardening Priorities

### 12.1 Highest priority

1. Put `app.venterradev.com` behind Cloudflare Access
2. Define internal-user SSO and external-user email OTP policies
3. Classify all API routes into human, machine, and public classes
4. Protect admin/export/write paths with stricter policies
5. move Cloudflare service credentials fully under Keeper-backed inventory and rotation discipline

### 12.2 Near-term hardening

1. Add service-token policy for automation against protected endpoints
2. Roll out WARP for internal operator devices
3. require device posture for admin/operator access
4. move private services to Tunnel where possible
5. enable WAF and rate limits for any endpoints that remain public

### 12.3 Code-level hardening items visible in current repo

The following repo-observed item was retired on 2026-04-17:

- the Site Content debug bypass path (`x-debug-site-content` plus its runtime toggle) was removed from the production auth path

Current implication:

- Site Content should now be treated as a normal authenticated human-access lane rather than a trust-review exception

## 13. Access Policy Templates

### 13.1 Internal app policy

- include: internal IdP group(s)
- require: MFA
- require: managed device posture for admins/operators
- exclude: terminated or blocked users

### 13.2 External app policy

- include: approved emails or approved domains via Access
- require: one-time PIN email verification
- require: MFA if the audience and plan support it for the relevant path
- exclude: revoked users

### 13.3 Admin policy

- include: admin group only
- require: MFA
- require: managed device posture
- shorter session duration than standard users

### 13.4 Service policy

- include: specific service token only
- no human login path
- per-system token rotation and audit review

## 14. Rollout Plan

### Phase 1: Inventory and policy map

- inventory all active hostnames and API route families
- classify each surface as human, machine, public, or private
- identify which external users need access at launch

### Phase 2: Edge protection

- create Cloudflare Access applications for `app.venterradev.com` and protected API surfaces
- connect internal SSO
- enable external email OTP flow
- set deny-by-default posture

### Phase 3: Secret and service identity cleanup

- move all Cloudflare service credentials to Keeper-backed canonical records
- create per-system service tokens for automation
- remove ad hoc local token storage patterns

### Phase 4: Device and origin hardening

- roll out WARP to internal operators
- enable posture requirements for high-risk surfaces
- move qualifying private services to Tunnel

### Phase 5: App integration refinement

- map Access identity cleanly into app users and roles
- tighten audit logging around privileged flows
- remove or sharply constrain debug bypass mechanisms

## 15. Canonical Decisions

- Cloudflare Zero Trust is the platform's outer trust boundary
- Keeper remains the canonical secret authority
- application roles remain the canonical business authorization system
- internal users should prefer SSO
- external users should use Cloudflare Access email OTP unless a better federated path exists
- automation must use service identity, not human sessions
- private services should prefer Tunnel over open inbound ports
- device trust should become mandatory for admin/operator access

## 16. Next Implementation Artifacts

The next concrete documents or tasks should be:

- a hostname and route classification matrix for `app.venterradev.com` and `api.venterradev.com`
- a Keeper record manifest for Cloudflare Zero Trust artifacts
- an Access application/policy build checklist
- a route-by-route public vs protected decision log

Current implementation artifact now available:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
