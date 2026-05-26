import type {
  AgentCharter,
  AgentSelfNote,
  CareMetadata,
  MemoryAllowedUse,
  MemoryItem,
  MemoryLifecycleState,
} from "./types";

export const MEMORY_ALLOWED_USES: readonly MemoryAllowedUse[] = [
  "captain_reasoning",
  "expert_read_context",
  "navigator_review",
  "quartermaster_review",
  "product_readiness_review",
  "fleet_summary",
  "regional_summary",
  "scribe_input",
  "public_copy",
  "report_publication",
  "historical_review",
  "self_reminder",
];

const PERSON_JUDGMENT_PATTERNS = [
  /\b(manager|team|person|employee|staff)\s+(is|are|was|were)\s+(bad|lazy|unreliable|incompetent|terrible|poor)\b/i,
  /\b(always|never)\s+(trust|believe)\s+(the\s+)?(manager|team|staff|person)\b/i,
  /\bscore\s+(the\s+)?(manager|team|staff|person)\b/i,
];

const FORBIDDEN_SELF_NOTE_PATTERNS = [
  /ignore\s+quartermaster/i,
  /bypass\s+fleet\s+scribe/i,
  /always\s+publish/i,
  /canonical\s+truth/i,
];

const CAPTAIN_FORBIDDEN_ACTION_PATTERNS = [
  /publish/i,
  /mutate.*data.*pond/i,
  /promote.*memory/i,
  /canonical.*truth/i,
  /bypass.*quartermaster/i,
  /bypass.*fleet.*scribe/i,
  /approve.*public.*claim/i,
];

const RELATIONSHIP_SCORING_USE_PATTERNS = [/score/i, /performance/i, /rank/i, /discipline/i];

const VALID_LIFECYCLE_TRANSITIONS: Record<MemoryLifecycleState, MemoryLifecycleState[]> = {
  raw_input: ["parsed_claim", "candidate", "rejected", "archived"],
  parsed_claim: ["candidate", "rejected", "archived"],
  candidate: ["working", "verified", "accepted_operational_context", "rejected", "archived", "expired", "superseded"],
  working: ["verified", "accepted_operational_context", "rejected", "archived", "expired", "superseded"],
  verified: ["accepted_operational_context", "report_eligible", "archived", "expired", "superseded"],
  accepted_operational_context: ["report_eligible", "doctrine_candidate", "archived", "expired", "superseded"],
  report_eligible: ["doctrine_candidate", "archived", "expired", "superseded"],
  doctrine_candidate: ["approved_doctrine", "rejected", "archived", "superseded"],
  approved_doctrine: ["archived", "superseded"],
  archived: [],
  expired: ["archived"],
  rejected: ["archived"],
  superseded: ["archived"],
};

export function defaultCareMetadata(overrides: Partial<CareMetadata> = {}): CareMetadata {
  return {
    do_not_overstate: true,
    ask_before_public_use: true,
    avoid_person_judgment: true,
    temporary_context: false,
    sensitive_context: false,
    share_as_pattern_only: false,
    requires_human_review: false,
    preferred_tone: "careful, plain-English, nonjudgmental",
    correction_allowed_by_roles: ["admin", "editor"],
    ...overrides,
  };
}

export function validateCareMetadata(value: unknown): string[] {
  const errors: string[] = [];
  const meta = value as Partial<CareMetadata> | null | undefined;
  if (!meta || typeof meta !== "object") return ["care_metadata is required."];
  for (const field of [
    "do_not_overstate",
    "ask_before_public_use",
    "avoid_person_judgment",
    "temporary_context",
    "sensitive_context",
    "share_as_pattern_only",
    "requires_human_review",
  ] as const) {
    if (typeof meta[field] !== "boolean") errors.push(`care_metadata.${field} must be boolean.`);
  }
  if (!Array.isArray(meta.correction_allowed_by_roles) || meta.correction_allowed_by_roles.length === 0) {
    errors.push("care_metadata.correction_allowed_by_roles is required.");
  }
  if (!meta.preferred_tone || typeof meta.preferred_tone !== "string") errors.push("care_metadata.preferred_tone is required.");
  return errors;
}

export function validateAgentCharter(charter: AgentCharter): string[] {
  const errors: string[] = [];
  if (!charter.sphere_of_responsibility.trim()) errors.push("sphere_of_responsibility is required.");
  if (!charter.sphere_of_knowledge.trim()) errors.push("sphere_of_knowledge is required.");
  if (!charter.sphere_of_action.trim()) errors.push("sphere_of_action is required.");
  if (!charter.sphere_of_memory.trim()) errors.push("sphere_of_memory is required.");
  if (!charter.blocked_actions.length) errors.push("blocked_actions are required for bounded authority.");
  if (!charter.authority_boundaries.length) errors.push("authority_boundaries are required.");
  if (!charter.care_obligations.length) errors.push("care_obligations are required.");
  if (charter.allowed_actions.includes("*")) errors.push("unbounded allowed_actions are not permitted.");
  if (charter.agent_id.includes("captain") || charter.steward_roles.some((role) => role.toLowerCase() === "captain")) {
    const forbidden = charter.allowed_actions.filter((action) => CAPTAIN_FORBIDDEN_ACTION_PATTERNS.some((pattern) => pattern.test(action)));
    if (forbidden.length) errors.push(`Captain charters cannot include forbidden authority: ${forbidden.join(", ")}.`);
  }
  return errors;
}

