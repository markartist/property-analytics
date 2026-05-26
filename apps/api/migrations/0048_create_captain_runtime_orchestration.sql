-- Migration 0048: Captain Runtime Orchestration Layer
-- Governed interaction/session/evidence/reasoning/memory/routing lineage.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS captain_runtime_sessions (
  session_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('monitoring', 'lightweight', 'standard', 'escalated', 'executive', 'simulation')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  active_directive_snapshot_json TEXT,
  runtime_hash TEXT NOT NULL,
  correlation_id TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captain_runtime_sessions_property
  ON captain_runtime_sessions(property_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_captain_runtime_sessions_idempotency
  ON captain_runtime_sessions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS captain_interactions (
  interaction_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES captain_runtime_sessions(session_id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  input_text TEXT NOT NULL,
  input_type TEXT NOT NULL,
  intent TEXT NOT NULL,
  subtype TEXT,
  timestamp TEXT NOT NULL,
  classification_confidence REAL NOT NULL CHECK (classification_confidence >= 0 AND classification_confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_captain_interactions_session
  ON captain_interactions(session_id, timestamp ASC);

CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_sessions_immutable
  BEFORE UPDATE ON captain_runtime_sessions
  BEGIN
    SELECT RAISE(ABORT, 'Captain runtime sessions are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_sessions_no_delete
  BEFORE DELETE ON captain_runtime_sessions
  BEGIN
    SELECT RAISE(ABORT, 'Captain runtime sessions cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_interactions_immutable
  BEFORE UPDATE ON captain_interactions
  BEGIN
    SELECT RAISE(ABORT, 'Captain interactions are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_interactions_no_delete
  BEFORE DELETE ON captain_interactions
  BEGIN
    SELECT RAISE(ABORT, 'Captain interactions cannot be deleted.');
  END;

CREATE TABLE IF NOT EXISTS captain_evidence_packets (
  evidence_packet_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  included_sources_json TEXT NOT NULL,
  freshness_state_json TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  directive_snapshot_id TEXT,
  evidence_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captain_evidence_packets_property
  ON captain_evidence_packets(property_id, generated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_captain_evidence_packets_immutable
  BEFORE UPDATE ON captain_evidence_packets
  BEGIN
    SELECT RAISE(ABORT, 'Captain evidence packets are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_evidence_packets_no_delete
  BEFORE DELETE ON captain_evidence_packets
  BEGIN
    SELECT RAISE(ABORT, 'Captain evidence packets cannot be deleted.');
  END;

CREATE TABLE IF NOT EXISTS captain_reasoning_requests (
  request_id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL REFERENCES captain_interactions(interaction_id) ON DELETE CASCADE,
  allowed_outputs_json TEXT NOT NULL,
  blocked_outputs_json TEXT NOT NULL,
  authority_level TEXT NOT NULL,
  runtime_mode TEXT NOT NULL,
  directive_snapshot_json TEXT NOT NULL,
  evidence_packet_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captain_reasoning_responses (
  response_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES captain_reasoning_requests(request_id) ON DELETE CASCADE,
  conversational_response TEXT NOT NULL,
  reasoning_summary TEXT NOT NULL,
  structured_outputs_json TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  publishability TEXT NOT NULL,
  escalation_required INTEGER NOT NULL CHECK (escalation_required IN (0, 1)),
  response_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captain_memory_candidates (
  memory_candidate_id TEXT PRIMARY KEY,
  source_interaction_id TEXT NOT NULL REFERENCES captain_interactions(interaction_id) ON DELETE CASCADE,
  candidate_type TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  verification_required INTEGER NOT NULL CHECK (verification_required IN (0, 1)),
  promotion_state TEXT NOT NULL CHECK (promotion_state IN ('candidate', 'verified', 'promoted', 'rejected', 'expired')),
  expires_at TEXT,
  conflict_state TEXT NOT NULL DEFAULT 'none' CHECK (conflict_state IN ('none', 'possible_conflict', 'conflict')),
  source_evidence_hash TEXT NOT NULL DEFAULT '',
  duplicate_signature TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_captain_memory_candidates_duplicate
  ON captain_memory_candidates(source_interaction_id, candidate_type, duplicate_signature)
  WHERE duplicate_signature IS NOT NULL;

CREATE TABLE IF NOT EXISTS captain_routing_decisions (
  routing_id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL REFERENCES captain_interactions(interaction_id) ON DELETE CASCADE,
  target_lane TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'routed', 'blocked', 'completed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captain_runtime_audit_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  interaction_id TEXT,
  timestamp TEXT NOT NULL,
  before_state_json TEXT,
  after_state_json TEXT,
  request_id TEXT,
  correlation_id TEXT,
  evidence_hash TEXT,
  directive_hash TEXT,
  response_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_captain_runtime_audit_interaction
  ON captain_runtime_audit_events(interaction_id, timestamp ASC);

CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_requests_immutable
  BEFORE UPDATE ON captain_reasoning_requests
  BEGIN
    SELECT RAISE(ABORT, 'Captain reasoning requests are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_requests_no_delete
  BEFORE DELETE ON captain_reasoning_requests
  BEGIN
    SELECT RAISE(ABORT, 'Captain reasoning requests cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_responses_immutable
  BEFORE UPDATE ON captain_reasoning_responses
  BEGIN
    SELECT RAISE(ABORT, 'Captain reasoning responses are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_responses_no_delete
  BEFORE DELETE ON captain_reasoning_responses
  BEGIN
    SELECT RAISE(ABORT, 'Captain reasoning responses cannot be deleted.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_audit_events_immutable
  BEFORE UPDATE ON captain_runtime_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Captain runtime audit events are immutable.');
  END;

CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_audit_events_no_delete
  BEFORE DELETE ON captain_runtime_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Captain runtime audit events cannot be deleted.');
  END;
