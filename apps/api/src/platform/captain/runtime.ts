import { queryAll, queryFirst, run } from "../../lib/db";

export type CaptainRunType = "manual" | "scheduled" | "brief";
export type CaptainRunStatus = "success" | "warning" | "failed" | "skipped";
export type CaptainAgentKey = string;

interface CommunityRow {
  id: string;
  name: string;
  external_key: string | null;
  ga4_property_id: string | null;
  encasa_property_code: string | null;
  full_url: string | null;
  unit_count: number | null;
}

interface SupportAgentRow {
  id: string;
  property_id: string;
  agent_key: string;
  agent_name: string;
  role: string;
  cadence: "daily" | "weekly" | "monthly" | "ad_hoc";
  status: "active" | "paused" | "retired";
  source_scope_json?: string | null;
}

interface CaptainCommandPosture {
  scopeTypes: string[];
  designation: string | null;
  market: string | null;
  cadences: string[];
  supportAgentCount: number;
  intensity: "baseline" | "focused" | "urgent";
}

interface AgentRunResult {
  runId: string;
  propertyId: string;
  communityId: string | null;
  agentKey: string;
  status: CaptainRunStatus;
  findings: Record<string, unknown>;
  metrics: Record<string, unknown>;
  exceptions: string[];
  watchItems: WatchItemInput[];
  actions: ActionInput[];
}

interface WatchItemInput {
  watchKey: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "monitoring" | "escalated" | "resolved" | "superseded";
  currentState: string;
  evidence: Record<string, unknown>;
  nextMove?: string | null;
  ownerRole?: string | null;
  dueDate?: string | null;
}

interface ActionInput {
  actionKey: string;
  title: string;
  ownerRole: string;
  dueDate?: string | null;
  status: "open" | "in_progress" | "done" | "blocked" | "superseded";
  priority: "low" | "medium" | "high" | "critical";
  evidence: Record<string, unknown>;
}

export async function ensureCaptainRuntimeTables(db: D1Database): Promise<void> {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS captain_agent_runs (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      community_id TEXT,
      agent_key TEXT NOT NULL,
      run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'scheduled', 'brief')),
      run_status TEXT NOT NULL CHECK (run_status IN ('success', 'warning', 'failed', 'skipped')),
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      source_window_start TEXT,
      source_window_end TEXT,
      findings_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      exceptions_json TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_agent_runs_property ON captain_agent_runs(property_id, started_at DESC)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_agent_runs_agent ON captain_agent_runs(property_id, agent_key, started_at DESC)`);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS captain_watch_items (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      community_id TEXT,
      watch_key TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL CHECK (status IN ('open', 'monitoring', 'escalated', 'resolved', 'superseded')),
      current_state TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      next_move TEXT,
      owner_role TEXT,
      due_date TEXT,
      source_agent_key TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      UNIQUE (property_id, watch_key)
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_watch_items_property ON captain_watch_items(property_id, status, severity, updated_at DESC)`);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS captain_actions (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      community_id TEXT,
      action_key TEXT NOT NULL,
      title TEXT NOT NULL,
      owner_role TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done', 'blocked', 'superseded')),
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      evidence_json TEXT NOT NULL,
      source_agent_key TEXT,
      created_from_run_id TEXT REFERENCES captain_agent_runs(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      UNIQUE (property_id, action_key)
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_actions_property ON captain_actions(property_id, status, priority, due_date)`);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS captain_brief_runs (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      community_id TEXT,
      run_status TEXT NOT NULL CHECK (run_status IN ('draft', 'ready', 'sent', 'blocked')),
      brief_type TEXT NOT NULL CHECK (brief_type IN ('captain_brief', 'supervisor_read')),
      period_start TEXT,
      period_end TEXT,
      memory_entry_id TEXT REFERENCES governed_memory_entries(id) ON DELETE SET NULL,
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      artifact_ref TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_captain_brief_runs_property ON captain_brief_runs(property_id, created_at DESC)`);
}

export async function getCaptainStatus(db: D1Database, propertyRef: string) {
  await ensureCaptainRuntimeTables(db);
  const property = await resolveCommunity(db, propertyRef);
  const propertyCode = property.encasa_property_code ?? propertyRef;
  const [agents, runs, watchItems, actions, briefRuns, latestMemory] = await Promise.all([
    getSupportAgents(db, propertyCode),
    queryAll(db, `SELECT * FROM captain_agent_runs WHERE property_id = ? ORDER BY started_at DESC LIMIT 20`, [propertyCode]),
    queryAll(db, `SELECT * FROM captain_watch_items WHERE property_id = ? ORDER BY status ASC, severity DESC, updated_at DESC`, [propertyCode]),
    queryAll(db, `SELECT * FROM captain_actions WHERE property_id = ? ORDER BY status ASC, priority DESC, due_date ASC`, [propertyCode]),
    queryAll(db, `SELECT * FROM captain_brief_runs WHERE property_id = ? ORDER BY created_at DESC LIMIT 10`, [propertyCode]),
    queryFirst(db, `SELECT * FROM governed_memory_entries WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`, [property.id]),
  ]);

  return {
    property,
    propertyCode,
    commandPosture: deriveCaptainCommandPosture(agents),
    agents,
    latestMemory,
    latestRuns: runs,
    watchItems,
    actions,
    briefRuns,
  };
}

export async function getCaptainRoster(db: D1Database) {
  await ensureCaptainRuntimeTables(db);
  const agents = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT
       a.property_id,
       a.agent_key,
       a.agent_name,
       a.role,
       a.cadence,
       a.status,
       a.source_scope_json,
       c.id AS community_id,
       c.name AS property_name,
       c.region,
       c.unit_count,
       c.ga4_property_id,
       c.full_url
     FROM captain_support_agents a
     LEFT JOIN communities c
       ON c.encasa_property_code = a.property_id
     WHERE a.status = 'active'
     ORDER BY a.property_id, a.cadence, a.agent_key`,
    []
  );
  const properties = new Map<string, Record<string, unknown>>();
  for (const agent of agents) {
    const propertyCode = String(agent.property_id ?? "");
    if (!propertyCode) continue;
    const current = properties.get(propertyCode) ?? {
      propertyCode,
      communityId: agent.community_id ?? null,
      propertyName: agent.property_name ?? propertyCode,
      region: agent.region ?? null,
      unitCount: agent.unit_count ?? null,
      ga4PropertyId: agent.ga4_property_id ?? null,
      fullUrl: agent.full_url ?? null,
      agents: [],
    };
    (current.agents as Record<string, unknown>[]).push(agent);
    properties.set(propertyCode, current);
  }

  const propertyCodes = Array.from(properties.keys());
  const communityIds = Array.from(properties.values()).map((row) => row.communityId).filter(Boolean).map(String);
  const [runStats, watchStats, actionStats, briefStats, memoryStats] = await Promise.all([
    groupedRows(db, "captain_agent_runs", "property_id", propertyCodes, "COUNT(*) AS runCount, MAX(finished_at) AS latestRunAt, SUM(CASE WHEN run_status = 'failed' THEN 1 ELSE 0 END) AS failedRuns"),
    groupedRows(db, "captain_watch_items", "property_id", propertyCodes, "COUNT(*) AS activeWatchCount, SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) AS highWatchCount", "status IN ('open', 'monitoring', 'escalated')"),
    groupedRows(db, "captain_actions", "property_id", propertyCodes, "COUNT(*) AS activeActionCount, SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blockedActionCount", "status IN ('open', 'in_progress', 'blocked')"),
    groupedRows(db, "captain_brief_runs", "property_id", propertyCodes, "COUNT(*) AS briefCount, MAX(created_at) AS latestBriefAt"),
    groupedRows(db, "governed_memory_entries", "property_id", communityIds, "COUNT(*) AS memoryCount, MAX(created_at) AS latestMemoryAt", "scope = 'property'"),
  ]);

  const items = Array.from(properties.values()).map((row) => {
    const propertyCode = String(row.propertyCode);
    const communityId = row.communityId ? String(row.communityId) : "";
    const agentsForProperty = row.agents as SupportAgentRow[];
    const posture = deriveCaptainCommandPosture(agentsForProperty);
    const run = runStats.get(propertyCode) ?? {};
    const watch = watchStats.get(propertyCode) ?? {};
    const action = actionStats.get(propertyCode) ?? {};
    const brief = briefStats.get(propertyCode) ?? {};
    const memory = memoryStats.get(communityId) ?? {};
    return {
      propertyCode,
      communityId: row.communityId ?? null,
      propertyName: row.propertyName,
      region: row.region,
      unitCount: row.unitCount,
      fullUrl: row.fullUrl,
      commandPosture: posture,
      supportAgentCount: agentsForProperty.length,
      dailyAgentCount: agentsForProperty.filter((agent) => agent.cadence === "daily").length,
      weeklyAgentCount: agentsForProperty.filter((agent) => agent.cadence === "weekly").length,
      latestRunAt: run.latestRunAt ?? null,
      runCount: Number(run.runCount ?? 0),
      failedRunCount: Number(run.failedRuns ?? 0),
      activeWatchCount: Number(watch.activeWatchCount ?? 0),
      highWatchCount: Number(watch.highWatchCount ?? 0),
      activeActionCount: Number(action.activeActionCount ?? 0),
      blockedActionCount: Number(action.blockedActionCount ?? 0),
      latestBriefAt: brief.latestBriefAt ?? null,
      briefCount: Number(brief.briefCount ?? 0),
      latestMemoryAt: memory.latestMemoryAt ?? null,
      memoryCount: Number(memory.memoryCount ?? 0),
    };
  }).sort((a, b) => {
    const intensityRank: Record<string, number> = { urgent: 0, focused: 1, baseline: 2 };
    const rankA = intensityRank[a.commandPosture.intensity] ?? 3;
    const rankB = intensityRank[b.commandPosture.intensity] ?? 3;
    if (rankA !== rankB) return rankA - rankB;
    if (b.highWatchCount !== a.highWatchCount) return b.highWatchCount - a.highWatchCount;
    if (b.activeActionCount !== a.activeActionCount) return b.activeActionCount - a.activeActionCount;
    return String(a.propertyName).localeCompare(String(b.propertyName));
  });

  return {
    summary: {
      propertyCount: items.length,
      activeAgentCount: agents.length,
      urgentCount: items.filter((item) => item.commandPosture.intensity === "urgent").length,
      focusedCount: items.filter((item) => item.commandPosture.intensity === "focused").length,
      activeWatchCount: items.reduce((sum, item) => sum + item.activeWatchCount, 0),
      activeActionCount: items.reduce((sum, item) => sum + item.activeActionCount, 0),
      staleMemoryCount: items.filter((item) => !item.latestMemoryAt || daysSince(String(item.latestMemoryAt).slice(0, 10)) > 14).length,
    },
    items,
  };
}

export async function getCaptainCommandCenter(db: D1Database, propertyRef: string) {
  await ensureCaptainRuntimeTables(db);
  const status = await getCaptainStatus(db, propertyRef);
  const propertyCode = status.propertyCode;
  const [memoryEntries, sourceCoverage] = await Promise.all([
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT id, summary, structured_payload_json, source_system, confidence, status, created_at, updated_at
       FROM governed_memory_entries
       WHERE property_id = ?
       ORDER BY created_at DESC
       LIMIT 12`,
      [status.property.id]
    ),
    getCaptainSourceCoverage(db, propertyCode, status.property.ga4_property_id),
  ]);
  return {
    ...status,
    memoryEntries,
    sourceCoverage,
  };
}

export async function runCaptainAgents(
  db: D1Database,
  propertyRef: string,
  options: { agentKey?: string; runType: CaptainRunType; actorId?: string | null }
) {
  await ensureCaptainRuntimeTables(db);
  const property = await resolveCommunity(db, propertyRef);
  const propertyCode = property.encasa_property_code ?? propertyRef;
  const agents = await getSupportAgents(db, propertyCode);
  const selected = options.agentKey ? agents.filter((agent) => agent.agent_key === options.agentKey) : agents;
  if (selected.length === 0) {
    throw new Error(options.agentKey ? `No active Captain support agent found for ${options.agentKey}` : `No active Captain support agents found for ${propertyCode}`);
  }

  const results: AgentRunResult[] = [];
  for (const agent of selected) {
    results.push(await runOneAgent(db, property, propertyCode, agent, options));
  }
  return { property, propertyCode, results };
}

export async function runScheduledCaptains(db: D1Database, scheduledAt: Date) {
  await ensureCaptainRuntimeTables(db);
  const schedule = captainScheduleBucket(scheduledAt);
  const agentRows = await queryAll<Pick<SupportAgentRow, "property_id" | "agent_key" | "role" | "cadence" | "source_scope_json">>(
    db,
    `SELECT property_id, agent_key, role, cadence, source_scope_json
     FROM captain_support_agents
     WHERE status = 'active'
     ORDER BY property_id, agent_key`,
    []
  );
  const eligibleRows = agentRows.filter((row) => isAgentEligibleForScheduledCadence(row, schedule.cadence));
  const selectedRows = eligibleRows
    .filter((row) => captainAgentBucket(row.property_id, row.agent_key, schedule.bucketCount) === schedule.bucketIndex)
    .sort((left, right) => designationPriorityWeight(right.source_scope_json) - designationPriorityWeight(left.source_scope_json) || left.property_id.localeCompare(right.property_id) || left.agent_key.localeCompare(right.agent_key));
  const runs = [];
  for (const row of selectedRows) {
    runs.push(await runCaptainAgents(db, row.property_id, { agentKey: row.agent_key, runType: "scheduled", actorId: "cloudflare-cron" }));
  }
  return {
    scheduledAt: scheduledAt.toISOString(),
    mode: schedule.mode,
    cadence: schedule.cadence,
    bucketIndex: schedule.bucketIndex,
    bucketCount: schedule.bucketCount,
    selectedAgentCount: selectedRows.length,
    totalEligibleAgentCount: eligibleRows.length,
    runs,
  };
}

const DAILY_CAPTAIN_CRON_SLOTS = ["12:00", "12:20", "12:40", "13:00"];
const WEEKLY_CAPTAIN_CRON_SLOTS = ["13:30"];

function captainScheduleBucket(scheduledAt: Date) {
  const slot = `${String(scheduledAt.getUTCHours()).padStart(2, "0")}:${String(scheduledAt.getUTCMinutes()).padStart(2, "0")}`;
  const weeklyIndex = scheduledAt.getUTCDay() === 1 ? WEEKLY_CAPTAIN_CRON_SLOTS.indexOf(slot) : -1;
  if (weeklyIndex >= 0) {
    const bucketCount = 4;
    return { cadence: "weekly" as const, mode: "weekly_bucketed", bucketIndex: weekBucketOffset(scheduledAt, bucketCount), bucketCount };
  }
  const dailyIndex = DAILY_CAPTAIN_CRON_SLOTS.indexOf(slot);
  if (dailyIndex >= 0) {
    const bucketCount = 16;
    return { cadence: "daily" as const, mode: "daily_bucketed", bucketIndex: dayBucketOffset(scheduledAt, bucketCount) + dailyIndex, bucketCount };
  }
  const fallbackBucketCount = 16;
  const fallbackIndex = Math.abs((scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes()) % fallbackBucketCount);
  return { cadence: "daily" as const, mode: "daily_fallback_bucketed", bucketIndex: fallbackIndex, bucketCount: fallbackBucketCount };
}

function dayBucketOffset(scheduledAt: Date, bucketCount: number) {
  const dayStart = Date.UTC(scheduledAt.getUTCFullYear(), 0, 1);
  const currentDay = Date.UTC(scheduledAt.getUTCFullYear(), scheduledAt.getUTCMonth(), scheduledAt.getUTCDate());
  const dayOfYear = Math.floor((currentDay - dayStart) / 86_400_000);
  const slotCount = DAILY_CAPTAIN_CRON_SLOTS.length;
  return (dayOfYear % Math.ceil(bucketCount / slotCount)) * slotCount;
}

function weekBucketOffset(scheduledAt: Date, bucketCount: number) {
  const yearStart = Date.UTC(scheduledAt.getUTCFullYear(), 0, 1);
  const currentDay = Date.UTC(scheduledAt.getUTCFullYear(), scheduledAt.getUTCMonth(), scheduledAt.getUTCDate());
  const weekOfYear = Math.floor((currentDay - yearStart) / (7 * 86_400_000));
  return weekOfYear % bucketCount;
}

