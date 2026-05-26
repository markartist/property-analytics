const EDGE_MESSAGE_CONFIG = {
  id: "edge_transparent_pricing_intro_homepage_v1",
  configVersion: "2026-05-23-beta-7-testing-always-show",
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
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
  ignoreFrequencyCap: true,
  forceCookieName: "v_edge_msg_force_once",
  resetCookieName: "v_edge_msg_reset_once",
  cookieMaxAgeSeconds: 86400,
  forceParam: "edge_popup_force",
  resetParam: "edge_popup_reset",
  showDelayMs: 800,
  durationMs: 7000,
  fadeMs: 360,
  waitForUnitSelectors: false,
  brandName: "VENTERRA",
  propertyCode: "GA4AX",
  communityId: "eed3da54-7b7a-4dae-984b-a203113fc2f3",
  propertyName: "Apex West Midtown",
  brandColor: "#15284B",
  title: "Say hello to clearer\nmonthly pricing",
  body:
    "See base rent plus required monthly fees together, so your estimated monthly cost is easier to understand.",
  disclaimer: "Required monthly fees exclude variable fees and optional services.",
  autoCloseTextPrefix: "Closing in",
  closeLabel: "Close pricing message",
  analyticsEnabled: true
};

const EDGE_COACH_MARK_CONFIG = {
  id: "edge_message_all_in_pricing_coachmark_v1",
  configVersion: "2026-05-24-beta-10-admin-font-match",
  enabled: true,
  hostnames: ["pilot.venterradev.com"],
  pathExact: ["/apartments/"],
  pathIncludes: [],
  pathExcludes: ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  assetExtensions: EDGE_MESSAGE_CONFIG.assetExtensions,
  cookieName: "v_edge_coachmark_seen",
  ignoreFrequencyCap: true,
  cookieMaxAgeSeconds: 86400,
  showDelayMs: 300,
  durationMs: 9000,
  fadeMs: 260,
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
  closeLabel: "Close all-in pricing tip",
  analyticsEnabled: true
};

