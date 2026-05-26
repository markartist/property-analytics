import { run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { DirectiveProfile, DirectiveProfileRow, DirectiveResolutionInput, DirectiveResolutionOutput, DirectiveVersionRow } from "./types";
import { ensureDirectiveTables, getActiveDirective, getDirectiveVersionByStatus, writeDirectiveAuditEvent } from "./repository";
import { validateDirectiveProfile } from "./validation";
import { canonicalJson, sha256Hex } from "./hashing";

export async function resolveRuntimeDirective(
  db: D1Database,
  input: DirectiveResolutionInput
): Promise<DirectiveResolutionOutput> {
  await ensureDirectiveTables(db);
  const record = input.runtime_mode === "simulation"
    ? (await getDirectiveVersionByStatus(db, input.role_id, "draft")) ?? (await getActiveDirective(db, input.role_id))
    : await getActiveDirective(db, input.role_id);
  if (!record) throw new Error(`No runtime-eligible directive found for ${input.role_id}`);
  if (record.directive.approval_status === "draft" && input.runtime_mode !== "simulation") {
    throw new Error("Draft directives cannot be used by runtime outside simulation mode.");
  }
  if (record.directive.active_status !== "active" && input.runtime_mode !== "simulation") {
    throw new Error(`Directive ${input.role_id} is not active and cannot be used at runtime.`);
  }
  if (
    input.report_family &&
    !record.directive.report_family_applicability.includes(input.report_family) &&
    input.runtime_mode !== "simulation"
  ) {
    throw new Error(`Directive ${input.role_id} is not applicable to report family ${input.report_family}.`);
  }
  const validation = await validateDirectiveProfile(db, record.directive, {
    versionId: record.version.version_id,
    actor: input.actor ?? "directive_resolver",
    persist: true,
    runtimeContext: input as unknown as Record<string, unknown>,
  });
  if (validation.status === "fail" && input.runtime_mode !== "simulation") {
    throw new Error(`Directive ${input.role_id} failed validation and cannot be used at runtime.`);
  }
  let snapshot: { id: string; hash: string } | undefined;
  if (input.include_snapshot !== false) {
    snapshot = await createRuntimeSnapshot(db, input, record, validation);
  }
  const output: DirectiveResolutionOutput = {
    active_directive_profile: record.directive,
    active_version: record.directive.version,
    applicable_guardrails: record.directive.hard_guardrails,
    required_sources: record.directive.primary_sources,
    confidence_thresholds: record.directive.confidence_thresholds,
    freshness_policy: record.directive.freshness_tolerance,
    escalation_rules: record.directive.escalation_triggers,
    publication_permissions: record.directive.publication_permissions,
    validation_status: validation,
    runtime_snapshot_id: snapshot?.id,
    runtime_snapshot_hash: snapshot?.hash,
  };
  await writeDirectiveAuditEvent(db, {
    eventType: "directive.used_at_runtime",
    roleId: input.role_id,
    directiveVersion: record.directive.version,
    profileId: record.profile.profile_id,
    versionId: record.version.version_id,
    actor: input.actor ?? "directive_resolver",
    reason: input.runtime_mode,
    after: output,
    runtimeContext: input,
    requestId: input.request_id ?? null,
    correlationId: input.correlation_id ?? null,
  });
  return output;
}

async function createRuntimeSnapshot(
  db: D1Database,
  input: DirectiveResolutionInput,
  record: { profile: DirectiveProfileRow; version: DirectiveVersionRow; directive: DirectiveProfile },
  validation: unknown
): Promise<{ id: string; hash: string }> {
  const snapshotId = `directive_runtime_snapshot_${newId()}`;
  const directiveSnapshot = canonicalJson(record.directive);
  const validationSnapshot = canonicalJson(validation);
  const snapshotHash = await sha256Hex({
    profile_id: record.profile.profile_id,
    version_id: record.version.version_id,
    role_id: input.role_id,
    runtime_mode: input.runtime_mode,
    property_id: input.property_id ?? null,
    report_family: input.report_family ?? null,
    as_of_date: input.as_of_date,
    directive_snapshot_json: directiveSnapshot,
    validation_status_json: validationSnapshot,
  });
  await run(
    db,
    `INSERT INTO directive_runtime_snapshots (
      snapshot_id, profile_id, version_id, role_id, runtime_mode, property_id,
      report_family, as_of_date, directive_snapshot_json, validation_status_json,
      snapshot_hash, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      record.profile.profile_id,
      record.version.version_id,
      input.role_id,
      input.runtime_mode,
      input.property_id ?? null,
      input.report_family ?? null,
      input.as_of_date,
      directiveSnapshot,
      validationSnapshot,
      snapshotHash,
      input.actor ?? "directive_resolver",
      nowISO(),
    ]
  );
  return { id: snapshotId, hash: snapshotHash };
}
