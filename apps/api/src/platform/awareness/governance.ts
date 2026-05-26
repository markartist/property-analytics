import type { AuthUser } from "../../env";
import { PropertyAccessControl } from "../access/property-access-control";
import type { MemoryAllowedUse, MemoryGovernanceResult, MemoryItem } from "./types";
import { auditAwarenessEvent } from "./repository";

export async function evaluateMemoryUse(db: D1Database, input: {
  actor: AuthUser;
  memory: MemoryItem;
  requested_use: MemoryAllowedUse;
  propertyRef?: string | null;
  region?: string | null;
  correlationId?: string | null;
}): Promise<MemoryGovernanceResult> {
  const propertyRef = input.propertyRef ?? input.memory.property_id;
  if (propertyRef) {
    const access = await PropertyAccessControl.canViewProperty(db, {
      actor: input.actor,
      propertyRef,
      correlationId: input.correlationId,
    });
    if (!access.allowed) return block("PropertyAccessControl denied memory visibility.", "property_access_denied");
  } else if (input.region ?? input.memory.region_id) {
    const access = await PropertyAccessControl.canAccessRegionScope(db, {
      actor: input.actor,
      region: input.region ?? input.memory.region_id,
      correlationId: input.correlationId,
    });
    if (!access.allowed) return block("PropertyAccessControl denied regional memory visibility.", "region_access_denied");
  } else {
    return block("Memory scope is missing.", "missing_scope");
  }

  const result = evaluateMemoryUseWithoutAccess(input.memory, input.requested_use);
  if (!result.allowed) {
    await auditAwarenessEvent(db, {
      event_type: "memory_governance.blocked_use",
      actor: input.actor.id,
      agent_id: input.memory.agent_id,
      property_id: input.memory.property_id,
      region_id: input.memory.region_id,
      memory_id: input.memory.memory_id,
      action: input.requested_use,
      reason: result.blocked_reason,
      care_rule_triggered: result.care_rule_triggered,
      correlation_id: input.correlationId,
    });
  }
  return result;
}

export function evaluateMemoryUseWithoutAccess(memory: MemoryItem, requestedUse: MemoryAllowedUse): MemoryGovernanceResult {
  if (memory.blocked_uses.includes(requestedUse)) return block(`Memory blocks use as ${requestedUse}.`, "blocked_use");
  if (!memory.allowed_uses.includes(requestedUse)) return block(`Memory is not allowed for ${requestedUse}.`, "unsupported_use");
  if (!memory.correction_path?.trim()) return block("Memory without a correction path cannot be used.", "missing_correction_path");
  if (!memory.steward?.trim()) return block("Memory without a steward cannot be used.", "missing_steward");
  if (memory.lifecycle_state === "expired" && requestedUse !== "historical_review") return block("Expired memory cannot drive active recommendations.", "stale_memory_active_use");
  if (memory.lifecycle_state === "archived" && requestedUse !== "historical_review") return block("Archived memory cannot drive active recommendations.", "archived_memory_active_use");
  if (memory.lifecycle_state === "superseded" && requestedUse !== "historical_review") return block("Superseded memory cannot drive active recommendations.", "superseded_memory_active_use");
  if (["report_eligible", "approved_doctrine"].includes(memory.lifecycle_state)) {
    return block("Publication-eligible and approved doctrine states require a future governed workflow.", "publication_workflow_not_enabled");
  }
  if (memory.memory_class === "agent_self_note" && ["public_copy", "report_publication", "scribe_input"].includes(requestedUse)) {
    return block("Self notes are not publishable evidence.", "self_note_public_use");
  }
  if (memory.memory_class === "human_submitted_memory" && ["public_copy", "report_publication"].includes(requestedUse) && memory.verification_required) {
    return block("Human-submitted memory remains claim-level until governed.", "unverified_human_public_use");
  }
  if (memory.memory_class === "relationship_context" && ["report_publication", "public_copy", "scribe_input", "fleet_summary", "regional_summary"].includes(requestedUse)) {
    return block("Relationship context cannot become people scoring or publication evidence.", "relationship_scoring_risk");
  }
  if (memory.sensitivity === "restricted" && !["historical_review", "self_reminder"].includes(requestedUse)) {
    return block("Restricted memory requires tighter visibility and cannot be used here.", "sensitive_memory_visibility");
  }
  if (memory.care_metadata.requires_human_review && !["historical_review", "quartermaster_review"].includes(requestedUse)) {
    return block("This memory requires human review before active use.", "human_review_required");
  }
  if (memory.care_metadata.ask_before_public_use && ["public_copy", "report_publication"].includes(requestedUse)) {
    return block("This memory requires explicit approval before public use.", "ask_before_public_use");
  }
  if (memory.care_metadata.share_as_pattern_only && ["regional_summary", "fleet_summary", "scribe_input"].includes(requestedUse)) {
    return block("Pattern-only memory cannot be exposed as raw upward detail.", "share_pattern_only");
  }
  const warnings: string[] = [];
  if (memory.care_metadata.do_not_overstate) warnings.push("Do not overstate this memory.");
  if (memory.care_metadata.ask_before_public_use) warnings.push("Ask before public use.");
  if (memory.care_metadata.share_as_pattern_only) warnings.push("Share as pattern only.");
  if (memory.verification_required) warnings.push("Treat as claim-level until verified.");
  return { allowed: true, blocked_reason: null, warnings, care_rule_triggered: null };
}

function block(reason: string, careRule: string): MemoryGovernanceResult {
  return { allowed: false, blocked_reason: reason, warnings: [], care_rule_triggered: careRule };
}
