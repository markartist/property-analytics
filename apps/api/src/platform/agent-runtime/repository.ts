import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { BindingStatus } from "../phase1-interfaces";

export interface AgentIdentityRow {
  agent_id: string;
  agent_type: string;
  agent_name: string;
  agent_contract_id: string;
  status: "active" | "paused" | "degraded" | "suspended" | "retired";
  default_scope_type: string;
  default_property_id: string | null;
  default_cohort_key: string | null;
  default_portfolio_scope_key: string | null;
}

export interface AgentContractRow {
  agent_contract_id: string;
  agent_type: string;
  status: "draft" | "active" | "suspended" | "retired";
  allowed_scope_shapes_json: string;
  required_domains_json: string;
  optional_domains_json: string;
  minimum_trust_policy_json: string;
  allowed_reads_json: string;
  allowed_writes_json: string;
  prohibited_actions_json: string;
  escalation_permissions_json: string;
  noise_budget_policy_id: string;
  evaluation_profile_id: string;
  contract_bundle_id: string;
}

export interface NoiseBudgetPolicyRow {
  noise_budget_policy_id: string;
  max_watch_states_per_day: number;
  max_escalation_candidates_per_day: number;
  max_escalation_candidates_per_issue_family_per_day: number;
  cooldown_minutes_per_issue_family: number;
  suppression_behavior: "suppress_and_log" | "suppress_and_review" | "block_and_escalate";
}

export interface NoiseBudgetUsageSummaryRow {
  object_type: "watch_state" | "escalation_candidate";
  issue_family_key: string | null;
  status: string;
  count: number;
}

export interface ExecutionSnapshotRow {
  execution_snapshot_id: string;
  scope_type: string;
  property_id: string | null;
  cohort_key: string | null;
  portfolio_scope_key: string | null;
  contract_bundle_id: string;
}

export interface ExecutionSnapshotBindingRow {
  domain_key: string;
  domain_trust_posture: "trusted" | "stale" | "degraded" | "unavailable";
  binding_status: BindingStatus;
}

export async function getAgentIdentity(
  db: D1Database,
  agentId: string
): Promise<AgentIdentityRow | null> {
  return queryFirst<AgentIdentityRow>(db, `SELECT * FROM agent_identities WHERE agent_id = ?`, [agentId]);
}

export async function getAgentContract(
  db: D1Database,
  agentContractId: string
): Promise<AgentContractRow | null> {
  return queryFirst<AgentContractRow>(db, `SELECT * FROM agent_contracts WHERE agent_contract_id = ?`, [
    agentContractId,
  ]);
}

export async function getNoiseBudgetPolicy(
  db: D1Database,
  noiseBudgetPolicyId: string
): Promise<NoiseBudgetPolicyRow | null> {
  return queryFirst<NoiseBudgetPolicyRow>(
    db,
    `SELECT * FROM agent_noise_budget_policies WHERE noise_budget_policy_id = ?`,
    [noiseBudgetPolicyId]
  );
}

export async function getExecutionSnapshot(
  db: D1Database,
  executionSnapshotId: string
): Promise<ExecutionSnapshotRow | null> {
  return queryFirst<ExecutionSnapshotRow>(
    db,
    `SELECT execution_snapshot_id, scope_type, property_id, cohort_key, portfolio_scope_key, contract_bundle_id
     FROM execution_snapshots
     WHERE execution_snapshot_id = ?`,
    [executionSnapshotId]
  );
}

export async function getExecutionSnapshotBindingsForRuntime(
  db: D1Database,
  executionSnapshotId: string
): Promise<ExecutionSnapshotBindingRow[]> {
  return queryAll<ExecutionSnapshotBindingRow>(
    db,
    `SELECT domain_key, domain_trust_posture, binding_status
     FROM execution_snapshot_domain_bindings
     WHERE execution_snapshot_id = ?
     ORDER BY domain_key`,
    [executionSnapshotId]
  );
}

export async function insertAgentRuntimeBinding(
  db: D1Database,
  input: {
    agentId: string;
    agentContractId: string;
    executionSnapshotId: string;
    contractBundleId: string;
    triggerType: string;
    scopeType: string;
    propertyId?: string | null;
    cohortKey?: string | null;
    portfolioScopeKey?: string | null;
    notes?: string | null;
  }
): Promise<{ agentRuntimeBindingId: string; createdAt: string }> {
  const agentRuntimeBindingId = newId();
  const createdAt = nowISO();
  await run(
    db,
    `INSERT INTO agent_runtime_bindings (
      agent_runtime_binding_id, agent_id, agent_contract_id, execution_snapshot_id, contract_bundle_id,
      trigger_type, scope_type, property_id, cohort_key, portfolio_scope_key, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agentRuntimeBindingId,
      input.agentId,
      input.agentContractId,
      input.executionSnapshotId,
      input.contractBundleId,
      input.triggerType,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
      input.notes ?? null,
      createdAt,
    ]
  );
  return { agentRuntimeBindingId, createdAt };
}

export async function listNoiseBudgetUsageSummary(
  db: D1Database,
  input: {
    agentId: string;
    dayStartIso: string;
    dayEndIso: string;
  }
): Promise<NoiseBudgetUsageSummaryRow[]> {
  const watchRows = await queryAll<NoiseBudgetUsageSummaryRow>(
    db,
    `SELECT
        'watch_state' AS object_type,
        issue_family_key,
        status,
        COUNT(*) AS count
     FROM watch_states
     WHERE source_actor_id = ?
       AND COALESCE(last_observed_at, created_at) >= ?
       AND COALESCE(last_observed_at, created_at) < ?
     GROUP BY issue_family_key, status`,
    [input.agentId, input.dayStartIso, input.dayEndIso]
  );

  const escalationRows = await queryAll<NoiseBudgetUsageSummaryRow>(
    db,
    `SELECT
        'escalation_candidate' AS object_type,
        issue_family_key,
        status,
        COUNT(*) AS count
     FROM escalation_candidates
     WHERE source_actor_id = ?
       AND COALESCE(last_observed_at, created_at) >= ?
       AND COALESCE(last_observed_at, created_at) < ?
     GROUP BY issue_family_key, status`,
    [input.agentId, input.dayStartIso, input.dayEndIso]
  );

  return [...watchRows, ...escalationRows];
}
