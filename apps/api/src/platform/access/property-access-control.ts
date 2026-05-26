import type { AuthUser } from "../../env";
import { queryAll, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { findCommunityForRuntime } from "../captain-runtime/repository";
import { isExpertLaneId } from "../expert-reads/contracts";
import type { ExpertLaneId } from "../expert-reads/types";

export type PropertyAccessAction =
  | "view_property"
  | "interact_captain"
  | "request_expert_read"
  | "view_expert_read"
  | "view_runtime_history"
  | "view_evidence_lineage"
  | "view_memory_candidates"
  | "operate_captain_office"
  | "access_fleet_scope"
  | "access_region_scope";

export type PropertyAccessScope = "portfolio" | "region" | "property" | "role" | "runtime_mode" | "lane";
export type PropertyAccessDecision = "allow" | "deny";
export type RuntimeMode = "monitoring" | "lightweight" | "standard" | "escalated" | "executive" | "simulation";
export type PropertyAccessGrantEffect = "allow" | "deny";

const PROPERTY_ACCESS_ACTIONS: readonly PropertyAccessAction[] = [
  "view_property",
  "interact_captain",
  "request_expert_read",
  "view_expert_read",
  "view_runtime_history",
  "view_evidence_lineage",
  "view_memory_candidates",
  "operate_captain_office",
  "access_fleet_scope",
  "access_region_scope",
];

const RUNTIME_MODES: readonly RuntimeMode[] = ["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"];

export interface PropertyAccessActor {
  id: string;
  email?: string | null;
  role: AuthUser["role"];
}

export interface PropertyAccessInput {
  actor: PropertyAccessActor | null | undefined;
  action: PropertyAccessAction;
  propertyRef?: string | null;
  region?: string | null;
  runtimeMode?: RuntimeMode | string | null;
  laneId?: ExpertLaneId | string | null;
  correlationId?: string | null;
}

export interface PropertyAccessResult {
  allowed: boolean;
  decision: PropertyAccessDecision;
  reason: string;
  action: PropertyAccessAction;
  actor_id: string | null;
  actor_role: AuthUser["role"] | null;
  property_id: string | null;
  community_id: string | null;
  region: string | null;
  scope: PropertyAccessScope | null;
  runtime_mode: string | null;
  lane_id: string | null;
  high_risk: boolean;
}

interface AccessGrantRow {
  grant_id: string;
  user_id: string;
  grant_effect: PropertyAccessGrantEffect;
  scope_type: "portfolio" | "region" | "property";
  property_id: string | null;
  region: string | null;
  grant_fingerprint: string;
  capabilities_json: string;
  runtime_modes_json: string;
  expert_lanes_json: string;
  active_status: string;
  expires_at: string | null;
}

export class PropertyAccessDeniedError extends Error {
  readonly result: PropertyAccessResult;

  constructor(result: PropertyAccessResult) {
    super(result.reason);
    this.name = "PropertyAccessDeniedError";
    this.result = result;
  }
}

export async function ensurePropertyAccessControlTables(db: D1Database): Promise<void> {
  await run(db, `CREATE TABLE IF NOT EXISTS property_access_grants (
    grant_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    grant_effect TEXT NOT NULL CHECK (grant_effect IN ('allow', 'deny')) DEFAULT 'allow',
    scope_type TEXT NOT NULL CHECK (scope_type IN ('portfolio', 'region', 'property')),
    property_id TEXT,
    region TEXT,
    grant_fingerprint TEXT NOT NULL,
    capabilities_json TEXT NOT NULL,
    runtime_modes_json TEXT NOT NULL,
    expert_lanes_json TEXT NOT NULL,
    active_status TEXT NOT NULL CHECK (active_status IN ('active', 'inactive')) DEFAULT 'active',
    expires_at TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT,
    updated_at TEXT NOT NULL,
    updated_by TEXT,
    CHECK (
      (scope_type = 'property' AND property_id IS NOT NULL AND trim(property_id) <> '') OR
      (scope_type = 'region' AND region IS NOT NULL AND trim(region) <> '') OR
      (scope_type = 'portfolio' AND property_id IS NULL AND region IS NULL)
    )
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_property_access_grants_user ON property_access_grants(user_id, active_status)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_property_access_grants_property ON property_access_grants(property_id, active_status)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_property_access_grants_region ON property_access_grants(region, active_status)`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_property_access_grants_unique_active ON property_access_grants(user_id, grant_fingerprint) WHERE active_status = 'active'`);

  await run(db, `CREATE TABLE IF NOT EXISTS property_access_audit_events (
    event_id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_role TEXT,
    property_id TEXT,
    community_id TEXT,
    region TEXT,
    requested_action TEXT NOT NULL,
    requested_scope TEXT,
    runtime_mode TEXT,
    lane_id TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
    reason TEXT NOT NULL,
    high_risk INTEGER NOT NULL CHECK (high_risk IN (0, 1)),
    correlation_id TEXT,
    created_at TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_property_access_audit_actor ON property_access_audit_events(actor_id, created_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_property_access_audit_property ON property_access_audit_events(property_id, created_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_property_access_audit_decision ON property_access_audit_events(decision, created_at DESC)`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_property_access_audit_immutable
    BEFORE UPDATE ON property_access_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Property access audit events are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_property_access_audit_no_delete
    BEFORE DELETE ON property_access_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Property access audit events cannot be deleted.');
    END`);
}

export async function checkPropertyAccess(db: D1Database, input: PropertyAccessInput): Promise<PropertyAccessResult> {
  await ensurePropertyAccessControlTables(db);
  const actor = normalizeActor(input.actor);
  const highRisk = isHighRisk(input);
  const base = {
    action: input.action,
    actor_id: actor?.id ?? null,
    actor_role: actor?.role ?? null,
    runtime_mode: input.runtimeMode ? String(input.runtimeMode) : null,
    lane_id: input.laneId ? String(input.laneId) : null,
    high_risk: highRisk,
  };

  if (!actor) {
    return auditAndReturn(db, {
      ...base,
      allowed: false,
      decision: "deny",
      reason: "Malformed or missing actor.",
      property_id: null,
      community_id: null,
      region: null,
      scope: null,
    }, input.correlationId);
  }

  if (!isPropertyAccessAction(input.action)) {
    return auditAndReturn(db, {
      ...base,
      allowed: false,
      decision: "deny",
      reason: "Unknown authorization action.",
      property_id: null,
      community_id: null,
      region: null,
      scope: null,
    }, input.correlationId);
  }

  if (input.runtimeMode && !isRuntimeMode(String(input.runtimeMode))) {
    return auditAndReturn(db, {
      ...base,
      allowed: false,
      decision: "deny",
      reason: "Unsupported runtime mode.",
      property_id: null,
      community_id: null,
      region: null,
      scope: "runtime_mode",
    }, input.correlationId);
  }

  if (input.laneId && !isExpertLaneId(String(input.laneId))) {
    return auditAndReturn(db, {
      ...base,
      allowed: false,
      decision: "deny",
      reason: "Unsupported Expert Read lane.",
      property_id: null,
      community_id: null,
      region: null,
      scope: "lane",
    }, input.correlationId);
  }

  if (input.action === "access_region_scope" && !input.region?.trim()) {
    return auditAndReturn(db, {
      ...base,
      allowed: false,
      decision: "deny",
      reason: "Region scope is missing or unresolvable.",
      property_id: null,
      community_id: null,
      region: null,
      scope: "region",
    }, input.correlationId);
  }

  const property = await resolveProperty(db, input.propertyRef ?? null);
  if (requiresProperty(input.action) && !property) {
    return auditAndReturn(db, {
      ...base,
      allowed: false,
      decision: "deny",
      reason: "Property scope is missing, ambiguous, stale, or unresolvable.",
      property_id: input.propertyRef ?? null,
      community_id: null,
      region: null,
      scope: null,
    }, input.correlationId);
  }

  const propertyId = property?.property_id ?? null;
  const common = {
    ...base,
    property_id: propertyId,
    community_id: property?.community_id ?? null,
    region: property?.region ?? input.region ?? null,
  };

  if (actor.role === "admin") {
    return auditAndReturn(db, {
      ...common,
      allowed: true,
      decision: "allow",
      reason: "Admin superuser property authorization.",
      scope: property ? "property" : scopeForAction(input.action),
    }, input.correlationId);
  }

  if (input.runtimeMode && !isRuntimeModeAllowedForRole(actor.role, String(input.runtimeMode))) {
    return auditAndReturn(db, {
      ...common,
      allowed: false,
      decision: "deny",
      reason: `${input.runtimeMode} runtime mode is not allowed for ${actor.role}.`,
      scope: "runtime_mode",
    }, input.correlationId);
  }

  const grants = await activeGrantsForActor(db, actor.id);
  const matchingGrant = resolveMatchingGrant(grants, input, property);
  if (!matchingGrant) {
    return auditAndReturn(db, {
      ...common,
      allowed: false,
      decision: "deny",
      reason: deniedGrantReason(grants, input, property),
      scope: deniedScope(grants, input, property),
    }, input.correlationId);
  }

  if (matchingGrant.grant_effect === "deny") {
    return auditAndReturn(db, {
      ...common,
      allowed: false,
      decision: "deny",
      reason: `Access denied by ${matchingGrant.scope_type} grant.`,
      scope: matchingGrant.scope_type,
    }, input.correlationId);
  }

  return auditAndReturn(db, {
    ...common,
    allowed: true,
    decision: "allow",
    reason: `Access allowed by ${matchingGrant.scope_type} grant.`,
    scope: matchingGrant.scope_type,
  }, input.correlationId);
}

export async function requirePropertyAccess(db: D1Database, input: PropertyAccessInput): Promise<PropertyAccessResult> {
  const result = await checkPropertyAccess(db, input);
  if (!result.allowed) throw new PropertyAccessDeniedError(result);
  return result;
}

export const PropertyAccessControl = {
  canViewProperty: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "view_property" }),
  canInteractWithCaptain: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "interact_captain" }),
  canRequestExpertRead: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "request_expert_read" }),
  canViewExpertRead: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "view_expert_read" }),
  canUseRuntimeMode: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "interact_captain" }),
  canViewRuntimeHistory: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "view_runtime_history" }),
  canViewEvidenceLineage: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "view_evidence_lineage" }),
  canViewMemoryCandidates: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "view_memory_candidates" }),
  canOperateCaptainOffice: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "operate_captain_office" }),
  canAccessFleetScope: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "access_fleet_scope" }),
  canAccessRegionScope: (db: D1Database, input: Omit<PropertyAccessInput, "action">) => checkPropertyAccess(db, { ...input, action: "access_region_scope" }),
};

