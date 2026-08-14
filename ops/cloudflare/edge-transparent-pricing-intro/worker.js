import vineHeroMobileWebp from "./assets/thevine/hero-mobile-900.webp";
import vineHeroMobileJpg from "./assets/thevine/hero-mobile-900.jpg";
import { renderZarazConsentPillScript } from "../shared/resi-consent-widget/widget.mjs";

const EDGE_MESSAGE_CONFIG = {
  id: "edge_message_the_vine_transparent_pricing_homepage_v1",
  configVersion: "2026-07-01-the-vine-production-fallback",
  initiative: "vip_list",
  enabled: false,
  hostnames: ["thevinekyle.com", "www.thevinekyle.com"],
  pathExact: ["/"],
  pathIncludes: [],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: [
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf"
  ],
  cookieName: "v_edge_msg_seen",
  ignoreFrequencyCap: false,
  forceCookieName: "v_edge_msg_force_once",
  resetCookieName: "v_edge_msg_reset_once",
  cookieMaxAgeSeconds: 86400,
  forceParam: "edge_message_force",
  resetParam: "edge_message_reset",
  showDelayMs: 2000,
  durationMs: 7000,
  fadeMs: 600,
  waitForUnitSelectors: false,
  brandName: "VENTERRA",
  propertyCode: "TX4EK",
  communityId: "44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e",
  propertyName: "The Vine Kyle Parkway",
  brandColor: "#15284B",
  title: "Join the VIP List",
  body:
    "Receive insider updates, leasing specials, and early access opportunities.",
  disclaimer: "",
  ctaLabel: "Get in the Know!",
  ctaHref: "/contact/#contact",
  autoCloseTextPrefix: "Closing in",
  closeLabel: "Close pricing message",
  analyticsEnabled: true
};

const EDGE_COACH_MARK_CONFIG = {
  id: "edge_message_the_vine_all_in_pricing_coachmark_v1",
  configVersion: "2026-07-01-the-vine-production-fallback",
  initiative: "all_in_pricing",
  enabled: false,
  hostnames: ["thevinekyle.com", "www.thevinekyle.com"],
  pathExact: ["/apartments/"],
  pathIncludes: [],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  cookieName: "v_edge_coachmark_seen",
  ignoreFrequencyCap: false,
  cookieMaxAgeSeconds: 86400,
  showDelayMs: 300,
  durationMs: 9000,
  fadeMs: 260,
  propertyCode: "TX4EK",
  communityId: "44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e",
  propertyName: "The Vine Kyle Parkway",
  brandColor: "#3D66B9",
  accentColor: "#7DCAC2",
  iconTextColor: "#294782",
  surfaceTextColor: "#FFFFFF",
  titleFontSizePx: 14,
  bodyFontSizePx: 13,
  maxWidthPx: 460,
  targetText: "All-In Price & Details",
  title: "All-in pricing",
  body: "See rent plus required monthly fees together before you choose a home.",
  closeLabel: "Close all-in pricing tip",
  analyticsEnabled: true
};

const PILOT_EDGE_MESSAGE_CONFIG = {
  ...EDGE_MESSAGE_CONFIG,
  id: "edge_transparent_pricing_intro_homepage_v1",
  configVersion: "2026-07-02-pilot-demo",
  initiative: "transparent_pricing",
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  ignoreFrequencyCap: true,
  showDelayMs: 800,
  durationMs: 7000,
  fadeMs: 360,
  waitForUnitSelectors: false,
  propertyCode: "GA4AX",
  communityId: "eed3da54-7b7a-4dae-984b-a203113fc2f3",
  propertyName: "Apex West Midtown",
  brandColor: "#15284B",
  titleColor: "#000000",
  bodyColor: "#294782",
  disclaimerColor: "#9B9B96",
  propertyNameFontSizePx: 18,
  titleFontSizePx: 44,
  bodyFontSizePx: 24,
  disclaimerFontSizePx: 16,
  countdownFontSizePx: 20,
  title: "Say hello to clearer\nmonthly pricing",
  body:
    "See base rent plus required monthly fees together, so your estimated monthly cost is easier to understand.",
  disclaimer: "Required monthly fees exclude variable fees and optional services.",
  ctaLabel: "",
  ctaHref: "",
  closeLabel: "Close pricing message"
};

const PILOT_EDGE_COACH_MARK_CONFIG = {
  ...EDGE_COACH_MARK_CONFIG,
  id: "edge_message_all_in_pricing_coachmark_v1",
  configVersion: "2026-07-02-pilot-demo",
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/apartments/"],
  ignoreFrequencyCap: true,
  propertyCode: "GA4AX",
  communityId: "eed3da54-7b7a-4dae-984b-a203113fc2f3",
  propertyName: "Apex West Midtown",
  brandColor: "#3D66B9",
  accentColor: "#7DCAC2",
  iconTextColor: "#294782",
  surfaceTextColor: "#FFFFFF",
  titleFontSizePx: 14,
  bodyFontSizePx: 13,
  maxWidthPx: 460,
  targetText: "All-In Price & Details",
  title: "All-in pricing",
  body: "See rent plus required monthly fees together before you choose a home.",
  closeLabel: "Close all-in pricing tip"
};

const EDGE_MESSAGE_FALLBACK_CONFIGS = [EDGE_MESSAGE_CONFIG, PILOT_EDGE_MESSAGE_CONFIG];
const EDGE_COACH_MARK_FALLBACK_CONFIGS = [EDGE_COACH_MARK_CONFIG, PILOT_EDGE_COACH_MARK_CONFIG];

const ZARAZ_CONSENT_NOTICE_CONFIG = {
  enabled: true,
  hostnames: ["pilot.venterradev.com", "thevinekyle.com", "www.thevinekyle.com"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  storageKey: "vtr_zaraz_consent_notice_done_v2",
  interactionQueueKey: "vtr_zaraz_pending_interactions_v1",
  interactionQueueMax: 30,
  interactionQueueTtlMs: 30 * 60 * 1000,
  interactionTrackEventName: "vtr_preconsent_interaction",
  unresolvedReportPath: "/__vtr/zaraz-consent-unresolved",
  unresolvedReportMaxEvents: 30,
  propertyCode: "TX4EK",
  communityId: "44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e",
  propertyName: "The Vine Kyle Parkway",
  text: "This website uses cookies",
  privacyHref: "/privacy-policy/",
  acceptLabel: "Accept",
  manageLabel: "Preferences"
};

const RESI_PERFORMANCE_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  damOrigin: "https://dam.getresi.co",
  resiPixelOrigin: "https://js.getresi.co",
  homeHeroImageUrl: "https://dam.getresi.co/18515/conversions/Home-Hero-full.jpg",
  apartmentEagerDamImages: 4,
  headerHeroPreloadEnabled: false,
  headHeroPreloadEnabled: false,
  heroBackgroundRewriteEnabled: true,
  apartmentImageHintsEnabled: false,
  rewriteServerTiming: 'vtr_edge_hero_render;desc="inline-bg"'
};

const RESI_LEGACY_SCRIPT_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/", "/apartments/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  scriptSrcIncludes: ["/wp-content/plugins/resi-elements/assets/ie-11.js"],
  serverTiming: 'vtr_edge_legacy_script;desc="ie11-removed"'
};

const RESI_JQUERY_MIGRATE_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/", "/apartments/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  scriptSrcIncludes: ["/wp-includes/js/jquery/jquery-migrate.min.js"],
  serverTiming: 'vtr_edge_jquery_migrate;desc="removed"'
};

const RESI_PIXEL_IDLE_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/apartments/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  scriptSrcIncludes: ["https://js.getresi.co/pixel/latest/resi-pixel.iife.js"],
  delayMs: 1500,
  requireZarazConsent: true,
  consentPurposeNameIncludes: ["marketing", "leasing", "attribution"],
  injectIdleLoader: true,
  mobileOnly: false,
  serverTiming: 'vtr_edge_resi_pixel;desc="idle"'
};

const RESI_HOME_RESI_PIXEL_IDLE_CONFIG = {
  ...RESI_PIXEL_IDLE_CONFIG,
  pathExact: [],
  delayMs: 1750,
  injectIdleLoader: false,
  serverTiming: 'vtr_edge_resi_pixel;desc="native-blocked-zaraz"'
};

const RESI_SIGHTMAP_CONFIG = {
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/apartments/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  iframeId: "resi_sightmap",
  iframeSrcIncludes: ["https://sightmap.com/embed/"],
  apiScriptSrcIncludes: ["https://sightmap.com/embed/api.js"],
  serverTiming: 'vtr_edge_sightmap;desc="lazy"'
};

const RESI_HERO_MOBILE_IMAGE_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  mobileImageUrl:
    "https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-750.webp",
  mobileSrcset:
    "https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-750.webp 750w",
  sizes: "100vw",
  width: 750,
  height: 1001,
  matchSrcIncludes: ["Apex-West-Midtown-Home-Hero"],
  preloadEnabled: false,
  criticalCssEnabled: false,
  serverTiming: 'vtr_edge_hero_mobile;desc="mobile-source"',
  preloadServerTiming: 'vtr_edge_hero_preload;desc="mobile-750"',
  criticalCssServerTiming: 'vtr_edge_hero_critical_css;desc="mobile"'
};

const RESI_MOBILE_IMAGE_REPLACEMENT_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  replacements: [
    {
      key: "home-welcome",
      originalSrc: "https://dam.getresi.co/18516/conversions/Home-Welcome-full.jpg",
      replacementSrc:
        "https://pilot.venterradev.com/wp-content/uploads/2026/07/Home-Welcome-640.avif"
    },
    {
      key: "home-features",
      originalSrc: "https://dam.getresi.co/18513/conversions/Home-Features-full.jpg",
      replacementSrc:
        "https://pilot.venterradev.com/wp-content/uploads/2026/07/Home-Features-900.webp"
    },
    {
      key: "home-amenities",
      originalSrc: "https://dam.getresi.co/18514/conversions/Home-Amenities-full.jpg",
      replacementSrc:
        "https://pilot.venterradev.com/wp-content/uploads/2026/07/Home-Amenities-900.webp"
    },
    {
      key: "benefits-pets",
      originalSrc: "https://dam.getresi.co/3022/conversions/Venterra-Benefits_Pets-full.jpg",
      replacementSrc:
        "https://pilot.venterradev.com/wp-content/uploads/2026/07/Venterra-Benefits_Pets-1200.webp"
    }
  ],
  serverTiming: 'vtr_edge_mobile_images;desc="optimized-sources"'
};

const RESI_HOME_HTML_CACHE_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  edgeTtlSeconds: 300,
  cacheVersion: "2026-07-07-hero-eager-v1",
  bypassCookieIncludes: [
    "wordpress_logged_in_",
    "wordpress_sec_",
    "wp-postpass_",
    "comment_author_",
    "woocommerce_",
    "wp-settings-"
  ],
  bypassQueryParamNames: [
    "preview",
    "preview_id",
    "preview_nonce",
    "p",
    "page_id",
    "s",
    "rest_route",
    "customize_changeset_uuid",
    "customize_theme",
    "customize_messenger_channel",
    "static_hero_poc",
    "edge_message_force",
    "edge_message_reset",
    "edge_shell_rest"
  ],
  responseHeader: "x-vtr-edge-html-cache",
  serverTimingHit: 'vtr_edge_html_cache;desc="hit"',
  serverTimingMiss: 'vtr_edge_html_cache;desc="miss"'
};

const RESI_HERO_VIEWPORT_HEIGHT_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  mobileOnly: true,
  targetClassIncludes: "uk-panel",
  targetAttribute: "uk-height-viewport",
  targetAttributeIncludes: "offset-top: true",
  className: "vtr-hero-viewport-height-removed",
  mobileMinHeightPx: 550,
  markerAttribute: "data-vtr-hero-viewport-height",
  serverTiming: 'vtr_edge_hero_viewport_height;desc="removed"'
};

const RESI_FONT_DISPLAY_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathIncludes: ["/wp-content/themes/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  display: "swap",
  serverTiming: 'vtr_edge_font_display;desc="swap"'
};

const RESI_HOMEPAGE_ASSET_TRIM_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  duplicateStylesheetHrefIncludes: [
    "/wp-content/themes/resi-child-theme/css/custom.css?ver=5.0.18"
  ],
  removeScriptSrcIncludes: ["/wp-content/plugins/resi-elements-v2/src/filters.js"],
  deferScriptSrcIncludes: ["/wp-content/themes/resi-child-theme/js/custom.js"],
  deferIconsThemeScriptSrcIncludes: [
    "/wp-content/themes/yootheme/vendor/assets/uikit/dist/js/uikit-icons-fuse.min.js",
    "/wp-content/themes/yootheme/assets/site/js/theme.js"
  ],
  duplicateCssServerTiming: 'vtr_edge_dup_css;desc="removed"',
  filtersServerTiming: 'vtr_edge_home_filters;desc="removed"',
  customJsServerTiming: 'vtr_edge_home_custom_js;desc="defer"',
  iconsThemeServerTiming: 'vtr_edge_yootheme_icons_theme;desc="defer"'
};

const RESI_HOME_STATIC_HERO_CONFIG = {
  enabled: false,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  serverTiming: 'vtr_edge_home_static_hero;desc="compact"'
};

const RESI_HOME_NATIVE_PROMO_CONFIG = {
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  serverTiming: 'vtr_edge_home_native_promo;desc="details"'
};

const RESI_STATIC_HERO_POC_CONFIG = {
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  queryParam: "static_hero_poc",
  heroId: "page#0",
  serverTiming: 'vtr_edge_static_hero_poc;desc="query-gated"'
};

const RESI_PSI_MOCK_CONFIG = {
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/"],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  queryParam: "psi_mock",
  allVariant: "all",
  variants: {
    noDropbar: "no_dropbar",
    noStickyHeader: "no_sticky_header",
    fixedHeroHeight: "fixed_hero_height",
    noWelcomeScrollspy: "no_welcome_scrollspy",
    staticReview: "static_review",
    deferYootheme: "defer_yootheme",
    deferTheme: "defer_theme",
    deferIconsTheme: "defer_icons_theme",
    criticalHeroCss: "critical_hero_css",
    deferNoncriticalCss: "defer_noncritical_css",
    shadowStaticHero: "shadow_static_hero",
    criticalJsBootstrap: "critical_js_bootstrap",
    edgeStaticShell: "edge_static_shell"
  },
  deferNoncriticalCssHrefIncludes: [
    "/wp-content/themes/resi-child-theme/css/theme.1.css",
    "/wp-content/themes/resi-child-theme/css/custom.css",
    "/wp-content/plugins/resi-elements-venterra/assets/css/custom.css",
    "/wp-content/plugins/resi-elements-v2/assets/utility.css"
  ],
  deferYoothemeScriptSrcIncludes: [
    "/wp-content/themes/yootheme/vendor/assets/uikit/dist/js/uikit.min.js",
    "/wp-content/themes/yootheme/vendor/assets/uikit/dist/js/uikit-icons-fuse.min.js",
    "/wp-content/themes/yootheme/assets/site/js/theme.js"
  ],
  deferThemeScriptSrcIncludes: [
    "/wp-content/themes/yootheme/assets/site/js/theme.js"
  ],
  deferIconsThemeScriptSrcIncludes: [
    "/wp-content/themes/yootheme/vendor/assets/uikit/dist/js/uikit-icons-fuse.min.js",
    "/wp-content/themes/yootheme/assets/site/js/theme.js"
  ],
  serverTimingPrefix: "vtr_edge_psi_mock"
};

const EDGE_FONT_ASSET_CONFIG = {
  hostnames: ["pilot.venterradev.com"],
  routePrefix: "/vtr-edge-fonts/",
  assets: {
    "brittany.woff2": {
      originUrl: "https://pilot.venterradev.com/wp-content/themes/resi-child-theme/fonts/BrittanySignature.woff2",
      contentType: "font/woff2"
    }
  },
  cacheControl: "public, max-age=31536000, immutable",
  serverTimingHit: 'vtr_edge_font_asset;desc="hit"',
  serverTimingMiss: 'vtr_edge_font_asset;desc="miss"'
};

const EDGE_RUNTIME_PAUSE_CONFIG = {
  messageInjectionEnabled: true,
  coachMarkInjectionEnabled: true,
  messageMobileAfterLoadDelayMs: 0,
  messageMobileAfterLoadIdleTimeoutMs: 2500,
  messageMobileAfterLoadServerTiming: 'vtr_edge_message_mobile_delay;desc="after-load"',
  messageMobileScrollTriggerEnabled: false,
  messageMobileScrollTriggerPx: 360,
  messageMobileScrollTriggerDelayMs: 350,
  messageMobileScrollTriggerServerTiming: 'vtr_edge_message_mobile_scroll;desc="scroll-gated"'
};

const VINE_LLMS_TXT_VERSION = "2026-08-06.the-vine-linked-llms-v1";
const VINE_MOBILE_TOPPER_VERSION = "2026-08-07.the-vine-mobile-topper-v4-brand-theme";
const VINE_NATIVE_CONTINUATION_PARAM = "edge_vine_native_continuation";
const VINE_ASSET_BASE = "/assets/resi-edge-assets/thevinekyle/home/";
const VINE_NATIVE_ANALYTICS_STRIP_SERVER_TIMING = 'vtr_vine_native_analytics_strip;desc="zaraz-owned"';

const VINE_PROPERTY = {
  name: "The Vine Kyle Parkway",
  shortName: "The Vine",
  phone: "(737) 357-8867",
  phoneHref: "tel:+17373578867",
  cityState: "Kyle, TX",
  street: "1201 Seton Parkway",
  description:
    "Contemporary comfort meets everyday convenience in Kyle with 1 and 2 Bedroom apartment homes near dining, shopping, entertainment, and major Austin-area destinations.",
  promoText: "Up To 8 Weeks Free – Pre-Lease Today!",
  heroTitle: "Live Better. Live Easy.",
  heroSubtitle: "1 and 2 Bedroom Apartments in Kyle, TX",
  apartmentsHref: "/apartments/",
  tourHref: "https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/TX4EK",
  applyHref: "https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/TX4EK",
  brandTheme: {
    promoBg: "#4E343F",
    promoText: "#FFFFFF",
    promoSurface: "#F1EFEB",
    promoPanelText: "#35343A",
    promoButtonBg: "#792640",
    drawerBg: "#4E343F",
    drawerText: "#FFFFFF",
    heroBg: "#4E343F",
    heroOverlay: "rgba(78,52,63,.38)"
  }
};

const VINE_TOPPER_ASSETS = {
  [`${VINE_ASSET_BASE}hero-mobile-900.webp`]: {
    body: vineHeroMobileWebp,
    type: "image/webp"
  },
  [`${VINE_ASSET_BASE}hero-mobile-900.jpg`]: {
    body: vineHeroMobileJpg,
    type: "image/jpeg"
  }
};

function isTheVineLlmsTxt(request) {
  const url = new URL(request.url);
  return (
    ["GET", "HEAD"].includes(request.method) &&
    url.pathname === "/llms.txt" &&
    ["thevinekyle.com", "www.thevinekyle.com"].includes(url.hostname)
  );
}

function renderTheVineLlmsTxt() {
  return `# The Vine Kyle Parkway

> Apartments in Kyle, TX
> Last updated: 08/06/2026

Important notes:
- Pricing, availability, specials, fees, lease terms, and policies may change. Verify current details on the Apartments page or by contacting the leasing office.
- This file highlights official property resources from The Vine Kyle Parkway and does not replace the full XML sitemap.

## Core Property Information

- [Homepage](https://thevinekyle.com/): Official overview of The Vine Kyle Parkway.
- [Apartments](https://thevinekyle.com/apartments/): Floor plans, pricing, availability, bedroom and bathroom options, and current leasing details.
- [Features](https://thevinekyle.com/features/): Apartment features, interior finishes, home conveniences, and in-home details.
- [Amenities](https://thevinekyle.com/amenities/): Community amenities, shared spaces, resident services, and lifestyle details.
- [Gallery](https://thevinekyle.com/gallery/): Official property photos, apartment images, amenity photos, and visual context.
- [Neighborhood](https://thevinekyle.com/neighborhood/): Nearby shopping, dining, employers, schools, transportation, and local area context.

## Leasing And Contact

- [Specials](https://thevinekyle.com/specials/): Current leasing specials, promotions, and offer details when available.
- [Contact](https://thevinekyle.com/contact/): Leasing office contact information, tour requests, phone number, address, and inquiry form.

## Search

- [Search this site](https://thevinekyle.com/?s=): WordPress search results for official The Vine Kyle Parkway website content.

## Optional

- [XML Sitemap](https://thevinekyle.com/sitemaps.xml): Complete list of indexable URLs for this property website.
`;
}

function serveTheVineLlmsTxt(request) {
  return new Response(request.method === "HEAD" ? null : renderTheVineLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-VTR-The-Vine-llms": VINE_LLMS_TXT_VERSION
    }
  });
}

function isTheVineHost(url) {
  return ["thevinekyle.com", "www.thevinekyle.com"].includes(url.hostname);
}

function isTheVineHomepage(url) {
  return isTheVineHost(url) && (url.pathname === "/" || url.pathname === "");
}

function isTheVineNativeContinuation(url) {
  return isTheVineHomepage(url) && url.searchParams.get(VINE_NATIVE_CONTINUATION_PARAM) === "1";
}

function shouldServeTheVineMobileTopper(request, url) {
  return isTheVineHomepage(url) && isMobileRequest(request);
}

function clientAcceptsWebp(request) {
  return (request.headers.get("accept") || "").includes("image/webp");
}

function selectedVineHero(request) {
  const webp = clientAcceptsWebp(request);
  return {
    href: `${VINE_ASSET_BASE}hero-mobile-900.${webp ? "webp" : "jpg"}`,
    type: webp ? "image/webp" : "image/jpeg"
  };
}

function serveTheVineTopperAsset(request, asset) {
  return new Response(request.method === "HEAD" ? null : asset.body, {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-VTR-The-Vine-Mobile-Topper": VINE_MOBILE_TOPPER_VERSION
    }
  });
}

function vineEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVinePhoneIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg>`;
}

function vineCssColor(value, fallback) {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(normalized)) return normalized;
  return fallback;
}

function renderVineBrandThemeCssVars(theme = {}) {
  return [
    `--promo-bg:${vineCssColor(theme.promoBg, "#15284B")}`,
    `--promo-text:${vineCssColor(theme.promoText, "#FFFFFF")}`,
    `--promo-surface:${vineCssColor(theme.promoSurface, "#F6F6F5")}`,
    `--promo-panel-text:${vineCssColor(theme.promoPanelText, "#343838")}`,
    `--promo-button-bg:${vineCssColor(theme.promoButtonBg, "#3D66B9")}`,
    `--drawer-bg:${vineCssColor(theme.drawerBg, "#15284B")}`,
    `--drawer-text:${vineCssColor(theme.drawerText, "#FFFFFF")}`,
    `--hero-bg:${vineCssColor(theme.heroBg, "#15284B")}`,
    `--hero-overlay:${vineCssColor(theme.heroOverlay, "rgba(21,40,75,.38)")}`
  ].join(";");
}

function renderVineTopperAnalytics() {
  return `<script>(function(w,d){w.dataLayer=w.dataLayer||[];function emit(name,data){var payload=Object.assign({event:name,vtr_surface:"mobile_topper",vtr_site:"thevinekyle.com",property_code:"TX4EK"},data||{});w.dataLayer.push(payload);if(w.zaraz&&typeof w.zaraz.track==="function"){try{w.zaraz.track(name,payload)}catch(e){}}}w.vtrVineTopperTrack=emit;emit("edge_mobile_topper_view");d.addEventListener("click",function(e){var el=e.target&&e.target.closest?e.target.closest("a[href],button"):null;if(!el)return;var label=(el.textContent||"").replace(/\\s+/g," ").trim();var href=el.getAttribute("href")||"";if(href.indexOf("/apartments")!==-1||label.indexOf("Find Your Home")!==-1)emit("find_your_home_click",{cta_label:label,cta_href:href});else if(href.indexOf("scheduleTour")!==-1||label.indexOf("Tour")!==-1)emit("schedule_tour_click",{cta_label:label,cta_href:href});else if(href.indexOf("createPipelineApplication")!==-1||label.indexOf("Apply")!==-1)emit("apply_now_click",{cta_label:label,cta_href:href});else if(href.indexOf("tel:")===0)emit("phone_click",{cta_label:label,cta_href:href});},{passive:true});})(window,document);</script>`;
}

function renderVineTopperBehavior() {
  return `<script>(function(w,d){var drawer=d.querySelector("[data-vine-drawer]");var scrim=d.querySelector("[data-vine-drawer-scrim]");var open=d.querySelector("[data-vine-drawer-open]");var close=d.querySelector("[data-vine-drawer-close]");var promo=d.querySelector("[data-vine-promo-toggle]");var promoDrop=d.querySelector("[data-vine-promo-drop]");var promoClose=d.querySelector("[data-vine-promo-close]");function track(name,data){if(w.vtrVineTopperTrack)w.vtrVineTopperTrack(name,data||{});}function setDrawer(value){if(!drawer)return;drawer.dataset.open=value?"true":"false";drawer.setAttribute("aria-hidden",value?"false":"true");if(value){drawer.removeAttribute("inert");}else{drawer.setAttribute("inert","");}if(scrim)scrim.hidden=!value;d.documentElement.classList.toggle("vine-drawer-open",value);track(value?"mobile_menu_open":"mobile_menu_close");}function setPromo(value){if(!promoDrop||!promo)return;promoDrop.hidden=!value;promo.setAttribute("aria-expanded",value?"true":"false");track(value?"promo_open":"promo_close");}if(open)open.addEventListener("click",function(){setDrawer(true);});if(close)close.addEventListener("click",function(){setDrawer(false);});if(scrim)scrim.addEventListener("click",function(){setDrawer(false);});if(promo)promo.addEventListener("click",function(){setPromo(promoDrop.hidden);});if(promoClose)promoClose.addEventListener("click",function(){setPromo(false);});d.addEventListener("keydown",function(e){if(e.key==="Escape"){setDrawer(false);setPromo(false);}});})(window,document);</script>`;
}

function vineNativeContinuationHref(request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set(VINE_NATIVE_CONTINUATION_PARAM, "1");
  url.searchParams.set("vtr_cv", VINE_MOBILE_TOPPER_VERSION);
  return `${url.pathname}${url.search}`;
}

function renderVineNativeContinuationShell(request) {
  const src = vineNativeContinuationHref(request);
  return `<section class="native-continuation" data-vine-native-continuation data-vine-native-continuation-state="idle" aria-label="Native site continuation"><div class="native-continuation-status" aria-live="polite"></div><iframe class="native-continuation-frame" title="${vineEscapeHtml(VINE_PROPERTY.name)} native site continuation" loading="lazy" data-src="${src}" hidden></iframe></section>`;
}

function renderVineNativeContinuationLoader() {
  return `<script data-vtr-vine-native-continuation-loader="1">(function(w,d){var section=d.querySelector("[data-vine-native-continuation]");if(!section)return;var frame=section.querySelector(".native-continuation-frame");var status=section.querySelector(".native-continuation-status");var loaded=false;function track(name,data){if(w.vtrVineTopperTrack)w.vtrVineTopperTrack(name,data||{});}function setState(state,message){section.setAttribute("data-vine-native-continuation-state",state);if(status)status.textContent=message||"";}function load(reason){if(loaded||!frame)return;loaded=true;setState("loading","Loading the native site.");frame.hidden=false;frame.src=frame.getAttribute("data-src");frame.addEventListener("load",function(){setState("loaded","");},{once:true});track("native_continuation_load",{reason:reason||"unknown"});}w.addEventListener("message",function(event){if(event.origin!==w.location.origin)return;var data=event.data||{};if(data.type!=="vtr-vine-native-continuation-height"||!frame)return;var reported=Number(data.height)||0;if(reported<=0)return;frame.style.height=Math.max(640,Math.min(14000,Math.ceil(reported)))+"px";});if("IntersectionObserver"in w){var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){observer.disconnect();load("scroll");}});},{rootMargin:"0px 0px",threshold:0.01});observer.observe(section);}else{w.addEventListener("load",function(){setTimeout(function(){load("fallback");},1500);},{once:true});}})(window,document);</script>`;
}

function renderTheVineMobileTopper(request) {
  const hero = selectedVineHero(request);
  const brandThemeVars = renderVineBrandThemeCssVars(VINE_PROPERTY.brandTheme);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: VINE_PROPERTY.name,
    url: "https://thevinekyle.com/",
    address: {
      "@type": "PostalAddress",
      streetAddress: VINE_PROPERTY.street,
      addressLocality: "Kyle",
      addressRegion: "TX",
      postalCode: "78640",
      addressCountry: "US"
    },
    telephone: "+17373578867",
    image: `https://thevinekyle.com${hero.href}`
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>${vineEscapeHtml(VINE_PROPERTY.name)} Apartments in ${vineEscapeHtml(VINE_PROPERTY.cityState)}</title>
<meta name="description" content="${vineEscapeHtml(VINE_PROPERTY.description)}">
<link rel="canonical" href="https://thevinekyle.com/">
<link rel="icon" href="/wp-content/uploads/2026/01/favicon.png" sizes="any">
<link rel="icon" href="/wp-content/uploads/2026/01/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/wp-content/uploads/2026/01/apple-touch-icon.png">
<link rel="preload" as="image" href="${hero.href}" type="${hero.type}" fetchpriority="high">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
@font-face{font-family:Montserrat;src:url("https://thevinekyle.com/wp-content/themes/resi-child-theme/fonts/montserrat-ab105b20.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:Montserrat;src:url("https://thevinekyle.com/wp-content/themes/resi-child-theme/fonts/montserrat-a77dae9d.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:Montserrat;src:url("https://thevinekyle.com/wp-content/themes/resi-child-theme/fonts/montserrat-67e78cf5.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:ms_madiregular;src:url("https://thevinekyle.com/wp-content/themes/resi-child-theme/fonts/msmadi-regular-webfont.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
:root{--navy:#15284B;--bay:#294782;--button:#3D66B9;--mint:#7DCAC2;--smoke:#F6F6F5;--quill:#D6D6D2;--text:#343838;--white:#FFFFFF;--shadow:rgba(21,40,75,.22);${brandThemeVars}}
*{box-sizing:border-box}html{font-size:18px;background:#fff;color:var(--text)}body{margin:0;background:#fff;color:var(--text);font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:400;line-height:1.625;text-rendering:optimizeLegibility}a{color:inherit;text-decoration:none}button{font:inherit}img{display:block;max-width:100%;height:auto}.vine-drawer-open{overflow:hidden}
.promo-wrap{position:relative;z-index:1100}.promo{width:100%;height:60px;border:0;border-radius:0;background:var(--promo-bg);color:var(--promo-text);display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:16px;font-weight:700;line-height:60px;letter-spacing:0;text-align:center}.promo svg{width:18px;height:18px;margin-left:10px;stroke:currentColor;stroke-width:2;fill:none;transition:transform .15s ease}.promo[aria-expanded="true"] svg{transform:rotate(180deg)}.promo-drop{position:absolute;top:60px;left:0;width:100%;z-index:1020;background:var(--promo-surface);color:var(--promo-panel-text);padding:20px 20px 22px;text-align:center;box-shadow:0 18px 35px rgba(0,0,0,.15)}.promo-drop[hidden]{display:none}.promo-close{position:absolute;right:15px;top:10px;width:24px;height:24px;border:0;background:transparent;color:var(--promo-panel-text);font-size:28px;line-height:24px;padding:0}.promo-drop h3{margin:0 28px 16px;color:var(--promo-panel-text);font-size:19px;font-weight:600;line-height:26px;letter-spacing:.5px}.promo-drop p{margin:0 auto 28px;max-width:330px;color:var(--promo-panel-text);font-size:16px;line-height:26px}.promo-actions{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}.promo-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:180px;padding:0 20px;border:2px solid var(--promo-button-bg);border-radius:50px;background:var(--promo-button-bg);color:#fff;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.2px}.promo-actions a.secondary{min-width:0;min-height:0;height:28px;border:0;background:transparent;color:var(--promo-panel-text);padding:0;font-size:14px;line-height:28px;letter-spacing:1.2px}
.bar{height:80px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 15px;color:var(--text);position:relative;z-index:990}.brand{height:80px;display:flex;align-items:center;font-size:10px;font-weight:600;line-height:16px;letter-spacing:2px;text-transform:uppercase;white-space:nowrap}.actions{height:80px;display:flex;align-items:center;gap:20px}.phone{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:var(--text)}.phone svg{display:block;width:20px;height:20px;fill:currentColor}.tour{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border:2px solid var(--text);border-radius:50px;color:var(--text);background:#fff;font-size:11.5px;font-weight:900;line-height:40px;letter-spacing:1.5px}.hamb{position:relative;width:20px;height:80px;border:0;background:transparent;color:var(--text);padding:0;cursor:pointer}.hamb:before,.hamb:after,.hamb span{content:"";position:absolute;left:0;right:0;height:2px;background:currentColor}.hamb:before{top:31px}.hamb span{top:39px}.hamb:after{top:47px}
.hero{height:704px;min-height:704px;position:relative;overflow:hidden;background:var(--hero-bg);display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 15px}.hero-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0}.hero::after{content:"";position:absolute;inset:0;background:var(--hero-overlay);z-index:1}.hero-inner{width:360px;max-width:100%;position:relative;z-index:2;margin-top:4px}.hero h1{font-family:ms_madiregular,cursive;font-size:62px;line-height:58px;margin:0 auto 10px;font-weight:400;letter-spacing:0;color:#fff}.hero p{font-size:19px;line-height:27px;margin:0 auto 32px;font-weight:600;max-width:360px;color:#fff}.cta{display:inline-flex;align-items:center;justify-content:center;min-width:197px;min-height:50px;border:2px solid #fff;border-radius:50px;padding:0 30px;background:#fff;color:var(--text);font-size:14px;font-weight:600;line-height:46px;letter-spacing:1.5px}.cta span{font-size:18px;margin-left:10px}
.native-continuation{min-height:640px;background:#fff;color:var(--text)}.native-continuation-status{min-height:28px;padding:14px 15px;text-align:center;font-size:11px;font-weight:700;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:var(--text)}.native-continuation-frame{display:block;width:100%;min-height:640px;border:0;background:#fff}.native-continuation-frame[hidden]{display:none}.native-continuation[data-vine-native-continuation-state="idle"] .native-continuation-status{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.native-continuation[data-vine-native-continuation-state="loaded"]{min-height:0}.native-continuation[data-vine-native-continuation-state="loaded"] .native-continuation-status{display:none}
.drawer-scrim{position:fixed;inset:0;z-index:1190;background:rgba(0,0,0,.45)}.drawer-scrim[hidden]{display:none}.drawer{position:fixed;top:0;right:0;bottom:0;z-index:1200;width:270px;height:100svh;min-height:100vh;padding:50px 25px 34px;background:var(--drawer-bg);color:var(--drawer-text);box-shadow:-20px 0 60px var(--shadow);transform:translateX(105%);transition:transform .18s ease;overflow:auto}.drawer[data-open="true"]{transform:translateX(0)}.drawer-close{position:absolute;top:5px;right:5px;width:37px;height:37px;border:0;background:transparent;color:var(--drawer-text);font-size:34px;font-weight:300;line-height:37px;padding:0;cursor:pointer}.drawer-logo{display:block;margin:0 0 20px;color:var(--drawer-text);font-size:18px;line-height:26px;letter-spacing:2px;text-transform:uppercase}.drawer nav{display:grid;gap:0;margin:0}.drawer nav a{display:block;padding:8px 0;color:var(--drawer-text);font-size:15px;font-weight:700;line-height:24px;letter-spacing:.75px}.drawer-actions{display:flex;align-items:center;gap:10px;margin:20px 0 17px}.drawer-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border:2px solid rgba(255,255,255,.72);border-radius:50px;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;white-space:nowrap;color:var(--drawer-text)}.drawer-actions a:first-child{background:#fff;color:var(--drawer-bg);border-color:#fff}.drawer-phone{display:block;color:var(--drawer-text);font-size:14px;font-weight:900;line-height:28px;letter-spacing:1.5px}
</style>
</head>
<body>
<div class="promo-wrap"><button class="promo" data-vine-promo-toggle aria-expanded="false">${vineEscapeHtml(VINE_PROPERTY.promoText)} <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5"/></svg></button><div class="promo-drop" data-vine-promo-drop hidden><button class="promo-close" data-vine-promo-close aria-label="Close special">&times;</button><h3>${vineEscapeHtml(VINE_PROPERTY.promoText)}</h3><p>Join the VIP list for insider updates, leasing specials, and early access opportunities.</p><div class="promo-actions"><a href="${VINE_PROPERTY.apartmentsHref}">See Availability</a><a class="secondary" href="/contact/#contact">Join VIP List</a></div></div></div>
<header class="bar"><a class="brand" href="/">${vineEscapeHtml(VINE_PROPERTY.name)}</a><div class="actions"><a class="phone" href="${VINE_PROPERTY.phoneHref}" aria-label="Call ${vineEscapeHtml(VINE_PROPERTY.name)}">${renderVinePhoneIcon()}</a><a class="tour" href="${VINE_PROPERTY.tourHref}">Tour</a><button class="hamb" data-vine-drawer-open aria-label="Menu" aria-controls="vine-mobile-drawer"><span></span></button></div></header>
<div class="drawer-scrim" data-vine-drawer-scrim hidden></div>
<aside class="drawer" id="vine-mobile-drawer" data-vine-drawer data-open="false" aria-hidden="true" inert><button class="drawer-close" data-vine-drawer-close aria-label="Close menu">&times;</button><a class="drawer-logo" href="/" aria-label="${vineEscapeHtml(VINE_PROPERTY.name)} home">The Vine<br>Kyle Parkway</a><nav aria-label="Mobile menu"><a href="${VINE_PROPERTY.apartmentsHref}">Apartments &amp; Pricing</a><a href="/features/">Features</a><a href="/amenities/">Amenities</a><a href="/gallery/">Gallery</a><a href="/neighborhood/">Neighborhood</a><a href="/faqs/">FAQs</a><a href="/contact/">Contact</a><a href="/specials/">Specials</a></nav><div class="drawer-actions"><a href="${VINE_PROPERTY.tourHref}">Tour</a><a href="${VINE_PROPERTY.applyHref}">Apply</a></div><a class="drawer-phone" href="${VINE_PROPERTY.phoneHref}">${vineEscapeHtml(VINE_PROPERTY.phone)}</a></aside>
<main><section class="hero"><img class="hero-media" src="${hero.href}" width="900" height="540" alt="" fetchpriority="high" decoding="sync"><div class="hero-inner"><h1>${vineEscapeHtml(VINE_PROPERTY.heroTitle)}</h1><p>${vineEscapeHtml(VINE_PROPERTY.heroSubtitle)}</p><a class="cta" href="${VINE_PROPERTY.apartmentsHref}">Find Your Home <span>&rarr;</span></a></div></section>${renderVineNativeContinuationShell(request)}</main>
${renderVineTopperAnalytics()}
${renderVineTopperBehavior()}
${renderZarazConsentPillScript()}
${renderVineNativeContinuationLoader()}
</body>
</html>`;
}

function buildTheVineNativeHomepageRequest(request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  const headers = new Headers();
  const source = request.headers;
  headers.set("accept", source.get("accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  const language = source.get("accept-language");
  const userAgent = source.get("user-agent");
  if (language) headers.set("accept-language", language);
  if (userAgent) headers.set("user-agent", userAgent);
  return new Request(url.toString(), { method: "GET", headers, redirect: "follow" });
}

function normalizeTheVineNativeHtml(html) {
  return html
    .replace(/\s*<script>\s*window\.HEAP_JS_DEBUG\s*=\s*true;\s*<\/script>\s*/gi, "\n")
    .replace(/\s*<script[^>]*id=["']resi-pixel-js-before["'][^>]*>[\s\S]*?<\/script>\s*/gi, "\n")
    .replace(/\s*<script[^>]+js\.getresi\.co\/pixel\/[^"'\s<>]+\/resi-pixel\.iife\.js[^>]*><\/script>\s*/gi, "\n")
    .replace(/tel:\(?512\)?[\s.-]*800[\s.-]*7701/gi, VINE_PROPERTY.phoneHref)
    .replace(/\(?512\)?[\s.-]*800[\s.-]*7701/g, VINE_PROPERTY.phone)
    .replace(/data-property-name="[^"]*"/i, 'data-property-name="The Vine Kyle Parkway"')
    .replace(/data-property-code="[^"]*"/i, 'data-property-code="TX4EK"');
}

function shouldApplyTheVineNativeAnalyticsStrip(request, response) {
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!isTheVineHost(url)) return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addTheVineNativeAnalyticsStripRewriter(rewriter) {
  return rewriter.on("script", new TheVineNativeAnalyticsStripScriptHandler());
}

class TheVineNativeAnalyticsStripScriptHandler {
  element(element) {
    const id = element.getAttribute("id") || "";
    const src = element.getAttribute("src") || "";
    if (id === "resi-pixel-js-before") {
      element.remove();
      return;
    }
    if (id === "resi-pixel-js" && /https:\/\/js\.getresi\.co\/pixel\/[^"'\s<>]+\/resi-pixel\.iife\.js/i.test(src)) {
      element.remove();
      return;
    }
    if (src && /https:\/\/js\.getresi\.co\/pixel\/[^"'\s<>]+\/resi-pixel\.iife\.js/i.test(src)) {
      element.remove();
      return;
    }
  }

  text(text) {
    if (/window\.HEAP_JS_DEBUG\s*=\s*true/.test(text.text)) {
      text.replace("");
    }
  }
}

function theVineNativeContinuationHiddenCss() {
  return `body.vtr-vine-native-continuation .tm-header,
body.vtr-vine-native-continuation .tm-header-mobile,
body.vtr-vine-native-continuation [data-page-section="promo_bar"],
body.vtr-vine-native-continuation [data-component-name="open_promo_bar"],
body.vtr-vine-native-continuation [data-page-section="hero"]{display:none!important}`;
}

class TheVineNativeContinuationHeadRewriter {
  element(element) {
    element.prepend(`<base href="https://thevinekyle.com/">`, { html: true });
    element.append(`<style data-vtr-vine-native-continuation="1">
${theVineNativeContinuationHiddenCss()}
html{margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important}
body{margin:0!important;padding:0!important;background:#fff!important}
.vtr-vine-native-continuation-frame-marker{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
</style>`, { html: true });
  }
}

class TheVineNativeContinuationBodyRewriter {
  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-vine-native-continuation"));
    element.prepend(`<div class="vtr-vine-native-continuation-frame-marker" data-vtr-vine-native-continuation-frame="1">Native continuation loaded</div>`, { html: true });
    element.append(`<script data-vtr-vine-native-continuation-resize="1">(function(){function postHeight(){var body=document.body,doc=document.documentElement;var height=Math.max(body?body.scrollHeight:0,body?body.offsetHeight:0,doc?doc.scrollHeight:0,doc?doc.offsetHeight:0);try{parent.postMessage({type:"vtr-vine-native-continuation-height",height:height},location.origin)}catch(e){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",postHeight,{once:true});}else{postHeight();}addEventListener("load",postHeight,{once:true});if("ResizeObserver"in window&&document.body){new ResizeObserver(postHeight).observe(document.body);}setTimeout(postHeight,250);setTimeout(postHeight,1000);setTimeout(postHeight,2500);setTimeout(postHeight,5000);})();</script>`, { html: true });
  }
}

async function renderTheVineNativeContinuationResponse(request) {
  const originRequest = buildTheVineNativeHomepageRequest(request);
  const originResponse = await fetch(originRequest, { cf: { cacheEverything: false, cacheTtl: 0 } });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) {
    return originResponse;
  }

  let html = await originResponse.text();
  html = normalizeTheVineNativeHtml(html);

  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-VTR-The-Vine-Mobile-Topper", VINE_MOBILE_TOPPER_VERSION);
  headers.set("X-VTR-The-Vine-Mobile-Continuation", "1");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.append("Server-Timing", 'vtr_vine_native_continuation;desc="lazy"');

  return new HTMLRewriter()
    .on("head", new TheVineNativeContinuationHeadRewriter())
    .on("body", new TheVineNativeContinuationBodyRewriter())
    .transform(new Response(html, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers
    }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const vineAsset = VINE_TOPPER_ASSETS[url.pathname];
    if (vineAsset) return serveTheVineTopperAsset(request, vineAsset);

    if (isTheVineLlmsTxt(request)) {
      return serveTheVineLlmsTxt(request);
    }

    if (isTheVineNativeContinuation(url)) {
      return renderTheVineNativeContinuationResponse(request);
    }

    if (shouldServeTheVineMobileTopper(request, url)) {
      const headers = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-VTR-The-Vine-Mobile-Topper": VINE_MOBILE_TOPPER_VERSION
      });
      headers.set("Vary", "User-Agent");
      headers.append("Server-Timing", 'vtr_vine_mobile_topper;desc="production"');
      return new Response(renderTheVineMobileTopper(request), { headers });
    }

    const fontResponse = await maybeHandleEdgeFontAsset(request, ctx);
    if (fontResponse) return fontResponse;

    const runtimePauseConfig = {
      messageInjectionEnabled: runtimeFlag(
        env,
        "EDGE_MESSAGE_INJECTION_ENABLED",
        EDGE_RUNTIME_PAUSE_CONFIG.messageInjectionEnabled
      ),
      coachMarkInjectionEnabled: runtimeFlag(
        env,
        "EDGE_COACH_MARK_INJECTION_ENABLED",
        EDGE_RUNTIME_PAUSE_CONFIG.coachMarkInjectionEnabled
      ),
      messageMobileAfterLoadDelayMs: runtimeInteger(
        env,
        "EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS",
        EDGE_RUNTIME_PAUSE_CONFIG.messageMobileAfterLoadDelayMs
      ),
      messageMobileAfterLoadIdleTimeoutMs: runtimeInteger(
        env,
        "EDGE_MESSAGE_MOBILE_AFTER_LOAD_IDLE_TIMEOUT_MS",
        EDGE_RUNTIME_PAUSE_CONFIG.messageMobileAfterLoadIdleTimeoutMs
      ),
      messageMobileScrollTriggerEnabled: runtimeFlag(
        env,
        "EDGE_MESSAGE_MOBILE_SCROLL_TRIGGER_ENABLED",
        EDGE_RUNTIME_PAUSE_CONFIG.messageMobileScrollTriggerEnabled
      ),
      messageMobileScrollTriggerPx: runtimeInteger(
        env,
        "EDGE_MESSAGE_MOBILE_SCROLL_TRIGGER_PX",
        EDGE_RUNTIME_PAUSE_CONFIG.messageMobileScrollTriggerPx
      ),
      messageMobileScrollTriggerDelayMs: runtimeInteger(
        env,
        "EDGE_MESSAGE_MOBILE_SCROLL_TRIGGER_DELAY_MS",
        EDGE_RUNTIME_PAUSE_CONFIG.messageMobileScrollTriggerDelayMs
      )
    };
    const messageFallbackConfig = selectEdgeFallbackConfig(request, EDGE_MESSAGE_FALLBACK_CONFIGS);
    const coachMarkFallbackConfig = selectEdgeFallbackConfig(request, EDGE_COACH_MARK_FALLBACK_CONFIGS);
    const messageConfig = applyRuntimeMessageTiming(
      request,
      await getPublishedEdgeConfig(env, messageFallbackConfig),
      runtimePauseConfig
    );
    const coachMarkConfig = applyRuntimePause(
      await getPublishedEdgeConfig(env, coachMarkFallbackConfig),
      runtimePauseConfig.coachMarkInjectionEnabled
    );
    const heroMobileImageConfig = {
      ...RESI_HERO_MOBILE_IMAGE_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_HERO_MOBILE_IMAGE_ENABLED",
        RESI_HERO_MOBILE_IMAGE_CONFIG.enabled
      ),
      preloadEnabled: runtimeFlag(
        env,
        "EDGE_HERO_MOBILE_PRELOAD_ENABLED",
        RESI_HERO_MOBILE_IMAGE_CONFIG.preloadEnabled
      ),
      criticalCssEnabled: runtimeFlag(
        env,
        "EDGE_HERO_MOBILE_CRITICAL_CSS_ENABLED",
        RESI_HERO_MOBILE_IMAGE_CONFIG.criticalCssEnabled
      )
    };
    const mobileImageReplacementConfig = {
      ...RESI_MOBILE_IMAGE_REPLACEMENT_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_MOBILE_IMAGE_REPLACEMENTS_ENABLED",
        RESI_MOBILE_IMAGE_REPLACEMENT_CONFIG.enabled
      )
    };
    const homeHtmlCacheConfig = {
      ...RESI_HOME_HTML_CACHE_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_HOME_HTML_CACHE_ENABLED",
        RESI_HOME_HTML_CACHE_CONFIG.enabled
      ),
      cacheVersion: runtimeString(
        env,
        "EDGE_HOME_HTML_CACHE_VERSION",
        RESI_HOME_HTML_CACHE_CONFIG.cacheVersion
      )
    };
    const heroViewportHeightConfig = {
      ...RESI_HERO_VIEWPORT_HEIGHT_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_HERO_VIEWPORT_HEIGHT_REMOVAL_ENABLED",
        RESI_HERO_VIEWPORT_HEIGHT_CONFIG.enabled
      )
    };
    const fontDisplayConfig = {
      ...RESI_FONT_DISPLAY_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_FONT_DISPLAY_REWRITE_ENABLED",
        RESI_FONT_DISPLAY_CONFIG.enabled
      )
    };
    const homepageAssetTrimConfig = {
      ...RESI_HOMEPAGE_ASSET_TRIM_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_HOMEPAGE_ASSET_TRIM_ENABLED",
        RESI_HOMEPAGE_ASSET_TRIM_CONFIG.enabled
      ),
      duplicateStylesheetRemovalEnabled: runtimeFlag(
        env,
        "EDGE_HOMEPAGE_DUPLICATE_CSS_REMOVAL_ENABLED",
        true
      ),
      filtersRemovalEnabled: runtimeFlag(
        env,
        "EDGE_HOMEPAGE_FILTERS_REMOVAL_ENABLED",
        true
      ),
      customJsDeferEnabled: runtimeFlag(
        env,
        "EDGE_HOMEPAGE_CUSTOM_JS_DEFER_ENABLED",
        true
      ),
      iconsThemeDeferEnabled: runtimeFlag(
        env,
        "EDGE_HOMEPAGE_YOOTHEME_ICONS_THEME_DEFER_ENABLED",
        true
      )
    };
    const homeStaticHeroConfig = {
      ...RESI_HOME_STATIC_HERO_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_HOME_STATIC_HERO_ENABLED",
        RESI_HOME_STATIC_HERO_CONFIG.enabled
      )
    };
    const homeStaticShellEnabled = runtimeFlag(env, "EDGE_HOME_STATIC_SHELL_ENABLED", false);
    const jqueryMigrateConfig = {
      ...RESI_JQUERY_MIGRATE_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_HOMEPAGE_JQUERY_MIGRATE_REMOVAL_ENABLED",
        RESI_JQUERY_MIGRATE_CONFIG.enabled
      ),
      pathExact: ["/"],
      serverTiming: 'vtr_edge_home_jquery_migrate;desc="removed"'
    };
    const homeResiPixelIdleConfig = {
      ...RESI_HOME_RESI_PIXEL_IDLE_CONFIG,
      enabled: runtimeFlag(env, "EDGE_HOME_RESI_PIXEL_IDLE_ENABLED", false),
      delayMs: runtimeInteger(
        env,
        "EDGE_HOME_RESI_PIXEL_IDLE_DELAY_MS",
        RESI_HOME_RESI_PIXEL_IDLE_CONFIG.delayMs
      )
    };
    const consentNoticeConfig = {
      ...ZARAZ_CONSENT_NOTICE_CONFIG,
      enabled: runtimeFlag(
        env,
        "EDGE_ZARAZ_CONSENT_NOTICE_ENABLED",
        ZARAZ_CONSENT_NOTICE_CONFIG.enabled
      )
    };
    if (isZarazConsentUnresolvedReportRequest(request, consentNoticeConfig)) {
      return handleZarazConsentUnresolvedReport(request, env, consentNoticeConfig);
    }
    const forceRequested = url.searchParams.get(messageConfig.forceParam) === "1";
    const resetRequested = url.searchParams.get(messageConfig.resetParam) === "1";

    if (forceRequested || resetRequested) {
      const cleanUrl = new URL(url);
      cleanUrl.searchParams.delete(messageConfig.forceParam);
      cleanUrl.searchParams.delete(messageConfig.resetParam);
      const redirectHeaders = new Headers({
        Location: cleanUrl.toString(),
        "Cache-Control": "no-store"
      });
      if (forceRequested) {
        redirectHeaders.append(
          "Set-Cookie",
          `${messageConfig.forceCookieName}=${messageConfig.id}; Max-Age=60; Path=/; Secure; SameSite=Lax`
        );
      }
      if (resetRequested) {
        redirectHeaders.append(
          "Set-Cookie",
          `${messageConfig.resetCookieName}=${messageConfig.id}; Max-Age=60; Path=/; Secure; SameSite=Lax`
        );
        redirectHeaders.append(
          "Set-Cookie",
          `${messageConfig.cookieName}=; Max-Age=0; Path=/; Secure; SameSite=Lax`
        );
      }
      return new Response(null, { status: 302, headers: redirectHeaders });
    }

    const cookieHeader = request.headers.get("cookie") || "";
    const forceFromCookie = hasCookie(cookieHeader, messageConfig.forceCookieName, messageConfig.id);
    const resetFromCookie = hasCookie(cookieHeader, messageConfig.resetCookieName, messageConfig.id);
    const homeHtmlCacheContext = buildHomeHtmlCacheContext(request, homeHtmlCacheConfig, {
      forceFromCookie,
      resetFromCookie
    });

    if (homeHtmlCacheContext) {
      const cachedResponse = await caches.default.match(homeHtmlCacheContext.cacheKey);
      if (cachedResponse) {
        return markHomeHtmlCacheResponse(
          cachedResponse,
          homeHtmlCacheConfig,
          "HIT",
          homeHtmlCacheConfig.serverTimingHit
        );
      }
    }

    const originRequest = buildExperimentOriginRequest(request, [
      RESI_STATIC_HERO_POC_CONFIG,
      RESI_PSI_MOCK_CONFIG
    ]);
    const originResponse = await fetch(originRequest);
    const responseHeaders = new Headers(originResponse.headers);
    const shouldOptimizePerformance = shouldApplyPerformanceOptimization(
      request,
      originResponse,
      RESI_PERFORMANCE_CONFIG
    );
    const shouldRewritePerformanceHtml = shouldOptimizePerformance && shouldApplyPerformanceHtmlRewrite(
      request,
      RESI_PERFORMANCE_CONFIG
    );
    const shouldRewriteLegacyScripts = shouldApplyLegacyScriptRewrite(
      request,
      originResponse,
      RESI_LEGACY_SCRIPT_CONFIG
    );
    const shouldRewriteJqueryMigrate = shouldApplyLegacyScriptRewrite(
      request,
      originResponse,
      jqueryMigrateConfig
    );
    const shouldDelayResiPixel = shouldApplyIdleScriptRewrite(
      request,
      originResponse,
      homeResiPixelIdleConfig
    );
    const shouldRewriteSightMap = shouldApplySightMapRewrite(
      request,
      originResponse,
      RESI_SIGHTMAP_CONFIG
    );
    const shouldRewriteHeroMobile = shouldApplyHeroMobileRewrite(
      request,
      originResponse,
      heroMobileImageConfig
    );
    const shouldRewriteMobileImages = shouldApplyMobileImageReplacementRewrite(
      request,
      originResponse,
      mobileImageReplacementConfig
    );
    const shouldRewriteStaticHeroPoc = shouldApplyStaticHeroPocRewrite(
      request,
      originResponse,
      RESI_STATIC_HERO_POC_CONFIG
    );
    const psiMockState = buildPsiMockState(request, RESI_PSI_MOCK_CONFIG);
    if (shouldApplyHomeStaticShellRewrite(request, originResponse, homeStaticShellEnabled)) {
      psiMockState.enabled = true;
      psiMockState.edgeStaticShell = true;
      psiMockState.requested = [...psiMockState.requested, "production_static_shell"];
    }
    const shouldRewritePsiMock = shouldApplyPsiMockRewrite(
      request,
      originResponse,
      RESI_PSI_MOCK_CONFIG,
      psiMockState
    );
    const shouldRewriteHeroViewportHeight = shouldApplyHeroViewportHeightRewrite(
      request,
      originResponse,
      heroViewportHeightConfig
    );
    const shouldRewriteFontDisplay = shouldApplyFontDisplayRewrite(
      request,
      originResponse,
      fontDisplayConfig
    );
    const shouldTrimHomepageAssets = shouldApplyHomepageAssetTrim(
      request,
      originResponse,
      homepageAssetTrimConfig
    );
    const shouldRewriteHomeStaticHero = shouldApplyHomeStaticHeroRewrite(
      request,
      originResponse,
      homeStaticHeroConfig
    );
    const shouldInjectNativePromo = shouldApplyHomeNativePromoRewrite(
      request,
      originResponse,
      RESI_HOME_NATIVE_PROMO_CONFIG
    ) && !shouldApplyHomeStaticShellRewrite(request, originResponse, homeStaticShellEnabled);
    const shouldStripTheVineNativeAnalytics = shouldApplyTheVineNativeAnalyticsStrip(
      request,
      originResponse
    );

    if (shouldRewriteFontDisplay) {
      return rewriteFontDisplayResponse(originResponse, responseHeaders, fontDisplayConfig);
    }

    if (forceFromCookie) {
      responseHeaders.append(
        "Set-Cookie",
        `${messageConfig.forceCookieName}=; Max-Age=0; Path=/; Secure; SameSite=Lax`
      );
    }

    if (resetFromCookie) {
      responseHeaders.append(
        "Set-Cookie",
        `${messageConfig.resetCookieName}=; Max-Age=0; Path=/; Secure; SameSite=Lax`
      );
      responseHeaders.append(
        "Set-Cookie",
        `${messageConfig.cookieName}=; Max-Age=0; Path=/; Secure; SameSite=Lax`
      );
    }

    const state = { forceDisplay: forceFromCookie, resetStorage: resetFromCookie };
    const scripts = [];
    if (shouldInject(request, originResponse, state, messageConfig)) {
      scripts.push(buildBootstrapScript(messageConfig, state));
      if (messageConfig.mobileAfterLoadDelayMs > 0) {
        responseHeaders.append(
          "Server-Timing",
          EDGE_RUNTIME_PAUSE_CONFIG.messageMobileAfterLoadServerTiming
        );
      }
      if (messageConfig.mobileScrollTriggerEnabled) {
        responseHeaders.append(
          "Server-Timing",
          EDGE_RUNTIME_PAUSE_CONFIG.messageMobileScrollTriggerServerTiming
        );
      }
    }
    if (shouldInject(request, originResponse, {}, coachMarkConfig)) {
      scripts.push(buildCoachMarkScript(coachMarkConfig));
    }
    if (shouldInjectConsentNotice(request, originResponse, consentNoticeConfig)) {
      scripts.push(renderZarazConsentPillScript());
      scripts.push(buildZarazConsentInteractionQueueScript(consentNoticeConfig));
      responseHeaders.append("Server-Timing", 'vtr_zaraz_consent_notice;desc="passive"');
    }

    if (shouldOptimizePerformance) {
      applyPerformanceHeaders(request, responseHeaders, RESI_PERFORMANCE_CONFIG);
    }

    if (homeHtmlCacheContext) {
      responseHeaders.delete("set-cookie");
    }

    if (
      scripts.length === 0 &&
      !shouldRewritePerformanceHtml &&
      !shouldRewriteLegacyScripts &&
      !shouldRewriteJqueryMigrate &&
      !shouldDelayResiPixel &&
      !shouldRewriteSightMap &&
      !shouldRewriteHeroMobile &&
      !shouldRewriteMobileImages &&
      !shouldRewriteStaticHeroPoc &&
      !shouldRewritePsiMock &&
      !shouldRewriteHeroViewportHeight &&
      !shouldTrimHomepageAssets &&
      !shouldRewriteHomeStaticHero &&
      !shouldInjectNativePromo &&
      !shouldStripTheVineNativeAnalytics
    ) {
      const passthroughResponse = new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders
      });
      return maybeStoreHomeHtmlCache(
        passthroughResponse,
        homeHtmlCacheContext,
        homeHtmlCacheConfig,
        ctx
      );
    }

    responseHeaders.delete("content-length");

    let rewriter = new HTMLRewriter();

    if (shouldTrimHomepageAssets) {
      if (homepageAssetTrimConfig.duplicateStylesheetRemovalEnabled) {
        responseHeaders.append("Server-Timing", homepageAssetTrimConfig.duplicateCssServerTiming);
      }
      if (homepageAssetTrimConfig.filtersRemovalEnabled) {
        responseHeaders.append("Server-Timing", homepageAssetTrimConfig.filtersServerTiming);
      }
      if (homepageAssetTrimConfig.customJsDeferEnabled) {
        responseHeaders.append("Server-Timing", homepageAssetTrimConfig.customJsServerTiming);
      }
      if (homepageAssetTrimConfig.iconsThemeDeferEnabled) {
        responseHeaders.append("Server-Timing", homepageAssetTrimConfig.iconsThemeServerTiming);
      }
      rewriter = addHomepageAssetTrimRewriter(rewriter, homepageAssetTrimConfig);
    }

    if (shouldRewriteHomeStaticHero) {
      responseHeaders.append("Server-Timing", homeStaticHeroConfig.serverTiming);
      rewriter = addHomeStaticHeroRewriter(rewriter);
    }

    if (shouldInjectNativePromo) {
      responseHeaders.append("Server-Timing", RESI_HOME_NATIVE_PROMO_CONFIG.serverTiming);
      rewriter = addHomeNativePromoRewriter(rewriter);
    }

    if (shouldStripTheVineNativeAnalytics) {
      responseHeaders.append("Server-Timing", VINE_NATIVE_ANALYTICS_STRIP_SERVER_TIMING);
      rewriter = addTheVineNativeAnalyticsStripRewriter(rewriter);
    }

    if (shouldRewritePerformanceHtml) {
      responseHeaders.append("Server-Timing", RESI_PERFORMANCE_CONFIG.rewriteServerTiming);
      rewriter = addPerformanceRewriter(rewriter, request, RESI_PERFORMANCE_CONFIG);
    }

    if (shouldRewriteLegacyScripts) {
      responseHeaders.append("Server-Timing", RESI_LEGACY_SCRIPT_CONFIG.serverTiming);
      rewriter = addLegacyScriptRewriter(rewriter, RESI_LEGACY_SCRIPT_CONFIG);
    }

    if (shouldRewriteJqueryMigrate) {
      responseHeaders.append("Server-Timing", jqueryMigrateConfig.serverTiming);
      rewriter = addLegacyScriptRewriter(rewriter, jqueryMigrateConfig);
    }

    if (shouldDelayResiPixel) {
      responseHeaders.append("Server-Timing", homeResiPixelIdleConfig.serverTiming);
      rewriter = addIdleScriptRewriter(rewriter, homeResiPixelIdleConfig);
    }

    if (shouldRewriteSightMap) {
      responseHeaders.append("Server-Timing", RESI_SIGHTMAP_CONFIG.serverTiming);
      rewriter = addSightMapRewriter(rewriter, RESI_SIGHTMAP_CONFIG);
    }

    if (shouldRewriteHeroMobile) {
      responseHeaders.append("Server-Timing", heroMobileImageConfig.serverTiming);
      if (heroMobileImageConfig.preloadEnabled) {
        responseHeaders.append("Server-Timing", heroMobileImageConfig.preloadServerTiming);
        responseHeaders.append(
          "Link",
          `<${heroMobileImageConfig.mobileImageUrl}>; rel=preload; as=image; fetchpriority=high`
        );
      }
      if (heroMobileImageConfig.criticalCssEnabled) {
        responseHeaders.append("Server-Timing", heroMobileImageConfig.criticalCssServerTiming);
      }
      rewriter = addHeroMobileRewriter(rewriter, heroMobileImageConfig);
    }

    if (shouldRewriteMobileImages) {
      responseHeaders.append("Server-Timing", mobileImageReplacementConfig.serverTiming);
      rewriter = addMobileImageReplacementRewriter(rewriter, mobileImageReplacementConfig);
    }

    if (shouldRewriteStaticHeroPoc) {
      responseHeaders.append("Server-Timing", RESI_STATIC_HERO_POC_CONFIG.serverTiming);
      rewriter = addStaticHeroPocRewriter(rewriter, RESI_STATIC_HERO_POC_CONFIG);
    }

    if (shouldRewritePsiMock) {
      for (const timing of buildPsiMockServerTimings(psiMockState, RESI_PSI_MOCK_CONFIG)) {
        responseHeaders.append("Server-Timing", timing);
      }
      rewriter = addPsiMockRewriter(rewriter, RESI_PSI_MOCK_CONFIG, psiMockState);
    }

    if (shouldRewriteHeroViewportHeight) {
      responseHeaders.append("Server-Timing", heroViewportHeightConfig.serverTiming);
      rewriter = addHeroViewportHeightRewriter(rewriter, heroViewportHeightConfig);
    }

    if (scripts.length > 0) {
      rewriter = rewriter.on("body", {
        element(element) {
          element.append(scripts.join(""), { html: true });
        }
      });
    }

    const rewritten = rewriter.transform(originResponse);
    const finalResponse = new Response(rewritten.body, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers: responseHeaders
    });
    return maybeStoreHomeHtmlCache(finalResponse, homeHtmlCacheContext, homeHtmlCacheConfig, ctx);
  }
};