function captainAgentBucket(propertyId: string, agentKey: string, bucketCount: number) {
  const key = `${propertyId}:${agentKey}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash % bucketCount;
}

function designationPriorityWeight(sourceScopeJson?: string | null) {
  const designation = String(parseJsonObject(sourceScopeJson)?.designation ?? "").trim();
  if (designation === "Critical") return 3;
  if (designation === "Sale" || designation === "Spotlight") return 2;
  return 1;
}

function isAgentEligibleForScheduledCadence(
  agent: Pick<SupportAgentRow, "agent_key" | "role" | "cadence" | "source_scope_json">,
  cadence: "daily" | "weekly"
) {
  if (agent.cadence === cadence) {
    return true;
  }
  if (cadence !== "daily" || agent.cadence !== "weekly") {
    return false;
  }
  const designation = String(parseJsonObject(agent.source_scope_json)?.designation ?? "").trim();
  if (designation !== "Critical") {
    return false;
  }
  const roleKey = captainAgentRoleKey(agent.agent_key);
  return roleKey === "reputation_watch" || roleKey === "logkeeper";
}

export async function createCaptainBriefRun(
  db: D1Database,
  propertyRef: string,
  input: { briefType: "captain_brief" | "supervisor_read"; periodStart?: string | null; periodEnd?: string | null; actorId?: string | null }
) {
  await ensureCaptainRuntimeTables(db);
  const property = await resolveCommunity(db, propertyRef);
  const propertyCode = property.encasa_property_code ?? propertyRef;
  const [latestMemory, watchItems, actions, claims, marketingInsight, inventory, operatingSnapshot, reputationInsight, competitorMarketRead] = await Promise.all([
    queryFirst<{ id: string; summary: string; structured_payload_json: string | null }>(
      db,
      `SELECT id, summary, structured_payload_json FROM governed_memory_entries WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
      [property.id]
    ),
    queryAll(db, `SELECT * FROM captain_watch_items WHERE property_id = ? AND status IN ('open', 'monitoring', 'escalated') ORDER BY severity DESC, updated_at DESC`, [propertyCode]),
    queryAll(db, `SELECT * FROM captain_actions WHERE property_id = ? AND status IN ('open', 'in_progress', 'blocked') ORDER BY priority DESC, due_date ASC`, [propertyCode]),
    safeQueryAll(db, `SELECT id, claim_type, subject, truth_status, priority, statement FROM property_brief_claims WHERE property_id = ? ORDER BY priority DESC, created_at DESC LIMIT 20`, [propertyCode]),
    getCaptainMarketingInsight(db, property, propertyCode),
    getCaptainInventoryRead(db, property.ga4_property_id ?? property.external_key ?? propertyCode),
    getCaptainOperatingSnapshot(db, property, propertyCode),
    getCaptainReputationInsight(db, property, propertyCode),
    getCaptainCompetitorMarketRead(db, property, propertyCode),
  ]);
  const activeWatchItems = watchItems.filter((item) => ["open", "monitoring", "escalated"].includes(String(item.status)));
  const activeActions = actions.filter((item) => ["open", "in_progress", "blocked"].includes(String(item.status)));
  const supportAgents = await getSupportAgentsOrEmpty(db, propertyCode);
  const diagnosticBase = buildCaptainDiagnosticRead({
    property,
    propertyCode,
    commandPosture: deriveCaptainCommandPosture(supportAgents),
    activeWatchItems,
    activeActions,
    sources: {},
    inventory,
    operatingSnapshot,
    marketingInsight,
    reputationInsight,
    competitorMarketRead,
  });
  const diagnosticRead = {
    ...diagnosticBase,
    peerFamilyRead: await getCaptainPeerFamilyRead(db, property, propertyCode, diagnosticBase),
  };
  const now = new Date().toISOString();
  const summary =
    latestMemory?.summary ??
    `${property.name} has no Captain memory entry yet. The brief run is blocked until property memory exists.`;
  const commandPosture = diagnosticRead.commandPosture;
  const payload = {
    property,
    propertyCode,
    commandPosture,
    latestMemory,
    watchItems,
    actions,
    claims,
    marketingInsight,
    inventory,
    operatingSnapshot,
    reputationInsight,
    competitorMarketRead,
    diagnosticRead,
    sourceAuthority: "Data Pond governs internal facts; vendor reports advise.",
  };
  const status = latestMemory ? "draft" : "blocked";
  const id = `captain_brief_${propertyCode}_${compactTimestamp(now)}_${crypto.randomUUID().slice(0, 8)}`;
  await run(
    db,
    `INSERT INTO captain_brief_runs (
      id, property_id, community_id, run_status, brief_type, period_start, period_end,
      memory_entry_id, summary, payload_json, artifact_ref, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      id,
      propertyCode,
      property.id,
      status,
      input.briefType,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      latestMemory?.id ?? null,
      summary,
      JSON.stringify(payload),
      input.actorId ?? null,
      now,
      now,
    ]
  );
  return queryFirst(db, `SELECT * FROM captain_brief_runs WHERE id = ?`, [id]);
}

export async function getLatestCaptainBriefRead(db: D1Database, propertyRef: string) {
  await ensureCaptainRuntimeTables(db);
  const property = await resolveCommunity(db, propertyRef);
  const propertyCode = property.encasa_property_code ?? propertyRef;
  const ga4Id = property.ga4_property_id ?? property.external_key ?? propertyCode;
  const latestBrief = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM captain_brief_runs
     WHERE property_id = ? AND brief_type = 'captain_brief'
     ORDER BY created_at DESC
     LIMIT 1`,
    [propertyCode]
  );
  const [watchItems, actions, recentRuns, sources, inventory, operatingSnapshot, marketingInsight, reputationInsight, competitorMarketRead] = await Promise.all([
    queryAll<Record<string, unknown>>(db, `SELECT * FROM captain_watch_items WHERE property_id = ? ORDER BY status ASC, severity DESC, updated_at DESC`, [propertyCode]),
    queryAll<Record<string, unknown>>(db, `SELECT * FROM captain_actions WHERE property_id = ? ORDER BY status ASC, priority DESC, due_date ASC`, [propertyCode]),
    queryAll<Record<string, unknown>>(db, `SELECT * FROM captain_agent_runs WHERE property_id = ? ORDER BY finished_at DESC LIMIT 12`, [propertyCode]),
    getCaptainSourceReadiness(db, property, propertyCode),
    getCaptainInventoryRead(db, ga4Id),
    getCaptainOperatingSnapshot(db, property, propertyCode),
    getCaptainMarketingInsight(db, property, propertyCode),
    getCaptainReputationInsight(db, property, propertyCode),
    getCaptainCompetitorMarketRead(db, property, propertyCode),
  ]);
  const payload = parseJsonObject(latestBrief?.payload_json);
  const activeWatchItems = watchItems.filter((item) => ["open", "monitoring", "escalated"].includes(String(item.status)));
  const activeActions = actions.filter((item) => ["open", "in_progress", "blocked"].includes(String(item.status)));
  const resolvedSourceItems = watchItems.filter((item) =>
    ["source_freshness", "unit_feed_missing", "guest_cards_missing"].includes(String(item.watch_key)) && item.status === "resolved"
  );
  const payloadCommandPosture = payload?.commandPosture && typeof payload.commandPosture === "object"
    ? payload.commandPosture as Record<string, unknown>
    : null;
  const commandPosture = payloadCommandPosture ?? deriveCaptainCommandPosture(await getSupportAgentsOrEmpty(db, propertyCode));
  const diagnosticBase = buildCaptainDiagnosticRead({
    property,
    propertyCode,
    commandPosture,
    activeWatchItems,
    activeActions,
    sources,
    inventory,
    operatingSnapshot,
    marketingInsight,
    reputationInsight,
    competitorMarketRead,
  });
  const diagnosticRead = {
    ...diagnosticBase,
    peerFamilyRead: await getCaptainPeerFamilyRead(db, property, propertyCode, diagnosticBase),
  };

  return {
    property,
    propertyCode,
    captainName: readCaptainName(payload) ?? defaultCaptainName(property.name),
    commandPosture,
    latestBrief,
    summary: String(latestBrief?.summary ?? payload?.summary ?? ""),
    period: {
      start: latestBrief?.period_start ?? null,
      end: latestBrief?.period_end ?? null,
      generatedAt: latestBrief?.created_at ?? null,
    },
    sourceAuthority: "Data Pond governs internal facts; vendor reports advise.",
    activeWatchItems,
    activeActions,
    resolvedSourceItems,
    recentRuns,
    sources,
    inventory,
    operatingSnapshot,
    marketingInsight,
    reputationInsight,
    competitorMarketRead,
    diagnosticRead,
  };
}

async function runOneAgent(
  db: D1Database,
  property: CommunityRow,
  propertyCode: string,
  agent: SupportAgentRow,
  options: { runType: CaptainRunType; actorId?: string | null }
): Promise<AgentRunResult> {
  const startedAt = new Date().toISOString();
  const runId = `captain_run_${propertyCode}_${agent.agent_key}_${compactTimestamp(startedAt)}_${crypto.randomUUID().slice(0, 8)}`;
  const exceptions: string[] = [];
  let agentOutput: Omit<AgentRunResult, "runId" | "propertyId" | "communityId" | "agentKey" | "exceptions">;

  try {
    agentOutput = await executeAgent(db, property, propertyCode, agent);
  } catch (error) {
    agentOutput = {
      status: "failed",
      findings: { message: "Captain support agent failed." },
      metrics: {},
      watchItems: [],
      actions: [],
    };
    exceptions.push(error instanceof Error ? error.message : String(error));
  }

  const finishedAt = new Date().toISOString();
  await run(
    db,
    `INSERT INTO captain_agent_runs (
      id, property_id, community_id, agent_key, run_type, run_status, started_at, finished_at,
      source_window_start, source_window_end, findings_json, metrics_json, exceptions_json, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      propertyCode,
      property.id,
      agent.agent_key,
      options.runType,
      agentOutput.status,
      startedAt,
      finishedAt,
      null,
      null,
      JSON.stringify(agentOutput.findings),
      JSON.stringify(agentOutput.metrics),
      JSON.stringify(exceptions),
      options.actorId ?? null,
      finishedAt,
    ]
  );

  for (const watch of agentOutput.watchItems) {
    await upsertWatchItem(db, property, propertyCode, agent.agent_key, watch, options.actorId ?? null, finishedAt);
  }
  for (const action of agentOutput.actions) {
    await upsertAction(db, property, propertyCode, agent.agent_key, runId, action, options.actorId ?? null, finishedAt);
  }

  return {
    runId,
    propertyId: propertyCode,
    communityId: property.id,
    agentKey: agent.agent_key,
    exceptions,
    ...agentOutput,
  };
}

async function executeAgent(db: D1Database, property: CommunityRow, propertyCode: string, agent: SupportAgentRow) {
  const roleKey = captainAgentRoleKey(agent.agent_key as CaptainAgentKey);
  const designation = designationFromSourceScope(agent.source_scope_json);
  switch (roleKey) {
    case "source_scout":
      return sourceScout(db, property, propertyCode, designation);
    case "truth_reconciler":
      return truthReconciler(db, propertyCode, designation);
    case "inventory_watch":
      return inventoryWatch(db, property, propertyCode, designation);
    case "funnel_watch":
      return funnelWatch(db, propertyCode);
    case "media_watch":
      return mediaWatch(db, property, propertyCode);
    case "navigator_watch":
      return navigatorWatch(db, property, propertyCode);
    case "reputation_watch":
      return reputationWatch(db, property, propertyCode);
    case "experience_watch":
      return experienceWatch(db, property, propertyCode);
    case "boatswain":
      return boatswain(db, propertyCode);
    case "logkeeper":
      return logkeeper(db, property, propertyCode);
    case "supervisor_scribe":
      return supervisorScribe(db, propertyCode);
    default:
      return {
        status: "skipped" as CaptainRunStatus,
        findings: { message: `No runner implemented for ${agent.agent_key}` },
        metrics: {},
        watchItems: [],
        actions: [],
      };
  }
}

async function sourceScout(db: D1Database, property: CommunityRow, propertyCode: string, designation: string | null) {
  const ga4Id = property.ga4_property_id ?? property.external_key ?? propertyCode;
  const sources = {
    guestCards: await safeScalar(db, `SELECT MAX(run_date) AS value FROM guest_card_metrics WHERE property_code = ?`, [propertyCode]),
    unitFeed: await safeScalar(db, `SELECT MAX(snapshot_date) AS value FROM unit_availability_units WHERE property_id = ?`, [ga4Id]),
    marketingBiPacket: await safeScalar(db, `SELECT MAX(report_date) AS value FROM marketing_bi_daily_packets`, []),
    marketingOpsSummary: await safeScalar(db, `SELECT MAX(report_date) AS value FROM marketing_ops_summary_rows WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    availableUnitInterest: await safeScalar(db, `SELECT MAX(report_date) AS value FROM available_unit_interest_metrics WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    trafficConversions: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(report_date) AS value FROM marketing_bi_traffic_conversions_full WHERE property_id = ? OR community_id = ?`, params: [propertyCode, property.id] },
      { sql: `SELECT MAX(report_date) AS value FROM marketing_traffic_conversions WHERE property_id = ? OR community_id = ?`, params: [propertyCode, property.id] },
    ]),
    cancelDenial: await safeScalar(db, `SELECT MAX(report_date) AS value FROM marketing_cancel_denial_by_source WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    ga4: await safeScalar(db, `SELECT MAX(metric_date) AS value FROM ga4_daily_metrics WHERE property_id = ?`, [ga4Id]),
    gsc: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(metric_date) AS value FROM gsc_daily_metrics WHERE property_id = ? OR ga4_property_id = ?`, params: [ga4Id, ga4Id] },
      { sql: `SELECT MAX(metric_date) AS value FROM gsc_daily_metrics WHERE community_id = ?`, params: [property.id] },
    ]),
    googleAds: await safeScalar(db, `SELECT MAX(metric_date) AS value FROM google_ads_campaigns WHERE property_id = ?`, [ga4Id]),
    psi: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(metric_date) AS value FROM pagespeed_metrics WHERE property_id = ?`, params: [ga4Id] },
      { sql: `SELECT MAX(metric_date) AS value FROM pilot_control_psi_metrics WHERE property_id = ?`, params: [ga4Id] },
    ]),
    gbp: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(metric_date) AS value FROM gbp_daily_insights WHERE property_id = ?`, params: [ga4Id] },
      { sql: `SELECT MAX(review_create_time) AS value FROM gbp_reviews WHERE property_id = ?`, params: [ga4Id] },
    ]),
    reputationCom: await safeScalar(db, `SELECT MAX(report_date) AS value FROM reputation_com_location_leaderboard WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    dataforseoRankings: await safeScalar(db, `SELECT MAX(run_date) AS value FROM dataforseo_property_keyword_rankings WHERE property_id = ?`, [propertyCode]),
    dataforseoOnPage: await safeScalar(db, `SELECT MAX(run_date) AS value FROM dataforseo_onpage_page_snapshots WHERE property_id = ?`, [propertyCode]),
    dataforseoBusiness: await safeScalar(db, `SELECT MAX(run_date) AS value FROM dataforseo_business_profiles WHERE property_id = ?`, [propertyCode]),
  };
  const latestAds = await safeQueryFirst<{ campaign_status: string | null; metric_date: string | null; campaign_name: string | null }>(
    db,
    `SELECT campaign_status, metric_date, campaign_name FROM google_ads_campaigns WHERE property_id = ? ORDER BY metric_date DESC LIMIT 1`,
    [ga4Id]
  );
  const missing = Object.entries(sources).filter(([, value]) => !value).map(([key]) => key);
  const stale = Object.entries(sources)
    .filter(([key, value]) => {
      if (!value || daysSince(String(value)) <= 7) return false;
      if (key === "googleAds" && latestAds?.campaign_status?.toUpperCase() === "PAUSED") return false;
      if (key === "reputationCom" && daysSince(String(value)) <= 35) return false;
      return true;
    })
    .map(([key, value]) => ({ source: key, latestDate: value }));
  const watchItems: WatchItemInput[] = [];
  if (missing.length || stale.length) {
    watchItems.push({
      watchKey: "source_freshness",
      title: "Source freshness and routing",
      category: "source_intake",
      severity: designationSeverity(missing.length ? "high" : "medium", designation),
      status: "open",
      currentState: `Missing: ${missing.join(", ") || "none"}; stale: ${stale.map((s) => `${s.source} ${s.latestDate}`).join(", ") || "none"}.`,
      evidence: { sources, missing, stale },
      nextMove: "Resolve source routing before the next Captain Brief.",
      ownerRole: "Data Pond / WebOps",
    });
  }
  return {
    status: missing.length || stale.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { sources, missing, stale, paidMediaPosture: latestAds?.campaign_status?.toUpperCase() === "PAUSED" ? "paused_no_current_activity" : "active_or_unknown" },
    metrics: { sourceCount: Object.keys(sources).length, missingCount: missing.length, staleCount: stale.length },
    watchItems,
    actions: missing.length ? [{
      actionKey: "resolve_source_routing",
      title: "Resolve missing Captain source routing",
      ownerRole: "Data Pond / WebOps",
      status: "open" as const,
      priority: designationPriority("high", designation),
      evidence: { missing, sources },
    }] : [],
  };
}

async function truthReconciler(db: D1Database, propertyCode: string, designation: string | null) {
  const rows = await safeQueryAll<{ truth_status: string; count: number }>(
    db,
    `SELECT truth_status, COUNT(*) AS count FROM property_brief_claims WHERE property_id = ? GROUP BY truth_status`,
    [propertyCode]
  );
  const needsReview = rows.filter((row) => row.truth_status === "needs_review").reduce((sum, row) => sum + Number(row.count), 0);
  const conflicts = rows.filter((row) => row.truth_status === "conflict").reduce((sum, row) => sum + Number(row.count), 0);
  const unresolved = needsReview + conflicts;
  return {
    status: unresolved ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { claimStatusCounts: rows, needsReview, conflicts, unresolved },
    metrics: { needsReview, conflicts, unresolved },
    watchItems: unresolved ? [{
      watchKey: "claims_requiring_source_resolution",
      title: "Claims requiring source-authority resolution",
      category: "source_authority",
      severity: designationSeverity("high", designation),
      status: "open" as const,
      currentState: `${needsReview} claim(s) need review; ${conflicts} claim(s) are formal source conflicts or routing gaps.`,
      evidence: { claimStatusCounts: rows, needsReview, conflicts },
      nextMove: "Resolve open review items and route formal source conflicts to the owning source-of-record lane.",
      ownerRole: "Data Pond / WebOps",
    }] : [],
    actions: unresolved ? [{
      actionKey: "resolve_source_authority_claims",
      title: "Resolve Captain source-authority claim gaps",
      ownerRole: "Data Pond / WebOps",
      status: "open" as const,
      priority: designationPriority("high", designation),
      evidence: { claimStatusCounts: rows, needsReview, conflicts },
    }] : [],
  };
}

async function inventoryWatch(db: D1Database, property: CommunityRow, propertyCode: string, designation: string | null) {
  const ga4Id = property.ga4_property_id ?? property.external_key ?? propertyCode;
  const latestSnapshot = await safeScalar(db, `SELECT MAX(snapshot_date) AS value FROM unit_availability_units WHERE property_id = ?`, [ga4Id]);
  if (!latestSnapshot) {
    return {
      status: "warning" as CaptainRunStatus,
      findings: { message: "No unit-level availability snapshot found.", propertyId: ga4Id },
      metrics: {},
      watchItems: [{
        watchKey: "unit_feed_missing",
        title: "Unit feed missing",
        category: "inventory",
        severity: designationSeverity("high", designation),
        status: "open" as const,
        currentState: "No unit-level availability snapshot is available in D1 for this property.",
        evidence: { propertyId: ga4Id },
        nextMove: "Route the ThirtyLines unit feed into D1 before publishing the next Captain Brief.",
        ownerRole: "Data Pond",
      }],
      actions: [],
    };
  }
  const rows = await safeQueryAll<{ floorplan_name: string; units: number; aged_30: number; aged_60: number; aged_90: number; aged_180: number; aged_365: number; specials: number }>(
    db,
    `SELECT floorplan_name,
      COUNT(*) AS units,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 30 THEN 1 ELSE 0 END) AS aged_30,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 60 THEN 1 ELSE 0 END) AS aged_60,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 90 THEN 1 ELSE 0 END) AS aged_90,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 180 THEN 1 ELSE 0 END) AS aged_180,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 365 THEN 1 ELSE 0 END) AS aged_365,
      SUM(CASE WHEN COALESCE(pricing_and_specials_message, '') <> '' OR concession_amount IS NOT NULL THEN 1 ELSE 0 END) AS specials
     FROM unit_availability_units
     WHERE property_id = ? AND snapshot_date = ?
     GROUP BY floorplan_name
     ORDER BY aged_90 DESC, units DESC`,
    [ga4Id, latestSnapshot]
  );
  const total365 = rows.reduce((sum, row) => sum + Number(row.aged_365 ?? 0), 0);
  const a1 = rows.find((row) => normalizeFloorplan(row.floorplan_name) === "a1");
  const b1 = rows.find((row) => normalizeFloorplan(row.floorplan_name) === "b1");
  const watchItems: WatchItemInput[] = [];
  if (a1 && Number(a1.aged_90) > 0) {
    watchItems.push(floorplanWatch("a1_inventory_pressure", "A1 inventory pressure", a1));
  }
  if (b1 && Number(b1.aged_90) > 0) {
    watchItems.push(floorplanWatch("b1_inventory_pressure", "B1 inventory pressure", b1));
  }
  if (total365 > 0) {
    watchItems.push({
      watchKey: "aged_365_units",
      title: "365+ day unit validation",
      category: "inventory",
      severity: designationSeverity("critical", designation),
      status: "open",
      currentState: `${total365} unit(s) show 365+ days since feed move-out date.`,
      evidence: { latestSnapshot, floorplans: rows },
      nextMove: "Classify each 365+ day unit as true vacant, held/down, renovation, model/admin, or feed artifact.",
      ownerRole: "Property / Revenue",
    });
  }
  return {
    status: watchItems.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { latestSnapshot, floorplans: rows },
    metrics: { latestSnapshot, floorplanCount: rows.length, aged365: total365 },
    watchItems,
    actions: total365 ? [{
      actionKey: "classify_365_day_units",
      title: "Classify 365+ day units",
      ownerRole: "Property / Revenue",
      status: "open" as const,
      priority: designationPriority("critical", designation),
      evidence: { latestSnapshot, aged365: total365 },
    }] : [],
  };
}

async function funnelWatch(db: D1Database, propertyCode: string) {
  const latest = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM guest_card_metrics WHERE property_code = ? ORDER BY run_date DESC LIMIT 1`,
    [propertyCode]
  );
  if (!latest) {
    return {
      status: "warning" as CaptainRunStatus,
      findings: { message: "No guest-card metric row found.", propertyCode },
      metrics: {},
      watchItems: [{
        watchKey: "guest_cards_missing",
        title: "Guest Cards missing",
        category: "leasing_funnel",
        severity: "high" as const,
        status: "open" as const,
        currentState: "No guest-card metric row is available in D1 for this property.",
        evidence: { propertyCode },
        nextMove: "Route the guest-card daily export into D1.",
        ownerRole: "Data Pond / WebOps",
      }],
      actions: [],
    };
  }
  const apps = Number(latest.apps_this_period ?? 0);
  const guestCards = Number(latest.gc_this_period ?? 0);
  const traffic = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM marketing_traffic_conversions WHERE property_id = ? ORDER BY report_date DESC LIMIT 1`,
    [propertyCode]
  );
  const availableInterest = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM available_unit_interest_metrics WHERE property_id = ? ORDER BY report_date DESC LIMIT 1`,
    [propertyCode]
  );
  const conversionRead = buildMarketingConversionRead(traffic, availableInterest);
  return {
    status: "success" as CaptainRunStatus,
    findings: { latest, traffic, availableInterest, conversionRead },
    metrics: { runDate: latest.run_date, guestCards, apps, ...conversionRead.metrics },
    watchItems: [],
    actions: [],
  };
}

