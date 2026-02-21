# POP Brief v1 scaffold (Cloudflare Pages/Workers/D1/R2)

## Summary
Application scaffold for POP Brief v1. **No business logic is implemented.** All route handlers return 501. All migrations use `CREATE TABLE IF NOT EXISTS`. This PR establishes the project structure, type contracts, and deployment plumbing required before feature work begins.

All decisions comply with ADR-0001 through ADR-0004.

## What Changed

### Backend — `apps/api/`
- Cloudflare Worker project: `wrangler.toml`, `package.json`, `tsconfig.json`
- Hono router with `/v1` prefix and CORS configuration
- Bindings: `POP_BRIEF_DB` (D1), `POP_BRIEF_UPLOADS` (R2), secrets placeholders
- Auth middleware: `requireAuth` (session cookie), `requireAdmin` (role gate per ADR-0003)
- 22 stubbed API endpoints matching `06_API_Contract.md`:
  - Auth (4): login, logout, me, redeem-invite
  - Admin (3): create invite, list users, patch user
  - Communities (4): list, create, update, soft-delete
  - Metrics (5): get, paste import, upload import, import status, delete
  - Marketing (3): get, patch, scan-mentions
  - Analysis (1): get
  - Exports (2): CSV export, backup
- Email adapter stub: `src/email/resend.ts` (fetch-based, per ADR-0001 SMTP constraint)

### Database — `infra/migrations/`
9 migration files matching `05_Data_Model.md`:
- `001_users` through `009_audit_log`
- Composite uniqueness on `weekly_metrics` (ADR-0004) and `marketing_weekly`
- Unique `dedupe_key` on `notification_events`
- Soft-delete fields on `communities` and `users`
- All audit fields present

### Shared Types — `packages/shared/`
- TypeScript interfaces for all 9 entities
- Zod validation schemas with Friday date enforcement (ADR-0002)
- Schemas for: login, invite redemption, community CRUD, metrics import/delete, marketing patch, analysis query, exports

### Frontend — `apps/web/`
- Next.js App Router with static export (Cloudflare Pages target)
- 6 pages: `/login`, `/communities`, `/metrics-import`, `/marketing`, `/analysis`, `/admin/users`
- API client helper with credential forwarding and 401 redirect
- `NEXT_PUBLIC_API_BASE_URL` environment variable

### Scripts — `scripts/`
- `bootstrap_cloudflare.sh`: validates wrangler, outputs manual provisioning steps
- `deploy_api.sh`: applies D1 migrations, deploys Worker (idempotent)

## What Did NOT Change
- `POP_Brief/` documentation — untouched
- `Data_Collection/` — untouched
- `Project_Memory.md` — untouched
- No existing files were modified

## Testing
- Local build commands not executed (dependencies not installed)
- Structural verification: all files created, all routes registered, all migrations syntactically valid SQL
- Manual validation against governing docs: `01_System_Contract.md`, `03_Architecture.md`, `05_Data_Model.md`, `06_API_Contract.md`

## Risk
**Low.** Scaffold only — no business logic, no data mutations, no external service calls. All handlers return 501. Safe to merge as a structural baseline.
