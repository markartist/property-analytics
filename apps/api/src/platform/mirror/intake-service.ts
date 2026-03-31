import { AppError } from "../../lib/validate";
import type { MirrorIntakeService, MirrorIntakeInput, MirrorIntakeOutput } from "../phase1-interfaces";
import { createContractBundleResolver } from "../contract-bundles/resolver";
import { createProvenanceBuilder } from "../shared/provenance-builder";
import { stableHash } from "../shared/stable-hash";
import {
  createMirrorBatch,
  createMirrorBatchSlices,
  createSystemStateEvent,
  finalizeMirrorBatchAfterPersistence,
  getMirrorBatch,
  markMirrorBatchFailed,
  markSliceWritten,
  persistGa4SliceRecords,
  persistPsiSliceRecords,
  type PersistGa4RecordInput,
  type PersistPsiRecordInput,
  type PersistedSliceSummary,
} from "./repository";

interface Ga4SliceRecord {
  propertyId: string;
  metricDate: string;
  ga4PropertyId?: string | null;
  totalUsers?: number | null;
  newUsers?: number | null;
  sessions?: number | null;
  pageviews?: number | null;
  avgSessionDurationSeconds?: number | null;
  bounceRate?: number | null;
}

interface PsiSliceRecord {
  propertyId: string;
  metricDate: string;
  strategy: "mobile" | "desktop";
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  lcpSeconds?: number | null;
  clsValue?: number | null;
  fcpSeconds?: number | null;
  tbtMs?: number | null;
  inpMs?: number | null;
  ttfbMs?: number | null;
}

type SupportedTargetTable = "platform_ga4_daily_metrics" | "platform_psi_daily_metrics";

function parseRecordsJson<T>(recordsJson: string, targetTable: SupportedTargetTable): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(recordsJson);
  } catch (error) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Slice payload for ${targetTable} is not valid JSON`,
      [error instanceof Error ? error.message : String(error)]
    );
  }
  if (!Array.isArray(parsed)) {
    throw new AppError(400, "VALIDATION_ERROR", `Slice payload for ${targetTable} must be an array`);
  }
  return parsed as T[];
}

function assertIsoDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${fieldName} must be a YYYY-MM-DD string`);
  }
  return value;
}

