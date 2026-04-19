import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";

async function seedAuthenticatedSession(db: D1Database, rawSession = "dGVzdC1zZXNzaW9uLXRva2Vu") {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      deleted_at TEXT,
      last_login_at TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );

  const tokenHash = await hashToken(rawSession);

  await run(
    db,
    `INSERT INTO users (id, email, full_name, role, is_active, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), ?)`,
    ["user_admin_1", "steward@example.com", "Steward", "admin", 1, "test", "test"]
  );

  await run(
    db,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, datetime('now', '+7 days'), datetime('now'), ?, datetime('now'), ?)`,
    ["session_1", "user_admin_1", tokenHash, "test", "test"]
  );

  return rawSession;
}

test("pond landscape prefers runtime control-plane state from D1 when present", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const rawSession = await seedAuthenticatedSession(db);
    await run(
      db,
      `CREATE TABLE IF NOT EXISTS runtime_release_state (
        state_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        source_mode TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        published_by TEXT,
        notes TEXT
      )`
    );

    const runtimePayload = {
      version: "runtime-test.v1",
      updated_at: "2026-04-19",
      purpose: "runtime-issued",
      release_descriptor: {
        source_branch: "codex/runtime-issued",
        baseline_commit: {
          sha: "abc123",
          short_sha: "abc123",
          committed_at: "2026-04-19T03:00:00-05:00",
          subject: "runtime state commit",
        },
        source_mode: "clean_release_candidate",
        release_lane: "platform_app",
        canonical_release_path: "codex/release-reconcile",
        provenance_status: "aligned",
        provenance_note: "runtime state is active",
      },
      deployments: [
        {
          service_id: "data_pond_api",
          target: "Cloudflare Workers",
          deployed_at: "2026-04-19",
          runtime_identifier: "runtime-worker",
          public_url: "https://runtime-api.example.com",
        },
      ],
      next_moves: ["none"],
    };

    await run(
      db,
      `INSERT INTO runtime_release_state (state_key, payload_json, source_mode, updated_at, published_by, notes)
       VALUES (?, ?, ?, datetime('now'), ?, ?)`,
      ["release_provenance", JSON.stringify(runtimePayload), "operator_bridge", "test", "test note"]
    );

    const runtimeDeploymentProvenance = {
      version: "runtime-deployment.v1",
      updated_at: "2026-04-19",
      purpose: "runtime deployment provenance",
      environments: [
        {
          id: "preview",
          label: "Preview",
          web_host_suffixes: [".pages.dev"],
          api_hosts: ["pop-brief-api.mlaufhutte.workers.dev"],
          release_posture: "preview",
        },
      ],
      rules: {
        canonical_release_path: "codex/release-reconcile",
        preferred_api_base: "https://api.venterradev.com",
        production_debug_flags_must_be_false: ["NEXT_PUBLIC_SITE_CONTENT_DEBUG"],
        preview_hosts_are_allowed: true,
        custom_pages_aliases_are_release_review_only: true,
      },
      service_bindings: [
        {
          service_id: "data_pond_api",
          expected_environment: "preview",
          managed_target: "Cloudflare Workers",
        },
      ],
    };

    await run(
      db,
      `INSERT INTO runtime_release_state (state_key, payload_json, source_mode, updated_at, published_by, notes)
       VALUES (?, ?, ?, datetime('now'), ?, ?)`,
      ["deployment_provenance", JSON.stringify(runtimeDeploymentProvenance), "operator_bridge", "test", "deployment note"]
    );

    const runtimeReconcileSnapshot = {
      version: "runtime-reconcile.v1",
      updated_at: "2026-04-19",
      purpose: "runtime reconcile snapshot",
      working_tree: {
        changed_file_count: 2,
        primary_release_slice_count: 2,
        non_primary_count: 0,
      },
      recommended_release_candidate: {
        label: "platform_app",
        canonical_branch: "codex/release-reconcile",
        included_lanes: ["platform_app"],
        exclude_lanes: ["pilot_reporting"],
        readiness_note: "runtime-issued",
      },
      lane_counts: {
        platform_app: 2,
      },
      lane_examples: {
        platform_app: ["apps/api/src/routes/pond.ts"],
      },
    };

    await run(
      db,
      `INSERT INTO runtime_release_state (state_key, payload_json, source_mode, updated_at, published_by, notes)
       VALUES (?, ?, ?, datetime('now'), ?, ?)`,
      ["release_reconcile_snapshot", JSON.stringify(runtimeReconcileSnapshot), "operator_bridge", "test", "reconcile note"]
    );

    const env = createPlatformRouteEnv(db);
    const response = await app.request(
      "http://localhost/v1/pond/landscape",
      {
        headers: {
          cookie: `pop_session=${rawSession}`,
          origin: "https://codex-release-reconcile.property-analytics.pages.dev",
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.release_provenance.release_descriptor.source_branch, "codex/runtime-issued");
    assert.equal(json.release_provenance.deployments[0].runtime_identifier, "runtime-worker");
    assert.equal(json.deployment_provenance.version, "runtime-deployment.v1");
    assert.equal(json.deployment_provenance.state_source, "runtime_d1");
    assert.equal(json.release_reconcile_snapshot.version, "runtime-reconcile.v1");
    assert.equal(json.release_reconcile_snapshot.state_source, "runtime_d1");
    assert.equal(
      json.release_provenance.runtime_observation.observed_web_host,
      "codex-release-reconcile.property-analytics.pages.dev"
    );
  } finally {
    close();
  }
});
