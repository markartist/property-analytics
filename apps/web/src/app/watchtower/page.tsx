"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getHealthStatus,
  type HealthStatusResponse, type TableStat, type SourceFreshness, type DailyCollectionSourceStatus,
} from "@/lib/api";
import {
  Eye, Loader2, ArrowLeft, CheckCircle2, XCircle,
  Database, Clock, Activity, Layers, Search, Siren, ShieldAlert, Wrench, RefreshCw,
  Gauge, Radar, Zap, Orbit, TimerReset, Flame, Sparkles, Shield, ScanSearch, Cable,
  AlertTriangle, Target, Binary, ChevronRight,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

const AUTO_REFRESH_MS = 60_000;
const CORE_RETRY_SOURCES = new Set(["ga4", "gsc", "google_ads", "guest_card", "unit_availability", "d1_mirror"]);

function freshnessInfo(src: SourceFreshness | TableStat): { days: number; label: string; color: string; bg: string; tone: "fresh" | "warning" | "stale" | "missing" } {
  const dateStr = src.latest_date;
  const status = "freshness_status" in src ? src.freshness_status : undefined;

  if (!dateStr) return { days: -1, label: "No data", color: "text-red-600", bg: "bg-red-100", tone: "missing" };

  if (status) {
    const ageDays = "age_days" in src && typeof src.age_days === "number"
      ? src.age_days
      : differenceInDays(new Date(), parseISO(dateStr));
    const lagLabel = "business_lag_days" in src && typeof src.business_lag_days === "number"
      ? `${src.business_lag_days}bd`
      : `${ageDays}d`;
    if (status === "missing") return { days: -1, label: "No data", color: "text-red-600", bg: "bg-red-100", tone: "missing" };
    if (status === "stale") return { days: ageDays, label: lagLabel, color: "text-red-700", bg: "bg-red-100", tone: "stale" };
    if (status === "warning") return { days: ageDays, label: lagLabel, color: "text-amber-700", bg: "bg-amber-100", tone: "warning" };
    return { days: ageDays, label: lagLabel, color: "text-emerald-700", bg: "bg-emerald-100", tone: "fresh" };
  }

  const days = differenceInDays(new Date(), parseISO(dateStr));
  if (days <= 7) return { days, label: `${days}d`, color: "text-emerald-700", bg: "bg-emerald-100", tone: "fresh" };
  if (days <= 14) return { days, label: `${days}d`, color: "text-amber-700", bg: "bg-amber-100", tone: "warning" };
  return { days, label: `${days}d`, color: "text-red-700", bg: "bg-red-100", tone: "stale" };
}

function collectionStatusBadge(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700 border-0";
    case "partial":
    case "retry_scheduled":
    case "in_progress":
      return "bg-amber-100 text-amber-700 border-0";
    case "blocked":
    case "failed":
    case "exhausted":
      return "bg-red-100 text-red-700 border-0";
    default:
      return "bg-slate-100 text-slate-600 border-0";
  }
}

