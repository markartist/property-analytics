import { nowISO } from "../../lib/validate";
import { sha256Hex } from "../directives/hashing";
import { executeModelGateway } from "./gateway";

export interface CloudflareShadowSmokeResult {
  attempted: boolean;
  calledCloudflare: boolean;
  acceptedOutputSource: "deterministic";
  fallbackUsed: boolean;
  reason: string;
  skipReason: string | null;
  gatewayRequestId: string | null;
  shadowResultCount: number;
}

export async function runSyntheticCloudflareShadowSmoke(
  db: D1Database,
  env: Partial<Record<string, string | undefined>>,
): Promise<CloudflareShadowSmokeResult> {
  if (env.RUN_CLOUDFLARE_SHADOW_SMOKE !== "true") {
    return {
      attempted: false,
      calledCloudflare: false,
      acceptedOutputSource: "deterministic",
      fallbackUsed: false,
      reason: "RUN_CLOUDFLARE_SHADOW_SMOKE is not true; smoke test did not run.",
      skipReason: "RUN_CLOUDFLARE_SHADOW_SMOKE is not true.",
      gatewayRequestId: null,
      shadowResultCount: 0,
    };
  }

  const now = nowISO();
  const evidenceHash = await sha256Hex({ synthetic: true, smoke: "cloudflare_shadow" });
  const requestId = "synthetic_shadow_smoke_request";
  const result = await executeModelGateway(db, env, {
    request: {
      request_id: requestId,
      correlation_id: "synthetic_shadow_smoke_correlation",
      source_system: "simulation",
      source_runtime_id: "synthetic_shadow_runtime",
      source_interaction_id: "synthetic_shadow_interaction",
      expert_read_request_id: null,
      property_id: "SYNTHETIC_SHADOW_PROPERTY",
      region_id: "Synthetic",
      actor_id: "synthetic_shadow_operator",
      runtime_mode: "simulation",
      directive_snapshot_id: "synthetic_shadow_directive",
      directive_snapshot_hash: "synthetic_shadow_directive_hash",
      evidence_packet_id: "synthetic_shadow_evidence_packet",
      evidence_packet_hash: evidenceHash,
      awareness_context_hash: "synthetic_shadow_awareness_hash",
      allowed_output_contract: "classification_response",
      blocked_outputs: ["public_copy", "report_publication", "memory_promotion", "data_pond_mutation"],
      call_mode: "shadow",
      requested_at: now,
    },
    payload: {
      payload_id: "synthetic_shadow_smoke_payload",
      request_id: requestId,
      system_instructions: [
        "Synthetic smoke test only. Return classification JSON only.",
        "Do not create memory, routing, reports, publication, or Data Pond mutations.",
      ],
      runtime_context: {
        synthetic: true,
        scenario: "Classify an unverified amenity claim as claim-level and not publishable.",
        claim: "Synthetic manager says a sample amenity was updated.",
      },
      evidence_summary: {
        synthetic: true,
        evidence_packet_id: "synthetic_shadow_evidence_packet",
        evidence_hash: evidenceHash,
        claim_level: true,
        freshness: "synthetic",
      },
      awareness_summary: {
        synthetic: true,
        noncanonical: true,
      },
      directive_summary: {
        synthetic: true,
        blocked_outputs: ["public_copy", "report_publication", "memory_promotion", "data_pond_mutation"],
      },
      output_schema: {
        type: "object",
        required: ["label", "confidence", "rationale", "evidence_refs", "uncertainty"],
        properties: {
          label: { type: "string" },
          confidence: { type: "number" },
          rationale: { type: "string" },
          evidence_refs: { type: "array", items: { type: "string" } },
          uncertainty: { type: "array", items: { type: "string" } },
        },
      },
      created_at: now,
    },
    outputContract: "classification_response",
    deterministicExecutor: () => ({
      label: "synthetic_claim_level",
      confidence: 0.99,
      rationale: "Deterministic synthetic baseline labels the claim as unverified and nonpublishable.",
      evidence_refs: ["synthetic_shadow_evidence_packet"],
      uncertainty: ["claim_level", "verification_required", "not_publishable"],
    }),
    fallbackFactory: (reason) => ({
      label: "synthetic_fallback",
      confidence: 0,
      rationale: reason,
      evidence_refs: ["synthetic_shadow_evidence_packet"],
      uncertainty: [reason],
    }),
  });

  const shadowRows = await db.prepare(
    `SELECT COUNT(*) AS count FROM model_gateway_shadow_results WHERE gateway_request_id = ?`,
  ).bind(result.request.request_id).first<{ count: number }>();
  const shadowAttempted = result.audit_events.some((event) => event.event_type === "model_gateway.shadow_provider_call_started");
  const skipped = result.audit_events.find((event) => event.event_type === "model_gateway.shadow_provider_skipped");
  return {
    attempted: true,
    calledCloudflare: shadowAttempted,
    acceptedOutputSource: "deterministic",
    fallbackUsed: result.fallback_used,
    reason: shadowAttempted
      ? "Synthetic shadow smoke executed through the gateway. Accepted output remained deterministic."
      : "Synthetic smoke ran, but Cloudflare shadow provider call was skipped by configuration.",
    skipReason: shadowAttempted ? null : skipped?.reason ?? "Cloudflare shadow provider call was skipped by configuration.",
    gatewayRequestId: result.request.request_id,
    shadowResultCount: Number(shadowRows?.count ?? 0),
  };
}
