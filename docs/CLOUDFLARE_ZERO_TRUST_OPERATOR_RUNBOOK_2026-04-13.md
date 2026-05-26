# Cloudflare Zero Trust Operator Runbook

Status: Draft v1
Date: 2026-04-13
Owner: MarketingOps / Property Analytics

## 1. Purpose

Provide the step-by-step dashboard runbook for implementing the Cloudflare Zero Trust design defined in this repo.

Use this runbook together with:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`

## 2. Outcomes

When this runbook is complete:

- `app.venterradev.com` is protected by Cloudflare Access
- internal staff can sign in through SSO
- approved external users can sign in through email OTP
- admin and ops routes have stricter policy than normal app routes
- service access for machine endpoints is documented and provisioned
- Keeper is the source of truth for all Cloudflare-related credentials

## 3. Pre-Flight

Before touching Cloudflare:

1. Confirm the active production hosts:
   - `app.venterradev.com`
   - `api.venterradev.com`
2. Confirm the route classifications in:
   - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
3. Confirm Keeper record plan in:
   - `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
4. Decide the internal identity provider to connect first.
5. Decide the initial list of approved external users for OTP access.

## 4. Configure Identity Providers

In Cloudflare Zero Trust:

1. Go to `Integrations` > `Identity providers`.
2. Add the internal company IdP.
3. Prefer OIDC when your IdP supports both OIDC and SAML.
4. Verify internal staff can authenticate successfully.

For external users:

- Cloudflare Access supports one-time PIN without separate IdP setup.
- Plan to use OTP only for approved external users, not open self-enrollment.

## 5. Enable App Launcher

This is optional but recommended for user experience.

1. Go to `Access controls` > `Access settings`.
2. Open App Launcher management.
3. Create a launcher policy for users who should see your protected apps.
4. Limit launcher visibility to approved internal and external users.

Recommendation:

- expose only the intended user-facing apps
- do not expose hidden admin or machine apps in the launcher by default

## 6. Create Access Applications

### 6.1 Main App

Create a self-hosted application:

- name: `Data Pond - Main App`
- domain: `app.venterradev.com`

Policy set:

- internal staff allow rule
- approved external user allow rule
- no broad bypass

### 6.2 Admin and Ops App

Create a self-hosted application:

- name: `Data Pond - Admin and Ops`
- paths:
  - `app.venterradev.com/admin/*`
  - `app.venterradev.com/watchtower*`
  - `app.venterradev.com/intelligence-office*`
  - `app.venterradev.com/site-content*`
  - `app.venterradev.com/metrics-import*`
  - `app.venterradev.com/backup*`

Policy set:

- internal-only
- admin/editor/operator groups only
- MFA required
- shorter session duration
- posture requirement added after WARP rollout

### 6.3 Browser API

Create a self-hosted application:

- name: `Data Pond - Browser API`
- path scope: `api.venterradev.com/v1/*`

Purpose:

- browser-driven app traffic that should only be reachable by approved human users

Note:

- leave the bootstrap auth endpoints intentionally public only if you are preserving app-native login flows

### 6.4 Service API

Create a self-hosted application:

- name: `Data Pond - Service API`
- paths:
  - `api.venterradev.com/v1/platform/*`
  - `api.venterradev.com/v1/vacs/*`
  - future service-only endpoints as needed

Policy set:

- service token only
- no human interactive policy

## 7. Configure Access Policies

For each application, use include/exclude/require logic deliberately.

### 7.1 Main App Policy

Include:

- internal SSO groups
- approved external users

Require:

- standard session policy

Exclude:

- blocked users
- terminated users

### 7.2 Admin and Ops Policy

Include:

- internal admin group
- explicitly approved operators/editors

Require:

- MFA
- shorter session lifetime
- managed-device posture after WARP deployment

Exclude:

- all external users unless explicitly justified

### 7.3 External OTP Policy

Include:

- named user emails or a tightly controlled approved domain

Require:

- one-time PIN verification

Important:

- do not use a wide-open domain-based rule unless you actually trust every user in that domain

### 7.4 Service Policy

Include:

- only the specific service token created for that route family

