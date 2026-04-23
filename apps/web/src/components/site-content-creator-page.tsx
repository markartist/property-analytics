"use client";

import React from "react";
import {
  crawlSiteContentProperty,
  getGovernedMemoryPropertyLog,
  getIntelligencePropertyBriefInputs,
  getSiteContentInventory,
  getSiteContentProperty,
  saveSiteContentSectionRewrite,
  type GovernedMemoryEntryWithEvidence,
  type IntelligenceClaim,
  type IntelligenceClaimEvidence,
  type IntelligenceEvidence,
  type IntelligencePilotProperty,
  type SiteContentPage,
  type SiteContentSectionAssessment,
  type SiteContentSectionMapping,
  type SiteContentPropertySummary,
  type SiteContentSection,
  type SiteContentSectionRewrite,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction, getOfferingActionRole, getRoleTitle } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileSearch, Loader2, RefreshCw, Sparkles } from "lucide-react";

type Flash = { type: "success" | "error"; text: string } | null;

function formatStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function SiteContentCreatorPage() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [crawling, setCrawling] = React.useState(false);
  const [flash, setFlash] = React.useState<Flash>(null);
  const [properties, setProperties] = React.useState<SiteContentPropertySummary[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState("");
  const [selectedPages, setSelectedPages] = React.useState<SiteContentPage[]>([]);
  const [focusedPageId, setFocusedPageId] = React.useState<string>("all");
  const [selectedPageLimit, setSelectedPageLimit] = React.useState("8");
  const [intelligenceProperties, setIntelligenceProperties] = React.useState<IntelligencePilotProperty[]>([]);
  const [claims, setClaims] = React.useState<IntelligenceClaim[]>([]);
  const [evidenceItems, setEvidenceItems] = React.useState<IntelligenceEvidence[]>([]);
  const [claimEvidenceLinks, setClaimEvidenceLinks] = React.useState<IntelligenceClaimEvidence[]>([]);
  const [captainLog, setCaptainLog] = React.useState<GovernedMemoryEntryWithEvidence[]>([]);
  const [captainIdentity, setCaptainIdentity] = React.useState<string>("");
  const didInitialLoad = React.useRef(false);
  const canRunCrawl = canPerformOfferingAction(user?.role, "siteContent", "administer");
  const canDraftRewrite = canPerformOfferingAction(user?.role, "siteContent", "draft");
  const crawlRoleTitle = getRoleTitle(getOfferingActionRole("siteContent", "administer"));
  const draftRoleTitle = getRoleTitle(getOfferingActionRole("siteContent", "draft"));

  function resetPropertyDetailState() {
    setSelectedPages([]);
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
    setIntelligenceProperties(inventory.properties);

    const nextPropertyId = selectedPropertyId || inventory.properties[0]?.property_id || "";
    if (nextPropertyId) {
      await loadProperty(nextPropertyId, inventory.properties);
    }
  }, [selectedPropertyId]);

  React.useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadInventory()
      .catch((err: Error) => setFlash({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [loadInventory]);

  async function loadSupplementalPropertyData(propertyId: string) {
    const [logResult, briefInputsResult] = await Promise.allSettled([
      getGovernedMemoryPropertyLog(propertyId),
      getIntelligencePropertyBriefInputs(propertyId),
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
      setSelectedPages(detail.pages);
      setFocusedPageId(detail.pages[0]?.id ?? "all");
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
          setSelectedPages(detail.pages);
          setFocusedPageId(detail.pages[0]?.id ?? "all");
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
  const filteredPages = selectedPages;
  const selectedPage =
    (focusedPageId !== "all" ? filteredPages.find((page) => page.id === focusedPageId) : null) ??
    filteredPages[0] ??
    null;
  const visiblePages = selectedPage ? [selectedPage] : [];
  const hasCapturedInventory = (selectedSummary?.page_count ?? 0) > 0 || selectedPages.length > 0;
  const readiness = selectedSummary?.brief_readiness ?? null;
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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="px-1">
        <div className="flex items-center gap-3">
          <FileSearch className="h-5 w-5 text-[#0D5E6D]" />
          <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-900">Site Content</h1>
        </div>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Pick a property, pick a page, then click the section you want to rewrite.
        </p>
      </div>

      {flash && (
        <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
          flash.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {flash.text}
        </div>
      )}

      <Card className="overflow-hidden rounded-[24px] border-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_1fr_auto] lg:items-end lg:p-7">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property</label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
              value={selectedPropertyId}
              onChange={(e) => loadProperty(e.target.value)}
            >
              {properties.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.property_name} • {formatReadinessLabel(property.brief_readiness)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page</label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
              value={selectedPage?.id ?? ""}
              onChange={(e) => setFocusedPageId(e.target.value)}
              disabled={selectedPages.length === 0}
            >
              {selectedPages.length === 0 ? <option value="">Choose a property first</option> : null}
              {selectedPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.spec_page_name || page.page_title || page.page_path || page.page_type || "Page"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button className="rounded-xl px-4" onClick={runCrawl} disabled={!selectedPropertyId || crawling || !isBriefReady || !canRunCrawl}>
              {crawling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh site snapshot
            </Button>
            {!canRunCrawl ? (
              <p className="text-right text-xs font-semibold uppercase tracking-wide text-amber-700">
                {crawlRoleTitle} access required
              </p>
            ) : !isBriefReady && (
              <p className="text-right text-xs font-semibold uppercase tracking-wide text-amber-700">
                Brief incomplete
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {readiness && !isBriefReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
          The Captain&apos;s Brief still needs: {missingComponents.length ? missingComponents.map(formatMissingComponent).join(", ") : "governed inputs"}.
          You can still review the captured page and content, but refresh is locked until the brief is ready.
        </div>
      )}

      {selectedPages.length === 0 ? (
        <Card className="overflow-hidden rounded-[24px] border-slate-200 shadow-[0_10px_34px_rgba(15,23,42,0.05)]">
          <CardContent className="space-y-2 p-6">
            <p className="text-base font-semibold text-slate-900">
              {hasCapturedInventory ? "Captured inventory details unavailable" : "No page inventory yet"}
            </p>
            <p className="text-sm text-slate-600">
              {hasCapturedInventory
                ? "This property has recorded crawl inventory, but the detailed page records did not load for the current selection."
                : "Refresh the selected property to capture its pages, then choose a page and click the section you want to edit."}
            </p>
          </CardContent>
        </Card>
      ) : (
        visiblePages.map((page) => (
          <Card key={page.id} id={`page-${page.id}`} className="overflow-hidden rounded-[28px] border-slate-200 shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
            <CardContent className="space-y-4 p-6">
              <PageMappingWorkspace
                page={page}
                propertyId={selectedPropertyId}
                canDraftRewrite={canDraftRewrite}
                draftRoleTitle={draftRoleTitle}
                onRewriteSaved={async () => {
                  await loadProperty(selectedPropertyId);
                }}
              />
            </CardContent>
          </Card>
        ))
      )}

      <details className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Advanced controls</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refresh depth</label>
            <Input value={selectedPageLimit} onChange={(e) => setSelectedPageLimit(e.target.value)} />
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Governed inputs</p>
            <p className="text-sm font-semibold text-slate-900">{captainIdentity || "Captain&apos;s Brief required"}</p>
            <p className="text-sm leading-6 text-slate-700">{captainsBrief.summary || "No summary yet."}</p>
            {captainsBrief.priorities.length > 0 ? (
              <div className="space-y-2">
                {captainsBrief.priorities.slice(0, 4).map((item, index) => (
                  <p key={index} className="text-sm text-slate-700">{item}</p>
                ))}
              </div>
            ) : null}
            <p className="text-sm text-slate-700">
              {captainsBrief.claimsWithEvidence.length} approved claims · {propertyEvidenceItems.length} evidence refs
            </p>
            {captainsBrief.ctaGuidance ? (
              <p className="text-sm leading-6 text-slate-700">{captainsBrief.ctaGuidance}</p>
            ) : null}
          </div>
        </div>
      </details>
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

function dedupeEvidenceItems(items: IntelligenceEvidence[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getSectionDisplayTitle(section: SiteContentSection | null, mapping: SiteContentSectionMapping) {
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${mapping.expected_section_role ?? ""}`.toLowerCase();
  if (section?.heading?.trim() && (key.includes("intro") || key.includes("welcome") || section.heading.toLowerCase().includes("welcome to"))) {
    return section.heading.trim();
  }
  return (
    section?.title ||
    section?.section_label ||
    section?.heading ||
    mapping.expected_section_label ||
    (mapping.match_status === "missing-from-live" ? "Missing section from live page" : "Untitled section")
  );
}

function getSectionDisplaySubheading(section: SiteContentSection | null, mapping: SiteContentSectionMapping) {
  const heading = section?.heading?.trim();
  const title = section?.title?.trim();
  const subtitle = section?.subtitle?.trim();
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${mapping.expected_section_role ?? ""}`.toLowerCase();

  if (heading && title && heading !== title && (key.includes("intro") || key.includes("welcome") || heading.toLowerCase().includes("welcome to"))) {
    return title;
  }

  if (subtitle && subtitle !== heading && subtitle !== title) return subtitle;
  return null;
}

function getSectionMockLayout(section: SiteContentSection | null, mapping: SiteContentSectionMapping) {
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${section?.section_type ?? ""}`.toLowerCase();
  if (section?.section_order === 0 && section?.image_count) return "hero";
  if (isIntroCandidate(mapping, section, "homepage")) {
    return section?.media_side === "left" ? "split-image-left" : "split-image-right";
  }
  if ((section?.bullet_points?.length ?? 0) >= 8 || key.includes("included") || key.includes("feature list")) return "list-grid";
  if (key.includes("review") || key.includes("testimonial")) return "reviews";
  if (key.includes("gallery") || (section?.image_count ?? 0) >= 3) return "gallery";
  if (key.includes("cta") || section?.section_type === "cta") return "cta";
  if ((section?.image_count ?? 0) === 0) return "text";
  if ((section?.image_count ?? 0) > 0 && (section?.media_side === "left" || ((section?.section_order ?? 0) % 2 === 1))) {
    return "split-image-left";
  }
  return "split-image-right";
}

function extractCtaLabels(section: SiteContentSection | null, mapping: SiteContentSectionMapping) {
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${mapping.expected_section_role ?? ""}`.toLowerCase();
  const source = [section?.title, section?.subtitle, section?.original_copy, mapping.expected_section_label]
    .filter((item): item is string => Boolean(item))
    .join(" ");
  const normalizedSource = source.toLowerCase();
  if (key.includes("apartment-features")) return ["See Features"];
  if (key.includes("amenities-proof")) return ["See Amenities"];
  if (isIntroCandidate(mapping, section, "homepage")) return ["See Available Homes"];
  if (normalizedSource.includes("we don’t just allow pets") || normalizedSource.includes("we don't just allow pets")) {
    return ["See Our Pet-Friendly Details"];
  }
  if (normalizedSource.includes("tech-enabled communities") || normalizedSource.includes("smart communities. seamless living.")) {
    return ["See A Day of High-Tech Living"];
  }
  const found = Array.from(
    new Set(
      (source.match(
        /\b(schedule a tour|apply now|contact us|find your home|view floor plans|see amenities|read more reviews|see available homes|book a tour|check availability)\b/gi
      ) ?? []).map((item) => item.replace(/\s+/g, " ").trim())
    )
  );
  if (found.length > 0) return found.map((item) => item.replace(/\b\w/g, (char) => char.toUpperCase()));
  if (section?.link_count && section.link_count > 1) return ["Learn More", "Schedule a Tour"];
  if (section?.link_count || mapping.expected_section_key?.includes("cta") || section?.section_type === "cta") {
    return ["Schedule a Tour"];
  }
  return [];
}

function isHeroCandidate(
  mapping: SiteContentSectionMapping,
  section: SiteContentSection | null,
  pageType: string | null
) {
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${mapping.expected_section_role ?? ""} ${section?.section_key ?? ""} ${section?.section_type ?? ""}`.toLowerCase();
  if (key.includes("hero")) return true;
  if (pageType === "homepage" && (section?.section_order ?? Number.MAX_SAFE_INTEGER) === 0 && (section?.image_count ?? 0) > 0) {
    return true;
  }
  return false;
}

function isIntroCandidate(
  mapping: SiteContentSectionMapping,
  section: SiteContentSection | null,
  pageType: string | null
) {
  if (pageType !== "homepage") return false;
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${mapping.expected_section_role ?? ""} ${section?.section_key ?? ""} ${section?.section_type ?? ""}`.toLowerCase();
  const heading = `${section?.heading ?? ""} ${section?.title ?? ""}`.toLowerCase();
  return (
    key.includes("intro") ||
    key.includes("welcome") ||
    key.includes("lead") ||
    heading.includes("welcome to")
  );
}

function shouldRenderSyntheticHero(
  page: SiteContentPage,
  items: Array<{ mapping: SiteContentSectionMapping; section: SiteContentSection | null }>
) {
  if (page.page_type !== "homepage") return false;
  if (canRenderDirectImage(page.spec_screenshot)) return false;
  const first = items[0];
  if (!first) return false;
  return !isHeroCandidate(first.mapping, first.section, page.page_type);
}

function SyntheticPageHero({
  page,
  firstItem,
}: {
  page: SiteContentPage;
  firstItem: { mapping: SiteContentSectionMapping; section: SiteContentSection | null } | null;
}) {
  const title =
    page.page_title?.trim() ||
    page.spec_page_name?.trim() ||
    "Welcome home";
  const body =
    firstItem?.section?.subtitle?.trim() ||
    page.meta_description?.trim() ||
    "Explore the page and click the section you want to edit.";
  const ctas = firstItem ? extractCtaLabels(firstItem.section, firstItem.mapping) : [];

  return (
    <div className="overflow-hidden rounded-[28px] bg-[#15284B] text-white shadow-[0_18px_44px_rgba(21,40,75,0.25)]">
      <div className="min-h-[420px] bg-[linear-gradient(180deg,rgba(10,18,34,0.14),rgba(10,18,34,0.32)),radial-gradient(circle_at_top,rgba(122,193,229,0.24),transparent_40%),linear-gradient(135deg,#86c7e6_0%,#53a8d1_30%,#28527f_100%)] p-8 md:p-12">
        <div className="max-w-3xl space-y-5 pt-24">
          <p className="text-[2.8rem] font-semibold tracking-[-0.05em] leading-[0.95] md:text-[4rem]">{title}</p>
          <p className="max-w-2xl text-lg leading-8 text-white/90">{body}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            {(ctas.length > 0 ? ctas : ["Find Your Home"]).slice(0, 2).map((label) => (
              <span key={label} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#15284B]">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageMappingWorkspace({
  page,
  propertyId,
  canDraftRewrite,
  draftRoleTitle,
  onRewriteSaved,
}: {
  page: SiteContentPage;
  propertyId: string;
  canDraftRewrite: boolean;
  draftRoleTitle: string;
  onRewriteSaved: () => Promise<void>;
}) {
  const actualSectionById = new Map(page.sections.map((section) => [section.id ?? "", section]));
  const assessmentByMappingId = new Map(page.section_assessments.map((assessment) => [assessment.mapping_id, assessment]));
  const rewriteByMappingId = new Map(page.section_rewrites.map((rewrite) => [rewrite.mapping_id, rewrite]));
  type MappingItem = {
    mapping: SiteContentSectionMapping;
    section: SiteContentSection | null;
    assessment: SiteContentSectionAssessment | null;
    rewrite: SiteContentSectionRewrite | null;
  };
  type CanvasItem =
    | { kind: "single"; item: MappingItem }
    | {
        kind: "switcher";
        id: string;
        variants: Array<{ tabLabel: string; item: MappingItem }>;
      };
  const mappingItems = React.useMemo(
    () =>
      [...page.section_mappings]
        .map((mapping) => {
          const section = mapping.section_id ? actualSectionById.get(mapping.section_id) ?? null : null;
          const assessment = assessmentByMappingId.get(mapping.id) ?? null;
          const rewrite = rewriteByMappingId.get(mapping.id) ?? null;
          return { mapping, section, assessment, rewrite } satisfies MappingItem;
        })
        .sort((a, b) => {
          const aHero = isHeroCandidate(a.mapping, a.section, page.page_type);
          const bHero = isHeroCandidate(b.mapping, b.section, page.page_type);
          if (aHero !== bHero) return aHero ? -1 : 1;
          const aIntro = isIntroCandidate(a.mapping, a.section, page.page_type);
          const bIntro = isIntroCandidate(b.mapping, b.section, page.page_type);
          if (aIntro !== bIntro) return aIntro ? -1 : 1;
          const aOrder = a.section?.section_order ?? a.mapping.expected_order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.section?.section_order ?? b.mapping.expected_order ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.mapping.updated_at.localeCompare(b.mapping.updated_at);
        }),
    [page.section_mappings, page.page_type, actualSectionById, assessmentByMappingId, rewriteByMappingId]
  );
  const visibleMappingItems = React.useMemo(
    () => mappingItems.filter((item) => item.mapping.match_status !== "missing-from-live"),
    [mappingItems]
  );
  const hiddenSpecsSlots = React.useMemo(
    () => mappingItems.filter((item) => item.mapping.match_status === "missing-from-live"),
    [mappingItems]
  );
  const [selectedMappingId, setSelectedMappingId] = React.useState(visibleMappingItems[0]?.mapping.id ?? "");

  React.useEffect(() => {
    setSelectedMappingId(visibleMappingItems[0]?.mapping.id ?? "");
  }, [page.id, visibleMappingItems]);

  const selectedItem =
    mappingItems.find((item) => item.mapping.id === selectedMappingId) ??
    visibleMappingItems[0] ??
    null;
  const canvasItems = React.useMemo<CanvasItem[]>(() => {
    const entries: CanvasItem[] = [];
    const used = new Set<string>();
    const switcherCandidates = mappingItems
      .map((item) => {
        if (!item.section) return null;
        const tabLabel = getHomepageSwitcherTabLabel(item, page.page_type);
        return tabLabel ? { tabLabel, item } : null;
      })
      .filter(Boolean) as Array<{ tabLabel: string; item: MappingItem }>;
    const switcherIds = new Set(switcherCandidates.map((variant) => variant.item.mapping.id));
    const switcherVariantByLabel = new Map<string, { tabLabel: string; item: MappingItem }>();
    switcherCandidates
      .slice()
      .sort((a, b) => {
        const aOrder = a.item.section?.section_order ?? a.item.mapping.expected_order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.item.section?.section_order ?? b.item.mapping.expected_order ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      })
      .forEach((variant) => {
        if (!switcherVariantByLabel.has(variant.tabLabel)) {
          switcherVariantByLabel.set(variant.tabLabel, variant);
        }
      });
    const switcherVariants = Array.from(switcherVariantByLabel.values());

    visibleMappingItems.forEach((item) => {
      if (used.has(item.mapping.id)) return;
      if (switcherIds.has(item.mapping.id)) {
        const variants = switcherVariants
          .slice()
          .sort((a, b) => getHomepageSwitcherTabOrder(a.tabLabel) - getHomepageSwitcherTabOrder(b.tabLabel));
        switcherCandidates.forEach((variant) => used.add(variant.item.mapping.id));
        entries.push({
          kind: "switcher",
          id: "homepage-benefits-switcher",
          variants,
        });
        return;
      }
      used.add(item.mapping.id);
      entries.push({ kind: "single", item });
    });

    return entries;
  }, [visibleMappingItems, page.page_type]);

  if (visibleMappingItems.length === 0) {
    return (
      <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
        This page was captured, but no editable section blocks were extracted yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[32px] border border-slate-300 bg-[#eef2f6] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mx-auto max-w-[980px] space-y-10 bg-white p-4 md:p-6">
            {shouldRenderSyntheticHero(page, visibleMappingItems) ? (
              <SyntheticPageHero page={page} firstItem={visibleMappingItems[0] ?? null} />
            ) : null}
            {canRenderDirectImage(page.spec_screenshot) ? (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
                <img
                  src={page.spec_screenshot ?? ""}
                  alt={`${page.spec_page_name || page.page_title || "Page"} reference`}
                  className="h-auto w-full object-cover"
                />
              </div>
            ) : null}

            {canvasItems.map((entry, index) =>
              entry.kind === "single" ? (
                <button
                  key={entry.item.mapping.id}
                  type="button"
                  onClick={() => setSelectedMappingId(entry.item.mapping.id)}
                  className={`block w-full rounded-[30px] text-left transition ${
                    selectedItem?.mapping.id === entry.item.mapping.id
                      ? "bg-white ring-4 ring-[#15284B]/10"
                      : "bg-white hover:ring-2 hover:ring-slate-200"
                  }`}
                >
                  <PageCanvasBlock
                    index={index}
                    total={canvasItems.length}
                    mapping={entry.item.mapping}
                    section={entry.item.section}
                    selected={selectedItem?.mapping.id === entry.item.mapping.id}
                  />
                </button>
              ) : (
                <HomepageSwitcherGroup
                  key={entry.id}
                  variants={entry.variants}
                  selectedMappingId={selectedMappingId}
                  onSelect={setSelectedMappingId}
                />
              )
            )}
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="rounded-[30px] border border-slate-300 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {getSectionDisplayTitle(selectedItem.section, selectedItem.mapping)}
          </p>

          <SectionRewritePanel
            propertyId={propertyId}
            page={page}
            mapping={selectedItem.mapping}
            section={selectedItem.section}
            assessment={selectedItem.assessment}
            rewrite={selectedItem.rewrite}
            canDraftRewrite={canDraftRewrite}
            draftRoleTitle={draftRoleTitle}
            onSaved={onRewriteSaved}
          />
        </div>
      )}

      {hiddenSpecsSlots.length > 0 ? (
        <details className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
            Show unmatched Specs sections ({hiddenSpecsSlots.length})
          </summary>
          <div className="mt-4 space-y-3">
            {hiddenSpecsSlots.map((item) => (
              <div key={item.mapping.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.mapping.expected_section_label || item.mapping.expected_section_key || "Specs section"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  This Specs section does not currently map to an extracted live section.
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function getHomepageSwitcherTabLabel(
  item: {
    mapping: SiteContentSectionMapping;
    section: SiteContentSection | null;
  },
  pageType: string | null
) {
  if (pageType !== "homepage") return null;
  const explicitLabel = item.section?.eyebrow?.trim();
  if (
    explicitLabel === "Pet-Friendly Fun" ||
    explicitLabel === "High-Tech Living" ||
    explicitLabel === "Live Easy Perks"
  ) {
    return explicitLabel;
  }
  const source = `${item.section?.section_label ?? ""} ${item.section?.heading ?? ""} ${item.section?.title ?? ""} ${item.section?.original_copy ?? ""}`.toLowerCase();
  if (source.includes("pet-friendly") || source.includes("we don’t just allow pets") || source.includes("we don't just allow pets") || source.includes("we love pets")) {
    return "Pet-Friendly Fun";
  }
  if (source.includes("tech-enabled") || source.includes("smart hub") || source.includes("wi-fi") || source.includes("wifi")) {
    return "High-Tech Living";
  }
  if (
    source.includes("included in your lease") ||
    source.includes("48 hour service guarantee") ||
    source.includes("24/7 maintenance support") ||
    source.includes("resident referral bonus") ||
    source.includes("real value") ||
    source.includes("live easy")
  ) {
    return "Live Easy Perks";
  }
  return null;
}

function getHomepageSwitcherTabOrder(label: string) {
  if (label === "Pet-Friendly Fun") return 0;
  if (label === "High-Tech Living") return 1;
  if (label === "Live Easy Perks") return 2;
  return 9;
}

function HomepageSwitcherGroup({
  variants,
  selectedMappingId,
  onSelect,
}: {
  variants: Array<{
    tabLabel: string;
    item: {
      mapping: SiteContentSectionMapping;
      section: SiteContentSection | null;
    };
  }>;
  selectedMappingId: string;
  onSelect: (mappingId: string) => void;
}) {
  return (
    <div className="rounded-[28px] bg-white px-4 py-8 md:px-7">
      <div className="border-b border-slate-300 pb-4 text-center">
        <p className="text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em] text-[#15284B] md:text-[3rem]">
          Get the Most
          <br />
          From Where You Live
        </p>
      </div>

      <div className="mt-10 space-y-12">
        {variants.map((variant) => {
          const { mapping, section } = variant.item;
          const variantTitle = getSectionDisplayTitle(section, mapping);
          const body = buildSectionBaselinePreview(section);
          const ctaLabels = extractCtaLabels(section, mapping);
          const selected = selectedMappingId === mapping.id;
          return (
            <button
              key={mapping.id}
              type="button"
              onClick={() => onSelect(mapping.id)}
              className={`block w-full rounded-[28px] border text-left transition ${
                selected ? "border-[#15284B] bg-[#f8fbff] ring-4 ring-[#15284B]/10" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="px-5 py-8 md:px-7">
                <div className="mb-6">
                  <span className="inline-flex rounded-full bg-[#eef3f8] px-4 py-2 text-sm font-semibold text-[#15284B]">
                    {variant.tabLabel}
                  </span>
                </div>

                <div className="grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-start">
                  <div className="min-h-[280px] rounded-[6px] bg-[linear-gradient(145deg,#d7ecf8,#8bbfdc_48%,#5d91b9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />
                  <div className="flex flex-col justify-start space-y-4">
                    <p className="text-[2.1rem] font-semibold leading-tight tracking-[-0.035em] text-[#15284B]">
                      {variantTitle}
                    </p>
                    <p className="text-base leading-8 text-slate-700">{body}</p>
                    {section?.bullet_points?.length ? (
                      <ul className="grid gap-2 pl-5 text-sm leading-7 text-slate-700">
                        {section.bullet_points.map((point, pointIndex) => (
                          <li key={pointIndex} className="list-disc marker:text-[#80d4cf]">
                            {point}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {ctaLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-3 pt-1">
                        <span className="rounded-full bg-[#15284B] px-5 py-3 text-sm font-semibold text-white">
                          {ctaLabels[0]}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {section?.switcher_details?.length ? (
                  <div className="mt-8 space-y-4 border-t border-slate-200 pt-6">
                    {section.switcher_details.map((detail, detailIndex) => (
                      <div key={`${mapping.id}-detail-${detailIndex}`} className="rounded-[22px] border border-slate-200 bg-[#fbfcfe] px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[#15284B]">
                            {detail.title}
                          </p>
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl leading-none text-slate-400">
                            {variant.tabLabel === "Live Easy Perks" ? "+" : "•"}
                          </span>
                        </div>
                        {detail.body ? (
                          <p className="mt-4 text-base leading-8 text-slate-700">{detail.body}</p>
                        ) : null}
                        {detail.bullets.length ? (
                          <ul className="mt-4 grid gap-2 pl-5 text-sm leading-7 text-slate-700">
                            {detail.bullets.map((point, pointIndex) => (
                              <li key={pointIndex} className="list-disc marker:text-[#80d4cf]">
                                {point}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {detail.cta_label ? (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <span className="rounded-full border border-[#15284B] px-4 py-2 text-sm font-semibold text-[#15284B]">
                              {detail.cta_label}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PageCanvasBlock({
  index,
  total,
  mapping,
  section,
  selected,
}: {
  index: number;
  total: number;
  mapping: SiteContentSectionMapping;
  section: SiteContentSection | null;
  selected: boolean;
}) {
  const title = getSectionDisplayTitle(section, mapping);
  const subheading = getSectionDisplaySubheading(section, mapping);
  const eyebrow = section?.eyebrow?.trim() || null;
  const layout = getSectionMockLayout(section, mapping);
  const ctaLabels = extractCtaLabels(section, mapping);
  const body = buildSectionBaselinePreview(section);
  const bodyLines = getSectionBodyLines(section);
  const excerpt = bodyLines.length > 0 ? bodyLines.slice(0, 2) : [body];

  return (
    <div>
      {layout === "hero" ? (
        <div className="overflow-hidden rounded-[28px] bg-[#15284B] text-white shadow-[0_18px_44px_rgba(21,40,75,0.25)]">
          <div className="min-h-[420px] bg-[linear-gradient(180deg,rgba(10,18,34,0.12),rgba(10,18,34,0.26)),radial-gradient(circle_at_top,rgba(122,193,229,0.24),transparent_40%),linear-gradient(135deg,#89d0ee_0%,#53a8d1_30%,#28527f_100%)] p-8 md:p-12">
            <div className="max-w-3xl space-y-5 pt-20">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/75">Section {index + 1}</p>
              <p className="text-[2.6rem] font-semibold tracking-[-0.05em] leading-[0.95] md:text-[4rem]">{title}</p>
              <p className="max-w-2xl text-lg leading-8 text-white/88">{body}</p>
              {ctaLabels.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {ctaLabels.map((label) => (
                    <span key={label} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#15284B]">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : layout === "list-grid" ? (
        <div className="rounded-[28px] bg-[#fbfbf8] px-8 py-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="max-w-3xl space-y-4">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p> : null}
            <p className="text-[2.2rem] font-semibold tracking-[-0.04em] text-slate-950">{title}</p>
            {subheading ? <p className="text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">{subheading}</p> : null}
            <p className="text-base leading-7 text-slate-700">{body}</p>
          </div>
          {section?.bullet_points?.length ? (
            <div className="mt-8 grid gap-3 rounded-[24px] border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-3">
              {section.bullet_points.map((point, pointIndex) => (
                <div key={pointIndex} className="rounded-xl border border-slate-100 bg-[#fcfcfd] px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                  {point}
                </div>
              ))}
            </div>
          ) : null}
          {ctaLabels.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {ctaLabels.map((label) => (
                <span key={label} className="rounded-full bg-[#15284B] px-5 py-3 text-sm font-semibold text-white">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : layout === "text" ? (
        <div className="rounded-[28px] bg-white px-8 py-12">
          <div className="mx-auto max-w-3xl space-y-4">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p> : null}
            <p className="text-[2.15rem] font-semibold tracking-[-0.04em] text-slate-950">{title}</p>
            {subheading ? <p className="text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">{subheading}</p> : null}
            <div className="space-y-3 text-base leading-8 text-slate-700">
              {excerpt.map((line, lineIndex) => (
                <p key={lineIndex}>{line}</p>
              ))}
            </div>
            {section?.bullet_points?.length ? (
              <ul className="grid gap-2 pl-5 text-sm leading-7 text-slate-700">
                {section.bullet_points.slice(0, 6).map((point, pointIndex) => (
                  <li key={pointIndex} className="list-disc">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            {ctaLabels.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {ctaLabels.map((label) => (
                  <span key={label} className="rounded-full bg-[#15284B] px-5 py-3 text-sm font-semibold text-white">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : layout === "reviews" ? (
        <div className="rounded-[28px] bg-[#f7f6f2] px-8 py-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <div className="mx-auto max-w-4xl rounded-[22px] border border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="mt-4 text-2xl font-medium leading-[1.45] text-slate-900">
              “{body}”
            </p>
            {ctaLabels.length > 0 && (
              <div className="mt-6 flex justify-center gap-3">
                {ctaLabels.map((label) => (
                  <span key={label} className="rounded-full bg-[#15284B] px-5 py-3 text-sm font-semibold text-white">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : layout === "gallery" ? (
        <div className="grid gap-8 rounded-[28px] bg-white px-8 py-12 md:grid-cols-[1.05fr_0.95fr]">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: Math.max(3, section?.image_count || 3) }).slice(0, 6).map((_, tileIndex) => (
              <div key={tileIndex} className="aspect-[1.05/1] rounded-[18px] bg-[linear-gradient(145deg,#c8e7f6,#79badc_55%,#5d91b9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]" />
            ))}
          </div>
          <div className="flex flex-col justify-center space-y-4">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p> : null}
            <p className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">{title}</p>
            {subheading ? <p className="text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">{subheading}</p> : null}
            <p className="text-base leading-7 text-slate-700">{body}</p>
            {ctaLabels.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {ctaLabels.map((label) => (
                  <span key={label} className="rounded-full border border-[#15284B] px-5 py-3 text-sm font-semibold text-[#15284B]">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : layout === "cta" ? (
        <div className="rounded-[28px] bg-[#15284B] px-8 py-12 text-white shadow-[0_18px_44px_rgba(21,40,75,0.2)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mt-3 text-[2rem] font-semibold tracking-[-0.04em]">{title}</p>
              <p className="mt-3 text-base leading-7 text-white/82">{body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {(ctaLabels.length > 0 ? ctaLabels : ["Schedule a Tour"]).map((label) => (
                <span key={label} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#15284B]">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`grid gap-8 rounded-[28px] bg-white px-8 py-12 ${layout === "split-image-left" ? "md:grid-cols-[0.95fr_1.05fr]" : "md:grid-cols-[1.05fr_0.95fr]"}`}>
          <div className={`${layout === "split-image-left" ? "md:order-2" : ""} flex flex-col justify-center space-y-4`}>
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p> : null}
            <p className="text-[2.15rem] font-semibold tracking-[-0.04em] text-slate-950">{title}</p>
            {subheading ? <p className="text-[1.2rem] font-semibold tracking-[-0.02em] text-slate-900">{subheading}</p> : null}
            <div className="space-y-3 text-base leading-8 text-slate-700">
              {excerpt.map((line, lineIndex) => (
                <p key={lineIndex}>{line}</p>
              ))}
            </div>
            {section?.bullet_points?.length ? (
              <ul className="grid gap-2 pl-5 text-sm leading-7 text-slate-700">
                {section.bullet_points.slice(0, 4).map((point, pointIndex) => (
                  <li key={pointIndex} className="list-disc">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            {ctaLabels.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {ctaLabels.map((label) => (
                  <span key={label} className="rounded-full bg-[#15284B] px-5 py-3 text-sm font-semibold text-white">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={`${layout === "split-image-left" ? "md:order-1" : ""} min-h-[320px] overflow-hidden rounded-[22px] bg-[linear-gradient(145deg,#d7ecf8,#8bbfdc_45%,#5d91b9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]`} />
        </div>
      )}
    </div>
  );
}

function AssessmentStatusBadge({
  label,
  status,
}: {
  label: string;
  status: "healthy" | "watch" | "needs-attention";
}) {
  const toneClass =
    status === "healthy"
      ? "bg-emerald-50 text-emerald-700"
      : status === "watch"
        ? "bg-amber-50 text-amber-800"
        : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2.5 py-1 font-medium ${toneClass}`}>{label}</span>;
}

function parseAssessmentFlags(assessment: SiteContentSectionAssessment): string[] {
  try {
    const parsed = JSON.parse(assessment.flags_json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function humanizeFlag(flag: string): string {
  return flag.replace(/_/g, " ");
}

function buildSectionBaselinePreview(section: SiteContentSection | null): string {
  if (!section) {
    return "This Specs slot does not currently map to an extracted live section.";
  }

  const source = section.original_copy || section.subtitle || section.heading || section.section_label || section.title;
  if (!source) {
    return "The live page section was found, but no readable baseline copy was extracted yet.";
  }

  const normalized = source.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

function canRenderDirectImage(source: string | null | undefined) {
  return typeof source === "string" && /^https?:\/\//i.test(source);
}

function getSectionEyebrow(section: SiteContentSection | null, mapping: SiteContentSectionMapping) {
  return section?.eyebrow || mapping.expected_section_label || section?.section_label || section?.section_type || "Section";
}

function getSectionBodyLines(section: SiteContentSection | null) {
  const source = section?.original_copy || section?.subtitle || section?.heading || "";
  if (!source) return [];
  return source
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3);
}

function getSectionLocationLabel(index: number, total: number) {
  if (index <= 0) return "Top of page";
  if (index >= total - 1) return "Bottom of page";
  const ratio = index / Math.max(total - 1, 1);
  if (ratio < 0.34) return "Upper page";
  if (ratio < 0.67) return "Middle page";
  return "Lower page";
}

function SectionAssessmentPanel({ assessment }: { assessment: SiteContentSectionAssessment }) {
  const flags = parseAssessmentFlags(assessment);
  const scoreItems = [
    { label: "Structure", value: assessment.structural_score },
    { label: "Messaging", value: assessment.messaging_score },
    { label: "Specificity", value: assessment.specificity_score },
    { label: "Search", value: assessment.search_value_score },
    { label: "CTA", value: assessment.cta_score },
    { label: "Harmony", value: assessment.harmonization_score },
  ];

  return (
    <div className="mt-4 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Editorial Assessment</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {assessment.overall_status === "healthy"
              ? "This section is structurally healthy."
              : assessment.overall_status === "watch"
                ? "This section is usable but needs refinement."
                : "This section needs a stronger rewrite."}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{assessment.summary}</p>
        </div>
        <AssessmentStatusBadge
          label={assessment.overall_status.replace(/-/g, " ")}
          status={assessment.overall_status}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {scoreItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-lg font-semibold text-slate-900">{item.value}</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">/ 5</p>
            </div>
          </div>
        ))}
      </div>

      {flags.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Flags</p>
          <div className="mt-2 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <span key={flag} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
              {humanizeFlag(flag)}
            </span>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseGovernedInputs(rewrite: SiteContentSectionRewrite | null): Record<string, unknown> {
  if (!rewrite) return {};
  try {
    const parsed = JSON.parse(rewrite.governed_inputs_json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function SectionRewritePanel({
  propertyId,
  page,
  mapping,
  section,
  assessment,
  rewrite,
  canDraftRewrite,
  draftRoleTitle,
  onSaved,
}: {
  propertyId: string;
  page: SiteContentPage;
  mapping: SiteContentSectionMapping;
  section: SiteContentSection | null;
  assessment: SiteContentSectionAssessment | null;
  rewrite: SiteContentSectionRewrite | null;
  canDraftRewrite: boolean;
  draftRoleTitle: string;
  onSaved: () => Promise<void>;
}) {
  const [draftStatus, setDraftStatus] = React.useState<"not_started" | "drafted" | "in_review" | "approved">(
    rewrite?.draft_status ?? "not_started"
  );
  const [rewriteBrief, setRewriteBrief] = React.useState(rewrite?.rewrite_brief ?? "");
  const [proposedCopy, setProposedCopy] = React.useState(rewrite?.proposed_copy ?? "");
  const [refinementNotes, setRefinementNotes] = React.useState(rewrite?.refinement_notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraftStatus(rewrite?.draft_status ?? "not_started");
    setRewriteBrief(rewrite?.rewrite_brief ?? "");
    setProposedCopy(rewrite?.proposed_copy ?? "");
    setRefinementNotes(rewrite?.refinement_notes ?? "");
    setSaveError(null);
  }, [rewrite]);

  const governedInputs = parseGovernedInputs(rewrite);
  const inputHighlights = [
    governedInputs.expected_section_label,
    governedInputs.expected_section_role,
    governedInputs.assessment_summary,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const assessmentFlags = Array.isArray(governedInputs.assessment_flags)
    ? governedInputs.assessment_flags.filter((item): item is string => typeof item === "string")
    : [];

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveSiteContentSectionRewrite(propertyId, {
        page_id: page.id,
        mapping_id: mapping.id,
        section_id: section?.id ?? mapping.section_id ?? null,
        draft_status: draftStatus,
        rewrite_brief: rewriteBrief,
        proposed_copy: proposedCopy,
        refinement_notes: refinementNotes,
      });
      await onSaved();
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save rewrite");
    } finally {
      setSaving(false);
    }
  }

  const sectionTitle = getSectionDisplayTitle(section, mapping);
  const liveCopy = section?.original_copy?.trim() || buildSectionBaselinePreview(section);
  const ctaLabels = extractCtaLabels(section, mapping);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-slate-300 bg-[#fbfcfe] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current copy</p>
          <div className="mt-4 space-y-4">
            <p className="whitespace-pre-wrap text-base leading-8 text-slate-800">{liveCopy}</p>
            {section?.bullet_points?.length ? (
              <ul className="grid gap-2 pl-5 text-sm leading-7 text-slate-700">
                {section.bullet_points.map((point, index) => (
                  <li key={index} className="list-disc">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            {ctaLabels.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {ctaLabels.map((label) => (
                  <span key={label} className="rounded-full bg-[#15284B] px-5 py-3 text-sm font-semibold text-white">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#15284B]/18 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#15284B]">New copy</p>

          <div className="mt-4 space-y-3">
            <Textarea
              className="rounded-2xl"
              rows={17}
              value={proposedCopy}
              disabled={!canDraftRewrite}
              onChange={(e) => setProposedCopy(e.target.value)}
              placeholder={
                mapping.match_status === "missing-from-live"
                  ? "Write the new copy for this missing section here."
                  : "Write the revised content for this block here."
              }
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {rewrite?.updated_at ? `Last saved ${formatStamp(rewrite.updated_at)}` : "Draft not saved yet"}
            </div>
            <div className="flex items-center gap-3">
              {saveError && <p className="text-sm text-rose-700">{saveError}</p>}
              {!canDraftRewrite ? <p className="text-sm text-amber-700">{draftRoleTitle} access is required to save rewrite work.</p> : null}
              <Button className="rounded-xl bg-[#15284B] hover:bg-[#10203d]" type="button" onClick={handleSave} disabled={saving || !canDraftRewrite}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save rewrite
              </Button>
            </div>
          </div>
        </div>
      </div>

      <details className="rounded-[22px] border border-slate-300 bg-[#fbfcfe] p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
          Show content details
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rewrite status</p>
                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                  value={draftStatus}
                  disabled={!canDraftRewrite}
                  onChange={(e) =>
                    setDraftStatus(e.target.value as "not_started" | "drafted" | "in_review" | "approved")
                  }
                >
                  <option value="not_started">Not started</option>
                  <option value="drafted">Drafted</option>
                  <option value="in_review">In review</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rewrite brief</label>
                <Textarea className="rounded-2xl" rows={5} value={rewriteBrief} disabled={!canDraftRewrite} onChange={(e) => setRewriteBrief(e.target.value)} />
              </div>

              <div className="mt-4 space-y-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Editor notes</label>
                <Textarea
                  className="rounded-2xl"
                  rows={4}
                  value={refinementNotes}
                  disabled={!canDraftRewrite}
                  onChange={(e) => setRefinementNotes(e.target.value)}
                  placeholder="Optional notes for reviewers or future passes."
                />
              </div>
            </div>

            {inputHighlights.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Guidance</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{inputHighlights[0]}</p>
                {assessmentFlags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assessmentFlags.map((flag) => (
                      <span key={`${mapping.id}-${flag}`} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {humanizeFlag(flag)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Expected Specs slot</p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {mapping.expected_order ? `#${mapping.expected_order}` : "—"} {mapping.expected_section_key ? `· ${mapping.expected_section_key}` : ""}
              </p>
              {mapping.expected_section_role && (
                <p className="mt-2 text-sm leading-6 text-slate-600">{mapping.expected_section_role}</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Live baseline</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{buildSectionBaselinePreview(section)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Mapping rationale</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{mapping.rationale}</p>
            </div>
          </div>

          {assessment && <SectionAssessmentPanel assessment={assessment} />}

          {section?.original_copy && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Captured reference copy</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{section.original_copy}</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