async function mediaWatch(db: D1Database, property: CommunityRow, propertyCode: string) {
  const ga4Id = property.ga4_property_id ?? property.external_key ?? propertyCode;
  const [ga4, gsc, ads, psi, gbp] = await Promise.all([
    safeQueryFirst(db, `SELECT * FROM ga4_daily_metrics WHERE property_id = ? ORDER BY metric_date DESC LIMIT 1`, [ga4Id]),
    firstAvailableRow(db, [
      { sql: `SELECT * FROM gsc_daily_metrics WHERE property_id = ? OR ga4_property_id = ? ORDER BY metric_date DESC LIMIT 1`, params: [ga4Id, ga4Id] },
      { sql: `SELECT * FROM gsc_daily_metrics WHERE community_id = ? ORDER BY metric_date DESC LIMIT 1`, params: [property.id] },
    ]),
    safeQueryFirst(db, `SELECT * FROM google_ads_campaigns WHERE property_id = ? ORDER BY metric_date DESC LIMIT 1`, [ga4Id]),
    safeQueryFirst(db, `SELECT * FROM pagespeed_metrics WHERE property_id = ? ORDER BY metric_date DESC LIMIT 1`, [ga4Id]),
    safeQueryFirst(db, `SELECT * FROM gbp_daily_insights WHERE property_id = ? ORDER BY metric_date DESC LIMIT 1`, [ga4Id]),
  ]);
  const missing = Object.entries({ ga4, gsc, ads, psi, gbp }).filter(([, row]) => !row).map(([key]) => key);
  return {
    status: missing.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { ga4, gsc, ads, psi, gbp, missing },
    metrics: { missingCount: missing.length },
    watchItems: missing.length ? [{
      watchKey: "media_signals_missing",
      title: "Media and visibility source gaps",
      category: "media",
      severity: "medium" as const,
      status: "monitoring" as const,
      currentState: `Missing latest rows for: ${missing.join(", ")}.`,
      evidence: { missing },
      nextMove: "Confirm the missing media lanes are mirrored before the weekly Captain Brief.",
      ownerRole: "WebOps",
    }] : [],
    actions: [],
  };
}

async function reputationWatch(db: D1Database, property: CommunityRow, propertyCode: string) {
  const insight = await getCaptainReputationInsight(db, property, propertyCode);
  if (insight.status === "missing_source") {
    return {
      status: "warning" as CaptainRunStatus,
      findings: insight,
      metrics: {},
      watchItems: [{
        watchKey: "reputation_source_missing",
        title: "Reputation.com source missing",
        category: "reputation",
        severity: "medium" as const,
        status: "monitoring" as const,
        currentState: "No Reputation.com leaderboard row is mirrored for this Captain property.",
        evidence: insight,
        nextMove: "Mirror the latest Reputation.com exports into Captain D1 before relying on reputation posture.",
        ownerRole: "Data Pond / Reputation",
      }],
      actions: [],
    };
  }

  const watchItems: WatchItemInput[] = [];
  const actions: ActionInput[] = [];
  const metrics = insight.metrics ?? {};
  const score = num(metrics.reputationScore);
  const responseRate = num(metrics.responseRate);
  const negativePct = num(metrics.negativeReviewPct);
  const janChange = num(insight.trend?.janToCurrentChange);
  const competitorGap = num(insight.localCompetition?.gapVsCompetitorAvg);
  const bestCompetitorGap = num(insight.localCompetition?.gapVsBestCompetitor);
  const listingCompleteness = num(insight.components?.listingCompleteness);
  const reviewResponse = num(insight.components?.reviewResponse);
  const gbpLowRecentReviews = num(insight.gbpReviewRead?.metrics?.recentLowStarReviews);
  const gbpUnansweredLowReviews = num(insight.gbpReviewRead?.metrics?.unansweredLowStarReviews);
  const gbpAttentionReviews = num(insight.gbpReviewRead?.metrics?.requiresAttentionCount);

  if (score !== null && score < 780) {
    watchItems.push({
      watchKey: "reputation_score_below_threshold",
      title: "Reputation score below Captain threshold",
      category: "reputation",
      severity: score < 740 ? "high" : "medium",
      status: "open",
      currentState: `Reputation.com score is ${score}, below the 780 Captain watch threshold.`,
      evidence: insight,
      nextMove: "Review recent themes, response posture, and listing/review component gaps before the next Captain Brief.",
      ownerRole: "Captain / Reputation",
    });
  }
  if (janChange !== null && janChange <= -50) {
    watchItems.push({
      watchKey: "reputation_score_decline",
      title: "Reputation score declined materially",
      category: "reputation",
      severity: janChange <= -75 ? "high" : "medium",
      status: "open",
      currentState: `Reputation.com score is down ${Math.abs(janChange)} points from January to the current report month.`,
      evidence: insight,
      nextMove: "Confirm whether the decline is driven by sentiment, volume, recency, response, or listing completeness.",
      ownerRole: "Captain / Reputation",
    });
  }
  if (responseRate !== null && responseRate < 70) {
    watchItems.push({
      watchKey: "reputation_response_rate_low",
      title: "Review response rate below threshold",
      category: "reputation",
      severity: "medium",
      status: "open",
      currentState: `Reputation.com response rate is ${responseRate.toFixed(1)}%, below the 70% Captain threshold.`,
      evidence: insight,
      nextMove: "Assign response follow-up and confirm open public reviews have owner coverage.",
      ownerRole: "Property / Reputation",
    });
  }
  if (competitorGap !== null && competitorGap < 0) {
    watchItems.push({
      watchKey: "local_competitor_reputation_gap",
      title: "Local competitors have reputation advantage",
      category: "reputation",
      severity: bestCompetitorGap !== null && bestCompetitorGap <= -50 ? "high" : "medium",
      status: "open",
      currentState: `Reputation.com local competitor average is ${Math.abs(competitorGap).toFixed(1)} points ahead.`,
      evidence: insight,
      nextMove: "Compare local competitor proof and decide whether review generation, response, or trust-copy changes are needed.",
      ownerRole: "Navigator / Reputation",
    });
  }
  if ((listingCompleteness !== null && listingCompleteness < 90) || (reviewResponse !== null && reviewResponse < 75)) {
    watchItems.push({
      watchKey: "reputation_component_gap",
      title: "Reputation.com component gap",
      category: "reputation",
      severity: "medium",
      status: "monitoring",
      currentState: `Component scores need attention: listing completeness ${listingCompleteness ?? "n/a"}, review response ${reviewResponse ?? "n/a"}.`,
      evidence: insight,
      nextMove: "Use the component read to assign a specific listing or response cleanup task.",
      ownerRole: "Reputation / WebOps",
    });
  }
  if (negativePct !== null && negativePct >= 20) {
    watchItems.push({
      watchKey: "negative_review_mix_high",
      title: "Negative review mix elevated",
      category: "reputation",
      severity: "medium",
      status: "monitoring",
      currentState: `Negative reviews are ${negativePct.toFixed(1)}% of the current Reputation.com period.`,
      evidence: insight,
      nextMove: "Read recent negative review themes and reconcile against service/maintenance action history.",
      ownerRole: "Captain / Property",
    });
  }
  if ((gbpLowRecentReviews !== null && gbpLowRecentReviews > 0) || (gbpAttentionReviews !== null && gbpAttentionReviews > 0)) {
    watchItems.push({
      watchKey: "gbp_review_attention_needed",
      title: "GBP review themes need Captain attention",
      category: "reputation",
      severity: gbpUnansweredLowReviews !== null && gbpUnansweredLowReviews > 0 ? "high" : "medium",
      status: "open",
      currentState: `GBP reviews show ${gbpLowRecentReviews ?? 0} recent low-star review(s), ${gbpUnansweredLowReviews ?? 0} unanswered low-star review(s), and ${gbpAttentionReviews ?? 0} sentiment item(s) requiring attention.`,
      evidence: insight.gbpReviewRead ?? {},
      nextMove: "Read the latest GBP review examples, assign response cleanup, and reconcile repeated themes against operating action history.",
      ownerRole: "Captain / Reputation",
    });
  }

  if (watchItems.length) {
    actions.push({
      actionKey: "reputation_follow_up",
      title: "Resolve Reputation.com Captain watch items",
      ownerRole: "Captain / Reputation",
      status: "open",
      priority: watchItems.some((item) => item.severity === "high" || item.severity === "critical") ? "high" : "medium",
      evidence: { watchKeys: watchItems.map((item) => item.watchKey), insight },
    });
  }

  return {
    status: watchItems.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: insight,
    metrics: { ...metrics, watchItemCount: watchItems.length },
    watchItems,
    actions,
  };
}

async function navigatorWatch(db: D1Database, property: CommunityRow, propertyCode: string) {
  const websiteUrl = property.full_url ?? "";
  const domain = hostFromUrl(websiteUrl);
  const [serpRows, keywordRows, labsRows, onpage, businessProfile, aiProbe, siteAudit] = await Promise.all([
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT keyword, best_rank_absolute, best_result_type, target_found, target_url, run_date
       FROM dataforseo_property_keyword_rankings
       WHERE property_id = ?
       ORDER BY run_date DESC, COALESCE(best_rank_absolute, 9999) ASC
       LIMIT 12`,
      [propertyCode]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT keyword, search_volume, cpc, competition, run_date
       FROM dataforseo_keyword_metrics
       WHERE property_id = ?
       ORDER BY run_date DESC, COALESCE(search_volume, 0) DESC
       LIMIT 12`,
      [propertyCode]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT keyword, rank_absolute, result_type, search_volume, cpc, url, run_date
       FROM dataforseo_labs_ranked_keywords
       WHERE property_id = ?
       ORDER BY run_date DESC, COALESCE(rank_absolute, 9999) ASC
       LIMIT 12`,
      [propertyCode]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM dataforseo_onpage_page_snapshots
       WHERE property_id = ?
       ORDER BY run_date DESC
       LIMIT 1`,
      [propertyCode]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM dataforseo_business_profiles
       WHERE property_id = ?
       ORDER BY run_date DESC
       LIMIT 1`,
      [propertyCode]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM dataforseo_ai_visibility_probes
       WHERE property_id = ?
       ORDER BY run_at DESC
       LIMIT 1`,
      [propertyCode]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM site_audit_results
       WHERE property_id = ? OR property_id = ? OR url = ?
       ORDER BY audit_date DESC
       LIMIT 1`,
      [propertyCode, property.ga4_property_id ?? property.external_key ?? propertyCode, websiteUrl]
    ),
  ]);
  const missing: string[] = [];
  if (!onpage) missing.push("DataForSEO OnPage");
  if (!serpRows.length) missing.push("DataForSEO SERP rankings");
  if (!keywordRows.length) missing.push("keyword demand metrics");
  if (!labsRows.length) missing.push("Labs ranked keywords");
  if (!businessProfile) missing.push("business profile/entity read");
  if (!aiProbe) missing.push("AI response visibility probe");
  if (!siteAudit) missing.push("Specs/live site audit bridge");

  const checks = parseJsonObject(onpage?.checks_json) ?? {};
  const activeChecks = Object.entries(checks)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  const urgentChecks = activeChecks.filter((key) =>
    ["title_too_long", "duplicate_meta_tags", "no_image_alt", "no_image_title", "high_loading_time", "high_waiting_time"].includes(key)
  );
  const genericMisses = serpRows.filter((row) => Number(row.target_found ?? 0) === 0).map((row) => row.keyword).filter(Boolean);
  const watchItems: WatchItemInput[] = [];
  if (missing.length) {
    watchItems.push({
      watchKey: "navigator_source_gaps",
      title: "Navigator evidence gaps",
      category: "navigator",
      severity: missing.length >= 3 ? "high" : "medium",
      status: "open",
      currentState: `Missing or not mirrored: ${missing.join(", ")}.`,
      evidence: { missing, domain, latestOnPageDate: onpage?.run_date ?? null },
      nextMove: "Route Navigator evidence into the Captain runtime before the next recovery read.",
      ownerRole: "Navigator / Data Pond",
    });
  }
  if (urgentChecks.length || genericMisses.length) {
    watchItems.push({
      watchKey: "navigator_specs_search_actions",
      title: "Specs, search, and content action queue",
      category: "navigator",
      severity: urgentChecks.length >= 3 || genericMisses.length >= 2 ? "high" : "medium",
      status: "open",
      currentState: [
        urgentChecks.length ? `OnPage flags: ${urgentChecks.join(", ")}` : null,
        genericMisses.length ? `No target found for: ${genericMisses.slice(0, 4).join(", ")}` : null,
      ].filter(Boolean).join("; "),
      evidence: { urgentChecks, genericMisses, onpage, serpRows: serpRows.slice(0, 8), keywordRows: keywordRows.slice(0, 8), labsRows: labsRows.slice(0, 8), businessProfile, aiProbe, siteAudit },
      nextMove: "Create exact Specs-backed copy/HTML/site tickets and measure with DataForSEO, GSC, GA4, and BrowserStack/EVS.",
      ownerRole: "Navigator / Site Content",
    });
  }
  return {
    status: watchItems.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: {
      domain,
      specsPosture: siteAudit ? "site_audit_available" : "needs_specs_live_bridge",
      onpage,
      businessProfile,
      aiProbe,
      serpRows,
      keywordRows,
      labsRows,
      activeChecks,
      urgentChecks,
      genericMisses,
      missing,
    },
    metrics: {
      missingCount: missing.length,
      onpageRunDate: onpage?.run_date ?? null,
      activeCheckCount: activeChecks.length,
      urgentCheckCount: urgentChecks.length,
      serpRows: serpRows.length,
      genericMissCount: genericMisses.length,
      businessRating: businessProfile?.rating ?? null,
      businessVotes: businessProfile?.votes_count ?? null,
      aiTargetMentioned: aiProbe?.target_mentioned ?? null,
    },
    watchItems,
    actions: urgentChecks.length || genericMisses.length ? [{
      actionKey: "create_specs_backed_web_content_tickets",
      title: "Create Specs-backed web/content/HTML tickets",
      ownerRole: "Navigator / Site Content",
      status: "open" as const,
      priority: "high" as const,
      evidence: { urgentChecks, genericMisses, onpageRunDate: onpage?.run_date ?? null },
    }] : [],
  };
}

async function experienceWatch(db: D1Database, property: CommunityRow, propertyCode: string) {
  const evsProperty = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM evs_properties
     WHERE community_id = ? OR lower(property_name) = lower(?) OR legacy_url = ? OR staging_url = ?
     LIMIT 1`,
    [property.id, property.name, property.full_url ?? "", property.full_url ?? ""]
  );
  const latestRequest = evsProperty ? await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM evs_requests WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
    [evsProperty.id]
  ) : null;
  const latestResult = evsProperty ? await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM evs_results WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
    [evsProperty.id]
  ) : null;
  const missingEvs = !evsProperty || !latestRequest || !latestResult;
  const failed = latestResult?.status === "fail";
  const stale = latestResult?.created_at ? daysSince(String(latestResult.created_at).slice(0, 10)) > 14 : false;
  const watchItems: WatchItemInput[] = [];
  if (missingEvs || failed || stale) {
    watchItems.push({
      watchKey: "experience_validation_status",
      title: "BrowserStack / EVS experience validation",
      category: "experience_validation",
      severity: failed ? "high" : missingEvs ? "medium" : "low",
      status: failed ? "open" : "monitoring",
      currentState: missingEvs
        ? "No current EVS/BrowserStack validation is available for this property."
        : failed
          ? `Latest EVS/BrowserStack result failed: ${latestResult?.summary ?? "no summary"}`
          : `Latest EVS/BrowserStack result is stale: ${latestResult?.created_at}`,
      evidence: { evsProperty, latestRequest, latestResult },
      nextMove: "Run BrowserStack/EVS validation for mobile/desktop rendering, CTAs, forms, specials visibility, and post-change proof.",
      ownerRole: "Engineer / Experience Watch",
    });
  }
  return {
    status: watchItems.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { evsProperty, latestRequest, latestResult, missingEvs, failed, stale },
    metrics: {
      hasEvsProperty: evsProperty ? 1 : 0,
      latestRequestStatus: latestRequest?.status ?? null,
      latestResultStatus: latestResult?.status ?? null,
      latestResultCreatedAt: latestResult?.created_at ?? null,
    },
    watchItems,
    actions: missingEvs || failed || stale ? [{
      actionKey: "run_browserstack_evs_validation",
      title: "Run BrowserStack / EVS validation",
      ownerRole: "Engineer / Experience Watch",
      status: "open" as const,
      priority: failed ? "high" as const : "medium" as const,
      evidence: { evsProperty, latestRequest, latestResult, missingEvs, failed, stale },
    }] : [],
  };
}

async function boatswain(db: D1Database, propertyCode: string) {
  const actions = await queryAll<Record<string, unknown>>(
    db,
    `SELECT * FROM captain_actions WHERE property_id = ? AND status IN ('open', 'in_progress', 'blocked') ORDER BY priority DESC, due_date ASC`,
    [propertyCode]
  );
  const overdue = actions.filter((action) => action.due_date && daysSince(String(action.due_date)) > 0);
  const blocked = actions.filter((action) => action.status === "blocked");
  const missingDueDates = actions.filter((action) => !action.due_date);
  const watchItems: WatchItemInput[] = [];
  if (overdue.length || blocked.length || missingDueDates.length) {
    watchItems.push({
      watchKey: "support_team_action_follow_through",
      title: "Support-team action follow-through",
      category: "execution",
      severity: overdue.length || blocked.length ? "high" : "medium",
      status: "open",
      currentState: `${actions.length} open action(s); ${overdue.length} overdue; ${blocked.length} blocked; ${missingDueDates.length} without due dates.`,
      evidence: { actions: actions.slice(0, 20), overdue, blocked, missingDueDates },
      nextMove: "Confirm owners, due dates, expected lift, and proof for every open Captain action.",
      ownerRole: "Boatswain / Captain",
    });
  }
  return {
    status: watchItems.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { actions, overdue, blocked, missingDueDates },
    metrics: { openActions: actions.length, overdue: overdue.length, blocked: blocked.length, missingDueDates: missingDueDates.length },
    watchItems,
    actions: missingDueDates.length ? [{
      actionKey: "assign_due_dates_to_open_actions",
      title: "Assign due dates to open Captain actions",
      ownerRole: "Boatswain / Captain",
      status: "open" as const,
      priority: "medium" as const,
      evidence: { missingDueDates },
    }] : [],
  };
}

