-- Migration 0036: Marketing BI native Conversion Dashboard export
-- Property-level conversion rows by initial contact type.

CREATE TABLE IF NOT EXISTS marketing_bi_conversion_dashboard_rows (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  init_contact_type TEXT,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  conversions INTEGER,
  conversion_compare INTEGER,
  conversion_delta REAL,
  atr_avg REAL,
  atr_delta REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, init_contact_type, property_name, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_conversion_dashboard_property_date
  ON marketing_bi_conversion_dashboard_rows(property_id, report_date DESC, init_contact_type);
