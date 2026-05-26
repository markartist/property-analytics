import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { errJson } from "../lib/validate";
import { PropertyAccessDeniedError, requirePropertyAccess } from "../platform/access/property-access-control";
import {
  archiveSelfNote,
  buildMemoryPosture,
  createCommitment,
  createSelfNote,
  ensureCaptainAgentForProperty,
  getAgentIdentity,
  getCommitment,
  getMemoryItem,
  getRegionalAwarenessSummary,
  getSelfNote,
  listCommitmentsForProperty,
  listSelfNotesForProperty,
  updateCommitmentStatus,
} from "../platform/awareness/repository";
import { runReflectionRoutine } from "../platform/awareness/reflection";
import { evaluateMemoryUse } from "../platform/awareness/governance";
import type { CommitmentStatus, MemoryAllowedUse, SelfNoteType } from "../platform/awareness/types";

const awareness = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
awareness.use("*", requireAuth);

const selfNoteBody = z.object({
  agent_id: z.string().min(1).optional(),
  note_text: z.string().min(1).max(4000),
  note_type: z.enum(["reminder", "caution", "lesson", "open_question", "follow_up", "working_hypothesis", "do_not_repeat", "verification_needed"]).default("reminder"),
  importance: z.number().int().min(1).max(5).default(3),
  visibility: z.enum(["private_to_agent", "property_team_visible", "region_visible", "fleet_visible"]).default("private_to_agent"),
  reminder_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  source_context: z.string().nullable().optional(),
});

const commitmentBody = z.object({
  agent_id: z.string().min(1).optional(),
  commitment_type: z.string().min(1).max(120),
  description: z.string().min(1).max(4000),
  owed_by: z.string().min(1).max(200),
  owed_to: z.string().min(1).max(200),
  due_at: z.string().nullable().optional(),
});

const statusBody = z.object({
  status: z.enum(["open", "waiting", "completed", "blocked", "expired", "archived"]),
});

const reflectionBody = z.object({
  routine_type: z.enum(["daily_check", "weekly_reflection", "monthly_retrospective", "post_report_reflection", "post_manager_input_reflection", "post_expert_read_reflection", "stale_memory_review"]),
  property_id: z.string().min(1).nullable().optional(),
  agent_id: z.string().min(1).nullable().optional(),
  correlation_id: z.string().min(1).nullable().optional(),
});

awareness.get("/agents/:agentId", requireRole("admin", "editor"), async (c) => {
  const agent = await getAgentIdentity(c.env.POP_BRIEF_DB, c.req.param("agentId"));
  if (!agent) return c.json(errJson("AGENT_NOT_FOUND", "Agent identity not found"), 404);
  try {
    if (agent.assigned_property_id) {
      await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "view_property", propertyRef: agent.assigned_property_id });
    } else if (agent.assigned_region_id) {
      await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "access_region_scope", region: agent.assigned_region_id });
    } else {
      await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "access_fleet_scope" });
    }
    return c.json(agent);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return c.json(errJson("AGENT_NOT_FOUND", "Agent identity not found"), 404);
    throw error;
  }
});

awareness.get("/properties/:propertyId/posture", requireRole("admin", "editor"), async (c) => {
  try {
    const propertyId = c.req.param("propertyId");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "view_memory_candidates", propertyRef: propertyId });
    await ensureCaptainAgentForProperty(c.env.POP_BRIEF_DB, { property_id: propertyId });
    return c.json(await buildMemoryPosture(c.env.POP_BRIEF_DB, propertyId));
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("AWARENESS_POSTURE_ERROR", error instanceof Error ? error.message : "Unable to load memory posture"), 500);
  }
});

awareness.get("/properties/:propertyId/self-notes", requireRole("admin", "editor"), async (c) => {
  try {
    const propertyId = c.req.param("propertyId");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "view_memory_candidates", propertyRef: propertyId });
    return c.json({ items: await listSelfNotesForProperty(c.env.POP_BRIEF_DB, propertyId) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("SELF_NOTES_ERROR", error instanceof Error ? error.message : "Unable to load self notes"), 500);
  }
});

