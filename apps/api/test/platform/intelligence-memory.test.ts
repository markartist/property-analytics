import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { queryAll, queryFirst, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";

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
     VALUES
      ('prop_1', 'The District at Universal Boulevard', 'Central Florida', 'District', NULL),
      ('prop_2', 'Ventana', 'Central Florida', 'Ventana', NULL),
      ('prop_3', 'The Harrison', 'Atlanta', 'Harrison', NULL)`
  );
}

async function createSession(db: D1Database, role: "admin" | "editor" | "viewer", userId: string) {
  const rawToken = Buffer.from(`${userId}-governed-memory-session-token-0001`).toString("base64url");
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
  rawToken: string | null,
  path: string,
  init: { method?: string; body?: unknown } = {}
) {
  return app.request(
    `http://localhost${path}`,
    {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(rawToken ? { cookie: `pop_session=${rawToken}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    env
  );
}

test("Captain's Log stays isolated to the requested property for read access", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuthAndCommunities(db);
    const editorToken = await createSession(db, "editor", "editor_1");
    const viewerToken = await createSession(db, "viewer", "viewer_1");
    const env = createPlatformRouteEnv(db);

    const firstCreate = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_1/log", {
      method: "POST",
      body: {
        summary: "District traffic dip tied to stale map pack photos.",
        evidence: [{ evidenceType: "metric", evidenceSource: "Data Pond", evidenceRef: "ga4:prop_1:2026-04-01", evidenceExcerpt: "Sessions and CTR both slipped." }],
        sourceSystem: "intelligence_office",
        confidence: 0.88,
      },
    });
    assert.equal(firstCreate.status, 201);

    const secondCreate = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_2/log", {
      method: "POST",
      body: {
        summary: "Ventana lead quality improved after neighborhood copy rewrite.",
        evidence: [{ evidenceType: "metric", evidenceSource: "Data Pond", evidenceRef: "ga4:prop_2:2026-04-01", evidenceExcerpt: "Leasing conversions rose." }],
        sourceSystem: "intelligence_office",
        confidence: 0.84,
      },
    });
    assert.equal(secondCreate.status, 201);

    const response = await requestWithSession(env, viewerToken, "/v1/intelligence-memory/properties/prop_1/log");
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.entries.length, 1);
    assert.equal(json.entries[0].entry.property_id, "prop_1");
    assert.equal(json.context.identity.display_name, "District's Captain");
  } finally {
    close();
  }
});

test("governed memory context can fall back to pilot property records when communities is not seeded", async () => {
  const { db, close } = await createTestD1Database();
  try {
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

    const adminToken = await createSession(db, "admin", "admin_fallback");
    const env = createPlatformRouteEnv(db);

    const boot = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(boot.status, 200);

    const response = await requestWithSession(env, adminToken, "/v1/intelligence-memory/context/property/calais-midtown");
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.propertyId, "calais-midtown");
    assert.equal(json.identity.display_name, "Calais Midtown's Captain");
    assert.equal(json.fleetKey, "property-calais-midtown");
  } finally {
    close();
  }
});

test("governed memory creation requires provenance and blocks viewer writes", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuthAndCommunities(db);
    const viewerToken = await createSession(db, "viewer", "viewer_2");
    const editorToken = await createSession(db, "editor", "editor_2");
    const env = createPlatformRouteEnv(db);

    const viewerResponse = await requestWithSession(env, viewerToken, "/v1/intelligence-memory/properties/prop_1/log", {
      method: "POST",
      body: {
        summary: "Unauthorized attempt.",
        evidence: [{ evidenceType: "metric", evidenceSource: "Data Pond", evidenceRef: "ref-1" }],
        sourceSystem: "intelligence_office",
        confidence: 0.6,
      },
    });
    assert.equal(viewerResponse.status, 403);

    const missingEvidence = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_1/log", {
      method: "POST",
      body: {
        summary: "Missing evidence should fail.",
        evidence: [],
        sourceSystem: "intelligence_office",
        confidence: 0.6,
      },
    });
    assert.equal(missingEvidence.status, 400);
  } finally {
    close();
  }
});

test("promotion flow is explicit and blocks direct institutional jumps from property memory", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuthAndCommunities(db);
    const editorToken = await createSession(db, "editor", "editor_3");
    const env = createPlatformRouteEnv(db);

    const createResponse = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_1/log", {
      method: "POST",
      body: {
        summary: "District should emphasize commuter proof in Universal-area copy.",
        evidence: [{ evidenceType: "directive", evidenceSource: "Intelligence Office", evidenceRef: "brief:district", evidenceExcerpt: "Location proof is underdeveloped." }],
        sourceSystem: "intelligence_office",
        confidence: 0.93,
      },
    });
    const created = await createResponse.json();

    const blockedLedger = await requestWithSession(
      env,
      editorToken,
      `/v1/intelligence-memory/entries/${created.entry.id}/candidates/ledger`,
      {
        method: "POST",
        body: {
          rationale: "This should fail because property memory cannot jump directly to The Ledger.",
        },
      }
    );
    assert.equal(blockedLedger.status, 409);

    const fleetCandidateResponse = await requestWithSession(
      env,
      editorToken,
      `/v1/intelligence-memory/entries/${created.entry.id}/candidates/fleet`,
      {
        method: "POST",
        body: {
          rationale: "Promote District guidance into the Central Florida cohort brief.",
        },
      }
    );
    assert.equal(fleetCandidateResponse.status, 201);
    const fleetCandidate = await fleetCandidateResponse.json();
    assert.equal(fleetCandidate.fleet_key, "central-florida");

    const fleetPromotionResponse = await requestWithSession(
      env,
      editorToken,
      `/v1/intelligence-memory/candidates/${fleetCandidate.id}/promote`,
      { method: "POST", body: {} }
    );
    assert.equal(fleetPromotionResponse.status, 200);
    const fleetPromotion = await fleetPromotionResponse.json();
    assert.equal(fleetPromotion.entry.entry.scope, "fleet");

    const ledgerCandidateResponse = await requestWithSession(
      env,
      editorToken,
      `/v1/intelligence-memory/entries/${fleetPromotion.entry.entry.id}/candidates/ledger`,
      {
        method: "POST",
        body: {
          rationale: "This pattern is reusable institutional guidance for entertainment-adjacent Orlando properties.",
        },
      }
    );
    assert.equal(ledgerCandidateResponse.status, 201);
    const ledgerCandidate = await ledgerCandidateResponse.json();

    const ledgerPromotionResponse = await requestWithSession(
      env,
      editorToken,
      `/v1/intelligence-memory/candidates/${ledgerCandidate.id}/promote`,
      { method: "POST", body: {} }
    );
    assert.equal(ledgerPromotionResponse.status, 200);
    const ledgerPromotion = await ledgerPromotionResponse.json();
    assert.equal(ledgerPromotion.entry.entry.scope, "ledger");

    const promotions = await queryAll<{ to_scope: string }>(db, `SELECT to_scope FROM governed_memory_promotions ORDER BY created_at ASC`);
    assert.deepEqual(promotions.map((row) => row.to_scope), ["fleet", "ledger"]);
  } finally {
    close();
  }
});

test("promotion writes are auditable and ledger approval cannot bypass evidence lineage", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuthAndCommunities(db);
    const editorToken = await createSession(db, "editor", "editor_4");
    const env = createPlatformRouteEnv(db);

    await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_3/log", {
      method: "POST",
      body: {
        summary: "Harrison trust signals should be standardized in Atlanta portfolio copy.",
        evidence: [{ evidenceType: "directive", evidenceSource: "Intelligence Office", evidenceRef: "brief:harrison", evidenceExcerpt: "Trust markers lag the market." }],
        sourceSystem: "intelligence_office",
        confidence: 0.87,
      },
    });

    const auditRows = await queryAll<{ action: string }>(
      db,
      `SELECT action FROM audit_log ORDER BY created_at ASC`
    );
    assert.ok(auditRows.some((row) => row.action === "intelligence_memory.captains_log.create"));

    const ledgerRows = await queryFirst<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM governed_memory_entries WHERE scope = 'ledger'`
    );
    assert.equal(ledgerRows?.count ?? 0, 0);
  } finally {
    close();
  }
});

