import type {
  MemoryConsumptionChecker,
  MemoryConsumptionCheckInput,
  MemoryConsumptionCheckOutput,
} from "../phase1-interfaces";

const rank: Record<MemoryConsumptionCheckInput["attemptedConsumptionClass"], number> = {
  reference_only: 0,
  decision_support: 1,
  operational_default: 2,
};

export const memoryConsumptionChecker: MemoryConsumptionChecker = {
  check(input: MemoryConsumptionCheckInput): MemoryConsumptionCheckOutput {
    if (rank[input.attemptedConsumptionClass] <= rank[input.allowedConsumptionClass]) {
      return { allowed: true };
    }
    return {
      allowed: false,
      violationCode: "MEMORY_CONSUMPTION_BLOCKED",
    };
  },
};

