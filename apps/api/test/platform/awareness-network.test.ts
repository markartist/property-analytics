import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { generateToken } from "../../src/lib/crypto";
import { queryAll, queryFirst, run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { CURRENT_DIRECTIVE_PROFILES } from "../../src/platform/directives/seed";
import { seedCurrentDirectives } from "../../src/platform/directives/repository";
import { seedPropertyAccessGrant } from "../../src/platform/access/property-access-control";
import {
  archiveMemoryItem,
  archiveSelfNote,
  createAgentCharter,
  createCommitment,
  createMemoryCorrection,
  createDoctrineCandidate,
  expireMemoryItem,
  createMemoryItem,
  createRegionalAwarenessSummary,
  createSelfNote,
  ensureCaptainAgentForProperty,
  getCommitment,
  getSelfNote,
  supersedeMemoryItem,
  updateCommitmentStatus,
} from "../../src/platform/awareness/repository";
import { evaluateMemoryUseWithoutAccess } from "../../src/platform/awareness/governance";
import { runReflectionRoutine } from "../../src/platform/awareness/reflection";
import { defaultCareMetadata, validateLifecycleTransition, validateMemoryItem } from "../../src/platform/awareness/validation";
import type { MemoryItem } from "../../src/platform/awareness/types";

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

function baseMemory(agentId: string, overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    memory_id: "memory_test",
    memory_class: "working_memory",
    lifecycle_state: "candidate",
    property_id: "AR4PB",
    region_id: "Arkansas",
    agent_id: agentId,
    source_type: "test",
    source_ref: null,
    statement: "Verify current photo freshness before using image quality as a leasing proof point.",
    structured_claim: null,
    confidence: 0.5,
    freshness_state: "unknown",
    sensitivity: "internal",
    visibility_scope: "property_team_visible",
    allowed_uses: ["captain_reasoning", "historical_review"],
    blocked_uses: ["public_copy", "report_publication"],
    steward: agentId,
    verification_required: true,
    correction_path: "Submit correction through governed Awareness Network correction path.",
    fresh_until: null,
    expires_at: null,
    revalidation_due_at: null,
    archived_at: null,
    archived_reason: null,
    superseded_by: null,
    evidence_refs: [],
    directive_refs: [],
    care_metadata: defaultCareMetadata(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

test("Awareness Network creates bounded Captain identity and rejects unbounded charters", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    assert.equal(agent.agent_type, "captain");
    assert.equal(agent.assigned_property_id, "AR4PB");

    await assert.rejects(
      () => createAgentCharter(db, {
        agent_id: agent.agent_id,
        sphere_of_responsibility: "Everything.",
        sphere_of_knowledge: "Everything.",
        sphere_of_action: "Everything.",
        sphere_of_memory: "Everything.",
        visibility_scope: "fleet_visible",
        allowed_actions: ["*"],
        blocked_actions: [],
        allowed_memory_classes: ["working_memory"],
        blocked_memory_classes: [],
        authority_boundaries: [],
        care_obligations: [],
        escalation_obligations: [],
        steward_roles: ["Captain"],
        effective_date: "2026-05-10",
        version: 1,
        approval_status: "approved",
      }),
      /blocked_actions|unbounded|authority_boundaries|care_obligations/
    );
  } finally {
    close();
  }
});

test("Captain charters reject publication, Data Pond mutation, memory promotion, and bypass authority", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    for (const forbiddenAction of [
      "publish_official_artifact",
      "mutate_data_pond_truth",
      "promote_memory_to_canonical_fact",
      "approve_public_claim",
      "bypass_quartermaster",
      "bypass_fleet_scribe",
    ]) {
      await assert.rejects(
        () => createAgentCharter(db, {
          agent_id: agent.agent_id,
          sphere_of_responsibility: "Property-level stewardship only.",
          sphere_of_knowledge: "Property-scoped authorized evidence.",
          sphere_of_action: "Observe and suggest.",
          sphere_of_memory: "Self notes and commitments.",
          visibility_scope: "property_team_visible",
          allowed_actions: [forbiddenAction],
          blocked_actions: ["publish_official_artifact", "mutate_data_pond_truth", "promote_memory_to_canonical_fact", "bypass_quartermaster", "bypass_fleet_scribe"],
          allowed_memory_classes: ["working_memory"],
          blocked_memory_classes: ["doctrine"],
          authority_boundaries: ["Captain cannot publish or promote memory."],
          care_obligations: ["Do not overstate memory."],
          escalation_obligations: ["Escalate publish requests to Fleet Scribe."],
          steward_roles: ["Captain"],
          effective_date: "2026-05-10",
          version: 1,
          approval_status: "approved",
        }),
        /Captain charters cannot include forbidden authority/
      );
    }
  } finally {
    close();
  }
});

