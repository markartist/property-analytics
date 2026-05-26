import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { canonicalJson, sha256Hex } from "../directives/hashing";
import { ensureCaptainRuntimeOrchestrationTables, findCommunityForRuntime } from "../captain-runtime/repository";
import type { CaptainEvidencePacket } from "../captain-runtime/types";
import type { ExpertLaneId, ExpertRead, ExpertReadAuditEvent, ExpertReadFinding, ExpertReadRecommendation, ExpertReadRequest } from "./types";

export async function ensureExpertReadTables(db: D1Database): Promise<void> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  await run(db, `CREATE TABLE IF NOT EXISTS expert_read_requests (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_read_requests_property ON expert_read_requests(property_id, requested_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_read_requests_lane ON expert_read_requests(lane_id, requested_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_read_requests_runtime ON expert_read_requests(source_runtime_id, source_interaction_id)`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_read_requests_hash ON expert_read_requests(request_hash)`);

  await run(db, `CREATE TABLE IF NOT EXISTS expert_reads (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_reads_property ON expert_reads(property_id, generated_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_reads_lane ON expert_reads(lane_id, generated_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_reads_request ON expert_reads(request_id)`);

  await run(db, `CREATE TABLE IF NOT EXISTS expert_read_findings (
    finding_id TEXT PRIMARY KEY,
    expert_read_id TEXT NOT NULL REFERENCES expert_reads(expert_read_id) ON DELETE RESTRICT,
    finding_type TEXT NOT NULL,
    statement TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    freshness TEXT NOT NULL,
    publishability TEXT NOT NULL CHECK (publishability IN ('internal_only', 'needs_verification', 'blocked')),
    verification_required INTEGER NOT NULL CHECK (verification_required IN (0, 1))
  )`);

  await run(db, `CREATE TABLE IF NOT EXISTS expert_read_recommendations (
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
  )`);

  await run(db, `CREATE TABLE IF NOT EXISTS expert_read_audit_events (
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
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_read_audit_request ON expert_read_audit_events(request_id, timestamp ASC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_read_audit_read ON expert_read_audit_events(expert_read_id, timestamp ASC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_expert_read_audit_correlation ON expert_read_audit_events(correlation_id, timestamp ASC)`);

  for (const table of ["expert_read_requests", "expert_reads", "expert_read_findings", "expert_read_recommendations", "expert_read_audit_events"]) {
    await run(db, `CREATE TRIGGER IF NOT EXISTS trg_${table}_no_delete
      BEFORE DELETE ON ${table}
      BEGIN
        SELECT RAISE(ABORT, '${table} cannot be deleted.');
      END`);
  }
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_expert_read_requests_immutable
    BEFORE UPDATE ON expert_read_requests
    BEGIN
      SELECT RAISE(ABORT, 'Expert Read requests are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_expert_reads_final_immutable
    BEFORE UPDATE ON expert_reads
    WHEN OLD.read_status IN ('final', 'blocked', 'failed')
    BEGIN
      SELECT RAISE(ABORT, 'Finalized Expert Reads are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_expert_read_findings_immutable
    BEFORE UPDATE ON expert_read_findings
    BEGIN
      SELECT RAISE(ABORT, 'Expert Read findings are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_expert_read_recommendations_immutable
    BEFORE UPDATE ON expert_read_recommendations
    BEGIN
      SELECT RAISE(ABORT, 'Expert Read recommendations are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_expert_read_audit_immutable
    BEFORE UPDATE ON expert_read_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Expert Read audit events are immutable.');
    END`);
}

export async function getCaptainEvidencePacketById(db: D1Database, evidencePacketId: string): Promise<CaptainEvidencePacket | null> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  const row = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT evidence_packet_id, property_id, included_sources_json, freshness_state_json,
            evidence_hash, generated_at, directive_snapshot_id, evidence_json
     FROM captain_evidence_packets
     WHERE evidence_packet_id = ?
     LIMIT 1`,
    [evidencePacketId]
  );
  if (!row) return null;
  return {
    evidence_packet_id: String(row.evidence_packet_id),
    property_id: String(row.property_id),
    included_sources: safeJson<string[]>(row.included_sources_json) ?? [],
    freshness_state: safeJson<Record<string, unknown>>(row.freshness_state_json) ?? {},
    evidence_hash: String(row.evidence_hash),
    generated_at: String(row.generated_at),
    directive_snapshot_id: row.directive_snapshot_id ? String(row.directive_snapshot_id) : null,
    evidence: safeJson<any[]>(row.evidence_json) ?? [],
  };
}

export async function insertExpertReadRequest(
  db: D1Database,
  request: ExpertReadRequest,
  correlationId: string | null
): Promise<void> {
  await run(
    db,
    `INSERT INTO expert_read_requests (
      request_id, property_id, requested_by, source_runtime_id, source_interaction_id, lane_id,
      runtime_mode, report_family, reason, requested_at, directive_snapshot_id, directive_snapshot_hash,
      evidence_packet_id, evidence_packet_hash, request_hash, correlation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.request_id,
      request.property_id,
      request.requested_by,
      request.source_runtime_id,
      request.source_interaction_id,
      request.lane_id,
      request.runtime_mode,
      request.report_family,
      request.reason,
      request.requested_at,
      request.directive_snapshot_id,
      request.directive_snapshot_hash,
      request.evidence_packet_id,
      request.evidence_packet_hash,
      request.request_hash,
      correlationId,
    ]
  );
}

export async function insertExpertRead(
  db: D1Database,
  read: Omit<ExpertRead, "read_hash">,
  payloadHash: string
): Promise<ExpertRead> {
  const read_hash = await sha256Hex({ ...read, read_hash: undefined });
  const finalRead: ExpertRead = { ...read, read_hash };
  await run(
    db,
    `INSERT INTO expert_reads (
      expert_read_id, request_id, lane_id, property_id, read_status, specialist_summary,
      do_not_do_rules_json, required_evidence_json, evidence_used_json, confidence, freshness_state,
      publishability, escalation_required, conflicts_json, generated_at, read_hash, payload_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      finalRead.expert_read_id,
      finalRead.request_id,
      finalRead.lane_id,
      finalRead.property_id,
      finalRead.read_status,
      finalRead.specialist_summary,
      canonicalJson(finalRead.do_not_do_rules),
      canonicalJson(finalRead.required_evidence),
      canonicalJson(finalRead.evidence_used),
      finalRead.confidence,
      finalRead.freshness_state,
      finalRead.publishability,
      finalRead.escalation_required ? 1 : 0,
      canonicalJson(finalRead.conflicts),
      finalRead.generated_at,
      finalRead.read_hash,
      payloadHash,
    ]
  );
  for (const finding of finalRead.findings) await insertFinding(db, finding);
  for (const recommendation of finalRead.recommendations) await insertRecommendation(db, recommendation);
  return finalRead;
}

export async function getExpertReadById(db: D1Database, expertReadId: string): Promise<Record<string, unknown> | null> {
  await ensureExpertReadTables(db);
  const read = await queryFirst<Record<string, unknown>>(db, `SELECT * FROM expert_reads WHERE expert_read_id = ? LIMIT 1`, [expertReadId]);
  if (!read) return null;
  return hydrateRead(db, read);
}

export async function getExpertReadByRequestHash(db: D1Database, requestHash: string): Promise<Record<string, unknown> | null> {
  await ensureExpertReadTables(db);
  const read = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT r.*
     FROM expert_reads r
     JOIN expert_read_requests q ON q.request_id = r.request_id
     WHERE q.request_hash = ?
     ORDER BY r.generated_at DESC
     LIMIT 1`,
    [requestHash]
  );
  if (!read) return null;
  return hydrateRead(db, read);
}

export async function getExpertReadsForProperty(db: D1Database, propertyRef: string, laneId?: ExpertLaneId | null, limit = 25): Promise<Array<Record<string, unknown>>> {
  await ensureExpertReadTables(db);
  const property = await findCommunityForRuntime(db, propertyRef);
  if (!property) return [];
  const propertyId = property.encasa_property_code ?? property.id;
  const rows = await queryAll<Record<string, unknown>>(
    db,
    laneId
      ? `SELECT * FROM expert_reads WHERE property_id = ? AND lane_id = ? ORDER BY generated_at DESC LIMIT ?`
      : `SELECT * FROM expert_reads WHERE property_id = ? ORDER BY generated_at DESC LIMIT ?`,
    laneId ? [propertyId, laneId, limit] : [propertyId, limit]
  );
  return Promise.all(rows.map((row) => hydrateRead(db, row)));
}

export async function assertSourceRuntimeLineage(
  db: D1Database,
  input: { property_id: string; source_runtime_id?: string | null; source_interaction_id?: string | null }
): Promise<void> {
  if (!input.source_runtime_id && !input.source_interaction_id) return;
  const row = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT s.session_id, s.property_id, i.interaction_id
     FROM captain_runtime_sessions s
     LEFT JOIN captain_interactions i ON i.session_id = s.session_id
     WHERE (? IS NULL OR s.session_id = ?)
       AND (? IS NULL OR i.interaction_id = ?)
     LIMIT 1`,
    [
      input.source_runtime_id ?? null,
      input.source_runtime_id ?? null,
      input.source_interaction_id ?? null,
      input.source_interaction_id ?? null,
    ]
  );
  if (!row) throw new Error("Source Captain Runtime lineage was not found.");
  if (String(row.property_id) !== input.property_id) {
    throw new Error(`Source Captain Runtime property ${String(row.property_id)} does not match Expert Read property ${input.property_id}.`);
  }
}

export async function assertExpertReadScribeConsumable(db: D1Database, expertReadId: string): Promise<void> {
  const read = await queryFirst<{ read_status: string; publishability: string }>(db, `SELECT read_status, publishability FROM expert_reads WHERE expert_read_id = ?`, [expertReadId]);
  if (!read) throw new Error("Expert Read not found.");
  if (read.read_status !== "final") throw new Error("Draft or incomplete Expert Reads cannot be consumed as Fleet Scribe inputs.");
  if (read.publishability === "blocked") throw new Error("Blocked Expert Reads cannot be consumed as publishable Fleet Scribe inputs.");
  if (read.publishability === "needs_verification") throw new Error("Expert Reads needing verification cannot be consumed as publishable Fleet Scribe inputs.");
}

export async function writeExpertReadAuditEvent(
  db: D1Database,
  event: Omit<ExpertReadAuditEvent, "event_id" | "timestamp">
): Promise<void> {
  await run(
    db,
    `INSERT INTO expert_read_audit_events (
      event_id, event_type, request_id, expert_read_id, lane_id, actor, timestamp,
      before_state_json, after_state_json, reason, correlation_id, evidence_hash, directive_hash, read_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `expert_read_audit_${newId()}`,
      event.event_type,
      event.request_id,
      event.expert_read_id,
      event.lane_id,
      event.actor,
      nowISO(),
      event.before_state === undefined ? null : canonicalJson(event.before_state),
      event.after_state === undefined ? null : canonicalJson(event.after_state),
      event.reason,
      event.correlation_id,
      event.evidence_hash ?? null,
      event.directive_hash ?? null,
      event.read_hash ?? null,
    ]
  );
}

async function insertFinding(db: D1Database, finding: ExpertReadFinding): Promise<void> {
  await run(
    db,
    `INSERT INTO expert_read_findings (
      finding_id, expert_read_id, finding_type, statement, evidence_refs_json,
      confidence, freshness, publishability, verification_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      finding.finding_id,
      finding.expert_read_id,
      finding.finding_type,
      finding.statement,
      canonicalJson(finding.evidence_refs),
      finding.confidence,
      finding.freshness,
      finding.publishability,
      finding.verification_required ? 1 : 0,
    ]
  );
}

async function insertRecommendation(db: D1Database, recommendation: ExpertReadRecommendation): Promise<void> {
  await run(
    db,
    `INSERT INTO expert_read_recommendations (
      recommendation_id, expert_read_id, recommendation_type, recommendation_text, evidence_refs_json,
      proof_metric, owner_lane, confidence, blocked_reason, publishability
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recommendation.recommendation_id,
      recommendation.expert_read_id,
      recommendation.recommendation_type,
      recommendation.recommendation_text,
      canonicalJson(recommendation.evidence_refs),
      recommendation.proof_metric,
      recommendation.owner_lane,
      recommendation.confidence,
      recommendation.blocked_reason,
      recommendation.publishability,
    ]
  );
}

async function hydrateRead(db: D1Database, read: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [findings, recommendations, request] = await Promise.all([
    queryAll<Record<string, unknown>>(db, `SELECT * FROM expert_read_findings WHERE expert_read_id = ? ORDER BY finding_id ASC`, [read.expert_read_id]),
    queryAll<Record<string, unknown>>(db, `SELECT * FROM expert_read_recommendations WHERE expert_read_id = ? ORDER BY recommendation_id ASC`, [read.expert_read_id]),
    queryFirst<Record<string, unknown>>(db, `SELECT * FROM expert_read_requests WHERE request_id = ? LIMIT 1`, [read.request_id]),
  ]);
  return {
    expert_read_id: read.expert_read_id,
    request_id: read.request_id,
    lane_id: read.lane_id,
    property_id: read.property_id,
    read_status: read.read_status,
    specialist_summary: read.specialist_summary,
    do_not_do_rules: safeJson(read.do_not_do_rules_json) ?? [],
    required_evidence: safeJson(read.required_evidence_json) ?? [],
    evidence_used: safeJson(read.evidence_used_json) ?? [],
    confidence: read.confidence,
    freshness_state: read.freshness_state,
    publishability: read.publishability,
    escalation_required: Boolean(read.escalation_required),
    conflicts: safeJson(read.conflicts_json) ?? [],
    generated_at: read.generated_at,
    read_hash: read.read_hash,
    payload_hash: read.payload_hash,
    findings: findings.map((row) => ({
      finding_id: row.finding_id,
      finding_type: row.finding_type,
      statement: row.statement,
      evidence_refs: safeJson(row.evidence_refs_json) ?? [],
      confidence: row.confidence,
      freshness: row.freshness,
      publishability: row.publishability,
      verification_required: Boolean(row.verification_required),
    })),
    recommendations: recommendations.map((row) => ({
      recommendation_id: row.recommendation_id,
      recommendation_type: row.recommendation_type,
      recommendation_text: row.recommendation_text,
      evidence_refs: safeJson(row.evidence_refs_json) ?? [],
      proof_metric: row.proof_metric,
      owner_lane: row.owner_lane,
      confidence: row.confidence,
      blocked_reason: row.blocked_reason,
      publishability: row.publishability,
    })),
    request: request
      ? {
          request_id: request.request_id,
          requested_by: request.requested_by,
          source_runtime_id: request.source_runtime_id,
          source_interaction_id: request.source_interaction_id,
          runtime_mode: request.runtime_mode,
          report_family: request.report_family,
          reason: request.reason,
          requested_at: request.requested_at,
          directive_snapshot_id: request.directive_snapshot_id,
          directive_snapshot_hash: request.directive_snapshot_hash,
          evidence_packet_id: request.evidence_packet_id,
          evidence_packet_hash: request.evidence_packet_hash,
          request_hash: request.request_hash,
          correlation_id: request.correlation_id,
        }
      : null,
  };
}

function safeJson<T>(value: unknown): T | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
