import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { queryFirst, run } from "../../src/lib/db";
import { stableHash } from "../../src/platform/shared/stable-hash";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { seedPhase1PlatformBasics } from "../helpers/platform-seeds";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { buildCloudflareAccessJwt } from "../helpers/cloudflare-access-jwt";

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
    domainKey: "ga4",
    mirrorBatchId: "mb_ga4_route_001",
    sourceValidationBatchId: "val_ga4_route_001",
    sourceSnapshotId: "snap_ga4_route_001",
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
        mirrorBatchSliceId: "slice_ga4_route_001",
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

function buildPsiInput(performanceScore = 81, batchId = "001") {
  const records = [
    {
      propertyId: "prop_1",
      metricDate: "2026-03-28",
      strategy: "mobile",
      performanceScore,
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
    domainKey: "psi",
    mirrorBatchId: `mb_psi_route_${batchId}`,
    sourceValidationBatchId: `val_psi_route_${batchId}`,
    sourceSnapshotId: `snap_psi_route_${batchId}`,
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
        mirrorBatchSliceId: `slice_psi_route_${batchId}`,
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

async function requestPlatform(
  env: ReturnType<typeof createPlatformRouteEnv>,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    useAccessServiceToken?: boolean;
  } = {}
) {
  const authHeaders = init.useAccessServiceToken
    ? {
        "CF-Access-Client-Id": env.PLATFORM_ACCESS_CLIENT_ID ?? "",
        "CF-Access-Client-Secret": env.PLATFORM_ACCESS_CLIENT_SECRET ?? "",
      }
    : {
        Authorization: `Bearer ${env.PLATFORM_SHARED_TOKEN}`,
      };
  return app.request(
    `http://localhost${path}`,
    {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Platform-Actor": "local_mac_runner",
        "X-Platform-Source": "platform_route_test",
        ...authHeaders,
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    env
  );
}

test("platform routes cover mirror through execution snapshot and include request metadata", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);

    const intakeResponse = await requestPlatform(env, "/v1/platform/mirror/intake", {
      method: "POST",
      body: buildGa4Input(),
      headers: { "X-Request-Id": "route-intake-001" },
    });
    assert.equal(intakeResponse.status, 201);
    const intakeJson = await intakeResponse.json();
    assert.equal(intakeJson.meta.requestId, "route-intake-001");
    assert.equal(intakeJson.meta.actorTag, "local_mac_runner");

    const reconcileResponse = await requestPlatform(env, "/v1/platform/mirror/reconcile", {
      method: "POST",
      body: {
        domainKey: "ga4",
        mirrorBatchId: "mb_ga4_route_001",
        reconciledBy: "route_test",
        reconciliationReason: "route_test",
      },
    });
    assert.equal(reconcileResponse.status, 200);

    const activateResponse = await requestPlatform(env, "/v1/platform/mirror/activate", {
      method: "POST",
      body: {
        domainKey: "ga4",
        mirrorBatchId: "mb_ga4_route_001",
        activationReason: "route_test",
        activatedBy: "route_test",
      },
    });
    assert.equal(activateResponse.status, 200);

    await requestPlatform(env, "/v1/platform/mirror/intake", {
      method: "POST",
      body: buildPsiInput(),
    });
    await requestPlatform(env, "/v1/platform/mirror/reconcile", {
      method: "POST",
      body: {
        domainKey: "psi",
        mirrorBatchId: "mb_psi_route_001",
        reconciledBy: "route_test",
        reconciliationReason: "route_test",
      },
    });
    await requestPlatform(env, "/v1/platform/mirror/activate", {
      method: "POST",
      body: {
        domainKey: "psi",
        mirrorBatchId: "mb_psi_route_001",
        activationReason: "route_test",
        activatedBy: "route_test",
      },
    });

    const healthResponse = await requestPlatform(env, "/v1/platform/pipeline-health/build", {
      method: "POST",
      body: { domainKey: "ga4", contractBundleId: "cb_phase1_v1" },
    });
    assert.equal(healthResponse.status, 201);

    await requestPlatform(env, "/v1/platform/pipeline-health/build", {
      method: "POST",
      body: { domainKey: "psi", contractBundleId: "cb_phase1_v1" },
    });

    const snapshotResponse = await requestPlatform(env, "/v1/platform/execution-snapshots", {
      method: "POST",
      body: {
        scopeType: "property",
        propertyId: "prop_1",
        cohortKey: null,
        portfolioScopeKey: null,
        executionIntent: "property_monitoring",
        executionConsumerType: "property_advocate",
        executionConsumerId: "agent_prop_1",
        triggerType: "scheduled",
        triggerSource: "route_test",
        triggerReferenceId: "route_trigger_001",
        requestedContractBundleId: "cb_phase1_v1",
        policyId: "exec_policy_property_advocate",
        createdBy: "route_test",
        operatorId: "mark",
        requestedBy: "mark",
      },
    });
    assert.equal(snapshotResponse.status, 201);
    const snapshotJson = await snapshotResponse.json();
    assert.equal(snapshotJson.result.bindings.length, 2);
    assert.ok(snapshotResponse.headers.get("x-request-id"));
  } finally {
    close();
  }
});

