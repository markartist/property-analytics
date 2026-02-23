import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { nowISO, errJson } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";

const CreateBody = z.object({
  name: z.string().min(1),
  external_key: z.string().optional(),
  region: z.string().optional(),
  manager_name: z.string().optional(),
  unit_count: z.number().int().positive().optional(),
  ga4_property_id: z.string().optional(),
  full_url: z.string().url().optional(),
  encasa_short_name: z.string().optional(),
  encasa_property_code: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const PatchBody = z.object({
  name: z.string().min(1).optional(),
  external_key: z.string().optional(),
  region: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  manager_name: z.string().nullable().optional(),
  unit_count: z.number().int().positive().nullable().optional(),
  ga4_property_id: z.string().nullable().optional(),
  full_url: z.string().url().nullable().optional(),
  encasa_short_name: z.string().nullable().optional(),
  encasa_property_code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const communities = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
communities.use("*", requireAuth);

/** GET /v1/communities — list active, non-deleted communities */
communities.get("/", async (c) => {
  const rows = await queryAll(c.env.POP_BRIEF_DB,
    "SELECT id, name, external_key, region, status, manager_name, unit_count, ga4_property_id, full_url, encasa_short_name, encasa_property_code, city, state, created_at FROM communities WHERE deleted_at IS NULL AND status = 'active' ORDER BY name ASC"
  );
  return c.json({ items: rows });
});

/** POST /v1/communities — create community (admin only) */
communities.post("/", requireAdmin, async (c) => {
  const parse = CreateBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { name, external_key, region, manager_name, unit_count, ga4_property_id, full_url, encasa_short_name, encasa_property_code, city, state } = parse.data;

  // Check external_key uniqueness
  if (external_key) {
    const dup = await queryFirst(c.env.POP_BRIEF_DB,
      "SELECT id FROM communities WHERE external_key = ? AND deleted_at IS NULL", [external_key]
    );
    if (dup) return c.json(errJson("EXTERNAL_KEY_CONFLICT", "A community with this external_key already exists"), 409);
  }

  const id = newId();
  const now = nowISO();
  const actor = c.get("user");

  await run(c.env.POP_BRIEF_DB,
    `INSERT INTO communities (id, name, external_key, region, status, manager_name, unit_count, ga4_property_id, full_url, encasa_short_name, encasa_property_code, city, state, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, external_key ?? null, region ?? null, manager_name ?? null, unit_count ?? null, ga4_property_id ?? null, full_url ?? null, encasa_short_name ?? null, encasa_property_code ?? null, city ?? null, state ?? null, now, actor.id, now, actor.id]
  );

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "community.create", entityType: "community", entityId: id,
    after: { id, name, external_key: external_key ?? null, region: region ?? null },
  });

  return c.json({ id, name, external_key: external_key ?? null, region: region ?? null, manager_name: manager_name ?? null, unit_count: unit_count ?? null, status: "active" }, 201);
});

/** PATCH /v1/communities/:id — update community (admin only) */
communities.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const parse = PatchBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const body = parse.data;

  const existing = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id FROM communities WHERE id = ? AND deleted_at IS NULL", [id]
  );
  if (!existing) return c.json(errJson("COMMUNITY_NOT_FOUND", "Community not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.external_key !== undefined) { sets.push("external_key = ?"); params.push(body.external_key); }
  if (body.region !== undefined) { sets.push("region = ?"); params.push(body.region); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (body.manager_name !== undefined) { sets.push("manager_name = ?"); params.push(body.manager_name); }
  if (body.unit_count !== undefined) { sets.push("unit_count = ?"); params.push(body.unit_count); }
  if (body.ga4_property_id !== undefined) { sets.push("ga4_property_id = ?"); params.push(body.ga4_property_id); }
  if (body.full_url !== undefined) { sets.push("full_url = ?"); params.push(body.full_url); }
  if (body.encasa_short_name !== undefined) { sets.push("encasa_short_name = ?"); params.push(body.encasa_short_name); }
  if (body.encasa_property_code !== undefined) { sets.push("encasa_property_code = ?"); params.push(body.encasa_property_code); }
  if (body.city !== undefined) { sets.push("city = ?"); params.push(body.city); }
  if (body.state !== undefined) { sets.push("state = ?"); params.push(body.state); }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const now = nowISO();
  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(now, actor.id, id);

  const before = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id, name, external_key, region, status, manager_name, unit_count FROM communities WHERE id = ?", [id]
  );

  await run(c.env.POP_BRIEF_DB, `UPDATE communities SET ${sets.join(", ")} WHERE id = ?`, params);
  const updated = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id, name, external_key, region, status, manager_name, unit_count, ga4_property_id, full_url, encasa_short_name, encasa_property_code, city, state FROM communities WHERE id = ?", [id]
  );

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "community.update", entityType: "community", entityId: id,
    before, after: updated,
  });

  return c.json(updated);
});

/** DELETE /v1/communities/:id — soft-delete (admin only, per ADR-0003) */
communities.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const existing = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id FROM communities WHERE id = ? AND deleted_at IS NULL", [id]
  );
  if (!existing) return c.json(errJson("COMMUNITY_NOT_FOUND", "Community not found"), 404);

  const now = nowISO();
  const actor = c.get("user");

  const before = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id, name, external_key, region, status FROM communities WHERE id = ?", [id]
  );

  await run(c.env.POP_BRIEF_DB,
    "UPDATE communities SET deleted_at = ?, deleted_by = ?, status = 'inactive', updated_at = ?, updated_by = ? WHERE id = ?",
    [now, actor.id, now, actor.id, id]
  );

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id, action: "community.delete", entityType: "community", entityId: id,
    before, after: { status: "inactive", deleted_at: now },
  });

  return c.json({ ok: true, deleted_at: now });
});

export { communities };
