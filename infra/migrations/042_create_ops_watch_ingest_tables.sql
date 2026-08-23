-- Ops Watch mirror/push ingest tables.
-- Internal systems push sanitized facts outward; Cloudflare never reaches inward.

CREATE TABLE IF NOT EXISTS ops_watch_ingest_runs (
  run_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_label TEXT,
  generated_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,
  payload_sha256 TEXT,
  producer TEXT,
  schema_version TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  error_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ops_watch_ingest_runs_source_received
  ON ops_watch_ingest_runs(source_system, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_watch_ingest_runs_status
  ON ops_watch_ingest_runs(status, received_at DESC);

CREATE TABLE IF NOT EXISTS ops_watch_signals (
  signal_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  status TEXT,
  owner TEXT,
  source_updated_at TEXT,
  property_refs_json TEXT NOT NULL DEFAULT '[]',
  severity TEXT NOT NULL DEFAULT 'medium',
  signal_type TEXT NOT NULL DEFAULT 'general',
  summary TEXT,
  allowed_next_actions_json TEXT NOT NULL DEFAULT '[]',
  raw_record_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES ops_watch_ingest_runs(run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_watch_signals_source_identity
  ON ops_watch_signals(source_system, source_id, signal_type);

CREATE INDEX IF NOT EXISTS idx_ops_watch_signals_run
  ON ops_watch_signals(run_id);

CREATE INDEX IF NOT EXISTS idx_ops_watch_signals_source_status
  ON ops_watch_signals(source_system, status, severity);

CREATE INDEX IF NOT EXISTS idx_ops_watch_signals_source_updated
  ON ops_watch_signals(source_updated_at DESC);

CREATE TABLE IF NOT EXISTS ops_watch_action_queue (
  action_id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  requested_action TEXT NOT NULL,
  action_payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'review_required',
  requested_by TEXT NOT NULL DEFAULT 'ops-watch-ingest',
  requested_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  executed_at TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES ops_watch_signals(signal_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_watch_action_queue_status
  ON ops_watch_action_queue(status, requested_at DESC);
