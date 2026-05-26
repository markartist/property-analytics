import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run, stmt, batch } from "../lib/db";
import { newId } from "../lib/id";
import { isFriday, nowISO, errJson, validateSafeText } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";

const MetricRow = z.object({
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window_days: z.union([z.literal(7), z.literal(30)]),
  type: z.enum(["community", "portfolio"]),
  community_id: z.string().nullable().optional(),
  occupancy_rate: z.number().nullable().optional(),
  leased_rate: z.number().nullable().optional(),
  traffic_count: z.number().int().nullable().optional(),
  applications_count: z.number().int().nullable().optional(),
  move_ins: z.number().int().nullable().optional(),
  move_outs: z.number().int().nullable().optional(),
  delinquency_rate: z.number().nullable().optional(),
  notes_text: z.string().nullable().optional(),
});

const ImportPasteBody = z.object({
  rows: z.array(MetricRow).min(1, "At least one row is required").optional(),
  tsv: z.string().min(1).optional(),
});

const DeleteBody = z.object({
  metric_date: z.string(),
  window_days: z.union([z.literal(7), z.literal(30)]),
  type: z.enum(["community", "portfolio"]),
});

const metrics = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
metrics.use("*", requireAuth);

type MetricImportRow = z.infer<typeof MetricRow>;

const TSV_HEADER_MAPPING: Record<string, keyof MetricImportRow | "community_external_key"> = {
  metric_date: "metric_date",
  "Metric Date": "metric_date",
  window_days: "window_days",
  "Window Days": "window_days",
  type: "type",
  Type: "type",
  community_external_key: "community_external_key",
  "Community External Key": "community_external_key",
  community_id: "community_id",
  "Community ID": "community_id",
  occupancy_rate: "occupancy_rate",
  "Occupancy Rate": "occupancy_rate",
  leased_rate: "leased_rate",
  "Leased Rate": "leased_rate",
  traffic_count: "traffic_count",
  "Traffic Count": "traffic_count",
  applications_count: "applications_count",
  "Applications Count": "applications_count",
  move_ins: "move_ins",
  "Move Ins": "move_ins",
  move_outs: "move_outs",
  "Move Outs": "move_outs",
  delinquency_rate: "delinquency_rate",
  "Delinquency Rate": "delinquency_rate",
  notes_text: "notes_text",
  "Notes Text": "notes_text",
};

const PERCENT_FIELDS = new Set<keyof MetricImportRow>(["occupancy_rate", "leased_rate", "delinquency_rate"]);
const INTEGER_FIELDS = new Set<keyof MetricImportRow>(["traffic_count", "applications_count", "move_ins", "move_outs"]);
const DECIMAL_FIELDS = new Set<keyof MetricImportRow>(["occupancy_rate", "leased_rate", "delinquency_rate"]);

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeMetricDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseNumericField(raw: string, field: keyof MetricImportRow): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[,$]/g, "").replace(/%$/, "");
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;

  if (PERCENT_FIELDS.has(field)) {
    if (trimmed.endsWith("%") || parsed > 1) {
      return parsed / 100;
    }
    return parsed;
  }

  if (INTEGER_FIELDS.has(field)) {
    return Math.trunc(parsed);
  }

  if (DECIMAL_FIELDS.has(field)) {
    return parsed;
  }

  return parsed;
}

async function resolveCommunityIds(
  db: D1Database,
  keys: string[]
): Promise<Map<string, string>> {
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  const mapping = new Map<string, string>();

  if (uniqueKeys.length === 0) return mapping;

  const placeholders = uniqueKeys.map(() => "?").join(", ");
  const rows = await queryAll<{ id: string; external_key: string | null }>(
    db,
    `SELECT id, external_key
     FROM communities
     WHERE deleted_at IS NULL
       AND status = 'active'
       AND external_key IN (${placeholders})`,
    uniqueKeys
  );

  for (const row of rows) {
    if (row.external_key) mapping.set(row.external_key, row.id);
  }

  return mapping;
}

