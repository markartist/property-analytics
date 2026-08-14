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
const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/direct_supply/property_metadata";
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
    outputRoot: DEFAULT_OUTPUT_ROOT,
    server: DEFAULT_SERVER,
    database: DEFAULT_DATABASE,
    user: DEFAULT_USER,
    keeperRecordTitle: DEFAULT_KEEPER_RECORD_TITLE,
    installDeps: true,
    applyMatrixAnnotations: false,
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
    } else if (arg === "--apply-matrix-annotations") {
      args.applyMatrixAnnotations = true;
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
  console.log(`Usage: node scripts/supply_property_metadata_from_data_warehouse.mjs [options]

Default behavior writes a DW shadow metadata table and report.

Options:
  --run-date YYYY-MM-DD          Evidence run date, default today
  --db PATH                      SQLite DB path, default ${DEFAULT_DB_PATH}
  --matrix PATH                  Property identity matrix, default ${DEFAULT_MATRIX_PATH}
  --output-root PATH             Output root, default ${DEFAULT_OUTPUT_ROOT}
  --apply-matrix-annotations     Add non-destructive DW metadata annotations to exact-matched matrix records
  --server HOST                  SQL Server host, default ${DEFAULT_SERVER}
  --database NAME                SQL database, default ${DEFAULT_DATABASE}
  --user NAME                    SQL login, default ${DEFAULT_USER}
  --keeper-record-title TITLE    Keeper record title, default ${DEFAULT_KEEPER_RECORD_TITLE}
  --no-install                   Do not install cached mssql dependency
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

function loadMatrix(matrixPath) {
  return JSON.parse(fs.readFileSync(path.resolve(matrixPath), "utf8"));
}

function matrixByCode(matrix) {
  const byCode = new Map();
  for (const record of matrix.properties || []) {
    if (record.property_code) byCode.set(String(record.property_code).toUpperCase(), record);
  }
  return byCode;
}

function n(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchRows(pool) {
  const result = await pool.request().query(`
SELECT
  property_cd,
  company_id,
  database_id,
  status_cd,
  encasa_active_yn,
  reports_active_yn,
  active_for_reporting_comparison_yn,
  lease_up_property_yn,
  acquisition_dt,
  lease_up_start_dt,
  lease_up_end_dt,
  sold_dt,
  property_class,
  construction_year,
  property_name,
  alias,
  street_address,
  city,
  state_province_cd,
  zip_postal_code,
  region_id,
  region_desc,
  market,
  submarket,
  units,
  avg_unit_sqft,
  count_apts,
  count_apts_ex_down,
  cm,
  cm_email,
  blm,
  blm_email,
  rm,
  rm_email,
  srm,
  srm_email,
  mm,
  mm_email
FROM dw_read.property_bv
WHERE status_cd = 'active'
ORDER BY property_cd;
`);
  return result.recordset;
}

function normalizeRows(rows, matrix, runDate) {
  const byCode = matrixByCode(matrix);
  const normalized = [];
  const unresolved = [];
  const matrixDeltas = [];

  for (const row of rows) {
    const propertyCode = String(row.property_cd || "").trim().toUpperCase();
    const identity = byCode.get(propertyCode);
    if (!identity) {
      unresolved.push(propertyCode);
      continue;
    }

    const evidence = {
      source_view: "dw_read.property_bv",
      source_property_cd: propertyCode,
      run_date: runDate,
      identity_match_source: "property_identity_matrix.property_code",
      sensitive_fields_suppressed: ["cm_email", "blm_email", "rm_email", "srm_email", "mm_email"],
    };
    normalized.push({
      property_code: propertyCode,
      canonical_property_id: identity.canonical_property_id || propertyCode,
      community_id: identity.community_id || null,
      property_name: row.property_name || identity.property_name || null,
      alias: row.alias || null,
      status_cd: row.status_cd || null,
      company_id: row.company_id ? Number(row.company_id) : null,
      database_id: row.database_id || null,
      region_id: n(row.region_id),
      region_desc: row.region_desc || null,
      market: row.market || null,
      submarket: row.submarket || null,
      city: row.city || null,
      state_province_cd: row.state_province_cd || null,
      zip_postal_code: row.zip_postal_code || null,
      units: n(row.units),
      count_apts: n(row.count_apts),
      count_apts_ex_down: n(row.count_apts_ex_down),
      avg_unit_sqft: n(row.avg_unit_sqft),
      lease_up_property_yn: row.lease_up_property_yn === null || row.lease_up_property_yn === undefined ? null : Number(row.lease_up_property_yn),
      acquisition_dt: row.acquisition_dt ? new Date(row.acquisition_dt).toISOString().slice(0, 10) : null,
      lease_up_start_dt: row.lease_up_start_dt ? new Date(row.lease_up_start_dt).toISOString().slice(0, 10) : null,
      lease_up_end_dt: row.lease_up_end_dt ? new Date(row.lease_up_end_dt).toISOString().slice(0, 10) : null,
      evidence_json: JSON.stringify(evidence),
    });

    const comparisons = [
      ["encasa_region", identity.encasa_region || null, row.region_desc || null],
      ["unit_count", identity.unit_count ?? null, n(row.units)],
      ["city", identity.city || null, row.city || null],
      ["state", identity.state || null, row.state_province_cd || null],
    ];
    for (const [field, matrixValue, dwValue] of comparisons) {
      if (String(matrixValue ?? "") !== String(dwValue ?? "")) {
        matrixDeltas.push({
          property_code: propertyCode,
          field,
          matrix_value: matrixValue,
          data_warehouse_value: dwValue,
        });
      }
    }
  }

  return { normalized, unresolved, matrixDeltas };
}

function buildSql(rows, suppliedAt) {
  const columns = [
    "property_code",
    "canonical_property_id",
    "community_id",
    "property_name",
    "alias",
    "status_cd",
    "company_id",
    "database_id",
    "region_id",
    "region_desc",
    "market",
    "submarket",
    "city",
    "state_province_cd",
    "zip_postal_code",
    "units",
    "count_apts",
    "count_apts_ex_down",
    "avg_unit_sqft",
    "lease_up_property_yn",
    "acquisition_dt",
    "lease_up_start_dt",
    "lease_up_end_dt",
    "evidence_json",
    "supplied_at",
  ];
  const statements = [
    "BEGIN;",
    `CREATE TABLE IF NOT EXISTS property_metadata_dw_direct (
      property_code TEXT PRIMARY KEY,
      canonical_property_id TEXT NOT NULL,
      community_id TEXT,
      property_name TEXT,
      alias TEXT,
      status_cd TEXT,
      company_id INTEGER,
      database_id TEXT,
      region_id INTEGER,
      region_desc TEXT,
      market TEXT,
      submarket TEXT,
      city TEXT,
      state_province_cd TEXT,
      zip_postal_code TEXT,
      units INTEGER,
      count_apts INTEGER,
      count_apts_ex_down INTEGER,
      avg_unit_sqft REAL,
      lease_up_property_yn INTEGER,
      acquisition_dt TEXT,
      lease_up_start_dt TEXT,
      lease_up_end_dt TEXT,
      evidence_json TEXT NOT NULL,
      supplied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
  ];

  for (const row of rows) {
    const values = columns.map((column) => (column === "supplied_at" ? suppliedAt : row[column]));
    statements.push(`INSERT INTO property_metadata_dw_direct (${columns.join(", ")})
VALUES (${values.map(sqlLiteral).join(", ")})
ON CONFLICT(property_code) DO UPDATE SET
${columns
  .filter((column) => column !== "property_code")
  .map((column) => `${column}=excluded.${column}`)
  .join(",\n")};`);
  }
  statements.push("COMMIT;");
  return statements.join("\n");
}

function applyMatrixAnnotations(matrixPath, matrix, rows, runDate) {
  const byCode = new Map(rows.map((row) => [row.property_code, row]));
  for (const record of matrix.properties || []) {
    const propertyCode = String(record.property_code || "").toUpperCase();
    const row = byCode.get(propertyCode);
    if (!row) continue;
    record.source_refs = { ...(record.source_refs || {}), data_warehouse_property_bv: true };
    record.data_warehouse_property_bv = {
      last_verified_date: runDate,
      status_cd: row.status_cd,
      region_desc: row.region_desc,
      market: row.market,
      submarket: row.submarket,
      units: row.units,
      count_apts: row.count_apts,
      count_apts_ex_down: row.count_apts_ex_down,
    };
  }
  fs.writeFileSync(path.resolve(matrixPath), `${JSON.stringify(matrix, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = resolveDataWarehousePassword({ keeperRecordTitle: args.keeperRecordTitle });
  ensureMssqlDependency(args.installDeps);
  const require = createRequire(import.meta.url);
  const sql = require(path.join(DEP_CACHE_DIR, "node_modules", "mssql"));
  const suppliedAt = new Date().toISOString();
  const matrix = loadMatrix(args.matrixPath);

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
  try {
    sourceRows = await fetchRows(pool);
  } finally {
    await pool.close();
  }

  const { normalized, unresolved, matrixDeltas } = normalizeRows(sourceRows, matrix, args.runDate);
  if (normalized.length) {
    sqliteExec(args.dbPath, buildSql(normalized, suppliedAt));
  }
  if (args.applyMatrixAnnotations) {
    applyMatrixAnnotations(args.matrixPath, matrix, normalized, args.runDate);
  }

  const outputDir = path.resolve(args.outputRoot, `${args.runDate}_${todayStamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const report = {
    source: "data_warehouse.property_bv",
    credential_source: "Keeper/KSM",
    run_date: args.runDate,
    source_rows: sourceRows.length,
    rows_supplied: normalized.length,
    unresolved_property_codes: unresolved,
    matrix_deltas: matrixDeltas,
    shadow_table: "property_metadata_dw_direct",
    matrix_annotations_applied: args.applyMatrixAnnotations,
    posture: unresolved.length ? "partial_identity_gap" : "complete_identity_match",
    output_dir: outputDir,
  };
  writeJson(path.join(outputDir, "property_metadata_supply_report.json"), report);

  console.log("Data Warehouse property metadata supply complete");
  console.log(`Run date: ${args.runDate}`);
  console.log(`Source rows: ${sourceRows.length}`);
  console.log(`Rows supplied: ${normalized.length}`);
  console.log(`Unresolved property codes: ${unresolved.length}`);
  console.log(`Matrix deltas flagged: ${matrixDeltas.length}`);
  console.log(`Matrix annotations applied: ${args.applyMatrixAnnotations}`);
  console.log(`Report: ${path.join(outputDir, "property_metadata_supply_report.json")}`);
}

main().catch((error) => {
  console.error(`Property metadata supply failed: ${error.message}`);
  process.exit(1);
});