function collectionStatusLabel(status: string): string {
  switch (status) {
    case "retry_scheduled":
      return "Retry Scheduled";
    case "in_progress":
      return "In Progress";
    default:
      return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function closureBadge(state: string): string {
  switch (state) {
    case "complete":
      return "bg-emerald-100 text-emerald-700 border-0";
    case "open":
      return "bg-amber-100 text-amber-700 border-0";
    default:
      return "bg-slate-100 text-slate-600 border-0";
  }
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function dialTone(value: number): { stroke: string; text: string; glow: string; surface: string } {
  if (value >= 80) {
    return {
      stroke: "#34d399",
      text: "text-emerald-200",
      glow: "shadow-[0_0_60px_rgba(16,185,129,0.25)]",
      surface: "from-emerald-500/15 to-cyan-400/5",
    };
  }
  if (value >= 55) {
    return {
      stroke: "#fbbf24",
      text: "text-amber-200",
      glow: "shadow-[0_0_60px_rgba(251,191,36,0.22)]",
      surface: "from-amber-500/15 to-orange-400/5",
    };
  }
  return {
    stroke: "#fb7185",
    text: "text-rose-200",
    glow: "shadow-[0_0_60px_rgba(251,113,133,0.22)]",
    surface: "from-rose-500/15 to-red-400/5",
  };
}

function statusChipTone(tone: "fresh" | "warning" | "stale" | "missing") {
  switch (tone) {
    case "fresh":
      return "bg-emerald-400";
    case "warning":
      return "bg-amber-400";
    case "missing":
    case "stale":
      return "bg-rose-500";
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not started";
  try {
    return format(parseISO(value), "h:mm a");
  } catch {
    return value;
  }
}

function formatYmdLabel(value: string): string {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function formatDateTimeLabel(value: string | null): string {
  if (!value) return "Not scheduled";
  try {
    return format(parseISO(value), "MMM d h:mm a");
  } catch {
    return value;
  }
}

function formatSourceName(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isRetryDueNow(value: string | null, now: Date): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return parsed <= now.getTime();
}

function summarizeBlocker(item: HealthStatusResponse["telemetry"]["retry_queue"]["items"][number]): string {
  const detail = `${item.last_error_type || ""} ${item.last_error_message || ""} ${item.notes || ""}`.toLowerCase();
  if (detail.includes("auth") || detail.includes("token") || detail.includes("credential")) return "Auth";
  if (detail.includes("rate") || detail.includes("429")) return "Rate Limit";
  if (detail.includes("timeout") || detail.includes("connection") || detail.includes("unavailable")) return "Transient API";
  if (detail.includes("file") || detail.includes("csv") || detail.includes("manual")) return "Source Delivery";
  return "Needs Review";
}

function sourceRunbook(source: string | null): {
  owner: string;
  firstStep: string;
  escalation: string;
  watchFor: string;
} | null {
  switch ((source || "").toLowerCase()) {
    case "ga4":
      return {
        owner: "Canonical collector / GA4 auth",
        firstStep: "Retry transient property misses first, then verify service-account access and API health.",
        escalation: "If failures persist across retries, inspect GA4 credential materialization and property mapping.",
        watchFor: "503/504 patterns, connection resets, and isolated property-level misses.",
      };
    case "gsc":
      return {
        owner: "Canonical collector / GSC OAuth",
        firstStep: "Recheck the failing property/site mapping and retry the property subset before broader investigation.",
        escalation: "If the same site stays red, inspect OAuth token health, site verification, and registry URL identity drift.",
        watchFor: "Domain-vs-URL mapping issues, stale inspection rows, and token expiry.",
      };
    case "google_ads":
      return {
        owner: "Google Ads subset collector",
        firstStep: "Retry only the stale property subset and confirm campaign-to-property mapping still resolves cleanly.",
        escalation: "If partial gaps persist, inspect account auth and mapping drift rather than rerunning the full source.",
        watchFor: "Subset-only misses, campaign mapping drift, and partial freshness gaps.",
      };
    case "guest_card":
    case "guest_cards":
      return {
        owner: "Manual delivery + canonical guest card ingest",
        firstStep: "Confirm the latest CSVs landed in the live drop, then rerun canonical guest card ingest.",
        escalation: "If files are missing past the expected morning window, treat this as a manual dependency incident.",
        watchFor: "Missing drop files, stale latest date, and restored backlog waiting to ingest.",
      };
    case "unit_availability":
      return {
        owner: "ThirtyLines / availability feed",
        firstStep: "Retry the source-level ingestion and confirm property mapping counts recover.",
        escalation: "If mapping remains short, inspect upstream availability export integrity before repeated retries.",
        watchFor: "Source-level gaps, mapping shortfalls, and stale inventory coverage.",
      };
    case "d1_mirror":
      return {
        owner: "Mirror sync / Cloudflare auth",
        firstStep: "Confirm local canonical freshness first, then rerun the real mirror sync and verification.",
        escalation: "If mirror auth or verification fails again, inspect Wrangler/Keeper token resolution and downstream target freshness.",
        watchFor: "Wrangler auth failures, verification mismatches, and stale mirrored freshness tables.",
      };
    default:
      return null;
  }
}

function sourceActionChips(
  source: string | null,
  queueItem?: HealthStatusResponse["telemetry"]["retry_queue"]["items"][number] | null,
): string[] {
  const normalized = (source || "").toLowerCase();
  const blocker = queueItem ? summarizeBlocker(queueItem) : null;

  if (normalized === "ga4") {
    return [
      "Retry subset",
      blocker === "Auth" ? "Inspect auth" : "Check API health",
      "Review property mapping",
    ];
  }
  if (normalized === "gsc") {
    return [
      "Retry property",
      "Check site mapping",
      blocker === "Auth" ? "Refresh OAuth" : "Inspect token health",
    ];
  }
  if (normalized === "google_ads") {
    return [
      "Retry stale subset",
      "Check campaign mapping",
      blocker === "Auth" ? "Inspect ads auth" : "Review partial gaps",
    ];
  }
  if (normalized === "guest_card" || normalized === "guest_cards") {
    return [
      "Check files",
      "Run ingest",
      "Confirm drop timing",
    ];
  }
  if (normalized === "unit_availability") {
    return [
      "Retry feed",
      "Check mapping counts",
      "Inspect upstream export",
    ];
  }
  if (normalized === "d1_mirror") {
    return [
      "Run mirror",
      blocker === "Auth" ? "Inspect Wrangler auth" : "Verify target freshness",
      "Check local freshness",
    ];
  }
  return ["Inspect lane", "Review notes", "Check queue"];
}

function sourceStatusTone(status: string): "emerald" | "amber" | "rose" | "cyan" {
  if (status === "completed") return "emerald";
  if (status === "partial" || status === "retry_scheduled" || status === "in_progress") return "amber";
  if (status === "blocked" || status === "failed" || status === "exhausted") return "rose";
  return "cyan";
}

function parseGoogleAdsOutcomeNotes(notes: string | null): { active: number; noActivity: number; retryable: number } | null {
  if (!notes) return null;
  const match = notes.match(/Google Ads outcomes:\s*(\d+)\s+active,\s*(\d+)\s+no-activity,\s*(\d+)\s+retryable failure/i);
  if (!match) return null;
  return {
    active: Number(match[1] ?? 0),
    noActivity: Number(match[2] ?? 0),
    retryable: Number(match[3] ?? 0),
  };
}

function MiniBar({ value, tone = "emerald" }: { value: number; tone?: "emerald" | "amber" | "rose" | "cyan" }) {
  const color =
    tone === "emerald" ? "from-emerald-400 to-emerald-500"
      : tone === "amber" ? "from-amber-300 to-orange-400"
        : tone === "rose" ? "from-rose-400 to-red-500"
          : "from-cyan-400 to-sky-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
      <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.max(4, value)}%` }} />
    </div>
  );
}

function TinyPulse({ tone }: { tone: "emerald" | "amber" | "rose" | "cyan" }) {
  const colors =
    tone === "emerald" ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.6)]"
      : tone === "amber" ? "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
        : tone === "rose" ? "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.55)]"
          : "bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.55)]";
  return <span className={`inline-flex h-2.5 w-2.5 animate-pulse rounded-full ${colors}`} />;
}

function MicroSparkline({
  values,
  tone = "cyan",
}: {
  values: number[];
  tone?: "emerald" | "amber" | "rose" | "cyan";
}) {
  const safeValues = values.length > 0 ? values : [0];
  const max = Math.max(...safeValues, 1);
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? 50 : (index / (safeValues.length - 1)) * 100;
    const y = 100 - (value / max) * 84 - 8;
    return `${x},${y}`;
  }).join(" ");
  const stroke =
    tone === "emerald" ? "#34d399"
      : tone === "amber" ? "#fbbf24"
        : tone === "rose" ? "#fb7185"
          : "#22d3ee";

  return (
    <svg viewBox="0 0 100 100" className="h-16 w-full">
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#spark-${tone})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function MetricDial({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const tone = dialTone(value);

  return (
    <div className={`rounded-[30px] border border-white/10 bg-gradient-to-br ${tone.surface} p-5 backdrop-blur ${tone.glow}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-2">
          <Icon className="h-5 w-5 text-white/80" />
        </div>
      </div>
      <div className="relative mx-auto h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${tone.text}`}>{value}%</span>
          <span className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">Signal</span>
        </div>
      </div>
    </div>
  );
}

function PulseRail({ values }: { values: { label: string; tone: "fresh" | "warning" | "stale" | "missing" }[] }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {values.map((value) => (
          <div
            key={value.label}
            className={`h-2 flex-1 rounded-full ${statusChipTone(value.tone)}`}
            title={`${value.label}: ${value.tone}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {values.map((value) => (
          <div key={value.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusChipTone(value.tone)}`} />
            <span>{value.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceSignalCard({ src }: { src: SourceFreshness }) {
  const info = freshnessInfo(src);
  const toneBorder =
    info.tone === "fresh" ? "border-emerald-200/80"
      : info.tone === "warning" ? "border-amber-200/80"
        : "border-rose-200/80";
  const toneGlow =
    info.tone === "fresh" ? "from-emerald-50 via-white to-cyan-50/60"
      : info.tone === "warning" ? "from-amber-50 via-white to-orange-50/60"
        : "from-rose-50 via-white to-red-50/60";

  return (
    <Card className={`overflow-hidden border ${toneBorder} bg-gradient-to-br ${toneGlow} shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg`}>
      <CardContent className="p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{src.source_label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {src.latest_date ? format(parseISO(src.latest_date), "MMM d, yyyy") : "No data yet"}
            </p>
          </div>
          <Badge className={`${info.bg} ${info.color} border-0 font-bold`}>
            {info.label}
          </Badge>
        </div>
        <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${statusChipTone(info.tone)} shadow-[0_0_18px_rgba(15,23,42,0.15)]`} />
          <MiniBar
            value={Math.max(5, 100 - Math.max(0, (src.age_days ?? 0) * 14))}
            tone={info.tone === "fresh" ? "emerald" : info.tone === "warning" ? "amber" : "rose"}
          />
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{src.freshness_status ?? "fresh"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Coverage</p>
            <p className="mt-1 font-bold text-slate-900">{src.property_count}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Rows</p>
            <p className="mt-1 font-bold text-slate-900">{src.row_count.toLocaleString()}</p>
          </div>
        </div>
        {src.expected_latest_date && src.expected_latest_date !== src.latest_date && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Expected through {format(parseISO(src.expected_latest_date), "MMM d")} based on source timing policy
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TowerReadout({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "rose" | "cyan";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClasses =
    tone === "emerald" ? "text-emerald-200 bg-emerald-500/10 border-emerald-400/20"
      : tone === "amber" ? "text-amber-100 bg-amber-500/10 border-amber-400/20"
        : tone === "rose" ? "text-rose-100 bg-rose-500/10 border-rose-400/20"
          : "text-cyan-100 bg-cyan-500/10 border-cyan-400/20";

  return (
    <div className={`rounded-[28px] border p-4 ${toneClasses}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">{label}</p>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/70">{detail}</p>
    </div>
  );
}

function CollectionStageCard({ row }: { row: DailyCollectionSourceStatus }) {
  const progressPct = percent(row.success_count + row.failed_count + row.skipped_count, Math.max(row.total_count, 1));
  const tone = sourceStatusTone(row.status);
  const frame =
    tone === "emerald" ? "from-emerald-50 to-white border-emerald-200"
      : tone === "amber" ? "from-amber-50 to-white border-amber-200"
        : tone === "rose" ? "from-rose-50 to-white border-rose-200"
          : "from-cyan-50 to-white border-cyan-200";

  return (
    <div className={`rounded-[28px] border bg-gradient-to-br ${frame} p-4 shadow-sm`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{formatSourceName(row.source)}</p>
          <p className="mt-1 text-sm text-slate-500">
            {formatTimestamp(row.started_at)}
            <span className="mx-2 text-slate-300">→</span>
            {row.completed_at ? formatTimestamp(row.completed_at) : "Open"}
          </p>
        </div>
        <Badge className={collectionStatusBadge(row.status)}>{collectionStatusLabel(row.status)}</Badge>
      </div>

      <div className="space-y-4">
        <div className="rounded-[22px] border border-white/80 bg-white/80 p-4">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
            <span>Completion</span>
            <span>{progressPct}%</span>
          </div>
          <MiniBar value={progressPct} tone={tone} />
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
            <div className="rounded-2xl bg-emerald-50 p-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Good</p>
              <p className="mt-1 font-bold text-emerald-800">{row.success_count}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Retry</p>
              <p className="mt-1 font-bold text-amber-800">{row.retry_attempts}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-rose-700">Fail</p>
              <p className="mt-1 font-bold text-rose-800">{row.failed_count}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Open</p>
              <p className="mt-1 font-bold text-slate-800">{row.remaining_count}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] bg-slate-900 p-4 text-white">
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-300" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Flow</span>
            </div>
            <p className="text-sm text-slate-200">
              {row.success_count}/{row.total_count || row.success_count + row.failed_count + row.skipped_count} resolved
            </p>
            <p className="mt-2 text-xs text-slate-400">{row.rate_limit_hits} rate-limit hit(s)</p>
          </div>
          <div className="rounded-[22px] bg-slate-100 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Cable className="h-4 w-4 text-slate-600" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Context</span>
            </div>
            <p className="text-sm text-slate-700">{row.notes || row.error_message || "No issues logged."}</p>
          </div>
        </div>
        {row.source === "google_ads" && parseGoogleAdsOutcomeNotes(row.notes) && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            {(() => {
              const outcomes = parseGoogleAdsOutcomeNotes(row.notes);
              if (!outcomes) return null;
              return (
                <>
                  <div className="rounded-2xl bg-emerald-50 p-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Active</p>
                    <p className="mt-1 font-bold text-emerald-800">{outcomes.active}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">No Activity</p>
                    <p className="mt-1 font-bold text-slate-800">{outcomes.noActivity}</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-rose-700">Retryable</p>
                    <p className="mt-1 font-bold text-rose-800">{outcomes.retryable}</p>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionConstellation({ rows }: { rows: DailyCollectionSourceStatus[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((row) => {
        const tone = sourceStatusTone(row.status);
        const ring =
          tone === "emerald" ? "border-emerald-400/40 bg-emerald-500/10"
            : tone === "amber" ? "border-amber-400/40 bg-amber-500/10"
              : tone === "rose" ? "border-rose-400/40 bg-rose-500/10"
                : "border-cyan-400/40 bg-cyan-500/10";
        return (
          <div key={`${row.source}-constellation`} className={`rounded-[24px] border p-3 text-center ${ring}`}>
            <div className="mb-2 flex items-center justify-center">
              <TinyPulse tone={tone} />
            </div>
            <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/55">{formatSourceName(row.source)}</p>
            <p className="mt-1 text-lg font-semibold text-white">{percent(row.success_count, Math.max(row.total_count, 1))}%</p>
          </div>
        );
      })}
    </div>
  );
}

function timelineTone(status: string): "emerald" | "amber" | "rose" | "cyan" {
  if (status === "completed") return "emerald";
  if (status === "partial" || status === "retry_scheduled" || status === "in_progress") return "amber";
  if (status === "blocked" || status === "failed" || status === "exhausted") return "rose";
  return "cyan";
}

function SourceTimelineLane({
  timeline,
  selected,
  onSelect,
}: {
  timeline: HealthStatusResponse["telemetry"]["source_timelines"][number];
  selected: boolean;
  onSelect: (source: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(timeline.source)}
      className={`w-full rounded-[26px] border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-[#0D5E6D] ring-2 ring-[#0D5E6D]/15" : "border-slate-200"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{formatSourceName(timeline.source)}</p>
          <p className="mt-1 text-xs text-slate-500">Recent run states and completion trend</p>
        </div>
        <Badge className={collectionStatusBadge(timeline.points[timeline.points.length - 1]?.status ?? "unknown")}>
          {collectionStatusLabel(timeline.points[timeline.points.length - 1]?.status ?? "unknown")}
        </Badge>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {timeline.points.map((point) => {
          const pct = percent(point.success_count, Math.max(point.total_count, 1));
          const tone = timelineTone(point.status);
          const classes =
            tone === "emerald" ? "border-emerald-200 bg-emerald-50"
              : tone === "amber" ? "border-amber-200 bg-amber-50"
                : tone === "rose" ? "border-rose-200 bg-rose-50"
                  : "border-cyan-200 bg-cyan-50";
          return (
            <div key={`${timeline.source}-${point.collection_date}`} className={`rounded-[20px] border p-2 text-center ${classes}`}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{formatYmdLabel(point.collection_date)}</p>
              <div className="my-2 flex justify-center">
                <TinyPulse tone={tone} />
              </div>
              <p className="text-sm font-semibold text-slate-900">{pct}%</p>
              <p className="mt-1 text-[10px] text-slate-500">{point.success_count}/{point.total_count || 0}</p>
            </div>
          );
        })}
      </div>
    </button>
  );
}

function RecoveryTape({
  points,
}: {
  points: HealthStatusResponse["telemetry"]["collection_history"];
}) {
  const maxExpected = Math.max(...points.map((point) => point.properties_expected), 1);

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {points.map((point) => {
        const closedPct = percent(point.properties_succeeded, Math.max(point.properties_expected, 1));
        const blockedPct = percent(point.sources_blocked, Math.max(point.sources_total, 1));
        return (
          <div key={point.collection_date} className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{formatYmdLabel(point.collection_date)}</p>
              <TinyPulse tone={point.sources_blocked > 0 ? "rose" : point.sources_active > 0 ? "amber" : "emerald"} />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{point.properties_succeeded}</p>
                <p className="text-xs text-slate-500">resolved properties</p>
              </div>
              <div>
                <MiniBar value={(point.properties_expected / maxExpected) * 100} tone="cyan" />
                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">{point.properties_expected} expected</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-emerald-50 p-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">Closed</p>
                  <p className="mt-1 font-bold text-emerald-800">{closedPct}%</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-rose-700">Blocked</p>
                  <p className="mt-1 font-bold text-rose-800">{blockedPct}%</p>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {point.retry_attempts} retries • {point.rate_limit_hits} rate limits
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CoverageDriftCard({
  source,
}: {
  source: HealthStatusResponse["telemetry"]["source_coverage_history"][number];
}) {
  const latestPct = source.points[source.points.length - 1]?.coverage_pct ?? 0;
  const tone: "emerald" | "amber" | "rose" = latestPct >= 90 ? "emerald" : latestPct >= 60 ? "amber" : "rose";

  return (
    <div className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{source.source_label}</p>
          <p className="mt-1 text-xs text-slate-500">Recent source coverage by actual published periods</p>
        </div>
        <Badge className={tone === "emerald" ? "border-0 bg-emerald-100 text-emerald-700" : tone === "amber" ? "border-0 bg-amber-100 text-amber-700" : "border-0 bg-rose-100 text-rose-700"}>
          {latestPct}%
        </Badge>
      </div>
      <MicroSparkline values={source.points.map((point) => point.coverage_pct)} tone={tone} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {source.points.slice(-3).map((point) => (
          <div key={`${source.source_key}-${point.date}`} className="rounded-2xl bg-white p-2">
            <p className="uppercase tracking-[0.16em] text-slate-400">{formatYmdLabel(point.date)}</p>
            <p className="mt-1 font-bold text-slate-800">{point.coverage_pct}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetryQueueItemCard({
  item,
}: {
  item: HealthStatusResponse["telemetry"]["retry_queue"]["items"][number];
}) {
  const tone =
    item.retry_disposition === "manual_dependency" ? "amber"
      : item.retry_disposition === "hard_blocked" ? "rose"
        : item.status === "retrying" ? "cyan"
          : "amber";
  const frame =
    tone === "amber" ? "border-amber-200 bg-amber-50/60"
      : tone === "rose" ? "border-rose-200 bg-rose-50/60"
        : "border-cyan-200 bg-cyan-50/60";

  return (
    <div className={`rounded-[24px] border p-4 ${frame}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{formatSourceName(item.data_source)}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{item.property_name || item.property_id || "Source-level retry"}</p>
        </div>
        <Badge className={tone === "amber" ? "border-0 bg-amber-100 text-amber-700" : tone === "rose" ? "border-0 bg-rose-100 text-rose-700" : "border-0 bg-cyan-100 text-cyan-700"}>
          {formatSourceName(item.status)}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/80 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Disposition</p>
          <p className="mt-1 font-semibold text-slate-800">{formatSourceName(item.retry_disposition)}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Attempts</p>
          <p className="mt-1 font-semibold text-slate-800">{item.attempt_count}</p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-white/80 p-3 text-sm text-slate-700">
        {item.notes || item.last_error_message || "Retry item is open with no extra notes logged."}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Next: {formatDateTimeLabel(item.next_attempt_at)}</span>
        <span>Window: {formatDateTimeLabel(item.retry_window_end)}</span>
      </div>
    </div>
  );
}

function CommandRailCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "rose" | "cyan";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const classes =
    tone === "emerald" ? "border-emerald-200 bg-emerald-50"
      : tone === "amber" ? "border-amber-200 bg-amber-50"
        : tone === "rose" ? "border-rose-200 bg-rose-50"
          : "border-cyan-200 bg-cyan-50";
  const iconTone =
    tone === "emerald" ? "text-emerald-600"
      : tone === "amber" ? "text-amber-600"
        : tone === "rose" ? "text-rose-600"
          : "text-cyan-600";

  return (
    <div className={`rounded-[26px] border p-4 ${classes}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <Icon className={`h-5 w-5 ${iconTone}`} />
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

export default function WatchtowerPage() {
  const [data, setData] = React.useState<HealthStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [retrySearchQuery, setRetrySearchQuery] = React.useState("");
  const [retryScope, setRetryScope] = React.useState<"all" | "core" | "manual_dependency" | "hard_blocked" | "retrying">("all");
  const [retryFocusMode, setRetryFocusMode] = React.useState(false);
  const [selectedSource, setSelectedSource] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [now, setNow] = React.useState<Date>(new Date());

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await getHealthStatus();
        if (!active) return;
        setData(result);
        setError(null);
        setLastUpdated(new Date());
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load health status");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const refreshInterval = window.setInterval(load, AUTO_REFRESH_MS);
    const clockInterval = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.clearInterval(clockInterval);
    };
  }, []);

  const filteredMatrix = React.useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data.coverage_matrix;
    const q = searchQuery.toLowerCase();
    return data.coverage_matrix.filter((r) => r.community_name.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const derived = React.useMemo(() => {
    if (!data) return null;

    const sourceSignals = data.source_freshness.map((src) => ({
      label: src.source_label,
      tone: freshnessInfo(src).tone,
    }));
    const freshCount = sourceSignals.filter((item) => item.tone === "fresh").length;
    const warningCount = sourceSignals.filter((item) => item.tone === "warning").length;
    const staleCount = sourceSignals.filter((item) => item.tone === "stale" || item.tone === "missing").length;
    const collectionCompletion = percent(
      data.daily_collection_status.summary.properties_succeeded,
      Math.max(data.daily_collection_status.summary.properties_expected, 1),
    );
    const freshnessStability = percent(freshCount, Math.max(sourceSignals.length, 1));
    const issuePressure = Math.max(
      0,
      100 - (
        data.integrity_summary.core_failure_sources * 25
        + data.integrity_summary.freshness_stale_sources * 12
        + data.integrity_summary.specialty_failure_sources * 7
      ),
    );
    const activeSourceCount = data.daily_collection_status.sources.filter((row) => row.status !== "completed").length;
    const outstandingWork = data.daily_collection_status.summary.properties_remaining + data.daily_collection_status.summary.properties_failed;
    const hottestSources = [...data.source_freshness].sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0)).slice(0, 5);
    const collectionRows = data.daily_collection_status.sources;
    const coreSummaryTone: "emerald" | "amber" | "rose" =
      data.daily_collection_status.closure.state === "complete"
        ? "emerald"
        : data.integrity_summary.core_failure_sources > 0
          ? "rose"
          : "amber";
    const nextAction =
      data.daily_collection_status.closure.state === "complete"
        ? "Morning run family is closed. Watch for new alerts, not more retries."
        : data.daily_collection_status.summary.sources_active > 0
          ? "Retry cycle is still active. Prioritize unresolved sources before summary send."
          : data.daily_collection_status.summary.sources_blocked > 0
            ? "Blocked sources remain. Investigate the red pods and clear hard-stop conditions."
            : "Collection has not fully started yet. Watch source pods for first movement.";
    const collectionMotion = data.telemetry.collection_history.map((point) => point.properties_succeeded);
    const issueMotion = data.telemetry.collection_history.map((point) => point.sources_blocked + point.properties_failed);
    const freshnessMotion = data.telemetry.source_coverage_history.map((source) => source.points[source.points.length - 1]?.coverage_pct ?? 0);
    const weakestCoverageSources = [...data.telemetry.source_coverage_history]
      .sort((a, b) => (a.points[a.points.length - 1]?.coverage_pct ?? 0) - (b.points[b.points.length - 1]?.coverage_pct ?? 0))
      .slice(0, 6);
    const activeTimelines = [...data.telemetry.source_timelines]
      .sort((a, b) => {
        const latestA = a.points[a.points.length - 1]?.status ?? "unknown";
        const latestB = b.points[b.points.length - 1]?.status ?? "unknown";
        const score = (status: string) => status === "blocked" || status === "failed" || status === "exhausted" ? 3 : status === "partial" || status === "retry_scheduled" || status === "in_progress" ? 2 : status === "completed" ? 1 : 0;
        return score(latestB) - score(latestA);
      })
      .slice(0, 6);
    const effectiveSelectedSource = selectedSource && data.telemetry.source_timelines.some((timeline) => timeline.source === selectedSource)
      ? selectedSource
      : activeTimelines[0]?.source ?? null;
    const manualQueueCount = data.telemetry.retry_queue.by_disposition.manual_dependency ?? 0;
    const hardBlockedQueueCount = data.telemetry.retry_queue.by_disposition.hard_blocked ?? 0;
    const retryingQueueCount = data.telemetry.retry_queue.by_status.retrying ?? 0;
    const pendingQueueCount = data.telemetry.retry_queue.by_status.pending ?? 0;
    const dueNowItems = data.telemetry.retry_queue.items.filter((item) => isRetryDueNow(item.next_attempt_at, now));
    const manualItems = data.telemetry.retry_queue.items.filter((item) => item.retry_disposition === "manual_dependency");
    const hardBlockedItems = data.telemetry.retry_queue.items.filter((item) => item.retry_disposition === "hard_blocked");
    const hottestDueItem = [...dueNowItems].sort((a, b) => b.attempt_count - a.attempt_count)[0] ?? null;
    const nextScheduledItem = [...data.telemetry.retry_queue.items]
      .filter((item) => item.next_attempt_at && !isRetryDueNow(item.next_attempt_at, now))
      .sort((a, b) => Date.parse(a.next_attempt_at || "") - Date.parse(b.next_attempt_at || ""))[0] ?? null;
    const topManualItem = manualItems[0] ?? null;
    const topHardBlockedItem = [...hardBlockedItems].sort((a, b) => b.attempt_count - a.attempt_count)[0] ?? null;
    const retrySearch = retrySearchQuery.trim().toLowerCase();
    const filteredRetryQueue = data.telemetry.retry_queue.items
      .filter((item) => {
        if (effectiveSelectedSource && item.data_source !== effectiveSelectedSource) return false;
        if (retryScope === "core" && !CORE_RETRY_SOURCES.has(item.data_source)) return false;
        if (retryScope === "manual_dependency" && item.retry_disposition !== "manual_dependency") return false;
        if (retryScope === "hard_blocked" && item.retry_disposition !== "hard_blocked") return false;
        if (retryScope === "retrying" && item.status !== "retrying") return false;
        if (!retrySearch) return true;
        const haystack = [
          item.data_source,
          item.property_name,
          item.property_id,
          item.retry_disposition,
          item.last_error_type,
          item.last_error_message,
          item.notes,
        ].join(" ").toLowerCase();
        return haystack.includes(retrySearch);
      })
      .sort((a, b) => {
        if (!retryFocusMode) {
          const aTime = a.next_attempt_at ? Date.parse(a.next_attempt_at) : Number.POSITIVE_INFINITY;
          const bTime = b.next_attempt_at ? Date.parse(b.next_attempt_at) : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        }
        const score = (item: typeof a) => {
          let value = 0;
          if (item.retry_disposition === "hard_blocked") value += 100;
          else if (item.retry_disposition === "manual_dependency") value += 70;
          if (item.status === "retrying") value += 25;
          value += Math.min(item.attempt_count, 10) * 4;
          if (CORE_RETRY_SOURCES.has(item.data_source)) value += 15;
          return value;
        };
        return score(b) - score(a);
      });
    const selectedTimeline = data.telemetry.source_timelines.find((timeline) => timeline.source === effectiveSelectedSource) ?? null;
    const selectedCollectionRow = collectionRows.find((row) => row.source === effectiveSelectedSource) ?? null;
    const selectedSourceIssues = data.integrity_summary.top_issues.filter((issue) => issue.source === effectiveSelectedSource);
    const selectedFreshnessSource = data.source_freshness.find((src) => src.source_key === effectiveSelectedSource) ?? null;
    const selectedCoverageSource = data.telemetry.source_coverage_history.find((src) => src.source_key === effectiveSelectedSource) ?? null;
    const focusSignalWall = effectiveSelectedSource
      ? data.source_freshness.filter((src) => src.source_key === effectiveSelectedSource)
      : data.source_freshness;
    const focusCoverageSources = effectiveSelectedSource
      ? (selectedCoverageSource ? [selectedCoverageSource] : weakestCoverageSources)
      : weakestCoverageSources;
    const focusHottestSources = effectiveSelectedSource
      ? (selectedFreshnessSource ? [selectedFreshnessSource] : hottestSources)
      : hottestSources;

    return {
      sourceSignals,
      collectionCompletion,
      freshnessStability,
      issuePressure,
      activeSourceCount,
      outstandingWork,
      hottestSources,
      freshCount,
      warningCount,
      staleCount,
      collectionRows,
      coreSummaryTone,
      nextAction,
      collectionMotion,
      freshnessMotion,
      issueMotion,
      weakestCoverageSources,
      activeTimelines,
      effectiveSelectedSource,
      selectedTimeline,
      selectedCollectionRow,
      selectedSourceIssues,
      selectedFreshnessSource,
      selectedCoverageSource,
      focusSignalWall,
      focusCoverageSources,
      focusHottestSources,
      filteredRetryQueue,
      manualQueueCount,
      hardBlockedQueueCount,
      retryingQueueCount,
      pendingQueueCount,
      dueNowItems,
      hottestDueItem,
      nextScheduledItem,
      topManualItem,
      topHardBlockedItem,
    };
  }, [data, now, retryFocusMode, retryScope, retrySearchQuery, selectedSource]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(12,74,110,0.12),_transparent_26%),radial-gradient(circle_at_20%_20%,_rgba(8,145,178,0.08),_transparent_24%),linear-gradient(180deg,_#f8fbfd_0%,_#edf4f8_45%,_#f8fafc_100%)]">
      <div className="border-b border-slate-200/70 bg-[#061722] px-6 py-5 shadow-[0_20px_80px_rgba(6,23,34,0.3)]">
        <div className="mx-auto flex max-w-[1480px] items-center gap-4">
          <Link href="/" className="text-white/50 transition-colors hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-2xl border border-white/10 bg-cyan-400/10 p-2 backdrop-blur">
            <Eye className="h-6 w-6 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-[0.12em] text-white">The Watchtower</h1>
            <p className="text-sm text-slate-300">Command deck for live collection ops, data integrity, and morning closure</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] space-y-8 p-6 md:p-8">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {data && derived && !loading && (
          <>
            <section className="grid gap-4 lg:grid-cols-4">
              <CommandRailCard
                label="Act Now"
                value={String(derived.dueNowItems.length)}
                detail={
                  derived.dueNowItems.length > 0
                    ? `${formatSourceName(derived.hottestDueItem?.data_source || "retry")} ${derived.hottestDueItem?.property_name || derived.hottestDueItem?.property_id || "work"} is due now`
                    : derived.nextScheduledItem
                      ? `Next retry is ${formatDateTimeLabel(derived.nextScheduledItem.next_attempt_at)}`
                      : "No immediate retry work is queued right now"
                }
                tone={derived.dueNowItems.length > 0 ? "amber" : derived.nextScheduledItem ? "cyan" : "emerald"}
                icon={RefreshCw}
              />
              <CommandRailCard
                label="Manual Wait"
                value={String(derived.manualQueueCount)}
                detail={
                  derived.manualQueueCount > 0
                    ? `${formatSourceName(derived.topManualItem?.data_source || "manual source")} is waiting on delivery${derived.topManualItem?.property_name ? ` for ${derived.topManualItem.property_name}` : ""}`
                    : "No manual morning dependencies are holding the loop"
                }
                tone={derived.manualQueueCount > 0 ? "amber" : "emerald"}
                icon={Clock}
              />
              <CommandRailCard
                label="Hard Block"
                value={String(derived.hardBlockedQueueCount)}
                detail={
                  derived.hardBlockedQueueCount > 0
                    ? `${summarizeBlocker(derived.topHardBlockedItem!)} is the leading blocker on ${formatSourceName(derived.topHardBlockedItem?.data_source || "the queue")}`
                    : "No hard-blocked retry items are currently surfaced"
                }
                tone={derived.hardBlockedQueueCount > 0 ? "rose" : "emerald"}
                icon={ShieldAlert}
              />
              <CommandRailCard
                label="Closure Read"
                value={data.daily_collection_status.closure.state === "complete" ? "Closed" : data.daily_collection_status.closure.state === "open" ? "Open" : "Idle"}
                detail={
                  data.daily_collection_status.closure.state === "complete"
                    ? "Morning collection can move into steady-state monitoring"
                    : data.daily_collection_status.closure.state === "open"
                      ? "Day is still operationally open and should keep recovering"
                      : "Visible run family has not fully started yet"
                }
                tone={data.daily_collection_status.closure.state === "complete" ? "emerald" : data.daily_collection_status.closure.state === "open" ? "cyan" : "amber"}
                icon={Target}
              />
            </section>

            {derived.effectiveSelectedSource && (
              <section className="rounded-[26px] border border-cyan-200 bg-cyan-50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-700">Source Focus</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      Watchtower is focused on {formatSourceName(derived.effectiveSelectedSource)} across queue, drift, issues, and timeline context.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSource(null)}
                    className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-100"
                  >
                    Clear Focus
                  </button>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-[36px] border border-[#123846] bg-[#071924] text-white shadow-[0_40px_140px_rgba(7,25,36,0.38)]">
              <div className="grid xl:grid-cols-[1.18fr_0.82fr]">
                <div className="border-b border-white/10 p-6 md:p-8 xl:border-b-0 xl:border-r">
                  <div className="mb-5 flex flex-wrap items-center gap-3">
                    <Badge className={closureBadge(data.daily_collection_status.closure.state)}>
                      {data.daily_collection_status.closure.state === "complete"
                        ? "Day Closed"
                        : data.daily_collection_status.closure.state === "open"
                          ? "Recovery Loop Active"
                          : "Awaiting First Pass"}
                    </Badge>
                    <Badge className="border-0 bg-white/10 text-cyan-100">
                      {data.community_count} active properties
                    </Badge>
                    <Badge className="border-0 bg-white/10 text-cyan-100">
                      {data.data_sources.length} mirrored source lanes
                    </Badge>
                    <Badge className="border-0 bg-white/10 text-cyan-100">
                      Live auto-refresh every 60s
                    </Badge>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
                    <div>
                      <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/80">Watchtower Prime</p>
                      <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                        A live control room for the whole morning collection operation.
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                        This surface now blends closure state, partial results, retry pressure, freshness drift, and
                        integrity issues into one display-first operator view. It should read like instrumentation, not a report.
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.22em] text-slate-400">
                        <div className="flex items-center gap-2">
                          <TinyPulse tone={derived.coreSummaryTone} />
                          <span>Live tower clock {format(now, "h:mm:ss a")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Last sync {lastUpdated ? format(lastUpdated, "h:mm:ss a") : "Waiting"}</span>
                        </div>
                      </div>

                      <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <TowerReadout
                          label="Tower State"
                          value={data.daily_collection_status.closure.state === "complete" ? "Closed" : data.daily_collection_status.closure.state === "open" ? "Active" : "Idle"}
                          detail={`${data.daily_collection_status.summary.sources_completed}/${data.daily_collection_status.summary.sources_total} sources closed`}
                          tone={derived.coreSummaryTone}
                          icon={Shield}
                        />
                        <TowerReadout
                          label="Open Work"
                          value={String(derived.outstandingWork)}
                          detail={`${derived.activeSourceCount} source lane${derived.activeSourceCount === 1 ? "" : "s"} still open`}
                          tone={derived.outstandingWork === 0 ? "emerald" : derived.outstandingWork <= 10 ? "amber" : "rose"}
                          icon={TimerReset}
                        />
                        <TowerReadout
                          label="Issue Stack"
                          value={String(data.integrity_summary.top_issues.length)}
                          detail="Highest-signal active integrity items on deck"
                          tone={data.integrity_summary.top_issues.length === 0 ? "emerald" : "amber"}
                          icon={Siren}
                        />
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.12),_transparent_48%),linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operations Core</p>
                          <p className="mt-1 text-sm text-slate-300">Immediate guidance for the current morning state</p>
                        </div>
                        <Sparkles className="h-5 w-5 text-cyan-200" />
                      </div>
                      <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                        <div className="mb-4 flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${derived.coreSummaryTone === "emerald" ? "bg-emerald-400" : derived.coreSummaryTone === "amber" ? "bg-amber-400" : "bg-rose-400"} shadow-[0_0_20px_rgba(255,255,255,0.18)]`} />
                          <p className="text-sm font-medium text-white">{derived.nextAction}</p>
                        </div>
                        <div className="grid gap-3 text-sm text-slate-300">
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <span className="text-slate-400">Unresolved sources</span>
                            <span className="font-semibold text-white">
                              {data.daily_collection_status.closure.unresolved_sources.length > 0
                                ? data.daily_collection_status.closure.unresolved_sources.length
                                : "0"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <span className="text-slate-400">Fresh lanes</span>
                            <span className="font-semibold text-white">{derived.freshCount}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <span className="text-slate-400">Warnings / stale</span>
                            <span className="font-semibold text-white">{derived.warningCount} / {derived.staleCount}</span>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Seven-Day Collection Motion</p>
                            <Activity className="h-4 w-4 text-cyan-300" />
                          </div>
                          <MicroSparkline values={derived.collectionMotion} tone="cyan" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 lg:grid-cols-4">
                    <MetricDial
                      label="Coverage"
                      value={data.health_score}
                      subtitle={`${data.filled_cells.toLocaleString()} of ${data.total_cells.toLocaleString()} matrix cells filled`}
                      icon={Gauge}
                    />
                    <MetricDial
                      label="Closure"
                      value={derived.collectionCompletion}
                      subtitle={`${data.daily_collection_status.summary.properties_succeeded}/${data.daily_collection_status.summary.properties_expected} property actions resolved`}
                      icon={RefreshCw}
                    />
                    <MetricDial
                      label="Freshness"
                      value={derived.freshnessStability}
                      subtitle={`${derived.freshCount}/${derived.sourceSignals.length} source signals fresh`}
                      icon={Radar}
                    />
                    <MetricDial
                      label="Pressure"
                      value={derived.issuePressure}
                      subtitle={`${data.integrity_summary.core_failure_sources} core failures, ${data.integrity_summary.freshness_stale_sources} stale sources`}
                      icon={Target}
                    />
                  </div>

                  <div className="mt-8 rounded-[30px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signal Rail</p>
                        <p className="mt-1 text-sm text-slate-300">Live visual rollup of mirrored source freshness</p>
                      </div>
                      <Orbit className="h-5 w-5 text-cyan-200" />
                    </div>
                    <PulseRail values={derived.sourceSignals} />
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <div className="grid gap-4">
                    <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur">
                      <CardContent className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tower Heat</p>
                            <p className="mt-1 text-sm text-slate-300">Where operator attention should go first</p>
                          </div>
                          <Flame className="h-5 w-5 text-amber-300" />
                        </div>
                        <div className="space-y-3">
                          {derived.focusHottestSources.map((src) => {
                            const info = freshnessInfo(src);
                            return (
                              <div key={src.source_key} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{src.source_label}</p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {src.latest_date ? format(parseISO(src.latest_date), "MMM d, yyyy") : "No data yet"}
                                    </p>
                                  </div>
                                  <Badge className={`${info.bg} ${info.color} border-0`}>{info.label}</Badge>
                                </div>
                                <MiniBar value={Math.max(8, 100 - Math.max(0, (src.age_days ?? 0) * 14))} tone={info.tone === "fresh" ? "emerald" : info.tone === "warning" ? "amber" : "rose"} />
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur">
                      <CardContent className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">System Lights</p>
                            <p className="mt-1 text-sm text-slate-300">Fast color reads across the tower</p>
                          </div>
                          <Binary className="h-5 w-5 text-cyan-200" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200">Fresh</p>
                            <p className="mt-2 text-3xl font-bold text-white">{derived.freshCount}</p>
                          </div>
                          <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200">Warnings</p>
                            <p className="mt-2 text-3xl font-bold text-white">{derived.warningCount}</p>
                          </div>
                          <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-rose-200">Stale / Missing</p>
                            <p className="mt-2 text-3xl font-bold text-white">{derived.staleCount}</p>
                          </div>
                          <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Active Sources</p>
                            <p className="mt-2 text-3xl font-bold text-white">{data.daily_collection_status.summary.sources_active}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Source Coverage Pulse</p>
                            <Radar className="h-4 w-4 text-cyan-200" />
                          </div>
                          <MicroSparkline values={derived.freshnessMotion} tone="emerald" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur">
                      <CardContent className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Collection Constellation</p>
                            <p className="mt-1 text-sm text-slate-300">Every source lane as a single tower node</p>
                          </div>
                          <Orbit className="h-5 w-5 text-cyan-200" />
                        </div>
                        <CollectionConstellation rows={derived.collectionRows.slice(0, 9)} />
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur">
                      <CardContent className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Top Issues</p>
                            <p className="mt-1 text-sm text-slate-300">Highest-signal integrity events currently surfaced</p>
                          </div>
                          <AlertTriangle className="h-5 w-5 text-rose-300" />
                        </div>
                        <div className="space-y-3">
                          {(derived.effectiveSelectedSource ? derived.selectedSourceIssues : data.integrity_summary.top_issues).length === 0 ? (
                            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                              {derived.effectiveSelectedSource
                                ? "No active top-issue entries are currently surfaced for the selected source."
                                : "No active integrity issues are currently surfaced."}
                            </div>
                          ) : (
                            (derived.effectiveSelectedSource ? derived.selectedSourceIssues : data.integrity_summary.top_issues).map((issue, idx) => (
                              <div key={`${issue.kind}-${issue.source}-${idx}`} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{formatSourceName(issue.source)}</p>
                                    <p className="mt-1 text-sm text-slate-300">{issue.message}</p>
                                  </div>
                                  <Badge className={issue.kind === "core_failure" ? "border-0 bg-red-100 text-red-700" : "border-0 bg-amber-100 text-amber-700"}>
                                    {issue.kind === "core_failure" ? "Core" : "Freshness"}
                                  </Badge>
                                </div>
                                {issue.timestamp && (
                                  <p className="mt-3 text-xs text-slate-500">{format(parseISO(issue.timestamp), "MMM d, yyyy h:mm a")}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Seven-Day Issue Motion</p>
                            <AlertTriangle className="h-4 w-4 text-rose-300" />
                          </div>
                          <MicroSparkline values={derived.issueMotion} tone={data.integrity_summary.top_issues.length === 0 ? "emerald" : "rose"} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.08),_transparent_50%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,250,252,0.96))] px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Today&apos;s Collection Deck</h2>
                          <p className="mt-1 text-xs text-slate-500">Source pods, retry pressure, and current operator context</p>
                        </div>
                      </div>
                      <Badge className={closureBadge(data.daily_collection_status.closure.state)}>
                        {data.daily_collection_status.closure.state === "complete" ? "Day Closed" : data.daily_collection_status.closure.state === "open" ? "Still Working" : "Pending"}
                      </Badge>
                    </div>
                  </div>

                    <div className="grid gap-4 border-b border-slate-100 bg-slate-50/70 p-5 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: "Sources Complete",
                        value: `${data.daily_collection_status.summary.sources_completed}/${data.daily_collection_status.summary.sources_total}`,
                        tone: "text-emerald-700",
                        icon: CheckCircle2,
                      },
                      {
                        label: "Sources Active",
                        value: String(data.daily_collection_status.summary.sources_active),
                        tone: "text-amber-700",
                        icon: Activity,
                      },
                      {
                        label: "Properties Closed",
                        value: `${data.daily_collection_status.summary.properties_succeeded}/${data.daily_collection_status.summary.properties_expected}`,
                        tone: "text-slate-900",
                        icon: Database,
                      },
                      {
                        label: "Blocked Sources",
                        value: String(data.daily_collection_status.summary.sources_blocked),
                        tone: "text-rose-700",
                        icon: ShieldAlert,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                            <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-100 p-3">
                            <item.icon className="h-5 w-5 text-[#0D5E6D]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-slate-100 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Retry Queue Board</h3>
                        <p className="mt-1 text-xs text-slate-500">Live unresolved retry items from the canonical morning loop</p>
                      </div>
                      <Badge className={data.telemetry.retry_queue.queue_depth > 0 ? "border-0 bg-amber-100 text-amber-700" : "border-0 bg-emerald-100 text-emerald-700"}>
                        {data.telemetry.retry_queue.queue_depth} open
                      </Badge>
                    </div>
                    <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search retry items..."
                          value={retrySearchQuery}
                          onChange={(e) => setRetrySearchQuery(e.target.value)}
                          className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-[#0D5E6D]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRetryFocusMode((value) => !value)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${retryFocusMode ? "bg-[#0D5E6D] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                      >
                        {retryFocusMode ? "Focus Mode On" : "Focus Mode"}
                      </button>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {[
                        { key: "all", label: "All Open" },
                        { key: "core", label: "Core Only" },
                        { key: "manual_dependency", label: "Manual" },
                        { key: "hard_blocked", label: "Hard Blocked" },
                        { key: "retrying", label: "Retrying" },
                      ].map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setRetryScope(option.key as typeof retryScope)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                            retryScope === option.key
                              ? "bg-[#0D5E6D] text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="mb-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Pending</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{data.telemetry.retry_queue.by_status.pending ?? 0}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Retrying</p>
                        <p className="mt-2 text-2xl font-bold text-cyan-700">{data.telemetry.retry_queue.by_status.retrying ?? 0}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Manual Dependency</p>
                        <p className="mt-2 text-2xl font-bold text-amber-700">{data.telemetry.retry_queue.by_disposition.manual_dependency ?? 0}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Hard Blocked</p>
                        <p className="mt-2 text-2xl font-bold text-rose-700">{data.telemetry.retry_queue.by_disposition.hard_blocked ?? 0}</p>
                      </div>
                    </div>
                    {derived.filteredRetryQueue.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                        {data.telemetry.retry_queue.items.length === 0
                          ? "Retry queue is clear for today. No unresolved queue items are currently open."
                          : "No retry items match the current operator filters."}
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {derived.filteredRetryQueue.slice(0, 8).map((item) => (
                          <RetryQueueItemCard key={item.queue_id} item={item} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    {derived.collectionRows.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                        No collection runs have been recorded for today yet.
                      </div>
                    ) : (
                      derived.collectionRows.map((row) => (
                        <CollectionStageCard key={`${row.source}-${row.started_at ?? "pending"}`} row={row} />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Seven-Day Recovery Tape</h3>
                          <p className="mt-1 text-xs text-slate-500">Actual recent collection history from canonical run records</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <RecoveryTape points={data.telemetry.collection_history} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Source Timeline Lanes</h3>
                          <p className="mt-1 text-xs text-slate-500">Each core lane across the recent collection window</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 p-5">
                      {derived.activeTimelines.map((timeline) => (
                        <SourceTimelineLane
                          key={timeline.source}
                          timeline={timeline}
                          selected={derived.effectiveSelectedSource === timeline.source}
                          onSelect={setSelectedSource}
                        />
                      ))}
                      {derived.selectedTimeline && (
                        <div className="rounded-[26px] border border-[#0D5E6D]/20 bg-gradient-to-br from-cyan-50 to-white p-5">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Source Drill-In</p>
                              <h4 className="mt-1 text-lg font-semibold text-slate-900">{formatSourceName(derived.selectedTimeline.source)}</h4>
                            </div>
                            <Badge className={collectionStatusBadge(derived.selectedCollectionRow?.status ?? derived.selectedTimeline.points[derived.selectedTimeline.points.length - 1]?.status ?? "unknown")}>
                              {collectionStatusLabel(derived.selectedCollectionRow?.status ?? derived.selectedTimeline.points[derived.selectedTimeline.points.length - 1]?.status ?? "unknown")}
                            </Badge>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-[22px] bg-white p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current Progress</p>
                              <p className="mt-2 text-2xl font-bold text-slate-900">
                                {derived.selectedCollectionRow ? `${derived.selectedCollectionRow.success_count}/${derived.selectedCollectionRow.total_count || 0}` : "No live row"}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {derived.selectedCollectionRow ? `${derived.selectedCollectionRow.retry_attempts} retries • ${derived.selectedCollectionRow.rate_limit_hits} rate limits` : "Using recent timeline only"}
                              </p>
                            </div>
                            <div className="rounded-[22px] bg-white p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open Queue</p>
                              <p className="mt-2 text-2xl font-bold text-slate-900">{derived.filteredRetryQueue.length}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {derived.filteredRetryQueue[0]?.next_attempt_at
                                  ? `Next ${formatDateTimeLabel(derived.filteredRetryQueue[0].next_attempt_at)}`
                                  : "No queued retry timing logged"}
                              </p>
                            </div>
                            <div className="rounded-[22px] bg-white p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Issue Surface</p>
                              <p className="mt-2 text-2xl font-bold text-slate-900">{derived.selectedSourceIssues.length}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {derived.selectedSourceIssues[0]?.message ?? "No top-issue entries for this source"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="rounded-[22px] bg-white p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live Notes</p>
                              <p className="mt-2 text-sm text-slate-700">
                                {derived.selectedCollectionRow?.notes || derived.selectedCollectionRow?.error_message || "No live collection note is attached to this source."}
                              </p>
                              {derived.selectedCollectionRow?.source === "google_ads" && parseGoogleAdsOutcomeNotes(derived.selectedCollectionRow?.notes ?? null) && (
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                                  {(() => {
                                    const outcomes = parseGoogleAdsOutcomeNotes(derived.selectedCollectionRow?.notes ?? null);
                                    if (!outcomes) return null;
                                    return (
                                      <>
                                        <div className="rounded-2xl bg-emerald-50 p-2">
                                          <p className="uppercase tracking-[0.16em] text-emerald-700">Active</p>
                                          <p className="mt-1 font-bold text-emerald-800">{outcomes.active}</p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-100 p-2">
                                          <p className="uppercase tracking-[0.16em] text-slate-500">No Activity</p>
                                          <p className="mt-1 font-bold text-slate-800">{outcomes.noActivity}</p>
                                        </div>
                                        <div className="rounded-2xl bg-rose-50 p-2">
                                          <p className="uppercase tracking-[0.16em] text-rose-700">Retryable</p>
                                          <p className="mt-1 font-bold text-rose-800">{outcomes.retryable}</p>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                            <div className="rounded-[22px] bg-white p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent Queue Signal</p>
                              <p className="mt-2 text-sm text-slate-700">
                                {derived.filteredRetryQueue[0]?.last_error_message
                                  || derived.filteredRetryQueue[0]?.notes
                                  || "No retry-queue message is currently attached to this source."}
                              </p>
                            </div>
                          </div>
                          {sourceRunbook(derived.effectiveSelectedSource) && (
                            <div className="mt-4 rounded-[24px] border border-cyan-200 bg-cyan-50/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-700">Runbook Hint</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{sourceRunbook(derived.effectiveSelectedSource)?.owner}</p>
                                </div>
                                <Badge className="border-0 bg-cyan-100 text-cyan-700">Guidance</Badge>
                              </div>
                              <div className="mb-3 flex flex-wrap gap-2">
                                {sourceActionChips(derived.effectiveSelectedSource, derived.filteredRetryQueue[0] ?? null).map((chip) => (
                                  <span
                                    key={chip}
                                    className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700"
                                  >
                                    {chip}
                                  </span>
                                ))}
                              </div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-[20px] bg-white p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">First Step</p>
                                  <p className="mt-2 text-sm text-slate-700">{sourceRunbook(derived.effectiveSelectedSource)?.firstStep}</p>
                                </div>
                                <div className="rounded-[20px] bg-white p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Escalation</p>
                                  <p className="mt-2 text-sm text-slate-700">{sourceRunbook(derived.effectiveSelectedSource)?.escalation}</p>
                                </div>
                                <div className="rounded-[20px] bg-white p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Watch For</p>
                                  <p className="mt-2 text-sm text-slate-700">{sourceRunbook(derived.effectiveSelectedSource)?.watchFor}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Siren className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Integrity Radar</h3>
                          <p className="mt-1 text-xs text-slate-500">Core failures, specialty noise, and freshness pressure</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 p-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[26px] bg-red-50 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-red-700">Core Failures</p>
                              <p className="mt-2 text-3xl font-bold text-red-700">{data.integrity_summary.core_failure_sources}</p>
                            </div>
                            <ShieldAlert className="h-6 w-6 text-red-500" />
                          </div>
                        </div>
                        <div className="rounded-[26px] bg-amber-50 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Specialty Noise</p>
                              <p className="mt-2 text-3xl font-bold text-amber-700">{data.integrity_summary.specialty_failure_sources}</p>
                            </div>
                            <Wrench className="h-6 w-6 text-amber-500" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-[24px] bg-slate-100 p-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Warnings</p>
                          <p className="mt-1 text-2xl font-bold text-amber-700">{data.integrity_summary.freshness_warning_sources}</p>
                        </div>
                        <div className="rounded-[24px] bg-slate-100 p-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Stale</p>
                          <p className="mt-1 text-2xl font-bold text-rose-700">{data.integrity_summary.freshness_stale_sources}</p>
                        </div>
                      </div>
                      <div className="rounded-[26px] border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pressure Track</p>
                          <span className="text-sm font-semibold text-slate-700">{derived.issuePressure}% stable</span>
                        </div>
                        <MiniBar value={derived.issuePressure} tone={derived.issuePressure >= 70 ? "emerald" : derived.issuePressure >= 45 ? "amber" : "rose"} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <ScanSearch className="h-5 w-5 text-[#0D5E6D]" />
                    <h2 className="text-lg font-bold text-slate-900">Source Signal Wall</h2>
                    <span className="text-xs text-slate-400">
                      {derived.effectiveSelectedSource ? "Focused source view" : "Expectation-aware freshness cards"}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {derived.focusSignalWall.map((src) => (
                      <SourceSignalCard key={src.source_key} src={src} />
                    ))}
                  </div>
                </div>

                <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ScanSearch className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Source Coverage Drift</h3>
                          <p className="mt-1 text-xs text-slate-500">Recent per-source coverage history from the real mirrored tables</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 p-5 md:grid-cols-2">
                      {derived.focusCoverageSources.map((source) => (
                        <CoverageDriftCard key={source.source_key} source={source} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Coverage Matrix</h2>
                          <p className="mt-1 text-xs text-slate-500">Portfolio-wide source presence by property</p>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter properties..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-[#0D5E6D]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Property
                          </th>
                          {data.data_sources.map((src) => (
                            <th key={src.key} className="px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 whitespace-nowrap">
                              {src.label.length > 10 ? src.key.toUpperCase() : src.label}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMatrix.map((row) => {
                          const filled = Object.values(row.sources).filter(Boolean).length;
                          const total = data.data_sources.length;
                          const pct = Math.round((filled / total) * 100);
                          const rowColor = pct === 100 ? "bg-white" : pct >= 50 ? "bg-amber-50/30" : "bg-rose-50/30";
                          return (
                            <tr key={row.community_id} className={rowColor}>
                              <td className="sticky left-0 z-10 bg-inherit px-4 py-2 text-sm font-medium text-slate-900 whitespace-nowrap">
                                <Link href={`/pib/property?id=${row.community_id}`} className="transition-colors hover:text-[#0D5E6D] hover:underline">
                                  {row.community_name}
                                </Link>
                              </td>
                              {data.data_sources.map((src) => (
                                <td key={src.key} className="px-2 py-2 text-center">
                                  {row.sources[src.key] ? (
                                    <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    </div>
                                  ) : (
                                    <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
                                      <XCircle className="h-4 w-4 text-slate-300" />
                                    </div>
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${pct === 100 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                                  {filled}/{total}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-5 py-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Data present</div>
                    <div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-slate-300" /> Missing</div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5" />
                      Showing {filteredMatrix.length} of {data.coverage_matrix.length} properties
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-[#0D5E6D]" />
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Table Telemetry</h2>
                          <p className="mt-1 text-xs text-slate-500">Mirror table counts, date range, and latest coverage</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 p-5">
                      {data.table_stats.map((stat) => {
                        const info = freshnessInfo(stat);
                        const covPct = data.community_count > 0 ? Math.round((stat.latest_coverage / data.community_count) * 100) : 0;
                        return (
                          <div key={stat.key} className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{stat.label}</p>
                                <p className="mt-1 text-xs text-slate-500">{stat.latest_date ? format(parseISO(stat.latest_date), "MMM d, yyyy") : "No data yet"}</p>
                              </div>
                              <Badge className={`${info.bg} ${info.color} border-0`}>{info.label}</Badge>
                            </div>
                            <div className="space-y-3">
                              <MiniBar value={covPct} tone={covPct >= 90 ? "emerald" : covPct >= 50 ? "amber" : "rose"} />
                              <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="rounded-2xl bg-slate-50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Rows</p>
                                  <p className="mt-1 font-bold text-slate-800">{stat.row_count.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Weeks</p>
                                  <p className="mt-1 font-bold text-slate-800">{stat.distinct_weeks}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Coverage</p>
                                  <p className="mt-1 font-bold text-slate-800">{stat.latest_coverage}/{data.community_count}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-[#0D5E6D]" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Closure Context</h3>
                        <p className="mt-1 text-xs text-slate-500">Operational closure hints from the current collection state</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-[24px] bg-slate-100 p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Summary Reason</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{formatSourceName(data.daily_collection_status.closure.summary_reason)}</p>
                      </div>
                      <div className="rounded-[24px] bg-slate-100 p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Unresolved Sources</p>
                        {data.daily_collection_status.closure.unresolved_sources.length === 0 ? (
                          <p className="mt-2 text-sm font-medium text-emerald-700">None. The visible run family is closed.</p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {data.daily_collection_status.closure.unresolved_sources.map((source) => (
                              <Badge key={source} className="border-0 bg-amber-100 text-amber-700">
                                {formatSourceName(source)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
