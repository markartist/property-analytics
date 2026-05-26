import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { queryAll, queryFirst, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";

interface ScanPayload {
  processed: number;
  sent: number;
  suppressed_duplicate: number;
}

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
  const rawToken = Buffer.from(`${userId}-marketing-session`).toString("base64url");
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

async function seedMarketingTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      external_key TEXT,
      status TEXT,
      deleted_at TEXT
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
    `CREATE TABLE notification_events (
      id TEXT PRIMARY KEY,
      event_type TEXT,
      recipient_email TEXT,
      dedupe_key TEXT,
      status TEXT,
      provider_message_id TEXT,
      attempted_at TEXT,
      error_text TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `INSERT INTO communities (id, name, external_key, status, deleted_at)
     VALUES ('comm_1', 'Alpha', 'COMM_A', 'active', NULL)`
  );
}

test("marketing route upserts canonical marketing_weekly record", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedMarketingTables(db);
    const session = await createSession(db, "marketing_admin");
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/marketing/new",
      {
        method: "PATCH",
        headers: {
          cookie: `pop_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          community_id: "comm_1",
          week_ending: "2026-04-17",
          leads_count: 14,
          cost_per_lead: 123.45,
          ad_spend: 1728.9,
          mentions_json: JSON.stringify(["ops@example.com"]),
          notes_text: "Weekly note",
        }),
      },
      env
    );

    assert.equal(response.status, 201);
    const saved = await queryFirst<{ leads_count: number; notes_text: string | null }>(
      db,
      "SELECT leads_count, notes_text FROM marketing_weekly WHERE community_id = 'comm_1' AND week_ending = '2026-04-17'"
    );
    assert.equal(saved?.leads_count, 14);
    assert.equal(saved?.notes_text, "Weekly note");
  } finally {
    await close();
  }
});

test("marketing mention scan creates deduped notification events", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedMarketingTables(db);
    const session = await createSession(db, "marketing_scanner");
    const env = createPlatformRouteEnv(db);
    const now = new Date().toISOString();

    await run(
      db,
      `INSERT INTO marketing_weekly (
        id, week_ending, community_id, leads_count, cost_per_lead, ad_spend, mentions_json, notes_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "mw_1",
        "2026-04-17",
        "comm_1",
        10,
        50,
        500,
        JSON.stringify(["ops@example.com"]),
        "Escalate to regional@example.com and ops@example.com",
        now,
        now,
      ]
    );

    const first = await app.request(
      "http://localhost/v1/marketing/scan-mentions",
      {
        method: "POST",
        headers: {
          cookie: `pop_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ week_ending: "2026-04-17" }),
      },
      env
    );

    assert.equal(first.status, 200);
    const firstPayload = await first.json() as ScanPayload;
    assert.equal(firstPayload.processed, 2);
    assert.equal(firstPayload.sent, 2);
    assert.equal(firstPayload.suppressed_duplicate, 0);

    const second = await app.request(
      "http://localhost/v1/marketing/scan-mentions",
      {
        method: "POST",
        headers: {
          cookie: `pop_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ week_ending: "2026-04-17" }),
      },
      env
    );

    assert.equal(second.status, 200);
    const secondPayload = await second.json() as ScanPayload;
    assert.equal(secondPayload.processed, 2);
    assert.equal(secondPayload.sent, 0);
    assert.equal(secondPayload.suppressed_duplicate, 2);

    const events = await queryAll<{ recipient_email: string; status: string }>(
      db,
      "SELECT recipient_email, status FROM notification_events ORDER BY recipient_email ASC"
    );
    assert.deepEqual(events.map((event) => ({ ...event })), [
      { recipient_email: "ops@example.com", status: "sent" },
      { recipient_email: "regional@example.com", status: "sent" },
    ]);
  } finally {
    await close();
  }
});
