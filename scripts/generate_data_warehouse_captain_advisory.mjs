#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_HARVEST_ROOT = "outputs/data_warehouse/daily_harvest";
const DEFAULT_OUTPUT_ROOT = "outputs/captain_signal_flow/data_warehouse";
const PROPERTY_IDENTITY_MATRIX = "config/property_identity_matrix.json";

function parseArgs(argv) {
  const args = {
    harvestDir: null,
    harvestRoot: DEFAULT_HARVEST_ROOT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--harvest-dir") {
      args.harvestDir = next;
      i += 1;
    } else if (arg === "--harvest-root") {
      args.harvestRoot = next;
      i += 1;
    } else if (arg === "--output-root") {
      args.outputRoot = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/generate_data_warehouse_captain_advisory.mjs [options]

Options:
  --harvest-dir PATH      Specific daily harvest packet directory
  --harvest-root PATH     Harvest packet root, default ${DEFAULT_HARVEST_ROOT}
  --output-root PATH      Advisory output root, default ${DEFAULT_OUTPUT_ROOT}
`);
}

function latestHarvestDir(root) {
  const absRoot = path.resolve(root);
  if (!fs.existsSync(absRoot)) {
    throw new Error(`Harvest root not found: ${absRoot}`);
  }
  const candidates = fs
    .readdirSync(absRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "summary.json")));
  if (!candidates.length) {
    throw new Error(`No harvest packets with summary.json found under ${absRoot}`);
  }
  return candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function csvRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

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

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
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
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const out = {};
    headers.forEach((header, index) => {
      out[header] = values[index] ?? "";
    });
    return out;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
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

function loadIdentityIndex() {
  const matrix = JSON.parse(fs.readFileSync(path.resolve(PROPERTY_IDENTITY_MATRIX), "utf8"));
  const byCode = new Map();
  for (const property of matrix.properties || []) {
    if (property.property_code) byCode.set(String(property.property_code), property);
  }
  return byCode;
}

function groupBy(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function attentionText(row, watchItems) {
  const guestCards = n(row.guest_cards);
  if (!guestCards) return "No guest-card activity in the completed window.";
  if (watchItems.length) return watchItems.map((item) => item.detail).join(" ");
  const delta = n(row.guest_card_delta);
  const tourCount = n(row.ipt_appts) + n(row.sgt_appts);
  return `${plural(guestCards, "guest card")}, ${plural(n(row.portal_quotes), "portal quote")}, ${plural(n(row.online_apps), "online app")}, and ${plural(tourCount, "scheduled tour appointment")}; guest-card delta ${delta >= 0 ? "+" : ""}${delta}.`;
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const harvestDir = path.resolve(args.harvestDir || latestHarvestDir(args.harvestRoot));
  const summaryPath = path.join(harvestDir, "summary.json");
  if (!fs.existsSync(summaryPath)) throw new Error(`summary.json not found in ${harvestDir}`);

  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const propertyRows = csvRows(path.join(harvestDir, "property_funnel.csv"));
  const watchRows = csvRows(path.join(harvestDir, "watch_items.csv"));
  const qualityRows = csvRows(path.join(harvestDir, "data_quality_items.csv"));
  const identityByCode = loadIdentityIndex();
  const watchByProperty = groupBy(watchRows, (row) => row.property_cd);
  const unresolved = propertyRows.filter((row) => !identityByCode.has(row.property_cd));

  const runDate = summary.window?.run_date || "unknown-date";
  const runStamp = todayStamp();
  const outputDir = path.resolve(args.outputRoot, `${runDate}_${runStamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const blockingQualityRows = qualityRows.filter((row) => {
    const severity = String(row.severity || "").toLowerCase();
    return severity && severity !== "advisory" && severity !== "info";
  });

  const sourceTrustPosture = unresolved.length
    ? "unavailable"
    : blockingQualityRows.length
      ? "degraded_advisory"
      : "advisory";
  const validationPosture = unresolved.length ? "validation_failed" : "validation_pending";
  const freshnessPosture = "fresh";

  const propertySignals = propertyRows.map((row) => {
    const watchItems = watchByProperty.get(row.property_cd) || [];
    const identity = identityByCode.get(row.property_cd);
    const guestCards = n(row.guest_cards);
    const tourAppointments = n(row.ipt_appts) + n(row.sgt_appts);
    return {
      run_date: runDate,
      window_start: summary.window?.window_start || "",
      window_end: summary.window?.window_end || "",
      domain_key: "dw_leasing_funnel_shadow",
      trust_posture: sourceTrustPosture,
      validation_posture: validationPosture,
      freshness_posture: freshnessPosture,
      property_cd: row.property_cd,
      canonical_property_id: identity?.canonical_property_id || "",
      property_name: row.property_name,
      identity_resolved: identity ? "yes" : "no",
      guest_cards: guestCards,
      previous_guest_cards: n(row.previous_guest_cards),
      guest_card_delta: n(row.guest_card_delta),
      portal_quotes: n(row.portal_quotes),
      online_apps: n(row.online_apps),
      pipeline_apps: n(row.pipeline_apps),
      scheduled_tour_appointments: tourAppointments,
      portal_quote_rate_pct: pct(n(row.portal_quotes), guestCards),
      online_app_rate_pct: pct(n(row.online_apps), guestCards),
      scheduled_tour_rate_pct: pct(tourAppointments, guestCards),
      watch_item_count: watchItems.length,
      captain_routines: "source_readiness;funnel_watch;channel_efficiency_watch;action_proof_loop",
      captain_attention: attentionText(row, watchItems),
    };
  });

  const activeSignals = propertySignals.filter((row) => n(row.guest_cards) > 0 || n(row.watch_item_count) > 0);
  const watchSignals = propertySignals.filter((row) => n(row.watch_item_count) > 0);
  const topWatchSignals = [...watchSignals]
    .sort((a, b) => n(b.watch_item_count) - n(a.watch_item_count) || n(b.guest_cards) - n(a.guest_cards))
    .slice(0, 12);
  const topActivitySignals = [...propertySignals]
    .sort((a, b) => n(b.guest_cards) - n(a.guest_cards))
    .slice(0, 12);

  const advisory = {
    advisory_type: "data_warehouse_captain_advisory",
    generated_at: new Date().toISOString(),
    source_packet: harvestDir,
    domain_key: "dw_leasing_funnel_shadow",
    trust_posture: sourceTrustPosture,
    validation_posture: validationPosture,
    freshness_posture: freshnessPosture,
    pii_policy: "aggregate_only_no_names_emails_phone_values_or_notes",
    captain_use_policy:
      "Captains may use this as advisory evidence with lineage. Do not treat it as canonical until historical export reconciliation promotes the lane.",
    window: summary.window,
    portfolio_totals: summary.totals,
    identity: {
      property_rows_checked: propertyRows.length,
      unresolved_property_rows: unresolved.length,
      unresolved_property_codes: unresolved.map((row) => row.property_cd),
    },
    data_quality_items: qualityRows,
    watch_item_count: watchRows.length,
    business_watch_items: watchRows,
    property_signals: propertySignals,
    top_watch_signals: topWatchSignals,
    top_activity_signals: topActivitySignals,
    captain_flow_bindings: {
      source_readiness: "show lane freshness, validation, identity, and quality posture",
      funnel_watch: "show guest-card, quote, app, and tour conversion watch items",
      channel_efficiency_watch: "show source-mix candidates from the source packet while attribution mapping remains advisory",
      action_proof_loop: "allow actions only as evidence-linked candidates until the lane is promoted",
    },
  };

  const outputs = {
    json: path.join(outputDir, "captain_signal_pack.json"),
    csv: path.join(outputDir, "property_signal_pack.csv"),
    markdown: path.join(outputDir, "captain_advisory.md"),
  };

  fs.writeFileSync(outputs.json, `${JSON.stringify(advisory, null, 2)}\n`);
  writeCsv(outputs.csv, propertySignals);

  const qualityText = qualityRows.length
    ? qualityRows.map((row) => `- ${row.severity}: ${row.source} - ${row.detail}`).join("\n")
    : "- No data-quality items in this packet.";
  const watchTable = topWatchSignals.length
    ? topWatchSignals
        .map(
          (row) =>
            `| ${markdownEscape(row.property_cd)} | ${markdownEscape(row.property_name)} | ${row.guest_cards} | ${row.portal_quotes} | ${row.online_apps} | ${row.scheduled_tour_appointments} | ${row.watch_item_count} | ${markdownEscape(row.captain_attention)} |`,
        )
        .join("\n")
    : "| none | none | 0 | 0 | 0 | 0 | 0 | No business watch items. |";
  const activityTable = topActivitySignals
    .map(
      (row) =>
        `| ${markdownEscape(row.property_cd)} | ${markdownEscape(row.property_name)} | ${row.guest_cards} | ${row.guest_card_delta >= 0 ? "+" : ""}${row.guest_card_delta} | ${row.portal_quotes} | ${row.online_apps} | ${row.scheduled_tour_appointments} |`,
    )
    .join("\n");

  const markdown = `# Data Warehouse Captain Advisory

Status: ${sourceTrustPosture}
Generated: ${advisory.generated_at}
Window: ${summary.window?.window_start} to ${summary.window?.window_end}
Source packet: ${harvestDir}

## Captain Use Policy

This packet is empirical and aggregate-only, but still advisory until historical export reconciliation promotes the lane. Captains may use it to notice, ask, and prepare actions; they should not represent it as the canonical source of truth yet.

## Portfolio Summary

- Active properties: ${summary.totals?.active_properties}
- Properties with guest cards: ${summary.totals?.properties_with_guest_cards}
- Guest cards: ${summary.totals?.guest_cards}
- Previous guest cards: ${summary.totals?.previous_guest_cards}
- Guest-card delta: ${summary.totals?.guest_card_delta >= 0 ? "+" : ""}${summary.totals?.guest_card_delta}
- Portal quotes: ${summary.totals?.portal_quotes}
- Online apps: ${summary.totals?.online_apps}
- Pipeline apps: ${summary.totals?.pipeline_apps}
- Scheduled tour appointments: ${n(summary.totals?.ipt_appts) + n(summary.totals?.sgt_appts)}
- Business watch items: ${watchRows.length}
- Data-quality items: ${qualityRows.length}

## Data Quality

${qualityText}

## Top Watch Signals

| Property | Name | GC | Quotes | Apps | Tours | Watch Items | Captain Attention |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${watchTable}

## Top Activity Signals

| Property | Name | GC | Delta | Quotes | Apps | Tours |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${activityTable}

## Routine Bindings

- Source Readiness: freshness, validation, identity, data-quality posture.
- Funnel Watch: guest-card, quote, app, and tour movement.
- Channel Efficiency Watch: source-mix candidates while attribution mapping remains advisory.
- Action And Proof Loop: evidence-linked action candidates only; no source-of-truth mutation.
`;

  fs.writeFileSync(outputs.markdown, markdown);

  console.log("Data Warehouse Captain advisory generated");
  console.log(`Output: ${outputDir}`);
  console.log(`Trust posture: ${sourceTrustPosture}`);
  console.log(`Property signals: ${propertySignals.length}`);
  console.log(`Watch properties: ${watchSignals.length}`);
  console.log(`Business watch items: ${watchRows.length}`);
  console.log(`Data quality items: ${qualityRows.length}`);
  console.log(`Markdown: ${outputs.markdown}`);
}

main().catch((error) => {
  console.error(`Captain advisory generation failed: ${error.message}`);
  process.exit(1);
});
