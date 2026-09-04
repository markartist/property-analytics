-- Captain routine due queue.
-- Makes support-agent execution cadence explicit, inspectable, and bounded.

CREATE TABLE IF NOT EXISTS captain_routine_schedule (
  schedule_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  agent_key TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'retired', 'leased')),
  priority INTEGER NOT NULL DEFAULT 50,
  next_run_at TEXT,
  last_started_at TEXT,
  last_finished_at TEXT,
  last_success_at TEXT,
  last_status TEXT CHECK (last_status IS NULL OR last_status IN ('success', 'warning', 'failed', 'skipped')),
  last_run_id TEXT,
  source_fingerprint TEXT,
  lease_id TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (property_id, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_captain_routine_schedule_due
  ON captain_routine_schedule(status, next_run_at, priority DESC);

CREATE INDEX IF NOT EXISTS idx_captain_routine_schedule_property
  ON captain_routine_schedule(property_id, status, cadence, next_run_at);

CREATE INDEX IF NOT EXISTS idx_captain_routine_schedule_agent
  ON captain_routine_schedule(agent_key, status, next_run_at);