export function validateMemoryItem(item: MemoryItem): string[] {
  const errors: string[] = [];
  if (!item.agent_id) errors.push("agent_id is required.");
  if (!item.statement.trim()) errors.push("statement is required.");
  if (item.confidence < 0 || item.confidence > 1) errors.push("confidence must be between 0 and 1.");
  if (!item.correction_path.trim()) errors.push("correction_path is required.");
  if (!item.allowed_uses.every((use) => MEMORY_ALLOWED_USES.includes(use))) errors.push("allowed_uses contains unsupported values.");
  if (!item.blocked_uses.every((use) => MEMORY_ALLOWED_USES.includes(use))) errors.push("blocked_uses contains unsupported values.");
  errors.push(...validateCareMetadata(item.care_metadata));
  const care = item.care_metadata;
  if (["report_eligible", "approved_doctrine"].includes(item.lifecycle_state)) {
    errors.push("publication-eligible and approved-doctrine states require a future governed workflow.");
  }
  if (item.allowed_uses.includes("report_publication")) {
    errors.push("Memory Stewardship cannot grant report publication use in this foundation.");
  }
  if (item.allowed_uses.includes("public_copy") && item.verification_required) {
    errors.push("Memory that still requires verification cannot be used as public copy.");
  }
  if (care?.ask_before_public_use && (item.allowed_uses.includes("public_copy") || item.allowed_uses.includes("report_publication"))) {
    errors.push("ask_before_public_use blocks public copy and report publication use until future governed approval exists.");
  }
  if (care?.temporary_context && !item.expires_at && !item.revalidation_due_at) {
    errors.push("temporary_context requires expires_at or revalidation_due_at.");
  }
  if (care?.sensitive_context && !["private_to_agent", "property_team_visible"].includes(item.visibility_scope)) {
    errors.push("sensitive_context must stay private or property-team visible.");
  }
  if (care?.share_as_pattern_only && item.allowed_uses.includes("scribe_input")) {
    errors.push("share_as_pattern_only memory cannot be raw Scribe input.");
  }
  if (item.memory_class === "agent_self_note" && (item.allowed_uses.includes("public_copy") || item.allowed_uses.includes("report_publication"))) {
    errors.push("agent_self_note cannot be public copy or report publication evidence.");
  }
  if (item.memory_class === "agent_self_note" && item.allowed_uses.includes("scribe_input")) {
    errors.push("agent_self_note cannot be Scribe input.");
  }
  if (item.memory_class === "human_submitted_memory" && item.allowed_uses.includes("public_copy")) {
    errors.push("human_submitted_memory cannot be public copy in this foundation.");
  }
  if (item.memory_class === "relationship_context" && item.blocked_uses.every((use) => use !== "report_publication")) {
    errors.push("relationship_context must block report_publication to prevent people scoring.");
  }
  if (item.memory_class === "relationship_context" && item.allowed_uses.some((use) => RELATIONSHIP_SCORING_USE_PATTERNS.some((pattern) => pattern.test(use)))) {
    errors.push("relationship_context cannot be used for scoring, ranking, or performance judgment.");
  }
  return errors;
}

export function validateLifecycleTransition(from: MemoryLifecycleState, to: MemoryLifecycleState): string | null {
  return VALID_LIFECYCLE_TRANSITIONS[from]?.includes(to) ? null : `Invalid memory lifecycle transition from ${from} to ${to}.`;
}

export function validateSelfNote(note: Pick<AgentSelfNote, "note_text" | "visibility" | "care_metadata">): string[] {
  const errors: string[] = [];
  if (!note.note_text.trim()) errors.push("note_text is required.");
  if (PERSON_JUDGMENT_PATTERNS.some((pattern) => pattern.test(note.note_text))) {
    errors.push("self notes may not judge, score, or profile people.");
  }
  if (FORBIDDEN_SELF_NOTE_PATTERNS.some((pattern) => pattern.test(note.note_text))) {
    errors.push("self note attempts to bypass governance or publication controls.");
  }
  errors.push(...validateCareMetadata(note.care_metadata));
  if (note.care_metadata.sensitive_context && note.visibility !== "private_to_agent" && note.visibility !== "property_team_visible") {
    errors.push("sensitive self notes must stay private or property-team visible.");
  }
  return errors;
}