test("Memory taxonomy enforces care metadata, lifecycle boundaries, archive, and doctrine thresholds", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    const memory = await createMemoryItem(db, {
      memory_class: "human_submitted_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "manager_input",
      statement: "Manager says amenity photos were updated, pending verification.",
      allowed_uses: ["captain_reasoning", "historical_review"],
      blocked_uses: ["public_copy", "report_publication"],
      verification_required: true,
    });
    assert.equal(memory.lifecycle_state, "candidate");
    assert.match(validateLifecycleTransition("archived", "verified") ?? "", /Invalid memory lifecycle transition/);
    assert.ok(validateMemoryItem({ ...baseMemory(agent.agent_id), care_metadata: null as any }).includes("care_metadata is required."));

    await archiveMemoryItem(db, memory.memory_id, "Superseded by newer manager update.", "tester");
    const archived = await queryFirst<any>(db, `SELECT lifecycle_state, archived_reason FROM awareness_memory_items WHERE memory_id = ?`, [memory.memory_id]);
    assert.equal(archived.lifecycle_state, "archived");

    await assert.rejects(
      () => createDoctrineCandidate(db, {
        title: "One-off lesson",
        pattern_statement: "A single anecdote should not become doctrine.",
        source_scope: "property",
        supporting_memory_refs: [memory.memory_id],
        supporting_evidence_refs: [],
        confidence: 0.4,
        proposed_by_agent_id: agent.agent_id,
        steward_agent_id: agent.agent_id,
        status: "proposed",
        care_review_required: true,
      }),
      /more than one supporting/
    );

    assert.ok(validateMemoryItem(baseMemory(agent.agent_id, {
      lifecycle_state: "report_eligible",
    })).some((error) => error.includes("future governed workflow")));
    assert.ok(validateMemoryItem(baseMemory(agent.agent_id, {
      allowed_uses: ["report_publication"],
      blocked_uses: [],
    })).some((error) => error.includes("report publication")));
    assert.ok(validateMemoryItem(baseMemory(agent.agent_id, {
      care_metadata: defaultCareMetadata({ temporary_context: true }),
    })).some((error) => error.includes("temporary_context")));
    assert.ok(validateMemoryItem(baseMemory(agent.agent_id, {
      visibility_scope: "fleet_visible",
      care_metadata: defaultCareMetadata({ sensitive_context: true }),
    })).some((error) => error.includes("sensitive_context")));
  } finally {
    close();
  }
});

test("Memory lifecycle persistence preserves corrections, expiration, supersession, and no-delete audit trail", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    const first = await createMemoryItem(db, {
      memory_class: "working_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "test",
      statement: "Old website photo caution.",
    });
    const replacement = await createMemoryItem(db, {
      memory_class: "working_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "test",
      statement: "Updated website photo caution with newer source.",
    });
    const correction = await createMemoryCorrection(db, {
      memory_id: first.memory_id,
      actor: "tester",
      correction_text: "Clarify that the item was a caution, not verified fact.",
    });
    await assert.rejects(() => run(db, `UPDATE awareness_memory_corrections SET status = 'accepted' WHERE correction_id = ?`, [correction.correction_id]), /immutable/);

    await supersedeMemoryItem(db, first.memory_id, replacement.memory_id, "Newer source replaced older caution.", "tester");
    const superseded = await queryFirst<any>(db, `SELECT lifecycle_state, superseded_by FROM awareness_memory_items WHERE memory_id = ?`, [first.memory_id]);
    assert.equal(superseded.lifecycle_state, "superseded");
    assert.equal(superseded.superseded_by, replacement.memory_id);
    await assert.rejects(() => run(db, `DELETE FROM awareness_memory_items WHERE memory_id = ?`, [first.memory_id]), /must be archived/);

    await expireMemoryItem(db, replacement.memory_id, "No longer current.", "tester");
    const expired = await queryFirst<any>(db, `SELECT lifecycle_state, freshness_state FROM awareness_memory_items WHERE memory_id = ?`, [replacement.memory_id]);
    assert.equal(expired.lifecycle_state, "expired");
    assert.equal(expired.freshness_state, "expired");
    await assert.rejects(() => run(db, `UPDATE awareness_memory_items SET lifecycle_state = 'report_eligible' WHERE memory_id = ?`, [replacement.memory_id]), /Publication-eligible/);
  } finally {
    close();
  }
});

