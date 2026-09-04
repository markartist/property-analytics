#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);

function arg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

function fail(payload) {
  const outPath = arg("--out");
  const body = {
    artifact_schema: "resi_edge_central_topper_local_proof.v1",
    pass: false,
    generated_at: new Date().toISOString(),
    ...payload,
  };
  if (outPath) writeJson(resolve(outPath), body);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

function manifestKey(manifest) {
  const target = manifest.target || {};
  return `${slug(target.source_property_code || target.property_code)}-${slug(target.domain)}`;
}

function configKey(manifest) {
  return `resi-edge-topper-config/${manifestKey(manifest)}/current.json`;
}

function promoKey(manifest) {
  return `resi-edge-promo/${manifestKey(manifest)}/current.json`;
}

function heroFreshnessKey(manifest) {
  return `resi-edge-hero-freshness/${manifestKey(manifest)}/current.json`;
}

function buildRecord(manifest, manifestPath, releaseTokens, centralContract) {
  return {
    schema_version: centralContract.edge_record_contract.record_schema_version,
    generated_at: new Date().toISOString(),
    property_code: manifest.target.property_code,
    source_property_code: manifest.target.source_property_code || manifest.target.property_code,
    domain: manifest.target.domain,
    property_name: manifest.target.property_name,
    runtime_version: centralContract.delivery_model.shared_runtime_version,
    release_token_version: releaseTokens.active_token_version,
    manifest_path: manifestPath.replace(`${root}/`, ""),
    manifest_sha256: sha256File(manifestPath),
    target: manifest.target,
    routing: {
      cloudflare_zone_name: manifest.routing?.cloudflare_zone_name,
      route_pattern: manifest.routing?.route_pattern,
      mutation_policy: manifest.routing?.mutation_policy,
    },
    mobile_shell: manifest.mobile_shell,
    desktop: manifest.desktop,
    phone_attribution: manifest.phone_attribution,
    analytics: manifest.analytics,
    consent: manifest.consent,
    seo: manifest.seo,
    record_keys: {
      config: configKey(manifest),
      promo: promoKey(manifest),
      hero_freshness: heroFreshnessKey(manifest),
    },
    centralization: {
      delivery_model: centralContract.delivery_model.target_state,
      production_default: centralContract.delivery_model.production_default,
      freshness_records_are_data_not_runtime: centralContract.non_deviation_contract.freshness_records_are_data_not_runtime,
    },
  };
}

function materializeModuleSources(tempDir, manifest) {
  const releaseTokensPath = join(root, "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json");
  const runtimeSourcePath = join(root, "ops/cloudflare/shared/resi-edge-package/runtime.mjs");
  const widgetSourcePath = join(root, "ops/cloudflare/shared/resi-consent-widget/widget.mjs");
  const centralSourcePath = join(root, "ops/cloudflare/resi-edge-topper-service/worker.js");
  const thinSourcePath = join(root, "ops/cloudflare/resi-edge-thin-property-worker/worker.js");

  const releaseTokens = readJson(releaseTokensPath);
  let runtime = readFileSync(runtimeSourcePath, "utf8");
  runtime = runtime.replace(
    'import releaseTokens from "../../../../config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json";',
    `const releaseTokens = ${JSON.stringify(releaseTokens)};`,
  );
  runtime = runtime.replace(
    'import { renderZarazConsentPillScript } from "../resi-consent-widget/widget.mjs";',
    'import { renderZarazConsentPillScript } from "./widget.mjs";',
  );
  writeFileSync(join(tempDir, "runtime.mjs"), runtime);
  writeFileSync(join(tempDir, "widget.mjs"), readFileSync(widgetSourcePath, "utf8"));

  let central = readFileSync(centralSourcePath, "utf8");
  central = central.replace('from "../shared/resi-edge-package/runtime.mjs";', 'from "./runtime.mjs";');
  writeFileSync(join(tempDir, "central-worker.mjs"), central);

  let thin = readFileSync(thinSourcePath, "utf8");
  thin = thin.replace(
    'import manifest from "../../../config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json";',
    `const manifest = ${JSON.stringify(manifest)};`,
  );
  thin = thin.replace('from "../shared/resi-edge-package/runtime.mjs";', 'from "./runtime.mjs";');
  writeFileSync(join(tempDir, "thin-worker.mjs"), thin);
}

function mockR2Object(payload, contentType = "application/json; charset=utf-8") {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    body: new Blob([text], { type: contentType }).stream(),
    httpMetadata: {
      contentType,
      cacheControl: "no-store",
    },
    async text() {
      return text;
    },
    async json() {
      return JSON.parse(text);
    },
  };
}

