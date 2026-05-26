#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_SERVER = "sqlreport.ocs-vr.onecornerstone.com";
const DEFAULT_DATABASE = "data_warehouse";
const DEFAULT_USER = "dw_reader";
const DEFAULT_KEEPER_RECORD_TITLE = "Data Warehouse";
const DEFAULT_SOURCE_DIR = "/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports";
const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/reconciliation/guest_card_exports";
const DEP_CACHE_DIR = path.join(os.homedir(), ".cache", "venterra-dw-harvest");

const CONTRACT_COLUMNS = [
  "RunDt",
  " Days in Period",
  "property_cd",
  "property_name",
  "GC This Period",
  "Init Cont-Quote",
  "Init Cont- Phone",
  "Init Cont-Apply",
  "Init Cont-Tour",
  "GC Prev Period",
  "Prev Init Cont-Quote",
  "Prev Init Cont- Phone",
  "Prev Init Cont-Apply",
  "Prev Init Cont-Tour",
  "Quotes This Period",
  "Prev Quotes",
  "Apps This Period",
  "Prev Apps",
  "Pipe Apps This Period",
  "Pipe Prev Apps",
  "IPT Appt This Period",
  "Prev IPT Appt",
  "SGT Appt This Period",
  "Prev SGT Appt",
];

const NUMERIC_COLUMNS = CONTRACT_COLUMNS.filter((column) => !["RunDt", "property_cd", "property_name"].includes(column));

function parseArgs(argv) {
  const args = {
    sourceDir: DEFAULT_SOURCE_DIR,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    limit: 10,
    runDates: [],
    files: [],
    server: DEFAULT_SERVER,
    database: DEFAULT_DATABASE,
    user: DEFAULT_USER,
    keeperRecordTitle: DEFAULT_KEEPER_RECORD_TITLE,
    installDeps: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--source-dir") {
      args.sourceDir = next;
      i += 1;
    } else if (arg === "--output-root") {
      args.outputRoot = next;
      i += 1;
    } else if (arg === "--limit") {
      args.limit = Number(next);
      i += 1;
    } else if (arg === "--run-date") {
      args.runDates.push(next);
      i += 1;
    } else if (arg === "--file") {
      args.files.push(next);
      i += 1;
    } else if (arg === "--server") {
      args.server = next;
      i += 1;
    } else if (arg === "--database") {
      args.database = next;
      i += 1;
    } else if (arg === "--user") {
      args.user = next;
      i += 1;
    } else if (arg === "--keeper-record-title") {
      args.keeperRecordTitle = next;
      i += 1;
    } else if (arg === "--no-install") {
      args.installDeps = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 60) {
    throw new Error("--limit must be an integer between 1 and 60.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/reconcile_data_warehouse_guest_card_exports.mjs [options]

Options:
  --limit N                    Recent distinct run dates to reconcile, default 10
  --run-date YYYY-MM-DD        Reconcile one run date; can be repeated
  --file PATH                  Reconcile one specific historical CSV; can be repeated
  --source-dir PATH            Guest_Card_Reports root, default ${DEFAULT_SOURCE_DIR}
  --output-root PATH           Output root, default ${DEFAULT_OUTPUT_ROOT}
  --server HOST                SQL Server host, default ${DEFAULT_SERVER}
  --database NAME              SQL database, default ${DEFAULT_DATABASE}
  --user NAME                  SQL login, default ${DEFAULT_USER}
  --keeper-record-title TITLE  Keeper record title, default ${DEFAULT_KEEPER_RECORD_TITLE}
  --no-install                 Do not install the cached mssql dependency
`);
}

function ensureMssqlDependency(installDeps) {
  const packagePath = path.join(DEP_CACHE_DIR, "node_modules", "mssql", "package.json");
  if (fs.existsSync(packagePath)) return;
  if (!installDeps) throw new Error(`mssql dependency not found at ${packagePath}. Re-run without --no-install.`);
  fs.mkdirSync(DEP_CACHE_DIR, { recursive: true });
  const result = spawnSync("npm", ["install", "--prefix", DEP_CACHE_DIR, "mssql@11"], {
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to install cached mssql dependency: ${result.stderr || result.stdout}`);
  }
}

