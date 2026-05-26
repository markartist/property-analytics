import test from "node:test";
import assert from "node:assert/strict";

import { createTestD1Database } from "../helpers/sqlite-d1";
import { executeModelGateway } from "../../src/platform/model-gateway/gateway";
import { loadModelGatewayConfig, validateModelGatewayConfig } from "../../src/platform/model-gateway/config";
import { checkCloudflareShadowConfig } from "../../src/platform/model-gateway/cloudflare-shadow-config";
import { minimizeAndRedactPayload } from "../../src/platform/model-gateway/redaction";
import { validateStructuredOutputContract, runModelGatewayGovernancePostCheck } from "../../src/platform/model-gateway/validation";
import { CloudflareAIGatewayAdapter } from "../../src/platform/model-gateway/adapters/cloudflare-ai-gateway";
import { DeterministicAdapter } from "../../src/platform/model-gateway/adapters/deterministic";
import { ShadowModeAdapter } from "../../src/platform/model-gateway/adapters/shadow-mode";
import { MODEL_GATEWAY_GOLDEN_CASES, evaluateModelGatewayGoldenCase, runModelGatewayGoldenCaseEvaluationPass } from "../../src/platform/model-gateway/evaluation";
import { runSyntheticCloudflareShadowSmoke } from "../../src/platform/model-gateway/smoke";
import type { ModelGatewayExecutionInput, ModelProviderAdapter } from "../../src/platform/model-gateway/types";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function classificationInput(overrides: Partial<ModelGatewayExecutionInput<any>> = {}): ModelGatewayExecutionInput<any> {
  return {
    request: {
      request_id: "request_test",
      correlation_id: "corr_test",
      source_system: "evaluation",
      source_runtime_id: "runtime_test",
      source_interaction_id: "interaction_test",
      expert_read_request_id: null,
      property_id: "AR4PB",
      region_id: "Arkansas",
      actor_id: "tester",
      runtime_mode: "standard",
      directive_snapshot_id: "directive_test",
      directive_snapshot_hash: "directive_hash_test",
      evidence_packet_id: "evidence_test",
      evidence_packet_hash: "evidence_hash_test",
      awareness_context_hash: "awareness_hash_test",
      allowed_output_contract: "classification_response",
      blocked_outputs: ["publish_report"],
      call_mode: "deterministic",
      requested_at: new Date().toISOString(),
    },
    payload: {
      payload_id: "payload_test",
      request_id: "request_test",
      system_instructions: ["Return structured classification output only."],
      runtime_context: { lane: "evaluation" },
      evidence_summary: { evidence_refs: ["evidence_test"] },
      awareness_summary: {},
      directive_summary: { blocked_outputs: ["publish_report"] },
      output_schema: { required_fields: ["label", "confidence", "rationale", "evidence_refs", "uncertainty"] },
      redaction_summary: {},
      created_at: new Date().toISOString(),
    },
    outputContract: "classification_response",
    deterministicExecutor: () => ({
      label: "deterministic",
      confidence: 0.9,
      rationale: "Deterministic path accepted.",
      evidence_refs: ["evidence_test"],
      uncertainty: [],
    }),
    fallbackFactory: (reason: string) => ({
      label: "fallback",
      confidence: 0,
      rationale: reason,
      evidence_refs: ["evidence_test"],
      uncertainty: [reason],
    }),
    ...overrides,
  };
}

test("Model Provider Gateway defaults fail closed with deterministic behavior preserved", async () => {
  const config = loadModelGatewayConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.allowLiveCalls, false);
  assert.equal(config.providerShadowEnabled, false);
  assert.equal(config.providerLiveEnabled, false);
  assert.equal(config.defaultAdapter, "deterministic");
  assert.equal(config.acceptedOutputAdapter, "deterministic");
  assert.equal(config.shadowProviderAdapter, "cloudflare_ai_gateway");
  assert.equal(config.killSwitch, true);
  assert.equal(config.shadowMode, false);
  assert.equal(config.dryRun, true);
  assert.equal(config.storeRawPayload, false);
});

