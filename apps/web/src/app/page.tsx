"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ClearwaterBadge,
  ClearwaterKicker,
  ClearwaterPanel,
  ClearwaterStage,
} from "@/components/shared/clearwater-glass";
import { getPondInsights, type PondInsight, type PondSurface } from "@/lib/api";
import { OPS_WATCH_SNAPSHOT } from "@/lib/ops-watch/generated-snapshot";
import { useAuth } from "@/components/auth-provider";
import { IS_LAUNCH_ROOM_AUTH, getFeaturedOfferings, getRoleTitle, type AppRole, type SurfaceId } from "@/lib/permissions";
import {
  Anchor, Eye, Fish,
  TrendingUp, TrendingDown, AlertTriangle, Trophy, Zap, BarChart3,
  Loader2, Waves, Clock, Database, Gauge, FlaskConical, Route,
  BriefcaseBusiness, ClipboardCheck, FileText, ShieldCheck, ListChecks,
  MonitorCheck,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";

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
  green: "border-[#7DCAC2]/35 bg-[#7DCAC2]/14 text-[#7DCAC2]",
  amber: "border-[#BD4830]/35 bg-[#BD4830]/16 text-[#F6F6F5]",
  red: "border-[#E02472]/35 bg-[#E02472]/16 text-[#F6F6F5]",
  teal: "border-[#3B9189]/35 bg-[#3B9189]/18 text-[#7DCAC2]",
  blue: "border-[#5A81CF]/35 bg-[#5A81CF]/18 text-[#D6D6D2]",
};

