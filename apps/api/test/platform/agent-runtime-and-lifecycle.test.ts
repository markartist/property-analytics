import test from "node:test";
import assert from "node:assert/strict";

import { queryFirst, run } from "../../src/lib/db";
import { createAgentRuntimeGateway } from "../../src/platform/agent-runtime/gateway";
import { createExecutionSnapshotBuilder } from "../../src/platform/execution-snapshots/builder";
import { createLifecycleEngine } from "../../src/platform/lifecycle/engine";
import { createActivationService } from "../../src/platform/mirror/activation-service";
import { createMirrorIntakeService } from "../../src/platform/mirror/intake-service";
import { createMirrorReconciliationService } from "../../src/platform/mirror/reconciliation-service";
import { runPropertyAdvocateFlow } from "../../src/platform/orchestration/property-advocate-runner";
import { createPipelineHealthBuilder } from "../../src/platform/pipeline-health/builder";
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
    mirrorBatchId: "mb_ga4_agent_001",
    sourceValidationBatchId: "val_ga4_agent_001",
    sourceSnapshotId: "snap_ga4_agent_001",
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
        mirrorBatchSliceId: "slice_ga4_agent_001",
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
    mirrorBatchId: "mb_psi_agent_001",
    sourceValidationBatchId: "val_psi_agent_001",
    sourceSnapshotId: "snap_psi_agent_001",
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
        mirrorBatchSliceId: "slice_psi_agent_001",
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

async function createHealthyExecutionSnapshot(db: D1Database) {
  await activateHealthyBatches(db);

  const healthBuilder = createPipelineHealthBuilder(db);
  await healthBuilder.build({ domainKey: "ga4", contractBundleId: "cb_phase1_v1" });
  await healthBuilder.build({ domainKey: "psi", contractBundleId: "cb_phase1_v1" });

  const snapshotBuilder = createExecutionSnapshotBuilder(db);
  return snapshotBuilder.create({
    scopeType: "property",
    propertyId: "prop_1",
    cohortKey: null,
    portfolioScopeKey: null,
    executionIntent: "property_monitoring",
    executionConsumerType: "property_advocate",
    executionConsumerId: "agent_prop_1",
    triggerType: "scheduled",
    triggerSource: "test",
    triggerReferenceId: "trigger_agent_001",
    requestedContractBundleId: "cb_phase1_v1",
    policyId: "exec_policy_property_advocate",
    createdBy: "test_runner",
    operatorId: "mark",
    requestedBy: "mark",
  });
}

test("agent runtime gateway requires execution snapshot and enforces minimum trust", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const snapshot = await createHealthyExecutionSnapshot(db);
    const gateway = createAgentRuntimeGateway(db);

    const started = await gateway.start({
      agentId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      triggerType: "scheduled",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
    });
    assert.equal(started.agentId, "agent_prop_1");

    const runtime = await queryFirst<{ contract_bundle_id: string }>(
      db,
      `SELECT contract_bundle_id FROM agent_runtime_bindings WHERE agent_runtime_binding_id = ?`,
      [started.agentRuntimeBindingId]
    );
    assert.equal(runtime?.contract_bundle_id, "cb_phase1_v1");

    await assert.rejects(
      () =>
        gateway.start({
          agentId: "agent_prop_1",
          executionSnapshotId: snapshot.executionSnapshotId,
          triggerType: "scheduled",
          scopeType: "property",
          propertyId: "prop_2",
          cohortKey: null,
          portfolioScopeKey: null,
        }),
      /scope does not match execution snapshot scope/
    );
  } finally {
    close();
  }
});

