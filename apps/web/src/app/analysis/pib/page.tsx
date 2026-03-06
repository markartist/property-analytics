"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import {
  generatePibReport,
  getCommunities,
  type Community,
  type PibReportResponse,
} from "@/lib/api";

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function setPresetDates(days: number): { start: string; end: string } {
  const end = isoDateOffset(-1);
  const start = isoDateOffset(-days);
  return { start, end };
}

function fmt(n: number | null, decimals = 0): string {
  if (n == null) return "n/a";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function metricCell(label: string, value: string, delta: string) {
  return (
    <div className="border border-slate-200 p-4">
      <p className="text-3xl font-bold leading-tight text-slate-900">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value} ({delta})</p>
    </div>
  );
}

export default function PibBuilderPage() {
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [communityId, setCommunityId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [email, setEmail] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PibReportResponse | null>(null);

  React.useEffect(() => {
    const { start, end } = setPresetDates(30);
    setStartDate(start);
    setEndDate(end);

    getCommunities()
      .then((rows) => setCommunities(rows.filter((c) => c.status !== "inactive")))
      .catch(() => setError("Failed to load properties"))
      .finally(() => setLoading(false));
  }, []);

  function applyPreset(days: number) {
    const { start, end } = setPresetDates(days);
    setStartDate(start);
    setEndDate(end);
  }

  async function runReport() {
    if (!communityId) {
      setError("Select a property.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start date and end date are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const report = await generatePibReport({
        community_id: communityId,
        start_date: startDate,
        end_date: endDate,
        email: email.trim() || undefined,
      });
      setData(report);

      if (email.trim()) {
        setStatus(report.email_sent ? `Report emailed to ${email.trim()}` : (report.email_error || "Report rendered but email failed"));
      } else {
        setStatus("Report rendered in browser.");
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

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 md:px-12">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">PIB Builder</h1>
          <p className="mt-1 text-sm text-slate-600">Select property and date range, render in browser, and optionally email the brief.</p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</label>
                <select
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">Select a property</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Recipient (optional)</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@venterraliving.com"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Defaults:</span>
              <Button variant="outline" size="sm" onClick={() => applyPreset(30)}>30 days</Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(60)}>60 days</Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(90)}>90 days</Button>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={runReport} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Generate PIB Report
              </Button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {status && <p className="text-sm text-emerald-700">{status}</p>}
          </CardContent>
        </Card>

        {data && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Property Intelligence Brief</h2>
                <p className="text-3xl font-bold text-slate-800">{data.property}</p>
                <p className="text-2xl text-slate-500">
                  Current: {data.current_start} to {data.current_end} | Previous: {data.previous_start} to {data.previous_end}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3">
                {metricCell("Sessions", fmt(data.sessions.value, 0), fmt(data.sessions.delta, 0))}
                {metricCell("GSC Clicks", fmt(data.gsc_clicks.value, 0), fmt(data.gsc_clicks.delta, 0))}
                {metricCell("CIR", fmt(data.cir.value, 2), fmt(data.cir.delta, 2))}
                {metricCell("Avg Rating", fmt(data.avg_rating.value, 2), fmt(data.avg_rating.delta, 2))}
                {metricCell("Occupancy %", fmt(data.occupancy.value, 2), fmt(data.occupancy.delta, 2))}
                {metricCell(
                  "Ad Spend",
                  data.ad_spend.value == null ? "$n/a" : `$${fmt(data.ad_spend.value, 0)}`,
                  data.ad_spend.delta == null ? "n/a" : `$${fmt(data.ad_spend.delta, 0)}`
                )}
              </div>

              <p className="text-4xl font-bold text-slate-700">
                CIR Status: {data.cir.status ?? "unknown"} | Action Rate: {data.action_rate == null ? "n/a" : `${fmt(data.action_rate, 2)}%`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
