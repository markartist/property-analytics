# 01 System Contract
Title: POP Brief System Contract
Version: 1.0.0
Status: Authoritative
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Contract Steward: TBD
- Engineering Approver: TBD
- Product Approver: TBD
## Purpose
This document defines non-negotiable system rules and invariants for POP Brief v1.
## Authoritative Rules
- Week-ending dates must be Friday; non-Friday dates are hard validation errors.
- User invites are admin-created only.
- Delete operations are admin-only.
- Application access is login-required for all protected endpoints.
## Data Integrity Constraints
- `users.email` is unique (case-insensitive normalized form).
- `invites.token_hash` is unique.
- `communities.external_key` is unique when present.
- `weekly_metrics` uniqueness: (`metric_date`, `window_days`, `type`, `community_id`) where `type=community` and (`metric_date`, `window_days`, `type`) where `type=portfolio`.
- `marketing_weekly` uniqueness: (`week_ending`, `community_id`).
- `notification_events.dedupe_key` is unique.
## Replace-Import Transactional Rules
- Each import run is logged before data mutation begins.
- Replace-import executes as a single transaction per import scope.
- Existing rows matching the composite keys in scope are deleted then reinserted atomically.
- Partial import completion is not permitted; rollback on error is mandatory.
- Import run status transitions must be persisted (`queued` -> `validating` -> `applied` or `failed`).
## Notification Dedupe Rules
- Every outbound notification computes a deterministic `dedupe_key`.
- Notification sends must check dedupe existence before send attempt.
- A duplicate `dedupe_key` is treated as idempotent success (no second send).
- Dedupe keys should include event type, recipient, and logical event reference.
## AI Summary Storage Rules
- Planned (Post-v1): AI-generated summaries may be persisted with source references and generation metadata.
- v1 rule: if AI summarization is used experimentally, store results as non-authoritative artifacts and never overwrite canonical numeric metrics.
## Deployment Rules And Invariants
- API is deployed only to `api.venterradev.com`.
- Frontend is deployed only to `app.venterradev.com`.
- Production deploy requires schema migration compatibility validation.
- Worker configuration must include session signing secret and email provider API secret.
- D1 schema version must match application migration baseline at runtime.
## Explicit Non-Goals For v1
- Cross-tenant isolation beyond single internal organization.
- Full event bus or streaming pipeline.
- Provider-agnostic auth federation.
- Automated BI warehouse replication.
