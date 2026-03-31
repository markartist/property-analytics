import { AppError } from "../../lib/validate";
import type {
  BindingStatus,
  ExecutionSnapshotBuildInput,
  ExecutionSnapshotBuildOutput,
  ExecutionSnapshotBuilder,
} from "../phase1-interfaces";
import { createContractBundleResolver } from "../contract-bundles/resolver";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import { scopeValidator } from "../shared/scope-validator";
import { stableHash } from "../shared/stable-hash";
import { executionSnapshotHashCalculator } from "../shared/execution-snapshot-hash";
import { getCurrentPipelineHealthSnapshot, listCurrentPipelineHealthSnapshots } from "../pipeline-health/repository";
import {
  getActiveBatchPointersForDomains,
  getExecutionSnapshotById,
  getExecutionSnapshotBindings,
  getExecutionSnapshotPolicy,
  persistExecutionSnapshot,
} from "./repository";

function parseDomainList(jsonText: string): string[] {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new AppError(500, "BLOCKED", "Execution snapshot policy domains are invalid");
  }
  return parsed;
}

function determineBindingStatus(
  domainTrustPosture: "trusted" | "stale" | "degraded" | "unavailable",
  policy: {
    allow_stale_domains: number;
    allow_degraded_domains: number;
    allow_unavailable_domains: number;
  }
): BindingStatus {
  switch (domainTrustPosture) {
    case "trusted":
      return "usable";
    case "stale":
      return policy.allow_stale_domains === 1 ? "stale" : "excluded";
    case "degraded":
      return policy.allow_degraded_domains === 1 ? "degraded" : "excluded";
    case "unavailable":
      return policy.allow_unavailable_domains === 1 ? "unavailable" : "excluded";
  }
}

