import type { Env } from "../../env";
import type { ModelGatewayConfig, ModelGatewaySourceSystem, ModelGatewayValidationResult, ModelProviderRoute } from "./types";
import type { DirectiveRuntimeMode } from "../directives/types";

type StringEnv = Partial<Record<string, string | undefined>> | Partial<Env> | undefined;

const ALL_SOURCE_SYSTEMS: ModelGatewaySourceSystem[] = ["captain_runtime", "expert_reads", "evaluation", "simulation"];
const ALL_RUNTIME_MODES: DirectiveRuntimeMode[] = ["monitoring", "lightweight", "standard", "escalated", "executive", "simulation"];
const BOOLEAN_KEYS = [
  "MODEL_GATEWAY_ENABLED",
  "MODEL_GATEWAY_ALLOW_LIVE_CALLS",
  "MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED",
  "MODEL_GATEWAY_PROVIDER_LIVE_ENABLED",
  "MODEL_GATEWAY_KILL_SWITCH",
  "MODEL_GATEWAY_SHADOW_MODE",
  "MODEL_GATEWAY_DRY_RUN",
  "MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT",
  "MODEL_GATEWAY_STORE_REDACTED_PAYLOAD",
  "MODEL_GATEWAY_STORE_RAW_PAYLOAD",
  "MODEL_GATEWAY_CACHE_ENABLED",
  "CLOUDFLARE_AI_GATEWAY_ENABLED",
  "CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH",
  "CLOUDFLARE_AI_GATEWAY_USE_DYNAMIC_ROUTE",
  "CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED",
];
const POSITIVE_INT_KEYS = [
  "MODEL_GATEWAY_MAX_INPUT_TOKENS",
  "MODEL_GATEWAY_MAX_OUTPUT_TOKENS",
  "MODEL_GATEWAY_TIMEOUT_MS",
  "MODEL_GATEWAY_MAX_CALLS_PER_SOURCE_SYSTEM_PER_DAY",
  "MODEL_GATEWAY_MAX_CALLS_PER_PROPERTY_PER_DAY",
  "MODEL_GATEWAY_MAX_CALLS_PER_RUNTIME_SESSION",
  "MODEL_GATEWAY_MAX_CALLS_PER_ACTOR_PER_DAY",
  "MODEL_GATEWAY_MAX_ESTIMATED_INPUT_TOKENS_PER_CALL",
  "CLOUDFLARE_AI_GATEWAY_TIMEOUT_MS",
];

