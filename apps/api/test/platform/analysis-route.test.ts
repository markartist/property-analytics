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

async function createSession(db: D1Database, userId: string) {
  const rawToken = Buffer.from(`${userId}-analysis-session`).toString("base64url");
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

async function seedAnalysisTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      external_key TEXT,
      region TEXT,
      status TEXT,
      deleted_at TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE weekly_metrics (
      id TEXT PRIMARY KEY,
      metric_date TEXT NOT NULL,
      window_days INTEGER NOT NULL,
      type TEXT NOT NULL,
      community_id TEXT,
      occupancy_rate REAL,
      leased_rate REAL,
      traffic_count INTEGER,
      applications_count INTEGER,
      move_ins INTEGER,
      move_outs INTEGER,
      delinquency_rate REAL,
      notes_text TEXT,
      source_import_run_id TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_weekly (
      id TEXT PRIMARY KEY,
      week_ending TEXT,
      community_id TEXT,
      leads_count INTEGER,
      cost_per_lead REAL,
      ad_spend REAL,
      mentions_json TEXT,
      notes_text TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `INSERT INTO communities (id, name, external_key, region, status, deleted_at)
     VALUES ('comm_1', 'Alpha', 'COMM_A', 'Central', 'active', NULL)`
  );

  const now = new Date().toISOString();
  const rows = [
    ["wm_1", "2026-04-17", 7, "community", "comm_1", 0.95, 0.97, 120, 18, 9, 4, 0.01, "T7 note"],
    ["wm_2", "2026-04-17", 7, "portfolio", null, 0.94, 0.96, 150, 20, 11, 5, 0.015, "Portfolio T7"],
    ["wm_3", "2026-04-17", 30, "community", "comm_1", 0.93, 0.95, 460, 61, 28, 17, 0.02, "T30 note"],
    ["wm_4", "2026-04-17", 30, "portfolio", null, 0.92, 0.94, 500, 65, 30, 18, 0.022, "Portfolio T30"],
  ];

  for (const row of rows) {
    await run(
      db,
      `INSERT INTO weekly_metrics (
        id, metric_date, window_days, type, community_id, occupancy_rate, leased_rate, traffic_count,
        applications_count, move_ins, move_outs, delinquency_rate, notes_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...row, now, now]
    );
  }

  await run(
    db,
    `INSERT INTO marketing_weekly (
      id, week_ending, community_id, leads_count, cost_per_lead, ad_spend, mentions_json, notes_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "mw_1",
      "2026-04-17",
      "comm_1",
      14,
      123.45,
      1728.9,
      JSON.stringify(["ops@example.com", "regional@example.com"]),
      "Weekly marketing note",
      now,
      now,
    ]
  );
}

test("analysis route returns canonical weekly metrics and marketing weekly data", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedAnalysisTables(db);
    const session = await createSession(db, "analysis_admin");
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/analysis?community_id=comm_1&week_ending=2026-04-17",
      {
        headers: {
          cookie: `pop_session=${session}`,
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      community: { name: string } | null;
      metrics: { t7_community: { occupancy_rate: number } | null; t30_portfolio: { applications_count: number } | null };
      marketing: { leads_count: number; notes_text: string } | null;
    };

    assert.equal(payload.community?.name, "Alpha");
    assert.equal(payload.metrics.t7_community?.occupancy_rate, 0.95);
    assert.equal(payload.metrics.t30_portfolio?.applications_count, 65);
    assert.equal(payload.marketing?.leads_count, 14);
    assert.equal(payload.marketing?.notes_text, "Weekly marketing note");
  } finally {
    await close();
  }
});
