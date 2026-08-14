import OFFICIAL_LBLE_SVG from "./lble.svg";
import BUNDLED_HERO_MOBILE_AVIF from "./hero-mobile-750x1000.avif";

// Portfolio Resi Edge Stabilization — Champion's Green (GA4CG)
// Architecture: production mobile standalone shell calibrated from native geometry.
// Mobile homepage: edge-owned topper with lazy native continuation.
// Desktop/other traffic: native clean pass-through with Zaraz CMP.
// Template input is intentionally concentrated in PROPERTY, ASSET_KEYS, and ANALYTICS.
// Future properties should change data/config only, then pass /health config validation.
//
// Preview gate: championsgreen-ga.com/?edge_preview=1
// Rollback: set EDGE_SHELL_ENABLED="false" in wrangler.toml [vars] + redeploy.

const PROPERTY = {
  code: "GA4CG",
  name: "Champions Green",
  origin: "https://championsgreen-ga.com",
  cityState: "Alpharetta, GA",
  pageTitle: "Champions Green Apartments in Alpharetta, GA",
  metaDescription: "Welcome home to Champions Green Apartments in Alpharetta, GA \u2014 Discover luxury living in our 1, 2, and 3 bedroom homes.",
  canonicalHref: "https://championsgreen-ga.com/",
  ogImage: "https://championsgreen-ga.com/wp-content/uploads/2026/03/Champions-Green-Home-Hero_WEB.jpg",
  streetAddress: "1001 Champions Green Parkway",
  addressLocality: "Alpharetta",
  addressRegion: "GA",
  postalCode: "30022",
  addressCountry: "US",
  latitude: 34.004342,
  longitude: -84.28304,
  email: "venterra_championsgreen_website@leads.anyonehome.com",
  // Dynamic — read from native on cache miss; fallback values below
  phoneLabel: "(470) 999-7208",
  phoneHref: "tel:+14709997208",
  tourHref: "https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/GA4CG",
  applyHref: "https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/GA4CG",
  apartmentsHref: "/apartments/",
  featuresHref: "/features/",
  specialsHref: "/specials/",
  amenitiesHref: "/amenities/",
  galleryHref: "/gallery/",
  neighborhoodHref: "/neighborhood/",
  faqsHref: "/faqs/",
  reviewsHref: "/reviews/",
  contactHref: "/contact/",
  aboutHref: "/about/",
  smartHubHref: "https://online.venterraliving.com/smarthub/login",
  promoEnabled: true,
  promoText: "Up to $1,000 off for a limited time!",
  promoDetail: "*Select Homes \u2013 Limited Time Offer",
  promoImageUrl: "/assets/resi-edge-assets/GA4CG/home/amenities-900.avif",
  promoAvailabilityHref: "/apartments/?has_specials=true",
  heroHeadline: "1, 2, and 3 Bedroom Apartments in Alpharetta, GA",
  rating: "4.3",
  reviewCount: "284",
  kingsleyAwardUrl: "/assets/resi-edge-assets/shared/kingsley-award.svg",
  // Welcome section — from native site
  welcomeTitle: "Welcome to Champions Green",
  welcomeKicker: "Choose the perfect layout for your lifestyle.",
  welcomeBody: "In Alpharetta, Champions Green offers a welcoming sense of space, light, and comfort in a city known for its energy and innovation. Thoughtfully designed homes create room to spread out and settle in, while the surrounding Alpharetta lifestyle keeps you close to what matters\u2014making every day feel easy and connected.",
  // Features section — from native site
  featuresEyebrow: "Apartment Features",
  featuresTitle: "Stylish Living Spaces",
  featuresBody: "Spread out in spacious interiors with full appliance packages, full-size washers and dryers, abundant natural light, bonus storage, and massive walk-in closets\u2014plus select features like fireplaces, digital thermostats, sunrooms, and extra outdoor storage for added flexibility.",
  featureBullets: ["Full-Size Washer/Dryer", "Massive Walk-In Closets", "Sunrooms", "Digital Thermostats"],
  reviewQuote: "I'm at champions green apts right now filling an application and KALYN WILSON is so nice and helpful me and my family...",
  reviewAuthor: "Mam Torres",
  amenitiesEyebrow: "Community Amenities",
  amenitiesTitle: "Upscale Luxuries",
  amenitiesBody: "Enjoy a welcoming community designed for relaxation, recreation, and everyday convenience\u2014spend sunny afternoons by the resort-style pool and sundeck, stay active in the 24-hour fitness center or on the tennis courts, and gather with friends at the outdoor picnic area while pets enjoy the bark park.",
  amenityBullets: ["Resort-Style Pool & Sundeck", "24-Hour Fitness Center", "Tennis Courts", "Bark Park"],
  benefitsTitle: "Get the Most From Where You Live",
  benefitsPetTitle: "A community built for pets (and their people)",
  benefitsPetBody: "We don't just allow pets, we celebrate them. Our pet-friendly communities welcome up to three furry family members because we know home isn't complete without the whole crew.",
  benefitsPetBullets: ["Up to 3 pets welcome per apartment", "No weight limits", "Flexible breed policies", "Open spaces where pets can play, explore and feel right at home"],
  neighborhoodEyebrow: "Living Well in Alpharetta, GA",
  neighborhoodTitle: "Explore the Neighborhood",
  careTitle: "Care Means More Here",
  oneBedroomLabel: "1 Bedrooms from $1,238",
  twoBedroomLabel: "2 Bedrooms from $1,453",
  threeBedroomLabel: "3 Bedrooms from $1,996",
  // Social
  facebookHref: "https://www.facebook.com/Champions-Green-Apartments-303641463333364",
  instagramHref: "https://www.instagram.com/championsgreen/",
  mapsHref: "https://search.google.com/local/reviews?placeid=ChIJaSd81aIK9YgRUPKCIA3c-Z4",
  faviconPngHref: "/wp-content/uploads/2026/01/favicon.png",
  faviconSvgHref: "/wp-content/uploads/2026/01/favicon.svg",
  appleTouchIconHref: "/wp-content/uploads/2026/01/apple-touch-icon.png"
};

const SOURCE_ATTRIBUTION = {
  source: "reports/resi_source_lookup/latest-resi-source-lookup.kv.json",
  generatedRunId: "resi_source_lookup_0995b04ee0a8",
  externalSourceField: "id",
  defaultTrackingId: "GA4CG30L",
  sources: {
    GA4CG30L: {
      trackingId: "GA4CG30L",
      marketingSourceCd: "VWS",
      phone: "(470) 999-7208",
      email: "venterra_championsgreen_website_vl@leads.anyonehome.com"
    },
    GA4CGGOA: {
      trackingId: "GA4CGGOA",
      marketingSourceCd: "GOA",
      phone: "(770) 574-4050",
      email: "venterra_championsgreen_google_ads_vl@leads.anyonehome.com"
    }
  }
};

const ASSET_KEYS = {
  heroMobile: "resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif",
  heroDesktop: "resi-edge-assets/GA4CG/home/hero-desktop-1600.avif",
  welcome: "resi-edge-assets/GA4CG/home/welcome-640.avif",
  features: "resi-edge-assets/GA4CG/home/features-900.avif",
  amenities: "resi-edge-assets/GA4CG/home/amenities-900.avif",
  benefitsPets: "resi-edge-assets/shared/venterra-benefits-pets-900.avif",
  benefitsTech: "resi-edge-assets/shared/venterra-benefits-tech-900.avif",
  benefitsPerks: "resi-edge-assets/shared/venterra-benefits-perks-900.avif",
  lble: "resi-edge-assets/shared/lble.svg"
};
const EDGE_FONT_PREFIX = "resi-edge-assets/shared/fonts/";
const EDGE_FONT_FILES = new Set([
  "lato-71f7cc3a.woff2",
  "lato-9b155c87.woff2",
  "lato-78f0db0a.woff2",
  "notoserif-194b0294.woff2",
  "BrittanySignature.woff2"
]);

const NEIGHBORHOOD_IMAGES = [
  ["https://dam.getresi.co/3018/conversions/Venterra_Home_Neighborhood_Community-Focus-full.jpg", "Community Focused"],
  ["https://dam.getresi.co/2963/conversions/home_neighborhood_retail-access-full.jpg", "Retail Access"],
  ["https://dam.getresi.co/3020/conversions/Venterra_Home_Neighborhood_Easy-Commute-full.jpg", "Easy Commute"]
];

const CARE_IMAGE_URL = "https://dam.getresi.co/10519/conversions/96b12eba-0ed5-4bf9-bc62-1e7fec9a6d71-full.jpg";
const NATIVE_HERO_IMAGE_URL = "https://dam.getresi.co/10397/conversions/Champions-Green-Home-Hero_WEB-full.jpg";
const KINGSLEY_AWARD_DAM_URL = "https://dam.getresi.co/2949/Kingsley_Award.svg";
const TRANSPARENT_PIXEL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

const ANALYTICS = {
  propertyCode: "GA4CG",
  communityId: "18ec38d1-b4ec-4cf4-aba8-23ee58c99d8c",
  propertyName: "Champions Green",
  source: "resi_edge_shell",
  schemaVersion: "champions-locked-mobile-upgrade-contract"
};

const TEMPLATE = {
  version: "champions-locked-mobile-upgrade-contract",
  mode: "performance-topper",
  propertyCode: PROPERTY.code
};

const ORIGIN_PASSTHROUGH_RESET = false;

const EXACT_NATIVE_PERFORMANCE = {
  heroSourceIncludes: "Champions-Green-Home-Hero",
  removeScriptSrcIncludes: [
    "/wp-includes/js/jquery/jquery-migrate.min.js",
    "/wp-content/plugins/resi-elements-v2/src/filters.js",
    "/wp-content/plugins/resi-elements-v2/assets/ie-11.js",
    "https://www.googletagmanager.com/gtag/js",
    "https://js.getresi.co/pixel/"
  ],
  removeInlineScriptIds: [
    "wp-emoji-settings",
    "resi-pixel-js-before"
  ],
  removeInlineScriptTypes: [
    "speculationrules"
  ],
  dedupeStylesheetHrefIncludes: [
    "/wp-content/themes/resi-child-theme/css/custom.css"
  ],
  delayImageSrcIncludes: [
    "https://dam.getresi.co/"
  ]
};

const DESKTOP_GUARDS = {
  enabled: false,
  heroSourceIncludes: "Champions-Green-Home-Hero",
  mode: "native-desktop-guards-v2",
  removeScriptSrcIncludes: [
    "/wp-includes/js/jquery/jquery-migrate.min.js",
    "/wp-content/plugins/resi-elements-v2/src/filters.js"
  ],
  dedupeStylesheetHrefIncludes: [
    "/wp-content/themes/resi-child-theme/css/custom.css"
  ]
};

const GATE_PARAM = "edge_preview";
const GATE_VALUE = "1";
const NATIVE_CONTINUATION_PATH = "/__resi-edge/native-continuation";
const ZARAZ_CONSENT_UI_PATH = "/__vtr/zaraz-consent-ui.js";
const TOPPER_ANALYTICS_PATH = "/__vtr/topper-analytics.js";
const CONTENTSQUARE_VERIFY_SUPPRESS_PATH = "/__vtr/contentsquare-verify-suppressed.json";
const CACHE_BYPASS_PARAMS = ["edge_shell_rest", "preview", "preview_id", "static_hero_poc"];
const RUNTIME_PROPERTY_CACHE_PATH = "/__vtr-edge-runtime-property/GA4CG/home";
const RUNTIME_PROPERTY_CACHE_VERSION = "2026-08-08-native-specials-v3";
const RUNTIME_PROPERTY_CACHE_TTL_SECONDS = 300;
const NATIVE_PROMO_FETCH_TIMEOUT_MS = 1200;
const NATIVE_DESKTOP_REQUIRED_STYLESHEETS = [
  {
    id: "resi-utility-css-css",
    href: "https://championsgreen-ga.com/wp-content/plugins/resi-elements-v2/assets/utility.css?ver=7.0.3",
    media: "all"
  },
  {
    id: "resi-custom-css-css",
    href: "https://championsgreen-ga.com/wp-content/themes/resi-child-theme/css/custom.css?ver=1763505492",
    media: "all"
  },
  {
    id: "theme-style-css",
    href: "https://championsgreen-ga.com/wp-content/themes/resi-child-theme/css/theme.1.css?ver=1774529571",
    media: "all"
  }
];

const MIME_TYPES = {
  avif: "image/avif", webp: "image/webp", svg: "image/svg+xml",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  json: "application/json; charset=utf-8"
};

