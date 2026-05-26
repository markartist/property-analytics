import type { CaptainInteractionIntent } from "./types";

const INTENT_PATTERNS: Array<{ intent: CaptainInteractionIntent; patterns: RegExp[]; subtype?: string }> = [
  { intent: "approval_request", patterns: [/\bapprove\b/i, /\bapproval\b/i, /\bsign off\b/i] },
  { intent: "correction", patterns: [/\bwrong\b/i, /\bcorrect\b/i, /\bfix\b/i, /\bdoes not match\b/i] },
  { intent: "escalation", patterns: [/\bescalat/i, /\bcritical\b/i, /\burgent\b/i, /\bblocked\b/i] },
  { intent: "reputation_concern", patterns: [/\breview/i, /\brating/i, /\breputation/i, /\bsentiment/i] },
  { intent: "pricing_concern", patterns: [/\brent\b/i, /\bpricing\b/i, /\bconcession/i, /\bspecial\b/i] },
  { intent: "website_concern", patterns: [/\bwebsite\b/i, /\bpage\b/i, /\bseo\b/i, /\bcopy\b/i, /\bpsi\b/i, /\bcwv\b/i] },
  { intent: "leasing_concern", patterns: [/\blease/i, /\bguest card/i, /\bvisit/i, /\bapplication/i, /\bclosing ratio/i, /\bpq\b/i] },
  { intent: "resident_issue", patterns: [/\bresident\b/i, /\bmaintenance\b/i, /\bticket\b/i, /\bservice\b/i] },
  { intent: "amenity_update", patterns: [/\bamenit/i, /\bpool\b/i, /\bgym\b/i, /\bpackage locker\b/i] },
  { intent: "event_update", patterns: [/\bevent\b/i, /\bopen house\b/i, /\bresident night\b/i] },
  { intent: "content_suggestion", patterns: [/\bpost\b/i, /\bheadline\b/i, /\bmeta\b/i, /\bad copy\b/i, /\bgbp\b/i] },
  { intent: "recommendation_request", patterns: [/\brecommend/i, /\bwhat should\b/i, /\bnext move\b/i, /\bwhat do we do\b/i] },
  { intent: "operational_update", patterns: [/\bwe did\b/i, /\bcompleted\b/i, /\bupdated\b/i, /\bchanged\b/i] },
  { intent: "informational_claim", patterns: [/\bnote\b/i, /\bfyi\b/i, /\bthe team said\b/i] },
];

export function classifyCaptainInteraction(inputText: string): {
  intent: CaptainInteractionIntent;
  subtype: string | null;
  confidence: number;
  entities: Record<string, string[]>;
} {
  const trimmed = inputText.trim();
  for (const row of INTENT_PATTERNS) {
    if (row.patterns.some((pattern) => pattern.test(trimmed))) {
      return {
        intent: row.intent,
        subtype: row.subtype ?? null,
        confidence: 0.82,
        entities: extractRuntimeEntities(trimmed),
      };
    }
  }
  if (/\?$/.test(trimmed)) {
    return { intent: "question", subtype: null, confidence: 0.78, entities: extractRuntimeEntities(trimmed) };
  }
  return { intent: "informational_claim", subtype: null, confidence: 0.62, entities: extractRuntimeEntities(trimmed) };
}

function extractRuntimeEntities(text: string): Record<string, string[]> {
  const floorplans = Array.from(new Set(text.match(/\b[A-Z]\d\b/g) ?? []));
  const unitTypes = Array.from(new Set(text.match(/\b[0-4]\s?BR\b/gi) ?? [])).map((value) => value.toUpperCase().replace(/\s+/, " "));
  const channels = ["Google Ads", "Apartments.com", "ADC", "GBP", "Website", "Social", "Zillow"].filter((channel) =>
    text.toLowerCase().includes(channel.toLowerCase())
  );
  return { floorplans, unit_types: unitTypes, channels };
}