test("Model Provider Gateway config validation rejects unsafe or ambiguous settings", () => {
  const unsafe = validateModelGatewayConfig({
    MODEL_GATEWAY_ENABLED: "maybe",
    MODEL_GATEWAY_DEFAULT_ADAPTER: "surprise",
    MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "true",
    MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "cloudflare_ai_gateway",
    MODEL_GATEWAY_STORE_RAW_PAYLOAD: "true",
    MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT: "true",
    MODEL_GATEWAY_CACHE_ENABLED: "true",
    CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
    CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH: "false",
    CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED: "true",
    MODEL_GATEWAY_MAX_INPUT_TOKENS: "0",
  });
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.errors.some((error) => error.includes("MODEL_GATEWAY_STORE_RAW_PAYLOAD")));
  assert.ok(unsafe.errors.some((error) => error.includes("CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH")));
  assert.ok(unsafe.errors.some((error) => error.includes("MODEL_GATEWAY_PROVIDER_LIVE_ENABLED")));
});

test("Model Provider Gateway shadow-only config distinguishes provider observation from live accepted behavior", () => {
  const config = loadModelGatewayConfig({
    MODEL_GATEWAY_ENABLED: "true",
    MODEL_GATEWAY_SHADOW_MODE: "true",
    MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
    MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
    MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
    MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
    MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "deterministic",
    MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER: "cloudflare_ai_gateway",
    MODEL_GATEWAY_KILL_SWITCH: "false",
    MODEL_GATEWAY_DRY_RUN: "false",
    CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
    CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://example.invalid",
    CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN: "test-token",
    CLOUDFLARE_AI_GATEWAY_MODEL: "test-model",
  });
  const validation = validateModelGatewayConfig(undefined, config);
  assert.equal(validation.valid, true);
  assert.equal(config.providerShadowEnabled, true);
  assert.equal(config.providerLiveEnabled, false);
  assert.equal(config.allowLiveCalls, false);
  assert.equal(config.acceptedOutputAdapter, "deterministic");
});

test("Model Provider Gateway Cloudflare shadow config check reports readiness without secret values", () => {
  const missing = checkCloudflareShadowConfig({
    MODEL_GATEWAY_ENABLED: "true",
    MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
    MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
    MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
    MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
    MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "deterministic",
    MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER: "cloudflare_ai_gateway",
    MODEL_GATEWAY_KILL_SWITCH: "false",
    MODEL_GATEWAY_SHADOW_MODE: "true",
    MODEL_GATEWAY_DRY_RUN: "false",
    MODEL_GATEWAY_STORE_RAW_PAYLOAD: "false",
    MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT: "false",
    MODEL_GATEWAY_CACHE_ENABLED: "false",
    CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
    CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED: "false",
  });
  assert.equal(missing.shadow_provider_eligible, false);
  assert.ok(missing.missing_non_secret_config_keys.includes("CLOUDFLARE_AI_GATEWAY_BASE_URL"));

  const ready = checkCloudflareShadowConfig({
    MODEL_GATEWAY_ENABLED: "true",
    MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
    MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
    MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
    MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
    MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "deterministic",
    MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER: "cloudflare_ai_gateway",
    MODEL_GATEWAY_KILL_SWITCH: "false",
    MODEL_GATEWAY_SHADOW_MODE: "true",
    MODEL_GATEWAY_DRY_RUN: "false",
    MODEL_GATEWAY_STORE_RAW_PAYLOAD: "false",
    MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT: "false",
    MODEL_GATEWAY_CACHE_ENABLED: "false",
    CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
    CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://gateway.ai.cloudflare.com/v1/account/gateway/openai",
    CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN: "sentinel-secret-value-never-output",
    CLOUDFLARE_AI_GATEWAY_MODEL: "test-model",
    CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED: "false",
  });
  assert.equal(ready.shadow_provider_eligible, true);
  assert.equal(ready.live_provider_calls_enabled, false);
  assert.equal(JSON.stringify(ready).includes("sentinel-secret-value-never-output"), false);
});

