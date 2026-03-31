import { batch, queryAll, queryFirst, run, stmt } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";

export interface MirrorBatchRow {
  mirror_batch_id: string;
  domain_key: string;
  source_validation_batch_id: string;
  source_snapshot_id: string;
  schema_bundle_version: string;
  validator_bundle_version: string;
  mirror_bundle_version: string;
  payload_contract_version: string;
  contract_bundle_id: string | null;
  batch_date_start: string;
  batch_date_end: string;
  row_count_total_expected: number;
  row_count_total_received: number;
  checksum_manifest: string;
  status:
    | "prepared"
    | "mirroring"
    | "mirrored"
    | "reconciling"
    | "reconciled"
    | "active"
    | "superseded"
    | "failed"
    | "quarantined";
  created_at: string;
  reconciled_at: string | null;
}

export interface MirrorBatchSliceRow {
  mirror_batch_slice_id: string;
  mirror_batch_id: string;
  domain_key: string;
  target_table: string;
  slice_key: string;
  row_count_expected: number;
  row_count_received: number;
  slice_checksum_expected: string;
  slice_checksum_received: string | null;
  status: "pending" | "writing" | "written" | "reconciled" | "failed" | "quarantined";
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
}

export interface ActiveBatchPointerRow {
  domain_key: string;
  active_mirror_batch_id: string;
  activated_at: string;
  previous_mirror_batch_id: string | null;
  updated_at: string;
}

export interface PersistedSliceSummary {
  mirrorBatchSliceId: string;
  targetTable: string;
  sliceKey: string;
  rowCountExpected: number;
  rowCountReceived: number;
  sliceChecksumExpected: string;
  sliceChecksumReceived: string;
}

export interface PersistGa4RecordInput {
  mirrorBatchId: string;
  domainKey: string;
  sourceValidationBatchId: string;
  schemaBundleVersion: string;
  payloadContractVersion: string;
  propertyId: string;
  ga4PropertyId?: string | null;
  metricDate: string;
  totalUsers?: number | null;
  newUsers?: number | null;
  sessions?: number | null;
  pageviews?: number | null;
  avgSessionDurationSeconds?: number | null;
  bounceRate?: number | null;
  sourceRowHash: string;
}

export interface PersistPsiRecordInput {
  mirrorBatchId: string;
  domainKey: string;
  sourceValidationBatchId: string;
  schemaBundleVersion: string;
  payloadContractVersion: string;
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
  sourceRowHash: string;
}

export async function createMirrorBatch(
  db: D1Database,
  input: {
    mirrorBatchId: string;
    domainKey: string;
    sourceValidationBatchId: string;
    sourceSnapshotId: string;
    schemaBundleVersion: string;
    validatorBundleVersion: string;
    mirrorBundleVersion: string;
    payloadContractVersion: string;
    contractBundleId: string;
    batchDateStart: string;
    batchDateEnd: string;
    rowCountTotalExpected: number;
    checksumManifest: string;
    sourceHost: string;
    operatorId?: string | null;
  }
): Promise<void> {
  const now = nowISO();
  await run(
    db,
    `INSERT INTO mirror_batches (
      mirror_batch_id, domain_key, source_validation_batch_id, source_snapshot_id,
      schema_bundle_version, validator_bundle_version, mirror_bundle_version,
      payload_contract_version, contract_bundle_id, batch_date_start, batch_date_end,
      row_count_total_expected, row_count_total_received, checksum_manifest, status,
      source_host, operator_id, created_at, mirroring_started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'mirroring', ?, ?, ?, ?)`,
    [
      input.mirrorBatchId,
      input.domainKey,
      input.sourceValidationBatchId,
      input.sourceSnapshotId,
      input.schemaBundleVersion,
      input.validatorBundleVersion,
      input.mirrorBundleVersion,
      input.payloadContractVersion,
      input.contractBundleId,
      input.batchDateStart,
      input.batchDateEnd,
      input.rowCountTotalExpected,
      input.checksumManifest,
      input.sourceHost,
      input.operatorId ?? null,
      now,
      now,
    ]
  );
}

