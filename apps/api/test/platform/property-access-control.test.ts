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
import { runExpertRead } from "../../src/platform/expert-reads/orchestrator";
import {
  PropertyAccessControl,
  checkPropertyAccess,
  seedPropertyAccessGrant,
} from "../../src/platform/access/property-access-control";

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

test("PropertyAccessControl allows explicit property, region, portfolio, and admin scopes", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const actor = { id: "editor_user", role: "editor" as const };
    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property"],
    });
    assert.equal((await PropertyAccessControl.canViewProperty(db, { actor, propertyRef: "AR4PB" })).allowed, true);

    await seedPropertyAccessGrant(db, {
      user_id: "region_user",
      scope_type: "region",
      region: "Atlanta, GA",
      capabilities: ["view_property", "access_region_scope"],
    });
    assert.equal((await PropertyAccessControl.canViewProperty(db, {
      actor: { id: "region_user", role: "editor" },
      propertyRef: "GA4FV",
    })).scope, "region");
    assert.equal((await PropertyAccessControl.canAccessRegionScope(db, {
      actor: { id: "region_user", role: "editor" },
      region: "Atlanta, GA",
    })).allowed, true);

    await seedPropertyAccessGrant(db, {
      user_id: "portfolio_user",
      scope_type: "portfolio",
      capabilities: ["access_fleet_scope"],
      runtime_modes: ["monitoring"],
    });
    assert.equal((await PropertyAccessControl.canAccessFleetScope(db, {
      actor: { id: "portfolio_user", role: "editor" },
      runtimeMode: "monitoring",
    })).allowed, true);

    assert.equal((await PropertyAccessControl.canViewProperty(db, {
      actor: { id: "admin_user", role: "admin" },
      propertyRef: "AR4PB",
    })).allowed, true);
  } finally {
    close();
  }
});

test("PropertyAccessControl fails closed for property, actor, runtime mode, evidence, history, and lane violations", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const actor = { id: "editor_user", role: "editor" as const };
    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property", "request_expert_read"],
      runtime_modes: ["monitoring", "lightweight", "standard"],
      expert_lanes: ["navigator"],
    });

    const wrongProperty = await PropertyAccessControl.canViewProperty(db, { actor, propertyRef: "GA4FV" });
    assert.equal(wrongProperty.allowed, false);

    const badActor = await checkPropertyAccess(db, { actor: { id: "", role: "editor" }, action: "view_property", propertyRef: "AR4PB" });
    assert.equal(badActor.allowed, false);

    const missingProperty = await PropertyAccessControl.canViewProperty(db, { actor, propertyRef: "" });
    assert.equal(missingProperty.allowed, false);

    const executiveMode = await PropertyAccessControl.canUseRuntimeMode(db, { actor, propertyRef: "AR4PB", runtimeMode: "executive" });
    assert.equal(executiveMode.allowed, false);
    assert.equal(executiveMode.scope, "runtime_mode");

    const revenueLane = await PropertyAccessControl.canRequestExpertRead(db, { actor, propertyRef: "AR4PB", laneId: "revenue_advisor" });
    assert.equal(revenueLane.allowed, false);
    assert.equal(revenueLane.scope, "lane");

    const invalidLane = await PropertyAccessControl.canRequestExpertRead(db, { actor, propertyRef: "AR4PB", laneId: "not_a_lane" });
    assert.equal(invalidLane.allowed, false);
    assert.equal(invalidLane.scope, "lane");

    const invalidMode = await checkPropertyAccess(db, { actor: { id: "admin_user", role: "admin" }, action: "interact_captain", propertyRef: "AR4PB", runtimeMode: "turbo" });
    assert.equal(invalidMode.allowed, false);
    assert.equal(invalidMode.scope, "runtime_mode");

    const invalidAction = await checkPropertyAccess(db, { actor, action: "delete_everything" as any, propertyRef: "AR4PB" });
    assert.equal(invalidAction.allowed, false);

    assert.equal((await PropertyAccessControl.canViewEvidenceLineage(db, { actor, propertyRef: "AR4PB" })).allowed, false);
    assert.equal((await PropertyAccessControl.canViewRuntimeHistory(db, { actor, propertyRef: "AR4PB" })).allowed, false);

    const audit = await queryAll(db, `SELECT * FROM property_access_audit_events WHERE decision = 'deny'`);
    assert.ok(audit.length >= 6);
  } finally {
    close();
  }
});

