# Data Pond VenterraWebOps Migration Runbook

Date: 08/22/2026
Owner: MarketingOps / Property Analytics
Status: implementation-prep

## Decision

Move the corporate Data Pond surface to:

- Web: `https://pond.venterrawebops.com`
- API: `https://api.venterrawebops.com`

Keep the existing `https://app.venterradev.com` and `https://app.venterraliving.com` origins accepted during the migration window so active sessions, bookmarks, and rollback remain manageable.

## Implemented In Repo

- `apps/api/src/lib/frontend-origin.ts`
  - Primary default frontend is now `https://pond.venterrawebops.com`.
  - `pond.venterrawebops.com` and `datapond.venterrawebops.com` are accepted frontend origins.
  - Data Pond sessions on the new host use cookie domain `.venterrawebops.com`.
- `apps/api/src/index.ts`
  - CORS allows `pond.venterrawebops.com` and `datapond.venterrawebops.com`.
- `apps/web/.env.production`
  - Production web points to `https://api.venterrawebops.com`.
  - Production auth remains Cloudflare Access first.
- `apps/api/wrangler.toml`
  - Cloudflare Access auto-provision remains enabled with default role `viewer`.
  - Auto-provision is constrained to `venterraliving.com` and `venterra.com` email domains.
- `apps/api/test/auth/cloudflare-bootstrap.test.ts`
  - Regression coverage proves the new Data Pond host redirects correctly and receives a `.venterrawebops.com` session cookie.

## Cloudflare Work Required

1. Create or confirm DNS/custom host for `pond.venterrawebops.com`.
2. Create or confirm DNS/custom host for `api.venterrawebops.com`.
3. Protect both hosts with the existing Cloudflare Access / Entra SSO policy.
4. Add the Access app audience tags to API runtime config:
   - `CLOUDFLARE_ACCESS_AUD=<comma-separated-api-access-auds>`
5. Keep these API runtime vars:
   - `CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://macxs.cloudflareaccess.com`
   - `CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED=true`
   - `CLOUDFLARE_ACCESS_DEFAULT_ROLE=viewer`
   - `CLOUDFLARE_ACCESS_ALLOWED_DOMAINS=venterraliving.com,venterra.com`

Keeper/KSM remains the source of truth for deployment auth and secret material. Do not create local token files or ad hoc env secret paths for this migration.

## Deployment Sequence

1. Deploy API with the new origin/cookie allowlist.
2. Attach `api.venterrawebops.com` to the API Worker.
3. Deploy web with `NEXT_PUBLIC_API_BASE_URL=https://api.venterrawebops.com`.
4. Attach `pond.venterrawebops.com` to the web deployment.
5. Validate Cloudflare Access login from `pond.venterrawebops.com`.
6. Validate `/v1/auth/me` returns the expected corporate email and app role.
7. Validate a first-time corporate user auto-provisions as `viewer`.
8. Promote specific users to `editor` or `admin` only through the existing app user role model.
9. Keep `app.venterradev.com` active until the new host passes auth, Data Pond navigation, and key workflow smoke checks.

## Smoke Checks

- `https://pond.venterrawebops.com` requires Cloudflare Access.
- Login through Entra succeeds.
- Browser reaches the Data Pond app after `/v1/auth/access-bootstrap`.
- `pop_session` cookie is scoped to `.venterrawebops.com`.
- `GET https://api.venterrawebops.com/v1/auth/me` returns `200`.
- Data Pond pages load without CORS errors.
- Admin-only surfaces remain blocked for `viewer`.
- Existing `launch.venterrawebops.com` magic-link flow still works.

## 08/22/2026 Cloudflare Access Setup

Created the `venterrawebops.com` Access applications:

- `Data Pond - Main App - VenterraWebOps`
  - Domain: `pond.venterrawebops.com`
  - Policy: allow `venterraliving.com` and `venterra.com` email domains
- `Data Pond - API Auth Bootstrap - VenterraWebOps`
  - Domain: `api.venterrawebops.com/v1/auth/access-bootstrap`
  - Policy: allow `venterraliving.com` and `venterra.com` email domains
- `Data Pond - Admin Core - VenterraWebOps`
  - Domain: `pond.venterrawebops.com/admin/*`
  - Policy: allow `mlaufhutte@venterraliving.com`
- `Data Pond - Admin Backup - VenterraWebOps`
  - Domain: `pond.venterrawebops.com/backup*`
  - Policy: allow `mlaufhutte@venterraliving.com`
- `Data Pond - API Platform - VenterraWebOps`
  - Domain: `api.venterrawebops.com/v1/platform/*`
  - Policy: allow `mlaufhutte@venterraliving.com`
- `Data Pond - API EVS - VenterraWebOps`
  - Domain: `api.venterrawebops.com/v1/evs/*`
  - Policy: allow `mlaufhutte@venterraliving.com`
- `Data Pond - API VACS - VenterraWebOps`
  - Domain: `api.venterrawebops.com/v1/vacs/*`
  - Policy: allow `mlaufhutte@venterraliving.com`

The API runtime now carries the comma-separated AUD list for both the legacy `api.venterradev.com` API Access apps and the new `api.venterrawebops.com` API Access apps.

## 08/22/2026 Deployment Readback

- API Worker `pop-brief-api` deployed with side-by-side custom domains:
  - `api.venterradev.com`
  - `api.venterrawebops.com`
- API Worker version: `d533ebfc-a599-4920-b50a-3e3de572bfea`.
- Web Pages project: `property-analytics`.
- Web Pages deployment: `https://4dec4d06.property-analytics.pages.dev`.
- `pond.venterrawebops.com` DNS:
  - Type: `CNAME`
  - Target: `property-analytics.pages.dev`
  - Proxied: `true`
- `pond.venterrawebops.com` was added as a Pages custom domain.

Smoke checks:

- `https://api.venterrawebops.com/health` returned `200`.
- `https://api.venterradev.com/health` returned `200`, confirming legacy API continuity.
- `https://api.venterrawebops.com/v1/auth/access-bootstrap?next=%2F` returned Cloudflare Access `302` using the new API bootstrap AUD.
- `https://pond.venterrawebops.com/` returned Cloudflare Access `302` using the new main app AUD.

Open validation:

- Browser login through Entra on `https://pond.venterrawebops.com`.
- Post-login `/v1/auth/access-bootstrap` session creation and `/v1/auth/me` app-session readback.
- First-time corporate viewer auto-provision smoke.

## Rollback

Keep `app.venterradev.com` accepted during the migration. If the new host fails, point users back to `https://app.venterradev.com` and leave the API origin allowlist in place until Cloudflare Access/DNS is corrected.