test("agent runtime gateway blocks stale bindings when contract requires trusted domains", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const snapshot = await createHealthyExecutionSnapshot(db);

    // make GA4 stale and refresh health/snapshot
    await run(
      db,
      `UPDATE active_batch_pointers
       SET activated_at = ?
       WHERE domain_key = 'ga4'`,
      [new Date(Date.now() - 120 * 60000).toISOString()]
    );
    await run(
      db,
      `UPDATE execution_snapshot_policies
       SET allow_stale_domains = 1
       WHERE execution_snapshot_policy_id = 'exec_policy_property_advocate'`
    );
    const healthBuilder = createPipelineHealthBuilder(db);
    await healthBuilder.build({ domainKey: "ga4", contractBundleId: "cb_phase1_v1" });
    await healthBuilder.build({ domainKey: "psi", contractBundleId: "cb_phase1_v1" });

    const snapshotBuilder = createExecutionSnapshotBuilder(db);
    const staleSnapshot = await snapshotBuilder.create({
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      executionIntent: "property_monitoring",
      executionConsumerType: "property_advocate",
      executionConsumerId: "agent_prop_1",
      triggerType: "scheduled",
      triggerSource: "test",
      triggerReferenceId: "trigger_agent_002",
      requestedContractBundleId: "cb_phase1_v1",
      policyId: "exec_policy_property_advocate",
      createdBy: "test_runner",
      operatorId: "mark",
      requestedBy: "mark",
    });

    const gateway = createAgentRuntimeGateway(db);
    await assert.rejects(
      () =>
        gateway.start({
          agentId: "agent_prop_1",
          executionSnapshotId: staleSnapshot.executionSnapshotId,
          triggerType: "scheduled",
          scopeType: "property",
          propertyId: "prop_1",
          cohortKey: null,
          portfolioScopeKey: null,
        }),
      /does not meet minimum trust posture/
    );

  } finally {
    close();
  }
});

