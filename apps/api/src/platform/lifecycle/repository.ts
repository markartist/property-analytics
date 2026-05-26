import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { PromotionMode } from "../phase1-interfaces";

export interface IssueLifecyclePolicyRow {
  issue_lifecycle_policy_id: string;
  issue_family_key: string;
  default_promotion_mode: PromotionMode;
  auto_promote_allowed: number;
  review_required_allowed: number;
  hold_allowed: number;
  dedupe_window_minutes: number;
  cooldown_minutes: number;
  monitor_tail_minutes: number;
}

export interface NoiseBudgetPolicyRow {
  noise_budget_policy_id: string;
  max_watch_states_per_day: number;
  max_escalation_candidates_per_day: number;
  max_escalation_candidates_per_issue_family_per_day: number;
  cooldown_minutes_per_issue_family: number;
  suppression_behavior: "suppress_and_log" | "suppress_and_review" | "block_and_escalate";
}

export interface MatchingLifecycleObjectRow {
  id: string;
  status: string;
  created_at: string;
  cooldown_until: string | null;
  dedupe_key: string;
}

export async function getIssueLifecyclePolicy(
  db: D1Database,
  issueFamilyKey: string
): Promise<IssueLifecyclePolicyRow | null> {
  return queryFirst<IssueLifecyclePolicyRow>(
    db,
    `SELECT * FROM issue_lifecycle_policies WHERE issue_family_key = ?`,
    [issueFamilyKey]
  );
}

export async function getNoiseBudgetPolicyForAgentContract(
  db: D1Database,
  agentContractId: string
): Promise<NoiseBudgetPolicyRow | null> {
  return queryFirst<NoiseBudgetPolicyRow>(
    db,
    `SELECT nb.*
     FROM agent_contracts ac
     JOIN agent_noise_budget_policies nb
       ON nb.noise_budget_policy_id = ac.noise_budget_policy_id
     WHERE ac.agent_contract_id = ?`,
    [agentContractId]
  );
}

export async function getExecutionSnapshotForLifecycle(
  db: D1Database,
  executionSnapshotId: string
): Promise<
  | {
      execution_snapshot_id: string;
      scope_type: string;
      property_id: string | null;
      cohort_key: string | null;
      portfolio_scope_key: string | null;
      contract_bundle_id: string;
    }
  | null
> {
  return queryFirst(
    db,
    `SELECT execution_snapshot_id, scope_type, property_id, cohort_key, portfolio_scope_key, contract_bundle_id
     FROM execution_snapshots
     WHERE execution_snapshot_id = ?`,
    [executionSnapshotId]
  );
}

export async function getAgentContractBundle(
  db: D1Database,
  agentContractId: string
): Promise<{ agent_contract_id: string; contract_bundle_id: string } | null> {
  return queryFirst(
    db,
    `SELECT agent_contract_id, contract_bundle_id FROM agent_contracts WHERE agent_contract_id = ?`,
    [agentContractId]
  );
}

export async function findMatchingWatchStates(
  db: D1Database,
  input: {
    issueFamilyKey: string;
    dedupeKey: string;
    scopeType: string;
    propertyId?: string | null;
    cohortKey?: string | null;
    portfolioScopeKey?: string | null;
  }
): Promise<MatchingLifecycleObjectRow[]> {
  return queryAll<MatchingLifecycleObjectRow>(
    db,
    `SELECT watch_state_id AS id, status, created_at, cooldown_until, dedupe_key
     FROM watch_states
     WHERE issue_family_key = ?
       AND dedupe_key = ?
       AND scope_type = ?
       AND COALESCE(property_id, '') = COALESCE(?, '')
       AND COALESCE(cohort_key, '') = COALESCE(?, '')
       AND COALESCE(portfolio_scope_key, '') = COALESCE(?, '')
       AND status NOT IN ('closed', 'expired')`,
    [
      input.issueFamilyKey,
      input.dedupeKey,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
    ]
  );
}

export async function findMatchingEscalationCandidates(
  db: D1Database,
  input: {
    issueFamilyKey: string;
    dedupeKey: string;
    scopeType: string;
    propertyId?: string | null;
    cohortKey?: string | null;
    portfolioScopeKey?: string | null;
  }
): Promise<MatchingLifecycleObjectRow[]> {
  return queryAll<MatchingLifecycleObjectRow>(
    db,
    `SELECT escalation_candidate_id AS id, status, created_at, cooldown_until, dedupe_key
     FROM escalation_candidates
     WHERE issue_family_key = ?
       AND dedupe_key = ?
       AND scope_type = ?
       AND COALESCE(property_id, '') = COALESCE(?, '')
       AND COALESCE(cohort_key, '') = COALESCE(?, '')
       AND COALESCE(portfolio_scope_key, '') = COALESCE(?, '')
       AND status NOT IN ('closed', 'rejected')`,
    [
      input.issueFamilyKey,
      input.dedupeKey,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
    ]
  );
}

