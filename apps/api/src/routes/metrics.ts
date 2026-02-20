import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";

const metrics = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

metrics.use("*", requireAuth);

/**
 * GET /v1/metrics
 * Query weekly metrics with filters: metric_date, window_days, type.
 */
metrics.get("/", async (c) => {
  // TODO: Parse query params, validate Friday rule (ADR-0002), query D1.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Get metrics not yet implemented", details: [] } },
    501
  );
});

/**
 * POST /v1/metrics/import/paste
 * Replace-import metrics via pasted TSV. Admin only.
 */
metrics.post("/import/paste", requireAdmin, async (c) => {
  // TODO: Validate TSV shape, enforce Friday week-ending (ADR-0002).
  // TODO: Log import_run, execute replace-import transaction, store result.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Paste import not yet implemented", details: [] } },
    501
  );
});

/**
 * POST /v1/metrics/import/upload
 * Upload CSV file and import. Admin only.
 */
metrics.post("/import/upload", requireAdmin, async (c) => {
  // TODO: Accept multipart file, store artifact in R2, validate, import.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Upload import not yet implemented", details: [] } },
    501
  );
});

/**
 * GET /v1/metrics/import-file/:import_run_id
 * Check import run status. Admin only.
 */
metrics.get("/import-file/:import_run_id", requireAdmin, async (c) => {
  // TODO: Look up import_run by id, return status.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Import status not yet implemented", details: [] } },
    501
  );
});

/**
 * DELETE /v1/metrics
 * Admin delete metric scope. Per ADR-0003: admin only.
 */
metrics.delete("/", requireAdmin, async (c) => {
  // TODO: Validate scope (metric_date, window_days, type), delete matching rows.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Delete metrics not yet implemented", details: [] } },
    501
  );
});

export { metrics };
