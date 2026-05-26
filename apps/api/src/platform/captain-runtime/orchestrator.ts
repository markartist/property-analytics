import type { Env } from "../../env";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { sha256Hex } from "../directives/hashing";
import { resolveRuntimeDirective } from "../directives/resolver";
import { executeModelGateway } from "../model-gateway/gateway";
import { describeStructuredOutputContract } from "../model-gateway/validation";
import { classifyCaptainInteraction } from "./classifier";
import { assemblePropertyRuntimeContext } from "./context";
import { buildCaptainEvidencePacket, validateCaptainEvidencePacket } from "./evidence";
import { enforceCaptainRuntimeGovernance } from "./governance";
import { buildCaptainRuntimePayload, validateCaptainRuntimePayload } from "./payload";
import { executeConstrainedReasoning, validateReasoningResponse, validateReasoningSideEffects } from "./response";
import {
  ensureCaptainRuntimeOrchestrationTables,
  findCommunityForRuntime,
  insertEvidencePacket,
  insertInteraction,
  insertMemoryCandidates,
  insertReasoningRequest,
  insertReasoningResponse,
  insertRoutingDecisions,
  insertRuntimeSession,
  writeCaptainRuntimeAuditEvent,
} from "./repository";
import type {
  CaptainInteraction,
  CaptainMemoryCandidate,
  CaptainReasoningRequest,
  CaptainReasoningResponse,
  CaptainRoutingDecision,
  CaptainRuntimeInput,
  CaptainRuntimePayload,
  CaptainRuntimeResult,
  Publishability,
} from "./types";

