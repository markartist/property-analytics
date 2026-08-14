import heroMobileWebp from "./assets/hero-mobile-840x1494.webp";
import heroMobile720Webp from "./assets/hero-mobile-720x1282.webp";
import heroMobileJpg from "./assets/hero-mobile-840x1494.jpg";
import heroDesktopWebp from "./assets/hero-desktop-2000x1245.webp";
import heroDesktopJpg from "./assets/hero-desktop-2000x1245.jpg";
import homeFeaturesWebp from "./assets/home-features-760.webp";
import homeFeatures640Webp from "./assets/home-features-640.webp";
import homeFeaturesJpg from "./assets/home-features-760.jpg";
import homeAmenitiesWebp from "./assets/home-amenities-760.webp";
import homeAmenities640Webp from "./assets/home-amenities-640.webp";
import homeAmenitiesJpg from "./assets/home-amenities-760.jpg";
import { renderZarazConsentPillScript as renderSharedZarazConsentPillScript } from "../shared/resi-consent-widget/widget.mjs";

const VERSION = "2026-08-08.mobile-topper-production-cmp-v22";
const HERO_ORIGIN_URL = "https://dam.getresi.co/26106/conversions/Home-Hero-full.jpg";
const FEATURES_ORIGIN_URL = "https://dam.getresi.co/55957/conversions/Home-Features-web-full.jpg";
const AMENITIES_ORIGIN_URL = "https://dam.getresi.co/55228/conversions/Home-Amenities-web-full.jpg";
const ASSET_BASE = "/assets/resi-edge-assets/townestoneat359/home/";
const MOBILE_TOPPER_PARAM = "edge_mobile_topper";
const NATIVE_CONTINUATION_PARAM = "edge_native_continuation";

const PROPERTY = {
  name: "Townestone at 359",
  phone: "(346) 623-1550",
  phoneHref: "tel:+13466231550",
  cityState: "Richmond, TX",
  street: "11430 FM 359 Road",
  description:
    "Contemporary comfort meets everyday convenience in Richmond. Our 1 and 2 Bedroom apartment homes are designed to enhance every lifestyle, blending modern living with a welcoming community feel and placing you near shopping, dining, recreation, and major employment destinations throughout Richmond, Sugar Land, and Fort Bend County.",
  heroTitle: "Discover Your Everyday Escape.",
  heroSubtitle: "1 and 2 Bedroom Apartments in Richmond, TX",
  promoText: "Get up to 8 weeks free!",
  apartmentsHref: "/apartments/",
  tourHref: "https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/TX4FC",
  applyHref: "https://online.venterraliving.com/eOnlineLease/portal/createPipelineApplication/TX4FC",
  facebookHref: "https://www.facebook.com/TownestoneAt359/",
  instagramHref: "https://www.instagram.com/townestoneat359/",
};

const ASSETS = {
  [`${ASSET_BASE}hero-mobile-840x1494.webp`]: {
    body: heroMobileWebp,
    type: "image/webp",
  },
  [`${ASSET_BASE}hero-mobile-720x1282.webp`]: {
    body: heroMobile720Webp,
    type: "image/webp",
  },
  [`${ASSET_BASE}hero-mobile-840x1494.jpg`]: {
    body: heroMobileJpg,
    type: "image/jpeg",
  },
  [`${ASSET_BASE}hero-desktop-2000x1245.webp`]: {
    body: heroDesktopWebp,
    type: "image/webp",
  },
  [`${ASSET_BASE}hero-desktop-2000x1245.jpg`]: {
    body: heroDesktopJpg,
    type: "image/jpeg",
  },
  [`${ASSET_BASE}home-features-760.webp`]: {
    body: homeFeaturesWebp,
    type: "image/webp",
  },
  [`${ASSET_BASE}home-features-640.webp`]: {
    body: homeFeatures640Webp,
    type: "image/webp",
  },
  [`${ASSET_BASE}home-features-760.jpg`]: {
    body: homeFeaturesJpg,
    type: "image/jpeg",
  },
  [`${ASSET_BASE}home-amenities-760.webp`]: {
    body: homeAmenitiesWebp,
    type: "image/webp",
  },
  [`${ASSET_BASE}home-amenities-640.webp`]: {
    body: homeAmenities640Webp,
    type: "image/webp",
  },
  [`${ASSET_BASE}home-amenities-760.jpg`]: {
    body: homeAmenitiesJpg,
    type: "image/jpeg",
  },
};

