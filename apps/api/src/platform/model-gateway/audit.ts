import { queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { canonicalJson } from "../directives/hashing";
import type { ModelGatewayAuditEvent, ModelGatewayPayload, ModelGatewayRequest, ModelGatewayResponse, ModelGatewayShadowResultRecord, ModelGatewaySourceSystem } from "./types";

export async function ensureModelGatewayTables(db: D1Database): Promise<void> {
  await run(db, `CREATE TABLE IF NOT EXISTS model_gateway_requests (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_source_date ON model_gateway_requests(source_system, requested_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_property_date ON model_gateway_requests(property_id, requested_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_actor_date ON model_gateway_requests(actor_id, requested_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_requests_runtime_date ON model_gateway_requests(source_runtime_id, requested_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS model_gateway_payloads (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_payloads_request ON model_gateway_payloads(request_id)`);

  await run(db, `CREATE TABLE IF NOT EXISTS model_gateway_responses (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_responses_request ON model_gateway_responses(request_id)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_responses_generated ON model_gateway_responses(generated_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS model_gateway_audit_events (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_audit_request ON model_gateway_audit_events(request_id, timestamp ASC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_audit_property ON model_gateway_audit_events(property_id, timestamp DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_audit_correlation ON model_gateway_audit_events(correlation_id, timestamp DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS model_gateway_shadow_results (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_shadow_request ON model_gateway_shadow_results(gateway_request_id, created_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_model_gateway_shadow_provider ON model_gateway_shadow_results(provider, model_id, created_at DESC)`);

  for (const table of ["model_gateway_requests", "model_gateway_payloads", "model_gateway_responses", "model_gateway_audit_events", "model_gateway_shadow_results"]) {
    await run(db, `CREATE TRIGGER IF NOT EXISTS trg_${table}_no_delete
      BEFORE DELETE ON ${table}
      BEGIN
        SELECT RAISE(ABORT, '${table} cannot be deleted.');
      END`);
  }
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_model_gateway_requests_immutable
    BEFORE UPDATE ON model_gateway_requests
    BEGIN
      SELECT RAISE(ABORT, 'Model gateway requests are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_model_gateway_payloads_immutable
    BEFORE UPDATE ON model_gateway_payloads
    BEGIN
      SELECT RAISE(ABORT, 'Model gateway payloads are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_model_gateway_responses_immutable
    BEFORE UPDATE ON model_gateway_responses
    BEGIN
      SELECT RAISE(ABORT, 'Model gateway responses are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_model_gateway_audit_immutable
    BEFORE UPDATE ON model_gateway_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Model gateway audit events are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_model_gateway_shadow_results_immutable
    BEFORE UPDATE ON model_gateway_shadow_results
    BEGIN
      SELECT RAISE(ABORT, 'Model gateway shadow results are immutable.');
    END`);
}

export async function insertModelGatewayRequest(db: D1Database, request: ModelGatewayRequest): Promise<void> {
  await run(
    db,
    `INSERT INTO model_gateway_requests (
      request_id, correlation_id, source_system, source_runtime_id, source_interaction_id, expert_read_request_id,
      property_id, region_id, actor_id, runtime_mode, directive_snapshot_id, directive_snapshot_hash,
      evidence_packet_id, evidence_packet_hash, awareness_context_hash, payload_hash, provider_route, adapter_id,
      model_id, call_mode, allowed_output_contract, blocked_outputs_json, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.request_id,
      request.correlation_id,
      request.source_system,
      request.source_runtime_id,
      request.source_interaction_id,
      request.expert_read_request_id,
      request.property_id,
      request.region_id,
      request.actor_id,
      request.runtime_mode,
      request.directive_snapshot_id,
      request.directive_snapshot_hash,
      request.evidence_packet_id,
      request.evidence_packet_hash,
      request.awareness_context_hash,
      request.payload_hash,
      request.provider_route,
      request.adapter_id,
      request.model_id,
      request.call_mode,
      request.allowed_output_contract,
      canonicalJson(request.blocked_outputs),
      request.requested_at,
    ],
  );
}

export async function insertModelGatewayPayload(db: D1Database, payload: ModelGatewayPayload, redactedPayloadHash: string): Promise<void> {
  await run(
    db,
    `INSERT INTO model_gateway_payloads (
      payload_id, request_id, system_instructions_json, runtime_context_json, evidence_summary_json,
      awareness_summary_json, directive_summary_json, output_schema_json, redaction_summary_json,
      payload_hash, redacted_payload_hash, estimated_tokens, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.payload_id,
      payload.request_id,
      canonicalJson(payload.system_instructions),
      canonicalJson(payload.runtime_context),
      canonicalJson(payload.evidence_summary),
      canonicalJson(payload.awareness_summary),
      canonicalJson(payload.directive_summary),
      canonicalJson(payload.output_schema),
      canonicalJson(payload.redaction_summary),
      payload.payload_hash,
      redactedPayloadHash,
      payload.estimated_tokens,
      payload.created_at,
    ],
  );
}

export async function insertModelGatewayResponse(
  db: D1Database,
  response: ModelGatewayResponse & { fallback_used: boolean; call_mode: string },
): Promise<void> {
  await run(
    db,
    `INSERT INTO model_gateway_responses (
      response_id, request_id, adapter_id, provider, model_id, model_version, route_name, route_version,
      raw_response_hash, normalized_response_hash, structured_output_json, validation_status, governance_status,
      token_usage_json, cost_estimate, latency_ms, provider_request_id, generated_at, fallback_used, call_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      response.response_id,
      response.request_id,
      response.adapter_id,
      response.provider,
      response.model_id,
      response.model_version,
      response.route_name,
      response.route_version,
      response.raw_response_hash,
      response.normalized_response_hash,
      canonicalJson(response.structured_output),
      response.validation_status,
      response.governance_status,
      canonicalJson(response.token_usage),
      response.cost_estimate,
      response.latency_ms,
      response.provider_request_id,
      response.generated_at,
      response.fallback_used ? 1 : 0,
      response.call_mode,
    ],
  );
}

export async function writeModelGatewayAuditEvent(
  db: D1Database,
  input: Omit<ModelGatewayAuditEvent, "event_id" | "timestamp"> & {
    event_id?: string;
    timestamp?: string;
    directive_snapshot_id?: string | null;
    directive_snapshot_hash?: string | null;
    evidence_packet_id?: string | null;
    evidence_packet_hash?: string | null;
    payload_hash?: string | null;
    redacted_payload_hash?: string | null;
    provider?: string | null;
    model_id?: string | null;
    route_name?: string | null;
    route_version?: string | null;
    token_usage?: Record<string, number | null> | null;
    cost_estimate?: number | null;
    latency_ms?: number | null;
    validation_status?: string | null;
    governance_status?: string | null;
  },
): Promise<ModelGatewayAuditEvent> {
  const event: ModelGatewayAuditEvent = {
    event_id: input.event_id ?? `model_gateway_event_${newId()}`,
    event_type: input.event_type,
    request_id: input.request_id ?? null,
    response_id: input.response_id ?? null,
    actor_id: input.actor_id ?? null,
    property_id: input.property_id ?? null,
    region_id: input.region_id ?? null,
    source_system: input.source_system,
    adapter_id: input.adapter_id ?? null,
    call_mode: input.call_mode,
    decision: input.decision,
    reason: input.reason,
    before_state: input.before_state ?? null,
    after_state: input.after_state ?? null,
    timestamp: input.timestamp ?? nowISO(),
    correlation_id: input.correlation_id ?? null,
  };
  await run(
    db,
    `INSERT INTO model_gateway_audit_events (
      event_id, event_type, request_id, response_id, actor_id, property_id, region_id, source_system,
      adapter_id, call_mode, decision, reason, before_state_json, after_state_json, correlation_id,
      directive_snapshot_id, directive_snapshot_hash, evidence_packet_id, evidence_packet_hash, payload_hash,
      redacted_payload_hash, provider, model_id, route_name, route_version, token_usage_json, cost_estimate,
      latency_ms, validation_status, governance_status, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.event_id,
      event.event_type,
      event.request_id,
      event.response_id,
      event.actor_id,
      event.property_id,
      event.region_id,
      event.source_system,
      event.adapter_id,
      event.call_mode,
      event.decision,
      event.reason,
      event.before_state == null ? null : canonicalJson(event.before_state),
      event.after_state == null ? null : canonicalJson(event.after_state),
      event.correlation_id,
      input.directive_snapshot_id ?? null,
      input.directive_snapshot_hash ?? null,
      input.evidence_packet_id ?? null,
      input.evidence_packet_hash ?? null,
      input.payload_hash ?? null,
      input.redacted_payload_hash ?? null,
      input.provider ?? null,
      input.model_id ?? null,
      input.route_name ?? null,
      input.route_version ?? null,
      input.token_usage ? canonicalJson(input.token_usage) : null,
      input.cost_estimate ?? null,
      input.latency_ms ?? null,
      input.validation_status ?? null,
      input.governance_status ?? null,
      event.timestamp,
    ],
  );
  return event;
}

export async function insertModelGatewayShadowResult(db: D1Database, result: ModelGatewayShadowResultRecord): Promise<void> {
  await run(
    db,
    `INSERT INTO model_gateway_shadow_results (
      shadow_result_id, gateway_request_id, payload_hash, redacted_payload_hash, output_hash,
      provider, model_id, route_name, route_version, validation_status, governance_status,
      structural_validity, governance_validity, deviation_summary_json, token_usage_json, cost_estimate,
      latency_ms, provider_request_id, error_type, error_message_safe, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.shadow_result_id,
      result.gateway_request_id,
      result.payload_hash,
      result.redacted_payload_hash,
      result.output_hash,
      result.provider,
      result.model_id,
      result.route_name,
      result.route_version,
      result.validation_status,
      result.governance_status,
      result.structural_validity,
      result.governance_validity,
      canonicalJson(result.deviation_summary),
      result.token_usage ? canonicalJson(result.token_usage) : null,
      result.cost_estimate,
      result.latency_ms,
      result.provider_request_id,
      result.error_type,
      result.error_message_safe,
      result.created_at,
    ],
  );
}

export async function getModelGatewayUsageSnapshot(
  db: D1Database,
  input: {
    sourceSystem: ModelGatewaySourceSystem;
    propertyId?: string | null;
    actorId?: string | null;
    sourceRuntimeId?: string | null;
    requestDate: string;
  },
): Promise<{
  sourceSystemCount: number;
  propertyCount: number;
  actorCount: number;
  runtimeSessionCount: number;
}> {
  const dayStart = `${input.requestDate}T00:00:00`;
  const sourceSystemCount = await count(db, `SELECT COUNT(*) AS count FROM model_gateway_requests WHERE source_system = ? AND requested_at >= ?`, [
    input.sourceSystem,
    dayStart,
  ]);
  const propertyCount = input.propertyId
    ? await count(db, `SELECT COUNT(*) AS count FROM model_gateway_requests WHERE property_id = ? AND requested_at >= ?`, [
        input.propertyId,
        dayStart,
      ])
    : 0;
  const actorCount = input.actorId
    ? await count(db, `SELECT COUNT(*) AS count FROM model_gateway_requests WHERE actor_id = ? AND requested_at >= ?`, [input.actorId, dayStart])
    : 0;
  const runtimeSessionCount = input.sourceRuntimeId
    ? await count(db, `SELECT COUNT(*) AS count FROM model_gateway_requests WHERE source_runtime_id = ?`, [input.sourceRuntimeId])
    : 0;
  return { sourceSystemCount, propertyCount, actorCount, runtimeSessionCount };
}

async function count(db: D1Database, sql: string, params: unknown[]): Promise<number> {
  const row = await queryFirst<{ count: number | null }>(db, sql, params);
  return Number(row?.count ?? 0);
}
