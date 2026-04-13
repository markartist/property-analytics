import test from "node:test";
import assert from "node:assert/strict";

import { queryAll, queryFirst } from "../../src/lib/db";
import { createActivationService } from "../../src/platform/mirror/activation-service";
import { createMirrorIntakeService } from "../../src/platform/mirror/intake-service";
import { createMirrorReconciliationService } from "../../src/platform/mirror/reconciliation-service";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { seedPhase1PlatformBasics } from "../helpers/platform-seeds";

function ga4SliceInput(overrides?: Record<string, unknown>) {
  return {
    domainKey: "ga4",
    mirrorBatchId: "mb_ga4_001",
    sourceValidationBatchId: "val_ga4_001",
    sourceSnapshotId: "snap_ga4_001",
    contractBundleId: "cb_phase1_v1",
    schemaBundleVersion: "schema_v1",
    validatorBundleVersion: "validator_v1",
    mirrorBundleVersion: "mirror_v1",
    payloadContractVersion: "payload_v1",
    batchDateStart: "2026-03-28",
    batchDateEnd: "2026-03-28",
    rowCountTotalExpected: 2,
    checksumManifest: JSON.stringify({ batchChecksum: "pending" }),
    payloadSlices: [
      {
        mirrorBatchSliceId: "slice_ga4_001",
        targetTable: "platform_ga4_daily_metrics",
        sliceKey: "2026-03-28",
        rowCountExpected: 2,
        sliceChecksumExpected: "pending",
        recordsJson: JSON.stringify([
          {
            propertyId: "prop_1",
            metricDate: "2026-03-28",
            ga4PropertyId: "ga4_1",
            totalUsers: 100,
            newUsers: 25,
            sessions: 110,
            pageviews: 220,
            avgSessionDurationSeconds: 75.5,
            bounceRate: 0.42,
          },
          {
            propertyId: "prop_2",
            metricDate: "2026-03-28",
            ga4PropertyId: "ga4_2",
            totalUsers: 140,
            newUsers: 30,
            sessions: 155,
            pageviews: 280,
            avgSessionDurationSeconds: 83.2,
            bounceRate: 0.37,
          },
        ]),
      },
    ],
    sourceHost: "local-mac",
    operatorId: "mark",
    ...(overrides ?? {}),
  };
}

async function prepareGa4Input() {
  const { stableHash } = await import("../../src/platform/shared/stable-hash");
  const input = ga4SliceInput();
  const records = JSON.parse(input.payloadSlices[0]!.recordsJson) as Array<Record<string, unknown>>;
  const rowHashes = records
    .map((record) =>
      stableHash([
        "ga4",
        record.propertyId,
        record.metricDate,
        record.ga4PropertyId,
        record.totalUsers,
        record.newUsers,
        record.sessions,
        record.pageviews,
        record.avgSessionDurationSeconds,
        record.bounceRate,
      ])
    )
    .sort();
  const sliceChecksum = stableHash([rowHashes.length, ...rowHashes]);
  const batchChecksum = stableHash(["platform_ga4_daily_metrics", "2026-03-28", sliceChecksum]);
  input.payloadSlices[0]!.sliceChecksumExpected = sliceChecksum;
  input.checksumManifest = JSON.stringify({ batchChecksum });
  return input;
}

test("mirror intake blocks conflicting mirror batch replay", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const intake = createMirrorIntakeService(db);
    const validInput = await prepareGa4Input();

    await intake.ingest(validInput);

    await assert.rejects(
      () =>
        intake.ingest({
          ...validInput,
          sourceValidationBatchId: "different_validation_batch",
        }),
      /Conflicting mirror_batch_id replay detected/
    );
  } finally {
    close();
  }
});

