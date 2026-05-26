-- Property Brief Grounding Core
-- Captures source documents, normalized claims, reconciliation outcomes, and reusable artifact blocks.
-- This supports POP Brief / Captain's Log grounding without changing locked PIB generation behavior.

CREATE TABLE IF NOT EXISTS property_brief_source_documents (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  source_system TEXT NOT NULL,
  source_document_type TEXT NOT NULL CHECK (
    source_document_type IN (
      'aptiq_operational_performance',
      'aptiq_leasing_strategy',
      'aptiq_market_ai',
      'data_pond_extract',
      'live_property_page',
      'captain_log',
      'operator_note',
      'other'
    )
  ),
  source_filename TEXT,
  source_uri TEXT,
  source_date TEXT,
  data_through_date TEXT,
  cadence TEXT CHECK (cadence IS NULL OR cadence IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
  raw_text_hash TEXT,
  storage_ref TEXT,
  metadata_json TEXT,
  imported_at TEXT NOT NULL,
  imported_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_brief_source_documents_property
  ON property_brief_source_documents(property_id, data_through_date);

CREATE INDEX IF NOT EXISTS idx_property_brief_source_documents_type
  ON property_brief_source_documents(source_document_type, source_date);

CREATE TABLE IF NOT EXISTS property_brief_claims (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  source_document_id TEXT REFERENCES property_brief_source_documents(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL CHECK (
    claim_type IN (
      'metric',
      'market_position',
      'operational_diagnosis',
      'recommendation',
      'talking_point',
      'source_truth_conflict',
      'watch_item',
      'decision'
    )
  ),
  subject TEXT NOT NULL,
  statement TEXT NOT NULL,
  metric_code TEXT,
  metric_window TEXT,
  source_value TEXT,
  normalized_value REAL,
  unit TEXT,
  authority TEXT NOT NULL CHECK (
    authority IN ('data_pond', 'aptiq', 'live_property_page', 'captain_log', 'human', 'other')
  ),
  truth_status TEXT NOT NULL CHECK (
    truth_status IN (
      'vendor_only',
      'pond_verified',
      'pond_overridden',
      'conflict',
      'needs_review',
      'rejected'
    )
  ),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  evidence_json TEXT,
  recommended_action TEXT,
  owner_role TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'superseded', 'archived')),
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_brief_claims_property
  ON property_brief_claims(property_id, truth_status, priority);

CREATE INDEX IF NOT EXISTS idx_property_brief_claims_source
  ON property_brief_claims(source_document_id);

CREATE INDEX IF NOT EXISTS idx_property_brief_claims_metric
  ON property_brief_claims(property_id, metric_code, metric_window);

CREATE TABLE IF NOT EXISTS property_brief_reconciliations (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES property_brief_claims(id) ON DELETE CASCADE,
  truth_source TEXT NOT NULL,
  truth_ref TEXT NOT NULL,
  truth_value TEXT,
  reconciliation_status TEXT NOT NULL CHECK (
    reconciliation_status IN (
      'matched',
      'overridden_by_pond',
      'source_conflict',
      'insufficient_context',
      'accepted_advisory',
      'rejected'
    )
  ),
  note TEXT,
  reconciled_at TEXT NOT NULL,
  reconciled_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_brief_reconciliations_claim
  ON property_brief_reconciliations(claim_id, reconciliation_status);

CREATE TABLE IF NOT EXISTS property_brief_artifact_blocks (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  week_ending TEXT,
  block_type TEXT NOT NULL CHECK (
    block_type IN (
      'truth_snapshot',
      'market_pressure',
      'operational_diagnosis',
      'revenue_concession_risk',
      'floorplan_watch',
      'leasing_moves',
      'marketing_moves',
      'captain_log_update',
      'open_conflicts'
    )
  ),
  title TEXT NOT NULL,
  body_json TEXT NOT NULL,
  source_claim_ids_json TEXT NOT NULL,
  readiness_status TEXT NOT NULL CHECK (
    readiness_status IN ('draft', 'review_required', 'brief_ready', 'blocked')
  ),
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_brief_artifact_blocks_property
  ON property_brief_artifact_blocks(property_id, week_ending, block_type);