export async function createMirrorBatchSlices(
  db: D1Database,
  input: {
    mirrorBatchId: string;
    domainKey: string;
    slices: Array<{
      mirrorBatchSliceId: string;
      targetTable: string;
      sliceKey: string;
      rowCountExpected: number;
      sliceChecksumExpected: string;
    }>;
  }
): Promise<void> {
  const now = nowISO();
  const stmts = input.slices.map((slice) =>
    stmt(
      db,
      `INSERT INTO mirror_batch_slices (
        mirror_batch_slice_id, mirror_batch_id, domain_key, target_table, slice_key,
        row_count_expected, row_count_received, slice_checksum_expected, slice_checksum_received,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, 'pending', ?)`,
      [
        slice.mirrorBatchSliceId,
        input.mirrorBatchId,
        input.domainKey,
        slice.targetTable,
        slice.sliceKey,
        slice.rowCountExpected,
        slice.sliceChecksumExpected,
        now,
      ]
    )
  );
  await batch(db, stmts);
}

export async function persistGa4SliceRecords(
  db: D1Database,
  records: PersistGa4RecordInput[]
): Promise<void> {
  if (!records.length) return;
  const now = nowISO();
  const stmts = records.map((record) =>
    stmt(
      db,
      `INSERT INTO platform_ga4_daily_metrics (
        id, mirror_batch_id, domain_key, source_validation_batch_id, schema_bundle_version,
        payload_contract_version, property_id, ga4_property_id, metric_date, total_users,
        new_users, sessions, pageviews, avg_session_duration_seconds, bounce_rate, source_row_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        record.mirrorBatchId,
        record.domainKey,
        record.sourceValidationBatchId,
        record.schemaBundleVersion,
        record.payloadContractVersion,
        record.propertyId,
        record.ga4PropertyId ?? null,
        record.metricDate,
        record.totalUsers ?? null,
        record.newUsers ?? null,
        record.sessions ?? null,
        record.pageviews ?? null,
        record.avgSessionDurationSeconds ?? null,
        record.bounceRate ?? null,
        record.sourceRowHash,
        now,
      ]
    )
  );
  await batch(db, stmts);
}

export async function persistPsiSliceRecords(
  db: D1Database,
  records: PersistPsiRecordInput[]
): Promise<void> {
  if (!records.length) return;
  const now = nowISO();
  const stmts = records.map((record) =>
    stmt(
      db,
      `INSERT INTO platform_psi_daily_metrics (
        id, mirror_batch_id, domain_key, source_validation_batch_id, schema_bundle_version,
        payload_contract_version, property_id, metric_date, strategy, performance_score,
        accessibility_score, best_practices_score, seo_score, lcp_seconds, cls_value,
        fcp_seconds, tbt_ms, inp_ms, ttfb_ms, source_row_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        record.mirrorBatchId,
        record.domainKey,
        record.sourceValidationBatchId,
        record.schemaBundleVersion,
        record.payloadContractVersion,
        record.propertyId,
        record.metricDate,
        record.strategy,
        record.performanceScore ?? null,
        record.accessibilityScore ?? null,
        record.bestPracticesScore ?? null,
        record.seoScore ?? null,
        record.lcpSeconds ?? null,
        record.clsValue ?? null,
        record.fcpSeconds ?? null,
        record.tbtMs ?? null,
        record.inpMs ?? null,
        record.ttfbMs ?? null,
        record.sourceRowHash,
        now,
      ]
    )
  );
  await batch(db, stmts);
}

export async function markSliceWritten(
  db: D1Database,
  summary: PersistedSliceSummary
): Promise<void> {
  const now = nowISO();
  await run(
    db,
    `UPDATE mirror_batch_slices
     SET row_count_received = ?, slice_checksum_received = ?, status = 'written', completed_at = ?,
         failed_at = NULL, failure_code = NULL, failure_message = NULL
     WHERE mirror_batch_slice_id = ? AND target_table = ? AND slice_key = ?`,
    [
      summary.rowCountReceived,
      summary.sliceChecksumReceived,
      now,
      summary.mirrorBatchSliceId,
      summary.targetTable,
      summary.sliceKey,
    ]
  );
}

export async function finalizeMirrorBatchAfterPersistence(
  db: D1Database,
  mirrorBatchId: string,
  rowCountTotalReceived: number
): Promise<void> {
  await run(
    db,
    `UPDATE mirror_batches
     SET row_count_total_received = ?, status = 'mirrored', mirroring_completed_at = ?
     WHERE mirror_batch_id = ?`,
    [rowCountTotalReceived, nowISO(), mirrorBatchId]
  );
}

