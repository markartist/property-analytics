#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);

function arg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function fail(payload) {
  const out = arg("--out");
  const body = { pass: false, generated_at: new Date().toISOString(), ...payload };
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${JSON.stringify(body, null, 2)}\n`);
  }
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const bundleDir = arg("--bundle-dir");
const outPath = arg("--out");
const widths = String(arg("--widths", "320,360,390,425"))
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

if (!bundleDir) fail({ reason: "--bundle-dir is required" });
if (!outPath) fail({ reason: "--out is required" });
if (!widths.length) fail({ reason: "--widths must include at least one positive number" });

const sourceDir = resolve(bundleDir);
const runtimePath = join(sourceDir, "runtime.mjs");
const manifestPath = join(sourceDir, "manifest.json");
for (const required of [runtimePath, manifestPath]) {
  if (!existsSync(required)) fail({ reason: `Bundle file is missing: ${required}`, bundle_dir: sourceDir });
}

const tempDir = mkdtempSync(join(tmpdir(), "resi-edge-consent-geometry-"));
cpSync(sourceDir, tempDir, { recursive: true });

const tempRuntimePath = join(tempDir, "runtime.mjs");
let runtime = readFileSync(tempRuntimePath, "utf8");
runtime = runtime.replace(
  'import releaseTokens from "./release-tokens.json";',
  'import releaseTokens from "./release-tokens.json" with { type: "json" };'
);
writeFileSync(tempRuntimePath, runtime);

const manifest = JSON.parse(readFileSync(join(tempDir, "manifest.json"), "utf8"));
const runtimeModule = await import(`file://${tempRuntimePath}`);
const request = new Request(`https://${manifest.target.domain}/`, {
  headers: {
    accept: "text/html",
    "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
});
const html = runtimeModule.renderMobileShell(request, manifest);
const browser = await chromium.launch({ headless: true });
const results = [];

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    deviceScaleFactor: 3,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.message }));
  await page.addInitScript(() => {
    window.zaraz = {
      consent: {
        getAll: () => ({ analytics: false, marketing: false }),
        setAll: () => {},
        sendQueuedEvents: () => {},
      },
      showConsentModal: () => {
        window.__vtrConsentModalCalled = true;
      },
    };
  });
  await page.route("**/*", (route) => {
    if (route.request().url() === `https://${manifest.target.domain}/`) {
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(`https://${manifest.target.domain}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const result = await page.evaluate(() => {
    const button = document.querySelector("#vtr-cookie-manage");
    const accept = document.querySelector("#vtr-cookie-accept");
    const notice = document.querySelector("#vtr-cookie-notice");
    const icon = document.querySelector("#vtr-cookie-icon");
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const buttonRect = rect(button);
    const centerX = buttonRect ? buttonRect.left + buttonRect.width / 2 : null;
    const centerY = buttonRect ? buttonRect.top + buttonRect.height / 2 : null;
    const hit = centerX !== null && centerY !== null ? document.elementFromPoint(centerX, centerY) : null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = Math.min(
      window.visualViewport?.height || window.innerHeight,
      document.documentElement.clientHeight || window.innerHeight,
      window.innerHeight
    );
    const noticeRect = rect(notice);
    return {
      viewportWidth,
      viewportHeight,
      compact: notice?.dataset?.vtrCompact === "1",
      text: notice?.innerText?.replace(/\s+/g, " ").trim() || "",
      noticeRect,
      iconRect: rect(icon),
      preferencesRect: buttonRect,
      acceptRect: rect(accept),
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
      noticeWithinViewport: !!noticeRect && noticeRect.left >= -1 && noticeRect.right <= viewportWidth + 1,
      preferencesInViewport:
        !!buttonRect &&
        buttonRect.left >= -1 &&
        buttonRect.right <= viewportWidth + 1 &&
        buttonRect.top >= 0 &&
        buttonRect.bottom <= viewportHeight + 2,
      preferencesHitTargetOk: !!button && !!hit && (hit === button || button.contains(hit)),
      hitTag: hit?.tagName || null,
      hitId: hit?.id || null,
      version: notice?.dataset?.vtrZarazConsentVersion || window.__vtrZarazConsentPillVersion || null,
    };
  });
  results.push({ requestedWidth: width, ...result, consoleMessages });
  await context.close();
}

await browser.close();

const failures = [];
for (const result of results) {
  const prefix = `width ${result.requestedWidth}`;
  if (!result.compact) failures.push(`${prefix}: compact consent state missing`);
  if (!result.text.includes("This website uses cookies")) failures.push(`${prefix}: consent text missing`);
  if (!result.iconRect) failures.push(`${prefix}: cookie icon missing`);
  if (result.horizontalOverflow) failures.push(`${prefix}: horizontal overflow detected`);
  if (!result.noticeWithinViewport) failures.push(`${prefix}: notice exceeds viewport`);
  if (!result.preferencesInViewport) failures.push(`${prefix}: Preferences button exceeds viewport`);
  if (!result.preferencesHitTargetOk) failures.push(`${prefix}: Preferences button hit target is obscured`);
}

const payload = {
  pass: failures.length === 0,
  generated_at: new Date().toISOString(),
  bundle_dir: sourceDir,
  property: manifest.target.property_name,
  domain: manifest.target.domain,
  runtime_version: runtimeModule.RESI_EDGE_RUNTIME_VERSION,
  failures,
  results,
};

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(resolve(outPath), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.pass ? 0 : 1);