export function createExecutionSnapshotBuilder(db: D1Database): ExecutionSnapshotBuilder {
  const bundleResolver = createContractBundleResolver(db);
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async create(input: ExecutionSnapshotBuildInput): Promise<ExecutionSnapshotBuildOutput> {
      const scope = scopeValidator.validate(input);
      if (!scope.valid) {
        throw new AppError(400, "VALIDATION_ERROR", scope.error?.message ?? "Invalid scope");
      }

      const policy = await getExecutionSnapshotPolicy(db, input.policyId);
      if (!policy) {
        throw new AppError(400, "BLOCKED", "Execution snapshot policy not found");
      }
      if (policy.execution_intent !== input.executionIntent) {
        throw new AppError(400, "VALIDATION_ERROR", "Execution intent does not match snapshot policy");
      }

      const requiredDomains = parseDomainList(policy.required_domains_json);
      const optionalDomains = parseDomainList(policy.optional_domains_json);
      const allDomains = [...new Set([...requiredDomains, ...optionalDomains])].sort();

      const resolvedBundle = await bundleResolver.resolve({
        contextType: "snapshot_creation",
        requestedContractBundleId: input.requestedContractBundleId ?? null,
        contextObjectType: "execution_snapshot",
        contextObjectId: `${input.executionConsumerType}:${input.executionConsumerId}:${input.triggerType}`,
      });

      const currentSnapshots = await listCurrentPipelineHealthSnapshots(db, allDomains);
      const snapshotByDomain = new Map(currentSnapshots.map((snapshot) => [snapshot.domain_key, snapshot]));
      const activePointers = await getActiveBatchPointersForDomains(db, allDomains);
      const pointerByDomain = new Map(activePointers.map((pointer) => [pointer.domain_key, pointer]));

      const bindings: ExecutionSnapshotBuildOutput["bindings"] = [];
      const persistedBindings: Array<{
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
      }> = [];

      for (const domainKey of allDomains) {
        const snapshot = snapshotByDomain.get(domainKey);
        if (!snapshot) {
          if (requiredDomains.includes(domainKey)) {
            throw new AppError(400, "BLOCKED", `Missing current pipeline health snapshot for required domain ${domainKey}`);
          }
          continue;
        }

        const currentSnapshot = await getCurrentPipelineHealthSnapshot(db, domainKey);
        if (!currentSnapshot || currentSnapshot.pipeline_health_snapshot_id !== snapshot.pipeline_health_snapshot_id) {
          throw new AppError(409, "CONSISTENCY_MISMATCH", `Pipeline health snapshot drift detected for domain ${domainKey}`);
        }

        const activePointer = pointerByDomain.get(domainKey);
        if (!activePointer || activePointer.active_mirror_batch_id !== snapshot.active_mirror_batch_id) {
          throw new AppError(409, "CONSISTENCY_MISMATCH", `Active batch pointer drift detected for domain ${domainKey}`);
        }

        if (policy.fail_on_contract_mismatch === 1 && snapshot.contract_posture !== "matched") {
          throw new AppError(400, "BLOCKED", `Contract mismatch blocks execution snapshot binding for domain ${domainKey}`);
        }

        const bindingStatus = determineBindingStatus(snapshot.domain_trust_posture, policy);
        if (requiredDomains.includes(domainKey) && bindingStatus === "excluded") {
          throw new AppError(
            400,
            "BLOCKED",
            `Required domain ${domainKey} does not meet trust posture requirements for execution snapshot`
          );
        }

        bindings.push({
          domainKey,
          activeMirrorBatchId: snapshot.active_mirror_batch_id!,
          pipelineHealthSnapshotId: snapshot.pipeline_health_snapshot_id,
          bindingStatus,
        });
        persistedBindings.push({
          domainKey,
          activeMirrorBatchId: snapshot.active_mirror_batch_id!,
          pipelineHealthSnapshotId: snapshot.pipeline_health_snapshot_id,
          domainTrustPosture: snapshot.domain_trust_posture,
          freshnessPosture: snapshot.freshness_posture,
          validationPosture: snapshot.validation_posture,
          mirrorPosture: snapshot.mirror_posture,
          activeBatchPosture: snapshot.active_batch_posture,
          contractPosture: snapshot.contract_posture,
          bindingStatus,
          activeDataThrough: null,
          latestValidatedBatchId: null,
          effectiveStateReasonCodes: null,
        });
      }

      const snapshotTime = new Date().toISOString();
      const pipelineHealthSnapshotSetHash = stableHash(
        persistedBindings
          .slice()
          .sort((a, b) => a.domainKey.localeCompare(b.domainKey))
          .flatMap((binding) => [binding.domainKey, binding.pipelineHealthSnapshotId, binding.activeMirrorBatchId])
      );
      const bindingInputHash = executionSnapshotHashCalculator.calculate({
        scopeType: scope.normalized.scopeType,
        propertyId: scope.normalized.propertyId ?? null,
        cohortKey: scope.normalized.cohortKey ?? null,
        portfolioScopeKey: scope.normalized.portfolioScopeKey ?? null,
        contractBundleId: resolvedBundle.resolvedContractBundleId,
        executionIntent: input.executionIntent,
        triggerType: input.triggerType,
        triggerReferenceId: input.triggerReferenceId ?? null,
        snapshotTime,
        bindings: bindings.map((binding) => ({
          domainKey: binding.domainKey,
          activeMirrorBatchId: binding.activeMirrorBatchId,
          pipelineHealthSnapshotId: binding.pipelineHealthSnapshotId,
        })),
      });

      const persisted = await persistExecutionSnapshot(db, {
        snapshotTime,
        scopeType: scope.normalized.scopeType,
        propertyId: scope.normalized.propertyId ?? null,
        cohortKey: scope.normalized.cohortKey ?? null,
        portfolioScopeKey: scope.normalized.portfolioScopeKey ?? null,
        executionIntent: input.executionIntent,
        executionConsumerType: input.executionConsumerType,
        executionConsumerId: input.executionConsumerId,
        triggerType: input.triggerType,
        triggerSource: input.triggerSource,
        triggerReferenceId: input.triggerReferenceId ?? null,
        contractBundleId: resolvedBundle.resolvedContractBundleId,
        bindingInputHash,
        pipelineHealthSnapshotSetHash,
        domainBindingCount: persistedBindings.length,
        createdBy: input.createdBy,
        operatorId: input.operatorId ?? null,
        requestedBy: input.requestedBy ?? null,
        bindings: persistedBindings,
      });

      await provenanceBuilder.build({
        objectType: "execution_snapshot",
        objectId: persisted.executionSnapshotId,
        contractBundleId: resolvedBundle.resolvedContractBundleId,
        sourceBatchIds: [],
        pipelineHealthSnapshotIds: persistedBindings.map((binding) => binding.pipelineHealthSnapshotId),
        upstreamObjectRefs: persistedBindings.map((binding) => ({
          objectType: "pipeline_health_snapshot",
          objectId: binding.pipelineHealthSnapshotId,
        })),
        createdByType: "execution_snapshot_builder",
        createdById: input.createdBy,
        metadata: {
          executionIntent: input.executionIntent,
          triggerType: input.triggerType,
          bindingInputHash,
          pipelineHealthSnapshotSetHash,
        },
      });

      const saved = await getExecutionSnapshotById(db, persisted.executionSnapshotId);
      const savedBindings = await getExecutionSnapshotBindings(db, persisted.executionSnapshotId);
      if (
        !saved ||
        saved.binding_input_hash !== bindingInputHash ||
        saved.pipeline_health_snapshot_set_hash !== pipelineHealthSnapshotSetHash ||
        saved.domain_binding_count !== persistedBindings.length
      ) {
        throw new AppError(500, "CONSISTENCY_MISMATCH", "Execution snapshot persisted with inconsistent hash state");
      }

      const savedBindingHash = stableHash(
        savedBindings.flatMap((binding) => [
          binding.domain_key,
          binding.active_mirror_batch_id,
          binding.pipeline_health_snapshot_id,
        ])
      );
      const expectedBindingHash = stableHash(
        bindings.flatMap((binding) => [
          binding.domainKey,
          binding.activeMirrorBatchId,
          binding.pipelineHealthSnapshotId,
        ])
      );
      if (savedBindingHash !== expectedBindingHash) {
        throw new AppError(500, "CONSISTENCY_MISMATCH", "Execution snapshot binding set hash verification failed");
      }

      return {
        executionSnapshotId: persisted.executionSnapshotId,
        contractBundleId: resolvedBundle.resolvedContractBundleId,
        bindingInputHash,
        pipelineHealthSnapshotSetHash,
        domainBindingCount: bindings.length,
        bindings,
      };
    },
  };
}
