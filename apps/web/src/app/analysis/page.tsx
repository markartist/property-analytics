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
  getAnalysis,
  type AnalysisMetric,
  type AnalysisResponse,
  type MarketingWeeklyRecord,
} from "@/lib/api";
import {
  BarChart2, Building, RefreshCw, FileDown, Calendar as CalendarIcon,
  AlertCircle, DollarSign, FileText, TrendingUp, TrendingDown,
  Search, MessageSquare, Percent, Users, ArrowRightLeft, NotebookText, UserCircle2,
} from "lucide-react";

const BRIEF_NAV_ITEMS: Array<{
  href?: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}> = [
  { href: "/communities", label: "Communities", description: "Manage properties and import-facing names.", icon: Building },
  { href: "/t7-metrics", label: "T7 Metrics", description: "Weekly leasing funnel updates and imports.", icon: CalendarIcon },
  { href: "/t30-metrics", label: "T30 Metrics", description: "Monthly leasing funnel updates and imports.", icon: TrendingUp },
  { href: "/marketing", label: "Marketing Data", description: "Website & SEO CSV import plus weekly marketing workflow.", icon: DollarSign },
  { href: "/analysis", label: "Analysis", description: "Main POP Brief performance view.", icon: BarChart2, active: true },
  { label: "Call Notes", description: "Reserved navigation slot from Base44; route not mounted yet.", icon: NotebookText },
  { href: "/backup", label: "Backup & Export", description: "Download CSV backups and create server artifacts.", icon: FileDown },
  { label: "Profile", description: "Reserved navigation slot from Base44; route not mounted yet.", icon: UserCircle2 },
];

interface MetricDef {
  label: string;
  key: string;
  format: "percent" | "number" | "currency";
  inverse?: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  { label: "Occupancy", key: "occupancy_rate", format: "percent" },
  { label: "Leased Rate", key: "leased_rate", format: "percent" },
  { label: "Traffic", key: "traffic_count", format: "number" },
  { label: "Applications", key: "applications_count", format: "number" },
  { label: "Move-Ins", key: "move_ins", format: "number" },
  { label: "Move-Outs", key: "move_outs", format: "number", inverse: true },
  { label: "Delinquency", key: "delinquency_rate", format: "percent", inverse: true },
];

