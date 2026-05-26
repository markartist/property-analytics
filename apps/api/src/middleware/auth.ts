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
  full_name: string | null;
  role: "admin" | "editor" | "viewer";
  is_active: number;
  expires_at: string;
  revoked_at: string | null;
}

type SessionIdentity = {
  id: string;
  email: string;
  role: AuthUser["role"];
};

export type SessionResolution =
  | { status: "ok"; user: SessionIdentity }
  | { status: "missing" }
  | { status: "unknown" }
  | { status: "revoked" }
  | { status: "expired" }
  | { status: "inactive"; user: SessionIdentity };

/**
 * Require a valid session cookie. Returns 401 if absent or invalid.
 * Injects AuthUser into context for downstream handlers.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
  const sessionToken = getCookie(c, "pop_session");
  if (!sessionToken) {
    return c.json({ error: { code: "NO_SESSION", message: "Authentication required", details: [] } }, 401);
  }

  const resolution = await resolveSession(c.env.POP_BRIEF_DB, sessionToken);
  if (resolution.status === "ok") {
    c.set("user", { id: resolution.user.id, email: resolution.user.email, role: resolution.user.role });
    await next();
    return;
  }

  if (resolution.status === "inactive") {
    return c.json({ error: { code: "USER_INACTIVE", message: "Account is inactive", details: [] } }, 403);
  }

  const errorCodeByStatus: Record<Exclude<SessionResolution["status"], "ok" | "inactive">, string> = {
    missing: "NO_SESSION",
    unknown: "SESSION_UNKNOWN",
    revoked: "SESSION_REVOKED",
    expired: "SESSION_EXPIRED",
  };

  return c.json(
    {
      error: {
        code: errorCodeByStatus[resolution.status],
        message: "Authentication required",
        details: [],
      },
    },
    401
  );
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
 * Require one of the specified roles. Must be used AFTER requireAuth.
 * Usage: requireRole("admin", "editor")
 */
export function requireRole(...roles: AuthUser["role"][]) {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: { code: "FORBIDDEN", message: `Requires one of: ${roles.join(", ")}`, details: [] } }, 403);
    }
    await next();
  };
}

export function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header("cookie") ?? "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/** Hash the raw session token and look up against sessions + users via D1. */
export async function resolveSession(
  db: D1Database,
  rawToken: string
): Promise<SessionResolution> {
  if (!rawToken) return { status: "missing" };
  const tokenHash = await hashToken(rawToken);
  if (tokenHash === "__invalid_token__") {
    return { status: "unknown" };
  }
  const row = await queryFirst<SessionRow>(
    db,
    `SELECT s.user_id, s.expires_at, s.revoked_at, u.email, u.full_name, u.role, u.is_active
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.session_token_hash = ?`,
    [tokenHash]
  );
  if (!row) return { status: "unknown" };
  const user = { id: row.user_id, email: row.email, role: row.role };
  if (row.revoked_at) return { status: "revoked" };
  if (new Date(row.expires_at) <= new Date()) return { status: "expired" };
  if (row.is_active !== 1) return { status: "inactive", user };
  return { status: "ok", user };
}