export async function getMirrorBatch(
  db: D1Database,
  mirrorBatchId: string
): Promise<MirrorBatchRow | null> {
  return queryFirst<MirrorBatchRow>(db, `SELECT * FROM mirror_batches WHERE mirror_batch_id = ?`, [
    mirrorBatchId,
  ]);
}

export async function listMirrorBatchSlices(
  db: D1Database,
  mirrorBatchId: string
): Promise<MirrorBatchSliceRow[]> {
  return queryAll<MirrorBatchSliceRow>(
    db,
    `SELECT * FROM mirror_batch_slices WHERE mirror_batch_id = ? ORDER BY target_table, slice_key`,
    [mirrorBatchId]
  );
}

export async function getActiveBatchPointer(
  db: D1Database,
  domainKey: string
): Promise<ActiveBatchPointerRow | null> {
  return queryFirst<ActiveBatchPointerRow>(
    db,
    `SELECT * FROM active_batch_pointers WHERE domain_key = ?`,
    [domainKey]
  );
}

export async function createSystemStateEvent(
  db: D1Database,
  input: {
    domainKey: string;
    eventType: string;
    eventStatus: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    sourceComponent: string;
    sourceHost: string;
    sourceValidationBatchId?: string | null;
    mirrorBatchId?: string | null;
    activeMirrorBatchId?: string | null;
    schemaBundleVersion?: string | null;
    validatorBundleVersion?: string | null;
    mirrorBundleVersion?: string | null;
    contractBundleId?: string | null;
    message: string;
    metadata?: Record<string, unknown>;
    failureCode?: string | null;
    failureMessage?: string | null;
  }
): Promise<string> {
  const systemStateEventId = newId();
  await run(
    db,
    `INSERT INTO system_state_events (
      system_state_event_id, domain_key, event_type, event_status, severity, event_time,
      source_component, source_host, source_validation_batch_id, mirror_batch_id,
      active_mirror_batch_id, schema_bundle_version, validator_bundle_version,
      mirror_bundle_version, contract_bundle_id, message, metadata_json, failure_code, failure_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      systemStateEventId,
      input.domainKey,
      input.eventType,
      input.eventStatus,
      input.severity,
      nowISO(),
      input.sourceComponent,
      input.sourceHost,
      input.sourceValidationBatchId ?? null,
      input.mirrorBatchId ?? null,
      input.activeMirrorBatchId ?? null,
      input.schemaBundleVersion ?? null,
      input.validatorBundleVersion ?? null,
      input.mirrorBundleVersion ?? null,
      input.contractBundleId ?? null,
      input.message,
      JSON.stringify(input.metadata ?? {}),
      input.failureCode ?? null,
      input.failureMessage ?? null,
    ]
  );
  return systemStateEventId;
}

export async function createActivation(
  db: D1Database,
  input: {
    domainKey: string;
    mirrorBatchId: string;
    activationReason: string;
    activatedBy: string;
  },
  previousMirrorBatchId?: string | null
): Promise<{ activationEventId: string; activatedAt: string }> {
  const now = nowISO();
  const activationEventId = newId();
  const stmts = [
    stmt(
      db,
      `INSERT INTO mirror_activation_events (
        activation_event_id, domain_key, mirror_batch_id, previous_mirror_batch_id,
        activation_reason, activated_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        activationEventId,
        input.domainKey,
        input.mirrorBatchId,
        previousMirrorBatchId ?? null,
        input.activationReason,
        input.activatedBy,
        now,
      ]
    ),
    stmt(
      db,
      `INSERT INTO active_batch_pointers (
        domain_key, active_mirror_batch_id, activated_at, previous_mirror_batch_id, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(domain_key) DO UPDATE SET
        active_mirror_batch_id = excluded.active_mirror_batch_id,
        activated_at = excluded.activated_at,
        previous_mirror_batch_id = excluded.previous_mirror_batch_id,
        updated_at = excluded.updated_at`,
      [input.domainKey, input.mirrorBatchId, now, previousMirrorBatchId ?? null, now]
    ),
    stmt(
      db,
      `UPDATE mirror_batches
       SET status = 'active', activated_at = ?
       WHERE mirror_batch_id = ?`,
      [now, input.mirrorBatchId]
    ),
  ];

  if (previousMirrorBatchId) {
    stmts.push(
      stmt(
        db,
        `UPDATE mirror_batches
         SET status = 'superseded'
         WHERE mirror_batch_id = ?`,
        [previousMirrorBatchId]
      )
    );
  }

  await batch(db, stmts);
  return { activationEventId, activatedAt: now };
}

