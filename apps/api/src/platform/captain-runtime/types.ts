import type { DirectiveResolutionOutput, DirectiveRuntimeMode } from "../directives/types";

export type CaptainRuntimeMode = DirectiveRuntimeMode;

export type CaptainInteractionIntent =
  | "informational_claim"
  | "operational_update"
  | "content_suggestion"
  | "recommendation_request"
  | "correction"
  | "escalation"
  | "question"
  | "reputation_concern"
  | "leasing_concern"
  | "pricing_concern"
  | "website_concern"
  | "resident_issue"
  | "amenity_update"
  | "event_update"
  | "approval_request";

export type CaptainInputType = "text" | "system_event" | "file_note";
export type CaptainActor = "user" | "captain" | "system" | "bench" | "fleet_scribe";
export type EvidenceClass =
  | "canonical_fact"
  | "verified_operational_fact"
  | "human_submitted_claim"
  | "advisory_observation"
  | "inferred_signal"
  | "unresolved_conflict"
  | "stale_evidence"
  | "blocked_evidence";
export type AuthorityLevel = "canonical" | "verified" | "advisory" | "claim" | "blocked";
export type Publishability = "publishable" | "internal_only" | "needs_verification" | "blocked";
export type MemoryPromotionState = "candidate" | "verified" | "promoted" | "rejected" | "expired";
export type RoutingTargetLane =
  | "captain_office"
  | "regional_desk"
  | "fleet_desk"
  | "quartermaster"
  | "leasing_performance_advisor"
  | "revenue_advisor"
  | "signals_officer"
  | "navigator"
  | "market_scout"
  | "product_readiness_officer"
  | "reputation_officer"
  | "resident_experience_officer"
  | "engineer"
  | "fleet_scribe_office";

export interface CaptainRuntimeSession {
  session_id: string;
  property_id: string;
  user_id: string;
  runtime_mode: CaptainRuntimeMode;
  started_at: string;
  ended_at: string | null;
  active_directive_snapshot: Record<string, unknown> | null;
  runtime_hash: string;
}

export interface CaptainInteraction {
  interaction_id: string;
  session_id: string;
  actor: CaptainActor;
  input_text: string;
  input_type: CaptainInputType;
  intent: CaptainInteractionIntent;
  subtype: string | null;
  timestamp: string;
  classification_confidence: number;
}

export interface CaptainEvidenceItem {
  evidence_id: string;
  evidence_class: EvidenceClass;
  source_key: string;
  source_table?: string | null;
  source_ref?: string | null;
  authority: AuthorityLevel;
  freshness: "current" | "stale" | "unknown" | "conflicting" | "blocked";
  confidence: number;
  summary: string;
  payload: Record<string, unknown>;
}

export interface CaptainEvidencePacket {
  evidence_packet_id: string;
  property_id: string;
  included_sources: string[];
  freshness_state: Record<string, unknown>;
  evidence_hash: string;
  generated_at: string;
  directive_snapshot_id: string | null;
  evidence: CaptainEvidenceItem[];
}

export interface CaptainReasoningRequest {
  request_id: string;
  interaction_id: string;
  allowed_outputs: string[];
  blocked_outputs: string[];
  authority_level: AuthorityLevel;
  runtime_mode: CaptainRuntimeMode;
  directive_snapshot: DirectiveResolutionOutput;
  evidence_packet_hash: string;
}

export interface CaptainRuntimePayload {
  payload_id: string;
  role_identity: string;
  runtime_authority: AuthorityLevel;
  directive: DirectiveResolutionOutput;
  property_context: Record<string, unknown>;
  evidence_packet: CaptainEvidencePacket;
  relevant_memory: Record<string, unknown>[];
  governance_constraints: {
    allowed_outputs: string[];
    blocked_outputs: string[];
    publishability_rules: string[];
    escalation_behavior: string[];
  };
  output_contract: string[];
}

export interface CaptainReasoningResponse {
  response_id: string;
  request_id: string;
  conversational_response: string;
  reasoning_summary: string;
  structured_outputs: Record<string, unknown>;
  confidence: number;
  publishability: Publishability;
  escalation_required: boolean;
  generated_at: string;
}

export interface CaptainMemoryCandidate {
  memory_candidate_id: string;
  source_interaction_id: string;
  candidate_type: string;
  confidence: number;
  verification_required: boolean;
  promotion_state: MemoryPromotionState;
  expires_at: string | null;
  conflict_state: "none" | "possible_conflict" | "conflict";
  source_evidence_hash: string;
}

export interface CaptainRoutingDecision {
  routing_id: string;
  interaction_id: string;
  target_lane: RoutingTargetLane;
  reason: string;
  status: "pending" | "routed" | "blocked" | "completed";
}

export interface CaptainAuditEvent {
  event_id: string;
  event_type: string;
  actor: string;
  interaction_id: string | null;
  timestamp: string;
  before_state: unknown;
  after_state: unknown;
}

export interface CaptainRuntimeInput {
  property_id: string;
  user_id: string;
  input_text: string;
  input_type?: CaptainInputType;
  runtime_mode?: CaptainRuntimeMode;
  actor?: CaptainActor;
  report_family?: string | null;
  correlation_id?: string | null;
  idempotency_key?: string | null;
}

export interface CaptainRuntimeResult {
  session: CaptainRuntimeSession;
  interaction: CaptainInteraction;
  evidence_packet: CaptainEvidencePacket;
  directive_resolution: DirectiveResolutionOutput;
  reasoning_request: CaptainReasoningRequest;
  runtime_payload: CaptainRuntimePayload;
  reasoning_response: CaptainReasoningResponse;
  memory_candidates: CaptainMemoryCandidate[];
  routing_decisions: CaptainRoutingDecision[];
  governance: {
    allowed_outputs: string[];
    blocked_outputs: string[];
    authority_level: AuthorityLevel;
    publishability: Publishability;
    escalation_required: boolean;
    checks: Array<{ check: string; status: "pass" | "warn" | "block"; reason: string }>;
  };
}