test("Self notes and commitments stay bounded, noncanonical, archivable, and nonjudgmental", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    await assert.rejects(
      () => createSelfNote(db, {
        agent_id: agent.agent_id,
        property_id: "AR4PB",
        note_text: "Manager is bad at follow-up.",
      }),
      /may not judge/
    );

    const note = await createSelfNote(db, {
      agent_id: agent.agent_id,
      property_id: "AR4PB",
      region_id: "Arkansas",
      note_text: "Next time amenity updates are mentioned, ask whether photos and website copy were updated.",
      note_type: "verification_needed",
      visibility: "private_to_agent",
    });
    await archiveSelfNote(db, note.note_id, "tester");
    assert.ok((await getSelfNote(db, note.note_id))?.archived_at);

    const commitment = await createCommitment(db, {
      agent_id: agent.agent_id,
      property_id: "AR4PB",
      region_id: "Arkansas",
      commitment_type: "follow_up",
      description: "Captain asked manager for updated amenity photos.",
      owed_by: "Manager",
      owed_to: "Captain",
    });
    await updateCommitmentStatus(db, commitment.commitment_id, "completed", "tester");
    assert.equal((await getCommitment(db, commitment.commitment_id))?.status, "completed");
    await assert.rejects(
      () => createCommitment(db, {
        agent_id: agent.agent_id,
        property_id: "AR4PB",
        region_id: "Arkansas",
        commitment_type: "follow_up",
        description: "Manager is unreliable and always fails to follow up.",
        owed_by: "Manager",
        owed_to: "Captain",
      }),
      /without blame/
    );
  } finally {
    close();
  }
});

test("Memory governance blocks unsafe uses and preserves uncertainty", async () => {
  const agentId = "agent_1";
  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    memory_class: "agent_self_note",
    allowed_uses: ["public_copy"],
    blocked_uses: [],
  }), "public_copy").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    memory_class: "human_submitted_memory",
    allowed_uses: ["report_publication"],
    blocked_uses: [],
    verification_required: true,
  }), "report_publication").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    memory_class: "relationship_context",
    allowed_uses: ["report_publication"],
    blocked_uses: [],
  }), "report_publication").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    lifecycle_state: "expired",
    allowed_uses: ["captain_reasoning"],
    blocked_uses: [],
  }), "captain_reasoning").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    lifecycle_state: "superseded",
    allowed_uses: ["captain_reasoning"],
    blocked_uses: [],
  }), "captain_reasoning").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    allowed_uses: ["regional_summary"],
    blocked_uses: [],
    care_metadata: defaultCareMetadata({ share_as_pattern_only: true }),
  }), "regional_summary").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    correction_path: "",
    allowed_uses: ["captain_reasoning"],
    blocked_uses: [],
  }), "captain_reasoning").allowed, false);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    memory_class: "agent_self_note",
    allowed_uses: ["self_reminder"],
    blocked_uses: ["public_copy", "report_publication"],
  }), "self_reminder").allowed, true);

  assert.equal(evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    lifecycle_state: "expired",
    allowed_uses: ["historical_review"],
    blocked_uses: [],
  }), "historical_review").allowed, true);

  const warning = evaluateMemoryUseWithoutAccess(baseMemory(agentId, {
    allowed_uses: ["captain_reasoning"],
    blocked_uses: [],
    care_metadata: defaultCareMetadata({ share_as_pattern_only: true }),
  }), "captain_reasoning");
  assert.equal(warning.allowed, true);
  assert.ok(warning.warnings.includes("Share as pattern only."));
});

