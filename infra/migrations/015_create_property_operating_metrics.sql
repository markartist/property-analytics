-- Migration 015: Property operating source-of-record metrics
-- Landing table for official operating facts needed by Captain Brief and POP Brief.
-- This table is intentionally source-oriented, not Captain-owned.

CREATE TABLE IF NOT EXISTS property_operating_metrics (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  metric_date TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  occupancy_rate REAL,
  leased_rate REAL,
  occupied_units INTEGER,
  leased_units INTEGER,
  available_units INTEGER,
  total_units INTEGER,
  leases_count INTEGER,
  cancellations_count INTEGER,
  denials_count INTEGER,
  move_ins_count INTEGER,
  move_outs_count INTEGER,
  booked_concession_dollars REAL,
  booked_concession_lease_count INTEGER,
  source_system TEXT NOT NULL,
  source_file TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(property_id, metric_date, source_system)
);

CREATE INDEX IF NOT EXISTS idx_property_operating_metrics_property_date
  ON property_operating_metrics(property_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_property_operating_metrics_community_date
  ON property_operating_metrics(community_id, metric_date DESC);
