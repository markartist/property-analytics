"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPondInsights, type PondInsight, type PondSurface } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { getFeaturedOfferings, getRoleTitle, type AppRole, type SurfaceId } from "@/lib/permissions";
import {
  Anchor, Eye, Fish,
  TrendingUp, TrendingDown, AlertTriangle, Trophy, Zap, BarChart3,
  Loader2, Waves, Clock, Database, Gauge,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

// ────────────────────────────────────────────────────────────────
// Insight icon resolver
// ────────────────────────────────────────────────────────────────

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  alert: AlertTriangle,
  trophy: Trophy,
  zap: Zap,
  "bar-chart": BarChart3,
};

const INSIGHT_COLORS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  red: "bg-red-100 text-red-700 border-red-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
};

const INSIGHT_ICON_COLORS: Record<string, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  teal: "text-teal-600",
  blue: "text-blue-600",
};

// ────────────────────────────────────────────────────────────────
// Zone cards config
// ────────────────────────────────────────────────────────────────

const FEATURED_ZONE_DECOR: Record<
  SurfaceId,
  { kicker: string; title: string; subtitle: string; description: string; gradient: string; iconBg: string; icon: React.ElementType }
> = {
  pond: {
    kicker: "Browse",
    title: "The Pond",
    subtitle: "Survey the surface",
    description: "Portfolio-wide landing lane for governed signals, orientation, and next moves.",
    gradient: "from-[#1a355d] to-[#1f4772]",
    iconBg: "bg-white/18",
    icon: Waves,
  },
  watchtower: {
    kicker: "Monitor",
    title: "The Watchtower",
    subtitle: "Check the pulse",
    description: "System health, data freshness, coverage matrix, and pipeline status at a glance.",
    gradient: "from-[#0D5E6D] to-[#0a4a56]",
    iconBg: "bg-white/18",
    icon: Eye,
  },
  dock: {
    kicker: "Browse",
    title: "The Dock",
    subtitle: "Browse your reports",
    description: "PIB dashboards, leasing funnels, marketing data, and portfolio analysis — all in one place.",
    gradient: "from-[#15284B] to-[#1e3a5f]",
    iconBg: "bg-white/18",
    icon: Anchor,
  },
  fish: {
    kicker: "Ask",
    title: "The Fishing Hole",
    subtitle: "Ask anything",
    description: "Cast a question into the pond — get answers, reports, CSVs, or email summaries powered by AI.",
    gradient: "from-[#15803D] to-[#166534]",
    iconBg: "bg-white/18",
    icon: Fish,
  },
  tracker: {
    kicker: "Track",
    title: "Pilot Tracker",
    subtitle: "Watch pilots move",
    description: "Follow pilot and paired-lane movement without leaving the governed platform.",
    gradient: "from-[#4f46e5] to-[#3343b5]",
    iconBg: "bg-white/18",
    icon: Gauge,
  },
  popBrief: {
    kicker: "Brief",
    title: "POP Brief",
    subtitle: "Read the portfolio story",
    description: "Move directly into governed briefing and performance interpretation.",
    gradient: "from-[#7c3aed] to-[#5b21b6]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  pibBuilder: {
    kicker: "Build",
    title: "PIB Builder",
    subtitle: "Shape a property brief",
    description: "Open the PIB workflow and work directly with the canonical briefing lane.",
    gradient: "from-[#1d4ed8] to-[#1e40af]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  searchIntelligence: {
    kicker: "Search",
    title: "Search Intelligence",
    subtitle: "Read the search picture",
    description: "Inspect search signals, positioning, and governed search insight.",
    gradient: "from-[#0f766e] to-[#115e59]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  gbpPosts: {
    kicker: "Local",
    title: "GBP Posts",
    subtitle: "Operate local posts",
    description: "Manage governed local-posting work without leaving the Pond.",
    gradient: "from-[#0f766e] to-[#0b5b57]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  gscReport: {
    kicker: "Search",
    title: "GSC Report",
    subtitle: "Review visibility",
    description: "Open Search Console-driven reporting and trend visibility.",
    gradient: "from-[#2563eb] to-[#1d4ed8]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  intelligenceOffice: {
    kicker: "Guide",
    title: "Intelligence Office",
    subtitle: "Set editorial direction",
    description: "Admin-owned guidance, claims, and directives workspace.",
    gradient: "from-[#6d28d9] to-[#5b21b6]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  siteContent: {
    kicker: "Content",
    title: "Site Content Creator",
    subtitle: "Run governed rewrites",
    description: "Map, assess, and rewrite site sections in the governed content lane.",
    gradient: "from-[#0D5E6D] to-[#136878]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  vacs: {
    kicker: "Execute",
    title: "VACS",
    subtitle: "Drive content execution",
    description: "Machine-first content execution lane with governed bridge posture.",
    gradient: "from-[#1f2937] to-[#111827]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  evs: {
    kicker: "Validate",
    title: "EVS",
    subtitle: "Review validation work",
    description: "Validation requests, handoff posture, and governed review.",
    gradient: "from-[#1d4ed8] to-[#0f3aa7]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  controlPlane: {
    kicker: "Govern",
    title: "Control Plane",
    subtitle: "Inspect the architecture",
    description: "Admin-only landscape, trust, and consolidation surface.",
    gradient: "from-[#394867] to-[#243248]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  backup: {
    kicker: "Export",
    title: "Backup & Export",
    subtitle: "Move governed outputs",
    description: "Operational export and backup tooling.",
    gradient: "from-[#334155] to-[#1e293b]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
  adminUsers: {
    kicker: "Admin",
    title: "Admin",
    subtitle: "Manage platform access",
    description: "User and administrative control surface.",
    gradient: "from-[#475569] to-[#334155]",
    iconBg: "bg-white/18",
    icon: BarChart3,
  },
};

// ────────────────────────────────────────────────────────────────
// Freshness helpers
// ────────────────────────────────────────────────────────────────

function freshnessAge(dateStr: string | null): { label: string; color: string } {
  if (!dateStr) return { label: "No data", color: "text-red-500" };
  const age = Date.now() - parseISO(dateStr).getTime();
  const days = Math.floor(age / 86400000);
  if (days <= 7) return { label: `${days}d ago`, color: "text-emerald-600" };
  if (days <= 14) return { label: `${days}d ago`, color: "text-amber-600" };
  return { label: `${days}d ago`, color: "text-red-600" };
}

// Labels for source freshness keys (from data_freshness table)
const SOURCE_LABELS: Record<string, string> = {
  ga4: "GA4 Traffic",
  ga4_sources: "Traffic Sources",
  gsc: "Search (GSC)",
  google_ads: "Google Ads",
  ads_keywords: "Ads Keywords",
  pagespeed: "PageSpeed",
  semrush: "SEMRush",
  gbp_reviews: "GBP Reviews",
  availability: "Availability",
  guest_cards: "Guest Cards",
};

// Fallback labels for D1 table keys
const TABLE_LABELS: Record<string, string> = {
  ga4: "GA4 Traffic",
  site_perf: "Site Perf",
  local_presence: "GBP",
  search: "Search (GSC)",
  cir: "CIR",
  reviews: "Reviews",
  marketing: "Marketing",
  t7: "T7 Leasing",
  t30: "T30 Leasing",
};

const ROLE_EXPERIENCE: Record<AppRole, {
  eyebrow: string;
  summary: string;
  operatorFlow: Array<{ title: string; detail: string }>;
  quickLinks: Array<{ href: string; label: string }>;
}> = {
  viewer: {
    eyebrow: "Observer lane",
    summary: "Stay oriented. Watch the system, browse the governed outputs, and move quickly into the reports that matter.",
    operatorFlow: [
      { title: "Watch the platform", detail: "Use Watchtower to see health, freshness, closure state, and trust pressure." },
      { title: "Browse the outputs", detail: "Use the Dock to move through briefs, dashboards, and governed reporting lanes." },
      { title: "Ask for what you need", detail: "Use Fishing Hole when you want answers, exports, or guided next moves." },
    ],
    quickLinks: [
      { href: "/watchtower", label: "Open Watchtower" },
      { href: "/dock", label: "Browse The Dock" },
      { href: "/fish", label: "Ask Fishing Hole" },
    ],
  },
  editor: {
    eyebrow: "Curator lane",
    summary: "Operate the active workflows. Move from governed reporting into search, local, content, and validation execution.",
    operatorFlow: [
      { title: "Start from the signal", detail: "Use Watchtower and The Dock to understand what changed before taking action." },
      { title: "Work the operating lanes", detail: "Move into search, local, VACS, or EVS with governed context already attached." },
      { title: "Close the loop", detail: "Use Fishing Hole when you need exports, synthesis, or a guided next move." },
    ],
    quickLinks: [
      { href: "/dock", label: "Browse The Dock" },
      { href: "/analysis/search-intelligence", label: "Open Search Intelligence" },
      { href: "/evs", label: "Review EVS" },
    ],
  },
  admin: {
    eyebrow: "Steward lane",
    summary: "Shape the governed system. Maintain directives, steward content operations, and inspect the platform from the toolbox tier.",
    operatorFlow: [
      { title: "Read the platform posture", detail: "Start with Watchtower to understand operational and trust pressure before intervening." },
      { title: "Guide the governed lanes", detail: "Use Intelligence Office and Site Content to shape claims, directives, and rewrite work." },
      { title: "Use the toolbox deliberately", detail: "Open Control Plane and Admin only when system ownership or remediation work is needed." },
    ],
    quickLinks: [
      { href: "/watchtower", label: "Open Watchtower" },
      { href: "/site-content", label: "Open Site Content" },
      { href: "/system", label: "Open Control Plane" },
    ],
  },
};

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function DataPondLanding() {
  const { user } = useAuth();
  const [insights, setInsights] = React.useState<PondInsight[]>([]);
  const [surface, setSurface] = React.useState<PondSurface | null>(null);
  const [loading, setLoading] = React.useState(true);
  const featuredZones = React.useMemo(() => {
    const offerings = getFeaturedOfferings(user?.role).length
      ? getFeaturedOfferings(user?.role)
      : getFeaturedOfferings("viewer");

    const base = offerings
      .map((offering) => {
        const decor = FEATURED_ZONE_DECOR[offering.id];
        return {
          key: offering.id,
          href: offering.href,
          ...decor,
        };
      })
      .slice(0, 3);

    return base;
  }, [user?.role]);
  const roleProfile = ROLE_EXPERIENCE[user?.role ?? "viewer"];

  React.useEffect(() => {
    getPondInsights()
      .then((insightData) => {
        setInsights(insightData.insights);
        setSurface(insightData.surface);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-slate-200/50">
        {/* Pond scene background */}
        <div className="absolute inset-0">
          <Image
            src="/pond-scene.svg"
            alt=""
            fill
            className="object-cover object-bottom"
            priority
          />
        </div>

        {/* Content overlay */}
        <div className="relative z-10 px-6 pb-10 pt-10 md:px-12 md:pb-14 md:pt-14">
          <div className="mx-auto grid max-w-[1400px] gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              {user && (
                <Badge className="border-white/20 bg-white/10 text-white/85 backdrop-blur-sm">
                  {getRoleTitle(user.role)} access
                </Badge>
              )}
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-white/55">
                {roleProfile.eyebrow}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/55">
                Monitor. Browse. Ask.
              </p>
              <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] text-white md:text-6xl">
                The Data Pond
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-white/72">
                Your analytics resort. Browse reports, monitor system health, or cast a question into the pond and reel in an answer.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
                {roleProfile.summary}
              </p>

              {surface && (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Badge className="border-white/20 bg-white/10 text-white/90 text-xs py-1 px-3 backdrop-blur-sm">
                    <Database className="mr-1.5 h-3 w-3" />
                    {surface.community_count} Properties
                  </Badge>
                  <Badge className="border-white/20 bg-white/10 text-white/90 text-xs py-1 px-3 backdrop-blur-sm">
                    <Clock className="mr-1.5 h-3 w-3" />
                    Latest: {surface.latest_snapshot
                      ? formatDistanceToNow(parseISO(surface.latest_snapshot), { addSuffix: true })
                      : "—"}
                  </Badge>
                  <Badge className="border-white/20 bg-white/10 text-white/90 text-xs py-1 px-3 backdrop-blur-sm">
                    <Waves className="mr-1.5 h-3 w-3" />
                    9 Data Sources
                  </Badge>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {roleProfile.quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center rounded-full border border-white/16 bg-white/8 px-3 py-2 text-xs font-semibold text-white/88 backdrop-blur-sm hover:bg-white/14"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden xl:block">
              <div className="rounded-[24px] border border-white/14 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] p-6 shadow-[0_30px_80px_rgba(8,15,32,0.18)] backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">Operator flow</p>
                <div className="mt-4 grid gap-3">
                  {roleProfile.operatorFlow.map((step) => (
                    <div key={step.title} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/60">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] space-y-8 px-6 py-8 md:px-12">

        {/* Zone Cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredZones.map((zone) => (
            <Link key={zone.key} href={zone.href} className="group">
              <div
                className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${zone.gradient} p-6 shadow-[0_18px_50px_rgba(15,23,42,0.14)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_22px_60px_rgba(15,23,42,0.18)]`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`inline-flex rounded-2xl ${zone.iconBg} p-3`}>
                    <zone.icon className="h-7 w-7 text-white" />
                  </div>
                  <span className="rounded-full border border-white/14 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
                    {zone.kicker}
                  </span>
                </div>
                <h2 className="mt-5 text-[30px] font-black leading-none tracking-[-0.04em] text-white">{zone.title}</h2>
                <p className="mt-2 text-sm font-medium text-white/72">{zone.subtitle}</p>
                <p className="mt-4 max-w-sm text-sm leading-7 text-white/55">{zone.description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/46 transition-colors group-hover:text-white/74">
                  Enter lane
                  <span className="text-sm">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Card className="overflow-hidden rounded-[24px] border-[#0D5E6D]/20 bg-gradient-to-r from-[#0D5E6D]/5 to-[#15803D]/5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0D5E6D]/70">Briefing shortcut</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Need a PIB fast?</p>
              <p className="mt-1 text-sm text-slate-600">Open the PIB dashboard and drill into your standard PIB sections.</p>
            </div>
            <Link
              href="/pib"
              className="inline-flex items-center rounded-xl bg-[#0D5E6D] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-[#0a4d59]"
            >
              Open PIB
            </Link>
          </CardContent>
        </Card>

        {/* Catch of the Day */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Fish className="h-5 w-5 text-[#0D5E6D]" />
            <h2 className="text-lg font-bold text-slate-900">Catch of the Day</h2>
            <span className="text-xs text-slate-400 ml-1">Auto-generated insights from your latest data</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : insights.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-400">
                No insights yet — data will appear after your first PIB snapshot.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight) => {
                const Icon = INSIGHT_ICONS[insight.icon] ?? Zap;
                const colorCls = INSIGHT_COLORS[insight.color] ?? INSIGHT_COLORS.teal;
                const iconColor = INSIGHT_ICON_COLORS[insight.color] ?? "text-teal-600";
                return (
                  <Card key={insight.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-lg border p-2 ${colorCls}`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {insight.title}
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                            {insight.detail}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Data Freshness */}
        {surface && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Waves className="h-5 w-5 text-[#0D5E6D]" />
              <h2 className="text-lg font-bold text-slate-900">Surface Conditions</h2>
              <span className="text-xs text-slate-400 ml-1">Actual data freshness across all sources</span>
            </div>
            <Card>
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-5">
                  {Object.entries(surface.freshness).map(([key, dateStr]) => {
                    const label = SOURCE_LABELS[key] ?? TABLE_LABELS[key] ?? key;
                    const { label: ageLabel, color } = freshnessAge(dateStr);
                    return (
                      <div key={key} className="text-center">
                        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
                        <p className={`mt-1 text-sm font-bold tabular-nums ${color}`}>
                          {ageLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick links footer */}
        <div className="border-t border-slate-200 pt-6 pb-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <Link href="/pib" className="hover:text-[#0D5E6D] transition-colors">PIB Dashboard</Link>
            <span>·</span>
            <Link href="/marketing" className="hover:text-[#0D5E6D] transition-colors">Marketing Data</Link>
            <span>·</span>
            <Link href="/analysis" className="hover:text-[#0D5E6D] transition-colors">Analysis</Link>
            <span>·</span>
            <Link href="/t7-metrics" className="hover:text-[#0D5E6D] transition-colors">T7 Metrics</Link>
            <span>·</span>
            <Link href="/t30-metrics" className="hover:text-[#0D5E6D] transition-colors">T30 Metrics</Link>
            <span>·</span>
            <Link href="/backup" className="hover:text-[#0D5E6D] transition-colors">Backup & Export</Link>
            <div className="ml-auto flex items-center gap-2">
              <Image src="/velo-current.svg" alt="" width={12} height={7} className="shrink-0 opacity-40" />
              <span>Produced by MarketingOps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
