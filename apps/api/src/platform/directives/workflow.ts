import { batch, queryFirst, run, stmt } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { DirectiveProfile, DirectiveVersionRow } from "./types";
import {
  createDraftVersion,
  ensureDirectiveTables,
  getActiveDirective,
  getDirectiveVersionByStatus,
  getDirectiveVersionRow,
  versionRowToDirective,
  writeDirectiveAuditEvent,
} from "./repository";
import { validateDirectiveProfile } from "./validation";

function riskFlags(before: DirectiveProfile, after: DirectiveProfile): string[] {
  const flags: string[] = [];
  if (after.confidence_thresholds.minimumConfidence < before.confidence_thresholds.minimumConfidence) flags.push("lower_confidence_threshold");
  if (after.confidence_thresholds.publishableConfidence < before.confidence_thresholds.publishableConfidence) flags.push("lower_publishable_confidence");
  if (after.freshness_tolerance.dailySourceMaxAgeDays > before.freshness_tolerance.dailySourceMaxAgeDays) flags.push("looser_daily_freshness");
  if (after.freshness_tolerance.staleSourceAction !== "block" && before.freshness_tolerance.staleSourceAction === "block") flags.push("relaxed_publication_guardrail");
  if (after.external_communication_permissions.allowed && !before.external_communication_permissions.allowed) flags.push("expanded_external_communication");
  if (after.do_not_allow_rules.length < before.do_not_allow_rules.length) flags.push("removed_do_not_allow_rule");
  if (after.role_id === "fleet_scribe_office") flags.push("fleet_scribe_publication_control_change");
  if (after.role_id === "quartermaster") flags.push("quartermaster_source_integrity_gate_change");
  return flags;
}

export async function createDirectiveDraft(
  db: D1Database,
  roleId: string,
  patch: Partial<DirectiveProfile>,
  actor: string,
  changeReason: string
) {
  const created = await createDraftVersion(db, roleId, patch, actor, changeReason);
  await validateDirectiveProfile(db, created.directive, { versionId: created.version.version_id, actor, persist: true });
  return created;
}

export async function submitDirectiveForReview(db: D1Database, roleId: string, actor: string, reason: string) {
  await ensureDirectiveTables(db);
  if (!reason.trim()) throw new Error("Submitting a directive requires a reason.");
  const active = await getActiveDirective(db, roleId);
  const draft = await getDirectiveVersionByStatus(db, roleId, "draft");
  if (!active || !draft) throw new Error(`No active + draft directive pair found for ${roleId}`);
  const validation = await validateDirectiveProfile(db, draft.directive, { versionId: draft.version.version_id, actor, persist: true });
  if (validation.status === "fail") throw new Error("Draft directive failed validation and cannot be submitted.");
  const requestId = `directive_change_${newId()}`;
  const flags = riskFlags(active.directive, draft.directive);
  const now = nowISO();
  await run(
    db,
    `INSERT INTO directive_change_requests (
      request_id, profile_id, draft_version_id, requested_by, change_reason, risk_flags_json,
      status, submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'submitted_for_review', ?, ?, ?)`,
    [requestId, active.profile.profile_id, draft.version.version_id, actor, reason, JSON.stringify(flags), now, now, now]
  );
  await run(db, `UPDATE directive_versions SET approval_status = 'submitted_for_review', updated_at = ? WHERE version_id = ?`, [now, draft.version.version_id]);
  await approvalEvent(db, "submitted", requestId, active.profile.profile_id, draft.version.version_id, actor, reason, active.directive, draft.directive);
  return { requestId, riskFlags: flags, validation };
}

