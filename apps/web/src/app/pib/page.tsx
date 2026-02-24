"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import {
  getPibPortfolio, getPibWeeks,
  type PibPortfolioResponse, type PibCommunityRow, type PibSummary,
} from "@/lib/api";
import {
  BarChart3, Activity, Gauge, Star, DollarSign, Zap,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Search, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  ArrowUpDown,
} from "lucide-react";

// ── Summary Card ──

function SummaryCard({
  label, value, format: fmt, trend, icon: Icon, color,
}: {
  label: string;
  value: number | null;
  format?: (v: number) => string;
  trend?: number | null;
  icon: React.ElementType;
  color: string;
}) {
  const display = value != null
    ? (fmt ? fmt(value) : value.toLocaleString())
    : "—";

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{display}</p>
            {trend != null && (
              <div className="mt-1">
                <TrendIndicator value={trend} isPercentage decimalPlaces={1} />
              </div>
            )}
          </div>
          <div className={`rounded-lg p-2 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <p className="mt-2 text-[10px] font-medium text-slate-400">30-day snapshot</p>
      </CardContent>
    </Card>
  );
}

// ── Color helpers ──

function pagespeedColor(score: number | null): string {
  if (score == null) return "";
  if (score >= 90) return "text-green-600 font-bold";
  if (score >= 50) return "text-amber-600 font-semibold";
  return "text-red-600 font-bold";
}

function occupancyColor(occ: number | null): string {
  if (occ == null) return "";
  if (occ >= 95) return "text-green-600";
  if (occ >= 90) return "text-amber-600";
  return "text-red-600";
}

function cirColor(status: string | null): string {
  switch (status) {
    case "strong": return "text-green-600";
    case "moderate": return "text-amber-600";
    case "low": return "text-orange-600";
    case "critical": return "text-red-600";
    default: return "";
  }
}

function ratingColor(rating: number | null): string {
  if (rating == null) return "";
  if (rating >= 4.5) return "text-green-600";
  if (rating >= 4.0) return "text-amber-600";
  return "text-red-600";
}

// ── Sort types ──

type SortKey = keyof PibCommunityRow;
type SortDir = "asc" | "desc";

// Column definitions
const COLUMNS: { key: SortKey; label: string; shortLabel?: string; className?: string }[] = [
  { key: "community_name", label: "Property" },
  { key: "occupancy", label: "Occ %", className: "text-right" },
  { key: "atr", label: "ATR %", className: "text-right" },
  { key: "cir_value", label: "CIR %", className: "text-right" },
  { key: "total_sessions", label: "Sessions", className: "text-right" },
  { key: "sessions_trend_pct", label: "Sess Δ", className: "text-center" },
  { key: "mobile_score", label: "PageSpd", className: "text-right" },
  { key: "avg_rating", label: "Review", className: "text-right" },
  { key: "gc_per_door", label: "GC/Door", className: "text-right" },
  { key: "gbp_action_rate", label: "GBP Act%", className: "text-right" },
  { key: "gsc_avg_position", label: "Avg Pos", className: "text-right" },
  { key: "google_ppc", label: "Ad Spend", className: "text-right" },
];

// ── Main Page ──

export default function PibDashboard() {
  const [data, setData] = React.useState<PibPortfolioResponse | null>(null);
  const [weeks, setWeeks] = React.useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("community_name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  // Load available weeks on mount
  React.useEffect(() => {
    getPibWeeks()
      .then((w) => {
        setWeeks(w);
        if (w.length > 0 && !selectedWeek) setSelectedWeek(w[0]);
      })
      .catch(() => {});
  }, []);

  // Load data when week changes
  React.useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    setError(null);
    getPibPortfolio(selectedWeek)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedWeek]);

  // Navigate weeks
  const weekIdx = selectedWeek ? weeks.indexOf(selectedWeek) : -1;
  const canPrev = weekIdx < weeks.length - 1;
  const canNext = weekIdx > 0;

  // Filter + sort communities
  const filtered = React.useMemo(() => {
    if (!data) return [];
    let rows = data.communities;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.community_name?.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = Number(av), nb = Number(bv);
      return sortDir === "asc" ? na - nb : nb - na;
    });
    return rows;
  }, [data, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "community_name" ? "asc" : "desc");
    }
  };

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;
  const fmtScore = (v: number) => String(Math.round(v));
  const fmtDollar = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtRating = (v: number) => v.toFixed(2);
  const fmtSessions = (v: number) => v.toLocaleString();

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-[#15284B] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">
              Portfolio Intelligence Brief
            </h1>
            <p className="mt-0.5 text-sm text-white/60">
              30-day portfolio rollup · {filtered.length} properties
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              disabled={!canPrev}
              onClick={() => canPrev && setSelectedWeek(weeks[weekIdx + 1])}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium text-white">
              {selectedWeek
                ? format(parseISO(selectedWeek), "MMM d, yyyy")
                : "Loading..."}
            </span>
            <Button
              variant="ghost" size="sm"
              disabled={!canNext}
              onClick={() => canNext && setSelectedWeek(weeks[weekIdx - 1])}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Loading / Error */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && summary && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <SummaryCard
                label="Avg Occupancy"
                value={summary.avg_occupancy}
                format={fmtPct}
                icon={BarChart3}
                color="bg-blue-600"
              />
              <SummaryCard
                label="Avg CIR"
                value={summary.avg_cir}
                format={fmtPct}
                trend={summary.avg_cir_trend_pct}
                icon={Zap}
                color="bg-teal-600"
              />
              <SummaryCard
                label="Total Sessions"
                value={summary.total_sessions}
                format={fmtSessions}
                trend={summary.avg_sessions_trend_pct}
                icon={Activity}
                color="bg-indigo-600"
              />
              <SummaryCard
                label="Avg PageSpeed"
                value={summary.avg_mobile_pagespeed}
                format={fmtScore}
                icon={Gauge}
                color="bg-purple-600"
              />
              <SummaryCard
                label="Avg Review Score"
                value={summary.avg_review_score}
                format={fmtRating}
                icon={Star}
                color="bg-amber-500"
              />
              <SummaryCard
                label="Total Ad Spend"
                value={summary.total_ad_spend}
                format={fmtDollar}
                icon={DollarSign}
                color="bg-rose-600"
              />
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search properties..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-slate-500">
                {filtered.length} of {data.communities.length} properties
              </p>
            </div>

            {/* Property Table */}
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      {COLUMNS.map((col) => (
                        <TableHead
                          key={col.key}
                          className={`cursor-pointer select-none whitespace-nowrap text-xs hover:bg-slate-100 ${col.className ?? ""}`}
                          onClick={() => toggleSort(col.key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.shortLabel ?? col.label}
                            {sortKey === col.key ? (
                              sortDir === "asc"
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-slate-300" />
                            )}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.community_id} className="hover:bg-blue-50/50">
                        {/* Property Name — clickable for future drill-down */}
                        <TableCell className="whitespace-nowrap font-medium text-slate-900">
                          <a
                            href={`/pib/property?id=${row.community_id}`}
                            className="text-[#15284B] hover:underline"
                          >
                            {row.community_name}
                          </a>
                        </TableCell>

                        {/* Occupancy */}
                        <TableCell className={`text-right tabular-nums ${occupancyColor(row.occupancy)}`}>
                          {row.occupancy != null ? `${row.occupancy.toFixed(1)}%` : "—"}
                        </TableCell>

                        {/* ATR */}
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.atr != null ? `${row.atr.toFixed(1)}%` : "—"}
                        </TableCell>

                        {/* CIR */}
                        <TableCell className={`text-right tabular-nums ${cirColor(row.cir_status)}`}>
                          {row.cir_value != null ? `${row.cir_value.toFixed(1)}%` : "—"}
                        </TableCell>

                        {/* Sessions */}
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.total_sessions != null ? row.total_sessions.toLocaleString() : "—"}
                        </TableCell>

                        {/* Session Trend */}
                        <TableCell className="text-center">
                          {row.sessions_trend_pct != null ? (
                            <TrendIndicator value={row.sessions_trend_pct} isPercentage decimalPlaces={1} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>

                        {/* PageSpeed Mobile */}
                        <TableCell className={`text-right tabular-nums ${pagespeedColor(row.mobile_score)}`}>
                          {row.mobile_score != null ? row.mobile_score : "—"}
                        </TableCell>

                        {/* Review Score */}
                        <TableCell className={`text-right tabular-nums ${ratingColor(row.avg_rating)}`}>
                          {row.avg_rating != null ? row.avg_rating.toFixed(2) : "—"}
                        </TableCell>

                        {/* GC per Door */}
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.gc_per_door != null ? row.gc_per_door.toFixed(3) : "—"}
                        </TableCell>

                        {/* GBP Action Rate */}
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.gbp_action_rate != null ? `${row.gbp_action_rate.toFixed(1)}%` : "—"}
                        </TableCell>

                        {/* GSC Avg Position */}
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.gsc_avg_position != null ? row.gsc_avg_position.toFixed(1) : "—"}
                        </TableCell>

                        {/* Ad Spend (PPC + Remarketing) */}
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {row.google_ppc != null || row.google_remarketing != null
                            ? `$${((row.google_ppc ?? 0) + (row.google_remarketing ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-slate-400">
                          No properties match your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
