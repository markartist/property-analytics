import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const providerScript = path.join(rootDir, "providers", "browserstack", "run-experiential-playwright.mjs");
const pilotConfigPath = path.join(rootDir, "config", "pilot-properties.json");
const reportsDir = path.join(rootDir, "reports");

const profile = process.env.EVS_PROFILE || "connectivity_smoke";
const deviceProfile = process.env.BROWSERSTACK_DEVICE_PROFILE || "desktop_chrome";
const environment = process.env.EVS_ENVIRONMENT || "staging";
const propertyFilter = process.env.EVS_PROPERTY_ID || "";
const targetField = environment === "production" ? "live_url" : "staging_url";
const outputPath =
  process.env.OUTPUT_PATH ||
  path.join(reportsDir, `browserstack-pilot-${profile}-${environment}-${deviceProfile}.json`);

if (!process.env.BROWSERSTACK_USERNAME || !process.env.BROWSERSTACK_ACCESS_KEY) {
  throw new Error("BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY are required.");
}

fs.mkdirSync(reportsDir, { recursive: true });

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
    env: {
      ...process.env,
      TARGET_URL: property[targetField],
      PROPERTY_ID: property.property_id,
      REQUEST_ID: `${property.property_id}-${deviceProfile}-${Date.now()}`,
      OUTPUT_PATH: propertyOutputPath,
      EVS_PROFILE: profile,
      EVS_ENVIRONMENT: environment,
      BROWSERSTACK_DEVICE_PROFILE: deviceProfile,
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
  results,
};

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
process.stdout.write(JSON.stringify(summary, null, 2));
