import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const marketing = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

marketing.use("*", requireAuth);

/**
 * GET /v1/marketing
 * Retrieve marketing weekly records. Filter by week_ending.
 */
marketing.get("/", async (c) => {
  // TODO: Parse query params, validate Friday rule (ADR-0002), query D1.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Get marketing not yet implemented", details: [] } },
    501
  );
});

/**
 * PATCH /v1/marketing/:id
 * Update marketing weekly values.
 */
marketing.patch("/:id", async (c) => {
  // TODO: Validate request body, update in D1.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Patch marketing not yet implemented", details: [] } },
    501
  );
});

/**
 * POST /v1/marketing/scan-mentions
 * Detect mention events and send deduped notifications.
 */
marketing.post("/scan-mentions", async (c) => {
  // TODO: Compute mention candidates, check dedupe_key, send via Resend.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Scan mentions not yet implemented", details: [] } },
    501
  );
});

export { marketing };