async function logkeeper(db: D1Database, property: CommunityRow, propertyCode: string) {
  const [latestMemory, recentRuns, watchItems, actions, briefRuns, activeAgents] = await Promise.all([
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT * FROM governed_memory_entries WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`,
      [property.id]
    ),
    queryAll<Record<string, unknown>>(
      db,
      `SELECT agent_key, run_status, finished_at FROM captain_agent_runs WHERE property_id = ? ORDER BY finished_at DESC LIMIT 30`,
      [propertyCode]
    ),
    queryAll<Record<string, unknown>>(
      db,
      `SELECT watch_key, status, severity, updated_at FROM captain_watch_items WHERE property_id = ? ORDER BY updated_at DESC LIMIT 30`,
      [propertyCode]
    ),
    queryAll<Record<string, unknown>>(
      db,
      `SELECT action_key, status, priority, updated_at FROM captain_actions WHERE property_id = ? ORDER BY updated_at DESC LIMIT 30`,
      [propertyCode]
    ),
    queryAll<Record<string, unknown>>(
      db,
      `SELECT id, run_status, brief_type, created_at FROM captain_brief_runs WHERE property_id = ? ORDER BY created_at DESC LIMIT 10`,
      [propertyCode]
    ),
    queryAll<Record<string, unknown>>(
      db,
      `SELECT agent_key, cadence FROM captain_support_agents WHERE property_id = ? AND status = 'active' AND cadence IN ('daily', 'weekly') ORDER BY agent_key`,
      [propertyCode]
    ),
  ]);
  const expectedWeekly = activeAgents.map((agent) => String(agent.agent_key));
  const latestByAgent = new Map<string, Record<string, unknown>>();
  for (const runRow of recentRuns) {
    const key = String(runRow.agent_key);
    if (!latestByAgent.has(key)) latestByAgent.set(key, runRow);
  }
  const staleWeekly = expectedWeekly.filter((agentKey) => {
    const row = latestByAgent.get(agentKey);
    return !row?.finished_at || daysSince(String(row.finished_at).slice(0, 10)) > 8;
  });
  const needsMemory = !latestMemory || daysSince(String(latestMemory.created_at ?? "").slice(0, 10)) > 14;
  const watchItemsOut: WatchItemInput[] = [];
  if (needsMemory || staleWeekly.length) {
    watchItemsOut.push({
      watchKey: "captain_memory_and_support_lane_freshness",
      title: "Captain memory and support-lane freshness",
      category: "memory",
      severity: needsMemory ? "high" : "medium",
      status: "open",
      currentState: [
        needsMemory ? "Captain memory needs a current Log update." : null,
        staleWeekly.length ? `Stale weekly lane(s): ${staleWeekly.join(", ")}` : null,
      ].filter(Boolean).join(" "),
      evidence: { latestMemory, staleWeekly, recentRuns: recentRuns.slice(0, 12), watchItems, actions, briefRuns },
      nextMove: "Update the Captain's Log and re-task any stale support lane before the next Admiral Read.",
      ownerRole: "Logkeeper / Captain",
    });
  }
  return {
    status: watchItemsOut.length ? "warning" as CaptainRunStatus : "success" as CaptainRunStatus,
    findings: { latestMemory, recentRuns, watchItems, actions, briefRuns, activeAgents, staleWeekly, needsMemory },
    metrics: { needsMemory: needsMemory ? 1 : 0, staleWeeklyCount: staleWeekly.length, recentRunCount: recentRuns.length },
    watchItems: watchItemsOut,
    actions: needsMemory ? [{
      actionKey: "update_captain_log_memory",
      title: "Update Captain's Log memory",
      ownerRole: "Logkeeper / Captain",
      status: "open" as const,
      priority: "high" as const,
      evidence: { latestMemory, staleWeekly },
    }] : [],
  };
}

async function supervisorScribe(db: D1Database, propertyCode: string) {
  const [watchItems, actions, latestRuns] = await Promise.all([
    queryAll(db, `SELECT * FROM captain_watch_items WHERE property_id = ? AND status IN ('open', 'monitoring', 'escalated')`, [propertyCode]),
    queryAll(db, `SELECT * FROM captain_actions WHERE property_id = ? AND status IN ('open', 'in_progress', 'blocked')`, [propertyCode]),
    queryAll(db, `SELECT agent_key, run_status, finished_at FROM captain_agent_runs WHERE property_id = ? ORDER BY finished_at DESC LIMIT 12`, [propertyCode]),
  ]);
  return {
    status: "success" as CaptainRunStatus,
    findings: { openWatchItems: watchItems.length, openActions: actions.length, latestRuns },
    metrics: { openWatchItems: watchItems.length, openActions: actions.length },
    watchItems: [],
    actions: [],
  };
}

async function getCaptainSourceReadiness(db: D1Database, property: CommunityRow, propertyCode: string) {
  const ga4Id = property.ga4_property_id ?? property.external_key ?? propertyCode;
  const latestAds = await safeQueryFirst<{ campaign_status: string | null; metric_date: string | null; campaign_name: string | null }>(
    db,
    `SELECT campaign_status, metric_date, campaign_name FROM google_ads_campaigns WHERE property_id = ? ORDER BY metric_date DESC LIMIT 1`,
    [ga4Id]
  );
  return {
    guestCards: await safeScalar(db, `SELECT MAX(run_date) AS value FROM guest_card_metrics WHERE property_code = ?`, [propertyCode]),
    unitFeed: await safeScalar(db, `SELECT MAX(snapshot_date) AS value FROM unit_availability_units WHERE property_id = ?`, [ga4Id]),
    marketingBiPacket: await safeScalar(db, `SELECT MAX(report_date) AS value FROM marketing_bi_daily_packets`, []),
    marketingOpsSummary: await safeScalar(db, `SELECT MAX(report_date) AS value FROM marketing_ops_summary_rows WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    availableUnitInterest: await safeScalar(db, `SELECT MAX(report_date) AS value FROM available_unit_interest_metrics WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    trafficConversions: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(report_date) AS value FROM marketing_bi_traffic_conversions_full WHERE property_id = ? OR community_id = ?`, params: [propertyCode, property.id] },
      { sql: `SELECT MAX(report_date) AS value FROM marketing_traffic_conversions WHERE property_id = ? OR community_id = ?`, params: [propertyCode, property.id] },
    ]),
    cancelDenial: await safeScalar(db, `SELECT MAX(report_date) AS value FROM marketing_cancel_denial_by_source WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    ga4: await safeScalar(db, `SELECT MAX(metric_date) AS value FROM ga4_daily_metrics WHERE property_id = ?`, [ga4Id]),
    gsc: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(metric_date) AS value FROM gsc_daily_metrics WHERE property_id = ? OR ga4_property_id = ?`, params: [ga4Id, ga4Id] },
      { sql: `SELECT MAX(metric_date) AS value FROM gsc_daily_metrics WHERE community_id = ?`, params: [property.id] },
    ]),
    googleAds: await safeScalar(db, `SELECT MAX(metric_date) AS value FROM google_ads_campaigns WHERE property_id = ?`, [ga4Id]),
    googleAdsPosture: latestAds?.campaign_status?.toUpperCase() === "PAUSED" ? "paused_no_current_activity" : "active_or_unknown",
    psi: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(metric_date) AS value FROM pagespeed_metrics WHERE property_id = ?`, params: [ga4Id] },
      { sql: `SELECT MAX(metric_date) AS value FROM pilot_control_psi_metrics WHERE property_id = ?`, params: [ga4Id] },
    ]),
    gbp: await firstAvailableScalar(db, [
      { sql: `SELECT MAX(metric_date) AS value FROM gbp_daily_insights WHERE property_id = ?`, params: [ga4Id] },
      { sql: `SELECT MAX(review_create_time) AS value FROM gbp_reviews WHERE property_id = ?`, params: [ga4Id] },
    ]),
    reputationCom: await safeScalar(db, `SELECT MAX(report_date) AS value FROM reputation_com_location_leaderboard WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    competitorMarketResearch: await safeScalar(db, `SELECT MAX(snapshot_date) AS value FROM competitor_market_research_snapshots WHERE property_id = ? OR community_id = ?`, [propertyCode, property.id]),
    dataforseoRankings: await safeScalar(db, `SELECT MAX(run_date) AS value FROM dataforseo_property_keyword_rankings WHERE property_id = ?`, [propertyCode]),
    dataforseoOnPage: await safeScalar(db, `SELECT MAX(run_date) AS value FROM dataforseo_onpage_page_snapshots WHERE property_id = ?`, [propertyCode]),
    dataforseoBusiness: await safeScalar(db, `SELECT MAX(run_date) AS value FROM dataforseo_business_profiles WHERE property_id = ?`, [propertyCode]),
  };
}

async function getCaptainInventoryRead(db: D1Database, ga4Id: string) {
  const latestSnapshot = await safeScalar(db, `SELECT MAX(snapshot_date) AS value FROM unit_availability_units WHERE property_id = ?`, [ga4Id]);
  if (!latestSnapshot) {
    return {
      latestSnapshot: null,
      buckets: { aged30: 0, aged60: 0, aged90: 0, aged180: 0, aged365: 0 },
      floorplans: [],
      agedUnits: [],
    };
  }
  const params = [ga4Id, latestSnapshot];
  const floorplans = await safeQueryAll(
    db,
    `SELECT floorplan_name,
      COUNT(*) AS units,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 30 THEN 1 ELSE 0 END) AS aged_30,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 60 THEN 1 ELSE 0 END) AS aged_60,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 90 THEN 1 ELSE 0 END) AS aged_90,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 180 THEN 1 ELSE 0 END) AS aged_180,
      SUM(CASE WHEN moved_out_date IS NOT NULL AND julianday(snapshot_date) - julianday(moved_out_date) >= 365 THEN 1 ELSE 0 END) AS aged_365,
      SUM(CASE WHEN COALESCE(pricing_and_specials_message, '') <> '' OR concession_amount IS NOT NULL THEN 1 ELSE 0 END) AS specials
     FROM unit_availability_units
     WHERE property_id = ? AND snapshot_date = ?
     GROUP BY floorplan_name
     ORDER BY aged_90 DESC, units DESC`,
    params
  );
  const agedUnits = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT apt_number,
       unit_id,
       building,
       floorplan_name,
       rent_from,
       rent_to,
       moved_out_date,
       available_date,
       CAST(julianday(snapshot_date) - julianday(moved_out_date) AS INTEGER) AS days_unleased,
       pricing_and_specials_message,
       concession_amount
     FROM unit_availability_units
     WHERE property_id = ?
       AND snapshot_date = ?
       AND moved_out_date IS NOT NULL
       AND julianday(snapshot_date) - julianday(moved_out_date) >= 30
     ORDER BY days_unleased DESC, floorplan_name ASC, apt_number ASC
     LIMIT 80`,
    params
  );
  const buckets = {
    aged30: agedUnits.filter((unit) => Number(unit.days_unleased ?? 0) >= 30).length,
    aged60: agedUnits.filter((unit) => Number(unit.days_unleased ?? 0) >= 60).length,
    aged90: agedUnits.filter((unit) => Number(unit.days_unleased ?? 0) >= 90).length,
    aged180: agedUnits.filter((unit) => Number(unit.days_unleased ?? 0) >= 180).length,
    aged365: agedUnits.filter((unit) => Number(unit.days_unleased ?? 0) >= 365).length,
  };
  return { latestSnapshot, buckets, floorplans, agedUnits };
}

async function getCaptainOperatingSnapshot(db: D1Database, property: CommunityRow, propertyCode: string) {
  const row = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM property_operating_metrics
     WHERE property_id = ? OR community_id = ?
     ORDER BY metric_date DESC, updated_at DESC
     LIMIT 1`,
    [propertyCode, property.id]
  );
  if (!row) {
    return {
      status: "missing_source",
      sourceNeeded: "property_operating_metrics",
      message: "Official occupancy, leased percentage, lease count, cancellations, and booked concession dollars are not yet routed into the Pond operating metrics table.",
      metrics: null,
    };
  }
  const hasBookedConcessions = row.booked_concession_dollars !== null && row.booked_concession_dollars !== undefined;
  return {
    status: hasBookedConcessions ? "pond_verified" : "partial_missing_booked_concessions",
    sourceNeeded: hasBookedConcessions ? null : "booked_concession_dollars",
    message: hasBookedConcessions
      ? "Official operating metrics are routed from the Pond source-of-record."
      : "Operating metrics are present, but booked concession dollars are still missing.",
    metrics: row,
  };
}

async function getCaptainReputationInsight(db: D1Database, property: CommunityRow, propertyCode: string): Promise<Record<string, any>> {
  const ga4Id = property.ga4_property_id ?? property.external_key ?? propertyCode;
  const [leaderboard, components, timeSeries, competitionRows, gbpReviews, gbpSummary, gbpInsights, businessProfile] = await Promise.all([
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM reputation_com_location_leaderboard
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC
       LIMIT 1`,
      [propertyCode, property.id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM reputation_com_score_components
       WHERE (property_id = ? OR community_id = ?)
         AND entity_type = 'property'
       ORDER BY report_date DESC
       LIMIT 1`,
      [propertyCode, property.id]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT score_month, reputation_score
       FROM reputation_com_score_time_series
       WHERE property_id = ? OR community_id = ?
       ORDER BY score_month ASC`,
      [propertyCode, property.id]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT *
       FROM reputation_com_local_competition
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC, competitor_rank ASC
      LIMIT 3`,
      [propertyCode, property.id]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT r.review_id,
              r.star_rating_numeric,
              r.comment,
              r.has_reply,
              r.review_create_time,
              r.review_update_time,
              s.sentiment_label,
              s.sentiment_score,
              s.requires_attention,
              s.theme_maintenance,
              s.theme_staff,
              s.theme_amenities,
              s.theme_noise,
              s.theme_location,
              s.theme_value,
              s.theme_move_in,
              s.theme_move_out,
              s.theme_pets,
              s.theme_parking,
              s.key_phrases
       FROM gbp_reviews r
       LEFT JOIN gbp_review_sentiment s
         ON s.review_id = r.review_id
       WHERE r.property_id = ?
       ORDER BY r.review_create_time DESC
       LIMIT 40`,
      [ga4Id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM gbp_reviews_summary
       WHERE property_id = ?
       ORDER BY metric_date DESC
       LIMIT 1`,
      [ga4Id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM gbp_daily_insights
       WHERE property_id = ?
       ORDER BY metric_date DESC
       LIMIT 1`,
      [ga4Id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT *
       FROM dataforseo_business_profiles
       WHERE property_id = ?
       ORDER BY run_date DESC
       LIMIT 1`,
      [propertyCode]
    ),
  ]);

  if (!leaderboard) {
    return {
      status: "missing_source",
      sourceNeeded: "reputation_com_location_leaderboard",
      message: "No Reputation.com leaderboard row is mirrored for this Captain property.",
      propertyCode,
      communityId: property.id,
    };
  }

  const latestTrend = timeSeries.length ? timeSeries[timeSeries.length - 1] : null;
  const priorTrend = timeSeries.length > 1 ? timeSeries[timeSeries.length - 2] : null;
  const januaryTrend = timeSeries.find((row) => String(row.score_month) === "2026-01") ?? timeSeries[0] ?? null;
  const latestTrendScore = num(latestTrend?.reputation_score);
  const priorTrendScore = num(priorTrend?.reputation_score);
  const januaryTrendScore = num(januaryTrend?.reputation_score);
  const monthOverMonthChange = latestTrendScore !== null && priorTrendScore !== null ? roundNumber(latestTrendScore - priorTrendScore, 1) : null;
  const janToCurrentChange = latestTrendScore !== null && januaryTrendScore !== null ? roundNumber(latestTrendScore - januaryTrendScore, 1) : null;

  const competitorScores = competitionRows
    .map((row) => num(row.competitor_reputation_score))
    .filter((value): value is number => value !== null);
  const subjectScore = num(competitionRows[0]?.subject_reputation_score) ?? num(leaderboard.reputation_score);
  const competitorAvg = competitorScores.length ? roundNumber(competitorScores.reduce((sum, value) => sum + value, 0) / competitorScores.length, 1) : null;
  const bestCompetitorScore = competitorScores.length ? Math.max(...competitorScores) : null;
  const gapVsCompetitorAvg = subjectScore !== null && competitorAvg !== null ? roundNumber(subjectScore - competitorAvg, 1) : null;
  const gapVsBestCompetitor = subjectScore !== null && bestCompetitorScore !== null ? roundNumber(subjectScore - bestCompetitorScore, 1) : null;
  const responseRate = num(leaderboard.response_rate);
  const negativeReviewPct = num(leaderboard.current_negative_reviews_pct);
  const reputationScore = num(leaderboard.reputation_score);
  const listingCompleteness = num(components?.listing_completeness);
  const reviewResponse = num(components?.review_response);
  const posture =
    janToCurrentChange !== null && janToCurrentChange <= -50 ? "declining" :
    gapVsCompetitorAvg !== null && gapVsCompetitorAvg < 0 ? "competitively_exposed" :
    reputationScore !== null && reputationScore < 780 ? "reputation_risk" :
    "stable_or_advantaged";

  return {
    status: "grounded",
    posture,
    reportDate: leaderboard.report_date ?? null,
    location: leaderboard.location ?? null,
    metrics: {
      totalReviews: num(leaderboard.current_total_reviews),
      positiveReviewPct: num(leaderboard.current_positive_reviews_pct),
      neutralReviewPct: num(leaderboard.current_neutral_reviews_pct),
      negativeReviewPct,
      averageRating: num(leaderboard.average_rating),
      responseRate,
      reputationScore,
      currentPeriod: leaderboard.current_period ?? null,
    },
    trend: {
      currentMonth: latestTrend?.score_month ?? null,
      currentScore: latestTrendScore,
      priorMonth: priorTrend?.score_month ?? null,
      monthOverMonthChange,
      januaryMonth: januaryTrend?.score_month ?? null,
      januaryScore: januaryTrendScore,
      janToCurrentChange,
      points: timeSeries,
    },
    components: components ? {
      reputationScore: num(components.reputation_score),
      reviewSentiment: num(components.review_sentiment),
      reviewVolume: num(components.review_volume),
      reviewRecency: num(components.review_recency),
      reviewQuality: num(components.review_quality),
      reviewSpread: num(components.review_spread),
      reviewResponse,
      searchImpressions: num(components.search_impressions),
      listingCompleteness,
      socialScore: num(components.social_score),
    } : null,
    localCompetition: {
      comparedCompetitors: competitorScores.length,
      competitorAverageScore: competitorAvg,
      bestCompetitorScore,
      gapVsCompetitorAvg,
      gapVsBestCompetitor,
      competitors: competitionRows.map((row) => ({
        rank: num(row.competitor_rank),
        location: row.competitor_location ?? null,
        reputationScore: num(row.competitor_reputation_score),
        averageRating: num(row.competitor_average_rating),
        totalReviews: num(row.competitor_total_reviews),
      })),
    },
    gbpReviewRead: buildGbpReviewRead(gbpReviews, gbpSummary, gbpInsights),
    localEntityRead: businessProfile ? {
      runDate: businessProfile.run_date ?? null,
      title: businessProfile.title ?? businessProfile.name ?? null,
      rating: num(businessProfile.rating),
      reviewCount: num(businessProfile.review_count ?? businessProfile.reviews_count),
      category: businessProfile.category ?? businessProfile.main_category ?? null,
      address: businessProfile.address ?? null,
    } : null,
    narrative: buildReputationNarrative(posture, reputationScore, janToCurrentChange, gapVsCompetitorAvg, responseRate, negativeReviewPct),
    sourceAuthority: "Reputation.com supplies advisory reputation and competitor evidence; Data Pond and GBP review tables remain separate governed sources for operating and local presence facts.",
  };
}

