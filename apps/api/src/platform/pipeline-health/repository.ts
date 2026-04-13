import { batch, queryAll, queryFirst, stmt } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type {
  ActiveBatchPosture,
  ContractPosture,
  DomainTrustPosture,
  FreshnessPosture,
  MirrorPosture,
  ValidationPosture,
} from "../phase1-interfaces";
import type { ActiveBatchPointerRow, MirrorBatchRow } from "../mirror/repository";

export interface PipelineHealthPolicyRow {
  domain_key: string;
  fresh_after_minutes: number;
  aging_after_minutes: number;
  stale_after_minutes: number;
  expire_after_minutes: number;
  mirror_lag_tolerance_minutes: number;
  validation_required: number;
  mirror_required: number;
  contract_match_required: number;
}

export interface SystemStateEventRow {
  system_state_event_id: string;
  domain_key: string;
  event_type: string;
  event_status: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  event_time: string;
  source_component: string;
  source_host: string;
  source_validation_batch_id: string | null;
  mirror_batch_id: string | null;
  active_mirror_batch_id: string | null;
  schema_bundle_version: string | null;
  validator_bundle_version: string | null;
  mirror_bundle_version: string | null;
  contract_bundle_id: string | null;
  message: string;
  metadata_json: string;
  failure_code: string | null;
  failure_message: string | null;
}

export interface PipelineHealthSnapshotRow {
  pipeline_health_snapshot_id: string;
  domain_key: string;
  snapshot_time: string;
  active_mirror_batch_id: string | null;
  freshness_posture: FreshnessPosture;
  validation_posture: ValidationPosture;
  mirror_posture: MirrorPosture;
  active_batch_posture: ActiveBatchPosture;
  contract_posture: ContractPosture;
  domain_trust_posture: DomainTrustPosture;
  contract_bundle_id: string | null;
  is_current: number;
}

export async function getPipelineHealthPolicy(
  db: D1Database,
  domainKey: string
): Promise<PipelineHealthPolicyRow | null> {
  return queryFirst<PipelineHealthPolicyRow>(
    db,
    `SELECT * FROM pipeline_health_policies WHERE domain_key = ?`,
    [domainKey]
  );
}

export async function getMirrorBatchById(
  db: D1Database,
  mirrorBatchId: string
): Promise<MirrorBatchRow | null> {
  return queryFirst<MirrorBatchRow>(db, `SELECT * FROM mirror_batches WHERE mirror_batch_id = ?`, [
    mirrorBatchId,
  ]);
}

export async function getActivePointerForDomain(
  db: D1Database,
  domainKey: string
): Promise<ActiveBatchPointerRow | null> {
  return queryFirst<ActiveBatchPointerRow>(
    db,
    `SELECT * FROM active_batch_pointers WHERE domain_key = ?`,
    [domainKey]
  );
}

export async function getLatestSystemStateEventForDomain(
  db: D1Database,
  domainKey: string,
  eventTypes: string[]
): Promise<SystemStateEventRow | null> {
  if (!eventTypes.length) return null;
  const placeholders = eventTypes.map(() => "?").join(", ");
  return queryFirst<SystemStateEventRow>(
    db,
    `SELECT *
     FROM system_state_events
     WHERE domain_key = ? AND event_type IN (${placeholders})
     ORDER BY julianday(event_time) DESC, event_time DESC
     LIMIT 1`,
    [domainKey, ...eventTypes]
  );
}

