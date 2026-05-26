import { loadModelGatewayConfig, validateModelGatewayConfig } from "./config";

export interface CloudflareShadowConfigCheck {
  deterministic_default_preserved: boolean;
  live_provider_calls_enabled: boolean;
  cloudflare_adapter_live_enabled: boolean;
  provider_shadow_enabled: boolean;
  shadow_mode_enabled: boolean;
  kill_switch_active: boolean;
  dry_run_enabled: boolean;
  raw_payload_storage_enabled: boolean;
  raw_provider_output_logging_enabled: boolean;
  gateway_cache_enabled: boolean;
  cloudflare_cache_enabled: boolean;
  cloudflare_enabled: boolean;
  cloudflare_base_url_present: boolean;
  cloudflare_auth_token_present: boolean;
  cloudflare_model_present: boolean;
  cloudflare_dynamic_route_name_present: boolean;
  cloudflare_provider_present: boolean;
  cloudflare_route_name_present: boolean;
  required_non_secret_config_present: boolean;
  shadow_provider_eligible: boolean;
  config_valid: boolean;
  missing_non_secret_config_keys: string[];
  config_errors: string[];
  config_warnings: string[];
  safe_to_run_shadow_smoke: boolean;
  safe_to_run_shadow_evaluation: boolean;
}

export function checkCloudflareShadowConfig(env: Partial<Record<string, string | undefined>> | undefined): CloudflareShadowConfigCheck {
  const config = loadModelGatewayConfig(env);
  const validation = validateModelGatewayConfig(env, config);
  const missing = requiredMissingKeys(config);
  const deterministic = config.defaultAdapter === "deterministic" && config.acceptedOutputAdapter === "deterministic";
  const liveEnabled = config.allowLiveCalls || config.providerLiveEnabled;
  const cloudflareLiveEnabled = config.defaultAdapter === "cloudflare_ai_gateway" && config.allowLiveCalls;
  const rawOrCacheEnabled = config.storeRawPayload || config.logRawProviderOutput || config.cacheEnabled || config.cloudflare.cacheEnabled;
  const shadowEligible = validation.valid
    && deterministic
    && !liveEnabled
    && config.enabled
    && config.shadowMode
    && config.providerShadowEnabled
    && !config.killSwitch
    && !config.dryRun
    && config.cloudflare.enabled
    && !rawOrCacheEnabled
    && missing.length === 0;
  return {
    deterministic_default_preserved: deterministic,
    live_provider_calls_enabled: liveEnabled,
    cloudflare_adapter_live_enabled: cloudflareLiveEnabled,
    provider_shadow_enabled: config.providerShadowEnabled,
    shadow_mode_enabled: config.shadowMode,
    kill_switch_active: config.killSwitch,
    dry_run_enabled: config.dryRun,
    raw_payload_storage_enabled: config.storeRawPayload,
    raw_provider_output_logging_enabled: config.logRawProviderOutput,
    gateway_cache_enabled: config.cacheEnabled,
    cloudflare_cache_enabled: config.cloudflare.cacheEnabled,
    cloudflare_enabled: config.cloudflare.enabled,
    cloudflare_base_url_present: Boolean(config.cloudflare.baseUrl),
    cloudflare_auth_token_present: Boolean(config.cloudflare.authToken),
    cloudflare_model_present: Boolean(config.cloudflare.model),
    cloudflare_dynamic_route_name_present: Boolean(config.cloudflare.dynamicRouteName),
    cloudflare_provider_present: Boolean(config.cloudflare.provider),
    cloudflare_route_name_present: Boolean(config.cloudflare.routeName),
    required_non_secret_config_present: missing.length === 0,
    shadow_provider_eligible: shadowEligible,
    config_valid: validation.valid,
    missing_non_secret_config_keys: missing,
    config_errors: validation.errors,
    config_warnings: validation.warnings,
    safe_to_run_shadow_smoke: shadowEligible,
    safe_to_run_shadow_evaluation: shadowEligible,
  };
}

function requiredMissingKeys(config: ReturnType<typeof loadModelGatewayConfig>): string[] {
  const missing: string[] = [];
  if (!config.cloudflare.enabled) missing.push("CLOUDFLARE_AI_GATEWAY_ENABLED");
  if (!config.cloudflare.baseUrl) missing.push("CLOUDFLARE_AI_GATEWAY_BASE_URL");
  if (config.cloudflare.requireAuth && !config.cloudflare.authToken) missing.push("CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN");
  if (!config.cloudflare.model && !config.cloudflare.dynamicRouteName) {
    missing.push("CLOUDFLARE_AI_GATEWAY_MODEL or CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME");
  }
  return missing;
}
