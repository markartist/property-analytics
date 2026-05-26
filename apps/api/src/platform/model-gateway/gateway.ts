import type { Env } from "../../env";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { sha256Hex } from "../directives/hashing";
import { ensureModelGatewayTables, getModelGatewayUsageSnapshot, insertModelGatewayPayload, insertModelGatewayRequest, insertModelGatewayResponse, insertModelGatewayShadowResult, writeModelGatewayAuditEvent } from "./audit";
import { loadModelGatewayConfig, validateModelGatewayConfig } from "./config";
import { minimizeAndRedactPayload } from "./redaction";
import { compareShadowOutputs, runModelGatewayGovernancePostCheck, validateStructuredOutputContract } from "./validation";
import { CloudflareAIGatewayAdapter } from "./adapters/cloudflare-ai-gateway";
import { DeterministicAdapter } from "./adapters/deterministic";
import { NoopAdapter } from "./adapters/noop";
import { ShadowModeAdapter } from "./adapters/shadow-mode";
import type {
  GovernancePostCheckResult,
  ModelGatewayAuditEvent,
  ModelGatewayExecutionInput,
  ModelGatewayExecutionResult,
  ModelGatewayPayload,
  ModelGatewayRequest,
  ModelGatewayResponse,
  ModelGatewayShadowResultRecord,
  ModelGatewayValidationResult,
  ModelProviderAdapter,
} from "./types";