async function getCaptainCompetitorMarketRead(db: D1Database, property: CommunityRow, propertyCode: string) {
  const snapshot = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT *
     FROM competitor_market_research_snapshots
     WHERE property_id = ? OR community_id = ?
     ORDER BY snapshot_date DESC, captured_at DESC
     LIMIT 1`,
    [propertyCode, property.id]
  );
  if (!snapshot) {
    return {
      status: "missing_source",
      sourceNeeded: "competitor_market_research_snapshots",
      message: "No sourced competitor market research packet is available for this property.",
      sourceAuthority: "Competitor intelligence is advisory and cannot be used unless each claim has source URL, captured date, and confidence.",
    };
  }
  const rows = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT *
     FROM competitor_market_research_observations
     WHERE snapshot_id = ?
     ORDER BY
       CASE WHEN competitor_name = subject_property_name THEN 0 ELSE 1 END,
       competitor_name,
       evidence_category`,
    [String(snapshot.id)]
  );
  const latestUnitSnapshot = property.ga4_property_id || property.external_key
    ? await safeScalar(db, `SELECT MAX(snapshot_date) AS value FROM unit_availability_units WHERE property_id = ?`, [property.ga4_property_id ?? property.external_key])
    : null;
  const subjectUnitRows = latestUnitSnapshot && (property.ga4_property_id || property.external_key)
    ? await safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT floorplan_name,
              MIN(rent_from) AS rent_min,
              MAX(rent_to) AS rent_max,
              pricing_and_specials_message
       FROM unit_availability_units
       WHERE property_id = ?
         AND snapshot_date = ?
         AND rent_from IS NOT NULL
         AND rent_from > 0
         AND rent_to IS NOT NULL
         AND rent_to > 0
       GROUP BY floorplan_name, pricing_and_specials_message
       ORDER BY floorplan_name, rent_min`,
      [property.ga4_property_id ?? property.external_key, latestUnitSnapshot]
    )
    : [];
  const subjectName = String(snapshot.property_name ?? property.name);
  const subjectRows = rows.filter((row) => String(row.competitor_name ?? "") === subjectName);
  const competitorRows = rows.filter((row) => {
    const name = String(row.competitor_name ?? "");
    return name && name !== subjectName && name !== "Competitive Research" && String(row.evidence_category ?? "") !== "source_gap";
  });
  const sourceGaps = rows
    .filter((row) => String(row.confidence ?? "") === "missing" || String(row.evidence_category ?? "") === "source_gap")
    .map((row) => ({
      claim: row.raw_claim ?? null,
      sourceName: row.source_name ?? null,
      sourceUrl: row.source_url ?? null,
      capturedDate: row.captured_date ?? null,
    }));
  const rentRows = competitorRows.filter((row) => row.evidence_category === "rent");
  const specialRows = competitorRows.filter((row) => row.evidence_category === "special");
  const uspRows = competitorRows.filter((row) => row.evidence_category === "usp");
  const mediaRows = competitorRows.filter((row) => row.evidence_category === "media" || row.media_indicators_json);
  const subjectUnitRentMins = subjectUnitRows.map((row) => num(row.rent_min)).filter((value): value is number => value !== null);
  const subjectUnitRentMaxes = subjectUnitRows.map((row) => num(row.rent_max)).filter((value): value is number => value !== null);
  const subjectRentMin = subjectUnitRentMins.length ? Math.min(...subjectUnitRentMins) : firstNumber(subjectRows.map((row) => row.rent_min));
  const subjectRentMax = subjectUnitRentMaxes.length ? Math.max(...subjectUnitRentMaxes) : firstNumber(subjectRows.map((row) => row.rent_max));
  const subjectVisibleSpecials = Array.from(new Set(subjectUnitRows
    .map((row) => cleanUnitSpecial(row.pricing_and_specials_message))
    .filter(Boolean)));
  const competitorSummaries = summarizeCompetitorRows(competitorRows);
  const lowerRentCompetitors = competitorSummaries
    .filter((item) => subjectRentMin !== null && item.rentMin !== null && item.rentMin < subjectRentMin)
    .map((item) => ({
      competitorName: item.competitorName,
      rentMin: item.rentMin,
      gapVsSubjectMin: subjectRentMin !== null && item.rentMin !== null ? roundNumber(item.rentMin - subjectRentMin, 0) : null,
      sourceUrls: item.sourceUrls,
    }));
  const confirmedSpecials = specialRows
    .filter((row) => row.confidence === "confirmed")
    .map((row) => ({
      competitorName: row.competitor_name ?? null,
      specialText: row.special_text ?? row.raw_claim ?? null,
      sourceUrl: row.source_url ?? null,
      capturedDate: row.captured_date ?? null,
      confidence: row.confidence ?? null,
    }));
  const copyOpportunities = subjectRows
    .filter((row) => row.usp_text)
    .map((row) => String(row.usp_text))
    .slice(0, 3);
  const counts = {
    observations: rows.length,
    competitors: new Set(competitorRows.map((row) => String(row.competitor_name ?? "")).filter(Boolean)).size,
    confirmed: rows.filter((row) => row.confidence === "confirmed").length,
    directional: rows.filter((row) => row.confidence === "directional").length,
    conflicts: rows.filter((row) => row.confidence === "conflict").length,
    missing: sourceGaps.length,
    rentRows: rentRows.length,
    specialRows: specialRows.length,
    uspRows: uspRows.length,
    mediaRows: mediaRows.length,
  };
  const recommendationBasis =
    sourceGaps.length && (rentRows.length || specialRows.length) ? "use_confirmed_rent_special_copy_but_gate_package_claims" :
    rentRows.length || specialRows.length ? "use_confirmed_market_evidence" :
    "needs_research_before_recommendation";
  const pricingVsAdvertising =
    rentRows.length || specialRows.length
      ? "Review pricing/concessions and competitor copy before recommending broad advertising increases; confirmed comp rents/specials show the market is making visible value offers."
      : "Do not decide pricing versus advertising until current competitor rent and special evidence is captured.";
  const packageStatus =
    sourceGaps.some((gap) => String(gap.claim ?? "").toLowerCase().includes("package"))
      ? "ADC/Apartments.com package status is not confirmed; keep package-level conclusions gated."
      : "No package-status gap was captured in the latest packet.";
  const webCopy =
    copyOpportunities.length
      ? `Use subject USPs as copy proof before generic claims: ${copyOpportunities.join(" ")}`
      : "No subject USP evidence was captured; run a live website/Site Content review before exact copy recommendations.";
  const adCopy =
    confirmedSpecials.length
      ? "Competitor special language is visible; ad copy should either match the market value conversation or clearly rebut it with stronger proof points."
      : "No confirmed competitor special was captured; do not write concession-response ad copy from this packet alone.";
  const strongestRentPressure = lowerRentCompetitors[0] ?? null;
  const decisionSummary = competitorRows.length
    ? [
      subjectRentMin !== null ? `Our visible starting rent is $${subjectRentMin.toLocaleString()}${latestUnitSnapshot ? ` from unit feed ${latestUnitSnapshot}` : ""}.` : "Our visible rent is not available in the current unit feed.",
      subjectVisibleSpecials.length ? `Our visible specials: ${subjectVisibleSpecials.join("; ")}.` : "No current owned special is visible from the unit feed.",
      strongestRentPressure ? `${strongestRentPressure.competitorName} has a lower visible starting rent (${formatCurrency(strongestRentPressure.rentMin)}).` : "No captured competitor undercuts our visible starting rent in this packet.",
      confirmedSpecials.length ? `${confirmedSpecials.length} confirmed competitor special(s) are visible.` : "No confirmed competitor special is visible in this packet.",
      sourceGaps.length ? "ADC/package status remains unconfirmed and must stay gated." : "No competitor package-status gap is captured.",
    ].join(" ")
    : "Competitor packet has no usable competitor rows yet.";
  const decision = competitorRows.length
    ? {
      pricing: lowerRentCompetitors.length || confirmedSpecials.length ? "review" : "monitor",
      advertising: lowerRentCompetitors.length || confirmedSpecials.length ? "do_not_broadly_increase_until_value_position_is_reviewed" : "eligible_if_source_economics_support",
      webCopy: copyOpportunities.length ? "use_owned_usp_proof_points" : "needs_site_content_review",
      adCopy: confirmedSpecials.length ? "address_visible_value_offer_or_rebut_with_owned_usp" : "do_not_write_competitor_special_response",
      packageReview: sourceGaps.some((gap) => String(gap.claim ?? "").toLowerCase().includes("package")) ? "needs_controlled_capture" : "not_flagged",
    }
    : {
      pricing: "needs_research",
      advertising: "needs_research",
      webCopy: "needs_research",
      adCopy: "needs_research",
      packageReview: "needs_research",
    };
  const evidenceReferences = [
    {
      id: "CM-1",
      label: "Subject rent and visible specials",
      source: "unit_availability_units",
      sourceType: "internal_unit_feed",
      date: latestUnitSnapshot,
      confidence: latestUnitSnapshot ? "confirmed" : "missing",
      detail: latestUnitSnapshot
        ? "Latest internal unit-feed snapshot for current subject-property visible rent range and special language."
        : "No unit-feed snapshot was available for subject-property visible rent/special posture.",
    },
    {
      id: "CM-2",
      label: "Competitor visible rent rows",
      source: "competitor_market_research_observations",
      sourceType: "public_competitor_research",
      date: snapshot.snapshot_date ?? null,
      confidence: rentRows.length ? "confirmed" : "missing",
      detail: `${rentRows.length} public competitor rent row(s) captured with source URLs and captured dates.`,
    },
    {
      id: "CM-3",
      label: "Competitor visible specials",
      source: "competitor_market_research_observations",
      sourceType: "public_competitor_research",
      date: snapshot.snapshot_date ?? null,
      confidence: confirmedSpecials.length ? "confirmed" : "missing",
      detail: `${confirmedSpecials.length} confirmed competitor special(s) captured with source URLs and captured dates.`,
    },
    {
      id: "CM-4",
      label: "ADC/package status",
      source: "competitor_market_research_observations",
      sourceType: "source_gap",
      date: snapshot.snapshot_date ?? null,
      confidence: sourceGaps.length ? "missing" : "not_flagged",
      detail: sourceGaps.length
        ? "ADC/Apartments.com package and premium-placement status is not confirmed by a controlled source."
        : "No ADC/package source gap was flagged in this packet.",
    },
  ];
  const why = [
    {
      statement: "Pricing and concession review comes before broad ad-spend increases when competitor value pressure is visible.",
      why: "More advertising can increase traffic, but if prospects immediately see lower visible rents or more compelling public specials elsewhere, added traffic may leak unless the offer or value framing is corrected first.",
      refs: ["CM-1", "CM-2", "CM-3"],
    },
    {
      statement: "Value copy should be reviewed with pricing.",
      why: "If our rent is not the lowest, the page/ad/leasing message has to make the value difference obvious using proof points such as space, location, furnished/short-term options, pet policy, or amenities.",
      refs: ["CM-1", "CM-2"],
    },
    {
      statement: "ADC/package conclusions stay blocked until verified.",
      why: "Visible listing clues are not enough to assert package level or premium placement. The Captain can recommend a package audit, but cannot claim a package disadvantage without controlled evidence.",
      refs: ["CM-4"],
    },
  ];
  return {
    status: rows.length ? "grounded" : "empty_snapshot",
    source: "competitor_market_research_snapshots + competitor_market_research_observations",
    snapshotDate: snapshot.snapshot_date ?? null,
    capturedAt: snapshot.captured_at ?? null,
    marketName: snapshot.market_name ?? null,
    researchScope: snapshot.research_scope ?? null,
    counts,
    subject: {
      propertyCode,
      propertyName: subjectName,
      rentMin: subjectRentMin,
      rentMax: subjectRentMax,
      unitFeedSnapshotDate: latestUnitSnapshot,
      visibleSpecials: subjectVisibleSpecials,
      sourceRows: subjectRows.map(compactCompetitorObservation),
    },
    competitors: competitorSummaries,
    pricingPressure: {
      subjectRentMin,
      subjectRentMax,
      subjectVisibleSpecials,
      subjectUnitFeedSnapshotDate: latestUnitSnapshot,
      lowerRentCompetitors,
      confirmedSpecials,
      posture: lowerRentCompetitors.length || confirmedSpecials.length ? "visible_value_pressure" : "not_enough_evidence",
    },
    decisionSummary,
    decision,
    why,
    evidenceReferences,
    merchandisingPressure: {
      visibleUsps: uspRows.map(compactCompetitorObservation).slice(0, 8),
      mediaAndPackageIndicators: mediaRows.map(compactCompetitorObservation).slice(0, 8),
      posture: mediaRows.length ? "visible_media_or_package_pressure" : "not_enough_evidence",
    },
    sourceGaps,
    recommendationBasis,
    stephanieAnswers: {
      pricingVsAdvertising,
      adCopy,
      webCopy,
      packageStatus,
    },
    reportLogic: [
      "Use confirmed public rent and special evidence to decide whether pricing/concession review is needed before broad spend increases.",
      "Use subject and competitor USPs to generate exact web/ad/leasing-script copy only when the source row is confirmed or clearly labeled directional.",
      "Keep ADC/package recommendations blocked until package status or controlled visibility evidence is captured.",
    ],
    sourceAuthority: "Competitor market research is advisory. Every claim must retain source URL, captured date, and confidence.",
  };
}

function formatCurrency(value: unknown) {
  const parsed = num(value);
  return parsed === null ? "unknown" : `$${parsed.toLocaleString()}`;
}

function summarizeCompetitorRows(rows: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const name = String(row.competitor_name ?? "");
    if (!name) continue;
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  return Array.from(groups.entries()).map(([competitorName, items]) => {
    const rentMins = items.map((row) => num(row.rent_min)).filter((value): value is number => value !== null);
    const rentMaxes = items.map((row) => num(row.rent_max)).filter((value): value is number => value !== null);
    return {
      competitorName,
      rentMin: rentMins.length ? Math.min(...rentMins) : null,
      rentMax: rentMaxes.length ? Math.max(...rentMaxes) : null,
      specials: items.filter((row) => row.evidence_category === "special").map(compactCompetitorObservation),
      usps: items.filter((row) => row.usp_text).map(compactCompetitorObservation),
      media: items.filter((row) => row.evidence_category === "media" || row.media_indicators_json).map(compactCompetitorObservation),
      confidence: Array.from(new Set(items.map((row) => String(row.confidence ?? "")).filter(Boolean))).sort(),
      sourceUrls: Array.from(new Set(items.map((row) => String(row.source_url ?? "")).filter(Boolean))).sort(),
    };
  });
}

function compactCompetitorObservation(row: Record<string, unknown>) {
  return {
    competitorName: row.competitor_name ?? null,
    category: row.evidence_category ?? null,
    rawClaim: row.raw_claim ?? null,
    sourceName: row.source_name ?? null,
    sourceUrl: row.source_url ?? null,
    capturedDate: row.captured_date ?? null,
    confidence: row.confidence ?? null,
    rentMin: num(row.rent_min),
    rentMax: num(row.rent_max),
    specialText: row.special_text ?? null,
    uspText: row.usp_text ?? null,
    packageIndicator: row.package_indicator ?? null,
  };
}

function firstNumber(values: unknown[]) {
  for (const value of values) {
    const parsed = num(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function cleanUnitSpecial(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part && part !== ".")
    .join(" ");
}

async function getCaptainMarketingInsight(db: D1Database, property: CommunityRow, propertyCode: string) {
  const [packet, propertySummary, opsSummary, availableInterest, traffic, cancelRows, costRows, spendRows] = await Promise.all([
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT * FROM marketing_bi_daily_packets ORDER BY report_date DESC LIMIT 1`
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT * FROM marketing_bi_property_summary_rows
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC
       LIMIT 1`,
      [propertyCode, property.id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT * FROM marketing_ops_summary_rows
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC
       LIMIT 1`,
      [propertyCode, property.id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT * FROM available_unit_interest_metrics
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC
       LIMIT 1`,
      [propertyCode, property.id]
    ),
    safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT * FROM marketing_traffic_conversions
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC
       LIMIT 1`,
      [propertyCode, property.id]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT *
       FROM marketing_cancel_denial_by_source
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC, cancel_denial_count DESC
       LIMIT 40`,
      [propertyCode, property.id]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT *
       FROM marketing_bi_cost_per_conversion_rows
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC,
         CASE WHEN calendar_month IS NULL THEN 0 ELSE 1 END,
         calendar_month DESC,
         cost_per_lease ASC,
         cost_per_application ASC,
         cost_per_guest_card ASC
       LIMIT 80`,
      [propertyCode, property.id]
    ),
    safeQueryAll<Record<string, unknown>>(
      db,
      `SELECT *
       FROM marketing_bi_ad_spend_performance_month
       WHERE property_id = ? OR community_id = ?
       ORDER BY report_date DESC,
         CASE WHEN ad_spend_total IS NULL THEN 1 ELSE 0 END,
         calendar_month DESC
       LIMIT 12`,
      [propertyCode, property.id]
    ),
  ]);
  const sourcePerformanceRows = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT *
     FROM marketing_bi_source_performance_rows
     WHERE (property_id = ? OR community_id = ?)
       AND source_kind = 'marketing_source'
       AND COALESCE(source_group, '') != 'Total'
       AND report_date = (
         SELECT MAX(report_date)
         FROM marketing_bi_source_performance_rows
         WHERE (property_id = ? OR community_id = ?)
           AND source_kind = 'marketing_source'
       )
     ORDER BY guest_cards DESC, visits DESC, leases DESC
    LIMIT 20`,
    [propertyCode, property.id, propertyCode, property.id]
  );
  const adKeywordRows = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT *
     FROM ad_keyword_performance
     WHERE community_id = ?
       AND week_date = (
         SELECT MAX(week_date)
         FROM ad_keyword_performance
         WHERE community_id = ?
       )
     ORDER BY spend DESC, unit_type
     LIMIT 20`,
    [property.id, property.id]
  );
  const conversionRead = buildMarketingConversionRead(traffic, availableInterest);
  const opsRead = buildWebOpsRead(opsSummary);
  const friction = buildCancelDenialRead(cancelRows);
  const sourceSpendRead = buildSourceSpendRead(costRows, sourcePerformanceRows, adKeywordRows, spendRows, opsRead);
  const latestDates = [
    packet?.report_date,
    propertySummary?.report_date,
    opsSummary?.report_date,
    availableInterest?.report_date,
    traffic?.report_date,
    cancelRows[0]?.report_date,
    costRows[0]?.report_date,
    spendRows[0]?.report_date,
  ].filter(Boolean).map(String);
  const status = packet && (opsSummary || traffic || availableInterest || cancelRows.length) ? "grounded" : packet ? "packet_only" : opsSummary ? "ops_summary_only" : "missing_source";
  const narrative = buildMarketingNarrative(status, conversionRead, friction, opsRead);
  const sortedDates = latestDates.sort();
  return {
    status,
    reportDate: sortedDates.length ? sortedDates[sortedDates.length - 1] : null,
    packet,
    propertySummary,
    opsSummary,
    opsRead,
    availableUnitInterest: availableInterest,
    trafficConversions: traffic,
    cancelDenial: friction,
    conversionRead,
    sourceSpendRead,
    narrative,
    sourceAuthority: "Marketing BI supplies advisory property performance, demand, source, pricing, financial, Kingsley, and conversion context; Data Pond remains authority for official operating and unit-level facts.",
  };
}

