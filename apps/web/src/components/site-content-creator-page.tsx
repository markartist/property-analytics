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
  Image as ImageIcon,
  BookText,
  Brain,
  Compass,
  FileSearch,
  Layers3,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  Target,
  Type,
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

type NarrativePriorityPage = {
  pageId: string;
  label: string;
  score: number;
  reasons: string[];
};

type PageClaimFocus = {
  pageId: string;
  claims: IntelligenceClaim[];
};

type StoryTheme =
  | "lifestyle"
  | "location"
  | "amenities"
  | "floorplans"
  | "trust"
  | "conversion"
  | "differentiation";

const STORY_THEME_KEYWORDS: Record<StoryTheme, string[]> = {
  lifestyle: ["lifestyle", "community", "experience", "living", "resident", "feel", "home"],
  location: ["location", "neighborhood", "district", "walkable", "nearby", "local", "connected"],
  amenities: ["amenities", "pool", "fitness", "clubhouse", "features", "spaces", "pet", "parking"],
  floorplans: ["floorplan", "plans", "layouts", "studio", "bedroom", "residences", "apartments"],
  trust: ["quality", "managed", "service", "team", "maintenance", "trusted", "confidence", "proof"],
  conversion: ["tour", "apply", "lease", "availability", "contact", "schedule", "cta", "book"],
  differentiation: ["unique", "distinctive", "elevated", "designed", "crafted", "signature", "standout"],
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

function inferStoryThemes(text: string): StoryTheme[] {
  const lowered = text.toLowerCase();
  const matches = Object.entries(STORY_THEME_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => lowered.includes(keyword)))
    .map(([theme]) => theme as StoryTheme);
  return matches.length > 0 ? matches : ["differentiation"];
}

function themeLabel(theme: StoryTheme): string {
  switch (theme) {
    case "floorplans":
      return "Floor Plans";
    default:
      return theme.charAt(0).toUpperCase() + theme.slice(1);
  }
}

