# 02 Roadmap
Title: POP Brief Delivery Roadmap
Version: 1.0.0
Status: Active Plan
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Product Lead: TBD
- Engineering Lead: TBD
- Delivery Manager: TBD
## Milestone Structure
The v1 roadmap is organized into four phases to move from foundation to stable internal operation.
## Phase 0 Foundation
- Initialize repository structure and memory pack artifacts.
- Stand up Cloudflare environments (Pages, Workers, D1, R2).
- Implement auth baseline and session handling.
- Define and migrate initial schema.
Exit criteria:
- Environment bootstrapped and basic authenticated API request succeeds.
## Phase 1 Core Data And Import
- Implement communities CRUD with soft-delete.
- Implement weekly metrics import (paste TSV and CSV upload paths).
- Enforce Friday week-ending validation and window/type constraints.
- Implement import run logging and transactional replace-import.
Exit criteria:
- Admin can import and retrieve valid data with deterministic results.
## Phase 2 Marketing And Analysis
- Implement marketing weekly patch and mention scan workflows.
- Implement analysis retrieval endpoint for leadership briefing views.
- Add export endpoints for operational pull and backup.
Exit criteria:
- Leadership-facing data retrieval covers community and portfolio perspectives.
## Phase 3 Comms And Hardening
- Integrate Resend invite and mention notifications with dedupe controls.
- Add rate limits and audit-oriented logs.
- Finalize deployment guide and operations runbook execution checks.
Exit criteria:
- End-to-end operational path validated with rollback and recovery rehearsal.
## Post-v1 Expansion (Planned)
- BI ingest connectors and warehouse sync.
- Insight engine with richer trend and anomaly logic.
- Microsoft Teams delivery integration.
- Enterprise SSO.