test("Model Provider Gateway redacts self notes, secrets, and unauthorized memory before provider transit", async () => {
  const result = await minimizeAndRedactPayload({
    payload_id: "payload_1",
    request_id: "request_1",
    system_instructions: ["Use only allowed evidence."],
    runtime_context: {
      self_note: "private reminder",
      api_key: "super-secret",
      memory: [
        { memory_id: "memory_blocked_1", note: "do not send", allowed_uses: ["self_reminder"], blocked_uses: [], statement: "private self note" },
        { memory_id: "memory_allowed_1", note: "okay", allowed_uses: ["reasoning_context"], blocked_uses: [], statement: "allowed evidence memory" },
      ],
    },
    evidence_summary: {},
    awareness_summary: {},
    directive_summary: {},
    output_schema: {},
    redaction_summary: {},
    payload_hash: "payload_hash_1",
    estimated_tokens: 1,
    created_at: new Date().toISOString(),
  });
  assert.ok(result.summary.sensitivity_flags.some((path) => path.includes("self_note")));
  assert.ok(result.summary.redacted_paths.some((path) => path.includes("api_key")));
  assert.ok(result.summary.blocked_memory_refs.length >= 1);
});

test("Model Provider Gateway redacts relationship, private, restricted, and pattern-only context", async () => {
  const result = await minimizeAndRedactPayload({
    payload_id: "payload_private",
    request_id: "request_private",
    system_instructions: ["Use allowed context only."],
    runtime_context: {
      regional_context: [
        { memory_id: "rel_1", memory_class: "relationship_context", statement: "private relationship detail" },
        { memory_id: "private_1", visibility: "private", statement: "private self note" },
        { memory_id: "restricted_1", visibility: "restricted", statement: "restricted sibling property detail" },
        { memory_id: "pattern_1", share_as_pattern_only: true, raw_detail: "raw property-specific detail", pattern: "summary-level pattern" },
      ],
      route_token: "secret-token",
    },
    evidence_summary: {},
    awareness_summary: {},
    directive_summary: {},
    output_schema: {},
    redaction_summary: {},
    payload_hash: "payload_hash_private",
    estimated_tokens: 1,
    created_at: new Date().toISOString(),
  });
  const serialized = JSON.stringify(result.redactedPayload);
  assert.equal(serialized.includes("private relationship detail"), false);
  assert.equal(serialized.includes("restricted sibling property detail"), false);
  assert.equal(serialized.includes("raw property-specific detail"), false);
  assert.equal(serialized.includes("secret-token"), false);
  assert.ok(result.summary.blocked_memory_refs.includes("rel_1"));
  assert.ok(result.summary.redacted_paths.some((path) => path.includes("route_token")));
});

test("Model Provider Gateway rejects malformed structured output and governance-violating instructions", async () => {
  const malformed = validateStructuredOutputContract("captain_runtime_response", { nope: true });
  assert.equal(malformed.valid, false);

  const governance = runModelGatewayGovernancePostCheck({
    instruction: "Please mutate Data Pond and publish report immediately.",
  });
  assert.equal(governance.allowed, false);
  assert.equal(governance.status, "blocked");

  const promotedMemory = validateStructuredOutputContract("captain_runtime_response", {
    response: {
      response_id: "response_1",
      request_id: "request_1",
      conversational_response: "ok",
      reasoning_summary: "ok",
      structured_outputs: {},
      confidence: 0.8,
      publishability: "needs_verification",
      escalation_required: false,
      generated_at: new Date().toISOString(),
    },
    memory_candidates: [{
      memory_candidate_id: "candidate_1",
      source_interaction_id: "interaction_1",
      candidate_type: "claim",
      confidence: 0.8,
      verification_required: false,
      promotion_state: "promoted",
      expires_at: null,
      conflict_state: "none",
      source_evidence_hash: "evidence_hash_1",
    }],
    routing_decisions: [],
  });
  assert.equal(promotedMemory.valid, false);
  assert.equal(runModelGatewayGovernancePostCheck({ instruction: "Use self notes as evidence and bypass Quartermaster." }).allowed, false);
});

