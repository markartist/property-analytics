import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { getCookie, requireAuth, resolveSession } from "../middleware/auth";
import { queryFirst, run } from "../lib/db";
import { verifyPassword, hashPassword, generateToken, hashToken } from "../lib/crypto";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";
import { loginLimiter, magicLinkLimiter } from "../lib/auth-rate-limit";
import { sendEmail } from "../email/resend";
import { resolveCloudflareAccessIdentity } from "../lib/service-auth";
import { writeAuditLog } from "../lib/audit";
import { cookieDomainForFrontend, frontendUrl, isLocalFrontendRequest } from "../lib/frontend-origin";

const SESSION_TTL_HOURS = 72;

const MAGIC_LINK_TTL_MINUTES = 15;
const VALID_APP_ROLES = new Set(["admin", "editor", "viewer"] as const);

const LoginBody = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

const MagicLinkBody = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  next: z.string().optional(),
});

const RedeemBody = z.object({
  token: z.string().min(1),
  full_name: z.string().min(1),
  password: z.string().min(8),
});

const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** POST /v1/auth/login — establish session */
auth.post("/login", async (c) => {
  // Rate limit by IP to protect against brute force (dev-only in-memory; TODO: Durable Objects for prod)
  const clientIp = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const rl = await loginLimiter.check(c.env.POP_BRIEF_DB, clientIp);
  if (rl.allowed === false) {
    c.header("Retry-After", String(rl.retryAfterSeconds));
    return c.json(errJson("RATE_LIMITED", "Too many login attempts. Try again later."), 429);
  }

  const parse = LoginBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { email, password } = parse.data;

  const user = await queryFirst<{ id: string; email: string; role: string; password_hash: string; is_active: number }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, role, password_hash, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
    [email]
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json(errJson("INVALID_CREDENTIALS", "Invalid email or password"), 401);
  }
  if (!user.is_active) {
    return c.json(errJson("USER_INACTIVE", "Account is inactive"), 403);
  }

  // Create session
  const { raw, hash } = await generateToken();
  const sessionId = newId();
  const now = nowISO();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();

  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, hash, expiresAt, now, user.id, now, user.id]
  );

  // Update last_login_at
  await run(c.env.POP_BRIEF_DB, "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [now, now, user.id]);

  c.header("Set-Cookie", `pop_session=${raw}; ${cookieOpts(c)}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
  return c.json({ user: { id: user.id, email: user.email, role: user.role } });
});

/** POST /v1/auth/logout — revoke session */
auth.post("/logout", requireAuth, async (c) => {
  // Revoke the session by reading the cookie token and marking it
  const rawToken = c.req.header("cookie")?.match(/pop_session=([^;]+)/)?.[1];
  if (rawToken) {
    const tokenHash = await hashToken(rawToken);
    const now = nowISO();
    await run(c.env.POP_BRIEF_DB,
      "UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE session_token_hash = ?",
      [now, now, tokenHash]
    );
  }
  c.header("Set-Cookie", `pop_session=; ${cookieOpts(c)}; Max-Age=0`);
  return c.json({ ok: true });
});

/** POST /v1/auth/magic-link — send a magic login link via email */
auth.post("/magic-link", async (c) => {
  const parse = MagicLinkBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { email } = parse.data;
  const nextPath = safeFrontendPath(parse.data.next);

  // Rate limit by email
  const rl = await magicLinkLimiter.check(c.env.POP_BRIEF_DB, email);
  if (rl.allowed === false) {
    c.header("Retry-After", String(rl.retryAfterSeconds));
    return c.json(errJson("RATE_LIMITED", "Too many requests. Try again later."), 429);
  }

  const emailAllowed = isMagicLinkEmailAllowed(c, email);
  const autoProvisionAllowed = isMagicLinkAutoProvisionAllowed(c, nextPath);

  // Check user exists and is active. If configured, allowed company domains can
  // be auto-provisioned only for configured protected read-only launch paths,
  // without granting broad steward permissions.
  let user = await queryFirst<{ id: string; email: string; is_active: number }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
    [email]
  );

  if (!user && emailAllowed && autoProvisionAllowed) {
    const role = resolveMagicLinkDefaultRole(c);
    const userId = newId();
    const now = nowISO();
    const fullName = email.split("@")[0]?.replace(/[._-]+/g, " ").trim().slice(0, 255) || null;

    await run(
      c.env.POP_BRIEF_DB,
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [userId, email, fullName, role, now, userId, now, userId]
    );

    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: userId,
      action: "user.magic_link_auto_provision",
      entityType: "user",
      entityId: userId,
      after: {
        email,
        full_name: fullName,
        role,
        source: "magic_link_allowed_domain",
        next_path: nextPath,
      },
    });

    user = { id: userId, email, is_active: 1 };
  }

  // Always return success to avoid email enumeration
  if (!emailAllowed || !user || !user.is_active) {
    return c.json({ ok: true, message: "If that email exists, a login link has been sent." });
  }

  // Generate token
  const { raw, hash } = await generateToken();
  const tokenId = newId();
  const now = nowISO();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000).toISOString();

  await run(c.env.POP_BRIEF_DB,
    "INSERT INTO magic_tokens (id, email, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [tokenId, email, hash, expiresAt, now]
  );

  // Build verify URL pointing to frontend (not API) to defeat email link scanners
  const verifyUrl = `${frontendUrl(c)}/login/verify?token=${raw}&next=${encodeURIComponent(nextPath)}`;

  // Send email
  if (c.env.ENABLE_EMAIL_SEND === "true") {
    const result = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
      to: email,
      subject: "Sign in to The Data Pond",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #15284B; font-size: 24px; margin: 0;">The Data Pond</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">WebOps</p>
          </div>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Click the button below to sign in. This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background-color: #15284B; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Sign In</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">If you didn't request this, you can safely ignore this email. The link will expire automatically.</p>
        </div>
      `,
    });
    if (!result.ok) {
      console.error("[MAGIC_LINK_FAIL]", { email, error: result.error });
    } else {
      console.log(`[RESEND] Magic link sent to ${email}, messageId=${result.messageId}`);
    }
  } else {
    // Dev mode: log the link
    console.log(`[DEV] Magic link for ${email}: ${verifyUrl}`);
  }

  return c.json({ ok: true, message: "If that email exists, a login link has been sent." });
});

