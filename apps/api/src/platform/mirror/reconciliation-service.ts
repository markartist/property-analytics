import { AppError } from "../../lib/validate";
import type {
  MirrorReconciliationInput,
  MirrorReconciliationOutput,
  MirrorReconciliationService,
} from "../phase1-interfaces";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import { stableHash } from "../shared/stable-hash";
import {
  countPersistedGa4RowsForSlice,
  countPersistedPsiRowsForSlice,
  createSystemStateEvent,
  getMirrorBatch,
  listMirrorBatchSlices,
  listPersistedGa4RowHashesForSlice,
  listPersistedPsiRowHashesForSlice,
  markMirrorBatchReconciled,
  markMirrorBatchReconciling,
  markMirrorBatchSliceFailed,
  markMirrorBatchSliceReconciled,
  quarantineMirrorBatch,
} from "./repository";

function computeSliceChecksum(rowHashes: string[]): string {
  return stableHash([rowHashes.length, ...[...rowHashes].sort()]);
}

function computeBatchChecksum(sliceChecksums: Array<{ targetTable: string; sliceKey: string; checksum: string }>): string {
  return stableHash(
    sliceChecksums
      .slice()
      .sort((a, b) => `${a.targetTable}:${a.sliceKey}`.localeCompare(`${b.targetTable}:${b.sliceKey}`))
      .flatMap((entry) => [entry.targetTable, entry.sliceKey, entry.checksum])
  );
}

function parseBatchChecksumManifest(checksumManifest: string): { batchChecksum?: string | null } {
  try {
    const parsed = JSON.parse(checksumManifest) as Record<string, unknown>;
    return {
      batchChecksum:
        typeof parsed.batchChecksum === "string"
          ? parsed.batchChecksum
          : typeof parsed.batch_checksum === "string"
            ? parsed.batch_checksum
            : null,
    };
  } catch {
    return { batchChecksum: null };
  }
}

function metricDateFromSliceKey(sliceKey: string): string {
  const normalized = sliceKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AppError(400, "VALIDATION_ERROR", "Slice key must be a YYYY-MM-DD metric date");
  }
  return normalized;
}

