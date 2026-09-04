#!/usr/bin/env node
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
  const body = {
    artifact_schema: "resi_edge_desktop_native_visual_gate.v1",
    pass: false,
    generated_at: new Date().toISOString(),
    ...payload,
  };
  const outPath = arg("--out");
  if (outPath) writeJson(resolve(outPath), body);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

function manifestKey(manifest) {
  const target = manifest.target || {};
  return `${slug(target.source_property_code || target.property_code)}-${slug(target.domain)}`;
}

function materializeRuntime(tempDir) {
  const releaseTokensPath = join(root, "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json");
  const runtimeSourcePath = join(root, "ops/cloudflare/shared/resi-edge-package/runtime.mjs");
  const widgetSourcePath = join(root, "ops/cloudflare/shared/resi-consent-widget/widget.mjs");
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
}

function desktopRequest(manifest) {
  return new Request(`https://${manifest.target.domain}/`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    },
  });
}

function safeDamUrl(manifest, fallbackPath) {
  const candidate = String(manifest.mobile_shell?.hero?.source_image || "");
  if (/^https:\/\/dam\.getresi\.co\/[^"'<>\\\s]+\.(?:png|jpe?g|webp|avif|svg)$/i.test(candidate)) {
    return candidate;
  }
  return `https://dam.getresi.co/${fallbackPath}`;
}

function nativeOriginHtml(manifest) {
  const heroUrl = safeDamUrl(manifest, "19636/conversions/Home-Hero-full.jpg");
  const welcomeUrl = "https://dam.getresi.co/19647/conversions/Home-Welcome-full.jpg";
  const featuresUrl = "https://dam.getresi.co/19645/conversions/Home-Features-full.jpg";
  const logoUrl = "https://dam.getresi.co/808/team.svg";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${manifest.target.property_name} Native Fixture</title>
  <style>
    html,body{margin:0;padding:0;background:#fff;color:#15284B;font-family:Arial,sans-serif}
    .tm-header{display:flex;align-items:center;gap:24px;min-height:86px;padding:0 56px;background:#fff;color:#15284B}
    .tm-header img{width:40px;height:40px}
    .native-hero{min-height:560px;background:#15284B;color:#fff;text-align:center;overflow:hidden}
    .native-hero img{display:block;width:100%;height:360px;object-fit:cover}
    .native-bg{width:min(640px,80vw);height:144px;margin:28px auto;background-size:cover;background-position:center;border-radius:4px}
    .native-card{font-size:20px;line-height:1.4}
  </style>
  <script>heap.load("676880719")</script>
</head>
<body data-property-name="Stale Native" data-property-code="STALE">
  <header class="tm-header"><img src="${logoUrl}" alt=""><strong>${manifest.target.property_name}</strong><nav><a href="/">Home</a></nav></header>
  <main>
    <section id="native-hero" class="native-hero" data-page-section="hero">
      <img id="native-hero-img" alt="${manifest.target.property_name}" src="${heroUrl}" srcset="${heroUrl} 1x, ${welcomeUrl} 2x">
      <div id="native-hero-bg" class="native-bg" style="background-image:url('${featuresUrl}')"></div>
      <p class="native-card">Native desktop source fixture.</p>
      <a href="tel:+19999999999">Call</a>
    </section>
  </main>
</body>
</html>`;
}

function pngFixture() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO88PjjfwAJiwP0j9K8jQAAAABJRU5ErkJggg==",
    "base64",
  );
}

async function responseToBuffer(response) {
  return Buffer.from(await response.arrayBuffer());
}

function startServer(runtime, manifest, desktopHtml) {
  const server = createServer(async (req, res) => {
    try {
      const localUrl = new URL(req.url || "/", "http://127.0.0.1");
      if (localUrl.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(desktopHtml);
        return;
      }
      if (localUrl.pathname === "/__resi-edge/native-dam-asset") {
        const workerUrl = new URL(localUrl.pathname + localUrl.search, `https://${manifest.target.domain}`);
        const repairResponse = await runtime.serveNativeAssetRepair(new Request(workerUrl.toString()));
        const headers = Object.fromEntries(repairResponse.headers.entries());
        res.writeHead(repairResponse.status, headers);
        res.end(await responseToBuffer(repairResponse));
        return;
      }
      res.writeHead(204);
      res.end();
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(error?.stack || String(error));
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      resolveServer({ server, port: server.address().port });
    });
  });
}

