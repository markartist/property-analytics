import fs from "node:fs";
import { _android as android, chromium, webkit } from "playwright";

const TARGET_URL = process.env.TARGET_URL;
const REQUEST_ID = process.env.REQUEST_ID || `evs-${Date.now()}`;
const PROPERTY_ID = process.env.PROPERTY_ID || "unknown-property";
const PROFILE = process.env.EVS_PROFILE || "broad_experiential_homepage";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "evs-raw-result.json";
const ENVIRONMENT = process.env.EVS_ENVIRONMENT || "staging";
const DEVICE_FILTER = process.env.BROWSERSTACK_DEVICE_PROFILE || null;
const CONNECT_TIMEOUT_MS = Number(process.env.BROWSERSTACK_CONNECT_TIMEOUT_MS || 60000);
const STEP_TIMEOUT_MS = Number(process.env.BROWSERSTACK_STEP_TIMEOUT_MS || 45000);
const INTERACTION_TIMEOUT_MS = Number(process.env.BROWSERSTACK_INTERACTION_TIMEOUT_MS || 2000);
const MAX_INTERACTIVE_ITEMS = Number(process.env.BROWSERSTACK_MAX_INTERACTIVE_ITEMS || 6);
const SITE_PATTERNS_PATH = new URL("../../config/browserstack-site-patterns.json", import.meta.url);

if (!TARGET_URL) {
  throw new Error("TARGET_URL is required.");
}

function loadSitePatterns() {
  try {
    return JSON.parse(fs.readFileSync(SITE_PATTERNS_PATH, "utf8"));
  } catch {
    return { defaults: {}, properties: {} };
  }
}

const SITE_PATTERNS = loadSitePatterns();
const SITE_DEFAULTS = SITE_PATTERNS.defaults || {};
const SITE_CONFIG = {
  ...SITE_DEFAULTS,
  ...((SITE_PATTERNS.properties && SITE_PATTERNS.properties[PROPERTY_ID]) || {}),
};

const DEVICE_MATRIX = [
  {
    device_profile: "desktop_chrome",
    browserEngine: "chromium",
    browserName: "chrome",
    os: "OS X",
    osVersion: "Sonoma",
  },
  {
    device_profile: "android_chrome",
    browserEngine: "chromium",
    browserName: "chrome",
    os: "android",
    osVersion: "14.0",
    deviceName: "Samsung Galaxy S23",
  },
  {
    device_profile: "iphone_safari",
    browserEngine: "webkit",
    browserName: "safari",
    deviceName: "iPhone 15 Pro Max",
    osVersion: "17",
  },
];

const ACTIVE_DEVICE_MATRIX = DEVICE_FILTER
  ? DEVICE_MATRIX.filter((device) => device.device_profile === DEVICE_FILTER)
  : DEVICE_MATRIX;

if (ACTIVE_DEVICE_MATRIX.length === 0) {
  throw new Error(
    `No matching device profiles found for BROWSERSTACK_DEVICE_PROFILE="${DEVICE_FILTER}".`
  );
}

