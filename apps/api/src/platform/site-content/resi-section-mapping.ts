export type ResiSectionSourceStatus =
  | "property_matched"
  | "property_suggested"
  | "global_locked"
  | "not_resi_backed"
  | "unavailable";

export type ResiSectionSourceScope = "property" | "global" | "unknown";

export type ResiSafeField = {
  field_path: string;
  field_role: string;
  safety_notes: string | null;
};

export type ResiSourceObject = {
  object_type: string;
  object_id: string;
  public_title: string | null;
  public_subtitle: string | null;
  text_summary: string | null;
  is_global: boolean;
  affected_property_count: number;
  safe_fields: ResiSafeField[];
};

export type ResiSectionSourceBinding = {
  status: ResiSectionSourceStatus;
  scope: ResiSectionSourceScope;
  source_object_type: string | null;
  source_object_id: string | null;
  source_title: string | null;
  confidence: number;
  affected_property_count: number | null;
  safe_fields: ResiSafeField[];
  rationale: string;
};

export type ResiSectionMatchInput = {
  page_type: string | null;
  specs_section_key: string | null;
  section: {
    label: string | null;
    heading: string | null;
    eyebrow: string | null;
    title: string | null;
    subtitle: string | null;
    copy: string | null;
    bullets: string[];
  } | null;
  sources: ResiSourceObject[];
};

const STOP_WORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "is", "it", "of", "on", "or", "our", "the", "to", "with", "your",
]);

const EMPTY_BINDING: ResiSectionSourceBinding = {
  status: "not_resi_backed",
  scope: "unknown",
  source_object_type: null,
  source_object_id: null,
  source_title: null,
  confidence: 0,
  affected_property_count: null,
  safe_fields: [],
  rationale: "No confident Resi source object was found for this captured section.",
};

export function matchResiSourceToSection(input: ResiSectionMatchInput): ResiSectionSourceBinding {
  const section = input.section;
  if (!section || input.sources.length === 0) return EMPTY_BINDING;

  const ranked = input.sources
    .map((source) => ({ source, score: scoreResiSourceMatch({ ...input, section }, source) }))
    .filter((candidate) => candidate.score >= 32)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) return EMPTY_BINDING;

  const best = ranked[0]!;
  const globalCandidate = ranked.find((candidate) => getSourceScope(candidate.source) === "global" && candidate.score >= 60);
  const selected = globalCandidate && globalCandidate.score >= best.score - 8 ? globalCandidate : best;
  const scope = getSourceScope(selected.source);
  const confidence = Math.min(100, Math.round(selected.score));
  const sourceTitle = selected.source.public_title || selected.source.public_subtitle || selected.source.object_type;

  if (scope === "global") {
    return {
      status: "global_locked",
      scope,
      source_object_type: selected.source.object_type,
      source_object_id: selected.source.object_id,
      source_title: sourceTitle,
      confidence,
      affected_property_count: selected.source.affected_property_count,
      safe_fields: selected.source.safe_fields,
      rationale: `Matching Resi ${selected.source.object_type} is shared across ${selected.source.affected_property_count} properties or marked global. It is inspect-only in the property workspace.`,
    };
  }

  if (selected.source.safe_fields.length === 0) {
    return {
      status: "property_suggested",
      scope,
      source_object_type: selected.source.object_type,
      source_object_id: selected.source.object_id,
      source_title: sourceTitle,
      confidence,
      affected_property_count: selected.source.affected_property_count,
      safe_fields: [],
      rationale: `A property-scoped Resi ${selected.source.object_type} resembles this section, but it has no safe content fields in the current inventory. It is source context only.`,
    };
  }

  return {
    status: confidence >= 70 ? "property_matched" : "property_suggested",
    scope,
    source_object_type: selected.source.object_type,
    source_object_id: selected.source.object_id,
    source_title: sourceTitle,
    confidence,
    affected_property_count: selected.source.affected_property_count,
    safe_fields: selected.source.safe_fields,
    rationale:
      confidence >= 70
        ? `Property-scoped Resi ${selected.source.object_type} matched the page role and captured section language.`
        : `Property-scoped Resi ${selected.source.object_type} is a possible source match; confirm it before creating a durable binding.`,
  };
}

export function unavailableResiSourceBinding(reason = "Resi inventory is unavailable for this property."): ResiSectionSourceBinding {
  return { ...EMPTY_BINDING, status: "unavailable", rationale: reason };
}

export function getSourceScope(source: ResiSourceObject): ResiSectionSourceScope {
  if (source.is_global || source.affected_property_count > 1) return "global";
  if (source.affected_property_count === 1) return "property";
  return "unknown";
}

function scoreResiSourceMatch(
  input: Omit<ResiSectionMatchInput, "section"> & { section: NonNullable<ResiSectionMatchInput["section"]> },
  source: ResiSourceObject
): number {
  const pageType = (input.page_type || "").toLowerCase();
  const specsKey = (input.specs_section_key || "").toLowerCase();
  const sectionText = sectionTokens(input.section);
  const sourceText = textTokens([source.public_title, source.public_subtitle, source.text_summary].filter(Boolean).join(" "));
  const sourceTitle = textTokens([source.public_title, source.public_subtitle].filter(Boolean).join(" "));
  let score = pageAffinity(pageType, specsKey, source.object_type);

  const titleOverlap = overlapRatio(sectionText.title, sourceTitle);
  const bodyOverlap = overlapRatio(sectionText.all, sourceText);
  score += Math.round(titleOverlap * 38);
  score += Math.round(bodyOverlap * 28);

  if (sourceTitle.size > 0 && sameTokenSet(sectionText.title, sourceTitle)) score += 28;
  if (source.safe_fields.length > 0) score += 4;
  return Math.min(score, 100);
}

function pageAffinity(pageType: string, specsKey: string, objectType: string): number {
  const object = objectType.toLowerCase();
  if (object === "faq" && pageType === "faqs") return 48;
  if (object === "amenity" && (pageType === "amenities" || specsKey.includes("amenit"))) return 42;
  if (object === "neighborhood_place" && (pageType === "neighborhood" || specsKey.includes("location"))) return 42;
  if (object === "gallery" && pageType === "gallery") return 44;
  if (object === "announcement" && pageType === "specials") return 38;
  if (object === "content_block" || object === "content_item") return 14;
  return 0;
}

function sectionTokens(section: NonNullable<ResiSectionMatchInput["section"]>) {
  const title = textTokens([section.label, section.heading, section.eyebrow, section.title, section.subtitle].filter(Boolean).join(" "));
  return { title, all: textTokens([Array.from(title).join(" "), section.copy, ...section.bullets].filter(Boolean).join(" ")) };
}

function textTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  );
}

function overlapRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let matched = 0;
  for (const token of left) if (right.has(token)) matched += 1;
  return matched / Math.max(1, Math.min(left.size, right.size));
}

function sameTokenSet(left: Set<string>, right: Set<string>): boolean {
  return left.size > 0 && right.size > 0 && overlapRatio(left, right) >= 0.9;
}
