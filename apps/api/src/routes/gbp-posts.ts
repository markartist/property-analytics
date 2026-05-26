import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { writeAuditLog } from "../lib/audit";
import { newId } from "../lib/id";
import { requireOfferingAction } from "../lib/permissions";
import { errJson, nowISO, validateSafeText } from "../lib/validate";

const gbpPosts = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
gbpPosts.use("*", requireAuth);

const PolicyBody = z.object({
  approval_required: z.boolean().optional(),
  allow_offer_posts: z.boolean().optional(),
  allow_event_posts: z.boolean().optional(),
  allow_amenity_posts: z.boolean().optional(),
  cooldown_days: z.number().int().min(1).max(60).optional(),
  max_drafts_per_run: z.number().int().min(1).max(3).optional(),
  blocked_terms: z.array(z.string().min(1)).max(50).optional(),
  required_utm_source: z.string().min(1).max(100).optional(),
});

const ContextInputBody = z.object({
  availability_summary: z.string().max(400).optional(),
  concession_summary: z.string().max(400).optional(),
  concession_expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amenity_highlights: z.array(z.string().min(1).max(80)).max(8).optional(),
  feature_highlights: z.array(z.string().min(1).max(80)).max(8).optional(),
  cta_url: z.string().url().optional(),
  source_label: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  draft_count: z.number().int().min(1).max(3).optional(),
  use_captain_context: z.boolean().optional(),
});

const ReviewBody = z.object({
  notes: z.string().max(500).optional(),
});

const ManualPublicationBody = z.object({
  publish_status: z.enum(["published", "failed"]).default("published"),
  google_post_name: z.string().max(300).optional(),
  proof_url: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  published_at: z.string().max(40).optional(),
});

type PolicyRecord = {
  id: string;
  community_id: string;
  approval_required: number;
  allow_offer_posts: number;
  allow_event_posts: number;
  allow_amenity_posts: number;
  cooldown_days: number;
  max_drafts_per_run: number;
  policy_json: string | null;
};

type ContextInput = z.infer<typeof ContextInputBody>;

type GbpPostSuggestion = {
  id: string;
  community_id: string;
  community_name: string;
  property_id: string | null;
  angle: string;
  priority: number;
  reason: string;
  source_evidence: string[];
  recommended_channel: "GBP";
  draft_seed: {
    source_label: string;
    notes: string;
    use_captain_context: boolean;
    draft_count: number;
  };
};

type PropertyContext = {
  community: Record<string, unknown>;
  pib: {
    snapshot_date: string | null;
    total_sessions: number | null;
    sessions_trend_pct: number | null;
    total_profile_views: number | null;
    gbp_views_trend_pct: number | null;
    gbp_action_rate: number | null;
    gsc_clicks: number | null;
    cir_value: number | null;
    avg_rating: number | null;
    recent_reviews: number | null;
  };
  marketing: {
    week_date: string | null;
    occupancy: number | null;
    atr: number | null;
  };
  captain: {
    property_id: string | null;
    latest_brief_created_at: string | null;
    active_watch_count: number;
    active_action_count: number;
    top_watch_items: Array<{
      key: string;
      title: string;
      category: string | null;
      severity: number | null;
      state: string | null;
      next_move: string | null;
    }>;
    top_actions: Array<{
      key: string;
      title: string;
      owner_role: string | null;
      priority: number | null;
      due_date: string | null;
      expected_outcome: string | null;
    }>;
    recommended_angles: string[];
    primary_directive: string | null;
    source_note: string;
  };
  live_inputs: {
    availability_summary: string | null;
    concession_summary: string | null;
    concession_expires_on: string | null;
    amenity_highlights: string[];
    feature_highlights: string[];
    cta_url: string | null;
    notes: string | null;
    source_label: string | null;
  };
  policy: {
    approval_required: boolean;
    allow_offer_posts: boolean;
    allow_event_posts: boolean;
    allow_amenity_posts: boolean;
    cooldown_days: number;
    max_drafts_per_run: number;
    blocked_terms: string[];
    required_utm_source: string | null;
  };
  freshness: {
    pib_snapshot_date: string | null;
    marketing_week_date: string | null;
    has_live_inputs: boolean;
  };
};

gbpPosts.get("/suggestions", requireOfferingAction("gbpPosts", "view"), async (c) => {
  const communityId = c.req.query("community_id");
  const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? "12"), 24));
  const where = communityId ? "WHERE id = ? AND deleted_at IS NULL" : "WHERE deleted_at IS NULL";
  const params = communityId ? [communityId] : [];
  const communities = await queryAll<Record<string, unknown>>(c.env.POP_BRIEF_DB, `
    SELECT id, name, external_key, ga4_property_id, encasa_property_code, full_url, city, state, region, unit_count
    FROM communities
    ${where}
    ORDER BY name ASC
    LIMIT 60
  `, params);

  const suggestions: GbpPostSuggestion[] = [];
  for (const community of communities) {
    const context = await buildPropertyContext(c.env.POP_BRIEF_DB, String(community.id), {
      use_captain_context: true,
      draft_count: 3,
    });
    suggestions.push(...buildSuggestionsFromContext(context));
  }

  return c.json({
    items: suggestions
      .sort((a, b) => b.priority - a.priority || a.community_name.localeCompare(b.community_name))
      .slice(0, limit),
  });
});

