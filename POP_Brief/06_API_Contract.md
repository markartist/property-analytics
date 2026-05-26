# 06 API Contract
Title: POP Brief API Contract
Version: 1.0.0
Status: Canonical for v1 Endpoints
Last Updated: Feb 20, 2026
Owner / Stewardship:
- API Steward: TBD
- Backend Owner: TBD
## Conventions
- Base URL: `https://api.venterradev.com`
- Content type: `application/json` unless file upload endpoint.
- Auth: session cookie (httpOnly, secure) required for protected routes.
- Dates: ISO date (`YYYY-MM-DD`) for week-ending fields; must be Friday where required.
- Errors:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "week_ending must be a Friday",
    "details": []
  }
}
```
## Idempotency Guidance
- Import endpoints accept optional `Idempotency-Key` header.
- Duplicate import request with same key and equivalent payload should return prior successful result or deterministic duplicate response.
- Notification event creation must use unique `dedupe_key`; duplicate dedupe key returns idempotent success with `suppressed_duplicate` status.
## Auth
### Login
- Purpose: establish authenticated session.
- Method + path: `POST /v1/auth/login`
- Auth: public.
- Request:
```json
{ "email": "user@company.com", "password": "example" }
```
- Response:
```json
{ "user": { "id": "u_123", "email": "user@company.com", "role": "user" } }
```
- Errors: `401 INVALID_CREDENTIALS`, `403 USER_INACTIVE`.
### Logout
- Purpose: revoke current session.
- Method + path: `POST /v1/auth/logout`
- Auth: required.
- Response:
```json
{ "ok": true }
```
### Me
- Purpose: return current user context.
- Method + path: `GET /v1/auth/me`
- Auth: required.
- Response:
```json
{ "user": { "id": "u_123", "email": "user@company.com", "role": "admin" } }
```
### Redeem Invite
- Purpose: create or activate account from invite token.
- Method + path: `POST /v1/auth/redeem-invite`
- Auth: public.
- Request:
```json
{ "token": "invite_token", "full_name": "User Name", "password": "example" }
```
- Response:
```json
{ "user": { "id": "u_999", "email": "new@company.com", "role": "user" } }
```
- Errors: `400 INVITE_INVALID`, `400 INVITE_EXPIRED`, `409 INVITE_ALREADY_REDEEMED`.
## Admin
### Create Invite
- Purpose: admin creates invite.
- Method + path: `POST /v1/admin/invites`
- Auth: admin.
- Request:
```json
{ "email": "new@company.com", "role": "user", "expires_in_days": 7 }
```
- Response:
```json
{ "invite_id": "inv_1", "email": "new@company.com", "expires_at": "2026-02-27T00:00:00Z" }
```
- Errors: `403 FORBIDDEN`, `409 INVITE_EXISTS`.
### List Users
- Purpose: admin list users.
- Method + path: `GET /v1/admin/users`
- Auth: admin.
- Response:
```json
{ "items": [{ "id": "u_1", "email": "a@company.com", "role": "admin", "is_active": true }] }
```
### Patch User
- Purpose: admin updates role or active state.
- Method + path: `PATCH /v1/admin/users/:id`
- Auth: admin.
- Request:
```json
{ "role": "user", "is_active": true }
```
- Response:
```json
{ "id": "u_1", "role": "user", "is_active": true }
```
- Errors: `400 VALIDATION_ERROR`, `404 USER_NOT_FOUND`.
## Communities
### List Communities
- Purpose: list active communities.
- Method + path: `GET /v1/communities`
- Auth: required.
- Response:
```json
{ "items": [{ "id": "c_1", "name": "Community A", "status": "active" }] }
```
### Create Community
- Purpose: create community.
- Method + path: `POST /v1/communities`
- Auth: required.
- Request:
```json
{ "name": "Community A", "external_key": "COMM_A", "region": "DFW" }
```
- Response:
```json
{ "id": "c_1", "name": "Community A", "external_key": "COMM_A", "region": "DFW" }
```
- Errors: `409 EXTERNAL_KEY_CONFLICT`.
### Update Community
- Purpose: patch editable fields.
- Method + path: `PATCH /v1/communities/:id`
- Auth: required.
- Request:
```json
{ "name": "Community Alpha", "region": "ATL" }
```
- Response:
```json
{ "id": "c_1", "name": "Community Alpha", "region": "ATL" }
```
### Soft-Delete Community
- Purpose: mark community deleted/inactive.
- Method + path: `DELETE /v1/communities/:id`
- Auth: admin.
- Response:
```json
{ "ok": true, "deleted_at": "2026-02-20T12:00:00Z" }
```
- Errors: `403 FORBIDDEN`, `404 COMMUNITY_NOT_FOUND`.
## Metrics
### Get Metrics
- Purpose: query weekly metrics.
- Method + path: `GET /v1/metrics?metric_date=2026-02-20&window_days=7&type=portfolio`
- Auth: required.
- Response:
```json
{ "items": [{ "metric_date": "2026-02-20", "window_days": 7, "type": "portfolio", "occupancy_rate": 0.95 }] }
```
### Import Metrics (Paste TSV)
- Purpose: replace-import metrics via pasted data.
- Method + path: `POST /v1/metrics/import/paste`
- Auth: admin.
- Request:
```json
{ "tsv": "metric_date\twindow_days\ttype\tcommunity_external_key\toccupancy_rate\n2026-02-20\t7\tcommunity\tCOMM_A\t95%" }
```
- Response:
```json
{ "import_run_id": "imp_1", "status": "applied", "rows_applied": 1 }
```
- Errors: `400 VALIDATION_ERROR`, `409 IMPORT_CONFLICT`.
### Import Metrics (Upload CSV)
- Purpose: upload file and import.
- Method + path: `POST /v1/metrics/import/upload`
- Auth: admin.
- Request: multipart with `file`.
- Response:
```json
{ "import_run_id": "imp_2", "status": "validating" }
```
### Import File Status
- Purpose: check import run state.
- Method + path: `GET /v1/metrics/import-file/:import_run_id`
- Auth: admin.
- Response:
```json
{ "id": "imp_2", "status": "applied", "rows_received": 100, "rows_applied": 100 }
```
### Delete Metrics (Admin)
- Purpose: admin delete metric scope.
- Method + path: `DELETE /v1/metrics`
- Auth: admin.
- Request:
```json
{ "metric_date": "2026-02-20", "window_days": 7, "type": "portfolio" }
```
- Response:
```json
{ "ok": true, "deleted_count": 1 }
```
## Marketing
### Get Marketing Weekly
- Purpose: retrieve marketing weekly records.
- Method + path: `GET /v1/marketing?week_ending=2026-02-20`
- Auth: required.
- Response:
```json
{ "items": [{ "week_ending": "2026-02-20", "community_id": "c_1", "leads_count": 23 }] }
```
### Patch Marketing Weekly
- Purpose: update marketing values.
- Method + path: `PATCH /v1/marketing/:id`
- Auth: required.
- Request:
```json
{ "leads_count": 25, "notes_text": "Adjusted after source correction" }
```
- Response:
```json
{ "id": "m_1", "leads_count": 25 }
```

## Grounding Core

The grounding core is the contract for turning source material into publishable property intelligence.

Canonical reference:

- `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md`

Planned route family:

- `POST /v1/property-brief/source-documents`
- `POST /v1/property-brief/claims`
- `POST /v1/property-brief/reconciliations`
- `GET /v1/property-brief/properties/:property_id/grounding`
- `POST /v1/property-brief/artifact-blocks`

Publishing rules:

- Data Pond remains authoritative for internal operational facts.
- Vendor report claims about occupancy, leased rate, guest cards, applications, tours, availability, or floorplan inventory must be reconciled before artifact generation.
- Conflicting claims should be retained with source lineage and explicit `truth_status`; they should not be silently blended into final brief copy.
- Captain's Log entries should record approved decisions and durable property memory, linked back to source claims or artifact blocks.
### Scan Mentions
- Purpose: detect mention events and send deduped notifications.
- Method + path: `POST /v1/marketing/scan-mentions`
- Auth: required.
- Request:
```json
{ "week_ending": "2026-02-20" }
```
- Response:
```json
{ "processed": 15, "sent": 3, "suppressed_duplicate": 2 }
```
## Analysis
### Get Analysis
- Purpose: return synthesized analysis payload for briefing UI.
- Method + path: `GET /v1/analysis?week_ending=2026-02-20`
- Auth: required.
- Response:
```json
{
  "week_ending": "2026-02-20",
  "portfolio": { "window_7": { "occupancy_rate": 0.95 }, "window_30": { "occupancy_rate": 0.94 } },
  "communities": []
}
```
## Exports
### Export CSV
- Purpose: export filtered records as CSV.
- Method + path: `GET /v1/exports/csv?entity=weekly_metrics&week_ending=2026-02-20`
- Auth: required.
- Response: `text/csv` file stream.
### Backup Export
- Purpose: create backup artifact in R2 and return key.
- Method + path: `POST /v1/exports/backup`
- Auth: admin.
- Request:
```json
{ "entities": ["weekly_metrics", "marketing_weekly"] }
```
- Response:
```json
{ "backup_key": "backups/2026-02-20/pop-brief-backup.csv", "row_count": 1200 }
```