function formatMetric(value: number | null | undefined, formatType: MetricDef["format"]): string {
  if (value == null) return "N/A";
  if (formatType === "percent") return `${(value * 100).toFixed(1)}%`;
  if (formatType === "currency") return `$${value.toLocaleString()}`;
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function compareToPortfolio(
  communityValue: number | null | undefined,
  portfolioValue: number | null | undefined,
  formatType: MetricDef["format"],
): number | null {
  if (communityValue == null || portfolioValue == null) return null;
  if (formatType === "percent") {
    return (communityValue - portfolioValue) * 100;
  }
  if (portfolioValue === 0) return communityValue === 0 ? 0 : 100;
  return ((communityValue - portfolioValue) / portfolioValue) * 100;
}

function PerformanceSummaryTable({
  title, community, portfolio,
}: {
  title: string; trendLabel: string;
  community: AnalysisMetric | null;
  portfolio: AnalysisMetric | null;
}) {
  if (!community) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h3 className="mb-2 text-xl font-semibold text-yellow-900">No Data Available</h3>
            <p className="text-yellow-700">No canonical weekly metrics are available for this community and date.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                <TableHead className="text-right">Portfolio Avg</TableHead>
                <TableHead className="text-center">vs Portfolio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRIC_DEFS.map((metric) => {
                const communityValue = community[metric.key as keyof AnalysisMetric] as number | null;
                const portfolioValue = portfolio?.[metric.key as keyof AnalysisMetric] as number | null;
                const vsPortfolio = compareToPortfolio(communityValue, portfolioValue, metric.format);
                return (
                  <TableRow key={metric.key}>
                    <TableCell className="font-medium text-slate-700">{metric.label}</TableCell>
                    <TableCell className="text-right text-lg font-bold text-slate-900">
                      {formatMetric(communityValue, metric.format)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-600">
                      {formatMetric(portfolioValue, metric.format)}
                    </TableCell>
                    <TableCell className="text-center">
                      {vsPortfolio != null ? (
                        <TrendIndicator value={vsPortfolio} isPositive={metric.inverse ? false : undefined} />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
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

function OverviewCards({
  t7Community,
  t7Portfolio,
  t30Community,
  t30Portfolio,
}: {
  t7Community: AnalysisMetric | null;
  t7Portfolio: AnalysisMetric | null;
  t30Community: AnalysisMetric | null;
  t30Portfolio: AnalysisMetric | null;
}) {
  const cards = [
    {
      title: "T7 Occupancy",
      value: formatMetric(t7Community?.occupancy_rate, "percent"),
      compare: compareToPortfolio(t7Community?.occupancy_rate, t7Portfolio?.occupancy_rate, "percent"),
      icon: Percent,
    },
    {
      title: "T30 Occupancy",
      value: formatMetric(t30Community?.occupancy_rate, "percent"),
      compare: compareToPortfolio(t30Community?.occupancy_rate, t30Portfolio?.occupancy_rate, "percent"),
      icon: Building,
    },
    {
      title: "T7 Traffic",
      value: formatMetric(t7Community?.traffic_count, "number"),
      compare: compareToPortfolio(t7Community?.traffic_count, t7Portfolio?.traffic_count, "number"),
      icon: Users,
    },
    {
      title: "T30 Applications",
      value: formatMetric(t30Community?.applications_count, "number"),
      compare: compareToPortfolio(t30Community?.applications_count, t30Portfolio?.applications_count, "number"),
      icon: ArrowRightLeft,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">{card.title}</span>
              <card.icon className="h-4 w-4 text-[#15284B]" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="mt-3">
              {card.compare != null ? (
                <TrendIndicator value={card.compare} />
              ) : (
                <span className="text-sm text-slate-400">No portfolio comparison</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function parseMentions(mentionsJson: string | null): string[] {
  if (!mentionsJson) return [];
  try {
    const parsed = JSON.parse(mentionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed).map((item) => String(item)).filter(Boolean);
    }
  } catch {
    return mentionsJson
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function MarketingWeeklyCard({ marketing }: { marketing: MarketingWeeklyRecord | null }) {
  if (!marketing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />Marketing Weekly
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No canonical `marketing_weekly` record is available for this community and week.
        </CardContent>
      </Card>
    );
  }

  const mentions = parseMentions(marketing.mentions_json);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />Marketing Weekly
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Leads</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{formatMetric(marketing.leads_count, "number")}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Cost / Lead</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{formatMetric(marketing.cost_per_lead, "currency")}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Ad Spend</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{formatMetric(marketing.ad_spend, "currency")}</div>
          </div>
        </div>

        {marketing.notes_text && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Weekly Notes</h3>
            <p className="whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-slate-700">{marketing.notes_text}</p>
          </div>
        )}

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MessageSquare className="h-4 w-4" />Mention Scan Inputs
          </h3>
          {mentions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mentions.map((mention) => (
                <span key={mention} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                  {mention}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No structured mentions recorded for this week.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NarrativeNotes({
  t7Community,
  t30Community,
}: {
  t7Community: AnalysisMetric | null;
  t30Community: AnalysisMetric | null;
}) {
  const notes = [
    { title: "T7 Operator Notes", body: t7Community?.notes_text ?? null },
    { title: "T30 Operator Notes", body: t30Community?.notes_text ?? null },
  ].filter((item) => item.body);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-500" />Metric Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.length > 0 ? notes.map((note) => (
          <div key={note.title}>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">{note.title}</h3>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{note.body}</p>
          </div>
        )) : (
          <p className="text-sm text-slate-500">No weekly notes are stored with the canonical metrics yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──

export default function AnalysisPage() {
  const [communityId, setCommunityId] = React.useState("");
  const [weekDate, setWeekDate] = React.useState<Date | null>(null);
  const [analysisData, setAnalysisData] = React.useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!communityId || !weekDate) {
      setAnalysisData(null);
      return;
    }
    setLoading(true);
    const weekEnding = format(weekDate, "yyyy-MM-dd");
    try {
      setAnalysisData(await getAnalysis({ community_id: communityId, week_ending: weekEnding }));
    } catch (err) {
      console.error("Analysis load error:", err);
      setAnalysisData(null);
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
            <CardTitle className="text-base">POP Brief Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {BRIEF_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const className = item.active
                  ? "rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-[#15284B]"
                  : item.href
                    ? "rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]"
                    : "rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500";

                const body = (
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                    </div>
                  </div>
                );

                if (!item.href) {
                  return <div key={item.label} className={className}>{body}</div>;
                }

                return (
                  <Link key={item.label} href={item.href} className={className}>
                    {body}
                  </Link>
                );
              })}

              <Link href="/analysis/search-intelligence" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-[#15284B] hover:border-[#15284B]/40 hover:bg-blue-100">
                <div className="flex items-start gap-3">
                  <Search className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Search Intelligence</div>
                    <p className="mt-1 text-xs text-slate-600">Governed adjunct workflow for keyword, competitor, and search brief generation.</p>
                  </div>
                </div>
              </Link>
              <Link href="/metrics-import" className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 hover:border-[#15284B]/30 hover:text-[#15284B]">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Weekly Metrics Import</div>
                    <p className="mt-1 text-xs text-slate-600">Dedicated admin import screen for canonical weekly metrics files.</p>
                  </div>
                </div>
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
            {analysisData?.community && (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#15284B]">
                      <Building className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{analysisData.community.name}</h2>
                      <p className="text-sm font-normal text-slate-600">{analysisData.community.region ?? "Region pending"} • {analysisData.community.status}</p>
                    </div>
                  </CardTitle>
                  <p className="text-sm font-medium text-slate-600">Week Ending: {format(weekDate, "MMMM d, yyyy")}</p>
                </CardHeader>
              </Card>
            )}

            <OverviewCards
              t7Community={analysisData?.metrics.t7_community ?? null}
              t7Portfolio={analysisData?.metrics.t7_portfolio ?? null}
              t30Community={analysisData?.metrics.t30_community ?? null}
              t30Portfolio={analysisData?.metrics.t30_portfolio ?? null}
            />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                <PerformanceSummaryTable
                  title="T7 Performance (Canonical Weekly Metrics)"
                  trendLabel="Trend"
                  community={analysisData?.metrics.t7_community ?? null}
                  portfolio={analysisData?.metrics.t7_portfolio ?? null}
                />
                <PerformanceSummaryTable
                  title="T30 Performance (Canonical Weekly Metrics)"
                  trendLabel="Trend"
                  community={analysisData?.metrics.t30_community ?? null}
                  portfolio={analysisData?.metrics.t30_portfolio ?? null}
                />
              </div>
              <div className="space-y-8">
                <MarketingWeeklyCard marketing={analysisData?.marketing ?? null} />
                <NarrativeNotes
                  t7Community={analysisData?.metrics.t7_community ?? null}
                  t30Community={analysisData?.metrics.t30_community ?? null}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