test("Model Provider Gateway persistence migration is numbered, constrained, and immutable", () => {
  const root = resolve(process.cwd(), "../..");
  const appMigration = readFileSync(resolve(root, "apps/api/migrations/0052_create_model_provider_gateway.sql"), "utf8");
  const infraMigrationPath = resolve(root, "infra/migrations/0039_create_model_provider_gateway.sql");
  assert.equal(existsSync(resolve(root, "infra/migrations/034_create_model_provider_gateway.sql")), false);
  assert.equal(existsSync(infraMigrationPath), true);
  const infraMigration = readFileSync(infraMigrationPath, "utf8");
  for (const migration of [appMigration, infraMigration]) {
    assert.match(migration, /CHECK \(source_system IN/);
    assert.match(migration, /ON DELETE RESTRICT/);
    assert.match(migration, /trg_model_gateway_audit_immutable/);
    assert.match(migration, /trg_model_gateway_audit_no_delete/);
    assert.match(migration, /model_gateway_shadow_results/);
    assert.match(migration, /trg_model_gateway_shadow_results_immutable/);
    assert.doesNotMatch(migration, /raw_payload_json|raw_prompt_json|secret/i);
  }
});

test("Model Provider Gateway unsafe config fails closed without storing a redacted payload", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const result = await executeModelGateway(db, { MODEL_GATEWAY_STORE_RAW_PAYLOAD: "true" }, classificationInput());
    assert.equal(result.fallback_used, true);
    assert.match(result.governance.reason, /configuration is unsafe/);
    const payloadRows = await db.prepare(`SELECT COUNT(*) AS count FROM model_gateway_payloads`).first<{ count: number }>();
    assert.equal(payloadRows?.count, 0);
  } finally {
    close();
  }
});

test("Model Provider Gateway rejects disallowed source systems, missing lineage, and oversized output", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const disallowed = await executeModelGateway(db, {
      MODEL_GATEWAY_ALLOWED_SOURCE_SYSTEMS: "captain_runtime",
    }, classificationInput({ request: { ...classificationInput().request, request_id: "request_disallowed" } as any }));
    assert.equal(disallowed.fallback_used, true);
    assert.match(disallowed.governance.reason, /source system is not allowed/);

    const missingLineage = await executeModelGateway(db, undefined, classificationInput({
      request: {
        ...classificationInput().request,
        request_id: "request_missing_lineage",
        directive_snapshot_hash: null,
      } as any,
    }));
    assert.equal(missingLineage.fallback_used, true);
    assert.match(missingLineage.governance.reason, /Directive snapshot id\/hash are required/);

    const oversized = await executeModelGateway(db, { MODEL_GATEWAY_MAX_OUTPUT_TOKENS: "10" }, classificationInput({
      request: { ...classificationInput().request, request_id: "request_oversized" } as any,
      deterministicExecutor: () => ({
        label: "deterministic",
        confidence: 0.9,
        rationale: "x".repeat(1000),
        evidence_refs: ["evidence_test"],
        uncertainty: [],
      }),
    }));
    assert.equal(oversized.fallback_used, true);
    assert.match(oversized.validation.errors.join("; "), /exceeds max output tokens/);
  } finally {
    close();
  }
});

