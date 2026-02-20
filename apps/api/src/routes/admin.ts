import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryFirst, queryAll, run } from "../lib/db";
import { generateToken } from "../lib/crypto";
import { sendEmail } from "../email/resend";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";

const CreateInviteBody = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  role: z.enum(["admin", "user"]),
  expires_in_days: z.number().int().min(1).max(90).default(7),
});

const PatchUserBody = z.object({
  role: z.enum(["admin", "user"]).optional(),
  is_active: z.boolean().optional(),
});

const admin = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
admin.use("*", requireAuth, requireAdmin);

/** POST /v1/admin/invites — create invite */
admin.post("/invites", async (c) => {
  const parse = CreateInviteBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { email, role, expires_in_days } = parse.data;

  // Check for existing active invite
  const existing = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id FROM invites WHERE email = ? AND redeemed_at IS NULL AND expires_at > ?",
    [email, nowISO()]
  );
  if (existing) return c.json(errJson("INVITE_EXISTS", "Active invite already exists for this email"), 409);

  const { raw, hash } = await generateToken();
  const inviteId = newId();
  const now = nowISO();
  const actor = c.get("user");
  const expiresAt = new Date(Date.now() + expires_in_days * 86_400_000).toISOString();

  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO invites (id, email, role, token_hash, expires_at, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inviteId, email, role, hash, expiresAt, now, actor.id, now, actor.id]
  );

  // Send invite email if enabled
  if (c.env.ENABLE_EMAIL_SEND === "true") {
    await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
      to: email,
      subject: "You're invited to POP Brief",
      html: `<p>You've been invited to POP Brief. Use this token to create your account:</p><p><strong>${raw}</strong></p>`,
    });
  }

  return c.json({ invite_id: inviteId, email, expires_at: expiresAt });
});

/** GET /v1/admin/users — list users */
admin.get("/users", async (c) => {
  const users = await queryAll(c.env.POP_BRIEF_DB,
    "SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC"
  );
  return c.json({ items: users });
});

/** PATCH /v1/admin/users/:id — update role or active state */
admin.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const parse = PatchUserBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const body = parse.data;

  const user = await queryFirst(c.env.POP_BRIEF_DB, "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [id]);
  if (!user) return c.json(errJson("USER_NOT_FOUND", "User not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.role !== undefined) { sets.push("role = ?"); params.push(body.role); }
  if (body.is_active !== undefined) { sets.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const now = nowISO();
  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(now, actor.id, id);

  await run(c.env.POP_BRIEF_DB, `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);

  const updated = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id, email, role, is_active FROM users WHERE id = ?", [id]
  );
  return c.json(updated);
});

export { admin };
