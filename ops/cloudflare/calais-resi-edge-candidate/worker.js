import OFFICIAL_LBLE_SVG from "./lble.svg";
import BUNDLED_HERO_MOBILE_AVIF from "./hero-mobile-750x1000.avif";
import BUNDLED_HERO_DESKTOP_AVIF from "./hero-desktop-1600.avif";
import BUNDLED_WELCOME_AVIF from "./welcome-640.avif";
import BUNDLED_FEATURES_AVIF from "./features-900.avif";
import { renderZarazConsentPillScript as renderSharedZarazConsentPillScript } from "../shared/resi-consent-widget/widget.mjs";

const VERSION = "2026-08-11.calais-mobile-shell-v27-shared-consent";
const GATE_PARAM = "edge_preview";
const GATE_VALUE = "1";
const NATIVE_CONTINUATION_PARAM = "edge_native_continuation";
const CS_VERIFY_SUPPRESSED_PATH = "/__vtr/cs-verify-suppressed";
const CS_VERIFY_SUPPRESSED_PARAM = "vtr_cs_verify_suppressed";
const ORIGIN = "https://calaismidtownapartments.com";
const NATIVE_ORIGIN = "https://calaismidtown.kinsta.cloud";
const ASSET_BASE = "/assets/resi-edge-assets/TX4MI/home/";
const SHARED_ASSET_BASE = "/assets/resi-edge-assets/shared/";
const KINGSLEY_AWARD_PATH = `${SHARED_ASSET_BASE}kingsley-award.svg`;
const KINGSLEY_AWARD_URL = "https://dam.getresi.co/2949/Kingsley_Award.svg";
const FONT_PRELOADS = [];

const PROPERTY = {
  code: "TX4MI",
  communityId: "4607fc30-325a-4f4f-9499-70ffe40ebdf0",
  ga4PropertyId: "378381499",
  name: "Calais Midtown",
  cityState: "Houston, TX",
  streetAddress: "3210 Louisiana St.",
  addressLocality: "Houston",
  addressRegion: "TX",
  postalCode: "77006",
  telephoneSchema: "+13464140841",
  phone: "(346) 414-0841",
  phoneHref: "tel:+13464140841",
  email: "venterra_calaismidtown_website@leads.anyonehome.com",
  title: "Calais Midtown Apartments in Houston, TX",
  description:
    "Welcome home to Calais Midtown Apartments in Houston, TX - Discover luxury living in our 1, 2, and 3 bedroom homes.",
  heroTitle: "Live Better. Live Easy.",
  heroSubtitle: "1, 2, and 3 Bedroom Apartments in Houston, TX",
  promoText: "Up to 2 Weeks Free",
  promoDetail: "Up to 2 weeks free on select apartment homes. Limited time only.",
  kingsleyAwardHref: KINGSLEY_AWARD_PATH,
  welcomeTitle: "Welcome to Calais Midtown",
  welcomeKicker: "Choose the perfect layout for your lifestyle.",
  welcomeBody:
    "In cosmopolitan Midtown Houston, Calais Midtown captures the energy of city living with modern style and an inviting sense of home. Contemporary interiors and urban views reflect the creativity and movement of Midtown, creating a living experience that feels vibrant, connected, and unmistakably Houston.",
  featuresEyebrow: "Apartment Features",
  featuresTitle: "Stylish Living Spaces",
  featuresBody:
    "Experience modern interiors designed for style and openness, featuring polished concrete floors, tall ceilings, and expansive windows that fill each home with natural light. Select residences also offer striking downtown views, creating a bright and contemporary living environment.",
  featureBullets: ["Polished Concrete Floors", "Tall Ceilings", "Expansive Windows", "Downtown Views"],
  apartmentsHref: "/apartments/",
  featuresHref: "/features/",
  amenitiesHref: "/amenities/",
  galleryHref: "/gallery/",
  neighborhoodHref: "/neighborhood/",
  faqsHref: "/faqs/",
  reviewsHref: "/reviews/",
  contactHref: "/contact/",
  specialsHref: "/specials/",
  tourHref: "https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/TX4MI",
  applyHref: "https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/TX4MI",
  facebookHref: "",
  instagramHref: "",
  mapsHref:
    "https://www.google.com/maps/search/?api=1&query=Calais%20Midtown%203210%20Louisiana%20St%20Houston%20TX%2077006",
  faviconPngHref: "/wp-content/uploads/2026/01/favicon.png",
  faviconSvgHref: "/wp-content/uploads/2026/01/favicon.svg",
  appleTouchIconHref: "/wp-content/uploads/2026/01/apple-touch-icon.png",
};

const SOURCE_ATTRIBUTION = {
  source: "reports/resi_source_lookup/latest-resi-source-lookup.kv.json",
  generatedRunId: "resi_source_lookup_0995b04ee0a8",
  externalSourceField: "id",
  defaultTrackingId: "TX4MI30L",
  sources: {
    TX4MI30L: {
      trackingId: "TX4MI30L",
      marketingSourceCd: "VWS",
      phone: "(346) 414-0841",
      email: "venterra_calaismidtown_website_vl@leads.anyonehome.com",
    },
    TX4MIGOA: {
      trackingId: "TX4MIGOA",
      marketingSourceCd: "GOA",
      phone: "(346) 639-3361",
      email: "venterra_calaismidtown_google_ads_vl@leads.anyonehome.com",
    },
  },
};

const REVIEW_SUMMARY = {
  source: "live official Calais homepage property_rating block, verified 08/07/2026",
  ratingValue: 4.0,
  ratingDisplay: "(4)",
  reviewCount: 258,
  reviewCountDisplay: "258 Reviews",
  href: PROPERTY.reviewsHref,
};