gbpPosts.get("/queue", async (c) => {
  const status = c.req.query("status");
  const communityId = c.req.query("community_id");
  const where: string[] = [];
  const params: unknown[] = [];

  if (status) {
    where.push("d.status = ?");
    params.push(status);
  }
  if (communityId) {
    where.push("d.community_id = ?");
    params.push(communityId);
  }

  const rows = await queryAll(c.env.POP_BRIEF_DB, `
    SELECT
      d.id,
      d.community_id,
      c.name AS community_name,
      d.status,
      d.post_type,
      d.angle,
      d.candidate_rank,
      d.rendered_text,
      d.validation_json,
      d.approved_at,
      d.rejected_at,
      d.created_at,
      s.created_at AS snapshot_created_at
    FROM gbp_post_drafts d
    JOIN communities c ON c.id = d.community_id
    JOIN gbp_post_source_snapshots s ON s.id = d.source_snapshot_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY
      CASE d.status
        WHEN 'draft' THEN 0
        WHEN 'approved' THEN 1
        WHEN 'rejected' THEN 2
        WHEN 'published' THEN 3
        ELSE 4
      END,
      d.created_at DESC
  `, params);

  return c.json({
    items: rows.map((row: any) => ({
      ...row,
      validation: parseJson(row.validation_json, {}),
    })),
  });
});

gbpPosts.get("/drafts/:id", async (c) => {
  const id = c.req.param("id");
  const draft = await queryFirst<any>(c.env.POP_BRIEF_DB, `
    SELECT
      d.*,
      c.name AS community_name,
      c.full_url,
      s.source_payload_json,
      s.freshness_json
    FROM gbp_post_drafts d
    JOIN communities c ON c.id = d.community_id
    JOIN gbp_post_source_snapshots s ON s.id = d.source_snapshot_id
    WHERE d.id = ?
  `, [id]);

  if (!draft) {
    return c.json(errJson("NOT_FOUND", "Draft not found"), 404);
  }

  const reviews = await queryAll(c.env.POP_BRIEF_DB, `
    SELECT id, decision, notes, created_at, created_by
    FROM gbp_post_reviews
    WHERE draft_id = ?
    ORDER BY created_at DESC
  `, [id]);
  const publications = await queryAll(c.env.POP_BRIEF_DB, `
    SELECT
      id,
      publish_status,
      google_post_name,
      request_json,
      response_json,
      error_message,
      published_at,
      created_at,
      created_by,
      updated_at,
      updated_by
    FROM gbp_post_publications
    WHERE draft_id = ?
    ORDER BY created_at DESC
  `, [id]);

  return c.json({
    draft: {
      ...draft,
      payload: parseJson(draft.payload_json, {}),
      validation: parseJson(draft.validation_json, {}),
    },
    source_snapshot: {
      payload: parseJson(draft.source_payload_json, {}),
      freshness: parseJson(draft.freshness_json, {}),
    },
    reviews,
    publications: publications.map((publication: any) => ({
      ...publication,
      request: parseJson(publication.request_json, {}),
      response: parseJson(publication.response_json, {}),
    })),
  });
});

gbpPosts.get("/policies/:communityId", async (c) => {
  const communityId = c.req.param("communityId");
  const policy = await getPolicy(c.env.POP_BRIEF_DB, communityId);
  return c.json({ policy });
});

gbpPosts.put("/policies/:communityId", requireOfferingAction("gbpPosts", "administer"), async (c) => {
  const communityId = c.req.param("communityId");
  const parse = PolicyBody.safeParse(await c.req.json());
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid policy"), 400);
  }

  const community = await queryFirst(c.env.POP_BRIEF_DB,
    "SELECT id, name FROM communities WHERE id = ? AND deleted_at IS NULL",
    [communityId]
  );
  if (!community) {
    return c.json(errJson("NOT_FOUND", "Community not found"), 404);
  }

  const actor = c.get("user");
  const now = nowISO();
  const existing = await queryFirst<PolicyRecord>(
    c.env.POP_BRIEF_DB,
    "SELECT * FROM gbp_post_policies WHERE community_id = ?",
    [communityId]
  );
  const defaults = defaultPolicyRecord(communityId);
  const merged = {
    ...defaults,
    ...(existing ? mapPolicyRecord(existing) : {}),
    ...parse.data,
  };
  const policyJson = JSON.stringify({
    blocked_terms: parse.data.blocked_terms ?? (existing ? mapPolicyRecord(existing).blocked_terms : []),
    required_utm_source: parse.data.required_utm_source ?? (existing ? mapPolicyRecord(existing).required_utm_source : "google_business_profile"),
  });

  if (existing) {
    await run(c.env.POP_BRIEF_DB, `
      UPDATE gbp_post_policies
      SET approval_required = ?,
          allow_offer_posts = ?,
          allow_event_posts = ?,
          allow_amenity_posts = ?,
          cooldown_days = ?,
          max_drafts_per_run = ?,
          policy_json = ?,
          updated_at = ?,
          updated_by = ?
      WHERE community_id = ?
    `, [
      merged.approval_required ? 1 : 0,
      merged.allow_offer_posts ? 1 : 0,
      merged.allow_event_posts ? 1 : 0,
      merged.allow_amenity_posts ? 1 : 0,
      merged.cooldown_days,
      merged.max_drafts_per_run,
      policyJson,
      now,
      actor.id,
      communityId,
    ]);
  } else {
    await run(c.env.POP_BRIEF_DB, `
      INSERT INTO gbp_post_policies (
        id, community_id, approval_required, allow_offer_posts, allow_event_posts,
        allow_amenity_posts, cooldown_days, max_drafts_per_run, policy_json,
        created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newId(),
      communityId,
      merged.approval_required ? 1 : 0,
      merged.allow_offer_posts ? 1 : 0,
      merged.allow_event_posts ? 1 : 0,
      merged.allow_amenity_posts ? 1 : 0,
      merged.cooldown_days,
      merged.max_drafts_per_run,
      policyJson,
      now,
      actor.id,
      now,
      actor.id,
    ]);
  }

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "gbp_policy.upsert",
    entityType: "gbp_post_policy",
    entityId: communityId,
    after: merged,
  });

  return c.json({ policy: await getPolicy(c.env.POP_BRIEF_DB, communityId) });
});

gbpPosts.post("/context/:communityId", requireOfferingAction("gbpPosts", "draft"), async (c) => {
  const communityId = c.req.param("communityId");
  const parse = ContextInputBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid context"), 400);
  }

  const actor = c.get("user");
  const context = await buildPropertyContext(c.env.POP_BRIEF_DB, communityId, parse.data);
  const snapshot = await persistSnapshot(c.env.POP_BRIEF_DB, communityId, actor.id, context);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "gbp_context.build",
    entityType: "gbp_post_source_snapshot",
    entityId: snapshot.id,
    after: { community_id: communityId, freshness: context.freshness },
  });

  return c.json({ snapshot, context });
});

gbpPosts.post("/drafts/:communityId", requireOfferingAction("gbpPosts", "draft"), async (c) => {
  const communityId = c.req.param("communityId");
  const parse = ContextInputBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid draft input"), 400);
  }

  const actor = c.get("user");
  const context = await buildPropertyContext(c.env.POP_BRIEF_DB, communityId, parse.data);
  const snapshot = await persistSnapshot(c.env.POP_BRIEF_DB, communityId, actor.id, context);
  const candidates = buildDraftCandidates(context, parse.data.draft_count ?? context.policy.max_drafts_per_run);
  const now = nowISO();
  const created: any[] = [];

  for (const candidate of candidates) {
    const id = newId();
    await run(c.env.POP_BRIEF_DB, `
      INSERT INTO gbp_post_drafts (
        id, community_id, source_snapshot_id, status, post_type, angle, candidate_rank,
        title, rendered_text, payload_json, validation_json, model_name, generation_notes,
        created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      communityId,
      snapshot.id,
      candidate.post_type,
      candidate.angle,
      candidate.rank,
      candidate.title,
      candidate.rendered_text,
      JSON.stringify(candidate.payload),
      JSON.stringify(candidate.validation),
      "deterministic-v1",
      candidate.generation_notes,
      now,
      actor.id,
      now,
      actor.id,
    ]);
    created.push({ id, ...candidate });
  }

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "gbp_draft.generate",
    entityType: "gbp_post_source_snapshot",
    entityId: snapshot.id,
    after: { community_id: communityId, draft_count: created.length },
  });

  return c.json({ snapshot, drafts: created }, 201);
});

