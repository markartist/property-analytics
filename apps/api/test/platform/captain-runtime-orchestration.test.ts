import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { generateToken } from "../../src/lib/crypto";
import { queryAll, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { CURRENT_DIRECTIVE_PROFILES } from "../../src/platform/directives/seed";
import { seedCurrentDirectives } from "../../src/platform/directives/repository";
import { runCaptainRuntimeInteraction } from "../../src/platform/captain-runtime/orchestrator";
import { ensureCaptainRuntimeOrchestrationTables } from "../../src/platform/captain-runtime/repository";
import { buildCaptainEvidencePacket, validateCaptainEvidencePacket } from "../../src/platform/captain-runtime/evidence";
import { buildCaptainRuntimePayload, validateCaptainRuntimePayload } from "../../src/platform/captain-runtime/payload";
import { validateReasoningResponse, validateReasoningSideEffects } from "../../src/platform/captain-runtime/response";
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
     VALUES ('community_1', 'The Pointe Bentonville', 'AR4PB', 'pointe', '12345', 'Arkansas', 'https://example.com', 240)`
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

test("Captain runtime resolves directives, evidence, payload, response, memory, routing, and audit lineage", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const result = await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "user_1",
      input_text: "The website copy for A1 needs a stronger Bentonville value angle. Please recommend the next move.",
      runtime_mode: "standard",
      report_family: "captain",
    });
    assert.equal(result.interaction.intent, "website_concern");
    assert.equal(result.directive_resolution.active_directive_profile.role_id, "navigator");
    assert.ok(result.directive_resolution.runtime_snapshot_id);
    assert.ok(result.evidence_packet.evidence_hash);
    assert.ok(result.reasoning_request.blocked_outputs.includes("direct_database_write_by_gpt"));
    assert.equal(result.reasoning_response.publishability, "needs_verification");
    assert.equal(result.memory_candidates.length, 1);
    assert.equal(result.memory_candidates[0].promotion_state, "candidate");
    assert.equal(result.routing_decisions[0].target_lane, "navigator");

    const audit = await queryAll(db, `SELECT * FROM captain_runtime_audit_events ORDER BY timestamp ASC`);
    assert.ok(audit.some((row: any) => row.event_type === "captain_runtime.interaction_received"));
    assert.ok(audit.some((row: any) => row.event_type === "captain_runtime.gpt_payload_generated"));
    assert.ok(audit.some((row: any) => row.event_type === "captain_runtime.reasoning_response_accepted"));
    const gatewayRequests = await queryAll(db, `SELECT * FROM model_gateway_requests ORDER BY requested_at ASC`);
    const gatewayAudit = await queryAll(db, `SELECT * FROM model_gateway_audit_events ORDER BY timestamp ASC`);
    assert.equal(gatewayRequests.length, 1);
    assert.ok(gatewayAudit.some((row: any) => row.event_type === "model_gateway.response_accepted"));
  } finally {
    close();
  }
});

test("Captain runtime preserves human input as candidate memory rather than canonical truth", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const result = await runCaptainRuntimeInteraction(db, {
      property_id: "The Pointe Bentonville",
      user_id: "user_1",
      input_text: "FYI the team says a prospect mentioned confusing tour instructions.",
      runtime_mode: "standard",
    });
    assert.equal(result.interaction.intent, "informational_claim");
    assert.equal(result.governance.authority_level, "claim");
    assert.equal(result.memory_candidates[0].verification_required, true);
    const candidates = await queryAll(db, `SELECT * FROM captain_memory_candidates`);
    assert.equal(candidates.length, 1);
    assert.equal((candidates[0] as any).promotion_state, "candidate");
  } finally {
    close();
  }
});

test("Captain runtime evidence packets and audit events are immutable", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const result = await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "user_1",
      input_text: "Can you check leasing concern around guest cards?",
      runtime_mode: "standard",
    });
    await assert.rejects(
      () => run(db, `UPDATE captain_evidence_packets SET evidence_hash = 'tampered' WHERE evidence_packet_id = ?`, [result.evidence_packet.evidence_packet_id]),
      /immutable/
    );
    const auditRow = await queryAll<{ event_id: string }>(db, `SELECT event_id FROM captain_runtime_audit_events LIMIT 1`);
    await assert.rejects(
      () => run(db, `DELETE FROM captain_runtime_audit_events WHERE event_id = ?`, [auditRow[0].event_id]),
      /cannot be deleted/
    );
  } finally {
    close();
  }
});

test("Captain runtime sessions, interactions, reasoning requests, and responses are immutable", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const result = await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "user_1",
      input_text: "Please check a leasing concern around applications.",
      runtime_mode: "standard",
    });
    await assert.rejects(
      () => run(db, `UPDATE captain_runtime_sessions SET runtime_mode = 'executive' WHERE session_id = ?`, [result.session.session_id]),
      /immutable/
    );
    await assert.rejects(
      () => run(db, `UPDATE captain_interactions SET intent = 'approval_request' WHERE interaction_id = ?`, [result.interaction.interaction_id]),
      /immutable/
    );
    await assert.rejects(
      () => run(db, `UPDATE captain_reasoning_requests SET authority_level = 'verified' WHERE request_id = ?`, [result.reasoning_request.request_id]),
      /immutable/
    );
    await assert.rejects(
      () => run(db, `UPDATE captain_reasoning_responses SET publishability = 'publishable' WHERE response_id = ?`, [result.reasoning_response.response_id]),
      /immutable/
    );
  } finally {
    close();
  }
});

test("Captain runtime route blocks unauthenticated and viewer mutation", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    const noAuth = await app.request(
      "http://localhost/v1/captain-runtime/interactions",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ property_id: "AR4PB", input_text: "test" }) },
      createPlatformRouteEnv(db)
    );
    assert.equal(noAuth.status, 401);
    const viewer = await app.request(
      "http://localhost/v1/captain-runtime/interactions",
      { method: "POST", headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.viewer}` }, body: JSON.stringify({ property_id: "AR4PB", input_text: "test" }) },
      createPlatformRouteEnv(db)
    );
    assert.equal(viewer.status, 403);
  } finally {
    close();
  }
});

