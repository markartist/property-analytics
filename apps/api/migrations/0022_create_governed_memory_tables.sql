-- Migration 0022: Governed multi-layer memory system
-- Captain's Log (property) -> Fleet Brief (cohort/region/group) -> The Ledger (institutional)
-- Promotions are explicit, auditable, and evidence-backed.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS governed_memory_entries (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('property', 'fleet', 'ledger')),
  property_id TEXT,
  fleet_key TEXT,
  ledger_key TEXT,
  summary TEXT NOT NULL,
  structured_payload_json TEXT,
  source_system TEXT NOT NULL,
  created_by TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL CHECK (status IN ('active', 'candidate', 'approved', 'deprecated')),
  dedupe_signature TEXT NOT NULL,
  parent_entry_id TEXT REFERENCES governed_memory_entries(id),
  originating_candidate_id TEXT REFERENCES governed_memory_candidates(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (scope = 'property' AND property_id IS NOT NULL AND fleet_key IS NULL AND ledger_key IS NULL) OR
    (scope = 'fleet' AND property_id IS NULL AND fleet_key IS NOT NULL AND ledger_key IS NULL) OR
    (scope = 'ledger' AND property_id IS NULL AND fleet_key IS NULL AND ledger_key IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entries_scope_created
  ON governed_memory_entries(scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entries_property
  ON governed_memory_entries(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entries_fleet
  ON governed_memory_entries(fleet_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entries_ledger
  ON governed_memory_entries(ledger_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entries_dedupe
  ON governed_memory_entries(scope, dedupe_signature);

CREATE TABLE IF NOT EXISTS governed_memory_evidence_refs (
  id TEXT PRIMARY KEY,
  memory_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  evidence_excerpt TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governed_memory_evidence_entry
  ON governed_memory_evidence_refs(memory_entry_id, created_at ASC);

CREATE TABLE IF NOT EXISTS governed_memory_candidates (
  id TEXT PRIMARY KEY,
  source_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
  source_scope TEXT NOT NULL CHECK (source_scope IN ('property', 'fleet')),
  target_scope TEXT NOT NULL CHECK (target_scope IN ('fleet', 'ledger')),
  property_id TEXT,
  fleet_key TEXT,
  ledger_key TEXT,
  proposed_summary TEXT NOT NULL,
  proposed_structured_payload_json TEXT,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'promoted', 'rejected')),
  requested_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governed_memory_candidates_target
  ON governed_memory_candidates(target_scope, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governed_memory_candidates_source
  ON governed_memory_candidates(source_entry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS governed_memory_promotions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES governed_memory_candidates(id) ON DELETE CASCADE,
  from_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
  to_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id),
  from_scope TEXT NOT NULL CHECK (from_scope IN ('property', 'fleet')),
  to_scope TEXT NOT NULL CHECK (to_scope IN ('fleet', 'ledger')),
  action_type TEXT NOT NULL CHECK (action_type IN ('promoted_new', 'promoted_existing')),
  promoted_by TEXT NOT NULL,
  action_notes TEXT,
  evidence_snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governed_memory_promotions_created
  ON governed_memory_promotions(created_at DESC);

CREATE TABLE IF NOT EXISTS governed_memory_entry_lineage (
  id TEXT PRIMARY KEY,
  target_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
  source_entry_id TEXT NOT NULL REFERENCES governed_memory_entries(id) ON DELETE CASCADE,
  source_candidate_id TEXT REFERENCES governed_memory_candidates(id),
  created_at TEXT NOT NULL,
  UNIQUE (target_entry_id, source_entry_id, source_candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entry_lineage_target
  ON governed_memory_entry_lineage(target_entry_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_governed_memory_entry_lineage_source
  ON governed_memory_entry_lineage(source_entry_id, created_at ASC);

CREATE TABLE IF NOT EXISTS governed_memory_identity_bindings (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('property', 'fleet', 'ledger')),
  property_id TEXT,
  fleet_key TEXT,
  ledger_key TEXT,
  role_family TEXT NOT NULL CHECK (role_family IN ('Captain', 'Commodore', 'Ledger')),
  display_name TEXT NOT NULL,
  internal_name TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (scope = 'property' AND property_id IS NOT NULL AND fleet_key IS NULL AND ledger_key IS NULL) OR
    (scope = 'fleet' AND property_id IS NULL AND fleet_key IS NOT NULL AND ledger_key IS NULL) OR
    (scope = 'ledger' AND property_id IS NULL AND fleet_key IS NULL AND ledger_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governed_memory_identity_property
  ON governed_memory_identity_bindings(scope, property_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governed_memory_identity_fleet
  ON governed_memory_identity_bindings(scope, fleet_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governed_memory_identity_ledger
  ON governed_memory_identity_bindings(scope, ledger_key);
