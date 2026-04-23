"use client";

import React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CommunitySelector } from "@/components/shared/community-selector";
import { WeekDatePicker } from "@/components/shared/week-date-picker";
import {
  getCommunities,
  getMarketingWeekly,
  importWebsiteSeo,
  scanMarketingMentions,
  upsertMarketingWeekly,
  type Community,
  type MarketingWeeklyRecord,
  type MarketingScanResponse,
} from "@/lib/api";
import { getSpotlightCommunities, getUpcomingFriday } from "@/lib/spotlight-properties";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle,
  CheckCircle,
  DollarSign,
  FileText,
  Loader2,
  Megaphone,
  MessageSquare,
  Save,
  Search,
  Upload,
  Users,
} from "lucide-react";

function parseMentionsInput(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMentions(value: string | null): string {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).join("\n");
    }
  } catch {
    return value;
  }
  return value;
}

type WebsiteSeoImportRow = {
  property_name: string;
  property_url?: string;
  date: string;
  t7_engaged_sessions_delta?: number | null;
  t7_organic_sessions_delta?: number | null;
  t30_engaged_sessions_delta?: number | null;
  t30_organic_sessions_delta?: number | null;
  t7_organic_visibility?: number | null;
  t7_serp_traffic?: number | null;
  website_notes?: string | null;
  seo_notes?: string | null;
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeWebsiteSeoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseWebsiteSeoCsv(text: string): WebsiteSeoImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const rows: WebsiteSeoImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    const normalizedDate = normalizeWebsiteSeoDate(record.date ?? "");
    if (!record.property_name || !normalizedDate) continue;

    const numeric = (value: string): number | null => {
      if (!value?.trim()) return null;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    rows.push({
      property_name: record.property_name,
      property_url: record.property_url || undefined,
      date: normalizedDate,
      t7_engaged_sessions_delta: numeric(record.t7_engaged_sessions_delta),
      t7_organic_sessions_delta: numeric(record.t7_organic_sessions_delta),
      t30_engaged_sessions_delta: numeric(record.t30_engaged_sessions_delta),
      t30_organic_sessions_delta: numeric(record.t30_organic_sessions_delta),
      t7_organic_visibility: numeric(record.t7_organic_visibility),
      t7_serp_traffic: numeric(record.t7_serp_traffic),
      website_notes: record.website_notes?.trim() || null,
      seo_notes: record.seo_notes?.trim() || null,
    });
  }

  return rows;
}