export async function executeModelGateway<TStructured>(
  db: D1Database,
  env: Partial<Env> | Partial<Record<string, string | undefined>> | undefined,
  input: ModelGatewayExecutionInput<TStructured>,
): Promise<ModelGatewayExecutionResult<TStructured>> {
  await ensureModelGatewayTables(db);
  const config = loadModelGatewayConfig(env);
  const auditEvents: ModelGatewayAuditEvent[] = [];
  const payloadHash = input.payload.payload_hash ?? await sha256Hex(input.payload);
  const request: ModelGatewayRequest = {
    ...input.request,
    payload_hash: payloadHash,
    provider_route: input.request.provider_route ?? config.defaultAdapter,
    adapter_id: input.request.adapter_id ?? config.defaultAdapter,
    model_id: input.request.model_id ?? config.cloudflare.model,
    allowed_output_contract: input.outputContract,
  };
  const payload: ModelGatewayPayload = {
    ...input.payload,
    request_id: request.request_id,
    payload_hash: payloadHash,
    redaction_summary: {},
    estimated_tokens: input.payload.estimated_tokens ?? estimatePayloadTokens(input.payload),
  };
  await insertModelGatewayRequest(db, request);
  auditEvents.push(await writeAudit(db, request, {
    event_type: "model_gateway.request_created",
    decision: "created",
    reason: "Model gateway request recorded.",
    before_state: null,
    after_state: { request_id: request.request_id, contract: request.allowed_output_contract },
  }));

  const configValidation = validateModelGatewayConfig(env, config);
  if (!configValidation.valid) {
    return failClosed(db, request, payload, auditEvents, input, `Model Provider Gateway configuration is unsafe: ${configValidation.errors.join("; ")}`);
  }
  if (!config.allowedSourceSystems.includes(request.source_system)) {
    return failClosed(db, request, payload, auditEvents, input, "Requested source system is not allowed by Model Provider Gateway policy.");
  }
  if (!config.allowedRuntimeModes.includes(request.runtime_mode)) {
    return failClosed(db, request, payload, auditEvents, input, "Requested runtime mode is not allowed by Model Provider Gateway policy.");
  }
  if (!request.directive_snapshot_id || !request.directive_snapshot_hash) {
    return failClosed(db, request, payload, auditEvents, input, "Directive snapshot id/hash are required.");
  }
  if (!request.evidence_packet_id || !request.evidence_packet_hash) {
    return failClosed(db, request, payload, auditEvents, input, "Evidence packet id/hash are required.");
  }

  const redaction = await minimizeAndRedactPayload(payload);
  if (config.storeRedactedPayload) {
    await insertModelGatewayPayload(db, redaction.redactedPayload, redaction.redactedPayloadHash);
  }
  auditEvents.push(await writeAudit(db, request, {
    event_type: "model_gateway.payload_redacted",
    decision: "redacted",
    reason: "Payload minimization and redaction completed.",
    before_state: { payload_hash: payload.payload_hash },
    after_state: redaction.summary,
    payload_hash: payload.payload_hash,
    redacted_payload_hash: redaction.redactedPayloadHash,
  }));

  if (redaction.redactedPayload.estimated_tokens > config.maxInputTokens || redaction.redactedPayload.estimated_tokens > config.rateLimits.estimatedInputTokensPerCall) {
    return failClosed(db, request, redaction.redactedPayload, auditEvents, input, "Payload token estimate exceeded Model Provider Gateway limits.", redaction.redactedPayloadHash);
  }

  const usage = await getModelGatewayUsageSnapshot(db, {
    sourceSystem: request.source_system,
    propertyId: request.property_id,
    actorId: request.actor_id,
    sourceRuntimeId: request.source_runtime_id,
    requestDate: request.requested_at.slice(0, 10),
  });
  const limitReason = evaluateRateLimits(config, usage);
  if (limitReason) {
    return failClosed(db, request, redaction.redactedPayload, auditEvents, input, limitReason, redaction.redactedPayloadHash);
  }

  const adapters = buildAdapters();
  const requestedAdapterId = config.shadowMode ? "shadow_mode" : config.defaultAdapter;
  const adapter = selectAdapter(config, adapters);
  auditEvents.push(await writeAudit(db, request, {
    event_type: "model_gateway.adapter_selected",
    decision: "selected",
    reason: `Selected adapter ${adapter.adapter_id}.`,
    before_state: null,
    after_state: { adapter_id: adapter.adapter_id, call_mode: request.call_mode },
    payload_hash: payload.payload_hash,
    redacted_payload_hash: redaction.redactedPayloadHash,
  }));

  if (config.killSwitch && requestedAdapterId !== "deterministic") {
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.kill_switch_blocked",
      decision: "blocked",
      reason: "Kill switch forced deterministic fallback.",
      before_state: { requested_adapter: requestedAdapterId },
      after_state: { fallback_adapter: "deterministic" },
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
    }));
  }

  const invokeAdapter = config.killSwitch && adapter.adapter_id !== "deterministic"
    ? adapters.deterministic
    : adapter;
  const shadowConfig = getShadowProviderConfigDecision(config, invokeAdapter.adapter_id);
  if (adapter.adapter_id === "shadow_mode") {
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.shadow_provider_config_checked",
      decision: shadowConfig.eligible ? "eligible" : "not_eligible",
      reason: shadowConfig.reason,
      before_state: null,
      after_state: {
        provider_shadow_enabled: config.providerShadowEnabled,
        provider_live_enabled: config.providerLiveEnabled,
        accepted_output_adapter: config.acceptedOutputAdapter,
        shadow_provider_adapter: config.shadowProviderAdapter,
        kill_switch_active: config.killSwitchActive,
        dry_run_enabled: config.dryRunEnabled,
        cloudflare_enabled: config.cloudflare.enabled,
      },
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
    }));
    if (shadowConfig.eligible) {
      auditEvents.push(await writeAudit(db, request, {
        event_type: "model_gateway.shadow_provider_call_started",
        decision: "started",
        reason: "Shadow provider call is eligible and starting through Cloudflare adapter.",
        before_state: null,
        after_state: { adapter_id: "cloudflare_ai_gateway", call_mode: "shadow" },
        payload_hash: payload.payload_hash,
        redacted_payload_hash: redaction.redactedPayloadHash,
        provider: "cloudflare_ai_gateway",
        model_id: config.cloudflare.model,
        route_name: config.cloudflare.dynamicRouteName ?? config.cloudflare.routeName,
      }));
    } else {
      auditEvents.push(await writeAudit(db, request, {
        event_type: "model_gateway.shadow_provider_skipped",
        decision: "skipped",
        reason: shadowConfig.reason,
        before_state: null,
        after_state: { adapter_id: "cloudflare_ai_gateway", call_mode: "shadow" },
        payload_hash: payload.payload_hash,
        redacted_payload_hash: redaction.redactedPayloadHash,
        provider: "cloudflare_ai_gateway",
        model_id: config.cloudflare.model,
        route_name: config.cloudflare.dynamicRouteName ?? config.cloudflare.routeName,
      }));
    }
  }

  const providerCallStarted = invokeAdapter.adapter_id === "cloudflare_ai_gateway"
    || (invokeAdapter.adapter_id === "shadow_mode" && shadowConfig.eligible);
  if (providerCallStarted) {
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.provider_call_started",
      decision: "started",
      reason: `Provider call started through ${invokeAdapter.adapter_id}.`,
      before_state: null,
      after_state: { adapter_id: invokeAdapter.adapter_id },
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
    }));
  }

  const adapterResult = await invokeAdapter.invoke({
    config,
    request,
    payload,
    redactedPayload: redaction.redactedPayload,
    deterministicExecutor: input.deterministicExecutor,
    fallbackFactory: input.fallbackFactory,
    providerNormalizer: input.providerNormalizer,
    acceptanceValidator: input.acceptanceValidator,
    governancePostCheck: input.governancePostCheck,
  });

  if (providerCallStarted) {
    const providerTimedOut = adapterResult.fallback_used
      && typeof (adapterResult.raw_response as any)?.error === "string"
      && /(timed out|timeout)/i.test((adapterResult.raw_response as any).error);
    auditEvents.push(await writeAudit(db, request, {
      event_type: providerTimedOut
        ? "model_gateway.provider_timeout"
        : adapterResult.fallback_used
          ? "model_gateway.provider_call_failed"
          : "model_gateway.provider_call_completed",
      decision: adapterResult.fallback_used ? "fallback" : "completed",
      reason: adapterResult.fallback_used ? "Provider path returned safe fallback." : "Provider path completed.",
      before_state: null,
      after_state: { adapter_id: invokeAdapter.adapter_id, provider_request_id: adapterResult.provider_request_id },
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
      provider: adapterResult.provider_name,
      model_id: adapterResult.model_id,
      route_name: adapterResult.route_name,
      route_version: adapterResult.route_version,
      token_usage: adapterResult.token_usage,
      cost_estimate: adapterResult.cost_estimate,
      latency_ms: adapterResult.latency_ms,
    }));
  }

  const contractValidation = validateStructuredOutputContract(request.allowed_output_contract, adapterResult.normalized_output);
  const outputLimitValidation = validateOutputTokenLimit(adapterResult.normalized_output, config.maxOutputTokens);
  const acceptanceValidation = input.acceptanceValidator?.(adapterResult.normalized_output) ?? okValidation();
  const validation = mergeValidation(mergeValidation(contractValidation, outputLimitValidation), acceptanceValidation);
  if (!validation.valid) {
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.response_validation_failed",
      decision: "fallback",
      reason: validation.errors.join("; "),
      before_state: null,
      after_state: validation,
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
      provider: adapterResult.provider_name,
      model_id: adapterResult.model_id,
      route_name: adapterResult.route_name,
      route_version: adapterResult.route_version,
      token_usage: adapterResult.token_usage,
      cost_estimate: adapterResult.cost_estimate,
      latency_ms: adapterResult.latency_ms,
      validation_status: "fail",
    }));
  }

  const genericGovernance = runModelGatewayGovernancePostCheck(adapterResult.normalized_output);
  const specificGovernance = input.governancePostCheck?.(adapterResult.normalized_output) ?? passGovernance();
  const governance = mergeGovernance(genericGovernance, specificGovernance);
  if (!governance.allowed) {
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.governance_post_check_failed",
      decision: "fallback",
      reason: governance.reason,
      before_state: null,
      after_state: governance,
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
      provider: adapterResult.provider_name,
      model_id: adapterResult.model_id,
      route_name: adapterResult.route_name,
      route_version: adapterResult.route_version,
      token_usage: adapterResult.token_usage,
      cost_estimate: adapterResult.cost_estimate,
      latency_ms: adapterResult.latency_ms,
      governance_status: governance.status,
    }));
  }

  let acceptedOutput = adapterResult.normalized_output;
  let fallbackUsed = adapterResult.fallback_used;
  if (adapterResult.cost_estimate != null && adapterResult.cost_estimate > config.rateLimits.estimatedCostUsdPerCall) {
    fallbackUsed = true;
    acceptedOutput = input.fallbackFactory("Provider call exceeded cost guardrail.");
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.fallback_used",
      decision: "fallback",
      reason: "Provider call exceeded cost guardrail.",
      before_state: null,
      after_state: { cost_estimate: adapterResult.cost_estimate, max_cost_estimate: config.rateLimits.estimatedCostUsdPerCall },
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
    }));
  }
  if (!validation.valid || !governance.allowed) {
    acceptedOutput = input.fallbackFactory(!validation.valid ? validation.errors.join("; ") : governance.reason);
    fallbackUsed = true;
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.fallback_used",
      decision: "fallback",
      reason: !validation.valid ? validation.errors.join("; ") : governance.reason,
      before_state: null,
      after_state: { adapter_id: invokeAdapter.adapter_id },
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
    }));
  }

  if (adapterResult.shadow_result) {
    const shadowRecord = buildShadowResultRecord({
      request,
      payloadHash: payload.payload_hash,
      redactedPayloadHash: redaction.redactedPayloadHash,
      shadowResult: adapterResult.shadow_result,
    });
    await insertModelGatewayShadowResult(db, shadowRecord);
    if (adapterResult.shadow_result.attempted) {
      const completionEvent = adapterResult.shadow_result.error_type === "timeout"
        ? "model_gateway.shadow_provider_timeout"
        : adapterResult.shadow_result.error_type
          ? "model_gateway.shadow_provider_call_failed"
          : "model_gateway.shadow_provider_call_completed";
      auditEvents.push(await writeAudit(db, request, {
        event_type: completionEvent,
        decision: adapterResult.shadow_result.error_type ? "fallback" : "completed",
        reason: adapterResult.shadow_result.error_message_safe ?? "Shadow provider call completed.",
        before_state: null,
        after_state: {
          provider_request_id: adapterResult.shadow_result.provider_request_id,
          output_hash: adapterResult.shadow_result.provider_response_hash,
        },
        payload_hash: payload.payload_hash,
        redacted_payload_hash: redaction.redactedPayloadHash,
        provider: adapterResult.shadow_result.provider_name,
        model_id: adapterResult.shadow_result.provider_model_id,
        route_name: adapterResult.shadow_result.provider_route_name,
        route_version: adapterResult.shadow_result.provider_route_version,
        token_usage: adapterResult.shadow_result.token_usage,
        cost_estimate: adapterResult.shadow_result.cost_estimate,
        latency_ms: adapterResult.shadow_result.latency_ms,
        validation_status: adapterResult.shadow_result.provider_validation_status,
        governance_status: adapterResult.shadow_result.provider_governance_status,
      }));
      if (adapterResult.shadow_result.provider_validation_status === "fail") {
        auditEvents.push(await writeAudit(db, request, {
          event_type: "model_gateway.shadow_provider_validation_failed",
          decision: "shadow_validation_failed",
          reason: "Shadow provider output failed structural or source-specific validation.",
          before_state: null,
          after_state: adapterResult.shadow_result.deviation_summary,
          payload_hash: payload.payload_hash,
          redacted_payload_hash: redaction.redactedPayloadHash,
          provider: adapterResult.shadow_result.provider_name,
          model_id: adapterResult.shadow_result.provider_model_id,
          route_name: adapterResult.shadow_result.provider_route_name,
          validation_status: adapterResult.shadow_result.provider_validation_status,
          governance_status: adapterResult.shadow_result.provider_governance_status,
        }));
      }
      if (adapterResult.shadow_result.provider_governance_status !== "pass") {
        auditEvents.push(await writeAudit(db, request, {
          event_type: "model_gateway.shadow_provider_governance_failed",
          decision: "shadow_governance_failed",
          reason: "Shadow provider output failed governance post-check.",
          before_state: null,
          after_state: adapterResult.shadow_result.deviation_summary,
          payload_hash: payload.payload_hash,
          redacted_payload_hash: redaction.redactedPayloadHash,
          provider: adapterResult.shadow_result.provider_name,
          model_id: adapterResult.shadow_result.provider_model_id,
          route_name: adapterResult.shadow_result.provider_route_name,
          validation_status: adapterResult.shadow_result.provider_validation_status,
          governance_status: adapterResult.shadow_result.provider_governance_status,
        }));
      }
    }
    auditEvents.push(await writeAudit(db, request, {
      event_type: "model_gateway.shadow_result_recorded",
      decision: "shadow_recorded",
      reason: adapterResult.shadow_result.attempted ? "Shadow result compared against deterministic accepted path." : "Shadow mode not attempted.",
      before_state: null,
      after_state: adapterResult.shadow_result,
      payload_hash: payload.payload_hash,
      redacted_payload_hash: redaction.redactedPayloadHash,
      provider: adapterResult.shadow_result.provider_name ?? "cloudflare_ai_gateway",
      model_id: adapterResult.shadow_result.provider_model_id,
      route_name: adapterResult.shadow_result.provider_route_name,
      route_version: adapterResult.shadow_result.provider_route_version,
      token_usage: adapterResult.shadow_result.token_usage,
      cost_estimate: adapterResult.shadow_result.cost_estimate,
      latency_ms: adapterResult.shadow_result.latency_ms,
      validation_status: adapterResult.shadow_result.provider_validation_status,
      governance_status: adapterResult.shadow_result.provider_governance_status,
    }));
  }

  const response: ModelGatewayResponse = {
    response_id: `model_gateway_response_${newId()}`,
    request_id: request.request_id,
    adapter_id: invokeAdapter.adapter_id,
    provider: adapterResult.provider_name,
    model_id: adapterResult.model_id,
    model_version: adapterResult.model_version,
    route_name: adapterResult.route_name,
    route_version: adapterResult.route_version,
    raw_response_hash: adapterResult.raw_response_hash,
    normalized_response_hash: adapterResult.normalized_response_hash ?? await sha256Hex(acceptedOutput),
    structured_output: acceptedOutput,
    validation_status: validation.valid ? "pass" : "fail",
    governance_status: governance.allowed ? "pass" : governance.status,
    token_usage: adapterResult.token_usage,
    cost_estimate: adapterResult.cost_estimate,
    latency_ms: adapterResult.latency_ms,
    provider_request_id: adapterResult.provider_request_id,
    generated_at: nowISO(),
  };
  await insertModelGatewayResponse(db, { ...response, fallback_used: fallbackUsed, call_mode: invokeAdapter.adapter_id === "shadow_mode" ? "shadow" : invokeAdapter.adapter_id === "noop" ? "noop" : request.call_mode });
  auditEvents.push(await writeAudit(db, request, {
    event_type: "model_gateway.response_accepted",
    decision: fallbackUsed ? "accepted_via_fallback" : "accepted",
    reason: fallbackUsed ? "Accepted output came from safe fallback path." : "Accepted output passed validation and governance.",
    before_state: null,
    after_state: { response_id: response.response_id, fallback_used: fallbackUsed },
    response_id: response.response_id,
    payload_hash: payload.payload_hash,
    redacted_payload_hash: redaction.redactedPayloadHash,
    provider: response.provider,
    model_id: response.model_id,
    route_name: response.route_name,
    route_version: response.route_version,
    token_usage: response.token_usage,
    cost_estimate: response.cost_estimate,
    latency_ms: response.latency_ms,
    validation_status: response.validation_status,
    governance_status: response.governance_status,
  }));

  return {
    request,
    payload,
    redacted_payload: redaction.redactedPayload,
    response,
    accepted_output: acceptedOutput,
    fallback_used: fallbackUsed,
    audit_events: auditEvents,
    validation,
    governance,
  };
}

