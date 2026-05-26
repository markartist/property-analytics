import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import app from "../../src/index";
import { generateToken } from "../../src/lib/crypto";
import { queryAll, queryFirst, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { CURRENT_DIRECTIVE_PROFILES } from "../../src/platform/directives/seed";
import { seedCurrentDirectives } from "../../src/platform/directives/repository";
import { seedPropertyAccessGrant } from "../../src/platform/access/property-access-control";
import { ensureCaptainRuntimeOrchestrationTables } from "../../src/platform/captain-runtime/repository";
import {
  archiveMemoryItem,
  createMemoryCorrection,
  createMemoryItem,
  createRegionalAwarenessSummary,
  ensureCaptainAgentForProperty,
  supersedeMemoryItem,
} from "../../src/platform/awareness/repository";
import { defaultCareMetadata } from "../../src/platform/awareness/validation";

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
            ('community_2', 'Forest View', 'GA4FV', 'forest', '54321', 'Arkansas', 'https://example.org', 220)`
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

async function seedFullEditorGrant(db: D1Database) {
  await seedPropertyAccessGrant(db, {
    user_id: "editor_user",
    scope_type: "property",
    property_id: "AR4PB",
    capabilities: [
      "view_property",
      "interact_captain",
      "request_expert_read",
      "view_expert_read",
      "view_runtime_history",
      "view_evidence_lineage",
      "view_memory_candidates",
      "operate_captain_office",
    ],
    runtime_modes: ["monitoring", "lightweight", "standard"],
    expert_lanes: ["quartermaster", "navigator"],
  });
  await seedPropertyAccessGrant(db, {
    user_id: "editor_user",
    scope_type: "region",
    region: "Arkansas",
    capabilities: ["access_region_scope"],
  });
}

test("Cross-system authorized flow preserves runtime, directives, evidence, quarters, expert reads, and audit lineage", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await seedFullEditorGrant(db);

    const correlationId = "cross-system-acceptance-001";
    const runtimeResponse = await app.request(
      "http://localhost/v1/captain-runtime/interactions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({
          property_id: "AR4PB",
          input_text: "The manager says A1 copy may confuse prospects; hold it as a claim and check the next governed move.",
          runtime_mode: "standard",
          report_family: "captain",
          correlation_id: correlationId,
        }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(runtimeResponse.status, 201);
    const runtime = await runtimeResponse.json() as any;
    assert.ok(runtime.directive_resolution.runtime_snapshot_hash);
    assert.ok(runtime.evidence_packet.evidence_hash);
    assert.equal(runtime.memory_candidates[0].promotion_state, "candidate");
    assert.equal(runtime.memory_candidates[0].verification_required, true);
    assert.ok(runtime.reasoning_request.blocked_outputs.includes("direct_database_write_by_gpt"));
    assert.ok(runtime.reasoning_request.blocked_outputs.includes("executive_publication_without_fleet_scribe"));

    const officeResponse = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/office",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(officeResponse.status, 200);
    const office = await officeResponse.json() as any;
    assert.equal(office.property.property_code, "AR4PB");
    assert.ok(office.history[0].directive_snapshot.runtime_snapshot_hash);
    assert.ok(office.history[0].evidence_packet_hash);
    assert.equal("payload_json" in office.history[0], false);

    const noteResponse = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/self-notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ note_text: "Do not recommend more public copy until the A1 claim is verified.", note_type: "verification_needed" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(noteResponse.status, 201);
    const note = await noteResponse.json() as any;
    assert.equal(note.visibility, "private_to_agent");

    const commitmentResponse = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/commitments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ commitment_type: "follow_up", description: "Captain asked the property team for current A1 copy evidence.", owed_by: "Captain", owed_to: "Property team" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(commitmentResponse.status, 201);
    const commitment = await commitmentResponse.json() as any;
    assert.equal(commitment.status, "open");

    const postureResponse = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/posture",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(postureResponse.status, 200);
    const posture = await postureResponse.json() as any;
    assert.ok(posture.active_self_notes.some((item: any) => item.note_id === note.note_id));
    assert.ok(posture.open_commitments.some((item: any) => item.commitment_id === commitment.commitment_id));
    assert.ok(posture.do_not_recommend_without_more_evidence.includes("Do not use self notes as publishable evidence."));

    const expertResponse = await app.request(
      "http://localhost/v1/expert-reads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({
          property_id: "AR4PB",
          lane_id: "quartermaster",
          evidence_packet_id: runtime.evidence_packet.evidence_packet_id,
          reason: "Check source integrity before any Scribe use.",
          source_runtime_id: runtime.session.session_id,
          source_interaction_id: runtime.interaction.interaction_id,
          correlation_id: correlationId,
        }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(expertResponse.status, 201);
    const expert = await expertResponse.json() as any;
    assert.equal(expert.expert_read.lane_id, "quartermaster");
    assert.notEqual(expert.expert_read.publishability, "publishable");
    assert.equal(expert.request.directive_snapshot_hash, expert.lane_resolution.directive_snapshot_hash);
    assert.equal(expert.request.evidence_packet_hash, runtime.evidence_packet.evidence_hash);
    assert.ok(expert.expert_read.do_not_do_rules.includes("Do not publish artifacts."));

    const runtimeAudit = await queryAll<any>(db, `SELECT * FROM captain_runtime_audit_events WHERE correlation_id = ?`, [correlationId]);
    assert.ok(runtimeAudit.some((row) => row.event_type === "captain_runtime.reasoning_response_accepted" && row.evidence_hash && row.directive_hash && row.response_hash));
    const expertAudit = await queryAll<any>(db, `SELECT * FROM expert_read_audit_events WHERE correlation_id = ?`, [correlationId]);
    assert.ok(expertAudit.some((row) => row.event_type === "expert_read.finalized" && row.evidence_hash && row.directive_hash && row.read_hash));
    const awarenessAudit = await queryAll<any>(db, `SELECT * FROM awareness_memory_events WHERE property_id = 'AR4PB'`);
    assert.ok(awarenessAudit.some((row) => row.event_type === "self_note.created"));
    assert.ok(awarenessAudit.some((row) => row.event_type === "commitment.created"));
  } finally {
    close();
  }
});

test("Cross-system unauthorized access fails closed before runtime, evidence, awareness, or expert data is created", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await ensureCaptainRuntimeOrchestrationTables(db);

    const runtimeDenied = await app.request(
      "http://localhost/v1/captain-runtime/interactions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ property_id: "AR4PB", input_text: "unauthorized", runtime_mode: "standard" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(runtimeDenied.status, 403);
    assert.equal((await queryAll(db, `SELECT * FROM captain_runtime_sessions`)).length, 0);
    assert.equal((await queryAll(db, `SELECT * FROM captain_evidence_packets`)).length, 0);

    const quartersDenied = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/posture",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(quartersDenied.status, 403);

    const expertDenied = await app.request(
      "http://localhost/v1/expert-reads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ property_id: "AR4PB", lane_id: "quartermaster", evidence_packet_id: "missing", reason: "unauthorized" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(expertDenied.status, 403);

    const denials = await queryAll<any>(db, `SELECT * FROM property_access_audit_events WHERE decision = 'deny'`);
    assert.ok(denials.length >= 3);
    assert.ok(denials.every((row) => row.reason));
  } finally {
    close();
  }
});

test("Cross-system memory rejection and Captain Log continuity are auditable and noncanonical", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await seedFullEditorGrant(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });

    const rejected = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/self-notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ note_text: "This team is unreliable." }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(rejected.status, 400);
    assert.equal((await queryAll(db, `SELECT * FROM awareness_self_notes`)).length, 0);
    assert.ok(await queryFirst(db, `SELECT * FROM awareness_memory_events WHERE event_type = 'self_note.rejected'`));

    const oldMemory = await createMemoryItem(db, {
      memory_class: "human_submitted_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "manager_input",
      statement: "Manager says the A1 page changed, pending verification.",
      verification_required: true,
      care_metadata: defaultCareMetadata({ requires_human_review: true }),
    });
    const replacement = await createMemoryItem(db, {
      memory_class: "working_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "source_review",
      statement: "A1 page change needs source review before use.",
    });
    await createMemoryCorrection(db, { memory_id: oldMemory.memory_id, actor: "editor_user", correction_text: "Clarify this is claim-level only." });
    await supersedeMemoryItem(db, oldMemory.memory_id, replacement.memory_id, "Source review replaced manager claim.", "editor_user");
    await archiveMemoryItem(db, replacement.memory_id, "Archived after acceptance continuity check.", "editor_user");

    const posture = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/posture",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(posture.status, 200);
    const body = await posture.json() as any;
    assert.equal(body.active_concerns.some((item: any) => item.memory_id === oldMemory.memory_id || item.memory_id === replacement.memory_id), false);
    assert.ok(body.archived_superseded_highlights.some((item: any) => item.memory_id === oldMemory.memory_id || item.memory_id === replacement.memory_id));

    const logEvents = await queryAll<any>(
      db,
      `SELECT event_type, before_state_json, after_state_json FROM awareness_memory_events
       WHERE event_type IN ('memory_item.corrected', 'memory_item.superseded', 'memory_item.archived')
       ORDER BY timestamp ASC`
    );
    assert.deepEqual(logEvents.map((row) => row.event_type), ["memory_item.corrected", "memory_item.superseded", "memory_item.archived"]);
    assert.ok(logEvents.every((row) => row.before_state_json || row.after_state_json));
  } finally {
    close();
  }
});

test("Regional Awareness remains summary-level and UI labels Office, Quarters, Log, and Expert Read boundaries", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await seedFullEditorGrant(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    await createMemoryItem(db, {
      memory_class: "relationship_context",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "private_note",
      statement: "Private relationship context must not leak regionally.",
      blocked_uses: ["regional_summary", "fleet_summary", "report_publication", "public_copy"],
      care_metadata: defaultCareMetadata({ sensitive_context: true }),
    });
    await createRegionalAwarenessSummary(db, {
      region_id: "Arkansas",
      summary_period: "2026-05",
      steward_agent_id: agent.agent_id,
      source_property_count: 2,
      pattern_summary: "Two properties need claim verification before public copy recommendations.",
      sibling_property_cards: [{
        property_id: "GA4FV",
        posture_label: "similar verification need",
        surface_summary: "Summary-level only.",
        comparable_conditions: "Human claims need evidence.",
        useful_tactic: "Use Quartermaster source review.",
        caution: "Do not expose private notes.",
        confidence: 0.7,
        visibility_scope: "region_visible",
      }],
      market_context: "Summary-level regional awareness.",
      shared_risks: ["Claim-level memory overstated as fact."],
      successful_tactics: ["Quartermaster source review."],
      cautionary_notes: ["No raw private memory."],
      evidence_refs: ["summary_evidence_1", "summary_evidence_2"],
      visibility_scope: "region_visible",
      freshness_state: "current",
      expires_at: null,
    });

    const regional = await app.request(
      "http://localhost/v1/awareness/regions/Arkansas/summary",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(regional.status, 200);
    const body = await regional.json() as any;
    assert.equal(body.pattern_summary.includes("Private relationship context"), false);
    assert.equal(JSON.stringify(body).includes("Private relationship context must not leak"), false);
    assert.equal(body.freshness_state, "current");
    assert.equal(body.source_property_count, 2);

    const componentPath = resolve(process.cwd(), "../web/src/app/captains/captain-office-client.tsx");
    const quartersRoutePath = resolve(process.cwd(), "../web/src/app/captains/[propertyId]/quarters/page.tsx");
    assert.equal(existsSync(quartersRoutePath), true);
    const component = readFileSync(componentPath, "utf8");
    assert.match(component, /Captain’s Office/);
    assert.match(component, /Captain’s Quarters/);
    assert.match(component, /Captain’s Log/);
    assert.match(component, /Self Notes are not canonical truth/);
    assert.match(component, /Expert Reads are governed specialist contributions/);
    assert.match(component, /They are not final reports/);
    assert.match(component, /Fleet Scribe Office remains the publication authority/);
  } finally {
    close();
  }
});
