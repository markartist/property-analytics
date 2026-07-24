#!/usr/bin/env node
import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME =
  process.env.CHROME_BINARY ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TARGETS = [
  { key: "home", label: "Homepage", url: "https://pilot.venterradev.com/" },
  { key: "apartments", label: "Apartments", url: "https://pilot.venterradev.com/apartments/" }
];

const PROFILES = [
  {
    key: "mobile",
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123 Mobile/15E148 Safari/604.1"
  },
  {
    key: "desktop",
    width: 1365,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
  }
];

function parseArgs(argv) {
  const args = {
    phase: "baseline",
    outDir: null,
    runs: 3,
    curlRuns: 5,
    waitMs: 5000,
    psi: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--phase") args.phase = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--runs") args.runs = Number(argv[++i]);
    else if (arg === "--curl-runs") args.curlRuns = Number(argv[++i]);
    else if (arg === "--wait-ms") args.waitMs = Number(argv[++i]);
    else if (arg === "--psi") args.psi = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.outDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "");
    args.outDir = `reports/resi_edge_performance/${stamp}/${args.phase}`;
  }
  args.outDir = resolve(args.outDir);
  return args;
}

function ensureDirs(outDir) {
  for (const name of ["html", "headers", "screenshots", "psi"]) {
    mkdirSync(join(outDir, name), { recursive: true });
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr, code });
      } else {
        reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
      }
    });
  });
}

