import { queryFirst, run } from "../../lib/db";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type { DirectiveProfile, DirectiveSimulationInput, DirectiveSimulationOutput, DirectiveVersionRow } from "./types";
import {
  ensureDirectiveTables,
  getActiveDirective,
  getDirectiveProfileRow,
  getDirectiveVersionRow,
  versionRowToDirective,
  writeDirectiveAuditEvent,
} from "./repository";
import { validateDirectiveProfile } from "./validation";

export const DIRECTIVE_SIMULATION_FIXTURES: DirectiveSimulationInput[] = [
  {
    role_id: "navigator",
    scenario_key: "navigator_weak_local_proof",
    runtime_mode: "simulation",
    report_family: "watchlist",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { website_copy: "fresh", local_proof: "weak" },
    sample_evidence_packet: {
      proposed_claims: ["Best commute in market", "Near major employers"],
      local_proof_count: 0,
      source_links: [],
    },
  },
  {
    role_id: "quartermaster",
    scenario_key: "quartermaster_stale_conflicting_source",
    runtime_mode: "simulation",
    report_family: "captain_brief",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { box_score_days_old: 12, unit_feed_days_old: 1, conflicting_values: true },
    sample_evidence_packet: {
      claims: ["Exposure is 18.8%", "Available units are 61"],
      conflicts: ["Box score and unit feed disagree on available units"],
    },
  },
  {
    role_id: "fleet_scribe_office",
    scenario_key: "fleet_scribe_template_variance_missing_approval",
    runtime_mode: "simulation",
    report_family: "watchlist",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { report_template: "current", approval_record: "missing" },
    sample_evidence_packet: {
      template_variance: true,
      approved_artifact_family: "watchlist_vp_approved",
      outgoing_recipients: ["executive@example.com"],
    },
  },
  {
    role_id: "fleet_scribe_office",
    scenario_key: "unauthorized_external_communication_attempt",
    runtime_mode: "simulation",
    report_family: "executive_email",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { approval_record: "missing" },
    sample_evidence_packet: {
      outgoing_recipients: ["external@example.com"],
      external_message_without_approval: true,
    },
  },
  {
    role_id: "navigator",
    scenario_key: "navigator_recommendation_without_evidence",
    runtime_mode: "simulation",
    report_family: "watchlist",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { website_copy: "fresh" },
    sample_evidence_packet: {
      proposed_claims: ["Best apartments near everything"],
      source_links: [],
      evidence_count: 0,
    },
  },
  {
    role_id: "quartermaster",
    scenario_key: "quartermaster_source_conflict",
    runtime_mode: "simulation",
    report_family: "json_contract",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { source_a: "fresh", source_b: "fresh", conflicting_values: true },
    sample_evidence_packet: { conflicts: ["Same metric has two authoritative values"] },
  },
  {
    role_id: "fleet_scribe_office",
    scenario_key: "fleet_scribe_stale_approval",
    runtime_mode: "simulation",
    report_family: "executive_email",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { approval_days_old: 45, approval_record: "stale" },
    sample_evidence_packet: { approved_artifact_family: "watchlist_v1_2", template_variance: false },
  },
  {
    role_id: "signals_officer",
    scenario_key: "directive_rollback_regression",
    runtime_mode: "simulation",
    report_family: "watchlist",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { rollback_target: "prior_version" },
    sample_evidence_packet: { expected_guardrails_preserved: false, removed_do_not_allow_rules: true, regression_detected: true },
  },
  {
    role_id: "navigator",
    scenario_key: "runtime_mode_mismatch",
    runtime_mode: "standard",
    report_family: "watchlist",
    sample_property_case: { property_id: "sample_property", property_name: "Sample Pointe" },
    sample_source_freshness_state: { simulation_requested_with_runtime_mode: "standard" },
    sample_evidence_packet: { proposed_claims: ["Mode mismatch should not run as simulation"] },
  },
];

function values(value: Record<string, unknown>): string {
  return JSON.stringify(value).toLowerCase();
}

function firedGuardrails(directive: DirectiveProfile, input: DirectiveSimulationInput): string[] {
  const text = `${values(input.sample_source_freshness_state)} ${values(input.sample_evidence_packet)}`;
  const fired: string[] = [];
  if (/weak|0|"source_links":\[\]/.test(text)) {
    fired.push(...directive.hard_guardrails.filter((rule) => /evidence|proof|source|claim|invent/i.test(rule)));
  }
  if (/stale|conflict|disagree|days_old":1[0-9]/.test(text)) {
    fired.push(...directive.hard_guardrails.filter((rule) => /source|fresh|conflict|integrity|validation/i.test(rule)));
  }
  if (/template_variance|approval_record":"missing|outgoing_recipients/.test(text)) {
    fired.push(...directive.hard_guardrails.filter((rule) => /publish|approval|template|scribe|artifact/i.test(rule)));
  }
  if (/external_message_without_approval/.test(text)) {
    fired.push("External communication requires explicit approval before publication.");
  }
  if (/approval_days_old":[3-9][0-9]|approval_record":"stale/.test(text)) {
    fired.push("Approval freshness must be revalidated before publication.");
  }
  if (/regression_detected|removed_do_not_allow_rules":true|expected_guardrails_preserved":false/.test(text)) {
    fired.push("Rollback cannot remove guardrails or do-not-allow rules without review.");
  }
  return [...new Set(fired)];
}

