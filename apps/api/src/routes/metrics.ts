import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run, stmt, batch } from "../lib/db";
import { newId } from "../lib/id";
import { isFriday, nowISO, errJson } from "../lib/validate";

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
  rows: z.array(MetricRow).min(1, "At least one row is required"),
});

const DeleteBody = z.object({
  metric_date: z.string(),
  window_days: z.union([z.literal(7), z.literal(30)]),
  type: z.enum(["community", "portfolio"]),
});

const metrics = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
metrics.use("*", requireAuth);

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
  const { rows } = parse.data;

  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  const now = nowISO();
  const importRunId = newId();

  // Validate all rows: Friday rule (hard runtime check per ADR-0002)
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
  }

  // Log import_run (queued)
  await run(db,
    `INSERT INTO import_runs (id, entity_type, mode, status, requested_by_user_id, rows_received, rows_applied, started_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, 'weekly_metrics', 'paste_tsv', 'queued', ?, ?, 0, ?, ?, ?, ?, ?)`,
    [importRunId, actor.id, rows.length, now, now, actor.id, now, actor.id]
  );

  if (validationErrors.length > 0) {
    await run(db,
      "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [validationErrors.join("; "), now, now, importRunId]
    );
    return c.json(errJson("VALIDATION_ERROR", "Import validation failed", validationErrors), 400);
  }

  // Transition: validating
  await run(db, "UPDATE import_runs SET status = 'validating', updated_at = ? WHERE id = ?", [now, importRunId]);

  try {
    // Build atomic batch: DELETE matching composites then INSERT new rows
    const stmts: D1PreparedStatement[] = [];

    // Dedupe the composite keys to delete
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

    // Insert new rows
    for (const r of rows) {
      const id = newId();
      stmts.push(stmt(db,
        `INSERT INTO weekly_metrics (id, metric_date, window_days, type, community_id, occupancy_rate, leased_rate, traffic_count, applications_count, move_ins, move_outs, delinquency_rate, notes_text, source_import_run_id, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, r.metric_date, r.window_days, r.type, r.community_id ?? null,
         r.occupancy_rate ?? null, r.leased_rate ?? null, r.traffic_count ?? null,
         r.applications_count ?? null, r.move_ins ?? null, r.move_outs ?? null,
         r.delinquency_rate ?? null, r.notes_text ?? null,
         importRunId, now, actor.id, now, actor.id]
      ));
    }

    await batch(db, stmts);

    // Mark applied
    const fin = nowISO();
    await run(db,
      "UPDATE import_runs SET status = 'applied', rows_applied = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [rows.length, fin, fin, importRunId]
    );

    return c.json({ import_run_id: importRunId, status: "applied", rows_applied: rows.length });
  } catch (err) {
    const fin = nowISO();
    const msg = err instanceof Error ? err.message : String(err);
    await run(db,
      "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
      [msg, fin, fin, importRunId]
    );
    return c.json(errJson("IMPORT_FAILED", `Import transaction failed: ${msg}`), 500);
  }
});

/** POST /v1/metrics/import/upload — CSV upload (Phase 3, not yet implemented) */
metrics.post("/import/upload", requireAdmin, async (c) => {
  return c.json(errJson("NOT_IMPLEMENTED", "CSV upload import not yet implemented"), 501);
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
  return c.json({ ok: true, deleted_count: result.meta?.changes ?? 0 });
});

export { metrics };
