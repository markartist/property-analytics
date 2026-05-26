-- Migration 020: DataForSEO enrichment tables beyond live SERP rank checks
-- Stores trial-proved demand, Labs, OnPage, Business Data, and AI visibility
-- signals for Captain's Log, Spotlight, and Search Intelligence.

CREATE TABLE IF NOT EXISTS dataforseo_keyword_metrics (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  property_id TEXT,
  keyword TEXT NOT NULL,
  location_code INTEGER,
  language_code TEXT DEFAULT 'en',
  search_volume INTEGER,
  competition TEXT,
  competition_index INTEGER,
  cpc REAL,
  low_top_of_page_bid REAL,
  high_top_of_page_bid REAL,
  monthly_searches_json TEXT,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_date, keyword, location_code, language_code)
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_keyword_metrics_keyword
  ON dataforseo_keyword_metrics(keyword, run_date DESC);

CREATE TABLE IF NOT EXISTS dataforseo_labs_ranked_keywords (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  target_path TEXT,
  keyword TEXT NOT NULL,
  result_type TEXT,
  rank_absolute INTEGER,
  rank_group INTEGER,
  url TEXT,
  search_volume INTEGER,
  cpc REAL,
  competition REAL,
  raw_item_json TEXT,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_date, property_id, keyword, url)
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_labs_ranked_keywords_property
  ON dataforseo_labs_ranked_keywords(property_id, run_date DESC, rank_absolute);

CREATE TABLE IF NOT EXISTS dataforseo_onpage_page_snapshots (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  meta_description TEXT,
  h1_json TEXT,
  title_length INTEGER,
  description_length INTEGER,
  word_count INTEGER,
  title_to_content_consistency REAL,
  description_to_content_consistency REAL,
  internal_links_count INTEGER,
  external_links_count INTEGER,
  images_count INTEGER,
  checks_json TEXT,
  page_timing_json TEXT,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_date, property_id, url)
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_onpage_page_snapshots_property
  ON dataforseo_onpage_page_snapshots(property_id, run_date DESC);

CREATE TABLE IF NOT EXISTS dataforseo_business_profiles (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  title TEXT,
  category TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  zip TEXT,
  domain TEXT,
  url TEXT,
  is_claimed INTEGER,
  total_photos INTEGER,
  rating REAL,
  votes_count INTEGER,
  rating_distribution_json TEXT,
  place_topics_json TEXT,
  people_also_search_json TEXT,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_date, property_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_business_profiles_property
  ON dataforseo_business_profiles(property_id, run_date DESC);

CREATE TABLE IF NOT EXISTS dataforseo_ai_visibility_probes (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  run_at TEXT NOT NULL,
  property_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  model_name TEXT,
  prompt TEXT NOT NULL,
  response_text TEXT,
  target_mentioned INTEGER NOT NULL DEFAULT 0,
  cited_domains_json TEXT,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_ai_visibility_probes_property
  ON dataforseo_ai_visibility_probes(property_id, run_date DESC);
