import { z } from "zod";
import type {
  GovernancePostCheckResult,
  ModelGatewayOutputContract,
  ModelGatewayValidationResult,
  ModelGatewayGovernanceStatus,
} from "./types";

const PublishabilitySchema = z.enum(["publishable", "internal_only", "needs_verification", "blocked"]);

const CaptainStructuredOutputSchema = z.object({
  response: z.object({
    response_id: z.string().min(1),
    request_id: z.string().min(1),
    conversational_response: z.string().min(1).max(8000),
    reasoning_summary: z.string().min(1).max(4000),
    structured_outputs: z.record(z.unknown()),
    confidence: z.number().min(0).max(1),
    publishability: PublishabilitySchema,
    escalation_required: z.boolean(),
    generated_at: z.string().min(1),
  }),
  memory_candidates: z.array(
    z.object({
      memory_candidate_id: z.string().min(1),
      source_interaction_id: z.string().min(1),
      candidate_type: z.string().min(1),
      confidence: z.number().min(0).max(1),
      verification_required: z.boolean(),
      promotion_state: z.enum(["candidate", "verified", "rejected", "expired"]),
      expires_at: z.string().nullable(),
      conflict_state: z.enum(["none", "possible_conflict", "conflict"]),
      source_evidence_hash: z.string().min(1),
    }),
  ),
  routing_decisions: z.array(
    z.object({
      routing_id: z.string().min(1),
      interaction_id: z.string().min(1),
      target_lane: z.string().min(1),
      reason: z.string().min(1).max(2000),
      status: z.enum(["pending", "routed", "blocked", "completed"]),
    }),
  ),
  memory_payloads: z.array(z.record(z.unknown())).optional(),
});

const ExpertReadSchema = z.object({
  expert_read_id: z.string().min(1),
  request_id: z.string().min(1),
  lane_id: z.string().min(1),
  property_id: z.string().min(1),
  read_status: z.enum(["requested", "in_progress", "final", "blocked", "failed"]),
  specialist_summary: z.string().min(1).max(4000),
  findings: z.array(
    z.object({
      finding_id: z.string().min(1),
      expert_read_id: z.string().min(1),
      finding_type: z.string().min(1),
      statement: z.string().min(1).max(3000),
      evidence_refs: z.array(z.string().min(1)).min(1),
      confidence: z.number().min(0).max(1),
      freshness: z.enum(["current", "stale", "conflicting", "blocked", "unknown"]),
      publishability: z.enum(["internal_only", "needs_verification", "blocked"]),
      verification_required: z.boolean(),
    }),
  ).min(1),
  recommendations: z.array(
    z.object({
      recommendation_id: z.string().min(1),
      expert_read_id: z.string().min(1),
      recommendation_type: z.string().min(1),
      recommendation_text: z.string().min(1).max(4000),
      evidence_refs: z.array(z.string().min(1)).min(1),
      proof_metric: z.string().nullable(),
      owner_lane: z.string().min(1),
      confidence: z.number().min(0).max(1),
      blocked_reason: z.string().nullable(),
      publishability: z.enum(["internal_only", "needs_verification", "blocked"]),
    }),
  ).min(1),
  do_not_do_rules: z.array(z.string().min(1)).min(1),
  required_evidence: z.array(z.string().min(1)).min(1),
  evidence_used: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  freshness_state: z.enum(["current", "stale", "conflicting", "blocked", "unknown"]),
  publishability: z.enum(["internal_only", "needs_verification", "blocked"]),
  escalation_required: z.boolean(),
  conflicts: z.array(z.string()),
  generated_at: z.string().min(1),
});

const ClassificationResponseSchema = z.object({
  label: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  evidence_refs: z.array(z.string().min(1)).min(1),
  uncertainty: z.array(z.string()).max(10),
});

const ReflectionSuggestionSchema = z.object({
  suggestion_type: z.enum(["care_warning", "uncertainty_note", "follow_up_prompt", "blocked"]),
  suggestion_text: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  publishability: z.enum(["internal_only", "needs_verification", "blocked"]),
  evidence_refs: z.array(z.string().min(1)).min(1),
});

const EvaluationResponseSchema = z.object({
  evaluation_id: z.string().min(1),
  decision: z.enum(["accept", "reject", "fallback", "blocked"]),
  confidence: z.number().min(0).max(1),
  deviation_summary: z.array(z.string().min(1)).max(20),
  evidence_refs: z.array(z.string().min(1)).min(1),
  publishability: z.enum(["internal_only", "needs_verification", "blocked"]),
  care_warnings: z.array(z.string()).max(10),
});

const contractSchemas: Record<ModelGatewayOutputContract, z.ZodTypeAny> = {
  captain_runtime_response: CaptainStructuredOutputSchema,
  expert_read_response: ExpertReadSchema,
  classification_response: ClassificationResponseSchema,
  reflection_suggestion_response: ReflectionSuggestionSchema,
  evaluation_response: EvaluationResponseSchema,
};

