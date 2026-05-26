import type { DirectiveResolutionOutput } from "../directives/types";
import type { CaptainEvidencePacket, CaptainInteractionIntent, AuthorityLevel, Publishability } from "./types";

export function enforceCaptainRuntimeGovernance(input: {
  intent: CaptainInteractionIntent;
  directive: DirectiveResolutionOutput;
  evidencePacket: CaptainEvidencePacket;
  runtimeMode: string;
}) {
  const checks: Array<{ check: string; status: "pass" | "warn" | "block"; reason: string }> = [];
  const allowed_outputs = ["conversational_response", "reasoning_summary", "memory_candidates", "routing_decisions", "required_followups"];
  const blocked_outputs = [
    "canonical_fact_mutation",
    "direct_database_write_by_gpt",
    "unapproved_external_message",
    "executive_publication_without_fleet_scribe",
  ];

  const hasHumanClaim = input.evidencePacket.evidence.some((item) => item.evidence_class === "human_submitted_claim");
  const hasCanonical = input.evidencePacket.evidence.some((item) => item.authority === "canonical");
  const hasStale = input.evidencePacket.evidence.some((item) => item.freshness === "stale" || item.freshness === "conflicting");
  const minimumConfidence = input.directive.confidence_thresholds.minimumConfidence;
  const bestEvidenceConfidence = Math.max(...input.evidencePacket.evidence.map((item) => item.confidence), 0);

  if (!hasCanonical) {
    checks.push({ check: "canonical_property_context", status: "block", reason: "No canonical property fact is present in the evidence packet." });
  } else {
    checks.push({ check: "canonical_property_context", status: "pass", reason: "Property context is grounded in Data Pond community data." });
  }
  if (hasHumanClaim) {
    checks.push({ check: "human_input_truth_boundary", status: "warn", reason: "Human input is captured as a claim and cannot become canonical truth without verification." });
  }
  if (hasStale && input.directive.freshness_policy.staleSourceAction === "block") {
    checks.push({ check: "freshness_policy", status: "block", reason: "Directive stale-source policy blocks recommendation use until evidence is refreshed." });
  } else if (hasStale) {
    checks.push({ check: "freshness_policy", status: "warn", reason: "Some evidence is stale or conflicting and must be labeled." });
  } else {
    checks.push({ check: "freshness_policy", status: "pass", reason: "Evidence packet has no stale/conflicting evidence." });
  }
  if (bestEvidenceConfidence < minimumConfidence) {
    checks.push({ check: "confidence_threshold", status: "block", reason: "Evidence confidence is below the active directive minimum." });
  }
  if (input.intent === "approval_request" && !input.directive.publication_permissions.requiresFleetScribe) {
    checks.push({ check: "fleet_scribe_boundary", status: "block", reason: "Publication approval cannot bypass Fleet Scribe controls." });
  } else {
    checks.push({ check: "fleet_scribe_boundary", status: "pass", reason: "Fleet Scribe publication boundary remains intact." });
  }

  const blocked = checks.some((check) => check.status === "block");
  const authority_level: AuthorityLevel = blocked ? "blocked" : hasHumanClaim ? "claim" : "verified";
  let publishability: Publishability = blocked
    ? "blocked"
    : hasHumanClaim || hasStale
      ? "needs_verification"
    : input.directive.publication_permissions.canPublishInternalBrief && !input.directive.publication_permissions.canPublishExecutiveArtifact
      ? "internal_only"
      : "internal_only";

  blocked_outputs.push("publishable_claim_without_verification");

  return {
    allowed_outputs,
    blocked_outputs,
    authority_level,
    publishability,
    escalation_required: checks.some((check) => check.status === "block") || bestEvidenceConfidence < input.directive.confidence_thresholds.escalationConfidenceBelow,
    checks,
  };
}
