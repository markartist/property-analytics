import { AppError } from "../../lib/validate";
import type {
  ActiveBatchPosture,
  ContractPosture,
  DomainTrustPosture,
  FreshnessPosture,
  MirrorPosture,
  PipelineHealthBuildInput,
  PipelineHealthBuildOutput,
  PipelineHealthBuilder,
  ValidationPosture,
} from "../phase1-interfaces";
import { getContractBundleById } from "../contract-bundles/repository";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import {
  getActivePointerForDomain,
  getCurrentPipelineHealthSnapshot,
  getLatestSystemStateEventForDomain,
  getMirrorBatchById,
  getPipelineHealthPolicy,
  persistPipelineHealthSnapshot,
} from "./repository";

function minutesSince(isoTime: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(isoTime).getTime()) / 60000));
}

function eventOccurredAfter(eventTime: string | null | undefined, comparisonTime: string | null | undefined): boolean {
  if (!eventTime || !comparisonTime) return false;
  return new Date(eventTime).getTime() > new Date(comparisonTime).getTime();
}

function deriveFreshnessPosture(
  activatedAt: string | null | undefined,
  policy: Awaited<ReturnType<typeof getPipelineHealthPolicy>>
): FreshnessPosture {
  if (!activatedAt || !policy) return "unknown";
  const age = minutesSince(activatedAt);
  if (age <= policy.fresh_after_minutes) return "fresh";
  if (age <= policy.aging_after_minutes) return "aging";
  if (age <= policy.stale_after_minutes) return "stale";
  return "expired";
}

