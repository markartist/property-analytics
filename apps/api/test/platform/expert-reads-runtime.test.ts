import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import app from "../../src/index";
import { generateToken } from "../../src/lib/crypto";
import { queryAll, queryFirst, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { CURRENT_DIRECTIVE_PROFILES } from "../../src/platform/directives/seed";
import { seedCurrentDirectives } from "../../src/platform/directives/repository";
import { runCaptainRuntimeInteraction } from "../../src/platform/captain-runtime/orchestrator";
import { runExpertRead, decideExpertReadRoutingMode } from "../../src/platform/expert-reads/orchestrator";
import { resolveExpertLane } from "../../src/platform/expert-reads/resolver";
import { validateExpertRead } from "../../src/platform/expert-reads/response";
import { validateExpertEvidenceCompatibility } from "../../src/platform/expert-reads/evidence";
import { seedPropertyAccessGrant } from "../../src/platform/access/property-access-control";

async function seedBase(db: D1Database) {
  await seedCurrentDirectives(db, CURRENT_DIRECTIVE_PROFILES);
  await run(
    db,
    `CREATE TABLE communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      encasa_property_code TEXT,
      external_key TEXT,
      ga4_property_id TEXT,
      region TEXT,
      full_url TEXT,
      unit_count INTEGER
    )`
  );
  await run(
    db,
    `INSERT INTO communities (id, name, encasa_property_code, external_key, ga4_property_id, region, full_url, unit_count)
     VALUES ('community_1', 'The Pointe Bentonville', 'AR4PB', 'pointe', '12345', 'Arkansas', 'https://example.com', 240),
            ('community_2', 'Forest View', 'GA4FV', 'forest', '54321', 'Atlanta, GA', 'https://example.org', 220)`
  );
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

async function seedEvidence(db: D1Database, inputText = "Please check source integrity for the current property evidence.") {
  return runCaptainRuntimeInteraction(db, {
    property_id: "AR4PB",
    user_id: "user_1",
    input_text: inputText,
    runtime_mode: "standard",
    report_family: "captain",
  });
}

async function seedEvidenceForProperty(db: D1Database, propertyId: string, inputText = "Please check source integrity for this property evidence.") {
  return runCaptainRuntimeInteraction(db, {
    property_id: propertyId,
    user_id: "user_1",
    input_text: inputText,
    runtime_mode: "standard",
    report_family: "captain",
  });
}

test("Expert Lane Resolver calls Directive Resolver and preserves snapshot lineage", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    const lane = await resolveExpertLane(db, {
      lane_id: "quartermaster",
      property_id: "AR4PB",
      runtime_mode: "standard",
      report_family: "captain",
      as_of_date: "2026-05-09",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      actor: "tester",
    });
    assert.equal(lane.directive.active_directive_profile.role_id, "quartermaster");
    assert.ok(lane.directive_snapshot_id);
    assert.ok(lane.directive_snapshot_hash);
    assert.ok(lane.blocked_outputs.includes("final_artifact_publication"));
  } finally {
    close();
  }
});

test("Expert Read finalizes as specialist contribution without publishing or memory promotion", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    const result = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "quartermaster",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      runtime_mode: "standard",
      report_family: "captain",
      reason: "Check source readiness before Scribe use.",
      source_runtime_id: captain.session.session_id,
      source_interaction_id: captain.interaction.interaction_id,
    });
    assert.equal(result.expert_read.lane_id, "quartermaster");
    assert.notEqual(result.expert_read.publishability, "publishable");
    assert.ok(result.expert_read.do_not_do_rules.includes("Do not promote memory."));
    assert.ok(result.request.directive_snapshot_hash);
    const memoryRows = await queryAll(db, `SELECT * FROM captain_memory_candidates`);
    assert.equal(memoryRows.length, 1, "Expert Reads must not create or promote memory candidates.");
    const gatewayRequests = await queryAll(db, `SELECT * FROM model_gateway_requests WHERE source_system = 'expert_reads'`);
    const gatewayAudit = await queryAll(db, `SELECT * FROM model_gateway_audit_events WHERE source_system = 'expert_reads'`);
    assert.equal(gatewayRequests.length, 1);
    assert.ok(gatewayAudit.some((row: any) => row.event_type === "model_gateway.response_accepted"));
  } finally {
    close();
  }
});

