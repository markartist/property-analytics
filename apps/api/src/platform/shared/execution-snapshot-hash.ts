import type {
  ExecutionSnapshotHashCalculator,
  ExecutionSnapshotHashInput,
} from "../phase1-interfaces";
import { stableHash } from "./stable-hash";

export const executionSnapshotHashCalculator: ExecutionSnapshotHashCalculator = {
  calculate(input: ExecutionSnapshotHashInput): string {
    const orderedBindings = [...input.bindings].sort((a, b) => a.domainKey.localeCompare(b.domainKey));
    const parts: Array<string | number | null | undefined> = [
      input.contractBundleId,
      input.executionIntent,
      input.triggerType,
      input.triggerReferenceId ?? null,
      input.snapshotTime,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
    ];

    for (const binding of orderedBindings) {
      parts.push(binding.domainKey, binding.activeMirrorBatchId, binding.pipelineHealthSnapshotId);
    }

    return stableHash(parts);
  },
};