export async function seedPropertyAccessGrant(
  db: D1Database,
  input: {
    user_id: string;
    grant_effect?: PropertyAccessGrantEffect;
    scope_type: "portfolio" | "region" | "property";
    property_id?: string | null;
    region?: string | null;
    capabilities?: string[];
    runtime_modes?: string[];
    expert_lanes?: string[];
    created_by?: string | null;
  }
): Promise<string> {
  await ensurePropertyAccessControlTables(db);
  const now = nowISO();
  const grantId = `property_access_grant_${newId()}`;
  const grantEffect = input.grant_effect ?? "allow";
  const capabilities = canonicalList(input.capabilities ?? ["*"]);
  const runtimeModes = canonicalList(input.runtime_modes ?? ["monitoring", "lightweight", "standard"]);
  const expertLanes = canonicalList(input.expert_lanes ?? ["*"]);
  const propertyId = input.scope_type === "property" ? input.property_id ?? null : null;
  const region = input.scope_type === "region" ? input.region ?? null : null;
  const fingerprint = grantFingerprint({
    grant_effect: grantEffect,
    scope_type: input.scope_type,
    property_id: propertyId,
    region,
    capabilities,
    runtime_modes: runtimeModes,
    expert_lanes: expertLanes,
  });
  await run(
    db,
    `INSERT INTO property_access_grants (
      grant_id, user_id, grant_effect, scope_type, property_id, region, grant_fingerprint, capabilities_json, runtime_modes_json,
      expert_lanes_json, active_status, expires_at, created_at, created_by, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?, ?)`,
    [
      grantId,
      input.user_id,
      grantEffect,
      input.scope_type,
      propertyId,
      region,
      fingerprint,
      JSON.stringify(capabilities),
      JSON.stringify(runtimeModes),
      JSON.stringify(expertLanes),
      now,
      input.created_by ?? input.user_id,
      now,
      input.created_by ?? input.user_id,
    ]
  );
  return grantId;
}