function buildWebOpsRead(opsSummary: Record<string, unknown> | null) {
  if (!opsSummary) {
    return {
      status: "missing_source",
      reportDate: null,
      sourceAsOfDate: null,
      posture: "unknown",
      metrics: null,
    };
  }
  const occupancy = pct(opsSummary.occupancy);
  const atr30 = pct(opsSummary.atr30);
  const leadsT30Var = pct(opsSummary.leads_t30_var);
  const leadsT7Var = pct(opsSummary.leads_t7_var);
  const visitsT30Var = pct(opsSummary.visits_t30_var);
  const closeRatio = pct(opsSummary.close_ratio);
  const projectedTrafficGap = num(opsSummary.projected_traffic_gap);
  const adSpendT1Var = pct(opsSummary.ad_spend_t1_var);
  const kingsleyFindT30 = pct(opsSummary.kingsley_find_property_avg_t30);
  const posture =
    occupancy !== null && occupancy < 0.85 ? "occupancy_pressure" :
    projectedTrafficGap !== null && projectedTrafficGap < -25 ? "traffic_gap" :
    leadsT30Var !== null && leadsT30Var <= -0.15 ? "lead_decline" :
    closeRatio !== null && closeRatio < 0.02 ? "conversion_pressure" :
    "stable_or_mixed";
  return {
    status: "grounded",
    reportDate: opsSummary.report_date ?? null,
    sourceAsOfDate: opsSummary.source_as_of_date ?? null,
    posture,
    metrics: {
      units: num(opsSummary.units),
      occupancy,
      atr30,
      atr: pct(opsSummary.atr),
      leadsT30Py: num(opsSummary.leads_t30_py),
      leadsT30: num(opsSummary.leads_t30),
      leadsT30Var,
      leadsT7Py: num(opsSummary.leads_t7_py),
      leadsT7: num(opsSummary.leads_t7),
      leadsT7Var,
      visitsT30Py: num(opsSummary.visits_t30_py),
      visitsT30: num(opsSummary.visits_t30),
      visitsT30Var,
      visitsT7Py: num(opsSummary.visits_t7_py),
      visitsT7: num(opsSummary.visits_t7),
      visitsT7Var: pct(opsSummary.visits_t7_var),
      leasesT7Py: num(opsSummary.leases_t7_py),
      leasesT7: num(opsSummary.leases_t7),
      closeRatio,
      projectedTraffic: num(opsSummary.projected_traffic),
      projectedTrafficGap,
      adSpendT1Budget: num(opsSummary.ad_spend_t1_budget),
      adSpendT1Actual: num(opsSummary.ad_spend_t1_actual),
      adSpendT1Var,
      adSpendT3Budget: num(opsSummary.ad_spend_t3_budget),
      adSpendT3Actual: num(opsSummary.ad_spend_t3_actual),
      adSpendT3Var: pct(opsSummary.ad_spend_t3_var),
      kingsleyFindT30,
      kingsleyFindPyT30: pct(opsSummary.kingsley_find_property_py_avg_t30),
    },
  };
}

function buildMarketingConversionRead(traffic: Record<string, unknown> | null, availableInterest: Record<string, unknown> | null) {
  const t7GuestCards = num(traffic?.guest_cards_t7 ?? availableInterest?.t7_guest_cards_vol);
  const t30GuestCards = num(traffic?.guest_cards_t30 ?? availableInterest?.t30_guest_cards_vol);
  const t60GuestCards = num(traffic?.guest_cards_t60);
  const t7Yoy = pct(traffic?.guest_cards_t7_yoy);
  const t30Yoy = pct(traffic?.guest_cards_t30_yoy);
  const availableUnits = num(availableInterest?.available_units);
  const vacantAvailableUnits = num(availableInterest?.vacant_available_units);
  const noticeAvailableUnits = num(availableInterest?.notice_available_units);
  const t30PerAvailableUnit = num(availableInterest?.t30_guest_cards_per_available_unit);
  const t7PerAvailableUnit = num(availableInterest?.t7_guest_cards_per_available_unit);
  const t30QuoteVolume = num(availableInterest?.t30_prospect_quote_vol);
  const t7QuoteVolume = num(availableInterest?.t7_prospect_quote_vol);
  const demandPosture =
    t30Yoy !== null && t30Yoy >= 0.25 ? "demand_expanding" :
    t30Yoy !== null && t30Yoy <= -0.15 ? "demand_contracting" :
    "demand_stable_or_mixed";
  return {
    posture: demandPosture,
    metrics: {
      t7GuestCards,
      t30GuestCards,
      t60GuestCards,
      t7Yoy,
      t30Yoy,
      availableUnits,
      vacantAvailableUnits,
      noticeAvailableUnits,
      t7PerAvailableUnit,
      t30PerAvailableUnit,
      t7QuoteVolume,
      t30QuoteVolume,
    },
  };
}

function normalizeMarketingSourceLabel(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (["adc", "apartments.com", "apartments.com / adc", "adc / apartments.com"].includes(lowered)) {
    return "Apartments.com / ADC";
  }
  if (["drive by", "drive-by", "walk in", "walk-in", "walk in / drive-by", "walk-in / drive-by"].includes(lowered)) {
    return "Walk-In / Drive-By";
  }
  return text;
}

function buildChannelEconomicsRows(
  sourcePerformanceRows: Record<string, unknown>[],
  costRows: Record<string, unknown>[]
) {
  const preferredCostRows = new Map<string, Record<string, unknown>>();
  for (const row of costRows) {
    const label = normalizeMarketingSourceLabel(row.marketing_source_group ?? row.marketing_source_desc);
    if (!label) continue;
    const current = preferredCostRows.get(label);
    if (!current || (current.calendar_month !== null && current.calendar_month !== undefined && (row.calendar_month === null || row.calendar_month === undefined))) {
      preferredCostRows.set(label, row);
    }
  }

  const rows = sourcePerformanceRows
    .filter((row) => row.source_group && row.source_group !== "Total")
    .map((row) => {
      const label = normalizeMarketingSourceLabel(row.source_group ?? row.source_desc) ?? "Source";
      const costRow = preferredCostRows.get(label) ?? {};
      const guestCards = num(row.guest_cards);
      const visits = num(row.visits);
      const applications = num(row.applications);
      const leases = num(row.leases);
      const moveIns = num(row.move_ins);
      const costPerGuestCard = num(costRow.cost_per_guest_card);
      const costPerVisit = num(costRow.cost_per_visit);
      const costPerApplication = num(costRow.cost_per_application);
      const costPerLease = num(costRow.cost_per_lease);
      let estimatedSpend: number | null = null;
      if (costPerLease !== null && leases !== null && leases > 0) {
        estimatedSpend = costPerLease * leases;
      } else if (costPerApplication !== null && applications !== null && applications > 0) {
        estimatedSpend = costPerApplication * applications;
      } else if (costPerGuestCard !== null && guestCards !== null && guestCards > 0) {
        estimatedSpend = costPerGuestCard * guestCards;
      }
      const costPerMoveIn = estimatedSpend !== null && moveIns !== null && moveIns > 0 ? estimatedSpend / moveIns : null;
      return {
        source: label,
        guestCards,
        visits,
        applications,
        leases,
        moveIns,
        costPerGuestCard,
        costPerVisit,
        costPerApplication,
        costPerLease,
        estimatedSpendBasis: estimatedSpend,
        costPerMoveIn,
      };
    })
    .sort((a, b) => {
      const leaseDelta = (b.leases ?? 0) - (a.leases ?? 0);
      if (leaseDelta !== 0) return leaseDelta;
      const moveInDelta = (b.moveIns ?? 0) - (a.moveIns ?? 0);
      if (moveInDelta !== 0) return moveInDelta;
      const gcDelta = (b.guestCards ?? 0) - (a.guestCards ?? 0);
      if (gcDelta !== 0) return gcDelta;
      return (a.source ?? "").localeCompare(b.source ?? "");
    });
  return rows;
}

function isGenericUnitType(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["generic", "other generic", "local generic", "brand", "branded"].includes(text);
}

function parseTopKeywords(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [] as Array<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

function buildUnitTypeTargetingRead(adKeywordRows: Record<string, unknown>[]) {
  const weekDate = adKeywordRows[0]?.week_date ? String(adKeywordRows[0].week_date) : null;
  const grouped = new Map<string, {
    unitType: string;
    spend: number;
    clicks: number;
    conversions: number;
    impressions: number;
    keywordCount: number;
    topKeywords: Map<string, { keyword: string; spend: number; clicks: number; conversions: number }>;
  }>();

  for (const row of adKeywordRows) {
    const rawUnitType = typeof row.unit_type === "string" && row.unit_type.trim() ? row.unit_type.trim() : "Generic";
    const unitType = isGenericUnitType(rawUnitType) ? "Generic" : rawUnitType;
    const current = grouped.get(unitType) ?? {
      unitType,
      spend: 0,
      clicks: 0,
      conversions: 0,
      impressions: 0,
      keywordCount: 0,
      topKeywords: new Map<string, { keyword: string; spend: number; clicks: number; conversions: number }>(),
    };
    current.spend += num(row.spend) ?? 0;
    current.clicks += num(row.clicks) ?? 0;
    current.conversions += num(row.conversions) ?? 0;
    current.impressions += num(row.impressions) ?? 0;
    current.keywordCount += num(row.keyword_count) ?? 0;
    for (const keywordRow of parseTopKeywords(row.top_keywords_json)) {
      const keyword = typeof keywordRow.keyword === "string" ? keywordRow.keyword.trim() : "";
      if (!keyword) continue;
      const target = current.topKeywords.get(keyword) ?? { keyword, spend: 0, clicks: 0, conversions: 0 };
      target.spend += num(keywordRow.spend) ?? 0;
      target.clicks += num(keywordRow.clicks) ?? 0;
      target.conversions += num(keywordRow.conversions) ?? 0;
      current.topKeywords.set(keyword, target);
    }
    grouped.set(unitType, current);
  }

  const rows = Array.from(grouped.values())
    .map((row) => ({
      unitType: row.unitType,
      spend: row.spend,
      clicks: row.clicks,
      conversions: row.conversions,
      impressions: row.impressions,
      keywordCount: row.keywordCount,
      topKeywords: Array.from(row.topKeywords.values())
        .sort((a, b) => (b.spend - a.spend) || (b.clicks - a.clicks) || a.keyword.localeCompare(b.keyword))
        .slice(0, 5),
    }))
    .sort((a, b) => {
      const genericDelta = Number(a.unitType === "Generic") - Number(b.unitType === "Generic");
      if (genericDelta !== 0) return genericDelta;
      return (b.spend - a.spend) || a.unitType.localeCompare(b.unitType);
    });

  const totalSpend = rows.reduce((sum, row) => sum + (row.spend ?? 0), 0);
  const classifiedRows = rows.filter((row) => row.unitType !== "Generic");
  const classifiedSpend = classifiedRows.reduce((sum, row) => sum + (row.spend ?? 0), 0);
  const targetedUnitTypes = classifiedRows.filter((row) => (row.spend ?? 0) > 0).length;

  return {
    status: rows.length ? "grounded" : "missing_source",
    weekDate,
    totalSpend,
    classifiedSpend,
    classifiedShare: totalSpend > 0 ? classifiedSpend / totalSpend : null,
    targetedUnitTypes,
    rows,
    sourceAuthority: rows.length
      ? "ad_keyword_performance mirrors PIB-style paid-search unit-type targeting."
      : "Unit-type targeting mirror unavailable.",
  };
}

function buildSourceSpendRead(
  costRows: Record<string, unknown>[],
  sourcePerformanceRows: Record<string, unknown>[],
  adKeywordRows: Record<string, unknown>[],
  spendRows: Record<string, unknown>[],
  opsRead: ReturnType<typeof buildWebOpsRead>
) {
  const latestCostDate = costRows[0]?.report_date ? String(costRows[0].report_date) : null;
  const latestSpendDate = spendRows[0]?.report_date ? String(spendRows[0].report_date) : null;
  const currentCostRows = latestCostDate ? costRows.filter((row) => String(row.report_date) === latestCostDate) : costRows;
  const portfolioRows = currentCostRows.filter((row) => !row.calendar_month);
  const monthlyRows = currentCostRows.filter((row) => row.calendar_month);
  const preferredRows = portfolioRows.length ? portfolioRows : monthlyRows;
  const sourceRows = preferredRows.map((row) => ({
    sourceGroup: normalizeMarketingSourceLabel(row.marketing_source_group) ?? row.marketing_source_group ?? null,
    sourceDescription: normalizeMarketingSourceLabel(row.marketing_source_desc ?? row.marketing_source_group) ?? row.marketing_source_desc ?? null,
    calendarMonth: row.calendar_month ?? null,
    costPerGuestCard: num(row.cost_per_guest_card),
    costPerVisit: num(row.cost_per_visit),
    costPerApplication: num(row.cost_per_application),
    costPerLease: num(row.cost_per_lease),
    invalidValueCount: num(row.invalid_value_count) ?? 0,
    sourceFile: row.source_file ?? null,
  }));
  const validLeaseRows = sourceRows.filter((row) => row.costPerLease !== null && row.costPerLease > 0);
  const validAppRows = sourceRows.filter((row) => row.costPerApplication !== null && row.costPerApplication > 0);
  const validGuestCardRows = sourceRows.filter((row) => row.costPerGuestCard !== null && row.costPerGuestCard > 0);
  const bestLeaseSource = validLeaseRows.sort((a, b) => Number(a.costPerLease) - Number(b.costPerLease))[0] ?? null;
  const bestApplicationSource = validAppRows.sort((a, b) => Number(a.costPerApplication) - Number(b.costPerApplication))[0] ?? null;
  const bestGuestCardSource = validGuestCardRows.sort((a, b) => Number(a.costPerGuestCard) - Number(b.costPerGuestCard))[0] ?? null;
  const inefficientSources = sourceRows
    .filter((row) => row.costPerGuestCard !== null && (row.costPerApplication === null || row.costPerLease === null))
    .sort((a, b) => Number(b.costPerGuestCard) - Number(a.costPerGuestCard))
    .slice(0, 3);
  const latestSpendMonth = spendRows[0]?.calendar_month ?? null;
  const latestSpendRow = spendRows[0] ?? null;
  const priorSpendRow = spendRows.find((row) => row.calendar_month && row.calendar_month !== latestSpendMonth) ?? null;
  const opsMetrics = opsRead.metrics;
  const adSpendVariance = opsMetrics?.adSpendT1Var ?? num(latestSpendRow?.ad_spend_delta);
  const spendPosture =
    adSpendVariance !== null && adSpendVariance > 0.15 ? "spending_above_budget_or_prior" :
    adSpendVariance !== null && adSpendVariance < -0.15 ? "spending_below_budget_or_prior" :
    latestSpendRow ? "spend_stable_or_mixed" :
    "missing_spend";
  const recommendationBasis =
    bestLeaseSource ? "lease_efficiency" :
    bestApplicationSource ? "application_efficiency" :
    bestGuestCardSource ? "guest_card_efficiency" :
    "insufficient_source_economics";
  const channelEconomics = buildChannelEconomicsRows(sourcePerformanceRows, preferredRows);
  const unitTypeTargeting = buildUnitTypeTargetingRead(adKeywordRows);
  return {
    status: latestCostDate || latestSpendDate ? "grounded" : "missing_source",
    reportDate: [latestCostDate, latestSpendDate].filter(Boolean).sort().pop() ?? null,
    latestCostDate,
    latestSpendDate,
    spendPosture,
    recommendationBasis,
    metrics: {
      latestSpendMonth,
      latestAdSpendTotal: num(latestSpendRow?.ad_spend_total),
      priorAdSpendTotal: num(priorSpendRow?.ad_spend_total),
      adSpendVariance,
      adSpendBudget: opsMetrics?.adSpendT1Budget ?? null,
      adSpendActual: opsMetrics?.adSpendT1Actual ?? null,
    },
    bestSources: {
      lease: bestLeaseSource,
      application: bestApplicationSource,
      guestCard: bestGuestCardSource,
    },
    channelEconomics,
    unitTypeTargeting,
    inefficientSources,
    sources: sourceRows.slice(0, 12),
    sourceAuthority: "Cost-per-conversion and monthly ad-spend rows are Marketing BI advisory economics; use them to explain source shifts, not as the official operating source of record.",
  };
}

function buildReputationNarrative(
  posture: string,
  reputationScore: number | null,
  janToCurrentChange: number | null,
  gapVsCompetitorAvg: number | null,
  responseRate: number | null,
  negativeReviewPct: number | null
) {
  const details = [
    reputationScore !== null ? `score ${reputationScore}` : null,
    janToCurrentChange !== null ? `${janToCurrentChange >= 0 ? "+" : ""}${janToCurrentChange} since January` : null,
    gapVsCompetitorAvg !== null ? `${gapVsCompetitorAvg >= 0 ? "+" : ""}${gapVsCompetitorAvg} vs local competitor average` : null,
    responseRate !== null ? `${responseRate.toFixed(1)}% response rate` : null,
    negativeReviewPct !== null ? `${negativeReviewPct.toFixed(1)}% negative review mix` : null,
  ].filter(Boolean).join("; ");
  const prefix =
    posture === "declining" ? "Reputation.com flags a declining trust posture" :
    posture === "competitively_exposed" ? "Reputation.com flags local competitive exposure" :
    posture === "reputation_risk" ? "Reputation.com flags a below-threshold reputation score" :
    "Reputation.com reads as stable or locally advantaged";
  return details ? `${prefix}: ${details}.` : `${prefix}.`;
}

function buildGbpReviewRead(
  reviews: Record<string, unknown>[],
  summary: Record<string, unknown> | null,
  insights: Record<string, unknown> | null
) {
  const recentLowStar = reviews.filter((row) => {
    const rating = num(row.star_rating_numeric);
    return rating !== null && rating <= 3;
  });
  const unansweredLowStar = recentLowStar.filter((row) => Number(row.has_reply ?? 0) === 0);
  const requiresAttention = reviews.filter((row) => Number(row.requires_attention ?? 0) === 1);
  const themes = [
    ["maintenance", "theme_maintenance"],
    ["staff", "theme_staff"],
    ["amenities", "theme_amenities"],
    ["noise", "theme_noise"],
    ["location", "theme_location"],
    ["value", "theme_value"],
    ["move-in", "theme_move_in"],
    ["move-out", "theme_move_out"],
    ["pets", "theme_pets"],
    ["parking", "theme_parking"],
  ].map(([label, key]) => ({
    label,
    count: reviews.filter((row) => Number(row[key] ?? 0) === 1).length,
  })).filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count);
  return {
    status: reviews.length ? "grounded" : "missing_or_not_mirrored",
    latestReviewDate: reviews[0]?.review_create_time ?? null,
    summary: summary ? {
      metricDate: summary.metric_date ?? null,
      totalReviewCount: num(summary.total_review_count),
      averageRating: num(summary.average_rating),
      newReviewsCount: num(summary.new_reviews_count),
    } : null,
    insights: insights ? {
      metricDate: insights.metric_date ?? null,
      totalProfileViews: num(insights.total_profile_views),
      totalActions: num(insights.total_actions),
      websiteClicks: num(insights.website_clicks),
      phoneCalls: num(insights.phone_calls),
      directionRequests: num(insights.direction_requests),
      discoveryRate: num(insights.discovery_rate),
    } : null,
    metrics: {
      recentReviewSample: reviews.length,
      recentLowStarReviews: recentLowStar.length,
      unansweredLowStarReviews: unansweredLowStar.length,
      requiresAttentionCount: requiresAttention.length,
      repliedReviewCount: reviews.filter((row) => Number(row.has_reply ?? 0) === 1).length,
      topThemeCount: themes[0]?.count ?? 0,
    },
    themes,
    examples: recentLowStar.slice(0, 5).map((row) => ({
      reviewId: row.review_id ?? null,
      rating: num(row.star_rating_numeric),
      hasReply: Number(row.has_reply ?? 0) === 1,
      reviewCreateTime: row.review_create_time ?? null,
      sentiment: row.sentiment_label ?? null,
      keyPhrases: row.key_phrases ?? null,
      commentExcerpt: textExcerpt(row.comment, 220),
    })),
  };
}