gbpPosts.post("/drafts/:id/approve", requireOfferingAction("gbpPosts", "approve"), async (c) => {
  const id = c.req.param("id");
  const parse = ReviewBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid review"), 400);
  }
  const noteError = validateSafeText(parse.data.notes, "notes");
  if (noteError) return c.json(errJson("VALIDATION_ERROR", noteError), 400);

  const draft = await queryFirst<any>(c.env.POP_BRIEF_DB,
    "SELECT id, community_id, status FROM gbp_post_drafts WHERE id = ?",
    [id]
  );
  if (!draft) return c.json(errJson("NOT_FOUND", "Draft not found"), 404);

  const actor = c.get("user");
  const now = nowISO();
  await run(c.env.POP_BRIEF_DB, `
    UPDATE gbp_post_drafts
    SET status = 'approved', approved_at = ?, approved_by = ?, rejected_at = NULL,
        rejected_by = NULL, updated_at = ?, updated_by = ?
    WHERE id = ?
  `, [now, actor.id, now, actor.id, id]);

  await run(c.env.POP_BRIEF_DB, `
    INSERT INTO gbp_post_reviews (id, draft_id, community_id, decision, notes, created_at, created_by)
    VALUES (?, ?, ?, 'approve', ?, ?, ?)
  `, [newId(), id, draft.community_id, parse.data.notes ?? null, now, actor.id]);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "gbp_draft.approve",
    entityType: "gbp_post_draft",
    entityId: id,
    after: { status: "approved", notes: parse.data.notes ?? null },
  });

  return c.json({ ok: true, status: "approved", approved_at: now });
});

gbpPosts.post("/drafts/:id/reject", requireOfferingAction("gbpPosts", "approve"), async (c) => {
  const id = c.req.param("id");
  const parse = ReviewBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid review"), 400);
  }
  const noteError = validateSafeText(parse.data.notes, "notes");
  if (noteError) return c.json(errJson("VALIDATION_ERROR", noteError), 400);

  const draft = await queryFirst<any>(c.env.POP_BRIEF_DB,
    "SELECT id, community_id FROM gbp_post_drafts WHERE id = ?",
    [id]
  );
  if (!draft) return c.json(errJson("NOT_FOUND", "Draft not found"), 404);

  const actor = c.get("user");
  const now = nowISO();
  await run(c.env.POP_BRIEF_DB, `
    UPDATE gbp_post_drafts
    SET status = 'rejected', rejected_at = ?, rejected_by = ?, updated_at = ?, updated_by = ?
    WHERE id = ?
  `, [now, actor.id, now, actor.id, id]);

  await run(c.env.POP_BRIEF_DB, `
    INSERT INTO gbp_post_reviews (id, draft_id, community_id, decision, notes, created_at, created_by)
    VALUES (?, ?, ?, 'reject', ?, ?, ?)
  `, [newId(), id, draft.community_id, parse.data.notes ?? null, now, actor.id]);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "gbp_draft.reject",
    entityType: "gbp_post_draft",
    entityId: id,
    after: { status: "rejected", notes: parse.data.notes ?? null },
  });

  return c.json({ ok: true, status: "rejected", rejected_at: now });
});

