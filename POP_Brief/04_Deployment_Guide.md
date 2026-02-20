# 04 Deployment Guide
Title: POP Brief Deployment Guide
Version: 1.0.0
Status: Operational Baseline
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Release Steward: TBD
- Platform Operator: TBD
## Purpose
This guide defines minimal-manual deployment for POP Brief using Cloudflare and Resend.
## One-Time Manual Steps
- Install and authenticate Wrangler CLI.
- Create Cloudflare D1 database.
- Create Cloudflare R2 bucket(s) for imports and backups.
- Create Pages project and connect Git repository.
- Configure custom domains:
  - Frontend: `app.venterradev.com`
  - API: `api.venterradev.com`
- Configure DNS and verify Resend sending domain records (SPF/DKIM/return-path as required by Resend).
- Set production secrets in Worker environment:
  - `SESSION_SIGNING_SECRET`
  - `RESEND_API_KEY`
  - `RESEND_FROM_ADDRESS`
## Repeatable Steps
- Apply schema migrations.
- Deploy Worker.
- Trigger/confirm Pages deployment from main branch.
- Run post-deploy verification checks.
## Example Commands (Wrangler)
```bash
# Login
wrangler login
# D1 create (run once)
wrangler d1 create pop-brief-prod
# R2 create (run once)
wrangler r2 bucket create pop-brief-imports
wrangler r2 bucket create pop-brief-backups
# Apply migrations
wrangler d1 migrations apply pop-brief-prod --remote
# Set secrets (example names only; do not paste real values)
wrangler secret put SESSION_SIGNING_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_ADDRESS
# Deploy Worker
wrangler deploy
```
## Pages Setup Notes
- Configure build command and output directory per frontend framework.
- Bind environment variables required by the frontend (API base URL only; no secrets).
- Ensure production branch protection and required checks are in place.
## Post-Deploy Verification Checklist
- `app.venterradev.com` loads over HTTPS.
- Auth flow succeeds for invited user.
- Protected API route denies unauthenticated request and allows authenticated request.
- Friday date validation rejects non-Friday import rows.
- Resend test send succeeds for invite path.
- Import and export endpoints complete without runtime errors.
## Rollback Guidance
- Worker: redeploy previous known-good artifact.
- D1: apply rollback migration if schema regression is introduced.
- Data: recover using backup export and controlled re-import.
