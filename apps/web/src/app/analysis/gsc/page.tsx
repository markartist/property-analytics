"use client";

import React from "react";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateGscReport,
  getCommunities,
  type Community,
  type GscReportResponse,
  type GscSnapshotProperty,
} from "@/lib/api";
import {
  Loader2, Search, MousePointerClick, Eye, Percent, Mail, Download,
} from "lucide-react";

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
  if (ctr > 5) return "text-emerald-600";
  if (ctr >= 3) return "text-amber-600";
  return "text-red-500";
}

function fmtPct(n: number): React.ReactNode {
  const sign = n > 0 ? "+" : "";
  return (
    <span className={n > 0 ? "text-emerald-600" : n < 0 ? "text-red-500" : "text-slate-400"}>
      {sign}{n.toFixed(1)}%
    </span>
  );
}

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

function PropertyRow({ p }: { p: GscSnapshotProperty }) {
  const borderColor = p.ctr > 5 ? "border-l-emerald-500" : p.ctr >= 3 ? "border-l-amber-500" : "border-l-red-500";
  return (
    <div className={`flex items-center gap-4 border-b border-slate-100 border-l-4 ${borderColor} px-4 py-4 last:border-b-0 hover:bg-slate-50 transition-colors`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-slate-400">#{p.rank}.</span>
          <span className="font-semibold text-slate-900 truncate">{p.name}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            Clicks: <strong className="text-blue-600">{fmtNum(p.clicks)}</strong>
            <> <span className="text-slate-300">|</span> {fmtDelta(p.clicks_delta)}</>
          </span>
          <span>
            Impressions: <strong className="text-slate-700">{fmtNum(p.impressions)}</strong>
            <> <span className="text-slate-300">|</span> {fmtDelta(p.impressions_delta)}</>
          </span>
          <span>
            CTR: <strong className={ctrColor(p.ctr)}>{p.ctr.toFixed(2)}%</strong>
            <> <span className="text-slate-300">|</span> {fmtDeltaPct(p.ctr_delta)}</>
          </span>
        </div>
      </div>

      <div className="text-right shrink-0 w-20">
        <p className="text-2xl font-bold text-blue-600">{fmtNum(p.clicks)}</p>
        <p className="text-[10px] text-slate-400">clicks</p>
        <p className="text-xs">{fmtDelta(p.clicks_delta)}</p>
      </div>
    </div>
  );
}

function downloadBase64File(base64: string, filename: string, mime: string) {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GscSnapshotPage() {
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [scope, setScope] = React.useState<"portfolio" | "property">("portfolio");
  const [communityId, setCommunityId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [email, setEmail] = React.useState("");

  const [data, setData] = React.useState<GscReportResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([getCommunities()])
      .then(([communityRows]) => {
        setCommunities(communityRows.filter((c) => c.status !== "inactive"));
        const today = new Date();
        const end = new Date(today.getTime() - 24 * 3600 * 1000);
        const start = new Date(end.getTime() - 29 * 24 * 3600 * 1000);
        setEndDate(end.toISOString().slice(0, 10));
        setStartDate(start.toISOString().slice(0, 10));
      })
      .catch(() => setError("Failed to load report configuration data"))
      .finally(() => setLoading(false));
  }, []);

  async function runReport() {
    if (!startDate || !endDate) {
      setError("Start date and end date are required.");
      return;
    }
    if (scope === "property" && !communityId) {
      setError("Select a property for property-level report depth.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const res = await generateGscReport({
        scope,
        community_id: scope === "property" ? communityId : undefined,
        start_date: startDate,
        end_date: endDate,
        email: email.trim() || undefined,
      });
      setData(res);
      if (email.trim()) {
        if (res.email_sent) setStatus(`Report emailed to ${email.trim()} with Excel attachment.`);
        else setStatus(res.email_error || "Report generated, but email failed.");
      } else {
        setStatus("Report generated. Use Download Excel to save the companion file.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const properties = data?.properties ?? [];
  const portfolio = data?.portfolio ?? null;
  const grades = data?.grades ?? null;
  const startLabel = data?.current_start ? format(parseISO(data.current_start), "MMM d, yyyy") : "";
  const endLabel = data?.current_end ? format(parseISO(data.current_end), "MMM d, yyyy") : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center gap-2 mb-1">
            <Image src="/velo.svg" alt="" width={20} height={12} className="opacity-60" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Venterra</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">GSC Report Builder</h1>
          <p className="mt-1 text-sm text-blue-600 font-semibold uppercase tracking-wide">
            Configure, preview, and email report with Excel companion
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8 md:px-12">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report Depth</label>
                <div className="mt-2 flex items-center gap-6 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={scope === "portfolio"} onChange={() => setScope("portfolio")} />
                    All Properties (Portfolio)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={scope === "property"} onChange={() => setScope("property")} />
                    Single Property
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</label>
                <select
                  disabled={scope !== "property"}
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Select a property</option>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Recipient</label>
                <Input type="email" placeholder="name@venterraliving.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runReport} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Generate Report
              </Button>
              {data && (
                <Button
                  variant="outline"
                  onClick={() => downloadBase64File(
                    data.excel_base64,
                    data.excel_filename,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  )}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel Companion
                </Button>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {status && <p className="text-sm text-emerald-700">{status}</p>}
          </CardContent>
        </Card>

        {data && portfolio && (
          <>
            <div className="border-b border-slate-200 bg-white px-6 py-6">
              <div className="mx-auto max-w-[1200px]">
                <h2 className="text-xl font-bold text-slate-900">
                  {scope === "portfolio" ? "Portfolio" : "Property"} Google Search Console Snapshot
                </h2>
                <p className="mt-1 text-sm text-blue-600 font-semibold uppercase tracking-wide">
                  Complete Property Listing Sorted by Organic Clicks
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {startLabel} – {endLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiCard label="Total Clicks" value={fmtNum(portfolio.total_clicks)} delta={fmtPct(portfolio.clicks_pct)} icon={MousePointerClick} />
              <KpiCard label="Total Impressions" value={fmtNum(portfolio.total_impressions)} delta={fmtPct(portfolio.impressions_pct)} icon={Eye} />
              <KpiCard label="Average CTR" value={`${portfolio.avg_ctr.toFixed(2)}%`} delta={fmtDeltaPct(portfolio.ctr_delta)} icon={Percent} />
            </div>

            {grades && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Portfolio Overview</p>
                      <p className="text-xs text-slate-500">Organic search performance for {properties.length} properties</p>
                    </div>
                    <div className="text-xs text-slate-400">
                      {fmtNum(portfolio.total_clicks)} Clicks · {fmtNum(portfolio.total_impressions)} Impressions
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                      {grades.needs_improvement}<span className="font-normal text-red-500">Needs Improvement</span><span className="text-[10px] font-normal text-red-400">CTR &lt;3%</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      {grades.good}<span className="font-normal text-amber-600">Good</span><span className="text-[10px] font-normal text-amber-400">CTR 3-5%</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {grades.excellent}<span className="font-normal text-emerald-600">Excellent</span><span className="text-[10px] font-normal text-emerald-400">CTR ≥5%</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Complete Property Ranking by Clicks</h2>
                  <p className="text-xs text-slate-500">Sorted by organic clicks (highest to lowest)</p>
                </div>
                <Search className="h-5 w-5 text-slate-300" />
              </div>
              <Card>
                <CardContent className="p-0 divide-y divide-slate-100">
                  {properties.map((p) => <PropertyRow key={p.community_id} p={p} />)}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

