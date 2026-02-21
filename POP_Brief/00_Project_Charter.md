# 00 Project Charter
Title: POP Brief Project Charter
Version: 1.0.0
Status: Approved for v1 Delivery
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Executive Sponsor: TBD
- Product Steward: TBD
- Engineering Steward: TBD
- Operations Steward: TBD
## Executive Summary
POP Brief provides a controlled internal system for weekly property operations performance briefing. It consolidates standardized metrics, marketing signals, and operational context into a reproducible reporting workflow for leadership review. The v1 objective is dependable ingestion, validation, storage, and retrieval of weekly and rolling-window performance data with strict governance controls.
## Objectives
- Deliver a login-required internal application for approximately 10 users.
- Enforce week-ending Friday reporting as a hard validation rule.
- Support both community-level and portfolio-level records for 7-day and 30-day windows.
- Implement admin-only user onboarding via invite and admin-only delete capabilities.
- Provide reliable import, export, and audit-friendly operational workflows.
## In Scope v1
- Auth/session flows with invite redemption.
- Community management with soft-delete semantics.
- Weekly metrics import and retrieval for windowed records.
- Marketing weekly data patching and mention scan workflow.
- Notification dedupe tracking.
- CSV exports and manual backup endpoints.
- Cloudflare deployment (Pages, Workers, D1, R2) with Resend email integration.
## Out Of Scope v1
- Enterprise SSO.
- Microsoft Teams direct posting.
- Advanced BI ingestion pipelines.
- Autonomous insight generation beyond defined analysis outputs.
- Full workflow automation for backups and external archival.
## System Identity
What POP Brief is:
- An internal performance briefing system for standardized operational reporting.
- A governed system of record for weekly and rolling-window POP metrics.
What POP Brief is not:
- A public analytics portal.
- A full enterprise data warehouse.
- A broad communication suite or campaign execution platform.
## Success Criteria
- 100% of accepted weekly records pass week-ending Friday validation.
- No non-admin user can create invites or execute delete operations.
- Import runs produce deterministic replace-import results with run logs.
- Leadership can retrieve portfolio and community reporting without manual reconciliation.
- Operational recovery from bad import is executable through documented runbook steps.
## Governance
- Charter changes require product and engineering steward approval.
- System contract violations are treated as release blockers.
- Data model and API changes require synchronized update to canonical documents.
- Release notes must be recorded in `CHANGELOG.md` for every versioned update.
## Architecture Commitment
v1 is committed to:
- Cloudflare Pages for frontend hosting.
- Cloudflare Workers for API and business logic.
- Cloudflare D1 as primary relational store.
- Cloudflare R2 for import artifacts and backup exports.
- Resend HTTPS API for MVP transactional email.
## Roadmap Outlook
v1 focuses on dependable core operations. Post-v1 expansion targets include BI ingestion, insights engine enhancements, Teams integration, and enterprise SSO based on adoption and governance readiness.
