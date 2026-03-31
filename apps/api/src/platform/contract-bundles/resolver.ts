import { AppError } from "../../lib/validate";
import type {
  ContractBundleResolver,
  ResolveContractBundleInput,
  ResolveContractBundleOutput,
} from "../phase1-interfaces";
import {
  createCompatibilityEvent,
  getContractBundleById,
  getLatestActiveContractBundleByName,
  getResolutionPolicy,
} from "./repository";

const DEFAULT_PHASE1_BUNDLE_NAME = "platform_phase1_v1";

export function createContractBundleResolver(db: D1Database): ContractBundleResolver {
  return {
    async resolve(input: ResolveContractBundleInput): Promise<ResolveContractBundleOutput> {
      const policy = await getResolutionPolicy(db, input.contextType);
      if (!policy) {
        await createCompatibilityEvent(db, {
          contextType: input.contextType,
          contextObjectType: input.contextObjectType,
          contextObjectId: input.contextObjectId,
          requestedContractBundleId: input.requestedContractBundleId ?? null,
          resolvedContractBundleId: null,
          compatibilityPosture: "blocked",
          message: "No contract bundle resolution policy found for context",
          failureCode: "POLICY_MISSING",
        });
        throw new AppError(500, "BLOCKED", "No contract bundle resolution policy found for context");
      }

      const requestedId = input.requestedContractBundleId ?? null;
      const resolved =
        requestedId
          ? await getContractBundleById(db, requestedId)
          : await getLatestActiveContractBundleByName(
              db,
              input.requestedBundleAlias ?? DEFAULT_PHASE1_BUNDLE_NAME
            );

      if (!resolved) {
        await createCompatibilityEvent(db, {
          contextType: input.contextType,
          contextObjectType: input.contextObjectType,
          contextObjectId: input.contextObjectId,
          requestedContractBundleId: null,
          resolvedContractBundleId: null,
          compatibilityPosture: "blocked",
          message: "Requested contract bundle could not be resolved",
          failureCode: "BUNDLE_NOT_FOUND",
          metadata: requestedId ? { requestedContractBundleId: requestedId } : undefined,
        });
        throw new AppError(400, "CONTRACT_MISMATCH", "Requested contract bundle could not be resolved");
      }

      const allowedStatuses = JSON.parse(policy.allowed_bundle_statuses_json) as string[];
      if (!allowedStatuses.includes(resolved.status)) {
        await createCompatibilityEvent(db, {
          contextType: input.contextType,
          contextObjectType: input.contextObjectType,
          contextObjectId: input.contextObjectId,
          requestedContractBundleId: requestedId,
          resolvedContractBundleId: resolved.contract_bundle_id,
          compatibilityPosture: "blocked",
          message: "Resolved bundle status is not allowed for this context",
          failureCode: "BUNDLE_STATUS_BLOCKED",
          metadata: { status: resolved.status, allowedStatuses },
        });
        throw new AppError(400, "CONTRACT_MISMATCH", "Resolved bundle status is not allowed for this context");
      }

      const compatibilityPosture =
        policy.require_exact_match === 1 &&
        requestedId !== null &&
        requestedId !== resolved.contract_bundle_id
          ? "mismatch"
          : "compatible";

      if (compatibilityPosture !== "compatible") {
        await createCompatibilityEvent(db, {
          contextType: input.contextType,
          contextObjectType: input.contextObjectType,
          contextObjectId: input.contextObjectId,
          requestedContractBundleId: requestedId,
          resolvedContractBundleId: resolved.contract_bundle_id,
          compatibilityPosture,
          message: "Exact contract bundle match required",
          failureCode: "EXACT_MATCH_REQUIRED",
        });
        throw new AppError(400, "CONTRACT_MISMATCH", "Exact contract bundle match required");
      }

      await createCompatibilityEvent(db, {
        contextType: input.contextType,
        contextObjectType: input.contextObjectType,
        contextObjectId: input.contextObjectId,
        requestedContractBundleId: requestedId,
        resolvedContractBundleId: resolved.contract_bundle_id,
        compatibilityPosture,
        message: "Contract bundle resolved successfully",
      });

      const output: ResolveContractBundleOutput = {
        requestedContractBundleId: requestedId,
        resolvedContractBundleId: resolved.contract_bundle_id,
        compatibilityPosture,
      };
      return output;
    },
  };
}
