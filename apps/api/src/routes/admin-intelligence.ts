import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { queryAll, queryFirst, run } from "../lib/db";
import { newId } from "../lib/id";
import { nowISO, errJson, validateSafeText } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";
import { EVS_PILOT_PROPERTIES } from "../evs/pilot-properties";
import { getBriefCompletenessMap } from "../platform/intelligence/brief-completeness";
import type { BriefCompletenessResult as BriefReadinessResult } from "../platform/intelligence/brief-completeness";

const adminIntelligence = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
adminIntelligence.use("*", requireAuth, requireAdmin);

const UpdateOfficeBody = z.object({
  office_name: z.string().min(1),
  office_label: z.string().min(1),
  mission: z.string().min(1),
  source_of_truth: z.string().min(1),
  operating_model: z.string().min(1),
  naming_rationale: z.string().min(1),
});

const CreateDirectiveBody = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  directive_text: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

const UpdateDirectiveBody = CreateDirectiveBody.partial();

const UpdatePropertyBody = z.object({
  revised_url: z.string().url().optional().or(z.literal("")),
  editorial_focus: z.string().optional().default(""),
  approved_points: z.string().optional().default(""),
  open_questions: z.string().optional().default(""),
  advocate_prompt: z.string().optional().default(""),
}).partial();

const CreateAdvocatePromptBody = z.object({
  property_id: z.string().min(1),
  prompt_text: z.string().min(1),
  desired_outcome: z.string().min(1),
});

const CreateClaimBody = z.object({
  property_id: z.string().optional().nullable(),
  cohort_key: z.string().optional().nullable(),
  claim_text: z.string().min(1),
  source: z.enum(["intelligence_office", "derived", "migration", "other"]).default("intelligence_office"),
  confidence: z.number().min(0).max(1).default(0.8),
  applicable_scope: z.enum(["property", "cohort", "global"]),
  status: z.enum(["active", "archived"]).default("active"),
  linked_evidence_ids: z.array(z.string()).optional(),
});

const UpdateClaimBody = CreateClaimBody.partial();

const CreateEvidenceBody = z.object({
  evidence_type: z.string().min(1),
  source_system: z.string().min(1),
  reference: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.string().optional().nullable(),
  status: z.enum(["active", "archived"]).default("active"),
});

const UpdateEvidenceBody = CreateEvidenceBody.partial();

const LinkClaimEvidenceBody = z.object({
  evidence_id: z.string().min(1),
});

interface OfficeRow {
  id: string;
  office_name: string;
  office_label: string;
  mission: string;
  source_of_truth: string;
  operating_model: string;
  naming_rationale: string;
  updated_at: string;
}

type IntelligencePilotPropertyRow = {
  property_id: string;
  property_name: string;
  legacy_url: string | null;
  staging_url: string | null;
  live_url: string | null;
  revised_url: string | null;
  editorial_focus: string;
  approved_points: string;
  open_questions: string;
  advocate_prompt: string;
  updated_at: string;
};