export default {
  async fetch(request, env) {
    const messageConfig = await getPublishedEdgeConfig(env, EDGE_MESSAGE_CONFIG);
    const coachMarkConfig = await getPublishedEdgeConfig(env, EDGE_COACH_MARK_CONFIG);
    const url = new URL(request.url);
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

    const originResponse = await fetch(request);
    const responseHeaders = new Headers(originResponse.headers);

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
    }
    if (shouldInject(request, originResponse, {}, coachMarkConfig)) {
      scripts.push(buildCoachMarkScript(coachMarkConfig));
    }

    if (scripts.length === 0) {
      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders
      });
    }

    const rewriter = new HTMLRewriter().on("body", {
      element(element) {
        element.append(scripts.join(""), { html: true });
      }
    });

    const rewritten = rewriter.transform(originResponse);
    return new Response(rewritten.body, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers: responseHeaders
    });
  }
};

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
    cookieName: config.cookieName,
    ignoreFrequencyCap: config.ignoreFrequencyCap,
    cookieMaxAgeSeconds: config.cookieMaxAgeSeconds,
    forceParam: config.forceParam,
    resetParam: config.resetParam,
    showDelayMs: config.showDelayMs,
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
    autoCloseTextPrefix: config.autoCloseTextPrefix,
    closeLabel: config.closeLabel,
    analyticsEnabled: config.analyticsEnabled,
    forceDisplay: Boolean(state.forceDisplay),
    resetStorage: Boolean(state.resetStorage)
  }).replace(/</g, "\\u003c");

  return `<script data-edge-message="${escapeAttribute(config.id)}">(function(){const c=${payload};const storageKey="v_edge_msg_seen_"+c.id;if(c.resetStorage)try{localStorage.removeItem(storageKey)}catch(e){}let seen=false;try{seen=!!localStorage.getItem(storageKey)}catch(e){}if(seen&&!c.forceDisplay&&!c.ignoreFrequencyCap)return;function ready(fn){const run=()=>("requestIdleCallback"in window?requestIdleCallback(fn,{timeout:1800}):setTimeout(fn,120));document.readyState==="loading"?addEventListener("DOMContentLoaded",run,{once:true}):run()}function waitForUnits(fn){const selector=".fs-switcher__items-container,.re-list-availability,[data-has_availability='true']";if(document.querySelector(selector)){fn();return}let tries=0;const timer=setInterval(()=>{tries+=1;if(document.querySelector(selector)||tries>=20){clearInterval(timer);fn()}},150)}function push(eventName,extra){if(!c.analyticsEnabled||!window.dataLayer)return;window.dataLayer.push(Object.assign({event:eventName,message_id:c.id,property_code:c.propertyCode,community_id:c.communityId,property_name:c.propertyName,source:"cloudflare_worker",config_version:c.configVersion,path:location.pathname},extra||{}))}function markSeen(){if(c.ignoreFrequencyCap)return;const maxAge=c.cookieMaxAgeSeconds;document.cookie=c.cookieName+"="+c.id+"; Max-Age="+maxAge+"; Path=/; Secure; SameSite=Lax";try{localStorage.setItem(storageKey,String(Date.now()))}catch(e){}}ready(()=>{const launch=()=>setTimeout(show,c.showDelayMs);c.waitForUnitSelectors?waitForUnits(launch):launch()});function show(){if(document.getElementById("v-edge-msg-overlay"))return;const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;const style=document.createElement("style");style.id="v-edge-msg-style";style.textContent=\`
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
#v-edge-msg-countdown{margin:0 0 16px;text-align:center;color:\${c.bodyColor||"#4b5565"};font-size:\${c.countdownFontSizePx||20}px;font-weight:900}
#v-edge-msg-progress{height:8px;overflow:hidden;border-radius:999px;background:#e4e9f0}
#v-edge-msg-progress span{display:block;height:100%;width:100%;border-radius:inherit;background:\${c.brandColor};transform-origin:left center;animation:vEdgeProgress \${c.durationMs}ms linear forwards}
#v-edge-msg-brand{display:flex;align-items:center;justify-content:center;margin:22px auto 0;color:\${c.brandColor}}
#v-edge-msg-brand svg{width:172px;max-width:54%;height:auto;display:block}
@keyframes vEdgeProgress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion: reduce){#v-edge-msg-overlay,#v-edge-msg-card{transition:none!important}#v-edge-msg-progress span{animation:none!important}}
@media (max-width:520px){#v-edge-msg-card{width:min(94vw,430px);padding:26px 22px 22px;border-radius:16px}#v-edge-msg-close{right:12px;top:12px;font-size:28px}#v-edge-msg-property{margin:0 38px 22px;font-size:16px}#v-edge-msg-title{font-size:clamp(28px,8.8vw,38px)}#v-edge-msg-body{margin-top:24px;font-size:17px;line-height:1.48}#v-edge-msg-disclaimer{font-size:13px;margin-bottom:24px}#v-edge-msg-countdown{font-size:18px}#v-edge-msg-brand svg{max-width:62%}}\`;const overlay=document.createElement("div");overlay.id="v-edge-msg-overlay";overlay.innerHTML=\`<section id="v-edge-msg-card" role="region" aria-labelledby="v-edge-msg-title" aria-describedby="v-edge-msg-body"><button id="v-edge-msg-close" type="button" aria-label="\${escapeHtml(c.closeLabel)}">&times;</button><p id="v-edge-msg-property">\${escapeHtml(c.propertyName)}</p><h2 id="v-edge-msg-title">\${escapeHtml(c.title)}</h2><p id="v-edge-msg-body">\${escapeHtml(c.body)}</p><p id="v-edge-msg-disclaimer">\${escapeHtml(c.disclaimer)}</p><p id="v-edge-msg-countdown" aria-live="polite"></p><div id="v-edge-msg-progress" aria-hidden="true"><span></span></div><div id="v-edge-msg-brand">\${c.brandLogoSvg}</div></section>\`;document.head.appendChild(style);document.body.appendChild(overlay);const close=overlay.querySelector("#v-edge-msg-close");const countdown=overlay.querySelector("#v-edge-msg-countdown");let remaining=Math.ceil(c.durationMs/1000);let dismissed=false;function setCountdown(){countdown.textContent=c.autoCloseTextPrefix+" "+remaining+" second"+(remaining===1?"":"s")}setCountdown();const interval=setInterval(()=>{remaining=Math.max(0,remaining-1);setCountdown()},1000);const timeout=setTimeout(()=>dismiss("auto"),c.durationMs);function dismiss(type){if(dismissed)return;dismissed=true;clearInterval(interval);clearTimeout(timeout);markSeen();push("edge_message_dismiss",{dismiss_type:type});overlay.classList.remove("v-edge-visible");setTimeout(()=>{overlay.remove();style.remove()},reduce?1:c.fadeMs+40)}close.addEventListener("click",()=>dismiss("x"));document.addEventListener("keydown",function keyHandler(event){if(dismissed){document.removeEventListener("keydown",keyHandler);return}if(event.key==="Escape")dismiss("escape")});requestAnimationFrame(()=>{overlay.classList.add("v-edge-visible");push("edge_message_view",{initiative:"transparent_pricing"})})}function escapeHtml(value){return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}})();</script>`;
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

  return `<script data-edge-message="${escapeAttribute(config.id)}">(function(){const c=${payload};const storageKey="v_edge_msg_seen_"+c.id;let seen=false;try{seen=!!localStorage.getItem(storageKey)}catch(e){}if(seen&&!c.ignoreFrequencyCap)return;function ready(fn){const run=()=>("requestIdleCallback"in window?requestIdleCallback(fn,{timeout:2200}):setTimeout(fn,160));document.readyState==="loading"?addEventListener("DOMContentLoaded",run,{once:true}):run()}function visible(el){if(!el)return false;const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>1&&r.height>1&&s.display!=="none"&&s.visibility!=="hidden"&&s.opacity!=="0"}function findTarget(){const nodes=Array.from(document.querySelectorAll("a,button"));return nodes.find((el)=>visible(el)&&(el.textContent||"").replace(/\\s+/g," ").trim().includes(c.targetText))||null}function push(eventName,extra){if(!c.analyticsEnabled||!window.dataLayer)return;window.dataLayer.push(Object.assign({event:eventName,message_id:c.id,property_code:c.propertyCode,community_id:c.communityId,property_name:c.propertyName,source:"cloudflare_worker",config_version:c.configVersion,path:location.pathname},extra||{}))}function markSeen(){if(c.ignoreFrequencyCap)return;document.cookie=c.cookieName+"="+c.id+"; Max-Age="+c.cookieMaxAgeSeconds+"; Path=/; Secure; SameSite=Lax";try{localStorage.setItem(storageKey,String(Date.now()))}catch(e){}}ready(()=>setTimeout(waitForTarget,c.showDelayMs));function waitForTarget(){let target=findTarget();if(target){watch(target);return}let tries=0;const timer=setInterval(()=>{tries+=1;target=findTarget();if(target||tries>=40){clearInterval(timer);if(target)watch(target)}},250)}function watch(target){if("IntersectionObserver"in window){const io=new IntersectionObserver((entries)=>{if(entries.some((entry)=>entry.isIntersecting)){io.disconnect();show(target)}},{threshold:.55});io.observe(target)}else show(target)}function show(target){if(document.getElementById("v-edge-coachmark")||!visible(target))return;const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;const style=document.createElement("style");style.id="v-edge-coachmark-style";style.textContent=\`
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
@media (max-width:620px){#v-edge-coachmark{left:14px!important;right:14px!important;top:auto!important;bottom:22px!important;max-width:none;border-radius:22px;padding:20px 50px 20px 22px}#v-edge-coachmark:after{display:none}#v-edge-coachmark-kicker{gap:12px;font-size:22px}#v-edge-coachmark-icon{width:38px;height:38px;font-size:22px}#v-edge-coachmark-body{font-size:20px}#v-edge-coachmark-close{right:12px;top:13px;font-size:30px}}\`;const tip=document.createElement("aside");tip.id="v-edge-coachmark";tip.setAttribute("role","status");tip.innerHTML=\`<button id="v-edge-coachmark-close" type="button" aria-label="\${escapeHtml(c.closeLabel)}">&times;</button><p id="v-edge-coachmark-kicker"><span id="v-edge-coachmark-icon" aria-hidden="true">!</span><span>\${escapeHtml(c.title)}</span></p><p id="v-edge-coachmark-body">\${escapeHtml(c.body)}</p>\`;document.head.appendChild(style);document.body.appendChild(tip);let dismissed=false;function place(){if(dismissed||!visible(target))return;const r=target.getBoundingClientRect();const t=tip.getBoundingClientRect();let left=r.left+r.width/2-t.width*.8;left=Math.max(14,Math.min(left,innerWidth-t.width-14));let top=r.top-t.height-18;if(top<14)top=r.bottom+18;tip.style.left=left+"px";tip.style.top=top+"px"}function dismiss(type){if(dismissed)return;dismissed=true;markSeen();push("edge_message_dismiss",{dismiss_type:type,surface:"coachmark"});tip.classList.remove("v-edge-visible");setTimeout(()=>{tip.remove();style.remove();removeEventListener("scroll",place,true);removeEventListener("resize",place)},reduce?1:c.fadeMs+40)}tip.querySelector("#v-edge-coachmark-close").addEventListener("click",()=>dismiss("x"));addEventListener("scroll",place,true);addEventListener("resize",place);place();requestAnimationFrame(()=>{place();tip.classList.add("v-edge-visible");push("edge_message_view",{initiative:"transparent_pricing",surface:"coachmark",target_text:c.targetText})});setTimeout(()=>dismiss("auto"),c.durationMs)}function escapeHtml(value){return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}})();</script>`;
}

