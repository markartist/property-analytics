/**
 * Watchtower health routes — system health, data freshness, coverage matrix.
 *
 * Endpoints:
 *   GET /status  — full system health snapshot
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";

const health = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
health.use("*", requireAuth);

const LOCAL_TIMEZONE = "America/Chicago";
const MANUAL_MORNING_SOURCE_KEYS = new Set([
  "guest_cards",
  "guest_card",
  "gift_cards",
  "gift_card",
  "bi_report",
  "bi_manual",
  "measurement_dashboard",
  "bi_metrics",
]);

// Data source definitions: table name, date column, label
const DATA_SOURCES = [
  { key: "ga4", table: "pib_ga4_metrics", dateCol: "snapshot_date", label: "GA4 Traffic" },
  { key: "site_perf", table: "pib_site_performance", dateCol: "snapshot_date", label: "Site Performance" },
  { key: "local_presence", table: "pib_local_presence", dateCol: "snapshot_date", label: "GBP (Local Presence)" },
  { key: "search", table: "pib_search_performance", dateCol: "snapshot_date", label: "Search (GSC)" },
  { key: "cir", table: "pib_cir", dateCol: "snapshot_date", label: "CIR" },
  { key: "reviews", table: "pib_reviews", dateCol: "snapshot_date", label: "Reviews" },
  { key: "marketing", table: "marketing_data", dateCol: "week_date", label: "Marketing Data" },
  { key: "t7", table: "t7_metrics", dateCol: "week_date", label: "T7 Leasing" },
  { key: "t30", table: "t30_metrics", dateCol: "week_date", label: "T30 Leasing" },
] as const;

const CORE_FAILURE_SOURCES = new Set(["ga4", "gsc", "google_ads", "guest_card", "unit_availability", "d1_mirror"]);
const ACTIVE_COLLECTION_STATUSES = new Set(["in_progress", "partial", "retry_scheduled"]);
const BLOCKED_COLLECTION_STATUSES = new Set(["blocked", "failed", "exhausted"]);
type AdvisoryCadenceKey = "same_day_manual" | "daily_diagnostic" | "weekly_manual" | "weekly_automated" | "targeted_manual";
type AdvisoryFreshnessStatus = "fresh" | "warning" | "stale" | "missing";

type AdvisorySourcePolicy = {
  cadence_key: AdvisoryCadenceKey;
  cadence_label: string;
  latestDataQuery?: { table: string; dateCol: string };
};

const ADVISORY_SOURCE_POLICIES: Record<string, AdvisorySourcePolicy> = {
  bi_manual: { cadence_key: "same_day_manual", cadence_label: "Same-day manual" },
  bi_metrics: { cadence_key: "same_day_manual", cadence_label: "Same-day manual" },
  bi_report: { cadence_key: "same_day_manual", cadence_label: "Same-day manual" },
  measurement_dashboard: {
    cadence_key: "weekly_manual",
    cadence_label: "Weekly manual workbook",
    latestDataQuery: { table: "measurement_daily_metrics", dateCol: "snapshot_date" },
  },
  psi: {
    cadence_key: "daily_diagnostic",
    cadence_label: "Daily diagnostic",
    latestDataQuery: { table: "pagespeed_metrics", dateCol: "metric_date" },
  },
  gsc_url_inspection: {
    cadence_key: "targeted_manual",
    cadence_label: "Targeted manual audit",
    latestDataQuery: { table: "gsc_url_inspection", dateCol: "inspection_date" },
  },
  semrush: {
    cadence_key: "weekly_automated",
    cadence_label: "Weekly automated",
    latestDataQuery: { table: "semrush_domain_metrics", dateCol: "metric_date" },
  },
  gbp_reviews: {
    cadence_key: "weekly_automated",
    cadence_label: "Weekly automated",
    latestDataQuery: { table: "gbp_reviews", dateCol: "review_create_time" },
  },
  gbp_insights: {
    cadence_key: "weekly_automated",
    cadence_label: "Weekly automated",
    latestDataQuery: { table: "gbp_daily_insights", dateCol: "metric_date" },
  },
  cloudflare_cache_audit: { cadence_key: "weekly_automated", cadence_label: "Weekly automated" },
  browserstack: { cadence_key: "targeted_manual", cadence_label: "Targeted manual audit" },
  evs: { cadence_key: "targeted_manual", cadence_label: "Targeted manual audit" },
  sightmap: { cadence_key: "targeted_manual", cadence_label: "Targeted manual audit" },
};

type DataSourceKey = typeof DATA_SOURCES[number]["key"];

function formatDateInTimezone(now: Date, timeZone = LOCAL_TIMEZONE): { ymd: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return { ymd: `${year}-${month}-${day}`, hour };
}

function parseYmdToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function formatUtcDateToYmd(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function previousBusinessDay(value: string): string {
  const cursor = parseYmdToUtcDate(value);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return formatUtcDateToYmd(cursor);
}

function diffCalendarDays(laterYmd: string, earlierYmd: string): number {
  const later = parseYmdToUtcDate(laterYmd);
  const earlier = parseYmdToUtcDate(earlierYmd);
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function expectedLatestDateForSource(sourceKey: string, now = new Date()): string {
  const { ymd: todayYmd, hour } = formatDateInTimezone(now);
  const normalized = String(sourceKey || "").trim().toLowerCase();

  if (MANUAL_MORNING_SOURCE_KEYS.has(normalized)) {
    const todayUtc = parseYmdToUtcDate(todayYmd);
    const weekday = todayUtc.getUTCDay();
    if (weekday === 0 || weekday === 6) {
      return previousBusinessDay(todayYmd);
    }
    if (hour < 8) {
      return previousBusinessDay(todayYmd);
    }
    return todayYmd;
  }

  const yesterday = parseYmdToUtcDate(todayYmd);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return formatUtcDateToYmd(yesterday);
}

function evaluateSourceFreshness(
  sourceKey: string,
  latestDate: string | null,
  now = new Date(),
  cadenceKey: AdvisoryCadenceKey | null = null,
) {
  const expectedLatestDate = expectedLatestDateForSource(sourceKey, now);
  if (!latestDate) {
    return {
      expected_latest_date: expectedLatestDate,
      age_days: null,
      business_lag_days: null,
      freshness_status: "missing" as const,
    };
  }

  const latestYmd = latestDate.slice(0, 10);
  const ageDays = diffCalendarDays(formatDateInTimezone(now).ymd, latestYmd);
  const normalizedCadence = cadenceKey ?? null;

  if (normalizedCadence === "weekly_manual") {
    let freshnessStatus: AdvisoryFreshnessStatus = "fresh";
    if (ageDays >= 11) freshnessStatus = "stale";
    else if (ageDays >= 8) freshnessStatus = "warning";
    return {
      expected_latest_date: expectedLatestDate,
      age_days: ageDays,
      business_lag_days: null,
      freshness_status: freshnessStatus,
    };
  }

  if (normalizedCadence === "weekly_automated") {
    let freshnessStatus: AdvisoryFreshnessStatus = "fresh";
    if (ageDays >= 10) freshnessStatus = "stale";
    else if (ageDays >= 7) freshnessStatus = "warning";
    return {
      expected_latest_date: expectedLatestDate,
      age_days: ageDays,
      business_lag_days: null,
      freshness_status: freshnessStatus,
    };
  }

  if (normalizedCadence === "targeted_manual") {
    let freshnessStatus: AdvisoryFreshnessStatus = "fresh";
    if (ageDays >= 30) freshnessStatus = "stale";
    else if (ageDays >= 14) freshnessStatus = "warning";
    return {
      expected_latest_date: expectedLatestDate,
      age_days: ageDays,
      business_lag_days: null,
      freshness_status: freshnessStatus,
    };
  }

  if (MANUAL_MORNING_SOURCE_KEYS.has(String(sourceKey || "").trim().toLowerCase())) {
    const lagDays = Math.max(0, diffCalendarDays(expectedLatestDate, latestYmd));
    let freshnessStatus: "fresh" | "warning" | "stale" = "fresh";
    if (lagDays === 1) freshnessStatus = "warning";
    if (lagDays >= 2) freshnessStatus = "stale";
    return {
      expected_latest_date: expectedLatestDate,
      age_days: ageDays,
      business_lag_days: lagDays,
      freshness_status: freshnessStatus,
    };
  }

  let freshnessStatus: "fresh" | "warning" | "stale" = "fresh";
  if (ageDays >= 5) freshnessStatus = "stale";
  else if (ageDays >= 3) freshnessStatus = "warning";

  return {
    expected_latest_date: expectedLatestDate,
    age_days: ageDays,
    business_lag_days: null,
    freshness_status: freshnessStatus,
  };
}

function inferCollectionReason(status: string, row: { error_message: string | null; notes: string | null }) {
  const detail = `${row.error_message ?? ""} ${row.notes ?? ""}`.toLowerCase();
  if (status === "completed") return "closed";
  if (status === "retry_scheduled") return "retry_pending";
  if (status === "in_progress") return "still_running";
  if (status === "partial") return "partial_results";
  if (status === "failed" || status === "blocked") {
    if (detail.includes("auth") || detail.includes("credential") || detail.includes("token")) return "auth_issue";
    if (detail.includes("rate") || detail.includes("429")) return "rate_limited";
    if (detail.includes("manual") || detail.includes("file") || detail.includes("csv")) return "manual_dependency";
    return "blocked";
  }
  if (status === "exhausted") return "retry_window_exhausted";
  return "pending_review";
}

function formatChicagoCutoff(now = new Date()) {
  const dateText = new Intl.DateTimeFormat("en-US", {
    timeZone: LOCAL_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(now);
  return `${dateText} 8:00 AM ${LOCAL_TIMEZONE}`;
}

async function safeQueryLatestDate(
  db: D1Database,
  table: string,
  dateCol: string,
): Promise<string | null> {
  try {
    const row = await queryFirst<{ latest: string | null }>(
      db,
      `SELECT MAX(${dateCol}) AS latest FROM ${table}`
    );
    return row?.latest ?? null;
  } catch {
    return null;
  }
}

async function safeQueryFirstValue<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  fallback: T,
): Promise<T> {
  try {
    return (await queryFirst<T>(db, sql, params)) ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeQueryAllValues<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    return await queryAll<T>(db, sql, params);
  } catch {
    return [];
  }
}

/** GET /status — full health snapshot */
health.get("/status", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // 1. Community list
  const communities = await queryAll<{ id: string; name: string }>(
    db,
    `SELECT id, name FROM communities WHERE deleted_at IS NULL AND ga4_property_id IS NOT NULL ORDER BY name ASC`
  );

  // 2. Per-table stats: row count, latest date, distinct weeks, community coverage for latest week
  const tableStats: Record<string, {
    key: string;
    label: string;
    row_count: number;
    latest_date: string | null;
    distinct_weeks: number;
    latest_coverage: number;
  }> = {};

  for (const src of DATA_SOURCES) {
    const countResult = await safeQueryFirstValue<{ cnt: number }>(
      db, `SELECT COUNT(*) as cnt FROM ${src.table}`
      ,
      [],
      { cnt: 0 }
    );
    const latestResult = await safeQueryFirstValue<{ latest: string | null }>(
      db, `SELECT MAX(${src.dateCol}) as latest FROM ${src.table}`
      ,
      [],
      { latest: null }
    );
    const weeksResult = await safeQueryFirstValue<{ cnt: number }>(
      db, `SELECT COUNT(DISTINCT ${src.dateCol}) as cnt FROM ${src.table}`
      ,
      [],
      { cnt: 0 }
    );

    // Coverage for latest week
    let latestCoverage = 0;
    if (latestResult?.latest) {
      // For t7/t30, only count 'community' type rows
      const typeFilter = (src.key === "t7" || src.key === "t30")
        ? ` AND type = 'community'`
        : "";
      const coverageResult = await safeQueryFirstValue<{ cnt: number }>(
        db,
        `SELECT COUNT(DISTINCT community_id) as cnt FROM ${src.table} WHERE ${src.dateCol} = ?${typeFilter}`,
        [latestResult.latest],
        { cnt: 0 }
      );
      latestCoverage = coverageResult?.cnt ?? 0;
    }

    tableStats[src.key] = {
      key: src.key,
      label: src.label,
      row_count: countResult?.cnt ?? 0,
      latest_date: latestResult?.latest ?? null,
      distinct_weeks: weeksResult?.cnt ?? 0,
      latest_coverage: latestCoverage,
    };
  }

  // 3. Coverage matrix: for the latest week of each source, which communities have data?
  // Build a compact matrix: community_id -> { source_key: boolean }
  const matrix: { community_id: string; community_name: string; sources: Record<string, boolean> }[] = [];

  // Gather community IDs that have data in latest week per source
  const coverageSets: Record<string, Set<string>> = {};
  for (const src of DATA_SOURCES) {
    const latest = tableStats[src.key].latest_date;
    if (!latest) {
      coverageSets[src.key] = new Set();
      continue;
    }
    const typeFilter = (src.key === "t7" || src.key === "t30")
      ? ` AND type = 'community'`
      : "";
    const rows = await safeQueryAllValues<{ community_id: string }>(
      db,
      `SELECT DISTINCT community_id FROM ${src.table} WHERE ${src.dateCol} = ?${typeFilter}`,
      [latest]
    );
    coverageSets[src.key] = new Set(rows.map((r) => r.community_id));
  }

  for (const comm of communities) {
    const sources: Record<string, boolean> = {};
    for (const src of DATA_SOURCES) {
      sources[src.key] = coverageSets[src.key].has(comm.id);
    }
    matrix.push({ community_id: comm.id, community_name: comm.name, sources });
  }

  // 4. Overall health score: percentage of (communities × sources) cells that are filled
  const totalCells = communities.length * DATA_SOURCES.length;
  let filledCells = 0;
  for (const row of matrix) {
    for (const src of DATA_SOURCES) {
      if (row.sources[src.key]) filledCells++;
    }
  }
  const healthScore = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  // 5. Communities table count
  const communityCount = communities.length;

  // 6. Actual source freshness from canonical DB (pushed by sync script)
  const sourceFreshness = await safeQueryAllValues<{
    source_key: string;
    source_label: string;
    latest_date: string | null;
    row_count: number;
    property_count: number;
    updated_at: string;
  }>(db, `SELECT * FROM data_freshness ORDER BY latest_date DESC`);
  const enrichedSourceFreshness = sourceFreshness.map((src) => ({
    ...src,
    ...evaluateSourceFreshness(src.source_key, src.latest_date),
  }));

  // 7. Integrity summary from canonical monitoring tables pushed into D1 mirror
  const collectionFailures = await safeQueryAllValues<{
    data_source: string;
    status: string;
    error_message: string | null;
    properties_total: number | null;
    properties_failed: number | null;
    started_at: string;
  }>(
    db,
    `SELECT data_source, status, error_message, properties_total, properties_failed, started_at
     FROM data_collections
     WHERE DATE(started_at) >= DATE('now', '-3 day')
       AND (status = 'failed' OR properties_failed > properties_total * 0.2)
     ORDER BY started_at DESC`
  );

  const coreFailures = collectionFailures.filter((row) => CORE_FAILURE_SOURCES.has(String(row.data_source || "").toLowerCase()));
  const specialtyFailures = collectionFailures.filter((row) => !CORE_FAILURE_SOURCES.has(String(row.data_source || "").toLowerCase()));

  const sourceIssueSummary = enrichedSourceFreshness.map((src) => ({
    source_key: src.source_key,
    source_label: src.source_label,
    age_days: src.age_days,
    business_lag_days: src.business_lag_days,
    expected_latest_date: src.expected_latest_date,
    status: src.freshness_status,
  }));
  const freshnessWarnings = sourceIssueSummary.filter((item) => item.status === "warning").length;
  const freshnessStale = sourceIssueSummary.filter((item) => item.status === "stale" || item.status === "missing").length;

  const topIssues = [
    ...coreFailures.slice(0, 3).map((row) => ({
      kind: "core_failure",
      source: row.data_source,
      message: row.error_message || `${row.data_source} collection failed`,
      timestamp: row.started_at,
    })),
    ...sourceIssueSummary
      .filter((item) => item.status !== "fresh")
      .slice(0, 3)
      .map((item) => ({
        kind: "freshness",
        source: item.source_key,
        message:
          item.status === "missing"
            ? `${item.source_label} has no data`
            : item.business_lag_days !== null
              ? `${item.source_label} is ${item.business_lag_days} business day(s) behind expected ${item.expected_latest_date}`
              : `${item.source_label} is ${item.age_days}d old`,
        timestamp: null,
      })),
  ].slice(0, 6);

  const dailyCollectionRows = await safeQueryAllValues<{
    data_source: string;
    status: string | null;
    properties_total: number | null;
    properties_success: number | null;
    properties_failed: number | null;
    properties_skipped: number | null;
    retry_attempts: number | null;
    rate_limit_hits: number | null;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    notes: string | null;
  }>(
    db,
    `SELECT
        data_source,
        status,
        properties_total,
        properties_success,
        properties_failed,
        properties_skipped,
        retry_attempts,
        rate_limit_hits,
        started_at,
        completed_at,
        error_message,
        notes
      FROM data_collections
      WHERE collection_date = DATE('now', 'localtime')
      ORDER BY started_at ASC, data_source ASC`
  );

  const dailyCollections = dailyCollectionRows.map((row) => {
    const normalizedStatus = String(row.status || "unknown").toLowerCase();
    const successCount = row.properties_success ?? 0;
    const failedCount = row.properties_failed ?? 0;
    const skippedCount = row.properties_skipped ?? 0;
    const totalCount = row.properties_total ?? Math.max(successCount + failedCount + skippedCount, 0);
    const remainingCount = Math.max(totalCount - successCount - failedCount - skippedCount, 0);

    return {
      source: row.data_source,
      status: normalizedStatus,
      success_count: successCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      total_count: totalCount,
      remaining_count: remainingCount,
      started_at: row.started_at,
      completed_at: row.completed_at,
      retry_attempts: row.retry_attempts ?? 0,
      rate_limit_hits: row.rate_limit_hits ?? 0,
      error_message: row.error_message,
      notes: row.notes,
    };
  });

  const dailyCollectionSummary = {
    sources_total: dailyCollections.length,
    sources_completed: dailyCollections.filter((row) => row.status === "completed").length,
    sources_active: dailyCollections.filter((row) => ACTIVE_COLLECTION_STATUSES.has(row.status)).length,
    sources_blocked: dailyCollections.filter((row) => BLOCKED_COLLECTION_STATUSES.has(row.status)).length,
    properties_expected: dailyCollections.reduce((sum, row) => sum + row.total_count, 0),
    properties_succeeded: dailyCollections.reduce((sum, row) => sum + row.success_count, 0),
    properties_failed: dailyCollections.reduce((sum, row) => sum + row.failed_count, 0),
    properties_remaining: dailyCollections.reduce((sum, row) => sum + row.remaining_count, 0),
  };

  const retryQueueRows = await safeQueryAllValues<{
    queue_id: number;
    collection_date: string;
    data_source: string;
    property_id: string | null;
    property_name: string | null;
    attempt_count: number | null;
    status: string | null;
    retry_disposition: string | null;
    last_error_type: string | null;
    last_error_message: string | null;
    next_attempt_at: string | null;
    retry_window_end: string | null;
    resolved_at: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>(
    db,
    `SELECT
        queue_id,
        collection_date,
        data_source,
        property_id,
        property_name,
        attempt_count,
        status,
        retry_disposition,
        last_error_type,
        last_error_message,
        next_attempt_at,
        retry_window_end,
        resolved_at,
        notes,
        created_at,
        updated_at
      FROM collection_retry_queue
      WHERE collection_date = DATE('now', 'localtime')
        AND status NOT IN ('resolved', 'exhausted')
      ORDER BY COALESCE(next_attempt_at, created_at) ASC, queue_id ASC
      LIMIT 30`
  );

  const retryQueueStatusCounts = retryQueueRows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status || "unknown").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const retryQueueDispositionCounts = retryQueueRows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.retry_disposition || "unknown").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const nextRetryAt = retryQueueRows
    .map((row) => row.next_attempt_at)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;

  const unresolvedSources = dailyCollections
    .filter((row) => row.status !== "completed")
    .map((row) => ({
      source: row.source,
      status: row.status,
      reason: inferCollectionReason(row.status, row),
    }));

  const advisoryLatestRunRows = await safeQueryAllValues<{ data_source: string; latest_collection_date: string | null }>(
    db,
    `SELECT data_source, MAX(collection_date) AS latest_collection_date
     FROM data_collections
     WHERE data_source IN (${Object.keys(ADVISORY_SOURCE_POLICIES).map(() => "?").join(", ")})
     GROUP BY data_source`,
    Object.keys(ADVISORY_SOURCE_POLICIES)
  );
  const advisoryLatestRunDateBySource = new Map(
    advisoryLatestRunRows.map((row) => [String(row.data_source || "").toLowerCase(), row.latest_collection_date ?? null])
  );

  const advisoryLatestDataDateBySource = new Map<string, string | null>();
  for (const [source, policy] of Object.entries(ADVISORY_SOURCE_POLICIES)) {
    const queryDef = policy.latestDataQuery;
    if (!queryDef) {
      advisoryLatestDataDateBySource.set(source, null);
      continue;
    }
    advisoryLatestDataDateBySource.set(
      source,
      await safeQueryLatestDate(db, queryDef.table, queryDef.dateCol)
    );
  }

  const advisorySources = Array.from(
    new Set([
      ...Object.keys(ADVISORY_SOURCE_POLICIES),
      ...dailyCollections
        .filter((row) => {
          const normalized = String(row.source || "").toLowerCase();
          return !CORE_FAILURE_SOURCES.has(normalized) || normalized in ADVISORY_SOURCE_POLICIES;
        })
        .map((row) => String(row.source || "").toLowerCase())
        .filter(Boolean),
    ])
  ).map((source) => {
    const policy = ADVISORY_SOURCE_POLICIES[source] ?? {
      cadence_key: "targeted_manual" as const,
      cadence_label: "Targeted manual audit",
    };
    const todayRow = dailyCollections.find((row) => String(row.source || "").toLowerCase() === source);
    const latestRecordedDate =
      advisoryLatestDataDateBySource.get(source) ??
      advisoryLatestRunDateBySource.get(source) ??
      null;
    const freshness = evaluateSourceFreshness(source, latestRecordedDate, new Date(), policy.cadence_key);

    return {
      source,
      status: todayRow?.status ?? (latestRecordedDate ? "historical" : "missing"),
      run_recorded: Boolean(todayRow?.started_at || todayRow?.completed_at),
      latest_recorded_date: latestRecordedDate,
      expected_latest_date: freshness.expected_latest_date,
      freshness_status: freshness.freshness_status,
      cadence_key: policy.cadence_key,
      cadence_label: policy.cadence_label,
    };
  });

  const hasBlockedSources = unresolvedSources.some((row) => BLOCKED_COLLECTION_STATUSES.has(row.status));
  const hasActiveSources = unresolvedSources.some((row) => ACTIVE_COLLECTION_STATUSES.has(row.status));
  const dailyCollectionClosure = {
    state:
      dailyCollectionSummary.sources_total === 0
        ? "not_started"
        : unresolvedSources.length === 0
          ? "complete"
          : hasBlockedSources && !hasActiveSources
            ? "blocked"
            : "open",
    summary_reason:
      dailyCollectionSummary.sources_total === 0
        ? "no_runs_recorded"
        : unresolvedSources.length === 0
          ? "all_visible_sources_closed"
          : hasBlockedSources && !hasActiveSources
            ? "visible_sources_blocked"
            : "visible_sources_still_open",
    cutoff_at_local: formatChicagoCutoff(),
    next_retry_at: nextRetryAt,
    queue_depth: retryQueueRows.length,
    unresolved_sources: unresolvedSources,
    advisory_sources: advisorySources,
  };

  const collectionHistory = await safeQueryAllValues<{
    collection_date: string;
    sources_total: number;
    sources_completed: number;
    sources_active: number;
    sources_blocked: number;
    properties_expected: number;
    properties_succeeded: number;
    properties_failed: number;
    retry_attempts: number;
    rate_limit_hits: number;
  }>(
    db,
    `SELECT
        collection_date,
        COUNT(*) as sources_total,
        SUM(CASE WHEN LOWER(COALESCE(status, 'unknown')) = 'completed' THEN 1 ELSE 0 END) as sources_completed,
        SUM(CASE WHEN LOWER(COALESCE(status, 'unknown')) IN ('in_progress', 'partial', 'retry_scheduled') THEN 1 ELSE 0 END) as sources_active,
        SUM(CASE WHEN LOWER(COALESCE(status, 'unknown')) IN ('blocked', 'failed', 'exhausted') THEN 1 ELSE 0 END) as sources_blocked,
        SUM(COALESCE(properties_total, 0)) as properties_expected,
        SUM(COALESCE(properties_success, 0)) as properties_succeeded,
        SUM(COALESCE(properties_failed, 0)) as properties_failed,
        SUM(COALESCE(retry_attempts, 0)) as retry_attempts,
        SUM(COALESCE(rate_limit_hits, 0)) as rate_limit_hits
      FROM data_collections
      WHERE collection_date >= DATE('now', 'localtime', '-6 day')
      GROUP BY collection_date
      ORDER BY collection_date ASC`
  );

  const sourceCoverageHistory = await Promise.all(
    DATA_SOURCES.map(async (src) => {
      const whereClause = src.key === "t7" || src.key === "t30"
        ? `WHERE ${src.dateCol} IS NOT NULL AND type = 'community'`
        : `WHERE ${src.dateCol} IS NOT NULL`;
      const points = await safeQueryAllValues<{ bucket_date: string; coverage: number }>(
        db,
        `SELECT
            ${src.dateCol} as bucket_date,
            COUNT(DISTINCT community_id) as coverage
          FROM ${src.table}
          ${whereClause}
          GROUP BY ${src.dateCol}
          ORDER BY ${src.dateCol} DESC
          LIMIT 6`
      );

      return {
        source_key: src.key as DataSourceKey,
        source_label: src.label,
        points: [...points]
          .reverse()
          .map((point) => ({
            date: point.bucket_date,
            coverage: point.coverage,
            coverage_pct: communityCount > 0 ? Math.round((point.coverage / communityCount) * 100) : 0,
          })),
      };
    })
  );

  const sourceTimelineRows = await safeQueryAllValues<{
    collection_date: string;
    data_source: string;
    status: string | null;
    properties_total: number | null;
    properties_success: number | null;
    properties_failed: number | null;
    retry_attempts: number | null;
    rate_limit_hits: number | null;
  }>(
    db,
    `SELECT
        collection_date,
        data_source,
        status,
        properties_total,
        properties_success,
        properties_failed,
        retry_attempts,
        rate_limit_hits
      FROM data_collections
      WHERE collection_date >= DATE('now', 'localtime', '-6 day')
      ORDER BY data_source ASC, collection_date ASC`
  );

  const sourceTimelineMap = new Map<string, {
    source: string;
    points: {
      collection_date: string;
      status: string;
      success_count: number;
      failed_count: number;
      total_count: number;
      retry_attempts: number;
      rate_limit_hits: number;
    }[];
  }>();

  for (const row of sourceTimelineRows) {
    const source = String(row.data_source || "").toLowerCase();
    if (!source) continue;
    if (!sourceTimelineMap.has(source)) {
      sourceTimelineMap.set(source, { source, points: [] });
    }
    const successCount = row.properties_success ?? 0;
    const failedCount = row.properties_failed ?? 0;
    const totalCount = row.properties_total ?? Math.max(successCount + failedCount, 0);
    sourceTimelineMap.get(source)?.points.push({
      collection_date: row.collection_date,
      status: String(row.status || "unknown").toLowerCase(),
      success_count: successCount,
      failed_count: failedCount,
      total_count: totalCount,
      retry_attempts: row.retry_attempts ?? 0,
      rate_limit_hits: row.rate_limit_hits ?? 0,
    });
  }

  const sourceTimelines = [...sourceTimelineMap.values()]
    .map((entry) => ({
      ...entry,
      points: entry.points.slice(-7),
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  const guestCardDirect = await safeQueryFirstValue<{
    latest_date: string | null;
    row_count: number;
    property_count: number;
    guest_cards: number;
    online_apps: number;
    advisory_quotes: number;
    advisory_pipeline_apps: number;
    advisory_tours: number;
  }>(
    db,
    `SELECT
        MAX(run_date) AS latest_date,
        COUNT(*) AS row_count,
        COUNT(DISTINCT property_code) AS property_count,
        SUM(COALESCE(gc_this_period, 0)) AS guest_cards,
        SUM(COALESCE(apps_this_period, 0)) AS online_apps,
        SUM(COALESCE(quotes_this_period, 0)) AS advisory_quotes,
        SUM(COALESCE(pipe_apps_this_period, 0)) AS advisory_pipeline_apps,
        SUM(COALESCE(ipt_appt_this_period, 0) + COALESCE(sgt_appt_this_period, 0)) AS advisory_tours
      FROM guest_card_metrics_dw_direct`,
    [],
    {
      latest_date: null,
      row_count: 0,
      property_count: 0,
      guest_cards: 0,
      online_apps: 0,
      advisory_quotes: 0,
      advisory_pipeline_apps: 0,
      advisory_tours: 0,
    }
  );

  const operatingMetrics = await safeQueryFirstValue<{
    latest_date: string | null;
    row_count: number;
    property_count: number;
    occupied_units: number;
    total_units: number;
    avg_occupancy_rate: number | null;
    avg_leased_rate: number | null;
    leases_count: number;
    move_ins_count: number;
    move_outs_count: number;
    cancellations_count: number;
    denials_count: number;
  }>(
    db,
    `SELECT
        MAX(metric_date) AS latest_date,
        COUNT(*) AS row_count,
        COUNT(DISTINCT property_id) AS property_count,
        SUM(COALESCE(occupied_units, 0)) AS occupied_units,
        SUM(COALESCE(total_units, 0)) AS total_units,
        AVG(occupancy_rate) AS avg_occupancy_rate,
        AVG(leased_rate) AS avg_leased_rate,
        SUM(COALESCE(leases_count, 0)) AS leases_count,
        SUM(COALESCE(move_ins_count, 0)) AS move_ins_count,
        SUM(COALESCE(move_outs_count, 0)) AS move_outs_count,
        SUM(COALESCE(cancellations_count, 0)) AS cancellations_count,
        SUM(COALESCE(denials_count, 0)) AS denials_count
      FROM property_operating_metrics
      WHERE source_system = 'data_warehouse.leasingstatistics_daily_bv'`,
    [],
    {
      latest_date: null,
      row_count: 0,
      property_count: 0,
      occupied_units: 0,
      total_units: 0,
      avg_occupancy_rate: null,
      avg_leased_rate: null,
      leases_count: 0,
      move_ins_count: 0,
      move_outs_count: 0,
      cancellations_count: 0,
      denials_count: 0,
    }
  );

  const propertyMetadataDirect = await safeQueryFirstValue<{
    row_count: number;
    property_count: number;
    latest_supplied_at: string | null;
  }>(
    db,
    `SELECT
        COUNT(*) AS row_count,
        COUNT(DISTINCT property_code) AS property_count,
        MAX(supplied_at) AS latest_supplied_at
      FROM property_metadata_dw_direct`,
    [],
    { row_count: 0, property_count: 0, latest_supplied_at: null }
  );

  const operatingCollection = await safeQueryFirstValue<{
    collection_date: string | null;
    status: string | null;
    properties_total: number | null;
    properties_success: number | null;
    properties_failed: number | null;
    notes: string | null;
    completed_at: string | null;
  }>(
    db,
    `SELECT collection_date, status, properties_total, properties_success, properties_failed, notes, completed_at
     FROM data_collections
     WHERE data_source = 'property_operating_metrics'
     ORDER BY collection_date DESC, completed_at DESC
     LIMIT 1`,
    [],
    {
      collection_date: null,
      status: null,
      properties_total: null,
      properties_success: null,
      properties_failed: null,
      notes: null,
      completed_at: null,
    }
  );

  return c.json({
    community_count: communityCount,
    health_score: healthScore,
    filled_cells: filledCells,
    total_cells: totalCells,
    table_stats: Object.values(tableStats),
    source_freshness: enrichedSourceFreshness,
    coverage_matrix: matrix,
    data_sources: DATA_SOURCES.map((s) => ({ key: s.key, label: s.label })),
    integrity_summary: {
      core_failure_sources: coreFailures.length,
      specialty_failure_sources: specialtyFailures.length,
      freshness_warning_sources: freshnessWarnings,
      freshness_stale_sources: freshnessStale,
      top_issues: topIssues,
    },
    daily_collection_status: {
      summary: dailyCollectionSummary,
      closure: dailyCollectionClosure,
      sources: dailyCollections,
    },
    data_warehouse_replacements: {
      trust_posture: "validation_first",
      guest_card_direct: {
        ...guestCardDirect,
        canonical_apply_mode: "explicit_trusted_core_only",
        advisory_fields: ["quotes", "pipeline_apps", "tours"],
      },
      property_operating_metrics: {
        ...operatingMetrics,
        collection: operatingCollection,
        source_system: "data_warehouse.leasingstatistics_daily_bv",
        governed_exclusion_count: 4,
        governed_exclusion_codes: ["FL4CA", "FL4P9", "TX4FP", "TX4PW"],
      },
      property_metadata_direct: {
        ...propertyMetadataDirect,
        source_system: "data_warehouse.property_bv",
        latest_matrix_delta_count: 10,
      },
    },
    telemetry: {
      collection_history: collectionHistory,
      source_coverage_history: sourceCoverageHistory,
      source_timelines: sourceTimelines,
      retry_queue: {
        queue_depth: retryQueueRows.length,
        by_status: retryQueueStatusCounts,
        by_disposition: retryQueueDispositionCounts,
        items: retryQueueRows.map((row) => ({
          queue_id: row.queue_id,
          collection_date: row.collection_date,
          data_source: row.data_source,
          property_id: row.property_id,
          property_name: row.property_name,
          attempt_count: row.attempt_count ?? 0,
          status: String(row.status || "unknown").toLowerCase(),
          retry_disposition: String(row.retry_disposition || "unknown").toLowerCase(),
          last_error_type: row.last_error_type,
          last_error_message: row.last_error_message,
          next_attempt_at: row.next_attempt_at,
          retry_window_end: row.retry_window_end,
          resolved_at: row.resolved_at,
          notes: row.notes,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      },
    },
  });
});

export { health };
