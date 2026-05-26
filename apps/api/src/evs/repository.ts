import type { EvsCheckResult, EvsNormalizedResult, EvsPropertyRecord, EvsValidationRequest } from "../../../../packages/shared/src";
import type {
  CreateEvsBatchInput,
  CreateEvsBatchRunInput,
  CreateEvsBatchTargetInput,
  CreateEvsEvaluationSetInput,
  EvsBatchDetail,
  EvsBatchRecord,
  EvsBatchRunRecord,
  EvsBatchTargetRecord,
  EvsEvaluationSetRecord,
  EvsFindingRecord,
  EvsPropertyAdvocatePayload,
  EvsRequestRecord,
  EvsResultRecord,
  EvsSourceTruthSnapshotRecord,
} from "../../../../packages/shared/src";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { nowISO } from "../lib/validate";

interface EvsRequestRow {
  id: string;
  source_consumer: EvsRequestRecord["source_consumer"];
  property_id: string;
  environment: EvsRequestRecord["environment"];
  reason: string;
  priority: EvsRequestRecord["priority"];
  target_pages_json: string;
  validation_profiles_json: string;
  device_profiles_json: string;
  governance_context_json: string | null;
  execution_mode: EvsRequestRecord["execution_mode"];
  trigger_metadata_json: string;
  status: EvsRequestRecord["status"];
  provider: EvsRequestRecord["provider"];
  requested_by: string | null;
  orchestrator_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface EvsResultRow {
  id: string;
  request_id: string;
  property_id: string;
  profile: EvsResultRecord["profile"];
  environment: EvsResultRecord["environment"];
  status: EvsResultRecord["status"];
  summary: string;
  severity: EvsResultRecord["severity"];
  business_impact: string;
  recommended_action: string;
  evidence_refs_json: string;
  normalized_payload_json: string;
  created_at: string;
}

interface EvsPropertyRow {
  id: string;
  property_name: string;
  community_id: string | null;
  legacy_url: string | null;
  staging_url: string;
  cohort: "pilot";
  is_active: number;
}

interface EvsEvaluationSetRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  source_contract_path: string | null;
  source_contract_hash: string | null;
  default_profiles_json: string;
  default_device_profiles_json: string;
  owner_lane: string;
  status: EvsEvaluationSetRecord["status"];
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface EvsBatchRow {
  id: string;
  evaluation_set_id: string | null;
  name: string;
  environment: EvsBatchRecord["environment"];
  source_label: string | null;
  input_urls_json: string;
  status: EvsBatchRecord["status"];
  requested_by: string | null;
  metadata_json: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EvsBatchTargetRow {
  id: string;
  batch_id: string;
  property_id: string | null;
  property_name: string | null;
  property_code: string | null;
  target_url: string;
  identity_status: EvsBatchTargetRecord["identity_status"];
  site_os_version: string | null;
  template_family: string | null;
  status: EvsBatchTargetRecord["status"];
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface EvsBatchRunRow {
  id: string;
  batch_target_id: string;
  request_id: string | null;
  profile: EvsBatchRunRecord["profile"];
  device_profile: EvsBatchRunRecord["device_profile"];
  provider: EvsBatchRunRecord["provider"];
  provider_build_name: string | null;
  raw_artifact_path: string | null;
  status: EvsBatchRunRecord["status"];
  classification: string | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EvsFindingRow {
  id: string;
  batch_run_id: string | null;
  request_id: string | null;
  property_id: string | null;
  profile: EvsFindingRecord["profile"];
  device_profile: EvsFindingRecord["device_profile"];
  check_id: string;
  category: EvsFindingRecord["category"];
  owner_lane: string | null;
  status: EvsFindingRecord["status"];
  severity: EvsFindingRecord["severity"];
  label: string;
  message: string;
  source_workbook: string | null;
  source_sheet: string | null;
  source_row: number | null;
  assertion_type: string | null;
  side_effect_policy: string | null;
  classification: string | null;
  metadata_json: string;
  evidence_refs_json: string;
  created_at: string;
}

interface EvsSourceTruthSnapshotRow {
  id: string;
  batch_id: string;
  kind: string;
  source_system: string;
  artifact_path: string;
  generated_at: string | null;
  summary_json: string;
  created_at: string;
}

function parseRequestRow(row: EvsRequestRow): EvsRequestRecord {
  return {
    request_id: row.id,
    source_consumer: row.source_consumer,
    property_id: row.property_id,
    environment: row.environment,
    reason: row.reason,
    priority: row.priority,
    target_pages: JSON.parse(row.target_pages_json),
    validation_profiles: JSON.parse(row.validation_profiles_json),
    device_profiles: JSON.parse(row.device_profiles_json),
    governance_context: row.governance_context_json ? JSON.parse(row.governance_context_json) : null,
    execution_mode: row.execution_mode,
    trigger_metadata: JSON.parse(row.trigger_metadata_json),
    status: row.status,
    provider: row.provider,
    requested_by: row.requested_by,
    orchestrator_ref: row.orchestrator_ref,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseResultRow(row: EvsResultRow): EvsResultRecord {
  return {
    result_id: row.id,
    request_id: row.request_id,
    property_id: row.property_id,
    profile: row.profile,
    environment: row.environment,
    status: row.status,
    summary: row.summary,
    severity: row.severity,
    business_impact: row.business_impact,
    recommended_action: row.recommended_action,
    evidence_refs: JSON.parse(row.evidence_refs_json),
    normalized_payload: JSON.parse(row.normalized_payload_json),
    created_at: row.created_at,
  };
}

function parsePropertyRow(row: EvsPropertyRow): EvsPropertyRecord {
  return {
    property_id: row.id,
    property_name: row.property_name,
    community_id: row.community_id,
    legacy_url: row.legacy_url,
    staging_url: row.staging_url,
    cohort: row.cohort,
    active: row.is_active === 1,
  };
}

function parseEvaluationSetRow(row: EvsEvaluationSetRow): EvsEvaluationSetRecord {
  return {
    evaluation_set_id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    source_contract_path: row.source_contract_path,
    source_contract_hash: row.source_contract_hash,
    default_profiles: JSON.parse(row.default_profiles_json),
    default_device_profiles: JSON.parse(row.default_device_profiles_json),
    owner_lane: row.owner_lane,
    status: row.status,
    metadata: JSON.parse(row.metadata_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseBatchRow(row: EvsBatchRow): EvsBatchRecord {
  return {
    batch_id: row.id,
    evaluation_set_id: row.evaluation_set_id,
    name: row.name,
    environment: row.environment,
    source_label: row.source_label,
    input_urls: JSON.parse(row.input_urls_json),
    status: row.status,
    requested_by: row.requested_by,
    metadata: JSON.parse(row.metadata_json),
    started_at: row.started_at,
    finished_at: row.finished_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseBatchTargetRow(row: EvsBatchTargetRow): EvsBatchTargetRecord {
  return {
    batch_target_id: row.id,
    batch_id: row.batch_id,
    property_id: row.property_id,
    property_name: row.property_name,
    property_code: row.property_code,
    target_url: row.target_url,
    identity_status: row.identity_status,
    site_os_version: row.site_os_version,
    template_family: row.template_family,
    status: row.status,
    metadata: JSON.parse(row.metadata_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseBatchRunRow(row: EvsBatchRunRow): EvsBatchRunRecord {
  return {
    batch_run_id: row.id,
    batch_target_id: row.batch_target_id,
    request_id: row.request_id,
    profile: row.profile,
    device_profile: row.device_profile,
    provider: row.provider,
    provider_build_name: row.provider_build_name,
    raw_artifact_path: row.raw_artifact_path,
    status: row.status,
    classification: row.classification,
    duration_ms: row.duration_ms,
    started_at: row.started_at,
    finished_at: row.finished_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseFindingRow(row: EvsFindingRow): EvsFindingRecord {
  return {
    finding_id: row.id,
    batch_run_id: row.batch_run_id,
    request_id: row.request_id,
    property_id: row.property_id,
    profile: row.profile,
    device_profile: row.device_profile,
    check_id: row.check_id,
    category: row.category,
    owner_lane: row.owner_lane,
    status: row.status,
    severity: row.severity,
    label: row.label,
    message: row.message,
    source_workbook: row.source_workbook,
    source_sheet: row.source_sheet,
    source_row: row.source_row,
    assertion_type: row.assertion_type,
    side_effect_policy: row.side_effect_policy,
    classification: row.classification,
    metadata: JSON.parse(row.metadata_json),
    evidence_refs: JSON.parse(row.evidence_refs_json),
    created_at: row.created_at,
  };
}

function parseSourceTruthSnapshotRow(row: EvsSourceTruthSnapshotRow): EvsSourceTruthSnapshotRecord {
  return {
    source_truth_snapshot_id: row.id,
    batch_id: row.batch_id,
    kind: row.kind,
    source_system: row.source_system,
    artifact_path: row.artifact_path,
    generated_at: row.generated_at,
    summary: JSON.parse(row.summary_json),
    created_at: row.created_at,
  };
}

export async function listProperties(db: D1Database): Promise<EvsPropertyRecord[]> {
  const rows = await queryAll<EvsPropertyRow>(
    db,
    `SELECT id, property_name, community_id, legacy_url, staging_url, cohort, is_active
     FROM evs_properties
     WHERE is_active = 1
     ORDER BY property_name ASC`
  );
  return rows.map(parsePropertyRow);
}

export async function getProperty(db: D1Database, propertyId: string): Promise<EvsPropertyRecord | null> {
  const row = await queryFirst<EvsPropertyRow>(
    db,
    `SELECT id, property_name, community_id, legacy_url, staging_url, cohort, is_active
     FROM evs_properties
     WHERE id = ?`,
    [propertyId]
  );
  return row ? parsePropertyRow(row) : null;
}

export async function createRequest(
  db: D1Database,
  request: EvsValidationRequest,
  requestedBy: string | null,
  provider: "browserstack"
): Promise<EvsRequestRecord> {
  const now = nowISO();
  await run(
    db,
    `INSERT INTO evs_requests (
      id, source_consumer, property_id, environment, reason, priority,
      target_pages_json, validation_profiles_json, device_profiles_json,
      governance_context_json, execution_mode, trigger_metadata_json,
      status, provider, requested_by, orchestrator_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, NULL, ?, ?)`,
    [
      request.request_id,
      request.source_consumer,
      request.property_id,
      request.environment,
      request.reason,
      request.priority,
      JSON.stringify(request.target_pages),
      JSON.stringify(request.validation_profiles),
      JSON.stringify(request.device_profiles),
      request.governance_context ? JSON.stringify(request.governance_context) : null,
      request.execution_mode,
      JSON.stringify(request.trigger_metadata),
      provider,
      requestedBy,
      now,
      now,
    ]
  );
  const created = await getRequest(db, request.request_id);
  if (!created) {
    throw new Error("Failed to persist EVS request.");
  }
  return created;
}

export async function getRequest(db: D1Database, requestId: string): Promise<EvsRequestRecord | null> {
  const row = await queryFirst<EvsRequestRow>(db, `SELECT * FROM evs_requests WHERE id = ?`, [requestId]);
  return row ? parseRequestRow(row) : null;
}

export async function listRequests(db: D1Database, propertyId?: string): Promise<EvsRequestRecord[]> {
  const rows = propertyId
    ? await queryAll<EvsRequestRow>(
        db,
        `SELECT * FROM evs_requests WHERE property_id = ? ORDER BY created_at DESC LIMIT 50`,
        [propertyId]
      )
    : await queryAll<EvsRequestRow>(db, `SELECT * FROM evs_requests ORDER BY created_at DESC LIMIT 50`);
  return rows.map(parseRequestRow);
}

export async function markRequestStatus(
  db: D1Database,
  requestId: string,
  status: EvsRequestRecord["status"],
  orchestratorRef?: string | null
) {
  await run(
    db,
    `UPDATE evs_requests
     SET status = ?, orchestrator_ref = COALESCE(?, orchestrator_ref), updated_at = ?
     WHERE id = ?`,
    [status, orchestratorRef ?? null, nowISO(), requestId]
  );
}

export async function recordRequestHandoff(
  db: D1Database,
  requestId: string,
  orchestratorRef: string,
  status: "queued" | "running"
) {
  await run(
    db,
    `UPDATE evs_requests
     SET status = ?, orchestrator_ref = ?, updated_at = ?
     WHERE id = ?`,
    [status, orchestratorRef, nowISO(), requestId]
  );
}

export async function createEvaluationSet(
  db: D1Database,
  input: CreateEvsEvaluationSetInput
): Promise<EvsEvaluationSetRecord> {
  const now = nowISO();
  const evaluationSetId = newId();
  await run(
    db,
    `INSERT INTO evs_evaluation_sets (
      id, key, name, description, source_contract_path, source_contract_hash,
      default_profiles_json, default_device_profiles_json, owner_lane, status,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evaluationSetId,
      input.key,
      input.name,
      input.description ?? null,
      input.source_contract_path ?? null,
      input.source_contract_hash ?? null,
      JSON.stringify(input.default_profiles),
      JSON.stringify(input.default_device_profiles),
      input.owner_lane,
      input.status ?? "active",
      JSON.stringify(input.metadata ?? {}),
      now,
      now,
    ]
  );
  const created = await getEvaluationSet(db, evaluationSetId);
  if (!created) {
    throw new Error("Failed to persist EVS evaluation set.");
  }
  return created;
}

export async function getEvaluationSet(
  db: D1Database,
  evaluationSetId: string
): Promise<EvsEvaluationSetRecord | null> {
  const row = await queryFirst<EvsEvaluationSetRow>(
    db,
    `SELECT * FROM evs_evaluation_sets WHERE id = ?`,
    [evaluationSetId]
  );
  return row ? parseEvaluationSetRow(row) : null;
}

export async function getEvaluationSetByKey(
  db: D1Database,
  key: string
): Promise<EvsEvaluationSetRecord | null> {
  const row = await queryFirst<EvsEvaluationSetRow>(
    db,
    `SELECT * FROM evs_evaluation_sets WHERE key = ?`,
    [key]
  );
  return row ? parseEvaluationSetRow(row) : null;
}

export async function listEvaluationSets(db: D1Database): Promise<EvsEvaluationSetRecord[]> {
  const rows = await queryAll<EvsEvaluationSetRow>(
    db,
    `SELECT * FROM evs_evaluation_sets ORDER BY status ASC, key ASC`
  );
  return rows.map(parseEvaluationSetRow);
}

export async function createBatch(db: D1Database, input: CreateEvsBatchInput): Promise<EvsBatchRecord> {
  const now = nowISO();
  const batchId = newId();
  await run(
    db,
    `INSERT INTO evs_batches (
      id, evaluation_set_id, name, environment, source_label, input_urls_json,
      status, requested_by, metadata_json, started_at, finished_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, ?, NULL, NULL, ?, ?)`,
    [
      batchId,
      input.evaluation_set_id ?? null,
      input.name,
      input.environment,
      input.source_label ?? null,
      JSON.stringify(input.input_urls),
      input.requested_by ?? null,
      JSON.stringify(input.metadata ?? {}),
      now,
      now,
    ]
  );
  const created = await getBatch(db, batchId);
  if (!created) {
    throw new Error("Failed to persist EVS batch.");
  }
  return created;
}

export async function getBatch(db: D1Database, batchId: string): Promise<EvsBatchRecord | null> {
  const row = await queryFirst<EvsBatchRow>(db, `SELECT * FROM evs_batches WHERE id = ?`, [batchId]);
  return row ? parseBatchRow(row) : null;
}

export async function listBatches(db: D1Database, limit = 50): Promise<EvsBatchRecord[]> {
  const rows = await queryAll<EvsBatchRow>(
    db,
    `SELECT * FROM evs_batches ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(parseBatchRow);
}

export async function markBatchStatus(
  db: D1Database,
  batchId: string,
  status: EvsBatchRecord["status"],
  timestamps: { started_at?: string | null; finished_at?: string | null } = {}
) {
  await run(
    db,
    `UPDATE evs_batches
     SET status = ?,
         started_at = COALESCE(?, started_at),
         finished_at = COALESCE(?, finished_at),
         updated_at = ?
     WHERE id = ?`,
    [status, timestamps.started_at ?? null, timestamps.finished_at ?? null, nowISO(), batchId]
  );
}

export async function createBatchTarget(
  db: D1Database,
  input: CreateEvsBatchTargetInput
): Promise<EvsBatchTargetRecord> {
  const now = nowISO();
  const targetId = newId();
  await run(
    db,
    `INSERT INTO evs_batch_targets (
      id, batch_id, property_id, property_name, property_code, target_url,
      identity_status, site_os_version, template_family, status, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
    [
      targetId,
      input.batch_id,
      input.property_id ?? null,
      input.property_name ?? null,
      input.property_code ?? null,
      input.target_url,
      input.identity_status,
      input.site_os_version ?? null,
      input.template_family ?? null,
      JSON.stringify(input.metadata ?? {}),
      now,
      now,
    ]
  );
  const created = await getBatchTarget(db, targetId);
  if (!created) {
    throw new Error("Failed to persist EVS batch target.");
  }
  return created;
}

export async function getBatchTarget(db: D1Database, targetId: string): Promise<EvsBatchTargetRecord | null> {
  const row = await queryFirst<EvsBatchTargetRow>(db, `SELECT * FROM evs_batch_targets WHERE id = ?`, [targetId]);
  return row ? parseBatchTargetRow(row) : null;
}

export async function listBatchTargets(db: D1Database, batchId: string): Promise<EvsBatchTargetRecord[]> {
  const rows = await queryAll<EvsBatchTargetRow>(
    db,
    `SELECT * FROM evs_batch_targets WHERE batch_id = ? ORDER BY created_at ASC`,
    [batchId]
  );
  return rows.map(parseBatchTargetRow);
}

export async function markBatchTargetStatus(
  db: D1Database,
  targetId: string,
  status: EvsBatchTargetRecord["status"]
) {
  await run(
    db,
    `UPDATE evs_batch_targets SET status = ?, updated_at = ? WHERE id = ?`,
    [status, nowISO(), targetId]
  );
}

export async function createBatchRun(
  db: D1Database,
  input: CreateEvsBatchRunInput
): Promise<EvsBatchRunRecord> {
  const now = nowISO();
  const runId = newId();
  await run(
    db,
    `INSERT INTO evs_batch_runs (
      id, batch_target_id, request_id, profile, device_profile, provider,
      provider_build_name, raw_artifact_path, status, classification, duration_ms,
      started_at, finished_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
    [
      runId,
      input.batch_target_id,
      input.request_id ?? null,
      input.profile,
      input.device_profile,
      input.provider,
      input.provider_build_name ?? null,
      input.raw_artifact_path ?? null,
      input.status ?? "queued",
      input.started_at ?? null,
      now,
      now,
    ]
  );
  const created = await getBatchRun(db, runId);
  if (!created) {
    throw new Error("Failed to persist EVS batch run.");
  }
  return created;
}

export async function getBatchRun(db: D1Database, runId: string): Promise<EvsBatchRunRecord | null> {
  const row = await queryFirst<EvsBatchRunRow>(db, `SELECT * FROM evs_batch_runs WHERE id = ?`, [runId]);
  return row ? parseBatchRunRow(row) : null;
}

export async function listBatchRuns(db: D1Database, batchId: string): Promise<EvsBatchRunRecord[]> {
  const rows = await queryAll<EvsBatchRunRow>(
    db,
    `SELECT r.*
     FROM evs_batch_runs r
     INNER JOIN evs_batch_targets t ON t.id = r.batch_target_id
     WHERE t.batch_id = ?
     ORDER BY r.created_at ASC`,
    [batchId]
  );
  return rows.map(parseBatchRunRow);
}

export async function completeBatchRun(
  db: D1Database,
  runId: string,
  patch: {
    status: EvsBatchRunRecord["status"];
    classification?: string | null;
    duration_ms?: number | null;
    raw_artifact_path?: string | null;
    finished_at?: string | null;
  }
) {
  await run(
    db,
    `UPDATE evs_batch_runs
     SET status = ?,
         classification = COALESCE(?, classification),
         duration_ms = COALESCE(?, duration_ms),
         raw_artifact_path = COALESCE(?, raw_artifact_path),
         finished_at = COALESCE(?, finished_at),
         updated_at = ?
     WHERE id = ?`,
    [
      patch.status,
      patch.classification ?? null,
      patch.duration_ms ?? null,
      patch.raw_artifact_path ?? null,
      patch.finished_at ?? null,
      nowISO(),
      runId,
    ]
  );
}

function metadataValue(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function ownerLaneForCheck(check: EvsCheckResult): string | null {
  const fromMetadata = metadataValue(check.metadata, "qa_owner");
  if (fromMetadata) return fromMetadata;
  if (check.check_id.startsWith("header_") || check.check_id.startsWith("footer_")) return "evs";
  return null;
}

function classificationForCheck(check: EvsCheckResult): string | null {
  const fromMetadata = metadataValue(check.metadata, "classification");
  if (fromMetadata) return fromMetadata;
  const templatePolicy = metadataValue(check.metadata, "template_policy");
  if (templatePolicy) return templatePolicy;
  const blockedReason = metadataValue(check.metadata, "blocked_reason");
  if (blockedReason) return blockedReason;
  if (check.status === "pass") return "pass";
  return null;
}

function sourceField(check: EvsCheckResult, key: string): string | null {
  const source = check.metadata.qa_source;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function sourceRow(check: EvsCheckResult): number | null {
  const source = check.metadata.qa_source;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const value = (source as Record<string, unknown>).row;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function saveFindingsForBatchRun(
  db: D1Database,
  batchRunId: string,
  request: EvsValidationRequest,
  result: EvsNormalizedResult
): Promise<EvsFindingRecord[]> {
  const now = nowISO();
  const saved: EvsFindingRecord[] = [];
  await run(db, `DELETE FROM evs_findings WHERE batch_run_id = ?`, [batchRunId]);

  for (const deviceResult of result.device_results) {
    for (const check of deviceResult.check_results) {
      const findingId = newId();
      await run(
        db,
        `INSERT INTO evs_findings (
          id, batch_run_id, request_id, property_id, profile, device_profile,
          check_id, category, owner_lane, status, severity, label, message,
          source_workbook, source_sheet, source_row, assertion_type,
          side_effect_policy, classification, metadata_json, evidence_refs_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          findingId,
          batchRunId,
          request.request_id,
          request.property_id,
          result.profile,
          deviceResult.device_profile,
          check.check_id,
          check.category,
          ownerLaneForCheck(check),
          check.status,
          check.severity,
          check.label,
          check.message,
          sourceField(check, "workbook"),
          sourceField(check, "sheet"),
          sourceRow(check),
          metadataValue(check.metadata, "qa_assertion_type"),
          metadataValue(check.metadata, "side_effect_policy"),
          classificationForCheck(check),
          JSON.stringify(check.metadata),
          JSON.stringify(check.evidence_refs),
          now,
        ]
      );
      const row = await queryFirst<EvsFindingRow>(db, `SELECT * FROM evs_findings WHERE id = ?`, [findingId]);
      if (row) saved.push(parseFindingRow(row));
    }
  }

  const primaryDevice = result.device_results[0];
  await completeBatchRun(db, batchRunId, {
    status: result.status === "pass" ? "completed" : "failed",
    classification: result.severity,
    duration_ms: primaryDevice?.duration_ms ?? null,
  });
  return saved;
}

export async function listFindingsForBatch(db: D1Database, batchId: string): Promise<EvsFindingRecord[]> {
  const rows = await queryAll<EvsFindingRow>(
    db,
    `SELECT f.*
     FROM evs_findings f
     INNER JOIN evs_batch_runs r ON r.id = f.batch_run_id
     INNER JOIN evs_batch_targets t ON t.id = r.batch_target_id
     WHERE t.batch_id = ?
     ORDER BY f.created_at ASC`,
    [batchId]
  );
  return rows.map(parseFindingRow);
}

export async function listSourceTruthSnapshotsForBatch(
  db: D1Database,
  batchId: string
): Promise<EvsSourceTruthSnapshotRecord[]> {
  const rows = await queryAll<EvsSourceTruthSnapshotRow>(
    db,
    `SELECT *
     FROM evs_source_truth_snapshots
     WHERE batch_id = ?
     ORDER BY created_at ASC`,
    [batchId]
  );
  return rows.map(parseSourceTruthSnapshotRow);
}

export async function getBatchDetail(db: D1Database, batchId: string): Promise<EvsBatchDetail | null> {
  const batch = await getBatch(db, batchId);
  if (!batch) return null;

  const evaluationSet = batch.evaluation_set_id ? await getEvaluationSet(db, batch.evaluation_set_id) : null;
  const [targets, runs, findings, sourceTruthSnapshots] = await Promise.all([
    listBatchTargets(db, batchId),
    listBatchRuns(db, batchId),
    listFindingsForBatch(db, batchId),
    listSourceTruthSnapshotsForBatch(db, batchId),
  ]);

  return {
    evaluation_set: evaluationSet,
    batch,
    targets,
    runs,
    findings,
    source_truth_snapshots: sourceTruthSnapshots,
  };
}

export async function saveSourceTruthSnapshot(
  db: D1Database,
  input: {
    batch_id: string;
    kind: string;
    source_system: string;
    artifact_path: string;
    generated_at?: string | null;
    summary?: Record<string, unknown>;
  }
): Promise<EvsSourceTruthSnapshotRecord> {
  const now = nowISO();
  const snapshotId = newId();
  await run(
    db,
    `INSERT INTO evs_source_truth_snapshots (
      id, batch_id, kind, source_system, artifact_path, generated_at, summary_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      input.batch_id,
      input.kind,
      input.source_system,
      input.artifact_path,
      input.generated_at ?? null,
      JSON.stringify(input.summary ?? {}),
      now,
    ]
  );
  const row = await queryFirst<EvsSourceTruthSnapshotRow>(
    db,
    `SELECT * FROM evs_source_truth_snapshots WHERE id = ?`,
    [snapshotId]
  );
  if (!row) {
    throw new Error("Failed to persist EVS source-truth snapshot.");
  }
  return parseSourceTruthSnapshotRow(row);
}

export async function saveNormalizedResult(
  db: D1Database,
  request: EvsValidationRequest,
  result: EvsNormalizedResult
): Promise<EvsResultRecord> {
  const now = nowISO();
  await run(
    db,
    `INSERT INTO evs_results (
      id, request_id, property_id, profile, environment, status, summary,
      severity, business_impact, recommended_action, evidence_refs_json,
      normalized_payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.result_id,
      result.request_id,
      request.property_id,
      result.profile,
      result.environment,
      result.status,
      result.summary,
      result.severity,
      result.business_impact,
      result.recommended_action,
      JSON.stringify(result.evidence_refs),
      JSON.stringify(result),
      now,
    ]
  );
  await markRequestStatus(db, request.request_id, result.status === "pass" ? "completed" : "failed");
  const saved = await getLatestResultForRequest(db, request.request_id);
  if (!saved) {
    throw new Error("Failed to persist EVS result.");
  }
  const batchRunId =
    typeof request.trigger_metadata.evs_batch_run_id === "string" ? request.trigger_metadata.evs_batch_run_id : null;
  if (batchRunId) {
    await saveFindingsForBatchRun(db, batchRunId, request, result);
  }
  return saved;
}

export async function getLatestResultForRequest(
  db: D1Database,
  requestId: string
): Promise<EvsResultRecord | null> {
  const row = await queryFirst<EvsResultRow>(
    db,
    `SELECT * FROM evs_results WHERE request_id = ? ORDER BY created_at DESC LIMIT 1`,
    [requestId]
  );
  return row ? parseResultRow(row) : null;
}

export async function getLatestResultForProperty(
  db: D1Database,
  propertyId: string
): Promise<EvsResultRecord | null> {
  const row = await queryFirst<EvsResultRow>(
    db,
    `SELECT * FROM evs_results WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
    [propertyId]
  );
  return row ? parseResultRow(row) : null;
}

export async function buildPropertyAdvocatePayload(
  db: D1Database,
  propertyId: string
): Promise<EvsPropertyAdvocatePayload | null> {
  const property = await getProperty(db, propertyId);
  if (!property) return null;

  const request = await queryFirst<EvsRequestRow>(
    db,
    `SELECT * FROM evs_requests WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
    [propertyId]
  );
  const latestRequest = request ? parseRequestRow(request) : null;
  const latestResult = await getLatestResultForProperty(db, propertyId);

  return {
    property,
    latest_validation: latestResult
      ? {
          property_id: property.property_id,
          property_name: property.property_name,
          staging_url: property.staging_url,
          latest_request_id: latestRequest?.request_id ?? null,
          latest_result_id: latestResult.result_id,
          latest_status: latestResult.status,
          latest_severity: latestResult.severity,
          latest_summary: latestResult.summary,
          latest_recommended_action: latestResult.recommended_action,
          last_validated_at: latestResult.created_at,
          profile: latestResult.profile,
          evidence_refs: latestResult.evidence_refs,
        }
      : null,
    open_findings:
      latestResult?.normalized_payload.check_results.filter(
        (check: EvsNormalizedResult["check_results"][number]) => check.status !== "pass"
      ) ?? [],
  };
}
