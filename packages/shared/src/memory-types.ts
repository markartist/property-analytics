export type GovernedMemoryScope = "property" | "fleet" | "ledger";
export type GovernedMemoryStatus = "active" | "candidate" | "approved" | "deprecated";
export type GovernedMemoryCandidateStatus = "pending" | "promoted" | "rejected";

export interface GovernedMemoryEvidenceReference {
  evidenceType: string;
  evidenceSource: string;
  evidenceRef: string;
  evidenceExcerpt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GovernedMemoryEntryContract {
  id: string;
  scope: GovernedMemoryScope;
  summary: string;
  structuredPayload?: Record<string, unknown> | null;
  evidence: GovernedMemoryEvidenceReference[];
  sourceSystem: string;
  createdBy: string;
  confidence: number;
  status: GovernedMemoryStatus;
  createdAt: string;
  updatedAt: string;
  propertyId?: string | null;
  fleetKey?: string | null;
  ledgerKey?: string | null;
  parentEntryId?: string | null;
  originatingCandidateId?: string | null;
  lineage?: GovernedMemoryLineageContract[];
}

export interface GovernedMemoryLineageContract {
  targetEntryId: string;
  sourceEntryId: string;
  sourceCandidateId?: string | null;
  createdAt: string;
}

export interface GovernedMemoryCandidateContract {
  id: string;
  sourceEntryId: string;
  sourceScope: "property" | "fleet";
  targetScope: "fleet" | "ledger";
  proposedSummary: string;
  proposedStructuredPayload?: Record<string, unknown> | null;
  rationale: string;
  status: GovernedMemoryCandidateStatus;
  requestedBy: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
