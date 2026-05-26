import { newId } from "../../lib/id";
import { nowISO } from "../../lib/validate";
import { canonicalJson, sha256Hex } from "../directives/hashing";
import type { CaptainEvidenceItem, CaptainEvidencePacket } from "./types";
import type { PropertyRuntimeContext } from "./context";

export async function buildCaptainEvidencePacket(input: {
  propertyId: string;
  directiveSnapshotId?: string | null;
  context: PropertyRuntimeContext;
  userClaim: string;
}): Promise<CaptainEvidencePacket> {
  const evidence: CaptainEvidenceItem[] = [];
  evidence.push({
    evidence_id: `evidence_${newId()}`,
    evidence_class: "canonical_fact",
    source_key: "communities",
    source_table: "communities",
    source_ref: String(input.context.property.id ?? input.propertyId),
    authority: "canonical",
    freshness: "current",
    confidence: 1,
    summary: `Resolved property context for ${String(input.context.property.name ?? input.propertyId)}.`,
    payload: input.context.property,
  });
  for (const item of input.context.active_watch_items.slice(0, 6)) {
    evidence.push({
      evidence_id: `evidence_${newId()}`,
      evidence_class: "verified_operational_fact",
      source_key: "captain_watch_items",
      source_table: "captain_watch_items",
      source_ref: String(item.title ?? ""),
      authority: "verified",
      freshness: freshnessFromUpdatedAt(String(item.updated_at ?? "")),
      confidence: 0.86,
      summary: String(item.current_state ?? item.title ?? "Active watch item."),
      payload: item,
    });
  }
  for (const item of input.context.active_actions.slice(0, 6)) {
    evidence.push({
      evidence_id: `evidence_${newId()}`,
      evidence_class: "verified_operational_fact",
      source_key: "captain_actions",
      source_table: "captain_actions",
      source_ref: String(item.title ?? ""),
      authority: "verified",
      freshness: freshnessFromUpdatedAt(String(item.updated_at ?? "")),
      confidence: 0.82,
      summary: String(item.title ?? "Active Captain action."),
      payload: item,
    });
  }
  for (const item of input.context.recent_memory.slice(0, 5)) {
    evidence.push({
      evidence_id: `evidence_${newId()}`,
      evidence_class: String(item.status) === "active" ? "verified_operational_fact" : "advisory_observation",
      source_key: "governed_memory_entries",
      source_table: "governed_memory_entries",
      source_ref: String(item.id ?? ""),
      authority: String(item.status) === "active" ? "verified" : "advisory",
      freshness: freshnessFromUpdatedAt(String(item.created_at ?? "")),
      confidence: Number(item.confidence ?? 0.6),
      summary: String(item.summary ?? "Recent governed memory."),
      payload: item,
    });
  }
  evidence.push({
    evidence_id: `evidence_${newId()}`,
    evidence_class: "human_submitted_claim",
    source_key: "runtime_user_input",
    source_table: null,
    source_ref: null,
    authority: "claim",
    freshness: "current",
    confidence: 0.5,
    summary: input.userClaim.slice(0, 280),
    payload: { input_text: input.userClaim },
  });

  const included_sources = Array.from(new Set(evidence.map((item) => item.source_key)));
  const freshness_state = summarizeFreshness(evidence);
  const generated_at = nowISO();
  const stableEvidence = evidence.map(({ evidence_id: _evidenceId, ...item }) => item);
  const evidence_hash = await sha256Hex({
    property_id: input.propertyId,
    directive_snapshot_id: input.directiveSnapshotId ?? null,
    included_sources,
    freshness_state,
    evidence: stableEvidence,
  });
  return {
    evidence_packet_id: `captain_evidence_packet_${newId()}`,
    property_id: input.propertyId,
    included_sources,
    freshness_state,
    evidence_hash,
    generated_at,
    directive_snapshot_id: input.directiveSnapshotId ?? null,
    evidence,
  };
}

export function validateCaptainEvidencePacket(packet: CaptainEvidencePacket): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!packet.property_id.trim()) errors.push("property_id is required.");
  if (!packet.directive_snapshot_id) errors.push("directive_snapshot_id is required.");
  if (!packet.evidence_hash.trim()) errors.push("evidence_hash is required.");
  if (packet.evidence.length === 0) errors.push("at least one evidence item is required.");
  if (!packet.evidence.some((item) => item.evidence_class === "canonical_fact" && item.authority === "canonical")) {
    errors.push("canonical property evidence is required.");
  }
  if (!packet.evidence.some((item) => item.evidence_class === "human_submitted_claim" && item.authority === "claim")) {
    errors.push("human submitted input must remain claim-class evidence.");
  }
  for (const item of packet.evidence) {
    if (item.confidence < 0 || item.confidence > 1) errors.push(`confidence out of range for ${item.source_key}.`);
    if (!item.source_key.trim()) errors.push("evidence source_key is required.");
    if (!item.summary.trim()) errors.push(`evidence summary is required for ${item.source_key}.`);
  }
  return { valid: errors.length === 0, errors };
}

function freshnessFromUpdatedAt(value: string): CaptainEvidenceItem["freshness"] {
  if (!value) return "unknown";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "unknown";
  const ageDays = (Date.now() - parsed) / 86_400_000;
  return ageDays > 30 ? "stale" : "current";
}

function summarizeFreshness(evidence: CaptainEvidenceItem[]): Record<string, unknown> {
  const bySource: Record<string, { current: number; stale: number; unknown: number; conflicting: number; blocked: number }> = {};
  for (const item of evidence) {
    bySource[item.source_key] ??= { current: 0, stale: 0, unknown: 0, conflicting: 0, blocked: 0 };
    bySource[item.source_key][item.freshness] += 1;
  }
  return {
    by_source: bySource,
    packet_state: evidence.some((item) => item.freshness === "blocked")
      ? "blocked"
      : evidence.some((item) => item.freshness === "stale" || item.freshness === "conflicting")
        ? "needs_review"
        : "usable",
    evidence_digest: canonicalJson(evidence.map((item) => ({ source: item.source_key, class: item.evidence_class, authority: item.authority }))),
  };
}