test("PropertyAccessControl resolves grant precedence deterministically", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const actor = { id: "editor_user", role: "editor" as const };

    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "portfolio",
      capabilities: ["view_property"],
    });
    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      grant_effect: "deny",
      scope_type: "region",
      region: "Arkansas",
      capabilities: ["view_property"],
    });
    let result = await PropertyAccessControl.canViewProperty(db, { actor, propertyRef: "AR4PB" });
    assert.equal(result.allowed, false, "A region-level deny must override a portfolio allow.");
    assert.equal(result.scope, "region");

    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property"],
    });
    result = await PropertyAccessControl.canViewProperty(db, { actor, propertyRef: "AR4PB" });
    assert.equal(result.allowed, true, "A more specific property allow must override a broader region deny.");
    assert.equal(result.scope, "property");

    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      grant_effect: "deny",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property"],
    });
    result = await PropertyAccessControl.canViewProperty(db, { actor, propertyRef: "AR4PB" });
    assert.equal(result.allowed, false, "A property-level deny must override a same-scope property allow.");
    assert.equal(result.scope, "property");

    await seedPropertyAccessGrant(db, {
      user_id: "lane_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["request_expert_read"],
      runtime_modes: ["monitoring", "lightweight", "standard"],
      expert_lanes: ["navigator"],
    });
    const laneRuntime = await PropertyAccessControl.canRequestExpertRead(db, {
      actor: { id: "lane_user", role: "editor" },
      propertyRef: "AR4PB",
      runtimeMode: "executive",
      laneId: "navigator",
    });
    assert.equal(laneRuntime.allowed, false);
    assert.equal(laneRuntime.scope, "runtime_mode");
  } finally {
    close();
  }
});

test("PropertyAccessControl rejects duplicate active grants and stale or revoked grants", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const grantId = await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property"],
    });
    await assert.rejects(
      () => seedPropertyAccessGrant(db, {
        user_id: "editor_user",
        scope_type: "property",
        property_id: "AR4PB",
        capabilities: ["view_property"],
      }),
      /UNIQUE|constraint/i
    );

    await run(db, `UPDATE property_access_grants SET active_status = 'inactive' WHERE grant_id = ?`, [grantId]);
    let result = await PropertyAccessControl.canViewProperty(db, {
      actor: { id: "editor_user", role: "editor" },
      propertyRef: "AR4PB",
    });
    assert.equal(result.allowed, false, "Revoked grants must stop authorizing immediately.");

    const staleGrant = await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["view_property"],
    });
    await run(db, `UPDATE property_access_grants SET expires_at = ? WHERE grant_id = ?`, ["2000-01-01T00:00:00.000Z", staleGrant]);
    result = await PropertyAccessControl.canViewProperty(db, {
      actor: { id: "editor_user", role: "editor" },
      propertyRef: "AR4PB",
    });
    assert.equal(result.allowed, false, "Expired grants must not authorize access.");
  } finally {
    close();
  }
});

test("Captain Runtime and Captain’s Office API routes deny property-scoped access without grants", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "admin_user",
      input_text: "Create runtime history for auth route tests.",
      runtime_mode: "standard",
    });

    const interaction = await app.request(
      "http://localhost/v1/captain-runtime/interactions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({ property_id: "AR4PB", input_text: "Should fail closed." }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(interaction.status, 403);

    const office = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/office",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(office.status, 403);

    const history = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/history",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(history.status, 403);

    const evidence = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/evidence",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(evidence.status, 403);

    const memory = await app.request(
      "http://localhost/v1/captain-runtime/properties/AR4PB/memory-candidates",
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(memory.status, 403);
  } finally {
    close();
  }
});

