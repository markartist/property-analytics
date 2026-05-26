import matchedData from "../../../../Portfolio_Monitoring/data/all_properties_gbp_matched.json";

type MatchedEntry = {
  property_id?: string | null;
  account_id?: string | null;
  location_id?: string | null;
  gbp_title?: string | null;
};

const entries = Array.isArray((matchedData as any).matched)
  ? ((matchedData as any).matched as MatchedEntry[])
  : [];

const byPropertyId = new Map<string, MatchedEntry>();
for (const entry of entries) {
  const propertyId = entry.property_id?.trim();
  if (propertyId) byPropertyId.set(propertyId, entry);
}

export function getGbpMappingForPropertyId(propertyId: string | null | undefined) {
  if (!propertyId) return null;
  return byPropertyId.get(propertyId.trim()) ?? null;
}