test("Cloudflare adapter fails closed for missing auth and normalizes timeout fallback", async () => {
  const adapter = new CloudflareAIGatewayAdapter();
  const baseInput = {
    config: loadModelGatewayConfig({
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
      CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://example.invalid",
      CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH: "true",
      CLOUDFLARE_AI_GATEWAY_MODEL: "test-model",
    }),
    request: { ...classificationInput().request, provider_route: "cloudflare_ai_gateway", adapter_id: "cloudflare_ai_gateway", model_id: "test-model", payload_hash: "payload_hash", call_mode: "shadow" } as any,
    payload: { ...classificationInput().payload, payload_hash: "payload_hash", estimated_tokens: 1 } as any,
    redactedPayload: { ...classificationInput().payload, payload_hash: "payload_hash", estimated_tokens: 1 } as any,
    deterministicExecutor: classificationInput().deterministicExecutor,
    fallbackFactory: classificationInput().fallbackFactory,
  };
  const missingAuth = await adapter.invoke(baseInput);
  assert.equal(missingAuth.fallback_used, true);
  assert.match(JSON.stringify(missingAuth.raw_response), /AUTH_TOKEN/);

  const timeoutAdapter = new CloudflareAIGatewayAdapter(((_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })) as typeof fetch);
  const timeout = await timeoutAdapter.invoke({
    ...baseInput,
    config: loadModelGatewayConfig({
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
      CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://example.invalid",
      CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN: "test-token",
      CLOUDFLARE_AI_GATEWAY_MODEL: "test-model",
      CLOUDFLARE_AI_GATEWAY_TIMEOUT_MS: "1",
    }),
  });
  assert.equal(timeout.fallback_used, true);
  assert.match(JSON.stringify(timeout.raw_response), /timed out/);
});

test("Shadow mode records source-specific validation and governance failures without replacing deterministic output", async () => {
  const deterministic = new DeterministicAdapter();
  const provider: ModelProviderAdapter = {
    adapter_id: "fake_provider",
    provider_name: "fake_provider",
    supports_streaming: false,
    supports_json_schema: true,
    supports_tool_calls: false,
    supports_shadow_mode: true,
    supports_dry_run: false,
    validateConfig: () => ({ valid: true, errors: [], warnings: [] }),
    healthCheck: async () => ({ healthy: true, message: "ok" }),
    invoke: async (input) => ({
      adapter_id: "fake_provider",
      provider_name: "fake_provider",
      call_mode: "live",
      model_id: "fake-model",
      model_version: null,
      route_name: "fake",
      route_version: null,
      provider_request_id: "provider_request_1",
      raw_response: {},
      raw_response_hash: "raw_hash",
      normalized_output: {
        label: "provider",
        confidence: 0.99,
        rationale: "Attempt to use self notes as evidence.",
        evidence_refs: ["evidence_test"],
        uncertainty: [],
      },
      normalized_response_hash: "normalized_hash",
      token_usage: { input: 1, output: 1, total: 2 },
      cost_estimate: 0,
      latency_ms: 1,
      fallback_used: false,
    }),
  };
  const shadow = new ShadowModeAdapter(deterministic, provider);
  const result = await shadow.invoke({
    config: loadModelGatewayConfig({
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
      CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://example.invalid",
      CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN: "test-token",
      CLOUDFLARE_AI_GATEWAY_MODEL: "fake-model",
    }),
    request: { ...classificationInput().request, provider_route: "cloudflare_ai_gateway", adapter_id: "cloudflare_ai_gateway", model_id: "fake-model", payload_hash: "payload_hash", call_mode: "shadow" } as any,
    payload: { ...classificationInput().payload, payload_hash: "payload_hash", estimated_tokens: 1 } as any,
    redactedPayload: { ...classificationInput().payload, payload_hash: "payload_hash", estimated_tokens: 1 } as any,
    deterministicExecutor: classificationInput().deterministicExecutor,
    fallbackFactory: classificationInput().fallbackFactory,
    governancePostCheck: (output: any) => output.rationale.includes("self notes as evidence")
      ? { allowed: false, status: "blocked", reason: "Self notes cannot be evidence.", warnings: [] }
      : { allowed: true, status: "pass", reason: "ok", warnings: [] },
  });
  assert.equal((result.normalized_output as any).label, "deterministic");
  assert.equal(result.shadow_result?.attempted, true);
  assert.equal(result.shadow_result?.provider_governance_status, "blocked");
  assert.equal(result.shadow_result?.token_usage?.total, 2);
});

