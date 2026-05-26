import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { run, queryFirst } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";

class FakeR2Bucket {
  public objects = new Map<string, string>();

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | Blob): Promise<void> {
    if (typeof value === "string") {
      this.objects.set(key, value);
      return;
    }

    if (value instanceof Blob) {
      this.objects.set(key, await value.text());
      return;
    }

    if (value instanceof ArrayBuffer) {
      this.objects.set(key, new TextDecoder().decode(value));
      return;
    }

    this.objects.set(
      key,
      new TextDecoder().decode(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
    );
  }
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
  const rawToken = Buffer.from(`${userId}-metrics-session`).toString("base64url");
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

async function seedMetricsTables(db: D1Database) {
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
    `CREATE TABLE import_runs (
      id TEXT PRIMARY KEY,
      entity_type TEXT,
      mode TEXT,
      status TEXT,
      requested_by_user_id TEXT,
      rows_received INTEGER,
      rows_applied INTEGER,
      error_summary TEXT,
      started_at TEXT,
      finished_at TEXT,
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

test("metrics paste import parses TSV and resolves community_external_key", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedMetricsTables(db);
    const session = await createSession(db, "metrics_admin");
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/metrics/import/paste",
      {
        method: "POST",
        headers: {
          cookie: `pop_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tsv: [
            "metric_date\twindow_days\ttype\tcommunity_external_key\toccupancy_rate\ttraffic_count",
            "2026-04-17\t7\tcommunity\tCOMM_A\t95%\t123",
            "2026-04-17\t7\tportfolio\t\t96%\t999",
          ].join("\n"),
        }),
      },
      env
    );

    assert.equal(response.status, 200);
    const row = await queryFirst<{ community_id: string | null; occupancy_rate: number; traffic_count: number }>(
      db,
      "SELECT community_id, occupancy_rate, traffic_count FROM weekly_metrics WHERE type = 'community'"
    );
    assert.equal(row?.community_id, "comm_1");
    assert.equal(row?.occupancy_rate, 0.95);
    assert.equal(row?.traffic_count, 123);

    const importRun = await queryFirst<{ status: string; rows_applied: number }>(
      db,
      "SELECT status, rows_applied FROM import_runs LIMIT 1"
    );
    assert.equal(importRun?.status, "applied");
    assert.equal(importRun?.rows_applied, 2);
  } finally {
    close();
  }
});

test("metrics upload import accepts csv file and writes source artifact to R2", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedMetricsTables(db);
    const session = await createSession(db, "upload_admin");
    const env = createPlatformRouteEnv(db);
    const bucket = new FakeR2Bucket();
    env.POP_BRIEF_UPLOADS = bucket as unknown as R2Bucket;

    const form = new FormData();
    form.append(
      "file",
      new File(
        [
          [
            "metric_date,window_days,type,community_external_key,occupancy_rate,applications_count",
            "2026-04-17,30,community,COMM_A,94%,22",
          ].join("\n"),
        ],
        "weekly_metrics.csv",
        { type: "text/csv" }
      )
    );

    const response = await app.request(
      "http://localhost/v1/metrics/import/upload",
      {
        method: "POST",
        headers: {
          cookie: `pop_session=${session}`,
        },
        body: form,
      },
      env
    );

    assert.equal(response.status, 200);
    assert.equal(bucket.objects.size, 1);
    const imported = await queryFirst<{ applications_count: number; occupancy_rate: number }>(
      db,
      "SELECT applications_count, occupancy_rate FROM weekly_metrics WHERE type = 'community'"
    );
    assert.equal(imported?.applications_count, 22);
    assert.equal(imported?.occupancy_rate, 0.94);
  } finally {
    close();
  }
});

test("backup endpoint creates an R2 artifact with requested entities", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedMetricsTables(db);
    const session = await createSession(db, "backup_admin");
    const env = createPlatformRouteEnv(db);
    const bucket = new FakeR2Bucket();
    env.POP_BRIEF_UPLOADS = bucket as unknown as R2Bucket;

    await run(
      db,
      `INSERT INTO weekly_metrics (id, metric_date, window_days, type, community_id, occupancy_rate)
       VALUES ('wm_1', '2026-04-17', 7, 'community', 'comm_1', 0.95)`
    );

    const response = await app.request(
      "http://localhost/v1/exports/backup",
      {
        method: "POST",
        headers: {
          cookie: `pop_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ entities: ["communities", "weekly_metrics"] }),
      },
      env
    );

    assert.equal(response.status, 200);
    const json = await response.json() as { ok: boolean; key: string; counts: Record<string, number> };
    assert.equal(json.ok, true);
    assert.equal(json.counts.communities, 1);
    assert.equal(json.counts.weekly_metrics, 1);
    assert.ok(bucket.objects.has(json.key));
    const payload = bucket.objects.get(json.key) ?? "";
    assert.match(payload, /weekly_metrics/);
    assert.match(payload, /communities/);
  } finally {
    close();
  }
});
