import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/**
 * POST /v1/auth/login
 * Public. Establish authenticated session.
 */
auth.post("/login", async (c) => {
  // TODO: Validate request body (email, password).
  // TODO: Look up user by normalized email.
  // TODO: Verify password hash (bcrypt or equivalent).
  // TODO: Create session row in D1, set httpOnly cookie.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Login not yet implemented", details: [] } },
    501
  );
});

/**
 * POST /v1/auth/logout
 * Authenticated. Revoke current session.
 */
auth.post("/logout", requireAuth, async (c) => {
  // TODO: Mark session as revoked (set revoked_at).
  // TODO: Clear session cookie.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Logout not yet implemented", details: [] } },
    501
  );
});

/**
 * GET /v1/auth/me
 * Authenticated. Return current user context.
 */
auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

/**
 * POST /v1/auth/redeem-invite
 * Public. Create or activate account from invite token.
 */
auth.post("/redeem-invite", async (c) => {
  // TODO: Validate request body (token, full_name, password).
  // TODO: Look up invite by token hash, check expiry and redemption state.
  // TODO: Create user, mark invite redeemed, establish session.
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Invite redemption not yet implemented", details: [] } },
    501
  );
});

export { auth };