test("Model Provider Gateway kill switch blocks live provider route and returns safe deterministic fallback", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const result = await executeModelGateway(db, {
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "true",
      MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
      MODEL_GATEWAY_DEFAULT_ADAPTER: "cloudflare_ai_gateway",
      MODEL_GATEWAY_KILL_SWITCH: "true",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
      CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://example.invalid",
      CLOUDFLARE_AI_GATEWAY_MODEL: "gpt-test",
      CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN: "secret",
    }, {
      request: {
        request_id: "request_1",
        correlation_id: "corr_1",
        source_system: "evaluation",
        source_runtime_id: "runtime_1",
        source_interaction_id: "interaction_1",
        expert_read_request_id: null,
        property_id: "AR4PB",
        region_id: "Arkansas",
        actor_id: "tester",
        runtime_mode: "standard",
        directive_snapshot_id: "directive_1",
        directive_snapshot_hash: "directive_hash_1",
        evidence_packet_id: "evidence_1",
        evidence_packet_hash: "evidence_hash_1",
        awareness_context_hash: "awareness_hash_1",
        allowed_output_contract: "classification_response",
        blocked_outputs: ["publish_report"],
        call_mode: "live",
        requested_at: new Date().toISOString(),
      },
      payload: {
        payload_id: "payload_1",
        request_id: "request_1",
        system_instructions: ["Return structured classification output only."],
        runtime_context: { lane: "evaluation" },
        evidence_summary: { evidence_refs: ["evidence_1"] },
        awareness_summary: {},
        directive_summary: { blocked_outputs: ["publish_report"] },
        output_schema: { required_fields: ["label", "confidence", "rationale", "evidence_refs", "uncertainty"] },
        redaction_summary: {},
        created_at: new Date().toISOString(),
      },
      outputContract: "classification_response",
      deterministicExecutor: () => ({
        label: "deterministic",
        confidence: 0.9,
        rationale: "Deterministic path accepted.",
        evidence_refs: ["evidence_1"],
        uncertainty: [],
      }),
      fallbackFactory: (reason) => ({
        label: "fallback",
        confidence: 0,
        rationale: reason,
        evidence_refs: ["evidence_1"],
        uncertainty: [reason],
      }),
    });

    assert.equal(result.accepted_output.label, "deterministic");
    assert.equal(result.response.adapter_id, "deterministic");
    const auditRows = await db.prepare(`SELECT event_type FROM model_gateway_audit_events ORDER BY timestamp ASC`).all<{ event_type: string }>();
    assert.ok(auditRows.results.some((row) => row.event_type === "model_gateway.kill_switch_blocked"));
  } finally {
    close();
  }
});

test("Model Provider Gateway shadow mode records provider comparison but preserves deterministic accepted output", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const result = await executeModelGateway(db, {
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "false",
      MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "false",
    }, {
      request: {
        request_id: "request_shadow",
        correlation_id: "corr_shadow",
        source_system: "simulation",
        source_runtime_id: "runtime_shadow",
        source_interaction_id: "interaction_shadow",
        expert_read_request_id: null,
        property_id: "AR4PB",
        region_id: "Arkansas",
        actor_id: "tester",
        runtime_mode: "simulation",
        directive_snapshot_id: "directive_shadow",
        directive_snapshot_hash: "directive_shadow_hash",
        evidence_packet_id: "evidence_shadow",
        evidence_packet_hash: "evidence_shadow_hash",
        awareness_context_hash: "awareness_shadow_hash",
        allowed_output_contract: "classification_response",
        blocked_outputs: [],
        call_mode: "shadow",
        requested_at: new Date().toISOString(),
      },
      payload: {
        payload_id: "payload_shadow",
        request_id: "request_shadow",
        system_instructions: ["Return classification response."],
        runtime_context: {},
        evidence_summary: { evidence_refs: ["evidence_shadow"] },
        awareness_summary: {},
        directive_summary: {},
        output_schema: {},
        redaction_summary: {},
        created_at: new Date().toISOString(),
      },
      outputContract: "classification_response",
      deterministicExecutor: () => ({
        label: "deterministic",
        confidence: 0.88,
        rationale: "Shadow mode must not replace deterministic output.",
        evidence_refs: ["evidence_shadow"],
        uncertainty: [],
      }),
      fallbackFactory: (reason) => ({
        label: "fallback",
        confidence: 0,
        rationale: reason,
        evidence_refs: ["evidence_shadow"],
        uncertainty: [reason],
      }),
    });
    assert.equal(result.accepted_output.label, "deterministic");
    assert.equal(result.response.adapter_id, "shadow_mode");
    assert.equal(result.response.governance_status, "pass");
    assert.equal(result.audit_events.some((event) => event.event_type === "model_gateway.shadow_provider_skipped"), true);
    assert.equal(result.audit_events.some((event) => event.event_type === "model_gateway.shadow_result_recorded"), true);
  } finally {
    close();
  }
});

