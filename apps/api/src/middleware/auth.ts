import { Context, Next } from "hono";
import type { Env, AuthUser } from "../env";

/**
 * Variables set by middleware, available via c.get().
 */
export type AuthVariables = {
  user: AuthUser;
};

/**
 * Require a valid session cookie. Returns 401 if absent or invalid.
 * Injects AuthUser into context for downstream handlers.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
  const sessionToken = getCookie(c, "pop_session");

  if (!sessionToken) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required", details: [] } }, 401);
  }

  // TODO: Hash sessionToken and look up in sessions table.
  // TODO: Validate expiry, check revoked_at is null.
  // TODO: Join to users table to get role and is_active.
  // Stub: return 401 until session lookup is implemented.
  const user = await resolveSession(c.env.POP_BRIEF_DB, sessionToken);

  if (!user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired session", details: [] } }, 401);
  }

  if (!user.isActive) {
    return c.json({ error: { code: "USER_INACTIVE", message: "Account is inactive", details: [] } }, 403);
  }

  c.set("user", { id: user.id, email: user.email, role: user.role });
  await next();
}

/**
 * Require admin role. Must be used AFTER requireAuth.
 * Per ADR-0003: only admin may perform destructive operations.
 */
export async function requireAdmin(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: { code: "FORBIDDEN", message: "Admin access required", details: [] } }, 403);
  }
  await next();
}

/**
 * Extract cookie value by name from Cookie header.
 */
function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header("cookie") ?? "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/**
 * Stub: resolve session token to user. Returns null until implemented.
 */
async function resolveSession(
  _db: D1Database,
  _token: string
): Promise<{ id: string; email: string; role: "admin" | "user"; isActive: boolean } | null> {
  // TODO: Implement session lookup against D1
  return null;
}
