import identityMatrix from "../../../../../config/property_identity_matrix.json";

type IdentityProperty = {
  property_code?: string;
  display_property_id?: string;
  canonical_property_id?: string;
};

export function getCaptainPropertyStaticParams(): Array<{ propertyId: string }> {
  const properties = (identityMatrix as { properties?: IdentityProperty[] }).properties ?? [];
  return properties
    .map((property) => property.property_code ?? property.display_property_id ?? property.canonical_property_id)
    .filter((propertyId): propertyId is string => Boolean(propertyId))
    .map((propertyId) => ({ propertyId }));
}
