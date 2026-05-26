import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { errJson } from "../lib/validate";
import { PropertyAccessDeniedError, requirePropertyAccess } from "../platform/access/property-access-control";
import { runCaptainRuntimeInteraction } from "../platform/captain-runtime/orchestrator";
import {
  getCaptainMemoryCandidates,
  getCaptainOfficeState,
  getCaptainRuntimeEvidencePackets,
  getCaptainRuntimeHistory,
} from "../platform/captain-runtime/repository";

const captainRuntime = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
captainRuntime.use("*", requireAuth);

const InteractionBody = z.object({
  property_id: z.string().min(1),
  input_text: z.string().min(1).max(8000),
  input_type: z.enum(["text", "system_event", "file_note"]).default("text"),
  runtime_mode: z.enum(["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"]).default("standard"),
  actor: z.enum(["user", "captain", "system", "bench", "fleet_scribe"]).default("user"),
  report_family: z.string().min(1).nullable().optional(),
  correlation_id: z.string().min(1).nullable().optional(),
  idempotency_key: z.string().min(1).max(160).nullable().optional(),
});

captainRuntime.post("/interactions", requireRole("admin", "editor"), async (c) => {
  try {
    const parse = InteractionBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Captain runtime payload"), 400);
    }
    const actor = c.get("user");
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor,
      action: "interact_captain",
      propertyRef: parse.data.property_id,
      runtimeMode: parse.data.runtime_mode,
      correlationId: parse.data.correlation_id ?? null,
    });
    const result = await runCaptainRuntimeInteraction(
      c.env.POP_BRIEF_DB,
      {
        ...parse.data,
        user_id: actor.id,
      },
      c.env,
    );
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("CAPTAIN_RUNTIME_ERROR", error instanceof Error ? error.message : "Unable to run Captain runtime interaction"), 500);
  }
});

captainRuntime.get("/properties/:propertyId/office", requireRole("admin", "editor"), async (c) => {
  try {
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "operate_captain_office",
      propertyRef: c.req.param("propertyId"),
    });
    const state = await getCaptainOfficeState(c.env.POP_BRIEF_DB, c.req.param("propertyId"));
    if (!state) {
      return c.json(errJson("PROPERTY_NOT_FOUND", "Unable to resolve property context for Captain’s Office"), 404);
    }
    return c.json(state);
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("CAPTAIN_OFFICE_ERROR", error instanceof Error ? error.message : "Unable to load Captain’s Office"), 500);
  }
});

captainRuntime.get("/properties/:propertyId/history", requireRole("admin", "editor"), async (c) => {
  try {
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "view_runtime_history",
      propertyRef: c.req.param("propertyId"),
    });
    const limit = Math.min(Number(c.req.query("limit") ?? 25) || 25, 100);
    return c.json({ items: await getCaptainRuntimeHistory(c.env.POP_BRIEF_DB, c.req.param("propertyId"), limit) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("CAPTAIN_HISTORY_ERROR", error instanceof Error ? error.message : "Unable to load Captain Runtime history"), 500);
  }
});

captainRuntime.get("/properties/:propertyId/evidence", requireRole("admin", "editor"), async (c) => {
  try {
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "view_evidence_lineage",
      propertyRef: c.req.param("propertyId"),
    });
    const limit = Math.min(Number(c.req.query("limit") ?? 10) || 10, 50);
    return c.json({ items: await getCaptainRuntimeEvidencePackets(c.env.POP_BRIEF_DB, c.req.param("propertyId"), limit) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("CAPTAIN_EVIDENCE_ERROR", error instanceof Error ? error.message : "Unable to load Captain Runtime evidence"), 500);
  }
});

captainRuntime.get("/properties/:propertyId/memory-candidates", requireRole("admin", "editor"), async (c) => {
  try {
    await requirePropertyAccess(c.env.POP_BRIEF_DB, {
      actor: c.get("user"),
      action: "view_memory_candidates",
      propertyRef: c.req.param("propertyId"),
    });
    const limit = Math.min(Number(c.req.query("limit") ?? 25) || 25, 100);
    return c.json({ items: await getCaptainMemoryCandidates(c.env.POP_BRIEF_DB, c.req.param("propertyId"), limit) });
  } catch (error) {
    if (error instanceof PropertyAccessDeniedError) return propertyAccessDenied(c, error);
    return c.json(errJson("CAPTAIN_MEMORY_CANDIDATES_ERROR", error instanceof Error ? error.message : "Unable to load Captain memory candidates"), 500);
  }
});

export { captainRuntime };

function propertyAccessDenied(c: Context<{ Bindings: Env; Variables: AuthVariables }>, error: PropertyAccessDeniedError) {
  const code = error.result.scope === "runtime_mode" ? "FORBIDDEN_RUNTIME_MODE" : "PROPERTY_ACCESS_DENIED";
  return c.json(errJson(code, error.result.reason), 403);
}
