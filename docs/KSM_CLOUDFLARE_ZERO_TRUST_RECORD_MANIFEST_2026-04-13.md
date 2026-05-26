# Keeper Manifest For Cloudflare Zero Trust

Status: Draft v1
Date: 2026-04-13
Owner: MarketingOps / Property Analytics
Profile: `marketingops`

## 1. Purpose

Define the Keeper records, notation variables, and ownership model for Cloudflare Zero Trust rollout artifacts.

This document is the Keeper companion to:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`

## 2. Keeper Role In This System

Keeper remains the source of truth for:

- Cloudflare admin/API credentials
- Access service-token credentials
- Tunnel credentials if introduced
- app/runtime secrets that participate in the Zero Trust boundary

Cloudflare remains the trust boundary and policy engine.

Keeper stores the keys used to operate that boundary.

## 3. Recommended Keeper Folder

Use a dedicated folder branch inside the existing MarketingOps secret space.

Suggested folder:

- `Property Analytics / Cloudflare Zero Trust`

If Keeper prefers flatter naming, this is also acceptable:

- `Property Analytics - Cloudflare Zero Trust`

## 4. Record Design Principles

- prefer one secret or one tightly related credential pair per record
- prefer standard structured fields over file attachments
- do not store one-time bootstrap tokens in shared folders
- record ownership and intended system in the title or notes
- give every machine credential a clear system scope

## 5. Required Keeper Records

### 5.1 Cloudflare Admin API Token

Suggested record title:

- `Cloudflare / Admin API Token`

Purpose:

- administrative Cloudflare automation
- Access/Tunnel/WAF configuration
- current Cloudflare ops scripts

Notation env var:

- `KSM_CLOUDFLARE_TOKEN_NOTATION`

Current state:

- already present and active in the repo secret model

### 5.2 Cloudflare Access Service Token - Platform

Suggested record title:

- `Cloudflare / Access Service Token / Platform`

Purpose:

- machine access to `/v1/platform/*`

Recommended fields:

- `login` or custom text field: client id
- `password` or custom secret field: client secret

Suggested notation env vars:

- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION`

Associated current app-layer secret to reconcile:

- `PLATFORM_SHARED_TOKEN` remains transitional fallback only during cutover

### 5.3 Cloudflare Access Service Token - VACS

Suggested record title:

- `Cloudflare / Access Service Token / VACS`

Purpose:

- machine access to `/v1/vacs/*`

Suggested notation env vars:

- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION`

Associated current app-layer secret to reconcile:

- no VACS shared-token fallback should remain on the canonical route after the 2026-04-17 retirement

### 5.4 Cloudflare Access Service Token - EVS

Suggested record title:

- `Cloudflare / Access Service Token / EVS`

Purpose:

- future machine access for EVS workflows if EVS is formalized as service-only traffic

Suggested notation env vars:

- `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION`

Associated current app-layer secret to reconcile:

- `EVS_SHARED_TOKEN` remains transitional fallback only during cutover

### 5.5 Session Signing Secret

Suggested record title:

- `App / Session Signing Secret`

Purpose:

- worker session trust for app auth

Suggested notation env var:

- `KSM_SESSION_SIGNING_SECRET_NOTATION`

Associated runtime binding:

- `SESSION_SIGNING_SECRET`

### 5.6 Resend API Key

Suggested record title:

- `Email / Resend API Key`

Suggested notation env var:

- `KSM_RESEND_API_KEY_NOTATION`

Associated runtime binding:

- `RESEND_API_KEY`

### 5.7 Email From Address

Suggested record title:

- `Email / From Address`

Suggested notation env var:

- `KSM_EMAIL_FROM_NOTATION`

Associated runtime binding:

- `EMAIL_FROM`

## 6. Optional Future Records

### 6.1 Tunnel Credentials

Create if Cloudflare Tunnel is introduced for private services.

Suggested record title:

- `Cloudflare / Tunnel / <Service Name>`

Suggested env var pattern:

- `KSM_CLOUDFLARE_TUNNEL_<SERVICE>_TOKEN_NOTATION`

### 6.2 WARP / Gateway Admin Notes

If WARP and posture become a managed program, consider operational records for:

- tenant identifiers
- enrollment notes
- operator references

These may be documentation records rather than runtime-secret records.

## 7. Naming Convention

Recommended notation style:

- `KSM_CLOUDFLARE_<SYSTEM>_<SECRET>_NOTATION`

Examples:

- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION`

Use existing repo naming where already established:

- `KSM_CLOUDFLARE_TOKEN_NOTATION`
- `KSM_RESEND_API_KEY_NOTATION`
- `KSM_EMAIL_FROM_NOTATION`
- `KSM_SESSION_SIGNING_SECRET_NOTATION`

## 8. Ownership Metadata To Capture In Keeper

For each record, add notes or metadata for:

- owner
- system
- route family
- environment
- rotation expectation
- runtime injection target

Recommended environment values:

- `production`
- `staging`
- `shared-local-dev` only if truly necessary

## 9. Rotation Policy

Recommended posture:

- Cloudflare admin token: rotate on normal security cadence and after suspected exposure
- Access service tokens: rotate per-system on a shorter cadence than general admin tokens
- session and email secrets: rotate deliberately with deployment coordination

Always rotate immediately if a token was:

- stored in `Downloads`
- pasted into chat
- added to shell history
- shared outside Keeper and approved deployment channels

## 10. Runtime Mapping Checklist

Map Keeper records to runtime use like this:

| Keeper Record | Notation Env Var | Runtime Consumer |
| --- | --- | --- |
| Cloudflare / Admin API Token | `KSM_CLOUDFLARE_TOKEN_NOTATION` | Cloudflare ops scripts, Wrangler helper, Cloudflare admin automation |
| Cloudflare / Access Service Token / Platform | `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`, `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION` | platform service clients |
| Cloudflare / Access Service Token / VACS | `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION`, `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION` | VACS service clients |
| Cloudflare / Access Service Token / EVS | `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION`, `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION` | EVS service clients |
| App / Session Signing Secret | `KSM_SESSION_SIGNING_SECRET_NOTATION` | worker runtime secret injection |
| Email / Resend API Key | `KSM_RESEND_API_KEY_NOTATION` | worker runtime secret injection |
| Email / From Address | `KSM_EMAIL_FROM_NOTATION` | worker runtime config injection |

## 11. Current Repo Alignment Notes

Already aligned:

- `KSM_CLOUDFLARE_TOKEN_NOTATION` is documented and active
- Keeper-first secret resolution is already standard in the repo
- `marketingops` is the active local KSM profile

Needs follow-up:

- keep `PLATFORM_SHARED_TOKEN`, `VACS_SHARED_TOKEN`, and `EVS_SHARED_TOKEN` Keeper-backed only while migration fallback is still needed
- prefer Access service-token credentials as the canonical machine identity model for `platform`, `vacs`, and `evs`
- remove each shared token from runtime/deployment after that route family is verified on Access credentials alone

## 12. Recommended Next Step After This Manifest

After these records are created or confirmed:

1. document the actual notation env vars in the deployment/operator setup
2. complete the retirement sequence for `PLATFORM_SHARED_TOKEN`, `VACS_SHARED_TOKEN`, and `EVS_SHARED_TOKEN`
3. update runtime scripts or deployment helpers to pull from Keeper-backed notation consistently

## 13. Notes

- this manifest does not store live secret values
- this manifest should be updated whenever a new Zero Trust service credential is introduced
- prefer extending this manifest over creating parallel Cloudflare secret docs
