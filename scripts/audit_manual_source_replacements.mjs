#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_MANIFEST = "config/manual_source_replacement_manifest.json";
const DEFAULT_OUTPUT_ROOT = "outputs/data_warehouse/replacement_audits/manual_sources";

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--manifest") {
      args.manifest = next;
      i += 1;
    } else if (arg === "--output-root") {
      args.outputRoot = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/audit_manual_source_replacements.mjs [options]

Options:
  --manifest PATH      Replacement manifest, default ${DEFAULT_MANIFEST}
  --output-root PATH   Output root, default ${DEFAULT_OUTPUT_ROOT}
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function fileExists(repoRoot, filePath) {
  const cleanPath = String(filePath).split(":")[0];
  return fs.existsSync(path.join(repoRoot, cleanPath));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const manifestPath = path.resolve(args.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const candidates = manifest.replacement_candidates || [];
  const rows = candidates.map((candidate) => {
    const currentPathChecks = (candidate.current_paths || []).map((p) => ({
      path: p,
      exists: fileExists(repoRoot, p),
    }));
    const replacementPathExists = candidate.replacement_path_note
      ? null
      : candidate.replacement_path
      ? fileExists(repoRoot, candidate.replacement_path)
      : false;
    const missingCurrentPaths = currentPathChecks.filter((item) => !item.exists).map((item) => item.path);
    return {
      id: candidate.id,
      status: candidate.status,
      current_dependency: candidate.current_dependency,
      replacement_path: candidate.replacement_path,
      replacement_path_exists: replacementPathExists,
      missing_current_paths: missingCurrentPaths,
      promotion_gate: candidate.promotion_gate,
    };
  });

  const summary = {
    audited_at: new Date().toISOString(),
    manifest: manifestPath,
    candidates_total: rows.length,
    replacement_paths_present: rows.filter((row) => row.replacement_path_exists === true).length,
    replacement_paths_missing: rows.filter((row) => row.replacement_path_exists === false).length,
    legacy_seed_or_review_count: rows.filter((row) => /legacy|review|not_implemented/.test(row.status)).length,
    rows,
  };

  const outputDir = path.resolve(args.outputRoot, todayStamp());
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "manual_source_replacement_audit.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);

  const csvPath = path.join(outputDir, "manual_source_replacement_audit.csv");
  const headers = [
    "id",
    "status",
    "replacement_path",
    "replacement_path_exists",
    "missing_current_paths",
    "promotion_gate",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = Array.isArray(row[header]) ? row[header].join("; ") : row[header];
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(","),
    ),
  ];
  fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`);

  console.log("Manual source replacement audit complete");
  console.log(`Candidates: ${summary.candidates_total}`);
  console.log(`Replacement paths present: ${summary.replacement_paths_present}`);
  console.log(`Replacement paths missing: ${summary.replacement_paths_missing}`);
  console.log(`Report: ${jsonPath}`);
}

main();
