-- Migration 0014: Create PIB (Property Intelligence Brief) tables
-- Six tables for PIB dashboard data, one per data domain.
-- All keyed by community_id + snapshot_date (Fridays).

-- ─── 1. GA4 Traffic & Engagement ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pib_ga4_metrics (
  id                  TEXT PRIMARY KEY,
  community_id        TEXT NOT NULL REFERENCES communities(id),
  snapshot_date       TEXT NOT NULL,  -- YYYY-MM-DD Friday

  -- Aggregated 30-day totals
  total_sessions      INTEGER,
  total_users         INTEGER,
  new_users           INTEGER,
  avg_session_duration REAL,

  -- Source breakdown (30d sums)
  organic_sessions    INTEGER,
  direct_sessions     INTEGER,
  paid_sessions       INTEGER,
  referral_sessions   INTEGER,
  social_sessions     INTEGER,

  -- Device breakdown (30d sums)
  desktop_sessions    INTEGER,
  mobile_sessions     INTEGER,
  tablet_sessions     INTEGER,

  -- Intent events (30d sums)
  tour_clicks         INTEGER,
  phone_calls         INTEGER,
  apply_clicks        INTEGER,
  price_quotes        INTEGER,
  form_starts         INTEGER,
  form_submits        INTEGER,

  -- Trends (current 30d vs prior 30d)
  sessions_trend_pct  REAL,
  users_trend_pct     REAL,

  synced_at           TEXT NOT NULL,
  UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pib_ga4_community_date ON pib_ga4_metrics(community_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pib_ga4_snapshot       ON pib_ga4_metrics(snapshot_date);

-- ─── 2. Site Performance (PageSpeed / Core Web Vitals) ─────────────────────

CREATE TABLE IF NOT EXISTS pib_site_performance (
  id                  TEXT PRIMARY KEY,
  community_id        TEXT NOT NULL REFERENCES communities(id),
  snapshot_date       TEXT NOT NULL,

  -- Scores (0–100)
  mobile_score        INTEGER,
  desktop_score       INTEGER,

  -- Mobile Core Web Vitals
  mobile_lcp          REAL,   -- Largest Contentful Paint (ms)
  mobile_cls          REAL,   -- Cumulative Layout Shift
  mobile_fid          REAL,   -- First Input Delay (ms)
  mobile_fcp          REAL,   -- First Contentful Paint (ms)

  -- Desktop Core Web Vitals
  desktop_lcp         REAL,
  desktop_cls         REAL,
  desktop_fid         REAL,
  desktop_fcp         REAL,

  synced_at           TEXT NOT NULL,
  UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pib_perf_community_date ON pib_site_performance(community_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pib_perf_snapshot       ON pib_site_performance(snapshot_date);

-- ─── 3. Local Presence (GBP Insights) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS pib_local_presence (
  id                  TEXT PRIMARY KEY,
  community_id        TEXT NOT NULL REFERENCES communities(id),
  snapshot_date       TEXT NOT NULL,

  -- Profile views (30d sums)
  total_profile_views INTEGER,
  maps_views          INTEGER,
  search_views        INTEGER,

  -- Actions (30d sums)
  website_clicks      INTEGER,
  phone_calls         INTEGER,
  direction_requests  INTEGER,

  -- Computed
  action_rate         REAL,   -- total_actions / total_profile_views

  -- Trends (current 30d vs prior 30d)
  views_trend_pct     REAL,
  actions_trend_pct   REAL,

  synced_at           TEXT NOT NULL,
  UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pib_local_community_date ON pib_local_presence(community_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pib_local_snapshot       ON pib_local_presence(snapshot_date);

-- ─── 4. Search Performance (GSC) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pib_search_performance (
  id                  TEXT PRIMARY KEY,
  community_id        TEXT NOT NULL REFERENCES communities(id),
  snapshot_date       TEXT NOT NULL,

  -- Aggregate GSC metrics (30d)
  total_clicks        INTEGER,
  total_impressions   INTEGER,
  avg_ctr             REAL,
  avg_position        REAL,

  -- Top 10 keywords as JSON array
  -- [{query, clicks, impressions, ctr, position}, ...]
  top_keywords_json   TEXT,

  synced_at           TEXT NOT NULL,
  UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pib_search_community_date ON pib_search_performance(community_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pib_search_snapshot       ON pib_search_performance(snapshot_date);

-- ─── 5. CIR (Conversion Intent Rate) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS pib_cir (
  id                  TEXT PRIMARY KEY,
  community_id        TEXT NOT NULL REFERENCES communities(id),
  snapshot_date       TEXT NOT NULL,

  -- 30-day CIR
  total_sessions      INTEGER,
  intent_events       INTEGER,
  cir_value           REAL,
  cir_status          TEXT,    -- 'strong', 'moderate', 'low', 'critical'

  -- Prior 30d for trend
  prior_cir_value     REAL,
  cir_trend_pct       REAL,

  synced_at           TEXT NOT NULL,
  UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pib_cir_community_date ON pib_cir(community_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pib_cir_snapshot       ON pib_cir(snapshot_date);

-- ─── 6. Reviews & Sentiment ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pib_reviews (
  id                  TEXT PRIMARY KEY,
  community_id        TEXT NOT NULL REFERENCES communities(id),
  snapshot_date       TEXT NOT NULL,

  -- Overall stats (all-time up to snapshot)
  total_reviews       INTEGER,
  avg_rating          REAL,
  five_star_count     INTEGER,
  one_star_count      INTEGER,

  -- Recent window
  recent_30d_count    INTEGER,

  -- Trends
  avg_rating_trend    REAL,    -- change vs prior 30d

  -- Sentiment (from AI analysis)
  sentiment_score     REAL,

  -- JSON blobs for detail views
  themes_json         TEXT,    -- {maintenance: n, staff: n, ...}
  critical_reviews_json TEXT,  -- [{reviewer, rating, comment, date}, ...]

  synced_at           TEXT NOT NULL,
  UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pib_reviews_community_date ON pib_reviews(community_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pib_reviews_snapshot       ON pib_reviews(snapshot_date);
