-- Feed-derived Resi source phone/email lookup for edge routing and QA.
-- Source of truth: ThirtyLines trackingCodes in thirtylines_feed_snapshots.
-- D1 owns the auditable read model; KV may cache generated views only.

CREATE TABLE IF NOT EXISTS resi_source_lookup_runs (
  run_id TEXT PRIMARY KEY,
  feed_snapshot_id INTEGER,
  feed_snapshot_date DATE,
  feed_fetched_at TEXT,
  feed_url TEXT,
  feed_payload_sha256 TEXT,
  generated_at TEXT NOT NULL,
  external_source_field TEXT NOT NULL DEFAULT 'id',
  properties_seen INTEGER NOT NULL DEFAULT 0,
  properties_resolved INTEGER NOT NULL DEFAULT 0,
  properties_feed_only INTEGER NOT NULL DEFAULT 0,
  tracking_codes_seen INTEGER NOT NULL DEFAULT 0,
  rows_upserted INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT,
  kv_artifact_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resi_source_phone_lookup (
  property_code TEXT NOT NULL,
  tracking_id TEXT NOT NULL,
  external_source_field TEXT NOT NULL DEFAULT 'id',
  marketing_source_cd TEXT,
  source_phone TEXT,
  source_email TEXT,
  fallback_phone TEXT,
  fallback_email TEXT,
  default_tracking_id TEXT,
  default_marketing_source_cd TEXT,
  default_phone_source TEXT,
  default_email_source TEXT,
  concierge_phone TEXT,
  property_name TEXT,
  canonical_property_id TEXT,
  ga4_property_id TEXT,
  community_id TEXT,
  website_url TEXT,
  hostnames_json TEXT,
  url_prefixes_json TEXT,
  feed_property_id TEXT,
  feed_property_name TEXT,
  feed_snapshot_id INTEGER,
  feed_snapshot_date DATE,
  feed_fetched_at TEXT,
  feed_payload_sha256 TEXT,
  source_has_phone INTEGER NOT NULL DEFAULT 0,
  source_has_email INTEGER NOT NULL DEFAULT 0,
  identity_status TEXT NOT NULL DEFAULT 'resolved',
  is_active INTEGER NOT NULL DEFAULT 1,
  raw_tracking_code_json TEXT,
  run_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (property_code, tracking_id)
);

CREATE INDEX IF NOT EXISTS idx_resi_source_phone_lookup_tracking_id
  ON resi_source_phone_lookup(tracking_id);

CREATE INDEX IF NOT EXISTS idx_resi_source_phone_lookup_property_source
  ON resi_source_phone_lookup(property_code, marketing_source_cd);

CREATE INDEX IF NOT EXISTS idx_resi_source_phone_lookup_website
  ON resi_source_phone_lookup(website_url);