function pageIntentTokens(page: SiteContentPage): string[] {
  return [
    page.page_type,
    page.page_path,
    page.spec_page_name,
    page.spec_archetype_name,
    page.page_title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function pageIntentThemes(page: SiteContentPage): StoryTheme[] {
  return inferStoryThemes(
    [page.page_type, page.page_path, page.spec_page_name, page.spec_archetype_name, page.page_title]
      .filter(Boolean)
      .join(" ")
  );
}

function sectionRoleTokens(mapping: SiteContentSectionMapping | null): string[] {
  return [mapping?.expected_section_label, mapping?.expected_section_role, mapping?.expected_section_key]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function sectionRoleThemes(mapping: SiteContentSectionMapping | null): StoryTheme[] {
  return inferStoryThemes([mapping?.expected_section_label, mapping?.expected_section_role, mapping?.expected_section_key].filter(Boolean).join(" "));
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

function buildNarrativePriorityPages(
  pages: SiteContentPage[],
  narrativeCoverage: NarrativeCoverage[],
  briefReadiness: BriefReadiness | null
): NarrativePriorityPage[] {
  const unresolvedClaims = narrativeCoverage.filter((item) => item.posture !== "aligned");
  return pages
    .map((page) => {
      const label = page.spec_page_name || page.page_title || page.page_path || page.page_url;
      const searchText = pageSearchText(page);
      const reasons: string[] = [];
      let score = 0;

      if ((page.page_path ?? "/") === "/" || page.page_type?.toLowerCase().includes("home")) {
        score += 4;
        reasons.push("Homepage carries the broadest story burden.");
      }

      if (page.section_mapping_summary.missing_from_live > 0) {
        score += 3;
        reasons.push("Expected structure is still missing on this page.");
      }

      if (page.section_assessment_summary.needs_attention > 0) {
        score += 3;
        reasons.push("The page already has sections marked needs attention.");
      } else if (page.section_assessment_summary.watch > 0) {
        score += 2;
        reasons.push("The page still has watched sections that can carry story cleanup.");
      }

      if (page.section_rewrite_summary.drafted > 0 || page.section_rewrite_summary.in_review > 0) {
        score += 1;
        reasons.push("Rewrite work is already in motion here, so closing the loop is cheaper.");
      }

      for (const item of unresolvedClaims) {
        const tokens = claimKeywords(item.claim.claim_text).slice(0, 5);
        const tokenHits = tokens.filter((token) => searchText.includes(token)).length;
        if (tokenHits > 0) {
          score += item.posture === "missing" ? 2 : 1;
          reasons.push(
            item.posture === "missing"
              ? `This page is a plausible home for a missing governed claim.`
              : `This page can help strengthen a partially-covered governed claim.`
          );
        }
      }

      if (briefReadiness && briefReadiness.completeness_status !== "ready") {
        score += 1;
        reasons.push("Property brief readiness is not fully settled, so visible narrative anchors matter more.");
      }

      return {
        pageId: page.id,
        label,
        score,
        reasons: Array.from(new Set(reasons)).slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function selectClaimsForPage(page: SiteContentPage, narrativeCoverage: NarrativeCoverage[]): IntelligenceClaim[] {
  const unresolved = narrativeCoverage.filter((item) => item.posture !== "aligned");
  const pageTokens = new Set(pageIntentTokens(page));
  const pageThemes = new Set(pageIntentThemes(page));
  const pageText = pageSearchText(page);

  return unresolved
    .map((item) => {
      const tokens = claimKeywords(item.claim.claim_text).slice(0, 8);
      const claimThemes = inferStoryThemes(item.claim.claim_text);
      const roleHits = tokens.filter((token) => pageTokens.has(token)).length;
      const textHits = tokens.filter((token) => pageText.includes(token)).length;
      const themeHits = claimThemes.filter((theme) => pageThemes.has(theme)).length;
      const homeBoost = ((page.page_path ?? "/") === "/" || page.page_type?.toLowerCase().includes("home")) ? 2 : 0;
      const postureBoost = item.posture === "missing" ? 2 : 1;
      return {
        claim: item.claim,
        score: roleHits * 3 + textHits + themeHits * 4 + homeBoost + postureBoost,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.claim);
}

function suggestedRewriteBrief(
  mapping: SiteContentSectionMapping | null,
  focusedClaims: IntelligenceClaim[]
): string {
  const sectionRole = mapping?.expected_section_label || mapping?.expected_section_role || mapping?.expected_section_key || "this section";
  const themes = Array.from(
    new Set(
      focusedClaims.flatMap((claim) => inferStoryThemes(claim.claim_text))
    )
  );
  const claimLead = focusedClaims[0]?.claim_text;
  if (claimLead) {
    const themeLead = themes.length > 0 ? ` Focus the rewrite on ${themes.map(themeLabel).join(", ")}.` : "";
    return `Use ${sectionRole} to reinforce the property story around: ${claimLead}.${themeLead}`;
  }
  return `Use ${sectionRole} to support the page purpose, maintain cross-page harmony, and strengthen the most important property differentiators.`;
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
  const selectedPropertyIdRef = React.useRef(selectedPropertyId);

  React.useEffect(() => {
    selectedPropertyIdRef.current = selectedPropertyId;
  }, [selectedPropertyId]);

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

    const nextPropertyId = selectedPropertyIdRef.current || inventory.properties[0]?.property_id || "";
    if (nextPropertyId) {
      if (selectedPropertyIdRef.current !== nextPropertyId) {
        setSelectedPropertyId(nextPropertyId);
      }
      const [detail] = await Promise.all([getSiteContentProperty(nextPropertyId), loadPropertySignals(nextPropertyId)]);
      setSelectedPropertyName(detail.property.property_name);
      setSelectedPages(detail.pages);
      setFocusedPageId(detail.pages[0]?.id ?? "all");
    }
  }, [loadPropertySignals]);

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
      setFocusedPageId(detail.pages[0]?.id ?? "all");
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
      setFocusedPageId(detail.pages[0]?.id ?? "all");
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
  const narrativePriorityPages = buildNarrativePriorityPages(selectedPages, narrativeCoverage, briefReadiness);
  const pageClaimFocus = new Map<string, IntelligenceClaim[]>(
    selectedPages.map((page) => [page.id, selectClaimsForPage(page, narrativeCoverage)])
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Card className="overflow-hidden border-[#15284B]/10 bg-[linear-gradient(150deg,#f7fbfd_0%,#eef6fb_48%,#edf8f3_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <CardContent className="space-y-4 p-6 md:p-8">
          <div className="flex items-center gap-3 text-[#0D5E6D]">
            <FileSearch className="h-6 w-6" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em]">Content Ops</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr] lg:items-start">
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">Site Content Creator</h1>
              <p className="max-w-4xl text-base leading-8 text-slate-600 md:text-lg">
                Pick a property, open a page, and work block by block on content that visually matches the live site.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SimpleHeroTile label="Properties" value={String(properties.length)} helper="available" />
              <SimpleHeroTile label="Pages" value={String(siteSummary.pagesCaptured)} helper="captured" />
              <SimpleHeroTile
                label="Brief"
                value={briefReadiness?.completeness_status === "ready" ? "Ready" : "Needs work"}
                helper={briefReadiness ? `${briefReadiness.missing_components.length} gaps` : "no governed brief"}
              />
            </div>
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
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 lg:grid-cols-[1.45fr_0.6fr_auto]">
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
            <p className="text-sm text-slate-500">
              {selectedSummary
                ? `${selectedSummary.page_count} pages captured`
                : "Choose a property to load its captured pages."}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page crawl limit</label>
            <Input value={selectedPageLimit} onChange={(e) => setSelectedPageLimit(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={runCrawl} disabled={!selectedPropertyId || crawling}>
              {crawling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Site Snapshot
            </Button>
          </div>
          </div>
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
                <p className="text-base font-semibold text-slate-900">Pages</p>
                <p className="text-sm text-slate-600">
                  Pick a page to open its content layout and edit one block at a time.
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
                    const focusedClaims = pageClaimFocus.get(page.id) ?? [];
                    const focusedThemes = Array.from(
                      new Set(focusedClaims.flatMap((claim) => inferStoryThemes(claim.claim_text)))
                    );
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => setFocusedPageId(page.id)}
                        className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(15,23,42,0.08)] ${tone.border} ${tone.bg}`}
                      >
                        <div className="mb-4">
                          {page.spec_screenshot ? (
                            <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-slate-100">
                              <img
                                src={page.spec_screenshot}
                                alt={`${page.spec_page_name || page.page_title || "Page"} preview`}
                                className="h-32 w-full object-cover object-top"
                              />
                            </div>
                          ) : (
                            renderSectionPreviewBars(page)
                          )}
                        </div>
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
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <InlinePill label={`${page.sections.filter((section) => section.image_count > 0).length} visual blocks`} tone="blue" />
                          <InlinePill label={`${page.sections.length} sections`} tone="slate" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedPages.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
            visiblePages.slice(0, 1).map((page) => (
              <PageWorkspace
                key={page.id}
                page={page}
                onRewriteSaved={handleRewriteSaved}
                propertyClaims={propertyClaims}
                briefReadiness={briefReadiness}
                focusedClaims={pageClaimFocus.get(page.id) ?? []}
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
  focusedClaims,
}: {
  page: SiteContentPage;
  onRewriteSaved: (pageId: string, rewrite: SiteContentSectionRewrite) => void;
  propertyClaims: IntelligenceClaim[];
  briefReadiness: BriefReadiness | null;
  focusedClaims: IntelligenceClaim[];
}) {
  const posture = summarizePage(page, propertyClaims, briefReadiness);
  const tone = toneForPosture(posture.posture);
  const missingMappings = page.section_mappings.filter((mapping) => mapping.match_status === "missing-from-live");
  const focusedThemes = Array.from(new Set(focusedClaims.flatMap((claim) => inferStoryThemes(claim.claim_text))));
  const [activeSectionKey, setActiveSectionKey] = React.useState<string | null>(page.sections[0] ? sectionIdentity(page.sections[0]) : null);

  React.useEffect(() => {
    setActiveSectionKey(page.sections[0] ? sectionIdentity(page.sections[0]) : null);
  }, [page.id, page.sections]);

  const activeSection = page.sections.find((section) => sectionIdentity(section) === activeSectionKey) ?? page.sections[0] ?? null;
  const activeSectionMapping = activeSection ? resolveMappingForSection(page, activeSection) : null;
  const activeSectionAssessment =
    activeSectionMapping && activeSection
      ? page.section_assessments.find((item) => item.mapping_id === activeSectionMapping.id) ?? null
      : null;
  const activeSectionRewrite =
    activeSectionMapping && activeSection
      ? page.section_rewrites.find((item) => item.mapping_id === activeSectionMapping.id) ?? null
      : null;

  return (
    <Card id={`page-${page.id}`} className={`overflow-hidden border ${tone.border}`}>
      <CardContent className="space-y-5 p-0">
        <div className={`border-b px-6 py-5 backdrop-blur ${tone.bg} ${tone.border}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
            <div className="flex flex-wrap gap-2 text-xs">
              <InlinePill label={`${page.sections.length} blocks`} tone="slate" />
              <InlinePill label={`${page.sections.filter((section) => section.image_count > 0).length} with visuals`} tone="blue" />
              {page.section_rewrite_summary.in_review > 0 && (
                <InlinePill label={`${page.section_rewrite_summary.in_review} in review`} tone="amber" />
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[320px_1fr]">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Page visual cue</p>
              {page.spec_screenshot ? (
                <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
                  <img
                    src={page.spec_screenshot}
                    alt={`${page.spec_page_name || page.page_title || "Page"} visual preview`}
                    className="h-44 w-full object-cover object-top"
                  />
                </div>
              ) : (
                renderSectionPreviewBars(page, activeSectionKey)
              )}
            </div>
            <div className="rounded-[1.15rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0D5E6D]">Editing flow</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <InlinePill label="1. Choose a page block" tone="blue" />
                <InlinePill label="2. Compare layout and copy" tone="slate" />
                <InlinePill label="3. Rewrite only this block" tone="emerald" />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Treat this like a page mock. Pick the block you recognize, review the current copy, then rewrite that
                block before moving on.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {page.sections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              This page was discovered, but no section blocks were extracted yet.
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="border-slate-200">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">Page layout</p>
                      <p className="text-sm leading-6 text-slate-600">
                        These tiles approximate the blocks on the live page. Choose one to edit below.
                      </p>
                    </div>
                  </div>

                  {activeSection && (
                    <div className="flex flex-wrap items-center gap-3 rounded-[1.15rem] border border-[#0D5E6D]/15 bg-[#0D5E6D]/[0.05] px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D5E6D] text-white">
                        <MousePointerClick className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D5E6D]">Active block</p>
                        <p className="truncate text-base font-semibold text-slate-900">
                          {activeSection.title || activeSection.section_label || activeSection.heading || `Section ${activeSection.section_order + 1}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <InlinePill
                          label={sectionPositionLabel(
                            page.sections.findIndex((section) => sectionIdentity(section) === sectionIdentity(activeSection)),
                            page.sections.length
                          )}
                          tone="blue"
                        />
                        <InlinePill label={sectionMediaLabel(activeSection)} tone={activeSection.image_count > 0 ? "blue" : "slate"} />
                      </div>
                    </div>
                  )}

                  <div className="-mx-1 overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-3 px-1">
                      {page.sections.map((section, index) => {
                        const mapping = resolveMappingForSection(page, section);
                        const assessment = mapping ? page.section_assessments.find((item) => item.mapping_id === mapping.id) ?? null : null;
                        const rewrite = mapping ? page.section_rewrites.find((item) => item.mapping_id === mapping.id) ?? null : null;
                        const isActive = activeSection ? sectionIdentity(activeSection) === sectionIdentity(section) : false;
                        return (
                          <button
                            key={`${page.id}-${section.id ?? section.section_order}`}
                            type="button"
                            onClick={() => setActiveSectionKey(sectionIdentity(section))}
                            className={`w-[290px] shrink-0 rounded-[1.35rem] border p-4 text-left transition ${
                              isActive
                                ? "border-[#0D5E6D] bg-[linear-gradient(180deg,rgba(13,94,109,0.08),rgba(255,255,255,1))] shadow-[0_16px_30px_rgba(13,94,109,0.18)]"
                                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                  {index + 1}
                                </span>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  {sectionPositionLabel(index, page.sections.length)}
                                </span>
                              </div>
                              {renderSectionAssessmentPill(assessment)}
                            </div>

                            <div className="mt-3">
                              <SectionStructurePreview section={section} />
                            </div>

                            <div className="mt-3 space-y-2">
                              <p className="line-clamp-2 text-lg font-semibold text-slate-900">
                                {section.title || section.section_label || section.heading || `Section ${index + 1}`}
                              </p>
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                {section.section_type || "standard"} • {sectionMediaLabel(section)}
                              </p>
                              <p className="text-sm text-slate-500">{sectionMediaDetail(section)}</p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <InlinePill label={mappingLabel(mapping)} tone={mappingTone(mapping)} />
                              {rewrite && rewrite.draft_status !== "not_started" && (
                                <InlinePill label={rewrite.draft_status.replace("_", " ")} tone="blue" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {activeSection && (
                <SectionWorkspace
                  key={`${page.id}-${activeSection.id ?? activeSection.section_order}`}
                  propertyId={page.property_id}
                  pageId={page.id}
                  section={activeSection}
                  mapping={activeSectionMapping}
                  assessment={activeSectionAssessment}
                  rewrite={activeSectionRewrite}
                  focusedClaims={focusedClaims}
                  onRewriteSaved={onRewriteSaved}
                  sectionIndex={page.sections.findIndex((section) => sectionIdentity(section) === sectionIdentity(activeSection))}
                  totalSections={page.sections.length}
                />
              )}
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
  focusedClaims,
  onRewriteSaved,
  sectionIndex,
  totalSections,
}: {
  propertyId: string;
  pageId: string;
  section: SiteContentSection;
  mapping: SiteContentSectionMapping | null;
  assessment: SiteContentSectionAssessment | null;
  rewrite: SiteContentSectionRewrite | null;
  focusedClaims: IntelligenceClaim[];
  onRewriteSaved: (pageId: string, rewrite: SiteContentSectionRewrite) => void;
  sectionIndex: number;
  totalSections: number;
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
  const sectionFocusedClaims = focusedClaims.filter((claim) => {
    const claimTokens = claimKeywords(claim.claim_text);
    const roleTokens = new Set(sectionRoleTokens(mapping));
    return claimTokens.some((token) => roleTokens.has(token));
  });
  const sectionThemes = Array.from(
    new Set(
      (sectionFocusedClaims.length > 0 ? sectionFocusedClaims : focusedClaims).flatMap((claim) =>
        inferStoryThemes(claim.claim_text)
      )
    )
  );
  const recommendedBrief = suggestedRewriteBrief(mapping, sectionFocusedClaims.length > 0 ? sectionFocusedClaims : focusedClaims);

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
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0D5E6D]">Selected block</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold text-slate-900">{title}</p>
              <InlinePill label={`${sectionIndex + 1} of ${totalSections}`} tone="slate" />
              <InlinePill label={sectionPositionLabel(sectionIndex, totalSections)} tone="blue" />
              <InlinePill label={sectionMediaLabel(section)} tone={section.image_count > 0 ? "blue" : "slate"} />
              {mapping && <InlinePill label={mappingLabel(mapping)} tone={mappingTone(mapping)} />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">{renderSectionAssessmentPill(assessment)}</div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Block on page</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <PagePositionDiagram totalSections={totalSections} activeIndex={sectionIndex} />
              <SectionStructurePreview section={section} />
            </div>
          </div>
          <SectionMediaTile section={section} />
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Current block copy</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <InlinePill label={sectionPositionLabel(sectionIndex, totalSections)} tone="slate" />
                <InlinePill label={sectionMediaLabel(section)} tone={section.image_count > 0 ? "blue" : "slate"} />
              </div>
            </div>
            <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
                {section.original_copy || "No extracted copy available for this block yet."}
              </p>
              {section.bullet_points.length > 0 && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700">
                  {section.bullet_points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <details className="group rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
              Show block details
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <DrawerCueTile
                label="Specs fit"
                value={mappingLabel(mapping)}
                detail={mapping?.expected_section_label || "This block is not fully mapped yet"}
              />
              <DrawerCueTile
                label="Rewrite state"
                value={(rewrite?.draft_status ?? "not_started").replace("_", " ")}
                detail={assessment?.summary || "No formal assessment note yet"}
              />
              <DrawerCueTile
                label="Observed content"
                value={`${section.image_count} image${section.image_count === 1 ? "" : "s"}`}
                detail={`${section.link_count} links in this block`}
              />
            </div>
          </details>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Rewrite this block</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Keep the same job on the page, but make the content clearer, stronger, and more property-specific.
                </p>
              </div>
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
            <div className="mt-4 space-y-4">
              {(sectionFocusedClaims.length > 0 || focusedClaims.length > 0) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rewrite direction</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{recommendedBrief}</p>
                  {sectionThemes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sectionThemes.map((theme) => (
                        <InlinePill key={`${mapping?.id ?? section.section_order}-${theme}`} label={themeLabel(theme)} tone="blue" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Rewrite brief</p>
                <textarea
                  className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-800"
                  value={rewriteBrief}
                  onChange={(event) => setRewriteBrief(event.target.value)}
                  placeholder={recommendedBrief}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">New copy</p>
                <textarea
                  className="min-h-[220px] w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-7 text-slate-800"
                  value={proposedCopy}
                  onChange={(event) => setProposedCopy(event.target.value)}
                  placeholder="Write the revised content for this block here."
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Editor notes</p>
                <textarea
                  className="min-h-[92px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-800"
                  value={refinementNotes}
                  onChange={(event) => setRefinementNotes(event.target.value)}
                  placeholder="Optional notes for reviewers or future passes."
                />
              </div>
            </div>
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

      <div className="border-t border-slate-100 bg-slate-50/70 p-5">
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
            Advanced diagnostics
          </summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-[0.95fr_1.05fr_0.95fr]">
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
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0D5E6D]">Captured baseline</p>
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
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Assessment</p>
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
        </details>
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

function sectionIdentity(section: SiteContentSection): string {
  return section.id ?? `order-${section.section_order}`;
}

function sectionPositionLabel(index: number, totalSections: number): string {
  if (index <= 0) return "Top of page";
  if (index === totalSections - 1) return "Bottom of page";
  if (index >= totalSections - 2) return "Lower page";
  if (index <= Math.max(1, Math.floor(totalSections / 3))) return "Upper page";
  return "Mid-page";
}

function sectionPositionShortLabel(index: number, totalSections: number): string {
  if (index <= 0) return "Top";
  if (index === totalSections - 1) return "Bottom";
  if (index >= totalSections - 2) return "Lower";
  if (index <= Math.max(1, Math.floor(totalSections / 3))) return "Upper";
  return "Middle";
}

function sectionMediaLabel(section: SiteContentSection): string {
  if (section.image_count >= 3) return "Gallery-rich";
  if (section.image_count >= 1) return "Has imagery";
  return "Text-only";
}

function sectionMediaDetail(section: SiteContentSection): string {
  if (section.image_count <= 0) return "No images detected in this block";
  if (section.media_side === "left") return `${section.image_count} image${section.image_count > 1 ? "s" : ""} on the left`;
  if (section.media_side === "right") return `${section.image_count} image${section.image_count > 1 ? "s" : ""} on the right`;
  return `${section.image_count} image${section.image_count > 1 ? "s" : ""} detected`;
}

function sectionMediaGlyph(section: SiteContentSection): string {
  if (section.image_count >= 3) return "▣▣▣";
  if (section.image_count === 2) return "▣▣";
  if (section.image_count === 1) return "▣";
  return "—";
}

function mappingLabel(mapping: SiteContentSectionMapping | null): string {
  if (!mapping) return "Unmapped";
  switch (mapping.match_status) {
    case "matched":
      return "Matches Specs";
    case "partial":
      return "Partial match";
    case "missing-from-live":
      return "Missing from live";
    case "extra-on-live":
      return "Extra live block";
    default:
      return "Mapped";
  }
}

function mappingTone(mapping: SiteContentSectionMapping | null): "emerald" | "amber" | "rose" | "slate" {
  if (!mapping) return "rose";
  switch (mapping.match_status) {
    case "matched":
      return "emerald";
    case "partial":
      return "amber";
    case "missing-from-live":
      return "rose";
    case "extra-on-live":
      return "slate";
    default:
      return "slate";
  }
}

function renderSectionPreviewBars(page: SiteContentPage, activeSectionId?: string | null) {
  return (
    <div className="flex h-24 items-end gap-1.5 rounded-[1.15rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f7_100%)] px-3 py-3">
      {page.sections.slice(0, 8).map((section, index) => {
        const mapping = resolveMappingForSection(page, section);
        const assessment = mapping
          ? page.section_assessments.find((item) => item.mapping_id === mapping.id) ?? null
          : null;
        const tone =
          assessment?.overall_status === "healthy"
            ? "bg-emerald-300/85"
            : assessment?.overall_status === "needs-attention"
              ? "bg-rose-300/90"
              : "bg-sky-300/85";
        const active = activeSectionId ? sectionIdentity(section) === activeSectionId : false;
        const height = 34 + (((index % 4) + 1) * 10);
        return (
          <div
            key={`${page.id}-${section.id ?? section.section_order}`}
            className={`flex-1 rounded-t-md ${tone} ${active ? "ring-2 ring-[#0D5E6D] ring-offset-2 ring-offset-white" : ""}`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function SectionStructurePreview({ section }: { section: SiteContentSection }) {
  const baseCard = "rounded-[0.9rem] border border-slate-200 bg-white p-3";

  if (section.image_count >= 3) {
    return (
      <div className={`${baseCard} space-y-2`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Gallery block</span>
          <ImageIcon className="h-3.5 w-3.5 text-[#0D5E6D]" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-10 rounded-md bg-sky-100" />
          <div className="h-10 rounded-md bg-sky-100" />
          <div className="h-10 rounded-md bg-sky-100" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 w-4/5 rounded-full bg-slate-200" />
          <div className="h-2.5 w-3/5 rounded-full bg-slate-200" />
        </div>
      </div>
    );
  }

  if (section.image_count >= 1 && section.media_side === "left") {
    return (
      <div className={`${baseCard} space-y-2`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Image left</span>
          <ImageIcon className="h-3.5 w-3.5 text-[#0D5E6D]" />
        </div>
        <div className="grid grid-cols-[0.65fr_1fr] gap-2">
          <div className="h-14 rounded-lg bg-sky-100" />
          <div className="space-y-1.5 pt-1">
            <div className="h-2.5 w-11/12 rounded-full bg-slate-200" />
            <div className="h-2.5 w-4/5 rounded-full bg-slate-200" />
            <div className="h-2.5 w-3/5 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (section.image_count >= 1 && section.media_side === "right") {
    return (
      <div className={`${baseCard} space-y-2`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Image right</span>
          <ImageIcon className="h-3.5 w-3.5 text-[#0D5E6D]" />
        </div>
        <div className="grid grid-cols-[1fr_0.65fr] gap-2">
          <div className="space-y-1.5 pt-1">
            <div className="h-2.5 w-11/12 rounded-full bg-slate-200" />
            <div className="h-2.5 w-4/5 rounded-full bg-slate-200" />
            <div className="h-2.5 w-3/5 rounded-full bg-slate-200" />
          </div>
          <div className="h-14 rounded-lg bg-sky-100" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${baseCard} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Text block</span>
        <Type className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="space-y-1.5 pt-1">
        <div className="h-3 w-10/12 rounded-full bg-slate-200" />
        <div className="h-2.5 w-full rounded-full bg-slate-200" />
        <div className="h-2.5 w-11/12 rounded-full bg-slate-200" />
        <div className="h-2.5 w-8/12 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function PagePositionDiagram({
  totalSections,
  activeIndex,
}: {
  totalSections: number;
  activeIndex: number;
}) {
  const slots = Math.max(totalSections, 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Page position</p>
        <p className="text-xs text-slate-500">{activeIndex + 1} of {totalSections}</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {Array.from({ length: slots }).map((_, index) => {
          const isActive = index === activeIndex;
          return (
            <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-full transition-all ${
                  isActive ? "h-4 bg-[#0D5E6D]" : "h-2.5 bg-slate-200"
                }`}
              />
              <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                isActive ? "text-[#0D5E6D]" : "text-slate-400"
              }`}>
                {sectionPositionShortLabel(index, slots)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionMediaTile({ section }: { section: SiteContentSection }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Visual cue</p>
      <div className="mt-3 flex min-h-[96px] items-center justify-center rounded-[1rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#edf7f8_100%)]">
        <div className="text-center">
          <p className="text-3xl tracking-[0.35em] text-[#0D5E6D]">{sectionMediaGlyph(section)}</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{sectionMediaLabel(section)}</p>
          <p className="mt-1 text-xs text-slate-500">{sectionMediaDetail(section)}</p>
        </div>
      </div>
    </div>
  );
}

function renderSectionAssessmentPill(assessment: SiteContentSectionAssessment | null) {
  const tone = assessment ? toneForPosture(assessment.overall_status) : toneForPosture("watch");
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone.badge}`}>
      {(assessment?.overall_status ?? "watch").replace("-", " ")}
    </span>
  );
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

function SimpleHeroTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
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

function WorkbenchStep({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D5E6D] text-sm font-bold text-white">
          {step}
        </span>
        <p className="font-semibold text-slate-900">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function DrawerCueTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold capitalize text-slate-900">{value}</p>
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
