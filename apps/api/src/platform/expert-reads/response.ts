import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type {
  ExpertLaneResolution,
  ExpertReasoningPayload,
  ExpertRead,
  ExpertReadFinding,
  ExpertReadGovernanceResult,
  ExpertReadRecommendation,
  ExpertReadRequest,
} from "./types";

export function buildExpertReasoningPayload(input: {
  lane: ExpertLaneResolution;
  evidencePacket: ExpertReasoningPayload["evidence_packet"];
  governance: ExpertReadGovernanceResult;
}): ExpertReasoningPayload {
  return {
    payload_id: `expert_read_payload_${newId()}`,
    lane_id: input.lane.lane_id,
    role_identity: `${input.lane.contract.display_name} produces an Expert Read contribution, not a final report.`,
    directive_snapshot_id: input.lane.directive_snapshot_id,
    directive_snapshot_hash: input.lane.directive_snapshot_hash,
    evidence_packet: input.evidencePacket,
    contract: input.lane.contract,
    governance: input.governance,
    output_contract: input.lane.contract.required_output_sections,
  };
}

export function executeDeterministicExpertRead(input: {
  request: ExpertReadRequest;
  lane: ExpertLaneResolution;
  payload: ExpertReasoningPayload;
  governance: ExpertReadGovernanceResult;
}): Omit<ExpertRead, "read_hash"> {
  const expertReadId = `expert_read_${newId()}`;
  const evidenceRefs = input.payload.evidence_packet.evidence.slice(0, 8).map((item) => item.evidence_id);
  const blocked = input.governance.publishability === "blocked";
  const warnings = input.governance.checks.filter((check) => check.status === "warn");
  const blockers = input.governance.checks.filter((check) => check.status === "block");
  const freshnessState = blockers.some((check) => /freshness|blocked/i.test(check.check))
    ? "blocked"
    : warnings.some((check) => /freshness/i.test(check.check))
      ? "stale"
      : "current";
  const confidence = blocked ? 0.45 : warnings.length > 0 ? 0.68 : 0.82;
  const findings: ExpertReadFinding[] = [
    {
      finding_id: `expert_read_finding_${newId()}`,
      expert_read_id: expertReadId,
      finding_type: blocked ? "governance_block" : "specialist_read",
      statement: blocked
        ? `${input.lane.contract.display_name} cannot finalize a usable recommendation until governance blockers clear.`
        : `${input.lane.contract.display_name} read is bounded to ${input.lane.contract.adjustment_point}.`,
      evidence_refs: evidenceRefs,
      confidence,
      freshness: freshnessState,
      publishability: input.governance.publishability,
      verification_required: input.governance.publishability !== "internal_only",
    },
  ];
  const recommendations: ExpertReadRecommendation[] = [
    {
      recommendation_id: `expert_read_recommendation_${newId()}`,
      expert_read_id: expertReadId,
      recommendation_type: blocked ? "hold" : "specialist_next_step",
      recommendation_text: blocked
        ? `Hold ${input.lane.contract.display_name} recommendations until: ${blockers.map((check) => check.reason).join(" ")}`
        : `Use this Expert Read to sharpen ${input.lane.contract.adjustment_point}; Fleet Scribe must decide final publication language.`,
      evidence_refs: evidenceRefs,
      proof_metric: input.lane.required_evidence[0] ?? null,
      owner_lane: input.lane.lane_id,
      confidence,
      blocked_reason: blocked ? blockers.map((check) => check.reason).join(" ") : null,
      publishability: input.governance.publishability,
    },
  ];
  return {
    expert_read_id: expertReadId,
    request_id: input.request.request_id,
    lane_id: input.lane.lane_id,
    property_id: input.request.property_id,
    read_status: blocked ? "blocked" : "final",
    specialist_summary: blocked
      ? `${input.lane.contract.display_name} Expert Read is blocked by governed evidence or directive controls.`
      : `${input.lane.contract.display_name} Expert Read completed as a structured specialist contribution.`,
    findings,
    recommendations,
    do_not_do_rules: input.lane.contract.default_do_not_do_rules,
    required_evidence: input.lane.required_evidence,
    evidence_used: input.payload.evidence_packet.included_sources,
    confidence,
    freshness_state: freshnessState,
    publishability: input.governance.publishability,
    escalation_required: input.governance.escalation_required,
    conflicts: input.payload.evidence_packet.evidence.filter((item) => item.freshness === "conflicting").map((item) => item.summary),
    generated_at: nowISO(),
  };
}

