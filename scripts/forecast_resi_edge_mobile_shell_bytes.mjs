#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);

function arg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function fail(payload) {
  const out = arg("--out");
  const body = {
    pass: false,
    generated_at: new Date().toISOString(),
    ...payload,
  };
  if (out) writeFileSync(resolve(out), `${JSON.stringify(body, null, 2)}\n`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const bundleDir = arg("--bundle-dir");
const outPath = arg("--out");
const maxBytes = Number(arg("--max-bytes", "40000"));
const zarazOverheadBytes = Number(arg("--zaraz-overhead-bytes", "2600"));

if (!bundleDir) fail({ reason: "--bundle-dir is required" });
if (!Number.isFinite(maxBytes) || maxBytes <= 0) fail({ reason: "--max-bytes must be a positive number" });
if (!Number.isFinite(zarazOverheadBytes) || zarazOverheadBytes < 0) {
  fail({ reason: "--zaraz-overhead-bytes must be zero or a positive number" });
}

const sourceDir = resolve(bundleDir);
const runtimePath = join(sourceDir, "runtime.mjs");
const manifestPath = join(sourceDir, "manifest.json");
const releaseTokensPath = join(sourceDir, "release-tokens.json");
const widgetPath = join(sourceDir, "resi-consent-widget", "widget.mjs");

for (const required of [runtimePath, manifestPath, releaseTokensPath, widgetPath]) {
  if (!existsSync(required)) fail({ reason: `Bundle file is missing: ${required}`, bundle_dir: sourceDir });
}

const tempDir = mkdtempSync(join(tmpdir(), "resi-edge-mobile-shell-"));
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
    "user-agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
});
const html = runtimeModule.renderMobileShell(request, manifest);
const renderedBytes = Buffer.byteLength(html);
const forecastLiveBytes = renderedBytes + zarazOverheadBytes;
const sameDomainPattern = new RegExp(`https://${String(manifest.target.domain).replace(/\./g, "\\.")}`, "g");
const payload = {
  pass: forecastLiveBytes <= maxBytes,
  generated_at: new Date().toISOString(),
  bundle_dir: sourceDir,
  property: manifest.target.property_name,
  domain: manifest.target.domain,
  runtime_version: runtimeModule.RESI_EDGE_RUNTIME_VERSION,
  max_bytes: maxBytes,
  rendered_initial_html_bytes: renderedBytes,
  zaraz_overhead_bytes: zarazOverheadBytes,
  forecast_live_initial_html_bytes: forecastLiveBytes,
  initial_html_bytes: forecastLiveBytes,
  initial_html_chars: html.length,
  drawer_links_rendered: (html.match(/drawer_nav_/g) || []).length,
  same_domain_absolute_url_count: (html.match(sameDomainPattern) || []).length,
};

if (outPath) writeFileSync(resolve(outPath), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.pass ? 0 : 1);
