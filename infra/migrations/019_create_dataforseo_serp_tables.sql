-- Migration 019: DataForSEO SERP source route
-- Stores live SERP evidence and normalized property keyword rankings for Captains,
-- Spotlight, and search intelligence.

CREATE TABLE IF NOT EXISTS dataforseo_serp_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  run_at TEXT NOT NULL,
  property_id TEXT NOT NULL,
  community_id TEXT,
  ga4_property_id TEXT,
  property_name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_code INTEGER NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  device TEXT NOT NULL DEFAULT 'desktop',
  os TEXT NOT NULL DEFAULT 'windows',
  depth INTEGER NOT NULL,
  api_endpoint TEXT NOT NULL,
  status_code INTEGER,
  status_message TEXT,
  task_status_code INTEGER,
  task_status_message TEXT,
  cost REAL,
  check_url TEXT,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_date, property_id, keyword, location_code, device, os)
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_serp_runs_property_date
  ON dataforseo_serp_runs(property_id, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_dataforseo_serp_runs_keyword
  ON dataforseo_serp_runs(keyword, run_date DESC);

CREATE TABLE IF NOT EXISTS dataforseo_serp_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  run_date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  community_id TEXT,
  keyword TEXT NOT NULL,
  result_type TEXT NOT NULL,
  rank_group INTEGER,
  rank_absolute INTEGER,
  domain TEXT,
  title TEXT,
  url TEXT,
  description TEXT,
  is_target_domain INTEGER NOT NULL DEFAULT 0,
  is_target_url INTEGER NOT NULL DEFAULT 0,
  item_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(run_id) REFERENCES dataforseo_serp_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_serp_results_run
  ON dataforseo_serp_results(run_id, rank_absolute);

CREATE INDEX IF NOT EXISTS idx_dataforseo_serp_results_property_keyword
  ON dataforseo_serp_results(property_id, keyword, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_dataforseo_serp_results_domain
  ON dataforseo_serp_results(domain, run_date DESC);

CREATE TABLE IF NOT EXISTS dataforseo_property_keyword_rankings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  run_date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  community_id TEXT,
  ga4_property_id TEXT,
  property_name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_code INTEGER NOT NULL,
  device TEXT NOT NULL DEFAULT 'desktop',
  os TEXT NOT NULL DEFAULT 'windows',
  target_found INTEGER NOT NULL DEFAULT 0,
  best_rank_absolute INTEGER,
  best_rank_group INTEGER,
  best_result_type TEXT,
  target_url TEXT,
  organic_rank_absolute INTEGER,
  organic_rank_group INTEGER,
  local_pack_present INTEGER NOT NULL DEFAULT 0,
  target_in_local_pack INTEGER NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0,
  cost REAL,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_date, property_id, keyword, location_code, device, os),
  FOREIGN KEY(run_id) REFERENCES dataforseo_serp_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_property_keyword_rankings_property_date
  ON dataforseo_property_keyword_rankings(property_id, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_dataforseo_property_keyword_rankings_visibility
  ON dataforseo_property_keyword_rankings(target_found, best_rank_absolute);
