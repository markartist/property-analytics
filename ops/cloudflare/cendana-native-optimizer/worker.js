import heroMobileWebp from "./assets/hero-mobile-720x1016.webp";
import heroMobileJpg from "./assets/hero-mobile-840x1186.jpg";
import heroDesktopWebp from "./assets/hero-desktop-1600x731.webp";
import heroDesktopJpg from "./assets/hero-desktop-1600x731.jpg";

const VERSION = "2026-08-05.cendana-native-uikit-guard-v8";
const HOSTNAME = "cendanalife.com";
const PREVIEW_HOSTNAME = "edge-preview.cendanalife.com";
const ORIGIN_HOSTNAME = "cendana.wpengine.com";
const PREVIEW_PARAM = "edge_native_preview";
const ASSET_BASE = "/assets/webops/cendana/home/";
const HERO_FALLBACK_RE = /data-src="[^"]*Cendana-District-West-Apartments-Hero[^"]*" data-sources="[^"]*" loading="eager" uk-img/;

const ASSETS = {
  [`${ASSET_BASE}hero-mobile-720x1016.webp`]: {
    body: heroMobileWebp,
    type: "image/webp",
  },
  [`${ASSET_BASE}hero-mobile-840x1186.jpg`]: {
    body: heroMobileJpg,
    type: "image/jpeg",
  },
  [`${ASSET_BASE}hero-desktop-1600x731.webp`]: {
    body: heroDesktopWebp,
    type: "image/webp",
  },
  [`${ASSET_BASE}hero-desktop-1600x731.jpg`]: {
    body: heroDesktopJpg,
    type: "image/jpeg",
  },
};

