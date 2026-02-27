-- 010: GSC daily metrics mirror
-- Raw daily GSC data per community for portfolio snapshot reports.

CREATE TABLE IF NOT EXISTS gsc_daily_metrics (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL,
  average_position REAL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_daily_community_date
  ON gsc_daily_metrics(community_id, metric_date);

CREATE INDEX IF NOT EXISTS idx_gsc_daily_date
  ON gsc_daily_metrics(metric_date);
