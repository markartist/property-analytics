CREATE TABLE IF NOT EXISTS marketing_bi_source_performance_rows (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  source_file TEXT NOT NULL,
  export_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  scope TEXT,
  region TEXT,
  property_name TEXT,
  property_id TEXT,
  community_id TEXT,
  origin TEXT,
  source_kind TEXT,
  source_group TEXT,
  source_desc TEXT,
  guest_cards INTEGER,
  visits INTEGER,
  first_tours INTEGER,
  applications INTEGER,
  leases INTEGER,
  cancel_denials INTEGER,
  move_ins INTEGER,
  visit_guest_card_conversion REAL,
  app_guest_card_conversion REAL,
  lease_guest_card_conversion REAL,
  lease_visit_ratio REAL,
  cancel_denial_pct_of_guest_cards REAL,
  move_in_guest_card_conversion REAL,
  move_in_visit_ratio REAL,
  guest_cards_delta REAL,
  visits_delta REAL,
  applications_delta REAL,
  leases_delta REAL,
  cancel_denials_delta REAL,
  move_ins_delta REAL,
  visit_guest_card_conversion_delta REAL,
  app_guest_card_conversion_delta REAL,
  lease_guest_card_conversion_delta REAL,
  lease_visit_ratio_delta REAL,
  cancel_denial_pct_delta REAL,
  move_in_guest_card_conversion_delta REAL,
  move_in_visit_ratio_delta REAL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, source_file, row_number)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_source_perf_property_date
  ON marketing_bi_source_performance_rows(property_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_source_perf_source
  ON marketing_bi_source_performance_rows(source_kind, source_group, source_desc, report_date DESC);

CREATE TABLE IF NOT EXISTS marketing_bi_move_ins_by_source_rows (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  property_name TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  unit TEXT,
  unit_move_in_date TEXT,
  reservation_status TEXT,
  resident_type TEXT,
  resident_move_in_date TEXT,
  resident_move_out_date TEXT,
  marketing_source TEXT,
  conversion_source TEXT,
  source_file TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, source_file, row_number)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_move_ins_source_property_date
  ON marketing_bi_move_ins_by_source_rows(property_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_move_ins_sources
  ON marketing_bi_move_ins_by_source_rows(marketing_source, conversion_source, report_date DESC);

CREATE TABLE IF NOT EXISTS marketing_bi_monthly_ad_spend_source_rows (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  property_code TEXT,
  property_name TEXT NOT NULL,
  property_short_name TEXT,
  region TEXT,
  market TEXT,
  calendar_month TEXT NOT NULL,
  source_group TEXT NOT NULL,
  ad_spend_total REAL,
  month_total REAL,
  month_budget REAL,
  month_actual_vs_budget_delta REAL,
  annual_budget REAL,
  annual_spend_trend_to_date REAL,
  annual_trend_delta_to_date REAL,
  source_file TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, source_file, property_name, calendar_month, source_group)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_monthly_ad_spend_source_property_date
  ON marketing_bi_monthly_ad_spend_source_rows(property_id, report_date DESC, calendar_month DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_monthly_ad_spend_source_group
  ON marketing_bi_monthly_ad_spend_source_rows(source_group, report_date DESC, calendar_month DESC);