export function createPipelineHealthBuilder(db: D1Database): PipelineHealthBuilder {
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async build(input: PipelineHealthBuildInput): Promise<PipelineHealthBuildOutput> {
      const policy = await getPipelineHealthPolicy(db, input.domainKey);
      if (!policy) {
        throw new AppError(400, "BLOCKED", "Pipeline health policy not found for domain");
      }
      const contractBundle = await getContractBundleById(db, input.contractBundleId);
      if (!contractBundle) {
        throw new AppError(400, "CONTRACT_MISMATCH", "Contract bundle not found for pipeline health build");
      }

      const pointer = await getActivePointerForDomain(db, input.domainKey);
      const activeBatch = pointer?.active_mirror_batch_id
        ? await getMirrorBatchById(db, pointer.active_mirror_batch_id)
        : null;

      const latestMirrorEvent = await getLatestSystemStateEventForDomain(db, input.domainKey, [
        "mirror_intake",
        "mirror_reconciliation",
      ]);
      const latestActivationEvent = await getLatestSystemStateEventForDomain(db, input.domainKey, [
        "mirror_activation",
      ]);
      const latestValidationEvent = await getLatestSystemStateEventForDomain(db, input.domainKey, [
        "local_validation",
      ]);

      const freshnessPosture = deriveFreshnessPosture(pointer?.activated_at ?? null, policy);

      let validationPosture: ValidationPosture = "unknown";
      if (latestValidationEvent?.event_status === "failed") {
        validationPosture = "validation_failed";
      } else if (activeBatch?.source_validation_batch_id) {
        validationPosture = "validated";
      } else if (policy.validation_required === 1) {
        validationPosture = "validation_blocked";
      }

      let activeBatchPosture: ActiveBatchPosture = "missing";
      if (pointer && activeBatch) {
        if (activeBatch.status !== "active") {
          activeBatchPosture = "blocked";
        } else if (minutesSince(pointer.activated_at) > policy.mirror_lag_tolerance_minutes) {
          activeBatchPosture = "lagging";
        } else {
          activeBatchPosture = "current";
        }
      }

      let mirrorPosture: MirrorPosture = "unknown";
      if (!pointer || !activeBatch) {
        mirrorPosture =
          latestMirrorEvent?.event_type === "mirror_reconciliation" &&
          latestMirrorEvent.event_status === "failed"
            ? "reconciliation_failed"
            : latestMirrorEvent?.event_type === "mirror_intake" && latestMirrorEvent.event_status === "failed"
              ? "mirror_failed"
              : "activation_blocked";
      } else if (activeBatch.status !== "active") {
        mirrorPosture = "activation_blocked";
      } else if (
        latestMirrorEvent?.event_status === "failed" &&
        eventOccurredAfter(latestMirrorEvent.event_time, pointer.activated_at)
      ) {
        mirrorPosture =
          latestMirrorEvent.event_type === "mirror_reconciliation"
            ? "reconciliation_failed"
            : "mirror_failed";
      } else if (minutesSince(pointer.activated_at) > policy.mirror_lag_tolerance_minutes) {
        mirrorPosture = "lagging";
      } else {
        mirrorPosture = "active";
      }

      const contractPosture: ContractPosture =
        activeBatch && activeBatch.contract_bundle_id === input.contractBundleId ? "matched" : "mismatch";

      const reasonCodes: string[] = [];
      if (!pointer || !activeBatch) reasonCodes.push("ACTIVE_BATCH_MISSING");
      if (activeBatchPosture === "lagging") reasonCodes.push("ACTIVE_BATCH_LAGGING");
      if (freshnessPosture === "stale") reasonCodes.push("DATA_STALE");
      if (freshnessPosture === "expired") reasonCodes.push("DATA_EXPIRED");
      if (mirrorPosture === "mirror_failed") reasonCodes.push("MIRROR_FAILED");
      if (mirrorPosture === "reconciliation_failed") reasonCodes.push("RECONCILIATION_FAILED");
      if (mirrorPosture === "activation_blocked") reasonCodes.push("ACTIVATION_BLOCKED");
      if (validationPosture === "validation_failed") reasonCodes.push("VALIDATION_FAILED");
      if (contractPosture === "mismatch") reasonCodes.push("CONTRACT_MISMATCH");

      let domainTrustPosture: DomainTrustPosture = "trusted";
      if (activeBatchPosture === "missing" || activeBatchPosture === "blocked") {
        domainTrustPosture = "unavailable";
      } else if (
        contractPosture === "mismatch" ||
        validationPosture === "validation_failed" ||
        mirrorPosture === "mirror_failed" ||
        mirrorPosture === "reconciliation_failed"
      ) {
        domainTrustPosture = "degraded";
      } else if (
        freshnessPosture === "stale" ||
        freshnessPosture === "expired" ||
        activeBatchPosture === "lagging" ||
        mirrorPosture === "lagging"
      ) {
        domainTrustPosture = "stale";
      }

      const warningCount = reasonCodes.filter((code) => code.includes("LAGGING") || code.includes("STALE")).length;
      const errorCount = reasonCodes.filter(
        (code) =>
          code.includes("FAILED") ||
          code.includes("MISMATCH") ||
          code.includes("BLOCKED")
      ).length;
      const blockingCount = reasonCodes.filter(
        (code) => code.includes("MISSING") || code.includes("BLOCKED") || code.includes("EXPIRED")
      ).length;

      const persisted = await persistPipelineHealthSnapshot(db, {
        domainKey: input.domainKey,
        contractBundleId: input.contractBundleId,
        latestCollectionEventId: latestMirrorEvent?.system_state_event_id ?? null,
        latestValidationEventId: latestValidationEvent?.system_state_event_id ?? null,
        latestMirrorEventId: latestMirrorEvent?.system_state_event_id ?? null,
        latestActivationEventId: latestActivationEvent?.system_state_event_id ?? null,
        latestContractEventId: null,
        latestLocalRunAt: latestMirrorEvent?.event_time ?? null,
        latestSuccessfulLocalRunAt:
          latestMirrorEvent?.event_status !== "failed" ? latestMirrorEvent?.event_time ?? null : null,
        latestValidatedBatchId: activeBatch?.source_validation_batch_id ?? null,
        latestValidatedDataThrough: activeBatch?.batch_date_end ?? null,
        latestMirrorAttemptAt: latestMirrorEvent?.event_time ?? null,
        latestMirrorBatchId: latestMirrorEvent?.mirror_batch_id ?? activeBatch?.mirror_batch_id ?? null,
        activeMirrorBatchId: activeBatch?.mirror_batch_id ?? null,
        latestActiveBatchActivatedAt: pointer?.activated_at ?? null,
        activeDataThrough: activeBatch?.batch_date_end ?? null,
        freshnessPosture,
        validationPosture,
        mirrorPosture,
        activeBatchPosture,
        contractPosture,
        domainTrustPosture,
        warningCount,
        errorCount,
        blockingCount,
        statusSummary: `${domainTrustPosture}|${freshnessPosture}|${mirrorPosture}|${activeBatchPosture}|${contractPosture}`,
        effectiveStateReasonCodes: JSON.stringify(reasonCodes),
        latestFailureCode: latestMirrorEvent?.failure_code ?? latestValidationEvent?.failure_code ?? null,
        latestFailureMessage:
          latestMirrorEvent?.failure_message ?? latestValidationEvent?.failure_message ?? null,
        notes: null,
      });

      await provenanceBuilder.build({
        objectType: "pipeline_health_snapshot",
        objectId: persisted.pipelineHealthSnapshotId,
        contractBundleId: input.contractBundleId,
        sourceBatchIds: activeBatch?.source_validation_batch_id ? [activeBatch.source_validation_batch_id] : [],
        pipelineHealthSnapshotIds: [],
        upstreamObjectRefs: [
          ...(activeBatch ? [{ objectType: "mirror_batch", objectId: activeBatch.mirror_batch_id }] : []),
          ...(latestMirrorEvent
            ? [{ objectType: "system_state_event", objectId: latestMirrorEvent.system_state_event_id }]
            : []),
          ...(latestActivationEvent
            ? [{ objectType: "system_state_event", objectId: latestActivationEvent.system_state_event_id }]
            : []),
        ],
        createdByType: "pipeline_health_builder",
        createdById: "pipeline_health_builder",
        metadata: {
          domainKey: input.domainKey,
          activeMirrorBatchId: activeBatch?.mirror_batch_id ?? null,
          reasonCodes,
        },
      });

      const current = await getCurrentPipelineHealthSnapshot(db, input.domainKey);
      if (!current || current.pipeline_health_snapshot_id !== persisted.pipelineHealthSnapshotId) {
        throw new AppError(500, "CONSISTENCY_MISMATCH", "Current pipeline health snapshot did not bind atomically");
      }

      return {
        pipelineHealthSnapshotId: persisted.pipelineHealthSnapshotId,
        domainKey: input.domainKey,
        activeMirrorBatchId: activeBatch?.mirror_batch_id ?? null,
        domainTrustPosture,
        freshnessPosture,
        validationPosture,
        mirrorPosture,
        activeBatchPosture,
        contractPosture,
      };
    },
  };
}
