import { Hono } from "hono";
import { z } from "zod";
import {
  CreateEvsValidationRequestPayload,
  EvsEnvironment,
  EvsRequestHandoffPayload,
  EvsRawExecutionPayload,
  EvsValidationRequest,
} from "../../../../packages/shared/src";
import type { EvsRequestRecord } from "../../../../packages/shared/src";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";
import { requireOfferingAction } from "../lib/permissions";
import { hasServiceAuthConfig, resolveServiceAccessMode } from "../lib/service-auth";
import { AppError, errJson } from "../lib/validate";
import { normalizeExecutionResult } from "../evs/normalization";
import { getPilotProperty } from "../evs/pilot-properties";
import { getProfileDefinition } from "../evs/profiles";
import {
  buildPropertyAdvocatePayload,
  createBatch,
  createBatchTarget,
  createRequest,
  getBatchDetail,
  getEvaluationSetByKey,
  getLatestResultForRequest,
  getRequest,
  listBatches,
  listEvaluationSets,
  listProperties,
  listRequests,
  markRequestStatus,
  recordRequestHandoff,
  saveNormalizedResult,
} from "../evs/repository";
import { resolveProviderAdapter } from "../evs/providers";

const evs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function toValidationRequest(record: EvsRequestRecord) {
  return EvsValidationRequest.parse({
    request_id: record.request_id,
    source_consumer: record.source_consumer,
    property_id: record.property_id,
    environment: record.environment,
    reason: record.reason,
    priority: record.priority,
    target_pages: record.target_pages,
    validation_profiles: record.validation_profiles,
    device_profiles: record.device_profiles,
    governance_context: record.governance_context ?? undefined,
    execution_mode: record.execution_mode,
    trigger_metadata: record.trigger_metadata,
  });
}

function deriveDispatchState(record: EvsRequestRecord) {
  if (record.status === "completed") return "completed" as const;
  if (record.status === "failed") return "failed" as const;
  if (record.status === "cancelled") return "cancelled" as const;
  if (record.status === "running") return "executing" as const;
  if (record.orchestrator_ref) return "handoff_recorded" as const;
  return "awaiting_handoff" as const;
}

function toRuntimeView(record: EvsRequestRecord) {
  return {
    ...record,
    dispatch_state: deriveDispatchState(record),
  };
}

function buildExecutionPlanForRecord(record: EvsRequestRecord) {
  const request = toValidationRequest(record);
  const property = getPilotProperty(record.property_id);
  if (!property) {
    throw new AppError(404, "NOT_FOUND", "Pilot property not found for EVS request");
  }
  const provider = resolveProviderAdapter();
  return provider.buildExecutionPlan(
    request,
    property,
    request.validation_profiles.map(getProfileDefinition)
  );
}

const BatchTargetPayload = z.object({
  target_url: z.string().url(),
  property_id: z.string().min(1).optional().nullable(),
  property_name: z.string().min(1).optional().nullable(),
  property_code: z.string().min(1).optional().nullable(),
  identity_status: z.enum(["resolved", "unresolved", "ambiguous", "manual"]).default("unresolved"),
  site_os_version: z.string().min(1).optional().nullable(),
  template_family: z.string().min(1).optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
}).strict();

const CreateEvsBatchPayload = z.object({
  evaluation_set_id: z.string().min(1).optional().nullable(),
  evaluation_set_key: z.string().min(1).optional().nullable(),
  name: z.string().min(1),
  environment: z.enum(["staging", "prod", "production"]).default("prod"),
  source_label: z.string().min(1).optional().nullable(),
  requested_by: z.string().min(1).optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  targets: z.array(BatchTargetPayload).min(1),
}).strict();

function normalizeEvsEnvironment(environment: "staging" | "prod" | "production"): EvsEnvironment {
  return EvsEnvironment.parse(environment === "production" ? "prod" : environment);
}

evs.use("/requests", requireAuth);
evs.use("/requests/*", requireAuth);
evs.use("/properties", requireAuth);
evs.use("/evaluation-sets", requireAuth);
evs.use("/evaluation-sets/*", requireAuth);
evs.use("/batches", requireAuth);
evs.use("/batches/*", requireAuth);
evs.use("/adapters/property-advocate/*", requireAuth);

