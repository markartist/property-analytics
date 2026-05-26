import type { DirectiveRuntimeMode } from "../directives/types";

export type ModelGatewaySourceSystem = "captain_runtime" | "expert_reads" | "evaluation" | "simulation";
export type ModelGatewayCallMode = "deterministic" | "noop" | "dry_run" | "shadow" | "live";
export type ModelProviderRoute = "deterministic" | "noop" | "cloudflare_ai_gateway";
export type ModelGatewayOutputContract =
  | "captain_runtime_response"
  | "expert_read_response"
  | "classification_response"
  | "reflection_suggestion_response"
  | "evaluation_response";
export type ModelGatewayValidationStatus = "pass" | "fail";
export type ModelGatewayGovernanceStatus = "pass" | "fail" | "blocked";

export interface ModelGatewayRequest {
  request_id: string;
  correlation_id: string | null;
  source_system: ModelGatewaySourceSystem;
  source_runtime_id: string | null;
  source_interaction_id: string | null;
  expert_read_request_id: string | null;
  property_id: string | null;
  region_id: string | null;
  actor_id: string | null;
  runtime_mode: DirectiveRuntimeMode;
  directive_snapshot_id: string | null;
  directive_snapshot_hash: string | null;
  evidence_packet_id: string | null;
  evidence_packet_hash: string | null;
  awareness_context_hash: string | null;
  payload_hash: string;
  provider_route: string;
  adapter_id: string;
  model_id: string | null;
  call_mode: ModelGatewayCallMode;
  allowed_output_contract: ModelGatewayOutputContract;
  blocked_outputs: string[];
  requested_at: string;
}

export interface ModelGatewayPayload {
  payload_id: string;
  request_id: string;
  system_instructions: string[];
  runtime_context: Record<string, unknown>;
  evidence_summary: Record<string, unknown>;
  awareness_summary: Record<string, unknown>;
  directive_summary: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  redaction_summary: Record<string, unknown>;
  payload_hash: string;
  estimated_tokens: number;
  created_at: string;
}

export interface ModelGatewayResponse {
  response_id: string;
  request_id: string;
  adapter_id: string;
  provider: string;
  model_id: string | null;
  model_version: string | null;
  route_name: string | null;
  route_version: string | null;
  raw_response_hash: string | null;
  normalized_response_hash: string | null;
  structured_output: unknown;
  validation_status: ModelGatewayValidationStatus;
  governance_status: ModelGatewayGovernanceStatus;
  token_usage: Record<string, number | null>;
  cost_estimate: number | null;
  latency_ms: number | null;
  provider_request_id: string | null;
  generated_at: string;
}

export interface ModelGatewayAuditEvent {
  event_id: string;
  event_type: string;
  request_id: string | null;
  response_id: string | null;
  actor_id: string | null;
  property_id: string | null;
  region_id: string | null;
  source_system: ModelGatewaySourceSystem;
  adapter_id: string | null;
  call_mode: ModelGatewayCallMode;
  decision: string;
  reason: string;
  before_state: unknown;
  after_state: unknown;
  timestamp: string;
  correlation_id: string | null;
}

export interface ModelGatewayShadowResultRecord {
  shadow_result_id: string;
  gateway_request_id: string;
  payload_hash: string | null;
  redacted_payload_hash: string | null;
  output_hash: string | null;
  provider: string | null;
  model_id: string | null;
  route_name: string | null;
  route_version: string | null;
  validation_status: ModelGatewayValidationStatus;
  governance_status: ModelGatewayGovernanceStatus;
  structural_validity: number;
  governance_validity: number;
  deviation_summary: string[];
  token_usage: Record<string, number | null> | null;
  cost_estimate: number | null;
  latency_ms: number | null;
  provider_request_id: string | null;
  error_type: string | null;
  error_message_safe: string | null;
  created_at: string;
}

export interface ModelGatewayConfig {
  enabled: boolean;
  allowLiveCalls: boolean;
  providerShadowEnabled: boolean;
  providerLiveEnabled: boolean;
  defaultAdapter: ModelProviderRoute;
  acceptedOutputAdapter: ModelProviderRoute;
  shadowProviderAdapter: ModelProviderRoute;
  killSwitch: boolean;
  killSwitchActive: boolean;
  shadowMode: boolean;
  dryRun: boolean;
  dryRunEnabled: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  retryCount: number;
  logRawProviderOutput: boolean;
  storeRedactedPayload: boolean;
  storeRawPayload: boolean;
  cacheEnabled: boolean;
  allowedSourceSystems: ModelGatewaySourceSystem[];
  allowedRuntimeModes: DirectiveRuntimeMode[];
  rateLimits: {
    perSourceSystemPerDay: number;
    perPropertyPerDay: number;
    perRuntimeSession: number;
    perActorPerDay: number;
    estimatedInputTokensPerCall: number;
    estimatedCostUsdPerCall: number;
  };
  cloudflare: {
    enabled: boolean;
    accountId: string | null;
    gatewayId: string | null;
    baseUrl: string | null;
    authToken: string | null;
    routeName: string | null;
    requireAuth: boolean;
    useDynamicRoute: boolean;
    dynamicRouteName: string | null;
    model: string | null;
    provider: string | null;
    timeoutMs: number;
    cacheEnabled: boolean;
  };
}

