-- Expert Reads / Consulting Bench runtime controls.
-- Additive specialist contribution layer; not a report generator.

CREATE TABLE IF NOT EXISTS expert_read_requests (
  request_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  source_runtime_id TEXT REFERENCES captain_runtime_sessions(session_id) ON DELETE RESTRICT,
  source_interaction_id TEXT REFERENCES captain_interactions(interaction_id) ON DELETE RESTRICT,
  lane_id TEXT NOT NULL,
  runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('monitoring', 'lightweight', 'standard', 'escalated', 'executive', 'simulation')),
  report_family TEXT,
  reason TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  directive_snapshot_id TEXT NOT NULL,
  directive_snapshot_hash TEXT NOT NULL,
  evidence_packet_id TEXT NOT NULL REFERENCES captain_evidence_packets(evidence_packet_id) ON DELETE RESTRICT,
  evidence_packet_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_expert_read_requests_property ON expert_read_requests(property_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_read_requests_lane ON expert_read_requests(lane_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_read_requests_runtime ON expert_read_requests(source_runtime_id, source_interaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_read_requests_hash ON expert_read_requests(request_hash);

CREATE TABLE IF NOT EXISTS expert_reads (
  expert_read_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES expert_read_requests(request_id) ON DELETE RESTRICT,
  lane_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  read_status TEXT NOT NULL CHECK (read_status IN ('requested', 'in_progress', 'final', 'blocked', 'failed')),
  specialist_summary TEXT NOT NULL,
  do_not_do_rules_json TEXT NOT NULL,
  required_evidence_json TEXT NOT NULL,
  evidence_used_json TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  freshness_state TEXT NOT NULL,
  publishability TEXT NOT NULL CHECK (publishability IN ('internal_only', 'needs_verification', 'blocked')),
  escalation_required INTEGER NOT NULL CHECK (escalation_required IN (0, 1)),
  conflicts_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  read_hash TEXT NOT NULL,
  payload_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_expert_reads_property ON expert_reads(property_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_reads_lane ON expert_reads(lane_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_reads_request ON expert_reads(request_id);

CREATE TABLE IF NOT EXISTS expert_read_findings (
  finding_id TEXT PRIMARY KEY,
  expert_read_id TEXT NOT NULL REFERENCES expert_reads(expert_read_id) ON DELETE RESTRICT,
  finding_type TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  freshness TEXT NOT NULL,
  publishability TEXT NOT NULL CHECK (publishability IN ('internal_only', 'needs_verification', 'blocked')),
  verification_required INTEGER NOT NULL CHECK (verification_required IN (0, 1))
);

CREATE TABLE IF NOT EXISTS expert_read_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  expert_read_id TEXT NOT NULL REFERENCES expert_reads(expert_read_id) ON DELETE RESTRICT,
  recommendation_type TEXT NOT NULL,
  recommendation_text TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  proof_metric TEXT,
  owner_lane TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  blocked_reason TEXT,
  publishability TEXT NOT NULL CHECK (publishability IN ('internal_only', 'needs_verification', 'blocked'))
);

CREATE TABLE IF NOT EXISTS expert_read_audit_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  request_id TEXT,
  expert_read_id TEXT,
  lane_id TEXT,
  actor TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  before_state_json TEXT,
  after_state_json TEXT,
  reason TEXT,
  correlation_id TEXT,
  evidence_hash TEXT,
  directive_hash TEXT,
  read_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_expert_read_audit_request ON expert_read_audit_events(request_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_expert_read_audit_read ON expert_read_audit_events(expert_read_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_expert_read_audit_correlation ON expert_read_audit_events(correlation_id, timestamp ASC);

CREATE TRIGGER IF NOT EXISTS trg_expert_read_requests_immutable
  BEFORE UPDATE ON expert_read_requests
  BEGIN
    SELECT RAISE(ABORT, 'Expert Read requests are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_reads_final_immutable
  BEFORE UPDATE ON expert_reads
  WHEN OLD.read_status IN ('final', 'blocked', 'failed')
  BEGIN
    SELECT RAISE(ABORT, 'Finalized Expert Reads are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_findings_immutable
  BEFORE UPDATE ON expert_read_findings
  BEGIN
    SELECT RAISE(ABORT, 'Expert Read findings are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_recommendations_immutable
  BEFORE UPDATE ON expert_read_recommendations
  BEGIN
    SELECT RAISE(ABORT, 'Expert Read recommendations are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_audit_immutable
  BEFORE UPDATE ON expert_read_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Expert Read audit events are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_requests_no_delete
  BEFORE DELETE ON expert_read_requests
  BEGIN
    SELECT RAISE(ABORT, 'expert_read_requests cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_reads_no_delete
  BEFORE DELETE ON expert_reads
  BEGIN
    SELECT RAISE(ABORT, 'expert_reads cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_findings_no_delete
  BEFORE DELETE ON expert_read_findings
  BEGIN
    SELECT RAISE(ABORT, 'expert_read_findings cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_recommendations_no_delete
  BEFORE DELETE ON expert_read_recommendations
  BEGIN
    SELECT RAISE(ABORT, 'expert_read_recommendations cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_expert_read_audit_no_delete
  BEFORE DELETE ON expert_read_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'expert_read_audit_events cannot be deleted.');
  END;
