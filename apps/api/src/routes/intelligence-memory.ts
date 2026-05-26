import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { errJson } from "../lib/validate";
import { writeAuditLog } from "../lib/audit";
import {
  createCaptainLogEntry,
  createMemoryCandidate,
  ensureGovernedMemoryTables,
  getFleetContext,
  getLedgerContext,
  getMemoryContextForProperty,
  listCaptainLog,
  listFleetSummaries,
  listMemoryProperties,
  promoteCandidate,
} from "../platform/memory/governed-memory";

const intelligenceMemory = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
intelligenceMemory.use("*", requireAuth);

const EvidenceSchema = z.object({
  evidenceType: z.string().min(1),
  evidenceSource: z.string().min(1),
  evidenceRef: z.string().min(1),
  evidenceExcerpt: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const CreateCaptainLogBody = z.object({
  summary: z.string().min(1),
  structuredPayload: z.record(z.unknown()).optional().nullable(),
  evidence: z.array(EvidenceSchema).min(1),
  sourceSystem: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const CreateCandidateBody = z.object({
  rationale: z.string().min(1),
  proposedSummary: z.string().optional(),
  proposedStructuredPayload: z.record(z.unknown()).optional().nullable(),
});

const PromoteCandidateBody = z.object({
  actionNotes: z.string().optional().nullable(),
});

function shouldIncludeAll(c: { req: { query: (name: string) => string | undefined }; get: (name: "user") => { role: string } }) {
  const includeAll = c.req.query("include_all") === "1";
  if (includeAll && c.get("user").role !== "admin") {
    throw new Error("ADMIN_DEBUG_REQUIRED");
  }
  return includeAll;
}

function toErrorResponse(error: unknown) {
  if (error instanceof Error && "status" in error && "code" in error) {
    const appError = error as Error & { status: number; code: string; details?: unknown[] };
    return {
      status: appError.status,
      body: errJson(appError.code, appError.message, appError.details ?? []),
    };
  }
  return {
    status: 500,
    body: errJson("INTERNAL_ERROR", error instanceof Error ? error.message : "Unexpected memory error"),
  };
}

intelligenceMemory.get("/properties", async (c) => {
  await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
  return c.json({ properties: await listMemoryProperties(c.env.POP_BRIEF_DB) });
});

intelligenceMemory.get("/properties/:propertyId/log", async (c) => {
  await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
  const propertyId = c.req.param("propertyId");
  try {
    const includeAll = shouldIncludeAll(c as any);
  const [entries, context] = await Promise.all([
    listCaptainLog(c.env.POP_BRIEF_DB, propertyId, { includeAll }),
    getMemoryContextForProperty(c.env.POP_BRIEF_DB, propertyId, { includeAll }),
  ]);
  return c.json({ entries, context });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_DEBUG_REQUIRED") {
      return c.json(errJson("FORBIDDEN", "Admin access required for include_all"), 403);
    }
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.post("/properties/:propertyId/log", requireRole("admin", "editor"), async (c) => {
  try {
    await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
    const parse = CreateCaptainLogBody.safeParse(await c.req.json());
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Captain's Log payload"), 400);
    }

    const actor = c.get("user");
    const created = await createCaptainLogEntry(
      c.env.POP_BRIEF_DB,
      {
        propertyId: c.req.param("propertyId"),
        summary: parse.data.summary,
        structuredPayload: parse.data.structuredPayload,
        evidence: parse.data.evidence,
        sourceSystem: parse.data.sourceSystem,
        confidence: parse.data.confidence,
      },
      actor.id
    );

    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "intelligence_memory.captains_log.create",
      entityType: "governed_memory_entry",
      entityId: created.entry.id,
      after: created,
    });

    return c.json(created, 201);
  } catch (error) {
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.post("/entries/:entryId/candidates/fleet", requireRole("admin", "editor"), async (c) => {
  try {
    await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
    const parse = CreateCandidateBody.safeParse(await c.req.json());
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Fleet Brief candidate payload"), 400);
    }
    const actor = c.get("user");
    const candidate = await createMemoryCandidate(
      c.env.POP_BRIEF_DB,
      {
        sourceEntryId: c.req.param("entryId"),
        targetScope: "fleet",
        rationale: parse.data.rationale,
        proposedSummary: parse.data.proposedSummary,
        proposedStructuredPayload: parse.data.proposedStructuredPayload,
      },
      actor.id
    );

    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "intelligence_memory.fleet_candidate.create",
      entityType: "governed_memory_candidate",
      entityId: candidate.id,
      after: candidate,
    });

    return c.json(candidate, 201);
  } catch (error) {
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.post("/entries/:entryId/candidates/ledger", requireRole("admin", "editor"), async (c) => {
  try {
    await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
    const parse = CreateCandidateBody.safeParse(await c.req.json());
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Ledger candidate payload"), 400);
    }
    const actor = c.get("user");
    const candidate = await createMemoryCandidate(
      c.env.POP_BRIEF_DB,
      {
        sourceEntryId: c.req.param("entryId"),
        targetScope: "ledger",
        rationale: parse.data.rationale,
        proposedSummary: parse.data.proposedSummary,
        proposedStructuredPayload: parse.data.proposedStructuredPayload,
      },
      actor.id
    );

    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "intelligence_memory.ledger_candidate.create",
      entityType: "governed_memory_candidate",
      entityId: candidate.id,
      after: candidate,
    });

    return c.json(candidate, 201);
  } catch (error) {
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.post("/candidates/:candidateId/promote", requireRole("admin", "editor"), async (c) => {
  try {
    await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
    const parse = PromoteCandidateBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid promotion payload"), 400);
    }
    const actor = c.get("user");
    const promoted = await promoteCandidate(
      c.env.POP_BRIEF_DB,
      {
        candidateId: c.req.param("candidateId"),
        actionNotes: parse.data.actionNotes ?? null,
      },
      actor.id
    );

    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "intelligence_memory.candidate.promote",
      entityType: "governed_memory_candidate",
      entityId: promoted.candidate.id,
      after: promoted,
    });

    return c.json(promoted, 200);
  } catch (error) {
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.get("/fleets", async (c) => {
  await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
  return c.json({ fleets: await listFleetSummaries(c.env.POP_BRIEF_DB) });
});

intelligenceMemory.get("/fleets/:fleetKey", async (c) => {
  await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
  try {
    const includeAll = shouldIncludeAll(c as any);
    return c.json(await getFleetContext(c.env.POP_BRIEF_DB, c.req.param("fleetKey"), { includeAll }));
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_DEBUG_REQUIRED") {
      return c.json(errJson("FORBIDDEN", "Admin access required for include_all"), 403);
    }
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.get("/ledger", async (c) => {
  await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
  try {
    const includeAll = shouldIncludeAll(c as any);
    return c.json(await getLedgerContext(c.env.POP_BRIEF_DB, { includeAll }));
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_DEBUG_REQUIRED") {
      return c.json(errJson("FORBIDDEN", "Admin access required for include_all"), 403);
    }
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

intelligenceMemory.get("/context/property/:propertyId", async (c) => {
  await ensureGovernedMemoryTables(c.env.POP_BRIEF_DB);
  try {
    const includeAll = shouldIncludeAll(c as any);
    return c.json(await getMemoryContextForProperty(c.env.POP_BRIEF_DB, c.req.param("propertyId"), { includeAll }));
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_DEBUG_REQUIRED") {
      return c.json(errJson("FORBIDDEN", "Admin access required for include_all"), 403);
    }
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as any);
  }
});

export { intelligenceMemory };
