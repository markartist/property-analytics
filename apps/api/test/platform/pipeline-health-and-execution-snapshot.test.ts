import test from "node:test";
import assert from "node:assert/strict";

import { queryFirst, run } from "../../src/lib/db";
import { createExecutionSnapshotBuilder } from "../../src/platform/execution-snapshots/builder";
import { createMirrorIntakeService } from "../../src/platform/mirror/intake-service";
import { createMirrorReconciliationService } from "../../src/platform/mirror/reconciliation-service";
import { createActivationService } from "../../src/platform/mirror/activation-service";
import { createPipelineHealthBuilder } from "../../src/platform/pipeline-health/builder";
import { executionSnapshotHashCalculator } from "../../src/platform/shared/execution-snapshot-hash";
import { stableHash } from "../../src/platform/shared/stable-hash";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { seedPhase1PlatformBasics } from "../helpers/platform-seeds";

function buildGa4Input() {
  const records = [
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
  ];
  const rowHashes = records.map((record) =>
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
  );
  const sliceChecksum = stableHash([rowHashes.length, ...rowHashes.sort()]);
  const batchChecksum = stableHash(["platform_ga4_daily_metrics", "2026-03-28", sliceChecksum]);
  return {
    domainKey: "ga4" as const,
    mirrorBatchId: "mb_ga4_health_001",
    sourceValidationBatchId: "val_ga4_health_001",
    sourceSnapshotId: "snap_ga4_health_001",
    contractBundleId: "cb_phase1_v1",
    schemaBundleVersion: "schema_v1",
    validatorBundleVersion: "validator_v1",
    mirrorBundleVersion: "mirror_v1",
    payloadContractVersion: "payload_v1",
    batchDateStart: "2026-03-28",
    batchDateEnd: "2026-03-28",
    rowCountTotalExpected: 1,
    checksumManifest: JSON.stringify({ batchChecksum }),
    payloadSlices: [
      {
        mirrorBatchSliceId: "slice_ga4_health_001",
        targetTable: "platform_ga4_daily_metrics",
        sliceKey: "2026-03-28",
        rowCountExpected: 1,
        sliceChecksumExpected: sliceChecksum,
        recordsJson: JSON.stringify(records),
      },
    ],
    sourceHost: "local-mac",
    operatorId: "mark",
  };
}

function buildPsiInput() {
  const records = [
    {
      propertyId: "prop_1",
      metricDate: "2026-03-28",
      strategy: "mobile",
      performanceScore: 81,
      accessibilityScore: 95,
      bestPracticesScore: 88,
      seoScore: 92,
      lcpSeconds: 2.1,
      clsValue: 0.02,
      fcpSeconds: 1.3,
      tbtMs: 120,
      inpMs: 150,
      ttfbMs: 90,
    },
  ];
  const rowHashes = records.map((record) =>
    stableHash([
      "psi",
      record.propertyId,
      record.metricDate,
      record.strategy,
      record.performanceScore,
      record.accessibilityScore,
      record.bestPracticesScore,
      record.seoScore,
      record.lcpSeconds,
      record.clsValue,
      record.fcpSeconds,
      record.tbtMs,
      record.inpMs,
      record.ttfbMs,
    ])
  );
  const sliceChecksum = stableHash([rowHashes.length, ...rowHashes.sort()]);
  const batchChecksum = stableHash(["platform_psi_daily_metrics", "2026-03-28", sliceChecksum]);
  return {
    domainKey: "psi" as const,
    mirrorBatchId: "mb_psi_health_001",
    sourceValidationBatchId: "val_psi_health_001",
    sourceSnapshotId: "snap_psi_health_001",
    contractBundleId: "cb_phase1_v1",
    schemaBundleVersion: "schema_v1",
    validatorBundleVersion: "validator_v1",
    mirrorBundleVersion: "mirror_v1",
    payloadContractVersion: "payload_v1",
    batchDateStart: "2026-03-28",
    batchDateEnd: "2026-03-28",
    rowCountTotalExpected: 1,
    checksumManifest: JSON.stringify({ batchChecksum }),
    payloadSlices: [
      {
        mirrorBatchSliceId: "slice_psi_health_001",
        targetTable: "platform_psi_daily_metrics",
        sliceKey: "2026-03-28",
        rowCountExpected: 1,
        sliceChecksumExpected: sliceChecksum,
        recordsJson: JSON.stringify(records),
      },
    ],
    sourceHost: "local-mac",
    operatorId: "mark",
  };
}