async function parseMetricImportText(
  db: D1Database,
  text: string
): Promise<{ rows: MetricImportRow[]; errors: string[] }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { rows: [], errors: ["Import text is empty"] };
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ["Data must include a header row and at least one data row"] };
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter);
  const headerMap = headers.map((header) => TSV_HEADER_MAPPING[header] ?? TSV_HEADER_MAPPING[header.trim()] ?? null);

  if (!headerMap.includes("metric_date") || !headerMap.includes("window_days") || !headerMap.includes("type")) {
    return {
      rows: [],
      errors: ["Headers must include metric_date, window_days, and type"],
    };
  }

  const externalKeys: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitDelimitedLine(lines[i], delimiter);
    const externalKeyIndex = headerMap.indexOf("community_external_key");
    if (externalKeyIndex >= 0) {
      const value = values[externalKeyIndex]?.trim();
      if (value) externalKeys.push(value);
    }
  }
  const externalKeyMap = await resolveCommunityIds(db, externalKeys);

  const rows: MetricImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitDelimitedLine(lines[i], delimiter);
    if (values.every((value) => !value.trim())) continue;

    const rawRecord: Record<string, unknown> = {};
    let communityExternalKey: string | null = null;

    for (let j = 0; j < headerMap.length; j++) {
      const field = headerMap[j];
      const raw = values[j]?.trim() ?? "";
      if (!field || !raw) continue;

      if (field === "community_external_key") {
        communityExternalKey = raw;
        continue;
      }

      if (field === "metric_date") {
        rawRecord.metric_date = normalizeMetricDate(raw);
        continue;
      }

      if (field === "window_days") {
        const parsed = Number(raw);
        rawRecord.window_days = parsed === 7 || parsed === 30 ? parsed : raw;
        continue;
      }

      if (field === "type") {
        const normalized = raw.toLowerCase();
        rawRecord.type = normalized === "community" || normalized === "portfolio" ? normalized : raw;
        continue;
      }

      if (field === "community_id") {
        rawRecord.community_id = raw;
        continue;
      }

      if (field === "notes_text") {
        rawRecord.notes_text = raw;
        continue;
      }

      rawRecord[field] = parseNumericField(raw, field) ?? raw;
    }

    if (communityExternalKey && !rawRecord.community_id) {
      const communityId = externalKeyMap.get(communityExternalKey);
      if (communityId) {
        rawRecord.community_id = communityId;
      } else {
        errors.push(`Row ${i}: community_external_key ${communityExternalKey} did not resolve to an active community`);
      }
    }

    const parsed = MetricRow.safeParse(rawRecord);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(`Row ${i}: ${issue.message}`);
      continue;
    }

    rows.push(parsed.data);
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid metric rows were parsed from the provided data");
  }

  return { rows, errors };
}

async function createImportRun(
  db: D1Database,
  actorId: string,
  rowsReceived: number,
  mode: "paste_tsv" | "upload_csv"
): Promise<{ importRunId: string; now: string }> {
  const now = nowISO();
  const importRunId = newId();
  await run(
    db,
    `INSERT INTO import_runs (id, entity_type, mode, status, requested_by_user_id, rows_received, rows_applied, started_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, 'weekly_metrics', ?, 'queued', ?, ?, 0, ?, ?, ?, ?, ?)`,
    [importRunId, mode, actorId, rowsReceived, now, now, actorId, now, actorId]
  );
  return { importRunId, now };
}