export interface ModelGatewayValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GovernancePostCheckResult {
  allowed: boolean;
  status: ModelGatewayGovernanceStatus;
  reason: string;
  warnings: string[];
}

export interface PayloadRedactionResult {
  redactedPayload: ModelGatewayPayload;
  redactedPayloadHash: string;
  summary: {
    removed_paths: string[];
    redacted_paths: string[];
    blocked_memory_refs: string[];
    sensitivity_flags: string[];
    estimated_input_tokens: number;
  };
}

export interface AdapterInvokeInput<TStructured = unknown> {
  config: ModelGatewayConfig;
  request: ModelGatewayRequest;
  payload: ModelGatewayPayload;
  redactedPayload: ModelGatewayPayload;
  deterministicExecutor: () => Promise<TStructured> | TStructured;
  fallbackFactory: (reason: string) => TStructured;
  providerNormalizer?: (raw: unknown) => TStructured;
  acceptanceValidator?: (output: TStructured) => ModelGatewayValidationResult;
  governancePostCheck?: (output: TStructured) => GovernancePostCheckResult;
}

export interface ModelAdapterInvokeResult<TStructured = unknown> {
  adapter_id: string;
  provider_name: string;
  call_mode: ModelGatewayCallMode;
  model_id: string | null;
  model_version: string | null;
  route_name: string | null;
  route_version: string | null;
  provider_request_id: string | null;
  raw_response: unknown;
  raw_response_hash: string | null;
  normalized_output: TStructured;
  normalized_response_hash: string | null;
  token_usage: Record<string, number | null>;
  cost_estimate: number | null;
  latency_ms: number | null;
  fallback_used: boolean;
  shadow_result?: {
    attempted: boolean;
    provider_validation_status: ModelGatewayValidationStatus;
    provider_governance_status: ModelGatewayGovernanceStatus;
    deviation_summary: string[];
    provider_response_hash: string | null;
    provider_name: string | null;
    provider_model_id: string | null;
    provider_route_name: string | null;
    provider_route_version: string | null;
    provider_request_id: string | null;
    token_usage: Record<string, number | null> | null;
    cost_estimate: number | null;
    latency_ms: number | null;
    error_type: string | null;
    error_message_safe: string | null;
  };
}

export interface ModelProviderAdapter {
  adapter_id: string;
  provider_name: string;
  supports_streaming: boolean;
  supports_json_schema: boolean;
  supports_tool_calls: boolean;
  supports_shadow_mode: boolean;
  supports_dry_run: boolean;
  invoke<TStructured = unknown>(input: AdapterInvokeInput<TStructured>): Promise<ModelAdapterInvokeResult<TStructured>>;
  validateConfig(config: ModelGatewayConfig): ModelGatewayValidationResult;
  healthCheck(config: ModelGatewayConfig): Promise<{ healthy: boolean; message: string }>;
}

export interface ModelGatewayExecutionInput<TStructured = unknown> {
  request: Omit<ModelGatewayRequest, "payload_hash" | "provider_route" | "adapter_id" | "model_id"> & {
    payload_hash?: string | null;
    provider_route?: string | null;
    adapter_id?: string | null;
    model_id?: string | null;
  };
  payload: Omit<ModelGatewayPayload, "payload_hash" | "redaction_summary" | "estimated_tokens"> & {
    payload_hash?: string | null;
    estimated_tokens?: number | null;
  };
  outputContract: ModelGatewayOutputContract;
  deterministicExecutor: () => Promise<TStructured> | TStructured;
  fallbackFactory: (reason: string) => TStructured;
  providerNormalizer?: (raw: unknown) => TStructured;
  acceptanceValidator?: (output: TStructured) => ModelGatewayValidationResult;
  governancePostCheck?: (output: TStructured) => GovernancePostCheckResult;
}

export interface ModelGatewayExecutionResult<TStructured = unknown> {
  request: ModelGatewayRequest;
  payload: ModelGatewayPayload;
  redacted_payload: ModelGatewayPayload;
  response: ModelGatewayResponse;
  accepted_output: TStructured;
  fallback_used: boolean;
  audit_events: ModelGatewayAuditEvent[];
  validation: ModelGatewayValidationResult;
  governance: GovernancePostCheckResult;
}