function applyRuntimePause(config, enabled) {
  return { ...config, enabled };
}

function applyRuntimeMessageTiming(request, config, runtimeConfig) {
  const timedConfig = applyRuntimePause(config, runtimeConfig.messageInjectionEnabled);
  if (!isMobileRequest(request)) return timedConfig;
  return {
    ...timedConfig,
    mobileAfterLoadDelayMs: runtimeConfig.messageMobileAfterLoadDelayMs,
    mobileAfterLoadIdleTimeoutMs: runtimeConfig.messageMobileAfterLoadIdleTimeoutMs,
    mobileScrollTriggerEnabled: runtimeConfig.messageMobileScrollTriggerEnabled,
    mobileScrollTriggerPx: runtimeConfig.messageMobileScrollTriggerPx,
    mobileScrollTriggerDelayMs: runtimeConfig.messageMobileScrollTriggerDelayMs
  };
}

function runtimeFlag(env, name, defaultValue) {
  const value = env?.[name];
  if (typeof value !== "string") return defaultValue;
  return !["0", "false", "off", "disabled", "no"].includes(value.trim().toLowerCase());
}

function runtimeInteger(env, name, defaultValue) {
  const value = env?.[name];
  if (typeof value !== "string" || value.trim() === "") return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultValue;
  return parsed;
}

function runtimeString(env, name, defaultValue) {
  const value = env?.[name];
  if (typeof value !== "string" || value.trim() === "") return defaultValue;
  return value.trim();
}

function selectEdgeFallbackConfig(request, configs) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();
  return (
    configs.find((config) => {
      if (!config.hostnames.includes(url.hostname)) return false;
      if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
      const exactPaths = config.pathExact || [];
      if (exactPaths.length > 0) return exactPaths.includes(pathname);
      return config.pathIncludes.some((path) => pathname.startsWith(path));
    }) || configs[0]
  );
}

function buildHomeHtmlCacheContext(request, config = RESI_HOME_HTML_CACHE_CONFIG, state = {}) {
  if (!config.enabled) return null;
  if (request.method !== "GET") return null;
  if (state.forceFromCookie || state.resetFromCookie) return null;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return null;
  for (const [name] of url.searchParams) {
    if (config.bypassQueryParamNames.includes(name.toLowerCase())) return null;
  }

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return null;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return null;
  if (!config.pathExact.includes(pathname)) return null;

  const cookieHeader = request.headers.get("cookie") || "";
  if (config.bypassCookieIncludes.some((fragment) => cookieHeader.includes(fragment))) return null;

  const variant = isMobileRequest(request) ? "mobile" : "desktop";
  const psiMockValue = normalizeCacheParam(url.searchParams.get("psi_mock"));
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = "/__edge-html-cache/home";
  cacheUrl.search = `?variant=${variant}&v=${encodeURIComponent(config.cacheVersion)}`;
  if (psiMockValue) cacheUrl.searchParams.set("psi_mock", psiMockValue);
  return {
    variant,
    cacheKey: new Request(cacheUrl.toString(), { method: "GET" })
  };
}

