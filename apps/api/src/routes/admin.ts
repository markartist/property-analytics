import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryFirst, queryAll, run } from "../lib/db";
import { generateToken, hashToken } from "../lib/crypto";
import { sendEmail } from "../email/resend";
import { adminFrontendUrl } from "../lib/frontend-origin";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";
import { requireOfferingAction } from "../lib/permissions";

const MAGIC_LINK_TTL_MINUTES = 15;

const CreateUserBody = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  full_name: z.string().min(1),
  role: z.enum(["admin", "editor", "viewer"]),
});

const PatchUserBody = z.object({
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().min(1).optional(),
});

const admin = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
admin.use("*", requireAuth);

/** POST /v1/admin/users — create user and send magic link */
admin.post("/users", requireOfferingAction("adminUsers", "administer"), async (c) => {
  const parse = CreateUserBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { email, full_name, role } = parse.data;

  // Check for existing user
  const existing = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", [email]
  );
  if (existing) return c.json(errJson("USER_EXISTS", "A user with this email already exists"), 409);

  const userId = newId();
  const now = nowISO();
  const actor = c.get("user");

  // Create user record (no password — magic link only)
  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO users (id, email, full_name, role, is_active, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [userId, email, full_name, role, now, actor.id, now, actor.id]
  );

  // Generate and send magic link
  const magicLinkUrl = await sendMagicLinkForUser(c, email);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "user.create", entityType: "user", entityId: userId,
    after: { email, full_name, role },
  });

  return c.json({ id: userId, email, full_name, role, is_active: true, magic_link_sent: !!magicLinkUrl }, 201);
});

/** GET /v1/admin/users — list users */
admin.get("/users", requireOfferingAction("adminUsers", "view"), async (c) => {
  const users = await queryAll(c.env.POP_BRIEF_DB,
    "SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC"
  );
  return c.json({ items: users });
});

/** PATCH /v1/admin/users/:id — update role, active state, or name */
admin.patch("/users/:id", requireOfferingAction("adminUsers", "administer"), async (c) => {
  const id = c.req.param("id");
  const parse = PatchUserBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const body = parse.data;

  const userBefore = await queryFirst<{ id: string; role: string; is_active: number; full_name: string | null }>(c.env.POP_BRIEF_DB,
    "SELECT id, role, is_active, full_name FROM users WHERE id = ? AND deleted_at IS NULL", [id]
  );
  if (!userBefore) return c.json(errJson("USER_NOT_FOUND", "User not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.role !== undefined) { sets.push("role = ?"); params.push(body.role); }
  if (body.is_active !== undefined) { sets.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }
  if (body.full_name !== undefined) { sets.push("full_name = ?"); params.push(body.full_name); }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const now = nowISO();
  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(now, actor.id, id);

  await run(c.env.POP_BRIEF_DB, `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);

  const updated = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id, email, full_name, role, is_active FROM users WHERE id = ?", [id]
  );

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "user.update", entityType: "user", entityId: id,
    before: userBefore, after: updated,
  });

  return c.json(updated);
});

/** POST /v1/admin/users/:id/send-magic-link — (re)send a login link */
admin.post("/users/:id/send-magic-link", requireOfferingAction("adminUsers", "administer"), async (c) => {
  const id = c.req.param("id");
  const user = await queryFirst<{ id: string; email: string; is_active: number }>(c.env.POP_BRIEF_DB,
    "SELECT id, email, is_active FROM users WHERE id = ? AND deleted_at IS NULL", [id]
  );
  if (!user) return c.json(errJson("USER_NOT_FOUND", "User not found"), 404);
  if (!user.is_active) return c.json(errJson("USER_INACTIVE", "Cannot send link to inactive user"), 400);

  await sendMagicLinkForUser(c, user.email);

  const actor = c.get("user");
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "magic_link.send", entityType: "user", entityId: id,
    after: { email: user.email },
  });

  return c.json({ ok: true, email: user.email });
});

/** DELETE /v1/admin/users/:id/sessions — revoke all sessions for a user */
admin.delete("/users/:id/sessions", requireOfferingAction("adminUsers", "administer"), async (c) => {
  const id = c.req.param("id");
  const user = await queryFirst<{ id: string }>(c.env.POP_BRIEF_DB,
    "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [id]
  );
  if (!user) return c.json(errJson("USER_NOT_FOUND", "User not found"), 404);

  const now = nowISO();
  await run(c.env.POP_BRIEF_DB,
    "UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?",
    [now, now, id, now]
  );

  const actor = c.get("user");
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "sessions.revoke_all", entityType: "user", entityId: id,
  });

  return c.json({ ok: true });
});

/** GET /v1/admin/audit-log — paginated audit log */
admin.get("/audit-log", requireOfferingAction("adminUsers", "view"), async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  const action = c.req.query("action"); // optional filter

  let sql = `SELECT a.id, a.action, a.entity_type, a.entity_id, a.before_json, a.after_json, a.created_at,
    u.email as actor_email, u.full_name as actor_name
    FROM audit_log a LEFT JOIN users u ON a.actor_user_id = u.id`;
  const params: unknown[] = [];

  if (action) {
    sql += " WHERE a.action = ?";
    params.push(action);
  }

  sql += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await queryAll(c.env.POP_BRIEF_DB, sql, params);
  return c.json({ items: rows });
});

// --- Helper: generate magic token and send email ---

async function sendMagicLinkForUser(
  c: { env: Env; req: { url: string; header: (name: string) => string | undefined } },
  email: string
): Promise<string | null> {
  const { raw, hash } = await generateToken();
  const tokenId = newId();
  const now = nowISO();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000).toISOString();

  await run(c.env.POP_BRIEF_DB,
    "INSERT INTO magic_tokens (id, email, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [tokenId, email, hash, expiresAt, now]
  );

  const verifyUrl = `${adminFrontendUrl(c)}/login/verify?token=${raw}`;

  if (c.env.ENABLE_EMAIL_SEND === "true") {
    const result = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
      to: email,
      subject: "Sign in to The Data Pond",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #15284B; font-size: 24px; margin: 0;">The Data Pond</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">MarketingOps</p>
          </div>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Click the button below to sign in. This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background-color: #15284B; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Sign In</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    if (!result.ok) {
      console.error(`[RESEND] Failed to send magic link to ${email}: ${result.error}`);
    } else {
      console.log(`[RESEND] Magic link sent to ${email}, messageId=${result.messageId}`);
    }
    return verifyUrl;
  } else {
    console.log(`[DEV] Magic link for ${email}: ${verifyUrl}`);
    return verifyUrl;
  }
}

export { admin };
