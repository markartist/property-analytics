-- Raw read-only snapshots from the Resi V2 management API.
-- Credentials are resolved through Keeper/KSM; V2 writes are intentionally out of scope.

CREATE TABLE IF NOT EXISTS resi_v2_api_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  fetched_at TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  account_id TEXT,
  account_name TEXT,
  user_id TEXT,
  user_email TEXT,
  properties_seen INTEGER NOT NULL DEFAULT 0,
  lead_sources_seen INTEGER NOT NULL DEFAULT 0,
  properties_payload_sha256 TEXT NOT NULL,
  lead_sources_payload_sha256 TEXT NOT NULL,
  raw_me_json TEXT NOT NULL,
  raw_properties_json TEXT NOT NULL,
  raw_lead_sources_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resi_v2_api_snapshots_fetched
  ON resi_v2_api_snapshots(fetched_at DESC);