const INSIGHT_ICON_COLORS: Record<string, string> = {
  green: "text-[#7DCAC2]",
  amber: "text-[#F6F6F5]",
  red: "text-[#F6F6F5]",
  teal: "text-[#7DCAC2]",
  blue: "text-[#D6D6D2]",
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
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: Waves,
  },
  watchtower: {
    kicker: "Monitor",
    title: "The Watchtower",
    subtitle: "Check the pulse",
    description: "System health, data freshness, coverage matrix, and pipeline status at a glance.",
    gradient: "from-[#294782]/30 via-white/[0.055] to-[#3B9189]/12",
    iconBg: "bg-white/[0.18]",
    icon: Eye,
  },
  dock: {
    kicker: "Browse",
    title: "Report Archive",
    subtitle: "Find generated work",
    description: "Browse governed dashboards, report lanes, generated packets, and portfolio analysis from one place.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: Anchor,
  },
  fish: {
    kicker: "Ask",
    title: "The Fishing Hole",
    subtitle: "Ask anything",
    description: "Cast a question into the pond — get answers, reports, CSVs, or email summaries powered by AI.",
    gradient: "from-[#3B9189]/30 via-white/[0.055] to-[#15284B]/12",
    iconBg: "bg-white/[0.18]",
    icon: Fish,
  },
  tracker: {
    kicker: "Track",
    title: "Pilot Tracker",
    subtitle: "Watch pilots move",
    description: "Follow pilot and paired-lane movement without leaving the governed platform.",
    gradient: "from-[#5A81CF]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: Gauge,
  },
  popBrief: {
    kicker: "Brief",
    title: "POP Brief",
    subtitle: "Read the portfolio story",
    description: "Move directly into governed briefing and performance interpretation.",
    gradient: "from-[#E02472]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  captainBrief: {
    kicker: "Resolve",
    title: "Captain Brief",
    subtitle: "Read the property command view",
    description: "Open Captain Benton style operating reads with watch items, actions, and source-grounded inventory detail.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#3B9189]/12",
    iconBg: "bg-white/[0.18]",
    icon: Anchor,
  },
  captainOffice: {
    kicker: "Operate",
    title: "Captain’s Office",
    subtitle: "Work the governed property office",
    description: "Run property-specific runtime interactions with evidence lineage, authority state, and candidate memory visible.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#3B9189]/12",
    iconBg: "bg-white/[0.18]",
    icon: ClipboardCheck,
  },
  pibBuilder: {
    kicker: "Build",
    title: "PIB Builder",
    subtitle: "Shape a property brief",
    description: "Open the PIB workflow and work directly with the canonical briefing lane.",
    gradient: "from-[#3D66B9]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  searchIntelligence: {
    kicker: "Search",
    title: "Search Intelligence",
    subtitle: "Read the search picture",
    description: "Inspect search signals, positioning, and governed search insight.",
    gradient: "from-[#3B9189]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  gbpPosts: {
    kicker: "Local",
    title: "GBP Posts",
    subtitle: "Operate local posts",
    description: "Manage governed local-posting work without leaving the Pond.",
    gradient: "from-[#3B9189]/30 via-white/[0.055] to-[#15284B]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  gscReport: {
    kicker: "Search",
    title: "GSC Report",
    subtitle: "Review visibility",
    description: "Open Search Console-driven reporting and trend visibility.",
    gradient: "from-[#3D66B9]/30 via-white/[0.055] to-[#15284B]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  contentOffice: {
    kicker: "Content",
    title: "Content Office",
    subtitle: "Coordinate channel work",
    description: "Turn Captain and Data Pond intelligence into governed drafts, approvals, and handoffs.",
    gradient: "from-[#3B9189]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BriefcaseBusiness,
  },
  intelligenceOffice: {
    kicker: "Guide",
    title: "Intelligence Office",
    subtitle: "Set editorial direction",
    description: "Admin-owned guidance, claims, and directives workspace.",
    gradient: "from-[#5A81CF]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  directiveControlCenter: {
    kicker: "Govern",
    title: "Directive Control Center",
    subtitle: "Control policy data",
    description: "Admin-only directive policy, validation, approval, simulation, and runtime-snapshot control.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BriefcaseBusiness,
  },
  siteContent: {
    kicker: "Content",
    title: "Site Content Creator",
    subtitle: "Run governed rewrites",
    description: "Map, assess, and rewrite site sections in the governed content lane.",
    gradient: "from-[#3B9189]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  resiEdgeLaunch: {
    kicker: "Launch",
    title: "Resi Edge Launch",
    subtitle: "Open the launch room",
    description: "Review protected launch readiness, blockers, evidence posture, and batch progress.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#7DCAC2]/12",
    iconBg: "bg-white/[0.18]",
    icon: MonitorCheck,
  },
  routingOps: {
    kicker: "Route",
    title: "Routing Ops",
    subtitle: "Control launch routes",
    description: "Inspect portfolio URL moves, staging origins, route readiness, and launch approval posture.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#3B9189]/12",
    iconBg: "bg-white/[0.18]",
    icon: Route,
  },
  experiments: {
    kicker: "Test",
    title: "Experiment Lab",
    subtitle: "Draft edge trials",
    description: "Govern small site-experience tests with readiness gates, EVS proof, and rollback discipline.",
    gradient: "from-[#3B9189]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: FlaskConical,
  },
  vacs: {
    kicker: "Execute",
    title: "VACS",
    subtitle: "Drive content execution",
    description: "Machine-first content execution lane with governed bridge posture.",
    gradient: "from-[#15284B]/30 via-white/[0.055] to-[#000000]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  evs: {
    kicker: "Validate",
    title: "EVS",
    subtitle: "Review validation work",
    description: "Validation requests, handoff posture, and governed review.",
    gradient: "from-[#3D66B9]/30 via-white/[0.055] to-[#15284B]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  controlPlane: {
    kicker: "Govern",
    title: "Control Plane",
    subtitle: "Inspect the architecture",
    description: "Admin-only landscape, trust, and consolidation surface.",
    gradient: "from-[#294782]/30 via-white/[0.055] to-[#15284B]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  backup: {
    kicker: "Export",
    title: "Backup & Export",
    subtitle: "Move governed outputs",
    description: "Operational export and backup tooling.",
    gradient: "from-[#9B9B96]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
  adminUsers: {
    kicker: "Admin",
    title: "Admin",
    subtitle: "Manage platform access",
    description: "User and administrative control surface.",
    gradient: "from-[#D6D6D2]/30 via-white/[0.055] to-[#294782]/12",
    iconBg: "bg-white/[0.18]",
    icon: BarChart3,
  },
};

