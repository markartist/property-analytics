"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  GitBranch,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  NotebookPen,
  Route,
  Send,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { OPS_WATCH_SNAPSHOT } from "@/lib/ops-watch/generated-snapshot";
import type { OpsWatchTicketCarePropertyQueue } from "@/lib/ops-watch/types";
import {
  createAwarenessCommitment,
  createAwarenessSelfNote,
  getAwarenessMemoryPosture,
  getCaptainBriefRead,
  getCaptainOfficeState,
  getCaptainRuntimeInteractionStatus,
  getCommunities,
  getExpertRead,
  getExpertReadsForProperty,
  getPibDetail,
  resolveApiBase,
  requestExpertRead,
  submitCaptainRuntimeInteraction,
  type AwarenessMemoryPosture,
  type CaptainBriefRead,
  type CaptainEvidencePacketRead,
  type CaptainMemoryCandidateRead,
  type CaptainOfficeHistoryItem,
  type CaptainOfficeState,
  type CaptainRuntimeInteractionStatus,
  type Community,
  type ExpertLaneId,
  type ExpertReadRead,
  type PibDetailResponse,
} from "@/lib/api";
import { canPerformOfferingAction } from "@/lib/permissions";

type OfficeSection = "office" | "history" | "watchlist" | "memory" | "quarters" | "expert-reads";
type WorkspaceTab = "office" | "tickets" | "runtime" | "watch" | "memory" | "expert" | "lineage";
type DeskConversationReply = {
  interaction_id: string | null;
  response_id: string | null;
  submitted_at: string;
  submitted_question: string | null;
  conversational_response: string;
  research_status?: CaptainRuntimeInteractionStatus["research"];
  structured_outputs?: Record<string, unknown>;
} | null;

const DEFAULT_PROPERTY = "AR4PB";
const RUNTIME_MODES = ["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"] as const;

type FullBriefingStatus = "idle" | "loading" | "ready" | "error";

const EXPERT_LANES: Array<{ id: ExpertLaneId; label: string; purpose: string }> = [
  { id: "quartermaster", label: "Quartermaster", purpose: "source confidence, freshness, and blocking controls" },
  { id: "leasing_performance_advisor", label: "Leasing Performance Advisor", purpose: "funnel leakage and conversion action" },
  { id: "signals_officer", label: "Signals Officer", purpose: "channel quality and spend posture" },
  { id: "navigator", label: "Navigator", purpose: "website, copy, metadata, GBP, and local content" },
  { id: "revenue_advisor", label: "Revenue Advisor", purpose: "pricing, concessions, exposure, and recovery math" },
  { id: "market_scout", label: "Market Scout", purpose: "competitor rent, specials, and visible market pressure" },
  { id: "product_readiness_officer", label: "Product Readiness Officer", purpose: "available product, readiness, and blockers" },
  { id: "reputation_officer", label: "Reputation Officer", purpose: "review voice, sentiment, and complaint themes" },
  { id: "resident_experience_officer", label: "Resident Experience Officer", purpose: "resident friction, tickets, and service blockers" },
  { id: "engineer", label: "Engineer", purpose: "website technical health, PSI/CWV, and broken paths" },
  { id: "trust_and_proof_advisor", label: "Trust And Proof Advisor", purpose: "credible claims, proof gaps, and USP risk" },
  { id: "unit_type_fit_advisor", label: "Unit-Type Fit Advisor", purpose: "demand-to-available-unit fit by unit type" },
  { id: "seasonality_demand_timing_advisor", label: "Seasonality And Demand Timing Advisor", purpose: "demand timing and market timing risk" },
  { id: "market_elasticity_advisor", label: "Market Elasticity Advisor", purpose: "rent, concession, value-copy, and comp sensitivity" },
  { id: "operational_capacity_advisor", label: "Operational Capacity Advisor", purpose: "team capacity and execution feasibility" },
  { id: "peer_borrowing_advisor", label: "Peer Borrowing Advisor", purpose: "borrowable peer tactics across region and portfolio" },
];

const WORKSPACES: Array<{ id: WorkspaceTab; label: string; description: string; icon: React.ElementType }> = [
  { id: "office", label: "Desk", description: "Start with the property posture and next useful questions.", icon: ClipboardCheck },
  { id: "tickets", label: "Ticket wall", description: "Raise flags and champion property follow-through.", icon: TicketCheck },
  { id: "runtime", label: "Full briefing", description: "Submit updates and inspect the governed response.", icon: Send },
  { id: "watch", label: "Watch items", description: "Review active alerts, tickets, and follow-through.", icon: AlertTriangle },
  { id: "memory", label: "Working memory", description: "Capture context without promoting it to truth.", icon: Brain },
  { id: "expert", label: "Specialist read", description: "Request and review focused guidance.", icon: FileSearch },
  { id: "lineage", label: "Evidence trail", description: "Audit prior runs, hashes, and evidence trail.", icon: GitBranch },
];

const PROPERTY_PRESENTATION_ASSETS: Record<string, {
  propertyName: string;
  captainName: string;
  propertyHeroUrl: string;
  propertyHeroLabel: string;
  captainFamilyImageUrl: string;
  captainFamilyLabel: string;
  propertyUrl: string;
}> = {
  AR4PB: {
    propertyName: "The Pointe Bentonville",
    captainName: "Captain Benton",
    propertyHeroUrl: "/captains/ar4pb/the-pointe-bentonville-hero-2025-03.jpg",
    propertyHeroLabel: "Approved property hero image",
    captainFamilyImageUrl: "/captains/ar4pb/captain-benton-family-fictional-20260824.png",
    captainFamilyLabel: "Generated fictional family portrait for presentation only",
    propertyUrl: "https://venterraliving.com/apartments/the-pointe-bentonville/",
  },
};

function workspaceForSection(section: OfficeSection): WorkspaceTab {
  if (section === "history") return "lineage";
  if (section === "watchlist") return "watch";
  if (section === "memory" || section === "quarters") return "memory";
  if (section === "expert-reads") return "expert";
  return "office";
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
}

function shortHash(value: unknown): string {
  const text = String(value ?? "");
  return text ? `${text.slice(0, 10)}...${text.slice(-6)}` : "-";
}

function label(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/_/g, " ");
}

function numericPercent(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `${Math.round(parsed * 100)}%`;
}

function expertLaneLabel(value: ExpertLaneId | string): string {
  return EXPERT_LANES.find((lane) => lane.id === value)?.label ?? label(value);
}

