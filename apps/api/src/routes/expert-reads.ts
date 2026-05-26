import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { errJson } from "../lib/validate";
import { PropertyAccessDeniedError, requirePropertyAccess } from "../platform/access/property-access-control";
import { isExpertLaneId } from "../platform/expert-reads/contracts";
import { runExpertRead } from "../platform/expert-reads/orchestrator";
import { getExpertReadById, getExpertReadsForProperty } from "../platform/expert-reads/repository";
import type { ExpertLaneId } from "../platform/expert-reads/types";

const expertReads = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
expertReads.use("*", requireAuth);

const ExpertReadBody = z.object({
  property_id: z.string().min(1),
  lane_id: z.string().min(1),
  evidence_packet_id: z.string().min(1),
  runtime_mode: z.enum(["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"]).default("standard"),
  report_family: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).max(4000),
  source_runtime_id: z.string().min(1).nullable().optional(),
  source_interaction_id: z.string().min(1).nullable().optional(),
  correlation_id: z.string().min(1).nullable().optional(),
});

expertReads.post("/", requireRole("admin", "editor"), async (c) => {
  try {
    const parse = ExpertReadBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Expert Read request"), 400);
    if (!isExpertLaneId(parse.data.lane_id)) return c.json(errJson("INVALID_EXPERT_LANE", "Unknown Consulting Bench lane."), 400);
    const actor = c.get("user");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor,
      action: "request_expert_read",
      propertyRef: parse.data.property_id,
      runtimeMode: parse.data.runtime_mode,
      laneId: parse.data.lane_id,
      correlationId: parse.data.correlation_id ?? null,
    });
    const result = await runExpertRead(
      c.env.POP_BRIEF_DB,
      {
        ...parse.data,
        lane_id: parse.data.lane_id as ExpertLaneId,
        requested_by: actor.id,
      },
      c.env,
    );
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("EXPERT_READ_ERROR", error instanceof Error ? error.message : "Unable to run Expert Read"), 500);
  }
});

expertReads.get("/properties/:propertyId/:laneId", requireRole("admin", "editor"), async (c) => {
  try {
    const laneId = c.req.param("laneId");
    if (!isExpertLaneId(laneId)) return c.json(errJson("INVALID_EXPERT_LANE", "Unknown Consulting Bench lane."), 400);
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "view_expert_read",
      propertyRef: c.req.param("propertyId"),
      laneId,
    });
    const limit = Math.min(Number(c.req.query("limit") ?? 25) || 25, 100);
    return c.json({ items: await getExpertReadsForProperty(c.env.POP_BRIEF_DB, c.req.param("propertyId"), laneId, limit) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("EXPERT_READ_LANE_LOOKUP_ERROR", error instanceof Error ? error.message : "Unable to load lane Expert Reads"), 500);
  }
});

expertReads.get("/properties/:propertyId", requireRole("admin", "editor"), async (c) => {
  try {
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "view_expert_read",
      propertyRef: c.req.param("propertyId"),
    });
    const limit = Math.min(Number(c.req.query("limit") ?? 25) || 25, 100);
    return c.json({ items: await getExpertReadsForProperty(c.env.POP_BRIEF_DB, c.req.param("propertyId"), null, limit) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("EXPERT_READ_PROPERTY_LOOKUP_ERROR", error instanceof Error ? error.message : "Unable to load property Expert Reads"), 500);
  }
});

expertReads.get("/:expertReadId", requireRole("admin", "editor"), async (c) => {
  try {
    const read = await getExpertReadById(c.env.POP_BRIEF_DB, c.req.param("expertReadId"));
    if (!read) return c.json(errJson("EXPERT_READ_NOT_FOUND", "Expert Read not found"), 404);
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "view_expert_read",
      propertyRef: String(read.property_id ?? ""),
      laneId: typeof read.lane_id === "string" ? read.lane_id : null,
    });
    return c.json(read);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error, { maskAsNotFound: true });
    return c.json(errJson("EXPERT_READ_LOOKUP_ERROR", error instanceof Error ? error.message : "Unable to load Expert Read"), 500);
  }
});

export { expertReads };

function propertyAccessDenied(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  error: PropertyAccessDeniedError,
  options?: { maskAsNotFound?: boolean }
) {
  if (options?.maskAsNotFound) return c.json(errJson("EXPERT_READ_NOT_FOUND", "Expert Read not found"), 404);
  const code = error.result.scope === "runtime_mode" ? "FORBIDDEN_RUNTIME_MODE" :
    error.result.scope === "lane" ? "FORBIDDEN_EXPERT_LANE" :
    "PROPERTY_ACCESS_DENIED";
  return c.json(errJson(code, error.result.reason), 403);
}