function buildAdapters() {
  const deterministic = new DeterministicAdapter();
  const noop = new NoopAdapter();
  const provider = new CloudflareAIGatewayAdapter();
  const shadow = new ShadowModeAdapter(deterministic, provider);
  return { deterministic, noop, provider, shadow };
}

function selectAdapter(config: ReturnType<typeof loadModelGatewayConfig>, adapters: ReturnType<typeof buildAdapters>): ModelProviderAdapter {
  if (!config.enabled) return adapters.deterministic;
  if (config.killSwitch) return config.defaultAdapter === "noop" ? adapters.noop : adapters.deterministic;
  if (config.shadowMode) return adapters.shadow;
  if (!config.allowLiveCalls || config.dryRun) return config.defaultAdapter === "noop" ? adapters.noop : adapters.deterministic;
  if (config.defaultAdapter === "cloudflare_ai_gateway") return adapters.provider;
  if (config.defaultAdapter === "noop") return adapters.noop;
  return adapters.deterministic;
}

function getShadowProviderConfigDecision(config: ReturnType<typeof loadModelGatewayConfig>, adapterId: string): { eligible: boolean; reason: string } {
  if (adapterId !== "shadow_mode") return { eligible: false, reason: "Selected adapter is not shadow mode." };
  if (!config.shadowMode) return { eligible: false, reason: "MODEL_GATEWAY_SHADOW_MODE is not enabled." };
  if (!config.providerShadowEnabled) return { eligible: false, reason: "MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED is not enabled." };
  if (config.providerLiveEnabled || config.allowLiveCalls) return { eligible: false, reason: "Live provider behavior flags must remain disabled for shadow observation." };
  if (config.killSwitch) return { eligible: false, reason: "MODEL_GATEWAY_KILL_SWITCH is active." };
  if (config.dryRun) return { eligible: false, reason: "MODEL_GATEWAY_DRY_RUN is active." };
  if (!config.cloudflare.enabled) return { eligible: false, reason: "CLOUDFLARE_AI_GATEWAY_ENABLED is not enabled." };
  if (!config.cloudflare.baseUrl) return { eligible: false, reason: "CLOUDFLARE_AI_GATEWAY_BASE_URL is required for shadow provider observation." };
  if (!config.cloudflare.model) return { eligible: false, reason: "CLOUDFLARE_AI_GATEWAY_MODEL is required for shadow provider observation." };
  if (config.cloudflare.requireAuth && !config.cloudflare.authToken) {
    return { eligible: false, reason: "CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN is required for authenticated shadow provider observation." };
  }
  return { eligible: true, reason: "Cloudflare shadow provider configuration is eligible for shadow observation." };
}

