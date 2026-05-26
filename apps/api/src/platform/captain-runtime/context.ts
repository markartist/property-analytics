import { recentRows } from "./repository";

export interface PropertyRuntimeContext {
  property: Record<string, unknown>;
  active_watch_items: Record<string, unknown>[];
  active_actions: Record<string, unknown>[];
  recent_memory: Record<string, unknown>[];
  recent_recommendations: Record<string, unknown>[];
  source_freshness: Record<string, unknown>[];
  unresolved_issues: Record<string, unknown>[];
  applicable_bench_lanes: string[];
  doctrine: string[];
}

export async function assemblePropertyRuntimeContext(
  db: D1Database,
  property: { id: string; encasa_property_code: string | null; ga4_property_id: string | null; name: string; region: string | null }
): Promise<PropertyRuntimeContext> {
  const propertyCode = property.encasa_property_code ?? property.id;
  const [watchItems, actions, memory, briefRuns, sourceFreshness] = await Promise.all([
    recentRows(
      db,
      `SELECT title, category, severity, status, current_state, next_move, evidence_json, updated_at
       FROM captain_watch_items
       WHERE property_id = ? AND status IN ('open', 'monitoring', 'escalated')
       ORDER BY severity DESC, updated_at DESC
       LIMIT 8`,
      [propertyCode]
    ),
    recentRows(
      db,
      `SELECT title, owner_role, due_date, status, priority, evidence_json, updated_at
       FROM captain_actions
       WHERE property_id = ? AND status IN ('open', 'in_progress', 'blocked')
       ORDER BY priority DESC, due_date ASC
       LIMIT 8`,
      [propertyCode]
    ),
    recentRows(
      db,
      `SELECT id, summary, structured_payload_json, source_system, confidence, status, created_at
       FROM governed_memory_entries
       WHERE property_id = ?
       ORDER BY created_at DESC
       LIMIT 8`,
      [property.id]
    ),
    recentRows(
      db,
      `SELECT id, run_status, brief_type, summary, created_at
       FROM captain_brief_runs
       WHERE property_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [propertyCode]
    ),
    recentRows(
      db,
      `SELECT source_key, property_id, status, latest_data_at, checked_at, details_json
       FROM captain_source_readiness
       WHERE property_id = ?
       ORDER BY checked_at DESC
       LIMIT 12`,
      [propertyCode]
    ),
  ]);

  const unresolved = [
    ...watchItems.filter((item) => ["high", "critical"].includes(String(item.severity))),
    ...actions.filter((item) => String(item.status) === "blocked"),
  ].slice(0, 8);

  return {
    property: {
      id: property.id,
      property_code: propertyCode,
      name: property.name,
      region: property.region,
      ga4_property_id: property.ga4_property_id,
    },
    active_watch_items: watchItems,
    active_actions: actions,
    recent_memory: memory,
    recent_recommendations: briefRuns,
    source_freshness: sourceFreshness,
    unresolved_issues: unresolved,
    applicable_bench_lanes: inferBenchLanes(watchItems, actions),
    doctrine: [
      "Data Pond facts govern; human input is a claim until verified.",
      "Fleet Scribe controls executive publication.",
      "Quartermaster source integrity blocks unsupported claims.",
      "Approved report formats remain locked unless explicitly changed.",
    ],
  };
}

function inferBenchLanes(watchItems: Record<string, unknown>[], actions: Record<string, unknown>[]): string[] {
  const text = JSON.stringify([...watchItems, ...actions]).toLowerCase();
  const lanes = new Set<string>(["quartermaster"]);
  if (/rent|pricing|concession|special/.test(text)) lanes.add("revenue_advisor");
  if (/guest|visit|lease|application|pq|closing/.test(text)) lanes.add("leasing_performance_advisor");
  if (/website|seo|copy|gbp|content/.test(text)) lanes.add("navigator");
  if (/review|reputation|sentiment/.test(text)) lanes.add("reputation_officer");
  if (/ticket|resident|service|maintenance/.test(text)) lanes.add("resident_experience_officer");
  if (/competitor|market|comp/.test(text)) lanes.add("market_scout");
  return Array.from(lanes);
}
