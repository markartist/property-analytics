-- Migration 0030: Marketing BI conversion advisory sources
-- Landing tables for Captain Brief marketing conversion diagnostics.

CREATE TABLE IF NOT EXISTS marketing_cancel_denial_by_source (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  region TEXT NOT NULL,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  cancel_denial_type TEXT,
  cancel_denial_reason TEXT,
  marketing_source TEXT NOT NULL,
  cancel_denial_count INTEGER,
  applications INTEGER,
  guest_cards INTEGER,
  source_file TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, region, property_name, cancel_denial_type, cancel_denial_reason, marketing_source, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_cancel_denial_property_date
  ON marketing_cancel_denial_by_source(property_id, report_date DESC);

CREATE TABLE IF NOT EXISTS marketing_traffic_conversions (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  region TEXT,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  assigned_pct_t7 REAL,
  assigned_pct_t30 REAL,
  guest_cards_t7 INTEGER,
  guest_cards_t7_py INTEGER,
  guest_cards_t7_yoy REAL,
  guest_cards_t30 INTEGER,
  guest_cards_t30_py INTEGER,
  guest_cards_t30_yoy REAL,
  guest_cards_t60 INTEGER,
  guest_cards_t60_py INTEGER,
  source_file TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, property_name, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_traffic_conversions_property_date
  ON marketing_traffic_conversions(property_id, report_date DESC);
