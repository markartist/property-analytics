-- Migration 0042: Spotlight weekly field notes
-- Additive human-sourced Spotlight evidence for Captain/POP recovery reads.

CREATE TABLE IF NOT EXISTS spotlight_weekly_field_snapshots (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  week_ending TEXT,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  region TEXT,
  occupancy REAL,
  trend_30 REAL,
  trend_60 REAL,
  adjusted_trend_60 REAL,
  tours INTEGER,
  new_leads INTEGER,
  applications_received INTEGER,
  pending_applications INTEGER,
  approved_applications INTEGER,
  cancellations_denials INTEGER,
  renewals_completed INTEGER,
  notices INTEGER,
  social_posts INTEGER,
  recovery_goal TEXT,
  narrative_summary TEXT,
  narrative_text TEXT,
  source_files_json TEXT,
  metrics_json TEXT,
  quality_flags_json TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, property_id)
);

CREATE INDEX IF NOT EXISTS idx_spotlight_weekly_snapshots_property_date
  ON spotlight_weekly_field_snapshots(property_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_spotlight_weekly_snapshots_region_date
  ON spotlight_weekly_field_snapshots(region, report_date DESC);

CREATE TABLE IF NOT EXISTS spotlight_weekly_action_items (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  region TEXT,
  action_item TEXT NOT NULL,
  action_area TEXT,
  assigned_to TEXT,
  deadline TEXT,
  completed_status TEXT,
  notes TEXT,
  action_category TEXT,
  is_open INTEGER NOT NULL DEFAULT 1,
  quality_flags_json TEXT,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(snapshot_id) REFERENCES spotlight_weekly_field_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_spotlight_weekly_actions_snapshot
  ON spotlight_weekly_action_items(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_spotlight_weekly_actions_property_date
  ON spotlight_weekly_action_items(property_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_spotlight_weekly_actions_open
  ON spotlight_weekly_action_items(is_open, property_id);
