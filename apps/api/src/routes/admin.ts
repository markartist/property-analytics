import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";

const admin = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// All admin routes require auth + admin role
admin.use("*", requireAuth, requireAdmin);

/**
 * POST /v1/admin/invites
 * Create an invite for a new user.
 */
admin.post("/invites", async (c) => {
  // TODO: Validate request body (email, role, expires_in_days).
  // TODO: Generate token, hash it, store invite in D1.
  // TODO: Send invite email via Resend.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Create invite not yet implemented", details: [] } },
    501
  );
});

/**
 * GET /v1/admin/users
 * List all users.
 */
admin.get("/users", async (c) => {
  // TODO: Query users from D1, exclude soft-deleted.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "List users not yet implemented", details: [] } },
    501
  );
});

/**
 * PATCH /v1/admin/users/:id
 * Update user role or active state.
 */
admin.patch("/users/:id", async (c) => {
  // TODO: Validate request body (role, is_active).
  // TODO: Update user in D1.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Patch user not yet implemented", details: [] } },
    501
  );
});

export { admin };
