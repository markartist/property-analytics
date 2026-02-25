-- 0017: Track actual data collection freshness from canonical DB
-- Shows real source freshness rather than D1 weekly snapshot dates

CREATE TABLE IF NOT EXISTS data_freshness (
  source_key TEXT PRIMARY KEY,
  source_label TEXT NOT NULL,
  latest_date TEXT,
  row_count INTEGER DEFAULT 0,
  property_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
