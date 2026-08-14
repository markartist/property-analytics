/*
 * Shared Resi source attribution resolver for Cloudflare Workers.
 *
 * Contract:
 * - Property is resolved by hostname or longest matching URL prefix.
 * - Default display phone/email comes from the property's VWS tracking row.
 * - Incoming URL id/trackingId selects a source row only for the resolved property.
 * - Invalid/missing ids fall back to VWS, not office phone.
 */

function normalizeHost(hostname) {
  return String(hostname || "").trim().toLowerCase();
}

function propertyCodeForUrl(lookup, url) {
  const host = normalizeHost(url.hostname);
  const byHostname = lookup?.byHostname || {};
  if (byHostname[host]) return byHostname[host];

  const href = url.href;
  let bestPrefix = "";
  let bestPropertyCode = null;
  for (const [prefix, propertyCode] of Object.entries(lookup?.byUrlPrefix || {})) {
    if (href.startsWith(prefix) && prefix.length > bestPrefix.length) {
      bestPrefix = prefix;
      bestPropertyCode = propertyCode;
    }
  }
  return bestPropertyCode;
}

function defaultSourceForProperty(property) {
  if (!property) return null;
  const defaultTrackingId = property.defaultTrackingId;
  return defaultTrackingId ? property.sources?.[defaultTrackingId] || null : null;
}

function resolveResiSourceAttribution(lookup, requestUrl) {
  const url = requestUrl instanceof URL ? requestUrl : new URL(String(requestUrl));
  const field = lookup?.externalSourceField || "id";
  const requestedTrackingId = url.searchParams.get(field) || url.searchParams.get("trackingId");
  let propertyCode = propertyCodeForUrl(lookup, url);

  if (!propertyCode && requestedTrackingId && lookup?.byTrackingId?.[requestedTrackingId]) {
    propertyCode = lookup.byTrackingId[requestedTrackingId].propertyCode;
  }

  const property = propertyCode ? lookup?.byProperty?.[propertyCode] || null : null;
  const defaultSource = defaultSourceForProperty(property);
  const requestedSource =
    property && requestedTrackingId ? property.sources?.[requestedTrackingId] || null : null;
  const selectedSource = requestedSource || defaultSource;
  const warnings = [];

  if (!property) warnings.push("property_not_resolved");
  if (requestedTrackingId && !requestedSource) warnings.push("tracking_id_not_valid_for_property");
  if (!defaultSource?.phone) warnings.push("missing_vws_default_phone");
  if (!selectedSource?.phone) warnings.push("missing_selected_phone");

  return {
    propertyCode: property?.propertyCode || propertyCode || null,
    propertyName: property?.propertyName || null,
    externalSourceField: field,
    requestedTrackingId: requestedTrackingId || null,
    selectedTrackingId: selectedSource?.trackingId || null,
    selectedMarketingSourceCd: selectedSource?.marketingSourceCd || null,
    selection: requestedSource ? "source" : "default",
    phone: selectedSource?.phone || null,
    email: selectedSource?.email || null,
    defaultTrackingId: property?.defaultTrackingId || null,
    defaultMarketingSourceCd: property?.defaultMarketingSourceCd || null,
    warnings,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    propertyCodeForUrl,
    resolveResiSourceAttribution,
  };
}
