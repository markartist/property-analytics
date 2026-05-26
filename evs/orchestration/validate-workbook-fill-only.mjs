import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const reportsDir = path.join(rootDir, "reports");

const originalPath = process.env.EVS_FILL_ONLY_ORIGINAL_WORKBOOK || "/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx";
const updatedPath = process.env.EVS_FILL_ONLY_UPDATED_WORKBOOK;
const reportPath =
  process.env.EVS_FILL_ONLY_REPORT_PATH ||
  path.join(reportsDir, `workbook-fill-only-validation-${new Date().toISOString().replace(/[:.]/g, "")}.json`);
const maxRows = Number(process.env.EVS_FILL_ONLY_MAX_ROWS || 260);
const maxCols = Number(process.env.EVS_FILL_ONLY_MAX_COLS || 26);
const allowedColumns = new Set(
  (process.env.EVS_FILL_ONLY_ALLOWED_COLUMNS || "F,G")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

if (!updatedPath) {
  throw new Error("EVS_FILL_ONLY_UPDATED_WORKBOOK is required.");
}

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch {
    const moduleRoots = [
      process.env.EVS_ARTIFACT_TOOL_NODE_MODULES,
      "/Users/mark/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
    ].filter(Boolean);
    for (const moduleRoot of moduleRoots) {
      const entry = path.join(moduleRoot, "@oai", "artifact-tool", "dist", "artifact_tool.mjs");
      if (fs.existsSync(entry)) return await import(pathToFileURL(entry).href);
    }
    throw new Error("Unable to load @oai/artifact-tool. Set EVS_ARTIFACT_TOOL_NODE_MODULES to the bundled node_modules path.");
  }
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }
  return name;
}

function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rangeAddress() {
  return `A1:${columnName(maxCols - 1)}${maxRows}`;
}

function valuesBySheet(workbook) {
  const values = new Map();
  for (const sheet of workbook.worksheets.items) {
    values.set(sheet.name, sheet.getRange(rangeAddress()).values);
  }
  return values;
}

const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
const original = await SpreadsheetFile.importXlsx(await FileBlob.load(originalPath));
const updated = await SpreadsheetFile.importXlsx(await FileBlob.load(updatedPath));
const originalSheets = original.worksheets.items.map((sheet) => sheet.name);
const updatedSheets = updated.worksheets.items.map((sheet) => sheet.name);
const originalValues = valuesBySheet(original);
const updatedValues = valuesBySheet(updated);

const violations = [];
if (JSON.stringify(originalSheets) !== JSON.stringify(updatedSheets)) {
  violations.push({
    type: "sheet_names_or_order_changed",
    original_sheets: originalSheets,
    updated_sheets: updatedSheets,
  });
}

let allowedChangeCount = 0;
for (const sheetName of originalSheets) {
  if (!updatedValues.has(sheetName)) continue;
  const before = originalValues.get(sheetName);
  const after = updatedValues.get(sheetName);
  for (let row = 0; row < maxRows; row += 1) {
    for (let col = 0; col < maxCols; col += 1) {
      const beforeValue = normalizeCell(before?.[row]?.[col]);
      const afterValue = normalizeCell(after?.[row]?.[col]);
      if (beforeValue === afterValue) continue;
      const colName = columnName(col);
      const change = {
        type: allowedColumns.has(colName) ? "allowed_fill_change" : "disallowed_cell_change",
        sheet: sheetName,
        cell: `${colName}${row + 1}`,
        before: beforeValue,
        after: afterValue,
      };
      if (allowedColumns.has(colName)) {
        allowedChangeCount += 1;
      } else {
        violations.push(change);
      }
    }
  }
}

const report = {
  generated_at: new Date().toISOString(),
  original_workbook: originalPath,
  updated_workbook: updatedPath,
  scanned_range: rangeAddress(),
  allowed_columns: [...allowedColumns],
  fill_only_passed: violations.length === 0,
  allowed_change_count: allowedChangeCount,
  violation_count: violations.length,
  violations,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ report_path: reportPath, ...report }, null, 2));
if (violations.length > 0) process.exit(1);