function buildMockEnv(record, promoRecord, centralWorker) {
  const objects = new Map([
    [record.record_keys.config, mockR2Object(record)],
    [record.record_keys.promo, mockR2Object(promoRecord)],
  ]);
  const r2 = {
    async get(key) {
      return objects.get(key) || null;
    },
  };
  return {
    RESI_EDGE_ASSETS: r2,
    RESI_EDGE_TOPPER: {
      fetch(request) {
        return centralWorker.fetch(request, { RESI_EDGE_ASSETS: r2 });
      },
    },
  };
}

function mobileRequest(manifest) {
  return new Request(`https://${manifest.target.domain}/`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    },
  });
}

function desktopRequest(manifest) {
  return new Request(`https://${manifest.target.domain}/`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    },
  });
}

function nativeOriginHtml(manifest) {
  return `<!doctype html>
<html>
<head>
  <title>${manifest.target.property_name} Native</title>
  <style>.tm-header{display:block;background:#fff;color:#15284B}.native-hero{min-height:560px;background:#F6F6F5}.native-card{font-size:18px}</style>
  <script>heap.load("676880719")</script>
</head>
<body data-property-name="Stale Native" data-property-code="STALE">
  <header class="tm-header"><nav><a href="/">Home</a><a href="/apartments/">Apartments</a></nav></header>
  <main><section class="native-hero" data-page-section="hero"><h1>${manifest.target.property_name}</h1><p class="native-card">Native desktop source fixture.</p><a href="tel:+19999999999">Call</a></section></main>
</body>
</html>`;
}

