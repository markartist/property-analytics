CREATE TABLE IF NOT EXISTS pib_report_generation_jobs (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES pib_report_configs(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES pib_report_runs(id) ON DELETE SET NULL,
  requested_action TEXT NOT NULL CHECK (requested_action IN ('open', 'email_now', 'save', 'scheduled_email')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')) DEFAULT 'queued',
  scope TEXT NOT NULL CHECK (scope IN ('portfolio', 'property')),
  community_id TEXT,
  community_name TEXT,
  date_range TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  preset_label TEXT NOT NULL,
  section_ids_json TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  artifact_key TEXT,
  artifact_filename TEXT,
  error_text TEXT,
  created_by TEXT,
  claimed_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pib_report_generation_jobs_status
  ON pib_report_generation_jobs(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_pib_report_generation_jobs_config
  ON pib_report_generation_jobs(config_id, updated_at DESC);
