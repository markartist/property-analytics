-- 0016: Ad keyword performance by unit type
-- Pre-aggregated Google Ads keyword data classified by unit type (1BR, 2BR, etc.)

CREATE TABLE IF NOT EXISTS ad_keyword_performance (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  week_date TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  spend REAL DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  keyword_count INTEGER DEFAULT 0,
  top_keywords_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (community_id) REFERENCES communities(id),
  UNIQUE(community_id, week_date, unit_type)
);

CREATE INDEX idx_akp_community_week ON ad_keyword_performance(community_id, week_date);

-- Summary columns on marketing_data for quick access
ALTER TABLE marketing_data ADD COLUMN ads_total_clicks INTEGER;
ALTER TABLE marketing_data ADD COLUMN ads_total_conversions REAL;
ALTER TABLE marketing_data ADD COLUMN ads_cost_per_conversion REAL;
ALTER TABLE marketing_data ADD COLUMN ads_classified_pct REAL;