type IntelligenceClaimRow = {
  id: string;
  property_id: string | null;
  cohort_key: string | null;
  claim_text: string;
  source: "intelligence_office" | "derived" | "migration" | "other";
  confidence: number;
  applicable_scope: "property" | "cohort" | "global";
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type IntelligenceEvidenceRow = {
  id: string;
  evidence_type: string;
  source_system: string;
  reference: string;
  summary: string;
  timestamp: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type IntelligenceClaimEvidenceRow = {
  id: string;
  claim_id: string;
  evidence_id: string;
  created_at: string;
};

async function getPropertyBriefInputs(
  db: D1Database,
  propertyKey: string
): Promise<{
  property: IntelligencePilotPropertyRow;
  claims: IntelligenceClaimRow[];
  evidence: IntelligenceEvidenceRow[];
  claimEvidence: IntelligenceClaimEvidenceRow[];
  briefReadiness: BriefReadinessResult | null;
}> {
  const property = await resolvePilotPropertyByKey(db, propertyKey);
  if (!property) {
    throw new Error("PROPERTY_NOT_FOUND");
  }
  const canonicalPropertyId = property.property_id;

  const claims = await queryAll<IntelligenceClaimRow>(
    db,
    `SELECT id, property_id, cohort_key, claim_text, source, confidence, applicable_scope, status, created_at, updated_at
     FROM intelligence_claims
     WHERE property_id = ? AND applicable_scope = 'property' AND status = 'active'
     ORDER BY updated_at DESC`,
    [canonicalPropertyId]
  );

  const claimEvidence = claims.length
    ? await queryAll<IntelligenceClaimEvidenceRow>(
        db,
        `SELECT id, claim_id, evidence_id, created_at
         FROM intelligence_claim_evidence
         WHERE claim_id IN (${claims.map(() => "?").join(",")})`,
        claims.map((claim) => claim.id)
      )
    : [];

  const evidenceIds = [...new Set(claimEvidence.map((link) => link.evidence_id))];
  const evidence = evidenceIds.length
    ? await queryAll<IntelligenceEvidenceRow>(
        db,
        `SELECT id, evidence_type, source_system, reference, summary, timestamp, status, created_at, updated_at
         FROM intelligence_evidence
         WHERE id IN (${evidenceIds.map(() => "?").join(",")}) AND status = 'active'
         ORDER BY updated_at DESC`,
        evidenceIds
      )
    : [];

  const readinessMap = await getBriefCompletenessMap(db, [
    {
      property_id: property.property_id,
      approved_points: property.approved_points,
    },
  ]);

  return {
    property,
    claims,
    evidence,
    claimEvidence,
    briefReadiness: readinessMap[property.property_id] ?? null,
  };
}

function normalizePilotPropertyLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolvePilotPropertyByKey(
  db: D1Database,
  propertyKey: string
): Promise<IntelligencePilotPropertyRow | null> {
  const normalizedKey = decodeURIComponent(propertyKey).trim();
  const direct = await queryFirst<IntelligencePilotPropertyRow>(
    db,
    `SELECT property_id, property_name, legacy_url, staging_url, live_url, revised_url,
            editorial_focus, approved_points, open_questions, advocate_prompt, updated_at
     FROM intelligence_pilot_properties
     WHERE property_id = ?`,
    [normalizedKey]
  );
  if (direct) return direct;

  const byName = await queryFirst<IntelligencePilotPropertyRow>(
    db,
    `SELECT property_id, property_name, legacy_url, staging_url, live_url, revised_url,
            editorial_focus, approved_points, open_questions, advocate_prompt, updated_at
     FROM intelligence_pilot_properties
     WHERE lower(property_name) = lower(?)`,
    [normalizedKey.replace(/[-_]+/g, " ")]
  );
  if (byName) return byName;

  const rows = await queryAll<IntelligencePilotPropertyRow>(
    db,
    `SELECT property_id, property_name, legacy_url, staging_url, live_url, revised_url,
            editorial_focus, approved_points, open_questions, advocate_prompt, updated_at
     FROM intelligence_pilot_properties`
  );
  const target = normalizePilotPropertyLookup(normalizedKey);
  return (
    rows.find((row) => normalizePilotPropertyLookup(row.property_id) === target) ??
    rows.find((row) => normalizePilotPropertyLookup(row.property_name) === target) ??
    null
  );
}

adminIntelligence.get("/", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);

  const office = await queryFirst<OfficeRow>(
    c.env.POP_BRIEF_DB,
    `SELECT id, office_name, office_label, mission, source_of_truth, operating_model, naming_rationale, updated_at
     FROM intelligence_office_profile
     LIMIT 1`
  );

  const directives = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT id, category, title, directive_text, rationale, status, sort_order, updated_at
     FROM intelligence_directives
     ORDER BY sort_order ASC, updated_at DESC`
  );

  const sources = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT id, title, source_kind, relative_path, summary, evidence_excerpt, status, updated_at
     FROM intelligence_sources
     ORDER BY updated_at DESC`
  );

  const properties = await queryAll<IntelligencePilotPropertyRow>(
    c.env.POP_BRIEF_DB,
    `SELECT property_id, property_name, legacy_url, staging_url, live_url, revised_url,
            editorial_focus, approved_points, open_questions, advocate_prompt, updated_at
     FROM intelligence_pilot_properties
     ORDER BY property_name ASC`
  );

  const advocatePrompts = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT id, property_id, prompt_text, desired_outcome, created_at, updated_at
     FROM intelligence_advocate_prompts
     ORDER BY updated_at DESC`
  );

  const claims = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT id, property_id, cohort_key, claim_text, source, confidence, applicable_scope, status, created_at, updated_at
     FROM intelligence_claims
     ORDER BY updated_at DESC`
  );

  const evidence = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT id, evidence_type, source_system, reference, summary, timestamp, status, created_at, updated_at
     FROM intelligence_evidence
     ORDER BY updated_at DESC`
  );

  const claimEvidence = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT id, claim_id, evidence_id, created_at
     FROM intelligence_claim_evidence`
  );

  const briefReadiness = await getBriefCompletenessMap(
    c.env.POP_BRIEF_DB,
    properties.map((property) => ({
      property_id: property.property_id,
      approved_points: property.approved_points,
    }))
  );

  return c.json({ office, directives, sources, properties, advocatePrompts, claims, evidence, claimEvidence, briefReadiness });
});

