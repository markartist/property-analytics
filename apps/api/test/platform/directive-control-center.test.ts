import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import app from "../../src/index";
import { generateToken } from "../../src/lib/crypto";
import { queryAll, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { CURRENT_DIRECTIVE_PROFILES } from "../../src/platform/directives/seed";
import { seedCurrentDirectives } from "../../src/platform/directives/repository";
import { validateDirectiveProfile } from "../../src/platform/directives/validation";
import { resolveRuntimeDirective } from "../../src/platform/directives/resolver";
import {
  activateDirective,
  approveDirective,
  createDirectiveDraft,
  rollbackDirective,
  submitDirectiveForReview,
} from "../../src/platform/directives/workflow";
import { DIRECTIVE_SIMULATION_FIXTURES, runDirectiveSimulation } from "../../src/platform/directives/simulation";
import { ensureDirectiveTables, getActiveDirective } from "../../src/platform/directives/repository";

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
  const now = new Date().toISOString();
  const tokens: Record<"admin" | "editor" | "viewer", string> = {} as Record<"admin" | "editor" | "viewer", string>;
  for (const role of ["admin", "editor", "viewer"] as const) {
    const token = await generateToken();
    tokens[role] = token.raw;
    await run(
      db,
      `INSERT INTO users (id, email, full_name, role, is_active, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [`${role}_user`, `${role}@example.com`, role, role, now, now, now]
    );
    await run(
      db,
      `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, revoked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      [`${role}_session`, `${role}_user`, token.hash, new Date(Date.now() + 86400000).toISOString(), now, now]
    );
  }
  return tokens;
}