async function visualProof(runtime, manifest, desktopHtml, outDir) {
  const { server, port } = await startServer(runtime, manifest, desktopHtml);
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const requests = [];
  const failedRequests = [];
  const consoleMessages = [];
  let screenshotPath = join(outDir, "desktop.png");
  let evaluation = {};
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      isMobile: false,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("request", (request) => requests.push(request.url()));
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "failed" }));
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
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    screenshotPath = join(outDir, "desktop.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    evaluation = await page.evaluate(() => {
      const visible = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const hero = document.querySelector("#native-hero");
      const heroImg = document.querySelector("#native-hero-img");
      const heroBg = document.querySelector("#native-hero-bg");
      return {
        has_mobile_shell: Boolean(document.querySelector("[data-vtr-edge-mobile-shell='1']")),
        native_header_visible: visible(".tm-header"),
        hero_visible: visible("#native-hero"),
        hero_height: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
        hero_image_complete: Boolean(heroImg?.complete),
        hero_image_natural_width: heroImg?.naturalWidth || 0,
        hero_image_rect: heroImg ? {
          width: Math.round(heroImg.getBoundingClientRect().width),
          height: Math.round(heroImg.getBoundingClientRect().height),
        } : null,
        hero_image_src: heroImg?.currentSrc || heroImg?.src || "",
        hero_background_image: heroBg ? getComputedStyle(heroBg).backgroundImage : "",
        direct_dam_urls_in_dom: document.documentElement.outerHTML.match(/https:\/\/dam\.getresi\.co\//gi)?.length || 0,
        proxy_urls_in_dom: document.documentElement.outerHTML.match(/\/__resi-edge\/native-dam-asset/gi)?.length || 0,
        consent_visible: visible("#vtr-cookie-notice"),
      };
    });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  const directDamNetwork = requests.filter((url) => /^https:\/\/dam\.getresi\.co\//i.test(url));
  const proxyNetwork = requests.filter((url) => /\/__resi-edge\/native-dam-asset/i.test(url));
  const proxyFailures = failedRequests.filter((row) => /\/__resi-edge\/native-dam-asset/i.test(row.url));
  if (evaluation.has_mobile_shell) failures.push("desktop rendered an edge mobile shell");
  if (!evaluation.native_header_visible) failures.push("native desktop header did not paint");
  if (!evaluation.hero_visible || evaluation.hero_height < 420) failures.push(`native hero did not paint at expected size: ${evaluation.hero_height || 0}`);
  if (!evaluation.hero_image_complete || evaluation.hero_image_natural_width < 1) failures.push("native hero image did not load through the repair proxy");
  if ((evaluation.hero_image_rect?.height || 0) < 240) failures.push("native hero image box was not visible in desktop viewport");
  if (evaluation.direct_dam_urls_in_dom !== 0) failures.push(`desktop DOM still contains ${evaluation.direct_dam_urls_in_dom} direct DAM URLs`);
  if (evaluation.proxy_urls_in_dom < 3) failures.push(`desktop DOM contains only ${evaluation.proxy_urls_in_dom} DAM proxy URLs`);
  if (directDamNetwork.length > 0) failures.push(`browser attempted ${directDamNetwork.length} direct DAM requests`);
  if (proxyNetwork.length < 2) failures.push(`browser attempted only ${proxyNetwork.length} DAM proxy requests`);
  if (proxyFailures.length > 0) failures.push(`browser had ${proxyFailures.length} failed DAM proxy requests`);
  return {
    pass: failures.length === 0,
    failures,
    screenshot: screenshotPath,
    evaluation,
    network: {
      request_count: requests.length,
      direct_dam_requests: directDamNetwork,
      proxy_request_count: proxyNetwork.length,
      failed_requests: failedRequests,
    },
    console_messages: consoleMessages,
  };
}

