# 03 Architecture
Title: POP Brief Architecture (C4-lite)
Version: 1.0.0
Status: Baseline
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Architecture Steward: TBD
- Platform Steward: TBD
## Context
Actors:
- Admin users (create invites, manage users, perform delete operations, run imports).
- Standard users (view data, run allowed analysis and export operations).
- Leadership consumers (consume brief outputs through authenticated app views).
System boundary:
- POP Brief internal web application and API stack.
External services:
- Resend API for transactional email.
- Cloudflare-managed runtime, data, and storage services.
## Containers
- Frontend container: Cloudflare Pages at `app.venterradev.com`.
- API container: Cloudflare Worker at `api.venterradev.com`.
- Relational data container: Cloudflare D1 (users, communities, metrics, imports, notification events).
- Object storage container: Cloudflare R2 (uploaded CSV artifacts, backup files).
- Email service container: Resend HTTPS API.
## Data Flow
Import flow:
- Authenticated admin submits paste TSV or uploads CSV.
- API validates shape, Friday week-ending, and enum rules.
- API logs `import_runs`, performs replace-import transaction in D1, and stores file artifact in R2 when applicable.
Analysis flow:
- Authenticated user requests analysis payload.
- API aggregates weekly and marketing records from D1 and returns standardized response.
Mentions flow:
- Authenticated user triggers mention scan.
- API computes mention candidates, creates dedupe keys, checks `notification_events`, and sends new notifications via Resend.
Invites flow:
- Admin creates invite.
- API stores hashed token and expiry, sends invite email via Resend.
- Recipient redeems invite, account is created/linked, session established.
## Trust Boundaries
- Public internet boundary: all inbound traffic arrives over HTTPS from browsers to app/api domains.
- Authenticated app boundary: protected API routes require valid session; role checks enforce admin-only capabilities.
- Data boundary: only Worker has direct D1/R2 credentials; browser does not receive infrastructure credentials.
- External provider boundary: Resend calls are outbound from Worker with scoped secret key.
## Why This Architecture
- Minimal operations overhead for a small internal user base.
- Reproducible deployment using Cloudflare-native services and Wrangler workflows.
- Clear separation of presentation, business logic, relational data, and file artifacts.
- External hosting model with custom domains aligned to internal consumption patterns.
