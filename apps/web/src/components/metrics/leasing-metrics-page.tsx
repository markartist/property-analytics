"use client";

import React from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunitySelector } from "@/components/shared/community-selector";
import { WeekDatePicker } from "@/components/shared/week-date-picker";
import { MetricCard } from "@/components/shared/metric-card";
import { PasteMetricsData } from "@/components/metrics/paste-metrics-data";
import { CSVUpload } from "@/components/metrics/csv-upload";
import { ManualMetricsForm } from "@/components/metrics/manual-metrics-form";
import type { LeasingMetric, Community } from "@/lib/api";
import {
  BarChart3, Users, FileText, TrendingUp, Target,
  Upload, Edit, ClipboardPaste, Calendar as CalendarIcon, RefreshCw,
} from "lucide-react";

interface Props {
  /** "T7" or "T30" */
  period: "T7" | "T30";
  /** Number of days label */
  days: string;
  /** API helpers */
  getMetrics: (f: { community_id?: string; week_date?: string; type?: string }) => Promise<LeasingMetric[]>;
  upsertMetrics: (communityId: string, rows: Record<string, unknown>[]) => Promise<void>;
  deleteMetrics: (communityId: string, weekDate: string) => Promise<void>;
  getCommunities: () => Promise<Community[]>;
}