function buildVenterraLogoSvg() {
  return `<svg aria-label="Venterra" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 439.78 59.81"><style>.v-edge-logo-fill{fill:currentColor}</style><path class="v-edge-logo-fill" d="M118.64,287.77h0a1.86,1.86,0,0,1-1.34-.57l-12.52-13a1.86,1.86,0,0,1,0-2.58l12.52-13a1.92,1.92,0,0,1,2.68,0l12.52,13a1.86,1.86,0,0,1,0,2.58L120,287.2A1.86,1.86,0,0,1,118.64,287.77Zm-9.93-14.85,9.93,10.31,9.94-10.31-9.94-10.31Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M130.38,314.13l.6,0-.6,0Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M169.11,294.29a1.86,1.86,0,0,0-1.47-1.09,100.21,100.21,0,0,0-19.28-.25,63.78,63.78,0,0,0,4.43-17.73,1.86,1.86,0,0,0-2.61-1.82,98.58,98.58,0,0,0-19.69,12.1c-5.41,4.37-9.36,8.85-11.81,13.34-2.45-4.49-6.4-9-11.81-13.34a98.57,98.57,0,0,0-19.69-12.1,1.86,1.86,0,0,0-2.61,1.82A63.78,63.78,0,0,0,89,293a100,100,0,0,0-19.28.25,1.81,1.81,0,0,0-1.23,2.91c.18.26,15.12,21.72,37.28,21.79h26c22.17-.28,36.84-21.52,37-21.78A1.9,1.9,0,0,0,169.11,294.29Zm-20.46-16c-1.39,8.62-7.08,31.42-28.69,35.57C115.45,297,139.9,282.79,148.66,278.29Zm-60,0,.4.21c7.09,3.67,23.07,13.06,27.61,24.9a20,20,0,0,0-.62,10.16c-10.26-2.37-18-9.18-23-20.32A60.45,60.45,0,0,1,88.7,278.29ZM73.54,296.6a98,98,0,0,1,17.25.3c3.35,6.63,8.48,13.21,16.28,17.29-7.34.36-14.72-2-22-7A60.49,60.49,0,0,1,73.54,296.6Zm89.79.57-.16.18-.37.42-.23.26-.35.39-.25.27-.37.4-.3.31-.38.39-.32.32-.4.41-.34.33-.42.41-.37.35-.44.41-.39.35-.46.42-.41.36-.48.42-.43.36-.5.42-.45.36-.52.42-.47.36-.54.41-.49.36-.56.4-.51.36-.58.39-.52.35-.59.38-.55.34-.61.37-.56.33-.63.36-.57.31-.65.34-.59.3-.67.32-.6.28-.69.3-.61.26-.71.28-.63.24-.73.25-.64.21-.74.22-.65.19-.77.19-.66.16-.79.16-.65.13-.82.13-.65.1-.86.09-.64.07-.95.05-.58,0H131l-.6,0h0c7.74-4.07,12.85-10.63,16.19-17.23l.73-.09q1.36-.14,2.69-.23l.88-.06c1.64-.1,3.23-.15,4.73-.17h1.27c2.37,0,4.47.09,6.15.19l.8.05Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M176.53,276.28a.83.83,0,0,1,.79-1.22h4.77a.86.86,0,0,1,.8.51l9,20.11h.33l9-20.11a.86.86,0,0,1,.79-.51h4.77a.83.83,0,0,1,.8,1.22L193,307.75a.84.84,0,0,1-.79.51h-.47a.84.84,0,0,1-.79-.51Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M225,276a.89.89,0,0,1,.89-.89h19a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89H231.07v7.67h11.55a.92.92,0,0,1,.89.89v3.88a.89.89,0,0,1-.89.89H231.07v8.18h13.84a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89h-19a.89.89,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M265.69,275.44a.88.88,0,0,1,.89-.84h1.17l19.45,20.67h0V276a.89.89,0,0,1,.89-.89h4.3a.92.92,0,0,1,.89.89v31.47a.88.88,0,0,1-.89.84h-1.12L271.77,286.8h0v20.11a.89.89,0,0,1-.89.89h-4.26a.92.92,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M319.43,280.67h-7.16a.89.89,0,0,1-.89-.89V276a.89.89,0,0,1,.89-.89h20.44a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89h-7.15v26.24a.92.92,0,0,1-.89.89h-4.35a.92.92,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M351.66,276a.89.89,0,0,1,.89-.89h19a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89H357.74v7.67h11.55a.92.92,0,0,1,.89.89v3.88a.89.89,0,0,1-.89.89H357.74v8.18h13.84a.89.89,0,0,1,.89.89v3.83a.89.89,0,0,1-.89.89h-19a.89.89,0,0,1-.89-.89Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M392.36,276a.89.89,0,0,1,.89-.89h13.37a10.13,10.13,0,0,1,10.19,10.05c0,4.3-2.85,7.81-6.92,9.45l6.41,11.88a.88.88,0,0,1-.8,1.36H410.6a.8.8,0,0,1-.75-.42L403.63,295h-5.19v11.92a.92.92,0,0,1-.89.89h-4.3a.89.89,0,0,1-.89-.89Zm13.75,14a4.76,4.76,0,0,0,4.63-4.77,4.65,4.65,0,0,0-4.63-4.54h-7.62V290Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M436.7,276a.89.89,0,0,1,.89-.89H451a10.13,10.13,0,0,1,10.19,10.05c0,4.3-2.85,7.81-6.92,9.45l6.41,11.88a.88.88,0,0,1-.8,1.36h-4.91a.8.8,0,0,1-.75-.42L448,295h-5.19v11.92a.92.92,0,0,1-.89.89h-4.3a.89.89,0,0,1-.89-.89Zm13.75,14a4.76,4.76,0,0,0,4.63-4.77,4.65,4.65,0,0,0-4.63-4.54h-7.62V290Z" transform="translate(-68.11 -258.1)"/><path class="v-edge-logo-fill" d="M476.79,306.58l14.54-31.47a.84.84,0,0,1,.8-.51h.47a.8.8,0,0,1,.8.51l14.4,31.47a.83.83,0,0,1-.8,1.22h-4.07a1.34,1.34,0,0,1-1.36-.93l-2.29-5.05h-14L483,306.86a1.41,1.41,0,0,1-1.36.93h-4.07A.83.83,0,0,1,476.79,306.58Zm20.2-10-4.68-10.29h-.14l-4.58,10.29Z" transform="translate(-68.11 -258.1)"/></svg>`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