function normalizeCacheParam(value) {
  if (!value) return "";
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
}

function markHomeHtmlCacheResponse(response, config, value, serverTiming) {
  const headers = new Headers(response.headers);
  headers.set(config.responseHeader, value);
  headers.set("Cache-Control", `public, max-age=0, s-maxage=${config.edgeTtlSeconds}`);
  if (serverTiming) headers.append("Server-Timing", serverTiming);
  headers.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function maybeStoreHomeHtmlCache(response, cacheContext, config, ctx) {
  if (!cacheContext || response.status !== 200) return response;

  const cacheHeaders = new Headers(response.headers);
  cacheHeaders.delete("set-cookie");
  cacheHeaders.delete("content-length");
  cacheHeaders.set("Cache-Control", `public, max-age=0, s-maxage=${config.edgeTtlSeconds}`);

  const cacheableResponse = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers: cacheHeaders
  });
  ctx?.waitUntil(caches.default.put(cacheContext.cacheKey, cacheableResponse.clone()));
  return markHomeHtmlCacheResponse(
    cacheableResponse,
    config,
    "MISS",
    config.serverTimingMiss
  );
}

function shouldApplyFontDisplayRewrite(request, response, config = RESI_FONT_DISPLAY_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (!config.pathIncludes.some((path) => pathname.startsWith(path))) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/css");
}

async function rewriteFontDisplayResponse(
  originResponse,
  responseHeaders,
  config = RESI_FONT_DISPLAY_CONFIG
) {
  const css = await originResponse.text();
  if (!css.includes("@font-face")) {
    return new Response(css, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders
    });
  }

  let changed = false;
  const rewrittenCss = css.replace(/@font-face\s*\{[^}]*\}/gi, (block) => {
    if (/font-display\s*:/i.test(block)) return block;
    changed = true;
    return block.replace(/\}\s*$/, `font-display:${config.display};}`);
  });

  if (changed) {
    responseHeaders.delete("content-length");
    responseHeaders.append("Server-Timing", config.serverTiming);
  }

  return new Response(rewrittenCss, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders
  });
}

function shouldApplyHomepageAssetTrim(
  request,
  response,
  config = RESI_HOMEPAGE_ASSET_TRIM_CONFIG
) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (Array.isArray(config.pathExact) && config.pathExact.length > 0 && !config.pathExact.includes(pathname)) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function shouldApplyHomeStaticHeroRewrite(
  request,
  response,
  config = RESI_HOME_STATIC_HERO_CONFIG
) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;
  if (!isMobileRequest(request)) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (Array.isArray(config.pathExact) && config.pathExact.length > 0 && !config.pathExact.includes(pathname)) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addHomeStaticHeroRewriter(rewriter) {
  return rewriter
    .on("head", {
      element(element) {
        element.append(buildShadowStaticHeroCss(), { html: true });
      }
    })
    .on("div", new ResiHomeStaticHeroHandler());
}

class ResiHomeStaticHeroHandler {
  constructor() {
    this.replaced = false;
  }

  element(element) {
    if (this.replaced) return;
    if (element.getAttribute("data-page-section") !== "hero") return;

    element.replace(buildShadowStaticHeroHtml(), { html: true });
    this.replaced = true;
  }
}

function addHomepageAssetTrimRewriter(
  rewriter,
  config = RESI_HOMEPAGE_ASSET_TRIM_CONFIG
) {
  return rewriter
    .on("head", new ResiHomepageAssetTrimHeadHandler(config))
    .on("link", new ResiHomepageAssetTrimLinkHandler(config))
    .on("script", new ResiHomepageAssetTrimScriptHandler(config));
}

function shouldApplyHeroViewportHeightRewrite(
  request,
  response,
  config = RESI_HERO_VIEWPORT_HEIGHT_CONFIG
) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;
  if (config.mobileOnly && !isMobileRequest(request)) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (Array.isArray(config.pathExact) && config.pathExact.length > 0 && !config.pathExact.includes(pathname)) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addHeroViewportHeightRewriter(
  rewriter,
  config = RESI_HERO_VIEWPORT_HEIGHT_CONFIG
) {
  return rewriter
    .on("head", new ResiHeroViewportHeightHeadHandler(config))
    .on("div", new ResiHeroViewportHeightHandler(config));
}

class ResiHeroViewportHeightHeadHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    element.append(buildHeroViewportHeightCss(this.config), { html: true });
  }
}

class ResiHeroViewportHeightHandler {
  constructor(config) {
    this.config = config;
    this.removed = false;
  }

  element(element) {
    if (this.removed) return;

    const value = element.getAttribute(this.config.targetAttribute);
    if (value === null) return;
    if (!value.includes(this.config.targetAttributeIncludes)) return;

    const className = element.getAttribute("class") || "";
    if (!className.includes(this.config.targetClassIncludes)) return;

    element.removeAttribute(this.config.targetAttribute);
    element.setAttribute("class", addClassName(className, this.config.className));
    element.setAttribute(this.config.markerAttribute, "removed");
    this.removed = true;
  }
}

function buildHeroViewportHeightCss(config = RESI_HERO_VIEWPORT_HEIGHT_CONFIG) {
  return `<style data-vtr-hero-viewport-height="css">@media (max-width:767px){.${config.className}{height:auto!important;min-height:${config.mobileMinHeightPx}px!important}}</style>`;
}

class ResiHomepageAssetTrimHeadHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    element.append(buildHomepageHeroMediaFillCss(), { html: true });
  }
}

function buildHomepageHeroMediaFillCss() {
  return `<style data-vtr-homepage-hero-media-fill="1">
@media (min-width:768px){
body:not(.vtr-edge-static-shell-body) .tm-header,
body:not(.vtr-edge-static-shell-body) .tm-header .uk-navbar-container,
body:not(.vtr-edge-static-shell-body) .tm-header .uk-navbar{min-height:80px!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"]{min-height:calc(100vh - 126px)!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"]>.uk-panel[uk-height-viewport]{height:calc(100vh - 126px)!important;min-height:calc(100vh - 126px)!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"],
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] .uk-panel{overflow:hidden!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] .uk-panel[uk-height-viewport]{position:relative!important;overflow:hidden!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] .uk-panel.uk-width-1-1{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:100%!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] [id="page#0"],
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] .uk-inline-clip,
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] picture,
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] img.el-image,
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] .uk-position-cover{height:100%!important;min-height:100%!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] .uk-inline-clip,
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] picture,
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] img.el-image{display:block!important;width:100%!important}
body:not(.vtr-edge-static-shell-body) [data-page-section="hero"] img.el-image{max-width:none!important;object-fit:cover!important;object-position:center center!important}
}
</style>`;
}

class ResiHomepageAssetTrimLinkHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    if (!this.config.duplicateStylesheetRemovalEnabled) return;
    const href = element.getAttribute("href") || "";
    if (!this.config.duplicateStylesheetHrefIncludes.some((fragment) => href.includes(fragment))) {
      return;
    }
    element.remove();
  }
}

class ResiHomepageAssetTrimScriptHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    const src = element.getAttribute("src") || "";
    if (
      this.config.filtersRemovalEnabled &&
      this.config.removeScriptSrcIncludes.some((fragment) => src.includes(fragment))
    ) {
      element.remove();
      return;
    }

    if (
      this.config.customJsDeferEnabled &&
      this.config.deferScriptSrcIncludes.some((fragment) => src.includes(fragment))
    ) {
      element.setAttribute("defer", "");
      return;
    }

    if (
      this.config.iconsThemeDeferEnabled &&
      this.config.deferIconsThemeScriptSrcIncludes.some((fragment) => src.includes(fragment))
    ) {
      element.setAttribute("defer", "");
      element.setAttribute(
        "data-vtr-homepage-asset-trim",
        appendToken(element.getAttribute("data-vtr-homepage-asset-trim"), "defer-icons-theme")
      );
    }
  }
}

function shouldApplyLegacyScriptRewrite(request, response, config = RESI_LEGACY_SCRIPT_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (Array.isArray(config.pathExact) && config.pathExact.length > 0 && !config.pathExact.includes(pathname)) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addLegacyScriptRewriter(rewriter, config = RESI_LEGACY_SCRIPT_CONFIG) {
  return rewriter.on("script", new ResiLegacyScriptHandler(config));
}

class ResiLegacyScriptHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    const src = element.getAttribute("src") || "";
    if (!this.config.scriptSrcIncludes.some((fragment) => src.includes(fragment))) return;
    element.remove();
  }
}

function shouldApplyIdleScriptRewrite(request, response, config = RESI_PIXEL_IDLE_CONFIG) {
  if (!shouldApplyLegacyScriptRewrite(request, response, config)) return false;
  if (!config.mobileOnly) return true;

  const userAgent = request.headers.get("user-agent") || "";
  return /Android|iPhone|iPod|IEMobile|Mobile/i.test(userAgent);
}

function addIdleScriptRewriter(rewriter, config = RESI_PIXEL_IDLE_CONFIG) {
  const next = rewriter.on("script", new ResiIdleScriptHandler(config));
  if (config.injectIdleLoader === false) return next;
  return next.on("body", new ResiIdleScriptBodyHandler(config));
}

class ResiIdleScriptHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    const src = element.getAttribute("src") || "";
    if (!this.config.scriptSrcIncludes.some((fragment) => src.includes(fragment))) return;
    element.remove();
  }
}

class ResiIdleScriptBodyHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    element.append(buildIdleScriptLoader(this.config), { html: true });
  }
}

function buildIdleScriptLoader(config = RESI_PIXEL_IDLE_CONFIG) {
  const payload = JSON.stringify({
    src: config.scriptSrcIncludes[0],
    delayMs: config.delayMs,
    requireZarazConsent: !!config.requireZarazConsent,
    consentPurposeNameIncludes: config.consentPurposeNameIncludes || []
  }).replace(/</g, "\\u003c");

  return `<script data-edge-resi-pixel-idle="1">(function(){const c=${payload};let loaded=false;function purposeAccepted(){if(!c.requireZarazConsent)return true;const z=window.zaraz&&window.zaraz.consent;if(!z||!z.getAll||!z.purposes)return false;const choices=z.getAll()||{};const needles=(c.consentPurposeNameIncludes||[]).map(function(x){return String(x).toLowerCase()});return Object.keys(z.purposes||{}).some(function(id){const purpose=z.purposes[id]||{};const name=purpose.name&&((purpose.name.en)||Object.values(purpose.name)[0])||"";const text=String(name).toLowerCase();return needles.some(function(needle){return text.indexOf(needle)!==-1})&&choices[id]===true})}function load(){if(loaded||!purposeAccepted())return;loaded=true;const s=document.createElement("script");s.src=c.src;s.async=true;s.dataset.edgeResiPixelIdle="1";document.head.appendChild(s)}function schedule(){const run=function(){setTimeout(load,c.delayMs)};if("requestIdleCallback"in window){requestIdleCallback(run,{timeout:2500});return}run()}function start(){if(!c.requireZarazConsent||purposeAccepted()){schedule();return}document.addEventListener("zarazConsentChoicesUpdated",schedule);document.addEventListener("zarazConsentAPIReady",schedule)}if(document.readyState==="complete"){start();return}window.addEventListener("load",start,{once:true})})();</script>`;
}

function shouldApplySightMapRewrite(request, response, config = RESI_SIGHTMAP_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addSightMapRewriter(rewriter, config = RESI_SIGHTMAP_CONFIG) {
  const state = { removeNextInlineSightMapScript: false };
  return rewriter
    .on("iframe", new ResiSightMapIframeHandler(state, config))
    .on("script", new ResiSightMapScriptHandler(state, config))
    .on("body", new ResiSightMapBodyHandler(config));
}

class ResiSightMapIframeHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    const id = element.getAttribute("id") || "";
    const src = element.getAttribute("src") || "";
    if (id !== this.config.iframeId) return;
    if (!this.config.iframeSrcIncludes.some((fragment) => src.includes(fragment))) return;

    element.setAttribute("data-edge-sightmap-src", src);
    element.setAttribute("data-edge-sightmap-lazy", "1");
    element.setAttribute("src", "about:blank");
    element.setAttribute("loading", "lazy");
    this.state.removeNextInlineSightMapScript = true;
  }
}

class ResiSightMapScriptHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    const src = element.getAttribute("src") || "";
    if (this.config.apiScriptSrcIncludes.some((fragment) => src.includes(fragment))) {
      element.remove();
      return;
    }

    if (!src && this.state.removeNextInlineSightMapScript) {
      element.remove();
      this.state.removeNextInlineSightMapScript = false;
    }
  }
}

class ResiSightMapBodyHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    element.append(buildSightMapLazyLoader(this.config), { html: true });
  }
}

function buildSightMapLazyLoader(config = RESI_SIGHTMAP_CONFIG) {
  const payload = JSON.stringify({
    iframeId: config.iframeId,
    apiScriptSrc: "https://sightmap.com/embed/api.js?ver=3.15.0"
  }).replace(/</g, "\\u003c");

  return `<script data-edge-sightmap-lazy="1">(function(){const c=${payload};let requested=false;let embed=null;function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}function qs(sel){return Array.from(document.querySelectorAll(sel))}function visible(el){if(!el)return false;const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=="none"&&s.visibility!=="hidden"}function mapTabs(){return qs('a[href="#map"],button,[role="tab"],.fs-switcher__nav-item-link').filter(el=>/\\bmap\\b/i.test((el.textContent||"").trim())||el.getAttribute("href")==="#map")}function loadSightMap(){if(requested)return;requested=true;const iframe=document.getElementById(c.iframeId);if(iframe&&iframe.dataset.edgeSightmapSrc&&iframe.getAttribute("src")==="about:blank"){iframe.setAttribute("src",iframe.dataset.edgeSightmapSrc)}if(window.SightMap&&typeof window.SightMap.Embed==="function"){initialize();return}const script=document.createElement("script");script.src=c.apiScriptSrc;script.defer=true;script.onload=initialize;script.onerror=function(){requested=false};document.head.appendChild(script)}function unitCards(){return qs('.re-units-grid-v2 > div')}function floorPlanCards(){return qs('.floor-plans-grid-v2 > div')}function unique(values){return Array.from(new Set(values.filter(Boolean)))}function deriveFloorPlanUnits(){const byId={};for(const card of unitCards()){const id=card.getAttribute("data-floor_plan_id");const unit=card.getAttribute("data-unit_number");if(!id||!unit)continue;(byId[id]||(byId[id]=[])).push(unit)}return byId}function visibleCards(cards){const filtersApi=window.Filters;if(filtersApi&&filtersApi.FilterEngine&&typeof filtersApi.FilterEngine.applyFromURL==="function"){return filtersApi.FilterEngine.applyFromURL({cards,updateCount:null})}return cards.filter(visible)}function visibleUnitNumbers(){const units=unitCards();if(units.length)return unique(visibleCards(units).map(card=>card.getAttribute("data-unit_number")));const plans=floorPlanCards();const byId=deriveFloorPlanUnits();const ids=unique(visibleCards(plans).map(card=>card.getAttribute("data-floor_plan_id")));return unique(ids.flatMap(id=>byId[id]||[]))}function initialize(){if(embed)return true;if(!window.SightMap||typeof window.SightMap.Embed!=="function")return false;const iframe=document.getElementById(c.iframeId);if(!iframe||iframe.dataset.sightmapInitialized==="true")return !!iframe;iframe.dataset.sightmapInitialized="true";embed=new window.SightMap.Embed(c.iframeId);embed.on("ready",function(){try{embed.disableUI(["filters"])}catch(e){}function apply(){try{embed.setUnitNumberMatches(visibleUnitNumbers(),{filterEditing:false})}catch(e){}}window.addEventListener("popstate",apply);window.addEventListener("filters:updated",apply);apply()});embed.on("metrics.unitList.unit.click",function(event){document.dispatchEvent(new CustomEvent("resi_residence_viewed",{detail:event.data.unit,bubbles:true,composed:true,cancelable:true}))});embed.on("metrics.unitMap.unit.click",function(event){document.dispatchEvent(new CustomEvent("resi_residence_viewed",{detail:event.data.unit,bubbles:true,composed:true,cancelable:true}))});embed.on("metrics.unitDetails.apply.click",function(event){document.dispatchEvent(new CustomEvent("resi_application_start",{detail:{unit:event.data.unit,floorPlan:event.data.unit.floorPlan},bubbles:true,composed:true,cancelable:true}))});return true}ready(function(){for(const tab of mapTabs()){tab.addEventListener("pointerenter",loadSightMap,{once:true});tab.addEventListener("focus",loadSightMap,{once:true});tab.addEventListener("click",loadSightMap,{once:true})}const iframe=document.getElementById(c.iframeId);if(location.hash==="#map")loadSightMap();if(iframe&&"IntersectionObserver"in window){const io=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){io.disconnect();loadSightMap()}},{rootMargin:"700px 0px"});io.observe(iframe)}})})();</script>`;
}

function isMobileRequest(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return /Android|iPhone|iPod|IEMobile|Mobile/i.test(userAgent);
}

function shouldApplyHeroMobileRewrite(request, response, config = RESI_HERO_MOBILE_IMAGE_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;
  if (!isMobileRequest(request)) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addHeroMobileRewriter(rewriter, config = RESI_HERO_MOBILE_IMAGE_CONFIG) {
  const state = { matchedSource: false, rewrittenSource: false };
  if (config.preloadEnabled || config.criticalCssEnabled) {
    rewriter = rewriter.on("head", new ResiHeroMobileHeadHandler(config));
  }
  return rewriter
    .on("source", new ResiHeroMobileSourceHandler(state, config))
    .on("img", new ResiHeroMobileImageHandler(state, config));
}

class ResiHeroMobileHeadHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    const headHints = [];
    if (this.config.preloadEnabled) {
      headHints.push(
        `<link rel="preload" as="image" href="${this.config.mobileImageUrl}" imagesrcset="${this.config.mobileSrcset}" imagesizes="${this.config.sizes}" fetchpriority="high" data-edge-hero-preload="mobile-750">`
      );
    }
    if (this.config.criticalCssEnabled) {
      headHints.push(buildHeroMobileCriticalCss());
    }
    element.prepend(headHints.join(""), { html: true });
  }
}

function buildHeroMobileCriticalCss() {
  return `<style data-edge-hero-critical-css="mobile">@media(max-width:767px){[id="page#0"]{position:relative;overflow:hidden}[id="page#0"] .uk-slideshow-items{position:relative;min-height:calc(100vh - 150px);height:calc(100vh - 150px);overflow:hidden}[id="page#0"] .el-item{position:absolute;inset:0;overflow:hidden}[id="page#0"] picture,[id="page#0"] .el-image{display:block;width:100%;height:100%;object-fit:cover}[id="page#0"] .uk-position-relative{position:relative}[id="page#0"] .uk-position-cover{position:absolute;inset:0}[id="page#0"] .uk-flex{display:flex}[id="page#0"] .uk-flex-center{justify-content:center}[id="page#0"] .uk-flex-middle{align-items:center}[id="page#0"] .uk-padding-large{padding:40px}[id="page#0"] .uk-panel{position:relative;box-sizing:border-box}[id="page#0"] .uk-light{color:#fff}[id="page#0"] .uk-text-center{text-align:center}}</style>`;
}

class ResiHeroMobileSourceHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    if (this.state.rewrittenSource) return;

    const srcset = element.getAttribute("srcset") || "";
    if (!this.config.matchSrcIncludes.some((fragment) => srcset.includes(fragment))) return;

    element.setAttribute("srcset", this.config.mobileSrcset);
    element.setAttribute("sizes", this.config.sizes);
    element.setAttribute("data-edge-hero-mobile", "source");
    this.state.matchedSource = true;
    this.state.rewrittenSource = true;
  }
}

class ResiHeroMobileImageHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    const src = element.getAttribute("src") || "";
    const isHero =
      this.state.matchedSource ||
      this.config.matchSrcIncludes.some((fragment) => src.includes(fragment));
    if (!isHero) return;

    element.setAttribute("src", this.config.mobileImageUrl);
    element.setAttribute("width", String(this.config.width));
    element.setAttribute("height", String(this.config.height));
    element.setAttribute("loading", "eager");
    element.setAttribute("fetchpriority", "high");
    element.setAttribute("decoding", "async");
    element.setAttribute("data-edge-hero-mobile", "img");
    this.state.matchedSource = false;
  }
}

function shouldApplyMobileImageReplacementRewrite(
  request,
  response,
  config = RESI_MOBILE_IMAGE_REPLACEMENT_CONFIG
) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addMobileImageReplacementRewriter(
  rewriter,
  config = RESI_MOBILE_IMAGE_REPLACEMENT_CONFIG
) {
  return rewriter.on("img", new ResiMobileImageReplacementHandler(config));
}

class ResiMobileImageReplacementHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    const src = element.getAttribute("src") || "";
    const srcset = element.getAttribute("srcset") || "";
    const replacement = this.config.replacements.find(
      (item) => item.originalSrc === src || src.includes(item.originalSrc) || srcset.includes(item.originalSrc)
    );
    if (!replacement) return;

    element.setAttribute("src", replacement.replacementSrc);
    element.removeAttribute("srcset");
    element.setAttribute("loading", "lazy");
    element.setAttribute("fetchpriority", "low");
    element.setAttribute("decoding", "async");
    element.setAttribute("data-edge-mobile-image", replacement.key);
  }
}

function shouldApplyStaticHeroPocRewrite(
  request,
  response,
  config = RESI_STATIC_HERO_POC_CONFIG
) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;
  if (!isMobileRequest(request)) return false;

  const url = new URL(request.url);
  if (url.searchParams.get(config.queryParam) !== "1") return false;
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function buildExperimentOriginRequest(request, configs = []) {
  if (request.method !== "GET") return request;

  const url = new URL(request.url);
  const matchingConfigs = configs.filter((config) => {
    if (!config?.queryParam || !url.searchParams.has(config.queryParam)) return false;
    if (!config.hostnames.includes(url.hostname)) return false;
    if (!config.pathExact.includes(url.pathname.toLowerCase())) return false;
    return true;
  });
  if (matchingConfigs.length === 0) return request;

  const cleanUrl = new URL(url);
  for (const config of matchingConfigs) cleanUrl.searchParams.delete(config.queryParam);
  return new Request(cleanUrl.toString(), request);
}

function buildStaticHeroPocOriginRequest(request, config = RESI_STATIC_HERO_POC_CONFIG) {
  return buildExperimentOriginRequest(request, [config]);
}

