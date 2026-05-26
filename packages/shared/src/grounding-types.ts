export type PropertyBriefSourceDocumentType =
  | "aptiq_operational_performance"
  | "aptiq_leasing_strategy"
  | "aptiq_market_ai"
  | "data_pond_extract"
  | "live_property_page"
  | "captain_log"
  | "operator_note"
  | "other";

export type PropertyBriefCadence = "daily" | "weekly" | "monthly" | "ad_hoc";

export type PropertyBriefClaimType =
  | "metric"
  | "market_position"
  | "operational_diagnosis"
  | "recommendation"
  | "talking_point"
  | "source_truth_conflict"
  | "watch_item"
  | "decision";

export type PropertyBriefAuthority =
  | "data_pond"
  | "aptiq"
  | "live_property_page"
  | "captain_log"
  | "human"
  | "other";

export type PropertyBriefTruthStatus =
  | "vendor_only"
  | "pond_verified"
  | "pond_overridden"
  | "conflict"
  | "needs_review"
  | "rejected";

export type PropertyBriefPriority = "low" | "medium" | "high" | "critical";
export type PropertyBriefClaimStatus = "active" | "resolved" | "superseded" | "archived";

export type PropertyBriefReconciliationStatus =
  | "matched"
  | "overridden_by_pond"
  | "source_conflict"
  | "insufficient_context"
  | "accepted_advisory"
  | "rejected";

export type PropertyBriefArtifactBlockType =
  | "truth_snapshot"
  | "market_pressure"
  | "operational_diagnosis"
  | "revenue_concession_risk"
  | "floorplan_watch"
  | "leasing_moves"
  | "marketing_moves"
  | "captain_log_update"
  | "open_conflicts";

export type PropertyBriefArtifactReadiness = "draft" | "review_required" | "brief_ready" | "blocked";
export type CaptainSupportAgentCadence = "daily" | "weekly" | "monthly" | "ad_hoc";
export type CaptainSupportAgentStatus = "active" | "paused" | "retired";
export type CaptainAgentRunType = "manual" | "scheduled" | "brief";
export type CaptainAgentRunStatus = "success" | "warning" | "failed" | "skipped";
export type CaptainWatchItemSeverity = "low" | "medium" | "high" | "critical";
export type CaptainWatchItemStatus = "open" | "monitoring" | "escalated" | "resolved" | "superseded";
export type CaptainActionStatus = "open" | "in_progress" | "done" | "blocked" | "superseded";
export type CaptainBriefRunStatus = "draft" | "ready" | "sent" | "blocked";
export type CaptainBriefType = "captain_brief" | "supervisor_read";

export interface PropertyBriefSourceDocument {
  id: string;
  property_id: string;
  community_id: string | null;
  source_system: string;
  source_document_type: PropertyBriefSourceDocumentType;
  source_filename: string | null;
  source_uri: string | null;
  source_date: string | null;
  data_through_date: string | null;
  cadence: PropertyBriefCadence | null;
  raw_text_hash: string | null;
  storage_ref: string | null;
  metadata_json: string | null;
  imported_at: string;
  imported_by: string | null;
}

export interface PropertyBriefClaim {
  id: string;
  property_id: string;
  community_id: string | null;
  source_document_id: string | null;
  claim_type: PropertyBriefClaimType;
  subject: string;
  statement: string;
  metric_code: string | null;
  metric_window: string | null;
  source_value: string | null;
  normalized_value: number | null;
  unit: string | null;
  authority: PropertyBriefAuthority;
  truth_status: PropertyBriefTruthStatus;
  confidence: number;
  priority: PropertyBriefPriority;
  evidence_json: string | null;
  recommended_action: string | null;
  owner_role: string | null;
  due_date: string | null;
  status: PropertyBriefClaimStatus;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface PropertyBriefReconciliation {
  id: string;
  claim_id: string;
  truth_source: string;
  truth_ref: string;
  truth_value: string | null;
  reconciliation_status: PropertyBriefReconciliationStatus;
  note: string | null;
  reconciled_at: string;
  reconciled_by: string | null;
}

export interface PropertyBriefArtifactBlock {
  id: string;
  property_id: string;
  community_id: string | null;
  week_ending: string | null;
  block_type: PropertyBriefArtifactBlockType;
  title: string;
  body_json: string;
  source_claim_ids_json: string;
  readiness_status: PropertyBriefArtifactReadiness;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface CaptainSupportAgent {
  id: string;
  property_id: string;
  captain_memory_entry_id: string | null;
  agent_key: string;
  agent_name: string;
  role: string;
  responsibility: string;
  source_scope_json: string;
  cadence: CaptainSupportAgentCadence;
  status: CaptainSupportAgentStatus;
  created_at: string;
  updated_at: string;
}

export interface CaptainAgentRun {
  id: string;
  property_id: string;
  community_id: string | null;
  agent_key: string;
  run_type: CaptainAgentRunType;
  run_status: CaptainAgentRunStatus;
  started_at: string;
  finished_at: string;
  source_window_start: string | null;
  source_window_end: string | null;
  findings_json: string;
  metrics_json: string;
  exceptions_json: string;
  created_by: string | null;
  created_at: string;
}

export interface CaptainWatchItem {
  id: string;
  property_id: string;
  community_id: string | null;
  watch_key: string;
  title: string;
  category: string;
  severity: CaptainWatchItemSeverity;
  status: CaptainWatchItemStatus;
  current_state: string;
  evidence_json: string;
  next_move: string | null;
  owner_role: string | null;
  due_date: string | null;
  source_agent_key: string | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface CaptainAction {
  id: string;
  property_id: string;
  community_id: string | null;
  action_key: string;
  title: string;
  owner_role: string;
  due_date: string | null;
  status: CaptainActionStatus;
  priority: CaptainWatchItemSeverity;
  evidence_json: string;
  source_agent_key: string | null;
  created_from_run_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface CaptainBriefRun {
  id: string;
  property_id: string;
  community_id: string | null;
  run_status: CaptainBriefRunStatus;
  brief_type: CaptainBriefType;
  period_start: string | null;
  period_end: string | null;
  memory_entry_id: string | null;
  summary: string;
  payload_json: string;
  artifact_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