export async function persistPipelineHealthSnapshot(
  db: D1Database,
  input: {
    domainKey: string;
    contractBundleId: string;
    latestCollectionEventId?: string | null;
    latestValidationEventId?: string | null;
    latestMirrorEventId?: string | null;
    latestActivationEventId?: string | null;
    latestContractEventId?: string | null;
    latestLocalRunAt?: string | null;
    latestSuccessfulLocalRunAt?: string | null;
    latestValidatedBatchId?: string | null;
    latestValidatedDataThrough?: string | null;
    latestMirrorAttemptAt?: string | null;
    latestMirrorBatchId?: string | null;
    activeMirrorBatchId?: string | null;
    latestActiveBatchActivatedAt?: string | null;
    activeDataThrough?: string | null;
    freshnessPosture: FreshnessPosture;
    validationPosture: ValidationPosture;
    mirrorPosture: MirrorPosture;
    activeBatchPosture: ActiveBatchPosture;
    contractPosture: ContractPosture;
    domainTrustPosture: DomainTrustPosture;
    warningCount: number;
    errorCount: number;
    blockingCount: number;
    statusSummary: string;
    effectiveStateReasonCodes: string;
    latestFailureCode?: string | null;
    latestFailureMessage?: string | null;
    notes?: string | null;
  }
): Promise<{ pipelineHealthSnapshotId: string; snapshotTime: string }> {
  const pipelineHealthSnapshotId = newId();
  const snapshotTime = nowISO();
  await batch(db, [
    stmt(
      db,
      `UPDATE pipeline_health_snapshots
       SET is_current = 0
       WHERE domain_key = ? AND is_current = 1`,
      [input.domainKey]
    ),
    stmt(
      db,
      `INSERT INTO pipeline_health_snapshots (
        pipeline_health_snapshot_id, domain_key, snapshot_time, latest_collection_event_id,
        latest_validation_event_id, latest_mirror_event_id, latest_activation_event_id,
        latest_contract_event_id, latest_local_run_at, latest_successful_local_run_at,
        latest_validated_batch_id, latest_validated_data_through, latest_mirror_attempt_at,
        latest_mirror_batch_id, active_mirror_batch_id, latest_active_batch_activated_at,
        active_data_through, freshness_posture, validation_posture, mirror_posture,
        active_batch_posture, contract_posture, domain_trust_posture, warning_count,
        error_count, blocking_count, status_summary, effective_state_reason_codes,
        latest_failure_code, latest_failure_message, notes, is_current, contract_bundle_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        pipelineHealthSnapshotId,
        input.domainKey,
        snapshotTime,
        input.latestCollectionEventId ?? null,
        input.latestValidationEventId ?? null,
        input.latestMirrorEventId ?? null,
        input.latestActivationEventId ?? null,
        input.latestContractEventId ?? null,
        input.latestLocalRunAt ?? null,
        input.latestSuccessfulLocalRunAt ?? null,
        input.latestValidatedBatchId ?? null,
        input.latestValidatedDataThrough ?? null,
        input.latestMirrorAttemptAt ?? null,
        input.latestMirrorBatchId ?? null,
        input.activeMirrorBatchId ?? null,
        input.latestActiveBatchActivatedAt ?? null,
        input.activeDataThrough ?? null,
        input.freshnessPosture,
        input.validationPosture,
        input.mirrorPosture,
        input.activeBatchPosture,
        input.contractPosture,
        input.domainTrustPosture,
        input.warningCount,
        input.errorCount,
        input.blockingCount,
        input.statusSummary,
        input.effectiveStateReasonCodes,
        input.latestFailureCode ?? null,
        input.latestFailureMessage ?? null,
        input.notes ?? null,
        input.contractBundleId,
        snapshotTime,
      ]
    ),
  ]);
  return { pipelineHealthSnapshotId, snapshotTime };
}

export async function getCurrentPipelineHealthSnapshot(
  db: D1Database,
  domainKey: string
): Promise<PipelineHealthSnapshotRow | null> {
  return queryFirst<PipelineHealthSnapshotRow>(
    db,
    `SELECT * FROM pipeline_health_snapshots WHERE domain_key = ? AND is_current = 1`,
    [domainKey]
  );
}

export async function listCurrentPipelineHealthSnapshots(
  db: D1Database,
  domainKeys: string[]
): Promise<PipelineHealthSnapshotRow[]> {
  if (!domainKeys.length) return [];
  const placeholders = domainKeys.map(() => "?").join(", ");
  return queryAll<PipelineHealthSnapshotRow>(
    db,
    `SELECT *
     FROM pipeline_health_snapshots
     WHERE is_current = 1 AND domain_key IN (${placeholders})
     ORDER BY domain_key`,
    domainKeys
  );
}