function isHtmlRequest(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") || accept.includes("*/*");
}

function isHomepage(url) {
  return (url.hostname === HOSTNAME || url.hostname === PREVIEW_HOSTNAME || url.hostname.endsWith(".workers.dev")) && (url.pathname === "/" || url.pathname === "");
}

function isManagedHost(url) {
  return url.hostname === HOSTNAME || url.hostname === PREVIEW_HOSTNAME || url.hostname.endsWith(".workers.dev");
}

function isLikelyMobile(request) {
  const ua = request.headers.get("user-agent") || "";
  return /android|iphone|ipod|mobile|blackberry|iemobile|opera mini/i.test(ua);
}

function clientAcceptsWebp(request) {
  return (request.headers.get("accept") || "").includes("image/webp");
}

function selectedHero(request) {
  const mobile = isLikelyMobile(request);
  const webp = clientAcceptsWebp(request);
  if (mobile) {
    return {
      href: webp ? `${ASSET_BASE}hero-mobile-720x1016.webp` : `${ASSET_BASE}hero-mobile-840x1186.jpg`,
      type: webp ? "image/webp" : "image/jpeg",
      marker: webp ? "mobile-webp" : "mobile-jpg",
      width: webp ? 720 : 840,
    };
  }
  return {
    href: webp ? `${ASSET_BASE}hero-desktop-1600x731.webp` : `${ASSET_BASE}hero-desktop-1600x731.jpg`,
    type: webp ? "image/webp" : "image/jpeg",
    marker: webp ? "desktop-webp" : "desktop-jpg",
    width: 1600,
  };
}

function serveAsset(request, asset) {
  return new Response(request.method === "HEAD" ? null : asset.body, {
    headers: {
      "content-type": asset.type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-vtr-cendana-native-optimizer": VERSION,
    },
  });
}

function isControlledPreviewHost(url) {
  return url.hostname === PREVIEW_HOSTNAME || url.hostname.endsWith(".workers.dev");
}

function isNativeAssetPath(url) {
  return /^\/(?:wp-content|wp-includes|wp-json)\//.test(url.pathname) || url.pathname === "/xmlrpc.php";
}

function originUrlFor(request) {
  const originUrl = new URL(request.url);
  originUrl.protocol = "https:";
  originUrl.hostname = ORIGIN_HOSTNAME;
  originUrl.searchParams.delete(PREVIEW_PARAM);
  return originUrl;
}

function cleanOriginRequest(request, originUrl) {
  const originHeaders = new Headers(request.headers);
  const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
  originHeaders.set("host", HOSTNAME);
  originHeaders.set("accept", originHeaders.get("accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  originHeaders.set("x-forwarded-host", HOSTNAME);
  originHeaders.set("x-forwarded-proto", "https");
  if (clientIp) {
    originHeaders.set("x-forwarded-for", clientIp);
    originHeaders.set("x-real-ip", clientIp);
    originHeaders.set("true-client-ip", clientIp);
  }
  const init = {
    method: request.method,
    headers: originHeaders,
    redirect: "follow",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }
  return new Request(originUrl.toString(), init);
}

async function proxyOriginRequest(request) {
  const originRequest = cleanOriginRequest(request, originUrlFor(request));
  const response = await fetch(originRequest);
  return response;
}

async function proxyNativeAsset(request) {
  const response = await proxyOriginRequest(request);
  const headers = new Headers(response.headers);
  headers.set("x-vtr-cendana-native-optimizer", VERSION);
  headers.set("x-vtr-cendana-native-asset-proxy", "workers-dev-preview");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function injectHeadHints(html, hero) {
  const hints = [
    `<link rel="preload" as="image" href="${hero.href}" type="${hero.type}" fetchpriority="high">`,
    `<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>`,
  ].filter((hint) => !html.includes(hint)).join("");
  if (!hints) return html;
  return html.replace(/<head([^>]*)>/i, `<head$1>${hints}`);
}

function rewriteHero(html, hero) {
  const sources = `[{"type":"${hero.type}","srcset":"${hero.href} ${hero.width}w","sizes":"100vw"}]`
    .replace(/"/g, "&quot;");
  const replacement = `data-src="${hero.href}" data-sources="${sources}" loading="eager" style="background-image: url('${hero.href}');" uk-img`;
  if (HERO_FALLBACK_RE.test(html)) {
    return html.replace(HERO_FALLBACK_RE, replacement);
  }
  return html;
}

function fixHeadMetadata(html) {
  return html.replaceAll("http://cendana.wpenginepowered.com", "https://cendanalife.com");
}

function delayedGtmScript() {
  return `<script data-vtr-delayed="gtm">(function(w,d){w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||function(){w.dataLayer.push(arguments);};var loaded=false;function load(reason){if(loaded)return;loaded=true;w.dataLayer.push({"gtm.start":new Date().getTime(),event:"gtm.js",vtrDelayReason:reason});var j=d.createElement("script");j.async=true;j.src="https://www.googletagmanager.com/gtm.js?id=GTM-MLNDMHCB";(d.head||d.documentElement).appendChild(j);}["pointerdown","keydown","touchstart","scroll"].forEach(function(evt){w.addEventListener(evt,function(){load(evt);},{once:true,passive:true});});w.addEventListener("load",function(){setTimeout(function(){load("load-plus-7500");},7500);},{once:true});setTimeout(function(){load("hard-12000");},12000);})(window,document);</script>`;
}

function delayGtm(html) {
  return html.replace(
    /<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/,
    `<!-- Google Tag Manager delayed by Venterra WebOps native optimizer -->${delayedGtmScript()}<!-- End Google Tag Manager -->`,
  );
}

function deferFirstPartyScripts(html) {
  return html.replace(
    /<script src="(https:\/\/cendanalife\.com\/wp-(?:includes|content)\/[^"]+\.js\?ver=[^"]+)"><\/script>/g,
    '<script defer src="$1"></script>',
  );
}

function guardInlineUikitIcons(html) {
  return html.replace(
    /<script([^>]*)>(\s*)UIkit\.icon\.add\(([\s\S]*?)\)<\/script>/g,
    '<script$1>(function(payload){function add(){if(window.UIkit&&UIkit.icon&&UIkit.icon.add){UIkit.icon.add(payload);return true;}return false;}if(!add()){var tries=0;var timer=setInterval(function(){tries+=1;if(add()||tries>80){clearInterval(timer);}},50);}})($3)</script>',
  );
}

function delayResiRuntime(html) {
  const resiScripts = [
    "https://cendanalife.com/wp-content/plugins/resi-elements-venterra/assets/app.js?ver=1.5.28",
    "https://cendanalife.com/wp-content/plugins/resi-elements-venterra/assets/ie-11.js?ver=1.5.28",
  ];
  let nextHtml = html;
  for (const src of resiScripts) {
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    nextHtml = nextHtml.replace(
      new RegExp(`<script[^>]+src="${escaped}"[^>]*><\\/script>`, "g"),
      "",
    );
  }
  if (nextHtml === html || nextHtml.includes("data-vtr-delayed=\"resi-runtime\"")) {
    return nextHtml;
  }
  const loader = `<script data-vtr-delayed="resi-runtime">(function(w,d){var loaded=false,scripts=${JSON.stringify(resiScripts)};function load(reason){if(loaded)return;loaded=true;w.dataLayer=w.dataLayer||[];w.dataLayer.push({event:"vtr_resi_runtime_load",vtrDelayReason:reason});scripts.forEach(function(src){var s=d.createElement("script");s.async=false;s.src=src;(d.body||d.documentElement).appendChild(s);});}["pointerdown","keydown","touchstart","scroll"].forEach(function(evt){w.addEventListener(evt,function(){load(evt);},{once:true,passive:true});});w.addEventListener("load",function(){setTimeout(function(){load("load-plus-8000");},8000);},{once:true});setTimeout(function(){load("hard-12000");},12000);})(window,document);</script>`;
  return nextHtml.replace("</body>", `${loader}</body>`);
}

function removeWordPressEmojiProbe(html) {
  return html.replace(
    /\s*<script id="wp-emoji-settings" type="application\/json">[\s\S]*?<\/script>\s*<script type="module">[\s\S]*?wp-emoji-loader\.min\.js[\s\S]*?<\/script>/,
    "",
  );
}

function responseHeaders(originHeaders, marker, preview) {
  const headers = new Headers(originHeaders);
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.set("x-vtr-cendana-native-optimizer", VERSION);
  headers.set("x-vtr-cendana-native-optimizer-mode", preview ? "preview" : "live");
  headers.append("server-timing", `vtr_cendana_native;desc="${marker}"`);
  if (preview) {
    headers.set("cache-control", "private, no-store");
    headers.delete("cf-cache-status");
  }
  const vary = headers.get("vary") || "";
  if (!/user-agent/i.test(vary)) {
    headers.set("vary", vary ? `${vary}, User-Agent` : "User-Agent");
  }
  return headers;
}

async function optimizeNative(request, preview) {
  const originRequest = cleanOriginRequest(request, originUrlFor(request));
  const originResponse = await fetch(originRequest);
  const contentType = originResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || originResponse.status !== 200) {
    return originResponse;
  }

  const hero = selectedHero(request);
  let html = await originResponse.text();
  html = fixHeadMetadata(html);
  html = rewriteHero(html, hero);
  html = injectHeadHints(html, hero);
  html = delayGtm(html);
  html = guardInlineUikitIcons(html);
  html = deferFirstPartyScripts(html);
  html = delayResiRuntime(html);
  html = removeWordPressEmojiProbe(html);

  return new Response(html, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders(originResponse.headers, hero.marker, preview),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const asset = ASSETS[url.pathname];
    if (asset) return serveAsset(request, asset);
    if (isManagedHost(url) && isNativeAssetPath(url)) {
      return proxyNativeAsset(request);
    }

    if (request.method !== "GET" || !isHomepage(url) || !isHtmlRequest(request)) {
      return isManagedHost(url) ? proxyOriginRequest(request) : fetch(request);
    }

    const preview = url.searchParams.get(PREVIEW_PARAM) === "1";
    const liveEnabled = env.OPTIMIZER_ENABLED === "true";
    if (!preview && !liveEnabled) {
      return isManagedHost(url) ? proxyOriginRequest(request) : fetch(request);
    }

    return optimizeNative(request, preview);
  },
};