test("Regional awareness is summary-level and reflection creates suggestions only", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const agent = await ensureCaptainAgentForProperty(db, { property_id: "AR4PB", region_id: "Arkansas" });
    await createRegionalAwarenessSummary(db, {
      region_id: "Arkansas",
      summary_period: "2026-05",
      steward_agent_id: agent.agent_id,
      source_property_count: 2,
      pattern_summary: "Two properties show stronger lead volume than quote-ready movement.",
      sibling_property_cards: [{
        property_id: "GA4FV",
        posture_label: "similar funnel pressure",
        surface_summary: "Summary only; no private notes exposed.",
        comparable_conditions: "Lead volume above movement.",
        useful_tactic: "Tighten lead-to-visit follow-up.",
        caution: "Do not copy concessions without comp evidence.",
        confidence: 0.7,
        visibility_scope: "region_visible",
      }],
      market_context: "Summary-level regional demand pattern.",
      shared_risks: ["Traffic not moving through funnel."],
      successful_tactics: ["Specific floorplan follow-up."],
      cautionary_notes: ["Avoid raw cross-property notes."],
      evidence_refs: ["evidence_1", "evidence_2"],
      visibility_scope: "region_visible",
      freshness_state: "current",
      expires_at: null,
    });
    await createMemoryItem(db, {
      memory_class: "human_submitted_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "manager_input",
      statement: "Food truck nights may be recurring, pending verification.",
      verification_required: true,
      care_metadata: defaultCareMetadata({ sensitive_context: true }),
    });
    await createMemoryItem(db, {
      memory_class: "working_memory",
      property_id: "AR4PB",
      region_id: "Arkansas",
      agent_id: agent.agent_id,
      source_type: "test",
      statement: "Temporary offer copy may be stale.",
      freshness_state: "stale",
      verification_required: true,
    });
    const reflection = await runReflectionRoutine(db, {
      routine_type: "weekly_reflection",
      property_id: "AR4PB",
      agent_id: agent.agent_id,
      actor: "tester",
    });
    assert.ok(reflection.suggestions.some((suggestion) => suggestion.suggestion_type === "suggested_revalidation"));
    assert.ok(reflection.suggestions.some((suggestion) => suggestion.suggestion_type === "suggested_archive"));
    assert.ok(reflection.suggestions.some((suggestion) => suggestion.suggestion_type === "care_warning"));
    const memoryRows = await queryAll(db, `SELECT * FROM awareness_memory_items`);
    assert.equal(memoryRows.length, 2, "Reflection must not create or promote memory.");
  } finally {
    close();
  }
});

test("Awareness API fails closed and permits scoped posture, self notes, commitments, and archive/status mutations", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);

    const noGrant = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/posture",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(noGrant.status, 403);

    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property", "view_memory_candidates", "interact_captain"],
    });

    const posture = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/posture",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(posture.status, 200);
    assert.equal((await posture.json()).agent_identity.assigned_property_id, "AR4PB");

    const blockedNote = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/self-notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ note_text: "This team is unreliable." }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(blockedNote.status, 400);

    const noteRes = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/self-notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ note_text: "Do not recommend more traffic until funnel leakage is checked." }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(noteRes.status, 201);
    const note = await noteRes.json();
    const archiveRes = await app.request(
      `http://localhost/v1/awareness/self-notes/${note.note_id}/archive`,
      { method: "PATCH", headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(archiveRes.status, 200);

    const commitmentRes = await app.request(
      "http://localhost/v1/awareness/properties/AR4PB/commitments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ commitment_type: "follow_up", description: "Ask manager for current amenity photos.", owed_by: "Captain", owed_to: "Manager" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(commitmentRes.status, 201);
    const commitment = await commitmentRes.json();
    const statusRes = await app.request(
      `http://localhost/v1/awareness/commitments/${commitment.commitment_id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ status: "completed" }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(statusRes.status, 200);

    const deniedEvents = await queryAll(db, `SELECT * FROM property_access_audit_events WHERE decision = 'deny'`);
    assert.ok(deniedEvents.length >= 1);
  } finally {
    close();
  }
});
