export const RESI_EDGE_PACKAGE_ID = "resi-edge-canonical-upgrade-package";
export const RESI_EDGE_RUNTIME_VERSION = "2026-08-09.canonical-runtime-v1";
export const CONTENTSQUARE_VERIFY_SUPPRESS_PATH = "/?vtr_cs_verify_suppressed=1";
export const OFFICIAL_LBLE_SVG_PATH = "/assets/resi-edge-assets/shared/lble.svg";
export const SHARED_LBLE_TITLE_TEXT = "Live Better. Live Easy.";

import releaseTokens from "../../../../config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json";
import { renderZarazConsentPillScript } from "../resi-consent-widget/widget.mjs";

const MOBILE_RE = /android|iphone|ipod|mobile|blackberry|iemobile|opera mini/i;
export const RESI_EDGE_RELEASE_TOKEN_VERSION = releaseTokens.active_token_version || "unknown";

export function isHtmlRequest(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") || accept.includes("*/*");
}

export function isMobileRequest(request) {
  return MOBILE_RE.test(request.headers.get("user-agent") || "");
}

export function isHomepage(url) {
  return url.pathname === "/" || url.pathname === "";
}

export function isContentsquareVerifySuppressionRequest(url) {
  return url.pathname === "/" && url.searchParams.get("vtr_cs_verify_suppressed") === "1";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function cleanTel(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 ? `1${digits}` : digits;
  return `tel:+${normalized}`;
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeSourceCode(value) {
  return String(value || "").trim().toUpperCase();
}

function currentPhone(request, manifest) {
  const url = new URL(request.url);
  const wanted = normalizeSourceCode(
    url.searchParams.get("id") ||
      url.searchParams.get("trackingId") ||
      url.searchParams.get("tracking_id") ||
      url.searchParams.get("source")
  );
  const fallback = {
    source: manifest.phone_attribution.default_source,
    phone: manifest.phone_attribution.default_display_phone,
  };
  if (!wanted) return fallback;
  const match = (manifest.phone_attribution.source_lookup || []).find((row) => {
    return normalizeSourceCode(row.code) === wanted && row.phone;
  });
  return match ? { source: match.source || match.code, phone: match.phone, code: match.code } : fallback;
}

function absoluteUrl(pathOrUrl, manifest) {
  if (!pathOrUrl) return manifest.target.canonical_url;
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, manifest.target.canonical_url).toString();
  }
}

function pathOrAbsolute(pathOrUrl) {
  if (!pathOrUrl) return "/";
  try {
    const parsed = new URL(pathOrUrl);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return pathOrUrl;
  }
}

function renderPhoneIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg>`;
}

function renderChevron() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5"/></svg>`;
}

function renderStars(rating) {
  const percent = Math.max(0, Math.min(100, (Number(rating) / 5) * 100));
  return `<span class="rating-stars" style="--rating-percent:${percent.toFixed(2)}%" aria-hidden="true"><span>★★★★★</span><span>★★★★★</span></span>`;
}

function reviewIsPresent(reviews) {
  return (
    reviews?.present !== false &&
    Number.isFinite(Number(reviews?.rating)) &&
    Number.isInteger(Number(reviews?.count)) &&
    Number(reviews?.count) >= 0 &&
    Boolean(reviews?.url)
  );
}

function promoIsPresent(promo) {
  return (
    promo?.present !== false &&
    Boolean(promo?.title) &&
    Boolean(promo?.body)
  );
}

function renderReviewLink(rating) {
  if (!reviewIsPresent(rating)) return "";
  return `<a class="rating" href="${escapeAttr(pathOrAbsolute(rating.url))}" aria-label="${escapeAttr(rating.rating)} star rating from ${escapeAttr(rating.count)} reviews">${renderStars(rating.rating)}<span>(${escapeHtml(rating.rating)}) ${escapeHtml(rating.count)} Reviews</span></a>`;
}

function heroTitleMode(hero) {
  return hero?.title_mode === "property_tagline_svg" ? "property_tagline_svg" : "shared_lble_svg";
}

function heroTitleSvgPath(hero) {
  const mode = heroTitleMode(hero);
  const candidate = String(hero?.title_svg || "");
  if (mode === "property_tagline_svg" && /^\/assets\/resi-edge-assets\/[^"'<>\s]+\.svg$/i.test(candidate)) {
    return candidate;
  }
  return OFFICIAL_LBLE_SVG_PATH;
}

function heroTitleDimensions(hero) {
  const mode = heroTitleMode(hero);
  if (mode === "property_tagline_svg") {
    return {
      width: cssNumber(hero?.title_svg_width, 680),
      height: cssNumber(hero?.title_svg_height, 210),
      displayWidth: cssNumber(hero?.title_svg_display_width_px, 342),
      maxWidthVw: cssNumber(hero?.title_svg_max_width_vw, 84),
    };
  }
  return { width: 294, height: 73, displayWidth: 318, maxWidthVw: 84 };
}

function renderHeroTitle(hero) {
  const mode = heroTitleMode(hero);
  const label = hero.title_text || SHARED_LBLE_TITLE_TEXT;
  const src = heroTitleSvgPath(hero);
  const dimensions = heroTitleDimensions(hero);
  return `<div class="hero-title-art" data-vtr-hero-title-mode="${mode}" data-vtr-hero-title-src="${escapeAttr(src)}" role="img" aria-label="${escapeAttr(label)}" style="--hero-title-display-width:${dimensions.displayWidth}px;--hero-title-max-width:${dimensions.maxWidthVw}vw"><img src="${escapeAttr(src)}" width="${dimensions.width}" height="${dimensions.height}" alt="" decoding="sync" fetchpriority="high"></div>`;
}

function renderHeroHeadline(hero) {
  const lines = Array.isArray(hero?.headline_lines)
    ? hero.headline_lines.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  if (!lines.length) return escapeHtml(hero.headline || "");
  return lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
}

function awardIsPresent(awards) {
  return (
    awards?.present !== false &&
    Array.isArray(awards?.assets) &&
    awards.assets.some((asset) => asset?.url || asset?.local_url || asset?.image_url || asset?.asset_url)
  );
}

function awardAssetUrl(asset) {
  const raw = String(asset?.local_url || asset?.image_url || asset?.asset_url || asset?.url || "");
  const label = String(asset?.label || "");
  if (/Kingsley_Award\.svg/i.test(raw) || /kingsley/i.test(label)) {
    return "/assets/resi-edge-assets/shared/kingsley-award.svg";
  }
  return raw;
}

function htmlUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(String(pathOrUrl || ""))) return pathOrUrl;
  return pathOrAbsolute(pathOrUrl);
}

function renderAwards(manifest) {
  const awards = manifest.mobile_shell.awards;
  if (!awardIsPresent(awards)) return "";
  const items = awards.assets
    .map((asset) => {
      const src = awardAssetUrl(asset);
      if (!src) return "";
      const label = asset.label || "Property award";
      return `<img src="${escapeAttr(htmlUrl(src))}" width="64" height="64" loading="lazy" decoding="async" alt="${escapeAttr(asset.alt || label)}">`;
    })
    .join("");
  if (!items) return "";
  return `<div class="panel-awards" data-vtr-shell-awards="1" aria-label="Property awards">${items}</div>`;
}

function renderBullets(block) {
  const bullets = Array.isArray(block.bullets) ? block.bullets.filter(Boolean) : [];
  if (!bullets.length) return "";
  return `<ul class="panel-bullets" data-vtr-shell-bullets="1">${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function imageMimeType(pathOrUrl) {
  const lower = String(pathOrUrl || "").split("?")[0].toLowerCase();
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

function preferredMobileHeroImage(hero) {
  const image = String(hero?.image_mobile || "");
  return image.replace(/\.avif(?:$|\?)/i, (match) => match.replace(/\.avif/i, ".webp"));
}

function contentTypeForAsset(pathOrUrl) {
  const lower = String(pathOrUrl || "").split("?")[0].toLowerCase();
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export function isResiEdgeAssetRequest(url) {
  return url.pathname.startsWith("/assets/resi-edge-assets/");
}

export function isNativeAssetRepairRequest(url) {
  return /^\/wp-content\/themes\/resi-child-theme\/fontsgotham-(book|medium)-webfont\.woff2$/i.test(url.pathname);
}

export async function serveNativeAssetRepair(request) {
  const url = new URL(request.url);
  const repaired = new URL(request.url);
  repaired.pathname = url.pathname.replace("/resi-child-theme/fontsgotham-", "/resi-child-theme/fonts/gotham-");
  const originResponse = await fetch(new Request(repaired.toString(), request), {
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });
  const headers = new Headers(originResponse.headers);
  headers.set("content-type", "font/woff2");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-vtr-native-asset-repair", "font-path");
  return new Response(request.method === "HEAD" ? null : originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });
}

export async function serveResiEdgeAsset(request, env) {
  const url = new URL(request.url);
  if (!env?.RESI_EDGE_ASSETS) return fetch(request);
  const key = url.pathname.replace(/^\/assets\//, "");
  const object = await env.RESI_EDGE_ASSETS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-type", headers.get("content-type") || contentTypeForAsset(key));
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-vtr-resi-edge-asset", "r2");
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

function renderFontFaces(manifest) {
  const fonts = manifest.mobile_shell.fonts || [];
  return fonts
    .map((font) => {
      if (!font.family || !font.url) return "";
      return `@font-face{font-family:${font.family};src:url("${font.url}") format("woff2");font-weight:${font.weight || 400};font-style:${font.style || "normal"};font-display:${font.display || "optional"}}`;
    })
    .join("");
}

function cssColor(value, fallback) {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(normalized)) return normalized;
  return fallback;
}

function cssNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function cssLengthPx(value, fallback) {
  return `${cssNumber(value, fallback)}px`;
}

function cssTokenText(value, fallback) {
  const normalized = String(value || "").trim();
  return /^[a-zA-Z0-9 .,%_-]+$/.test(normalized) ? normalized : fallback;
}

function renderThemeVars(manifest) {
  const theme = manifest.mobile_shell.brand_theme || {};
  const layout = manifest.mobile_shell.layout_contract || {};
  const shellTokens = releaseTokens.defaults?.mobile_shell || {};
  const promoTokens = shellTokens.promo_bar || {};
  const headerTokens = shellTokens.header || {};
  return [
    `--navy:${cssColor(theme.primary_text, "#15284B")}`,
    `--promo-bar-height:${cssLengthPx(promoTokens.height_px, layout.promo_bar_height_px || 60)}`,
    `--promo-font-size:${cssLengthPx(promoTokens.font_size_px, 18)}`,
    `--promo-font-weight:${cssNumber(promoTokens.font_weight, 700)}`,
    `--promo-letter-spacing:${cssTokenText(promoTokens.letter_spacing, "0")}`,
    `--promo-text-transform:${cssTokenText(promoTokens.text_transform, "none")}`,
    `--promo-bg:${cssColor(theme.promo_background, promoTokens.background || "#15284B")}`,
    `--promo-text:${cssColor(theme.promo_text, promoTokens.text_color || "#FFFFFF")}`,
    `--promo-surface:${cssColor(theme.promo_surface, "#F6F6F5")}`,
    `--promo-panel-text:${cssColor(theme.promo_panel_text, "#15284B")}`,
    `--header-height:${cssLengthPx(headerTokens.height_px, layout.header_height_px || 80)}`,
    `--header-bg:${cssColor(theme.header_background, headerTokens.background || "#FFFFFF")}`,
    `--header-text:${cssColor(theme.header_text, headerTokens.text_color || "#15284B")}`,
    `--header-tour-border:${cssColor(theme.tour_button_border_color, headerTokens.tour_button_border_color || "#15284B")}`,
    `--header-tour-text:${cssColor(theme.tour_button_text_color, headerTokens.tour_button_text_color || "#15284B")}`,
    `--header-letter-spacing:${cssTokenText(headerTokens.letter_spacing, "0.22em")}`,
    `--button-bg:${cssColor(theme.button_background, "#FFFFFF")}`,
    `--button-text:${cssColor(theme.button_text, "#15284B")}`,
    `--drawer-bg:${cssColor(theme.drawer_background, theme.promo_background || "#15284B")}`,
    `--drawer-text:${cssColor(theme.drawer_text, "#FFFFFF")}`,
    `--hero-bg:${cssColor(theme.hero_background, theme.promo_background || "#15284B")}`,
    `--hero-overlay:${cssColor(theme.hero_overlay, "rgba(21,40,75,.38)")}`,
    `--body-text:${cssColor(theme.body_text, "#343838")}`,
    `--panel-bg:${cssColor(theme.panel_background, "#F6F6F5")}`,
  ].join(";");
}

function renderLlmsTxt(manifest) {
  const site = manifest.target.property_name;
  const base = manifest.target.canonical_url.replace(/\/$/, "");
  const description = `${manifest.mobile_shell.hero.headline}`;
  return `# ${site}

> ${description}
> Last updated: 08/09/2026

Important notes:
- Pricing, availability, specials, fees, lease terms, and policies may change. Verify current details on the Apartments page or by contacting the leasing office.
- This file highlights official property resources from ${site} and does not replace the full XML sitemap.

## Core Property Information

- [Homepage](${base}/): Official overview of ${site}.
- [Apartments](${base}/apartments/): Floor plans, pricing, availability, bedroom and bathroom options, and current leasing details.
- [Features](${base}/features/): Apartment features, interior finishes, home conveniences, and in-home details.
- [Amenities](${base}/amenities/): Community amenities, shared spaces, resident services, and lifestyle details.
- [Gallery](${base}/gallery/): Official property photos, apartment images, amenity photos, and visual context.
- [Neighborhood](${base}/neighborhood/): Nearby shopping, dining, employers, schools, transportation, and local area context.

## Leasing And Contact

- [Specials](${base}/specials/): Current leasing specials, promotions, and offer details when available.
- [Contact](${base}/contact/): Leasing office contact information, tour requests, phone number, address, and inquiry form.

## Search

- [Search this site](${base}/?s=): WordPress search results for official ${site} website content.

## Optional

- [XML Sitemap](${manifest.seo.sitemap_url}): Complete list of indexable URLs for this property website.
`;
}

export function serveLlmsTxt(request, manifest) {
  return new Response(request.method === "HEAD" ? null : renderLlmsTxt(manifest), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-vtr-resi-edge-package": RESI_EDGE_RUNTIME_VERSION,
      "x-vtr-release-token": RESI_EDGE_RELEASE_TOKEN_VERSION,
      "x-vtr-llms-txt": "linked-markdown",
    },
  });
}

function renderAnalyticsScript(manifest, surface = "mobile_topper", viewEvent = "edge_mobile_topper_view") {
  const payload = JSON.stringify({
    site: manifest.target.domain,
    propertyCode: manifest.target.source_property_code,
    propertyName: manifest.target.property_name,
    communityId: manifest.target.community_id,
    surface,
    viewEvent,
  });
  return `<script data-vtr-edge-analytics="1">(function(w,d){var c=${payload};w.dataLayer=w.dataLayer||[];function emit(name,data){var p=Object.assign({event:name,vtr_surface:c.surface,vtr_site:c.site,property_code:c.propertyCode,property_name:c.propertyName,community_id:c.communityId},data||{});w.dataLayer.push(p);if(w.zaraz&&typeof w.zaraz.track==="function"){try{w.zaraz.track(name,p)}catch(e){}}}function afterFirstPaint(fn){if("requestIdleCallback"in w)w.requestIdleCallback(fn,{timeout:2500});else w.setTimeout(fn,1800)}w.vtrEdgeTrack=emit;afterFirstPaint(function(){emit(c.viewEvent)});d.addEventListener("click",function(e){var el=e.target&&e.target.closest?e.target.closest("a[href],button"):null;if(!el)return;var label=(el.textContent||"").replace(/\\s+/g," ").trim();var href=el.getAttribute("href")||"";var low=(label+" "+href).toLowerCase();if(low.indexOf("find your home")!==-1||href.indexOf("/apartments")!==-1)emit("find_your_home_click",{cta_label:label,cta_href:href});else if(href.indexOf("scheduleTour")!==-1||low.indexOf("tour")!==-1)emit("schedule_tour_click",{cta_label:label,cta_href:href});else if(href.indexOf("createPipelineApplication")!==-1||low.indexOf("apply")!==-1)emit("apply_now_click",{cta_label:label,cta_href:href});else if(href.indexOf("tel:")===0)emit("phone_click",{cta_label:label,cta_href:href});else if(low.indexOf("special")!==-1)emit("promo_cta_click",{cta_label:label,cta_href:href});},{passive:true});})(window,document);</script>`;
}

function renderBehaviorScript(hasPromo = true) {
  if (!hasPromo) {
    return `<script data-vtr-edge-behavior="1">(function(w,d){var drawer=d.querySelector("[data-edge-drawer]");var scrim=d.querySelector("[data-edge-drawer-scrim]");var menu=d.querySelector("[data-edge-drawer-open]");var close=d.querySelector("[data-edge-drawer-close]");function track(n,x){if(w.vtrEdgeTrack)w.vtrEdgeTrack(n,x||{})}function setDrawer(open){if(!drawer)return;drawer.dataset.open=open?"true":"false";drawer.setAttribute("aria-hidden",open?"false":"true");if(open)drawer.removeAttribute("inert");else drawer.setAttribute("inert","");if(scrim)scrim.hidden=!open;if(menu)menu.setAttribute("aria-expanded",open?"true":"false");d.documentElement.classList.toggle("drawer-open",open);track(open?"mobile_menu_open":"mobile_menu_close")}if(menu)menu.addEventListener("click",function(){setDrawer(true)});if(close)close.addEventListener("click",function(){setDrawer(false)});if(scrim)scrim.addEventListener("click",function(){setDrawer(false)});d.addEventListener("keydown",function(e){if(e.key==="Escape")setDrawer(false)})})(window,document);</script>`;
  }
  return `<script data-vtr-edge-behavior="1">(function(w,d){var drawer=d.querySelector("[data-edge-drawer]");var scrim=d.querySelector("[data-edge-drawer-scrim]");var menu=d.querySelector("[data-edge-drawer-open]");var close=d.querySelector("[data-edge-drawer-close]");var promo=d.querySelector("[data-edge-promo-toggle]");var drop=d.querySelector("[data-edge-promo-drop]");var promoClose=d.querySelector("[data-edge-promo-close]");function track(n,x){if(w.vtrEdgeTrack)w.vtrEdgeTrack(n,x||{})}function setDrawer(open){if(!drawer)return;drawer.dataset.open=open?"true":"false";drawer.setAttribute("aria-hidden",open?"false":"true");if(open)drawer.removeAttribute("inert");else drawer.setAttribute("inert","");if(scrim)scrim.hidden=!open;if(menu)menu.setAttribute("aria-expanded",open?"true":"false");d.documentElement.classList.toggle("drawer-open",open);track(open?"mobile_menu_open":"mobile_menu_close")}function setPromo(open){if(!drop||!promo)return;drop.hidden=!open;promo.setAttribute("aria-expanded",open?"true":"false");track(open?"promo_open":"promo_close")}if(menu)menu.addEventListener("click",function(){setDrawer(true)});if(close)close.addEventListener("click",function(){setDrawer(false)});if(scrim)scrim.addEventListener("click",function(){setDrawer(false)});if(promo)promo.addEventListener("click",function(){setPromo(drop.hidden)});if(promoClose)promoClose.addEventListener("click",function(){setPromo(false)});d.addEventListener("keydown",function(e){if(e.key==="Escape"){setDrawer(false);setPromo(false)}})})(window,document);</script>`;
}

function renderContentsquareVerifySuppressScript() {
  return `<script data-vtr-cs-verify-suppress="1">(function(w){var p=/tcvsapi\\.contentsquare\\.com\\/v2\\/projects\\/[^/]+\\/verify-installation\\/auto/i;var local="${CONTENTSQUARE_VERIFY_SUPPRESS_PATH}";if(w.fetch){var f=w.fetch;w.fetch=function(input,init){var u=typeof input==="string"?input:input&&input.url;if(p.test(String(u||"")))return f.call(this,local,{credentials:"same-origin",cache:"force-cache"});return f.apply(this,arguments)}}if(w.XMLHttpRequest){var open=w.XMLHttpRequest.prototype.open;w.XMLHttpRequest.prototype.open=function(method,url){if(p.test(String(url||"")))url=local;return open.apply(this,[method,url].concat([].slice.call(arguments,2)))}}})(window);</script>`;
}

export function serveContentsquareVerifySuppressed(request) {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "public, max-age=3600",
      "x-vtr-cs-verify": "suppressed",
      "x-vtr-resi-edge-package": RESI_EDGE_RUNTIME_VERSION,
      "x-vtr-release-token": RESI_EDGE_RELEASE_TOKEN_VERSION,
    },
  });
}

function continuationHref(request, manifest) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("__resi_edge_native_continuation", "1");
  url.searchParams.set("vtr_cv", RESI_EDGE_RUNTIME_VERSION);
  const sourceId =
    new URL(request.url).searchParams.get("id") ||
    new URL(request.url).searchParams.get("trackingId") ||
    "";
  if (sourceId) url.searchParams.set("id", sourceId);
  return `${url.pathname}${url.search}`;
}

function renderContinuationShell(request, manifest) {
  return `<section class="native-continuation" data-vtr-native-continuation data-native-continuation-state="idle" aria-label="Native site continuation"><div class="native-continuation-status" aria-live="polite"></div><iframe class="native-continuation-frame" title="${escapeAttr(manifest.target.property_name)} native site continuation" loading="lazy" data-src="${escapeAttr(continuationHref(request, manifest))}" hidden></iframe></section>`;
}

function renderContinuationLoader() {
  return `<script data-vtr-native-continuation-loader="1">(function(w,d){var section=d.querySelector("[data-vtr-native-continuation]");if(!section)return;var frame=section.querySelector(".native-continuation-frame");var status=section.querySelector(".native-continuation-status");var loaded=false;function track(name,data){if(w.vtrEdgeTrack)w.vtrEdgeTrack(name,data||{})}function state(s,m){section.setAttribute("data-native-continuation-state",s);if(status)status.textContent=m||""}function load(reason){if(loaded||!frame)return;loaded=true;state("loading","Loading the native site.");frame.hidden=false;frame.src=frame.getAttribute("data-src");frame.addEventListener("load",function(){state("loaded","")},{once:true});track("native_continuation_load",{reason:reason||"unknown"})}w.addEventListener("message",function(event){if(event.origin!==w.location.origin)return;var data=event.data||{};if(data.type!=="vtr-native-continuation-height"||!frame)return;var h=Number(data.height)||0;if(h>0)frame.style.height=Math.max(640,Math.min(14000,Math.ceil(h)))+"px"});if("IntersectionObserver"in w){var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){io.disconnect();load("scroll")}})},{rootMargin:"0px 0px",threshold:.01});io.observe(section)}else{w.addEventListener("load",function(){setTimeout(function(){load("fallback")},1500)},{once:true})}})(window,document);</script>`;
}

function renderDeferredImageLoader() {
  return `<script data-vtr-deferred-shell-images="1">(function(w,d){var images=[].slice.call(d.querySelectorAll("img[data-vtr-lazy-src]"));if(!images.length)return;function hydrate(img){var src=img.getAttribute("data-vtr-lazy-src");if(!src)return;img.src=src;img.removeAttribute("data-vtr-lazy-src");img.setAttribute("data-vtr-lazy-loaded","1")}function hydrateAll(){images.forEach(hydrate)}if("IntersectionObserver"in w){var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){io.unobserve(entry.target);hydrate(entry.target)}})},{rootMargin:"220px 0px",threshold:.01});images.forEach(function(img){io.observe(img)})}else{w.addEventListener("load",function(){setTimeout(hydrateAll,1800)},{once:true})}})(window,document);</script>`;
}

function renderNavLinks(manifest) {
  const links = manifest.mobile_shell.navigation?.links || [];
  return links.map((link) => `<a href="${escapeAttr(pathOrAbsolute(link.url))}">${escapeHtml(link.label)}</a>`).join("");
}

function renderContentBlocks(manifest) {
  const blocks = manifest.mobile_shell.content_blocks || [];
  return blocks
    .map((block, index) => {
      const alt = index % 2 === 1;
      const image = block.image_url
        ? `<figure class="panel-media"><img data-vtr-lazy-src="${escapeAttr(block.image_url)}" width="900" height="600" loading="lazy" decoding="async" alt="${escapeAttr(block.image_alt || block.heading || manifest.target.property_name)}"></figure>`
        : "";
      const eyebrow = block.eyebrow ? `<span class="panel-eyebrow">${escapeHtml(block.eyebrow)}</span>` : "";
      const kicker = block.subheading ? `<strong class="panel-kicker">${escapeHtml(block.subheading)}</strong>` : "";
      const bullets = renderBullets(block);
      const cta = block.cta_label && block.cta_url ? `<a class="panel-cta" href="${escapeAttr(pathOrAbsolute(block.cta_url))}">${escapeHtml(block.cta_label)}</a>` : "";
      const awards = index === 0 ? renderAwards(manifest) : "";
      return `<section class="panel ${alt ? "panel-alt" : ""}" data-vtr-shell-content-block="${escapeAttr(block.kind || index + 1)}"><div class="panel-inner panel-grid"><div>${eyebrow}<h2>${escapeHtml(block.heading)}</h2><p>${kicker}${escapeHtml(block.body)}</p>${bullets}${cta}${awards}</div>${image}</div></section>`;
    })
    .join("");
}

export function renderMobileShell(request, manifest) {
  const phone = currentPhone(request, manifest);
  const phoneHref = cleanTel(phone.phone);
  const hero = manifest.mobile_shell.hero;
  const promo = manifest.mobile_shell.promo;
  const hasPromo = promoIsPresent(promo);
  const promoBarLabel = promo?.bar_label || promo?.title;
  const rating = manifest.mobile_shell.reviews;
  const nav = manifest.mobile_shell.navigation || {};
  const bodyFont = manifest.mobile_shell.body_font || "Poppins";
  const titleFont = manifest.mobile_shell.title_font || bodyFont;
  const headingFont = manifest.mobile_shell.heading_font || bodyFont;
  const canonical = manifest.target.canonical_url;
  const heroImage = preferredMobileHeroImage(hero);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: manifest.target.property_name,
    url: canonical,
    address: {
      "@type": "PostalAddress",
      addressLocality: manifest.target.city,
      addressRegion: manifest.target.state,
      addressCountry: "US",
    },
    telephone: `+${phoneDigits(phone.phone)}`,
    image: absoluteUrl(heroImage, manifest),
  };
  if (reviewIsPresent(rating)) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.rating,
      reviewCount: rating.count,
    };
  }
  const sourcePhoneAttr = phone.code ? ` data-source-code="${escapeAttr(phone.code)}"` : "";

  return `<!doctype html>
<html lang="en" data-vtr-edge-topper="canonical" data-vtr-package="${RESI_EDGE_RUNTIME_VERSION}" data-vtr-release-token="${RESI_EDGE_RELEASE_TOKEN_VERSION}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>${escapeHtml(manifest.target.property_name)} Apartments in ${escapeHtml(`${manifest.target.city}, ${manifest.target.state}`)}</title>
<meta name="description" content="${escapeAttr(manifest.target.property_name)} - ${escapeAttr(hero.headline)}">
<link rel="canonical" href="${escapeAttr(canonical)}">
<link rel="icon" href="/wp-content/uploads/2026/01/favicon.png" sizes="any">
<link rel="preload" as="image" href="${escapeAttr(heroImage)}" type="${imageMimeType(heroImage)}" fetchpriority="high">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
${renderFontFaces(manifest)}
:root{${renderThemeVars(manifest)};--body-font:${bodyFont};--title-font:${titleFont};--heading-font:${headingFont};--white:#fff;--quill:#D6D6D2;--shadow:rgba(21,40,75,.22)}
*{box-sizing:border-box}html{font-size:18px;background:#fff;color:var(--body-text)}body{margin:0;background:#fff;color:var(--body-text);font-family:var(--body-font),Arial,sans-serif;font-size:18px;font-weight:400;line-height:1.625;text-rendering:optimizeLegibility}a{color:inherit;text-decoration:none}button{font:inherit}img{max-width:100%;height:auto;display:block}.drawer-open{overflow:hidden}
.promo-wrap{position:relative;z-index:1100}.promo{width:100%;height:var(--promo-bar-height);border:0;border-radius:0;background:var(--promo-bg);color:var(--promo-text);display:flex;align-items:center;justify-content:center;gap:10px;padding:0 18px;font-size:clamp(15px,4.35vw,var(--promo-font-size));font-weight:var(--promo-font-weight);line-height:1.1;letter-spacing:var(--promo-letter-spacing);text-transform:var(--promo-text-transform);text-align:center;white-space:nowrap;overflow:hidden}.promo-label{display:block;min-width:0;white-space:nowrap;overflow:hidden}.promo svg{flex:0 0 auto;width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;transition:transform .15s ease}.promo[aria-expanded="true"] svg{transform:rotate(180deg)}.promo-drop{position:absolute;top:var(--promo-bar-height);left:0;width:100%;z-index:1020;background:var(--promo-surface);color:var(--promo-panel-text);padding:20px 20px 22px;text-align:center;box-shadow:0 18px 35px rgba(0,0,0,.15)}.promo-drop[hidden]{display:none}.promo-close{position:absolute;right:15px;top:10px;width:24px;height:24px;border:0;background:transparent;color:var(--promo-panel-text);font-size:28px;line-height:24px;padding:0}.promo-drop h3{margin:0 28px 16px;color:var(--promo-panel-text);font-size:24px;font-weight:700;line-height:1.2}.promo-drop p{margin:0 auto 20px;max-width:340px;color:var(--promo-panel-text);font-size:16px;line-height:1.55}.promo-disclaimer{display:block;margin:0 auto 28px;font-style:italic;color:var(--promo-panel-text);font-size:15px}.promo-actions{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}.promo-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:180px;padding:0 20px;border:2px solid var(--navy);border-radius:50px;background:var(--navy);color:#fff;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.2px}.promo-actions a.secondary{min-width:0;min-height:0;height:28px;border:0;background:transparent;color:var(--promo-panel-text);padding:0;font-size:14px;line-height:28px;letter-spacing:1.2px}
.bar{height:var(--header-height);background:var(--header-bg);display:flex;align-items:center;justify-content:space-between;padding:0 15px;color:var(--header-text);position:relative;z-index:990}.brand{height:var(--header-height);display:flex;align-items:center;font-size:10px;font-weight:700;line-height:16px;letter-spacing:var(--header-letter-spacing);text-transform:uppercase;white-space:nowrap}.actions{height:var(--header-height);display:flex;align-items:center;gap:20px}.phone{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:var(--header-text)}.phone svg{display:block;width:20px;height:20px;fill:currentColor}.tour{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border:2px solid var(--header-tour-border);border-radius:50px;color:var(--header-tour-text);background:#fff;font-size:11.5px;font-weight:900;line-height:40px;letter-spacing:1.5px}.hamb{position:relative;width:20px;height:var(--header-height);border:0;background:transparent;color:var(--header-text);padding:0;cursor:pointer}.hamb:before,.hamb:after,.hamb span{content:"";position:absolute;left:0;right:0;height:2px;background:currentColor}.hamb:before{top:31px}.hamb span{top:39px}.hamb:after{top:47px}
@keyframes vtrFadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
.hero{height:calc(100svh - var(--promo-bar-height) - var(--header-height));min-height:calc(100svh - var(--promo-bar-height) - var(--header-height));position:relative;overflow:hidden;background:var(--hero-bg);display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 15px}body.no-promo .hero{height:calc(100svh - var(--header-height));min-height:calc(100svh - var(--header-height))}@supports not (height:100svh){.hero{height:calc(100vh - var(--promo-bar-height) - var(--header-height));min-height:calc(100vh - var(--promo-bar-height) - var(--header-height))}body.no-promo .hero{height:calc(100vh - var(--header-height));min-height:calc(100vh - var(--header-height))}}.hero-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0}.hero:after{content:"";position:absolute;inset:0;background:var(--hero-overlay);z-index:1}.hero-inner{width:360px;max-width:100%;position:relative;z-index:2;margin-top:4px}.rating{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 18px;color:#fff;font-size:12px;font-weight:900;line-height:20px;letter-spacing:2px;text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,.32);white-space:nowrap}.rating-stars{position:relative;display:inline-block;font-size:24px;line-height:1;letter-spacing:2px;color:rgba(255,255,255,.42)}.rating-stars span+span{position:absolute;left:0;top:0;width:var(--rating-percent);overflow:hidden;color:#fff;white-space:nowrap}.hero-title-art{width:min(var(--hero-title-display-width,318px),var(--hero-title-max-width,84vw));height:auto;margin:0 auto 24px;filter:drop-shadow(0 2px 14px rgba(0,0,0,.26))}.hero-title-art img{display:block;width:100%;height:auto}.hero-headline{font-size:19px;line-height:27px;margin:0 auto 32px;font-weight:600;max-width:360px;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.34)}.hero-headline span{display:block}.cta{display:inline-flex;align-items:center;justify-content:center;min-width:197px;min-height:50px;border:2px solid #fff;border-radius:50px;padding:0 30px;background:#fff;color:var(--button-text);font-size:14px;font-weight:600;line-height:46px;letter-spacing:1.5px}.cta span{font-size:18px;margin-left:10px}
.hero .rating,.hero .hero-title-art,.hero .hero-headline,.hero .cta{opacity:0;animation:vtrFadeUp .55s cubic-bezier(.22,.61,.36,1) forwards}.hero .rating{animation-delay:.08s}.hero .hero-title-art{animation-delay:.18s}.hero .hero-headline{animation-delay:.28s}.hero .cta{animation-delay:.38s}
.panel{padding:58px 15px;background:var(--panel-bg);color:var(--navy);content-visibility:auto;contain-intrinsic-size:760px}.panel-alt{background:#fff}.panel-inner{max-width:1120px;margin:0 auto}.panel h2{margin:0 0 18px;color:var(--navy);font-family:var(--heading-font),Georgia,serif;font-size:27px;line-height:1.25;font-weight:700}.panel p{margin:0 0 20px;color:var(--navy);font-size:15px;line-height:1.65}.panel-kicker{display:block;margin:0 0 12px;color:var(--navy);font-size:15px;font-weight:900;line-height:1.55}.panel-eyebrow{display:block;margin:0 0 12px;color:#3D66B9;font-size:11px;font-weight:900;line-height:1.3;letter-spacing:1.4px;text-transform:uppercase}.panel-bullets{display:grid;gap:8px;margin:18px 0 22px;padding:0;list-style:none;color:var(--navy)}.panel-bullets li{position:relative;padding-left:15px;font-size:14px;line-height:1.5}.panel-bullets li:before{content:"";position:absolute;left:0;top:.7em;width:5px;height:5px;border-radius:50%;background:#3D66B9}.panel-awards{display:flex;align-items:flex-start;gap:14px;margin:28px 0 0}.panel-awards img{display:block;width:64px;max-width:64px;height:auto}.panel-media{margin:28px 0 0;overflow:hidden;background:var(--panel-bg)}.panel-media img{width:100%;height:auto;aspect-ratio:3/2;border-radius:4px;background:var(--panel-bg);object-fit:cover}.panel-cta{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 18px;border-radius:50px;background:#3D66B9;color:#fff;font-size:11px;font-weight:900;line-height:38px;letter-spacing:.8px}
.native-continuation{min-height:640px;background:#fff;color:var(--body-text)}.native-continuation-status{min-height:28px;padding:14px 15px;text-align:center;font-size:11px;font-weight:700;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:var(--navy)}.native-continuation-frame{display:block;width:100%;min-height:640px;border:0;background:#fff}.native-continuation-frame[hidden]{display:none}.native-continuation[data-native-continuation-state="idle"] .native-continuation-status{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.native-continuation[data-native-continuation-state="loaded"]{min-height:0}.native-continuation[data-native-continuation-state="loaded"] .native-continuation-status{display:none}
.drawer-scrim{position:fixed;inset:0;z-index:1190;background:rgba(0,0,0,.45)}.drawer-scrim[hidden]{display:none}.drawer{position:fixed;top:0;right:0;bottom:0;z-index:1200;width:270px;height:100svh;min-height:100vh;padding:50px 25px 34px;background:var(--drawer-bg);color:var(--drawer-text);box-shadow:-20px 0 60px var(--shadow);transform:translateX(105%);transition:transform .18s ease;overflow:auto}.drawer[data-open="true"]{transform:translateX(0)}.drawer-close{position:absolute;top:5px;right:5px;width:37px;height:37px;border:0;background:transparent;color:var(--drawer-text);font-size:34px;font-weight:300;line-height:37px;padding:0;cursor:pointer}.drawer-logo{display:block;margin:0 0 20px;color:var(--drawer-text);font-size:18px;line-height:26px;letter-spacing:2px;text-transform:uppercase}.drawer nav{display:grid;margin:0}.drawer nav a{display:block;padding:8px 0;color:var(--drawer-text);font-size:15px;font-weight:700;line-height:24px;letter-spacing:.75px}.drawer-actions{display:flex;align-items:center;gap:10px;margin:20px 0 17px}.drawer-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border:2px solid rgba(255,255,255,.72);border-radius:50px;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;white-space:nowrap;color:var(--drawer-text)}.drawer-actions a:first-child{background:#fff;color:var(--drawer-bg);border-color:#fff}.drawer-phone{display:block;color:var(--drawer-text);font-size:14px;font-weight:900;line-height:28px;letter-spacing:1.5px}
@media(min-width:768px){.panel{padding:72px 56px}.panel-grid{display:grid;grid-template-columns:1fr 1fr;gap:42px;align-items:center}.panel-media{margin:0}.panel-alt .panel-media{order:-1}.panel h2{font-size:42px;line-height:1.15}.panel p,.panel-kicker{font-size:18px}}
@media(prefers-reduced-motion:reduce){.hero .rating,.hero .hero-title-art,.hero .hero-headline,.hero .cta{opacity:1;animation:none;transform:none}}
</style>
</head>
<body class="${hasPromo ? "" : "no-promo"}" data-vtr-edge-mobile-shell="1" data-vtr-release-token="${RESI_EDGE_RELEASE_TOKEN_VERSION}" data-property-name="${escapeAttr(manifest.target.property_name)}" data-property-code="${escapeAttr(manifest.target.source_property_code)}"${sourcePhoneAttr}>
${hasPromo ? `<div class="promo-wrap"><button class="promo" data-edge-promo-toggle aria-expanded="false"><span class="promo-label">${escapeHtml(promoBarLabel)}</span>${renderChevron()}</button><div class="promo-drop" data-edge-promo-drop hidden><button class="promo-close" data-edge-promo-close aria-label="Close special">&times;</button><h3>${escapeHtml(promo.title)}</h3><p>${escapeHtml(promo.body)}</p><span class="promo-disclaimer">${escapeHtml(promo.disclaimer)}</span><div class="promo-actions"><a href="${escapeAttr(pathOrAbsolute(promo.primary_cta_url))}">${escapeHtml(promo.primary_cta_label)}</a><a class="secondary" href="${escapeAttr(pathOrAbsolute(promo.secondary_cta_url))}">${escapeHtml(promo.secondary_cta_label)}</a></div></div></div>` : ""}
<header class="bar"><a class="brand" href="/">${escapeHtml(manifest.target.property_name)}</a><div class="actions"><a class="phone" href="${escapeAttr(phoneHref)}" aria-label="Call ${escapeAttr(manifest.target.property_name)}">${renderPhoneIcon()}</a><a class="tour" href="${escapeAttr(nav.tour_url || "#")}">Tour</a><button class="hamb" data-edge-drawer-open aria-label="Menu" aria-controls="mobile-drawer" aria-expanded="false"><span></span></button></div></header>
<div class="drawer-scrim" data-edge-drawer-scrim hidden></div>
<aside class="drawer" id="mobile-drawer" data-edge-drawer data-open="false" aria-hidden="true" inert><button class="drawer-close" data-edge-drawer-close aria-label="Close menu">&times;</button><a class="drawer-logo" href="/" aria-label="${escapeAttr(manifest.target.property_name)} home">${escapeHtml(manifest.target.property_name)}</a><nav aria-label="Mobile menu">${renderNavLinks(manifest)}</nav><div class="drawer-actions"><a href="${escapeAttr(nav.tour_url || "#")}">Tour</a><a href="${escapeAttr(nav.apply_url || "#")}">Apply</a></div><a class="drawer-phone" href="${escapeAttr(phoneHref)}">${escapeHtml(phone.phone)}</a></aside>
<main><section class="hero"><img class="hero-media" src="${escapeAttr(heroImage)}" width="750" height="1000" alt="" fetchpriority="high" decoding="sync"><div class="hero-inner">${renderReviewLink(rating)}${renderHeroTitle(hero)}<p class="hero-headline">${renderHeroHeadline(hero)}</p><a class="cta" href="${escapeAttr(pathOrAbsolute(hero.primary_cta_url))}">${escapeHtml(hero.primary_cta_label)} <span>&rarr;</span></a></div></section>${renderContentBlocks(manifest)}${renderContinuationShell(request, manifest)}</main>
${renderAnalyticsScript(manifest)}
${renderContentsquareVerifySuppressScript()}
${renderZarazConsentPillScript()}
${renderBehaviorScript(hasPromo)}
${renderDeferredImageLoader()}
${renderContinuationLoader()}
</body>
</html>`;
}

function buildOriginRequest(request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  const headers = new Headers();
  const source = request.headers;
  headers.set("accept", source.get("accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  for (const name of ["accept-language", "user-agent", "cookie"]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return new Request(url.toString(), { method: "GET", headers, redirect: "follow" });
}

function stripMatchingScriptBlocks(html, predicate) {
  return html.replace(/\s*<script\b([^>]*)>([\s\S]*?)<\/script>\s*/gi, (match, attrs, body) => (predicate(attrs || "", body || "") ? "\n" : match));
}