test("Model Provider Gateway shadow provider missing config is skipped without changing deterministic accepted output", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const result = await executeModelGateway(db, {
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
      MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
      MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
      MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "deterministic",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
    }, classificationInput({
      request: { ...classificationInput().request, request_id: "shadow_missing_config", call_mode: "shadow" } as any,
    }));
    assert.equal(result.accepted_output.label, "deterministic");
    assert.equal(result.response.adapter_id, "shadow_mode");
    const auditRows = await db.prepare(`SELECT event_type, reason, after_state_json FROM model_gateway_audit_events ORDER BY timestamp ASC`).all<any>();
    assert.ok(auditRows.results.some((row) => row.event_type === "model_gateway.shadow_provider_config_checked"));
    assert.ok(auditRows.results.some((row) => row.event_type === "model_gateway.shadow_provider_skipped"));
    assert.equal(auditRows.results.some((row) => row.event_type === "model_gateway.shadow_provider_call_started"), false);
    const shadowRows = await db.prepare(`SELECT * FROM model_gateway_shadow_results`).all<any>();
    assert.equal(shadowRows.results.length, 1);
    assert.equal(shadowRows.results[0].error_type, null);
    assert.equal(shadowRows.results[0].validation_status, "fail");
    assert.equal(JSON.stringify(auditRows.results).includes("test-token"), false);
  } finally {
    close();
  }
});

test("Model Provider Gateway synthetic Cloudflare shadow smoke is opt-in and synthetic only", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const skipped = await runSyntheticCloudflareShadowSmoke(db, {});
    assert.equal(skipped.attempted, false);
    assert.equal(skipped.calledCloudflare, false);
    assert.equal(skipped.skipReason, "RUN_CLOUDFLARE_SHADOW_SMOKE is not true.");

    const result = await runSyntheticCloudflareShadowSmoke(db, {
      RUN_CLOUDFLARE_SHADOW_SMOKE: "true",
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "false",
      MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
      MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
      MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "deterministic",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "false",
    });
    assert.equal(result.attempted, true);
    assert.equal(result.calledCloudflare, false);
    assert.equal(result.acceptedOutputSource, "deterministic");
    assert.match(result.skipReason ?? "", /MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED|skipped/i);
    const request = await db.prepare(`SELECT property_id, source_system, call_mode FROM model_gateway_requests WHERE request_id = ?`)
      .bind(result.gatewayRequestId)
      .first<any>();
    assert.equal(request.property_id, "SYNTHETIC_SHADOW_PROPERTY");
    assert.equal(request.source_system, "simulation");
    assert.equal(request.call_mode, "shadow");
  } finally {
    close();
  }
});

