import type { ScopeFields, ScopeValidationResult, ScopeValidator } from "../phase1-interfaces";

function invalid(message: string): ScopeValidationResult {
  return {
    valid: false,
    normalized: { scopeType: "system", propertyId: null, cohortKey: null, portfolioScopeKey: null },
    error: {
      code: "VALIDATION_ERROR",
      message,
    },
  };
}

export const scopeValidator: ScopeValidator = {
  validate(input: ScopeFields, opts?: { allowPropertyCohortContext?: boolean }): ScopeValidationResult {
    const normalized: ScopeFields = {
      scopeType: input.scopeType,
      propertyId: input.propertyId ?? null,
      cohortKey: input.cohortKey ?? null,
      portfolioScopeKey: input.portfolioScopeKey ?? null,
    };

    switch (normalized.scopeType) {
      case "property":
        if (!normalized.propertyId) return invalid("property scope requires propertyId");
        if (normalized.portfolioScopeKey) return invalid("property scope may not include portfolioScopeKey");
        if (!opts?.allowPropertyCohortContext && normalized.cohortKey) {
          return invalid("property scope may not include cohortKey in this context");
        }
        return { valid: true, normalized };
      case "cohort":
        if (normalized.propertyId) return invalid("cohort scope may not include propertyId");
        if (!normalized.cohortKey) return invalid("cohort scope requires cohortKey");
        if (normalized.portfolioScopeKey) return invalid("cohort scope may not include portfolioScopeKey");
        return { valid: true, normalized };
      case "portfolio":
        if (normalized.propertyId || normalized.cohortKey) {
          return invalid("portfolio scope may not include propertyId or cohortKey");
        }
        if (!normalized.portfolioScopeKey) return invalid("portfolio scope requires portfolioScopeKey");
        return { valid: true, normalized };
      case "global":
      case "system":
        if (normalized.propertyId || normalized.cohortKey || normalized.portfolioScopeKey) {
          return invalid(`${normalized.scopeType} scope may not include scope ids`);
        }
        return { valid: true, normalized };
      default:
        return invalid("unknown scopeType");
    }
  },
};

