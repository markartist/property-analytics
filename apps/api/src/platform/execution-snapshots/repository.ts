import { batch, queryAll, queryFirst, stmt } from "../../lib/db";
import { newId } from "../../lib/id";
import type { BindingStatus } from "../phase1-interfaces";
import type { ActiveBatchPointerRow } from "../mirror/repository";
import type { PipelineHealthSnapshotRow } from "../pipeline-health/repository";

export interface ExecutionSnapshotPolicyRow {
  execution_snapshot_policy_id: string;
  execution_intent: string;
  required_domains_json: string;
  optional_domains_json: string;
  allow_stale_domains: number;
  allow_degraded_domains: number;
  allow_unavailable_domains: number;
  fail_on_contract_mismatch: number;
}

export async function getExecutionSnapshotPolicy(
  db: D1Database,
  executionSnapshotPolicyId: string
): Promise<ExecutionSnapshotPolicyRow | null> {
  return queryFirst<ExecutionSnapshotPolicyRow>(
    db,
    `SELECT * FROM execution_snapshot_policies WHERE execution_snapshot_policy_id = ?`,
    [executionSnapshotPolicyId]
  );
}

export async function getActiveBatchPointersForDomains(
  db: D1Database,
  domainKeys: string[]
): Promise<ActiveBatchPointerRow[]> {
  if (!domainKeys.length) return [];
  const placeholders = domainKeys.map(() => "?").join(", ");
  return queryAll<ActiveBatchPointerRow>(
    db,
    `SELECT * FROM active_batch_pointers WHERE domain_key IN (${placeholders}) ORDER BY domain_key`,
    domainKeys
  );
}

export async function persistExecutionSnapshot(
  db: D1Database,
  input: {
    snapshotTime: string;
    scopeType: string;
    propertyId?: string | null;
    cohortKey?: string | null;
    portfolioScopeKey?: string | null;
    executionIntent: string;
    executionConsumerType: string;
    executionConsumerId: string;
    triggerType: string;
    triggerSource: string;
    triggerReferenceId?: string | null;
    contractBundleId: string;
    bindingInputHash: string;
    pipelineHealthSnapshotSetHash: string;
    domainBindingCount: number;
    createdBy: string;
    operatorId?: string | null;
    requestedBy?: string | null;
    bindings: Array<{
      domainKey: string;
      activeMirrorBatchId: string;
      pipelineHealthSnapshotId: string;
      domainTrustPosture: string;
      freshnessPosture: string;
      validationPosture: string;
      mirrorPosture: string;
      activeBatchPosture: string;
      contractPosture: string;
      activeDataThrough?: string | null;
      bindingStatus: BindingStatus;
      latestValidatedBatchId?: string | null;
      effectiveStateReasonCodes?: string | null;
    }>;
  }
): Promise<{ executionSnapshotId: string; snapshotTime: string }> {
  const executionSnapshotId = newId();
  const snapshotTime = input.snapshotTime;
  await batch(db, [
    stmt(
      db,
      `INSERT INTO execution_snapshots (
        execution_snapshot_id, snapshot_time, execution_intent, execution_consumer_type,
        execution_consumer_id, trigger_type, trigger_source, trigger_reference_id, scope_type,
        property_id, cohort_key, portfolio_scope_key, contract_bundle_id,
        pipeline_health_snapshot_set_hash, binding_input_hash, domain_binding_count,
        created_by, operator_id, requested_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        executionSnapshotId,
        snapshotTime,
        input.executionIntent,
        input.executionConsumerType,
        input.executionConsumerId,
        input.triggerType,
        input.triggerSource,
        input.triggerReferenceId ?? null,
        input.scopeType,
        input.propertyId ?? null,
        input.cohortKey ?? null,
        input.portfolioScopeKey ?? null,
        input.contractBundleId,
        input.pipelineHealthSnapshotSetHash,
        input.bindingInputHash,
        input.domainBindingCount,
        input.createdBy,
        input.operatorId ?? null,
        input.requestedBy ?? null,
        snapshotTime,
      ]
    ),
    ...input.bindings.map((binding) =>
      stmt(
        db,
        `INSERT INTO execution_snapshot_domain_bindings (
          execution_snapshot_domain_binding_id, execution_snapshot_id, domain_key,
          active_mirror_batch_id, pipeline_health_snapshot_id, domain_trust_posture,
          freshness_posture, validation_posture, mirror_posture, active_batch_posture,
          contract_posture, active_data_through, binding_status, notes,
          latest_validated_batch_id, effective_state_reason_codes, bound_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          newId(),
          executionSnapshotId,
          binding.domainKey,
          binding.activeMirrorBatchId,
          binding.pipelineHealthSnapshotId,
          binding.domainTrustPosture,
          binding.freshnessPosture,
          binding.validationPosture,
          binding.mirrorPosture,
          binding.activeBatchPosture,
          binding.contractPosture,
          binding.activeDataThrough ?? null,
          binding.bindingStatus,
          binding.latestValidatedBatchId ?? null,
          binding.effectiveStateReasonCodes ?? null,
          snapshotTime,
        ]
      )
    ),
  ]);

  return { executionSnapshotId, snapshotTime };
}

export async function getExecutionSnapshotBindings(
  db: D1Database,
  executionSnapshotId: string
): Promise<
  Array<{
    domain_key: string;
    active_mirror_batch_id: string;
    pipeline_health_snapshot_id: string;
    binding_status: BindingStatus;
  }>
> {
  return queryAll(
    db,
    `SELECT domain_key, active_mirror_batch_id, pipeline_health_snapshot_id, binding_status
     FROM execution_snapshot_domain_bindings
     WHERE execution_snapshot_id = ?
     ORDER BY domain_key`,
    [executionSnapshotId]
  );
}

export async function getExecutionSnapshotById(
  db: D1Database,
  executionSnapshotId: string
): Promise<
  | {
      execution_snapshot_id: string;
      binding_input_hash: string;
      pipeline_health_snapshot_set_hash: string;
      contract_bundle_id: string;
      domain_binding_count: number;
    }
  | null
> {
  return queryFirst(
    db,
    `SELECT execution_snapshot_id, binding_input_hash, pipeline_health_snapshot_set_hash, contract_bundle_id, domain_binding_count
     FROM execution_snapshots
     WHERE execution_snapshot_id = ?`,
    [executionSnapshotId]
  );
}