const ASSETS = {
  [`${ASSET_BASE}hero-mobile-750x1000.avif`]: {
    body: BUNDLED_HERO_MOBILE_AVIF,
    type: "image/avif",
  },
  [`${ASSET_BASE}hero-desktop-1600.avif`]: {
    body: BUNDLED_HERO_DESKTOP_AVIF,
    type: "image/avif",
  },
  [`${ASSET_BASE}welcome-640.avif`]: {
    body: BUNDLED_WELCOME_AVIF,
    type: "image/avif",
  },
  [`${ASSET_BASE}features-900.avif`]: {
    body: BUNDLED_FEATURES_AVIF,
    type: "image/avif",
  },
  [`${SHARED_ASSET_BASE}lble.svg`]: {
    body: OFFICIAL_LBLE_SVG,
    type: "image/svg+xml; charset=utf-8",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addClassName(current, nextClass) {
  const names = new Set(String(current || "").split(/\s+/).filter(Boolean));
  names.add(nextClass);
  return Array.from(names).join(" ");
}

function isHtmlRequest(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") || accept.includes("*/*");
}

function isMobileRequest(request) {
  const ua = request.headers.get("user-agent") || "";
  return /android|iphone|ipod|mobile|blackberry|iemobile|opera mini/i.test(ua);
}

function isHomepage(url) {
  return url.pathname === "/" || url.pathname === "";
}

function phoneHref(phone) {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return digits ? `tel:${digits}` : PROPERTY.phoneHref;
}

function resolveContact(request) {
  const url = new URL(request.url);
  const requestedTrackingId =
    url.searchParams.get(SOURCE_ATTRIBUTION.externalSourceField) || url.searchParams.get("trackingId");
  const selected =
    (requestedTrackingId && SOURCE_ATTRIBUTION.sources[requestedTrackingId]) ||
    SOURCE_ATTRIBUTION.sources[SOURCE_ATTRIBUTION.defaultTrackingId];
  return {
    phone: selected.phone || PROPERTY.phone,
    phoneHref: phoneHref(selected.phone || PROPERTY.phone),
    email: selected.email || PROPERTY.email,
    requestedTrackingId: requestedTrackingId || null,
    selectedTrackingId: selected.trackingId,
    selectedMarketingSourceCd: selected.marketingSourceCd,
    selection: requestedTrackingId && SOURCE_ATTRIBUTION.sources[requestedTrackingId] ? "source" : "default",
  };
}

function isPreviewRequest(url, env) {
  const gateParam = env.EDGE_PREVIEW_PARAM || GATE_PARAM;
  const gateValue = env.EDGE_PREVIEW_VALUE || GATE_VALUE;
  return (env.EDGE_SHELL_ENABLED || "true") !== "false" && url.searchParams.get(gateParam) === gateValue;
}

function isProductionTopperEnabled(env) {
  return (env.EDGE_PRODUCTION_MOBILE_TOPPER_ENABLED || "true") !== "false";
}

function assetUrl(key) {
  return key;
}

function selectedHero(request) {
  if (isMobileRequest(request)) {
    return {
      href: assetUrl(`${ASSET_BASE}hero-mobile-750x1000.avif`),
      type: "image/avif",
      width: 750,
      height: 1000,
    };
  }
  return {
    href: assetUrl(`${ASSET_BASE}hero-desktop-1600.avif`),
    type: "image/avif",
    width: 1600,
    height: 900,
  };
}

function nativeContinuationHref(request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set(NATIVE_CONTINUATION_PARAM, "1");
  url.searchParams.set("vtr_cv", VERSION);
  return `${url.pathname}${url.search}`;
}

function buildOriginRequest(request, path = null, stripParams = []) {
  const incoming = new URL(request.url);
  const target = new URL(path || `${incoming.pathname}${incoming.search}`, NATIVE_ORIGIN);
  for (const key of stripParams) target.searchParams.delete(key);

  const headers = new Headers();
  const source = request.headers;
  headers.set("accept", source.get("accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  headers.set("user-agent", source.get("user-agent") || "Mozilla/5.0");
  const language = source.get("accept-language");
  if (language) headers.set("accept-language", language);

  return new Request(target.toString(), {
    method: "GET",
    headers,
    redirect: "follow",
  });
}

function buildPassThroughRequest(request, stripParams = [], redirect = "follow") {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, NATIVE_ORIGIN);
  for (const key of stripParams) target.searchParams.delete(key);

  const init = {
    method: request.method,
    headers: new Headers(request.headers),
    redirect,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }
  return new Request(target.toString(), init);
}

async function passThroughNative(request, stripParams = []) {
  return fetch(buildPassThroughRequest(request, stripParams));
}

async function passThroughNativeTransparent(request, stripParams = []) {
  return fetch(buildPassThroughRequest(request, stripParams, "manual"), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
}

function isWordPressControlRequest(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;

  return (
    url.pathname === "/wp-login.php" ||
    url.pathname === "/xmlrpc.php" ||
    url.pathname === "/wp-cron.php" ||
    url.pathname === "/wp-comments-post.php" ||
    url.pathname === "/wp-admin" ||
    url.pathname.startsWith("/wp-admin/") ||
    url.pathname === "/wp-json" ||
    url.pathname.startsWith("/wp-json/")
  );
}

async function passThroughNativeCleanHtml(request, stripParams = []) {
  const originResponse = await fetch(buildPassThroughRequest(request, stripParams), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
  const contentType = originResponse.headers.get("content-type") || "";
  if (request.method !== "GET" || !contentType.includes("text/html") || originResponse.status !== 200) {
    return originResponse;
  }

  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-vtr-calais-topper", VERSION);
  headers.set("x-vtr-calais-native-analytics-clean", "1");
  headers.append("server-timing", 'vtr_calais_native_clean;desc="native-pass-through"');

  return new Response(injectZarazConsentPill(normalizeNativeHtml(await originResponse.text())), {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });
}

function serveAsset(request, asset) {
  return new Response(request.method === "HEAD" ? null : asset.body, {
    headers: {
      "content-type": asset.type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-vtr-calais-topper": VERSION,
    },
  });
}

function renderFontPreloadLinks() {
  return FONT_PRELOADS
    .map((href) => `<link rel="preload" as="font" href="${href}" type="font/woff2" crossorigin fetchpriority="low">`)
    .join("\n");
}

function preloadLinkHeader(request) {
  const hero = selectedHero(request);
  return [
    `<${hero.href}>; rel=preload; as=image; fetchpriority=high; type=${hero.type}`,
    ...FONT_PRELOADS.map((href) => `<${href}>; rel=preload; as=font; type=font/woff2; crossorigin; fetchpriority=low`),
  ].join(", ");
}

async function serveRemoteAsset(request, href, contentType) {
  const response = await fetch(href, {
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });
  const headers = new Headers(response.headers);
  headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-vtr-calais-topper", VERSION);
  headers.delete("set-cookie");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-vtr-calais-topper": VERSION,
    },
  });
}

function noContentResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "x-vtr-calais-topper": VERSION,
      "x-vtr-calais-cs-verify": "suppressed",
    },
  });
}

async function serveNativeFavicon(request) {
  const response = await fetch(buildOriginRequest(request, PROPERTY.faviconPngHref), {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveNativeGoogleReviewIcon(request) {
  const response = await fetch(buildOriginRequest(request, "/wp-content/uploads/2026/01/google_g_icon_download.png"), {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=86400");
  headers.delete("set-cookie");
  headers.set("x-vtr-calais-asset-fallback", "google-review-icon");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function renderPhoneIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg>`;
}

function renderLotusIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="70.34" height="41.6" viewBox="0 0 70.34 41.6" aria-hidden="true" focusable="false"><path d="M28.24 10.31l6.91 7.17 6.91-7.17-6.91-7.17-6.91 7.17Zm6.91 10.33c-.35 0-.69-.14-.93-.4l-8.71-9.04c-.48-.5-.48-1.3 0-1.8L34.21.38c.49-.51 1.38-.51 1.86 0l8.71 9.04c.48.5.48 1.3 0 1.8l-8.71 9.04c-.24.25-.58.4-.92.4" fill="currentColor"/><path d="M66.24 27.18c-.04.04-.07.08-.11.12-.08.1-.17.19-.26.29-.05.06-.11.12-.16.18-.08.09-.16.18-.24.27-.06.06-.12.13-.18.19-.09.09-.17.18-.26.28-.07.07-.14.14-.21.21-.09.09-.17.18-.26.27-.07.07-.15.15-.22.22-.09.09-.18.19-.28.28-.08.08-.16.15-.23.23-.1.1-.19.19-.3.29-.08.08-.17.16-.26.24-.1.1-.2.19-.3.29-.09.08-.18.16-.27.25-.11.1-.21.19-.32.29-.09.08-.19.17-.28.25-.11.1-.22.19-.34.29-.1.08-.2.17-.3.25-.11.1-.23.19-.35.29-.1.08-.21.17-.31.25-.12.1-.24.19-.36.29-.11.08-.22.17-.32.25-.12.1-.25.19-.38.29-.11.08-.23.17-.34.25-.13.09-.26.19-.39.28-.12.08-.23.17-.35.25-.13.09-.27.18-.4.27-.12.08-.24.16-.36.24-.14.09-.27.18-.41.27-.13.08-.25.16-.38.24-.14.09-.28.17-.42.26-.13.08-.26.15-.39.23-.14.08-.29.17-.44.25-.13.07-.27.15-.4.22-.15.08-.3.16-.45.24-.14.07-.27.14-.41.21-.15.08-.31.15-.46.22-.14.07-.28.13-.42.2-.16.07-.32.14-.48.21-.14.06-.28.12-.43.18-.16.07-.33.13-.49.19-.14.06-.29.11-.44.16-.17.06-.34.12-.5.18-.15.05-.3.1-.45.15-.17.05-.34.1-.52.16-.15.04-.3.09-.45.13-.18.05-.35.09-.53.14-.15.04-.3.08-.46.11-.18.04-.37.08-.55.11-.15.03-.3.06-.45.09-.19.03-.38.06-.57.09-.15.02-.3.05-.45.07-.2.03-.4.04-.6.06-.15.02-.29.03-.44.05-.22.02-.44.03-.66.04-.13 0-.27.02-.4.02-.27 0-.54 0-.81 0h-.27c-.14 0-.28-.01-.42-.02h0c5.39-2.83 8.94-7.4 11.26-11.99.17-.02.34-.04.51-.06.63-.07 1.25-.12 1.87-.16.2-.01.41-.03.61-.04 1.14-.07 2.25-.1 3.29-.12h.88c1.65 0 3.11.06 4.28.13.19.01.38.02.56.04-.11.13-.22.26-.34.39M3.78 26.78c2.64-.18 7.2-.34 12 .21 2.33 4.61 5.9 9.19 11.32 12.02-5.1.25-10.24-1.38-15.33-4.9-3.66-2.53-6.43-5.48-7.99-7.33m10.54-12.74c.09.05.19.1.28.14 4.93 2.56 16.05 9.08 19.21 17.32-.76 2.37-.9 4.74-.43 7.07-7.13-1.65-12.52-6.39-16-14.13-1.82-4.06-2.67-8.01-3.05-10.4m41.71.01c-.97 6-4.93 21.86-19.96 24.74-3.14-11.71 13.86-21.61 19.96-24.74m14.23 11.13c-.18-.41-.57-.7-1.02-.76-.28-.04-6.34-.79-13.41-.17 2.64-6.44 3.07-12.21 3.08-12.33.03-.45-.18-.89-.55-1.14-.37-.26-.85-.31-1.27-.12-.29.13-7.3 3.25-13.7 8.41-3.77 3.04-6.51 6.15-8.21 9.28-1.71-3.13-4.45-6.24-8.21-9.28-6.4-5.16-13.4-8.28-13.7-8.41-.41-.18-.89-.14-1.27.12-.37.26-.58.69-.55 1.14 0 .12.44 5.89 3.08 12.33-7.07-.62-13.13.14-13.41.17-.45.06-.84.35-1.02.76-.18.41-.1.89.16 1.27.13.18 10.52 15.11 25.93 15.16h18.1c15.42-.2 25.63-14.98 25.75-15.16.26-.37.39-.85.21-1.27" fill="currentColor"/></svg>`;
}

function renderSocialLinks() {
  const links = [];
  if (PROPERTY.facebookHref) links.push(`<a href="${PROPERTY.facebookHref}" rel="noopener" aria-label="Facebook">f</a>`);
  if (PROPERTY.instagramHref) links.push(`<a href="${PROPERTY.instagramHref}" rel="noopener" aria-label="Instagram">◎</a>`);
  links.push(`<a href="${PROPERTY.mapsHref}" rel="noopener" aria-label="Google Maps">G</a>`);
  return `<div class="socials" aria-label="Social links">${links.join("")}</div>`;
}

function renderReviewRating() {
  const ratingPercent = Math.max(0, Math.min(100, (Number(REVIEW_SUMMARY.ratingValue) / 5) * 100));
  const label = `${PROPERTY.name} reviews: ${REVIEW_SUMMARY.ratingValue.toFixed(1)} out of 5 from ${REVIEW_SUMMARY.reviewCount} reviews`;
  return `<a class="review-rating" href="${REVIEW_SUMMARY.href}" aria-label="${escapeHtml(label)}" data-component-name="property_rating" data-action="navigate_reviews"><span class="review-stars" aria-hidden="true" style="--rating-percent:${ratingPercent}%">★★★★★</span><span class="review-meta">${escapeHtml(REVIEW_SUMMARY.ratingDisplay)} ${escapeHtml(REVIEW_SUMMARY.reviewCountDisplay)}</span></a>`;
}

function renderBullets(items) {
  return `<ul class="content-bullets">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderTopperContentBlocks() {
  return `<section class="content-block content-block-welcome" data-vtr-shell-block="welcome" aria-labelledby="calais-welcome-title"><div class="content-inner content-grid"><div class="content-copy"><h2 id="calais-welcome-title">${escapeHtml(PROPERTY.welcomeTitle)}</h2><p><strong>${escapeHtml(PROPERTY.welcomeKicker)}</strong>${escapeHtml(PROPERTY.welcomeBody)}</p><a class="content-btn content-btn-primary" href="${PROPERTY.apartmentsHref}">See Available Homes</a><img class="content-award" data-vtr-award="kingsley" src="${PROPERTY.kingsleyAwardHref}" width="64" height="64" loading="lazy" decoding="async" alt="Kingsley Excellence of resident satisfaction award badge"></div><figure class="content-media"><img src="${ASSET_BASE}welcome-640.avif" width="640" height="427" loading="lazy" decoding="async" alt="A modern four-story gray apartment building with large windows on a sunny day."></figure></div></section>
<section class="content-block content-block-features" data-vtr-shell-block="features" aria-labelledby="calais-features-title"><div class="content-inner content-grid"><figure class="content-media"><img src="${ASSET_BASE}features-900.avif" width="900" height="600" loading="lazy" decoding="async" alt="Modern kitchen with white cabinets, stainless steel appliances, granite countertops, and wood flooring."></figure><div class="content-copy"><span class="content-eyebrow">${escapeHtml(PROPERTY.featuresEyebrow)}</span><h2 id="calais-features-title">${escapeHtml(PROPERTY.featuresTitle)}</h2><p>${escapeHtml(PROPERTY.featuresBody)}</p>${renderBullets(PROPERTY.featureBullets)}<a class="content-btn" href="${PROPERTY.featuresHref}">See Features</a></div></div></section>`;
}

function renderDesktopNav() {
  return `<nav class="desktop-nav" aria-label="Primary"><a href="${PROPERTY.apartmentsHref}">Apartments</a><a href="${PROPERTY.featuresHref}">Features</a><a href="${PROPERTY.amenitiesHref}">Amenities</a><a href="${PROPERTY.galleryHref}">Gallery</a><a href="${PROPERTY.neighborhoodHref}">Location</a><a href="${PROPERTY.contactHref}">Contact</a></nav>`;
}

function renderTopperAnalytics(contact) {
  return `<script>(function(w,d){w.dataLayer=w.dataLayer||[];function emit(name,data){var payload=Object.assign({event:name,vtr_surface:"mobile_topper",vtr_site:"calaismidtownapartments.com",property_code:"${PROPERTY.code}",community_id:"${PROPERTY.communityId}",tracking_id:"${escapeHtml(contact.selectedTrackingId)}",marketing_source_cd:"${escapeHtml(contact.selectedMarketingSourceCd)}",source_selection:"${escapeHtml(contact.selection)}"},data||{});w.dataLayer.push(payload);if(w.zaraz&&typeof w.zaraz.track==="function"){try{w.zaraz.track(name,payload)}catch(e){}}}w.vtrCalaisTopperTrack=emit;emit("edge_mobile_topper_view");d.addEventListener("click",function(e){var el=e.target&&e.target.closest?e.target.closest("a[href],button"):null;if(!el)return;var label=(el.textContent||"").replace(/\\s+/g," ").trim();var href=el.getAttribute("href")||"";if(href.indexOf("/apartments")!==-1||label.indexOf("Find Your Home")!==-1)emit("find_your_home_click",{cta_label:label,cta_href:href});else if(href.indexOf("scheduleTour")!==-1||label.indexOf("Tour")!==-1)emit("schedule_tour_click",{cta_label:label,cta_href:href});else if(href.indexOf("createPipelineApplication")!==-1||label.indexOf("Apply")!==-1)emit("apply_now_click",{cta_label:label,cta_href:href});else if(href.indexOf("tel:")===0)emit("phone_click",{cta_label:label,cta_href:href});},{passive:true});})(window,document);</script>`;
}

function renderTopperBehavior() {
  return `<script>(function(w,d){var drawer=d.querySelector("[data-drawer]");var scrim=d.querySelector("[data-drawer-scrim]");var menu=d.querySelector("[data-drawer-open]");var close=d.querySelector("[data-drawer-close]");var promo=d.querySelector("[data-promo-toggle]");var promoDrop=d.querySelector("[data-promo-drop]");var promoClose=d.querySelector("[data-promo-close]");function track(name,data){if(w.vtrCalaisTopperTrack)w.vtrCalaisTopperTrack(name,data||{});}function setDrawer(open){if(!drawer)return;drawer.dataset.open=open?"true":"false";drawer.setAttribute("aria-hidden",open?"false":"true");if(open){drawer.removeAttribute("inert");}else{drawer.setAttribute("inert","");}if(scrim)scrim.hidden=!open;d.documentElement.classList.toggle("drawer-open",open);track(open?"mobile_menu_open":"mobile_menu_close");}function setPromo(open){if(!promoDrop||!promo)return;promoDrop.hidden=!open;promo.setAttribute("aria-expanded",open?"true":"false");track(open?"promo_open":"promo_close");}if(menu)menu.addEventListener("click",function(){setDrawer(true);});if(close)close.addEventListener("click",function(){setDrawer(false);});if(scrim)scrim.addEventListener("click",function(){setDrawer(false);});if(promo)promo.addEventListener("click",function(e){e.preventDefault();setPromo(promoDrop.hidden);});if(promoClose)promoClose.addEventListener("click",function(){setPromo(false);});d.addEventListener("keydown",function(e){if(e.key==="Escape"){setDrawer(false);setPromo(false);}});})(window,document);</script>`;
}

function renderZarazConsentPillScript() {
  return renderSharedZarazConsentPillScript();
}

function injectZarazConsentPill(html) {
  if (html.includes("data-vtr-zaraz-consent-pill")) return html;
  const script = renderZarazConsentPillScript();
  if (html.includes("</body>")) return html.replace("</body>", `${script}</body>`);
  return `${html}${script}`;
}

function renderNativeContinuationShell(request) {
  const src = nativeContinuationHref(request);
  return `<section class="native-continuation" data-native-continuation data-native-continuation-state="idle" aria-label="Native site continuation"><div class="native-continuation-status" aria-live="polite"></div><iframe class="native-continuation-frame" title="${escapeHtml(PROPERTY.name)} native site continuation" loading="lazy" data-src="${src}" hidden></iframe></section>`;
}

function renderNativeContinuationLoader() {
  return `<script data-vtr-native-continuation-loader="1">(function(w,d){var section=d.querySelector("[data-native-continuation]");if(!section)return;var frame=section.querySelector(".native-continuation-frame");var status=section.querySelector(".native-continuation-status");var loaded=false;function track(name,data){if(w.vtrCalaisTopperTrack)w.vtrCalaisTopperTrack(name,data||{});}function setState(state,message){section.setAttribute("data-native-continuation-state",state);if(status)status.textContent=message||"";}function load(reason){if(loaded||!frame)return;loaded=true;cleanup();setState("loading","Loading the native site.");frame.hidden=false;frame.src=frame.getAttribute("data-src");frame.addEventListener("load",function(){setState("loaded","");},{once:true});track("native_continuation_load",{reason:reason||"unknown"});}function onScroll(){if(w.scrollY>20)load("scroll");}function onWheel(){load("wheel");}function onTouchMove(){load("touchmove");}function onKey(event){var keys={ArrowDown:1,PageDown:1,End:1," ":1};if(keys[event.key])load("keyboard");}function cleanup(){w.removeEventListener("scroll",onScroll);w.removeEventListener("wheel",onWheel);w.removeEventListener("touchmove",onTouchMove);w.removeEventListener("keydown",onKey);}w.addEventListener("message",function(event){if(event.origin!==w.location.origin)return;var data=event.data||{};if(data.type!=="vtr-native-continuation-height"||!frame)return;var reported=Number(data.height)||0;if(reported<=0)return;frame.style.height=Math.max(640,Math.min(14000,Math.ceil(reported)))+"px";});w.addEventListener("scroll",onScroll,{passive:true});w.addEventListener("wheel",onWheel,{passive:true,once:true});w.addEventListener("touchmove",onTouchMove,{passive:true,once:true});w.addEventListener("keydown",onKey,{passive:true});})(window,document);</script>`;
}

function renderTopperCss() {
  return `@font-face{font-family:Lato;font-style:normal;font-weight:400;font-display:swap;src:url("/wp-content/themes/resi-child-theme/fonts/lato-71f7cc3a.woff2") format("woff2")}@font-face{font-family:Lato;font-style:normal;font-weight:700;font-display:swap;src:url("/wp-content/themes/resi-child-theme/fonts/lato-9b155c87.woff2") format("woff2")}@font-face{font-family:Lato;font-style:normal;font-weight:900;font-display:swap;src:url("/wp-content/themes/resi-child-theme/fonts/lato-78f0db0a.woff2") format("woff2")}@font-face{font-family:"Noto Serif";font-style:normal;font-weight:700;font-display:swap;src:url("/wp-content/themes/resi-child-theme/fonts/notoserif-194b0294.woff2") format("woff2")}
:root{--navy:#15284B;--bay:#294782;--blue:#3D66B9;--mint:#7DCAC2;--smoke:#F6F6F5;--quill:#D6D6D2;--terra:#BD4830;--text:#343838;--white:#FFFFFF;--shadow:rgba(21,40,75,.22)}
*{box-sizing:border-box}html{font-size:18px;background:#fff;color:var(--text)}body{margin:0;background:#fff;color:var(--text);font-family:Lato,Arial,sans-serif;font-size:18px;font-weight:400;line-height:1.625;text-rendering:optimizeLegibility}a{color:inherit;text-decoration:none}button{font:inherit}img{display:block;max-width:100%;height:auto}.drawer-open{overflow:hidden}
.promo-wrap{position:relative;z-index:1100}.promo{width:100%;height:60px;border:0;border-radius:0;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:16px;font-weight:700;line-height:60px;text-align:center}.promo svg{width:18px;height:18px;margin-left:10px;stroke:currentColor;stroke-width:2;fill:none;transition:transform .15s ease}.promo[aria-expanded="true"] svg{transform:rotate(180deg)}.promo-drop{position:absolute;top:60px;left:0;width:100%;z-index:1020;background:var(--smoke);color:var(--text);padding:20px 20px 22px;text-align:center;box-shadow:0 18px 35px rgba(0,0,0,.15)}.promo-drop[hidden]{display:none}.promo-close{position:absolute;right:15px;top:10px;width:24px;height:24px;border:0;background:transparent;color:var(--text);font-size:28px;line-height:24px;padding:0}.promo-drop h3{margin:0 28px 16px;font-family:Lato,Arial,sans-serif;color:var(--navy);font-size:24px;font-weight:900;line-height:1.2;letter-spacing:0}.promo-drop p{margin:0 auto 28px;max-width:330px;font-size:16px;line-height:26px}.promo-actions{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}.promo-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:180px;padding:0 20px;border:2px solid var(--blue);border-radius:50px;background:var(--blue);color:#fff;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.2px}.promo-actions a.secondary{min-width:0;min-height:0;height:28px;border:0;background:transparent;color:var(--text);padding:0;font-size:14px;line-height:28px;letter-spacing:1.2px}
.bar{height:80px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 15px;color:var(--text);position:relative;z-index:990}.brand{height:80px;display:flex;align-items:center;font-size:10px;font-weight:700;line-height:16px;letter-spacing:2px;text-transform:uppercase;white-space:nowrap}.desktop-nav{display:none}.actions{height:80px;display:flex;align-items:center;gap:20px}.phone{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:var(--text)}.phone svg{display:block;width:20px;height:20px;fill:currentColor}.tour{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border:2px solid var(--text);border-radius:50px;color:var(--text);background:#fff;font-size:11.5px;font-weight:900;line-height:40px;letter-spacing:1.5px}.hamb{position:relative;width:20px;height:80px;border:0;background:transparent;color:var(--text);padding:0;cursor:pointer}.hamb:before,.hamb:after,.hamb span{content:"";position:absolute;left:0;right:0;height:2px;background:currentColor}.hamb:before{top:31px}.hamb span{top:39px}.hamb:after{top:47px}
.hero{height:calc(100vh - 140px);height:calc(100svh - 140px);min-height:calc(100vh - 140px);min-height:calc(100svh - 140px);position:relative;overflow:hidden;background:var(--navy);display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 15px}.hero-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;z-index:0}.hero::after{content:"";position:absolute;inset:0;background:rgba(21,40,75,.36);z-index:1}.hero-inner{width:365px;max-width:100%;position:relative;z-index:2;margin-top:0}.review-rating{display:inline-flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 22px;color:#fff;text-transform:uppercase;font-family:Lato,Arial,sans-serif;font-size:13px;font-weight:900;line-height:20px;letter-spacing:2px;text-shadow:0 1px 8px rgba(0,0,0,.32);white-space:nowrap}.review-stars{position:relative;display:inline-block;font-family:Lato,Arial,sans-serif;font-size:24px;font-weight:900;line-height:1;letter-spacing:2px;color:rgba(255,255,255,.38)}.review-stars::before{content:"★★★★★";position:absolute;inset:0;width:var(--rating-percent);overflow:hidden;color:#fff}.review-meta{display:inline-block}.lble{width:min(318px,78vw);height:auto;margin:0 auto 24px;filter:drop-shadow(0 2px 14px rgba(0,0,0,.26))}.hero p{font-family:Lato,Arial,sans-serif;font-size:19px;line-height:26.6px;margin:0 auto 30px;font-weight:700;letter-spacing:.5px;max-width:360px;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.34)}.cta{display:inline-flex;align-items:center;justify-content:center;min-width:218px;min-height:56px;border:2px solid #fff;border-radius:50px;padding:0 30px;background:#fff;color:var(--text);font-family:Lato,Arial,sans-serif;font-size:15px;font-weight:900;line-height:52px;letter-spacing:1.5px}.cta span{font-size:18px;margin-left:10px}
.content-block{padding:70px 15px;background:var(--smoke);color:var(--navy);overflow:hidden}.content-block-features{background:#fff}.content-inner{max-width:1600px;margin:0 auto}.content-grid{display:grid;gap:28px}.content-copy h2{margin:0 0 20px;color:var(--navy);font-family:"Noto Serif",Georgia,"Times New Roman",serif;font-size:27px;font-weight:700;line-height:35.1px;letter-spacing:.5px}.content-copy p{margin:0 0 20px;color:var(--navy);font-family:Lato,Arial,sans-serif;font-size:18px;font-weight:400;line-height:29.25px}.content-copy strong{display:block;margin:0 0 14px;color:var(--navy);font-family:Lato,Arial,sans-serif;font-size:18px;font-weight:700;line-height:29.25px}.content-eyebrow{display:block;margin:0 0 14px;color:var(--blue);font-family:Lato,Arial,sans-serif;font-size:11px;font-weight:900;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase}.content-media{margin:6px 0 0;overflow:hidden;border-radius:6px;background:var(--smoke);aspect-ratio:3/2}.content-block-welcome .content-media{display:none}.content-media img{width:100%;height:100%;object-fit:cover}.content-award{display:block;width:64px;max-width:64px;height:auto;margin:32px 0 0}.content-bullets{display:grid;grid-template-columns:1fr;gap:10px 26px;margin:18px 0 0;padding:0;list-style:none;color:var(--navy)}.content-bullets li{position:relative;padding-left:16px;font-family:Lato,Arial,sans-serif;font-size:14px;font-weight:400;line-height:1.5}.content-bullets li:before{content:"";position:absolute;left:0;top:.72em;width:5px;height:5px;border-radius:50%;background:var(--blue)}.content-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:24px;padding:0 22px;border:2px solid var(--navy);border-radius:50px;color:var(--navy);background:transparent;font-family:Lato,Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:1.5px;line-height:40px}.content-btn-primary{background:var(--blue);border-color:var(--blue);color:#fff}
.native-continuation{min-height:640px;background:#fff;color:var(--text)}.native-continuation-status{min-height:28px;padding:14px 15px;text-align:center;font-size:11px;font-weight:700;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:var(--text)}.native-continuation-frame{display:block;width:100%;min-height:640px;border:0;background:#fff}.native-continuation-frame[hidden]{display:none}.native-continuation[data-native-continuation-state="idle"] .native-continuation-status{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.native-continuation[data-native-continuation-state="loaded"]{min-height:0}.native-continuation[data-native-continuation-state="loaded"] .native-continuation-status{display:none}
.drawer-scrim{position:fixed;inset:0;z-index:1190;background:rgba(0,0,0,.45)}.drawer-scrim[hidden]{display:none}.drawer{position:fixed;top:0;right:0;bottom:0;z-index:1200;width:270px;height:100svh;min-height:100vh;padding:50px 25px 34px;background:var(--navy);color:#fff;box-shadow:-20px 0 60px var(--shadow);transform:translateX(105%);transition:transform .18s ease;overflow:auto}.drawer[data-open="true"]{transform:translateX(0)}.drawer-close{position:absolute;top:5px;right:5px;width:37px;height:37px;border:0;background:transparent;color:#fff;font-size:34px;font-weight:300;line-height:37px;padding:0;cursor:pointer}.drawer-logo{display:block;width:40px;height:auto;margin:0 0 20px;color:#fff}.drawer-logo svg{display:block;width:40px;height:auto}.drawer nav{display:grid;gap:0;margin:0}.drawer nav a{display:block;padding:8px 0;color:#fff;font-size:15px;font-weight:700;line-height:24px;letter-spacing:.75px}.drawer-actions{display:flex;align-items:center;gap:10px;margin:20px 0 17px}.drawer-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border:2px solid rgba(255,255,255,.72);border-radius:50px;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;white-space:nowrap;color:#fff}.drawer-actions a:first-child{background:#fff;color:var(--navy);border-color:#fff}.drawer-phone{display:block;color:#fff;font-size:14px;font-weight:900;line-height:28px;letter-spacing:1.5px}.socials{display:flex;gap:22px;margin-top:20px}.socials a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:2px solid #fff;border-radius:50%;color:#fff;font-size:18px;font-weight:900}
@media (min-width:768px){html{font-size:18px}.promo{height:58px;line-height:58px;font-size:15px}.promo-drop{top:58px}.bar{height:92px;padding:0 44px;gap:30px}.brand{height:92px;font-size:17px;letter-spacing:4.8px;min-width:max-content}.desktop-nav{display:flex;align-items:center;justify-content:center;gap:22px;flex:1;min-width:0}.desktop-nav a{font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);white-space:nowrap}.actions{height:92px;gap:22px}.hamb{display:none}.phone,.phone svg{width:23px;height:23px}.tour{min-height:48px;padding:0 28px;font-size:12px;line-height:44px}.hero{height:calc(100vh - 150px);min-height:640px;max-height:760px;padding:0 44px}.hero-media{object-position:center center}.hero-inner{width:min(820px,88vw)}.review-rating{font-size:14px;line-height:22px;margin-bottom:24px}.review-stars{font-size:28px}.lble{width:min(520px,52vw);margin-bottom:26px}.hero p{font-size:24px;line-height:33px;max-width:760px;margin-bottom:34px}.cta{min-width:275px;min-height:64px;font-size:17px;line-height:60px}.content-block{min-height:740px;padding:120px 40px}.content-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:70px;align-items:center;justify-content:center}.content-copy h2{font-size:36px;line-height:1.3}.content-media{height:500px;aspect-ratio:auto;margin:0}.content-block-welcome .content-media{display:block}.content-block-features .content-media{order:-1}.content-bullets{grid-template-columns:1fr 1fr}}
@media (min-width:1100px){.desktop-nav{gap:30px}.hero p{font-size:40px;line-height:50px}.lble{width:520px}.brand{font-size:18px}}`;
}

function renderTopperShell(request, options = {}) {
  const includeMain = options.includeMain !== false;
  const wrap = Boolean(options.wrap);
  const contact = resolveContact(request);
  const hero = selectedHero(request);
  const heroMarkup = `<section class="hero"><img class="hero-media" src="${hero.href}" width="${hero.width}" height="${hero.height}" alt="" fetchpriority="high" decoding="sync"><div class="hero-inner">${renderReviewRating()}<img class="lble" src="${SHARED_ASSET_BASE}lble.svg" width="375" height="93" alt="${escapeHtml(PROPERTY.heroTitle)}"><p>${escapeHtml(PROPERTY.heroSubtitle)}</p><a class="cta" href="${PROPERTY.apartmentsHref}">Find Your Home <span>&rarr;</span></a></div></section>`;
  const contentBlocks = renderTopperContentBlocks();
  const shell = `<div class="promo-wrap"><button class="promo" data-promo-toggle aria-expanded="false">${escapeHtml(PROPERTY.promoText)} <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5"/></svg></button><div class="promo-drop" data-promo-drop hidden><button class="promo-close" data-promo-close aria-label="Close special">&times;</button><h3>${escapeHtml(PROPERTY.promoText)}</h3><p>${escapeHtml(PROPERTY.promoDetail)}</p><div class="promo-actions"><a href="${PROPERTY.specialsHref}">See Specials</a><a class="secondary" href="${PROPERTY.contactHref}">Contact Us</a></div></div></div>
<header class="bar"><a class="brand" href="/">${escapeHtml(PROPERTY.name)}</a>${renderDesktopNav()}<div class="actions"><a class="phone" href="${contact.phoneHref}" aria-label="Call ${escapeHtml(PROPERTY.name)}">${renderPhoneIcon()}</a><a class="tour" href="${PROPERTY.tourHref}">Tour</a><button class="hamb" data-drawer-open aria-label="Menu" aria-controls="calais-mobile-drawer"><span></span></button></div></header>
<div class="drawer-scrim" data-drawer-scrim hidden></div>
<aside class="drawer" id="calais-mobile-drawer" data-drawer data-open="false" aria-hidden="true" inert><button class="drawer-close" data-drawer-close aria-label="Close menu">&times;</button><a class="drawer-logo" href="/" aria-label="${escapeHtml(PROPERTY.name)} home">${renderLotusIcon()}</a><nav aria-label="Mobile menu"><a href="${PROPERTY.apartmentsHref}">Apartments &amp; Pricing</a><a href="${PROPERTY.featuresHref}">Features</a><a href="${PROPERTY.amenitiesHref}">Amenities</a><a href="${PROPERTY.galleryHref}">Gallery</a><a href="${PROPERTY.neighborhoodHref}">Neighborhood</a><a href="${PROPERTY.faqsHref}">FAQs</a><a href="${PROPERTY.contactHref}">Contact</a><a href="${PROPERTY.specialsHref}">Specials</a></nav><div class="drawer-actions"><a href="${PROPERTY.tourHref}">Tour</a><a href="${PROPERTY.applyHref}">Apply</a></div><a class="drawer-phone" href="${contact.phoneHref}">${escapeHtml(contact.phone)}</a>${renderSocialLinks()}</aside>
${includeMain ? `<main>${heroMarkup}${contentBlocks}</main>` : heroMarkup}
${renderTopperAnalytics(contact)}
${renderTopperBehavior()}
${renderZarazConsentPillScript()}`;
  if (!wrap) return shell;
  return `<div class="vtr-edge-topper" data-vtr-calais-topper="${VERSION}" data-vtr-calais-form-factor="${isMobileRequest(request) ? "mobile" : "desktop"}">${shell}</div>`;
}

function renderMobileTopper(request, options = {}) {
  const preview = Boolean(options.preview);
  const hero = selectedHero(request);
  const contact = resolveContact(request);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: PROPERTY.name,
    url: `${ORIGIN}/`,
    address: {
      "@type": "PostalAddress",
      streetAddress: PROPERTY.streetAddress,
      addressLocality: PROPERTY.addressLocality,
      addressRegion: PROPERTY.addressRegion,
      postalCode: PROPERTY.postalCode,
      addressCountry: "US",
    },
    telephone: contact.phoneHref.replace("tel:", ""),
    image: `${ORIGIN}${hero.href}`,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: REVIEW_SUMMARY.ratingValue,
      bestRating: 5,
      reviewCount: REVIEW_SUMMARY.reviewCount,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${preview ? "noindex,nofollow" : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"}">
<title>${escapeHtml(PROPERTY.title)}</title>
<meta name="description" content="${escapeHtml(PROPERTY.description)}">
<link rel="canonical" href="${ORIGIN}/">
<meta property="og:title" content="${escapeHtml(PROPERTY.title)}">
<meta property="og:description" content="${escapeHtml(PROPERTY.description)}">
<meta property="og:url" content="${ORIGIN}/">
<meta property="og:image" content="${ORIGIN}${hero.href}">
<link rel="icon" href="${PROPERTY.faviconPngHref}" sizes="any">
<link rel="icon" href="${PROPERTY.faviconSvgHref}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${PROPERTY.appleTouchIconHref}">
${renderFontPreloadLinks()}
<link rel="preload" as="image" href="${hero.href}" type="${hero.type}" fetchpriority="high">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>${renderTopperCss()}</style>
</head>
<body data-vtr-calais-topper="${VERSION}" data-vtr-calais-form-factor="${isMobileRequest(request) ? "mobile" : "desktop"}">
${renderTopperShell(request)}
${renderNativeContinuationShell(request)}
${renderNativeContinuationLoader()}
</body>
</html>`;
}

function stripNativePreviewAnalytics(html) {
  return html
    .replace(/\s*<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, (block) => {
      const tag = (block.match(/^<script\b[^>]*>/i) || [""])[0].toLowerCase();
      const lower = block.toLowerCase();
      if (tag.includes("data-vtr-") || tag.includes("/cdn-cgi/zaraz") || lower.includes("mjq.zaraz")) return block;
      if (lower.includes("googletagmanager.com/gtag/js")) return "\n";
      if (lower.includes("googletagmanager.com/gtm.js")) return "\n";
      if (lower.includes("window.ga_measurement_id")) return "\n";
      if (lower.includes("function gtag()")) return "\n";
      if (lower.includes("gtag('config'") || lower.includes('gtag("config"')) return "\n";
      if (lower.includes("heap.load") || lower.includes("cdn.us.heap-api.com/config")) return "\n";
      if (lower.includes("t.contentsquare.net") || lower.includes("tcvsapi.contentsquare.com")) return "\n";
      return block;
    })
    .replace(/\s*<noscript\b[^>]*>[\s\S]*?<\/noscript>\s*/gi, (block) => (
      /googletagmanager\.com\/ns\.html|GTM-NLZ9PJ8N/i.test(block) ? "\n" : block
    ));
}

function repairNativeReviewIconSources(html) {
  return html
    .replace(/srcset="\/wp-content\/uploads\/yootheme\/cache\/[^"]*google_g_icon_download[^"]*"/gi, 'srcset="/wp-content/uploads/2026/01/google_g_icon_download.png 60w"')
    .replace(/src="\/wp-content\/uploads\/yootheme\/cache\/[^"]*google_g_icon_download[^"]*"/gi, 'src="/wp-content/uploads/2026/01/google_g_icon_download.png"');
}

function normalizeNativeHtml(html) {
  return repairNativeReviewIconSources(stripNativePreviewAnalytics(html))
    .replace(/data-property-name="[^"]*"/gi, 'data-property-name="Calais Midtown"')
    .replace(/data-property-code="[^"]*"/gi, 'data-property-code="TX4MI"')
    .replace(/GA4CM/g, "TX4MI")
    .replace(/Canton Mill Lofts/gi, "Calais Midtown");
}

function nativeContinuationHiddenCss() {
  return `body.vtr-calais-native-continuation .tm-header,
body.vtr-calais-native-continuation .tm-header-mobile,
body.vtr-calais-native-continuation .uk-notification,
body.vtr-calais-native-continuation .uk-hidden-visually,
body.vtr-calais-native-continuation a[href="#tm-main"],
body.vtr-calais-native-continuation a[href="#main"],
body.vtr-calais-native-continuation a[href="#main-content"],
body.vtr-calais-native-continuation a[class*="skip"],
body.vtr-calais-native-continuation [data-page-section="promo_bar"],
body.vtr-calais-native-continuation [data-component-name="open_promo_bar"],
body.vtr-calais-native-continuation [data-page-section="hero"],
body.vtr-calais-native-continuation [data-page-section="welcome"],
body.vtr-calais-native-continuation [data-page-section="apartment_features"]{display:none!important}`;
}

function integratedTopperCss() {
  return `
body.vtr-calais-integrated-topper{margin:0!important;background:#fff!important}
body.vtr-calais-integrated-topper .vtr-edge-topper{display:block;position:relative;z-index:1;background:#fff}
body.vtr-calais-integrated-topper .tm-page{margin-top:0!important}
body.vtr-calais-integrated-topper #tm-main{margin-top:0!important}
body.vtr-calais-integrated-topper .tm-header,
body.vtr-calais-integrated-topper .tm-header-mobile,
body.vtr-calais-integrated-topper .uk-notification,
body.vtr-calais-integrated-topper [data-page-section="promo_bar"],
body.vtr-calais-integrated-topper [data-component-name="open_promo_bar"],
body.vtr-calais-integrated-topper [data-page-section="hero"]{display:none!important}
body.vtr-calais-integrated-topper > a[href="#tm-main"],
body.vtr-calais-integrated-topper > a[href="#main"],
body.vtr-calais-integrated-topper > a[href="#main-content"],
body.vtr-calais-integrated-topper > a[class*="skip"]{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}
body.vtr-calais-integrated-topper .vtr-edge-topper + .tm-page{display:block!important}
`;
}

class IntegratedTopperHeadRewriter {
  constructor(request) {
    this.request = request;
  }

  element(element) {
    const hero = selectedHero(this.request);
    element.append(`<link rel="preload" as="image" href="${hero.href}" type="${hero.type}" fetchpriority="high">
<style data-vtr-calais-integrated-topper="1">
${renderTopperCss()}
${integratedTopperCss()}
</style>`, { html: true });
  }
}

class IntegratedTopperBodyRewriter {
  constructor(request) {
    this.request = request;
  }

  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-calais-integrated-topper"));
    element.setAttribute("data-vtr-calais-topper", VERSION);
    element.setAttribute("data-vtr-calais-form-factor", isMobileRequest(this.request) ? "mobile" : "desktop");
    element.prepend(renderTopperShell(this.request, { includeMain: false, wrap: true }), { html: true });
  }
}