/** GET /v1/auth/verify — redirect to frontend (backwards compat, safe from email scanners) */
auth.get("/verify", async (c) => {
  const raw = c.req.query("token");
  if (!raw) return c.redirect(frontendUrl(c) + "/login?error=missing_token");
  const complete = c.req.query("complete");
  if (complete === "1") {
    const result = await consumeMagicLinkToken(c.env.POP_BRIEF_DB, raw);
    if (result.ok === false) return c.redirect(`${frontendUrl(c)}/login?error=${result.errorCode}`);
    c.header("Set-Cookie", `pop_session=${result.sessionRaw}; ${cookieOpts(c)}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
    return c.redirect(frontendUrl(c) + safeFrontendPath(c.req.query("next")));
  }
  // Default: redirect to frontend verify page — does NOT consume the token
  const nextPath = safeFrontendPath(c.req.query("next"));
  return c.redirect(frontendUrl(c) + `/login/verify?token=${raw}&next=${encodeURIComponent(nextPath)}`);
});

/** POST /v1/auth/verify — consume magic link token and create session (requires user click) */
auth.post("/verify", async (c) => {
  const body = z.object({ token: z.string().min(1) }).safeParse(await c.req.json());
  if (!body.success) return c.json(errJson("VALIDATION_ERROR", "Missing token"), 400);
  const result = await consumeMagicLinkToken(c.env.POP_BRIEF_DB, body.data.token);
  if (result.ok === false) return c.json(errJson(result.errorCode.toUpperCase(), result.message), result.status as 400 | 403);

  c.header("Set-Cookie", `pop_session=${result.sessionRaw}; ${cookieOpts(c)}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
  return c.json({ user: { id: result.user.id, email: result.user.email, role: result.user.role } });
});

/** GET /v1/auth/access-bootstrap — establish api-domain session from Cloudflare Access browser identity */
auth.get("/access-bootstrap", async (c) => {
  const nextPath = safeFrontendPath(c.req.query("next"));
  const fallback = (error: string) => c.redirect(`${frontendUrl(c)}/login?error=${encodeURIComponent(error)}`);

  const sessionToken = getCookie(c, "pop_session");
  if (sessionToken) {
    const sessionUser = await resolveSession(c.env.POP_BRIEF_DB, sessionToken);
    if (sessionUser.status === "ok") {
      return c.redirect(`${frontendUrl(c)}${nextPath}`);
    }
  }

  const bootstrapped = await bootstrapCloudflareAccessSession(c);
  if (!bootstrapped) {
    const headers = c.req.raw?.headers;
    const hasAccessJwt = Boolean(headers?.get("cf-access-jwt-assertion"));
    return fallback(hasAccessJwt ? "cloudflare_access_unavailable" : "cloudflare_access_missing");
  }

  c.header("Set-Cookie", `pop_session=${bootstrapped.sessionRaw}; ${cookieOpts(c)}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
  return c.redirect(`${frontendUrl(c)}${nextPath}`);
});

/** GET /v1/auth/me — current user context */
auth.get("/me", async (c) => {
  const sessionToken = getCookie(c, "pop_session");
  if (sessionToken) {
    const sessionUser = await resolveSession(c.env.POP_BRIEF_DB, sessionToken);
    if (sessionUser.status === "ok") {
      return c.json({ user: { id: sessionUser.user.id, email: sessionUser.user.email, role: sessionUser.user.role } });
    }
  }

  const bootstrapped = await bootstrapCloudflareAccessSession(c);
  if (bootstrapped) {
    c.header("Set-Cookie", `pop_session=${bootstrapped.sessionRaw}; ${cookieOpts(c)}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
    return c.json({ user: bootstrapped.user, bootstrap: "cloudflare_access" });
  }

  return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required", details: [] } }, 401);
});

/** POST /v1/auth/redeem-invite — create account from invite token */
auth.post("/redeem-invite", async (c) => {
  const parse = RedeemBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { token, full_name, password } = parse.data;

  // Look up invite by hashed token
  const tokenHash = await hashToken(token);
  const invite = await queryFirst<{ id: string; email: string; role: string; expires_at: string; redeemed_at: string | null }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, role, expires_at, redeemed_at FROM invites WHERE token_hash = ?",
    [tokenHash]
  );
  if (!invite) return c.json(errJson("INVITE_INVALID", "Invalid invite token"), 400);
  if (invite.redeemed_at) return c.json(errJson("INVITE_ALREADY_REDEEMED", "Invite already used"), 409);
  if (new Date(invite.expires_at) <= new Date()) return c.json(errJson("INVITE_EXPIRED", "Invite has expired"), 400);

  const now = nowISO();
  const userId = newId();
  const passwordHash = await hashPassword(password);

  // Create user
  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [userId, invite.email, full_name, passwordHash, invite.role, now, userId, now, userId]
  );

  // Mark invite redeemed
  await run(c.env.POP_BRIEF_DB,
    "UPDATE invites SET redeemed_at = ?, redeemed_user_id = ?, updated_at = ? WHERE id = ?",
    [now, userId, now, invite.id]
  );

  // Create session
  const { raw, hash } = await generateToken();
  const sessionId = newId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();
  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, hash, expiresAt, now, userId, now, userId]
  );

  c.header("Set-Cookie", `pop_session=${raw}; ${cookieOpts(c)}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
  return c.json({ user: { id: userId, email: invite.email, role: invite.role } });
});

function safeFrontendPath(nextValue?: string | null): string {
  const normalized = (nextValue ?? "/").trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/";
  }
  return normalized;
}

export { auth };

type AppRole = "admin" | "editor" | "viewer";

function parseCsvList(value?: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeBoolean(value?: string | null): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function resolveAutoProvisionRole(c: { env: Env }, email: string): AppRole | null {
  const normalizedEmail = email.trim().toLowerCase();
  const adminEmails = new Set(parseCsvList(c.env.CLOUDFLARE_ACCESS_ADMIN_EMAILS));
  if (adminEmails.has(normalizedEmail)) {
    return "admin";
  }

  const editorEmails = new Set(parseCsvList(c.env.CLOUDFLARE_ACCESS_EDITOR_EMAILS));
  if (editorEmails.has(normalizedEmail)) {
    return "editor";
  }

  const allowedEmails = new Set(parseCsvList(c.env.CLOUDFLARE_ACCESS_ALLOWED_EMAILS));
  const allowedDomains = new Set(parseCsvList(c.env.CLOUDFLARE_ACCESS_ALLOWED_DOMAINS));
  const emailDomain = normalizedEmail.split("@")[1] ?? "";
  const allowlistsConfigured = allowedEmails.size > 0 || allowedDomains.size > 0;

  if (allowlistsConfigured && !allowedEmails.has(normalizedEmail) && !allowedDomains.has(emailDomain)) {
    return null;
  }

  const configuredDefaultRole = (c.env.CLOUDFLARE_ACCESS_DEFAULT_ROLE ?? "viewer").trim().toLowerCase();
  return VALID_APP_ROLES.has(configuredDefaultRole as AppRole) ? (configuredDefaultRole as AppRole) : "viewer";
}

function isMagicLinkEmailAllowed(c: { env: Env }, email: string): boolean {
  const allowedDomains = new Set(parseCsvList(c.env.MAGIC_LINK_ALLOWED_DOMAINS));
  if (allowedDomains.size === 0) {
    return true;
  }
  const emailDomain = email.trim().toLowerCase().split("@")[1] ?? "";
  return allowedDomains.has(emailDomain);
}

function isMagicLinkAutoProvisionAllowed(c: { env: Env }, nextPath: string): boolean {
  if (!normalizeBoolean(c.env.MAGIC_LINK_AUTO_PROVISION_ENABLED)) {
    return false;
  }

  const allowedPathPrefixes = parseCsvList(c.env.MAGIC_LINK_AUTO_PROVISION_PATH_PREFIXES);
  if (allowedPathPrefixes.length === 0) {
    return false;
  }

  return allowedPathPrefixes.some((prefix) => {
    if (!prefix.startsWith("/") || prefix.startsWith("//")) {
      return false;
    }
    return nextPath === prefix || nextPath.startsWith(`${prefix}/`);
  });
}

function resolveMagicLinkDefaultRole(c: { env: Env }): AppRole {
  const configuredDefaultRole = (c.env.MAGIC_LINK_DEFAULT_ROLE ?? "viewer").trim().toLowerCase();
  return VALID_APP_ROLES.has(configuredDefaultRole as AppRole) ? (configuredDefaultRole as AppRole) : "viewer";
}

async function bootstrapCloudflareAccessSession(
  c: {
    env: Env;
    req: {
      header: (name: string) => string | undefined | null;
      raw?: { headers: Headers };
    };
  }
): Promise<{ user: { id: string; email: string; role: string }; sessionRaw: string } | null> {
  const access = await resolveCloudflareAccessIdentity(
    c.req.raw?.headers ?? { get: c.req.header },
    c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
    c.env.CLOUDFLARE_ACCESS_AUD
  );
  const identity = access.identity;
  if (!identity?.email) {
    return null;
  }

  let user = await queryFirst<{ id: string; email: string; role: string; is_active: number }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, role, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
    [identity.email]
  );

  if (!user && normalizeBoolean(c.env.CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED)) {
    const provisionedRole = resolveAutoProvisionRole(c, identity.email);
    if (provisionedRole) {
      const userId = newId();
      const now = nowISO();
      const fullName =
        identity.commonName && !identity.commonName.includes("@")
          ? identity.commonName.trim().slice(0, 255)
          : null;

      await run(
        c.env.POP_BRIEF_DB,
        `INSERT INTO users (id, email, full_name, role, is_active, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [userId, identity.email, fullName, provisionedRole, now, userId, now, userId]
      );

      await writeAuditLog(c.env.POP_BRIEF_DB, {
        actorUserId: userId,
        action: "user.auto_provision",
        entityType: "user",
        entityId: userId,
        after: {
          email: identity.email,
          full_name: fullName,
          role: provisionedRole,
          source: "cloudflare_access",
        },
      });

      user = {
        id: userId,
        email: identity.email,
        role: provisionedRole,
        is_active: 1,
      };
    }
  }

  if (!user || !user.is_active) {
    console.warn("[AUTH_CF_BOOTSTRAP_FAIL]", {
      email: identity.email,
      verification_result: access.verificationResult,
      has_jwt: access.hasJwt,
      has_header: access.hasHeader,
      user_found: Boolean(user),
      user_active: Boolean(user?.is_active),
      auto_provision_enabled: normalizeBoolean(c.env.CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED),
    });
    return null;
  }

  const session = await generateToken();
  const sessionId = newId();
  const now = nowISO();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, session.hash, expiresAt, now, user.id, now, user.id]
  );
  await run(c.env.POP_BRIEF_DB, "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [now, now, user.id]);

  return {
    user: { id: user.id, email: user.email, role: user.role },
    sessionRaw: session.raw,
  };
}

