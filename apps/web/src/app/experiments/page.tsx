"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction, getOfferingActionRole, getRoleTitle } from "@/lib/permissions";
import {
  createEdgeExperimentDraft,
  generateEdgeExperimentDryRun,
  getCommunities,
  getEdgeExperiment,
  getEdgeExperiments,
  getSiteContentInventory,
  getSiteContentProperty,
  prepareSiteContentExperimentContract,
  prepareSpecsExperimentContract,
  requestEdgeExperimentPreflight,
  type Community,
  type CreateEdgeExperimentDraftInput,
  type EdgeExperiment,
  type EdgeExperimentChangeType,
  type EdgeExperimentComponentContract,
  type EdgeExperimentDetailResponse,
  type EdgeExperimentReadiness,
  type EdgeExperimentVariant,
  type SiteContentPage,
  type SiteContentPropertySummary,
  type SiteContentSection,
  type SiteContentSectionAssessment,
  type SiteContentSectionMapping,
} from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Loader2,
  Lock,
  MousePointerClick,
  PauseCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const CHANGE_TYPE_LABELS: Record<EdgeExperimentChangeType, string> = {
  text_swap: "Text swap",
  class_swap: "Class swap",
  href_swap: "Link swap",
  insert_adjacent: "Adjacent CTA",
};

const PRIMARY_METRICS = [
  "tour_click_rate",
  "floorplan_click_rate",
  "apply_click_rate",
  "guest_card_start_rate",
  "guest_card_submit_rate",
];

type SiteContentEligibleItem = {
  id: string;
  pageId: string;
  mappingId: string;
  label: string;
  pageType: string;
  pagePath: string;
  surface: "header" | "mobile_menu" | "page" | "footer";
  sourceKind: "specs" | "site_content";
  specTarget?: string;
  componentName?: string;
  action?: string;
  locationLabel: string;
  pageOrder: number;
  sectionOrder: number | null;
  targetOrder: number;
  pageSectionCount: number;
  pageMapSections: Array<{
    id: string;
    label: string;
    order: number;
  }>;
  matchStatus: SiteContentSectionMapping["match_status"];
  assessmentStatus: SiteContentSectionAssessment["overall_status"] | "not_assessed";
  allowedChanges: EdgeExperimentChangeType[];
  ctaLabels: string[];
  linkCount: number;
  targetLabel: string;
  sectionLabel: string;
  source: string;
  note: string;
};

type IntentKey = "all" | "tour" | "apply" | "floorplans" | "navigation" | "trust" | "resident";

const HUMAN_CHANGE_LABELS: Record<EdgeExperimentChangeType, string> = {
  text_swap: "Try different wording",
  class_swap: "Try a different visual style",
  href_swap: "Send the button somewhere else",
  insert_adjacent: "Add a second button",
};

const SPECS_EXPERIENCE_TARGETS: Array<{
  surface: SiteContentEligibleItem["surface"];
  specTarget: string;
  componentName: string;
  targetLabel: string;
  sectionLabel: string;
  locationLabel: string;
  pageType: string;
  pagePath: string;
  pageOrder: number;
  sectionOrder: number | null;
  targetOrder: number;
  action?: string;
  allowedChanges: EdgeExperimentChangeType[];
}> = [
  ["header", "nav-primary", "cta_office_phone", "Office Phone", "Primary header", "Global Header", "global_header", "/__global/header", -30, 1, 1, "initiate_phone_call", ["href_swap", "text_swap"]],
  ["header", "nav-primary", "cta_apply_now", "Apply Now", "Primary header", "Global Header", "global_header", "/__global/header", -30, 1, 2, "navigate_prospect_portal", ["text_swap", "href_swap"]],
  ["header", "nav-primary", "cta_schedule_tour", "Schedule A Tour", "Primary header", "Global Header", "global_header", "/__global/header", -30, 1, 3, "navigate_prospect_portal", ["text_swap", "href_swap"]],
  ["header", "nav-primary", "open_expanded_navigation", "Menu", "Primary header", "Global Header", "global_header", "/__global/header", -30, 1, 4, "open_expanded_navigation", ["class_swap", "text_swap"]],
  ["mobile_menu", "nav-mobile-menu", "apartments_and_pricing", "Apartments and Pricing", "Expanded navigation", "Mobile Menu", "mobile_navigation", "/__global/mobile-menu", -20, 1, 1, "navigate_apartments", ["text_swap", "href_swap"]],
  ["mobile_menu", "nav-mobile-menu", "cta_schedule_tour", "Schedule A Tour", "Expanded navigation", "Mobile Menu", "mobile_navigation", "/__global/mobile-menu", -20, 1, 12, "navigate_prospect_portal", ["text_swap", "href_swap"]],
  ["mobile_menu", "nav-mobile-menu", "cta_apply_now", "Apply Now", "Expanded navigation", "Mobile Menu", "mobile_navigation", "/__global/mobile-menu", -20, 1, 13, "navigate_prospect_portal", ["text_swap", "href_swap"]],
  ["page", "homepage", "find_your_home", "Find Your Home", "Hero", "Homepage Hero", "homepage", "/", 0, 2, 1, "navigate_apartments", ["text_swap", "href_swap", "insert_adjacent"]],
  ["footer", "footer-primary", "cta_apply_now", "Apply Now", "Primary footer", "Global Footer", "global_footer", "/__global/footer", 99, 1, 1, "navigate_prospect_portal", ["text_swap", "href_swap"]],
  ["footer", "footer-primary", "send_a_message", "Send A Message", "Primary footer", "Global Footer", "global_footer", "/__global/footer", 99, 1, 2, "navigate_contact", ["text_swap", "href_swap"]],
].map(([surface, specTarget, componentName, targetLabel, sectionLabel, locationLabel, pageType, pagePath, pageOrder, sectionOrder, targetOrder, action, allowedChanges]) => ({
  surface: surface as SiteContentEligibleItem["surface"],
  specTarget: String(specTarget),
  componentName: String(componentName),
  targetLabel: String(targetLabel),
  sectionLabel: String(sectionLabel),
  locationLabel: String(locationLabel),
  pageType: String(pageType),
  pagePath: String(pagePath),
  pageOrder: Number(pageOrder),
  sectionOrder: Number(sectionOrder),
  targetOrder: Number(targetOrder),
  action: String(action),
  allowedChanges: allowedChanges as EdgeExperimentChangeType[],
}));

const INTENT_OPTIONS: Array<{ key: IntentKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "tour", label: "Tour intent" },
  { key: "apply", label: "Apply intent" },
  { key: "floorplans", label: "Floorplan path" },
  { key: "navigation", label: "Navigation" },
  { key: "trust", label: "Trust" },
  { key: "resident", label: "Resident utility" },
];

