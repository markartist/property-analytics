import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const reportsDir = path.join(rootDir, "reports");
const truthExporter = path.join(repoDir, "scripts", "export_evs_lead_attribution_truth.py");
const evidencePackageScript = path.join(rootDir, "orchestration", "create-local-evidence-package.mjs");

const batchId = process.env.QA_BATCH_ID || "round_1_property_websites";
const runId = process.env.EVS_DNI_RUN_ID || `dni-phone-probe-${batchId}-${new Date().toISOString().replace(/[:.]/g, "")}`;
const runDir = path.join(reportsDir, runId);
const targetsPath = process.env.EVS_DNI_TARGETS_PATH || path.join(rootDir, "config", "round-1-qa-targets.json");
const queryParam = process.env.EVS_ATTRIBUTION_QUERY_PARAM || "id";
const sourceFilter = new Set(
  (process.env.EVS_DNI_SOURCE_FILTER || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);
const targetFilter = new Set(
  (process.env.EVS_DNI_TARGET_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const maxScenariosPerProperty = Number(process.env.EVS_DNI_MAX_SCENARIOS_PER_PROPERTY || 3);
const timeoutMs = Number(process.env.EVS_DNI_TIMEOUT_MS || 20000);
const screenshotsEnabled = process.env.EVS_DNI_SCREENSHOTS !== "0";
const dryRun = process.env.EVS_DNI_DRY_RUN === "1";

fs.mkdirSync(runDir, { recursive: true });

function log(message, metadata = {}) {
  const suffix = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : "";
  process.stderr.write(`[dni-phone-probe] ${message}${suffix}\n`);
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function phoneMatches(actual, expected) {
  const a = phoneDigits(actual);
  const e = phoneDigits(expected);
  if (!a || !e) return false;
  return a.endsWith(e) || e.endsWith(a);
}

function extractPhones(text) {
  const matches = String(text || "").match(/(?:\+?1[\s().-]*)?(?:\(?\d{3}\)?[\s().-]*)\d{3}[\s().-]*\d{4}/g) || [];
  return [...new Set(matches.map((value) => value.replace(/\s+/g, " ").trim()))];
}

function scenarioKey(property, scenario) {
  return [property.property_code || property.property_id, scenario.marketing_source_cd, scenario.tracking_id]
    .filter(Boolean)
    .join("-");
}

function loadOrExportTruth() {
  const configured = process.env.LEAD_ATTRIBUTION_TRUTH_JSON_PATH;
  if (configured && fs.existsSync(configured)) return configured;

  const output = path.join(runDir, "lead-attribution-truth.json");
  const args = [
    truthExporter,
    "--pilot-config",
    targetsPath,
    "--target-field",
    "target_url",
    "--query-param",
    queryParam,
    "--output",
    output,
  ];
  for (const target of targetFilter) args.push("--property-id", target);
  const child = spawnSync("python3", args, { cwd: repoDir, encoding: "utf8" });
  if (child.status !== 0) {
    throw new Error(child.stderr || child.stdout || `Truth export exited ${child.status}`);
  }
  return output;
}

function selectScenarios(truth) {
  const selected = [];
  for (const property of truth.properties || []) {
    if (
      targetFilter.size > 0 &&
      !targetFilter.has(property.property_id) &&
      !targetFilter.has(property.property_code) &&
      !targetFilter.has(property.property_name)
    ) {
      continue;
    }
    const scenarios = (property.tracking_codes || [])
      .filter((scenario) => scenario.expected_phone)
      .filter((scenario) => sourceFilter.size === 0 || sourceFilter.has(String(scenario.marketing_source_cd || "").toUpperCase()))
      .slice(0, Math.max(1, maxScenariosPerProperty));
    for (const scenario of scenarios) selected.push({ property, scenario });
  }
  return selected;
}

async function collectRuntime(page, trackingId) {
  return await page
    .evaluate((code) => {
      const cfg = window.resiPixelConfig || null;
      const selectedLeadSource = cfg?.leadSources?.find?.((source) => source && source.code === code) || null;
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
    .catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
}

async function inspectPage(page, url, expectedPhone, trackingId, label, screenshotPath) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch((error) => ({ error }));
  await page.waitForTimeout(1000).catch(() => undefined);
  const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const telLinks = await page
    .locator("a[href^='tel:']")
    .evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), text: link.textContent || "" })))
    .catch(() => []);
  const visiblePhones = extractPhones(bodyText);
  const runtime = await collectRuntime(page, trackingId);
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  }
  const selectedPhone = runtime?.resi_pixel_config?.selected_lead_source?.phone || null;
  const matchedVisible = visiblePhones.some((phone) => phoneMatches(phone, expectedPhone));
  const matchedTel = telLinks.some((link) => phoneMatches(link.href, expectedPhone) || phoneMatches(link.text, expectedPhone));
  const matchedRuntime = phoneMatches(selectedPhone, expectedPhone);
  return {
    label,
    requested_url: url,
    loaded_url: page.url(),
    http_status: typeof response?.status === "function" ? response.status() : null,
    response_error: response?.error ? String(response.error.message || response.error) : null,
    expected_phone: expectedPhone || null,
    visible_phones: visiblePhones,
    tel_links: telLinks,
    runtime,
    selected_source_phone: selectedPhone,
    matched_visible_phone: matchedVisible,
    matched_tel_phone: matchedTel,
    matched_runtime_phone: matchedRuntime,
    display_matched: matchedVisible || matchedTel,
    matched: matchedVisible || matchedTel,
    runtime_matched_only: !matchedVisible && !matchedTel && matchedRuntime,
    screenshot_path: screenshotPath || null,
  };
}

