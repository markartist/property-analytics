"use client";

import React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { CommunitySelector } from "@/components/shared/community-selector";
import { WeekDatePicker } from "@/components/shared/week-date-picker";
import { getMarketingData, upsertMarketingData, type MarketingData } from "@/lib/api";
import {
  DollarSign, TrendingUp, Globe, Camera, Users, MessageSquare, Tag,
  Save, CheckCircle, Megaphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Section config ──

interface SectionDef {
  icon: LucideIcon;
  fields: FieldDef[];
  timestampField: string;
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
    fields: [
      num("monthly_budget", "Monthly Budget"), num("google_ppc", "Google PPC"),
      num("google_remarketing", "Google Remarketing"), num("apartments_com", "Apartments.com"),
      num("social", "Social"), num("zillow", "Zillow"), num("mailers", "Mailers"),
      num("kurie_video", "Kurie Video"), num("other", "Other"),
      area("advertising_notes", "Advertising Notes"),
    ],
  },
  "Property Performance": {
    icon: TrendingUp,
    timestampField: "property_performance_saved_at",
    fields: [num("occupancy", "Occupancy %"), num("atr", "ATR"), txt("most_common_floorplans", "Most Common Floorplans")],
  },
  "Guest Cards per Door": {
    icon: Users,
    timestampField: "gc_per_door_saved_at",
    fields: [
      num("t7_community_gc_per_door", "T7 Community GC/Door"),
      num("t7_community_gc_per_avail_door", "T7 Community GC/Avail Door"),
      num("t7_portfolio_gc_per_door", "T7 Portfolio GC/Door"),
      num("t7_portfolio_gc_per_avail_door", "T7 Portfolio GC/Avail Door"),
      num("t30_community_gc_per_door", "T30 Community GC/Door"),
      num("t30_community_gc_per_avail_door", "T30 Community GC/Avail Door"),
      num("t30_portfolio_gc_per_door", "T30 Portfolio GC/Door"),
      num("t30_portfolio_gc_per_avail_door", "T30 Portfolio GC/Avail Door"),
    ],
  },
  "Website & SEO": {
    icon: Globe,
    timestampField: "website_seo_saved_at",
    fields: [
      num("t7_engaged_sessions_delta", "T7 Engaged Sessions Δ"),
      num("t7_organic_sessions_delta", "T7 Organic Sessions Δ"),
      num("t30_engaged_sessions_delta", "T30 Engaged Sessions Δ"),
      num("t30_organic_sessions_delta", "T30 Organic Sessions Δ"),
      num("t7_organic_visibility", "T7 Organic Visibility"),
      num("t7_serp_traffic", "T7 SERP Traffic"),
      area("website_notes", "Website Notes"), area("seo_notes", "SEO Notes"),
    ],
  },
  "Marketing Projects": {
    icon: Camera,
    timestampField: "marketing_saved_at",
    fields: [area("photography_needs", "Photography Needs"), area("signage_needs", "Signage Needs"), area("capex_projects", "Capex Projects")],
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
    fields: [area("recent_pricing_call", "Recent Pricing Call"), area("pricing_strategy_notes", "Pricing Strategy Notes"), area("current_specials", "Current Specials")],
  },
};

// ── Page ──

export default function MarketingPage() {
  const [communityId, setCommunityId] = React.useState("");
  const [weekDate, setWeekDate] = React.useState<Date | null>(null);
  const [data, setData] = React.useState<MarketingData | null>(null);
  const [recordId, setRecordId] = React.useState<string>("new");
  const [formState, setFormState] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [savedSection, setSavedSection] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!communityId || !weekDate) { setData(null); setRecordId("new"); setFormState({}); return; }
    const dateStr = format(weekDate, "yyyy-MM-dd");
    getMarketingData({ community_id: communityId, week_date: dateStr })
      .then((items) => {
        const existing = items[0] ?? null;
        setData(existing);
        setRecordId(existing?.id ?? "new");
        const state: Record<string, string> = {};
        if (existing) {
          for (const section of Object.values(SECTIONS)) {
            for (const f of section.fields) {
              const val = existing[f.key];
              if (val != null) state[f.key] = String(val);
            }
          }
        }
        setFormState(state);
      })
      .catch(() => { setData(null); setRecordId("new"); setFormState({}); });
  }, [communityId, weekDate]);

  const handleSaveSection = async (sectionName: string, sectionDef: SectionDef) => {
    if (!communityId || !weekDate) return;
    setSaving(sectionName);
    setSavedSection(null);
    try {
      const payload: Record<string, unknown> = {
        community_id: communityId,
        week_date: format(weekDate, "yyyy-MM-dd"),
        section: sectionName.toLowerCase().replace(/ & /g, "_").replace(/ /g, "_"),
      };
      for (const f of sectionDef.fields) {
        const raw = formState[f.key];
        if (raw === undefined || raw === "") continue;
        payload[f.key] = f.type === "number" ? parseFloat(raw) || 0 : raw;
      }
      payload[sectionDef.timestampField] = new Date().toISOString();
      const result = await upsertMarketingData(recordId, payload);
      if (result.id) setRecordId(result.id);
      setData((prev) => ({ ...prev, ...payload, id: result.id } as MarketingData));
      setSavedSection(sectionName);
      setTimeout(() => setSavedSection(null), 3000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(null);
    }
  };

  const formatSavedAt = (field: string): string | null => {
    const val = data?.[field] as string | undefined;
    if (!val) return null;
    try { return formatDistanceToNow(new Date(val), { addSuffix: true }); } catch { return null; }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#15284B]">Marketing Data</h1>
            <p className="mt-2 text-slate-600">Weekly marketing insights across 7 categories</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WeekDatePicker value={weekDate} onChange={setWeekDate} />
            <CommunitySelector value={communityId} onValueChange={setCommunityId} />
          </div>
        </div>

        {!communityId || !weekDate ? (
          <Card><CardContent className="p-12 text-center">
            <Megaphone className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-900">Select a Community and Date</h3>
            <p className="text-slate-600">Choose a community and week ending date to enter marketing data.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(SECTIONS).map(([name, section]) => {
              const Icon = section.icon;
              const savedAt = formatSavedAt(section.timestampField);
              return (
                <Card key={name}>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#15284B]/10">
                          <Icon className="h-4 w-4 text-[#15284B]" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
                          {savedAt && <p className="text-xs text-slate-500">Last saved {savedAt}</p>}
                        </div>
                        {savedSection === name && <CheckCircle className="ml-2 h-4 w-4 text-green-600" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-slate-100 px-6 py-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {section.fields.map((f) => (
                          <div key={f.key} className={f.type === "textarea" ? "md:col-span-2 lg:col-span-3" : ""}>
                            <Label htmlFor={f.key} className="mb-1 block text-sm text-slate-700">{f.label}</Label>
                            {f.type === "textarea" ? (
                              <Textarea id={f.key} value={formState[f.key] ?? ""} onChange={(e) => setFormState((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} className="min-h-[80px]" />
                            ) : (
                              <Input id={f.key} type={f.type} step="any" value={formState[f.key] ?? ""} onChange={(e) => setFormState((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button onClick={() => handleSaveSection(name, section)} disabled={saving === name} size="sm">
                          {saving === name ? (
                            <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />Saving…</>
                          ) : (
                            <><Save className="mr-2 h-4 w-4" />Save {name}</>
                          )}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