evs.get("/properties", async (c) => {
  const properties = await listProperties(c.env.POP_BRIEF_DB);
  return c.json({ properties });
});

evs.get("/requests", async (c) => {
  const propertyId = c.req.query("property_id");
  const requests = await listRequests(c.env.POP_BRIEF_DB, propertyId);
  return c.json({ requests: requests.map(toRuntimeView) });
});

evs.get("/evaluation-sets", async (c) => {
  const evaluationSets = await listEvaluationSets(c.env.POP_BRIEF_DB);
  return c.json({ evaluation_sets: evaluationSets });
});

evs.get("/batches", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.min(Math.max(Number.parseInt(limitParam, 10) || 50, 1), 200) : 50;
  const batches = await listBatches(c.env.POP_BRIEF_DB, limit);
  return c.json({ batches });
});

evs.get("/batches/:batchId", async (c) => {
  const detail = await getBatchDetail(c.env.POP_BRIEF_DB, c.req.param("batchId"));
  if (!detail) {
    return c.json(errJson("NOT_FOUND", "EVS batch not found"), 404);
  }
  return c.json(detail);
});

evs.post("/batches", requireOfferingAction("evs", "draft"), async (c) => {
  const parsed = CreateEvsBatchPayload.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid EVS batch payload", parsed.error.issues), 400);
  }

  const payload = parsed.data;
  let evaluationSetId = payload.evaluation_set_id ?? null;
  if (!evaluationSetId && payload.evaluation_set_key) {
    const evaluationSet = await getEvaluationSetByKey(c.env.POP_BRIEF_DB, payload.evaluation_set_key);
    if (!evaluationSet) {
      return c.json(errJson("NOT_FOUND", "EVS evaluation set not found"), 404);
    }
    evaluationSetId = evaluationSet.evaluation_set_id;
  }

  const batch = await createBatch(c.env.POP_BRIEF_DB, {
    evaluation_set_id: evaluationSetId,
    name: payload.name,
    environment: normalizeEvsEnvironment(payload.environment),
    source_label: payload.source_label ?? payload.evaluation_set_key ?? null,
    input_urls: payload.targets.map((target) => target.target_url),
    requested_by: payload.requested_by ?? c.get("user").email,
    metadata: payload.metadata,
  });

  for (const target of payload.targets) {
    await createBatchTarget(c.env.POP_BRIEF_DB, {
      batch_id: batch.batch_id,
      property_id: target.property_id ?? null,
      property_name: target.property_name ?? null,
      property_code: target.property_code ?? null,
      target_url: target.target_url,
      identity_status: target.identity_status,
      site_os_version: target.site_os_version ?? null,
      template_family: target.template_family ?? null,
      metadata: target.metadata,
    });
  }

  const detail = await getBatchDetail(c.env.POP_BRIEF_DB, batch.batch_id);
  if (!detail) {
    throw new AppError(500, "INTERNAL_ERROR", "EVS batch disappeared after creation");
  }
  return c.json(detail, 201);
});

evs.post("/requests", requireOfferingAction("evs", "draft"), async (c) => {
  const parsed = CreateEvsValidationRequestPayload.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid EVS request payload", parsed.error.issues), 400);
  }

  const payload = parsed.data;
  if (payload.environment !== "staging") {
    return c.json(errJson("VALIDATION_ERROR", "EVS MVP only supports staging execution targets"), 400);
  }

  const property = getPilotProperty(payload.property_id);
  if (!property) {
    return c.json(errJson("NOT_FOUND", "Pilot property not found"), 404);
  }

  const request = EvsValidationRequest.parse({
    ...payload,
    request_id: newId(),
    target_pages: [property.staging_url],
    trigger_metadata: {
      ...payload.trigger_metadata,
      staging_only: true,
      requested_from: "api",
    },
  });

  for (const profile of request.validation_profiles) {
    getProfileDefinition(profile);
  }

  const provider = resolveProviderAdapter();
  const executionPlan = provider.buildExecutionPlan(request, property, request.validation_profiles.map(getProfileDefinition));
  const created = await createRequest(
    c.env.POP_BRIEF_DB,
    request,
    payload.requested_by ?? c.get("user").email,
    provider.id
  );

  return c.json({
    request: toRuntimeView(created),
    execution_plan: executionPlan,
    note: "Request persisted. GitHub workflow dispatch is code-ready; credentials and dispatch token wiring are pending.",
  }, 201);
});