adminIntelligence.get("/properties/:propertyId/brief-inputs", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  try {
    return c.json(await getPropertyBriefInputs(c.env.POP_BRIEF_DB, c.req.param("propertyId")));
  } catch (error) {
    if (error instanceof Error && error.message === "PROPERTY_NOT_FOUND") {
      return c.json(errJson("NOT_FOUND", "Property brief not found"), 404);
    }
    throw error;
  }
});

adminIntelligence.put("/office", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const parse = UpdateOfficeBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  for (const [field, value] of Object.entries(parse.data)) {
    const msg = validateSafeText(value, field);
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
  }

  const now = nowISO();
  const actor = c.get("user");
  const before = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_office_profile LIMIT 1`);

  await run(
    c.env.POP_BRIEF_DB,
    `UPDATE intelligence_office_profile
     SET office_name = ?, office_label = ?, mission = ?, source_of_truth = ?, operating_model = ?, naming_rationale = ?, updated_at = ?, updated_by = ?
     WHERE id = (SELECT id FROM intelligence_office_profile LIMIT 1)`,
    [
      parse.data.office_name,
      parse.data.office_label,
      parse.data.mission,
      parse.data.source_of_truth,
      parse.data.operating_model,
      parse.data.naming_rationale,
      now,
      actor.id,
    ]
  );

  const after = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_office_profile LIMIT 1`);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.office.update",
    entityType: "intelligence_office",
    entityId: String(after && (after as Record<string, unknown>).id),
    before,
    after,
  });

  return c.json(after);
});

adminIntelligence.post("/directives", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const parse = CreateDirectiveBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  for (const [field, value] of Object.entries(parse.data)) {
    const msg = validateSafeText(value, field);
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
  }

  const actor = c.get("user");
  const now = nowISO();
  const id = newId();
  const order = await queryFirst<{ max_sort: number | null }>(
    c.env.POP_BRIEF_DB,
    `SELECT MAX(sort_order) as max_sort FROM intelligence_directives`
  );
  const nextSort = (order?.max_sort ?? 0) + 10;

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO intelligence_directives
      (id, category, title, directive_text, rationale, status, sort_order, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parse.data.category,
      parse.data.title,
      parse.data.directive_text,
      parse.data.rationale,
      parse.data.status,
      nextSort,
      now,
      actor.id,
      now,
      actor.id,
    ]
  );

  const created = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_directives WHERE id = ?`, [id]);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.directive.create",
    entityType: "intelligence_directive",
    entityId: id,
    after: created,
  });
  return c.json(created, 201);
});

adminIntelligence.patch("/directives/:id", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const id = c.req.param("id");
  const parse = UpdateDirectiveBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  const before = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_directives WHERE id = ?`, [id]);
  if (!before) return c.json(errJson("NOT_FOUND", "Directive not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [field, value] of Object.entries(parse.data)) {
    if (value === undefined) continue;
    const msg = typeof value === "string" ? validateSafeText(value, field) : null;
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
    sets.push(`${field} = ?`);
    params.push(value);
  }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(nowISO(), actor.id, id);

  await run(c.env.POP_BRIEF_DB, `UPDATE intelligence_directives SET ${sets.join(", ")} WHERE id = ?`, params);
  const after = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_directives WHERE id = ?`, [id]);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.directive.update",
    entityType: "intelligence_directive",
    entityId: id,
    before,
    after,
  });
  return c.json(after);
});

adminIntelligence.patch("/properties/:propertyId", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const propertyId = c.req.param("propertyId");
  const parse = UpdatePropertyBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  const before = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_pilot_properties WHERE property_id = ?`, [propertyId]);
  if (!before) return c.json(errJson("NOT_FOUND", "Property brief not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [field, value] of Object.entries(parse.data)) {
    if (value === undefined) continue;
    if (field !== "revised_url" && typeof value === "string") {
      const msg = validateSafeText(value, field);
      if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
    }
    sets.push(`${field} = ?`);
    params.push(value === "" ? null : value);
  }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(nowISO(), actor.id, propertyId);

  await run(c.env.POP_BRIEF_DB, `UPDATE intelligence_pilot_properties SET ${sets.join(", ")} WHERE property_id = ?`, params);
  const after = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_pilot_properties WHERE property_id = ?`, [propertyId]);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.property.update",
    entityType: "intelligence_property",
    entityId: propertyId,
    before,
    after,
  });
  return c.json(after);
});

adminIntelligence.post("/advocate-prompts", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const parse = CreateAdvocatePromptBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  for (const [field, value] of Object.entries(parse.data)) {
    const msg = validateSafeText(value, field);
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
  }

  const actor = c.get("user");
  const now = nowISO();
  const id = newId();

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO intelligence_advocate_prompts
      (id, property_id, prompt_text, desired_outcome, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, parse.data.property_id, parse.data.prompt_text, parse.data.desired_outcome, now, actor.id, now, actor.id]
  );

  const created = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_advocate_prompts WHERE id = ?`, [id]);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.advocate_prompt.create",
    entityType: "intelligence_advocate_prompt",
    entityId: id,
    after: created,
  });

  return c.json(created, 201);
});

