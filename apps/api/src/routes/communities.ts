import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";

const communities = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// All community routes require authentication
communities.use("*", requireAuth);

/**
 * GET /v1/communities
 * List active communities.
 */
communities.get("/", async (c) => {
  // TODO: Query communities WHERE status = 'active' AND deleted_at IS NULL.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "List communities not yet implemented", details: [] } },
    501
  );
});

/**
 * POST /v1/communities
 * Create community. Admin only per ADR-0003.
 */
communities.post("/", requireAdmin, async (c) => {
  // TODO: Validate request body (name, external_key, region).
  // TODO: Insert into D1 with audit fields.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Create community not yet implemented", details: [] } },
    501
  );
});

/**
 * PATCH /v1/communities/:id
 * Update community. Admin only.
 */
communities.patch("/:id", requireAdmin, async (c) => {
  // TODO: Validate request body, update in D1.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Update community not yet implemented", details: [] } },
    501
  );
});

/**
 * DELETE /v1/communities/:id
 * Soft-delete community. Admin only per ADR-0003.
 */
communities.delete("/:id", requireAdmin, async (c) => {
  // TODO: Set deleted_at and deleted_by. Do not hard delete.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Delete community not yet implemented", details: [] } },
    501
  );
});

export { communities };
