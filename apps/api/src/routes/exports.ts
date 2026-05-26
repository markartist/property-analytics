import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll } from "../lib/db";
import { errJson, escapeCsvCell } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";

const ALLOWED_ENTITIES = [
  "communities",
  "weekly_metrics",
  "marketing_weekly",
  "import_runs",
  "notification_events",
  "t7_metrics",
  "t30_metrics",
  "marketing_data",
] as const;
type ExportEntity = (typeof ALLOWED_ENTITIES)[number];

const exports_ = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
exports_.use("*", requireAuth, requireAdmin);

/** GET /v1/exports/csv?entity= — export entity as CSV. Admin only. */
exports_.get("/csv", async (c) => {
  const entity = c.req.query("entity") as string | undefined;
  if (!entity || !ALLOWED_ENTITIES.includes(entity as ExportEntity)) {
    return c.json(errJson("VALIDATION_ERROR", `entity must be one of: ${ALLOWED_ENTITIES.join(", ")}`), 400);
  }

  const rows = await queryAll<Record<string, unknown>>(c.env.POP_BRIEF_DB, `SELECT * FROM ${entity}`);
  if (rows.length === 0) {
    return new Response("", { status: 200, headers: { "Content-Type": "text/csv" } });
  }

  const actor = c.get("user");
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "export.csv", entityType: entity, entityId: "*",
    after: { row_count: rows.length },
  });

  // Build CSV with formula injection protection (prefix =, +, -, @ with single quote)
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(",")];
  for (const row of rows) {
    csvLines.push(headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = escapeCsvCell(String(val));
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(","));
  }

  return new Response(csvLines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${entity}.csv"`,
    },
  });
});

/** POST /v1/exports/backup — create backup artifact in R2 and return object key */
exports_.post("/backup", async (c) => {
  const body = await c.req.json().catch(() => ({} as { entities?: string[] }));
  const requested = Array.isArray(body.entities) && body.entities.length > 0 ? body.entities : [...ALLOWED_ENTITIES];
  const invalid = requested.filter((entity: string) => !ALLOWED_ENTITIES.includes(entity as ExportEntity));

  if (invalid.length > 0) {
    return c.json(
      errJson("VALIDATION_ERROR", `entities must be drawn from: ${ALLOWED_ENTITIES.join(", ")}`, invalid),
      400
    );
  }

  const entities = requested as ExportEntity[];
  const backup: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    entities: {} as Record<string, unknown>,
  };
  const counts: Record<string, number> = {};

  for (const entity of entities) {
    const rows = await queryAll<Record<string, unknown>>(c.env.POP_BRIEF_DB, `SELECT * FROM ${entity}`);
    (backup.entities as Record<string, unknown>)[entity] = rows;
    counts[entity] = rows.length;
  }

  const actor = c.get("user");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `backups/${stamp}-${actor.id}.json`;
  await c.env.POP_BRIEF_UPLOADS.put(key, JSON.stringify(backup, null, 2), {
    httpMetadata: {
      contentType: "application/json",
    },
  });

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "export.backup",
    entityType: "backup_artifact",
    entityId: key,
    after: { entities, counts },
  });

  return c.json({ ok: true, key, entities, counts });
});

export { exports_ };
