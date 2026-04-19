"use client";

import React from "react";
import {
  crawlSiteContentProperty,
  getGovernedMemoryPropertyLog,
  getIntelligenceOffice,
  getIntelligencePropertyBriefInputs,
  getSiteContentInventory,
  getSiteContentProperty,
  saveSiteContentSectionRewrite,
  type BriefReadiness,
  type GovernedMemoryEntryWithEvidence,
  type IntelligenceClaim,
  type IntelligenceDirective,
  type IntelligenceEvidence,
  type IntelligencePropertyBriefInputsResponse,
  type IntelligenceSource,
  type SiteContentPage,
  type SiteContentPropertySummary,
  type SiteContentSection,
  type SiteContentSectionAssessment,
  type SiteContentSectionMapping,
  type SiteContentSectionRewrite,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  BookText,
  Brain,
  Compass,
  FileSearch,
  Layers3,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";

type Flash = { type: "success" | "error"; text: string } | null;

type SiteSummary = {
  pagesCaptured: number;
  sectionsCaptured: number;
  matchedSections: number;
  partialSections: number;
  missingSections: number;
  extraSections: number;
  healthySections: number;
  watchSections: number;
  needsAttentionSections: number;
  approvedRewrites: number;
  inReviewRewrites: number;
  draftedRewrites: number;
  storyScore: number;
  harmonizationScore: number;
  nextMove: string;
};

type PagePosture = {
  storyScore: number;
  harmonizationScore: number;
  posture: "healthy" | "watch" | "needs-attention";
  nextMove: string;
};

type PropertySignals = {
  brief: IntelligencePropertyBriefInputsResponse | null;
  captainLog: GovernedMemoryEntryWithEvidence[];
};

type NarrativeCoverage = {
  claim: IntelligenceClaim;
  pagesCovered: string[];
  coverageRatio: number;
  posture: "aligned" | "partial" | "missing";
};

function formatStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeSite(pages: SiteContentPage[]): SiteSummary {
  const mappings = pages.flatMap((page) => page.section_mappings);
  const assessments = pages.flatMap((page) => page.section_assessments);
  const rewrites = pages.flatMap((page) => page.section_rewrites);

  const harmonizationScore = clampScore(average(assessments.map((assessment) => assessment.harmonization_score)));
  const storyScore = clampScore(
    average(
      assessments.map((assessment) =>
        average([assessment.messaging_score, assessment.specificity_score, assessment.harmonization_score])
      )
    )
  );

  let nextMove = "Run the first crawl and establish a real site snapshot.";
  if (pages.length > 0) {
    if (mappings.some((mapping) => mapping.match_status === "missing-from-live")) {
      nextMove = "Resolve the missing expected sections first so page contracts and live structure stop drifting.";
    } else if (assessments.some((assessment) => assessment.overall_status === "needs-attention")) {
      nextMove = "Work the sections marked needs attention before broad rewrite expansion.";
    } else if (rewrites.some((rewrite) => rewrite.draft_status === "in_review")) {
      nextMove = "Close in-review rewrites and promote approved copy into the harmonized story.";
    } else if (rewrites.some((rewrite) => rewrite.draft_status === "drafted")) {
      nextMove = "Advance drafted sections into review so the page-level story can stabilize.";
    } else {
      nextMove = "Use this site snapshot to evaluate page composition and cross-page storytelling coherence.";
    }
  }

  return {
    pagesCaptured: pages.length,
    sectionsCaptured: pages.reduce((sum, page) => sum + page.sections.length, 0),
    matchedSections: mappings.filter((mapping) => mapping.match_status === "matched").length,
    partialSections: mappings.filter((mapping) => mapping.match_status === "partial").length,
    missingSections: mappings.filter((mapping) => mapping.match_status === "missing-from-live").length,
    extraSections: mappings.filter((mapping) => mapping.match_status === "extra-on-live").length,
    healthySections: assessments.filter((assessment) => assessment.overall_status === "healthy").length,
    watchSections: assessments.filter((assessment) => assessment.overall_status === "watch").length,
    needsAttentionSections: assessments.filter((assessment) => assessment.overall_status === "needs-attention").length,
    approvedRewrites: rewrites.filter((rewrite) => rewrite.draft_status === "approved").length,
    inReviewRewrites: rewrites.filter((rewrite) => rewrite.draft_status === "in_review").length,
    draftedRewrites: rewrites.filter((rewrite) => rewrite.draft_status === "drafted").length,
    storyScore,
    harmonizationScore,
    nextMove,
  };
}

function summarizePage(
  page: SiteContentPage,
  propertyClaims: IntelligenceClaim[] = [],
  briefReadiness: BriefReadiness | null = null
): PagePosture {
  const assessments = page.section_assessments;
  const harmonizationScore = clampScore(average(assessments.map((assessment) => assessment.harmonization_score)));
  const baseStoryScore = clampScore(
    average(
      assessments.map((assessment) =>
        average([assessment.messaging_score, assessment.specificity_score, assessment.harmonization_score])
      )
    )
  );
  const claimSignal = propertyClaims.length > 0 ? Math.min(100, 58 + propertyClaims.length * 6) : 0;
  const readinessSignal = briefReadiness ? briefReadiness.completeness_score : 0;
  const storyScore = clampScore(
    average([baseStoryScore, claimSignal || baseStoryScore, readinessSignal || baseStoryScore])
  );

  if (page.section_mapping_summary.missing_from_live > 0) {
    return {
      storyScore,
      harmonizationScore,
      posture: "needs-attention",
      nextMove: "Expected structure is missing on the live page. Resolve the composition gap before polishing copy.",
    };
  }

  if (page.section_assessment_summary.needs_attention > 0) {
    return {
      storyScore,
      harmonizationScore,
      posture: "needs-attention",
      nextMove: "At least one live block is materially off. Rewrite the weak sections before broader harmonization.",
    };
  }

  if (
    (briefReadiness && briefReadiness.completeness_status !== "ready") ||
    page.section_mapping_summary.partial > 0 ||
    page.section_assessment_summary.watch > 0 ||
    page.section_rewrite_summary.in_review > 0 ||
    page.section_rewrite_summary.drafted > 0
  ) {
    return {
      storyScore,
      harmonizationScore,
      posture: "watch",
      nextMove: "The page is structurally present but still needs alignment or rewrite closure.",
    };
  }

  return {
    storyScore,
    harmonizationScore,
    posture: "healthy",
    nextMove: "This page reads structurally healthy. Use it as a benchmark for adjacent pages in the same story.",
  };
}

function toneForPosture(posture: "healthy" | "watch" | "needs-attention") {
  switch (posture) {
    case "healthy":
      return {
        badge: "bg-emerald-100 text-emerald-800",
        border: "border-emerald-200",
        bg: "bg-emerald-50/70",
      };
    case "watch":
      return {
        badge: "bg-amber-100 text-amber-800",
        border: "border-amber-200",
        bg: "bg-amber-50/70",
      };
    default:
      return {
        badge: "bg-rose-100 text-rose-800",
        border: "border-rose-200",
        bg: "bg-rose-50/70",
      };
  }
}

function pageSearchText(page: SiteContentPage): string {
  return [
    page.page_title,
    page.page_path,
    page.page_type,
    ...page.sections.flatMap((section) => [
      section.section_label,
      section.heading,
      section.title,
      section.subtitle,
      section.original_copy,
      ...section.bullet_points,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function claimKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 5);
}

function buildNarrativeCoverage(pages: SiteContentPage[], claims: IntelligenceClaim[]): NarrativeCoverage[] {
  const pageIndex = pages.map((page) => ({
    id: page.id,
    label: page.spec_page_name || page.page_title || page.page_path || page.page_url,
    text: pageSearchText(page),
  }));

  return claims.map((claim) => {
    const tokens = claimKeywords(claim.claim_text).slice(0, 8);
    const coveredPages = pageIndex
      .filter((page) => tokens.some((token) => page.text.includes(token)))
      .map((page) => page.label);
    const coverageRatio = pages.length > 0 ? coveredPages.length / pages.length : 0;

    let posture: NarrativeCoverage["posture"] = "aligned";
    if (coveredPages.length === 0) posture = "missing";
    else if (coverageRatio < 0.4) posture = "partial";

    return {
      claim,
      pagesCovered: coveredPages,
      coverageRatio,
      posture,
    };
  });
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
  const [propertySignals, setPropertySignals] = React.useState<PropertySignals>({
    brief: null,
    captainLog: [],
  });

  const loadPropertySignals = React.useCallback(async (propertyId: string) => {
    try {
      const [brief, captainLog] = await Promise.all([
        getIntelligencePropertyBriefInputs(propertyId),
        getGovernedMemoryPropertyLog(propertyId),
      ]);
      setPropertySignals({
        brief,
        captainLog: captainLog.entries,
      });
    } catch {
      setPropertySignals({
        brief: null,
        captainLog: [],
      });
    }
  }, []);

  const loadInventory = React.useCallback(async () => {
    const [inventory, office] = await Promise.all([getSiteContentInventory(), getIntelligenceOffice()]);
    setProperties(inventory.properties);
    setDirectives(office.directives);
    setSources(office.sources);

    const nextPropertyId = selectedPropertyId || inventory.properties[0]?.property_id || "";
    if (nextPropertyId) {
      setSelectedPropertyId(nextPropertyId);
      const [detail] = await Promise.all([getSiteContentProperty(nextPropertyId), loadPropertySignals(nextPropertyId)]);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId("all");
    }
  }, [selectedPropertyId, loadPropertySignals]);

  React.useEffect(() => {
    loadInventory()
      .catch((err: Error) => setFlash({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, [loadInventory]);

  async function loadProperty(propertyId: string) {
    setSelectedPropertyId(propertyId);
    try {
      const [detail] = await Promise.all([getSiteContentProperty(propertyId), loadPropertySignals(propertyId)]);
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
      await loadPropertySignals(selectedPropertyId);
      setProperties(inventory.properties);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId("all");
      setActiveTab("inventory");
      setFlash({
        type: "success",
        text: `Crawled ${detail.pages.length} pages for ${detail.property.property_name}.`,
      });
    } catch (err: any) {
      setFlash({ type: "error", text: err.message });
    } finally {
      setCrawling(false);
    }
  }

  function handleRewriteSaved(pageId: string, rewrite: SiteContentSectionRewrite) {
    setSelectedPages((pages) =>
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              section_rewrites: upsertById(page.section_rewrites, rewrite),
              section_rewrite_summary: summarizeRewrites(upsertById(page.section_rewrites, rewrite)),
            }
      )
    );
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
  const siteSummary = summarizeSite(selectedPages);
  const briefReadiness = propertySignals.brief?.briefReadiness ?? selectedSummary?.brief_readiness ?? null;
  const propertyClaims = propertySignals.brief?.claims ?? [];
  const propertyEvidence = propertySignals.brief?.evidence ?? [];
  const latestCaptainEntry = propertySignals.captainLog[0] ?? null;
  const narrativeCoverage = buildNarrativeCoverage(selectedPages, propertyClaims);
  const missingNarrativeClaims = narrativeCoverage.filter((item) => item.posture === "missing");
  const partialNarrativeClaims = narrativeCoverage.filter((item) => item.posture === "partial");

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Card className="overflow-hidden border-[#15284B]/10 bg-[linear-gradient(150deg,#0f2745_0%,#124766_46%,#1e7d68_100%)] text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl space-y-3">
              <div className="flex items-center gap-3 text-white/85">
                <FileSearch className="h-6 w-6" />
                <p className="text-xs font-semibold uppercase tracking-[0.28em]">Content Operations Workspace</p>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">Site Content Creator</h1>
                <p className="max-w-4xl text-base leading-8 text-white/78 md:text-lg">
                  Capture the live site, compare it against Specs, bring in governed Intelligence Office context, and
                  review the whole property story from block to page to full-site harmonization.
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
              <HeroStat label="Story score" value={`${siteSummary.storyScore}`} helper="Message strength across the captured site" />
              <HeroStat
                label="Harmonization"
                value={`${siteSummary.harmonizationScore}`}
                helper="Cross-page alignment against one coherent story"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricChip icon={<Layers3 className="h-4 w-4" />} label="Pages captured" value={String(siteSummary.pagesCaptured)} />
            <MetricChip icon={<Compass className="h-4 w-4" />} label="Specs matched" value={String(siteSummary.matchedSections)} />
            <MetricChip icon={<Brain className="h-4 w-4" />} label="Needs attention" value={String(siteSummary.needsAttentionSections)} />
            <MetricChip icon={<Wand2 className="h-4 w-4" />} label="Approved rewrites" value={String(siteSummary.approvedRewrites)} />
          </div>
        </CardContent>
      </Card>

      {flash && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            flash.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {flash.text}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[1.5fr_0.65fr_0.7fr_auto]">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property site</label>
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
              Refresh Site Snapshot
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Target className="h-5 w-5 text-[#0D5E6D]" />
              <h2 className="text-lg font-semibold">Site story board</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Site Content now evaluates the property site as a composed narrative system. Use this board to understand
              whether the site is structurally aligned, story-consistent, and ready for rewrite closure.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <SurfaceMetric label="Partial mappings" value={String(siteSummary.partialSections)} helper="Live sections that only partially fit the intended Specs role." />
              <SurfaceMetric label="Missing expected sections" value={String(siteSummary.missingSections)} helper="Governed sections expected by Specs but absent on the live page." />
              <SurfaceMetric label="Drafted rewrites" value={String(siteSummary.draftedRewrites)} helper="Sections with a first rewrite pass but not yet reviewed." />
              <SurfaceMetric label="In review" value={String(siteSummary.inReviewRewrites)} helper="Sections already moving toward approved harmonized copy." />
            </div>
            <div className="rounded-2xl border border-[#15284B]/10 bg-[#15284B]/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Next move</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{siteSummary.nextMove}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Sparkles className="h-5 w-5 text-[#0D5E6D]" />
              <h2 className="text-lg font-semibold">Operating contract</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ContractTile title="Specs" detail="Intended structure, expected sections, and page-purpose contract." />
              <ContractTile title="EVS / BrowserStack" detail="Observed rendered structure and journey truth." />
              <ContractTile title="Intelligence Office" detail="Directives, claims, evidence, and governed interpretation." />
              <ContractTile title="Property Captain" detail="Property-specific priorities, differentiation, and storytelling emphasis." />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-7 text-slate-700">
                Site Content Creator should be the place where these truths meet. It should diagnose the content, not
                duplicate the structural work already owned by Specs or the rendered-evidence work already owned by EVS.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Brain className="h-5 w-5 text-[#0D5E6D]" />
              <h2 className="text-lg font-semibold">Intelligence and Captain signals</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              These are the governed narrative inputs behind the site story. They should influence rewrite priority and
              storytelling judgment before section copy gets polished in isolation.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <SurfaceMetric
                label="Claims"
                value={String(propertyClaims.length)}
                helper="Property-scoped narrative claims that should be reinforced or reconciled on the site."
              />
              <SurfaceMetric
                label="Evidence refs"
                value={String(propertyEvidence.length)}
                helper="Evidence objects supporting the active property story and its major proof points."
              />
              <SurfaceMetric
                label="Brief readiness"
                value={briefReadiness ? `${briefReadiness.completeness_score}` : "—"}
                helper={briefReadiness ? briefReadiness.completeness_status : "No readiness signal loaded for this property."}
              />
            </div>
            {briefReadiness && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Readiness posture</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Captain inputs: {briefReadiness.captain_log_count} · Claims: {briefReadiness.claim_count} · Evidence:{" "}
                  {briefReadiness.evidence_count}
                </p>
                {briefReadiness.missing_components.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {briefReadiness.missing_components.map((item) => (
                      <InlinePill key={item} label={item.replace(/_/g, " ")} tone="amber" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Compass className="h-5 w-5 text-[#0D5E6D]" />
              <h2 className="text-lg font-semibold">Captain’s Brief lead signal</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              The current property story should stay anchored to the latest Captain guidance, not only to structural and
              section-level assessment output.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {latestCaptainEntry ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Latest Captain entry</p>
                  <p className="mt-3 text-base font-semibold text-slate-900">{latestCaptainEntry.entry.summary}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Confidence {Math.round((latestCaptainEntry.entry.confidence ?? 0) * 100)} · Updated{" "}
                    {formatStamp(latestCaptainEntry.entry.updated_at)}
                  </p>
                  {latestCaptainEntry.evidence.length > 0 && (
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Evidence attached: {latestCaptainEntry.evidence.length} supporting references
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  No Captain’s Brief signal is currently available for this property. The site story should be treated as
                  under-governed until property strategy is supplied.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <Target className="h-5 w-5 text-[#0D5E6D]" />
            <h2 className="text-lg font-semibold">Narrative consistency board</h2>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            This layer checks whether the active governed property claims are actually echoed across the captured site.
            It helps surface where the property story is fragmented, under-supported, or absent from key pages.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <SurfaceMetric
              label="Governed claims"
              value={String(narrativeCoverage.length)}
              helper="Claims available to measure against the captured site copy."
            />
            <SurfaceMetric
              label="Missing claims"
              value={String(missingNarrativeClaims.length)}
              helper="Claims not reflected on any captured page yet."
            />
            <SurfaceMetric
              label="Partial coverage"
              value={String(partialNarrativeClaims.length)}
              helper="Claims present somewhere, but not distributed strongly enough across the site."
            />
          </div>
          {narrativeCoverage.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {narrativeCoverage.map((item) => {
                const tone =
                  item.posture === "aligned"
                    ? "border-emerald-200 bg-emerald-50/70"
                    : item.posture === "partial"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-rose-200 bg-rose-50/70";
                const label =
                  item.posture === "aligned" ? "Aligned" : item.posture === "partial" ? "Partial" : "Missing";
                return (
                  <div key={item.claim.id} className={`rounded-2xl border p-4 ${tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">{item.claim.claim_text}</p>
                      <InlinePill
                        label={label}
                        tone={item.posture === "aligned" ? "emerald" : item.posture === "partial" ? "amber" : "rose"}
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      Coverage: {Math.round(item.coverageRatio * 100)}% of captured pages
                    </p>
                    {item.pagesCovered.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.pagesCovered.slice(0, 5).map((pageLabel) => (
                          <InlinePill key={pageLabel} label={pageLabel} tone="slate" />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        No captured page currently reflects this governed claim strongly enough to register.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No governed property claims are loaded for this site yet, so narrative consistency cannot be assessed.
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory">Site Workspace</TabsTrigger>
          <TabsTrigger value="brief">Governed Inputs</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-base font-semibold text-slate-900">Page composition board</p>
                <p className="text-sm text-slate-600">
                  This is the triage layer between raw crawl output and section work. Review which pages are already
                  coherent, which pages are structurally drifting, and which ones are still missing their intended story.
                </p>
              </div>
              {selectedPages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Run a crawl for the selected property and the page board will populate with page composition posture.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {selectedPages.map((page) => {
                    const posture = summarizePage(page, propertyClaims, briefReadiness);
                    const tone = toneForPosture(posture.posture);
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => setFocusedPageId(page.id)}
                        className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(15,23,42,0.08)] ${tone.border} ${tone.bg}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {page.spec_page_name || page.page_title || page.page_path || page.page_url}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                              {page.page_type || "page"} • {page.sections.length} blocks
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone.badge}`}>
                            {posture.posture.replace("-", " ")}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <MiniScore label="Story" value={posture.storyScore} />
                          <MiniScore label="Harmony" value={posture.harmonizationScore} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <InlinePill label={`${page.section_mapping_summary.matched} matched`} />
                          {page.section_mapping_summary.partial > 0 && (
                            <InlinePill label={`${page.section_mapping_summary.partial} partial`} tone="amber" />
                          )}
                          {page.section_mapping_summary.missing_from_live > 0 && (
                            <InlinePill label={`${page.section_mapping_summary.missing_from_live} missing`} tone="rose" />
                          )}
                          {page.section_rewrite_summary.in_review > 0 && (
                            <InlinePill label={`${page.section_rewrite_summary.in_review} in review`} tone="blue" />
                          )}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-700">{posture.nextMove}</p>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedPages.length > 0 && (
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
              )}
            </CardContent>
          </Card>

          {selectedPages.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="text-base font-semibold text-slate-900">No site snapshot yet</p>
                <p className="text-sm text-slate-600">
                  Refresh the selected property to capture live page structure, section copy, and rewrite posture.
                </p>
              </CardContent>
            </Card>
          ) : (
            visiblePages.map((page) => (
              <PageWorkspace
                key={page.id}
                page={page}
                onRewriteSaved={handleRewriteSaved}
                propertyClaims={propertyClaims}
                briefReadiness={briefReadiness}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="brief" className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-[#0D5E6D]">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-slate-900">Intelligence Office directives</h2>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                These are the governed rules that should shape storytelling, search posture, and rewrite decisions before
                a single block is changed.
              </p>
              <div className="space-y-3">
                {directives.map((directive) => (
                  <div key={directive.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{directive.title}</p>
                      <Badge className="border-0 bg-[#15284B]/10 text-[#15284B]">{directive.category}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{directive.directive_text}</p>
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
              <p className="text-sm leading-6 text-slate-600">
                These source notes are the evidence base behind rewrite and harmonization choices. Site Content should
                consume them, not hide them.
              </p>
              <div className="space-y-3">
                {sources.map((source) => (
                  <div key={source.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">{source.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{source.source_kind}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{source.summary}</p>
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

function PageWorkspace({
  page,
  onRewriteSaved,
  propertyClaims,
  briefReadiness,
}: {
  page: SiteContentPage;
  onRewriteSaved: (pageId: string, rewrite: SiteContentSectionRewrite) => void;
  propertyClaims: IntelligenceClaim[];
  briefReadiness: BriefReadiness | null;
}) {
  const posture = summarizePage(page, propertyClaims, briefReadiness);
  const tone = toneForPosture(posture.posture);
  const missingMappings = page.section_mappings.filter((mapping) => mapping.match_status === "missing-from-live");

  return (
    <Card id={`page-${page.id}`} className={`overflow-hidden border ${tone.border}`}>
      <CardContent className="space-y-5 p-0">
        <div className={`sticky top-0 z-10 border-b px-6 py-5 backdrop-blur ${tone.bg} ${tone.border}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-slate-900">
                  {page.spec_page_name || page.page_title || page.page_path || page.page_url}
                </h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone.badge}`}>
                  {posture.posture.replace("-", " ")}
                </span>
              </div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                {page.page_type || "page"} • {page.page_path || "/"} • {page.sections.length} observed blocks
              </p>
              {page.spec_layout_path && <p className="text-sm text-slate-600">Specs contract: {page.spec_layout_path}</p>}
              <p className="text-sm text-slate-500">{page.page_url}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniScore label="Story" value={posture.storyScore} />
              <MiniScore label="Harmony" value={posture.harmonizationScore} />
              <MiniMetric label="Needs attention" value={String(page.section_assessment_summary.needs_attention)} />
              <MiniMetric label="Approved rewrites" value={String(page.section_rewrite_summary.approved)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <InlinePill label={`${page.section_mapping_summary.matched} matched`} />
            {page.section_mapping_summary.partial > 0 && (
              <InlinePill label={`${page.section_mapping_summary.partial} partial`} tone="amber" />
            )}
            {page.section_mapping_summary.missing_from_live > 0 && (
              <InlinePill label={`${page.section_mapping_summary.missing_from_live} missing from live`} tone="rose" />
            )}
            {page.section_mapping_summary.extra_on_live > 0 && (
              <InlinePill label={`${page.section_mapping_summary.extra_on_live} extra on live`} tone="slate" />
            )}
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-700">{posture.nextMove}</p>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {missingMappings.length > 0 && (
            <Card className="border-rose-200 bg-rose-50/70">
              <CardContent className="space-y-3 p-5">
                <div>
                  <p className="text-base font-semibold text-slate-900">Expected structure missing from the live page</p>
                  <p className="text-sm leading-6 text-slate-600">
                    These sections exist in the governed contract but were not found in the current crawl. This is a page
                    composition issue, not just a section rewrite issue.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {missingMappings.map((mapping) => (
                    <div key={mapping.id} className="rounded-xl border border-rose-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">
                        {mapping.expected_section_label || mapping.expected_section_key || "Expected section"}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {mapping.expected_section_role || "expected role"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{mapping.rationale}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {page.sections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              This page was discovered, but no section blocks were extracted yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {page.sections.map((section) => {
                const mapping = resolveMappingForSection(page, section);
                const assessment = mapping ? page.section_assessments.find((item) => item.mapping_id === mapping.id) ?? null : null;
                const rewrite = mapping ? page.section_rewrites.find((item) => item.mapping_id === mapping.id) ?? null : null;
                return (
                  <SectionWorkspace
                    key={`${page.id}-${section.id ?? section.section_order}`}
                    propertyId={page.property_id}
                    pageId={page.id}
                    section={section}
                    mapping={mapping}
                    assessment={assessment}
                    rewrite={rewrite}
                    onRewriteSaved={onRewriteSaved}
                  />
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionWorkspace({
  propertyId,
  pageId,
  section,
  mapping,
  assessment,
  rewrite,
  onRewriteSaved,
}: {
  propertyId: string;
  pageId: string;
  section: SiteContentSection;
  mapping: SiteContentSectionMapping | null;
  assessment: SiteContentSectionAssessment | null;
  rewrite: SiteContentSectionRewrite | null;
  onRewriteSaved: (pageId: string, rewrite: SiteContentSectionRewrite) => void;
}) {
  const [draftStatus, setDraftStatus] = React.useState<SiteContentSectionRewrite["draft_status"]>(
    rewrite?.draft_status ?? "not_started"
  );
  const [rewriteBrief, setRewriteBrief] = React.useState(rewrite?.rewrite_brief ?? "");
  const [proposedCopy, setProposedCopy] = React.useState(rewrite?.proposed_copy ?? "");
  const [refinementNotes, setRefinementNotes] = React.useState(rewrite?.refinement_notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saveFlash, setSaveFlash] = React.useState<Flash>(null);

  React.useEffect(() => {
    setDraftStatus(rewrite?.draft_status ?? "not_started");
    setRewriteBrief(rewrite?.rewrite_brief ?? "");
    setProposedCopy(rewrite?.proposed_copy ?? "");
    setRefinementNotes(rewrite?.refinement_notes ?? "");
  }, [rewrite]);

  const title = section.title || section.section_label || section.heading || `Section ${section.section_order + 1}`;
  const assessmentTone = assessment ? toneForPosture(assessment.overall_status) : toneForPosture("watch");

  async function handleSave() {
    if (!mapping) {
      setSaveFlash({ type: "error", text: "This section is not mapped to a governed Specs slot yet." });
      return;
    }

    setSaving(true);
    setSaveFlash(null);
    try {
      const response = await saveSiteContentSectionRewrite(propertyId, {
        page_id: pageId,
        mapping_id: mapping.id,
        section_id: section.id ?? null,
        draft_status: draftStatus,
        rewrite_brief: rewriteBrief,
        proposed_copy: proposedCopy,
        refinement_notes: refinementNotes,
      });
      onRewriteSaved(pageId, response.rewrite);
      setSaveFlash({ type: "success", text: "Rewrite workspace saved." });
    } catch (error: any) {
      setSaveFlash({ type: "error", text: error.message ?? "Failed to save rewrite." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="grid gap-5 border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-5 lg:grid-cols-[0.95fr_1.05fr_0.95fr]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0D5E6D]">Expected Specs slot</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {mapping?.expected_section_label || mapping?.expected_section_key || "Unmapped section"}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
              {mapping?.expected_section_role || "No governed role attached yet"}
            </p>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            {mapping?.rationale ||
              "This live section has not yet been reconciled cleanly against the intended section contract."}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0D5E6D]">Live baseline</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
              {section.section_type || "standard"} • {section.image_count} images • {section.link_count} links
            </p>
          </div>
          <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {section.original_copy || "No captured copy was extracted for this block."}
          </p>
        </div>

        <div className={`space-y-3 rounded-2xl border p-4 ${assessmentTone.border} ${assessmentTone.bg}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Assessment posture</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {assessment?.overall_status ? assessment.overall_status.replace("-", " ") : "Needs review"}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${assessmentTone.badge}`}>
              {assessment?.overall_status?.replace("-", " ") || "watch"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <InlineScore label="Structure" value={assessment?.structural_score ?? 0} />
            <InlineScore label="Message" value={assessment?.messaging_score ?? 0} />
            <InlineScore label="Specificity" value={assessment?.specificity_score ?? 0} />
            <InlineScore label="Search" value={assessment?.search_value_score ?? 0} />
            <InlineScore label="CTA" value={assessment?.cta_score ?? 0} />
            <InlineScore label="Harmony" value={assessment?.harmonization_score ?? 0} />
          </div>
          <p className="text-sm leading-6 text-slate-700">
            {assessment?.summary || "This section needs explicit assessment before rewrite decisions are trusted."}
          </p>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Observed copy</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {section.original_copy || "No extracted copy available."}
            </p>
            {section.bullet_points.length > 0 && (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {section.bullet_points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Rewrite workspace</p>
              <select
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                value={draftStatus}
                onChange={(event) =>
                  setDraftStatus(event.target.value as SiteContentSectionRewrite["draft_status"])
                }
              >
                <option value="not_started">Not started</option>
                <option value="drafted">Drafted</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            <textarea
              className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-800"
              value={rewriteBrief}
              onChange={(event) => setRewriteBrief(event.target.value)}
              placeholder="What should this section do in the site story?"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Proposed rewrite</p>
            <textarea
              className="min-h-[168px] w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-7 text-slate-800"
              value={proposedCopy}
              onChange={(event) => setProposedCopy(event.target.value)}
              placeholder="Draft the harmonized section copy here."
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Refinement notes</p>
            <textarea
              className="min-h-[92px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-800"
              value={refinementNotes}
              onChange={(event) => setRefinementNotes(event.target.value)}
              placeholder="Note what changed, what still feels weak, or what story tension remains."
            />
          </div>

          {saveFlash && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                saveFlash.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {saveFlash.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !mapping}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Save Rewrite
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveMappingForSection(page: SiteContentPage, section: SiteContentSection): SiteContentSectionMapping | null {
  return (
    page.section_mappings.find((mapping) => mapping.section_id && section.id && mapping.section_id === section.id) ??
    page.section_mappings.find(
      (mapping) =>
        !mapping.section_id &&
        mapping.match_status !== "missing-from-live" &&
        mapping.expected_order === section.section_order
    ) ??
    null
  );
}

function summarizeRewrites(rewrites: SiteContentSectionRewrite[]) {
  return {
    not_started: rewrites.filter((rewrite) => rewrite.draft_status === "not_started").length,
    drafted: rewrites.filter((rewrite) => rewrite.draft_status === "drafted").length,
    in_review: rewrites.filter((rewrite) => rewrite.draft_status === "in_review").length,
    approved: rewrites.filter((rewrite) => rewrite.draft_status === "approved").length,
  };
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const existing = items.find((item) => item.id === nextItem.id);
  if (!existing) return [...items, nextItem];
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function HeroStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/62">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/68">{helper}</p>
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-white/16 bg-white/8 px-4 py-3 text-sm">
      <span className="text-white/78">{icon}</span>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{label}</p>
        <p className="font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function SurfaceMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function ContractTile({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function InlinePill({
  label,
  tone = "emerald",
}: {
  label: string;
  tone?: "emerald" | "amber" | "rose" | "blue" | "slate";
}) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
    slate: "bg-slate-100 text-slate-700",
  } as const;
  return <span className={`rounded-full px-2.5 py-1 font-medium ${styles[tone]}`}>{label}</span>;
}

function InlineScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/65 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{clampScore(value)}</p>
    </div>
  );
}
