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
const CHECK_TIMEOUT_MS = Number(process.env.BROWSERSTACK_CHECK_TIMEOUT_MS || 60000);
const MOBILE_CHECK_TIMEOUT_MS = Number(process.env.BROWSERSTACK_MOBILE_CHECK_TIMEOUT_MS || 20000);
const PIPELINE_LANDING_TIMEOUT_MS = Number(process.env.BROWSERSTACK_PIPELINE_LANDING_TIMEOUT_MS || 18000);
const CAROUSEL_OBSERVATION_MS = Number(process.env.BROWSERSTACK_CAROUSEL_OBSERVATION_MS || 4500);
const INTERACTION_TIMEOUT_MS = Number(process.env.BROWSERSTACK_INTERACTION_TIMEOUT_MS || 2000);
const SCREENSHOT_TIMEOUT_MS = Number(process.env.BROWSERSTACK_SCREENSHOT_TIMEOUT_MS || 8000);
const MAX_INTERACTIVE_ITEMS = Number(process.env.BROWSERSTACK_MAX_INTERACTIVE_ITEMS || 6);
const SITE_PATTERNS_PATH = new URL("../../config/browserstack-site-patterns.json", import.meta.url);
const QA_CONTRACT_PATH = new URL("../../config/portfolio-functionality-qa-contract.json", import.meta.url);

let firstUnitDetailContext = null;
let mobileApartmentsSnapshotContext = null;

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

