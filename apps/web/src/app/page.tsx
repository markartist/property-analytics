"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPondInsights, type PondInsight, type PondSurface } from "@/lib/api";
import {
  Anchor, Eye, Fish,
  TrendingUp, TrendingDown, AlertTriangle, Trophy, Zap, BarChart3,
  Loader2, Waves, Clock, Database,
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

const ZONES = [
  {
    key: "dock",
    href: "/dock",
    icon: Anchor,
    title: "The Dock",
    subtitle: "Browse your reports",
    description: "PIB dashboards, leasing funnels, marketing data, and portfolio analysis — all in one place.",
    gradient: "from-[#15284B] to-[#1e3a5f]",
    iconBg: "bg-white/20",
  },
  {
    key: "watchtower",
    href: "/watchtower",
    icon: Eye,
    title: "The Watchtower",
    subtitle: "Check the pulse",
    description: "System health, data freshness, coverage matrix, and pipeline status at a glance.",
    gradient: "from-[#0D5E6D] to-[#0a4a56]",
    iconBg: "bg-white/20",
  },
  {
    key: "fish",
    href: "/fish",
    icon: Fish,
    title: "The Fishing Hole",
    subtitle: "Ask anything",
    description: "Cast a question into the pond — get answers, reports, CSVs, or email summaries powered by AI.",
    gradient: "from-[#15803D] to-[#166534]",
    iconBg: "bg-white/20",
  },
];

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

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function DataPondLanding() {
  const [insights, setInsights] = React.useState<PondInsight[]>([]);
  const [surface, setSurface] = React.useState<PondSurface | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getPondInsights()
      .then((data) => {
        setInsights(data.insights);
        setSurface(data.surface);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
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
          <div className="mx-auto max-w-[1400px]">
            {/* Branding */}
            <div className="flex items-center gap-3 mb-1">
              <Image src="/velo.svg" alt="Venterra" width={24} height={14} className="shrink-0 opacity-80" />
              <span className="text-xs font-medium uppercase tracking-widest text-white/50">
                Venterra WebOps
              </span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              The Data Pond
            </h1>
            <p className="mt-2 max-w-xl text-base text-white/70 md:text-lg">
              Your analytics resort. Browse reports, monitor system health, or cast a question into the pond and reel in an answer.
            </p>

            {/* Surface conditions strip */}
            {surface && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
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
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] space-y-8 px-6 py-8 md:px-12">

        {/* Zone Cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {ZONES.map((zone) => (
            <Link key={zone.key} href={zone.href} className="group">
              <div
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${zone.gradient} p-6 shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.02]`}
              >
                <div className={`inline-flex rounded-xl ${zone.iconBg} p-3 mb-4`}>
                  <zone.icon className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{zone.title}</h2>
                <p className="mt-0.5 text-sm font-medium text-white/70">{zone.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{zone.description}</p>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-white/40 group-hover:text-white/70 transition-colors">
                  Explore →
                </div>
              </div>
            </Link>
          ))}
        </div>

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
              <span className="text-xs text-slate-400 ml-1">Data freshness across all sources</span>
            </div>
            <Card>
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-9">
                  {Object.entries(TABLE_LABELS).map(([key, label]) => {
                    const dateStr = surface.freshness[key] ?? null;
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
              <span>Produced by Venterra WebOps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