class NativeContinuationHeadRewriter {
  element(element) {
    element.prepend(`<base href="${ORIGIN}/">`, { html: true });
    element.append(`<style data-vtr-native-continuation="1">
${nativeContinuationHiddenCss()}
html{margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}
body{margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}
.vtr-calais-native-continuation-frame-marker{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
</style>`, { html: true });
  }
}

class NativeContinuationBodyRewriter {
  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-calais-native-continuation"));
    element.prepend(`<div class="vtr-calais-native-continuation-frame-marker" data-vtr-native-continuation-frame="1">Native continuation loaded</div>`, { html: true });
    element.append(`<script data-vtr-native-continuation-resize="1">(function(){function postHeight(){var body=document.body,doc=document.documentElement;var height=Math.max(body?body.scrollHeight:0,body?body.offsetHeight:0,doc?doc.scrollHeight:0,doc?doc.offsetHeight:0);try{parent.postMessage({type:"vtr-native-continuation-height",height:height},location.origin)}catch(e){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",postHeight,{once:true});}else{postHeight();}addEventListener("load",postHeight,{once:true});if("ResizeObserver"in window&&document.body){new ResizeObserver(postHeight).observe(document.body);}setTimeout(postHeight,250);setTimeout(postHeight,1000);setTimeout(postHeight,2500);setTimeout(postHeight,5000);})();</script>`, { html: true });
  }
}