function publishableClaims(input: DirectiveSimulationInput, blockPublication: boolean): string[] {
  const packet = input.sample_evidence_packet;
  const raw = packet.proposed_claims ?? packet.claims ?? [];
  if (!Array.isArray(raw)) return [];
  if (blockPublication) return [];
  return raw.map(String);
}

function changedFields(active: DirectiveProfile | null, candidate: DirectiveProfile): string[] {
  if (!active) return ["no_current_active_directive"];
  const fields: Array<keyof DirectiveProfile> = [
    "purpose",
    "decision_questions",
    "primary_sources",
    "advisory_sources",
    "output_contract",
    "current_directive_setting",
    "hard_guardrails",
    "do_not_allow_rules",
    "required_evidence",
    "confidence_thresholds",
    "freshness_tolerance",
    "escalation_triggers",
    "publication_permissions",
    "external_communication_permissions",
    "report_family_applicability",
  ];
  return fields.filter((field) => JSON.stringify(active[field]) !== JSON.stringify(candidate[field]));
}

async function resolveSimulationCandidate(db: D1Database, input: DirectiveSimulationInput) {
  const profile = await getDirectiveProfileRow(db, input.role_id);
  if (!profile) throw new Error(`Directive profile not found for ${input.role_id}`);
  if (input.draft_version_id) {
    const version = await getDirectiveVersionRow(db, input.draft_version_id);
    if (!version || version.role_id !== input.role_id) throw new Error("Draft directive version is invalid for this role.");
    return { profile, version, directive: versionRowToDirective(profile, version) };
  }
  const draft = await queryFirst<DirectiveVersionRow>(
    db,
    `SELECT * FROM directive_versions WHERE profile_id = ? AND approval_status = 'draft' ORDER BY version DESC LIMIT 1`,
    [profile.profile_id]
  );
  if (draft) return { profile, version: draft, directive: versionRowToDirective(profile, draft) };
  const active = await getActiveDirective(db, input.role_id);
  if (!active) throw new Error(`No directive is available for ${input.role_id}`);
  return active;
}

export async function runDirectiveSimulation(
  db: D1Database,
  input: DirectiveSimulationInput
): Promise<DirectiveSimulationOutput> {
  await ensureDirectiveTables(db);
  if (input.runtime_mode !== "simulation") {
    throw new Error("Directive simulations must run with runtime_mode=simulation.");
  }
  const candidate = await resolveSimulationCandidate(db, input);
  const active = await getActiveDirective(db, input.role_id);
  const validation = await validateDirectiveProfile(db, candidate.directive, {
    versionId: candidate.version.version_id,
    actor: input.actor ?? "directive_simulation",
    persist: true,
    runtimeContext: input as unknown as Record<string, unknown>,
  });
  const guardrails = firedGuardrails(candidate.directive, input);
  const sourceText = values(input.sample_source_freshness_state);
  const evidenceText = values(input.sample_evidence_packet);
  const wouldBlockPublication =
    validation.status === "fail" ||
    guardrails.length > 0 ||
    /stale|conflict|missing|template_variance|weak/.test(`${sourceText} ${evidenceText}`);
  const wouldRequireEscalation =
    wouldBlockPublication ||
    candidate.directive.escalation_triggers.some((trigger) => /conflict|approval|source|publish|external/i.test(trigger));
  const output: DirectiveSimulationOutput = {
    would_pass_validation: validation.status === "pass",
    would_block_publication: wouldBlockPublication,
    would_require_escalation: wouldRequireEscalation,
    guardrails_fired: guardrails,
    required_sources: candidate.directive.primary_sources,
    publishable_claims: publishableClaims(input, wouldBlockPublication),
    changed_vs_current_active: changedFields(active?.directive ?? null, candidate.directive),
    validation_status: validation,
  };
  const simulationResultId = `directive_simulation_${newId()}`;
  await run(
    db,
    `INSERT INTO directive_simulation_results (
      simulation_result_id, profile_id, version_id, role_id, scenario_key,
      runtime_mode, report_family, input_json, output_json, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      simulationResultId,
      candidate.profile.profile_id,
      candidate.version.version_id,
      input.role_id,
      input.scenario_key,
      input.runtime_mode,
      input.report_family ?? null,
      JSON.stringify(input),
      JSON.stringify(output),
      input.actor ?? "directive_simulation",
      nowISO(),
    ]
  );
  await writeDirectiveAuditEvent(db, {
    eventType: "simulation_run",
    roleId: input.role_id,
    directiveVersion: candidate.directive.version,
    profileId: candidate.profile.profile_id,
    versionId: candidate.version.version_id,
    actor: input.actor ?? "directive_simulation",
    reason: input.scenario_key,
    after: output,
    runtimeContext: input,
  });
  return { ...output, simulation_result_id: simulationResultId };
}
