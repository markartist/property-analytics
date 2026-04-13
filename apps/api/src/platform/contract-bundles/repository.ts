import { queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { CompatibilityPosture } from "../phase1-interfaces";

export interface ContractBundleRow {
  contract_bundle_id: string;
  bundle_name: string;
  bundle_version: string;
  status: "draft" | "active" | "deprecated" | "retired" | "blocked";
  schema_bundle_version: string;
  mirror_contract_version: string;
  pipeline_health_contract_version: string;
  execution_snapshot_contract_version: string;
  agent_contract_set_version: string;
  lifecycle_contract_version: string;
  evaluation_contract_version: string;
  rule_pack_version: string;
  source_control_ref: string;
}

export interface ContractBundleResolutionPolicyRow {
  resolution_policy_id: string;
  context_type: "mirror_intake" | "snapshot_creation" | "agent_runtime" | "lifecycle_promotion" | "artifact_generation";
  allowed_bundle_statuses_json: string;
  require_exact_match: number;
  allow_forward_compatible_components: number;
  allow_backward_compatible_components: number;
  block_on_unknown_component: number;
}

export async function getContractBundleById(
  db: D1Database,
  contractBundleId: string
): Promise<ContractBundleRow | null> {
  return queryFirst<ContractBundleRow>(
    db,
    `SELECT * FROM contract_bundles WHERE contract_bundle_id = ?`,
    [contractBundleId]
  );
}

export async function getLatestActiveContractBundleByName(
  db: D1Database,
  bundleName: string
): Promise<ContractBundleRow | null> {
  return queryFirst<ContractBundleRow>(
    db,
    `SELECT * FROM contract_bundles
     WHERE bundle_name = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [bundleName]
  );
}

export async function getResolutionPolicy(
  db: D1Database,
  contextType: ContractBundleResolutionPolicyRow["context_type"]
): Promise<ContractBundleResolutionPolicyRow | null> {
  return queryFirst<ContractBundleResolutionPolicyRow>(
    db,
    `SELECT * FROM contract_bundle_resolution_policies WHERE context_type = ?`,
    [contextType]
  );
}

export async function createCompatibilityEvent(
  db: D1Database,
  input: {
    contextType: ContractBundleResolutionPolicyRow["context_type"];
    contextObjectType: string;
    contextObjectId: string;
    requestedContractBundleId?: string | null;
    resolvedContractBundleId?: string | null;
    compatibilityPosture: CompatibilityPosture;
    message: string;
    failureCode?: string | null;
    failureMessage?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await run(
    db,
    `INSERT INTO contract_compatibility_events (
      contract_compatibility_event_id, context_type, context_object_type, context_object_id,
      requested_contract_bundle_id, resolved_contract_bundle_id, compatibility_posture,
      event_time, message, failure_code, failure_message, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.contextType,
      input.contextObjectType,
      input.contextObjectId,
      input.requestedContractBundleId ?? null,
      input.resolvedContractBundleId ?? null,
      input.compatibilityPosture,
      nowISO(),
      input.message,
      input.failureCode ?? null,
      input.failureMessage ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}

