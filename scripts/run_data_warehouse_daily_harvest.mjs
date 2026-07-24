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
const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/daily_harvest";
const DEP_CACHE_DIR = path.join(os.homedir(), ".cache", "venterra-dw-harvest");
const SCRIPT_PATH = fileURLToPath(import.meta.url);

ensureMarketingOpsKeeperRuntimeOrReexec({ scriptPath: SCRIPT_PATH });

function parseArgs(argv) {
  const args = {
    daysBack: 1,
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
    if (arg === "--days-back") {
      args.daysBack = Number(next);
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

  if (!Number.isInteger(args.daysBack) || args.daysBack < 1 || args.daysBack > 120) {
    throw new Error("--days-back must be an integer between 1 and 120.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/run_data_warehouse_daily_harvest.mjs [options]

Options:
  --days-back N                  Completed days to harvest, default 1
  --output-root PATH             Output root, default ${DEFAULT_OUTPUT_ROOT}
  --server HOST                  SQL Server host, default ${DEFAULT_SERVER}
  --database NAME                SQL database, default ${DEFAULT_DATABASE}
  --user NAME                    SQL login, default ${DEFAULT_USER}
  --keeper-record-title TITLE    Keeper record title, default ${DEFAULT_KEEPER_RECORD_TITLE}
  --no-install                   Do not install the cached mssql dependency
`);
}

function ensureMssqlDependency(installDeps) {
  const packagePath = path.join(DEP_CACHE_DIR, "node_modules", "mssql", "package.json");
  if (fs.existsSync(packagePath)) {
    return;
  }
  if (!installDeps) {
    throw new Error(`mssql dependency not found at ${packagePath}. Re-run without --no-install.`);
  }
  fs.mkdirSync(DEP_CACHE_DIR, { recursive: true });
  const result = spawnSync("npm", ["install", "--prefix", DEP_CACHE_DIR, "mssql@11"], {
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to install cached mssql dependency: ${result.stderr || result.stdout}`);
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function n(value) {
  return Number(value || 0);
}

function pct(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function asDate(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = resolveDataWarehousePassword({ keeperRecordTitle: args.keeperRecordTitle });
  ensureMssqlDependency(args.installDeps);
  const require = createRequire(import.meta.url);
  const sql = require(path.join(DEP_CACHE_DIR, "node_modules", "mssql"));

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
    requestTimeout: 90000,
    connectionTimeout: 15000,
  });

  try {
    const request = pool.request();
    request.input("daysBack", sql.Int, args.daysBack);
    const result = await request.query(`
DECLARE @run_dt date = CAST(GETDATE() AS date);
DECLARE @window_end date = @run_dt;
DECLARE @window_start date = DATEADD(day, @daysBack * -1, @window_end);
DECLARE @prev_window_start date = DATEADD(day, @daysBack * -2, @window_end);

SELECT
  @@SERVERNAME AS server_name,
  DB_NAME() AS database_name,
  SYSTEM_USER AS login_name,
  GETDATE() AS server_time,
  CONVERT(varchar(10), @run_dt, 23) AS run_date,
  CONVERT(varchar(10), @window_start, 23) AS window_start,
  CONVERT(varchar(10), @window_end, 23) AS window_end,
  CONVERT(varchar(10), @prev_window_start, 23) AS previous_window_start,
  @daysBack AS days_back;

WITH active_properties AS (
  SELECT property_cd, property_name, alias, state_province_cd
  FROM dw_read.property_bv
  WHERE status_cd = 'active'
),
guest_cards AS (
  SELECT
    property_cd,
    COUNT(*) AS guest_cards,
    SUM(CASE WHEN init_contact_type_dv = 'q' THEN 1 ELSE 0 END) AS init_quote,
    SUM(CASE WHEN init_contact_type_dv = 'p' THEN 1 ELSE 0 END) AS init_phone,
    SUM(CASE WHEN init_contact_type_dv = 'i' THEN 1 ELSE 0 END) AS init_apply_online,
    SUM(CASE WHEN init_contact_type_dv = 't' THEN 1 ELSE 0 END) AS init_sched_tour,
    SUM(CASE WHEN init_contact_type_dv = 'e' THEN 1 ELSE 0 END) AS init_email,
    SUM(CASE WHEN init_contact_type_dv = 'c' THEN 1 ELSE 0 END) AS init_chat,
    SUM(CASE WHEN init_contact_type_dv = 'x' THEN 1 ELSE 0 END) AS init_text,
    COUNT(DISTINCT NULLIF(marketing_src_cd, '')) AS distinct_marketing_sources,
    COUNT(DISTINCT NULLIF(converting_src_cd, '')) AS distinct_converting_sources
  FROM dw_read.prospect_bv
  WHERE created_dtt >= @window_start AND created_dtt < @window_end
  GROUP BY property_cd
),
prev_guest_cards AS (
  SELECT property_cd, COUNT(*) AS prev_guest_cards
  FROM dw_read.prospect_bv
  WHERE created_dtt >= @prev_window_start AND created_dtt < @window_start
  GROUP BY property_cd
),
quotes AS (
  SELECT property_cd, COUNT(*) AS portal_quotes
  FROM dw_read.prospect_quote_bv
  WHERE quote_origin_dv = 'portal' AND created_dt >= @window_start AND created_dt < @window_end
  GROUP BY property_cd
),
apps AS (
  SELECT property_cd, COUNT(*) AS online_apps
  FROM dw_read.online_application_bv
  WHERE created_dtt >= @window_start AND created_dtt < @window_end
  GROUP BY property_cd
),
pipeline_apps AS (
  SELECT property_cd, COUNT(*) AS pipeline_apps
  FROM dbo.dw_pipeline_applications
  WHERE created_dtt >= @window_start AND created_dtt < @window_end
  GROUP BY property_cd
),
tours AS (
  SELECT
    pr.property_cd,
    SUM(CASE WHEN pl.tour_type_dv = 'ipt' AND pl.follow_up_type_dv = 'SA' THEN 1 ELSE 0 END) AS ipt_appts,
    SUM(CASE WHEN pl.tour_type_dv = 'sgt' AND pl.follow_up_type_dv = 'SA' THEN 1 ELSE 0 END) AS sgt_appts
  FROM dbo.dw_prospect_log_entry pl
  INNER JOIN dw_read.prospect_bv pr ON pr.prospect_id = pl.prospect_id
  WHERE pl.created_dtt >= @window_start
    AND pl.created_dtt < @window_end
    AND pl.tour_type_dv IN ('ipt', 'sgt')
    AND pl.follow_up_type_dv = 'SA'
  GROUP BY pr.property_cd
),
lease_events AS (
  SELECT property_cd, COUNT(*) AS advisory_lease_events
  FROM dw_read.prospect_bv
  WHERE leased_dt >= @window_start AND leased_dt < @window_end
  GROUP BY property_cd
)
SELECT
  CONVERT(varchar(10), @run_dt, 23) AS run_date,
  CONVERT(varchar(10), @window_start, 23) AS window_start,
  CONVERT(varchar(10), @window_end, 23) AS window_end,
  p.property_cd,
  p.property_name,
  p.alias,
  p.state_province_cd,
  COALESCE(gc.guest_cards, 0) AS guest_cards,
  COALESCE(prev.prev_guest_cards, 0) AS previous_guest_cards,
  COALESCE(gc.guest_cards, 0) - COALESCE(prev.prev_guest_cards, 0) AS guest_card_delta,
  COALESCE(gc.init_quote, 0) AS init_quote,
  COALESCE(gc.init_phone, 0) AS init_phone,
  COALESCE(gc.init_apply_online, 0) AS init_apply_online,
  COALESCE(gc.init_sched_tour, 0) AS init_sched_tour,
  COALESCE(gc.init_email, 0) AS init_email,
  COALESCE(gc.init_chat, 0) AS init_chat,
  COALESCE(gc.init_text, 0) AS init_text,
  COALESCE(q.portal_quotes, 0) AS portal_quotes,
  COALESCE(a.online_apps, 0) AS online_apps,
  COALESCE(pa.pipeline_apps, 0) AS pipeline_apps,
  COALESCE(t.ipt_appts, 0) AS ipt_appts,
  COALESCE(t.sgt_appts, 0) AS sgt_appts,
  COALESCE(le.advisory_lease_events, 0) AS advisory_lease_events,
  COALESCE(gc.distinct_marketing_sources, 0) AS distinct_marketing_sources,
  COALESCE(gc.distinct_converting_sources, 0) AS distinct_converting_sources
FROM active_properties p
LEFT JOIN guest_cards gc ON gc.property_cd = p.property_cd
LEFT JOIN prev_guest_cards prev ON prev.property_cd = p.property_cd
LEFT JOIN quotes q ON q.property_cd = p.property_cd
LEFT JOIN apps a ON a.property_cd = p.property_cd
LEFT JOIN pipeline_apps pa ON pa.property_cd = p.property_cd
LEFT JOIN tours t ON t.property_cd = p.property_cd
LEFT JOIN lease_events le ON le.property_cd = p.property_cd
ORDER BY p.alias;

WITH source_rows AS (
  SELECT
    pr.property_cd,
    p.property_name,
    COALESCE(NULLIF(pr.marketing_src_desc, ''), NULLIF(pr.marketing_src_cd, ''), 'Unknown') AS marketing_source,
    COALESCE(NULLIF(pr.converting_src_desc, ''), NULLIF(pr.converting_src_cd, ''), 'Unknown') AS converting_source,
    COUNT(*) AS guest_cards
  FROM dw_read.prospect_bv pr
  INNER JOIN dw_read.property_bv p ON p.property_cd = pr.property_cd
  WHERE p.status_cd = 'active'
    AND pr.created_dtt >= @window_start
    AND pr.created_dtt < @window_end
  GROUP BY
    pr.property_cd,
    p.property_name,
    COALESCE(NULLIF(pr.marketing_src_desc, ''), NULLIF(pr.marketing_src_cd, ''), 'Unknown'),
    COALESCE(NULLIF(pr.converting_src_desc, ''), NULLIF(pr.converting_src_cd, ''), 'Unknown')
)
SELECT TOP 250
  property_cd,
  property_name,
  marketing_source,
  converting_source,
  guest_cards
FROM source_rows
ORDER BY guest_cards DESC, property_name, marketing_source, converting_source;

SELECT
  'dw_read.prospect_bv.created_dtt' AS source,
  COUNT_BIG(*) AS rows_all,
  SUM(CASE WHEN created_dtt >= @window_start AND created_dtt < @window_end THEN 1 ELSE 0 END) AS rows_in_window,
  MIN(created_dtt) AS min_dt,
  MAX(created_dtt) AS max_dt
FROM dw_read.prospect_bv
UNION ALL
SELECT
  'dw_read.prospect_quote_bv.created_dt',
  COUNT_BIG(*),
  SUM(CASE WHEN created_dt >= @window_start AND created_dt < @window_end THEN 1 ELSE 0 END),
  MIN(CAST(created_dt AS datetime)),
  MAX(CAST(created_dt AS datetime))
FROM dw_read.prospect_quote_bv
UNION ALL
SELECT
  'dw_read.online_application_bv.created_dtt',
  COUNT_BIG(*),
  SUM(CASE WHEN created_dtt >= @window_start AND created_dtt < @window_end THEN 1 ELSE 0 END),
  MIN(created_dtt),
  MAX(created_dtt)
FROM dw_read.online_application_bv
UNION ALL
SELECT
  'dbo.dw_pipeline_applications.created_dtt',
  COUNT_BIG(*),
  SUM(CASE WHEN created_dtt >= @window_start AND created_dtt < @window_end THEN 1 ELSE 0 END),
  MIN(created_dtt),
  MAX(created_dtt)
FROM dbo.dw_pipeline_applications
UNION ALL
SELECT
  'dbo.dw_prospect_log_entry.created_dtt',
  COUNT_BIG(*),
  SUM(CASE WHEN created_dtt >= @window_start AND created_dtt < @window_end THEN 1 ELSE 0 END),
  MIN(created_dtt),
  MAX(created_dtt)
FROM dbo.dw_prospect_log_entry;

SELECT
  COUNT_BIG(*) AS future_row_count,
  COUNT(DISTINCT le.prospect_id) AS distinct_prospects,
  COUNT(DISTINCT pr.property_cd) AS distinct_properties,
  MIN(le.created_dtt) AS min_future_created_dtt,
  MAX(le.created_dtt) AS max_future_created_dtt
FROM dbo.dw_prospect_log_entry le
LEFT JOIN dw_read.prospect_bv pr ON pr.prospect_id = le.prospect_id
WHERE le.created_dtt > DATEADD(day, 1, GETDATE());
`);

    const meta = result.recordsets[0][0];
    const propertyRows = result.recordsets[1];
    const sourceRows = result.recordsets[2];
    const freshnessRows = result.recordsets[3];
    const prospectLogFutureSummary = result.recordsets[4]?.[0] || null;
    const runStamp = todayStamp();
    const runDate = String(meta.run_date);
    const outputDir = path.resolve(args.outputRoot, `${runDate}_${runStamp}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const totals = propertyRows.reduce((acc, row) => {
      for (const key of [
        "guest_cards",
        "previous_guest_cards",
        "guest_card_delta",
        "portal_quotes",
        "online_apps",
        "pipeline_apps",
        "ipt_appts",
        "sgt_appts",
        "advisory_lease_events",
        "init_quote",
        "init_phone",
        "init_apply_online",
        "init_sched_tour",
      ]) {
        acc[key] = n(acc[key]) + n(row[key]);
      }
      return acc;
    }, {});

    const activeProperties = propertyRows.length;
    const propertiesWithGuestCards = propertyRows.filter((row) => n(row.guest_cards) > 0).length;
    const topGuestCardProperties = [...propertyRows]
      .sort((a, b) => n(b.guest_cards) - n(a.guest_cards))
      .slice(0, 10)
      .map((row) => ({
        property_cd: row.property_cd,
        property_name: row.property_name,
        guest_cards: n(row.guest_cards),
        portal_quotes: n(row.portal_quotes),
        online_apps: n(row.online_apps),
        tour_appts: n(row.ipt_appts) + n(row.sgt_appts),
      }));

    const watchItems = [];
    for (const row of propertyRows) {
      const guestCards = n(row.guest_cards);
      const quoteRate = pct(n(row.portal_quotes), guestCards);
      const appRate = pct(n(row.online_apps), guestCards);
      const tourCount = n(row.ipt_appts) + n(row.sgt_appts);
      if (guestCards >= 5 && n(row.portal_quotes) === 0) {
        watchItems.push({
          severity: "watch",
          watch_type: "guest_cards_without_portal_quotes",
          property_cd: row.property_cd,
          property_name: row.property_name,
          detail: `${guestCards} guest cards and 0 portal quotes in the harvest window.`,
        });
      }
      if (guestCards >= 5 && n(row.online_apps) === 0) {
        watchItems.push({
          severity: "watch",
          watch_type: "guest_cards_without_online_apps",
          property_cd: row.property_cd,
          property_name: row.property_name,
          detail: `${guestCards} guest cards and 0 online applications in the harvest window.`,
        });
      }
      if (guestCards >= 8 && tourCount === 0) {
        watchItems.push({
          severity: "watch",
          watch_type: "guest_cards_without_tour_appts",
          property_cd: row.property_cd,
          property_name: row.property_name,
          detail: `${guestCards} guest cards and 0 IPT/SGT scheduled appointments in the harvest window.`,
        });
      }
      if (guestCards >= 10 && quoteRate !== null && quoteRate < 10) {
        watchItems.push({
          severity: "watch",
          watch_type: "low_portal_quote_rate",
          property_cd: row.property_cd,
          property_name: row.property_name,
          detail: `Portal quote rate is ${quoteRate}% on ${guestCards} guest cards.`,
        });
      }
      if (guestCards >= 10 && appRate !== null && appRate < 5) {
        watchItems.push({
          severity: "watch",
          watch_type: "low_online_app_rate",
          property_cd: row.property_cd,
          property_name: row.property_name,
          detail: `Online application rate is ${appRate}% on ${guestCards} guest cards.`,
        });
      }
    }

    const outputFiles = {
      property_funnel_csv: path.join(outputDir, "property_funnel.csv"),
      source_mix_csv: path.join(outputDir, "source_mix.csv"),
      watch_items_csv: path.join(outputDir, "watch_items.csv"),
      data_quality_items_csv: path.join(outputDir, "data_quality_items.csv"),
      freshness_csv: path.join(outputDir, "source_freshness.csv"),
      summary_json: path.join(outputDir, "summary.json"),
    };

    const serverTime = asDate(meta.server_time);
    const dataQualityItems = [];
    for (const row of freshnessRows) {
      const maxDt = asDate(row.max_dt);
      if (serverTime && maxDt && maxDt.getTime() > serverTime.getTime() + 24 * 60 * 60 * 1000) {
        const isProspectLogEntrySource = row.source === "dbo.dw_prospect_log_entry.created_dtt";
        const isolatedProspectLogOutlier = isProspectLogEntrySource
          && prospectLogFutureSummary
          && n(prospectLogFutureSummary.future_row_count) <= 5
          && n(prospectLogFutureSummary.distinct_prospects) <= 3
          && n(prospectLogFutureSummary.distinct_properties) <= 2;
        dataQualityItems.push({
          severity: isolatedProspectLogOutlier ? "advisory" : "review",
          check_type: isolatedProspectLogOutlier
            ? "isolated_future_dated_source_rows"
            : "future_dated_source_max_timestamp",
          source: row.source,
          detail: isolatedProspectLogOutlier
            ? `Latest source timestamp ${maxDt.toISOString()} is more than 24 hours after SQL Server time ${serverTime.toISOString()}, but the anomaly is limited to ${n(prospectLogFutureSummary.future_row_count)} rows across ${n(prospectLogFutureSummary.distinct_prospects)} prospects and ${n(prospectLogFutureSummary.distinct_properties)} properties.`
            : `Latest source timestamp ${maxDt.toISOString()} is more than 24 hours after SQL Server time ${serverTime.toISOString()}.`,
        });
      }
    }

    writeCsv(outputFiles.property_funnel_csv, propertyRows);
    writeCsv(outputFiles.source_mix_csv, sourceRows);
    writeCsv(outputFiles.watch_items_csv, watchItems);
    writeCsv(outputFiles.data_quality_items_csv, dataQualityItems);
    writeCsv(outputFiles.freshness_csv, freshnessRows);

    const summary = {
      harvest_mode: "shadow_read_only",
      credential_source: "Keeper/KSM",
      pii_policy: "aggregate_only_no_names_emails_or_phone_values",
      advisory_note: "advisory_lease_events uses prospect leased_dt and is not an approved lease metric yet.",
      connection: {
        server_name: meta.server_name,
        database_name: meta.database_name,
        login_name: meta.login_name,
        server_time: meta.server_time,
      },
      window: {
        run_date: meta.run_date,
        window_start: meta.window_start,
        window_end: meta.window_end,
        previous_window_start: meta.previous_window_start,
        days_back: args.daysBack,
      },
      totals: {
        active_properties: activeProperties,
        properties_with_guest_cards: propertiesWithGuestCards,
        ...totals,
        portal_quote_rate_pct: pct(n(totals.portal_quotes), n(totals.guest_cards)),
        online_app_rate_pct: pct(n(totals.online_apps), n(totals.guest_cards)),
        scheduled_tour_rate_pct: pct(n(totals.ipt_appts) + n(totals.sgt_appts), n(totals.guest_cards)),
      },
      top_guest_card_properties: topGuestCardProperties,
      top_source_mix_rows: sourceRows.slice(0, 15),
      watch_item_count: watchItems.length,
      watch_items: watchItems.slice(0, 50),
      data_quality_item_count: dataQualityItems.length,
      data_quality_items: dataQualityItems,
      source_freshness: freshnessRows,
      prospect_log_future_summary: prospectLogFutureSummary,
      outputs: outputFiles,
    };
    fs.writeFileSync(outputFiles.summary_json, `${JSON.stringify(summary, null, 2)}\n`);

    console.log("Data Warehouse daily shadow harvest complete");
    console.log(`Output: ${outputDir}`);
    console.log(`Window: ${meta.window_start} to ${meta.window_end} (${args.daysBack} completed day${args.daysBack === 1 ? "" : "s"})`);
    console.log(`Active properties: ${activeProperties}`);
    console.log(`Guest cards: ${n(totals.guest_cards)} (${propertiesWithGuestCards} properties)`);
    console.log(`Portal quotes: ${n(totals.portal_quotes)} | Online apps: ${n(totals.online_apps)} | Pipeline apps: ${n(totals.pipeline_apps)}`);
    console.log(`IPT appts: ${n(totals.ipt_appts)} | SGT appts: ${n(totals.sgt_appts)} | Watch items: ${watchItems.length}`);
    console.log(`Data quality items: ${dataQualityItems.length}`);
    console.log(`Summary JSON: ${outputFiles.summary_json}`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(`Harvest failed: ${error.message}`);
  process.exit(1);
});