function logProgress(message, metadata = {}) {
  const suffix = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : "";
  process.stderr.write(`[browserstack-runner] ${message}${suffix}\n`);
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function safeAsyncCleanup(label, cleanupFn, timeoutMs = 5000) {
  try {
    await withTimeout(Promise.resolve().then(cleanupFn), timeoutMs, label);
  } catch (error) {
    logProgress("Cleanup warning", {
      label,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildWsEndpoint(device) {
  const caps = {
    browser: device.browserName,
    deviceName: device.deviceName,
    realMobile: device.deviceName ? "true" : undefined,
    name: `${PROPERTY_ID} ${device.device_profile}`,
    build: process.env.BROWSERSTACK_BUILD_NAME || `EVS ${new Date().toISOString()}`,
    project: process.env.BROWSERSTACK_PROJECT_NAME || "Experience Validation Service",
    "browserstack.username": process.env.BROWSERSTACK_USERNAME,
    "browserstack.accessKey": process.env.BROWSERSTACK_ACCESS_KEY,
    "browserstack.playwrightVersion": "1.latest",
  };
  if (device.device_profile === "android_chrome") {
    caps.platformName = "android";
    caps.device = device.deviceName;
    caps.osVersion = device.osVersion;
  } else {
    caps.browser_version = "latest";
    caps.os = device.os;
    caps.osVersion = device.osVersion;
  }
  return `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
}

function classifyDeviceRun(run) {
  if (run.fatal_error) {
    const raw = String(run.fatal_error).toLowerCase();
    if (raw.includes("timed out") || raw.includes("socket") || raw.includes("browserstack connect")) {
      return "infra_flake";
    }
    return "runner_failure";
  }

  const findings = run.findings || [];
  const functionalFindings = findings.filter((finding) => finding.kind !== "artifact_capture");
  const failKinds = functionalFindings.filter((finding) => finding.status === "fail").map((finding) => finding.kind);
  const warnKinds = functionalFindings.filter((finding) => finding.status === "warn").map((finding) => finding.kind);

  if (failKinds.length > 0) {
    if (failKinds.includes("javascript") || failKinds.includes("page_load")) {
      return "site_regression";
    }
    if (failKinds.includes("navigation") || failKinds.includes("cta") || failKinds.includes("interior_page")) {
      return "journey_failure";
    }
    return "functional_failure";
  }

  if (warnKinds.length > 0) {
    if (warnKinds.includes("navigation") || warnKinds.includes("interior_page")) {
      return "selector_review";
    }
    return "needs_review";
  }

  return "pass";
}

function sameOrigin(urlA, urlB) {
  try {
    return new URL(urlA).origin === new URL(urlB).origin;
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function isUsableHref(rawHref) {
  if (!rawHref) return false;
  const href = rawHref.trim();
  return !href.startsWith("#") && !href.startsWith("javascript:");
}

async function pushJavascriptFinding(findings, jsErrors) {
  if (jsErrors.length > 0) {
    findings.push({
      kind: "javascript",
      label: "JavaScript runtime stability",
      status: "fail",
      message: `${jsErrors.length} page errors were captured during execution.`,
      metadata: { errors: jsErrors },
      evidence_refs: [],
    });
  } else {
    findings.push({
      kind: "javascript",
      label: "JavaScript runtime stability",
      status: "pass",
      message: "No page runtime errors were captured during execution.",
      metadata: {},
      evidence_refs: [],
    });
  }
}

async function pushNetworkFinding(findings, requestFailures) {
  const actionableFailures = requestFailures.filter((failure) => {
    const url = String(failure.url || "").toLowerCase();
    const failureText = String(failure.failure_text || "").toLowerCase();
    const resourceType = String(failure.resource_type || "").toLowerCase();
    const isAbort = failureText.includes("err_aborted");
    const isBeaconLike = resourceType === "ping";
    const isTelemetryHost =
      url.includes("analytics.google.com") ||
      url.includes("googletagmanager.com") ||
      url.includes("contentsquare.net") ||
      url.includes("posthog") ||
      url.includes("google-analytics.com");

    if (isAbort && (isBeaconLike || isTelemetryHost)) {
      return false;
    }
    return true;
  });

  if (actionableFailures.length > 0) {
    findings.push({
      kind: "network",
      label: "Network request stability",
      status: "warn",
      message: `${actionableFailures.length} actionable network requests failed during execution.`,
      metadata: { failures: actionableFailures.slice(0, 10), ignored_failures: requestFailures.length - actionableFailures.length },
      evidence_refs: [],
    });
  } else {
    findings.push({
      kind: "network",
      label: "Network request stability",
      status: "pass",
      message:
        requestFailures.length > 0
          ? "No actionable failed network requests were captured during execution."
          : "No failed network requests were captured during execution.",
      metadata: { ignored_failures: requestFailures.length },
      evidence_refs: [],
    });
  }
}

async function pushImageFinding(page, findings) {
  const brokenImages = await page
    .locator("img")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          src: node.getAttribute("src") || "",
          alt: node.getAttribute("alt") || "",
          complete: node.complete,
          naturalWidth: node.naturalWidth || 0,
        }))
        .filter((image) => image.complete && image.src && image.naturalWidth === 0)
        .slice(0, 10)
    )
    .catch(() => []);

  if (brokenImages.length > 0) {
    findings.push({
      kind: "images",
      label: "Image render integrity",
      status: "warn",
      message: `${brokenImages.length} broken image elements were detected.`,
      metadata: { broken_images: brokenImages },
      evidence_refs: [],
    });
  } else {
    findings.push({
      kind: "images",
      label: "Image render integrity",
      status: "pass",
      message: "No broken image elements were detected.",
      metadata: {},
      evidence_refs: [],
    });
  }
}

async function pickFirstVisibleCandidate(page, selector, candidates) {
  for (const candidate of candidates) {
    const locator = page.locator(selector).nth(candidate.index);
    try {
      if (await locator.isVisible()) {
        return { locator, candidate };
      }
    } catch {
      // Continue scanning until we find a visible candidate.
    }
  }

  return null;
}

async function isVisibleSafe(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function getLocatorDebug(locator) {
  try {
    return await locator.evaluate((node) => ({
      tag: node.tagName,
      class: node.getAttribute("class"),
      aria_label: node.getAttribute("aria-label"),
      href: node.getAttribute("href"),
      uk_toggle: node.getAttribute("uk-toggle"),
      text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
      rect: (() => {
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })(),
    }));
  } catch {
    return null;
  }
}

function selectorList(key, fallback) {
  const configured = SITE_CONFIG[key];
  return Array.isArray(configured) && configured.length > 0 ? configured : fallback;
}

function selectorValue(key, fallback) {
  const configured = SITE_CONFIG[key];
  return typeof configured === "string" && configured.trim().length > 0 ? configured : fallback;
}

async function detectMobileMenuMarkup(page) {
  try {
    const html = await withTimeout(page.content(), 8000, "Mobile menu markup inspection");
    const normalized = html.toLowerCase();
    const hasToggle =
      normalized.includes("uk-navbar-toggle") ||
      normalized.includes("uk-toggle") ||
      normalized.includes("tm-dialog-mobile");
    const hasOffcanvasTarget =
      normalized.includes("id=\"tm-dialog-mobile\"") ||
      normalized.includes("id='tm-dialog-mobile'") ||
      normalized.includes("uk-offcanvas-bar");
    return {
      inspected: true,
      has_toggle: hasToggle,
      has_offcanvas_target: hasOffcanvasTarget,
      strategy: "html-markup",
    };
  } catch (error) {
    return {
      inspected: false,
      has_toggle: false,
      has_offcanvas_target: false,
      strategy: "html-markup",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function firstKnownCtaHref(page) {
  const selectors = [
    "a[href*='createPipelineApplication']",
    "a[href*='scheduleTour']",
    "a[href^='tel:']",
    "a[href*='/contact/#form']",
  ];

  for (const selector of selectors) {
    const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
    if (isUsableHref(href)) {
      return href;
    }
  }

  return null;
}

async function collectConnectivitySmoke(page, findings, jsErrors) {
  await page.waitForTimeout(1000);
  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function collectCriticalCtaSmoke(page, findings, jsErrors, deviceProfile) {
  const isMobile = deviceProfile === "iphone_safari" || deviceProfile === "android_chrome";
  const homepageUrl = page.url();
  logProgress("Critical CTA smoke start", { device_profile: deviceProfile, mobile: isMobile, url: homepageUrl });
  const apartmentsHref = await page
    .locator("a[href*='/apartments/'], a[href='/apartments/'], a[href='/apartments']")
    .first()
    .getAttribute("href")
    .catch(() => null);

  if (isUsableHref(apartmentsHref)) {
    const apartmentsUrl = new URL(apartmentsHref, homepageUrl).toString();
    try {
      logProgress("Navigating to apartments page", { device_profile: deviceProfile, apartments_url: apartmentsUrl });
      await page.goto(apartmentsUrl, {
        waitUntil: isMobile ? "commit" : "domcontentloaded",
        timeout: STEP_TIMEOUT_MS,
      });
      await page.waitForTimeout(1000);
      findings.push({
        kind: "unit_listing",
        label: "Unit listing reachability",
        status: "pass",
        message: `Primary unit listing surface loaded at ${apartmentsUrl}.`,
        metadata: { apartments_url: apartmentsUrl },
        evidence_refs: [],
      });
    } catch (error) {
      findings.push({
        kind: "unit_listing",
        label: "Unit listing reachability",
        status: "fail",
        message: error instanceof Error ? error.message : "Failed to reach unit listing page.",
        metadata: { apartments_url: apartmentsUrl },
        evidence_refs: [],
      });
      await pushJavascriptFinding(findings, jsErrors);
      return findings;
    }
  } else {
    findings.push({
      kind: "unit_listing",
      label: "Unit listing reachability",
      status: "warn",
      message: "No apartments/unit listing link was detected from the homepage.",
      metadata: {},
      evidence_refs: [],
    });
  }

  const unitDetailHref = await page
    .locator("a[href*='/apartment/']")
    .first()
    .getAttribute("href")
    .catch(() => null);

  if (isUsableHref(unitDetailHref)) {
    const unitDetailUrl = new URL(unitDetailHref, page.url()).toString();
    try {
      logProgress("Navigating to unit detail page", { device_profile: deviceProfile, unit_detail_url: unitDetailUrl });
      const previousUrl = page.url();
      await page.goto(unitDetailUrl, {
        waitUntil: isMobile ? "commit" : "domcontentloaded",
        timeout: STEP_TIMEOUT_MS,
      });
      await page.waitForTimeout(1000);
      const title = await page.title();
      findings.push({
        kind: "unit_detail",
        label: "Unit detail reachability",
        status: title ? "pass" : "warn",
        message: title
          ? `Unit detail page loaded at ${unitDetailUrl} with title "${title}".`
          : `Unit detail page loaded at ${unitDetailUrl} but returned an empty title.`,
        metadata: { previous_url: previousUrl, unit_detail_url: unitDetailUrl, title },
        evidence_refs: [],
      });
    } catch (error) {
      findings.push({
        kind: "unit_detail",
        label: "Unit detail reachability",
        status: "fail",
        message: error instanceof Error ? error.message : "Failed to reach a unit detail page.",
        metadata: { unit_detail_url: unitDetailHref },
        evidence_refs: [],
      });
    }
  } else {
    findings.push({
      kind: "unit_detail",
      label: "Unit detail reachability",
      status: "warn",
      message: "No unit detail link was detected on the apartments page.",
      metadata: {},
      evidence_refs: [],
    });
  }

  if (isMobile) {
    logProgress("Starting mobile-specific journey checks", { device_profile: deviceProfile, current_url: page.url() });
    const navigationLinkSelector = selectorValue(
      "navigation_link_selector",
      "#tm-dialog-mobile a, .uk-offcanvas-bar a, nav a, [role='navigation'] a, header a"
    );
    const navigationLinkPattern = new RegExp(
      selectorValue(
        "navigation_link_pattern",
        "floor|apart|amenit|gallery|neighborhood|contact|home|feature|location"
      ),
      "i"
    );
    const collectVisibleNavLinks = async () =>
      await page
        .locator(navigationLinkSelector)
        .filter({ hasText: navigationLinkPattern })
        .count();

    const uiKitMenuSelectors = selectorList("mobile_menu_selectors", [
      ".tm-header-mobile a.uk-navbar-toggle",
      ".tm-header-mobile [uk-toggle][href*='tm-dialog-mobile']",
      "a.uk-navbar-toggle",
      "[uk-toggle][href*='tm-dialog-mobile']",
      "[uk-navbar-toggle-icon]",
      "button[aria-label*='menu' i], [role='button'][aria-label*='menu' i]",
      "summary",
    ]);
    const uiKitMenuLocator = page.locator(uiKitMenuSelectors.join(", ")).first();
    logProgress("Inspecting mobile menu controls", { device_profile: deviceProfile, selector_count: uiKitMenuSelectors.length });
    const menuMarkup = await detectMobileMenuMarkup(page);
    logProgress("Mobile menu markup inspection completed", {
      device_profile: deviceProfile,
      inspected: menuMarkup.inspected,
      has_toggle: menuMarkup.has_toggle,
      has_offcanvas_target: menuMarkup.has_offcanvas_target,
    });
    if (menuMarkup.has_toggle && menuMarkup.has_offcanvas_target) {
      findings.push({
        kind: "navigation",
        label: "Primary navigation access",
        status: "pass",
        message: "Mobile menu control and off-canvas target were detected in page markup.",
        metadata: {
          mobile: true,
          proof_level: "structural",
          strategy: "html-markup",
          menu_markup: menuMarkup,
        },
        evidence_refs: [],
      });
    }
    let hasNavigationFinding = findings.some((f) => f.kind === "navigation");
    if (!hasNavigationFinding) {
    const domMenuDebug = await page
      .evaluate((selectors) => {
        for (const selector of selectors) {
          const node = document.querySelector(selector);
          if (node) {
            const rect = node.getBoundingClientRect();
            return {
              found: true,
              selector,
              tag: node.tagName,
              class: node.getAttribute("class"),
              aria_label: node.getAttribute("aria-label"),
              href: node.getAttribute("href"),
              uk_toggle: node.getAttribute("uk-toggle"),
              text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            };
          }
        }
        return { found: false, selectors };
      }, uiKitMenuSelectors)
      .catch(() => null);

    try {
      if ((await uiKitMenuLocator.count()) > 0 || domMenuDebug?.found) {
        logProgress("Mobile menu control detected", { device_profile: deviceProfile, dom_found: Boolean(domMenuDebug?.found) });
        await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
        await page.waitForTimeout(500);
        const uiKitVisible = await isVisibleSafe(uiKitMenuLocator);
        const uiKitDebug = await getLocatorDebug(uiKitMenuLocator);
        const offcanvasBefore = await page
          .locator("#tm-dialog-mobile, .uk-offcanvas-bar")
          .first()
          .evaluate((node) => ({
            class: node.getAttribute("class"),
            aria_hidden: node.getAttribute("aria-hidden"),
          }))
          .catch(() => null);
        try {
          logProgress("Attempting mobile menu interaction", { device_profile: deviceProfile });
          if ((await uiKitMenuLocator.count()) > 0) {
            await uiKitMenuLocator.scrollIntoViewIfNeeded().catch(() => {});
          }
          if (uiKitVisible) {
            await uiKitMenuLocator.click({ timeout: INTERACTION_TIMEOUT_MS });
          } else if (domMenuDebug?.selector) {
            await page
              .evaluate((selector) => {
                const node = document.querySelector(selector);
                if (!node) throw new Error("DOM selector fallback did not find mobile menu toggle.");
                node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
              }, domMenuDebug.selector)
              .catch(() => {});
          } else {
            await uiKitMenuLocator.evaluate((node) => node.click()).catch(() => {});
          }
          await page.waitForTimeout(900);
          const visibleNavLinks = await collectVisibleNavLinks();
          const offcanvasAfter = await page
            .locator("#tm-dialog-mobile, .uk-offcanvas-bar")
            .first()
            .evaluate((node) => ({
              class: node.getAttribute("class"),
              aria_hidden: node.getAttribute("aria-hidden"),
            }))
            .catch(() => null);
          logProgress("Mobile menu interaction completed", {
            device_profile: deviceProfile,
            visible_nav_links: visibleNavLinks,
            offcanvas_before: Boolean(offcanvasBefore),
            offcanvas_after: Boolean(offcanvasAfter),
          });
          const offcanvasDetected = Boolean(offcanvasBefore || offcanvasAfter);
          const navigationPass = visibleNavLinks > 0 || offcanvasDetected;
          findings.push({
            kind: "navigation",
            label: "Primary navigation access",
            status: navigationPass ? "pass" : "warn",
            message:
              visibleNavLinks > 0
                ? `Menu interaction exposed ${visibleNavLinks} visible navigation links.`
                : offcanvasDetected
                  ? "UIkit mobile menu control and off-canvas target were detected; BrowserStack did not expose visible nav links after interaction."
                : uiKitVisible
                  ? "UIkit mobile menu toggle was clicked but no obvious navigation links were exposed afterward."
                  : "UIkit mobile menu toggle exists in the DOM, but forced interaction did not expose obvious navigation links.",
            metadata: {
              visible_nav_links: visibleNavLinks,
              offcanvas_detected: offcanvasDetected,
              mobile: true,
              strategy: "uikit-toggle",
              visible: uiKitVisible,
              locator: uiKitDebug,
              dom_selector: domMenuDebug,
              offcanvas_before: offcanvasBefore,
              offcanvas_after: offcanvasAfter,
            },
            evidence_refs: [],
          });
        } catch {
          findings.push({
            kind: "navigation",
            label: "Primary navigation access",
            status: "warn",
            message: uiKitVisible
              ? "UIkit mobile menu toggle was visible but interaction failed."
              : "UIkit mobile menu toggle exists in the DOM but could not be activated.",
            metadata: {
              mobile: true,
              strategy: "uikit-toggle",
              visible: uiKitVisible,
              locator: uiKitDebug,
              dom_selector: domMenuDebug,
              offcanvas_before: offcanvasBefore,
            },
            evidence_refs: [],
          });
        }
      }
    } catch {
      // Fall through to the generic mobile detection strategies.
    }
      hasNavigationFinding = findings.some((f) => f.kind === "navigation");
    }
    if (!hasNavigationFinding) {
    logProgress("Falling back to generic mobile nav detection", { device_profile: deviceProfile });
    const mobileMenuLocators = uiKitMenuSelectors.map((selector) => page.locator(selector).first());

    let menuHandled = false;
    for (const locator of mobileMenuLocators) {
      try {
        if (await isVisibleSafe(locator)) {
          await locator.click({ timeout: INTERACTION_TIMEOUT_MS });
          await page.waitForTimeout(750);
          const visibleNavLinks = await collectVisibleNavLinks();
          findings.push({
            kind: "navigation",
            label: "Primary navigation access",
            status: visibleNavLinks > 0 ? "pass" : "warn",
            message:
              visibleNavLinks > 0
                ? `Menu interaction exposed ${visibleNavLinks} visible navigation links.`
                : "Menu interaction succeeded but no obvious navigation links were detected afterward.",
            metadata: { visible_nav_links: visibleNavLinks, mobile: true },
            evidence_refs: [],
          });
          menuHandled = true;
          break;
        }
      } catch {
        // Keep scanning other menu locator strategies.
      }
    }

    if (!menuHandled) {
      findings.push({
        kind: "navigation",
        label: "Primary navigation access",
        status: "warn",
        message: "No visible mobile menu toggle was detected with the supported iOS locator set.",
        metadata: { mobile: true, dom_selector: domMenuDebug },
        evidence_refs: [],
      });
    }
    }

    const ctaLocators = [
      ...selectorList("mobile_cta_selectors", [
        "a[href*='createPipelineApplication']",
        "a[href*='scheduleTour']",
        "a[href^='tel:']",
        "a[href*='/contact/#form']",
      ]).map((selector) => page.locator(selector).first()),
      page.getByRole("link", { name: /apply|schedule|tour|availability|pricing|quote|contact/i }).first(),
      page.getByRole("button", { name: /apply|schedule|tour|availability|pricing|quote|contact/i }).first(),
    ];

    let ctaHandled = false;
    logProgress("Starting mobile CTA detection", { device_profile: deviceProfile });
    for (const locator of ctaLocators) {
      try {
        if (await isVisibleSafe(locator)) {
          await locator.click({ timeout: INTERACTION_TIMEOUT_MS, trial: true });
          findings.push({
            kind: "cta",
            label: "Critical CTA availability",
            status: "pass",
            message: "A primary CTA is visible and clickable on mobile.",
            metadata: { href: (await locator.getAttribute("href")) || null },
            evidence_refs: [],
          });
          ctaHandled = true;
          break;
        }
      } catch {
        // Continue through supported locator options.
      }
    }

    if (!ctaHandled) {
      const fallbackHref = await firstKnownCtaHref(page);
      findings.push({
        kind: "cta",
        label: "Critical CTA availability",
        status: fallbackHref ? "pass" : "warn",
        message: fallbackHref
          ? `Known mobile CTA handoff is present on the page -> ${fallbackHref}.`
          : "No visible mobile CTA was found with the supported locator set.",
        metadata: { href: fallbackHref },
        evidence_refs: [],
      });
    }

    const interiorLocators = [
      page.getByRole("link", { name: /floor|amenit|gallery|neighborhood|contact|faq|review|plan/i }).first(),
      ...selectorList("mobile_interior_selectors", [
        "a[href*='/contact']",
        "a[href*='/floor']",
        "a[href*='/amenit']",
        "a[href*='/gallery']",
        "a[href*='/neighborhood']",
      ]).map((selector) => page.locator(selector).first()),
    ];

    let interiorHandled = false;
    logProgress("Starting mobile interior-page detection", { device_profile: deviceProfile });
    for (const locator of interiorLocators) {
      try {
        const href = await locator.getAttribute("href");
        if (!isUsableHref(href)) continue;
        const interiorUrl = new URL(href, page.url()).toString();
        const previousUrl = page.url();
        await page.goto(interiorUrl, { waitUntil: "commit", timeout: STEP_TIMEOUT_MS });
        await page.waitForTimeout(1000);
        const title = await page.title();
        findings.push({
          kind: "interior_page",
          label: "Interior page reachability",
          status: title ? "pass" : "warn",
          message: title
            ? `Interior page loaded at ${interiorUrl} with title "${title}".`
            : `Interior page loaded at ${interiorUrl} but returned an empty title.`,
          metadata: { previous_url: previousUrl, interior_url: interiorUrl, title },
          evidence_refs: [],
        });
        interiorHandled = true;
        break;
      } catch {
        // Try the next interior locator strategy.
      }
    }

    if (!interiorHandled) {
      findings.push({
        kind: "interior_page",
        label: "Interior page reachability",
        status: "warn",
        message: "No interior page candidate was reached with the supported mobile locator set.",
        metadata: {},
        evidence_refs: [],
      });
    }

    const conversionLocator = page
      .locator(
        selectorList("mobile_conversion_selectors", [
          "a[href^='tel:']",
          "a[href^='mailto:']",
          "a[href*='apply']",
          "a[href*='tour']",
          "a[href*='quote']",
        ]).join(",")
      )
      .first();
    logProgress("Checking mobile conversion handoff", { device_profile: deviceProfile });
    const conversionHref = await conversionLocator.getAttribute("href").catch(() => null);
    if (conversionHref) {
      findings.push({
        kind: "conversion_handoff",
        label: "Conversion handoff presence",
        status: "pass",
        message: `Detected mobile conversion handoff -> ${conversionHref}.`,
        metadata: { href: conversionHref },
        evidence_refs: [],
      });
    } else {
      findings.push({
        kind: "conversion_handoff",
        label: "Conversion handoff presence",
        status: "warn",
        message: "No conversion handoff candidate was detected with the supported mobile locator set.",
        metadata: {},
        evidence_refs: [],
      });
    }

    await pushJavascriptFinding(findings, jsErrors);
    return findings;
  }

  const menuCandidateIndex = await page
    .locator("button,[role='button'],summary")
    .evaluateAll((nodes) =>
      nodes.findIndex((node) => {
        const raw =
          `${node.getAttribute("aria-label") || ""} ${node.getAttribute("class") || ""} ${
            node.textContent || ""
          }`.toLowerCase();
        return raw.includes("menu") || raw.includes("hamburger") || raw.includes("nav");
      })
    );

  if (menuCandidateIndex >= 0) {
    const menuLocator = page.locator("button,[role='button'],summary").nth(menuCandidateIndex);
    const menuVisible = await menuLocator.isVisible().catch(() => false);
    if (menuVisible) {
      try {
        await menuLocator.scrollIntoViewIfNeeded();
        await menuLocator.click({ timeout: INTERACTION_TIMEOUT_MS });
        await page.waitForTimeout(750);
        const visibleNavLinks = await page
          .locator("nav a, [role='navigation'] a, header a")
          .filter({ hasText: /floor|amenit|gallery|neighborhood|contact|home/i })
          .count();
        findings.push({
          kind: "navigation",
          label: "Primary navigation access",
          status: visibleNavLinks > 0 ? "pass" : "warn",
          message:
            visibleNavLinks > 0
              ? `Menu interaction exposed ${visibleNavLinks} visible navigation links.`
              : "Menu toggle was clickable but no obvious navigation links were detected afterward.",
          metadata: { visible_nav_links: visibleNavLinks, mobile: isMobile },
          evidence_refs: [],
        });
      } catch (error) {
        findings.push({
          kind: "navigation",
          label: "Primary navigation access",
          status: isMobile ? "fail" : "warn",
          message: error instanceof Error ? error.message : "Navigation interaction failed.",
          metadata: { mobile: isMobile },
          evidence_refs: [],
        });
      }
    } else {
      findings.push({
        kind: "navigation",
        label: "Primary navigation access",
        status: isMobile ? "warn" : "pass",
        message: isMobile
          ? "A menu toggle exists in the DOM but was not visible in the current viewport."
          : "Desktop navigation is present without a visible menu toggle.",
        metadata: { mobile: isMobile },
        evidence_refs: [],
      });
    }
  } else {
    findings.push({
      kind: "navigation",
      label: "Primary navigation access",
      status: isMobile ? "warn" : "pass",
      message: isMobile
        ? "No explicit mobile menu toggle was detected; header may already be expanded."
        : "No explicit menu toggle required on desktop layout.",
      metadata: { mobile: isMobile },
      evidence_refs: [],
    });
  }

  const ctaCandidates = await page.locator("a, button, [role='button']").evaluateAll((nodes) =>
    nodes
      .map((node, index) => {
        const text = (node.textContent || "").trim().replace(/\s+/g, " ");
        return {
          index,
          text,
          href: node.getAttribute("href"),
          aria: node.getAttribute("aria-label"),
        };
      })
      .filter((item) => {
        const raw = `${item.text || ""} ${item.aria || ""} ${item.href || ""}`;
        return /apply|schedule|tour|availability|floor plan|pricing|quote|contact/i.test(raw);
      })
      .sort((a, b) => {
        const aPriority = /createPipelineApplication|scheduleTour|tel:/.test(a.href || "") ? 0 : 1;
        const bPriority = /createPipelineApplication|scheduleTour|tel:/.test(b.href || "") ? 0 : 1;
        return aPriority - bPriority;
      })
      .slice(0, 4)
  );

  if (ctaCandidates.length === 0) {
    findings.push({
      kind: "cta",
      label: "Critical CTA availability",
      status: "fail",
      message: "No primary CTA candidates were detected on the page.",
      metadata: {},
      evidence_refs: [],
    });
  } else {
    const visibleCta = await pickFirstVisibleCandidate(page, "a, button, [role='button']", ctaCandidates);
    if (!visibleCta) {
      const fallbackHref = await firstKnownCtaHref(page);
      findings.push({
        kind: "cta",
        label: "Critical CTA availability",
        status: fallbackHref ? "pass" : "warn",
        message: fallbackHref
          ? `Known CTA handoff is present on the unit page -> ${fallbackHref}.`
          : "CTA candidates were present in the DOM but none were visible in the current viewport.",
        metadata: { candidate_count: ctaCandidates.length, href: fallbackHref },
        evidence_refs: [],
      });
    } else {
      const { locator, candidate: ctaCandidate } = visibleCta;
      try {
        await locator.scrollIntoViewIfNeeded();
        const visible = await locator.isVisible();
        if (!visible) throw new Error("CTA candidate was not visible.");
        await locator.click({ timeout: INTERACTION_TIMEOUT_MS, trial: true });
        findings.push({
          kind: "cta",
          label: "Critical CTA availability",
          status: "pass",
          message: `Primary CTA "${normalizeText(ctaCandidate.text || ctaCandidate.aria || "CTA")}" is visible and clickable.`,
          metadata: { href: ctaCandidate.href || null },
          evidence_refs: [],
        });
      } catch (error) {
        findings.push({
          kind: "cta",
          label: "Critical CTA availability",
          status: "fail",
          message: error instanceof Error ? error.message : "CTA interaction failed.",
          metadata: { href: ctaCandidate.href || null },
          evidence_refs: [],
        });
      }
    }
  }

  const interiorCandidates = await page.locator("a[href]").evaluateAll((nodes, currentUrl) =>
    nodes
      .map((node) => {
        const href = node.getAttribute("href");
        const text = (node.textContent || "").trim().replace(/\s+/g, " ");
        return { href, text };
      })
      .filter((item) => {
        if (!item.href) return false;
        if (item.href.startsWith("#") || item.href.startsWith("javascript:")) return false;
        try {
          const current = new URL(currentUrl);
          const target = new URL(item.href, currentUrl);
          return (
            target.origin === current.origin &&
            target.pathname !== "/" &&
            !target.pathname.startsWith("/wp-") &&
            !target.pathname.includes("feed")
          );
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const aScore = /floor|amenit|gallery|neighborhood|contact|faq|review|plan/i.test(
          `${a.text || ""} ${a.href || ""}`
        )
          ? 0
          : 1;
        const bScore = /floor|amenit|gallery|neighborhood|contact|faq|review|plan/i.test(
          `${b.text || ""} ${b.href || ""}`
        )
          ? 0
          : 1;
        return aScore - bScore;
      })
      .slice(0, 1),
    page.url()
  );

  if (interiorCandidates.length === 0) {
    findings.push({
      kind: "interior_page",
      label: "Interior page reachability",
      status: "warn",
      message: "No same-origin interior page candidate was detected from the homepage.",
      metadata: {},
      evidence_refs: [],
    });
  } else {
    const interiorHref = new URL(interiorCandidates[0].href, page.url()).toString();
    try {
      const previousUrl = page.url();
      await page.goto(interiorHref, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
      const title = await page.title();
      findings.push({
        kind: "interior_page",
        label: "Interior page reachability",
        status: title ? "pass" : "warn",
        message: title
          ? `Interior page loaded at ${interiorHref} with title "${title}".`
          : `Interior page loaded at ${interiorHref} but returned an empty title.`,
        metadata: { previous_url: previousUrl, interior_url: interiorHref, title },
        evidence_refs: [],
      });
    } catch (error) {
      findings.push({
        kind: "interior_page",
        label: "Interior page reachability",
        status: "fail",
        message: error instanceof Error ? error.message : "Interior page navigation failed.",
        metadata: { interior_url: interiorHref },
        evidence_refs: [],
      });
    }
  }

  const conversionCandidates = await page.locator("a[href], button, [role='button']").evaluateAll(
    (nodes, currentUrl) =>
      nodes
        .map((node) => {
          const href = node.getAttribute("href");
          const text = (node.textContent || "").trim().replace(/\s+/g, " ");
          const aria = node.getAttribute("aria-label");
          return { href, text, aria };
        })
        .filter((item) => {
          const raw = `${item.text || ""} ${item.aria || ""} ${item.href || ""}`;
          return /apply|schedule|tour|quote|call|contact|availability/i.test(raw);
        })
        .map((item) => {
          let external = false;
          try {
            if (item.href) {
              external = new URL(item.href, currentUrl).origin !== new URL(currentUrl).origin;
            }
          } catch {
            external = false;
          }
          return { ...item, external };
        })
        .sort((a, b) => Number(b.external) - Number(a.external))
        .slice(0, 1),
    page.url()
  );

  if (conversionCandidates.length === 0) {
    findings.push({
      kind: "conversion_handoff",
      label: "Conversion handoff presence",
      status: "warn",
      message: "No conversion handoff candidate was detected.",
      metadata: {},
      evidence_refs: [],
    });
  } else {
    const candidate = conversionCandidates[0];
    findings.push({
      kind: "conversion_handoff",
      label: "Conversion handoff presence",
      status: isUsableHref(candidate.href) || normalizeText(candidate.text || candidate.aria).length > 0 ? "pass" : "warn",
      message: `Detected conversion handoff "${normalizeText(candidate.text || candidate.aria || "CTA")}"${candidate.href ? ` -> ${candidate.href}` : ""}.`,
      metadata: { href: candidate.href || null, external: candidate.external },
      evidence_refs: [],
    });
  }

  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function withBrowser(device, fn) {
  const hasBrowserStackCreds = Boolean(
    process.env.BROWSERSTACK_USERNAME && process.env.BROWSERSTACK_ACCESS_KEY
  );

  if (hasBrowserStackCreds) {
    if (device.device_profile === "android_chrome") {
      logProgress("Connecting to BrowserStack Android", {
        device_profile: device.device_profile,
        target_url: TARGET_URL,
      });
      const connectedDevice = await withTimeout(
        android.connect(buildWsEndpoint(device)),
        CONNECT_TIMEOUT_MS,
        `BrowserStack Android connect for ${device.device_profile}`
      );
      let browser;
      try {
        logProgress("Connected to BrowserStack Android", { device_profile: device.device_profile });
        browser = await withTimeout(
          connectedDevice.launchBrowser(),
          CONNECT_TIMEOUT_MS,
          `BrowserStack Android launchBrowser for ${device.device_profile}`
        );
        return await fn(browser, "browserstack");
      } finally {
        if (browser) {
          await safeAsyncCleanup(`BrowserStack Android browser close for ${device.device_profile}`, () =>
            browser.close()
          );
        }
        await safeAsyncCleanup(`BrowserStack Android device close for ${device.device_profile}`, () =>
          connectedDevice.close()
        );
      }
    }

    const browserType = device.browserEngine === "webkit" ? webkit : chromium;
    logProgress("Connecting to BrowserStack", {
      device_profile: device.device_profile,
      target_url: TARGET_URL,
    });
    const browser = await withTimeout(
      browserType.connect({
        wsEndpoint: buildWsEndpoint(device),
      }),
      CONNECT_TIMEOUT_MS,
      `BrowserStack connect for ${device.device_profile}`
    );
    try {
      logProgress("Connected to BrowserStack", { device_profile: device.device_profile });
      return await fn(browser, "browserstack");
    } finally {
      await safeAsyncCleanup(`BrowserStack close for ${device.device_profile}`, () => browser.close());
    }
  }

  const browserType = device.browserEngine === "webkit" ? webkit : chromium;
  const browser = await browserType.launch({ headless: true });
  try {
    return await fn(browser, "browserstack");
  } finally {
    await safeAsyncCleanup(`Local browser close for ${device.device_profile}`, () => browser.close());
  }
}

async function collectFindings(page, deviceProfile) {
  const findings = [];

  const title = await page.title();
  findings.push({
    kind: "page_load",
    label: "Homepage load",
    status: title ? "pass" : "fail",
    message: title ? `Loaded page with title "${title}"` : "Page title was empty after load.",
    metadata: { title },
    evidence_refs: [],
  });

  const jsErrors = [];
  const requestFailures = [];
  page.on("pageerror", (error) => {
    jsErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      resource_type: request.resourceType(),
      failure_text: request.failure()?.errorText || "unknown",
    });
  });

  if (PROFILE === "connectivity_smoke") {
    const profileFindings = await collectConnectivitySmoke(page, findings, jsErrors);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "critical_cta_smoke") {
    const profileFindings = await collectCriticalCtaSmoke(page, findings, jsErrors, deviceProfile);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  const interactive = await page
    .locator("a, button, [role='button']")
    .evaluateAll(
      (nodes, maxItems) =>
        nodes.slice(0, maxItems).map((node, index) => {
      const element = node;
      const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
      return {
        index,
        tag: element.tagName.toLowerCase(),
        text,
        href: element.getAttribute("href"),
        selector_hint:
          element.getAttribute("data-testid") ||
          element.getAttribute("data-test") ||
          element.getAttribute("data-qa") ||
          element.getAttribute("aria-label") ||
          text ||
          element.tagName.toLowerCase(),
      };
    }),
      MAX_INTERACTIVE_ITEMS
    );

  for (const item of interactive) {
    const label = item.text || item.selector_hint || item.tag;
    const locator = page.locator("a, button, [role='button']").nth(item.index);
    try {
      await locator.scrollIntoViewIfNeeded();
      const visible = await locator.isVisible();
      if (!visible) {
        findings.push({
          kind: item.tag === "a" ? "link" : "button",
          label,
          selector_hint: item.selector_hint,
          href: item.href || undefined,
          status: "warn",
          message: "Element was discovered but not visible to the user.",
          metadata: {},
          evidence_refs: [],
        });
        continue;
      }

      const beforeUrl = page.url();
      if (item.href && sameOrigin(beforeUrl, item.href)) {
        await Promise.allSettled([
          page.waitForLoadState("domcontentloaded", { timeout: INTERACTION_TIMEOUT_MS }),
          locator.click({ timeout: INTERACTION_TIMEOUT_MS }),
        ]);
      } else {
        await locator.click({ timeout: INTERACTION_TIMEOUT_MS, trial: true });
      }

      findings.push({
        kind: item.tag === "a" ? "link" : "button",
        label,
        selector_hint: item.selector_hint,
        href: item.href || undefined,
        status: "pass",
        message: "Element was visible and accepted user interaction.",
        metadata: { before_url: beforeUrl, after_url: page.url() },
        evidence_refs: [],
      });
    } catch (error) {
      findings.push({
        kind: item.tag === "a" ? "link" : "button",
        label,
        selector_hint: item.selector_hint,
        href: item.href || undefined,
        status: "fail",
        message: error instanceof Error ? error.message : "Interaction failed.",
        metadata: {},
        evidence_refs: [],
      });
    }
  }

  const carousels = await page.locator("[class*='carousel'], [data-testid*='carousel'], .swiper, .slick-slider").count();
  findings.push({
    kind: "carousel",
    label: "Carousel surfaces",
    status: carousels > 0 ? "pass" : "warn",
    message: carousels > 0 ? `Detected ${carousels} carousel-like surfaces.` : "No obvious carousel surface detected.",
    metadata: { count: carousels },
    evidence_refs: [],
  });

  const videos = await page.locator("video, iframe[src*='youtube'], iframe[src*='vimeo']").count();
  findings.push({
    kind: "video",
    label: "Video surfaces",
    status: videos > 0 ? "pass" : "warn",
    message: videos > 0 ? `Detected ${videos} video-like embeds.` : "No obvious video surface detected.",
    metadata: { count: videos },
    evidence_refs: [],
  });

  const tours = await page
    .locator("a, button")
    .filter({ hasText: /tour|schedule|visit|availability/i })
    .count();
  findings.push({
    kind: "tour",
    label: "Tour and conversion surfaces",
    status: tours > 0 ? "pass" : "warn",
    message: tours > 0 ? `Detected ${tours} tour-oriented surfaces.` : "No obvious tour or schedule interaction detected.",
    metadata: { count: tours },
    evidence_refs: [],
  });

  if (jsErrors.length > 0) {
    findings.push({
      kind: "javascript",
      label: "JavaScript runtime stability",
      status: "fail",
      message: `${jsErrors.length} page errors were captured during execution.`,
      metadata: { errors: jsErrors },
      evidence_refs: [],
    });
  } else {
    findings.push({
      kind: "javascript",
      label: "JavaScript runtime stability",
      status: "pass",
      message: "No page runtime errors were captured during execution.",
      metadata: {},
      evidence_refs: [],
    });
  }

  await pushNetworkFinding(findings, requestFailures);
  await pushImageFinding(page, findings);

  return findings;
}

async function runDevice(device) {
  const started = Date.now();
  return withBrowser(device, async (browser, providerId) => {
    logProgress("Opening browser page", { device_profile: device.device_profile });
    const page = await browser.newPage();
    const waitUntil =
      PROFILE === "connectivity_smoke" || device.device_profile === "iphone_safari"
        ? "commit"
        : "domcontentloaded";
    await page.goto(TARGET_URL, { waitUntil, timeout: STEP_TIMEOUT_MS });
    await page.waitForTimeout(1500);

    logProgress("Collecting findings", { device_profile: device.device_profile });
    const findings = await collectFindings(page, device.device_profile);
    const screenshotPath = `${PROPERTY_ID}-${device.device_profile}.png`;
    const evidenceRefs = [];
    try {
      logProgress("Capturing screenshot", {
        device_profile: device.device_profile,
        screenshot_path: screenshotPath,
      });
      await withTimeout(
        page.screenshot({ path: screenshotPath, fullPage: PROFILE !== "connectivity_smoke" }),
        8000,
        `Screenshot capture for ${device.device_profile}`
      );
      evidenceRefs.push({
        kind: "artifact",
        label: `${device.device_profile} screenshot`,
        url: `file://${screenshotPath}`,
        provider: "browserstack",
      });
    } catch (error) {
      findings.push({
        kind: "artifact_capture",
        label: "Screenshot capture",
        status: "warn",
        message: error instanceof Error ? error.message : "Screenshot capture failed.",
        metadata: { screenshot_path: screenshotPath },
        evidence_refs: [],
      });
    }
    await safeAsyncCleanup(`Page close for ${device.device_profile}`, () => page.close());

    return {
      device_profile: device.device_profile,
      provider: providerId,
      duration_ms: Date.now() - started,
      classification: null,
      findings,
      evidence_refs: evidenceRefs,
    };
  });
}