Require:

- no user auth path

## 8. Configure Service Tokens

In Cloudflare Zero Trust:

1. Go to `Access controls` > `Service credentials` > `Service Tokens`.
2. Create a service token for each machine access family.
3. Copy the Client ID and Client Secret immediately.
4. Store them in Keeper right away.

Recommended initial service tokens:

- `platform`
- `vacs`
- `evs` for the machine-ingest side of the mixed EVS validation lane

Keeper mapping should follow:

- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`

## 9. Configure Public Bootstrap Routes

If preserving current app-native login:

- keep `/health`
- keep `/v1/auth/login`
- keep `/v1/auth/magic-link`
- keep `/v1/auth/verify`
- keep `/v1/auth/redeem-invite`

For these routes:

1. Apply WAF protection.
2. Apply rate limiting.
3. Avoid unnecessary response detail.
4. Monitor logs for abuse or enumeration attempts.

## 10. WARP and Posture Rollout

### 10.1 Initial device rollout

1. Go to `Team & Resources` > `Devices`.
2. Configure WARP device profiles for internal admins and operators first.
3. Validate devices register correctly.

### 10.2 Posture checks

1. Go to `Reusable components` > `Posture checks`.
2. Add the first posture checks you actually intend to enforce.
3. Verify posture results in device details and posture logs before requiring them in policy.

Start small:

- require posture only for admin and ops applications first

### 10.3 Posture-only visibility phase

Before hard enforcement:

- observe which internal devices pass and fail
- correct gaps
- then add posture to Access policies

## 11. Repo Integration Follow-Up

After Cloudflare-side setup, follow up in repo/deployment:

1. Confirm runtime bindings and secret injection for:
   - `SESSION_SIGNING_SECRET`
   - email secrets
   - Access service-token client credentials:
     - `PLATFORM_ACCESS_CLIENT_ID`
     - `PLATFORM_ACCESS_CLIENT_SECRET`
     - `VACS_ACCESS_CLIENT_ID`
     - `VACS_ACCESS_CLIENT_SECRET`
     - `EVS_ACCESS_CLIENT_ID`
     - `EVS_ACCESS_CLIENT_SECRET`
   - any remaining shared service tokens during transition
2. Complete shared-token retirement sequence:
   - `PLATFORM_SHARED_TOKEN`
   - `EVS_SHARED_TOKEN`
3. Confirm Site Content stays on the governed human-access path:
   - no debug-bypass route should be reintroduced into production auth flow
   - any future debug mode should be isolated to an explicitly non-production mechanism

## 12. Rollout Sequence

Recommended sequence:

1. Connect internal IdP
2. Define approved external OTP audience
3. Create `Data Pond - Main App`
4. Create `Data Pond - Admin and Ops`
5. Create `Data Pond - Browser API`
6. Create service tokens
7. Create `Data Pond - Service API`
8. Store all credentials in Keeper
9. Turn on WAF and rate limiting for the intentionally public bootstrap routes
10. Roll out WARP to admins/operators
11. Add posture checks to the admin/ops app
12. Retire shared-token fallback where Access credentials are verified
13. Review and tighten repo-level debug and remaining temporary trust shortcuts

## 13. Verification

Verify each audience separately.

### 13.1 Internal user

- can sign in through SSO
- can reach the main app
- cannot reach admin areas unless authorized

### 13.2 External user

- can receive OTP
- can access approved app surfaces
- cannot reach admin/ops areas

### 13.3 Admin/operator

- can pass MFA
- can reach admin/ops areas
- later can pass posture checks after WARP rollout

### 13.4 Machine client

- can authenticate with service token
- can reach only the service routes it is intended to access

## 14. Sources

Official Cloudflare docs used for this runbook:

- [Identity providers](https://developers.cloudflare.com/access/setting-up-access/)
- [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/)
- [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [Posture checks](https://developers.cloudflare.com/cloudflare-one/identity/devices/)
- [App Launcher](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/app-launcher/)

Inference note:

- the specific application names, route splits, and rollout order in this runbook are repo-specific design recommendations derived from the current `Property_Analytics` deployment shape and route inventory
