import type { Env } from "../../env";
import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { sha256Hex } from "../directives/hashing";
import { findCommunityForRuntime } from "../captain-runtime/repository";
import { validateCaptainEvidencePacket } from "../captain-runtime/evidence";
import { executeModelGateway } from "../model-gateway/gateway";
import { describeStructuredOutputContract } from "../model-gateway/validation";
import { validateExpertEvidenceCompatibility } from "./evidence";
import { enforceExpertReadGovernance } from "./governance";
import { assertSourceRuntimeLineage, ensureExpertReadTables, getCaptainEvidencePacketById, getExpertReadByRequestHash, insertExpertRead, insertExpertReadRequest, writeExpertReadAuditEvent } from "./repository";
import { buildExpertReasoningPayload, executeDeterministicExpertRead, validateExpertRead, validateExpertReadPayload } from "./response";
import { resolveExpertLane } from "./resolver";
import type { ExpertRead, ExpertReadInput, ExpertReadRequest, ExpertReadResult, ExpertReadRoutingMode } from "./types";

export async function runExpertRead(
  db: D1Database,
  input: ExpertReadInput,
  env?: Partial<Env> | Partial<Record<string, string | undefined>>,
): Promise<ExpertReadResult> {
  await ensureExpertReadTables(db);
  const correlationId = input.correlation_id ?? `expert_read_corr_${newId()}`;
  const property = await findCommunityForRuntime(db, input.property_id);
  if (!property) throw new Error(`Unable to resolve property context for ${input.property_id}`);
  const propertyId = property.encasa_property_code ?? property.id;
  const runtimeMode = input.runtime_mode ?? "standard";
  const requestedAt = nowISO();
  const requestId = `expert_read_request_${newId()}`;

  await writeExpertReadAuditEvent(db, {
    event_type: "expert_read.request_received",
    request_id: requestId,
    expert_read_id: null,
    lane_id: input.lane_id,
    actor: input.requested_by,
    before_state: null,
    after_state: { property_id: propertyId, lane_id: input.lane_id, evidence_packet_id: input.evidence_packet_id },
    reason: input.reason,
    correlation_id: correlationId,
  });

  const evidencePacket = await getCaptainEvidencePacketById(db, input.evidence_packet_id);
  if (!evidencePacket) throw new Error(`Evidence packet ${input.evidence_packet_id} was not found.`);
  if (evidencePacket.property_id !== propertyId) {
    throw new Error(`Evidence packet property ${evidencePacket.property_id} does not match requested property ${propertyId}.`);
  }
  const evidenceValidation = validateCaptainEvidencePacket(evidencePacket);
  if (!evidenceValidation.valid) {
    await writeExpertReadAuditEvent(db, {
      event_type: "expert_read.evidence_validation_failed",
      request_id: requestId,
      expert_read_id: null,
      lane_id: input.lane_id,
      actor: input.requested_by,
      before_state: evidencePacket,
      after_state: evidenceValidation,
      reason: "Evidence packet failed Captain evidence validation.",
      correlation_id: correlationId,
    });
    throw new Error(`Expert Read evidence packet failed validation: ${evidenceValidation.errors.join("; ")}`);
  }
  await assertSourceRuntimeLineage(db, {
    property_id: propertyId,
    source_runtime_id: input.source_runtime_id ?? null,
    source_interaction_id: input.source_interaction_id ?? null,
  });

  const lane = await resolveExpertLane(db, {
    lane_id: input.lane_id,
    property_id: propertyId,
    runtime_mode: runtimeMode,
    report_family: input.report_family ?? "captain",
    as_of_date: requestedAt.slice(0, 10),
    evidence_packet_id: input.evidence_packet_id,
    actor: input.requested_by,
    request_id: requestId,
    correlation_id: correlationId,
  });
  const evidenceCompatibility = await validateExpertEvidenceCompatibility({ lane, evidencePacket, propertyId });
  if (!evidenceCompatibility.valid) {
    await writeExpertReadAuditEvent(db, {
      event_type: "expert_read.evidence_compatibility_failed",
      request_id: requestId,
      expert_read_id: null,
      lane_id: input.lane_id,
      actor: input.requested_by,
      before_state: { evidence_packet_id: evidencePacket.evidence_packet_id, evidence_hash: evidencePacket.evidence_hash },
      after_state: evidenceCompatibility,
      reason: "Evidence packet failed Expert Read lane compatibility validation.",
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: lane.directive_snapshot_hash,
    });
    throw new Error(`Expert Read evidence compatibility failed: ${evidenceCompatibility.errors.join("; ")}`);
  }
  await writeExpertReadAuditEvent(db, {
    event_type: evidenceCompatibility.warnings.length > 0 ? "expert_read.evidence_compatibility_warned" : "expert_read.evidence_compatibility_passed",
    request_id: requestId,
    expert_read_id: null,
    lane_id: input.lane_id,
    actor: input.requested_by,
    before_state: null,
    after_state: evidenceCompatibility,
    reason: "Evidence packet replay and lane compatibility checked.",
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: lane.directive_snapshot_hash,
  });
  const requestHash = await sha256Hex({
    property_id: propertyId,
    lane_id: input.lane_id,
    runtime_mode: runtimeMode,
    report_family: input.report_family ?? null,
    reason: input.reason,
    source_runtime_id: input.source_runtime_id ?? null,
    source_interaction_id: input.source_interaction_id ?? null,
    directive_snapshot_hash: lane.directive_snapshot_hash,
    evidence_packet_hash: evidencePacket.evidence_hash,
  });
  const existingRead = await getExpertReadByRequestHash(db, requestHash);
  if (existingRead) {
    await writeExpertReadAuditEvent(db, {
      event_type: "expert_read.duplicate_request_blocked",
      request_id: requestId,
      expert_read_id: String(existingRead.expert_read_id ?? ""),
      lane_id: input.lane_id,
      actor: input.requested_by,
      before_state: null,
      after_state: { existing_expert_read_id: existingRead.expert_read_id, request_hash: requestHash },
      reason: "Duplicate Expert Read request blocked by replay protection.",
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: lane.directive_snapshot_hash,
      read_hash: typeof existingRead.read_hash === "string" ? existingRead.read_hash : null,
    });
    throw new Error("Duplicate Expert Read request blocked by replay protection.");
  }
  const request: ExpertReadRequest = {
    request_id: requestId,
    property_id: propertyId,
    requested_by: input.requested_by,
    source_runtime_id: input.source_runtime_id ?? null,
    source_interaction_id: input.source_interaction_id ?? null,
    lane_id: input.lane_id,
    runtime_mode: runtimeMode,
    report_family: input.report_family ?? null,
    reason: input.reason,
    requested_at: requestedAt,
    directive_snapshot_id: lane.directive_snapshot_id,
    directive_snapshot_hash: lane.directive_snapshot_hash,
    evidence_packet_id: evidencePacket.evidence_packet_id,
    evidence_packet_hash: evidencePacket.evidence_hash,
    request_hash: requestHash,
  };
  await insertExpertReadRequest(db, request, correlationId);

  const governance = enforceExpertReadGovernance({ lane, evidencePacket });
  const payload = buildExpertReasoningPayload({ lane, evidencePacket, governance });
  const payloadValidation = validateExpertReadPayload(payload);
  if (!payloadValidation.valid) {
    await writeExpertReadAuditEvent(db, {
      event_type: "expert_read.payload_validation_failed",
      request_id: requestId,
      expert_read_id: null,
      lane_id: input.lane_id,
      actor: input.requested_by,
      before_state: payload,
      after_state: payloadValidation,
      reason: "Structured Expert Read payload failed validation.",
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: lane.directive_snapshot_hash,
    });
    throw new Error(`Expert Read payload failed validation: ${payloadValidation.errors.join("; ")}`);
  }
  const payloadHash = await sha256Hex(payload);
  await writeExpertReadAuditEvent(db, {
    event_type: "expert_read.payload_generated",
    request_id: requestId,
    expert_read_id: null,
    lane_id: input.lane_id,
    actor: input.requested_by,
    before_state: null,
    after_state: { payload_id: payload.payload_id, payload_hash: payloadHash },
    reason: "Generated deterministic Expert Read payload.",
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: lane.directive_snapshot_hash,
  });

  const gatewayResult = await executeModelGateway<Omit<ExpertRead, "read_hash">>(db, env, {
    request: {
      request_id: `model_gateway_request_${newId()}`,
      correlation_id: correlationId,
      source_system: "expert_reads",
      source_runtime_id: input.source_runtime_id ?? null,
      source_interaction_id: input.source_interaction_id ?? null,
      expert_read_request_id: requestId,
      property_id: propertyId,
      region_id: property.region ?? null,
      actor_id: input.requested_by,
      runtime_mode: runtimeMode,
      directive_snapshot_id: lane.directive_snapshot_id,
      directive_snapshot_hash: lane.directive_snapshot_hash,
      evidence_packet_id: evidencePacket.evidence_packet_id,
      evidence_packet_hash: evidencePacket.evidence_hash,
      awareness_context_hash: await sha256Hex({
        required_evidence: lane.required_evidence,
        blocked_outputs: governance.blocked_outputs,
        checks: governance.checks,
      }),
      allowed_output_contract: "expert_read_response",
      blocked_outputs: governance.blocked_outputs,
      call_mode: "deterministic",
      requested_at: requestedAt,
    },
    payload: buildExpertGatewayPayload({ payload, lane, governance }),
    outputContract: "expert_read_response",
    deterministicExecutor: async () => executeDeterministicExpertRead({ request, lane, payload, governance }),
    fallbackFactory: (reason) => buildExpertGatewayFallback({ request, lane, payload, governance, reason }),
    acceptanceValidator: (output) => {
      const validation = validateExpertRead(output);
      return { ...validation, warnings: [] };
    },
  });
  const generated = gatewayResult.accepted_output;
  const readValidation = validateExpertRead(generated);
  if (!readValidation.valid) {
    await writeExpertReadAuditEvent(db, {
      event_type: "expert_read.output_validation_failed",
      request_id: requestId,
      expert_read_id: generated.expert_read_id,
      lane_id: input.lane_id,
      actor: input.requested_by,
      before_state: generated,
      after_state: readValidation,
      reason: "Structured Expert Read output failed validation.",
      correlation_id: correlationId,
      evidence_hash: evidencePacket.evidence_hash,
      directive_hash: lane.directive_snapshot_hash,
    });
    throw new Error(`Expert Read output failed validation: ${readValidation.errors.join("; ")}`);
  }
  const expertRead = await insertExpertRead(db, generated, payloadHash);
  await writeExpertReadAuditEvent(db, {
    event_type: "expert_read.finalized",
    request_id: requestId,
    expert_read_id: expertRead.expert_read_id,
    lane_id: input.lane_id,
    actor: input.requested_by,
    before_state: null,
    after_state: { read_hash: expertRead.read_hash, read_status: expertRead.read_status, publishability: expertRead.publishability },
    reason: "Expert Read persisted as governed specialist contribution.",
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: lane.directive_snapshot_hash,
    read_hash: expertRead.read_hash,
  });
  await writeExpertReadAuditEvent(db, {
    event_type: "expert_read.model_gateway_completed",
    request_id: requestId,
    expert_read_id: expertRead.expert_read_id,
    lane_id: input.lane_id,
    actor: input.requested_by,
    before_state: null,
    after_state: {
      model_gateway_request_id: gatewayResult.request.request_id,
      model_gateway_response_id: gatewayResult.response.response_id,
      fallback_used: gatewayResult.fallback_used,
      validation_status: gatewayResult.response.validation_status,
      governance_status: gatewayResult.response.governance_status,
      adapter_id: gatewayResult.response.adapter_id,
    },
    reason: "Expert Read finalized through Model Provider Gateway abstraction.",
    correlation_id: correlationId,
    evidence_hash: evidencePacket.evidence_hash,
    directive_hash: lane.directive_snapshot_hash,
    read_hash: expertRead.read_hash,
  });

  return { request, lane_resolution: lane, evidence_packet: evidencePacket, governance, payload: redactPayload(payload), expert_read: expertRead };
}

