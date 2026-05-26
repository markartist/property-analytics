import { canonicalJson, sha256Hex } from "../directives/hashing";
import type { CaptainEvidenceItem, CaptainEvidencePacket } from "../captain-runtime/types";
import type { ExpertLaneResolution } from "./types";

export interface ExpertEvidenceCompatibilityResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  replay_hash: string | null;
}

export async function validateExpertEvidenceCompatibility(input: {
  lane: ExpertLaneResolution;
  evidencePacket: CaptainEvidencePacket;
  propertyId: string;
}): Promise<ExpertEvidenceCompatibilityResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (input.evidencePacket.property_id !== input.propertyId) {
    errors.push(`Evidence packet property ${input.evidencePacket.property_id} does not match requested property ${input.propertyId}.`);
  }
  if (!input.evidencePacket.directive_snapshot_id) {
    errors.push("Evidence packet directive_snapshot_id is required.");
  }
  if (!input.evidencePacket.evidence_hash) {
    errors.push("Evidence packet hash is required.");
  }
  const replay_hash = await replayCaptainEvidenceHash(input.evidencePacket);
  if (input.evidencePacket.evidence_hash && replay_hash !== input.evidencePacket.evidence_hash) {
    errors.push("Evidence packet hash does not match replayed evidence hash.");
  }
  if (!input.evidencePacket.evidence.some((item) => item.evidence_class === "canonical_fact" && item.authority === "canonical")) {
    errors.push("Expert Reads require canonical property evidence.");
  }
  if (input.evidencePacket.evidence.some((item) => item.freshness === "conflicting")) {
    warnings.push("Evidence packet contains conflicting evidence and must remain nonpublishable unless Quartermaster clears it.");
  }
  if (input.evidencePacket.evidence.some((item) => item.freshness === "stale")) {
    warnings.push("Evidence packet contains stale evidence and must be labeled by the Expert Read.");
  }
  const requiredMatches = input.lane.required_evidence.filter((required) =>
    input.evidencePacket.evidence.some((item) => evidenceMatchesRequirement(item, required))
  );
  if (requiredMatches.length === 0 && input.lane.lane_id !== "quartermaster") {
    warnings.push(`Evidence packet does not contain lane-compatible evidence for ${input.lane.contract.display_name}; lane governance must block unsupported findings.`);
  }
  return { valid: errors.length === 0, errors, warnings, replay_hash };
}

export async function replayCaptainEvidenceHash(packet: CaptainEvidencePacket): Promise<string> {
  const stableEvidence = packet.evidence.map(({ evidence_id: _evidenceId, ...item }) => item);
  return sha256Hex({
    property_id: packet.property_id,
    directive_snapshot_id: packet.directive_snapshot_id ?? null,
    included_sources: packet.included_sources,
    freshness_state: packet.freshness_state,
    evidence: stableEvidence,
  });
}

function evidenceMatchesRequirement(item: CaptainEvidenceItem, requirement: string): boolean {
  const haystack = `${item.source_key} ${item.summary} ${canonicalJson(item.payload)}`.toLowerCase();
  return requirement
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 3)
    .some((part) => haystack.includes(part));
}
