import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";

const exports_ = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

exports_.use("*", requireAuth);

/**
 * GET /v1/exports/csv
 * Export filtered records as CSV.
 * Query params: entity, week_ending.
 */
exports_.get("/csv", async (c) => {
  // TODO: Validate params, query D1, stream as text/csv.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "CSV export not yet implemented", details: [] } },
    501
  );
});

/**
 * POST /v1/exports/backup
 * Create backup artifact in R2. Admin only.
 */
exports_.post("/backup", requireAdmin, async (c) => {
  // TODO: Query specified entities, write to R2, return key.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Backup export not yet implemented", details: [] } },
    501
  );
});

export { exports_ };