export function createMirrorReconciliationService(db: D1Database): MirrorReconciliationService {
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async reconcile(input: MirrorReconciliationInput): Promise<MirrorReconciliationOutput> {
      const batch = await getMirrorBatch(db, input.mirrorBatchId);
      if (!batch) {
        throw new AppError(404, "NOT_FOUND", "Mirror batch not found");
      }
      if (batch.domain_key !== input.domainKey) {
        throw new AppError(400, "VALIDATION_ERROR", "Mirror batch domain does not match reconciliation domain");
      }
      if (!batch.contract_bundle_id) {
        throw new AppError(400, "BLOCKED", "Mirror batch is missing contract bundle context");
      }
      if (batch.status !== "mirrored" && batch.status !== "reconciling") {
        throw new AppError(400, "BLOCKED", "Only mirrored batches may be reconciled");
      }

      await markMirrorBatchReconciling(db, input.mirrorBatchId);

      const slices = await listMirrorBatchSlices(db, input.mirrorBatchId);
      if (!slices.length) {
        await quarantineMirrorBatch(
          db,
          input.mirrorBatchId,
          "RECONCILIATION_NO_SLICES",
          "Mirror batch has no slices to reconcile"
        );
        throw new AppError(400, "BLOCKED", "Mirror batch has no slices to reconcile");
      }

      const failures: Array<{ sliceId: string; code: string; message: string }> = [];
      const sliceChecksums: Array<{ targetTable: string; sliceKey: string; checksum: string }> = [];
      let reconciledRowTotal = 0;

      for (const slice of slices) {
        const metricDate = metricDateFromSliceKey(slice.slice_key);
        let actualCount = 0;
        let actualRowHashes: string[] = [];

        if (slice.target_table === "platform_ga4_daily_metrics") {
          actualCount = await countPersistedGa4RowsForSlice(db, input.mirrorBatchId, metricDate);
          actualRowHashes = await listPersistedGa4RowHashesForSlice(db, input.mirrorBatchId, metricDate);
        } else if (slice.target_table === "platform_psi_daily_metrics") {
          actualCount = await countPersistedPsiRowsForSlice(db, input.mirrorBatchId, metricDate);
          actualRowHashes = await listPersistedPsiRowHashesForSlice(db, input.mirrorBatchId, metricDate);
        } else {
          failures.push({
            sliceId: slice.mirror_batch_slice_id,
            code: "UNSUPPORTED_TARGET_TABLE",
            message: `Unsupported target table during reconciliation: ${slice.target_table}`,
          });
          continue;
        }

        const actualChecksum = computeSliceChecksum(actualRowHashes);
        reconciledRowTotal += actualCount;
        sliceChecksums.push({
          targetTable: slice.target_table,
          sliceKey: slice.slice_key,
          checksum: actualChecksum,
        });

        if (actualCount !== slice.row_count_expected) {
          failures.push({
            sliceId: slice.mirror_batch_slice_id,
            code: "ROW_COUNT_MISMATCH",
            message: `Expected ${slice.row_count_expected} rows but found ${actualCount} rows`,
          });
          continue;
        }

        if (slice.row_count_received !== actualCount) {
          failures.push({
            sliceId: slice.mirror_batch_slice_id,
            code: "SLICE_COMPLETENESS_MISMATCH",
            message: `Slice metadata row_count_received=${slice.row_count_received} does not match persisted count=${actualCount}`,
          });
          continue;
        }

        if (slice.slice_checksum_expected !== actualChecksum) {
          failures.push({
            sliceId: slice.mirror_batch_slice_id,
            code: "SLICE_CHECKSUM_MISMATCH",
            message: `Expected slice checksum ${slice.slice_checksum_expected} but computed ${actualChecksum}`,
          });
          continue;
        }
      }

      if (reconciledRowTotal !== batch.row_count_total_expected) {
        failures.push({
          sliceId: "__batch__",
          code: "BATCH_ROW_COUNT_MISMATCH",
          message: `Expected batch row count ${batch.row_count_total_expected} but reconciled ${reconciledRowTotal}`,
        });
      }

      const manifest = parseBatchChecksumManifest(batch.checksum_manifest);
      if (manifest.batchChecksum) {
        const actualBatchChecksum = computeBatchChecksum(sliceChecksums);
        if (manifest.batchChecksum !== actualBatchChecksum) {
          failures.push({
            sliceId: "__batch__",
            code: "BATCH_CHECKSUM_MISMATCH",
            message: `Expected batch checksum ${manifest.batchChecksum} but computed ${actualBatchChecksum}`,
          });
        }
      }

      if (failures.length) {
        for (const failure of failures) {
          if (failure.sliceId !== "__batch__") {
            await markMirrorBatchSliceFailed(
              db,
              failure.sliceId,
              failure.code,
              failure.message,
              "quarantined"
            );
          }
        }
        const failureMessage = failures.map((failure) => failure.message).join("; ");
        await quarantineMirrorBatch(db, input.mirrorBatchId, failures[0]!.code, failureMessage);
        await createSystemStateEvent(db, {
          domainKey: input.domainKey,
          eventType: "mirror_reconciliation",
          eventStatus: "failed",
          severity: "high",
          sourceComponent: "mirror_reconciliation_service",
          sourceHost: "cloudflare_worker",
          sourceValidationBatchId: batch.source_validation_batch_id,
          mirrorBatchId: input.mirrorBatchId,
          schemaBundleVersion: batch.schema_bundle_version,
          validatorBundleVersion: batch.validator_bundle_version,
          mirrorBundleVersion: batch.mirror_bundle_version,
          contractBundleId: batch.contract_bundle_id,
          message: "Mirror batch reconciliation failed and batch was quarantined",
          metadata: {
            failureCount: failures.length,
            failures,
            reconciledRowTotal,
          },
          failureCode: failures[0]!.code,
          failureMessage,
        });
        return {
          mirrorBatchId: input.mirrorBatchId,
          domainKey: input.domainKey,
          status: "quarantined",
          reconciledAt: null,
          failureCode: failures[0]!.code,
          failureMessage,
        };
      }

      for (const slice of slices) {
        await markMirrorBatchSliceReconciled(db, slice.mirror_batch_slice_id);
      }
      await markMirrorBatchReconciled(db, input.mirrorBatchId);
      await createSystemStateEvent(db, {
        domainKey: input.domainKey,
        eventType: "mirror_reconciliation",
        eventStatus: "reconciled",
        severity: "info",
        sourceComponent: "mirror_reconciliation_service",
        sourceHost: "cloudflare_worker",
        sourceValidationBatchId: batch.source_validation_batch_id,
        mirrorBatchId: input.mirrorBatchId,
        schemaBundleVersion: batch.schema_bundle_version,
        validatorBundleVersion: batch.validator_bundle_version,
        mirrorBundleVersion: batch.mirror_bundle_version,
        contractBundleId: batch.contract_bundle_id,
        message: "Mirror batch reconciliation succeeded",
        metadata: {
          sliceCount: slices.length,
          reconciledRowTotal,
        },
      });
      await provenanceBuilder.build({
        objectType: "mirror_reconciliation",
        objectId: input.mirrorBatchId,
        contractBundleId: batch.contract_bundle_id,
        sourceBatchIds: [batch.source_validation_batch_id],
        pipelineHealthSnapshotIds: [],
        upstreamObjectRefs: [{ objectType: "mirror_batch", objectId: input.mirrorBatchId }],
        createdByType: "mirror_reconciliation_service",
        createdById: input.reconciledBy,
        metadata: {
          reconciliationReason: input.reconciliationReason,
          sliceCount: slices.length,
          reconciledRowTotal,
        },
      });

      return {
        mirrorBatchId: input.mirrorBatchId,
        domainKey: input.domainKey,
        status: "reconciled",
        reconciledAt: new Date().toISOString(),
      };
    },
  };
}
