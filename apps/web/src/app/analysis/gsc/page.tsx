"use client";

import React from "react";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { getGscSnapshot, type GscSnapshotResponse, type GscSnapshotProperty } from "@/lib/api";
import {
  Loader2, Search, TrendingUp, TrendingDown, MousePointerClick, Eye, Percent,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";

// ── Helpers ──

function fmtNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtDelta(n: number | null, prefix = ""): React.ReactNode {
  if (n == null) return null;
  const sign = n > 0 ? "+" : "";
  return (
    <span className={n > 0 ? "text-emerald-600" : n < 0 ? "text-red-500" : "text-slate-400"}>
      {sign}{prefix}{fmtNum(n)}
    </span>
  );
}

function fmtDeltaPct(n: number | null): React.ReactNode {
  if (n == null) return null;
  const sign = n > 0 ? "+" : "";
  return (
    <span className={n > 0 ? "text-emerald-600" : n < 0 ? "text-red-500" : "text-slate-400"}>
      {sign}{n.toFixed(2)}%
    </span>
  );
}

function ctrColor(ctr: number): string {
  if (ctr >= 5) return "text-emerald-600";
  if (ctr >= 3) return "text-amber-600";
  return "text-red-500";
}

function ctrGrade(ctr: number): { label: string; cls: string } {
  if (ctr >= 5) return { label: "Excellent", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (ctr >= 3) return { label: "Good", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Needs Improvement", cls: "bg-red-50 text-red-600 border-red-200" };
}

function PositionDelta({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-xs text-slate-400">—</span>;
  // Lower position is better, so negative delta = improvement
  const improved = delta < 0;
  const worse = delta > 0;
  return (
    <span className={`text-xs font-medium ${improved ? "text-emerald-600" : worse ? "text-red-500" : "text-slate-400"}`}>
      {improved ? <ArrowUp className="inline h-3 w-3" /> : worse ? <ArrowDown className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
      {Math.abs(delta).toFixed(1)}
    </span>
  );
}

// ── KPI Card ──

function KpiCard({ label, value, delta, icon: Icon }: {
  label: string;
  value: string;
  delta: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        </div>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {delta && <p className="mt-1 text-sm">{delta}</p>}
      </CardContent>
    </Card>
  );
}

// ── Property Row ──

function PropertyRow({ p }: { p: GscSnapshotProperty }) {
  const grade = ctrGrade(p.avg_ctr);
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-0 hover:bg-slate-50 transition-colors">
      {/* Rank + Name */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-slate-400">#{p.rank}.</span>
          <span className="font-semibold text-slate-900 truncate">{p.name}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            Clicks: <strong className="text-slate-700">{fmtNum(p.clicks)}</strong>
            {p.clicks_delta != null && <> <span className="text-slate-300">|</span> {fmtDelta(p.clicks_delta)}</>}
          </span>
          <span>
            Impressions: <strong className="text-slate-700">{fmtNum(p.impressions)}</strong>
            {p.impressions_delta != null && <> <span className="text-slate-300">|</span> {fmtDelta(p.impressions_delta)}</>}
          </span>
          <span>
            CTR: <strong className={ctrColor(p.avg_ctr)}>{p.avg_ctr.toFixed(1)}%</strong>
            {p.ctr_delta != null && <> <span className="text-slate-300">|</span> {fmtDeltaPct(p.ctr_delta)}</>}
          </span>
          <span>
            Avg Position: <strong className="text-slate-700">{p.avg_position.toFixed(1)}</strong>
            {p.position_delta != null && <> <span className="text-slate-300">|</span> <PositionDelta delta={p.position_delta} /></>}
          </span>
        </div>
      </div>

      {/* Big position number on right */}
      <div className="text-right shrink-0 w-20">
        <p className="text-2xl font-bold text-slate-900">{Math.round(p.avg_position)}</p>
        <p className="text-[10px] text-slate-400">avg pos</p>
        <PositionDelta delta={p.position_delta} />
      </div>
    </div>
  );
}

// ── Page ──

export default function GscSnapshotPage() {
  const [data, setData] = React.useState<GscSnapshotResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getGscSnapshot()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data?.portfolio) {
    return (
      <div className="py-24 text-center text-slate-500">
        No GSC snapshot data available.
      </div>
    );
  }

  const { portfolio, grades, properties, snapshot_date, prev_date } = data;
  const dateLabel = snapshot_date ? format(parseISO(snapshot_date), "MMM d, yyyy") : "—";
  const prevLabel = prev_date ? format(parseISO(prev_date), "MMM d") : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center gap-2 mb-1">
            <Image src="/velo.svg" alt="" width={20} height={12} className="opacity-60" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Venterra</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            Portfolio Google Search Console Snapshot
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete property listing sorted by organic clicks (30 days)
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Snapshot: {dateLabel}{prevLabel && <> · Compared to {prevLabel}</>}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] space-y-8 px-6 py-8 md:px-12">
        {/* Portfolio KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard
            label="Total Clicks"
            value={fmtNum(portfolio.total_clicks)}
            delta={fmtDelta(portfolio.clicks_delta)}
            icon={MousePointerClick}
          />
          <KpiCard
            label="Total Impressions"
            value={fmtNum(portfolio.total_impressions)}
            delta={fmtDelta(portfolio.impressions_delta)}
            icon={Eye}
          />
          <KpiCard
            label="Average CTR"
            value={`${portfolio.avg_ctr.toFixed(2)}%`}
            delta={fmtDeltaPct(portfolio.ctr_delta)}
            icon={Percent}
          />
        </div>

        {/* Portfolio Overview bar */}
        {grades && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Portfolio Overview</p>
                  <p className="text-xs text-slate-500">
                    Organic search performance for {properties.length} properties
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  {fmtNum(portfolio.total_clicks)} Clicks · {fmtNum(portfolio.total_impressions)} Impressions
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                  {grades.needs_improvement}
                  <span className="font-normal text-red-500">Needs Improvement</span>
                  <span className="text-[10px] font-normal text-red-400">CTR &lt;3%</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {grades.good}
                  <span className="font-normal text-amber-600">Good</span>
                  <span className="text-[10px] font-normal text-amber-400">CTR 3-5%</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {grades.excellent}
                  <span className="font-normal text-emerald-600">Excellent</span>
                  <span className="text-[10px] font-normal text-emerald-400">CTR ≥5%</span>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Property Ranking */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Complete Property Ranking by Clicks</h2>
              <p className="text-xs text-slate-500">All properties sorted by organic clicks (highest to lowest)</p>
            </div>
            <Search className="h-5 w-5 text-slate-300" />
          </div>
          <Card>
            <CardContent className="p-0 divide-y divide-slate-100">
              {properties.map((p) => (
                <PropertyRow key={p.community_id} p={p} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
