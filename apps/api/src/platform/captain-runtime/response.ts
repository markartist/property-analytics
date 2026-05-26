import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import type {
  CaptainMemoryCandidate,
  CaptainReasoningResponse,
  CaptainRoutingDecision,
  CaptainRuntimePayload,
  CaptainInteractionIntent,
  Publishability,
  RoutingTargetLane,
} from "./types";

export function executeConstrainedReasoning(input: {
  requestId: string;
  interactionId: string;
  inputText: string;
  intent: CaptainInteractionIntent;
  payload: CaptainRuntimePayload;
  publishability: Publishability;
  escalationRequired: boolean;
}): {
  response: CaptainReasoningResponse;
  memoryCandidates: CaptainMemoryCandidate[];
  memoryPayloads: Record<string, unknown>[];
  routingDecisions: CaptainRoutingDecision[];
} {
  const lane = routeLaneForIntent(input.intent);
  const blocked = input.publishability === "blocked";
  const response: CaptainReasoningResponse = {
    response_id: `captain_reasoning_response_${newId()}`,
    request_id: input.requestId,
    conversational_response: blocked
      ? "I can hold this as a governed claim, but I cannot treat it as verified or publishable until the required source checks clear."
      : "I captured this in the Captain runtime with source boundaries intact. The next step is to verify the claim against the evidence packet before it becomes operational memory or publication material.",
    reasoning_summary: summarizeReasoning(input.intent, lane, input.publishability),
    structured_outputs: {
      memory_candidates: input.intent === "question" ? [] : [{ type: input.intent, verification_required: true }],
      routing_decisions: [{ target_lane: lane, reason: `Intent ${input.intent} maps to ${lane}.` }],
      escalation_needs: input.escalationRequired ? ["Review governance blockers before downstream action."] : [],
      confidence_assessment: { confidence: blocked ? 0.35 : 0.72, basis: "Directive-scoped evidence packet and deterministic intake classification." },
      publishability_assessment: { publishability: input.publishability, reason: "Human input is claim-level until verified." },
      required_followups: blocked ? ["Refresh or verify blocked source evidence."] : ["Verify claim against governed source rows before promotion."],
      unresolved_conflicts: input.payload.evidence_packet.evidence.filter((item) => item.freshness === "conflicting").map((item) => item.summary),
    },
    confidence: blocked ? 0.35 : 0.72,
    publishability: input.publishability,
    escalation_required: input.escalationRequired,
    generated_at: nowISO(),
  };

  const memoryCandidates: CaptainMemoryCandidate[] = input.intent === "question"
    ? []
    : [{
        memory_candidate_id: `captain_memory_candidate_${newId()}`,
        source_interaction_id: input.interactionId,
        candidate_type: input.intent,
        confidence: 0.62,
        verification_required: true,
        promotion_state: "candidate",
        expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        conflict_state: "none",
        source_evidence_hash: input.payload.evidence_packet.evidence_hash,
      }];
  const memoryPayloads = memoryCandidates.map((candidate) => ({
    candidate_id: candidate.memory_candidate_id,
    source_text: input.inputText,
    evidence_packet_hash: input.payload.evidence_packet.evidence_hash,
    lifecycle: "raw input -> parsed claim -> candidate memory -> verified memory -> operational fact",
  }));
  const routingDecisions: CaptainRoutingDecision[] = [{
    routing_id: `captain_routing_${newId()}`,
    interaction_id: input.interactionId,
    target_lane: lane,
    reason: `Intent ${input.intent} requires ${lane} review before any canonical action.`,
    status: blocked ? "blocked" : "pending",
  }];
  return { response, memoryCandidates, memoryPayloads, routingDecisions };
}

