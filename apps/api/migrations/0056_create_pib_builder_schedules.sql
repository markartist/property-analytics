-- Governed PIB Builder control-plane tables.
-- Stores named PIB request contracts, editable email schedules, and run history.
-- This does not create a parallel PIB renderer, template, or sender.

CREATE TABLE IF NOT EXISTS pib_report_configs (
  id TEXT PRIMARY KEY,
  report_name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('portfolio', 'property')),
  community_id TEXT,
  community_name TEXT,
  date_range TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  preset_label TEXT NOT NULL,
  section_ids_json TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pib_report_configs_status
  ON pib_report_configs(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pib_report_configs_scope
  ON pib_report_configs(scope, community_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS pib_report_schedules (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES pib_report_configs(id) ON DELETE CASCADE,
  cadence TEXT NOT NULL CHECK (cadence IN ('one_time', 'weekly', 'monthly', 'quarterly')),
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month TEXT,
  send_time TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
  next_run_at TEXT,
  last_run_at TEXT,
  last_run_status TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pib_report_schedules_due
  ON pib_report_schedules(status, next_run_at);

CREATE INDEX IF NOT EXISTS idx_pib_report_schedules_config
  ON pib_report_schedules(config_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS pib_report_runs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT REFERENCES pib_report_schedules(id) ON DELETE SET NULL,
  config_id TEXT NOT NULL REFERENCES pib_report_configs(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'scheduled')),
  run_status TEXT NOT NULL CHECK (run_status IN ('queued', 'blocked', 'sent', 'failed', 'skipped')),
  scheduled_for TEXT,
  started_at TEXT,
  finished_at TEXT,
  canonical_path TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  delivery_error TEXT,
  snapshot_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(schedule_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_pib_report_runs_schedule
  ON pib_report_runs(schedule_id, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_pib_report_runs_config
  ON pib_report_runs(config_id, created_at DESC);
