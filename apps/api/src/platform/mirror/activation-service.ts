import { AppError } from "../../lib/validate";
import type { ActivationService, ActivationInput, ActivationOutput } from "../phase1-interfaces";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import {
  createActivation,
  createSystemStateEvent,
  getActiveBatchPointer,
  getMirrorBatch,
} from "./repository";

export function createActivationService(db: D1Database): ActivationService {
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async activate(input: ActivationInput): Promise<ActivationOutput> {
      const batch = await getMirrorBatch(db, input.mirrorBatchId);
      if (!batch) {
        throw new AppError(404, "NOT_FOUND", "Mirror batch not found");
      }
      if (batch.domain_key !== input.domainKey) {
        throw new AppError(400, "VALIDATION_ERROR", "Mirror batch domain does not match activation domain");
      }
      if (batch.status !== "reconciled") {
        throw new AppError(400, "BLOCKED", "Only reconciled mirror batches may be activated");
      }
      if (!batch.contract_bundle_id) {
        throw new AppError(400, "BLOCKED", "Mirror batch is missing contract bundle context");
      }

      const priorPointer = await getActiveBatchPointer(db, input.domainKey);
      const previousMirrorBatchId = priorPointer?.active_mirror_batch_id ?? null;
      const activation = await createActivation(db, input, previousMirrorBatchId);

      await provenanceBuilder.build({
        objectType: "mirror_activation_event",
        objectId: activation.activationEventId,
        contractBundleId: batch.contract_bundle_id,
        sourceBatchIds: [batch.source_validation_batch_id],
        pipelineHealthSnapshotIds: [],
        upstreamObjectRefs: [{ objectType: "mirror_batch", objectId: input.mirrorBatchId }],
        createdByType: "activation_service",
        createdById: "activation_service",
        metadata: {
          domainKey: input.domainKey,
          previousMirrorBatchId,
          activationReason: input.activationReason,
        },
      });

      await createSystemStateEvent(db, {
        domainKey: input.domainKey,
        eventType: "mirror_activation",
        eventStatus: "activated",
        severity: "info",
        sourceComponent: "activation_service",
        sourceHost: "cloudflare_worker",
        sourceValidationBatchId: batch.source_validation_batch_id,
        mirrorBatchId: input.mirrorBatchId,
        activeMirrorBatchId: input.mirrorBatchId,
        schemaBundleVersion: batch.schema_bundle_version,
        validatorBundleVersion: batch.validator_bundle_version,
        mirrorBundleVersion: batch.mirror_bundle_version,
        contractBundleId: batch.contract_bundle_id,
        message: "Reconciled mirror batch activated",
        metadata: {
          previousMirrorBatchId,
          activationReason: input.activationReason,
          activatedBy: input.activatedBy,
        },
      });

      return {
        domainKey: input.domainKey,
        mirrorBatchId: input.mirrorBatchId,
        previousMirrorBatchId,
        activeAt: activation.activatedAt,
      };
    },
  };
}
