import { auditAwarenessEvent, listCommitmentsForProperty, listMemoryForProperty, listSelfNotesForProperty } from "./repository";

const PERSON_JUDGMENT_PATTERNS = [
  /\b(manager|team|person|employee|staff)\s+(is|are|was|were)\s+(bad|lazy|unreliable|incompetent|terrible|poor)\b/i,
  /\b(always|never)\s+(trust|believe|fails?|failed)\s+(the\s+)?(manager|team|staff|person)?\b/i,
];

export type ReflectionRoutineType =
  | "daily_check"
  | "weekly_reflection"
  | "monthly_retrospective"
  | "post_report_reflection"
  | "post_manager_input_reflection"
  | "post_expert_read_reflection"
  | "stale_memory_review";

export interface ReflectionSuggestion {
  suggestion_type:
    | "suggested_self_note"
    | "suggested_commitment"
    | "suggested_archive"
    | "suggested_revalidation"
    | "suggested_regional_pattern"
    | "suggested_doctrine_candidate"
    | "unresolved_question"
    | "care_warning";
  statement: string;
  source_ref: string | null;
  requires_review: boolean;
}

export interface ReflectionRunResult {
  reflection_run_id: string;
  routine_type: ReflectionRoutineType;
  property_id: string | null;
  agent_id: string | null;
  suggestions: ReflectionSuggestion[];
}

export async function runReflectionRoutine(db: D1Database, input: {
  routine_type: ReflectionRoutineType;
  property_id?: string | null;
  agent_id?: string | null;
  actor?: string | null;
  correlation_id?: string | null;
}): Promise<ReflectionRunResult> {
  const suggestions: ReflectionSuggestion[] = [];
  if (input.property_id) {
    const [memories, notes, commitments] = await Promise.all([
      listMemoryForProperty(db, input.property_id, true),
      listSelfNotesForProperty(db, input.property_id),
      listCommitmentsForProperty(db, input.property_id),
    ]);
    for (const memory of memories.filter((item) => item.verification_required).slice(0, 3)) {
      if (isPersonJudgment(memory.statement)) continue;
      suggestions.push({
        suggestion_type: "suggested_revalidation",
        statement: `Revalidate before using: ${memory.statement}`,
        source_ref: memory.memory_id,
        requires_review: true,
      });
    }
    for (const memory of memories.filter((item) => item.freshness_state === "stale" || item.lifecycle_state === "expired" || !!item.expires_at).slice(0, 3)) {
      if (isPersonJudgment(memory.statement)) continue;
      suggestions.push({
        suggestion_type: "suggested_archive",
        statement: `Review for archive or supersession: ${memory.statement}`,
        source_ref: memory.memory_id,
        requires_review: true,
      });
    }
    for (const note of notes.filter((item) => item.note_type === "open_question").slice(0, 2)) {
      if (isPersonJudgment(note.note_text)) continue;
      suggestions.push({
        suggestion_type: "unresolved_question",
        statement: note.note_text,
        source_ref: note.note_id,
        requires_review: false,
      });
    }
    for (const commitment of commitments.slice(0, 3)) {
      suggestions.push({
        suggestion_type: "suggested_self_note",
        statement: `Keep open loop visible without blame: ${commitment.description}`,
        source_ref: commitment.commitment_id,
        requires_review: false,
      });
    }
    if (memories.some((memory) => memory.care_metadata.sensitive_context)) {
      suggestions.push({
        suggestion_type: "care_warning",
        statement: "Sensitive memory is present; keep visibility tight and summarize upward only when allowed.",
        source_ref: null,
        requires_review: true,
      });
    }
  }

  const result: ReflectionRunResult = {
    reflection_run_id: `reflection_${Date.now()}`,
    routine_type: input.routine_type,
    property_id: input.property_id ?? null,
    agent_id: input.agent_id ?? null,
    suggestions,
  };
  await auditAwarenessEvent(db, {
    event_type: "reflection_run.completed",
    actor: input.actor ?? input.agent_id ?? "system",
    agent_id: input.agent_id ?? null,
    property_id: input.property_id ?? null,
    action: input.routine_type,
    after_state: result,
    correlation_id: input.correlation_id,
  });
  return result;
}

function isPersonJudgment(text: string): boolean {
  return PERSON_JUDGMENT_PATTERNS.some((pattern) => pattern.test(text));
}