function statusClasses(value: unknown): string {
  const text = String(value ?? "").toLowerCase();
  if (["pass", "verified", "canonical", "current", "internal_only"].includes(text)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["warn", "claim", "needs_verification", "stale", "unknown", "pending", "candidate"].includes(text)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["block", "blocked", "conflicting", "conflict", "escalated"].includes(text)) return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Badge({ children, value }: { children?: React.ReactNode; value?: unknown }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClasses(value ?? children)}`}>
      {children ?? label(value)}
    </span>
  );
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF6F8] text-[#0D5E6D]">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstNameFromIdentity(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

function presentationAssetsForProperty(propertyCode: string) {
  return PROPERTY_PRESENTATION_ASSETS[propertyCode.toUpperCase()] ?? null;
}

function ticketCareQueueForProperty(propertyCode: string): OpsWatchTicketCarePropertyQueue | null {
  const normalized = propertyCode.trim().toUpperCase();
  return OPS_WATCH_SNAPSHOT.ticketCare.propertyQueues.find((queue) => queue.propertyCode.toUpperCase() === normalized) ?? null;
}

function safePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 3) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectRecords(item, depth + 1));
  if (!isRecord(value)) return [];
  return [
    value,
    ...Object.values(value).flatMap((item) => (
      isRecord(item) || Array.isArray(item) ? collectRecords(item, depth + 1) : []
    )),
  ];
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(/[%,$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(records: Record<string, unknown>[], keys: string[]): number | null {
  const lowered = keys.map((key) => key.toLowerCase());
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (lowered.includes(key.toLowerCase())) {
        const parsed = numericValue(value);
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
}

function firstFieldText(records: Record<string, unknown>[], keys: string[]): string | null {
  const lowered = keys.map((key) => key.toLowerCase());
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (lowered.includes(key.toLowerCase())) {
        const text = firstString(value);
        if (text) return text;
      }
    }
  }
  return null;
}

function normalizePercent(value: number): number {
  return value > 1 ? value / 100 : value;
}

function formatWholePercent(value: number): string {
  return `${Math.round(normalizePercent(value) * 100)}%`;
}

function formatMetricNumber(value: unknown, digits = 0): string | null {
  const parsed = numericValue(value);
  if (parsed === null) return null;
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPercent(value: unknown): string | null {
  const parsed = numericValue(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function healthFromPageSpeed(mobile: unknown, desktop: unknown): string | null {
  const mobileScore = numericValue(mobile);
  const desktopScore = numericValue(desktop);
  if (mobileScore === null && desktopScore === null) return null;
  if ((mobileScore ?? 100) >= 85 && (desktopScore ?? 100) >= 85) return "Website health looks ready for traffic.";
  if ((mobileScore ?? 100) < 75) return "Website health needs a mobile experience check before heavier promotion.";
  return "Website health is usable, with a few items worth checking before a campaign push.";
}

function psiBand(score: unknown): { label: string; className: string } | null {
  const parsed = numericValue(score);
  if (parsed === null) return null;
  if (parsed >= 90) return { label: "Healthy", className: "border-emerald-300 bg-emerald-50 text-emerald-900" };
  if (parsed >= 50) return { label: "Watch", className: "border-amber-300 bg-amber-50 text-amber-900" };
  return { label: "Needs attention", className: "border-rose-300 bg-rose-50 text-rose-900" };
}

function freshnessLabel(value: unknown): string {
  const text = String(value ?? "").replace(/_/g, " ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown freshness";
}

function mailtoHref(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildPibBriefingSections(detail: PibDetailResponse): {
  headline: string;
  coverage: string[];
  opportunities: string[];
  nextMoves: string[];
  sourceLines: string[];
  emailSubject: string;
  emailBody: string;
} {
  const mobilePsi = detail.latest_psi?.mobile?.score ?? detail.site_performance?.mobile_score;
  const desktopPsi = detail.latest_psi?.desktop?.score ?? detail.site_performance?.desktop_score;
  const occupancy = formatMetricNumber(detail.marketing?.occupancy, 1);
  const atr = formatMetricNumber(detail.marketing?.atr, 1);
  const sessions = formatMetricNumber(detail.ga4?.total_sessions);
  const sessionsTrend = formatSignedPercent(detail.ga4?.sessions_trend_pct);
  const tourClicks = formatMetricNumber(detail.ga4?.tour_clicks);
  const applyClicks = formatMetricNumber(detail.ga4?.apply_clicks);
  const gscClicks = formatMetricNumber(detail.search_performance?.total_clicks);
  const gscImpressions = formatMetricNumber(detail.search_performance?.total_impressions);
  const avgPosition = formatMetricNumber(detail.search_performance?.avg_position, 1);
  const cirValue = formatMetricNumber(detail.cir?.cir_value, 1);
  const cirStatus = safeString(detail.cir?.cir_status);
  const rating = formatMetricNumber(detail.reviews?.avg_rating, 2);
  const reviews = formatMetricNumber(detail.reviews?.total_reviews);
  const websiteHealth = healthFromPageSpeed(mobilePsi, desktopPsi);
  const mobilePsiScore = numericValue(mobilePsi);
  const latestKeyword = detail.search_performance?.top_keywords?.[0]?.query;

  const coverage = [
    occupancy ? `Occupancy is ${occupancy}%${atr ? ` with ${atr}% ATR` : ""}.` : null,
    sessions ? `Website sessions are ${sessions}${sessionsTrend ? ` (${sessionsTrend} vs. the comparison period)` : ""}.` : null,
    tourClicks || applyClicks ? `Prospect intent includes ${tourClicks ?? "0"} tour clicks and ${applyClicks ?? "0"} apply clicks.` : null,
    websiteHealth,
    gscClicks || gscImpressions ? `Search visibility shows ${gscClicks ?? "0"} clicks from ${gscImpressions ?? "0"} impressions${avgPosition ? `, averaging position ${avgPosition}` : ""}.` : null,
    cirValue ? `CIR is ${cirValue}${cirStatus ? ` and marked ${cirStatus}` : ""}.` : null,
    rating || reviews ? `Reputation context is ${rating ? `${rating} stars` : "available"}${reviews ? ` across ${reviews} reviews` : ""}.` : null,
  ].filter((line): line is string => Boolean(line));

  const opportunities = [
    Number(detail.marketing?.atr) > 0 ? "Shape content around the homes that need near-term attention instead of broad generic leasing copy." : null,
    Number(detail.ga4?.sessions_trend_pct) > 0 ? "Traffic is moving up, so the property story should make the next action obvious." : null,
    mobilePsiScore !== null && mobilePsiScore < 75 ? "Keep mobile landing experience in the review path before sending more traffic to the site." : null,
    latestKeyword ? `Use current search demand as a content cue, starting with "${latestKeyword}".` : null,
  ].filter((line): line is string => Boolean(line));

  const nextMoves = [
    "Use the current property visuals and offer language only where they match the approved property site.",
    "Refresh the highest-traffic content first, then check whether tour and apply intent improves in the next snapshot.",
    "Keep recommendations review-only until a human approves any content or campaign change.",
  ];

  const sourceLines = [
    `PIB snapshot date: ${detail.week_date}.`,
    detail.ga4 ? "GA4 metrics supplied sessions, tours, applications, and traffic trend." : null,
    detail.latest_psi ? `Daily PSI supplied latest mobile/desktop scores from ${detail.latest_psi.source}.` : detail.site_performance ? "PIB site performance supplied PageSpeed/PSI context." : null,
    detail.search_performance ? "Search Console/GSC supplied search visibility and keyword context." : null,
    detail.cir ? "CIR supplied conversion-intent read." : null,
    detail.reviews ? "Reviews supplied rating and reputation context." : null,
    detail.marketing ? "Marketing data supplied occupancy and ATR." : null,
  ].filter((line): line is string => Boolean(line));

  const headline = `Here is the governed PIB read for ${detail.community.name} from ${detail.week_date}.`;
  const emailSubject = `PIB briefing for ${detail.community.name} - ${detail.week_date}`;
  const emailBody = [
    headline,
    "",
    "Current read:",
    ...coverage.slice(0, 5).map((line) => `- ${line}`),
    "",
    "Recommended next moves:",
    ...nextMoves.map((line) => `- ${line}`),
    "",
    "Review note: this is a Data Pond briefing draft. No content or campaign change has been made.",
  ].join("\n");

  return { headline, coverage, opportunities, nextMoves, sourceLines, emailSubject, emailBody };
}

function buildTodayGlanceLines(input: {
  state: CaptainOfficeState | null;
  captainBrief: CaptainBriefRead | null;
  pibDetail: PibDetailResponse | null;
  propertyRecord: Record<string, unknown>;
  communityRecord: Record<string, unknown>;
}): string[] {
  const packetEvidence = (input.state?.evidence_packets ?? []).flatMap((packet) => packet.evidence ?? []);
  const records = [
    input.propertyRecord,
    input.communityRecord,
    ...collectRecords(input.captainBrief?.diagnosticRead?.recoveryMath),
    ...collectRecords(input.captainBrief?.marketingInsight?.conversionRead?.metrics),
    ...collectRecords(input.captainBrief?.operatingSnapshot?.metrics),
    ...collectRecords(input.captainBrief?.inventory),
    ...collectRecords(input.pibDetail?.marketing),
    ...collectRecords(input.pibDetail?.ga4),
    ...collectRecords(input.pibDetail?.leasing),
    ...collectRecords(input.state?.runtime_status?.directive_snapshot),
    ...collectRecords(input.state?.history ?? []),
    ...collectRecords(packetEvidence),
    ...collectRecords(input.state?.watch_items ?? []),
    ...collectRecords(input.state?.actions ?? []),
  ];

  const lines: string[] = [];
  const occupancy = firstNumber(records, ["occupancy", "occupancy_rate", "current_occupancy", "currentOccupancy", "occupancy_pct", "occupancyPercent"]);
  if (occupancy !== null) {
    const target = firstNumber(records, ["target_occupancy", "targetOccupancy", "occupancy_target", "occupancyTarget", "target_occupancy_rate"]);
    if (target !== null) {
      const delta = normalizePercent(occupancy) - normalizePercent(target);
      const direction = Math.abs(delta) < 0.005 ? "right at" : delta > 0 ? "above" : "below";
      lines.push(`Occupancy is ${formatWholePercent(occupancy)}, ${direction} the ${formatWholePercent(target)} target.`);
    } else {
      lines.push(`Occupancy is ${formatWholePercent(occupancy)}.`);
    }
  }

  const availableUnits = firstNumber(records, ["available_units", "availableUnits", "near_term_available_units", "units_available", "available_count"]);
  if (availableUnits !== null) {
    const vacantUnits = firstNumber(records, ["vacant_available_units", "vacantAvailableUnits", "vacant_units", "vacantUnits"]);
    const roundedAvailable = Math.round(availableUnits);
    const roundedVacant = vacantUnits !== null ? Math.round(vacantUnits) : null;
    lines.push(
      roundedVacant !== null && roundedVacant > 0
        ? `Near-term availability: ${roundedAvailable} homes visible, including ${roundedVacant} vacant.`
        : `Near-term availability: ${roundedAvailable} homes to shape the message around.`
    );
  }

  const websiteStatus = firstFieldText(records, ["psi_status", "pagespeed_status", "website_health", "site_health", "cwv_status", "technical_health"]);
  const psiScore = firstNumber(records, ["psi_score", "pagespeed_score", "mobile_psi_score", "desktop_psi_score", "performance_score"]);
  if (websiteStatus) {
    const status = websiteStatus.toLowerCase();
    if (/healthy|good|pass|current|green/.test(status)) lines.push("Website health looks ready for traffic.");
    else if (/attention|watch|warn|degraded|fail|poor|blocked|red/.test(status)) lines.push("Website health may need attention before pushing traffic.");
  } else if (psiScore !== null) {
    lines.push(normalizePercent(psiScore) >= 0.9 ? "Website health looks ready for traffic." : "Website health may need attention before pushing traffic.");
  }

  return lines.slice(0, 3);
}

function captainAskFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/directive|runtime|eligible|captain_office/i.test(raw)) {
    return "The Captain is not ready to answer from this property briefing yet. Your question stayed here so you can edit it or try again after the briefing setup is ready.";
  }
  return "The Captain could not answer just now. Your question stayed here so you can edit it or try again in a moment.";
}

function toDeskConversationReply(value: CaptainOfficeHistoryItem | Record<string, unknown> | null | undefined, submittedAt?: string): DeskConversationReply {
  const valueRecord = isRecord(value) ? value : {};
  const interactionRecord = isRecord(valueRecord.interaction) ? valueRecord.interaction : valueRecord;
  const response = (value as { reasoning_response?: Record<string, unknown> } | null | undefined)?.reasoning_response;
  const directResponse = isRecord(response) ? response : valueRecord;
  const text = firstString((directResponse as Record<string, unknown> | null | undefined)?.conversational_response);
  if (!text) return null;
  const structured = (directResponse as Record<string, unknown>).structured_outputs;
  const researchStatus = isRecord(structured) && isRecord(structured.research_status)
    ? structured.research_status as CaptainRuntimeInteractionStatus["research"]
    : undefined;
  return {
    interaction_id: firstString(valueRecord.interaction_id, interactionRecord.interaction_id),
    response_id: firstString((directResponse as Record<string, unknown>).response_id),
    submitted_at: submittedAt ?? firstString((directResponse as Record<string, unknown>).timestamp, (directResponse as Record<string, unknown>).generated_at) ?? new Date().toISOString(),
    submitted_question: firstString(interactionRecord.input_text, valueRecord.input_text),
    conversational_response: text,
    research_status: researchStatus,
    structured_outputs: isRecord(structured) ? structured : undefined,
  };
}

function captainDeskNoteFromState(state: CaptainOfficeState | null): string | null {
  return firstString(state?.captain_note?.text);
}

function captainNameplateText(captainName: string | null): string {
  const normalized = firstString(captainName)?.replace(/\s+/g, " ").trim() ?? "Captain";
  const upper = normalized.toUpperCase();
  return upper.startsWith("CAPTAIN") ? upper : `CAPTAIN ${upper}`;
}

function apiAssetUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  try {
    return new URL(path, resolveApiBase()).toString();
  } catch {
    return path;
  }
}

function postureTone(state: CaptainOfficeState | null): unknown {
  if (!state) return "unknown";
  const alerts = state.alerts ?? [];
  const actions = state.actions ?? [];
  const watchItems = state.watch_items ?? [];
  if (alerts.some((alert) => String(alert.severity).toLowerCase().includes("critical"))) return "blocked";
  if (state.runtime_status?.latest_escalation_required) return "blocked";
  if (alerts.length || actions.length || watchItems.length) return "warn";
  if (state.runtime_status?.latest_publishability) return state.runtime_status.latest_publishability;
  return "unknown";
}

export function CaptainOfficeClient({ initialPropertyId, section = "office" }: { initialPropertyId?: string; section?: OfficeSection }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canView = canPerformOfferingAction(user?.role, "captainOffice", "view");
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [propertyId, setPropertyId] = React.useState(initialPropertyId ?? DEFAULT_PROPERTY);
  const [state, setState] = React.useState<CaptainOfficeState | null>(null);
  const [captainBrief, setCaptainBrief] = React.useState<CaptainBriefRead | null>(null);
  const [pibDetail, setPibDetail] = React.useState<PibDetailResponse | null>(null);
  const [fullBriefingStatus, setFullBriefingStatus] = React.useState<FullBriefingStatus>("idle");
  const [fullBriefingError, setFullBriefingError] = React.useState<string | null>(null);
  const [emailDraftOpen, setEmailDraftOpen] = React.useState(false);
  const [awarenessPosture, setAwarenessPosture] = React.useState<AwarenessMemoryPosture | null>(null);
  const [expertReads, setExpertReads] = React.useState<ExpertReadRead[]>([]);
  const [selectedExpertRead, setSelectedExpertRead] = React.useState<ExpertReadRead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expertLoading, setExpertLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [checkingReply, setCheckingReply] = React.useState(false);
  const [requestingExpert, setRequestingExpert] = React.useState(false);
  const [savingAwareness, setSavingAwareness] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inputText, setInputText] = React.useState("");
  const [captainNotice, setCaptainNotice] = React.useState<string | null>(null);
  const [deskConversationReply, setDeskConversationReply] = React.useState<DeskConversationReply>(null);
  const [selfNoteText, setSelfNoteText] = React.useState("");
  const [commitmentText, setCommitmentText] = React.useState("");
  const [showLatestReply, setShowLatestReply] = React.useState(false);
  const runtimeMode: (typeof RUNTIME_MODES)[number] = "standard";
  const [expertLane, setExpertLane] = React.useState<ExpertLaneId>("quartermaster");
  const [expertReason, setExpertReason] = React.useState("Review this property context and return governed specialist guidance.");
  const [activeWorkspace, setActiveWorkspace] = React.useState<WorkspaceTab>(() => workspaceForSection(section));

  React.useEffect(() => {
    if (initialPropertyId) setPropertyId(initialPropertyId);
  }, [initialPropertyId]);

  const loadOffice = React.useCallback((id: string) => {
    if (!canView) return;
    setLoading(true);
    setPibDetail(null);
    setFullBriefingStatus("idle");
    setFullBriefingError(null);
    setEmailDraftOpen(false);
    Promise.all([
      getCommunities(),
      getCaptainOfficeState(id),
      getExpertReadsForProperty(id),
      getCaptainBriefRead(id).catch(() => null),
    ])
      .then(([communityRows, office, expertReadRows, briefRead]) => {
        const reads = expertReadRows ?? [];
        setCommunities(communityRows);
        setState(office);
        setCaptainBrief(briefRead);
        setExpertReads(reads);
        setSelectedExpertRead((current) => {
          if (!current) return reads[0] ?? null;
          return reads.find((read) => read.expert_read_id === current.expert_read_id) ?? reads[0] ?? null;
        });
        setError(null);
        const communityId = office.property.id;
        if (communityId) {
          void getPibDetail(communityId)
            .then(setPibDetail)
            .catch(() => setPibDetail(null));
        }
        void getAwarenessMemoryPosture(id)
          .then(setAwarenessPosture)
          .catch(() => setAwarenessPosture(null));
      })
      .catch((err) => {
        setCaptainBrief(null);
        setError(err instanceof Error ? err.message : "Failed to load Captain’s Office");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [canView]);

  React.useEffect(() => {
    if (authLoading || !canView) return;
    loadOffice(propertyId);
  }, [authLoading, canView, loadOffice, propertyId]);

  React.useEffect(() => {
    setActiveWorkspace(workspaceForSection(section));
  }, [section]);

  async function submitInteraction(event: React.FormEvent) {
    event.preventDefault();
    if (!inputText.trim() || !state) return;
    setSubmitting(true);
    setCaptainNotice(null);
    setError(null);
    const submittedAt = new Date().toISOString();
    try {
      const result = await submitCaptainRuntimeInteraction({
        property_id: state.property.property_code ?? state.property.encasa_property_code ?? propertyId,
        input_text: inputText.trim(),
        runtime_mode: runtimeMode,
        actor: "user",
        input_type: "text",
        report_family: "captain",
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setDeskConversationReply(toDeskConversationReply(result, submittedAt));
      setShowLatestReply(true);
    } catch (err) {
      setCaptainNotice(captainAskFailureMessage(err));
      setShowLatestReply(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function checkCaptainReply() {
    if (!deskConversationReply?.interaction_id) return;
    setCheckingReply(true);
    setCaptainNotice(null);
    try {
      const status = await getCaptainRuntimeInteractionStatus(deskConversationReply.interaction_id);
      const nextReply = toDeskConversationReply(status.interaction, status.interaction.generated_at ?? status.interaction.timestamp);
      setDeskConversationReply((current) => {
        const base = nextReply ?? current;
        if (!base) return current;
        return {
          ...base,
          interaction_id: current?.interaction_id ?? base.interaction_id,
          submitted_question: current?.submitted_question ?? base.submitted_question,
          research_status: status.research ?? base.research_status,
          conversational_response: status.research && status.research.status !== "completed" && status.research.status !== "ready"
            ? status.research.progress_message
            : base.conversational_response,
        };
      });
      setShowLatestReply(true);
    } catch {
      setCaptainNotice("I could not check the fresh read just now. Your question stayed here, and you can check in again in a moment.");
    } finally {
      setCheckingReply(false);
    }
  }

  const selectedPropertyCode = state?.property.property_code ?? state?.property.encasa_property_code ?? propertyId;
  const ticketCareQueue = React.useMemo(() => ticketCareQueueForProperty(selectedPropertyCode), [selectedPropertyCode]);
  const latest = (state?.history ?? [])[0] ?? null;
  const alertCount = (state?.alerts ?? []).length;
  const watchCount = (state?.watch_items ?? []).length;
  const actionCount = (state?.actions ?? []).length;
  const evidenceCount = (state?.evidence_packets ?? [])[0]?.evidence?.length ?? 0;
  const memoryOpenCount = (awarenessPosture?.open_commitments ?? []).length + (awarenessPosture?.verification_needed_items ?? []).length;
  const blockedExpertCount = expertReads.filter((read) => read.read_status === "blocked" || read.publishability === "blocked").length;
  const workspaceMetrics: Record<WorkspaceTab, { value: string; tone: unknown }> = {
    office: { value: state ? "Open" : "Loading", tone: postureTone(state) },
    tickets: { value: `${ticketCareQueue?.ticketCount ?? 0}`, tone: ticketCareQueue?.posture ?? "pass" },
    runtime: { value: latest ? formatDate(latest.timestamp) : "Brief", tone: latest?.publishability ?? "unknown" },
    watch: { value: `${alertCount + watchCount + actionCount}`, tone: alertCount || actionCount ? "warn" : "pass" },
    memory: { value: `${memoryOpenCount}`, tone: memoryOpenCount ? "warn" : "pass" },
    expert: { value: `${expertReads.length}`, tone: blockedExpertCount ? "blocked" : "current" },
    lineage: { value: `${evidenceCount}`, tone: evidenceCount ? "current" : "unknown" },
  };
  const presentationAssets = presentationAssetsForProperty(selectedPropertyCode);
  const headerPropertyName = state?.property.name ?? presentationAssets?.propertyName ?? "Governed property workspace";
  const headerCaptainName = firstString(
    state?.runtime_status?.directive_snapshot?.captain_name,
    state?.runtime_status?.directive_snapshot?.agent_name,
    state?.runtime_status?.directive_snapshot?.display_name,
    presentationAssets?.captainName
  ) ?? "Captain desk";
  const userGreetingName = firstNameFromIdentity(
    firstString(user?.display_name, user?.full_name, user?.name, user?.given_name)
  );

  function selectProperty(nextPropertyId: string) {
    if (!nextPropertyId || nextPropertyId === selectedPropertyCode) return;
    setPropertyId(nextPropertyId);
    setInputText("");
    setCaptainNotice(null);
    setDeskConversationReply(null);
    setShowLatestReply(false);
    setFullBriefingStatus("idle");
    setFullBriefingError(null);
    setEmailDraftOpen(false);
    router.push(`/captains/${encodeURIComponent(nextPropertyId)}`);
  }

  async function requestFullBriefing() {
    if (!state?.property.id) {
      setFullBriefingStatus("error");
      setFullBriefingError("The property briefing cannot be loaded because the selected property is not mapped to a governed community record.");
      return;
    }
    setFullBriefingStatus("loading");
    setFullBriefingError(null);
    setEmailDraftOpen(false);
    try {
      const detail = pibDetail ?? await getPibDetail(state.property.id);
      setPibDetail(detail);
      setFullBriefingStatus("ready");
    } catch (err) {
      setFullBriefingStatus("error");
      setFullBriefingError(err instanceof Error ? err.message : "The standard PIB is not available for this property yet.");
    }
  }

  async function selectExpertRead(expertReadId: string) {
    const existing = expertReads.find((read) => read.expert_read_id === expertReadId);
    if (existing) {
      setSelectedExpertRead(existing);
      return;
    }
    setExpertLoading(true);
    try {
      setSelectedExpertRead(await getExpertRead(expertReadId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Expert Read detail");
    } finally {
      setExpertLoading(false);
    }
  }

  async function submitExpertReadRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!state) return;
    const packet = (state.evidence_packets ?? [])[0];
    if (!packet) {
      setError("Expert Reads require a governed Captain evidence packet before a lane can be requested.");
      return;
    }
    setRequestingExpert(true);
    try {
      const result = await requestExpertRead({
        property_id: selectedPropertyCode,
        lane_id: expertLane,
        evidence_packet_id: packet.evidence_packet_id,
        runtime_mode: runtimeMode,
        report_family: "captain",
        reason: expertReason,
        source_runtime_id: latest?.session_id ?? null,
        source_interaction_id: latest?.interaction_id ?? null,
        correlation_id: latest?.correlation_id ?? null,
      });
      const read = (result as { expert_read?: ExpertReadRead }).expert_read;
      await Promise.resolve(loadOffice(propertyId));
      if (read?.expert_read_id) await selectExpertRead(read.expert_read_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expert Read request was rejected by governance");
    } finally {
      setRequestingExpert(false);
    }
  }

  async function submitSelfNote(event: React.FormEvent) {
    event.preventDefault();
    if (!selfNoteText.trim()) return;
    setSavingAwareness(true);
    try {
      await createAwarenessSelfNote(selectedPropertyCode, {
        note_text: selfNoteText.trim(),
        note_type: "reminder",
        importance: 3,
        visibility: "private_to_agent",
      });
      setSelfNoteText("");
      setAwarenessPosture(await getAwarenessMemoryPosture(selectedPropertyCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Awareness Network rejected the self note");
    } finally {
      setSavingAwareness(false);
    }
  }

  async function submitCommitment(event: React.FormEvent) {
    event.preventDefault();
    if (!commitmentText.trim()) return;
    setSavingAwareness(true);
    try {
      await createAwarenessCommitment(selectedPropertyCode, {
        commitment_type: "follow_up",
        description: commitmentText.trim(),
        owed_by: "Captain",
        owed_to: "Property team",
      });
      setCommitmentText("");
      setAwarenessPosture(await getAwarenessMemoryPosture(selectedPropertyCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Awareness Network rejected the commitment");
    } finally {
      setSavingAwareness(false);
    }
  }

  if (authLoading) return null;
  if (!canView) {
    return (
      <RestrictedSurfaceCard
        title="Captain’s Office is curator-only"
        description="This governed workspace is reserved for users who can operate Captain Runtime interactions and review evidence lineage."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FB]">
      <div className="mx-auto max-w-[1180px] space-y-6 px-5 py-7 md:px-8">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
          </div>
        ) : (
          <main className="space-y-5">
            {activeWorkspace === "office" && (
              <>
                <CaptainDeskLanding
                  state={state}
                  selectedPropertyCode={selectedPropertyCode}
                  latest={latest}
                  deskConversationReply={deskConversationReply}
                  captainBrief={captainBrief}
                  pibDetail={pibDetail}
                  question={inputText}
                  setQuestion={(value) => {
                    setInputText(value);
                    setCaptainNotice(null);
                  }}
                  userGreetingName={userGreetingName}
                  submitting={submitting}
                  checkingReply={checkingReply}
                  showLatestReply={showLatestReply}
                  captainNotice={captainNotice}
                  fullBriefingStatus={fullBriefingStatus}
                  fullBriefingError={fullBriefingError}
                  emailDraftOpen={emailDraftOpen}
                  setEmailDraftOpen={setEmailDraftOpen}
                  communities={communities}
                  onSelectProperty={selectProperty}
                  onAskCaptain={submitInteraction}
                  onCheckReply={checkCaptainReply}
                  onRequestFullBriefing={requestFullBriefing}
                />
              </>
            )}

            {activeWorkspace === "runtime" && (
              <>
                <GuidedBriefingWorkspace
                  inputText={inputText}
                  setInputText={(value) => {
                    setInputText(value);
                    setCaptainNotice(null);
                  }}
                  submitting={submitting}
                  onSubmit={submitInteraction}
                  latest={latest}
                  state={state}
                  captainNotice={captainNotice}
                  onReturnToDesk={() => setActiveWorkspace("office")}
                />
              </>
            )}

            {activeWorkspace === "tickets" && (
              <>
                <WorkspaceSwitch active={activeWorkspace} onChange={setActiveWorkspace} metrics={workspaceMetrics} />
                <CaptainTicketWall
                  propertyCode={selectedPropertyCode}
                  propertyName={headerPropertyName}
                  queue={ticketCareQueue}
                  snapshotAsOf={OPS_WATCH_SNAPSHOT.asOf}
                />
              </>
            )}

            {activeWorkspace === "watch" && (
              <>
                <WorkspaceSwitch active={activeWorkspace} onChange={setActiveWorkspace} metrics={workspaceMetrics} />
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
                  <WatchItemsPanel state={state} propertyCode={selectedPropertyCode} />
                  <RoutingPanel latest={latest} actions={state?.actions ?? []} />
                </div>
              </>
            )}

            {activeWorkspace === "memory" && (
              <>
                <WorkspaceSwitch active={activeWorkspace} onChange={setActiveWorkspace} metrics={workspaceMetrics} />
                <div className="space-y-5">
                  <MemoryStewardshipPanel
                    posture={awarenessPosture}
                    selfNoteText={selfNoteText}
                    setSelfNoteText={setSelfNoteText}
                    commitmentText={commitmentText}
                    setCommitmentText={setCommitmentText}
                    saving={savingAwareness}
                    onSelfNote={submitSelfNote}
                    onCommitment={submitCommitment}
                  />
                  <MemoryCandidatePanel candidates={state?.memory_candidates ?? []} propertyCode={selectedPropertyCode} />
                </div>
              </>
            )}

            {activeWorkspace === "expert" && (
              <>
                <WorkspaceSwitch active={activeWorkspace} onChange={setActiveWorkspace} metrics={workspaceMetrics} />
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
                  <ExpertReadsWorkspace
                    propertyCode={selectedPropertyCode}
                    reads={expertReads}
                    selectedRead={selectedExpertRead}
                    loading={expertLoading}
                    onSelect={selectExpertRead}
                    lane={expertLane}
                    setLane={setExpertLane}
                    reason={expertReason}
                    setReason={setExpertReason}
                    runtimeMode={runtimeMode}
                    latestEvidencePacket={(state?.evidence_packets ?? [])[0] ?? null}
                    requesting={requestingExpert}
                    onRequest={submitExpertReadRequest}
                  />
                  <ExpertReadAuthorityPanel reads={expertReads} selectedRead={selectedExpertRead} />
                </div>
              </>
            )}

            {activeWorkspace === "lineage" && (
              <>
                <WorkspaceSwitch active={activeWorkspace} onChange={setActiveWorkspace} metrics={workspaceMetrics} />
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
                  <RuntimeHistoryPanel items={state?.history ?? []} propertyCode={selectedPropertyCode} expanded />
                  <LineageFooter state={state} />
                </div>
              </>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function WorkspaceSwitch({
  active,
  onChange,
  metrics,
}: {
  active: WorkspaceTab;
  onChange: (value: WorkspaceTab) => void;
  metrics: Record<WorkspaceTab, { value: string; tone: unknown }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white/95 p-2">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
        {WORKSPACES.map((workspace) => {
          const Icon = workspace.icon;
          const metric = metrics[workspace.id];
          const selected = active === workspace.id;
          return (
            <button
              key={workspace.id}
              type="button"
              onClick={() => onChange(workspace.id)}
              aria-pressed={selected}
              className={`min-h-[72px] rounded-md border p-3 text-left transition ${
                selected ? "border-[#15284B] bg-[#15284B] text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#3D66B9] hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${selected ? "bg-white/15 text-white" : "bg-white text-[#3B9189]"}`}>
                  <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-black">{workspace.label}</span>
                </div>
                <Badge value={metric.tone}>{metric.value}</Badge>
              </div>
              <p className={`mt-2 line-clamp-1 text-xs leading-5 ${selected ? "text-white/70" : "text-slate-500"}`}>{workspace.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CaptainDeskLanding({
  state,
  selectedPropertyCode,
  latest,
  deskConversationReply,
  captainBrief,
  pibDetail,
  question,
  setQuestion,
  userGreetingName,
  submitting,
  checkingReply,
  showLatestReply,
  captainNotice,
  fullBriefingStatus,
  fullBriefingError,
  emailDraftOpen,
  setEmailDraftOpen,
  communities,
  onSelectProperty,
  onAskCaptain,
  onCheckReply,
  onRequestFullBriefing,
}: {
  state: CaptainOfficeState | null;
  selectedPropertyCode: string;
  latest: CaptainOfficeHistoryItem | null;
  deskConversationReply: DeskConversationReply;
  captainBrief: CaptainBriefRead | null;
  pibDetail: PibDetailResponse | null;
  question: string;
  setQuestion: (value: string) => void;
  userGreetingName: string | null;
  submitting: boolean;
  checkingReply: boolean;
  showLatestReply: boolean;
  captainNotice: string | null;
  fullBriefingStatus: FullBriefingStatus;
  fullBriefingError: string | null;
  emailDraftOpen: boolean;
  setEmailDraftOpen: (value: boolean) => void;
  communities: Community[];
  onSelectProperty: (propertyId: string) => void;
  onAskCaptain: (event: React.FormEvent) => void;
  onCheckReply: () => void;
  onRequestFullBriefing: () => void;
}) {
  // Product rule: this desk is for creative content work, so keep one calm conversation path and resist dashboard creep.
  const questionInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const property = state?.property;
  const propertyRecord = (property ?? {}) as Record<string, unknown>;
  const selectedCommunity = communities.find((community) => {
    const refs = [community.encasa_property_code, community.id, community.external_key].filter(Boolean);
    return refs.includes(selectedPropertyCode);
  }) ?? null;
  const communityRecord = (selectedCommunity ?? {}) as Record<string, unknown>;
  const presentationAssets = presentationAssetsForProperty(selectedPropertyCode);
  const propertyName = property?.name ?? selectedCommunity?.name ?? presentationAssets?.propertyName ?? selectedPropertyCode;
  const propertyLocation = [property?.city ?? selectedCommunity?.city, property?.state ?? selectedCommunity?.state].filter(Boolean).join(", ");
  const propertyAddress = firstString(
    propertyRecord.physical_address,
    propertyRecord.street_address,
    propertyRecord.address_line_1,
    propertyRecord.address,
    propertyRecord.property_address,
    communityRecord.physical_address,
    communityRecord.street_address,
    communityRecord.address_line_1,
    communityRecord.address,
    communityRecord.property_address
  );
  const propertyWebsiteUrl = safePublicUrl(
    presentationAssets?.propertyUrl ?? firstString(property?.full_url, selectedCommunity?.full_url, propertyRecord.website_url, propertyRecord.property_url)
  );
  const todayGlanceLines = buildTodayGlanceLines({ state, captainBrief, pibDetail, propertyRecord, communityRecord });
  const governedPropertyImageUrl = apiAssetUrl(firstString(state?.property_visual_snapshot?.image_url));
  const fallbackPropertyImageUrl = presentationAssets?.propertyHeroUrl ?? firstString(
    propertyRecord.hero_image_url,
    propertyRecord.primary_image_url,
    propertyRecord.property_image_url,
    propertyRecord.image_url,
    propertyRecord.photo_url
  );
  const [governedPropertyImageFailed, setGovernedPropertyImageFailed] = React.useState(false);
  React.useEffect(() => {
    setGovernedPropertyImageFailed(false);
  }, [governedPropertyImageUrl]);
  const useGovernedPropertyImage = Boolean(governedPropertyImageUrl && !governedPropertyImageFailed);
  const propertyImageUrl = useGovernedPropertyImage ? governedPropertyImageUrl : fallbackPropertyImageUrl;
  const captainImageUrl = presentationAssets?.captainFamilyImageUrl ?? firstString(
    state?.runtime_status?.directive_snapshot?.captain_image_url,
    state?.runtime_status?.directive_snapshot?.family_image_url,
    state?.runtime_status?.directive_snapshot?.persona_image_url
  );
  const captainName = firstString(
    state?.runtime_status?.directive_snapshot?.captain_name,
    state?.runtime_status?.directive_snapshot?.agent_name,
    state?.runtime_status?.directive_snapshot?.display_name,
    presentationAssets?.captainName
  );
  const captainImageLabel = presentationAssets?.captainFamilyLabel ?? (captainImageUrl ? "Captain presentation image" : "Captain image unavailable");
  const approvedCaptainNote = captainDeskNoteFromState(state);
  const runLine = latest
    ? `A previous briefing is available from ${formatDate(latest.timestamp)}.`
    : "Full briefing is ready to request.";
  const latestServerReply = toDeskConversationReply(latest);
  const latestReplyTime = Date.parse(firstString(latest?.timestamp, latest?.generated_at) ?? "");
  const localReplyTime = deskConversationReply ? Date.parse(deskConversationReply.submitted_at) : Number.NaN;
  const displayedReply = latestServerReply && (!deskConversationReply || (Number.isFinite(latestReplyTime) && Number.isFinite(localReplyTime) && latestReplyTime >= localReplyTime))
    ? latestServerReply
    : deskConversationReply;
  const captainInitials = propertyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || selectedPropertyCode.slice(0, 2).toUpperCase();
  const deskNameplate = captainNameplateText(captainName);

  const greeting = userGreetingName ? `Hi, ${userGreetingName}. What can I help you with?` : "Hi. What can I help you with?";
  const suggestions = [
    "What should we promote right now?",
    "What content should we refresh?",
    "Are our images telling the right story?",
    "What changed that should shape our message?",
  ];
  const welcomeNote = userGreetingName
    ? `Good morning, ${userGreetingName}. I’m ready to help with this property today.`
    : "Good morning. I’m ready to help with this property today.";
  const captainNoteText = approvedCaptainNote
    ? `${userGreetingName ? `Good morning, ${userGreetingName}.` : "Good morning."} ${approvedCaptainNote}`
    : welcomeNote;
  const propertyOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options = communities
      .map((community) => {
        const value = community.encasa_property_code ?? community.id;
        if (!value || seen.has(value)) return null;
        seen.add(value);
        return {
          value,
          label: community.name ?? value,
          meta: [community.city, community.state].filter(Boolean).join(", "),
        };
      })
      .filter((item): item is { value: string; label: string; meta: string } => Boolean(item));

    if (!seen.has(selectedPropertyCode)) {
      options.unshift({ value: selectedPropertyCode, label: propertyName, meta: propertyLocation });
    }

    return options;
  }, [communities, propertyLocation, propertyName, selectedPropertyCode]);

  function useSuggestion(suggestion: string) {
    setQuestion(suggestion);
    window.requestAnimationFrame(() => questionInputRef.current?.focus());
  }

  return (
    <section className="w-full overflow-hidden rounded-xl border-2 border-[#A9BCC0] bg-[#E7EFED] shadow-sm">
      <div className="min-h-[540px] bg-[linear-gradient(180deg,#F6F2EA_0%,#F6F2EA_52%,#C9A876_52%,#B68E58_100%)] p-5 md:p-7">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0D5E6D]">Captain’s Office</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[#15284B]">{captainName ?? "Captain"}’s Desk</h1>
              <p className="mt-1 text-base font-black text-slate-900">{propertyName}</p>
              <div className="mt-1 space-y-1 text-sm font-semibold text-slate-600">
                <p>{selectedPropertyCode}{propertyLocation ? ` · ${propertyLocation}` : ""}</p>
                {propertyAddress && <p>{propertyAddress}</p>}
                {propertyWebsiteUrl && (
                  <a
                    href={propertyWebsiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-[#0D5E6D] underline decoration-[#0D5E6D]/30 underline-offset-4 hover:text-[#15284B]"
                  >
                    Visit property website
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 md:w-72 md:items-end">
              <label className="block w-full md:w-64">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#294782]">Switch property</span>
                <select
                  value={selectedPropertyCode}
                  onChange={(event) => onSelectProperty(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border-2 border-[#D6D6D2] bg-white px-2 text-xs font-bold text-[#15284B] shadow-sm outline-none focus:border-[#3B9189] focus:ring-4 focus:ring-[#3B9189]/20"
                  aria-label="Choose property for this Captain’s Desk"
                >
                  {propertyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.meta ? `${option.label} - ${option.meta}` : option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="max-w-xs text-sm font-semibold leading-6 text-[#294782] md:text-right">
                A quiet place to talk through the content work you want to do for this property.
              </p>
            </div>
          </div>

          <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,390px)_150px_minmax(220px,1fr)]">
            <div className="rounded-md border-[8px] border-white bg-white shadow-sm">
              <div className="h-44 overflow-hidden rounded-sm bg-[#E8EEF0] md:h-48">
                {propertyImageUrl ? (
                  <img
                    src={propertyImageUrl}
                    alt={
                      useGovernedPropertyImage
                        ? `${propertyName} current public website view`
                        : `${propertyName} property photo`
                    }
                    onError={() => {
                      if (useGovernedPropertyImage && fallbackPropertyImageUrl) {
                        setGovernedPropertyImageFailed(true);
                      }
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-full w-full bg-[linear-gradient(135deg,#E9EFEE_0%,#F7F2E8_54%,#E0D6C5_100%)]"
                    aria-label={`${propertyName} office wall`}
                  />
                )}
              </div>
            </div>
            <div className="w-40 space-y-3">
              <div className="rounded-md border-[10px] border-white bg-white shadow-sm">
                <div
                  className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm bg-[#EEF6F8] text-2xl font-black text-[#15284B]"
                  aria-label={captainImageUrl ? captainImageLabel : undefined}
                >
                  {captainImageUrl ? (
                    <img
                      src={captainImageUrl}
                      alt={captainImageLabel}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    captainInitials
                  )}
                </div>
              </div>
              <div
                className="mx-auto max-w-[145px] -rotate-[1deg] rounded-[4px] border border-[#294782] bg-[linear-gradient(180deg,#BD4830_0%,#15284B_100%)] p-1 shadow-[0_7px_16px_rgba(21,40,75,0.24)]"
                role="img"
                aria-label={`${deskNameplate} desk nameplate`}
              >
                <div className="rounded-[3px] border border-[#15284B] bg-[linear-gradient(180deg,#F6F6F5_0%,#D6D6D2_100%)] px-2 py-1 text-center">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#15284B]">{deskNameplate}</p>
                </div>
              </div>
              <div className="rotate-[-1deg] rounded-sm border border-[#D5BF78] bg-[#FFF4C9] p-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7A5A17]">Captain’s note</p>
                <p className="mt-1 line-clamp-4 text-xs font-semibold leading-5 text-[#4A3A12]">
                  {captainNoteText}
                </p>
              </div>
            </div>
            <div className="hidden min-h-40 rounded-md border border-[#E0D6C5] bg-white/45 p-4 md:block">
              {todayGlanceLines.length > 0 || pibDetail?.latest_psi ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7A5A17]">Today at a glance</p>
                  <div className="space-y-2">
                    {todayGlanceLines.map((line) => (
                      <p key={line} className="text-sm font-semibold leading-6 text-slate-700">{line}</p>
                    ))}
                  </div>
                  <PageSpeedAtGlance latestPsi={pibDetail?.latest_psi ?? null} />
                </div>
              ) : (
                <p className="text-sm font-semibold leading-6 text-slate-700">
                  Start with the work you want to do. The Captain answers from the property context already assembled for this desk.
                </p>
              )}
            </div>
          </div>

          <section className="mt-5 max-w-none rounded-lg border-2 border-[#8F7146] bg-[#FFFDF7] p-4 shadow-[0_18px_45px_rgba(72,52,30,0.18)]">
            <div className="flex items-start gap-3">
              <NotebookPen className="mt-1 h-7 w-7 shrink-0 text-[#0D5E6D]" />
              <div>
                <h2 className="text-xl font-black text-slate-950 md:text-2xl">{greeting}</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{runLine}</p>
              </div>
            </div>
            <form onSubmit={onAskCaptain} className="mt-3 space-y-3">
              <label className="sr-only" htmlFor="captain-office-question">Question or request</label>
              <textarea
                ref={questionInputRef}
                id="captain-office-question"
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                }}
                rows={3}
                placeholder="Type your question or request."
                className="w-full resize-none rounded-md border-2 border-[#78643A] bg-white p-4 text-sm leading-6 text-slate-950 outline-none focus:border-[#0D5E6D] focus:ring-4 focus:ring-[#0D5E6D]/20"
              />
              <div className="flex flex-wrap gap-2" aria-label="Question suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => useSuggestion(suggestion)}
                    className="rounded-full border border-[#C9B989] bg-[#FFF8E7] px-3 py-1.5 text-xs font-bold text-[#5E4A20] transition hover:border-[#8F7146] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5E6D]/25"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={submitting || !question.trim()}
                  className="inline-flex h-12 items-center justify-center rounded-md bg-[#15284B] px-6 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Ask Captain
                </button>
                <button
                  type="button"
                  onClick={onRequestFullBriefing}
                  disabled={fullBriefingStatus === "loading"}
                  className="inline-flex h-12 items-center justify-center rounded-md border-2 border-[#15284B] bg-white px-5 text-sm font-black text-[#15284B] shadow-sm"
                >
                  {fullBriefingStatus === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Request full briefing
                </button>
              </div>
            </form>
            {fullBriefingStatus === "error" && (
              <p className="mt-4 rounded-md border border-[#D7C58E] bg-[#FFF7DF] p-3 text-sm font-semibold leading-6 text-[#5E4A20]" role="status">
                {fullBriefingError ?? "The standard PIB is not available for this property yet."}
              </p>
            )}
            {captainNotice && (
              <p className="mt-4 rounded-md border border-[#D7C58E] bg-[#FFF7DF] p-3 text-sm font-semibold leading-6 text-[#5E4A20]" role="status">
                {captainNotice}
              </p>
            )}
            {showLatestReply && displayedReply?.conversational_response && (
              <CaptainReplyCard reply={displayedReply} checking={checkingReply} onCheckIn={onCheckReply} />
            )}
          </section>
          {fullBriefingStatus === "ready" && pibDetail && (
            <FullPibBriefing detail={pibDetail} emailDraftOpen={emailDraftOpen} setEmailDraftOpen={setEmailDraftOpen} />
          )}
        </div>
      </div>
    </section>
  );
}

function CaptainReplyCard({ reply, checking, onCheckIn }: {
  reply: NonNullable<DeskConversationReply>;
  checking: boolean;
  onCheckIn: () => void;
}) {
  const research = reply.research_status ?? null;
  const isFinished = research?.status === "completed";
  const isHeldUp = research?.status === "timeout";
  const showProgress = Boolean(research && !isFinished);
  const stages = research?.stages?.length ? research.stages : defaultResearchStages(research?.status ?? "pending");
  const elapsed = research?.elapsed_seconds ?? secondsSince(reply.submitted_at);
  return (
    <div className="mt-5 rounded-md border-2 border-[#C2D0D4] bg-white p-4">
      {reply.submitted_question && (
        <p className="mb-3 rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-sm font-semibold leading-6 text-[#15284B]">
          You asked: {reply.submitted_question}
        </p>
      )}
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0D5E6D]">Captain reply</p>
      <p className="mt-2 text-base font-semibold leading-7 text-slate-900">{reply.conversational_response}</p>
      {isFinished && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#7DCAC2] bg-[#E7F7F5] px-3 py-1.5 text-xs font-black text-[#15284B]">
          <CheckCircle2 className="h-4 w-4 text-[#3B9189]" />
          Fresh read completed
        </p>
      )}
      {showProgress && (
        <div className="mt-4 rounded-md border border-[#D6D6D2] bg-[#FFFDF7] p-3" role="status" aria-live="polite">
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => (
              <span
                key={stage.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${researchStageClass(stage.state)}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                {stage.label}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold leading-5 text-slate-700">
              Elapsed {formatElapsedDuration(elapsed)}. {isHeldUp ? "I kept your question here so you can check again or try a fresh request." : "I’ll keep this open while I finish the read."}
            </p>
            <button
              type="button"
              onClick={onCheckIn}
              disabled={checking || !reply.interaction_id}
              className="inline-flex h-9 items-center justify-center rounded-md border-2 border-[#15284B] bg-white px-3 text-xs font-black text-[#15284B] shadow-sm disabled:cursor-not-allowed disabled:border-[#D6D6D2] disabled:text-slate-400"
            >
              {checking && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Check in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultResearchStages(status: string): Array<{ label: string; state: string }> {
  const labels = [
    "Request received",
    "Gathering the current property picture",
    "Checking the website and search picture",
    "Putting the recommendation together",
    "Ready",
  ];
  const activeIndex = status === "ready" || status === "completed" ? 4 : status === "timeout" ? 2 : 1;
  return labels.map((label, index) => ({
    label,
    state: status === "timeout" && index === activeIndex ? "held_up" : index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
  }));
}

function researchStageClass(state: string): string {
  if (state === "complete") return "border-[#7DCAC2] bg-[#E7F7F5] text-[#15284B]";
  if (state === "active") return "border-[#3B9189] bg-[#E9F4F3] text-[#0D5E6D]";
  if (state === "held_up") return "border-[#BD4830] bg-[#FCEEEA] text-[#7A2B1C]";
  return "border-[#D6D6D2] bg-white text-slate-500";
}

function secondsSince(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.round((Date.now() - timestamp) / 1000)) : 0;
}

function formatElapsedDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
}

function PageSpeedAtGlance({ latestPsi }: { latestPsi: PibDetailResponse["latest_psi"] }) {
  const items = [
    { label: "Mobile", data: latestPsi?.mobile },
    { label: "Desktop", data: latestPsi?.desktop },
  ].filter((item) => item.data?.score != null);
  if (!items.length) return null;
  return (
    <div className="pt-1">
      <div className="flex flex-wrap gap-2" aria-label="Latest PageSpeed Insights scores">
        {items.map((item) => {
          const band = psiBand(item.data?.score);
          if (!band) return null;
          return (
            <span key={item.label} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black ${band.className}`}>
              <span>{item.label}</span>
              <span aria-label={`${item.label} PageSpeed score ${item.data?.score}, ${band.label}`}>{Math.round(Number(item.data?.score))}</span>
              <span className="font-bold">{band.label}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-600">
        Latest PSI {latestPsi?.latest_metric_date ? formatDate(latestPsi.latest_metric_date) : ""} · {freshnessLabel(latestPsi?.freshness)}
      </p>
    </div>
  );
}

function FullPibBriefing({
  detail,
  emailDraftOpen,
  setEmailDraftOpen,
}: {
  detail: PibDetailResponse;
  emailDraftOpen: boolean;
  setEmailDraftOpen: (value: boolean) => void;
}) {
  const briefing = buildPibBriefingSections(detail);
  const emailHref = mailtoHref(briefing.emailSubject, briefing.emailBody);
  const mobilePsi = detail.latest_psi?.mobile?.score ?? detail.site_performance?.mobile_score;
  const desktopPsi = detail.latest_psi?.desktop?.score ?? detail.site_performance?.desktop_score;
  const reportKpis = compactPibMetrics([
    { label: "Occupancy", value: percentMetric(detail.marketing?.occupancy) },
    { label: "ATR", value: percentMetric(detail.marketing?.atr) },
    { label: "Sessions", value: formatMetricNumber(detail.ga4?.total_sessions) },
    { label: "CIR", value: percentMetric(detail.cir?.cir_value) },
    { label: "Mobile PSI", value: formatMetricNumber(mobilePsi) },
    { label: "Desktop PSI", value: formatMetricNumber(desktopPsi) },
    { label: "Search clicks", value: formatMetricNumber(detail.search_performance?.total_clicks) },
    { label: "Rating", value: formatMetricNumber(detail.reviews?.avg_rating, 2) },
  ]);
  const trafficMetrics = compactPibMetrics([
    { label: "Sessions", value: formatMetricNumber(detail.ga4?.total_sessions) },
    { label: "Users", value: formatMetricNumber(detail.ga4?.total_users) },
    { label: "New users", value: formatMetricNumber(detail.ga4?.new_users) },
    { label: "Organic sessions", value: formatMetricNumber(detail.ga4?.organic_sessions) },
    { label: "Paid sessions", value: formatMetricNumber(detail.ga4?.paid_sessions) },
    { label: "Session trend", value: formatSignedPercent(detail.ga4?.sessions_trend_pct) },
  ]);
  const conversionMetrics = compactPibMetrics([
    { label: "Tour clicks", value: formatMetricNumber(detail.ga4?.tour_clicks) },
    { label: "Apply clicks", value: formatMetricNumber(detail.ga4?.apply_clicks) },
    { label: "Phone calls", value: formatMetricNumber(detail.ga4?.phone_calls ?? detail.ga4?.ga4_phone_calls) },
    { label: "Form submits", value: formatMetricNumber(detail.ga4?.form_submits) },
    { label: "Intent events", value: formatMetricNumber(detail.cir?.intent_events) },
    { label: "CIR status", value: safeString(detail.cir?.cir_status) },
  ]);
  const siteMetrics = compactPibMetrics([
    { label: "Mobile PSI", value: formatMetricNumber(mobilePsi) },
    { label: "Desktop PSI", value: formatMetricNumber(desktopPsi) },
    { label: "Mobile LCP", value: millisecondsMetric(detail.site_performance?.mobile_lcp) },
    { label: "Mobile CLS", value: formatMetricNumber(detail.site_performance?.mobile_cls, 3) },
    { label: "Desktop LCP", value: millisecondsMetric(detail.site_performance?.desktop_lcp) },
    { label: "Desktop CLS", value: formatMetricNumber(detail.site_performance?.desktop_cls, 3) },
  ]);
  const searchMetrics = compactPibMetrics([
    { label: "Clicks", value: formatMetricNumber(detail.search_performance?.total_clicks) },
    { label: "Impressions", value: formatMetricNumber(detail.search_performance?.total_impressions) },
    { label: "Average CTR", value: percentMetric(detail.search_performance?.avg_ctr) },
    { label: "Average position", value: formatMetricNumber(detail.search_performance?.avg_position, 1) },
  ]);
  const localMetrics = compactPibMetrics([
    { label: "Profile views", value: formatMetricNumber(detail.local_presence?.total_profile_views) },
    { label: "Website clicks", value: formatMetricNumber(detail.local_presence?.website_clicks) },
    { label: "Calls", value: formatMetricNumber(detail.local_presence?.phone_calls) },
    { label: "Directions", value: formatMetricNumber(detail.local_presence?.direction_requests) },
    { label: "Action rate", value: percentMetric(detail.local_presence?.action_rate) },
    { label: "Review count", value: formatMetricNumber(detail.reviews?.total_reviews) },
    { label: "Average rating", value: formatMetricNumber(detail.reviews?.avg_rating, 2) },
    { label: "Sentiment", value: formatMetricNumber(detail.reviews?.sentiment_score, 1) },
  ]);
  const marketingMetrics = compactPibMetrics([
    { label: "Google PPC", value: currencyMetric(detail.marketing?.google_ppc) },
    { label: "Remarketing", value: currencyMetric(detail.marketing?.google_remarketing) },
    { label: "GC per door", value: formatMetricNumber(detail.marketing?.gc_per_door, 2) },
    { label: "SERP traffic", value: formatMetricNumber(detail.marketing?.serp_traffic) },
  ]);
  const leasingMetrics = compactPibMetrics([
    { label: "T7 guest cards", value: formatMetricNumber(detail.leasing.t7?.g_cards ?? detail.leasing.t7?.guest_cards) },
    { label: "T7 tours", value: formatMetricNumber(detail.leasing.t7?.tours ?? detail.leasing.t7?.visits) },
    { label: "T7 applications", value: formatMetricNumber(detail.leasing.t7?.applications) },
    { label: "T7 leases", value: formatMetricNumber(detail.leasing.t7?.leases) },
    { label: "T30 guest cards", value: formatMetricNumber(detail.leasing.t30?.g_cards ?? detail.leasing.t30?.guest_cards) },
    { label: "T30 leases", value: formatMetricNumber(detail.leasing.t30?.leases) },
  ]);
  return (
    <section className="mt-5 rounded-lg border-2 border-[#8BA4A7] bg-[#FFFDF7] p-5 shadow-sm md:p-6">
      <div className="border-b-2 border-[#D7C58E] pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0D5E6D]">Property intelligence brief</p>
        <h2 className="mt-2 text-3xl font-black leading-tight text-[#15284B]">{detail.community.name}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          {detail.community.city && detail.community.state ? `${detail.community.city}, ${detail.community.state} · ` : ""}Snapshot {detail.week_date}
        </p>
        {detail.community.full_url && (
          <a href={detail.community.full_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-black text-[#0D5E6D] underline underline-offset-4">
            Open property website
          </a>
        )}
      </div>

      <FullPibSection title="Executive KPI overview" items={reportKpis} />
      <div className="mt-6 space-y-5">
        <BriefingSection title="Current read" items={briefing.coverage} />
        <BriefingSection title="Content opportunities" items={briefing.opportunities.length ? briefing.opportunities : ["No extra opportunity pattern is strong enough to call out beyond the current read."]} />
        <BriefingSection title="Recommended next moves" items={briefing.nextMoves} />
      </div>
      <FullPibSection title="Site evaluation" items={siteMetrics} emptyText="No current site performance metrics are available in this PIB snapshot." />
      <FullPibSection title="Traffic and engagement" items={trafficMetrics} emptyText="No current traffic metrics are available in this PIB snapshot." />
      <FullPibSection title="Conversion intent" items={conversionMetrics} emptyText="No current conversion metrics are available in this PIB snapshot." />
      <FullPibSection title="Search performance" items={searchMetrics} emptyText="No current search metrics are available in this PIB snapshot." />
      {detail.search_performance?.top_keywords?.length ? (
        <section className="mt-6">
          <h3 className="text-lg font-black text-[#15284B]">Current search queries</h3>
          <div className="mt-3 overflow-x-auto rounded-md border border-[#D7E0E2] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#EDF5F4] text-xs font-black uppercase tracking-wide text-[#15284B]">
                <tr><th className="px-3 py-2">Query</th><th className="px-3 py-2">Clicks</th><th className="px-3 py-2">Impressions</th><th className="px-3 py-2">CTR</th><th className="px-3 py-2">Position</th></tr>
              </thead>
              <tbody>
                {detail.search_performance.top_keywords.slice(0, 10).map((keyword) => (
                  <tr key={keyword.query} className="border-t border-[#E4ECEE] text-slate-700">
                    <td className="px-3 py-2 font-semibold">{keyword.query}</td><td className="px-3 py-2">{formatMetricNumber(keyword.clicks) ?? "—"}</td><td className="px-3 py-2">{formatMetricNumber(keyword.impressions) ?? "—"}</td><td className="px-3 py-2">{percentMetric(keyword.ctr) ?? "—"}</td><td className="px-3 py-2">{formatMetricNumber(keyword.position, 1) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <FullPibSection title="Marketing and paid media" items={marketingMetrics} emptyText="No current paid-media metrics are available in this PIB snapshot." />
      <FullPibSection title="Guest cards and leasing" items={leasingMetrics} emptyText="No current leasing metrics are available in this PIB snapshot." />
      <FullPibSection title="Local presence and reputation" items={localMetrics} emptyText="No current local-presence or reputation metrics are available in this PIB snapshot." />
      {Object.keys(detail.reviews?.themes ?? {}).length ? (
        <section className="mt-6 rounded-md border border-[#D7E0E2] bg-white p-4">
          <h3 className="text-base font-black text-[#15284B]">Review themes</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(detail.reviews?.themes ?? {}).map(([theme, count]) => <span key={theme} className="rounded-full border border-[#B4C4CB] bg-[#F7FBFB] px-3 py-1 text-sm font-semibold text-slate-700">{theme}: {count}</span>)}
          </div>
        </section>
      ) : null}
      <details className="mt-5 rounded-md border border-[#B4C4CB] bg-white p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-950">Source coverage and freshness</summary>
        <div className="mt-3 space-y-2">
          {briefing.sourceLines.map((line) => (
            <p key={line} className="text-sm font-semibold leading-6 text-slate-700">{line}</p>
          ))}
          {detail.latest_psi && (
            <p className="text-sm font-semibold leading-6 text-slate-700">
              Latest PSI lineage: {detail.latest_psi.mobile?.mirror_batch_id ?? detail.latest_psi.desktop?.mirror_batch_id ?? "batch not provided"} · {detail.latest_psi.mobile?.source_row_hash ?? detail.latest_psi.desktop?.source_row_hash ?? "row hash not provided"}
            </p>
          )}
        </div>
      </details>
      <div className="mt-5 rounded-md border border-[#D7C58E] bg-[#FFF8E7] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#15284B]">Email briefing</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Review the draft first. Nothing is sent from Data Pond by this action.</p>
          </div>
          <button
            type="button"
            onClick={() => setEmailDraftOpen(!emailDraftOpen)}
            className="inline-flex h-11 items-center justify-center rounded-md border-2 border-[#15284B] bg-white px-4 text-sm font-black text-[#15284B]"
          >
            <Mail className="mr-2 h-4 w-4" />
            Review email draft
          </button>
        </div>
        {emailDraftOpen && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-black text-slate-900" htmlFor="captain-pib-email-subject">Subject</label>
            <input
              id="captain-pib-email-subject"
              value={briefing.emailSubject}
              readOnly
              className="w-full rounded-md border-2 border-[#A9BCC0] bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            />
            <label className="block text-sm font-black text-slate-900" htmlFor="captain-pib-email-body">Draft body</label>
            <textarea
              id="captain-pib-email-body"
              value={briefing.emailBody}
              readOnly
              rows={8}
              className="w-full resize-none rounded-md border-2 border-[#A9BCC0] bg-white p-3 text-sm font-semibold leading-6 text-slate-900"
            />
            <a
              href={emailHref}
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#15284B] px-4 text-sm font-black text-white"
            >
              Open in email app
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

type PibMetric = { label: string; value: string | null };

function compactPibMetrics(items: PibMetric[]): Array<{ label: string; value: string }> {
  return items.flatMap((item) => item.value ? [{ label: item.label, value: item.value }] : []);
}

function percentMetric(value: unknown): string | null {
  const numeric = numericValue(value);
  if (numeric === null) return null;
  return `${Math.round((numeric <= 1 ? numeric * 100 : numeric) * 10) / 10}%`;
}

function millisecondsMetric(value: unknown): string | null {
  const numeric = numericValue(value);
  return numeric === null ? null : `${Math.round(numeric).toLocaleString()} ms`;
}

function currencyMetric(value: unknown): string | null {
  const numeric = numericValue(value);
  return numeric === null ? null : numeric.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function FullPibSection({ title, items, emptyText }: { title: string; items: Array<{ label: string; value: string }>; emptyText?: string }) {
  return (
    <section className="mt-6">
      <h3 className="text-lg font-black text-[#15284B]">{title}</h3>
      {items.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-md border border-[#D7E0E2] bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-xl font-black text-[#15284B]">{item.value}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{emptyText ?? "No current data is available in this PIB snapshot."}</p>}
    </section>
  );
}

function BriefingSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
        ))}
      </div>
    </section>
  );
}

function GuidedBriefingWorkspace({
  inputText,
  setInputText,
  submitting,
  onSubmit,
  latest,
  state,
  captainNotice,
  onReturnToDesk,
}: {
  inputText: string;
  setInputText: (value: string) => void;
  submitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  latest: CaptainOfficeHistoryItem | null;
  state: CaptainOfficeState | null;
  captainNotice: string | null;
  onReturnToDesk: () => void;
}) {
  const packet = (state?.evidence_packets ?? [])[0];
  const evidence = packet?.evidence ?? [];
  const outputs = latest?.structured_outputs ?? {};
  return (
    <section className="mx-auto max-w-3xl rounded-xl border-2 border-[#8BA4A7] bg-white p-5 shadow-sm md:p-6">
      <button
        type="button"
        onClick={onReturnToDesk}
        className="inline-flex h-10 items-center justify-center rounded-md border-2 border-[#15284B] bg-white px-4 text-sm font-black text-[#15284B]"
      >
        Back to desk
      </button>

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#3B9189]">Full briefing</p>
        <h2 className="mt-2 text-3xl font-black leading-tight text-[#15284B]">Ask for the briefing you need</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
          Tell the Captain what you are trying to understand or decide. Add any context in the same box if it helps.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block text-sm font-black text-slate-950" htmlFor="captain-briefing-question">
          What do you need help with?
        </label>
        <textarea
          id="captain-briefing-question"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          rows={6}
          placeholder="Type the question, decision, or briefing request."
          className="w-full resize-none rounded-md border-2 border-[#52626F] bg-white p-4 text-sm leading-6 text-slate-950 outline-none focus:border-[#0D5E6D] focus:ring-4 focus:ring-[#0D5E6D]/20"
        />
        <button
          type="submit"
          disabled={submitting || !inputText.trim()}
          className="inline-flex h-12 items-center justify-center rounded-md bg-[#15284B] px-6 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Ask Captain
        </button>
      </form>

      {captainNotice && (
        <p className="mt-5 rounded-md border border-[#D7C58E] bg-[#FFF7DF] p-3 text-sm font-semibold leading-6 text-[#5E4A20]" role="status">
          {captainNotice}
        </p>
      )}

      {latest?.conversational_response && (
        <div className="mt-6 rounded-lg border-2 border-[#C2D0D4] bg-[#F4FAFB] p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0D5E6D]">Captain answer</p>
          <p className="mt-2 text-base font-semibold leading-7 text-slate-900">{latest.conversational_response}</p>
          {latest.reasoning_summary && (
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{latest.reasoning_summary}</p>
          )}
          <details className="mt-5 rounded-md border-2 border-[#B4C4CB] bg-white p-4">
            <summary className="cursor-pointer text-sm font-black text-slate-950">See sources and details</summary>
            <div className="mt-4 space-y-4">
              <StructuredList title="Suggested follow-ups" items={arrayOfText(outputs.required_followups)} empty="No follow-ups were returned with this answer." />
              <StructuredList title="Open questions" items={arrayOfText(outputs.unresolved_conflicts)} empty="No open questions were returned with this answer." />
              {evidence.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Sources used</p>
                  {evidence.slice(0, 5).map((item, index) => (
                    <div key={`${String(item.evidence_id)}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-900">{label(item.evidence_class)}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{label(item.summary)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function CaptainTicketWall({
  propertyCode,
  propertyName,
  queue,
  snapshotAsOf,
}: {
  propertyCode: string;
  propertyName: string;
  queue: OpsWatchTicketCarePropertyQueue | null;
  snapshotAsOf: string;
}) {
  const records = queue?.records ?? [];
  const patternHits = OPS_WATCH_SNAPSHOT.ticketCare.patterns.filter((pattern) => (
    records.some((record) => record.ticketCare?.flags.includes(pattern.patternKey))
  ));

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TicketCheck className="h-5 w-5 text-[#3B9189]" />
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">Captain ticket wall</p>
            <Badge value={queue?.posture ?? "pass"}>{queue?.topFlag?.replace(/_/g, " ") ?? "Clear"}</Badge>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{propertyName}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
            Latest Ops Watch packet: {formatDate(snapshotAsOf)}. Jira remains approval-gated; this wall is for triage, proof, and follow-through.
          </p>
        </div>
        <div className="grid min-w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[430px]">
          <MiniRead label="Tickets" value={queue?.ticketCount ?? 0} tone={queue?.ticketCount ? queue.posture : "pass"} />
          <MiniRead label="Pending Vendor" value={queue?.pendingVendorCount ?? 0} tone={queue?.pendingVendorCount ? "warn" : "pass"} />
          <MiniRead label="Stale" value={queue?.staleCount ?? 0} tone={queue?.staleCount ? "blocked" : "pass"} />
          <MiniRead label="Proof" value={queue?.proofNeededCount ?? 0} tone={queue?.proofNeededCount ? "warn" : "pass"} />
        </div>
      </div>

      <div className="space-y-5 p-5">
        {records.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-black text-emerald-900">No current Jira tickets are mapped to this Captain.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
              If a property concern exists, it needs to enter the governed Ops Watch harvest or Captain Runtime watch path before it appears here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
              <div className="rounded-lg border border-[#B7DFE6] bg-[#EFFAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0D5E6D]">Captain read</p>
                <p className="mt-2 text-lg font-black leading-7 text-slate-950">{queue?.nextBestAction}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {records.flatMap((record) => record.ticketCare?.flagLabels ?? []).filter((value, index, all) => all.indexOf(value) === index).slice(0, 8).map((flag) => (
                    <Badge key={flag} value={flag}>{flag}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Action discipline</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                  For visual proof tickets, reply with the image only, then close with the completion message in the transition comment. Any Jira post, transition, or close still needs current approval.
                </p>
              </div>
            </div>

            {patternHits.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                {patternHits.slice(0, 4).map((pattern) => (
                  <div key={pattern.patternKey} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-slate-950">{pattern.title}</p>
                      <Badge value="current">{pattern.recordCount} record{pattern.recordCount === 1 ? "" : "s"}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{pattern.recommendedAction}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              {records.map((record) => (
                <TicketCareCard key={`${record.propertyCode}-${record.itemKey}`} record={record} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function TicketCareCard({ record }: { record: OpsWatchTicketCarePropertyQueue["records"][number] }) {
  const care = record.ticketCare;
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={record.priority || record.severity}>{record.priority || record.severity || "Priority"}</Badge>
            <Badge value={record.status}>{record.status || "Status"}</Badge>
            {record.staleDays !== null && <span className="text-xs font-bold text-slate-500">{record.staleDays}d stale</span>}
          </div>
          <h3 className="mt-3 text-base font-black leading-6 text-slate-950">{record.itemKey}: {record.title || record.category || "Jira ticket"}</h3>
        </div>
        {record.itemUrl && (
          <a
            href={record.itemUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-[#3D66B9] bg-white px-3 text-xs font-black text-[#294782] hover:bg-[#F6F6F5]"
          >
            Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Captain action</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{care?.recommendedAction ?? record.nextMove}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Blocker owner</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{care?.blockerOwner ?? record.ownerRole}</p>
        </div>
      </div>

      <details className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-900">Evidence and flags</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(care?.flagLabels ?? ["Monitor"]).map((flag) => <Badge key={flag} value={flag}>{flag}</Badge>)}
          </div>
          <ul className="grid gap-2 text-sm font-semibold leading-6 text-slate-700 md:grid-cols-2">
            {(care?.evidenceNeeded ?? ["Current Jira status"]).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="text-sm font-semibold leading-6 text-slate-600">{care?.captainStance}</p>
        </div>
      </details>
    </article>
  );
}

function RoutingPanel({ latest, actions }: { latest: CaptainOfficeHistoryItem | null; actions: Array<Record<string, unknown>> }) {
  const decisions = arrayOfRecords(latest?.structured_outputs?.routing_decisions);
  return (
    <Card title="Routing / Actions" icon={Route}>
      <div className="space-y-3">
        {decisions.length === 0 ? <EmptyState message="No runtime routing decisions are available yet." /> : decisions.map((decision, index) => (
          <div key={index} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black capitalize text-slate-900">{label(decision.target_lane)}</p>
              <Badge value="pending" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{label(decision.reason)}</p>
          </div>
        ))}
        {actions.slice(0, 4).map((action, index) => (
          <div key={index} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-sm font-black text-slate-900">{label(action.title ?? action.action)}</p>
            <p className="mt-1 text-sm text-slate-600">{label(action.status)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WatchItemsPanel({ state, propertyCode }: { state: CaptainOfficeState | null; propertyCode: string }) {
  return (
    <Card title="Watch Items / Alerts" icon={AlertTriangle} action={<Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(propertyCode)}/watchlist`}>Open watchlist</Link>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {(state?.alerts ?? []).length === 0 ? <EmptyState message="No active Captain’s Office alerts." /> : state?.alerts.map((alert, index) => (
            <div key={index} className={`rounded-lg border p-4 ${statusClasses(alert.severity)}`}>
              <p className="font-black">{alert.title}</p>
              <p className="mt-1 text-sm leading-6">{alert.detail}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {(state?.watch_items ?? []).slice(0, 6).map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-900">{label(item.title ?? item.watch)}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{label(item.current_state ?? item.status)}</p>
            </div>
          ))}
          {(state?.watch_items ?? []).length === 0 && <EmptyState message="No open watch items returned by the Captain source tables." />}
        </div>
      </div>
    </Card>
  );
}

function MemoryStewardshipPanel(props: {
  posture: AwarenessMemoryPosture | null;
  selfNoteText: string;
  setSelfNoteText: (value: string) => void;
  commitmentText: string;
  setCommitmentText: (value: string) => void;
  saving: boolean;
  onSelfNote: (event: React.FormEvent) => void;
  onCommitment: (event: React.FormEvent) => void;
}) {
  const posture = props.posture;
  return (
    <Card title="Captain’s Quarters" icon={Brain}>
      <div className="mb-5 rounded-lg border border-[#B7DFE6] bg-[#EFFAFC] p-4 text-sm font-semibold leading-6 text-[#114C58]">
        Captain’s Quarters is the Captain’s working memory and stewardship space. Self Notes are not canonical truth, human-submitted memory requires verification, and Fleet Scribe remains publication authority.
      </div>

      {!posture ? (
        <EmptyState message="Memory Posture is not available for this property or user scope." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniRead label="Captain" value={posture.agent_identity?.display_name ?? "Unassigned"} tone={posture.agent_identity?.active_status ?? "unknown"} />
            <MiniRead label="Self Notes" value={String(posture.active_self_notes.length)} tone="candidate" />
            <MiniRead label="Open Loops" value={String(posture.open_commitments.length)} tone={posture.open_commitments.length ? "warn" : "pass"} />
            <MiniRead label="Verify" value={String(posture.verification_needed_items.length)} tone={posture.verification_needed_items.length ? "warn" : "pass"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextListPanel title="Memory Posture: Uncertainty" items={posture.uncertainties.slice(0, 5)} empty="No uncertainty has been captured in Memory Posture." />
            <TextListPanel title="Do not recommend without more evidence" items={posture.do_not_recommend_without_more_evidence.slice(0, 5)} empty="No blocked recommendation reminders are active." />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Self Notes</p>
              {posture.active_self_notes.length === 0 ? <p className="mt-2 text-sm text-slate-500">No active self notes.</p> : (
                <div className="mt-3 space-y-3">
                  {posture.active_self_notes.slice(0, 4).map((note) => (
                    <div key={note.note_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge value={note.note_type} />
                        <Badge value={note.visibility} />
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{note.note_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Open Commitments</p>
              {posture.open_commitments.length === 0 ? <p className="mt-2 text-sm text-slate-500">No open commitments.</p> : (
                <div className="mt-3 space-y-3">
                  {posture.open_commitments.slice(0, 4).map((commitment) => (
                    <div key={commitment.commitment_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge value={commitment.status} />
                        <span className="text-xs font-bold text-slate-500">Due {formatDate(commitment.due_at)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{commitment.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {posture.regional_awareness_summary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Regional Awareness</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{posture.regional_awareness_summary.pattern_summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge value={posture.regional_awareness_summary.freshness_state} />
                <Badge value={`${posture.regional_awareness_summary.source_property_count} properties`} />
              </div>
            </div>
          )}

          {posture.care_warnings.length > 0 && (
            <TextListPanel title="Care Warnings" items={posture.care_warnings} />
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
        <form onSubmit={props.onSelfNote} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <NotebookPen className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">Add Self Note</p>
          </div>
          <textarea
            value={props.selfNoteText}
            onChange={(event) => props.setSelfNoteText(event.target.value)}
            rows={3}
            placeholder="A bounded reminder for the Captain. Not publishable evidence."
            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
          />
          <button type="submit" disabled={props.saving || !props.selfNoteText.trim()} className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#15284B] px-4 text-sm font-bold text-white disabled:bg-slate-300">
            Save Self Note
          </button>
        </form>
        <form onSubmit={props.onCommitment} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <ClipboardCheck className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">Add Commitment</p>
          </div>
          <textarea
            value={props.commitmentText}
            onChange={(event) => props.setCommitmentText(event.target.value)}
            rows={3}
            placeholder="An open loop to remember without turning it into blame."
            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
          />
          <button type="submit" disabled={props.saving || !props.commitmentText.trim()} className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#15284B] px-4 text-sm font-bold text-white disabled:bg-slate-300">
            Save Commitment
          </button>
        </form>
      </div>
    </Card>
  );
}

function MemoryCandidatePanel({ candidates, propertyCode }: { candidates: CaptainMemoryCandidateRead[]; propertyCode: string }) {
  return (
    <Card title="Captain’s Quarters Candidate Memory" icon={KeyRound} action={<Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(propertyCode)}/memory-candidates`}>Open candidates</Link>}>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
        Candidate memory is not canonical truth. Promotion is separate and remains governed.
      </div>
      {candidates.length === 0 ? <EmptyState message="No candidate memory has been created for this property yet." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {candidates.map((candidate) => <MemoryCandidateCard key={candidate.memory_candidate_id} candidate={candidate} />)}
        </div>
      )}
    </Card>
  );
}

function MemoryCandidateCard({ candidate }: { candidate: CaptainMemoryCandidateRead }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black capitalize text-slate-900">{label(candidate.candidate_type)}</p>
        <Badge value={candidate.promotion_state} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <MiniRead label="Confidence" value={numericPercent(candidate.confidence)} tone={candidate.confidence > 0.7 ? "verified" : "claim"} />
        <MiniRead label="Conflict" value={label(candidate.conflict_state)} tone={candidate.conflict_state} />
        <MiniRead label="Expires" value={formatDate(candidate.expires_at)} tone="unknown" />
        <MiniRead label="Verification" value={candidate.verification_required ? "Required" : "Not required"} tone={candidate.verification_required ? "claim" : "verified"} />
      </div>
      <p className="mt-3 font-mono text-[11px] text-slate-500">{shortHash(candidate.source_evidence_hash)}</p>
    </div>
  );
}

function ExpertReadsWorkspace(props: {
  propertyCode: string;
  reads: ExpertReadRead[];
  selectedRead: ExpertReadRead | null;
  loading: boolean;
  onSelect: (expertReadId: string) => void;
  lane: ExpertLaneId;
  setLane: (value: ExpertLaneId) => void;
  reason: string;
  setReason: (value: string) => void;
  runtimeMode: (typeof RUNTIME_MODES)[number];
  latestEvidencePacket: CaptainEvidencePacketRead | null;
  requesting: boolean;
  onRequest: (event: React.FormEvent) => void;
}) {
  return (
    <Card
      title="Expert Reads"
      icon={FileSearch}
      action={<Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(props.propertyCode)}/expert-reads`}>Open Expert Reads</Link>}
    >
      <div className="mb-5 rounded-lg border border-[#B7DFE6] bg-[#EFFAFC] p-4 text-sm font-semibold leading-6 text-[#114C58]">
        Expert Reads are governed specialist contributions from the Consulting Bench. They are not final reports; Fleet Scribe Office remains the publication authority, and Quartermaster source controls remain blocking.
      </div>

      <form onSubmit={props.onRequest} className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Consulting Bench lane</span>
            <select
              value={props.lane}
              onChange={(event) => props.setLane(event.target.value as ExpertLaneId)}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
            >
              {EXPERT_LANES.map((lane) => <option key={lane.id} value={lane.id}>{lane.label}</option>)}
            </select>
            <p className="text-xs leading-5 text-slate-500">{EXPERT_LANES.find((lane) => lane.id === props.lane)?.purpose}</p>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Governed request reason</span>
            <textarea
              value={props.reason}
              onChange={(event) => props.setReason(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-6 text-slate-600">
            Uses latest Captain evidence packet <span className="font-mono font-bold">{shortHash(props.latestEvidencePacket?.evidence_hash)}</span> in <span className="font-bold capitalize">{label(props.runtimeMode)}</span> mode.
          </div>
          <button
            type="submit"
            disabled={props.requesting || !props.latestEvidencePacket || !props.reason.trim()}
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#15284B] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {props.requesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Request Expert Read
          </button>
        </div>
      </form>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-3">
          {props.reads.length === 0 ? <EmptyState message="No Expert Reads have been created for this property yet." /> : props.reads.map((read) => (
            <button
              key={read.expert_read_id}
              type="button"
              onClick={() => props.onSelect(read.expert_read_id)}
              className={`w-full rounded-lg border p-4 text-left transition ${props.selectedRead?.expert_read_id === read.expert_read_id ? "border-[#0D5E6D] bg-[#EFFAFC]" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{expertLaneLabel(read.lane_id)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(read.generated_at)} · {label(read.request?.runtime_mode)}</p>
                </div>
                <Badge value={read.read_status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniRead label="Confidence" value={numericPercent(read.confidence)} tone={read.confidence > 0.7 ? "verified" : "warn"} />
                <MiniRead label="Freshness" value={read.freshness_state} tone={read.freshness_state} />
                <MiniRead label="Publication" value={read.publishability} tone={read.publishability} />
              </div>
            </button>
          ))}
        </div>
        <ExpertReadDetail read={props.selectedRead} loading={props.loading} />
      </div>
    </Card>
  );
}

function ExpertReadDetail({ read, loading }: { read: ExpertReadRead | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!read) return <EmptyState message="Select an Expert Read to inspect governed findings, recommendations, and lineage." />;
  const hasQuartermasterState = read.lane_id === "quartermaster" || read.read_status === "blocked" || read.publishability === "blocked" || read.freshness_state === "conflicting" || read.conflicts.length > 0;
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Specialist contribution</p>
          <h3 className="mt-1 text-2xl font-black text-[#15284B]">{expertLaneLabel(read.lane_id)}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{read.specialist_summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={read.read_status} />
          <Badge value={read.publishability} />
          <Badge value={read.freshness_state} />
        </div>
      </div>

      {hasQuartermasterState && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
          <p className="font-black">Governance visibility</p>
          <p className="mt-1">
            This read contains a blocking, stale, conflicting, or Quartermaster-relevant state. Treat it as governed specialist guidance only; unsupported claims cannot move to Fleet Scribe publication.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <MiniRead label="Confidence" value={numericPercent(read.confidence)} tone={read.confidence > 0.7 ? "verified" : "warn"} />
        <MiniRead label="Escalation" value={read.escalation_required ? "Required" : "Not required"} tone={read.escalation_required ? "blocked" : "pass"} />
        <MiniRead label="Findings" value={String(read.findings.length)} tone="current" />
        <MiniRead label="Recommendations" value={String(read.recommendations.length)} tone={read.recommendations.some((item) => item.publishability === "blocked") ? "blocked" : "current"} />
      </div>

      <GovernedTable
        title="Findings"
        empty="No findings returned by this Expert Read."
        rows={read.findings.map((finding) => ({
          title: `${label(finding.finding_type)} · ${numericPercent(finding.confidence)}`,
          body: finding.statement,
          badges: [finding.freshness, finding.publishability, finding.verification_required ? "verification required" : "verified path"],
          evidence: finding.evidence_refs,
        }))}
      />

      <GovernedTable
        title="Recommendations"
        empty="No recommendations returned by this Expert Read."
        rows={read.recommendations.map((recommendation) => ({
          title: `${label(recommendation.recommendation_type)} · ${label(recommendation.owner_lane)}`,
          body: recommendation.blocked_reason ? `${recommendation.recommendation_text} Blocked reason: ${recommendation.blocked_reason}` : recommendation.recommendation_text,
          badges: [recommendation.publishability, recommendation.proof_metric ? `proof: ${recommendation.proof_metric}` : "proof needed"],
          evidence: recommendation.evidence_refs,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TextListPanel title="Do-not-do guidance" items={read.do_not_do_rules} />
        <TextListPanel title="Conflicts / caveats" items={read.conflicts} empty="No conflicts returned by this Expert Read." />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Evidence and runtime lineage</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <LineageRow label="Evidence packet" value={read.request?.evidence_packet_hash} />
          <LineageRow label="Directive snapshot" value={read.request?.directive_snapshot_hash} />
          <LineageRow label="Expert Read hash" value={read.read_hash} />
          <LineageRow label="Request hash" value={read.request?.request_hash} />
          <LineageRow label="Runtime session" value={read.request?.source_runtime_id} />
          <LineageRow label="Interaction" value={read.request?.source_interaction_id} />
        </div>
      </div>
    </div>
  );
}

function ExpertReadAuthorityPanel({ reads, selectedRead }: { reads: ExpertReadRead[]; selectedRead: ExpertReadRead | null }) {
  const blocked = reads.filter((read) => read.read_status === "blocked" || read.publishability === "blocked").length;
  const stale = reads.filter((read) => read.freshness_state === "stale" || read.freshness_state === "conflicting").length;
  return (
    <Card title="Expert Read Authority" icon={LockKeyhole}>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          Expert Reads sharpen decisions. They do not publish, mutate Data Pond, or promote memory.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniRead label="Total reads" value={String(reads.length)} tone="current" />
          <MiniRead label="Blocked" value={String(blocked)} tone={blocked > 0 ? "blocked" : "pass"} />
          <MiniRead label="Stale/conflict" value={String(stale)} tone={stale > 0 ? "stale" : "pass"} />
          <MiniRead label="Selected lane" value={selectedRead ? expertLaneLabel(selectedRead.lane_id) : "-"} tone={selectedRead?.publishability ?? "unknown"} />
        </div>
        <LineageRow label="Selected read hash" value={selectedRead?.read_hash} />
        <LineageRow label="Evidence hash" value={selectedRead?.request?.evidence_packet_hash} />
      </div>
    </Card>
  );
}

function GovernedTable({ title, rows, empty }: { title: string; rows: Array<{ title: string; body: string; badges: string[]; evidence: string[] }>; empty: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-black capitalize text-slate-950">{row.title}</p>
                <div className="flex flex-wrap gap-2">{row.badges.map((badge) => <Badge key={badge} value={badge} />)}</div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{row.body}</p>
              <p className="mt-3 font-mono text-[11px] text-slate-500">Evidence refs: {row.evidence.length > 0 ? row.evidence.join(", ") : "-"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TextListPanel({ title, items, empty = "None returned." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => <li key={index} className="text-sm font-semibold leading-6 text-slate-700">{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function RuntimeHistoryPanel({ items, propertyCode, expanded }: { items: CaptainOfficeHistoryItem[]; propertyCode: string; expanded?: boolean }) {
  const visible = expanded ? items : items.slice(0, 4);
  return (
    <Card title="Captain’s Log / Runtime Lineage" icon={History} action={!expanded && <Link className="text-sm font-bold text-[#0057c2]" href={`/captains/${encodeURIComponent(propertyCode)}/history`}>Open Captain’s Log</Link>}>
      {visible.length === 0 ? <EmptyState message="No prior runtime interactions are available." /> : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div key={item.interaction_id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black capitalize text-slate-900">{label(item.intent)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(item.timestamp)} · {label(item.runtime_mode)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge value={item.authority_level} />
                  <Badge value={item.publishability} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.conversational_response ?? item.input_text}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <MiniRead label="Directive" value={shortHash((item.directive_snapshot as Record<string, unknown> | null)?.runtime_snapshot_hash)} tone="current" />
                <MiniRead label="Evidence" value={shortHash(item.evidence_packet_hash)} tone="current" />
                <MiniRead label="Response" value={shortHash(item.response_hash)} tone="current" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LineageFooter({ state }: { state: CaptainOfficeState | null }) {
  return (
    <Card title="Runtime Lineage" icon={GitBranch}>
      <div className="space-y-3">
        <LineageRow label="Runtime hash" value={state?.runtime_status?.runtime_hash} />
        <LineageRow label="Evidence hash" value={state?.runtime_status?.evidence_packet_hash} />
        <LineageRow label="Response hash" value={state?.runtime_status?.response_hash} />
        <LineageRow label="Directive snapshot" value={(state?.runtime_status?.directive_snapshot as Record<string, unknown> | null)?.runtime_snapshot_id} />
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        This office displays governed runtime lineage. It does not expose raw internal payloads or system prompts.
      </div>
    </Card>
  );
}

function LineageRow({ label: title, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</span>
      <span className="font-mono text-xs text-slate-700">{shortHash(value)}</span>
    </div>
  );
}

function MiniRead({ label: title, value, tone }: { label: string; value: unknown; tone?: unknown }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{title}</p>
      <p className="mt-1 truncate text-sm font-black capitalize text-slate-900">{label(value)}</p>
      <div className="mt-2"><Badge value={tone ?? value} /></div>
    </div>
  );
}

function StructuredList({ title, items, empty = "None returned by the runtime." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6 text-slate-700">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
      {message}
    </div>
  );
}

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}