export function validateReasoningResponse(response: CaptainReasoningResponse): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedStructuredKeys = new Set([
    "memory_candidates",
    "routing_decisions",
    "escalation_needs",
    "confidence_assessment",
    "publishability_assessment",
    "required_followups",
    "unresolved_conflicts",
  ]);
  if (!response.conversational_response.trim()) errors.push("conversational_response is required.");
  if (!response.reasoning_summary.trim()) errors.push("reasoning_summary is required.");
  if (!["publishable", "internal_only", "needs_verification", "blocked"].includes(response.publishability)) {
    errors.push("publishability is invalid.");
  }
  if (response.confidence < 0 || response.confidence > 1) errors.push("confidence must be between 0 and 1.");
  if (response.conversational_response.length > 8000) errors.push("conversational_response exceeds maximum size.");
  if (response.reasoning_summary.length > 4000) errors.push("reasoning_summary exceeds maximum size.");
  for (const key of allowedStructuredKeys) {
    if (!(key in response.structured_outputs)) errors.push(`structured_outputs.${key} is required.`);
  }
  for (const key of Object.keys(response.structured_outputs)) {
    if (!allowedStructuredKeys.has(key)) errors.push(`structured_outputs.${key} is not allowed.`);
  }
  if (!Array.isArray(response.structured_outputs.memory_candidates)) errors.push("structured_outputs.memory_candidates must be an array.");
  if (!Array.isArray(response.structured_outputs.routing_decisions)) errors.push("structured_outputs.routing_decisions must be an array.");
  if (!Array.isArray(response.structured_outputs.escalation_needs)) errors.push("structured_outputs.escalation_needs must be an array.");
  if (!Array.isArray(response.structured_outputs.required_followups)) errors.push("structured_outputs.required_followups must be an array.");
  if (!Array.isArray(response.structured_outputs.unresolved_conflicts)) errors.push("structured_outputs.unresolved_conflicts must be an array.");
  return { valid: errors.length === 0, errors };
}

export function validateReasoningSideEffects(input: {
  memoryCandidates: CaptainMemoryCandidate[];
  routingDecisions: CaptainRoutingDecision[];
  evidenceHash: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedRoutingLanes = new Set<RoutingTargetLane>([
    "captain_office",
    "regional_desk",
    "fleet_desk",
    "quartermaster",
    "leasing_performance_advisor",
    "revenue_advisor",
    "signals_officer",
    "navigator",
    "market_scout",
    "product_readiness_officer",
    "reputation_officer",
    "resident_experience_officer",
    "engineer",
    "fleet_scribe_office",
  ]);
  for (const candidate of input.memoryCandidates) {
    if (candidate.promotion_state !== "candidate") errors.push("new memory candidates must start in candidate state.");
    if (!candidate.verification_required) errors.push("new memory candidates must require verification.");
    if (candidate.source_evidence_hash !== input.evidenceHash) errors.push("memory candidate evidence hash mismatch.");
    if (candidate.expires_at && Number.isNaN(Date.parse(candidate.expires_at))) errors.push("memory candidate expiration is invalid.");
  }
  for (const decision of input.routingDecisions) {
    if (!allowedRoutingLanes.has(decision.target_lane)) errors.push(`invalid routing lane: ${decision.target_lane}.`);
    if (!decision.reason.trim()) errors.push("routing decisions require a reason.");
  }
  return { valid: errors.length === 0, errors };
}

function routeLaneForIntent(intent: CaptainInteractionIntent): RoutingTargetLane {
  if (intent === "pricing_concern") return "revenue_advisor";
  if (intent === "website_concern" || intent === "content_suggestion" || intent === "amenity_update" || intent === "event_update") return "navigator";
  if (intent === "reputation_concern") return "reputation_officer";
  if (intent === "resident_issue") return "resident_experience_officer";
  if (intent === "leasing_concern" || intent === "recommendation_request") return "leasing_performance_advisor";
  if (intent === "approval_request") return "fleet_scribe_office";
  if (intent === "correction") return "quartermaster";
  return "captain_office";
}

function summarizeReasoning(intent: CaptainInteractionIntent, lane: RoutingTargetLane, publishability: Publishability): string {
  return `Intent classified as ${intent}; routed to ${lane}; publishability is ${publishability}. GPT output is advisory and cannot mutate canonical facts.`;
}