function resultStatus(result) {
  if (!result.expected_phone) return "skipped";
  if (result.pages.some((page) => page.display_matched)) return "pass";
  return "fail";
}

function resultMessage(result) {
  if (!result.expected_phone) return "No source-specific expected phone was configured for this scenario.";
  if (result.status === "pass") return "Expected source phone was observed in visible text or tel links.";
  if (result.pages.some((page) => page.runtime_matched_only)) {
    return "Expected source phone was selected in runtime attribution config, but the displayed/tel phone did not change.";
  }
  return "Expected source phone was not observed in visible text or tel links.";
}

function resultsCsv(results) {
  const rows = [
    [
      "property_id",
      "property_code",
      "property_name",
      "marketing_source_cd",
      "tracking_id",
      "expected_phone",
      "status",
      "message",
      "home_url",
      "contact_url",
      "home_matched",
      "contact_matched",
      "home_runtime_matched_only",
      "contact_runtime_matched_only",
      "home_visible_phones",
      "contact_visible_phones",
      "home_selected_source_phone",
      "contact_selected_source_phone",
      "home_screenshot_path",
      "contact_screenshot_path",
    ],
  ];
  for (const result of results) {
    const home = result.pages.find((page) => page.label === "home") || {};
    const contact = result.pages.find((page) => page.label === "contact") || {};
    rows.push([
      result.property_id,
      result.property_code,
      result.property_name,
      result.marketing_source_cd,
      result.tracking_id,
      result.expected_phone,
      result.status,
      result.message,
      home.loaded_url,
      contact.loaded_url,
      home.matched,
      contact.matched,
      home.runtime_matched_only,
      contact.runtime_matched_only,
      (home.visible_phones || []).join("; "),
      (contact.visible_phones || []).join("; "),
      home.selected_source_phone,
      contact.selected_source_phone,
      home.screenshot_path,
      contact.screenshot_path,
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

const truthPath = loadOrExportTruth();
const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
const selectedScenarios = selectScenarios(truth);
const results = [];

if (dryRun) {
  for (const { property, scenario } of selectedScenarios) {
    results.push({
      property_id: property.property_id,
      property_code: property.property_code,
      property_name: property.property_name,
      marketing_source_cd: scenario.marketing_source_cd || null,
      tracking_id: scenario.tracking_id,
      expected_phone: scenario.expected_phone || null,
      generated_urls: scenario.generated_urls || {},
      status: "dry_run",
      message: "Dry run; no browser inspection performed.",
      pages: [],
    });
  }
} else {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  for (const { property, scenario } of selectedScenarios) {
    const key = scenarioKey(property, scenario).replace(/[^a-zA-Z0-9_-]+/g, "-");
    log("Inspecting source phone", {
      property_id: property.property_id,
      property_code: property.property_code,
      source: scenario.marketing_source_cd,
      tracking_id: scenario.tracking_id,
    });
    const pages = [];
    for (const label of ["home", "contact"]) {
      const url = scenario.generated_urls?.[label];
      if (!url) continue;
      const screenshotPath = screenshotsEnabled ? path.join(runDir, `${key}-${label}.png`) : null;
      pages.push(await inspectPage(page, url, scenario.expected_phone, scenario.tracking_id, label, screenshotPath));
    }
    const result = {
      property_id: property.property_id,
      property_code: property.property_code,
      property_name: property.property_name,
      target_url: property.target_url,
      marketing_source_cd: scenario.marketing_source_cd || null,
      tracking_id: scenario.tracking_id,
      expected_phone: scenario.expected_phone || null,
      expected_email: scenario.expected_email || null,
      generated_urls: scenario.generated_urls || {},
      pages,
    };
    result.status = resultStatus(result);
    result.message = resultMessage(result);
    results.push(result);
  }
  await browser.close();
}

const summary = {
  generated_at: new Date().toISOString(),
  batch_id: batchId,
  run_id: runId,
  run_dir: runDir,
  side_effect_policy: "no_submit",
  truth_path: truthPath,
  targets_path: targetsPath,
  query_param: queryParam,
  source_filter: [...sourceFilter],
  target_filter: [...targetFilter],
  max_scenarios_per_property: maxScenariosPerProperty,
  screenshot_enabled: screenshotsEnabled,
  dry_run: dryRun,
  scenario_count: results.length,
  status_counts: results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {}),
  results_path: path.join(runDir, "dni-phone-probe-results.json"),
  csv_path: path.join(runDir, "dni-phone-probe-results.csv"),
};

fs.writeFileSync(summary.results_path, JSON.stringify({ ...summary, results }, null, 2));
fs.writeFileSync(summary.csv_path, resultsCsv(results));
fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

const manifestChild = spawnSync(process.execPath, [evidencePackageScript], {
  cwd: repoDir,
  encoding: "utf8",
  env: {
    ...process.env,
    QA_BATCH_ID: batchId,
    EVS_EVIDENCE_PACKAGE_ID: path.join(runDir, "local-evidence-package"),
    EVS_EVIDENCE_RUN_DIRS: runDir,
    EVS_EVIDENCE_NOTE:
      "No-submit DNI/source phone probe. The workbook remains fill-only; detailed phone/runtime evidence stays local.",
  },
});
let evidencePackage = null;
if (manifestChild.status === 0) {
  evidencePackage = JSON.parse(manifestChild.stdout);
} else {
  evidencePackage = { error: manifestChild.stderr || manifestChild.stdout || `manifest exited ${manifestChild.status}` };
}

process.stdout.write(
  JSON.stringify(
    {
      summary_path: path.join(runDir, "summary.json"),
      results_path: summary.results_path,
      csv_path: summary.csv_path,
      evidence_package: evidencePackage,
      ...summary,
    },
    null,
    2,
  ),
);
