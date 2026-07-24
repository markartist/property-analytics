-- Ahrefs API source facts for advisory SEO, site-audit, and web-analytics intelligence.
-- GA4, GSC, GBP, PageSpeed, DataForSEO, and internal operating sources remain authoritative
-- for their governed domains; Ahrefs augments technical SEO, authority, backlink, and
-- Ahrefs-owned analytics context.

CREATE TABLE IF NOT EXISTS ahrefs_subscription_usage_snapshots (
  snapshot_date DATE NOT NULL,
  collection_id INTEGER,
  subscription TEXT,
  units_limit_api_key INTEGER,
  units_limit_workspace INTEGER,
  units_usage_api_key INTEGER,
  units_usage_workspace INTEGER,
  api_key_expiration_date TEXT,
  usage_reset_date TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_date)
);

CREATE TABLE IF NOT EXISTS ahrefs_projects (
  project_id TEXT PRIMARY KEY,
  project_name TEXT,
  target_url TEXT,
  mode TEXT,
  protocol TEXT,
  access_scope TEXT,
  verified INTEGER,
  keyword_count INTEGER,
  has_web_analytics_key INTEGER,
  property_id TEXT,
  community_id TEXT,
  property_name TEXT,
  identity_match_source TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_projects_property
  ON ahrefs_projects(property_id);

CREATE INDEX IF NOT EXISTS idx_ahrefs_projects_target_url
  ON ahrefs_projects(target_url);

CREATE TABLE IF NOT EXISTS ahrefs_site_audit_project_health (
  snapshot_date DATE NOT NULL,
  project_id TEXT NOT NULL,
  collection_id INTEGER,
  project_name TEXT,
  target_url TEXT,
  property_id TEXT,
  community_id TEXT,
  property_name TEXT,
  health_score REAL,
  status TEXT,
  last_crawl_date TEXT,
  total_urls INTEGER,
  urls_with_errors INTEGER,
  urls_with_warnings INTEGER,
  urls_with_notices INTEGER,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_date, project_id)
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_site_audit_property_date
  ON ahrefs_site_audit_project_health(property_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_ahrefs_site_audit_project_date
  ON ahrefs_site_audit_project_health(project_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS ahrefs_web_analytics_daily (
  metric_date DATE NOT NULL,
  project_id TEXT NOT NULL,
  collection_id INTEGER,
  project_name TEXT,
  target_url TEXT,
  property_id TEXT,
  community_id TEXT,
  property_name TEXT,
  window_start TEXT,
  window_end TEXT,
  visits INTEGER,
  visitors INTEGER,
  pageviews INTEGER,
  avg_session_duration_sec REAL,
  bounce_rate REAL,
  collection_status TEXT NOT NULL DEFAULT 'ok',
  error_message TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, project_id)
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_web_analytics_property_date
  ON ahrefs_web_analytics_daily(property_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS ahrefs_gsc_daily_summary (
  metric_date DATE NOT NULL,
  project_id TEXT NOT NULL,
  collection_id INTEGER,
  project_name TEXT,
  target_url TEXT,
  property_id TEXT,
  community_id TEXT,
  property_name TEXT,
  clicks INTEGER,
  impressions INTEGER,
  ctr REAL,
  avg_position REAL,
  row_count INTEGER,
  collection_status TEXT NOT NULL DEFAULT 'ok',
  error_message TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, project_id)
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_gsc_property_date
  ON ahrefs_gsc_daily_summary(property_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS ahrefs_domain_rating_snapshots (
  snapshot_date DATE NOT NULL,
  target_url TEXT NOT NULL,
  project_id TEXT,
  collection_id INTEGER,
  project_name TEXT,
  property_id TEXT,
  community_id TEXT,
  property_name TEXT,
  domain_rating REAL,
  has_license INTEGER,
  warning_message TEXT,
  collection_status TEXT NOT NULL DEFAULT 'ok',
  error_message TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_date, target_url)
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_domain_rating_property_date
  ON ahrefs_domain_rating_snapshots(property_id, snapshot_date DESC);
