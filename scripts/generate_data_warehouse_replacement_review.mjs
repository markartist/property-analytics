#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/replacement_reviews";
const DEFAULT_DB_PATH = "data/portfolio_analytics.db";
const DEFAULT_MATRIX_PATH = "config/property_identity_matrix.json";
const DEFAULT_CODE_RESOLUTION_PATH = "config/data_warehouse_property_code_resolution.json";

function parseArgs(argv) {
  const args = {
    outputRoot: DEFAULT_OUTPUT_ROOT,
    dbPath: DEFAULT_DB_PATH,
    matrixPath: DEFAULT_MATRIX_PATH,
    codeResolutionPath: DEFAULT_CODE_RESOLUTION_PATH,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--output-root") {
      args.outputRoot = next;
      i += 1;
    } else if (arg === "--db") {
      args.dbPath = next;
      i += 1;
    } else if (arg === "--matrix") {
      args.matrixPath = next;
      i += 1;
    } else if (arg === "--code-resolution") {
      args.codeResolutionPath = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/generate_data_warehouse_replacement_review.mjs [options]

Options:
  --db PATH             SQLite DB path, default ${DEFAULT_DB_PATH}
  --matrix PATH         Property identity matrix path, default ${DEFAULT_MATRIX_PATH}
  --code-resolution PATH DW property code resolution manifest, default ${DEFAULT_CODE_RESOLUTION_PATH}
  --output-root PATH    Output root, default ${DEFAULT_OUTPUT_ROOT}
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readJsonIfExists(filePath, fallback) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return fallback;
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function latestJson(root, fileName) {
  const base = path.resolve(root);
  if (!fs.existsSync(base)) return null;
  const candidates = [];
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === fileName) candidates.push(full);
    }
  }
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!candidates.length) return null;
  return { path: candidates[0], value: JSON.parse(fs.readFileSync(candidates[0], "utf8")) };
}

function sqliteJson(dbPath, sql) {
  const result = spawnSync("sqlite3", ["-json", path.resolve(dbPath), sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`sqlite3 failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout || "[]");
}

function classifyDelta(delta) {
  if (delta.field === "unit_count") {
    const matrix = Number(delta.matrix_value ?? 0);
    const warehouse = Number(delta.data_warehouse_value ?? 0);
    const diff = warehouse - matrix;
    const abs = Math.abs(diff);
    return {
      ...delta,
      numeric_delta: diff,
      review_class:
        delta.matrix_value === null || delta.matrix_value === undefined
          ? "matrix_missing_value"
          : abs <= 2
            ? "minor_unit_count_variance"
            : "material_unit_count_variance",
    };
  }
  if (delta.field === "encasa_region") {
    return { ...delta, review_class: "region_or_market_reclassification" };
  }
  return { ...delta, review_class: "identity_metadata_variance" };
}

function displayDate(value, fallback = "not available") {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function displayDateTime(value, fallback = "not available") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return displayDate(value, fallback);
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed)}`;
}

function displayTextDates(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_match, year, month, day) => `${month}/${day}/${year}`);
}