test("Navigator Expert Read blocks unsupported public/local copy when evidence is missing", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db, "The manager says the nearby employer angle is strong; write public copy.");
    const result = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "navigator",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      runtime_mode: "standard",
      report_family: "captain",
      reason: "Check website copy recommendation.",
    });
    assert.equal(result.expert_read.read_status, "blocked");
    assert.equal(result.expert_read.publishability, "blocked");
    assert.ok(result.governance.checks.some((check) => check.status === "block"));
  } finally {
    close();
  }
});

test("Signals and Revenue lanes reject recommendations without required evidence", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db, "Can we make a marketing decision?");
    const signals = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "signals_officer",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      reason: "Check channel spend.",
    });
    const revenue = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "revenue_advisor",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      reason: "Check pricing posture.",
    });
    assert.equal(signals.expert_read.publishability, "blocked");
    assert.equal(revenue.expert_read.publishability, "blocked");
  } finally {
    close();
  }
});

test("Expert Reads reject property-scope evidence mismatches", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    await assert.rejects(
      () => runExpertRead(db, {
        property_id: "GA4FV",
        requested_by: "user_1",
        lane_id: "quartermaster",
        evidence_packet_id: captain.evidence_packet.evidence_packet_id,
        reason: "Try mismatched evidence.",
      }),
      /does not match requested property/
    );
  } finally {
    close();
  }
});

test("Expert Reads reject tampered evidence hash lineage before generation", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    const lane = await resolveExpertLane(db, {
      lane_id: "quartermaster",
      property_id: "AR4PB",
      runtime_mode: "standard",
      report_family: "captain",
      as_of_date: "2026-05-09",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      actor: "tester",
    });
    const compatibility = await validateExpertEvidenceCompatibility({
      lane,
      propertyId: "AR4PB",
      evidencePacket: { ...captain.evidence_packet, evidence_hash: "tampered_hash" },
    });
    assert.equal(compatibility.valid, false);
    assert.ok(compatibility.errors.some((error) => error.includes("hash does not match")));
  } finally {
    close();
  }
});

test("Expert Reads reject stale or mismatched Captain Runtime lineage", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const pointe = await seedEvidenceForProperty(db, "AR4PB");
    const forest = await seedEvidenceForProperty(db, "GA4FV");
    await assert.rejects(
      () => runExpertRead(db, {
        property_id: "AR4PB",
        requested_by: "user_1",
        lane_id: "quartermaster",
        evidence_packet_id: pointe.evidence_packet.evidence_packet_id,
        reason: "Try mismatched source lineage.",
        source_runtime_id: forest.session.session_id,
        source_interaction_id: forest.interaction.interaction_id,
      }),
      /does not match Expert Read property/
    );
  } finally {
    close();
  }
});

test("Duplicate Expert Read requests are blocked by replay protection", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    const input = {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "quartermaster" as const,
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      reason: "Replay protection check.",
      source_runtime_id: captain.session.session_id,
      source_interaction_id: captain.interaction.interaction_id,
    };
    await runExpertRead(db, input);
    await assert.rejects(() => runExpertRead(db, input), /Duplicate Expert Read request blocked/);
    const auditRows = await queryAll<{ event_type: string }>(
      db,
      `SELECT event_type FROM expert_read_audit_events WHERE event_type = 'expert_read.duplicate_request_blocked'`
    );
    assert.equal(auditRows.length, 1);
  } finally {
    close();
  }
});

test("Finalized Expert Reads and audit events are immutable", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    const result = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "quartermaster",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      reason: "Check immutability.",
    });
    await assert.rejects(
      () => run(db, `UPDATE expert_reads SET confidence = 1 WHERE expert_read_id = ?`, [result.expert_read.expert_read_id]),
      /immutable/
    );
    const audit = await queryFirst<{ event_id: string }>(db, `SELECT event_id FROM expert_read_audit_events LIMIT 1`);
    assert.ok(audit);
    await assert.rejects(
      () => run(db, `DELETE FROM expert_read_audit_events WHERE event_id = ?`, [audit!.event_id]),
      /cannot be deleted/
    );
  } finally {
    close();
  }
});