export async function insertWatchState(
  db: D1Database,
  input: {
    issueFamilyKey: string;
    scopeType: string;
    propertyId?: string | null;
    cohortKey?: string | null;
    portfolioScopeKey?: string | null;
    severity: string;
    confidence: number;
    watchReason: string;
    status: "open" | "suppressed";
    sourceType: string;
    sourceActorId: string;
    executionSnapshotId: string;
    agentContractId?: string | null;
    contractBundleId: string;
    firstObservedAt: string;
    lastObservedAt: string;
    notes?: string | null;
    expiresAt?: string | null;
    cooldownUntil?: string | null;
    dedupeKey: string;
  }
): Promise<string> {
  const watchStateId = newId();
  await run(
    db,
    `INSERT INTO watch_states (
      watch_state_id, issue_family_key, scope_type, property_id, cohort_key, portfolio_scope_key,
      severity, confidence, watch_reason, status, source_type, source_actor_id,
      execution_snapshot_id, agent_contract_id, contract_bundle_id, first_observed_at,
      last_observed_at, created_at, updated_at, notes, expires_at, cooldown_until, dedupe_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      watchStateId,
      input.issueFamilyKey,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
      input.severity,
      input.confidence,
      input.watchReason,
      input.status,
      input.sourceType,
      input.sourceActorId,
      input.executionSnapshotId,
      input.agentContractId ?? null,
      input.contractBundleId,
      input.firstObservedAt,
      input.lastObservedAt,
      nowISO(),
      nowISO(),
      input.notes ?? null,
      input.expiresAt ?? null,
      input.cooldownUntil ?? null,
      input.dedupeKey,
    ]
  );
  return watchStateId;
}

export async function insertEscalationCandidate(
  db: D1Database,
  input: {
    issueFamilyKey: string;
    scopeType: string;
    propertyId?: string | null;
    cohortKey?: string | null;
    portfolioScopeKey?: string | null;
    severity: string;
    confidence: number;
    promotionMode: PromotionMode;
    candidateReason: string;
    status: "open" | "under_review" | "held" | "suppressed";
    sourceType: string;
    sourceActorId: string;
    executionSnapshotId: string;
    agentContractId?: string | null;
    contractBundleId: string;
    firstObservedAt: string;
    lastObservedAt: string;
    notes?: string | null;
    holdUntil?: string | null;
    cooldownUntil?: string | null;
    relatedWatchStateId?: string | null;
    dedupeKey: string;
  }
): Promise<string> {
  const escalationCandidateId = newId();
  await run(
    db,
    `INSERT INTO escalation_candidates (
      escalation_candidate_id, issue_family_key, scope_type, property_id, cohort_key, portfolio_scope_key,
      severity, confidence, promotion_mode, candidate_reason, status, source_type, source_actor_id,
      execution_snapshot_id, agent_contract_id, contract_bundle_id, first_observed_at, last_observed_at,
      created_at, updated_at, notes, hold_until, cooldown_until, related_watch_state_id, dedupe_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      escalationCandidateId,
      input.issueFamilyKey,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
      input.severity,
      input.confidence,
      input.promotionMode,
      input.candidateReason,
      input.status,
      input.sourceType,
      input.sourceActorId,
      input.executionSnapshotId,
      input.agentContractId ?? null,
      input.contractBundleId,
      input.firstObservedAt,
      input.lastObservedAt,
      nowISO(),
      nowISO(),
      input.notes ?? null,
      input.holdUntil ?? null,
      input.cooldownUntil ?? null,
      input.relatedWatchStateId ?? null,
      input.dedupeKey,
    ]
  );
  return escalationCandidateId;
}

export async function insertIssueLifecycleEvent(
  db: D1Database,
  input: {
    objectType: "watch_state" | "escalation_candidate";
    objectId: string;
    eventType: string;
    eventActorType: string;
    eventActorId: string;
    executionSnapshotId: string;
    agentContractId?: string | null;
    contractBundleId: string;
    message: string;
    oldStatus?: string | null;
    newStatus: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await run(
    db,
    `INSERT INTO issue_lifecycle_events (
      issue_lifecycle_event_id, object_type, object_id, event_type, event_actor_type, event_actor_id,
      event_time, execution_snapshot_id, agent_contract_id, contract_bundle_id, message, old_status, new_status, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.objectType,
      input.objectId,
      input.eventType,
      input.eventActorType,
      input.eventActorId,
      nowISO(),
      input.executionSnapshotId,
      input.agentContractId ?? null,
      input.contractBundleId,
      input.message,
      input.oldStatus ?? null,
      input.newStatus,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}

export async function countWatchStatesForActorOnDay(
  db: D1Database,
  sourceActorId: string,
  dayStartIso: string,
  dayEndIso: string
): Promise<number> {
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM watch_states
     WHERE source_actor_id = ?
       AND COALESCE(last_observed_at, created_at) >= ?
       AND COALESCE(last_observed_at, created_at) < ?`,
    [sourceActorId, dayStartIso, dayEndIso]
  );
  return row?.count ?? 0;
}

export async function countEscalationCandidatesForActorOnDay(
  db: D1Database,
  sourceActorId: string,
  dayStartIso: string,
  dayEndIso: string
): Promise<number> {
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM escalation_candidates
     WHERE source_actor_id = ?
       AND COALESCE(last_observed_at, created_at) >= ?
       AND COALESCE(last_observed_at, created_at) < ?`,
    [sourceActorId, dayStartIso, dayEndIso]
  );
  return row?.count ?? 0;
}

export async function countEscalationCandidatesForActorIssueFamilyOnDay(
  db: D1Database,
  sourceActorId: string,
  issueFamilyKey: string,
  dayStartIso: string,
  dayEndIso: string
): Promise<number> {
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM escalation_candidates
     WHERE source_actor_id = ?
       AND issue_family_key = ?
       AND COALESCE(last_observed_at, created_at) >= ?
       AND COALESCE(last_observed_at, created_at) < ?`,
    [sourceActorId, issueFamilyKey, dayStartIso, dayEndIso]
  );
  return row?.count ?? 0;
}
