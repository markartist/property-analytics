/**
 * Marketing data routes.
 * One row per community per week with 7 sections.
 *
 * Endpoints:
 *   GET  /                     — list/filter by community_id, week_date
 *   PATCH /:id                 — section-aware upsert (creates if needed)
 *   POST /import/website-seo   — bulk Website & SEO import
 *   DELETE /:id                — delete a marketing_data record
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run, stmt, batch } from "../lib/db";
import { newId } from "../lib/id";
import { isFriday, nowISO, errJson, validateSafeText } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";

// ── All mutable columns ──

const ALL_DATA_COLS = [
  // Advertising
  "monthly_budget", "google_ppc", "google_remarketing", "apartments_com",
  "social", "zillow", "mailers", "kurie_video", "other", "advertising_notes",
  "advertising_saved_at",
  // Property Performance
  "occupancy", "atr", "most_common_floorplans", "property_performance_saved_at",
  // GC per Door
  "t7_community_gc_per_door", "t7_community_gc_per_avail_door",
  "t7_portfolio_gc_per_door", "t7_portfolio_gc_per_avail_door",
  "t30_community_gc_per_door", "t30_community_gc_per_avail_door",
  "t30_portfolio_gc_per_door", "t30_portfolio_gc_per_avail_door",
  "gc_per_door_saved_at",
  // Website & SEO
  "t7_engaged_sessions_delta", "t7_organic_sessions_delta",
  "t30_engaged_sessions_delta", "t30_organic_sessions_delta",
  "t7_organic_visibility", "t7_serp_traffic",
  "website_notes", "seo_notes", "website_seo_saved_at",
  // Marketing Projects
  "photography_needs", "signage_needs", "capex_projects", "marketing_saved_at",
  // Reputation & Social
  "google_review_count", "google_review_score", "social_posts_count",
  "google_review_concerns", "social_media_notes", "reputation_social_saved_at",
  // Pricing Strategy
  "recent_pricing_call", "pricing_strategy_notes", "current_specials",
  "pricing_strategy_saved_at",
  // Rich content
  "action_items", "ai_summary",
] as const;

// ── Zod schema for PATCH (all fields optional) ──

const PatchBody = z.object({
  // Routing fields (used for get-or-create)
  community_id: z.string().optional(),
  week_date: z.string().optional(),

  // Advertising
  monthly_budget: z.number().nullable().optional(),
  google_ppc: z.number().nullable().optional(),
  google_remarketing: z.number().nullable().optional(),
  apartments_com: z.number().nullable().optional(),
  social: z.number().nullable().optional(),
  zillow: z.number().nullable().optional(),
  mailers: z.number().nullable().optional(),
  kurie_video: z.number().nullable().optional(),
  other: z.number().nullable().optional(),
  advertising_notes: z.string().nullable().optional(),
  advertising_saved_at: z.string().nullable().optional(),

  // Property Performance
  occupancy: z.number().nullable().optional(),
  atr: z.number().nullable().optional(),
  most_common_floorplans: z.string().nullable().optional(),
  property_performance_saved_at: z.string().nullable().optional(),

  // GC per Door
  t7_community_gc_per_door: z.number().nullable().optional(),
  t7_community_gc_per_avail_door: z.number().nullable().optional(),
  t7_portfolio_gc_per_door: z.number().nullable().optional(),
  t7_portfolio_gc_per_avail_door: z.number().nullable().optional(),
  t30_community_gc_per_door: z.number().nullable().optional(),
  t30_community_gc_per_avail_door: z.number().nullable().optional(),
  t30_portfolio_gc_per_door: z.number().nullable().optional(),
  t30_portfolio_gc_per_avail_door: z.number().nullable().optional(),
  gc_per_door_saved_at: z.string().nullable().optional(),

  // Website & SEO
  t7_engaged_sessions_delta: z.number().nullable().optional(),
  t7_organic_sessions_delta: z.number().nullable().optional(),
  t30_engaged_sessions_delta: z.number().nullable().optional(),
  t30_organic_sessions_delta: z.number().nullable().optional(),
  t7_organic_visibility: z.number().nullable().optional(),
  t7_serp_traffic: z.number().nullable().optional(),
  website_notes: z.string().nullable().optional(),
  seo_notes: z.string().nullable().optional(),
  website_seo_saved_at: z.string().nullable().optional(),

  // Marketing Projects
  photography_needs: z.string().nullable().optional(),
  signage_needs: z.string().nullable().optional(),
  capex_projects: z.string().nullable().optional(),
  marketing_saved_at: z.string().nullable().optional(),

  // Reputation & Social
  google_review_count: z.number().int().nullable().optional(),
  google_review_score: z.number().nullable().optional(),
  social_posts_count: z.number().int().nullable().optional(),
  google_review_concerns: z.string().nullable().optional(),
  social_media_notes: z.string().nullable().optional(),
  reputation_social_saved_at: z.string().nullable().optional(),

  // Pricing Strategy
  recent_pricing_call: z.string().nullable().optional(),
  pricing_strategy_notes: z.string().nullable().optional(),
  current_specials: z.string().nullable().optional(),
  pricing_strategy_saved_at: z.string().nullable().optional(),

  // Rich content
  action_items: z.string().nullable().optional(),
  ai_summary: z.string().nullable().optional(),
});

// ── Website & SEO bulk import schema ──

const WebsiteSeoRow = z.object({
  property_name: z.string(),
  date: z.string(),
  t7_engaged_sessions_delta: z.number().nullable().optional(),
  t7_organic_sessions_delta: z.number().nullable().optional(),
  t30_engaged_sessions_delta: z.number().nullable().optional(),
  t30_organic_sessions_delta: z.number().nullable().optional(),
  t7_organic_visibility: z.number().nullable().optional(),
  t7_serp_traffic: z.number().nullable().optional(),
  website_notes: z.string().nullable().optional(),
  seo_notes: z.string().nullable().optional(),
});

const WebsiteSeoImportBody = z.object({
  rows: z.array(WebsiteSeoRow).min(1),
});

// ── Text fields that need HTML validation ──

const TEXT_FIELDS = [
  "advertising_notes", "most_common_floorplans", "website_notes", "seo_notes",
  "photography_needs", "signage_needs", "capex_projects",
  "google_review_concerns", "social_media_notes",
  "recent_pricing_call", "pricing_strategy_notes", "current_specials",
  "action_items", "ai_summary",
] as const;

// ── Route ──

const marketingData = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
marketingData.use("*", requireAuth);

/** GET / — list with optional filters */
marketingData.get("/", async (c) => {
  const { community_id, week_date } = c.req.query();

  if (week_date && !isFriday(week_date)) {
    return c.json(errJson("VALIDATION_ERROR", "week_date must be a Friday"), 400);
  }

  let sql = "SELECT * FROM marketing_data WHERE 1=1";
  const params: unknown[] = [];
  if (community_id) { sql += " AND community_id = ?"; params.push(community_id); }
  if (week_date) { sql += " AND week_date = ?"; params.push(week_date); }
  sql += " ORDER BY week_date DESC, community_id ASC";

  const rows = await queryAll(c.env.POP_BRIEF_DB, sql, params);
  return c.json({ items: rows });
});

