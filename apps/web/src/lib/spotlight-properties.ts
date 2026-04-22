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
  "the villages at oakleaf": ["oakleaf"],
  "avasa at 1604": ["1604"],
  "the whitney": ["whitney"],
};

// Active Spotlight order sourced from:
// /Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json
const APRIL_2026_SPOTLIGHT_NAMES = [
  "Anatole Daytona",
  "Elation at Grandway West",
  "Grand Harbor",
  "Pointe at Bentonville",
  "The Reserves of Thomas Glen",
  "Townhomes",
  "Avasa at 1604",
  "Belterra",
  "Botanic",
  "Camber Ridge",
  "The Villages at Oakleaf",
  "Stonecreek",
  "Cane Island",
  "Clearwater Heights",
  "CoHo",
  "Forest View",
  "Luma Headwaters",
  "Phoenix",
  "Retreat",
  "Steeplechase",
  "Valencia",
  "Villa Lago",
  "The Whitney",
];

export function getCurrentSpotlightNames(): string[] {
  return APRIL_2026_SPOTLIGHT_NAMES;
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

  return APRIL_2026_SPOTLIGHT_NAMES
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