adminIntelligence.post("/claims", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const parse = CreateClaimBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  const data = parse.data;
  for (const [field, value] of Object.entries({
    claim_text: data.claim_text,
    source: data.source,
    applicable_scope: data.applicable_scope,
    status: data.status,
    property_id: data.property_id ?? "",
    cohort_key: data.cohort_key ?? "",
  })) {
    const msg = validateSafeText(value, field);
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
  }
  if (data.applicable_scope === "property" && !data.property_id) {
    return c.json(errJson("VALIDATION_ERROR", "property_id is required for property-scoped claims"), 400);
  }
  if (data.applicable_scope === "cohort" && !data.cohort_key) {
    return c.json(errJson("VALIDATION_ERROR", "cohort_key is required for cohort-scoped claims"), 400);
  }

  const actor = c.get("user");
  const now = nowISO();
  const id = newId();
  const linkIds = data.linked_evidence_ids ?? [];

  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO intelligence_claims
      (id, property_id, cohort_key, claim_text, source, confidence, applicable_scope, status, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.property_id ?? null,
      data.cohort_key ?? null,
      data.claim_text,
      data.source,
      data.confidence,
      data.applicable_scope,
      data.status,
      now,
      actor.id,
      now,
      actor.id,
    ]
  );

  for (const evidenceId of linkIds) {
    await run(
      c.env.POP_BRIEF_DB,
      `INSERT OR IGNORE INTO intelligence_claim_evidence (id, claim_id, evidence_id, created_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [newId(), id, evidenceId, now, actor.id]
    );
  }

  const created = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_claims WHERE id = ?`, [id]);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.claim.create",
    entityType: "intelligence_claim",
    entityId: id,
    after: created,
  });
  return c.json(created, 201);
});

adminIntelligence.patch("/claims/:id", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const id = c.req.param("id");
  const parse = UpdateClaimBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  const before = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_claims WHERE id = ?`, [id]);
  if (!before) return c.json(errJson("NOT_FOUND", "Claim not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [field, value] of Object.entries(parse.data)) {
    if (value === undefined || field === "linked_evidence_ids") continue;
    const msg = typeof value === "string" ? validateSafeText(value, field) : null;
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
    sets.push(`${field} = ?`);
    params.push(value);
  }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(nowISO(), actor.id, id);
  await run(c.env.POP_BRIEF_DB, `UPDATE intelligence_claims SET ${sets.join(", ")} WHERE id = ?`, params);
  const after = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_claims WHERE id = ?`, [id]);

  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.claim.update",
    entityType: "intelligence_claim",
    entityId: id,
    before,
    after,
  });

  return c.json(after);
});