function buildPsiMockState(request, config = RESI_PSI_MOCK_CONFIG) {
  const state = {
    enabled: false,
    noDropbar: false,
    noStickyHeader: false,
    fixedHeroHeight: false,
    noWelcomeScrollspy: false,
    staticReview: false,
    deferYootheme: false,
    deferTheme: false,
    deferIconsTheme: false,
    criticalHeroCss: false,
    deferNoncriticalCss: false,
    shadowStaticHero: false,
    criticalJsBootstrap: false,
    edgeStaticShell: false,
    requested: []
  };

  const url = new URL(request.url);
  const rawValue = url.searchParams.get(config.queryParam);
  if (!rawValue) return state;

  const requested = rawValue
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0) return state;

  state.requested = requested;
  const useAll = requested.includes(config.allVariant);
  state.noDropbar = useAll || requested.includes(config.variants.noDropbar);
  state.noStickyHeader = useAll || requested.includes(config.variants.noStickyHeader);
  state.fixedHeroHeight = useAll || requested.includes(config.variants.fixedHeroHeight);
  state.noWelcomeScrollspy = useAll || requested.includes(config.variants.noWelcomeScrollspy);
  state.staticReview = useAll || requested.includes(config.variants.staticReview);
  state.deferYootheme = requested.includes(config.variants.deferYootheme);
  state.deferTheme = requested.includes(config.variants.deferTheme);
  state.deferIconsTheme = requested.includes(config.variants.deferIconsTheme);
  state.criticalHeroCss = useAll || requested.includes(config.variants.criticalHeroCss);
  state.deferNoncriticalCss = requested.includes(config.variants.deferNoncriticalCss);
  state.shadowStaticHero = requested.includes(config.variants.shadowStaticHero);
  state.criticalJsBootstrap = requested.includes(config.variants.criticalJsBootstrap);
  state.edgeStaticShell = requested.includes(config.variants.edgeStaticShell);
  state.enabled =
    state.noDropbar ||
    state.noStickyHeader ||
    state.fixedHeroHeight ||
    state.noWelcomeScrollspy ||
    state.staticReview ||
    state.deferYootheme ||
    state.deferTheme ||
    state.deferIconsTheme ||
    state.criticalHeroCss ||
    state.deferNoncriticalCss ||
    state.shadowStaticHero ||
    state.criticalJsBootstrap ||
    state.edgeStaticShell;
  return state;
}

function shouldApplyPsiMockRewrite(
  request,
  response,
  config = RESI_PSI_MOCK_CONFIG,
  state = buildPsiMockState(request, config)
) {
  if (!config.enabled || !state.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;
  if (!state.edgeStaticShell && !isMobileRequest(request)) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

async function maybeHandleEdgeFontAsset(request, ctx, config = EDGE_FONT_ASSET_CONFIG) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return null;
  if (!url.pathname.startsWith(config.routePrefix)) return null;

  const assetName = url.pathname.slice(config.routePrefix.length);
  const asset = config.assets[assetName];
  if (!asset) return new Response("Not found", { status: 404 });

  const cacheKey = new Request(url.origin + config.routePrefix + assetName, {
    method: "GET",
    headers: {
      Accept: request.headers.get("accept") || "*/*"
    }
  });
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("Server-Timing", config.serverTimingHit);
    return new Response(request.method === "HEAD" ? null : cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers
    });
  }

  const originResponse = await fetch(asset.originUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: 31536000
    }
  });
  if (!originResponse.ok) {
    return new Response("Font unavailable", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", asset.contentType);
  headers.set("Cache-Control", config.cacheControl);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Server-Timing", config.serverTimingMiss);
  const etag = originResponse.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  const lastModified = originResponse.headers.get("last-modified");
  if (lastModified) headers.set("Last-Modified", lastModified);

  const body = request.method === "HEAD" ? null : await originResponse.arrayBuffer();
  const response = new Response(body, {
    status: 200,
    headers
  });

  if (request.method === "GET") {
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  }

  return response;
}

function shouldApplyHomeStaticShellRewrite(request, response, enabled) {
  if (!enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;
  if (!isMobileRequest(request)) return false;

  const url = new URL(request.url);
  if (url.searchParams.has("edge_shell_rest")) return false;
  if (!RESI_PSI_MOCK_CONFIG.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (RESI_PSI_MOCK_CONFIG.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (RESI_PSI_MOCK_CONFIG.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!RESI_PSI_MOCK_CONFIG.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function shouldApplyHomeNativePromoRewrite(
  request,
  response,
  config = RESI_HOME_NATIVE_PROMO_CONFIG
) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (url.searchParams.has("edge_shell_rest")) return false;
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function addHomeNativePromoRewriter(rewriter) {
  return rewriter
    .on("body", new HomeNativePromoBodyHandler())
    .on("div", new HomeNativePromoDuplicateHandler());
}

class HomeNativePromoBodyHandler {
  element(element) {
    element.prepend(buildHomeNativePromoMarkup(), { html: true });
  }
}

class HomeNativePromoDuplicateHandler {
  element(element) {
    const className = element.getAttribute("class") || "";
    const componentName = element.getAttribute("data-component-name") || "";
    if (!className.includes("popup-element") || componentName !== "open_promo_bar") return;
    element.remove();
  }
}

function buildHomeNativePromoMarkup() {
  return `<style data-vtr-home-native-promo="1">
.vtr-native-promo{position:relative;z-index:50;background:#15284B;color:#fff;font-family:inherit}
.vtr-native-promo summary{display:flex;align-items:center;justify-content:center;gap:14px;height:46px;padding:0 20px;box-sizing:border-box;cursor:pointer;list-style:none;color:#fff;font-size:15px;font-weight:700;line-height:46px;letter-spacing:1.6px;text-align:center}
.vtr-native-promo summary::-webkit-details-marker{display:none}
.vtr-native-promo summary:after{content:"";width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px)}
.vtr-native-promo[open] summary:after{transform:rotate(225deg) translateY(-2px)}
.vtr-native-promo-panel{padding:64px 20px 68px;background:#fff;color:#15284B;text-align:center;box-shadow:0 16px 30px rgba(21,40,75,.16)}
.vtr-native-promo-panel h2{margin:0 0 26px;color:#15284B;font-size:44px;font-weight:400;line-height:1.18;letter-spacing:0}
.vtr-native-promo-panel p{margin:0 0 56px;color:#15284B;font-size:24px;font-style:italic;line-height:1.45}
.vtr-native-promo-actions{display:flex;align-items:center;justify-content:center;gap:34px;flex-wrap:wrap}
.vtr-native-promo-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:70px;padding:0 46px;border:2px solid transparent;border-radius:999px;color:#15284B;background:#fff;text-decoration:none;font-size:23px;font-weight:800;line-height:66px;letter-spacing:4px}
.vtr-native-promo-actions a:first-child{background:#3D66B9;color:#fff;border-color:#3D66B9}
@media (max-width:767px){.vtr-native-promo{display:none}}
</style>
<details class="vtr-native-promo">
  <summary>Now Offering Up To One Month Free</summary>
  <div class="vtr-native-promo-panel">
    <h2>Now Offering Up To One Month Free</h2>
    <p>*Select Home. Limited Time Offer.</p>
    <div class="vtr-native-promo-actions">
      <a href="/specials/">See Specials</a>
      <a href="https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/GA4AX" rel="noopener">Schedule A Tour</a>
    </div>
  </div>
</details>`;
}

function buildPsiMockServerTimings(state, config = RESI_PSI_MOCK_CONFIG) {
  const timings = [];
  const variantPairs = [
    ["noDropbar", "no-dropbar"],
    ["noStickyHeader", "no-sticky"],
    ["fixedHeroHeight", "fixed-hero"],
    ["noWelcomeScrollspy", "no-scrollspy"],
    ["staticReview", "static-review"],
    ["deferYootheme", "defer-yootheme"],
    ["deferTheme", "defer-theme"],
    ["deferIconsTheme", "defer-icons-theme"],
    ["criticalHeroCss", "critical-hero-css"],
    ["deferNoncriticalCss", "defer-noncritical-css"],
    ["shadowStaticHero", "shadow-static-hero"],
    ["criticalJsBootstrap", "critical-js-bootstrap"],
    ["edgeStaticShell", "edge-static-shell"]
  ];
  for (const [key, label] of variantPairs) {
    if (state[key]) timings.push(`${config.serverTimingPrefix};desc="${label}"`);
  }
  return timings;
}

function addPsiMockRewriter(rewriter, config = RESI_PSI_MOCK_CONFIG, state = {}) {
  return rewriter
    .on("head", new ResiPsiMockHeadHandler(state))
    .on("link", new ResiPsiMockLinkHandler(config, state))
    .on("script", new ResiPsiMockScriptHandler(config, state))
    .on("body", new ResiPsiMockBodyHandler(state))
    .on("div", new ResiPsiMockDivHandler(state))
    .on("section", new ResiPsiMockDivHandler(state))
    .on("nav", new ResiPsiMockDivHandler(state))
    .on("a", new ResiPsiMockElementHandler(state))
    .on("button", new ResiPsiMockElementHandler(state));
}

class ResiPsiMockScriptHandler {
  constructor(config, state) {
    this.config = config;
    this.state = state;
  }

  element(element) {
    if (this.state.edgeStaticShell) {
      element.remove();
      return;
    }
    if (!this.state.deferYootheme && !this.state.deferTheme && !this.state.deferIconsTheme) return;
    const src = element.getAttribute("src") || "";
    const srcIncludes = [];
    if (this.state.deferYootheme) srcIncludes.push(...this.config.deferYoothemeScriptSrcIncludes);
    if (this.state.deferTheme) srcIncludes.push(...this.config.deferThemeScriptSrcIncludes);
    if (this.state.deferIconsTheme) srcIncludes.push(...this.config.deferIconsThemeScriptSrcIncludes);
    if (!srcIncludes.some((fragment) => src.includes(fragment))) return;
    element.setAttribute("defer", "");
    const token = this.state.deferYootheme
      ? "defer-yootheme"
      : this.state.deferIconsTheme
        ? "defer-icons-theme"
        : "defer-theme";
    element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), token));
  }
}

class ResiPsiMockHeadHandler {
  constructor(state) {
    this.state = state;
  }

  element(element) {
    if (this.state.edgeStaticShell) {
      element.setInnerContent(buildEdgeStaticShellHead(), { html: true });
      return;
    }
    if (this.state.criticalJsBootstrap) {
      element.prepend(buildCriticalJsBootstrap(), { html: true });
    }
    element.append(buildPsiMockCss(this.state), { html: true });
  }
}

class ResiPsiMockBodyHandler {
  constructor(state) {
    this.state = state;
  }

  element(element) {
    if (!this.state.edgeStaticShell) return;
    element.setAttribute("class", "vtr-edge-static-shell-body");
    element.setInnerContent(buildEdgeStaticShellBody(), { html: true });
  }
}

class ResiPsiMockElementHandler {
  constructor(state) {
    this.state = state;
  }

  element(element) {
    if (this.state.edgeStaticShell) return;
    if (!this.state.noStickyHeader) return;
    if (element.getAttribute("uk-toggle") === null) return;
    const className = element.getAttribute("class") || "";
    if (!className.includes("uk-navbar-toggle") && !className.includes("uk-offcanvas-close")) return;
    element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "toggle-kept"));
  }
}

class ResiPsiMockLinkHandler {
  constructor(config, state) {
    this.config = config;
    this.state = state;
  }

  element(element) {
    if (this.state.edgeStaticShell) {
      element.remove();
      return;
    }
    if (!this.state.deferNoncriticalCss) return;
    if ((element.getAttribute("rel") || "").toLowerCase() !== "stylesheet") return;

    const href = element.getAttribute("href") || "";
    if (!this.config.deferNoncriticalCssHrefIncludes.some((fragment) => href.includes(fragment))) {
      return;
    }

    element.setAttribute("rel", "preload");
    element.setAttribute("as", "style");
    element.setAttribute("onload", "this.onload=null;this.rel='stylesheet'");
    element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "defer-noncritical-css"));
  }
}

class ResiPsiMockDivHandler {
  constructor(state) {
    this.state = state;
    this.heroHeightRewrites = 0;
    this.shadowStaticHeroReplaced = false;
  }

  element(element) {
    const className = element.getAttribute("class") || "";
    const id = element.getAttribute("id") || "";

    if (
      this.state.shadowStaticHero &&
      !this.shadowStaticHeroReplaced &&
      element.getAttribute("data-page-section") === "hero"
    ) {
      element.replace(buildShadowStaticHeroHtml(), { html: true });
      this.shadowStaticHeroReplaced = true;
      return;
    }

    if (this.state.noDropbar && element.getAttribute("uk-drop") !== null) {
      element.removeAttribute("uk-drop");
      element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "no-dropbar"));
      element.setAttribute(
        "style",
        appendStyle(element.getAttribute("style") || "", "display:none!important;")
      );
      return;
    }

    if (this.state.noStickyHeader && element.getAttribute("uk-sticky") !== null) {
      element.removeAttribute("uk-sticky");
      element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "no-sticky"));
      element.setAttribute("class", addClassName(className, "vtr-psi-mock-static-header"));
    }

    if (this.state.noStickyHeader && element.getAttribute("uk-navbar") !== null) {
      element.removeAttribute("uk-navbar");
      element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "no-navbar-init"));
    }

    if (this.state.fixedHeroHeight && element.getAttribute("uk-height-viewport") !== null) {
      if (id === "page#2" || className.includes("uk-section-primary") || className.includes("uk-panel")) {
        this.heroHeightRewrites += 1;
        element.removeAttribute("uk-height-viewport");
        element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "fixed-hero-height"));
        element.setAttribute("class", addClassName(className, "vtr-psi-mock-fixed-hero"));
      }
    }

    if (this.state.noWelcomeScrollspy && element.getAttribute("uk-scrollspy") !== null) {
      const value = element.getAttribute("uk-scrollspy") || "";
      if (value.includes("uk-animation-slide-right-small") || className.includes("uk-section-muted")) {
        element.removeAttribute("uk-scrollspy");
        element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "no-welcome-scrollspy"));
        element.setAttribute("class", removeClassTokens(className, [
          "uk-scrollspy-inview",
          "uk-animation-slide-right-small",
          "uk-animation-slide-bottom-small"
        ]));
      }
    }

    if (this.state.staticReview && element.getAttribute("uk-slider") !== null) {
      const value = element.getAttribute("uk-slider") || "";
      element.setAttribute(
        "uk-slider",
        value
          .replace(/autoplay\s*:\s*1\s*;?/gi, "autoplay: 0;")
          .replace(/autoplay\s*:\s*true\s*;?/gi, "autoplay: false;")
      );
      element.setAttribute("data-vtr-psi-mock", appendToken(element.getAttribute("data-vtr-psi-mock"), "static-review"));
    }
  }
}

function appendToken(value, token) {
  const tokens = new Set((value || "").split(/\s+/).filter(Boolean));
  tokens.add(token);
  return Array.from(tokens).join(" ");
}

function removeClassTokens(className, tokensToRemove) {
  const blocked = new Set(tokensToRemove);
  return (className || "")
    .split(/\s+/)
    .filter((token) => token && !blocked.has(token))
    .join(" ");
}

function buildPsiMockCss(state = {}) {
  const rules = [];
  if (state.noStickyHeader) {
    rules.push(`
.vtr-psi-mock-static-header{position:relative!important;top:auto!important}
`);
  }
  if (state.fixedHeroHeight) {
    rules.push(`
.vtr-psi-mock-fixed-hero{height:auto!important;min-height:718px!important}
@media (max-width:767px){.vtr-psi-mock-fixed-hero{min-height:718px!important}}
`);
  }
  if (state.noWelcomeScrollspy) {
    rules.push(`
[data-vtr-psi-mock~="no-welcome-scrollspy"] [uk-scrollspy-class]{opacity:1!important;transform:none!important;visibility:visible!important}
`);
  }
  if (state.criticalHeroCss) {
    rules.push(`
@media (max-width:767px){
html{overflow-x:hidden}
body{margin:0;overflow-x:hidden;background:#fff;color:#15284B}
.tm-header-mobile,.tm-header{display:block;position:relative;z-index:20;background:#fff}
.tm-header-mobile .uk-navbar-container,.tm-header .uk-navbar-container{background:#fff}
.tm-header-mobile .uk-navbar,.tm-header .uk-navbar{min-height:72px;display:flex;align-items:center}
.tm-header-mobile .uk-logo,.tm-header .uk-logo{display:flex;align-items:center;min-height:44px;color:#15284B;text-decoration:none;font-weight:800;letter-spacing:0}
.tm-header-mobile a,.tm-header a{color:#15284B}
[data-page-section="hero"]{position:relative;overflow:hidden;background:#15284B;color:#fff;padding:0!important}
[data-page-section="hero"]>.uk-grid{margin:0!important}
[data-page-section="hero"] .uk-width-1-1{padding:0!important}
[data-page-section="hero"] .uk-panel{position:relative;min-height:718px}
[id="page#0"]{position:relative;min-height:718px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#fff;text-align:center}
[id="page#0"] .uk-inline-clip{position:absolute;inset:0;display:block;overflow:hidden}
[id="page#0"] picture,[id="page#0"] img.el-image{display:block;width:100%;height:100%;min-height:718px;object-fit:cover;object-position:center center}
[id="page#0"] img.el-image{opacity:1;visibility:visible}
[id="page#0"] .el-overlay,[id="page#0"] .uk-position-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff}
[id="page#0"] .el-title,[id="page#0"] h1,[id="page#0"] h2{margin:0 auto 12px;color:#fff;font-family:Georgia,"Times New Roman",serif;font-weight:400;line-height:1.08;letter-spacing:0;text-align:center;text-wrap:balance}
[id="page#0"] .el-meta,[id="page#0"] .el-content,[id="page#0"] p{color:#fff;text-align:center}
[id="page#0"] .uk-button,[id="page#0"] a.uk-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:999px;padding:0 22px;background:#fff;color:#15284B;text-decoration:none;font-weight:800;line-height:1}
}
`);
  }
  if (state.shadowStaticHero) {
    rules.push(buildShadowStaticHeroCss(false));
  }
  if (rules.length === 0) return "";
  return `<style data-vtr-psi-mock="1">${rules.join("\n")}</style>`;
}

function buildShadowStaticHeroCss(wrap = true) {
  const css = `
@media (max-width:767px){
.vtr-shadow-static-hero{position:relative;display:flex;align-items:center;justify-content:center;min-height:550px;overflow:hidden;background:#15284B;color:#fff;text-align:center;contain:layout paint}
.vtr-shadow-static-hero__image{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center center}
.vtr-shadow-static-hero__shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(21,40,75,.14),rgba(21,40,75,.28) 52%,rgba(21,40,75,.48))}
.vtr-shadow-static-hero__content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:15px;width:100%;max-width:350px;padding:58px 24px 34px}
.vtr-shadow-static-hero__kicker{margin:0;color:#fff;font-family:Georgia,"Times New Roman",serif;font-size:38px;font-weight:400;line-height:1.02;text-shadow:0 2px 14px rgba(0,0,0,.26)}
.vtr-shadow-static-hero__title{margin:0;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;line-height:1.35;text-shadow:0 1px 10px rgba(0,0,0,.34)}
.vtr-shadow-static-hero__button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 20px;border-radius:999px;background:#fff;color:#15284B;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;line-height:1;text-decoration:none;box-shadow:0 10px 24px rgba(0,0,0,.16)}
}
`;
  if (!wrap) return css;
  return `<style data-vtr-home-static-hero="1">${css}</style>`;
}

function buildShadowStaticHeroHtml() {
  return `<section class="vtr-shadow-static-hero" data-page-section="hero" data-vtr-psi-mock="shadow-static-hero" aria-label="Apex West Midtown hero" style="position:relative;display:flex;align-items:center;justify-content:center;min-height:550px;overflow:hidden;background:#15284B;color:#fff;text-align:center;contain:layout paint">
  <img class="vtr-shadow-static-hero__image" src="https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-750.webp" width="750" height="1001" alt="Apex West Midtown pool and apartment community" loading="eager" fetchpriority="high" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center center">
  <div class="vtr-shadow-static-hero__shade" aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(21,40,75,.14),rgba(21,40,75,.28) 52%,rgba(21,40,75,.48))"></div>
  <div class="vtr-shadow-static-hero__content" style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:15px;width:100%;max-width:350px;padding:58px 24px 34px">
    <p class="vtr-shadow-static-hero__kicker" style="margin:0;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:400;line-height:1.02;text-shadow:0 2px 14px rgba(0,0,0,.26)">Live Better. Live Easy.</p>
    <h1 class="vtr-shadow-static-hero__title" style="margin:0;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;line-height:1.35;text-shadow:0 1px 10px rgba(0,0,0,.34)">Studio, 1, 2, and 3 Bedroom Apartments in Atlanta, GA</h1>
    <a class="vtr-shadow-static-hero__button" href="/apartments/" style="display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 20px;border-radius:999px;background:#fff;color:#15284B;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;line-height:1;text-decoration:none;box-shadow:0 10px 24px rgba(0,0,0,.16)">Find Your Home</a>
  </div>
</section>`;
}

function buildCriticalJsBootstrap() {
  return `<script data-vtr-critical-js-bootstrap="uikit-lite">(function(){if(window.__vtrUikitLite)return;window.__vtrUikitLite=1;var queuedIcons=[];var queuedReady=[];var current=window.UIkit;function placeholder(){return{icon:{add:function(){queuedIcons.push(Array.prototype.slice.call(arguments));}},util:{ready:function(fn){if(typeof fn==="function")queuedReady.push(fn);},on:function(){},off:function(){}}}}function replay(real){if(!real||real.__vtrUikitLitePlaceholder)return;try{if(real.icon&&typeof real.icon.add==="function"){queuedIcons.splice(0).forEach(function(args){try{real.icon.add.apply(real.icon,args)}catch(e){}})}}catch(e){}try{if(real.util&&typeof real.util.ready==="function"){queuedReady.splice(0).forEach(function(fn){try{real.util.ready(fn)}catch(e){}})}else{queuedReady.splice(0).forEach(function(fn){try{if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",fn,{once:true})}else{fn()}}catch(e){}})}}catch(e){}}if(!current){current=placeholder();current.__vtrUikitLitePlaceholder=true}try{Object.defineProperty(window,"UIkit",{configurable:true,get:function(){return current},set:function(next){current=next;replay(next)}})}catch(e){window.UIkit=current}if(current&&!current.__vtrUikitLitePlaceholder)replay(current);})();</script>`;
}

