-- Mirrors app migration 0054 for local/infra SQLite deployments.
-- Cloudflare edge metrics are source facts for later rollups, not report logic.

CREATE TABLE IF NOT EXISTS cloudflare_edge_daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_date DATE NOT NULL,
  zone_id TEXT NOT NULL,
  zone_name TEXT,
  property_id TEXT,
  property_name TEXT,
  hostname TEXT NOT NULL DEFAULT '__zone__',
  path TEXT NOT NULL DEFAULT '__all__',
  requests INTEGER,
  bytes INTEGER,
  cached_requests INTEGER,
  cached_bytes INTEGER,
  uncached_requests INTEGER,
  origin_request_estimate INTEGER,
  cache_hit_ratio REAL,
  edge_response_status_2xx INTEGER,
  edge_response_status_3xx INTEGER,
  edge_response_status_4xx INTEGER,
  edge_response_status_5xx INTEGER,
  edge_response_status_other INTEGER,
  edge_response_status_breakdown_json TEXT,
  cache_status_breakdown_json TEXT,
  bot_security_json TEXT,
  dataset_name TEXT,
  query_status TEXT,
  raw_response_json TEXT,
  collection_id INTEGER,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(metric_date, zone_id, hostname, path)
);

CREATE INDEX IF NOT EXISTS idx_cf_edge_daily_date
  ON cloudflare_edge_daily_metrics(metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_cf_edge_daily_zone_date
  ON cloudflare_edge_daily_metrics(zone_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_cf_edge_daily_property_date
  ON cloudflare_edge_daily_metrics(property_id, metric_date DESC);
