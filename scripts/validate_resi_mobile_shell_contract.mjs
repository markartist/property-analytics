#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = resolve(new URL("..", import.meta.url).pathname);
const consentContract = JSON.parse(readFileSync(resolve(root, "ops/cloudflare/shared/resi-consent-widget/contract.json"), "utf8"));
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";
const REQUIRED_CONSENT_VERSION = consentContract.version;

function parseArgs(argv) {
  const args = {
    url: null,
    out: null,
    label: null,
    propertyCode: null,
    maxHtmlBytes: 40000,
    maxScriptTags: 8,
    maxStylesheets: 0,
    allowDesktopTopper: false,
    allowMissingShellMarker: false,
    allowDesktopDirectAnalytics: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") args.url = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--label") args.label = argv[++i];
    else if (arg === "--property-code") args.propertyCode = argv[++i];
    else if (arg === "--max-html-bytes") args.maxHtmlBytes = Number(argv[++i]);
    else if (arg === "--max-script-tags") args.maxScriptTags = Number(argv[++i]);
    else if (arg === "--max-stylesheets") args.maxStylesheets = Number(argv[++i]);
    else if (arg === "--allow-desktop-topper") args.allowDesktopTopper = true;
    else if (arg === "--allow-missing-shell-marker") args.allowMissingShellMarker = true;
    else if (arg === "--allow-desktop-direct-analytics") args.allowDesktopDirectAnalytics = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.url) throw new Error("--url is required");
  if (!args.out) throw new Error("--out is required");
  args.out = resolve(args.out);
  return args;
}

async function fetchHtml(url, userAgent) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": userAgent,
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const html = await response.text();
  return {
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    cfCacheStatus: response.headers.get("cf-cache-status"),
    serverTiming: response.headers.get("server-timing"),
    html
  };
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : null;
}

