import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoDir = path.dirname(rootDir);
const reportsDir = path.join(rootDir, "reports");

const packageId =
  process.env.EVS_EVIDENCE_PACKAGE_ID ||
  `evs-evidence-${new Date().toISOString().replace(/[:.]/g, "")}`;
const packageDir = path.isAbsolute(packageId) ? packageId : path.join(reportsDir, packageId);
const copyFiles = process.env.EVS_EVIDENCE_COPY_FILES === "1";

function parseList(name) {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(repoDir, value);
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function listFiles(inputPath) {
  const resolved = resolvePath(inputPath);
  if (!fs.existsSync(resolved)) return [];
  const stat = fs.statSync(resolved);
  if (stat.isFile()) return [resolved];
  if (!stat.isDirectory()) return [];
  return fs
    .readdirSync(resolved, { withFileTypes: true })
    .flatMap((entry) => listFiles(path.join(resolved, entry.name)));
}

function roleForFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.endsWith(".xlsx")) return "filled_workbook";
  if (name === "summary.json") return "run_summary";
  if (name === "critical-summary.json") return "critical_summary";
  if (name === "critical-summary.csv") return "critical_summary_csv";
  if (name.includes("coverage-audit")) return "coverage_audit";
  if (name.includes("dni-phone")) return "dni_phone_audit";
  if (name.includes("contact-validation")) return "contact_validation_evidence";
  if (name.endsWith(".png")) return "screenshot_or_render";
  if (name.endsWith(".json")) return "json_evidence";
  if (name.endsWith(".csv")) return "csv_evidence";
  if (name.endsWith(".md")) return "markdown_note";
  return "local_evidence";
}

function fileRecord(filePath, sourceLabel = null) {
  const stat = fs.statSync(filePath);
  const relativePath = path.relative(repoDir, filePath);
  const record = {
    role: roleForFile(filePath),
    source_label: sourceLabel,
    path: filePath,
    repo_relative_path: relativePath.startsWith("..") ? null : relativePath,
    size_bytes: stat.size,
    modified_at: stat.mtime.toISOString(),
    sha256: sha256(filePath),
  };
  if (copyFiles) {
    const destination = path.join(packageDir, "files", relativePath.startsWith("..") ? path.basename(filePath) : relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(filePath, destination);
    record.package_copy_path = destination;
  }
  return record;
}

function collectRecords() {
  const groups = [
    ["workbook", parseList("EVS_EVIDENCE_WORKBOOKS")],
    ["report", parseList("EVS_EVIDENCE_REPORTS")],
    ["run_dir", parseList("EVS_EVIDENCE_RUN_DIRS")],
    ["supporting_file", parseList("EVS_EVIDENCE_FILES")],
  ];
  const seen = new Set();
  const records = [];
  for (const [sourceLabel, values] of groups) {
    for (const value of values) {
      for (const filePath of listFiles(value)) {
        if (seen.has(filePath)) continue;
        seen.add(filePath);
        records.push(fileRecord(filePath, sourceLabel));
      }
    }
  }
  return records.sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.path).localeCompare(String(b.path)));
}

fs.mkdirSync(packageDir, { recursive: true });
const records = collectRecords();
const manifest = {
  package_id: path.basename(packageDir),
  generated_at: new Date().toISOString(),
  package_dir: packageDir,
  policy: {
    workbook_rule: "fill existing supplied workbook cells only; do not add tabs, columns, rows, or non-native evidence objects",
    local_evidence_rule:
      "store detailed proof, screenshots, JSON, HTML snapshots, source truth, ledgers, and run artifacts locally under EVS reports",
    copy_files: copyFiles,
  },
  scope: {
    batch_id: process.env.QA_BATCH_ID || null,
    workbook: process.env.EVS_EVIDENCE_SCOPE_WORKBOOK || null,
    note: process.env.EVS_EVIDENCE_NOTE || null,
  },
  counts: {
    file_count: records.length,
    total_bytes: records.reduce((total, record) => total + record.size_bytes, 0),
    by_role: records.reduce((acc, record) => {
      acc[record.role] = (acc[record.role] || 0) + 1;
      return acc;
    }, {}),
  },
  files: records,
};

const manifestPath = path.join(packageDir, "evidence-manifest.json");
const readmePath = path.join(packageDir, "README.md");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(
  readmePath,
  [
    `# ${manifest.package_id}`,
    "",
    "This local EVS evidence package stores audit proof that does not belong inside the supplied workbook.",
    "",
    "## Policy",
    "",
    "- Workbook updates are fill-only: existing tabs, rows, columns, status cells, and notes cells.",
    "- Detailed proof stays local under EVS reports.",
    "- The workbook may reference concise evidence notes, but bulky/non-native artifacts stay out of the supplied report.",
    "",
    "## Contents",
    "",
    `- Files indexed: ${manifest.counts.file_count}`,
    `- Total bytes: ${manifest.counts.total_bytes}`,
    `- Manifest: ${manifestPath}`,
    "",
  ].join("\n")
);

process.stdout.write(JSON.stringify({ package_dir: packageDir, manifest_path: manifestPath, readme_path: readmePath, ...manifest.counts }, null, 2));