// ────────────────────────────────────────────────────────────────
// Freshness helpers
// ────────────────────────────────────────────────────────────────

function freshnessAge(dateStr: string | null): { label: string; color: string } {
  if (!dateStr) return { label: "No data", color: "text-[#E02472]" };
  const age = Date.now() - parseISO(dateStr).getTime();
  const days = Math.floor(age / 86400000);
  if (days <= 7) return { label: `${days}d ago`, color: "text-[#7DCAC2]" };
  if (days <= 14) return { label: `${days}d ago`, color: "text-[#BD4830]" };
  return { label: `${days}d ago`, color: "text-[#E02472]" };
}

function freshnessStatus(dateStr: string | null): "ready" | "watch" | "stale" {
  if (!dateStr) return "stale";
  const age = Date.now() - parseISO(dateStr).getTime();
  const days = Math.floor(age / 86400000);
  if (days <= 7) return "ready";
  if (days <= 14) return "watch";
  return "stale";
}

function formatOpsDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MM/dd/yyyy");
}

// Labels for source freshness keys (from data_freshness table)
const SUNSET_SOURCE_KEYS = new Set(["semrush"]);

const SOURCE_LABELS: Record<string, string> = {
  ga4: "GA4 Traffic",
  ga4_sources: "Traffic Sources",
  gsc: "Search (GSC)",
  google_ads: "Google Ads",
  ads_keywords: "Ads Keywords",
  pagespeed: "PageSpeed",
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

const PIB_PRESETS = [
  {
    label: "Full PIB",
    detail: "All governed executive sections with always-on identity, freshness, and methodology.",
  },
  {
    label: "Website / Funnel",
    detail: "Site evaluation, traffic, conversion intent, search, paid, local, and reputation.",
  },
  {
    label: "Leasing / Inventory",
    detail: "Availability, guest cards, conversion intent, and SightMap when applicable.",
  },
  {
    label: "Market Context",
    detail: "Competitor, DataForSEO, ApartmentIQ, and internal availability context.",
  },
  {
    label: "Reputation / Local",
    detail: "Reviews, local presence, DataForSEO visibility, and owned search context.",
  },
];

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

function LaunchRoomRootRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/resi-edge/launch");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F6F5]">
      <Loader2 className="h-8 w-8 animate-spin text-[#3D66B9]" aria-label="Opening launch dashboard" />
    </div>
  );
}

