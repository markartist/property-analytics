import { queryAll } from "../../lib/db";
import { ensureGovernedMemoryTables } from "../memory/governed-memory";

export type BriefCompletenessStatus = "incomplete" | "partial" | "ready";

export type BriefCompletenessResult = {
  property_id: string;
  completeness_score: number;
  completeness_status: BriefCompletenessStatus;
  missing_components: string[];
  captain_log_count: number;
  claim_count: number;
  evidence_count: number;
  confidence: number | null;
  last_updated_at: string | null;
  migration_candidates: string[];
};

type CaptainLogRow = {
  property_id: string;
  summary: string;
  structured_payload_json: string | null;
  confidence: number;
  updated_at: string;
};

type ClaimRow = {
  id: string;
  property_id: string | null;
  status: string;
};

type ClaimEvidenceRow = {
  claim_id: string;
  evidence_count: number;
};

type BriefInputs = {
  propertyId: string;
  captainEntries: CaptainLogRow[];
  claims: ClaimRow[];
  claimEvidenceCounts: Map<string, number>;
  approvedPoints: string;
  now: Date;
};

const READINESS_WINDOW_DAYS = 45;
const REQUIRED_COMPONENTS = [
  "captains_log",
  "summary",
  "priorities",
  "claims",
  "evidence",
  "confidence",
  "recent_update",
];

function parsePayloadJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim().length > 0) as string[];
  if (typeof value === "string") {
    return value
      .split(/\n|•|-/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function deriveMigrationCandidates(approvedPoints: string): string[] {
  return normalizeList(approvedPoints).slice(0, 8);
}

function computeBriefCompleteness(input: BriefInputs): BriefCompletenessResult {
  const { propertyId, captainEntries, claims, claimEvidenceCounts, approvedPoints, now } = input;
  const latestEntry = [...captainEntries].sort((a, b) => (a.updated_at > b.updated_at ? -1 : 1))[0] ?? null;
  const payload = parsePayloadJson(latestEntry?.structured_payload_json ?? null);
  const priorities = [
    ...normalizeList(payload?.messaging_priorities),
    ...normalizeList(payload?.priorities),
    ...normalizeList(payload?.recommendations),
  ];

  const hasCaptainLog = captainEntries.length > 0;
  const hasSummary = Boolean(latestEntry?.summary?.trim());
  const hasPriorities = priorities.length > 0;
  const hasClaims = claims.length > 0;
  const evidenceCount = claims.reduce((sum, claim) => sum + (claimEvidenceCounts.get(claim.id) ?? 0), 0);
  const hasEvidence = evidenceCount > 0;
  const hasConfidence = typeof latestEntry?.confidence === "number" && latestEntry.confidence > 0;
  const updatedAt = latestEntry?.updated_at ?? null;
  const recentThreshold = new Date(now.getTime() - READINESS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const hasRecentUpdate = updatedAt ? new Date(updatedAt) >= recentThreshold : false;

  const missing: string[] = [];
  if (!hasCaptainLog) missing.push("captains_log");
  if (!hasSummary) missing.push("summary");
  if (!hasPriorities) missing.push("priorities");
  if (!hasClaims) missing.push("claims");
  if (!hasEvidence) missing.push("evidence");
  if (!hasConfidence) missing.push("confidence");
  if (!hasRecentUpdate) missing.push("recent_update");

  const completenessScore = Math.round(((REQUIRED_COMPONENTS.length - missing.length) / REQUIRED_COMPONENTS.length) * 100);
  const completenessStatus: BriefCompletenessStatus =
    missing.length === 0
      ? "ready"
      : missing.includes("captains_log")
        ? "incomplete"
        : "partial";

  return {
    property_id: propertyId,
    completeness_score: completenessScore,
    completeness_status: completenessStatus,
    missing_components: missing,
    captain_log_count: captainEntries.length,
    claim_count: claims.length,
    evidence_count: evidenceCount,
    confidence: latestEntry?.confidence ?? null,
    last_updated_at: updatedAt,
    migration_candidates: deriveMigrationCandidates(approvedPoints),
  };
}

export async function getBriefCompletenessMap(
  db: D1Database,
  propertyRows: Array<{ property_id: string; approved_points: string }>
): Promise<Record<string, BriefCompletenessResult>> {
  if (propertyRows.length === 0) return {};
  await ensureGovernedMemoryTables(db);
  const propertyIds = propertyRows.map((row) => row.property_id);
  const now = new Date();

  const captainEntries = await queryAll<CaptainLogRow>(
    db,
    `SELECT property_id, summary, structured_payload_json, confidence, updated_at
     FROM governed_memory_entries
     WHERE scope = 'property' AND status = 'active' AND property_id IN (${propertyIds.map(() => "?").join(",")})`,
    propertyIds
  );

  const claims = await queryAll<ClaimRow>(
    db,
    `SELECT id, property_id, status
     FROM intelligence_claims
     WHERE status = 'active' AND applicable_scope = 'property' AND property_id IN (${propertyIds.map(() => "?").join(",")})`,
    propertyIds
  );

  const claimEvidenceCounts = claims.length
    ? await queryAll<ClaimEvidenceRow>(
        db,
        `SELECT claim_id, COUNT(*) as evidence_count
         FROM intelligence_claim_evidence
         WHERE claim_id IN (${claims.map(() => "?").join(",")})
         GROUP BY claim_id`,
        claims.map((claim) => claim.id)
      )
    : [];

  const evidenceMap = new Map<string, number>(
    claimEvidenceCounts.map((row) => [row.claim_id, Number(row.evidence_count)])
  );

  const entriesByProperty = new Map<string, CaptainLogRow[]>();
  captainEntries.forEach((entry) => {
    const list = entriesByProperty.get(entry.property_id) ?? [];
    list.push(entry);
    entriesByProperty.set(entry.property_id, list);
  });

  const claimsByProperty = new Map<string, ClaimRow[]>();
  claims.forEach((claim) => {
    const list = claimsByProperty.get(claim.property_id ?? "") ?? [];
    list.push(claim);
    claimsByProperty.set(claim.property_id ?? "", list);
  });

  const result: Record<string, BriefCompletenessResult> = {};
  for (const row of propertyRows) {
    const propertyCaptainEntries = entriesByProperty.get(row.property_id) ?? [];
    const propertyClaims = claimsByProperty.get(row.property_id) ?? [];
    const propertyClaimsWithEvidence = propertyClaims.filter((claim) => (evidenceMap.get(claim.id) ?? 0) > 0);
    result[row.property_id] = computeBriefCompleteness({
      propertyId: row.property_id,
      captainEntries: propertyCaptainEntries,
      claims: propertyClaimsWithEvidence,
      claimEvidenceCounts: evidenceMap,
      approvedPoints: row.approved_points,
      now,
    });
  }

  return result;
}