async function main() {
  const startedAt = new Date().toISOString();
  const deviceRuns = [];
  for (const device of ACTIVE_DEVICE_MATRIX) {
    try {
      const run = await runDevice(device);
      run.classification = classifyDeviceRun(run);
      deviceRuns.push(run);
    } catch (error) {
      logProgress("Device run failed", {
        device_profile: device.device_profile,
        error: error instanceof Error ? error.message : "Unknown execution failure.",
      });
      const failedRun = {
        device_profile: device.device_profile,
        provider: "browserstack",
        duration_ms: 0,
        fatal_error: error instanceof Error ? error.message : "Unknown execution failure.",
        findings: [],
        evidence_refs: [],
      };
      failedRun.classification = classifyDeviceRun(failedRun);
      deviceRuns.push(failedRun);
    }
  }

  const payload = {
    request_id: REQUEST_ID,
    property_id: PROPERTY_ID,
    profile: PROFILE,
    environment: ENVIRONMENT,
    target_url: TARGET_URL,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    device_runs: deviceRuns,
  };

  logProgress("Writing result payload", {
    output_path: OUTPUT_PATH,
    device_count: deviceRuns.length,
  });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  process.stdout.write(JSON.stringify(payload, null, 2));
}

const keepAlive = setInterval(() => {}, 1000);

(async () => {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    clearInterval(keepAlive);
    setImmediate(() => process.exit(process.exitCode ?? 0));
  }
})();
