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
