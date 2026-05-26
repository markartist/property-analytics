import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const buildPlanScript = path.join(rootDir, "orchestration", "build-portfolio-qa-plan.mjs");
const providerScript = path.join(rootDir, "providers", "browserstack", "run-experiential-playwright.mjs");
const evidencePackageScript = path.join(rootDir, "orchestration", "create-local-evidence-package.mjs");
const reportsDir = path.join(rootDir, "reports");
const pondAvailabilityExporter = path.join(repoDir, "scripts", "export_evs_pond_availability.py");
const propertyContactTruthExporter = path.join(repoDir, "scripts", "export_evs_property_contact_truth.py");
const leadAttributionTruthExporter = path.join(repoDir, "scripts", "export_evs_lead_attribution_truth.py");

const batchId = process.env.QA_BATCH_ID || "round_1_property_websites";
const runId = process.env.EVS_BATCH_RUN_ID || `${batchId}-${new Date().toISOString().replace(/[:.]/g, "")}`;
const propertyTimeoutMs = Number(process.env.BROWSERSTACK_PROPERTY_TIMEOUT_MS || 360000);
const dryRun = process.env.EVS_DRY_RUN === "1";
const formsEnabled =
  process.env.EVS_INCLUDE_FORMS === "1" ||
  (process.env.QA_INCLUDE_OWNERS || "")
    .split(",")
    .map((owner) => owner.trim())
    .includes("forms_qa");
