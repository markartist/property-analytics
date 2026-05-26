-- Canonical property-scoped authorization foundation.
-- Additive security layer; does not replace session auth or runtime governance.

CREATE TABLE IF NOT EXISTS property_access_grants (
  grant_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  grant_effect TEXT NOT NULL CHECK (grant_effect IN ('allow', 'deny')) DEFAULT 'allow',
  scope_type TEXT NOT NULL CHECK (scope_type IN ('portfolio', 'region', 'property')),
  property_id TEXT,
  region TEXT,
  grant_fingerprint TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  runtime_modes_json TEXT NOT NULL,
  expert_lanes_json TEXT NOT NULL,
  active_status TEXT NOT NULL CHECK (active_status IN ('active', 'inactive')) DEFAULT 'active',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  CHECK (
    (scope_type = 'property' AND property_id IS NOT NULL AND trim(property_id) <> '') OR
    (scope_type = 'region' AND region IS NOT NULL AND trim(region) <> '') OR
    (scope_type = 'portfolio' AND property_id IS NULL AND region IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_property_access_grants_user ON property_access_grants(user_id, active_status);
CREATE INDEX IF NOT EXISTS idx_property_access_grants_property ON property_access_grants(property_id, active_status);
CREATE INDEX IF NOT EXISTS idx_property_access_grants_region ON property_access_grants(region, active_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_access_grants_unique_active ON property_access_grants(user_id, grant_fingerprint) WHERE active_status = 'active';

CREATE TABLE IF NOT EXISTS property_access_audit_events (
  event_id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_role TEXT,
  property_id TEXT,
  community_id TEXT,
  region TEXT,
  requested_action TEXT NOT NULL,
  requested_scope TEXT,
  runtime_mode TEXT,
  lane_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  high_risk INTEGER NOT NULL CHECK (high_risk IN (0, 1)),
  correlation_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_access_audit_actor ON property_access_audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_access_audit_property ON property_access_audit_events(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_access_audit_decision ON property_access_audit_events(decision, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_property_access_audit_immutable
  BEFORE UPDATE ON property_access_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Property access audit events are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_property_access_audit_no_delete
  BEFORE DELETE ON property_access_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Property access audit events cannot be deleted.');
  END;
