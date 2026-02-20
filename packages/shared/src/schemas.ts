import { z } from "zod";

// -- Shared validators --

/** Validates that a date string (YYYY-MM-DD) falls on a Friday. Per ADR-0002. */
export const fridayDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").refine(
  (val) => new Date(val + "T00:00:00Z").getUTCDay() === 5,
  { message: "Date must be a Friday (ADR-0002)" }
);

// -- Auth schemas --

export const LoginPayload = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});
export type LoginPayload = z.infer<typeof LoginPayload>;

export const RedeemInvitePayload = z.object({
  token: z.string().min(1, "Token is required"),
  full_name: z.string().min(1, "Full name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type RedeemInvitePayload = z.infer<typeof RedeemInvitePayload>;

// -- Admin schemas --

export const CreateInvitePayload = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  role: z.enum(["admin", "user"]),
  expires_in_days: z.number().int().min(1).max(90).default(7),
});
export type CreateInvitePayload = z.infer<typeof CreateInvitePayload>;

export const PatchUserPayload = z.object({
  role: z.enum(["admin", "user"]).optional(),
  is_active: z.boolean().optional(),
});
export type PatchUserPayload = z.infer<typeof PatchUserPayload>;

// -- Community schemas --

export const CreateCommunityPayload = z.object({
  name: z.string().min(1, "Name is required"),
  external_key: z.string().optional(),
  region: z.string().optional(),
});
export type CreateCommunityPayload = z.infer<typeof CreateCommunityPayload>;

export const UpdateCommunityPayload = z.object({
  name: z.string().min(1).optional(),
  external_key: z.string().optional(),
  region: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type UpdateCommunityPayload = z.infer<typeof UpdateCommunityPayload>;

// -- Metrics import schemas --

export const MetricsImportRow = z.object({
  metric_date: fridayDate,
  window_days: z.union([z.literal(7), z.literal(30)]),
  type: z.enum(["community", "portfolio"]),
  community_id: z.string().nullable().optional(),
  occupancy_rate: z.number().nullable().optional(),
  leased_rate: z.number().nullable().optional(),
  traffic_count: z.number().int().nullable().optional(),
  applications_count: z.number().int().nullable().optional(),
  move_ins: z.number().int().nullable().optional(),
  move_outs: z.number().int().nullable().optional(),
  delinquency_rate: z.number().nullable().optional(),
  notes_text: z.string().nullable().optional(),
});
export type MetricsImportRow = z.infer<typeof MetricsImportRow>;

export const MetricsImportPastePayload = z.object({
  rows: z.array(MetricsImportRow).min(1, "At least one row is required"),
});
export type MetricsImportPastePayload = z.infer<typeof MetricsImportPastePayload>;

export const DeleteMetricsPayload = z.object({
  metric_date: fridayDate,
  window_days: z.union([z.literal(7), z.literal(30)]),
  type: z.enum(["community", "portfolio"]),
});
export type DeleteMetricsPayload = z.infer<typeof DeleteMetricsPayload>;

// -- Marketing schemas --

export const PatchMarketingWeeklyPayload = z.object({
  leads_count: z.number().int().min(0).optional(),
  cost_per_lead: z.number().min(0).optional(),
  ad_spend: z.number().min(0).optional(),
  mentions_json: z.string().optional(),
  notes_text: z.string().optional(),
});
export type PatchMarketingWeeklyPayload = z.infer<typeof PatchMarketingWeeklyPayload>;

export const ScanMentionsPayload = z.object({
  week_ending: fridayDate,
});
export type ScanMentionsPayload = z.infer<typeof ScanMentionsPayload>;

// -- Query param schemas --

export const MetricsQueryParams = z.object({
  metric_date: fridayDate.optional(),
  window_days: z.enum(["7", "30"]).optional(),
  type: z.enum(["community", "portfolio"]).optional(),
});
export type MetricsQueryParams = z.infer<typeof MetricsQueryParams>;

export const MarketingQueryParams = z.object({
  week_ending: fridayDate.optional(),
});
export type MarketingQueryParams = z.infer<typeof MarketingQueryParams>;

export const AnalysisQueryParams = z.object({
  week_ending: fridayDate,
});
export type AnalysisQueryParams = z.infer<typeof AnalysisQueryParams>;

// -- Export schemas --

export const ExportCsvParams = z.object({
  entity: z.enum(["communities", "weekly_metrics", "marketing_weekly", "import_runs", "notification_events"]),
  week_ending: fridayDate.optional(),
});
export type ExportCsvParams = z.infer<typeof ExportCsvParams>;

export const BackupExportPayload = z.object({
  entities: z.array(z.enum(["weekly_metrics", "marketing_weekly"])).min(1),
});
export type BackupExportPayload = z.infer<typeof BackupExportPayload>;