test("Database constraints prevent Expert Reads from self-authorizing publishable states", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const captain = await seedEvidence(db);
    const result = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "user_1",
      lane_id: "quartermaster",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      reason: "Publishability constraint check.",
    });
    await assert.rejects(
      () => run(
        db,
        `INSERT INTO expert_reads (
          expert_read_id, request_id, lane_id, property_id, read_status, specialist_summary,
          do_not_do_rules_json, required_evidence_json, evidence_used_json, confidence, freshness_state,
          publishability, escalation_required, conflicts_json, generated_at, read_hash, payload_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "expert_read_publishable_bad",
          result.request.request_id,
          "quartermaster",
          "AR4PB",
          "final",
          "bad publishability",
          "[]",
          "[]",
          "[]",
          0.8,
          "current",
          "publishable",
          0,
          "[]",
          new Date().toISOString(),
          "hash",
          "payload_hash",
        ]
      ),
      /CHECK constraint failed/
    );
  } finally {
    close();
  }
});

test("Expert Reads migrations contain lineage, replay, and immutability protections", () => {
  const migration = readFileSync(resolve(process.cwd(), "migrations/0049_create_expert_reads.sql"), "utf8");
  assert.match(migration, /request_hash TEXT NOT NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_read_requests_hash/);
  assert.match(migration, /REFERENCES captain_runtime_sessions\(session_id\) ON DELETE RESTRICT/);
  assert.match(migration, /REFERENCES captain_interactions\(interaction_id\) ON DELETE RESTRICT/);
  assert.match(migration, /REFERENCES captain_evidence_packets\(evidence_packet_id\) ON DELETE RESTRICT/);
  assert.match(migration, /evidence_hash TEXT/);
  assert.match(migration, /directive_hash TEXT/);
  assert.match(migration, /read_hash TEXT/);
  assert.doesNotMatch(migration, /publishability IN \('publishable'/);
  assert.match(migration, /trg_expert_reads_final_immutable/);
  assert.match(migration, /trg_expert_read_audit_no_delete/);
});

test("Malformed Expert Read output fails contract validation", () => {
  const validation = validateExpertRead({
    expert_read_id: "expert_read_bad",
    request_id: "request_bad",
    lane_id: "navigator",
    property_id: "AR4PB",
    read_status: "final",
    specialist_summary: "",
    findings: [],
    recommendations: [],
    do_not_do_rules: [],
    required_evidence: [],
    evidence_used: [],
    confidence: 1.2,
    freshness_state: "current",
    publishability: "publishable",
    escalation_required: false,
    conflicts: [],
    generated_at: new Date().toISOString(),
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 5);
});

test("Captain Runtime integration helper returns explicit Expert Read routing modes", () => {
  assert.equal(decideExpertReadRoutingMode({ target_lane: "navigator" }), "optional_expert_read");
  assert.equal(decideExpertReadRoutingMode({ requestedExplicitly: true }), "required_expert_read");
  assert.equal(decideExpertReadRoutingMode({ governanceBlocked: true }), "blocked_pending_expert_read");
  assert.equal(decideExpertReadRoutingMode({ target_lane: "captain_office", confidence: 0.9 }), "no_expert_needed");
});

test("Expert Read routes enforce authorization and hide raw payloads", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    const captain = await seedEvidence(db);
    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["request_expert_read"],
      runtime_modes: ["monitoring", "lightweight", "standard", "executive"],
      expert_lanes: ["quartermaster"],
    });
    const noAuth = await app.request(
      "http://localhost/v1/expert-reads",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      createPlatformRouteEnv(db)
    );
    assert.equal(noAuth.status, 401);
    const viewer = await app.request(
      "http://localhost/v1/expert-reads",
      { method: "POST", headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.viewer}` }, body: JSON.stringify({}) },
      createPlatformRouteEnv(db)
    );
    assert.equal(viewer.status, 403);
    const editorExecutive = await app.request(
      "http://localhost/v1/expert-reads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({
          property_id: "AR4PB",
          lane_id: "quartermaster",
          evidence_packet_id: captain.evidence_packet.evidence_packet_id,
          runtime_mode: "executive",
          reason: "Unauthorized mode test.",
        }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(editorExecutive.status, 403);
    const created = await app.request(
      "http://localhost/v1/expert-reads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({
          property_id: "AR4PB",
          lane_id: "quartermaster",
          evidence_packet_id: captain.evidence_packet.evidence_packet_id,
          reason: "Route test.",
        }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(created.status, 201);
    const payload = await created.json() as any;
    assert.ok(payload.expert_read.expert_read_id);
    assert.equal(payload.payload.evidence_packet.evidence[0].payload, undefined, "API result must not expose raw evidence payload blobs.");
  } finally {
    close();
  }
});
