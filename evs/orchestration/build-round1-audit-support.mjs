import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const reportsDir = path.join(rootDir, "reports");

const workbookPath =
  process.env.EVS_AUDIT_WORKBOOK ||
  "/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v25_tightened_fill_only.xlsx";
const targetConfigPath = process.env.EVS_AUDIT_TARGETS_PATH || path.join(rootDir, "config", "round-1-qa-targets.json");
const dniResultsPath =
  process.env.EVS_DNI_RESULTS_PATH ||
  path.join(reportsDir, "dni-phone-probe-round1-full-20260520-v1", "dni-phone-probe-results.json");
const outputDir =
  process.env.EVS_AUDIT_SUPPORT_DIR ||
  path.join(reportsDir, `round1-audit-support-${new Date().toISOString().replace(/[:.]/g, "")}`);

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch {
    const moduleRoot =
      process.env.EVS_ARTIFACT_TOOL_NODE_MODULES ||
      "/Users/mark/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
    const entry = path.join(moduleRoot, "@oai", "artifact-tool", "dist", "artifact_tool.mjs");
    if (fs.existsSync(entry)) return await import(pathToFileURL(entry).href);
    throw new Error("Unable to load @oai/artifact-tool.");
  }
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  fs.writeFileSync(filePath, rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n");
}

function normalize(value) {
  return value == null ? "" : String(value).trim();
}

function rootCauseFor(row, status, description, note) {
  const haystack = `${description} ${note}`.toLowerCase();
  if (["8", "61", "161", "164", "175", "176", "177", "178"].includes(String(row)) || /dni|guest-card|ah\/eai|attribution/.test(haystack)) {
    return {
      id: "dni_attribution_failure",
      label: "DNI / Attribution Failure",
      owner: "Vendor / attribution implementation",
      action: "Fix source phone replacement and form/guest-card attribution routing; rerun no-submit DNI probe and governed form proof.",
    };
  }
  if (["83", "84"].includes(String(row)) || /sorted by size/.test(haystack)) {
    return {
      id: "unit_sort_order",
      label: "Unit Sort Order",
      owner: "Site / availability UI",
      action: "Correct rendered unit ordering by size, move-in date, then price; rerun sort-order preset.",
    };
  }
  if (String(row) === "81" || /availability/.test(haystack)) {
    return {
      id: "availability_mismatch",
      label: "Availability Mismatch",
      owner: "Site / Pond availability integration",
      action: "Reconcile rendered units, structured data, and Pond availability; rerun availability/deep journey.",
    };
  }
  if (["79", "80"].includes(String(row)) || /pricing accurate|unit types and layouts/.test(haystack)) {
    return {
      id: "pond_unit_data_mismatch",
      label: "Pond Unit Data Mismatch",
      owner: "Site / Pond unit data integration",
      action: "Reconcile rendered unit layout/pricing rows against Pond source truth; rerun availability/deep journey.",
    };
  }
  if (String(row) === "85" || /floor filter/.test(haystack)) {
    return {
      id: "floor_filter_failure",
      label: "Floor Filter Failure",
      owner: "Site / availability UI",
      action: "Correct floor-filter behavior so changing floors updates the visible unit set; rerun Apartments & Pricing deep journey.",
    };
  }
  if (String(row) === "90" || /sightmap|zoom/.test(haystack)) {
    return {
      id: "sightmap_unit_zoom",
      label: "SightMap Unit Zoom",
      owner: "Site / SightMap integration",
      action: "Ensure unit-level SightMap locate/zoom works; rerun SightMap/deep journey.",
    };
  }
  if (String(row) === "102" || /unit-specific application|application handoff|pipeline application/.test(haystack)) {
    return {
      id: "unit_specific_application_handoff",
      label: "Unit-Specific Application Handoff",
      owner: "Site / Prospect Portal integration",
      action: "Ensure Apply Now carries observable unit context through the Prospect Portal handoff; rerun row 102 proof.",
    };
  }
  if (String(row) === "4" || /specials/.test(haystack)) {
    return {
      id: "specials_toggle",
      label: "Specials Toggle",
      owner: "Site content/functionality",
      action: "For properties with active specials, expose and validate Specials toggle behavior.",
    };
  }
  if (["79", "80", "85", "89", "92", "99", "124", "155"].includes(String(row)) || status === "Review") {
    return {
      id: "inspected_review_required",
      label: "Inspected Review Required",
      owner: "QA / content owner",
      action: "Review inspected evidence and decide whether site/content changes or human validation are required.",
    };
  }
  return {
    id: "other_failure",
    label: "Other Failure",
    owner: "QA triage",
    action: "Review row evidence and assign owner.",
  };
}

