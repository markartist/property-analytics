import { queryAll, queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { DirectiveProfile, DirectiveProfileRow, DirectiveVersionRow } from "./types";
import { sha256Hex } from "./hashing";

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function arr(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function obj<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function versionRowToDirective(profile: DirectiveProfileRow, version: DirectiveVersionRow): DirectiveProfile {
  return {
    role_id: profile.role_id,
    role_name: profile.role_name,
    office_type: profile.office_type,
    plain_role: profile.plain_role ?? "",
    purpose: version.purpose,
    decision_questions: arr(version.decision_questions_json),
    primary_sources: arr(version.primary_sources_json),
    advisory_sources: arr(version.advisory_sources_json),
    output_contract: version.output_contract,
    current_directive_setting: version.current_directive_setting,
    hard_guardrails: arr(version.hard_guardrails_json),
    do_not_allow_rules: arr(version.do_not_allow_rules_json),
    required_evidence: arr(version.required_evidence_json),
    confidence_thresholds: obj(version.confidence_thresholds_json),
    freshness_tolerance: obj(version.freshness_tolerance_json),
    escalation_triggers: arr(version.escalation_triggers_json),
    publication_permissions: obj(version.publication_permissions_json),
    external_communication_permissions: obj(version.external_communication_permissions_json),
    report_family_applicability: arr(version.report_family_applicability_json),
    active_status: profile.active_status,
    owner: profile.owner,
    version: Number(version.version),
    effective_date: version.effective_date,
    retired_date: version.retired_date,
    change_reason: version.change_reason,
    approval_status: version.approval_status,
    approved_by: version.approved_by,
    approved_at: version.approved_at,
  };
}

export async function ensureDirectiveTables(db: D1Database): Promise<void> {
  await run(db, `CREATE TABLE IF NOT EXISTS directive_profiles (
    profile_id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL UNIQUE,
    role_name TEXT NOT NULL,
    office_type TEXT NOT NULL,
    plain_role TEXT,
    owner TEXT NOT NULL,
    active_status TEXT NOT NULL,
    current_active_version_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_versions (
    version_id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    approval_status TEXT NOT NULL,
    purpose TEXT NOT NULL,
    decision_questions_json TEXT NOT NULL,
    primary_sources_json TEXT NOT NULL,
    advisory_sources_json TEXT NOT NULL,
    output_contract TEXT NOT NULL,
    current_directive_setting TEXT NOT NULL,
    hard_guardrails_json TEXT NOT NULL,
    do_not_allow_rules_json TEXT NOT NULL,
    required_evidence_json TEXT NOT NULL,
    confidence_thresholds_json TEXT NOT NULL,
    freshness_tolerance_json TEXT NOT NULL,
    escalation_triggers_json TEXT NOT NULL,
    publication_permissions_json TEXT NOT NULL,
    external_communication_permissions_json TEXT NOT NULL,
    report_family_applicability_json TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    retired_date TEXT,
    change_reason TEXT NOT NULL,
    approved_by TEXT,
    approved_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    metadata_json TEXT,
    directive_hash TEXT,
    UNIQUE(profile_id, version)
  )`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_directive_versions_one_active ON directive_versions(profile_id) WHERE approval_status = 'active'`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_change_requests (
    request_id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    draft_version_id TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    risk_flags_json TEXT NOT NULL,
    status TEXT NOT NULL,
    submitted_at TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_approval_events (
    approval_event_id TEXT PRIMARY KEY,
    request_id TEXT,
    profile_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    reason TEXT NOT NULL,
    event_at TEXT NOT NULL,
    before_snapshot_json TEXT,
    after_snapshot_json TEXT
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_runtime_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    runtime_mode TEXT NOT NULL,
    property_id TEXT,
    report_family TEXT,
    as_of_date TEXT NOT NULL,
    directive_snapshot_json TEXT NOT NULL,
    validation_status_json TEXT NOT NULL,
    snapshot_hash TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_validation_results (
    validation_result_id TEXT PRIMARY KEY,
    profile_id TEXT,
    version_id TEXT,
    role_id TEXT,
    validation_status TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    blocking_errors_json TEXT NOT NULL,
    recommended_fixes_json TEXT NOT NULL,
    validated_by TEXT NOT NULL,
    validated_at TEXT NOT NULL,
    runtime_context_json TEXT
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_simulation_results (
    simulation_result_id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    scenario_key TEXT NOT NULL,
    runtime_mode TEXT NOT NULL,
    report_family TEXT,
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS directive_audit_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    role_id TEXT,
    directive_version INTEGER,
    profile_id TEXT,
    version_id TEXT,
    actor TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT,
    before_snapshot_json TEXT,
    after_snapshot_json TEXT,
    runtime_context_json TEXT,
    request_id TEXT,
    correlation_id TEXT
  )`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_directive_versions_role_status ON directive_versions(role_id, approval_status, version DESC)`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_directive_versions_one_submitted ON directive_versions(profile_id) WHERE approval_status = 'submitted_for_review'`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_directive_versions_one_draft ON directive_versions(profile_id) WHERE approval_status = 'draft'`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_directive_versions_no_content_update_after_draft
    BEFORE UPDATE ON directive_versions
    WHEN OLD.approval_status <> 'draft' AND (
      OLD.purpose <> NEW.purpose OR
      OLD.decision_questions_json <> NEW.decision_questions_json OR
      OLD.primary_sources_json <> NEW.primary_sources_json OR
      OLD.advisory_sources_json <> NEW.advisory_sources_json OR
      OLD.output_contract <> NEW.output_contract OR
      OLD.current_directive_setting <> NEW.current_directive_setting OR
      OLD.hard_guardrails_json <> NEW.hard_guardrails_json OR
      OLD.do_not_allow_rules_json <> NEW.do_not_allow_rules_json OR
      OLD.required_evidence_json <> NEW.required_evidence_json OR
      OLD.confidence_thresholds_json <> NEW.confidence_thresholds_json OR
      OLD.freshness_tolerance_json <> NEW.freshness_tolerance_json OR
      OLD.escalation_triggers_json <> NEW.escalation_triggers_json OR
      OLD.publication_permissions_json <> NEW.publication_permissions_json OR
      OLD.external_communication_permissions_json <> NEW.external_communication_permissions_json OR
      OLD.report_family_applicability_json <> NEW.report_family_applicability_json OR
      OLD.effective_date <> NEW.effective_date OR
      OLD.directive_hash <> NEW.directive_hash
    )
    BEGIN
      SELECT RAISE(ABORT, 'Directive content is immutable after draft state.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_directive_runtime_snapshots_immutable
    BEFORE UPDATE ON directive_runtime_snapshots
    BEGIN
      SELECT RAISE(ABORT, 'Directive runtime snapshots are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_directive_runtime_snapshots_no_delete
    BEFORE DELETE ON directive_runtime_snapshots
    BEGIN
      SELECT RAISE(ABORT, 'Directive runtime snapshots cannot be deleted.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_directive_audit_events_immutable
    BEFORE UPDATE ON directive_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Directive audit events are immutable.');
    END`);
  await run(db, `CREATE TRIGGER IF NOT EXISTS trg_directive_audit_events_no_delete
    BEFORE DELETE ON directive_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'Directive audit events cannot be deleted.');
    END`);
}

export async function writeDirectiveAuditEvent(
  db: D1Database,
  input: {
    eventType: string;
    roleId?: string | null;
    directiveVersion?: number | null;
    profileId?: string | null;
    versionId?: string | null;
    actor: string;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
    runtimeContext?: unknown;
    requestId?: string | null;
    correlationId?: string | null;
  }
) {
  await run(
    db,
    `INSERT INTO directive_audit_events (
      event_id, event_type, role_id, directive_version, profile_id, version_id,
      actor, timestamp, reason, before_snapshot_json, after_snapshot_json, runtime_context_json,
      request_id, correlation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.eventType,
      input.roleId ?? null,
      input.directiveVersion ?? null,
      input.profileId ?? null,
      input.versionId ?? null,
      input.actor,
      nowISO(),
      input.reason ?? null,
      input.before === undefined ? null : json(input.before),
      input.after === undefined ? null : json(input.after),
      input.runtimeContext === undefined ? null : json(input.runtimeContext),
      input.requestId ?? null,
      input.correlationId ?? null,
    ]
  );
}

export async function getDirectiveProfileRow(db: D1Database, roleId: string): Promise<DirectiveProfileRow | null> {
  await ensureDirectiveTables(db);
  return queryFirst<DirectiveProfileRow>(db, `SELECT * FROM directive_profiles WHERE role_id = ?`, [roleId]);
}

export async function getDirectiveVersionRow(db: D1Database, versionId: string): Promise<DirectiveVersionRow | null> {
  await ensureDirectiveTables(db);
  return queryFirst<DirectiveVersionRow>(db, `SELECT * FROM directive_versions WHERE version_id = ?`, [versionId]);
}

export async function listDirectiveProfiles(db: D1Database): Promise<Array<{ profile: DirectiveProfileRow; activeVersion: DirectiveVersionRow | null }>> {
  await ensureDirectiveTables(db);
  const rows = await queryAll<DirectiveProfileRow>(db, `SELECT * FROM directive_profiles ORDER BY office_type, role_name`);
  const out = [];
  for (const profile of rows) {
    const activeVersion = profile.current_active_version_id
      ? await getDirectiveVersionRow(db, profile.current_active_version_id)
      : await queryFirst<DirectiveVersionRow>(db, `SELECT * FROM directive_versions WHERE profile_id = ? AND approval_status = 'active' ORDER BY version DESC LIMIT 1`, [profile.profile_id]);
    out.push({ profile, activeVersion });
  }
  return out;
}

export async function getActiveDirective(db: D1Database, roleId: string): Promise<{ profile: DirectiveProfileRow; version: DirectiveVersionRow; directive: DirectiveProfile } | null> {
  const profile = await getDirectiveProfileRow(db, roleId);
  if (!profile) return null;
  const version = await queryFirst<DirectiveVersionRow>(
    db,
    `SELECT * FROM directive_versions
     WHERE profile_id = ? AND approval_status = 'active'
     ORDER BY version DESC
     LIMIT 1`,
    [profile.profile_id]
  );
  if (!version) return null;
  return { profile, version, directive: versionRowToDirective(profile, version) };
}

export async function getDirectiveVersionByStatus(
  db: D1Database,
  roleId: string,
  status: string
): Promise<{ profile: DirectiveProfileRow; version: DirectiveVersionRow; directive: DirectiveProfile } | null> {
  const profile = await getDirectiveProfileRow(db, roleId);
  if (!profile) return null;
  const version = await queryFirst<DirectiveVersionRow>(
    db,
    `SELECT * FROM directive_versions
     WHERE profile_id = ? AND approval_status = ?
     ORDER BY version DESC
     LIMIT 1`,
    [profile.profile_id, status]
  );
  if (!version) return null;
  return { profile, version, directive: versionRowToDirective(profile, version) };
}

export async function upsertSeedDirective(db: D1Database, directive: DirectiveProfile): Promise<void> {
  await ensureDirectiveTables(db);
  const now = nowISO();
  const profileId = `directive_profile_${directive.role_id}`;
  const existing = await getDirectiveProfileRow(db, directive.role_id);
  if (!existing) {
    await run(
      db,
      `INSERT INTO directive_profiles (
        profile_id, role_id, role_name, office_type, plain_role, owner, active_status,
        current_active_version_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [profileId, directive.role_id, directive.role_name, directive.office_type, directive.plain_role, directive.owner, directive.active_status, now, now]
    );
  }
  const active = await getActiveDirective(db, directive.role_id);
  if (active) return;
  const versionId = `directive_version_${directive.role_id}_v${directive.version}`;
  await run(
    db,
    `INSERT OR IGNORE INTO directive_versions (
      version_id, profile_id, role_id, version, approval_status, purpose,
      decision_questions_json, primary_sources_json, advisory_sources_json,
      output_contract, current_directive_setting, hard_guardrails_json, do_not_allow_rules_json,
      required_evidence_json, confidence_thresholds_json, freshness_tolerance_json,
      escalation_triggers_json, publication_permissions_json, external_communication_permissions_json,
      report_family_applicability_json, effective_date, retired_date, change_reason, approved_by,
      approved_at, created_by, created_at, updated_at, metadata_json, directive_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      profileId,
      directive.role_id,
      directive.version,
      "active",
      directive.purpose,
      json(directive.decision_questions),
      json(directive.primary_sources),
      json(directive.advisory_sources),
      directive.output_contract,
      directive.current_directive_setting,
      json(directive.hard_guardrails),
      json(directive.do_not_allow_rules),
      json(directive.required_evidence),
      json(directive.confidence_thresholds),
      json(directive.freshness_tolerance),
      json(directive.escalation_triggers),
      json(directive.publication_permissions),
      json(directive.external_communication_permissions),
      json(directive.report_family_applicability),
      directive.effective_date,
      directive.retired_date,
      directive.change_reason,
      directive.approved_by,
      directive.approved_at,
      "directive_seed",
      now,
      now,
      json({ seeded_from: "FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md" }),
      await sha256Hex(directive),
    ]
  );
  await run(
    db,
    `UPDATE directive_profiles SET current_active_version_id = ?, updated_at = ? WHERE role_id = ?`,
    [versionId, now, directive.role_id]
  );
  await writeDirectiveAuditEvent(db, {
    eventType: "directive.created",
    roleId: directive.role_id,
    directiveVersion: directive.version,
    profileId,
    versionId,
    actor: "directive_seed",
    reason: directive.change_reason,
    after: directive,
  });
}

export async function seedCurrentDirectives(db: D1Database, directives: DirectiveProfile[]): Promise<{ seeded: number }> {
  let seeded = 0;
  for (const directive of directives) {
    const before = await getActiveDirective(db, directive.role_id);
    await upsertSeedDirective(db, directive);
    if (!before) seeded += 1;
  }
  return { seeded };
}

export async function createDraftVersion(
  db: D1Database,
  roleId: string,
  patch: Partial<DirectiveProfile>,
  actor: string,
  changeReason: string
) {
  await ensureDirectiveTables(db);
  if (!changeReason.trim()) throw new Error("Every directive change requires a reason.");
  const active = await getActiveDirective(db, roleId);
  if (!active) throw new Error(`No active directive found for ${roleId}`);
  const openVersion = await queryFirst<DirectiveVersionRow>(
    db,
    `SELECT * FROM directive_versions
     WHERE profile_id = ? AND approval_status IN ('draft', 'submitted_for_review')
     ORDER BY version DESC LIMIT 1`,
    [active.profile.profile_id]
  );
  if (openVersion) {
    throw new Error("An open draft or submitted directive already exists for this role. Resolve it before creating another draft.");
  }
  const maxVersion = await queryFirst<{ max_version: number }>(
    db,
    `SELECT MAX(version) AS max_version FROM directive_versions WHERE profile_id = ?`,
    [active.profile.profile_id]
  );
  const nextVersion = Number(maxVersion?.max_version ?? active.version.version) + 1;
  const merged: DirectiveProfile = {
    ...active.directive,
    ...patch,
    role_id: active.directive.role_id,
    role_name: patch.role_name ?? active.directive.role_name,
    office_type: patch.office_type ?? active.directive.office_type,
    active_status: active.directive.active_status,
    approval_status: "draft",
    version: nextVersion,
    change_reason: changeReason,
    approved_by: null,
    approved_at: null,
  };
  const now = nowISO();
  const versionId = `directive_version_${roleId}_v${nextVersion}_${newId().slice(0, 8)}`;
  await run(
    db,
    `INSERT INTO directive_versions (
      version_id, profile_id, role_id, version, approval_status, purpose,
      decision_questions_json, primary_sources_json, advisory_sources_json,
      output_contract, current_directive_setting, hard_guardrails_json, do_not_allow_rules_json,
      required_evidence_json, confidence_thresholds_json, freshness_tolerance_json,
      escalation_triggers_json, publication_permissions_json, external_communication_permissions_json,
      report_family_applicability_json, effective_date, retired_date, change_reason, approved_by,
      approved_at, created_by, created_at, updated_at, metadata_json, directive_hash
    ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
    [
      versionId,
      active.profile.profile_id,
      roleId,
      nextVersion,
      merged.purpose,
      json(merged.decision_questions),
      json(merged.primary_sources),
      json(merged.advisory_sources),
      merged.output_contract,
      merged.current_directive_setting,
      json(merged.hard_guardrails),
      json(merged.do_not_allow_rules),
      json(merged.required_evidence),
      json(merged.confidence_thresholds),
      json(merged.freshness_tolerance),
      json(merged.escalation_triggers),
      json(merged.publication_permissions),
      json(merged.external_communication_permissions),
      json(merged.report_family_applicability),
      merged.effective_date,
      merged.retired_date,
      changeReason,
      actor,
      now,
      now,
      json({ previous_version_id: active.version.version_id }),
      await sha256Hex(merged),
    ]
  );
  await writeDirectiveAuditEvent(db, {
    eventType: "directive.edited",
    roleId,
    directiveVersion: nextVersion,
    profileId: active.profile.profile_id,
    versionId,
    actor,
    reason: changeReason,
    before: active.directive,
    after: merged,
  });
  const row = await getDirectiveVersionRow(db, versionId);
  return { profile: active.profile, version: row!, directive: versionRowToDirective(active.profile, row!) };
}