/**
 * PATCH /:id — section-aware upsert.
 *
 * If :id is "new", looks up by community_id + week_date and creates if missing.
 * Only the fields present in the body are updated (partial merge).
 */
marketingData.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const parse = PatchBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const body = parse.data;
  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  const now = nowISO();

  // Validate text fields for dangerous HTML
  for (const field of TEXT_FIELDS) {
    const val = body[field];
    if (val != null) {
      const err = validateSafeText(val, field);
      if (err) return c.json(errJson("VALIDATION_ERROR", err), 400);
    }
  }

  // Find existing record
  let record: { id: string } | null = null;

  if (id !== "new") {
    record = await queryFirst<{ id: string }>(db, "SELECT id FROM marketing_data WHERE id = ?", [id]);
  }

  // Get-or-create via composite key
  if (!record && body.community_id && body.week_date) {
    if (!isFriday(body.week_date)) {
      return c.json(errJson("VALIDATION_ERROR", "week_date must be a Friday"), 400);
    }
    record = await queryFirst<{ id: string }>(db,
      "SELECT id FROM marketing_data WHERE community_id = ? AND week_date = ?",
      [body.community_id, body.week_date]
    );
    if (!record) {
      // Create empty row, then update below
      const newRecordId = newId();
      await run(db,
        `INSERT INTO marketing_data (id, community_id, week_date, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newRecordId, body.community_id, body.week_date, now, actor.id, now, actor.id]
      );
      record = { id: newRecordId };
    }
  }

  if (!record) return c.json(errJson("NOT_FOUND", "Marketing data record not found"), 404);

  // Build dynamic SET clause from provided fields
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const col of ALL_DATA_COLS) {
    const val = (body as Record<string, unknown>)[col];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }

  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  sets.push("updated_at = ?", "updated_by = ?");
  params.push(now, actor.id, record.id);

  await run(db, `UPDATE marketing_data SET ${sets.join(", ")} WHERE id = ?`, params);

  const updated = await queryFirst(db, "SELECT * FROM marketing_data WHERE id = ?", [record.id]);
  return c.json(updated);
});

/**
 * POST /import/website-seo — bulk Website & SEO import.
 * Resolves community by name, upserts marketing_data rows.
 */
marketingData.post("/import/website-seo", async (c) => {
  const parse = WebsiteSeoImportBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { rows } = parse.data;
  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  const now = nowISO();

  // Build community name → id lookup
  const communities = await queryAll<{ id: string; name: string }>(db,
    "SELECT id, name FROM communities"
  );
  const communityMap = new Map<string, string>();
  for (const c of communities) {
    communityMap.set(c.name.toLowerCase(), c.id);
  }

  const results = { successful: 0, failed: 0, errors: [] as { row: number; error: string }[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const communityId = communityMap.get(row.property_name.toLowerCase());
      if (!communityId) {
        results.errors.push({ row: i, error: `Community "${row.property_name}" not found` });
        results.failed++;
        continue;
      }

      // Normalize date
      const weekDate = row.date; // Expect YYYY-MM-DD; frontend does the format normalization
      if (!isFriday(weekDate)) {
        results.errors.push({ row: i, error: `Date ${weekDate} is not a Friday` });
        results.failed++;
        continue;
      }

      // Get-or-create marketing_data row
      let record = await queryFirst<{ id: string }>(db,
        "SELECT id FROM marketing_data WHERE community_id = ? AND week_date = ?",
        [communityId, weekDate]
      );
      if (!record) {
        const newRecordId = newId();
        await run(db,
          `INSERT INTO marketing_data (id, community_id, week_date, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newRecordId, communityId, weekDate, now, actor.id, now, actor.id]
        );
        record = { id: newRecordId };
      }

      // Update Website & SEO fields
      const sets: string[] = [];
      const params: unknown[] = [];

      const seoFields = [
        "t7_engaged_sessions_delta", "t7_organic_sessions_delta",
        "t30_engaged_sessions_delta", "t30_organic_sessions_delta",
        "t7_organic_visibility", "t7_serp_traffic",
      ] as const;

      for (const f of seoFields) {
        const val = row[f];
        if (val !== undefined && val !== null) {
          sets.push(`${f} = ?`);
          params.push(val);
        }
      }

      if (row.website_notes != null && row.website_notes.trim() !== "") {
        sets.push("website_notes = ?"); params.push(row.website_notes.trim());
      }
      if (row.seo_notes != null && row.seo_notes.trim() !== "") {
        sets.push("seo_notes = ?"); params.push(row.seo_notes.trim());
      }

      if (sets.length > 0) {
        sets.push("website_seo_saved_at = ?", "updated_at = ?", "updated_by = ?");
        params.push(now, now, actor.id, record.id);
        await run(db, `UPDATE marketing_data SET ${sets.join(", ")} WHERE id = ?`, params);
      }

      results.successful++;
    } catch (err) {
      results.errors.push({ row: i, error: err instanceof Error ? err.message : String(err) });
      results.failed++;
    }
  }

  return c.json(results);
});

/** DELETE /:id — delete a single record */
marketingData.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = c.env.POP_BRIEF_DB;

  const existing = await queryFirst(db, "SELECT * FROM marketing_data WHERE id = ?", [id]);
  if (!existing) return c.json(errJson("NOT_FOUND", "Record not found"), 404);

  await run(db, "DELETE FROM marketing_data WHERE id = ?", [id]);

  const actor = c.get("user");
  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "marketing_data.delete",
    entityType: "marketing_data",
    entityId: id,
    before: existing,
  });

  return c.json({ ok: true });
});

export { marketingData };
