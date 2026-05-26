import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { buildCloudflareAccessJwt } from "../helpers/cloudflare-access-jwt";

async function createEvsRequestsTable(db: D1Database) {
  await run(
    db,
    `CREATE TABLE evs_requests (
      id TEXT PRIMARY KEY,
      source_consumer TEXT,
      property_id TEXT,
      environment TEXT,
      reason TEXT,
      priority TEXT,
      target_pages_json TEXT,
      validation_profiles_json TEXT,
      device_profiles_json TEXT,
      governance_context_json TEXT,
      execution_mode TEXT,
      trigger_metadata_json TEXT,
      status TEXT,
      provider TEXT,
      requested_by TEXT,
      orchestrator_ref TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  );
}

test("EVS ingest rejects requests without valid service credentials when configured", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await createEvsRequestsTable(db);
    const env = createPlatformRouteEnv(db);

    const response = await app.request("http://localhost/v1/evs/ingest/req_1", { method: "POST" }, env);
    assert.equal(response.status, 401);
    const json = await response.json();
    assert.equal(json.error.code, "UNAUTHORIZED");
  } finally {
    close();
  }
});

test("EVS ingest accepts Cloudflare Access service-token headers before request lookup", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await createEvsRequestsTable(db);
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/evs/ingest/req_1",
      {
        method: "POST",
        headers: {
          "CF-Access-Client-Id": env.EVS_ACCESS_CLIENT_ID ?? "",
          "CF-Access-Client-Secret": env.EVS_ACCESS_CLIENT_SECRET ?? "",
        },
      },
      env
    );
    assert.equal(response.status, 404);
    const json = await response.json();
    assert.equal(json.error.code, "NOT_FOUND");
  } finally {
    close();
  }
});

test("EVS ingest accepts Cloudflare Access JWT assertions before request lookup", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;
  try {
    await createEvsRequestsTable(db);
    const env = createPlatformRouteEnv(db);
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain: env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "https://macxs.cloudflareaccess.com",
      clientId: env.EVS_ACCESS_CLIENT_ID ?? "",
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

    const response = await app.request(
      "http://localhost/v1/evs/ingest/req_1",
      {
        method: "POST",
        headers: {
          "CF-Access-Jwt-Assertion": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: "req_1",
          provider: "browserstack",
          requested_at: "2026-04-13T12:00:00.000Z",
          completed_at: "2026-04-13T12:05:00.000Z",
          target_pages: [],
          raw_artifacts: [],
          assertions: [],
          summary: { status: "passed", checks_total: 0, checks_failed: 0 },
        }),
      },
      env
    );
    assert.equal(response.status, 404);
    const json = await response.json();
    assert.equal(json.error.code, "NOT_FOUND");
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});