export function decideExpertReadRoutingMode(input: {
  target_lane?: string | null;
  governanceBlocked?: boolean;
  confidence?: number | null;
  requestedExplicitly?: boolean;
}): ExpertReadRoutingMode {
  if (input.governanceBlocked) return "blocked_pending_expert_read";
  if (input.requestedExplicitly) return "required_expert_read";
  if (input.target_lane && input.target_lane !== "captain_office") return "optional_expert_read";
  if (typeof input.confidence === "number" && input.confidence < 0.65) return "optional_expert_read";
  return "no_expert_needed";
}

function redactPayload<T extends { evidence_packet: unknown }>(payload: T): T {
  return {
    ...payload,
    evidence_packet: {
      ...(payload.evidence_packet as any),
      evidence: (payload.evidence_packet as any).evidence?.map((item: any) => ({
        evidence_id: item.evidence_id,
        evidence_class: item.evidence_class,
        source_key: item.source_key,
        authority: item.authority,
        freshness: item.freshness,
        confidence: item.confidence,
        summary: item.summary,
      })),
    },
  };
}

function buildExpertGatewayPayload(input: {
  payload: import("./types").ExpertReasoningPayload;
  lane: import("./types").ExpertLaneResolution;
  governance: import("./types").ExpertReadGovernanceResult;
}) {
  return {
    payload_id: `model_gateway_payload_${newId()}`,
    request_id: `expert_gateway_payload_${newId()}`,
    system_instructions: [
      "Expert Reads are specialist contributions, not final publications.",
      "Model output cannot publish reports, promote memory, mutate Data Pond, bypass Quartermaster, or bypass Fleet Scribe.",
      "Return only structured output that fits the expert_read_response contract.",
    ],
    runtime_context: {
      lane_id: input.lane.lane_id,
      role_identity: input.payload.role_identity,
      required_output_sections: input.payload.output_contract,
      allowed_outputs: input.governance.allowed_outputs,
      blocked_outputs: input.governance.blocked_outputs,
    },
    evidence_summary: {
      evidence_packet_id: input.payload.evidence_packet.evidence_packet_id,
      evidence_hash: input.payload.evidence_packet.evidence_hash,
      included_sources: input.payload.evidence_packet.included_sources,
      generated_at: input.payload.evidence_packet.generated_at,
      evidence: input.payload.evidence_packet.evidence.map((item) => ({
        evidence_id: item.evidence_id,
        evidence_class: item.evidence_class,
        authority: item.authority,
        freshness: item.freshness,
        confidence: item.confidence,
        summary: item.summary,
      })),
    },
    awareness_summary: {
      governance_checks: input.governance.checks,
      freshness_policy: input.lane.freshness_policy,
    },
    directive_summary: {
      directive_snapshot_id: input.payload.directive_snapshot_id,
      directive_snapshot_hash: input.payload.directive_snapshot_hash,
      publication_constraints: input.lane.publication_constraints,
      escalation_rules: input.lane.escalation_rules,
    },
    output_schema: describeStructuredOutputContract("expert_read_response"),
    redaction_summary: {},
    created_at: nowISO(),
  };
}