function buildShadowResultRecord(input: {
  request: ModelGatewayRequest;
  payloadHash: string | null;
  redactedPayloadHash: string | null;
  shadowResult: NonNullable<Awaited<ReturnType<ModelProviderAdapter["invoke"]>>["shadow_result"]>;
}): ModelGatewayShadowResultRecord {
  return {
    shadow_result_id: `model_gateway_shadow_${newId()}`,
    gateway_request_id: input.request.request_id,
    payload_hash: input.payloadHash,
    redacted_payload_hash: input.redactedPayloadHash,
    output_hash: input.shadowResult.provider_response_hash,
    provider: input.shadowResult.provider_name ?? "cloudflare_ai_gateway",
    model_id: input.shadowResult.provider_model_id,
    route_name: input.shadowResult.provider_route_name,
    route_version: input.shadowResult.provider_route_version,
    validation_status: input.shadowResult.provider_validation_status,
    governance_status: input.shadowResult.provider_governance_status,
    structural_validity: input.shadowResult.provider_validation_status === "pass" ? 1 : 0,
    governance_validity: input.shadowResult.provider_governance_status === "pass" ? 1 : 0,
    deviation_summary: input.shadowResult.deviation_summary,
    token_usage: input.shadowResult.token_usage,
    cost_estimate: input.shadowResult.cost_estimate,
    latency_ms: input.shadowResult.latency_ms,
    provider_request_id: input.shadowResult.provider_request_id,
    error_type: input.shadowResult.error_type,
    error_message_safe: input.shadowResult.error_message_safe,
    created_at: nowISO(),
  };
}

