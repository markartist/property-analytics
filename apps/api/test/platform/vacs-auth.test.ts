import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { ensureGovernedMemoryTables } from "../../src/platform/memory/governed-memory";
import { buildCloudflareAccessJwt } from "../helpers/cloudflare-access-jwt";

async function seedVacsContextSchema(db: D1Database) {
  await run(
    db,
    `CREATE TABLE communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      full_url TEXT,
      ga4_property_id TEXT,
      region TEXT,
      encasa_short_name TEXT,
      deleted_at TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE pib_ga4_metrics (
      community_id TEXT,
      snapshot_date TEXT,
      sessions_trend_pct REAL
    )`
  );
  await run(
    db,
    `CREATE TABLE pib_local_presence (
      community_id TEXT,
      snapshot_date TEXT,
      total_profile_views INTEGER,
      views_trend_pct REAL
    )`
  );
  await run(
    db,
    `CREATE TABLE pib_cir (
      community_id TEXT,
      snapshot_date TEXT,
      cir_value REAL
    )`
  );
  await run(
    db,
    `CREATE TABLE pib_reviews (
      community_id TEXT,
      snapshot_date TEXT,
      avg_rating REAL
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_data (
      community_id TEXT,
      week_date TEXT,
      current_specials TEXT,
      most_common_floorplans TEXT,
      website_notes TEXT,
      seo_notes TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE intelligence_claims (
      id TEXT PRIMARY KEY,
      property_id TEXT,
      cohort_key TEXT,
      claim_text TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL,
      applicable_scope TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE intelligence_evidence (
      id TEXT PRIMARY KEY,
      evidence_type TEXT NOT NULL,
      source_system TEXT NOT NULL,
      reference TEXT NOT NULL,
      summary TEXT NOT NULL,
      timestamp TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE intelligence_claim_evidence (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      evidence_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );
}

test("VACS context requires configured service auth", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const env = createPlatformRouteEnv(db);
    env.VACS_ACCESS_CLIENT_ID = "";
    env.VACS_ACCESS_CLIENT_SECRET = "";

    const response = await app.request("http://localhost/v1/vacs/context/prop_1", {}, env);
    assert.equal(response.status, 503);
    const json = await response.json();
    assert.equal(json.error.code, "SERVICE_UNAVAILABLE");
  } finally {
    close();
  }
});

test("VACS context rejects requests without valid service credentials", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const env = createPlatformRouteEnv(db);

    const response = await app.request("http://localhost/v1/vacs/context/prop_1", {}, env);
    assert.equal(response.status, 401);
    const json = await response.json();
    assert.equal(json.error.code, "UNAUTHORIZED");
  } finally {
    close();
  }
});

test("VACS context accepts valid Cloudflare Access service-token headers before property lookup", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedVacsContextSchema(db);
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/vacs/context/prop_1",
      {
        headers: {
          "CF-Access-Client-Id": env.VACS_ACCESS_CLIENT_ID ?? "",
          "CF-Access-Client-Secret": env.VACS_ACCESS_CLIENT_SECRET ?? "",
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

test("VACS context accepts Cloudflare Access service-token headers", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedVacsContextSchema(db);
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/vacs/context/prop_1",
      {
        headers: {
          "CF-Access-Client-Id": env.VACS_ACCESS_CLIENT_ID ?? "",
          "CF-Access-Client-Secret": env.VACS_ACCESS_CLIENT_SECRET ?? "",
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

test("VACS context accepts Cloudflare Access JWT assertions for the VACS service token", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;
  try {
    await seedVacsContextSchema(db);
    const env = createPlatformRouteEnv(db);
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain: env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "https://macxs.cloudflareaccess.com",
      clientId: env.VACS_ACCESS_CLIENT_ID ?? "",
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
      "http://localhost/v1/vacs/context/prop_1",
      {
        headers: {
          "CF-Access-Jwt-Assertion": token,
        },
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

test("VACS context keeps PIB, memory, and intelligence distinct and returns only authoritative memory", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedVacsContextSchema(db);
    await ensureGovernedMemoryTables(db);
    const env = createPlatformRouteEnv(db);
    const now = new Date().toISOString();

    await run(
      db,
      `INSERT INTO communities (id, name, city, state, full_url, ga4_property_id, region, encasa_short_name, deleted_at)
       VALUES ('prop_1', 'District', 'Orlando', 'FL', 'https://district.example.com', 'ga4-prop-1', 'Central Florida', 'District', NULL)`
    );
    await run(
      db,
      `INSERT INTO pib_ga4_metrics (community_id, snapshot_date, sessions_trend_pct)
       VALUES ('prop_1', '2026-04-13', 12.5)`
    );
    await run(
      db,
      `INSERT INTO marketing_data (community_id, week_date, current_specials, most_common_floorplans, website_notes, seo_notes)
       VALUES ('prop_1', '2026-04-13', '2 weeks free', 'A1 / B2', 'Pool. Fitness center.', 'Universal proximity. Commuter access.')`
    );
    await run(
      db,
      `INSERT INTO intelligence_claims (id, property_id, cohort_key, claim_text, source, confidence, applicable_scope, status, created_at, updated_at)
       VALUES ('claim_1', 'prop_1', NULL, 'District benefits from entertainment access.', 'intelligence_office', 0.9, 'property', 'active', ?, ?)`,
      [now, now]
    );
    await run(
      db,
      `INSERT INTO intelligence_evidence (id, evidence_type, source_system, reference, summary, timestamp, status, created_at, updated_at)
       VALUES ('evidence_1', 'metric', 'Data Pond', 'ga4:prop_1:2026-04-13', 'Traffic improved after proof refresh.', ?, 'active', ?, ?)`,
      [now, now, now]
    );
    await run(
      db,
      `INSERT INTO intelligence_claim_evidence (id, claim_id, evidence_id, created_at)
       VALUES ('link_1', 'claim_1', 'evidence_1', ?)`,
      [now]
    );

    await run(
      db,
      `INSERT INTO governed_memory_entries
       (id, scope, property_id, fleet_key, ledger_key, summary, structured_payload_json, source_system, created_by, confidence, status, dedupe_signature, parent_entry_id, originating_candidate_id, created_at, updated_at)
       VALUES
       ('captain_active', 'property', 'prop_1', NULL, NULL, 'Active captain memory.', NULL, 'intelligence_office', 'tester', 0.9, 'active', 'sig-cap-active', NULL, NULL, ?, ?),
       ('captain_deprecated', 'property', 'prop_1', NULL, NULL, 'Deprecated captain memory.', NULL, 'intelligence_office', 'tester', 0.4, 'deprecated', 'sig-cap-deprecated', NULL, NULL, ?, ?),
       ('fleet_active', 'fleet', NULL, 'central-florida', NULL, 'Active fleet memory.', NULL, 'intelligence_office', 'tester', 0.8, 'active', 'sig-fleet-active', NULL, NULL, ?, ?),
       ('fleet_deprecated', 'fleet', NULL, 'central-florida', NULL, 'Deprecated fleet memory.', NULL, 'intelligence_office', 'tester', 0.4, 'deprecated', 'sig-fleet-deprecated', NULL, NULL, ?, ?),
       ('ledger_approved', 'ledger', NULL, NULL, 'the-ledger', 'Approved ledger memory.', NULL, 'intelligence_office', 'tester', 0.85, 'approved', 'sig-ledger-approved', NULL, NULL, ?, ?),
       ('ledger_deprecated', 'ledger', NULL, NULL, 'the-ledger', 'Deprecated ledger memory.', NULL, 'intelligence_office', 'tester', 0.3, 'deprecated', 'sig-ledger-deprecated', NULL, NULL, ?, ?)`,
      [now, now, now, now, now, now, now, now, now, now, now, now]
    );

    const response = await app.request(
      "http://localhost/v1/vacs/context/prop_1",
      {
        headers: {
          "CF-Access-Client-Id": env.VACS_ACCESS_CLIENT_ID ?? "",
          "CF-Access-Client-Secret": env.VACS_ACCESS_CLIENT_SECRET ?? "",
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.ok(json.pib);
    assert.ok(json.memory);
    assert.ok(json.intelligence);
    assert.equal(json.memory.captains_log.length, 1);
    assert.equal(json.memory.captains_log[0].status, "active");
    assert.equal(json.memory.fleet_brief.length, 1);
    assert.equal(json.memory.fleet_brief[0].status, "active");
    assert.equal(json.memory.ledger.length, 1);
    assert.equal(json.memory.ledger[0].status, "approved");
    assert.equal(json.intelligence.claims.length, 1);
    assert.equal(json.intelligence.evidence.length, 1);
    assert.equal(json.memory.captains_log[0].summary, "Active captain memory.");
    assert.equal(json.intelligence.claims[0].claim_text, "District benefits from entertainment access.");
  } finally {
    close();
  }
});
