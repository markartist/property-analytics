import { DeterministicAdapter } from "./deterministic";
import { compareShadowOutputs, runModelGatewayGovernancePostCheck, validateStructuredOutputContract } from "../validation";
import type {
  AdapterInvokeInput,
  ModelAdapterInvokeResult,
  ModelGatewayValidationStatus,
  ModelGatewayGovernanceStatus,
  ModelProviderAdapter,
} from "../types";

export class ShadowModeAdapter implements ModelProviderAdapter {
  adapter_id = "shadow_mode";
  provider_name = "internal_shadow_mode";
  supports_streaming = false;
  supports_json_schema = true;
  supports_tool_calls = false;
  supports_shadow_mode = true;
  supports_dry_run = true;

  constructor(
    private readonly deterministicAdapter: DeterministicAdapter,
    private readonly providerAdapter: ModelProviderAdapter,
  ) {}

  async invoke<TStructured>(input: AdapterInvokeInput<TStructured>): Promise<ModelAdapterInvokeResult<TStructured>> {
    const accepted = await this.deterministicAdapter.invoke(input);
    let providerValidationStatus: ModelGatewayValidationStatus = "fail";
    let providerGovernanceStatus: ModelGatewayGovernanceStatus = "fail";
    let deviationSummary: string[] = ["Provider shadow path not attempted."];
    let providerResponseHash: string | null = null;
    let providerName: string | null = null;
    let providerModelId: string | null = null;
    let providerRouteName: string | null = null;
    let providerRouteVersion: string | null = null;
    let providerRequestId: string | null = null;
    let tokenUsage: Record<string, number | null> | null = null;
    let costEstimate: number | null = null;
    let latencyMs: number | null = null;
    let errorType: string | null = null;
    let errorMessageSafe: string | null = null;

    if (canAttemptShadowProvider(input)) {
      const shadowResult = await this.providerAdapter.invoke(input);
      providerResponseHash = shadowResult.normalized_response_hash;
      providerName = shadowResult.provider_name;
      providerModelId = shadowResult.model_id;
      providerRouteName = shadowResult.route_name;
      providerRouteVersion = shadowResult.route_version;
      providerRequestId = shadowResult.provider_request_id;
      tokenUsage = shadowResult.token_usage;
      costEstimate = shadowResult.cost_estimate;
      latencyMs = shadowResult.latency_ms;
      if (shadowResult.fallback_used) {
        const rawError = typeof (shadowResult.raw_response as any)?.error === "string"
          ? String((shadowResult.raw_response as any).error)
          : "Provider shadow path returned fallback.";
        errorType = /timed out|timeout/i.test(rawError) ? "timeout" : "provider_error";
        errorMessageSafe = sanitizeProviderError(rawError);
      }
      const providerValidation = validateStructuredOutputContract(input.request.allowed_output_contract, shadowResult.normalized_output);
      const sourceValidation = input.acceptanceValidator?.(shadowResult.normalized_output);
      providerValidationStatus = providerValidation.valid && (sourceValidation?.valid ?? true) ? "pass" : "fail";
      const providerGovernance = runModelGatewayGovernancePostCheck(shadowResult.normalized_output);
      const sourceGovernance = input.governancePostCheck?.(shadowResult.normalized_output);
      providerGovernanceStatus = providerGovernance.allowed && (sourceGovernance?.allowed ?? true)
        ? providerGovernance.status
        : "blocked";
      deviationSummary = shadowResult.fallback_used
        ? [`provider fallback: ${errorMessageSafe ?? "shadow provider fallback"}`]
        : compareShadowOutputs(accepted.normalized_output, shadowResult.normalized_output);
    }

    return {
      ...accepted,
      adapter_id: this.adapter_id,
      provider_name: this.provider_name,
      call_mode: "shadow",
      shadow_result: {
        attempted: canAttemptShadowProvider(input),
        provider_validation_status: providerValidationStatus,
        provider_governance_status: providerGovernanceStatus,
        deviation_summary: deviationSummary,
        provider_response_hash: providerResponseHash,
        provider_name: providerName,
        provider_model_id: providerModelId,
        provider_route_name: providerRouteName,
        provider_route_version: providerRouteVersion,
        provider_request_id: providerRequestId,
        token_usage: tokenUsage,
        cost_estimate: costEstimate,
        latency_ms: latencyMs,
        error_type: errorType,
        error_message_safe: errorMessageSafe,
      },
    };
  }

  validateConfig(config: Parameters<ModelProviderAdapter["validateConfig"]>[0]) {
    return { valid: true, errors: [], warnings: config.shadowMode ? [] : ["Shadow mode is disabled."] };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return { healthy: true, message: "Shadow mode adapter depends on deterministic plus provider adapter configuration." };
  }
}

function canAttemptShadowProvider<TStructured>(input: AdapterInvokeInput<TStructured>): boolean {
  return input.config.shadowMode
    && input.config.providerShadowEnabled
    && input.config.cloudflare.enabled
    && !input.config.killSwitch
    && !input.config.dryRun
    && !input.config.providerLiveEnabled
    && !input.config.allowLiveCalls
    && Boolean(input.config.cloudflare.baseUrl)
    && Boolean(input.config.cloudflare.model)
    && (!input.config.cloudflare.requireAuth || Boolean(input.config.cloudflare.authToken));
}

function sanitizeProviderError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(token|secret|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}
