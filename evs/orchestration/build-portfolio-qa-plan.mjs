import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contractPath = path.join(rootDir, "config", "portfolio-functionality-qa-contract.json");
const batchesPath = path.join(rootDir, "config", "portfolio-qa-batches.json");
const pilotPropertiesPath = path.join(rootDir, "config", "pilot-properties.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "") + "/";
}

function loadUrlList(batch = null) {
  const urlListPath = process.env.QA_TARGET_URLS_FILE || "";
  const urlListJson = process.env.QA_TARGET_URLS_JSON || "";
  if (urlListPath) {
    return readJson(path.resolve(urlListPath));
  }
  if (urlListJson) {
    return JSON.parse(urlListJson);
  }
  if (batch?.target_url_list_path) {
    return readJson(path.resolve(path.dirname(rootDir), batch.target_url_list_path));
  }
  return null;
}

function resolveBatch(batchesConfig) {
  const batchId = process.env.QA_BATCH_ID || batchesConfig.default_batch_id;
  const batch = batchesConfig.batches.find((candidate) => candidate.batch_id === batchId);
  if (!batch) {
    throw new Error(`Unknown QA batch id: ${batchId}`);
  }
  return batch;
}

function resolveIncludedOwners(batch) {
  const rawOwners = process.env.QA_INCLUDE_OWNERS || "";
  const owners = rawOwners
    .split(",")
    .map((owner) => owner.trim())
    .filter(Boolean);
  if (owners.length > 0) {
    return new Set(owners);
  }
  const configured = new Set(batch.include_owners || ["evs"]);
  if (process.env.EVS_INCLUDE_FORMS === "1") {
    configured.add("forms_qa");
  }
  if (process.env.EVS_INCLUDE_LEAD_ATTRIBUTION === "1") {
    configured.add("lead_attribution_qa");
  }
  if (process.env.EVS_INCLUDE_MEDIA === "1") {
    configured.add("media_qa");
  }
  return configured;
}

function resolveTargets(batch) {
  const urlList = loadUrlList(batch);
  if (urlList) {
    if (!Array.isArray(urlList) || urlList.length === 0) {
      throw new Error("QA URL list must be a non-empty JSON array.");
    }
    return urlList.map((item, index) => {
      if (!item.target_url) {
        throw new Error(`QA URL list item ${index} is missing target_url.`);
      }
      return {
        target_id: item.property_id || `url_${index + 1}`,
        property_id: item.property_id || null,
        property_name: item.property_name || item.property_id || `URL ${index + 1}`,
        target_url: normalizeUrl(item.target_url),
        environment: item.environment || batch.environment || "production",
        source: "url_list",
        metadata: item.metadata || {},
      };
    });
  }

  if (batch.target_source !== "pilot_properties") {
    throw new Error(`Unsupported target source without URL list: ${batch.target_source}`);
  }

  const pilotProperties = readJson(pilotPropertiesPath).filter((property) => property.active);
  const requestedIds = new Set(batch.property_ids || []);
  const targetUrlField = batch.target_url_field || "live_url";
  const targets = pilotProperties
    .filter((property) => requestedIds.size === 0 || requestedIds.has(property.property_id))
    .map((property) => {
      const targetUrl = property[targetUrlField];
      if (!targetUrl) {
        throw new Error(`Pilot property ${property.property_id} is missing ${targetUrlField}.`);
      }
      return {
        target_id: property.property_id,
        property_id: property.property_id,
        property_name: property.property_name,
        target_url: normalizeUrl(targetUrl),
        environment: batch.environment || "production",
        source: "pilot_properties",
        metadata: {
          legacy_url: property.legacy_url || null,
          staging_url: property.staging_url || null,
          live_url: property.live_url || null,
          site_type: property.site_type || null,
          cohort: property.cohort || null,
        },
      };
    });

  if (targets.length === 0) {
    throw new Error(`No targets resolved for QA batch ${batch.batch_id}.`);
  }
  return targets;
}

function buildPlan() {
  const contract = readJson(contractPath);
  const batchesConfig = readJson(batchesPath);
  const batch = resolveBatch(batchesConfig);
  const targets = resolveTargets(batch);
  const includeOwners = resolveIncludedOwners(batch);
  const executableChecks = contract.checks.filter((check) => includeOwners.has(check.owner));
  const deferredChecks = contract.checks.filter((check) => !includeOwners.has(check.owner));

  if (executableChecks.length === 0) {
    throw new Error(`Batch ${batch.batch_id} has no executable checks after owner filtering.`);
  }

  const checksByProfile = executableChecks.reduce((acc, check) => {
    const profile = check.runner_profile || "portfolio_functionality_regression";
    acc[profile] ||= [];
    acc[profile].push(check.check_id);
    return acc;
  }, {});

  return {
    generated_at: new Date().toISOString(),
    batch: {
      batch_id: batch.batch_id,
      label: batch.label,
      environment: batch.environment,
      contract_id: batch.contract_id,
      target_source: loadUrlList(batch) ? "url_list" : batch.target_source,
    },
    contract: {
      contract_id: contract.contract_id,
      contract_version: contract.contract_version,
      source: contract.source,
    },
    device_profiles: batch.device_profiles || contract.default_devices,
    owner_filter: Array.from(includeOwners),
    targets,
    checks: {
      executable_count: executableChecks.length,
      deferred_count: deferredChecks.length,
      by_profile: checksByProfile,
      executable: executableChecks,
      deferred_summary: deferredChecks.reduce((acc, check) => {
        acc[check.owner] ||= 0;
        acc[check.owner] += 1;
        return acc;
      }, {}),
    },
  };
}

const plan = buildPlan();
process.stdout.write(JSON.stringify(plan, null, 2));