export async function runCaptainRuntimeInteraction(
  db: D1Database,
  input: CaptainRuntimeInput,
  env?: Partial<Env> | Partial<Record<string, string | undefined>>,
): Promise<CaptainRuntimeResult> {
  await ensureCaptainRuntimeOrchestrationTables(db);
  const correlationId = input.correlation_id ?? `captain_runtime_corr_${newId()}`;
  const property = await findCommunityForRuntime(db, input.property_id);
  if (!property) {
    throw new Error(`Unable to resolve property context for ${input.property_id}`);
  }
  const propertyCode = property.encasa_property_code ?? property.id;
  const runtimeMode = input.runtime_mode ?? "standard";
  const startedAt = nowISO();
  const sessionId = `captain_runtime_session_${newId()}`;
  const interactionId = `captain_interaction_${newId()}`;
  await writeCaptainRuntimeAuditEvent(db, {
    event_type: "captain_runtime.interaction_received",
    actor: input.user_id,
    interaction_id: interactionId,
    before_state: null,
    after_state: { property_id: propertyCode, runtime_mode: runtimeMode, input_type: input.input_type ?? "text" },
    correlation_id: correlationId,
  });

  const classification = classifyCaptainInteraction(input.input_text);
  const roleId = roleForIntent(classification.intent);
  const directive = await resolveRuntimeDirective(db, {
    role_id: roleId,
    property_id: propertyCode,
    report_family: input.report_family ?? "captain",
    runtime_mode: runtimeMode,
    as_of_date: startedAt.slice(0, 10),
    actor: input.user_id,
    request_id: interactionId,
    correlation_id: correlationId,
  });
  assertDirectiveResolution({ expectedRoleId: roleId, directive });
  const session = await insertRuntimeSession(db, {
    session_id: sessionId,
    property_id: propertyCode,
    user_id: input.user_id,
    runtime_mode: runtimeMode,
    started_at: startedAt,
    ended_at: null,
    active_directive_snapshot: {
      role_id: directive.active_directive_profile.role_id,
      active_version: directive.active_version,
      runtime_snapshot_id: directive.runtime_snapshot_id,
      runtime_snapshot_hash: directive.runtime_snapshot_hash,
    },
    correlation_id: correlationId,
    idempotency_key: input.idempotency_key ?? null,
  });
  const interaction: CaptainInteraction = {
    interaction_id: interactionId,
    session_id: sessionId,
    actor: input.actor ?? "user",
    input_text: input.input_text,
    input_type: input.input_type ?? "text",
    intent: classification.intent,
    subtype: classification.subtype,
    timestamp: startedAt,
    classification_confidence: classification.confidence,
  };
  await insertInteraction(db, interaction);

  const context = await assemblePropertyRuntimeContext(db, property);
  const evidencePacket = await buildCaptainEvidencePacket({
    propertyId: propertyCode,
    directiveSnapshotId: directive.runtime_snapshot_id ?? null,
    context,
    userClaim: input.input_text,
  });
  const evidenceValidation = validateCaptainEvidencePacket(evidencePacket);
  if (!evidenceValidation.valid) {
    await writeCaptainRuntimeAuditEvent(db, {
      event_type: "captain_runtime.evidence_validation_failed",
      actor: input.user_id,
      interaction_id: interactionId,
      before_state: null,
      after_state: evidenceValidation,
      correlation_id: correlationId,
      directive_hash: directive.runtime_snapshot_hash ?? null,
    });
    throw new Error(`Captain evidence packet failed validation: ${evidenceValidation.errors.join("; ")}`);
  }
  await insertEvidencePacket(db, evidencePacket);

  const governance = enforceCaptainRuntimeGovernance({
    intent: classification.intent,
    directive,
    evidencePacket,
    runtimeMode,
  });
  const runtimePayload = buildCaptainRuntimePayload({ directive, context, evidencePacket, governance });
  const payloadValidation = validateCaptainRuntimePayload(runtimePayload);
  if (!payloadValidation.valid) {
    await writeCaptainRuntimeAuditEvent(db, {
      event_type: "captain_runtime.payload_validation_failed",
      actor: input.user_id,
      interaction_id: interactionId,
      before_state: runtimePayload,
      after_state: payloadValidation,
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: directive.runtime_snapshot_hash ?? null,
    });
    throw new Error(`Captain runtime payload failed validation: ${payloadValidation.errors.join("; ")}`);
  }
  const reasoningRequest: CaptainReasoningRequest = {
    request_id: `captain_reasoning_request_${newId()}`,
    interaction_id: interactionId,
    allowed_outputs: governance.allowed_outputs,
    blocked_outputs: governance.blocked_outputs,
    authority_level: governance.authority_level,
    runtime_mode: runtimeMode,
    directive_snapshot: directive,
    evidence_packet_hash: evidencePacket.evidence_hash,
  };
  const payloadHash = await insertReasoningRequest(db, reasoningRequest, runtimePayload as unknown as Record<string, unknown>);
  await writeCaptainRuntimeAuditEvent(db, {
    event_type: "captain_runtime.gpt_payload_generated",
    actor: input.user_id,
    interaction_id: interactionId,
    before_state: null,
    after_state: { payload_id: runtimePayload.payload_id, payload_hash: payloadHash },
    request_id: reasoningRequest.request_id,
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: directive.runtime_snapshot_hash ?? null,
  });

  const gatewayResult = await executeModelGateway<CaptainGatewayAcceptedOutput>(db, env, {
    request: {
      request_id: `model_gateway_request_${newId()}`,
      correlation_id: correlationId,
      source_system: "captain_runtime",
      source_runtime_id: sessionId,
      source_interaction_id: interactionId,
      expert_read_request_id: null,
      property_id: propertyCode,
      region_id: property.region ?? null,
      actor_id: input.user_id,
      runtime_mode: runtimeMode,
      directive_snapshot_id: directive.runtime_snapshot_id ?? null,
      directive_snapshot_hash: directive.runtime_snapshot_hash ?? null,
      evidence_packet_id: evidencePacket.evidence_packet_id,
      evidence_packet_hash: evidencePacket.evidence_hash,
      awareness_context_hash: await sha256Hex(runtimePayload.relevant_memory ?? []),
      allowed_output_contract: "captain_runtime_response",
      blocked_outputs: governance.blocked_outputs,
      call_mode: "deterministic",
      requested_at: startedAt,
    },
    payload: buildCaptainGatewayPayload({
      requestId: reasoningRequest.request_id,
      propertyContext: context,
      runtimePayload,
      directive,
      evidencePacket,
    }),
    outputContract: "captain_runtime_response",
    deterministicExecutor: async () => {
      const deterministic = executeConstrainedReasoning({
        requestId: reasoningRequest.request_id,
        interactionId,
        inputText: input.input_text,
        intent: classification.intent,
        payload: runtimePayload,
        publishability: governance.publishability,
        escalationRequired: governance.escalation_required,
      });
      return {
        response: deterministic.response,
        memory_candidates: deterministic.memoryCandidates,
        memory_payloads: deterministic.memoryPayloads,
        routing_decisions: deterministic.routingDecisions,
      };
    },
    fallbackFactory: (reason) =>
      buildCaptainGatewayFallback({
        requestId: reasoningRequest.request_id,
        interactionId,
        evidenceHash: evidencePacket.evidence_hash,
        publishability: governance.publishability,
        reason,
      }),
    acceptanceValidator: (output) => {
      const responseValidation = validateReasoningResponse(output.response);
      const sideEffectValidation = validateReasoningSideEffects({
        memoryCandidates: output.memory_candidates,
        routingDecisions: output.routing_decisions,
        evidenceHash: evidencePacket.evidence_hash,
      });
      return {
        valid: responseValidation.valid && sideEffectValidation.valid,
        errors: [...responseValidation.errors, ...sideEffectValidation.errors],
        warnings: [],
      };
    },
  });

  const generated = gatewayResult.accepted_output;
  const responseValidation = validateReasoningResponse(generated.response);
  if (!responseValidation.valid) {
    await writeCaptainRuntimeAuditEvent(db, {
      event_type: "captain_runtime.response_validation_failed",
      actor: input.user_id,
      interaction_id: interactionId,
      before_state: generated.response,
      after_state: responseValidation,
      request_id: reasoningRequest.request_id,
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: directive.runtime_snapshot_hash ?? null,
    });
    throw new Error(`Captain runtime response failed validation: ${responseValidation.errors.join("; ")}`);
  }
  const sideEffectValidation = validateReasoningSideEffects({
    memoryCandidates: generated.memory_candidates,
    routingDecisions: generated.routing_decisions,
    evidenceHash: evidencePacket.evidence_hash,
  });
  if (!sideEffectValidation.valid) {
    await writeCaptainRuntimeAuditEvent(db, {
      event_type: "captain_runtime.side_effect_validation_failed",
      actor: input.user_id,
      interaction_id: interactionId,
      before_state: generated,
      after_state: sideEffectValidation,
      request_id: reasoningRequest.request_id,
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: directive.runtime_snapshot_hash ?? null,
    });
    throw new Error(`Captain runtime side effects failed validation: ${sideEffectValidation.errors.join("; ")}`);
  }
  const responseHash = await insertReasoningResponse(db, generated.response);
  await insertMemoryCandidates(db, generated.memory_candidates, generated.memory_payloads);
  await insertRoutingDecisions(db, generated.routing_decisions);
  await writeCaptainRuntimeAuditEvent(db, {
    event_type: "captain_runtime.reasoning_response_accepted",
    actor: input.user_id,
    interaction_id: interactionId,
    before_state: null,
    after_state: { response_id: generated.response.response_id, response_validation: responseValidation },
    request_id: reasoningRequest.request_id,
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: directive.runtime_snapshot_hash ?? null,
    response_hash: responseHash,
  });
  await writeCaptainRuntimeAuditEvent(db, {
    event_type: "captain_runtime.model_gateway_completed",
    actor: input.user_id,
    interaction_id: interactionId,
    before_state: null,
    after_state: {
      model_gateway_request_id: gatewayResult.request.request_id,
      model_gateway_response_id: gatewayResult.response.response_id,
      fallback_used: gatewayResult.fallback_used,
      validation_status: gatewayResult.response.validation_status,
      governance_status: gatewayResult.response.governance_status,
      adapter_id: gatewayResult.response.adapter_id,
    },
    request_id: reasoningRequest.request_id,
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: directive.runtime_snapshot_hash ?? null,
  });

  return {
    session,
    interaction,
    evidence_packet: evidencePacket,
    directive_resolution: directive,
    reasoning_request: reasoningRequest,
    runtime_payload: runtimePayload,
    reasoning_response: generated.response,
    memory_candidates: generated.memory_candidates,
    routing_decisions: generated.routing_decisions,
    governance,
  };
}