function linesFor(html, regex, limit = 12) {
  return html
    .split(/\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter((entry) => regex.test(entry.text))
    .slice(0, limit);
}

function isAllowedEdgeAnalyticsGuard(entry) {
  return (
    /<script\b[^>]*data-vtr-cs-verify-suppress=["']1["']/i.test(entry.text) &&
    entry.text.includes("tcvsapi") &&
    entry.text.includes("contentsquare") &&
    entry.text.includes("verify-installation") &&
    /vtr_cs_verify_suppressed=1/i.test(entry.text)
  );
}

function isCloudflareBeaconScript(tag) {
  return /<script\b[^>]*static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(tag);
}

function inventory(html) {
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const stylesheetLinks = linkTags
    .filter((tag) => /rel\s*=\s*["'][^"']*stylesheet/i.test(tag))
    .map((tag) => attr(tag, "href") || tag);
  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  const budgetedScriptTags = scriptTags.filter((tag) => !isCloudflareBeaconScript(tag));
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const imgSources = [
    ...imageTags.map((tag) => attr(tag, "src")),
    ...[...html.matchAll(/<source\b[^>]*>/gi)].map((match) => attr(match[0], "srcset")),
    ...[...html.matchAll(/\bdata-src\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1])
  ].filter(Boolean);
  const heroMediaTag = imageTags.find((tag) => /class\s*=\s*["'][^"']*\bhero-media\b/i.test(tag)) || "";
  const heroMediaSrc = attr(heroMediaTag, "src");
  const eagerContentBlockImages = imageTags
    .map((tag) => attr(tag, "src"))
    .filter((src) => /(?:welcome|features|amenities)-[^"']*\.(?:avif|webp|jpe?g|png)/i.test(src || ""));
  const deferredShellImages = imageTags
    .map((tag) => attr(tag, "data-vtr-lazy-src"))
    .filter(Boolean);

  const nativeRuntimePatterns = [
    /<link\b[^>]*stylesheet[^>]*(yootheme|resi-child-theme|wp-content\/themes)/i,
    /<script\b[^>]*(jquery|jquery-migrate|uikit|yootheme|resi-elements|wp-content\/themes|wp-includes\/js)/i,
    /\bwindow\.yootheme\b/i,
    /\bUIkit\./i,
    /\bjQuery\s*\(/i,
    /wp-theme-yootheme/i,
    /wp-child-theme-resi-child-theme/i
  ];
  const directNativeAnalyticsPatterns = [
    /googletagmanager/i,
    /\bGTM-[A-Z0-9]+/i,
    /gtag\/js/i,
    /HEAP_JS_DEBUG/i,
    /\bheap\.load\b/i,
    /contentsquare/i,
    /analytics\.ahrefs\.com\/analytics\.js/i,
    /js\.getresi\.co\/pixel\/[^"'\s<>]+\/resi-pixel\.iife\.js/i
  ];

  const nativeRuntimeFindings = nativeRuntimePatterns.flatMap((pattern) =>
    linesFor(html, pattern, 8).map((entry) => ({ pattern: String(pattern), ...entry }))
  );
  const directNativeAnalyticsFindings = directNativeAnalyticsPatterns.flatMap((pattern) =>
    linesFor(html, pattern, 8).map((entry) => ({ pattern: String(pattern), ...entry }))
  ).filter((entry) => !isAllowedEdgeAnalyticsGuard(entry));
  const damFindings = linesFor(html, /https:\/\/dam\.getresi\.co/i, 12);
  const consentScriptTags = scriptTags.filter((tag) => /data-vtr-zaraz-consent-pill=["']1["']/i.test(tag));
  const consentScriptText = linesFor(html, /data-vtr-zaraz-consent-pill|vtr-cookie-notice|This website uses cookies|vtr-cookie-manage|vtr-cookie-reject|showConsentModal/i, 40)
    .map((entry) => entry.text)
    .join("\n");
  const consentVersionPresent = html.includes(`data-vtr-zaraz-consent-version="${REQUIRED_CONSENT_VERSION}"`) ||
    html.includes(`data-vtr-zaraz-consent-version='${REQUIRED_CONSENT_VERSION}'`) ||
    html.includes(`vtrZarazConsentVersion="${REQUIRED_CONSENT_VERSION}"`) ||
    html.includes(`__vtrZarazConsentPillVersion="${REQUIRED_CONSENT_VERSION}"`);

  return {
    initial_html_bytes: Buffer.byteLength(html),
    initial_html_gzip_bytes: gzipSync(Buffer.from(html)).length,
    stylesheet_link_count: stylesheetLinks.length,
    stylesheet_links: stylesheetLinks.slice(0, 20),
    script_tag_count: budgetedScriptTags.length,
    observed_script_tag_count: scriptTags.length,
    cloudflare_beacon_script_count: scriptTags.filter(isCloudflareBeaconScript).length,
    script_tags: scriptTags.slice(0, 20),
    image_reference_count: imgSources.length,
    first_image_references: imgSources.slice(0, 20),
    hero_media: {
      src: heroMediaSrc,
      uses_webp: /\.webp(?:$|\?)/i.test(heroMediaSrc || ""),
      uses_avif: /\.avif(?:$|\?)/i.test(heroMediaSrc || ""),
      width: attr(heroMediaTag, "width"),
      height: attr(heroMediaTag, "height"),
      fetchpriority: attr(heroMediaTag, "fetchpriority"),
      decoding: attr(heroMediaTag, "decoding")
    },
    eager_content_block_image_count: eagerContentBlockImages.length,
    eager_content_block_images: eagerContentBlockImages.slice(0, 20),
    deferred_shell_image_count: deferredShellImages.length,
    deferred_shell_images: deferredShellImages.slice(0, 20),
    deferred_shell_image_loader_present: /<script\b[^>]*data-vtr-deferred-shell-images=["']1["']/i.test(html),
    sourced_awards: {
      section_count: (html.match(/data-vtr-shell-awards=["']1["']/gi) || []).length,
      kingsley_same_origin_present: /\/assets\/resi-edge-assets\/shared\/kingsley-award\.svg/i.test(html)
    },
    content_block_bullets: {
      list_count: (html.match(/data-vtr-shell-bullets=["']1["']/gi) || []).length,
      item_count: (html.match(/<ul\b[^>]*data-vtr-shell-bullets=["']1["'][\s\S]*?<\/ul>/gi) || [])
        .reduce((count, list) => count + (list.match(/<li\b/gi) || []).length, 0)
    },
    hero_fade_contract_present: /@keyframes\s+vtrFadeUp/i.test(html) &&
      /\.hero\s+\.rating,\s*\.hero\s+\.hero-title-art,\s*\.hero\s+\.hero-headline,\s*\.hero\s+\.cta[\s\S]*?animation\s*:/i.test(html),
    shell_marker_present: /vtr-edge-topper|data-vtr-[\w-]*topper|mobile-topper|data-edge-perf|edge-owned/i.test(html),
    native_runtime_blockers: nativeRuntimeFindings.length,
    native_runtime_findings: nativeRuntimeFindings,
    native_dam_image_count: damFindings.length,
    native_dam_findings: damFindings,
    direct_native_analytics_blockers: directNativeAnalyticsFindings.length,
    direct_native_analytics_findings: directNativeAnalyticsFindings,
    consent_widget: {
      required_version: REQUIRED_CONSENT_VERSION,
      script_count: consentScriptTags.length,
      version_present: consentVersionPresent,
      compact_text_present: html.includes("This website uses cookies"),
      preferences_button_present: html.includes("vtr-cookie-manage"),
      accept_button_present: html.includes("vtr-cookie-accept"),
      inline_reject_present: html.includes("vtr-cookie-reject"),
      legacy_large_copy_present: html.includes("We use cookies to improve site performance and measure leasing activity"),
      zaraz_modal_route_present: html.includes("showConsentModal"),
      findings: consentScriptText.slice(0, 4000)
    },
    hero_title: {
      approved_label_present: /class=["'][^"']*hero-title-art[^"']*["'][^>]*aria-label=["'][^"']+["']/i.test(html),
      approved_svg_present: /class=["'][^"']*hero-title-art[^"']*["'][\s\S]*?<img\b[^>]*src=["']\/assets\/resi-edge-assets\/[^"']+\.svg["']/i.test(html),
      mode_present: /class=["'][^"']*hero-title-art[^"']*["'][^>]*data-vtr-hero-title-mode=["'](?:shared_lble_svg|property_tagline_svg)["']/i.test(html),
      stale_title_text_present: /class=["'][^"']*hero-title-text/i.test(html),
      stale_shared_lble_asset_present: false,
      edge_added_tm_present: /Live\s+Better\.\s*Live\s+Easy\.\s*(?:™|&trade;|&#8482;|<sup[^>]*>\s*TM\s*<\/sup>)/i.test(html)
    },
    drawer: {
      source_label_present: /class=["'][^"']*\bdrawer-source\b/i.test(html),
      visible_internal_attribution_present: /<aside\b[^>]*class=["'][^"']*\bdrawer\b[\s\S]*?(?:>\s*(?:VWS|AH|APL|ADC-VL|BNG|GOA|GOO-VL|YHO)\s*<)/i.test(html)
    }
  };
}

function evaluate(args, mobile, desktop) {
  const failures = [];
  const mobileInv = mobile.inventory;
  const desktopInv = desktop.inventory;

  if (mobile.status < 200 || mobile.status >= 300) failures.push(`mobile HTTP status ${mobile.status}`);
  if (mobileInv.initial_html_bytes > args.maxHtmlBytes) {
    failures.push(`initial_html_bytes ${mobileInv.initial_html_bytes} exceeds ${args.maxHtmlBytes}`);
  }
  if (mobileInv.stylesheet_link_count > args.maxStylesheets) {
    failures.push(`stylesheet_link_count ${mobileInv.stylesheet_link_count} exceeds ${args.maxStylesheets}`);
  }
  if (mobileInv.script_tag_count > args.maxScriptTags) {
    failures.push(`script_tag_count ${mobileInv.script_tag_count} exceeds ${args.maxScriptTags}`);
  }
  if (!args.allowMissingShellMarker && !mobileInv.shell_marker_present) {
    failures.push("shell marker is missing");
  }
  if (mobileInv.native_runtime_blockers > 0) {
    failures.push(`native_runtime_blockers ${mobileInv.native_runtime_blockers} must be 0`);
  }
  if (mobileInv.native_dam_image_count > 0) {
    failures.push(`native_dam_image_count ${mobileInv.native_dam_image_count} must be 0`);
  }
  if (mobileInv.direct_native_analytics_blockers > 0) {
    failures.push(`direct_native_analytics_blockers ${mobileInv.direct_native_analytics_blockers} must be 0`);
  }
  if (!mobileInv.consent_widget.version_present) {
    failures.push(`consent_widget_version ${mobileInv.consent_widget.required_version} is missing`);
  }
  if (!mobileInv.consent_widget.compact_text_present || !mobileInv.consent_widget.preferences_button_present || !mobileInv.consent_widget.accept_button_present) {
    failures.push("consent_widget_compact_pill is missing required text/buttons");
  }
  if (mobileInv.consent_widget.inline_reject_present || mobileInv.consent_widget.legacy_large_copy_present) {
    failures.push("consent_widget_stale_large_three_button_notice must be absent");
  }
  if (!mobileInv.consent_widget.zaraz_modal_route_present) {
    failures.push("consent_widget_preferences_must_route_to_zaraz_modal");
  }
  if (!mobileInv.hero_title.approved_label_present || !mobileInv.hero_title.approved_svg_present || !mobileInv.hero_title.mode_present) {
    failures.push("approved_svg_title_treatment is missing");
  }
  if (!mobileInv.hero_media.uses_webp || mobileInv.hero_media.uses_avif) {
    failures.push("mobile_hero_lcp_image_must_use_generated_webp");
  }
  if (mobileInv.hero_media.width !== "750" || mobileInv.hero_media.height !== "1000") {
    failures.push("mobile_hero_lcp_image_dimensions_must_be_750x1000");
  }
  if (mobileInv.hero_media.fetchpriority !== "high" || mobileInv.hero_media.decoding !== "sync") {
    failures.push("mobile_hero_lcp_image_priority_contract_missing");
  }
  if (mobileInv.hero_title.stale_title_text_present || mobileInv.hero_title.stale_shared_lble_asset_present) {
    failures.push("stale_lble_title_renderer must be absent");
  }
  if (mobileInv.hero_title.edge_added_tm_present) {
    failures.push("edge_added_lble_tm must be absent");
  }
  if (mobileInv.drawer.source_label_present || mobileInv.drawer.visible_internal_attribution_present) {
    failures.push("drawer_visible_internal_attribution_label must be absent");
  }
  if (mobileInv.eager_content_block_image_count > 0) {
    failures.push(`eager_content_block_image_count ${mobileInv.eager_content_block_image_count} must be 0`);
  }
  if (mobileInv.deferred_shell_image_count > 0 && !mobileInv.deferred_shell_image_loader_present) {
    failures.push("deferred shell images are present but the deferred image loader is missing");
  }
  if (!args.allowDesktopTopper && desktopInv.shell_marker_present) {
    failures.push("desktop_topper_absent is false");
  }
  if (!args.allowDesktopDirectAnalytics && desktopInv.direct_native_analytics_blockers > 0) {
    failures.push(`desktop_direct_native_analytics_blockers ${desktopInv.direct_native_analytics_blockers} must be 0`);
  }
  if (desktopInv.consent_widget.script_count > 0 && !desktopInv.consent_widget.version_present) {
    failures.push(`desktop_consent_widget_version ${desktopInv.consent_widget.required_version} is missing`);
  }
  if (desktopInv.consent_widget.inline_reject_present || desktopInv.consent_widget.legacy_large_copy_present) {
    failures.push("desktop_consent_widget_stale_large_three_button_notice must be absent");
  }

  return {
    pass: failures.length === 0,
    failures,
    thresholds: {
      max_initial_html_bytes: args.maxHtmlBytes,
      max_stylesheet_link_count: args.maxStylesheets,
      max_script_tag_count: args.maxScriptTags,
      native_runtime_blockers: 0,
      native_dam_image_count: 0,
      direct_native_analytics_blockers: 0,
      eager_content_block_image_count: 0,
      consent_widget_version: REQUIRED_CONSENT_VERSION
    }
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const [mobileResponse, desktopResponse] = await Promise.all([
    fetchHtml(args.url, MOBILE_UA),
    fetchHtml(args.url, DESKTOP_UA)
  ]);
  const mobile = {
    status: mobileResponse.status,
    finalUrl: mobileResponse.finalUrl,
    contentType: mobileResponse.contentType,
    cfCacheStatus: mobileResponse.cfCacheStatus,
    serverTiming: mobileResponse.serverTiming,
    inventory: inventory(mobileResponse.html)
  };
  const desktop = {
    status: desktopResponse.status,
    finalUrl: desktopResponse.finalUrl,
    contentType: desktopResponse.contentType,
    cfCacheStatus: desktopResponse.cfCacheStatus,
    serverTiming: desktopResponse.serverTiming,
    inventory: inventory(desktopResponse.html)
  };
  const evaluation = evaluate(args, mobile, desktop);
  const payload = {
    schema: "resi_mobile_shell_contract_v1",
    generated_at: new Date().toISOString(),
    property_code: args.propertyCode,
    label: args.label,
    url: args.url,
    mobile,
    desktop,
    desktop_topper_absent: !desktop.inventory.shell_marker_present,
    ...evaluation
  };

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`);
  if (!payload.pass) {
    console.error(`FAIL ${args.url}`);
    for (const failure of payload.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`PASS ${args.url}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
