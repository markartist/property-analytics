-- Migration 0012: Create marketing_data table
-- One row per community per week, 7 sections matching Base44 MarketingData entity

CREATE TABLE IF NOT EXISTS marketing_data (
  id                    TEXT PRIMARY KEY,
  community_id          TEXT NOT NULL REFERENCES communities(id),
  week_date             TEXT NOT NULL,  -- YYYY-MM-DD, must be a Friday

  -- Section 1: Advertising
  monthly_budget        REAL,
  google_ppc            REAL,
  google_remarketing    REAL,
  apartments_com        REAL,
  social                REAL,
  zillow                REAL,
  mailers               REAL,
  kurie_video           REAL,
  other                 REAL,
  advertising_notes     TEXT,
  advertising_saved_at  TEXT,

  -- Section 2: Property Performance
  occupancy             REAL,
  atr                   REAL,
  most_common_floorplans TEXT,
  property_performance_saved_at TEXT,

  -- Section 3: Guest Cards per Door
  t7_community_gc_per_door        REAL,
  t7_community_gc_per_avail_door  REAL,
  t7_portfolio_gc_per_door        REAL,
  t7_portfolio_gc_per_avail_door  REAL,
  t30_community_gc_per_door       REAL,
  t30_community_gc_per_avail_door REAL,
  t30_portfolio_gc_per_door       REAL,
  t30_portfolio_gc_per_avail_door REAL,
  gc_per_door_saved_at            TEXT,

  -- Section 4: Website & SEO
  t7_engaged_sessions_delta   REAL,
  t7_organic_sessions_delta   REAL,
  t30_engaged_sessions_delta  REAL,
  t30_organic_sessions_delta  REAL,
  t7_organic_visibility       REAL,
  t7_serp_traffic             REAL,
  website_notes               TEXT,
  seo_notes                   TEXT,
  website_seo_saved_at        TEXT,

  -- Section 5: Marketing Projects
  photography_needs     TEXT,
  signage_needs         TEXT,
  capex_projects        TEXT,
  marketing_saved_at    TEXT,

  -- Section 6: Reputation & Social
  google_review_count   INTEGER,
  google_review_score   REAL,
  social_posts_count    INTEGER,
  google_review_concerns TEXT,
  social_media_notes    TEXT,
  reputation_social_saved_at TEXT,

  -- Section 7: Pricing Strategy
  recent_pricing_call   TEXT,
  pricing_strategy_notes TEXT,
  current_specials      TEXT,
  pricing_strategy_saved_at TEXT,

  -- Rich content (call notes + AI summary)
  action_items          TEXT,  -- HTML from rich text editor
  ai_summary            TEXT,  -- Markdown from AI generation

  -- Import tracking
  source_import_run_id  TEXT,

  -- Audit
  created_at            TEXT NOT NULL,
  created_by            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  updated_by            TEXT NOT NULL,

  UNIQUE(community_id, week_date)
);

CREATE INDEX IF NOT EXISTS idx_marketing_data_community_date ON marketing_data(community_id, week_date);
CREATE INDEX IF NOT EXISTS idx_marketing_data_week_date      ON marketing_data(week_date);