async function request(db: D1Database, token: string | null, path: string, init: { method?: string; body?: unknown } = {}) {
  return app.request(
    `http://localhost${path}`,
    {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { cookie: `pop_session=${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    createPlatformRouteEnv(db)
  );
}

async function seededDb() {
  const fixture = await createTestD1Database();
  await seedCurrentDirectives(fixture.db, CURRENT_DIRECTIVE_PROFILES);
  return fixture;
}

test("seeded directive profiles validate as governed policy data", async () => {
  const { db, close } = await seededDb();
  try {
    const quartermaster = CURRENT_DIRECTIVE_PROFILES.find((profile) => profile.role_id === "quartermaster");
    assert.ok(quartermaster);
    const result = await validateDirectiveProfile(db, quartermaster, { actor: "test", persist: true });
    assert.equal(result.status, "pass");
    assert.equal(result.blocking_errors.length, 0);
  } finally {
    close();
  }
});

test("invalid directive profiles return blocking errors with affected fields", async () => {
  const { db, close } = await seededDb();
  try {
    const base = CURRENT_DIRECTIVE_PROFILES.find((profile) => profile.role_id === "navigator");
    assert.ok(base);
    const result = await validateDirectiveProfile(db, {
      ...base,
      hard_guardrails: [],
      primary_sources: [],
      output_contract: "",
    });
    assert.equal(result.status, "fail");
    assert.ok(result.blocking_errors.some((issue) => issue.field === "hard_guardrails"));
    assert.ok(result.blocking_errors.some((issue) => issue.field === "primary_sources"));
    assert.ok(result.blocking_errors.some((issue) => issue.field === "output_contract"));
  } finally {
    close();
  }
});

test("runtime resolver returns the active directive and writes snapshot/audit records", async () => {
  const { db, close } = await seededDb();
  try {
    const resolved = await resolveRuntimeDirective(db, {
      role_id: "fleet_scribe_office",
      runtime_mode: "executive",
      as_of_date: "2026-05-09",
      report_family: "watchlist",
      actor: "test",
    });
    assert.equal(resolved.active_directive_profile.role_id, "fleet_scribe_office");
    assert.equal(resolved.active_version, 1);
    assert.ok(resolved.runtime_snapshot_id);
    const snapshots = await queryAll(db, `SELECT * FROM directive_runtime_snapshots WHERE role_id = 'fleet_scribe_office'`);
    assert.equal(snapshots.length, 1);
    const audit = await queryAll(db, `SELECT * FROM directive_audit_events WHERE event_type = 'directive.used_at_runtime'`);
    assert.ok(audit.length >= 1);
  } finally {
    close();
  }
});

test("draft versions are simulation-only and do not replace active runtime resolution", async () => {
  const { db, close } = await seededDb();
  try {
    const draft = await createDirectiveDraft(
      db,
      "navigator",
      { current_directive_setting: "Simulation-only drafted setting." },
      "test",
      "Test draft isolation"
    );
    assert.equal(draft.directive.approval_status, "draft");
    const standard = await resolveRuntimeDirective(db, {
      role_id: "navigator",
      runtime_mode: "standard",
      as_of_date: "2026-05-09",
      actor: "test",
      include_snapshot: false,
    });
    assert.equal(standard.active_version, 1);
    const simulation = await resolveRuntimeDirective(db, {
      role_id: "navigator",
      runtime_mode: "simulation",
      as_of_date: "2026-05-09",
      actor: "test",
      include_snapshot: false,
    });
    assert.equal(simulation.active_version, 2);
  } finally {
    close();
  }
});

test("workflow supports submit, approve, activate, and rollback with audit history", async () => {
  const { db, close } = await seededDb();
  try {
    const draft = await createDirectiveDraft(
      db,
      "signals_officer",
      { current_directive_setting: "Use GA4, GBP, GSC, and PSI trend evidence before recommending channel actions." },
      "test",
      "Tune Signals Officer channel evidence standard"
    );
    const submission = await submitDirectiveForReview(db, "signals_officer", "test", "Ready for review");
    await approveDirective(db, submission.requestId, "approver", "Approved for governed runtime");
    await activateDirective(db, "signals_officer", draft.version.version_id, "approver", "Activate approved directive");
    const active = await resolveRuntimeDirective(db, {
      role_id: "signals_officer",
      runtime_mode: "standard",
      as_of_date: "2026-05-09",
      actor: "test",
      include_snapshot: false,
    });
    assert.equal(active.active_version, 2);
    await rollbackDirective(db, "signals_officer", 1, "approver", "Rollback after test");
    const rolledBack = await resolveRuntimeDirective(db, {
      role_id: "signals_officer",
      runtime_mode: "standard",
      as_of_date: "2026-05-09",
      actor: "test",
      include_snapshot: false,
    });
    assert.equal(rolledBack.active_version, 1);
    const events = await queryAll(db, `SELECT * FROM directive_audit_events WHERE role_id = 'signals_officer'`);
    assert.ok(events.length >= 4);
  } finally {
    close();
  }
});

test("simulation fixtures block weak proof, stale conflicts, and missing publication approval", async () => {
  const { db, close } = await seededDb();
  try {
    for (const fixture of DIRECTIVE_SIMULATION_FIXTURES.filter((item) => item.runtime_mode === "simulation")) {
      const result = await runDirectiveSimulation(db, fixture);
      assert.equal(result.would_block_publication, true, fixture.scenario_key);
      assert.equal(result.would_require_escalation, true, fixture.scenario_key);
      assert.ok(result.required_sources.length >= 1 || fixture.role_id === "fleet_scribe_office");
    }
    const rows = await queryAll(db, `SELECT * FROM directive_simulation_results`);
    assert.equal(rows.length, DIRECTIVE_SIMULATION_FIXTURES.filter((item) => item.runtime_mode === "simulation").length);
    const mismatch = DIRECTIVE_SIMULATION_FIXTURES.find((item) => item.scenario_key === "runtime_mode_mismatch");
    assert.ok(mismatch);
    await assert.rejects(() => runDirectiveSimulation(db, mismatch), /runtime_mode=simulation/);
  } finally {
    close();
  }
});

test("migration contains hardening columns, uniqueness indexes, and immutable triggers", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "directive-migration-"));
  const sqlite = new DatabaseSync(path.join(tempDir, "migration.sqlite"));
  try {
    const appMigration = fs.readFileSync("/Users/mark/Property_Analytics/apps/api/migrations/0047_create_directive_control_center.sql", "utf8");
    const infraMigration = fs.readFileSync("/Users/mark/Property_Analytics/infra/migrations/0034_create_directive_control_center.sql", "utf8");
    assert.ok(infraMigration.includes("App Migration 0047"));
    sqlite.exec(appMigration);
    const versionColumns = sqlite.prepare(`PRAGMA table_info(directive_versions)`).all() as Array<{ name: string }>;
    assert.ok(versionColumns.some((column) => column.name === "directive_hash"));
    const snapshotColumns = sqlite.prepare(`PRAGMA table_info(directive_runtime_snapshots)`).all() as Array<{ name: string }>;
    assert.ok(snapshotColumns.some((column) => column.name === "snapshot_hash"));
    const indexes = sqlite.prepare(`PRAGMA index_list(directive_versions)`).all() as Array<{ name: string }>;
    assert.ok(indexes.some((index) => index.name === "idx_directive_versions_one_active"));
    assert.ok(indexes.some((index) => index.name === "idx_directive_versions_one_draft"));
    const triggers = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger'`).all() as Array<{ name: string }>;
    assert.ok(triggers.some((trigger) => trigger.name === "trg_directive_runtime_snapshots_immutable"));
    assert.ok(triggers.some((trigger) => trigger.name === "trg_directive_audit_events_no_delete"));
  } finally {
    sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validation blocks edge-case governance drift", async () => {
  const { db, close } = await seededDb();
  try {
    const base = CURRENT_DIRECTIVE_PROFILES.find((profile) => profile.role_id === "fleet_scribe_office");
    assert.ok(base);
    const result = await validateDirectiveProfile(db, {
      ...base,
      confidence_thresholds: { minimumConfidence: 0.9, publishableConfidence: 0.5, escalationConfidenceBelow: 1.2 },
      freshness_tolerance: { dailySourceMaxAgeDays: -1, weeklySourceMaxAgeDays: 10, monthlySourceMaxAgeDays: 35, staleSourceAction: "warn" },
      publication_permissions: { ...base.publication_permissions, requiresFleetScribe: false },
      external_communication_permissions: { allowed: false, channels: ["email"], requiresApproval: false, notes: "" },
      report_family_applicability: ["unknown_family"],
      effective_date: "2999-01-01",
    } as any);
    assert.equal(result.status, "fail");
    assert.ok(result.blocking_errors.some((issue) => issue.field === "publication_permissions.requiresFleetScribe"));
    assert.ok(result.blocking_errors.some((issue) => issue.field === "confidence_thresholds.publishableConfidence"));
    assert.ok(result.blocking_errors.some((issue) => issue.field === "freshness_tolerance.dailySourceMaxAgeDays"));
    assert.ok(result.blocking_errors.some((issue) => issue.field === "report_family_applicability"));
  } finally {
    close();
  }
});

test("resolver enforces report-family applicability and snapshot immutability", async () => {
  const { db, close } = await seededDb();
  try {
    await assert.rejects(
      () =>
        resolveRuntimeDirective(db, {
          role_id: "engineer",
          runtime_mode: "standard",
          as_of_date: "2026-05-09",
          report_family: "executive_email",
          actor: "test",
        }),
      /not applicable/
    );
    const resolved = await resolveRuntimeDirective(db, {
      role_id: "engineer",
      runtime_mode: "standard",
      as_of_date: "2026-05-09",
      report_family: "word_report",
      actor: "test",
    });
    assert.ok(resolved.runtime_snapshot_hash);
    await assert.rejects(
      () => run(db, `UPDATE directive_runtime_snapshots SET created_by = 'tamper' WHERE snapshot_id = ?`, [resolved.runtime_snapshot_id]),
      /immutable/
    );
    await assert.rejects(
      () => run(db, `DELETE FROM directive_runtime_snapshots WHERE snapshot_id = ?`, [resolved.runtime_snapshot_id]),
      /cannot be deleted/
    );
  } finally {
    close();
  }
});

test("workflow prevents duplicate open drafts and unsafe rollback targets", async () => {
  const { db, close } = await seededDb();
  try {
    await createDirectiveDraft(db, "navigator", { current_directive_setting: "First draft." }, "test", "Create first draft");
    await assert.rejects(
      () => createDirectiveDraft(db, "navigator", { current_directive_setting: "Second draft." }, "test", "Create second draft"),
      /open draft/
    );
    await assert.rejects(() => rollbackDirective(db, "navigator", 2, "test", "Unsafe rollback"), /previously approved or retired/);
  } finally {
    close();
  }
});

test("directive content is immutable after leaving draft state", async () => {
  const { db, close } = await seededDb();
  try {
    const active = await getActiveDirective(db, "quartermaster");
    assert.ok(active);
    await assert.rejects(
      () => run(db, `UPDATE directive_versions SET purpose = 'tampered' WHERE version_id = ?`, [active.version.version_id]),
      /immutable after draft/
    );
  } finally {
    close();
  }
});

test("route authorization blocks unauthenticated and non-admin directive mutation", async () => {
  const { db, close } = await seededDb();
  try {
    const tokens = await seedAuth(db);
    const unauthenticated = await request(db, null, "/v1/directives/profiles");
    assert.equal(unauthenticated.status, 401);
    const viewer = await request(db, tokens.viewer, "/v1/directives/profiles");
    assert.equal(viewer.status, 403);
    const editorDraft = await request(db, tokens.editor, "/v1/directives/profiles/navigator/drafts", {
      method: "POST",
      body: { patch: { current_directive_setting: "bad" }, change_reason: "editor should not edit" },
    });
    assert.equal(editorDraft.status, 403);
    const admin = await request(db, tokens.admin, "/v1/directives/profiles");
    assert.equal(admin.status, 200);
  } finally {
    close();
  }
});

test("concurrent activation cannot create duplicate active versions", async () => {
  const { db, close } = await seededDb();
  try {
    const draft = await createDirectiveDraft(db, "signals_officer", { current_directive_setting: "Approved change." }, "test", "Create activation race candidate");
    const submission = await submitDirectiveForReview(db, "signals_officer", "test", "Submit race candidate");
    await approveDirective(db, submission.requestId, "approver", "Approve race candidate");
    await Promise.allSettled([
      activateDirective(db, "signals_officer", draft.version.version_id, "approver", "Activate once"),
      activateDirective(db, "signals_officer", draft.version.version_id, "approver", "Activate twice"),
    ]);
    const activeVersions = await queryAll<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count FROM directive_versions WHERE role_id = 'signals_officer' AND approval_status = 'active'`
    );
    assert.equal(Number(activeVersions[0].count), 1);
  } finally {
    close();
  }
});
