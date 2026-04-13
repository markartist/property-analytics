import { queryFirst } from "../../lib/db";
import type {
  IssueFamilyRegistryValidator,
  IssueFamilyScopeValidationInput,
  IssueFamilyScopeValidationOutput,
} from "../phase1-interfaces";

interface IssueFamilyRegistryRow {
  issue_family_key: string;
  allowed_scope_types_json: string;
  default_promotion_mode: "auto" | "review_required" | "hold";
  active: number;
}

export function createIssueFamilyRegistryValidator(db: D1Database): IssueFamilyRegistryValidator {
  return {
    async validate(
      input: IssueFamilyScopeValidationInput
    ): Promise<IssueFamilyScopeValidationOutput> {
      const row = await queryFirst<IssueFamilyRegistryRow>(
        db,
        `SELECT issue_family_key, allowed_scope_types_json, default_promotion_mode, active
         FROM issue_family_registry
         WHERE issue_family_key = ?`,
        [input.issueFamilyKey]
      );

      if (!row || row.active !== 1) {
        return {
          valid: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "issue family is not registered or active",
            details: { issueFamilyKey: input.issueFamilyKey },
          },
        };
      }

      const allowedScopeTypes = JSON.parse(row.allowed_scope_types_json) as string[];
      if (!allowedScopeTypes.includes(input.scopeType)) {
        return {
          valid: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "issue family does not allow this scope type",
            details: { issueFamilyKey: input.issueFamilyKey, scopeType: input.scopeType },
          },
        };
      }

      return {
        valid: true,
        defaultPromotionMode: row.default_promotion_mode,
      };
    },
  };
}