function assertDirectiveResolution(input: { expectedRoleId: string; directive: { active_directive_profile: { role_id: string; approval_status: string }; runtime_snapshot_id?: string; runtime_snapshot_hash?: string } }): void {
  if (input.directive.active_directive_profile.role_id !== input.expectedRoleId) {
    throw new Error(`Directive resolver returned ${input.directive.active_directive_profile.role_id}; expected ${input.expectedRoleId}.`);
  }
  if (input.directive.active_directive_profile.approval_status !== "active") {
    throw new Error("Runtime directive must be active.");
  }
  if (!input.directive.runtime_snapshot_id || !input.directive.runtime_snapshot_hash) {
    throw new Error("Runtime directive snapshot id/hash are required.");
  }
}

interface CaptainGatewayAcceptedOutput {
  response: CaptainReasoningResponse;
  memory_candidates: CaptainMemoryCandidate[];
  memory_payloads: Record<string, unknown>[];
  routing_decisions: CaptainRoutingDecision[];
}

function buildCaptainGatewayPayload(input: {
  requestId: string;
  propertyContext: unknown;
  runtimePayload: CaptainRuntimePayload;
  directive: { runtime_snapshot_id?: string | null; runtime_snapshot_hash?: string | null; active_directive_profile?: { role_id?: string | null }; publication_permissions?: unknown };
  evidencePacket: { evidence_packet_id: string; evidence_hash: string; property_id: string; included_sources: string[]; generated_at: string; evidence: Array<{ evidence_id: string; evidence_class: string; authority: string; freshness: string; confidence: number; summary: string }> };
}) {
  return {
    payload_id: `model_gateway_payload_${newId()}`,
    request_id: input.requestId,
    system_instructions: [
      "Captain Runtime operates under Directive Control Center, PropertyAccessControl, Evidence Packet, Quartermaster, and Fleet Scribe boundaries.",
      "Model output cannot mutate Data Pond, promote memory, self-authorize publication, bypass Quartermaster, or bypass Fleet Scribe.",
      "Return only structured output that fits the captain_runtime_response contract.",
    ],
    runtime_context: {
      property_context: input.propertyContext,
      governance_constraints: input.runtimePayload.governance_constraints,
      output_contract: input.runtimePayload.output_contract,
      role_identity: input.runtimePayload.role_identity,
      runtime_authority: input.runtimePayload.runtime_authority,
    },
    evidence_summary: {
      evidence_packet_id: input.evidencePacket.evidence_packet_id,
      evidence_hash: input.evidencePacket.evidence_hash,
      property_id: input.evidencePacket.property_id,
      included_sources: input.evidencePacket.included_sources,
      generated_at: input.evidencePacket.generated_at,
      evidence: input.evidencePacket.evidence.map((item) => ({
        evidence_id: item.evidence_id,
        evidence_class: item.evidence_class,
        authority: item.authority,
        freshness: item.freshness,
        confidence: item.confidence,
        summary: item.summary,
      })),
    },
    awareness_summary: {
      relevant_memory_count: input.runtimePayload.relevant_memory.length,
      relevant_memory: input.runtimePayload.relevant_memory,
    },
    directive_summary: {
      runtime_snapshot_id: (input.directive as any).runtime_snapshot_id ?? null,
      runtime_snapshot_hash: (input.directive as any).runtime_snapshot_hash ?? null,
      active_role_id: (input.directive as any).active_directive_profile?.role_id ?? null,
      publication_permissions: (input.directive as any).publication_permissions ?? null,
    },
    output_schema: describeStructuredOutputContract("captain_runtime_response"),
    redaction_summary: {},
    created_at: nowISO(),
  };
}