test("Captain runtime route blocks editor escalation into executive runtime mode", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["interact_captain"],
      runtime_modes: ["monitoring", "lightweight", "standard", "executive"],
    });
    const response = await app.request(
      "http://localhost/v1/captain-runtime/interactions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ property_id: "AR4PB", input_text: "test", runtime_mode: "executive" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(response.status, 403);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, "FORBIDDEN_RUNTIME_MODE");
  } finally {
    close();
  }
});

test("Captain’s Office runtime reads are role-gated and expose governed lineage without raw payloads", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["operate_captain_office"],
    });
    await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "admin_user",
      input_text: "Please recommend the next website copy move.",
      runtime_mode: "standard",
    });
    const response = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/office",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.property.property_code, "AR4PB");
    assert.equal(body.history.length, 1);
    assert.ok(body.history[0].directive_snapshot.runtime_snapshot_hash);
    assert.ok(body.history[0].evidence_packet_hash);
    assert.equal("payload_json" in body.history[0], false);

    const viewer = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/office",
      { headers: { cookie: `pop_session=${tokens.viewer}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(viewer.status, 403);
  } finally {
    close();
  }
});

test("Captain runtime duplicate idempotency keys are rejected by persistence", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const input = {
      property_id: "AR4PB",
      user_id: "user_1",
      input_text: "Please inspect the website concern.",
      runtime_mode: "standard" as const,
      idempotency_key: "same-request",
    };
    await runCaptainRuntimeInteraction(db, input);
    await assert.rejects(() => runCaptainRuntimeInteraction(db, input), /UNIQUE|constraint/i);
  } finally {
    close();
  }
});

test("Captain runtime rejects malformed structured reasoning responses before persistence", () => {
  const result = validateReasoningResponse({
    response_id: "r1",
    request_id: "q1",
    conversational_response: "",
    reasoning_summary: "",
    structured_outputs: {},
    confidence: 2,
    publishability: "needs_verification",
    escalation_required: false,
    generated_at: new Date().toISOString(),
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test("Captain runtime rejects hallucinated structured response fields and invalid side effects", () => {
  const responseResult = validateReasoningResponse({
    response_id: "r1",
    request_id: "q1",
    conversational_response: "Captured.",
    reasoning_summary: "Reasoned.",
    structured_outputs: {
      memory_candidates: [],
      routing_decisions: [],
      escalation_needs: [],
      confidence_assessment: { confidence: 0.5 },
      publishability_assessment: { publishability: "needs_verification" },
      required_followups: [],
      unresolved_conflicts: [],
      invented_canonical_fact: { rent: 1200 },
    },
    confidence: 0.5,
    publishability: "needs_verification",
    escalation_required: false,
    generated_at: new Date().toISOString(),
  });
  assert.equal(responseResult.valid, false);
  assert.ok(responseResult.errors.some((error) => error.includes("invented_canonical_fact")));

  const sideEffectResult = validateReasoningSideEffects({
    evidenceHash: "evidence-a",
    memoryCandidates: [{
      memory_candidate_id: "m1",
      source_interaction_id: "i1",
      candidate_type: "claim",
      confidence: 0.7,
      verification_required: false,
      promotion_state: "promoted",
      expires_at: "not-a-date",
      conflict_state: "none",
      source_evidence_hash: "evidence-b",
    }],
    routingDecisions: [{
      routing_id: "r1",
      interaction_id: "i1",
      target_lane: "fleet_scribe_office",
      reason: "",
      status: "pending",
    }],
  });
  assert.equal(sideEffectResult.valid, false);
  assert.ok(sideEffectResult.errors.length >= 4);
});

test("Captain runtime evidence packet hashes are replayable and validation blocks incomplete packets", async () => {
  const context: any = {
    property: { id: "community_1", name: "The Pointe Bentonville" },
    active_watch_items: [],
    active_actions: [],
    recent_memory: [],
  };
  const first = await buildCaptainEvidencePacket({
    propertyId: "AR4PB",
    directiveSnapshotId: "snapshot_1",
    context,
    userClaim: "The A1 copy needs review.",
  });
  const second = await buildCaptainEvidencePacket({
    propertyId: "AR4PB",
    directiveSnapshotId: "snapshot_1",
    context,
    userClaim: "The A1 copy needs review.",
  });
  assert.equal(first.evidence_hash, second.evidence_hash);
  const invalid = validateCaptainEvidencePacket({ ...first, directive_snapshot_id: null, evidence: first.evidence.filter((item) => item.evidence_class !== "human_submitted_claim") });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("human submitted")));
});

test("Captain runtime payload validation blocks conflicting output permissions", async () => {
  const directive: any = {
    active_directive_profile: { role_name: "Navigator", role_id: "navigator" },
    runtime_snapshot_id: "snapshot_1",
    runtime_snapshot_hash: "hash_1",
    escalation_rules: [],
  };
  const context: any = {
    property: { id: "community_1", name: "The Pointe Bentonville" },
    unresolved_issues: [],
    applicable_bench_lanes: [],
    doctrine: [],
    recent_memory: [],
  };
  const evidencePacket = await buildCaptainEvidencePacket({
    propertyId: "AR4PB",
    directiveSnapshotId: "snapshot_1",
    context: { ...context, active_watch_items: [], active_actions: [] },
    userClaim: "Check website copy.",
  });
  const payload = buildCaptainRuntimePayload({
    directive,
    context,
    evidencePacket,
    governance: {
      allowed_outputs: ["conversational_response", "canonical_fact_mutation"],
      blocked_outputs: ["canonical_fact_mutation"],
      authority_level: "claim",
      publishability: "needs_verification",
      escalation_required: false,
    },
  });
  const result = validateCaptainRuntimePayload(payload);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("both allowed and blocked")));
});

test("Captain runtime migration contains immutable packet/audit triggers", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const migration = fs.readFileSync(path.resolve(process.cwd(), "migrations/0048_create_captain_runtime_orchestration.sql"), "utf8");
  assert.match(migration, /captain_runtime_sessions/);
  assert.match(migration, /idx_captain_runtime_sessions_idempotency/);
  assert.match(migration, /trg_captain_runtime_sessions_immutable/);
  assert.match(migration, /trg_captain_interactions_immutable/);
  assert.match(migration, /trg_captain_evidence_packets_immutable/);
  assert.match(migration, /trg_captain_reasoning_requests_immutable/);
  assert.match(migration, /trg_captain_reasoning_responses_immutable/);
  assert.match(migration, /trg_captain_runtime_audit_events_immutable/);
});