function buildCancelDenialRead(rows: Record<string, unknown>[]) {
  const latestDate = rows[0]?.report_date ? String(rows[0].report_date) : null;
  const currentRows = latestDate ? rows.filter((row) => String(row.report_date) === latestDate) : rows;
  const detailRows = currentRows.filter((row) => row.cancel_denial_type || row.cancel_denial_reason);
  const byReason = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const row of detailRows) {
    const count = num(row.cancel_denial_count) ?? 0;
    const reason = String(row.cancel_denial_reason ?? row.cancel_denial_type ?? "Unclassified");
    const source = String(row.marketing_source ?? "Unknown");
    byReason.set(reason, (byReason.get(reason) ?? 0) + count);
    bySource.set(source, (bySource.get(source) ?? 0) + count);
  }
  const topReasons = [...byReason.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topSources = [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    reportDate: latestDate,
    rowCount: currentRows.length,
    topReasons,
    topSources,
    rows: currentRows.slice(0, 12),
  };
}

function buildMarketingNarrative(
  status: string,
  conversionRead: ReturnType<typeof buildMarketingConversionRead>,
  friction: ReturnType<typeof buildCancelDenialRead>,
  opsRead: ReturnType<typeof buildWebOpsRead>
): string {
  if (status === "missing_source") {
    return "Marketing BI daily packet is not yet available to the Captain runtime.";
  }
  const m = conversionRead.metrics;
  const opsMetrics = opsRead.metrics;
  const opsLeadRead = opsMetrics?.leadsT30 !== null && opsMetrics?.leadsT30 !== undefined
    ? `Web Ops Summary shows ${opsMetrics.leadsT30} T30 leads (${formatPct(opsMetrics.leadsT30Var)} YoY)`
    : null;
  const demand = opsLeadRead ? opsLeadRead : conversionRead.posture === "demand_expanding"
    ? `Demand is expanding: T30 guest cards are ${formatPct(m.t30Yoy)} year over year`
    : conversionRead.posture === "demand_contracting"
      ? `Demand is contracting: T30 guest cards are ${formatPct(m.t30Yoy)} year over year`
      : "Demand is stable or mixed";
  const inventory = m.availableUnits !== null
    ? `against ${m.availableUnits} available units (${m.vacantAvailableUnits ?? 0} vacant, ${m.noticeAvailableUnits ?? 0} notice)`
    : "with inventory pressure still governed by the unit feed";
  const conversion = m.t30GuestCards !== null
    ? `${demand}, with ${m.t30GuestCards} T30 guest cards ${inventory}.`
    : `${demand}; use the packet as advisory context and the unit feed for inventory truth.`;
  const topReason = friction.topReasons[0];
  const frictionRead = topReason
    ? ` The highest visible conversion friction is ${topReason.reason} (${topReason.count}).`
    : "";
  const opsPressure = opsRead.status === "grounded" && opsMetrics
    ? ` Web Ops posture is ${opsRead.posture}; occupancy ${formatPctNoSign(opsMetrics.occupancy)}, ATR30 ${formatPctNoSign(opsMetrics.atr30)}, close ratio ${formatPctNoSign(opsMetrics.closeRatio)}.`
    : "";
  return `${conversion}${opsPressure}${frictionRead}`;
}

function buildCaptainDiagnosticRead(input: {
  property: CommunityRow;
  propertyCode: string;
  commandPosture: CaptainCommandPosture | Record<string, unknown> | null;
  activeWatchItems: Record<string, unknown>[];
  activeActions: Record<string, unknown>[];
  sources: Record<string, unknown>;
  inventory: Record<string, any>;
  operatingSnapshot: Record<string, any>;
  marketingInsight: Record<string, any>;
  reputationInsight: Record<string, any>;
  competitorMarketRead: Record<string, any>;
}) {
  const designationDoctrine = buildDesignationDoctrine(input.commandPosture);
  const unitCount = num(input.property.unit_count) ?? num(input.marketingInsight?.opsRead?.metrics?.units);
  const opsMetrics = input.operatingSnapshot?.metrics ?? null;
  const opsReadMetrics = input.marketingInsight?.opsRead?.metrics ?? null;
  const occupancy = pct(opsMetrics?.occupancy_rate) ?? pct(opsReadMetrics?.occupancy);
  const availableUnits = num(input.marketingInsight?.conversionRead?.metrics?.availableUnits)
    ?? num(input.inventory?.floorplans?.reduce?.((sum: number, row: Record<string, unknown>) => sum + Number(row.units ?? 0), 0));
  const targetExposurePct = 0.10;
  const currentExposurePct = availableUnits !== null && unitCount ? availableUnits / unitCount : occupancy !== null ? 1 - occupancy : null;
  const targetAvailableUnits = unitCount ? Math.floor(unitCount * targetExposurePct) : null;
  const moveInsNeeded = availableUnits !== null && targetAvailableUnits !== null
    ? Math.max(0, availableUnits - targetAvailableUnits)
    : occupancy !== null && unitCount
      ? Math.max(0, Math.ceil((0.90 - occupancy) * unitCount))
      : null;
  const currentT30GuestCards = num(input.marketingInsight?.conversionRead?.metrics?.t30GuestCards)
    ?? num(input.marketingInsight?.opsRead?.metrics?.leadsT30);
  const closeRatio = pct(input.marketingInsight?.opsRead?.metrics?.closeRatio);
  const guestCardsNeededAtCurrentClose = moveInsNeeded !== null && closeRatio && closeRatio > 0
    ? Math.ceil(moveInsNeeded / closeRatio)
    : null;
  const volumeMultiple = guestCardsNeededAtCurrentClose !== null && currentT30GuestCards && currentT30GuestCards > 0
    ? roundNumber(guestCardsNeededAtCurrentClose / currentT30GuestCards, 1)
    : null;
  const volumeRealistic = moveInsNeeded === 0
    ? true
    : volumeMultiple !== null
      ? volumeMultiple <= 1.25
      : null;
  const aged90 = num(input.inventory?.buckets?.aged90) ?? 0;
  const aged365 = num(input.inventory?.buckets?.aged365) ?? 0;
  const marketingPosture = String(input.marketingInsight?.opsRead?.posture ?? input.marketingInsight?.conversionRead?.posture ?? "unknown");
  const closeRatioPressure = closeRatio !== null && closeRatio < 0.02;
  const trafficPressure = marketingPosture === "traffic_gap" || marketingPosture === "lead_decline" || marketingPosture === "demand_contracting";
  const sourceSpendRead = input.marketingInsight?.sourceSpendRead ?? null;
  const sourceEconomicsMissing = !sourceSpendRead || sourceSpendRead.status === "missing_source" || sourceSpendRead.recommendationBasis === "insufficient_source_economics";
  const reputationPosture = String(input.reputationInsight?.posture ?? "");
  const reputationPressure = ["declining", "competitively_exposed", "reputation_risk"].includes(reputationPosture);
  const competitorMarketMissing = input.competitorMarketRead?.status === "missing_source";
  const competitorValuePressure = input.competitorMarketRead?.pricingPressure?.posture === "visible_value_pressure";
  const sourceGaps = [
    input.operatingSnapshot?.status === "missing_source" ? "official operating metrics" : null,
    !input.sources?.unitFeed && !input.inventory?.latestSnapshot ? "unit feed" : null,
    input.marketingInsight?.status === "missing_source" ? "Marketing BI" : null,
    sourceEconomicsMissing ? "source spend economics" : null,
    input.reputationInsight?.status === "missing_source" ? "Reputation.com" : null,
    competitorMarketMissing ? "competitor market research" : null,
  ].filter(Boolean);
  const primaryConstraint =
    availableUnits !== null && unitCount && availableUnits > Math.floor(unitCount * targetExposurePct) || aged90 > 0 || aged365 > 0
      ? "inventory"
      : closeRatioPressure
        ? "conversion"
        : trafficPressure
          ? "demand"
          : reputationPressure
            ? "reputation"
            : sourceGaps.length >= 3
              ? "source_quality"
              : "stable_or_mixed";
  const confidence =
    sourceGaps.length >= 3 ? "low" :
    input.operatingSnapshot?.status === "missing_source" || sourceGaps.length ? "medium" :
    "high";
  const floorplanExposure = Array.isArray(input.inventory?.floorplans)
    ? input.inventory.floorplans
      .map((row: Record<string, unknown>) => ({
        floorplan: row.floorplan_name ?? null,
        units: num(row.units),
        aged90: num(row.aged_90),
        aged180: num(row.aged_180),
        aged365: num(row.aged_365),
        specials: num(row.specials),
      }))
      .sort((left: any, right: any) => (right.aged90 ?? 0) - (left.aged90 ?? 0) || (right.units ?? 0) - (left.units ?? 0))
      .slice(0, 5)
    : [];
  const recommendations = buildDiagnosticRecommendations({
    primaryConstraint,
    confidence,
    moveInsNeeded,
    guestCardsNeededAtCurrentClose,
    volumeMultiple,
    availableUnits,
    targetAvailableUnits,
    currentT30GuestCards,
    closeRatio,
    trafficPressure,
    closeRatioPressure,
    reputationPressure,
    sourceGaps,
    sourceSpendRead,
    aged90,
    aged365,
    inventory: input.inventory,
    marketingInsight: input.marketingInsight,
    reputationInsight: input.reputationInsight,
    competitorMarketRead: input.competitorMarketRead,
    competitorValuePressure,
  });
  const doNotRecommend = buildDiagnosticGates({
    primaryConstraint,
    moveInsNeeded,
    volumeRealistic,
    trafficPressure,
    reputationPressure,
    competitorValuePressure,
    sourceGaps,
    availableUnits,
    unitCount,
  });
  const recoveryText = moveInsNeeded === null
    ? "Recovery math is blocked until either official operating metrics or unit exposure is available."
    : moveInsNeeded === 0
      ? "Current exposure is at or below the 10% watchlist threshold; keep monitoring source, conversion, and action completion."
      : guestCardsNeededAtCurrentClose !== null
        ? `Needs ${moveInsNeeded} move-in or exposure reduction(s) to reach the 10% watchlist threshold. At current close ratio, that implies about ${guestCardsNeededAtCurrentClose} T30 guest cards${volumeMultiple !== null ? ` (${volumeMultiple}x current T30 volume)` : ""}.`
        : `Needs ${moveInsNeeded} move-in or exposure reduction(s), but current close ratio is not available to translate that into guest-card volume.`;
  const executiveRead =
    `${input.property.name} primary constraint: ${primaryConstraint.replace(/_/g, " ")}. ${recoveryText} Confidence is ${confidence}${sourceGaps.length ? ` because ${sourceGaps.join(", ")} source coverage is incomplete` : ""}.`;
  return {
    status: "derived",
    standard: "POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04",
    propertyCode: input.propertyCode,
    commandPosture: input.commandPosture,
    designationDoctrine,
    executiveRead,
    primaryConstraint,
    confidence,
    recoveryMath: {
      targetExposurePct,
      unitCount,
      currentOccupancy: occupancy,
      currentExposurePct,
      availableUnits,
      targetAvailableUnits,
      moveInsNeeded,
      currentT30GuestCards,
      closeRatio,
      guestCardsNeededAtCurrentClose,
      volumeMultiple,
      volumeRealistic,
    },
    funnelDiagnosis: {
      status: input.marketingInsight?.status ?? "unknown",
      posture: marketingPosture,
      narrative: input.marketingInsight?.narrative ?? null,
      topFrictionReasons: input.marketingInsight?.cancelDenial?.topReasons ?? [],
      topFrictionSources: input.marketingInsight?.cancelDenial?.topSources ?? [],
    },
    sourceSpendDiagnosis: sourceSpendRead,
    competitorMarketRead: input.competitorMarketRead,
    floorplanExposure,
    recommendations,
    doNotRecommend,
    sourceGaps,
    proofCadence: designationDoctrine.proofCadence,
  };
}

function buildDesignationDoctrine(commandPosture: CaptainCommandPosture | Record<string, unknown> | null) {
  const designation = String(commandPosture && "designation" in commandPosture ? commandPosture.designation ?? "" : "").trim();
  if (designation === "Critical") {
    return {
      designation,
      meaning: "Escalated recovery command for persistent or acute underperformance.",
      captainPosture: "diagnose_track_escalate",
      attentionLevel: "daily_constraint_blocker_and_proof_review",
      requiredReads: ["priorPlan", "failedActions", "currentConstraint", "blockers", "ownerAccountability", "nextEscalation"],
      escalationRule: "Escalate unresolved blockers, failed actions, or worsening lagging metrics to leadership.",
      proofCadence: "Review constraint, blockers, action proof, and owner accountability daily; publish a leadership-ready read weekly.",
    };
  }
  if (designation === "Spotlight" || designation === "Sale") {
    return {
      designation,
      meaning: "Accelerated recovery watch for an underperforming or strategically exposed property.",
      captainPosture: "diagnose_and_direct",
      attentionLevel: "daily_lagging_lane_check",
      requiredReads: ["recoveryMath", "primaryConstraint", "laggingLanes", "openActions", "proofChecks", "peerFamilyRead"],
      escalationRule: "Escalate to Critical if the lagging constraint does not improve, actions are not completed, or the condition worsens.",
      proofCadence: "Check lagging lanes and action proof daily; publish a weekly human update and regenerate the full plan monthly unless the diagnosis changes.",
    };
  }
  return {
    designation: designation || null,
    meaning: "Baseline portfolio monitoring.",
    captainPosture: "monitor_and_remember",
    attentionLevel: "normal_cadence",
    requiredReads: ["sourceReadiness", "watchItems", "openActions"],
    escalationRule: "Escalate when a material lagging pattern or unresolved blocker appears.",
    proofCadence: "Monitor on normal Captain cadence and preserve material changes in memory.",
  };
}