export default function MarketingPage() {
  const importFileRef = React.useRef<HTMLInputElement>(null);
  const [communityId, setCommunityId] = React.useState("");
  const [weekDate, setWeekDate] = React.useState<Date | null>(null);
  const [spotlightCommunities, setSpotlightCommunities] = React.useState<Community[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const [record, setRecord] = React.useState<MarketingWeeklyRecord | null>(null);
  const [recordId, setRecordId] = React.useState("new");
  const [formState, setFormState] = React.useState({
    leads_count: "",
    cost_per_lead: "",
    ad_spend: "",
    mentions_text: "",
    notes_text: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<WebsiteSeoImportRow[]>([]);
  const [importFileName, setImportFileName] = React.useState<string | null>(null);
  const [importSummary, setImportSummary] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [scanResult, setScanResult] = React.useState<MarketingScanResponse | null>(null);

  React.useEffect(() => {
    setWeekDate((current) => current ?? getUpcomingFriday());
  }, []);

  React.useEffect(() => {
    getCommunities()
      .then((communities) => {
        const filtered = getSpotlightCommunities(communities);
        setSpotlightCommunities(filtered);
      })
      .catch((err) => {
        console.error("Failed to load spotlight communities:", err);
        setSpotlightCommunities([]);
      });
  }, []);

  React.useEffect(() => {
    if (communityId || spotlightCommunities.length === 0) return;
    setCommunityId(spotlightCommunities[0].id);
  }, [communityId, spotlightCommunities]);

  React.useEffect(() => {
    if (!communityId || !weekDate) {
      setRecord(null);
      setRecordId("new");
      setFormState({
        leads_count: "",
        cost_per_lead: "",
        ad_spend: "",
        mentions_text: "",
        notes_text: "",
      });
      setScanResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    const weekEnding = format(weekDate, "yyyy-MM-dd");
    getMarketingWeekly({ community_id: communityId, week_ending: weekEnding })
      .then((items) => {
        const existing = items[0] ?? null;
        setRecord(existing);
        setRecordId(existing?.id ?? "new");
        setFormState({
          leads_count: existing?.leads_count != null ? String(existing.leads_count) : "",
          cost_per_lead: existing?.cost_per_lead != null ? String(existing.cost_per_lead) : "",
          ad_spend: existing?.ad_spend != null ? String(existing.ad_spend) : "",
          mentions_text: formatMentions(existing?.mentions_json ?? null),
          notes_text: existing?.notes_text ?? "",
        });
      })
      .catch((err) => {
        setRecord(null);
        setRecordId("new");
        setError(err instanceof Error ? err.message : "Failed to load marketing workflow");
      })
      .finally(() => setLoading(false));
  }, [communityId, weekDate]);

  const weekEnding = weekDate ? format(weekDate, "yyyy-MM-dd") : null;
  const lastUpdated = record?.updated_at ? formatDistanceToNow(new Date(record.updated_at), { addSuffix: true }) : null;

  async function handleSave() {
    if (!communityId || !weekEnding) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const mentions = parseMentionsInput(formState.mentions_text);
      const saved = await upsertMarketingWeekly(recordId, {
        community_id: communityId,
        week_ending: weekEnding,
        leads_count: formState.leads_count === "" ? undefined : Number(formState.leads_count),
        cost_per_lead: formState.cost_per_lead === "" ? undefined : Number(formState.cost_per_lead),
        ad_spend: formState.ad_spend === "" ? undefined : Number(formState.ad_spend),
        mentions_json: mentions.length > 0 ? JSON.stringify(mentions) : undefined,
        notes_text: formState.notes_text.trim() || undefined,
      });
      setRecord(saved);
      setRecordId(saved.id);
      setFormState((current) => ({
        ...current,
        mentions_text: formatMentions(saved.mentions_json),
        notes_text: saved.notes_text ?? "",
      }));
      setSuccess("Marketing weekly record saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save marketing weekly record");
    } finally {
      setSaving(false);
    }
  }

  async function handleScan() {
    if (!weekEnding) return;
    setScanning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await scanMarketingMentions(weekEnding);
      setScanResult(result);
      setSuccess("Mention scan completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan mentions");
    } finally {
      setScanning(false);
    }
  }

  async function handleWebsiteSeoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setImportSummary(null);
    setScanResult(null);

    try {
      const text = await file.text();
      const rows = parseWebsiteSeoCsv(text);
      if (rows.length === 0) {
        throw new Error("No valid Website & SEO rows were found in the uploaded CSV.");
      }
      setImportFileName(file.name);
      setImportPreview(rows);
    } catch (err) {
      setImportPreview([]);
      setImportFileName(null);
      setError(err instanceof Error ? err.message : "Failed to parse Website & SEO CSV");
    } finally {
      event.target.value = "";
    }
  }

  async function handleWebsiteSeoImport() {
    if (importPreview.length === 0) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportSummary(null);

    try {
      const result = await importWebsiteSeo(importPreview);
      const summary = `Website & SEO import complete. Saved ${result.successful} row(s), failed ${result.failed}.`;
      setImportSummary(summary);
      if (result.failed > 0 && result.errors && result.errors.length > 0) {
        const examples = result.errors.slice(0, 3).map((entry) => `Row ${entry.row + 1}: ${entry.error}`).join(" | ");
        setError(`${summary} ${examples}`);
      } else {
        setSuccess(summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import Website & SEO data");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5f8_100%)] p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="sticky top-4 z-20 rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_50px_rgba(21,40,75,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full bg-[#15284B] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                Marketing Workflow
              </div>
              <h1 className="text-3xl font-bold text-[#15284B]">Marketing Data</h1>
              <p className="max-w-3xl text-slate-600">Canonical weekly marketing editing with the same upcoming-Friday and Spotlight property defaults used across POP Brief.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <WeekDatePicker value={weekDate} onChange={setWeekDate} />
              <CommunitySelector
                value={communityId}
                onValueChange={setCommunityId}
                communities={spotlightCommunities}
                placeholder="Select a community"
              />
            </div>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm text-green-700">{success}</p>
            </CardContent>
          </Card>
        )}

        {!communityId || !weekDate ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Megaphone className="mx-auto mb-4 h-16 w-16 text-slate-400" />
              <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Community and Date</h3>
              <p className="text-slate-600">Choose the community and Friday week ending to edit canonical marketing weekly data.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-500" />
              <p className="text-slate-600">Loading marketing workflow…</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="overflow-hidden border-0 shadow-[0_14px_32px_rgba(21,40,75,0.07)]">
                <div className="h-1.5 bg-[#0D5E6D]" />
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Leads Count</span>
                    <Users className="h-4 w-4 text-[#15284B]" />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={formState.leads_count}
                    onChange={(e) => setFormState((current) => ({ ...current, leads_count: e.target.value }))}
                    placeholder="0"
                  />
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 shadow-[0_14px_32px_rgba(21,40,75,0.07)]">
                <div className="h-1.5 bg-[#D97706]" />
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Cost Per Lead</span>
                    <DollarSign className="h-4 w-4 text-[#15284B]" />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.cost_per_lead}
                    onChange={(e) => setFormState((current) => ({ ...current, cost_per_lead: e.target.value }))}
                    placeholder="0.00"
                  />
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 shadow-[0_14px_32px_rgba(21,40,75,0.07)]">
                <div className="h-1.5 bg-[#15803D]" />
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Ad Spend</span>
                    <DollarSign className="h-4 w-4 text-[#15284B]" />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.ad_spend}
                    onChange={(e) => setFormState((current) => ({ ...current, ad_spend: e.target.value }))}
                    placeholder="0.00"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="overflow-hidden border-0 shadow-[0_16px_36px_rgba(21,40,75,0.08)]">
                <div className="bg-[linear-gradient(135deg,#eff8fb_0%,#f8fcff_100%)] px-6 py-4">
                  <div className="inline-flex rounded-full bg-[#0D5E6D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5E6D]">
                    Collaboration
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5 text-[#15284B]" />Mention Inputs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="mentions_text" className="mb-2 block text-sm text-slate-700">
                      One email or mention target per line
                    </Label>
                    <Textarea
                      id="mentions_text"
                      value={formState.mentions_text}
                      onChange={(e) => setFormState((current) => ({ ...current, mentions_text: e.target.value }))}
                      placeholder={"ops@example.com\nregional@example.com"}
                      className="min-h-[220px]"
                    />
                  </div>
                  <p className="text-xs text-slate-500">These values are stored on `marketing_weekly.mentions_json` and used by the mention scan route.</p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-0 shadow-[0_16px_36px_rgba(21,40,75,0.08)]">
                <div className="bg-[linear-gradient(135deg,#fff7ea_0%,#fffdf8_100%)] px-6 py-4">
                  <div className="inline-flex rounded-full bg-[#D97706]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                    Narrative
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Megaphone className="h-5 w-5 text-[#15284B]" />Weekly Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="notes_text" className="mb-2 block text-sm text-slate-700">
                      Operator Notes
                    </Label>
                    <Textarea
                      id="notes_text"
                      value={formState.notes_text}
                      onChange={(e) => setFormState((current) => ({ ...current, notes_text: e.target.value }))}
                      placeholder="Add weekly marketing context, corrections, and handoff notes."
                      className="min-h-[220px]"
                    />
                  </div>
                  <p className="text-xs text-slate-500">Mention scan reads both `notes_text` and `mentions_json` for email targets.</p>
                </CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden border-0 shadow-[0_18px_40px_rgba(21,40,75,0.1)]">
              <div className="bg-[linear-gradient(135deg,#15284B_0%,#1e3a66_100%)] px-6 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Primary Actions</div>
                <div className="mt-1 text-xl font-bold">Commit Weekly Marketing Actions</div>
              </div>
              <CardHeader className="flex-col gap-3 bg-white md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Workflow Actions</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {lastUpdated ? `Last updated ${lastUpdated}` : "No canonical marketing weekly record exists yet for this community and week."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="min-w-[220px]" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Marketing Weekly
                  </Button>
                  <Button className="min-w-[220px]" variant="secondary" onClick={handleScan} disabled={scanning}>
                    {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Run Mention Scan
                  </Button>
                </div>
              </CardHeader>
              {scanResult && (
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Processed</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">{scanResult.processed}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sent</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">{scanResult.sent}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Suppressed Duplicate</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">{scanResult.suppressed_duplicate}</div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            <Collapsible open={importOpen} onOpenChange={setImportOpen} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(21,40,75,0.08)]">
              <CollapsibleTrigger className="px-6 py-5 text-left hover:bg-slate-50">
                <div className="pr-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Upload className="h-4 w-4" />
                    Legacy Import Utility
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-[#15284B]">Base44 Website & SEO CSV Import</h2>
                  <p className="mt-1 max-w-3xl text-sm text-slate-600">
                    Keep this collapsed unless you need the legacy CSV lane. The long-term path is direct Data Pond ingest.
                  </p>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-slate-200 px-6 py-6">
                <div className="space-y-4">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleWebsiteSeoFileChange}
                    className="hidden"
                  />
                  <div className="rounded-2xl border-2 border-dashed border-[#0D5E6D]/20 bg-[#f4fbfc] p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="mb-2 inline-flex rounded-full bg-[#15284B]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#15284B]">
                          Source File
                        </div>
                        <p className="text-base font-semibold text-slate-900">Upload the exact CSV exported by the Base44 Spotlight / Website & SEO flow.</p>
                        <p className="mt-1 text-sm text-slate-600">Supported columns include `property_name`, `property_url`, `date`, the T7/T30 deltas, visibility, SERP traffic, `website_notes`, and `seo_notes`.</p>
                      </div>
                      <Button className="min-w-[180px]" variant="outline" onClick={() => importFileRef.current?.click()} disabled={importing}>
                        <FileText className="mr-2 h-4 w-4" />Choose CSV
                      </Button>
                    </div>
                  </div>

                  {importFileName && (
                    <div className="rounded-2xl border border-blue-200 bg-[linear-gradient(135deg,#eef4ff_0%,#f7fbff_100%)] p-4 text-sm text-blue-900 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Preview Ready</div>
                      <div className="mt-2 font-semibold">{importFileName}</div>
                      <div className="mt-1 text-blue-800">Parsed {importPreview.length} row(s) ready for import.</div>
                    </div>
                  )}

                  {importPreview.length > 0 && (
                    <>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <table className="min-w-full text-sm">
                          <thead className="bg-[#15284B] text-left text-white">
                            <tr>
                              <th className="px-4 py-3">Property</th>
                              <th className="px-4 py-3">Week</th>
                              <th className="px-4 py-3">T7 Engaged</th>
                              <th className="px-4 py-3">T7 Organic</th>
                              <th className="px-4 py-3">Visibility</th>
                              <th className="px-4 py-3">SERP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.slice(0, 5).map((row) => (
                              <tr key={`${row.property_name}-${row.date}`} className="border-t border-slate-100">
                                <td className="px-4 py-3 font-medium text-slate-900">{row.property_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.date}</td>
                                <td className="px-4 py-3 text-slate-700">{row.t7_engaged_sessions_delta ?? "—"}</td>
                                <td className="px-4 py-3 text-slate-700">{row.t7_organic_sessions_delta ?? "—"}</td>
                                <td className="px-4 py-3 text-slate-700">{row.t7_organic_visibility ?? "—"}</td>
                                <td className="px-4 py-3 text-slate-700">{row.t7_serp_traffic ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <Button className="min-w-[220px]" onClick={handleWebsiteSeoImport} disabled={importing}>
                          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          Import Website & SEO
                        </Button>
                        <Button
                          variant="outline"
                          disabled={importing}
                          onClick={() => {
                            setImportPreview([]);
                            setImportFileName(null);
                            setImportSummary(null);
                          }}
                        >
                          Clear
                        </Button>
                        {importSummary && <span className="text-sm font-medium text-slate-700">{importSummary}</span>}
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </div>
  );
}
