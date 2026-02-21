# 07 Security Model
Title: POP Brief Security Model
Version: 1.0.0
Status: MVP Security Baseline
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Security Steward: TBD
- Engineering Steward: TBD
- Operations Steward: TBD
## Threat Model Overview (MVP)
Key risks:
- Session theft through token exposure.
- XSS from HTML-like notes or untrusted text rendering.
- CSV injection risks on exported files.
- Data loss from bad imports or accidental destructive actions.
- Unauthorized deletes by non-admin users.
- Email abuse or notification floods.
## Mitigations
- Session handling:
  - httpOnly, secure, sameSite cookies.
  - Session token hashing in storage.
  - Explicit logout and revocation support.
- Web hardening:
  - Strict content security policy and secure response headers.
  - Server-side sanitization and output encoding for user-entered notes.
- CSV safety:
  - Prefix/escape formula-triggering cell values (`=`, `+`, `-`, `@`) in exports.
- Data integrity:
  - Friday week-ending validation enforced server-side.
  - Replace-import transactions with rollback on failure.
- Authorization:
  - Admin-only invite creation and delete operations.
  - Route-level and service-level role checks.
- Abuse control:
  - Rate limits for email sends and analysis-intensive endpoints.
  - Notification dedupe via unique `notification_events.dedupe_key`.
## Data Classification Notes
- System is internal and login-required; no public data exposure is expected.
- Do not store highly sensitive personal or financial identifiers unless explicitly approved in a future governance revision.
- PII in v1 should be limited to user identity fields required for access and notifications.
## Logging And Audit Expectations
v1 expected logs:
- Auth events: login success/failure, logout, invite redemption.
- Admin actions: invite creation, user role/state changes, delete actions.
- Import lifecycle: run start, validation failure, rows applied, completion status.
- Notification events: send attempts and dedupe suppressions.
v2 enhancements (Planned Post-v1):
- Expanded immutable audit log coverage.
- Centralized alerting and anomaly detection on security-relevant events.