function normalizeActor(actor: PropertyAccessActor | null | undefined): PropertyAccessActor | null {
  if (!actor || !actor.id || !["admin", "editor", "viewer"].includes(actor.role)) return null;
  return actor;
}

function isPropertyAccessAction(action: unknown): action is PropertyAccessAction {
  return typeof action === "string" && PROPERTY_ACCESS_ACTIONS.includes(action as PropertyAccessAction);
}

function isRuntimeMode(value: string): value is RuntimeMode {
  return RUNTIME_MODES.includes(value as RuntimeMode);
}

async function resolveProperty(db: D1Database, propertyRef: string | null): Promise<{ property_id: string; community_id: string; region: string | null } | null> {
  if (!propertyRef || !propertyRef.trim()) return null;
  try {
    const property = await findCommunityForRuntime(db, propertyRef);
    if (!property) return null;
    return { property_id: property.encasa_property_code ?? property.id, community_id: property.id, region: property.region ?? null };
  } catch {
    return null;
  }
}

async function activeGrantsForActor(db: D1Database, actorId: string): Promise<AccessGrantRow[]> {
  return queryAll<AccessGrantRow>(
    db,
    `SELECT * FROM property_access_grants
     WHERE user_id = ?
       AND active_status = 'active'
       AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY
       CASE scope_type WHEN 'property' THEN 1 WHEN 'region' THEN 2 ELSE 3 END ASC,
       CASE grant_effect WHEN 'deny' THEN 1 ELSE 2 END ASC`,
    [actorId, nowISO()]
  );
}

