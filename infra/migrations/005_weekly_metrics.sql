-- Migration 005: weekly_metrics
-- Per 05_Data_Model.md: unified operational metrics for 7-day/30-day windows
-- Per ADR-0002: metric_date must be Friday (enforced at application layer)
-- Per ADR-0004: single table with window_days + type discriminators

CREATE TABLE IF NOT EXISTS weekly_metrics (
  id TEXT PRIMARY KEY,
  metric_date TEXT NOT NULL,
  window_days INTEGER NOT NULL CHECK(window_days IN (7, 30)),
  type TEXT NOT NULL CHECK(type IN ('community', 'portfolio')),
  community_id TEXT REFERENCES communities(id),
  occupancy_rate REAL,
  leased_rate REAL,
  traffic_count INTEGER,
  applications_count INTEGER,
  move_ins INTEGER,
  move_outs INTEGER,
  delinquency_rate REAL,
  notes_text TEXT,
  source_import_run_id TEXT REFERENCES import_runs(id),
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Composite uniqueness: (metric_date, window_days, type, community_id)
-- Per 05_Data_Model.md and ADR-0004
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_metrics_composite
  ON weekly_metrics(metric_date, window_days, type, community_id);

-- Enforce: portfolio rows must have NULL community_id,
--          community rows must have non-NULL community_id.
-- (Enforced at application layer; D1/SQLite CHECK constraints on NULLs are limited.)

CREATE INDEX IF NOT EXISTS idx_weekly_metrics_date ON weekly_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_weekly_metrics_community ON weekly_metrics(community_id);
