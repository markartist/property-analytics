import { nowISO } from "../../../lib/validate";
import { sha256Hex } from "../../directives/hashing";
import type {
  AdapterInvokeInput,
  ModelAdapterInvokeResult,
  ModelGatewayConfig,
  ModelGatewayValidationResult,
  ModelProviderAdapter,
} from "../types";

export class DeterministicAdapter implements ModelProviderAdapter {
  adapter_id = "deterministic";
  provider_name = "internal_deterministic";
  supports_streaming = false;
  supports_json_schema = true;
  supports_tool_calls = false;
  supports_shadow_mode = true;
  supports_dry_run = true;

  async invoke<TStructured>(input: AdapterInvokeInput<TStructured>): Promise<ModelAdapterInvokeResult<TStructured>> {
    const started = Date.now();
    const normalized_output = await input.deterministicExecutor();
    return {
      adapter_id: this.adapter_id,
      provider_name: this.provider_name,
      call_mode: input.request.call_mode,
      model_id: "deterministic-v1",
      model_version: nowISO().slice(0, 10),
      route_name: "deterministic",
      route_version: "v1",
      provider_request_id: null,
      raw_response: normalized_output,
      raw_response_hash: await sha256Hex(normalized_output),
      normalized_output,
      normalized_response_hash: await sha256Hex(normalized_output),
      token_usage: { input: 0, output: 0, total: 0 },
      cost_estimate: 0,
      latency_ms: Date.now() - started,
      fallback_used: false,
    };
  }

  validateConfig(_config: ModelGatewayConfig): ModelGatewayValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  async healthCheck(_config: ModelGatewayConfig): Promise<{ healthy: boolean; message: string }> {
    return { healthy: true, message: "Deterministic adapter is always available." };
  }
}
