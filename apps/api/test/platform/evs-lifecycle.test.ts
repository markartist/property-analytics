import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";

async function seedAuth(db: D1Database) {
  await run(
    db,
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      deleted_at TEXT,
      deleted_by TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );
}

async function createSession(db: D1Database, role: "admin" | "editor" | "viewer", userId: string) {
  const rawToken = Buffer.from(`${userId}-evs-session`).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO users (id, email, full_name, role, is_active, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    [userId, `${userId}@example.com`, userId, role, now, now, now]
  );
  await run(
    db,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, revoked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [`session_${userId}`, userId, tokenHash, new Date(Date.now() + 86400000).toISOString(), now, now]
  );
  return rawToken;
}

async function seedEvsTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE evs_properties (
      id TEXT PRIMARY KEY,
      property_name TEXT NOT NULL,
      community_id TEXT,
      legacy_url TEXT,
      staging_url TEXT NOT NULL,
      cohort TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
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
  await run(
    db,
    `CREATE TABLE evs_results (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      property_id TEXT,
      profile TEXT,
      environment TEXT,
      status TEXT,
      summary TEXT,
      severity TEXT,
      business_impact TEXT,
      recommended_action TEXT,
      evidence_refs_json TEXT,
      normalized_payload_json TEXT,
      created_at TEXT
    )`
  );

  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO evs_properties
     (id, property_name, community_id, legacy_url, staging_url, cohort, is_active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, 'pilot', 1, ?, ?)`,
    [
      "calais-midtown",
      "Calais Midtown",
      "https://venterraliving.com/apartments/calais-midtown/",
      "https://calaismidtown.kinsta.cloud/",
      now,
      now,
    ]
  );
}

async function requestWithSession(
  env: ReturnType<typeof createPlatformRouteEnv>,
  rawToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
) {
  return app.request(
    `http://localhost${path}`,
    {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        cookie: `pop_session=${rawToken}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    env
  );
}

test("EVS request lifecycle records explicit orchestrator handoff and derived dispatch state", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedEvsTables(db);
    const editorToken = await createSession(db, "editor", "editor_evs");
    const env = createPlatformRouteEnv(db);

    const createResponse = await requestWithSession(env, editorToken, "/v1/evs/requests", {
      method: "POST",
      body: {
        source_consumer: "operator",
        property_id: "calais-midtown",
        environment: "staging",
        reason: "Validate staging homepage after release candidate",
        priority: "high",
        target_pages: ["https://calaismidtown.kinsta.cloud/"],
        validation_profiles: ["broad_experiential_homepage"],
        device_profiles: ["iphone_safari"],
        execution_mode: "manual",
        trigger_metadata: { initiated_from: "test" },
      },
    });
    assert.equal(createResponse.status, 201);
    const createdJson = await createResponse.json();
    assert.equal(createdJson.request.dispatch_state, "awaiting_handoff");
    assert.equal(createdJson.execution_plan.workflow_name, "evs-browserstack-experiential.yml");

    const requestId = createdJson.request.request_id as string;

    const getBeforeHandoff = await requestWithSession(env, editorToken, `/v1/evs/requests/${requestId}`);
    assert.equal(getBeforeHandoff.status, 200);
    const beforeJson = await getBeforeHandoff.json();
    assert.equal(beforeJson.request.dispatch_state, "awaiting_handoff");

    const handoffResponse = await requestWithSession(env, editorToken, `/v1/evs/requests/${requestId}/handoff`, {
      method: "POST",
      body: {
        orchestrator_ref: "github:evs-browserstack-experiential.yml#42",
        status: "running",
      },
    });
    assert.equal(handoffResponse.status, 200);
    const handoffJson = await handoffResponse.json();
    assert.equal(handoffJson.request.orchestrator_ref, "github:evs-browserstack-experiential.yml#42");
    assert.equal(handoffJson.request.status, "running");
    assert.equal(handoffJson.request.dispatch_state, "executing");

    const listResponse = await requestWithSession(env, editorToken, "/v1/evs/requests");
    assert.equal(listResponse.status, 200);
    const listJson = await listResponse.json();
    assert.equal(listJson.requests[0].dispatch_state, "executing");
  } finally {
    close();
  }
});

test("EVS request creation requires draft permission", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedEvsTables(db);
    const viewerToken = await createSession(db, "viewer", "viewer_evs");
    const env = createPlatformRouteEnv(db);

    const createResponse = await requestWithSession(env, viewerToken, "/v1/evs/requests", {
      method: "POST",
      body: {
        source_consumer: "operator",
        property_id: "calais-midtown",
        environment: "staging",
        reason: "Validate staging homepage after release candidate",
        priority: "high",
        target_pages: ["https://calaismidtown.kinsta.cloud/"],
        validation_profiles: ["broad_experiential_homepage"],
        device_profiles: ["iphone_safari"],
        execution_mode: "manual",
        trigger_metadata: { initiated_from: "test" },
      },
    });

    assert.equal(createResponse.status, 403);
    const createJson = await createResponse.json();
    assert.equal(createJson.error.code, "FORBIDDEN");
    assert.match(createJson.error.message, /evs:draft/);
  } finally {
    close();
  }
});

test("EVS handoff requires handoff permission", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedEvsTables(db);
    const editorToken = await createSession(db, "editor", "editor_evs_2");
    const viewerToken = await createSession(db, "viewer", "viewer_evs_2");
    const env = createPlatformRouteEnv(db);

    const createResponse = await requestWithSession(env, editorToken, "/v1/evs/requests", {
      method: "POST",
      body: {
        source_consumer: "operator",
        property_id: "calais-midtown",
        environment: "staging",
        reason: "Validate staging homepage after release candidate",
        priority: "high",
        target_pages: ["https://calaismidtown.kinsta.cloud/"],
        validation_profiles: ["broad_experiential_homepage"],
        device_profiles: ["iphone_safari"],
        execution_mode: "manual",
        trigger_metadata: { initiated_from: "test" },
      },
    });
    assert.equal(createResponse.status, 201);
    const createdJson = await createResponse.json();
    const requestId = createdJson.request.request_id as string;

    const handoffResponse = await requestWithSession(env, viewerToken, `/v1/evs/requests/${requestId}/handoff`, {
      method: "POST",
      body: {
        orchestrator_ref: "github:evs-browserstack-experiential.yml#43",
        status: "running",
      },
    });

    assert.equal(handoffResponse.status, 403);
    const handoffJson = await handoffResponse.json();
    assert.equal(handoffJson.error.code, "FORBIDDEN");
    assert.match(handoffJson.error.message, /evs:handoff/);
  } finally {
    close();
  }
});