async function approvalEvent(
  db: D1Database,
  eventType: "submitted" | "approved" | "activated" | "rejected" | "retired" | "rolled_back",
  requestId: string | null,
  profileId: string,
  versionId: string,
  actor: string,
  reason: string,
  before: unknown,
  after: unknown
) {
  const now = nowISO();
  await run(
    db,
    `INSERT INTO directive_approval_events (
      approval_event_id, request_id, profile_id, version_id, event_type,
      actor, reason, event_at, before_snapshot_json, after_snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), requestId, profileId, versionId, eventType, actor, reason, now, JSON.stringify(before), JSON.stringify(after)]
  );
  await writeDirectiveAuditEvent(db, {
    eventType: `directive.${eventType}`,
    profileId,
    versionId,
    actor,
    reason,
    before,
    after,
  });
}

export async function approveDirective(db: D1Database, requestId: string, actor: string, reason: string) {
  await ensureDirectiveTables(db);
  if (!reason.trim()) throw new Error("Approval requires a reason.");
  const request = await queryFirst<{ profile_id: string; draft_version_id: string; status: string }>(
    db,
    `SELECT * FROM directive_change_requests WHERE request_id = ?`,
    [requestId]
  );
  if (!request || request.status !== "submitted_for_review") throw new Error("Directive change request is not reviewable.");
  const draft = await getDirectiveVersionRow(db, request.draft_version_id);
  if (!draft) throw new Error("Draft directive version not found.");
  if (draft.approval_status !== "submitted_for_review") throw new Error("Only submitted directive versions can be approved.");
  const profile = await queryFirst<any>(db, `SELECT * FROM directive_profiles WHERE profile_id = ?`, [request.profile_id]);
  const directive = versionRowToDirective(profile, draft);
  const validation = await validateDirectiveProfile(db, { ...directive, approval_status: "approved" }, { versionId: draft.version_id, actor, persist: true });
  if (validation.status === "fail") throw new Error("Directive failed validation and cannot be approved.");
  const now = nowISO();
  await run(db, `UPDATE directive_versions SET approval_status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE version_id = ?`, [actor, now, now, draft.version_id]);
  await run(db, `UPDATE directive_change_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ? WHERE request_id = ?`, [actor, now, reason, now, requestId]);
  await approvalEvent(db, "approved", requestId, request.profile_id, draft.version_id, actor, reason, null, directive);
  return { validation };
}

export async function rejectDirective(db: D1Database, requestId: string, actor: string, reason: string) {
  await ensureDirectiveTables(db);
  if (!reason.trim()) throw new Error("Rejection requires a reason.");
  const request = await queryFirst<{ profile_id: string; draft_version_id: string; status: string }>(db, `SELECT * FROM directive_change_requests WHERE request_id = ?`, [requestId]);
  if (!request || !["submitted_for_review", "draft"].includes(request.status)) throw new Error("Directive change request is not rejectable.");
  const now = nowISO();
  const before = await getDirectiveVersionRow(db, request.draft_version_id);
  await run(db, `UPDATE directive_versions SET approval_status = 'rejected', updated_at = ? WHERE version_id = ?`, [now, request.draft_version_id]);
  await run(db, `UPDATE directive_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ? WHERE request_id = ?`, [actor, now, reason, now, requestId]);
  await approvalEvent(db, "rejected", requestId, request.profile_id, request.draft_version_id, actor, reason, before, null);
}

export async function activateDirective(db: D1Database, roleId: string, versionId: string, actor: string, reason: string) {
  await ensureDirectiveTables(db);
  if (!reason.trim()) throw new Error("Activation requires a reason.");
  const active = await getActiveDirective(db, roleId);
  const target = await getDirectiveVersionRow(db, versionId);
  if (!active || !target || target.role_id !== roleId) throw new Error("Directive activation target is invalid.");
  if (target.approval_status !== "approved") throw new Error("Only approved directives can become active.");
  const profile = active.profile;
  const directive = versionRowToDirective(profile, target);
  const validation = await validateDirectiveProfile(db, { ...directive, approval_status: "active" }, { versionId, actor, persist: true });
  if (validation.status === "fail") throw new Error("Directive failed validation and cannot be activated.");
  const now = nowISO();
  await batch(db, [
    stmt(
      db,
      `UPDATE directive_versions
       SET approval_status = 'retired', retired_date = ?, updated_at = ?
       WHERE profile_id = ? AND approval_status = 'active'
         AND EXISTS (SELECT 1 FROM directive_versions target WHERE target.version_id = ? AND target.approval_status = 'approved')`,
      [now.slice(0, 10), now, profile.profile_id, versionId]
    ),
    stmt(db, `UPDATE directive_versions SET approval_status = 'active', updated_at = ? WHERE version_id = ? AND approval_status = 'approved'`, [now, versionId]),
    stmt(
      db,
      `UPDATE directive_profiles
       SET current_active_version_id = ?, active_status = 'active', updated_at = ?
       WHERE profile_id = ?
         AND EXISTS (SELECT 1 FROM directive_versions target WHERE target.version_id = ? AND target.approval_status = 'active')`,
      [versionId, now, profile.profile_id, versionId]
    ),
  ]);
  const activated = await getDirectiveVersionRow(db, versionId);
  if (activated?.approval_status !== "active") {
    throw new Error("Directive activation did not complete; target version was not activated.");
  }
  await approvalEvent(db, "activated", null, profile.profile_id, versionId, actor, reason, active.directive, directive);
  return { validation };
}

export async function retireDirective(db: D1Database, roleId: string, actor: string, reason: string) {
  await ensureDirectiveTables(db);
  if (!reason.trim()) throw new Error("Retirement requires a reason.");
  const active = await getActiveDirective(db, roleId);
  if (!active) throw new Error("No active directive to retire.");
  const now = nowISO();
  await run(db, `UPDATE directive_versions SET approval_status = 'retired', retired_date = ?, updated_at = ? WHERE version_id = ?`, [now.slice(0, 10), now, active.version.version_id]);
  await run(db, `UPDATE directive_profiles SET active_status = 'retired', current_active_version_id = NULL, updated_at = ? WHERE profile_id = ?`, [now, active.profile.profile_id]);
  await approvalEvent(db, "retired", null, active.profile.profile_id, active.version.version_id, actor, reason, active.directive, null);
}

export async function rollbackDirective(db: D1Database, roleId: string, targetVersion: number, actor: string, reason: string) {
  await ensureDirectiveTables(db);
  if (!reason.trim()) throw new Error("Rollback requires a reason.");
  const active = await getActiveDirective(db, roleId);
  if (!active) throw new Error("No active directive to roll back.");
  const target = await queryFirst<DirectiveVersionRow>(
    db,
    `SELECT * FROM directive_versions WHERE profile_id = ? AND version = ?`,
    [active.profile.profile_id, targetVersion]
  );
  if (!target) throw new Error("Rollback target version not found.");
  if (!["retired", "approved", "rolled_back"].includes(target.approval_status)) {
    throw new Error("Rollback target must be a previously approved or retired directive version.");
  }
  const now = nowISO();
  await batch(db, [
    stmt(db, `UPDATE directive_versions SET approval_status = 'retired', retired_date = ?, updated_at = ? WHERE profile_id = ? AND approval_status = 'active'`, [now.slice(0, 10), now, active.profile.profile_id]),
    stmt(db, `UPDATE directive_versions SET approval_status = 'active', retired_date = NULL, updated_at = ? WHERE version_id = ?`, [now, target.version_id]),
    stmt(db, `UPDATE directive_profiles SET current_active_version_id = ?, active_status = 'active', updated_at = ? WHERE profile_id = ?`, [target.version_id, now, active.profile.profile_id]),
  ]);
  await approvalEvent(db, "rolled_back", null, active.profile.profile_id, target.version_id, actor, reason, active.directive, versionRowToDirective(active.profile, target));
}
