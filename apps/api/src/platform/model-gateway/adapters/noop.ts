import { nowISO } from "../../../lib/validate";
import { sha256Hex } from "../../directives/hashing";
import type {
  AdapterInvokeInput,
  ModelAdapterInvokeResult,
  ModelGatewayConfig,
  ModelGatewayValidationResult,
  ModelProviderAdapter,
} from "../types";

export class NoopAdapter implements ModelProviderAdapter {
  adapter_id = "noop";
  provider_name = "internal_noop";
  supports_streaming = false;
  supports_json_schema = true;
  supports_tool_calls = false;
  supports_shadow_mode = false;
  supports_dry_run = true;

  async invoke<TStructured>(input: AdapterInvokeInput<TStructured>): Promise<ModelAdapterInvokeResult<TStructured>> {
    const normalized_output = input.fallbackFactory("Model Provider Gateway kill switch or config guard forced noop fallback.");
    return {
      adapter_id: this.adapter_id,
      provider_name: this.provider_name,
      call_mode: "noop",
      model_id: "noop-v1",
      model_version: nowISO().slice(0, 10),
      route_name: "noop",
      route_version: "v1",
      provider_request_id: null,
      raw_response: { blocked: true },
      raw_response_hash: await sha256Hex({ blocked: true }),
      normalized_output,
      normalized_response_hash: await sha256Hex(normalized_output),
      token_usage: { input: 0, output: 0, total: 0 },
      cost_estimate: 0,
      latency_ms: 0,
      fallback_used: true,
    };
  }

  validateConfig(_config: ModelGatewayConfig): ModelGatewayValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  async healthCheck(_config: ModelGatewayConfig): Promise<{ healthy: boolean; message: string }> {
    return { healthy: true, message: "Noop adapter available." };
  }
}