function buildExpertGatewayFallback(input: {
  request: ExpertReadRequest;
  lane: import("./types").ExpertLaneResolution;
  payload: import("./types").ExpertReasoningPayload;
  governance: import("./types").ExpertReadGovernanceResult;
  reason: string;
}): Omit<ExpertRead, "read_hash"> {
  const expertReadId = `expert_read_${newId()}`;
  const evidenceRefs = input.payload.evidence_packet.evidence.slice(0, 8).map((item) => item.evidence_id);
  return {
    expert_read_id: expertReadId,
    request_id: input.request.request_id,
    lane_id: input.lane.lane_id,
    property_id: input.request.property_id,
    read_status: "blocked",
    specialist_summary: `Expert Read returned a governed fallback because the Model Provider Gateway blocked or degraded the provider path: ${input.reason}`,
    findings: [
      {
        finding_id: `expert_read_finding_${newId()}`,
        expert_read_id: expertReadId,
        finding_type: "governance_block",
        statement: `Model Provider Gateway fail-closed fallback prevented a specialist recommendation from advancing without governed validation: ${input.reason}`,
        evidence_refs: evidenceRefs.length > 0 ? evidenceRefs : ["gateway_fallback"],
        confidence: 0.1,
        freshness: "blocked",
        publishability: "blocked",
        verification_required: true,
      },
    ],
    recommendations: [
      {
        recommendation_id: `expert_read_recommendation_${newId()}`,
        expert_read_id: expertReadId,
        recommendation_type: "hold",
        recommendation_text: "Hold Expert Read publication or downstream use until the Model Provider Gateway issue is resolved and the governed run is retried.",
        evidence_refs: evidenceRefs.length > 0 ? evidenceRefs : ["gateway_fallback"],
        proof_metric: null,
        owner_lane: input.lane.lane_id,
        confidence: 0.1,
        blocked_reason: input.reason,
        publishability: "blocked",
      },
    ],
    do_not_do_rules: input.lane.contract.default_do_not_do_rules,
    required_evidence: input.lane.required_evidence,
    evidence_used: input.payload.evidence_packet.included_sources,
    confidence: 0.1,
    freshness_state: "blocked",
    publishability: "blocked",
    escalation_required: true,
    conflicts: [input.reason],
    generated_at: nowISO(),
  };
}
