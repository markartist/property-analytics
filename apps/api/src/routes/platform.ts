import { Hono } from "hono";
import type { Context } from "hono";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { hasServiceAuthConfig, resolveServiceAccessMode } from "../lib/service-auth";
import { AppError, errJson } from "../lib/validate";
import { createNoiseBudgetSummaryService } from "../platform/agent-runtime/noise-budget-summary";
import { createMirrorIntakeService } from "../platform/mirror/intake-service";
import { createMirrorReconciliationService } from "../platform/mirror/reconciliation-service";
import { createActivationService } from "../platform/mirror/activation-service";
import { createPipelineHealthBuilder } from "../platform/pipeline-health/builder";
import { createExecutionSnapshotBuilder } from "../platform/execution-snapshots/builder";
import { createAgentRuntimeGateway } from "../platform/agent-runtime/gateway";
import { createLifecycleEngine } from "../platform/lifecycle/engine";
import { runPropertyAdvocateFlow } from "../platform/orchestration/property-advocate-runner";
import { runScheduledResiEdgeHeroFreshnessSync } from "../platform/resi-edge/hero-freshness-sync";

type PlatformVariables = AuthVariables & {
  platformRequestId: string;
  platformActorTag: string;
  platformSourceTag: string;
  platformAccessMode: "access_service_token" | "shared_token" | "session";
  platformStartTime: number;
};

type PlatformContext = Context<{ Bindings: Env; Variables: PlatformVariables }>;

const platform = new Hono<{ Bindings: Env; Variables: PlatformVariables }>();

function platformActorTagFromHeaders(
  actorHeader: string | undefined,
  accessMode: "access_service_token" | "shared_token" | "session"
) {
  if (actorHeader?.trim()) {
    return actorHeader.trim();
  }
  if (accessMode === "access_service_token") {
    return "access_service_token";
  }
  return accessMode === "shared_token" ? "shared_token" : "session_user";
}

function logPlatformEvent(
  level: "info" | "warn" | "error",
  payload: Record<string, unknown>
) {
  const line = JSON.stringify({ component: "platform_route", ...payload });
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

function responseMeta(c: PlatformContext) {
  return {
    requestId: c.get("platformRequestId"),
    actorTag: c.get("platformActorTag"),
    sourceTag: c.get("platformSourceTag"),
  };
}

function okJson(c: PlatformContext, status: number, result: unknown) {
  c.header("x-request-id", c.get("platformRequestId"));
  return c.json({ meta: responseMeta(c), result }, status as any);
}

const withPlatformRequestContext: MiddlewareHandler<{ Bindings: Env; Variables: PlatformVariables }> = async (
  c,
  next
) => {
  const requestId = c.req.header("x-request-id")?.trim() || crypto.randomUUID();
  const sourceTag = c.req.header("x-platform-source")?.trim() || "unknown";
  c.set("platformRequestId", requestId);
  c.set("platformSourceTag", sourceTag);
  c.set("platformStartTime", Date.now());
  c.set("platformActorTag", c.req.header("x-platform-actor")?.trim() || "unknown");
  c.set("platformAccessMode", "session");
  c.header("x-request-id", requestId);

  await next();

  const actorTag = c.get("platformActorTag") ?? "unknown";
  const accessMode = c.get("platformAccessMode") ?? "session";
  const status = c.res.status;
  const durationMs = Date.now() - c.get("platformStartTime");
  if (status >= 400) {
    logPlatformEvent(status >= 500 ? "error" : "warn", {
      requestId,
      actorTag,
      sourceTag,
      accessMode,
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs,
    });
  }
};

const requirePlatformAccess: MiddlewareHandler<{ Bindings: Env; Variables: PlatformVariables }> = async (
  c,
  next
) => {
  const configuredServiceAuth = {
    sharedToken: c.env.PLATFORM_SHARED_TOKEN,
    accessClientId: c.env.PLATFORM_ACCESS_CLIENT_ID,
    accessClientSecret: c.env.PLATFORM_ACCESS_CLIENT_SECRET,
    accessTeamDomain: c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
  };
  const serviceAccessMode = await resolveServiceAccessMode(c.req.raw.headers, configuredServiceAuth);
  if (serviceAccessMode) {
    c.set("platformAccessMode", serviceAccessMode);
    c.set("platformActorTag", platformActorTagFromHeaders(c.req.header("x-platform-actor"), serviceAccessMode));
    await next();
    return;
  }
  const authResponse = await requireAuth(c as any, async () => undefined);
  if (authResponse) {
    return c.json(
      {
        ...errJson(
          "UNAUTHORIZED",
          hasServiceAuthConfig(configuredServiceAuth)
            ? "Authentication required or valid service credentials required"
            : "Authentication required",
          []
        ),
        meta: responseMeta(c),
      },
      401
    );
  }
  const user = c.get("user");
  if (!user || !["admin", "editor"].includes(user.role)) {
    return c.json(
      {
        ...errJson("FORBIDDEN", "Requires one of: admin, editor"),
        meta: responseMeta(c),
      },
      403
    );
  }
  c.set("platformAccessMode", "session");
  c.set("platformActorTag", c.req.header("x-platform-actor")?.trim() || `user:${user.id}`);
  await next();
};

function serviceErrorResponse(c: PlatformContext, error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        ...errJson(error.code, error.message, Array.isArray(error.details) ? error.details : [error.details]),
        meta: responseMeta(c),
      },
    };
  }
  return {
    status: 500,
    body: {
      ...errJson("INTERNAL_ERROR", error instanceof Error ? error.message : "Unexpected platform error"),
      meta: responseMeta(c),
    },
  };
}

