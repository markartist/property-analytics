import { AppError } from "../../lib/validate";
import type { AgentRuntimeGateway, AgentRuntimeStartInput, AgentRuntimeStartOutput, DomainTrustPosture } from "../phase1-interfaces";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import { scopeValidator } from "../shared/scope-validator";
import { memoryConsumptionChecker } from "../shared/memory-consumption";
import {
  getAgentContract,
  getAgentIdentity,
  getExecutionSnapshot,
  getExecutionSnapshotBindingsForRuntime,
  getNoiseBudgetPolicy,
  insertAgentRuntimeBinding,
} from "./repository";

const trustRank: Record<DomainTrustPosture, number> = {
  unavailable: 0,
  degraded: 1,
  stale: 2,
  trusted: 3,
};

type MinimumTrustPolicy = {
  domainTrustByDomain?: Record<string, DomainTrustPosture>;
  allowedMemoryConsumptionClass?: "reference_only" | "decision_support" | "operational_default";
};

function sameScope(
  left: { scopeType: string; propertyId?: string | null; cohortKey?: string | null; portfolioScopeKey?: string | null },
  right: { scopeType: string; propertyId?: string | null; cohortKey?: string | null; portfolioScopeKey?: string | null }
): boolean {
  return (
    left.scopeType === right.scopeType &&
    (left.propertyId ?? null) === (right.propertyId ?? null) &&
    (left.cohortKey ?? null) === (right.cohortKey ?? null) &&
    (left.portfolioScopeKey ?? null) === (right.portfolioScopeKey ?? null)
  );
}

export function createAgentRuntimeGateway(db: D1Database): AgentRuntimeGateway {
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async start(input: AgentRuntimeStartInput): Promise<AgentRuntimeStartOutput> {
      const validatedScope = scopeValidator.validate(input);
      if (!validatedScope.valid) {
        throw new AppError(400, "VALIDATION_ERROR", validatedScope.error?.message ?? "Invalid agent runtime scope");
      }

      const agent = await getAgentIdentity(db, input.agentId);
      if (!agent) {
        throw new AppError(404, "NOT_FOUND", "Agent identity not found");
      }
      if (agent.status !== "active") {
        throw new AppError(400, "BLOCKED", "Agent is not active");
      }

      const contract = await getAgentContract(db, agent.agent_contract_id);
      if (!contract) {
        throw new AppError(404, "NOT_FOUND", "Agent contract not found");
      }
      if (contract.status !== "active") {
        throw new AppError(400, "BLOCKED", "Agent contract is not active");
      }

      const allowedScopeShapes = JSON.parse(contract.allowed_scope_shapes_json) as string[];
      if (!allowedScopeShapes.includes(validatedScope.normalized.scopeType)) {
        throw new AppError(400, "BLOCKED", "Agent contract does not allow this scope shape");
      }

      const snapshot = await getExecutionSnapshot(db, input.executionSnapshotId);
      if (!snapshot) {
        throw new AppError(404, "NOT_FOUND", "Execution snapshot not found");
      }
      if (snapshot.contract_bundle_id !== contract.contract_bundle_id) {
        throw new AppError(400, "CONTRACT_MISMATCH", "Agent contract bundle does not match execution snapshot bundle");
      }
      if (
        !sameScope(validatedScope.normalized, {
          scopeType: snapshot.scope_type,
          propertyId: snapshot.property_id,
          cohortKey: snapshot.cohort_key,
          portfolioScopeKey: snapshot.portfolio_scope_key,
        })
      ) {
        throw new AppError(400, "BLOCKED", "Agent runtime scope does not match execution snapshot scope");
      }

      const runtimeBindings = await getExecutionSnapshotBindingsForRuntime(db, input.executionSnapshotId);
      const minimumTrustPolicy = JSON.parse(contract.minimum_trust_policy_json) as MinimumTrustPolicy;
      const requiredDomains = JSON.parse(contract.required_domains_json) as string[];
      for (const domainKey of requiredDomains) {
        const binding = runtimeBindings.find((item) => item.domain_key === domainKey);
        if (!binding) {
          throw new AppError(400, "BLOCKED", `Required domain ${domainKey} is not bound in execution snapshot`);
        }
        const minimum = minimumTrustPolicy.domainTrustByDomain?.[domainKey] ?? "trusted";
        if (trustRank[binding.domain_trust_posture] < trustRank[minimum]) {
          throw new AppError(
            400,
            "BLOCKED",
            `Execution snapshot domain ${domainKey} does not meet minimum trust posture`
          );
        }
      }

      const memoryCheck = memoryConsumptionChecker.check({
        consumerType: "agent_runtime",
        consumerId: input.agentId,
        memoryPatternId: "phase1_runtime_baseline",
        allowedConsumptionClass: minimumTrustPolicy.allowedMemoryConsumptionClass ?? "decision_support",
        attemptedConsumptionClass: "decision_support",
      });
      if (!memoryCheck.allowed) {
        throw new AppError(400, "BLOCKED", "Memory consumption policy blocked agent runtime start");
      }

      const noiseBudgetPolicy = await getNoiseBudgetPolicy(db, contract.noise_budget_policy_id);
      if (!noiseBudgetPolicy) {
        throw new AppError(400, "BLOCKED", "Agent noise budget policy not found");
      }

      const runtime = await insertAgentRuntimeBinding(db, {
        agentId: agent.agent_id,
        agentContractId: contract.agent_contract_id,
        executionSnapshotId: input.executionSnapshotId,
        contractBundleId: contract.contract_bundle_id,
        triggerType: input.triggerType,
        scopeType: validatedScope.normalized.scopeType,
        propertyId: validatedScope.normalized.propertyId ?? null,
        cohortKey: validatedScope.normalized.cohortKey ?? null,
        portfolioScopeKey: validatedScope.normalized.portfolioScopeKey ?? null,
        notes: `noise_budget_policy:${noiseBudgetPolicy.noise_budget_policy_id}`,
      });

      await provenanceBuilder.build({
        objectType: "agent_runtime_binding",
        objectId: runtime.agentRuntimeBindingId,
        contractBundleId: contract.contract_bundle_id,
        sourceBatchIds: [],
        executionSnapshotId: input.executionSnapshotId,
        agentContractId: contract.agent_contract_id,
        agentId: agent.agent_id,
        pipelineHealthSnapshotIds: [],
        upstreamObjectRefs: [{ objectType: "execution_snapshot", objectId: input.executionSnapshotId }],
        createdByType: "agent_runtime_gateway",
        createdById: agent.agent_id,
        metadata: {
          triggerType: input.triggerType,
          noiseBudgetPolicyId: noiseBudgetPolicy.noise_budget_policy_id,
        },
      });

      return {
        agentRuntimeBindingId: runtime.agentRuntimeBindingId,
        agentId: agent.agent_id,
        agentContractId: contract.agent_contract_id,
        executionSnapshotId: input.executionSnapshotId,
        contractBundleId: contract.contract_bundle_id,
      };
    },
  };
}