function statusTone(status: EdgeExperiment["status"]): string {
  if (status === "draft") return "border-slate-200 bg-slate-50 text-slate-700";
  if (["approved", "scheduled", "running"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["paused", "pending_preflight", "ready_for_approval"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["preflight_failed", "rolled_back", "rejected"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

function readinessTone(status: EdgeExperimentReadiness["status"]): string {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "fail") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatTitle(value: string): string {
  return formatLabel(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeExperimentLookup(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => (part.length > 3 && part.endsWith("s") ? part.slice(0, -1) : part))
    .join(" ");
}

function slugifyLookup(value: string | null | undefined): string {
  return normalizeExperimentLookup(value).replace(/\s+/g, "-");
}

function humanPageName(pageType: string, pagePath: string): string {
  if (pagePath === "/" || pageType === "homepage") return "Homepage";
  if (pageType === "floor-plans") return "Floor Plans";
  return formatTitle(pageType || pagePath);
}

function siteContentPageOrder(page: Pick<SiteContentPage, "page_type" | "page_path" | "spec_order">): number {
  if (typeof page.spec_order === "number") return page.spec_order;
  if (page.page_path === "/" || page.page_type === "homepage") return 0;
  if (page.page_type === "amenities") return 1;
  if (page.page_type === "floor-plans") return 2;
  if (page.page_type === "neighborhood") return 3;
  if (page.page_type === "gallery") return 4;
  if (page.page_type === "contact") return 5;
  return 9;
}

function humanReadiness(item: SiteContentEligibleItem): { label: string; tone: string } {
  if (item.sourceKind === "specs") {
    return { label: "Specs governed", tone: "border-indigo-200 bg-indigo-50 text-indigo-800" };
  }
  if (item.matchStatus === "matched" && item.assessmentStatus === "healthy") {
    return { label: "Ready to promote", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }
  if (item.matchStatus === "matched") {
    return { label: "Usable with review", tone: "border-cyan-200 bg-cyan-50 text-cyan-800" };
  }
  return { label: "Needs review", tone: "border-amber-200 bg-amber-50 text-amber-800" };
}

function pageLocationLabel(item: SiteContentEligibleItem): string {
  if (item.surface === "header") return "Global header";
  if (item.surface === "mobile_menu") return "Mobile menu";
  if (item.surface === "footer") return "Global footer";
  if (!item.sectionOrder || item.pageSectionCount <= 1) return "Page location";
  const ordered = [...item.pageMapSections].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((section) => section.order === item.sectionOrder);
  const ratio = index >= 0 ? index / Math.max(ordered.length - 1, 1) : 0;
  const zone = ratio < 0.34 ? "Upper page" : ratio < 0.67 ? "Middle page" : "Lower page";
  return `${zone} · section ${index + 1 || item.sectionOrder} of ${ordered.length || item.pageSectionCount}`;
}

function compactSectionLabel(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 34) return cleaned;
  return `${cleaned.slice(0, 31).trim()}...`;
}

function surfaceTitle(surface: SiteContentEligibleItem["surface"]): string {
  if (surface === "header") return "Header";
  if (surface === "mobile_menu") return "Mobile Menu";
  if (surface === "footer") return "Footer";
  return "Pages";
}

function itemIntent(item: SiteContentEligibleItem): IntentKey {
  const haystack = `${item.targetLabel} ${item.action ?? ""} ${item.componentName ?? ""} ${item.sectionLabel}`.toLowerCase();
  if (haystack.includes("tour")) return "tour";
  if (haystack.includes("apply")) return "apply";
  if (haystack.includes("apartment") || haystack.includes("floor") || haystack.includes("home")) return "floorplans";
  if (haystack.includes("review") || haystack.includes("rating")) return "trust";
  if (haystack.includes("resident") || haystack.includes("smarthub")) return "resident";
  if (item.surface === "header" || item.surface === "mobile_menu" || haystack.includes("menu") || haystack.includes("navigation")) return "navigation";
  return "navigation";
}

function readinessSignals(item: SiteContentEligibleItem): Array<{ label: string; status: "pass" | "watch" | "queued" }> {
  const liveSeen = item.sourceKind === "site_content";
  return [
    { label: "Specs expected", status: item.sourceKind === "specs" || item.matchStatus === "matched" ? "pass" : "watch" },
    { label: "Seen live", status: liveSeen ? "pass" : "queued" },
    { label: "Selector ready", status: liveSeen ? "pass" : "queued" },
    { label: "EVS proof", status: "queued" },
    { label: "Draft safe", status: item.allowedChanges.length > 0 ? "pass" : "watch" },
  ];
}

function readinessSignalTone(status: "pass" | "watch" | "queued"): string {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-white text-slate-500";
}

function suggestedTestIdeas(item: SiteContentEligibleItem): string[] {
  const label = item.targetLabel.toLowerCase();
  if (label.includes("schedule") || label.includes("tour")) {
    return ["Clarify tour value", "Test softer phrasing", "Route to best tour path"];
  }
  if (label.includes("apply")) {
    return ["Reduce commitment anxiety", "Clarify application intent", "Test high-intent emphasis"];
  }
  if (label.includes("home") || label.includes("apartment") || label.includes("floor")) {
    return ["Make floorplans easier to find", "Test availability-focused wording", "Add a secondary tour path"];
  }
  if (label.includes("review") || label.includes("rating")) {
    return ["Surface trust earlier", "Test review-proof wording", "Route to reputation proof"];
  }
  if (item.surface === "mobile_menu") {
    return ["Improve mobile path clarity", "Reorder high-intent links", "Highlight the next best action"];
  }
  return ["Try clearer wording", "Test destination clarity", "Compare visual emphasis"];
}

function journeyKey(item: SiteContentEligibleItem): string {
  return normalizeExperimentLookup(item.targetLabel || item.componentName || item.id);
}

function journeyGroups(items: SiteContentEligibleItem[]): Array<{ key: string; label: string; items: SiteContentEligibleItem[] }> {
  const groups = new Map<string, SiteContentEligibleItem[]>();
  for (const item of items) {
    const key = journeyKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups.entries())
    .map(([key, groupItems]) => ({
      key,
      label: groupItems[0]?.targetLabel ?? key,
      items: sortEligibleItems(groupItems),
    }))
    .filter((group) => group.items.length > 1)
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
}

function safeHostname(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function defaultPathForCommunity(community: Community | null): string {
  if (!community?.full_url) return "/";
  try {
    return new URL(community.full_url).pathname || "/";
  } catch {
    return "/";
  }
}

function pathSlugFromUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    return slugifyLookup(parts[parts.length - 1] ?? "");
  } catch {
    return "";
  }
}

function siteContentPropertyMatchesCommunity(property: SiteContentPropertySummary, community: Community): boolean {
  const communityKeys = new Set(
    [
      community.name,
      community.encasa_property_code,
      pathSlugFromUrl(community.full_url),
      slugifyLookup(community.name),
    ]
      .map(normalizeExperimentLookup)
      .filter(Boolean)
  );
  const siteContentKeys = [
    property.property_id,
    property.property_name,
    property.live_url,
    property.revised_url,
    pathSlugFromUrl(property.live_url),
    pathSlugFromUrl(property.revised_url),
    slugifyLookup(property.property_name),
  ]
    .map(normalizeExperimentLookup)
    .filter(Boolean);

  return siteContentKeys.some((key) => communityKeys.has(key));
}

function findSiteContentPropertyForCommunity(
  community: Community | null,
  capturedProperties: SiteContentPropertySummary[]
): SiteContentPropertySummary | null {
  if (!community) return null;
  return capturedProperties.find((property) => siteContentPropertyMatchesCommunity(property, community)) ?? null;
}

function findCommunityForSiteContentProperty(
  property: SiteContentPropertySummary,
  communities: Community[]
): Community | null {
  return communities.find((community) => siteContentPropertyMatchesCommunity(property, community)) ?? null;
}

function buildSiteContentLookupKeys(
  community: Community,
  capturedProperties: SiteContentPropertySummary[]
): string[] {
  const matchedProperty = findSiteContentPropertyForCommunity(community, capturedProperties);
  return Array.from(
    new Set(
      [
        matchedProperty?.property_id,
        matchedProperty?.property_name,
        community.encasa_property_code,
        community.name,
        slugifyLookup(community.name),
        pathSlugFromUrl(community.full_url),
      ]
        .filter((item): item is string => Boolean(item))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function summarizeVariant(variant: EdgeExperimentVariant): string {
  if (variant.action === "none") return "Original page";
  const payload = variant.payload_json;
  if (variant.action === "text_swap") return String(payload.text ?? "Text change");
  if (variant.action === "class_swap") return String(payload.class_name ?? "Class change");
  if (variant.action === "href_swap") return String(payload.href ?? "Link change");
  return `${String(payload.text ?? "New CTA")} -> ${String(payload.href ?? "target")}`;
}

function proofChecklist(detail: EdgeExperimentDetailResponse) {
  const evidence = detail.latest_preflight?.evidence;
  const rawChecklist = evidence && Array.isArray(evidence.checklist) ? evidence.checklist : [];
  const fromEvidence = rawChecklist
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as { label?: unknown; status?: unknown; detail?: unknown };
      return {
        label: String(record.label ?? "Proof item"),
        status: String(record.status ?? "queued"),
        detail: record.detail ? String(record.detail) : undefined,
      };
    })
    .filter(Boolean) as Array<{ label: string; status: string; detail?: string }>;

  if (fromEvidence.length > 0) return fromEvidence;
  return [
    { label: "Page found", status: detail.experiment.page_path ? "pass" : "queued", detail: detail.experiment.page_path },
    { label: "Component found", status: detail.component_contract ? "pass" : "queued", detail: detail.component_contract?.selector },
    { label: "Change is safe", status: detail.experiment.variants.some((variant) => variant.variant_key !== "control") ? "pass" : "queued" },
    { label: "Mobile proof", status: "queued", detail: "EVS required" },
    { label: "Desktop proof", status: "queued", detail: "EVS required" },
    { label: "Metrics ready", status: detail.experiment.primary_metric ? "pass" : "queued", detail: formatLabel(detail.experiment.primary_metric) },
    { label: "Rollback ready", status: detail.experiment.rollback_owner ? "pass" : "queued", detail: detail.experiment.rollback_owner ?? undefined },
  ];
}

function proofTone(status: string): string {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "fail") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function componentDisplayName(componentId: string): string {
  const [, componentName = componentId] = componentId.split(".");
  return componentName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function contractDisplayName(contract: EdgeExperimentComponentContract): string {
  if (contract.source === "site_content_section_mapping" && contract.source_reference) {
    try {
      const parsed = JSON.parse(contract.source_reference);
      if (parsed && typeof parsed === "object" && "display_name" in parsed) {
        const displayName = String((parsed as { display_name?: unknown }).display_name ?? "").trim();
        if (displayName) return displayName;
      }
    } catch {
      // fall through to component id formatting
    }
  }
  return componentDisplayName(contract.component_id);
}

function isSiteContentCtaCandidate(mapping: SiteContentSectionMapping, section: SiteContentSection | null): boolean {
  const haystack = [
    mapping.expected_section_key,
    mapping.expected_section_label,
    mapping.expected_section_role,
    section?.section_key,
    section?.section_label,
    section?.section_type,
    section?.heading,
    section?.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    (section?.link_count ?? 0) > 0 ||
    haystack.includes("cta") ||
    haystack.includes("hero") ||
    haystack.includes("tour") ||
    haystack.includes("floor")
  );
}

function inferSiteContentCtaLabels(mapping: SiteContentSectionMapping, section: SiteContentSection | null): string[] {
  const key = `${mapping.expected_section_key ?? ""} ${mapping.expected_section_label ?? ""} ${mapping.expected_section_role ?? ""}`.toLowerCase();
  const source = [section?.title, section?.subtitle, section?.original_copy, mapping.expected_section_label]
    .filter((item): item is string => Boolean(item))
    .join(" ");
  const normalizedSource = source.toLowerCase();

  if (key.includes("apartment-features")) return ["See Features"];
  if (key.includes("amenities-proof")) return ["See Amenities"];
  if (key.includes("intro") || key.includes("welcome")) return ["See Available Homes"];
  if (normalizedSource.includes("we don’t just allow pets") || normalizedSource.includes("we don't just allow pets")) {
    return ["See Our Pet-Friendly Details"];
  }
  if (normalizedSource.includes("tech-enabled communities") || normalizedSource.includes("smart communities. seamless living.")) {
    return ["See A Day of High-Tech Living"];
  }

  const found = Array.from(
    new Set(
      (source.match(
        /\b(schedule a tour|apply now|contact us|find your home|view floor plans|see amenities|read more reviews|see available homes|book a tour|check availability|see features)\b/gi
      ) ?? []).map((item) => item.replace(/\s+/g, " ").trim())
    )
  );
  if (found.length > 0) return found.map((item) => item.replace(/\b\w/g, (char) => char.toUpperCase()));
  if (section?.link_count && section.link_count > 1) return ["Learn More", "Schedule a Tour"];
  if (section?.link_count || mapping.expected_section_key?.includes("cta") || section?.section_type === "cta") return ["Schedule a Tour"];
  return [];
}

function deriveSpecsEligibleItems(): SiteContentEligibleItem[] {
  return SPECS_EXPERIENCE_TARGETS.map((target): SiteContentEligibleItem => ({
    id: `specs:${target.specTarget}:${target.componentName}`,
    pageId: target.specTarget,
    mappingId: target.componentName,
    label: target.targetLabel,
    pageType: target.pageType,
    pagePath: target.pagePath,
    surface: target.surface,
    sourceKind: "specs",
    specTarget: target.specTarget,
    componentName: target.componentName,
    action: target.action,
    locationLabel: target.locationLabel,
    pageOrder: target.pageOrder,
    sectionOrder: target.sectionOrder,
    targetOrder: target.targetOrder,
    pageSectionCount: 1,
    pageMapSections: [{ id: `${target.specTarget}:${target.sectionLabel}`, label: target.sectionLabel, order: target.sectionOrder ?? 1 }],
    matchStatus: "matched",
    assessmentStatus: "not_assessed",
    allowedChanges: target.allowedChanges,
    ctaLabels: [target.targetLabel],
    linkCount: 1,
    targetLabel: target.targetLabel,
    sectionLabel: target.sectionLabel,
    source: "Specs contract",
    note: `${target.locationLabel}; Specs-defined action ${target.action ?? target.componentName}.`,
  }));
}

function sortEligibleItems(items: SiteContentEligibleItem[]): SiteContentEligibleItem[] {
  return [...items].sort((a, b) => {
    const sectionA = a.sectionOrder ?? Number.MAX_SAFE_INTEGER;
    const sectionB = b.sectionOrder ?? Number.MAX_SAFE_INTEGER;
    return (
      a.pageOrder - b.pageOrder ||
      sectionA - sectionB ||
      a.targetOrder - b.targetOrder ||
      a.targetLabel.localeCompare(b.targetLabel)
    );
  });
}

function deriveSiteContentEligibleItems(pages: SiteContentPage[]): SiteContentEligibleItem[] {
  const items = [...pages]
    .sort((a, b) => siteContentPageOrder(a) - siteContentPageOrder(b) || (a.page_path ?? "").localeCompare(b.page_path ?? ""))
    .flatMap((page) => {
    const sectionById = new Map(page.sections.map((section) => [section.id ?? "", section]));
    const assessmentByMappingId = new Map(page.section_assessments.map((assessment) => [assessment.mapping_id, assessment]));
    const pageMapSections = [...page.sections]
      .sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0))
      .map((section, index) => ({
        id: section.id ?? `${page.id}:section:${index}`,
        label:
          section.title ||
          section.heading ||
          section.section_label ||
          section.section_key ||
          `Section ${index + 1}`,
        order: section.section_order ?? index + 1,
      }));

    return page.section_mappings
      .filter((mapping) => mapping.match_status === "matched" || mapping.match_status === "partial")
      .sort((a, b) => {
        const sectionA = a.section_id ? sectionById.get(a.section_id) ?? null : null;
        const sectionB = b.section_id ? sectionById.get(b.section_id) ?? null : null;
        const orderA = sectionA?.section_order ?? a.expected_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = sectionB?.section_order ?? b.expected_order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB || (a.expected_order ?? 0) - (b.expected_order ?? 0);
      })
      .flatMap((mapping) => {
        const section = mapping.section_id ? sectionById.get(mapping.section_id) ?? null : null;
        const assessment = assessmentByMappingId.get(mapping.id) ?? null;
        const isCta = isSiteContentCtaCandidate(mapping, section);
        const ctaLabels = inferSiteContentCtaLabels(mapping, section);
        const allowedChanges: EdgeExperimentChangeType[] = isCta
          ? ["text_swap", "href_swap", "insert_adjacent"]
          : ["text_swap"];
        const label =
          section?.title ||
          section?.heading ||
          section?.section_label ||
          mapping.expected_section_label ||
          mapping.expected_section_key ||
          "Mapped section";
        const targets = isCta && ctaLabels.length > 0 ? ctaLabels : [label];

        return targets.map((targetLabel, targetIndex): SiteContentEligibleItem => ({
          id: `${mapping.id}:${targetLabel}`,
          pageId: page.id,
          mappingId: mapping.id,
          label: isCta ? targetLabel : label,
          pageType: page.page_type ?? "page",
          pagePath: page.page_path ?? "/",
          surface: "page",
          sourceKind: "site_content",
          locationLabel: humanPageName(page.page_type ?? "page", page.page_path ?? "/"),
          pageOrder: siteContentPageOrder(page),
          sectionOrder: section?.section_order ?? mapping.expected_order ?? null,
          targetOrder: targetIndex,
          pageSectionCount: pageMapSections.length,
          pageMapSections,
          matchStatus: mapping.match_status,
          assessmentStatus: assessment?.overall_status ?? "not_assessed",
          allowedChanges,
          ctaLabels,
          linkCount: section?.link_count ?? 0,
          targetLabel,
          sectionLabel: label,
          source: "Site Content section mapping",
          note: isCta
            ? `${label} CTA; eligible for copy/link CTA experiment promotion.`
            : "Content section; eligible for copy experiment promotion.",
        }));
      });
  });
  return sortEligibleItems(items);
}

export default function ExperimentLabPage() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = React.useState<Awaited<ReturnType<typeof getEdgeExperiments>> | null>(null);
  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [capturedSiteContentProperties, setCapturedSiteContentProperties] = React.useState<SiteContentPropertySummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = React.useState<EdgeExperimentDetailResponse | null>(null);
  const [siteContentEligibleItems, setSiteContentEligibleItems] = React.useState<SiteContentEligibleItem[]>([]);
  const [siteContentStatus, setSiteContentStatus] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [preparingItemId, setPreparingItemId] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "Homepage hero CTA proof",
    property_id: "",
    component_id: "",
    change_type: "insert_adjacent" as EdgeExperimentChangeType,
    primary_metric: "floorplan_click_rate",
    hypothesis: "Adding a clearer floor plans path beside the tour CTA will increase qualified exploration without hurting tour intent.",
    variant_text: "View Floor Plans",
    variant_href: "",
    variant_class: "uk-button uk-button-secondary",
    rollback_owner: user?.email ?? "",
  });

  const canDraft = canPerformOfferingAction(user?.role, "experiments", "draft");
  const draftRoleTitle = getRoleTitle(getOfferingActionRole("experiments", "draft"));

  const selectedCommunity = communities.find((community) => community.id === form.property_id) ?? null;
  const selectedContract = workspace?.component_contracts.find((contract) => contract.component_id === form.component_id) ?? null;
  const propertyOptions = communities.filter((community) => community.encasa_property_code && community.full_url);
  const componentOptions = workspace?.component_contracts ?? [];
  const capturedCommunityIds = new Set(
    capturedSiteContentProperties
      .map((property) => findCommunityForSiteContentProperty(property, communities)?.id)
      .filter((id): id is string => Boolean(id))
  );

  const loadWorkspace = React.useCallback(async () => {
    const [experimentPayload, communityPayload, siteContentInventory] = await Promise.all([
      getEdgeExperiments(),
      getCommunities(),
      getSiteContentInventory(),
    ]);
    setWorkspace(experimentPayload);
    setCommunities(communityPayload);
    const capturedProperties = siteContentInventory.properties.filter((property) => property.page_count > 0);
    setCapturedSiteContentProperties(capturedProperties);
    const currentPilotProperty =
      capturedProperties.find((property) => property.property_id === "champions-green") ?? capturedProperties[0] ?? null;
    const currentPilotCommunity = currentPilotProperty
      ? findCommunityForSiteContentProperty(currentPilotProperty, communityPayload)
      : null;
    const firstCapturedProperty = capturedProperties
      .map((property) => findCommunityForSiteContentProperty(property, communityPayload))
      .find((community): community is Community => Boolean(community));
    const firstProperty =
      currentPilotCommunity ??
      firstCapturedProperty ??
      communityPayload.find((community) => community.encasa_property_code && community.full_url);
    const firstContract = experimentPayload.component_contracts[0];
    setForm((current) => ({
      ...current,
      property_id: current.property_id || firstProperty?.id || "",
      component_id: current.component_id || firstContract?.component_id || "",
      variant_href: current.variant_href || (firstProperty?.full_url ? `${defaultPathForCommunity(firstProperty)}floorplans/` : "/floorplans/"),
      rollback_owner: current.rollback_owner || user?.email || "",
    }));
    if (!selectedId && experimentPayload.experiments[0]) {
      setSelectedId(experimentPayload.experiments[0].experiment_id);
    }
  }, [selectedId, user?.email]);

  React.useEffect(() => {
    loadWorkspace()
      .then(() => setError(null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Experiment Lab"))
      .finally(() => setLoading(false));
  }, [loadWorkspace]);

  React.useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    setLoadingDetail(true);
    getEdgeExperiment(selectedId)
      .then(setSelectedDetail)
      .catch((err) => setStatusMessage(err instanceof Error ? err.message : "Failed to load experiment"))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  React.useEffect(() => {
    if (!selectedCommunity) return;
    const nextHref = `${defaultPathForCommunity(selectedCommunity).replace(/\/$/, "")}/floorplans/`;
    setForm((current) => ({
      ...current,
      variant_href: current.variant_href || nextHref,
    }));
  }, [selectedCommunity]);

  React.useEffect(() => {
    if (!selectedContract) return;
    if (!selectedContract.allowed_change_types.includes(form.change_type)) {
      setForm((current) => ({
        ...current,
        change_type: selectedContract.allowed_change_types[0] ?? "text_swap",
      }));
    }
  }, [form.change_type, selectedContract]);

  React.useEffect(() => {
    if (!selectedCommunity) {
      setSiteContentEligibleItems([]);
      setSiteContentStatus(null);
      return;
    }

    let cancelled = false;
    const lookupKeys = buildSiteContentLookupKeys(selectedCommunity, capturedSiteContentProperties);
    const specsItems = deriveSpecsEligibleItems();
    setSiteContentStatus("Loading Site Content sections...");

    async function loadSiteContentEligibility() {
      for (const key of lookupKeys) {
        try {
          const payload = await getSiteContentProperty(key);
          if (cancelled) return;
          const items = sortEligibleItems([...specsItems, ...deriveSiteContentEligibleItems(payload.pages)]);
          setSiteContentEligibleItems(items);
          setSiteContentStatus(items.length ? null : "Specs and Site Content are available, but no eligible targets are ready yet.");
          return;
        } catch {
          // try the next identity key
        }
      }

      if (!cancelled) {
        setSiteContentEligibleItems(specsItems);
        setSiteContentStatus(null);
      }
    }

    void loadSiteContentEligibility();

    return () => {
      cancelled = true;
    };
  }, [capturedSiteContentProperties, selectedCommunity]);

  const handleSelectCapturedSiteContentProperty = React.useCallback(
    (property: SiteContentPropertySummary) => {
      const community = findCommunityForSiteContentProperty(property, communities);
      if (!community) {
        setStatusMessage(`${property.property_name} has Site Content inventory, but it is not linked to a Data Pond community yet.`);
        return;
      }
      setForm((current) => ({
        ...current,
        property_id: community.id,
        variant_href: `${defaultPathForCommunity(community).replace(/\/$/, "")}/floorplans/`,
      }));
      setStatusMessage(`Switched to ${community.name}; loading captured Site Content opportunities.`);
    },
    [communities]
  );

  const handleCreateDraft = async () => {
    if (!selectedCommunity?.encasa_property_code) {
      setStatusMessage("Select a property with a governed property code.");
      return;
    }
    if (!selectedContract) {
      setStatusMessage("Select a governed component contract.");
      return;
    }
    if (!form.hypothesis.trim() || !form.name.trim()) {
      setStatusMessage("Name and hypothesis are required.");
      return;
    }

    const variantPayload: CreateEdgeExperimentDraftInput["variant"]["payload"] = {};
    if (form.change_type === "text_swap") variantPayload.text = form.variant_text.trim();
    if (form.change_type === "class_swap") variantPayload.class_name = form.variant_class.trim();
    if (form.change_type === "href_swap") variantPayload.href = form.variant_href.trim();
    if (form.change_type === "insert_adjacent") {
      variantPayload.tag = "a";
      variantPayload.position = "after";
      variantPayload.text = form.variant_text.trim();
      variantPayload.href = form.variant_href.trim();
      variantPayload.class_name = form.variant_class.trim();
    }

    setSubmitting(true);
    try {
      const payload = await createEdgeExperimentDraft({
        name: form.name.trim(),
        hypothesis: form.hypothesis.trim(),
        property_code: selectedCommunity.encasa_property_code,
        community_id: selectedCommunity.id,
        website_host: safeHostname(selectedCommunity.full_url),
        page_type: selectedContract.page_type,
        page_path: selectedContract.page_path ?? defaultPathForCommunity(selectedCommunity),
        component_id: selectedContract.component_id,
        change_type: form.change_type,
        primary_metric: form.primary_metric,
        guardrail_policy_id: "mvp_default_guardrails",
        traffic_split_pct: 50,
        assignment_unit: "anonymous_visitor",
        rollback_owner: form.rollback_owner.trim() || user?.email || undefined,
        variant: {
          variant_key: "B",
          action: form.change_type,
          payload: variantPayload,
        },
      });
      setStatusMessage("Experiment draft created. It is intentionally locked from launch until Worker dry-run and EVS proof exist.");
      setSelectedId(payload.experiment.experiment_id);
      setSelectedDetail(payload);
      await loadWorkspace();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to create experiment draft");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrepareSiteContentItem = async (item: SiteContentEligibleItem) => {
    if (!selectedCommunity?.encasa_property_code) {
      setStatusMessage("Select a property with a governed property code.");
      return;
    }
    setPreparingItemId(item.id);
    try {
      const prepared = item.sourceKind === "specs"
        ? await prepareSpecsExperimentContract({
            property_code: selectedCommunity.encasa_property_code,
            community_id: selectedCommunity.id,
            website_host: safeHostname(selectedCommunity.full_url),
            surface: item.surface,
            spec_target: item.specTarget ?? item.pageId,
            component_name: item.componentName ?? item.mappingId,
            display_name: item.label,
            target_label: item.targetLabel,
            page_type: item.pageType,
            page_path: item.pagePath,
            section_label: item.sectionLabel,
            location_label: item.locationLabel,
            action: item.action,
            suggested_change_type: item.allowedChanges[0] ?? "text_swap",
          })
        : await prepareSiteContentExperimentContract({
            property_code: selectedCommunity.encasa_property_code,
            community_id: selectedCommunity.id,
            website_host: safeHostname(selectedCommunity.full_url),
            site_content_page_id: item.pageId,
            site_content_mapping_id: item.mappingId,
            display_name: item.label,
            target_label: item.targetLabel,
            suggested_change_type: item.allowedChanges[0] ?? "text_swap",
          });
      await loadWorkspace();
      setForm((current) => ({
        ...current,
        name: prepared.suggested_draft.name,
        component_id: prepared.component_contract.component_id,
        change_type: prepared.suggested_draft.change_type,
        primary_metric: prepared.suggested_draft.primary_metric,
        hypothesis: prepared.suggested_draft.hypothesis,
        variant_text: prepared.suggested_draft.variant_text,
        variant_href: prepared.suggested_draft.variant_href,
      }));
      setStatusMessage(`${item.targetLabel} is ready in the draft form.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to prepare item");
    } finally {
      setPreparingItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#15284B] text-white">
                <FlaskConical className="h-4 w-4" />
              </span>
              <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">Governed edge lane</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">Experiment Lab</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Draft small property-site tests from governed Data Pond identity and component contracts. Launch remains locked until Worker dry-run, EVS proof, Zaraz mapping, and approval gates are implemented.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Total" value={workspace?.summary.total ?? 0} />
            <MetricTile label="Drafts" value={workspace?.summary.draft ?? 0} />
            <MetricTile label="Active" value={workspace?.summary.active ?? 0} />
            <MetricTile label="Contracts" value={workspace?.summary.contracts ?? 0} />
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-cyan-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#15284B] text-white">
                <MousePointerClick className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">Edge Message Toolkit</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Transparent-pricing modal and all-in pricing coach-mark controls now have a dedicated Pond admin surface.</p>
              </div>
            </div>
            <Link
              href="/experiments/edge-messages"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-[#15284B] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#15284B]/35 hover:bg-slate-50 hover:shadow-md"
            >
              Open Edge Messages
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-5 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            {statusMessage}
          </div>
        )}

        <EligibleItemsPanel
          contracts={componentOptions}
          siteContentItems={siteContentEligibleItems}
          siteContentStatus={siteContentStatus}
          selectedPropertyName={selectedCommunity?.name ?? null}
          capturedSiteContentProperties={capturedSiteContentProperties}
          preparingItemId={preparingItemId}
          onPrepareItem={handlePrepareSiteContentItem}
          onRequestProof={(item) => {
            setStatusMessage(`${item.targetLabel} is ready for EVS target proof once a draft exists. Preflight will verify selector presence, click behavior, and mobile/desktop visibility before launch.`);
          }}
          onSelectCapturedProperty={handleSelectCapturedSiteContentProperty}
        />

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">Create Governed Draft</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Admin-only. Uses property identity and component contracts; no arbitrary selector editing.</p>
                  </div>
                  {!canDraft && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{draftRoleTitle}</Badge>}
                </div>

                <div className="space-y-4">
                  <Field label="Name">
                    <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!canDraft} />
                  </Field>

                  <Field label="Property">
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      value={form.property_id}
                      onChange={(event) => {
                        const community = communities.find((item) => item.id === event.target.value) ?? null;
                        setForm({
                          ...form,
                          property_id: event.target.value,
                          variant_href: community ? `${defaultPathForCommunity(community).replace(/\/$/, "")}/floorplans/` : form.variant_href,
                        });
                      }}
                      disabled={!canDraft}
                    >
                      {propertyOptions.map((community) => (
                        <option key={community.id} value={community.id}>
                          {community.name} {community.encasa_property_code ? `(${community.encasa_property_code})` : ""}
                          {capturedCommunityIds.has(community.id) ? " · Site Content captured" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Component">
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      value={form.component_id}
                      onChange={(event) => setForm({ ...form, component_id: event.target.value })}
                      disabled={!canDraft}
                    >
                      {componentOptions.map((contract) => (
                        <option key={contract.component_contract_id} value={contract.component_id}>
                          {contractDisplayName(contract)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Change">
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                        value={form.change_type}
                        onChange={(event) => setForm({ ...form, change_type: event.target.value as EdgeExperimentChangeType })}
                        disabled={!canDraft}
                      >
                        {(selectedContract?.allowed_change_types ?? ["text_swap"]).map((changeType) => (
                          <option key={changeType} value={changeType}>{CHANGE_TYPE_LABELS[changeType]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Metric">
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                        value={form.primary_metric}
                        onChange={(event) => setForm({ ...form, primary_metric: event.target.value })}
                        disabled={!canDraft}
                      >
                        {PRIMARY_METRICS.map((metric) => <option key={metric} value={metric}>{formatLabel(metric)}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Hypothesis">
                    <Textarea value={form.hypothesis} onChange={(event) => setForm({ ...form, hypothesis: event.target.value })} disabled={!canDraft} rows={4} />
                  </Field>

                  {(form.change_type === "text_swap" || form.change_type === "insert_adjacent") && (
                    <Field label="Variant text">
                      <Input value={form.variant_text} onChange={(event) => setForm({ ...form, variant_text: event.target.value })} disabled={!canDraft} />
                    </Field>
                  )}

                  {(form.change_type === "href_swap" || form.change_type === "insert_adjacent") && (
                    <Field label="Variant href">
                      <Input value={form.variant_href} onChange={(event) => setForm({ ...form, variant_href: event.target.value })} disabled={!canDraft} />
                    </Field>
                  )}

                  {(form.change_type === "class_swap" || form.change_type === "insert_adjacent") && (
                    <Field label="Class token">
                      <Input value={form.variant_class} onChange={(event) => setForm({ ...form, variant_class: event.target.value })} disabled={!canDraft} />
                    </Field>
                  )}

                  <Field label="Rollback owner">
                    <Input value={form.rollback_owner} onChange={(event) => setForm({ ...form, rollback_owner: event.target.value })} disabled={!canDraft} />
                  </Field>

                  <Button className="w-full" onClick={handleCreateDraft} disabled={!canDraft || submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Create Draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold text-slate-950">Draft Queue</h2>
                <div className="mt-4 space-y-2">
                  {(workspace?.experiments ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No experiments yet.</p>
                  ) : (
                    workspace?.experiments.map((experiment) => (
                      <button
                        key={experiment.experiment_id}
                        onClick={() => setSelectedId(experiment.experiment_id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === experiment.experiment_id ? "border-[#15284B] bg-white" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-950">{experiment.name}</span>
                          <Badge variant="outline" className={statusTone(experiment.status)}>{formatLabel(experiment.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{experiment.property_code} · {experiment.component_id}</p>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            {loadingDetail ? (
              <Card><CardContent className="flex min-h-[420px] items-center justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></CardContent></Card>
            ) : selectedDetail ? (
              <ExperimentDetail detail={selectedDetail} />
            ) : (
              <Card>
                <CardContent className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                  <FlaskConical className="h-9 w-9 text-slate-300" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">No experiment selected</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500">Create a governed draft or select one from the queue.</p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function EligibleItemsPanel({
  contracts,
  siteContentItems,
  siteContentStatus,
  selectedPropertyName,
  capturedSiteContentProperties,
  preparingItemId,
  onPrepareItem,
  onRequestProof,
  onSelectCapturedProperty,
}: {
  contracts: EdgeExperimentComponentContract[];
  siteContentItems: SiteContentEligibleItem[];
  siteContentStatus: string | null;
  selectedPropertyName: string | null;
  capturedSiteContentProperties: SiteContentPropertySummary[];
  preparingItemId: string | null;
  onPrepareItem: (item: SiteContentEligibleItem) => void;
  onRequestProof: (item: SiteContentEligibleItem) => void;
  onSelectCapturedProperty: (property: SiteContentPropertySummary) => void;
}) {
  const [activeIntent, setActiveIntent] = React.useState<IntentKey>("all");
  const [focusedItemId, setFocusedItemId] = React.useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = React.useState(false);
  const [openSurfaces, setOpenSurfaces] = React.useState<Record<SiteContentEligibleItem["surface"], boolean>>({
    header: true,
    mobile_menu: false,
    page: false,
    footer: false,
  });
  const opportunityCount = siteContentItems.length;
  const ctaOpportunityCount = siteContentItems.filter(
    (item) => item.allowedChanges.includes("href_swap") || item.ctaLabels.length > 0 || item.linkCount > 0,
  ).length;
  const visibleItems = activeIntent === "all"
    ? siteContentItems
    : siteContentItems.filter((item) => itemIntent(item) === activeIntent);
  const groupedItems = (["header", "mobile_menu", "page", "footer"] as SiteContentEligibleItem["surface"][])
    .map((surface) => ({
      surface,
      items: visibleItems.filter((item) => item.surface === surface),
    }))
    .filter((group) => group.items.length > 0);
  const duplicateJourneys = journeyGroups(siteContentItems);
  const visibleJourneyCount = duplicateJourneys.filter((journey) =>
    journey.items.some((item) => visibleItems.some((visibleItem) => visibleItem.id === item.id))
  ).length;

  return (
    <section className="mb-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">What Can We Test?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Specs defines the header, page, mobile menu, and footer actions; Site Content adds captured live page evidence for {selectedPropertyName ?? "the selected property site"}.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">
              {opportunityCount} testable items · {ctaOpportunityCount} actions
            </Badge>
          </div>

          {!siteContentStatus && (
            <>
              <ExperienceIntentBar activeIntent={activeIntent} onSelect={setActiveIntent} />
              <SectionAccordion
                title="Planning Overview"
                summary={`${visibleItems.length} visible targets · ${visibleJourneyCount} repeated journeys`}
                open={overviewOpen}
                onToggle={() => setOverviewOpen(!overviewOpen)}
              >
                <ExperienceMap
                  items={visibleItems}
                  focusedItemId={focusedItemId}
                  onFocus={setFocusedItemId}
                />
                {duplicateJourneys.length > 0 && (
                  <JourneyPatternPanel journeys={duplicateJourneys} onFocus={setFocusedItemId} />
                )}
              </SectionAccordion>
            </>
          )}

          <div className="mt-4">
            {siteContentStatus ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-900">{siteContentStatus}</p>
                {capturedSiteContentProperties.length > 0 && !siteContentStatus.toLowerCase().includes("loading") && (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Captured Site Content available</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {capturedSiteContentProperties.map((property) => (
                        <Button
                          key={property.property_id}
                          type="button"
                          variant="outline"
                          className="h-9 border-cyan-200 bg-white text-[#0D5E6D]"
                          onClick={() => onSelectCapturedProperty(property)}
                        >
                          {property.property_name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <a href="/site-content" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#0D5E6D]">
                  Open Site Content
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedItems.map((group) => (
                  <SurfaceItemAccordion
                    key={group.surface}
                    surface={group.surface}
                    items={group.items}
                    open={openSurfaces[group.surface]}
                    onToggle={() =>
                      setOpenSurfaces((current) => ({
                        ...current,
                        [group.surface]: !current[group.surface],
                      }))
                    }
                  >
                    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                      {group.items.map((item) => (
                        <EligibleItemCard
                          key={item.id}
                          item={item}
                          focused={focusedItemId === item.id}
                          preparing={preparingItemId === item.id}
                          onPrepare={() => onPrepareItem(item)}
                          onRequestProof={() => onRequestProof(item)}
                        />
                      ))}
                    </div>
                  </SurfaceItemAccordion>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Ready For Draft Creation</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">This starts with the seeded hero CTAs, then grows as you prepare Site Content items above.</p>
              </div>
              <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-700">
                {contracts.length} live
              </Badge>
            </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {contracts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No active component contracts are available.
              </div>
            ) : (
              contracts.map((contract) => (
                <div key={contract.component_contract_id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-[#0D5E6D]">
                      <MousePointerClick className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{contractDisplayName(contract)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {humanPageName(contract.page_type, contract.page_path ?? "/")} · {contract.allowed_change_types.map((item) => HUMAN_CHANGE_LABELS[item]).join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SectionAccordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-950">{title}</span>
          <span className="mt-1 block text-xs text-slate-500">{summary}</span>
        </span>
        <span className="text-sm font-semibold text-[#0D5E6D]">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="border-t border-slate-200 p-4">{children}</div>}
    </div>
  );
}

function SurfaceItemAccordion({
  surface,
  items,
  open,
  onToggle,
  children,
}: {
  surface: SiteContentEligibleItem["surface"];
  items: SiteContentEligibleItem[];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const primaryIntents = Array.from(new Set(items.map((item) => itemIntent(item)))).slice(0, 3);
  const exampleLabels = items.slice(0, 4).map((item) => item.targetLabel);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-4 py-4 text-left md:flex-row md:items-center md:justify-between"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-950">{surfaceTitle(surface)}</span>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {items.length} {items.length === 1 ? "item" : "items"}
            </Badge>
          </span>
          <span className="mt-2 block truncate text-xs text-slate-500">
            {exampleLabels.join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {primaryIntents.map((intent) => (
            <Badge key={intent} variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
              {INTENT_OPTIONS.find((option) => option.key === intent)?.label ?? formatTitle(intent)}
            </Badge>
          ))}
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-[#0D5E6D]">
            {open ? "Hide" : "Show"}
          </span>
        </span>
      </button>
      {open && <div className="border-t border-slate-200 bg-slate-50 p-4">{children}</div>}
    </div>
  );
}

function ExperienceIntentBar({
  activeIntent,
  onSelect,
}: {
  activeIntent: IntentKey;
  onSelect: (intent: IntentKey) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {INTENT_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeIntent === option.key
              ? "border-[#15284B] bg-[#15284B] text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-[#0D5E6D]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ExperienceMap({
  items,
  focusedItemId,
  onFocus,
}: {
  items: SiteContentEligibleItem[];
  focusedItemId: string | null;
  onFocus: (id: string) => void;
}) {
  const surfaces = (["header", "mobile_menu", "page", "footer"] as SiteContentEligibleItem["surface"][])
    .map((surface) => ({ surface, items: items.filter((item) => item.surface === surface) }))
    .filter((surface) => surface.items.length > 0);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Experience Map</h3>
          <p className="mt-1 text-xs text-slate-500">Select a pin to focus the matching governed target below.</p>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{items.length} visible</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {surfaces.map((surface) => (
          <div key={surface.surface} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{surfaceTitle(surface.surface)}</p>
            <div className="mt-3 space-y-2">
              {surface.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onFocus(item.id)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                    focusedItemId === item.id
                      ? "border-[#15284B] bg-white text-slate-950 shadow-sm"
                      : "border-transparent bg-white/70 text-slate-600 hover:border-cyan-200 hover:bg-white"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${focusedItemId === item.id ? "bg-[#15284B]" : "bg-cyan-300"}`} />
                  <span className="min-w-0 flex-1 truncate">{item.targetLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyPatternPanel({
  journeys,
  onFocus,
}: {
  journeys: Array<{ key: string; label: string; items: SiteContentEligibleItem[] }>;
  onFocus: (id: string) => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
      <h3 className="text-sm font-semibold text-indigo-950">Repeated Journey Patterns</h3>
      <p className="mt-1 text-xs leading-5 text-indigo-900">
        These actions appear in more than one surface. They can be tested as one placement or as a coordinated journey.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {journeys.slice(0, 4).map((journey) => (
          <div key={journey.key} className="rounded-lg border border-indigo-100 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{journey.label}</p>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">{journey.items.length} placements</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {journey.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onFocus(item.id)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-800"
                >
                  {surfaceTitle(item.surface)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EligibleItemCard({
  item,
  focused,
  preparing,
  onPrepare,
  onRequestProof,
}: {
  item: SiteContentEligibleItem;
  focused: boolean;
  preparing: boolean;
  onPrepare: () => void;
  onRequestProof: () => void;
}) {
  const readiness = humanReadiness(item);
  const primaryChange = item.allowedChanges[0];
  const signals = readinessSignals(item);
  const ideas = suggestedTestIdeas(item);
  const [openPanel, setOpenPanel] = React.useState<"locator" | "readiness" | "ideas" | "workflow" | null>(focused ? "locator" : null);

  React.useEffect(() => {
    if (focused) setOpenPanel("locator");
  }, [focused]);

  return (
    <div className={`rounded-lg border bg-white p-4 transition-shadow ${focused ? "border-[#15284B] shadow-md" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#15284B] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <Badge variant="outline" className={`w-fit ${readiness.tone}`}>{readiness.label}</Badge>
      </div>

      <p className="mt-4 text-sm font-semibold leading-5 text-slate-950">{item.targetLabel}</p>
      <p className="mt-1 text-xs text-slate-500">{item.sectionLabel} · {humanPageName(item.pageType, item.pagePath)}</p>

      <div className="mt-4 space-y-2">
        <CardAccordion
          title="Location"
          summary={pageLocationLabel(item)}
          open={openPanel === "locator"}
          onToggle={() => setOpenPanel(openPanel === "locator" ? null : "locator")}
        >
          <PageLocationMiniMap item={item} compact />
        </CardAccordion>

        <CardAccordion
          title="Readiness"
          summary={`${signals.filter((signal) => signal.status === "pass").length}/${signals.length} ready`}
          open={openPanel === "readiness"}
          onToggle={() => setOpenPanel(openPanel === "readiness" ? null : "readiness")}
        >
          <div className="flex flex-wrap gap-1.5">
            {signals.map((signal) => (
              <Badge key={signal.label} variant="outline" className={readinessSignalTone(signal.status)}>
                {signal.label}
              </Badge>
            ))}
          </div>
        </CardAccordion>

        <CardAccordion
          title="Ideas"
          summary={ideas[0] ?? (primaryChange ? HUMAN_CHANGE_LABELS[primaryChange] : "Small copy test")}
          open={openPanel === "ideas"}
          onToggle={() => setOpenPanel(openPanel === "ideas" ? null : "ideas")}
        >
          <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
            <div className="space-y-1">
              {ideas.map((idea) => (
                <p key={idea} className="text-sm leading-5 text-cyan-950">{idea}</p>
              ))}
            </div>
          </div>
          {item.allowedChanges.length > 1 && (
            <div className="mt-3 space-y-2">
              {item.allowedChanges.slice(1).map((changeType) => (
                <div key={changeType} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <span>{HUMAN_CHANGE_LABELS[changeType]}</span>
                </div>
              ))}
            </div>
          )}
          {item.ctaLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.ctaLabels.map((label) => (
                <Badge key={label} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </CardAccordion>

        <CardAccordion
          title="Workflow"
          summary="Identify now"
          open={openPanel === "workflow"}
          onToggle={() => setOpenPanel(openPanel === "workflow" ? null : "workflow")}
        >
          <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-semibold text-slate-500">
            {["Identify", "Verify", "Draft", "Preflight", "Decide"].map((step, index) => (
              <span key={step} className={`rounded px-1 py-1 ${index === 0 ? "bg-[#15284B] text-white" : "bg-slate-50"}`}>
                {step}
              </span>
            ))}
          </div>
        </CardAccordion>
      </div>

      <div className="mt-4 grid gap-2">
        <Button className="w-full" variant="outline" onClick={onRequestProof}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Target Proof
        </Button>
        <Button className="w-full" variant="outline" onClick={onPrepare} disabled={preparing}>
          {preparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Prepare Test
        </Button>
      </div>
    </div>
  );
}

function CardAccordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
          <span className="truncate">{summary}</span>
          <span className="text-slate-400">{open ? "−" : "+"}</span>
        </span>
      </button>
      {open && <div className="border-t border-slate-200 p-3">{children}</div>}
    </div>
  );
}

function PageLocationMiniMap({ item, compact = false }: { item: SiteContentEligibleItem; compact?: boolean }) {
  if (item.surface !== "page") {
    return <GlobalSurfaceLocator item={item} compact={compact} />;
  }

  const sections =
    item.pageMapSections.length > 0
      ? [...item.pageMapSections].sort((a, b) => a.order - b.order)
      : [{ id: item.mappingId, label: item.sectionLabel, order: item.sectionOrder ?? 1 }];
  const activeIndex = Math.max(0, sections.findIndex((section) => section.order === item.sectionOrder));
  const displaySections = sections.length > 7
    ? sections.filter((_, index) => index === 0 || index === activeIndex || index === sections.length - 1 || Math.abs(index - activeIndex) <= 1)
    : sections;
  const hiddenBefore = sections.length > 7 && activeIndex > 2;
  const hiddenAfter = sections.length > 7 && activeIndex < sections.length - 3;

  return (
    <div className={`${compact ? "" : "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Page location</p>
        <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
          {pageLocationLabel(item)}
        </Badge>
      </div>
      <div className="flex gap-3">
        <div className="flex w-10 shrink-0 flex-col gap-1 rounded-md border border-slate-200 bg-white p-1.5">
          {sections.map((section, index) => {
            const isActive = section.order === item.sectionOrder;
            return (
              <div
                key={section.id}
                className={`h-2 rounded-sm ${isActive ? "bg-[#15284B]" : index < activeIndex ? "bg-cyan-200" : "bg-slate-200"}`}
                title={section.label}
              />
            );
          })}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {hiddenBefore && <p className="text-[11px] leading-4 text-slate-400">Earlier page sections...</p>}
          {displaySections.map((section) => {
            const isActive = section.order === item.sectionOrder;
            return (
              <div key={section.id} className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-[#15284B]" : "bg-slate-300"}`} />
                <p className={`truncate text-xs leading-5 ${isActive ? "font-semibold text-slate-950" : "text-slate-500"}`}>
                  {isActive ? `${compactSectionLabel(section.label)} · this CTA` : compactSectionLabel(section.label)}
                </p>
              </div>
            );
          })}
          {hiddenAfter && <p className="text-[11px] leading-4 text-slate-400">Later page sections...</p>}
        </div>
      </div>
    </div>
  );
}

function GlobalSurfaceLocator({ item, compact = false }: { item: SiteContentEligibleItem; compact?: boolean }) {
  const isHeader = item.surface === "header";
  const isMobile = item.surface === "mobile_menu";
  const isFooter = item.surface === "footer";
  const slots = isFooter
    ? ["Info", "Links", "CTA", "Legal"]
    : isMobile
      ? ["Menu", "Pages", "CTAs", "Social"]
      : ["Phone", "Apply", "Tour", "Menu"];
  const activeIndex = Math.max(
    0,
    slots.findIndex((slot) => item.targetLabel.toLowerCase().includes(slot.toLowerCase().split(" ")[0]))
  );

  return (
    <div className={compact ? "" : "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Experience surface</p>
        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
          {pageLocationLabel(item)}
        </Badge>
      </div>
      <div className={`rounded-md border border-slate-200 bg-white p-2 ${isFooter ? "mt-8" : ""}`}>
        <div className={`grid gap-1 ${isMobile ? "grid-cols-1" : "grid-cols-4"}`}>
          {slots.map((slot, index) => (
            <div
              key={slot}
              className={`rounded px-2 py-1 text-center text-[11px] font-medium ${
                index === activeIndex ? "bg-[#15284B] text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {slot}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {item.targetLabel} is governed by Specs in {item.locationLabel}; live selector proof is required before launch.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ExperimentDetail({ detail }: { detail: EdgeExperimentDetailResponse }) {
  const [currentDetail, setCurrentDetail] = React.useState(detail);
  const [runningAction, setRunningAction] = React.useState<"preflight" | "dry_run" | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentDetail(detail);
    setActionMessage(null);
  }, [detail]);

  const { experiment, component_contract: contract, readiness } = currentDetail;
  const passCount = readiness.filter((item) => item.status === "pass").length;
  const failCount = readiness.filter((item) => item.status === "fail").length;
  const checklist = proofChecklist(currentDetail);
  const checklistPasses = checklist.filter((item) => item.status === "pass").length;

  const handlePreflight = async () => {
    setRunningAction("preflight");
    try {
      const payload = await requestEdgeExperimentPreflight(experiment.experiment_id);
      setCurrentDetail(payload);
      setActionMessage("Preflight request recorded. EVS execution proof is still required before launch.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to request preflight");
    } finally {
      setRunningAction(null);
    }
  };

  const handleDryRun = async () => {
    setRunningAction("dry_run");
    try {
      const payload = await generateEdgeExperimentDryRun(experiment.experiment_id);
      setCurrentDetail(payload);
      setActionMessage("Worker dry-run config generated. It does not change live traffic.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to generate dry run");
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusTone(experiment.status)}>{formatLabel(experiment.status)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{experiment.property_code}</Badge>
                <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">{CHANGE_TYPE_LABELS[experiment.change_type]}</Badge>
              </div>
              <h2 className="text-2xl font-semibold text-slate-950">{experiment.name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{experiment.hypothesis}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Readiness</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{passCount}/{readiness.length}</p>
              {failCount > 0 && <p className="mt-1 text-xs text-rose-700">{failCount} blocking item{failCount === 1 ? "" : "s"}</p>}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <InfoBlock label="Page" value={experiment.page_path} />
            <InfoBlock label="Component" value={experiment.component_id} />
            <InfoBlock label="Primary metric" value={formatLabel(experiment.primary_metric)} />
            <InfoBlock label="Traffic split" value={`${100 - experiment.traffic_split_pct}/${experiment.traffic_split_pct}`} />
            <InfoBlock label="Assignment" value={formatLabel(experiment.assignment_unit)} />
            <InfoBlock label="Rollback owner" value={experiment.rollback_owner ?? "Before approval"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-700" />
              <h3 className="text-base font-semibold text-slate-950">Launch Checklist</h3>
            </div>
            {actionMessage && (
              <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                {actionMessage}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {checklist.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <Badge variant="outline" className={proofTone(item.status)}>{formatLabel(item.status)}</Badge>
                  </div>
                  {item.detail && <p className="mt-2 break-words text-xs leading-5 text-slate-500">{item.detail}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handlePreflight} disabled={runningAction !== null}>
                {runningAction === "preflight" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Run Preflight
              </Button>
              <Button variant="outline" onClick={handleDryRun} disabled={runningAction !== null}>
                {runningAction === "dry_run" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Generate Dry Run
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-700" />
              <h3 className="text-base font-semibold text-slate-950">Execution Lock</h3>
            </div>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Live edge execution is intentionally unavailable in this first slice.</p>
              <p>{checklistPasses}/{checklist.length} checklist items are currently passing. EVS proof and a dry-run config must be present before launch can unlock.</p>
            </div>
            <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <p>Preflight: {currentDetail.latest_preflight ? `requested ${formatLabel(currentDetail.latest_preflight.guardrail_status)}` : "not requested"}</p>
              <p>Dry run: {currentDetail.latest_dry_run ? `config v${currentDetail.latest_dry_run.config_version}` : "not generated"}</p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <LockedAction icon={Rocket} label="Launch" />
              <LockedAction icon={PauseCircle} label="Pause" />
              <LockedAction icon={Activity} label="Decide" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-slate-950">Variants</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {experiment.variants.map((variant) => (
              <div key={variant.variant_id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-950">{variant.variant_key}</p>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{variant.allocation_pct}%</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{summarizeVariant(variant)}</p>
                <p className="mt-3 break-all text-xs text-slate-400">{variant.target_selector}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-slate-950">Component Contract</h3>
          {contract ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoBlock label="Source" value={contract.source} />
              <InfoBlock label="Allowed changes" value={contract.allowed_change_types.map((item) => CHANGE_TYPE_LABELS[item]).join(", ")} />
              <InfoBlock label="Accessibility checks" value={contract.required_accessibility_checks.join(", ")} />
              <InfoBlock label="Contract selector" value={contract.selector} />
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="h-4 w-4" />
              No active contract found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function LockedAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-slate-400" />
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