const REQUIRED_CONFIG_PATHS = [
  "PROPERTY.code",
  "PROPERTY.name",
  "PROPERTY.origin",
  "PROPERTY.phoneHref",
  "PROPERTY.tourHref",
  "PROPERTY.applyHref",
  "PROPERTY.apartmentsHref",
  "PROPERTY.featuresHref",
  "PROPERTY.promoEnabled",
  "PROPERTY.promoText",
  "PROPERTY.promoDetail",
  "PROPERTY.promoImageUrl",
  "PROPERTY.promoAvailabilityHref",
  "PROPERTY.kingsleyAwardUrl",
  "PROPERTY.heroHeadline",
  "PROPERTY.welcomeTitle",
  "PROPERTY.welcomeBody",
  "PROPERTY.featuresEyebrow",
  "PROPERTY.featuresTitle",
  "PROPERTY.featuresBody",
  "PROPERTY.featureBullets",
  "PROPERTY.reviewQuote",
  "PROPERTY.reviewAuthor",
  "PROPERTY.amenitiesEyebrow",
  "PROPERTY.amenitiesTitle",
  "PROPERTY.amenitiesBody",
  "PROPERTY.amenityBullets",
  "PROPERTY.benefitsTitle",
  "PROPERTY.benefitsPetTitle",
  "PROPERTY.benefitsPetBody",
  "PROPERTY.benefitsPetBullets",
  "PROPERTY.neighborhoodEyebrow",
  "PROPERTY.neighborhoodTitle",
  "PROPERTY.careTitle",
  "PROPERTY.oneBedroomLabel",
  "PROPERTY.twoBedroomLabel",
  "PROPERTY.threeBedroomLabel",
  "ASSET_KEYS.heroMobile",
  "ASSET_KEYS.heroDesktop",
  "ASSET_KEYS.welcome",
  "ASSET_KEYS.features",
  "ASSET_KEYS.amenities",
  "ASSET_KEYS.benefitsPets",
  "ASSET_KEYS.benefitsTech",
  "ASSET_KEYS.benefitsPerks",
  "ASSET_KEYS.lble",
  "ANALYTICS.propertyCode",
  "ANALYTICS.communityId"
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function assetUrl(key) {
  return `/assets/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}
function assetAbsolute(path) {
  return new URL(path, PROPERTY.origin).toString();
}
function exactNativeHeroUrl(variant) {
  return variant === "mobile" ? assetUrl(ASSET_KEYS.heroMobile) : NATIVE_HERO_IMAGE_URL;
}
function exactNativeHeroAbsolute(variant) {
  return assetAbsolute(exactNativeHeroUrl(variant));
}
function escapeHtml(v) {
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escapeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function compactHtml(html) {
  return String(html || "").replace(/>\s+</g, "><");
}
function propertyAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: PROPERTY.streetAddress,
    addressLocality: PROPERTY.addressLocality,
    addressRegion: PROPERTY.addressRegion,
    postalCode: PROPERTY.postalCode,
    addressCountry: PROPERTY.addressCountry
  };
}
function propertyGeo() {
  return {
    "@type": "GeoCoordinates",
    latitude: PROPERTY.latitude,
    longitude: PROPERTY.longitude
  };
}
function renderHeadMeta(options = {}) {
  const preview = options.preview === true;
  const canonical = PROPERTY.canonicalHref || `${PROPERTY.origin}/`;
  const description = PROPERTY.metaDescription || `${PROPERTY.pageTitle}.`;
  const ogImage = PROPERTY.ogImage || NATIVE_HERO_IMAGE_URL;
  const ratingValue = Number(PROPERTY.rating);
  const reviewCount = parseInt(String(PROPERTY.reviewCount || "").replace(/\D+/g, ""), 10);
  const aggregateRating = Number.isFinite(ratingValue) && reviewCount > 0 ? {
    "@type": "AggregateRating",
    ratingValue,
    bestRating: 5,
    worstRating: 1,
    reviewCount
  } : null;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: PROPERTY.name,
      alternateName: PROPERTY.pageTitle,
      description,
      url: PROPERTY.origin
    },
    {
      "@context": "https://schema.org",
      "@type": "ApartmentComplex",
      name: PROPERTY.name,
      url: PROPERTY.origin,
      image: ogImage,
      telephone: PROPERTY.phoneLabel,
      address: propertyAddress(),
      geo: propertyGeo(),
      hasMap: PROPERTY.mapsHref,
      petsAllowed: true,
      tourBookingPage: PROPERTY.tourHref,
      ...(aggregateRating ? { aggregateRating } : {}),
      amenityFeature: PROPERTY.amenityBullets.map((name) => ({ "@type": "LocationFeatureSpecification", name }))
    }
  ];
  return `<title>${escapeHtml(PROPERTY.pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${preview ? "noindex,nofollow" : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="shortcut icon" href="${assetAbsolute(PROPERTY.faviconPngHref)}">
  <link rel="icon" href="${assetAbsolute(PROPERTY.faviconPngHref)}" sizes="any" type="image/png">
  <link rel="icon" href="${assetAbsolute(PROPERTY.faviconSvgHref)}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${assetAbsolute(PROPERTY.appleTouchIconHref)}">
  <meta property="og:locale" content="en_US">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(PROPERTY.name)}">
  <meta property="og:title" content="${escapeHtml(PROPERTY.pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:secure_url" content="${escapeHtml(ogImage)}">
  <meta property="og:image:alt" content="${escapeHtml(PROPERTY.pageTitle)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(PROPERTY.pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  ${schema.map((item) => `<script type="application/ld+json">${escapeJsonForHtml(item)}</script>`).join("\n  ")}`;
}
function lookupConfig(path) {
  const [root, key] = path.split(".");
  const source = root === "PROPERTY" ? PROPERTY : root === "ASSET_KEYS" ? ASSET_KEYS : root === "ANALYTICS" ? ANALYTICS : null;
  return source ? source[key] : undefined;
}
function validateShellConfig() {
  const missing = REQUIRED_CONFIG_PATHS.filter((path) => {
    if (!PROPERTY.promoEnabled && path.startsWith("PROPERTY.promo") && path !== "PROPERTY.promoEnabled") {
      return false;
    }
    const value = lookupConfig(path);
    return value === undefined || value === null || String(value).trim() === "";
  });
  return { ok: missing.length === 0, missing, template: TEMPLATE };
}
function renderWithRuntimeProperty(property, renderer) {
  const previous = { ...PROPERTY };
  Object.assign(PROPERTY, property || {});
  try {
    return renderer();
  } finally {
    for (const key of Object.keys(PROPERTY)) {
      if (!(key in previous)) delete PROPERTY[key];
    }
    Object.assign(PROPERTY, previous);
  }
}
function jsonResponse(payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function renderZarazConsentPillScript() {
  return `<script data-vtr-zaraz-consent-pill="1">(function(w,d){if(w.__vtrZarazConsentPill)return;w.__vtrZarazConsentPill=true;var storageKey="vtr_zaraz_consent_notice_done_v2";var rootId="vtr-cookie-notice";function ready(fn){d.readyState==="loading"?d.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}function z(){return w.zaraz&&w.zaraz.consent}function choices(){var c=z();return c&&typeof c.getAll==="function"?c.getAll():null}function done(){try{return localStorage.getItem(storageKey)==="1"}catch(e){return false}}function mark(){try{localStorage.setItem(storageKey,"1")}catch(e){}}function shouldShow(){if(done()||/(?:^|; )zaraz-consent=/.test(d.cookie||""))return false;var c=choices();return !c||Object.values(c).every(function(v){return v===false})}function remove(){var el=d.getElementById(rootId);if(el)el.remove()}function setAll(value){var c=z();if(!c)return false;if(typeof c.setAll==="function")c.setAll(value);else if(typeof c.set==="function"){var all=choices()||{};var payload={};Object.keys(all).forEach(function(k){payload[k]=value});c.set(payload)}if(value&&typeof c.sendQueuedEvents==="function")c.sendQueuedEvents();d.dispatchEvent(new Event("zarazConsentChoicesUpdated"));mark();remove();return true}function openPrefs(){remove();if(w.zaraz&&typeof w.zaraz.showConsentModal==="function")w.zaraz.showConsentModal()}function show(){if(!shouldShow()||d.getElementById(rootId))return;var style=d.createElement("style");style.id="vtr-cookie-notice-style";style.textContent="#vtr-cookie-notice{position:fixed;left:50%;right:auto;bottom:28px;z-index:2147482500;display:flex;align-items:center;gap:22px;box-sizing:border-box;width:max-content;max-width:calc(100vw - 32px);min-height:84px;margin:0;padding:10px 18px 10px 20px;border:1px solid #EBECEA;border-radius:999px;background:#FFFFFF;color:#15284B;box-shadow:0 18px 32px rgba(0,0,0,.18),0 3px 8px rgba(21,40,75,.08);font-family:Lato,Arial,sans-serif;transform:translateX(-50%)}#vtr-cookie-icon{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:48px;height:48px;color:#15284B}#vtr-cookie-icon svg{display:block;width:40px;height:40px}#vtr-cookie-notice p{flex:0 0 auto;margin:0;color:#1f2937;font-size:24px;font-weight:400;line-height:1.2;white-space:nowrap}#vtr-cookie-notice-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto}#vtr-cookie-notice button{box-sizing:border-box;height:60px;margin:0;padding:0 32px;border-radius:999px;font-family:Lato,Arial,sans-serif;font-size:24px;font-weight:900;letter-spacing:0;line-height:58px;white-space:nowrap;cursor:pointer}#vtr-cookie-manage{min-width:198px;border:2px solid rgba(125,202,194,.24);background:#FFFFFF;color:#2B2B2B;box-shadow:none}#vtr-cookie-manage:hover{border-color:rgba(125,202,194,.44);background:#F6F6F5}#vtr-cookie-accept{min-width:144px;border:2px solid #7DCAC2;background:#7DCAC2;color:#15284B;box-shadow:none}#vtr-cookie-accept:hover{border-color:#3B9189;background:#3B9189;color:#FFFFFF}#vtr-cookie-notice button:focus{outline:3px solid #7DCAC2;outline-offset:2px}@media(max-width:740px){#vtr-cookie-notice{left:10px;right:10px;bottom:10px;width:auto;max-width:none;min-height:0;display:grid;grid-template-columns:auto 1fr;gap:10px 12px;padding:12px;border-radius:24px;transform:none}#vtr-cookie-icon{width:36px;height:36px}#vtr-cookie-icon svg{width:32px;height:32px}#vtr-cookie-notice p{align-self:center;font-size:16px;white-space:normal}#vtr-cookie-notice-actions{grid-column:1/3;display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}#vtr-cookie-notice button{width:100%;height:44px;padding:0 12px;font-size:15px;line-height:42px}#vtr-cookie-manage,#vtr-cookie-accept{min-width:0}}";var wrap=d.createElement("section");wrap.id=rootId;wrap.setAttribute("role","region");wrap.setAttribute("aria-label","Cookie preferences");wrap.innerHTML='<span id="vtr-cookie-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 25.5A17.5 17.5 0 1 1 22.5 6c.2 2.7 2.1 5 4.8 5.6-.5 3.3 2.1 6.2 5.4 6.1.7 3.4 4.1 5.5 7.4 4.6 1.1.3 1.9 1.5 1.9 3.2Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="2" fill="currentColor"/><circle cx="27" cy="25" r="2" fill="currentColor"/><circle cx="17" cy="31" r="2" fill="currentColor"/><circle cx="31" cy="35" r="1.8" fill="currentColor"/></svg></span><p>This website uses cookies</p><div id="vtr-cookie-notice-actions"><button id="vtr-cookie-manage" type="button">Preferences</button><button id="vtr-cookie-accept" type="button">Accept</button></div>';d.head.appendChild(style);d.body.appendChild(wrap);wrap.querySelector("#vtr-cookie-accept").addEventListener("click",function(){setAll(true)});wrap.querySelector("#vtr-cookie-manage").addEventListener("click",openPrefs)}function boot(){var tries=0;var timer=setInterval(function(){tries++;if(z()||tries>=20){clearInterval(timer);show()}},250)}d.addEventListener("zarazConsentChoicesUpdated",function(){mark();remove()});ready(boot)})(window,document);</script>`;
}
function stripNativeAnalytics(html) {
  return html
    .replace(/\s*<script\b[^>]*src=["'][^"']*googletagmanager\.com\/gtag\/js[^"']*["'][^>]*><\/script>\s*/gi, "\n")
    .replace(/\s*<script\b[^>]*>[\s\S]*?googletagmanager\.com\/gtm\.js[\s\S]*?<\/script>\s*/gi, "\n")
    .replace(/\s*<noscript\b[^>]*>[\s\S]*?googletagmanager\.com\/ns\.html[\s\S]*?<\/noscript>\s*/gi, "\n")
    .replace(/\s*<script\b[^>]*>[\s\S]*?gtag\(['"]config['"][\s\S]*?<\/script>\s*/gi, "\n")
    .replace(/\s*<!-- Heap Script -->[\s\S]*?<!-- End Heap Script -->\s*/gi, "\n")
    .replace(/\s*<script\b[^>]*>[\s\S]*?tcvsapi\.contentsquare\.com\/v2\/projects\/[^"']*verify-installation\/auto[\s\S]*?<\/script>\s*/gi, "\n")
    .replace(/\s*<script[^>]*id=["']resi-pixel-js["'][^>]*><\/script>\s*/gi, "\n");
}
function normalizeNativeIdentityHtml(html) {
  return String(html || "")
    .replace(/https:\/\/championsgreen\.kinsta\.cloud\/?/gi, PROPERTY.origin + "/")
    .replace(/http:\/\/championsgreen\.kinsta\.cloud\/?/gi, PROPERTY.origin + "/");
}
function injectZarazConsentPill(html) {
  if (html.includes("data-vtr-zaraz-consent-pill")) return html;
  const script = renderZarazConsentUiScriptTag();
  if (html.includes("</body>")) return html.replace("</body>", `${script}</body>`);
  return `${html}${script}`;
}
function renderNativeDesktopVisualRepairStyle() {
  return `<style data-vtr-native-desktop-visual-repair="1">
@media (min-width:768px){
  sup.tm{display:none!important}
  .popup-element[data-page-section="promo_bar"] .tm-popdown:not(.uk-open){display:none!important}
}
</style>`;
}
function repairNativeDesktopStylesheets(html) {
  const style = html.includes("data-vtr-native-desktop-visual-repair") ? "" : renderNativeDesktopVisualRepairStyle();
  const links = NATIVE_DESKTOP_REQUIRED_STYLESHEETS
    .filter((item) => !html.includes(item.href.split("?")[0]))
    .map((item) => `<link rel="stylesheet" id="${item.id}" href="${item.href}" media="${item.media}">`)
    .join("\n");
  if (!links && !style) return html;
  const marker = "<!-- vtr native desktop css repair -->";
  if (html.includes("</head>")) return html.replace("</head>", `${marker}\n${links}\n${style}\n</head>`);
  return `${links}\n${style}\n${html}`;
}
function renderZarazConsentViewportFixScript() {
  return `<script data-vtr-zaraz-consent-viewport-fix="1">(function(w,d){if(w.__vtrZarazConsentViewportFix)return;w.__vtrZarazConsentViewportFix=true;function fit(){var el=d.getElementById("vtr-cookie-notice");if(!el||!w.visualViewport||w.visualViewport.width>740)return;el.style.left="10px";el.style.right="10px";el.style.bottom="auto";el.style.width="auto";el.style.maxWidth="none";el.style.transform="none";el.style.top=Math.max(10,Math.floor(w.visualViewport.height-el.offsetHeight-10))+"px";}function watch(){fit();if(w.visualViewport){w.visualViewport.addEventListener("resize",fit,{passive:true});w.visualViewport.addEventListener("scroll",fit,{passive:true});}var observer=new MutationObserver(fit);observer.observe(d.documentElement,{childList:true,subtree:true});setTimeout(fit,0);setTimeout(fit,500);setTimeout(fit,1500);}d.readyState==="loading"?d.addEventListener("DOMContentLoaded",watch,{once:true}):watch();})(window,document);</script>`;
}
function scriptBody(scriptTag) {
  return String(scriptTag || "").replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
}
function renderZarazConsentUiScriptTag() {
  return `<script src="${ZARAZ_CONSENT_UI_PATH}?v=${encodeURIComponent(TEMPLATE.version)}" defer data-vtr-zaraz-consent-ui="1"></script>`;
}
function serveZarazConsentUiScript() {
  const js = `${scriptBody(renderZarazConsentPillScript())}\n${scriptBody(renderZarazConsentViewportFixScript())}`;
  return new Response(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
}
function serveContentsquareVerifySuppressed() {
  return new Response('{"ok":true,"suppressed":"contentsquare_verify"}\n', {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-resi-edge-template-version": TEMPLATE.version
    }
  });
}
async function passThroughNativeCleanHtml(request) {
  const originResponse = await fetch(request, { cf: { cacheEverything: false, cacheTtl: 0 } });
  const contentType = originResponse.headers.get("content-type") || "";
  if (request.method !== "GET" || originResponse.status !== 200 || !contentType.includes("text/html")) {
    return originResponse;
  }
  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-resi-edge-prototype", "champions-green");
  headers.set("x-resi-edge-mode", "native-clean-cmp");
  headers.set("x-resi-edge-template-version", TEMPLATE.version);
  headers.append("server-timing", 'vtr_champions_native_clean_cmp;desc="native-pass-through"');
  const html = repairNativeDesktopStylesheets(injectZarazConsentPill(normalizeNativeIdentityHtml(stripNativeAnalytics(await originResponse.text()))));
  return new Response(html, { status: originResponse.status, statusText: originResponse.statusText, headers });
}
function isMobile(request) {
  return /Android|iPhone|iPod|IEMobile|Mobile/i.test(request.headers.get("user-agent") || "");
}
function formatPhoneHref(phone) {
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
  const phone = selected.phone || PROPERTY.phoneLabel;
  return {
    phoneLabel: phone,
    phoneHref: formatPhoneHref(phone),
    email: selected.email || PROPERTY.email,
    requestedTrackingId: requestedTrackingId || null,
    selectedTrackingId: selected.trackingId,
    selectedMarketingSourceCd: selected.marketingSourceCd,
    sourceSelection: requestedTrackingId && SOURCE_ATTRIBUTION.sources[requestedTrackingId] ? "source" : "default"
  };
}
function ratingFillPercent(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 100;
  return Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));
}
function contentTypeForKey(key) {
  const ext = (key.split(".").pop() || "").toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
function buildNativeOriginRequest(request, paramsToStrip = []) {
  const cleanUrl = new URL(request.url);
  for (const param of paramsToStrip) cleanUrl.searchParams.delete(param);
  cleanUrl.searchParams.delete("edge_psi_fresh");
  cleanUrl.searchParams.delete("edge_shell_rest");
  return new Request(cleanUrl.toString(), {
    method: "GET",
    headers: buildNativeFetchHeaders(request),
    redirect: "follow"
  });
}
function buildNativeHomepageRequest(request) {
  const cleanUrl = new URL("/", PROPERTY.origin);
  return new Request(cleanUrl.toString(), {
    method: "GET",
    headers: buildNativeFetchHeaders(request),
    redirect: "follow"
  });
}
function buildNativeFetchHeaders(request) {
  const headers = new Headers();
  const source = request.headers;
  const accept = source.get("accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  const language = source.get("accept-language");
  const userAgent = source.get("user-agent");
  headers.set("accept", accept);
  if (language) headers.set("accept-language", language);
  if (userAgent) headers.set("user-agent", userAgent);
  return headers;
}
function nativeContinuationPath(variant = "desktop") {
  return `${NATIVE_CONTINUATION_PATH}?${GATE_PARAM}=${encodeURIComponent(GATE_VALUE)}&variant=${encodeURIComponent(variant)}`;
}

function buildRuntimePropertyCacheKey(request, env) {
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = RUNTIME_PROPERTY_CACHE_PATH;
  cacheUrl.search = `?v=${encodeURIComponent(env.EDGE_RUNTIME_PROPERTY_CACHE_VERSION || RUNTIME_PROPERTY_CACHE_VERSION)}`;
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function firstRegex(value, pattern) {
  const match = String(value || "").match(pattern);
  return match ? decodeHtmlEntities(match[1] || match[0]).trim() : "";
}

function absolutizeHref(href) {
  if (!href) return "";
  try {
    return new URL(decodeHtmlEntities(href), PROPERTY.origin).toString().replace(PROPERTY.origin, "");
  } catch {
    return href;
  }
}

function extractSectionByNeedle(html, needle) {
  const index = html.indexOf(needle);
  if (index < 0) return "";
  const start = Math.max(0, html.lastIndexOf("<", index - 1));
  const end = Math.min(html.length, index + 12000);
  return html.slice(start, end);
}

function extractNativeRuntimeProperty(html) {
  const promoSection = extractSectionByNeedle(html, 'data-page-section="promo_bar"') || extractSectionByNeedle(html, "has_specials=true");
  const promoTextFromSection = firstRegex(promoSection, /((?:Up to\s+)?\$[^<]{1,120}(?:limited time|off|special)[^<]{0,80})/i);
  const promoTextFromPage = firstRegex(html, /((?:Up to\s+)?\$[^<]{1,120}(?:limited time|off|special)[^<]{0,80})/i);
  const promoText = normalizeText(promoTextFromSection || promoTextFromPage || PROPERTY.promoText);
  const availabilityHref = absolutizeHref(firstRegex(promoSection || html, /href=["']([^"']*has_specials=true[^"']*)["']/i)) || PROPERTY.promoAvailabilityHref;
  const promoImageUrl = PROPERTY.promoImageUrl;
  const promoEnabled = Boolean(promoSection && (promoText || /has_specials=true|special/i.test(promoSection)));
  const phoneLabel = normalizeText(firstRegex(html, /href=["']tel:([^"']+)["'][^>]*>(.*?)<\/a>/is) || firstRegex(html, /\((\d{3})\)\s*\d{3}-\d{4}/));
  const phoneHref = firstRegex(html, /href=["'](tel:[^"']+)["']/i);
  const tourHref = firstRegex(html, /href=["']([^"']*scheduleTour[^"']*)["']/i);
  const applyHref = firstRegex(html, /href=["']([^"']*createPipelineApplication[^"']*)["']/i);
  const detailText = normalizeText(firstRegex(promoSection, /<em[^>]*>(.*?)<\/em>/is) || firstRegex(promoSection, /(<p[^>]*>.*?<\/p>)/is));

  return {
    promoEnabled,
    promoText: promoEnabled ? promoText : PROPERTY.promoText,
    promoDetail: promoEnabled ? (detailText && detailText !== promoText ? detailText : PROPERTY.promoDetail) : PROPERTY.promoDetail,
    promoImageUrl,
    promoAvailabilityHref: availabilityHref,
    phoneLabel: phoneLabel ? (phoneLabel.startsWith("(") ? phoneLabel : PROPERTY.phoneLabel) : PROPERTY.phoneLabel,
    phoneHref: phoneHref || PROPERTY.phoneHref,
    tourHref: tourHref || PROPERTY.tourHref,
    applyHref: applyHref || PROPERTY.applyHref
  };
}

async function fetchNativeRuntimeProperty(request, env) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort("native-runtime-property-timeout"), NATIVE_PROMO_FETCH_TIMEOUT_MS) : null;
  try {
    const originResponse = await fetch(buildNativeHomepageRequest(request), {
      cf: { cacheEverything: true, cacheTtl: RUNTIME_PROPERTY_CACHE_TTL_SECONDS },
      signal: controller ? controller.signal : undefined
    });
    if (!originResponse.ok) throw new Error(`native_runtime_property_status_${originResponse.status}`);
    const html = await originResponse.text();
    return {
      ok: true,
      source: "native-fetch",
      property: extractNativeRuntimeProperty(html),
      checkedAt: new Date().toISOString()
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveRuntimeProperty(request, env, ctx) {
  if ((env.EDGE_NATIVE_PROPERTY_SYNC_ENABLED ?? "true") === "false") {
    return { ok: true, source: "static", property: PROPERTY, checkedAt: null };
  }

  const cacheKey = buildRuntimePropertyCacheKey(request, env);
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const payload = await cached.json();
      return { ...payload, source: "native-cache", property: { ...PROPERTY, ...(payload.property || {}) } };
    }
  } catch {}

  try {
    const payload = await fetchNativeRuntimeProperty(request, env);
    const ttl = parseInt(env.EDGE_RUNTIME_PROPERTY_CACHE_TTL_SECONDS || String(RUNTIME_PROPERTY_CACHE_TTL_SECONDS), 10) || RUNTIME_PROPERTY_CACHE_TTL_SECONDS;
    const response = new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=0, s-maxage=${ttl}` }
    });
    if (ctx) ctx.waitUntil(caches.default.put(cacheKey, response));
    return payload;
  } catch (error) {
    return {
      ok: false,
      source: "static-fallback",
      property: PROPERTY,
      error: error && error.message ? error.message : "native_runtime_property_failed",
      checkedAt: new Date().toISOString()
    };
  }
}

// ── R2 passthrough ────────────────────────────────────────────────────────────

async function serveR2Object(env, key, request) {
  if (key === ASSET_KEYS.lble) return serveBundledLbleAsset(request);
  if (key === ASSET_KEYS.heroMobile) return serveBundledHeroMobileAsset(request);
  if (key === "resi-edge-assets/shared/kingsley-award.svg") return serveKingsleyAwardAsset(request);
  if (!env.RESI_EDGE_ASSETS) return new Response("R2 binding missing", { status: 500 });
  const obj = await env.RESI_EDGE_ASSETS.get(key);
  if (!obj) {
    const fontResponse = await serveOriginFontAsset(key, request);
    if (fontResponse) return fontResponse;
    return new Response("Not found", { status: 404 });
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-type", headers.get("content-type") || contentTypeForKey(key));
  headers.set("access-control-allow-origin", "*");
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(obj.body, { headers });
}

async function serveKingsleyAwardAsset(request) {
  const originResponse = await fetch(KINGSLEY_AWARD_DAM_URL, {
    headers: {
      accept: "image/svg+xml,image/*,*/*;q=0.8",
      "user-agent": request.headers.get("user-agent") || "Venterra WebOps Edge Asset Fetch"
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 31536000
    }
  });
  if (!originResponse.ok) return new Response("Not found", { status: 404 });
  const headers = new Headers(originResponse.headers);
  headers.set("content-type", "image/svg+xml; charset=utf-8");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.delete("set-cookie");
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(originResponse.body, { status: originResponse.status, statusText: originResponse.statusText, headers });
}

function serveBundledLbleAsset(request) {
  const headers = new Headers({
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
    "etag": `"lble-${TEMPLATE.version}"`
  });
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(OFFICIAL_LBLE_SVG, { headers });
}

function serveBundledHeroMobileAsset(request) {
  const headers = new Headers({
    "content-type": "image/avif",
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
    "etag": `"hero-mobile-${TEMPLATE.version}"`
  });
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(BUNDLED_HERO_MOBILE_AVIF, { headers });
}

async function serveOriginFontAsset(key, request) {
  if (!key.startsWith(EDGE_FONT_PREFIX)) return null;
  const fileName = key.slice(EDGE_FONT_PREFIX.length);
  if (!EDGE_FONT_FILES.has(fileName)) return null;
  const originUrl = new URL(`/wp-content/themes/resi-child-theme/fonts/${fileName}`, PROPERTY.origin);
  const originResponse = await fetch(originUrl.toString(), {
    headers: {
      accept: "font/woff2,*/*;q=0.8",
      "user-agent": request.headers.get("user-agent") || "Venterra WebOps Edge Font Fetch"
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 31536000
    }
  });
  if (!originResponse.ok) return null;
  const headers = new Headers(originResponse.headers);
  headers.set("content-type", "font/woff2");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.delete("set-cookie");
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(originResponse.body, { status: originResponse.status, statusText: originResponse.statusText, headers });
}

// ── Edge HTML cache (Pilot RESI_HOME_HTML_CACHE_CONFIG pattern) ───────────────

function buildShellCacheKey(request, env, variant = "mobile") {
  const cacheEnabled = (env.EDGE_HTML_CACHE_ENABLED ?? "true") !== "false";
  if (!cacheEnabled || request.method !== "GET") return null;
  const url = new URL(request.url);
  for (const [name] of url.searchParams) {
    if (CACHE_BYPASS_PARAMS.includes(name.toLowerCase())) return null;
  }
  const version = env.EDGE_HTML_CACHE_VERSION ?? "default";
  const sourceId =
    url.searchParams.get(SOURCE_ATTRIBUTION.externalSourceField) ||
    url.searchParams.get("trackingId") ||
    SOURCE_ATTRIBUTION.defaultTrackingId;
  const previewMode = url.searchParams.get(env.EDGE_PREVIEW_PARAM ?? GATE_PARAM) === (env.EDGE_PREVIEW_VALUE ?? GATE_VALUE) ? "preview" : "production";
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = "/__vtr-edge-shell-cache/GA4CG/home";
  cacheUrl.search = `?variant=${encodeURIComponent(variant)}&source=${encodeURIComponent(sourceId)}&mode=${encodeURIComponent(previewMode)}&v=${encodeURIComponent(version)}`;
  return new Request(cacheUrl.toString(), { method: "GET" });
}

async function getFromCache(cacheKey) {
  if (!cacheKey) return null;
  try { return await caches.default.match(cacheKey); } catch { return null; }
}

function storeInCache(cacheKey, response, env, ctx) {
  if (!cacheKey || !ctx) return;
  const ttl = parseInt(env.EDGE_HTML_CACHE_TTL_SECONDS ?? "300", 10) || 300;
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=0, s-maxage=${ttl}`);
  headers.delete("set-cookie");
  const cacheable = new Response(response.clone().body, { status: response.status, headers });
  ctx.waitUntil(caches.default.put(cacheKey, cacheable));
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (ORIGIN_PASSTHROUGH_RESET) {
      return fetch(request);
    }

    const url = new URL(request.url);
    const shellEnabled = (env.EDGE_SHELL_ENABLED ?? "true") !== "false";
    const gateParam = env.EDGE_PREVIEW_PARAM ?? GATE_PARAM;
    const gateValue = env.EDGE_PREVIEW_VALUE ?? GATE_VALUE;
    const isGated = shellEnabled && url.searchParams.get(gateParam) === gateValue;
    const isHomepage = url.pathname === "/" || url.pathname === "";
    const isMobileHomepageShell = shellEnabled && isHomepage && isMobile(request);
    const configStatus = validateShellConfig();

    if (url.pathname === "/health") {
      return jsonResponse({ ok: configStatus.ok, mode: TEMPLATE.mode, templateVersion: TEMPLATE.version, propertyCode: PROPERTY.code, r2Binding: Boolean(env.RESI_EDGE_ASSETS), shellEnabled, gateParam, gateValue, config: configStatus });
    }
    if (url.pathname === "/manifest") {
      return jsonResponse({ template: TEMPLATE, property: PROPERTY, assets: ASSET_KEYS, analytics: ANALYTICS, shellEnabled, config: configStatus });
    }
    if (url.pathname.startsWith("/assets/")) {
      return serveR2Object(env, decodeURIComponent(url.pathname.replace(/^\/assets\//, "")), request);
    }
    if (url.pathname === ZARAZ_CONSENT_UI_PATH) {
      return serveZarazConsentUiScript();
    }
    if (url.pathname === TOPPER_ANALYTICS_PATH) {
      return serveTopperAnalyticsScript(request);
    }
    if (url.pathname === CONTENTSQUARE_VERIFY_SUPPRESS_PATH) {
      return serveContentsquareVerifySuppressed();
    }
    if (url.pathname === "/favicon.ico") {
      return serveNativeFavicon(request);
    }
    if (shellEnabled && url.pathname === NATIVE_CONTINUATION_PATH) {
      return serveNativeContinuation(request, env);
    }

    // Production mobile homepage: serve the edge-owned shell for the high-score
    // first viewport. Desktop and non-homepage traffic stay native clean.
    if (isMobileHomepageShell) {
      if (!configStatus.ok) {
        return jsonResponse({ ok: false, error: "edge_shell_config_invalid", config: configStatus });
      }
      const variant = "mobile";
      const preview = isGated;
      const cacheKey = buildShellCacheKey(request, env, variant);
      const cached = await getFromCache(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("x-vtr-edge-html-cache", "HIT");
        headers.set("x-resi-edge-prototype", "champions-green");
        headers.set("x-resi-edge-mode", TEMPLATE.mode);
        headers.set("x-resi-edge-template-version", TEMPLATE.version);
        headers.set("x-resi-edge-device", variant);
        headers.set("x-resi-edge-production", preview ? "preview-mobile-shell" : "mobile-shell");
        if (preview) headers.set("x-robots-tag", "noindex, nofollow");
        else headers.delete("x-robots-tag");
        headers.append("server-timing", 'vtr_performance_topper;desc="cache-hit"');
        return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
      }
      const runtime = await resolveRuntimeProperty(request, env, ctx);
      const contact = resolveContact(request);
      const runtimeProperty = {
        ...runtime.property,
        ...contact,
        telephoneSchema: formatPhoneHref(contact.phoneLabel).replace(/^tel:/, "")
      };
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300",
        "x-vtr-edge-html-cache": cacheKey ? "MISS" : "BYPASS",
        "x-resi-edge-prototype": "champions-green",
        "x-resi-edge-mode": TEMPLATE.mode,
        "x-resi-edge-template-version": TEMPLATE.version,
        "x-resi-edge-device": variant,
        "x-resi-edge-runtime-property": runtime.source,
        "x-resi-edge-promo-state": runtimeProperty.promoEnabled ? "enabled" : "disabled",
        "x-resi-edge-source-selection": runtimeProperty.sourceSelection,
        "x-resi-edge-tracking-id": runtimeProperty.selectedTrackingId,
        "x-resi-edge-production": preview ? "preview-mobile-shell" : "mobile-shell"
      });
      if (preview) headers.set("x-robots-tag", "noindex, nofollow");
      headers.append("server-timing", 'vtr_performance_topper;desc="measured-geometry"');
      headers.append("server-timing", `vtr_runtime_property;desc="${runtime.source}"`);
      headers.append("link", `<${assetAbsolute(assetUrl(variant === "mobile" ? ASSET_KEYS.heroMobile : ASSET_KEYS.heroDesktop))}>; rel=preload; as=image; fetchpriority=high; type=image/avif`);
      const response = new Response(compactHtml(renderPerformanceHybridDocument(variant, runtimeProperty, { preview })), { status: 200, headers });
      storeInCache(cacheKey, response, env, ctx);
      return response;
    }

    if (isGated && !isMobile(request) && DESKTOP_GUARDS.enabled && (url.pathname === "/" || url.pathname === "")) {
      const originResponse = await fetch(request);
      const contentType = originResponse.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return originResponse;
      const headers = new Headers(originResponse.headers);
      headers.set("x-resi-edge-prototype", "champions-green");
      headers.set("x-resi-edge-mode", DESKTOP_GUARDS.mode);
      headers.set("x-robots-tag", "noindex, nofollow");
      headers.append("server-timing", 'vtr_desktop_hero;desc="r2-preload"');
      headers.append("server-timing", 'vtr_desktop_promo;desc="static"');
      headers.append("server-timing", 'vtr_desktop_script_trim;desc="home"');
      headers.append("server-timing", 'vtr_desktop_css_dedupe;desc="custom"');
      headers.append("link", `<${assetUrl(ASSET_KEYS.heroDesktop)}>; rel=preload; as=image; fetchpriority=high`);
      const response = new Response(originResponse.body, { status: originResponse.status, statusText: originResponse.statusText, headers });
      const desktopState = { seenStylesheets: new Set() };
      return new HTMLRewriter()
        .on("[data-src]", new DesktopHeroRewriter())
        .on('.popup-element[data-page-section="promo_bar"]', new NativePromoRewriter())
        .on("script[src]", new DesktopScriptTrimRewriter())
        .on('link[rel="stylesheet"][href]', new DesktopStylesheetDedupeRewriter(desktopState))
        .transform(response);
    }

    return fetch(request);
  }
};

async function serveExactNativeHomepage(request, variant = "desktop") {
  const originRequest = buildNativeHomepageRequest(request);
  const originResponse = await fetch(originRequest, {
    cf: {
      cacheEverything: false,
      cacheTtl: 0
    }
  });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return originResponse;

  const headers = new Headers(originResponse.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, s-maxage=300");
  headers.set("x-resi-edge-prototype", "champions-green");
  headers.set("x-resi-edge-mode", TEMPLATE.mode);
  headers.set("x-resi-edge-template-version", TEMPLATE.version);
  headers.set("x-resi-edge-device", variant);
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", 'vtr_exact_native_homepage;desc="native-dom"');
  headers.append("server-timing", 'vtr_exact_native_lcp;desc="hero-preload"');
  headers.append("server-timing", 'vtr_exact_native_trim;desc="safe-preview-payload"');
  headers.append("link", `<${exactNativeHeroAbsolute(variant)}>; rel=preload; as=image; fetchpriority=high${variant === "mobile" ? "; type=image/avif" : ""}`);
  headers.delete("set-cookie");

  const html = normalizeNativeIdentityHtml(stripNativeAnalytics(await originResponse.text()));
  const response = new Response(html, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers
  });

  const exactNativeState = { seenStylesheets: new Set() };
  return new HTMLRewriter()
    .on("title", new ExactNativeTitleRewriter())
    .on("head", new ExactNativeHeadRewriter(variant))
    .on('meta[name="dc.title"]', new ExactNativeTitleMetaRewriter())
    .on('meta[property="og:title"]', new ExactNativeTitleMetaRewriter())
    .on('meta[name="twitter:title"]', new ExactNativeTitleMetaRewriter())
    .on('meta[name="robots"]', new ExactNativeRobotsRewriter())
    .on("body", new ExactNativeBodyRewriter(variant))
    .on("[data-src]", new ExactNativeHeroImageRewriter(variant))
    .on("img[src]", new ExactNativeImageDelayRewriter())
    .on("script", new ExactNativeScriptTrimRewriter())
    .on('link[rel="stylesheet"][href]', new ExactNativeStylesheetDedupeRewriter(exactNativeState))
    .on('[data-page-section="promo_bar"]', new ExactNativePromoStateRewriter())
    .transform(response);
}

async function serveNativeFavicon(request) {
  const faviconUrl = new URL(PROPERTY.faviconPngHref, PROPERTY.origin);
  const response = await fetch(new Request(faviconUrl.toString(), {
    method: "GET",
    headers: buildNativeFetchHeaders(request),
    redirect: "follow"
  }), {
    cf: {
      cacheEverything: true,
      cacheTtl: 86400
    }
  });
  const headers = new Headers(response.headers);
  headers.set("content-type", response.headers.get("content-type") || "image/png");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function serveNativeContinuation(request, env) {
  const variant = isMobile(request) ? "mobile" : new URL(request.url).searchParams.get("variant") || "desktop";
  const originRequest = buildNativeHomepageRequest(request);
  const originResponse = await fetch(originRequest, {
    cf: {
      cacheEverything: false,
      cacheTtl: 0
    }
  });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return originResponse;

  const headers = new Headers(originResponse.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("x-resi-edge-mode", "native-continuation");
  headers.set("x-resi-edge-device", variant);
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", 'vtr_native_continuation;desc="lazy"');
  headers.delete("set-cookie");

  const response = new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers
  });

  return new HTMLRewriter()
    .on("head", new NativeContinuationHeadRewriter(variant))
    .on("body", new NativeContinuationBodyRewriter())
    .transform(response);
}

function hiddenNativeSectionCss() {
  return `body.vtr-hybrid-native .tm-header,
body.vtr-hybrid-native .tm-header-mobile,
body.vtr-hybrid-native [data-page-section="promo_bar"],
body.vtr-hybrid-native [data-page-section="hero"],
body.vtr-hybrid-native [data-page-section="welcome"],
body.vtr-hybrid-native [data-page-section="apartment_features"]{display:none!important}`;
}

class NativeContinuationHeadRewriter {
  constructor(variant) {
    this.variant = variant;
  }

  element(element) {
    element.prepend(`<base href="${PROPERTY.origin}/">`, { html: true });
    element.prepend(`<script data-vtr-cs-verify-suppress="1">(function(w){var p=/tcvsapi\\.contentsquare\\.com\\/v2\\/projects\\/[^/]+\\/verify-installation\\/auto/i;var local="${CONTENTSQUARE_VERIFY_SUPPRESS_PATH}";if(w.fetch){var f=w.fetch;w.fetch=function(input,init){var u=typeof input==="string"?input:input&&input.url;if(p.test(String(u||"")))return f.call(this,local,{credentials:"same-origin",cache:"force-cache"});return f.apply(this,arguments)}}if(w.XMLHttpRequest){var open=w.XMLHttpRequest.prototype.open;w.XMLHttpRequest.prototype.open=function(method,url){if(p.test(String(url||"")))url=local;return open.apply(this,[method,url].concat([].slice.call(arguments,2)))}}})(window);</script>`, { html: true });
    element.append(`<style data-vtr-native-continuation="1">
${hiddenNativeSectionCss()}
html{margin:0!important;padding:0!important;overflow:hidden}
body{margin:0!important;padding:0!important;background:#fff!important}
.vtr-native-continuation-frame-marker{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
body.vtr-native-continuation .tm-header,
body.vtr-native-continuation .tm-header-mobile{display:none!important}
</style>`, { html: true });
  }
}

class NativeContinuationBodyRewriter {
  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-hybrid-native vtr-native-continuation"));
    element.prepend(`<div class="vtr-native-continuation-frame-marker" data-vtr-native-continuation-frame="1">Native continuation loaded</div>`, { html: true });
    element.append(`<script data-vtr-native-continuation-resize="1">(function(){
  function postHeight(){
    var body=document.body;
    var height=Math.max(body?body.scrollHeight:0, body?body.offsetHeight:0);
    try{parent.postMessage({type:'vtr-native-continuation-height',height:height},'*')}catch(e){}
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',postHeight,{once:true})}else{postHeight()}
  addEventListener('load',postHeight,{once:true});
  if('ResizeObserver' in window&&document.body){new ResizeObserver(postHeight).observe(document.body)}
  setTimeout(postHeight,250);setTimeout(postHeight,1000);setTimeout(postHeight,2500);
})();</script>`, { html: true });
  }
}

class ExactNativeHeadRewriter {
  constructor(variant) {
    this.variant = variant;
  }

  element(element) {
    const heroUrl = exactNativeHeroUrl(this.variant);
    const metadata = JSON.stringify({
      mode: TEMPLATE.mode,
      version: TEMPLATE.version,
      propertyCode: PROPERTY.code,
      variant: this.variant
    }).replace(/</g, "\\u003c");
    element.prepend(`<script data-vtr-preview-analytics-blocker="1">(function(){
  var blocked=[/googletagmanager\\.com/i,/heap-api\\.com/i,/contentsquare\\.net/i,/js\\.getresi\\.co\\/pixel/i];
  function isBlocked(node){return node&&node.tagName==="SCRIPT"&&node.src&&blocked.some(function(pattern){return pattern.test(node.src)})}
  var append=Node.prototype.appendChild;
  Node.prototype.appendChild=function(node){if(isBlocked(node)){node.type="text/plain";return node}return append.call(this,node)};
  var insert=Node.prototype.insertBefore;
  Node.prototype.insertBefore=function(node,ref){if(isBlocked(node)){node.type="text/plain";return node}return insert.call(this,node,ref)};
})();</script>`, { html: true });
    element.append(`
<link rel="preconnect" href="https://dam.getresi.co">
<link rel="preload" as="image" href="${heroUrl}" fetchpriority="high"${this.variant === "mobile" ? ' type="image/avif"' : ""}>
<link rel="shortcut icon" href="${assetAbsolute(PROPERTY.faviconPngHref)}">
<link rel="icon" href="${assetAbsolute(PROPERTY.faviconPngHref)}" sizes="32x32" type="image/png">
<link rel="icon" href="${assetAbsolute(PROPERTY.faviconSvgHref)}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${assetAbsolute(PROPERTY.appleTouchIconHref)}">
<meta name="robots" content="noindex,nofollow">
<script data-vtr-exact-native-image-delay="1">(function(){
  function restore(img){var src=img.getAttribute("data-vtr-delayed-src");if(!src)return;img.src=src;img.removeAttribute("data-vtr-delayed-src");}
  function init(){var imgs=[].slice.call(document.querySelectorAll("img[data-vtr-delayed-src]"));if(!imgs.length)return;if("IntersectionObserver" in window){var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;io.unobserve(entry.target);restore(entry.target);});},{rootMargin:"320px 0px"});imgs.forEach(function(img){io.observe(img);});return;}imgs.forEach(restore);}
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init,{once:true});}else{init();}
})();</script>
<script data-vtr-exact-native-homepage="1">window.__vtrResiEdge=${metadata};</script>`, { html: true });
  }
}

class ExactNativeTitleRewriter {
  element(element) {
    element.setInnerContent(PROPERTY.pageTitle);
  }
}

class ExactNativeTitleMetaRewriter {
  element(element) {
    element.setAttribute("content", PROPERTY.pageTitle);
  }
}

class ExactNativeRobotsRewriter {
  element(element) {
    element.remove();
  }
}

class ExactNativeBodyRewriter {
  constructor(variant) {
    this.variant = variant;
  }

  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-exact-native-homepage"));
    element.setAttribute("data-vtr-exact-native-homepage", TEMPLATE.version);
    element.setAttribute("data-vtr-edge-device", this.variant);
  }
}

class ExactNativePromoStateRewriter {
  element(element) {
    if (!PROPERTY.promoEnabled) {
      element.remove();
      return;
    }
    element.setAttribute("data-vtr-promo-state", "enabled");
  }
}

class ExactNativeHeroImageRewriter {
  constructor(variant) {
    this.variant = variant;
  }

  element(element) {
    const source = element.getAttribute("data-src") || "";
    if (!source.includes(EXACT_NATIVE_PERFORMANCE.heroSourceIncludes)) return;
    const heroUrl = exactNativeHeroUrl(this.variant);
    element.setAttribute("data-src", heroUrl);
    element.setAttribute("data-vtr-exact-native-hero", "eager-background");
    element.setAttribute("loading", "eager");
    element.setAttribute("fetchpriority", "high");
    element.setAttribute("style", appendStyleDeclaration(element.getAttribute("style"), `background-image:url("${heroUrl}")`));
  }
}

class ExactNativeImageDelayRewriter {
  element(element) {
    const src = element.getAttribute("src") || "";
    if (!EXACT_NATIVE_PERFORMANCE.delayImageSrcIncludes.some((pattern) => src.includes(pattern))) return;
    if (src === NATIVE_HERO_IMAGE_URL) return;
    element.setAttribute("data-vtr-delayed-src", src);
    element.setAttribute("src", TRANSPARENT_PIXEL);
    element.removeAttribute("srcset");
    element.setAttribute("loading", "lazy");
    element.setAttribute("decoding", "async");
    element.setAttribute("fetchpriority", "low");
  }
}

class ExactNativeScriptTrimRewriter {
  element(element) {
    const src = element.getAttribute("src") || "";
    if (src && EXACT_NATIVE_PERFORMANCE.removeScriptSrcIncludes.some((pattern) => src.includes(pattern))) {
      element.remove();
      return;
    }

    const id = element.getAttribute("id") || "";
    if (id && EXACT_NATIVE_PERFORMANCE.removeInlineScriptIds.includes(id)) {
      element.remove();
      return;
    }

    const type = (element.getAttribute("type") || "").toLowerCase();
    if (!src && EXACT_NATIVE_PERFORMANCE.removeInlineScriptTypes.includes(type)) {
      element.remove();
      return;
    }

    if (!src && type === "module") {
      element.remove();
    }
  }
}

class ExactNativeStylesheetDedupeRewriter {
  constructor(state) {
    this.state = state;
  }

  element(element) {
    const href = element.getAttribute("href") || "";
    const match = EXACT_NATIVE_PERFORMANCE.dedupeStylesheetHrefIncludes.find((pattern) => href.includes(pattern));
    if (!match) return;
    if (this.state.seenStylesheets.has(match)) {
      element.remove();
      return;
    }
    this.state.seenStylesheets.add(match);
    element.setAttribute("data-vtr-exact-native-css", "kept");
  }
}

class HybridHeadRewriter {
  element(element) {
    element.append(`
<link rel="preload" as="image" href="${assetUrl(ASSET_KEYS.heroMobile)}" type="image/avif" media="(max-width: 767px)" fetchpriority="high">
<link rel="preload" as="image" href="${assetUrl(ASSET_KEYS.heroDesktop)}" type="image/avif" media="(min-width: 768px)" fetchpriority="high">
<style data-vtr-hybrid-shell="1">${shellCss()}
body.vtr-hybrid-native .tm-header,
body.vtr-hybrid-native .tm-header-mobile,
body.vtr-hybrid-native [data-page-section="promo_bar"],
body.vtr-hybrid-native [data-page-section="hero"],
body.vtr-hybrid-native [data-page-section="welcome"],
body.vtr-hybrid-native [data-page-section="apartment_features"]{display:none!important}
body.vtr-hybrid-native .vtr-edge-hybrid-shell,
body.vtr-hybrid-native .vtr-edge-hybrid-shell [data-page-section],
body.vtr-hybrid-native .vtr-edge-hybrid-shell .vtr-shell-header{display:block!important}
body.vtr-hybrid-native .vtr-edge-hybrid-shell .vtr-shell-header{display:flex!important}
body.vtr-hybrid-native .vtr-edge-hybrid-shell{display:block}
</style>`, { html: true });
  }
}

class HybridBodyRewriter {
  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-hybrid-native"));
    element.prepend(renderHybridShell(), { html: true });
  }
}

class DesktopHeroRewriter {
  element(element) {
    const source = element.getAttribute("data-src") || "";
    if (!source.includes(DESKTOP_GUARDS.heroSourceIncludes)) return;
    const heroUrl = assetUrl(ASSET_KEYS.heroDesktop);
    element.setAttribute("data-src", heroUrl);
    element.setAttribute("data-vtr-desktop-hero", "r2");
    element.setAttribute("loading", "eager");
  }
}

function addClassName(className, token) {
  const tokens = new Set((className || "").split(/\s+/).filter(Boolean));
  tokens.add(token);
  return Array.from(tokens).join(" ");
}

function appendStyleDeclaration(style, declaration) {
  const current = (style || "").trim();
  if (!current) return declaration;
  const separator = current.endsWith(";") ? "" : ";";
  return `${current}${separator}${declaration}`;
}

class NativePromoRewriter {
  element(element) {
    element.replace(renderNativePromo(), { html: true });
  }
}

class DesktopScriptTrimRewriter {
  element(element) {
    const src = element.getAttribute("src") || "";
    if (!DESKTOP_GUARDS.removeScriptSrcIncludes.some((pattern) => src.includes(pattern))) return;
    element.remove();
  }
}

class DesktopStylesheetDedupeRewriter {
  constructor(state) {
    this.state = state;
  }

  element(element) {
    const href = element.getAttribute("href") || "";
    const match = DESKTOP_GUARDS.dedupeStylesheetHrefIncludes.find((pattern) => href.includes(pattern));
    if (!match) return;
    if (this.state.seenStylesheets.has(match)) {
      element.remove();
      return;
    }
    this.state.seenStylesheets.add(match);
    element.setAttribute("data-vtr-desktop-css", "kept");
  }
}

function renderNativePromo() {
  return `<style data-vtr-native-promo="1">
.vtr-native-promo{position:relative;z-index:50;background:#15284B;color:#fff}
.vtr-native-promo summary{display:flex;align-items:center;justify-content:center;gap:14px;height:46px;padding:0 20px;box-sizing:border-box;cursor:pointer;list-style:none;color:#fff;font-size:15px;font-weight:800;line-height:46px;letter-spacing:1.6px;text-align:center}
.vtr-native-promo summary::-webkit-details-marker{display:none}
.vtr-native-promo summary:after{content:"";width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px)}
.vtr-native-promo[open] summary:after{transform:rotate(225deg) translateY(-2px)}
.vtr-native-promo-panel{padding:58px 20px 64px;background:#fff;color:#15284B;text-align:center;box-shadow:0 16px 30px rgba(21,40,75,.16)}
.vtr-native-promo-panel h2{margin:0 0 24px;color:#15284B;font-size:42px;font-weight:400;line-height:1.18;letter-spacing:0}
.vtr-native-promo-panel p{margin:0 0 46px;color:#15284B;font-size:22px;font-style:italic;line-height:1.45}
.vtr-native-promo-actions{display:flex;align-items:center;justify-content:center;gap:30px;flex-wrap:wrap}
.vtr-native-promo-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:64px;padding:0 42px;border:2px solid #15284B;border-radius:999px;color:#15284B;background:#fff;text-decoration:none;font-size:18px;font-weight:900;line-height:60px;letter-spacing:3px}
.vtr-native-promo-actions a:first-child{background:#3D66B9;color:#fff;border-color:#3D66B9}
@media (max-width:767px){.vtr-native-promo{display:none}}
</style>
<details class="vtr-native-promo" data-vtr-desktop-promo="static">
  <summary>${escapeHtml(PROPERTY.promoText)}</summary>
  <div class="vtr-native-promo-panel">
    <h2>${escapeHtml(PROPERTY.promoText)}</h2>
    <p>${escapeHtml(PROPERTY.promoDetail)}</p>
    <div class="vtr-native-promo-actions">
      <a href="${PROPERTY.specialsHref}">See Specials</a>
      <a href="${PROPERTY.tourHref}" rel="noopener">Schedule A Tour</a>
    </div>
  </div>
</details>`;
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function renderBullets(items) {
  return `<ul class="vtr-shell-bullets">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderNeighborhoodTiles() {
  return NEIGHBORHOOD_IMAGES.map(([src, label]) => `<a class="vtr-shell-neighborhood-tile" href="${PROPERTY.neighborhoodHref}">
    <img src="${src}" width="900" height="600" loading="lazy" decoding="async" alt="${escapeHtml(label)} near ${escapeHtml(PROPERTY.name)}">
    <span>${escapeHtml(label)}</span>
  </a>`).join("");
}

function renderVenterraLotusMark() {
  return `<a class="vtr-shell-drawer-logo" href="${PROPERTY.origin}/" aria-label="Venterra home">VENTERRA</a>`;
  return `<a class="vtr-shell-drawer-logo" href="${PROPERTY.origin}/" aria-label="Venterra home">
    <svg xmlns="http://www.w3.org/2000/svg" width="70.34" height="41.6" viewBox="0 0 70.34 41.6" aria-hidden="true" focusable="false"><path d="M28.24 10.31l6.91 7.17 6.91-7.17-6.91-7.17-6.91 7.17Zm6.91 10.33c-.35 0-.69-.14-.93-.4l-8.71-9.04c-.48-.5-.48-1.3 0-1.8L34.21.38c.49-.51 1.38-.51 1.86 0l8.71 9.04c.48.5.48 1.3 0 1.8l-8.71 9.04c-.24.25-.58.4-.92.4" fill="currentColor"/><path d="M66.24 27.18c-.04.04-.07.08-.11.12-.08.1-.17.19-.26.29-.05.06-.11.12-.16.18-.08.09-.16.18-.24.27-.06.06-.12.13-.18.19-.09.09-.17.18-.26.28-.07.07-.14.14-.21.21-.09.09-.17.18-.26.27-.07.07-.15.15-.22.22-.09.09-.18.19-.28.28-.08.08-.16.15-.23.23-.1.1-.19.19-.3.29-.08.08-.17.16-.26.24-.1.1-.2.19-.3.29-.09.08-.18.16-.27.25-.11.1-.21.19-.32.29-.09.08-.19.17-.28.25-.11.1-.22.19-.34.29-.1.08-.2.17-.3.25-.11.1-.23.19-.35.29-.1.08-.21.17-.31.25-.12.1-.24.19-.36.29-.11.08-.22.17-.32.25-.12.1-.25.19-.38.29-.11.08-.23.17-.34.25-.13.09-.26.19-.39.28-.12.08-.23.17-.35.25-.13.09-.27.18-.4.27-.12.08-.24.16-.36.24-.14.09-.27.18-.41.27-.13.08-.25.16-.38.24-.14.09-.28.17-.42.26-.13.08-.26.15-.39.23-.14.08-.29.17-.44.25-.13.07-.27.15-.4.22-.15.08-.3.16-.45.24-.14.07-.27.14-.41.21-.15.08-.31.15-.46.22-.14.07-.28.13-.42.2-.16.07-.32.14-.48.21-.14.06-.28.12-.43.18-.16.07-.33.13-.49.19-.14.06-.29.11-.44.16-.17.06-.34.12-.5.18-.15.05-.3.1-.45.15-.17.05-.34.1-.52.16-.15.04-.3.09-.45.13-.18.05-.35.09-.53.14-.15.04-.3.08-.46.11-.18.04-.37.08-.55.11-.15.03-.3.06-.45.09-.19.03-.38.06-.57.09-.15.02-.3.05-.45.07-.2.03-.4.04-.6.06-.15.02-.29.03-.44.05-.22.02-.44.03-.66.04-.13 0-.27.02-.4.02-.27 0-.54 0-.81 0h-.27c-.14 0-.28-.01-.42-.02h0c5.39-2.83 8.94-7.4 11.26-11.99.17-.02.34-.04.51-.06.63-.07 1.25-.12 1.87-.16.2-.01.41-.03.61-.04 1.14-.07 2.25-.1 3.29-.12h.88c1.65 0 3.11.06 4.28.13.19.01.38.02.56.04-.11.13-.22.26-.34.39M3.78 26.78c2.64-.18 7.2-.34 12 .21 2.33 4.61 5.9 9.19 11.32 12.02-5.1.25-10.24-1.38-15.33-4.9-3.66-2.53-6.43-5.48-7.99-7.33m10.54-12.74c.09.05.19.1.28.14 4.93 2.56 16.05 9.08 19.21 17.32-.76 2.37-.9 4.74-.43 7.07-7.13-1.65-12.52-6.39-16-14.13-1.82-4.06-2.67-8.01-3.05-10.4m41.71.01c-.97 6-4.93 21.86-19.96 24.74-3.14-11.71 13.86-21.61 19.96-24.74m14.23 11.13c-.18-.41-.57-.7-1.02-.76-.28-.04-6.34-.79-13.41-.17 2.64-6.44 3.07-12.21 3.08-12.33.03-.45-.18-.89-.55-1.14-.37-.26-.85-.31-1.27-.12-.29.13-7.3 3.25-13.7 8.41-3.77 3.04-6.51 6.15-8.21 9.28-1.71-3.13-4.45-6.24-8.21-9.28-6.4-5.16-13.4-8.28-13.7-8.41-.41-.18-.89-.14-1.27.12-.37.26-.58.69-.55 1.14 0 .12.44 5.89 3.08 12.33-7.07-.62-13.13.14-13.41.17-.45.06-.84.35-1.02.76-.18.41-.1.89.16 1.27.13.18 10.52 15.11 25.93 15.16h18.1c15.42-.2 25.63-14.98 25.75-15.16.26-.37.39-.85.21-1.27" fill="currentColor"/></svg>
  </a>`;
}

function renderDrawerSocials() {
  const links = [
    ["facebook", PROPERTY.facebookHref, "Facebook"],
    ["instagram", PROPERTY.instagramHref, "Instagram"],
    ["google", PROPERTY.mapsHref, "Google Maps"]
  ].filter(([, href]) => Boolean(href));
  if (!links.length) return "";
  return `<div class="vtr-shell-socials" aria-label="Social links">${links.map(([type, href, label]) => `<a href="${href}" rel="noopener" aria-label="${escapeHtml(label)}">${renderDrawerSocialIcon(type)}</a>`).join("")}</div>`;
}

function renderDrawerSocialIcon(type) {
  if (type === "facebook") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.4 8.1h2.2V4.5h-2.9c-3.3 0-5.1 2-5.1 5v2H5.7v3.7h2.9v8.3h4v-8.3h3.1l.5-3.7h-3.6V9.9c0-1.1.3-1.8 1.8-1.8Z"/></svg>`;
  }
  if (type === "instagram") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="4.5" ry="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16.8" cy="7.2" r="1.2" fill="currentColor"/></svg>`;
  }
  return `<span aria-hidden="true">G</span>`;
}

function currentTopperAnalytics() {
  return {
    ...ANALYTICS,
    trackingId: PROPERTY.selectedTrackingId || SOURCE_ATTRIBUTION.defaultTrackingId,
    marketingSourceCd: PROPERTY.selectedMarketingSourceCd || SOURCE_ATTRIBUTION.sources[SOURCE_ATTRIBUTION.defaultTrackingId].marketingSourceCd,
    sourceSelection: PROPERTY.sourceSelection || "default",
    requestedTrackingId: PROPERTY.requestedTrackingId || null
  };
}
function renderTopperAnalyticsScriptTag() {
  const analytics = currentTopperAnalytics();
  const params = new URLSearchParams({
    v: TEMPLATE.version,
    tracking_id: analytics.trackingId,
    marketing_source_cd: analytics.marketingSourceCd,
    source_selection: analytics.sourceSelection,
    requested_tracking_id: analytics.requestedTrackingId || ""
  });
  return `<script src="${TOPPER_ANALYTICS_PATH}?${params.toString()}" data-vtr-topper-analytics="1"></script>`;
}
function serveTopperAnalyticsScript(request) {
  const url = new URL(request.url);
  const analytics = {
    ...ANALYTICS,
    trackingId: url.searchParams.get("tracking_id") || SOURCE_ATTRIBUTION.defaultTrackingId,
    marketingSourceCd: url.searchParams.get("marketing_source_cd") || SOURCE_ATTRIBUTION.sources[SOURCE_ATTRIBUTION.defaultTrackingId].marketingSourceCd,
    sourceSelection: url.searchParams.get("source_selection") || "default",
    requestedTrackingId: url.searchParams.get("requested_tracking_id") || null
  };
  return new Response(renderTopperAnalyticsRecorder(analytics), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
}
function renderTopperAnalyticsRecorder(analytics = currentTopperAnalytics()) {
  const analyticsJson = JSON.stringify(analytics).replace(/</g, "\\u003c");
  return `var A=${analyticsJson};
    var DK='vtr_edge_pv_'+A.propertyCode;
    var heapReplayAllowed=false;
    function vtrPayload(x){return Object.assign({property_code:A.propertyCode,community_id:A.communityId,property_name:A.propertyName,source:A.source,schema_version:A.schemaVersion,path:location.pathname,tracking_id:A.trackingId,marketing_source_cd:A.marketingSourceCd,source_selection:A.sourceSelection,requested_tracking_id:A.requestedTrackingId},x||{})}
    function vtrHeapReady(){return !!(window.heap&&typeof window.heap.track==='function'&&!Array.isArray(window.heap))}
    function vtrReplayHeap(){if(!vtrHeapReady()||!window.__vtrHeapEventQueue||!window.__vtrHeapEventQueue.length)return false;var q=window.__vtrHeapEventQueue.splice(0);q.forEach(function(item){try{window.heap.track(item.event,item.payload)}catch(e){window.__vtrHeapEventQueue.unshift(item)}});return true}
    function vtrAllowHeapReplay(reason){heapReplayAllowed=true;window.__vtrHeapReplayReason=reason||'allowed';vtrReplayHeap()}
    function vtrQueueHeap(n,p){window.__vtrHeapEventQueue=window.__vtrHeapEventQueue||[];window.__vtrHeapEventQueue.push({event:n,payload:p,timestamp:Date.now()})}
    function vtrHeap(n,p){if(heapReplayAllowed&&vtrHeapReady()){try{window.heap.track(n,p);return}catch(e){}}vtrQueueHeap(n,p)}
    function vtrZaraz(n,p){if(!(window.zaraz&&typeof window.zaraz.track==='function'))return;try{window.zaraz.track(n,p)}catch(e){}}
    function vtrPush(n,x){var p=vtrPayload(x);window.dataLayer=window.dataLayer||[];window.dataLayer.push(Object.assign({event:n},p));window.__vtrEdgeQueue=window.__vtrEdgeQueue||[];window.__vtrEdgeQueue.push({event:n,timestamp:Date.now(),payload:p});window.__vtrTopperEvents=window.__vtrTopperEvents||[];window.__vtrTopperEvents.push({event:n,timestamp:Date.now(),payload:p});if(n!=='page_view')vtrZaraz(n,p);vtrHeap(n,p)}
    window.__vtrRecordTopperEvent=vtrPush;
    window.__vtrReplayHeapEvents=vtrReplayHeap;
    window.__vtrAllowHeapReplay=vtrAllowHeapReplay;
    window.__vtrEdgeAnalytics=Object.assign(window.__vtrEdgeAnalytics||{},{version:A.schemaVersion,heapMode:'queued-user-or-idle-replay',zarazBridge:true,requiredEvents:['page_view','find_your_home_click','schedule_tour_click','apply_now_click','promo_open','promo_cta_click','menu_open']});
    ['pointerdown','keydown','touchstart','scroll'].forEach(function(type){addEventListener(type,function(){vtrAllowHeapReplay(type)},{once:true,passive:true})});
    setTimeout(function(){vtrAllowHeapReplay('delayed-idle')},12000)
    addEventListener('pagehide',function(){vtrAllowHeapReplay('pagehide')},{once:true});
    function firePV(){try{if(sessionStorage.getItem(DK))return;sessionStorage.setItem(DK,'1')}catch(e){}vtrPush('page_view',{page_title:document.title})}
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',firePV,{once:true})}else{firePV()}`;
}

function renderHybridShell() {
  const heroMobileUrl = assetUrl(ASSET_KEYS.heroMobile);
  const heroDesktopUrl = assetUrl(ASSET_KEYS.heroDesktop);
  const welcomeUrl = assetUrl(ASSET_KEYS.welcome);
  const featuresUrl = assetUrl(ASSET_KEYS.features);
  const lbleUrl = assetUrl(ASSET_KEYS.lble);

  return `<div class="vtr-edge-hybrid-shell" data-vtr-edge-hybrid-shell="1">
  <a class="vtr-shell-skip" href="#vtr-shell-main">Skip to main content</a>

  ${PROPERTY.promoEnabled ? `
  <div class="vtr-shell-promo" data-open="false">
    <button class="vtr-shell-promo-toggle" type="button" aria-expanded="false">${escapeHtml(PROPERTY.promoText)} <span aria-hidden="true"></span></button>
    <div class="vtr-shell-promo-panel" role="dialog" aria-label="${escapeHtml(PROPERTY.promoText)}">
      <button class="vtr-shell-promo-close" type="button" aria-label="Close special">&times;</button>
      <div class="vtr-shell-promo-inner">
        <img src="${PROPERTY.promoImageUrl}" width="1600" height="1200" loading="lazy" decoding="async" alt="">
        <div>
          <h2>${escapeHtml(PROPERTY.promoText)}</h2>
          <p>${escapeHtml(PROPERTY.promoText)}</p>
          <em>${escapeHtml(PROPERTY.promoDetail)}</em>
          <div class="vtr-shell-promo-actions">
            <a href="${PROPERTY.promoAvailabilityHref}" data-vtr-promo-cta="availability">See Availability</a>
            <a href="${PROPERTY.contactHref}" data-vtr-promo-cta="contact">Contact us</a>
          </div>
        </div>
      </div>
    </div>
  </div>
  ` : ""}

  <header class="vtr-shell-header">
    <a class="vtr-shell-logo" href="${PROPERTY.origin}/">${escapeHtml(PROPERTY.name)}</a>
    <div class="vtr-shell-actions">
      <a class="vtr-shell-phone" href="${PROPERTY.phoneHref}" aria-label="Call ${escapeHtml(PROPERTY.name)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg></a>
      <a class="vtr-shell-apply" href="${PROPERTY.applyHref}" rel="noopener">Apply Now</a>
      <a class="vtr-shell-tour" href="${PROPERTY.tourHref}" rel="noopener">Schedule A Tour</a>
      <button class="vtr-shell-menu" type="button" aria-label="Open menu" aria-controls="vtr-shell-drawer" aria-expanded="false"><span></span></button>
    </div>
  </header>

  <aside class="vtr-shell-drawer" id="vtr-shell-drawer" aria-label="Mobile menu" data-open="false">
    <button class="vtr-shell-drawer-close" type="button" aria-label="Close menu">&times;</button>
    ${renderVenterraLotusMark()}
    <nav>
      <a href="${PROPERTY.apartmentsHref}">Apartments &amp; Pricing</a>
      <a href="${PROPERTY.featuresHref}">Features</a>
      <a href="${PROPERTY.amenitiesHref}">Amenities</a>
      <a href="${PROPERTY.galleryHref}">Gallery</a>
      <a href="${PROPERTY.neighborhoodHref}">Location</a>
      <a href="${PROPERTY.faqsHref}">FAQs</a>
      <a href="${PROPERTY.reviewsHref}">Reviews</a>
      <a href="${PROPERTY.contactHref}">Contact</a>
      <a href="${PROPERTY.specialsHref}">Specials</a>
      <a href="${PROPERTY.aboutHref}">About Venterra</a>
      <a href="${PROPERTY.smartHubHref}" rel="noopener">SMARTHUB</a>
    </nav>
    <div class="vtr-shell-drawer-actions">
      <a href="${PROPERTY.tourHref}" rel="noopener">Schedule A Tour</a>
      <a href="${PROPERTY.applyHref}" rel="noopener">Apply Now</a>
    </div>
    <a class="vtr-shell-drawer-phone" href="${PROPERTY.phoneHref}">${escapeHtml(PROPERTY.phoneLabel)}</a>
    ${renderDrawerSocials()}
  </aside>

  <main id="vtr-shell-main" class="vtr-shell-main">
    <section class="vtr-shell-hero" aria-label="${escapeHtml(PROPERTY.name)} hero">
      <picture>
        <source media="(min-width: 768px)" srcset="${heroDesktopUrl}" type="image/avif">
        <img src="${heroMobileUrl}" width="750" height="1000"
             alt="${escapeHtml(PROPERTY.name)} community pool and clubhouse"
             loading="eager" fetchpriority="high" decoding="async">
      </picture>
      <div class="vtr-shell-hero-content">
        <a class="vtr-shell-rating" href="${PROPERTY.reviewsHref}" aria-label="${PROPERTY.rating} star rating from ${PROPERTY.reviewCount} reviews">
          <span class="vtr-shell-stars" style="--rating-percent:${ratingFillPercent(PROPERTY.rating)}%" aria-hidden="true">\u2605\u2605\u2605\u2605\u2605</span>
          <span>(${PROPERTY.rating}) ${PROPERTY.reviewCount} Reviews</span>
        </a>
        <div class="vtr-shell-kicker" role="img" aria-label="Live Better. Live Easy.">
          <img src="${lbleUrl}" width="375" height="93" alt="" aria-hidden="true" loading="eager" decoding="async">
        </div>
        <h1 class="vtr-shell-title">${escapeHtml(PROPERTY.heroHeadline)}</h1>
        <a class="vtr-shell-cta" href="${PROPERTY.apartmentsHref}">Find Your Home</a>
      </div>
    </section>

    <section class="vtr-shell-panel" aria-labelledby="vtr-shell-welcome-title">
      <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
        <div>
          <h2 id="vtr-shell-welcome-title">${escapeHtml(PROPERTY.welcomeTitle)}</h2>
          <p><strong class="vtr-shell-panel-kicker">${escapeHtml(PROPERTY.welcomeKicker)}</strong>${escapeHtml(PROPERTY.welcomeBody)}</p>
          <a class="vtr-shell-panel-btn" href="${PROPERTY.apartmentsHref}">See Available Homes</a>
          <img src="${PROPERTY.kingsleyAwardUrl}" class="vtr-shell-panel-award" width="100" height="100" loading="lazy" decoding="async" alt="Kingsley Excellence of resident satisfaction award badge">
        </div>
        <div class="vtr-shell-panel-media-group">
          <figure class="vtr-shell-panel-media vtr-shell-reveal vtr-shell-reveal-right">
            <img src="${welcomeUrl}" width="640" height="427" loading="lazy" decoding="async" alt="${escapeHtml(PROPERTY.name)} resident lounge and living space">
          </figure>
        </div>
      </div>
    </section>

    <section class="vtr-shell-panel vtr-shell-panel-alt" aria-labelledby="vtr-shell-features-title">
      <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
        <figure class="vtr-shell-panel-media vtr-shell-reveal vtr-shell-reveal-left">
          <img src="${featuresUrl}" width="900" height="600" loading="lazy" decoding="async" alt="${escapeHtml(PROPERTY.name)} apartment interior features">
        </figure>
        <div>
          <span class="vtr-shell-section-label">${escapeHtml(PROPERTY.featuresEyebrow)}</span>
          <h2 id="vtr-shell-features-title">${escapeHtml(PROPERTY.featuresTitle)}</h2>
          <p>${escapeHtml(PROPERTY.featuresBody)}</p>
          ${renderBullets(PROPERTY.featureBullets)}
          <a class="vtr-shell-panel-btn" href="${PROPERTY.featuresHref}">See Features</a>
        </div>
      </div>
    </section>
  </main>

  ${renderTopperAnalyticsScriptTag()}
  <script data-vtr-edge-hybrid-shell="interaction">(function(){
    var root=document.currentScript&&document.currentScript.closest?document.currentScript.closest('.vtr-edge-hybrid-shell'):document;
    var menu=root.querySelector('.vtr-shell-menu');
    var drawer=root.querySelector('#vtr-shell-drawer');
    var close=root.querySelector('.vtr-shell-drawer-close');
    function setDrawer(open){if(!drawer||!menu)return;drawer.dataset.open=open?'true':'false';menu.setAttribute('aria-expanded',open?'true':'false')}
    if(menu)menu.addEventListener('click',function(){setDrawer(true)});
    if(close)close.addEventListener('click',function(){setDrawer(false)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')setDrawer(false)});
    document.addEventListener('click',function(e){var el=e.target&&e.target.closest?e.target.closest('a[href],button'):null;if(!el||!root.contains(el))return;var h=el.getAttribute('href')||'',t=(el.textContent||'').trim(),promo=el.getAttribute('data-vtr-promo-cta');if(promo){vtrPush('promo_cta_click',{cta_label:t,cta_href:h,promo_cta:promo})}if(h.indexOf('/apartments/')!==-1||t==='Find Your Home'){vtrPush('find_your_home_click',{cta_label:t,cta_href:h})}else if(h.indexOf('scheduleTour')!==-1||t.indexOf('Tour')!==-1){vtrPush('schedule_tour_click',{cta_label:t,cta_href:h})}else if(h.indexOf('createPipelineApplication')!==-1||t.indexOf('Apply')!==-1){vtrPush('apply_now_click',{cta_label:t,cta_href:h})}},{passive:true});
	    var promoOpened=false;var promo=root.querySelector('.vtr-shell-promo');var promoToggle=root.querySelector('.vtr-shell-promo-toggle');var promoClose=root.querySelector('.vtr-shell-promo-close');function setPromo(open){if(!promo||!promoToggle)return;promo.dataset.open=open?'true':'false';promoToggle.setAttribute('aria-expanded',open?'true':'false');if(open&&!promoOpened){promoOpened=true;vtrPush('promo_open',{promo_text:promoToggle.textContent.trim()})}}if(promoToggle)promoToggle.addEventListener('click',function(){setPromo(!(promo.dataset.open==='true'))});if(promoClose)promoClose.addEventListener('click',function(){setPromo(false)});document.addEventListener('click',function(e){if(!promo||promo.dataset.open!=='true')return;if(e.target&&e.target.closest&&e.target.closest('.vtr-shell-promo'))return;setPromo(false)},{passive:true});
	    if(menu)menu.addEventListener('click',function(){vtrPush('menu_open',{menu:'mobile'})});
	  })();</script>
</div>`;
}

function renderPerformanceHybridDocument(variant = "desktop", property = PROPERTY, options = {}) {
  return renderWithRuntimeProperty(property, () => {
    const heroMobileUrl = assetUrl(ASSET_KEYS.heroMobile);
    const heroDesktopUrl = assetUrl(ASSET_KEYS.heroDesktop);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${renderHeadMeta({ preview: options.preview === true })}
  <link rel="preload" as="image" href="${heroMobileUrl}" type="image/avif" media="(max-width: 767px)" fetchpriority="high">
  <link rel="preload" as="image" href="${heroDesktopUrl}" type="image/avif" media="(min-width: 768px)" fetchpriority="high">
  <style>${shellCss()}
  body{margin:0;background:#fff}
  </style>
</head>
<body data-vtr-performance-shell="${escapeHtml(variant)}">
  ${renderHybridShell()}
  ${renderLazyNativeContinuation(variant)}
  ${renderZarazConsentUiScriptTag()}
</body>
</html>`;
  });
}

function renderLazyNativeContinuation(variant = "desktop") {
  const src = nativeContinuationPath(variant);
  return `<section class="vtr-shell-native-continuation" data-vtr-native-continuation-proof="1" data-vtr-native-continuation-state="idle" aria-label="Native site continuation">
    <div class="vtr-shell-native-continuation-card">
      <span class="vtr-shell-section-label">Continue Exploring</span>
      <h2>More from ${escapeHtml(PROPERTY.name)}</h2>
      <p>Reviews, amenities, neighborhood details, resident resources, and the full native site continue below once you move past the edge-owned first view.</p>
      <button class="vtr-shell-native-continuation-button" type="button" data-vtr-load-native-continuation>Load more</button>
    </div>
    <div class="vtr-shell-native-continuation-status" aria-live="polite"></div>
    <iframe class="vtr-shell-native-continuation-frame" title="${escapeHtml(PROPERTY.name)} native site continuation" loading="lazy" data-src="${src}" hidden></iframe>
  </section>
  <script data-vtr-native-continuation-loader="1">(function(){
    var section=document.querySelector('[data-vtr-native-continuation-proof="1"]');
    if(!section)return;
    var frame=section.querySelector('.vtr-shell-native-continuation-frame');
    var button=section.querySelector('[data-vtr-load-native-continuation]');
    var status=section.querySelector('.vtr-shell-native-continuation-status');
    var loaded=false;
    function setState(state,message){
      section.setAttribute('data-vtr-native-continuation-state',state);
      if(status)status.textContent=message||'';
    }
    function load(reason){
      if(loaded||!frame)return;
      loaded=true;
      setState('loading','Loading more from the native site.');
      frame.hidden=false;
      frame.src=frame.getAttribute('data-src');
      frame.addEventListener('load',function(){setState('loaded','')},{once:true});
      if(typeof window.__vtrRecordTopperEvent==='function'){window.__vtrRecordTopperEvent('native_continuation_load',{reason:reason||'unknown'})}
      else{window.__vtrEdgeQueue=window.__vtrEdgeQueue||[];window.__vtrEdgeQueue.push({event:'native_continuation_load',timestamp:Date.now(),payload:{reason:reason||'unknown',property_code:'${escapeHtml(PROPERTY.code)}'}})}
    }
    if(button)button.addEventListener('click',function(){load('button')});
    var continuationHeight=0;
    window.addEventListener('message',function(event){
      var data=event.data||{};
      if(data.type!=='vtr-native-continuation-height'||!frame)return;
      var reported=Number(data.height)||0;
      if(reported<=0)return;
      if(!continuationHeight){
        continuationHeight=reported;
      }else if(reported<=continuationHeight*1.25||continuationHeight<1200){
        continuationHeight=Math.max(continuationHeight,reported);
      }
      var height=Math.max(640,Math.min(9000,Math.ceil(continuationHeight)));
      frame.style.height=height+'px';
    });
    if('IntersectionObserver' in window){
      var observer=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){if(entry.isIntersecting){observer.disconnect();load('scroll')}})
      },{rootMargin:'160px 0px',threshold:0.01});
      observer.observe(section);
    }
  })();</script>`;
}

function renderShell() {
  const heroMobileUrl = assetUrl(ASSET_KEYS.heroMobile);
  const heroDesktopUrl = assetUrl(ASSET_KEYS.heroDesktop);
  const welcomeUrl = assetUrl(ASSET_KEYS.welcome);
  const featuresUrl = assetUrl(ASSET_KEYS.features);
  const amenitiesUrl = assetUrl(ASSET_KEYS.amenities);
  const benefitsPetsUrl = assetUrl(ASSET_KEYS.benefitsPets);
  const benefitsTechUrl = assetUrl(ASSET_KEYS.benefitsTech);
  const benefitsPerksUrl = assetUrl(ASSET_KEYS.benefitsPerks);
  const lbleUrl = assetUrl(ASSET_KEYS.lble);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${renderHeadMeta()}
  <link rel="preload" as="image" href="${heroMobileUrl}" type="image/avif" media="(max-width: 767px)" fetchpriority="high">
  <link rel="preload" as="image" href="${heroDesktopUrl}" type="image/avif" media="(min-width: 768px)" fetchpriority="high">
  <style>${shellCss()}</style>
</head>
<body class="vtr-edge-static-shell-body">
  <a class="vtr-shell-skip" href="#main">Skip to main content</a>

  <details class="vtr-shell-promo">
    <summary>${escapeHtml(PROPERTY.promoText)}</summary>
    <div class="vtr-shell-promo-panel">
      <h2>${escapeHtml(PROPERTY.promoText)}</h2>
      <p>${escapeHtml(PROPERTY.promoDetail)}</p>
      <div class="vtr-shell-promo-actions">
        <a href="${PROPERTY.specialsHref}" data-vtr-promo-cta="specials">See Specials</a>
        <a href="${PROPERTY.tourHref}" data-vtr-promo-cta="tour" rel="noopener">Schedule A Tour</a>
      </div>
    </div>
  </details>

  <header class="vtr-shell-header">
      <a class="vtr-shell-logo" href="${PROPERTY.origin}/">${escapeHtml(PROPERTY.name)}</a>
    <div class="vtr-shell-actions">
      <a class="vtr-shell-phone" href="${PROPERTY.phoneHref}" aria-label="Call ${escapeHtml(PROPERTY.name)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg></a>
      <a class="vtr-shell-apply" href="${PROPERTY.applyHref}" rel="noopener">Apply Now</a>
      <a class="vtr-shell-tour" href="${PROPERTY.tourHref}" rel="noopener">Schedule A Tour</a>
      <button class="vtr-shell-menu" type="button" aria-label="Open menu" aria-controls="vtr-shell-drawer" aria-expanded="false"><span></span></button>
    </div>
  </header>

  <aside class="vtr-shell-drawer" id="vtr-shell-drawer" aria-label="Mobile menu" data-open="false">
    <button class="vtr-shell-drawer-close" type="button" aria-label="Close menu">&times;</button>
    <nav>
      <a href="${PROPERTY.apartmentsHref}">Apartments &amp; Pricing</a>
      <a href="${PROPERTY.amenitiesHref}">Amenities</a>
      <a href="${PROPERTY.galleryHref}">Gallery</a>
      <a href="${PROPERTY.neighborhoodHref}">Location</a>
      <a href="${PROPERTY.faqsHref}">FAQs</a>
      <a href="${PROPERTY.reviewsHref}">Reviews</a>
      <a href="${PROPERTY.contactHref}">Contact</a>
      <a href="${PROPERTY.specialsHref}">Specials</a>
      <a href="https://venterraliving.com/" rel="noopener">About Venterra</a>
      <a href="https://venterra.com/smarthub/" rel="noopener">SMARTHUB</a>
    </nav>
    <div class="vtr-shell-drawer-actions">
      <a href="${PROPERTY.tourHref}" rel="noopener">Schedule A Tour</a>
      <a href="${PROPERTY.applyHref}" rel="noopener">Apply Now</a>
    </div>
    <a class="vtr-shell-drawer-phone" href="${PROPERTY.phoneHref}">${escapeHtml(PROPERTY.phoneLabel)}</a>
    <div class="vtr-shell-socials" aria-label="Social links">
      <a href="${PROPERTY.facebookHref}" aria-label="Facebook" rel="noopener">f</a>
      <a href="${PROPERTY.instagramHref}" aria-label="Instagram" rel="noopener">\u25ce</a>
      <a href="${PROPERTY.mapsHref}" aria-label="Google Maps" rel="noopener">G</a>
    </div>
  </aside>

  <main id="main" class="vtr-shell-main" data-vtr-edge-static-shell="1">
    <section class="vtr-shell-hero" aria-label="${escapeHtml(PROPERTY.name)} hero">
      <picture>
        <source media="(min-width: 768px)" srcset="${heroDesktopUrl}" type="image/avif">
        <img src="${heroMobileUrl}" width="750" height="1000"
             alt="${escapeHtml(PROPERTY.name)} community pool and clubhouse"
             loading="eager" fetchpriority="high" decoding="async">
      </picture>
      <div class="vtr-shell-hero-content">
        <a class="vtr-shell-rating" href="${PROPERTY.reviewsHref}" aria-label="${PROPERTY.rating} star rating from ${PROPERTY.reviewCount} reviews">
          <span class="vtr-shell-stars" style="--rating-percent:${ratingFillPercent(PROPERTY.rating)}%" aria-hidden="true">\u2605\u2605\u2605\u2605\u2605</span>
          <span>(${PROPERTY.rating}) ${PROPERTY.reviewCount} Reviews</span>
        </a>
        <div class="vtr-shell-kicker" role="img" aria-label="Live Better. Live Easy.">
          <img src="${lbleUrl}" width="375" height="93" alt="" aria-hidden="true" loading="eager" decoding="async">
        </div>
        <h1 class="vtr-shell-title">${escapeHtml(PROPERTY.heroHeadline)}</h1>
        <a class="vtr-shell-cta" href="${PROPERTY.apartmentsHref}">Find Your Home</a>
      </div>
    </section>

    <section class="vtr-shell-panel" aria-labelledby="vtr-shell-welcome-title">
      <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
        <div>
          <h2 id="vtr-shell-welcome-title">${escapeHtml(PROPERTY.welcomeTitle)}</h2>
          <p><strong class="vtr-shell-panel-kicker">${escapeHtml(PROPERTY.welcomeKicker)}</strong>${escapeHtml(PROPERTY.welcomeBody)}</p>
          <a class="vtr-shell-panel-btn" href="${PROPERTY.apartmentsHref}">See Available Homes</a>
          <img src="${PROPERTY.kingsleyAwardUrl}" class="vtr-shell-panel-award" width="100" height="100" loading="lazy" decoding="async" alt="Kingsley Excellence of resident satisfaction award badge">
        </div>
        <div class="vtr-shell-panel-media-group">
          <figure class="vtr-shell-panel-media">
            <img src="${welcomeUrl}" width="640" height="427" loading="lazy" decoding="async" alt="${escapeHtml(PROPERTY.name)} resident lounge and living space">
          </figure>
        </div>
      </div>
    </section>

    <section class="vtr-shell-panel vtr-shell-panel-alt" aria-labelledby="vtr-shell-features-title">
      <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
        <div>
          <span class="vtr-shell-section-label">${escapeHtml(PROPERTY.featuresEyebrow)}</span>
          <h2 id="vtr-shell-features-title">${escapeHtml(PROPERTY.featuresTitle)}</h2>
          <p>${escapeHtml(PROPERTY.featuresBody)}</p>
          ${renderBullets(PROPERTY.featureBullets)}
          <a class="vtr-shell-panel-btn" href="${PROPERTY.featuresHref}">See Features</a>
        </div>
        <figure class="vtr-shell-panel-media">
          <img src="${featuresUrl}" width="900" height="600" loading="lazy" decoding="async" alt="${escapeHtml(PROPERTY.name)} apartment interior features">
        </figure>
      </div>
    </section>

    <section class="vtr-shell-review" aria-label="Resident review">
      <div class="vtr-shell-review-card">
        <p>&ldquo;${escapeHtml(PROPERTY.reviewQuote)}&rdquo;</p>
        <div class="vtr-shell-review-stars" aria-label="Five star review">\u2605\u2605\u2605\u2605\u2605</div>
        <strong>${escapeHtml(PROPERTY.reviewAuthor)}</strong>
        <a href="${PROPERTY.reviewsHref}">Read More Reviews</a>
      </div>
    </section>

    <section class="vtr-shell-panel" aria-labelledby="vtr-shell-amenities-title">
      <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
        <div>
          <span class="vtr-shell-section-label">${escapeHtml(PROPERTY.amenitiesEyebrow)}</span>
          <h2 id="vtr-shell-amenities-title">${escapeHtml(PROPERTY.amenitiesTitle)}</h2>
          <p>${escapeHtml(PROPERTY.amenitiesBody)}</p>
          ${renderBullets(PROPERTY.amenityBullets)}
          <a class="vtr-shell-panel-btn" href="${PROPERTY.amenitiesHref}">See Amenities</a>
        </div>
        <figure class="vtr-shell-panel-media">
          <img src="${amenitiesUrl}" width="900" height="600" loading="lazy" decoding="async" alt="${escapeHtml(PROPERTY.name)} pool and outdoor amenities">
        </figure>
      </div>
    </section>

    <section class="vtr-shell-benefits" aria-labelledby="vtr-shell-benefits-title">
      <div class="vtr-shell-benefits-inner">
        <h2 id="vtr-shell-benefits-title">${escapeHtml(PROPERTY.benefitsTitle)}</h2>
        <div class="vtr-shell-benefit-tabs" aria-hidden="true">
          <span>Pet-Friendly Fun</span>
          <span>High-Tech Living</span>
          <span>Live Easy Perks</span>
        </div>
        <div class="vtr-shell-benefit-feature">
          <img src="${benefitsPetsUrl}" width="900" height="600" loading="lazy" decoding="async" alt="Residents walking dogs at a pet-friendly community">
          <div>
            <h3>${escapeHtml(PROPERTY.benefitsPetTitle)}</h3>
            <p>${escapeHtml(PROPERTY.benefitsPetBody)}</p>
            ${renderBullets(PROPERTY.benefitsPetBullets)}
            <a class="vtr-shell-text-link" href="${PROPERTY.amenitiesHref}">See Our Pet-Friendly Details</a>
          </div>
        </div>
      </div>
    </section>

    <section class="vtr-shell-neighborhood" aria-labelledby="vtr-shell-neighborhood-title">
      <div class="vtr-shell-neighborhood-head">
        <div>
          <span class="vtr-shell-section-label">${escapeHtml(PROPERTY.neighborhoodEyebrow)}</span>
          <h2 id="vtr-shell-neighborhood-title">${escapeHtml(PROPERTY.neighborhoodTitle)}</h2>
        </div>
        <a class="vtr-shell-panel-btn" href="${PROPERTY.neighborhoodHref}">See What's Around</a>
      </div>
      <div class="vtr-shell-neighborhood-grid">
        ${renderNeighborhoodTiles()}
      </div>
    </section>

    <section class="vtr-shell-care" aria-label="${escapeHtml(PROPERTY.careTitle)}">
      <img src="${CARE_IMAGE_URL}" width="1600" height="900" loading="lazy" decoding="async" alt="Venterra team members meeting with residents">
      <div>
        <h2>${escapeHtml(PROPERTY.careTitle)}</h2>
        <a href="https://venterra.com/" rel="noopener">See Why</a>
      </div>
    </section>

    <section class="vtr-shell-final-cta" aria-label="Find your next home at Champions Green">
      <h2>Find Your Home at ${escapeHtml(PROPERTY.name)}</h2>
      <div class="vtr-shell-final-actions">
        <a href="${PROPERTY.apartmentsHref}">${escapeHtml(PROPERTY.oneBedroomLabel)}</a>
        <a href="${PROPERTY.apartmentsHref}">${escapeHtml(PROPERTY.twoBedroomLabel)}</a>
        <a href="${PROPERTY.apartmentsHref}">${escapeHtml(PROPERTY.threeBedroomLabel)}</a>
      </div>
    </section>
  </main>

  ${renderTopperAnalyticsScriptTag()}
  <script data-vtr-edge-static-shell="interaction">(function(){
    var menu=document.querySelector('.vtr-shell-menu');
    var drawer=document.getElementById('vtr-shell-drawer');
    var close=document.querySelector('.vtr-shell-drawer-close');
    function setDrawer(open){if(!drawer||!menu)return;drawer.dataset.open=open?'true':'false';menu.setAttribute('aria-expanded',open?'true':'false')}
    if(menu)menu.addEventListener('click',function(){setDrawer(true)});
    if(close)close.addEventListener('click',function(){setDrawer(false)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')setDrawer(false)});

    document.addEventListener('click',function(e){var el=e.target&&e.target.closest?e.target.closest('a[href],button'):null;if(!el)return;var h=el.getAttribute('href')||'',t=(el.textContent||'').trim(),promo=el.getAttribute('data-vtr-promo-cta');if(promo){vtrPush('promo_cta_click',{cta_label:t,cta_href:h,promo_cta:promo})}if(h.indexOf('/apartments/')!==-1||t==='Find Your Home'){vtrPush('find_your_home_click',{cta_label:t,cta_href:h})}else if(h.indexOf('scheduleTour')!==-1||t.indexOf('Tour')!==-1){vtrPush('schedule_tour_click',{cta_label:t,cta_href:h})}else if(h.indexOf('createPipelineApplication')!==-1||t.indexOf('Apply')!==-1){vtrPush('apply_now_click',{cta_label:t,cta_href:h})}},{passive:true});
    var promoOpened=false;var promo=document.querySelector('.vtr-shell-promo');if(promo)promo.addEventListener('toggle',function(){if(promo.open&&!promoOpened){promoOpened=true;vtrPush('promo_open',{promo_text:promo.querySelector('summary').textContent.trim()})}});
    if(menu)menu.addEventListener('click',function(){vtrPush('menu_open',{menu:'mobile'})});

  })();</script>
</body>
</html>`;
}

// ── Shell CSS — matches Pilot buildEdgeStaticShellHead() exactly ──────────────

function shellCss() {
  return `@font-face{font-family:'Lato';font-style:normal;font-weight:400;font-display:swap;src:url('${assetUrl("resi-edge-assets/shared/fonts/lato-71f7cc3a.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:'Lato';font-style:normal;font-weight:700;font-display:swap;src:url('${assetUrl("resi-edge-assets/shared/fonts/lato-9b155c87.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:'Lato';font-style:normal;font-weight:900;font-display:swap;src:url('${assetUrl("resi-edge-assets/shared/fonts/lato-78f0db0a.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:'Noto Serif';font-style:normal;font-weight:700;font-display:swap;src:url('${assetUrl("resi-edge-assets/shared/fonts/notoserif-194b0294.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:'Brittany Signature';font-style:normal;font-weight:400;font-display:swap;src:url('${assetUrl("resi-edge-assets/shared/fonts/BrittanySignature.woff2")}') format('woff2')}html{margin:0;padding:0;max-width:100%;overflow-x:hidden;background:#fff;color:#15284B;font-family:Lato,Arial,Helvetica,sans-serif;font-size:18px;font-weight:400;line-height:1.625;text-size-adjust:100%;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
body.vtr-edge-static-shell-body{margin:0;min-width:320px;max-width:100%;background:#fff;color:#15284B;overflow-x:hidden}
.vtr-shell-skip{position:absolute;left:12px;top:-60px;z-index:10;background:#fff;color:#15284B;padding:8px 10px;border-radius:4px;text-decoration:none;font-weight:700}.vtr-shell-skip:focus{top:12px}
	.vtr-shell-promo{position:relative;z-index:60;background:#15284B;color:#fff}.vtr-shell-promo-toggle{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;height:46px;padding:0 20px;box-sizing:border-box;border:0;background:#15284B;color:#fff;cursor:pointer;font-family:Lato,Arial,Helvetica,sans-serif;font-size:13px;font-weight:900;line-height:46px;letter-spacing:1.5px;text-align:center}.vtr-shell-promo-toggle span{width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px)}.vtr-shell-promo[data-open="true"] .vtr-shell-promo-toggle span{transform:rotate(225deg) translateY(-2px)}.vtr-shell-promo-panel{display:none;position:absolute;left:0;right:0;top:100%;z-index:70;min-height:391px;padding:40px 40px 39px;box-sizing:border-box;background:#F6F6F5;color:#15284B;text-align:center;box-shadow:0 16px 30px rgba(21,40,75,.18)}.vtr-shell-promo[data-open="true"] .vtr-shell-promo-panel{display:block}.vtr-shell-promo-close{position:absolute;right:36px;top:38px;width:36px;height:36px;border:0;background:transparent;color:#9B9B96;cursor:pointer;font-size:0;line-height:1}.vtr-shell-promo-close:before,.vtr-shell-promo-close:after{content:"";position:absolute;left:6px;top:17px;width:26px;height:2px;background:currentColor}.vtr-shell-promo-close:before{transform:rotate(45deg)}.vtr-shell-promo-close:after{transform:rotate(-45deg)}.vtr-shell-promo-inner{display:grid;grid-template-columns:416px minmax(320px,1fr);gap:116px;align-items:center;max-width:900px;margin:0 auto}.vtr-shell-promo-inner img{display:block;width:416px;height:312px;object-fit:cover}.vtr-shell-promo-panel h2{margin:0 0 24px;color:#15284B;font-family:'Noto Serif',Georgia,"Times New Roman",serif;font-size:28px;font-weight:700;line-height:1.18;letter-spacing:0;white-space:nowrap}.vtr-shell-promo-panel p{margin:0 0 24px;color:#15284B;font-size:18px;font-weight:400;line-height:1.45}.vtr-shell-promo-panel em{display:block;margin:0 0 42px;color:#15284B;font-size:17px;font-style:italic;font-weight:400;line-height:1.45}.vtr-shell-promo-actions{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap}.vtr-shell-promo-panel a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 28px;border:2px solid transparent;border-radius:50px;color:#15284B;background:#fff;text-decoration:none;font-size:13px;font-weight:900;line-height:46px;letter-spacing:1.5px}.vtr-shell-promo-panel a:first-child{background:#3D66B9;color:#fff;border-color:#3D66B9}.vtr-shell-promo-panel a:last-child{background:transparent;border-color:transparent}
.vtr-shell-header{height:80px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 15px;background:#fff;color:#15284B;border-bottom:1px solid rgba(21,40,75,.08)}.vtr-shell-logo{height:80px;display:flex;align-items:center;font-size:10px;font-weight:700;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:#15284B;text-decoration:none;white-space:nowrap}.vtr-shell-actions{height:80px;display:flex;align-items:center;gap:20px}.vtr-shell-phone{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:#15284B;text-decoration:none}.vtr-shell-phone svg{display:block;width:20px;height:20px;fill:currentColor}.vtr-shell-apply{display:none;color:#15284B;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:1.5px}.vtr-shell-tour{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border:2px solid #15284B;border-radius:50px;color:#15284B;background:#fff;text-decoration:none;font-size:0;font-weight:900;letter-spacing:1.5px;line-height:40px}.vtr-shell-tour:after{content:"Tour";font-size:11.5px}.vtr-shell-menu{position:relative;width:20px;height:80px;padding:0;border:0;background:transparent;color:#15284B;font-size:0;line-height:1;cursor:pointer}.vtr-shell-menu:before,.vtr-shell-menu:after,.vtr-shell-menu span{content:"";position:absolute;left:0;right:0;height:2px;background:#15284B}.vtr-shell-menu:before{top:31px}.vtr-shell-menu span{top:39px}.vtr-shell-menu:after{top:47px}
.vtr-shell-drawer{position:fixed;top:0;right:auto;bottom:0;left:calc(100vw - 270px);z-index:90;width:270px;height:100svh;min-height:100vh;padding:50px 25px 34px;background:#15284B;color:#fff;box-shadow:-20px 0 60px rgba(21,40,75,.22);transform:translateX(105%);transition:transform .18s ease;box-sizing:border-box;overflow:auto}.vtr-shell-drawer[data-open="true"]{transform:translateX(0)}.vtr-shell-drawer-close{position:absolute;top:5px;right:5px;display:flex;align-items:center;justify-content:center;width:37px;height:37px;margin:0;border:0;background:transparent;color:#fff;border-radius:0;font-size:30px;line-height:1;cursor:pointer}.vtr-shell-drawer .vtr-shell-drawer-logo{display:block;width:40px;height:24px;margin:0 0 20px;padding:0;color:#fff}.vtr-shell-drawer-logo svg{display:block;width:40px;height:auto}.vtr-shell-drawer nav{display:grid;gap:0;margin-top:0}.vtr-shell-drawer nav a{display:block;padding:8px 0;color:#fff;text-decoration:none;font-size:15px;font-weight:700;line-height:24.375px;letter-spacing:.75px;border-bottom:0}.vtr-shell-drawer-actions{display:flex;align-items:center;gap:10px;margin:20px 0 17px}.vtr-shell-drawer-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border:2px solid rgba(255,255,255,.72);border-radius:50px;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;white-space:nowrap;color:#fff;text-decoration:none}.vtr-shell-drawer-actions a:first-child{background:#fff;color:#15284B;border-color:#fff}.vtr-shell-drawer .vtr-shell-drawer-phone{display:block;padding:0;color:#fff;font-size:14px;font-weight:900;line-height:28px;letter-spacing:1.5px;text-decoration:none}.vtr-shell-socials{display:flex;gap:22px;margin-top:20px}.vtr-shell-socials a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:2px solid #fff;border-radius:50%;font-size:18px;font-weight:900;line-height:1;letter-spacing:0;color:#fff;text-decoration:none;box-sizing:border-box}.vtr-shell-socials svg{display:block;width:16px;height:16px;fill:currentColor}.vtr-shell-socials span{display:block;font-size:18px;font-weight:900;line-height:1}
.vtr-shell-hero{position:relative;display:flex;align-items:center;justify-content:center;height:calc(100svh - 126px);min-height:584px;max-height:none;overflow:hidden;background:#15284B;color:#fff;text-align:center;contain:layout paint}.vtr-shell-hero picture{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:hidden}.vtr-shell-hero picture>img{position:absolute;inset:0;width:100%;height:100%;min-width:100%;min-height:100%;max-width:none;display:block;object-fit:cover;object-position:center center}.vtr-shell-hero:after{content:"";position:absolute;inset:0;background:rgba(21,40,75,.36)}.vtr-shell-hero-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:100%;max-width:920px;padding:0 24px;box-sizing:border-box}.vtr-shell-rating{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 30px;color:#fff;font-size:13px;font-weight:900;line-height:18.2px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;cursor:pointer}.vtr-shell-rating:focus-visible{outline:2px solid #fff;outline-offset:4px}.vtr-shell-stars{font-size:31px;line-height:1;letter-spacing:3px;background:linear-gradient(90deg,#fff var(--rating-percent,100%),rgba(255,255,255,.35) var(--rating-percent,100%));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}.vtr-shell-kicker{display:block;width:clamp(360px,48vw,700px);max-width:calc(100vw - 48px);aspect-ratio:374.75/92.57;height:auto;margin:0 0 18px;filter:drop-shadow(0 2px 14px rgba(0,0,0,.26))}.vtr-shell-kicker img{position:static;inset:auto;display:block;width:100%;height:100%;min-width:0;min-height:0;max-width:100%;object-fit:contain;object-position:center}.vtr-shell-title{width:min(640px,100%);margin:0;color:#fff;font-size:19px;font-weight:700;line-height:1.4;letter-spacing:.5px;text-shadow:0 1px 10px rgba(0,0,0,.34)}.vtr-shell-cta{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:50px;margin-top:34px;padding:0 20px;border:2px solid #fff;border-radius:50px;background:#fff;color:#14294B;font-size:14px;font-weight:900;letter-spacing:1.5px;line-height:46px;text-decoration:none;box-shadow:none;transition:color .1s ease-in-out,background-color .1s ease-in-out,border-color .1s ease-in-out,box-shadow .1s ease-in-out}.vtr-shell-cta:hover,.vtr-shell-cta:focus-visible{background:rgba(255,255,255,0);color:#fff;border-color:#fff;text-decoration:none}.vtr-shell-cta:focus-visible{outline:2px solid #fff;outline-offset:4px}.vtr-shell-cta:after{content:"\u2192";position:relative;top:-1px;margin-left:6px;font-size:13px;line-height:1}
.vtr-shell-main{background:#fff}.vtr-shell-panel{padding:70px 15px;background:#F6F6F5;color:#15284B;box-sizing:border-box;overflow:hidden}.vtr-shell-panel-inner{max-width:1600px;margin:0 auto}.vtr-shell-section-label{display:block;margin:0 0 14px;color:#3D66B9;font-size:11px;font-weight:900;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase}.vtr-shell-panel h2{margin:0 0 20px;color:#15284B;font-family:'Noto Serif',Georgia,"Times New Roman",serif;font-size:27px;line-height:35.1px;font-weight:700;letter-spacing:.5px}.vtr-shell-panel p{margin:0 0 20px;color:#15284B;font-size:18px;line-height:29.25px}.vtr-shell-panel-kicker{display:block;margin:0 0 14px;color:#15284B;font-size:18px;font-weight:700;line-height:29.25px}.vtr-shell-bullets{display:grid;grid-template-columns:1fr;gap:10px 26px;margin:18px 0 0;padding:0;list-style:none;color:#15284B}.vtr-shell-bullets li{position:relative;padding-left:16px;font-size:14px;line-height:1.5}.vtr-shell-bullets li:before{content:"";position:absolute;left:0;top:.7em;width:5px;height:5px;border-radius:50%;background:#3D66B9}.vtr-shell-panel-media-group{margin:26px 0 0}.vtr-shell-panel-media{margin:0;overflow:hidden;border-radius:6px;background:#F6F6F5}.vtr-shell-panel-media img{display:block;width:100%;height:100%;object-fit:cover}.vtr-shell-panel-award{display:block;margin-top:32px;width:64px;max-width:64px;height:auto}.vtr-shell-panel-alt{background:#fff}.vtr-shell-panel-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:24px;padding:0 22px;border:2px solid #15284B;border-radius:50px;color:#15284B;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:1.5px;line-height:40px}.vtr-shell-panel:first-of-type .vtr-shell-panel-btn{background:#3D66B9;color:#fff;border-color:#3D66B9}
.vtr-shell-native-continuation{padding:58px 20px;background:#F6F6F5;color:#15284B;text-align:center}.vtr-shell-native-continuation-card{max-width:760px;margin:0 auto}.vtr-shell-native-continuation h2{margin:0 0 12px;color:#15284B;font-family:'Noto Serif',Georgia,"Times New Roman",serif;font-size:30px;line-height:1.15}.vtr-shell-native-continuation p{max-width:680px;margin:0 auto 22px;font:500 16px/1.65 Lato,Arial,Helvetica,sans-serif}.vtr-shell-native-continuation-button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 22px;border:2px solid #15284B;border-radius:50px;color:#15284B;background:#fff;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:1.4px;line-height:38px;cursor:pointer}.vtr-shell-native-continuation-status{min-height:22px;margin-top:12px;color:#15284B;font:700 12px/1.4 Lato,Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase}.vtr-shell-native-continuation-frame{display:block;width:100%;min-height:640px;margin:36px auto 0;border:0;background:#fff}.vtr-shell-native-continuation-frame[hidden]{display:none}.vtr-shell-native-continuation[data-vtr-native-continuation-state="loaded"]{padding:0;background:#fff}.vtr-shell-native-continuation[data-vtr-native-continuation-state="loaded"] .vtr-shell-native-continuation-card,.vtr-shell-native-continuation[data-vtr-native-continuation-state="loaded"] .vtr-shell-native-continuation-status{display:none}.vtr-shell-native-continuation[data-vtr-native-continuation-state="loaded"] .vtr-shell-native-continuation-frame{margin:0 auto}
@media (min-width:768px){.vtr-shell-apply,.vtr-shell-tour{display:inline-flex}.vtr-shell-header{height:80px;padding:0 max(40px,calc((100vw - 1600px)/2))}.vtr-shell-logo{font-size:18px;line-height:24px;letter-spacing:3px}.vtr-shell-phone{width:auto;font-size:13px;font-weight:900;line-height:1;letter-spacing:1.5px}.vtr-shell-phone svg{display:none}.vtr-shell-phone:after{content:"${escapeHtml(PROPERTY.phoneLabel)}"}.vtr-shell-tour{min-height:44px;padding:0 25px;font-size:12px;line-height:40px}.vtr-shell-menu{width:38px}.vtr-shell-drawer{left:calc(100vw - 450px);width:450px;padding:45px 30px 45px}.vtr-shell-drawer-close{top:10px;right:10px}.vtr-shell-drawer nav a{font-size:18px;line-height:29.25px;padding:8px 0}.vtr-shell-hero{height:calc(100svh - 126px);min-height:640px;max-height:none}.vtr-shell-hero-content{transform:translateY(10px)}.vtr-shell-rating{margin-bottom:12px}.vtr-shell-stars{font-size:18px;letter-spacing:2px}.vtr-shell-kicker{width:clamp(420px,48vw,700px);max-width:calc(100vw - 96px);margin-bottom:14px}.vtr-shell-title{width:auto;max-width:760px;font-size:17px;line-height:1.25}.vtr-shell-cta{margin-top:20px}.vtr-shell-panel{min-height:740px;padding:120px 40px}.vtr-shell-panel h2{font-size:34px;line-height:1.15}.vtr-shell-panel-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:70px;align-items:center;justify-content:center;max-width:1600px}.vtr-shell-panel-media-group{margin:0}.vtr-shell-panel-media{height:500px}.vtr-shell-panel-alt .vtr-shell-panel-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.vtr-shell-panel-alt .vtr-shell-panel-media{order:-1}.vtr-shell-bullets{grid-template-columns:1fr 1fr}.vtr-shell-benefit-feature{grid-template-columns:1fr 1fr;gap:54px}.vtr-shell-benefits h2{font-size:38px}.vtr-shell-neighborhood-grid{grid-template-columns:1fr 2fr 1fr}.vtr-shell-neighborhood h2{font-size:36px}.vtr-shell-final-cta h2{font-size:30px}}
	@media (max-width:767px){.vtr-shell-promo-panel{min-height:300px;padding:44px 18px 38px}.vtr-shell-promo-inner{display:block;max-width:354px}.vtr-shell-promo-inner img{display:none}.vtr-shell-promo-close{right:16px;top:16px}.vtr-shell-promo-panel h2{margin-bottom:18px;font-size:27px;line-height:1.2;white-space:normal}.vtr-shell-promo-panel p{margin-bottom:14px;font-size:18px;line-height:1.4}.vtr-shell-promo-panel em{margin-bottom:30px;font-size:15px;line-height:1.45}.vtr-shell-promo-actions{gap:12px}.vtr-shell-promo-panel a{min-height:44px;padding:0 20px;font-size:12px;line-height:40px}.vtr-shell-hero picture>img{object-position:center top}.vtr-shell-hero-content{position:absolute;left:0;right:0;top:52%;transform:translateY(-50%);padding:0 18px}.vtr-shell-rating{flex-wrap:wrap;gap:8px;margin:0 0 12px;font-size:12px;line-height:1.2;letter-spacing:1.9px}.vtr-shell-stars{font-size:22px;letter-spacing:2px}.vtr-shell-kicker{width:clamp(240px,58vw,360px);max-width:calc(100vw - 36px);margin-bottom:24px}.vtr-shell-title{width:min(92vw,520px);font-size:18px;line-height:1.35}.vtr-shell-cta{margin-top:24px}.vtr-shell-panel-award{width:clamp(52px,12vw,64px);max-width:64px}}
@media (min-width:1200px){.vtr-shell-hero{height:calc(100svh - 126px);min-height:640px;max-height:none}.vtr-shell-hero picture>img{object-position:center center}.vtr-shell-kicker{width:clamp(560px,48vw,700px)}.vtr-shell-title{font-size:19px;line-height:1.4}}
@media (max-width:520px){.vtr-shell-header{padding:0 15px}.vtr-shell-actions{gap:20px}.vtr-shell-tour{display:inline-flex;width:auto;min-height:44px;height:auto;padding:0 20px;font-size:0;line-height:40px}.vtr-shell-tour:after{content:"Tour";font-size:11.5px}.vtr-shell-apply{display:none}.vtr-shell-drawer-actions{gap:10px}.vtr-shell-drawer-actions a{box-sizing:border-box;padding:0;font-size:0}.vtr-shell-drawer-actions a:first-child{width:79px}.vtr-shell-drawer-actions a:last-child{width:90px}.vtr-shell-drawer-actions a:first-child:after{content:"Tour";font-size:14px}.vtr-shell-drawer-actions a:last-child:after{content:"Apply";font-size:14px}.vtr-shell-hero{height:calc(100svh - 126px);min-height:584px;max-height:none}.vtr-shell-hero picture>img{object-position:center top}.vtr-shell-hero-content{position:absolute;left:0;right:0;top:52%;transform:translateY(-50%);padding:0 15px}.vtr-shell-rating{margin:0 0 14px;font-size:12px;line-height:1.2}.vtr-shell-stars{font-size:22px;letter-spacing:2px}.vtr-shell-kicker{width:clamp(220px,62vw,300px);max-width:calc(100vw - 30px);margin-bottom:30px}.vtr-shell-title{width:min(92vw,365px);font-size:18px;line-height:1.35}.vtr-shell-cta{margin-top:24px}.vtr-shell-panel:not(.vtr-shell-panel-alt) .vtr-shell-panel-media-group{display:none}.vtr-shell-panel-media{margin-top:30px}.vtr-shell-benefits{padding:64px 18px}.vtr-shell-final-cta{padding:62px 18px}}`;
}
