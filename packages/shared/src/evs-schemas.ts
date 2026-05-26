import { z } from "zod";

export const EvsSourceConsumer = z.enum([
  "property_advocate",
  "deploy_pipeline",
  "governance_audit",
  "operator",
]);
export type EvsSourceConsumer = z.infer<typeof EvsSourceConsumer>;

export const EvsEnvironment = z.enum(["staging", "prod"]);
export type EvsEnvironment = z.infer<typeof EvsEnvironment>;

export const EvsPriority = z.enum(["low", "normal", "high", "urgent"]);
export type EvsPriority = z.infer<typeof EvsPriority>;

export const EvsExecutionMode = z.enum(["manual", "post_deploy", "scheduled"]);
export type EvsExecutionMode = z.infer<typeof EvsExecutionMode>;

export const EvsRequestStatus = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type EvsRequestStatus = z.infer<typeof EvsRequestStatus>;

export const EvsBatchStatus = z.enum(["planned", "running", "completed", "failed", "cancelled"]);
export type EvsBatchStatus = z.infer<typeof EvsBatchStatus>;

export const EvsEvaluationSetStatus = z.enum(["draft", "active", "retired"]);
export type EvsEvaluationSetStatus = z.infer<typeof EvsEvaluationSetStatus>;

export const EvsBatchTargetStatus = z.enum(["queued", "running", "completed", "failed", "cancelled", "skipped"]);
export type EvsBatchTargetStatus = z.infer<typeof EvsBatchTargetStatus>;

export const EvsIdentityStatus = z.enum(["resolved", "unresolved", "ambiguous", "manual"]);
export type EvsIdentityStatus = z.infer<typeof EvsIdentityStatus>;

export const EvsResultStatus = z.enum(["pass", "fail"]);
export type EvsResultStatus = z.infer<typeof EvsResultStatus>;

export const EvsSeverity = z.enum(["info", "low", "medium", "high", "critical"]);
export type EvsSeverity = z.infer<typeof EvsSeverity>;

export const EvsCheckStatus = z.enum(["pass", "fail", "warn", "skipped"]);
export type EvsCheckStatus = z.infer<typeof EvsCheckStatus>;

export const EvsProvider = z.enum(["browserstack"]);
export type EvsProvider = z.infer<typeof EvsProvider>;

export const EvsDeviceProfile = z.enum(["iphone_safari", "desktop_chrome"]);
export type EvsDeviceProfile = z.infer<typeof EvsDeviceProfile>;

export const EvsValidationProfile = z.enum([
  "broad_experiential_homepage",
  "critical_cta_smoke",
  "header_navigation_integrity",
  "portfolio_functionality_regression",
  "apartments_pricing_deep_journey",
  "apartments_pricing_mobile_journey",
  "contact_form_checks",
  "lead_attribution_e2e",
]);
export type EvsValidationProfile = z.infer<typeof EvsValidationProfile>;

export const EvsGovernanceContext = z.object({
  site_archetype_id: z.string().min(1).optional(),
  page_type_id: z.string().min(1).optional(),
  layout_version: z.string().min(1).optional(),
  section: z.string().min(1).optional(),
  block: z.string().min(1).optional(),
  subsection: z.string().min(1).optional(),
}).strict();
export type EvsGovernanceContext = z.infer<typeof EvsGovernanceContext>;

export const EvsEvidenceRef = z.object({
  kind: z.enum(["browserstack_session", "video", "screenshot", "log", "network", "artifact"]),
  label: z.string().min(1),
  url: z.string().url(),
  provider: EvsProvider.optional(),
}).strict();
export type EvsEvidenceRef = z.infer<typeof EvsEvidenceRef>;

export const EvsCheckResult = z.object({
  check_id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum([
    "page_load",
    "button",
    "link",
    "navigation",
    "carousel",
    "video",
    "media",
    "tour",
    "form_entry",
    "javascript",
    "rendering",
    "conversion_path",
  ]),
  status: EvsCheckStatus,
  severity: EvsSeverity,
  message: z.string().min(1),
  target_label: z.string().optional(),
  target_url: z.string().url().optional(),
  selector_hint: z.string().optional(),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
  metadata: z.record(z.unknown()).default({}),
}).strict();
export type EvsCheckResult = z.infer<typeof EvsCheckResult>;

