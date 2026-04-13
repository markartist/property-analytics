import type { AgentRuntimeStartOutput } from "../phase1-interfaces";
import { createAgentRuntimeGateway } from "../agent-runtime/gateway";
import { createExecutionSnapshotBuilder } from "../execution-snapshots/builder";
import { createLifecycleEngine } from "../lifecycle/engine";
import { createPipelineHealthBuilder } from "../pipeline-health/builder";

export interface PropertyAdvocateRunInput {
  propertyId: string;
  agentId: string;
  contractBundleId: string;
  executionPolicyId: string;
  requestedBy: string;
  operatorId?: string | null;
  triggerType: string;
  triggerSource: string;
  triggerReferenceId?: string | null;
}

export interface PropertyAdvocateRunOutput {
  pipelineHealth: Array<{
    domainKey: string;
    pipelineHealthSnapshotId: string;
    domainTrustPosture: string;
    freshnessPosture: string;
    mirrorPosture: string;
    activeBatchPosture: string;
    contractPosture: string;
  }>;
  executionSnapshot: {
    executionSnapshotId: string;
    contractBundleId: string;
    bindingInputHash: string;
    pipelineHealthSnapshotSetHash: string;
    domainBindingCount: number;
  };
  runtime: AgentRuntimeStartOutput;
  emitted: Array<{
    objectType: "watch_state" | "escalation_candidate";
    objectId: string;
    status: string;
    suppressionReason?: string | null;
  }>;
}

export async function runPropertyAdvocateFlow(
  db: D1Database,
  input: PropertyAdvocateRunInput
): Promise<PropertyAdvocateRunOutput> {
  const pipelineHealthBuilder = createPipelineHealthBuilder(db);
  const executionSnapshotBuilder = createExecutionSnapshotBuilder(db);
  const agentRuntimeGateway = createAgentRuntimeGateway(db);
  const lifecycleEngine = createLifecycleEngine(db);

  const pipelineHealth = [];
  for (const domainKey of ["ga4", "psi"] as const) {
    pipelineHealth.push(
      await pipelineHealthBuilder.build({
        domainKey,
        contractBundleId: input.contractBundleId,
      })
    );
  }

  const executionSnapshot = await executionSnapshotBuilder.create({
    scopeType: "property",
    propertyId: input.propertyId,
    cohortKey: null,
    portfolioScopeKey: null,
    executionIntent: "property_monitoring",
    executionConsumerType: "property_advocate",
    executionConsumerId: input.agentId,
    triggerType: input.triggerType,
    triggerSource: input.triggerSource,
    triggerReferenceId: input.triggerReferenceId ?? null,
    requestedContractBundleId: input.contractBundleId,
    policyId: input.executionPolicyId,
    createdBy: "property_advocate_runner",
    operatorId: input.operatorId ?? null,
    requestedBy: input.requestedBy,
  });

  const runtime = await agentRuntimeGateway.start({
    agentId: input.agentId,
    executionSnapshotId: executionSnapshot.executionSnapshotId,
    triggerType: input.triggerType,
    scopeType: "property",
    propertyId: input.propertyId,
    cohortKey: null,
    portfolioScopeKey: null,
  });

  const emitted: PropertyAdvocateRunOutput["emitted"] = [];
  for (const health of pipelineHealth) {
    if (health.domainTrustPosture === "stale" || health.domainTrustPosture === "unavailable") {
      const watch = await lifecycleEngine.emit({
        objectType: "watch_state",
        issueFamilyKey: "data_freshness_risk",
        scopeType: "property",
        propertyId: input.propertyId,
        cohortKey: null,
        portfolioScopeKey: null,
        severity: health.domainTrustPosture === "unavailable" ? "high" : "medium",
        confidence: 0.9,
        reason: `${health.domainKey.toUpperCase()} trust posture is ${health.domainTrustPosture}`,
        sourceType: "agent_runtime",
        sourceActorId: input.agentId,
        executionSnapshotId: executionSnapshot.executionSnapshotId,
        contractBundleId: input.contractBundleId,
        agentContractId: runtime.agentContractId,
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        dedupeContext: {
          normalizedReasonCodes: [`${health.domainKey.toUpperCase()}_${health.domainTrustPosture.toUpperCase()}`],
          normalizedSeverityBucket: health.domainTrustPosture === "unavailable" ? "high" : "medium",
        },
      });
      emitted.push(watch);
    }

    if (health.domainKey === "psi" && health.domainTrustPosture === "degraded") {
      const escalation = await lifecycleEngine.emit({
        objectType: "escalation_candidate",
        issueFamilyKey: "performance_regression",
        scopeType: "property",
        propertyId: input.propertyId,
        cohortKey: null,
        portfolioScopeKey: null,
        severity: "high",
        confidence: 0.92,
        reason: "PSI domain trust degraded during governed run",
        sourceType: "agent_runtime",
        sourceActorId: input.agentId,
        executionSnapshotId: executionSnapshot.executionSnapshotId,
        contractBundleId: input.contractBundleId,
        agentContractId: runtime.agentContractId,
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        dedupeContext: {
          normalizedReasonCodes: ["PSI_DEGRADED"],
          normalizedSeverityBucket: "high",
        },
      });
      emitted.push(escalation);
    }
  }

  return {
    pipelineHealth,
    executionSnapshot: {
      executionSnapshotId: executionSnapshot.executionSnapshotId,
      contractBundleId: executionSnapshot.contractBundleId,
      bindingInputHash: executionSnapshot.bindingInputHash,
      pipelineHealthSnapshotSetHash: executionSnapshot.pipelineHealthSnapshotSetHash,
      domainBindingCount: executionSnapshot.domainBindingCount,
    },
    runtime,
    emitted,
  };
}
