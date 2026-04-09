"use client";

import React from "react";
import {
  createIntelligenceAdvocatePrompt,
  createIntelligenceDirective,
  getIntelligenceOffice,
  updateIntelligenceDirective,
  updateIntelligenceOffice,
  updateIntelligenceProperty,
  type IntelligenceAdvocatePrompt,
  type IntelligenceDirective,
  type IntelligenceOfficeProfile,
  type IntelligencePilotProperty,
  type IntelligenceSource,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpenText, Loader2, CheckCircle2, XCircle, Plus, Sparkles } from "lucide-react";

type Flash = { type: "success" | "error"; text: string } | null;

function formatStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function IntelligenceOfficePage() {
  const [loading, setLoading] = React.useState(true);
  const [flash, setFlash] = React.useState<Flash>(null);
  const [office, setOffice] = React.useState<IntelligenceOfficeProfile | null>(null);
  const [directives, setDirectives] = React.useState<IntelligenceDirective[]>([]);
  const [sources, setSources] = React.useState<IntelligenceSource[]>([]);
  const [properties, setProperties] = React.useState<IntelligencePilotProperty[]>([]);
  const [advocatePrompts, setAdvocatePrompts] = React.useState<IntelligenceAdvocatePrompt[]>([]);

  const [officeDraft, setOfficeDraft] = React.useState({
    office_name: "",
    office_label: "",
    mission: "",
    source_of_truth: "",
    operating_model: "",
    naming_rationale: "",
  });

  const [newDirective, setNewDirective] = React.useState({
    category: "search-quality",
    title: "",
    directive_text: "",
    rationale: "",
    status: "active" as "active" | "draft" | "archived",
  });

  const [selectedPropertyId, setSelectedPropertyId] = React.useState("");
  const [advocateDraft, setAdvocateDraft] = React.useState({
    prompt_text: "",
    desired_outcome: "",
  });

  const refresh = React.useCallback(async () => {
    const data = await getIntelligenceOffice();
    setOffice(data.office);
    setOfficeDraft({
      office_name: data.office.office_name,
      office_label: data.office.office_label,
      mission: data.office.mission,
      source_of_truth: data.office.source_of_truth,
      operating_model: data.office.operating_model,
      naming_rationale: data.office.naming_rationale,
    });
    setDirectives(data.directives);
    setSources(data.sources);
    setProperties(data.properties);
    setAdvocatePrompts(data.advocatePrompts);
    setSelectedPropertyId((current) => current || data.properties[0]?.property_id || "");
  }, []);

  React.useEffect(() => {
    refresh()
      .catch((err: Error) => setFlash({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function saveOffice() {
    try {
      const updated = await updateIntelligenceOffice(officeDraft);
      setOffice(updated);
      setFlash({ type: "success", text: "Intelligence Office updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function saveDirective(id: string, body: Partial<IntelligenceDirective>) {
    try {
      const updated = await updateIntelligenceDirective(id, body);
      setDirectives((items) => items.map((item) => (item.id === id ? updated : item)));
      setFlash({ type: "success", text: "Directive updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addDirective() {
    try {
      const created = await createIntelligenceDirective(newDirective);
      setDirectives((items) => [...items, created].sort((a, b) => a.sort_order - b.sort_order));
      setNewDirective({ category: "search-quality", title: "", directive_text: "", rationale: "", status: "active" });
      setFlash({ type: "success", text: "Directive added." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function saveProperty(propertyId: string, body: Partial<IntelligencePilotProperty>) {
    try {
      const updated = await updateIntelligenceProperty(propertyId, {
        revised_url: body.revised_url ?? "",
        editorial_focus: body.editorial_focus,
        approved_points: body.approved_points,
        open_questions: body.open_questions,
        advocate_prompt: body.advocate_prompt,
      });
      setProperties((items) => items.map((item) => (item.property_id === propertyId ? updated : item)));
      setFlash({ type: "success", text: "Property intelligence updated." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function addAdvocatePrompt() {
    if (!selectedPropertyId) return;
    try {
      const created = await createIntelligenceAdvocatePrompt({
        property_id: selectedPropertyId,
        prompt_text: advocateDraft.prompt_text,
        desired_outcome: advocateDraft.desired_outcome,
      });
      setAdvocatePrompts((items) => [created, ...items]);
      setAdvocateDraft({ prompt_text: "", desired_outcome: "" });
      setFlash({ type: "success", text: "Advocate instruction captured." });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Intelligence Office…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BookOpenText className="h-6 w-6 text-[#0D5E6D]" />
            <h1 className="text-2xl font-bold text-slate-900">Intelligence Office</h1>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
            The governed office behind the content engine. This is where Alex&apos;s directions, search-quality rules,
            property-specific guidance, and approved evidence become visible and editable before they shape briefs or copy.
          </p>
        </div>
        {office && (
          <Badge className="border-0 bg-[#15284B]/10 px-3 py-1.5 text-[#15284B]">
            Updated {formatStamp(office.updated_at)}
          </Badge>
        )}
      </div>

      {flash && (
        <div
          className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
            flash.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {flash.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {flash.text}
          <button className="ml-auto text-xs font-semibold uppercase tracking-wide" onClick={() => setFlash(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Tabs defaultValue="office">
        <TabsList>
          <TabsTrigger value="office">Office</TabsTrigger>
          <TabsTrigger value="directives">Directives</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="properties">Pilot Properties</TabsTrigger>
          <TabsTrigger value="advocate">Advocate Console</TabsTrigger>
        </TabsList>

        <TabsContent value="office" className="mt-4">
          <Card>
            <CardContent className="grid gap-5 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Office name</Label>
                <Input value={officeDraft.office_name} onChange={(e) => setOfficeDraft((d) => ({ ...d, office_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Presented label</Label>
                <Input value={officeDraft.office_label} onChange={(e) => setOfficeDraft((d) => ({ ...d, office_label: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mission</Label>
                <Textarea rows={3} value={officeDraft.mission} onChange={(e) => setOfficeDraft((d) => ({ ...d, mission: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Source of truth</Label>
                <Textarea rows={3} value={officeDraft.source_of_truth} onChange={(e) => setOfficeDraft((d) => ({ ...d, source_of_truth: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Operating model</Label>
                <Textarea rows={4} value={officeDraft.operating_model} onChange={(e) => setOfficeDraft((d) => ({ ...d, operating_model: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Naming rationale</Label>
                <Textarea rows={3} value={officeDraft.naming_rationale} onChange={(e) => setOfficeDraft((d) => ({ ...d, naming_rationale: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={saveOffice}>Save Office</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directives" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={newDirective.category} onChange={(e) => setNewDirective((d) => ({ ...d, category: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={newDirective.status}
                  onChange={(e) =>
                    setNewDirective((d) => ({ ...d, status: e.target.value as "active" | "draft" | "archived" }))
                  }
                >
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Directive title</Label>
                <Input value={newDirective.title} onChange={(e) => setNewDirective((d) => ({ ...d, title: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Directive text</Label>
                <Textarea rows={4} value={newDirective.directive_text} onChange={(e) => setNewDirective((d) => ({ ...d, directive_text: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Rationale</Label>
                <Textarea rows={3} value={newDirective.rationale} onChange={(e) => setNewDirective((d) => ({ ...d, rationale: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={addDirective}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Directive
                </Button>
              </div>
            </CardContent>
          </Card>

          {directives.map((directive) => (
            <DirectiveCard key={directive.id} directive={directive} onSave={saveDirective} />
          ))}
        </TabsContent>

        <TabsContent value="sources" className="mt-4 grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <Card key={source.id}>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{source.title}</h3>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{source.source_kind}</p>
                  </div>
                  <Badge className="border-0 bg-slate-100 text-slate-700">{source.status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Repo path</p>
                  <p className="rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{source.relative_path}</p>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Summary</p>
                  <p>{source.summary}</p>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Evidence excerpt</p>
                  <p>{source.evidence_excerpt}</p>
                </div>
                <p className="text-xs text-slate-400">Updated {formatStamp(source.updated_at)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="properties" className="mt-4 space-y-4">
          {properties.map((property) => (
            <PropertyCard key={property.property_id} property={property} onSave={saveProperty} />
          ))}
        </TabsContent>

        <TabsContent value="advocate" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-[#0D5E6D]">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-slate-900">Advocate Console</h2>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Use this window to give Alex&apos;s instructions to the property advocate in plain language: desired tone,
                priorities, forbidden moves, fixes, or guidance that should shape the brief before the engine writes.
              </p>

              <div className="space-y-2">
                <Label>Property</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                >
                  {properties.map((property) => (
                    <option key={property.property_id} value={property.property_id}>
                      {property.property_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Desired outcome</Label>
                <Input
                  value={advocateDraft.desired_outcome}
                  onChange={(e) => setAdvocateDraft((d) => ({ ...d, desired_outcome: e.target.value }))}
                  placeholder="Example: Make the homepage feel more local and less templated."
                />
              </div>
              <div className="space-y-2">
                <Label>Instruction to the property advocate</Label>
                <Textarea
                  rows={6}
                  value={advocateDraft.prompt_text}
                  onChange={(e) => setAdvocateDraft((d) => ({ ...d, prompt_text: e.target.value }))}
                  placeholder="Explain desires, rules, fixes, prohibited phrasing, source priorities, or what should be emphasized."
                />
              </div>
              <Button onClick={addAdvocatePrompt}>Save Advocate Instruction</Button>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {advocatePrompts
              .filter((item) => !selectedPropertyId || item.property_id === selectedPropertyId)
              .map((item) => (
                <Card key={item.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {properties.find((property) => property.property_id === item.property_id)?.property_name ?? item.property_id}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Desired outcome</p>
                        <p className="text-sm text-slate-700">{item.desired_outcome}</p>
                      </div>
                      <p className="text-xs text-slate-400">{formatStamp(item.updated_at)}</p>
                    </div>
                    <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.prompt_text}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DirectiveCard({
  directive,
  onSave,
}: {
  directive: IntelligenceDirective;
  onSave: (id: string, body: Partial<IntelligenceDirective>) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(directive);

  React.useEffect(() => {
    setDraft(directive);
  }, [directive]);

  return (
    <Card>
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as IntelligenceDirective["status"] }))}
          >
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Title</Label>
          <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Directive</Label>
          <Textarea rows={4} value={draft.directive_text} onChange={(e) => setDraft((d) => ({ ...d, directive_text: e.target.value }))} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Rationale</Label>
          <Textarea rows={3} value={draft.rationale} onChange={(e) => setDraft((d) => ({ ...d, rationale: e.target.value }))} />
        </div>
        <div className="flex items-center justify-between md:col-span-2">
          <p className="text-xs text-slate-400">Updated {formatStamp(directive.updated_at)}</p>
          <Button onClick={() => onSave(directive.id, draft)}>Save Directive</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyCard({
  property,
  onSave,
}: {
  property: IntelligencePilotProperty;
  onSave: (propertyId: string, body: Partial<IntelligencePilotProperty>) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(property);

  React.useEffect(() => {
    setDraft(property);
  }, [property]);

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{property.property_name}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-500">{property.property_id}</p>
          </div>
          <Badge className="border-0 bg-slate-100 text-slate-700">Updated {formatStamp(property.updated_at)}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UrlField label="Legacy URL" value={draft.legacy_url ?? ""} readOnly />
          <UrlField label="Staging URL" value={draft.staging_url ?? ""} readOnly />
          <UrlField label="Live URL" value={draft.live_url ?? ""} readOnly />
          <div className="space-y-2">
            <Label>Revised URL</Label>
            <Input value={draft.revised_url ?? ""} onChange={(e) => setDraft((d) => ({ ...d, revised_url: e.target.value }))} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Editorial focus</Label>
            <Textarea rows={4} value={draft.editorial_focus} onChange={(e) => setDraft((d) => ({ ...d, editorial_focus: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Approved points</Label>
            <Textarea rows={4} value={draft.approved_points} onChange={(e) => setDraft((d) => ({ ...d, approved_points: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Open questions / evidence gaps</Label>
            <Textarea rows={4} value={draft.open_questions} onChange={(e) => setDraft((d) => ({ ...d, open_questions: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Standing advocate prompt</Label>
            <Textarea rows={4} value={draft.advocate_prompt} onChange={(e) => setDraft((d) => ({ ...d, advocate_prompt: e.target.value }))} />
          </div>
        </div>

        <Button onClick={() => onSave(property.property_id, draft)}>Save Property Brief</Button>
      </CardContent>
    </Card>
  );
}

function UrlField({ label, value, readOnly = false }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly={readOnly} />
    </div>
  );
}
