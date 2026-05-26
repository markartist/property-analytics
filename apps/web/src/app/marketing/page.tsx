"use client";

import React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PopBriefPageHeader } from "@/components/shared/pop-brief-page-header";
import {
  getCommunities,
  getMarketingData,
  importWebsiteSeo,
  upsertMarketingData,
  type Community,
  type MarketingData,
} from "@/lib/api";
import { getSpotlightCommunities, getUpcomingFriday } from "@/lib/spotlight-properties";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  DollarSign,
  FileText,
  Globe,
  Loader2,
  Megaphone,
  MessageSquare,
  Save,
  Tag,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SectionDef {
  icon: LucideIcon;
  fields: FieldDef[];
  timestampField: string;
  badge?: string;
}

interface FieldDef {
  key: string;
  label: string;
  type: "number" | "text" | "textarea";
  placeholder?: string;
}

const num = (key: string, label: string): FieldDef => ({ key, label, type: "number" });
const area = (key: string, label: string): FieldDef => ({ key, label, type: "textarea" });
const txt = (key: string, label: string): FieldDef => ({ key, label, type: "text" });

const SECTIONS: Record<string, SectionDef> = {
  Advertising: {
    icon: DollarSign,
    timestampField: "advertising_saved_at",
    badge: "CSV Import Available",
    fields: [
      num("monthly_budget", "Monthly Budget"),
      num("google_ppc", "Google PPC"),
      num("google_remarketing", "Google Remarketing"),
      num("apartments_com", "Apartments.com"),
      num("social", "Social"),
      num("zillow", "Zillow"),
      num("mailers", "Mailers"),
      num("kurie_video", "Kurie Video"),
      num("other", "Other"),
      area("advertising_notes", "Advertising Notes"),
    ],
  },
  "Property Performance": {
    icon: TrendingUp,
    timestampField: "property_performance_saved_at",
    fields: [
      num("occupancy", "Occupancy"),
      num("atr", "Atr"),
      txt("most_common_floorplans", "Which floorplans do they have the most of?"),
    ],
  },
  "Guest Cards per Door": {
    icon: Users,
    timestampField: "gc_per_door_saved_at",
    fields: [
      num("t7_community_gc_per_door", "T7 Community Gc Per Door"),
      num("t7_community_gc_per_avail_door", "T7 Community Gc Per Avail Door"),
      num("t7_portfolio_gc_per_door", "T7 Portfolio Gc Per Door"),
      num("t7_portfolio_gc_per_avail_door", "T7 Portfolio Gc Per Avail Door"),
      num("t30_community_gc_per_door", "T30 Community Gc Per Door"),
      num("t30_community_gc_per_avail_door", "T30 Community Gc Per Avail Door"),
      num("t30_portfolio_gc_per_door", "T30 Portfolio Gc Per Door"),
      num("t30_portfolio_gc_per_avail_door", "T30 Portfolio Gc Per Avail Door"),
    ],
  },
  "Website & SEO": {
    icon: Globe,
    timestampField: "website_seo_saved_at",
    fields: [
      num("t7_engaged_sessions_delta", "T7 Engaged Sessions Delta"),
      num("t7_organic_sessions_delta", "T7 Organic Sessions Delta"),
      num("t30_engaged_sessions_delta", "T30 Engaged Sessions Delta"),
      num("t30_organic_sessions_delta", "T30 Organic Sessions Delta"),
      area("website_notes", "Website Notes"),
      num("t7_organic_visibility", "T7 Organic Visibility"),
      num("t7_serp_traffic", "T7 Serp Traffic"),
      area("seo_notes", "Seo Notes"),
    ],
  },
  "Marketing Projects": {
    icon: Camera,
    timestampField: "marketing_saved_at",
    fields: [
      area("photography_needs", "Photography Needs"),
      area("signage_needs", "Signage Needs"),
      area("capex_projects", "Capex Projects"),
    ],
  },
  "Reputation & Social": {
    icon: MessageSquare,
    timestampField: "reputation_social_saved_at",
    fields: [
      num("google_review_count", "Google Review Count"),
      num("google_review_score", "Google Review Score"),
      num("social_posts_count", "Social Posts Count"),
      area("google_review_concerns", "Google Review Concerns"),
      area("social_media_notes", "Social Media Notes"),
    ],
  },
  "Pricing Strategy": {
    icon: Tag,
    timestampField: "pricing_strategy_saved_at",
    fields: [
      area("recent_pricing_call", "Recent Pricing Call"),
      area("pricing_strategy_notes", "Pricing Strategy Notes"),
      area("current_specials", "Current Specials"),
    ],
  },
};

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
        i += 1;
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

  for (let i = 1; i < lines.length; i += 1) {
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
  const [data, setData] = React.useState<MarketingData | null>(null);
  const [recordId, setRecordId] = React.useState<string>("new");
  const [formState, setFormState] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [savedSection, setSavedSection] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [sectionOpenState, setSectionOpenState] = React.useState<Record<string, boolean>>({});
  const [importPreview, setImportPreview] = React.useState<WebsiteSeoImportRow[]>([]);
  const [importFileName, setImportFileName] = React.useState<string | null>(null);
  const [importSummary, setImportSummary] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

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
      setData(null);
      setRecordId("new");
      setFormState({});
      return;
    }

    setLoading(true);
    setError(null);
    const dateStr = format(weekDate, "yyyy-MM-dd");
    getMarketingData({ community_id: communityId, week_date: dateStr })
      .then((items) => {
        const existing = items[0] ?? null;
        setData(existing);
        setRecordId(existing?.id ?? "new");
        const state: Record<string, string> = {};
        if (existing) {
          for (const section of Object.values(SECTIONS)) {
            for (const field of section.fields) {
              const value = existing[field.key];
              if (value != null) state[field.key] = String(value);
            }
          }
          if (existing.ai_summary != null) state.ai_summary = String(existing.ai_summary);
          if (existing.action_items != null) state.action_items = String(existing.action_items);
        }
        setFormState(state);
      })
      .catch((err) => {
        setData(null);
        setRecordId("new");
        setFormState({});
        setError(err instanceof Error ? err.message : "Failed to load marketing data");
      })
      .finally(() => setLoading(false));
  }, [communityId, weekDate]);

  async function handleSaveSection(sectionName: string, sectionDef: SectionDef) {
    if (!communityId || !weekDate) return;
    setSaving(sectionName);
    setSavedSection(null);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        community_id: communityId,
        week_date: format(weekDate, "yyyy-MM-dd"),
        section: sectionName.toLowerCase().replace(/ & /g, "_").replace(/ /g, "_"),
      };

      for (const field of sectionDef.fields) {
        const raw = formState[field.key];
        if (raw === undefined || raw === "") continue;
        payload[field.key] = field.type === "number" ? parseFloat(raw) || 0 : raw;
      }

      payload[sectionDef.timestampField] = new Date().toISOString();
      const result = await upsertMarketingData(recordId, payload);
      if (result.id) setRecordId(result.id);
      setData((prev) => ({ ...prev, ...payload, id: result.id } as MarketingData));
      setSavedSection(sectionName);
      setSuccess(`${sectionName} saved.`);
      window.setTimeout(() => setSavedSection(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${sectionName}`);
    } finally {
      setSaving(null);
    }
  }

  async function handleWebsiteSeoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setImportSummary(null);

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

  const formatSavedAt = (field: string): string | null => {
    const value = data?.[field] as string | undefined;
    if (!value) return null;
    try {
      return formatDistanceToNow(new Date(value), { addSuffix: true });
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5f8_100%)] p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PopBriefPageHeader
          title="Marketing Data"
          titleIcon={Megaphone}
          subtitle="Track and manage marketing performance data across the seven core Base44 sections."
          badge="Marketing Workflow"
          weekDate={weekDate}
          onWeekDateChange={setWeekDate}
          communityId={communityId}
          onCommunityIdChange={setCommunityId}
          communities={spotlightCommunities}
          communityPlaceholder="Select a community"
        />

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

        <Collapsible open={importOpen} onOpenChange={setImportOpen} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(21,40,75,0.08)]">
          <CollapsibleTrigger className="px-6 py-5 text-left hover:bg-slate-50">
            <div className="pr-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Upload className="h-4 w-4" />
                Legacy Import Utility
              </div>
              <h2 className="mt-2 text-xl font-bold text-[#15284B]">Bulk Website & SEO Import</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Base44-compatible import for Spotlight Website & SEO CSV exports. Keep this collapsed unless you need the bridge import path.
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

        {!communityId || !weekDate ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Megaphone className="mx-auto mb-4 h-16 w-16 text-slate-400" />
              <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Community and Date</h3>
              <p className="text-slate-600">Choose a community and Friday week ending date to manage the full marketing data page.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-500" />
              <p className="text-slate-600">Loading marketing data…</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-[0_18px_40px_rgba(21,40,75,0.08)]">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl text-slate-900">Marketing Data Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {Object.entries(SECTIONS).map(([name, section]) => {
                const Icon = section.icon;
                const savedAt = formatSavedAt(section.timestampField);
                const fieldGridClass = name === "Guest Cards per Door"
                  ? "grid grid-cols-1 gap-4 md:grid-cols-2"
                  : "grid grid-cols-1 gap-4 md:grid-cols-2";

                return (
                  <div key={name} className="border-b border-slate-100 last:border-b-0">
                    <Collapsible
                      open={sectionOpenState[name] ?? false}
                      onOpenChange={(open) =>
                        setSectionOpenState((previous) => ({ ...previous, [name]: open }))
                      }
                    >
                      <CollapsibleTrigger className="w-full px-6 py-5 text-left hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                            <Icon className="h-5 w-5 text-[#15284B]" />
                          </div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-semibold text-slate-900">{name}</h3>
                            {section.badge && (
                              <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {section.badge}
                              </span>
                            )}
                          </div>
                          {savedSection === name && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {savedAt && <span className="text-xs text-slate-500">{savedAt}</span>}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-6 pb-6">
                        <div className={fieldGridClass}>
                          {section.fields.map((field) => (
                            <div
                              key={field.key}
                              className={field.type === "textarea" ? "md:col-span-1" : ""}
                            >
                              <Label htmlFor={field.key} className="mb-2 block text-sm text-slate-700">
                                {field.label}
                              </Label>
                              {field.type === "textarea" ? (
                                <Textarea
                                  id={field.key}
                                  value={formState[field.key] ?? ""}
                                  onChange={(e) => setFormState((previous) => ({ ...previous, [field.key]: e.target.value }))}
                                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                                  className="min-h-[96px]"
                                />
                              ) : (
                                <Input
                                  id={field.key}
                                  type={field.type}
                                  step="any"
                                  value={formState[field.key] ?? ""}
                                  onChange={(e) => setFormState((previous) => ({ ...previous, [field.key]: e.target.value }))}
                                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 flex justify-end">
                          <Button onClick={() => handleSaveSection(name, section)} disabled={saving === name} size="sm">
                            {saving === name ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving…
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save {name}
                              </>
                            )}
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}

              <div className="px-6 py-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                    <Megaphone className="h-5 w-5 text-[#15284B]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">AI Summary & Recommendations</h3>
                    <p className="text-xs text-slate-500">Rich-content fields stored with the marketing data record.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="ai_summary" className="mb-2 block text-sm text-slate-700">
                      AI Summary
                    </Label>
                    <Textarea
                      id="ai_summary"
                      value={formState.ai_summary ?? ""}
                      onChange={(e) => setFormState((previous) => ({ ...previous, ai_summary: e.target.value }))}
                      placeholder="Add AI summary..."
                      className="min-h-[120px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="action_items" className="mb-2 block text-sm text-slate-700">
                      Action Items
                    </Label>
                    <Textarea
                      id="action_items"
                      value={formState.action_items ?? ""}
                      onChange={(e) => setFormState((previous) => ({ ...previous, action_items: e.target.value }))}
                      placeholder="Add recommendations and action items..."
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() =>
                      handleSaveSection("AI Summary & Recommendations", {
                        icon: Megaphone,
                        timestampField: "updated_at",
                        fields: [
                          area("ai_summary", "AI Summary"),
                          area("action_items", "Action Items"),
                        ],
                      })
                    }
                    disabled={saving === "AI Summary & Recommendations"}
                  >
                    {saving === "AI Summary & Recommendations" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save AI Summary & Recommendations
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
