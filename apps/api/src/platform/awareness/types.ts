export type AgentType = "captain" | "commodore" | "fleet" | "expert_lane" | "scribe";
export type AgentActiveStatus = "active" | "retired";
export type CharterApprovalStatus = "draft" | "approved" | "retired";

export type MemoryClass =
  | "evidence_memory"
  | "working_memory"
  | "property_memory"
  | "human_submitted_memory"
  | "agent_self_note"
  | "commitment_memory"
  | "relationship_context"
  | "regional_awareness"
  | "communal_pattern"
  | "doctrine_candidate"
  | "doctrine"
  | "archived_memory";

export type MemoryLifecycleState =
  | "raw_input"
  | "parsed_claim"
  | "candidate"
  | "working"
  | "verified"
  | "accepted_operational_context"
  | "report_eligible"
  | "doctrine_candidate"
  | "approved_doctrine"
  | "archived"
  | "expired"
  | "rejected"
  | "superseded";

export type MemoryAllowedUse =
  | "captain_reasoning"
  | "expert_read_context"
  | "navigator_review"
  | "quartermaster_review"
  | "product_readiness_review"
  | "fleet_summary"
  | "regional_summary"
  | "scribe_input"
  | "public_copy"
  | "report_publication"
  | "historical_review"
  | "self_reminder";

export type MemorySensitivity = "low" | "internal" | "sensitive" | "restricted";
export type MemoryVisibilityScope = "private_to_agent" | "property_team_visible" | "region_visible" | "fleet_visible";
export type FreshnessState = "current" | "stale" | "expired" | "unknown";

export interface CareMetadata {
  do_not_overstate: boolean;
  ask_before_public_use: boolean;
  avoid_person_judgment: boolean;
  temporary_context: boolean;
  sensitive_context: boolean;
  share_as_pattern_only: boolean;
  requires_human_review: boolean;
  preferred_tone: string;
  correction_allowed_by_roles: string[];
}

export interface AgentIdentity {
  agent_id: string;
  agent_type: AgentType;
  display_name: string;
  formal_title: string;
  assigned_property_id: string | null;
  assigned_region_id: string | null;
  assigned_lane_id: string | null;
  active_status: AgentActiveStatus;
  created_at: string;
  retired_at: string | null;
  identity_version: number;
}

export interface AgentCharter {
  charter_id: string;
  agent_id: string;
  sphere_of_responsibility: string;
  sphere_of_knowledge: string;
  sphere_of_action: string;
  sphere_of_memory: string;
  visibility_scope: MemoryVisibilityScope;
  allowed_actions: string[];
  blocked_actions: string[];
  allowed_memory_classes: MemoryClass[];
  blocked_memory_classes: MemoryClass[];
  authority_boundaries: string[];
  care_obligations: string[];
  escalation_obligations: string[];
  steward_roles: string[];
  effective_date: string;
  version: number;
  approval_status: CharterApprovalStatus;
}

export interface MemoryItem {
  memory_id: string;
  memory_class: MemoryClass;
  lifecycle_state: MemoryLifecycleState;
  property_id: string | null;
  region_id: string | null;
  agent_id: string;
  source_type: string;
  source_ref: string | null;
  statement: string;
  structured_claim: Record<string, unknown> | null;
  confidence: number;
  freshness_state: FreshnessState;
  sensitivity: MemorySensitivity;
  visibility_scope: MemoryVisibilityScope;
  allowed_uses: MemoryAllowedUse[];
  blocked_uses: MemoryAllowedUse[];
  steward: string;
  verification_required: boolean;
  correction_path: string;
  fresh_until: string | null;
  expires_at: string | null;
  revalidation_due_at: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  superseded_by: string | null;
  evidence_refs: string[];
  directive_refs: string[];
  care_metadata: CareMetadata;
  created_at: string;
  updated_at: string;
}

export type SelfNoteType =
  | "reminder"
  | "caution"
  | "lesson"
  | "open_question"
  | "follow_up"
  | "working_hypothesis"
  | "do_not_repeat"
  | "verification_needed";

export interface AgentSelfNote {
  note_id: string;
  agent_id: string;
  property_id: string | null;
  region_id: string | null;
  note_text: string;
  note_type: SelfNoteType;
  importance: number;
  visibility: MemoryVisibilityScope;
  reminder_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
  source_context: string | null;
  related_memory_id: string | null;
  related_interaction_id: string | null;
  related_expert_read_id: string | null;
  care_metadata: CareMetadata;
  created_at: string;
}

export type CommitmentStatus = "open" | "waiting" | "completed" | "blocked" | "expired" | "archived";

export interface CommitmentMemory {
  commitment_id: string;
  agent_id: string;
  property_id: string | null;
  region_id: string | null;
  commitment_type: string;
  description: string;
  owed_by: string;
  owed_to: string;
  due_at: string | null;
  status: CommitmentStatus;
  source_ref: string | null;
  related_memory_id: string | null;
  related_interaction_id: string | null;
  related_expert_read_id: string | null;
  care_metadata: CareMetadata;
  created_at: string;
  updated_at: string;
}

export interface MemoryPosture {
  agent_identity: AgentIdentity | null;
  active_concerns: MemoryItem[];
  open_questions: AgentSelfNote[];
  active_self_notes: AgentSelfNote[];
  open_commitments: CommitmentMemory[];
  recent_human_submitted_claims: MemoryItem[];
  stale_or_expiring_memory: MemoryItem[];
  verification_needed_items: Array<MemoryItem | AgentSelfNote>;
  unresolved_conflicts: MemoryItem[];
  recent_lessons: AgentSelfNote[];
  archived_superseded_highlights: MemoryItem[];
  regional_awareness_summary: RegionalAwarenessSummary | null;
  uncertainties: string[];
  do_not_recommend_without_more_evidence: string[];
  care_warnings: string[];
}

export interface RegionalAwarenessSummary {
  summary_id: string;
  region_id: string;
  generated_at: string;
  summary_period: string;
  steward_agent_id: string;
  source_property_count: number;
  pattern_summary: string;
  sibling_property_cards: SiblingPropertyAwarenessCard[];
  market_context: string;
  shared_risks: string[];
  successful_tactics: string[];
  cautionary_notes: string[];
  evidence_refs: string[];
  visibility_scope: MemoryVisibilityScope;
  freshness_state: FreshnessState;
  expires_at: string | null;
}

export interface SiblingPropertyAwarenessCard {
  property_id: string;
  posture_label: string;
  surface_summary: string;
  comparable_conditions: string;
  useful_tactic: string;
  caution: string;
  confidence: number;
  visibility_scope: MemoryVisibilityScope;
}

export type DoctrineCandidateStatus = "proposed" | "under_review" | "accepted" | "rejected" | "archived";

export interface DoctrineCandidate {
  doctrine_candidate_id: string;
  title: string;
  pattern_statement: string;
  source_scope: "property" | "region" | "fleet";
  supporting_memory_refs: string[];
  supporting_evidence_refs: string[];
  confidence: number;
  proposed_by_agent_id: string;
  steward_agent_id: string;
  status: DoctrineCandidateStatus;
  care_review_required: boolean;
  created_at: string;
}

export interface MemoryGovernanceResult {
  allowed: boolean;
  blocked_reason: string | null;
  warnings: string[];
  care_rule_triggered: string | null;
}