gbpPosts.post("/drafts/:id/publications/manual", requireOfferingAction("gbpPosts", "approve"), async (c) => {
  const id = c.req.param("id");
  const parse = ManualPublicationBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) {
    return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid publication proof"), 400);
  }
  const noteError = validateSafeText(parse.data.notes, "notes");
  if (noteError) return c.json(errJson("VALIDATION_ERROR", noteError), 400);

  const draft = await queryFirst<any>(c.env.POP_BRIEF_DB,
    "SELECT id, community_id, status, payload_json FROM gbp_post_drafts WHERE id = ?",
    [id]
  );
  if (!draft) return c.json(errJson("NOT_FOUND", "Draft not found"), 404);
  if (!["approved", "published", "failed"].includes(String(draft.status))) {
    return c.json(errJson("VALIDATION_ERROR", "Only approved drafts can receive posting proof"), 400);
  }

  const actor = c.get("user");
  const now = nowISO();
  const publishedAt = parse.data.publish_status === "published" ? (parse.data.published_at ?? now) : null;
  const publicationId = newId();
  const requestJson = JSON.stringify({
    mode: "manual_handoff",
    draft_payload: parseJson(draft.payload_json, {}),
    proof_url: parse.data.proof_url ?? null,
    notes: parse.data.notes ?? null,
  });
  const responseJson = JSON.stringify({
    google_post_name: parse.data.google_post_name ?? null,
    proof_url: parse.data.proof_url ?? null,
    recorded_by: actor.id,
    recorded_at: now,
  });

  await run(c.env.POP_BRIEF_DB, `
    INSERT INTO gbp_post_publications (
      id, draft_id, community_id, publish_status, google_post_name, request_json,
      response_json, error_message, published_at, created_at, created_by, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    publicationId,
    id,
    draft.community_id,
    parse.data.publish_status,
    parse.data.google_post_name ?? parse.data.proof_url ?? null,
    requestJson,
    responseJson,
    parse.data.publish_status === "failed" ? (parse.data.notes ?? "Manual posting proof recorded as failed.") : null,
    publishedAt,
    now,
    actor.id,
    now,
    actor.id,
  ]);

  await run(c.env.POP_BRIEF_DB, `
    UPDATE gbp_post_drafts
    SET status = ?, published_at = ?, updated_at = ?, updated_by = ?
    WHERE id = ?
  `, [
    parse.data.publish_status === "published" ? "published" : "failed",
    publishedAt,
    now,
    actor.id,
    id,
  ]);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "gbp_publication.manual_proof",
    entityType: "gbp_post_publication",
    entityId: publicationId,
    after: {
      draft_id: id,
      community_id: draft.community_id,
      publish_status: parse.data.publish_status,
      google_post_name: parse.data.google_post_name ?? null,
      proof_url: parse.data.proof_url ?? null,
    },
  });

  return c.json({
    ok: true,
    publication: {
      id: publicationId,
      draft_id: id,
      community_id: draft.community_id,
      publish_status: parse.data.publish_status,
      google_post_name: parse.data.google_post_name ?? parse.data.proof_url ?? null,
      published_at: publishedAt,
      created_at: now,
    },
  }, 201);
});

async function getPolicy(db: D1Database, communityId: string) {
  const record = await queryFirst<PolicyRecord>(
    db,
    "SELECT * FROM gbp_post_policies WHERE community_id = ?",
    [communityId]
  );
  return record ? mapPolicyRecord(record) : defaultPolicyRecord(communityId);
}

function defaultPolicyRecord(communityId: string) {
  return {
    community_id: communityId,
    approval_required: true,
    allow_offer_posts: false,
    allow_event_posts: false,
    allow_amenity_posts: true,
    cooldown_days: 7,
    max_drafts_per_run: 3,
    blocked_terms: [] as string[],
    required_utm_source: "google_business_profile",
  };
}

function mapPolicyRecord(record: PolicyRecord) {
  const policy = parseJson<{ blocked_terms?: string[]; required_utm_source?: string }>(record.policy_json, {});
  return {
    community_id: record.community_id,
    approval_required: record.approval_required === 1,
    allow_offer_posts: record.allow_offer_posts === 1,
    allow_event_posts: record.allow_event_posts === 1,
    allow_amenity_posts: record.allow_amenity_posts === 1,
    cooldown_days: record.cooldown_days,
    max_drafts_per_run: record.max_drafts_per_run,
    blocked_terms: Array.isArray(policy.blocked_terms) ? policy.blocked_terms : [],
    required_utm_source: typeof policy.required_utm_source === "string" ? policy.required_utm_source : "google_business_profile",
  };
}

async function buildPropertyContext(db: D1Database, communityId: string, input: ContextInput): Promise<PropertyContext> {
  const community = await queryFirst<any>(db, `
    SELECT id, name, external_key, ga4_property_id, encasa_property_code, full_url, city, state, region, unit_count
    FROM communities
    WHERE id = ? AND deleted_at IS NULL
  `, [communityId]);
  if (!community) throw new Error("Community not found");

  const latestSnapshot = await queryFirst<{ snapshot_date: string | null }>(
    db,
    "SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics WHERE community_id = ?",
    [communityId]
  );
  const snapshotDate = latestSnapshot?.snapshot_date ?? null;
  const pib = snapshotDate ? await queryFirst<any>(db, `
    SELECT
      g.snapshot_date,
      g.total_sessions,
      g.sessions_trend_pct,
      lp.total_profile_views,
      lp.views_trend_pct AS gbp_views_trend_pct,
      lp.action_rate AS gbp_action_rate,
      srch.total_clicks AS gsc_clicks,
      cir.cir_value,
      rv.avg_rating,
      rv.recent_30d_count AS recent_reviews
    FROM pib_ga4_metrics g
    LEFT JOIN pib_local_presence lp ON lp.community_id = g.community_id AND lp.snapshot_date = g.snapshot_date
    LEFT JOIN pib_search_performance srch ON srch.community_id = g.community_id AND srch.snapshot_date = g.snapshot_date
    LEFT JOIN pib_cir cir ON cir.community_id = g.community_id AND cir.snapshot_date = g.snapshot_date
    LEFT JOIN pib_reviews rv ON rv.community_id = g.community_id AND rv.snapshot_date = g.snapshot_date
    WHERE g.community_id = ? AND g.snapshot_date = ?
  `, [communityId, snapshotDate]) : null;

  const marketing = await queryFirst<any>(db, `
    SELECT week_date, occupancy, atr
    FROM marketing_data
    WHERE community_id = ?
    ORDER BY week_date DESC
    LIMIT 1
  `, [communityId]);
  const policy = await getPolicy(db, communityId);
  const captain = input.use_captain_context === false
    ? emptyCaptainContext(resolveCaptainPropertyId(community))
    : await buildCaptainContext(db, community);

  return {
    community,
    pib: {
      snapshot_date: pib?.snapshot_date ?? null,
      total_sessions: numberOrNull(pib?.total_sessions),
      sessions_trend_pct: numberOrNull(pib?.sessions_trend_pct),
      total_profile_views: numberOrNull(pib?.total_profile_views),
      gbp_views_trend_pct: numberOrNull(pib?.gbp_views_trend_pct),
      gbp_action_rate: numberOrNull(pib?.gbp_action_rate),
      gsc_clicks: numberOrNull(pib?.gsc_clicks),
      cir_value: numberOrNull(pib?.cir_value),
      avg_rating: numberOrNull(pib?.avg_rating),
      recent_reviews: numberOrNull(pib?.recent_reviews),
    },
    marketing: {
      week_date: marketing?.week_date ?? null,
      occupancy: numberOrNull(marketing?.occupancy),
      atr: numberOrNull(marketing?.atr),
    },
    captain,
    live_inputs: {
      availability_summary: sanitizeText(input.availability_summary),
      concession_summary: sanitizeText(input.concession_summary),
      concession_expires_on: input.concession_expires_on ?? null,
      amenity_highlights: Array.isArray(input.amenity_highlights) ? input.amenity_highlights : [],
      feature_highlights: Array.isArray(input.feature_highlights) ? input.feature_highlights : [],
      cta_url: input.cta_url ?? community.full_url ?? null,
      notes: sanitizeText(input.notes),
      source_label: sanitizeText(input.source_label),
    },
    policy: {
      approval_required: policy.approval_required,
      allow_offer_posts: policy.allow_offer_posts,
      allow_event_posts: policy.allow_event_posts,
      allow_amenity_posts: policy.allow_amenity_posts,
      cooldown_days: policy.cooldown_days,
      max_drafts_per_run: policy.max_drafts_per_run,
      blocked_terms: policy.blocked_terms,
      required_utm_source: policy.required_utm_source,
    },
    freshness: {
      pib_snapshot_date: snapshotDate,
      marketing_week_date: marketing?.week_date ?? null,
      has_live_inputs: Boolean(input.availability_summary || input.concession_summary || input.amenity_highlights?.length || input.feature_highlights?.length),
    },
  };
}

async function persistSnapshot(db: D1Database, communityId: string, actorId: string, context: PropertyContext) {
  const id = newId();
  const payload = {
    community: context.community,
    pib: context.pib,
    marketing: context.marketing,
    captain: context.captain,
    live_inputs: context.live_inputs,
    policy: context.policy,
  };
  const payloadText = JSON.stringify(payload);
  const now = nowISO();
  const snapshotHash = await sha256(payloadText);
  await run(db, `
    INSERT INTO gbp_post_source_snapshots (
      id, community_id, source_kind, snapshot_hash, source_payload_json,
      freshness_json, created_at, created_by
    ) VALUES (?, ?, 'context_builder', ?, ?, ?, ?, ?)
  `, [
    id,
    communityId,
    snapshotHash,
    payloadText,
    JSON.stringify(context.freshness),
    now,
    actorId,
  ]);

  return { id, snapshot_hash: snapshotHash, created_at: now };
}

function buildDraftCandidates(context: PropertyContext, requestedCount: number) {
  const maxDrafts = Math.max(1, Math.min(requestedCount, 3));
  const seen = new Set<string>();
  const candidates: any[] = [];
  const angles: Array<"captain_directive" | "offer" | "availability" | "amenity" | "reputation" | "performance"> = [
    "captain_directive",
    "offer",
    "availability",
    "amenity",
    "reputation",
    "performance",
  ];

  for (const angle of angles) {
    const candidate = buildCandidateForAngle(context, angle);
    if (!candidate) continue;
    if (seen.has(candidate.rendered_text)) continue;
    seen.add(candidate.rendered_text);
    candidates.push({ ...candidate, rank: candidates.length + 1 });
    if (candidates.length >= maxDrafts) break;
  }

  if (candidates.length === 0) {
    candidates.push({
      rank: 1,
      angle: "evergreen",
      post_type: "STANDARD",
      title: `Visit ${context.community.name as string}`,
      rendered_text: `Explore what makes ${context.community.name as string} stand out in ${(context.community.city as string) || "the area"}. Connect with the team today to learn more and plan your next visit.`,
      payload: buildStandardPayload(
        context,
        `Explore what makes ${context.community.name as string} stand out in ${(context.community.city as string) || "the area"}. Connect with the team today to learn more and plan your next visit.`
      ),
      validation: validateCandidate(context, "evergreen", "STANDARD"),
      generation_notes: "Fallback evergreen draft created because structured live inputs were limited.",
    });
  }

  return candidates;
}

function buildCandidateForAngle(
  context: PropertyContext,
  angle: "captain_directive" | "offer" | "availability" | "amenity" | "reputation" | "performance"
) {
  const name = context.community.name as string;
  const city = context.community.city as string | null;
  const amenities = context.live_inputs.amenity_highlights;
  const features = context.live_inputs.feature_highlights;
  const availability = context.live_inputs.availability_summary;
  const concession = context.live_inputs.concession_summary;
  const rating = context.pib.avg_rating;
  const profileViews = context.pib.total_profile_views;

  if (angle === "captain_directive") {
    if (!context.captain.primary_directive) return null;
    const recommended = context.captain.recommended_angles[0];
    const focus = recommended ? ` Current Captain focus: ${recommended}.` : "";
    const detail = availability
      ? ` ${availability}`
      : amenities.length
        ? ` Explore ${joinHighlights(amenities)}.`
        : features.length
          ? ` Explore ${joinHighlights(features)}.`
          : " Connect with the leasing team to find the right next step.";
    const text = normalizeSentence(`${name} is ready to help with your next home search.${focus}${detail} Schedule a visit or contact the team today.`);
    return {
      angle,
      post_type: "STANDARD",
      title: `${name} Captain focus`,
      rendered_text: text,
      payload: buildStandardPayload(context, text),
      validation: validateCandidate(context, angle, "STANDARD"),
      generation_notes: `Captain-led draft grounded in active Captain context: ${context.captain.primary_directive}`,
    };
  }

  if (angle === "offer") {
    if (!context.policy.allow_offer_posts || !concession) return null;
    const text = `${name} is featuring ${concession}${context.live_inputs.concession_expires_on ? ` through ${formatDate(context.live_inputs.concession_expires_on)}` : ""}. Reach out today to confirm details and schedule your personalized tour.`;
    return {
      angle,
      post_type: "OFFER",
      title: `${name} offer`,
      rendered_text: text,
      payload: buildOfferPayload(context, text),
      validation: validateCandidate(context, angle, "OFFER"),
      generation_notes: "Offer-led draft grounded in live concession input.",
    };
  }

  if (angle === "availability") {
    if (!availability) return null;
    const details = features.length ? ` Featuring ${joinHighlights(features)}.` : "";
    const text = `${availability} at ${name}.${details} Connect with our team to explore current options and book your visit.`;
    return {
      angle,
      post_type: "STANDARD",
      title: `${name} availability`,
      rendered_text: normalizeSentence(text),
      payload: buildStandardPayload(context, normalizeSentence(text)),
      validation: validateCandidate(context, angle, "STANDARD"),
      generation_notes: "Availability-led draft grounded in live feed copy.",
    };
  }

  if (angle === "amenity") {
    if (!context.policy.allow_amenity_posts || amenities.length === 0) return null;
    const text = `${name} in ${city || "your neighborhood"} brings together ${joinHighlights(amenities)}. Discover a community designed for comfort, convenience, and your daily routine.`;
    return {
      angle,
      post_type: "STANDARD",
      title: `${name} amenities`,
      rendered_text: text,
      payload: buildStandardPayload(context, text),
      validation: validateCandidate(context, angle, "STANDARD"),
      generation_notes: "Amenity-led draft grounded in supplied amenity highlights.",
    };
  }

  if (angle === "reputation") {
    if (!rating || rating < 4.2) return null;
    const text = `${name} is earning strong feedback from residents, with a ${rating.toFixed(1)}-star average rating. See what sets the experience apart and contact the team to learn more today.`;
    return {
      angle,
      post_type: "STANDARD",
      title: `${name} reputation`,
      rendered_text: text,
      payload: buildStandardPayload(context, text),
      validation: validateCandidate(context, angle, "STANDARD"),
      generation_notes: "Reputation-led draft grounded in PIB review metrics.",
    };
  }

  if (angle === "performance") {
    if (!profileViews || profileViews < 1) return null;
    const trend = context.pib.gbp_views_trend_pct;
    const trendText = trend != null ? ` Local discovery is ${trend >= 0 ? "up" : "shifting"} ${Math.abs(trend).toFixed(0)}% in the latest window.` : "";
    const text = `${name} is seeing strong local visibility on Google.${trendText} Visit the community page to explore floor plans, neighborhood highlights, and next steps.`;
    return {
      angle,
      post_type: "STANDARD",
      title: `${name} visibility`,
      rendered_text: normalizeSentence(text),
      payload: buildStandardPayload(context, normalizeSentence(text)),
      validation: validateCandidate(context, angle, "STANDARD"),
      generation_notes: "Performance-led draft grounded in PIB local presence metrics.",
    };
  }

  return null;
}

function buildStandardPayload(context: PropertyContext, summary: string) {
  return {
    languageCode: "en-US",
    topicType: "STANDARD",
    summary,
    callToAction: {
      actionType: "LEARN_MORE",
      url: buildCtaUrl(context),
    },
  };
}

function buildOfferPayload(context: PropertyContext, summary: string) {
  return {
    languageCode: "en-US",
    topicType: "OFFER",
    summary,
    offer: {
      redeemOnlineUrl: buildCtaUrl(context),
      termsConditions: "Offer details, availability, and pricing are subject to change. Contact the leasing team for complete terms.",
    },
    event: context.live_inputs.concession_expires_on ? {
      title: `${context.community.name as string} Offer`,
      schedule: {
        startDate: isoDateToGoogleDate(new Date().toISOString().slice(0, 10)),
        endDate: isoDateToGoogleDate(context.live_inputs.concession_expires_on),
        endTime: { hours: 23, minutes: 59, seconds: 59 },
      },
    } : undefined,
  };
}

function validateCandidate(context: PropertyContext, angle: string, postType: "STANDARD" | "OFFER" | "EVENT") {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const summaryLength = (angle.length + JSON.stringify(context.live_inputs)).length;

  if (!context.live_inputs.cta_url && !context.community.full_url) {
    blockers.push("Missing property CTA URL.");
  }
  if (postType === "OFFER" && !context.live_inputs.concession_expires_on) {
    warnings.push("Offer post has no explicit expiration date.");
  }
  if (!context.freshness.has_live_inputs && (angle === "offer" || angle === "availability" || angle === "amenity")) {
    warnings.push("Draft relies on manual or sparse live inputs; review before publishing.");
  }
  if (!context.freshness.pib_snapshot_date) {
    warnings.push("No PIB snapshot found in Data Pond for this community.");
  }
  if (angle === "captain_directive" && !context.captain.latest_brief_created_at) {
    warnings.push("Captain context is available from runtime actions/watch items, but no latest Captain Brief run was found.");
  }
  if (summaryLength > 1800) {
    blockers.push("Payload appears too large for safe GBP posting.");
  }
  if (context.policy.blocked_terms.some((term) => JSON.stringify(context).toLowerCase().includes(term.toLowerCase()))) {
    warnings.push("One or more blocked terms appear in source context.");
  }

  return {
    approval_required: context.policy.approval_required,
    warnings,
    blockers,
    freshness: context.freshness,
  };
}

async function buildCaptainContext(db: D1Database, community: Record<string, unknown>): Promise<PropertyContext["captain"]> {
  const propertyId = resolveCaptainPropertyId(community);
  if (!propertyId) return emptyCaptainContext(null);

  const [briefRun, watchItems, actions] = await Promise.all([
    queryFirst<Record<string, unknown>>(db, `
      SELECT id, created_at, evidence_json
      FROM captain_brief_runs
      WHERE property_id = ? OR community_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [propertyId, community.id]),
    queryAll<Record<string, unknown>>(db, `
      SELECT watch_key, title, category, severity, current_state, next_move, updated_at
      FROM captain_watch_items
      WHERE (property_id = ? OR community_id = ?)
        AND status IN ('open', 'monitoring', 'escalated')
      ORDER BY severity DESC, updated_at DESC
      LIMIT 8
    `, [propertyId, community.id]),
    queryAll<Record<string, unknown>>(db, `
      SELECT action_key, title, owner_role, priority, due_date, expected_outcome, updated_at
      FROM captain_actions
      WHERE (property_id = ? OR community_id = ?)
        AND status IN ('open', 'in_progress', 'blocked')
      ORDER BY priority DESC, due_date ASC, updated_at DESC
      LIMIT 8
    `, [propertyId, community.id]),
  ]);

  const topWatchItems = watchItems.slice(0, 4).map((item) => ({
    key: String(item.watch_key ?? ""),
    title: String(item.title ?? ""),
    category: item.category == null ? null : String(item.category),
    severity: numberOrNull(item.severity),
    state: item.current_state == null ? null : String(item.current_state),
    next_move: item.next_move == null ? null : String(item.next_move),
  }));
  const topActions = actions.slice(0, 4).map((item) => ({
    key: String(item.action_key ?? ""),
    title: String(item.title ?? ""),
    owner_role: item.owner_role == null ? null : String(item.owner_role),
    priority: numberOrNull(item.priority),
    due_date: item.due_date == null ? null : String(item.due_date),
    expected_outcome: item.expected_outcome == null ? null : String(item.expected_outcome),
  }));
  const recommendedAngles = deriveCaptainAngles(topWatchItems, topActions);
  const primaryDirective = topActions[0]?.title ?? topWatchItems[0]?.next_move ?? topWatchItems[0]?.title ?? null;

  return {
    property_id: propertyId,
    latest_brief_created_at: briefRun?.created_at == null ? null : String(briefRun.created_at),
    active_watch_count: watchItems.length,
    active_action_count: actions.length,
    top_watch_items: topWatchItems,
    top_actions: topActions,
    recommended_angles: recommendedAngles,
    primary_directive: primaryDirective,
    source_note: "Captain context comes from active Captain watch items, actions, and latest brief run in D1.",
  };
}