export function loadModelGatewayConfig(env?: StringEnv): ModelGatewayConfig {
  return {
    enabled: readBoolean(env, "MODEL_GATEWAY_ENABLED", false),
    allowLiveCalls: readBoolean(env, "MODEL_GATEWAY_ALLOW_LIVE_CALLS", false),
    providerShadowEnabled: readBoolean(env, "MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED", false),
    providerLiveEnabled: readBoolean(env, "MODEL_GATEWAY_PROVIDER_LIVE_ENABLED", false),
    defaultAdapter: readAdapter(env, "MODEL_GATEWAY_DEFAULT_ADAPTER", "deterministic"),
    acceptedOutputAdapter: readAdapter(env, "MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER", "deterministic"),
    shadowProviderAdapter: readAdapter(env, "MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER", "cloudflare_ai_gateway"),
    killSwitch: readBoolean(env, "MODEL_GATEWAY_KILL_SWITCH", true),
    killSwitchActive: readBoolean(env, "MODEL_GATEWAY_KILL_SWITCH", true),
    shadowMode: readBoolean(env, "MODEL_GATEWAY_SHADOW_MODE", false),
    dryRun: readBoolean(env, "MODEL_GATEWAY_DRY_RUN", true),
    dryRunEnabled: readBoolean(env, "MODEL_GATEWAY_DRY_RUN", true),
    maxInputTokens: readInt(env, "MODEL_GATEWAY_MAX_INPUT_TOKENS", 6000),
    maxOutputTokens: readInt(env, "MODEL_GATEWAY_MAX_OUTPUT_TOKENS", 20000),
    timeoutMs: readInt(env, "MODEL_GATEWAY_TIMEOUT_MS", 15000),
    retryCount: readInt(env, "MODEL_GATEWAY_RETRY_COUNT", 0),
    logRawProviderOutput: readBoolean(env, "MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT", false),
    storeRedactedPayload: readBoolean(env, "MODEL_GATEWAY_STORE_REDACTED_PAYLOAD", true),
    storeRawPayload: readBoolean(env, "MODEL_GATEWAY_STORE_RAW_PAYLOAD", false),
    cacheEnabled: readBoolean(env, "MODEL_GATEWAY_CACHE_ENABLED", false),
    allowedSourceSystems: readCsvEnum<ModelGatewaySourceSystem>(env, "MODEL_GATEWAY_ALLOWED_SOURCE_SYSTEMS", ALL_SOURCE_SYSTEMS, ALL_SOURCE_SYSTEMS),
    allowedRuntimeModes: readCsvEnum<DirectiveRuntimeMode>(env, "MODEL_GATEWAY_ALLOWED_RUNTIME_MODES", ALL_RUNTIME_MODES, ALL_RUNTIME_MODES),
    rateLimits: {
      perSourceSystemPerDay: readInt(env, "MODEL_GATEWAY_MAX_CALLS_PER_SOURCE_SYSTEM_PER_DAY", 250),
      perPropertyPerDay: readInt(env, "MODEL_GATEWAY_MAX_CALLS_PER_PROPERTY_PER_DAY", 50),
      perRuntimeSession: readInt(env, "MODEL_GATEWAY_MAX_CALLS_PER_RUNTIME_SESSION", 12),
      perActorPerDay: readInt(env, "MODEL_GATEWAY_MAX_CALLS_PER_ACTOR_PER_DAY", 100),
      estimatedInputTokensPerCall: readInt(env, "MODEL_GATEWAY_MAX_ESTIMATED_INPUT_TOKENS_PER_CALL", 7000),
      estimatedCostUsdPerCall: readFloat(env, "MODEL_GATEWAY_MAX_ESTIMATED_COST_USD_PER_CALL", 0.5),
    },
    cloudflare: {
      enabled: readBoolean(env, "CLOUDFLARE_AI_GATEWAY_ENABLED", false),
      accountId: readString(env, "CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID"),
      gatewayId: readString(env, "CLOUDFLARE_AI_GATEWAY_ID"),
      baseUrl: readString(env, "CLOUDFLARE_AI_GATEWAY_BASE_URL"),
      authToken: readString(env, "CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN"),
      routeName: readString(env, "CLOUDFLARE_AI_GATEWAY_ROUTE_NAME"),
      requireAuth: readBoolean(env, "CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH", true),
      useDynamicRoute: readBoolean(env, "CLOUDFLARE_AI_GATEWAY_USE_DYNAMIC_ROUTE", false),
      dynamicRouteName: readString(env, "CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME"),
      model: readString(env, "CLOUDFLARE_AI_GATEWAY_MODEL"),
      provider: readString(env, "CLOUDFLARE_AI_GATEWAY_PROVIDER"),
      timeoutMs: readInt(env, "CLOUDFLARE_AI_GATEWAY_TIMEOUT_MS", 15000),
      cacheEnabled: readBoolean(env, "CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED", false),
    },
  };
}

