# PR: POP Brief v1 MVP scaffold + core logic + hardening

## What's Included

### Governance & Memory Pack (v1.0.0, v1.0.1)
- POP_Brief canonical docs: System Contract, Architecture, Data Model, API Contract, Security Model, etc.
- ADR-0001 through ADR-0004 (Cloudflare hosting, Friday week-ending rule, admin-only destructive actions, unified weekly metrics table)
- CHANGELOG with versioned entries

### Application Scaffold
- **API** (`apps/api/`): Cloudflare Worker with Hono, D1 binding, R2 binding, Resend email adapter
- **Frontend** (`apps/web/`): Next.js pages for login, communities, metrics import, marketing, analysis, admin
- **Shared** (`packages/shared/`): TypeScript interfaces + Zod validation schemas
- **Migrations** (`infra/migrations/`): 9 SQL migrations (users, sessions, invites, communities, weekly_metrics, marketing_weekly, import_runs, notification_events, audit_log)
- **Scripts** (`scripts/`): bootstrap, deploy, smoke test

### Core Data Logic
- **Auth**: PBKDF2 password hashing (Web Crypto), session token via SHA-256, httpOnly cookie, login/logout/me/redeem-invite
- **Communities**: CRUD with soft-delete (admin-only writes per ADR-0003)
- **Metrics**: GET with filters + Friday validation, atomic paste import (JSON rows, D1 batch), import_runs status tracking, admin DELETE by scope
- **Marketing**: GET with filters, PATCH with upsert (get-or-create by composite key), scan-mentions with email extraction and dedupe notification_events
- **Analysis**: Composite response (community, T7/T30 community+portfolio metrics, marketing weekly). Portfolio rows read directly per ADR-0004.
- **Exports**: Admin-only CSV export for 5 entities with proper escaping

### Security & Operational Hardening
- **Cookie posture**: HttpOnly, Secure, SameSite=Lax, explicit Max-Age, Path=/
- **Rate limiting**: In-memory sliding-window limiter (login 5/15min per IP, scan-mentions 10/min per user, email 20/min global). DEV-ONLY per-isolate.
- **CSV injection protection**: Cells starting with `=`, `+`, `-`, `@` prefixed with single quote
- **HTML sanitization**: Server-side rejection of `<script>` tags and `on*=` event handlers in user text fields
- **Audit logging**: Immutable audit_log rows for community CRUD, invite creation, user updates, metrics import/delete, CSV exports
- **Safe defaults**: `ENABLE_EMAIL_SEND=false`, generic error messages (no secret leakage), consistent 401/403 behavior

## What's Excluded / Deferred
- **Distributed rate limiting** — In-memory limiter is per-isolate, resets on cold start. TODO: Durable Objects for prod.
- **Full HTML sanitization library** — Regex-based pattern rejection only. No DOMPurify dependency.
- **HMAC session signing** — SESSION_SIGNING_SECRET is set but session tokens use hash lookup only. HMAC deferred.
- **CSV file upload import** — `POST /v1/metrics/import/upload` returns 501. Paste import is the MVP path.
- **AI summary generation** — Not in scope for v1.
- **R2 backup export** — `POST /v1/exports/backup` returns 501.

## How to Test

```bash
# 1. Apply migrations to local D1
wrangler d1 execute pop-brief-db --local --file=infra/migrations/001_users.sql
# ... repeat for 002-009

# 2. Seed an admin user (use the bootstrap script or manual INSERT)
# scripts/bootstrap_cloudflare.sh has seed logic

# 3. Start local dev
cd apps/api && wrangler dev

# 4. Run smoke tests
bash scripts/smoke_test_local.sh

# 5. Manual flow
# Login:        POST /v1/auth/login {"email":"...","password":"..."}
# Community:    POST /v1/communities {"name":"Test Community"} (admin)
# Paste import: POST /v1/metrics/import/paste {"rows":[...]} (Friday dates only)
# Analysis:     GET /v1/analysis?week_ending=2026-02-20&community_id=<id>
# Export CSV:   GET /v1/exports/csv?entity=communities (admin)

# 6. Security checklist
# See scripts/security_checklist.md for full manual test list
```

## Risks & Notes
- In-memory rate limiter resets on Worker cold start — MVP limitation, acceptable for initial deploy
- `ENABLE_EMAIL_SEND` defaults to `false` — must be explicitly enabled in production
- Friday enforcement is a hard runtime error (ADR-0002) — non-Friday dates are rejected at validation
- Audit log writes are fire-and-forget — failures logged to console but never block requests
- No automated test suite yet — smoke tests are curl-based, manual security checklist provided
