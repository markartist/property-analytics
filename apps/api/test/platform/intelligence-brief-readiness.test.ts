import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { queryFirst, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { ensureGovernedMemoryTables } from "../../src/platform/memory/governed-memory";

async function seedAuthAndCommunities(db: D1Database) {
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
  await run(
    db,
    `CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      request_id TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT,
      encasa_short_name TEXT,
      deleted_at TEXT
    )`
  );
  await run(
    db,
    `INSERT INTO communities (id, name, region, encasa_short_name, deleted_at)
     VALUES ('calais-midtown', 'Calais Midtown', 'Houston', 'Calais', NULL)`
  );
}

async function createSession(db: D1Database, role: "admin" | "editor" | "viewer", userId: string) {
  const rawToken = Buffer.from(`${userId}-intelligence-brief-session`).toString("base64url");
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

test("brief readiness reports missing components when no memory or claims exist", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await ensureGovernedMemoryTables(db);
    await seedAuthAndCommunities(db);
    const adminToken = await createSession(db, "admin", "admin_1");
    const env = createPlatformRouteEnv(db);

    const response = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(response.status, 200);
    const json = await response.json();
    const readiness = json.briefReadiness["calais-midtown"];
    assert.equal(readiness.completeness_status, "incomplete");
    assert.ok(readiness.missing_components.includes("captains_log"));
  } finally {
    close();
  }
});

test("brief readiness reaches ready once claims, evidence, and captain log are present", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await ensureGovernedMemoryTables(db);
    await seedAuthAndCommunities(db);
    const adminToken = await createSession(db, "admin", "admin_2");
    const env = createPlatformRouteEnv(db);

    const boot = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(boot.status, 200);

    const evidenceResponse = await requestWithSession(env, adminToken, "/v1/admin/intelligence/evidence", {
      method: "POST",
      body: {
        evidence_type: "metric",
        source_system: "Data Pond",
        reference: "ga4:calais-midtown:2026-04-10",
        summary: "Sessions improved after CTA refresh.",
      },
    });
    assert.equal(evidenceResponse.status, 201);
    const evidence = await evidenceResponse.json();

    const claimResponse = await requestWithSession(env, adminToken, "/v1/admin/intelligence/claims", {
      method: "POST",
      body: {
        property_id: "calais-midtown",
        claim_text: "Calais Midtown benefits from Midtown Houston proximity and transit access.",
        source: "intelligence_office",
        confidence: 0.9,
        applicable_scope: "property",
        linked_evidence_ids: [evidence.id],
      },
    });
    assert.equal(claimResponse.status, 201);

    const logResponse = await requestWithSession(env, adminToken, "/v1/intelligence-memory/properties/calais-midtown/log", {
      method: "POST",
      body: {
        summary: "Focus on Midtown access and daily convenience as the lead narrative.",
        structuredPayload: {
          messaging_priorities: ["Midtown access", "Commuter convenience"],
        },
        evidence: [{ evidenceType: "metric", evidenceSource: "Data Pond", evidenceRef: "ga4:calais-midtown:2026-04-10" }],
        sourceSystem: "intelligence_office",
        confidence: 0.86,
      },
    });
    assert.equal(logResponse.status, 201);

    const response = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(response.status, 200);
    const json = await response.json();
    const readiness = json.briefReadiness["calais-midtown"];
    assert.equal(readiness.completeness_status, "ready");
    assert.equal(readiness.missing_components.length, 0);
  } finally {
    close();
  }
});

test("property brief inputs stay scoped to the requested property", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await ensureGovernedMemoryTables(db);
    await seedAuthAndCommunities(db);
    await run(
      db,
      `INSERT INTO communities (id, name, region, encasa_short_name, deleted_at)
       VALUES ('other-prop', 'Other Prop', 'Dallas', 'Other', NULL)`
    );
    const adminToken = await createSession(db, "admin", "admin_3");
    const env = createPlatformRouteEnv(db);
    const boot = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(boot.status, 200);

    const evidenceOne = await requestWithSession(env, adminToken, "/v1/admin/intelligence/evidence", {
      method: "POST",
      body: {
        evidence_type: "metric",
        source_system: "Data Pond",
        reference: "ga4:calais-midtown:2026-04-13",
        summary: "Calais evidence",
      },
    });
    const evidenceOneJson = await evidenceOne.json();

    const evidenceTwo = await requestWithSession(env, adminToken, "/v1/admin/intelligence/evidence", {
      method: "POST",
      body: {
        evidence_type: "metric",
        source_system: "Data Pond",
        reference: "ga4:other-prop:2026-04-13",
        summary: "Other evidence",
      },
    });
    const evidenceTwoJson = await evidenceTwo.json();

    await requestWithSession(env, adminToken, "/v1/admin/intelligence/claims", {
      method: "POST",
      body: {
        property_id: "calais-midtown",
        claim_text: "Calais scoped claim.",
        source: "intelligence_office",
        confidence: 0.9,
        applicable_scope: "property",
        linked_evidence_ids: [evidenceOneJson.id],
      },
    });

    await requestWithSession(env, adminToken, "/v1/admin/intelligence/claims", {
      method: "POST",
      body: {
        property_id: "other-prop",
        claim_text: "Other scoped claim.",
        source: "intelligence_office",
        confidence: 0.7,
        applicable_scope: "property",
        linked_evidence_ids: [evidenceTwoJson.id],
      },
    });

    const response = await requestWithSession(env, adminToken, "/v1/admin/intelligence/properties/calais-midtown/brief-inputs");
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.property.property_id, "calais-midtown");
    assert.equal(json.claims.length, 1);
    assert.equal(json.claims[0].claim_text, "Calais scoped claim.");
    assert.equal(json.evidence.length, 1);
    assert.equal(json.evidence[0].summary, "Calais evidence");
    assert.equal(json.claimEvidence.length, 1);
  } finally {
    close();
  }
});
