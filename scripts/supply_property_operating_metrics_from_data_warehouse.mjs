#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_KEEPER_RECORD_TITLE,
  resolveDataWarehousePassword,
} from "./lib/data_warehouse_keeper.mjs";
import { ensureMarketingOpsKeeperRuntimeOrReexec } from "./lib/keeper_runtime.mjs";

const DEFAULT_SERVER = "sqlreport.ocs-vr.onecornerstone.com";
const DEFAULT_DATABASE = "data_warehouse";
const DEFAULT_USER = "dw_reader";
const DEFAULT_DB_PATH = "data/portfolio_analytics.db";
const DEFAULT_MATRIX_PATH = "config/property_identity_matrix.json";
const DEFAULT_CODE_RESOLUTION_PATH = "config/data_warehouse_property_code_resolution.json";
const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/direct_supply/property_operating_metrics";
const DEP_CACHE_DIR = path.join(os.homedir(), ".cache", "venterra-dw-harvest");
const SCRIPT_PATH = fileURLToPath(import.meta.url);

ensureMarketingOpsKeeperRuntimeOrReexec({ scriptPath: SCRIPT_PATH });

function localDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseArgs(argv) {
  const args = {
    runDate: localDateString(),
    dbPath: DEFAULT_DB_PATH,
    matrixPath: DEFAULT_MATRIX_PATH,
    codeResolutionPath: DEFAULT_CODE_RESOLUTION_PATH,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    server: DEFAULT_SERVER,
    database: DEFAULT_DATABASE,
    user: DEFAULT_USER,
    keeperRecordTitle: DEFAULT_KEEPER_RECORD_TITLE,
    installDeps: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--run-date") {
      args.runDate = next;
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
    } else if (arg === "--output-root") {
      args.outputRoot = next;
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.runDate)) {
    throw new Error("--run-date must be YYYY-MM-DD.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/supply_property_operating_metrics_from_data_warehouse.mjs [options]

Options:
  --run-date YYYY-MM-DD        Operating metric date to supply, default today
  --db PATH                    SQLite DB path, default ${DEFAULT_DB_PATH}
  --matrix PATH                Property identity matrix, default ${DEFAULT_MATRIX_PATH}
  --code-resolution PATH       DW code resolution manifest, default ${DEFAULT_CODE_RESOLUTION_PATH}
  --output-root PATH           Output root, default ${DEFAULT_OUTPUT_ROOT}
  --server HOST                SQL Server host, default ${DEFAULT_SERVER}
  --database NAME              SQL database, default ${DEFAULT_DATABASE}
  --user NAME                  SQL login, default ${DEFAULT_USER}
  --keeper-record-title TITLE  Keeper record title, default ${DEFAULT_KEEPER_RECORD_TITLE}
  --no-install                 Do not install cached mssql dependency
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
  if (result.status !== 0) throw new Error(`Unable to install cached mssql dependency: ${result.stderr || result.stdout}`);
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqliteExec(dbPath, sqlText) {
  const result = spawnSync("sqlite3", ["-cmd", ".timeout 300000", path.resolve(dbPath)], {
    input: sqlText,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`sqlite3 failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function loadIdentityMap(matrixPath) {
  const matrix = JSON.parse(fs.readFileSync(path.resolve(matrixPath), "utf8"));
  const byCode = new Map();
  for (const record of matrix.properties || []) {
    if (record.property_code) byCode.set(String(record.property_code).toUpperCase(), record);
  }
  return byCode;
}

function loadCodeResolutions(codeResolutionPath) {
  const resolvedPath = path.resolve(codeResolutionPath);
  if (!fs.existsSync(resolvedPath)) return new Map();
  const manifest = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  return new Map(
    (manifest.resolutions || []).map((resolution) => [
      String(resolution.property_code || "").toUpperCase(),
      resolution,
    ]),
  );
}

function asDateString(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function n(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchRows(pool, sql, runDate) {
  const request = pool.request();
  request.input("runDate", sql.Date, runDate);
  const result = await request.query(`
SELECT
  propertyid,
  forday,
  totalunits,
  occupied,
  percentoccupied,
  vacantavailable,
  percentleased,
  leased,
  cancels,
  denials,
  moveins,
  moveouts,
  vacantleased,
  noticeleased,
  noticeavailable,
  totalvacant,
  downunits,
  expectedmoveinsnext30days,
  expectedmoveoutsnext30days,
  occupancynext30days,
  expectedmoveinsnext60days,
  expectedmoveoutsnext60days,
  occupancynext60days
FROM dw_read.leasingstatistics_daily_bv
WHERE forday = @runDate
ORDER BY propertyid;
`);
  return result.recordset;
}

async function fetchLatestRunDate(pool) {
  const result = await pool.request().query(`
SELECT CONVERT(varchar(10), MAX(forday), 23) AS latest_run_date
FROM dw_read.leasingstatistics_daily_bv;
`);
  return result.recordset?.[0]?.latest_run_date || null;
}

function normalizeRows(rows, identityByCode, codeResolutions, runDate) {
  const normalized = [];
  const unresolved = [];
  const excluded = [];
  for (const row of rows) {
    const propertyCode = String(row.propertyid || "").trim().toUpperCase();
    const identity = identityByCode.get(propertyCode);
    if (!identity) {
      const resolution = codeResolutions.get(propertyCode);
      if (resolution?.resolution === "exclude_from_canonical_property_operating_metrics") {
        excluded.push({
          property_code: propertyCode,
          resolution: resolution.resolution,
          reason: resolution.reason,
          latest_observed_total_units: n(row.totalunits),
        });
        continue;
      }
      unresolved.push(propertyCode);
      continue;
    }
    const metricDate = asDateString(row.forday) || runDate;
    const evidence = {
      source_view: "dw_read.leasingstatistics_daily_bv",
      source_propertyid: propertyCode,
      source_forday: metricDate,
      direct_fields: {
        noticeleased: n(row.noticeleased),
        noticeavailable: n(row.noticeavailable),
        vacantleased: n(row.vacantleased),
        vacantavailable: n(row.vacantavailable),
        totalvacant: n(row.totalvacant),
        downunits: n(row.downunits),
        expectedmoveinsnext30days: n(row.expectedmoveinsnext30days),
        expectedmoveoutsnext30days: n(row.expectedmoveoutsnext30days),
        occupancynext30days: n(row.occupancynext30days),
        expectedmoveinsnext60days: n(row.expectedmoveinsnext60days),
        expectedmoveoutsnext60days: n(row.expectedmoveoutsnext60days),
        occupancynext60days: n(row.occupancynext60days),
      },
      mapping: {
        canonical_property_id: identity.canonical_property_id,
        community_id: identity.community_id || null,
        property_name: identity.property_name || identity.community_name || null,
        match_source: "property_identity_matrix",
      },
      integrity_note:
        "Only direct source fields with clear local table columns are promoted. Additional leasing-statistics fields remain in evidence_json until downstream contracts request them.",
    };

    normalized.push({
      id: `dw_leasingstatistics_daily:${metricDate}:${propertyCode}`,
      property_id: identity.canonical_property_id || propertyCode,
      community_id: identity.community_id || null,
      metric_date: metricDate,
      period_start: metricDate,
      period_end: metricDate,
      occupancy_rate: n(row.percentoccupied),
      leased_rate: n(row.percentleased),
      occupied_units: n(row.occupied),
      leased_units: null,
      available_units: n(row.vacantavailable),
      total_units: n(row.totalunits),
      leases_count: n(row.leased),
      cancellations_count: n(row.cancels),
      denials_count: n(row.denials),
      move_ins_count: n(row.moveins),
      move_outs_count: n(row.moveouts),
      booked_concession_dollars: null,
      booked_concession_lease_count: null,
      source_system: "data_warehouse.leasingstatistics_daily_bv",
      source_file: "data_warehouse_direct",
      evidence_json: JSON.stringify(evidence),
    });
  }
  return { normalized, unresolved, excluded };
}

function buildSql(rows, runDate, startedAt, completedAt) {
  const columns = [
    "id",
    "property_id",
    "community_id",
    "metric_date",
    "period_start",
    "period_end",
    "occupancy_rate",
    "leased_rate",
    "occupied_units",
    "leased_units",
    "available_units",
    "total_units",
    "leases_count",
    "cancellations_count",
    "denials_count",
    "move_ins_count",
    "move_outs_count",
    "booked_concession_dollars",
    "booked_concession_lease_count",
    "source_system",
    "source_file",
    "evidence_json",
    "updated_at",
  ];
  const statements = ["BEGIN;"];
  for (const row of rows) {
    const values = columns.map((column) => (column === "updated_at" ? completedAt : row[column]));
    statements.push(`INSERT INTO property_operating_metrics (${columns.join(", ")})
VALUES (${values.map(sqlLiteral).join(", ")})
ON CONFLICT(property_id, metric_date, source_system) DO UPDATE SET
${columns
  .filter((column) => !["id", "property_id", "metric_date", "source_system"].includes(column))
  .map((column) => `${column}=excluded.${column}`)
  .join(",\n")};`);
  }

  statements.push(`INSERT INTO data_collections (
  collection_date, collection_type, data_source, properties_collected, properties_failed,
  started_at, completed_at, status, properties_total, properties_success, properties_skipped, notes
) VALUES (
  ${sqlLiteral(runDate)}, 'daily', 'property_operating_metrics', ${rows.length}, 0,
  ${sqlLiteral(startedAt)}, ${sqlLiteral(completedAt)}, 'completed', ${rows.length}, ${rows.length}, 0,
  'Data Warehouse direct operating metrics supplied from dw_read.leasingstatistics_daily_bv.'
);`);
  statements.push("COMMIT;");
  return statements.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = resolveDataWarehousePassword({ keeperRecordTitle: args.keeperRecordTitle });
  ensureMssqlDependency(args.installDeps);
  const require = createRequire(import.meta.url);
  const sql = require(path.join(DEP_CACHE_DIR, "node_modules", "mssql"));
  const startedAt = new Date().toISOString();
  const identityByCode = loadIdentityMap(args.matrixPath);
  const codeResolutions = loadCodeResolutions(args.codeResolutionPath);

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

  let sourceRows;
  let effectiveRunDate = args.runDate;
  try {
    sourceRows = await fetchRows(pool, sql, args.runDate);
    if (sourceRows.length === 0) {
      const latestRunDate = await fetchLatestRunDate(pool);
      if (latestRunDate && latestRunDate !== args.runDate) {
        effectiveRunDate = latestRunDate;
        sourceRows = await fetchRows(pool, sql, effectiveRunDate);
      }
    }
  } finally {
    await pool.close();
  }

  const { normalized, unresolved, excluded } = normalizeRows(sourceRows, identityByCode, codeResolutions, effectiveRunDate);
  const completedAt = new Date().toISOString();
  if (normalized.length) {
    sqliteExec(args.dbPath, buildSql(normalized, effectiveRunDate, startedAt, completedAt));
  }

  const outputDir = path.resolve(args.outputRoot, `${effectiveRunDate}_${todayStamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const report = {
    source: "data_warehouse.leasingstatistics_daily_bv",
    credential_source: "Keeper/KSM",
    requested_run_date: args.runDate,
    effective_run_date: effectiveRunDate,
    source_rows: sourceRows.length,
    rows_upserted: normalized.length,
    unresolved_property_codes: unresolved,
    excluded_property_codes: excluded,
    table: "property_operating_metrics",
    posture: unresolved.length ? "partial_identity_gap" : "resolved_with_governed_exclusions",
    promoted_fields: [
      "occupancy_rate",
      "leased_rate",
      "occupied_units",
      "available_units",
      "total_units",
      "leases_count",
      "cancellations_count",
      "denials_count",
      "move_ins_count",
      "move_outs_count",
    ],
    intentionally_null_fields: ["leased_units", "booked_concession_dollars", "booked_concession_lease_count"],
    output_dir: outputDir,
  };
  writeJson(path.join(outputDir, "property_operating_metrics_supply_report.json"), report);

  console.log("Data Warehouse property operating metrics supply complete");
  console.log(`Requested run date: ${args.runDate}`);
  console.log(`Effective run date: ${effectiveRunDate}`);
  console.log(`Source rows: ${sourceRows.length}`);
  console.log(`Rows upserted: ${normalized.length}`);
  console.log(`Unresolved property codes: ${unresolved.length}`);
  console.log(`Excluded property codes: ${excluded.length}`);
  console.log(`Report: ${path.join(outputDir, "property_operating_metrics_supply_report.json")}`);
}

main().catch((error) => {
  console.error(`Property operating metrics supply failed: ${error.message}`);
  process.exit(1);
});