async function applyMetricImport(
  db: D1Database,
  actorId: string,
  importRunId: string,
  rows: MetricImportRow[],
  now: string
): Promise<Response | null> {
  const validationErrors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!isFriday(r.metric_date)) {
      validationErrors.push(`Row ${i}: metric_date ${r.metric_date} is not a Friday`);
    }
    if (r.type === "community" && !r.community_id) {
      validationErrors.push(`Row ${i}: community_id required when type=community`);
    }
    if (r.type === "portfolio" && r.community_id) {
      validationErrors.push(`Row ${i}: community_id must be null when type=portfolio`);
    }
    const textErr = validateSafeText(r.notes_text, `Row ${i} notes_text`);
    if (textErr) validationErrors.push(textErr);
  }

  if (validationErrors.length > 0) {
    await run(
      db,
      "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [validationErrors.join("; "), now, now, importRunId]
    );
    return new Response(JSON.stringify(errJson("VALIDATION_ERROR", "Import validation failed", validationErrors)), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await run(db, "UPDATE import_runs SET status = 'validating', updated_at = ? WHERE id = ?", [now, importRunId]);

  try {
    const stmts: D1PreparedStatement[] = [];
    const deleteKeys = new Set<string>();
    for (const r of rows) {
      deleteKeys.add(`${r.metric_date}|${r.window_days}|${r.type}|${r.community_id ?? ""}`);
    }
    for (const key of deleteKeys) {
      const [md, wd, tp, cid] = key.split("|");
      stmts.push(stmt(db,
        "DELETE FROM weekly_metrics WHERE metric_date = ? AND window_days = ? AND type = ? AND community_id IS ?",
        [md, parseInt(wd), tp, cid || null]
      ));
    }

    for (const r of rows) {
      const id = newId();
      stmts.push(stmt(db,
        `INSERT INTO weekly_metrics (id, metric_date, window_days, type, community_id, occupancy_rate, leased_rate, traffic_count, applications_count, move_ins, move_outs, delinquency_rate, notes_text, source_import_run_id, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, r.metric_date, r.window_days, r.type, r.community_id ?? null,
         r.occupancy_rate ?? null, r.leased_rate ?? null, r.traffic_count ?? null,
         r.applications_count ?? null, r.move_ins ?? null, r.move_outs ?? null,
         r.delinquency_rate ?? null, r.notes_text ?? null,
         importRunId, now, actorId, now, actorId]
      ));
    }

    await batch(db, stmts);

    const fin = nowISO();
    await run(
      db,
      "UPDATE import_runs SET status = 'applied', rows_applied = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [rows.length, fin, fin, importRunId]
    );

    await writeAuditLog(db, {
      actorUserId: actorId, action: "metrics.import", entityType: "import_run", entityId: importRunId,
      after: { status: "applied", rows_applied: rows.length },
    });

    return new Response(JSON.stringify({ import_run_id: importRunId, status: "applied", rows_applied: rows.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const fin = nowISO();
    const msg = err instanceof Error ? err.message : String(err);
    await run(
      db,
      "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [msg, fin, fin, importRunId]
    );
    return new Response(JSON.stringify(errJson("IMPORT_FAILED", `Import transaction failed: ${msg}`)), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function isUploadFile(value: unknown): value is File {
  return !!value && typeof value === "object" && "text" in value && "name" in value;
}

/** GET /v1/metrics — query with filters, deterministic ordering */
metrics.get("/", async (c) => {
  const { metric_date, window_days, type, community_id } = c.req.query();

  // Validate Friday if metric_date provided
  if (metric_date && !isFriday(metric_date)) {
    return c.json(errJson("VALIDATION_ERROR", "metric_date must be a Friday (ADR-0002)"), 400);
  }

  let sql = "SELECT * FROM weekly_metrics WHERE 1=1";
  const params: unknown[] = [];
  if (metric_date) { sql += " AND metric_date = ?"; params.push(metric_date); }
  if (window_days) { sql += " AND window_days = ?"; params.push(parseInt(window_days)); }
  if (type) { sql += " AND type = ?"; params.push(type); }
  if (community_id) { sql += " AND community_id = ?"; params.push(community_id); }
  sql += " ORDER BY metric_date DESC, window_days ASC, type ASC, community_id ASC";

  const rows = await queryAll(c.env.POP_BRIEF_DB, sql, params);
  return c.json({ items: rows });
});

/**
 * POST /v1/metrics/import/paste
 * Atomic replace-import via JSON payload. Admin only.
 * Per 01_System_Contract.md: single transaction, rollback on error.
 */
metrics.post("/import/paste", requireAdmin, async (c) => {
  const parse = ImportPasteBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  let rows = parse.data.rows ?? [];
  let parseErrors: string[] = [];

  if (!rows.length && parse.data.tsv) {
    const parsed = await parseMetricImportText(db, parse.data.tsv);
    rows = parsed.rows;
    parseErrors = parsed.errors;
  }

  if (!rows.length && !parse.data.tsv) {
    return c.json(errJson("VALIDATION_ERROR", "rows or tsv is required"), 400);
  }

  const { importRunId, now } = await createImportRun(db, actor.id, rows.length, "paste_tsv");

  if (parseErrors.length > 0) {
    await run(
      db,
      "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [parseErrors.join("; "), now, now, importRunId]
    );
    return c.json(errJson("VALIDATION_ERROR", "Import parsing failed", parseErrors), 400);
  }

  const response = await applyMetricImport(db, actor.id, importRunId, rows, now);
  return response ?? c.json(errJson("INTERNAL_ERROR", "Import failed unexpectedly"), 500);
});

/** POST /v1/metrics/import/upload — CSV upload import */
metrics.post("/import/upload", requireAdmin, async (c) => {
  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  const form = await c.req.formData();
  const file = form.get("file");

  if (!isUploadFile(file)) {
    return c.json(errJson("VALIDATION_ERROR", "file is required"), 400);
  }

  const text = await file.text();
  const parsed = await parseMetricImportText(db, text);
  const { importRunId, now } = await createImportRun(db, actor.id, parsed.rows.length, "upload_csv");

  if (parsed.errors.length > 0) {
    await run(
      db,
      "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [parsed.errors.join("; "), now, now, importRunId]
    );
    return c.json(errJson("VALIDATION_ERROR", "Import parsing failed", parsed.errors), 400);
  }

  const bucketKey = `imports/weekly_metrics/${importRunId}/${file.name}`;
  await c.env.POP_BRIEF_UPLOADS.put(bucketKey, text, {
    httpMetadata: {
      contentType: file.type || "text/csv",
    },
  });

  const response = await applyMetricImport(db, actor.id, importRunId, parsed.rows, now);
  return response ?? c.json(errJson("INTERNAL_ERROR", "Upload import failed unexpectedly"), 500);
});

/** GET /v1/metrics/import-file/:import_run_id — check import status */
metrics.get("/import-file/:import_run_id", requireAdmin, async (c) => {
  const id = c.req.param("import_run_id");
  const row = await queryFirst(c.env.POP_BRIEF_DB, "SELECT * FROM import_runs WHERE id = ?", [id]);
  if (!row) return c.json(errJson("NOT_FOUND", "Import run not found"), 404);
  return c.json(row);
});

/** DELETE /v1/metrics — admin delete by scope (ADR-0003) */
metrics.delete("/", requireAdmin, async (c) => {
  const parse = DeleteBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { metric_date, window_days, type } = parse.data;

  if (!isFriday(metric_date)) {
    return c.json(errJson("VALIDATION_ERROR", "metric_date must be a Friday (ADR-0002)"), 400);
  }

  const result = await run(c.env.POP_BRIEF_DB,
    "DELETE FROM weekly_metrics WHERE metric_date = ? AND window_days = ? AND type = ?",
    [metric_date, window_days, type]
  );

  const actor = c.get("user");
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "metrics.delete", entityType: "weekly_metrics", entityId: `${metric_date}|${window_days}|${type}`,
    before: { metric_date, window_days, type, deleted_count: result.meta?.changes ?? 0 },
  });

  return c.json({ ok: true, deleted_count: result.meta?.changes ?? 0 });
});

export { metrics };