function buildCaptainGatewayFallback(input: {
  requestId: string;
  interactionId: string;
  evidenceHash: string;
  publishability: Publishability;
  reason: string;
}): CaptainGatewayAcceptedOutput {
  return {
    response: {
      response_id: `captain_reasoning_response_${newId()}`,
      request_id: input.requestId,
      conversational_response: "Captain Runtime returned a governed fallback response because the model gateway blocked or degraded the provider path.",
      reasoning_summary: `Fail-closed Captain Runtime fallback used: ${input.reason}`,
      structured_outputs: {
        memory_candidates: [],
        routing_decisions: [],
        escalation_needs: ["Review model gateway audit trail before attempting downstream action."],
        confidence_assessment: { confidence: 0.15, basis: "Fail-closed fallback." },
        publishability_assessment: { publishability: "blocked", reason: input.reason },
        required_followups: ["Review model gateway audit events and rerun only after governance-safe conditions are restored."],
        unresolved_conflicts: [],
      },
      confidence: 0.15,
      publishability: "blocked",
      escalation_required: true,
      generated_at: nowISO(),
    },
    memory_candidates: [],
    memory_payloads: [],
    routing_decisions: [
      {
        routing_id: `captain_routing_${newId()}`,
        interaction_id: input.interactionId,
        target_lane: "quartermaster",
        reason: `Model gateway fail-closed fallback: ${input.reason}`,
        status: "blocked",
      },
    ],
  };
}

function roleForIntent(intent: string): string {
  if (intent === "pricing_concern") return "revenue_advisor";
  if (intent === "website_concern" || intent === "content_suggestion" || intent === "amenity_update" || intent === "event_update") return "navigator";
  if (intent === "reputation_concern") return "reputation_officer";
  if (intent === "resident_issue") return "resident_experience_officer";
  if (intent === "leasing_concern" || intent === "recommendation_request") return "leasing_performance_advisor";
  if (intent === "approval_request") return "fleet_scribe_office";
  if (intent === "correction") return "quartermaster";
  return "captain_office";
}
