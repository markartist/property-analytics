"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getHealthStatus,
  type HealthStatusResponse, type TableStat, type CoverageRow,
} from "@/lib/api";
import {
  Eye, Loader2, ArrowLeft, CheckCircle2, XCircle,
  Database, Clock, Activity, Layers, Search,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

// ────────────────────────────────────────────────────────────────
// Freshness helpers
// ────────────────────────────────────────────────────────────────

function freshnessInfo(dateStr: string | null): { days: number; label: string; color: string; bg: string } {
  if (!dateStr) return { days: -1, label: "No data", color: "text-red-600", bg: "bg-red-100" };
  const days = differenceInDays(new Date(), parseISO(dateStr));
  if (days <= 7) return { days, label: `${days}d`, color: "text-emerald-700", bg: "bg-emerald-100" };
  if (days <= 14) return { days, label: `${days}d`, color: "text-amber-700", bg: "bg-amber-100" };
  return { days, label: `${days}d`, color: "text-red-700", bg: "bg-red-100" };
}

// ────────────────────────────────────────────────────────────────
// Health score gauge
// ────────────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "stroke-emerald-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500";
  const textColor = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" className={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${textColor}`}>{score}%</span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600">Data Coverage</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function WatchtowerPage() {
  const [data, setData] = React.useState<HealthStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    getHealthStatus()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredMatrix = React.useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data.coverage_matrix;
    const q = searchQuery.toLowerCase();
    return data.coverage_matrix.filter((r) => r.community_name.toLowerCase().includes(q));
  }, [data, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-[#0D5E6D] px-6 py-5">
        <div className="mx-auto max-w-[1400px] flex items-center gap-4">
          <Link href="/" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Eye className="h-6 w-6 text-white/70" />
          <div>
            <h1 className="text-xl font-bold text-white">The Watchtower</h1>
            <p className="text-sm text-white/50">System health, data freshness, and coverage monitoring</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}
        {data && !loading && (
          <>
            {/* ── Top stats row ─── */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {/* Health gauge */}
              <Card className="md:row-span-2">
                <CardContent className="flex h-full items-center justify-center p-6">
                  <HealthGauge score={data.health_score} />
                </CardContent>
              </Card>

              {/* Quick stats */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#0D5E6D]/10 p-2"><Database className="h-5 w-5 text-[#0D5E6D]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{data.community_count}</p>
                      <p className="text-xs text-slate-500">Active Properties</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#0D5E6D]/10 p-2"><Layers className="h-5 w-5 text-[#0D5E6D]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{data.data_sources.length}</p>
                      <p className="text-xs text-slate-500">Data Sources</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#0D5E6D]/10 p-2"><Activity className="h-5 w-5 text-[#0D5E6D]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {data.filled_cells.toLocaleString()}<span className="text-base text-slate-400">/{data.total_cells.toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-slate-500">Data Points Filled</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Data Freshness ─── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-[#0D5E6D]" />
                <h2 className="text-lg font-bold text-slate-900">Data Freshness</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-3">
                {data.table_stats.map((stat) => {
                  const f = freshnessInfo(stat.latest_date);
                  return (
                    <Card key={stat.key} className="transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{stat.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {stat.latest_date
                                ? format(parseISO(stat.latest_date), "MMM d, yyyy")
                                : "No data yet"}
                            </p>
                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                              <span>{stat.row_count.toLocaleString()} rows</span>
                              <span>·</span>
                              <span>{stat.distinct_weeks} weeks</span>
                              <span>·</span>
                              <span>{stat.latest_coverage}/{data.community_count} properties</span>
                            </div>
                          </div>
                          <Badge className={`${f.bg} ${f.color} border-0 text-xs font-bold`}>
                            {f.label}
                          </Badge>
                        </div>
                        {/* Coverage bar */}
                        <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              stat.latest_coverage / data.community_count >= 0.9 ? "bg-emerald-500" :
                              stat.latest_coverage / data.community_count >= 0.5 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${data.community_count > 0 ? (stat.latest_coverage / data.community_count) * 100 : 0}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* ── Coverage Matrix ─── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-[#0D5E6D]" />
                  <h2 className="text-lg font-bold text-slate-900">Coverage Matrix</h2>
                  <span className="text-xs text-slate-400 ml-1">Latest week per data source</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter properties..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#0D5E6D] focus:outline-none focus:ring-1 focus:ring-[#0D5E6D]"
                  />
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Property
                          </th>
                          {data.data_sources.map((src) => (
                            <th key={src.key} className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                              {src.label.length > 10 ? src.key.toUpperCase() : src.label}
                            </th>
                          ))}
                          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMatrix.map((row) => {
                          const filled = Object.values(row.sources).filter(Boolean).length;
                          const total = data.data_sources.length;
                          const pct = Math.round((filled / total) * 100);
                          const rowColor = pct === 100 ? "" : pct >= 50 ? "bg-amber-50/30" : "bg-red-50/30";
                          return (
                            <tr key={row.community_id} className={rowColor}>
                              <td className="sticky left-0 z-10 bg-inherit px-4 py-2 text-sm font-medium text-slate-900 whitespace-nowrap">
                                <Link href={`/pib/property?id=${row.community_id}`} className="hover:text-[#0D5E6D] hover:underline">
                                  {row.community_name}
                                </Link>
                              </td>
                              {data.data_sources.map((src) => (
                                <td key={src.key} className="px-2 py-2 text-center">
                                  {row.sources[src.key]
                                    ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                                    : <XCircle className="mx-auto h-4 w-4 text-slate-300" />}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center">
                                <span className={`text-xs font-bold tabular-nums ${
                                  pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                                }`}>
                                  {filled}/{total}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {/* Legend */}
              <div className="mt-3 flex items-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Data present</div>
                <div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-slate-300" /> Missing</div>
                <div className="ml-auto">
                  Showing {filteredMatrix.length} of {data.coverage_matrix.length} properties
                </div>
              </div>
            </div>

            {/* ── Table Statistics ─── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-5 w-5 text-[#0D5E6D]" />
                <h2 className="text-lg font-bold text-slate-900">Table Statistics</h2>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-2.5 text-left">Table</th>
                          <th className="px-4 py-2.5 text-right">Rows</th>
                          <th className="px-4 py-2.5 text-right">Weeks</th>
                          <th className="px-4 py-2.5 text-right">Latest Coverage</th>
                          <th className="px-4 py-2.5 text-left">Latest Date</th>
                          <th className="px-4 py-2.5 text-center">Freshness</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.table_stats.map((stat) => {
                          const f = freshnessInfo(stat.latest_date);
                          const covPct = data.community_count > 0
                            ? Math.round((stat.latest_coverage / data.community_count) * 100)
                            : 0;
                          return (
                            <tr key={stat.key}>
                              <td className="px-5 py-3 text-sm font-medium text-slate-900">{stat.label}</td>
                              <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">{stat.row_count.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">{stat.distinct_weeks}</td>
                              <td className="px-4 py-3 text-right text-sm tabular-nums">
                                <span className={covPct >= 90 ? "text-emerald-600" : covPct >= 50 ? "text-amber-600" : "text-red-600"}>
                                  {stat.latest_coverage}/{data.community_count}
                                </span>
                                <span className="ml-1 text-slate-400">({covPct}%)</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {stat.latest_date ? format(parseISO(stat.latest_date), "MMM d, yyyy") : "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge className={`${f.bg} ${f.color} border-0 text-xs font-bold`}>{f.label}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