function median(values) {
  const nums = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function avg(values) {
  const nums = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function pct(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 10;
}

function ms(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : null;
}

function htmlInventory(html) {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] || "";
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const stylesheetLinks = linkTags
    .filter((tag) => /rel\s*=\s*["'][^"']*stylesheet/i.test(tag))
    .map((tag) => attr(tag, "href"))
    .filter(Boolean);
  const preloadLinks = linkTags
    .filter((tag) => /rel\s*=\s*["'][^"']*preload/i.test(tag))
    .map((tag) => ({ href: attr(tag, "href"), as: attr(tag, "as"), tag }));
  const preconnectLinks = linkTags
    .filter((tag) => /rel\s*=\s*["'][^"']*preconnect/i.test(tag))
    .map((tag) => ({ href: attr(tag, "href"), tag }));
  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  const headScriptTags = [...head.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const dataSrcs = [...html.matchAll(/data-src\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const damImgs = imgTags.map((tag) => attr(tag, "src")).filter((src) => src?.startsWith("https://dam.getresi.co/"));
  const blockingHeadScripts = headScriptTags
    .filter((tag) => !/\bdefer\b/i.test(tag) && !/\basync\b/i.test(tag))
    .map((tag) => attr(tag, "src"))
    .filter(Boolean);
  const duplicateStylesheets = Object.entries(
    stylesheetLinks.reduce((memo, href) => {
      const clean = href.replace(/[?#].*$/, "");
      memo[clean] = (memo[clean] || 0) + 1;
      return memo;
    }, {})
  )
    .filter(([, count]) => count > 1)
    .map(([href, count]) => ({ href, count }));

  return {
    htmlBytes: Buffer.byteLength(html),
    gzipBytes: gzipSync(Buffer.from(html)).length,
    headBytes: Buffer.byteLength(head),
    stylesheetCount: stylesheetLinks.length,
    stylesheetLinks,
    duplicateStylesheets,
    scriptTagCount: scriptTags.length,
    headScriptCount: headScriptTags.length,
    blockingHeadScriptCount: blockingHeadScripts.length,
    blockingHeadScripts,
    imgTagCount: imgTags.length,
    damImgCount: damImgs.length,
    firstDamImages: damImgs.slice(0, 12),
    dataSrcCount: dataSrcs.length,
    firstDataSrcs: dataSrcs.slice(0, 8),
    preloadLinks,
    preconnectLinks,
    edgePerfMarkers: (html.match(/data-edge-perf=/g) || []).length,
    edgeLcpBgMarkers: (html.match(/data-edge-lcp-bg=/g) || []).length,
    popupMarkers: (html.match(/data-edge-message=/g) || []).length
  };
}

async function collectCurl(target, outDir, runs) {
  const rows = [];
  for (let i = 1; i <= runs; i += 1) {
    const bodyPath = join(outDir, "html", `${target.key}-curl-${i}.html`);
    const headerPath = join(outDir, "headers", `${target.key}-curl-${i}.txt`);
    const format = [
      "http_code=%{http_code}",
      "remote_ip=%{remote_ip}",
      "num_redirects=%{num_redirects}",
      "time_namelookup=%{time_namelookup}",
      "time_connect=%{time_connect}",
      "time_appconnect=%{time_appconnect}",
      "time_starttransfer=%{time_starttransfer}",
      "time_total=%{time_total}",
      "size_download=%{size_download}",
      "speed_download=%{speed_download}"
    ].join("\\n");
    const { stdout } = await runCommand("curl", [
      "-sS",
      "-L",
      "-H",
      "Cache-Control: no-cache",
      "-H",
      "Pragma: no-cache",
      "-D",
      headerPath,
      "-o",
      bodyPath,
      "-w",
      format,
      target.url
    ]);
    const metrics = Object.fromEntries(
      stdout
        .trim()
        .split(/\n/)
        .map((line) => {
          const idx = line.indexOf("=");
          const key = line.slice(0, idx);
          const raw = line.slice(idx + 1);
          const num = Number(raw);
          return [key, Number.isFinite(num) ? num : raw];
        })
    );
    const headers = readFileSync(headerPath, "utf8");
    const html = readFileSync(bodyPath, "utf8");
    rows.push({
      run: i,
      bodyPath,
      headerPath,
      headers: {
        cfCacheStatus: headers.match(/^cf-cache-status:\s*(.*)$/im)?.[1] || null,
        cfRay: headers.match(/^cf-ray:\s*(.*)$/im)?.[1] || null,
        serverTiming: headers.match(/^server-timing:\s*(.*)$/im)?.[1] || null,
        link: headers.match(/^link:\s*(.*)$/im)?.[1] || null,
        cacheControl: headers.match(/^cache-control:\s*(.*)$/im)?.[1] || null,
        contentEncoding: headers.match(/^content-encoding:\s*(.*)$/im)?.[1] || null,
        contentType: headers.match(/^content-type:\s*(.*)$/im)?.[1] || null
      },
      metrics,
      inventory: i === 1 ? htmlInventory(html) : undefined
    });
  }
  return {
    runs: rows,
    median: {
      ttfbMs: ms(median(rows.map((row) => row.metrics.time_starttransfer * 1000))),
      totalMs: ms(median(rows.map((row) => row.metrics.time_total * 1000))),
      downloadBytes: ms(median(rows.map((row) => row.metrics.size_download))),
      speedDownload: ms(median(rows.map((row) => row.metrics.speed_download)))
    },
    firstInventory: rows[0]?.inventory || null
  };
}

const sleep = (delay) => new Promise((resolvePromise) => setTimeout(resolvePromise, delay));

async function getJson(path, port, options = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, options);
  if (!res.ok) throw new Error(`Chrome endpoint ${path} returned ${res.status}`);
  return res.json();
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          msg.error ? pending.reject(new Error(JSON.stringify(msg.error))) : pending.resolve(msg.result);
        }
      } else {
        this.events.push(msg);
      }
    });
  }

  async open() {
    if (this.ws.readyState === this.ws.OPEN) return;
    await new Promise((resolvePromise, reject) => {
      this.ws.addEventListener("open", resolvePromise, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject }));
  }

  async waitFor(method, timeoutMs = 25000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = this.events.findIndex((event) => event.method === method);
      if (idx >= 0) return this.events.splice(idx, 1)[0];
      await sleep(50);
    }
    return null;
  }

  close() {
    this.ws.close();
  }
}

async function waitForChrome(port) {
  for (let i = 0; i < 60; i += 1) {
    try {
      return await getJson("/json/version", port);
    } catch {
      await sleep(150);
    }
  }
  throw new Error("Chrome debug endpoint did not start");
}

async function collectBrowserRun(target, profile, outDir, runIndex, waitMs) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const userDataDir = mkdtempSync(join(tmpdir(), "resi-edge-bench-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank"
  ], { stdio: "ignore" });

  try {
    await waitForChrome(port);
    const targetPage = await getJson(`/json/new?${encodeURIComponent("about:blank")}`, port, { method: "PUT" })
      .catch(() => getJson(`/json/new?${encodeURIComponent("about:blank")}`, port));
    const cdp = new CDP(targetPage.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: profile.width,
      height: profile.height,
      deviceScaleFactor: profile.deviceScaleFactor,
      mobile: profile.mobile
    });
    await cdp.send("Emulation.setUserAgentOverride", {
      userAgent: profile.userAgent,
      platform: profile.mobile ? "iPhone" : "MacIntel"
    });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__edgeBench = { lcpEntries: [], clsEntries: [], longTasks: [], paints: [] };
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const el = entry.element;
              const data = {
                startTime: entry.startTime,
                renderTime: entry.renderTime,
                loadTime: entry.loadTime,
                size: entry.size,
                url: entry.url || null,
                id: el && el.id || null,
                tagName: el && el.tagName || null,
                className: el && typeof el.className === 'string' ? el.className : null,
                text: el && el.innerText ? el.innerText.trim().slice(0, 180) : null,
                outerHTML: el && el.outerHTML ? el.outerHTML.slice(0, 1000) : null,
                currentSrc: el && (el.currentSrc || el.src) || null,
                backgroundImage: el ? getComputedStyle(el).backgroundImage : null
              };
              window.__edgeBench.lcpEntries.push(data);
              window.__edgeBench.latestLcp = data;
            }
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {}
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__edgeBench.clsEntries.push({ value: entry.value, startTime: entry.startTime });
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__edgeBench.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
            }
          }).observe({ type: 'longtask', buffered: true });
        } catch {}
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__edgeBench.paints.push({ name: entry.name, startTime: entry.startTime });
            }
          }).observe({ type: 'paint', buffered: true });
        } catch {}
      `
    });

    await cdp.send("Page.navigate", { url: target.url });
    await cdp.waitFor("Page.loadEventFired", 25000);
    await sleep(waitMs);
    const screenshotPath = join(outDir, "screenshots", `${target.key}-${profile.key}-${runIndex}.png`);
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true
    });
    if (screenshot?.data) {
      writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    }
    const evalResult = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        JSON.stringify((() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource').map((entry) => ({
            name: entry.name,
            initiatorType: entry.initiatorType || null,
            startTime: entry.startTime,
            responseEnd: entry.responseEnd,
            duration: entry.duration,
            transferSize: entry.transferSize || 0,
            encodedBodySize: entry.encodedBodySize || 0,
            decodedBodySize: entry.decodedBodySize || 0,
            renderBlockingStatus: entry.renderBlockingStatus || null,
            nextHopProtocol: entry.nextHopProtocol || null
          }));
          const cls = (window.__edgeBench.clsEntries || []).reduce((sum, entry) => sum + (entry.value || 0), 0);
          return {
            finalUrl: location.href,
            title: document.title,
            navigation: nav ? {
              startTime: nav.startTime,
              domInteractive: nav.domInteractive,
              domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
              loadEventEnd: nav.loadEventEnd,
              responseStart: nav.responseStart,
              responseEnd: nav.responseEnd,
              transferSize: nav.transferSize || 0,
              encodedBodySize: nav.encodedBodySize || 0,
              decodedBodySize: nav.decodedBodySize || 0,
              type: nav.type || null
            } : null,
            resources,
            lcp: window.__edgeBench.latestLcp || null,
            lcpEntries: window.__edgeBench.lcpEntries || [],
            cls,
            clsEntries: window.__edgeBench.clsEntries || [],
            longTaskTotalMs: (window.__edgeBench.longTasks || []).reduce((sum, entry) => sum + (entry.duration || 0), 0),
            longTaskCount: (window.__edgeBench.longTasks || []).length,
            paints: window.__edgeBench.paints || [],
            domMarkers: {
              edgePerf: document.querySelectorAll('[data-edge-perf]').length,
              edgeLcpBg: document.querySelectorAll('[data-edge-lcp-bg]').length,
              edgeMessages: document.querySelectorAll('[data-edge-message]').length,
              popupOverlay: document.querySelectorAll('#v-edge-msg-overlay').length,
              coachmark: document.querySelectorAll('#v-edge-coachmark').length,
              allInButtons: Array.from(document.querySelectorAll('a,button')).filter((el) => (el.textContent || '').includes('All-In Price & Details')).length,
              unitCards: document.querySelectorAll('[data-has_availability], .re-list-availability, .fs-switcher__item').length
            }
          };
        })())
      `
    });
    const pagePayload = JSON.parse(evalResult.result.value || "null");
    const consoleErrors = [];
    const failedRequests = [];
    const responses = [];
    for (const event of cdp.events) {
      const params = event.params || {};
      if (event.method === "Runtime.consoleAPICalled" && params.type === "error") {
        consoleErrors.push({
          type: params.type,
          text: (params.args || []).map((arg) => arg.value).filter(Boolean).join(" ").slice(0, 500)
        });
      }
      if (event.method === "Log.entryAdded" && params.entry?.level === "error") {
        consoleErrors.push({
          type: params.entry.level,
          source: params.entry.source,
          text: (params.entry.text || "").slice(0, 500)
        });
      }
      if (event.method === "Network.loadingFailed") {
        failedRequests.push({
          requestId: params.requestId,
          errorText: params.errorText,
          canceled: params.canceled,
          blockedReason: params.blockedReason
        });
      }
      if (event.method === "Network.responseReceived") {
        responses.push({
          requestId: params.requestId,
          type: params.type,
          url: params.response?.url,
          status: params.response?.status,
          mimeType: params.response?.mimeType,
          protocol: params.response?.protocol,
          headers: params.response?.headers || {}
        });
      }
    }
    cdp.close();
    return summarizeBrowserPayload({
      run: runIndex,
      target,
      profile: profile.key,
      screenshotPath,
      page: pagePayload,
      responses,
      consoleErrors,
      failedRequests
    });
  } finally {
    chrome.kill("SIGKILL");
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

function lcpUrl(lcp) {
  if (!lcp) return null;
  if (lcp.url) return lcp.url;
  if (lcp.currentSrc) return lcp.currentSrc;
  const match = typeof lcp.backgroundImage === "string" ? lcp.backgroundImage.match(/url\("?(.+?)"?\)/) : null;
  return match ? match[1] : null;
}

function summarizeBrowserPayload(payload) {
  const resources = payload.page.resources || [];
  const lcp = payload.page.lcp || null;
  const lcpResourceUrl = lcpUrl(lcp);
  const lcpResource = resources.find((row) => row.name === lcpResourceUrl) || null;
  const topByTransfer = [...resources]
    .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
    .slice(0, 15);
  const beforeLcp = [...resources]
    .filter((row) => lcp?.startTime && (row.responseEnd || 0) <= lcp.startTime)
    .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
    .slice(0, 15);
  return {
    run: payload.run,
    target: payload.target.key,
    url: payload.target.url,
    profile: payload.profile,
    screenshotPath: payload.screenshotPath,
    finalUrl: payload.page.finalUrl,
    title: payload.page.title,
    nav: payload.page.navigation,
    lcp,
    lcpUrl: lcpResourceUrl,
    lcpResource,
    paints: payload.page.paints,
    cls: payload.page.cls,
    longTaskTotalMs: payload.page.longTaskTotalMs,
    longTaskCount: payload.page.longTaskCount,
    totalTransferSize: resources.reduce((sum, row) => sum + (row.transferSize || 0), 0),
    resourceCount: resources.length,
    topRequestsByTransfer: topByTransfer,
    topRequestsBeforeLcp: beforeLcp,
    domMarkers: payload.page.domMarkers,
    responseCount: payload.responses.length,
    failedRequests: payload.failedRequests,
    consoleErrors: payload.consoleErrors,
    mainDocumentHeaders:
      payload.responses.find((row) => row.type === "Document")?.headers || {}
  };
}

async function collectBrowser(target, outDir, runs, waitMs) {
  const byProfile = {};
  for (const profile of PROFILES) {
    byProfile[profile.key] = [];
    for (let run = 1; run <= runs; run += 1) {
      byProfile[profile.key].push(await collectBrowserRun(target, profile, outDir, run, waitMs));
    }
  }
  return byProfile;
}

function summarizeBrowserRuns(runs) {
  return Object.fromEntries(
    Object.entries(runs).map(([profile, rows]) => [
      profile,
      {
        runs: rows,
        median: {
          lcpMs: ms(median(rows.map((row) => row.lcp?.startTime))),
          dclMs: ms(median(rows.map((row) => row.nav?.domContentLoadedEventEnd))),
          loadMs: ms(median(rows.map((row) => row.nav?.loadEventEnd))),
          responseStartMs: ms(median(rows.map((row) => row.nav?.responseStart))),
          resourceCount: ms(median(rows.map((row) => row.resourceCount))),
          transferBytes: ms(median(rows.map((row) => row.totalTransferSize))),
          cls: median(rows.map((row) => row.cls)),
          longTaskTotalMs: ms(median(rows.map((row) => row.longTaskTotalMs))),
          consoleErrors: ms(median(rows.map((row) => row.consoleErrors.length))),
          failedRequests: ms(median(rows.map((row) => row.failedRequests.length)))
        },
        lcpUrls: rows.map((row) => row.lcpUrl),
        lcpTags: rows.map((row) => row.lcp?.tagName || null),
        lcpTexts: rows.map((row) => row.lcp?.text || null)
      }
    ])
  );
}

async function collectPsi(target, outDir) {
  const result = {};
  for (const strategy of ["mobile", "desktop"]) {
    const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    url.searchParams.set("url", target.url);
    url.searchParams.set("strategy", strategy);
    for (const category of ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]) {
      url.searchParams.append("category", category);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(140000) });
      const payload = await res.json();
      const rawPath = join(outDir, "psi", `${target.key}-${strategy}.json`);
      writeFileSync(rawPath, JSON.stringify(payload, null, 2));
      if (!res.ok) {
        result[strategy] = { ok: false, status: res.status, rawPath, error: payload.error || payload };
        continue;
      }
      const audits = payload.lighthouseResult?.audits || {};
      const categories = payload.lighthouseResult?.categories || {};
      result[strategy] = {
        ok: true,
        rawPath,
        finalUrl: payload.lighthouseResult?.finalUrl,
        performanceScore: pct(categories.performance?.score),
        accessibilityScore: pct(categories.accessibility?.score),
        bestPracticesScore: pct(categories["best-practices"]?.score),
        seoScore: pct(categories.seo?.score),
        lcpMs: ms(audits["largest-contentful-paint"]?.numericValue),
        fcpMs: ms(audits["first-contentful-paint"]?.numericValue),
        cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
        speedIndexMs: ms(audits["speed-index"]?.numericValue),
        tbtMs: ms(audits["total-blocking-time"]?.numericValue),
        ttfbMs: ms(audits["server-response-time"]?.numericValue),
        interactiveMs: ms(audits.interactive?.numericValue),
        totalByteWeight: audits["total-byte-weight"]?.numericValue ?? null,
        networkRequests: audits["network-requests"]?.details?.items?.length ?? null,
        lcpElement:
          audits["largest-contentful-paint-element"]?.details?.items?.[0]?.node?.snippet ||
          audits["largest-contentful-paint-element"]?.details?.items?.[0]?.node?.nodeLabel ||
          null,
        lcpElementUrl: audits["largest-contentful-paint-element"]?.details?.items?.[0]?.url || null,
        renderBlockingMs: ms(audits["render-blocking-resources"]?.numericValue),
        unusedJsBytes: sumWasted(audits["unused-javascript"]),
        unusedCssBytes: sumWasted(audits["unused-css-rules"])
      };
    } catch (error) {
      result[strategy] = { ok: false, error: error.message };
    }
  }
  return result;
}