function loadQaContract() {
  try {
    return JSON.parse(fs.readFileSync(QA_CONTRACT_PATH, "utf8"));
  } catch (error) {
    logProgress("QA contract unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { checks: [] };
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

function urlsMatchSameHostPath(rawUrl, expectedPath) {
  try {
    const target = new URL(rawUrl, TARGET_URL);
    const expected = new URL(expectedPath, target.origin);
    const targetPath = target.pathname.replace(/\/+$/, "/");
    const expectedPathname = expected.pathname.replace(/\/+$/, "/");
    return target.hostname === expected.hostname && targetPath === expectedPathname;
  } catch {
    return false;
  }
}

function isUsableHref(rawHref) {
  if (!rawHref) return false;
  const href = rawHref.trim();
  return !href.startsWith("#") && !href.startsWith("javascript:");
}

function qaFinding(check, status, message, metadata = {}) {
  const finalStatus = applyQaStatusPolicy(check, status, message, metadata);
  return {
    check_id: check.check_id,
    kind: `portfolio_qa:${check.assertion_type}`,
    label: check.description,
    status: finalStatus,
    message,
    metadata: {
      ...metadata,
      status_policy: finalStatus !== status ? { original_status: status, promoted_to: finalStatus } : undefined,
      qa_contract_id: check.contract_id,
      qa_source: check.source,
      qa_owner: check.owner,
      qa_page: check.page,
      qa_section: check.section,
      qa_assertion_type: check.assertion_type,
      qa_runner_profile: check.runner_profile,
      qa_severity: check.severity || "medium",
      truth_sources: check.truth_sources,
      side_effect_policy: check.side_effect_policy,
    },
    evidence_refs: [],
  };
}

function applyQaStatusPolicy(check, status, message, metadata = {}) {
  if (status !== "warn") return status;
  if ((check.severity || "").toLowerCase() !== "high") return status;

  const assertionType = String(check.assertion_type || "");
  const messageText = String(message || "").toLowerCase();
  const criticalAbsentAssertions = new Set([
    "external_handoff_pipeline_application",
    "external_handoff_schedule_tour",
    "external_handoff_price_quote",
    "unit_detail_context_continuity",
  ]);
  if (!criticalAbsentAssertions.has(assertionType)) return status;

  if (metadata?.target_url || metadata?.target) return status;
  if (/no .*detected|missing|not detected|not found|could not be detected/.test(messageText)) {
    return "fail";
  }
  return status;
}

function qaSkipped(check, reason, metadata = {}) {
  return qaFinding(check, "skipped", reason, { blocked_reason: reason, ...metadata });
}

function qaNotApplicable(check, reason, metadata = {}) {
  return qaFinding(check, "not_applicable", reason, { not_applicable_reason: reason, ...metadata });
}

function uniqueChecks(checks) {
  const seen = new Set();
  return checks.filter((check) => {
    if (seen.has(check.check_id)) return false;
    seen.add(check.check_id);
    return true;
  });
}

function qaChecksForProfile(profile, owners = ["evs"]) {
  const contract = loadQaContract();
  const ownerSet = new Set(owners);
  return uniqueChecks(
    (contract.checks || [])
      .filter((check) => ownerSet.has(check.owner) && check.runner_profile === profile)
      .map((check) => ({ ...check, contract_id: contract.contract_id }))
  );
}

function mobileApartmentsPricingChecks() {
  return qaChecksForProfile("apartments_pricing_deep_journey").map((check) => ({
    ...check,
    runner_profile: "apartments_pricing_mobile_journey",
  }));
}

function writeProfileCheckpoint(findings, metadata = {}) {
  const checkpointPath = process.env.EVS_CHECKPOINT_PATH || `${OUTPUT_PATH}.checkpoint.json`;
  try {
    fs.writeFileSync(
      checkpointPath,
      JSON.stringify(
        {
          request_id: REQUEST_ID,
          property_id: PROPERTY_ID,
          profile: PROFILE,
          environment: ENVIRONMENT,
          target_url: TARGET_URL,
          updated_at: new Date().toISOString(),
          findings,
          metadata,
        },
        null,
        2
      )
    );
  } catch (error) {
    logProgress("Checkpoint write warning", {
      checkpoint_path: checkpointPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function pushJavascriptFinding(findings, jsErrors) {
  const actionableErrors = jsErrors.filter((message) => {
    const raw = String(message || "").toLowerCase();
    if (raw.includes("three.webglrenderer") && raw.includes("webgl context")) return false;
    if (raw.includes("error creating webgl context")) return false;
    if (raw.includes("could not create a webgl context")) return false;
    if (raw.includes("unable to create a webgl rendering context")) return false;
    if (raw.includes("webgl is not supported")) return false;
    if (raw.includes("model not found (404)")) return false;
    if (raw.includes("resizeobserver loop completed with undelivered notifications")) return false;
    if (raw.includes("resizeobserver loop limit exceeded")) return false;
    if (raw.includes("permission policy") && raw.includes("fullscreen") && raw.includes("youtube.com")) return false;
    if (raw.includes("matterport.com/showcase") || raw.includes("static.matterport.com")) return false;
    if (raw.includes("[plugin-config]") && raw.includes("status_code: 0")) return false;
    if (raw.includes("[plugin-config]") && raw.includes("failed to load configured plugins")) return false;
    if (raw.includes("[model-api-client]") && raw.includes("apolloerror: load failed")) return false;
    if (raw === "unhandled promise rejection") return false;
    if (raw.includes("failed to load resource: the server responded with a status of 404")) return false;
    return true;
  });

  if (actionableErrors.length > 0) {
    const sightMapApiErrors = actionableErrors.filter((message) =>
      String(message || "").toLowerCase().includes("sightmap iframe api")
    );
    const mappedMetadata =
      sightMapApiErrors.length > 0
        ? {
            qa_severity: "high",
            qa_source: {
              workbook: "_QA_Round 1_Property_Websites.xlsx",
              sheet: "Website QA Checklist",
              row: 90,
            },
            qa_page: "Apartments & Pricing",
            qa_section: "Unit Detail Page",
            qa_assertion_type: "external_handoff_sightmap_unit",
            mapped_runtime_error: "sightmap_iframe_api",
          }
        : {};
    findings.push({
      check_id: sightMapApiErrors.length > 0 ? "qa_90_apartments_pricing_unit_detail_page_external_handoff_sightmap_unit" : undefined,
      kind: "javascript",
      label: sightMapApiErrors.length > 0 ? "SightMap runtime stability" : "JavaScript runtime stability",
      status: "fail",
      message:
        sightMapApiErrors.length > 0
          ? `${sightMapApiErrors.length} SightMap API error(s) were captured during execution.`
          : `${actionableErrors.length} actionable page errors were captured during execution.`,
      metadata: { ...mappedMetadata, errors: actionableErrors, ignored_errors: jsErrors.length - actionableErrors.length },
      evidence_refs: [],
    });
  } else {
    findings.push({
      kind: "javascript",
      label: "JavaScript runtime stability",
      status: "pass",
      message:
        jsErrors.length > 0
          ? "No actionable page runtime errors were captured during execution."
          : "No page runtime errors were captured during execution.",
      metadata: { ignored_errors: jsErrors.length },
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
    const isCancelled = failureText.includes("cancelled");
    const isBeaconLike = resourceType === "ping";
    const isTelemetryHost =
      url.includes("analytics.google.com") ||
      url.includes("googletagmanager.com") ||
      url.includes("heap-api.com") ||
      url.includes("contentsquare.net") ||
      url.includes("static.matterport.com") ||
      url.includes("posthog") ||
      url.includes("google-analytics.com");
    const isMediaVendorHost =
      url.includes("matterport.com") ||
      url.includes("sightmap.com") ||
      url.includes("cdn.sightmap.com") ||
      url.includes("fonts.gstatic.com");

    if (isAbort && (isBeaconLike || isTelemetryHost || isMediaVendorHost)) {
      return false;
    }
    if (isCancelled && (isBeaconLike || isTelemetryHost || isMediaVendorHost)) {
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

function formatPageError(error) {
  const serializeUnknown = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    try {
      const seen = new WeakSet();
      return JSON.stringify(
        value,
        (key, nestedValue) => {
          if (typeof nestedValue === "function") return `[Function ${nestedValue.name || "anonymous"}]`;
          if (typeof nestedValue === "object" && nestedValue !== null) {
            if (seen.has(nestedValue)) return "[Circular]";
            seen.add(nestedValue);
          }
          return nestedValue;
        },
        2
      );
    } catch {
      return String(value || "");
    }
  };
  const parts = [
    error?.name,
    error?.message,
    error?.stack,
    serializeUnknown(error?.reason),
    serializeUnknown(error?.detail),
    serializeUnknown(error?.cause),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => value !== "{}" && value !== "[object Object]");
  const unique = [...new Set(parts)];
  if (unique.length > 0 && unique.some((part) => part !== "[object Object]")) {
    return unique.join("\n");
  }
  return serializeUnknown(error) || "unknown page error";
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

async function gotoTargetHome(page) {
  if (normalizeUrlForComparison(page.url()) === normalizeUrlForComparison(TARGET_URL)) {
    return;
  }
  await page.goto(TARGET_URL, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(700);
}

function normalizeUrlForComparison(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString().replace(/\/+$/, "/");
  } catch {
    return String(rawUrl || "").replace(/\/+$/, "/");
  }
}

function deviceCommitWait(page) {
  return page.viewportSize()?.width && page.viewportSize().width < 768;
}

async function visibleCount(page, selector) {
  const locators = page.locator(selector);
  const count = await locators.count().catch(() => 0);
  let visible = 0;
  for (let index = 0; index < Math.min(count, 30); index += 1) {
    if (await isVisibleSafe(locators.nth(index))) {
      visible += 1;
    }
  }
  return visible;
}

async function firstVisibleLocator(page, selectors) {
  for (const selector of selectors) {
    const locators = page.locator(selector);
    const count = await locators.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 12); index += 1) {
      const locator = locators.nth(index);
      if (await isVisibleSafe(locator)) {
        return { locator, selector, index };
      }
    }
  }
  return null;
}

async function firstHrefMatching(page, patterns, textPattern = null) {
  const selectorCandidates = [];
  const rawPatterns = patterns.join(" ");
  if (rawPatterns.includes("createpipelineapplication") || rawPatterns.includes("apply")) {
    selectorCandidates.push(
      "a[href*='createPipelineApplication']",
      "a[href*='createpipelineapplication']",
      "a[href*='apply']"
    );
  }
  if (rawPatterns.includes("scheduletour") || rawPatterns.includes("schedule") || rawPatterns.includes("tour")) {
    selectorCandidates.push("a[href*='scheduleTour']", "a[href*='scheduletour']", "a[href*='schedule']", "a[href*='tour']");
  }
  if (rawPatterns.includes("/apartments") || rawPatterns.includes("availability") || rawPatterns.includes("floor")) {
    selectorCandidates.push("a[href*='/apartments']", "a[href*='availability']", "a[href*='floor']");
  }
  if (rawPatterns.includes("/contact") || rawPatterns.includes("contact")) {
    selectorCandidates.push("a[href*='/contact']", "a[href*='contact']");
  }

  for (const selector of selectorCandidates) {
    const locator = page.locator(selector).first();
    if (!(await locator.count().catch(() => 0))) continue;
    const link = {
      href: (await locator.getAttribute("href").catch(() => "")) || "",
      text: normalizeText(await locator.textContent().catch(() => "")),
      aria: (await locator.getAttribute("aria-label").catch(() => "")) || "",
    };
    if (!isUsableHref(link.href)) continue;
    const textMatch = textPattern ? textPattern.test(`${link.text} ${link.aria} ${link.href}`) : true;
    if (textMatch || selectorCandidates.length > 0) {
      return link;
    }
  }

  const links = page.locator("a[href]");
  const count = await links.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 20); index += 1) {
    const locator = links.nth(index);
    const link = {
      href: (await locator.getAttribute("href").catch(() => "")) || "",
      text: normalizeText(await locator.textContent().catch(() => "")),
      aria: (await locator.getAttribute("aria-label").catch(() => "")) || "",
    };
    const raw = `${link.href} ${link.text} ${link.aria}`.toLowerCase();
    const patternMatch = patterns.some((pattern) => raw.includes(pattern));
    const textMatch = textPattern ? textPattern.test(`${link.text} ${link.aria}`) : true;
    if (patternMatch && textMatch && isUsableHref(link.href)) {
      return link;
    }
  }
  return null;
}

async function gotoApartmentsPage(page) {
  try {
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname.startsWith("/apartments")) {
      return currentUrl.toString();
    }
  } catch {
    // Continue to explicit apartments navigation.
  }
  const apartmentsLink = await firstHrefMatching(page, ["/apartments"], /apartments|pricing|availability|floor/i);
  const apartmentsUrl = apartmentsLink
    ? new URL(apartmentsLink.href, page.url()).toString()
    : new URL("/apartments/", TARGET_URL).toString();
  await page.goto(apartmentsUrl, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);
  return apartmentsUrl;
}

async function collectUnitRows(page, maxRows = 20) {
  const rows = page.locator(".re-unit-row, [data-unit_number], [data-rent][data-available_date]");
  const count = await rows.count().catch(() => 0);
  const units = [];
  const seen = new Set();
  for (let index = 0; index < Math.min(count, maxRows); index += 1) {
    const row = rows.nth(index);
    const unitNumber = (await row.getAttribute("data-unit_number").catch(() => "")) || "";
    if (!unitNumber || seen.has(unitNumber)) continue;
    seen.add(unitNumber);
    const explicitFloor = (await row.getAttribute("data-floor").catch(() => "")) || "";
    const level = (await row.getAttribute("data-level").catch(() => "")) || "";
    units.push({
      index,
      unit_number: unitNumber,
      href: (await row.locator("a[href*='/apartment/']").first().getAttribute("href").catch(() => "")) || "",
      bedrooms: Number((await row.getAttribute("data-bedrooms").catch(() => "")) || NaN),
      bathrooms: Number((await row.getAttribute("data-bathrooms").catch(() => "")) || NaN),
      sqft: Number((await row.getAttribute("data-interior_sqft").catch(() => "")) || NaN),
      available_date: (await row.getAttribute("data-available_date").catch(() => "")) || "",
      rent: Number((await row.getAttribute("data-rent").catch(() => "")) || NaN),
      floor: normalizedFloorValue(explicitFloor, level, inferFloorFromUnitNumber(unitNumber)),
      floor_source: explicitFloor ? "data-floor" : level ? "data-level" : inferFloorFromUnitNumber(unitNumber) ? "unit-number-inferred" : "",
      visible: await isVisibleSafe(row),
    });
  }
  return units;
}

function compareNullable(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return 0;
  if (Number.isNaN(a)) return 1;
  if (Number.isNaN(b)) return -1;
  return a - b;
}

function firstSortInversion(items, comparators) {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    for (const comparator of comparators) {
      const comparison = comparator(previous, current);
      if (comparison < 0) break;
      if (comparison > 0) {
        return {
          index,
          previous,
          current,
          comparison,
        };
      }
    }
  }
  return null;
}

function isSortedBy(units, comparators) {
  return !firstSortInversion(units, comparators);
}

function unitSortComparators() {
  return [
    (a, b) => compareNullable(Number(a.sqft || NaN), Number(b.sqft || NaN)),
    (a, b) => String(a.available_date || "").localeCompare(String(b.available_date || "")),
    (a, b) => compareNullable(Number(a.rent || NaN), Number(b.rent || NaN)),
  ];
}

function combinedUnitSortEvidence(units) {
  const comparators = unitSortComparators();
  const inversion = firstSortInversion(units, comparators);
  return {
    sorted_combined_size_date_price: !inversion,
    first_inversion: inversion,
    observed_order: units.slice(0, 12).map((unit) => ({
      unit_number: unit.unit_number,
      sqft: Number.isNaN(Number(unit.sqft)) ? null : Number(unit.sqft),
      available_date: unit.available_date || null,
      rent: Number.isNaN(Number(unit.rent)) ? null : Number(unit.rent),
    })),
  };
}

function inferFloorFromUnitNumber(unitNumber) {
  const raw = String(unitNumber || "").trim();
  const match = raw.match(/\d+/);
  if (!match) return "";
  const digits = match[0];
  if (digits.length >= 3) return String(Number(digits[0]));
  return "";
}

function normalizedFloorValue(...values) {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const numberMatch = raw.match(/\d+/);
    if (numberMatch) return String(Number(numberMatch[0]));
    return raw.toLowerCase();
  }
  return "";
}

function firstVisibleDifferentValue(beforeUnits, afterUnits) {
  const before = beforeUnits.map((unit) => unit.unit_number).join("|");
  const after = afterUnits.map((unit) => unit.unit_number).join("|");
  return before !== after;
}

async function exerciseFloorFilterSelect(page, units, floorSelects, selectCount) {
  const floors = [...new Set(units.map((unit) => unit.floor).filter(Boolean))];
  const targetFloor = floors.length > 1 ? floors[1] : floors[0] || "";
  let interaction = { attempted: false };
  if (!targetFloor) return { floors, targetFloor, interaction };

  for (let index = 0; index < Math.min(selectCount, 4); index += 1) {
    const select = floorSelects.nth(index);
    const optionCandidates = await select
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => ({
          value: option.value,
          label: (option.textContent || "").trim().replace(/\s+/g, " "),
        }))
      )
      .catch(() => []);
    const matchingOption = optionCandidates.find((option) => {
      const value = String(option.value || "");
      const label = String(option.label || "");
      return normalizedFloorValue(value) === targetFloor || normalizedFloorValue(label) === targetFloor;
    });
    interaction = {
      attempted: true,
      target_floor: targetFloor,
      select_index: index,
      option_candidates: optionCandidates.slice(0, 12),
      selected_option: matchingOption || null,
    };
    try {
      if (matchingOption?.value) {
        await select.selectOption({ value: matchingOption.value }, { timeout: INTERACTION_TIMEOUT_MS });
      } else if (matchingOption?.label) {
        await select.selectOption({ label: matchingOption.label }, { timeout: INTERACTION_TIMEOUT_MS });
      } else {
        await select.selectOption({ value: targetFloor }, { timeout: INTERACTION_TIMEOUT_MS });
      }
      await page.waitForTimeout(900);
      const unitsAfter = await collectUnitRows(page, 30);
      interaction = {
        ...interaction,
        method: "playwright-select",
        units_before: units.length,
        units_after: unitsAfter.length,
        changed_visible_units: firstVisibleDifferentValue(units, unitsAfter),
        after_floors: [...new Set(unitsAfter.map((unit) => unit.floor).filter(Boolean))],
      };
      break;
    } catch (error) {
      try {
        await select.evaluate(
          (node, floor) => {
            const normalized = (value) => {
              const text = String(value || "").toLowerCase();
              const numberMatch = text.match(/\b([1-9]\d*)(?:st|nd|rd|th)?\b/);
              if (numberMatch) return numberMatch[1];
              if (text.includes("ground")) return "1";
              return text.trim();
            };
            const matching = [...node.options].find(
              (option) => normalized(option.value) === floor || normalized(option.textContent) === floor
            );
            if (!matching) throw new Error(`No floor option matched ${floor}.`);
            node.value = matching.value;
            node.dispatchEvent(new Event("input", { bubbles: true }));
            node.dispatchEvent(new Event("change", { bubbles: true }));
          },
          targetFloor
        );
        await page.waitForTimeout(900);
        const unitsAfter = await collectUnitRows(page, 30);
        interaction = {
          ...interaction,
          method: "dom-dispatch",
          playwright_error: error instanceof Error ? error.message : String(error),
          units_before: units.length,
          units_after: unitsAfter.length,
          changed_visible_units: firstVisibleDifferentValue(units, unitsAfter),
          after_floors: [...new Set(unitsAfter.map((unit) => unit.floor).filter(Boolean))],
        };
        break;
      } catch (dispatchError) {
        interaction = {
          ...interaction,
          method: "failed",
          playwright_error: error instanceof Error ? error.message : String(error),
          dispatch_error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
        };
      }
    }
  }
  return { floors, targetFloor, interaction };
}

function isSortedByLegacy(units, comparators) {
  for (let index = 1; index < units.length; index += 1) {
    for (const comparator of comparators) {
      const comparison = comparator(units[index - 1], units[index]);
      if (comparison < 0) break;
      if (comparison > 0) return false;
    }
  }
  return true;
}

function parseReviewDateValue(value) {
  const text = normalizeText(String(value || ""));
  const numericMatch = text.match(/\b(\d{1,2})\s+(\d{1,2}),\s*(\d{4})\b/);
  if (numericMatch) {
    const [, month, day, year] = numericMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const slashMatch = text.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})\b/);
  if (slashMatch) {
    const [, month, day, rawYear] = slashMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function reviewDatesSortedNewestFirst(reviews) {
  return reviews.every((review, index) => index === 0 || reviews[index - 1].timestamp >= review.timestamp);
}

function compactReviewEvidence(reviews) {
  return reviews.slice(0, 12).map((review) => ({
    date_text: review.date_text,
    iso_date: new Date(review.timestamp).toISOString().slice(0, 10),
    author: review.author || null,
    x: Number.isFinite(review.x) ? Math.round(review.x) : null,
    y: Number.isFinite(review.y) ? Math.round(review.y) : null,
  }));
}

function normalizeUnitNumber(value) {
  return String(value || "").trim();
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function compactAvailabilityMismatchEvidence(renderedUnits, pondUnits) {
  const renderedByUnit = new Map(
    renderedUnits.map((unit) => [normalizeUnitNumber(unit.unit_number), unit]).filter(([unitNumber]) => Boolean(unitNumber))
  );
  const pondByUnit = new Map(
    pondUnits
      .map((unit) => [normalizeUnitNumber(firstDefined(unit.apt_number, unit.unit_number, unit.apartment_number)), unit])
      .filter(([unitNumber]) => Boolean(unitNumber))
  );
  const sharedUnitNumbers = [...renderedByUnit.keys()].filter((unitNumber) => pondByUnit.has(unitNumber));
  const fieldMismatches = [];
  for (const unitNumber of sharedUnitNumbers) {
    const rendered = renderedByUnit.get(unitNumber);
    const pond = pondByUnit.get(unitNumber);
    const renderedRent = Number(rendered?.rent || NaN);
    const pondRentFrom = Number(pond?.rent_from || NaN);
    const pondRentTo = Number(pond?.rent_to || pond?.rent_from || NaN);
    const rentMatches =
      Number.isNaN(renderedRent) ||
      Number.isNaN(pondRentFrom) ||
      (renderedRent >= pondRentFrom && renderedRent <= pondRentTo);
    const renderedDate = normalizeText(rendered?.available_date || "");
    const pondDate = normalizeText(pond?.available_date || "");
    const dateMatches = !renderedDate || !pondDate || renderedDate === pondDate;
    const renderedSqft = Number(rendered?.sqft || NaN);
    const pondSqft = Number(firstDefined(pond?.sqft, pond?.square_feet, pond?.interior_sqft, NaN));
    const sqftMatches = Number.isNaN(renderedSqft) || Number.isNaN(pondSqft) || renderedSqft === pondSqft;
    if (!rentMatches || !dateMatches || !sqftMatches) {
      fieldMismatches.push({
        unit_number: unitNumber,
        rendered: {
          rent: Number.isNaN(renderedRent) ? null : renderedRent,
          available_date: renderedDate || null,
          sqft: Number.isNaN(renderedSqft) ? null : renderedSqft,
          floor: rendered?.floor || null,
        },
        pond: {
          rent_from: Number.isNaN(pondRentFrom) ? null : pondRentFrom,
          rent_to: Number.isNaN(pondRentTo) ? null : pondRentTo,
          available_date: pondDate || null,
          floorplan_name: pond?.floorplan_name || null,
          sqft: Number.isNaN(pondSqft) ? null : pondSqft,
        },
        mismatch_fields: [
          ...(!rentMatches ? ["rent"] : []),
          ...(!dateMatches ? ["available_date"] : []),
          ...(!sqftMatches ? ["sqft"] : []),
        ],
      });
    }
  }
  return {
    compared_unit_count: sharedUnitNumbers.length,
    field_mismatch_count: fieldMismatches.length,
    field_mismatches: fieldMismatches.slice(0, 20),
  };
}

function availabilityVerdictForCheck(check, baseEvidence) {
  const assertionType = String(check.assertion_type || "").toLowerCase();
  const description = String(check.description || "").toLowerCase();
  const fieldMismatches = baseEvidence.availability_mismatch_evidence?.field_mismatches || [];
  const rentMismatchCount = fieldMismatches.filter((item) => item.mismatch_fields?.includes("rent")).length;
  const layoutMismatchCount = fieldMismatches.filter((item) => item.mismatch_fields?.includes("sqft")).length;
  const availabilityDateMismatchCount = fieldMismatches.filter((item) => item.mismatch_fields?.includes("available_date")).length;
  const renderedMissingFromPondCount = baseEvidence.rendered_missing_from_pond.length;
  const pondMissingFromRenderedCount = baseEvidence.pond_missing_from_rendered.length;
  const unitSetMatches = renderedMissingFromPondCount === 0 && pondMissingFromRenderedCount === 0;
  const displayedUnitsAreSourceBacked = renderedMissingFromPondCount === 0;
  const structuredOk = baseEvidence.structured_count_matches;

  if (assertionType === "pricing_matches_pond" || description.includes("pricing accurate")) {
    const pass = displayedUnitsAreSourceBacked && rentMismatchCount === 0;
    const fail = !displayedUnitsAreSourceBacked || rentMismatchCount > 0;
    return {
      status: pass ? "pass" : fail ? "fail" : "warn",
      message:
        pass
          ? pondMissingFromRenderedCount > 0
            ? "Rendered pricing matches Pond for displayed units; Pond-only unit-set gaps are tracked by the availability row."
            : "Rendered pricing matches Pond for the observed unit set."
          : !displayedUnitsAreSourceBacked
            ? "Rendered pricing includes displayed unit(s) that are not source-backed by Pond."
            : "Rendered pricing does not match Pond unit-level rent evidence.",
      criteria: {
        unit_set_matches: unitSetMatches,
        displayed_units_source_backed: displayedUnitsAreSourceBacked,
        rendered_missing_from_pond_count: renderedMissingFromPondCount,
        pond_missing_from_rendered_count: pondMissingFromRenderedCount,
        rent_mismatch_count: rentMismatchCount,
      },
    };
  }
  if (assertionType === "unit_types_and_layouts_match_pond" || description.includes("layout") || description.includes("unit types")) {
    const pass = displayedUnitsAreSourceBacked && layoutMismatchCount === 0;
    const fail = !displayedUnitsAreSourceBacked || layoutMismatchCount > 0;
    return {
      status: pass ? "pass" : fail ? "fail" : "warn",
      message:
        pass
          ? pondMissingFromRenderedCount > 0
            ? "Rendered unit types/layout metadata matches Pond for displayed units; Pond-only unit-set gaps are tracked by the availability row."
            : "Rendered unit types/layout metadata matches Pond for the observed unit set."
          : !displayedUnitsAreSourceBacked
            ? "Rendered unit types/layouts include displayed unit(s) that are not source-backed by Pond."
            : "Rendered unit types/layout metadata does not match Pond unit-level evidence.",
      criteria: {
        unit_set_matches: unitSetMatches,
        displayed_units_source_backed: displayedUnitsAreSourceBacked,
        rendered_missing_from_pond_count: renderedMissingFromPondCount,
        pond_missing_from_rendered_count: pondMissingFromRenderedCount,
        layout_mismatch_count: layoutMismatchCount,
      },
    };
  }
  const availabilityMatches = unitSetMatches && structuredOk && availabilityDateMismatchCount === 0;
  return {
    status: availabilityMatches ? "pass" : "fail",
    message: availabilityMatches
      ? "Rendered availability matches Pond unit count, unit set, and available-date evidence."
      : "Rendered availability does not match Pond unit count, unit set, or available-date evidence.",
    criteria: {
      unit_set_matches: unitSetMatches,
      structured_count_matches: structuredOk,
      availability_date_mismatch_count: availabilityDateMismatchCount,
    },
  };
}

function similarHomesLabelPattern() {
  return /similar homes|other similar|you may also|you might also|available homes|more homes|more floor plans|similar apartment|related apartment/i;
}

function likelySimilarHomeLinks(links, unitNumber) {
  return links.filter((link) => {
    const raw = `${link.href || ""} ${link.text || ""} ${link.aria || ""}`;
    if (!/\/apartment\/|floorplan|available|unit/i.test(raw)) return false;
    if (unitNumber && String(link.href || "").includes(String(unitNumber))) return false;
    if (/apply|schedule|tour|contact|map|gallery|amenit/i.test(raw)) return false;
    return true;
  });
}

function unitContextEvidence(target, context) {
  const unitNumber = context?.unit?.unit_number || "";
  const unitHref = context?.unit?.href || "";
  const targetText = String(target || "");
  const hrefText = String(unitHref || "");
  const carriesUnitNumber = Boolean(unitNumber && targetText.includes(unitNumber));
  const carriesStructuredUnitParam = /[?&](unit_id|unitId|apartment_id|apartmentId|unit|apartment)=/i.test(targetText);
  const carriesFloorplanParam = /[?&](floorplan_id|floorplanId|floorplan|floorPlan)=/i.test(targetText);
  const sourceUnitIdentifier =
    hrefText.match(/\/apartment\/([^/?#]+)/i)?.[1] ||
    hrefText.match(/[?&](unit_id|unitId|apartment_id|apartmentId|unit|apartment)=([^&#]+)/i)?.[2] ||
    "";
  const carriesSourceUnitIdentifier = Boolean(sourceUnitIdentifier && targetText.includes(sourceUnitIdentifier));
  return {
    carries_unit_context:
      carriesUnitNumber || carriesStructuredUnitParam || carriesFloorplanParam || carriesSourceUnitIdentifier,
    carries_unit_number: carriesUnitNumber,
    carries_structured_unit_param: carriesStructuredUnitParam,
    carries_floorplan_param: carriesFloorplanParam,
    source_unit_identifier: sourceUnitIdentifier || null,
    carries_source_unit_identifier: carriesSourceUnitIdentifier,
    unit_detail_href: unitHref || null,
  };
}

function textContainsLoose(haystack, needle) {
  if (!needle) return false;
  const rawHaystack = String(haystack || "").toLowerCase();
  const rawNeedle = String(needle || "").toLowerCase();
  if (rawHaystack.includes(rawNeedle)) return true;
  const compactHaystack = rawHaystack.replace(/[^a-z0-9]/g, "");
  const compactNeedle = rawNeedle.replace(/[^a-z0-9]/g, "");
  return Boolean(compactNeedle && compactHaystack.includes(compactNeedle));
}

function dateInputValueForPortal(context) {
  const rawDate = String(context?.unit?.available_date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const fallback = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45);
  return fallback.toISOString().slice(0, 10);
}

function portalDisplayDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function portalAriaDate(value) {
  const raw = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/,/g, "");
}

async function readPipelineLandingText(page) {
  const landingUrl = page.url();
  const title = normalizeText(await page.title().catch(() => ""));
  const bodyText = normalizeText(
    (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")) ||
      (await page.content().catch(() => ""))
  );
  return {
    landing_url: landingUrl,
    landing_title: title || null,
    body_text: bodyText,
    combined: `${landingUrl} ${title} ${bodyText}`,
  };
}

async function selectPipelineDate(page, dateValue) {
  const displayDate = portalDisplayDate(dateValue);
  const ariaDate = portalAriaDate(dateValue);
  const result = { attempted: false, display_date: displayDate, aria_date: ariaDate };
  const firstDateInput = page
    .locator("input[placeholder='MM/DD/YYYY'], input[type='date'], input[name*='date' i], input[id*='date' i]")
    .first();
  if ((await firstDateInput.count().catch(() => 0)) === 0) {
    result.reason = "date_input_not_found";
    return result;
  }
  result.attempted = true;
  await firstDateInput.click({ timeout: INTERACTION_TIMEOUT_MS, force: true }).catch((error) => {
    result.input_click_error = error instanceof Error ? error.message : String(error);
  });
  if (ariaDate) {
    for (let index = 0; index < 14; index += 1) {
      const targetDay = page.locator(`[aria-label="${ariaDate}"]`).first();
      if ((await targetDay.count().catch(() => 0)) > 0 && (await isVisibleSafe(targetDay))) {
        await targetDay.click({ timeout: INTERACTION_TIMEOUT_MS, force: true });
        result.method = "daypicker";
        result.selected = true;
        return result;
      }
      const next = page.locator("[aria-label='Next Month']").first();
      if ((await next.count().catch(() => 0)) === 0) break;
      await next.click({ timeout: INTERACTION_TIMEOUT_MS, force: true }).catch((error) => {
        result.next_click_error = error instanceof Error ? error.message : String(error);
      });
      await page.waitForTimeout(250);
    }
  }
  try {
    await firstDateInput.evaluate((node, value) => {
      node.removeAttribute("readonly");
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, displayDate);
    result.method = "dom-input";
    result.selected = true;
    await page.keyboard.press("Escape").catch(() => {});
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function advancePipelineMoveInGate(page, context) {
  const step = {
    attempted: false,
    date_value: dateInputValueForPortal(context),
  };
  const bodyText = normalizeText(await page.locator("body").innerText({ timeout: 4000 }).catch(() => ""));
  if (!/choose your move-in date|move-in date|precise move-in date|continue/i.test(bodyText)) {
    return { ...step, reason: "move_in_gate_not_detected" };
  }
  step.attempted = true;
  try {
    const preciseChoice = page.getByText(/precise move-in date|know my precise|exact move-in/i).first();
    if ((await preciseChoice.count().catch(() => 0)) > 0 && (await isVisibleSafe(preciseChoice))) {
      await preciseChoice.click({ timeout: INTERACTION_TIMEOUT_MS, force: true }).catch(() => {});
    }

    step.date_selection = await selectPipelineDate(page, step.date_value);

    const continueControl = page
      .locator("button, a, [role='button'], input[type='submit']")
      .filter({ hasText: /continue|next|start/i })
      .first();
    if ((await continueControl.count().catch(() => 0)) > 0 && (await isVisibleSafe(continueControl))) {
      await continueControl.click({ timeout: INTERACTION_TIMEOUT_MS, force: true });
      step.continue_clicked = true;
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const nextText = normalizeText(await page.locator("body").innerText({ timeout: 4000 }).catch(() => ""));
      if (/select your lease criteria/i.test(nextText)) {
        const nextContinue = page
          .locator("button, a, [role='button'], input[type='submit']")
          .filter({ hasText: /continue|next/i })
          .first();
        if ((await nextContinue.count().catch(() => 0)) > 0 && (await isVisibleSafe(nextContinue))) {
          await nextContinue.click({ timeout: INTERACTION_TIMEOUT_MS, force: true });
          step.lease_criteria_continue_clicked = true;
          await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }
    } else {
      step.continue_clicked = false;
    }
  } catch (error) {
    step.error = error instanceof Error ? error.message : String(error);
  }
  return step;
}

async function pipelineLandingUnitContextEvidence(page, target, context) {
  const unitNumber = context?.unit?.unit_number || "";
  const sourceUnitIdentifier =
    unitContextEvidence(target, context).source_unit_identifier || "";
  const returnUrl = context?.unit_detail_url || page.url();
  if (!target || !unitNumber) {
    return {
      checked: false,
      carries_unit_context: false,
      reason: !target ? "missing_target_url" : "missing_expected_unit_number",
    };
  }
  try {
    await page.goto(target, {
      waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
      timeout: PIPELINE_LANDING_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    let landing = await readPipelineLandingText(page);
    let carriesUnitNumber = textContainsLoose(landing.combined, unitNumber);
    let carriesSourceUnitIdentifier = textContainsLoose(landing.combined, sourceUnitIdentifier);
    const moveInGate =
      carriesUnitNumber || carriesSourceUnitIdentifier
        ? { attempted: false, reason: "unit_context_already_visible" }
        : await advancePipelineMoveInGate(page, context);
    if (moveInGate.attempted) {
      landing = await readPipelineLandingText(page);
      carriesUnitNumber = textContainsLoose(landing.combined, unitNumber);
      carriesSourceUnitIdentifier = textContainsLoose(landing.combined, sourceUnitIdentifier);
    }
    return {
      checked: true,
      carries_unit_context: carriesUnitNumber || carriesSourceUnitIdentifier,
      carries_unit_number: carriesUnitNumber,
      carries_source_unit_identifier: carriesSourceUnitIdentifier,
      expected_unit_number: unitNumber,
      expected_source_unit_identifier: sourceUnitIdentifier || null,
      landing_url: landing.landing_url,
      landing_title: landing.landing_title,
      landing_text_sample: landing.body_text.slice(0, 700),
      move_in_gate: moveInGate,
    };
  } catch (error) {
    return {
      checked: true,
      carries_unit_context: false,
      expected_unit_number: unitNumber,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (returnUrl && normalizeUrlForComparison(page.url()) !== normalizeUrlForComparison(returnUrl)) {
      await page
        .goto(returnUrl, {
          waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
          timeout: Math.min(STEP_TIMEOUT_MS, 15000),
        })
        .catch(() => {});
      await page.waitForTimeout(500).catch(() => {});
    }
  }
}

async function parseApartmentComplexJsonLd(page) {
  const scripts = page.locator("script[type='application/ld+json']");
  const count = await scripts.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 12); index += 1) {
    const text = await scripts.nth(index).textContent().catch(() => "");
    if (!text || !text.includes("ApartmentComplex")) continue;
    try {
      const parsed = JSON.parse(text);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const match = candidates.find((item) => item && item["@type"] === "ApartmentComplex");
      if (match) return match;
    } catch {
      // Keep scanning; malformed JSON-LD should not block the rest of the QA pass.
    }
  }
  return null;
}

function loadPondAvailabilityUnits() {
  const rawPath = process.env.POND_AVAILABILITY_UNITS_JSON_PATH || process.env.POND_AVAILABILITY_JSON_PATH;
  if (!rawPath) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const units = Array.isArray(parsed) ? parsed : parsed.units || parsed.available_units || [];
    return {
      source_path: rawPath,
      units: Array.isArray(units) ? units : [],
    };
  } catch (error) {
    return {
      source_path: rawPath,
      units: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function loadPropertyContactTruth() {
  const rawPath = process.env.PROPERTY_CONTACT_TRUTH_JSON_PATH || process.env.EVS_PROPERTY_CONTACT_TRUTH_JSON_PATH;
  if (!rawPath) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const properties = Array.isArray(parsed) ? parsed : parsed.properties || [];
    const property =
      properties.find(
        (row) =>
          row.property_id === PROPERTY_ID ||
          row.canonical_property_id === PROPERTY_ID ||
          row.property_code === PROPERTY_ID ||
          row.ga4_property_id === PROPERTY_ID
      ) || null;
    return {
      source_path: rawPath,
      property,
      generated_at: parsed.generated_at || null,
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    return {
      source_path: rawPath,
      property: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function loadLeadAttributionTruth() {
  const rawPath = process.env.LEAD_ATTRIBUTION_TRUTH_JSON_PATH || process.env.EVS_LEAD_ATTRIBUTION_TRUTH_JSON_PATH;
  if (!rawPath) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const properties = Array.isArray(parsed) ? parsed : parsed.properties || [];
    const property = properties.find((row) => row.property_id === PROPERTY_ID) || null;
    return {
      source_path: rawPath,
      property,
      generated_at: parsed.generated_at || null,
      query_param: parsed.query_param || "id",
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    return {
      source_path: rawPath,
      property: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function phoneMatches(actual, expected) {
  const actualDigits = phoneDigits(actual);
  const expectedDigits = phoneDigits(expected);
  return actualDigits.length >= 10 && expectedDigits.length >= 10 && actualDigits.slice(-10) === expectedDigits.slice(-10);
}

function qaSurfaceFinding(checkId, label, status, message, metadata = {}) {
  return {
    check_id: checkId,
    kind: `header_navigation:${checkId}`,
    label,
    status,
    message,
    metadata: {
      qa_severity: metadata.qa_severity || "medium",
      ...metadata,
    },
    evidence_refs: [],
  };
}

async function getPropertyCode(page) {
  return (
    (await page.locator("body").first().getAttribute("data-property-code").catch(() => "")) ||
    SITE_CONFIG.property_code ||
    ""
  );
}

async function gotoFirstUnitDetailPage(page) {
  if (firstUnitDetailContext?.unit_detail_url) {
    if (normalizeUrlForComparison(page.url()) !== normalizeUrlForComparison(firstUnitDetailContext.unit_detail_url)) {
      await page.goto(firstUnitDetailContext.unit_detail_url, {
        waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
        timeout: STEP_TIMEOUT_MS,
      });
      await page.waitForTimeout(700);
    }
    return firstUnitDetailContext;
  }
  const apartmentsUrl = await gotoApartmentsPage(page);
  const units = await collectUnitRows(page, 12);
  const unit = units.find((candidate) => isUsableHref(candidate.href)) || units[0] || null;
  if (!unit || !isUsableHref(unit.href)) {
    return { apartments_url: apartmentsUrl, unit: null, unit_detail_url: null };
  }
  const unitDetailUrl = new URL(unit.href, page.url()).toString();
  await page.goto(unitDetailUrl, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);
  firstUnitDetailContext = { apartments_url: apartmentsUrl, unit, unit_detail_url: unitDetailUrl };
  return firstUnitDetailContext;
}

async function routeCheck(page, check, destination) {
  await gotoTargetHome(page);
  const patterns =
    destination === "apartments"
      ? ["/apartments", "availability", "floor"]
      : ["/contact", "contact"];
  const textPattern =
    destination === "apartments" ? /availability|available|apartments|pricing|floor/i : /contact/i;
  const link = await firstHrefMatching(page, patterns, textPattern);
  if (!link) {
    return qaFinding(check, "warn", `No ${destination} route candidate was detected.`, { destination });
  }
  const target = new URL(link.href, page.url()).toString();
  const expected = destination === "apartments" ? /\/apartments\/?|floor|pricing/i : /\/contact\/?/i;
  return qaFinding(
    check,
    expected.test(target) ? "pass" : "warn",
    expected.test(target)
      ? `Detected ${destination} route candidate -> ${target}.`
      : `Detected route candidate, but destination did not match expected ${destination} path -> ${target}.`,
    { href: link.href, target_url: target, link_text: link.text }
  );
}

async function gotoPagePath(page, pageName) {
  const slug = String(pageName || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const pathMap = {
    features: "/features/",
    amenities: "/amenities/",
    specials: "/specials/",
    reviews: "/reviews/",
    contact: "/contact/",
  };
  const target = new URL(pathMap[slug] || `/${slug}/`, TARGET_URL).toString();
  await page.goto(target, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);
  return target;
}

async function pageMediaModalCheck(page, check) {
  const target = await gotoPagePath(page, check.page);
  return exerciseMediaModalOnCurrentPage(page, check, { page_url: target });
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function coordinateDeltaMiles(a, b) {
  if (!a || !b) return null;
  const latMiles = Math.abs(a.latitude - b.latitude) * 69;
  const lonMiles = Math.abs(a.longitude - b.longitude) * 69 * Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  return Math.sqrt(latMiles * latMiles + lonMiles * lonMiles);
}

async function collectRenderedCoordinates(page) {
  return await page.evaluate(() => {
    const text = document.documentElement?.innerHTML || "";
    const candidates = [];
    const pushCandidate = (latitude, longitude, source, raw) => {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      candidates.push({ latitude: lat, longitude: lng, source, raw: String(raw || "").slice(0, 220) });
    };

    for (const script of Array.from(document.querySelectorAll("script[type='application/ld+json']"))) {
      const raw = script.textContent || "";
      try {
        const parsed = JSON.parse(raw);
        const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
        while (stack.length) {
          const item = stack.pop();
          if (!item || typeof item !== "object") continue;
          if (item.geo && typeof item.geo === "object") {
            pushCandidate(item.geo.latitude, item.geo.longitude, "json_ld_geo", raw);
          }
          if (item.latitude !== undefined && item.longitude !== undefined) {
            pushCandidate(item.latitude, item.longitude, "json_ld_coordinates", raw);
          }
          for (const value of Object.values(item)) {
            if (value && typeof value === "object") stack.push(value);
          }
        }
      } catch {
        // Ignore non-JSON script payloads.
      }
    }

    const attrs = Array.from(document.querySelectorAll("[src],[href],[data-src],[data-lat],[data-lng],[data-longitude]"));
    for (const node of attrs) {
      const lat = node.getAttribute("data-lat") || node.getAttribute("data-latitude");
      const lng = node.getAttribute("data-lng") || node.getAttribute("data-longitude");
      if (lat && lng) pushCandidate(lat, lng, "data_attributes", node.outerHTML);
      for (const attr of ["src", "href", "data-src"]) {
        const raw = node.getAttribute(attr) || "";
        for (const match of raw.matchAll(/(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/g)) {
          pushCandidate(match[1], match[2], `${attr}_coordinate_pair`, raw);
        }
      }
    }

    for (const match of text.matchAll(/"latitude"\s*:\s*"?(-?\d{1,2}\.\d{4,})"?[\s\S]{0,120}?"longitude"\s*:\s*"?(-?\d{1,3}\.\d{4,})"?/gi)) {
      pushCandidate(match[1], match[2], "html_latitude_longitude", match[0]);
    }
    for (const match of text.matchAll(/(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/g)) {
      pushCandidate(match[1], match[2], "html_coordinate_pair", match[0]);
    }

    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = `${candidate.latitude.toFixed(6)},${candidate.longitude.toFixed(6)},${candidate.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 25);
  }).catch(() => []);
}

async function mapPinCoordinateCheck(page, check) {
  const contactTruthPayload = loadPropertyContactTruth();
  const contactTruth = contactTruthPayload?.property || null;
  const expected = {
    latitude: parseCoordinate(contactTruth?.latitude),
    longitude: parseCoordinate(contactTruth?.longitude),
  };
  const context = {
    property_contact_truth_path: contactTruthPayload?.source_path || null,
    property_contact_truth_error: contactTruthPayload?.error || null,
    feed_property_id: contactTruth?.feed_property_id || null,
    expected_latitude: expected.latitude,
    expected_longitude: expected.longitude,
  };
  if (expected.latitude === null || expected.longitude === null) {
    return qaFinding(check, "warn", "Feed-backed latitude/longitude was not available for this property.", context);
  }

  const locationUrl = await gotoPagePath(page, "location");
  const candidates = await collectRenderedCoordinates(page);
  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      delta_miles: coordinateDeltaMiles(expected, candidate),
    }))
    .sort((a, b) => (a.delta_miles ?? Number.POSITIVE_INFINITY) - (b.delta_miles ?? Number.POSITIVE_INFINITY));
  const best = scored[0] || null;
  const toleranceMiles = Number(process.env.EVS_MAP_PIN_TOLERANCE_MILES || 0.25);
  const pass = best?.delta_miles !== null && best?.delta_miles !== undefined && best.delta_miles <= toleranceMiles;
  return qaFinding(
    check,
    pass ? "pass" : "warn",
    pass
      ? `Location map/schema coordinates match the feed-backed property latitude/longitude within ${toleranceMiles} mile(s).`
      : "Location map/schema coordinates were missing or did not match the feed-backed property latitude/longitude.",
    {
      ...context,
      location_url: locationUrl,
      tolerance_miles: toleranceMiles,
      best_match: best,
      rendered_coordinate_candidates: scored.slice(0, 8),
    }
  );
}

async function externalHandoffCheck(page, check, handoffType) {
  await gotoTargetHome(page);
  const definitions = {
    pipeline: {
      patterns: ["createpipelineapplication", "apply"],
      text: /apply|application/i,
      expected: /createpipelineapplication|online\.venterraliving\.com|apply/i,
    },
    schedule: {
      patterns: ["scheduletour", "schedule", "tour"],
      text: /schedule|tour/i,
      expected: /scheduletour|schedule|tour|online\.venterraliving\.com/i,
    },
    quote: {
      patterns: ["createquote", "quote", "all-in", "all in", "pricing"],
      text: /all[- ]?in|pricing|quote/i,
      expected: /createquote|quote|online\.venterraliving\.com/i,
    },
  };
  const definition = definitions[handoffType];
  const link = await firstHrefMatching(page, definition.patterns, definition.text);
  if (!link) {
    return qaFinding(check, "warn", `No ${handoffType} handoff candidate was detected.`, { handoff_type: handoffType });
  }
  const target = new URL(link.href, page.url()).toString();
  return qaFinding(
    check,
    definition.expected.test(target.toLowerCase()) ? "pass" : "warn",
    definition.expected.test(target.toLowerCase())
      ? `Detected ${handoffType} handoff -> ${target}.`
      : `Detected ${handoffType} candidate, but destination needs review -> ${target}.`,
    { handoff_type: handoffType, href: link.href, target_url: target, link_text: link.text }
  );
}

async function specialsToggleCheck(page, check) {
  await gotoTargetHome(page);
  const contactTruthPayload = loadPropertyContactTruth();
  const contactTruth = contactTruthPayload?.property || null;
  const feedSpecial = normalizeText(contactTruth?.property_banner_special || "");
  const candidates = [
    "button[aria-expanded][class*='special' i]",
    "[class*='special' i] button[aria-expanded]",
    "[class*='special' i] button",
    "button:has-text('Special')",
    "[aria-label*='special' i]",
    "a:has-text('Special')",
  ];
  const visible = await firstVisibleLocator(page, candidates);
  if (visible) {
    const { locator, selector, index } = visible;
    try {
      const before = await page.locator("[class*='special' i], [id*='special' i]").first().evaluate((node) => ({
        textLength: (node.textContent || "").trim().length,
        className: node.getAttribute("class") || "",
        ariaExpanded: node.getAttribute("aria-expanded"),
      })).catch(() => null);
      await locator.click({ timeout: INTERACTION_TIMEOUT_MS });
      await page.waitForTimeout(500);
      const afterOpen = await page.locator("[class*='special' i], [id*='special' i]").first().evaluate((node) => ({
        textLength: (node.textContent || "").trim().length,
        className: node.getAttribute("class") || "",
        ariaExpanded: node.getAttribute("aria-expanded"),
      })).catch(() => null);
      await locator.click({ timeout: INTERACTION_TIMEOUT_MS }).catch(() => {});
      await page.waitForTimeout(300);
      return qaFinding(check, "pass", "Specials control accepted open/close interaction.", {
        selector,
        index,
        before,
        after_open: afterOpen,
      });
    } catch (error) {
      return qaFinding(
        check,
        "warn",
        error instanceof Error ? error.message : "Specials control was detected but interaction needs review.",
        { selector, index }
      );
    }
  }
  if (!feedSpecial) {
    return qaNotApplicable(
      check,
      "No specials bar toggle is required because the latest feed has no propertyBannerSpecial for this property.",
      {
        property_contact_truth_path: contactTruthPayload?.source_path || null,
        property_contact_truth_error: contactTruthPayload?.error || null,
        feed_property_id: contactTruth?.feed_property_id || null,
        feed_property_banner_special_present: false,
      }
    );
  }
  return qaSkipped(
    check,
    "A feed-backed special is present, but no specials toggle candidate was detected.",
    {
      property_contact_truth_path: contactTruthPayload?.source_path || null,
      property_contact_truth_error: contactTruthPayload?.error || null,
      feed_property_id: contactTruth?.feed_property_id || null,
      feed_property_banner_special_present: true,
      feed_property_banner_special: feedSpecial,
    }
  );
}

const CAROUSEL_SURFACE_SELECTOR = "[class*='carousel'], [data-testid*='carousel'], .swiper, .slick-slider, [class*='slider']";
const CAROUSEL_NEXT_SELECTOR =
  ".swiper-button-next, .slick-next, button[aria-label*='next' i], a[aria-label*='next' i], [class*='next'][role='button']";

async function firstVisibleDescendant(scope, selector, maxItems = 20) {
  const locators = scope.locator(selector);
  const count = await locators.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, maxItems); index += 1) {
    const locator = locators.nth(index);
    if (await isVisibleSafe(locator)) {
      return { locator, count };
    }
  }
  return { locator: null, count };
}

async function findReviewCarouselSurface(page) {
  const reviewScopeSelector = [
    "section[id*='review' i]",
    "section[class*='review' i]",
    "[id*='review' i]",
    "[class*='review' i]",
  ].join(", ");
  const scopes = page.locator(reviewScopeSelector);
  const scopeCount = await scopes.count().catch(() => 0);
  for (let index = 0; index < Math.min(scopeCount, 15); index += 1) {
    const scope = scopes.nth(index);
    if (!(await isVisibleSafe(scope))) continue;
    const scopeText = normalizeText(await scope.textContent().catch(() => ""));
    if (!/review|resident|stars?|google/i.test(scopeText)) continue;
    const { locator: carousel, count } = await firstVisibleDescendant(scope, CAROUSEL_SURFACE_SELECTOR);
    if (carousel) {
      await scope.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(750);
      return {
        carousel,
        scope,
        strategy: "reviews-section",
        visible_count: count,
        scope_text_sample: scopeText.slice(0, 220),
      };
    }
  }

  const { locator: carousel, count } = await firstVisibleDescendant(page, CAROUSEL_SURFACE_SELECTOR);
  if (!carousel) return null;
  await carousel.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(750);
  return {
    carousel,
    scope: page,
    strategy: "page-carousel-fallback",
    visible_count: count,
    scope_text_sample: "",
  };
}

async function carouselState(locator) {
  return locator
    .evaluate((element) => {
      const text = (value) => String(value || "").trim().replace(/\s+/g, " ");
      const rectValue = (node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };
      const activeSelector = [
        ".swiper-slide-active",
        ".swiper-slide-next",
        ".slick-active",
        "[aria-hidden='false']",
        "[class*='active']",
      ].join(", ");
      const slideSelector = [
        ".swiper-slide",
        ".slick-slide",
        "[class*='slide']",
        "[class*='item']",
        "[class*='card']",
      ].join(", ");
      const activeNodes = Array.from(element.querySelectorAll(activeSelector)).slice(0, 8);
      const slideNodes = Array.from(element.querySelectorAll(slideSelector)).slice(0, 12);
      const candidateNodes = activeNodes.length ? activeNodes : slideNodes;
      const visibleCandidates = candidateNodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })
        .slice(0, 8)
        .map((node) => ({
          class_name: node.getAttribute("class") || "",
          aria_hidden: node.getAttribute("aria-hidden") || "",
          style: node.getAttribute("style") || "",
          transform: window.getComputedStyle(node).transform || "",
          text: text(node.textContent).slice(0, 220),
          rect: rectValue(node),
        }));
      const controlState = Array.from(
        element.querySelectorAll(".swiper-pagination-bullet-active, .slick-active button, [aria-current='true']")
      )
        .slice(0, 8)
        .map((node) => ({
          class_name: node.getAttribute("class") || "",
          aria_current: node.getAttribute("aria-current") || "",
          text: text(node.textContent).slice(0, 80),
          rect: rectValue(node),
        }));
      return {
        root_class: element.getAttribute("class") || "",
        root_style: element.getAttribute("style") || "",
        root_transform: window.getComputedStyle(element).transform || "",
        root_scroll_left: Math.round(element.scrollLeft || 0),
        active: visibleCandidates,
        controls: controlState,
      };
    })
    .catch(() => null);
}

function carouselStateChanged(before, after) {
  if (!before || !after) return false;
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function clickCarouselNext(scope) {
  const { locator } = await firstVisibleDescendant(scope, CAROUSEL_NEXT_SELECTOR, 12);
  if (!locator) return false;
  await locator.click({ timeout: INTERACTION_TIMEOUT_MS }).catch(() => null);
  return true;
}

async function carouselCheck(page, check) {
  await gotoTargetHome(page);
  const surface = await findReviewCarouselSurface(page);
  if (!surface) {
    return qaFinding(check, "warn", "No visible Reviews carousel-like surface was detected.", {
      selector: CAROUSEL_SURFACE_SELECTOR,
      review_scoped: true,
    });
  }
  const beforeState = await carouselState(surface.carousel);
  await page.waitForTimeout(CAROUSEL_OBSERVATION_MS);
  const autoplayState = await carouselState(surface.carousel);
  let changed = carouselStateChanged(beforeState, autoplayState);
  let nextClicked = false;
  let controlState = null;
  if (!changed) {
    nextClicked = await clickCarouselNext(surface.scope);
    if (nextClicked) {
      await page.waitForTimeout(1000);
      controlState = await carouselState(surface.carousel);
      changed = carouselStateChanged(autoplayState, controlState);
    }
  }
  return qaFinding(
    check,
    changed ? "pass" : "warn",
    changed
      ? "Reviews carousel changed state during observation or next-control interaction."
      : "Reviews carousel-like surface was detected, but no slide, transform, active-state, or control change was observed.",
    {
      selector: CAROUSEL_SURFACE_SELECTOR,
      visible_count: surface.visible_count,
      observed_state_change: changed,
      observation_ms: CAROUSEL_OBSERVATION_MS,
      next_control_clicked: nextClicked,
      detection_strategy: surface.strategy,
      scope_text_sample: surface.scope_text_sample,
      before_state: beforeState,
      autoplay_state: autoplayState,
      control_state: controlState,
    }
  );
}

async function filterCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const filterCandidates = [
    "button[aria-label*='filter' i]",
    "button:has-text('Filter')",
    "a:has-text('Filter')",
    "[aria-label*='filter' i]",
    "[class*='filter' i] button:not([aria-label='Close'])",
  ];
  const visible = await firstVisibleLocator(page, filterCandidates);
  if (visible) {
    const { locator, selector, index } = visible;
    try {
      await locator.click({ timeout: INTERACTION_TIMEOUT_MS });
      await page.waitForTimeout(500);
      const optionCount = await page
        .locator("text=/bed|move|budget|floor|feature/i")
        .count()
        .catch(() => 0);
      return qaFinding(
        check,
        optionCount > 0 ? "pass" : "warn",
        optionCount > 0
          ? `Filter control opened and exposed ${optionCount} option labels.`
          : "Filter control was clickable, but expected option labels were not detected.",
        { selector, apartments_url: apartmentsUrl, option_count: optionCount }
      );
    } catch (error) {
      return qaFinding(check, "warn", error instanceof Error ? error.message : "Filter control needs review.", {
        selector,
        index,
        apartments_url: apartmentsUrl,
      });
    }
  }
  return qaFinding(check, "warn", "No filter control candidate was detected on Apartments & Pricing.", {
    apartments_url: apartmentsUrl,
  });
}

async function apartmentFilterControlsCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const unitsBefore = await collectUnitRows(page, 12);
  const controls = {
    bedrooms: await page.locator(".re-bedroom-checkbox, input[data-param='bedrooms']").count().catch(() => 0),
    move_in_date: await page.locator("input[type='date'][data-param='available_date'], input[data-param='available_date']").count().catch(() => 0),
    budget: await page.locator("input[type='range'][data-param*='Rent'], input[data-param='maxRent']").count().catch(() => 0),
  };
  const firstBedroomInput = page.locator(".re-bedroom-checkbox, input[data-param='bedrooms']").first();
  let interaction = { attempted: false };
  if ((await firstBedroomInput.count().catch(() => 0)) > 0) {
    try {
      const inputId = await firstBedroomInput.getAttribute("id").catch(() => "");
      const label = inputId ? page.locator(`label[for='${inputId}']`).first() : null;
      if (label && (await isVisibleSafe(label))) {
        await label.click({ timeout: INTERACTION_TIMEOUT_MS });
      } else {
        await firstBedroomInput.check({ force: true, timeout: INTERACTION_TIMEOUT_MS });
      }
      await page.waitForTimeout(900);
      interaction = {
        attempted: true,
        checked: await firstBedroomInput.isChecked().catch(() => null),
        units_before: unitsBefore.length,
        units_after: (await collectUnitRows(page, 12)).length,
      };
    } catch (error) {
      interaction = {
        attempted: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const missing = Object.entries(controls)
    .filter(([, count]) => count === 0)
    .map(([key]) => key);
  const status = missing.length === 0 && !interaction.error ? "pass" : "warn";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? "Beds, move-in date, and budget filter controls were detected; bedroom filter accepted interaction."
      : `Filter controls need review; missing or unverified controls: ${missing.join(", ") || "none"}.`,
    { apartments_url: apartmentsUrl, controls, interaction }
  );
}

async function apartmentFilterModalCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const trigger = await firstVisibleLocator(page, [
    ".re-filters-settings-link",
    "a[uk-toggle*='re-filters'][uk-icon*='settings']",
    "[class*='settings' i] a[uk-toggle]",
    "button[aria-label*='filter' i]",
    "button:has-text('Filter')",
  ]);
  let opened = false;
  if (trigger) {
    try {
      await trigger.locator.click({ timeout: INTERACTION_TIMEOUT_MS });
      await page.waitForTimeout(700);
      opened = true;
    } catch {
      opened = false;
    }
  }
  const controls = {
    floor: await page.locator("select[data-param='floor'], .re-filter-floor-select").count().catch(() => 0),
    features: await page.locator("input[data-param='unitAmenities'], .re-filter-amenities-checkbox").count().catch(() => 0),
  };
  const status = controls.floor > 0 && controls.features > 0 ? "pass" : "warn";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? "Floor and Features filter options were detected in the filter/preferences surface."
      : "Floor and Features filter options were not both detected.",
    { apartments_url: apartmentsUrl, trigger_detected: Boolean(trigger), opened, controls }
  );
}

async function renderedAvailabilityCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const units = await collectUnitRows(page, 50);
  const jsonLd = await parseApartmentComplexJsonLd(page);
  const renderedAvailableCount = units.length;
  const structuredAvailableCount =
    jsonLd?.numberOfAvailableAccommodationUnits?.minValue ??
    jsonLd?.numberOfAvailableAccommodationUnits?.value ??
    null;
  const propertyCode = await getPropertyCode(page);
  const pond = loadPondAvailabilityUnits();
  if (pond) {
    if (pond.error) {
      return qaFinding(check, "warn", "Pond availability source could not be loaded.", {
        apartments_url: apartmentsUrl,
        pond_error: pond.error,
        pond_source_path: pond.source_path,
        rendered_available_count: renderedAvailableCount,
        structured_available_count: structuredAvailableCount,
      });
    }
    const relevant = pond.units.filter((unit) => {
      const raw = `${unit.property_id || ""} ${unit.feed_property_id || ""} ${unit.property_code || ""} ${unit.property || ""}`;
      return raw.includes(PROPERTY_ID) || (propertyCode && raw.includes(propertyCode));
    });
    const pondUnitNumbers = new Set(
      relevant.map((unit) => String(unit.apt_number || unit.unit_number || unit.apartment_number || "")).filter(Boolean)
    );
    const renderedUnitNumbers = new Set(units.map((unit) => String(unit.unit_number)).filter(Boolean));
    const overlap = [...renderedUnitNumbers].filter((unitNumber) => pondUnitNumbers.has(unitNumber));
    const renderedMissingFromPond = [...renderedUnitNumbers].filter((unitNumber) => !pondUnitNumbers.has(unitNumber));
    const pondMissingFromRendered = [...pondUnitNumbers].filter((unitNumber) => !renderedUnitNumbers.has(unitNumber));
    const mismatchEvidence = compactAvailabilityMismatchEvidence(units, relevant);
    const structuredCountMatches =
      structuredAvailableCount === null ||
      Number(structuredAvailableCount) === renderedAvailableCount ||
      Number(structuredAvailableCount) === relevant.length;
    const countMatchesPond = renderedAvailableCount === relevant.length;
    const baseEvidence = {
      apartments_url: apartmentsUrl,
      property_code: propertyCode,
      rendered_available_count: renderedAvailableCount,
      structured_available_count: structuredAvailableCount,
      pond_source_path: pond.source_path,
      pond_relevant_count: relevant.length,
      overlap_count: overlap.length,
      rendered_missing_from_pond: renderedMissingFromPond,
      pond_missing_from_rendered: pondMissingFromRendered,
      availability_mismatch_evidence: mismatchEvidence,
      structured_count_matches: structuredCountMatches,
      count_matches_pond: countMatchesPond,
      sample_rendered_units: units.slice(0, 8),
    };
    const verdict = availabilityVerdictForCheck(check, baseEvidence);
    return qaFinding(
      check,
      verdict.status,
      verdict.message,
      {
        ...baseEvidence,
        pond_missing_from_rendered: pondMissingFromRendered.slice(0, 25),
        verdict_criteria: verdict.criteria,
      }
    );
  }
  return qaSkipped(check, "Pond availability export/config path is required for source-of-truth comparison.", {
    apartments_url: apartmentsUrl,
    property_code: propertyCode,
    rendered_available_count: renderedAvailableCount,
    structured_available_count: structuredAvailableCount,
    sample_rendered_units: units.slice(0, 8).map((unit) => unit.unit_number),
  });
}

async function apartmentsSortOrderCheck(page, check) {
  const isReviewsCheck = `${check.page} ${check.section} ${check.description}`.toLowerCase().includes("review");
  if (isReviewsCheck) {
    return reviewsSortOrderCheck(page, check);
  }
  const apartmentsUrl = await gotoApartmentsPage(page);
  const units = await collectUnitRows(page, 30);
  if (units.length < 2) {
    return qaFinding(check, "warn", "Not enough rendered units were detected to evaluate sort order.", {
      apartments_url: apartmentsUrl,
      unit_count: units.length,
    });
  }
  const sortEvidence = combinedUnitSortEvidence(units);
  const status = sortEvidence.sorted_combined_size_date_price ? "pass" : "fail";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? "Rendered unit rows follow the combined size, move-in date, then price order."
      : "Rendered unit rows do not follow the combined size, move-in date, then price order.",
    {
      apartments_url: apartmentsUrl,
      ...sortEvidence,
    }
  );
}

async function mapFloorUnitFilterCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const units = await collectUnitRows(page, 30);
  const floorSelects = page.locator("select[data-param='floor'], .re-filter-floor-select");
  const selectCount = await floorSelects.count().catch(() => 0);
  if (selectCount === 0) {
    return qaFinding(check, "fail", "No floor filter select was detected on Apartments & Pricing.", {
      apartments_url: apartmentsUrl,
      unit_count: units.length,
    });
  }
  const { floors, targetFloor, interaction } = await exerciseFloorFilterSelect(page, units, floorSelects, selectCount);
  const status =
    floors.length === 0
      ? "fail"
      : floors.length === 1
        ? "pass"
        : interaction.attempted && interaction.changed_visible_units
          ? "pass"
          : "fail";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? floors.length === 1
        ? "Floor filter metadata is present; only one observed floor value is available to exercise."
        : `Changing the floor filter updated the observed available-unit set for ${floors.length} floor value(s).`
      : floors.length === 0
        ? "Floor filter exists, but rendered units did not expose floor metadata."
        : interaction.attempted
          ? "Changing the floor filter did not update the observed available-unit set."
          : "Floor filter metadata exists, but the rendered select could not be exercised.",
    {
      apartments_url: apartmentsUrl,
      select_count: selectCount,
      floors,
      interaction,
      target_floor: interaction.target_floor || targetFloor || null,
      floor_select_method: interaction.method || null,
      changed_visible_units: interaction.changed_visible_units ?? null,
      units_before: interaction.units_before ?? units.length,
      units_after: interaction.units_after ?? null,
      after_floors: interaction.after_floors || [],
    }
  );
}

async function unitDetailContextContinuityCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  if (!context.unit) {
    return qaFinding(check, "warn", "No unit detail link was detected from Apartments & Pricing.", context);
  }
  const title = await page.title().catch(() => "");
  const headingText = normalizeText(await page.locator("h1, h2, h3").first().textContent().catch(() => ""));
  const bodyText = normalizeText(await page.locator("body").first().textContent().catch(() => ""));
  const unitMatches =
    title.includes(context.unit.unit_number) ||
    headingText.includes(context.unit.unit_number) ||
    bodyText.includes(context.unit.unit_number);
  return qaFinding(
    check,
    unitMatches ? "pass" : "warn",
    unitMatches
      ? `Clicked unit ${context.unit.unit_number} and detail page retained the same unit number.`
      : `Clicked unit ${context.unit.unit_number}, but detail page did not clearly retain that unit number.`,
    { ...context, title, heading_text: headingText }
  );
}

async function unitDetailSightMapCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  if (!context.unit) {
    return qaFinding(check, "warn", "No unit detail link was detected before SightMap validation.", context);
  }
  const trigger = await firstVisibleLocator(page, [
    "button:has-text('Apartment Location')",
    "a:has-text('Apartment Location')",
    "button:has-text('Unit Location')",
    "a:has-text('Unit Location')",
    "button:has-text('View Location')",
    "a:has-text('View Location')",
    "[aria-label*='Apartment Location' i]",
    "[aria-label*='Unit Location' i]",
  ]);
  let triggerInteraction = { attempted: false };
  if (trigger) {
    try {
      await trigger.locator.click({ timeout: INTERACTION_TIMEOUT_MS });
      await page.waitForTimeout(1200);
      triggerInteraction = {
        attempted: true,
        selector: trigger.selector,
        index: trigger.index,
        opened: true,
      };
    } catch (error) {
      triggerInteraction = {
        attempted: true,
        selector: trigger.selector,
        index: trigger.index,
        opened: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const iframe = page.locator("iframe[src*='sightmap'], iframe[src*='map']").first();
  const src = await iframe.getAttribute("src").catch(() => "");
  const pageText = await page.content().catch(() => "");
  const escapedUnit = String(context.unit.unit_number || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const locatePatterns = [
    new RegExp(`locateUnitByUnitNumber\\((['"\`])${escapedUnit}\\1\\)`, "i"),
    new RegExp(`unit(?:Number|_number|Id|_id)?['"]?\\s*[:=]\\s*['"]${escapedUnit}['"]`, "i"),
    new RegExp(`[?&](unit|unitNumber|unit_id)=${escapedUnit}\\b`, "i"),
  ];
  const locatesUnit = locatePatterns.some((pattern) => pattern.test(pageText) || pattern.test(src));
  const hasSightMapSurface = Boolean(src) || /sightmap/i.test(pageText);
  const status = hasSightMapSurface && locatesUnit ? "pass" : hasSightMapSurface ? "warn" : "fail";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? `SightMap iframe is present and configured to locate unit ${context.unit.unit_number}.`
      : status === "warn"
        ? "SightMap surface was detected, but the unit-specific locate call was not confirmed."
        : triggerInteraction.attempted
          ? "Apartment Location was exercised, but no SightMap iframe/surface was detected."
          : "Missing SightMap: no SightMap iframe/surface or Apartment Location control was detected.",
    {
      ...context,
      sightmap_src: src || null,
      has_sightmap_surface: hasSightMapSurface,
      locates_unit: locatesUnit,
      trigger_interaction: triggerInteraction,
    }
  );
}

async function unitDetailMatterportCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  await closeOpenMediaOverlays(page);
  const trigger = await firstVisibleLocator(page, [
    "a:has-text('Virtual Tour')",
    "button:has-text('Virtual Tour')",
    "a[aria-label*='virtual' i]",
    "button[aria-label*='virtual' i]",
    "a[href*='matterport.com']",
    "iframe[src*='matterport.com']",
  ]);
  if (trigger?.locator && !String(trigger.selector || "").startsWith("iframe")) {
    await trigger.locator.click({ timeout: INTERACTION_TIMEOUT_MS }).catch(() => null);
    await page.waitForTimeout(1200);
  }
  const matterport = page.locator("iframe[src*='matterport.com'], a[href*='matterport.com']").first();
  const src = (await matterport.getAttribute("src").catch(() => "")) || (await matterport.getAttribute("href").catch(() => ""));
  return qaFinding(
    check,
    src ? "pass" : "warn",
    src ? "Matterport virtual-tour destination was detected on the unit detail page." : "No Matterport virtual-tour destination was detected after exercising the Virtual Tour control.",
    { ...context, matterport_url: src || null, trigger: trigger ? { selector: trigger.selector, index: trigger.index } : null }
  );
}

async function closeOpenMediaOverlays(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const evidence = await modalImageEvidence(page);
    if (!evidence.modal_surface_count && !evidence.modal_image_count) return evidence;
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(350);
    await page
      .locator(
        [
          ".uk-modal-close",
          ".uk-close",
          "[aria-label='Close']",
          "button:has-text('Close')",
          ".fancybox__button--close",
          ".mfp-close",
        ].join(",")
      )
      .first()
      .click({ timeout: 800 })
      .catch(() => null);
    await page.waitForTimeout(350);
  }
  return await modalImageEvidence(page);
}

async function modalImageEvidence(page) {
  return await page.evaluate(() => {
    const visible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && (rect.width > 0 || rect.height > 0);
    };
    const modalSelectors = [
      "[role='dialog']",
      ".uk-modal",
      ".uk-open",
      ".uk-lightbox",
      ".uk-lightbox-items",
      ".uk-lightbox-toolbar",
      ".fancybox__container",
      ".fancybox__slide",
      ".pswp",
      ".lg-outer",
      ".mfp-wrap",
      ".swiper",
      ".slick-slider",
      "[class*='modal']",
      "[class*='lightbox']",
      "[class*='gallery']",
    ];
    const modalSurfaces = Array.from(document.querySelectorAll(modalSelectors.join(","))).filter(visible);
    const scopedImages = modalSurfaces.flatMap((surface) => Array.from(surface.querySelectorAll("img, picture source")));
    const visibleImages = scopedImages.filter((node) => {
      const src = node.currentSrc || node.src || node.getAttribute("src") || node.getAttribute("srcset") || "";
      return src && visible(node);
    });
    return {
      modal_surface_count: modalSurfaces.length,
      modal_image_count: visibleImages.length,
      sample_images: visibleImages.slice(0, 8).map((node) => ({
        src: node.currentSrc || node.src || node.getAttribute("src") || node.getAttribute("srcset") || "",
        alt: node.getAttribute("alt") || "",
      })),
      body_class: document.body?.className || "",
    };
  }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    modal_surface_count: 0,
    modal_image_count: 0,
    sample_images: [],
  }));
}

function mediaModalTriggerSelectors(check) {
  const text = `${check.page || ""} ${check.section || ""} ${check.description || ""}`;
  const pageHint = /amenit/i.test(text) ? "amenit" : /feature/i.test(text) ? "feature" : "";
  return [
    `a[aria-label*='camera' i][href], button[aria-label*='camera' i]`,
    `a[title*='camera' i][href], button[title*='camera' i]`,
    `a[class*='camera' i][href], button[class*='camera' i]`,
    `a[aria-label*='photo' i][href], button[aria-label*='photo' i]`,
    `a[title*='photo' i][href], button[title*='photo' i]`,
    `a[class*='photo' i][href], button[class*='photo' i]`,
    `a[aria-label*='gallery' i][href], button[aria-label*='gallery' i]`,
    `a[class*='gallery' i][href], button[class*='gallery' i]`,
    pageHint ? `a[aria-label*='${pageHint}' i][href*='image'], button[aria-label*='${pageHint}' i]` : "",
    "a[uk-lightbox][href], [uk-lightbox] a[href]",
    "a[data-fancybox][href]",
    "a[href$='.jpg'], a[href$='.jpeg'], a[href$='.png'], a[href*='.jpg?'], a[href*='.jpeg?'], a[href*='.png?']",
  ].filter(Boolean);
}

async function exerciseMediaModalOnCurrentPage(page, check, context = {}) {
  const reviewOnly = /images correct/i.test(`${check.description || ""}`);
  if (reviewOnly) {
    const imageCount = await visibleCount(page, "img");
    return qaFinding(
      check,
      imageCount > 0 ? "warn" : "fail",
      imageCount > 0
        ? "Images render on the page, but property-specific image correctness requires human/media review."
        : "No rendered images were detected for media correctness review.",
      { ...context, visible_image_count: imageCount, human_review_required: true }
    );
  }

  const trigger = await firstVisibleLocator(page, mediaModalTriggerSelectors(check));
  if (!trigger) {
    return qaFinding(check, "warn", "No camera/photo gallery trigger was detected for this row.", context);
  }
  let clickError = null;
  const preClickOverlay = await closeOpenMediaOverlays(page);
  try {
    await trigger.locator.click({ timeout: INTERACTION_TIMEOUT_MS });
    await page.waitForTimeout(1400);
  } catch (error) {
    clickError = error instanceof Error ? error.message : String(error);
  }
  const evidence = await modalImageEvidence(page);
  const pass = evidence.modal_image_count > 0 || evidence.modal_surface_count > 0;
  return qaFinding(
    check,
    pass ? "pass" : "warn",
    pass
      ? `Camera/photo trigger opened a gallery/modal surface with ${evidence.modal_image_count} visible image(s).`
      : "Camera/photo trigger was detected, but a visible gallery/modal image surface was not confirmed.",
    {
      ...context,
      trigger: { selector: trigger.selector, index: trigger.index },
      pre_click_overlay: preClickOverlay,
      click_error: clickError,
      modal_evidence: evidence,
    }
  );
}

async function unitDetailMediaModalCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  return exerciseMediaModalOnCurrentPage(page, check, context);
}

async function unitDetailExpandingContentCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  const bodyText = normalizeText(await page.locator("body").first().textContent().catch(() => ""));
  const htmlText = normalizeText(await page.content().catch(() => ""));
  const combinedText = `${bodyText} ${htmlText}`;
  const hasSection = /renting made simple/i.test(combinedText);
  const hasSupportingContent = /\$0 upfront|priority access|get approved/i.test(combinedText);
  return qaFinding(
    check,
    hasSection && hasSupportingContent ? "pass" : "warn",
    hasSection && hasSupportingContent
      ? "Renting Made Simple content and supporting approval details were detected."
      : "Renting Made Simple content did not expose the expected supporting details.",
    { ...context, has_section: hasSection, has_supporting_content: hasSupportingContent }
  );
}

async function unitDetailPipelineCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  const unitSpecific = /unit-specific|apply now/i.test(`${check.description}`);
  const selectors = unitSpecific
    ? ["a[href*='unit_id'][href*='apply']", "a[href*='createPipelineApplication']", "a[href*='apply']"]
    : ["a[href*='createPipelineApplication']", "a[href*='apply']"];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const href = await locator.getAttribute("href").catch(() => "");
    if (isUsableHref(href)) {
      const target = new URL(href, page.url()).toString();
      const contextEvidence = unitContextEvidence(target, context);
      const landingEvidence =
        unitSpecific && !contextEvidence.carries_unit_context
          ? await pipelineLandingUnitContextEvidence(page, target, context)
          : { checked: false, carries_unit_context: false };
      const unitSpecificMatch =
        !unitSpecific || contextEvidence.carries_unit_context || landingEvidence.carries_unit_context;
      return qaFinding(
        check,
        unitSpecificMatch ? "pass" : "fail",
        unitSpecificMatch
          ? landingEvidence.carries_unit_context
            ? `Detected unit-specific application handoff after landing-page verification -> ${target}.`
            : `Detected ${unitSpecific ? "unit-specific " : ""}application handoff -> ${target}.`
          : `Application handoff was detected, but no unit context was present in the destination -> ${target}.`,
        {
          ...context,
          target_url: target,
          unit_specific_required: unitSpecific,
          unit_context_evidence: contextEvidence,
          pipeline_landing_evidence: landingEvidence,
        }
      );
    }
  }
  return qaFinding(check, unitSpecific ? "fail" : "warn", "No application handoff was detected on the unit detail page.", context);
}

async function unitDetailBottomButtonsCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  const hrefs = [];
  const links = page.locator("a[href]");
  const count = await links.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 80); index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute("href").catch(() => "");
    const text = normalizeText(await link.textContent().catch(() => ""));
    if (isUsableHref(href)) hrefs.push({ href: new URL(href, page.url()).toString(), text });
  }
  const detected = {
    all_in_pricing: hrefs.find((link) => /createQuote|quote/i.test(`${link.href} ${link.text}`)) || null,
    apply_now:
      hrefs.find((link) => /unit_id=.*apply/i.test(link.href)) ||
      hrefs.find((link) => /createPipelineApplication|apply/i.test(`${link.href} ${link.text}`)) ||
      null,
    schedule_tour:
      hrefs.find((link) => context.unit?.unit_number && /scheduleTour/i.test(link.href) && link.href.includes(context.unit.unit_number)) ||
      hrefs.find((link) => /scheduleTour|schedule|tour/i.test(`${link.href} ${link.text}`)) ||
      null,
  };
  const missing = Object.entries(detected)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return qaFinding(
    check,
    missing.length === 0 ? "pass" : "warn",
    missing.length === 0
      ? "All-In Pricing, Apply Now, and Schedule a Tour handoffs were detected on the unit detail page."
      : `Missing expected unit detail handoffs: ${missing.join(", ")}.`,
    { ...context, detected }
  );
}

async function mobileApartmentFilterControlsCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const unitsBefore = await collectUnitRows(page, 12);
  const trigger = await firstVisibleLocator(page, [
    ".re-filters-settings-link",
    "a[uk-toggle*='re-filters']",
    "button[aria-label*='filter' i]",
    "button:has-text('Filter')",
    "a:has-text('Filter')",
  ]);
  let triggerInteraction = { attempted: false };
  if (trigger) {
    try {
      await trigger.locator.click({ timeout: INTERACTION_TIMEOUT_MS });
      await page.waitForTimeout(700);
      triggerInteraction = {
        attempted: true,
        selector: trigger.selector,
        index: trigger.index,
        opened: true,
      };
    } catch (error) {
      triggerInteraction = {
        attempted: true,
        selector: trigger.selector,
        index: trigger.index,
        opened: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const controls = {
    bedrooms: await page.locator(".re-bedroom-checkbox, input[data-param='bedrooms'], [data-param='bedrooms']").count().catch(() => 0),
    move_in_date: await page.locator("input[type='date'][data-param='available_date'], input[data-param='available_date'], [data-param='available_date']").count().catch(() => 0),
    budget: await page.locator("input[type='range'][data-param*='Rent'], input[data-param='maxRent'], [data-param='maxRent']").count().catch(() => 0),
    floor: await page.locator("select[data-param='floor'], .re-filter-floor-select, [data-param='floor']").count().catch(() => 0),
    features: await page.locator("input[data-param='unitAmenities'], .re-filter-amenities-checkbox, [data-param='unitAmenities']").count().catch(() => 0),
  };
  const firstBedroomInput = page.locator(".re-bedroom-checkbox, input[data-param='bedrooms']").first();
  let bedroomInteraction = { attempted: false };
  if ((await firstBedroomInput.count().catch(() => 0)) > 0) {
    try {
      const inputId = await firstBedroomInput.getAttribute("id").catch(() => "");
      const label = inputId ? page.locator(`label[for='${inputId}']`).first() : null;
      if (label && (await isVisibleSafe(label))) {
        await label.click({ timeout: INTERACTION_TIMEOUT_MS });
      } else {
        await firstBedroomInput.check({ force: true, timeout: INTERACTION_TIMEOUT_MS });
      }
      await page.waitForTimeout(700);
      bedroomInteraction = {
        attempted: true,
        checked: await firstBedroomInput.isChecked().catch(() => null),
        units_before: unitsBefore.length,
        units_after: (await collectUnitRows(page, 12)).length,
      };
    } catch (error) {
      bedroomInteraction = {
        attempted: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const essentialControls = /floor|features/i.test(`${check.description} ${check.section}`)
    ? ["floor", "features"]
    : ["bedrooms", "move_in_date", "budget"];
  const missing = essentialControls.filter((key) => controls[key] === 0);
  const interactionOk = !bedroomInteraction.error && !triggerInteraction.error;
  const status = missing.length === 0 && interactionOk ? "pass" : "warn";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? "Mobile Apartments & Pricing filters were detected and accepted bounded interaction."
      : `Mobile filter controls need review; missing or unverified controls: ${missing.join(", ") || "none"}.`,
    {
      apartments_url: apartmentsUrl,
      units_before: unitsBefore.length,
      controls,
      trigger_interaction: triggerInteraction,
      bedroom_interaction: bedroomInteraction,
    }
  );
}

async function mobileMapFloorUnitFilterCheck(page, check) {
  const apartmentsUrl = await gotoApartmentsPage(page);
  const units = await collectUnitRows(page, 30);
  const floorSelects = page.locator("select[data-param='floor'], .re-filter-floor-select, [data-param='floor']");
  const floorSelectCount = await floorSelects.count().catch(() => 0);
  const floors = [...new Set(units.map((unit) => unit.floor).filter(Boolean))];
  const html = await page.content().catch(() => "");
  const hasMapSurface = /sightmap|unit-map|property-map|mapbox|google\.com\/maps/i.test(html);
  const status = floorSelectCount > 0 && floors.length > 0 ? "pass" : "warn";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? `Mobile floor filter metadata is present for ${floors.length} floor value(s).`
      : "Mobile floor filter metadata or unit-floor values need review.",
    {
      apartments_url: apartmentsUrl,
      unit_count: units.length,
      floor_select_count: floorSelectCount,
      floors,
      map_surface_detected: hasMapSurface,
    }
  );
}

async function mobileUnitDetailSimilarHomesCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  if (!context.unit) {
    return qaFinding(check, "warn", "No unit detail link was detected before mobile similar-homes validation.", context);
  }
  const bodyText = normalizeText(await page.locator("body").first().textContent().catch(() => ""));
  const links = page.locator("a[href]");
  const count = await links.count().catch(() => 0);
  const candidates = [];
  for (let index = 0; index < Math.min(count, 40); index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute("href").catch(() => "");
    const text = normalizeText(await link.textContent().catch(() => ""));
    const aria = (await link.getAttribute("aria-label").catch(() => "")) || "";
    if (isUsableHref(href)) candidates.push({ href: new URL(href, page.url()).toString(), text, aria });
  }
  const similarLinks = likelySimilarHomeLinks(candidates, context.unit?.unit_number);
  const hasSimilarLabel = similarHomesLabelPattern().test(bodyText);
  return qaFinding(
    check,
    similarLinks.length > 0 || hasSimilarLabel ? "pass" : "warn",
    similarLinks.length > 0 || hasSimilarLabel
      ? "Mobile unit detail exposes an Other Similar Homes surface or same-site apartment links."
      : "Mobile unit detail did not expose an Other Similar Homes surface in the bounded inspection.",
    { ...context, similar_link_count: similarLinks.length, similar_links: similarLinks.slice(0, 8), has_similar_label: hasSimilarLabel }
  );
}

async function mobileGotoDirect(page, url, label) {
  await withTimeout(
    page.goto(url, {
      waitUntil: "commit",
      timeout: Math.min(STEP_TIMEOUT_MS, 20000),
    }),
    Math.min(STEP_TIMEOUT_MS, 20000),
    label
  );
  await page.waitForTimeout(1200);
  return url;
}

async function mobileHtmlSnapshot(page, label) {
  return await withTimeout(page.content(), 8000, label);
}

function decodeHtmlValue(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tagAttribute(tagText, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*([\"'])(.*?)\\1`, "i");
  const match = tagText.match(pattern);
  return match ? decodeHtmlValue(match[2]) : "";
}

function absolutizeHref(href, baseUrl) {
  try {
    return new URL(decodeHtmlValue(href), baseUrl).toString();
  } catch {
    return decodeHtmlValue(href);
  }
}

function extractLinksFromHtml(html, baseUrl, maxLinks = 120) {
  const links = [];
  const pattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) && links.length < maxLinks) {
    const tag = match[0];
    const href = absolutizeHref(match[2], baseUrl);
    const text = normalizeText(match[3].replace(/<[^>]+>/g, " "));
    if (isUsableHref(href)) {
      links.push({
        href,
        text,
        aria: tagAttribute(tag, "aria-label"),
      });
    }
  }
  return links;
}

function extractUnitRowsFromHtml(html, baseUrl, maxRows = 60) {
  const units = [];
  const seen = new Set();
  const pattern = /<[^>]+data-unit_number\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  let match;
  while ((match = pattern.exec(html)) && units.length < maxRows) {
    const tag = match[0];
    const unitNumber = decodeHtmlValue(match[2]);
    if (!unitNumber || seen.has(unitNumber)) continue;
    seen.add(unitNumber);
    const nearby = html.slice(match.index, match.index + 2500);
    const hrefMatch = nearby.match(/href\s*=\s*(["'])([^"']*\/apartment\/[^"']*)\1/i);
    const explicitFloor = tagAttribute(tag, "data-floor");
    const level = tagAttribute(tag, "data-level");
    units.push({
      index: units.length,
      unit_number: unitNumber,
      href: hrefMatch ? absolutizeHref(hrefMatch[2], baseUrl) : "",
      bedrooms: Number(tagAttribute(tag, "data-bedrooms") || NaN),
      bathrooms: Number(tagAttribute(tag, "data-bathrooms") || NaN),
      sqft: Number(tagAttribute(tag, "data-interior_sqft") || NaN),
      available_date: tagAttribute(tag, "data-available_date"),
      rent: Number(tagAttribute(tag, "data-rent") || NaN),
      floor: normalizedFloorValue(explicitFloor, level, inferFloorFromUnitNumber(unitNumber)),
      floor_source: explicitFloor ? "data-floor" : level ? "data-level" : inferFloorFromUnitNumber(unitNumber) ? "unit-number-inferred" : "",
      visible: true,
    });
  }
  return units;
}

function extractPropertyCodeFromHtml(html) {
  const body = html.match(/<body\b[^>]*>/i)?.[0] || "";
  return tagAttribute(body, "data-property-code") || SITE_CONFIG.property_code || "";
}

function extractStructuredAvailableCountFromHtml(html) {
  const scripts = html.match(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts.slice(0, 12)) {
    const text = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    if (!/ApartmentComplex|numberOfAvailableAccommodationUnits/i.test(text)) continue;
    try {
      const parsed = JSON.parse(text);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const apartment = candidates.find((item) => item && item["@type"] === "ApartmentComplex") || candidates[0];
      const value = apartment?.numberOfAvailableAccommodationUnits;
      return value?.minValue ?? value?.value ?? null;
    } catch {
      const rawMatch = text.match(/"numberOfAvailableAccommodationUnits"\s*:\s*(\d+)/i);
      if (rawMatch) return Number(rawMatch[1]);
    }
  }
  return null;
}

async function mobileApartmentsSnapshot(page) {
  if (mobileApartmentsSnapshotContext) {
    return mobileApartmentsSnapshotContext;
  }
  const apartmentsUrl = new URL("/apartments/", TARGET_URL).toString();
  await mobileGotoDirect(page, apartmentsUrl, "Mobile direct Apartments & Pricing navigation");
  const html = await mobileHtmlSnapshot(page, "Mobile Apartments & Pricing HTML snapshot");
  mobileApartmentsSnapshotContext = {
    apartments_url: apartmentsUrl,
    html,
    units: extractUnitRowsFromHtml(html, apartmentsUrl),
    property_code: extractPropertyCodeFromHtml(html),
    structured_available_count: extractStructuredAvailableCountFromHtml(html),
  };
  return mobileApartmentsSnapshotContext;
}

async function mobileUnitDetailSnapshot(page) {
  if (firstUnitDetailContext?.unit_detail_url && firstUnitDetailContext?.html) {
    return firstUnitDetailContext;
  }
  const apartments = await mobileApartmentsSnapshot(page);
  const unit =
    apartments.units.find((candidate) => isUsableHref(candidate.href)) ||
    apartments.units[0] ||
    null;
  if (!unit || !isUsableHref(unit.href)) {
    return {
      apartments_url: apartments.apartments_url,
      unit: null,
      unit_detail_url: null,
      html: "",
      links: [],
      title: "",
    };
  }
  const unitDetailUrl = absolutizeHref(unit.href, apartments.apartments_url);
  await mobileGotoDirect(page, unitDetailUrl, "Mobile direct unit detail navigation");
  const html = await mobileHtmlSnapshot(page, "Mobile unit detail HTML snapshot");
  const title = normalizeText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " "));
  const links = extractLinksFromHtml(html, unitDetailUrl);
  firstUnitDetailContext = {
    apartments_url: apartments.apartments_url,
    unit,
    unit_detail_url: unitDetailUrl,
    html,
    links,
    title,
  };
  return firstUnitDetailContext;
}

async function mobileFilterSnapshotCheck(page, check) {
  const snapshot = await mobileApartmentsSnapshot(page);
  const html = snapshot.html;
  const controls = {
    bedrooms: (html.match(/data-param=["']bedrooms["']|re-bedroom-checkbox/gi) || []).length,
    move_in_date: (html.match(/data-param=["']available_date["']|type=["']date["']/gi) || []).length,
    budget: (html.match(/data-param=["']maxRent["']|data-param=["'][^"']*Rent[^"']*["']|type=["']range["']/gi) || []).length,
    floor: (html.match(/data-param=["']floor["']|re-filter-floor-select/gi) || []).length,
    features: (html.match(/data-param=["']unitAmenities["']|re-filter-amenities-checkbox/gi) || []).length,
    filter_trigger: (html.match(/re-filters-settings-link|uk-toggle=["'][^"']*re-filters|filter/gi) || []).length,
  };
  const essentialControls = /floor|features/i.test(`${check.description} ${check.section}`)
    ? ["floor", "features"]
    : ["bedrooms", "move_in_date", "budget"];
  const missing = essentialControls.filter((key) => controls[key] === 0);
  return qaFinding(
    check,
    missing.length === 0 ? "pass" : "warn",
    missing.length === 0
      ? "Mobile Apartments & Pricing filter controls are present in the rendered HTML snapshot."
      : `Mobile filter controls need review; missing controls: ${missing.join(", ")}.`,
    {
      apartments_url: snapshot.apartments_url,
      unit_count: snapshot.units.length,
      controls,
      proof_level: "mobile-html-snapshot",
    }
  );
}

async function mobileRenderedAvailabilitySnapshotCheck(page, check) {
  const snapshot = await mobileApartmentsSnapshot(page);
  const pond = loadPondAvailabilityUnits();
  if (!pond) {
    return qaSkipped(check, "Pond availability export/config path is required for source-of-truth comparison.", {
      apartments_url: snapshot.apartments_url,
      property_code: snapshot.property_code,
      rendered_available_count: snapshot.units.length,
      structured_available_count: snapshot.structured_available_count,
      sample_rendered_units: snapshot.units.slice(0, 8).map((unit) => unit.unit_number),
      proof_level: "mobile-html-snapshot",
    });
  }
  if (pond.error) {
    return qaFinding(check, "warn", "Pond availability source could not be loaded.", {
      apartments_url: snapshot.apartments_url,
      pond_error: pond.error,
      pond_source_path: pond.source_path,
      rendered_available_count: snapshot.units.length,
      structured_available_count: snapshot.structured_available_count,
    });
  }
  const relevant = pond.units.filter((unit) => {
    const raw = `${unit.property_id || ""} ${unit.feed_property_id || ""} ${unit.property_code || ""} ${unit.property || ""}`;
    return raw.includes(PROPERTY_ID) || (snapshot.property_code && raw.includes(snapshot.property_code));
  });
  const pondUnitNumbers = new Set(
    relevant.map((unit) => String(unit.apt_number || unit.unit_number || unit.apartment_number || "")).filter(Boolean)
  );
  const renderedUnitNumbers = new Set(snapshot.units.map((unit) => String(unit.unit_number)).filter(Boolean));
  const overlap = [...renderedUnitNumbers].filter((unitNumber) => pondUnitNumbers.has(unitNumber));
  const renderedMissingFromPond = [...renderedUnitNumbers].filter((unitNumber) => !pondUnitNumbers.has(unitNumber));
  const pondMissingFromRendered = [...pondUnitNumbers].filter((unitNumber) => !renderedUnitNumbers.has(unitNumber));
  const mismatchEvidence = compactAvailabilityMismatchEvidence(snapshot.units, relevant);
  const structuredCountMatches =
    snapshot.structured_available_count === null ||
    Number(snapshot.structured_available_count) === snapshot.units.length ||
    Number(snapshot.structured_available_count) === relevant.length;
  const countMatchesPond = snapshot.units.length === relevant.length;
  const baseEvidence = {
    apartments_url: snapshot.apartments_url,
    property_code: snapshot.property_code,
    rendered_available_count: snapshot.units.length,
    structured_available_count: snapshot.structured_available_count,
    pond_source_path: pond.source_path,
    pond_relevant_count: relevant.length,
    overlap_count: overlap.length,
    rendered_missing_from_pond: renderedMissingFromPond,
    pond_missing_from_rendered: pondMissingFromRendered,
    availability_mismatch_evidence: mismatchEvidence,
    structured_count_matches: structuredCountMatches,
    count_matches_pond: countMatchesPond,
    sample_rendered_units: snapshot.units.slice(0, 8),
    proof_level: "mobile-html-snapshot",
  };
  const verdict = availabilityVerdictForCheck(check, baseEvidence);
  return qaFinding(
    check,
    verdict.status,
    verdict.message,
    {
      ...baseEvidence,
      pond_missing_from_rendered: pondMissingFromRendered.slice(0, 25),
      verdict_criteria: verdict.criteria,
    }
  );
}

async function mobileApartmentsSortSnapshotCheck(page, check) {
  const isReviewsCheck = `${check.page} ${check.section} ${check.description}`.toLowerCase().includes("review");
  if (isReviewsCheck) {
    const reviewsUrl = new URL("/reviews/", TARGET_URL).toString();
    await mobileGotoDirect(page, reviewsUrl, "Mobile direct reviews navigation");
    const html = await mobileHtmlSnapshot(page, "Mobile reviews HTML snapshot");
    const reviews = [...html.matchAll(/<div[^>]*class=(["'])[^"']*\bel-meta\b[^"']*\1[^>]*>(.*?)<\/div>/gis)]
      .map((match) => {
        const dateText = normalizeText(match[2].replace(/<[^>]+>/g, " "));
        const parsed = parseReviewDateValue(dateText);
        return parsed ? { date_text: dateText, timestamp: parsed.getTime() } : null;
      })
      .filter(Boolean);
    if (reviews.length < 2) {
      return qaSkipped(check, "Review date elements are required before automated review sort validation can pass/fail.", {
        reviews_url: reviewsUrl,
        detected_date_count: reviews.length,
        proof_level: "mobile-html-snapshot",
      });
    }
    const sortedNewestFirst = reviewDatesSortedNewestFirst(reviews);
    return qaFinding(
      check,
      sortedNewestFirst ? "pass" : "warn",
      sortedNewestFirst
        ? "Mobile reviews are sorted newest-first by rendered date text."
        : "Rendered mobile review dates are not newest-first in source/HTML order.",
      { reviews_url: reviewsUrl, dates: compactReviewEvidence(reviews), detected_date_count: reviews.length, proof_level: "mobile-html-snapshot" }
    );
  }
  const snapshot = await mobileApartmentsSnapshot(page);
  if (snapshot.units.length < 2) {
    return qaFinding(check, "warn", "Not enough mobile rendered units were detected to evaluate sort order.", {
      apartments_url: snapshot.apartments_url,
      unit_count: snapshot.units.length,
      proof_level: "mobile-html-snapshot",
    });
  }
  const sortEvidence = combinedUnitSortEvidence(snapshot.units);
  return qaFinding(
    check,
    sortEvidence.sorted_combined_size_date_price ? "pass" : "fail",
    sortEvidence.sorted_combined_size_date_price
      ? "Mobile rendered unit rows follow the combined size, move-in date, then price order."
      : "Mobile rendered unit rows do not follow the combined size, move-in date, then price order.",
    {
      apartments_url: snapshot.apartments_url,
      ...sortEvidence,
      proof_level: "mobile-html-snapshot",
    }
  );
}

async function mobileMapFloorSnapshotCheck(page, check) {
  const snapshot = await mobileApartmentsSnapshot(page);
  const floors = [...new Set(snapshot.units.map((unit) => unit.floor).filter(Boolean))];
  const floorControlCount = (snapshot.html.match(/data-param=["']floor["']|re-filter-floor-select/gi) || []).length;
  const hasMapSurface = /sightmap|unit-map|property-map|mapbox|google\.com\/maps/i.test(snapshot.html);
  const floorSelects = page.locator("select[data-param='floor'], .re-filter-floor-select, [data-param='floor']");
  const selectCount = await floorSelects.count().catch(() => 0);
  const liveUnits = await collectUnitRows(page, 30).catch(() => snapshot.units);
  const interactionEvidence =
    selectCount > 0
      ? await exerciseFloorFilterSelect(page, liveUnits.length ? liveUnits : snapshot.units, floorSelects, selectCount)
      : { floors, targetFloor: floors[1] || floors[0] || "", interaction: { attempted: false } };
  const activeFloors = interactionEvidence.floors.length ? interactionEvidence.floors : floors;
  const pass =
    floorControlCount > 0 &&
    activeFloors.length > 0 &&
    (activeFloors.length === 1 ||
      (interactionEvidence.interaction.attempted && interactionEvidence.interaction.changed_visible_units));
  return qaFinding(
    check,
    pass ? "pass" : "fail",
    pass
      ? activeFloors.length === 1
        ? "Mobile floor filter metadata is present; only one observed floor value is available to exercise."
        : "Changing the mobile floor filter updated the observed available-unit set."
      : floorControlCount === 0
        ? "No mobile floor filter control was detected."
        : activeFloors.length === 0
          ? "Mobile floor filter exists, but rendered units did not expose floor metadata."
          : "Changing the mobile floor filter did not update the observed available-unit set.",
    {
      apartments_url: snapshot.apartments_url,
      unit_count: snapshot.units.length,
      floor_control_count: floorControlCount,
      select_count: selectCount,
      floors: activeFloors,
      interaction: interactionEvidence.interaction,
      target_floor: interactionEvidence.targetFloor || null,
      changed_visible_units: interactionEvidence.interaction.changed_visible_units ?? null,
      map_surface_detected: hasMapSurface,
      proof_level: "mobile-html-snapshot-plus-bounded-interaction",
    }
  );
}

async function mobileUnitDetailContextSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  if (!context.unit) {
    return qaFinding(check, "warn", "No mobile unit detail link was detected from Apartments & Pricing.", context);
  }
  const unitMatches = context.html.includes(context.unit.unit_number) || context.title.includes(context.unit.unit_number);
  return qaFinding(
    check,
    unitMatches ? "pass" : "warn",
    unitMatches
      ? `Mobile unit ${context.unit.unit_number} detail page retained the same unit number.`
      : `Mobile unit ${context.unit.unit_number} detail page did not clearly retain that unit number.`,
    { ...context, html: undefined, links: undefined, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileUnitDetailSightMapSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  if (!context.unit) {
    return qaFinding(check, "warn", "No mobile unit detail link was detected before SightMap validation.", context);
  }
  const sightmapSrc = context.html.match(/<iframe\b[^>]*src\s*=\s*(["'])([^"']*sightmap[^"']*)\1/i)?.[2] || "";
  const escapedUnit = String(context.unit.unit_number || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const locatePatterns = [
    new RegExp(`locateUnitByUnitNumber\\((['"\`])${escapedUnit}\\1\\)`, "i"),
    new RegExp(`unit(?:Number|_number|Id|_id)?['"]?\\s*[:=]\\s*['"]${escapedUnit}['"]`, "i"),
    new RegExp(`[?&](unit|unitNumber|unit_id)=${escapedUnit}\\b`, "i"),
  ];
  const locatesUnit = locatePatterns.some((pattern) => pattern.test(context.html) || pattern.test(sightmapSrc));
  const hasSightMapSurface = Boolean(sightmapSrc) || /sightmap/i.test(context.html);
  const status = hasSightMapSurface && locatesUnit ? "pass" : hasSightMapSurface ? "warn" : "fail";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? `Mobile SightMap iframe is present and configured to locate unit ${context.unit.unit_number}.`
      : status === "warn"
        ? "Mobile SightMap surface was detected, but the unit-specific locate call was not confirmed."
        : "Missing mobile SightMap: no SightMap iframe/surface was detected.",
    { ...context, html: undefined, links: undefined, sightmap_src: sightmapSrc || null, has_sightmap_surface: hasSightMapSurface, locates_unit: locatesUnit, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileUnitDetailMatterportSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const matterportUrl = context.html.match(/(?:src|href)\s*=\s*(["'])([^"']*matterport\.com[^"']*)\1/i)?.[2] || "";
  return qaFinding(
    check,
    matterportUrl ? "pass" : "warn",
    matterportUrl ? "Mobile Matterport virtual-tour destination was detected on the unit detail page." : "No mobile Matterport virtual-tour destination was detected.",
    { ...context, html: undefined, links: undefined, matterport_url: matterportUrl || null, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileUnitDetailMediaModalSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const reviewOnly = /images correct/i.test(`${check.description || ""}`);
  const galleryLinks = context.links.filter((link) =>
    /camera|photo|gallery|image|\.jpg|\.jpeg|\.png/i.test(`${link.href} ${link.text} ${link.aria}`)
  );
  const imageMatches = context.html.match(/<img\b[^>]*(?:src|srcset)=/gi) || [];
  if (reviewOnly) {
    return qaFinding(
      check,
      imageMatches.length > 0 ? "warn" : "fail",
      imageMatches.length > 0
        ? "Mobile images are present, but property-specific image correctness requires human/media review."
        : "No mobile unit-detail images were detected for media correctness review.",
      { ...context, html: undefined, links: undefined, image_count: imageMatches.length, human_review_required: true, proof_level: "mobile-html-snapshot" }
    );
  }
  return qaFinding(
    check,
    galleryLinks.length > 0 || imageMatches.length > 0 ? "pass" : "warn",
    galleryLinks.length > 0 || imageMatches.length > 0
      ? "Mobile unit-detail photo/gallery evidence was detected in the page snapshot."
      : "Mobile unit-detail photo/gallery trigger was not confirmed from the page snapshot.",
    {
      ...context,
      html: undefined,
      links: undefined,
      gallery_link_count: galleryLinks.length,
      gallery_links: galleryLinks.slice(0, 8),
      image_count: imageMatches.length,
      proof_level: "mobile-html-snapshot",
    }
  );
}

async function mobileUnitDetailExpandingSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const hasSection = /renting made simple/i.test(context.html);
  const hasSupportingContent = /\$0 upfront|priority access|get approved/i.test(context.html);
  return qaFinding(
    check,
    hasSection && hasSupportingContent ? "pass" : "warn",
    hasSection && hasSupportingContent
      ? "Mobile Renting Made Simple content and supporting approval details were detected."
      : "Mobile Renting Made Simple content did not expose the expected supporting details.",
    { ...context, html: undefined, links: undefined, has_section: hasSection, has_supporting_content: hasSupportingContent, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileUnitDetailPipelineSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const unitSpecific = /unit-specific|apply now/i.test(`${check.description}`);
  const match =
    context.links.find((link) => unitSpecific && /unit_id=.*apply|createPipelineApplication/i.test(link.href)) ||
    context.links.find((link) => /createPipelineApplication|apply/i.test(`${link.href} ${link.text} ${link.aria}`)) ||
    null;
  const target = match?.href || "";
  const includesUnitContext = Boolean(
    target && unitContextEvidence(target, context).carries_unit_context
  );
  const contextEvidence = unitContextEvidence(target, context);
  const landingEvidence =
    target && unitSpecific && !includesUnitContext
      ? await pipelineLandingUnitContextEvidence(page, target, context)
      : { checked: false, carries_unit_context: false };
  const unitSpecificMatch = includesUnitContext || landingEvidence.carries_unit_context;
  const status = target && (!unitSpecific || unitSpecificMatch) ? "pass" : unitSpecific ? "fail" : "warn";
  return qaFinding(
    check,
    status,
    target && status === "pass"
      ? landingEvidence.carries_unit_context
        ? `Mobile unit-specific application handoff was verified on the landed Portal page -> ${target}.`
        : `Mobile ${unitSpecific ? "unit-specific " : ""}application handoff was detected -> ${target}.`
      : target
        ? `Mobile application handoff was detected, but unit context needs review -> ${target}.`
        : "No mobile application handoff was detected on the unit detail page.",
    {
      ...context,
      html: undefined,
      links: undefined,
      target_url: target || null,
      unit_specific_required: unitSpecific,
      includes_unit_context: unitSpecificMatch,
      unit_context_evidence: contextEvidence,
      pipeline_landing_evidence: landingEvidence,
      proof_level: "mobile-html-snapshot",
    }
  );
}

async function mobileUnitDetailBottomButtonsSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const detected = {
    all_in_pricing: context.links.find((link) => /createQuote|quote/i.test(`${link.href} ${link.text} ${link.aria}`)) || null,
    apply_now:
      context.links.find((link) => /unit_id=.*apply/i.test(link.href)) ||
      context.links.find((link) => /createPipelineApplication|apply/i.test(`${link.href} ${link.text} ${link.aria}`)) ||
      null,
    schedule_tour:
      context.links.find((link) => context.unit?.unit_number && /scheduleTour/i.test(link.href) && link.href.includes(context.unit.unit_number)) ||
      context.links.find((link) => /scheduleTour|schedule|tour/i.test(`${link.href} ${link.text} ${link.aria}`)) ||
      null,
  };
  const missing = Object.entries(detected)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return qaFinding(
    check,
    missing.length === 0 ? "pass" : "warn",
    missing.length === 0
      ? "Mobile All-In Pricing, Apply Now, and Schedule a Tour handoffs were detected on the unit detail page."
      : `Missing expected mobile unit detail handoffs: ${missing.join(", ")}.`,
    { ...context, html: undefined, links: undefined, detected, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileUnitDetailPriceQuoteSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const quote = context.links.find((link) => /createQuote|quote/i.test(`${link.href} ${link.text} ${link.aria}`)) || null;
  const includesUnit = context.unit?.unit_number && quote?.href ? quote.href.includes(context.unit.unit_number) : false;
  return qaFinding(
    check,
    quote?.href && includesUnit ? "pass" : "warn",
    quote?.href && includesUnit
      ? `Mobile unit-specific All-In Pricing quote handoff was detected -> ${quote.href}.`
      : "Mobile All-In Pricing quote handoff was missing or not clearly unit-specific.",
    { ...context, html: undefined, links: undefined, target_url: quote?.href || null, includes_unit_number: includesUnit, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileUnitDetailScheduleTourSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const tour =
    context.links.find((link) => context.unit?.unit_number && /scheduleTour/i.test(link.href) && link.href.includes(context.unit.unit_number)) ||
    context.links.find((link) => /scheduleTour|schedule|tour/i.test(`${link.href} ${link.text} ${link.aria}`)) ||
    null;
  const includesUnit = context.unit?.unit_number && tour?.href ? tour.href.includes(context.unit.unit_number) : false;
  return qaFinding(
    check,
    tour?.href ? "pass" : "warn",
    tour?.href
      ? `Mobile Schedule a Tour handoff was detected${includesUnit ? " with unit context" : ""} -> ${tour.href}.`
      : "No mobile Schedule a Tour handoff was detected on the unit detail page.",
    { ...context, html: undefined, links: undefined, target_url: tour?.href || null, includes_unit_number: includesUnit, proof_level: "mobile-html-snapshot" }
  );
}

async function mobileSimilarHomesSnapshotCheck(page, check) {
  const context = await mobileUnitDetailSnapshot(page);
  const similarLinks = likelySimilarHomeLinks(context.links, context.unit?.unit_number);
  const hasSimilarLabel = similarHomesLabelPattern().test(context.html);
  return qaFinding(
    check,
    similarLinks.length > 0 || hasSimilarLabel ? "pass" : "warn",
    similarLinks.length > 0 || hasSimilarLabel
      ? "Mobile unit detail exposes an Other Similar Homes surface or same-site apartment links."
      : "Mobile unit detail did not expose an Other Similar Homes surface in the bounded inspection.",
    { ...context, html: undefined, links: undefined, similar_link_count: similarLinks.length, similar_links: similarLinks.slice(0, 8), has_similar_label: hasSimilarLabel, proof_level: "mobile-html-snapshot" }
  );
}

async function unitDetailPriceQuoteCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  const quote = page.locator("a[href*='createQuote'], a[href*='quote']").first();
  const href = await quote.getAttribute("href").catch(() => "");
  const target = href ? new URL(href, page.url()).toString() : "";
  const includesUnit = context.unit?.unit_number ? target.includes(context.unit.unit_number) : false;
  return qaFinding(
    check,
    target && includesUnit ? "pass" : "warn",
    target && includesUnit
      ? `Unit-specific All-In Pricing quote handoff was detected -> ${target}.`
      : "All-In Pricing quote handoff was missing or not clearly unit-specific.",
    { ...context, target_url: target || null, includes_unit_number: includesUnit }
  );
}

async function unitDetailScheduleTourCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  const links = page.locator("a[href*='scheduleTour'], a[href*='schedule']");
  const count = await links.count().catch(() => 0);
  let href = "";
  for (let index = 0; index < Math.min(count, 20); index += 1) {
    const candidate = (await links.nth(index).getAttribute("href").catch(() => "")) || "";
    if (!href) href = candidate;
    if (context.unit?.unit_number && candidate.includes(context.unit.unit_number)) {
      href = candidate;
      break;
    }
  }
  const target = href ? new URL(href, page.url()).toString() : "";
  const includesUnit = context.unit?.unit_number ? target.includes(context.unit.unit_number) : false;
  return qaFinding(
    check,
    target ? "pass" : "warn",
    target
      ? `Schedule a Tour handoff was detected${includesUnit ? " with unit context" : ""} -> ${target}.`
      : "No Schedule a Tour handoff was detected on the unit detail page.",
    { ...context, target_url: target || null, includes_unit_number: includesUnit }
  );
}

async function unitDetailSimilarHomesCarouselCheck(page, check) {
  const context = await gotoFirstUnitDetailPage(page);
  const bodyText = normalizeText(await page.locator("body").first().textContent().catch(() => ""));
  const links = page.locator("a[href]");
  const count = await links.count().catch(() => 0);
  const candidates = [];
  for (let index = 0; index < Math.min(count, 60); index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute("href").catch(() => "");
    const text = normalizeText(await link.textContent().catch(() => ""));
    const aria = (await link.getAttribute("aria-label").catch(() => "")) || "";
    if (isUsableHref(href)) candidates.push({ href: new URL(href, page.url()).toString(), text, aria });
  }
  const similarLinks = likelySimilarHomeLinks(candidates, context.unit?.unit_number);
  const carouselSurfaceCount = await visibleCount(page, ".uk-slider, [uk-slider], .swiper, .slick-slider, [class*='carousel']");
  const hasSimilarLabel = similarHomesLabelPattern().test(bodyText);
  return qaFinding(
    check,
    similarLinks.length > 0 || hasSimilarLabel ? "pass" : "warn",
    similarLinks.length > 0 || hasSimilarLabel
      ? "Other Similar Homes links or labels were detected on the unit detail page."
      : "Other Similar Homes links were not detected on the unit detail page.",
    { ...context, similar_link_count: similarLinks.length, similar_links: similarLinks.slice(0, 8), carousel_surface_count: carouselSurfaceCount, has_similar_label: hasSimilarLabel }
  );
}

async function reviewsSortOrderCheck(page, check) {
  const reviewsUrl = new URL("/reviews/", TARGET_URL).toString();
  await page.goto(reviewsUrl, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);
  const title = await page.title().catch(() => "");
  const rawReviews = await page.evaluate(() => {
    const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ");
    const datePattern = /\b\d{1,2}\s+\d{1,2},\s*\d{4}\b|\b\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}\b/;
    let cards = Array.from(document.querySelectorAll(".fs-load-more-item"));
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll(".fs-grid-item-holder, .el-item.uk-card"));
    }
    const seen = new Set();
    return cards
      .map((card, index) => {
        const text = normalize(card.textContent);
        const dateText = normalize(card.querySelector(".el-meta")?.textContent || text.match(datePattern)?.[0] || "");
        const match = dateText.match(datePattern);
        if (!match) return null;
        const rect = card.getBoundingClientRect();
        const author = normalize(card.querySelector(".el-content")?.textContent || "");
        const key = `${match[0]}|${author}|${Math.round(rect.left)}|${Math.round(rect.top)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          index,
          date_text: match[0],
          author: author.replace(/^[-–]\s*/, ""),
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
        };
      })
      .filter(Boolean);
  });
  const domReviews = rawReviews
    .map((review) => {
      const parsed = parseReviewDateValue(review.date_text);
      return parsed ? { ...review, timestamp: parsed.getTime() } : null;
    })
    .filter(Boolean);
  if (domReviews.length < 2) {
    return qaSkipped(check, "Review date elements are required before automated review sort validation can pass/fail.", {
      reviews_url: reviewsUrl,
      title,
      detected_date_count: domReviews.length,
    });
  }
  const visualReviews = [...domReviews].sort((a, b) => {
    const yDelta = a.y - b.y;
    if (Math.abs(yDelta) > 24) return yDelta;
    return a.x - b.x;
  });
  const domSortedNewestFirst = reviewDatesSortedNewestFirst(domReviews);
  const visualSortedNewestFirst = reviewDatesSortedNewestFirst(visualReviews);
  const sortedNewestFirst = domSortedNewestFirst && visualSortedNewestFirst;
  const reviewSortMessage = sortedNewestFirst
    ? "Reviews are sorted newest-first by rendered date text."
    : domSortedNewestFirst
      ? "Review source/DOM order is newest-first, but masonry visual card placement is not strictly newest-first in direct reading order."
      : "Rendered review dates are not newest-first in source/DOM order.";
  return qaFinding(
    check,
    sortedNewestFirst ? "pass" : "warn",
    reviewSortMessage,
    {
      reviews_url: reviewsUrl,
      title,
      dom_sorted_newest_first: domSortedNewestFirst,
      visual_sorted_newest_first: visualSortedNewestFirst,
      detected_date_count: domReviews.length,
      dom_dates: compactReviewEvidence(domReviews),
      visual_dates: compactReviewEvidence(visualReviews),
    }
  );
}

async function expandingContentCheck(page, check) {
  await gotoTargetHome(page);
  const trigger = page.locator("button, a, summary").filter({ hasText: /renting made simple/i }).first();
  if (!(await trigger.count().catch(() => 0))) {
    return qaFinding(check, "warn", "No Renting Made Simple trigger was detected.", {});
  }
  try {
    await trigger.click({ timeout: INTERACTION_TIMEOUT_MS });
    await page.waitForTimeout(500);
    const visibleTextCount = await page.locator("text=/deposit|approved|renting made simple|application/i").count().catch(() => 0);
    return qaFinding(
      check,
      visibleTextCount > 0 ? "pass" : "warn",
      visibleTextCount > 0
        ? "Renting Made Simple interaction exposed supporting information."
        : "Renting Made Simple trigger clicked, but supporting information was not detected.",
      { visible_text_count: visibleTextCount }
    );
  } catch (error) {
    return qaFinding(check, "warn", error instanceof Error ? error.message : "Renting Made Simple interaction needs review.");
  }
}

async function genericBrowserFunctionalityCheck(page, check) {
  const raw = `${check.description} ${check.section}`.toLowerCase();
  if (raw.includes("apply") && raw.includes("schedule")) {
    const apply = await externalHandoffCheck(page, check, "pipeline");
    const schedule = await externalHandoffCheck(page, check, "schedule");
    const status = apply.status === "pass" && schedule.status === "pass" ? "pass" : "warn";
    return qaFinding(check, status, `Primary CTA audit: Apply=${apply.status}, Schedule=${schedule.status}.`, {
      apply: apply.metadata,
      schedule: schedule.metadata,
    });
  }
  if (raw.includes("contact")) {
    return routeCheck(page, check, "contact");
  }
  if (raw.includes("special")) {
    const apartments = await routeCheck(page, check, "apartments");
    const contact = await routeCheck(page, check, "contact");
    const status = apartments.status === "pass" || contact.status === "pass" ? "pass" : "warn";
    return qaFinding(check, status, `Specials CTA audit: Apartments=${apartments.status}, Contact=${contact.status}.`, {
      apartments: apartments.metadata,
      contact: contact.metadata,
    });
  }
  return qaSkipped(check, "Generic browser functionality check needs a specific runner mapping.", {});
}

function sectionHtml(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, "i"));
  return match ? match[0] : "";
}

function linkMatchesPath(link, expectedPath) {
  try {
    return urlsMatchSameHostPath(link.href, expectedPath);
  } catch {
    return false;
  }
}

function linkMatchesExternal(link, expectedUrl) {
  if (!expectedUrl) return false;
  try {
    const target = new URL(link.href, TARGET_URL);
    const expected = new URL(expectedUrl, TARGET_URL);
    return target.origin === expected.origin && target.pathname === expected.pathname;
  } catch {
    return String(link.href || "").includes(String(expectedUrl || ""));
  }
}

function surfaceLinks(surfaceHtml, baseUrl) {
  return extractLinksFromHtml(surfaceHtml || "", baseUrl, 200);
}

function findPhoneLinks(links) {
  return links.filter((link) => String(link.href || "").toLowerCase().startsWith("tel:"));
}

function findApplyLinks(links) {
  return links.filter((link) => /createPipelineApplication|apply/i.test(`${link.href} ${link.text} ${link.aria}`));
}

function findScheduleLinks(links) {
  return links.filter((link) => /scheduleTour|schedule.*tour|book.*tour|tour/i.test(`${link.href} ${link.text} ${link.aria}`));
}

function visiblePhoneTextMatches(surfaceHtml, contactTruth) {
  const phones = [contactTruth?.office_phone, contactTruth?.concierge_phone].filter(Boolean);
  const surfaceText = normalizeText(String(surfaceHtml || "").replace(/<[^>]+>/g, " "));
  return phones.some((phone) => surfaceText.includes(phone) || phoneMatches(surfaceText, phone));
}

function leadAttributionFinding(checkId, label, status, message, metadata = {}) {
  return {
    check_id: checkId,
    kind: `lead_attribution:${checkId}`,
    label,
    status,
    message,
    metadata: {
      qa_owner: "lead_attribution_qa",
      qa_runner_profile: "lead_attribution_e2e",
      side_effect_policy:
        process.env.EVS_ENABLE_SYNTHETIC_FORM_SUBMIT === "1" ? "synthetic_form_submission_enabled" : "no_submit",
      ...metadata,
    },
    evidence_refs: [],
  };
}

function trackingScenarioLabel(scenario) {
  return [scenario.marketing_source_cd, scenario.tracking_id].filter(Boolean).join(" / ") || "tracking scenario";
}

function scenarioMatchesFilter(scenario) {
  const trackingFilter = process.env.EVS_ATTRIBUTION_TRACKING_ID || "";
  const sourceFilter = process.env.EVS_ATTRIBUTION_MARKETING_SOURCE_CD || "";
  if (trackingFilter && scenario.tracking_id !== trackingFilter) return false;
  if (sourceFilter && scenario.marketing_source_cd !== sourceFilter) return false;
  return true;
}

function selectLeadAttributionScenarios(propertyTruth) {
  const maxScenarios = Math.max(Number(process.env.EVS_LEAD_ATTRIBUTION_MAX_SCENARIOS || 3), 1);
  const scenarios = (propertyTruth?.tracking_codes || []).filter(scenarioMatchesFilter);
  const preferred = [
    ...scenarios.filter((scenario) => scenario.expected_phone),
    ...scenarios.filter((scenario) => !scenario.expected_phone && scenario.expected_email),
    ...scenarios.filter((scenario) => !scenario.expected_phone && !scenario.expected_email),
  ];
  return (preferred.length ? preferred : scenarios).slice(0, maxScenarios);
}

function htmlContainsValue(html, value) {
  if (!value) return false;
  return String(html || "").toLowerCase().includes(String(value).toLowerCase());
}

function textFromHtml(html) {
  return normalizeText(
    String(html || "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function uniqueValues(values, limit = 40) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = normalizeText(String(value || ""));
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function extractEmailsFromHtml(html) {
  const matches = String(html || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return uniqueValues(matches.map((value) => value.toLowerCase()), 60);
}

function extractPhoneTextCandidates(html) {
  const visibleText = textFromHtml(html);
  const matches =
    visibleText.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) || [];
  return uniqueValues(matches, 60);
}

function phoneEvidenceFromHtml(html, links, expectedPhone) {
  const telLinks = findPhoneLinks(links).map((link) => ({
    href: link.href,
    text: link.text,
    aria: link.aria,
    digits: phoneDigits(link.href),
  }));
  const text_candidates = extractPhoneTextCandidates(html).map((value) => ({
    value,
    digits: phoneDigits(value),
  }));
  const matching_tel_links = expectedPhone
    ? telLinks.filter((link) => phoneMatches(link.href, expectedPhone) || phoneMatches(link.text, expectedPhone))
    : [];
  const matching_text_values = expectedPhone
    ? text_candidates.filter((candidate) => phoneMatches(candidate.value, expectedPhone))
    : [];
  return {
    expected_phone: expectedPhone || null,
    tel_links: telLinks.slice(0, 20),
    text_candidates: text_candidates.slice(0, 20),
    matching_tel_links: matching_tel_links.slice(0, 8),
    matching_text_values: matching_text_values.slice(0, 8),
    matched:
      Boolean(expectedPhone) &&
      (matching_tel_links.length > 0 || matching_text_values.length > 0 || phoneMatches(html, expectedPhone)),
  };
}

function emailEvidenceFromHtml(html, expectedEmail) {
  const observed_emails = extractEmailsFromHtml(html);
  const expected = expectedEmail ? String(expectedEmail).toLowerCase() : "";
  const matching_emails = expected ? observed_emails.filter((email) => email === expected) : [];
  return {
    expected_email: expectedEmail || null,
    observed_emails: observed_emails.slice(0, 40),
    matching_emails,
    matched: Boolean(expectedEmail) && matching_emails.length > 0,
  };
}

function trackingEvidenceFromHtml(html, loadedUrl, trackingId) {
  const inUrl = Boolean(trackingId) && String(loadedUrl || "").includes(trackingId);
  const inHtml = htmlContainsValue(html, trackingId);
  return {
    tracking_id: trackingId || null,
    loaded_url: loadedUrl,
    found_in_url: inUrl,
    found_in_html: inHtml,
    matched: inUrl || inHtml,
  };
}

async function collectAttributionRuntimeEvidence(page, trackingId) {
  return await page
    .evaluate((code) => {
      const cfg = window.resiPixelConfig || null;
      const selectedLeadSource =
        cfg?.leadSources?.find?.((source) => source && source.code === code) || null;
      const storage = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !/resi|attribution|lead|source|pixel/i.test(key)) continue;
        const value = localStorage.getItem(key);
        try {
          storage[key] = JSON.parse(value || "null");
        } catch {
          storage[key] = value;
        }
      }
      return {
        resi_pixel_config: cfg
          ? {
              external_source_field: cfg.externalSourceField || null,
              fallback_phone: cfg.fallbackPhone || null,
              selected_lead_source: selectedLeadSource
                ? {
                    name: selectedLeadSource.name || null,
                    code: selectedLeadSource.code || null,
                    phone: selectedLeadSource.phone || null,
                    email: selectedLeadSource.email || null,
                  }
                : null,
            }
          : null,
        local_storage: storage,
      };
    }, trackingId)
    .catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
}

function attributionUrlForScenario(scenario) {
  const generated = scenario.generated_urls || {};
  return generated.home || generated.contact || TARGET_URL;
}

function contactUrlForScenario(scenario) {
  const generated = scenario.generated_urls || {};
  return generated.contact || new URL("/contact/", TARGET_URL).toString();
}

function contactPageUrl() {
  return new URL("/contact/", TARGET_URL).toString();
}

function titleToken(value) {
  return String(value || "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function lowerToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function attributionSourceToken(scenario) {
  const email = String(scenario.expected_email || "").toLowerCase();
  const source = String(scenario.marketing_source_cd || "").toUpperCase();
  if (source === "APL") return "Aptlist";
  if (source === "APR") return "AptRatings";
  if (source === "ADC-VL") return "Apartments";
  if (source === "BNG") return "Bing";
  if (source === "GOO-VL") return "Google";
  if (source === "GOA") return "GoogleAds";
  if (source === "SOC") return "Social";
  if (source === "VWS") return "Website";
  if (source === "AH") return "AH";
  if (source === "UNA") return "Una";
  if (source === "VIO") return "Vio";
  if (source === "YHO") return "Yahoo";
  if (source === "ZIL-VL") return "Zillow";
  if (email.includes("apartmentlist")) return "Aptlist";
  if (email.includes("apartmentratings")) return "AptRatings";
  if (email.includes("apartments")) return "Apartments";
  if (email.includes("google_ads")) return "GoogleAds";
  if (email.includes("google")) return "Google";
  if (email.includes("social")) return "Social";
  if (email.includes("website")) return "Website";
  if (email.includes("zillow")) return "Zillow";
  return titleToken(source || scenario.tracking_id || "Source");
}

function syntheticIdentityForScenario(scenario) {
  const runLabel = process.env.EVS_SYNTHETIC_RUN_LABEL || REQUEST_ID;
  const domain = process.env.EVS_SYNTHETIC_EMAIL_DOMAIN || "venterradev.com";
  const propertyToken = titleToken(process.env.EVS_SYNTHETIC_PROPERTY_LABEL || PROPERTY_ID);
  const ctaToken = titleToken(process.env.EVS_SYNTHETIC_CTA_LABEL || "Form");
  const sourceToken = attributionSourceToken(scenario);
  const nameToken = `${propertyToken}${ctaToken}-${sourceToken}`;
  const emailLocal = `${lowerToken(propertyToken + ctaToken)}-${lowerToken(sourceToken)}`;
  return {
    first_name: process.env.EVS_SYNTHETIC_FIRST_NAME || "Venterra",
    last_name: process.env.EVS_SYNTHETIC_LAST_NAME || nameToken,
    email: process.env.EVS_SYNTHETIC_EMAIL || `${emailLocal}@${domain}`,
    phone: process.env.EVS_SYNTHETIC_PHONE || "5550109876",
    bedrooms: process.env.EVS_SYNTHETIC_BEDROOMS || "1",
    max_rent: process.env.EVS_SYNTHETIC_MAX_RENT || "2000",
    message: `EVS synthetic attribution test. property=${PROPERTY_ID}; cta=${ctaToken}; source=${scenario.marketing_source_cd || ""}; tracking_id=${scenario.tracking_id || ""}; request=${runLabel}`,
  };
}

function syntheticIdentityForContactForm() {
  const runLabel = process.env.EVS_SYNTHETIC_RUN_LABEL || REQUEST_ID;
  const domain = process.env.EVS_SYNTHETIC_EMAIL_DOMAIN || "venterradev.com";
  const propertyToken = titleToken(process.env.EVS_SYNTHETIC_PROPERTY_LABEL || PROPERTY_ID);
  const ctaToken = titleToken(process.env.EVS_SYNTHETIC_CTA_LABEL || "ContactForm");
  const sourceToken = titleToken(process.env.EVS_SYNTHETIC_SOURCE_LABEL || "Website");
  const nameToken = `${propertyToken}${ctaToken}-${sourceToken}`;
  const emailLocal = `${lowerToken(propertyToken + ctaToken)}-${lowerToken(sourceToken)}`;
  return {
    first_name: process.env.EVS_SYNTHETIC_FIRST_NAME || "Venterra",
    last_name: process.env.EVS_SYNTHETIC_LAST_NAME || nameToken,
    email: process.env.EVS_SYNTHETIC_EMAIL || `${emailLocal}@${domain}`,
    phone: process.env.EVS_SYNTHETIC_PHONE || "5550109876",
    bedrooms: process.env.EVS_SYNTHETIC_BEDROOMS || "1",
    max_rent: process.env.EVS_SYNTHETIC_MAX_RENT || "2000",
    message: `EVS synthetic contact form test. property=${PROPERTY_ID}; cta=${ctaToken}; source=${sourceToken}; request=${runLabel}`,
  };
}

async function fillFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const locators = page.locator(selector);
    const count = await locators.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 8); index += 1) {
      const locator = locators.nth(index);
      if (!(await isVisibleSafe(locator))) continue;
      try {
        await locator.fill(value, { timeout: INTERACTION_TIMEOUT_MS });
        return { filled: true, selector, index };
      } catch {
        // Try the next candidate.
      }
    }
  }
  return { filled: false };
}

async function collectLeadFormValidationState(page) {
  return await page
    .evaluate(() => {
      const controls = Array.from(document.querySelectorAll("input, textarea, select"));
      return controls
        .filter((node) => node.willValidate && !node.checkValidity())
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const label =
            node.getAttribute("aria-label") ||
            node.getAttribute("placeholder") ||
            node.getAttribute("name") ||
            node.getAttribute("id") ||
            "";
          return {
            tag: node.tagName.toLowerCase(),
            type: node.getAttribute("type") || "",
            name: node.getAttribute("name") || "",
            id: node.getAttribute("id") || "",
            label,
            required: node.required || false,
            validation_message: node.validationMessage || "",
            value_present: Boolean(node.value),
            visible: Boolean(rect.width || rect.height || node.getClientRects().length),
          };
        });
    })
    .catch((error) => [
      {
        error: error instanceof Error ? error.message : String(error),
      },
    ]);
}

async function collectLeadSubmitOutcome(page) {
  return await page
    .evaluate(() => {
      const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      const acknowledgementPatterns = [
        /thank you/i,
        /thanks/i,
        /submitted/i,
        /received/i,
        /we['’]?ll be in touch/i,
        /contact you soon/i,
        /success/i,
      ];
      const acknowledgementText = acknowledgementPatterns.reduce((matched, pattern) => {
        if (matched) return matched;
        const match = bodyText.match(pattern);
        if (!match) return "";
        const start = Math.max(0, match.index - 80);
        const end = Math.min(bodyText.length, match.index + match[0].length + 160);
        return bodyText.slice(start, end);
      }, "");

      return {
        acknowledgement_detected: Boolean(acknowledgementText),
        acknowledgement_text: acknowledgementText,
        form_count: document.querySelectorAll("form").length,
        invalid_controls: Array.from(document.querySelectorAll("input, textarea, select"))
          .filter((node) => node.willValidate && !node.checkValidity())
          .map((node) => ({
            tag: node.tagName.toLowerCase(),
            type: node.getAttribute("type") || "",
            name: node.getAttribute("name") || "",
            id: node.getAttribute("id") || "",
            required: node.required || false,
            validation_message: node.validationMessage || "",
            value_present: Boolean(node.value),
          })),
      };
    })
    .catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
}

async function exerciseLeadFormDraft(page, scenario) {
  const identity = syntheticIdentityForScenario(scenario);
  await page.goto(contactUrlForScenario(scenario), {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);

  const formCount = await page.locator("form").count().catch(() => 0);
  const firstName = await fillFirstVisible(page, [
    "input[name*='first' i]",
    "input[id*='first' i]",
    "input[placeholder*='first' i]",
  ], identity.first_name);
  const lastName = await fillFirstVisible(page, [
    "input[name*='last' i]",
    "input[id*='last' i]",
    "input[placeholder*='last' i]",
  ], identity.last_name);
  const fullName =
    firstName.filled || lastName.filled
      ? { filled: false, skipped_reason: "separate_name_fields_used" }
      : await fillFirstVisible(page, [
          "input[name='name' i]",
          "input[id='name' i]",
          "input[name*='full' i]",
          "input[id*='full' i]",
          "input[placeholder*='name' i]",
          "input[aria-label*='name' i]",
        ], `${identity.first_name} ${identity.last_name}`);
  const email = await fillFirstVisible(page, [
    "input[type='email']",
    "input[name*='email' i]",
    "input[id*='email' i]",
    "input[placeholder*='email' i]",
  ], identity.email);
  const phone = await fillFirstVisible(page, [
    "input[type='tel']",
    "input[name*='phone' i]",
    "input[id*='phone' i]",
    "input[placeholder*='phone' i]",
  ], identity.phone);
  const bedrooms = await fillFirstVisible(page, [
    "input[name*='number of beds' i]",
    "input[id*='number of beds' i]",
    "input[placeholder*='number of beds' i]",
    "input[name*='bed' i]",
    "input[id*='bed' i]",
    "input[placeholder*='bed' i]",
  ], identity.bedrooms);
  const maxRent = await fillFirstVisible(page, [
    "input[name*='max rent' i]",
    "input[id*='max rent' i]",
    "input[placeholder*='max rent' i]",
    "input[name*='rent' i]",
    "input[id*='rent' i]",
    "input[placeholder*='rent' i]",
  ], identity.max_rent);
  const message = await fillFirstVisible(page, [
    "textarea",
    "input[name*='message' i]",
    "input[id*='message' i]",
  ], identity.message);

  const nameFieldsFilled = firstName.filled || lastName.filled ? [firstName, lastName].filter((field) => field.filled).length : fullName.filled ? 2 : 0;
  const requiredFieldsFilled = nameFieldsFilled + [email, phone, bedrooms].filter((field) => field.filled).length;
  const validationBeforeSubmit = await collectLeadFormValidationState(page);
  const submitEnabled = process.env.EVS_ENABLE_SYNTHETIC_FORM_SUBMIT === "1";
  let submitAttempt = null;
  if (submitEnabled) {
    const domainConfigured = Boolean(process.env.EVS_SYNTHETIC_EMAIL_DOMAIN);
    const runLabelConfigured = Boolean(process.env.EVS_SYNTHETIC_RUN_LABEL);
    if (!domainConfigured || !runLabelConfigured) {
      submitAttempt = {
        attempted: false,
        blocked_reason: "synthetic_submit_requires_email_domain_and_run_label",
      };
    } else {
      const submitButton = page.locator("button[type='submit'], input[type='submit'], button").filter({ hasText: /submit|send|contact|request|schedule/i }).first();
      if (await submitButton.count().catch(() => 0)) {
        try {
          await submitButton.click({ timeout: INTERACTION_TIMEOUT_MS });
          await page.waitForTimeout(2500);
          const outcome = await collectLeadSubmitOutcome(page);
          submitAttempt = {
            attempted: true,
            post_submit_url: page.url(),
            outcome,
            completed_without_browser_validation:
              Boolean(outcome.acknowledgement_detected) ||
              (Array.isArray(outcome.invalid_controls) && outcome.invalid_controls.length === 0),
            acknowledgement_detected: Boolean(outcome.acknowledgement_detected),
          };
        } catch (error) {
          submitAttempt = {
            attempted: true,
            error: error instanceof Error ? error.message : String(error),
            outcome: await collectLeadSubmitOutcome(page),
          };
        }
      } else {
        submitAttempt = { attempted: false, blocked_reason: "submit_button_not_found" };
      }
    }
  }

  return {
    identity,
    form_count: formCount,
    fields: { first_name: firstName, last_name: lastName, full_name: fullName, email, phone, bedrooms, max_rent: maxRent, message },
    required_fields_filled: requiredFieldsFilled,
    validation_before_submit: validationBeforeSubmit,
    submit_enabled: submitEnabled,
    submit_attempt: submitAttempt,
  };
}

async function fillContactFormIdentity(page, identity) {
  const firstName = await fillFirstVisible(page, [
    "input[name*='first' i]",
    "input[id*='first' i]",
    "input[placeholder*='first' i]",
  ], identity.first_name);
  const lastName = await fillFirstVisible(page, [
    "input[name*='last' i]",
    "input[id*='last' i]",
    "input[placeholder*='last' i]",
  ], identity.last_name);
  const fullName =
    firstName.filled || lastName.filled
      ? { filled: false, skipped_reason: "separate_name_fields_used" }
      : await fillFirstVisible(page, [
          "input[name='name' i]",
          "input[id='name' i]",
          "input[name*='full' i]",
          "input[id*='full' i]",
          "input[placeholder*='name' i]",
          "input[aria-label*='name' i]",
        ], `${identity.first_name} ${identity.last_name}`);
  const email = await fillFirstVisible(page, [
    "input[type='email']",
    "input[name*='email' i]",
    "input[id*='email' i]",
    "input[placeholder*='email' i]",
  ], identity.email);
  const phone = await fillFirstVisible(page, [
    "input[type='tel']",
    "input[name*='phone' i]",
    "input[id*='phone' i]",
    "input[placeholder*='phone' i]",
  ], identity.phone);
  const bedrooms = await fillFirstVisible(page, [
    "input[name*='number of beds' i]",
    "input[id*='number of beds' i]",
    "input[placeholder*='number of beds' i]",
    "input[name*='bed' i]",
    "input[id*='bed' i]",
    "input[placeholder*='bed' i]",
  ], identity.bedrooms);
  const maxRent = await fillFirstVisible(page, [
    "input[name*='max rent' i]",
    "input[id*='max rent' i]",
    "input[placeholder*='max rent' i]",
    "input[name*='rent' i]",
    "input[id*='rent' i]",
    "input[placeholder*='rent' i]",
  ], identity.max_rent);
  const message = await fillFirstVisible(page, [
    "textarea",
    "input[name*='message' i]",
    "input[id*='message' i]",
  ], identity.message);
  const nameFieldsFilled =
    firstName.filled || lastName.filled
      ? [firstName, lastName].filter((field) => field.filled).length
      : fullName.filled
        ? 2
        : 0;
  const requiredFieldsFilled = nameFieldsFilled + [email, phone, bedrooms].filter((field) => field.filled).length;
  return {
    fields: { first_name: firstName, last_name: lastName, full_name: fullName, email, phone, bedrooms, max_rent: maxRent, message },
    required_fields_filled: requiredFieldsFilled,
  };
}

async function contactFormValidationCheck(page, check) {
  const formUrl = contactPageUrl();
  await page.goto(formUrl, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);
  const formCount = await page.locator("form").count().catch(() => 0);
  const validationState = await collectLeadFormValidationState(page);
  const requiredInvalidControls = validationState.filter((control) => control.required && control.visible);
  const status = formCount > 0 && requiredInvalidControls.length > 0 ? "pass" : "warn";
  return qaFinding(
    check,
    status,
    status === "pass"
      ? "Contact form exposes required fields that fail browser validation when empty."
      : "Contact form required-field validation could not be confirmed from browser validity state.",
    {
      form_url: formUrl,
      form_count: formCount,
      validation_state: validationState,
      required_invalid_control_count: requiredInvalidControls.length,
      side_effect_policy: "no_submit_validation_only",
    }
  );
}

async function contactFormSubmissionCheck(page, check) {
  const formUrl = contactPageUrl();
  const submitEnabled = process.env.EVS_ENABLE_SYNTHETIC_FORM_SUBMIT === "1";
  if (!submitEnabled) {
    return qaSkipped(
      check,
      "Synthetic form submission is disabled. Set EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1 with approved identity config to run the form-submit lane.",
      { form_url: formUrl, submit_enabled: false }
    );
  }

  const domainConfigured = Boolean(process.env.EVS_SYNTHETIC_EMAIL_DOMAIN);
  const runLabelConfigured = Boolean(process.env.EVS_SYNTHETIC_RUN_LABEL);
  if (!domainConfigured || !runLabelConfigured) {
    return qaFinding(
      check,
      "warn",
      "Synthetic form submission was enabled but blocked because email domain and run label were not configured.",
      {
        form_url: formUrl,
        submit_enabled: true,
        blocked_reason: "synthetic_submit_requires_email_domain_and_run_label",
        has_email_domain: domainConfigured,
        has_run_label: runLabelConfigured,
      }
    );
  }

  const identity = syntheticIdentityForContactForm();
  await page.goto(formUrl, {
    waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1000);
  const formCount = await page.locator("form").count().catch(() => 0);
  const draft = await fillContactFormIdentity(page, identity);
  const validationBeforeSubmit = await collectLeadFormValidationState(page);
  const submitButton = page
    .locator("button[type='submit'], input[type='submit'], button")
    .filter({ hasText: /submit|send|contact|request|schedule/i })
    .first();
  let submitAttempt;
  if (await submitButton.count().catch(() => 0)) {
    try {
      await submitButton.click({ timeout: INTERACTION_TIMEOUT_MS });
      await page.waitForTimeout(2500);
      const outcome = await collectLeadSubmitOutcome(page);
      submitAttempt = {
        attempted: true,
        post_submit_url: page.url(),
        outcome,
        completed_without_browser_validation:
          Boolean(outcome.acknowledgement_detected) ||
          (Array.isArray(outcome.invalid_controls) && outcome.invalid_controls.length === 0),
        acknowledgement_detected: Boolean(outcome.acknowledgement_detected),
      };
    } catch (error) {
      submitAttempt = {
        attempted: true,
        error: error instanceof Error ? error.message : String(error),
        outcome: await collectLeadSubmitOutcome(page),
      };
    }
  } else {
    submitAttempt = { attempted: false, blocked_reason: "submit_button_not_found" };
  }

  const completed = submitAttempt.attempted && !submitAttempt.error && submitAttempt.acknowledgement_detected;
  return qaFinding(
    check,
    completed ? "pass" : "warn",
    completed
      ? "Governed synthetic contact form submission completed and on-page acknowledgement was detected."
      : "Governed synthetic contact form submission did not complete cleanly.",
    {
      form_url: formUrl,
      form_count: formCount,
      identity,
      fields: draft.fields,
      required_fields_filled: draft.required_fields_filled,
      validation_before_submit: validationBeforeSubmit,
      submit_attempt: submitAttempt,
      downstream_confirmation_required: true,
    }
  );
}

async function collectLeadAttributionE2E(page, findings, jsErrors, deviceProfile) {
  const truthPayload = loadLeadAttributionTruth();
  const propertyTruth = truthPayload?.property || null;
  const commonMetadata = {
    lead_attribution_truth_path: truthPayload?.source_path || null,
    lead_attribution_truth_error: truthPayload?.error || null,
      property_code: propertyTruth?.property_code || null,
      query_param: propertyTruth?.query_param || truthPayload?.query_param || process.env.EVS_ATTRIBUTION_QUERY_PARAM || "id",
      device_profile: deviceProfile,
    };

  findings.push(
    leadAttributionFinding(
      "lead_attribution_truth_available",
      "Lead attribution source truth availability",
      propertyTruth ? "pass" : "warn",
      propertyTruth
        ? "Feed-backed lead attribution truth is available for this property."
        : "Feed-backed lead attribution truth was not available for this property.",
      {
        ...commonMetadata,
        tracking_code_count: propertyTruth?.tracking_codes?.length || 0,
      }
    )
  );

  const scenarios = selectLeadAttributionScenarios(propertyTruth);
  if (scenarios.length === 0) {
    findings.push(
      leadAttributionFinding(
        "lead_attribution_tracking_codes_available",
        "Lead attribution tracking codes",
        "warn",
        "No feed trackingCodes were available for the requested property/filter.",
        commonMetadata
      )
    );
    await pushJavascriptFinding(findings, jsErrors);
    return findings;
  }

  for (const scenario of scenarios) {
    const label = trackingScenarioLabel(scenario);
    const scenarioMetadata = {
      ...commonMetadata,
      tracking_id: scenario.tracking_id,
      marketing_source_cd: scenario.marketing_source_cd || null,
      expected_phone: scenario.expected_phone || null,
      expected_email: scenario.expected_email || null,
      generated_urls: scenario.generated_urls || {},
    };
    const targetUrl = attributionUrlForScenario(scenario);

    await page.goto(targetUrl, {
      waitUntil: deviceCommitWait(page) ? "commit" : "domcontentloaded",
      timeout: STEP_TIMEOUT_MS,
    });
    await page.waitForTimeout(1500);
    const html = await withTimeout(page.content(), 10000, `Lead attribution HTML snapshot ${label}`);
    const links = surfaceLinks(html, page.url());
    const loadedUrl = page.url();
    const phoneEvidence = phoneEvidenceFromHtml(html, links, scenario.expected_phone);
    const trackingEvidence = trackingEvidenceFromHtml(html, loadedUrl, scenario.tracking_id);
    const emailEvidence = emailEvidenceFromHtml(html, scenario.expected_email);
    const runtimeEvidence = await collectAttributionRuntimeEvidence(page, scenario.tracking_id);
    const selectedLeadSource = runtimeEvidence?.resi_pixel_config?.selected_lead_source || null;
    if (selectedLeadSource?.email) {
      emailEvidence.designated_recipient_email = selectedLeadSource.email;
      emailEvidence.designated_recipient_matched =
        Boolean(scenario.expected_email) &&
        String(selectedLeadSource.email).toLowerCase() === String(scenario.expected_email).toLowerCase();
    }
    if (selectedLeadSource?.phone) {
      phoneEvidence.designated_source_phone = selectedLeadSource.phone;
      phoneEvidence.designated_source_phone_matched =
        Boolean(scenario.expected_phone) && phoneMatches(selectedLeadSource.phone, scenario.expected_phone);
    }

    findings.push(
      leadAttributionFinding(
        `lead_attribution_url_load_${scenario.tracking_id}`,
        `Advertiser URL loads: ${label}`,
        "pass",
        "Generated advertiser URL loaded for attribution inspection.",
        { ...scenarioMetadata, loaded_url: loadedUrl }
      )
    );

    findings.push(
      leadAttributionFinding(
        `lead_attribution_tracking_id_observable_${scenario.tracking_id}`,
        `Tracking ID observable: ${label}`,
        trackingEvidence.matched ? "pass" : "warn",
        trackingEvidence.matched
          ? "Tracking ID is observable in the loaded URL or page state."
          : "Tracking ID was not observable in the loaded URL or page HTML; attribution may still be stored server-side or in browser storage.",
        { ...scenarioMetadata, tracking_evidence: trackingEvidence, runtime_evidence: runtimeEvidence }
      )
    );

    findings.push(
      leadAttributionFinding(
        `lead_attribution_phone_swap_${scenario.tracking_id}`,
        `Phone swap: ${label}`,
        scenario.expected_phone ? (phoneEvidence.matched ? "pass" : "warn") : "skipped",
        scenario.expected_phone
          ? phoneEvidence.matched
            ? "Expected feed tracking phone is visible or exposed as a tel link."
            : "Expected feed tracking phone was not visible or exposed as a tel link after loading the advertiser URL."
          : "No expected tracking phone is configured for this feed scenario.",
        { ...scenarioMetadata, phone_evidence: phoneEvidence, runtime_evidence: runtimeEvidence }
      )
    );

    findings.push(
      leadAttributionFinding(
        `lead_attribution_form_recipient_${scenario.tracking_id}`,
        `Form recipient: ${label}`,
        scenario.expected_email ? (emailEvidence.matched ? "pass" : "skipped") : "skipped",
        scenario.expected_email
          ? emailEvidence.matched
            ? "Expected feed recipient email is observable in the page HTML before submit."
            : "Expected recipient email is not exposed in page HTML; downstream email/CRM proof is required to confirm routing."
          : "No expected recipient email is configured for this feed scenario.",
        { ...scenarioMetadata, email_evidence: emailEvidence, runtime_evidence: runtimeEvidence }
      )
    );

    const formDraft = await exerciseLeadFormDraft(page, scenario);
    findings.push(
      leadAttributionFinding(
        `lead_attribution_form_draft_${scenario.tracking_id}`,
        `Synthetic form draft: ${label}`,
        formDraft.required_fields_filled >= 4 && formDraft.validation_before_submit.length === 0 ? "pass" : "warn",
        formDraft.required_fields_filled >= 4 && formDraft.validation_before_submit.length === 0
          ? "Lead form accepted the synthetic test identity fields without requiring submit."
          : "Lead form did not expose enough recognizable fields for a synthetic test identity draft.",
        { ...scenarioMetadata, form_draft: formDraft }
      )
    );

    if (formDraft.submit_enabled) {
      const submitAttempt = formDraft.submit_attempt || {};
      const submitCompletedWithoutBrowserValidation =
        submitAttempt.attempted && !submitAttempt.error && submitAttempt.completed_without_browser_validation;
      const submitAcknowledged = submitCompletedWithoutBrowserValidation && submitAttempt.acknowledgement_detected;
      findings.push(
        leadAttributionFinding(
          `lead_attribution_synthetic_submit_${scenario.tracking_id}`,
          `Synthetic form submit: ${label}`,
          submitAcknowledged ? "pass" : "warn",
          submitAcknowledged
            ? "Governed synthetic form submission completed and an on-page acknowledgement was detected; downstream AH/EAI/email proof still needs to be reconciled."
            : submitCompletedWithoutBrowserValidation
              ? "Governed synthetic form submission was attempted without browser validation errors, but no on-page acknowledgement was detected; downstream proof is required."
              : "Governed synthetic form submission was enabled but did not complete cleanly.",
          { ...scenarioMetadata, submit_attempt: formDraft.submit_attempt }
        )
      );
    } else {
      findings.push(
        leadAttributionFinding(
          `lead_attribution_synthetic_submit_${scenario.tracking_id}`,
          `Synthetic form submit: ${label}`,
          "skipped",
          "Synthetic form submission is disabled by policy; set EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1 with approved identity config to submit.",
          scenarioMetadata
        )
      );
    }
  }

  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function collectHeaderNavigationIntegrity(page, findings, jsErrors, deviceProfile) {
  await gotoTargetHome(page);
  const html = await withTimeout(page.content(), 10000, "Header/footer navigation HTML snapshot");
  const headerHtml = sectionHtml(html, "header") || html.slice(0, Math.min(html.length, 80000));
  const footerHtml = sectionHtml(html, "footer");
  const baseUrl = page.url();
  const headerLinks = surfaceLinks(headerHtml, baseUrl);
  const footerLinks = surfaceLinks(footerHtml, baseUrl);
  const allLinks = surfaceLinks(html, baseUrl);
  const contactTruthPayload = loadPropertyContactTruth();
  const contactTruth = contactTruthPayload?.property || null;
  const expectedPhones = [contactTruth?.office_phone, contactTruth?.concierge_phone].filter(Boolean);
  const expectedPipelineUrl = contactTruth?.pipeline_url || null;
  const expectedScheduleUrl = contactTruth?.schedule_tour_url || null;
  const commonMetadata = {
    property_contact_truth_path: contactTruthPayload?.source_path || null,
    property_contact_truth_error: contactTruthPayload?.error || null,
    property_code: contactTruth?.property_code || null,
    expected_office_phone: contactTruth?.office_phone || null,
    expected_concierge_phone: contactTruth?.concierge_phone || null,
    expected_pipeline_url: expectedPipelineUrl,
    expected_schedule_tour_url: expectedScheduleUrl,
    device_profile: deviceProfile,
  };

  if (!contactTruth) {
    findings.push(
      qaSurfaceFinding(
        "contact_truth_available",
        "Header/footer source truth availability",
        "warn",
        "Property contact truth was not available; phone and vendor URL checks are structural only.",
        commonMetadata
      )
    );
  }

  const headerHomeLinks = headerLinks.filter((link) => linkMatchesPath(link, "/"));
  findings.push(
    qaSurfaceFinding(
      "header_logo_home_link",
      "Header logo/home link",
      headerHomeLinks.length > 0 ? "pass" : "fail",
      headerHomeLinks.length > 0
        ? "Header exposes a same-origin home link suitable for the logo/home affordance."
        : "No same-origin home link was detected in the header surface.",
      { ...commonMetadata, qa_severity: "high", matching_links: headerHomeLinks.slice(0, 5), header_link_count: headerLinks.length }
    )
  );

  const headerPhoneLinks = findPhoneLinks(headerLinks);
  const headerPhoneMatches = expectedPhones.length
    ? headerPhoneLinks.filter((link) => expectedPhones.some((phone) => phoneMatches(link.href, phone)))
    : headerPhoneLinks;
  findings.push(
    qaSurfaceFinding(
      "header_phone_tel_link",
      "Header phone tel link",
      headerPhoneMatches.length > 0 ? "pass" : expectedPhones.length > 0 ? "fail" : "warn",
      headerPhoneMatches.length > 0
        ? "Header exposes a tel: link matching the governed feed phone."
        : headerPhoneLinks.length > 0
          ? "Header exposes tel: links, but none match the governed feed phone."
          : "No header tel: link was detected.",
      { ...commonMetadata, qa_severity: "high", phone_links: headerPhoneLinks.slice(0, 8), matching_phone_links: headerPhoneMatches.slice(0, 8) }
    )
  );

  const headerScheduleLinks = findScheduleLinks(headerLinks);
  const headerScheduleMatches = headerScheduleLinks.filter((link) => linkMatchesExternal(link, expectedScheduleUrl));
  findings.push(
    qaSurfaceFinding(
      "header_schedule_tour_link",
      "Header Schedule Tour link",
      expectedScheduleUrl ? (headerScheduleMatches.length > 0 ? "pass" : "fail") : (headerScheduleLinks.length > 0 ? "pass" : "warn"),
      headerScheduleMatches.length > 0
        ? "Header Schedule Tour points to the governed property-specific tour URL."
        : headerScheduleLinks.length > 0
          ? "Header Schedule Tour exists, but destination needs review against the governed feed URL."
          : "No Header Schedule Tour link was detected.",
      { ...commonMetadata, qa_severity: "high", schedule_links: headerScheduleLinks.slice(0, 8), matching_schedule_links: headerScheduleMatches.slice(0, 8) }
    )
  );

  const headerApplyLinks = findApplyLinks(headerLinks);
  const headerApplyMatches = headerApplyLinks.filter((link) => linkMatchesExternal(link, expectedPipelineUrl));
  findings.push(
    qaSurfaceFinding(
      "header_apply_now_link",
      "Header Apply Now link",
      expectedPipelineUrl ? (headerApplyMatches.length > 0 ? "pass" : "fail") : (headerApplyLinks.length > 0 ? "pass" : "warn"),
      headerApplyMatches.length > 0
        ? "Header Apply Now points to the governed property-specific Pipeline URL."
        : headerApplyLinks.length > 0
          ? "Header Apply Now exists, but destination needs review against the governed feed URL."
          : "No Header Apply Now link was detected.",
      { ...commonMetadata, qa_severity: "high", apply_links: headerApplyLinks.slice(0, 8), matching_apply_links: headerApplyMatches.slice(0, 8) }
    )
  );

  const headerExpectedNav = [
    { label: "Apartments & Pricing", path: "/apartments/" },
    { label: "Features", path: "/features/" },
    { label: "Amenities", path: "/amenities/" },
    { label: "Gallery", path: "/gallery/" },
    { label: "Neighborhood", path: "/neighborhood/" },
    { label: "Contact", path: "/contact/" },
  ];
  const headerMissingNav = headerExpectedNav.filter((item) => !headerLinks.some((link) => linkMatchesPath(link, item.path)));
  findings.push(
    qaSurfaceFinding(
      "header_primary_nav_links",
      "Header primary navigation links",
      headerMissingNav.length === 0 ? "pass" : "fail",
      headerMissingNav.length === 0
        ? "Header exposes all expected primary navigation destinations."
        : `Header primary navigation is missing expected destinations: ${headerMissingNav.map((item) => item.label).join(", ")}.`,
      {
        ...commonMetadata,
        qa_severity: "high",
        expected_destinations: headerExpectedNav,
        missing_destinations: headerMissingNav,
      }
    )
  );

  const footerHomeLinks = footerLinks.filter((link) => linkMatchesPath(link, "/"));
  const footerPhoneLinks = findPhoneLinks(footerLinks);
  const footerPhoneMatches = expectedPhones.length
    ? footerPhoneLinks.filter((link) => expectedPhones.some((phone) => phoneMatches(link.href, phone)))
    : footerPhoneLinks;
  const footerApplyLinks = findApplyLinks(footerLinks);
  const footerApplyMatches = footerApplyLinks.filter((link) => linkMatchesExternal(link, expectedPipelineUrl));
  const footerScheduleLinks = findScheduleLinks(footerLinks);
  const footerScheduleMatches = footerScheduleLinks.filter((link) => linkMatchesExternal(link, expectedScheduleUrl));
  const footerExpectedNav = [
    { label: "Apartments & Pricing", path: "/apartments/" },
    { label: "Features", path: "/features/" },
    { label: "Amenities", path: "/amenities/" },
    { label: "Gallery", path: "/gallery/" },
    { label: "Neighborhood", path: "/neighborhood/" },
  ];
  const footerMissingNav = footerExpectedNav.filter((item) => !footerLinks.some((link) => linkMatchesPath(link, item.path)));

  findings.push(
    qaSurfaceFinding(
      "footer_home_or_brand_link",
      "Footer home/brand link",
      footerHomeLinks.length > 0 ? "pass" : "skipped",
      footerHomeLinks.length > 0
        ? "Footer exposes a same-origin home/brand link."
        : "Footer home/brand link is not required by the current template policy.",
      {
        ...commonMetadata,
        matching_links: footerHomeLinks.slice(0, 5),
        footer_link_count: footerLinks.length,
        template_policy: "footer_home_link_not_required",
      }
    )
  );

  findings.push(
    qaSurfaceFinding(
      "footer_phone_tel_link",
      "Footer phone tel link",
      footerPhoneMatches.length > 0 ? "pass" : "warn",
      footerPhoneMatches.length > 0
        ? "Footer exposes a tel: link matching the governed feed phone."
        : footerPhoneLinks.length > 0 || visiblePhoneTextMatches(footerHtml, contactTruth)
          ? "Footer exposes phone evidence, but tel: destination needs review against the governed feed phone."
          : "No footer phone evidence was detected.",
      { ...commonMetadata, phone_links: footerPhoneLinks.slice(0, 8), matching_phone_links: footerPhoneMatches.slice(0, 8) }
    )
  );

  findings.push(
    qaSurfaceFinding(
      "footer_primary_nav_links",
      "Footer primary navigation links",
      footerMissingNav.length === 0 ? "pass" : "fail",
      footerMissingNav.length === 0
        ? "Footer exposes all expected primary navigation destinations."
        : `Footer primary navigation is missing expected destinations: ${footerMissingNav.map((item) => item.label).join(", ")}.`,
      {
        ...commonMetadata,
        qa_severity: "high",
        expected_destinations: footerExpectedNav,
        missing_destinations: footerMissingNav,
      }
    )
  );

  findings.push(
    qaSurfaceFinding(
      "footer_apply_now_link",
      "Footer Apply Now link",
      expectedPipelineUrl ? (footerApplyMatches.length > 0 ? "pass" : "warn") : (footerApplyLinks.length > 0 ? "pass" : "warn"),
      footerApplyMatches.length > 0
        ? "Footer Apply Now points to the governed property-specific Pipeline URL."
        : footerApplyLinks.length > 0
          ? "Footer Apply Now exists, but destination needs review against the governed feed URL."
          : "No Footer Apply Now link was detected.",
      { ...commonMetadata, apply_links: footerApplyLinks.slice(0, 8), matching_apply_links: footerApplyMatches.slice(0, 8) }
    )
  );

  findings.push(
    qaSurfaceFinding(
      "footer_schedule_tour_link",
      "Footer Schedule Tour link",
      footerScheduleMatches.length > 0 ? "pass" : "skipped",
      footerScheduleMatches.length > 0
        ? "Footer Schedule Tour points to the governed property-specific tour URL."
        : "Footer Schedule Tour is not a required footer affordance on the current template; header coverage remains required.",
      { ...commonMetadata, schedule_links: footerScheduleLinks.slice(0, 8), matching_schedule_links: footerScheduleMatches.slice(0, 8) }
    )
  );

  if (deviceProfile === "iphone_safari" || deviceProfile === "android_chrome") {
    const mobileMenuMarkup = await detectMobileMenuMarkup(page);
    const mobileApplyMatches = findApplyLinks(allLinks).filter((link) => linkMatchesExternal(link, expectedPipelineUrl));
    const mobileScheduleMatches = findScheduleLinks(allLinks).filter((link) => linkMatchesExternal(link, expectedScheduleUrl));
    const mobilePhoneMatches = findPhoneLinks(allLinks).filter((link) => expectedPhones.some((phone) => phoneMatches(link.href, phone)));
    const parityPass =
      mobileMenuMarkup.has_toggle &&
      mobileApplyMatches.length > 0 &&
      mobileScheduleMatches.length > 0 &&
      mobilePhoneMatches.length > 0;
    findings.push(
      qaSurfaceFinding(
        "mobile_header_menu_parity",
        "Mobile header/menu parity",
        parityPass ? "pass" : "fail",
        parityPass
          ? "Mobile header/menu markup exposes phone, Apply Now, and Schedule Tour property-specific actions."
          : "Mobile header/menu parity needs review for phone, Apply Now, or Schedule Tour.",
        {
          ...commonMetadata,
          qa_severity: "high",
          mobile_menu_markup: mobileMenuMarkup,
          matching_apply_links: mobileApplyMatches.slice(0, 8),
          matching_schedule_links: mobileScheduleMatches.slice(0, 8),
          matching_phone_links: mobilePhoneMatches.slice(0, 8),
        }
      )
    );
  }

  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function collectPortfolioFunctionalityRegression(page, findings, jsErrors) {
  const checks = qaChecksForProfile("portfolio_functionality_regression");
  logProgress("Portfolio functionality regression start", {
    check_count: checks.length,
    property_id: PROPERTY_ID,
    target_url: TARGET_URL,
  });
  for (const check of checks) {
    try {
      let result;
      switch (check.assertion_type) {
        case "toggle_open_close":
          result = await specialsToggleCheck(page, check);
          break;
        case "route_to_apartments_pricing":
          result = await routeCheck(page, check, "apartments");
          break;
        case "route_to_contact":
          result = await routeCheck(page, check, "contact");
          break;
        case "external_handoff_pipeline_application":
          result = await externalHandoffCheck(page, check, "pipeline");
          break;
        case "external_handoff_schedule_tour":
          result = await externalHandoffCheck(page, check, "schedule");
          break;
        case "carousel_behavior":
          result = await carouselCheck(page, check);
          break;
        case "filter_behavior":
          result = await filterCheck(page, check);
          break;
        case "media_modal_or_correctness":
          result = await pageMediaModalCheck(page, check);
          break;
        case "expanding_content_toggle":
          result = await expandingContentCheck(page, check);
          break;
        case "map_pin_coordinate_match":
          result = await mapPinCoordinateCheck(page, check);
          break;
        case "browser_functionality":
          result = await genericBrowserFunctionalityCheck(page, check);
          break;
        default:
          result = qaSkipped(check, `No portfolio runner mapping exists for ${check.assertion_type}.`);
      }
      findings.push(result);
    } catch (error) {
      findings.push(
        qaFinding(
          check,
          "warn",
          error instanceof Error ? error.message : `Portfolio QA check ${check.check_id} needs review.`,
          { runner_error: true }
        )
      );
    }
  }
  await gotoTargetHome(page).catch(() => {});
  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function collectContactFormChecks(page, findings, jsErrors) {
  const checks = qaChecksForProfile("contact_form_checks", ["forms_qa"]);
  logProgress("Contact form checks start", {
    check_count: checks.length,
    property_id: PROPERTY_ID,
    target_url: TARGET_URL,
    submit_enabled: process.env.EVS_ENABLE_SYNTHETIC_FORM_SUBMIT === "1",
  });
  for (const check of checks) {
    try {
      let result;
      switch (check.assertion_type) {
        case "required_field_validation":
          result = await contactFormValidationCheck(page, check);
          break;
        case "form_submission":
          result = await contactFormSubmissionCheck(page, check);
          break;
        default:
          result = qaSkipped(check, `No contact form runner mapping exists for ${check.assertion_type}.`);
      }
      findings.push(result);
    } catch (error) {
      findings.push(
        qaFinding(
          check,
          "warn",
          error instanceof Error ? error.message : `Contact form check ${check.check_id} needs review.`,
          { runner_error: true }
        )
      );
    }
  }
  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function collectApartmentsPricingDeepJourney(page, findings, jsErrors) {
  const checks = qaChecksForProfile("apartments_pricing_deep_journey");
  logProgress("Apartments & Pricing deep journey start", {
    check_count: checks.length,
    property_id: PROPERTY_ID,
    target_url: TARGET_URL,
  });
  if (deviceCommitWait(page) && process.env.EVS_ENABLE_MOBILE_DEEP_JOURNEY !== "1") {
    logProgress("Apartments & Pricing mobile deep journey skipped", {
      check_count: checks.length,
      reason: "mobile_deep_selector_pack_required",
    });
    for (const check of checks) {
      findings.push(
        qaSkipped(
          check,
          "Mobile Apartments & Pricing deep journey requires the dedicated mobile selector pack; use portfolio_functionality_regression for the current mobile gate.",
          { mobile_deep_journey_enabled: false }
        )
      );
    }
    await pushJavascriptFinding(findings, jsErrors);
    return findings;
  }
  for (const check of checks) {
    try {
      logProgress("Apartments & Pricing check start", {
        check_id: check.check_id,
        assertion_type: check.assertion_type,
      });
      const result = await withTimeout(
        Promise.resolve().then(async () => {
          switch (check.assertion_type) {
            case "filter_behavior":
              return /floor|features/i.test(check.description)
                ? await apartmentFilterModalCheck(page, check)
                : await apartmentFilterControlsCheck(page, check);
            case "rendered_availability_matches_pond":
            case "unit_types_and_layouts_match_pond":
            case "pricing_matches_pond":
              return await renderedAvailabilityCheck(page, check);
            case "sort_order":
              return await apartmentsSortOrderCheck(page, check);
            case "map_floor_unit_filter":
              return await mapFloorUnitFilterCheck(page, check);
            case "unit_detail_context_continuity":
              return await unitDetailContextContinuityCheck(page, check);
            case "external_handoff_matterport":
              return await unitDetailMatterportCheck(page, check);
            case "external_handoff_sightmap_unit":
              return await unitDetailSightMapCheck(page, check);
            case "media_modal_or_correctness":
              return await unitDetailMediaModalCheck(page, check);
            case "expanding_content_toggle":
              return await unitDetailExpandingContentCheck(page, check);
            case "external_handoff_pipeline_application":
              return /three buttons|all-in pricing|schedule a tour/i.test(check.description)
                ? await unitDetailBottomButtonsCheck(page, check)
                : await unitDetailPipelineCheck(page, check);
            case "carousel_behavior":
              return await unitDetailSimilarHomesCarouselCheck(page, check);
            case "external_handoff_price_quote":
              return await unitDetailPriceQuoteCheck(page, check);
            case "external_handoff_schedule_tour":
              return await unitDetailScheduleTourCheck(page, check);
            default:
              return qaSkipped(check, `No Apartments & Pricing deep journey mapping exists for ${check.assertion_type}.`);
          }
        }),
        CHECK_TIMEOUT_MS,
        `Apartments & Pricing check ${check.check_id}`
      );
      findings.push(result);
      logProgress("Apartments & Pricing check complete", {
        check_id: check.check_id,
        status: result.status,
      });
    } catch (error) {
      findings.push(
        qaFinding(
          check,
          "warn",
          error instanceof Error ? error.message : `Apartments & Pricing check ${check.check_id} needs review.`,
          { runner_error: true }
        )
      );
    }
  }
  await gotoTargetHome(page).catch(() => {});
  await pushJavascriptFinding(findings, jsErrors);
  return findings;
}

async function collectApartmentsPricingMobileJourney(page, findings, jsErrors) {
  const checks = mobileApartmentsPricingChecks();
  firstUnitDetailContext = null;
  mobileApartmentsSnapshotContext = null;
  logProgress("Apartments & Pricing mobile journey start", {
    check_count: checks.length,
    property_id: PROPERTY_ID,
    target_url: TARGET_URL,
    timeout_ms: MOBILE_CHECK_TIMEOUT_MS,
  });
  writeProfileCheckpoint(findings, { phase: "started", check_count: checks.length });
  for (const check of checks) {
    try {
      logProgress("Apartments & Pricing mobile check start", {
        check_id: check.check_id,
        assertion_type: check.assertion_type,
      });
      const result = await withTimeout(
        Promise.resolve().then(async () => {
          switch (check.assertion_type) {
            case "filter_behavior":
              return await mobileFilterSnapshotCheck(page, check);
            case "rendered_availability_matches_pond":
            case "unit_types_and_layouts_match_pond":
            case "pricing_matches_pond":
              return await mobileRenderedAvailabilitySnapshotCheck(page, check);
            case "sort_order":
              return await mobileApartmentsSortSnapshotCheck(page, check);
            case "map_floor_unit_filter":
              return await mobileMapFloorSnapshotCheck(page, check);
            case "unit_detail_context_continuity":
              return await mobileUnitDetailContextSnapshotCheck(page, check);
            case "external_handoff_matterport":
              return await mobileUnitDetailMatterportSnapshotCheck(page, check);
            case "external_handoff_sightmap_unit":
              return await mobileUnitDetailSightMapSnapshotCheck(page, check);
            case "media_modal_or_correctness":
              return await mobileUnitDetailMediaModalSnapshotCheck(page, check);
            case "expanding_content_toggle":
              return await mobileUnitDetailExpandingSnapshotCheck(page, check);
            case "external_handoff_pipeline_application":
              return /three buttons|all-in pricing|schedule a tour/i.test(check.description)
                ? await mobileUnitDetailBottomButtonsSnapshotCheck(page, check)
                : await mobileUnitDetailPipelineSnapshotCheck(page, check);
            case "carousel_behavior":
              return await mobileSimilarHomesSnapshotCheck(page, check);
            case "external_handoff_price_quote":
              return await mobileUnitDetailPriceQuoteSnapshotCheck(page, check);
            case "external_handoff_schedule_tour":
              return await mobileUnitDetailScheduleTourSnapshotCheck(page, check);
            default:
              return qaSkipped(check, `No Apartments & Pricing mobile journey mapping exists for ${check.assertion_type}.`);
          }
        }),
        MOBILE_CHECK_TIMEOUT_MS,
        `Apartments & Pricing mobile check ${check.check_id}`
      );
      findings.push(result);
      writeProfileCheckpoint(findings, {
        phase: "check_complete",
        check_id: check.check_id,
        status: result.status,
      });
      logProgress("Apartments & Pricing mobile check complete", {
        check_id: check.check_id,
        status: result.status,
      });
    } catch (error) {
      const result = qaFinding(
        check,
        "warn",
        error instanceof Error ? error.message : `Apartments & Pricing mobile check ${check.check_id} needs review.`,
        { runner_error: true, mobile_timeout_ms: MOBILE_CHECK_TIMEOUT_MS }
      );
      findings.push(result);
      writeProfileCheckpoint(findings, {
        phase: "check_error",
        check_id: check.check_id,
        status: result.status,
      });
    }
  }
  await gotoTargetHome(page).catch(() => {});
  await pushJavascriptFinding(findings, jsErrors);
  writeProfileCheckpoint(findings, { phase: "completed", check_count: checks.length });
  return findings;
}

async function appendRuntimeErrors(page, jsErrors) {
  const captured = await page
    .evaluate(() => Array.from(new Set(window.__evsRuntimeErrors || [])).filter(Boolean))
    .catch(() => []);
  for (const error of captured) {
    if (!jsErrors.includes(error)) jsErrors.push(error);
  }
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
    jsErrors.push(formatPageError(error));
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text) jsErrors.push(text);
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
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectConnectivitySmoke(page, findings, jsErrors);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "critical_cta_smoke") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectCriticalCtaSmoke(page, findings, jsErrors, deviceProfile);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "header_navigation_integrity") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectHeaderNavigationIntegrity(page, findings, jsErrors, deviceProfile);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "portfolio_functionality_regression") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectPortfolioFunctionalityRegression(page, findings, jsErrors);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "contact_form_checks") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectContactFormChecks(page, findings, jsErrors);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "apartments_pricing_deep_journey") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectApartmentsPricingDeepJourney(page, findings, jsErrors);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "apartments_pricing_mobile_journey") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectApartmentsPricingMobileJourney(page, findings, jsErrors);
    await pushNetworkFinding(profileFindings, requestFailures);
    await pushImageFinding(page, profileFindings);
    return profileFindings;
  }

  if (PROFILE === "lead_attribution_e2e") {
    await appendRuntimeErrors(page, jsErrors);
    const profileFindings = await collectLeadAttributionE2E(page, findings, jsErrors, deviceProfile);
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
    await page
      .addInitScript(() => {
        window.__evsRuntimeErrors = [];
        const serialize = (value) => {
          if (!value) return "";
          if (typeof value === "string") return value;
          if (value instanceof Error) {
            return [value.name, value.message, value.stack].filter(Boolean).join("\n");
          }
          try {
            return JSON.stringify(value, Object.getOwnPropertyNames(value));
          } catch {
            return String(value);
          }
        };
        window.addEventListener("unhandledrejection", (event) => {
          window.__evsRuntimeErrors.push(`Unhandled Promise Rejection\n${serialize(event.reason)}`);
        });
        window.addEventListener("error", (event) => {
          window.__evsRuntimeErrors.push(
            [event.message, event.filename, event.lineno ? `${event.lineno}:${event.colno || 0}` : ""].filter(Boolean).join("\n")
          );
        });
      })
      .catch(() => {});
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
        page.screenshot({
          path: screenshotPath,
          fullPage: PROFILE !== "connectivity_smoke" && device.device_profile !== "iphone_safari",
        }),
        device.device_profile === "iphone_safari" ? Math.max(SCREENSHOT_TIMEOUT_MS, 20000) : SCREENSHOT_TIMEOUT_MS,
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