adminIntelligence.post("/claims/:id/evidence", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const claimId = c.req.param("id");
  const parse = LinkClaimEvidenceBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  const claim = await queryFirst(c.env.POP_BRIEF_DB, `SELECT id FROM intelligence_claims WHERE id = ?`, [claimId]);
  if (!claim) return c.json(errJson("NOT_FOUND", "Claim not found"), 404);

  const evidence = await queryFirst(c.env.POP_BRIEF_DB, `SELECT id FROM intelligence_evidence WHERE id = ?`, [parse.data.evidence_id]);
  if (!evidence) return c.json(errJson("NOT_FOUND", "Evidence not found"), 404);

  const actor = c.get("user");
  const now = nowISO();
  const linkId = newId();
  await run(
    c.env.POP_BRIEF_DB,
    `INSERT OR IGNORE INTO intelligence_claim_evidence (id, claim_id, evidence_id, created_at, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [linkId, claimId, parse.data.evidence_id, now, actor.id]
  );

  const created = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_claim_evidence WHERE id = ?`, [linkId]);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.claim.link_evidence",
    entityType: "intelligence_claim_evidence",
    entityId: linkId,
    after: created,
  });
  return c.json(created, 201);
});

adminIntelligence.post("/evidence", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const parse = CreateEvidenceBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  for (const [field, value] of Object.entries({
    evidence_type: parse.data.evidence_type,
    source_system: parse.data.source_system,
    reference: parse.data.reference,
    summary: parse.data.summary,
    status: parse.data.status,
    timestamp: parse.data.timestamp ?? "",
  })) {
    const msg = validateSafeText(value, field);
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
  }

  const actor = c.get("user");
  const now = nowISO();
  const id = newId();
  await run(
    c.env.POP_BRIEF_DB,
    `INSERT INTO intelligence_evidence
      (id, evidence_type, source_system, reference, summary, timestamp, status, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parse.data.evidence_type,
      parse.data.source_system,
      parse.data.reference,
      parse.data.summary,
      parse.data.timestamp ?? null,
      parse.data.status,
      now,
      actor.id,
      now,
      actor.id,
    ]
  );

  const created = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_evidence WHERE id = ?`, [id]);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.evidence.create",
    entityType: "intelligence_evidence",
    entityId: id,
    after: created,
  });
  return c.json(created, 201);
});

