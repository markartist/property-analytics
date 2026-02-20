/**
 * Entity interfaces matching 05_Data_Model.md exactly.
 * All timestamps are UTC ISO strings.
 */

// -- Audit field mixin --

export interface AuditFields {
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface SoftDeleteFields {
  deleted_at: string | null;
  deleted_by: string | null;
}

// -- Entities --

export interface User extends AuditFields, SoftDeleteFields {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  is_active: boolean;
  last_login_at: string | null;
}

export interface Session extends AuditFields {
  id: string;
  user_id: string;
  session_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface Invite extends AuditFields {
  id: string;
  email: string;
  role: "admin" | "user";
  token_hash: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_user_id: string | null;
}

export interface Community extends AuditFields, SoftDeleteFields {
  id: string;
  name: string;
  external_key: string | null;
  region: string | null;
  status: "active" | "inactive";
}

export interface WeeklyMetric extends AuditFields {
  id: string;
  metric_date: string; // Must be Friday (ADR-0002)
  window_days: 7 | 30; // ADR-0004
  type: "community" | "portfolio"; // ADR-0004
  community_id: string | null; // Required when type='community', null when type='portfolio'
  occupancy_rate: number | null;
  leased_rate: number | null;
  traffic_count: number | null;
  applications_count: number | null;
  move_ins: number | null;
  move_outs: number | null;
  delinquency_rate: number | null;
  notes_text: string | null;
  source_import_run_id: string | null;
}

export interface MarketingWeekly extends AuditFields {
  id: string;
  week_ending: string; // Must be Friday (ADR-0002)
  community_id: string;
  leads_count: number | null;
  cost_per_lead: number | null;
  ad_spend: number | null;
  mentions_json: string | null;
  notes_text: string | null;
  source_import_run_id: string | null;
}

export interface ImportRun extends AuditFields {
  id: string;
  entity_type: "weekly_metrics" | "marketing_weekly";
  mode: "paste_tsv" | "csv_upload";
  status: "queued" | "validating" | "applied" | "failed";
  requested_by_user_id: string;
  request_idempotency_key: string | null;
  source_filename: string | null;
  source_r2_key: string | null;
  rows_received: number;
  rows_applied: number;
  error_summary: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface NotificationEvent extends AuditFields {
  id: string;
  event_type: string;
  recipient_email: string;
  dedupe_key: string;
  status: "suppressed_duplicate" | "sent" | "failed";
  provider_message_id: string | null;
  attempted_at: string;
  error_text: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  request_id: string | null;
  ip_hash: string | null;
  created_at: string;
}
