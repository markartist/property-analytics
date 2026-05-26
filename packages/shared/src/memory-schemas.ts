import { z } from "zod";

export const GovernedMemoryEvidenceReferenceSchema = z.object({
  evidenceType: z.string().min(1),
  evidenceSource: z.string().min(1),
  evidenceRef: z.string().min(1),
  evidenceExcerpt: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const CreateCaptainLogEntrySchema = z.object({
  summary: z.string().min(1),
  structuredPayload: z.record(z.unknown()).optional().nullable(),
  evidence: z.array(GovernedMemoryEvidenceReferenceSchema).min(1),
  sourceSystem: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const CreateGovernedMemoryCandidateSchema = z.object({
  rationale: z.string().min(1),
  proposedSummary: z.string().optional(),
  proposedStructuredPayload: z.record(z.unknown()).optional().nullable(),
});