export async function markMirrorBatchFailed(
  db: D1Database,
  mirrorBatchId: string,
  failureCode: string,
  failureMessage: string
): Promise<void> {
  await run(
    db,
    `UPDATE mirror_batches
     SET status = 'failed', failed_at = ?, failure_code = ?, failure_message = ?
     WHERE mirror_batch_id = ?`,
    [nowISO(), failureCode, failureMessage, mirrorBatchId]
  );
}

export async function quarantineMirrorBatch(
  db: D1Database,
  mirrorBatchId: string,
  failureCode: string,
  failureMessage: string
): Promise<void> {
  await run(
    db,
    `UPDATE mirror_batches
     SET status = 'quarantined', failed_at = ?, failure_code = ?, failure_message = ?
     WHERE mirror_batch_id = ?`,
    [nowISO(), failureCode, failureMessage, mirrorBatchId]
  );
}

export async function markMirrorBatchReconciling(
  db: D1Database,
  mirrorBatchId: string
): Promise<void> {
  await run(
    db,
    `UPDATE mirror_batches
     SET status = 'reconciling'
     WHERE mirror_batch_id = ?`,
    [mirrorBatchId]
  );
}

export async function markMirrorBatchReconciled(
  db: D1Database,
  mirrorBatchId: string
): Promise<void> {
  const now = nowISO();
  await run(
    db,
    `UPDATE mirror_batches
     SET status = 'reconciled', reconciled_at = ?, failed_at = NULL, failure_code = NULL, failure_message = NULL
     WHERE mirror_batch_id = ?`,
    [now, mirrorBatchId]
  );
}

export async function markMirrorBatchSliceFailed(
  db: D1Database,
  mirrorBatchSliceId: string,
  failureCode: string,
  failureMessage: string,
  status: "failed" | "quarantined"
): Promise<void> {
  await run(
    db,
    `UPDATE mirror_batch_slices
     SET status = ?, failed_at = ?, failure_code = ?, failure_message = ?
     WHERE mirror_batch_slice_id = ?`,
    [status, nowISO(), failureCode, failureMessage, mirrorBatchSliceId]
  );
}

export async function markMirrorBatchSliceReconciled(
  db: D1Database,
  mirrorBatchSliceId: string
): Promise<void> {
  await run(
    db,
    `UPDATE mirror_batch_slices
     SET status = 'reconciled'
     WHERE mirror_batch_slice_id = ?`,
    [mirrorBatchSliceId]
  );
}

export async function countPersistedGa4RowsForSlice(
  db: D1Database,
  mirrorBatchId: string,
  metricDate: string
): Promise<number> {
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM platform_ga4_daily_metrics
     WHERE mirror_batch_id = ? AND metric_date = ?`,
    [mirrorBatchId, metricDate]
  );
  return row?.count ?? 0;
}

export async function listPersistedGa4RowHashesForSlice(
  db: D1Database,
  mirrorBatchId: string,
  metricDate: string
): Promise<string[]> {
  const rows = await queryAll<{ source_row_hash: string }>(
    db,
    `SELECT source_row_hash
     FROM platform_ga4_daily_metrics
     WHERE mirror_batch_id = ? AND metric_date = ?
     ORDER BY source_row_hash`,
    [mirrorBatchId, metricDate]
  );
  return rows.map((row) => row.source_row_hash);
}

export async function countPersistedPsiRowsForSlice(
  db: D1Database,
  mirrorBatchId: string,
  metricDate: string
): Promise<number> {
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM platform_psi_daily_metrics
     WHERE mirror_batch_id = ? AND metric_date = ?`,
    [mirrorBatchId, metricDate]
  );
  return row?.count ?? 0;
}

export async function listPersistedPsiRowHashesForSlice(
  db: D1Database,
  mirrorBatchId: string,
  metricDate: string
): Promise<string[]> {
  const rows = await queryAll<{ source_row_hash: string }>(
    db,
    `SELECT source_row_hash
     FROM platform_psi_daily_metrics
     WHERE mirror_batch_id = ? AND metric_date = ?
     ORDER BY source_row_hash`,
    [mirrorBatchId, metricDate]
  );
  return rows.map((row) => row.source_row_hash);
}
