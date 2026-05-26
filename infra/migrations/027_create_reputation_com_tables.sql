-- Migration 027: Reputation.com vendor exports
-- Portfolio reputation score, review mix, score-component, trend, and local competition evidence.

CREATE TABLE IF NOT EXISTS reputation_com_location_leaderboard (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  location TEXT NOT NULL,
  normalized_location TEXT,
  property_id TEXT,
  community_id TEXT,
  current_total_reviews INTEGER,
  current_positive_reviews_pct REAL,
  current_neutral_reviews_pct REAL,
  current_negative_reviews_pct REAL,
  average_rating REAL,
  response_rate REAL,
  reputation_score REAL,
  current_period TEXT,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, location, source_file)
);

CREATE INDEX IF NOT EXISTS idx_reputation_com_location_property_date
  ON reputation_com_location_leaderboard(property_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_reputation_com_location_score
  ON reputation_com_location_leaderboard(report_date DESC, reputation_score DESC);

CREATE TABLE IF NOT EXISTS reputation_com_score_components (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  location TEXT NOT NULL,
  normalized_location TEXT,
  entity_type TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  reputation_score REAL,
  review_sentiment REAL,
  review_volume REAL,
  review_recency REAL,
  review_quality REAL,
  review_spread REAL,
  review_response REAL,
  search_impressions REAL,
  listing_completeness REAL,
  social_score REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, location, source_file)
);

CREATE INDEX IF NOT EXISTS idx_reputation_com_components_property_date
  ON reputation_com_score_components(property_id, report_date DESC);

CREATE TABLE IF NOT EXISTS reputation_com_score_time_series (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  location TEXT NOT NULL,
  normalized_location TEXT,
  property_id TEXT,
  community_id TEXT,
  score_month TEXT NOT NULL,
  reputation_score REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location, score_month, source_file)
);

CREATE INDEX IF NOT EXISTS idx_reputation_com_time_series_property_month
  ON reputation_com_score_time_series(property_id, score_month DESC);

CREATE TABLE IF NOT EXISTS reputation_com_local_competition (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  location TEXT NOT NULL,
  normalized_location TEXT,
  property_id TEXT,
  community_id TEXT,
  subject_total_reviews INTEGER,
  subject_positive_reviews INTEGER,
  subject_neutral_reviews INTEGER,
  subject_negative_reviews INTEGER,
  subject_average_rating REAL,
  subject_reputation_score REAL,
  competitor_rank INTEGER NOT NULL,
  competitor_location TEXT,
  competitor_total_reviews INTEGER,
  competitor_positive_reviews INTEGER,
  competitor_neutral_reviews INTEGER,
  competitor_negative_reviews INTEGER,
  competitor_average_rating REAL,
  competitor_reputation_score REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, location, competitor_rank, source_file)
);

CREATE INDEX IF NOT EXISTS idx_reputation_com_competition_property_date
  ON reputation_com_local_competition(property_id, report_date DESC);
