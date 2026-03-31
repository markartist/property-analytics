import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createTestD1Database } from "../helpers/sqlite-d1";
import { seedPhase1PlatformBasics } from "../helpers/platform-seeds";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { startPlatformHttpServer } from "../helpers/platform-http-server";

const execFileAsync = promisify(execFile);

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableHash(parts: Array<string | number | null | undefined>): string {
  return fnv1a32(parts.map((part) => String(part ?? "")).join("|"));
}

function buildGa4Input() {
  const records = [
    {
      propertyId: "prop_1",
      metricDate: "2026-03-30",
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
  const batchChecksum = stableHash(["platform_ga4_daily_metrics", "2026-03-30", sliceChecksum]);
  return {
    domainKey: "ga4",
    mirrorBatchId: "mb_ga4_client_smoke_001",
    sourceValidationBatchId: "val_ga4_client_smoke_001",
    sourceSnapshotId: "snap_ga4_client_smoke_001",
    contractBundleId: "cb_phase1_v1",
    schemaBundleVersion: "schema_v1",
    validatorBundleVersion: "validator_v1",
    mirrorBundleVersion: "mirror_v1",
    payloadContractVersion: "payload_v1",
    batchDateStart: "2026-03-30",
    batchDateEnd: "2026-03-30",
    rowCountTotalExpected: 1,
    checksumManifest: JSON.stringify({ batchChecksum }),
    payloadSlices: [
      {
        mirrorBatchSliceId: "slice_ga4_client_smoke_001",
        targetTable: "platform_ga4_daily_metrics",
        sliceKey: "2026-03-30",
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
      metricDate: "2026-03-30",
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
  const batchChecksum = stableHash(["platform_psi_daily_metrics", "2026-03-30", sliceChecksum]);
  return {
    domainKey: "psi",
    mirrorBatchId: "mb_psi_client_smoke_001",
    sourceValidationBatchId: "val_psi_client_smoke_001",
    sourceSnapshotId: "snap_psi_client_smoke_001",
    contractBundleId: "cb_phase1_v1",
    schemaBundleVersion: "schema_v1",
    validatorBundleVersion: "validator_v1",
    mirrorBundleVersion: "mirror_v1",
    payloadContractVersion: "payload_v1",
    batchDateStart: "2026-03-30",
    batchDateEnd: "2026-03-30",
    rowCountTotalExpected: 1,
    checksumManifest: JSON.stringify({ batchChecksum }),
    payloadSlices: [
      {
        mirrorBatchSliceId: "slice_psi_client_smoke_001",
        targetTable: "platform_psi_daily_metrics",
        sliceKey: "2026-03-30",
        rowCountExpected: 1,
        sliceChecksumExpected: sliceChecksum,
        recordsJson: JSON.stringify(records),
      },
    ],
    sourceHost: "local-mac",
    operatorId: "mark",
  };
}

async function runClient(args: string[], extraEnv: Record<string, string>) {
  const { stdout } = await execFileAsync("python3", args, {
    env: { ...process.env, ...extraEnv },
    cwd: "/Users/mark/Property_Analytics",
  });
  return JSON.parse(stdout);
}

test("platform_phase1_client smoke-tests the live HTTP mirror and advocate paths", async () => {
  const { db, close } = await createTestD1Database();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase1-client-smoke-"));
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);
    const server = await startPlatformHttpServer(env);
    try {
      const ga4Path = path.join(tempDir, "ga4.json");
      const psiPath = path.join(tempDir, "psi.json");
      fs.writeFileSync(ga4Path, JSON.stringify(buildGa4Input()));
      fs.writeFileSync(psiPath, JSON.stringify(buildPsiInput()));

      const sharedEnv = {
        PLATFORM_BASE_URL: server.baseUrl,
        PLATFORM_SHARED_TOKEN: env.PLATFORM_SHARED_TOKEN ?? "",
      };

      const ga4Result = await runClient(
        [
          "/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py",
          "mirror-batch",
          "--input",
          ga4Path,
          "--actor",
          "smoke_client",
          "--source",
          "smoke_test",
        ],
        sharedEnv
      );
      assert.equal(ga4Result.intake.result.domainKey, "ga4");
      assert.equal(ga4Result.activate.result.domainKey, "ga4");

      const psiResult = await runClient(
        [
          "/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py",
          "mirror-batch",
          "--input",
          psiPath,
          "--actor",
          "smoke_client",
          "--source",
          "smoke_test",
        ],
        sharedEnv
      );
      assert.equal(psiResult.intake.result.domainKey, "psi");
      assert.equal(psiResult.activate.result.domainKey, "psi");

      const advocateResult = await runClient(
        [
          "/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py",
          "property-advocate-run",
          "--property-id",
          "prop_1",
          "--actor",
          "smoke_client",
          "--source",
          "smoke_test",
        ],
        sharedEnv
      );
      assert.equal(advocateResult.result.runtime.agentId, "agent_prop_1");
      assert.equal(advocateResult.result.pipelineHealth.length, 2);
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    close();
  }
});