awareness.post("/properties/:propertyId/self-notes", requireRole("admin", "editor"), async (c) => {
  try {
    const propertyId = c.req.param("propertyId");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "interact_captain", propertyRef: propertyId });
    const parse = selfNoteBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid self note"), 400);
    const agent = parse.data.agent_id ? await getAgentIdentity(c.env.POP_BRIEF_DB, parse.data.agent_id) : await ensureCaptainAgentForProperty(c.env.POP_BRIEF_DB, { property_id: propertyId });
    if (!agent) return c.json(errJson("AGENT_NOT_FOUND", "Agent identity not found"), 404);
    const note = await createSelfNote(c.env.POP_BRIEF_DB, {
      agent_id: agent.agent_id,
      property_id: propertyId,
      region_id: agent.assigned_region_id,
      note_text: parse.data.note_text,
      note_type: parse.data.note_type as SelfNoteType,
      importance: parse.data.importance,
      visibility: parse.data.visibility,
      reminder_at: parse.data.reminder_at ?? null,
      expires_at: parse.data.expires_at ?? null,
      source_context: parse.data.source_context ?? null,
      actor: c.get("user").id,
    });
    return c.json(note, 201);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("SELF_NOTE_CREATE_ERROR", error instanceof Error ? error.message : "Unable to create self note"), 400);
  }
});

awareness.patch("/self-notes/:noteId/archive", requireRole("admin", "editor"), async (c) => {
  try {
    const note = await getSelfNote(c.env.POP_BRIEF_DB, c.req.param("noteId"));
    if (!note) return c.json(errJson("SELF_NOTE_NOT_FOUND", "Self note not found"), 404);
    await requireAwarenessRecordAccess(c, {
      property_id: note.property_id,
      region_id: note.region_id,
      action: "interact_captain",
    });
    await archiveSelfNote(c.env.POP_BRIEF_DB, note.note_id, c.get("user").id);
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("SELF_NOTE_ARCHIVE_ERROR", error instanceof Error ? error.message : "Unable to archive self note"), 400);
  }
});

awareness.get("/properties/:propertyId/commitments", requireRole("admin", "editor"), async (c) => {
  try {
    const propertyId = c.req.param("propertyId");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "view_memory_candidates", propertyRef: propertyId });
    return c.json({ items: await listCommitmentsForProperty(c.env.POP_BRIEF_DB, propertyId) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("COMMITMENTS_ERROR", error instanceof Error ? error.message : "Unable to load commitments"), 500);
  }
});

awareness.post("/properties/:propertyId/commitments", requireRole("admin", "editor"), async (c) => {
  try {
    const propertyId = c.req.param("propertyId");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "interact_captain", propertyRef: propertyId });
    const parse = commitmentBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid commitment"), 400);
    const agent = parse.data.agent_id ? await getAgentIdentity(c.env.POP_BRIEF_DB, parse.data.agent_id) : await ensureCaptainAgentForProperty(c.env.POP_BRIEF_DB, { property_id: propertyId });
    if (!agent) return c.json(errJson("AGENT_NOT_FOUND", "Agent identity not found"), 404);
    const commitment = await createCommitment(c.env.POP_BRIEF_DB, {
      agent_id: agent.agent_id,
      property_id: propertyId,
      region_id: agent.assigned_region_id,
      commitment_type: parse.data.commitment_type,
      description: parse.data.description,
      owed_by: parse.data.owed_by,
      owed_to: parse.data.owed_to,
      due_at: parse.data.due_at ?? null,
      actor: c.get("user").id,
    });
    return c.json(commitment, 201);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("COMMITMENT_CREATE_ERROR", error instanceof Error ? error.message : "Unable to create commitment"), 400);
  }
});

