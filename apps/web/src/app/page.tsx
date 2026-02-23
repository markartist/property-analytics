"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { format, previousFriday, isFriday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WeekDatePicker } from "@/components/shared/week-date-picker";
import {
  getCommunities, getT7Metrics, getT30Metrics, getMarketingData,
  type Community, type LeasingMetric, type MarketingData,
} from "@/lib/api";
import {
  CheckCircle2, XCircle, Calendar, TrendingUp, Megaphone,
  BarChart3, ArrowRight, Loader2,
} from "lucide-react";

interface CommunityStatus {
  community: Community;
  hasT7: boolean;
  hasT30: boolean;
  hasMktg: boolean;
  complete: boolean;
}

function getMostRecentFriday(): Date {
  const now = new Date();
  if (isFriday(now)) return now;
  return previousFriday(now);
}

export default function DashboardPage() {
  const [weekDate, setWeekDate] = React.useState<Date | null>(getMostRecentFriday);
  const [statuses, setStatuses] = React.useState<CommunityStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!weekDate) return;
    setLoading(true);
    setError(null);
    const d = format(weekDate, "yyyy-MM-dd");

    Promise.all([
      getCommunities(),
      getT7Metrics({ week_date: d, type: "community" }),
      getT30Metrics({ week_date: d, type: "community" }),
      getMarketingData({ week_date: d }),
    ])
      .then(([comms, t7, t30, mktg]) => {
        const t7Set = new Set(t7.map((m) => m.community_id));
        const t30Set = new Set(t30.map((m) => m.community_id));
        const mktgSet = new Set(mktg.map((m) => m.community_id));

        const rows: CommunityStatus[] = comms
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => {
            const hasT7 = t7Set.has(c.id);
            const hasT30 = t30Set.has(c.id);
            const hasMktg = mktgSet.has(c.id);
            return { community: c, hasT7, hasT30, hasMktg, complete: hasT7 && hasT30 && hasMktg };
          });
        setStatuses(rows);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [weekDate]);

  const total = statuses.length;
  const t7Count = statuses.filter((s) => s.hasT7).length;
  const t30Count = statuses.filter((s) => s.hasT30).length;
  const mktgCount = statuses.filter((s) => s.hasMktg).length;
  const completeCount = statuses.filter((s) => s.complete).length;
  const pct = total > 0 ? Math.round((completeCount / total) * 100) : 0;

  const dateStr = weekDate ? format(weekDate, "yyyy-MM-dd") : "";

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/velo-current.svg" alt="" width={32} height={19} className="text-[#15284B]" />
            <div>
              <h1 className="text-3xl font-bold text-[#15284B]">POP Brief</h1>
              <p className="text-sm text-slate-600">Property Ops Performance Brief — Venterra WebOps</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Week Ending:</span>
            <WeekDatePicker value={weekDate} onChange={setWeekDate} />
          </div>
        </div>

        {loading ? (
          <Card><CardContent className="flex items-center justify-center gap-3 p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="text-slate-600">Loading dashboard data…</span>
          </CardContent></Card>
        ) : error ? (
          <Card><CardContent className="p-12 text-center">
            <p className="text-red-600">{error}</p>
          </CardContent></Card>
        ) : (
          <>
            {/* Summary cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">Communities</p>
                  <p className="mt-1 text-3xl font-bold text-[#15284B]">{total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">T7 Data</p>
                  <p className="mt-1 text-3xl font-bold text-[#15284B]">{t7Count}<span className="text-lg text-slate-400">/{total}</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">T30 Data</p>
                  <p className="mt-1 text-3xl font-bold text-[#15284B]">{t30Count}<span className="text-lg text-slate-400">/{total}</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">Marketing</p>
                  <p className="mt-1 text-3xl font-bold text-[#15284B]">{mktgCount}<span className="text-lg text-slate-400">/{total}</span></p>
                </CardContent>
              </Card>
              <Card className="col-span-2 md:col-span-1">
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">Complete</p>
                  <p className={`mt-1 text-3xl font-bold ${pct === 100 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                    {pct}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Weekly data completeness</span>
                <span>{completeCount} of {total} communities fully entered</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Community status table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Community Data Status — {weekDate ? format(weekDate, "MMM d, yyyy") : ""}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-3">Community</th>
                        <th className="px-4 py-3">Region</th>
                        <th className="px-4 py-3 text-center">T7</th>
                        <th className="px-4 py-3 text-center">T30</th>
                        <th className="px-4 py-3 text-center">Marketing</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statuses.map((s) => (
                        <tr key={s.community.id} className={s.complete ? "" : "bg-amber-50/40"}>
                          <td className="px-6 py-3 text-sm font-medium text-slate-900">{s.community.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{s.community.region ?? "—"}</td>
                          <td className="px-4 py-3 text-center">
                            {s.hasT7
                              ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                              : <Link href="/t7-metrics" className="inline-block"><XCircle className="mx-auto h-4 w-4 text-red-400 hover:text-red-600" /></Link>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.hasT30
                              ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                              : <Link href="/t30-metrics" className="inline-block"><XCircle className="mx-auto h-4 w-4 text-red-400 hover:text-red-600" /></Link>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.hasMktg
                              ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                              : <Link href="/marketing" className="inline-block"><XCircle className="mx-auto h-4 w-4 text-red-400 hover:text-red-600" /></Link>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.complete
                              ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Complete</Badge>
                              : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Incomplete</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href="/analysis" className="text-[#15284B] hover:underline">
                              <ArrowRight className="inline h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