function normalizeHtml(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

function count(pattern, value) {
  return [...String(value || "").matchAll(pattern)].length;
}

function shellAssertions(html, manifest) {
  const failures = [];
  const navMatch = html.match(/<nav aria-label="Mobile menu">([\s\S]*?)<\/nav>/);
  const navCount = navMatch ? count(/<a\b/gi, navMatch[1]) : 0;
  const nav = manifest.mobile_shell?.navigation || {};
  const expectedNavCount = nav.links?.length || 0;
  const tourEnabled = nav.tour_enabled !== false && Boolean(String(nav.tour_url || "").trim());
  const measurementId = manifest.analytics?.ga4?.measurement_id;
  const required = [
    ["mobile shell marker", 'data-vtr-edge-mobile-shell="1"'],
    ["central canonical package marker", 'data-vtr-edge-topper="canonical"'],
    ["Heap production id", "286627304"],
    ["GA4 measurement id", measurementId],
    ["explicit debug false guard", "HEAP_JS_DEBUG=false"],
    ["mobile menu action", 'data-vtr-action="mobile_menu_open"'],
    ["source phone attribution", 'data-vtr-action="phone_click"'],
    ["apply attribution", 'data-vtr-action="apply_now_click"'],
    ["availability attribution", 'data-vtr-destination="availability"'],
    ["native continuation loader", "__resi_edge_native_continuation=1"],
  ];
  if (tourEnabled) {
    required.push(["tour attribution", 'data-vtr-action="schedule_tour_click"']);
  }
  for (const [label, marker] of required) {
    if (marker && !html.includes(marker)) failures.push(`missing ${label}: ${marker}`);
  }
  if (!tourEnabled) {
    for (const marker of ['data-vtr-element="header_tour"', 'data-vtr-element="drawer_tour"', nav.tour_url]) {
      if (html.includes(marker)) failures.push(`tour-disabled manifest still rendered marker: ${marker}`);
    }
  }
  if (html.includes("676880719")) failures.push("old Heap id 676880719 leaked into shell");
  if (expectedNavCount < 10) failures.push(`manifest drawer nav has only ${expectedNavCount} links; expected at least 10`);
  if (navCount !== expectedNavCount) failures.push(`drawer nav count was ${navCount}, expected manifest count ${expectedNavCount}`);
  const expectedTrackingFloor = tourEnabled ? 18 : 16;
  if (count(/data-vtr-action="/g, html) < expectedTrackingFloor) failures.push("tracking action attribute coverage is unexpectedly low");
  if (count(/data-vtr-surface="/g, html) < expectedTrackingFloor) failures.push("tracking surface attribute coverage is unexpectedly low");
  if (count(/data-vtr-element="/g, html) < expectedTrackingFloor) failures.push("tracking element attribute coverage is unexpectedly low");
  if (count(/data-vtr-destination="/g, html) < expectedTrackingFloor) failures.push("tracking destination attribute coverage is unexpectedly low");
  return { pass: failures.length === 0, failures, nav_count: navCount, expected_nav_count: expectedNavCount, tour_enabled: tourEnabled };
}

function sourceTopologyAssertions() {
  const central = readFileSync(join(root, "ops/cloudflare/resi-edge-topper-service/worker.js"), "utf8");
  const thin = readFileSync(join(root, "ops/cloudflare/resi-edge-thin-property-worker/worker.js"), "utf8");
  const failures = [];
  if (!central.includes("/__resi-edge/render/mobile-shell")) failures.push("central service is missing render-only endpoint");
  if (!central.includes('service_role: "render_only"')) failures.push("central service does not declare render-only role");
  if (central.includes("renderDesktopPassthrough(request, manifest)")) failures.push("central service still renders desktop passthrough");
  if (central.includes("renderNativeContinuationResponse(request, manifest)")) failures.push("central service still renders native continuation");
  if (central.includes("return fetch(request)")) failures.push("central service still falls through to origin fetch");
  if (!thin.includes('property_worker_mode: "traffic_owner_render_delegate"')) failures.push("property Worker does not declare traffic-owner mode");
  if (!thin.includes("renderDesktopPassthrough(request, manifest)")) failures.push("property Worker does not own desktop passthrough");
  if (!thin.includes("renderNativeContinuationResponse(request, manifest)")) failures.push("property Worker does not own native continuation");
  if (!thin.includes("/__resi-edge/render/mobile-shell")) failures.push("property Worker does not call render-only endpoint");
  if (thin.includes("renderMobileShell(request")) failures.push("property Worker renders mobile shell locally instead of delegating");
  return { pass: failures.length === 0, failures };
}

async function visualProof(htmlByViewport, manifest, outDir) {
  const expectedNavCount = manifest.mobile_shell?.navigation?.links?.length || 0;
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const imageFixture = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mNk+M8AAwUBARwmWqYAAAAASUVORK5CYII=",
    "base64",
  );
  try {
    for (const viewport of [
      { name: "mobile", width: 390, height: 844, isMobile: true, html: htmlByViewport.mobile },
      { name: "desktop", width: 1366, height: 900, isMobile: false, html: htmlByViewport.desktop },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        deviceScaleFactor: viewport.isMobile ? 3 : 1,
      });
      const page = await context.newPage();
      const consoleMessages = [];
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
      });
      page.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.message }));
      await page.addInitScript(() => {
        window.zaraz = {
          track: () => true,
          consent: { getAll: () => ({}), setAll: () => {}, sendQueuedEvents: () => {} },
          showConsentModal: () => { window.__vtrConsentModalCalled = true; },
        };
      });
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url === `https://${manifest.target.domain}/`) {
          return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: viewport.html });
        }
        if (url.endsWith(".woff2")) return route.fulfill({ status: 204, body: "" });
        return route.fulfill({ status: 200, contentType: "image/png", body: imageFixture });
      });
      await page.goto(`https://${manifest.target.domain}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const screenshotPath = join(outDir, `${viewport.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const evaluation = await page.evaluate((name) => {
        const visible = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const mobileShell = document.querySelector("[data-vtr-edge-mobile-shell='1']");
        const header = document.querySelector(".bar");
        const hero = document.querySelector(".hero");
        const drawer = document.querySelector("[data-edge-drawer]");
        const menu = document.querySelector("[data-edge-drawer-open]");
        if (menu) menu.click();
        const brokenImageSources = [...document.images]
          .filter((image) => {
            const source = image.currentSrc || image.src || image.getAttribute("src") || "";
            return Boolean(source) && image.complete && image.naturalWidth === 0;
          })
          .map((image) => image.currentSrc || image.src || image.getAttribute("src") || "");
        const brokenImages = brokenImageSources.length;
        const bodyText = document.body.innerText || "";
        const result = {
          viewport: name,
          has_mobile_shell: Boolean(mobileShell),
          header_display: header ? getComputedStyle(header).display : "",
          hero_height: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
          drawer_open: drawer?.dataset?.open === "true",
          drawer_nav_count: document.querySelectorAll("[data-edge-drawer] nav a").length,
          tour_link_count: document.querySelectorAll('a[data-vtr-action="schedule_tour_click"],a[href*="scheduleTour"]').length,
          header_tour_visible: visible(".bar .tour"),
          drawer_tour_count: document.querySelectorAll('[data-edge-drawer] [data-vtr-element="drawer_tour"]').length,
          consent_visible: visible("#vtr-cookie-notice"),
          preferences_visible: visible("#vtr-cookie-manage"),
          accept_visible: visible("#vtr-cookie-accept"),
          native_header_visible: visible(".tm-header"),
          desktop_topper_visible: Boolean(mobileShell && name === "desktop"),
          raw_native_markers: /Skip to|Menu Menu|<\/div>|<nav/i.test(bodyText),
          broken_images: brokenImages,
          broken_image_sources: brokenImageSources,
        };
        return result;
      }, viewport.name);
      await context.close();
      results.push({ ...evaluation, screenshot: screenshotPath, console_messages: consoleMessages });
    }
  } finally {
    await browser.close();
  }

  const failures = [];
  const mobile = results.find((row) => row.viewport === "mobile") || {};
  const desktop = results.find((row) => row.viewport === "desktop") || {};
  const nav = manifest.mobile_shell?.navigation || {};
  const tourEnabled = nav.tour_enabled !== false && Boolean(String(nav.tour_url || "").trim());
  if (!mobile.has_mobile_shell) failures.push("mobile shell did not render");
  if (mobile.header_display !== "flex") failures.push(`mobile header display was ${mobile.header_display || "missing"}`);
  if (mobile.hero_height < 600) failures.push(`mobile hero height was too short: ${mobile.hero_height}`);
  if (expectedNavCount < 10) failures.push(`manifest drawer nav has only ${expectedNavCount} links; expected at least 10`);
  if (!mobile.drawer_open || mobile.drawer_nav_count !== expectedNavCount) failures.push(`mobile drawer did not open with ${expectedNavCount} manifest links`);
  if (!tourEnabled && (mobile.tour_link_count > 0 || mobile.header_tour_visible || mobile.drawer_tour_count > 0)) failures.push("tour-disabled manifest rendered mobile Tour CTA");
  if (tourEnabled && mobile.tour_link_count < 2) failures.push("tour-enabled manifest did not render both mobile Tour CTAs");
  if (!mobile.consent_visible || !mobile.preferences_visible || !mobile.accept_visible) failures.push("mobile consent controls were not visible");
  if (mobile.broken_images > 0) failures.push(`mobile first viewport had ${mobile.broken_images} broken images`);
  if (desktop.has_mobile_shell || desktop.desktop_topper_visible) failures.push("desktop rendered an edge mobile shell");
  if (!desktop.native_header_visible) failures.push("desktop native fixture header was not visible");
  if (desktop.broken_images > 0) failures.push(`desktop first viewport had ${desktop.broken_images} broken images`);
  return { pass: failures.length === 0, failures, results };
}

