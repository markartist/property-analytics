-- Model Provider Gateway foundation.
-- Cloudflare AI Gateway is an infrastructure enhancer only; internal gateway remains the authority boundary.

CREATE TABLE IF NOT EXISTS model_gateway_requests (
  request_id TEXT PRIMARY KEY,
  correlation_id TEXT,
  source_system TEXT NOT NULL CHECK (source_system IN ('captain_runtime', 'expert_reads', 'evaluation', 'simulation')),
  source_runtime_id TEXT,
  source_interaction_id TEXT,
  expert_read_request_id TEXT,
  property_id TEXT,
  region_id TEXT,
  actor_id TEXT,
  runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('monitoring', 'lightweight', 'standard', 'escalated', 'executive', 'simulation')),
  directive_snapshot_id TEXT,
  directive_snapshot_hash TEXT,
  evidence_packet_id TEXT,
  evidence_packet_hash TEXT,
  awareness_context_hash TEXT,
  payload_hash TEXT NOT NULL,
  provider_route TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  model_id TEXT,
  call_mode TEXT NOT NULL CHECK (call_mode IN ('deterministic', 'noop', 'dry_run', 'shadow', 'live')),
  allowed_output_contract TEXT NOT NULL,
  blocked_outputs_json TEXT NOT NULL,
  requested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_source_date ON model_gateway_requests(source_system, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_property_date ON model_gateway_requests(property_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_actor_date ON model_gateway_requests(actor_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_runtime_date ON model_gateway_requests(source_runtime_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS model_gateway_payloads (
  payload_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES model_gateway_requests(request_id) ON DELETE RESTRICT,
  system_instructions_json TEXT NOT NULL,
  runtime_context_json TEXT NOT NULL,
  evidence_summary_json TEXT NOT NULL,
  awareness_summary_json TEXT NOT NULL,
  directive_summary_json TEXT NOT NULL,
  output_schema_json TEXT NOT NULL,
  redaction_summary_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  redacted_payload_hash TEXT NOT NULL,
  estimated_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_gateway_payloads_request ON model_gateway_payloads(request_id);

CREATE TABLE IF NOT EXISTS model_gateway_responses (
  response_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES model_gateway_requests(request_id) ON DELETE RESTRICT,
  adapter_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT,
  model_version TEXT,
  route_name TEXT,
  route_version TEXT,
  raw_response_hash TEXT,
  normalized_response_hash TEXT,
  structured_output_json TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pass', 'fail')),
  governance_status TEXT NOT NULL CHECK (governance_status IN ('pass', 'fail', 'blocked')),
  token_usage_json TEXT NOT NULL,
  cost_estimate REAL,
  latency_ms INTEGER,
  provider_request_id TEXT,
  generated_at TEXT NOT NULL,
  fallback_used INTEGER NOT NULL CHECK (fallback_used IN (0, 1)),
  call_mode TEXT NOT NULL CHECK (call_mode IN ('deterministic', 'noop', 'dry_run', 'shadow', 'live'))
);
CREATE INDEX IF NOT EXISTS idx_model_gateway_responses_request ON model_gateway_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_model_gateway_responses_generated ON model_gateway_responses(generated_at DESC);

CREATE TABLE IF NOT EXISTS model_gateway_audit_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  request_id TEXT,
  response_id TEXT,
  actor_id TEXT,
  property_id TEXT,
  region_id TEXT,
  source_system TEXT NOT NULL CHECK (source_system IN ('captain_runtime', 'expert_reads', 'evaluation', 'simulation')),
  adapter_id TEXT,
  call_mode TEXT NOT NULL CHECK (call_mode IN ('deterministic', 'noop', 'dry_run', 'shadow', 'live')),
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_state_json TEXT,
  after_state_json TEXT,
  correlation_id TEXT,
  directive_snapshot_id TEXT,
  directive_snapshot_hash TEXT,
  evidence_packet_id TEXT,
  evidence_packet_hash TEXT,
  payload_hash TEXT,
  redacted_payload_hash TEXT,
  provider TEXT,
  model_id TEXT,
  route_name TEXT,
  route_version TEXT,
  token_usage_json TEXT,
  cost_estimate REAL,
  latency_ms INTEGER,
  validation_status TEXT,
  governance_status TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_gateway_audit_request ON model_gateway_audit_events(request_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_model_gateway_audit_property ON model_gateway_audit_events(property_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_model_gateway_audit_correlation ON model_gateway_audit_events(correlation_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS model_gateway_shadow_results (
  shadow_result_id TEXT PRIMARY KEY,
  gateway_request_id TEXT NOT NULL REFERENCES model_gateway_requests(request_id) ON DELETE RESTRICT,
  payload_hash TEXT,
  redacted_payload_hash TEXT,
  output_hash TEXT,
  provider TEXT,
  model_id TEXT,
  route_name TEXT,
  route_version TEXT,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pass', 'fail')),
  governance_status TEXT NOT NULL CHECK (governance_status IN ('pass', 'fail', 'blocked')),
  structural_validity REAL NOT NULL,
  governance_validity REAL NOT NULL,
  deviation_summary_json TEXT NOT NULL,
  token_usage_json TEXT,
  cost_estimate REAL,
  latency_ms INTEGER,
  provider_request_id TEXT,
  error_type TEXT,
  error_message_safe TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_gateway_shadow_request ON model_gateway_shadow_results(gateway_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_gateway_shadow_provider ON model_gateway_shadow_results(provider, model_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_model_gateway_requests_immutable
  BEFORE UPDATE ON model_gateway_requests
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway requests are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_requests_no_delete
  BEFORE DELETE ON model_gateway_requests
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway requests cannot be deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_payloads_immutable
  BEFORE UPDATE ON model_gateway_payloads
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway payloads are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_payloads_no_delete
  BEFORE DELETE ON model_gateway_payloads
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway payloads cannot be deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_responses_immutable
  BEFORE UPDATE ON model_gateway_responses
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway responses are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_responses_no_delete
  BEFORE DELETE ON model_gateway_responses
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway responses cannot be deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_audit_immutable
  BEFORE UPDATE ON model_gateway_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway audit events are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_audit_no_delete
  BEFORE DELETE ON model_gateway_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway audit events cannot be deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_shadow_results_immutable
  BEFORE UPDATE ON model_gateway_shadow_results
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway shadow results are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_model_gateway_shadow_results_no_delete
  BEFORE DELETE ON model_gateway_shadow_results
  BEGIN
    SELECT RAISE(ABORT, 'Model gateway shadow results cannot be deleted.');
  END;
