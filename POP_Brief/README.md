# POP Brief Memory Pack
Title: POP Brief Memory Pack
Version: 1.0.0
Status: Active
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Executive Owner: TBD
- Product Owner: TBD
- Technical Steward: TBD
- Operations Steward: TBD

## Briefing Family Position

POP Brief is part of the governed briefing family for the platform.

Current family posture:

- PIB is the protected canonical Property Intelligence Brief engine
- POP Brief is the structured property-operations performance briefing system
- Spotlight is a specialized imported reporting lane

Canonical family reference:

- `/Users/mark/Property_Analytics/docs/BRIEFING_FAMILY_ARCHITECTURE_2026-04-18.md`

## What POP Brief Is
Property Ops Performance Brief System (POP Brief) is a login-required internal application for compiling, validating, and distributing weekly and rolling-window operational performance data across a property portfolio. The system standardizes week-ending Friday reporting and supports both community-level and portfolio-level records so leadership can consume a consistent performance brief.
POP Brief is designed for a small controlled user base (about 10 users) with admin-managed onboarding and lifecycle controls. The system runs on Cloudflare-hosted components to keep operations lightweight while preserving data integrity, traceability, and predictable delivery.
## Problems It Solves
- Eliminates inconsistent metric spreadsheets and ad hoc reporting logic.
- Enforces week-ending Friday inputs to prevent period drift.
- Provides a single import and validation model for 7-day and 30-day rolling windows.
- Supports controlled user provisioning through admin-created invites only.
- Reduces communication gaps through deduplicated mention notifications and consistent exports.
## What v1 Includes
- Login-required web app on Cloudflare Pages (`app.venterradev.com`).
- API and business rules on Cloudflare Workers (`api.venterradev.com`).
- Core relational storage in Cloudflare D1.
- File import staging and backup artifacts in Cloudflare R2.
- Admin-only invites, admin-only delete operations, and soft-delete strategy for business entities.
- Import flows for pasted TSV and CSV upload with replace-import transactional behavior.
- Marketing mention scan flow and deduplicated notification event tracking.
- CSV export and backup endpoints for operational recovery.

## Grounding Core Direction

The next POP Brief evolution is a property-brief grounding core.

Its role is to capture recurring source material, normalize claims, reconcile vendor intelligence against Data Pond truth, and produce reusable brief-ready blocks before final artifacts are rendered.

Canonical reference:

- `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md`

This keeps POP Brief useful as a final property brief / Captain's Log substrate without creating a shadow PIB renderer or changing locked PIB generation behavior.
## How To Use This Memory Pack
Use this pack as the source of truth for planning, implementation, and operations decisions. Start with the charter for intent, then follow the system contract for rules that are non-negotiable.
Canonical decision ownership:
- Product scope and intent: `00_Project_Charter.md`
- Non-negotiable engineering rules: `01_System_Contract.md`
- Delivery sequencing: `02_Roadmap.md`
- Technical topology and trust boundaries: `03_Architecture.md`
- Environment setup and release process: `04_Deployment_Guide.md`
- Data entities and integrity constraints: `05_Data_Model.md`
- Endpoint definitions and payload contracts: `06_API_Contract.md`
- Threat model and controls: `07_Security_Model.md`
- Email and notification behavior: `08_Email_Integration.md`
- Import validation and transactional behavior: `09_Import_Rules.md`
- Day-2 operations and recovery procedures: `10_Operations_Runbook.md`
- Version history and release notes: `CHANGELOG.md`
## Naming Conventions
- Product name: POP Brief
- Short form: POP
- Repository folder identifier: `POP_Brief`
## Environments And Domains
- Frontend: Cloudflare Pages at `app.venterradev.com`
- API: Cloudflare Workers at `api.venterradev.com`
- Data: Cloudflare D1
- Object storage: Cloudflare R2
- Email transport (MVP): Resend HTTPS API
## Policy: Legacy Vendor Name Ban
Do not reference legacy vendor names in this project documentation, code comments, product copy, or operational procedures.
## Documentation Navigation
- Read `00_Project_Charter.md` to align on scope and success criteria.
- Read `01_System_Contract.md` before implementation work.
- Read `05_Data_Model.md` and `06_API_Contract.md` together for API and schema alignment.
- Use `04_Deployment_Guide.md` and `10_Operations_Runbook.md` for deployment and day-2 execution.
