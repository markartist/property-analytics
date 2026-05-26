-- Live Captain runtime
-- Stores scheduled/manual support-agent runs, durable watch items, action state, and brief runs.

CREATE TABLE IF NOT EXISTS captain_agent_runs (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  agent_key TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'scheduled', 'brief')),
  run_status TEXT NOT NULL CHECK (run_status IN ('success', 'warning', 'failed', 'skipped')),
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  source_window_start TEXT,
  source_window_end TEXT,
  findings_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  exceptions_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captain_agent_runs_property
  ON captain_agent_runs(property_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_captain_agent_runs_agent
  ON captain_agent_runs(property_id, agent_key, started_at DESC);

CREATE TABLE IF NOT EXISTS captain_watch_items (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  watch_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'monitoring', 'escalated', 'resolved', 'superseded')),
  current_state TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  next_move TEXT,
  owner_role TEXT,
  due_date TEXT,
  source_agent_key TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (property_id, watch_key)
);

CREATE INDEX IF NOT EXISTS idx_captain_watch_items_property
  ON captain_watch_items(property_id, status, severity, updated_at DESC);

CREATE TABLE IF NOT EXISTS captain_actions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  action_key TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done', 'blocked', 'superseded')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  evidence_json TEXT NOT NULL,
  source_agent_key TEXT,
  created_from_run_id TEXT REFERENCES captain_agent_runs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (property_id, action_key)
);

CREATE INDEX IF NOT EXISTS idx_captain_actions_property
  ON captain_actions(property_id, status, priority, due_date);

CREATE TABLE IF NOT EXISTS captain_brief_runs (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  run_status TEXT NOT NULL CHECK (run_status IN ('draft', 'ready', 'sent', 'blocked')),
  brief_type TEXT NOT NULL CHECK (brief_type IN ('captain_brief', 'supervisor_read')),
  period_start TEXT,
  period_end TEXT,
  memory_entry_id TEXT REFERENCES governed_memory_entries(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  artifact_ref TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captain_brief_runs_property
  ON captain_brief_runs(property_id, created_at DESC);