async function activateHealthyBatches(db: D1Database) {
  const intake = createMirrorIntakeService(db);
  const reconcile = createMirrorReconciliationService(db);
  const activate = createActivationService(db);

  for (const input of [buildGa4Input(), buildPsiInput()]) {
    await intake.ingest(input);
    await reconcile.reconcile({
      domainKey: input.domainKey,
      mirrorBatchId: input.mirrorBatchId,
      reconciledBy: "mirror_reconciliation_service",
      reconciliationReason: "phase1_test",
    });
    await activate.activate({
      domainKey: input.domainKey,
      mirrorBatchId: input.mirrorBatchId,
      activationReason: "phase1_test",
      activatedBy: "test_runner",
    });
  }
}

test("pipeline health builder manages current snapshots atomically and applies posture precedence", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    await activateHealthyBatches(db);
    const builder = createPipelineHealthBuilder(db);

    const first = await builder.build({ domainKey: "ga4", contractBundleId: "cb_phase1_v1" });
    assert.equal(first.domainTrustPosture, "trusted");
    assert.equal(first.mirrorPosture, "active");

    await run(
      db,
      `UPDATE active_batch_pointers
       SET activated_at = datetime('now', '-4 hours')
       WHERE domain_key = 'ga4'`
    );
    await run(
      db,
      `INSERT INTO system_state_events (
        system_state_event_id, domain_key, event_type, event_status, severity, event_time,
        source_component, source_host, message, metadata_json, mirror_batch_id
      ) VALUES (?, 'ga4', 'mirror_reconciliation', 'failed', 'high', datetime('now', '+1 minute'),
        'test', 'test-host', 'reconciliation failed after activation', '{}', 'mb_ga4_health_001')`,
      ["evt_reconcile_fail_ga4"]
    );

    const second = await builder.build({ domainKey: "ga4", contractBundleId: "cb_phase1_v1" });
    assert.equal(second.mirrorPosture, "reconciliation_failed");
    assert.equal(second.domainTrustPosture, "degraded");

    const currentCount = await queryFirst<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count
       FROM pipeline_health_snapshots
       WHERE domain_key = 'ga4' AND is_current = 1`
    );
    assert.equal(currentCount?.count, 1);
  } finally {
    close();
  }
});

test("pipeline health builder produces stale and unavailable postures explicitly", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    await activateHealthyBatches(db);
    const builder = createPipelineHealthBuilder(db);

    await run(
      db,
      `UPDATE active_batch_pointers
       SET activated_at = ?
       WHERE domain_key = 'ga4'`
      ,
      [new Date(Date.now() - 121 * 60000).toISOString()]
    );
    const stale = await builder.build({ domainKey: "ga4", contractBundleId: "cb_phase1_v1" });
    assert.equal(stale.freshnessPosture, "stale");
    assert.equal(stale.domainTrustPosture, "stale");
    assert.equal(stale.activeBatchPosture, "lagging");

    await run(db, `DELETE FROM active_batch_pointers WHERE domain_key = 'psi'`);
    const unavailable = await builder.build({ domainKey: "psi", contractBundleId: "cb_phase1_v1" });
    assert.equal(unavailable.activeBatchPosture, "missing");
    assert.equal(unavailable.mirrorPosture, "activation_blocked");
    assert.equal(unavailable.domainTrustPosture, "unavailable");
  } finally {
    close();
  }
});

test("execution snapshot builder binds only current health snapshots and current active pointers", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    await activateHealthyBatches(db);

    const healthBuilder = createPipelineHealthBuilder(db);
    const ga4Health = await healthBuilder.build({ domainKey: "ga4", contractBundleId: "cb_phase1_v1" });
    const psiHealth = await healthBuilder.build({ domainKey: "psi", contractBundleId: "cb_phase1_v1" });

    const snapshotBuilder = createExecutionSnapshotBuilder(db);
    const snapshot = await snapshotBuilder.create({
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      executionIntent: "property_monitoring",
      executionConsumerType: "property_advocate",
      executionConsumerId: "agent_prop_1",
      triggerType: "scheduled",
      triggerSource: "test",
      triggerReferenceId: "trigger_001",
      requestedContractBundleId: "cb_phase1_v1",
      policyId: "exec_policy_property_advocate",
      createdBy: "test_runner",
      operatorId: "mark",
      requestedBy: "mark",
    });

    assert.equal(snapshot.domainBindingCount, 2);
    assert.deepEqual(
      snapshot.bindings.map((binding) => binding.domainKey),
      ["ga4", "psi"]
    );

    const stored = await queryFirst<{ binding_input_hash: string; pipeline_health_snapshot_set_hash: string }>(
      db,
      `SELECT binding_input_hash, pipeline_health_snapshot_set_hash
       FROM execution_snapshots
       WHERE execution_snapshot_id = ?`,
      [snapshot.executionSnapshotId]
    );
    assert.equal(stored?.binding_input_hash, snapshot.bindingInputHash);
    assert.equal(stored?.pipeline_health_snapshot_set_hash, snapshot.pipelineHealthSnapshotSetHash);

    const recomputedHash = executionSnapshotHashCalculator.calculate({
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      contractBundleId: "cb_phase1_v1",
      executionIntent: "property_monitoring",
      triggerType: "scheduled",
      triggerReferenceId: "trigger_001",
      snapshotTime: (
        await queryFirst<{ snapshot_time: string }>(
          db,
          `SELECT snapshot_time FROM execution_snapshots WHERE execution_snapshot_id = ?`,
          [snapshot.executionSnapshotId]
        )
      )!.snapshot_time,
      bindings: [
        {
          domainKey: "ga4",
          activeMirrorBatchId: ga4Health.activeMirrorBatchId!,
          pipelineHealthSnapshotId: ga4Health.pipelineHealthSnapshotId,
        },
        {
          domainKey: "psi",
          activeMirrorBatchId: psiHealth.activeMirrorBatchId!,
          pipelineHealthSnapshotId: psiHealth.pipelineHealthSnapshotId,
        },
      ],
    });
    assert.equal(recomputedHash, snapshot.bindingInputHash);

    await run(
      db,
      `INSERT INTO mirror_batches (
        mirror_batch_id, domain_key, source_validation_batch_id, source_snapshot_id,
        schema_bundle_version, validator_bundle_version, mirror_bundle_version,
        payload_contract_version, contract_bundle_id, batch_date_start, batch_date_end,
        row_count_total_expected, row_count_total_received, checksum_manifest, status
      ) VALUES (?, 'psi', 'val_psi_health_drift', 'snap_psi_health_drift', 'schema_v1', 'validator_v1',
        'mirror_v1', 'payload_v1', 'cb_phase1_v1', '2026-03-28', '2026-03-28', 0, 0, '{}', 'active')`,
      ["mb_psi_health_drift"]
    );

    await run(
      db,
      `UPDATE active_batch_pointers
       SET active_mirror_batch_id = 'mb_psi_health_drift'
       WHERE domain_key = 'psi'`
    );

    await assert.rejects(
      () =>
        snapshotBuilder.create({
          scopeType: "property",
          propertyId: "prop_1",
          cohortKey: null,
          portfolioScopeKey: null,
          executionIntent: "property_monitoring",
          executionConsumerType: "property_advocate",
          executionConsumerId: "agent_prop_1",
          triggerType: "scheduled",
          triggerSource: "test",
          triggerReferenceId: "trigger_002",
          requestedContractBundleId: "cb_phase1_v1",
          policyId: "exec_policy_property_advocate",
          createdBy: "test_runner",
          operatorId: "mark",
          requestedBy: "mark",
        }),
      /Active batch pointer drift detected/
    );
  } finally {
    close();
  }
});
