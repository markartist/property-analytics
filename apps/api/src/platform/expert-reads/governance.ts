import type { CaptainEvidencePacket } from "../captain-runtime/types";
import type { ExpertLaneResolution, ExpertReadGovernanceResult } from "./types";

export function enforceExpertReadGovernance(input: {
  lane: ExpertLaneResolution;
  evidencePacket: CaptainEvidencePacket;
}): ExpertReadGovernanceResult {
  const checks: ExpertReadGovernanceResult["checks"] = [];
  const evidence = input.evidencePacket.evidence;
  const hasCanonical = evidence.some((item) => item.authority === "canonical" && item.evidence_class === "canonical_fact");
  const humanClaims = evidence.filter((item) => item.evidence_class === "human_submitted_claim");
  const staleOrConflicting = evidence.filter((item) => item.freshness === "stale" || item.freshness === "conflicting");
  const blockedEvidence = evidence.filter((item) => item.freshness === "blocked" || item.evidence_class === "blocked_evidence");
  const bestConfidence = Math.max(...evidence.map((item) => item.confidence), 0);
  const requiredSourcesPresent = input.lane.required_evidence.filter((required) =>
    evidence.some((item) => evidenceMatchesRequirement(item.source_key, item.summary, required))
  );

  if (!hasCanonical) {
    checks.push({ check: "canonical_property_context", status: "block", reason: "Expert Reads require canonical property context." });
  } else {
    checks.push({ check: "canonical_property_context", status: "pass", reason: "Canonical property context is present." });
  }

  if (requiredSourcesPresent.length === 0) {
    checks.push({
      check: "required_evidence_presence",
      status: input.lane.lane_id === "quartermaster" ? "warn" : "block",
      reason: `No lane-specific required evidence matched ${input.lane.contract.display_name}.`,
    });
  } else {
    checks.push({ check: "required_evidence_presence", status: "pass", reason: `${requiredSourcesPresent.length} required evidence signal(s) matched.` });
  }

  if (humanClaims.length > 0) {
    checks.push({
      check: "human_claim_boundary",
      status: "warn",
      reason: "Human-submitted claims remain non-canonical and cannot become publishable Expert Read claims without verification.",
      affected_evidence_refs: humanClaims.map((item) => item.evidence_id),
    });
  }

  if (blockedEvidence.length > 0) {
    checks.push({
      check: "blocked_evidence",
      status: "block",
      reason: "Blocked evidence prevents a final publishable Expert Read.",
      affected_evidence_refs: blockedEvidence.map((item) => item.evidence_id),
    });
  }

  if (staleOrConflicting.length > 0 && input.lane.freshness_policy.staleSourceAction === "block") {
    checks.push({
      check: "freshness_policy",
      status: "block",
      reason: "The active directive requires stale/conflicting evidence to block Expert Read use.",
      affected_evidence_refs: staleOrConflicting.map((item) => item.evidence_id),
    });
  } else if (staleOrConflicting.length > 0) {
    checks.push({
      check: "freshness_policy",
      status: "warn",
      reason: "Stale or conflicting evidence must be labeled in the Expert Read.",
      affected_evidence_refs: staleOrConflicting.map((item) => item.evidence_id),
    });
  } else {
    checks.push({ check: "freshness_policy", status: "pass", reason: "No stale/conflicting evidence is present." });
  }

  if (bestConfidence < input.lane.confidence_thresholds.minimumConfidence) {
    checks.push({ check: "confidence_threshold", status: "block", reason: "Evidence confidence is below the lane directive minimum." });
  }

  applyLaneSpecificChecks(input, checks);

  const blocked = checks.some((check) => check.status === "block");
  const warnings = checks.some((check) => check.status === "warn");
  return {
    authority_level: blocked ? "blocked" : warnings ? "advisory" : "verified",
    publishability: blocked ? "blocked" : warnings ? "needs_verification" : "internal_only",
    escalation_required: blocked || bestConfidence < input.lane.confidence_thresholds.escalationConfidenceBelow,
    allowed_outputs: input.lane.allowed_outputs,
    blocked_outputs: input.lane.blocked_outputs,
    checks,
  };
}

function applyLaneSpecificChecks(
  input: { lane: ExpertLaneResolution; evidencePacket: CaptainEvidencePacket },
  checks: ExpertReadGovernanceResult["checks"]
): void {
  const evidenceText = input.evidencePacket.evidence.map((item) => `${item.source_key} ${item.summary}`).join(" ").toLowerCase();
  if (
    input.lane.lane_id === "navigator" &&
    input.evidencePacket.evidence.some((item) => item.evidence_class === "human_submitted_claim") &&
    /(public copy|write public|local|employer|nearby|usp|website copy|gbp|metadata)/i.test(evidenceText)
  ) {
    checks.push({ check: "navigator_public_claim_proof", status: "block", reason: "Navigator public copy recommendations cannot use human-submitted local claims without verified local proof." });
  }
  if (input.lane.lane_id === "revenue_advisor" && !/(exposure|rent|pricing|availability|competitor|concession|value)/i.test(evidenceText)) {
    checks.push({ check: "revenue_evidence_requirement", status: "block", reason: "Revenue recommendations require exposure, pricing, value, availability, or competitor evidence." });
  }
  if (input.lane.lane_id === "signals_officer" && !/(spend|source|guest card|visit|lease|move-in|conversion|funnel)/i.test(evidenceText)) {
    checks.push({ check: "signals_downstream_output", status: "block", reason: "Signals Officer cannot recommend spend posture without downstream channel output evidence." });
  }
  if (input.lane.lane_id === "product_readiness_officer" && !/(unit|availability|ready|make-ready|floorplan|inventory)/i.test(evidenceText)) {
    checks.push({ check: "product_readiness_evidence", status: "block", reason: "Product readiness claims require unit/feed/readiness evidence." });
  }
  if (input.lane.lane_id === "trust_and_proof_advisor" && !/(review|proof|source|evidence|website|competitor|gbp|reputation)/i.test(evidenceText)) {
    checks.push({ check: "trust_proof_requirement", status: "block", reason: "Trust claims require proof-bearing evidence before becoming recommendations." });
  }
  if (input.lane.lane_id === "quartermaster") {
    const blocked = input.evidencePacket.evidence.some((item) => item.freshness === "blocked" || item.evidence_class === "blocked_evidence");
    checks.push({
      check: "quartermaster_source_integrity",
      status: blocked ? "block" : "pass",
      reason: blocked ? "Quartermaster source integrity blocks downstream use." : "Quartermaster source integrity is not blocking this packet.",
    });
  }
}

function evidenceMatchesRequirement(sourceKey: string, summary: string, requirement: string): boolean {
  const haystack = `${sourceKey} ${summary}`.toLowerCase();
  return requirement
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 3)
    .some((part) => haystack.includes(part));
}