async function getCaptainPeerFamilyRead(
  db: D1Database,
  property: CommunityRow,
  propertyCode: string,
  diagnosticRead: Record<string, any>
) {
  const subject = await safeQueryFirst<Record<string, unknown>>(
    db,
    `SELECT *
     FROM marketing_ops_summary_rows
     WHERE property_id = ? OR community_id = ?
     ORDER BY report_date DESC
     LIMIT 1`,
    [propertyCode, property.id]
  );
  if (!subject) {
    return {
      status: "missing_source",
      peerSet: [],
      borrowableTactics: [],
      message: "Peer-family read needs Web Ops Summary rows for the subject property.",
    };
  }
  const region = String(subject.region ?? "").trim();
  const latestDate = String(subject.report_date ?? "");
  const peers = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT property_id, community_id, property_name, region, units, occupancy, atr30, leads_t30, leads_t30_var,
       visits_t30, visits_t30_var, close_ratio, projected_traffic_gap, ad_spend_t1_actual, ad_spend_t1_var
     FROM marketing_ops_summary_rows
     WHERE report_date = ?
       AND (? = '' OR region = ?)
       AND COALESCE(property_id, '') <> ?
       AND COALESCE(community_id, '') <> ?
     ORDER BY occupancy DESC, close_ratio DESC, leads_t30_var DESC
     LIMIT 40`,
    [latestDate, region, region, propertyCode, property.id]
  );
  const subjectOccupancy = pct(subject.occupancy);
  const subjectClose = pct(subject.close_ratio);
  const subjectLeadVar = pct(subject.leads_t30_var);
  const subjectTrafficGap = num(subject.projected_traffic_gap);
  const constraint = String(diagnosticRead.primaryConstraint ?? "stable_or_mixed");
  const scored = peers
    .map((peer) => {
      const peerOccupancy = pct(peer.occupancy);
      const peerClose = pct(peer.close_ratio);
      const peerLeadVar = pct(peer.leads_t30_var);
      const peerTrafficGap = num(peer.projected_traffic_gap);
      const score =
        constraint === "conversion" ? (peerClose ?? 0) - (subjectClose ?? 0) :
        constraint === "demand" ? (peerLeadVar ?? 0) - (subjectLeadVar ?? 0) + ((peerTrafficGap ?? 0) - (subjectTrafficGap ?? 0)) / 100 :
        constraint === "inventory" ? (peerOccupancy ?? 0) - (subjectOccupancy ?? 0) + ((peerClose ?? 0) - (subjectClose ?? 0)) / 2 :
        (peerOccupancy ?? 0) - (subjectOccupancy ?? 0);
      return { peer, score, peerOccupancy, peerClose, peerLeadVar, peerTrafficGap };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const peerSet = scored.map((item) => ({
    propertyCode: item.peer.property_id ?? null,
    communityId: item.peer.community_id ?? null,
    propertyName: item.peer.property_name ?? null,
    region: item.peer.region ?? null,
    reason: peerReason(constraint, item.peer, subject),
    metrics: {
      occupancy: item.peerOccupancy,
      closeRatio: item.peerClose,
      leadsT30Var: item.peerLeadVar,
      projectedTrafficGap: item.peerTrafficGap,
    },
  }));
  const borrowableTactics = peerSet.slice(0, 2).map((peer) => ({
    tactic: peerTactic(constraint),
    sourcePeer: peer.propertyName,
    whyItApplies: peer.reason,
    confidence: region ? "medium" : "low",
    proofCheck: peerProofCheck(constraint),
  }));
  return {
    status: peerSet.length ? "derived" : "no_stronger_peer_found",
    source: "marketing_ops_summary_rows",
    reportDate: latestDate || null,
    peerSelection: region ? "same_region" : "portfolio",
    subject: {
      propertyCode,
      propertyName: property.name,
      region: region || null,
      primaryConstraint: constraint,
      occupancy: subjectOccupancy,
      closeRatio: subjectClose,
      leadsT30Var: subjectLeadVar,
      projectedTrafficGap: subjectTrafficGap,
    },
    peerSet,
    borrowableTactics,
  };
}

function peerReason(constraint: string, peer: Record<string, unknown>, subject: Record<string, unknown>) {
  const peerName = String(peer.property_name ?? "Peer property");
  const occupancyDelta = pct(peer.occupancy) !== null && pct(subject.occupancy) !== null
    ? roundNumber((pct(peer.occupancy) as number - (pct(subject.occupancy) as number)) * 100, 1)
    : null;
  const closeDelta = pct(peer.close_ratio) !== null && pct(subject.close_ratio) !== null
    ? roundNumber((pct(peer.close_ratio) as number - (pct(subject.close_ratio) as number)) * 100, 1)
    : null;
  if (constraint === "conversion" && closeDelta !== null) {
    return `${peerName} is in the same peer family and shows a close ratio ${closeDelta.toFixed(1)} pts stronger.`;
  }
  if (constraint === "demand") {
    return `${peerName} is in the same peer family and shows stronger demand or traffic-gap posture.`;
  }
  if (constraint === "inventory" && occupancyDelta !== null) {
    return `${peerName} is in the same peer family with occupancy ${occupancyDelta.toFixed(1)} pts stronger and can inform recovery tactics.`;
  }
  return `${peerName} is a stronger same-family operating peer for this diagnostic cycle.`;
}

function peerTactic(constraint: string) {
  if (constraint === "conversion") return "Borrow the peer's follow-up, leasing execution, and application conversion playbook.";
  if (constraint === "demand") return "Borrow the peer's strongest source/channel and local positioning tactic after validating source economics.";
  if (constraint === "inventory") return "Borrow the peer's floorplan-specific inventory, pricing, concession, and content tactic for exposed units.";
  return "Borrow the peer's operating pattern only after local evidence confirms fit.";
}

function peerProofCheck(constraint: string) {
  if (constraint === "conversion") return "Compare close ratio, applications, leases, and task completion after 14 days.";
  if (constraint === "demand") return "Compare T7/T30 guest cards, applications, source economics, and qualified traffic after 14 days.";
  if (constraint === "inventory") return "Compare exposed units, aged inventory, specials, and floorplan-specific leases after 14 days.";
  return "Compare the lagging metric and action completion in the next Captain cycle.";
}

function buildDiagnosticRecommendations(input: Record<string, any>) {
  const recommendations: Record<string, unknown>[] = [];
  const add = (item: Record<string, unknown>) => recommendations.push({
    confidence: input.confidence,
    due_date: "next_7_days",
    ...item,
  });
  if (input.primaryConstraint === "inventory") {
    add({
      constraint: "inventory",
      action: "Prioritize exposed and aged floorplans before promoting scarce inventory.",
      owner_role: "Property / Regional Operations",
      expected_lift: input.moveInsNeeded ? `${input.moveInsNeeded} exposure reduction(s) needed to reach the 10% threshold` : "reduce stale exposed inventory",
      evidence: {
        source: "unit_availability_units + Marketing BI available-unit interest",
        availableUnits: input.availableUnits,
        targetAvailableUnits: input.targetAvailableUnits,
        aged90: input.aged90,
        aged365: input.aged365,
        latestSnapshot: input.inventory?.latestSnapshot ?? null,
      },
      proof_check: "Next Captain cycle shows fewer exposed/aged units and action completion on the affected floorplans.",
    });
  }
  if (input.trafficPressure) {
    add({
      constraint: "demand",
      action: sourceEconomicsAction(input.sourceSpendRead),
      owner_role: "Marketing",
      expected_lift: input.guestCardsNeededAtCurrentClose ? `close a ${input.guestCardsNeededAtCurrentClose} guest-card requirement if conversion holds` : "improve qualified demand",
      evidence: {
        source: "Web Ops Summary / Marketing BI traffic conversions / cost-per-conversion",
        posture: input.marketingInsight?.opsRead?.posture ?? input.marketingInsight?.conversionRead?.posture ?? null,
        currentT30GuestCards: input.currentT30GuestCards,
        projectedTrafficGap: input.marketingInsight?.opsRead?.metrics?.projectedTrafficGap ?? null,
        bestSources: input.sourceSpendRead?.bestSources ?? null,
        inefficientSources: input.sourceSpendRead?.inefficientSources ?? [],
        spendPosture: input.sourceSpendRead?.spendPosture ?? null,
      },
      proof_check: "T7/T30 guest cards, applications, leases, and cost-per-conversion improve in the next source read.",
    });
  }
  if (input.closeRatioPressure) {
    add({
      constraint: "conversion",
      action: "Validate lead follow-up, task completion, and leasing execution before prescribing more traffic.",
      owner_role: "Sales / Property",
      expected_lift: "raise close ratio enough that current demand can convert",
      evidence: {
        source: "Web Ops Summary close ratio and cancel/denial detail",
        closeRatio: input.closeRatio,
        topFrictionReasons: input.marketingInsight?.cancelDenial?.topReasons ?? [],
      },
      proof_check: "Close ratio, application-to-lease movement, and past-due task counts improve in the next cycle.",
    });
  }
  if (input.reputationPressure) {
    add({
      constraint: "reputation",
      action: "Review recent low-star/reputation themes before amplifying paid exposure.",
      owner_role: "Reputation / Property",
      expected_lift: "remove trust friction that can suppress visits and applications",
      evidence: {
        source: "Reputation.com + GBP review read",
        posture: input.reputationInsight?.posture ?? null,
        narrative: input.reputationInsight?.narrative ?? null,
      },
      proof_check: "Recent review mix, response coverage, and local competitor gap stabilize or improve.",
    });
  }
  if (input.competitorValuePressure) {
    add({
      constraint: "competitive_market",
      action: "Review pricing/concessions and competitor-facing copy before recommending broad advertising increases.",
      owner_role: "Marketing / Pricing / Property",
      expected_lift: "improve visible value position against current public comp offers",
      evidence: {
        source: "competitor_market_research_observations",
        snapshotDate: input.competitorMarketRead?.snapshotDate ?? null,
        lowerRentCompetitors: input.competitorMarketRead?.pricingPressure?.lowerRentCompetitors ?? [],
        confirmedSpecials: input.competitorMarketRead?.pricingPressure?.confirmedSpecials ?? [],
        packageGaps: input.competitorMarketRead?.sourceGaps ?? [],
      },
      proof_check: "Refresh competitor rent/special evidence and compare T7 guest cards, visits, applications, and leases after changes.",
    });
  }
  if (input.sourceGaps?.length) {
    add({
      constraint: "source_quality",
      action: "Resolve missing source lanes before publishing high-confidence pricing, staffing, or spend directives.",
      owner_role: "Data Pond / WebOps",
      expected_lift: "raise diagnostic confidence",
      evidence: { sourceGaps: input.sourceGaps },
      proof_check: "Next brief shows source lanes current and recommendation confidence upgraded.",
    });
  }
  return recommendations.slice(0, 5);
}

function sourceEconomicsAction(sourceSpendRead: Record<string, any> | null | undefined) {
  if (!sourceSpendRead || sourceSpendRead.status === "missing_source") {
    return "Pull cost-per-conversion and monthly spend before choosing a source shift or budget increase.";
  }
  const bestLease = sourceSpendRead.bestSources?.lease;
  if (bestLease?.sourceGroup) {
    return `Prioritize source review around ${bestLease.sourceGroup}; it has the strongest visible cost-per-lease economics.`;
  }
  const bestApp = sourceSpendRead.bestSources?.application;
  if (bestApp?.sourceGroup) {
    return `Prioritize source review around ${bestApp.sourceGroup}; it has the strongest visible cost-per-application economics.`;
  }
  const bestGc = sourceSpendRead.bestSources?.guestCard;
  if (bestGc?.sourceGroup) {
    return `Use ${bestGc.sourceGroup} as the demand-efficiency benchmark while validating downstream applications and leases.`;
  }
  return "Review source mix and spend before adding budget; current source economics are incomplete.";
}

function buildDiagnosticGates(input: Record<string, any>) {
  const gates: string[] = [];
  if (input.primaryConstraint !== "demand") {
    gates.push("Do not default to more advertising spend until the primary non-demand constraint is addressed.");
  }
  if (input.volumeRealistic === false) {
    gates.push("Do not present traffic alone as sufficient; the needed guest-card volume is unrealistic at the current close ratio.");
  }
  if (input.reputationPressure) {
    gates.push("Do not upgrade paid visibility without checking whether recent ratings/reviews would weaken the extra exposure.");
  }
  if (input.competitorValuePressure) {
    gates.push("Do not claim an ADC/package disadvantage or premium-placement gap until package status is captured from a controlled source.");
  }
  if (input.availableUnits !== null && input.unitCount && input.availableUnits > Math.floor(input.unitCount * 0.10)) {
    gates.push("Do not promote scarce unit types while exposed floorplans remain above the 10% watchlist threshold.");
  }
  if (input.sourceGaps?.length) {
    gates.push("Do not publish high-confidence pricing, staffing, or concession directives until the missing source lanes are resolved.");
  }
  if (!input.sourceSpendRead || input.sourceSpendRead.recommendationBasis === "insufficient_source_economics") {
    gates.push("Do not recommend a source-specific spend shift until cost-per-conversion rows identify at least a guest-card, application, or lease efficiency signal.");
  }
  return gates;
}

async function resolveCommunity(db: D1Database, propertyRef: string): Promise<CommunityRow> {
  const row = await queryFirst<CommunityRow>(
    db,
    `SELECT id, name, external_key, ga4_property_id, encasa_property_code, full_url, unit_count
     FROM communities
     WHERE id = ? OR encasa_property_code = ? OR external_key = ? OR ga4_property_id = ? OR lower(name) = lower(?)
     LIMIT 1`,
    [propertyRef, propertyRef, propertyRef, propertyRef, propertyRef]
  );
  if (!row) {
    throw new Error(`Unknown property for Captain runtime: ${propertyRef}`);
  }
  return row;
}

async function getSupportAgents(db: D1Database, propertyCode: string): Promise<SupportAgentRow[]> {
  return queryAll<SupportAgentRow>(
    db,
    `SELECT id, property_id, agent_key, agent_name, role, cadence, status, source_scope_json
     FROM captain_support_agents
     WHERE property_id = ? AND status = 'active'
     ORDER BY cadence ASC, agent_key ASC`,
    [propertyCode]
  );
}

async function getSupportAgentsOrEmpty(db: D1Database, propertyCode: string): Promise<SupportAgentRow[]> {
  try {
    return await getSupportAgents(db, propertyCode);
  } catch {
    return [];
  }
}

async function groupedRows(
  db: D1Database,
  table: string,
  keyColumn: string,
  keys: string[],
  selectSql: string,
  extraWhere?: string
): Promise<Map<string, Record<string, unknown>>> {
  if (keys.length === 0) return new Map();
  const placeholders = keys.map(() => "?").join(", ");
  const where = [`${keyColumn} IN (${placeholders})`, extraWhere].filter(Boolean).join(" AND ");
  const rows = await safeQueryAll<Record<string, unknown>>(
    db,
    `SELECT ${keyColumn} AS groupKey, ${selectSql} FROM ${table} WHERE ${where} GROUP BY ${keyColumn}`,
    keys
  );
  return new Map(rows.map((row) => [String(row.groupKey), row]));
}

async function getCaptainSourceCoverage(db: D1Database, propertyCode: string, ga4PropertyId?: string | null) {
  const sourceChecks = [
    { key: "aptiq", label: "AptIQ Watchlist", table: "aptiq_watchlist_summaries", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "market" },
    { key: "marketingOps", label: "Web Ops Summary", table: "marketing_ops_summary_rows", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "operating" },
    { key: "trafficConversions", label: "T30/T90 Funnel", table: "marketing_bi_traffic_conversions_full", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "funnel" },
    { key: "guestCards", label: "Guest Cards", table: "guest_card_metrics", dateColumn: "run_date", propertyColumn: "property_code", propertyValue: propertyCode, group: "funnel" },
    { key: "cancelDenial", label: "Cancel / Denial", table: "marketing_cancel_denial_by_source", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "funnel" },
    { key: "adSpend", label: "Ad Spend", table: "marketing_bi_ad_spend_performance_month", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "marketing" },
    { key: "reputation", label: "Reputation.com", table: "reputation_com_location_leaderboard", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "reputation" },
    { key: "spotlightNotes", label: "Spotlight Notes", table: "spotlight_weekly_field_snapshots", dateColumn: "report_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "execution" },
    { key: "competitorMarket", label: "Competitor Market", table: "competitor_market_research_snapshots", dateColumn: "snapshot_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "market" },
    { key: "dataforseoRankings", label: "DataForSEO Rankings", table: "dataforseo_property_keyword_rankings", dateColumn: "run_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "search" },
    { key: "dataforseoOnPage", label: "DataForSEO OnPage", table: "dataforseo_onpage_page_snapshots", dateColumn: "run_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "search" },
    { key: "dataforseoBusiness", label: "DataForSEO Business Profile", table: "dataforseo_business_profiles", dateColumn: "run_date", propertyColumn: "property_id", propertyValue: propertyCode, group: "search" },
    { key: "unitAvailability", label: "Unit Availability", table: "unit_availability_units", dateColumn: "snapshot_date", propertyColumn: "property_id", propertyValue: ga4PropertyId, group: "inventory" },
    { key: "gbpReviews", label: "GBP Reviews", table: "gbp_reviews", dateColumn: "review_create_time", propertyColumn: "property_id", propertyValue: ga4PropertyId, group: "reputation" },
    { key: "googleAds", label: "Google Ads", table: "google_ads_campaigns", dateColumn: "metric_date", propertyColumn: "property_id", propertyValue: ga4PropertyId, group: "marketing" },
  ];
  const rows = await Promise.all(sourceChecks.map(async (source) => {
    if (!source.propertyValue) {
      return { ...source, rows: 0, latest: null, status: "not_configured" };
    }
    const row = await safeQueryFirst<Record<string, unknown>>(
      db,
      `SELECT COUNT(*) AS rows, MAX(${source.dateColumn}) AS latest FROM ${source.table} WHERE ${source.propertyColumn} = ?`,
      [source.propertyValue]
    );
    const rows = Number(row?.rows ?? 0);
    return {
      key: source.key,
      label: source.label,
      group: source.group,
      rows,
      latest: row?.latest ?? null,
      status: rows > 0 ? "ready" : "not_loaded",
    };
  }));
  return rows;
}

function deriveCaptainCommandPosture(agents: SupportAgentRow[]): CaptainCommandPosture {
  const scopeTypes = new Set<string>();
  const cadences = new Set<string>();
  let designation: string | null = null;
  let market: string | null = null;
  for (const agent of agents) {
    cadences.add(agent.cadence);
    const parsed = parseJsonObject(agent.source_scope_json);
    const scopeType = String(parsed?.scope_type ?? "").split(",");
    for (const value of scopeType) {
      const normalized = value.trim();
      if (normalized) {
        scopeTypes.add(normalized);
      }
    }
    if (!designation && typeof parsed?.designation === "string" && parsed.designation.trim()) {
      designation = parsed.designation.trim();
    }
    if (!market && typeof parsed?.market === "string" && parsed.market.trim()) {
      market = parsed.market.trim();
    }
  }
  const intensity =
    designation === "Critical" ? "urgent" : designation === "Sale" || designation === "Spotlight" ? "focused" : "baseline";
  return {
    scopeTypes: Array.from(scopeTypes).sort(),
    designation,
    market,
    cadences: Array.from(cadences).sort(),
    supportAgentCount: agents.length,
    intensity,
  };
}

function designationFromSourceScope(sourceScopeJson?: string | null) {
  const designation = String(parseJsonObject(sourceScopeJson)?.designation ?? "").trim();
  return designation || null;
}

function designationSeverity(
  base: WatchItemInput["severity"],
  designation: string | null
): WatchItemInput["severity"] {
  if (designation !== "Critical") {
    return base;
  }
  if (base === "medium") {
    return "high";
  }
  if (base === "high") {
    return "critical";
  }
  return base;
}

function designationPriority(
  base: ActionInput["priority"],
  designation: string | null
): ActionInput["priority"] {
  if (designation !== "Critical") {
    return base;
  }
  if (base === "medium") {
    return "high";
  }
  if (base === "high") {
    return "critical";
  }
  return base;
}

async function upsertWatchItem(
  db: D1Database,
  property: CommunityRow,
  propertyCode: string,
  agentKey: string,
  watch: WatchItemInput,
  actorId: string | null,
  now: string
) {
  const id = `watch_${propertyCode}_${watch.watchKey}`;
  await run(
    db,
    `INSERT INTO captain_watch_items (
      id, property_id, community_id, watch_key, title, category, severity, status, current_state,
      evidence_json, next_move, owner_role, due_date, source_agent_key, first_seen_at, last_seen_at,
      resolved_at, created_at, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    ON CONFLICT(property_id, watch_key) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      severity = excluded.severity,
      status = excluded.status,
      current_state = excluded.current_state,
      evidence_json = excluded.evidence_json,
      next_move = excluded.next_move,
      owner_role = excluded.owner_role,
      due_date = excluded.due_date,
      source_agent_key = excluded.source_agent_key,
      last_seen_at = excluded.last_seen_at,
      resolved_at = CASE WHEN excluded.status = 'resolved' THEN excluded.last_seen_at ELSE captain_watch_items.resolved_at END,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`,
    [
      id,
      propertyCode,
      property.id,
      watch.watchKey,
      watch.title,
      watch.category,
      watch.severity,
      watch.status,
      watch.currentState,
      JSON.stringify(watch.evidence),
      watch.nextMove ?? null,
      watch.ownerRole ?? null,
      watch.dueDate ?? null,
      agentKey,
      now,
      now,
      now,
      now,
      actorId,
    ]
  );
}

async function upsertAction(
  db: D1Database,
  property: CommunityRow,
  propertyCode: string,
  agentKey: string,
  runId: string,
  action: ActionInput,
  actorId: string | null,
  now: string
) {
  const id = `action_${propertyCode}_${action.actionKey}`;
  await run(
    db,
    `INSERT INTO captain_actions (
      id, property_id, community_id, action_key, title, owner_role, due_date, status, priority,
      evidence_json, source_agent_key, created_from_run_id, created_at, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(property_id, action_key) DO UPDATE SET
      title = excluded.title,
      owner_role = excluded.owner_role,
      due_date = excluded.due_date,
      status = CASE WHEN captain_actions.status = 'done' THEN captain_actions.status ELSE excluded.status END,
      priority = excluded.priority,
      evidence_json = excluded.evidence_json,
      source_agent_key = excluded.source_agent_key,
      created_from_run_id = excluded.created_from_run_id,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`,
    [
      id,
      propertyCode,
      property.id,
      action.actionKey,
      action.title,
      action.ownerRole,
      action.dueDate ?? null,
      action.status,
      action.priority,
      JSON.stringify(action.evidence),
      agentKey,
      runId,
      now,
      now,
      actorId,
    ]
  );
}

function floorplanWatch(watchKey: string, title: string, row: { floorplan_name: string; units: number; aged_30: number; aged_60: number; aged_90: number; aged_180: number; aged_365: number; specials: number }): WatchItemInput {
  return {
    watchKey,
    title,
    category: "inventory",
    severity: Number(row.aged_90) >= 5 ? "critical" : "high",
    status: "open",
    currentState: `${row.floorplan_name}: ${row.units} unit(s), ${row.aged_30} at 30+ days, ${row.aged_60} at 60+ days, ${row.aged_90} at 90+ days.`,
    evidence: row,
    nextMove: `Maintain a ${row.floorplan_name}-specific price/concession rule until aging pressure clears.`,
    ownerRole: "Revenue / Property",
  };
}

async function safeScalar(db: D1Database, sql: string, params: unknown[] = []): Promise<unknown | null> {
  const row = await safeQueryFirst<{ value: unknown }>(db, sql, params);
  return row?.value ?? null;
}

async function firstAvailableScalar(
  db: D1Database,
  queries: { sql: string; params?: unknown[] }[]
): Promise<unknown | null> {
  for (const query of queries) {
    const value = await safeScalar(db, query.sql, query.params ?? []);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

async function firstAvailableRow<T = Record<string, unknown>>(
  db: D1Database,
  queries: { sql: string; params?: unknown[] }[]
): Promise<T | null> {
  for (const query of queries) {
    const row = await safeQueryFirst<T>(db, query.sql, query.params ?? []);
    if (row) {
      return row;
    }
  }
  return null;
}

async function safeQueryFirst<T = Record<string, unknown>>(db: D1Database, sql: string, params: unknown[] = []): Promise<T | null> {
  try {
    return await queryFirst<T>(db, sql, params);
  } catch {
    return null;
  }
}

async function safeQueryAll<T = Record<string, unknown>>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await queryAll<T>(db, sql, params);
  } catch {
    return [];
  }
}

function daysSince(dateLike: string): number {
  const date = new Date(`${dateLike}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function compactTimestamp(iso: string): string {
  return iso.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function normalizeFloorplan(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundNumber(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function textExcerpt(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function pct(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : parsed;
}

function formatPct(value: number | null): string {
  if (value === null) return "unreported";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatPctNoSign(value: number | null): string {
  if (value === null) return "unreported";
  return `${(value * 100).toFixed(1)}%`;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readCaptainName(payload: Record<string, unknown> | null): string | null {
  const latestMemory = payload?.latestMemory;
  if (!latestMemory || typeof latestMemory !== "object" || Array.isArray(latestMemory)) return null;
  const structured = parseJsonObject((latestMemory as Record<string, unknown>).structured_payload_json);
  const captain = structured?.captain;
  return typeof captain === "string" && captain.trim() ? captain : null;
}

function captainAgentRoleKey(agentKey: string): string {
  const knownRoles = [
    "source_scout",
    "truth_reconciler",
    "inventory_watch",
    "funnel_watch",
    "media_watch",
    "navigator_watch",
    "experience_watch",
    "boatswain",
    "logkeeper",
    "supervisor_scribe",
  ];
  return knownRoles.find((role) => agentKey === role || agentKey.endsWith(`_${role}`)) ?? agentKey;
}

function defaultCaptainName(propertyName: string | null | undefined): string {
  const raw = (propertyName ?? "").replace(/^the\s+/i, "").trim();
  const firstWord = raw.split(/\s+/)[0]?.replace(/[^A-Za-z0-9'-]/g, "");
  return firstWord ? `Captain ${firstWord}` : "Captain";
}
