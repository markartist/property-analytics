-- Cloudflare billable usage source facts for FinOps and agent spend guardrails.
-- This is read-only account telemetry. It does not mutate Cloudflare resources,
-- deploy Workers, change DNS, or replace product/source-of-record analytics.

CREATE TABLE IF NOT EXISTS cloudflare_billable_usage_daily (
  charge_period_start TEXT NOT NULL,
  charge_period_end TEXT NOT NULL,
  billing_period_start TEXT,
  billing_period_end TEXT,
  account_id TEXT NOT NULL,
  account_name TEXT,
  service_name TEXT NOT NULL,
  service_family_name TEXT,
  billing_currency TEXT,
  pricing_quantity REAL,
  consumed_quantity REAL,
  consumed_unit TEXT,
  contracted_cost REAL,
  cumulated_pricing_quantity REAL,
  cumulated_contracted_cost REAL,
  zone_id TEXT,
  zone_name TEXT,
  collection_id INTEGER,
  collection_status TEXT NOT NULL DEFAULT 'ok',
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, charge_period_start, charge_period_end, service_name, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_cf_billable_usage_period
  ON cloudflare_billable_usage_daily(charge_period_start DESC, charge_period_end DESC);

CREATE INDEX IF NOT EXISTS idx_cf_billable_usage_service_period
  ON cloudflare_billable_usage_daily(service_family_name, service_name, charge_period_start DESC);

CREATE INDEX IF NOT EXISTS idx_cf_billable_usage_zone_period
  ON cloudflare_billable_usage_daily(zone_name, charge_period_start DESC);

CREATE TABLE IF NOT EXISTS cloudflare_billable_usage_collections (
  collection_date DATE NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  window_start DATE,
  window_end DATE,
  rows_returned INTEGER NOT NULL DEFAULT 0,
  rows_upserted INTEGER NOT NULL DEFAULT 0,
  total_contracted_cost REAL,
  billing_currency TEXT,
  api_status TEXT NOT NULL DEFAULT 'ok',
  credential_source TEXT,
  error_message TEXT,
  collection_id INTEGER,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_date, account_id, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_cf_billable_usage_collection_date
  ON cloudflare_billable_usage_collections(collection_date DESC);
