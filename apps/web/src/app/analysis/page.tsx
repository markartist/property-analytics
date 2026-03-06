"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommunitySelector } from "@/components/shared/community-selector";
import { WeekDatePicker } from "@/components/shared/week-date-picker";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import {
  getCommunities, getT7Metrics, getT30Metrics, getMarketingData,
  type LeasingMetric, type MarketingData, type Community,
} from "@/lib/api";
import {
  BarChart2, Building, RefreshCw, FileDown, Calendar as CalendarIcon,
  AlertCircle, DollarSign, FileText, TrendingUp, TrendingDown,
  Globe, Search, Star, Eye, Activity, Sparkles, ExternalLink,
  MessageSquare, Home, Percent,
} from "lucide-react";

// ── Performance Summary Table ──

interface MetricRow {
  label: string;
  key: string;
  deltaKey?: string;
  isPercentage?: boolean;
  isPerDoor?: boolean;
  isPositive?: boolean;
  hideTrend?: boolean;
  hidePortfolioAvg?: boolean;
  hideVsPortfolio?: boolean;
}

function PerformanceSummaryTable({
  title, trendLabel, community, portfolio, period,
}: {
  title: string; trendLabel: string;
  community: Record<string, unknown> | null;
  portfolio: Record<string, unknown> | null;
  period: "T7" | "T30";
}) {
  if (!community) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h3 className="mb-2 text-xl font-semibold text-yellow-900">No Data Available</h3>
            <p className="text-yellow-700">No {period} metrics have been uploaded for this community and date.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const baseMetrics: MetricRow[] = [
    { label: "Guest Cards", key: "g_cards", deltaKey: "g_cards_delta", hideVsPortfolio: true, hidePortfolioAvg: true },
    { label: "GC / Avail Door", key: "g_cards_per_available_door", isPerDoor: true },
    { label: "Visits", key: "visits", deltaKey: "visits_delta", hideVsPortfolio: true, hidePortfolioAvg: true },
    { label: "Applications", key: "apps", deltaKey: "apps_delta", hideVsPortfolio: true, hidePortfolioAvg: true },
    { label: "Leases", key: "leases", deltaKey: "leases_delta", hideVsPortfolio: true, hidePortfolioAvg: true },
    { label: "Visit/GC Conv", key: "v_gc_conv", deltaKey: "v_gc_conv_delta", isPercentage: true },
    { label: "App/GC Conv", key: "a_gc_conv", deltaKey: "a_gc_conv_delta", isPercentage: true },
    { label: "Lease/GC Conv", key: "l_gc_conv", deltaKey: "l_gc_conv_delta", isPercentage: true },
    { label: "L/V Ratio", key: "l_v_ratio", deltaKey: "l_v_ratio_delta", isPercentage: true },
    { label: "C&D % of GCs", key: "c_d_pct_of_gcs", isPercentage: true, isPositive: false, hideTrend: true },
    { label: "C&D % of GCs Δ", key: "c_d_pct_of_gcs_delta", deltaKey: "c_d_pct_of_gcs_delta", isPercentage: true, isPositive: false },
  ];

  const metrics = period === "T30"
    ? [baseMetrics[0], { label: "GC / Door", key: "g_cards_per_door", isPerDoor: true } as MetricRow, ...baseMetrics.slice(1)]
    : baseMetrics;

  const fmtVal = (v: unknown, isPct?: boolean, isPerDoor?: boolean): string => {
    if (v == null) return "N/A";
    const n = Number(v);
    if (isPct) return `${n.toFixed(1)}%`;
    if (isPerDoor) return n.toFixed(2);
    return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Community</TableHead>
                <TableHead className="text-center">{trendLabel}</TableHead>
                <TableHead className="text-right">Portfolio Avg</TableHead>
                <TableHead className="text-center">vs Portfolio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => {
                const cv = community?.[m.key] as number | null ?? null;
                const pv = portfolio?.[m.key] as number | null ?? null;
                const trend = m.deltaKey ? (community?.[m.deltaKey] as number | null ?? null) : null;
                let vsP: number | null = null;
                if (cv != null && pv != null && !m.hideVsPortfolio) {
                  if (m.isPerDoor || !m.isPercentage) {
                    vsP = pv !== 0 ? ((cv - pv) / pv) * 100 : cv > 0 ? 100 : 0;
                  } else {
                    vsP = cv - pv;
                  }
                }
                return (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium text-slate-700">{m.label}</TableCell>
                    <TableCell className="text-right text-lg font-bold text-slate-900">{fmtVal(cv, m.isPercentage, m.isPerDoor)}</TableCell>
                    <TableCell className="text-center">
                      {m.hideTrend ? <span className="text-slate-400">-</span>
                        : trend != null ? <TrendIndicator value={trend} isPercentage={m.isPercentage} isPositive={m.isPositive ?? undefined} />
                        : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-600">
                      {m.hidePortfolioAvg ? "" : fmtVal(pv, m.isPercentage, m.isPerDoor)}
                    </TableCell>
                    <TableCell className="text-center">
                      {vsP != null ? <TrendIndicator value={vsP} isPositive={m.isPositive ?? undefined} /> : <span className="text-slate-400">-</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Website & SEO Performance ──

function WebsiteSeoPerformance({ data, community }: { data: MarketingData | null; community: Community | null }) {
  const t7Engaged = data?.t7_engaged_sessions_delta as number | null ?? null;
  const t7Organic = data?.t7_organic_sessions_delta as number | null ?? null;
  const t30Engaged = data?.t30_engaged_sessions_delta as number | null ?? null;
  const t30Organic = data?.t30_organic_sessions_delta as number | null ?? null;
  const visibility = data?.t7_organic_visibility as number | null ?? null;
  const serpTraffic = data?.t7_serp_traffic as number | null ?? null;
  const websiteNotes = data?.website_notes as string | null ?? null;
  const seoNotes = data?.seo_notes as string | null ?? null;

  const hasAnyData = t7Engaged != null || t7Organic != null || t30Engaged != null || t30Organic != null || visibility != null || serpTraffic != null || websiteNotes || seoNotes;

  if (!hasAnyData) {
    return (
      <Card className="border-slate-200">
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-600" />Website & SEO Performance</CardTitle></CardHeader>
        <CardContent className="py-8 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">No Website & SEO data for this week.</p>
        </CardContent>
      </Card>
    );
  }

  const trafficMetrics = [
    { label: "Engaged Sessions", period: "T7 (WoW)", value: t7Engaged, icon: Activity },
    { label: "Organic Sessions", period: "T7 (WoW)", value: t7Organic, icon: Search },
    { label: "Engaged Sessions", period: "T30 (MoM)", value: t30Engaged, icon: Activity },
    { label: "Organic Sessions", period: "T30 (MoM)", value: t30Organic, icon: Search },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-600" />Website & SEO Performance</CardTitle>
          {community?.full_url && (
            <a href={community.full_url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ExternalLink className="h-3 w-3" />{new URL(community.full_url).hostname}
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Traffic Delta Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {trafficMetrics.map((m, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <m.icon className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">{m.period}</span>
              </div>
              <p className="mb-1 text-xs text-slate-600">{m.label}</p>
              {m.value != null ? (
                <TrendIndicator value={m.value} isPercentage decimalPlaces={1} />
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
          ))}
        </div>

        {/* Visibility & SERP badges */}
        {(visibility != null || serpTraffic != null) && (
          <div className="flex flex-wrap gap-3">
            {visibility != null && (
              <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2">
                <Eye className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-900">Organic Visibility: <strong>{visibility.toFixed(1)}</strong></span>
              </div>
            )}
            {serpTraffic != null && (
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2">
                <Search className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">SERP Traffic: <strong>{serpTraffic.toFixed(1)}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Website & SEO Notes */}
        {websiteNotes && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Globe className="h-3.5 w-3.5" />Website Insights
            </h4>
            <div className="space-y-1">
              {websiteNotes.split(/[;.]/).filter(Boolean).map((note, i) => (
                <p key={i} className="flex items-start gap-2 rounded-md bg-blue-50 p-2 text-sm text-blue-900">
                  <span className="mt-0.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                  {note.trim()}
                </p>
              ))}
            </div>
          </div>
        )}
        {seoNotes && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Search className="h-3.5 w-3.5" />SEO Insights
            </h4>
            <p className="whitespace-pre-wrap rounded-md bg-amber-50 p-3 text-sm text-amber-900">{seoNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Property Snapshot ──

function PropertySnapshot({ data, community }: { data: MarketingData | null; community: Community | null }) {
  const occupancy = data?.occupancy as number | null ?? null;
  const atr = data?.atr as number | null ?? null;
  const reviewCount = data?.google_review_count as number | null ?? null;
  const reviewScore = data?.google_review_score as number | null ?? null;
  const socialPosts = data?.social_posts_count as number | null ?? null;
  const floorplans = data?.most_common_floorplans as string | null ?? null;

  const hasData = occupancy != null || atr != null || reviewCount != null || reviewScore != null;
  if (!hasData && !community?.unit_count) return null;

  const renderStars = (score: number) => {
    const full = Math.floor(score);
    const half = score - full >= 0.3;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`h-4 w-4 ${
            i < full ? "fill-yellow-400 text-yellow-400"
            : i === full && half ? "fill-yellow-200 text-yellow-400"
            : "text-slate-300"
          }`} />
        ))}
        <span className="ml-1 text-sm font-bold text-slate-900">{score.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-[#15284B]" />Property Snapshot</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {community?.unit_count && (
          <div className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
            <span className="text-sm font-medium text-slate-600">Total Units</span>
            <span className="text-lg font-bold text-slate-900">{community.unit_count}</span>
          </div>
        )}
        {occupancy != null && (
          <div className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600"><Percent className="h-3.5 w-3.5" />Occupancy</span>
            <span className={`text-lg font-bold ${occupancy >= 95 ? "text-green-600" : occupancy >= 90 ? "text-yellow-600" : "text-red-600"}`}>{occupancy.toFixed(1)}%</span>
          </div>
        )}
        {atr != null && (
          <div className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
            <span className="text-sm font-medium text-slate-600">ATR (Avail to Rent)</span>
            <span className="text-lg font-bold text-slate-900">{atr.toFixed(1)}%</span>
          </div>
        )}
        {reviewScore != null && (
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600"><Star className="h-3.5 w-3.5" />Google Reviews</span>
              {reviewCount != null && <span className="text-xs text-slate-500">{reviewCount.toLocaleString()} reviews</span>}
            </div>
            {renderStars(reviewScore)}
          </div>
        )}
        {socialPosts != null && socialPosts > 0 && (
          <div className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600"><MessageSquare className="h-3.5 w-3.5" />Social Posts</span>
            <span className="text-lg font-bold text-slate-900">{socialPosts}</span>
          </div>
        )}
        {floorplans && (
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="mb-1 block text-sm font-medium text-slate-600">Most Requested Floorplans</span>
            <p className="text-sm text-slate-800">{floorplans}</p>
          </div>
        )}
        {community?.manager_name && community.manager_name !== "TBD" && (
          <div className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
            <span className="text-sm font-medium text-slate-600">Community Manager</span>
            <span className="text-sm font-bold text-slate-900">{community.manager_name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── AI Summary & Action Items ──

function AiSummarySection({ data }: { data: MarketingData | null }) {
  const summary = data?.ai_summary as string | null ?? null;
  const actions = data?.action_items as string | null ?? null;
  if (!summary && !actions) return null;

  return (
    <Card className="border-[#15284B]/20 bg-gradient-to-br from-slate-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#15284B]" />AI Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{summary}</p>
        )}
        {actions && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Action Items</h4>
            <div className="space-y-1">
              {actions.split(/[;\n]/).filter(Boolean).map((item, i) => (
                <p key={i} className="flex items-start gap-2 rounded-md bg-white/80 p-2 text-sm text-slate-700">
                  <span className="mt-1 block h-4 w-4 flex-shrink-0 rounded bg-[#15284B] text-center text-xs font-bold leading-4 text-white">{i + 1}</span>
                  {item.trim()}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Advertising Spend ──

function AdvertisingSpend({ data }: { data: MarketingData | null }) {
  const fields = [
    { key: "google_ppc", label: "Google PPC" },
    { key: "google_remarketing", label: "Google Remarketing" },
    { key: "apartments_com", label: "Apartments.com" },
    { key: "social", label: "Social" },
    { key: "zillow", label: "Zillow" },
    { key: "mailers", label: "Mailers" },
    { key: "kurie_video", label: "Kurie/Video" },
    { key: "other", label: "Other" },
  ];
  const total = fields.reduce((a, f) => a + (Number(data?.[f.key]) || 0), 0);
  const budget = Number(data?.monthly_budget) || 0;
  const variance = total - budget;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" />Advertising Spend</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
          <span className="text-sm font-medium text-slate-600">Monthly Budget</span>
          <span className="text-lg font-bold text-slate-900">${budget.toLocaleString()}</span>
        </div>
        <div className="space-y-1 border-t border-slate-200 pt-3">
          {fields.map((f) => {
            const v = Number(data?.[f.key]) || 0;
            return (
              <div key={f.key} className="flex items-baseline justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-medium text-slate-600">{f.label}</span>
                <span className="text-lg font-bold text-slate-900">{v ? `$${v.toLocaleString()}` : "N/A"}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-baseline justify-between rounded-lg bg-[#15284B] p-3 text-white">
          <span className="text-sm font-bold">Total Spend</span>
          <span className="text-xl font-bold">${total.toLocaleString()}</span>
        </div>
        {budget > 0 && (
          <div className={`flex items-center justify-between rounded-lg p-3 ${variance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            <div className="flex items-center gap-2">
              {variance > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-sm font-semibold">{variance > 0 ? "Over" : "Under"} Budget</span>
            </div>
            <span className="font-bold">{variance > 0 ? "+" : "-"}${Math.abs(variance).toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Notes Summary ──

function NotesSummary({ data }: { data: MarketingData | null }) {
  const notes = [
    { title: "Photo/Matterport Needs", key: "photography_needs" },
    { title: "Signage Needs", key: "signage_needs" },
    { title: "Capex Projects", key: "capex_projects" },
    { title: "Recent Pricing Call", key: "recent_pricing_call" },
    { title: "Current Specials", key: "current_specials" },
    { title: "Pricing Strategy", key: "pricing_strategy_notes" },
    { title: "Social Media", key: "social_media_notes" },
    { title: "Google Review Concerns", key: "google_review_concerns" },
  ];
  const hasNotes = notes.some((n) => data?.[n.key]);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-slate-500" />Marketing Notes</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {hasNotes ? notes.map((n) => {
          const val = data?.[n.key] as string | undefined;
          if (!val) return null;
          return (
            <div key={n.key}>
              <h4 className="mb-1 font-semibold text-slate-800">{n.title}</h4>
              <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-600">{val}</p>
            </div>
          );
        }) : <p className="py-4 text-center text-slate-500">No marketing notes for this week.</p>}
      </CardContent>
    </Card>
  );
}

// ── Page ──

export default function AnalysisPage() {
  const [communityId, setCommunityId] = React.useState("");
  const [weekDate, setWeekDate] = React.useState<Date | null>(null);
  const [communityInfo, setCommunityInfo] = React.useState<Community | null>(null);
  const [t7Comm, setT7Comm] = React.useState<Record<string, unknown> | null>(null);
  const [t7Port, setT7Port] = React.useState<Record<string, unknown> | null>(null);
  const [t30Comm, setT30Comm] = React.useState<Record<string, unknown> | null>(null);
  const [t30Port, setT30Port] = React.useState<Record<string, unknown> | null>(null);
  const [mktg, setMktg] = React.useState<MarketingData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!communityId || !weekDate) {
      setT7Comm(null); setT7Port(null); setT30Comm(null); setT30Port(null); setMktg(null); setCommunityInfo(null);
      return;
    }
    setLoading(true);
    const d = format(weekDate, "yyyy-MM-dd");
    try {
      const [comms, t7c, t7p, t30c, t30p, md] = await Promise.all([
        getCommunities(),
        getT7Metrics({ community_id: communityId, week_date: d, type: "community" }),
        getT7Metrics({ community_id: communityId, week_date: d, type: "portfolio" }),
        getT30Metrics({ community_id: communityId, week_date: d, type: "community" }),
        getT30Metrics({ community_id: communityId, week_date: d, type: "portfolio" }),
        getMarketingData({ community_id: communityId, week_date: d }),
      ]);
      setCommunityInfo(comms.find((c) => c.id === communityId) ?? null);
      const mdRow = md[0] ?? null;
      setMktg(mdRow);
      // Merge GC/door fields from marketing into metrics
      const merge = (m: LeasingMetric | undefined, prefix: "t7" | "t30", scope: "community" | "portfolio") => {
        if (!m) return null;
        const r: Record<string, unknown> = { ...m };
        r.g_cards_per_available_door = mdRow?.[`${prefix}_${scope}_gc_per_avail_door`] ?? null;
        if (prefix === "t30") r.g_cards_per_door = mdRow?.[`${prefix}_${scope}_gc_per_door`] ?? null;
        return r;
      };
      setT7Comm(merge(t7c[0], "t7", "community"));
      setT7Port(merge(t7p[0], "t7", "portfolio"));
      setT30Comm(merge(t30c[0], "t30", "community"));
      setT30Port(merge(t30p[0], "t30", "portfolio"));
    } catch (err) {
      console.error("Analysis load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId, weekDate]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#15284B]">POP Brief</h1>
            <p className="mt-2 text-slate-600">Unified property operations performance brief.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <WeekDatePicker value={weekDate} onChange={setWeekDate} />
            <CommunitySelector value={communityId} onValueChange={setCommunityId} placeholder="Select community to analyze" />
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!communityId || !weekDate}>
              <FileDown className="mr-2 h-4 w-4" />Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing || loading || !communityId || !weekDate}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Update
            </Button>
          </div>
        </div>

        <Card className="mb-6 border-slate-200 print:hidden">
          <CardHeader>
            <CardTitle className="text-base">POP Brief Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/analysis/pib" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <FileText className="mr-2 inline h-4 w-4" />PIB Builder
              </Link>
              <Link href="/analysis/gsc" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <Search className="mr-2 inline h-4 w-4" />GSC Snapshot
              </Link>
              <Link href="/pib" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <BarChart2 className="mr-2 inline h-4 w-4" />PIB Dashboard
              </Link>
              <Link href="/marketing" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <DollarSign className="mr-2 inline h-4 w-4" />Marketing Data
              </Link>
              <Link href="/t7-metrics" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <CalendarIcon className="mr-2 inline h-4 w-4" />T7 Metrics
              </Link>
              <Link href="/t30-metrics" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <TrendingUp className="mr-2 inline h-4 w-4" />T30 Metrics
              </Link>
            </div>
          </CardContent>
        </Card>

        {!communityId ? (
          <Card><CardContent className="p-12 text-center">
            <BarChart2 className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Community</h3>
            <p className="text-slate-600">Choose a community to generate a performance analysis.</p>
          </CardContent></Card>
        ) : !weekDate ? (
          <Card><CardContent className="p-12 text-center">
            <CalendarIcon className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Date</h3>
            <p className="text-slate-600">Choose a week ending date to generate an analysis.</p>
          </CardContent></Card>
        ) : loading ? (
          <Card><CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-b-transparent" />
            <p className="text-slate-600">Loading analysis data…</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-8">
            {communityInfo && (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#15284B]">
                      <Building className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{communityInfo.name}</h2>
                      <p className="text-sm font-normal text-slate-600">{communityInfo.region} • {communityInfo.unit_count ?? "?"} units</p>
                    </div>
                  </CardTitle>
                  <p className="text-sm font-medium text-slate-600">Week Ending: {format(weekDate, "MMMM d, yyyy")}</p>
                </CardHeader>
              </Card>
            )}

            {/* Website & SEO — full width */}
            <WebsiteSeoPerformance data={mktg} community={communityInfo} />

            {/* AI Summary — full width if present */}
            <AiSummarySection data={mktg} />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                <PerformanceSummaryTable title="T7 Performance (WoW)" trendLabel="Trend (WoW)" community={t7Comm} portfolio={t7Port} period="T7" />
                <PerformanceSummaryTable title="T30 Performance (MoM)" trendLabel="Trend (MoM)" community={t30Comm} portfolio={t30Port} period="T30" />
              </div>
              <div className="space-y-8">
                <PropertySnapshot data={mktg} community={communityInfo} />
                <AdvertisingSpend data={mktg} />
                <NotesSummary data={mktg} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
