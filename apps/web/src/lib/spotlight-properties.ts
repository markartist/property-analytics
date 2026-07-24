import type { Community } from "@/lib/api";

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SPOTLIGHT_NAME_ALIASES: Record<string, string[]> = {
  "pointe at bentonville": ["pointe"],
  "clearwater heights": ["clearwater"],
  "cendana district west": ["cendana"],
  "elation at grandway west": ["elation"],
  "the villages at oakleaf": ["oakleaf"],
  "avasa at 1604": ["1604"],
  "luminary 95": ["luminary"],
  "luminary at 95": ["luminary"],
  "preserve at baywood": ["baywood"],
  "retreat lakeland": ["lakeland"],
  "the whitney": ["whitney"],
  "westover oaks": ["westover"],
};

// Active Spotlight order sourced from:
// /Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-07.json
const JULY_2026_SPOTLIGHT_NAMES = [
  "Cendana",
  "Elation",
  "Retreat",
  "Canton Mill Lofts",
  "Clearwater Heights",
  "College View",
  "Gateway North",
  "Luminary",
  "Silverbrooke",
  "Baywood",
  "Shadowbrooke",
  "St Andrews",
  "Westover",
];

export function getCurrentSpotlightNames(): string[] {
  return JULY_2026_SPOTLIGHT_NAMES;
}

export function getSpotlightCommunities(communities: Community[]): Community[] {
  const lookup = new Map<string, Community>();

  for (const community of communities) {
    const candidateKeys = new Set<string>([normalizeName(community.name)]);
    const aliases = SPOTLIGHT_NAME_ALIASES[normalizeName(community.name)] ?? [];
    for (const alias of aliases) {
      candidateKeys.add(normalizeName(alias));
    }
    for (const key of candidateKeys) {
      lookup.set(key, community);
    }
  }

  return JULY_2026_SPOTLIGHT_NAMES
    .map((name) => lookup.get(normalizeName(name)) ?? null)
    .filter((community): community is Community => community !== null);
}

export function getUpcomingFriday(baseDate: Date = new Date()): Date {
  const result = new Date(baseDate);
  result.setHours(12, 0, 0, 0);

  const day = result.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  result.setDate(result.getDate() + daysUntilFriday);
  return result;
}
