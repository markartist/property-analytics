import type { DirectiveResolutionOutput, DirectiveRuntimeMode } from "../directives/types";
import type { AuthorityLevel, CaptainEvidencePacket, Publishability } from "../captain-runtime/types";

export type ExpertLaneId =
  | "quartermaster"
  | "navigator"
  | "revenue_advisor"
  | "signals_officer"
  | "market_scout"
  | "product_readiness_officer"
  | "reputation_officer"
  | "resident_experience_officer"
  | "engineer"
  | "seasonality_demand_timing_advisor"
  | "unit_type_fit_advisor"
  | "market_elasticity_advisor"
  | "operational_capacity_advisor"
  | "trust_and_proof_advisor"
  | "peer_borrowing_advisor"
  | "leasing_performance_advisor";

export type ExpertReadStatus = "requested" | "in_progress" | "final" | "blocked" | "failed";
export type ExpertReadFreshnessState = "current" | "stale" | "conflicting" | "blocked" | "unknown";
export type ExpertReadRoutingMode =
  | "no_expert_needed"
  | "optional_expert_read"
  | "required_expert_read"
  | "blocked_pending_expert_read";

export interface ExpertReadRequest {
  request_id: string;
  property_id: string;
  requested_by: string;
  source_runtime_id: string | null;
  source_interaction_id: string | null;
  lane_id: ExpertLaneId;
  runtime_mode: DirectiveRuntimeMode;
  report_family: string | null;
  reason: string;
  requested_at: string;
  directive_snapshot_id: string;
  directive_snapshot_hash: string;
  evidence_packet_id: string;
  evidence_packet_hash: string;
  request_hash: string;
}

export interface ExpertReadFinding {
  finding_id: string;
  expert_read_id: string;
  finding_type: string;
  statement: string;
  evidence_refs: string[];
  confidence: number;
  freshness: ExpertReadFreshnessState;
  publishability: Publishability;
  verification_required: boolean;
}

export interface ExpertReadRecommendation {
  recommendation_id: string;
  expert_read_id: string;
  recommendation_type: string;
  recommendation_text: string;
  evidence_refs: string[];
  proof_metric: string | null;
  owner_lane: ExpertLaneId;
  confidence: number;
  blocked_reason: string | null;
  publishability: Publishability;
}

export interface ExpertRead {
  expert_read_id: string;
  request_id: string;
  lane_id: ExpertLaneId;
  property_id: string;
  read_status: ExpertReadStatus;
  specialist_summary: string;
  findings: ExpertReadFinding[];
  recommendations: ExpertReadRecommendation[];
  do_not_do_rules: string[];
  required_evidence: string[];
  evidence_used: string[];
  confidence: number;
  freshness_state: ExpertReadFreshnessState;
  publishability: Publishability;
  escalation_required: boolean;
  conflicts: string[];
  generated_at: string;
  read_hash: string;
}

export interface ExpertReadAuditEvent {
  event_id: string;
  event_type: string;
  request_id: string | null;
  expert_read_id: string | null;
  lane_id: ExpertLaneId | null;
  actor: string;
  timestamp: string;
  before_state: unknown;
  after_state: unknown;
  reason: string | null;
  correlation_id: string | null;
  evidence_hash?: string | null;
  directive_hash?: string | null;
  read_hash?: string | null;
}

export interface ExpertLaneContract {
  lane_id: ExpertLaneId;
  display_name: string;
  adjustment_point: string;
  required_output_sections: string[];
  required_evidence_sources: string[];
  blocked_patterns: string[];
  default_do_not_do_rules: string[];
}

export interface ExpertLaneResolution {
  lane_id: ExpertLaneId;
  directive: DirectiveResolutionOutput;
  contract: ExpertLaneContract;
  required_evidence: string[];
  allowed_outputs: string[];
  blocked_outputs: string[];
  freshness_policy: DirectiveResolutionOutput["freshness_policy"];
  confidence_thresholds: DirectiveResolutionOutput["confidence_thresholds"];
  escalation_rules: string[];
  publication_constraints: DirectiveResolutionOutput["publication_permissions"];
  directive_snapshot_id: string;
  directive_snapshot_hash: string;
}

export interface ExpertReadInput {
  property_id: string;
  requested_by: string;
  lane_id: ExpertLaneId;
  evidence_packet_id: string;
  runtime_mode?: DirectiveRuntimeMode;
  report_family?: string | null;
  reason: string;
  source_runtime_id?: string | null;
  source_interaction_id?: string | null;
  correlation_id?: string | null;
}

export interface ExpertReadGovernanceCheck {
  check: string;
  status: "pass" | "warn" | "block";
  reason: string;
  affected_evidence_refs?: string[];
}

export interface ExpertReadGovernanceResult {
  authority_level: AuthorityLevel;
  publishability: Publishability;
  escalation_required: boolean;
  allowed_outputs: string[];
  blocked_outputs: string[];
  checks: ExpertReadGovernanceCheck[];
}

export interface ExpertReasoningPayload {
  payload_id: string;
  lane_id: ExpertLaneId;
  role_identity: string;
  directive_snapshot_id: string;
  directive_snapshot_hash: string;
  evidence_packet: CaptainEvidencePacket;
  contract: ExpertLaneContract;
  governance: ExpertReadGovernanceResult;
  output_contract: string[];
}

export interface ExpertReadResult {
  request: ExpertReadRequest;
  lane_resolution: ExpertLaneResolution;
  evidence_packet: CaptainEvidencePacket;
  governance: ExpertReadGovernanceResult;
  payload: ExpertReasoningPayload;
  expert_read: ExpertRead;
}

export type ExpertReadValidationErrorCode =
  | "missing_required_field"
  | "invalid_enum"
  | "invalid_confidence"
  | "invalid_publishability"
  | "invalid_lineage"
  | "oversized_output"
  | "unsupported_publishable_claim"
  | "contradictory_state";