function evidenceTypeFor(row, status, description, note) {
  const haystack = `${description} ${note}`.toLowerCase();
  const types = new Set();
  if (/screenshot|dni|visible\/tel|source phone/.test(haystack) || ["8", "61", "161"].includes(String(row))) types.add("screenshot_backed");
  if (/pond|feed|source-backed|latitude|longitude|trackingcodes|source phone|expected phone/.test(haystack)) types.add("source_backed");
  if (/evs pass|browser|visible|tel:|route|handoff|opened|detected|rendered|carousel|filter/.test(haystack)) types.add("browser_observed");
  if (/initial round fail|manual qa|user verified/.test(haystack)) types.add("local_manual_decision");
  if (/human|media review|property-specific image correctness|review required/.test(haystack) || status === "Review") types.add("human_review_required");
  if (/ah\/eai|downstream|guest-card|form submission|submit/.test(haystack) && status !== "Pass") types.add("downstream_required");
  if (types.size === 0 && status === "Pass") types.add("browser_observed");
  if (types.size === 0) types.add("workbook_status_only");
  return [...types];
}

function evidenceStrength(types, status) {
  if (status === "Fail" && types.includes("screenshot_backed") && types.includes("source_backed")) return "high";
  if (types.includes("source_backed") && types.includes("browser_observed")) return "high";
  if (types.includes("screenshot_backed") || types.includes("browser_observed")) return "medium";
  if (types.includes("local_manual_decision") || types.includes("human_review_required") || types.includes("downstream_required")) return "needs_followup";
  return "low";
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageSrc(filePath, htmlPath) {
  const relative = path.relative(path.dirname(htmlPath), filePath);
  return encodeURI(relative);
}

const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const targets = JSON.parse(fs.readFileSync(targetConfigPath, "utf8"));
const targetSheets = targets.map((target) => target.metadata?.official_workbook_sheet || target.property_name);
const firstSheet = workbook.worksheets.items.find((sheet) => sheet.name === targetSheets[0]);
const sheetByName = new Map(workbook.worksheets.items.map((sheet) => [sheet.name, sheet]));

fs.mkdirSync(outputDir, { recursive: true });

const requirementRows = [];
for (let row = 1; row <= 220; row += 1) {
  const [page, section, element, platform, description] = firstSheet.getRange(`A${row}:E${row}`).values[0].map(normalize);
  if (!element) continue;
  requirementRows.push({ row, page, section, element, platform, description });
}

const evidenceRows = [];
const rootCauseMap = new Map();
const validStatuses = new Set(["Pass", "Fail", "Review", "N/A", "Skipped"]);
for (const requirement of requirementRows) {
  for (const sheetName of targetSheets) {
    const sheet = sheetByName.get(sheetName);
    if (!sheet) continue;
    const [status, note] = sheet.getRange(`F${requirement.row}:G${requirement.row}`).values[0].map(normalize);
    if (!validStatuses.has(status)) continue;
    const evidence_types = evidenceTypeFor(requirement.row, status, requirement.description, note);
    const record = {
      sheet: sheetName,
      row: requirement.row,
      page: requirement.page,
      section: requirement.section,
      element: requirement.element,
      platform: requirement.platform,
      description: requirement.description,
      status,
      evidence_types,
      evidence_strength: evidenceStrength(evidence_types, status),
      note,
    };
    evidenceRows.push(record);
    if (["Fail", "Review"].includes(status)) {
      const cause = rootCauseFor(requirement.row, status, requirement.description, note);
      if (!rootCauseMap.has(cause.id)) {
        rootCauseMap.set(cause.id, {
          ...cause,
          status_counts: {},
          affected_rows: new Set(),
          affected_properties: new Set(),
          examples: [],
        });
      }
      const entry = rootCauseMap.get(cause.id);
      entry.status_counts[status] = (entry.status_counts[status] || 0) + 1;
      entry.affected_rows.add(requirement.row);
      entry.affected_properties.add(sheetName);
      if (entry.examples.length < 8) {
        entry.examples.push({
          sheet: sheetName,
          row: requirement.row,
          status,
          description: requirement.description,
          note,
        });
      }
    }
  }
}

const rootCauses = [...rootCauseMap.values()]
  .map((entry) => ({
    id: entry.id,
    label: entry.label,
    owner: entry.owner,
    action: entry.action,
    status_counts: entry.status_counts,
    affected_row_count: entry.affected_rows.size,
    affected_rows: [...entry.affected_rows].sort((a, b) => a - b),
    affected_property_count: entry.affected_properties.size,
    affected_properties: [...entry.affected_properties].sort(),
    examples: entry.examples,
  }))
  .sort((a, b) => (b.status_counts.Fail || 0) - (a.status_counts.Fail || 0) || b.affected_property_count - a.affected_property_count);

const rootCauseJsonPath = path.join(outputDir, "root-cause-summary.json");
const rootCauseCsvPath = path.join(outputDir, "root-cause-summary.csv");
fs.writeFileSync(rootCauseJsonPath, JSON.stringify({ generated_at: new Date().toISOString(), workbook: workbookPath, root_causes: rootCauses }, null, 2));
writeCsv(rootCauseCsvPath, [
  ["root_cause_id", "label", "owner", "fail_count", "review_count", "affected_row_count", "affected_rows", "affected_property_count", "action"],
  ...rootCauses.map((cause) => [
    cause.id,
    cause.label,
    cause.owner,
    cause.status_counts.Fail || 0,
    cause.status_counts.Review || 0,
    cause.affected_row_count,
    cause.affected_rows.join(";"),
    cause.affected_property_count,
    cause.action,
  ]),
]);

const evidenceJsonPath = path.join(outputDir, "evidence-completeness.json");
const evidenceCsvPath = path.join(outputDir, "evidence-completeness.csv");
const evidenceSummary = evidenceRows.reduce((acc, row) => {
  acc.by_status[row.status] = (acc.by_status[row.status] || 0) + 1;
  acc.by_strength[row.evidence_strength] = (acc.by_strength[row.evidence_strength] || 0) + 1;
  for (const type of row.evidence_types) acc.by_type[type] = (acc.by_type[type] || 0) + 1;
  return acc;
}, { by_status: {}, by_strength: {}, by_type: {} });
fs.writeFileSync(evidenceJsonPath, JSON.stringify({ generated_at: new Date().toISOString(), workbook: workbookPath, summary: evidenceSummary, rows: evidenceRows }, null, 2));
writeCsv(evidenceCsvPath, [
  ["sheet", "row", "page", "section", "element", "status", "evidence_strength", "evidence_types", "description", "note"],
  ...evidenceRows.map((row) => [
    row.sheet,
    row.row,
    row.page,
    row.section,
    row.element,
    row.status,
    row.evidence_strength,
    row.evidence_types.join(";"),
    row.description,
    row.note,
  ]),
]);

const targetBySheet = new Map(targets.map((target) => [target.metadata?.official_workbook_sheet || target.property_name, target]));
const rowsBySheet = new Map();
for (const row of evidenceRows) {
  if (!rowsBySheet.has(row.sheet)) rowsBySheet.set(row.sheet, []);
  rowsBySheet.get(row.sheet).push(row);
}

function topIssue(rows) {
  const failures = rows.filter((row) => row.status === "Fail");
  const reviews = rows.filter((row) => row.status === "Review");
  const candidates = failures.length ? failures : reviews;
  return candidates.sort((a, b) => {
    const aCause = rootCauseFor(a.row, a.status, a.description, a.note);
    const bCause = rootCauseFor(b.row, b.status, b.description, b.note);
    const priority = {
      dni_attribution_failure: 1,
      unit_sort_order: 2,
      availability_mismatch: 3,
      sightmap_unit_zoom: 4,
      inspected_review_required: 5,
    };
    return (priority[aCause.id] || 99) - (priority[bCause.id] || 99) || a.row - b.row;
  })[0] || null;
}

const deliveryRows = targetSheets.map((sheetName) => {
  const target = targetBySheet.get(sheetName) || {};
  const rows = rowsBySheet.get(sheetName) || [];
  const failCount = rows.filter((row) => row.status === "Fail").length;
  const reviewCount = rows.filter((row) => row.status === "Review").length;
  const passCount = rows.filter((row) => row.status === "Pass").length;
  const skippedCount = rows.filter((row) => row.status === "Skipped").length;
  const naCount = rows.filter((row) => row.status === "N/A").length;
  const issue = topIssue(rows);
  const cause = issue ? rootCauseFor(issue.row, issue.status, issue.description, issue.note) : null;
  return {
    property_name: target.property_name || sheetName,
    property_code: target.property_id || "",
    sheet: sheetName,
    target_url: target.target_url || "",
    blocked: failCount > 0,
    fail_count: failCount,
    review_count: reviewCount,
    pass_count: passCount,
    skipped_count: skippedCount,
    na_count: naCount,
    top_issue_row: issue?.row || "",
    top_issue_status: issue?.status || "",
    top_issue_group: cause?.label || "",
    top_issue_description: issue?.description || "",
    top_issue_note: issue?.note || "",
  };
});
const deliverySummaryPath = path.join(outputDir, "delivery-summary.csv");
const deliverySummaryJsonPath = path.join(outputDir, "delivery-summary.json");
fs.writeFileSync(deliverySummaryJsonPath, JSON.stringify({ generated_at: new Date().toISOString(), workbook: workbookPath, rows: deliveryRows }, null, 2));
writeCsv(deliverySummaryPath, [
  [
    "property_name",
    "property_code",
    "blocked",
    "fail_count",
    "review_count",
    "pass_count",
    "skipped_count",
    "na_count",
    "top_issue_row",
    "top_issue_status",
    "top_issue_group",
    "top_issue_description",
    "top_issue_note",
    "target_url",
  ],
  ...deliveryRows.map((row) => [
    row.property_name,
    row.property_code,
    row.blocked ? "yes" : "no",
    row.fail_count,
    row.review_count,
    row.pass_count,
    row.skipped_count,
    row.na_count,
    row.top_issue_row,
    row.top_issue_status,
    row.top_issue_group,
    row.top_issue_description,
    row.top_issue_note,
    row.target_url,
  ]),
]);

let contactSheetPath = null;
let dniSummary = null;
let dniReviewCsvPath = null;
if (fs.existsSync(dniResultsPath)) {
  const dni = JSON.parse(fs.readFileSync(dniResultsPath, "utf8"));
  const results = dni.results || [];
  contactSheetPath = path.join(outputDir, "dni-screenshot-contact-sheet.html");
  dniReviewCsvPath = path.join(outputDir, "dni-review.csv");
  dniSummary = {
    result_count: results.length,
    status_counts: results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {}),
    screenshot_count: results.reduce((total, result) => total + (result.pages || []).filter((page) => page.screenshot_path).length, 0),
  };
  writeCsv(dniReviewCsvPath, [
    [
      "property_name",
      "property_code",
      "status",
      "source",
      "tracking_id",
      "expected_phone",
      "expected_email",
      "home_url",
      "home_visible_phones",
      "home_tel_links",
      "home_selected_source_phone",
      "home_screenshot",
      "contact_url",
      "contact_visible_phones",
      "contact_tel_links",
      "contact_selected_source_phone",
      "contact_screenshot",
      "message",
    ],
    ...results.map((result) => {
      const home = (result.pages || []).find((page) => page.label === "home") || {};
      const contact = (result.pages || []).find((page) => page.label === "contact") || {};
      const telText = (page) => (page.tel_links || []).map((link) => link.href || link.text).filter(Boolean).join("; ");
      return [
        result.property_name,
        result.property_code || result.property_id,
        result.status,
        result.marketing_source_cd,
        result.tracking_id,
        result.expected_phone,
        result.expected_email,
        home.loaded_url || home.requested_url || result.generated_urls?.home || "",
        (home.visible_phones || []).join("; "),
        telText(home),
        home.selected_source_phone || "",
        home.screenshot_path || "",
        contact.loaded_url || contact.requested_url || result.generated_urls?.contact || "",
        (contact.visible_phones || []).join("; "),
        telText(contact),
        contact.selected_source_phone || "",
        contact.screenshot_path || "",
        result.message,
      ];
    }),
  ]);
  const cards = results
    .map((result) => {
      const pages = (result.pages || [])
        .map((page) => {
          const img = page.screenshot_path
            ? `<a href="${htmlEscape(imageSrc(page.screenshot_path, contactSheetPath))}"><img src="${htmlEscape(imageSrc(page.screenshot_path, contactSheetPath))}" alt="${htmlEscape(result.property_code)} ${htmlEscape(page.label)} screenshot"></a>`
            : `<div class="missing">No screenshot</div>`;
          return `<div class="page"><h4>${htmlEscape(page.label)}</h4>${img}<p><b>Visible phones:</b> ${htmlEscape((page.visible_phones || []).join(", ") || "None")}</p><p><b>Selected source phone:</b> ${htmlEscape(page.selected_source_phone || "None")}</p></div>`;
        })
        .join("");
      return `<section class="card ${htmlEscape(result.status)}"><header><h3>${htmlEscape(result.property_name)} <span>${htmlEscape(result.property_code)}</span></h3><p>${htmlEscape(result.marketing_source_cd)} / ${htmlEscape(result.tracking_id)} / expected ${htmlEscape(result.expected_phone)}</p><p class="status">${htmlEscape(result.status.toUpperCase())}: ${htmlEscape(result.message)}</p></header><div class="pages">${pages}</div></section>`;
    })
    .join("\n");
  fs.writeFileSync(
    contactSheetPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Round 1 DNI Screenshot Contact Sheet</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #17233c; background: #f6f7f9; }
    h1 { margin: 0 0 8px; }
    .meta { margin-bottom: 24px; color: #445; }
    .card { background: #fff; border: 1px solid #d8dde8; border-left: 8px solid #999; margin: 0 0 24px; padding: 16px; page-break-inside: avoid; }
    .card.fail { border-left-color: #c0392b; }
    .card.pass { border-left-color: #2e7d32; }
    h3 { margin: 0; }
    h3 span { font-size: 14px; color: #5d667a; }
    .status { font-weight: 700; }
    .pages { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .page img { width: 100%; max-height: 900px; object-fit: contain; object-position: top left; border: 1px solid #d8dde8; background: #fff; }
    .page h4 { margin-bottom: 8px; }
    .missing { height: 160px; border: 1px dashed #999; display: grid; place-items: center; color: #777; }
  </style>
</head>
<body>
  <h1>Round 1 DNI Screenshot Contact Sheet</h1>
  <div class="meta">Generated ${htmlEscape(new Date().toISOString())}. Source: ${htmlEscape(dniResultsPath)}. Results: ${htmlEscape(JSON.stringify(dniSummary.status_counts))}. Screenshots: ${dniSummary.screenshot_count}.</div>
  ${cards}
</body>
</html>`
  );
}

const summaryPath = path.join(outputDir, "summary.json");
const summary = {
  generated_at: new Date().toISOString(),
  output_dir: outputDir,
  workbook: workbookPath,
  root_cause_json_path: rootCauseJsonPath,
  root_cause_csv_path: rootCauseCsvPath,
  evidence_completeness_json_path: evidenceJsonPath,
  evidence_completeness_csv_path: evidenceCsvPath,
  delivery_summary_json_path: deliverySummaryJsonPath,
  delivery_summary_csv_path: deliverySummaryPath,
  dni_contact_sheet_path: contactSheetPath,
  dni_review_csv_path: dniReviewCsvPath,
  dni_summary: dniSummary,
  root_cause_count: rootCauses.length,
  evidence_row_count: evidenceRows.length,
};
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
process.stdout.write(JSON.stringify({ summary_path: summaryPath, ...summary }, null, 2));
