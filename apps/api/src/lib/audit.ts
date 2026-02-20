/**
 * Audit logging for admin/sensitive actions.
 * Per 05_Data_Model.md / migration 009: immutable event trail.
 *
 * Writes to audit_log table with actor, entity, action, before/after snapshots.
 * Fire-and-forget: audit failures are logged but do not block the request.
 */

import { run } from "./db";
import { newId } from "./id";
import { nowISO } from "./validate";

export interface AuditEntry {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Write an audit log row. Non-blocking: catches and logs errors
 * so audit failures never break business operations.
 */
export async function writeAuditLog(db: D1Database, entry: AuditEntry): Promise<void> {
  try {
    await run(db,
      `INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, before_json, after_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        entry.actorUserId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.before != null ? JSON.stringify(entry.before) : null,
        entry.after != null ? JSON.stringify(entry.after) : null,
        nowISO(),
      ]
    );
  } catch (err) {
    // Audit write failures must not break the request.
    console.error("Audit log write failed:", err);
  }
}
