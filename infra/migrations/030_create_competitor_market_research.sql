-- Migration 030: Competitor market research evidence ledger
-- Stores sourced competitor rent, concession, USP, media, package, and market-position
-- observations for Captain/POP Brief competitive slices.

CREATE TABLE IF NOT EXISTS competitor_market_research_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  property_id TEXT NOT NULL,
  community_id TEXT,
  property_name TEXT NOT NULL,
  market_name TEXT,
  research_scope TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_author TEXT,
  notes TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(snapshot_date, property_id, source_file)
);

CREATE INDEX IF NOT EXISTS idx_competitor_market_snapshots_property_date
  ON competitor_market_research_snapshots(property_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS competitor_market_research_observations (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  property_id TEXT NOT NULL,
  community_id TEXT,
  subject_property_name TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  competitor_url TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  evidence_category TEXT NOT NULL,
  captured_date TEXT NOT NULL,
  floorplan_name TEXT,
  bedroom_count REAL,
  bathroom_count REAL,
  sqft_min INTEGER,
  sqft_max INTEGER,
  rent_min REAL,
  rent_max REAL,
  availability_status TEXT,
  special_text TEXT,
  rating REAL,
  review_count INTEGER,
  package_indicator TEXT,
  media_indicators_json TEXT,
  usp_text TEXT,
  raw_claim TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_freshness_label TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(snapshot_id) REFERENCES competitor_market_research_snapshots(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, competitor_name, source_url, evidence_category, raw_claim)
);

CREATE INDEX IF NOT EXISTS idx_competitor_market_observations_property_date
  ON competitor_market_research_observations(property_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_market_observations_competitor
  ON competitor_market_research_observations(competitor_name, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_market_observations_category
  ON competitor_market_research_observations(property_id, evidence_category, snapshot_date DESC);
