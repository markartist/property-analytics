/**
 * Shared route factory for T7 and T30 leasing funnel metrics.
 * Both tables have identical schemas; only the table name differs.
 *
 * Endpoints:
 *   GET  /              — list/filter by community_id, week_date, type
 *   POST /              — bulk upsert (delete-then-insert for matching composite keys)
 *   POST /import        — bulk import with import_run tracking
 *   DELETE /            — delete by composite key scope
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run, stmt, batch } from "../lib/db";
import { newId } from "../lib/id";
import { isFriday, nowISO, errJson, validateSafeText } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";

// ── Zod schemas ──

const MetricRow = z.object({
  week_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["community", "portfolio"]),
  community_id: z.string().optional(),

  g_cards: z.number().int().nullable().optional(),
  visits: z.number().int().nullable().optional(),
  first_tours: z.number().int().nullable().optional(),
  apps: z.number().int().nullable().optional(),
  leases: z.number().int().nullable().optional(),
  c_and_ds: z.number().int().nullable().optional(),
  move_ins: z.number().int().nullable().optional(),

  v_gc_conv: z.number().nullable().optional(),
  a_gc_conv: z.number().nullable().optional(),
  l_gc_conv: z.number().nullable().optional(),
  l_v_ratio: z.number().nullable().optional(),
  c_d_pct_of_gcs: z.number().nullable().optional(),
  mi_gc_conv: z.number().nullable().optional(),
  mi_v_ratio: z.number().nullable().optional(),

  g_cards_delta: z.number().nullable().optional(),
  visits_delta: z.number().nullable().optional(),
  apps_delta: z.number().nullable().optional(),
  leases_delta: z.number().nullable().optional(),
  c_and_ds_delta: z.number().nullable().optional(),
  move_ins_delta: z.number().nullable().optional(),
  v_gc_conv_delta: z.number().nullable().optional(),
  a_gc_conv_delta: z.number().nullable().optional(),
  l_gc_conv_delta: z.number().nullable().optional(),
  l_v_ratio_delta: z.number().nullable().optional(),
  c_d_pct_of_gcs_delta: z.number().nullable().optional(),
  mi_gc_conv_delta: z.number().nullable().optional(),
  mi_v_ratio_delta: z.number().nullable().optional(),
});

const BulkUpsertBody = z.object({
  community_id: z.string(),
  rows: z.array(MetricRow).min(1, "At least one row is required"),
});

const ImportBody = z.object({
  rows: z.array(MetricRow).min(1),
});

const DeleteBody = z.object({
  community_id: z.string(),
  week_date: z.string(),
  type: z.enum(["community", "portfolio"]).optional(),
});

// ── Column helpers ──

const COLUMNS = [
  "g_cards", "visits", "first_tours", "apps", "leases", "c_and_ds", "move_ins",
  "v_gc_conv", "a_gc_conv", "l_gc_conv", "l_v_ratio", "c_d_pct_of_gcs", "mi_gc_conv", "mi_v_ratio",
  "g_cards_delta", "visits_delta", "apps_delta", "leases_delta", "c_and_ds_delta", "move_ins_delta",
  "v_gc_conv_delta", "a_gc_conv_delta", "l_gc_conv_delta", "l_v_ratio_delta",
  "c_d_pct_of_gcs_delta", "mi_gc_conv_delta", "mi_v_ratio_delta",
] as const;

const ALL_INSERT_COLS = [
  "id", "community_id", "week_date", "type",
  ...COLUMNS,
  "source_import_run_id", "created_at", "created_by", "updated_at", "updated_by",
];

const INSERT_SQL = (table: string) =>
  `INSERT INTO ${table} (${ALL_INSERT_COLS.join(", ")}) VALUES (${ALL_INSERT_COLS.map(() => "?").join(", ")})`;

function rowValues(
  r: z.infer<typeof MetricRow>,
  communityId: string,
  id: string,
  importRunId: string | null,
  now: string,
  actorId: string,
): unknown[] {
  return [
    id, communityId, r.week_date, r.type,
    ...COLUMNS.map((col) => (r as Record<string, unknown>)[col] ?? null),
    importRunId, now, actorId, now, actorId,
  ];
}

// ── Factory ──

export function createLeasingMetricsRouter(tableName: "t7_metrics" | "t30_metrics", label: string) {
  const router = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  router.use("*", requireAuth);

  // ── GET / — list with optional filters ──
  router.get("/", async (c) => {
    const { community_id, week_date, type } = c.req.query();

    if (week_date && !isFriday(week_date)) {
      return c.json(errJson("VALIDATION_ERROR", "week_date must be a Friday"), 400);
    }

    let sql = `SELECT * FROM ${tableName} WHERE 1=1`;
    const params: unknown[] = [];
    if (community_id) { sql += " AND community_id = ?"; params.push(community_id); }
    if (week_date) { sql += " AND week_date = ?"; params.push(week_date); }
    if (type) { sql += " AND type = ?"; params.push(type); }
    sql += " ORDER BY week_date DESC, type ASC, community_id ASC";

    const rows = await queryAll(c.env.POP_BRIEF_DB, sql, params);
    return c.json({ items: rows });
  });

  // ── POST / — bulk upsert (delete matching composites, then insert) ──
  router.post("/", async (c) => {
    const parse = BulkUpsertBody.safeParse(await c.req.json());
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
    const { community_id, rows } = parse.data;
    const db = c.env.POP_BRIEF_DB;
    const actor = c.get("user");
    const now = nowISO();

    // Validate Fridays
    for (let i = 0; i < rows.length; i++) {
      if (!isFriday(rows[i].week_date)) {
        return c.json(errJson("VALIDATION_ERROR", `Row ${i}: week_date ${rows[i].week_date} is not a Friday`), 400);
      }
    }

    const stmts: D1PreparedStatement[] = [];

    // Delete existing records for this community + date (all types for that date)
    const deleteDates = new Set(rows.map((r) => r.week_date));
    for (const date of deleteDates) {
      stmts.push(stmt(db,
        `DELETE FROM ${tableName} WHERE community_id = ? AND week_date = ?`,
        [community_id, date]
      ));
    }

    // Insert new rows
    const insertSql = INSERT_SQL(tableName);
    for (const r of rows) {
      const id = newId();
      stmts.push(stmt(db, insertSql, rowValues(r, community_id, id, null, now, actor.id)));
    }

    await batch(db, stmts);

    await writeAuditLog(db, {
      actorUserId: actor.id,
      action: `${label}.upsert`,
      entityType: tableName,
      entityId: community_id,
      after: { rows_applied: rows.length, week_dates: [...deleteDates] },
    });

    return c.json({ ok: true, rows_applied: rows.length });
  });

  // ── POST /import — bulk import with import_run tracking ──
  router.post("/import", requireAdmin, async (c) => {
    const parse = ImportBody.safeParse(await c.req.json());
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
    const { rows } = parse.data;
    const db = c.env.POP_BRIEF_DB;
    const actor = c.get("user");
    const now = nowISO();
    const importRunId = newId();

    // Create import_run record
    await run(db,
      `INSERT INTO import_runs (id, entity_type, mode, status, requested_by_user_id, rows_received, rows_applied, started_at, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, 'paste_tsv', 'queued', ?, ?, 0, ?, ?, ?, ?, ?)`,
      [importRunId, tableName, actor.id, rows.length, now, now, actor.id, now, actor.id]
    );

    // Validate
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!isFriday(r.week_date)) errors.push(`Row ${i}: week_date ${r.week_date} is not a Friday`);
      if (r.type === "community" && !r.community_id) errors.push(`Row ${i}: community_id required for type=community`);
    }

    if (errors.length > 0) {
      await run(db,
        "UPDATE import_runs SET status = 'failed', error_summary = ?, finished_at = ?, updated_at = ? WHERE id = ?",
        [errors.join("; "), now, now, importRunId]
      );
      return c.json(errJson("VALIDATION_ERROR", "Import validation failed", errors), 400);
    }

    await run(db, "UPDATE import_runs SET status = 'validating', updated_at = ? WHERE id = ?", [now, importRunId]);

    try {
      const stmts: D1PreparedStatement[] = [];

      // Delete matching composites
      const deleteKeys = new Set<string>();
      for (const r of rows) {
        deleteKeys.add(`${r.community_id ?? ""}|${r.week_date}|${r.type}`);
      }
      for (const key of deleteKeys) {
        const [cid, wd, tp] = key.split("|");
        stmts.push(stmt(db,
          `DELETE FROM ${tableName} WHERE community_id IS ? AND week_date = ? AND type = ?`,
          [cid || null, wd, tp]
        ));
      }

      // Insert
      const insertSql = INSERT_SQL(tableName);
      for (const r of rows) {
        const id = newId();
        stmts.push(stmt(db, insertSql, rowValues(r, r.community_id ?? "", id, importRunId, now, actor.id)));
      }

      await batch(db, stmts);

      const fin = nowISO();
      await run(db,
        "UPDATE import_runs SET status = 'applied', rows_applied = ?, finished_at = ?, updated_at = ? WHERE id = ?",
        [rows.length, fin, fin, importRunId]
      );

      await writeAuditLog(db, {
        actorUserId: actor.id,
        action: `${label}.import`,
        entityType: "import_run",
        entityId: importRunId,
        after: { status: "applied", rows_applied: rows.length },
      });

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

  // ── DELETE / — delete by composite scope ──
  router.delete("/", requireAdmin, async (c) => {
    const parse = DeleteBody.safeParse(await c.req.json());
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
    const { community_id, week_date, type } = parse.data;

    if (!isFriday(week_date)) {
      return c.json(errJson("VALIDATION_ERROR", "week_date must be a Friday"), 400);
    }

    let sql = `DELETE FROM ${tableName} WHERE community_id = ? AND week_date = ?`;
    const params: unknown[] = [community_id, week_date];
    if (type) { sql += " AND type = ?"; params.push(type); }

    const result = await run(c.env.POP_BRIEF_DB, sql, params);

    const actor = c.get("user");
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: `${label}.delete`,
      entityType: tableName,
      entityId: `${community_id}|${week_date}`,
      before: { community_id, week_date, type, deleted_count: result.meta?.changes ?? 0 },
    });

    return c.json({ ok: true, deleted_count: result.meta?.changes ?? 0 });
  });

  return router;
}
