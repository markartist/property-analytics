import { z } from "zod";

export const PropertyBriefSourceDocumentTypeSchema = z.enum([
  "aptiq_operational_performance",
  "aptiq_leasing_strategy",
  "aptiq_market_ai",
  "data_pond_extract",
  "live_property_page",
  "captain_log",
  "operator_note",
  "other",
]);

export const PropertyBriefCadenceSchema = z.enum(["daily", "weekly", "monthly", "ad_hoc"]);

export const PropertyBriefClaimTypeSchema = z.enum([
  "metric",
  "market_position",
  "operational_diagnosis",
  "recommendation",
  "talking_point",
  "source_truth_conflict",
  "watch_item",
  "decision",
]);

export const PropertyBriefAuthoritySchema = z.enum([
  "data_pond",
  "aptiq",
  "live_property_page",
  "captain_log",
  "human",
  "other",
]);

export const PropertyBriefTruthStatusSchema = z.enum([
  "vendor_only",
  "pond_verified",
  "pond_overridden",
  "conflict",
  "needs_review",
  "rejected",
]);

export const PropertyBriefPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const PropertyBriefClaimStatusSchema = z.enum(["active", "resolved", "superseded", "archived"]);

export const PropertyBriefReconciliationStatusSchema = z.enum([
  "matched",
  "overridden_by_pond",
  "source_conflict",
  "insufficient_context",
  "accepted_advisory",
  "rejected",
]);

export const PropertyBriefArtifactBlockTypeSchema = z.enum([
  "truth_snapshot",
  "market_pressure",
  "operational_diagnosis",
  "revenue_concession_risk",
  "floorplan_watch",
  "leasing_moves",
  "marketing_moves",
  "captain_log_update",
  "open_conflicts",
]);

export const PropertyBriefArtifactReadinessSchema = z.enum(["draft", "review_required", "brief_ready", "blocked"]);
export const CaptainSupportAgentCadenceSchema = z.enum(["daily", "weekly", "monthly", "ad_hoc"]);
export const CaptainSupportAgentStatusSchema = z.enum(["active", "paused", "retired"]);
export const CaptainAgentRunTypeSchema = z.enum(["manual", "scheduled", "brief"]);
export const CaptainAgentRunStatusSchema = z.enum(["success", "warning", "failed", "skipped"]);
export const CaptainWatchItemSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const CaptainWatchItemStatusSchema = z.enum(["open", "monitoring", "escalated", "resolved", "superseded"]);
export const CaptainActionStatusSchema = z.enum(["open", "in_progress", "done", "blocked", "superseded"]);
export const CaptainBriefRunStatusSchema = z.enum(["draft", "ready", "sent", "blocked"]);
export const CaptainBriefTypeSchema = z.enum(["captain_brief", "supervisor_read"]);

export const CreatePropertyBriefSourceDocumentSchema = z.object({
  property_id: z.string().min(1),
  community_id: z.string().min(1).nullable().optional(),
  source_system: z.string().min(1),
  source_document_type: PropertyBriefSourceDocumentTypeSchema,
  source_filename: z.string().min(1).nullable().optional(),
  source_uri: z.string().min(1).nullable().optional(),
  source_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  data_through_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cadence: PropertyBriefCadenceSchema.nullable().optional(),
  raw_text_hash: z.string().min(1).nullable().optional(),
  storage_ref: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const CreatePropertyBriefClaimSchema = z.object({
  property_id: z.string().min(1),
  community_id: z.string().min(1).nullable().optional(),
  source_document_id: z.string().min(1).nullable().optional(),
  claim_type: PropertyBriefClaimTypeSchema,
  subject: z.string().min(1),
  statement: z.string().min(1),
  metric_code: z.string().min(1).nullable().optional(),
  metric_window: z.string().min(1).nullable().optional(),
  source_value: z.string().nullable().optional(),
  normalized_value: z.number().nullable().optional(),
  unit: z.string().min(1).nullable().optional(),
  authority: PropertyBriefAuthoritySchema,
  truth_status: PropertyBriefTruthStatusSchema,
  confidence: z.number().min(0).max(1),
  priority: PropertyBriefPrioritySchema.default("medium"),
  evidence: z.array(z.record(z.unknown())).nullable().optional(),
  recommended_action: z.string().nullable().optional(),
  owner_role: z.string().min(1).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: PropertyBriefClaimStatusSchema.default("active"),
});

export const CreatePropertyBriefReconciliationSchema = z.object({
  claim_id: z.string().min(1),
  truth_source: z.string().min(1),
  truth_ref: z.string().min(1),
  truth_value: z.string().nullable().optional(),
  reconciliation_status: PropertyBriefReconciliationStatusSchema,
  note: z.string().nullable().optional(),
});

export const CreatePropertyBriefArtifactBlockSchema = z.object({
  property_id: z.string().min(1),
  community_id: z.string().min(1).nullable().optional(),
  week_ending: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  block_type: PropertyBriefArtifactBlockTypeSchema,
  title: z.string().min(1),
  body: z.record(z.unknown()),
  source_claim_ids: z.array(z.string().min(1)),
  readiness_status: PropertyBriefArtifactReadinessSchema,
});

export const CreateCaptainSupportAgentSchema = z.object({
  property_id: z.string().min(1),
  captain_memory_entry_id: z.string().min(1).nullable().optional(),
  agent_key: z.string().min(1),
  agent_name: z.string().min(1),
  role: z.string().min(1),
  responsibility: z.string().min(1),
  source_scope: z.record(z.unknown()),
  cadence: CaptainSupportAgentCadenceSchema,
  status: CaptainSupportAgentStatusSchema.default("active"),
});

export const RunCaptainAgentSchema = z.object({
  agent_key: z.string().min(1).optional(),
  run_type: CaptainAgentRunTypeSchema.default("manual"),
});

export const CreateCaptainBriefRunSchema = z.object({
  brief_type: CaptainBriefTypeSchema.default("captain_brief"),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export type CreatePropertyBriefSourceDocument = z.infer<typeof CreatePropertyBriefSourceDocumentSchema>;
export type CreatePropertyBriefClaim = z.infer<typeof CreatePropertyBriefClaimSchema>;
export type CreatePropertyBriefReconciliation = z.infer<typeof CreatePropertyBriefReconciliationSchema>;
export type CreatePropertyBriefArtifactBlock = z.infer<typeof CreatePropertyBriefArtifactBlockSchema>;
export type CreateCaptainSupportAgent = z.infer<typeof CreateCaptainSupportAgentSchema>;
export type RunCaptainAgent = z.infer<typeof RunCaptainAgentSchema>;
export type CreateCaptainBriefRun = z.infer<typeof CreateCaptainBriefRunSchema>;