function markdown(report) {
  const metadataDeltas = report.metadata_deltas.map((delta) =>
    `| ${delta.property_code} | ${delta.field} | ${delta.matrix_value ?? ""} | ${delta.data_warehouse_value ?? ""} | ${delta.review_class}${delta.numeric_delta !== undefined ? ` (${delta.numeric_delta > 0 ? "+" : ""}${delta.numeric_delta})` : ""} |`,
  ).join("\n");
  const excluded = report.operating_metrics.excluded_property_codes.map((item) =>
    `| ${item.property_code} | ${item.latest_observed_total_units ?? ""} | ${item.resolution} | ${displayTextDates(item.reason)} |`,
  ).join("\n");
  const lifecycleGaps = report.expected_property_lifecycle_gaps.map((item) =>
    `| ${item.property_code} | ${item.property_name} | ${item.lifecycle_status} | ${item.expected_in_metadata_feed ? "yes" : "no"} | ${item.expected_in_operating_metrics ? "yes" : "no"} | ${displayTextDates(item.reason)} |`,
  ).join("\n");

  return `# Data Warehouse Replacement Review

Generated: ${displayDateTime(report.generated_at)}

## Summary

- Guest-card direct latest date: ${displayDate(report.guest_card_direct.run_date)}
- Guest-card rows supplied: ${report.guest_card_direct.rows_supplied ?? 0}
- Operating metrics effective date: ${displayDate(report.operating_metrics.effective_run_date)}
- Operating metrics rows upserted: ${report.operating_metrics.rows_upserted ?? 0}
- Operating metrics unresolved codes: ${report.operating_metrics.unresolved_property_codes.length}
- Operating metrics governed exclusions: ${report.operating_metrics.excluded_property_codes.length}
- Metadata rows supplied: ${report.property_metadata.rows_supplied ?? 0}
- Metadata deltas flagged: ${report.metadata_deltas.length}

## Lifecycle Count Check

| Scope | Count |
| --- | ---: |
| Governed active matrix properties | ${report.lifecycle_count_check.active_matrix_properties} |
| Pre-live properties not expected in DW operating yet | ${report.lifecycle_count_check.pre_live_not_expected_in_operating} |
| Expected live operating properties from matrix | ${report.lifecycle_count_check.expected_live_operating_properties_from_matrix} |
| DW metadata properties | ${report.lifecycle_count_check.dw_metadata_properties} |
| DW metadata properties not expected in operating yet | ${report.lifecycle_count_check.dw_metadata_not_expected_in_operating} |
| Expected operating properties from DW metadata | ${report.lifecycle_count_check.expected_operating_properties_from_dw_metadata} |
| Actual operating properties | ${report.lifecycle_count_check.actual_operating_properties} |
| Count status | ${report.lifecycle_count_check.status} |

## Operating Baseline

| Metric Date | Rows | Properties | Occupied Units | Total Units | Avg Occupancy | Avg Leased | Leases | Move-Ins | Move-Outs | Cancels | Denials |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${report.operating_baseline.map((row) => `| ${displayDate(row.metric_date)} | ${row.rows} | ${row.properties} | ${row.occupied_units} | ${row.total_units} | ${row.avg_occupancy} | ${row.avg_leased} | ${row.leases} | ${row.move_ins} | ${row.move_outs} | ${row.cancels} | ${row.denials} |`).join("\n")}

## Metadata Deltas

| Property | Field | Matrix | Data Warehouse | Review Class |
| --- | --- | ---: | ---: | --- |
${metadataDeltas || "| None |  |  |  |  |"}

## Governed Operating Exclusions

| Code | Latest Units | Resolution | Evidence |
| --- | ---: | --- | --- |
${excluded || "| None |  |  |  |"}

## Expected Lifecycle Gaps

| Code | Property | Lifecycle | Expected In Metadata | Expected In Operating | Evidence |
| --- | --- | --- | --- | --- | --- |
${lifecycleGaps || "| None |  |  |  |  |  |"}

## Source-Owner Question

Please confirm whether the governed exclusions are historical/non-canonical leasing-statistics rows, retired property codes, or alternate codes that should map to active communities. Until confirmed, they remain excluded from canonical property operating metrics.
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrix = readJsonIfExists(args.matrixPath, { properties: [] });
  const codeResolution = readJsonIfExists(args.codeResolutionPath, { expected_property_lifecycle_gaps: [] });
  const guestCard = latestJson("outputs/data_warehouse/direct_supply/guest_card_metrics", "direct_supply_report.json");
  const operating = latestJson("outputs/data_warehouse/direct_supply/property_operating_metrics", "property_operating_metrics_supply_report.json");
  const metadata = latestJson("outputs/data_warehouse/direct_supply/property_metadata", "property_metadata_supply_report.json");
  const expectedPropertyLifecycleGaps = codeResolution.expected_property_lifecycle_gaps || [];
  const activeMatrixProperties = (matrix.properties || []).filter((property) => property.status === "active").length;
  const preLiveNotExpectedInOperating = expectedPropertyLifecycleGaps.filter((property) => property.expected_in_operating_metrics === false).length;
  const dwMetadataNotExpectedInOperating = expectedPropertyLifecycleGaps.filter((property) =>
    property.expected_in_metadata_feed === true && property.expected_in_operating_metrics === false
  ).length;

  const operatingBaseline = sqliteJson(args.dbPath, `
SELECT
  metric_date,
  COUNT(*) AS rows,
  COUNT(DISTINCT property_id) AS properties,
  SUM(occupied_units) AS occupied_units,
  SUM(total_units) AS total_units,
  ROUND(AVG(occupancy_rate), 2) AS avg_occupancy,
  ROUND(AVG(leased_rate), 2) AS avg_leased,
  SUM(leases_count) AS leases,
  SUM(move_ins_count) AS move_ins,
  SUM(move_outs_count) AS move_outs,
  SUM(cancellations_count) AS cancels,
  SUM(denials_count) AS denials
FROM property_operating_metrics
GROUP BY metric_date
ORDER BY metric_date DESC
LIMIT 10;
`);

  const report = {
    generated_at: new Date().toISOString(),
    guest_card_direct_report_path: guestCard?.path ?? null,
    property_operating_report_path: operating?.path ?? null,
    property_metadata_report_path: metadata?.path ?? null,
    guest_card_direct: guestCard?.value ?? {},
    operating_metrics: operating?.value ?? { unresolved_property_codes: [], excluded_property_codes: [] },
    property_metadata: metadata?.value ?? {},
    metadata_deltas: (metadata?.value?.matrix_deltas ?? []).map(classifyDelta),
    operating_baseline: operatingBaseline,
    expected_property_lifecycle_gaps: expectedPropertyLifecycleGaps,
    lifecycle_count_check: {
      active_matrix_properties: activeMatrixProperties,
      pre_live_not_expected_in_operating: preLiveNotExpectedInOperating,
      expected_live_operating_properties_from_matrix: activeMatrixProperties - preLiveNotExpectedInOperating,
      dw_metadata_properties: metadata?.value?.rows_supplied ?? 0,
      dw_metadata_not_expected_in_operating: dwMetadataNotExpectedInOperating,
      expected_operating_properties_from_dw_metadata: (metadata?.value?.rows_supplied ?? 0) - dwMetadataNotExpectedInOperating,
      actual_operating_properties: operating?.value?.rows_upserted ?? 0,
      status:
        (operating?.value?.rows_upserted ?? 0) === activeMatrixProperties - preLiveNotExpectedInOperating &&
        (operating?.value?.rows_upserted ?? 0) === (metadata?.value?.rows_supplied ?? 0) - dwMetadataNotExpectedInOperating
          ? "matches_expected_live_population"
          : "review_count_variance",
    },
  };

  const outputDir = path.resolve(args.outputRoot, todayStamp());
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "data_warehouse_replacement_review.json");
  const mdPath = path.join(outputDir, "data_warehouse_replacement_review.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown(report));

  console.log("Data Warehouse replacement review complete");
  console.log(`Metadata deltas: ${report.metadata_deltas.length}`);
  console.log(`Operating exclusions: ${report.operating_metrics.excluded_property_codes.length}`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`JSON: ${jsonPath}`);
}

main();
