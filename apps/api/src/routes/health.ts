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
    const countResult = await queryFirst<{ cnt: number }>(
      db, `SELECT COUNT(*) as cnt FROM ${src.table}`
    );
    const latestResult = await queryFirst<{ latest: string }>(
      db, `SELECT MAX(${src.dateCol}) as latest FROM ${src.table}`
    );
    const weeksResult = await queryFirst<{ cnt: number }>(
      db, `SELECT COUNT(DISTINCT ${src.dateCol}) as cnt FROM ${src.table}`
    );

    // Coverage for latest week
    let latestCoverage = 0;
    if (latestResult?.latest) {
      // For t7/t30, only count 'community' type rows
      const typeFilter = (src.key === "t7" || src.key === "t30")
        ? ` AND type = 'community'`
        : "";
      const coverageResult = await queryFirst<{ cnt: number }>(
        db,
        `SELECT COUNT(DISTINCT community_id) as cnt FROM ${src.table} WHERE ${src.dateCol} = ?${typeFilter}`,
        [latestResult.latest]
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
    const rows = await queryAll<{ community_id: string }>(
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
  const sourceFreshness = await queryAll<{
    source_key: string;
    source_label: string;
    latest_date: string | null;
    row_count: number;
    property_count: number;
    updated_at: string;
  }>(db, `SELECT * FROM data_freshness ORDER BY latest_date DESC`);

  return c.json({
    community_count: communityCount,
    health_score: healthScore,
    filled_cells: filledCells,
    total_cells: totalCells,
    table_stats: Object.values(tableStats),
    source_freshness: sourceFreshness,
    coverage_matrix: matrix,
    data_sources: DATA_SOURCES.map((s) => ({ key: s.key, label: s.label })),
  });
});

export { health };
