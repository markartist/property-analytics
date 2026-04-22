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
  getMarketingWeekly,
  importWebsiteSeo,
  scanMarketingMentions,
  upsertMarketingWeekly,
  type MarketingWeeklyRecord,
  type MarketingScanResponse,
} from "@/lib/api";
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
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#15284B]">Marketing Data</h1>
            <p className="mt-2 text-slate-600">Base44-style Website & SEO import plus canonical marketing weekly editing and mention scan operations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WeekDatePicker value={weekDate} onChange={setWeekDate} />
            <CommunitySelector value={communityId} onValueChange={setCommunityId} />
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-[#15284B]" />Bulk Website & SEO Import
            </CardTitle>
            <p className="text-sm text-slate-500">
              Base44-compatible import for Spotlight Website & SEO CSV exports. This writes into the legacy `marketing_data` Website & SEO fields.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleWebsiteSeoFileChange}
              className="hidden"
            />
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Upload the exact CSV exported by the Base44 Spotlight / Website & SEO flow.</p>
                  <p className="mt-1 text-sm text-slate-500">Supported columns include `property_name`, `property_url`, `date`, the T7/T30 deltas, visibility, SERP traffic, `website_notes`, and `seo_notes`.</p>
                </div>
                <Button variant="outline" onClick={() => importFileRef.current?.click()} disabled={importing}>
                  <FileText className="mr-2 h-4 w-4" />Choose CSV
                </Button>
              </div>
            </div>

            {importFileName && (
              <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
                <div className="font-medium">{importFileName}</div>
                <div className="mt-1">Parsed {importPreview.length} row(s) ready for import.</div>
              </div>
            )}

            {importPreview.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
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
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleWebsiteSeoImport} disabled={importing}>
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
                  {importSummary && <span className="text-sm text-slate-600">{importSummary}</span>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Leads Count</span>
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
              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Cost Per Lead</span>
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
              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Ad Spend</span>
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
              <Card>
                <CardHeader>
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

              <Card>
                <CardHeader>
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

            <Card>
              <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Workflow Actions</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {lastUpdated ? `Last updated ${lastUpdated}` : "No canonical marketing weekly record exists yet for this community and week."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Marketing Weekly
                  </Button>
                  <Button variant="outline" onClick={handleScan} disabled={scanning}>
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
          </>
        )}
      </div>
    </div>
  );
}