export const EvsDeviceResult = z.object({
  device_profile: EvsDeviceProfile,
  status: EvsResultStatus,
  summary: z.string().min(1),
  provider: EvsProvider,
  duration_ms: z.number().int().nonnegative(),
  check_results: z.array(EvsCheckResult).min(1),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
  provider_session_id: z.string().optional(),
  provider_job_url: z.string().url().optional(),
}).strict();
export type EvsDeviceResult = z.infer<typeof EvsDeviceResult>;

export const EvsValidationRequest = z.object({
  request_id: z.string().min(1),
  source_consumer: EvsSourceConsumer,
  property_id: z.string().min(1),
  environment: EvsEnvironment,
  reason: z.string().min(1),
  priority: EvsPriority,
  target_pages: z.array(z.string().url()).min(1),
  validation_profiles: z.array(EvsValidationProfile).min(1),
  device_profiles: z.array(EvsDeviceProfile).min(1),
  governance_context: EvsGovernanceContext.optional(),
  execution_mode: EvsExecutionMode,
  trigger_metadata: z.record(z.unknown()).default({}),
}).strict();
export type EvsValidationRequest = z.infer<typeof EvsValidationRequest>;

export const CreateEvsValidationRequestPayload = EvsValidationRequest.omit({
  request_id: true,
}).extend({
  requested_by: z.string().min(1).optional(),
});
export type CreateEvsValidationRequestPayload = z.infer<typeof CreateEvsValidationRequestPayload>;

export const EvsRequestHandoffPayload = z.object({
  orchestrator_ref: z.string().min(1),
  status: z.enum(["queued", "running"]).default("running"),
}).strict();
export type EvsRequestHandoffPayload = z.infer<typeof EvsRequestHandoffPayload>;

export const EvsNormalizedResult = z.object({
  result_id: z.string().min(1),
  request_id: z.string().min(1),
  status: EvsResultStatus,
  summary: z.string().min(1),
  profile: EvsValidationProfile,
  environment: EvsEnvironment,
  device_results: z.array(EvsDeviceResult).min(1),
  check_results: z.array(EvsCheckResult).min(1),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
  governance_mapping: EvsGovernanceContext.optional(),
  severity: EvsSeverity,
  business_impact: z.string().min(1),
  recommended_action: z.string().min(1),
}).strict();
export type EvsNormalizedResult = z.infer<typeof EvsNormalizedResult>;

export const EvsRawInteractionFinding = z.object({
  check_id: z.string().min(1).optional(),
  kind: z.string().min(1),
  label: z.string().min(1),
  selector_hint: z.string().optional(),
  href: z.string().url().optional(),
  status: z.enum(["pass", "fail", "warn", "skipped"]),
  message: z.string().min(1),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
  metadata: z.record(z.unknown()).default({}),
}).strict();
export type EvsRawInteractionFinding = z.infer<typeof EvsRawInteractionFinding>;

export const EvsRawDeviceExecution = z.object({
  device_profile: EvsDeviceProfile,
  provider: EvsProvider,
  provider_session_id: z.string().optional(),
  provider_job_url: z.string().url().optional(),
  duration_ms: z.number().int().nonnegative(),
  fatal_error: z.string().optional(),
  findings: z.array(EvsRawInteractionFinding).default([]),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
}).strict();
export type EvsRawDeviceExecution = z.infer<typeof EvsRawDeviceExecution>;

export const EvsRawExecutionPayload = z.object({
  request_id: z.string().min(1),
  property_id: z.string().min(1),
  profile: EvsValidationProfile,
  environment: EvsEnvironment,
  target_url: z.string().url(),
  started_at: z.string().min(1),
  finished_at: z.string().min(1),
  device_runs: z.array(EvsRawDeviceExecution).min(1),
}).strict();
export type EvsRawExecutionPayload = z.infer<typeof EvsRawExecutionPayload>;

