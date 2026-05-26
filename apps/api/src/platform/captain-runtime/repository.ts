import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { canonicalJson, sha256Hex } from "../directives/hashing";
import type {
  CaptainAuditEvent,
  CaptainEvidencePacket,
  CaptainInteraction,
  CaptainMemoryCandidate,
  CaptainReasoningRequest,
  CaptainReasoningResponse,
  CaptainRoutingDecision,
  CaptainRuntimeSession,
} from "./types";

export async function ensureCaptainRuntimeOrchestrationTables(db: D1Database): Promise<void> {
  await run(db, `CREATE TABLE IF NOT EXISTS captain_runtime_sessions (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_runtime_sessions_property ON captain_runtime_sessions(property_id, started_at DESC)`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_captain_runtime_sessions_idempotency ON captain_runtime_sessions(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_interactions (
    interaction_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES captain_runtime_sessions(session_id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    input_text TEXT NOT NULL,
    input_type TEXT NOT NULL,
    intent TEXT NOT NULL,
    subtype TEXT,
    timestamp TEXT NOT NULL,
    classification_confidence REAL NOT NULL CHECK (classification_confidence >= 0 AND classification_confidence <= 1)
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_interactions_session ON captain_interactions(session_id, timestamp ASC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_evidence_packets (
    evidence_packet_id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    included_sources_json TEXT NOT NULL,
    freshness_state_json TEXT NOT NULL,
    evidence_hash TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    directive_snapshot_id TEXT,
    evidence_json TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_evidence_packets_property ON captain_evidence_packets(property_id, generated_at DESC)`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_evidence_packets_immutable
    BEFORE UPDATE ON captain_evidence_packets
    BEGIN
      SELECT RAISE(ABORT, 'Captain evidence packets are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_evidence_packets_no_delete
    BEFORE DELETE ON captain_evidence_packets
    BEGIN
      SELECT RAISE(ABORT, 'Captain evidence packets cannot be deleted.');
    END`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_reasoning_requests (
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
  )`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_reasoning_responses (
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
  )`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_memory_candidates (
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
  )`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_captain_memory_candidates_duplicate ON captain_memory_candidates(source_interaction_id, candidate_type, duplicate_signature) WHERE duplicate_signature IS NOT NULL`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_routing_decisions (
    routing_id TEXT PRIMARY KEY,
    interaction_id TEXT NOT NULL REFERENCES captain_interactions(interaction_id) ON DELETE CASCADE,
    target_lane TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'routed', 'blocked', 'completed')),
    created_at TEXT NOT NULL
  )`);

  await run(db, `CREATE TABLE IF NOT EXISTS captain_runtime_audit_events (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_runtime_audit_interaction ON captain_runtime_audit_events(interaction_id, timestamp ASC)`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_sessions_immutable
    BEFORE UPDATE ON captain_runtime_sessions
    BEGIN
      SELECT RAISE(ABORT, 'Captain runtime sessions are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_sessions_no_delete
    BEFORE DELETE ON captain_runtime_sessions
    BEGIN
      SELECT RAISE(ABORT, 'Captain runtime sessions cannot be deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_interactions_immutable
    BEFORE UPDATE ON captain_interactions
    BEGIN
      SELECT RAISE(ABORT, 'Captain interactions are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_interactions_no_delete
    BEFORE DELETE ON captain_interactions
    BEGIN
      SELECT RAISE(ABORT, 'Captain interactions cannot be deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_requests_immutable
    BEFORE UPDATE ON captain_reasoning_requests
    BEGIN
      SELECT RAISE(ABORT, 'Captain reasoning requests are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_requests_no_delete
    BEFORE DELETE ON captain_reasoning_requests
    BEGIN
      SELECT RAISE(ABORT, 'Captain reasoning requests cannot be deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_responses_immutable
    BEFORE UPDATE ON captain_reasoning_responses
    BEGIN
      SELECT RAISE(ABORT, 'Captain reasoning responses are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_reasoning_responses_no_delete
    BEFORE DELETE ON captain_reasoning_responses
    BEGIN
      SELECT RAISE(ABORT, 'Captain reasoning responses cannot be deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_audit_events_immutable
    BEFORE UPDATE ON captain_runtime_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Captain runtime audit events are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_captain_runtime_audit_events_no_delete
    BEFORE DELETE ON captain_runtime_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Captain runtime audit events cannot be deleted.');
    END`);
}

export async function findCommunityForRuntime(db: D1Database, propertyRef: string) {
  return queryFirst<{
    id: string;
    name: string;
    encasa_property_code: string | null;
    external_key: string | null;
    ga4_property_id: string | null;
    region: string | null;
    full_url: string | null;
    unit_count: number | null;
  }>(
    db,
    `SELECT id, name, encasa_property_code, external_key, ga4_property_id, region, full_url, unit_count
     FROM communities
     WHERE id = ?
        OR encasa_property_code = ?
        OR external_key = ?
        OR ga4_property_id = ?
        OR lower(name) = lower(?)
     LIMIT 1`,
    [propertyRef, propertyRef, propertyRef, propertyRef, propertyRef]
  );
}

export async function insertRuntimeSession(
  db: D1Database,
  input: Omit<CaptainRuntimeSession, "runtime_hash"> & { correlation_id?: string | null; idempotency_key?: string | null }
): Promise<CaptainRuntimeSession> {
  const runtime_hash = await sha256Hex(input);
  const session = { ...input, runtime_hash };
  await run(
    db,
    `INSERT INTO captain_runtime_sessions (
      session_id, property_id, user_id, runtime_mode, started_at, ended_at,
      active_directive_snapshot_json, runtime_hash, correlation_id, idempotency_key, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.session_id,
      session.property_id,
      session.user_id,
      session.runtime_mode,
      session.started_at,
      session.ended_at,
      session.active_directive_snapshot ? canonicalJson(session.active_directive_snapshot) : null,
      session.runtime_hash,
      input.correlation_id ?? null,
      input.idempotency_key ?? null,
      nowISO(),
    ]
  );
  return session;
}

export async function insertInteraction(db: D1Database, interaction: CaptainInteraction): Promise<void> {
  await run(
    db,
    `INSERT INTO captain_interactions (
      interaction_id, session_id, actor, input_text, input_type, intent, subtype, timestamp, classification_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      interaction.interaction_id,
      interaction.session_id,
      interaction.actor,
      interaction.input_text,
      interaction.input_type,
      interaction.intent,
      interaction.subtype,
      interaction.timestamp,
      interaction.classification_confidence,
    ]
  );
}

export async function insertEvidencePacket(db: D1Database, packet: CaptainEvidencePacket): Promise<void> {
  await run(
    db,
    `INSERT INTO captain_evidence_packets (
      evidence_packet_id, property_id, included_sources_json, freshness_state_json,
      evidence_hash, generated_at, directive_snapshot_id, evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      packet.evidence_packet_id,
      packet.property_id,
      JSON.stringify(packet.included_sources),
      canonicalJson(packet.freshness_state),
      packet.evidence_hash,
      packet.generated_at,
      packet.directive_snapshot_id,
      canonicalJson(packet.evidence),
    ]
  );
}

export async function insertReasoningRequest(
  db: D1Database,
  request: CaptainReasoningRequest,
  payload: Record<string, unknown>
): Promise<string> {
  const payloadHash = await sha256Hex(payload);
  await run(
    db,
    `INSERT INTO captain_reasoning_requests (
      request_id, interaction_id, allowed_outputs_json, blocked_outputs_json, authority_level,
      runtime_mode, directive_snapshot_json, evidence_packet_hash, payload_json, payload_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.request_id,
      request.interaction_id,
      JSON.stringify(request.allowed_outputs),
      JSON.stringify(request.blocked_outputs),
      request.authority_level,
      request.runtime_mode,
      canonicalJson(request.directive_snapshot),
      request.evidence_packet_hash,
      canonicalJson(payload),
      payloadHash,
      nowISO(),
    ]
  );
  return payloadHash;
}

export async function insertReasoningResponse(db: D1Database, response: CaptainReasoningResponse): Promise<string> {
  const responseHash = await sha256Hex(response);
  await run(
    db,
    `INSERT INTO captain_reasoning_responses (
      response_id, request_id, conversational_response, reasoning_summary, structured_outputs_json,
      confidence, publishability, escalation_required, response_hash, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      response.response_id,
      response.request_id,
      response.conversational_response,
      response.reasoning_summary,
      canonicalJson(response.structured_outputs),
      response.confidence,
      response.publishability,
      response.escalation_required ? 1 : 0,
      responseHash,
      response.generated_at,
    ]
  );
  return responseHash;
}

export async function insertMemoryCandidates(db: D1Database, candidates: CaptainMemoryCandidate[], payloads: Record<string, unknown>[]): Promise<void> {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    await run(
      db,
      `INSERT INTO captain_memory_candidates (
        memory_candidate_id, source_interaction_id, candidate_type, confidence,
        verification_required, promotion_state, expires_at, conflict_state, source_evidence_hash,
        duplicate_signature, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        candidate.memory_candidate_id,
        candidate.source_interaction_id,
        candidate.candidate_type,
        candidate.confidence,
        candidate.verification_required ? 1 : 0,
        candidate.promotion_state,
        candidate.expires_at,
        candidate.conflict_state,
        candidate.source_evidence_hash,
        await sha256Hex({ source_interaction_id: candidate.source_interaction_id, candidate_type: candidate.candidate_type, payload: payloads[index] ?? {} }),
        canonicalJson(payloads[index] ?? {}),
        nowISO(),
      ]
    );
  }
}

export async function insertRoutingDecisions(db: D1Database, decisions: CaptainRoutingDecision[]): Promise<void> {
  for (const decision of decisions) {
    await run(
      db,
      `INSERT INTO captain_routing_decisions (routing_id, interaction_id, target_lane, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [decision.routing_id, decision.interaction_id, decision.target_lane, decision.reason, decision.status, nowISO()]
    );
  }
}

export async function writeCaptainRuntimeAuditEvent(
  db: D1Database,
  event: Omit<CaptainAuditEvent, "event_id" | "timestamp"> & {
    request_id?: string | null;
    correlation_id?: string | null;
    evidence_hash?: string | null;
    directive_hash?: string | null;
    response_hash?: string | null;
  }
): Promise<void> {
  await run(
    db,
    `INSERT INTO captain_runtime_audit_events (
      event_id, event_type, actor, interaction_id, timestamp, before_state_json, after_state_json,
      request_id, correlation_id, evidence_hash, directive_hash, response_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `captain_runtime_audit_${newId()}`,
      event.event_type,
      event.actor,
      event.interaction_id,
      nowISO(),
      event.before_state === undefined ? null : canonicalJson(event.before_state),
      event.after_state === undefined ? null : canonicalJson(event.after_state),
      event.request_id ?? null,
      event.correlation_id ?? null,
      event.evidence_hash ?? null,
      event.directive_hash ?? null,
      event.response_hash ?? null,
    ]
  );
}

export async function getCaptainRuntimeHistory(db: D1Database, propertyRef: string, limit = 20): Promise<Array<Record<string, unknown>>> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  const property = await findCommunityForRuntime(db, propertyRef);
  if (!property) return [];
  const propertyCode = property.encasa_property_code ?? property.id;
  const rows = await queryAll<Record<string, unknown>>(
    db,
    `SELECT
       s.session_id,
       s.property_id,
       s.user_id,
       s.runtime_mode,
       s.started_at,
       s.runtime_hash,
       s.correlation_id,
       s.active_directive_snapshot_json,
       i.interaction_id,
       i.actor,
       i.input_text,
       i.input_type,
       i.intent,
       i.subtype,
       i.timestamp,
       i.classification_confidence,
       rr.request_id,
       rr.authority_level,
       rr.evidence_packet_hash,
       rr.payload_hash,
       rs.response_id,
       rs.conversational_response,
       rs.reasoning_summary,
       rs.structured_outputs_json,
       rs.confidence,
       rs.publishability,
       rs.escalation_required,
       rs.response_hash,
       rs.generated_at
     FROM captain_runtime_sessions s
     JOIN captain_interactions i ON i.session_id = s.session_id
     LEFT JOIN captain_reasoning_requests rr ON rr.interaction_id = i.interaction_id
     LEFT JOIN captain_reasoning_responses rs ON rs.request_id = rr.request_id
     WHERE s.property_id = ?
     ORDER BY i.timestamp DESC
     LIMIT ?`,
    [propertyCode, limit]
  );
  return rows.map((row) => ({
    session_id: row.session_id,
    interaction_id: row.interaction_id,
    property_id: row.property_id,
    user_id: row.user_id,
    actor: row.actor,
    input_text: row.input_text,
    input_type: row.input_type,
    intent: row.intent,
    subtype: row.subtype,
    timestamp: row.timestamp,
    classification_confidence: row.classification_confidence,
    runtime_mode: row.runtime_mode,
    runtime_hash: row.runtime_hash,
    correlation_id: row.correlation_id,
    directive_snapshot: safeJson(row.active_directive_snapshot_json),
    request_id: row.request_id,
    authority_level: row.authority_level,
    evidence_packet_hash: row.evidence_packet_hash,
    payload_hash: row.payload_hash,
    response_id: row.response_id,
    conversational_response: row.conversational_response,
    reasoning_summary: row.reasoning_summary,
    structured_outputs: safeJson(row.structured_outputs_json),
    confidence: row.confidence,
    publishability: row.publishability,
    escalation_required: Boolean(row.escalation_required),
    response_hash: row.response_hash,
    generated_at: row.generated_at,
  }));
}

export async function getCaptainRuntimeEvidencePackets(db: D1Database, propertyRef: string, limit = 8): Promise<Array<Record<string, unknown>>> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  const property = await findCommunityForRuntime(db, propertyRef);
  if (!property) return [];
  const propertyCode = property.encasa_property_code ?? property.id;
  const rows = await queryAll<Record<string, unknown>>(
    db,
    `SELECT evidence_packet_id, property_id, included_sources_json, freshness_state_json,
            evidence_hash, generated_at, directive_snapshot_id, evidence_json
     FROM captain_evidence_packets
     WHERE property_id = ?
     ORDER BY generated_at DESC
     LIMIT ?`,
    [propertyCode, limit]
  );
  return rows.map((row) => ({
    evidence_packet_id: row.evidence_packet_id,
    property_id: row.property_id,
    included_sources: safeJson(row.included_sources_json) ?? [],
    freshness_state: safeJson(row.freshness_state_json) ?? {},
    evidence_hash: row.evidence_hash,
    generated_at: row.generated_at,
    directive_snapshot_id: row.directive_snapshot_id,
    evidence: safeJson(row.evidence_json) ?? [],
  }));
}

export async function getCaptainMemoryCandidates(db: D1Database, propertyRef: string, limit = 20): Promise<Array<Record<string, unknown>>> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  const property = await findCommunityForRuntime(db, propertyRef);
  if (!property) return [];
  const propertyCode = property.encasa_property_code ?? property.id;
  const rows = await queryAll<Record<string, unknown>>(
    db,
    `SELECT
       m.memory_candidate_id,
       m.source_interaction_id,
       m.candidate_type,
       m.confidence,
       m.verification_required,
       m.promotion_state,
       m.expires_at,
       m.conflict_state,
       m.source_evidence_hash,
       m.payload_json,
       m.created_at,
       i.intent,
       i.timestamp,
       s.property_id
     FROM captain_memory_candidates m
     JOIN captain_interactions i ON i.interaction_id = m.source_interaction_id
     JOIN captain_runtime_sessions s ON s.session_id = i.session_id
     WHERE s.property_id = ?
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [propertyCode, limit]
  );
  return rows.map((row) => ({
    memory_candidate_id: row.memory_candidate_id,
    source_interaction_id: row.source_interaction_id,
    candidate_type: row.candidate_type,
    confidence: row.confidence,
    verification_required: Boolean(row.verification_required),
    promotion_state: row.promotion_state,
    expires_at: row.expires_at,
    conflict_state: row.conflict_state,
    source_evidence_hash: row.source_evidence_hash,
    payload: safeJson(row.payload_json),
    created_at: row.created_at,
    source_intent: row.intent,
    source_timestamp: row.timestamp,
  }));
}

export async function getCaptainOfficeState(db: D1Database, propertyRef: string): Promise<Record<string, unknown> | null> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  const property = await findCommunityForRuntime(db, propertyRef);
  if (!property) return null;
  const propertyCode = property.encasa_property_code ?? property.id;
  const [history, evidencePackets, memoryCandidates, watchItems, actions, audits] = await Promise.all([
    getCaptainRuntimeHistory(db, propertyCode, 10),
    getCaptainRuntimeEvidencePackets(db, propertyCode, 5),
    getCaptainMemoryCandidates(db, propertyCode, 10),
    recentRows(
      db,
      `SELECT * FROM captain_watch_items
       WHERE property_id = ? AND status IN ('open', 'monitoring', 'escalated')
       ORDER BY updated_at DESC LIMIT 10`,
      [propertyCode]
    ),
    recentRows(
      db,
      `SELECT * FROM captain_actions
       WHERE property_id = ? AND status NOT IN ('completed', 'resolved')
       ORDER BY updated_at DESC LIMIT 10`,
      [propertyCode]
    ),
    recentRows(
      db,
      `SELECT a.*
       FROM captain_runtime_audit_events a
       JOIN captain_interactions i ON i.interaction_id = a.interaction_id
       JOIN captain_runtime_sessions s ON s.session_id = i.session_id
       WHERE s.property_id = ?
       ORDER BY a.timestamp DESC LIMIT 20`,
      [propertyCode]
    ),
  ]);
  const latest = history[0] ?? null;
  return {
    property: { ...property, property_code: propertyCode },
    runtime_status: {
      latest_runtime_mode: latest?.runtime_mode ?? null,
      latest_authority_level: latest?.authority_level ?? null,
      latest_confidence: latest?.confidence ?? null,
      latest_publishability: latest?.publishability ?? null,
      latest_escalation_required: latest?.escalation_required ?? false,
      directive_snapshot: latest?.directive_snapshot ?? null,
      evidence_packet_hash: latest?.evidence_packet_hash ?? null,
      runtime_hash: latest?.runtime_hash ?? null,
      response_hash: latest?.response_hash ?? null,
      last_interaction_at: latest?.timestamp ?? null,
    },
    history,
    evidence_packets: evidencePackets,
    memory_candidates: memoryCandidates,
    watch_items: watchItems,
    actions,
    audit_events: audits,
    alerts: deriveCaptainOfficeAlerts({ latest, evidencePackets, memoryCandidates, watchItems, actions }),
  };
}

function deriveCaptainOfficeAlerts(input: {
  latest: Record<string, unknown> | null;
  evidencePackets: Array<Record<string, unknown>>;
  memoryCandidates: Array<Record<string, unknown>>;
  watchItems: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  const alerts: Array<Record<string, unknown>> = [];
  if (input.latest?.publishability === "blocked") {
    alerts.push({ severity: "block", title: "Publishability blocked", detail: "The latest runtime response cannot be used as publishable material until governance blockers clear." });
  }
  if (input.latest?.escalation_required) {
    alerts.push({ severity: "warn", title: "Escalation required", detail: "The latest runtime pass produced an escalation state." });
  }
  const latestPacket = input.evidencePackets[0];
  const freshness = latestPacket?.freshness_state as Record<string, unknown> | undefined;
  if (freshness?.packet_state === "needs_review" || freshness?.packet_state === "blocked") {
    alerts.push({ severity: "warn", title: "Evidence needs review", detail: `Latest packet state is ${String(freshness.packet_state).replace(/_/g, " ")}.` });
  }
  const expiring = input.memoryCandidates.filter((candidate) => {
    const expires = String(candidate.expires_at ?? "");
    if (!expires) return false;
    const age = Date.parse(expires) - Date.now();
    return Number.isFinite(age) && age < 7 * 86_400_000;
  }).length;
  if (expiring > 0) {
    alerts.push({ severity: "warn", title: "Memory candidates need review", detail: `${expiring} candidate memory item(s) expire within 7 days.` });
  }
  if (input.watchItems.length > 0) {
    alerts.push({ severity: "info", title: "Active watch items", detail: `${input.watchItems.length} watch item(s) remain open for this property.` });
  }
  if (input.actions.length > 0) {
    alerts.push({ severity: "info", title: "Open action routing", detail: `${input.actions.length} action(s) remain open for follow-through.` });
  }
  return alerts;
}

export async function recentRows(db: D1Database, sql: string, params: unknown[] = []) {
  try {
    return await queryAll<Record<string, unknown>>(db, sql, params);
  } catch {
    return [];
  }
}

function safeJson(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
