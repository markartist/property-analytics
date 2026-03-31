import { AppError } from "../../lib/validate";
import type {
  LifecycleEmissionInput,
  LifecycleEmissionOutput,
  LifecycleEngine,
  PromotionMode,
} from "../phase1-interfaces";
import { dedupeSignatureGenerator } from "../shared/dedupe-signature";
import { createIssueFamilyRegistryValidator } from "../shared/issue-family-registry";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import { scopeValidator } from "../shared/scope-validator";
import {
  countEscalationCandidatesForActorIssueFamilyOnDay,
  countEscalationCandidatesForActorOnDay,
  countWatchStatesForActorOnDay,
  findMatchingEscalationCandidates,
  findMatchingWatchStates,
  getAgentContractBundle,
  getExecutionSnapshotForLifecycle,
  getIssueLifecyclePolicy,
  getNoiseBudgetPolicyForAgentContract,
  insertEscalationCandidate,
  insertIssueLifecycleEvent,
  insertWatchState,
} from "./repository";

function addMinutes(isoTime: string, minutes: number): string {
  return new Date(new Date(isoTime).getTime() + minutes * 60000).toISOString();
}

function utcDayWindow(isoTime: string): { start: string; end: string } {
  const date = new Date(isoTime);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isWithinMinutes(baseIso: string, windowMinutes: number, compareIso: string): boolean {
  return new Date(compareIso).getTime() - new Date(baseIso).getTime() <= windowMinutes * 60000;
}

function resolveEscalationStatus(promotionMode: PromotionMode): "open" | "under_review" | "held" {
  switch (promotionMode) {
    case "auto":
      return "open";
    case "review_required":
      return "under_review";
    case "hold":
      return "held";
  }
}

export function createLifecycleEngine(db: D1Database): LifecycleEngine {
  const issueFamilyValidator = createIssueFamilyRegistryValidator(db);
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async emit(input: LifecycleEmissionInput): Promise<LifecycleEmissionOutput> {
      const validatedScope = scopeValidator.validate(input);
      if (!validatedScope.valid) {
        throw new AppError(400, "VALIDATION_ERROR", validatedScope.error?.message ?? "Invalid lifecycle scope");
      }

      const executionSnapshot = await getExecutionSnapshotForLifecycle(db, input.executionSnapshotId);
      if (!executionSnapshot) {
        throw new AppError(404, "NOT_FOUND", "Execution snapshot not found for lifecycle emission");
      }
      if (executionSnapshot.contract_bundle_id !== input.contractBundleId) {
        throw new AppError(400, "CONTRACT_MISMATCH", "Lifecycle contract bundle does not match execution snapshot");
      }
      if (
        executionSnapshot.scope_type !== validatedScope.normalized.scopeType ||
        (executionSnapshot.property_id ?? null) !== (validatedScope.normalized.propertyId ?? null) ||
        (executionSnapshot.cohort_key ?? null) !== (validatedScope.normalized.cohortKey ?? null) ||
        (executionSnapshot.portfolio_scope_key ?? null) !==
          (validatedScope.normalized.portfolioScopeKey ?? null)
      ) {
        throw new AppError(400, "BLOCKED", "Lifecycle scope does not match execution snapshot scope");
      }

      if (input.agentContractId) {
        const contract = await getAgentContractBundle(db, input.agentContractId);
        if (!contract) {
          throw new AppError(404, "NOT_FOUND", "Agent contract not found for lifecycle emission");
        }
        if (contract.contract_bundle_id !== input.contractBundleId) {
          throw new AppError(400, "CONTRACT_MISMATCH", "Agent contract bundle does not match lifecycle contract bundle");
        }
      }

      const issueFamilyValidation = await issueFamilyValidator.validate({
        scopeType: validatedScope.normalized.scopeType,
        propertyId: validatedScope.normalized.propertyId ?? null,
        cohortKey: validatedScope.normalized.cohortKey ?? null,
        portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
        issueFamilyKey: input.issueFamilyKey,
      });
      if (!issueFamilyValidation.valid) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          issueFamilyValidation.error?.message ?? "Issue family validation failed"
        );
      }

      const lifecyclePolicy = await getIssueLifecyclePolicy(db, input.issueFamilyKey);
      if (!lifecyclePolicy) {
        throw new AppError(400, "BLOCKED", "Issue lifecycle policy not found");
      }

      const noiseBudgetPolicy =
        input.agentContractId ? await getNoiseBudgetPolicyForAgentContract(db, input.agentContractId) : null;

      const dedupeKey = dedupeSignatureGenerator.generate({
        objectType: input.objectType,
        scopeType: validatedScope.normalized.scopeType,
        propertyId: validatedScope.normalized.propertyId ?? null,
        cohortKey: validatedScope.normalized.cohortKey ?? null,
        portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
        issueFamilyKey: input.issueFamilyKey,
        normalizedSeverityBucket: input.dedupeContext.normalizedSeverityBucket,
        normalizedReasonCodes: input.dedupeContext.normalizedReasonCodes,
      });

      const existing =
        input.objectType === "watch_state"
          ? await findMatchingWatchStates(db, {
              issueFamilyKey: input.issueFamilyKey,
              dedupeKey,
              scopeType: validatedScope.normalized.scopeType,
              propertyId: validatedScope.normalized.propertyId ?? null,
              cohortKey: validatedScope.normalized.cohortKey ?? null,
              portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
            })
          : await findMatchingEscalationCandidates(db, {
              issueFamilyKey: input.issueFamilyKey,
              dedupeKey,
              scopeType: validatedScope.normalized.scopeType,
              propertyId: validatedScope.normalized.propertyId ?? null,
              cohortKey: validatedScope.normalized.cohortKey ?? null,
              portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
            });

      const latestExisting = existing
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const dedupeSuppressed =
        !!latestExisting &&
        isWithinMinutes(latestExisting.created_at, lifecyclePolicy.dedupe_window_minutes, input.lastObservedAt);
      const cooldownSuppressed =
        !!latestExisting &&
        !!latestExisting.cooldown_until &&
        new Date(latestExisting.cooldown_until).getTime() > new Date(input.lastObservedAt).getTime();
      const dayWindow = utcDayWindow(input.lastObservedAt);

      let budgetSuppressed = false;
      let budgetReason: string | null = null;
      if (noiseBudgetPolicy) {
        if (input.objectType === "watch_state") {
          const watchCount = await countWatchStatesForActorOnDay(
            db,
            input.sourceActorId,
            dayWindow.start,
            dayWindow.end
          );
          if (watchCount >= noiseBudgetPolicy.max_watch_states_per_day) {
            budgetSuppressed = true;
            budgetReason = "noise_budget_watch_daily_limit";
          }
        } else {
          const candidateCount = await countEscalationCandidatesForActorOnDay(
            db,
            input.sourceActorId,
            dayWindow.start,
            dayWindow.end
          );
          const familyCount = await countEscalationCandidatesForActorIssueFamilyOnDay(
            db,
            input.sourceActorId,
            input.issueFamilyKey,
            dayWindow.start,
            dayWindow.end
          );
          if (candidateCount >= noiseBudgetPolicy.max_escalation_candidates_per_day) {
            budgetSuppressed = true;
            budgetReason = "noise_budget_escalation_daily_limit";
          } else if (
            familyCount >= noiseBudgetPolicy.max_escalation_candidates_per_issue_family_per_day
          ) {
            budgetSuppressed = true;
            budgetReason = "noise_budget_issue_family_daily_limit";
          }
        }
      }

      if (input.objectType === "watch_state") {
        const status: "open" | "suppressed" =
          dedupeSuppressed || cooldownSuppressed || budgetSuppressed ? "suppressed" : "open";
        const watchStateId = await insertWatchState(db, {
          issueFamilyKey: input.issueFamilyKey,
          scopeType: validatedScope.normalized.scopeType,
          propertyId: validatedScope.normalized.propertyId ?? null,
          cohortKey: validatedScope.normalized.cohortKey ?? null,
          portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
          severity: input.severity,
          confidence: input.confidence,
          watchReason: input.reason,
          status,
          sourceType: input.sourceType,
          sourceActorId: input.sourceActorId,
          executionSnapshotId: input.executionSnapshotId,
          agentContractId: input.agentContractId ?? null,
          contractBundleId: input.contractBundleId,
          firstObservedAt: input.firstObservedAt,
          lastObservedAt: input.lastObservedAt,
          notes:
            status === "suppressed"
              ? `suppressed:${dedupeSuppressed ? "dedupe" : cooldownSuppressed ? "cooldown" : budgetReason}`
              : null,
          expiresAt: addMinutes(input.lastObservedAt, lifecyclePolicy.monitor_tail_minutes),
          cooldownUntil: addMinutes(
            input.lastObservedAt,
            noiseBudgetPolicy?.cooldown_minutes_per_issue_family ?? lifecyclePolicy.cooldown_minutes
          ),
          dedupeKey,
        });
        await insertIssueLifecycleEvent(db, {
          objectType: "watch_state",
          objectId: watchStateId,
          eventType: status === "suppressed" ? "suppressed" : "created",
          eventActorType: input.sourceType,
          eventActorId: input.sourceActorId,
          executionSnapshotId: input.executionSnapshotId,
          agentContractId: input.agentContractId ?? null,
          contractBundleId: input.contractBundleId,
          message: status === "suppressed" ? "WatchState suppressed by dedupe/cooldown" : "WatchState created",
          newStatus: status,
          metadata: {
            dedupeKey,
            suppressionReason: dedupeSuppressed
              ? "dedupe_window"
              : cooldownSuppressed
                ? "cooldown"
                : budgetReason,
          },
        });
        await provenanceBuilder.build({
          objectType: "watch_state",
          objectId: watchStateId,
          contractBundleId: input.contractBundleId,
          sourceBatchIds: [],
          executionSnapshotId: input.executionSnapshotId,
          agentContractId: input.agentContractId ?? null,
          pipelineHealthSnapshotIds: [],
          upstreamObjectRefs: [{ objectType: "execution_snapshot", objectId: input.executionSnapshotId }],
          createdByType: input.sourceType,
          createdById: input.sourceActorId,
          metadata: {
            dedupeKey,
            status,
          },
        });
        return {
          objectType: "watch_state",
          objectId: watchStateId,
          status,
          dedupeKey,
          suppressionReason:
            status === "suppressed"
              ? dedupeSuppressed
                ? "dedupe_window"
                : cooldownSuppressed
                  ? "cooldown"
                  : budgetReason
              : null,
        };
      }

      const promotionMode = input.promotionMode ?? issueFamilyValidation.defaultPromotionMode ?? lifecyclePolicy.default_promotion_mode;
      const allowedPromotion =
        (promotionMode === "auto" && lifecyclePolicy.auto_promote_allowed === 1) ||
        (promotionMode === "review_required" && lifecyclePolicy.review_required_allowed === 1) ||
        (promotionMode === "hold" && lifecyclePolicy.hold_allowed === 1);
      if (!allowedPromotion) {
        throw new AppError(400, "POLICY_VIOLATION", "Promotion mode is not allowed for this issue family");
      }

      const status: "open" | "under_review" | "held" | "suppressed" =
        dedupeSuppressed || cooldownSuppressed || budgetSuppressed
          ? "suppressed"
          : resolveEscalationStatus(promotionMode);
      const escalationCandidateId = await insertEscalationCandidate(db, {
        issueFamilyKey: input.issueFamilyKey,
        scopeType: validatedScope.normalized.scopeType,
        propertyId: validatedScope.normalized.propertyId ?? null,
        cohortKey: validatedScope.normalized.cohortKey ?? null,
        portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
        severity: input.severity,
        confidence: input.confidence,
        promotionMode,
        candidateReason: input.reason,
        status,
        sourceType: input.sourceType,
        sourceActorId: input.sourceActorId,
        executionSnapshotId: input.executionSnapshotId,
        agentContractId: input.agentContractId ?? null,
        contractBundleId: input.contractBundleId,
        firstObservedAt: input.firstObservedAt,
        lastObservedAt: input.lastObservedAt,
        notes:
          status === "suppressed"
            ? `suppressed:${dedupeSuppressed ? "dedupe" : cooldownSuppressed ? "cooldown" : budgetReason}`
            : null,
        holdUntil:
          status === "held"
            ? addMinutes(
                input.lastObservedAt,
                noiseBudgetPolicy?.cooldown_minutes_per_issue_family ?? lifecyclePolicy.cooldown_minutes
              )
            : null,
        cooldownUntil: addMinutes(
          input.lastObservedAt,
          noiseBudgetPolicy?.cooldown_minutes_per_issue_family ?? lifecyclePolicy.cooldown_minutes
        ),
        relatedWatchStateId: null,
        dedupeKey,
      });
      await insertIssueLifecycleEvent(db, {
        objectType: "escalation_candidate",
        objectId: escalationCandidateId,
        eventType: status === "suppressed" ? "suppressed" : "created",
        eventActorType: input.sourceType,
        eventActorId: input.sourceActorId,
        executionSnapshotId: input.executionSnapshotId,
        agentContractId: input.agentContractId ?? null,
        contractBundleId: input.contractBundleId,
        message:
          status === "suppressed"
            ? "EscalationCandidate suppressed by dedupe/cooldown"
            : "EscalationCandidate created",
        newStatus: status,
        metadata: {
          dedupeKey,
          promotionMode,
          suppressionReason: dedupeSuppressed
            ? "dedupe_window"
            : cooldownSuppressed
              ? "cooldown"
              : budgetReason,
        },
      });
      await provenanceBuilder.build({
        objectType: "escalation_candidate",
        objectId: escalationCandidateId,
        contractBundleId: input.contractBundleId,
        sourceBatchIds: [],
        executionSnapshotId: input.executionSnapshotId,
        agentContractId: input.agentContractId ?? null,
        pipelineHealthSnapshotIds: [],
        upstreamObjectRefs: [{ objectType: "execution_snapshot", objectId: input.executionSnapshotId }],
        createdByType: input.sourceType,
        createdById: input.sourceActorId,
        metadata: {
          dedupeKey,
          status,
          promotionMode,
        },
      });
      return {
        objectType: "escalation_candidate",
        objectId: escalationCandidateId,
        status,
        dedupeKey,
        suppressionReason:
          status === "suppressed"
            ? dedupeSuppressed
              ? "dedupe_window"
              : cooldownSuppressed
                ? "cooldown"
                : budgetReason
            : null,
      };
    },
  };
}