function evaluateRateLimits(
  config: ReturnType<typeof loadModelGatewayConfig>,
  usage: { sourceSystemCount: number; propertyCount: number; actorCount: number; runtimeSessionCount: number },
): string | null {
  if (usage.sourceSystemCount >= config.rateLimits.perSourceSystemPerDay) return "Per-source-system Model Provider Gateway daily limit exceeded.";
  if (usage.propertyCount >= config.rateLimits.perPropertyPerDay) return "Per-property Model Provider Gateway daily limit exceeded.";
  if (usage.actorCount >= config.rateLimits.perActorPerDay) return "Per-actor Model Provider Gateway daily limit exceeded.";
  if (usage.runtimeSessionCount >= config.rateLimits.perRuntimeSession) return "Per-runtime-session Model Provider Gateway limit exceeded.";
  return null;
}

async function failClosed<TStructured>(
  db: D1Database,
  request: ModelGatewayRequest,
  payload: ModelGatewayPayload,
  auditEvents: ModelGatewayAuditEvent[],
  input: ModelGatewayExecutionInput<TStructured>,
  reason: string,
  redactedPayloadHash?: string,
): Promise<ModelGatewayExecutionResult<TStructured>> {
  const fallback = input.fallbackFactory(reason);
  const response: ModelGatewayResponse = {
    response_id: `model_gateway_response_${newId()}`,
    request_id: request.request_id,
    adapter_id: "noop",
    provider: "internal_noop",
    model_id: null,
    model_version: null,
    route_name: "noop",
    route_version: "v1",
    raw_response_hash: null,
    normalized_response_hash: await sha256Hex(fallback),
    structured_output: fallback,
    validation_status: "fail",
    governance_status: "blocked",
    token_usage: { input: 0, output: 0, total: 0 },
    cost_estimate: 0,
    latency_ms: 0,
    provider_request_id: null,
    generated_at: nowISO(),
  };
  await insertModelGatewayResponse(db, { ...response, fallback_used: true, call_mode: "noop" });
  auditEvents.push(await writeAudit(db, request, {
    event_type: "model_gateway.fallback_used",
    decision: "fallback",
    reason,
    before_state: null,
    after_state: { adapter_id: "noop" },
    response_id: response.response_id,
    payload_hash: payload.payload_hash,
    redacted_payload_hash: redactedPayloadHash ?? null,
    provider: response.provider,
    route_name: response.route_name,
    route_version: response.route_version,
    validation_status: response.validation_status,
    governance_status: response.governance_status,
  }));
  return {
    request,
    payload,
    redacted_payload: payload,
    response,
    accepted_output: fallback,
    fallback_used: true,
    audit_events: auditEvents,
    validation: { valid: false, errors: [reason], warnings: [] },
    governance: { allowed: false, status: "blocked", reason, warnings: [] },
  };
}

