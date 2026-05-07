import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAuditLog } from "../lib/audit";
import { errJson } from "../lib/validate";
import {
  createCaptainBriefRun,
  getCaptainCommandCenter,
  getCaptainRoster,
  getLatestCaptainBriefRead,
  getCaptainStatus,
  runCaptainAgents,
} from "../platform/captain/runtime";

const captain = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
captain.use("*", requireAuth);

const RunBody = z.object({
  agent_key: z.string().min(1).optional(),
  run_type: z.enum(["manual", "scheduled", "brief"]).default("manual"),
});

const BriefBody = z.object({
  brief_type: z.enum(["captain_brief", "supervisor_read"]).default("captain_brief"),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

captain.get("/roster", async (c) => {
  try {
    return c.json(await getCaptainRoster(c.env.POP_BRIEF_DB));
  } catch (error) {
    return c.json(errJson("CAPTAIN_ROSTER_ERROR", error instanceof Error ? error.message : "Unable to load Captain roster"), 500);
  }
});

captain.get("/properties/:propertyId/status", async (c) => {
  try {
    return c.json(await getCaptainStatus(c.env.POP_BRIEF_DB, c.req.param("propertyId")));
  } catch (error) {
    return c.json(errJson("CAPTAIN_STATUS_ERROR", error instanceof Error ? error.message : "Unable to load Captain status"), 500);
  }
});

captain.get("/properties/:propertyId/command-center", async (c) => {
  try {
    return c.json(await getCaptainCommandCenter(c.env.POP_BRIEF_DB, c.req.param("propertyId")));
  } catch (error) {
    return c.json(errJson("CAPTAIN_COMMAND_CENTER_ERROR", error instanceof Error ? error.message : "Unable to load Captain command center"), 500);
  }
});

captain.get("/properties/:propertyId/brief/latest", async (c) => {
  try {
    return c.json(await getLatestCaptainBriefRead(c.env.POP_BRIEF_DB, c.req.param("propertyId")));
  } catch (error) {
    return c.json(errJson("CAPTAIN_BRIEF_READ_ERROR", error instanceof Error ? error.message : "Unable to load Captain brief read"), 500);
  }
});

captain.post("/properties/:propertyId/run", requireRole("admin", "editor"), async (c) => {
  try {
    const parse = RunBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Captain run payload"), 400);
    }
    const actor = c.get("user");
    const result = await runCaptainAgents(c.env.POP_BRIEF_DB, c.req.param("propertyId"), {
      agentKey: parse.data.agent_key,
      runType: parse.data.run_type,
      actorId: actor.id,
    });
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "captain.agent.run",
      entityType: "captain_runtime",
      entityId: result.propertyCode,
      after: result,
    });
    return c.json(result);
  } catch (error) {
    return c.json(errJson("CAPTAIN_RUN_ERROR", error instanceof Error ? error.message : "Unable to run Captain agents"), 500);
  }
});

captain.post("/properties/:propertyId/brief", requireRole("admin", "editor"), async (c) => {
  try {
    const parse = BriefBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) {
      return c.json(errJson("VALIDATION_ERROR", parse.error.issues[0]?.message ?? "Invalid Captain brief payload"), 400);
    }
    const actor = c.get("user");
    const briefRun = await createCaptainBriefRun(c.env.POP_BRIEF_DB, c.req.param("propertyId"), {
      briefType: parse.data.brief_type,
      periodStart: parse.data.period_start ?? null,
      periodEnd: parse.data.period_end ?? null,
      actorId: actor.id,
    });
    await writeAuditLog(c.env.POP_BRIEF_DB, {
      actorUserId: actor.id,
      action: "captain.brief.create",
      entityType: "captain_brief_run",
      entityId: String(briefRun?.id ?? c.req.param("propertyId")),
      after: briefRun,
    });
    return c.json({ briefRun }, 201);
  } catch (error) {
    return c.json(errJson("CAPTAIN_BRIEF_ERROR", error instanceof Error ? error.message : "Unable to create Captain brief run"), 500);
  }
});

export { captain };