const contractDescriptors: Record<ModelGatewayOutputContract, Record<string, unknown>> = {
  captain_runtime_response: {
    required_fields: ["response", "memory_candidates", "routing_decisions"],
    blocked_fields: ["publish_report", "promote_memory", "data_pond_mutation"],
    max_lengths: {
      conversational_response: 8000,
      reasoning_summary: 4000,
    },
  },
  expert_read_response: {
    required_fields: ["expert_read_id", "request_id", "lane_id", "findings", "recommendations"],
    blocked_fields: ["publish_report", "promote_memory", "data_pond_mutation"],
    max_lengths: {
      specialist_summary: 4000,
      finding_statement: 3000,
      recommendation_text: 4000,
    },
  },
  classification_response: {
    required_fields: ["label", "confidence", "rationale", "evidence_refs", "uncertainty"],
    blocked_fields: ["publish_report", "promote_memory", "data_pond_mutation"],
  },
  reflection_suggestion_response: {
    required_fields: ["suggestion_type", "suggestion_text", "confidence", "publishability", "evidence_refs"],
    blocked_fields: ["publish_report", "promote_memory", "data_pond_mutation"],
  },
  evaluation_response: {
    required_fields: ["evaluation_id", "decision", "confidence", "deviation_summary", "evidence_refs", "publishability"],
    blocked_fields: ["publish_report", "promote_memory", "data_pond_mutation"],
  },
};

const blockedFieldPatterns = [
  /publish_report/i,
  /promote_memory/i,
  /memory_promotion/i,
  /data_pond_mutation/i,
  /database_write/i,
  /direct_db_write/i,
  /fleet_scribe_bypass/i,
  /quartermaster_bypass/i,
  /self_note.*evidence/i,
  /self notes?.*evidence/i,
  /human.*claim.*is verified/i,
  /relationship.*scor/i,
  /people.*scor/i,
  /send_email/i,
  /edit_directive/i,
  /alter_directive/i,
  /authorization_change/i,
  /change_authorization/i,
  /model_self_config/i,
  /provider_routing/i,
];

export function validateStructuredOutputContract(contract: ModelGatewayOutputContract, output: unknown): ModelGatewayValidationResult {
  const schema = contractSchemas[contract];
  const parsed = schema.safeParse(output);
  const errors = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
  const blocked = findBlockedFields(output);
  if (blocked.length > 0) {
    errors.push(...blocked.map((path) => `blocked field or instruction detected: ${path}`));
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function describeStructuredOutputContract(contract: ModelGatewayOutputContract): Record<string, unknown> {
  return contractDescriptors[contract];
}

export function runModelGatewayGovernancePostCheck(output: unknown): GovernancePostCheckResult {
  const dangerousStrings = JSON.stringify(output).toLowerCase();
  if (dangerousStrings.includes("mutate data pond") || dangerousStrings.includes("write directly to data pond")) {
    return blocked("Model output attempted a Data Pond mutation instruction.");
  }
  if (dangerousStrings.includes("promote memory") || dangerousStrings.includes("memory promotion approved")) {
    return blocked("Model output attempted memory promotion.");
  }
  if (dangerousStrings.includes("publish report") || dangerousStrings.includes("self-authorize publication")) {
    return blocked("Model output attempted direct publication.");
  }
  if (dangerousStrings.includes("bypass quartermaster") || dangerousStrings.includes("quartermaster_bypass")) {
    return blocked("Model output attempted to bypass Quartermaster.");
  }
  if (dangerousStrings.includes("bypass fleet scribe") || dangerousStrings.includes("fleet_scribe_bypass")) {
    return blocked("Model output attempted to bypass Fleet Scribe.");
  }
  if (/self notes?.{0,40}evidence/.test(dangerousStrings) || /self_note.{0,40}evidence/.test(dangerousStrings)) {
    return blocked("Model output attempted to use self notes as evidence.");
  }
  if (/relationship.{0,40}scor/.test(dangerousStrings) || /people.{0,40}scor/.test(dangerousStrings)) {
    return blocked("Model output attempted relationship or people scoring.");
  }
  if (dangerousStrings.includes("external_communication") || dangerousStrings.includes("send email") || dangerousStrings.includes("send_email")) {
    return blocked("Model output attempted unauthorized external communication.");
  }
  if (dangerousStrings.includes("edit directive") || dangerousStrings.includes("alter directive") || dangerousStrings.includes("authorization change")) {
    return blocked("Model output attempted directive or authorization changes.");
  }
  if (dangerousStrings.includes("provider routing") || dangerousStrings.includes("model self configuration") || dangerousStrings.includes("model_self_config")) {
    return blocked("Model output attempted model self-configuration or provider routing changes.");
  }
  return { allowed: true, status: "pass", reason: "Governance post-check passed.", warnings: [] };
}

export function compareShadowOutputs(accepted: unknown, providerOutput: unknown): string[] {
  const acceptedKeys = summarizeKeys(accepted);
  const providerKeys = summarizeKeys(providerOutput);
  const missing = acceptedKeys.filter((key) => !providerKeys.includes(key)).map((key) => `provider missing key: ${key}`);
  const extra = providerKeys.filter((key) => !acceptedKeys.includes(key)).map((key) => `provider extra key: ${key}`);
  return [...missing, ...extra];
}

function summarizeKeys(value: unknown, prefix = "", depth = 0): string[] {
  if (!value || typeof value !== "object" || depth > 2) return [];
  if (Array.isArray(value)) return value.length > 0 ? summarizeKeys(value[0], `${prefix}[]`, depth + 1) : [`${prefix}[]`];
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.flatMap(([key, next]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...summarizeKeys(next, path, depth + 1)];
  });
}

function findBlockedFields(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && blockedFieldPatterns.some((pattern) => pattern.test(value))) {
      return [path || "root"];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBlockedFields(item, `${path}[${index}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, next]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const own = blockedFieldPatterns.some((pattern) => pattern.test(key)) ? [nextPath] : [];
    return [...own, ...findBlockedFields(next, nextPath)];
  });
}

function blocked(reason: string): GovernancePostCheckResult {
  return { allowed: false, status: "blocked" as ModelGatewayGovernanceStatus, reason, warnings: [] };
}