platform.use("*", withPlatformRequestContext);
platform.use("*", requirePlatformAccess);

platform.post("/mirror/intake", async (c) => {
  try {
    const service = createMirrorIntakeService(c.env.POP_BRIEF_DB);
    const result = await service.ingest(await c.req.json());
    return okJson(c, 201, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/mirror/reconcile", async (c) => {
  try {
    const service = createMirrorReconciliationService(c.env.POP_BRIEF_DB);
    const result = await service.reconcile(await c.req.json());
    return okJson(c, 200, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/mirror/activate", async (c) => {
  try {
    const service = createActivationService(c.env.POP_BRIEF_DB);
    const result = await service.activate(await c.req.json());
    return okJson(c, 200, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/pipeline-health/build", async (c) => {
  try {
    const service = createPipelineHealthBuilder(c.env.POP_BRIEF_DB);
    const result = await service.build(await c.req.json());
    return okJson(c, 201, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/resi-edge/hero-freshness/sync", async (c) => {
  try {
    const result = await runScheduledResiEdgeHeroFreshnessSync(c.env, new Date());
    return okJson(c, 200, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/execution-snapshots", async (c) => {
  try {
    const service = createExecutionSnapshotBuilder(c.env.POP_BRIEF_DB);
    const result = await service.create(await c.req.json());
    return okJson(c, 201, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/agent-runtime/start", async (c) => {
  try {
    const service = createAgentRuntimeGateway(c.env.POP_BRIEF_DB);
    const result = await service.start(await c.req.json());
    return okJson(c, 201, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/lifecycle/emit", async (c) => {
  try {
    const service = createLifecycleEngine(c.env.POP_BRIEF_DB);
    const result = await service.emit(await c.req.json());
    return okJson(c, 201, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.post("/property-advocate/run", async (c) => {
  try {
    const payload = (await c.req.json()) as {
      propertyId: string;
      agentId: string;
      contractBundleId: string;
      executionPolicyId: string;
      requestedBy: string;
      operatorId?: string | null;
      triggerType: string;
      triggerSource: string;
      triggerReferenceId?: string | null;
    };
    const result = await runPropertyAdvocateFlow(c.env.POP_BRIEF_DB, payload);
    return okJson(c, 201, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

platform.get("/agents/:agentId/noise-budget-summary", async (c) => {
  try {
    const service = createNoiseBudgetSummaryService(c.env.POP_BRIEF_DB);
    const result = await service.getSummary({
      agentId: c.req.param("agentId"),
      day: c.req.query("day") ?? null,
    });
    return okJson(c, 200, result);
  } catch (error) {
    const response = serviceErrorResponse(c, error);
    return c.json(response.body, response.status as any);
  }
});

export { platform };