export function validateExpertRead(read: Omit<ExpertRead, "read_hash"> | ExpertRead): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!read.expert_read_id.trim()) errors.push("expert_read_id is required.");
  if (!read.request_id.trim()) errors.push("request_id is required.");
  if (!read.specialist_summary.trim()) errors.push("specialist_summary is required.");
  if (read.specialist_summary.length > 4000) errors.push("specialist_summary exceeds maximum size.");
  if (!["requested", "in_progress", "final", "blocked", "failed"].includes(read.read_status)) errors.push("read_status is invalid.");
  if (!["publishable", "internal_only", "needs_verification", "blocked"].includes(read.publishability)) errors.push("publishability is invalid.");
  if (read.publishability === "publishable") errors.push("Expert Reads cannot self-authorize publishable status.");
  if (!["current", "stale", "conflicting", "blocked", "unknown"].includes(read.freshness_state)) errors.push("freshness_state is invalid.");
  if (read.confidence < 0 || read.confidence > 1) errors.push("confidence must be between 0 and 1.");
  if (!Array.isArray(read.findings) || read.findings.length === 0) errors.push("at least one finding is required.");
  if (!Array.isArray(read.recommendations) || read.recommendations.length === 0) errors.push("at least one recommendation is required.");
  if (!Array.isArray(read.do_not_do_rules) || read.do_not_do_rules.length === 0) errors.push("do_not_do_rules are required.");
  if (!Array.isArray(read.required_evidence) || read.required_evidence.length === 0) errors.push("required_evidence is required.");
  if (read.read_status === "final" && read.publishability === "blocked") errors.push("blocked Expert Reads cannot have final status.");
  if (read.read_status === "blocked" && read.publishability !== "blocked") errors.push("blocked Expert Reads must have blocked publishability.");
  if (read.conflicts.length > 50) errors.push("too many conflicts in Expert Read output.");
  for (const finding of read.findings) {
    if (finding.expert_read_id !== read.expert_read_id) errors.push("finding expert_read_id mismatch.");
    if (!finding.statement.trim()) errors.push("finding statement is required.");
    if (finding.statement.length > 3000) errors.push("finding statement exceeds maximum size.");
    if (finding.confidence < 0 || finding.confidence > 1) errors.push("finding confidence must be between 0 and 1.");
    if (!["current", "stale", "conflicting", "blocked", "unknown"].includes(finding.freshness)) errors.push("finding freshness is invalid.");
    if (finding.publishability === "publishable") errors.push("Expert Read findings cannot self-authorize publishable state.");
    if (!Array.isArray(finding.evidence_refs) || finding.evidence_refs.length === 0) errors.push("finding evidence_refs are required.");
  }
  for (const recommendation of read.recommendations) {
    if (recommendation.expert_read_id !== read.expert_read_id) errors.push("recommendation expert_read_id mismatch.");
    if (!recommendation.recommendation_text.trim()) errors.push("recommendation text is required.");
    if (recommendation.recommendation_text.length > 4000) errors.push("recommendation text exceeds maximum size.");
    if (recommendation.confidence < 0 || recommendation.confidence > 1) errors.push("recommendation confidence must be between 0 and 1.");
    if (recommendation.publishability === "publishable") errors.push("Expert Reads cannot self-authorize publishable recommendations.");
    if (!Array.isArray(recommendation.evidence_refs) || recommendation.evidence_refs.length === 0) errors.push("recommendation evidence_refs are required.");
    if (recommendation.publishability !== "blocked" && !recommendation.proof_metric?.trim()) errors.push("non-blocked recommendations require a proof_metric.");
    if (recommendation.publishability === "blocked" && !recommendation.blocked_reason?.trim()) errors.push("blocked recommendations require blocked_reason.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateExpertReadPayload(payload: ExpertReasoningPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.directive_snapshot_id || !payload.directive_snapshot_hash) errors.push("directive snapshot id/hash are required.");
  if (!payload.evidence_packet.evidence_hash) errors.push("evidence packet hash is required.");
  if (payload.governance.blocked_outputs.length === 0) errors.push("blocked outputs are required.");
  if (payload.governance.allowed_outputs.some((item) => payload.governance.blocked_outputs.includes(item))) {
    errors.push("allowed_outputs and blocked_outputs cannot overlap.");
  }
  if (JSON.stringify(payload).length > 80_000) errors.push("Expert Read payload exceeds maximum size.");
  if (!payload.output_contract.includes("findings")) errors.push("output contract must include findings.");
  if (!payload.output_contract.includes("recommendations")) errors.push("output contract must include recommendations.");
  for (const section of payload.contract.required_output_sections) {
    if (!payload.output_contract.includes(section)) errors.push(`output contract missing lane section: ${section}.`);
  }
  return { valid: errors.length === 0, errors };
}