function buildEdgeStaticShellHead() {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apex West Midtown Apartments in Atlanta, GA</title>
<meta name="description" content="Studio, 1, 2, and 3 bedroom apartments in Atlanta, GA at Apex West Midtown.">
<link rel="preload" as="image" href="https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-640.avif" type="image/avif" media="(max-width: 767px)" fetchpriority="high">
<link rel="preload" as="image" href="https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-1200.webp" media="(min-width: 768px)" fetchpriority="high">
<style data-vtr-edge-static-shell="1">
html{margin:0;padding:0;background:#fff;color:#15284B;font-family:Arial,Helvetica,sans-serif;line-height:1.5;text-size-adjust:100%}
body.vtr-edge-static-shell-body{margin:0;min-width:320px;background:#fff;color:#15284B;overflow-x:hidden}
.vtr-shell-skip{position:absolute;left:12px;top:-60px;z-index:10;background:#fff;color:#15284B;padding:8px 10px;border-radius:4px;text-decoration:none;font-weight:700}
.vtr-shell-skip:focus{top:12px}
.vtr-shell-promo{position:relative;z-index:3;background:#15284B;color:#fff}
.vtr-shell-promo summary{display:flex;align-items:center;justify-content:center;gap:12px;height:46px;padding:0 20px;box-sizing:border-box;cursor:pointer;list-style:none;color:#fff;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;text-align:center}
.vtr-shell-promo summary::-webkit-details-marker{display:none}
.vtr-shell-promo summary:after{content:"";width:10px;height:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px)}
.vtr-shell-promo[open] summary:after{transform:rotate(225deg) translateY(-2px)}
.vtr-shell-promo-panel{padding:52px 20px 58px;background:#fff;color:#15284B;text-align:center;box-shadow:0 16px 30px rgba(21,40,75,.18)}
.vtr-shell-promo-panel h2{margin:0 0 24px;color:#15284B;font-size:28px;font-weight:400;line-height:1.18;letter-spacing:0}
.vtr-shell-promo-panel p{margin:0 0 46px;color:#15284B;font-size:18px;font-style:italic;line-height:1.5}
.vtr-shell-promo-actions{display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap}
.vtr-shell-promo-panel a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 30px;border:2px solid transparent;border-radius:50px;color:#15284B;background:#fff;text-decoration:none;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px}
.vtr-shell-promo-panel a:first-child{background:#3D66B9;color:#fff;border-color:#3D66B9}
.vtr-shell-header{height:80px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:#fff;color:#15284B;border-bottom:1px solid rgba(21,40,75,.08)}
.vtr-shell-logo{font-size:10px;font-weight:600;line-height:16.25px;letter-spacing:2px;text-transform:uppercase;color:#15284B;text-decoration:none;white-space:nowrap}
.vtr-shell-actions{display:flex;align-items:center;gap:18px}
.vtr-shell-phone{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:#15284B;text-decoration:none}
.vtr-shell-phone svg{display:block;width:20px;height:20px;fill:currentColor}
.vtr-shell-apply{display:none;color:#15284B;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:1.5px}
.vtr-shell-tour{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 19px;border:2px solid #15284B;border-radius:50px;color:#15284B;background:#fff;text-decoration:none;font-size:11.5px;font-weight:900;letter-spacing:1.5px;line-height:40px}
.vtr-shell-menu{position:relative;width:40px;height:32px;border:0;background:transparent;color:#15284B;font-size:0;line-height:1}
.vtr-shell-menu:before,.vtr-shell-menu:after,.vtr-shell-menu span{content:"";position:absolute;left:5px;right:5px;height:3px;background:#15284B}
.vtr-shell-menu:before{top:7px}.vtr-shell-menu span{top:15px}.vtr-shell-menu:after{top:23px}
.vtr-shell-drawer{position:fixed;inset:0 0 auto auto;z-index:20;width:min(94vw,390px);min-height:100vh;padding:46px 30px 36px;background:#15284B;color:#fff;box-shadow:-20px 0 60px rgba(21,40,75,.22);transform:translateX(105%);transition:transform .18s ease;box-sizing:border-box;overflow:auto}
.vtr-shell-drawer[data-open="true"]{transform:translateX(0)}
.vtr-shell-drawer-close{display:flex;align-items:center;justify-content:center;width:40px;height:40px;margin:0 0 30px;border:0;background:transparent;color:#fff;border-radius:0;font-size:28px}
.vtr-shell-drawer nav{display:grid;gap:0;margin-top:0}
.vtr-shell-drawer a{display:block;padding:12px 0;color:#fff;text-decoration:none;font-size:24px;font-weight:700;line-height:1.25;letter-spacing:1.5px;border-bottom:0}
.vtr-shell-drawer-actions{display:flex;align-items:center;gap:10px;margin:34px 0 26px}
.vtr-shell-drawer-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 18px;border:2px solid rgba(255,255,255,.72);border-radius:50px;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;white-space:nowrap}
.vtr-shell-drawer-actions a:first-child{background:#fff;color:#15284B;border-color:#fff}
.vtr-shell-drawer-phone{display:block;color:#fff;font-size:17px;font-weight:900;line-height:1.4;letter-spacing:2px;text-decoration:none}
.vtr-shell-socials{display:flex;gap:22px;margin-top:26px}
.vtr-shell-socials a{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:2px solid #fff;border-radius:50%;font-size:22px;font-weight:900;line-height:1;letter-spacing:0}
.vtr-shell-hero{position:relative;display:flex;align-items:center;justify-content:center;height:calc(100svh - 126px);min-height:720px;max-height:900px;overflow:hidden;background:#15284B;color:#fff;text-align:center;contain:layout paint}
.vtr-shell-hero picture{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:hidden}
.vtr-shell-hero img{position:absolute;inset:0;width:100%;height:100%;min-width:100%;min-height:100%;max-width:none;display:block;object-fit:cover;object-position:center center}
.vtr-shell-hero:after{content:"";position:absolute;inset:0;background:rgba(21,40,75,.36)}
.vtr-shell-hero-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:100%;max-width:900px;padding:255px 15px 0;box-sizing:border-box}
.vtr-shell-rating{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 30px;color:#fff;font-size:13px;font-weight:900;line-height:18.2px;letter-spacing:2px;text-transform:uppercase}
.vtr-shell-stars{font-size:31px;line-height:1;letter-spacing:3px}
.vtr-shell-kicker{display:block;width:min(82vw,720px);height:auto;margin:0 0 10px;filter:drop-shadow(0 2px 14px rgba(0,0,0,.26))}
.vtr-shell-kicker img{display:block;width:100%;height:auto}
.vtr-shell-title{width:min(360px,100%);margin:0;color:#fff;font-size:19px;font-weight:700;line-height:26.6px;letter-spacing:.5px;text-shadow:0 1px 10px rgba(0,0,0,.34)}
.vtr-shell-cta{display:inline-flex;align-items:center;justify-content:center;min-height:50px;margin-top:40px;padding:0 20px;border-radius:50px;background:#fff;color:#14294B;font-size:14px;font-weight:900;letter-spacing:1.5px;line-height:46px;text-decoration:none;box-shadow:0 10px 24px rgba(0,0,0,.16)}
.vtr-shell-cta:after{content:"→";margin-left:10px;font-size:20px;line-height:1}
.vtr-shell-main{background:#fff}
.vtr-shell-panel{padding:70px 15px;background:#F6F6F5;color:#15284B}
.vtr-shell-panel-inner{max-width:1120px;margin:0 auto}
.vtr-shell-panel h2{margin:0 0 20px;color:#15284B;font-family:Georgia,"Times New Roman",serif;font-size:27px;line-height:35.1px;font-weight:700;letter-spacing:.5px}
.vtr-shell-panel p{margin:0 0 20px;color:#15284B;font-size:18px;line-height:29.25px}
.vtr-shell-panel-kicker{display:block;margin:0 0 14px;color:#15284B;font-size:18px;font-weight:700;line-height:29.25px}
.vtr-shell-panel-media{margin:26px 0 0;overflow:hidden;border-radius:0;background:#F6F6F5}
.vtr-shell-panel-media img{display:block;width:100%;height:auto}
.vtr-shell-panel-alt{background:#fff}
.vtr-shell-rest{display:block;width:100%;min-height:0;border:0;background:#fff}
.vtr-shell-rest-wrap{display:none;background:#fff}
.vtr-shell-rest-wrap[data-loaded="true"]{display:block}
.vtr-shell-rest-status{padding:24px 22px;color:#294782;font-size:14px;text-align:center;background:#F6F6F5}
.vtr-shell-more{display:grid;gap:0;background:#F6F6F5;color:#15284B}
.vtr-shell-band{padding:42px 22px;border-top:1px solid #D6D6D2;background:#F6F6F5}
.vtr-shell-band:nth-child(even){background:#fff}
.vtr-shell-band h2{margin:0 0 12px;color:#15284B;font-size:24px;line-height:1.15;font-weight:900}
.vtr-shell-band p{margin:0;color:#294782;font-size:15px;line-height:1.65}
@media (min-width:768px){.vtr-shell-apply{display:inline-flex}.vtr-shell-header{height:80px;padding:0 40px}.vtr-shell-logo{font-size:18px;line-height:24px;letter-spacing:3px}.vtr-shell-phone{width:auto;font-size:13px;font-weight:900;line-height:1;letter-spacing:1.5px}.vtr-shell-phone svg{display:none}.vtr-shell-phone:after{content:"(678) 949-9010"}.vtr-shell-tour{min-height:54px;padding:0 28px;font-size:13px;line-height:50px}.vtr-shell-menu{width:38px}.vtr-shell-hero{height:min(820px,calc(100svh - 80px));min-height:640px;max-height:820px}.vtr-shell-hero-content{padding-top:0;transform:translateY(20px)}.vtr-shell-rating{display:none}.vtr-shell-kicker{width:min(72vw,820px);margin-bottom:28px}.vtr-shell-title{width:auto;max-width:980px;font-size:28px;line-height:1.2}.vtr-shell-cta{min-height:62px;margin-top:34px;padding:0 32px;font-size:14px;line-height:58px}.vtr-shell-panel{padding:72px 56px}.vtr-shell-panel h2{font-size:42px;line-height:1.15}.vtr-shell-panel-grid{display:grid;grid-template-columns:1fr 1fr;gap:42px;align-items:center}.vtr-shell-panel-media{margin:0}.vtr-shell-panel-alt .vtr-shell-panel-media{order:-1}}
@media (min-width:1200px){.vtr-shell-hero{height:min(680px,calc(100svh - 80px));min-height:560px;max-height:720px}.vtr-shell-hero img{object-position:center center}.vtr-shell-kicker{width:min(68vw,900px)}.vtr-shell-title{font-size:30px}}
@media (max-width:520px){.vtr-shell-header{padding:0 15px}.vtr-shell-actions{gap:20px}.vtr-shell-hero{height:calc(100svh - 126px);min-height:720px;max-height:none}.vtr-shell-hero img{object-position:center top}.vtr-shell-hero-content{position:absolute;left:0;right:0;top:54%;transform:translateY(-42%);padding:0 15px}.vtr-shell-rating{margin:0 0 14px;font-size:12px;line-height:1.2}.vtr-shell-stars{font-size:22px;letter-spacing:2px}.vtr-shell-kicker{width:min(62vw,245px);margin-bottom:58px}.vtr-shell-title{width:min(92vw,365px);font-size:18px;line-height:1.35}.vtr-shell-cta{margin-top:30px}.vtr-shell-panel-media{margin-top:30px}}
</style>`;
}

function buildEdgeStaticShellBody() {
  return `<a class="vtr-shell-skip" href="#main">Skip to main content</a>
<details class="vtr-shell-promo">
  <summary>Now Offering Up To One Month Free</summary>
  <div class="vtr-shell-promo-panel">
    <h2>Now Offering Up To One Month Free</h2>
    <p>*Select Home. Limited Time Offer.</p>
    <div class="vtr-shell-promo-actions">
      <a href="/specials/">See Specials</a>
      <a href="https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/GA4AX" rel="noopener">Schedule A Tour</a>
    </div>
  </div>
</details>
<header class="vtr-shell-header">
  <a class="vtr-shell-logo" href="/">Apex West Midtown</a>
  <div class="vtr-shell-actions">
    <a class="vtr-shell-phone" href="tel:+16789499010" aria-label="Call Apex West Midtown"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg></a>
    <a class="vtr-shell-apply" href="https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/GA4AX" rel="noopener">Apply Now</a>
    <a class="vtr-shell-tour" href="https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/GA4AX" rel="noopener">Tour</a>
    <button class="vtr-shell-menu" type="button" aria-label="Open menu" aria-controls="vtr-shell-drawer" aria-expanded="false"><span></span></button>
  </div>
</header>
<aside class="vtr-shell-drawer" id="vtr-shell-drawer" aria-label="Mobile menu" data-open="false">
  <button class="vtr-shell-drawer-close" type="button" aria-label="Close menu">×</button>
  <nav>
    <a href="/apartments/">Apartments &amp; Pricing</a>
    <a href="/apartments/">Features</a>
    <a href="/amenities/">Amenities</a>
    <a href="/gallery/">Gallery</a>
    <a href="/neighborhood/">Location</a>
    <a href="/faqs/">FAQs</a>
    <a href="/reviews/">Reviews</a>
    <a href="/contact/">Contact</a>
    <a href="/specials/">Specials</a>
    <a href="https://venterraliving.com/" rel="noopener">About Venterra</a>
    <a href="https://venterra.com/smarthub/" rel="noopener">SMARTHUB</a>
  </nav>
  <div class="vtr-shell-drawer-actions">
    <a href="https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/GA4AX" rel="noopener">Schedule A Tour</a>
    <a href="https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/GA4AX" rel="noopener">Apply Now</a>
  </div>
  <a class="vtr-shell-drawer-phone" href="tel:+14709997073">(470) 999-7073</a>
  <div class="vtr-shell-socials" aria-label="Social links">
    <a href="https://www.facebook.com/ApexWestMidtown/" aria-label="Facebook" rel="noopener">f</a>
    <a href="https://www.instagram.com/apexwestmidtown/" aria-label="Instagram" rel="noopener">◎</a>
    <a href="https://www.google.com/maps/search/?api=1&query=Apex%20West%20Midtown" aria-label="Google Maps" rel="noopener">G</a>
  </div>
</aside>
<main id="main" class="vtr-shell-main" data-vtr-psi-mock="edge-static-shell">
  <section class="vtr-shell-hero" aria-label="Apex West Midtown hero">
    <picture>
      <source media="(min-width: 768px)" srcset="https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-1200.webp 1200w" sizes="100vw">
      <img src="https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-640.avif" srcset="https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-640.avif 640w" sizes="100vw" width="640" height="900" alt="Apex West Midtown pool and apartment community" loading="eager" fetchpriority="high" decoding="async">
    </picture>
    <div class="vtr-shell-hero-content">
      <div class="vtr-shell-rating" aria-label="4.6 star rating from 880 reviews"><span class="vtr-shell-stars" aria-hidden="true">★★★★★</span><span>(4.6) 880 Reviews</span></div>
      <div class="vtr-shell-kicker" role="img" aria-label="Live Better. Live Easy.">
        <img src="https://pilot.venterradev.com/wp-content/uploads/2026/07/lble.svg" width="841" height="202" alt="" aria-hidden="true" loading="eager" decoding="async">
      </div>
      <h1 class="vtr-shell-title">Studio, 1, 2, and 3 Bedroom Apartments in Atlanta, GA</h1>
      <a class="vtr-shell-cta" href="/apartments/">Find Your Home</a>
    </div>
  </section>
  <section class="vtr-shell-panel" aria-labelledby="vtr-shell-welcome-title">
    <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
      <div>
        <h2 id="vtr-shell-welcome-title">Welcome to Apex West Midtown</h2>
        <p><strong class="vtr-shell-panel-kicker">Choose the perfect layout for your lifestyle.</strong>In Atlanta's dynamic West Midtown, Apex West Midtown offers a refined urban retreat shaped by creativity, culture, and modern design. Surrounded by the energy of the Design District, this is a place where contemporary style and city vibrancy meet, creating a living experience that feels both elevated and authentically connected.</p>
      </div>
      <figure class="vtr-shell-panel-media">
        <img src="https://pilot.venterradev.com/wp-content/uploads/2026/07/Home-Welcome-640.avif" width="640" height="426" loading="lazy" decoding="async" alt="Apex West Midtown resident lounge and living space">
      </figure>
    </div>
  </section>
  <section class="vtr-shell-panel vtr-shell-panel-alt" aria-labelledby="vtr-shell-features-title">
    <div class="vtr-shell-panel-inner vtr-shell-panel-grid">
      <div>
        <h2 id="vtr-shell-features-title">Apartment Features Made for City Living</h2>
        <p>Find bright interiors, functional layouts, and convenient access to the spaces and services that make each day easier.</p>
      </div>
      <figure class="vtr-shell-panel-media">
        <img src="https://pilot.venterradev.com/wp-content/uploads/2026/07/Home-Features-900.avif" width="900" height="600" loading="lazy" decoding="async" alt="Apex West Midtown apartment interior features">
      </figure>
    </div>
  </section>
  <div class="vtr-shell-rest-wrap" id="vtr-shell-rest-wrap" data-loaded="false">
    <div class="vtr-shell-rest-status" id="vtr-shell-rest-status">Loading more of the homepage...</div>
    <iframe class="vtr-shell-rest" id="vtr-shell-rest" title="Apex West Midtown homepage details" loading="lazy"></iframe>
  </div>
</main>
<script data-vtr-edge-static-shell="interaction">(function(){var menu=document.querySelector('.vtr-shell-menu');var drawer=document.getElementById('vtr-shell-drawer');var close=document.querySelector('.vtr-shell-drawer-close');function setDrawer(open){if(!drawer||!menu)return;drawer.dataset.open=open?'true':'false';menu.setAttribute('aria-expanded',open?'true':'false')}if(menu)menu.addEventListener('click',function(){setDrawer(true)});if(close)close.addEventListener('click',function(){setDrawer(false)});document.addEventListener('keydown',function(e){if(e.key==='Escape')setDrawer(false)});var loaded=false;function loadRest(){if(loaded)return;loaded=true;var wrap=document.getElementById('vtr-shell-rest-wrap');var frame=document.getElementById('vtr-shell-rest');var status=document.getElementById('vtr-shell-rest-status');if(!wrap||!frame)return;wrap.dataset.loaded='true';frame.src='/?edge_shell_rest=1';frame.addEventListener('load',function(){try{var doc=frame.contentDocument;if(doc){var style=doc.createElement('style');style.textContent='.tm-header,.tm-header-mobile,[data-page-section=\"hero\"],[data-page-section=\"welcome\"],[data-page-section=\"apartment_features\"],#wpadminbar{display:none!important}html,body{margin:0!important;padding:0!important;overflow-x:hidden!important}';doc.head.appendChild(style);setTimeout(function(){try{frame.style.height=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight)+'px';if(status)status.style.display='none'}catch(e){}},500)}}catch(e){if(status)status.textContent='Continue exploring below.'}}, {once:true})}function check(){if((window.scrollY||document.documentElement.scrollTop||0)>520)loadRest()}addEventListener('scroll',check,{passive:true});addEventListener('pointerdown',function(e){if(e.target&&e.target.closest&&e.target.closest('.vtr-shell-menu,.vtr-shell-drawer'))return;loadRest()},{once:true,passive:true});addEventListener('focusin',loadRest,{once:true});})();</script>`;
}

function addStaticHeroPocRewriter(rewriter, config = RESI_STATIC_HERO_POC_CONFIG) {
  const state = {
    rootMatched: false,
    frameMatched: false,
    itemsMatched: false,
    itemMatched: false
  };
  return rewriter
    .on("head", new ResiStaticHeroPocHeadHandler(config))
    .on("div", new ResiStaticHeroPocDivHandler(state, config))
    .on("picture", new ResiStaticHeroPocPictureHandler(state))
    .on("img", new ResiStaticHeroPocImageHandler(state));
}

class ResiStaticHeroPocHeadHandler {
  constructor(config) {
    this.config = config;
  }

  element(element) {
    element.append(buildStaticHeroPocCss(this.config), { html: true });
  }
}

class ResiStaticHeroPocDivHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    const id = element.getAttribute("id") || "";
    const className = element.getAttribute("class") || "";

    if (id === this.config.heroId && element.getAttribute("uk-slideshow") !== null) {
      element.removeAttribute("uk-slideshow");
      element.setAttribute("data-vtr-static-hero-poc", "root");
      element.setAttribute("class", addClassName(className, "vtr-static-hero-poc"));
      this.state.rootMatched = true;
      return;
    }

    if (
      this.state.rootMatched &&
      !this.state.frameMatched &&
      className.includes("uk-position-relative")
    ) {
      element.setAttribute("data-vtr-static-hero-poc", "frame");
      element.setAttribute(
        "style",
        appendStyle(element.getAttribute("style") || "", "height:100%!important;")
      );
      this.state.frameMatched = true;
      return;
    }

    if (
      this.state.rootMatched &&
      !this.state.itemsMatched &&
      className.includes("uk-slideshow-items")
    ) {
      element.removeAttribute("uk-height-viewport");
      element.setAttribute("data-vtr-static-hero-poc", "items");
      element.setAttribute("class", addClassName(className, "vtr-static-hero-poc-items"));
      this.state.itemsMatched = true;
      return;
    }

    if (
      this.state.itemsMatched &&
      !this.state.itemMatched &&
      className.includes("el-item")
    ) {
      element.setAttribute("data-vtr-static-hero-poc", "item");
      element.setAttribute(
        "class",
        addClassName(addClassName(className, "vtr-static-hero-poc-item"), "uk-active")
      );
      element.setAttribute(
        "style",
        appendStyle(
          element.getAttribute("style") || "",
          "display:block!important;visibility:visible!important;opacity:1!important;transform:none!important;"
        )
      );
      this.state.itemMatched = true;
    }
  }
}

class ResiStaticHeroPocPictureHandler {
  constructor(state) {
    this.state = state;
    this.pictureMatched = false;
  }

  element(element) {
    if (!this.state.itemMatched || this.pictureMatched) return;

    element.setAttribute("data-vtr-static-hero-poc", "picture");
    element.setAttribute(
      "style",
      appendStyle(
        element.getAttribute("style") || "",
        "position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;"
      )
    );
    this.pictureMatched = true;
  }
}

class ResiStaticHeroPocImageHandler {
  constructor(state) {
    this.state = state;
  }

  element(element) {
    if (!this.state.itemMatched) return;
    if (element.getAttribute("data-edge-hero-mobile") !== "img") return;

    element.removeAttribute("uk-cover");
    element.setAttribute("data-vtr-static-hero-poc", "img");
    element.setAttribute("loading", "eager");
    element.setAttribute("fetchpriority", "high");
    element.setAttribute("decoding", "async");
    element.setAttribute(
      "style",
      appendStyle(
        element.getAttribute("style") || "",
        "position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center center!important;"
      )
    );
  }
}

function addClassName(className, nextClass) {
  const values = new Set((className || "").split(/\s+/).filter(Boolean));
  values.add(nextClass);
  return Array.from(values).join(" ");
}

function appendStyle(style, addition) {
  const trimmed = (style || "").trim();
  if (!trimmed) return addition;
  return `${trimmed.replace(/;?$/, ";")}${addition}`;
}

function buildStaticHeroPocCss(config = RESI_STATIC_HERO_POC_CONFIG) {
  const attr = `[data-vtr-static-hero-poc]`;
  return `<style data-vtr-static-hero-poc="1">
${attr}[data-vtr-static-hero-poc="root"]{position:relative;overflow:hidden;height:calc(100svh - 126px);min-height:620px;background:#15284B}
${attr}[data-vtr-static-hero-poc="frame"]{height:100%!important}
${attr}[data-vtr-static-hero-poc="items"]{position:relative!important;height:100%!important;min-height:0!important;overflow:hidden!important}
${attr}[data-vtr-static-hero-poc="item"]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;opacity:1!important;transform:none!important}
${attr}[data-vtr-static-hero-poc="picture"],${attr}[data-vtr-static-hero-poc="img"]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important}
${attr}[data-vtr-static-hero-poc="img"]{object-fit:cover!important;object-position:center center!important}
${attr}[data-vtr-static-hero-poc="item"]>.uk-position-cover{z-index:1}
${attr}[data-vtr-static-hero-poc="item"]>.uk-position-cover.uk-flex{z-index:2;text-align:center}
${attr}[data-vtr-static-hero-poc="item"] .el-overlay{max-width:min(90vw,980px)}
@media (max-width:767px){${attr}[data-vtr-static-hero-poc="root"]{height:calc(100svh - 126px);min-height:620px}${attr}[data-vtr-static-hero-poc="item"]>.uk-position-cover.uk-flex{padding-left:22px;padding-right:22px}}
</style>`;
}

function shouldApplyPerformanceOptimization(request, response, config = RESI_PERFORMANCE_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;
  if (!config.pathExact.includes(pathname)) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function shouldApplyPerformanceHtmlRewrite(request, config = RESI_PERFORMANCE_CONFIG) {
  if (!config.enabled) return false;
  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;
  if (!config.pathExact.includes(url.pathname.toLowerCase())) return false;

  if (url.pathname === "/" && config.headHeroPreloadEnabled) return true;
  if (url.pathname === "/" && config.heroBackgroundRewriteEnabled) return true;
  if (url.pathname === "/apartments/" && config.apartmentImageHintsEnabled) return true;
  return false;
}

function applyPerformanceHeaders(request, headers, config = RESI_PERFORMANCE_CONFIG) {
  const url = new URL(request.url);
  const links = [];

  if (url.pathname === "/" && config.headerHeroPreloadEnabled) {
    links.push(`<${config.homeHeroImageUrl}>; rel=preload; as=image; fetchpriority=high`);
  }

  for (const link of links) {
    headers.append("Link", link);
  }

  if (links.length > 0) {
    headers.append("Server-Timing", 'vtr_edge_preload;desc="hero-preload-only"');
  }
}

function addPerformanceRewriter(rewriter, request, config = RESI_PERFORMANCE_CONFIG) {
  const url = new URL(request.url);
  const state = {
    pathname: url.pathname,
    damImageCount: 0
  };

  if (config.headHeroPreloadEnabled) {
    rewriter = rewriter.on("head", new ResiPerformanceHeadHandler(state, config));
  }
  if (config.heroBackgroundRewriteEnabled) {
    rewriter = rewriter.on("div", new ResiPerformanceDivHandler(state, config));
  }
  if (config.apartmentImageHintsEnabled) {
    rewriter = rewriter.on("img", new ResiPerformanceImageHandler(state, config));
  }
  return rewriter;
}

class ResiPerformanceHeadHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    element.prepend(buildPerformanceHeadHints(this.state, this.config), { html: true });
  }
}

class ResiPerformanceDivHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    if (this.state.pathname !== "/") return;

    const dataSrc = element.getAttribute("data-src");
    if (dataSrc !== this.config.homeHeroImageUrl) return;

    const existingStyle = element.getAttribute("style") || "";
    if (!/background-image\s*:/i.test(existingStyle)) {
      const separator = existingStyle.trim().endsWith(";") || existingStyle.trim() === "" ? "" : ";";
      element.setAttribute(
        "style",
        `${existingStyle}${separator}background-image:url('${this.config.homeHeroImageUrl}')`
      );
    }
    element.removeAttribute("data-src");
    element.removeAttribute("uk-img");
    element.removeAttribute("loading");
    element.setAttribute("data-edge-lcp-bg", "inline");
  }
}

class ResiPerformanceImageHandler {
  constructor(state, config) {
    this.state = state;
    this.config = config;
  }

  element(element) {
    if (this.state.pathname !== "/apartments/") return;

    const src = element.getAttribute("src") || "";
    if (!src.startsWith(`${this.config.damOrigin}/`)) return;

    this.state.damImageCount += 1;
    element.setAttribute("decoding", "async");

    if (this.state.damImageCount <= this.config.apartmentEagerDamImages) {
      element.setAttribute("loading", "eager");
      element.setAttribute("fetchpriority", "high");
      return;
    }

    element.setAttribute("loading", "lazy");
    element.setAttribute("fetchpriority", "low");
  }
}

function buildPerformanceHeadHints(state, config = RESI_PERFORMANCE_CONFIG) {
  const hints = [];

  if (state.pathname === "/" && config.headHeroPreloadEnabled) {
    hints.push(
      `<link rel="preload" as="image" href="${config.homeHeroImageUrl}" fetchpriority="high" data-edge-perf="home-hero-preload">`
    );
  }

  return hints.join("");
}

function shouldInject(request, response, state = {}, config = EDGE_MESSAGE_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  const hostnameAllowed = config.hostnames.includes(url.hostname);
  if (!hostnameAllowed) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) {
    return false;
  }
  const exactPaths = config.pathExact || [];
  if (exactPaths.length > 0 && !exactPaths.includes(pathname)) return false;
  if (
    exactPaths.length === 0 &&
    !config.pathIncludes.some((path) => pathname.startsWith(path))
  ) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return false;

  if (state.forceDisplay || state.resetStorage || config.ignoreFrequencyCap) return true;

  const cookieHeader = request.headers.get("cookie") || "";
  return !hasSeenCookie(cookieHeader, config);
}

function shouldInjectConsentNotice(request, response, config = ZARAZ_CONSENT_NOTICE_CONFIG) {
  if (!config.enabled) return false;
  if (request.method !== "GET") return false;
  if (response.status < 200 || response.status >= 300) return false;

  const url = new URL(request.url);
  if (!config.hostnames.includes(url.hostname)) return false;

  const pathname = url.pathname.toLowerCase();
  if (config.pathExcludes.some((path) => pathname.startsWith(path))) return false;
  if (config.assetExtensions.some((extension) => pathname.endsWith(extension))) return false;

  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

function isZarazConsentUnresolvedReportRequest(request, config = ZARAZ_CONSENT_NOTICE_CONFIG) {
  const url = new URL(request.url);
  return config.hostnames.includes(url.hostname) && url.pathname === config.unresolvedReportPath;
}

async function handleZarazConsentUnresolvedReport(request, env, config = ZARAZ_CONSENT_NOTICE_CONFIG) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers
    });
  }
  if (!config.enabled) {
    return new Response(JSON.stringify({ ok: false, error: "disabled" }), { status: 404, headers });
  }

  let payload = {};
  try {
    const raw = await request.text();
    if (raw.length > 16384) {
      return new Response(JSON.stringify({ ok: false, error: "payload_too_large" }), {
        status: 413,
        headers
      });
    }
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers
    });
  }

  const report = sanitizeZarazConsentUnresolvedReport(request, payload, config);
  if (env?.POP_BRIEF_DB) {
    try {
      await ensureZarazConsentUnresolvedTable(env.POP_BRIEF_DB);
      await env.POP_BRIEF_DB
        .prepare(
          `INSERT INTO zaraz_consent_unresolved_reports (
             id,
             created_at,
             hostname,
             property_code,
             community_id,
             property_name,
             report_reason,
             page_path,
             page_title,
             queue_size,
             events_json,
             consent_json,
             referrer_host,
             user_agent_family
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          report.id,
          report.created_at,
          report.hostname,
          report.property_code,
          report.community_id,
          report.property_name,
          report.report_reason,
          report.page_path,
          report.page_title,
          report.queue_size,
          JSON.stringify(report.events),
          JSON.stringify(report.consent),
          report.referrer_host,
          report.user_agent_family
        )
        .run();
    } catch (error) {
      console.warn("Zaraz unresolved consent report write failed", error?.message || error);
      return new Response(JSON.stringify({ ok: false, error: "write_failed" }), {
        status: 202,
        headers
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 202, headers });
}

async function ensureZarazConsentUnresolvedTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS zaraz_consent_unresolved_reports (
         id TEXT PRIMARY KEY,
         created_at TEXT NOT NULL,
         hostname TEXT NOT NULL,
         property_code TEXT,
         community_id TEXT,
         property_name TEXT,
         report_reason TEXT,
         page_path TEXT,
         page_title TEXT,
         queue_size INTEGER NOT NULL,
         events_json TEXT NOT NULL,
         consent_json TEXT,
         referrer_host TEXT,
         user_agent_family TEXT
       )`
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_zaraz_consent_unresolved_created_at ON zaraz_consent_unresolved_reports(created_at)"
    )
    .run();
}

function sanitizeZarazConsentUnresolvedReport(request, payload, config) {
  const url = new URL(request.url);
  const events = Array.isArray(payload.events)
    ? payload.events.slice(0, config.unresolvedReportMaxEvents || 30).map(sanitizeQueuedInteraction)
    : [];
  const consent = sanitizeConsentSnapshot(payload.consent);
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    hostname: url.hostname,
    property_code: config.propertyCode || "",
    community_id: config.communityId || "",
    property_name: config.propertyName || "",
    report_reason: sanitizeToken(payload.reason, "unknown"),
    page_path: sanitizePath(payload.page_path || payload.pagePath || ""),
    page_title: sanitizeText(payload.page_title || payload.pageTitle || "", 160),
    queue_size: events.length,
    events,
    consent,
    referrer_host: referrerHost(request.headers.get("referer") || request.headers.get("referrer") || ""),
    user_agent_family: userAgentFamily(request.headers.get("user-agent") || "")
  };
}

function sanitizeQueuedInteraction(event) {
  const ts = Number(event?.ts);
  return {
    event_type: sanitizeToken(event?.event_type || event?.eventType || "unknown", "unknown"),
    ts: Number.isFinite(ts) && ts > 0 ? Math.round(ts) : null,
    page_path: sanitizePath(event?.page_path || ""),
    page_title: sanitizeText(event?.page_title || "", 120),
    cta_text: sanitizeText(event?.cta_text || "", 120),
    cta_href: sanitizeUrlForReport(event?.cta_href || ""),
    source: sanitizeToken(event?.source || "preconsent_session_queue", "preconsent_session_queue")
  };
}

function sanitizeConsentSnapshot(consent) {
  if (!consent || typeof consent !== "object" || Array.isArray(consent)) return {};
  return Object.fromEntries(
    Object.entries(consent)
      .slice(0, 20)
      .map(([key, value]) => [sanitizeToken(key, "purpose"), value === true])
  );
}

function sanitizeToken(value, fallback) {
  const token = String(value || "").toLowerCase().replace(/[^a-z0-9_:-]/g, "_").slice(0, 64);
  return token || fallback;
}

function sanitizePath(value) {
  const text = String(value || "");
  try {
    const parsed = new URL(text, "https://example.com");
    return parsed.pathname.slice(0, 240) || "/";
  } catch (error) {
    const path = text.split("?")[0].split("#")[0];
    return (path.startsWith("/") ? path : "/").slice(0, 240);
  }
}

function sanitizeText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeUrlForReport(value) {
  const text = String(value || "");
  if (!text) return "";
  try {
    const parsed = new URL(text, "https://example.com");
    return `${parsed.origin}${parsed.pathname}`.slice(0, 300);
  } catch (error) {
    return sanitizePath(text);
  }
}

function referrerHost(value) {
  try {
    return value ? new URL(value).hostname.slice(0, 120) : "";
  } catch (error) {
    return "";
  }
}

function userAgentFamily(userAgent) {
  const ua = String(userAgent || "");
  if (/Edg\//i.test(ua)) return "edge";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "safari";
  if (/Firefox\//i.test(ua)) return "firefox";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "other";
}

function hasSeenCookie(cookieHeader, config = EDGE_MESSAGE_CONFIG) {
  return hasCookie(cookieHeader, config.cookieName, config.id);
}

async function getPublishedEdgeConfig(env, fallbackConfig) {
  if (!env?.POP_BRIEF_DB) return fallbackConfig;
  try {
    const row = await env.POP_BRIEF_DB
      .prepare(
        `SELECT config_json
         FROM edge_experiment_config_versions
         WHERE experiment_id = ? AND config_status = 'active'
         ORDER BY config_version DESC
         LIMIT 1`
      )
      .bind(fallbackConfig.id)
      .first();
    if (!row?.config_json) return fallbackConfig;
    const published = JSON.parse(row.config_json);
    if (!published || typeof published !== "object" || Array.isArray(published)) return fallbackConfig;
    const merged = { ...fallbackConfig, ...published };
    if (!Array.isArray(merged.hostnames)) merged.hostnames = fallbackConfig.hostnames;
    if (!Array.isArray(merged.pathExact)) merged.pathExact = fallbackConfig.pathExact;
    if (!Array.isArray(merged.pathIncludes)) merged.pathIncludes = fallbackConfig.pathIncludes;
    if (!Array.isArray(merged.pathExcludes)) merged.pathExcludes = fallbackConfig.pathExcludes;
    if (!Array.isArray(merged.assetExtensions)) merged.assetExtensions = fallbackConfig.assetExtensions;
    return merged;
  } catch (error) {
    console.warn("Edge Message D1 config lookup failed", fallbackConfig.id, error?.message || error);
    return fallbackConfig;
  }
}

function hasCookie(cookieHeader, cookieName, id = EDGE_MESSAGE_CONFIG.id) {
  const expected = `${cookieName}=${id}`;
  return cookieHeader.split(";").some((cookie) => cookie.trim() === expected);
}

function buildBootstrapScript(config, state = {}) {
  const payload = JSON.stringify({
    id: config.id,
    configVersion: config.configVersion,
    initiative: config.initiative,
    cookieName: config.cookieName,
    ignoreFrequencyCap: config.ignoreFrequencyCap,
    cookieMaxAgeSeconds: config.cookieMaxAgeSeconds,
    forceParam: config.forceParam,
    resetParam: config.resetParam,
    showDelayMs: config.showDelayMs,
    mobileAfterLoadDelayMs: config.mobileAfterLoadDelayMs || 0,
    mobileAfterLoadIdleTimeoutMs: config.mobileAfterLoadIdleTimeoutMs || 2500,
    mobileScrollTriggerEnabled: Boolean(config.mobileScrollTriggerEnabled),
    mobileScrollTriggerPx: config.mobileScrollTriggerPx || 360,
    mobileScrollTriggerDelayMs: config.mobileScrollTriggerDelayMs || 350,
    durationMs: config.durationMs,
    fadeMs: config.fadeMs,
    waitForUnitSelectors: config.waitForUnitSelectors,
    brandName: config.brandName,
    brandLogoSvg: buildVenterraLogoSvg(),
    propertyCode: config.propertyCode,
    communityId: config.communityId,
    propertyName: config.propertyName,
    brandColor: config.brandColor,
    titleColor: config.titleColor,
    bodyColor: config.bodyColor,
    disclaimerColor: config.disclaimerColor,
    propertyNameFontSizePx: config.propertyNameFontSizePx,
    titleFontSizePx: config.titleFontSizePx,
    bodyFontSizePx: config.bodyFontSizePx,
    disclaimerFontSizePx: config.disclaimerFontSizePx,
    countdownFontSizePx: config.countdownFontSizePx,
    title: config.title,
    body: config.body,
    disclaimer: config.disclaimer,
    ctaLabel: config.ctaLabel || "",
    ctaHref: config.ctaHref || "",
    autoCloseTextPrefix: config.autoCloseTextPrefix,
    closeLabel: config.closeLabel,
    analyticsEnabled: config.analyticsEnabled,
    forceDisplay: Boolean(state.forceDisplay),
    resetStorage: Boolean(state.resetStorage)
  }).replace(/</g, "\\u003c");

  return `<script data-edge-message="${escapeAttribute(config.id)}">(function(){const c=${payload};const storageKey="v_edge_msg_seen_"+c.id;if(c.resetStorage)try{localStorage.removeItem(storageKey)}catch(e){}let seen=false;try{seen=!!localStorage.getItem(storageKey)}catch(e){}if(seen&&!c.forceDisplay&&!c.ignoreFrequencyCap)return;function idle(fn,timeout){if("requestIdleCallback"in window){requestIdleCallback(fn,{timeout:timeout});return}setTimeout(fn,120)}function afterLoad(fn){if(document.readyState==="complete"){idle(fn,c.mobileAfterLoadIdleTimeoutMs);return}addEventListener("load",()=>idle(fn,c.mobileAfterLoadIdleTimeoutMs),{once:true})}function waitForScroll(fn){let done=false;const cleanup=()=>{removeEventListener("scroll",check,{passive:true});removeEventListener("touchmove",check,{passive:true});removeEventListener("wheel",check,{passive:true})};const fire=()=>{if(done)return;done=true;cleanup();setTimeout(fn,c.mobileScrollTriggerDelayMs)};const check=()=>{const y=window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0;if(y>=c.mobileScrollTriggerPx)fire()};addEventListener("scroll",check,{passive:true});addEventListener("touchmove",check,{passive:true});addEventListener("wheel",check,{passive:true});check()}function ready(fn){const run=()=>{if(c.mobileScrollTriggerEnabled){waitForScroll(fn);return}if(c.mobileAfterLoadDelayMs>0){afterLoad(()=>setTimeout(fn,c.mobileAfterLoadDelayMs));return}idle(fn,1800)};document.readyState==="loading"?addEventListener("DOMContentLoaded",run,{once:true}):run()}function waitForUnits(fn){const selector=".fs-switcher__items-container,.re-list-availability,[data-has_availability='true']";if(document.querySelector(selector)){fn();return}let tries=0;const timer=setInterval(()=>{tries+=1;if(document.querySelector(selector)||tries>=20){clearInterval(timer);fn()}},150)}function eventPayload(extra){return Object.assign({message_id:c.id,property_code:c.propertyCode,community_id:c.communityId,property_name:c.propertyName,source:"cloudflare_worker",config_version:c.configVersion,path:location.pathname},extra||{})}function push(eventName,extra){if(!c.analyticsEnabled)return;const payload=eventPayload(extra);window.dataLayer=window.dataLayer||[];window.dataLayer.push(Object.assign({event:eventName},payload));if(typeof window.gtag==="function")window.gtag("event",eventName,payload);if(window.heap&&typeof window.heap.track==="function")window.heap.track(eventName,payload);else{window.heap=window.heap||[];if(Array.isArray(window.heap))window.heap.push(["track",eventName,payload])}}function markSeen(){if(c.ignoreFrequencyCap)return;const maxAge=c.cookieMaxAgeSeconds;document.cookie=c.cookieName+"="+c.id+"; Max-Age="+maxAge+"; Path=/; Secure; SameSite=Lax";try{localStorage.setItem(storageKey,String(Date.now()))}catch(e){}}ready(()=>{const launch=()=>setTimeout(show,c.showDelayMs);c.waitForUnitSelectors?waitForUnits(launch):launch()});function show(){if(document.getElementById("v-edge-msg-overlay"))return;const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;const style=document.createElement("style");style.id="v-edge-msg-style";style.textContent=\`
#v-edge-msg-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:22px;background:rgba(11,18,32,.28);opacity:0;pointer-events:none;transition:opacity \${reduce?1:c.fadeMs}ms ease;font-family:Inter,Arial,sans-serif}
#v-edge-msg-overlay.v-edge-visible{opacity:1}
#v-edge-msg-card{position:relative;width:min(92vw,560px);box-sizing:border-box;border-radius:18px;background:#fff;color:#182033;box-shadow:0 24px 76px rgba(15,23,42,.25);padding:28px 38px 24px;opacity:0;pointer-events:auto;transform:translateY(10px) scale(.985);transition:opacity \${reduce?1:c.fadeMs}ms ease,transform \${reduce?1:c.fadeMs}ms ease}
#v-edge-msg-overlay.v-edge-visible #v-edge-msg-card{opacity:1;transform:none}
#v-edge-msg-close{position:absolute;right:20px;top:18px;width:36px;height:36px;border:0;border-radius:999px;background:transparent;color:#637083;font-size:32px;line-height:1;cursor:pointer}
#v-edge-msg-close:hover,#v-edge-msg-close:focus-visible{background:#eef2f7;outline:2px solid transparent}
#v-edge-msg-property{margin:0 44px 26px;text-align:center;color:\${c.bodyColor||"#4b5565"};font-size:\${c.propertyNameFontSizePx||18}px;font-weight:800;line-height:1.2}
#v-edge-msg-title{margin:0 auto;text-align:center;color:\${c.titleColor||"#050817"};font-size:\${c.titleFontSizePx||44}px;line-height:1.16;font-weight:950;letter-spacing:0;white-space:pre-line;max-width:470px}
#v-edge-msg-body{margin:28px auto 20px;text-align:center;color:\${c.bodyColor||"#4b5565"};font-size:\${c.bodyFontSizePx||24}px;line-height:1.52;max-width:455px}
#v-edge-msg-disclaimer{margin:0 auto 28px;text-align:center;color:\${c.disclaimerColor||"#667388"};font-size:\${c.disclaimerFontSizePx||16}px;line-height:1.55;font-weight:800;max-width:420px}
#v-edge-msg-cta{display:flex;align-items:center;justify-content:center;width:fit-content;max-width:100%;margin:4px auto 24px;min-height:48px;border-radius:999px;background:\${c.brandColor};color:#fff;text-align:center;text-decoration:none;font-size:16px;font-weight:900;letter-spacing:0;padding:0 26px;box-shadow:0 12px 26px rgba(21,40,75,.24)}
#v-edge-msg-cta:hover,#v-edge-msg-cta:focus-visible{background:#294782;outline:3px solid rgba(61,102,185,.28);outline-offset:2px}
#v-edge-msg-countdown{margin:0 0 16px;text-align:center;color:\${c.disclaimerColor||"#9B9B96"};font-size:\${c.countdownFontSizePx||20}px;font-weight:900}
#v-edge-msg-progress{height:8px;overflow:hidden;border-radius:999px;background:#D6D6D2}
#v-edge-msg-progress span{display:block;height:100%;width:100%;border-radius:inherit;background:\${c.disclaimerColor||"#9B9B96"};transform-origin:left center;animation:vEdgeProgress \${c.durationMs}ms linear forwards}
#v-edge-msg-brand{display:flex;align-items:center;justify-content:center;margin:22px auto 0;color:\${c.brandColor}}
#v-edge-msg-brand svg{width:172px;max-width:54%;height:auto;display:block}
@keyframes vEdgeProgress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion: reduce){#v-edge-msg-overlay,#v-edge-msg-card{transition:none!important}#v-edge-msg-progress span{animation:none!important}}
@media (max-width:520px){#v-edge-msg-card{width:min(94vw,430px);padding:26px 22px 22px;border-radius:16px}#v-edge-msg-close{right:12px;top:12px;font-size:28px}#v-edge-msg-property{margin:0 38px 22px;font-size:16px}#v-edge-msg-title{font-size:clamp(28px,8.8vw,38px)}#v-edge-msg-body{margin-top:24px;font-size:17px;line-height:1.48}#v-edge-msg-disclaimer{font-size:13px;margin-bottom:24px}#v-edge-msg-cta{width:100%;box-sizing:border-box}#v-edge-msg-countdown{font-size:18px}#v-edge-msg-brand svg{max-width:62%}}\`;const overlay=document.createElement("div");overlay.id="v-edge-msg-overlay";const cta=c.ctaLabel&&c.ctaHref?\`<a id="v-edge-msg-cta" href="\${escapeAttribute(c.ctaHref)}">\${escapeHtml(c.ctaLabel)}</a>\`:"";overlay.innerHTML=\`<section id="v-edge-msg-card" role="region" aria-labelledby="v-edge-msg-title" aria-describedby="v-edge-msg-body"><button id="v-edge-msg-close" type="button" aria-label="\${escapeHtml(c.closeLabel)}">&times;</button><p id="v-edge-msg-property">\${escapeHtml(c.propertyName)}</p><h2 id="v-edge-msg-title">\${escapeHtml(c.title)}</h2><p id="v-edge-msg-body">\${escapeHtml(c.body)}</p><p id="v-edge-msg-disclaimer">\${escapeHtml(c.disclaimer)}</p>\${cta}<p id="v-edge-msg-countdown" aria-live="polite"></p><div id="v-edge-msg-progress" aria-hidden="true"><span></span></div><div id="v-edge-msg-brand">\${c.brandLogoSvg}</div></section>\`;document.head.appendChild(style);document.body.appendChild(overlay);const close=overlay.querySelector("#v-edge-msg-close");const ctaLink=overlay.querySelector("#v-edge-msg-cta");const countdown=overlay.querySelector("#v-edge-msg-countdown");let remaining=Math.ceil(c.durationMs/1000);let dismissed=false;function setCountdown(){countdown.textContent=c.autoCloseTextPrefix+" "+remaining+" second"+(remaining===1?"":"s")}setCountdown();const interval=setInterval(()=>{remaining=Math.max(0,remaining-1);setCountdown()},1000);const timeout=setTimeout(()=>dismiss("auto"),c.durationMs);function dismiss(type){if(dismissed)return;dismissed=true;clearInterval(interval);clearTimeout(timeout);markSeen();push("edge_message_dismiss",{dismiss_type:type});overlay.classList.remove("v-edge-visible");setTimeout(()=>{overlay.remove();style.remove()},reduce?1:c.fadeMs+40)}close.addEventListener("click",()=>dismiss("x"));if(ctaLink)ctaLink.addEventListener("click",()=>{markSeen();push("edge_message_cta_click",{cta_href:c.ctaHref,cta_label:c.ctaLabel,initiative:c.initiative})});document.addEventListener("keydown",function keyHandler(event){if(dismissed){document.removeEventListener("keydown",keyHandler);return}if(event.key==="Escape")dismiss("escape")});requestAnimationFrame(()=>{overlay.classList.add("v-edge-visible");push("edge_message_view",{initiative:c.initiative})})}function escapeHtml(value){return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}function escapeAttribute(value){return escapeHtml(value).replace(/\\x60/g,"&#96;")}})();</script>`;
}

function buildZarazConsentNoticeScript(config = ZARAZ_CONSENT_NOTICE_CONFIG) {
  return renderZarazConsentPillScript();
}


function buildZarazConsentInteractionQueueScript(config = ZARAZ_CONSENT_NOTICE_CONFIG) {
  const payload = JSON.stringify({
    noticeStorageKey: config.storageKey,
    queueKey: config.interactionQueueKey,
    queueMax: config.interactionQueueMax,
    queueTtlMs: config.interactionQueueTtlMs,
    trackEventName: config.interactionTrackEventName,
    reportEndpoint: config.unresolvedReportPath
  }).replace(/</g, "\\u003c");

  return `<script data-vtr-zaraz-consent-interaction-queue="1">(function(){const c=${payload};if(window.__vtrZarazConsentInteractionQueue)return;window.__vtrZarazConsentInteractionQueue=true;let queuedPageview=false;let reportedUnresolved=false;let suppressHideUntil=0;function now(){return Date.now()}function readQueue(){try{const raw=sessionStorage.getItem(c.queueKey);const data=raw?JSON.parse(raw):[];if(!Array.isArray(data))return [];const cutoff=now()-c.queueTtlMs;return data.filter(function(item){return item&&item.ts>=cutoff})}catch(e){return []}}function writeQueue(queue){try{sessionStorage.setItem(c.queueKey,JSON.stringify(queue.slice(-c.queueMax)))}catch(e){}}function clearQueue(){try{sessionStorage.removeItem(c.queueKey)}catch(e){}}function hasStoredDecision(){try{return localStorage.getItem(c.noticeStorageKey)==="1"}catch(e){return false}}function getConsent(){return window.zaraz&&window.zaraz.consent}function getChoices(){const z=getConsent();return z&&typeof z.getAll==="function"?z.getAll():null}function hasGrantedConsent(){const choices=getChoices();return !!choices&&Object.values(choices).some(function(value){return value===true})}function isRejectedDecision(){const choices=getChoices();return hasStoredDecision()&&!!choices&&Object.values(choices).every(function(value){return value===false})}function isUndecided(){if(hasGrantedConsent()||hasStoredDecision())return false;const choices=getChoices();if(!choices)return true;return Object.values(choices).every(function(value){return value===false})}function cleanUrl(value){try{const u=new URL(value,location.href);return u.origin+u.pathname}catch(e){return String(value||"").split("?")[0].slice(0,240)}}function labelFor(el){return (el.getAttribute("aria-label")||el.textContent||el.value||"").replace(/\\s+/g," ").trim().slice(0,120)}function classify(el){const href=el.href||el.getAttribute("href")||"";const text=labelFor(el);const haystack=(text+" "+href).toLowerCase();if(haystack.indexOf("schedule")!==-1&&haystack.indexOf("tour")!==-1)return "schedule_tour_click";if(haystack.indexOf("createpipelineapplication")!==-1||haystack.indexOf("apply now")!==-1)return "apply_now_click";if(haystack.indexOf("find your home")!==-1||haystack.indexOf("/apartments")!==-1)return "find_home_click";if(haystack.indexOf("tel:")!==-1||haystack.indexOf("call:")!==-1)return "phone_click";if(haystack.indexOf("/contact")!==-1)return "contact_click";if(haystack.indexOf("/specials")!==-1)return "specials_click";return ""}function isSameSiteNavigation(el){const href=el&&el.href||el&&el.getAttribute&&el.getAttribute("href")||"";if(!href||href.indexOf("#")===0)return false;try{const u=new URL(href,location.href);const target=(el.target||"").toLowerCase();return u.origin===location.origin&&(!target||target==="_self")}catch(e){return false}}function enqueue(eventType, extra){if(!isUndecided())return;const queue=readQueue();queue.push(Object.assign({event_type:eventType,ts:now(),page_path:location.pathname,page_url:cleanUrl(location.href),page_title:document.title||"",source:"preconsent_session_queue"},extra||{}));writeQueue(queue)}function queuePageview(){if(queuedPageview)return;queuedPageview=true;enqueue("page_view",{})}function queueClick(event){const target=event.target&&event.target.closest&&event.target.closest("a,button");if(!target)return;if(target.id==="vtr-cookie-accept"){reportedUnresolved=true;setTimeout(flushQueue,0);return}if(target.closest("#vtr-cookie-notice"))return;if(isSameSiteNavigation(target))suppressHideUntil=now()+2500;const eventType=classify(target);if(!eventType)return;enqueue(eventType,{cta_text:labelFor(target),cta_href:cleanUrl(target.href||target.getAttribute("href")||""),cta_target:target.target||""})}function reportUnresolved(reason){if(reportedUnresolved||now()<suppressHideUntil||!isUndecided())return;const queue=readQueue();if(!queue.length)return;reportedUnresolved=true;const body=JSON.stringify({reason:reason,page_path:location.pathname,page_title:document.title||"",events:queue,consent:getChoices()||{}});const url=c.reportEndpoint;if(navigator.sendBeacon){try{const blob=new Blob([body],{type:"application/json"});if(navigator.sendBeacon(url,blob))return}catch(e){}}try{fetch(url,{method:"POST",body:body,headers:{"content-type":"application/json"},keepalive:true,credentials:"same-origin"})}catch(e){}}function flushQueue(){const z=window.zaraz;if(isRejectedDecision()){clearQueue();return}if(!hasGrantedConsent()||!z||typeof z.track!=="function")return;const queue=readQueue();if(!queue.length)return;queue.forEach(function(item,index){z.track(c.trackEventName,Object.assign({queue_index:index,queue_size:queue.length},item))});clearQueue();if(z.consent&&typeof z.consent.sendQueuedEvents==="function")z.consent.sendQueuedEvents()}function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}document.addEventListener("click",queueClick,true);addEventListener("pagehide",function(){reportUnresolved("pagehide")});document.addEventListener("zarazConsentChoicesUpdated",flushQueue);document.addEventListener("zarazConsentAPIReady",function(){queuePageview();flushQueue()});ready(function(){queuePageview();flushQueue()})})();</script>`;
}

function buildCoachMarkScript(config) {
  const payload = JSON.stringify({
    id: config.id,
    configVersion: config.configVersion,
    cookieName: config.cookieName,
    cookieMaxAgeSeconds: config.cookieMaxAgeSeconds,
    ignoreFrequencyCap: config.ignoreFrequencyCap,
    showDelayMs: config.showDelayMs,
    durationMs: config.durationMs,
    fadeMs: config.fadeMs,
    propertyCode: config.propertyCode,
    communityId: config.communityId,
    propertyName: config.propertyName,
    brandColor: config.brandColor,
    accentColor: config.accentColor,
    iconTextColor: config.iconTextColor,
    surfaceTextColor: config.surfaceTextColor,
    titleFontSizePx: config.titleFontSizePx,
    bodyFontSizePx: config.bodyFontSizePx,
    maxWidthPx: config.maxWidthPx,
    targetText: config.targetText,
    title: config.title,
    body: config.body,
    closeLabel: config.closeLabel,
    analyticsEnabled: config.analyticsEnabled
  }).replace(/</g, "\\u003c");

  return `<script data-edge-message="${escapeAttribute(config.id)}">(function(){const c=${payload};const storageKey="v_edge_msg_seen_"+c.id;let seen=false;try{seen=!!localStorage.getItem(storageKey)}catch(e){}if(seen&&!c.ignoreFrequencyCap)return;function ready(fn){const run=()=>("requestIdleCallback"in window?requestIdleCallback(fn,{timeout:2200}):setTimeout(fn,160));document.readyState==="loading"?addEventListener("DOMContentLoaded",run,{once:true}):run()}function visible(el){if(!el)return false;const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=="none"&&s.visibility!=="hidden"&&s.opacity!=="0"}function findTarget(){const nodes=Array.from(document.querySelectorAll("a,button"));return nodes.find((el)=>visible(el)&&(el.textContent||"").replace(/\\s+/g," ").trim().includes(c.targetText))||null}function eventPayload(extra){return Object.assign({message_id:c.id,property_code:c.propertyCode,community_id:c.communityId,property_name:c.propertyName,source:"cloudflare_worker",config_version:c.configVersion,path:location.pathname},extra||{})}function push(eventName,extra){if(!c.analyticsEnabled)return;const payload=eventPayload(extra);window.dataLayer=window.dataLayer||[];window.dataLayer.push(Object.assign({event:eventName},payload));if(typeof window.gtag==="function")window.gtag("event",eventName,payload);if(window.heap&&typeof window.heap.track==="function")window.heap.track(eventName,payload);else{window.heap=window.heap||[];if(Array.isArray(window.heap))window.heap.push(["track",eventName,payload])}}function markSeen(){if(c.ignoreFrequencyCap)return;document.cookie=c.cookieName+"="+c.id+"; Max-Age="+c.cookieMaxAgeSeconds+"; Path=/; Secure; SameSite=Lax";try{localStorage.setItem(storageKey,String(Date.now()))}catch(e){}}ready(()=>setTimeout(waitForTarget,c.showDelayMs));function waitForTarget(){let target=findTarget();if(target){watch(target);return}let tries=0;const timer=setInterval(()=>{tries+=1;target=findTarget();if(target||tries>=40){clearInterval(timer);if(target)watch(target)}},250)}function watch(target){if("IntersectionObserver"in window){const io=new IntersectionObserver((entries)=>{if(entries.some((entry)=>entry.isIntersecting)){io.disconnect();show(target)}},{threshold:.55});io.observe(target)}else show(target)}function show(target){if(document.getElementById("v-edge-coachmark")||!visible(target))return;const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;const style=document.createElement("style");style.id="v-edge-coachmark-style";style.textContent=\`
#v-edge-coachmark{position:fixed;z-index:2147483001;max-width:min(\${c.maxWidthPx||460}px,calc(100vw - 28px));box-sizing:border-box;border-radius:24px;background:\${c.brandColor};color:\${c.surfaceTextColor||"#fff"};box-shadow:0 18px 46px rgba(15,23,42,.22);padding:18px 48px 18px 22px;opacity:0;transform:translateY(8px) scale(.98);transition:opacity \${reduce?1:c.fadeMs}ms ease,transform \${reduce?1:c.fadeMs}ms ease;font-family:Inter,Arial,sans-serif;pointer-events:auto}
#v-edge-coachmark.v-edge-visible{opacity:1;transform:translateY(0) scale(1)}
#v-edge-coachmark:after{content:"";position:absolute;left:calc(80% - 11px);bottom:-10px;width:22px;height:22px;background:\${c.brandColor};transform:rotate(45deg);border-radius:4px}
#v-edge-coachmark-kicker{display:flex;align-items:center;gap:11px;margin:0 0 9px;font-size:\${c.titleFontSizePx||14}px;line-height:1.18;font-weight:900;letter-spacing:0}
#v-edge-coachmark-icon{display:inline-grid;flex:0 0 auto;place-items:center;width:34px;height:34px;border-radius:999px;background:\${c.accentColor};color:\${c.iconTextColor||"#294782"};font-size:21px;font-weight:950;box-shadow:0 0 0 0 rgba(125,202,194,.48);animation:vEdgeCoachPulse 1.6s ease-out infinite}
#v-edge-coachmark-body{margin:0;color:\${c.surfaceTextColor||"#fff"};font-size:\${c.bodyFontSizePx||13}px;line-height:1.42;font-weight:500}
#v-edge-coachmark-close{position:absolute;right:14px;top:14px;width:28px;height:28px;border:0;border-radius:999px;background:transparent;color:\${c.surfaceTextColor||"#fff"};font-size:26px;line-height:1;cursor:pointer}
#v-edge-coachmark-close:hover,#v-edge-coachmark-close:focus-visible{background:rgba(255,255,255,.14);outline:2px solid transparent}
@keyframes vEdgeCoachPulse{0%{box-shadow:0 0 0 0 rgba(125,202,194,.5)}70%{box-shadow:0 0 0 12px rgba(125,202,194,0)}100%{box-shadow:0 0 0 0 rgba(125,202,194,0)}}
@media (prefers-reduced-motion: reduce){#v-edge-coachmark{transition:none!important}#v-edge-coachmark-icon{animation:none!important}}
@media (max-width:620px){#v-edge-coachmark{left:14px!important;right:14px!important;top:auto!important;bottom:22px!important;max-width:none;border-radius:22px;padding:20px 50px 20px 22px}#v-edge-coachmark:after{display:none}#v-edge-coachmark-kicker{gap:12px;font-size:22px}#v-edge-coachmark-icon{width:38px;height:38px;font-size:22px}#v-edge-coachmark-body{font-size:20px}#v-edge-coachmark-close{right:12px;top:13px;font-size:30px}}\`;const tip=document.createElement("aside");tip.id="v-edge-coachmark";tip.setAttribute("role","status");tip.innerHTML=\`<button id="v-edge-coachmark-close" type="button" aria-label="\${escapeHtml(c.closeLabel)}">&times;</button><p id="v-edge-coachmark-kicker"><span id="v-edge-coachmark-icon" aria-hidden="true">!</span><span>\${escapeHtml(c.title)}</span></p><p id="v-edge-coachmark-body">\${escapeHtml(c.body)}</p>\`;document.head.appendChild(style);document.body.appendChild(tip);let dismissed=false;function place(){if(dismissed||!visible(target))return;const r=target.getBoundingClientRect();const t=tip.getBoundingClientRect();let left=r.left+r.width/2-t.width*.8;left=Math.max(14,Math.min(left,innerWidth-t.width-14));let top=r.top-t.height-18;if(top<14)top=r.bottom+18;tip.style.left=left+"px";tip.style.top=top+"px"}function dismiss(type){if(dismissed)return;dismissed=true;markSeen();push("edge_message_dismiss",{dismiss_type:type,surface:"coachmark"});tip.classList.remove("v-edge-visible");setTimeout(()=>{tip.remove();style.remove();removeEventListener("scroll",place,true);removeEventListener("resize",place)},reduce?1:c.fadeMs+40)}tip.querySelector("#v-edge-coachmark-close").addEventListener("click",()=>dismiss("x"));addEventListener("scroll",place,true);addEventListener("resize",place);place();requestAnimationFrame(()=>{place();tip.classList.add("v-edge-visible");push("edge_message_view",{initiative:c.initiative,surface:"coachmark",target_text:c.targetText})});setTimeout(()=>dismiss("auto"),c.durationMs)}function escapeHtml(value){return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}})();</script>`;
}

function buildVenterraLogoSvg() {
  return `<svg aria-label="Venterra" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 439.78 59.81"><style>.v-edge-logo-fill{fill:currentColor}</style><path class="v-edge-logo-fill" d="M118.64,287.77h0a1.86,1.86,0,0,1-1.34-.57l-12.52-13a1.86,1.86,0,0,1,0-2.58l12.52-13a1.92,1.92,0,0,1,2.68,0l12.52,13a1.86,1.86,0,0,1,0,2.58L120,287.2A1.86,1.86,0,0,1,118.64,287.77Zm-9.93-14.85,9.93,10.31,9.94-10.31-9.94-10.31Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M130.38,314.13l.6,0-.6,0Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M169.11,294.29a1.86,1.86,0,0,0-1.47-1.09,100.21,100.21,0,0,0-19.28-.25,63.78,63.78,0,0,0,4.43-17.73,1.86,1.86,0,0,0-2.61-1.82,98.58,98.58,0,0,0-19.69,12.1c-5.41,4.37-9.36,8.85-11.81,13.34-2.45-4.49-6.4-9-11.81-13.34a98.57,98.57,0,0,0-19.69-12.1,1.86,1.86,0,0,0-2.61,1.82A63.78,63.78,0,0,0,89,293a100,100,0,0,0-19.28.25,1.81,1.81,0,0,0-1.23,2.91c.18.26,15.12,21.72,37.28,21.79h26c22.17-.28,36.84-21.52,37-21.78A1.9,1.9,0,0,0,169.11,294.29Zm-20.46-16c-1.39,8.62-7.08,31.42-28.69,35.57C115.45,297,139.9,282.79,148.66,278.29Zm-60,0,.4.21c7.09,3.67,23.07,13.06,27.61,24.9a20,20,0,0,0-.62,10.16c-10.26-2.37-18-9.18-23-20.32A60.45,60.45,0,0,1,88.7,278.29ZM73.54,296.6a98,98,0,0,1,17.25.3c3.35,6.63,8.48,13.21,16.28,17.29-7.34.36-14.72-2-22-7A60.49,60.49,0,0,1,73.54,296.6Zm89.79.57-.16.18-.37.42-.23.26-.35.39-.25.27-.37.4-.3.31-.38.39-.32.32-.4.41-.34.33-.42.41-.37.35-.44.41-.39.35-.46.42-.41.36-.48.42-.43.36-.5.42-.45.36-.52.42-.47.36-.54.41-.49.36-.56.4-.51.36-.58.39-.52.35-.59.38-.55.34-.61.37-.56.33-.63.36-.57.31-.65.34-.59.3-.67.32-.6.28-.69.3-.61.26-.71.28-.63.24-.73.25-.64.21-.74.22-.65.19-.77.19-.66.16-.79.16-.65.13-.82.13-.65.1-.86.09-.64.07-.95.05-.58,0H131l-.6,0h0c7.74-4.07,12.85-10.63,16.19-17.23l.73-.09q1.36-.14,2.69-.23l.88-.06c1.64-.1,3.23-.15,4.73-.17h1.27c2.37,0,4.47.09,6.15.19l.8.05Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M176.53,276.28a.83.83,0,0,1,.79-1.22h4.77a.86.86,0,0,1,.8.51l9,20.11h.33l9-20.11a.86.86,0,0,1,.79-.51h4.77a.83.83,0,0,1,.8,1.22L193,307.75a.84.84,0,0,1-.79.51h-.47a.84.84,0,0,1-.79-.51Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M225,276a.89.89,0,0,1,.89-.89h19a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89H231.07v7.67h11.55a.92.92,0,0,1,.89.89v3.88a.89.89,0,0,1-.89.89H231.07v8.18h13.84a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89h-19a.89.89,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M265.69,275.44a.88.88,0,0,1,.89-.84h1.17l19.45,20.67h0V276a.89.89,0,0,1,.89-.89h4.3a.92.92,0,0,1,.89.89v31.47a.88.88,0,0,1-.89.84h-1.12L271.77,286.8h0v20.11a.89.89,0,0,1-.89.89h-4.26a.92.92,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M319.43,280.67h-7.16a.89.89,0,0,1-.89-.89V276a.89.89,0,0,1,.89-.89h20.44a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89h-7.15v26.24a.92.92,0,0,1-.89.89h-4.35a.92.92,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M351.66,276a.89.89,0,0,1,.89-.89h19a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89H357.74v7.67h11.55a.92.92,0,0,1,.89.89v3.88a.89.89,0,0,1-.89.89H357.74v8.18h13.84a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89h-19a.89.89,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M392.36,276a.89.89,0,0,1,.89-.89h13.37a10.13,10.13,0,0,1,10.19,10.05c0,4.3-2.85,7.81-6.92,9.45l6.41,11.88a.88.88,0,0,1-.8,1.36H410.6a.8.8,0,0,1-.75-.42L403.63,295h-5.19v11.92a.92.92,0,0,1-.89.89h-4.3a.89.89,0,0,1-.89-.89Zm13.75,14a4.76,4.76,0,0,0,4.63-4.77,4.65,4.65,0,0,0-4.63-4.54h-7.62V290Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M436.7,276a.89.89,0,0,1,.89-.89H451a10.13,10.13,0,0,1,10.19,10.05c0,4.3-2.85,7.81-6.92,9.45l6.41,11.88a.88.88,0,0,1-.8,1.36h-4.91a.8.8,0,0,1-.75-.42L448,295h-5.19v11.92a.92.92,0,0,1-.89.89h-4.3a.89.89,0,0,1-.89-.89Zm13.75,14a4.76,4.76,0,0,0,4.63-4.77,4.65,4.65,0,0,0-4.63-4.54h-7.62V290Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M476.79,306.58l14.54-31.47a.84.84,0,0,1,.8-.51h.47a.8.8,0,0,1,.8.51l14.4,31.47a.83.83,0,0,1-.8,1.22h-4.07a1.34,1.34,0,0,1-1.36-.93l-2.29-5.05h-14L483,306.86a1.41,1.41,0,0,1-1.36.93h-4.07A.83.83,0,0,1,476.79,306.58Zm20.2-10-4.68-10.29h-.14l-4.58,10.29Z" transform="translate(-68.11 -258.1)"/></svg>`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