function stripDirectAnalytics(html) {
  let cleaned = html
    .replace(/\s*<script>\s*window\.HEAP_JS_DEBUG\s*=\s*true;\s*<\/script>\s*/gi, "\n")
    .replace(/\s*<!--\s*Google Tag Manager[\s\S]*?<!--\s*End Google Tag Manager\s*-->\s*/gi, "\n")
    .replace(/\s*<!--\s*Google Tag Manager \(noscript\)[\s\S]*?<!--\s*End Google Tag Manager \(noscript\)\s*-->\s*/gi, "\n")
    .replace(/\s*<noscript><iframe[^>]+googletagmanager\.com\/ns\.html[\s\S]*?<\/iframe><\/noscript>\s*/gi, "\n")
    .replace(/\s*<script[^>]+googletagmanager\.com\/gtag\/js[^>]*><\/script>\s*/gi, "\n")
    .replace(/\s*<script[^>]+analytics\.ahrefs\.com\/analytics\.js[^>]*><\/script>\s*/gi, "\n")
    .replace(/\s*<script[^>]+js\.getresi\.co\/pixel\/[^"'\s<>]+\/resi-pixel\.iife\.js[^>]*><\/script>\s*/gi, "\n");
  cleaned = stripMatchingScriptBlocks(cleaned, (_attrs, body) => /\bheap\.load\s*\(/i.test(body));
  cleaned = stripMatchingScriptBlocks(cleaned, (_attrs, body) => /tcvsapi\.contentsquare\.com\/v2\/projects\/[^"']*verify-installation\/auto/i.test(body));
  return cleaned;
}

function normalizeIdentityAndPhone(html, manifest, phone) {
  return html
    .replace(/\sdata-property-name="[^"]*"/i, ` data-property-name="${escapeAttr(manifest.target.property_name)}"`)
    .replace(/\sdata-property-code="[^"]*"/i, ` data-property-code="${escapeAttr(manifest.target.source_property_code)}"`)
    .replace(/tel:\+?1?\d[\d().\-\s]{7,}\d/gi, cleanTel(phone.phone))
    .replace(/\(\d{3}\)\s*\d{3}-\d{4}/g, phone.phone);
}

function continuationHiddenCss() {
  return `body.vtr-native-continuation .tm-header,
body.vtr-native-continuation .tm-header-mobile,
body.vtr-native-continuation [data-page-section="promo_bar"],
body.vtr-native-continuation [data-component-name="open_promo_bar"],
body.vtr-native-continuation [data-page-section="hero"],
body.vtr-native-continuation [data-page-section="welcome"],
body.vtr-native-continuation [data-page-section="apartment_features"]{display:none!important}`;
}

class ContinuationHeadRewriter {
  constructor(manifest) {
    this.manifest = manifest;
  }
  element(element) {
    element.prepend(`<base href="${escapeAttr(this.manifest.target.canonical_url)}">`, { html: true });
    element.prepend(renderContentsquareVerifySuppressScript(), { html: true });
    element.append(`<style data-vtr-native-continuation="1">${continuationHiddenCss()}html{margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important}body{margin:0!important;padding:0!important;background:#fff!important}.vtr-native-continuation-frame-marker{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}</style>`, { html: true });
  }
}

class ContinuationBodyRewriter {
  element(element) {
    const existing = element.getAttribute("class") || "";
    element.setAttribute("class", `${existing} vtr-native-continuation`.trim());
    element.prepend(`<div class="vtr-native-continuation-frame-marker" data-vtr-native-continuation-frame="1">Native continuation loaded</div>`, { html: true });
    element.append(`<script data-vtr-native-continuation-resize="1">(function(){function postHeight(){var body=document.body,doc=document.documentElement;var height=Math.max(body?body.scrollHeight:0,body?body.offsetHeight:0,doc?doc.scrollHeight:0,doc?doc.offsetHeight:0);try{parent.postMessage({type:"vtr-native-continuation-height",height:height},location.origin)}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",postHeight,{once:true});else postHeight();addEventListener("load",postHeight,{once:true});if("ResizeObserver"in window&&document.body)new ResizeObserver(postHeight).observe(document.body);setTimeout(postHeight,250);setTimeout(postHeight,1000);setTimeout(postHeight,2500);setTimeout(postHeight,5000)})();</script>`, { html: true });
  }
}

export async function renderNativeContinuationResponse(request, manifest) {
  const originResponse = await fetch(buildOriginRequest(request), { cf: { cacheEverything: false, cacheTtl: 0 } });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) return originResponse;
  const phone = currentPhone(request, manifest);
  let html = await originResponse.text();
  html = normalizeIdentityAndPhone(stripDirectAnalytics(html), manifest, phone);
  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("x-vtr-resi-edge-package", RESI_EDGE_RUNTIME_VERSION);
  headers.set("x-vtr-release-token", RESI_EDGE_RELEASE_TOKEN_VERSION);
  headers.set("x-vtr-native-continuation", "1");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", 'vtr_native_continuation;desc="lazy"');
  return new HTMLRewriter()
    .on("head", new ContinuationHeadRewriter(manifest))
    .on("body", new ContinuationBodyRewriter())
    .transform(new Response(html, { status: originResponse.status, statusText: originResponse.statusText, headers }));
}

export async function renderDesktopPassthrough(request, manifest) {
  const originResponse = await fetch(request);
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) return originResponse;
  const phone = currentPhone(request, manifest);
  let html = await originResponse.text();
  html = normalizeIdentityAndPhone(stripDirectAnalytics(html), manifest, phone);
  if (!html.includes("data-vtr-edge-analytics")) {
    html = html.includes("</body>") ? html.replace("</body>", `${renderAnalyticsScript(manifest, "desktop_native", "edge_desktop_native_view")}</body>`) : `${html}${renderAnalyticsScript(manifest, "desktop_native", "edge_desktop_native_view")}`;
  }
  if (!html.includes("data-vtr-zaraz-consent-pill")) {
    html = html.includes("</body>") ? html.replace("</body>", `${renderZarazConsentPillScript()}</body>`) : `${html}${renderZarazConsentPillScript()}`;
  }
  if (!html.includes("data-vtr-cs-verify-suppress")) {
    html = html.includes("</head>") ? html.replace("</head>", `${renderContentsquareVerifySuppressScript()}</head>`) : `${renderContentsquareVerifySuppressScript()}${html}`;
  }
  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-vtr-resi-edge-package", RESI_EDGE_RUNTIME_VERSION);
  headers.set("x-vtr-desktop-mode", "native-passthrough");
  headers.append("server-timing", 'vtr_desktop_native;desc="passthrough"');
  return new Response(html, { status: originResponse.status, statusText: originResponse.statusText, headers });
}

export function mobileShellHeaders() {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-vtr-resi-edge-package": RESI_EDGE_RUNTIME_VERSION,
    "x-vtr-release-token": RESI_EDGE_RELEASE_TOKEN_VERSION,
    "x-vtr-mobile-topper-production": "1",
  });
  headers.set("vary", "User-Agent");
  headers.append("server-timing", 'vtr_mobile_topper;desc="canonical"');
  return headers;
}
