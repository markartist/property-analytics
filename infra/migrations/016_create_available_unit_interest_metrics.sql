-- Migration 016: Available unit interest metrics
-- Advisory BI source for demand intensity against available inventory.

CREATE TABLE IF NOT EXISTS available_unit_interest_metrics (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  location TEXT NOT NULL,
  current_level TEXT NOT NULL,
  bedrooms TEXT,
  property_id TEXT,
  community_id TEXT,
  unit_count INTEGER,
  available_units INTEGER,
  pct_available_units_by_bedroom REAL,
  vacant_available_units INTEGER,
  notice_available_units INTEGER,
  pct_available REAL,
  t7_guest_cards_vol INTEGER,
  t7_guest_cards_per_available_unit REAL,
  t7_guest_cards_delta_pct REAL,
  pct_t7_guest_cards_by_bedrooms REAL,
  t30_guest_cards_vol INTEGER,
  t30_guest_cards_per_available_unit REAL,
  t30_guest_cards_delta_pct REAL,
  pct_t30_guest_cards_by_bedrooms REAL,
  t7_prospect_quote_vol INTEGER,
  t7_quote_delta_pct REAL,
  t30_prospect_quote_vol INTEGER,
  t30_quote_delta_pct REAL,
  source_file TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, location, current_level, source_file)
);

CREATE INDEX IF NOT EXISTS idx_available_unit_interest_property_date
  ON available_unit_interest_metrics(property_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_available_unit_interest_location_date
  ON available_unit_interest_metrics(location, report_date DESC);
