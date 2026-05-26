import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { stableHash } from "../shared/stable-hash";
import type {
  AgentCharter,
  AgentIdentity,
  AgentSelfNote,
  CareMetadata,
  CommitmentMemory,
  CommitmentStatus,
  DoctrineCandidate,
  MemoryAllowedUse,
  MemoryClass,
  MemoryItem,
  MemoryLifecycleState,
  MemoryPosture,
  MemorySensitivity,
  MemoryVisibilityScope,
  RegionalAwarenessSummary,
  SelfNoteType,
} from "./types";
import { defaultCareMetadata, validateAgentCharter, validateLifecycleTransition, validateMemoryItem, validateSelfNote } from "./validation";

const BLAME_COMMITMENT_PATTERNS = [
  /\b(is|are|was|were)\s+(bad|lazy|unreliable|incompetent|terrible)\b/i,
  /\b(always|never)\s+(fails?|failed|responds?|follows?\s+up)\b/i,
  /\bblame\b/i,
];

export async function ensureAwarenessTables(db: D1Database): Promise<void> {
  await run(db, `CREATE TABLE IF NOT EXISTS awareness_agent_identities (
    agent_id TEXT PRIMARY KEY,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('captain', 'commodore', 'fleet', 'expert_lane', 'scribe')),
    display_name TEXT NOT NULL,
    formal_title TEXT NOT NULL,
    assigned_property_id TEXT,
    assigned_region_id TEXT,
    assigned_lane_id TEXT,
    active_status TEXT NOT NULL CHECK (active_status IN ('active', 'retired')),
    created_at TEXT NOT NULL,
    retired_at TEXT,
    identity_version INTEGER NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_agents_property ON awareness_agent_identities(assigned_property_id, active_status)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_agents_region ON awareness_agent_identities(assigned_region_id, active_status)`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_agent_charters (
    charter_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    sphere_of_responsibility TEXT NOT NULL,
    sphere_of_knowledge TEXT NOT NULL,
    sphere_of_action TEXT NOT NULL,
    sphere_of_memory TEXT NOT NULL,
    visibility_scope TEXT NOT NULL,
    allowed_actions_json TEXT NOT NULL,
    blocked_actions_json TEXT NOT NULL,
    allowed_memory_classes_json TEXT NOT NULL,
    blocked_memory_classes_json TEXT NOT NULL,
    authority_boundaries_json TEXT NOT NULL,
    care_obligations_json TEXT NOT NULL,
    escalation_obligations_json TEXT NOT NULL,
    steward_roles_json TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    version INTEGER NOT NULL,
    approval_status TEXT NOT NULL CHECK (approval_status IN ('draft', 'approved', 'retired')),
    FOREIGN KEY (agent_id) REFERENCES awareness_agent_identities(agent_id) ON DELETE RESTRICT
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_charters_agent ON awareness_agent_charters(agent_id, approval_status)`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_memory_items (
    memory_id TEXT PRIMARY KEY,
    memory_class TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL,
    property_id TEXT,
    region_id TEXT,
    agent_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    statement TEXT NOT NULL,
    structured_claim_json TEXT,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    freshness_state TEXT NOT NULL,
    sensitivity TEXT NOT NULL,
    visibility_scope TEXT NOT NULL,
    allowed_uses_json TEXT NOT NULL,
    blocked_uses_json TEXT NOT NULL,
    steward TEXT NOT NULL,
    verification_required INTEGER NOT NULL CHECK (verification_required IN (0, 1)),
    correction_path TEXT NOT NULL,
    fresh_until TEXT,
    expires_at TEXT,
    revalidation_due_at TEXT,
    archived_at TEXT,
    archived_reason TEXT,
    superseded_by TEXT,
    evidence_refs_json TEXT NOT NULL,
    directive_refs_json TEXT NOT NULL,
    care_metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_memory_property ON awareness_memory_items(property_id, lifecycle_state)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_memory_agent ON awareness_memory_items(agent_id, lifecycle_state)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_memory_region ON awareness_memory_items(region_id, lifecycle_state)`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_self_notes (
    note_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    property_id TEXT,
    region_id TEXT,
    note_text TEXT NOT NULL,
    note_type TEXT NOT NULL,
    importance INTEGER NOT NULL CHECK (importance >= 1 AND importance <= 5),
    visibility TEXT NOT NULL,
    reminder_at TEXT,
    expires_at TEXT,
    archived_at TEXT,
    source_context TEXT,
    related_memory_id TEXT,
    related_interaction_id TEXT,
    related_expert_read_id TEXT,
    care_metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_self_notes_property ON awareness_self_notes(property_id, archived_at)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_self_notes_agent ON awareness_self_notes(agent_id, archived_at)`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_commitments (
    commitment_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    property_id TEXT,
    region_id TEXT,
    commitment_type TEXT NOT NULL,
    description TEXT NOT NULL,
    owed_by TEXT NOT NULL,
    owed_to TEXT NOT NULL,
    due_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('open', 'waiting', 'completed', 'blocked', 'expired', 'archived')),
    source_ref TEXT,
    related_memory_id TEXT,
    related_interaction_id TEXT,
    related_expert_read_id TEXT,
    care_metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_commitments_property ON awareness_commitments(property_id, status)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_commitments_agent ON awareness_commitments(agent_id, status)`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_regional_summaries (
    summary_id TEXT PRIMARY KEY,
    region_id TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    summary_period TEXT NOT NULL,
    steward_agent_id TEXT NOT NULL,
    source_property_count INTEGER NOT NULL,
    pattern_summary TEXT NOT NULL,
    sibling_property_cards_json TEXT NOT NULL,
    market_context TEXT NOT NULL,
    shared_risks_json TEXT NOT NULL,
    successful_tactics_json TEXT NOT NULL,
    cautionary_notes_json TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL,
    visibility_scope TEXT NOT NULL,
    freshness_state TEXT NOT NULL,
    expires_at TEXT
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_regional_summaries_region ON awareness_regional_summaries(region_id, generated_at DESC)`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_doctrine_candidates (
    doctrine_candidate_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    pattern_statement TEXT NOT NULL,
    source_scope TEXT NOT NULL CHECK (source_scope IN ('property', 'region', 'fleet')),
    supporting_memory_refs_json TEXT NOT NULL,
    supporting_evidence_refs_json TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    proposed_by_agent_id TEXT NOT NULL,
    steward_agent_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected', 'archived')),
    care_review_required INTEGER NOT NULL CHECK (care_review_required IN (0, 1)),
    created_at TEXT NOT NULL
  )`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_memory_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor TEXT,
    agent_id TEXT,
    property_id TEXT,
    region_id TEXT,
    memory_id TEXT,
    note_id TEXT,
    commitment_id TEXT,
    action TEXT NOT NULL,
    before_state_json TEXT,
    after_state_json TEXT,
    reason TEXT,
    care_rule_triggered TEXT,
    timestamp TEXT NOT NULL,
    correlation_id TEXT
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_events_property ON awareness_memory_events(property_id, timestamp DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_awareness_events_agent ON awareness_memory_events(agent_id, timestamp DESC)`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_events_immutable
    BEFORE UPDATE ON awareness_memory_events
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory events are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_events_no_delete
    BEFORE DELETE ON awareness_memory_events
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory events cannot be deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_items_no_delete
    BEFORE DELETE ON awareness_memory_items
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory items must be archived, expired, rejected, or superseded, not deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_no_publication_state
    BEFORE UPDATE OF lifecycle_state ON awareness_memory_items
    WHEN NEW.lifecycle_state IN ('report_eligible', 'approved_doctrine')
    BEGIN
      SELECT RAISE(ABORT, 'Publication-eligible memory states require a future governed workflow.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_self_notes_no_delete
    BEFORE DELETE ON awareness_self_notes
    BEGIN
      SELECT RAISE(ABORT, 'Awareness self notes must be archived, not deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_commitments_no_delete
    BEFORE DELETE ON awareness_commitments
    BEGIN
      SELECT RAISE(ABORT, 'Awareness commitments must be closed or archived, not deleted.');
    END`);

  await run(db, `CREATE TABLE IF NOT EXISTS awareness_memory_links (
    link_id TEXT PRIMARY KEY,
    source_memory_id TEXT NOT NULL,
    target_ref_type TEXT NOT NULL,
    target_ref TEXT NOT NULL,
    link_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS awareness_memory_corrections (
    correction_id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    correction_text TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('submitted', 'accepted', 'rejected', 'archived')),
    created_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_corrections_immutable
    BEFORE UPDATE ON awareness_memory_corrections
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory corrections are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_corrections_no_delete
    BEFORE DELETE ON awareness_memory_corrections
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory corrections cannot be deleted.');
    END`);
  await run(db, `CREATE TABLE IF NOT EXISTS awareness_memory_archives (
    archive_id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    archived_by TEXT NOT NULL,
    archived_reason TEXT NOT NULL,
    archived_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_archives_immutable
    BEFORE UPDATE ON awareness_memory_archives
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory archives are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_archives_no_delete
    BEFORE DELETE ON awareness_memory_archives
    BEGIN
      SELECT RAISE(ABORT, 'Awareness memory archives cannot be deleted.');
    END`);
}

export async function auditAwarenessEvent(db: D1Database, input: {
  event_type: string;
  actor?: string | null;
  agent_id?: string | null;
  property_id?: string | null;
  region_id?: string | null;
  memory_id?: string | null;
  note_id?: string | null;
  commitment_id?: string | null;
  action: string;
  before_state?: unknown;
  after_state?: unknown;
  reason?: string | null;
  care_rule_triggered?: string | null;
  correlation_id?: string | null;
}): Promise<void> {
  await ensureAwarenessTables(db);
  await run(db, `INSERT INTO awareness_memory_events (
    event_id, event_type, actor, agent_id, property_id, region_id, memory_id, note_id, commitment_id,
    action, before_state_json, after_state_json, reason, care_rule_triggered, timestamp, correlation_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    `awareness_event_${newId()}`,
    input.event_type,
    input.actor ?? null,
    input.agent_id ?? null,
    input.property_id ?? null,
    input.region_id ?? null,
    input.memory_id ?? null,
    input.note_id ?? null,
    input.commitment_id ?? null,
    input.action,
    input.before_state === undefined ? null : JSON.stringify(input.before_state),
    input.after_state === undefined ? null : JSON.stringify(input.after_state),
    input.reason ?? null,
    input.care_rule_triggered ?? null,
    nowISO(),
    input.correlation_id ?? null,
  ]);
}

export async function createAgentIdentity(db: D1Database, input: Omit<AgentIdentity, "agent_id" | "created_at" | "retired_at" | "identity_version"> & { agent_id?: string }): Promise<AgentIdentity> {
  await ensureAwarenessTables(db);
  const now = nowISO();
  const identity: AgentIdentity = {
    ...input,
    agent_id: input.agent_id ?? `agent_${stableHash([input.agent_type, input.assigned_property_id, input.assigned_region_id, input.assigned_lane_id, input.display_name])}`,
    created_at: now,
    retired_at: null,
    identity_version: 1,
  };
  await run(db, `INSERT OR IGNORE INTO awareness_agent_identities (
    agent_id, agent_type, display_name, formal_title, assigned_property_id, assigned_region_id,
    assigned_lane_id, active_status, created_at, retired_at, identity_version
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    identity.agent_id,
    identity.agent_type,
    identity.display_name,
    identity.formal_title,
    identity.assigned_property_id,
    identity.assigned_region_id,
    identity.assigned_lane_id,
    identity.active_status,
    identity.created_at,
    identity.retired_at,
    identity.identity_version,
  ]);
  await auditAwarenessEvent(db, { event_type: "agent_identity.created", actor: "system", agent_id: identity.agent_id, property_id: identity.assigned_property_id, region_id: identity.assigned_region_id, action: "create_agent_identity", after_state: identity });
  return identity;
}

export async function retireAgentIdentity(db: D1Database, agentId: string, actor = "system"): Promise<void> {
  await ensureAwarenessTables(db);
  const existing = await getAgentIdentity(db, agentId);
  await run(db, `UPDATE awareness_agent_identities SET active_status = 'retired', retired_at = ? WHERE agent_id = ?`, [nowISO(), agentId]);
  await auditAwarenessEvent(db, { event_type: "agent_identity.retired", actor, agent_id: agentId, property_id: existing?.assigned_property_id ?? null, region_id: existing?.assigned_region_id ?? null, action: "retire_agent_identity", before_state: existing, reason: "Retired safely." });
}

export async function createAgentCharter(db: D1Database, input: Omit<AgentCharter, "charter_id"> & { charter_id?: string }): Promise<AgentCharter> {
  await ensureAwarenessTables(db);
  const charter: AgentCharter = { ...input, charter_id: input.charter_id ?? `charter_${newId()}` };
  const errors = validateAgentCharter(charter);
  if (errors.length) throw new Error(errors.join(" "));
  await run(db, `INSERT INTO awareness_agent_charters (
    charter_id, agent_id, sphere_of_responsibility, sphere_of_knowledge, sphere_of_action, sphere_of_memory,
    visibility_scope, allowed_actions_json, blocked_actions_json, allowed_memory_classes_json, blocked_memory_classes_json,
    authority_boundaries_json, care_obligations_json, escalation_obligations_json, steward_roles_json,
    effective_date, version, approval_status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    charter.charter_id,
    charter.agent_id,
    charter.sphere_of_responsibility,
    charter.sphere_of_knowledge,
    charter.sphere_of_action,
    charter.sphere_of_memory,
    charter.visibility_scope,
    JSON.stringify(charter.allowed_actions),
    JSON.stringify(charter.blocked_actions),
    JSON.stringify(charter.allowed_memory_classes),
    JSON.stringify(charter.blocked_memory_classes),
    JSON.stringify(charter.authority_boundaries),
    JSON.stringify(charter.care_obligations),
    JSON.stringify(charter.escalation_obligations),
    JSON.stringify(charter.steward_roles),
    charter.effective_date,
    charter.version,
    charter.approval_status,
  ]);
  await auditAwarenessEvent(db, { event_type: "agent_charter.created", actor: "system", agent_id: charter.agent_id, action: "create_agent_charter", after_state: charter });
  return charter;
}

export async function getAgentIdentity(db: D1Database, agentId: string): Promise<AgentIdentity | null> {
  await ensureAwarenessTables(db);
  return queryFirst<AgentIdentity>(db, `SELECT * FROM awareness_agent_identities WHERE agent_id = ?`, [agentId]);
}

export async function getAgentForProperty(db: D1Database, propertyId: string): Promise<AgentIdentity | null> {
  await ensureAwarenessTables(db);
  return queryFirst<AgentIdentity>(db, `SELECT * FROM awareness_agent_identities WHERE assigned_property_id = ? AND agent_type = 'captain' AND active_status = 'active' ORDER BY created_at DESC LIMIT 1`, [propertyId]);
}

export async function ensureCaptainAgentForProperty(db: D1Database, input: { property_id: string; region_id?: string | null; display_name?: string | null }): Promise<AgentIdentity> {
  const existing = await getAgentForProperty(db, input.property_id);
  if (existing) return existing;
  const identity = await createAgentIdentity(db, {
    agent_type: "captain",
    display_name: input.display_name ?? `Captain ${input.property_id}`,
    formal_title: "Captain",
    assigned_property_id: input.property_id,
    assigned_region_id: input.region_id ?? null,
    assigned_lane_id: null,
    active_status: "active",
  });
  await createAgentCharter(db, {
    agent_id: identity.agent_id,
    sphere_of_responsibility: "Property-level awareness, commitments, self notes, watch posture, and Captain Read preparation.",
    sphere_of_knowledge: "Property-scoped Data Pond evidence, governed memory, Expert Read references, and authorized regional summaries.",
    sphere_of_action: "Observe, remember responsibly, request verification, and prepare nonpublishing operational context.",
    sphere_of_memory: "Property awareness, self notes, commitments, human-submitted claims, and summary-level regional awareness.",
    visibility_scope: "property_team_visible",
    allowed_actions: ["create_self_note", "create_commitment", "build_memory_posture", "request_revalidation"],
    blocked_actions: ["publish_official_artifact", "mutate_data_pond_truth", "promote_memory_to_canonical_fact", "bypass_quartermaster", "bypass_fleet_scribe"],
    allowed_memory_classes: ["working_memory", "property_memory", "human_submitted_memory", "agent_self_note", "commitment_memory", "regional_awareness", "archived_memory"],
    blocked_memory_classes: ["doctrine"],
    authority_boundaries: ["Self notes are not canonical facts.", "Human input remains claim-level until governed.", "Fleet Scribe remains publication authority.", "Quartermaster remains blocking."],
    care_obligations: ["Do not overstate memory.", "Do not turn temporary problems into permanent identity.", "Do not score people.", "Always preserve correction and archive paths."],
    escalation_obligations: ["Escalate stale/conflicting source claims to Quartermaster.", "Escalate publishable artifact requests to Fleet Scribe."],
    steward_roles: ["Captain", "Commodore", "Quartermaster"],
    effective_date: nowISO().slice(0, 10),
    version: 1,
    approval_status: "approved",
  });
  return identity;
}

export async function getApprovedCharterForAgent(db: D1Database, agentId: string): Promise<AgentCharter | null> {
  await ensureAwarenessTables(db);
  const row = await queryFirst<any>(db, `SELECT * FROM awareness_agent_charters WHERE agent_id = ? AND approval_status = 'approved' ORDER BY version DESC LIMIT 1`, [agentId]);
  return row ? rowToCharter(row) : null;
}

export async function createMemoryItem(db: D1Database, input: Partial<MemoryItem> & Pick<MemoryItem, "memory_class" | "property_id" | "agent_id" | "source_type" | "statement">): Promise<MemoryItem> {
  await ensureAwarenessTables(db);
  const now = nowISO();
  const item: MemoryItem = {
    memory_id: input.memory_id ?? `memory_${newId()}`,
    memory_class: input.memory_class,
    lifecycle_state: input.lifecycle_state ?? "candidate",
    property_id: input.property_id ?? null,
    region_id: input.region_id ?? null,
    agent_id: input.agent_id,
    source_type: input.source_type,
    source_ref: input.source_ref ?? null,
    statement: input.statement,
    structured_claim: input.structured_claim ?? null,
    confidence: input.confidence ?? 0.5,
    freshness_state: input.freshness_state ?? "unknown",
    sensitivity: input.sensitivity ?? "internal",
    visibility_scope: input.visibility_scope ?? "property_team_visible",
    allowed_uses: input.allowed_uses ?? ["captain_reasoning", "historical_review"],
    blocked_uses: input.blocked_uses ?? ["public_copy", "report_publication"],
    steward: input.steward ?? input.agent_id,
    verification_required: input.verification_required ?? true,
    correction_path: input.correction_path ?? "Submit correction through Awareness Network governed correction path.",
    fresh_until: input.fresh_until ?? null,
    expires_at: input.expires_at ?? null,
    revalidation_due_at: input.revalidation_due_at ?? null,
    archived_at: input.archived_at ?? null,
    archived_reason: input.archived_reason ?? null,
    superseded_by: input.superseded_by ?? null,
    evidence_refs: input.evidence_refs ?? [],
    directive_refs: input.directive_refs ?? [],
    care_metadata: input.care_metadata ?? defaultCareMetadata(),
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };
  const errors = validateMemoryItem(item);
  if (errors.length) throw new Error(errors.join(" "));
  await run(db, `INSERT INTO awareness_memory_items (
    memory_id, memory_class, lifecycle_state, property_id, region_id, agent_id, source_type, source_ref,
    statement, structured_claim_json, confidence, freshness_state, sensitivity, visibility_scope,
    allowed_uses_json, blocked_uses_json, steward, verification_required, correction_path, fresh_until,
    expires_at, revalidation_due_at, archived_at, archived_reason, superseded_by, evidence_refs_json,
    directive_refs_json, care_metadata_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    item.memory_id,
    item.memory_class,
    item.lifecycle_state,
    item.property_id,
    item.region_id,
    item.agent_id,
    item.source_type,
    item.source_ref,
    item.statement,
    item.structured_claim ? JSON.stringify(item.structured_claim) : null,
    item.confidence,
    item.freshness_state,
    item.sensitivity,
    item.visibility_scope,
    JSON.stringify(item.allowed_uses),
    JSON.stringify(item.blocked_uses),
    item.steward,
    item.verification_required ? 1 : 0,
    item.correction_path,
    item.fresh_until,
    item.expires_at,
    item.revalidation_due_at,
    item.archived_at,
    item.archived_reason,
    item.superseded_by,
    JSON.stringify(item.evidence_refs),
    JSON.stringify(item.directive_refs),
    JSON.stringify(item.care_metadata),
    item.created_at,
    item.updated_at,
  ]);
  await auditAwarenessEvent(db, { event_type: "memory_item.created", actor: item.agent_id, agent_id: item.agent_id, property_id: item.property_id, region_id: item.region_id, memory_id: item.memory_id, action: "create_memory_item", after_state: item });
  return item;
}

export async function archiveMemoryItem(db: D1Database, memoryId: string, reason: string, actor = "system"): Promise<void> {
  await ensureAwarenessTables(db);
  const existing = await getMemoryItem(db, memoryId);
  if (!existing) throw new Error("Memory item not found.");
  const transitionError = validateLifecycleTransition(existing.lifecycle_state, "archived");
  if (transitionError) throw new Error(transitionError);
  const now = nowISO();
  await run(db, `UPDATE awareness_memory_items SET lifecycle_state = 'archived', archived_at = ?, archived_reason = ?, updated_at = ? WHERE memory_id = ?`, [now, reason, now, memoryId]);
  await run(db, `INSERT INTO awareness_memory_archives (archive_id, memory_id, archived_by, archived_reason, archived_at) VALUES (?, ?, ?, ?, ?)`, [`archive_${newId()}`, memoryId, actor, reason, now]);
  await auditAwarenessEvent(db, { event_type: "memory_item.archived", actor, agent_id: existing.agent_id, property_id: existing.property_id, region_id: existing.region_id, memory_id: memoryId, action: "archive_memory_item", before_state: existing, reason });
}

export async function expireMemoryItem(db: D1Database, memoryId: string, reason: string, actor = "system"): Promise<void> {
  await ensureAwarenessTables(db);
  const existing = await getMemoryItem(db, memoryId);
  if (!existing) throw new Error("Memory item not found.");
  const transitionError = validateLifecycleTransition(existing.lifecycle_state, "expired");
  if (transitionError) throw new Error(transitionError);
  const now = nowISO();
  await run(db, `UPDATE awareness_memory_items SET lifecycle_state = 'expired', freshness_state = 'expired', archived_reason = ?, updated_at = ? WHERE memory_id = ?`, [reason, now, memoryId]);
  await auditAwarenessEvent(db, { event_type: "memory_item.expired", actor, agent_id: existing.agent_id, property_id: existing.property_id, region_id: existing.region_id, memory_id: memoryId, action: "expire_memory_item", before_state: existing, reason });
}

export async function supersedeMemoryItem(db: D1Database, memoryId: string, supersededBy: string, reason: string, actor = "system"): Promise<void> {
  await ensureAwarenessTables(db);
  const existing = await getMemoryItem(db, memoryId);
  if (!existing) throw new Error("Memory item not found.");
  const replacement = await getMemoryItem(db, supersededBy);
  if (!replacement) throw new Error("Replacement memory item not found.");
  const transitionError = validateLifecycleTransition(existing.lifecycle_state, "superseded");
  if (transitionError) throw new Error(transitionError);
  const now = nowISO();
  await run(db, `UPDATE awareness_memory_items SET lifecycle_state = 'superseded', superseded_by = ?, archived_reason = ?, updated_at = ? WHERE memory_id = ?`, [supersededBy, reason, now, memoryId]);
  await run(db, `INSERT INTO awareness_memory_links (link_id, source_memory_id, target_ref_type, target_ref, link_type, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [`memory_link_${newId()}`, memoryId, "memory", supersededBy, "superseded_by", now]);
  await auditAwarenessEvent(db, { event_type: "memory_item.superseded", actor, agent_id: existing.agent_id, property_id: existing.property_id, region_id: existing.region_id, memory_id: memoryId, action: "supersede_memory_item", before_state: existing, after_state: { superseded_by: supersededBy }, reason });
}

export async function createMemoryCorrection(db: D1Database, input: {
  memory_id: string;
  actor: string;
  correction_text: string;
  status?: "submitted" | "accepted" | "rejected" | "archived";
}): Promise<{ correction_id: string; memory_id: string; actor: string; correction_text: string; status: string; created_at: string }> {
  await ensureAwarenessTables(db);
  const existing = await getMemoryItem(db, input.memory_id);
  if (!existing) throw new Error("Memory item not found.");
  if (!input.correction_text.trim()) throw new Error("Correction text is required.");
  const correction = {
    correction_id: `memory_correction_${newId()}`,
    memory_id: input.memory_id,
    actor: input.actor,
    correction_text: input.correction_text,
    status: input.status ?? "submitted",
    created_at: nowISO(),
  };
  await run(db, `INSERT INTO awareness_memory_corrections (correction_id, memory_id, actor, correction_text, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [
    correction.correction_id,
    correction.memory_id,
    correction.actor,
    correction.correction_text,
    correction.status,
    correction.created_at,
  ]);
  await auditAwarenessEvent(db, { event_type: "memory_item.corrected", actor: input.actor, agent_id: existing.agent_id, property_id: existing.property_id, region_id: existing.region_id, memory_id: input.memory_id, action: "create_memory_correction", before_state: existing, after_state: correction });
  return correction;
}

export async function getMemoryItem(db: D1Database, memoryId: string): Promise<MemoryItem | null> {
  await ensureAwarenessTables(db);
  const row = await queryFirst<any>(db, `SELECT * FROM awareness_memory_items WHERE memory_id = ?`, [memoryId]);
  return row ? rowToMemory(row) : null;
}

export async function listMemoryForProperty(db: D1Database, propertyId: string, includeArchived = false): Promise<MemoryItem[]> {
  await ensureAwarenessTables(db);
  const rows = await queryAll<any>(
    db,
    `SELECT * FROM awareness_memory_items WHERE property_id = ? ${includeArchived ? "" : "AND lifecycle_state NOT IN ('archived', 'expired', 'rejected')"} ORDER BY updated_at DESC LIMIT 100`,
    [propertyId]
  );
  return rows.map(rowToMemory);
}

export async function createSelfNote(db: D1Database, input: {
  agent_id: string;
  property_id?: string | null;
  region_id?: string | null;
  note_text: string;
  note_type?: SelfNoteType;
  importance?: number;
  visibility?: MemoryVisibilityScope;
  reminder_at?: string | null;
  expires_at?: string | null;
  source_context?: string | null;
  related_memory_id?: string | null;
  related_interaction_id?: string | null;
  related_expert_read_id?: string | null;
  care_metadata?: CareMetadata;
  actor?: string | null;
}): Promise<AgentSelfNote> {
  await ensureAwarenessTables(db);
  const note: AgentSelfNote = {
    note_id: `self_note_${newId()}`,
    agent_id: input.agent_id,
    property_id: input.property_id ?? null,
    region_id: input.region_id ?? null,
    note_text: input.note_text,
    note_type: input.note_type ?? "reminder",
    importance: input.importance ?? 3,
    visibility: input.visibility ?? "private_to_agent",
    reminder_at: input.reminder_at ?? null,
    expires_at: input.expires_at ?? null,
    archived_at: null,
    source_context: input.source_context ?? null,
    related_memory_id: input.related_memory_id ?? null,
    related_interaction_id: input.related_interaction_id ?? null,
    related_expert_read_id: input.related_expert_read_id ?? null,
    care_metadata: input.care_metadata ?? defaultCareMetadata({ ask_before_public_use: true }),
    created_at: nowISO(),
  };
  const errors = validateSelfNote(note);
  if (errors.length) {
    await auditAwarenessEvent(db, {
      event_type: "self_note.rejected",
      actor: input.actor ?? input.agent_id,
      agent_id: note.agent_id,
      property_id: note.property_id,
      region_id: note.region_id,
      action: "reject_self_note",
      after_state: { note_type: note.note_type, visibility: note.visibility, errors },
      reason: errors.join(" "),
      care_rule_triggered: "self_note_validation",
    });
    throw new Error(errors.join(" "));
  }
  await run(db, `INSERT INTO awareness_self_notes (
    note_id, agent_id, property_id, region_id, note_text, note_type, importance, visibility, reminder_at,
    expires_at, archived_at, source_context, related_memory_id, related_interaction_id, related_expert_read_id,
    care_metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    note.note_id,
    note.agent_id,
    note.property_id,
    note.region_id,
    note.note_text,
    note.note_type,
    note.importance,
    note.visibility,
    note.reminder_at,
    note.expires_at,
    note.archived_at,
    note.source_context,
    note.related_memory_id,
    note.related_interaction_id,
    note.related_expert_read_id,
    JSON.stringify(note.care_metadata),
    note.created_at,
  ]);
  await auditAwarenessEvent(db, { event_type: "self_note.created", actor: input.actor ?? input.agent_id, agent_id: note.agent_id, property_id: note.property_id, region_id: note.region_id, note_id: note.note_id, action: "create_self_note", after_state: note });
  return note;
}

export async function archiveSelfNote(db: D1Database, noteId: string, actor = "system"): Promise<void> {
  await ensureAwarenessTables(db);
  const existing = await getSelfNote(db, noteId);
  if (!existing) throw new Error("Self note not found.");
  await run(db, `UPDATE awareness_self_notes SET archived_at = ? WHERE note_id = ?`, [nowISO(), noteId]);
  await auditAwarenessEvent(db, { event_type: "self_note.archived", actor, agent_id: existing.agent_id, property_id: existing.property_id, region_id: existing.region_id, note_id: noteId, action: "archive_self_note", before_state: existing });
}

export async function getSelfNote(db: D1Database, noteId: string): Promise<AgentSelfNote | null> {
  await ensureAwarenessTables(db);
  const row = await queryFirst<any>(db, `SELECT * FROM awareness_self_notes WHERE note_id = ?`, [noteId]);
  return row ? rowToSelfNote(row) : null;
}

export async function listSelfNotesForProperty(db: D1Database, propertyId: string): Promise<AgentSelfNote[]> {
  await ensureAwarenessTables(db);
  const rows = await queryAll<any>(db, `SELECT * FROM awareness_self_notes WHERE property_id = ? AND archived_at IS NULL ORDER BY importance DESC, created_at DESC LIMIT 50`, [propertyId]);
  return rows.map(rowToSelfNote);
}

export async function createCommitment(db: D1Database, input: {
  agent_id: string;
  property_id?: string | null;
  region_id?: string | null;
  commitment_type: string;
  description: string;
  owed_by: string;
  owed_to: string;
  due_at?: string | null;
  status?: CommitmentStatus;
  source_ref?: string | null;
  related_memory_id?: string | null;
  related_interaction_id?: string | null;
  related_expert_read_id?: string | null;
  care_metadata?: CareMetadata;
  actor?: string | null;
}): Promise<CommitmentMemory> {
  await ensureAwarenessTables(db);
  if (!input.description.trim()) throw new Error("Commitment description is required.");
  if (BLAME_COMMITMENT_PATTERNS.some((pattern) => pattern.test(input.description))) {
    await auditAwarenessEvent(db, {
      event_type: "commitment.rejected",
      actor: input.actor ?? input.agent_id,
      agent_id: input.agent_id,
      property_id: input.property_id ?? null,
      region_id: input.region_id ?? null,
      action: "reject_commitment",
      after_state: { commitment_type: input.commitment_type },
      reason: "Commitments must track open loops without blame or people scoring.",
      care_rule_triggered: "commitment_blame_language",
    });
    throw new Error("Commitments must track open loops without blame or people scoring.");
  }
  const now = nowISO();
  const commitment: CommitmentMemory = {
    commitment_id: `commitment_${newId()}`,
    agent_id: input.agent_id,
    property_id: input.property_id ?? null,
    region_id: input.region_id ?? null,
    commitment_type: input.commitment_type,
    description: input.description,
    owed_by: input.owed_by,
    owed_to: input.owed_to,
    due_at: input.due_at ?? null,
    status: input.status ?? "open",
    source_ref: input.source_ref ?? null,
    related_memory_id: input.related_memory_id ?? null,
    related_interaction_id: input.related_interaction_id ?? null,
    related_expert_read_id: input.related_expert_read_id ?? null,
    care_metadata: input.care_metadata ?? defaultCareMetadata({ temporary_context: true }),
    created_at: now,
    updated_at: now,
  };
  await run(db, `INSERT INTO awareness_commitments (
    commitment_id, agent_id, property_id, region_id, commitment_type, description, owed_by, owed_to, due_at,
    status, source_ref, related_memory_id, related_interaction_id, related_expert_read_id, care_metadata_json,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    commitment.commitment_id,
    commitment.agent_id,
    commitment.property_id,
    commitment.region_id,
    commitment.commitment_type,
    commitment.description,
    commitment.owed_by,
    commitment.owed_to,
    commitment.due_at,
    commitment.status,
    commitment.source_ref,
    commitment.related_memory_id,
    commitment.related_interaction_id,
    commitment.related_expert_read_id,
    JSON.stringify(commitment.care_metadata),
    commitment.created_at,
    commitment.updated_at,
  ]);
  await auditAwarenessEvent(db, { event_type: "commitment.created", actor: input.actor ?? input.agent_id, agent_id: commitment.agent_id, property_id: commitment.property_id, region_id: commitment.region_id, commitment_id: commitment.commitment_id, action: "create_commitment", after_state: commitment });
  return commitment;
}

export async function updateCommitmentStatus(db: D1Database, commitmentId: string, status: CommitmentStatus, actor = "system"): Promise<void> {
  await ensureAwarenessTables(db);
  const before = await getCommitment(db, commitmentId);
  if (!before) throw new Error("Commitment not found.");
  await run(db, `UPDATE awareness_commitments SET status = ?, updated_at = ? WHERE commitment_id = ?`, [status, nowISO(), commitmentId]);
  await auditAwarenessEvent(db, { event_type: `commitment.${status}`, actor, agent_id: before.agent_id, property_id: before.property_id, region_id: before.region_id, commitment_id: commitmentId, action: "update_commitment_status", before_state: before, after_state: { status } });
}

export async function getCommitment(db: D1Database, commitmentId: string): Promise<CommitmentMemory | null> {
  await ensureAwarenessTables(db);
  const row = await queryFirst<any>(db, `SELECT * FROM awareness_commitments WHERE commitment_id = ?`, [commitmentId]);
  return row ? rowToCommitment(row) : null;
}

export async function listCommitmentsForProperty(db: D1Database, propertyId: string): Promise<CommitmentMemory[]> {
  await ensureAwarenessTables(db);
  const rows = await queryAll<any>(db, `SELECT * FROM awareness_commitments WHERE property_id = ? AND status IN ('open', 'waiting', 'blocked') ORDER BY due_at ASC, created_at DESC LIMIT 50`, [propertyId]);
  return rows.map(rowToCommitment);
}

export async function createRegionalAwarenessSummary(db: D1Database, input: Omit<RegionalAwarenessSummary, "summary_id" | "generated_at">): Promise<RegionalAwarenessSummary> {
  await ensureAwarenessTables(db);
  const summary: RegionalAwarenessSummary = { ...input, summary_id: `regional_awareness_${newId()}`, generated_at: nowISO() };
  await run(db, `INSERT INTO awareness_regional_summaries (
    summary_id, region_id, generated_at, summary_period, steward_agent_id, source_property_count,
    pattern_summary, sibling_property_cards_json, market_context, shared_risks_json, successful_tactics_json,
    cautionary_notes_json, evidence_refs_json, visibility_scope, freshness_state, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    summary.summary_id,
    summary.region_id,
    summary.generated_at,
    summary.summary_period,
    summary.steward_agent_id,
    summary.source_property_count,
    summary.pattern_summary,
    JSON.stringify(summary.sibling_property_cards),
    summary.market_context,
    JSON.stringify(summary.shared_risks),
    JSON.stringify(summary.successful_tactics),
    JSON.stringify(summary.cautionary_notes),
    JSON.stringify(summary.evidence_refs),
    summary.visibility_scope,
    summary.freshness_state,
    summary.expires_at,
  ]);
  await auditAwarenessEvent(db, { event_type: "regional_awareness.generated", actor: summary.steward_agent_id, agent_id: summary.steward_agent_id, region_id: summary.region_id, action: "create_regional_awareness_summary", after_state: summary });
  return summary;
}

export async function getRegionalAwarenessSummary(db: D1Database, regionId: string): Promise<RegionalAwarenessSummary | null> {
  await ensureAwarenessTables(db);
  const row = await queryFirst<any>(db, `SELECT * FROM awareness_regional_summaries WHERE region_id = ? ORDER BY generated_at DESC LIMIT 1`, [regionId]);
  return row ? rowToRegionalSummary(row) : null;
}

export async function createDoctrineCandidate(db: D1Database, input: Omit<DoctrineCandidate, "doctrine_candidate_id" | "created_at">): Promise<DoctrineCandidate> {
  await ensureAwarenessTables(db);
  if (input.supporting_memory_refs.length + input.supporting_evidence_refs.length < 2) {
    throw new Error("Doctrine candidates need more than one supporting memory/evidence reference.");
  }
  const candidate: DoctrineCandidate = { ...input, doctrine_candidate_id: `doctrine_candidate_${newId()}`, created_at: nowISO() };
  await run(db, `INSERT INTO awareness_doctrine_candidates (
    doctrine_candidate_id, title, pattern_statement, source_scope, supporting_memory_refs_json,
    supporting_evidence_refs_json, confidence, proposed_by_agent_id, steward_agent_id, status,
    care_review_required, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    candidate.doctrine_candidate_id,
    candidate.title,
    candidate.pattern_statement,
    candidate.source_scope,
    JSON.stringify(candidate.supporting_memory_refs),
    JSON.stringify(candidate.supporting_evidence_refs),
    candidate.confidence,
    candidate.proposed_by_agent_id,
    candidate.steward_agent_id,
    candidate.status,
    candidate.care_review_required ? 1 : 0,
    candidate.created_at,
  ]);
  await auditAwarenessEvent(db, { event_type: "doctrine_candidate.proposed", actor: candidate.proposed_by_agent_id, agent_id: candidate.proposed_by_agent_id, action: "create_doctrine_candidate", after_state: candidate });
  return candidate;
}

export async function buildMemoryPosture(db: D1Database, propertyId: string): Promise<MemoryPosture> {
  await ensureAwarenessTables(db);
  const agent = await getAgentForProperty(db, propertyId);
  const memories = await listMemoryForProperty(db, propertyId, true);
  const notes = await listSelfNotesForProperty(db, propertyId);
  const commitments = await listCommitmentsForProperty(db, propertyId);
  const regional = agent?.assigned_region_id ? await getRegionalAwarenessSummary(db, agent.assigned_region_id) : null;
  const now = nowISO();
  const active = memories.filter((memory) => !["archived", "expired", "rejected", "superseded"].includes(memory.lifecycle_state));
  return {
    agent_identity: agent,
    active_concerns: active.filter((memory) => memory.memory_class === "working_memory" || memory.memory_class === "property_memory").slice(0, 10),
    open_questions: notes.filter((note) => note.note_type === "open_question"),
    active_self_notes: notes,
    open_commitments: commitments,
    recent_human_submitted_claims: active.filter((memory) => memory.memory_class === "human_submitted_memory").slice(0, 10),
    stale_or_expiring_memory: active.filter((memory) => memory.freshness_state === "stale" || (!!memory.expires_at && memory.expires_at <= now)).slice(0, 10),
    verification_needed_items: [...active.filter((memory) => memory.verification_required), ...notes.filter((note) => note.note_type === "verification_needed")].slice(0, 15),
    unresolved_conflicts: active.filter((memory) => memory.freshness_state === "unknown" && memory.verification_required).slice(0, 10),
    recent_lessons: notes.filter((note) => note.note_type === "lesson").slice(0, 10),
    archived_superseded_highlights: memories.filter((memory) => ["archived", "superseded"].includes(memory.lifecycle_state)).slice(0, 10),
    regional_awareness_summary: regional,
    uncertainties: active.filter((memory) => memory.confidence < 0.7 || memory.verification_required).slice(0, 5).map((memory) => memory.statement),
    do_not_recommend_without_more_evidence: [
      ...active.filter((memory) => memory.blocked_uses.includes("public_copy") || memory.blocked_uses.includes("report_publication")).slice(0, 5).map((memory) => memory.statement),
      "Do not use self notes as publishable evidence.",
    ],
    care_warnings: Array.from(new Set(active.flatMap((memory) => {
      const warnings: string[] = [];
      if (memory.care_metadata.do_not_overstate) warnings.push("Do not overstate memory.");
      if (memory.care_metadata.share_as_pattern_only) warnings.push("Share pattern upward, not raw local detail.");
      if (memory.care_metadata.sensitive_context) warnings.push("Sensitive memory requires tighter visibility.");
      return warnings;
    }))).slice(0, 8),
  };
}

export function rowToMemory(row: any): MemoryItem {
  return {
    memory_id: row.memory_id,
    memory_class: row.memory_class,
    lifecycle_state: row.lifecycle_state,
    property_id: row.property_id,
    region_id: row.region_id,
    agent_id: row.agent_id,
    source_type: row.source_type,
    source_ref: row.source_ref,
    statement: row.statement,
    structured_claim: parseJson(row.structured_claim_json, null),
    confidence: Number(row.confidence),
    freshness_state: row.freshness_state,
    sensitivity: row.sensitivity,
    visibility_scope: row.visibility_scope,
    allowed_uses: parseJson(row.allowed_uses_json, []),
    blocked_uses: parseJson(row.blocked_uses_json, []),
    steward: row.steward,
    verification_required: Number(row.verification_required) === 1,
    correction_path: row.correction_path,
    fresh_until: row.fresh_until,
    expires_at: row.expires_at,
    revalidation_due_at: row.revalidation_due_at,
    archived_at: row.archived_at,
    archived_reason: row.archived_reason,
    superseded_by: row.superseded_by,
    evidence_refs: parseJson(row.evidence_refs_json, []),
    directive_refs: parseJson(row.directive_refs_json, []),
    care_metadata: parseJson(row.care_metadata_json, defaultCareMetadata()),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToSelfNote(row: any): AgentSelfNote {
  return {
    note_id: row.note_id,
    agent_id: row.agent_id,
    property_id: row.property_id,
    region_id: row.region_id,
    note_text: row.note_text,
    note_type: row.note_type,
    importance: Number(row.importance),
    visibility: row.visibility,
    reminder_at: row.reminder_at,
    expires_at: row.expires_at,
    archived_at: row.archived_at,
    source_context: row.source_context,
    related_memory_id: row.related_memory_id,
    related_interaction_id: row.related_interaction_id,
    related_expert_read_id: row.related_expert_read_id,
    care_metadata: parseJson(row.care_metadata_json, defaultCareMetadata()),
    created_at: row.created_at,
  };
}

function rowToCommitment(row: any): CommitmentMemory {
  return {
    commitment_id: row.commitment_id,
    agent_id: row.agent_id,
    property_id: row.property_id,
    region_id: row.region_id,
    commitment_type: row.commitment_type,
    description: row.description,
    owed_by: row.owed_by,
    owed_to: row.owed_to,
    due_at: row.due_at,
    status: row.status,
    source_ref: row.source_ref,
    related_memory_id: row.related_memory_id,
    related_interaction_id: row.related_interaction_id,
    related_expert_read_id: row.related_expert_read_id,
    care_metadata: parseJson(row.care_metadata_json, defaultCareMetadata()),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToCharter(row: any): AgentCharter {
  return {
    charter_id: row.charter_id,
    agent_id: row.agent_id,
    sphere_of_responsibility: row.sphere_of_responsibility,
    sphere_of_knowledge: row.sphere_of_knowledge,
    sphere_of_action: row.sphere_of_action,
    sphere_of_memory: row.sphere_of_memory,
    visibility_scope: row.visibility_scope,
    allowed_actions: parseJson(row.allowed_actions_json, []),
    blocked_actions: parseJson(row.blocked_actions_json, []),
    allowed_memory_classes: parseJson(row.allowed_memory_classes_json, []),
    blocked_memory_classes: parseJson(row.blocked_memory_classes_json, []),
    authority_boundaries: parseJson(row.authority_boundaries_json, []),
    care_obligations: parseJson(row.care_obligations_json, []),
    escalation_obligations: parseJson(row.escalation_obligations_json, []),
    steward_roles: parseJson(row.steward_roles_json, []),
    effective_date: row.effective_date,
    version: Number(row.version),
    approval_status: row.approval_status,
  };
}

function rowToRegionalSummary(row: any): RegionalAwarenessSummary {
  return {
    summary_id: row.summary_id,
    region_id: row.region_id,
    generated_at: row.generated_at,
    summary_period: row.summary_period,
    steward_agent_id: row.steward_agent_id,
    source_property_count: Number(row.source_property_count),
    pattern_summary: row.pattern_summary,
    sibling_property_cards: parseJson(row.sibling_property_cards_json, []),
    market_context: row.market_context,
    shared_risks: parseJson(row.shared_risks_json, []),
    successful_tactics: parseJson(row.successful_tactics_json, []),
    cautionary_notes: parseJson(row.cautionary_notes_json, []),
    evidence_refs: parseJson(row.evidence_refs_json, []),
    visibility_scope: row.visibility_scope,
    freshness_state: row.freshness_state,
    expires_at: row.expires_at,
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