async function renderNativeContinuationResponse(request) {
  const originResponse = await fetch(buildOriginRequest(request, "/"), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) {
    return originResponse;
  }

  const html = normalizeNativeHtml(await originResponse.text());
  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("x-vtr-calais-topper", VERSION);
  headers.set("x-vtr-calais-native-continuation", "1");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", 'vtr_calais_native_continuation;desc="lazy"');

  return new HTMLRewriter()
    .on("head", new NativeContinuationHeadRewriter())
    .on("body", new NativeContinuationBodyRewriter())
    .transform(new Response(html, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    }));
}

async function renderDesktopPreviewPassThrough(request, env) {
  const originResponse = await fetch(buildOriginRequest(request, null, [env.EDGE_PREVIEW_PARAM || GATE_PARAM]), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
  const headers = new Headers(originResponse.headers);
  headers.set("x-vtr-calais-topper", VERSION);
  headers.set("x-vtr-calais-mode", "desktop-native-preview");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", 'vtr_calais_desktop;desc="native-preview"');
  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });
}

async function renderIntegratedMobileTopperResponse(request, env, preview) {
  const originResponse = await fetch(buildOriginRequest(request, null, [env.EDGE_PREVIEW_PARAM || GATE_PARAM]), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) {
    return originResponse;
  }
  const html = normalizeNativeHtml(await originResponse.text());

  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", preview ? "private, no-store" : "public, max-age=120, stale-while-revalidate=600");
  headers.set("x-vtr-calais-topper", VERSION);
  headers.set("x-vtr-calais-mobile-topper", preview ? "preview-integrated" : "production-integrated");
  headers.set("vary", "User-Agent");
  if (preview) headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", `vtr_calais_mobile_topper;desc="${preview ? "integrated-preview" : "integrated-production"}"`);
  headers.append("link", preloadLinkHeader(request));

  return new HTMLRewriter()
    .on("head", new IntegratedTopperHeadRewriter(request))
    .on("body", new IntegratedTopperBodyRewriter(request))
    .transform(new Response(html, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === CS_VERIFY_SUPPRESSED_PATH ||
      (isHomepage(url) && url.searchParams.get(CS_VERIFY_SUPPRESSED_PARAM) === "1")
    ) {
      return noContentResponse();
    }
    const asset = ASSETS[url.pathname];
    if (asset) return serveAsset(request, asset);
    if (url.pathname === KINGSLEY_AWARD_PATH) {
      return serveRemoteAsset(request, KINGSLEY_AWARD_URL, "image/svg+xml; charset=utf-8");
    }
    if (url.pathname.includes("google_g_icon_download")) return serveNativeGoogleReviewIcon(request);

    if (url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        templateVersion: VERSION,
        mode: "mobile-topper-standalone-shell",
        propertyCode: PROPERTY.code,
        propertyName: PROPERTY.name,
        previewOnly: false,
        productionRouteAttached: true,
        nativePassThroughDefault: true,
        gateParam: env.EDGE_PREVIEW_PARAM || GATE_PARAM,
        gateValue: env.EDGE_PREVIEW_VALUE || GATE_VALUE,
      });
    }

    if (url.pathname === "/manifest") {
      return jsonResponse({
        templateVersion: VERSION,
        mode: "mobile-topper-standalone-shell",
        property: PROPERTY,
        assets: Object.keys(ASSETS),
        gates: {
          productionRoute: "mobile_homepage_only",
          analyticsOwnership: "zaraz_configured",
          mobileTopperPattern: "standalone_shell_with_first_two_blocks",
          contentBlocks: ["welcome", "features"],
          nativePassThrough: "required_for_desktop_and_subpages",
        },
      });
    }

    if (url.pathname === "/favicon.ico") return serveNativeFavicon(request);

    if (isWordPressControlRequest(request, url)) {
      return passThroughNativeTransparent(request, [env.EDGE_PREVIEW_PARAM || GATE_PARAM]);
    }

    if (url.searchParams.get(NATIVE_CONTINUATION_PARAM) === "1" && isHomepage(url)) {
      return renderNativeContinuationResponse(request);
    }

    if (request.method === "GET" && isHtmlRequest(request) && isHomepage(url)) {
      const preview = isPreviewRequest(url, env);
      if (isMobileRequest(request) && preview) {
        return new Response(renderMobileTopper(request, { preview: true }), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "private, no-store",
            "x-vtr-calais-topper": VERSION,
            "x-vtr-calais-mobile-topper": "preview-standalone-shell",
            "x-vtr-calais-architecture": "standalone-mobile-shell",
            "x-robots-tag": "noindex, nofollow",
            "vary": "User-Agent",
            "link": preloadLinkHeader(request),
            "server-timing": 'vtr_calais_mobile_topper;desc="preview-standalone-shell"',
          },
        });
      }
      if (isMobileRequest(request) && isProductionTopperEnabled(env)) {
        return new Response(renderMobileTopper(request, { preview: false }), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=120, stale-while-revalidate=600",
            "x-vtr-calais-topper": VERSION,
            "x-vtr-calais-mobile-topper": "production-standalone-shell",
            "x-vtr-calais-architecture": "standalone-mobile-shell",
            "vary": "User-Agent",
            "link": preloadLinkHeader(request),
            "server-timing": 'vtr_calais_mobile_topper;desc="production-standalone-shell"',
          },
        });
      }
      if (preview) return renderDesktopPreviewPassThrough(request, env);
    }

    return passThroughNativeCleanHtml(request, [env.EDGE_PREVIEW_PARAM || GATE_PARAM]);
  },
};