const manifestArg = arg("--manifest", "config/portfolio_resi_edge_stabilization/anatoleatnorman-com.manifest.json");
const manifestPath = resolve(root, manifestArg);
if (!existsSync(manifestPath)) fail({ reason: `Manifest not found: ${manifestPath}` });
const manifest = readJson(manifestPath);
const releaseTokens = readJson(join(root, "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json"));
const centralContract = readJson(join(root, "config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json"));
const key = manifestKey(manifest);
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outDir = resolve(arg("--out-dir", join(root, "reports/resi_edge_performance/central-topper-local-proof", key, runId)));
mkdirSync(outDir, { recursive: true });
const latestPath = join(root, "reports/resi_edge_performance/central-topper-local-proof", key, "latest-central-topper-local-proof.json");

const record = buildRecord(manifest, manifestPath, releaseTokens, centralContract);
const promoRecord = {
  schema_version: "resi_edge_promo_record.v1",
  generated_at: new Date().toISOString(),
  property_code: manifest.target.property_code,
  domain: manifest.target.domain,
  present: false,
  propertyBannerSpecial: "",
  source: {
    system: "local_central_topper_proof",
    field: "propertyBannerSpecial",
    fetched_at: new Date().toISOString(),
  },
};

const tempDir = mkdtempSync(join(tmpdir(), "resi-edge-central-proof-"));
materializeModuleSources(tempDir, manifest);
const runtime = await import(`file://${join(tempDir, "runtime.mjs")}`);
const centralWorker = (await import(`file://${join(tempDir, "central-worker.mjs")}`)).default;
const thinWorker = (await import(`file://${join(tempDir, "thin-worker.mjs")}`)).default;
const env = buildMockEnv(record, promoRecord, centralWorker);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (request) => {
  const url = typeof request === "string" ? request : request.url;
  if (String(url).startsWith(`https://${manifest.target.domain}`)) {
    return new Response(nativeOriginHtml(manifest), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response("", { status: 404 });
};

try {
  const promoReadout = await runtime.loadEdgePromoRecord(env, manifest);
  const referenceHtml = runtime.renderMobileShell(mobileRequest(manifest), manifest, promoReadout.promo);
  const mobileResponse = await thinWorker.fetch(mobileRequest(manifest), env);
  const mobileHtml = await mobileResponse.text();
  const desktopResponse = await thinWorker.fetch(desktopRequest(manifest), env);
  const desktopHtml = await desktopResponse.text();
  const centralDesktopBlock = await centralWorker.fetch(
    new Request(`https://${manifest.target.domain}/`, {
      headers: { "x-vtr-topper-config-key": record.record_keys.config, accept: "text/html" },
    }),
    { RESI_EDGE_ASSETS: env.RESI_EDGE_ASSETS },
  );
  const topology = sourceTopologyAssertions();
  const shell = shellAssertions(mobileHtml, manifest);
  const equivalenceFailures = [];
  if (mobileResponse.status !== 200) equivalenceFailures.push(`mobile thin response status was ${mobileResponse.status}`);
  if (normalizeHtml(referenceHtml) !== normalizeHtml(mobileHtml)) {
    equivalenceFailures.push("central-rendered mobile shell differs from bundled reference output");
  }
  if (mobileResponse.headers.get("x-vtr-topper-service-role") !== "render-only") {
    equivalenceFailures.push("mobile response did not carry render-only service role header");
  }
  if (mobileResponse.headers.get("x-vtr-property-worker-role") !== "traffic-owner") {
    equivalenceFailures.push("mobile response did not carry traffic-owner property Worker header");
  }
  if (centralDesktopBlock.status !== 404) {
    equivalenceFailures.push(`central service accepted non-render route with status ${centralDesktopBlock.status}`);
  }
  if (desktopHtml.includes('data-vtr-edge-mobile-shell="1"')) {
    equivalenceFailures.push("desktop path rendered mobile shell markup");
  }
  if (!desktopHtml.includes('x-vtr') && !desktopResponse.headers.get("x-vtr-desktop-mode")) {
    equivalenceFailures.push("desktop path did not use runtime-owned desktop passthrough");
  }
  if (desktopHtml.includes("676880719")) {
    equivalenceFailures.push("desktop passthrough failed to strip old native Heap id");
  }
  const visual = await visualProof({ mobile: mobileHtml, desktop: desktopHtml }, manifest, outDir);
  const failures = [
    ...topology.failures,
    ...shell.failures,
    ...equivalenceFailures,
    ...visual.failures,
  ];
  const payload = {
    artifact_schema: "resi_edge_central_topper_local_proof.v1",
    pass: failures.length === 0,
    generated_at: new Date().toISOString(),
    run_id: runId,
    property_code: manifest.target.property_code,
    source_property_code: manifest.target.source_property_code || manifest.target.property_code,
    domain: manifest.target.domain,
    property_name: manifest.target.property_name,
    manifest_path: manifestPath,
    manifest_sha256: sha256File(manifestPath),
    runtime_sha256: sha256File(join(root, "ops/cloudflare/shared/resi-edge-package/runtime.mjs")),
    central_service_sha256: sha256File(join(root, "ops/cloudflare/resi-edge-topper-service/worker.js")),
    thin_worker_sha256: sha256File(join(root, "ops/cloudflare/resi-edge-thin-property-worker/worker.js")),
    central_service_role: "render_only",
    property_worker_role: "traffic_owner_render_delegate",
    config_key: record.record_keys.config,
    promo_key: record.record_keys.promo,
    topology,
    shell,
    equivalence: {
      pass: equivalenceFailures.length === 0,
      failures: equivalenceFailures,
      bundled_reference_bytes: Buffer.byteLength(referenceHtml),
      central_candidate_bytes: Buffer.byteLength(mobileHtml),
      central_desktop_block_status: centralDesktopBlock.status,
    },
    visual,
    failures,
  };
  writeJson(join(outDir, "central-topper-local-proof.json"), payload);
  writeJson(latestPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.pass ? 0 : 3);
} finally {
  globalThis.fetch = originalFetch;
}
