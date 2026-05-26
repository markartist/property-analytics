import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireOfferingAction } from "../lib/permissions";
import { queryAll } from "../lib/db";
import { CURRENT_DIRECTIVE_PROFILES } from "../platform/directives/seed";
import {
  getActiveDirective,
  getDirectiveProfileRow,
  getDirectiveVersionByStatus,
  listDirectiveProfiles,
  seedCurrentDirectives,
  versionRowToDirective,
} from "../platform/directives/repository";
import { validateDirectiveProfile } from "../platform/directives/validation";
import { resolveRuntimeDirective } from "../platform/directives/resolver";
import {
  activateDirective,
  approveDirective,
  createDirectiveDraft,
  rejectDirective,
  retireDirective,
  rollbackDirective,
  submitDirectiveForReview,
} from "../platform/directives/workflow";
import { DIRECTIVE_SIMULATION_FIXTURES, runDirectiveSimulation } from "../platform/directives/simulation";

const directives = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
directives.use("*", requireAuth);

const DraftBody = z.object({
  patch: z.record(z.unknown()),
  change_reason: z.string().min(1),
});

const ReasonBody = z.object({
  reason: z.string().min(1),
});

const ResolveBody = z.object({
  role_id: z.string().min(1),
  property_id: z.string().optional().nullable(),
  report_family: z.string().optional().nullable(),
  runtime_mode: z.enum(["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"]),
  as_of_date: z.string().min(1),
  include_snapshot: z.boolean().optional(),
});

const SimulationBody = z.object({
  role_id: z.string().min(1),
  draft_version_id: z.string().optional().nullable(),
  sample_property_case: z.record(z.unknown()),
  sample_source_freshness_state: z.record(z.unknown()),
  sample_evidence_packet: z.record(z.unknown()),
  report_family: z.string().optional().nullable(),
  runtime_mode: z.literal("simulation").default("simulation"),
  scenario_key: z.string().min(1),
});

type DirectiveRouteContext = Context<{ Bindings: Env; Variables: AuthVariables }>;

function actor(c: DirectiveRouteContext) {
  return c.get("user")?.email ?? c.get("user")?.id ?? "directive_control_center";
}

function errorResponse(c: DirectiveRouteContext, error: unknown, status: ContentfulStatusCode = 400) {
  return c.json(
    {
      error: {
        code: "DIRECTIVE_CONTROL_CENTER_ERROR",
        message: error instanceof Error ? error.message : String(error),
        details: [],
      },
    },
    status
  );
}

directives.get("/profiles", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  const rows = await listDirectiveProfiles(c.env.POP_BRIEF_DB);
  return c.json({
    profiles: rows.map(({ profile, activeVersion }) => ({
      profile,
      active_version: activeVersion,
      active_directive: activeVersion ? versionRowToDirective(profile, activeVersion) : null,
    })),
  });
});

directives.post("/seed", requireOfferingAction("directiveControlCenter", "administer"), async (c) => {
  const result = await seedCurrentDirectives(c.env.POP_BRIEF_DB, CURRENT_DIRECTIVE_PROFILES);
  return c.json(result, 201);
});

directives.get("/fixtures", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  return c.json({ fixtures: DIRECTIVE_SIMULATION_FIXTURES });
});

directives.get("/profiles/:roleId/active", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  const active = await getActiveDirective(c.env.POP_BRIEF_DB, c.req.param("roleId"));
  if (!active) return errorResponse(c, new Error("Directive profile not found."), 404);
  return c.json(active);
});

directives.get("/profiles/:roleId/versions", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  const profile = await getDirectiveProfileRow(c.env.POP_BRIEF_DB, c.req.param("roleId"));
  if (!profile) return errorResponse(c, new Error("Directive profile not found."), 404);
  const versions = await queryAll(
    c.env.POP_BRIEF_DB,
    `SELECT * FROM directive_versions WHERE profile_id = ? ORDER BY version DESC`,
    [profile.profile_id]
  );
  return c.json({ profile, versions });
});