export function LeasingMetricsPage({ period, days, getMetrics, upsertMetrics, deleteMetrics, getCommunities }: Props) {
  const [communityId, setCommunityId] = React.useState("");
  const [communityData, setCommunityData] = React.useState<Community | null>(null);
  const [weekDate, setWeekDate] = React.useState<Date | null>(null);
  const [metrics, setMetrics] = React.useState<LeasingMetric | null>(null);
  const [portfolio, setPortfolio] = React.useState<LeasingMetric | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!communityId || !weekDate) {
      setMetrics(null);
      setPortfolio(null);
      return;
    }
    const dateStr = format(weekDate, "yyyy-MM-dd");
    try {
      const [commResults, portResults, communities] = await Promise.all([
        getMetrics({ community_id: communityId, week_date: dateStr, type: "community" }),
        getMetrics({ community_id: communityId, week_date: dateStr, type: "portfolio" }),
        getCommunities(),
      ]);
      setMetrics(commResults[0] ?? null);
      setPortfolio(portResults[0] ?? null);
      setCommunityData(communities.find((c) => c.id === communityId) ?? null);
    } catch (err) {
      console.error("Error loading metrics:", err);
      setMetrics(null);
      setPortfolio(null);
    }
  }, [communityId, weekDate, getMetrics, getCommunities]);

  React.useEffect(() => { load(); }, [load]);

  const handleNewData = async (rows: Record<string, unknown>[]) => {
    if (!communityId) return;
    setProcessing(true);
    try {
      // If rows have week_date, sync the date picker
      const firstDate = rows[0]?.week_date as string | undefined;
      if (firstDate && weekDate) {
        const dateStr = format(weekDate, "yyyy-MM-dd");
        // Delete existing for this community+date before upserting
        try { await deleteMetrics(communityId, dateStr); } catch { /* ok if nothing to delete */ }
      }
      await upsertMetrics(communityId, rows);
      // Sync date picker to the data's date if it differs
      if (firstDate) {
        const d = new Date(`${firstDate}T00:00:00`);
        if (!isNaN(d.getTime())) setWeekDate(d);
      }
      await load();
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = async () => {
    if (!communityId || !weekDate) return;
    if (!confirm(`Clear all ${period} data for this community and date? This cannot be undone.`)) return;
    setProcessing(true);
    try {
      await deleteMetrics(communityId, format(weekDate, "yyyy-MM-dd"));
      setMetrics(null);
      setPortfolio(null);
    } catch (err) {
      console.error("Error clearing:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#15284B]">{period} Metrics</h1>
            <p className="mt-2 text-slate-600">{days}-day performance analytics and trends</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WeekDatePicker value={weekDate} onChange={setWeekDate} />
            <CommunitySelector
              value={communityId}
              onValueChange={setCommunityId}
              placeholder={`Select community for ${period} analysis`}
            />
            <Button onClick={handleRefresh} disabled={refreshing || processing} variant="outline" size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Updating…" : "Update"}
            </Button>
            {communityId && weekDate && (
              <Button onClick={handleClear} disabled={processing} variant="destructive" size="sm">
                Clear Data
              </Button>
            )}
          </div>
        </div>

        {/* Empty states */}
        {!communityId ? (
          <Card><CardContent className="p-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Community</h3>
            <p className="text-slate-600">Choose a community to view {period} metrics and upload data.</p>
          </CardContent></Card>
        ) : !weekDate ? (
          <Card><CardContent className="p-12 text-center">
            <CalendarIcon className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Date</h3>
            <p className="text-slate-600">Choose a week ending date (Friday) to view {period} metrics.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-8">
            {/* Community Info */}
            {communityData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#15284B]">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{communityData.name}</h2>
                      <p className="text-sm font-normal text-slate-600">
                        {communityData.region} • {communityData.unit_count ?? "?"} units
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
              </Card>
            )}

            {/* Data input tabs */}
            <Card>
              <Tabs defaultValue="paste">
                <CardHeader>
                  <TabsList className="grid w-full grid-cols-3 md:w-[480px]">
                    <TabsTrigger value="paste"><ClipboardPaste className="mr-2 h-4 w-4" />Paste Data</TabsTrigger>
                    <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" />Upload CSV</TabsTrigger>
                    <TabsTrigger value="manual"><Edit className="mr-2 h-4 w-4" />Manual Entry</TabsTrigger>
                  </TabsList>
                </CardHeader>
                <TabsContent value="paste">
                  <PasteMetricsData onDataExtracted={handleNewData} title={`Paste ${period} Metrics from Spreadsheet`} />
                </TabsContent>
                <TabsContent value="upload">
                  <CSVUpload onDataExtracted={handleNewData} title={`Upload ${period} Metrics CSV`} />
                </TabsContent>
                <TabsContent value="manual">
                  <ManualMetricsForm onSubmit={handleNewData} communityId={communityId} />
                </TabsContent>
              </Tabs>
            </Card>

            {/* Loading / Data display */}
            {processing ? (
              <Card><CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-b-transparent" />
                <p className="text-slate-600">Processing data and refreshing metrics…</p>
              </CardContent></Card>
            ) : metrics ? (
              <>
                {/* Traffic */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{period} Traffic</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <MetricCard title="Guest Cards" value={metrics.g_cards ?? 0} delta={metrics.g_cards_delta} icon={FileText} />
                      <MetricCard title="Visits" value={metrics.visits ?? 0} delta={metrics.visits_delta} icon={Users} />
                      <MetricCard title="Applications" value={metrics.apps ?? 0} delta={metrics.apps_delta} icon={TrendingUp} />
                      <MetricCard title="C&Ds" value={metrics.c_and_ds ?? 0} delta={metrics.c_and_ds_delta} isPositiveChange={false} icon={Target} />
                      <MetricCard title="Move-Ins" value={metrics.move_ins ?? 0} delta={metrics.move_ins_delta} icon={Users} />
                    </div>
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <MetricCard title="First Tours" value={metrics.first_tours ?? 0} icon={Users} />
                      <MetricCard title="Leases" value={metrics.leases ?? 0} delta={metrics.leases_delta} icon={FileText} />
                      <MetricCard title="C&D % of GCs" value={`${(metrics.c_d_pct_of_gcs ?? 0).toFixed(1)}%`} delta={metrics.c_d_pct_of_gcs_delta} isPositiveChange={false} />
                    </div>

                    {portfolio && (
                      <div>
                        <h4 className="mb-3 font-semibold text-slate-900">Portfolio Comparison</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                          {([
                            ["Guest Cards", portfolio.g_cards],
                            ["Visits", portfolio.visits],
                            ["Applications", portfolio.apps],
                            ["C&Ds", portfolio.c_and_ds],
                            ["Move-Ins", portfolio.move_ins],
                          ] as const).map(([label, val]) => (
                            <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                              <p className="text-sm text-slate-600">Portfolio Avg</p>
                              <p className="font-bold text-slate-900">{Math.round(val ?? 0)}</p>
                              <Badge variant="outline">{label}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Conversions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{period} Conversions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <MetricCard title="Visit/GC Conv" value={`${(metrics.v_gc_conv ?? 0).toFixed(1)}%`} delta={metrics.v_gc_conv_delta} />
                      <MetricCard title="App/GC Conv" value={`${(metrics.a_gc_conv ?? 0).toFixed(1)}%`} delta={metrics.a_gc_conv_delta} />
                      <MetricCard title="Lease/GC Conv" value={`${(metrics.l_gc_conv ?? 0).toFixed(1)}%`} delta={metrics.l_gc_conv_delta} />
                      <MetricCard title="Move-In/GC Conv" value={`${(metrics.mi_gc_conv ?? 0).toFixed(1)}%`} delta={metrics.mi_gc_conv_delta} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <MetricCard title="L/V Ratio" value={`${(metrics.l_v_ratio ?? 0).toFixed(1)}%`} delta={metrics.l_v_ratio_delta} />
                      <MetricCard title="MI/V Ratio" value={`${(metrics.mi_v_ratio ?? 0).toFixed(1)}%`} delta={metrics.mi_v_ratio_delta} />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