const targetFilter = new Set(
  (process.env.EVS_TARGET_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const profileFilter = (process.env.EVS_RUN_PROFILES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const deviceFilter = (process.env.EVS_RUN_DEVICE_PROFILES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

fs.mkdirSync(reportsDir, { recursive: true });

function log(message, metadata = {}) {
  const suffix = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : "";
  process.stderr.write(`[portfolio-qa-batch] ${message}${suffix}\n`);
}

function runJson(command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: repoDir,
    encoding: "utf8",
    env: { ...process.env, QA_BATCH_ID: batchId, ...(options.env || {}) },
    timeout: options.timeout,
  });
  if (child.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${child.status}: ${child.stderr || child.stdout || child.error?.message || ""}`
    );
  }
  return JSON.parse(child.stdout);
}

function exportPropertyContactTruth(target = null) {
  if (process.env.PROPERTY_CONTACT_TRUTH_JSON_PATH) {
    return { PROPERTY_CONTACT_TRUTH_JSON_PATH: process.env.PROPERTY_CONTACT_TRUTH_JSON_PATH };
  }
  const output = path.join(
    reportsDir,
    `property-contact-truth-${batchId}-${target?.property_id || target?.target_id || "all"}-${Date.now()}.json`
  );
  const args = [propertyContactTruthExporter, "--output", output];
  if (target?.property_id || target?.target_id) {
    args.push("--property-id", target.property_id || target.target_id);
  }
  const child = spawnSync("python3", args, {
    cwd: repoDir,
    encoding: "utf8",
  });
  if (child.status === 0 && fs.existsSync(output)) {
    return { PROPERTY_CONTACT_TRUTH_JSON_PATH: output };
  }
  log("Property contact truth export warning", {
    status: child.status,
    stderr: child.stderr?.trim() || "",
    stdout: child.stdout?.trim() || "",
  });
  return {};
}

function exportTruthIfNeeded(profile, target = null) {
  if (["apartments_pricing_deep_journey", "apartments_pricing_mobile_journey"].includes(profile)) {
    if (process.env.POND_AVAILABILITY_UNITS_JSON_PATH) {
      return { POND_AVAILABILITY_UNITS_JSON_PATH: process.env.POND_AVAILABILITY_UNITS_JSON_PATH };
    }
    const output = path.join(
      reportsDir,
      `pond-availability-${batchId}-${target?.property_id || target?.target_id || "all"}-${Date.now()}.json`
    );
    const args = [pondAvailabilityExporter, "--output", output];
    if (target?.property_id || target?.target_id) {
      args.push("--property-id", target.property_id || target.target_id);
    }
    const child = spawnSync("python3", args, {
      cwd: repoDir,
      encoding: "utf8",
    });
    if (child.status === 0 && fs.existsSync(output)) {
      return { POND_AVAILABILITY_UNITS_JSON_PATH: output };
    }
    log("Pond availability export warning", {
      status: child.status,
      stderr: child.stderr?.trim() || "",
      stdout: child.stdout?.trim() || "",
    });
    return {};
  }

  if (profile === "header_navigation_integrity" || profile === "portfolio_functionality_regression") {
    return exportPropertyContactTruth(target);
  }

  if (profile === "lead_attribution_e2e") {
    if (process.env.LEAD_ATTRIBUTION_TRUTH_JSON_PATH) {
      return { LEAD_ATTRIBUTION_TRUTH_JSON_PATH: process.env.LEAD_ATTRIBUTION_TRUTH_JSON_PATH };
    }
    const output = path.join(reportsDir, `lead-attribution-truth-${batchId}-${Date.now()}.json`);
    const args = [
      leadAttributionTruthExporter,
      "--output",
      output,
      "--target-field",
      "target_url",
      "--query-param",
      process.env.EVS_ATTRIBUTION_QUERY_PARAM || "id",
    ];
    if (target?.property_id) {
      args.push("--property-id", target.property_id);
    }
    const child = spawnSync("python3", args, {
      cwd: repoDir,
      encoding: "utf8",
    });
    if (child.status === 0 && fs.existsSync(output)) {
      return { LEAD_ATTRIBUTION_TRUTH_JSON_PATH: output };
    }
    log("Lead attribution truth export warning", {
      property_id: target?.property_id || null,
      status: child.status,
      stderr: child.stderr?.trim() || "",
      stdout: child.stdout?.trim() || "",
    });
    return {};
  }

  return {};
}

function profileForDevice(profile, deviceProfile) {
  if (
    profile === "apartments_pricing_deep_journey" &&
    (deviceProfile === "iphone_safari" || deviceProfile === "android_chrome")
  ) {
    return "apartments_pricing_mobile_journey";
  }
  return profile;
}

function severityRank(severity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[String(severity || "medium").toLowerCase()] || 2;
}

function statusRank(status) {
  return { fail: 4, warn: 3, blocked: 2, skipped: 1, not_applicable: 0, pass: 0 }[String(status || "").toLowerCase()] || 0;
}

function findingSeverity(finding) {
  return finding?.metadata?.qa_severity || finding?.severity || "medium";
}

function findingRow(finding) {
  return finding?.metadata?.qa_source?.row || finding?.source?.row || null;
}

function findingPage(finding) {
  return [finding?.metadata?.qa_page, finding?.metadata?.qa_section].filter(Boolean).join(" / ") || null;
}

function findingIsActionable(finding) {
  if (!finding) return false;
  if (finding.kind === "artifact_capture") return false;
  return ["fail", "warn", "blocked"].includes(finding.status);
}

function compactFinding(finding, context = {}) {
  return {
    property_id: context.property_id || null,
    property_name: context.property_name || null,
    target_url: context.target_url || null,
    profile: context.effective_profile || context.profile || null,
    device_profile: context.device_profile || null,
    classification: context.classification || null,
    check_id: finding.check_id || null,
    kind: finding.kind || null,
    label: finding.label || null,
    status: finding.status || null,
    severity: findingSeverity(finding),
    row: findingRow(finding),
    page: findingPage(finding),
    message: finding.message || null,
    evidence: {
      target_url: finding.metadata?.target_url || null,
      unit_number: finding.metadata?.unit?.unit_number || null,
      unit_detail_url: finding.metadata?.unit_detail_url || null,
      has_sightmap_surface: finding.metadata?.has_sightmap_surface,
      locates_unit: finding.metadata?.locates_unit,
      changed_visible_units: finding.metadata?.changed_visible_units,
      first_inversion: finding.metadata?.first_inversion || null,
      verdict_criteria: finding.metadata?.verdict_criteria || null,
      status_policy: finding.metadata?.status_policy || null,
      errors: Array.isArray(finding.metadata?.errors) ? finding.metadata.errors.slice(0, 3) : null,
    },
  };
}

function summarizePayload(payload, resultContext = {}) {
  const deviceRuns = payload?.device_runs || [];
  const findings = [];
  const counts = { pass: 0, warn: 0, fail: 0, skipped: 0, not_applicable: 0, blocked: 0, other: 0 };
  const severityCounts = {};
  for (const run of deviceRuns) {
    const context = {
      ...resultContext,
      device_profile: run.device_profile || resultContext.device_profile,
      classification: run.classification || resultContext.classification,
    };
    for (const finding of run.findings || []) {
      if (counts[finding.status] === undefined) {
        counts.other += 1;
      } else {
        counts[finding.status] += 1;
      }
      const severity = findingSeverity(finding);
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      if (findingIsActionable(finding)) {
        findings.push(compactFinding(finding, context));
      }
    }
  }
  const criticalFailures = findings.filter((finding) => finding.status === "fail" && severityRank(finding.severity) >= 3);
  const failures = findings.filter((finding) => finding.status === "fail");
  const highWarnings = findings.filter((finding) => finding.status === "warn" && severityRank(finding.severity) >= 3);
  const blockers = [...criticalFailures, ...failures.filter((finding) => severityRank(finding.severity) < 3), ...highWarnings]
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) || severityRank(b.severity) - severityRank(a.severity) || (a.row || 9999) - (b.row || 9999));
  return {
    status_counts: counts,
    severity_counts: severityCounts,
    actionable_findings: findings,
    critical_fail_count: criticalFailures.length,
    fail_count: failures.length,
    high_warn_count: highWarnings.length,
    blocker_count: blockers.length,
    site_ready: failures.length === 0,
    needs_review: failures.length === 0 && highWarnings.length > 0,
    top_blockers: blockers.slice(0, 3),
  };
}

function summarizeBatch(results) {
  const propertyMap = new Map();
  for (const result of results) {
    const key = result.property_id || result.target_url || result.property_name || "unknown";
    const existing =
      propertyMap.get(key) ||
      {
        property_id: result.property_id,
        property_name: result.property_name,
        target_url: result.target_url,
        session_count: 0,
        timed_out_count: 0,
        critical_fail_count: 0,
        fail_count: 0,
        high_warn_count: 0,
        blocker_count: 0,
        top_blockers: [],
      };
    existing.session_count += 1;
    if (result.timed_out) existing.timed_out_count += 1;
    existing.critical_fail_count += result.critical_fail_count || 0;
    existing.fail_count += result.fail_count || 0;
    existing.high_warn_count += result.high_warn_count || 0;
    existing.blocker_count += result.blocker_count || 0;
    existing.top_blockers.push(...(result.top_blockers || []));
    existing.top_blockers = existing.top_blockers
      .sort((a, b) => statusRank(b.status) - statusRank(a.status) || severityRank(b.severity) - severityRank(a.severity) || (a.row || 9999) - (b.row || 9999))
      .slice(0, 3);
    existing.site_ready = existing.timed_out_count === 0 && existing.fail_count === 0;
    existing.needs_review = existing.site_ready && existing.high_warn_count > 0;
    propertyMap.set(key, existing);
  }
  const properties = [...propertyMap.values()].sort(
    (a, b) =>
      Number(a.site_ready) - Number(b.site_ready) ||
      (b.critical_fail_count || 0) - (a.critical_fail_count || 0) ||
      (b.high_warn_count || 0) - (a.high_warn_count || 0) ||
      String(a.property_name || a.property_id).localeCompare(String(b.property_name || b.property_id))
  );
  return {
    generated_at: new Date().toISOString(),
    batch_id: batchId,
    run_id: runId,
    totals: {
      property_count: properties.length,
      ready_count: properties.filter((property) => property.site_ready && !property.needs_review).length,
      needs_review_count: properties.filter((property) => property.needs_review).length,
      blocked_count: properties.filter((property) => !property.site_ready).length,
      critical_fail_count: properties.reduce((total, property) => total + property.critical_fail_count, 0),
      fail_count: properties.reduce((total, property) => total + property.fail_count, 0),
      high_warn_count: properties.reduce((total, property) => total + property.high_warn_count, 0),
    },
    properties,
  };
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function criticalSummaryCsv(criticalSummary) {
  const rows = [
    [
      "property_id",
      "property_name",
      "site_ready",
      "needs_review",
      "critical_fail_count",
      "fail_count",
      "high_warn_count",
      "top_blocker_status",
      "top_blocker_severity",
      "top_blocker_row",
      "top_blocker_label",
      "top_blocker_message",
    ],
  ];
  for (const property of criticalSummary.properties || []) {
    const blocker = property.top_blockers?.[0] || {};
    rows.push([
      property.property_id,
      property.property_name,
      property.site_ready,
      property.needs_review,
      property.critical_fail_count,
      property.fail_count,
      property.high_warn_count,
      blocker.status,
      blocker.severity,
      blocker.row,
      blocker.label,
      blocker.message,
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

const plan = runJson(process.execPath, [buildPlanScript]);
const profiles = profileFilter.length > 0 ? profileFilter : Object.keys(plan.checks.by_profile);
const devices = deviceFilter.length > 0 ? deviceFilter : plan.device_profiles;
const targets = plan.targets.filter((target) => {
  if (targetFilter.size === 0) return true;
  return targetFilter.has(target.target_id) || targetFilter.has(target.property_id) || targetFilter.has(target.property_name);
});

if (targets.length === 0) {
  throw new Error("No targets selected for QA batch run.");
}

const runDir = path.join(reportsDir, runId);
fs.mkdirSync(runDir, { recursive: true });

const results = [];
for (const profile of profiles) {
  for (const deviceProfile of devices) {
    const effectiveProfile = profileForDevice(profile, deviceProfile);
    for (const target of targets) {
      const propertyId = target.property_id || target.target_id;
      const safeTarget = String(propertyId || target.target_id || "target").replace(/[^a-zA-Z0-9_-]+/g, "-");
      const outputPath = path.join(runDir, `${safeTarget}-${deviceProfile}-${effectiveProfile}.json`);
      const requestId = `${runId}-${safeTarget}-${deviceProfile}-${effectiveProfile}`;
      log("Running target", {
        property_id: propertyId,
        profile: effectiveProfile,
        device_profile: deviceProfile,
        target_url: target.target_url,
        dry_run: dryRun,
      });
      if (dryRun) {
        results.push({
          property_id: propertyId,
          property_name: target.property_name,
          target_url: target.target_url,
          requested_profile: profile,
          effective_profile: effectiveProfile,
          device_profile: deviceProfile,
          output_path: outputPath,
          exit_code: null,
          signal: null,
          timed_out: false,
          error: null,
          stdout: "",
          stderr: "",
          classification: "dry_run",
        });
        continue;
      }
      const child = spawnSync(process.execPath, [providerScript], {
        cwd: repoDir,
        encoding: "utf8",
        timeout: propertyTimeoutMs,
        env: {
          ...process.env,
          ...exportTruthIfNeeded(effectiveProfile, target),
          TARGET_URL: target.target_url,
          PROPERTY_ID: propertyId,
          REQUEST_ID: requestId,
          OUTPUT_PATH: outputPath,
          EVS_PROFILE: effectiveProfile,
          EVS_ENVIRONMENT: target.environment || plan.batch.environment || "production",
          BROWSERSTACK_DEVICE_PROFILE: deviceProfile,
        },
      });
      let payload = null;
      if (fs.existsSync(outputPath)) {
        payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      }
      const runSummary = payload
        ? summarizePayload(payload, {
            property_id: propertyId,
            property_name: target.property_name,
            target_url: target.target_url,
            effective_profile: effectiveProfile,
            device_profile: deviceProfile,
            classification: payload?.device_runs?.[0]?.classification || null,
          })
        : {
            status_counts: {},
            severity_counts: {},
            actionable_findings: [],
            critical_fail_count: child.error?.code === "ETIMEDOUT" ? 1 : 0,
            fail_count: child.status === 0 ? 0 : 1,
            high_warn_count: 0,
            blocker_count: child.status === 0 ? 0 : 1,
            site_ready: child.status === 0,
            needs_review: false,
            top_blockers:
              child.status === 0
                ? []
                : [
                    {
                      property_id: propertyId,
                      property_name: target.property_name,
                      target_url: target.target_url,
                      profile: effectiveProfile,
                      device_profile: deviceProfile,
                      classification: child.error?.code === "ETIMEDOUT" ? "infra_timeout" : "runner_failure",
                      check_id: "runner_execution",
                      kind: "runner",
                      label: "BrowserStack runner execution",
                      status: "fail",
                      severity: "high",
                      row: null,
                      page: null,
                      message: child.error?.message || child.stderr?.trim() || `Runner exited with ${child.status}.`,
                      evidence: {},
                    },
                  ],
          };
      results.push({
        property_id: propertyId,
        property_name: target.property_name,
        target_url: target.target_url,
        requested_profile: profile,
        effective_profile: effectiveProfile,
        device_profile: deviceProfile,
        output_path: outputPath,
        exit_code: child.status,
        signal: child.signal || null,
        timed_out: child.error?.code === "ETIMEDOUT",
        error: child.error ? child.error.message : null,
        stdout: child.stdout?.trim() || "",
        stderr: child.stderr?.trim() || "",
        classification: payload?.device_runs?.[0]?.classification || null,
        status_counts: runSummary.status_counts,
        severity_counts: runSummary.severity_counts,
        critical_fail_count: runSummary.critical_fail_count,
        fail_count: runSummary.fail_count,
        high_warn_count: runSummary.high_warn_count,
        blocker_count: runSummary.blocker_count,
        site_ready: runSummary.site_ready,
        needs_review: runSummary.needs_review,
        top_blockers: runSummary.top_blockers,
      });
    }
  }
}

const criticalSummary = summarizeBatch(results);
const summary = {
  generated_at: new Date().toISOString(),
  batch_id: batchId,
  run_id: runId,
  run_dir: runDir,
  plan,
  profile_filter: profileFilter,
  device_filter: deviceFilter,
  target_filter: Array.from(targetFilter),
  dry_run: dryRun,
  forms_enabled: formsEnabled,
  critical_summary: criticalSummary,
  results,
};

const summaryPath = path.join(runDir, "summary.json");
const criticalSummaryPath = path.join(runDir, "critical-summary.json");
const criticalSummaryCsvPath = path.join(runDir, "critical-summary.csv");
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
fs.writeFileSync(criticalSummaryPath, JSON.stringify(criticalSummary, null, 2));
fs.writeFileSync(criticalSummaryCsvPath, criticalSummaryCsv(criticalSummary));

let evidencePackage = null;
if (process.env.EVS_DISABLE_EVIDENCE_MANIFEST !== "1") {
  const manifestChild = spawnSync(process.execPath, [evidencePackageScript], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      QA_BATCH_ID: batchId,
      EVS_EVIDENCE_PACKAGE_ID: path.join(runDir, "local-evidence-package"),
      EVS_EVIDENCE_RUN_DIRS: runDir,
      EVS_EVIDENCE_NOTE:
        "Automatically generated by run-portfolio-qa-batch.mjs. The supplied workbook remains fill-only; detailed proof stays in this local EVS package.",
    },
  });
  if (manifestChild.status === 0) {
    try {
      evidencePackage = JSON.parse(manifestChild.stdout);
    } catch {
      evidencePackage = { raw_stdout: manifestChild.stdout.trim() };
    }
  } else {
    evidencePackage = {
      error: manifestChild.stderr?.trim() || manifestChild.stdout?.trim() || `evidence manifest exited ${manifestChild.status}`,
    };
  }
}

process.stdout.write(
  JSON.stringify(
    {
      summary_path: summaryPath,
      critical_summary_path: criticalSummaryPath,
      critical_summary_csv_path: criticalSummaryCsvPath,
      evidence_package: evidencePackage,
      ...summary,
    },
    null,
    2
  )
);
