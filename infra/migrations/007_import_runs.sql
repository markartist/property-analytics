-- Migration 007: import_runs
-- Per 05_Data_Model.md: import execution tracking
-- Per 01_System_Contract.md: status transitions queued -> validating -> applied|failed

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('weekly_metrics', 'marketing_weekly')),
  mode TEXT NOT NULL CHECK(mode IN ('paste_tsv', 'csv_upload')),
  status TEXT NOT NULL CHECK(status IN ('queued', 'validating', 'applied', 'failed')),
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  request_idempotency_key TEXT,
  source_filename TEXT,
  source_r2_key TEXT,
  rows_received INTEGER NOT NULL DEFAULT 0,
  rows_applied INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_runs_status ON import_runs(status);
CREATE INDEX IF NOT EXISTS idx_import_runs_user ON import_runs(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_import_runs_idempotency ON import_runs(request_idempotency_key);
