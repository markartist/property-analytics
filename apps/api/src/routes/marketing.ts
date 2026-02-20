import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { sendEmail } from "../email/resend";
import { newId } from "../lib/id";
import { isFriday, nowISO, errJson, EMAIL_REGEX } from "../lib/validate";

const PatchBody = z.object({
  community_id: z.string().optional(),
  week_ending: z.string().optional(),
  leads_count: z.number().int().min(0).optional(),
  cost_per_lead: z.number().min(0).optional(),
  ad_spend: z.number().min(0).optional(),
  mentions_json: z.string().optional(),
  notes_text: z.string().optional(),
});

const ScanBody = z.object({
  week_ending: z.string(),
});

const marketing = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
marketing.use("*", requireAuth);

/** GET /v1/marketing — list with optional filters */
marketing.get("/", async (c) => {
  const { week_ending, community_id } = c.req.query();
  if (week_ending && !isFriday(week_ending)) {
    return c.json(errJson("VALIDATION_ERROR", "week_ending must be a Friday (ADR-0002)"), 400);
  }

  let sql = "SELECT * FROM marketing_weekly WHERE 1=1";
  const params: unknown[] = [];
  if (week_ending) { sql += " AND week_ending = ?"; params.push(week_ending); }
  if (community_id) { sql += " AND community_id = ?"; params.push(community_id); }
  sql += " ORDER BY week_ending DESC, community_id ASC";

  const rows = await queryAll(c.env.POP_BRIEF_DB, sql, params);
  return c.json({ items: rows });
});

/**
 * PATCH /v1/marketing/:id — update or upsert.
 * If :id record not found but body has community_id + week_ending, performs get-or-create.
 */
marketing.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const parse = PatchBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const body = parse.data;
  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  const now = nowISO();

  // Try find by ID
  let record = await queryFirst<{ id: string }>(db, "SELECT id FROM marketing_weekly WHERE id = ?", [id]);

  // Upsert: if not found by ID, try composite key get-or-create
  if (!record && body.community_id && body.week_ending) {
    if (!isFriday(body.week_ending)) {
      return c.json(errJson("VALIDATION_ERROR", "week_ending must be a Friday (ADR-0002)"), 400);
    }
    record = await queryFirst<{ id: string }>(db,
      "SELECT id FROM marketing_weekly WHERE community_id = ? AND week_ending = ?",
      [body.community_id, body.week_ending]
    );
    if (!record) {
      // Create new record
      const newRecordId = newId();
      await run(db,
        `INSERT INTO marketing_weekly (id, week_ending, community_id, leads_count, cost_per_lead, ad_spend, mentions_json, notes_text, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newRecordId, body.week_ending, body.community_id,
         body.leads_count ?? null, body.cost_per_lead ?? null, body.ad_spend ?? null,
         body.mentions_json ?? null, body.notes_text ?? null,
         now, actor.id, now, actor.id]
      );
      const created = await queryFirst(db, "SELECT * FROM marketing_weekly WHERE id = ?", [newRecordId]);
      return c.json(created, 201);
    }
  }

  if (!record) return c.json(errJson("NOT_FOUND", "Marketing record not found"), 404);

  // Update existing record
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.leads_count !== undefined) { sets.push("leads_count = ?"); params.push(body.leads_count); }
  if (body.cost_per_lead !== undefined) { sets.push("cost_per_lead = ?"); params.push(body.cost_per_lead); }
  if (body.ad_spend !== undefined) { sets.push("ad_spend = ?"); params.push(body.ad_spend); }
  if (body.mentions_json !== undefined) { sets.push("mentions_json = ?"); params.push(body.mentions_json); }
  if (body.notes_text !== undefined) { sets.push("notes_text = ?"); params.push(body.notes_text); }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  sets.push("updated_at = ?", "updated_by = ?");
  params.push(now, actor.id, record.id);
  await run(db, `UPDATE marketing_weekly SET ${sets.join(", ")} WHERE id = ?`, params);

  const updated = await queryFirst(db, "SELECT * FROM marketing_weekly WHERE id = ?", [record.id]);
  return c.json(updated);
});

/**
 * POST /v1/marketing/scan-mentions
 * Extract emails from notes, create dedupe notification_events.
 * Email sending gated by ENABLE_EMAIL_SEND env var.
 */
marketing.post("/scan-mentions", async (c) => {
  const parse = ScanBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);
  const { week_ending } = parse.data;

  if (!isFriday(week_ending)) {
    return c.json(errJson("VALIDATION_ERROR", "week_ending must be a Friday (ADR-0002)"), 400);
  }

  const db = c.env.POP_BRIEF_DB;
  const actor = c.get("user");
  const now = nowISO();
  const emailSendEnabled = c.env.ENABLE_EMAIL_SEND === "true";

  // Get all marketing records for this week
  const records = await queryAll<{ id: string; community_id: string; notes_text: string | null; mentions_json: string | null }>(db,
    "SELECT id, community_id, notes_text, mentions_json FROM marketing_weekly WHERE week_ending = ?",
    [week_ending]
  );

  let processed = 0;
  let sent = 0;
  let suppressed = 0;

  for (const rec of records) {
    // Extract emails from notes_text and mentions_json
    const textToScan = [rec.notes_text ?? "", rec.mentions_json ?? ""].join(" ");
    const emails = [...new Set(textToScan.match(EMAIL_REGEX) ?? [])];

    for (const email of emails) {
      processed++;
      // Deterministic dedupe_key per 01_System_Contract.md
      const dedupeKey = `mention_alert:${email}:${week_ending}:${rec.community_id}`;

      // Check dedupe
      const existing = await queryFirst(db,
        "SELECT id FROM notification_events WHERE dedupe_key = ?", [dedupeKey]
      );
      if (existing) { suppressed++; continue; }

      // Create notification event
      const eventId = newId();
      let status = "sent";
      let providerMessageId: string | null = null;
      let errorText: string | null = null;

      if (emailSendEnabled) {
        const result = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
          to: email,
          subject: `POP Brief: Mention alert for week ending ${week_ending}`,
          html: `<p>You were mentioned in a POP Brief marketing note for community ${rec.community_id}, week ending ${week_ending}.</p>`,
        });
        if (result.ok) {
          providerMessageId = result.messageId ?? null;
        } else {
          status = "failed";
          errorText = result.error ?? null;
        }
      }

      await run(db,
        `INSERT INTO notification_events (id, event_type, recipient_email, dedupe_key, status, provider_message_id, attempted_at, error_text, created_at, created_by, updated_at, updated_by)
         VALUES (?, 'mention_alert', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventId, email, dedupeKey, status, providerMessageId, now, errorText, now, actor.id, now, actor.id]
      );
      if (status === "sent") sent++;
    }
  }

  return c.json({ processed, sent, suppressed_duplicate: suppressed });
});

export { marketing };
