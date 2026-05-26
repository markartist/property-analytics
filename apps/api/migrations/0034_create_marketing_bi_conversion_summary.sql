-- Migration 0034: Marketing BI conversion performance summary
-- Portfolio-level paid/all conversion and spend efficiency metrics from the Marketing BI packet.

CREATE TABLE IF NOT EXISTS marketing_bi_conversion_performance_summary (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  calendar_period TEXT NOT NULL,
  units_avg INTEGER,
  guest_cards_paid INTEGER,
  visits_paid INTEGER,
  applications_paid INTEGER,
  leases_paid INTEGER,
  guest_cards_all INTEGER,
  visits_all INTEGER,
  applications_all INTEGER,
  leases_all INTEGER,
  cost_per_guest_card_paid REAL,
  cost_per_visit_paid REAL,
  cost_per_application_paid REAL,
  cost_per_lease_paid REAL,
  cost_per_guest_card_all REAL,
  cost_per_visit_all REAL,
  cost_per_application_all REAL,
  cost_per_lease_all REAL,
  ad_spend_total REAL,
  ad_spend_traditional REAL,
  ad_spend_social REAL,
  ad_spend_google REAL,
  ad_spend_social_pct REAL,
  ad_spend_per_door REAL,
  source_file TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, calendar_period)
);

CREATE INDEX IF NOT EXISTS idx_marketing_bi_conversion_summary_date
  ON marketing_bi_conversion_performance_summary(report_date DESC, calendar_period);