function ksmBinary() {
  const extraPaths = [
    "/Library/Frameworks/Python.framework/Versions/3.12/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const currentPath = process.env.PATH || "";
  const mergedPath = [...extraPaths, ...currentPath.split(":")].filter(Boolean);
  for (const dir of mergedPath) {
    const candidate = path.join(dir, "ksm");
    if (fs.existsSync(candidate)) return candidate;
  }
  return "ksm";
}

function runKsm(args) {
  const profile = process.env.KSM_PROFILE || "marketingops";
  return execFileSync(ksmBinary(), ["-p", profile, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function keeperPassword(recordTitle) {
  const list = JSON.parse(runKsm(["secret", "list", "--title", recordTitle, "--json"]));
  if (!Array.isArray(list) || list.length === 0) throw new Error(`Keeper record not found for ${recordTitle}.`);
  const records = JSON.parse(runKsm(["secret", "get", "--uid", list[0].uid, "--json"]));
  const record = Array.isArray(records) ? records[0] : records;
  const fields = [...(record.fields || []), ...(record.custom || [])];
  const passwordField = fields.find((field) => field.type === "password" || field.label === "password");
  const password = Array.isArray(passwordField?.value) ? passwordField.value[0] : passwordField?.value;
  if (!password) throw new Error(`Keeper record ${recordTitle} does not contain a password value.`);
  return password;
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  const normalized = text.replace(/^\uFEFF/, "");

  const pushValue = () => {
    row.push(value);
    value = "";
  };
  const pushRow = () => {
    if (row.length || value !== "") {
      pushValue();
      rows.push(row);
      row = [];
    }
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushValue();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      value += char;
    }
  }
  if (value !== "" || row.length) pushRow();
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim() === "Days in Period" ? " Days in Period" : header.trimEnd());
  return rows.slice(1).filter((values) => values.some((item) => item !== "")).map((values) => {
    const out = {};
    headers.forEach((header, index) => {
      out[header] = values[index] ?? "";
    });
    return out;
  });
}

function csvRows(filePath) {
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(filePath, rows, headers = null) {
  const effectiveHeaders = headers || (rows[0] ? Object.keys(rows[0]) : []);
  if (!effectiveHeaders.length) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const lines = [effectiveHeaders.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(effectiveHeaders.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function parseRunDateFromFile(filePath) {
  const match = path.basename(filePath).match(/Website Data CSV-(\d{8})_/);
  if (!match) return null;
  return `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`;
}

function discoverExportFiles(sourceDir) {
  const root = path.resolve(sourceDir);
  const files = [];
  const walk = (dir, depth = 0) => {
    if (depth > 2 || !fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath, depth + 1);
      if (entry.isFile() && /^Website Data CSV-\d{8}_\d{6}\.csv$/.test(entry.name)) files.push(fullPath);
    }
  };
  walk(root);
  return files;
}

function selectedFiles(args) {
  const explicitFiles = args.files.map((file) => path.resolve(file));
  if (explicitFiles.length) return explicitFiles;

  const files = discoverExportFiles(args.sourceDir);
  const byDate = new Map();
  for (const file of files) {
    const runDate = parseRunDateFromFile(file);
    if (!runDate) continue;
    if (args.runDates.length && !args.runDates.includes(runDate)) continue;
    const current = byDate.get(runDate);
    if (!current || path.basename(file) > path.basename(current)) byDate.set(runDate, file);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const chosen = args.runDates.length ? sorted : sorted.slice(-args.limit);
  return chosen.map(([, file]) => file);
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function comparableValue(column, value) {
  if (NUMERIC_COLUMNS.includes(column)) return numericValue(value);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

async function generateContractRows(pool, sql, runDate, daysBack) {
  const request = pool.request();
  request.input("runDate", sql.Date, runDate);
  request.input("daysBack", sql.Int, daysBack);
  const result = await request.query(`
DECLARE @trail_st date = DATEADD(day, @daysBack * -1, @runDate);
DECLARE @trail_end date = @runDate;
DECLARE @prev_trail_st date = DATEADD(day, @daysBack * -1, @trail_st);
DECLARE @prev_trail_end date = @trail_st;

SELECT
  CONVERT(varchar(10), @runDate, 23) AS [RunDt],
  @daysBack AS [ Days in Period],
  p.property_cd,
  p.property_name,
  t_gc.gc AS [GC This Period],
  t_gc.Quote AS [Init Cont-Quote],
  t_gc.phone AS [Init Cont- Phone],
  t_gc.ApplyOnl AS [Init Cont-Apply],
  t_gc.SchedTour AS [Init Cont-Tour],
  pt_gc.gc AS [GC Prev Period],
  pt_gc.Quote AS [Prev Init Cont-Quote],
  pt_gc.phone AS [Prev Init Cont- Phone],
  pt_gc.ApplyOnl AS [Prev Init Cont-Apply],
  pt_gc.SchedTour AS [Prev Init Cont-Tour],
  q.quotest AS [Quotes This Period],
  q.quotespt AS [Prev Quotes],
  app.AppsT AS [Apps This Period],
  app.AppsPT AS [Prev Apps],
  pipe.AppsT AS [Pipe Apps This Period],
  pipe.AppsPT AS [Pipe Prev Apps],
  tour.t_ipt AS [IPT Appt This Period],
  tour.pt_ipt AS [Prev IPT Appt],
  tour.t_sgt AS [SGT Appt This Period],
  tour.pt_sgt AS [Prev SGT Appt]
FROM dw_read.property_bv p
LEFT JOIN (
  SELECT property_cd, COUNT(*) AS GC,
    COUNT(CASE WHEN init_contact_type_dv = 'q' THEN 1 END) AS Quote,
    COUNT(CASE WHEN init_contact_type_dv = 'i' THEN 1 END) AS ApplyOnl,
    COUNT(CASE WHEN init_contact_type_dv = 'p' THEN 1 END) AS Phone,
    COUNT(CASE WHEN init_contact_type_dv = 't' THEN 1 END) AS SchedTour
  FROM dw_read.prospect_bv
  WHERE created_dtt >= @trail_st AND created_dtt < @trail_end
  GROUP BY property_cd
) t_gc ON t_gc.property_cd = p.property_cd
LEFT JOIN (
  SELECT property_cd, COUNT(*) AS GC,
    COUNT(CASE WHEN init_contact_type_dv = 'q' THEN 1 END) AS Quote,
    COUNT(CASE WHEN init_contact_type_dv = 'i' THEN 1 END) AS ApplyOnl,
    COUNT(CASE WHEN init_contact_type_dv = 'p' THEN 1 END) AS Phone,
    COUNT(CASE WHEN init_contact_type_dv = 't' THEN 1 END) AS SchedTour
  FROM dw_read.prospect_bv
  WHERE created_dtt >= @prev_trail_st AND created_dtt < @prev_trail_end
  GROUP BY property_cd
) pt_gc ON pt_gc.property_cd = p.property_cd
LEFT JOIN (
  SELECT property_cd,
    COUNT(CASE WHEN created_dt >= @trail_st AND created_dt < @trail_end THEN 1 END) AS QuotesT,
    COUNT(CASE WHEN created_dt >= @prev_trail_st AND created_dt < @prev_trail_end THEN 1 END) AS QuotesPT
  FROM dw_read.prospect_quote_bv
  WHERE quote_origin_dv = 'portal' AND created_dt >= @prev_trail_st AND created_dt < @trail_end
  GROUP BY property_cd
) q ON q.property_cd = p.property_cd
LEFT JOIN (
  SELECT property_cd,
    COUNT(CASE WHEN created_dtt >= @trail_st AND created_dtt < @trail_end THEN 1 END) AS AppsT,
    COUNT(CASE WHEN created_dtt >= @prev_trail_st AND created_dtt < @prev_trail_end THEN 1 END) AS AppsPT
  FROM dw_read.online_application_bv
  WHERE created_dtt >= @prev_trail_st AND created_dtt < @trail_end
  GROUP BY property_cd
) app ON app.property_cd = p.property_cd
LEFT JOIN (
  SELECT property_cd,
    COUNT(CASE WHEN created_dtt >= @trail_st AND created_dtt < @trail_end THEN 1 END) AS AppsT,
    COUNT(CASE WHEN created_dtt >= @prev_trail_st AND created_dtt < @prev_trail_end THEN 1 END) AS AppsPT
  FROM dbo.dw_pipeline_applications
  WHERE created_dtt >= @prev_trail_st AND created_dtt < @trail_end
  GROUP BY property_cd
) pipe ON pipe.property_cd = p.property_cd
LEFT JOIN (
  SELECT pr.property_cd,
    SUM(CASE WHEN pl.created_dtt >= @trail_st AND pl.created_dtt < @trail_end
      AND pl.tour_type_dv = 'ipt' AND pl.follow_up_type_dv = 'SA' THEN 1 ELSE 0 END) AS T_IPT,
    SUM(CASE WHEN pl.created_dtt >= @prev_trail_st AND pl.created_dtt < @prev_trail_end
      AND pl.tour_type_dv = 'ipt' AND pl.follow_up_type_dv = 'SA' THEN 1 ELSE 0 END) AS PT_IPT,
    SUM(CASE WHEN pl.created_dtt >= @trail_st AND pl.created_dtt < @trail_end
      AND pl.tour_type_dv = 'sgt' AND pl.follow_up_type_dv = 'SA' THEN 1 ELSE 0 END) AS T_SGT,
    SUM(CASE WHEN pl.created_dtt >= @prev_trail_st AND pl.created_dtt < @prev_trail_end
      AND pl.tour_type_dv = 'sgt' AND pl.follow_up_type_dv = 'SA' THEN 1 ELSE 0 END) AS PT_SGT
  FROM dbo.dw_prospect_log_entry pl
  INNER JOIN dw_read.prospect_bv pr ON pl.prospect_id = pr.prospect_id
  WHERE pl.tour_type_dv IN ('ipt', 'sgt')
    AND pl.follow_up_type_dv = 'SA'
    AND pl.created_dtt >= @prev_trail_st
    AND pl.created_dtt < @trail_end
  GROUP BY pr.property_cd
) tour ON tour.property_cd = p.property_cd
WHERE p.status_cd = 'active'
ORDER BY p.alias;
`);
  return result.recordset.map((row) => {
    const out = {};
    for (const column of CONTRACT_COLUMNS) out[column] = row[column] ?? "";
    return out;
  });
}

function compareRows({ runDate, expectedRows, actualRows, sourceFile }) {
  const expectedByProperty = new Map(expectedRows.map((row) => [row.property_cd, row]));
  const actualByProperty = new Map(actualRows.map((row) => [row.property_cd, row]));
  const metricDeltas = [];
  const metadataDeltas = [];
  const rowDeltas = [];
  const allProperties = new Set([...expectedByProperty.keys(), ...actualByProperty.keys()]);

  for (const propertyCd of [...allProperties].sort()) {
    const expected = expectedByProperty.get(propertyCd);
    const actual = actualByProperty.get(propertyCd);
    if (!expected || !actual) {
      rowDeltas.push({
        run_date: runDate,
        source_file: sourceFile,
        property_cd: propertyCd,
        delta_type: expected ? "missing_generated_row" : "extra_generated_row",
        expected_property_name: expected?.property_name || "",
        generated_property_name: actual?.property_name || "",
      });
      continue;
    }

    for (const column of CONTRACT_COLUMNS) {
      if (column === "property_cd") continue;
      const expectedValue = comparableValue(column, expected[column]);
      const actualValue = comparableValue(column, actual[column]);
      if (expectedValue !== actualValue) {
        const delta = NUMERIC_COLUMNS.includes(column) ? actualValue - expectedValue : "";
        const target = NUMERIC_COLUMNS.includes(column) ? metricDeltas : metadataDeltas;
        target.push({
          run_date: runDate,
          source_file: sourceFile,
          property_cd: propertyCd,
          property_name: expected.property_name || actual.property_name || "",
          column,
          expected_value: expectedValue,
          generated_value: actualValue,
          delta,
        });
      }
    }
  }

  return { metricDeltas, metadataDeltas, rowDeltas };
}

function totals(rows) {
  const out = {};
  for (const column of NUMERIC_COLUMNS) out[column] = 0;
  for (const row of rows) {
    for (const column of NUMERIC_COLUMNS) out[column] += numericValue(row[column]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = selectedFiles(args);
  if (!files.length) throw new Error("No historical Website Data CSV files selected for reconciliation.");

  ensureMssqlDependency(args.installDeps);
  const require = createRequire(import.meta.url);
  const sql = require(path.join(DEP_CACHE_DIR, "node_modules", "mssql"));
  const password = keeperPassword(args.keeperRecordTitle);
  const outputDir = path.resolve(args.outputRoot, todayStamp());
  const generatedDir = path.join(outputDir, "generated_exports");
  fs.mkdirSync(generatedDir, { recursive: true });

  const pool = await sql.connect({
    server: args.server,
    database: args.database,
    user: args.user,
    password,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    requestTimeout: 120000,
    connectionTimeout: 15000,
  });

  const fileResults = [];
  const allMetricDeltas = [];
  const allMetadataDeltas = [];
  const allRowDeltas = [];

  try {
    for (const file of files) {
      const expectedRows = csvRows(file);
      const first = expectedRows[0] || {};
      const runDate = first.RunDt || parseRunDateFromFile(file);
      const daysBack = numericValue(first[" Days in Period"]) || 1;
      if (!runDate) throw new Error(`Unable to determine run date for ${file}`);

      const actualRows = await generateContractRows(pool, sql, runDate, daysBack);
      const generatedFile = path.join(generatedDir, `Website Data CSV-${runDate.replaceAll("-", "")}_generated.csv`);
      writeCsv(generatedFile, actualRows, CONTRACT_COLUMNS);

      const { metricDeltas, metadataDeltas, rowDeltas } = compareRows({
        runDate,
        expectedRows,
        actualRows,
        sourceFile: file,
      });
      allMetricDeltas.push(...metricDeltas);
      allMetadataDeltas.push(...metadataDeltas);
      allRowDeltas.push(...rowDeltas);

      const expectedTotals = totals(expectedRows);
      const generatedTotals = totals(actualRows);
      const totalAbsMetricDelta = metricDeltas.reduce((acc, row) => acc + Math.abs(numericValue(row.delta)), 0);

      fileResults.push({
        run_date: runDate,
        days_back: daysBack,
        status: metricDeltas.length || metadataDeltas.length || rowDeltas.length ? "mismatch" : "exact_match",
        source_file: file,
        generated_file: generatedFile,
        expected_rows: expectedRows.length,
        generated_rows: actualRows.length,
        metric_delta_count: metricDeltas.length,
        metadata_delta_count: metadataDeltas.length,
        row_delta_count: rowDeltas.length,
        total_abs_metric_delta: totalAbsMetricDelta,
        expected_guest_cards: expectedTotals["GC This Period"],
        generated_guest_cards: generatedTotals["GC This Period"],
        expected_quotes: expectedTotals["Quotes This Period"],
        generated_quotes: generatedTotals["Quotes This Period"],
        expected_apps: expectedTotals["Apps This Period"],
        generated_apps: generatedTotals["Apps This Period"],
        expected_tours: expectedTotals["IPT Appt This Period"] + expectedTotals["SGT Appt This Period"],
        generated_tours: generatedTotals["IPT Appt This Period"] + generatedTotals["SGT Appt This Period"],
      });
    }
  } finally {
    await pool.close();
  }

  const summary = {
    reconciliation_type: "data_warehouse_guest_card_export_contract",
    generated_at: new Date().toISOString(),
    credential_source: "Keeper/KSM",
    source_files_checked: files.length,
    exact_match_files: fileResults.filter((row) => row.status === "exact_match").length,
    mismatch_files: fileResults.filter((row) => row.status !== "exact_match").length,
    metric_delta_count: allMetricDeltas.length,
    metadata_delta_count: allMetadataDeltas.length,
    row_delta_count: allRowDeltas.length,
    total_abs_metric_delta: allMetricDeltas.reduce((acc, row) => acc + Math.abs(numericValue(row.delta)), 0),
    file_results: fileResults,
    outputs: {
      file_results_csv: path.join(outputDir, "file_results.csv"),
      metric_deltas_csv: path.join(outputDir, "metric_deltas.csv"),
      metadata_deltas_csv: path.join(outputDir, "metadata_deltas.csv"),
      row_deltas_csv: path.join(outputDir, "row_deltas.csv"),
      summary_json: path.join(outputDir, "reconciliation_summary.json"),
      generated_exports_dir: generatedDir,
    },
  };

  writeCsv(summary.outputs.file_results_csv, fileResults);
  writeCsv(summary.outputs.metric_deltas_csv, allMetricDeltas, [
    "run_date",
    "source_file",
    "property_cd",
    "property_name",
    "column",
    "expected_value",
    "generated_value",
    "delta",
  ]);
  writeCsv(summary.outputs.metadata_deltas_csv, allMetadataDeltas, [
    "run_date",
    "source_file",
    "property_cd",
    "property_name",
    "column",
    "expected_value",
    "generated_value",
    "delta",
  ]);
  writeCsv(summary.outputs.row_deltas_csv, allRowDeltas, [
    "run_date",
    "source_file",
    "property_cd",
    "delta_type",
    "expected_property_name",
    "generated_property_name",
  ]);
  fs.writeFileSync(summary.outputs.summary_json, `${JSON.stringify(summary, null, 2)}\n`);

  console.log("Data Warehouse guest-card export reconciliation complete");
  console.log(`Output: ${outputDir}`);
  console.log(`Files checked: ${summary.source_files_checked}`);
  console.log(`Exact matches: ${summary.exact_match_files}`);
  console.log(`Mismatches: ${summary.mismatch_files}`);
  console.log(`Metric deltas: ${summary.metric_delta_count}`);
  console.log(`Metadata deltas: ${summary.metadata_delta_count}`);
  console.log(`Row deltas: ${summary.row_delta_count}`);
  console.log(`Total absolute metric delta: ${summary.total_abs_metric_delta}`);
  console.log(`Summary JSON: ${summary.outputs.summary_json}`);
}

main().catch((error) => {
  console.error(`Reconciliation failed: ${error.message}`);
  process.exit(1);
});