function okValidation(): ModelGatewayValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function validateOutputTokenLimit(output: unknown, maxOutputTokens: number): ModelGatewayValidationResult {
  const estimated = Math.max(1, Math.ceil(JSON.stringify(output).length / 4));
  return estimated <= maxOutputTokens
    ? { valid: true, errors: [], warnings: [] }
    : { valid: false, errors: [`Structured output token estimate ${estimated} exceeds max output tokens ${maxOutputTokens}.`], warnings: [] };
}

function passGovernance(): GovernancePostCheckResult {
  return { allowed: true, status: "pass", reason: "Source-specific governance post-check passed.", warnings: [] };
}

function mergeValidation(left: ModelGatewayValidationResult, right: ModelGatewayValidationResult): ModelGatewayValidationResult {
  return {
    valid: left.valid && right.valid,
    errors: [...left.errors, ...right.errors],
    warnings: [...left.warnings, ...right.warnings],
  };
}

function mergeGovernance(left: GovernancePostCheckResult, right: GovernancePostCheckResult): GovernancePostCheckResult {
  if (!left.allowed) return left;
  if (!right.allowed) return right;
  return {
    allowed: true,
    status: left.status === "pass" && right.status === "pass" ? "pass" : right.status,
    reason: "Governance post-check passed.",
    warnings: [...left.warnings, ...right.warnings],
  };
}

