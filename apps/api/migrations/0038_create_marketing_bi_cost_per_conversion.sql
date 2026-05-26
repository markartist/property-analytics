-- Migration 0038: Marketing BI cost-per-conversion native exports
-- Robust landing table for Power BI exports that may contain NaN/Infinity values.

CREATE TABLE IF NOT EXISTS marketing_bi_cost_per_conversion_rows (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  calendar_month TEXT,
  region TEXT,
  property_name TEXT,
  property_id TEXT,
  community_id TEXT,
  marketing_source_group TEXT,
  marketing_source_desc TEXT,
  cost_per_guest_card REAL,
  cost_per_visit REAL,
  cost_per_application REAL,
  cost_per_lease REAL,
  invalid_value_count INTEGER DEFAULT 0,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_cost_per_conversion_property_date
  ON marketing_bi_cost_per_conversion_rows(property_id, report_date DESC, calendar_month DESC);