export default function DataPondLanding() {
  if (IS_LAUNCH_ROOM_AUTH) {
    return <LaunchRoomRootRedirect />;
  }

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
  const sourceEntries = React.useMemo(() => {
    if (!surface) return [];
    return Object.entries(surface.freshness)
      .filter(([key]) => !SUNSET_SOURCE_KEYS.has(key.toLowerCase()))
      .map(([key, dateStr]) => {
        const label = SOURCE_LABELS[key] ?? TABLE_LABELS[key] ?? key;
        const age = freshnessAge(dateStr);
        const status = freshnessStatus(dateStr);
        return { key, label, dateStr, age, status };
      });
  }, [surface]);
  const staleSources = sourceEntries.filter((entry) => entry.status === "stale");
  const watchSources = sourceEntries.filter((entry) => entry.status === "watch");
  const readySources = sourceEntries.filter((entry) => entry.status === "ready");
  const opsWatch = OPS_WATCH_SNAPSHOT;
  const opsWatchJiraRecords = opsWatch.captainRecords.filter((record) => record.sourceSystem === "jira");
  const opsWatchBlockedSources = opsWatch.sourceReadiness.filter((row) => row.status.startsWith("blocked"));
  const opsWatchQueue = opsWatch.captainRecords
    .filter((record) => record.sourceSystem === "jira")
    .sort((a, b) => {
      const severityRank = (severity: string) => severity === "critical" ? 0 : severity === "high" ? 1 : severity === "medium" ? 2 : 3;
      return severityRank(a.severity) - severityRank(b.severity) || (b.staleDays ?? 0) - (a.staleDays ?? 0);
    })
    .slice(0, 6);

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
    <ClearwaterStage>
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
                <ClearwaterBadge>
                  {getRoleTitle(user.role)} access
                </ClearwaterBadge>
              )}
              <ClearwaterKicker className="mt-4">
                {roleProfile.eyebrow}
              </ClearwaterKicker>
              <ClearwaterKicker>
                Monitor. Build. Govern.
              </ClearwaterKicker>
              <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] text-white md:text-6xl">
                The Data Pond
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-white/72">
                The governed source layer for property facts, freshness, evidence, and executive briefing work.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
                {roleProfile.summary}
              </p>

              {surface && (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <ClearwaterBadge className="py-1 text-white/90">
                    <Database className="mr-1.5 h-3 w-3" />
                    {surface.community_count} Properties
                  </ClearwaterBadge>
                  <ClearwaterBadge className="py-1 text-white/90">
                    <Clock className="mr-1.5 h-3 w-3" />
                    Latest: {surface.latest_snapshot
                      ? formatDistanceToNow(parseISO(surface.latest_snapshot), { addSuffix: true })
                      : "—"}
                  </ClearwaterBadge>
                  <ClearwaterBadge className="py-1 text-white/90">
                    <Waves className="mr-1.5 h-3 w-3" />
                    9 Data Sources
                  </ClearwaterBadge>
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
              <ClearwaterPanel tone="standard">
                <ClearwaterKicker>Operator flow</ClearwaterKicker>
                <div className="mt-4 grid gap-3">
                  {roleProfile.operatorFlow.map((step) => (
                    <div key={step.title} className="clearwater-glass clearwater-glass-clear rounded-2xl border border-white/10 px-4 py-4">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/60">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </ClearwaterPanel>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] space-y-8 px-6 py-8 md:px-12">

        {/* Source Readiness */}
        {surface && (
          <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <ClearwaterPanel tone="tinted" className="clearwater-lens-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <ClearwaterKicker>Source readiness</ClearwaterKicker>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Trust the pond before you act</h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
                    Data Pond is the source-of-truth layer. Stale source lanes should be visible before reports, exports, or recommendations move downstream.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/14 bg-white/[0.07] px-4 py-3 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">Roster</p>
                  <p className="mt-1 text-2xl font-black text-white">{surface.community_count}</p>
                  <p className="text-xs text-white/54">active Pond records</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#7DCAC2]/24 bg-[#7DCAC2]/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Ready</p>
                  <p className="mt-2 text-3xl font-black text-[#7DCAC2]">{readySources.length}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">fresh source lanes</p>
                </div>
                <div className="rounded-2xl border border-[#BD4830]/26 bg-[#BD4830]/12 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Watch</p>
                  <p className="mt-2 text-3xl font-black text-[#F6F6F5]">{watchSources.length}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">aging source lanes</p>
                </div>
                <div className="rounded-2xl border border-[#E02472]/30 bg-[#E02472]/14 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Stale</p>
                  <p className="mt-2 text-3xl font-black text-[#F6F6F5]">{staleSources.length}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">needs attention</p>
                </div>
              </div>

              {staleSources.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-[#E02472]/28 bg-[#E02472]/12 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#E02472]" />
                    <div>
                      <p className="text-sm font-semibold text-white">Freshness pressure is active</p>
                      <p className="mt-1 text-sm leading-6 text-white/58">
                        {staleSources.slice(0, 3).map((source) => `${source.label} ${source.age.label}`).join(", ")}
                        {staleSources.length > 3 ? `, and ${staleSources.length - 3} more` : ""}.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-[#7DCAC2]/22 bg-[#7DCAC2]/10 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#7DCAC2]" />
                    <div>
                      <p className="text-sm font-semibold text-white">Core source posture is current</p>
                      <p className="mt-1 text-sm leading-6 text-white/58">No stale source lanes are visible in this Pond snapshot.</p>
                    </div>
                  </div>
                </div>
              )}
            </ClearwaterPanel>

            <div className="clearwater-data-card rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-[#7DCAC2]" />
                  <div>
                    <h2 className="text-lg font-bold text-white">Surface Conditions</h2>
                    <p className="text-xs text-white/50">Actual freshness across governed source lanes</p>
                  </div>
                </div>
                <Link
                  href="/watchtower"
                  className="inline-flex items-center rounded-xl border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/82 transition-colors hover:bg-white/[0.13] hover:text-white"
                >
                  Open Watchtower
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                {sourceEntries.map((entry) => (
                  <div key={entry.key} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3 text-center">
                    <p className="truncate text-xs font-medium text-white/56">{entry.label}</p>
                    <p className={`mt-1 text-sm font-bold tabular-nums ${entry.age.color}`}>
                      {entry.age.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ops Watch */}
        <ClearwaterPanel tone="tinted" className="clearwater-lens-card">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
            <div>
              <div className="inline-flex rounded-2xl bg-white/[0.14] p-3">
                <ClipboardCheck className="h-7 w-7 text-white" />
              </div>
              <ClearwaterKicker className="mt-5">Ops Watch</ClearwaterKicker>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Ticket pressure is in the Pond</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
                Latest packet {formatOpsDate(opsWatch.asOf)} keeps Jira and Confluence visible as governed, read-only operating signals.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/watchtower#ops-watch"
                  className="inline-flex items-center rounded-xl border border-white/14 bg-white/[0.1] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 transition-colors hover:bg-white/[0.16] hover:text-white"
                >
                  Open Watchtower
                </Link>
                <Link
                  href="/captains"
                  className="inline-flex items-center rounded-xl border border-white/12 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  Captain Queue
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#5A81CF]/26 bg-[#5A81CF]/12 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Jira</p>
                  <p className="mt-2 text-3xl font-black text-white">{opsWatchJiraRecords.length}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">property records</p>
                </div>
                <div className="rounded-2xl border border-[#E02472]/30 bg-[#E02472]/14 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Critical</p>
                  <p className="mt-2 text-3xl font-black text-white">{opsWatch.summary.critical_record_count}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">Captain rows</p>
                </div>
                <div className="rounded-2xl border border-[#BD4830]/26 bg-[#BD4830]/12 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Vendor</p>
                  <p className="mt-2 text-3xl font-black text-white">{opsWatch.summary.pending_vendor_record_count}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">pending rows</p>
                </div>
                <div className="rounded-2xl border border-[#7DCAC2]/24 bg-[#7DCAC2]/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Properties</p>
                  <p className="mt-2 text-3xl font-black text-[#7DCAC2]">{opsWatch.summary.property_count}</p>
                  <p className="mt-1 text-xs leading-5 text-white/56">with visibility</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.055]">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                  <span>Property / Ticket</span>
                  <span>Status</span>
                  <span>Updated</span>
                </div>
                {opsWatchQueue.map((record) => (
                  <a
                    key={`${record.propertyCode}-${record.itemKey}`}
                    href={record.itemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/8 px-4 py-3 text-sm text-white/70 transition-colors last:border-b-0 hover:bg-white/[0.06] hover:text-white"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{record.propertyCode} {record.propertyName}</span>
                      <span className="block truncate text-xs text-white/48">{record.itemKey} · {record.category.replace(/_/g, " ")}</span>
                    </span>
                    <span className="self-center rounded-full border border-white/12 px-2.5 py-1 text-xs text-white/64">{record.status}</span>
                    <span className="self-center text-xs tabular-nums text-white/54">{formatOpsDate(record.updated)}</span>
                  </a>
                ))}
              </div>

              {opsWatchBlockedSources.length > 0 && (
                <div className="rounded-2xl border border-[#BD4830]/26 bg-[#BD4830]/12 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F6F6F5]" />
                    <div>
                      <p className="text-sm font-semibold text-white">{opsWatchBlockedSources.length} source-readiness blocker{opsWatchBlockedSources.length === 1 ? "" : "s"}</p>
                      <p className="mt-1 text-sm leading-6 text-white/58">
                        {opsWatchBlockedSources.slice(0, 2).map((row) => row.displayName).join(", ")}
                        {opsWatchBlockedSources.length > 2 ? `, and ${opsWatchBlockedSources.length - 2} more` : ""}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ClearwaterPanel>

        {/* Canonical PIB Builder */}
        <ClearwaterPanel tone="tinted" className="clearwater-lens-card">
          <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr] xl:items-center">
            <div>
              <div className="inline-flex rounded-2xl bg-white/[0.14] p-3">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <ClearwaterKicker className="mt-5">Canonical briefing lane</ClearwaterKicker>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">PIB Builder</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
                Choose a governed preset, inspect source coverage, then hand the request to the canonical PIB route. Section selection stays a contract over the approved PIB family.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/analysis/pib"
                  className="inline-flex items-center rounded-xl border border-white/14 bg-white/[0.1] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 transition-colors hover:bg-white/[0.16] hover:text-white"
                >
                  Open Builder
                </Link>
                <Link
                  href="/analysis/pib"
                  className="inline-flex items-center rounded-xl border border-white/12 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  Report Library
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {PIB_PRESETS.map((preset) => (
                <div key={preset.label} className="rounded-2xl border border-white/12 bg-white/[0.055] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[#7DCAC2]" />
                    <div>
                      <p className="text-sm font-semibold text-white">{preset.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/54">{preset.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ClearwaterPanel>

        {/* Zone Cards */}
        <div className="relative">
          <div className="clearwater-lane-field" aria-hidden="true" />
          <div className="relative grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredZones.map((zone) => (
            <Link key={zone.key} href={zone.href} className="group">
              <ClearwaterPanel
                tone="tinted"
                className="clearwater-lens-card relative min-h-[250px] overflow-hidden transition-all duration-300 group-hover:-translate-y-0.5"
              >
                <div className="relative">
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
              </ClearwaterPanel>
            </Link>
          ))}
          </div>
        </div>

        {/* Catch of the Day */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Fish className="h-5 w-5 text-[#7DCAC2]" />
            <h2 className="text-lg font-bold text-white">Latest Governed Signals</h2>
            <span className="text-xs text-white/50 ml-1">Source-backed reads from the current Pond snapshot</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : insights.length === 0 ? (
            <div className="clearwater-data-card rounded-2xl py-10 text-center text-white/58">
                No insights yet — data will appear after your first PIB snapshot.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight) => {
                const Icon = INSIGHT_ICONS[insight.icon] ?? Zap;
                const colorCls = INSIGHT_COLORS[insight.color] ?? INSIGHT_COLORS.teal;
                const iconColor = INSIGHT_ICON_COLORS[insight.color] ?? "text-teal-600";
                return (
                  <div key={insight.id} className="clearwater-data-card rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-lg border p-2 ${colorCls}`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug text-white/88">
                            {insight.title}
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-white/52">
                            {insight.detail}
                          </p>
                        </div>
                      </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick links footer */}
        <div className="border-t border-white/12 pt-6 pb-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/46">
            <Link href="/analysis/pib" className="transition-colors hover:text-white">PIB Builder</Link>
            <span>·</span>
            <Link href="/marketing" className="transition-colors hover:text-white">Marketing Data</Link>
            <span>·</span>
            <Link href="/analysis" className="transition-colors hover:text-white">Analysis</Link>
            <span>·</span>
            <Link href="/t7-metrics" className="transition-colors hover:text-white">T7 Metrics</Link>
            <span>·</span>
            <Link href="/t30-metrics" className="transition-colors hover:text-white">T30 Metrics</Link>
            <span>·</span>
            <Link href="/backup" className="transition-colors hover:text-white">Backup & Export</Link>
            <div className="ml-auto flex items-center gap-2">
              <Image src="/velo-current.svg" alt="" width={12} height={7} className="shrink-0 opacity-40" />
              <span>Produced by WebOps</span>
            </div>
          </div>
        </div>
      </div>
    </ClearwaterStage>
  );
}