evs.get("/requests/:requestId", async (c) => {
  const request = await getRequest(c.env.POP_BRIEF_DB, c.req.param("requestId"));
  if (!request) {
    return c.json(errJson("NOT_FOUND", "EVS request not found"), 404);
  }
  const result = await getLatestResultForRequest(c.env.POP_BRIEF_DB, request.request_id);
  const executionPlan = buildExecutionPlanForRecord(request);
  return c.json({ request: toRuntimeView(request), result, execution_plan: executionPlan });
});

evs.post("/requests/:requestId/handoff", requireOfferingAction("evs", "handoff"), async (c) => {
  const request = await getRequest(c.env.POP_BRIEF_DB, c.req.param("requestId"));
  if (!request) {
    return c.json(errJson("NOT_FOUND", "EVS request not found"), 404);
  }
  if (request.status === "completed" || request.status === "failed" || request.status === "cancelled") {
    return c.json(errJson("CONFLICT", `Cannot hand off an EVS request in terminal status ${request.status}`), 409);
  }

  const parsed = EvsRequestHandoffPayload.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", "Invalid EVS handoff payload", parsed.error.issues), 400);
  }

  await recordRequestHandoff(
    c.env.POP_BRIEF_DB,
    request.request_id,
    parsed.data.orchestrator_ref,
    parsed.data.status,
  );
  const updated = await getRequest(c.env.POP_BRIEF_DB, request.request_id);
  if (!updated) {
    throw new AppError(500, "INTERNAL_ERROR", "EVS request disappeared after handoff update");
  }

  return c.json({
    request: toRuntimeView(updated),
    execution_plan: buildExecutionPlanForRecord(updated),
    note: "External orchestration handoff recorded. EVS can now distinguish queued requests from those accepted by an orchestrator.",
  });
});

evs.post("/ingest/:requestId", async (c) => {
  const configuredServiceAuth = {
    sharedToken: c.env.EVS_SHARED_TOKEN,
    accessClientId: c.env.EVS_ACCESS_CLIENT_ID,
    accessClientSecret: c.env.EVS_ACCESS_CLIENT_SECRET,
    accessTeamDomain: c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
  };
  if (
    hasServiceAuthConfig(configuredServiceAuth) &&
    !(await resolveServiceAccessMode(c.req.raw.headers, configuredServiceAuth))
  ) {
    return c.json(errJson("UNAUTHORIZED", "Valid EVS service credentials required"), 401);
  }

  const request = await getRequest(c.env.POP_BRIEF_DB, c.req.param("requestId"));
  if (!request) {
    return c.json(errJson("NOT_FOUND", "EVS request not found"), 404);
  }

  await markRequestStatus(c.env.POP_BRIEF_DB, request.request_id, "running");
  const body = await c.req.json();
  const raw = EvsRawExecutionPayload.parse(body);
  if (raw.request_id !== request.request_id) {
    throw new AppError(400, "VALIDATION_ERROR", "Raw execution request_id does not match route request id");
  }

  const normalizedRequest = toValidationRequest(request);
  const normalized = normalizeExecutionResult({ request: normalizedRequest, raw });
  const saved = await saveNormalizedResult(c.env.POP_BRIEF_DB, normalizedRequest, normalized);
  return c.json({ result: saved }, 201);
});

evs.get("/adapters/property-advocate/:propertyId", async (c) => {
  const payload = await buildPropertyAdvocatePayload(c.env.POP_BRIEF_DB, c.req.param("propertyId"));
  if (!payload) {
    return c.json(errJson("NOT_FOUND", "EVS property not found"), 404);
  }
  return c.json(payload);
});

export { evs };
