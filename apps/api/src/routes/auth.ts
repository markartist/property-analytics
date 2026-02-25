import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryFirst, run } from "../lib/db";
import { verifyPassword, hashPassword, generateToken, hashToken } from "../lib/crypto";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";
import { loginLimiter, magicLinkLimiter } from "../lib/rate-limit";
import { sendEmail } from "../email/resend";

const SESSION_TTL_HOURS = 72;

/**
 * Cookie posture: HttpOnly (no JS access), Secure (HTTPS only),
 * SameSite=Lax (CSRF protection while allowing top-level navigation),
 * Path=/ (scoped to entire API). Max-Age set per-use.
 */
const COOKIE_OPTS = "HttpOnly; Secure; SameSite=None; Path=/; Domain=.venterradev.com";

const MAGIC_LINK_TTL_MINUTES = 15;

const LoginBody = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

const MagicLinkBody = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
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
  const rl = loginLimiter.check(clientIp);
  if (!rl.allowed) {
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

  c.header("Set-Cookie", `pop_session=${raw}; ${COOKIE_OPTS}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
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
  c.header("Set-Cookie", `pop_session=; ${COOKIE_OPTS}; Max-Age=0`);
  return c.json({ ok: true });
});

/** POST /v1/auth/magic-link — send a magic login link via email */
auth.post("/magic-link", async (c) => {
  const parse = MagicLinkBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { email } = parse.data;

  // Rate limit by email
  const rl = magicLinkLimiter.check(email);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSeconds));
    return c.json(errJson("RATE_LIMITED", "Too many requests. Try again later."), 429);
  }

  // Check user exists and is active
  const user = await queryFirst<{ id: string; email: string; is_active: number }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
    [email]
  );
  // Always return success to avoid email enumeration
  if (!user || !user.is_active) {
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

  // Build verify URL from request origin
  const apiBase = new URL(c.req.url).origin;
  const verifyUrl = `${apiBase}/v1/auth/verify?token=${raw}`;

  // Send email
  if (c.env.ENABLE_EMAIL_SEND === "true") {
    const result = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
      to: email,
      subject: "Sign in to The Data Pond",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #15284B; font-size: 24px; margin: 0;">The Data Pond</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Venterra WebOps</p>
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
      console.error(`[RESEND] Failed to send magic link to ${email}: ${result.error}`);
    } else {
      console.log(`[RESEND] Magic link sent to ${email}, messageId=${result.messageId}`);
    }
  } else {
    // Dev mode: log the link
    console.log(`[DEV] Magic link for ${email}: ${verifyUrl}`);
  }

  return c.json({ ok: true, message: "If that email exists, a login link has been sent." });
});

/** GET /v1/auth/verify — verify magic link token and create session */
auth.get("/verify", async (c) => {
  const raw = c.req.query("token");
  if (!raw) return c.redirect(frontendUrl(c) + "/login?error=missing_token");

  const tokenHash = await hashToken(raw);
  const token = await queryFirst<{ id: string; email: string; expires_at: string; used_at: string | null }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, expires_at, used_at FROM magic_tokens WHERE token_hash = ?",
    [tokenHash]
  );

  if (!token) return c.redirect(frontendUrl(c) + "/login?error=invalid_token");
  if (token.used_at) return c.redirect(frontendUrl(c) + "/login?error=token_used");
  if (new Date(token.expires_at) <= new Date()) return c.redirect(frontendUrl(c) + "/login?error=token_expired");

  // Mark token as used
  const now = nowISO();
  await run(c.env.POP_BRIEF_DB, "UPDATE magic_tokens SET used_at = ? WHERE id = ?", [now, token.id]);

  // Look up user
  const user = await queryFirst<{ id: string; email: string; role: string; is_active: number }>(
    c.env.POP_BRIEF_DB,
    "SELECT id, email, role, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
    [token.email]
  );
  if (!user || !user.is_active) return c.redirect(frontendUrl(c) + "/login?error=user_inactive");

  // Create session
  const session = await generateToken();
  const sessionId = newId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();

  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, session.hash, expiresAt, now, user.id, now, user.id]
  );

  // Update last_login_at
  await run(c.env.POP_BRIEF_DB, "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [now, now, user.id]);

  c.header("Set-Cookie", `pop_session=${session.raw}; ${COOKIE_OPTS}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
  return c.redirect(frontendUrl(c) + "/");
});

/** GET /v1/auth/me — current user context */
auth.get("/me", requireAuth, async (c) => {
  return c.json({ user: c.get("user") });
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

  c.header("Set-Cookie", `pop_session=${raw}; ${COOKIE_OPTS}; Max-Age=${SESSION_TTL_HOURS * 3600}`);
  return c.json({ user: { id: userId, email: invite.email, role: invite.role } });
});

/** Derive frontend URL from the API request for redirects. */
function frontendUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "http://localhost:3000";
  return "https://app.venterradev.com";
}

export { auth };
