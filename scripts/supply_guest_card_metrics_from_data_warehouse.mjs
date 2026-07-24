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
const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/direct_supply/guest_card_metrics";
const DEP_CACHE_DIR = path.join(os.homedir(), ".cache", "venterra-dw-harvest");
const SCRIPT_PATH = fileURLToPath(import.meta.url);

ensureMarketingOpsKeeperRuntimeOrReexec({ scriptPath: SCRIPT_PATH });

const CONTRACT_TO_DB = {
  RunDt: "run_date",
  " Days in Period": "days_in_period",
  property_cd: "property_code",
  property_name: "property_name",
  "GC This Period": "gc_this_period",
  "Init Cont-Quote": "init_cont_quote",
  "Init Cont- Phone": "init_cont_phone",
  "Init Cont-Apply": "init_cont_apply",
  "Init Cont-Tour": "init_cont_tour",
  "GC Prev Period": "gc_prev_period",
  "Prev Init Cont-Quote": "prev_init_cont_quote",
  "Prev Init Cont- Phone": "prev_init_cont_phone",
  "Prev Init Cont-Apply": "prev_init_cont_apply",
  "Prev Init Cont-Tour": "prev_init_cont_tour",
  "Quotes This Period": "quotes_this_period",
  "Prev Quotes": "prev_quotes",
  "Apps This Period": "apps_this_period",
  "Prev Apps": "prev_apps",
  "Pipe Apps This Period": "pipe_apps_this_period",
  "Pipe Prev Apps": "pipe_prev_apps",
  "IPT Appt This Period": "ipt_appt_this_period",
  "Prev IPT Appt": "prev_ipt_appt",
  "SGT Appt This Period": "sgt_appt_this_period",
  "Prev SGT Appt": "prev_sgt_appt",
};

const CONTRACT_COLUMNS = Object.keys(CONTRACT_TO_DB);
const DB_COLUMNS = Object.values(CONTRACT_TO_DB);
const INTEGER_COLUMNS = DB_COLUMNS.filter((column) => !["run_date", "property_code", "property_name"].includes(column));
const TRUSTED_CORE_COLUMNS = [
  "run_date",
  "days_in_period",
  "property_code",
  "property_name",
  "gc_this_period",
  "init_cont_quote",
  "init_cont_phone",
  "init_cont_apply",
  "init_cont_tour",
  "gc_prev_period",
  "prev_init_cont_quote",
  "prev_init_cont_phone",
  "prev_init_cont_apply",
  "prev_init_cont_tour",
  "apps_this_period",
  "prev_apps",
];
const ADVISORY_COLUMNS = [
  "quotes_this_period",
  "prev_quotes",
  "pipe_apps_this_period",
  "pipe_prev_apps",
  "ipt_appt_this_period",
  "prev_ipt_appt",
  "sgt_appt_this_period",
  "prev_sgt_appt",
];

