export type DirectiveOfficeType =
  | "captain_office"
  | "regional_desk"
  | "fleet_desk"
  | "consulting_bench"
  | "fleet_scribe_office";

export type DirectiveApprovalStatus =
  | "draft"
  | "submitted_for_review"
  | "approved"
  | "active"
  | "rejected"
  | "retired"
  | "rolled_back";

export type DirectiveRuntimeMode =
  | "monitoring"
  | "lightweight"
  | "standard"
  | "escalated"
  | "executive"
  | "simulation";

export interface DirectiveConfidenceThresholds {
  minimumConfidence: number;
  publishableConfidence: number;
  escalationConfidenceBelow: number;
}

export interface DirectiveFreshnessTolerance {
  dailySourceMaxAgeDays: number;
  weeklySourceMaxAgeDays: number;
  monthlySourceMaxAgeDays: number;
  staleSourceAction: "block" | "escalate" | "warn";
}

export interface DirectivePublicationPermissions {
  canPublishExecutiveArtifact: boolean;
  canPublishInternalBrief: boolean;
  canPublishExternalMessage: boolean;
  requiresFleetScribe: boolean;
  requiresApprovalForMaterialChange: boolean;
}

export interface DirectiveExternalCommunicationPermissions {
  allowed: boolean;
  channels: string[];
  requiresApproval: boolean;
  notes: string;
}

export interface DirectiveProfile {
  role_id: string;
  role_name: string;
  office_type: DirectiveOfficeType;
  plain_role: string;
  purpose: string;
  decision_questions: string[];
  primary_sources: string[];
  advisory_sources: string[];
  output_contract: string;
  current_directive_setting: string;
  hard_guardrails: string[];
  do_not_allow_rules: string[];
  required_evidence: string[];
  confidence_thresholds: DirectiveConfidenceThresholds;
  freshness_tolerance: DirectiveFreshnessTolerance;
  escalation_triggers: string[];
  publication_permissions: DirectivePublicationPermissions;
  external_communication_permissions: DirectiveExternalCommunicationPermissions;
  report_family_applicability: string[];
  active_status: "active" | "paused" | "retired";
  owner: string;
  version: number;
  effective_date: string;
  retired_date: string | null;
  change_reason: string;
  approval_status: DirectiveApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
}

export interface DirectiveProfileRow {
  profile_id: string;
  role_id: string;
  role_name: string;
  office_type: DirectiveOfficeType;
  plain_role: string | null;
  owner: string;
  active_status: "active" | "paused" | "retired";
  current_active_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirectiveVersionRow {
  version_id: string;
  profile_id: string;
  role_id: string;
  version: number;
  approval_status: DirectiveApprovalStatus;
  purpose: string;
  decision_questions_json: string;
  primary_sources_json: string;
  advisory_sources_json: string;
  output_contract: string;
  current_directive_setting: string;
  hard_guardrails_json: string;
  do_not_allow_rules_json: string;
  required_evidence_json: string;
  confidence_thresholds_json: string;
  freshness_tolerance_json: string;
  escalation_triggers_json: string;
  publication_permissions_json: string;
  external_communication_permissions_json: string;
  report_family_applicability_json: string;
  effective_date: string;
  retired_date: string | null;
  change_reason: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata_json: string | null;
  directive_hash?: string | null;
}

export interface DirectiveValidationIssue {
  severity: "warning" | "blocking";
  role_id: string;
  field: string;
  message: string;
  recommended_fix: string;
}

export interface DirectiveValidationResult {
  status: "pass" | "fail";
  warnings: DirectiveValidationIssue[];
  blocking_errors: DirectiveValidationIssue[];
  recommended_fixes: DirectiveValidationIssue[];
}

export interface DirectiveResolutionInput {
  role_id: string;
  property_id?: string | null;
  report_family?: string | null;
  runtime_mode: DirectiveRuntimeMode;
  as_of_date: string;
  include_snapshot?: boolean;
  actor?: string | null;
  request_id?: string | null;
  correlation_id?: string | null;
}

export interface DirectiveResolutionOutput {
  active_directive_profile: DirectiveProfile;
  active_version: number;
  applicable_guardrails: string[];
  required_sources: string[];
  confidence_thresholds: DirectiveConfidenceThresholds;
  freshness_policy: DirectiveFreshnessTolerance;
  escalation_rules: string[];
  publication_permissions: DirectivePublicationPermissions;
  validation_status: DirectiveValidationResult;
  runtime_snapshot_id?: string;
  runtime_snapshot_hash?: string;
}

export interface DirectiveSimulationInput {
  role_id: string;
  draft_version_id?: string | null;
  sample_property_case: Record<string, unknown>;
  sample_source_freshness_state: Record<string, unknown>;
  sample_evidence_packet: Record<string, unknown>;
  report_family?: string | null;
  runtime_mode: DirectiveRuntimeMode;
  actor?: string | null;
  scenario_key: string;
  request_id?: string | null;
  correlation_id?: string | null;
}

export interface DirectiveSimulationOutput {
  simulation_result_id?: string;
  would_pass_validation: boolean;
  would_block_publication: boolean;
  would_require_escalation: boolean;
  guardrails_fired: string[];
  required_sources: string[];
  publishable_claims: string[];
  changed_vs_current_active: string[];
  validation_status: DirectiveValidationResult;
}
