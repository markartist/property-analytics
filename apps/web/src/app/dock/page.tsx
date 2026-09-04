"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDockPreview, type DockPreviewResponse } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { canAccessOffering, getRoleTitle, type AppRole, type SurfaceId } from "@/lib/permissions";
import {
  Anchor, ArrowLeft, ArrowRight, Loader2,
  BriefcaseBusiness, ClipboardCheck, Download, Bot, Compass, Eye, FileText, Gauge,
  MessageSquare, MonitorCheck, Search, UserRoundCheck,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ────────────────────────────────────────────────────────────────
// Metric pill helper
// ────────────────────────────────────────────────────────────────

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs shadow-sm border border-slate-200/60">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Dock card config
// ────────────────────────────────────────────────────────────────

interface DockCard {
  key: string;
  surfaceId: SurfaceId;
  href: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  iconBg: string;
  metrics: (data: DockPreviewResponse) => { label: string; value: string }[];
}

const DOCK_CARDS: DockCard[] = [
  {
    key: "watchtower",
    surfaceId: "watchtower",
    href: "/watchtower",
    icon: Eye,
    title: "Watchtower",
    subtitle: "Health and source posture",
    description: "Review system freshness, source readiness, closure posture, and trust pressure before work moves downstream.",
    accentColor: "border-l-[#15284B]",
    iconBg: "bg-[#15284B]",
    metrics: () => [],
  },
  {
    key: "resi-edge-launch",
    surfaceId: "resiEdgeLaunch",
    href: "/resi-edge/launch",
    icon: MonitorCheck,
    title: "Resi Edge Launch",
    subtitle: "Protected launch room",
    description: "Open the current launch room for readiness, blockers, proof packets, and batch progress.",
    accentColor: "border-l-[#3B9189]",
    iconBg: "bg-[#3B9189]",
    metrics: () => [],
  },
  {
    key: "tracker",
    surfaceId: "tracker",
    href: "/tracker",
    icon: Gauge,
    title: "Pilot Tracker",
    subtitle: "Pilot movement and comparisons",
    description: "Follow active pilot and paired-lane movement from the governed tracking surface.",
    accentColor: "border-l-[#5A81CF]",
    iconBg: "bg-[#5A81CF]",
    metrics: () => [],
  },
  {
    key: "captain-office",
    surfaceId: "captainOffice",
    href: "/captains/AR4PB",
    icon: ClipboardCheck,
    title: "Captain’s Office",
    subtitle: "Property intelligence workspace",
    description: "Work from Captain Runtime, watch items, evidence lineage, and candidate memory without leaving Data Pond.",
    accentColor: "border-l-[#294782]",
    iconBg: "bg-[#294782]",
    metrics: () => [],
  },
  {
    key: "pib-builder",
    surfaceId: "pibBuilder",
    href: "/analysis/pib",
    icon: FileText,
    title: "PIB Builder",
    subtitle: "Canonical briefing lane",
    description: "Build, open, email, save, and schedule property intelligence briefs through the governed PIB control plane.",
    accentColor: "border-l-[#3D66B9]",
    iconBg: "bg-[#3D66B9]",
    metrics: (d) => {
      const items: { label: string; value: string }[] = [];
      if (d.pib) {
        items.push({ label: "Properties", value: String(d.pib.communities) });
        if (d.pib.avg_cir != null) items.push({ label: "Avg CIR", value: `${d.pib.avg_cir}%` });
        if (d.pib.avg_mobile_score != null) items.push({ label: "PageSpd", value: String(d.pib.avg_mobile_score) });
      }
      return items;
    },
  },
  {
    key: "search-intelligence",
    surfaceId: "searchIntelligence",
    href: "/analysis/search-intelligence",
    icon: Search,
    title: "Search Intelligence",
    subtitle: "Search and competitive reads",
    description: "Inspect search signals, keyword posture, and source-backed visibility opportunities.",
    accentColor: "border-l-[#3D66B9]",
    iconBg: "bg-[#3D66B9]",
    metrics: (d) => {
      const items: { label: string; value: string }[] = [];
      if (d.marketing) {
        items.push({ label: "Properties", value: String(d.marketing.communities) });
      }
      return items;
    },
  },
  {
    key: "gbp-posts",
    surfaceId: "gbpPosts",
    href: "/gbp-posts",
    icon: MessageSquare,
    title: "GBP Posts",
    subtitle: "Local posting workflow",
    description: "Build governed Google Business Profile drafts from Data Pond and Captain signals.",
    accentColor: "border-l-[#7DCAC2]",
    iconBg: "bg-[#3B9189]",
    metrics: () => [],
  },
  {
    key: "gsc-report",
    surfaceId: "gscReport",
    href: "/gsc",
    icon: Search,
    title: "GSC Report",
    subtitle: "Search Console reporting",
    description: "Generate and review Search Console visibility reports from the current Data Pond source posture.",
    accentColor: "border-l-[#5A81CF]",
    iconBg: "bg-[#5A81CF]",
    metrics: () => [],
  },
  {
    key: "site-content",
    surfaceId: "siteContent",
    href: "/site-content",
    icon: Bot,
    title: "AI Content Suite",
    subtitle: "Mapped live page editor",
    description: "Edit live property-page sections in the Pond with VACS drafting, Captain context, Specs mapping, and rewrite governance in one workspace.",
    accentColor: "border-l-[#7DCAC2]",
    iconBg: "bg-[#3B9189]",
    metrics: () => [],
  },
  {
    key: "evs",
    surfaceId: "evs",
    href: "/evs",
    icon: Compass,
    title: "EVS Bridge",
    subtitle: "Validation lane",
    description: "Bridge into EVS from The Pond — mixed human-and-machine validation posture, BrowserStack-adjacent workflow context, and governed next moves.",
    accentColor: "border-l-[#3D66B9]",
    iconBg: "bg-[#3D66B9]",
    metrics: () => [],
  },
  {
    key: "employee-photo-audit",
    surfaceId: "evs",
    href: "/evs/employee-photo-audit",
    icon: UserRoundCheck,
    title: "Employee Photo Audit",
    subtitle: "Archived team photo QA",
    description: "Ad-hoc BrowserStack report for legacy #meet-the-team sections, listing missing employee photos by property and employee.",
    accentColor: "border-l-[#3D66B9]",
    iconBg: "bg-[#294782]",
    metrics: () => [],
  },
  {
    key: "backup",
    surfaceId: "backup",
    href: "/backup",
    icon: Download,
    title: "Backup & Export",
    subtitle: "Download your data",
    description: "Export community data, metrics, and marketing records as JSON or CSV for offline analysis.",
    accentColor: "border-l-[#9B9B96]",
    iconBg: "bg-[#9B9B96]",
    metrics: () => [],
  },
];

const ROLE_DOCK_INTRO: Record<AppRole, { eyebrow: string; summary: string }> = {
  viewer: {
    eyebrow: "Observer collection",
    summary: "Browse the governed reports and dashboards that explain what happened across the platform.",
  },
  editor: {
    eyebrow: "Curator collection",
    summary: "Move from report context into the operating lanes that need attention without losing governed signal.",
  },
  admin: {
    eyebrow: "Steward collection",
    summary: "Review governed outputs, then step into the execution and toolbox lanes only when the system needs intervention.",
  },
};

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function DockPage() {
  const { user } = useAuth();
  const [preview, setPreview] = React.useState<DockPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const role = user?.role ?? "viewer";
  const roleIntro = ROLE_DOCK_INTRO[role];
  const visibleCards = DOCK_CARDS.filter((card) => canAccessOffering(role, card.surfaceId));
  const featuredCards = visibleCards.filter((card) => ["watchtower", "resi-edge-launch", "tracker", "captain-office", "pib-builder"].includes(card.key));
  const workflowCards = visibleCards.filter((card) => !featuredCards.includes(card));

  React.useEffect(() => {
    getDockPreview()
      .then(setPreview)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-[#15284B] px-6 py-5">
        <div className="mx-auto max-w-[1400px] flex items-center gap-4">
          <Link href="/pond" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Anchor className="h-6 w-6 text-white/70" />
          <div>
            <h1 className="text-xl font-bold text-white">The Dock</h1>
            <p className="text-sm text-white/50">
              Your reports and dashboards
              {preview?.week_date && (
                <span className="ml-2">&middot; Week of {format(parseISO(preview.week_date), "MM/dd/yyyy")}</span>
              )}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
              {roleIntro.eyebrow} · {getRoleTitle(role)}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] p-6 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{roleIntro.eyebrow}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{roleIntro.summary}</p>
                </div>
                <Badge className="w-fit border-slate-200 bg-slate-50 text-slate-700">{getRoleTitle(role)}</Badge>
              </div>
            </div>

            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Governed reports</p>
                <p className="mt-1 text-sm text-slate-600">The core report and dashboard surfaces for your current lane.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {featuredCards.map((card) => {
                  const metrics = preview ? card.metrics(preview) : [];
                  return (
                    <Link key={card.key} href={card.href} className="group">
                      <Card className={`h-full border-l-4 ${card.accentColor} transition-all duration-200 group-hover:shadow-lg group-hover:scale-[1.01]`}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 mb-2">
                                <div className={`rounded-lg p-2 ${card.iconBg}`}>
                                  <card.icon className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                                  <p className="text-xs text-slate-500">{card.subtitle}</p>
                                </div>
                              </div>
                              <p className="text-sm leading-relaxed text-slate-600 mb-3">
                                {card.description}
                              </p>
                              {metrics.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {metrics.map((m) => (
                                    <MetricPill key={m.label} label={m.label} value={m.value} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-[#0D5E6D] transition-colors">
                            Open report <ArrowRight className="h-3 w-3" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {workflowCards.length > 0 ? (
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Workflow lanes</p>
                  <p className="mt-1 text-sm text-slate-600">Execution and utility lanes available to your current role.</p>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {workflowCards.map((card) => {
              const metrics = preview ? card.metrics(preview) : [];
              return (
                <Link key={card.key} href={card.href} className="group">
                  <Card className={`h-full border-l-4 ${card.accentColor} transition-all duration-200 group-hover:shadow-lg group-hover:scale-[1.01]`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className={`rounded-lg p-2 ${card.iconBg}`}>
                              <card.icon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                              <p className="text-xs text-slate-500">{card.subtitle}</p>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-600 mb-3">
                            {card.description}
                          </p>
                          {metrics.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {metrics.map((m) => (
                                <MetricPill key={m.label} label={m.label} value={m.value} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-[#0D5E6D] transition-colors">
                        Open lane <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
