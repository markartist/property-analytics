"use client";

import React from "react";
import {
  crawlSiteContentProperty,
  getGovernedMemoryContext,
  getGovernedMemoryPropertyLog,
  getIntelligenceOffice,
  getIntelligencePropertyBriefInputs,
  getSiteContentInventory,
  getSiteContentProperty,
  type GovernedMemoryPropertyContext,
  type GovernedMemoryEntryWithEvidence,
  type IntelligenceClaim,
  type IntelligenceClaimEvidence,
  type IntelligenceEvidence,
  type IntelligenceDirective,
  type IntelligencePilotProperty,
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
  const [intelligenceProperties, setIntelligenceProperties] = React.useState<IntelligencePilotProperty[]>([]);
  const [claims, setClaims] = React.useState<IntelligenceClaim[]>([]);
  const [evidenceItems, setEvidenceItems] = React.useState<IntelligenceEvidence[]>([]);
  const [claimEvidenceLinks, setClaimEvidenceLinks] = React.useState<IntelligenceClaimEvidence[]>([]);
  const [memoryContext, setMemoryContext] = React.useState<GovernedMemoryPropertyContext | null>(null);
  const [captainLog, setCaptainLog] = React.useState<GovernedMemoryEntryWithEvidence[]>([]);
  const [captainIdentity, setCaptainIdentity] = React.useState<string>("");
  const [showFleetContext, setShowFleetContext] = React.useState(false);
  const [showLedgerContext, setShowLedgerContext] = React.useState(false);

  function resetPropertyDetailState() {
    setSelectedPages([]);
    setSelectedPropertyName("");
    setMemoryContext(null);
    setCaptainLog([]);
    setCaptainIdentity("");
    setClaims([]);
    setEvidenceItems([]);
    setClaimEvidenceLinks([]);
    setFocusedPageId("all");
  }

  const loadInventory = React.useCallback(async () => {
    const inventory = await getSiteContentInventory();
    setProperties(inventory.properties);

    try {
      const office = await getIntelligenceOffice();
      setDirectives(office.directives);
      setSources(office.sources);
      setIntelligenceProperties(office.properties);
    } catch {
      setDirectives([]);
      setSources([]);
      setIntelligenceProperties([]);
    }

    const nextPropertyId = selectedPropertyId || inventory.properties[0]?.property_id || "";
    if (nextPropertyId) {
      await loadProperty(nextPropertyId, inventory.properties);
    }
  }, [selectedPropertyId]);

  React.useEffect(() => {
    loadInventory()
      .catch((err: Error) => setFlash({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [loadInventory]);

  async function loadSupplementalPropertyData(propertyId: string) {
    const [logResult, briefInputsResult, memoryResult] = await Promise.allSettled([
      getGovernedMemoryPropertyLog(propertyId),
      getIntelligencePropertyBriefInputs(propertyId),
      getGovernedMemoryContext(propertyId),
    ]);

    if (logResult.status === "fulfilled") {
      setCaptainLog(logResult.value.entries);
      setCaptainIdentity(logResult.value.context.identity.display_name);
    } else {
      setCaptainLog([]);
      setCaptainIdentity("");
    }

    if (briefInputsResult.status === "fulfilled") {
      setClaims(briefInputsResult.value.claims);
      setEvidenceItems(briefInputsResult.value.evidence);
      setClaimEvidenceLinks(briefInputsResult.value.claimEvidence);
    } else {
      setClaims([]);
      setEvidenceItems([]);
      setClaimEvidenceLinks([]);
    }

    if (memoryResult.status === "fulfilled") {
      setMemoryContext(memoryResult.value);
    } else {
      setMemoryContext(null);
    }
  }

  async function loadProperty(
    propertyId: string,
    propertyOptions: SiteContentPropertySummary[] = properties
  ): Promise<{ propertyName: string; pageCount: number; resolvedPropertyId: string } | null> {
    setSelectedPropertyId(propertyId);
    resetPropertyDetailState();
    try {
      const detail = await getSiteContentProperty(propertyId);
      const canonicalPropertyId = detail.property.property_id;
      setSelectedPropertyId(canonicalPropertyId);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId("all");
      await loadSupplementalPropertyData(canonicalPropertyId);
      setFlash(null);
      return {
        propertyName: detail.property.property_name,
        pageCount: detail.pages.length,
        resolvedPropertyId: canonicalPropertyId,
      };
    } catch (err: any) {
      const fallbackId = resolvePropertyIdFallback(propertyId, propertyOptions);
      if (fallbackId && fallbackId !== propertyId) {
        try {
          resetPropertyDetailState();
          const detail = await getSiteContentProperty(fallbackId);
          const canonicalPropertyId = detail.property.property_id;
          setSelectedPropertyId(canonicalPropertyId);
          setSelectedPropertyName(detail.property.property_name);
          setSelectedPages(detail.pages);
          setFocusedPageId("all");
          await loadSupplementalPropertyData(canonicalPropertyId);
          setFlash(null);
          return {
            propertyName: detail.property.property_name,
            pageCount: detail.pages.length,
            resolvedPropertyId: canonicalPropertyId,
          };
        } catch (fallbackErr: any) {
          setFlash({
            type: "error",
            text: `${fallbackErr.message} (requested: ${propertyId}, fallback: ${fallbackId})`,
          });
          return null;
        }
      }
      setFlash({ type: "error", text: `${err.message} (requested: ${propertyId})` });
      return null;
    }
  }

  async function runCrawl() {
    if (!selectedPropertyId) return;
    if (!readiness || readiness.completeness_status !== "ready") {
      setFlash({
        type: "error",
        text: `Captain's Brief is not ready. Missing: ${
          missingComponents.length ? missingComponents.map(formatMissingComponent).join(", ") : "requirements"
        }.`,
      });
      return;
    }
    setCrawling(true);
    setFlash(null);
    try {
      await crawlSiteContentProperty(selectedPropertyId, {
        page_limit: Number(selectedPageLimit) || 8,
      });
      const inventory = await getSiteContentInventory();
      setProperties(inventory.properties);
      const loaded = await loadProperty(selectedPropertyId, inventory.properties);
      setFocusedPageId("all");
      setActiveTab("inventory");
      if (loaded) {
        setFlash({ type: "success", text: `Crawled ${loaded.pageCount} pages for ${loaded.propertyName}.` });
      }
    } catch (err: any) {
      const fallbackId = resolvePropertyIdFallback(selectedPropertyId, properties);
      if (fallbackId && fallbackId !== selectedPropertyId) {
        try {
          await crawlSiteContentProperty(fallbackId, {
            page_limit: Number(selectedPageLimit) || 8,
          });
          const inventory = await getSiteContentInventory();
          setProperties(inventory.properties);
          const loaded = await loadProperty(fallbackId, inventory.properties);
          setFocusedPageId("all");
          setActiveTab("inventory");
          if (loaded) {
            setFlash({ type: "success", text: `Crawled ${loaded.pageCount} pages for ${loaded.propertyName}.` });
          }
          return;
        } catch (fallbackErr: any) {
          setFlash({
            type: "error",
            text: `${fallbackErr.message} (requested: ${selectedPropertyId}, fallback: ${fallbackId})`,
          });
          return;
        }
      }
      setFlash({ type: "error", text: `${err.message} (requested: ${selectedPropertyId})` });
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
  const displayPropertyName = selectedPropertyName || selectedSummary?.property_name || "—";
  const hasCapturedInventory = (selectedSummary?.page_count ?? 0) > 0 || selectedPages.length > 0;
  const readiness = selectedSummary?.brief_readiness ?? null;
  const hasCaptainLog = captainLog.length > 0;
  const selectedIntelligenceProperty =
    intelligenceProperties.find((property) => property.property_id === selectedPropertyId) ?? null;
  const captainsBrief = buildCaptainsBrief({
    propertyId: selectedPropertyId,
    captainDisplayName: captainIdentity,
    captainLog,
    claims,
    evidenceItems,
    claimEvidenceLinks,
    intelligenceProperty: selectedIntelligenceProperty,
  });
  const propertyEvidenceItems = dedupeEvidenceItems(
    captainsBrief.claimsWithEvidence.flatMap(({ evidence }) => evidence)
  );
  const isBriefReady = readiness?.completeness_status === "ready";
  const missingComponents = readiness?.missing_components ?? [];

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
                  {property.property_name} • {formatReadinessLabel(property.brief_readiness)}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-500">
              Property key: {selectedPropertyId || "—"}{" "}
              {selectedPropertyId
                ? `• resolved: ${resolvePropertyIdFallback(selectedPropertyId, properties) || "none"}`
                : ""}
            </div>
            {readiness && (
              <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${
                readiness.completeness_status === "ready"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                Brief readiness: {formatReadinessLabel(readiness)}. Missing:{" "}
                {missingComponents.length ? missingComponents.map(formatMissingComponent).join(", ") : "none"}.
              </div>
            )}
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
          <div className="flex flex-col items-end gap-2">
            <Button onClick={runCrawl} disabled={!selectedPropertyId || crawling || !isBriefReady}>
              {crawling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Crawl Site
            </Button>
            {!isBriefReady && (
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Brief incomplete
              </p>
            )}
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
            <CardContent className="grid gap-4 p-6 md:grid-cols-5">
              <StatCard label="Property" value={displayPropertyName} />
              <StatCard label="Pages captured" value={String(selectedSummary?.page_count ?? selectedPages.length ?? 0)} />
              <StatCard label="Sections mapped" value={String(selectedSummary?.section_count ?? 0)} />
              <StatCard label="Brief readiness" value={readiness ? formatReadinessLabel(readiness) : "—"} />
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
                      <p className="font-semibold text-slate-900">
                        {page.spec_page_name || page.page_title || page.page_path || page.page_url}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        {page.page_type || "page"} • {page.sections.length} sections
                      </p>
                      {page.spec_archetype_name && (
                        <p className="mt-1 text-xs text-slate-500">
                          {page.spec_archetype_name} · {page.spec_page_id}
                        </p>
                      )}
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
                      {page.spec_page_name || page.page_type || page.page_title || page.page_path || "Page"}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedPages.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="text-base font-semibold text-slate-900">
                  {hasCapturedInventory ? "Captured inventory details unavailable" : "No page inventory yet"}
                </p>
                <p className="text-sm text-slate-600">
                  {hasCapturedInventory
                    ? "This property has recorded crawl inventory, but the detailed page records did not load for the current selection. The summary counts above are still coming from the stored inventory."
                    : "Run a crawl for the selected property and this tab will populate with the captured pages, section map, and original copy baseline."}
                </p>
              </CardContent>
            </Card>
          ) : (
            visiblePages.map((page) => (
              <Card key={page.id} id={`page-${page.id}`}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {page.spec_page_name || page.page_title || page.page_path || page.page_url}
                      </h3>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {page.page_type || "page"} • {page.page_path || "/"} • {page.sections.length} sections
                      </p>
                      {page.spec_layout_path && (
                        <p className="text-xs text-slate-500">
                          Specs: {page.spec_layout_path}
                        </p>
                      )}
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

        <TabsContent value="brief" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-lg font-semibold text-slate-900">Property Brief Inputs</p>
                <p className="text-sm text-slate-600">
                  The Captain&apos;s assessment is the lead signal for the property brief. Guidance and sources are
                  secondary inputs that shape how the brief gets translated into copy.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captain&apos;s Brief</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {captainIdentity || "Captain&apos;s Brief required"}
                    </p>
                  </div>
                  {captainLog.length === 0 ? (
                    <Badge className="border-0 bg-amber-100 text-amber-800">Needs brief</Badge>
                  ) : (
                    <Badge className="border-0 bg-[#15284B]/10 text-[#15284B]">
                      {captainLog.length} entries
                    </Badge>
                  )}
                </div>
                {captainLog.length === 0 ? (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No Captain&apos;s Brief entries yet. Add the Captain&apos;s Brief in Intelligence Office so the
                    property brief has its primary signal.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {captainLog.map(({ entry }) => (
                      <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{entry.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.source_system} · confidence {entry.confidence.toFixed(2)} · {formatStamp(entry.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-lg font-semibold text-slate-900">Captain&apos;s Brief (Composed View)</p>
                <p className="text-sm text-slate-600">
                  This brief is composed from Captain&apos;s Log memory, Intelligence Office guidance, and Data Pond
                  evidence. It is a read-model view, not a separate canonical store.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brief status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {captainsBrief.statusLabel}
                      </p>
                    </div>
                    <Badge className="border-0 bg-[#15284B]/10 text-[#15284B]">
                      {captainsBrief.completeness.complete}/{captainsBrief.completeness.total} fields
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                      <p className="mt-1 text-sm text-slate-700">{captainsBrief.summary || "No summary yet."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captain</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {captainsBrief.captainDisplayName || "Captain unavailable"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Confidence {captainsBrief.confidenceLabel}</span>
                      <span>•</span>
                      <span>Updated {captainsBrief.updatedAtLabel}</span>
                      <span>•</span>
                      <span>{captainsBrief.memoryEntryIds.length} memory entries</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priorities + Recommendations</p>
                  <div className="mt-2 space-y-2">
                    {captainsBrief.priorities.length === 0 ? (
                      <p className="text-sm text-slate-600">No priorities captured yet.</p>
                    ) : (
                      captainsBrief.priorities.map((item, index) => (
                        <p key={index} className="text-sm text-slate-700">
                          {item}
                        </p>
                      ))
                    )}
                  </div>
                  {captainsBrief.ctaGuidance && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CTA guidance</p>
                      <p className="mt-1 text-sm text-slate-700">{captainsBrief.ctaGuidance}</p>
                    </div>
                  )}
                </div>
              </div>
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved claims</p>
                  <div className="mt-2 space-y-3">
                    {captainsBrief.claimsWithEvidence.length === 0 ? (
                      <p className="text-sm text-slate-600">No structured claims on file.</p>
                    ) : (
                      captainsBrief.claimsWithEvidence.map(({ claim, evidence }) => (
                        <div key={claim.id} className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">{claim.claim_text}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {claim.source} · confidence {claim.confidence.toFixed(2)}
                          </p>
                          <div className="mt-2 space-y-1">
                            {evidence.length === 0 ? (
                              <p className="text-xs text-amber-700">No evidence linked.</p>
                            ) : (
                              evidence.map((item) => (
                                <p key={item.id} className="text-xs text-slate-600">
                                  {item.evidence_type} · {item.source_system} · {item.reference}
                                </p>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <BriefListCard
                  title="Evidence refs"
                  items={propertyEvidenceItems.map((item) => `${item.evidence_type} · ${item.source_system} · ${item.reference}`)}
                  emptyText="No evidence refs attached yet."
                />
                <BriefListCard title="Brief lineage" items={captainsBrief.memoryEntryIds} emptyText="No memory entries captured yet." />
              </div>
              {readiness?.migration_candidates?.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Migration candidates (legacy approved points)
                  </p>
                  <div className="mt-2 space-y-1">
                    {readiness.migration_candidates.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {memoryContext && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">Governed Memory</p>
                    <p className="text-sm text-slate-600">
                      Memory remains distinct from guidance and evidence. Fleet and institutional context are optional
                      and never part of the default Captain&apos;s Brief view.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setShowFleetContext((value) => !value)}>
                      {showFleetContext ? "Hide Fleet Context" : "Show Fleet Context"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowLedgerContext((value) => !value)}>
                      {showLedgerContext ? "Hide Institutional Context" : "Show Institutional Context"}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <MemoryScopeCard
                    label="Captain&apos;s Log"
                    subtitle={memoryContext.identity.display_name}
                    item={memoryContext.captainLog[0] ?? null}
                  />
                  {showFleetContext && (
                    <MemoryScopeCard
                      label="Fleet Context"
                      subtitle={memoryContext.fleetKey}
                      item={memoryContext.fleetBrief[0] ?? null}
                    />
                  )}
                  {showLedgerContext && (
                    <MemoryScopeCard
                      label="Institutional Context"
                      subtitle="The Ledger"
                      item={memoryContext.ledger[0] ?? null}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-[#0D5E6D]">
                  <Sparkles className="h-5 w-5" />
                  <h2 className="text-lg font-semibold text-slate-900">Guidance</h2>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  The Intelligence Office guidance layer. These directives shape rewrites but never overwrite governed
                  memory or evidence.
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
                  <h2 className="text-lg font-semibold text-slate-900">Evidence</h2>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  Evidence remains separate from both memory and guidance. Structured evidence objects and source
                  documents are surfaced below.
                </p>
                <div className="space-y-3">
                  {propertyEvidenceItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{item.summary}</p>
                        <Badge className="border-0 bg-slate-100 text-slate-700">{item.evidence_type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.source_system} · {item.reference}
                      </p>
                    </div>
                  ))}
                  {propertyEvidenceItems.length === 0 && (
                    <p className="text-sm text-slate-600">No selected-property evidence is linked to active claims yet.</p>
                  )}
                </div>
                <div className="mt-4 space-y-3">
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MemoryScopeCard({
  label,
  subtitle,
  item,
}: {
  label: string;
  subtitle: string;
  item: GovernedMemoryPropertyContext["captainLog"][number] | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{subtitle}</p>
      {item ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-700">{item.entry.summary}</p>
          <p className="text-xs text-slate-500">
            Scope {item.entry.scope} · Status {item.entry.status} · Confidence {item.entry.confidence.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">
            Provenance {item.evidence.length} evidence refs · {item.lineage.length} lineage records
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No authoritative memory is available yet.</p>
      )}
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

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatReadinessLabel(readiness: { completeness_status: string; completeness_score: number } | null) {
  if (!readiness) return "No brief";
  if (readiness.completeness_status === "ready") return "Ready";
  if (readiness.completeness_status === "partial") return `Partial (${readiness.completeness_score}%)`;
  return "Incomplete";
}

function formatMissingComponent(component: string) {
  switch (component) {
    case "captains_log":
      return "Captain's Log";
    case "summary":
      return "Summary";
    case "priorities":
      return "Priorities";
    case "claims":
      return "Claims";
    case "evidence":
      return "Evidence";
    case "confidence":
      return "Confidence";
    case "recent_update":
      return "Recent update";
    default:
      return component;
  }
}

function resolvePropertyIdFallback(propertyId: string, properties: SiteContentPropertySummary[]) {
  if (!propertyId || properties.length === 0) return null;
  const target = normalizeLookup(propertyId);
  return (
    properties.find((p) => normalizeLookup(p.property_id) === target)?.property_id ??
    properties.find((p) => normalizeLookup(p.property_name) === target)?.property_id ??
    null
  );
}

function parsePayloadJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractBriefPayload(entries: GovernedMemoryEntryWithEvidence[]) {
  const sorted = [...entries].sort((a, b) => (a.entry.updated_at > b.entry.updated_at ? -1 : 1));
  const entryWithPayload = sorted.find((item) => item.entry.structured_payload_json);
  if (!entryWithPayload) {
    return { entry: sorted[0] ?? null, payload: null };
  }
  return { entry: entryWithPayload, payload: parsePayloadJson(entryWithPayload.entry.structured_payload_json) };
}

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim().length > 0) as string[];
  if (typeof value === "string") {
    return value
      .split(/\n|•|-/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function buildCaptainsBrief({
  propertyId,
  captainDisplayName,
  captainLog,
  claims,
  evidenceItems,
  claimEvidenceLinks,
  intelligenceProperty,
}: {
  propertyId: string;
  captainDisplayName: string;
  captainLog: GovernedMemoryEntryWithEvidence[];
  claims: IntelligenceClaim[];
  evidenceItems: IntelligenceEvidence[];
  claimEvidenceLinks: IntelligenceClaimEvidence[];
  intelligenceProperty: IntelligencePilotProperty | null;
}) {
  const { entry, payload } = extractBriefPayload(captainLog);
  const fields = [
    "core_story",
    "target_renter_intent",
    "proof_points",
    "messaging_priorities",
    "messaging_guardrails",
    "cta_guidance",
  ];
  const completeness = fields.reduce(
    (acc, key) => {
      const value = payload?.[key];
      const filled =
        typeof value === "string"
          ? value.trim().length > 0
          : Array.isArray(value)
            ? value.length > 0
            : Boolean(value);
      if (filled) acc.complete += 1;
      return acc;
    },
    { complete: 0, total: fields.length }
  );

  const priorities = [
    ...normalizeList(payload?.messaging_priorities),
    ...normalizeList(intelligenceProperty?.editorial_focus),
  ].filter(Boolean);

  const propertyClaims = claims.filter(
    (claim) => claim.applicable_scope === "property" && claim.property_id === propertyId && claim.status === "active"
  );
  const evidenceById = new Map(evidenceItems.map((item) => [item.id, item]));
  const evidenceLinksByClaim = claimEvidenceLinks.reduce((acc, link) => {
    const list = acc.get(link.claim_id) ?? [];
    list.push(link.evidence_id);
    acc.set(link.claim_id, list);
    return acc;
  }, new Map<string, string[]>());
  const claimsWithEvidence = propertyClaims.map((claim) => ({
    claim,
    evidence: (evidenceLinksByClaim.get(claim.id) ?? [])
      .map((id) => evidenceById.get(id))
      .filter(Boolean) as IntelligenceEvidence[],
  }));

  const evidenceRefs = captainLog
    .flatMap((item) => item.evidence)
    .map((evidence) => `${evidence.evidence_type} · ${evidence.evidence_source} · ${evidence.evidence_ref}`)
    .filter(Boolean);
  const memoryEntryIds = captainLog.map((item) => item.entry.id);

  const confidenceLabel = entry ? entry.entry.confidence.toFixed(2) : "—";
  const updatedAtLabel = entry ? formatStamp(entry.entry.updated_at) : "—";
  const summary = entry?.entry.summary ?? "";
  const ctaGuidance = typeof payload?.cta_guidance === "string" ? payload.cta_guidance.trim() : "";

  const statusLabel =
    completeness.complete === 0
      ? "Draft (missing structured brief)"
      : completeness.complete === completeness.total
        ? "Complete"
        : "In progress";

  return {
    propertyId,
    captainDisplayName,
    summary,
    priorities,
    claimsWithEvidence,
    evidenceRefs,
    confidenceLabel,
    updatedAtLabel,
    memoryEntryIds,
    ctaGuidance,
    statusLabel,
    completeness,
  };
}

function BriefListCard({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">{emptyText}</p>
        ) : (
          items.map((item, index) => (
            <p key={index} className="text-sm text-slate-700">
              {item}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function dedupeEvidenceItems(items: IntelligenceEvidence[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function SectionCard({ section }: { section: SiteContentSection }) {
  const hasMedia = section.image_count > 0;
  const extractedMediaSide = hasMedia ? section.media_side ?? "right" : "none";
  const title = section.title || section.section_label || section.heading || `Section ${section.section_order + 1}`;
  const isHero = hasMedia && section.section_order === 0;
  const hasBullets = section.bullet_points.length > 0;
  const isSplitFeature = hasMedia && (hasBullets || section.section_type === "amenities" || section.section_type === "features");
  const isTextOnly = !hasMedia;
  const originalCopy = section.original_copy ?? "";
  const shouldAlternate =
    hasMedia &&
    !isHero &&
    extractedMediaSide !== "left" &&
    (section.section_type === "standard" ||
      section.section_type === "amenities" ||
      section.section_type === "features" ||
      section.section_type === "floor-plans");
  const mediaSide = shouldAlternate && section.section_order % 2 === 1 ? "left" : extractedMediaSide;
  const textColumnOrder = mediaSide === "left" ? "lg:order-2" : "lg:order-1";
  const mediaColumnOrder = mediaSide === "left" ? "lg:order-1" : "lg:order-2";
  const cardTone = isHero
    ? "border-[#15284B]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(13,94,109,0.04))] shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
    : isSplitFeature
      ? "border-[#15284B]/8 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
      : "border-slate-200 bg-slate-50";
  const titleClass = isHero ? "text-[2rem] leading-tight md:text-[2.4rem]" : "text-xl leading-tight";
  const textWrapClass = isHero ? "space-y-6 lg:pr-6" : "space-y-5";
  const bodyClass = isHero ? "text-[1.02rem] leading-8 text-slate-700" : "text-sm leading-7 text-slate-700";
  const bodyLines = originalCopy
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
  const topBody = bodyLines[0] ?? originalCopy;
  const remainingBody = bodyLines.slice(1);
  const mediaPlaceholderClass = isHero
    ? "min-h-[420px] rounded-[1.6rem]"
    : isSplitFeature
      ? "min-h-[320px] rounded-[1.35rem]"
      : "min-h-[240px] rounded-[1.15rem]";

  return (
    <div className={`rounded-[1.6rem] border p-6 shadow-[0_1px_0_rgba(15,23,42,0.03)] ${cardTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {section.eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0D5E6D]">{section.eyebrow}</p>
          )}
          <p className={`mt-1 font-semibold text-slate-900 ${titleClass}`}>{title}</p>
          {section.subtitle && (
            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">{section.subtitle}</p>
          )}
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{section.section_type || "standard"}</p>
        </div>
        <div className="flex gap-2">
          <Badge className="border-0 bg-white text-slate-700">{section.image_count} images</Badge>
          <Badge className="border-0 bg-white text-slate-700">{section.link_count} links</Badge>
        </div>
      </div>

      <div
        className={`mt-5 grid items-stretch gap-6 ${
          hasMedia
            ? isHero
              ? "lg:grid-cols-[minmax(340px,0.85fr)_minmax(440px,1.15fr)]"
              : "lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]"
            : ""
        }`}
      >
        <div className={`${textWrapClass} ${textColumnOrder}`}>
          <div className={`whitespace-pre-wrap ${bodyClass}`}>{topBody}</div>

          {hasBullets && (
            <div className="rounded-2xl border border-[#15284B]/10 bg-[#15284B]/[0.035] p-4">
              <ul
                className={`list-disc pl-5 text-slate-700 ${
                  isHero || isSplitFeature
                    ? "grid gap-x-8 gap-y-1 md:grid-cols-2 text-sm leading-7"
                    : "space-y-1 text-sm"
                }`}
              >
                {section.bullet_points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {remainingBody.length > 0 && (
            <div className="space-y-4">
              {remainingBody.map((block, index) => (
                <p key={index} className={bodyClass}>
                  {block}
                </p>
              ))}
            </div>
          )}
        </div>

        {hasMedia && (
          <div className={`flex h-full ${mediaColumnOrder}`}>
            <div
              className={`w-full self-stretch border border-slate-200/90 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_38%),linear-gradient(145deg,rgba(21,40,75,0.09),rgba(13,94,109,0.2))] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${mediaPlaceholderClass}`}
            />
          </div>
        )}
      </div>

      {!isTextOnly && (
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      )}

      {section.heading && section.heading !== title && section.heading !== section.subtitle && (
        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          Captured heading: {section.heading}
        </div>
      )}
    </div>
  );
}
