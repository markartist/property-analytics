import { resolveRuntimeDirective } from "../directives/resolver";
import type { DirectiveRuntimeMode } from "../directives/types";
import { getExpertLaneContract } from "./contracts";
import type { ExpertLaneId, ExpertLaneResolution } from "./types";

export async function resolveExpertLane(
  db: D1Database,
  input: {
    lane_id: ExpertLaneId;
    property_id: string;
    runtime_mode: DirectiveRuntimeMode;
    report_family?: string | null;
    as_of_date: string;
    evidence_packet_id: string;
    actor?: string | null;
    request_id?: string | null;
    correlation_id?: string | null;
  }
): Promise<ExpertLaneResolution> {
  const contract = getExpertLaneContract(input.lane_id);
  const directive = await resolveRuntimeDirective(db, {
    role_id: input.lane_id,
    property_id: input.property_id,
    report_family: input.report_family ?? "captain",
    runtime_mode: input.runtime_mode,
    as_of_date: input.as_of_date,
    actor: input.actor ?? "expert_read_resolver",
    request_id: input.request_id ?? null,
    correlation_id: input.correlation_id ?? null,
  });
  if (directive.active_directive_profile.role_id !== input.lane_id) {
    throw new Error(`Directive Resolver returned ${directive.active_directive_profile.role_id}; expected ${input.lane_id}.`);
  }
  if (directive.active_directive_profile.approval_status === "draft" && input.runtime_mode !== "simulation") {
    throw new Error("Draft directives cannot be used by Expert Reads outside simulation mode.");
  }
  if (directive.active_directive_profile.active_status !== "active" && input.runtime_mode !== "simulation") {
    throw new Error(`Expert lane ${input.lane_id} is inactive.`);
  }
  if (!directive.runtime_snapshot_id || !directive.runtime_snapshot_hash) {
    throw new Error("Expert lane directive snapshot id/hash are required.");
  }
  const requiredEvidence = Array.from(new Set([...directive.active_directive_profile.required_evidence, ...contract.required_evidence_sources]));
  return {
    lane_id: input.lane_id,
    directive,
    contract,
    required_evidence: requiredEvidence,
    allowed_outputs: [
      "specialist_summary",
      "findings",
      "recommendations",
      "do_not_do_rules",
      "proof_metrics",
      "publishability_assessment",
      "escalation_recommendation",
    ],
    blocked_outputs: contract.blocked_patterns,
    freshness_policy: directive.freshness_policy,
    confidence_thresholds: directive.confidence_thresholds,
    escalation_rules: directive.escalation_rules,
    publication_constraints: directive.publication_permissions,
    directive_snapshot_id: directive.runtime_snapshot_id,
    directive_snapshot_hash: directive.runtime_snapshot_hash,
  };
}