test("mirror intake persists fact rows and reconciliation succeeds deterministically", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const intake = createMirrorIntakeService(db);
    const reconcile = createMirrorReconciliationService(db);
    const activate = createActivationService(db);
    const input = await prepareGa4Input();

    const intakeResult = await intake.ingest(input);
    assert.equal(intakeResult.status, "mirrored");

    const persistedRows = await queryFirst<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count FROM platform_ga4_daily_metrics WHERE mirror_batch_id = ?`,
      [input.mirrorBatchId]
    );
    assert.equal(persistedRows?.count, 2);

    const reconcileResult = await reconcile.reconcile({
      domainKey: "ga4",
      mirrorBatchId: input.mirrorBatchId,
      reconciledBy: "mirror_reconciliation_service",
      reconciliationReason: "phase1_test",
    });
    assert.equal(reconcileResult.status, "reconciled");

    const batch = await queryFirst<{ status: string }>(
      db,
      `SELECT status FROM mirror_batches WHERE mirror_batch_id = ?`,
      [input.mirrorBatchId]
    );
    assert.equal(batch?.status, "reconciled");

    const activation = await activate.activate({
      domainKey: "ga4",
      mirrorBatchId: input.mirrorBatchId,
      activationReason: "phase1_test",
      activatedBy: "test_runner",
    });
    assert.equal(activation.mirrorBatchId, input.mirrorBatchId);

    const pointer = await queryFirst<{ active_mirror_batch_id: string }>(
      db,
      `SELECT active_mirror_batch_id FROM active_batch_pointers WHERE domain_key = 'ga4'`
    );
    assert.equal(pointer?.active_mirror_batch_id, input.mirrorBatchId);
  } finally {
    close();
  }
});

test("reconciliation quarantines batches when deterministic checks fail", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const intake = createMirrorIntakeService(db);
    const reconcile = createMirrorReconciliationService(db);
    const input = await prepareGa4Input();
    input.payloadSlices[0]!.rowCountExpected = 3;
    input.rowCountTotalExpected = 3;

    await intake.ingest(input);

    const reconcileResult = await reconcile.reconcile({
      domainKey: "ga4",
      mirrorBatchId: input.mirrorBatchId,
      reconciledBy: "mirror_reconciliation_service",
      reconciliationReason: "phase1_test",
    });
    assert.equal(reconcileResult.status, "quarantined");
    assert.equal(reconcileResult.failureCode, "ROW_COUNT_MISMATCH");

    const slice = await queryFirst<{ status: string; failure_code: string | null }>(
      db,
      `SELECT status, failure_code
       FROM mirror_batch_slices
       WHERE mirror_batch_slice_id = ?`,
      [input.payloadSlices[0]!.mirrorBatchSliceId]
    );
    assert.equal(slice?.status, "quarantined");
    assert.equal(slice?.failure_code, "ROW_COUNT_MISMATCH");
  } finally {
    close();
  }
});

test("activation remains atomic when batch persistence fails", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const intake = createMirrorIntakeService(db);
    const reconcile = createMirrorReconciliationService(db);
    const activate = createActivationService(db);

    const input1 = await prepareGa4Input();
    await intake.ingest(input1);
    await reconcile.reconcile({
      domainKey: "ga4",
      mirrorBatchId: input1.mirrorBatchId,
      reconciledBy: "mirror_reconciliation_service",
      reconciliationReason: "phase1_test",
    });
    await activate.activate({
      domainKey: "ga4",
      mirrorBatchId: input1.mirrorBatchId,
      activationReason: "seed_active_pointer",
      activatedBy: "test_runner",
    });

    const input2 = await prepareGa4Input();
    input2.mirrorBatchId = "mb_ga4_002";
    input2.sourceValidationBatchId = "val_ga4_002";
    input2.sourceSnapshotId = "snap_ga4_002";
    input2.payloadSlices[0]!.mirrorBatchSliceId = "slice_ga4_002";
    await intake.ingest(input2);

    await assert.rejects(
      () =>
        activate.activate({
          domainKey: "ga4",
          mirrorBatchId: input2.mirrorBatchId,
          activationReason: "should_block",
          activatedBy: "test_runner",
        }),
      /Only reconciled mirror batches may be activated/
    );

    const pointer = await queryFirst<{ active_mirror_batch_id: string; previous_mirror_batch_id: string | null }>(
      db,
      `SELECT active_mirror_batch_id, previous_mirror_batch_id
       FROM active_batch_pointers
       WHERE domain_key = 'ga4'`
    );
    assert.equal(pointer?.active_mirror_batch_id, input1.mirrorBatchId);
    assert.equal(pointer?.previous_mirror_batch_id, null);

    const activationEvents = await queryAll<{ mirror_batch_id: string }>(
      db,
      `SELECT mirror_batch_id FROM mirror_activation_events WHERE domain_key = 'ga4'`
    );
    assert.deepEqual(activationEvents.map((row) => row.mirror_batch_id), [input1.mirrorBatchId]);
  } finally {
    close();
  }
});
