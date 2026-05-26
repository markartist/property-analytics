-- Migration 0037: Marketing BI recovery-source Excel exports
-- Structured recovery lanes for vacancy aging, lease terms, spending, and leakage.

CREATE TABLE IF NOT EXISTS marketing_bi_vacancy_days_units (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  region TEXT,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  bedroom_count INTEGER,
  floorplan_desc TEXT,
  unit_number TEXT,
  vacancy_days REAL,
  vacancy_days_delta REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, metric_name, property_name, unit_number, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_vacancy_days_units_property_date
  ON marketing_bi_vacancy_days_units(property_id, report_date DESC, metric_name);

CREATE TABLE IF NOT EXISTS marketing_bi_lease_term_rows (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  region TEXT,
  property_name TEXT,
  property_id TEXT,
  community_id TEXT,
  lease_type TEXT,
  bedroom_count INTEGER,
  floorplan_desc TEXT,
  lease_term_avg REAL,
  lease_term_avg_delta REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_lease_term_rows_property_date
  ON marketing_bi_lease_term_rows(property_id, report_date DESC);

CREATE TABLE IF NOT EXISTS marketing_bi_wow_spending (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  region TEXT,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  apartment_units INTEGER,
  acquired_date TEXT,
  spent REAL,
  budgeted REAL,
  budget_per_unit_month REAL,
  left_to_spend REAL,
  pct_remaining REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, property_name, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_wow_spending_property_date
  ON marketing_bi_wow_spending(property_id, report_date DESC);

CREATE TABLE IF NOT EXISTS marketing_bi_ad_spend_performance_month (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  calendar_month TEXT NOT NULL,
  region TEXT,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  guest_cards INTEGER,
  visits INTEGER,
  leases INTEGER,
  ad_spend_total REAL,
  ad_spend_delta REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, calendar_month, property_name, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_ad_spend_performance_month_property_date
  ON marketing_bi_ad_spend_performance_month(property_id, report_date DESC, calendar_month DESC);

CREATE TABLE IF NOT EXISTS marketing_bi_period_leakage_metrics (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  metric_set TEXT NOT NULL,
  calendar_month TEXT NOT NULL,
  metric_json TEXT NOT NULL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, metric_set, calendar_month, source_file)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_period_leakage_metrics_date
  ON marketing_bi_period_leakage_metrics(report_date DESC, metric_set, calendar_month);
