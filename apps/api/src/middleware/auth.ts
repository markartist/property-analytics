import { Context, Next } from "hono";
import type { Env, AuthUser } from "../env";
import { hashToken } from "../lib/crypto";
import { queryFirst } from "../lib/db";

export type AuthVariables = {
  user: AuthUser;
};

interface SessionRow {
  user_id: string;
  email: string;
  role: "admin" | "user";
  is_active: number;
  expires_at: string;
  revoked_at: string | null;
}

/**
 * Require a valid session cookie. Returns 401 if absent or invalid.
 * Injects AuthUser into context for downstream handlers.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
  const sessionToken = getCookie(c, "pop_session");
  if (!sessionToken) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required", details: [] } }, 401);
  }

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

function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header("cookie") ?? "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/** Hash the raw session token and look up against sessions + users via D1. */
async function resolveSession(
  db: D1Database,
  rawToken: string
): Promise<{ id: string; email: string; role: "admin" | "user"; isActive: boolean } | null> {
  const tokenHash = await hashToken(rawToken);
  const row = await queryFirst<SessionRow>(
    db,
    `SELECT s.user_id, s.expires_at, s.revoked_at, u.email, u.role, u.is_active
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.session_token_hash = ?`,
    [tokenHash]
  );
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  return { id: row.user_id, email: row.email, role: row.role, isActive: row.is_active === 1 };
}
