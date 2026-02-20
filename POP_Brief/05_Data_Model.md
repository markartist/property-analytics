# 05 Data Model
Title: POP Brief Data Model
Version: 1.0.0
Status: Canonical for v1 Schema
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Data Steward: TBD
- Engineering Steward: TBD
## Modeling Principles
- All timestamps stored in UTC ISO format.
- Soft-delete preferred for business entities; hard-delete reserved for controlled admin actions.
- Audit fields are required on operationally significant records.
## Audit Field Standard
Standard fields to include where applicable:
- `created_at` (required)
- `created_by` (nullable for system actions)
- `updated_at` (required)
- `updated_by` (nullable for system actions)
- `deleted_at` (nullable; soft-delete marker)
- `deleted_by` (nullable; actor that performed soft-delete)
## Entities
### users
Purpose: system identities.
Fields (SQL-like):
- `id TEXT PRIMARY KEY`
- `email TEXT NOT NULL UNIQUE`
- `full_name TEXT`
- `role TEXT NOT NULL CHECK(role IN ('admin','user'))`
- `is_active INTEGER NOT NULL DEFAULT 1`
- `last_login_at TEXT`
- audit fields
Notes:
- Email uniqueness should use normalized lowercase form.
### sessions
Purpose: login session records.
Fields:
- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL REFERENCES users(id)`
- `session_token_hash TEXT NOT NULL UNIQUE`
- `expires_at TEXT NOT NULL`
- `revoked_at TEXT`
- audit fields
### invites
Purpose: admin-created invite tokens.
Fields:
- `id TEXT PRIMARY KEY`
- `email TEXT NOT NULL`
- `role TEXT NOT NULL CHECK(role IN ('admin','user'))`
- `token_hash TEXT NOT NULL UNIQUE`
- `expires_at TEXT NOT NULL`
- `redeemed_at TEXT`
- `redeemed_user_id TEXT REFERENCES users(id)`
- audit fields
### communities
Purpose: managed property/community dimension.
Fields:
- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `external_key TEXT UNIQUE`
- `region TEXT`
- `status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive'))`
- audit fields
### weekly_metrics
Purpose: unified operational metrics for 7-day/30-day windows at community or portfolio level.
Fields:
- `id TEXT PRIMARY KEY`
- `metric_date TEXT NOT NULL` (must be Friday)
- `window_days INTEGER NOT NULL CHECK(window_days IN (7,30))`
- `type TEXT NOT NULL CHECK(type IN ('community','portfolio'))`
- `community_id TEXT REFERENCES communities(id)` (required when `type='community'`, null when `type='portfolio'`)
- `occupancy_rate REAL`
- `leased_rate REAL`
- `traffic_count INTEGER`
- `applications_count INTEGER`
- `move_ins INTEGER`
- `move_outs INTEGER`
- `delinquency_rate REAL`
- `notes_text TEXT`
- `source_import_run_id TEXT REFERENCES import_runs(id)`
- audit fields
Composite uniqueness:
- Unique (`metric_date`, `window_days`, `type`, `community_id`)
Constraint note:
- Enforce portfolio rows with null `community_id` and community rows with non-null `community_id`.
### marketing_weekly
Purpose: weekly marketing and mention-oriented context.
Fields:
- `id TEXT PRIMARY KEY`
- `week_ending TEXT NOT NULL` (must be Friday)
- `community_id TEXT NOT NULL REFERENCES communities(id)`
- `leads_count INTEGER`
- `cost_per_lead REAL`
- `ad_spend REAL`
- `mentions_json TEXT` (structured mention references)
- `notes_text TEXT`
- `source_import_run_id TEXT REFERENCES import_runs(id)`
- audit fields
Composite uniqueness:
- Unique (`week_ending`, `community_id`)
### import_runs
Purpose: import execution tracking.
Fields:
- `id TEXT PRIMARY KEY`
- `entity_type TEXT NOT NULL CHECK(entity_type IN ('weekly_metrics','marketing_weekly'))`
- `mode TEXT NOT NULL CHECK(mode IN ('paste_tsv','csv_upload'))`
- `status TEXT NOT NULL CHECK(status IN ('queued','validating','applied','failed'))`
- `requested_by_user_id TEXT NOT NULL REFERENCES users(id)`
- `request_idempotency_key TEXT`
- `source_filename TEXT`
- `source_r2_key TEXT`
- `rows_received INTEGER NOT NULL DEFAULT 0`
- `rows_applied INTEGER NOT NULL DEFAULT 0`
- `error_summary TEXT`
- `started_at TEXT`
- `finished_at TEXT`
- audit fields
### notification_events
Purpose: dedupe and delivery tracking for outbound notifications.
Fields:
- `id TEXT PRIMARY KEY`
- `event_type TEXT NOT NULL` (for example `invite_sent`, `mention_alert`)
- `recipient_email TEXT NOT NULL`
- `dedupe_key TEXT NOT NULL UNIQUE`
- `status TEXT NOT NULL CHECK(status IN ('suppressed_duplicate','sent','failed'))`
- `provider_message_id TEXT`
- `attempted_at TEXT NOT NULL`
- `error_text TEXT`
- audit fields
### audit_log (optional v1, recommended)
Purpose: immutable event trail for security and recovery.
Fields:
- `id TEXT PRIMARY KEY`
- `actor_user_id TEXT REFERENCES users(id)`
- `action TEXT NOT NULL`
- `entity_type TEXT NOT NULL`
- `entity_id TEXT NOT NULL`
- `before_json TEXT`
- `after_json TEXT`
- `request_id TEXT`
- `ip_hash TEXT`
- `created_at TEXT NOT NULL`
## Soft-Delete Strategy
- `communities` and `users` use soft-delete or deactivation semantics by default.
- Soft-deleted records remain queryable for audit but excluded from default active views.
- Admin-only hard-delete may exist for constrained cleanup workflows and must be logged.
