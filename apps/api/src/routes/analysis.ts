import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const analysis = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

analysis.use("*", requireAuth);

/**
 * GET /v1/analysis
 * Return synthesized analysis payload for briefing UI.
 * Query param: week_ending (must be Friday per ADR-0002).
 */
analysis.get("/", async (c) => {
  // TODO: Validate week_ending param (Friday rule).
  // TODO: Aggregate weekly_metrics and marketing_weekly from D1.
  // TODO: Build portfolio + communities response shape.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Analysis not yet implemented", details: [] } },
    501
  );
});

export { analysis };