directives.get("/profiles/:roleId/draft", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  const draft = await getDirectiveVersionByStatus(c.env.POP_BRIEF_DB, c.req.param("roleId"), "draft");
  return c.json({ draft });
});

directives.post("/profiles/:roleId/drafts", requireOfferingAction("directiveControlCenter", "draft"), async (c) => {
  try {
    const body = DraftBody.parse(await c.req.json());
    const draft = await createDirectiveDraft(c.env.POP_BRIEF_DB, c.req.param("roleId"), body.patch as any, actor(c), body.change_reason);
    return c.json(draft, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/profiles/:roleId/submit", requireOfferingAction("directiveControlCenter", "draft"), async (c) => {
  try {
    const body = ReasonBody.parse(await c.req.json());
    return c.json(await submitDirectiveForReview(c.env.POP_BRIEF_DB, c.req.param("roleId"), actor(c), body.reason));
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/change-requests/:requestId/approve", requireOfferingAction("directiveControlCenter", "approve"), async (c) => {
  try {
    const body = ReasonBody.parse(await c.req.json());
    return c.json(await approveDirective(c.env.POP_BRIEF_DB, c.req.param("requestId"), actor(c), body.reason));
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/change-requests/:requestId/reject", requireOfferingAction("directiveControlCenter", "approve"), async (c) => {
  try {
    const body = ReasonBody.parse(await c.req.json());
    await rejectDirective(c.env.POP_BRIEF_DB, c.req.param("requestId"), actor(c), body.reason);
    return c.json({ ok: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/profiles/:roleId/activate/:versionId", requireOfferingAction("directiveControlCenter", "approve"), async (c) => {
  try {
    const body = ReasonBody.parse(await c.req.json());
    return c.json(await activateDirective(c.env.POP_BRIEF_DB, c.req.param("roleId"), c.req.param("versionId"), actor(c), body.reason));
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/profiles/:roleId/retire", requireOfferingAction("directiveControlCenter", "approve"), async (c) => {
  try {
    const body = ReasonBody.parse(await c.req.json());
    await retireDirective(c.env.POP_BRIEF_DB, c.req.param("roleId"), actor(c), body.reason);
    return c.json({ ok: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/profiles/:roleId/rollback/:version", requireOfferingAction("directiveControlCenter", "rollback"), async (c) => {
  try {
    const body = ReasonBody.parse(await c.req.json());
    await rollbackDirective(c.env.POP_BRIEF_DB, c.req.param("roleId"), Number(c.req.param("version")), actor(c), body.reason);
    return c.json({ ok: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/validate/:roleId", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  try {
    const active = await getActiveDirective(c.env.POP_BRIEF_DB, c.req.param("roleId"));
    if (!active) return errorResponse(c, new Error("Directive profile not found."), 404);
    return c.json(await validateDirectiveProfile(c.env.POP_BRIEF_DB, active.directive, { versionId: active.version.version_id, actor: actor(c), persist: true }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/resolve", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  try {
    const body = ResolveBody.parse(await c.req.json());
    return c.json(await resolveRuntimeDirective(c.env.POP_BRIEF_DB, { ...body, actor: actor(c) }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.post("/simulate", requireOfferingAction("directiveControlCenter", "draft"), async (c) => {
  try {
    const body = SimulationBody.parse(await c.req.json());
    return c.json(await runDirectiveSimulation(c.env.POP_BRIEF_DB, { ...body, actor: actor(c) }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

directives.get("/audit", requireOfferingAction("directiveControlCenter", "view"), async (c) => {
  const roleId = c.req.query("role_id");
  const rows = await queryAll(
    c.env.POP_BRIEF_DB,
    roleId
      ? `SELECT * FROM directive_audit_events WHERE role_id = ? ORDER BY timestamp DESC LIMIT 200`
      : `SELECT * FROM directive_audit_events ORDER BY timestamp DESC LIMIT 200`,
    roleId ? [roleId] : []
  );
  return c.json({ events: rows });
});

export { directives };