function assertOptionalNumber(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${fieldName} must be numeric when provided`);
  }
  return value;
}

function computeSliceChecksum(rowHashes: string[]): string {
  return stableHash([rowHashes.length, ...[...rowHashes].sort()]);
}

function buildGa4Record(
  input: MirrorIntakeInput,
  raw: Ga4SliceRecord
): PersistGa4RecordInput {
  if (typeof raw.propertyId !== "string" || raw.propertyId.trim() === "") {
    throw new AppError(400, "VALIDATION_ERROR", "GA4 slice record requires propertyId");
  }
  const metricDate = assertIsoDate(raw.metricDate, "ga4.metricDate");
  const propertyId = raw.propertyId.trim();
  const normalized: PersistGa4RecordInput = {
    mirrorBatchId: input.mirrorBatchId,
    domainKey: input.domainKey,
    sourceValidationBatchId: input.sourceValidationBatchId,
    schemaBundleVersion: input.schemaBundleVersion,
    payloadContractVersion: input.payloadContractVersion,
    propertyId,
    ga4PropertyId:
      raw.ga4PropertyId === undefined || raw.ga4PropertyId === null ? null : String(raw.ga4PropertyId),
    metricDate,
    totalUsers: assertOptionalNumber(raw.totalUsers, "ga4.totalUsers"),
    newUsers: assertOptionalNumber(raw.newUsers, "ga4.newUsers"),
    sessions: assertOptionalNumber(raw.sessions, "ga4.sessions"),
    pageviews: assertOptionalNumber(raw.pageviews, "ga4.pageviews"),
    avgSessionDurationSeconds: assertOptionalNumber(
      raw.avgSessionDurationSeconds,
      "ga4.avgSessionDurationSeconds"
    ),
    bounceRate: assertOptionalNumber(raw.bounceRate, "ga4.bounceRate"),
    sourceRowHash: "",
  };
  normalized.sourceRowHash = stableHash([
    "ga4",
    normalized.propertyId,
    normalized.metricDate,
    normalized.ga4PropertyId,
    normalized.totalUsers,
    normalized.newUsers,
    normalized.sessions,
    normalized.pageviews,
    normalized.avgSessionDurationSeconds,
    normalized.bounceRate,
  ]);
  return normalized;
}

function buildPsiRecord(
  input: MirrorIntakeInput,
  raw: PsiSliceRecord
): PersistPsiRecordInput {
  if (typeof raw.propertyId !== "string" || raw.propertyId.trim() === "") {
    throw new AppError(400, "VALIDATION_ERROR", "PSI slice record requires propertyId");
  }
  if (raw.strategy !== "mobile" && raw.strategy !== "desktop") {
    throw new AppError(400, "VALIDATION_ERROR", "PSI slice record requires strategy mobile|desktop");
  }
  const metricDate = assertIsoDate(raw.metricDate, "psi.metricDate");
  const normalized: PersistPsiRecordInput = {
    mirrorBatchId: input.mirrorBatchId,
    domainKey: input.domainKey,
    sourceValidationBatchId: input.sourceValidationBatchId,
    schemaBundleVersion: input.schemaBundleVersion,
    payloadContractVersion: input.payloadContractVersion,
    propertyId: raw.propertyId.trim(),
    metricDate,
    strategy: raw.strategy,
    performanceScore: assertOptionalNumber(raw.performanceScore, "psi.performanceScore"),
    accessibilityScore: assertOptionalNumber(raw.accessibilityScore, "psi.accessibilityScore"),
    bestPracticesScore: assertOptionalNumber(raw.bestPracticesScore, "psi.bestPracticesScore"),
    seoScore: assertOptionalNumber(raw.seoScore, "psi.seoScore"),
    lcpSeconds: assertOptionalNumber(raw.lcpSeconds, "psi.lcpSeconds"),
    clsValue: assertOptionalNumber(raw.clsValue, "psi.clsValue"),
    fcpSeconds: assertOptionalNumber(raw.fcpSeconds, "psi.fcpSeconds"),
    tbtMs: assertOptionalNumber(raw.tbtMs, "psi.tbtMs"),
    inpMs: assertOptionalNumber(raw.inpMs, "psi.inpMs"),
    ttfbMs: assertOptionalNumber(raw.ttfbMs, "psi.ttfbMs"),
    sourceRowHash: "",
  };
  normalized.sourceRowHash = stableHash([
    "psi",
    normalized.propertyId,
    normalized.metricDate,
    normalized.strategy,
    normalized.performanceScore,
    normalized.accessibilityScore,
    normalized.bestPracticesScore,
    normalized.seoScore,
    normalized.lcpSeconds,
    normalized.clsValue,
    normalized.fcpSeconds,
    normalized.tbtMs,
    normalized.inpMs,
    normalized.ttfbMs,
  ]);
  return normalized;
}

async function persistSlice(
  db: D1Database,
  input: MirrorIntakeInput,
  slice: MirrorIntakeInput["payloadSlices"][number]
): Promise<PersistedSliceSummary> {
  switch (slice.targetTable as SupportedTargetTable) {
    case "platform_ga4_daily_metrics": {
      const records = parseRecordsJson<Ga4SliceRecord>(slice.recordsJson, "platform_ga4_daily_metrics");
      const normalized = records.map((record) => buildGa4Record(input, record));
      await persistGa4SliceRecords(db, normalized);
      return {
        mirrorBatchSliceId: slice.mirrorBatchSliceId,
        targetTable: slice.targetTable,
        sliceKey: slice.sliceKey,
        rowCountExpected: slice.rowCountExpected,
        rowCountReceived: normalized.length,
        sliceChecksumExpected: slice.sliceChecksumExpected,
        sliceChecksumReceived: computeSliceChecksum(normalized.map((record) => record.sourceRowHash)),
      };
    }
    case "platform_psi_daily_metrics": {
      const records = parseRecordsJson<PsiSliceRecord>(slice.recordsJson, "platform_psi_daily_metrics");
      const normalized = records.map((record) => buildPsiRecord(input, record));
      await persistPsiSliceRecords(db, normalized);
      return {
        mirrorBatchSliceId: slice.mirrorBatchSliceId,
        targetTable: slice.targetTable,
        sliceKey: slice.sliceKey,
        rowCountExpected: slice.rowCountExpected,
        rowCountReceived: normalized.length,
        sliceChecksumExpected: slice.sliceChecksumExpected,
        sliceChecksumReceived: computeSliceChecksum(normalized.map((record) => record.sourceRowHash)),
      };
    }
    default:
      throw new AppError(400, "VALIDATION_ERROR", `Unsupported mirror target table: ${slice.targetTable}`);
  }
}

export function createMirrorIntakeService(db: D1Database): MirrorIntakeService {
  const bundleResolver = createContractBundleResolver(db);
  const provenanceBuilder = createProvenanceBuilder(db);

  return {
    async ingest(input: MirrorIntakeInput): Promise<MirrorIntakeOutput> {
      if (!input.payloadSlices.length) {
        throw new AppError(400, "VALIDATION_ERROR", "Mirror intake requires at least one payload slice");
      }
      if (input.rowCountTotalExpected <= 0) {
        throw new AppError(400, "VALIDATION_ERROR", "Mirror intake requires positive expected row count");
      }

      const existing = await getMirrorBatch(db, input.mirrorBatchId);
      if (existing) {
        if (
          existing.domain_key === input.domainKey &&
          existing.source_validation_batch_id === input.sourceValidationBatchId
        ) {
          return {
            mirrorBatchId: existing.mirror_batch_id,
            domainKey: existing.domain_key,
            status: existing.status === "failed" ? "failed" : "mirrored",
            persistedSliceCount: input.payloadSlices.length,
            contractBundleId: existing.contract_bundle_id ?? input.contractBundleId,
          };
        }
        throw new AppError(409, "VALIDATION_ERROR", "Conflicting mirror_batch_id replay detected");
      }

      const resolvedBundle = await bundleResolver.resolve({
        contextType: "mirror_intake",
        requestedContractBundleId: input.contractBundleId,
        contextObjectType: "mirror_batch",
        contextObjectId: input.mirrorBatchId,
      });

      try {
        await createMirrorBatch(db, {
          mirrorBatchId: input.mirrorBatchId,
          domainKey: input.domainKey,
          sourceValidationBatchId: input.sourceValidationBatchId,
          sourceSnapshotId: input.sourceSnapshotId,
          schemaBundleVersion: input.schemaBundleVersion,
          validatorBundleVersion: input.validatorBundleVersion,
          mirrorBundleVersion: input.mirrorBundleVersion,
          payloadContractVersion: input.payloadContractVersion,
          contractBundleId: resolvedBundle.resolvedContractBundleId,
          batchDateStart: input.batchDateStart,
          batchDateEnd: input.batchDateEnd,
          rowCountTotalExpected: input.rowCountTotalExpected,
          checksumManifest: input.checksumManifest,
          sourceHost: input.sourceHost,
          operatorId: input.operatorId ?? null,
        });
        await createMirrorBatchSlices(db, {
          mirrorBatchId: input.mirrorBatchId,
          domainKey: input.domainKey,
          slices: input.payloadSlices.map((slice) => ({
            mirrorBatchSliceId: slice.mirrorBatchSliceId,
            targetTable: slice.targetTable,
            sliceKey: slice.sliceKey,
            rowCountExpected: slice.rowCountExpected,
            sliceChecksumExpected: slice.sliceChecksumExpected,
          })),
        });

        const persistedSummaries: PersistedSliceSummary[] = [];
        for (const slice of input.payloadSlices) {
          const summary = await persistSlice(db, input, slice);
          persistedSummaries.push(summary);
          await markSliceWritten(db, summary);
        }

        const rowCountTotalReceived = persistedSummaries.reduce(
          (total, summary) => total + summary.rowCountReceived,
          0
        );
        await finalizeMirrorBatchAfterPersistence(db, input.mirrorBatchId, rowCountTotalReceived);

        await createSystemStateEvent(db, {
          domainKey: input.domainKey,
          eventType: "mirror_intake",
          eventStatus: "mirrored",
          severity: "info",
          sourceComponent: "mirror_intake_service",
          sourceHost: input.sourceHost,
          sourceValidationBatchId: input.sourceValidationBatchId,
          mirrorBatchId: input.mirrorBatchId,
          schemaBundleVersion: input.schemaBundleVersion,
          validatorBundleVersion: input.validatorBundleVersion,
          mirrorBundleVersion: input.mirrorBundleVersion,
          contractBundleId: resolvedBundle.resolvedContractBundleId,
          message: "Mirror batch persisted to D1 fact tables",
          metadata: {
            sliceCount: persistedSummaries.length,
            rowCountTotalExpected: input.rowCountTotalExpected,
            rowCountTotalReceived,
          },
        });

        await provenanceBuilder.build({
          objectType: "mirror_batch",
          objectId: input.mirrorBatchId,
          contractBundleId: resolvedBundle.resolvedContractBundleId,
          sourceBatchIds: [input.sourceValidationBatchId],
          pipelineHealthSnapshotIds: [],
          upstreamObjectRefs: [
            { objectType: "local_validation_batch", objectId: input.sourceValidationBatchId },
          ],
          createdByType: "mirror_intake_service",
          createdById: "mirror_intake_service",
          metadata: {
            domainKey: input.domainKey,
            batchDateStart: input.batchDateStart,
            batchDateEnd: input.batchDateEnd,
            rowCountTotalExpected: input.rowCountTotalExpected,
            rowCountTotalReceived,
          },
        });

        return {
          mirrorBatchId: input.mirrorBatchId,
          domainKey: input.domainKey,
          status: "mirrored",
          persistedSliceCount: persistedSummaries.length,
          contractBundleId: resolvedBundle.resolvedContractBundleId,
        };
      } catch (error) {
        const failureMessage = error instanceof Error ? error.message : String(error);
        await markMirrorBatchFailed(db, input.mirrorBatchId, "MIRROR_WRITE_FAILED", failureMessage);
        await createSystemStateEvent(db, {
          domainKey: input.domainKey,
          eventType: "mirror_intake",
          eventStatus: "failed",
          severity: "high",
          sourceComponent: "mirror_intake_service",
          sourceHost: input.sourceHost,
          sourceValidationBatchId: input.sourceValidationBatchId,
          mirrorBatchId: input.mirrorBatchId,
          schemaBundleVersion: input.schemaBundleVersion,
          validatorBundleVersion: input.validatorBundleVersion,
          mirrorBundleVersion: input.mirrorBundleVersion,
          contractBundleId: resolvedBundle.resolvedContractBundleId,
          message: "Mirror intake failed while persisting fact rows",
          metadata: {
            rowCountTotalExpected: input.rowCountTotalExpected,
          },
          failureCode: "MIRROR_WRITE_FAILED",
          failureMessage,
        });
        throw error;
      }
    },
  };
}
