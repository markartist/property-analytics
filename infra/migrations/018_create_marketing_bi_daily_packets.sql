-- Migration 018: Marketing BI daily packet sources
-- Stores the daily portfolio Power BI packet as a governed Captain source.

CREATE TABLE IF NOT EXISTS marketing_bi_daily_packets (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  selected_period_start TEXT,
  selected_period_end TEXT,
  traffic_data_as_of TEXT,
  source_file TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  report_title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_sha256)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_daily_packets_report_date
  ON marketing_bi_daily_packets(report_date DESC);

CREATE TABLE IF NOT EXISTS marketing_bi_daily_packet_pages (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  page_title TEXT,
  page_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(packet_id, page_number),
  FOREIGN KEY(packet_id) REFERENCES marketing_bi_daily_packets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_daily_packet_pages_packet
  ON marketing_bi_daily_packet_pages(packet_id, page_number);

CREATE TABLE IF NOT EXISTS marketing_bi_property_summary_rows (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  region TEXT NOT NULL,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  apartments INTEGER,
  acquired_date TEXT,
  year_built INTEGER,
  traffic_data_as_of TEXT,
  source_file TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(packet_id, region, property_name),
  FOREIGN KEY(packet_id) REFERENCES marketing_bi_daily_packets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_property_summary_property_date
  ON marketing_bi_property_summary_rows(property_id, report_date DESC);