function resolveMatchingGrant(
  grants: AccessGrantRow[],
  input: PropertyAccessInput,
  property: { property_id: string; community_id: string; region: string | null } | null
): AccessGrantRow | null {
  const matches = grants
    .filter((grant) => grantMatches(grant, input, property))
    .sort((a, b) => grantSpecificity(b) - grantSpecificity(a) || grantEffectRank(a) - grantEffectRank(b));
  return matches[0] ?? null;
}

function grantMatches(
  grant: AccessGrantRow,
  input: PropertyAccessInput,
  property: { property_id: string; community_id: string; region: string | null } | null
): boolean {
  if (!scopeMatches(grant, property, input.action, input.region ?? null)) return false;
  if (!listAllows(grant.capabilities_json, input.action)) return false;
  if (input.runtimeMode && !listAllows(grant.runtime_modes_json, String(input.runtimeMode))) return false;
  if (input.laneId && !listAllows(grant.expert_lanes_json, String(input.laneId))) return false;
  return true;
}

function scopeMatches(
  grant: AccessGrantRow,
  property: { property_id: string; community_id: string; region: string | null } | null,
  action: PropertyAccessAction,
  requestedRegion: string | null
): boolean {
  if (grant.scope_type === "portfolio") return true;
  if (grant.scope_type === "region") {
    if (action === "access_region_scope") return !!grant.region && !!requestedRegion && grant.region === requestedRegion;
    return !!property?.region && property.region === grant.region;
  }
  if (grant.scope_type === "property") {
    return !!property && (grant.property_id === property.property_id || grant.property_id === property.community_id);
  }
  return false;
}

function listAllows(json: string, requested: string): boolean {
  const values = safeJson<string[]>(json) ?? [];
  return values.includes("*") || values.includes(requested);
}