const manifestArg = arg("--manifest", "config/portfolio_resi_edge_stabilization/anatoleatnorman-com.manifest.json");
const manifestPath = resolve(root, manifestArg);
if (!existsSync(manifestPath)) fail({ reason: `Manifest not found: ${manifestPath}` });
const manifest = readJson(manifestPath);
const key = manifestKey(manifest);
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outDir = resolve(arg("--out-dir", join(root, "reports/resi_edge_performance/desktop-native-visual-gate", key, runId)));
mkdirSync(outDir, { recursive: true });
const latestPath = join(root, "reports/resi_edge_performance/desktop-native-visual-gate", key, "latest-desktop-native-visual-gate.json");

const tempDir = mkdtempSync(join(tmpdir(), "resi-edge-desktop-native-gate-"));
materializeRuntime(tempDir);
const runtime = await import(`file://${join(tempDir, "runtime.mjs")}`);
const imageBody = pngFixture();
const originalFetch = globalThis.fetch;
globalThis.fetch = async (request) => {
  const url = typeof request === "string" ? request : request.url;
  const urlText = String(url);
  if (urlText.startsWith(`https://${manifest.target.domain}`)) {
    return new Response(nativeOriginHtml(manifest), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (/^https:\/\/dam\.getresi\.co\//i.test(urlText)) {
    return new Response(imageBody, {
      status: 200,
      headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
    });
  }
  return new Response("", { status: 404 });
};

try {
  const desktopResponse = await runtime.renderDesktopPassthrough(desktopRequest(manifest), manifest);
  const desktopHtml = await desktopResponse.text();
  const routeChecks = [];
  const proxyUrls = [...desktopHtml.matchAll(/\/__resi-edge\/native-dam-asset\?src=[^"'<>\\)\s]+/gi)].map((match) => match[0]);
  for (const proxyPath of proxyUrls.slice(0, 5)) {
    const repairUrl = new URL(proxyPath, `https://${manifest.target.domain}`);
    const repairResponse = await runtime.serveNativeAssetRepair(new Request(repairUrl.toString()));
    routeChecks.push({
      url: repairUrl.toString(),
      status: repairResponse.status,
      header: repairResponse.headers.get("x-vtr-native-asset-repair"),
      content_type: repairResponse.headers.get("content-type"),
    });
    await repairResponse.arrayBuffer();
  }
  const visual = await visualProof(runtime, manifest, desktopHtml, outDir);
  const directDamCount = (desktopHtml.match(/https:\/\/dam\.getresi\.co\//gi) || []).length;
  const failures = [];
  if (desktopResponse.status !== 200) failures.push(`desktop response status was ${desktopResponse.status}`);
  if (desktopResponse.headers.get("x-vtr-desktop-mode") !== "native-passthrough") failures.push("desktop response did not carry native-passthrough mode header");
  if (desktopHtml.includes('data-vtr-edge-mobile-shell="1"')) failures.push("desktop response contained mobile shell markup");
  if (directDamCount !== 0) failures.push(`desktop response still contains ${directDamCount} direct DAM URLs`);
  if (proxyUrls.length < 3) failures.push(`desktop response contains only ${proxyUrls.length} DAM proxy URLs`);
  for (const check of routeChecks) {
    if (check.status < 200 || check.status >= 300) failures.push(`DAM proxy returned ${check.status}: ${check.url}`);
    if (check.header !== "dam-proxy") failures.push(`DAM proxy header missing for ${check.url}`);
  }
  failures.push(...visual.failures);
  const payload = {
    artifact_schema: "resi_edge_desktop_native_visual_gate.v1",
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
    thin_worker_sha256: sha256File(join(root, "ops/cloudflare/resi-edge-thin-property-worker/worker.js")),
    canonical_worker_sha256: sha256File(join(root, "ops/cloudflare/resi-edge-canonical-worker/worker.js")),
    desktop_response: {
      status: desktopResponse.status,
      x_vtr_desktop_mode: desktopResponse.headers.get("x-vtr-desktop-mode"),
      direct_dam_url_count: directDamCount,
      proxy_url_count: proxyUrls.length,
      bytes: Buffer.byteLength(desktopHtml),
    },
    route_checks: routeChecks,
    visual,
    failures,
  };
  writeJson(join(outDir, "desktop-native-visual-gate.json"), payload);
  writeJson(latestPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.pass ? 0 : 3);
} finally {
  globalThis.fetch = originalFetch;
}
