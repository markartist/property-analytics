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

### property_brief_source_documents
Purpose: captured source material for the POP Brief grounding core.
Fields:
- `id TEXT PRIMARY KEY`
- `property_id TEXT NOT NULL`
- `community_id TEXT`
- `source_system TEXT NOT NULL`
- `source_document_type TEXT NOT NULL`
- `source_filename TEXT`
- `source_uri TEXT`
- `source_date TEXT`
- `data_through_date TEXT`
- `cadence TEXT`
- `raw_text_hash TEXT`
- `storage_ref TEXT`
- `metadata_json TEXT`
- `imported_at TEXT NOT NULL`
- `imported_by TEXT`
Notes:
- This table stores source lineage, not final truth.
- Recurring AptIQ documents, Data Pond extracts, live property-page snapshots, Captain's Log references, and operator notes can all enter here.

### property_brief_claims
Purpose: normalized, reconcilable property claims extracted from source documents or authoritative fact extracts.
Fields:
- `id TEXT PRIMARY KEY`
- `property_id TEXT NOT NULL`
- `community_id TEXT`
- `source_document_id TEXT REFERENCES property_brief_source_documents(id)`
- `claim_type TEXT NOT NULL`
- `subject TEXT NOT NULL`
- `statement TEXT NOT NULL`
- `metric_code TEXT`
- `metric_window TEXT`
- `source_value TEXT`
- `normalized_value REAL`
- `unit TEXT`
- `authority TEXT NOT NULL`
- `truth_status TEXT NOT NULL`
- `confidence REAL NOT NULL`
- `priority TEXT NOT NULL DEFAULT 'medium'`
- `evidence_json TEXT`
- `recommended_action TEXT`
- `owner_role TEXT`
- `due_date TEXT`
- `status TEXT NOT NULL DEFAULT 'active'`
- audit fields
Notes:
- `truth_status` is the key publishing gate. Data Pond fact conflicts should be preserved, not hidden.
- External report claims about internal operational facts should not become brief-ready until reconciled.

### property_brief_reconciliations
Purpose: source-to-truth comparison records for claims.
Fields:
- `id TEXT PRIMARY KEY`
- `claim_id TEXT NOT NULL REFERENCES property_brief_claims(id)`
- `truth_source TEXT NOT NULL`
- `truth_ref TEXT NOT NULL`
- `truth_value TEXT`
- `reconciliation_status TEXT NOT NULL`
- `note TEXT`
- `reconciled_at TEXT NOT NULL`
- `reconciled_by TEXT`
Notes:
- Use this table to explain why a claim was verified, overridden, accepted as advisory, or blocked.

### property_brief_artifact_blocks
Purpose: reusable brief-ready sections composed from reconciled claims.
Fields:
- `id TEXT PRIMARY KEY`
- `property_id TEXT NOT NULL`
- `community_id TEXT`
- `week_ending TEXT`
- `block_type TEXT NOT NULL`
- `title TEXT NOT NULL`
- `body_json TEXT NOT NULL`
- `source_claim_ids_json TEXT NOT NULL`
- `readiness_status TEXT NOT NULL`
- audit fields
Notes:
- Final artifacts should render from blocks rather than rereading raw vendor prose.
Canonical reference:
- `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md`
## Soft-Delete Strategy
- `communities` and `users` use soft-delete or deactivation semantics by default.
- Soft-deleted records remain queryable for audit but excluded from default active views.
- Admin-only hard-delete may exist for constrained cleanup workflows and must be logged.