adminIntelligence.patch("/evidence/:id", async (c) => {
  await ensureIntelligenceOffice(c.env.POP_BRIEF_DB);
  const id = c.req.param("id");
  const parse = UpdateEvidenceBody.safeParse(await c.req.json());
  if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0].message), 400);

  const before = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_evidence WHERE id = ?`, [id]);
  if (!before) return c.json(errJson("NOT_FOUND", "Evidence not found"), 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [field, value] of Object.entries(parse.data)) {
    if (value === undefined) continue;
    const msg = typeof value === "string" ? validateSafeText(value, field) : null;
    if (msg) return c.json(errJson("VALIDATION_ERROR", msg), 400);
    sets.push(`${field} = ?`);
    params.push(value);
  }
  if (sets.length === 0) return c.json(errJson("VALIDATION_ERROR", "No fields to update"), 400);

  const actor = c.get("user");
  sets.push("updated_at = ?", "updated_by = ?");
  params.push(nowISO(), actor.id, id);

  await run(c.env.POP_BRIEF_DB, `UPDATE intelligence_evidence SET ${sets.join(", ")} WHERE id = ?`, params);
  const after = await queryFirst(c.env.POP_BRIEF_DB, `SELECT * FROM intelligence_evidence WHERE id = ?`, [id]);
  await writeAuditLog(c.env.POP_BRIEF_DB, {
    actorUserId: actor.id,
    action: "intelligence.evidence.update",
    entityType: "intelligence_evidence",
    entityId: id,
    before,
    after,
  });
  return c.json(after);
});

async function ensureIntelligenceOffice(db: D1Database): Promise<void> {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_office_profile (
      id TEXT PRIMARY KEY,
      office_name TEXT NOT NULL,
      office_label TEXT NOT NULL,
      mission TEXT NOT NULL,
      source_of_truth TEXT NOT NULL,
      operating_model TEXT NOT NULL,
      naming_rationale TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_directives (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      directive_text TEXT NOT NULL,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      summary TEXT NOT NULL,
      evidence_excerpt TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_pilot_properties (
      property_id TEXT PRIMARY KEY,
      property_name TEXT NOT NULL,
      legacy_url TEXT,
      staging_url TEXT,
      live_url TEXT,
      revised_url TEXT,
      editorial_focus TEXT NOT NULL DEFAULT '',
      approved_points TEXT NOT NULL DEFAULT '',
      open_questions TEXT NOT NULL DEFAULT '',
      advocate_prompt TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_advocate_prompts (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      desired_outcome TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_claims (
      id TEXT PRIMARY KEY,
      property_id TEXT,
      cohort_key TEXT,
      claim_text TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      applicable_scope TEXT NOT NULL CHECK (applicable_scope IN ('property', 'cohort', 'global')),
      status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      CHECK (
        (applicable_scope = 'property' AND property_id IS NOT NULL) OR
        (applicable_scope = 'cohort' AND cohort_key IS NOT NULL) OR
        (applicable_scope = 'global' AND property_id IS NULL)
      )
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_evidence (
      id TEXT PRIMARY KEY,
      evidence_type TEXT NOT NULL,
      source_system TEXT NOT NULL,
      reference TEXT NOT NULL,
      summary TEXT NOT NULL,
      timestamp TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS intelligence_claim_evidence (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL REFERENCES intelligence_claims(id) ON DELETE CASCADE,
      evidence_id TEXT NOT NULL REFERENCES intelligence_evidence(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      created_by TEXT,
      UNIQUE(claim_id, evidence_id)
    )`
  );

  const officeCount = await queryFirst<{ count: number }>(db, `SELECT COUNT(*) as count FROM intelligence_office_profile`);
  if (!officeCount || officeCount.count === 0) {
    const now = nowISO();
    await run(
      db,
      `INSERT INTO intelligence_office_profile
        (id, office_name, office_label, mission, source_of_truth, operating_model, naming_rationale, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "intelligence-office",
        "Intelligence Office",
        "The Intelligence Office",
        "Make the directives, evidence, and rules behind the content engine visible, editable, and attributable before they influence property content.",
        "The Data Pond is the system of record. The Intelligence Office is the governed editorial and search-quality layer that interprets that record into directives, rules, and property guidance.",
        "Source docs, pilot property profiles, directives, and Alex's advocate instructions are maintained here as the operational source of truth behind content decisions.",
        "The name stays explicit on purpose: this is where search guidance, property directives, and operating doctrine are managed in the open rather than hidden inside prompts.",
        now,
        now,
      ]
    );
  }

  const directiveCount = await queryFirst<{ count: number }>(db, `SELECT COUNT(*) as count FROM intelligence_directives`);
  if (!directiveCount || directiveCount.count === 0) {
    const now = nowISO();
    const directives = [
      {
        category: "search-quality",
        title: "Favor information gain over keyword-only coverage",
        directive_text:
          "Pages must add real value beyond templated apartment language. Content should help a renter make a decision with property-specific, locally grounded information rather than generic SEO phrasing.",
        rationale:
          "Google's recent core updates reward useful, differentiated pages and demote scaled, low-value copy.",
      },
      {
        category: "property-specificity",
        title: "Prove local expertise and neighborhood relevance",
        directive_text:
          "Each property brief should include neighborhood context, commute value, local landmarks, and real reasons the location matters instead of relying only on amenities and floor plans.",
        rationale:
          "Thin location pages and repetitive neighborhood copy are a known multifamily weakness and now carry more ranking risk.",
      },
      {
        category: "portfolio-governance",
        title: "Reduce cannibalization across similar properties",
        directive_text:
          "Properties in the same market should not all tell the same story. The office should assign clear angles, audience priorities, and differentiators so Google and renters can distinguish them.",
        rationale:
          "Intra-portfolio selection is now a real pressure point: similar pages on the same domain compete with each other.",
      },
      {
        category: "content-engine",
        title: "Keep directives visible behind the engine",
        directive_text:
          "Rules, criteria, source documents, approved claims, and Alex's instructions must be visible and editable in the admin experience rather than buried in hidden prompts.",
        rationale:
          "The system needs a governed, inspectable office of intelligence, not a black box.",
      },
    ];
    for (const [index, directive] of directives.entries()) {
      await run(
        db,
        `INSERT INTO intelligence_directives
          (id, category, title, directive_text, rationale, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [newId(), directive.category, directive.title, directive.directive_text, directive.rationale, (index + 1) * 10, now, now]
      );
    }
  }

  const sourceCount = await queryFirst<{ count: number }>(db, `SELECT COUNT(*) as count FROM intelligence_sources`);
  if (!sourceCount || sourceCount.count === 0) {
    const now = nowISO();
    const sources = [
      {
        title: "Google Core Updates",
        source_kind: "guidance-doc",
        relative_path: "data/Intelligence/Google-Core-Updates.docx",
        summary:
          "Internal synthesis of December 2025 and March 2026 Google core/spam changes with direct multifamily implications: thin location pages lost ground, local expertise and trust signals increased, and site-wide quality now impacts portfolio performance.",
        evidence_excerpt:
          "Key themes: E-E-A-T matters more, information gain matters more, templated neighborhood/location pages are vulnerable, and properties on the same domain can cannibalize each other.",
      },
      {
        title: "Google Core Updates Video Transcript",
        source_kind: "transcript",
        relative_path: "data/Intelligence/google core updates video transcript.docx",
        summary:
          "Verbal review of the same search-quality changes, emphasizing thin location pages, fluff writing, neighborhood specificity, and the need for differentiated archetypes across similar properties.",
        evidence_excerpt:
          "The transcript explicitly calls out duplicate-like structures, portfolio cannibalization, missing commute and employer context, and the need for property segmentation.",
      },
    ];
    for (const source of sources) {
      await run(
        db,
        `INSERT INTO intelligence_sources
          (id, title, source_kind, relative_path, summary, evidence_excerpt, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [newId(), source.title, source.source_kind, source.relative_path, source.summary, source.evidence_excerpt, now, now]
      );
    }
  }

  const propertyCount = await queryFirst<{ count: number }>(db, `SELECT COUNT(*) as count FROM intelligence_pilot_properties`);
  if (!propertyCount || propertyCount.count === 0) {
    const now = nowISO();
    const focusByProperty: Record<string, { approved: string; questions: string; prompt: string }> = {
      "champions-green": {
        approved: "Golf-course adjacency, everyday livability, approachable value, and neighborhood fit should be emphasized over generic luxury language.",
        questions: "Need stronger employer/commute context and localized neighborhood proof.",
        prompt: "Keep the property grounded and specific. Highlight what makes Champion's Green feel distinct in daily life, not just in a list of features.",
      },
      "the-district-universal": {
        approved: "Use proximity to Universal-area demand, entertainment access, and location energy as differentiators while keeping copy practical.",
        questions: "Need precise neighborhood and commuting proof so this does not collapse into generic Orlando-area copy.",
        prompt: "Balance energy and professionalism. This property should feel location-advantaged and useful, not touristy or generic.",
      },
      "the-harrison": {
        approved: "Position around modern Atlanta/Sandy Springs living, professional convenience, and differentiated daily experience.",
        questions: "Need locally specific proof and stronger trust/authority signals.",
        prompt: "Make the copy feel established, polished, and credible. Avoid vague urban-luxury phrasing.",
      },
      ventana: {
        approved: "Lead with comfort, routine, and practical livability. Pet-friendliness and resident ease should feel real, not decorative.",
        questions: "Need stronger neighborhood proof and more section-specific source depth.",
        prompt: "Keep the tone warm and grounded. Show how the property fits daily life rather than over-selling amenities.",
      },
      "calais-midtown": {
        approved: "Emphasize Midtown location leverage, urban convenience, and distinctiveness without sounding interchangeable with other city properties.",
        questions: "Need stronger differentiation from nearby urban competitors and richer local evidence.",
        prompt: "Make Calais Midtown feel intentionally urban, useful, and specific to its place in the market.",
      },
    };

    for (const property of EVS_PILOT_PROPERTIES) {
      const propertyFocus = focusByProperty[property.property_id] ?? {
        approved: "",
        questions: "",
        prompt: "",
      };
      await run(
        db,
        `INSERT INTO intelligence_pilot_properties
          (property_id, property_name, legacy_url, staging_url, live_url, revised_url, editorial_focus, approved_points, open_questions, advocate_prompt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          property.property_id,
          property.property_name,
          property.legacy_url,
          property.staging_url,
          property.live_url,
          property.live_url,
          `Pilot property tracked through the Intelligence Office using Data Pond signals and approved external guidance.`,
          propertyFocus.approved,
          propertyFocus.questions,
          propertyFocus.prompt,
          now,
          now,
        ]
      );
    }
  }
}

export { adminIntelligence };