test("Model Provider Gateway golden-case evaluation fixtures preserve structural, governance, and redaction expectations", async () => {
  const { db, close } = await createTestD1Database();
  try {
    assert.equal(MODEL_GATEWAY_GOLDEN_CASES.length >= 7, true);
    for (const fixture of MODEL_GATEWAY_GOLDEN_CASES) {
      const result = await evaluateModelGatewayGoldenCase(db, fixture);
      assert.equal(result.structural_validity_score, 1, fixture.fixture_id);
      assert.equal(result.governance_validity_score, 1, fixture.fixture_id);
      assert.equal(result.redaction_compliance, true, fixture.fixture_id);
      assert.equal(result.semantic_scorecard.aggregate_status, "pass", fixture.fixture_id);
      for (const marker of fixture.expected_audit_markers) {
        assert.equal(result.deviation_summary.includes(marker), true, `${fixture.fixture_id} missing ${marker}`);
      }
    }
  } finally {
    close();
  }
});

test("Model Provider Gateway golden-case evaluation pass scores deterministic baseline and fail-closed shadow skip", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const result = await runModelGatewayGoldenCaseEvaluationPass(db, {
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
      MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
      MODEL_GATEWAY_DEFAULT_ADAPTER: "deterministic",
      MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER: "deterministic",
      MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER: "cloudflare_ai_gateway",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
    });
    assert.equal(result.config.deterministic_default_preserved, true);
    assert.equal(result.config.live_provider_calls_enabled, false);
    assert.equal(result.aggregate.fixture_count, MODEL_GATEWAY_GOLDEN_CASES.length);
    assert.equal(result.aggregate.deterministic_pass_count, MODEL_GATEWAY_GOLDEN_CASES.length);
    assert.equal(result.aggregate.shadow_provider_observed_count, 0);
    assert.equal(result.aggregate.shadow_skipped_count, MODEL_GATEWAY_GOLDEN_CASES.length);
    assert.equal(result.aggregate.redaction_pass_count, MODEL_GATEWAY_GOLDEN_CASES.length);
    assert.ok(result.shadow_results.every((item) => item.shadow_attempted));
    assert.ok(result.shadow_results.every((item) => item.semantic_scorecard.memory_care === "pass"));
  } finally {
    close();
  }
});

test("Model Provider Gateway frontend and audit surfaces do not expose Cloudflare token values", async () => {
  const root = resolve(process.cwd(), "../..");
  const webApi = readFileSync(resolve(root, "apps/web/src/lib/api.ts"), "utf8");
  assert.equal(webApi.includes("CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN"), false);
  const { db, close } = await createTestD1Database();
  try {
    await executeModelGateway(db, {
      MODEL_GATEWAY_ENABLED: "true",
      MODEL_GATEWAY_ALLOW_LIVE_CALLS: "false",
      MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED: "true",
      MODEL_GATEWAY_PROVIDER_LIVE_ENABLED: "false",
      MODEL_GATEWAY_KILL_SWITCH: "false",
      MODEL_GATEWAY_SHADOW_MODE: "true",
      MODEL_GATEWAY_DRY_RUN: "false",
      CLOUDFLARE_AI_GATEWAY_ENABLED: "true",
      CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://example.invalid",
      CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN: "sentinel-secret-value-never-output",
      CLOUDFLARE_AI_GATEWAY_MODEL: "test-model",
      CLOUDFLARE_AI_GATEWAY_TIMEOUT_MS: "1",
    }, classificationInput({
      request: { ...classificationInput().request, request_id: "shadow_secret_test", call_mode: "shadow" } as any,
    }));
    const auditRows = await db.prepare(`SELECT reason, before_state_json, after_state_json, token_usage_json FROM model_gateway_audit_events`).all<any>();
    const shadowRows = await db.prepare(`SELECT error_message_safe, deviation_summary_json, token_usage_json FROM model_gateway_shadow_results`).all<any>();
    assert.equal(JSON.stringify(auditRows.results).includes("sentinel-secret-value-never-output"), false);
    assert.equal(JSON.stringify(shadowRows.results).includes("sentinel-secret-value-never-output"), false);
  } finally {
    close();
  }
});