async function writeAudit(
  db: D1Database,
  request: ModelGatewayRequest,
  event: {
    event_type: string;
    decision: string;
    reason: string;
    before_state: unknown;
    after_state: unknown;
    response_id?: string | null;
    payload_hash?: string | null;
    redacted_payload_hash?: string | null;
    provider?: string | null;
    model_id?: string | null;
    route_name?: string | null;
    route_version?: string | null;
    token_usage?: Record<string, number | null> | null;
    cost_estimate?: number | null;
    latency_ms?: number | null;
    validation_status?: string | null;
    governance_status?: string | null;
  },
): Promise<ModelGatewayAuditEvent> {
  return writeModelGatewayAuditEvent(db, {
    event_type: event.event_type,
    request_id: request.request_id,
    response_id: event.response_id ?? null,
    actor_id: request.actor_id,
    property_id: request.property_id,
    region_id: request.region_id,
    source_system: request.source_system,
    adapter_id: request.adapter_id,
    call_mode: request.call_mode,
    decision: event.decision,
    reason: event.reason,
    before_state: event.before_state,
    after_state: event.after_state,
    correlation_id: request.correlation_id,
    directive_snapshot_id: request.directive_snapshot_id,
    directive_snapshot_hash: request.directive_snapshot_hash,
    evidence_packet_id: request.evidence_packet_id,
    evidence_packet_hash: request.evidence_packet_hash,
    payload_hash: event.payload_hash ?? request.payload_hash,
    redacted_payload_hash: event.redacted_payload_hash ?? null,
    provider: event.provider ?? null,
    model_id: event.model_id ?? request.model_id,
    route_name: event.route_name ?? null,
    route_version: event.route_version ?? null,
    token_usage: event.token_usage ?? null,
    cost_estimate: event.cost_estimate ?? null,
    latency_ms: event.latency_ms ?? null,
    validation_status: event.validation_status ?? null,
    governance_status: event.governance_status ?? null,
  });
}

function estimatePayloadTokens(payload: Omit<ModelGatewayPayload, "payload_hash" | "redaction_summary" | "estimated_tokens"> & { payload_hash?: string | null; estimated_tokens?: number | null }): number {
  const text = JSON.stringify(payload);
  return Math.max(1, Math.ceil(text.length / 4));
}
