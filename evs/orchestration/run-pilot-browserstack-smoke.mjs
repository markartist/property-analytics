import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const providerScript = path.join(rootDir, "providers", "browserstack", "run-experiential-playwright.mjs");
const pilotConfigPath = path.join(rootDir, "config", "pilot-properties.json");
const reportsDir = path.join(rootDir, "reports");
const pondAvailabilityExporter = path.join(repoDir, "scripts", "export_evs_pond_availability.py");
const propertyContactTruthExporter = path.join(repoDir, "scripts", "export_evs_property_contact_truth.py");
const leadAttributionTruthExporter = path.join(repoDir, "scripts", "export_evs_lead_attribution_truth.py");

const profile = process.env.EVS_PROFILE || "connectivity_smoke";
const deviceProfile = process.env.BROWSERSTACK_DEVICE_PROFILE || "desktop_chrome";
const environment = process.env.EVS_ENVIRONMENT || "staging";
const propertyFilter = process.env.EVS_PROPERTY_ID || "";
const propertyTimeoutMs = Number(process.env.BROWSERSTACK_PROPERTY_TIMEOUT_MS || 360000);
const targetField = environment === "production" ? "live_url" : "staging_url";
const outputPath =
  process.env.OUTPUT_PATH ||
  path.join(reportsDir, `browserstack-pilot-${profile}-${environment}-${deviceProfile}.json`);
let pondAvailabilityUnitsPath = process.env.POND_AVAILABILITY_UNITS_JSON_PATH || "";
let pondAvailabilityExport = null;
let propertyContactTruthPath = process.env.PROPERTY_CONTACT_TRUTH_JSON_PATH || "";
let propertyContactTruthExport = null;
let leadAttributionTruthPath = process.env.LEAD_ATTRIBUTION_TRUTH_JSON_PATH || "";
let leadAttributionTruthExport = null;

if (!process.env.BROWSERSTACK_USERNAME || !process.env.BROWSERSTACK_ACCESS_KEY) {
  throw new Error("BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY are required.");
}

fs.mkdirSync(reportsDir, { recursive: true });

if (
  !pondAvailabilityUnitsPath &&
  ["apartments_pricing_deep_journey", "apartments_pricing_mobile_journey"].includes(profile) &&
  process.env.EVS_DISABLE_POND_AVAILABILITY_EXPORT !== "1"
) {
  const generatedPondPath = path.join(
    reportsDir,
    `pond-availability-${environment}-${propertyFilter || "pilot"}-${Date.now()}.json`
  );
  const exportArgs = [pondAvailabilityExporter, "--output", generatedPondPath];
  if (propertyFilter) {
    exportArgs.push("--property-id", propertyFilter);
  }
  const exportRun = spawnSync("python3", exportArgs, {
    cwd: repoDir,
    encoding: "utf8",
  });
  pondAvailabilityExport = {
    output_path: generatedPondPath,
    exit_code: exportRun.status,
    signal: exportRun.signal || null,
    error: exportRun.error ? exportRun.error.message : null,
    stdout: exportRun.stdout?.trim() || "",
    stderr: exportRun.stderr?.trim() || "",
  };
  if (exportRun.status === 0 && fs.existsSync(generatedPondPath)) {
    pondAvailabilityUnitsPath = generatedPondPath;
  }
}

if (
  !propertyContactTruthPath &&
  profile === "header_navigation_integrity" &&
  process.env.EVS_DISABLE_PROPERTY_CONTACT_TRUTH_EXPORT !== "1"
) {
  const generatedContactPath = path.join(
    reportsDir,
    `property-contact-truth-${environment}-${propertyFilter || "pilot"}-${Date.now()}.json`
  );
  const exportArgs = [propertyContactTruthExporter, "--output", generatedContactPath];
  if (propertyFilter) {
    exportArgs.push("--property-id", propertyFilter);
  }
  const exportRun = spawnSync("python3", exportArgs, {
    cwd: repoDir,
    encoding: "utf8",
  });
  propertyContactTruthExport = {
    output_path: generatedContactPath,
    exit_code: exportRun.status,
    signal: exportRun.signal || null,
    error: exportRun.error ? exportRun.error.message : null,
    stdout: exportRun.stdout?.trim() || "",
    stderr: exportRun.stderr?.trim() || "",
  };
  if (exportRun.status === 0 && fs.existsSync(generatedContactPath)) {
    propertyContactTruthPath = generatedContactPath;
  }
}