test("promoted_existing preserves upstream lineage and authoritative reads exclude deprecated memory", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuthAndCommunities(db);
    const editorToken = await createSession(db, "editor", "editor_5");
    const adminToken = await createSession(db, "admin", "admin_5");
    const env = createPlatformRouteEnv(db);

    const createOne = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_1/log", {
      method: "POST",
      body: {
        summary: "District memory one.",
        evidence: [{ evidenceType: "metric", evidenceSource: "Data Pond", evidenceRef: "district-1", evidenceExcerpt: "First evidence." }],
        sourceSystem: "intelligence_office",
        confidence: 0.9,
      },
    });
    const first = await createOne.json();
    const createTwo = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_2/log", {
      method: "POST",
      body: {
        summary: "District memory one.",
        evidence: [{ evidenceType: "metric", evidenceSource: "Data Pond", evidenceRef: "ventana-1", evidenceExcerpt: "Second evidence." }],
        sourceSystem: "intelligence_office",
        confidence: 0.85,
      },
    });
    const second = await createTwo.json();

    const candidateOne = await requestWithSession(env, editorToken, `/v1/intelligence-memory/entries/${first.entry.id}/candidates/fleet`, {
      method: "POST",
      body: { rationale: "Promote first property into governed fleet." },
    });
    const candidateOneJson = await candidateOne.json();
    const promoteOne = await requestWithSession(env, editorToken, `/v1/intelligence-memory/candidates/${candidateOneJson.id}/promote`, {
      method: "POST",
      body: {},
    });
    const promoteOneJson = await promoteOne.json();

    const candidateTwo = await requestWithSession(env, editorToken, `/v1/intelligence-memory/entries/${second.entry.id}/candidates/fleet`, {
      method: "POST",
      body: { rationale: "Promote second property into same governed fleet." },
    });
    const candidateTwoJson = await candidateTwo.json();
    const promoteTwo = await requestWithSession(env, editorToken, `/v1/intelligence-memory/candidates/${candidateTwoJson.id}/promote`, {
      method: "POST",
      body: {},
    });
    const promoteTwoJson = await promoteTwo.json();
    assert.equal(promoteTwoJson.actionType, "promoted_existing");
    assert.equal(promoteTwoJson.entry.lineage.length, 2);
    assert.equal(promoteTwoJson.entry.evidence.length, 3);

    await run(
      db,
      `UPDATE governed_memory_entries SET status = 'deprecated', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), first.entry.id]
    );

    const defaultRead = await requestWithSession(env, editorToken, "/v1/intelligence-memory/properties/prop_1/log");
    const defaultReadJson = await defaultRead.json();
    assert.equal(defaultReadJson.entries.length, 0);

    const adminRead = await requestWithSession(env, adminToken, "/v1/intelligence-memory/properties/prop_1/log?include_all=1");
    const adminReadJson = await adminRead.json();
    assert.equal(adminReadJson.entries.length, 1);
    assert.equal(adminReadJson.entries[0].entry.status, "deprecated");

    const fleetEntryId = promoteOneJson.entry.entry.id;
    const lineageRows = await queryAll<{ source_entry_id: string }>(
      db,
      `SELECT source_entry_id FROM governed_memory_entry_lineage WHERE target_entry_id = ? ORDER BY source_entry_id ASC`,
      [fleetEntryId]
    );
    assert.deepEqual(lineageRows.map((row) => row.source_entry_id), [first.entry.id, second.entry.id].sort());
  } finally {
    close();
  }
});
