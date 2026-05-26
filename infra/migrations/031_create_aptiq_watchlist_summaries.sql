-- Stores AptIQ / ApartmentIQ-style watchlist summary PDFs as governed Captain evidence.

CREATE TABLE IF NOT EXISTS aptiq_watchlist_summaries (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  data_through_date TEXT,
  property_label TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  source_file TEXT NOT NULL,
  source_sha256 TEXT NOT NULL UNIQUE,
  page_count INTEGER NOT NULL,
  report_title TEXT,
  executive_summary TEXT,
  key_insights TEXT,
  recommendations TEXT,
  metrics_json TEXT,
  ocr_used INTEGER NOT NULL DEFAULT 0,
  extraction_status TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aptiq_watchlist_summaries_property
  ON aptiq_watchlist_summaries(property_id, report_date DESC);

CREATE TABLE IF NOT EXISTS aptiq_watchlist_summary_pages (
  id TEXT PRIMARY KEY,
  summary_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  property_id TEXT,
  page_number INTEGER NOT NULL,
  page_title TEXT,
  page_text TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(summary_id) REFERENCES aptiq_watchlist_summaries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aptiq_watchlist_summary_pages_summary
  ON aptiq_watchlist_summary_pages(summary_id, page_number);
