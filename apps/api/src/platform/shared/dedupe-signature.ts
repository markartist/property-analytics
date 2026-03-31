import type { DedupeSignatureGenerator, DedupeSignatureInput } from "../phase1-interfaces";
import { stableHash } from "./stable-hash";

function normalizeReasonCodes(codes?: string[]): string[] {
  return [...(codes ?? [])].map((c) => c.trim()).filter(Boolean).sort();
}

export const dedupeSignatureGenerator: DedupeSignatureGenerator = {
  generate(input: DedupeSignatureInput): string {
    const parts = [
      input.objectType,
      input.issueFamilyKey,
      input.scopeType,
      input.propertyId ?? null,
      input.cohortKey ?? null,
      input.portfolioScopeKey ?? null,
      input.normalizedSeverityBucket,
      ...normalizeReasonCodes(input.normalizedReasonCodes),
    ];
    return stableHash(parts);
  },
};

