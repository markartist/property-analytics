import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { queryAll, queryFirst, run } from "../../src/lib/db";
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

async function createSession(db: D1Database, userId: string) {
  const rawToken = Buffer.from(`${userId}-marketing-data-session`).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO users (id, email, full_name, role, is_active, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', 1, ?, ?, ?)`,
    [userId, `${userId}@example.com`, userId, now, now, now]
  );
  await run(
    db,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, revoked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [`session_${userId}`, userId, tokenHash, new Date(Date.now() + 86400000).toISOString(), now, now]
  );
  return rawToken;
}

async function seedMarketingDataTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      external_key TEXT,
      encasa_short_name TEXT,
      status TEXT,
      deleted_at TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_data (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL,
      week_date TEXT NOT NULL,
      t7_engaged_sessions_delta REAL,
      t7_organic_sessions_delta REAL,
      t30_engaged_sessions_delta REAL,
      t30_organic_sessions_delta REAL,
      t7_organic_visibility REAL,
      t7_serp_traffic REAL,
      website_notes TEXT,
      seo_notes TEXT,
      website_seo_saved_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `INSERT INTO communities (id, name, external_key, encasa_short_name, status, deleted_at)
     VALUES
     ('comm_1604', 'Avasa at 1604', 'COMM_1604', NULL, 'active', NULL),
     ('comm_oakleaf', 'The Villages at Oakleaf', 'COMM_OAK', NULL, 'active', NULL),
     ('comm_whitney', 'The Whitney', 'COMM_WHIT', NULL, 'active', NULL)`
  );
}

test("marketing-data website seo import resolves known community aliases", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedMarketingDataTables(db);
    const session = await createSession(db, "marketing_data_admin");
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/marketing-data/import/website-seo",
      {
        method: "POST",
        headers: {
          cookie: `pop_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rows: [
            {
              property_name: "1604",
              date: "2026-04-24",
              t7_engaged_sessions_delta: 10,
            },
            {
              property_name: "Oakleaf",
              date: "2026-04-24",
              t7_organic_visibility: 22.5,
            },
            {
              property_name: "Whitney",
              date: "2026-04-24",
              seo_notes: "Recovered from alias import",
            },
          ],
        }),
      },
      env
    );

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      successful: number;
      failed: number;
      errors: Array<{ row: number; error: string }>;
    };
    assert.equal(payload.successful, 3);
    assert.equal(payload.failed, 0);
    assert.deepEqual(payload.errors, []);

    const rows = await queryAll<{ community_id: string; week_date: string; seo_notes: string | null }>(
      db,
      "SELECT community_id, week_date, seo_notes FROM marketing_data ORDER BY community_id ASC"
    );
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { community_id: "comm_1604", week_date: "2026-04-24", seo_notes: null },
      { community_id: "comm_oakleaf", week_date: "2026-04-24", seo_notes: null },
      { community_id: "comm_whitney", week_date: "2026-04-24", seo_notes: "Recovered from alias import" },
    ]);

    const oakleaf = await queryFirst<{ t7_organic_visibility: number | null }>(
      db,
      "SELECT t7_organic_visibility FROM marketing_data WHERE community_id = 'comm_oakleaf'"
    );
    assert.equal(oakleaf?.t7_organic_visibility, 22.5);
  } finally {
    await close();
  }
});