awareness.patch("/commitments/:commitmentId/status", requireRole("admin", "editor"), async (c) => {
  try {
    const parse = statusBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid commitment status"), 400);
    const commitment = await getCommitment(c.env.POP_BRIEF_DB, c.req.param("commitmentId"));
    if (!commitment) return c.json(errJson("COMMITMENT_NOT_FOUND", "Commitment not found"), 404);
    await requireAwarenessRecordAccess(c, {
      property_id: commitment.property_id,
      region_id: commitment.region_id,
      action: "interact_captain",
    });
    await updateCommitmentStatus(c.env.POP_BRIEF_DB, commitment.commitment_id, parse.data.status as CommitmentStatus, c.get("user").id);
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("COMMITMENT_STATUS_ERROR", error instanceof Error ? error.message : "Unable to update commitment"), 400);
  }
});

awareness.get("/regions/:regionId/summary", requireRole("admin", "editor"), async (c) => {
  try {
    const regionId = decodeURIComponent(c.req.param("regionId"));
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "access_region_scope", region: regionId });
    return c.json(await getRegionalAwarenessSummary(c.env.POP_BRIEF_DB, regionId) ?? { items: [] });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("REGIONAL_AWARENESS_ERROR", error instanceof Error ? error.message : "Unable to load regional awareness"), 500);
  }
});

awareness.get("/properties/:propertyId/regional-awareness", requireRole("admin", "editor"), async (c) => {
  try {
    const propertyId = c.req.param("propertyId");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "view_property", propertyRef: propertyId });
    const agent = await ensureCaptainAgentForProperty(c.env.POP_BRIEF_DB, { property_id: propertyId });
    if (!agent.assigned_region_id) return c.json({ items: [] });
    return c.json(await getRegionalAwarenessSummary(c.env.POP_BRIEF_DB, agent.assigned_region_id) ?? { items: [] });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("PROPERTY_REGIONAL_AWARENESS_ERROR", error instanceof Error ? error.message : "Unable to load property regional awareness"), 500);
  }
});

awareness.post("/reflection-runs", requireRole("admin", "editor"), async (c) => {
  try {
    const parse = reflectionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid reflection request"), 400);
    if (parse.data.property_id) {
      await requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "view_memory_candidates", propertyRef: parse.data.property_id, correlationId: parse.data.correlation_id ?? null });
    }
    return c.json(await runReflectionRoutine(c.env.POP_BRIEF_DB, {
      routine_type: parse.data.routine_type,
      property_id: parse.data.property_id ?? null,
      agent_id: parse.data.agent_id ?? null,
      actor: c.get("user").id,
      correlation_id: parse.data.correlation_id ?? null,
    }), 201);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("REFLECTION_RUN_ERROR", error instanceof Error ? error.message : "Unable to run reflection routine"), 400);
  }
});

awareness.get("/memory/:memoryId", requireRole("admin", "editor"), async (c) => {
  try {
    const memory = await getMemoryItem(c.env.POP_BRIEF_DB, c.req.param("memoryId"));
    if (!memory) return c.json(errJson("MEMORY_NOT_FOUND", "Memory not found"), 404);
    const result = await evaluateMemoryUse(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      memory,
      requested_use: (c.req.query("use") ?? "historical_review") as MemoryAllowedUse,
    });
    if (!result.allowed) return c.json(errJson("MEMORY_NOT_FOUND", "Memory not found"), 404);
    return c.json({ memory, governance: result });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return accessDenied(c, error);
    return c.json(errJson("MEMORY_LOOKUP_ERROR", error instanceof Error ? error.message : "Unable to load memory"), 500);
  }
});

export { awareness };

function accessDenied(c: any, error: PropertyAccessDeniedError) {
  return c.json(errJson("PROPERTY_ACCESS_DENIED", error.result.reason), 403);
}

async function requireAwarenessRecordAccess(c: any, input: {
  property_id?: string | null;
  region_id?: string | null;
  action: "interact_captain" | "view_memory_candidates";
}) {
  if (input.property_id) {
    return requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: input.action, propertyRef: input.property_id });
  }
  if (input.region_id) {
    return requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "access_region_scope", region: input.region_id });
  }
  return requirePropertyAccess(c.env.POP_BRIEF_DB, { actor: c.get("user"), action: "access_fleet_scope" });
}
