"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { getPibDetail, getPibWeeks, type PibDetailResponse } from "@/lib/api";
import {
  Gauge, Activity, Search, DollarSign, MapPin, Zap, Star, Users,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, ExternalLink,
  ArrowLeft,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────
// Pathname parser: /pib/property/<communityId>[/<section>]
// ────────────────────────────────────────────────────────────────

function usePathSegments() {
  const [segments, setSegments] = React.useState<{ communityId: string; section: string | null }>({
    communityId: "",
    section: null,
  });

  React.useEffect(() => {
    const p = window.location.pathname.replace(/\/+$/, "");
    // expected: /pib/property/<communityId>[/<section>]
    const parts = p.split("/").filter(Boolean); // ["pib","property","<id>","<section>?"]
    setSegments({
      communityId: parts[2] ?? "",
      section: parts[3] ?? null,
    });
  }, []);

  return segments;
}

// ────────────────────────────────────────────────────────────────
// Shared data hook
// ────────────────────────────────────────────────────────────────

function usePibDetail(communityId: string) {
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");

  const [data, setData] = React.useState<PibDetailResponse | null>(null);
  const [weeks, setWeeks] = React.useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = React.useState<string | null>(weekParam);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getPibWeeks().then((w) => {
      setWeeks(w);
      if (!selectedWeek && w.length > 0) setSelectedWeek(w[0]);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!communityId || !selectedWeek) return;
    setLoading(true);
    setError(null);
    getPibDetail(communityId, selectedWeek)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [communityId, selectedWeek]);

  const weekIdx = selectedWeek ? weeks.indexOf(selectedWeek) : -1;

  return {
    data, loading, error, selectedWeek, weeks, weekIdx,
    canPrev: weekIdx < weeks.length - 1,
    canNext: weekIdx > 0,
    prevWeek: () => weekIdx < weeks.length - 1 && setSelectedWeek(weeks[weekIdx + 1]),
    nextWeek: () => weekIdx > 0 && setSelectedWeek(weeks[weekIdx - 1]),
  };
}

// ────────────────────────────────────────────────────────────────
// Section shell
// ────────────────────────────────────────────────────────────────

function SectionShell({
  communityId, data, loading, error, selectedWeek,
  canPrev, canNext, prevWeek, nextWeek,
  title, icon: Icon, children,
}: {
  communityId: string;
  data: PibDetailResponse | null;
  loading: boolean;
  error: string | null;
  selectedWeek: string | null;
  canPrev: boolean; canNext: boolean;
  prevWeek: () => void; nextWeek: () => void;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const community = data?.community;
  const weekQ = selectedWeek ? `?week=${selectedWeek}` : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-[#15284B] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm"
              onClick={() => router.push(`/pib/property/${communityId}${weekQ}`)}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> {community?.name ?? "Back"}
            </Button>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-white/70" />
              <h1 className="text-lg font-bold text-white">{title}</h1>
            </div>
          </div>
          <WeekPicker week={selectedWeek} canPrev={canPrev} canNext={canNext} prev={prevWeek} next={nextWeek} />
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}
        {error && <Card className="border-red-200 bg-red-50"><CardContent className="flex items-center gap-3 p-4"><AlertCircle className="h-5 w-5 text-red-500" /><p className="text-sm text-red-700">{error}</p></CardContent></Card>}
        {!loading && !error && data && children}
      </div>
    </div>
  );
}

function WeekPicker({ week, canPrev, canNext, prev, next }: { week: string | null; canPrev: boolean; canNext: boolean; prev: () => void; next: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" disabled={!canPrev} onClick={prev} className="text-white/70 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-4 w-4" /></Button>
      <span className="min-w-[140px] text-center text-sm font-medium text-white">
        {week ? format(parseISO(week), "MMM d, yyyy") : "Loading..."}
      </span>
      <Button variant="ghost" size="sm" disabled={!canNext} onClick={next} className="text-white/70 hover:bg-white/10 hover:text-white"><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// HUB PAGE
// ────────────────────────────────────────────────────────────────

const HUB_SECTIONS: { key: string; label: string; icon: React.ElementType; color: string; metric: (d: PibDetailResponse) => { value: string; label: string; trend?: number | null } }[] = [
  { key: "site-performance", label: "Site Performance", icon: Gauge, color: "bg-purple-600",
    metric: (d) => ({ value: d.site_performance ? `${(d.site_performance as any).mobile_score ?? "—"} / ${(d.site_performance as any).desktop_score ?? "—"}` : "—", label: "Mobile / Desktop" }) },
  { key: "traffic", label: "Traffic & Engagement", icon: Activity, color: "bg-indigo-600",
    metric: (d) => ({ value: d.ga4 ? Number((d.ga4 as any).total_sessions ?? 0).toLocaleString() : "—", label: "Total Sessions", trend: d.ga4 ? (d.ga4 as any).sessions_trend_pct : null }) },
  { key: "search", label: "Search Performance", icon: Search, color: "bg-teal-600",
    metric: (d) => ({ value: d.search_performance ? Number((d.search_performance as any).gsc_avg_position ?? 0).toFixed(1) : "—", label: "Avg Position" }) },
  { key: "ads", label: "Advertising", icon: DollarSign, color: "bg-rose-600",
    metric: (d) => { const t = Number((d.marketing as any)?.google_ppc ?? 0) + Number((d.marketing as any)?.google_remarketing ?? 0); return { value: t > 0 ? `$${t.toLocaleString()}` : "—", label: "Total Ad Spend" }; } },
  { key: "local-presence", label: "Local Presence", icon: MapPin, color: "bg-amber-600",
    metric: (d) => ({ value: d.local_presence ? Number((d.local_presence as any).gbp_total_views ?? 0).toLocaleString() : "—", label: "GBP Views" }) },
  { key: "conversion", label: "Conversion & Leasing", icon: Zap, color: "bg-green-600",
    metric: (d) => ({ value: d.cir ? `${Number((d.cir as any).cir_value ?? 0).toFixed(1)}%` : "—", label: "CIR" }) },
  { key: "reviews", label: "Reviews & Reputation", icon: Star, color: "bg-yellow-500",
    metric: (d) => ({ value: d.reviews ? Number((d.reviews as any).avg_rating ?? 0).toFixed(2) : "—", label: "Avg Rating" }) },
  { key: "guest-cards", label: "Guest Cards", icon: Users, color: "bg-sky-600",
    metric: (d) => { const gc = d.leasing.t7 as any; return { value: gc ? String(gc.total_guest_cards ?? "—") : "—", label: "T7 Guest Cards" }; } },
];

function Hub({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const router = useRouter();
  const { data, loading, error, selectedWeek, canPrev, canNext, prevWeek, nextWeek } = ctx;
  const community = data?.community;
  const weekQ = selectedWeek ? `?week=${selectedWeek}` : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-[#15284B] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/pib")} className="text-white/70 hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1" /> Portfolio
            </Button>
            <div className="h-6 w-px bg-white/20" />
            <div>
              <h1 className="text-xl font-bold text-white">{community?.name ?? "Loading..."}</h1>
              {community && (
                <p className="mt-0.5 text-sm text-white/60">
                  {[community.city, community.state].filter(Boolean).join(", ")}
                  {community.full_url && <a href={community.full_url as string} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-white/40 hover:text-white/70"><ExternalLink className="h-3 w-3" /></a>}
                </p>
              )}
            </div>
          </div>
          <WeekPicker week={selectedWeek} canPrev={canPrev} canNext={canNext} prev={prevWeek} next={nextWeek} />
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}
        {error && <Card className="border-red-200 bg-red-50"><CardContent className="flex items-center gap-3 p-4"><AlertCircle className="h-5 w-5 text-red-500" /><p className="text-sm text-red-700">{error}</p></CardContent></Card>}
        {!loading && !error && data && (
          <>
            {/* Quick Stats */}
            <div className="flex flex-wrap gap-3">
              {data.marketing && (
                <>
                  <Badge variant="outline" className="text-sm py-1 px-3">Occupancy: {(data.marketing as any).occupancy != null ? `${Number((data.marketing as any).occupancy).toFixed(1)}%` : "—"}</Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">ATR: {(data.marketing as any).atr != null ? `${Number((data.marketing as any).atr).toFixed(1)}%` : "—"}</Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">Units: {community?.unit_count ?? "—"}</Badge>
                </>
              )}
              {data.cir && (
                <Badge variant="outline" className={`text-sm py-1 px-3 ${
                  (data.cir as any).cir_status === "strong" ? "border-green-300 text-green-700" :
                  (data.cir as any).cir_status === "moderate" ? "border-amber-300 text-amber-700" :
                  (data.cir as any).cir_status === "low" ? "border-orange-300 text-orange-700" :
                  (data.cir as any).cir_status === "critical" ? "border-red-300 text-red-700" : ""
                }`}>CIR: {(data.cir as any).cir_status?.toUpperCase() ?? "—"}</Badge>
              )}
            </div>
            {/* Section Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HUB_SECTIONS.map((sec) => {
                const m = sec.metric(data);
                const href = sec.key === "guest-cards"
                  ? `/pib/property/${communityId}/conversion${weekQ}`
                  : `/pib/property/${communityId}/${sec.key}${weekQ}`;
                return (
                  <Card key={sec.key} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => router.push(href)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{sec.label}</p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">{m.value}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{m.label}</p>
                          {m.trend != null && <div className="mt-1"><TrendIndicator value={m.trend} isPercentage decimalPlaces={1} /></div>}
                        </div>
                        <div className={`rounded-lg p-2 ${sec.color}`}><sec.icon className="h-5 w-5 text-white" /></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// SITE PERFORMANCE
// ────────────────────────────────────────────────────────────────

function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  const v = score ?? 0;
  const pct = Math.min(100, Math.max(0, v));
  const color = v >= 90 ? "text-green-500" : v >= 50 ? "text-amber-500" : "text-red-500";
  const ringColor = v >= 90 ? "stroke-green-500" : v >= 50 ? "stroke-amber-500" : "stroke-red-500";
  const r = 54, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle cx="60" cy="60" r={r} fill="none" className={ringColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className={`text-3xl font-bold ${color}`}>{score != null ? score : "—"}</span></div>
      </div>
      <span className="text-sm font-medium text-slate-600">{label}</span>
    </div>
  );
}

function CwvRow({ label, value, unit, threshold, good, poor }: { label: string; value: number | null; unit: string; threshold?: string; good: number; poor: number }) {
  let status: "good" | "mid" | "poor" = "mid";
  if (value != null) { if (value <= good) status = "good"; else if (value > poor) status = "poor"; }
  const cls = { good: "bg-green-100 text-green-700 border-green-200", mid: "bg-amber-100 text-amber-700 border-amber-200", poor: "bg-red-100 text-red-700 border-red-200" };
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div><p className="text-sm font-medium text-slate-900">{label}</p>{threshold && <p className="text-xs text-slate-500">{threshold}</p>}</div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tabular-nums text-slate-900">{value != null ? `${value}${unit}` : "—"}</span>
        {value != null && <Badge variant="outline" className={`text-xs ${cls[status]}`}>{status === "good" ? "Pass" : status === "poor" ? "Fail" : "Needs Work"}</Badge>}
      </div>
    </div>
  );
}

function SitePerformanceSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const sp = ctx.data?.site_performance as Record<string, any> | null;
  return (
    <SectionShell communityId={communityId} {...ctx} title="Site Performance" icon={Gauge}>
      <Card><CardContent className="p-6">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">PageSpeed Scores</h2>
        <div className="flex flex-wrap items-center justify-center gap-12">
          <ScoreGauge label="Mobile" score={sp?.mobile_score ?? null} />
          <ScoreGauge label="Desktop" score={sp?.desktop_score ?? null} />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Core Web Vitals</h2>
        <div className="space-y-3">
          <CwvRow label="Largest Contentful Paint (LCP)" value={sp?.lcp_ms ?? null} unit="ms" threshold="Good ≤ 2500ms" good={2500} poor={4000} />
          <CwvRow label="Cumulative Layout Shift (CLS)" value={sp?.cls != null ? Math.round(sp.cls * 1000) / 1000 : null} unit="" threshold="Good ≤ 0.1" good={0.1} poor={0.25} />
          <CwvRow label="First Input Delay (FID)" value={sp?.fid_ms ?? null} unit="ms" threshold="Good ≤ 100ms" good={100} poor={300} />
          <CwvRow label="First Contentful Paint (FCP)" value={sp?.fcp_ms ?? null} unit="ms" threshold="Good ≤ 1800ms" good={1800} poor={3000} />
          <CwvRow label="Time to First Byte (TTFB)" value={sp?.ttfb_ms ?? null} unit="ms" threshold="Good ≤ 800ms" good={800} poor={1800} />
        </div>
      </CardContent></Card>
      {(sp?.gtmetrix_grade || sp?.gtmetrix_performance != null || sp?.gtmetrix_structure != null) && (
        <Card><CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">GTMetrix</h2>
          <div className="grid grid-cols-3 gap-6 text-center">
            {sp?.gtmetrix_grade && <div><p className="text-3xl font-bold text-slate-900">{sp.gtmetrix_grade}</p><p className="text-xs text-slate-500">Grade</p></div>}
            {sp?.gtmetrix_performance != null && <div><p className="text-3xl font-bold text-slate-900">{sp.gtmetrix_performance}%</p><p className="text-xs text-slate-500">Performance</p></div>}
            {sp?.gtmetrix_structure != null && <div><p className="text-3xl font-bold text-slate-900">{sp.gtmetrix_structure}%</p><p className="text-xs text-slate-500">Structure</p></div>}
          </div>
        </CardContent></Card>
      )}
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// TRAFFIC
// ────────────────────────────────────────────────────────────────

function SourceBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-600">{value.toLocaleString()} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}

function TrafficSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const ga4 = ctx.data?.ga4 as Record<string, any> | null;
  const sessions = Number(ga4?.total_sessions ?? 0);
  const organic = Number(ga4?.organic_sessions ?? 0);
  const direct = Number(ga4?.direct_sessions ?? 0);
  const paid = Number(ga4?.paid_sessions ?? 0);
  const referral = Number(ga4?.referral_sessions ?? 0);
  const social = Number(ga4?.social_sessions ?? 0);
  const otherSrc = Math.max(0, sessions - organic - direct - paid - referral - social);
  const desktop = Number(ga4?.desktop_sessions ?? 0);
  const mobile = Number(ga4?.mobile_sessions ?? 0);
  const tablet = Number(ga4?.tablet_sessions ?? 0);

  const Stat = ({ label, value, fmt }: { label: string; value: unknown; fmt?: (v: number) => string }) => {
    const n = Number(value); const d = value != null && !isNaN(n) ? (fmt ? fmt(n) : n.toLocaleString()) : "—";
    return <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-slate-900">{d}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
  };

  return (
    <SectionShell communityId={communityId} {...ctx} title="Traffic & Engagement" icon={Activity}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total Sessions" value={ga4?.total_sessions} />
        <Stat label="Total Users" value={ga4?.total_users} />
        <Stat label="New Users" value={ga4?.new_users} />
        <Stat label="Engagement Rate" value={ga4?.engagement_rate} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
      </div>
      {(ga4?.sessions_trend_pct != null || ga4?.sessions_prev_period != null) && (
        <Card><CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Session Trend</h2>
          <div className="flex items-center gap-6">
            <div><p className="text-sm text-slate-500">Current Period</p><p className="text-2xl font-bold">{sessions.toLocaleString()}</p></div>
            {ga4?.sessions_prev_period != null && <div><p className="text-sm text-slate-500">Previous Period</p><p className="text-2xl font-bold text-slate-500">{Number(ga4.sessions_prev_period).toLocaleString()}</p></div>}
            {ga4?.sessions_trend_pct != null && <TrendIndicator value={ga4.sessions_trend_pct} isPercentage decimalPlaces={1} />}
          </div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Traffic Sources</h2>
        <div className="space-y-4">
          <SourceBar label="Organic Search" value={organic} total={sessions} />
          <SourceBar label="Direct" value={direct} total={sessions} />
          <SourceBar label="Paid Search" value={paid} total={sessions} />
          <SourceBar label="Referral" value={referral} total={sessions} />
          <SourceBar label="Social" value={social} total={sessions} />
          {otherSrc > 0 && <SourceBar label="Other" value={otherSrc} total={sessions} />}
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Device Breakdown</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[{ l: "Mobile", v: mobile }, { l: "Desktop", v: desktop }, { l: "Tablet", v: tablet }].map(({ l, v }) => (
            <div key={l} className="rounded-lg border p-4">
              <p className="text-2xl font-bold text-slate-900">{v.toLocaleString()}</p>
              <p className="text-xs text-slate-500">{l}</p>
              {sessions > 0 && <p className="text-xs text-slate-400">{((v / sessions) * 100).toFixed(1)}%</p>}
            </div>
          ))}
        </div>
      </CardContent></Card>
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────────────────────

function SearchSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const sp = ctx.data?.search_performance as Record<string, any> | null;
  const keywords: { query: string; clicks: number; impressions: number; ctr: number; position: number }[] = (sp as any)?.top_keywords ?? [];

  return (
    <SectionShell communityId={communityId} {...ctx} title="Search Performance" icon={Search}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { l: "Avg Position", v: sp?.gsc_avg_position != null ? Number(sp.gsc_avg_position).toFixed(1) : "—" },
          { l: "Total Clicks", v: sp?.gsc_total_clicks != null ? Number(sp.gsc_total_clicks).toLocaleString() : "—" },
          { l: "Impressions", v: sp?.gsc_total_impressions != null ? Number(sp.gsc_total_impressions).toLocaleString() : "—" },
          { l: "CTR", v: sp?.gsc_avg_ctr != null ? `${(Number(sp.gsc_avg_ctr) * 100).toFixed(1)}%` : "—" },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-slate-900">{v}</p><p className="mt-1 text-xs text-slate-500">{l}</p></div>
        ))}
      </div>
      {keywords.length > 0 ? (
        <Card><CardContent className="p-0">
          <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-slate-900">Top Keywords</h2></div>
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead className="text-xs">Keyword</TableHead>
              <TableHead className="text-right text-xs">Clicks</TableHead>
              <TableHead className="text-right text-xs">Impressions</TableHead>
              <TableHead className="text-right text-xs">CTR</TableHead>
              <TableHead className="text-right text-xs">Position</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {keywords.map((kw, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-900">{kw.query}</TableCell>
                  <TableCell className="text-right tabular-nums">{kw.clicks?.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{kw.impressions?.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{kw.ctr != null ? `${(kw.ctr * 100).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{kw.position != null ? kw.position.toFixed(1) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="py-10 text-center text-slate-400">No keyword data available for this week.</CardContent></Card>
      )}
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// ADS
// ────────────────────────────────────────────────────────────────

function AdsSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const mkt = ctx.data?.marketing as Record<string, any> | null;
  const ppc = Number(mkt?.google_ppc ?? 0);
  const rm = Number(mkt?.google_remarketing ?? 0);
  const total = ppc + rm;
  const ppcPct = total > 0 ? (ppc / total) * 100 : 0;
  const rmPct = total > 0 ? (rm / total) * 100 : 0;
  const fmtD = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <SectionShell communityId={communityId} {...ctx} title="Advertising" icon={DollarSign}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-6 text-center"><p className="text-3xl font-bold text-slate-900">{fmtD(total)}</p><p className="mt-1 text-sm text-slate-500">Total Ad Spend</p></div>
        <div className="rounded-lg border p-6 text-center"><p className="text-3xl font-bold text-indigo-600">{fmtD(ppc)}</p><p className="mt-1 text-sm text-slate-500">Google PPC</p>{total > 0 && <p className="text-xs text-slate-400">{ppcPct.toFixed(1)}% of total</p>}</div>
        <div className="rounded-lg border p-6 text-center"><p className="text-3xl font-bold text-purple-600">{fmtD(rm)}</p><p className="mt-1 text-sm text-slate-500">Remarketing</p>{total > 0 && <p className="text-xs text-slate-400">{rmPct.toFixed(1)}% of total</p>}</div>
      </div>
      {total > 0 && (
        <Card><CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Spend Breakdown</h2>
          <div className="flex h-8 overflow-hidden rounded-full">
            {ppc > 0 && <div className="bg-indigo-500 flex items-center justify-center text-xs font-medium text-white" style={{ width: `${ppcPct}%` }}>{ppcPct > 15 ? `PPC ${ppcPct.toFixed(0)}%` : ""}</div>}
            {rm > 0 && <div className="bg-purple-500 flex items-center justify-center text-xs font-medium text-white" style={{ width: `${rmPct}%` }}>{rmPct > 15 ? `RM ${rmPct.toFixed(0)}%` : ""}</div>}
          </div>
          <div className="mt-3 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-indigo-500" /><span className="text-slate-600">PPC</span></div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-purple-500" /><span className="text-slate-600">Remarketing</span></div>
          </div>
        </CardContent></Card>
      )}
      {total === 0 && <Card><CardContent className="py-10 text-center text-slate-400">No advertising spend data for this week.</CardContent></Card>}
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// LOCAL PRESENCE
// ────────────────────────────────────────────────────────────────

function LocalPresenceSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const lp = ctx.data?.local_presence as Record<string, any> | null;
  const totalViews = Number(lp?.gbp_total_views ?? 0);
  const mapViews = Number(lp?.gbp_maps_views ?? 0);
  const searchViews = Number(lp?.gbp_search_views ?? 0);
  const websiteClicks = Number(lp?.gbp_website_clicks ?? 0);
  const phoneClicks = Number(lp?.gbp_phone_clicks ?? 0);
  const directionClicks = Number(lp?.gbp_direction_clicks ?? 0);
  const totalActions = websiteClicks + phoneClicks + directionClicks;
  const actionRate = Number(lp?.gbp_action_rate ?? 0);

  return (
    <SectionShell communityId={communityId} {...ctx} title="Local Presence" icon={MapPin}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalViews.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Total Views</p>
          {lp?.gbp_views_trend_pct != null && <div className="mt-1 flex justify-center"><TrendIndicator value={lp.gbp_views_trend_pct} isPercentage decimalPlaces={1} /></div>}
        </div>
        <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-slate-900">{totalActions.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Total Actions</p></div>
        <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-slate-900">{actionRate.toFixed(1)}%</p><p className="mt-1 text-xs text-slate-500">Action Rate</p></div>
        <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-slate-900">{lp?.gbp_avg_rating != null ? Number(lp.gbp_avg_rating).toFixed(2) : "—"}</p><p className="mt-1 text-xs text-slate-500">GBP Rating</p></div>
      </div>
      <Card><CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Views Breakdown</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center"><p className="text-3xl font-bold text-blue-600">{mapViews.toLocaleString()}</p><p className="text-sm text-slate-500">Maps Views</p>{totalViews > 0 && <p className="text-xs text-slate-400">{((mapViews / totalViews) * 100).toFixed(1)}%</p>}</div>
          <div className="text-center"><p className="text-3xl font-bold text-indigo-600">{searchViews.toLocaleString()}</p><p className="text-sm text-slate-500">Search Views</p>{totalViews > 0 && <p className="text-xs text-slate-400">{((searchViews / totalViews) * 100).toFixed(1)}%</p>}</div>
        </div>
        {totalViews > 0 && <div className="mt-4 flex h-4 overflow-hidden rounded-full"><div className="bg-blue-500" style={{ width: `${(mapViews / totalViews) * 100}%` }} /><div className="bg-indigo-500" style={{ width: `${(searchViews / totalViews) * 100}%` }} /></div>}
      </CardContent></Card>
      <Card><CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Actions Breakdown</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          {[{ l: "Website Clicks", v: websiteClicks, c: "text-green-600" }, { l: "Phone Calls", v: phoneClicks, c: "text-amber-600" }, { l: "Directions", v: directionClicks, c: "text-rose-600" }].map(({ l, v, c }) => (
            <div key={l} className="rounded-lg border p-4"><p className={`text-2xl font-bold ${c}`}>{v.toLocaleString()}</p><p className="text-xs text-slate-500">{l}</p>{totalActions > 0 && <p className="text-xs text-slate-400">{((v / totalActions) * 100).toFixed(1)}%</p>}</div>
          ))}
        </div>
      </CardContent></Card>
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// CONVERSION
// ────────────────────────────────────────────────────────────────

function ConversionSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const cir = ctx.data?.cir as Record<string, any> | null;
  const mkt = ctx.data?.marketing as Record<string, any> | null;
  const t7 = ctx.data?.leasing?.t7 as Record<string, any> | null;
  const t7p = ctx.data?.leasing?.t7_portfolio as Record<string, any> | null;
  const t30 = ctx.data?.leasing?.t30 as Record<string, any> | null;
  const t30p = ctx.data?.leasing?.t30_portfolio as Record<string, any> | null;
  const cirColor = (s: string | null) => s === "strong" ? "bg-green-100 text-green-700 border-green-200" : s === "moderate" ? "bg-amber-100 text-amber-700 border-amber-200" : s === "low" ? "bg-orange-100 text-orange-700 border-orange-200" : s === "critical" ? "bg-red-100 text-red-700 border-red-200" : "";

  return (
    <SectionShell communityId={communityId} {...ctx} title="Conversion & Leasing" icon={Zap}>
      <Card><CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Conversion Impact Rate (CIR)</h2>
        <div className="flex items-center gap-6">
          <p className="text-4xl font-bold text-slate-900">{cir?.cir_value != null ? `${Number(cir.cir_value).toFixed(1)}%` : "—"}</p>
          {cir?.cir_status && <Badge variant="outline" className={`text-sm py-1 px-3 ${cirColor(cir.cir_status)}`}>{String(cir.cir_status).toUpperCase()}</Badge>}
          {cir?.cir_trend_pct != null && <span className={`text-sm font-medium ${Number(cir.cir_trend_pct) >= 0 ? "text-green-600" : "text-red-600"}`}>{Number(cir.cir_trend_pct) >= 0 ? "+" : ""}{Number(cir.cir_trend_pct).toFixed(1)}% vs prior</span>}
        </div>
        {cir?.intent_events != null && <p className="mt-3 text-sm text-slate-500">Intent Events: <span className="font-semibold text-slate-700">{Number(cir.intent_events).toLocaleString()}</span></p>}
      </CardContent></Card>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { l: "Occupancy", v: mkt?.occupancy != null ? `${Number(mkt.occupancy).toFixed(1)}%` : "—" },
          { l: "ATR", v: mkt?.atr != null ? `${Number(mkt.atr).toFixed(1)}%` : "—" },
          { l: "GC / Door", v: mkt?.gc_per_door != null ? Number(mkt.gc_per_door).toFixed(3) : "—" },
          { l: "Total Units", v: String(ctx.data?.community?.unit_count ?? "—") },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-slate-900">{v}</p><p className="mt-1 text-xs text-slate-500">{l}</p></div>
        ))}
      </div>
      {(t7 || t30) && (
        <Card><CardContent className="p-0">
          <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-slate-900">Guest Card Metrics</h2></div>
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead className="text-xs">Metric</TableHead>
              <TableHead className="text-right text-xs">T7 Community</TableHead>
              <TableHead className="text-right text-xs">T7 Portfolio</TableHead>
              <TableHead className="text-right text-xs">T30 Community</TableHead>
              <TableHead className="text-right text-xs">T30 Portfolio</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {[
                { label: "Total Guest Cards", key: "total_guest_cards" },
                { label: "Approved", key: "approved" },
                { label: "Denied", key: "denied" },
                { label: "Cancelled", key: "cancelled" },
                { label: "Notice to Vacate", key: "ntv" },
                { label: "Move-ins", key: "move_ins" },
                { label: "Move-outs", key: "move_outs" },
              ].map(({ label, key }) => (
                <TableRow key={key}>
                  <TableCell className="font-medium text-slate-900">{label}</TableCell>
                  <TableCell className="text-right tabular-nums">{t7?.[key] != null ? Number(t7[key]).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{t7p?.[key] != null ? Number(t7p[key]).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{t30?.[key] != null ? Number(t30[key]).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{t30p?.[key] != null ? Number(t30p[key]).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// REVIEWS
// ────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-5 w-5 ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
    </div>
  );
}

function ReviewsSection({ communityId, ctx }: { communityId: string; ctx: ReturnType<typeof usePibDetail> }) {
  const rev = ctx.data?.reviews as Record<string, any> | null;
  const themes: Record<string, number> = (rev as any)?.themes ?? {};
  const criticalReviews: { reviewer: string; rating: number; comment: string; date: string }[] = (rev as any)?.critical_reviews ?? [];
  const avgRating = Number(rev?.avg_rating ?? 0);
  const reviewCount = Number(rev?.review_count ?? 0);
  const sentimentScore = rev?.sentiment_score != null ? Number(rev.sentiment_score) : null;
  const stars: { star: number; count: number }[] = [];
  for (let i = 5; i >= 1; i--) stars.push({ star: i, count: Number(rev?.[`star_${i}_count`] ?? 0) });
  const totalStarCount = stars.reduce((s, r) => s + r.count, 0);
  const sortedThemes = Object.entries(themes).sort((a, b) => b[1] - a[1]);

  return (
    <SectionShell communityId={communityId} {...ctx} title="Reviews & Reputation" icon={Star}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-3xl font-bold text-slate-900">{avgRating ? avgRating.toFixed(2) : "—"}</p>
          <div className="mt-1 flex justify-center"><StarRating rating={avgRating} /></div>
          <p className="mt-1 text-xs text-slate-500">Avg Rating</p>
        </div>
        <div className="rounded-lg border p-4 text-center"><p className="text-3xl font-bold text-slate-900">{reviewCount.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Total Reviews</p></div>
        <div className="rounded-lg border p-4 text-center"><p className="text-3xl font-bold text-slate-900">{sentimentScore != null ? `${(sentimentScore * 100).toFixed(0)}%` : "—"}</p><p className="mt-1 text-xs text-slate-500">Sentiment Score</p></div>
        <div className="rounded-lg border p-4 text-center"><p className="text-3xl font-bold text-slate-900">{rev?.response_rate != null ? `${(Number(rev.response_rate) * 100).toFixed(0)}%` : "—"}</p><p className="mt-1 text-xs text-slate-500">Response Rate</p></div>
      </div>
      {totalStarCount > 0 && (
        <Card><CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Star Distribution</h2>
          <div className="space-y-2">
            {stars.map(({ star, count }) => {
              const pct = totalStarCount > 0 ? (count / totalStarCount) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="w-8 text-right text-sm font-medium text-slate-600">{star}★</span>
                  <div className="flex-1 h-4 rounded-full bg-slate-100"><div className="h-4 rounded-full bg-amber-400" style={{ width: `${pct}%`, transition: "width 0.4s ease" }} /></div>
                  <span className="w-12 text-right text-sm tabular-nums text-slate-600">{count}</span>
                  <span className="w-12 text-right text-xs text-slate-400">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}
      {sortedThemes.length > 0 && (
        <Card><CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Review Themes</h2>
          <div className="flex flex-wrap gap-2">{sortedThemes.map(([theme, count]) => <Badge key={theme} variant="outline" className="text-sm py-1 px-3">{theme} <span className="ml-1 text-slate-400">({count})</span></Badge>)}</div>
        </CardContent></Card>
      )}
      {criticalReviews.length > 0 && (
        <Card><CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Critical Reviews</h2>
          <div className="space-y-4">
            {criticalReviews.map((cr, i) => (
              <div key={i} className="rounded-lg border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-center gap-3"><StarRating rating={cr.rating} /><span className="text-sm font-medium text-slate-700">{cr.reviewer}</span>{cr.date && <span className="text-xs text-slate-400">{cr.date}</span>}</div>
                <p className="mt-2 text-sm text-slate-700">{cr.comment}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
      {!rev && <Card><CardContent className="py-10 text-center text-slate-400">No review data available for this week.</CardContent></Card>}
    </SectionShell>
  );
}

// ────────────────────────────────────────────────────────────────
// ROUTER
// ────────────────────────────────────────────────────────────────

export default function PropertyPage() {
  const { communityId, section } = usePathSegments();
  const ctx = usePibDetail(communityId);

  if (!communityId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  switch (section) {
    case "site-performance": return <SitePerformanceSection communityId={communityId} ctx={ctx} />;
    case "traffic":          return <TrafficSection communityId={communityId} ctx={ctx} />;
    case "search":           return <SearchSection communityId={communityId} ctx={ctx} />;
    case "ads":              return <AdsSection communityId={communityId} ctx={ctx} />;
    case "local-presence":   return <LocalPresenceSection communityId={communityId} ctx={ctx} />;
    case "conversion":       return <ConversionSection communityId={communityId} ctx={ctx} />;
    case "reviews":          return <ReviewsSection communityId={communityId} ctx={ctx} />;
    default:                 return <Hub communityId={communityId} ctx={ctx} />;
  }
}