export const EvsEvaluationSetRecord = z.object({
  evaluation_set_id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  source_contract_path: z.string().nullable(),
  source_contract_hash: z.string().nullable(),
  default_profiles: z.array(EvsValidationProfile),
  default_device_profiles: z.array(EvsDeviceProfile),
  owner_lane: z.string().min(1),
  status: EvsEvaluationSetStatus,
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();
export type EvsEvaluationSetRecord = z.infer<typeof EvsEvaluationSetRecord>;

export const EvsBatchRecord = z.object({
  batch_id: z.string().min(1),
  evaluation_set_id: z.string().nullable(),
  name: z.string().min(1),
  environment: EvsEnvironment,
  source_label: z.string().nullable(),
  input_urls: z.array(z.string().url()),
  status: EvsBatchStatus,
  requested_by: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();
export type EvsBatchRecord = z.infer<typeof EvsBatchRecord>;

export const EvsBatchTargetRecord = z.object({
  batch_target_id: z.string().min(1),
  batch_id: z.string().min(1),
  property_id: z.string().nullable(),
  property_name: z.string().nullable(),
  property_code: z.string().nullable(),
  target_url: z.string().url(),
  identity_status: EvsIdentityStatus,
  site_os_version: z.string().nullable(),
  template_family: z.string().nullable(),
  status: EvsBatchTargetStatus,
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();
export type EvsBatchTargetRecord = z.infer<typeof EvsBatchTargetRecord>;

export const EvsBatchRunRecord = z.object({
  batch_run_id: z.string().min(1),
  batch_target_id: z.string().min(1),
  request_id: z.string().nullable(),
  profile: EvsValidationProfile,
  device_profile: EvsDeviceProfile,
  provider: EvsProvider,
  provider_build_name: z.string().nullable(),
  raw_artifact_path: z.string().nullable(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  classification: z.string().nullable(),
  duration_ms: z.number().int().nonnegative().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();
export type EvsBatchRunRecord = z.infer<typeof EvsBatchRunRecord>;

export const EvsFindingRecord = z.object({
  finding_id: z.string().min(1),
  batch_run_id: z.string().nullable(),
  request_id: z.string().nullable(),
  property_id: z.string().nullable(),
  profile: EvsValidationProfile,
  device_profile: EvsDeviceProfile,
  check_id: z.string().min(1),
  category: EvsCheckResult.shape.category,
  owner_lane: z.string().nullable(),
  status: EvsCheckStatus,
  severity: EvsSeverity,
  label: z.string().min(1),
  message: z.string().min(1),
  source_workbook: z.string().nullable(),
  source_sheet: z.string().nullable(),
  source_row: z.number().int().nullable(),
  assertion_type: z.string().nullable(),
  side_effect_policy: z.string().nullable(),
  classification: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
  created_at: z.string().min(1),
}).strict();
export type EvsFindingRecord = z.infer<typeof EvsFindingRecord>;

export const EvsSourceTruthSnapshotRecord = z.object({
  source_truth_snapshot_id: z.string().min(1),
  batch_id: z.string().min(1),
  kind: z.string().min(1),
  source_system: z.string().min(1),
  artifact_path: z.string().min(1),
  generated_at: z.string().nullable(),
  summary: z.record(z.unknown()).default({}),
  created_at: z.string().min(1),
}).strict();
export type EvsSourceTruthSnapshotRecord = z.infer<typeof EvsSourceTruthSnapshotRecord>;

export const EvsPropertyRecord = z.object({
  property_id: z.string().min(1),
  property_name: z.string().min(1),
  community_id: z.string().min(1).nullable().optional(),
  legacy_url: z.string().url().nullable().optional(),
  staging_url: z.string().url(),
  live_url: z.string().url().nullable().optional(),
  site_type: z.enum(["resi", "legacy"]).optional(),
  known_page_paths: z.array(z.string().min(1)).optional(),
  cohort: z.literal("pilot"),
  active: z.boolean().default(true),
}).strict();
export type EvsPropertyRecord = z.infer<typeof EvsPropertyRecord>;

export const PropertyAdvocateEvsSummary = z.object({
  property_id: z.string().min(1),
  property_name: z.string().min(1),
  staging_url: z.string().url(),
  latest_request_id: z.string().nullable(),
  latest_result_id: z.string().nullable(),
  latest_status: EvsResultStatus.nullable(),
  latest_severity: EvsSeverity.nullable(),
  latest_summary: z.string().nullable(),
  latest_recommended_action: z.string().nullable(),
  last_validated_at: z.string().nullable(),
  profile: EvsValidationProfile.nullable(),
  evidence_refs: z.array(EvsEvidenceRef).default([]),
}).strict();
export type PropertyAdvocateEvsSummary = z.infer<typeof PropertyAdvocateEvsSummary>;