function isHtmlRequest(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") || accept.includes("*/*");
}

function isHomepage(url) {
  return url.hostname === "townestoneat359.com" && (url.pathname === "/" || url.pathname === "");
}

function isLlmsTxt(url) {
  return url.hostname === "townestoneat359.com" && url.pathname === "/llms.txt";
}

function isLikelyMobile(request) {
  const ua = request.headers.get("user-agent") || "";
  return /android|iphone|ipod|mobile|blackberry|iemobile|opera mini/i.test(ua);
}

function shouldServeMobileTopper(request, url) {
  return isLikelyMobile(request);
}

function shouldServeNativeContinuation(url) {
  return url.searchParams.get(NATIVE_CONTINUATION_PARAM) === "1";
}

function nativeContinuationHref(request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set(NATIVE_CONTINUATION_PARAM, "1");
  url.searchParams.set("vtr_cv", VERSION);
  return `${url.pathname}${url.search}`;
}

function clientAcceptsWebp(request) {
  return (request.headers.get("accept") || "").includes("image/webp");
}

function selectedHero(request) {
  const mobile = isLikelyMobile(request);
  const webp = clientAcceptsWebp(request);
  if (mobile) {
    return {
      href: webp ? `${ASSET_BASE}hero-mobile-720x1282.webp` : `${ASSET_BASE}hero-mobile-840x1494.jpg`,
      type: webp ? "image/webp" : "image/jpeg",
      variant: webp ? "mobile-webp" : "mobile-jpg",
    };
  }
  return {
    href: `${ASSET_BASE}hero-desktop-2000x1245.${webp ? "webp" : "jpg"}`,
    type: webp ? "image/webp" : "image/jpeg",
    variant: webp ? "desktop-webp" : "desktop-jpg",
  };
}

function selectedSecondaryImages(request) {
  const ext = clientAcceptsWebp(request) ? "webp" : "jpg";
  if (ext === "webp") {
    return {
      features: `${ASSET_BASE}home-features-640.webp`,
      amenities: `${ASSET_BASE}home-amenities-640.webp`,
    };
  }
  return {
    features: `${ASSET_BASE}home-features-760.${ext}`,
    amenities: `${ASSET_BASE}home-amenities-760.${ext}`,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLlmsTxt() {
  return `# Townestone at 359

> Apartments in Richmond, TX
> Last updated: 08/06/2026

Important notes:
- Pricing, availability, specials, fees, lease terms, and policies may change. Verify current details on the Apartments page or by contacting the leasing office.
- This file highlights official property resources from Townestone at 359 and does not replace the full XML sitemap.

## Core Property Information

- [Homepage](https://townestoneat359.com/): Official overview of Townestone at 359.
- [Apartments](https://townestoneat359.com/apartments/): Floor plans, pricing, availability, bedroom and bathroom options, and current leasing details.
- [Features](https://townestoneat359.com/features/): Apartment features, interior finishes, home conveniences, and in-home details.
- [Amenities](https://townestoneat359.com/amenities/): Community amenities, shared spaces, resident services, and lifestyle details.
- [Gallery](https://townestoneat359.com/gallery/): Official property photos, apartment images, amenity photos, and visual context.
- [Neighborhood](https://townestoneat359.com/neighborhood/): Nearby shopping, dining, employers, schools, transportation, and local area context.

## Leasing And Contact

- [Specials](https://townestoneat359.com/specials/): Current leasing specials, promotions, and offer details when available.
- [Contact](https://townestoneat359.com/contact/): Leasing office contact information, tour requests, phone number, address, and inquiry form.

## Search

- [Search this site](https://townestoneat359.com/?s=): WordPress search results for official Townestone at 359 website content.

## Optional

- [XML Sitemap](https://townestoneat359.com/sitemaps.xml): Complete list of indexable URLs for this property website.
`;
}

function serveLlmsTxt() {
  return new Response(renderLlmsTxt(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-vtr-townestone-native-optimizer": VERSION,
      "x-vtr-llms-txt": "linked-markdown",
    },
  });
}

function renderMobileTopperAnalytics() {
  return `<script>(function(w,d){w.dataLayer=w.dataLayer||[];function emit(name,data){var payload=Object.assign({event:name,vtr_surface:"mobile_topper",vtr_site:"townestoneat359.com"},data||{});w.dataLayer.push(payload);if(w.zaraz&&typeof w.zaraz.track==="function"){try{w.zaraz.track(name,payload)}catch(e){}}}w.vtrTopperTrack=emit;emit("edge_mobile_topper_view");d.addEventListener("click",function(e){var el=e.target&&e.target.closest?e.target.closest("a[href],button"):null;if(!el)return;var label=(el.textContent||"").trim();var href=el.getAttribute("href")||"";if(href.indexOf("/apartments")!==-1||label==="Find Your Home")emit("find_your_home_click",{cta_label:label,cta_href:href});else if(href.indexOf("scheduleTour")!==-1||label.indexOf("Tour")!==-1)emit("schedule_tour_click",{cta_label:label,cta_href:href});else if(href.indexOf("createPipelineApplication")!==-1||label.indexOf("Apply")!==-1)emit("apply_now_click",{cta_label:label,cta_href:href});},{passive:true});})(window,document);</script>`;
}

function renderLotusIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="70.34" height="41.6" viewBox="0 0 70.34 41.6" aria-hidden="true" focusable="false"><path d="M28.24 10.31l6.91 7.17 6.91-7.17-6.91-7.17-6.91 7.17Zm6.91 10.33c-.35 0-.69-.14-.93-.4l-8.71-9.04c-.48-.5-.48-1.3 0-1.8L34.21.38c.49-.51 1.38-.51 1.86 0l8.71 9.04c.48.5.48 1.3 0 1.8l-8.71 9.04c-.24.25-.58.4-.92.4" fill="currentColor"/><path d="M66.24 27.18c-.04.04-.07.08-.11.12-.08.1-.17.19-.26.29-.05.06-.11.12-.16.18-.08.09-.16.18-.24.27-.06.06-.12.13-.18.19-.09.09-.17.18-.26.28-.07.07-.14.14-.21.21-.09.09-.17.18-.26.27-.07.07-.15.15-.22.22-.09.09-.18.19-.28.28-.08.08-.16.15-.23.23-.1.1-.19.19-.3.29-.08.08-.17.16-.26.24-.1.1-.2.19-.3.29-.09.08-.18.16-.27.25-.11.1-.21.19-.32.29-.09.08-.19.17-.28.25-.11.1-.22.19-.34.29-.1.08-.2.17-.3.25-.11.1-.23.19-.35.29-.1.08-.21.17-.31.25-.12.1-.24.19-.36.29-.11.08-.22.17-.32.25-.12.1-.25.19-.38.29-.11.08-.23.17-.34.25-.13.09-.26.19-.39.28-.12.08-.23.17-.35.25-.13.09-.27.18-.4.27-.12.08-.24.16-.36.24-.14.09-.27.18-.41.27-.13.08-.25.16-.38.24-.14.09-.28.17-.42.26-.13.08-.26.15-.39.23-.14.08-.29.17-.44.25-.13.07-.27.15-.4.22-.15.08-.3.16-.45.24-.14.07-.27.14-.41.21-.15.08-.31.15-.46.22-.14.07-.28.13-.42.2-.16.07-.32.14-.48.21-.14.06-.28.12-.43.18-.16.07-.33.13-.49.19-.14.06-.29.11-.44.16-.17.06-.34.12-.5.18-.15.05-.3.1-.45.15-.17.05-.34.1-.52.16-.15.04-.3.09-.45.13-.18.05-.35.09-.53.14-.15.04-.3.08-.46.11-.18.04-.37.08-.55.11-.15.03-.3.06-.45.09-.19.03-.38.06-.57.09-.15.02-.3.05-.45.07-.2.03-.4.04-.6.06-.15.02-.29.03-.44.05-.22.02-.44.03-.66.04-.13 0-.27.02-.4.02-.27 0-.54 0-.81 0h-.27c-.14 0-.28-.01-.42-.02h0c5.39-2.83 8.94-7.4 11.26-11.99.17-.02.34-.04.51-.06.63-.07 1.25-.12 1.87-.16.2-.01.41-.03.61-.04 1.14-.07 2.25-.1 3.29-.12h.88c1.65 0 3.11.06 4.28.13.19.01.38.02.56.04-.11.13-.22.26-.34.39M3.78 26.78c2.64-.18 7.2-.34 12 .21 2.33 4.61 5.9 9.19 11.32 12.02-5.1.25-10.24-1.38-15.33-4.9-3.66-2.53-6.43-5.48-7.99-7.33m10.54-12.74c.09.05.19.1.28.14 4.93 2.56 16.05 9.08 19.21 17.32-.76 2.37-.9 4.74-.43 7.07-7.13-1.65-12.52-6.39-16-14.13-1.82-4.06-2.67-8.01-3.05-10.4m41.71.01c-.97 6-4.93 21.86-19.96 24.74-3.14-11.71 13.86-21.61 19.96-24.74m14.23 11.13c-.18-.41-.57-.7-1.02-.76-.28-.04-6.34-.79-13.41-.17 2.64-6.44 3.07-12.21 3.08-12.33.03-.45-.18-.89-.55-1.14-.37-.26-.85-.31-1.27-.12-.29.13-7.3 3.25-13.7 8.41-3.77 3.04-6.51 6.15-8.21 9.28-1.71-3.13-4.45-6.24-8.21-9.28-6.4-5.16-13.4-8.28-13.7-8.41-.41-.18-.89-.14-1.27.12-.37.26-.58.69-.55 1.14 0 .12.44 5.89 3.08 12.33-7.07-.62-13.13.14-13.41.17-.45.06-.84.35-1.02.76-.18.41-.1.89.16 1.27.13.18 10.52 15.11 25.93 15.16h18.1c15.42-.2 25.63-14.98 25.75-15.16.26-.37.39-.85.21-1.27" fill="currentColor"/></svg>`;
}

function renderPhoneIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.4 2.2c.4-.2.9-.1 1.2.3l1.6 2.8c.3.4.2 1-.2 1.3l-1.2 1c.8 1.7 2.1 3 3.8 3.8l1-1.2c.3-.4.9-.5 1.3-.2l2.8 1.6c.4.2.6.7.4 1.2l-.9 3c-.2.6-.7 1-1.3 1C8.4 16.8 3.2 11.6 3.2 5.1c0-.6.4-1.2 1-1.3l2.2-1.6Z"/></svg>`;
}

function renderSocialIcon(type) {
  if (type === "facebook") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.4 8.1h2.2V4.5h-2.9c-3.3 0-5.1 2-5.1 5v2H5.7v3.7h2.9v8.3h4v-8.3h3.1l.5-3.7h-3.6V9.9c0-1.1.3-1.8 1.8-1.8Z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="4.5" ry="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16.8" cy="7.2" r="1.2" fill="currentColor"/></svg>`;
}

function renderMobileTopperBehavior() {
  return `<script>(function(w,d){var drawer=d.querySelector("[data-drawer]");var scrim=d.querySelector("[data-drawer-scrim]");var menu=d.querySelector("[data-drawer-open]");var close=d.querySelector("[data-drawer-close]");var promo=d.querySelector("[data-promo-toggle]");var promoDrop=d.querySelector("[data-promo-drop]");var promoClose=d.querySelector("[data-promo-close]");function track(name,data){if(w.vtrTopperTrack)w.vtrTopperTrack(name,data||{});}function setDrawer(open){if(!drawer)return;drawer.dataset.open=open?"true":"false";drawer.setAttribute("aria-hidden",open?"false":"true");if(open){drawer.removeAttribute("inert");}else{drawer.setAttribute("inert","");}if(scrim)scrim.hidden=!open;d.documentElement.classList.toggle("drawer-open",open);track(open?"mobile_menu_open":"mobile_menu_close");}function setPromo(open){if(!promoDrop)return;promoDrop.hidden=!open;promo.setAttribute("aria-expanded",open?"true":"false");track(open?"promo_open":"promo_close");}if(menu)menu.addEventListener("click",function(){setDrawer(true);});if(close)close.addEventListener("click",function(){setDrawer(false);});if(scrim)scrim.addEventListener("click",function(){setDrawer(false);});if(promo)promo.addEventListener("click",function(e){e.preventDefault();setPromo(promoDrop.hidden);});if(promoClose)promoClose.addEventListener("click",function(){setPromo(false);});d.addEventListener("keydown",function(e){if(e.key==="Escape"){setDrawer(false);setPromo(false);}});})(window,document);</script>`;
}

function renderNativeContinuationShell(request) {
  const src = nativeContinuationHref(request);
  return `<section class="native-continuation" data-native-continuation data-native-continuation-state="idle" aria-label="Native site continuation">
<div class="native-continuation-status" aria-live="polite"></div>
<iframe class="native-continuation-frame" title="${escapeHtml(PROPERTY.name)} native site continuation" loading="lazy" data-src="${src}" hidden></iframe>
</section>`;
}

function renderNativeContinuationLoader() {
  return `<script data-vtr-native-continuation-loader="1">(function(w,d){
var section=d.querySelector("[data-native-continuation]");
if(!section)return;
var frame=section.querySelector(".native-continuation-frame");
var status=section.querySelector(".native-continuation-status");
var loaded=false;
function track(name,data){if(w.vtrTopperTrack)w.vtrTopperTrack(name,data||{});}
function setState(state,message){section.setAttribute("data-native-continuation-state",state);if(status)status.textContent=message||"";}
function load(reason){
  if(loaded||!frame)return;
  loaded=true;
  setState("loading","Loading the native site.");
  frame.hidden=false;
  frame.src=frame.getAttribute("data-src");
  frame.addEventListener("load",function(){setState("loaded","");},{once:true});
  track("native_continuation_load",{reason:reason||"unknown"});
}
w.addEventListener("message",function(event){
  if(event.origin!==w.location.origin)return;
  var data=event.data||{};
  if(data.type!=="vtr-native-continuation-height"||!frame)return;
  var reported=Number(data.height)||0;
  if(reported<=0)return;
  frame.style.height=Math.max(640,Math.min(12000,Math.ceil(reported)))+"px";
});
if("IntersectionObserver" in w){
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){if(entry.isIntersecting){observer.disconnect();load("scroll");}});
  },{rootMargin:"0px 0px",threshold:0.01});
  observer.observe(section);
}else{
  w.addEventListener("load",function(){setTimeout(function(){load("fallback");},1500);},{once:true});
}
})(window,document);</script>`;
}

function renderMobileTopper(request) {
  const hero = selectedHero(request);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: PROPERTY.name,
    url: "https://townestoneat359.com/",
    address: {
      "@type": "PostalAddress",
      streetAddress: PROPERTY.street,
      addressLocality: "Richmond",
      addressRegion: "TX",
      postalCode: "77406",
      addressCountry: "US",
    },
    telephone: "+13466231550",
    image: `https://townestoneat359.com${hero.href}`,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>${escapeHtml(PROPERTY.name)} Apartments in ${escapeHtml(PROPERTY.cityState)}</title>
<meta name="description" content="${escapeHtml(PROPERTY.description)}">
<link rel="canonical" href="https://townestoneat359.com/">
<link rel="icon" href="/wp-content/uploads/2026/01/favicon.png" sizes="any">
<link rel="icon" href="/wp-content/uploads/2026/01/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/wp-content/uploads/2026/01/apple-touch-icon.png">
<link rel="preload" as="image" href="${hero.href}" type="${hero.type}" fetchpriority="high">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
@font-face{font-family:Poppins;src:url("https://townestoneat359.com/wp-content/themes/resi-child-theme/fonts/poppins-581f0b26.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:Poppins;src:url("https://townestoneat359.com/wp-content/themes/resi-child-theme/fonts/poppins-2b4d4a2f.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:Poppins;src:url("https://townestoneat359.com/wp-content/themes/resi-child-theme/fonts/poppins-5d280ea4.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:Merriweather;src:url("https://townestoneat359.com/wp-content/themes/resi-child-theme/fonts/merriweather-8b1e9ec0.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:nevisbold;src:url("https://townestoneat359.com/wp-content/themes/resi-child-theme/fonts/nevis_3-webfont.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap}
:root{--resi-blue:#254152;--navy:#15284B;--button:#125F75;--muted:#ECEDDD;--white:#FFFFFF;--text:#434341;--shadow:rgba(21,40,75,.22)}
*{box-sizing:border-box}html{font-size:18px;background:#fff;color:var(--text)}body{margin:0;background:#fff;color:var(--text);font-family:Poppins,Arial,sans-serif;font-size:18px;font-weight:400;line-height:1.625;text-rendering:optimizeLegibility}a{color:inherit;text-decoration:none}button{font:inherit}img{max-width:100%;height:auto;display:block}.drawer-open{overflow:hidden}
.promo-wrap{position:relative;z-index:1100}.promo{width:100%;height:60px;border:0;border-radius:0;background:var(--resi-blue);color:#fff;display:flex;align-items:center;justify-content:center;padding:0 18px;font-family:Poppins,Arial,sans-serif;font-size:18px;font-weight:700;line-height:60px;letter-spacing:0;text-align:center}.promo svg{width:18px;height:18px;margin-left:10px;stroke:currentColor;stroke-width:2;fill:none;transition:transform .15s ease}.promo[aria-expanded="true"] svg{transform:rotate(180deg)}.promo-drop{position:absolute;top:60px;left:0;width:100%;z-index:1020;background:var(--muted);color:var(--text);padding:20px 20px 20px;text-align:center;box-shadow:0 18px 35px rgba(0,0,0,.15)}.promo-drop[hidden]{display:none}.promo-close{position:absolute;right:15px;top:10px;width:20px;height:20px;border:0;background:transparent;color:var(--text);font-size:28px;line-height:20px;padding:0}.promo-drop h3{margin:0 28px 20px;font-family:nevisbold,Poppins,sans-serif;font-size:19px;font-weight:600;line-height:26.6px;letter-spacing:.5px}.promo-drop p{margin:0 auto 40px;max-width:320px;font-size:18px;line-height:29.25px}.promo-actions{display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap}.promo-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:180px;padding:0 20px;border:2px solid var(--button);border-radius:50px;background:var(--button);color:#fff;font-family:Poppins,Arial,sans-serif;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px}.promo-actions a.secondary{min-width:0;min-height:0;height:28px;border:0;background:transparent;color:var(--text);padding:0;font-size:14px;line-height:28px;letter-spacing:1.5px}
.bar{height:80px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 15px;color:var(--text);position:relative;z-index:990}.brand{height:80px;display:flex;align-items:center;font-family:nevisbold,Poppins,sans-serif;font-size:10px;font-weight:600;line-height:16.25px;letter-spacing:2px;text-transform:uppercase;white-space:nowrap}.actions{height:80px;display:flex;align-items:center;gap:20px}.phone{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:var(--text)}.phone svg{display:block;width:20px;height:20px;fill:currentColor}.tour{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border:2px solid var(--text);border-radius:50px;color:var(--text);background:#fff;font-family:Poppins,Arial,sans-serif;font-size:11.5px;font-weight:900;line-height:40px;letter-spacing:1.5px}.hamb{position:relative;width:20px;height:80px;border:0;background:transparent;color:var(--text);padding:0;cursor:pointer}.hamb:before,.hamb:after,.hamb span{content:"";position:absolute;left:0;right:0;height:2px;background:currentColor}.hamb:before{top:31px}.hamb span{top:39px}.hamb:after{top:47px}
.hero{height:704px;min-height:704px;position:relative;overflow:hidden;background:var(--resi-blue);display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 15px}.hero-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0}.hero::after{content:"";position:absolute;inset:0;background:rgba(21,40,75,.34);z-index:1}.hero-inner{width:360px;max-width:100%;position:relative;z-index:2;margin-top:7px}.hero h1{font-family:Merriweather,Georgia,serif;font-style:italic;font-size:28.8px;line-height:28.8px;margin:0 auto 9px;font-weight:400;letter-spacing:.5px;color:#fff}.hero p{font-family:nevisbold,Poppins,sans-serif;font-size:19px;line-height:26.6px;margin:0 auto 34px;font-weight:600;max-width:360px;color:#fff}.cta{display:inline-flex;align-items:center;justify-content:center;min-width:197px;min-height:50px;border:2px solid #fff;border-radius:50px;padding:0 30px;background:#fff;color:var(--text);font-family:nevisbold,Poppins,sans-serif;font-size:14px;font-weight:600;line-height:46px;letter-spacing:1.5px;transition:background-color .15s ease,color .15s ease,border-color .15s ease}.cta span{font-size:18px;margin-left:10px}.cta:hover,.cta:focus-visible{background:transparent;color:#fff;border-color:#fff;outline:0}
.native-continuation{min-height:640px;background:#fff;color:var(--text)}.native-continuation-status{min-height:28px;padding:14px 15px;text-align:center;font-family:Poppins,Arial,sans-serif;font-size:11px;font-weight:700;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:var(--text)}.native-continuation-frame{display:block;width:100%;min-height:640px;border:0;background:#fff}.native-continuation-frame[hidden]{display:none}.native-continuation[data-native-continuation-state="idle"] .native-continuation-status{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.native-continuation[data-native-continuation-state="loaded"]{min-height:0}.native-continuation[data-native-continuation-state="loaded"] .native-continuation-status{display:none}
.drawer-scrim{position:fixed;inset:0;z-index:1190;background:rgba(0,0,0,.45)}.drawer-scrim[hidden]{display:none}.drawer{position:fixed;top:0;right:0;bottom:0;z-index:1200;width:270px;height:100svh;min-height:100vh;padding:50px 25px 34px;background:var(--resi-blue);color:#fff;box-shadow:-20px 0 60px var(--shadow);transform:translateX(105%);transition:transform .18s ease;overflow:auto}.drawer[data-open="true"]{transform:translateX(0)}.drawer-close{position:absolute;top:5px;right:5px;width:37px;height:37px;border:0;background:transparent;color:#fff;font-size:34px;font-weight:300;line-height:37px;padding:0;cursor:pointer}.drawer-logo{display:block;width:40px;height:auto;margin:0 0 20px;color:#fff}.drawer-logo svg{display:block;width:40px;height:auto}.drawer nav{display:grid;gap:0;margin:0}.drawer nav a{display:block;padding:8px 0;color:#fff;font-family:nevisbold,Poppins,sans-serif;font-size:15px;font-weight:700;line-height:24.375px;letter-spacing:.75px}.drawer-actions{display:flex;align-items:center;gap:10px;margin:20px 0 17px}.drawer-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border:2px solid rgba(255,255,255,.72);border-radius:50px;font-family:Poppins,Arial,sans-serif;font-size:14px;font-weight:900;line-height:46px;letter-spacing:1.5px;white-space:nowrap;color:#fff}.drawer-actions a:first-child{background:#fff;color:var(--resi-blue);border-color:#fff}.drawer-phone{display:block;color:#fff;font-family:Poppins,Arial,sans-serif;font-size:14px;font-weight:900;line-height:28px;letter-spacing:1.5px}.socials{display:flex;gap:22px;margin-top:20px}.socials a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:2px solid #fff;border-radius:50%;color:#fff}.socials svg{width:16px;height:16px;fill:currentColor}
</style>
</head>
<body>
<div class="promo-wrap"><button class="promo" data-promo-toggle aria-expanded="false">${escapeHtml(PROPERTY.promoText)} <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5"/></svg></button><div class="promo-drop" data-promo-drop hidden><button class="promo-close" data-promo-close aria-label="Close special">×</button><h3>${escapeHtml(PROPERTY.promoText)}</h3><p>Receive an additional $750 if you sign a 15+ month term. Limited time only.</p><div class="promo-actions"><a href="${PROPERTY.apartmentsHref}">See Availability</a><a class="secondary" href="/contact/">Contact Us</a></div></div></div>
<header class="bar"><a class="brand" href="/">${escapeHtml(PROPERTY.name)}</a><div class="actions"><a class="phone" href="${PROPERTY.phoneHref}" aria-label="Call ${escapeHtml(PROPERTY.name)}">${renderPhoneIcon()}</a><a class="tour" href="${PROPERTY.tourHref}">Tour</a><button class="hamb" data-drawer-open aria-label="Menu" aria-controls="mobile-drawer"><span></span></button></div></header>
<div class="drawer-scrim" data-drawer-scrim hidden></div>
<aside class="drawer" id="mobile-drawer" data-drawer data-open="false" aria-hidden="true" inert><button class="drawer-close" data-drawer-close aria-label="Close menu">×</button><a class="drawer-logo" href="/" aria-label="${escapeHtml(PROPERTY.name)} home">${renderLotusIcon()}</a><nav aria-label="Mobile menu"><a href="${PROPERTY.apartmentsHref}">Apartments &amp; Pricing</a><a href="/features/">Features</a><a href="/amenities/">Amenities</a><a href="/gallery/">Gallery</a><a href="/neighborhood/">Neighborhood</a><a href="/faqs/">FAQs</a><a href="/contact/">Contact</a><a href="/specials/">Specials</a></nav><div class="drawer-actions"><a href="${PROPERTY.tourHref}">Tour</a><a href="${PROPERTY.applyHref}">Apply</a></div><a class="drawer-phone" href="${PROPERTY.phoneHref}">${escapeHtml(PROPERTY.phone)}</a><div class="socials" aria-label="Social links"><a href="${PROPERTY.facebookHref}" rel="noopener" aria-label="Facebook">${renderSocialIcon("facebook")}</a><a href="${PROPERTY.instagramHref}" rel="noopener" aria-label="Instagram">${renderSocialIcon("instagram")}</a></div></aside>
<main>
<section class="hero"><img class="hero-media" src="${hero.href}" width="840" height="1494" alt="" fetchpriority="high" decoding="sync"><div class="hero-inner"><h1>${escapeHtml(PROPERTY.heroTitle)}</h1><p>${escapeHtml(PROPERTY.heroSubtitle)}</p><a class="cta" href="${PROPERTY.apartmentsHref}">Find Your Home <span>→</span></a></div></section>
${renderNativeContinuationShell(request)}
</main>
${renderMobileTopperAnalytics()}
${renderSharedZarazConsentPillScript()}
${renderMobileTopperBehavior()}
${renderNativeContinuationLoader()}
</body>
</html>`;
}

function serveAsset(request, asset) {
  return new Response(request.method === "HEAD" ? null : asset.body, {
    headers: {
      "content-type": asset.type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-vtr-townestone-native-optimizer": VERSION,
    },
  });
}

function injectPreload(html, hero) {
  const hints = [
    `<link rel="preconnect" href="https://use.typekit.net" crossorigin>`,
    `<link rel="preconnect" href="https://p.typekit.net" crossorigin>`,
    `<link rel="preload" as="image" href="${hero.href}" type="${hero.type}" fetchpriority="high">`,
  ].filter((hint) => !html.includes(hint)).join("");
  if (!hints) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${hints}`);
  }
  if (html.includes("</head>")) {
    return html.replace("</head>", `${hints}</head>`);
  }
  return html;
}

function rewriteHero(html, hero) {
  const target = `data-src="${HERO_ORIGIN_URL}" loading="eager" uk-img`;
  const replacement = `data-src="${hero.href}" style="background-image: url('${hero.href}');" loading="eager" uk-img`;
  if (html.includes(target)) {
    return html.replace(target, replacement);
  }
  return html.replaceAll(HERO_ORIGIN_URL, hero.href);
}

function rewriteSecondaryImages(html, images) {
  return html
    .replaceAll(FEATURES_ORIGIN_URL, images.features)
    .replaceAll(AMENITIES_ORIGIN_URL, images.amenities);
}

function disableHeroScrollspy(html) {
  const marker = 'data-page-section="hero"';
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const sectionStart = html.lastIndexOf("<div", start);
  const nextSection = html.indexOf('data-page-section="welcome"', start);
  if (sectionStart < 0 || nextSection < 0) return html;
  const before = html.slice(0, sectionStart);
  const section = html
    .slice(sectionStart, nextSection)
    .replace(/\suk-scrollspy="[^"]*"/g, "")
    .replace(/\suk-scrollspy-class(?:="[^"]*")?/g, "");
  const after = html.slice(nextSection);
  return `${before}${section}${after}`;
}

function delayedResiWidgetScript() {
  return `<script data-vtr-delayed="resi-widget">(function(w,d){w.riAptId="93facd9f-ef7e-4faf-a75f-51cfb96eb7c1";w.riBaseUrl="https://app.getresi.com/";var loaded=false;function load(reason){if(loaded)return;loaded=true;w.__vtrResiWidgetLoadReason=reason;var script=d.createElement("script");script.type="text/javascript";script.async=true;script.src="https://app.getresi.com/widget/loader.js";(d.head||d.documentElement).appendChild(script);}["pointerdown","keydown","touchstart"].forEach(function(evt){w.addEventListener(evt,function(){load(evt);},{once:true,passive:true});});w.addEventListener("load",function(){setTimeout(function(){load("load-plus-7500");},7500);},{once:true});setTimeout(function(){load("hard-12000");},12000);})(window,document);</script>`;
}

function stripLegacyAnalytics(html) {
  let next = html;
  next = next.replace(/\s*<script>\s*window\.HEAP_JS_DEBUG\s*=\s*true;\s*<\/script>\s*/gi, "\n");
  next = next.replace(/\s*<script[^>]+js\.getresi\.co\/pixel\/[^"'\s<>]+\/resi-pixel\.iife\.js[^>]*><\/script>\s*/gi, "\n");
  next = next.replace(/\s*<!--\s*Google Tag Manager(?: delayed by Venterra WebOps native optimizer)?\s*-->[\s\S]*?<!--\s*End Google Tag Manager\s*-->\s*/gi, "\n");
  next = next.replace(/\s*<!--\s*Google Tag Manager \(noscript\)\s*-->[\s\S]*?<!--\s*End Google Tag Manager \(noscript\)\s*-->\s*/gi, "\n");
  next = next.replace(/\s*<noscript><iframe[^>]+googletagmanager\.com\/ns\.html\?id=GTM-PXD58MGM[\s\S]*?<\/iframe><\/noscript>\s*/gi, "\n");
  next = next.replace(/\s*<!--\s*Google tag \(gtag\.js\) event\s*-->\s*<script>\s*gtag\([\s\S]*?click_to_call___30_lines[\s\S]*?<\/script>\s*/gi, "\n");
  return next;
}

function normalizeTrackingAttributes(html) {
  return html
    .replace(/\sdata-property-name="[^"]*"/i, ' data-property-name="Townestone at 359"')
    .replace(/\sdata-property-code="[^"]*"/i, ' data-property-code="TX4FC"');
}

function normalizePhoneNumber(html) {
  return html
    .replace(/tel:\+?1?5128007701/gi, "tel:+13466231550")
    .replace(/tel:\(?512\)?[\s.-]*800[\s.-]*7701/gi, "tel:+13466231550")
    .replace(/\+15128007701/g, "+13466231550")
    .replace(/15128007701/g, "13466231550")
    .replace(/\(?512\)?[\s.-]*800[\s.-]*7701/g, "(346) 623-1550");
}

function delayNativeLoaders(html) {
  let next = normalizePhoneNumber(normalizeTrackingAttributes(stripLegacyAnalytics(html)));
  next = next.replace(
    /<!--StartResiEmbedCode-->[\s\S]*?<!--EndResiEmbedCode-->/,
    `<!--StartResiEmbedCode delayed by Venterra WebOps native optimizer-->${delayedResiWidgetScript()}<!--EndResiEmbedCode-->`,
  );
  next = next.replace(
    /<script id="resi-pixel-js" src="https:\/\/js\.getresi\.co\/pixel\/latest\/resi-pixel\.iife\.js"><\/script>/,
    "\n",
  );
  next = next.replace(
    /\s*<script id="wp-emoji-settings" type="application\/json">[\s\S]*?<\/script>\s*<script type="module">[\s\S]*?sourceURL=https:\/\/townestoneat359\.com\/wp-includes\/js\/wp-emoji-loader\.min\.js[\s\S]*?<\/script>/,
    "",
  );
  return next;
}

function injectZarazConsentPill(html) {
  if (html.includes("data-vtr-zaraz-consent-pill")) return html;
  const script = renderSharedZarazConsentPillScript();
  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }
  return `${html}${script}`;
}

function buildNativeHomepageRequest(request) {
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

function addClassName(existing, className) {
  const classes = new Set(String(existing || "").split(/\s+/).filter(Boolean));
  String(className || "").split(/\s+/).filter(Boolean).forEach((value) => classes.add(value));
  return Array.from(classes).join(" ");
}

function nativeContinuationHiddenCss() {
  return `body.vtr-native-continuation .tm-header,
body.vtr-native-continuation .tm-header-mobile,
body.vtr-native-continuation [data-page-section="promo_bar"],
body.vtr-native-continuation [data-component-name="open_promo_bar"],
body.vtr-native-continuation [data-page-section="hero"]{display:none!important}`;
}

class NativeContinuationHeadRewriter {
  element(element) {
    element.prepend(`<base href="https://townestoneat359.com/">`, { html: true });
    element.append(`<style data-vtr-native-continuation="1">
${nativeContinuationHiddenCss()}
html{margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important}
body{margin:0!important;padding:0!important;background:#fff!important}
.vtr-native-continuation-frame-marker{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
</style>`, { html: true });
  }
}

class NativeContinuationBodyRewriter {
  element(element) {
    element.setAttribute("class", addClassName(element.getAttribute("class") || "", "vtr-native-continuation"));
    element.prepend(`<div class="vtr-native-continuation-frame-marker" data-vtr-native-continuation-frame="1">Native continuation loaded</div>`, { html: true });
    element.append(`<script data-vtr-native-continuation-resize="1">(function(){
function postHeight(){
  var body=document.body, doc=document.documentElement;
  var height=Math.max(body?body.scrollHeight:0,body?body.offsetHeight:0,doc?doc.scrollHeight:0,doc?doc.offsetHeight:0);
  try{parent.postMessage({type:"vtr-native-continuation-height",height:height},location.origin)}catch(e){}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",postHeight,{once:true});}else{postHeight();}
addEventListener("load",postHeight,{once:true});
if("ResizeObserver" in window&&document.body){new ResizeObserver(postHeight).observe(document.body);}
setTimeout(postHeight,250);setTimeout(postHeight,1000);setTimeout(postHeight,2500);setTimeout(postHeight,5000);
})();</script>`, { html: true });
  }
}

async function renderNativeContinuationResponse(request) {
  const originRequest = buildNativeHomepageRequest(request);
  const originResponse = await fetch(originRequest, {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) {
    return originResponse;
  }

  const hero = selectedHero(request);
  const secondaryImages = selectedSecondaryImages(request);
  let html = await originResponse.text();
  html = rewriteHero(html, hero);
  html = rewriteSecondaryImages(html, secondaryImages);
  html = disableHeroScrollspy(html);
  html = injectPreload(html, hero);
  html = delayNativeLoaders(html);

  const headers = new Headers(originResponse.headers);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("x-vtr-townestone-native-optimizer", VERSION);
  headers.set("x-vtr-mobile-topper-continuation", "1");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.append("server-timing", 'vtr_native_continuation;desc="lazy"');

  return new HTMLRewriter()
    .on("head", new NativeContinuationHeadRewriter())
    .on("body", new NativeContinuationBodyRewriter())
    .transform(new Response(html, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    }));
}

function responseHeaders(originHeaders, marker) {
  const headers = new Headers(originHeaders);
  headers.delete("content-length");
  headers.set("x-vtr-townestone-native-optimizer", VERSION);
  headers.append("server-timing", `vtr_townestone_native;desc="${marker}"`);
  const vary = headers.get("vary") || "";
  if (!/user-agent/i.test(vary)) {
    headers.set("vary", vary ? `${vary}, User-Agent` : "User-Agent");
  }
  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const asset = ASSETS[url.pathname];
    if (asset) return serveAsset(request, asset);

    if (isLlmsTxt(url) && request.method === "GET") {
      return serveLlmsTxt();
    }

    if (env.OPTIMIZER_ENABLED !== "true") {
      return fetch(request);
    }

    if (request.method !== "GET" || !isHtmlRequest(request)) {
      return fetch(request);
    }

    if (isHomepage(url) && shouldServeNativeContinuation(url)) {
      return renderNativeContinuationResponse(request);
    }

    if (isHomepage(url) && shouldServeMobileTopper(request, url)) {
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-vtr-townestone-native-optimizer": VERSION,
        "x-vtr-mobile-topper-production": "1",
      });
      headers.set("vary", "User-Agent");
      headers.append("server-timing", 'vtr_mobile_topper;desc="production"');
      return new Response(renderMobileTopper(request), { headers });
    }

    const originResponse = await fetch(request);
    const contentType = originResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html") || originResponse.status !== 200) {
      return originResponse;
    }

    const hero = selectedHero(request);
    const secondaryImages = selectedSecondaryImages(request);
    let html = await originResponse.text();
    if (isHomepage(url)) {
      html = rewriteHero(html, hero);
      html = rewriteSecondaryImages(html, secondaryImages);
      html = disableHeroScrollspy(html);
      html = injectPreload(html, hero);
      html = delayNativeLoaders(html);
    } else {
      html = normalizePhoneNumber(normalizeTrackingAttributes(stripLegacyAnalytics(html)));
    }
    html = injectZarazConsentPill(html);

    return new Response(html, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders(originResponse.headers, isHomepage(url) ? hero.variant : "legacy-analytics-cleanup"),
    });
  },
};
