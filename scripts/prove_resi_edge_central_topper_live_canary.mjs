#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);

function arg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

const domain = arg("--domain", "anatoleatnorman.com");
const propertyCode = arg("--property-code", "OK4AN");
const expectedNavCount = Number(arg("--expected-nav-count", "10"));
const expectTourHidden = args.includes("--expect-tour-hidden");
const outDir = resolve(arg("--out-dir", `reports/resi_edge_performance/central-topper-canary/${domain.replace(/\./g, "-")}/${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}/live-proof`));
mkdirSync(outDir, { recursive: true });

const mobileUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const desktopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";
const targetUrl = `https://${domain}/?vtr_live_canary=${Date.now()}`;
const configKey = `resi-edge-topper-config/${propertyCode.toLowerCase()}-${domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "")}/current.json`;

async function evaluatePage(page, viewport) {
  return page.evaluate((name) => {
    const rect = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const r = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    const menu = document.querySelector("[data-edge-drawer-open]");
    if (menu) menu.click();
    const text = document.body.innerText || "";
    const shell = document.querySelector("[data-vtr-edge-mobile-shell='1']");
    const hero = document.querySelector(".hero");
    const header = document.querySelector(".bar");
    const nativeHeader = document.querySelector(".tm-header, .tm-header-mobile");
    const brokenImageSources = [...document.images]
      .filter((image) => {
        const source = image.currentSrc || image.src || image.getAttribute("src") || "";
        return Boolean(source) && image.complete && image.naturalWidth === 0;
      })
      .map((image) => image.currentSrc || image.src || image.getAttribute("src") || "");
    return {
      viewport: name,
      title: document.title,
      has_mobile_shell: Boolean(shell),
      package_marker: document.documentElement.getAttribute("data-vtr-package") || "",
      release_token: document.documentElement.getAttribute("data-vtr-release-token") || "",
      body_property_code: document.body.getAttribute("data-property-code") || "",
      body_property_name: document.body.getAttribute("data-property-name") || "",
      header_display: header ? getComputedStyle(header).display : "",
      hero_rect: rect(hero),
      drawer_open: document.querySelector("[data-edge-drawer]")?.dataset?.open === "true",
      drawer_nav_count: document.querySelectorAll("[data-edge-drawer] nav a").length,
      tour_link_count: document.querySelectorAll('a[data-vtr-action="schedule_tour_click"],a[href*="scheduleTour"]').length,
      header_tour_visible: visible(".bar .tour"),
      drawer_tour_count: document.querySelectorAll('[data-edge-drawer] [data-vtr-element="drawer_tour"]').length,
      consent_visible: visible("#vtr-cookie-notice"),
      preferences_visible: visible("#vtr-cookie-manage"),
      accept_visible: visible("#vtr-cookie-accept"),
      native_header_visible: visible(".tm-header") || visible(".tm-header-mobile"),
      native_header_rect: rect(nativeHeader),
      yootheme_stylesheet_count: document.querySelectorAll('link[href*="yootheme"],link[href*="theme"]')?.length || 0,
      desktop_topper_visible: Boolean(shell && name === "desktop"),
      raw_unstyled_signal: /Skip to content|Menu Menu|<div|<\/div>|Notice:|Warning:/i.test(text),
      old_heap_id_present: document.documentElement.outerHTML.includes("676880719"),
      heap_debug_false_present: document.documentElement.outerHTML.includes("HEAP_JS_DEBUG=false"),
      mobile_menu_open_present: document.documentElement.outerHTML.includes("mobile_menu_open"),
      bare_menu_open_required: false,
      broken_images: brokenImageSources.length,
      broken_image_sources: brokenImageSources,
      scroll_width: document.documentElement.scrollWidth,
      viewport_width: window.innerWidth,
    };
  }, viewport);
}

