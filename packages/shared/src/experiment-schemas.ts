import { z } from "zod";

export const EdgeExperimentStatus = z.enum([
  "draft",
  "pending_preflight",
  "preflight_failed",
  "ready_for_approval",
  "approved",
  "scheduled",
  "running",
  "paused",
  "rolled_back",
  "completed",
  "promoted",
  "rejected",
  "archived",
]);
export type EdgeExperimentStatus = z.infer<typeof EdgeExperimentStatus>;

export const EdgeExperimentChangeType = z.enum([
  "text_swap",
  "class_swap",
  "href_swap",
  "insert_adjacent",
]);
export type EdgeExperimentChangeType = z.infer<typeof EdgeExperimentChangeType>;

export const EdgeExperimentAssignmentUnit = z.enum(["anonymous_visitor", "session"]);
export type EdgeExperimentAssignmentUnit = z.infer<typeof EdgeExperimentAssignmentUnit>;

export const EdgeExperimentVariantAction = z.enum([
  "none",
  "text_swap",
  "class_swap",
  "href_swap",
  "insert_adjacent",
]);
export type EdgeExperimentVariantAction = z.infer<typeof EdgeExperimentVariantAction>;

export const EdgeExperimentGuardrailStatus = z.enum([
  "not_evaluated",
  "healthy",
  "watch",
  "breach",
  "paused",
]);
export type EdgeExperimentGuardrailStatus = z.infer<typeof EdgeExperimentGuardrailStatus>;

export const EdgeExperimentDecision = z.enum([
  "continue",
  "pause",
  "rollback",
  "stop_no_winner",
  "promote_variant",
  "promote_learning_only",
  "reject",
  "archive",
]);
export type EdgeExperimentDecision = z.infer<typeof EdgeExperimentDecision>;

export const EdgeExperimentVariantPayload = z.object({
  text: z.string().min(1).max(160).optional(),
  class_name: z.string().min(1).max(160).optional(),
  href: z.string().min(1).max(500).optional(),
  tag: z.enum(["a", "button", "span"]).optional(),
  position: z.enum(["before", "after"]).optional(),
}).strict();
export type EdgeExperimentVariantPayload = z.infer<typeof EdgeExperimentVariantPayload>;

export const EdgeExperimentVariant = z.object({
  variant_id: z.string().min(1),
  experiment_id: z.string().min(1),
  variant_key: z.string().min(1),
  allocation_pct: z.number().int().min(0).max(100),
  action: EdgeExperimentVariantAction,
  target_selector: z.string().min(1),
  target_component_id: z.string().min(1),
  payload_json: z.record(z.unknown()),
  html_safety_hash: z.string().nullable().optional(),
  accessibility_notes: z.string().nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();
export type EdgeExperimentVariant = z.infer<typeof EdgeExperimentVariant>;

export const EdgeExperiment = z.object({
  experiment_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  hypothesis: z.string().nullable().optional(),
  status: EdgeExperimentStatus,
  property_code: z.string().min(1),
  community_id: z.string().nullable().optional(),
  website_host: z.string().nullable().optional(),
  page_type: z.string().min(1),
  page_path: z.string().min(1),
  component_id: z.string().min(1),
  component_contract_source: z.string().min(1),
  change_type: EdgeExperimentChangeType,
  primary_metric: z.string().min(1),
  guardrail_policy_id: z.string().min(1),
  traffic_split_pct: z.number().int().min(1).max(99),
  assignment_unit: EdgeExperimentAssignmentUnit,
  rollback_owner: z.string().nullable().optional(),
  created_by: z.string().min(1),
  approved_by: z.string().nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  approved_at: z.string().nullable().optional(),
  scheduled_start_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  decision: EdgeExperimentDecision.nullable().optional(),
  decision_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  variants: z.array(EdgeExperimentVariant).default([]),
}).strict();
export type EdgeExperiment = z.infer<typeof EdgeExperiment>;

export const EdgeExperimentComponentContract = z.object({
  component_contract_id: z.string().min(1),
  component_id: z.string().min(1),
  page_type: z.string().min(1),
  page_path: z.string().nullable().optional(),
  page_path_key: z.string(),
  selector: z.string().min(1),
  allowed_change_types: z.array(EdgeExperimentChangeType),
  required_accessibility_checks: z.array(z.string().min(1)),
  source: z.string().min(1),
  source_reference: z.string().nullable().optional(),
  status: z.string().min(1),
  last_verified_at: z.string().nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
}).strict();
export type EdgeExperimentComponentContract = z.infer<typeof EdgeExperimentComponentContract>;

export const EdgeExperimentReadiness = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pass", "warning", "fail", "not_run"]),
  note: z.string().optional(),
}).strict();
export type EdgeExperimentReadiness = z.infer<typeof EdgeExperimentReadiness>;

export const EdgeExperimentSummary = z.object({
  total: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  contracts: z.number().int().nonnegative(),
}).strict();
export type EdgeExperimentSummary = z.infer<typeof EdgeExperimentSummary>;

export const CreateEdgeExperimentDraftPayload = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(1000).optional(),
  hypothesis: z.string().min(10).max(1000),
  property_code: z.string().min(1).max(40),
  community_id: z.string().min(1).optional(),
  website_host: z.string().min(1).max(200).optional(),
  page_type: z.string().min(1).default("property_homepage"),
  page_path: z.string().min(1).max(500),
  component_id: z.string().min(1),
  change_type: EdgeExperimentChangeType,
  primary_metric: z.string().min(1).max(120),
  guardrail_policy_id: z.string().min(1).default("mvp_default_guardrails"),
  traffic_split_pct: z.number().int().min(10).max(90).default(50),
  assignment_unit: EdgeExperimentAssignmentUnit.default("anonymous_visitor"),
  rollback_owner: z.string().min(1).max(200).optional(),
  variant: z.object({
    variant_key: z.string().min(1).max(40).default("B"),
    action: EdgeExperimentVariantAction.exclude(["none"]),
    payload: EdgeExperimentVariantPayload,
  }).strict(),
  notes: z.string().max(1000).optional(),
}).strict();
export type CreateEdgeExperimentDraftPayload = z.infer<typeof CreateEdgeExperimentDraftPayload>;

export const EdgeExperimentListResponse = z.object({
  experiments: z.array(EdgeExperiment),
  component_contracts: z.array(EdgeExperimentComponentContract),
  summary: EdgeExperimentSummary,
}).strict();
export type EdgeExperimentListResponse = z.infer<typeof EdgeExperimentListResponse>;

export const EdgeExperimentDetailResponse = z.object({
  experiment: EdgeExperiment,
  component_contract: EdgeExperimentComponentContract.nullable(),
  readiness: z.array(EdgeExperimentReadiness),
}).strict();
export type EdgeExperimentDetailResponse = z.infer<typeof EdgeExperimentDetailResponse>;