test("Expert Reads API denies request and lane access without explicit property/lane grants", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    const captain = await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "admin_user",
      input_text: "Create evidence for Expert Read auth route tests.",
      runtime_mode: "standard",
    });

    const denied = await app.request(
      "http://localhost/v1/expert-reads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({
          property_id: "AR4PB",
          lane_id: "quartermaster",
          evidence_packet_id: captain.evidence_packet.evidence_packet_id,
          reason: "Should fail closed.",
        }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(denied.status, 403);

    await seedPropertyAccessGrant(db, {
      user_id: "editor_user",
      scope_type: "property",
      property_id: "AR4PB",
      capabilities: ["request_expert_read", "view_expert_read"],
      expert_lanes: ["navigator"],
    });
    const wrongLane = await app.request(
      "http://localhost/v1/expert-reads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `pop_session=${tokens.editor}` },
        body: JSON.stringify({
          property_id: "AR4PB",
          lane_id: "quartermaster",
          evidence_packet_id: captain.evidence_packet.evidence_packet_id,
          reason: "Wrong lane should fail.",
        }),
      },
      createPlatformRouteEnv(db)
    );
    assert.equal(wrongLane.status, 403);
    const body = await wrongLane.json() as { error: { code: string } };
    assert.equal(body.error.code, "FORBIDDEN_EXPERT_LANE");
  } finally {
    close();
  }
});

test("Expert Read detail route masks unauthorized existing records as not found", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    const tokens = await seedAuth(db);
    const captain = await runCaptainRuntimeInteraction(db, {
      property_id: "AR4PB",
      user_id: "admin_user",
      input_text: "Create evidence for Expert Read leakage test.",
      runtime_mode: "standard",
    });
    const read = await runExpertRead(db, {
      property_id: "AR4PB",
      requested_by: "admin_user",
      lane_id: "quartermaster",
      evidence_packet_id: captain.evidence_packet.evidence_packet_id,
      reason: "Create existing read.",
    });
    const unauthorized = await app.request(
      `http://localhost/v1/expert-reads/${read.expert_read.expert_read_id}`,
      { headers: { cookie: `pop_session=${tokens.editor}` } },
      createPlatformRouteEnv(db)
    );
    assert.equal(unauthorized.status, 404);
    const body = await unauthorized.json() as { error: { code: string } };
    assert.equal(body.error.code, "EXPERT_READ_NOT_FOUND");
    const audit = await queryAll(db, `SELECT * FROM property_access_audit_events WHERE decision = 'deny' AND requested_action = 'view_expert_read'`);
    assert.equal(audit.length, 1, "Masked detail denials must still be auditable.");
  } finally {
    close();
  }
});

test("Property access audit events are immutable and retain correlation ids", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedBase(db);
    await PropertyAccessControl.canViewProperty(db, {
      actor: { id: "editor_user", role: "editor" },
      propertyRef: "AR4PB",
      correlationId: "corr-test",
    });
    const audit = await queryAll<{ event_id: string; correlation_id: string }>(
      db,
      `SELECT event_id, correlation_id FROM property_access_audit_events WHERE correlation_id = 'corr-test'`
    );
    assert.equal(audit.length, 1);
    await assert.rejects(
      () => run(db, `UPDATE property_access_audit_events SET reason = 'changed' WHERE event_id = ?`, [audit[0].event_id]),
      /immutable/
    );
    await assert.rejects(
      () => run(db, `DELETE FROM property_access_audit_events WHERE event_id = ?`, [audit[0].event_id]),
      /cannot be deleted/
    );
  } finally {
    close();
  }
});
