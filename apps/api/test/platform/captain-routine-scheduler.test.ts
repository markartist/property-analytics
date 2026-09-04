import assert from "node:assert/strict";
import test from "node:test";
import { queryAll, queryFirst, run } from "../../src/lib/db";
import { ensureCaptainRuntimeTables, runScheduledCaptains } from "../../src/platform/captain/runtime";
import { createTestD1Database } from "../helpers/sqlite-d1";

async function createCaptainFixture(db: D1Database) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      external_key TEXT,
      ga4_property_id TEXT,
      encasa_property_code TEXT,
      full_url TEXT,
      unit_count INTEGER,
      status TEXT,
      deleted_at TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS captain_support_agents (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      captain_memory_entry_id TEXT,
      agent_key TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      role TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      source_scope_json TEXT NOT NULL,
      cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (property_id, agent_key)
    )`
  );
  await ensureCaptainRuntimeTables(db);
  await run(
    db,
    `INSERT INTO communities (
      id, name, external_key, ga4_property_id, encasa_property_code, full_url, unit_count, status, deleted_at
    ) VALUES ('community-test', 'Test Property', 'GA-TEST', 'GA-TEST', 'TP4T', 'https://example.com', 100, 'active', NULL)`
  );
}

async function insertAgent(db: D1Database, agentKey: string, cadence: "daily" | "weekly", status = "active") {
  await run(
    db,
    `INSERT INTO captain_support_agents (
      id, property_id, captain_memory_entry_id, agent_key, agent_name, role, responsibility,
      source_scope_json, cadence, status, created_at, updated_at
    ) VALUES (?, 'TP4T', NULL, ?, ?, 'Source authority', 'Test responsibility', '{}', ?, ?, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    [`agent_tp4t_${agentKey}`, agentKey, agentKey, cadence, status]
  );
}

test("scheduled Captain runs seed and advance due routine rows", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await createCaptainFixture(db);
    await insertAgent(db, "test_truth_reconciler", "daily");
    await run(
      db,
      `INSERT INTO captain_agent_runs (
        id, property_id, community_id, agent_key, run_type, run_status, started_at, finished_at,
        source_window_start, source_window_end, findings_json, metrics_json, exceptions_json, created_by, created_at
      ) VALUES (
        'captain_run_seed', 'TP4T', 'community-test', 'test_truth_reconciler', 'scheduled', 'success',
        '2026-08-29T12:00:00.000Z', '2026-08-29T12:00:01.000Z', NULL, NULL, '{}', '{}', '[]', 'test', '2026-08-29T12:00:01.000Z'
      )`
    );

    const result = await runScheduledCaptains(db, new Date("2026-08-31T12:00:00.000Z"));
    assert.equal(result.mode, "due_queue");
    assert.equal(result.selectedAgentCount, 1);

    const schedule = await queryFirst<Record<string, unknown>>(
      db,
      `SELECT status, last_status, last_run_id, next_run_at FROM captain_routine_schedule WHERE property_id = 'TP4T' AND agent_key = 'test_truth_reconciler'`
    );
    assert.equal(schedule?.status, "active");
    assert.equal(schedule?.last_status, "success");
    assert.match(String(schedule?.last_run_id), /^captain_run_TP4T_test_truth_reconciler_/);
    assert.ok(String(schedule?.next_run_at) > "2026-08-31T12:00:00.000Z");
  } finally {
    close();
  }
});

test("scheduled Captain sync retires inactive routine rows", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await createCaptainFixture(db);
    await insertAgent(db, "test_truth_reconciler", "daily", "retired");
    await run(
      db,
      `INSERT INTO captain_routine_schedule (
        schedule_id, property_id, agent_key, cadence, status, priority, next_run_at, created_at, updated_at
      ) VALUES (
        'captain_schedule_tp4t_test_truth_reconciler', 'TP4T', 'test_truth_reconciler', 'daily', 'active', 50,
        '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z'
      )`
    );

    const result = await runScheduledCaptains(db, new Date("2026-08-31T12:00:00.000Z"));
    assert.equal(result.selectedAgentCount, 0);
    const rows = await queryAll<Record<string, unknown>>(db, `SELECT status FROM captain_routine_schedule`);
    assert.deepEqual(rows.map((row) => row.status), ["retired"]);
  } finally {
    close();
  }
});
