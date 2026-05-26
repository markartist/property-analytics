import { queryAll, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { DirectiveProfile, DirectiveValidationIssue, DirectiveValidationResult } from "./types";
import { ensureDirectiveTables, writeDirectiveAuditEvent } from "./repository";

const VALID_OFFICE_TYPES = new Set(["captain_office", "regional_desk", "fleet_desk", "consulting_bench", "fleet_scribe_office"]);
const VALID_APPROVAL_STATUSES = new Set(["draft", "submitted_for_review", "approved", "active", "rejected", "retired", "rolled_back"]);
const VALID_REPORT_FAMILIES = new Set(["captain", "watchlist", "spotlight", "pib", "json_contract", "word_report", "excel_companion", "executive_email"]);

function issue(
  severity: DirectiveValidationIssue["severity"],
  roleId: string,
  field: string,
  message: string,
  recommendedFix: string
): DirectiveValidationIssue {
  return { severity, role_id: roleId, field, message, recommended_fix: recommendedFix };
}

function isEmptyArray(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

function isNumberBetweenZeroAndOne(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function validateDirectiveProfile(
  db: D1Database | null,
  directive: DirectiveProfile,
  options: { versionId?: string | null; actor?: string; persist?: boolean; runtimeContext?: Record<string, unknown> } = {}
): Promise<DirectiveValidationResult> {
  const blocking: DirectiveValidationIssue[] = [];
  const warnings: DirectiveValidationIssue[] = [];
  const roleId = directive.role_id || "unknown";
  const today = new Date().toISOString().slice(0, 10);

  const requiredText: Array<[keyof DirectiveProfile, string]> = [
    ["role_id", "Stable role id is required."],
    ["role_name", "Role name is required."],
    ["office_type", "Office type is required."],
    ["purpose", "Purpose is required."],
    ["output_contract", "Output contract is required."],
    ["current_directive_setting", "Current directive setting is required."],
    ["owner", "Owner is required."],
    ["effective_date", "Effective date is required."],
    ["change_reason", "Change reason is required."],
  ];
  for (const [field, message] of requiredText) {
    if (!String(directive[field] ?? "").trim()) {
      blocking.push(issue("blocking", roleId, String(field), message, `Populate ${String(field)}.`));
    }
  }

  if (!VALID_OFFICE_TYPES.has(String(directive.office_type))) {
    blocking.push(issue("blocking", roleId, "office_type", "Office type is not recognized.", "Use a governed office type from the Fleet Scribe operating model."));
  }
  if (!VALID_APPROVAL_STATUSES.has(String(directive.approval_status))) {
    blocking.push(issue("blocking", roleId, "approval_status", "Approval status is not recognized.", "Use a governed directive workflow state."));
  }
  if (!["active", "paused", "retired"].includes(String(directive.active_status))) {
    blocking.push(issue("blocking", roleId, "active_status", "Active status is not recognized.", "Use active, paused, or retired."));
  }
  if (!/^[a-z0-9_]+$/.test(String(directive.role_id))) {
    blocking.push(issue("blocking", roleId, "role_id", "Role id must be stable snake_case.", "Use a lowercase snake_case role id and never rename it after runtime use."));
  }

  for (const [field, label] of [
    ["decision_questions", "Decision questions"],
    ["hard_guardrails", "Hard guardrails"],
    ["do_not_allow_rules", "Do-not-allow rules"],
    ["required_evidence", "Required evidence"],
    ["escalation_triggers", "Escalation triggers"],
    ["report_family_applicability", "Report family applicability"],
  ] as Array<[keyof DirectiveProfile, string]>) {
    if (isEmptyArray(directive[field])) {
      blocking.push(issue("blocking", roleId, String(field), `${label} cannot be empty.`, `Add at least one ${label.toLowerCase()} entry.`));
    }
  }
  for (const field of ["decision_questions", "primary_sources", "advisory_sources", "hard_guardrails", "do_not_allow_rules", "required_evidence", "escalation_triggers", "report_family_applicability"] as Array<keyof DirectiveProfile>) {
    const values = directive[field];
    if (Array.isArray(values)) {
      const normalized = values.map((value) => String(value).trim()).filter(Boolean);
      if (normalized.length !== values.length) {
        blocking.push(issue("blocking", roleId, String(field), "List entries cannot be blank.", "Remove blank entries or replace them with explicit policy text."));
      }
      if (new Set(normalized.map((value) => value.toLowerCase())).size !== normalized.length) {
        warnings.push(issue("warning", roleId, String(field), "Duplicate entries detected.", "Deduplicate this list before approval."));
      }
    }
  }

  if (isEmptyArray(directive.primary_sources) && directive.role_id !== "fleet_scribe_office") {
    blocking.push(issue("blocking", roleId, "primary_sources", "Source rules cannot be empty for operational roles.", "Add authoritative or governing primary sources."));
  }
  if (!directive.publication_permissions) {
    blocking.push(issue("blocking", roleId, "publication_permissions", "Publication permissions must be explicit.", "Set publication permissions for this role."));
  } else {
    for (const key of ["canPublishExecutiveArtifact", "canPublishInternalBrief", "canPublishExternalMessage", "requiresFleetScribe", "requiresApprovalForMaterialChange"] as const) {
      if (typeof directive.publication_permissions[key] !== "boolean") {
        blocking.push(issue("blocking", roleId, `publication_permissions.${key}`, "Publication permissions must be explicit booleans.", `Set ${key}.`));
      }
    }
    if (directive.publication_permissions.canPublishExecutiveArtifact && !directive.publication_permissions.requiresFleetScribe) {
      blocking.push(issue("blocking", roleId, "publication_permissions.requiresFleetScribe", "Executive publication cannot bypass Fleet Scribe.", "Set requiresFleetScribe to true."));
    }
    if (directive.publication_permissions.canPublishExternalMessage && !directive.external_communication_permissions?.allowed) {
      blocking.push(issue("blocking", roleId, "external_communication_permissions.allowed", "External publication permission conflicts with external communication settings.", "Either disable external publication or explicitly allow external communication with approval."));
    }
  }
  if (!directive.external_communication_permissions || typeof directive.external_communication_permissions.allowed !== "boolean") {
    blocking.push(issue("blocking", roleId, "external_communication_permissions", "External communication permissions must be explicit.", "Set external communication permission object."));
  } else {
    if (!Array.isArray(directive.external_communication_permissions.channels)) {
      blocking.push(issue("blocking", roleId, "external_communication_permissions.channels", "External communication channels must be an explicit list.", "Set channels to an array."));
    } else if (!directive.external_communication_permissions.allowed && directive.external_communication_permissions.channels.length > 0) {
      blocking.push(issue("blocking", roleId, "external_communication_permissions.channels", "External channels cannot be listed when external communication is not allowed.", "Clear channels or explicitly allow external communication with approval."));
    }
    if (directive.external_communication_permissions.allowed && !directive.external_communication_permissions.requiresApproval) {
      blocking.push(issue("blocking", roleId, "external_communication_permissions.requiresApproval", "External communication requires approval.", "Set requiresApproval to true."));
    }
    if (!String(directive.external_communication_permissions.notes ?? "").trim()) {
      blocking.push(issue("blocking", roleId, "external_communication_permissions.notes", "External communication notes are required.", "Describe the boundary for external communication."));
    }
  }
  if (!directive.freshness_tolerance || typeof directive.freshness_tolerance.staleSourceAction !== "string") {
    blocking.push(issue("blocking", roleId, "freshness_tolerance", "Freshness policy is required.", "Set daily/weekly/monthly tolerance and stale source action."));
  } else {
    for (const key of ["dailySourceMaxAgeDays", "weeklySourceMaxAgeDays", "monthlySourceMaxAgeDays"] as const) {
      if (!isNonNegativeInteger(directive.freshness_tolerance[key])) {
        blocking.push(issue("blocking", roleId, `freshness_tolerance.${key}`, "Freshness thresholds must be non-negative whole days.", `Set ${key} to a non-negative integer.`));
      }
    }
    if (!["block", "escalate", "warn"].includes(directive.freshness_tolerance.staleSourceAction)) {
      blocking.push(issue("blocking", roleId, "freshness_tolerance.staleSourceAction", "Stale source action is invalid.", "Use block, escalate, or warn."));
    }
  }
  if (!directive.confidence_thresholds) {
    blocking.push(issue("blocking", roleId, "confidence_thresholds", "Confidence thresholds must be numeric between 0 and 1.", "Set minimum/publishable/escalation thresholds."));
  } else {
    for (const key of ["minimumConfidence", "publishableConfidence", "escalationConfidenceBelow"] as const) {
      if (!isNumberBetweenZeroAndOne(directive.confidence_thresholds[key])) {
        blocking.push(issue("blocking", roleId, `confidence_thresholds.${key}`, "Confidence thresholds must be numeric between 0 and 1.", `Set ${key} between 0 and 1.`));
      }
    }
    if (directive.confidence_thresholds.publishableConfidence < directive.confidence_thresholds.minimumConfidence) {
      blocking.push(issue("blocking", roleId, "confidence_thresholds.publishableConfidence", "Publishable confidence cannot be lower than minimum confidence.", "Raise publishableConfidence or lower minimumConfidence through approval."));
    }
  }
  if (directive.role_id === "fleet_scribe_office" && !directive.publication_permissions?.requiresFleetScribe) {
    blocking.push(issue("blocking", roleId, "publication_permissions.requiresFleetScribe", "Fleet Scribe publication authority cannot be weakened.", "Set requiresFleetScribe to true."));
  }
  if (directive.role_id === "quartermaster" && directive.freshness_tolerance?.staleSourceAction !== "block") {
    blocking.push(issue("blocking", roleId, "freshness_tolerance.staleSourceAction", "Quartermaster source integrity gates are blocking controls.", "Set staleSourceAction to block."));
  }
  if (directive.approval_status === "draft") {
    warnings.push(issue("warning", roleId, "approval_status", "Draft directives are simulation-only.", "Submit and approve before runtime use."));
  }
  if (directive.approval_status === "active" && directive.active_status !== "active") {
    blocking.push(issue("blocking", roleId, "active_status", "Inactive directives cannot be runtime-active.", "Activate the profile or retire the directive version."));
  }
  if (directive.approval_status === "active" && directive.effective_date > today) {
    blocking.push(issue("blocking", roleId, "effective_date", "Active directives cannot have a future effective date.", "Set an effective date on or before today before activation."));
  }
  if (directive.retired_date && directive.retired_date < directive.effective_date) {
    blocking.push(issue("blocking", roleId, "retired_date", "Retired date cannot precede effective date.", "Correct lifecycle dates."));
  }
  for (const family of directive.report_family_applicability) {
    if (!VALID_REPORT_FAMILIES.has(family)) {
      blocking.push(issue("blocking", roleId, "report_family_applicability", `Unknown report family: ${family}.`, "Use a governed report family id."));
    }
  }
  const selfReferences = directive.escalation_triggers.filter((trigger) => {
    const lower = trigger.toLowerCase();
    return lower.includes(`to ${directive.role_id.toLowerCase()}`) || lower.includes(`to ${directive.role_name.toLowerCase()}`);
  });
  if (selfReferences.length > 0) {
    warnings.push(issue("warning", roleId, "escalation_triggers", "Escalation trigger may route back to the same role.", "Confirm this is intentional or route to the appropriate reviewer."));
  }

  if (db) {
    await ensureDirectiveTables(db);
    const duplicates = await queryAll<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count FROM directive_versions WHERE role_id = ? AND approval_status = 'active'`,
      [directive.role_id]
    );
    if (Number(duplicates[0]?.count ?? 0) > 1) {
      blocking.push(issue("blocking", roleId, "approval_status", "Duplicate active directive versions exist.", "Retire or roll back duplicate active versions."));
    }
    const profileDuplicates = await queryAll<{ count: number }>(
      db,
      `SELECT COUNT(*) AS count FROM directive_profiles WHERE role_id = ?`,
      [directive.role_id]
    );
    if (Number(profileDuplicates[0]?.count ?? 0) > 1) {
      blocking.push(issue("blocking", roleId, "role_id", "Duplicate directive profiles exist for this role.", "Merge duplicate profiles and preserve version history."));
    }
  }

  const result: DirectiveValidationResult = {
    status: blocking.length ? "fail" : "pass",
    warnings,
    blocking_errors: blocking,
    recommended_fixes: [...blocking, ...warnings],
  };

  if (db && options.persist) {
    await persistValidationResult(db, directive, result, options);
  }
  return result;
}

export async function persistValidationResult(
  db: D1Database,
  directive: DirectiveProfile,
  result: DirectiveValidationResult,
  options: { versionId?: string | null; actor?: string; runtimeContext?: Record<string, unknown> } = {}
): Promise<void> {
  await ensureDirectiveTables(db);
  const profile = await queryAll<{ profile_id: string }>(db, `SELECT profile_id FROM directive_profiles WHERE role_id = ?`, [directive.role_id]);
  const profileId = profile[0]?.profile_id ?? null;
  await run(
    db,
    `INSERT INTO directive_validation_results (
      validation_result_id, profile_id, version_id, role_id, validation_status,
      warnings_json, blocking_errors_json, recommended_fixes_json,
      validated_by, validated_at, runtime_context_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      profileId,
      options.versionId ?? null,
      directive.role_id,
      result.status,
      JSON.stringify(result.warnings),
      JSON.stringify(result.blocking_errors),
      JSON.stringify(result.recommended_fixes),
      options.actor ?? "directive_validation_engine",
      nowISO(),
      options.runtimeContext ? JSON.stringify(options.runtimeContext) : null,
    ]
  );
  await writeDirectiveAuditEvent(db, {
    eventType: result.status === "pass" ? "directive.validated" : "directive.validation_failed",
    roleId: directive.role_id,
    directiveVersion: directive.version,
    profileId,
    versionId: options.versionId ?? null,
    actor: options.actor ?? "directive_validation_engine",
    reason: result.status,
    after: result,
    runtimeContext: options.runtimeContext,
  });
}