function emptyCaptainContext(propertyId: string | null): PropertyContext["captain"] {
  return {
    property_id: propertyId,
    latest_brief_created_at: null,
    active_watch_count: 0,
    active_action_count: 0,
    top_watch_items: [],
    top_actions: [],
    recommended_angles: [],
    primary_directive: null,
    source_note: "No active Captain runtime context was found for this community.",
  };
}

function resolveCaptainPropertyId(community: Record<string, unknown>) {
  for (const key of ["encasa_property_code", "external_key", "ga4_property_id"]) {
    const value = community[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function deriveCaptainAngles(
  watchItems: PropertyContext["captain"]["top_watch_items"],
  actions: PropertyContext["captain"]["top_actions"]
) {
  const text = [...watchItems, ...actions]
    .map((item) => `${item.key} ${item.title} ${"state" in item ? item.state ?? "" : ""} ${"expected_outcome" in item ? item.expected_outcome ?? "" : ""}`)
    .join(" ")
    .toLowerCase();
  const angles: string[] = [];
  if (/(inventory|availability|unit|floorplan|365|aged|exposure)/.test(text)) angles.push("availability");
  if (/(concession|special|offer|pricing|rent)/.test(text)) angles.push("offer");
  if (/(navigator|search|seo|local|google|gbp|visibility)/.test(text)) angles.push("local visibility");
  if (/(review|rating|reputation)/.test(text)) angles.push("reputation");
  if (/(amenity|content|website|copy|cta|specs)/.test(text)) angles.push("amenity or content spotlight");
  if (/(tour|lead|guest card|traffic|conversion|funnel)/.test(text)) angles.push("tour conversion");
  return Array.from(new Set(angles)).slice(0, 4);
}

function buildSuggestionsFromContext(context: PropertyContext): GbpPostSuggestion[] {
  const name = String(context.community.name ?? "Selected property");
  const communityId = String(context.community.id ?? "");
  const captain = context.captain;
  const sourceEvidence = [
    captain.primary_directive ? `Captain directive: ${captain.primary_directive}` : null,
    captain.active_action_count ? `${captain.active_action_count} active Captain action(s)` : null,
    captain.active_watch_count ? `${captain.active_watch_count} active Captain watch item(s)` : null,
    captain.latest_brief_created_at ? `Latest Captain Brief run: ${captain.latest_brief_created_at}` : null,
    context.pib.snapshot_date ? `PIB snapshot: ${context.pib.snapshot_date}` : null,
    context.marketing.week_date ? `Marketing week: ${context.marketing.week_date}` : null,
  ].filter((item): item is string => Boolean(item));
  const suggestions: GbpPostSuggestion[] = [];

  for (const angle of captain.recommended_angles) {
    suggestions.push({
      id: `gbp_suggestion_${communityId}_${slugify(angle)}`,
      community_id: communityId,
      community_name: name,
      property_id: captain.property_id,
      angle,
      priority: scoreSuggestion(context, angle),
      reason: suggestionReason(context, angle),
      source_evidence: sourceEvidence,
      recommended_channel: "GBP",
      draft_seed: {
        source_label: `Captain suggested: ${angle}`,
        notes: `Prepare a GBP draft using Captain context. ${captain.primary_directive ?? suggestionReason(context, angle)}`,
        use_captain_context: true,
        draft_count: 3,
      },
    });
  }

  if (suggestions.length === 0 && captain.primary_directive) {
    suggestions.push({
      id: `gbp_suggestion_${communityId}_captain_directive`,
      community_id: communityId,
      community_name: name,
      property_id: captain.property_id,
      angle: "captain directive",
      priority: scoreSuggestion(context, "captain directive"),
      reason: captain.primary_directive,
      source_evidence: sourceEvidence,
      recommended_channel: "GBP",
      draft_seed: {
        source_label: "Captain suggested: directive",
        notes: `Prepare a GBP draft around this Captain directive: ${captain.primary_directive}`,
        use_captain_context: true,
        draft_count: 3,
      },
    });
  }

  if (suggestions.length === 0 && context.pib.total_profile_views && context.pib.total_profile_views > 0) {
    suggestions.push({
      id: `gbp_suggestion_${communityId}_local_visibility`,
      community_id: communityId,
      community_name: name,
      property_id: captain.property_id,
      angle: "local visibility",
      priority: 30 + Math.min(context.pib.total_profile_views / 100, 20),
      reason: "Recent GBP/local visibility data exists, making this property eligible for a local presence post.",
      source_evidence: sourceEvidence,
      recommended_channel: "GBP",
      draft_seed: {
        source_label: "Data Pond suggested: local visibility",
        notes: "Prepare a GBP draft from current local visibility context and property-safe evergreen copy.",
        use_captain_context: true,
        draft_count: 3,
      },
    });
  }

  return suggestions.slice(0, 3);
}

function scoreSuggestion(context: PropertyContext, angle: string) {
  let score = 40;
  score += context.captain.active_action_count * 8;
  score += context.captain.active_watch_count * 5;
  if (context.captain.latest_brief_created_at) score += 8;
  if (angle === "availability" || angle === "tour conversion") score += 8;
  if (angle === "offer" && context.policy.allow_offer_posts) score += 6;
  if (angle === "amenity or content spotlight" && context.policy.allow_amenity_posts) score += 4;
  if (context.pib.gbp_views_trend_pct != null && context.pib.gbp_views_trend_pct < 0) score += 5;
  return Math.round(score);
}

function suggestionReason(context: PropertyContext, angle: string) {
  const name = String(context.community.name ?? "This property");
  if (angle === "availability") return `${name} has active Captain pressure around inventory or availability, so a GBP post can support local demand capture.`;
  if (angle === "offer") return `${name} has pricing, concession, or offer-related Captain pressure; review approved source terms before posting.`;
  if (angle === "local visibility") return `${name} has search/local visibility context that can support a grounded GBP update.`;
  if (angle === "reputation") return `${name} has reputation context that may support a review-aware local presence post.`;
  if (angle === "amenity or content spotlight") return `${name} has site/content or amenity context that can become a safe local spotlight post.`;
  if (angle === "tour conversion") return `${name} has funnel or tour-conversion pressure; use a post to move local intent toward contact or tour.`;
  return context.captain.primary_directive ?? `Captain context suggests a GBP draft for ${name}.`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "draft";
}

function buildCtaUrl(context: PropertyContext) {
  const raw = context.live_inputs.cta_url ?? (context.community.full_url as string | null) ?? "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!url.searchParams.get("utm_source")) {
      url.searchParams.set("utm_source", context.policy.required_utm_source ?? "google_business_profile");
    }
    if (!url.searchParams.get("utm_medium")) {
      url.searchParams.set("utm_medium", "organic_post");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function sanitizeText(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

function joinHighlights(items: string[]) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : value == null ? null : Number(value);
}

function normalizeSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatDate(value: string) {
  const dt = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoDateToGoogleDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return { year, month, day };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { gbpPosts };
