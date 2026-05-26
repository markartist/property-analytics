import { sha256Hex } from "../../directives/hashing";
import type {
  AdapterInvokeInput,
  ModelAdapterInvokeResult,
  ModelGatewayConfig,
  ModelGatewayValidationResult,
  ModelProviderAdapter,
} from "../types";

interface CloudflareGatewayResponse {
  id?: string;
  model?: string;
  object?: string;
  created?: number;
  choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown[]; parsed?: unknown } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class CloudflareAIGatewayAdapter implements ModelProviderAdapter {
  adapter_id = "cloudflare_ai_gateway";
  provider_name = "cloudflare_ai_gateway";
  supports_streaming = false;
  supports_json_schema = true;
  supports_tool_calls = false;
  supports_shadow_mode = true;
  supports_dry_run = false;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async invoke<TStructured>(input: AdapterInvokeInput<TStructured>): Promise<ModelAdapterInvokeResult<TStructured>> {
    const configValidation = this.validateConfig(input.config);
    if (!configValidation.valid) {
      return {
        adapter_id: this.adapter_id,
        provider_name: this.provider_name,
        call_mode: input.request.call_mode,
        model_id: null,
        model_version: null,
        route_name: input.config.cloudflare.routeName,
        route_version: null,
        provider_request_id: null,
        raw_response: { error: configValidation.errors.join("; ") },
        raw_response_hash: await sha256Hex(configValidation.errors),
        normalized_output: input.fallbackFactory("Cloudflare AI Gateway configuration invalid; falling back safely."),
        normalized_response_hash: null,
        token_usage: { input: null, output: null, total: null },
        cost_estimate: null,
        latency_ms: 0,
        fallback_used: true,
      };
    }
    const shadowProviderCall = input.request.call_mode === "shadow"
      && input.config.providerShadowEnabled
      && input.config.shadowMode
      && !input.config.providerLiveEnabled
      && !input.config.allowLiveCalls;
    const liveProviderCall = input.request.call_mode === "live"
      && input.config.providerLiveEnabled
      && input.config.allowLiveCalls;
    if ((!shadowProviderCall && !liveProviderCall) || input.request.call_mode === "dry_run" || input.config.dryRun) {
      return {
        adapter_id: this.adapter_id,
        provider_name: this.provider_name,
        call_mode: input.request.call_mode,
        model_id: input.config.cloudflare.model,
        model_version: null,
        route_name: input.config.cloudflare.routeName,
        route_version: null,
        provider_request_id: null,
        raw_response: { blocked: true, reason: "Provider calls are disabled for this call mode." },
        raw_response_hash: await sha256Hex({ blocked: true }),
        normalized_output: input.fallbackFactory("Provider calls are disabled for this call mode."),
        normalized_response_hash: null,
        token_usage: { input: null, output: null, total: null },
        cost_estimate: null,
        latency_ms: 0,
        fallback_used: true,
      };
    }
    const started = Date.now();
    const endpoint = input.config.cloudflare.baseUrl!;
    const routeName = input.config.cloudflare.useDynamicRoute
      ? input.config.cloudflare.dynamicRouteName ?? input.config.cloudflare.routeName
      : input.config.cloudflare.routeName;
    const configuredModel = input.config.cloudflare.useDynamicRoute && input.config.cloudflare.dynamicRouteName
      ? input.config.cloudflare.dynamicRouteName
      : input.config.cloudflare.model;
    const body = {
      model: configuredModel ?? input.request.model_id,
      messages: [
        { role: "system", content: input.redactedPayload.system_instructions.join("\n") },
        {
          role: "user",
          content: JSON.stringify({
            runtime_context: input.redactedPayload.runtime_context,
            evidence_summary: input.redactedPayload.evidence_summary,
            awareness_summary: input.redactedPayload.awareness_summary,
            directive_summary: input.redactedPayload.directive_summary,
            output_schema: input.redactedPayload.output_schema,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: input.request.allowed_output_contract,
          schema: input.redactedPayload.output_schema,
        },
      },
      metadata: {
        source_system: input.request.source_system,
        property_id: input.request.property_id,
        route_name: routeName,
        provider: input.config.cloudflare.provider,
        correlation_id: input.request.correlation_id,
      },
    };
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (input.config.cloudflare.requireAuth && input.config.cloudflare.authToken) {
      headers.authorization = `Bearer ${input.config.cloudflare.authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.config.cloudflare.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = (await response.json().catch(async () => ({ error: await response.text() }))) as CloudflareGatewayResponse & Record<string, unknown>;
      if (!response.ok) {
        return {
          adapter_id: this.adapter_id,
          provider_name: this.provider_name,
          call_mode: input.request.call_mode,
          model_id: configuredModel ?? null,
          model_version: null,
          route_name: routeName ?? null,
          route_version: null,
          provider_request_id: typeof raw.id === "string" ? raw.id : null,
          raw_response: raw,
          raw_response_hash: await sha256Hex(raw),
          normalized_output: input.fallbackFactory(`Cloudflare AI Gateway request failed with status ${response.status}.`),
          normalized_response_hash: null,
          token_usage: { input: null, output: null, total: null },
          cost_estimate: null,
          latency_ms: Date.now() - started,
          fallback_used: true,
        };
      }
      const normalized = input.providerNormalizer
        ? input.providerNormalizer(raw)
        : defaultNormalizeProviderResponse(raw, input.fallbackFactory);
      return {
        adapter_id: this.adapter_id,
        provider_name: this.provider_name,
        call_mode: input.request.call_mode,
        model_id: typeof raw.model === "string" ? raw.model : configuredModel ?? null,
        model_version: null,
        route_name: routeName ?? null,
        route_version: null,
        provider_request_id: typeof raw.id === "string" ? raw.id : null,
        raw_response: raw,
        raw_response_hash: await sha256Hex(raw),
        normalized_output: normalized,
        normalized_response_hash: await sha256Hex(normalized),
        token_usage: {
          input: raw.usage?.prompt_tokens ?? null,
          output: raw.usage?.completion_tokens ?? null,
          total: raw.usage?.total_tokens ?? null,
        },
        cost_estimate: null,
        latency_ms: Date.now() - started,
        fallback_used: false,
      };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError"
        ? "Cloudflare AI Gateway request timed out."
        : error instanceof Error
          ? `Cloudflare AI Gateway request failed: ${error.message}`
          : "Cloudflare AI Gateway request failed.";
      return {
        adapter_id: this.adapter_id,
        provider_name: this.provider_name,
        call_mode: input.request.call_mode,
        model_id: configuredModel ?? null,
        model_version: null,
        route_name: routeName ?? null,
        route_version: null,
        provider_request_id: null,
        raw_response: { error: reason },
        raw_response_hash: await sha256Hex({ error: reason }),
        normalized_output: input.fallbackFactory(reason),
        normalized_response_hash: null,
        token_usage: { input: null, output: null, total: null },
        cost_estimate: null,
        latency_ms: Date.now() - started,
        fallback_used: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  validateConfig(config: ModelGatewayConfig): ModelGatewayValidationResult {
    const errors: string[] = [];
    if (!config.cloudflare.enabled) errors.push("Cloudflare AI Gateway is disabled.");
    if (!config.cloudflare.baseUrl) errors.push("CLOUDFLARE_AI_GATEWAY_BASE_URL is required.");
    if (config.cloudflare.requireAuth && !config.cloudflare.authToken) errors.push("CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN is required when auth is enforced.");
    if (!config.cloudflare.model && !config.cloudflare.dynamicRouteName) errors.push("A Cloudflare gateway model or dynamic route name is required.");
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async healthCheck(config: ModelGatewayConfig): Promise<{ healthy: boolean; message: string }> {
    const validation = this.validateConfig(config);
    return validation.valid
      ? { healthy: true, message: "Cloudflare AI Gateway adapter is configured." }
      : { healthy: false, message: validation.errors.join("; ") };
  }
}

function defaultNormalizeProviderResponse<TStructured>(
  raw: (CloudflareGatewayResponse & Record<string, unknown>) | Record<string, unknown>,
  fallbackFactory: (reason: string) => TStructured,
): TStructured {
  const choices: NonNullable<CloudflareGatewayResponse["choices"]> = Array.isArray((raw as CloudflareGatewayResponse).choices)
    ? ((raw as CloudflareGatewayResponse).choices as NonNullable<CloudflareGatewayResponse["choices"]>)
    : [];
  const parsed = choices[0]?.message?.parsed;
  if (parsed && typeof parsed === "object") {
    return parsed as TStructured;
  }
  const content = choices[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    try {
      return JSON.parse(content) as TStructured;
    } catch {
      return fallbackFactory("Cloudflare AI Gateway returned non-JSON content.");
    }
  }
  return fallbackFactory("Cloudflare AI Gateway returned no structured output.");
}
