import type {
  EvsCheckResult,
  EvsBatchRecord,
  EvsBatchRunRecord,
  EvsBatchTargetRecord,
  EvsDeviceProfile,
  EvsEvaluationSetRecord,
  EvsEvidenceRef,
  EvsFindingRecord,
  EvsExecutionMode,
  EvsGovernanceContext,
  EvsNormalizedResult,
  EvsPriority,
  EvsPropertyRecord,
  EvsProvider,
  EvsRawExecutionPayload,
  EvsRequestHandoffPayload,
  EvsResultStatus,
  EvsSeverity,
  EvsSourceConsumer,
  EvsSourceTruthSnapshotRecord,
  EvsValidationProfile,
  EvsValidationRequest,
  PropertyAdvocateEvsSummary,
} from "./evs-schemas";

export interface EvsProfileDefinition {
  id: EvsValidationProfile;
  name: string;
  description: string;
  goals: string[];
  supported_device_profiles: EvsDeviceProfile[];
  provider: EvsProvider;
}

export interface EvsRequestRecord {
  request_id: string;
  source_consumer: EvsSourceConsumer;
  property_id: string;
  environment: "staging" | "prod";
  reason: string;
  priority: EvsPriority;
  target_pages: string[];
  validation_profiles: EvsValidationProfile[];
  device_profiles: EvsDeviceProfile[];
  governance_context: EvsGovernanceContext | null;
  execution_mode: EvsExecutionMode;
  trigger_metadata: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  provider: EvsProvider;
  requested_by: string | null;
  orchestrator_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvsResultRecord {
  result_id: string;
  request_id: string;
  property_id: string;
  profile: EvsValidationProfile;
  environment: "staging" | "prod";
  status: EvsResultStatus;
  summary: string;
  severity: EvsSeverity;
  business_impact: string;
  recommended_action: string;
  evidence_refs: EvsEvidenceRef[];
  normalized_payload: EvsNormalizedResult;
  created_at: string;
}

export interface EvsExecutionPlan {
  request: EvsValidationRequest;
  property: EvsPropertyRecord;
  profiles: EvsProfileDefinition[];
  workflow_name: string;
  workflow_inputs: Record<string, string>;
}

export type EvsDispatchState =
  | "awaiting_handoff"
  | "handoff_recorded"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface EvsRequestRuntimeView extends EvsRequestRecord {
  dispatch_state: EvsDispatchState;
}

export interface EvsRequestHandoffRecord extends EvsRequestHandoffPayload {
  request: EvsRequestRuntimeView;
  execution_plan: EvsExecutionPlan;
}

export interface EvsProviderAdapter {
  id: EvsProvider;
  label: string;
  buildExecutionPlan(
    request: EvsValidationRequest,
    property: EvsPropertyRecord,
    profiles: EvsProfileDefinition[]
  ): EvsExecutionPlan;
}

export interface EvsNormalizationInput {
  request: EvsValidationRequest;
  raw: EvsRawExecutionPayload;
}

export interface EvsPropertyAdvocatePayload {
  property: EvsPropertyRecord;
  latest_validation: PropertyAdvocateEvsSummary | null;
  open_findings: EvsCheckResult[];
}

export interface CreateEvsEvaluationSetInput {
  key: string;
  name: string;
  description?: string | null;
  source_contract_path?: string | null;
  source_contract_hash?: string | null;
  default_profiles: EvsValidationProfile[];
  default_device_profiles: EvsDeviceProfile[];
  owner_lane: string;
  status?: EvsEvaluationSetRecord["status"];
  metadata?: Record<string, unknown>;
}

export interface CreateEvsBatchInput {
  evaluation_set_id?: string | null;
  name: string;
  environment: "staging" | "prod";
  source_label?: string | null;
  input_urls: string[];
  requested_by?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateEvsBatchTargetInput {
  batch_id: string;
  property_id?: string | null;
  property_name?: string | null;
  property_code?: string | null;
  target_url: string;
  identity_status: EvsBatchTargetRecord["identity_status"];
  site_os_version?: string | null;
  template_family?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateEvsBatchRunInput {
  batch_target_id: string;
  request_id?: string | null;
  profile: EvsValidationProfile;
  device_profile: EvsDeviceProfile;
  provider: "browserstack";
  provider_build_name?: string | null;
  raw_artifact_path?: string | null;
  status?: EvsBatchRunRecord["status"];
  started_at?: string | null;
}

export interface EvsBatchDetail {
  evaluation_set: EvsEvaluationSetRecord | null;
  batch: EvsBatchRecord;
  targets: EvsBatchTargetRecord[];
  runs: EvsBatchRunRecord[];
  findings: EvsFindingRecord[];
  source_truth_snapshots: EvsSourceTruthSnapshotRecord[];
}