function sumWasted(audit) {
  const items = audit?.details?.items;
  if (!Array.isArray(items)) return null;
  const values = items.map((item) => item.wastedBytes).filter((value) => typeof value === "number");
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function buildMarkdown(report) {
  const lines = [];
  lines.push(`# Resi Edge Performance Benchmark - ${report.phase}`);
  lines.push("");
  lines.push(`Collected: ${report.collectedAt}`);
  lines.push("");
  for (const target of TARGETS) {
    const data = report.targets[target.key];
    lines.push(`## ${target.label}`);
    lines.push("");
    lines.push(`URL: \`${target.url}\``);
    lines.push("");
    lines.push("| Area | Metric | Value |");
    lines.push("| --- | --- | ---: |");
    lines.push(`| Curl | Median TTFB | ${data.curl.median.ttfbMs ?? "n/a"} ms |`);
    lines.push(`| Curl | Median Total | ${data.curl.median.totalMs ?? "n/a"} ms |`);
    lines.push(`| HTML | Raw bytes | ${data.curl.firstInventory?.htmlBytes ?? "n/a"} |`);
    lines.push(`| HTML | Gzip bytes | ${data.curl.firstInventory?.gzipBytes ?? "n/a"} |`);
    lines.push(`| HTML | Blocking head scripts | ${data.curl.firstInventory?.blockingHeadScriptCount ?? "n/a"} |`);
    lines.push(`| HTML | Images | ${data.curl.firstInventory?.imgTagCount ?? "n/a"} |`);
    lines.push(`| HTML | DAM images | ${data.curl.firstInventory?.damImgCount ?? "n/a"} |`);
    for (const profile of PROFILES) {
      const med = data.browserSummary[profile.key].median;
      lines.push(`| Browser ${profile.key} | Median LCP | ${med.lcpMs ?? "n/a"} ms |`);
      lines.push(`| Browser ${profile.key} | Median DCL | ${med.dclMs ?? "n/a"} ms |`);
      lines.push(`| Browser ${profile.key} | Median load | ${med.loadMs ?? "n/a"} ms |`);
      lines.push(`| Browser ${profile.key} | Median transfer | ${med.transferBytes ?? "n/a"} bytes |`);
      lines.push(`| Browser ${profile.key} | Median resource count | ${med.resourceCount ?? "n/a"} |`);
      lines.push(`| Browser ${profile.key} | Median CLS | ${med.cls ?? "n/a"} |`);
      lines.push(`| Browser ${profile.key} | Median long task total | ${med.longTaskTotalMs ?? "n/a"} ms |`);
    }
    if (data.psi) {
      for (const strategy of ["mobile", "desktop"]) {
        const psi = data.psi[strategy];
        lines.push(`| PSI ${strategy} | Performance | ${psi?.performanceScore ?? "n/a"} |`);
        lines.push(`| PSI ${strategy} | LCP | ${psi?.lcpMs ?? "n/a"} ms |`);
        lines.push(`| PSI ${strategy} | TBT | ${psi?.tbtMs ?? "n/a"} ms |`);
      }
    }
    lines.push("");
    lines.push("LCP URLs:");
    for (const profile of PROFILES) {
      const urls = [...new Set(data.browserSummary[profile.key].lcpUrls.filter(Boolean))];
      lines.push(`- ${profile.key}: ${urls.length ? urls.map((url) => `\`${url}\``).join(", ") : "n/a"}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  ensureDirs(args.outDir);
  const report = {
    phase: args.phase,
    collectedAt: new Date().toISOString(),
    outDir: args.outDir,
    config: {
      runs: args.runs,
      curlRuns: args.curlRuns,
      waitMs: args.waitMs,
      psi: args.psi
    },
    targets: {}
  };

  for (const target of TARGETS) {
    console.log(`[${args.phase}] ${target.label} curl/html`);
    const curl = await collectCurl(target, args.outDir, args.curlRuns);
    console.log(`[${args.phase}] ${target.label} browser timings`);
    const browser = await collectBrowser(target, args.outDir, args.runs, args.waitMs);
    const psi = args.psi ? (console.log(`[${args.phase}] ${target.label} PSI`), await collectPsi(target, args.outDir)) : null;
    report.targets[target.key] = {
      label: target.label,
      url: target.url,
      curl,
      browser,
      browserSummary: summarizeBrowserRuns(browser),
      psi
    };
    writeFileSync(join(args.outDir, "benchmark.json"), JSON.stringify(report, null, 2));
  }

  writeFileSync(join(args.outDir, "summary.md"), buildMarkdown(report));
  console.log(`Saved benchmark: ${join(args.outDir, "benchmark.json")}`);
  console.log(`Saved summary: ${join(args.outDir, "summary.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