test("platform routes accept Cloudflare Access service-token headers", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);

    const intakeResponse = await requestPlatform(env, "/v1/platform/mirror/intake", {
      method: "POST",
      body: buildGa4Input(),
      useAccessServiceToken: true,
      headers: { "X-Platform-Actor": "access_service_client" },
    });
    assert.equal(intakeResponse.status, 201);
    const intakeJson = await intakeResponse.json();
    assert.equal(intakeJson.meta.actorTag, "access_service_client");
  } finally {
    close();
  }
});

test("platform routes accept Cloudflare Access JWT assertions minted for the configured service token", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain: env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "https://macxs.cloudflareaccess.com",
      clientId: env.PLATFORM_ACCESS_CLIENT_ID ?? "",
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/cdn-cgi/access/certs")) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return originalFetch(input);
    }) as typeof fetch;

    const intakeResponse = await requestPlatform(env, "/v1/platform/mirror/intake", {
      method: "POST",
      body: buildGa4Input(),
      headers: {
        "CF-Access-Jwt-Assertion": token,
        "X-Platform-Actor": "access_jwt_client",
      },
    });
    assert.equal(intakeResponse.status, 201);
    const intakeJson = await intakeResponse.json();
    assert.equal(intakeJson.meta.actorTag, "access_jwt_client");
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("platform routes cover agent runtime, lifecycle emission, and noise-budget summary", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);

    for (const payload of [buildGa4Input(), buildPsiInput()]) {
      await requestPlatform(env, "/v1/platform/mirror/intake", { method: "POST", body: payload });
      await requestPlatform(env, "/v1/platform/mirror/reconcile", {
        method: "POST",
        body: {
          domainKey: payload.domainKey,
          mirrorBatchId: payload.mirrorBatchId,
          reconciledBy: "route_test",
          reconciliationReason: "route_test",
        },
      });
      await requestPlatform(env, "/v1/platform/mirror/activate", {
        method: "POST",
        body: {
          domainKey: payload.domainKey,
          mirrorBatchId: payload.mirrorBatchId,
          activationReason: "route_test",
          activatedBy: "route_test",
        },
      });
      await requestPlatform(env, "/v1/platform/pipeline-health/build", {
        method: "POST",
        body: { domainKey: payload.domainKey, contractBundleId: "cb_phase1_v1" },
      });
    }

    const snapshotResponse = await requestPlatform(env, "/v1/platform/execution-snapshots", {
      method: "POST",
      body: {
        scopeType: "property",
        propertyId: "prop_1",
        cohortKey: null,
        portfolioScopeKey: null,
        executionIntent: "property_monitoring",
        executionConsumerType: "property_advocate",
        executionConsumerId: "agent_prop_1",
        triggerType: "scheduled",
        triggerSource: "route_test",
        triggerReferenceId: "route_trigger_002",
        requestedContractBundleId: "cb_phase1_v1",
        policyId: "exec_policy_property_advocate",
        createdBy: "route_test",
        operatorId: "mark",
        requestedBy: "mark",
      },
    });
    const snapshotJson = await snapshotResponse.json();
    const executionSnapshotId = snapshotJson.result.executionSnapshotId;

    const runtimeResponse = await requestPlatform(env, "/v1/platform/agent-runtime/start", {
      method: "POST",
      body: {
        agentId: "agent_prop_1",
        executionSnapshotId,
        triggerType: "scheduled",
        scopeType: "property",
        propertyId: "prop_1",
        cohortKey: null,
        portfolioScopeKey: null,
      },
    });
    assert.equal(runtimeResponse.status, 201);
    const runtimeJson = await runtimeResponse.json();
    assert.equal(runtimeJson.result.agentId, "agent_prop_1");

    for (let i = 0; i < 4; i += 1) {
      const lifecycleResponse = await requestPlatform(env, "/v1/platform/lifecycle/emit", {
        method: "POST",
        body: {
          objectType: "escalation_candidate",
          issueFamilyKey: "performance_regression",
          scopeType: "property",
          propertyId: "prop_1",
          cohortKey: null,
          portfolioScopeKey: null,
          severity: "high",
          confidence: 0.92,
          reason: `PSI degraded route run ${i}`,
          sourceType: "agent_runtime",
          sourceActorId: "agent_prop_1",
          executionSnapshotId,
          contractBundleId: "cb_phase1_v1",
          agentContractId: runtimeJson.result.agentContractId,
          promotionMode: "review_required",
          firstObservedAt: "2026-03-30T10:00:00.000Z",
          lastObservedAt: `2026-03-30T10:0${i}:00.000Z`,
          dedupeContext: {
            normalizedReasonCodes: [`ROUTE_${i}`],
            normalizedSeverityBucket: "high",
          },
        },
      });
      assert.equal(lifecycleResponse.status, 201);
    }

    const summaryResponse = await requestPlatform(
      env,
      "/v1/platform/agents/agent_prop_1/noise-budget-summary?day=2026-03-30"
    );
    assert.equal(summaryResponse.status, 200);
    const summaryJson = await summaryResponse.json();
    assert.equal(summaryJson.result.usage.escalationCandidates.total, 4);
    assert.equal(summaryJson.result.usage.escalationCandidates.suppressed, 1);
    assert.equal(summaryJson.result.usage.escalationCandidatesByIssueFamily[0].issueFamilyKey, "performance_regression");
  } finally {
    close();
  }
});