function grantSpecificity(grant: AccessGrantRow): number {
  if (grant.scope_type === "property") return 3;
  if (grant.scope_type === "region") return 2;
  return 1;
}

function grantEffectRank(grant: AccessGrantRow): number {
  return grant.grant_effect === "deny" ? 0 : 1;
}

function isRuntimeModeAllowedForRole(role: AuthUser["role"], runtimeMode: string): boolean {
  if (role === "admin") return true;
  if (role === "editor") return ["monitoring", "lightweight", "standard"].includes(runtimeMode);
  return runtimeMode === "monitoring";
}

function requiresProperty(action: PropertyAccessAction): boolean {
  return !["access_fleet_scope", "access_region_scope"].includes(action);
}

function scopeForAction(action: PropertyAccessAction): PropertyAccessScope {
  if (action === "access_fleet_scope") return "portfolio";
  if (action === "access_region_scope") return "region";
  return "property";
}

function deniedGrantReason(
  grants: AccessGrantRow[],
  input: PropertyAccessInput,
  property: { property_id: string; community_id: string; region: string | null } | null
): string {
  const scoped = grants.filter((grant) => scopeMatches(grant, property, input.action, input.region ?? null));
  if (scoped.length > 0 && input.runtimeMode && !scoped.some((grant) => listAllows(grant.runtime_modes_json, String(input.runtimeMode)))) {
    return "No active grant permits this runtime mode for the requested property scope.";
  }
  if (scoped.length > 0 && input.laneId && !scoped.some((grant) => listAllows(grant.expert_lanes_json, String(input.laneId)))) {
    return "No active grant permits this Expert Read lane for the requested property scope.";
  }
  if (scoped.length > 0 && !scoped.some((grant) => listAllows(grant.capabilities_json, input.action))) {
    return "No active grant permits this capability for the requested property scope.";
  }
  return "No active property, region, or portfolio grant permits this action.";
}

function deniedScope(
  grants: AccessGrantRow[],
  input: PropertyAccessInput,
  property: { property_id: string; community_id: string; region: string | null } | null
): PropertyAccessScope {
  const scoped = grants.filter((grant) => scopeMatches(grant, property, input.action, input.region ?? null));
  if (scoped.length > 0 && input.runtimeMode && !scoped.some((grant) => listAllows(grant.runtime_modes_json, String(input.runtimeMode)))) return "runtime_mode";
  if (scoped.length > 0 && input.laneId && !scoped.some((grant) => listAllows(grant.expert_lanes_json, String(input.laneId)))) return "lane";
  return property ? "property" : scopeForAction(input.action);
}

function isHighRisk(input: PropertyAccessInput): boolean {
  return ["escalated", "executive", "simulation"].includes(String(input.runtimeMode ?? "")) ||
    input.action === "access_fleet_scope" ||
    input.action === "access_region_scope";
}

async function auditAndReturn(db: D1Database, result: PropertyAccessResult, correlationId?: string | null): Promise<PropertyAccessResult> {
  if (!result.allowed || result.high_risk) {
    await run(
      db,
      `INSERT INTO property_access_audit_events (
        event_id, actor_id, actor_role, property_id, community_id, region, requested_action,
        requested_scope, runtime_mode, lane_id, decision, reason, high_risk, correlation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `property_access_audit_${newId()}`,
        result.actor_id,
        result.actor_role,
        result.property_id,
        result.community_id,
        result.region,
        result.action,
        result.scope,
        result.runtime_mode,
        result.lane_id,
        result.decision,
        result.reason,
        result.high_risk ? 1 : 0,
        correlationId ?? null,
        nowISO(),
      ]
    );
  }
  return result;
}

function safeJson<T>(value: unknown): T | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function canonicalList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function grantFingerprint(input: {
  grant_effect: PropertyAccessGrantEffect;
  scope_type: "portfolio" | "region" | "property";
  property_id: string | null;
  region: string | null;
  capabilities: string[];
  runtime_modes: string[];
  expert_lanes: string[];
}): string {
  return JSON.stringify(input);
}