test("lifecycle engine emits watch states and escalation candidates with deterministic dedupe suppression", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const snapshot = await createHealthyExecutionSnapshot(db);
    const lifecycle = createLifecycleEngine(db);

    const firstWatch = await lifecycle.emit({
      objectType: "watch_state",
      issueFamilyKey: "data_freshness_risk",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "medium",
      confidence: 0.75,
      reason: "Freshness is drifting",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T10:00:00.000Z",
      lastObservedAt: "2026-03-30T10:00:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["FRESHNESS_DRIFT"],
        normalizedSeverityBucket: "medium",
      },
    });
    assert.equal(firstWatch.status, "open");

    const secondWatch = await lifecycle.emit({
      objectType: "watch_state",
      issueFamilyKey: "data_freshness_risk",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "medium",
      confidence: 0.8,
      reason: "Freshness is drifting again",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T10:10:00.000Z",
      lastObservedAt: "2026-03-30T10:10:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["FRESHNESS_DRIFT"],
        normalizedSeverityBucket: "medium",
      },
    });
    assert.equal(secondWatch.status, "suppressed");
    assert.equal(secondWatch.dedupeKey, firstWatch.dedupeKey);

    const firstEscalation = await lifecycle.emit({
      objectType: "escalation_candidate",
      issueFamilyKey: "performance_regression",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "high",
      confidence: 0.91,
      reason: "Performance regressed materially",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T11:00:00.000Z",
      lastObservedAt: "2026-03-30T11:00:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["PERFORMANCE_DROP"],
        normalizedSeverityBucket: "high",
      },
    });
    assert.equal(firstEscalation.status, "under_review");

    const secondEscalation = await lifecycle.emit({
      objectType: "escalation_candidate",
      issueFamilyKey: "performance_regression",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "high",
      confidence: 0.93,
      reason: "Performance regressed materially again",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T11:20:00.000Z",
      lastObservedAt: "2026-03-30T11:20:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["PERFORMANCE_DROP"],
        normalizedSeverityBucket: "high",
      },
    });
    assert.equal(secondEscalation.status, "suppressed");
    assert.equal(secondEscalation.dedupeKey, firstEscalation.dedupeKey);

    const counts = await queryFirst<{ watch_count: number; escalation_count: number }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM watch_states) AS watch_count,
         (SELECT COUNT(*) FROM escalation_candidates) AS escalation_count`
    );
    assert.equal(counts?.watch_count, 2);
    assert.equal(counts?.escalation_count, 2);
  } finally {
    close();
  }
});

test("lifecycle engine enforces quantitative noise budgets with suppressed-not-dropped behavior", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const snapshot = await createHealthyExecutionSnapshot(db);
    const lifecycle = createLifecycleEngine(db);

    await run(
      db,
      `UPDATE agent_noise_budget_policies
       SET max_watch_states_per_day = 1,
           max_escalation_candidates_per_day = 2,
           max_escalation_candidates_per_issue_family_per_day = 1
       WHERE noise_budget_policy_id = 'nb_property_advocate_default'`
    );

    const firstWatch = await lifecycle.emit({
      objectType: "watch_state",
      issueFamilyKey: "data_freshness_risk",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "medium",
      confidence: 0.8,
      reason: "first watch",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T12:00:00.000Z",
      lastObservedAt: "2026-03-30T12:00:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["FIRST_WATCH"],
        normalizedSeverityBucket: "medium",
      },
    });
    assert.equal(firstWatch.status, "open");

    const secondWatch = await lifecycle.emit({
      objectType: "watch_state",
      issueFamilyKey: "data_freshness_risk",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "medium",
      confidence: 0.82,
      reason: "second watch",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T12:30:00.000Z",
      lastObservedAt: "2026-03-30T12:30:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["SECOND_WATCH"],
        normalizedSeverityBucket: "medium",
      },
    });
    assert.equal(secondWatch.status, "suppressed");
    assert.equal(secondWatch.suppressionReason, "noise_budget_watch_daily_limit");

    const firstEscalation = await lifecycle.emit({
      objectType: "escalation_candidate",
      issueFamilyKey: "performance_regression",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "high",
      confidence: 0.9,
      reason: "first escalation",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T13:00:00.000Z",
      lastObservedAt: "2026-03-30T13:00:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["ESCALATION_ONE"],
        normalizedSeverityBucket: "high",
      },
    });
    assert.equal(firstEscalation.status, "under_review");

    const secondEscalation = await lifecycle.emit({
      objectType: "escalation_candidate",
      issueFamilyKey: "performance_regression",
      scopeType: "property",
      propertyId: "prop_1",
      cohortKey: null,
      portfolioScopeKey: null,
      severity: "high",
      confidence: 0.91,
      reason: "second escalation same family",
      sourceType: "agent_runtime",
      sourceActorId: "agent_prop_1",
      executionSnapshotId: snapshot.executionSnapshotId,
      contractBundleId: "cb_phase1_v1",
      agentContractId: "ac_property_advocate_v1",
      firstObservedAt: "2026-03-30T14:00:00.000Z",
      lastObservedAt: "2026-03-30T14:00:00.000Z",
      dedupeContext: {
        normalizedReasonCodes: ["ESCALATION_TWO"],
        normalizedSeverityBucket: "high",
      },
    });
    assert.equal(secondEscalation.status, "suppressed");
    assert.equal(secondEscalation.suppressionReason, "noise_budget_issue_family_daily_limit");
  } finally {
    close();
  }
});

test("property advocate runner executes the governed property flow end to end", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    await activateHealthyBatches(db);
    const result = await runPropertyAdvocateFlow(db, {
      propertyId: "prop_1",
      agentId: "agent_prop_1",
      contractBundleId: "cb_phase1_v1",
      executionPolicyId: "exec_policy_property_advocate",
      requestedBy: "mark",
      operatorId: "mark",
      triggerType: "scheduled",
      triggerSource: "test",
      triggerReferenceId: "pa_run_001",
    });

    assert.equal(result.pipelineHealth.length, 2);
    assert.equal(result.executionSnapshot.domainBindingCount, 2);
    assert.equal(result.runtime.agentId, "agent_prop_1");
    assert.deepEqual(result.emitted, []);

    const runtimeBinding = await queryFirst<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count FROM agent_runtime_bindings WHERE execution_snapshot_id = ?`,
      [result.executionSnapshot.executionSnapshotId]
    );
    assert.equal(runtimeBinding?.count, 1);
  } finally {
    close();
  }
});
