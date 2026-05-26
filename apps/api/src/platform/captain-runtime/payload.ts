import { newId } from "../../lib/id";
import type { DirectiveResolutionOutput } from "../directives/types";
import type { PropertyRuntimeContext } from "./context";
import type { CaptainEvidencePacket, CaptainRuntimePayload, AuthorityLevel } from "./types";

export function buildCaptainRuntimePayload(input: {
  directive: DirectiveResolutionOutput;
  context: PropertyRuntimeContext;
  evidencePacket: CaptainEvidencePacket;
  governance: {
    allowed_outputs: string[];
    blocked_outputs: string[];
    authority_level: AuthorityLevel;
    publishability: string;
    escalation_required: boolean;
  };
}): CaptainRuntimePayload {
  return {
    payload_id: `captain_runtime_payload_${newId()}`,
    role_identity: input.directive.active_directive_profile.role_name,
    runtime_authority: input.governance.authority_level,
    directive: input.directive,
    property_context: {
      property: input.context.property,
      unresolved_issues: input.context.unresolved_issues,
      applicable_bench_lanes: input.context.applicable_bench_lanes,
      doctrine: input.context.doctrine,
    },
    evidence_packet: input.evidencePacket,
    relevant_memory: input.context.recent_memory.slice(0, 5),
    governance_constraints: {
      allowed_outputs: input.governance.allowed_outputs,
      blocked_outputs: input.governance.blocked_outputs,
      publishability_rules: [
        "Do not treat human input as canonical truth.",
        "Do not create publishable claims from unverified or stale evidence.",
        "Do not bypass Fleet Scribe for executive publication.",
        "Do not bypass Quartermaster source integrity controls.",
      ],
      escalation_behavior: input.directive.escalation_rules,
    },
    output_contract: [
      "conversational_response",
      "reasoning_summary",
      "memory_candidates",
      "routing_decisions",
      "escalation_needs",
      "confidence_assessment",
      "publishability_assessment",
      "required_followups",
      "unresolved_conflicts",
    ],
  };
}

export function validateCaptainRuntimePayload(payload: CaptainRuntimePayload): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!payload.payload_id.trim()) errors.push("payload_id is required.");
  if (!payload.directive.runtime_snapshot_id) errors.push("directive runtime snapshot id is required.");
  if (!payload.directive.runtime_snapshot_hash) errors.push("directive runtime snapshot hash is required.");
  if (!payload.evidence_packet.evidence_hash) errors.push("evidence packet hash is required.");
  const allowed = new Set(payload.governance_constraints.allowed_outputs);
  const blocked = new Set(payload.governance_constraints.blocked_outputs);
  for (const output of allowed) {
    if (blocked.has(output)) errors.push(`output cannot be both allowed and blocked: ${output}.`);
  }
  const serialized = JSON.stringify(payload);
  if (serialized.length > 80_000) errors.push("payload exceeds maximum governed runtime size.");
  if (new Set(payload.governance_constraints.publishability_rules).size !== payload.governance_constraints.publishability_rules.length) {
    warnings.push("duplicate publishability rules detected.");
  }
  if (payload.relevant_memory.length > 8) warnings.push("payload includes more memory rows than the scoped runtime budget.");
  return { valid: errors.length === 0, errors, warnings };
}
