const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
export const API_BASE_URL = API_BASE;
export const SITE_CONTENT_DEBUG_FLAG = process.env.NEXT_PUBLIC_SITE_CONTENT_DEBUG === "true";
export const CLOUDFLARE_BOOTSTRAP_MARKER = "cf_bootstrapped";
export const CLOUDFLARE_BOOTSTRAP_RETRY_MARKER = "cf_bootstrap_retry";
export const LOGGED_OUT_MARKER = "logged_out";
export const CLOUDFLARE_LOGGED_OUT_STORAGE_KEY = "cloudflare_logged_out";
const APP_ORIGIN_FALLBACK = "https://app.local";
const CLOUDFLARE_ACCESS_TEAM_DOMAIN =
  (process.env.NEXT_PUBLIC_CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "https://macxs.cloudflareaccess.com").replace(/\/$/, "");

function normalizeSafeNextPath(nextPath: string): string {
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
}

function appendBootstrapMarker(nextPath: string): string {
  const url = new URL(normalizeSafeNextPath(nextPath), APP_ORIGIN_FALLBACK);
  url.searchParams.set(CLOUDFLARE_BOOTSTRAP_MARKER, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

function appendBootstrapRetryMarker(nextPath: string): string {
  const url = new URL(appendBootstrapMarker(nextPath), APP_ORIGIN_FALLBACK);
  url.searchParams.set(CLOUDFLARE_BOOTSTRAP_RETRY_MARKER, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function hasCloudflareBootstrapMarker(search: string): boolean {
  return new URLSearchParams(search).get(CLOUDFLARE_BOOTSTRAP_MARKER) === "1";
}

export function hasCloudflareBootstrapRetryMarker(search: string): boolean {
  return new URLSearchParams(search).get(CLOUDFLARE_BOOTSTRAP_RETRY_MARKER) === "1";
}

export function hasLoggedOutMarker(search: string): boolean {
  return new URLSearchParams(search).get(LOGGED_OUT_MARKER) === "1";
}

export function stripCloudflareBootstrapMarker(pathname: string, search: string, hash = ""): string {
  const params = new URLSearchParams(search);
  params.delete(CLOUDFLARE_BOOTSTRAP_MARKER);
  params.delete(CLOUDFLARE_BOOTSTRAP_RETRY_MARKER);
  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`;
}

/**
 * Fetch wrapper that includes credentials and handles auth redirects.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined);
  const method = (init?.method ?? "GET").toUpperCase();
  const hasBody = init?.body !== undefined && init?.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!hasBody && (method === "GET" || method === "HEAD")) {
    headers.delete("Content-Type");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  return res;
}

export function buildCloudflareAccessBootstrapUrl(nextPath: string): string {
  const url = new URL("/v1/auth/access-bootstrap", API_BASE);
  url.searchParams.set("next", appendBootstrapMarker(nextPath));
  return url.toString();
}

export function buildCloudflareAccessBootstrapRetryUrl(nextPath: string): string {
  const url = new URL("/v1/auth/access-bootstrap", API_BASE);
  url.searchParams.set("next", appendBootstrapRetryMarker(nextPath));
  return url.toString();
}

export function buildCloudflareAccessLogoutUrl(): string {
  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${origin}/cdn-cgi/access/logout`;
    }
  }

  return `${CLOUDFLARE_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/logout`;
}

export function markCloudflareLoggedOut(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CLOUDFLARE_LOGGED_OUT_STORAGE_KEY, "1");
}

export function hasCloudflareLoggedOutFlag(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(CLOUDFLARE_LOGGED_OUT_STORAGE_KEY) === "1";
}

export function clearCloudflareLoggedOutFlag(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CLOUDFLARE_LOGGED_OUT_STORAGE_KEY);
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

export interface AnalysisMetric {
  id: string;
  metric_date: string;
  window_days: 7 | 30;
  type: "community" | "portfolio";
  community_id: string | null;
  occupancy_rate: number | null;
  leased_rate: number | null;
  traffic_count: number | null;
  applications_count: number | null;
  move_ins: number | null;
  move_outs: number | null;
  delinquency_rate: number | null;
  notes_text: string | null;
}

export interface MarketingWeeklyRecord {
  id: string;
  week_ending: string;
  community_id: string;
  leads_count: number | null;
  cost_per_lead: number | null;
  ad_spend: number | null;
  mentions_json: string | null;
  notes_text: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MarketingScanResponse {
  processed: number;
  sent: number;
  suppressed_duplicate: number;
}

export interface AnalysisResponse {
  week_ending: string;
  community: Pick<Community, "id" | "name" | "external_key" | "region" | "status"> | null;
  metrics: {
    t7_community: AnalysisMetric | null;
    t7_portfolio: AnalysisMetric | null;
    t30_community: AnalysisMetric | null;
    t30_portfolio: AnalysisMetric | null;
  };
  marketing: MarketingWeeklyRecord | null;
  communities: AnalysisMetric[] | null;
}

export interface CaptainBriefRead {
  property: Community;
  propertyCode: string;
  captainName: string;
  latestBrief: Record<string, unknown> | null;
  summary: string;
  period: {
    start: string | null;
    end: string | null;
    generatedAt: string | null;
  };
  sourceAuthority: string;
  activeWatchItems: Array<Record<string, unknown>>;
  activeActions: Array<Record<string, unknown>>;
  resolvedSourceItems: Array<Record<string, unknown>>;
  recentRuns: Array<Record<string, unknown>>;
  sources: Record<string, unknown>;
  diagnosticRead: {
    status: string;
    standard: string;
    executiveRead: string;
    primaryConstraint: string;
    confidence: string;
    designationDoctrine: Record<string, unknown>;
    recoveryMath: {
      targetExposurePct: number;
      unitCount: number | null;
      currentOccupancy: number | null;
      currentExposurePct: number | null;
      availableUnits: number | null;
      targetAvailableUnits: number | null;
      moveInsNeeded: number | null;
      currentT30GuestCards: number | null;
      closeRatio: number | null;
      guestCardsNeededAtCurrentClose: number | null;
      volumeMultiple: number | null;
      volumeRealistic: boolean | null;
    };
    funnelDiagnosis: {
      status: string;
      posture: string;
      narrative: string | null;
      topFrictionReasons: Array<{ reason: string; count: number }>;
      topFrictionSources: Array<{ source: string; count: number }>;
    };
    sourceSpendDiagnosis: Record<string, unknown> | null;
    competitorMarketRead: Record<string, unknown>;
    peerFamilyRead: {
      status: string;
      source?: string;
      reportDate?: string | null;
      peerSelection?: string;
      subject?: Record<string, unknown>;
      peerSet: Array<Record<string, unknown>>;
      borrowableTactics: Array<Record<string, unknown>>;
      message?: string;
    };
    floorplanExposure: Array<Record<string, unknown>>;
    recommendations: Array<Record<string, unknown>>;
    doNotRecommend: string[];
    sourceGaps: string[];
    proofCadence: string;
  };
  competitorMarketRead: Record<string, unknown>;
  marketingInsight: {
    status: string;
    reportDate: string | null;
    packet: Record<string, unknown> | null;
    propertySummary: Record<string, unknown> | null;
    availableUnitInterest: Record<string, unknown> | null;
    trafficConversions: Record<string, unknown> | null;
    cancelDenial: {
      reportDate: string | null;
      rowCount: number;
      topReasons: Array<{ reason: string; count: number }>;
      topSources: Array<{ source: string; count: number }>;
      rows: Array<Record<string, unknown>>;
    };
    conversionRead: {
      posture: string;
      metrics: Record<string, unknown>;
    };
    sourceSpendRead: Record<string, unknown>;
    narrative: string;
    sourceAuthority: string;
  };
  operatingSnapshot: {
    status: string;
    sourceNeeded: string | null;
    message: string;
    metrics: Record<string, unknown> | null;
  };
  inventory: {
    latestSnapshot: string | null;
    buckets: {
      aged30: number;
      aged60: number;
      aged90: number;
      aged180: number;
      aged365: number;
    };
    floorplans: Array<Record<string, unknown>>;
    agedUnits: Array<Record<string, unknown>>;
  };
}

export interface CaptainRosterItem {
  propertyCode: string;
  communityId: string | null;
  propertyName: string;
  region: string | null;
  unitCount: number | null;
  fullUrl: string | null;
  commandPosture: {
    scopeTypes: string[];
    designation: string | null;
    market: string | null;
    cadences: string[];
    supportAgentCount: number;
    intensity: "baseline" | "focused" | "urgent";
  };
  supportAgentCount: number;
  dailyAgentCount: number;
  weeklyAgentCount: number;
  latestRunAt: string | null;
  runCount: number;
  failedRunCount: number;
  activeWatchCount: number;
  highWatchCount: number;
  activeActionCount: number;
  blockedActionCount: number;
  latestBriefAt: string | null;
  briefCount: number;
  latestMemoryAt: string | null;
  memoryCount: number;
}

export interface CaptainRosterResponse {
  summary: {
    propertyCount: number;
    activeAgentCount: number;
    urgentCount: number;
    focusedCount: number;
    activeWatchCount: number;
    activeActionCount: number;
    staleMemoryCount: number;
  };
  items: CaptainRosterItem[];
}

export interface CaptainCommandCenter {
  property: Community;
  propertyCode: string;
  commandPosture: CaptainRosterItem["commandPosture"];
  agents: Array<Record<string, unknown>>;
  latestMemory: Record<string, unknown> | null;
  latestRuns: Array<Record<string, unknown>>;
  watchItems: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  briefRuns: Array<Record<string, unknown>>;
  memoryEntries: Array<Record<string, unknown>>;
  sourceCoverage: Array<{
    key: string;
    label: string;
    group: string;
    rows: number;
    latest: string | null;
    status: string;
  }>;
}

export interface CaptainOfficeHistoryItem {
  session_id: string;
  interaction_id: string;
  property_id: string;
  user_id: string;
  actor: string;
  input_text: string;
  input_type: string;
  intent: string;
  subtype: string | null;
  timestamp: string;
  classification_confidence: number;
  runtime_mode: string;
  runtime_hash: string;
  correlation_id: string | null;
  directive_snapshot: Record<string, unknown> | null;
  request_id: string | null;
  authority_level: string | null;
  evidence_packet_hash: string | null;
  payload_hash: string | null;
  response_id: string | null;
  conversational_response: string | null;
  reasoning_summary: string | null;
  structured_outputs: Record<string, unknown> | null;
  confidence: number | null;
  publishability: string | null;
  escalation_required: boolean;
  response_hash: string | null;
  generated_at: string | null;
}

export interface CaptainEvidencePacketRead {
  evidence_packet_id: string;
  property_id: string;
  included_sources: string[];
  freshness_state: Record<string, unknown>;
  evidence_hash: string;
  generated_at: string;
  directive_snapshot_id: string | null;
  evidence: Array<Record<string, unknown>>;
}

export interface CaptainMemoryCandidateRead {
  memory_candidate_id: string;
  source_interaction_id: string;
  candidate_type: string;
  confidence: number;
  verification_required: boolean;
  promotion_state: string;
  expires_at: string | null;
  conflict_state: string;
  source_evidence_hash: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  source_intent: string;
  source_timestamp: string;
}

export interface CaptainOfficeState {
  property: Community & { property_code?: string | null };
  runtime_status: {
    latest_runtime_mode: string | null;
    latest_authority_level: string | null;
    latest_confidence: number | null;
    latest_publishability: string | null;
    latest_escalation_required: boolean;
    directive_snapshot: Record<string, unknown> | null;
    evidence_packet_hash: string | null;
    runtime_hash: string | null;
    response_hash: string | null;
    last_interaction_at: string | null;
  };
  history: CaptainOfficeHistoryItem[];
  evidence_packets: CaptainEvidencePacketRead[];
  memory_candidates: CaptainMemoryCandidateRead[];
  watch_items: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  audit_events: Array<Record<string, unknown>>;
  alerts: Array<{ severity: string; title: string; detail: string }>;
}

export interface AwarenessCareMetadata {
  do_not_overstate: boolean;
  ask_before_public_use: boolean;
  avoid_person_judgment: boolean;
  temporary_context: boolean;
  sensitive_context: boolean;
  share_as_pattern_only: boolean;
  requires_human_review: boolean;
  preferred_tone: string;
  correction_allowed_by_roles: string[];
}

export interface AwarenessAgentIdentity {
  agent_id: string;
  agent_type: string;
  display_name: string;
  formal_title: string;
  assigned_property_id: string | null;
  assigned_region_id: string | null;
  assigned_lane_id: string | null;
  active_status: string;
  created_at: string;
  retired_at: string | null;
  identity_version: number;
}

export interface AwarenessMemoryItem {
  memory_id: string;
  memory_class: string;
  lifecycle_state: string;
  property_id: string | null;
  region_id: string | null;
  agent_id: string;
  source_type: string;
  source_ref: string | null;
  statement: string;
  confidence: number;
  freshness_state: string;
  sensitivity: string;
  visibility_scope: string;
  allowed_uses: string[];
  blocked_uses: string[];
  verification_required: boolean;
  correction_path: string;
  expires_at: string | null;
  revalidation_due_at: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  care_metadata: AwarenessCareMetadata;
  created_at: string;
  updated_at: string;
}

export interface AwarenessSelfNote {
  note_id: string;
  agent_id: string;
  property_id: string | null;
  region_id: string | null;
  note_text: string;
  note_type: string;
  importance: number;
  visibility: string;
  reminder_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
  source_context: string | null;
  created_at: string;
  care_metadata: AwarenessCareMetadata;
}

export interface AwarenessCommitment {
  commitment_id: string;
  agent_id: string;
  property_id: string | null;
  region_id: string | null;
  commitment_type: string;
  description: string;
  owed_by: string;
  owed_to: string;
  due_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  care_metadata: AwarenessCareMetadata;
}

export interface AwarenessRegionalSummary {
  summary_id: string;
  region_id: string;
  generated_at: string;
  summary_period: string;
  source_property_count: number;
  pattern_summary: string;
  market_context: string;
  shared_risks: string[];
  successful_tactics: string[];
  cautionary_notes: string[];
  freshness_state: string;
  expires_at: string | null;
}

export interface AwarenessMemoryPosture {
  agent_identity: AwarenessAgentIdentity | null;
  active_concerns: AwarenessMemoryItem[];
  open_questions: AwarenessSelfNote[];
  active_self_notes: AwarenessSelfNote[];
  open_commitments: AwarenessCommitment[];
  recent_human_submitted_claims: AwarenessMemoryItem[];
  stale_or_expiring_memory: AwarenessMemoryItem[];
  verification_needed_items: Array<AwarenessMemoryItem | AwarenessSelfNote>;
  unresolved_conflicts: AwarenessMemoryItem[];
  recent_lessons: AwarenessSelfNote[];
  archived_superseded_highlights: AwarenessMemoryItem[];
  regional_awareness_summary: AwarenessRegionalSummary | null;
  uncertainties: string[];
  do_not_recommend_without_more_evidence: string[];
  care_warnings: string[];
}

export interface CaptainRuntimeInteractionInput {
  property_id: string;
  input_text: string;
  input_type?: "text" | "system_event" | "file_note";
  runtime_mode?: "monitoring" | "lightweight" | "standard" | "escalated" | "executive" | "simulation";
  actor?: "user" | "captain" | "system" | "bench" | "fleet_scribe";
  report_family?: string | null;
  correlation_id?: string | null;
  idempotency_key?: string | null;
}

export type ExpertLaneId =
  | "quartermaster"
  | "navigator"
  | "revenue_advisor"
  | "signals_officer"
  | "market_scout"
  | "product_readiness_officer"
  | "reputation_officer"
  | "resident_experience_officer"
  | "engineer"
  | "seasonality_demand_timing_advisor"
  | "unit_type_fit_advisor"
  | "market_elasticity_advisor"
  | "operational_capacity_advisor"
  | "trust_and_proof_advisor"
  | "peer_borrowing_advisor"
  | "leasing_performance_advisor";

export interface ExpertReadFindingRead {
  finding_id: string;
  finding_type: string;
  statement: string;
  evidence_refs: string[];
  confidence: number;
  freshness: string;
  publishability: string;
  verification_required: boolean;
}

export interface ExpertReadRecommendationRead {
  recommendation_id: string;
  recommendation_type: string;
  recommendation_text: string;
  evidence_refs: string[];
  proof_metric: string | null;
  owner_lane: string;
  confidence: number;
  blocked_reason: string | null;
  publishability: string;
}

export interface ExpertReadRead {
  expert_read_id: string;
  request_id: string;
  lane_id: ExpertLaneId;
  property_id: string;
  read_status: string;
  specialist_summary: string;
  do_not_do_rules: string[];
  required_evidence: string[];
  evidence_used: string[];
  confidence: number;
  freshness_state: string;
  publishability: string;
  escalation_required: boolean;
  conflicts: string[];
  generated_at: string;
  read_hash: string;
  payload_hash?: string | null;
  findings: ExpertReadFindingRead[];
  recommendations: ExpertReadRecommendationRead[];
  request: {
    request_id: string;
    requested_by: string;
    source_runtime_id: string | null;
    source_interaction_id: string | null;
    runtime_mode: string;
    report_family: string | null;
    reason: string;
    requested_at: string;
    directive_snapshot_id: string;
    directive_snapshot_hash: string;
    evidence_packet_id: string;
    evidence_packet_hash: string;
    request_hash: string;
    correlation_id: string | null;
  } | null;
}

export interface ExpertReadInput {
  property_id: string;
  lane_id: ExpertLaneId;
  evidence_packet_id: string;
  runtime_mode?: CaptainRuntimeInteractionInput["runtime_mode"];
  report_family?: string | null;
  reason: string;
  source_runtime_id?: string | null;
  source_interaction_id?: string | null;
  correlation_id?: string | null;
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

export interface CommunityMutationInput {
  name: string;
  external_key?: string;
  region?: string;
  manager_name?: string;
  unit_count?: number;
  ga4_property_id?: string;
  full_url?: string;
  encasa_short_name?: string;
  encasa_property_code?: string;
  city?: string;
  state?: string;
  status?: "active" | "inactive";
}

export async function createCommunity(body: CommunityMutationInput): Promise<Community> {
  const res = await apiFetch("/v1/communities", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to create community");
  return data;
}

export async function patchCommunity(id: string, body: Partial<CommunityMutationInput>): Promise<Community> {
  const res = await apiFetch(`/v1/communities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to update community");
  return data;
}

export async function deleteCommunity(id: string): Promise<void> {
  const res = await apiFetch(`/v1/communities/${id}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to delete community");
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

export async function getAnalysis(filters: { week_ending: string; community_id?: string }): Promise<AnalysisResponse> {
  const res = await apiFetch(`/v1/analysis${qs(filters)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load POP Brief analysis");
  }
  return res.json();
}

export async function getCaptainBriefRead(propertyId: string): Promise<CaptainBriefRead> {
  const res = await apiFetch(`/v1/captain/properties/${encodeURIComponent(propertyId)}/brief/latest`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain Brief");
  }
  return res.json();
}

export async function getCaptainRoster(): Promise<CaptainRosterResponse> {
  const res = await apiFetch("/v1/captain/roster");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain roster");
  }
  return res.json();
}

export async function getCaptainCommandCenter(propertyId: string): Promise<CaptainCommandCenter> {
  const res = await apiFetch(`/v1/captain/properties/${encodeURIComponent(propertyId)}/command-center`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain command center");
  }
  return res.json();
}

export async function getCaptainOfficeState(propertyId: string): Promise<CaptainOfficeState> {
  const res = await apiFetch(`/v1/captain-runtime/properties/${encodeURIComponent(propertyId)}/office`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain’s Office");
  }
  return res.json();
}

export async function getAwarenessMemoryPosture(propertyId: string): Promise<AwarenessMemoryPosture> {
  const res = await apiFetch(`/v1/awareness/properties/${encodeURIComponent(propertyId)}/posture`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Awareness Network posture");
  }
  return res.json();
}

export async function createAwarenessSelfNote(propertyId: string, body: {
  note_text: string;
  note_type?: string;
  importance?: number;
  visibility?: string;
  reminder_at?: string | null;
  expires_at?: string | null;
  source_context?: string | null;
}): Promise<AwarenessSelfNote> {
  const res = await apiFetch(`/v1/awareness/properties/${encodeURIComponent(propertyId)}/self-notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to create self note");
  return data;
}

export async function createAwarenessCommitment(propertyId: string, body: {
  commitment_type: string;
  description: string;
  owed_by: string;
  owed_to: string;
  due_at?: string | null;
}): Promise<AwarenessCommitment> {
  const res = await apiFetch(`/v1/awareness/properties/${encodeURIComponent(propertyId)}/commitments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to create commitment");
  return data;
}

export async function getCaptainRuntimeHistory(propertyId: string, limit = 25): Promise<CaptainOfficeHistoryItem[]> {
  const res = await apiFetch(`/v1/captain-runtime/properties/${encodeURIComponent(propertyId)}/history?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain Runtime history");
  }
  return (await res.json()).items;
}

export async function getCaptainRuntimeEvidence(propertyId: string, limit = 10): Promise<CaptainEvidencePacketRead[]> {
  const res = await apiFetch(`/v1/captain-runtime/properties/${encodeURIComponent(propertyId)}/evidence?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain Runtime evidence");
  }
  return (await res.json()).items;
}

export async function getCaptainMemoryCandidates(propertyId: string, limit = 25): Promise<CaptainMemoryCandidateRead[]> {
  const res = await apiFetch(`/v1/captain-runtime/properties/${encodeURIComponent(propertyId)}/memory-candidates?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Captain memory candidates");
  }
  return (await res.json()).items;
}

export async function submitCaptainRuntimeInteraction(body: CaptainRuntimeInteractionInput): Promise<CaptainOfficeHistoryItem | Record<string, unknown>> {
  const res = await apiFetch("/v1/captain-runtime/interactions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to submit Captain Runtime interaction");
  return data;
}

export async function getExpertReadsForProperty(propertyId: string, limit = 25): Promise<ExpertReadRead[]> {
  const res = await apiFetch(`/v1/expert-reads/properties/${encodeURIComponent(propertyId)}?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Expert Reads");
  }
  return (await res.json()).items;
}

export async function getExpertRead(expertReadId: string): Promise<ExpertReadRead> {
  const res = await apiFetch(`/v1/expert-reads/${encodeURIComponent(expertReadId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load Expert Read");
  }
  return res.json();
}

export async function requestExpertRead(body: ExpertReadInput): Promise<Record<string, unknown>> {
  const res = await apiFetch("/v1/expert-reads", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to request Expert Read");
  return data;
}

export async function getMarketingWeekly(filters: { community_id?: string; week_ending?: string }): Promise<MarketingWeeklyRecord[]> {
  const res = await apiFetch(`/v1/marketing${qs(filters)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to load marketing weekly data");
  }
  return (await res.json()).items;
}

export async function upsertMarketingWeekly(
  id: string,
  body: {
    community_id: string;
    week_ending: string;
    leads_count?: number;
    cost_per_lead?: number;
    ad_spend?: number;
    mentions_json?: string;
    notes_text?: string;
  }
): Promise<MarketingWeeklyRecord> {
  const res = await apiFetch(`/v1/marketing/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to save marketing weekly data");
  return data;
}

export async function scanMarketingMentions(weekEnding: string): Promise<MarketingScanResponse> {
  const res = await apiFetch("/v1/marketing/scan-mentions", {
    method: "POST",
    body: JSON.stringify({ week_ending: weekEnding }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to scan marketing mentions");
  return data;
}

export async function importWeeklyMetricsText(tsv: string): Promise<{ import_run_id: string; status: string; rows_applied: number }> {
  const res = await apiFetch("/v1/metrics/import/paste", {
    method: "POST",
    body: JSON.stringify({ tsv }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to import weekly metrics");
  return data;
}

export async function uploadWeeklyMetricsFile(file: File): Promise<{ import_run_id: string; status: string; rows_applied: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/v1/metrics/import/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to upload weekly metrics");
  return data;
}

export async function createBackupArtifact(entities?: string[]): Promise<{ ok: true; key: string; entities: string[]; counts: Record<string, number> }> {
  const res = await apiFetch("/v1/exports/backup", {
    method: "POST",
    body: JSON.stringify({ entities }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Failed to create backup artifact");
  return data;
}

export async function upsertMarketingData(id: string, body: Record<string, unknown>): Promise<MarketingData> {
  const res = await apiFetch(`/v1/marketing-data/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message ?? "Failed to save marketing data"); }
  return res.json();
}

export async function importWebsiteSeo(rows: Record<string, unknown>[]): Promise<{
  successful: number;
  failed: number;
  errors?: { row: number; error: string }[];
}> {
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

export type PibBuilderScope = "portfolio" | "property";
export type PibBuilderCadence = "one_time" | "weekly" | "monthly" | "quarterly";
export type PibBuilderScheduleStatus = "draft" | "active" | "paused" | "archived";

export interface PibBuilderConfig {
  id: string;
  report_name: string;
  scope: PibBuilderScope;
  community_id: string | null;
  community_name: string | null;
  date_range: string;
  preset_id: string;
  preset_label: string;
  section_ids: string[];
  canonical_path: string;
  status: "active" | "archived";
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PibBuilderSchedule {
  id: string;
  config_id: string;
  cadence: PibBuilderCadence;
  timezone: string;
  day_of_week: number | null;
  day_of_month: string | null;
  send_time: string;
  recipients: string[];
  status: PibBuilderScheduleStatus;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  failure_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PibBuilderRun {
  id: string;
  schedule_id: string | null;
  config_id: string;
  run_type: "manual" | "scheduled";
  run_status: "queued" | "blocked" | "sent" | "failed" | "skipped";
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  canonical_path: string;
  recipients: string[];
  delivery_status: string;
  delivery_error: string | null;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PibBuilderGenerationJob {
  id: string;
  config_id: string;
  run_id: string | null;
  requested_action: "open" | "email_now" | "save" | "scheduled_email";
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  scope: PibBuilderScope;
  community_id: string | null;
  community_name: string | null;
  date_range: string;
  preset_id: string;
  preset_label: string;
  section_ids: string[];
  recipients: string[];
  artifact_key: string | null;
  artifact_filename: string | null;
  error_text: string | null;
  created_by: string | null;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface PibBuilderState {
  configs: PibBuilderConfig[];
  schedules: PibBuilderSchedule[];
  runs: PibBuilderRun[];
  generation_jobs?: PibBuilderGenerationJob[];
}

export interface PibBuilderConfigInput {
  report_name: string;
  scope: PibBuilderScope;
  community_id?: string | null;
  community_name?: string | null;
  date_range: string;
  preset_id: string;
  preset_label: string;
  section_ids: string[];
}

export interface PibBuilderScheduleInput {
  config_id: string;
  cadence: PibBuilderCadence;
  timezone?: string;
  day_of_week?: number | null;
  day_of_month?: string | null;
  send_time: string;
  recipients: string[];
  status: Exclude<PibBuilderScheduleStatus, "archived">;
}

export async function getPibBuilderState(): Promise<PibBuilderState> {
  const res = await apiFetch("/v1/pib-builder");
  if (!res.ok) throw new Error("Failed to load PIB Builder state");
  return res.json();
}

export async function createPibBuilderConfig(body: PibBuilderConfigInput): Promise<PibBuilderConfig> {
  const res = await apiFetch("/v1/pib-builder/configs", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to save PIB Builder config");
  return (await res.json()).config;
}

export async function updatePibBuilderConfig(id: string, body: Partial<PibBuilderConfigInput> & { status?: "active" | "archived" }): Promise<PibBuilderConfig> {
  const res = await apiFetch(`/v1/pib-builder/configs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to update PIB Builder config");
  return (await res.json()).config;
}

export async function createPibBuilderSchedule(body: PibBuilderScheduleInput): Promise<PibBuilderSchedule> {
  const res = await apiFetch("/v1/pib-builder/schedules", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to create PIB Builder schedule");
  return (await res.json()).schedule;
}

export async function updatePibBuilderSchedule(
  id: string,
  body: Partial<Omit<PibBuilderScheduleInput, "status">> & { status?: PibBuilderScheduleStatus }
): Promise<PibBuilderSchedule> {
  const res = await apiFetch(`/v1/pib-builder/schedules/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to update PIB Builder schedule");
  return (await res.json()).schedule;
}

export async function runPibBuilderScheduleNow(id: string): Promise<PibBuilderRun> {
  const res = await apiFetch(`/v1/pib-builder/schedules/${encodeURIComponent(id)}/run`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to run PIB Builder schedule");
  return (await res.json()).run;
}

export async function createPibBuilderGenerationJob(
  configId: string,
  body: { requested_action: PibBuilderGenerationJob["requested_action"]; recipients?: string[]; run_id?: string | null }
): Promise<PibBuilderGenerationJob> {
  const res = await apiFetch(`/v1/pib-builder/configs/${encodeURIComponent(configId)}/generation-jobs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to queue canonical PIB generation");
  return (await res.json()).generation_job;
}

export async function getPibBuilderGenerationJob(id: string): Promise<PibBuilderGenerationJob> {
  const res = await apiFetch(`/v1/pib-builder/generation-jobs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to load canonical PIB generation job");
  return (await res.json()).generation_job;
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

export interface PondLandscapeFoundation {
  id: string;
  name: string;
  status: string;
  owner: string;
  paths: string[];
  trust_zone: string;
  responsibilities: string[];
  posture: "healthy" | "active_build" | "specialized_live" | "migration_debt" | "trust_hardening" | "external_governed" | "reference_only";
  signal: string;
  evidence: {
    represented_in_pond: boolean;
    pond_surface_href: string | null;
    boundary_class: string;
    web_surface_live: boolean;
    api_surface_live: boolean;
    expected_zero_trust_mode: "human_access" | "machine_access" | "mixed_access" | "local_only" | "external_governed";
    observed_zero_trust_posture: "session_origin_guard" | "service_token_capable" | "mixed_session_and_service" | "session_plus_debug_bypass" | "migration_boundary" | "external_governed" | "not_inferred";
    trust_alignment: "aligned" | "transitional" | "review";
    trust_evidence_points: string[];
    remediation_track: {
      label: string;
      doc_path: string | null;
      route_href: string | null;
      status: "open" | "active" | "closed";
      status_detail: string;
      completion_criteria: Array<{
        label: string;
        met: boolean;
        detail: string | null;
      }>;
    };
    evidence_points: string[];
    next_action: {
      state: "clear" | "watch" | "action";
      title: string;
      detail: string;
      href: string | null;
    };
  };
}

export interface PondLandscapeSurface {
  id: string;
  name: string;
  status: string;
  path: string;
  depends_on: string[];
  trust_zone: string;
  visibility_target: string;
  posture: "healthy" | "active_build" | "specialized_live" | "migration_debt" | "trust_hardening" | "external_governed" | "reference_only";
  signal: string;
  evidence: {
    represented_in_pond: boolean;
    pond_surface_href: string | null;
    boundary_class: string;
    web_surface_live: boolean;
    api_surface_live: boolean;
    expected_zero_trust_mode: "human_access" | "machine_access" | "mixed_access" | "local_only" | "external_governed";
    observed_zero_trust_posture: "session_origin_guard" | "service_token_capable" | "mixed_session_and_service" | "session_plus_debug_bypass" | "migration_boundary" | "external_governed" | "not_inferred";
    trust_alignment: "aligned" | "transitional" | "review";
    trust_evidence_points: string[];
    remediation_track: {
      label: string;
      doc_path: string | null;
      route_href: string | null;
      status: "open" | "active" | "closed";
      status_detail: string;
      completion_criteria: Array<{
        label: string;
        met: boolean;
        detail: string | null;
      }>;
    };
    evidence_points: string[];
    next_action: {
      state: "clear" | "watch" | "action";
      title: string;
      detail: string;
      href: string | null;
    };
  };
}

export interface PondLandscapeLegacySystem {
  id: string;
  name: string;
  status: string;
  path: string;
  canonical_migration_target: string;
  notes: string;
  posture: "healthy" | "active_build" | "specialized_live" | "migration_debt" | "trust_hardening" | "external_governed" | "reference_only";
  signal: string;
  evidence: {
    represented_in_pond: boolean;
    pond_surface_href: string | null;
    boundary_class: string;
    web_surface_live: boolean;
    api_surface_live: boolean;
    expected_zero_trust_mode: "human_access" | "machine_access" | "mixed_access" | "local_only" | "external_governed";
    observed_zero_trust_posture: "session_origin_guard" | "service_token_capable" | "mixed_session_and_service" | "session_plus_debug_bypass" | "migration_boundary" | "external_governed" | "not_inferred";
    trust_alignment: "aligned" | "transitional" | "review";
    trust_evidence_points: string[];
    remediation_track: {
      label: string;
      doc_path: string | null;
      route_href: string | null;
      status: "open" | "active" | "closed";
      status_detail: string;
      completion_criteria: Array<{
        label: string;
        met: boolean;
        detail: string | null;
      }>;
    };
    evidence_points: string[];
    next_action: {
      state: "clear" | "watch" | "action";
      title: string;
      detail: string;
      href: string | null;
    };
  };
}

export interface PondLandscapeTrustZone {
  id: string;
  description: string;
}

export interface PondLandscapeResponse {
  version: string;
  updated_at: string;
  purpose: string;
  summary: {
    canonical_foundation_count: number;
    product_surface_count: number;
    legacy_or_specialized_count: number;
    nested_repo_count: number;
    trust_zone_count: number;
    represented_in_pond_count: number;
    off_pond_count: number;
    machine_api_gap_count: number;
    human_surface_gap_count: number;
    trust_review_count: number;
    trust_aligned_count: number;
    trust_transitional_count: number;
    trust_review_node_count: number;
  };
  gap_runbook: Array<{
    id: string;
    label: string;
    state: "clear" | "watch" | "action";
    count: number;
    detail: string;
    next_move: string;
    href: string | null;
  }>;
  canonical_foundations: PondLandscapeFoundation[];
  product_surfaces: PondLandscapeSurface[];
  legacy_or_specialized_systems: PondLandscapeLegacySystem[];
  nested_git_repos: string[];
  trust_zones: PondLandscapeTrustZone[];
  shared_security_posture: {
    secret_authority: string;
    outer_trust_boundary: string;
    business_authorization: string;
    preferred_machine_identity: string;
    migration_debt: string[];
  };
  immediate_priorities: string[];
  outcome_map: {
    version: string;
    updated_at: string;
    purpose: string;
    outcomes: Array<{
      id: string;
      name: string;
      category: string;
      canonical_owner: string;
      canonical_surfaces: string[];
      mission: string;
      allowed_specialized_systems: string[];
      consolidate_now: string[];
      current_state: string;
      next_moves: string[];
    }>;
    enterprise_rules: string[];
    accepted_specializations: Array<{
      system: string;
      reason: string;
    }>;
    consolidate_now: Array<{
      system: string;
      target_owner: string;
      reason: string;
    }>;
  };
  enterprise_readiness: {
    version: string;
    updated_at: string;
    purpose: string;
    readiness_summary: {
      overall_state: string;
      headline: string;
      strongest_areas: string[];
      most_critical_gaps: string[];
    };
    domains: Array<{
      id: string;
      name: string;
      readiness: string;
      owner: string;
      scope: string;
      strengths: string[];
      gaps: string[];
      next_moves: string[];
    }>;
    priority_workstreams: Array<{
      id: string;
      name: string;
      severity: "critical" | "high" | "medium";
      owner: string;
      target_outcomes: string[];
      timeframe: string;
      description: string;
      exit_criteria: string[];
    }>;
    next_90_days: Array<{
      phase: string;
      focus: string;
      moves: string[];
    }>;
  };
  release_governance: {
    version: string;
    updated_at: string;
    purpose: string;
    promotion_model: {
      canonical_release_path: string;
      working_rule: string;
      release_principles: string[];
    };
    release_gates: Array<{
      id: string;
      label: string;
      description: string;
      required_checks: string[];
    }>;
    active_workstream_lanes: Array<{
      id: string;
      label: string;
      recommended_branch: string;
      scope: string;
    }>;
    anti_patterns: string[];
    next_moves: string[];
  };
  service_operations: {
    version: string;
    updated_at: string;
    purpose: string;
    services: Array<{
      id: string;
      name: string;
      owner: string;
      service_tier: string;
      runtime: string;
      deployment_target: string;
      release_lane: string;
      trust_boundary: string;
      canonical_surface: string | null;
      primary_runbook: string | null;
      depends_on: string[];
      operational_focus: string[];
    }>;
  };
  service_operations_summary: {
    service_count: number;
    foundation_count: number;
    critical_operator_count: number;
    governed_workspace_count: number;
    machine_or_mixed_count: number;
    local_runtime_count: number;
    release_lane_count: number;
  };
  deployment_provenance: {
    version: string;
    updated_at: string;
    purpose: string;
    environments: Array<{
      id: string;
      label: string;
      web_hosts?: string[];
      web_host_suffixes?: string[];
      api_hosts: string[];
      release_posture: string;
    }>;
    rules: {
      canonical_release_path: string;
      preferred_api_base: string;
      production_debug_flags_must_be_false: string[];
      preview_hosts_are_allowed: boolean;
      custom_pages_aliases_are_release_review_only: boolean;
    };
    service_bindings: Array<{
      service_id: string;
      expected_environment: string;
      managed_target: string;
    }>;
  };
  deployment_runtime: {
    api_request_origin: string;
    api_request_host: string;
    cloudflare_access_team_domain: string | null;
    access_auto_provision_enabled: boolean;
    access_default_role: string | null;
  };
  release_provenance: {
    version: string;
    updated_at: string;
    purpose: string;
    release_descriptor: {
      source_branch: string;
      baseline_commit: {
        sha: string;
        short_sha: string;
        committed_at: string;
        subject: string;
      };
      source_mode: string;
      release_lane: string;
      canonical_release_path: string;
      provenance_status: "aligned" | "transitional" | "review";
      provenance_note: string;
    };
    deployments: Array<{
      service_id: string;
      target: string;
      deployed_at: string;
      runtime_identifier: string;
      public_url: string;
    }>;
    next_moves: string[];
  };
  release_reconcile_snapshot: {
    version: string;
    updated_at: string;
    purpose: string;
    working_tree: {
      changed_file_count: number;
      primary_release_slice_count: number;
      non_primary_count: number;
    };
    recommended_release_candidate: {
      label: string;
      canonical_branch: string;
      included_lanes: string[];
      exclude_lanes: string[];
      readiness_note: string;
    };
    lane_counts: Record<string, number>;
    lane_examples: Record<string, string[]>;
  };
}

export async function getPondLandscape(): Promise<PondLandscapeResponse> {
  const res = await apiFetch("/v1/pond/landscape");
  if (!res.ok) throw new Error("Failed to load pond landscape");
  return res.json();
}

export interface EvsProperty {
  property_id: string;
  property_name: string;
  community_id?: string | null;
  legacy_url?: string | null;
  staging_url: string;
  live_url?: string | null;
  site_type?: "resi" | "legacy";
  known_page_paths?: string[];
  cohort: "pilot";
  active: boolean;
}

export interface EvsExecutionPlan {
  request: {
    request_id: string;
    property_id: string;
    source_consumer: "property_advocate" | "deploy_pipeline" | "governance_audit" | "operator";
    environment: "staging" | "prod";
    reason: string;
    priority: "low" | "normal" | "high" | "urgent";
    target_pages: string[];
    validation_profiles: ("broad_experiential_homepage" | "critical_cta_smoke" | "header_navigation_integrity" | "portfolio_functionality_regression" | "apartments_pricing_deep_journey" | "apartments_pricing_mobile_journey" | "contact_form_checks" | "lead_attribution_e2e" | "employee_photo_integrity")[];
    device_profiles: ("iphone_safari" | "desktop_chrome")[];
    execution_mode: "manual" | "post_deploy" | "scheduled";
    trigger_metadata: Record<string, unknown>;
  };
  property: EvsProperty;
  profiles: {
    id: "broad_experiential_homepage" | "critical_cta_smoke" | "header_navigation_integrity" | "portfolio_functionality_regression" | "apartments_pricing_deep_journey" | "apartments_pricing_mobile_journey" | "contact_form_checks" | "lead_attribution_e2e" | "employee_photo_integrity";
    name: string;
    description: string;
    goals: string[];
    supported_device_profiles: ("iphone_safari" | "desktop_chrome")[];
    provider: "browserstack";
  }[];
  workflow_name: string;
  workflow_inputs: Record<string, string>;
}

export interface EvsRequestRuntimeView {
  request_id: string;
  source_consumer: "property_advocate" | "deploy_pipeline" | "governance_audit" | "operator";
  property_id: string;
  environment: "staging" | "prod";
  reason: string;
  priority: "low" | "normal" | "high" | "urgent";
  target_pages: string[];
  validation_profiles: ("broad_experiential_homepage" | "critical_cta_smoke" | "header_navigation_integrity" | "portfolio_functionality_regression" | "apartments_pricing_deep_journey" | "apartments_pricing_mobile_journey" | "contact_form_checks" | "lead_attribution_e2e" | "employee_photo_integrity")[];
  device_profiles: ("iphone_safari" | "desktop_chrome")[];
  governance_context: Record<string, unknown> | null;
  execution_mode: "manual" | "post_deploy" | "scheduled";
  trigger_metadata: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  provider: "browserstack";
  requested_by: string | null;
  orchestrator_ref: string | null;
  created_at: string;
  updated_at: string;
  dispatch_state: "awaiting_handoff" | "handoff_recorded" | "executing" | "completed" | "failed" | "cancelled";
}

export async function getEvsProperties(): Promise<EvsProperty[]> {
  const res = await apiFetch("/v1/evs/properties");
  if (!res.ok) throw new Error("Failed to load EVS properties");
  const data = await res.json();
  return data.properties;
}

export async function getEvsRequests(propertyId?: string): Promise<EvsRequestRuntimeView[]> {
  const suffix = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  const res = await apiFetch(`/v1/evs/requests${suffix}`);
  if (!res.ok) throw new Error("Failed to load EVS requests");
  const data = await res.json();
  return data.requests;
}

export async function createEvsRequest(body: {
  source_consumer: "property_advocate" | "deploy_pipeline" | "governance_audit" | "operator";
  property_id: string;
  environment: "staging" | "prod";
  reason: string;
  priority: "low" | "normal" | "high" | "urgent";
  target_pages: string[];
  validation_profiles: ("broad_experiential_homepage" | "critical_cta_smoke" | "header_navigation_integrity" | "portfolio_functionality_regression" | "apartments_pricing_deep_journey" | "apartments_pricing_mobile_journey" | "contact_form_checks" | "lead_attribution_e2e" | "employee_photo_integrity")[];
  device_profiles: ("iphone_safari" | "desktop_chrome")[];
  execution_mode: "manual" | "post_deploy" | "scheduled";
  trigger_metadata: Record<string, unknown>;
  requested_by?: string;
}): Promise<{ request: EvsRequestRuntimeView; execution_plan: EvsExecutionPlan; note: string }> {
  const res = await apiFetch("/v1/evs/requests", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create EVS request");
  }
  return res.json();
}

export async function recordEvsRequestHandoff(
  requestId: string,
  body: { orchestrator_ref: string; status?: "queued" | "running" },
): Promise<{ request: EvsRequestRuntimeView; execution_plan: EvsExecutionPlan; note: string }> {
  const res = await apiFetch(`/v1/evs/requests/${requestId}/handoff`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to record EVS handoff");
  }
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
  freshness_status?: "fresh" | "warning" | "stale" | "missing" | "idle";
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
      state: "open" | "complete" | "archived" | "blocked" | "advisory" | "not_started";
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
        latest_recorded_date: string | null;
        expected_latest_date: string | null;
        freshness_status: "fresh" | "warning" | "stale" | "missing" | "idle";
        cadence_key: "same_day_manual" | "daily_diagnostic" | "weekly_manual" | "weekly_automated" | "targeted_manual";
        cadence_label: string;
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
  switcher_details?: Array<{
    title: string;
    body: string;
    bullets: string[];
    cta_label: string | null;
  }>;
  image_count: number;
  link_count: number;
  image_url?: string | null;
  updated_at?: string;
}

export interface SiteContentSectionMapping {
  id: string;
  page_id: string;
  section_id: string | null;
  expected_section_key: string | null;
  expected_section_label: string | null;
  expected_section_role: string | null;
  expected_order: number | null;
  match_status: "matched" | "partial" | "extra-on-live" | "missing-from-live";
  match_confidence: number;
  rationale: string;
  created_at: string;
  updated_at: string;
}

export interface SiteContentSectionMappingSummary {
  matched: number;
  partial: number;
  extra_on_live: number;
  missing_from_live: number;
}

export interface SiteContentSectionAssessment {
  id: string;
  page_id: string;
  mapping_id: string;
  section_id: string | null;
  overall_status: "healthy" | "watch" | "needs-attention";
  structural_score: number;
  messaging_score: number;
  specificity_score: number;
  search_value_score: number;
  cta_score: number;
  harmonization_score: number;
  flags_json: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface SiteContentSectionAssessmentSummary {
  healthy: number;
  watch: number;
  needs_attention: number;
}

export interface SiteContentSectionRewrite {
  id: string;
  page_id: string;
  mapping_id: string;
  section_id: string | null;
  draft_status: "not_started" | "drafted" | "in_review" | "approved";
  rewrite_brief: string;
  proposed_copy: string;
  refinement_notes: string;
  governed_inputs_json: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteContentSectionRewriteSummary {
  not_started: number;
  drafted: number;
  in_review: number;
  approved: number;
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
  section_mappings: SiteContentSectionMapping[];
  section_mapping_summary: SiteContentSectionMappingSummary;
  section_assessments: SiteContentSectionAssessment[];
  section_assessment_summary: SiteContentSectionAssessmentSummary;
  section_rewrites: SiteContentSectionRewrite[];
  section_rewrite_summary: SiteContentSectionRewriteSummary;
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

export interface SiteContentRewriteResponse {
  rewrite: SiteContentSectionRewrite;
}

export async function getSiteContentInventory(): Promise<SiteContentInventoryResponse> {
  const res = await apiFetch("/v1/admin/site-content");
  if (!res.ok) throw new Error("Failed to load site content inventory");
  return res.json();
}

export async function getSiteContentProperty(propertyId: string): Promise<SiteContentPropertyResponse> {
  const res = await apiFetch(`/v1/admin/site-content/${propertyId}`);
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
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to crawl property site content");
  }
  return res.json();
}

export async function saveSiteContentSectionRewrite(
  propertyId: string,
  body: {
    page_id: string;
    mapping_id: string;
    section_id?: string | null;
    draft_status: "not_started" | "drafted" | "in_review" | "approved";
    rewrite_brief: string;
    proposed_copy: string;
    refinement_notes: string;
  }
): Promise<SiteContentRewriteResponse> {
  const res = await apiFetch(`/v1/admin/site-content/${propertyId}/rewrite`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to save section rewrite");
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
  publications: {
    id: string;
    publish_status: "pending" | "preview" | "published" | "failed";
    google_post_name: string | null;
    error_message: string | null;
    published_at: string | null;
    created_at: string;
    created_by: string | null;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  }[];
}

export interface GbpPostSuggestion {
  id: string;
  community_id: string;
  community_name: string;
  property_id: string | null;
  angle: string;
  priority: number;
  reason: string;
  source_evidence: string[];
  recommended_channel: "GBP";
  draft_seed: {
    source_label: string;
    notes: string;
    use_captain_context: boolean;
    draft_count: number;
  };
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
  use_captain_context?: boolean;
}

export async function getGbpPostQueue(filters: { status?: string; community_id?: string } = {}): Promise<GbpDraftQueueItem[]> {
  const res = await apiFetch(`/v1/gbp-posts/queue${qs(filters)}`);
  if (!res.ok) throw new Error("Failed to load GBP post queue");
  return (await res.json()).items;
}

export async function getGbpPostSuggestions(filters: { community_id?: string; limit?: number } = {}): Promise<GbpPostSuggestion[]> {
  const res = await apiFetch(`/v1/gbp-posts/suggestions${qs({
    community_id: filters.community_id,
    limit: filters.limit == null ? undefined : String(filters.limit),
  })}`);
  if (!res.ok) throw new Error("Failed to load GBP post suggestions");
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

export async function recordGbpManualPublicationProof(
  draftId: string,
  body: {
    publish_status?: "published" | "failed";
    google_post_name?: string;
    proof_url?: string;
    notes?: string;
    published_at?: string;
  }
) {
  const res = await apiFetch(`/v1/gbp-posts/drafts/${draftId}/publications/manual`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to record GBP publication proof");
  }
  return res.json();
}

export type EdgeExperimentStatus =
  | "draft"
  | "pending_preflight"
  | "preflight_failed"
  | "ready_for_approval"
  | "approved"
  | "scheduled"
  | "running"
  | "paused"
  | "rolled_back"
  | "completed"
  | "promoted"
  | "rejected"
  | "archived";

export type EdgeExperimentChangeType = "text_swap" | "class_swap" | "href_swap" | "insert_adjacent";

export interface EdgeExperimentVariant {
  variant_id: string;
  experiment_id: string;
  variant_key: string;
  allocation_pct: number;
  action: "none" | EdgeExperimentChangeType;
  target_selector: string;
  target_component_id: string;
  payload_json: Record<string, unknown>;
  accessibility_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EdgeExperiment {
  experiment_id: string;
  name: string;
  description?: string | null;
  hypothesis?: string | null;
  status: EdgeExperimentStatus;
  property_code: string;
  community_id?: string | null;
  website_host?: string | null;
  page_type: string;
  page_path: string;
  component_id: string;
  component_contract_source: string;
  change_type: EdgeExperimentChangeType;
  primary_metric: string;
  guardrail_policy_id: string;
  traffic_split_pct: number;
  assignment_unit: "anonymous_visitor" | "session";
  rollback_owner?: string | null;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  variants: EdgeExperimentVariant[];
}

export interface EdgeExperimentComponentContract {
  component_contract_id: string;
  component_id: string;
  page_type: string;
  page_path?: string | null;
  page_path_key: string;
  selector: string;
  allowed_change_types: EdgeExperimentChangeType[];
  required_accessibility_checks: string[];
  source: string;
  source_reference?: string | null;
  status: string;
  last_verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EdgeExperimentReadiness {
  key: string;
  label: string;
  status: "pass" | "warning" | "fail" | "not_run";
  note?: string;
}

export interface EdgeExperimentProofSnapshot {
  guardrail_snapshot_id: string;
  experiment_id: string;
  snapshot_at: string;
  snapshot_date: string;
  variant_key: string;
  guardrail_status: string;
  recommended_action?: string | null;
  evidence: Record<string, unknown> | null;
  created_at: string;
}

export interface EdgeExperimentDryRunVersion {
  config_version_id: string;
  experiment_id: string;
  config_version: number;
  config_status: string;
  config: Record<string, unknown> | null;
  config_hash: string;
  signed_at?: string | null;
  activated_at?: string | null;
  deactivated_at?: string | null;
  created_by: string;
  created_at: string;
}

export interface EdgeExperimentListResponse {
  experiments: EdgeExperiment[];
  component_contracts: EdgeExperimentComponentContract[];
  summary: {
    total: number;
    draft: number;
    active: number;
    blocked: number;
    contracts: number;
  };
}

export interface EdgeExperimentDetailResponse {
  experiment: EdgeExperiment;
  component_contract: EdgeExperimentComponentContract | null;
  readiness: EdgeExperimentReadiness[];
  latest_preflight?: EdgeExperimentProofSnapshot | null;
  latest_dry_run?: EdgeExperimentDryRunVersion | null;
}

export interface PrepareSiteContentExperimentInput {
  property_code: string;
  community_id?: string;
  website_host?: string;
  site_content_page_id: string;
  site_content_mapping_id: string;
  display_name: string;
  target_label?: string;
  suggested_change_type: EdgeExperimentChangeType;
}

export interface PrepareSiteContentExperimentResponse {
  component_contract: EdgeExperimentComponentContract;
  suggested_draft: {
    name: string;
    hypothesis: string;
    page_type: string;
    page_path: string;
    component_id: string;
    change_type: EdgeExperimentChangeType;
    primary_metric: string;
    variant_text: string;
    variant_href: string;
  };
}

export interface PrepareSpecsExperimentInput {
  property_code: string;
  community_id?: string;
  website_host?: string;
  surface: string;
  spec_target: string;
  component_name: string;
  display_name: string;
  target_label: string;
  page_type: string;
  page_path: string;
  section_label: string;
  location_label: string;
  action?: string;
  suggested_change_type: EdgeExperimentChangeType;
}

export type PrepareSpecsExperimentResponse = PrepareSiteContentExperimentResponse;

export interface CreateEdgeExperimentDraftInput {
  name: string;
  description?: string;
  hypothesis: string;
  property_code: string;
  community_id?: string;
  website_host?: string;
  page_type: string;
  page_path: string;
  component_id: string;
  change_type: EdgeExperimentChangeType;
  primary_metric: string;
  guardrail_policy_id: string;
  traffic_split_pct: number;
  assignment_unit: "anonymous_visitor" | "session";
  rollback_owner?: string;
  variant: {
    variant_key: string;
    action: EdgeExperimentChangeType;
    payload: {
      text?: string;
      class_name?: string;
      href?: string;
      tag?: "a" | "button" | "span";
      position?: "before" | "after";
    };
  };
  notes?: string;
}

export async function getEdgeExperiments(): Promise<EdgeExperimentListResponse> {
  const res = await apiFetch("/v1/experiments");
  if (!res.ok) throw new Error("Failed to load Experiment Lab");
  return res.json();
}

export async function getEdgeExperiment(experimentId: string): Promise<EdgeExperimentDetailResponse> {
  const res = await apiFetch(`/v1/experiments/${experimentId}`);
  if (!res.ok) throw new Error("Failed to load experiment detail");
  return res.json();
}

export async function createEdgeExperimentDraft(input: CreateEdgeExperimentDraftInput): Promise<EdgeExperimentDetailResponse> {
  const res = await apiFetch("/v1/experiments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create experiment draft");
  }
  return res.json();
}

export async function requestEdgeExperimentPreflight(experimentId: string): Promise<EdgeExperimentDetailResponse> {
  const res = await apiFetch(`/v1/experiments/${experimentId}/preflight`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to request preflight");
  }
  return res.json();
}

export async function generateEdgeExperimentDryRun(experimentId: string): Promise<EdgeExperimentDetailResponse> {
  const res = await apiFetch(`/v1/experiments/${experimentId}/dry-run`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to generate dry run");
  }
  return res.json();
}

export async function prepareSiteContentExperimentContract(
  input: PrepareSiteContentExperimentInput
): Promise<PrepareSiteContentExperimentResponse> {
  const res = await apiFetch("/v1/experiments/component-contracts/site-content", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to prepare Site Content item");
  }
  return res.json();
}

export async function prepareSpecsExperimentContract(
  input: PrepareSpecsExperimentInput
): Promise<PrepareSpecsExperimentResponse> {
  const res = await apiFetch("/v1/experiments/component-contracts/specs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to prepare Specs item");
  }
  return res.json();
}