test("platform route property-advocate runner executes through the governed surface", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);

    for (const payload of [buildGa4Input(), buildPsiInput(81, "002")]) {
      await requestPlatform(env, "/v1/platform/mirror/intake", { method: "POST", body: payload });
      await requestPlatform(env, "/v1/platform/mirror/reconcile", {
        method: "POST",
        body: {
          domainKey: payload.domainKey,
          mirrorBatchId: payload.mirrorBatchId,
          reconciledBy: "route_test",
          reconciliationReason: "route_test",
        },
      });
      await requestPlatform(env, "/v1/platform/mirror/activate", {
        method: "POST",
        body: {
          domainKey: payload.domainKey,
          mirrorBatchId: payload.mirrorBatchId,
          activationReason: "route_test",
          activatedBy: "route_test",
        },
      });
    }

    const response = await requestPlatform(env, "/v1/platform/property-advocate/run", {
      method: "POST",
      body: {
        propertyId: "prop_1",
        agentId: "agent_prop_1",
        contractBundleId: "cb_phase1_v1",
        executionPolicyId: "exec_policy_property_advocate",
        requestedBy: "route_test",
        operatorId: "mark",
        triggerType: "manual",
        triggerSource: "route_test",
        triggerReferenceId: "property_advocate_route_001",
      },
    });
    assert.equal(response.status, 201);
    const json = await response.json();
    assert.equal(json.result.runtime.agentId, "agent_prop_1");
    assert.equal(json.result.pipelineHealth.length, 2);
    assert.equal(json.result.emitted.length, 0);
  } finally {
    close();
  }
});

test("platform routes return request metadata on blocked access", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);
    const response = await app.request(
      "http://localhost/v1/platform/mirror/intake",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "blocked-route-001",
          "X-Platform-Actor": "unauthorized_runner",
          "X-Platform-Source": "platform_route_test",
        },
        body: JSON.stringify(buildGa4Input()),
      },
      { ...env, PLATFORM_SHARED_TOKEN: undefined }
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("x-request-id"), "blocked-route-001");
    const json = await response.json();
    assert.equal(json.meta.requestId, "blocked-route-001");
    assert.equal(json.meta.actorTag, "unauthorized_runner");
  } finally {
    close();
  }
});

test("platform route failures preserve request metadata", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const env = createPlatformRouteEnv(db);
    const response = await requestPlatform(env, "/v1/platform/mirror/activate", {
      method: "POST",
      body: {
        domainKey: "ga4",
        mirrorBatchId: "missing_batch",
        activationReason: "route_test",
        activatedBy: "route_test",
      },
      headers: { "X-Request-Id": "route-failure-001" },
    });
    assert.equal(response.status, 404);
    const json = await response.json();
    assert.equal(json.meta.requestId, "route-failure-001");
    assert.equal(json.error.code, "NOT_FOUND");
  } finally {
    close();
  }
});
