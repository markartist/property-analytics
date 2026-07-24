import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const providerScript = path.join(rootDir, "providers", "browserstack", "run-experiential-playwright.mjs");
const reportsDir = path.join(rootDir, "reports");
const matrixPath = path.join(repoDir, "config", "property_identity_matrix.json");
const pilotConfigPath = path.join(rootDir, "config", "pilot-properties.json");

const profile = "employee_photo_integrity";
const deviceProfile = process.env.BROWSERSTACK_DEVICE_PROFILE || "desktop_chrome";
const environment = process.env.EVS_ENVIRONMENT || "legacy";
const propertyFilter = new Set(
  (process.env.EVS_PROPERTY_IDS || process.env.EVS_PROPERTY_CODES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const hostFilter = process.env.EVS_LEGACY_HOST_FILTER || "venterraliving.com";
const targetScope = process.env.EVS_EMPLOYEE_PHOTO_SCOPE || "legacy";
const maxProperties = Number(process.env.EVS_MAX_PROPERTIES || 0);
const dryRun = process.env.EVS_DRY_RUN === "1";
const timestamp = new Date().toISOString().replace(/[:.]/g, "");
const runId = process.env.EVS_RUN_ID || `legacy-employee-photo-audit-${timestamp}`;
const runDir = process.env.EVS_RUN_DIR || path.join(reportsDir, runId);
const outputPath = path.join(runDir, "summary.json");
const propertyCsvPath = path.join(runDir, "employee-photo-property-summary.csv");
const missingCsvPath = path.join(runDir, "employee-photo-missing.csv");
const propertyTimeoutMs = Number(process.env.BROWSERSTACK_PROPERTY_TIMEOUT_MS || 180000);
const resiNotApplicablePropertyIds = new Set(["TX4MV", "521906919", "TX4EK"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function hostFor(rawUrl) {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "";
  }
}

function withMeetTheTeamAnchor(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "meet-the-team";
    return parsed.toString();
  } catch {
    return rawUrl.includes("#") ? rawUrl : `${rawUrl}#meet-the-team`;
  }
}

function withPath(rawUrl, pathname) {
  try {
    const parsed = new URL(rawUrl);
    parsed.pathname = pathname;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return rawUrl.replace(/\/?$/, pathname);
  }
}

function buildTargets() {
  const matrix = readJson(matrixPath);
  const includeLegacy = ["legacy", "all"].includes(targetScope);
  const includeResiMatrix = ["resi", "resi_and_pilot", "all"].includes(targetScope);
  const includePilot = ["pilot", "resi_and_pilot", "all"].includes(targetScope);
  const shouldUseHostFilter = targetScope === "legacy";
  const targets = [];

  if (includeLegacy || includeResiMatrix) {
    targets.push(
      ...(matrix.properties || [])
    .filter((property) => property.status === "active")
    .filter((property) => property.website_url)
    .filter((property) => {
      if (propertyFilter.size === 0) return true;
      return propertyFilter.has(property.property_code) || propertyFilter.has(property.canonical_property_id);
    })
    .filter((property) => {
      const isLegacyHost = hostFor(property.website_url) === "venterraliving.com";
      if (includeLegacy && !includeResiMatrix) return shouldUseHostFilter ? hostFilter === "all" || hostFor(property.website_url) === hostFilter : isLegacyHost;
      if (includeResiMatrix && !includeLegacy) {
        const propertyId = property.property_code || property.canonical_property_id;
        return !isLegacyHost && !resiNotApplicablePropertyIds.has(propertyId);
      }
      const propertyId = property.property_code || property.canonical_property_id;
      if (includeResiMatrix && !isLegacyHost && resiNotApplicablePropertyIds.has(propertyId)) return false;
      if (shouldUseHostFilter) return hostFilter === "all" || hostFor(property.website_url) === hostFilter;
      return true;
    })
    .sort((a, b) => String(a.property_name || "").localeCompare(String(b.property_name || "")))
    .map((property) => ({
      property_id: property.property_code || property.canonical_property_id,
      property_code: property.property_code || property.canonical_property_id,
      property_name: property.property_name || property.community_name || property.canonical_property_id,
      target_url: property.website_url,
      audit_url: hostFor(property.website_url) === "venterraliving.com" ? withMeetTheTeamAnchor(property.website_url) : withPath(property.website_url, "/contact/"),
      community_id: property.community_id || null,
      host: hostFor(property.website_url),
      target_kind: hostFor(property.website_url) === "venterraliving.com" ? "legacy_matrix" : "resi_contact",
    }))
    );
  }

  if (includePilot) {
    targets.push(
      ...readJson(pilotConfigPath)
        .filter((property) => property.active)
        .filter((property) => property.live_url)
        .filter((property) => {
          if (propertyFilter.size === 0) return true;
          return propertyFilter.has(property.property_id) || propertyFilter.has(property.property_name);
        })
        .sort((a, b) => String(a.property_name || "").localeCompare(String(b.property_name || "")))
        .map((property) => ({
          property_id: property.property_id,
          property_code: property.property_id,
          property_name: property.property_name,
          target_url: property.live_url,
          audit_url: property.live_url,
          community_id: null,
          host: hostFor(property.live_url),
          target_kind: "pilot_home",
        }))
    );
  }

  const deduped = [...new Map(targets.map((target) => [`${target.target_kind}:${target.property_id}:${target.audit_url}`, target])).values()];
  return maxProperties > 0 ? deduped.slice(0, maxProperties) : deduped;
}

function extractEmployeeFinding(payload) {
  const run = payload?.device_runs?.[0] || null;
  const finding = (run?.findings || []).find((item) => item.kind === "employee_photo_integrity") || null;
  return { run, finding };
}

function resultStatus(result, finding) {
  if (finding?.status) return finding.status;
  if (result.skipped) return "skipped";
  if (result.timed_out) return "timeout";
  if (result.exit_code === 0) return "missing_finding";
  return "runner_failure";
}

function issueRowsForResult(summary, result) {
  const { run, finding } = extractEmployeeFinding(result.payload);
  const metadata = finding?.metadata || {};
  const silhouetteImages = metadata.silhouette_images || [];
  const unresolvedLazyPlaceholders = metadata.unresolved_lazy_placeholders || [];
  const imagesByKey = new Map();
  for (const image of [...silhouetteImages, ...unresolvedLazyPlaceholders]) {
    const key = [image.employee_name || "", image.employee_role || "", image.url || image.src || image.lazy_src || image.background_src || ""].join("|");
    if (!imagesByKey.has(key)) imagesByKey.set(key, image);
  }

  const base = {
    property_code: result.property_code,
    property_name: result.property_name,
    target_url: result.target_url,
    audit_url: result.audit_url,
    device_profile: summary.device_profile,
    classification: run?.classification || result.classification || "",
    status: resultStatus(result, finding),
  };

  const rows = [...imagesByKey.values()].map((image) => ({
    ...base,
    employee_name: image.employee_name || "",
    employee_role: image.employee_role || "",
    issue_type: image.silhouette_detected ? "silhouette_or_placeholder" : "unresolved_lazy_placeholder",
    image_url: image.url || image.src || image.lazy_src || image.background_src || "",
    reason: [
      image.placeholder_url_match ? "placeholder_url_match" : "",
      image.visual_placeholder_match ? "visual_placeholder_match" : "",
      image.source_placeholder_match ? "source_placeholder_match" : "",
      ...(image.source_signature?.source_placeholder_reasons || []),
      image.unresolved_lazy_placeholder ? "unresolved_lazy_placeholder" : "",
    ]
      .filter(Boolean)
      .join(";"),
    card_text: image.text || "",
    message: finding?.message || result.error || "",
  }));

  if (!rows.length && finding?.status === "warn" && metadata.section?.found === false) {
    rows.push({
      ...base,
      employee_name: "",
      employee_role: "",
      issue_type: "team_section_not_detected",
      image_url: "",
      reason: metadata.section?.reason || "",
      card_text: "",
      message: finding.message || "Legacy team section was not detected.",
    });
  }

  if (!rows.length && finding?.status === "warn" && metadata.image_count === 0) {
    rows.push({
      ...base,
      employee_name: "",
      employee_role: "",
      issue_type: "no_visible_team_images",
      image_url: "",
      reason: "team_section_detected_no_images",
      card_text: metadata.section_text || "",
      message: finding.message || "Team section was detected, but no visible employee/team images were found.",
    });
  }

  return rows;
}

function writeCsv(summary) {
  const rows = [
    [
      "property_code",
      "property_name",
      "target_kind",
      "target_url",
      "audit_url",
      "device_profile",
      "classification",
      "status",
      "team_image_count",
      "silhouette_count",
      "unresolved_lazy_placeholder_count",
      "message",
      "silhouette_text_samples",
    ],
  ];

  for (const result of summary.results) {
    const { run, finding } = extractEmployeeFinding(result.payload);
    const metadata = finding?.metadata || {};
    rows.push([
      result.property_code,
      result.property_name,
      result.target_kind || "",
      result.target_url,
      result.audit_url,
      summary.device_profile,
      run?.classification || result.classification || "",
      resultStatus(result, finding),
      metadata.image_count ?? "",
      metadata.silhouette_count ?? "",
      metadata.unresolved_lazy_placeholder_count ?? "",
      finding?.message || result.error || "",
      (metadata.silhouette_images || []).map((image) => image.text || image.url || "").filter(Boolean).join(" | "),
    ]);
  }

  fs.writeFileSync(propertyCsvPath, rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n");

  const missingRows = [
    [
      "property_code",
      "property_name",
      "employee_name",
      "employee_role",
      "target_kind",
      "issue_type",
      "reason",
      "image_url",
      "target_url",
      "audit_url",
      "device_profile",
      "classification",
      "status",
      "message",
      "card_text",
    ],
  ];
  for (const result of summary.results) {
    for (const row of issueRowsForResult(summary, result)) {
      missingRows.push([
        row.property_code,
        row.property_name,
        row.employee_name,
        row.employee_role,
        result.target_kind || "",
        row.issue_type,
        row.reason,
        row.image_url,
        row.target_url,
        row.audit_url,
        row.device_profile,
        row.classification,
        row.status,
        row.message,
        row.card_text,
      ]);
    }
  }
  fs.writeFileSync(missingCsvPath, missingRows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n");
}

if (!dryRun && (!process.env.BROWSERSTACK_USERNAME || !process.env.BROWSERSTACK_ACCESS_KEY)) {
  throw new Error("BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY are required. Use run_legacy_employee_photo_audit.sh for Keeper-backed auth.");
}

fs.mkdirSync(runDir, { recursive: true });
const targets = buildTargets();
const results = [];

for (const target of targets) {
  if (dryRun) {
    results.push({
      ...target,
      skipped: true,
      reason: "EVS_DRY_RUN=1",
      payload: null,
    });
    continue;
  }

  const propertyOutputPath = path.join(runDir, `${target.property_code}-${deviceProfile}-${profile}.json`);
  const child = spawnSync("node", [providerScript], {
    cwd: repoDir,
    encoding: "utf8",
    timeout: propertyTimeoutMs,
    env: {
      ...process.env,
      TARGET_URL: target.audit_url,
      PROPERTY_ID: target.property_code,
      REQUEST_ID: `${target.property_code}-${deviceProfile}-${Date.now()}`,
      OUTPUT_PATH: propertyOutputPath,
      EVS_PROFILE: profile,
      EVS_ENVIRONMENT: environment,
      BROWSERSTACK_DEVICE_PROFILE: deviceProfile,
      BROWSERSTACK_BUILD_NAME: process.env.BROWSERSTACK_BUILD_NAME || `EVS Legacy Employee Photo Audit ${runId}`,
    },
  });

  let payload = null;
  if (fs.existsSync(propertyOutputPath)) {
    payload = JSON.parse(fs.readFileSync(propertyOutputPath, "utf8"));
  }
  const { run, finding } = extractEmployeeFinding(payload);
  results.push({
    ...target,
    output_path: propertyOutputPath,
    exit_code: child.status,
    signal: child.signal || null,
    timed_out: child.error?.code === "ETIMEDOUT",
    error: child.error ? child.error.message : null,
    classification: run?.classification || null,
    employee_photo_status: finding?.status || null,
    employee_photo_message: finding?.message || null,
    stdout: child.stdout?.trim() || "",
    stderr: child.stderr?.trim() || "",
    payload,
  });
}

const summary = {
  generated_at: new Date().toISOString(),
  run_id: runId,
  dry_run: dryRun,
  profile,
  device_profile: deviceProfile,
  environment,
  host_filter: hostFilter,
  target_scope: targetScope,
  outputs: {
    summary_json: outputPath,
    property_summary_csv: propertyCsvPath,
    missing_employee_photos_csv: missingCsvPath,
  },
  target_count: targets.length,
  run_dir: runDir,
  results,
  totals: results.reduce(
    (acc, result) => {
      const status = resultStatus(result, { status: result.employee_photo_status });
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {}
  ),
};
summary.totals.missing_issue_rows = results.reduce((acc, result) => acc + issueRowsForResult(summary, result).length, 0);

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
writeCsv(summary);
process.stdout.write(JSON.stringify({ ...summary, results: undefined }, null, 2));