async function evaluateMobileContinuation(page, outDir) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(5000);
  const screenshot = resolve(outDir, "mobile-continuation.png");
  await page.screenshot({ path: screenshot, fullPage: false });
  const pageEval = await page.evaluate(() => {
    const frame = document.querySelector(".native-continuation-frame");
    const shell = document.querySelector("[data-vtr-native-continuation]");
    return {
      shell_present: Boolean(shell),
      shell_state: shell?.getAttribute("data-native-continuation-state") || "",
      iframe_present: Boolean(frame),
      iframe_src: frame?.getAttribute("src") || "",
      iframe_hidden: frame?.hidden || false,
      viewport_scroll_y: window.scrollY,
      body_height: document.body.scrollHeight,
    };
  });
  const frame = page.frames().find((candidate) => candidate.url().includes("__resi_edge_native_continuation=1"));
  let frameEval = null;
  if (frame) {
    frameEval = await frame.evaluate(() => {
      const visible = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const text = document.body.innerText || "";
      return {
        url: location.href,
        marker_present: Boolean(document.querySelector("[data-vtr-native-continuation-frame='1']")),
        hidden_native_header: !visible(".tm-header") && !visible(".tm-header-mobile"),
        hidden_shell_owned_hero: !visible('[data-page-section="hero"]'),
        hidden_shell_owned_welcome: !visible('[data-page-section="welcome"]'),
        hidden_shell_owned_features: !visible('[data-page-section="apartment_features"]'),
        yootheme_stylesheet_count: document.querySelectorAll('link[href*="yootheme"],link[href*="theme"]').length,
        raw_unstyled_signal: /Skip to content|Menu Menu|<div|<\/div>|Notice:|Warning:/i.test(text),
        old_heap_id_present: document.documentElement.outerHTML.includes("676880719"),
      };
    });
  }
  return { screenshot, page: pageEval, frame: frameEval };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const result = {
    schema_version: "resi_edge_central_topper_live_canary_proof.v1",
    generated_at: new Date().toISOString(),
    domain,
    property_code: propertyCode,
    url: targetUrl,
    expect_tour_hidden: expectTourHidden,
    pass: false,
    failures: [],
    requests_failed: [],
    bad_responses: [],
    headers: {},
    screenshots: {},
    evaluations: {},
  };
  try {
    for (const profile of [
      { name: "mobile", userAgent: mobileUa, viewport: { width: 390, height: 844 }, isMobile: true },
      { name: "desktop", userAgent: desktopUa, viewport: { width: 1366, height: 900 }, isMobile: false },
    ]) {
      const context = await browser.newContext({
        userAgent: profile.userAgent,
        viewport: profile.viewport,
        isMobile: profile.isMobile,
        deviceScaleFactor: profile.isMobile ? 3 : 1,
      });
      const page = await context.newPage();
      page.on("requestfailed", (request) => result.requests_failed.push({ profile: profile.name, url: request.url(), failure: String(request.failure()?.errorText || "") }));
      page.on("response", (response) => {
        if (response.status() >= 500) result.bad_responses.push({ profile: profile.name, status: response.status(), url: response.url() });
      });
      const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      const screenshot = resolve(outDir, `${profile.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      result.screenshots[profile.name] = screenshot;
      result.headers[profile.name] = response ? {
        status: response.status(),
        x_vtr_resi_edge_package: response.headers()["x-vtr-resi-edge-package"] || "",
        x_vtr_release_token: response.headers()["x-vtr-release-token"] || "",
        x_vtr_mobile_topper_production: response.headers()["x-vtr-mobile-topper-production"] || "",
        x_vtr_desktop_mode: response.headers()["x-vtr-desktop-mode"] || "",
        x_vtr_topper_mode: response.headers()["x-vtr-topper-mode"] || "",
        x_vtr_topper_service_role: response.headers()["x-vtr-topper-service-role"] || "",
        x_vtr_property_worker_role: response.headers()["x-vtr-property-worker-role"] || "",
        x_vtr_topper_config_key: response.headers()["x-vtr-topper-config-key"] || "",
        x_vtr_promo_state: response.headers()["x-vtr-promo-state"] || "",
        x_vtr_promo_present: response.headers()["x-vtr-promo-present"] || "",
      } : { status: null };
      result.evaluations[profile.name] = await evaluatePage(page, profile.name);
      if (profile.name === "mobile") {
        const continuation = await evaluateMobileContinuation(page, outDir);
        result.screenshots.mobile_continuation = continuation.screenshot;
        result.evaluations.mobile_continuation = continuation;
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const mobile = result.evaluations.mobile || {};
  const continuation = result.evaluations.mobile_continuation || {};
  const continuationPage = continuation.page || {};
  const continuationFrame = continuation.frame || {};
  const desktop = result.evaluations.desktop || {};
  const mobileHeaders = result.headers.mobile || {};
  const desktopHeaders = result.headers.desktop || {};
  const fail = (message) => result.failures.push(message);

  if (mobileHeaders.status !== 200) fail(`mobile returned status ${mobileHeaders.status}`);
  if (desktopHeaders.status !== 200) fail(`desktop returned status ${desktopHeaders.status}`);
  if (!mobile.has_mobile_shell) fail("mobile shell did not render");
  if (mobileHeaders.x_vtr_topper_service_role !== "render-only") fail("mobile did not use render-only central service");
  if (mobileHeaders.x_vtr_property_worker_role !== "traffic-owner") fail("mobile did not report traffic-owner property Worker");
  if (mobileHeaders.x_vtr_topper_config_key !== configKey) fail(`mobile config key mismatch: expected ${configKey}, got ${mobileHeaders.x_vtr_topper_config_key || "missing"}`);
  if (expectedNavCount < 10) fail(`expected nav count ${expectedNavCount} is below the minimum full-drawer floor`);
  if (mobile.drawer_nav_count !== expectedNavCount || !mobile.drawer_open) fail(`mobile drawer did not open with ${expectedNavCount} manifest nav links`);
  if (expectTourHidden && (mobile.tour_link_count > 0 || mobile.header_tour_visible || mobile.drawer_tour_count > 0)) fail("mobile rendered Tour CTA while --expect-tour-hidden was set");
  if (!mobile.consent_visible || !mobile.preferences_visible || !mobile.accept_visible) fail("mobile consent controls missing");
  if (mobile.scroll_width > mobile.viewport_width + 2) fail("mobile horizontal overflow detected");
  if (mobile.old_heap_id_present) fail("old Heap id 676880719 leaked into mobile shell");
  if (!mobile.heap_debug_false_present) fail("Heap debug false marker missing");
  if (!mobile.mobile_menu_open_present) fail("mobile_menu_open marker missing");
  if (mobile.broken_images > 0) fail(`mobile has ${mobile.broken_images} broken images`);
  if (!continuationPage.shell_present || !continuationPage.iframe_present) fail("mobile native continuation shell/iframe missing");
  if (!continuationPage.iframe_src.includes("__resi_edge_native_continuation=1")) fail("mobile native continuation iframe source missing marker");
  if (!continuationFrame || !continuationFrame.marker_present) fail("native continuation frame did not load its proof marker");
  if (continuationFrame && !continuationFrame.hidden_native_header) fail("native continuation did not hide native header");
  if (continuationFrame && !continuationFrame.hidden_shell_owned_hero) fail("native continuation did not hide native hero");
  if (continuationFrame && continuationFrame.raw_unstyled_signal) fail("native continuation raw/unstyled signal detected");
  if (continuationFrame && continuationFrame.old_heap_id_present) fail("old Heap id 676880719 leaked into native continuation");
  if (desktop.has_mobile_shell || desktop.desktop_topper_visible) fail("desktop rendered mobile shell/topper");
  if (desktopHeaders.x_vtr_desktop_mode !== "native-passthrough") fail("desktop did not report native-passthrough");
  if (!desktop.native_header_visible && desktop.yootheme_stylesheet_count < 1) fail("desktop native rendering did not show native header or YooTheme/theme styles");
  if (desktop.old_heap_id_present) fail("old Heap id 676880719 leaked into desktop native path");
  if (desktop.raw_unstyled_signal) fail("desktop raw/unstyled signal detected");
  if (desktop.broken_images > 0) fail(`desktop has ${desktop.broken_images} broken images`);
  if (result.bad_responses.length) fail(`bad 5xx responses observed: ${result.bad_responses.length}`);

  result.pass = result.failures.length === 0;
  const output = resolve(outDir, "central-topper-live-proof.json");
  writeJson(output, result);
  console.log(JSON.stringify({ ...result, evidence_path: output }, null, 2));
  process.exit(result.pass ? 0 : 3);
}

run().catch((error) => {
  const output = resolve(outDir, "central-topper-live-proof.json");
  const payload = {
    schema_version: "resi_edge_central_topper_live_canary_proof.v1",
    generated_at: new Date().toISOString(),
    domain,
    property_code: propertyCode,
    pass: false,
    failures: [error?.message || "live proof failed"],
  };
  writeJson(output, payload);
  console.error(JSON.stringify({ ...payload, evidence_path: output }, null, 2));
  process.exit(3);
});
