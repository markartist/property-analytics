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