function parseArgs(argv) {
  const args = {
    runDate: localDateString(),
    daysBack: 1,
    dbPath: DEFAULT_DB_PATH,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    server: DEFAULT_SERVER,
    database: DEFAULT_DATABASE,
    user: DEFAULT_USER,
    keeperRecordTitle: DEFAULT_KEEPER_RECORD_TITLE,
    installDeps: true,
    applyCanonical: false,
    trustedCoreOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--run-date") {
      args.runDate = next;
      i += 1;
    } else if (arg === "--days-back") {
      args.daysBack = Number(next);
      i += 1;
    } else if (arg === "--db") {
      args.dbPath = next;
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
    } else if (arg === "--apply-canonical") {
      args.applyCanonical = true;
    } else if (arg === "--trusted-core-only") {
      args.trustedCoreOnly = true;
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
  if (!Number.isInteger(args.daysBack) || args.daysBack < 1 || args.daysBack > 120) {
    throw new Error("--days-back must be an integer between 1 and 120.");
  }
  if (args.applyCanonical && !args.trustedCoreOnly) {
    throw new Error("Canonical updates require --trusted-core-only until advisory columns reconcile.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/supply_guest_card_metrics_from_data_warehouse.mjs [options]

Default behavior writes only the DW shadow table and a run report.

Options:
  --run-date YYYY-MM-DD        Export RunDt to supply, default today
  --days-back N                Completed days in period, default 1
  --db PATH                    SQLite DB path, default ${DEFAULT_DB_PATH}
  --output-root PATH           Output root, default ${DEFAULT_OUTPUT_ROOT}
  --apply-canonical            Also update guest_card_metrics
  --trusted-core-only          Required with --apply-canonical; preserves advisory columns when rows already exist
  --server HOST                SQL Server host, default ${DEFAULT_SERVER}
  --database NAME              SQL database, default ${DEFAULT_DATABASE}
  --user NAME                  SQL login, default ${DEFAULT_USER}
  --keeper-record-title TITLE  Keeper record title, default ${DEFAULT_KEEPER_RECORD_TITLE}
  --no-install                 Do not install cached mssql dependency
`);
}

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

function n(value) {
  return Number(value || 0);
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqliteExec(dbPath, sqlText) {
  const result = spawnSync("sqlite3", [path.resolve(dbPath)], {
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

async function fetchRows(pool, sql, runDate, daysBack) {
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
    for (const contractColumn of CONTRACT_COLUMNS) {
      const dbColumn = CONTRACT_TO_DB[contractColumn];
      const value = row[contractColumn];
      out[dbColumn] = INTEGER_COLUMNS.includes(dbColumn) ? n(value) : String(value ?? "");
    }
    return out;
  });
}

function buildShadowSql(rows, metadata) {
  const columns = [
    ...DB_COLUMNS,
    "trusted_core_posture",
    "advisory_posture",
    "source_lineage",
    "source_metadata_json",
    "supplied_at",
  ];
  const statements = [
    "BEGIN;",
    `CREATE TABLE IF NOT EXISTS guest_card_metrics_dw_direct (
      run_date DATE NOT NULL,
      days_in_period INTEGER,
      property_code TEXT NOT NULL,
      property_name TEXT,
      gc_this_period INTEGER,
      init_cont_quote INTEGER,
      init_cont_phone INTEGER,
      init_cont_apply INTEGER,
      init_cont_tour INTEGER,
      gc_prev_period INTEGER,
      prev_init_cont_quote INTEGER,
      prev_init_cont_phone INTEGER,
      prev_init_cont_apply INTEGER,
      prev_init_cont_tour INTEGER,
      quotes_this_period INTEGER,
      prev_quotes INTEGER,
      apps_this_period INTEGER,
      prev_apps INTEGER,
      pipe_apps_this_period INTEGER,
      pipe_prev_apps INTEGER,
      ipt_appt_this_period INTEGER,
      prev_ipt_appt INTEGER,
      sgt_appt_this_period INTEGER,
      prev_sgt_appt INTEGER,
      trusted_core_posture TEXT NOT NULL,
      advisory_posture TEXT NOT NULL,
      source_lineage TEXT NOT NULL,
      source_metadata_json TEXT NOT NULL,
      supplied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(run_date, property_code)
    );`,
  ];
  for (const row of rows) {
    const values = [
      ...DB_COLUMNS.map((column) => row[column]),
      "trusted_core",
      "degraded_advisory",
      metadata.source_lineage,
      JSON.stringify(metadata),
      metadata.supplied_at,
    ];
    statements.push(`INSERT INTO guest_card_metrics_dw_direct (${columns.join(", ")})
VALUES (${values.map(sqlLiteral).join(", ")})
ON CONFLICT(run_date, property_code) DO UPDATE SET
${columns.filter((column) => !["run_date", "property_code"].includes(column)).map((column) => `${column}=excluded.${column}`).join(",\n")};`);
  }
  statements.push("COMMIT;");
  return statements.join("\n");
}

function buildCanonicalTrustedCoreSql(rows, metadata) {
  const insertColumns = [...DB_COLUMNS, "source_file", "collection_id", "imported_at"];
  const updateColumns = [
    ...TRUSTED_CORE_COLUMNS.filter((column) => !["run_date", "property_code"].includes(column)),
    "source_file",
    "collection_id",
    "imported_at",
  ];
  const statements = [
    "BEGIN;",
    `CREATE TABLE IF NOT EXISTS guest_card_metrics (
      guest_card_id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date DATE NOT NULL,
      days_in_period INTEGER,
      property_code TEXT NOT NULL,
      property_name TEXT,
      gc_this_period INTEGER,
      init_cont_quote INTEGER,
      init_cont_phone INTEGER,
      init_cont_apply INTEGER,
      init_cont_tour INTEGER,
      gc_prev_period INTEGER,
      prev_init_cont_quote INTEGER,
      prev_init_cont_phone INTEGER,
      prev_init_cont_apply INTEGER,
      prev_init_cont_tour INTEGER,
      quotes_this_period INTEGER,
      prev_quotes INTEGER,
      apps_this_period INTEGER,
      prev_apps INTEGER,
      pipe_apps_this_period INTEGER,
      pipe_prev_apps INTEGER,
      ipt_appt_this_period INTEGER,
      prev_ipt_appt INTEGER,
      sgt_appt_this_period INTEGER,
      prev_sgt_appt INTEGER,
      source_file TEXT,
      collection_id INTEGER,
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(run_date, property_code)
    );`,
  ];
  for (const row of rows) {
    const values = DB_COLUMNS.map((column) => {
      if (ADVISORY_COLUMNS.includes(column)) return null;
      return row[column];
    });
    values.push(metadata.source_lineage, null, metadata.supplied_at);
    statements.push(`INSERT INTO guest_card_metrics (${insertColumns.join(", ")})
VALUES (${values.map(sqlLiteral).join(", ")})
ON CONFLICT(run_date, property_code) DO UPDATE SET
${updateColumns.map((column) => `${column}=excluded.${column}`).join(",\n")};`);
  }
  statements.push("COMMIT;");
  return statements.join("\n");
}

function buildCollectionBookkeepingSql(rows, metadata) {
  const notes = [
    `Data Warehouse direct guest-card supply completed from ${metadata.source_lineage}.`,
    "Trusted core guest-card/contact/app fields are current; advisory quote/pipeline/tour fields remain degraded_advisory.",
  ].join(" ");
  return `
BEGIN;
INSERT INTO data_collections (
  collection_date,
  collection_type,
  data_source,
  properties_collected,
  properties_failed,
  started_at,
  completed_at,
  status,
  created_at,
  properties_total,
  properties_success,
  properties_skipped,
  notes
) VALUES (
  ${sqlLiteral(metadata.run_date)},
  'daily',
  'guest_card',
  ${rows.length},
  0,
  ${sqlLiteral(metadata.supplied_at)},
  ${sqlLiteral(metadata.supplied_at)},
  'completed',
  ${sqlLiteral(metadata.supplied_at)},
  ${rows.length},
  ${rows.length},
  0,
  ${sqlLiteral(notes)}
);
UPDATE collection_retry_queue
SET status = 'resolved',
    retry_disposition = 'resolved',
    resolved_at = ${sqlLiteral(metadata.supplied_at)},
    updated_at = ${sqlLiteral(metadata.supplied_at)},
    notes = COALESCE(notes || ' | ', '') || 'Resolved by Data Warehouse direct guest-card supply.'
WHERE collection_date = ${sqlLiteral(metadata.run_date)}
  AND data_source = 'guest_card'
  AND status NOT IN ('resolved', 'cancelled');
COMMIT;`;
}

function totals(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.guest_cards += n(row.gc_this_period);
      acc.previous_guest_cards += n(row.gc_prev_period);
      acc.online_apps += n(row.apps_this_period);
      acc.previous_online_apps += n(row.prev_apps);
      acc.quotes_advisory += n(row.quotes_this_period);
      acc.pipeline_apps_advisory += n(row.pipe_apps_this_period);
      acc.tours_advisory += n(row.ipt_appt_this_period) + n(row.sgt_appt_this_period);
      return acc;
    },
    {
      guest_cards: 0,
      previous_guest_cards: 0,
      online_apps: 0,
      previous_online_apps: 0,
      quotes_advisory: 0,
      pipeline_apps_advisory: 0,
      tours_advisory: 0,
    },
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = resolveDataWarehousePassword({ keeperRecordTitle: args.keeperRecordTitle });
  ensureMssqlDependency(args.installDeps);
  const require = createRequire(import.meta.url);
  const sql = require(path.join(DEP_CACHE_DIR, "node_modules", "mssql"));
  const suppliedAt = new Date().toISOString();
  const sourceLineage = `data_warehouse_direct:${args.runDate}:days_back_${args.daysBack}`;

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

  let rows;
  try {
    rows = await fetchRows(pool, sql, args.runDate, args.daysBack);
  } finally {
    await pool.close();
  }

  const metadata = {
    source_lineage: sourceLineage,
    supplied_at: suppliedAt,
    run_date: args.runDate,
    days_back: args.daysBack,
    credential_source: "Keeper/KSM",
    trusted_core_columns: TRUSTED_CORE_COLUMNS,
    advisory_columns: ADVISORY_COLUMNS,
    trust_note:
      "Trusted core columns are guest-card/contact/app fields that reconciled cleanly in the proof set. Quote, pipeline-app, and tour columns remain degraded_advisory until source drift is explained.",
  };

  sqliteExec(args.dbPath, buildShadowSql(rows, metadata));
  sqliteExec(args.dbPath, buildCollectionBookkeepingSql(rows, metadata));
  let canonical_rows_upserted = 0;
  if (args.applyCanonical) {
    sqliteExec(args.dbPath, buildCanonicalTrustedCoreSql(rows, metadata));
    canonical_rows_upserted = rows.length;
  }

  const outputDir = path.resolve(args.outputRoot, `${args.runDate}_${todayStamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const report = {
    mode: args.applyCanonical ? "shadow_and_canonical_trusted_core" : "shadow_only",
    run_date: args.runDate,
    days_back: args.daysBack,
    rows_supplied: rows.length,
    shadow_table: "guest_card_metrics_dw_direct",
    canonical_table: "guest_card_metrics",
    canonical_rows_upserted,
    trusted_core_columns: TRUSTED_CORE_COLUMNS,
    advisory_columns: ADVISORY_COLUMNS,
    totals: totals(rows),
    source_lineage: sourceLineage,
    output_dir: outputDir,
  };
  writeJson(path.join(outputDir, "direct_supply_report.json"), report);

  console.log("Data Warehouse direct guest-card supply complete");
  console.log(`Mode: ${report.mode}`);
  console.log(`Run date: ${args.runDate}`);
  console.log(`Rows supplied to shadow: ${rows.length}`);
  console.log(`Canonical rows upserted: ${canonical_rows_upserted}`);
  console.log(`Trusted guest cards: ${report.totals.guest_cards}`);
  console.log(`Trusted online apps: ${report.totals.online_apps}`);
  console.log(`Advisory quotes: ${report.totals.quotes_advisory}`);
  console.log(`Advisory pipeline apps: ${report.totals.pipeline_apps_advisory}`);
  console.log(`Advisory tours: ${report.totals.tours_advisory}`);
  console.log(`Report: ${path.join(outputDir, "direct_supply_report.json")}`);
}

main().catch((error) => {
  console.error(`Direct supply failed: ${error.message}`);
  process.exit(1);
});
