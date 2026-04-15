const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

/**
 * Fetch wrapper that includes credentials and handles auth redirects.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  return res;
}

export function buildCloudflareAccessBootstrapUrl(nextPath: string): string {
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const url = new URL("/v1/auth/access-bootstrap", API_BASE);
  url.searchParams.set("next", safeNext);
  return url.toString();
}

// ── Types ──

export interface Community {
  id: string;
  name: string;
  external_key: string | null;
  region: string | null;
  status: string;
  manager_name: string | null;
  unit_count: number | null;
  ga4_property_id: string | null;
  full_url: string | null;
  encasa_short_name: string | null;
  encasa_property_code: string | null;
  city: string | null;
  state: string | null;
}

export interface LeasingMetric {
  id: string;
  community_id: string;
  week_date: string;
  type: "community" | "portfolio";
  g_cards: number | null;
  visits: number | null;
  first_tours: number | null;
  apps: number | null;
  leases: number | null;
  c_and_ds: number | null;
  move_ins: number | null;
  v_gc_conv: number | null;
  a_gc_conv: number | null;
  l_gc_conv: number | null;
  l_v_ratio: number | null;
  c_d_pct_of_gcs: number | null;
  mi_gc_conv: number | null;
  mi_v_ratio: number | null;
  g_cards_delta: number | null;
  visits_delta: number | null;
  apps_delta: number | null;
  leases_delta: number | null;
  c_and_ds_delta: number | null;
  move_ins_delta: number | null;
  v_gc_conv_delta: number | null;
  a_gc_conv_delta: number | null;
  l_gc_conv_delta: number | null;
  l_v_ratio_delta: number | null;
  c_d_pct_of_gcs_delta: number | null;
  mi_gc_conv_delta: number | null;
  mi_v_ratio_delta: number | null;
}

export interface MarketingData {
  id: string;
  community_id: string;
  week_date: string;
  [key: string]: unknown;
}

// ── Helpers ──

function qs(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function siteContentHeaders(): HeadersInit | undefined {
  if (process.env.NEXT_PUBLIC_SITE_CONTENT_DEBUG === "true") {
    return { "x-debug-site-content": "allow" };
  }
  return undefined;
}

export async function getCommunities(): Promise<Community[]> {
  const res = await apiFetch("/v1/communities");
  if (!res.ok) throw new Error("Failed to load communities");
  const data = await res.json();
  return data.items ?? data;
}

export async function getT7Metrics(filters: { community_id?: string; week_date?: string; type?: string }): Promise<LeasingMetric[]> {
  const res = await apiFetch(`/v1/t7-metrics${qs(filters)}`);
  if (!res.ok) throw new Error("Failed to load T7 metrics");
  return (await res.json()).items;
}

export async function getT30Metrics(filters: { community_id?: string; week_date?: string; type?: string }): Promise<LeasingMetric[]> {
  const res = await apiFetch(`/v1/t30-metrics${qs(filters)}`);
  if (!res.ok) throw new Error("Failed to load T30 metrics");
  return (await res.json()).items;
}

export async function upsertT7Metrics(communityId: string, rows: Record<string, unknown>[]): Promise<void> {
  const res = await apiFetch("/v1/t7-metrics", { method: "POST", body: JSON.stringify({ community_id: communityId, rows }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to save T7 metrics"); }
}

export async function upsertT30Metrics(communityId: string, rows: Record<string, unknown>[]): Promise<void> {
  const res = await apiFetch("/v1/t30-metrics", { method: "POST", body: JSON.stringify({ community_id: communityId, rows }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to save T30 metrics"); }
}

export async function deleteT7Metrics(communityId: string, weekDate: string): Promise<void> {
  const res = await apiFetch("/v1/t7-metrics", { method: "DELETE", body: JSON.stringify({ community_id: communityId, week_date: weekDate }) });
  if (!res.ok) throw new Error("Failed to delete T7 metrics");
}

export async function deleteT30Metrics(communityId: string, weekDate: string): Promise<void> {
  const res = await apiFetch("/v1/t30-metrics", { method: "DELETE", body: JSON.stringify({ community_id: communityId, week_date: weekDate }) });
  if (!res.ok) throw new Error("Failed to delete T30 metrics");
}

export async function getMarketingData(filters: { community_id?: string; week_date?: string }): Promise<MarketingData[]> {
  const res = await apiFetch(`/v1/marketing-data${qs(filters)}`);
  if (!res.ok) throw new Error("Failed to load marketing data");
  return (await res.json()).items;
}

export async function upsertMarketingData(id: string, body: Record<string, unknown>): Promise<MarketingData> {
  const res = await apiFetch(`/v1/marketing-data/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to save marketing data"); }
  return res.json();
}

export async function importWebsiteSeo(rows: Record<string, unknown>[]): Promise<{ successful: number; failed: number }> {
  const res = await apiFetch("/v1/marketing-data/import/website-seo", { method: "POST", body: JSON.stringify({ rows }) });
  if (!res.ok) throw new Error("Failed to import Website & SEO data");
  return res.json();
}

// ── PIB (Property Intelligence Brief) ──

export interface PibCommunityRow {
  community_id: string;
  community_name: string;
  ga4_property_id: string;
  // GA4
  total_sessions: number | null;
  total_users: number | null;
  new_users: number | null;
  organic_sessions: number | null;
  direct_sessions: number | null;
  paid_sessions: number | null;
  sessions_trend_pct: number | null;
  users_trend_pct: number | null;
  tour_clicks: number | null;
  ga4_phone_calls: number | null;
  apply_clicks: number | null;
  // Site performance
  mobile_score: number | null;
  desktop_score: number | null;
  // GBP
  total_profile_views: number | null;
  gbp_website_clicks: number | null;
  gbp_phone_calls: number | null;
  direction_requests: number | null;
  gbp_action_rate: number | null;
  gbp_views_trend_pct: number | null;
  gbp_actions_trend_pct: number | null;
  // GSC
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_avg_ctr: number | null;
  gsc_avg_position: number | null;
  // CIR
  cir_value: number | null;
  cir_status: string | null;
  intent_events: number | null;
  cir_trend_pct: number | null;
  // Reviews
  total_reviews: number | null;
  avg_rating: number | null;
  recent_reviews: number | null;
  avg_rating_trend: number | null;
  sentiment_score: number | null;
  // Marketing
  occupancy: number | null;
  atr: number | null;
  google_ppc: number | null;
  google_remarketing: number | null;
  gc_per_door: number | null;
  serp_traffic: number | null;
}

export interface PibSummary {
  week_date: string;
  community_count: number;
  avg_occupancy: number | null;
  avg_cir: number | null;
  total_sessions: number;
  avg_mobile_pagespeed: number | null;
  avg_review_score: number | null;
  total_ad_spend: number;
  avg_sessions_trend_pct: number | null;
  avg_cir_trend_pct: number | null;
}

export interface PibPortfolioResponse {
  summary: PibSummary;
  communities: PibCommunityRow[];
}

export async function getPibPortfolio(weekDate?: string): Promise<PibPortfolioResponse> {
  const q = weekDate ? `?week_date=${weekDate}` : "";
  const res = await apiFetch(`/v1/pib/portfolio${q}`);
  if (!res.ok) throw new Error("Failed to load PIB portfolio data");
  return res.json();
}

export async function getPibWeeks(): Promise<string[]> {
  const res = await apiFetch("/v1/pib/weeks");
  if (!res.ok) throw new Error("Failed to load PIB weeks");
  return (await res.json()).weeks;
}

export interface PibDetailResponse {
  week_date: string;
  community: {
    id: string;
    name: string;
    ga4_property_id: string;
    unit_count: number | null;
    full_url: string | null;
    city: string | null;
    state: string | null;
    region: string | null;
  };
  ga4: Record<string, unknown> | null;
  site_performance: Record<string, unknown> | null;
  local_presence: Record<string, unknown> | null;
  search_performance: (Record<string, unknown> & { top_keywords: { query: string; clicks: number; impressions: number; ctr: number; position: number }[] }) | null;
  cir: Record<string, unknown> | null;
  reviews: (Record<string, unknown> & { themes: Record<string, number>; critical_reviews: { reviewer: string; rating: number; comment: string; date: string }[] }) | null;
  marketing: Record<string, unknown> | null;
  leasing: {
    t7: Record<string, unknown> | null;
    t7_portfolio: Record<string, unknown> | null;
    t30: Record<string, unknown> | null;
    t30_portfolio: Record<string, unknown> | null;
  };
}

export async function getPibDetail(communityId: string, weekDate?: string): Promise<PibDetailResponse> {
  const q = weekDate ? `?week_date=${weekDate}` : "";
  const res = await apiFetch(`/v1/pib/${communityId}${q}`);
  if (!res.ok) throw new Error("Failed to load PIB detail");
  return res.json();
}

export interface PibReportRequest {
  community_id: string;
  start_date: string;
  end_date: string;
  email?: string;
}

export interface PibMetricDelta {
  value: number | null;
  delta: number | null;
}

export interface PibReportResponse {
  property: string;
  current_start: string;
  current_end: string;
  previous_start: string;
  previous_end: string;
  snapshot_date: string;
  previous_snapshot_date: string | null;
  sessions: PibMetricDelta;
  gsc_clicks: PibMetricDelta;
  cir: PibMetricDelta & { status: string | null };
  avg_rating: PibMetricDelta;
  occupancy: PibMetricDelta;
  ad_spend: PibMetricDelta;
  action_rate: number | null;
  report_html: string;
  email_sent: boolean;
  email_error: string | null;
}

export async function generatePibReport(body: PibReportRequest): Promise<PibReportResponse> {
  const res = await apiFetch("/v1/pib/report", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to generate PIB report");
  }
  return res.json();
}

export interface SearchIntelligenceResponse {
  version: string;
  current_start: string;
  current_end: string;
  community: {
    id: string;
    name: string;
    ga4_property_id: string | null;
    full_url: string | null;
    city: string | null;
    state: string | null;
  };
  summary: {
    brand_keywords: number;
    generic_keywords: number;
    top_gap: string | null;
    local_semrush_snapshot: string | null;
    competitors_used: number;
  };
  report_html: string;
  html_filename: string;
  html_base64: string;
  markdown_filename: string;
  markdown_base64: string;
  json_filename: string;
  json_base64: string;
  email_sent: boolean;
  email_error: string | null;
}

export async function generateSearchIntelligenceReport(body: {
  community_id: string;
  email?: string;
}): Promise<SearchIntelligenceResponse> {
  const res = await apiFetch("/v1/search-intelligence/report", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to generate Search Intelligence report");
  }
  return res.json();
}

// ── Data Pond ──

export interface PondInsight {
  id: string;
  icon: "trending-up" | "trending-down" | "alert" | "trophy" | "zap" | "bar-chart";
  color: "green" | "amber" | "red" | "teal" | "blue";
  title: string;
  detail: string;
}

export interface PondSurface {
  latest_snapshot: string;
  prev_snapshot: string | null;
  community_count: number;
  freshness: Record<string, string | null>;
}

export interface PondInsightsResponse {
  week_date: string | null;
  insights: PondInsight[];
  surface: PondSurface | null;
}

export async function getPondInsights(): Promise<PondInsightsResponse> {
  const res = await apiFetch("/v1/pond/insights");
  if (!res.ok) throw new Error("Failed to load pond insights");
  return res.json();
}

// ── Watchtower (Health) ──

export interface TableStat {
  key: string;
  label: string;
  row_count: number;
  latest_date: string | null;
  distinct_weeks: number;
  latest_coverage: number;
}

export interface CoverageRow {
  community_id: string;
  community_name: string;
  sources: Record<string, boolean>;
}

export interface SourceFreshness {
  source_key: string;
  source_label: string;
  latest_date: string | null;
  row_count: number;
  property_count: number;
  updated_at: string;
  expected_latest_date?: string | null;
  age_days?: number | null;
  business_lag_days?: number | null;
  freshness_status?: "fresh" | "warning" | "stale" | "missing";
}

export interface DailyCollectionSourceStatus {
  source: string;
  status: string;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  total_count: number;
  remaining_count: number;
  started_at: string | null;
  completed_at: string | null;
  retry_attempts: number;
  rate_limit_hits: number;
  error_message: string | null;
  notes: string | null;
}

export interface DailyCollectionSummary {
  sources_total: number;
  sources_completed: number;
  sources_active: number;
  sources_blocked: number;
  properties_expected: number;
  properties_succeeded: number;
  properties_failed: number;
  properties_remaining: number;
}

export interface WatchtowerCollectionHistoryPoint {
  collection_date: string;
  sources_total: number;
  sources_completed: number;
  sources_active: number;
  sources_blocked: number;
  properties_expected: number;
  properties_succeeded: number;
  properties_failed: number;
  retry_attempts: number;
  rate_limit_hits: number;
}

export interface WatchtowerSourceCoverageHistory {
  source_key: string;
  source_label: string;
  points: {
    date: string;
    coverage: number;
    coverage_pct: number;
  }[];
}

export interface WatchtowerRetryQueueItem {
  queue_id: number;
  collection_date: string;
  data_source: string;
  property_id: string | null;
  property_name: string | null;
  attempt_count: number;
  status: string;
  retry_disposition: string;
  last_error_type: string | null;
  last_error_message: string | null;
  next_attempt_at: string | null;
  retry_window_end: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WatchtowerSourceTimeline {
  source: string;
  points: {
    collection_date: string;
    status: string;
    success_count: number;
    failed_count: number;
    total_count: number;
    retry_attempts: number;
    rate_limit_hits: number;
  }[];
}

export interface HealthStatusResponse {
  community_count: number;
  health_score: number;
  filled_cells: number;
  total_cells: number;
  table_stats: TableStat[];
  source_freshness: SourceFreshness[];
  coverage_matrix: CoverageRow[];
  data_sources: { key: string; label: string }[];
  integrity_summary: {
    core_failure_sources: number;
    specialty_failure_sources: number;
    freshness_warning_sources: number;
    freshness_stale_sources: number;
    top_issues: {
      kind: "core_failure" | "freshness";
      source: string;
      message: string;
      timestamp: string | null;
    }[];
  };
  daily_collection_status: {
    summary: DailyCollectionSummary;
    closure: {
      state: "open" | "complete" | "archived" | "blocked" | "not_started";
      summary_reason: string;
      cutoff_at_local: string | null;
      next_retry_at: string | null;
      queue_depth: number;
      unresolved_sources: {
        source: string;
        status: string;
        reason: string;
      }[];
      advisory_sources: {
        source: string;
        status: string;
        run_recorded: boolean;
      }[];
    };
    sources: DailyCollectionSourceStatus[];
  };
  telemetry: {
    collection_history: WatchtowerCollectionHistoryPoint[];
    source_coverage_history: WatchtowerSourceCoverageHistory[];
    source_timelines: WatchtowerSourceTimeline[];
    retry_queue: {
      queue_depth: number;
      by_status: Record<string, number>;
      by_disposition: Record<string, number>;
      items: WatchtowerRetryQueueItem[];
    };
  };
}

export async function getHealthStatus(): Promise<HealthStatusResponse> {
  const res = await apiFetch("/v1/health/status");
  if (!res.ok) throw new Error("Failed to load health status");
  return res.json();
}

// ── Dock Preview ──

export interface DockPreviewResponse {
  week_date: string | null;
  pib: { communities: number; avg_cir: number | null; total_sessions: number; avg_mobile_score: number | null; avg_rating: number | null } | null;
  leasing: { communities: number; total_guest_cards: number; avg_visit_conv: number | null } | null;
  marketing: { communities: number; avg_occupancy: number | null; total_ad_spend: number } | null;
}

export async function getDockPreview(): Promise<DockPreviewResponse> {
  const res = await apiFetch("/v1/pond/dock-preview");
  if (!res.ok) throw new Error("Failed to load dock preview");
  return res.json();
}

// ── Admin ──

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "editor" | "viewer";
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
  actor_email: string | null;
  actor_name: string | null;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await apiFetch("/v1/admin/users");
  if (!res.ok) throw new Error("Failed to load users");
  return (await res.json()).items;
}

export async function createAdminUser(body: { email: string; full_name: string; role: string }): Promise<AdminUser> {
  const res = await apiFetch("/v1/admin/users", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to create user"); }
  return res.json();
}

export async function patchAdminUser(id: string, body: Record<string, unknown>): Promise<AdminUser> {
  const res = await apiFetch(`/v1/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to update user"); }
  return res.json();
}

export async function sendMagicLink(userId: string): Promise<void> {
  const res = await apiFetch(`/v1/admin/users/${userId}/send-magic-link`, { method: "POST" });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to send magic link"); }
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const res = await apiFetch(`/v1/admin/users/${userId}/sessions`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to revoke sessions");
}

export async function getAuditLog(params?: { action?: string; limit?: number; offset?: number }): Promise<AuditLogEntry[]> {
  const qp = new URLSearchParams();
  if (params?.action) qp.set("action", params.action);
  if (params?.limit) qp.set("limit", String(params.limit));
  if (params?.offset) qp.set("offset", String(params.offset));
  const q = qp.toString();
  const res = await apiFetch(`/v1/admin/audit-log${q ? `?${q}` : ""}`);
  if (!res.ok) throw new Error("Failed to load audit log");
  return (await res.json()).items;
}

export async function requestMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch("/v1/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) });
  return res.json();
}

// ── Intelligence Office ──

export interface IntelligenceOfficeProfile {
  id: string;
  office_name: string;
  office_label: string;
  mission: string;
  source_of_truth: string;
  operating_model: string;
  naming_rationale: string;
  updated_at: string;
}

export interface IntelligenceDirective {
  id: string;
  category: string;
  title: string;
  directive_text: string;
  rationale: string;
  status: "active" | "draft" | "archived";
  sort_order: number;
  updated_at: string;
}

export interface IntelligenceSource {
  id: string;
  title: string;
  source_kind: string;
  relative_path: string;
  summary: string;
  evidence_excerpt: string;
  status: string;
  updated_at: string;
}

export interface IntelligencePilotProperty {
  property_id: string;
  property_name: string;
  legacy_url: string | null;
  staging_url: string | null;
  live_url: string | null;
  revised_url: string | null;
  editorial_focus: string;
  approved_points: string;
  open_questions: string;
  advocate_prompt: string;
  updated_at: string;
}

export interface IntelligenceAdvocatePrompt {
  id: string;
  property_id: string;
  prompt_text: string;
  desired_outcome: string;
  created_at: string;
  updated_at: string;
}

export interface IntelligenceClaim {
  id: string;
  property_id: string | null;
  cohort_key: string | null;
  claim_text: string;
  source: "intelligence_office" | "derived" | "migration" | "other";
  confidence: number;
  applicable_scope: "property" | "cohort" | "global";
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface IntelligenceEvidence {
  id: string;
  evidence_type: string;
  source_system: string;
  reference: string;
  summary: string;
  timestamp: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface IntelligenceClaimEvidence {
  id: string;
  claim_id: string;
  evidence_id: string;
  created_at: string;
}

export interface BriefReadiness {
  property_id: string;
  completeness_score: number;
  completeness_status: "incomplete" | "partial" | "ready";
  missing_components: string[];
  captain_log_count: number;
  claim_count: number;
  evidence_count: number;
  confidence: number | null;
  last_updated_at: string | null;
  migration_candidates: string[];
}

export interface IntelligenceOfficeResponse {
  office: IntelligenceOfficeProfile;
  directives: IntelligenceDirective[];
  sources: IntelligenceSource[];
  properties: IntelligencePilotProperty[];
  advocatePrompts: IntelligenceAdvocatePrompt[];
  claims: IntelligenceClaim[];
  evidence: IntelligenceEvidence[];
  claimEvidence: IntelligenceClaimEvidence[];
  briefReadiness: Record<string, BriefReadiness>;
}

export interface IntelligencePropertyBriefInputsResponse {
  property: IntelligencePilotProperty;
  claims: IntelligenceClaim[];
  evidence: IntelligenceEvidence[];
  claimEvidence: IntelligenceClaimEvidence[];
  briefReadiness: BriefReadiness | null;
}

export async function getIntelligenceOffice(): Promise<IntelligenceOfficeResponse> {
  const res = await apiFetch("/v1/admin/intelligence");
  if (!res.ok) throw new Error("Failed to load Intelligence Office");
  return res.json();
}

export async function getIntelligencePropertyBriefInputs(propertyId: string): Promise<IntelligencePropertyBriefInputsResponse> {
  const res = await apiFetch(`/v1/admin/intelligence/properties/${propertyId}/brief-inputs`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load property brief inputs");
  }
  return res.json();
}

export async function updateIntelligenceOffice(body: {
  office_name: string;
  office_label: string;
  mission: string;
  source_of_truth: string;
  operating_model: string;
  naming_rationale: string;
}): Promise<IntelligenceOfficeProfile> {
  const res = await apiFetch("/v1/admin/intelligence/office", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update Intelligence Office");
  }
  return res.json();
}

export async function createIntelligenceDirective(body: {
  category: string;
  title: string;
  directive_text: string;
  rationale: string;
  status: "active" | "draft" | "archived";
}): Promise<IntelligenceDirective> {
  const res = await apiFetch("/v1/admin/intelligence/directives", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create directive");
  }
  return res.json();
}

export async function updateIntelligenceDirective(
  id: string,
  body: Partial<{
    category: string;
    title: string;
    directive_text: string;
    rationale: string;
    status: "active" | "draft" | "archived";
  }>
): Promise<IntelligenceDirective> {
  const res = await apiFetch(`/v1/admin/intelligence/directives/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update directive");
  }
  return res.json();
}

export async function updateIntelligenceProperty(
  propertyId: string,
  body: Partial<{
    revised_url: string;
    editorial_focus: string;
    approved_points: string;
    open_questions: string;
    advocate_prompt: string;
  }>
): Promise<IntelligencePilotProperty> {
  const res = await apiFetch(`/v1/admin/intelligence/properties/${propertyId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update property intelligence");
  }
  return res.json();
}

export async function createIntelligenceAdvocatePrompt(body: {
  property_id: string;
  prompt_text: string;
  desired_outcome: string;
}): Promise<IntelligenceAdvocatePrompt> {
  const res = await apiFetch("/v1/admin/intelligence/advocate-prompts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to save advocate prompt");
  }
  return res.json();
}

export async function createIntelligenceClaim(body: {
  property_id?: string | null;
  cohort_key?: string | null;
  claim_text: string;
  source?: "intelligence_office" | "derived" | "migration" | "other";
  confidence?: number;
  applicable_scope: "property" | "cohort" | "global";
  status?: "active" | "archived";
  linked_evidence_ids?: string[];
}): Promise<IntelligenceClaim> {
  const res = await apiFetch("/v1/admin/intelligence/claims", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create claim");
  }
  return res.json();
}

export async function updateIntelligenceClaim(id: string, body: Partial<Omit<IntelligenceClaim, "id" | "created_at">>): Promise<IntelligenceClaim> {
  const res = await apiFetch(`/v1/admin/intelligence/claims/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update claim");
  }
  return res.json();
}

export async function createIntelligenceEvidence(body: {
  evidence_type: string;
  source_system: string;
  reference: string;
  summary: string;
  timestamp?: string | null;
  status?: "active" | "archived";
}): Promise<IntelligenceEvidence> {
  const res = await apiFetch("/v1/admin/intelligence/evidence", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create evidence");
  }
  return res.json();
}

export async function updateIntelligenceEvidence(id: string, body: Partial<Omit<IntelligenceEvidence, "id" | "created_at">>): Promise<IntelligenceEvidence> {
  const res = await apiFetch(`/v1/admin/intelligence/evidence/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update evidence");
  }
  return res.json();
}

export async function linkIntelligenceClaimEvidence(claimId: string, evidenceId: string): Promise<IntelligenceClaimEvidence> {
  const res = await apiFetch(`/v1/admin/intelligence/claims/${claimId}/evidence`, {
    method: "POST",
    body: JSON.stringify({ evidence_id: evidenceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to link evidence");
  }
  return res.json();
}

// ── Governed Memory ──

export interface MemoryEvidenceReference {
  id: string;
  memory_entry_id: string;
  evidence_type: string;
  evidence_source: string;
  evidence_ref: string;
  evidence_excerpt: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface GovernedMemoryEntry {
  id: string;
  scope: "property" | "fleet" | "ledger";
  property_id: string | null;
  fleet_key: string | null;
  ledger_key: string | null;
  summary: string;
  structured_payload_json: string | null;
  source_system: string;
  created_by: string;
  confidence: number;
  status: "active" | "candidate" | "approved" | "deprecated";
  parent_entry_id: string | null;
  originating_candidate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernedMemoryLineage {
  id: string;
  target_entry_id: string;
  source_entry_id: string;
  source_candidate_id: string | null;
  created_at: string;
}

export interface GovernedMemoryEntryWithEvidence {
  entry: GovernedMemoryEntry;
  evidence: MemoryEvidenceReference[];
  lineage: GovernedMemoryLineage[];
}

export interface GovernedMemoryCandidate {
  id: string;
  source_entry_id: string;
  source_scope: "property" | "fleet";
  target_scope: "fleet" | "ledger";
  property_id: string | null;
  fleet_key: string | null;
  ledger_key: string | null;
  proposed_summary: string;
  proposed_structured_payload_json: string | null;
  rationale: string;
  status: "pending" | "promoted" | "rejected";
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernedMemoryIdentity {
  id: string;
  scope: "property" | "fleet" | "ledger";
  property_id: string | null;
  fleet_key: string | null;
  ledger_key: string | null;
  role_family: "Captain" | "Commodore" | "Ledger";
  display_name: string;
  internal_name: string | null;
}

export interface GovernedMemoryProperty {
  propertyId: string;
  propertyName: string;
  shortName: string;
  region: string | null;
  fleetKey: string;
  captainDisplayName: string;
  captainInternalName: string;
}

export interface GovernedMemoryFleetSummary {
  fleetKey: string;
  displayName: string;
  propertyCount: number;
  memoryCount: number;
  pendingCandidates: number;
}

export interface GovernedMemoryPropertyContext {
  propertyId: string;
  fleetKey: string;
  identity: GovernedMemoryIdentity;
  captainLog: GovernedMemoryEntryWithEvidence[];
  fleetBrief: GovernedMemoryEntryWithEvidence[];
  ledger: GovernedMemoryEntryWithEvidence[];
}

export interface GovernedMemoryFleetContext {
  fleetKey: string;
  identity: GovernedMemoryIdentity | null;
  entries: GovernedMemoryEntryWithEvidence[];
  pendingCandidates: GovernedMemoryCandidate[];
}

export interface GovernedMemoryLedgerContext {
  ledgerKey: string;
  identity: GovernedMemoryIdentity | null;
  entries: GovernedMemoryEntryWithEvidence[];
  pendingCandidates: GovernedMemoryCandidate[];
}

export async function getGovernedMemoryProperties(): Promise<GovernedMemoryProperty[]> {
  const res = await apiFetch("/v1/intelligence-memory/properties");
  if (!res.ok) throw new Error("Failed to load governed memory properties");
  return (await res.json()).properties;
}

export async function getGovernedMemoryPropertyLog(propertyId: string): Promise<{
  entries: GovernedMemoryEntryWithEvidence[];
  context: GovernedMemoryPropertyContext;
}> {
  const res = await apiFetch(`/v1/intelligence-memory/properties/${propertyId}/log`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain's Log");
  }
  return res.json();
}

export async function createCaptainLogEntry(propertyId: string, body: {
  summary: string;
  structuredPayload?: Record<string, unknown> | null;
  evidence: Array<{
    evidenceType: string;
    evidenceSource: string;
    evidenceRef: string;
    evidenceExcerpt?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  sourceSystem: string;
  confidence: number;
}): Promise<GovernedMemoryEntryWithEvidence> {
  const res = await apiFetch(`/v1/intelligence-memory/properties/${propertyId}/log`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create Captain's Log entry");
  }
  return res.json();
}

export async function createFleetBriefCandidate(entryId: string, body: {
  rationale: string;
  proposedSummary?: string;
  proposedStructuredPayload?: Record<string, unknown> | null;
}): Promise<GovernedMemoryCandidate> {
  const res = await apiFetch(`/v1/intelligence-memory/entries/${entryId}/candidates/fleet`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create Fleet Brief candidate");
  }
  return res.json();
}

export async function createLedgerCandidate(entryId: string, body: {
  rationale: string;
  proposedSummary?: string;
  proposedStructuredPayload?: Record<string, unknown> | null;
}): Promise<GovernedMemoryCandidate> {
  const res = await apiFetch(`/v1/intelligence-memory/entries/${entryId}/candidates/ledger`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create Ledger candidate");
  }
  return res.json();
}

export async function promoteMemoryCandidate(candidateId: string, actionNotes?: string): Promise<{
  candidate: GovernedMemoryCandidate;
  entry: GovernedMemoryEntryWithEvidence;
  actionType: "promoted_new" | "promoted_existing";
}> {
  const res = await apiFetch(`/v1/intelligence-memory/candidates/${candidateId}/promote`, {
    method: "POST",
    body: JSON.stringify({ actionNotes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to promote memory candidate");
  }
  return res.json();
}

export async function getFleetBriefs(): Promise<GovernedMemoryFleetSummary[]> {
  const res = await apiFetch("/v1/intelligence-memory/fleets");
  if (!res.ok) throw new Error("Failed to load Fleet Brief summaries");
  return (await res.json()).fleets;
}

export async function getFleetBrief(fleetKey: string): Promise<GovernedMemoryFleetContext> {
  const res = await apiFetch(`/v1/intelligence-memory/fleets/${fleetKey}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Fleet Brief");
  }
  return res.json();
}

export async function getLedgerContext(): Promise<GovernedMemoryLedgerContext> {
  const res = await apiFetch("/v1/intelligence-memory/ledger");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load The Ledger");
  }
  return res.json();
}

export async function getGovernedMemoryContext(propertyId: string): Promise<GovernedMemoryPropertyContext> {
  const res = await apiFetch(`/v1/intelligence-memory/context/property/${propertyId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load governed memory context");
  }
  return res.json();
}

// ── Site Content Creator ──

export interface SiteContentPropertySummary extends IntelligencePilotProperty {
  page_count: number;
  section_count: number;
  last_crawled_at: string | null;
  brief_readiness: BriefReadiness | null;
}

export interface SiteContentSection {
  id?: string;
  page_id?: string;
  section_key: string | null;
  section_order: number;
  section_label: string | null;
  heading: string | null;
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  section_type: string | null;
  media_side?: "left" | "right" | "none" | null;
  original_copy: string | null;
  bullet_points: string[];
  image_count: number;
  link_count: number;
  updated_at?: string;
}

export interface SiteContentPage {
  id: string;
  property_id: string;
  page_url: string;
  page_path: string | null;
  page_type: string | null;
  page_title: string | null;
  meta_description: string | null;
  crawl_status: string;
  crawled_at: string | null;
  updated_at: string;
  spec_archetype_id?: string | null;
  spec_archetype_name?: string | null;
  spec_page_id?: string | null;
  spec_page_name?: string | null;
  spec_layout_path?: string | null;
  spec_screenshot?: string | null;
  spec_order?: number | null;
  sections: SiteContentSection[];
}

export interface SiteContentInventoryResponse {
  properties: SiteContentPropertySummary[];
}

export interface SiteContentPropertyResponse {
  property: IntelligencePilotProperty;
  pages: SiteContentPage[];
}

export interface SiteContentCrawlResponse {
  property: IntelligencePilotProperty;
  crawled_count: number;
  pages: SiteContentPage[];
}

export async function getSiteContentInventory(): Promise<SiteContentInventoryResponse> {
  const res = await apiFetch("/v1/admin/site-content", { headers: siteContentHeaders() });
  if (!res.ok) throw new Error("Failed to load site content inventory");
  return res.json();
}

export async function getSiteContentProperty(propertyId: string): Promise<SiteContentPropertyResponse> {
  const res = await apiFetch(`/v1/admin/site-content/${propertyId}`, { headers: siteContentHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load property site content");
  }
  return res.json();
}

export async function crawlSiteContentProperty(
  propertyId: string,
  body?: { page_limit?: number }
): Promise<SiteContentCrawlResponse> {
  const res = await apiFetch(`/v1/admin/site-content/${propertyId}/crawl`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: siteContentHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to crawl property site content");
  }
  return res.json();
}

// ── GSC Snapshot ──

export interface GscSnapshotProperty {
  rank: number;
  community_id: string;
  name: string;
  clicks: number;
  clicks_delta: number;
  impressions: number;
  impressions_delta: number;
  ctr: number;
  ctr_delta: number;
}

export interface GscSnapshotResponse {
  current_start: string | null;
  current_end: string | null;
  prev_start: string | null;
  prev_end: string | null;
  property_count: number;
  portfolio: {
    total_clicks: number;
    total_impressions: number;
    avg_ctr: number;
    clicks_pct: number;
    impressions_pct: number;
    ctr_delta: number;
  } | null;
  grades: { excellent: number; good: number; needs_improvement: number } | null;
  properties: GscSnapshotProperty[];
}

export async function getGscSnapshot(): Promise<GscSnapshotResponse> {
  const res = await apiFetch("/v1/gsc-snapshot");
  if (!res.ok) throw new Error("Failed to load GSC snapshot");
  return res.json();
}

export interface GscReportRequest {
  scope: "portfolio" | "property";
  community_id?: string;
  start_date: string;
  end_date: string;
  email?: string;
}

export interface GscReportResponse extends GscSnapshotResponse {
  scope: "portfolio" | "property";
  community_id: string | null;
  email_sent: boolean;
  email_error: string | null;
  excel_filename: string;
  excel_base64: string;
}

export async function generateGscReport(body: GscReportRequest): Promise<GscReportResponse> {
  const res = await apiFetch("/v1/gsc-snapshot/report", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to generate GSC report");
  }
  return res.json();
}

// ── GBP Posts ──

export interface GbpPostPolicy {
  community_id: string;
  approval_required: boolean;
  allow_offer_posts: boolean;
  allow_event_posts: boolean;
  allow_amenity_posts: boolean;
  cooldown_days: number;
  max_drafts_per_run: number;
  blocked_terms: string[];
  required_utm_source: string | null;
}

export interface GbpDraftQueueItem {
  id: string;
  community_id: string;
  community_name: string;
  status: "draft" | "approved" | "rejected" | "published" | "failed";
  post_type: "STANDARD" | "EVENT" | "OFFER";
  angle: string;
  candidate_rank: number;
  rendered_text: string;
  validation: {
    approval_required?: boolean;
    warnings?: string[];
    blockers?: string[];
    freshness?: Record<string, string | boolean | null>;
  };
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  snapshot_created_at: string;
}

export interface GbpDraftDetail {
  draft: Record<string, unknown> & {
    id: string;
    community_id: string;
    community_name: string;
    status: string;
    rendered_text: string;
    payload: Record<string, unknown>;
    validation: Record<string, unknown>;
  };
  source_snapshot: {
    payload: Record<string, unknown>;
    freshness: Record<string, unknown>;
  };
  reviews: { id: string; decision: string; notes: string | null; created_at: string; created_by: string | null }[];
}

export interface GbpDraftInput {
  availability_summary?: string;
  concession_summary?: string;
  concession_expires_on?: string;
  amenity_highlights?: string[];
  feature_highlights?: string[];
  cta_url?: string;
  source_label?: string;
  notes?: string;
  draft_count?: number;
}

export async function getGbpPostQueue(filters: { status?: string; community_id?: string } = {}): Promise<GbpDraftQueueItem[]> {
  const res = await apiFetch(`/v1/gbp-posts/queue${qs(filters)}`);
  if (!res.ok) throw new Error("Failed to load GBP post queue");
  return (await res.json()).items;
}

export async function getGbpPostPolicy(communityId: string): Promise<GbpPostPolicy> {
  const res = await apiFetch(`/v1/gbp-posts/policies/${communityId}`);
  if (!res.ok) throw new Error("Failed to load GBP post policy");
  return (await res.json()).policy;
}

export async function upsertGbpPostPolicy(communityId: string, body: Partial<GbpPostPolicy>): Promise<GbpPostPolicy> {
  const res = await apiFetch(`/v1/gbp-posts/policies/${communityId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to save GBP post policy");
  }
  return (await res.json()).policy;
}

export async function buildGbpContext(communityId: string, body: GbpDraftInput) {
  const res = await apiFetch(`/v1/gbp-posts/context/${communityId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to build GBP context");
  }
  return res.json();
}

export async function generateGbpDrafts(communityId: string, body: GbpDraftInput) {
  const res = await apiFetch(`/v1/gbp-posts/drafts/${communityId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to generate GBP drafts");
  }
  return res.json();
}

export async function getGbpDraftDetail(draftId: string): Promise<GbpDraftDetail> {
  const res = await apiFetch(`/v1/gbp-posts/drafts/${draftId}`);
  if (!res.ok) throw new Error("Failed to load GBP draft detail");
  return res.json();
}

export async function approveGbpDraft(draftId: string, notes?: string) {
  const res = await apiFetch(`/v1/gbp-posts/drafts/${draftId}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to approve GBP draft");
  }
  return res.json();
}

export async function rejectGbpDraft(draftId: string, notes?: string) {
  const res = await apiFetch(`/v1/gbp-posts/drafts/${draftId}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to reject GBP draft");
  }
  return res.json();
}
