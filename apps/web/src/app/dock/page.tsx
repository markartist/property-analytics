"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDockPreview, type DockPreviewResponse } from "@/lib/api";
import {
  Anchor, ArrowLeft, ArrowRight, Loader2,
  FileText, BarChart2, Megaphone, Calendar, TrendingUp, Download,
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
    key: "pib",
    href: "/pib",
    icon: FileText,
    title: "PIB Dashboard",
    subtitle: "Portfolio Intelligence Brief",
    description: "Full portfolio rollup with sortable property table — CIR, sessions, occupancy, PageSpeed, reviews, ad spend, and more.",
    accentColor: "border-l-[#15284B]",
    iconBg: "bg-[#15284B]",
    metrics: (d) => {
      const items: { label: string; value: string }[] = [];
      if (d.pib) {
        items.push({ label: "Properties", value: String(d.pib.communities) });
        if (d.pib.avg_cir != null) items.push({ label: "Avg CIR", value: `${d.pib.avg_cir}%` });
        if (d.pib.total_sessions) items.push({ label: "Sessions", value: d.pib.total_sessions.toLocaleString() });
        if (d.pib.avg_mobile_score != null) items.push({ label: "PageSpd", value: String(d.pib.avg_mobile_score) });
      }
      return items;
    },
  },
  {
    key: "analysis",
    href: "/analysis",
    icon: BarChart2,
    title: "Analysis",
    subtitle: "Deep-dive property analysis",
    description: "Detailed single-property analysis with full metric breakdowns, comparisons, and trend charts.",
    accentColor: "border-l-[#0D5E6D]",
    iconBg: "bg-[#0D5E6D]",
    metrics: (d) => {
      const items: { label: string; value: string }[] = [];
      if (d.pib) {
        if (d.pib.avg_rating != null) items.push({ label: "Avg Rating", value: d.pib.avg_rating.toFixed(2) });
        items.push({ label: "Properties", value: String(d.pib.communities) });
      }
      return items;
    },
  },
  {
    key: "leasing",
    href: "/t7-metrics",
    icon: Calendar,
    title: "Leasing Funnel",
    subtitle: "T7 & T30 guest card metrics",
    description: "Weekly leasing funnel — guest cards, visits, tours, applications, leases, move-ins. Community vs portfolio benchmarks.",
    accentColor: "border-l-amber-500",
    iconBg: "bg-amber-500",
    metrics: (d) => {
      const items: { label: string; value: string }[] = [];
      if (d.leasing) {
        items.push({ label: "Properties", value: String(d.leasing.communities) });
        if (d.leasing.total_guest_cards) items.push({ label: "T7 GCs", value: d.leasing.total_guest_cards.toLocaleString() });
        if (d.leasing.avg_visit_conv != null) items.push({ label: "V/GC", value: `${d.leasing.avg_visit_conv}%` });
      }
      return items;
    },
  },
  {
    key: "marketing",
    href: "/marketing",
    icon: Megaphone,
    title: "Marketing Data",
    subtitle: "Ad spend, occupancy, reputation",
    description: "Seven-section marketing overview — advertising, property performance, guest cards per door, website & SEO, projects, reputation, pricing.",
    accentColor: "border-l-purple-500",
    iconBg: "bg-purple-500",
    metrics: (d) => {
      const items: { label: string; value: string }[] = [];
      if (d.marketing) {
        items.push({ label: "Properties", value: String(d.marketing.communities) });
        if (d.marketing.avg_occupancy != null) items.push({ label: "Avg Occ", value: `${d.marketing.avg_occupancy}%` });
        if (d.marketing.total_ad_spend > 0) items.push({ label: "Ad Spend", value: `$${d.marketing.total_ad_spend.toLocaleString()}` });
      }
      return items;
    },
  },
  {
    key: "t30",
    href: "/t30-metrics",
    icon: TrendingUp,
    title: "T30 Metrics",
    subtitle: "30-day leasing window",
    description: "Rolling 30-day leasing metrics with conversion ratios and week-over-week deltas.",
    accentColor: "border-l-emerald-500",
    iconBg: "bg-emerald-500",
    metrics: () => [],
  },
  {
    key: "backup",
    href: "/backup",
    icon: Download,
    title: "Backup & Export",
    subtitle: "Download your data",
    description: "Export community data, metrics, and marketing records as JSON or CSV for offline analysis.",
    accentColor: "border-l-slate-400",
    iconBg: "bg-slate-500",
    metrics: () => [],
  },
];

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function DockPage() {
  const [preview, setPreview] = React.useState<DockPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

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
          <Link href="/" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Anchor className="h-6 w-6 text-white/70" />
          <div>
            <h1 className="text-xl font-bold text-white">The Dock</h1>
            <p className="text-sm text-white/50">
              Your reports and dashboards
              {preview?.week_date && (
                <span className="ml-2">&middot; Week of {format(parseISO(preview.week_date), "MMM d, yyyy")}</span>
              )}
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {DOCK_CARDS.map((card) => {
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
        )}
      </div>
    </div>
  );
}