if (
  !leadAttributionTruthPath &&
  profile === "lead_attribution_e2e" &&
  process.env.EVS_DISABLE_LEAD_ATTRIBUTION_TRUTH_EXPORT !== "1"
) {
  const generatedLeadAttributionPath = path.join(
    reportsDir,
    `lead-attribution-truth-${environment}-${propertyFilter || "pilot"}-${Date.now()}.json`
  );
  const exportArgs = [
    leadAttributionTruthExporter,
    "--output",
    generatedLeadAttributionPath,
    "--target-field",
    targetField,
    "--query-param",
    process.env.EVS_ATTRIBUTION_QUERY_PARAM || "id",
  ];
  if (propertyFilter) {
    exportArgs.push("--property-id", propertyFilter);
  }
  const exportRun = spawnSync("python3", exportArgs, {
    cwd: repoDir,
    encoding: "utf8",
  });
  leadAttributionTruthExport = {
    output_path: generatedLeadAttributionPath,
    exit_code: exportRun.status,
    signal: exportRun.signal || null,
    error: exportRun.error ? exportRun.error.message : null,
    stdout: exportRun.stdout?.trim() || "",
    stderr: exportRun.stderr?.trim() || "",
  };
  if (exportRun.status === 0 && fs.existsSync(generatedLeadAttributionPath)) {
    leadAttributionTruthPath = generatedLeadAttributionPath;
  }
}

const pilotProperties = JSON.parse(fs.readFileSync(pilotConfigPath, "utf8")).filter(
  (property) =>
    property.active &&
    property[targetField] &&
    (!propertyFilter || property.property_id === propertyFilter)
);

const results = [];
for (const property of pilotProperties) {
  const propertyOutputPath = path.join(
    reportsDir,
    `${property.property_id}-${deviceProfile}-${profile}.json`
  );
  if (fs.existsSync(propertyOutputPath)) {
    fs.unlinkSync(propertyOutputPath);
  }

  const child = spawnSync("node", [providerScript], {
    cwd: path.dirname(rootDir),
    encoding: "utf8",
    timeout: propertyTimeoutMs,
    env: {
      ...process.env,
      TARGET_URL: property[targetField],
      PROPERTY_ID: property.property_id,
      REQUEST_ID: `${property.property_id}-${deviceProfile}-${Date.now()}`,
      OUTPUT_PATH: propertyOutputPath,
      EVS_PROFILE: profile,
      EVS_ENVIRONMENT: environment,
      BROWSERSTACK_DEVICE_PROFILE: deviceProfile,
      ...(pondAvailabilityUnitsPath ? { POND_AVAILABILITY_UNITS_JSON_PATH: pondAvailabilityUnitsPath } : {}),
      ...(propertyContactTruthPath ? { PROPERTY_CONTACT_TRUTH_JSON_PATH: propertyContactTruthPath } : {}),
      ...(leadAttributionTruthPath ? { LEAD_ATTRIBUTION_TRUTH_JSON_PATH: leadAttributionTruthPath } : {}),
    },
  });

  let payload = null;
  if (fs.existsSync(propertyOutputPath)) {
    payload = JSON.parse(fs.readFileSync(propertyOutputPath, "utf8"));
  }

  results.push({
    property_id: property.property_id,
    property_name: property.property_name,
    target_url: property[targetField],
    exit_code: child.status,
    signal: child.signal || null,
    timed_out: child.error?.code === "ETIMEDOUT",
    error: child.error ? child.error.message : null,
    stdout: child.stdout?.trim() || "",
    stderr: child.stderr?.trim() || "",
    payload,
  });
}

const summary = {
  generated_at: new Date().toISOString(),
  profile,
  device_profile: deviceProfile,
  environment,
  pond_availability_export: pondAvailabilityExport,
  pond_availability_units_path: pondAvailabilityUnitsPath || null,
  property_contact_truth_export: propertyContactTruthExport,
  property_contact_truth_path: propertyContactTruthPath || null,
  lead_attribution_truth_export: leadAttributionTruthExport,
  lead_attribution_truth_path: leadAttributionTruthPath || null,
  results,
};

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
process.stdout.write(JSON.stringify(summary, null, 2));
