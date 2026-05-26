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
  const rawToken = Buffer.from(`${userId}-health-session`).toString("base64url");
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

async function seedHealthTables(db: D1Database) {
  await run(db, `CREATE TABLE communities (id TEXT PRIMARY KEY, name TEXT NOT NULL, ga4_property_id TEXT, deleted_at TEXT)`);
  await run(db, `CREATE TABLE pib_ga4_metrics (community_id TEXT, snapshot_date TEXT)`);
  await run(db, `CREATE TABLE pib_site_performance (community_id TEXT, snapshot_date TEXT)`);
  await run(db, `CREATE TABLE pib_local_presence (community_id TEXT, snapshot_date TEXT)`);
  await run(db, `CREATE TABLE pib_search_performance (community_id TEXT, snapshot_date TEXT)`);
  await run(db, `CREATE TABLE pib_cir (community_id TEXT, snapshot_date TEXT)`);
  await run(db, `CREATE TABLE pib_reviews (community_id TEXT, snapshot_date TEXT)`);
  await run(db, `CREATE TABLE marketing_data (community_id TEXT, week_date TEXT)`);
  await run(db, `CREATE TABLE t7_metrics (community_id TEXT, week_date TEXT, type TEXT)`);
  await run(db, `CREATE TABLE t30_metrics (community_id TEXT, week_date TEXT, type TEXT)`);
  await run(
    db,
    `CREATE TABLE data_freshness (
      source_key TEXT,
      source_label TEXT,
      latest_date TEXT,
      row_count INTEGER,
      property_count INTEGER,
      updated_at TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE data_collections (
      collection_date TEXT,
      data_source TEXT,
      status TEXT,
      properties_total INTEGER,
      properties_success INTEGER,
      properties_failed INTEGER,
      properties_skipped INTEGER,
      retry_attempts INTEGER,
      rate_limit_hits INTEGER,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      notes TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE collection_retry_queue (
      queue_id INTEGER,
      collection_date TEXT,
      data_source TEXT,
      property_id TEXT,
      property_name TEXT,
      attempt_count INTEGER,
      status TEXT,
      retry_disposition TEXT,
      last_error_type TEXT,
      last_error_message TEXT,
      next_attempt_at TEXT,
      retry_window_end TEXT,
      resolved_at TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  );

  await run(
    db,
    `INSERT INTO communities (id, name, ga4_property_id, deleted_at)
     VALUES ('prop_1', 'Alpha', 'ga4_alpha', NULL), ('prop_2', 'Beta', 'ga4_beta', NULL)`
  );
  await run(
    db,
    `INSERT INTO pib_ga4_metrics (community_id, snapshot_date)
     VALUES ('prop_1', '2026-04-15'), ('prop_2', '2026-04-15')`
  );
  await run(
    db,
    `INSERT INTO data_freshness (source_key, source_label, latest_date, row_count, property_count, updated_at)
     VALUES ('ga4', 'GA4 Traffic', '2026-04-15', 2, 2, '2026-04-16T12:00:00.000Z')`
  );
  await run(
    db,
    `INSERT INTO data_collections
     (collection_date, data_source, status, properties_total, properties_success, properties_failed, properties_skipped, retry_attempts, rate_limit_hits, started_at, completed_at, error_message, notes)
     VALUES
     (DATE('now', 'localtime'), 'ga4', 'retry_scheduled', 2, 1, 1, 0, 1, 0, '2026-04-16T11:00:00.000Z', NULL, 'Temporary API error', 'retry queued'),
     (DATE('now', 'localtime'), 'bi_manual', 'completed', 1, 1, 0, 0, 0, 0, '2026-04-16T10:00:00.000Z', '2026-04-16T10:15:00.000Z', NULL, NULL)`
  );
  await run(
    db,
    `INSERT INTO collection_retry_queue
     (queue_id, collection_date, data_source, property_id, property_name, attempt_count, status, retry_disposition, last_error_type, last_error_message, next_attempt_at, retry_window_end, resolved_at, notes, created_at, updated_at)
     VALUES
     (1, DATE('now', 'localtime'), 'ga4', 'prop_2', 'Beta', 1, 'pending', 'manual_dependency', 'api', 'Retry later', '2026-04-16T12:30:00.000Z', '2026-04-16T14:00:00.000Z', NULL, 'Waiting for retry window', '2026-04-16T12:00:00.000Z', '2026-04-16T12:00:00.000Z')`
  );
}

test("health status returns structured closure context for Watchtower", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await seedHealthTables(db);
    const session = await createSession(db, "watchtower_admin");
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/health/status",
      {
        headers: {
          cookie: `pop_session=${session}`,
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.daily_collection_status.closure.state, "open");
    assert.equal(json.daily_collection_status.closure.queue_depth, 1);
    assert.equal(typeof json.daily_collection_status.closure.summary_reason, "string");
    assert.ok(Array.isArray(json.daily_collection_status.closure.unresolved_sources));
    assert.deepEqual(json.daily_collection_status.closure.unresolved_sources[0], {
      source: "ga4",
      status: "retry_scheduled",
      reason: "retry_pending",
    });
    assert.ok(Array.isArray(json.daily_collection_status.closure.advisory_sources));
    assert.deepEqual(
      json.daily_collection_status.closure.advisory_sources[0],
      {
        source: "bi_manual",
        status: "completed",
        run_recorded: true,
        latest_recorded_date: new Date().toISOString().slice(0, 10),
        expected_latest_date: new Date().toISOString().slice(0, 10),
        freshness_status: "fresh",
        cadence_key: "same_day_manual",
        cadence_label: "Same-day manual",
      },
    );
    assert.equal(json.telemetry.retry_queue.queue_depth, 1);
  } finally {
    close();
  }
});

test("health status degrades gracefully when ops tables are absent", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    await run(db, `CREATE TABLE communities (id TEXT PRIMARY KEY, name TEXT NOT NULL, ga4_property_id TEXT, deleted_at TEXT)`);
    await run(db, `CREATE TABLE pib_ga4_metrics (community_id TEXT, snapshot_date TEXT)`);
    await run(db, `CREATE TABLE pib_site_performance (community_id TEXT, snapshot_date TEXT)`);
    await run(db, `CREATE TABLE pib_local_presence (community_id TEXT, snapshot_date TEXT)`);
    await run(db, `CREATE TABLE pib_search_performance (community_id TEXT, snapshot_date TEXT)`);
    await run(db, `CREATE TABLE pib_cir (community_id TEXT, snapshot_date TEXT)`);
    await run(db, `CREATE TABLE pib_reviews (community_id TEXT, snapshot_date TEXT)`);
    await run(db, `CREATE TABLE marketing_data (community_id TEXT, week_date TEXT)`);
    await run(db, `CREATE TABLE t7_metrics (community_id TEXT, week_date TEXT, type TEXT)`);
    await run(db, `CREATE TABLE t30_metrics (community_id TEXT, week_date TEXT, type TEXT)`);
    await run(
      db,
      `INSERT INTO communities (id, name, ga4_property_id, deleted_at)
       VALUES ('prop_1', 'Alpha', 'ga4_alpha', NULL)`
    );

    const session = await createSession(db, "watchtower_partial_env");
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/health/status",
      {
        headers: {
          cookie: `pop_session=${session}`,
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.integrity_summary.core_failure_sources, 0);
    assert.equal(json.daily_collection_status.summary.sources_total, 0);
    assert.equal(json.daily_collection_status.closure.state, "not_started");
    assert.equal(json.telemetry.retry_queue.queue_depth, 0);
    assert.ok(Array.isArray(json.source_freshness));
  } finally {
    close();
  }
});