async function consumeMagicLinkToken(
  db: D1Database,
  raw: string
): Promise<
  | { ok: true; user: { id: string; email: string; role: string }; sessionRaw: string }
  | { ok: false; status: number; errorCode: "invalid_token" | "token_used" | "token_expired" | "user_inactive"; message: string }
> {
  const tokenHash = await hashToken(raw);
  if (tokenHash === "__invalid_token__") {
    return { ok: false, status: 400, errorCode: "invalid_token", message: "This login link is invalid." };
  }
  const token = await queryFirst<{ id: string; email: string; expires_at: string; used_at: string | null }>(
    db,
    "SELECT id, email, expires_at, used_at FROM magic_tokens WHERE token_hash = ?",
    [tokenHash]
  );

  if (!token) return { ok: false, status: 400, errorCode: "invalid_token", message: "This login link is invalid." };
  if (token.used_at) return { ok: false, status: 400, errorCode: "token_used", message: "This login link has already been used." };
  if (new Date(token.expires_at) <= new Date()) return { ok: false, status: 400, errorCode: "token_expired", message: "This login link has expired." };

  const now = nowISO();
  await run(db, "UPDATE magic_tokens SET used_at = ? WHERE id = ?", [now, token.id]);

  const user = await queryFirst<{ id: string; email: string; role: string; is_active: number }>(
    db,
    "SELECT id, email, role, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
    [token.email]
  );
  if (!user || !user.is_active) return { ok: false, status: 403, errorCode: "user_inactive", message: "Account is inactive." };

  const session = await generateToken();
  const sessionId = newId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();

  await run(
    db,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, session.hash, expiresAt, now, user.id, now, user.id]
  );
  await run(db, "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [now, now, user.id]);

  return { ok: true, user: { id: user.id, email: user.email, role: user.role }, sessionRaw: session.raw };
}

function cookieOpts(c: { req: { header: (name: string) => string | undefined; url: string } }): string {
  if (isLocalFrontendRequest(c as { req: { url: string; header: (name: string) => string | undefined | null } })) {
    return "HttpOnly; SameSite=Lax; Path=/";
  }
  const frontendOrigin = frontendUrl(c as { req: { url: string; header: (name: string) => string | undefined } });
  const cookieDomain = cookieDomainForFrontend(frontendOrigin);
  return cookieDomain
    ? `HttpOnly; Secure; SameSite=None; Path=/; Domain=${cookieDomain}`
    : "HttpOnly; Secure; SameSite=None; Path=/";
}
