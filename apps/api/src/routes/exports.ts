import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll } from "../lib/db";
import { errJson } from "../lib/validate";

const ALLOWED_ENTITIES = ["communities", "weekly_metrics", "marketing_weekly", "import_runs", "notification_events"] as const;
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

  // Build CSV
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(",")];
  for (const row of rows) {
    csvLines.push(headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
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

/** POST /v1/exports/backup — R2 backup (not yet implemented) */
exports_.post("/backup", async (c) => {
  return c.json(errJson("NOT_IMPLEMENTED", "R2 backup export not yet implemented"), 501);
});

export { exports_ };
