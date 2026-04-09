"use client";

import React from "react";
import {
  crawlSiteContentProperty,
  getIntelligenceOffice,
  getSiteContentInventory,
  getSiteContentProperty,
  type IntelligenceDirective,
  type IntelligenceSource,
  type SiteContentPage,
  type SiteContentPropertySummary,
  type SiteContentSection,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BookText, FileSearch, Loader2, RefreshCw, Sparkles } from "lucide-react";

type Flash = { type: "success" | "error"; text: string } | null;

function formatStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function SiteContentCreatorPage() {
  const [loading, setLoading] = React.useState(true);
  const [crawling, setCrawling] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("inventory");
  const [flash, setFlash] = React.useState<Flash>(null);
  const [properties, setProperties] = React.useState<SiteContentPropertySummary[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState("");
  const [selectedPages, setSelectedPages] = React.useState<SiteContentPage[]>([]);
  const [focusedPageId, setFocusedPageId] = React.useState<string>("all");
  const [selectedPropertyName, setSelectedPropertyName] = React.useState("");
  const [selectedPageLimit, setSelectedPageLimit] = React.useState("8");
  const [directives, setDirectives] = React.useState<IntelligenceDirective[]>([]);
  const [sources, setSources] = React.useState<IntelligenceSource[]>([]);

  const loadInventory = React.useCallback(async () => {
    const [inventory, office] = await Promise.all([getSiteContentInventory(), getIntelligenceOffice()]);
    setProperties(inventory.properties);
    setDirectives(office.directives);
    setSources(office.sources);

    const nextPropertyId = selectedPropertyId || inventory.properties[0]?.property_id || "";
    if (nextPropertyId) {
      setSelectedPropertyId(nextPropertyId);
      const detail = await getSiteContentProperty(nextPropertyId);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId("all");
    }
  }, [selectedPropertyId]);

  React.useEffect(() => {
    loadInventory()
      .catch((err: Error) => setFlash({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [loadInventory]);

  async function loadProperty(propertyId: string) {
    setSelectedPropertyId(propertyId);
    try {
      const detail = await getSiteContentProperty(propertyId);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId("all");
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    }
  }

  async function runCrawl() {
    if (!selectedPropertyId) return;
    setCrawling(true);
    setFlash(null);
    try {
      await crawlSiteContentProperty(selectedPropertyId, {
        page_limit: Number(selectedPageLimit) || 8,
      });
      const [inventory, detail] = await Promise.all([
        getSiteContentInventory(),
        getSiteContentProperty(selectedPropertyId),
      ]);
      setProperties(inventory.properties);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId("all");
      setActiveTab("inventory");
      setFlash({ type: "success", text: `Crawled ${detail.pages.length} pages for ${detail.property.property_name}.` });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    } finally {
      setCrawling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Site Content Creator…
      </div>
    );
  }

  const selectedSummary = properties.find((property) => property.property_id === selectedPropertyId) ?? null;
  const visiblePages = focusedPageId === "all" ? selectedPages : selectedPages.filter((page) => page.id === focusedPageId);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <FileSearch className="h-6 w-6 text-[#0D5E6D]" />
            <h1 className="text-2xl font-bold text-slate-900">Site Content Creator</h1>
          </div>
          <p className="max-w-5xl text-sm leading-6 text-slate-600">
            Crawl live property pages, capture the original section copy as historic baseline, and line it up next to the
            Intelligence Office rules, criteria, and source documents that should guide new short-form SEO copy.
          </p>
        </div>
      </div>

      {flash && (
        <div className={`rounded-md px-4 py-3 text-sm ${flash.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {flash.text}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[1.6fr_0.8fr_0.6fr_auto]">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pilot property</label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedPropertyId}
              onChange={(e) => loadProperty(e.target.value)}
            >
              {properties.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.property_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page crawl limit</label>
            <Input value={selectedPageLimit} onChange={(e) => setSelectedPageLimit(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current crawl</label>
            <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              {selectedSummary ? `${selectedSummary.page_count} pages / ${selectedSummary.section_count} sections` : "—"}
            </div>
          </div>
          <div className="flex items-end">
            <Button onClick={runCrawl} disabled={!selectedPropertyId || crawling}>
              {crawling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Crawl Site
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="brief">Brief Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-4">
              <StatCard label="Property" value={selectedPropertyName || "—"} />
              <StatCard label="Pages captured" value={String(selectedSummary?.page_count ?? 0)} />
              <StatCard label="Sections mapped" value={String(selectedSummary?.section_count ?? 0)} />
              <StatCard label="Last crawled" value={formatStamp(selectedSummary?.last_crawled_at)} />
            </CardContent>
          </Card>

          {selectedPages.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <div>
                  <p className="text-base font-semibold text-slate-900">Captured pages</p>
                  <p className="text-sm text-slate-600">
                    These are the pages found in the crawl. Select them below in order as a quick map before reviewing
                    section-level copy.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {selectedPages.map((page) => (
                    <button
                      key={`nav-${page.id}`}
                      type="button"
                      onClick={() => setFocusedPageId(page.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        focusedPageId === page.id
                          ? "border-[#0D5E6D] bg-[#0D5E6D]/5"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{page.page_title || page.page_path || page.page_url}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        {page.page_type || "page"} • {page.sections.length} sections
                      </p>
                      <p className="mt-2 break-words text-sm text-slate-600">{page.page_path || page.page_url}</p>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={focusedPageId === "all" ? "default" : "outline"}
                    onClick={() => setFocusedPageId("all")}
                  >
                    Show all pages
                  </Button>
                  {selectedPages.map((page) => (
                    <Button
                      key={`filter-${page.id}`}
                      type="button"
                      variant={focusedPageId === page.id ? "default" : "outline"}
                      onClick={() => setFocusedPageId(page.id)}
                    >
                      {page.page_type || page.page_title || page.page_path || "Page"}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedPages.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="text-base font-semibold text-slate-900">No page inventory yet</p>
                <p className="text-sm text-slate-600">
                  Run a crawl for the selected property and this tab will populate with the captured pages, section map,
                  and original copy baseline.
                </p>
              </CardContent>
            </Card>
          ) : (
            visiblePages.map((page) => (
              <Card key={page.id} id={`page-${page.id}`}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900">{page.page_title || page.page_path || page.page_url}</h3>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {page.page_type || "page"} • {page.page_path || "/"} • {page.sections.length} sections
                      </p>
                      <p className="text-sm text-slate-600">{page.page_url}</p>
                      {page.meta_description && <p className="text-sm text-slate-500">Meta: {page.meta_description}</p>}
                    </div>
                    <Badge className="border-0 bg-slate-100 text-slate-700">{page.crawl_status}</Badge>
                  </div>

                  {page.sections.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      This page was discovered, but no section blocks were extracted yet.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {page.sections.map((section) => (
                        <SectionCard key={`${page.id}-${section.section_order}`} section={section} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="brief" className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-[#0D5E6D]">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-slate-900">Brief Intelligence for site copy</h2>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                These directives and source notes are the visible rules behind section rewrites. They should shape how
                homepage, amenities, floor plan, and neighborhood copy is regenerated for the pilot properties.
              </p>
              <div className="space-y-3">
                {directives.map((directive) => (
                  <div key={directive.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{directive.title}</p>
                      <Badge className="border-0 bg-[#15284B]/10 text-[#15284B]">{directive.category}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{directive.directive_text}</p>
                    <p className="mt-2 text-xs text-slate-500">{directive.rationale}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-[#0D5E6D]">
                <BookText className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-slate-900">Source documents in play</h2>
              </div>
              <div className="space-y-3">
                {sources.map((source) => (
                  <div key={source.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">{source.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{source.source_kind}</p>
                    <p className="mt-2 text-sm text-slate-700">{source.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">{source.evidence_excerpt}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SectionCard({ section }: { section: SiteContentSection }) {
  const hasMedia = section.image_count > 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold leading-6 text-slate-900">
            {section.section_label || section.heading || `Section ${section.section_order + 1}`}
          </p>
          {section.heading && section.heading !== section.section_label && (
            <p className="mt-1 text-sm text-slate-600">Visible heading: {section.heading}</p>
          )}
          <p className="text-xs uppercase tracking-wide text-slate-500">{section.section_type || "standard"}</p>
        </div>
        <div className="flex gap-2">
          <Badge className="border-0 bg-white text-slate-700">{section.image_count} images</Badge>
          <Badge className="border-0 bg-white text-slate-700">{section.link_count} links</Badge>
        </div>
      </div>

      <div className={`mt-3 grid gap-4 ${hasMedia ? "lg:grid-cols-[1.35fr_0.65fr]" : ""}`}>
        <div className="space-y-3">
          {section.bullet_points.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {section.bullet_points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          )}

          <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{section.original_copy}</div>
        </div>

        {hasMedia && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex h-full min-h-[220px] flex-col rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image area</p>
              <div className="mt-3 flex-1 rounded-md bg-[linear-gradient(180deg,rgba(21,40,75,0.08),rgba(13,94,109,0.12))]" />
              <div className="mt-3 space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {section.section_label || section.heading || "Section image"}
                </p>
                <p className="text-sm text-slate-600">
                  Use the section visual here to mirror the live page layout and support the adjacent copy.
                </p>
                <p className="text-xs text-slate-500">
                  {section.image_count} image{section.image_count === 1 ? "" : "s"} detected on source page
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