export function validateModelGatewayConfig(env?: StringEnv, config = loadModelGatewayConfig(env)): ModelGatewayValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const key of BOOLEAN_KEYS) {
    const raw = readString(env, key);
    if (raw && !isBooleanLiteral(raw)) errors.push(`${key} must be an explicit boolean literal.`);
  }
  for (const key of POSITIVE_INT_KEYS) {
    const raw = readString(env, key);
    if (raw && (!Number.isInteger(Number(raw)) || Number(raw) <= 0)) errors.push(`${key} must be a positive integer.`);
  }
  const costRaw = readString(env, "MODEL_GATEWAY_MAX_ESTIMATED_COST_USD_PER_CALL");
  if (costRaw && (!Number.isFinite(Number(costRaw)) || Number(costRaw) < 0)) {
    errors.push("MODEL_GATEWAY_MAX_ESTIMATED_COST_USD_PER_CALL must be a non-negative number.");
  }
  const adapterRaw = readString(env, "MODEL_GATEWAY_DEFAULT_ADAPTER");
  if (adapterRaw && !["noop", "cloudflare_ai_gateway", "deterministic"].includes(adapterRaw)) {
    errors.push("MODEL_GATEWAY_DEFAULT_ADAPTER must be deterministic, noop, or cloudflare_ai_gateway.");
  }
  const acceptedAdapterRaw = readString(env, "MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER");
  if (acceptedAdapterRaw && acceptedAdapterRaw !== "deterministic") {
    errors.push("MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER must remain deterministic.");
  }
  const shadowAdapterRaw = readString(env, "MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER");
  if (shadowAdapterRaw && shadowAdapterRaw !== "cloudflare_ai_gateway") {
    errors.push("MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER must be cloudflare_ai_gateway for this shadow foundation.");
  }
  const sourceRaw = readString(env, "MODEL_GATEWAY_ALLOWED_SOURCE_SYSTEMS");
  if (sourceRaw && parseCsv(sourceRaw).some((item) => !ALL_SOURCE_SYSTEMS.includes(item as ModelGatewaySourceSystem))) {
    errors.push("MODEL_GATEWAY_ALLOWED_SOURCE_SYSTEMS contains an unsupported source system.");
  }
  const modeRaw = readString(env, "MODEL_GATEWAY_ALLOWED_RUNTIME_MODES");
  if (modeRaw && parseCsv(modeRaw).some((item) => !ALL_RUNTIME_MODES.includes(item as DirectiveRuntimeMode))) {
    errors.push("MODEL_GATEWAY_ALLOWED_RUNTIME_MODES contains an unsupported runtime mode.");
  }
  if (config.storeRawPayload) errors.push("MODEL_GATEWAY_STORE_RAW_PAYLOAD=true is not allowed in the gateway foundation.");
  if (config.logRawProviderOutput) errors.push("MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT=true is not allowed in the gateway foundation.");
  if (config.cacheEnabled) errors.push("MODEL_GATEWAY_CACHE_ENABLED=true is not allowed for property-scoped reasoning by default.");
  if (config.cloudflare.cacheEnabled) errors.push("CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED=true is not allowed for property-scoped reasoning by default.");
  if (config.cloudflare.enabled && !config.cloudflare.requireAuth) {
    errors.push("CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH=false is unsafe for this foundation.");
  }
  if (config.providerShadowEnabled) {
    if (!config.enabled) errors.push("MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED requires MODEL_GATEWAY_ENABLED=true.");
    if (!config.shadowMode) errors.push("MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED requires MODEL_GATEWAY_SHADOW_MODE=true.");
    if (config.allowLiveCalls) errors.push("Shadow provider observation requires MODEL_GATEWAY_ALLOW_LIVE_CALLS=false.");
    if (config.providerLiveEnabled) errors.push("Shadow provider observation requires MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false.");
    if (config.defaultAdapter !== "deterministic" || config.acceptedOutputAdapter !== "deterministic") {
      errors.push("Shadow provider observation requires deterministic accepted output.");
    }
    if (config.shadowProviderAdapter !== "cloudflare_ai_gateway") {
      errors.push("Shadow provider observation only supports the Cloudflare AI Gateway adapter in this foundation.");
    }
  }
  if (config.providerLiveEnabled) {
    errors.push("MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=true is not allowed in the shadow-mode configuration pass.");
  }
  if (config.shadowMode && config.killSwitch) {
    warnings.push("Shadow mode is configured but the kill switch prevents provider shadow calls.");
  }
  if (config.providerShadowEnabled && config.dryRun) {
    warnings.push("Provider shadow mode is configured but dry-run mode prevents Cloudflare transit.");
  }
  if (config.allowLiveCalls && (!config.enabled || config.dryRun || !config.providerLiveEnabled)) {
    warnings.push("Live-call flag is set, but live accepted provider behavior remains unavailable.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

function readAdapter(env: StringEnv, key: string, fallback: ModelProviderRoute): ModelProviderRoute {
  const value = readString(env, key)?.trim();
  return value === "noop" || value === "cloudflare_ai_gateway" || value === "deterministic" ? value : fallback;
}

function readCsvEnum<T extends string>(env: StringEnv, key: string, allowed: readonly T[], fallback: T[]): T[] {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const set = new Set(allowed);
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean) as T[];
  const filtered = values.filter((item) => set.has(item));
  return filtered.length > 0 ? filtered : fallback;
}

function readBoolean(env: StringEnv, key: string, fallback: boolean): boolean {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function isBooleanLiteral(raw: string): boolean {
  return ["1", "true", "yes", "on", "0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

function readInt(env: StringEnv, key: string, fallback: number): number {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFloat(env: StringEnv, key: string, fallback: number): number {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(env: StringEnv, key: string): string | null {
  const value = env && key in env ? (env as Record<string, string | undefined>)[key] : undefined;
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function parseCsv(raw: string): string[] {
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}
