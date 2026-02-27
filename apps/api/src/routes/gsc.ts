/**
 * GSC Portfolio Snapshot — portfolio-wide Google Search Console performance.
 *
 * Mirrors the Python report logic exactly:
 *   - trailing 30 days from MAX(metric_date) in gsc_daily_metrics
 *   - previous 30-day window for deltas
 *   - CTR = clicks / impressions * 100
 *   - grades: <3% needs improvement, 3-5% good, >5% excellent
 *   - filter: clicks > 0, sort by clicks DESC
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";

const gsc = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
gsc.use("*", requireAuth);

interface AggRow {
  community_id: string;
  name: string;
  clicks: number;
  impressions: number;
  prev_clicks: number;
  prev_impressions: number;
}

/** GET / — full portfolio GSC snapshot with 30-day trailing window + deltas */
gsc.get("/", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // 1. Find the latest date in gsc_daily_metrics
  const maxRow = await queryFirst<{ d: string }>(
    db,
    `SELECT MAX(metric_date) AS d FROM gsc_daily_metrics`
  );
  if (!maxRow?.d) {
    return c.json({ current_start: null, current_end: null, prev_start: null, prev_end: null, portfolio: null, grades: null, properties: [] });
  }

  const maxDate = maxRow.d; // e.g. "2026-02-23"

  // 2. Compute date windows (matching Python: cur_start = max_date - 29 days)
  const curEnd = maxDate;
  const curStart = dateOffset(maxDate, -29);
  const prevEnd = dateOffset(curStart, -1);
  const prevStart = dateOffset(prevEnd, -29);

  // 3. Aggregate current + previous per community
  const rows = await queryAll<AggRow>(
    db,
    `WITH cur AS (
       SELECT community_id,
              SUM(clicks) AS clicks,
              SUM(impressions) AS impressions
       FROM gsc_daily_metrics
       WHERE metric_date BETWEEN ? AND ?
       GROUP BY community_id
     ),
     prev AS (
       SELECT community_id,
              SUM(clicks) AS clicks,
              SUM(impressions) AS impressions
       FROM gsc_daily_metrics
       WHERE metric_date BETWEEN ? AND ?
       GROUP BY community_id
     )
     SELECT cur.community_id,
            c.name,
            cur.clicks,
            cur.impressions,
            COALESCE(prev.clicks, 0) AS prev_clicks,
            COALESCE(prev.impressions, 0) AS prev_impressions
     FROM cur
     LEFT JOIN prev ON prev.community_id = cur.community_id
     JOIN communities c ON c.id = cur.community_id
     WHERE cur.clicks > 0
     ORDER BY cur.clicks DESC, cur.impressions DESC`,
    [curStart, curEnd, prevStart, prevEnd]
  );

  // 4. Compute per-property CTR + deltas
  const properties = rows.map((r, i) => {
    const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    const prevCtr = r.prev_impressions > 0 ? (r.prev_clicks / r.prev_impressions) * 100 : 0;
    return {
      rank: i + 1,
      community_id: r.community_id,
      name: r.name,
      clicks: r.clicks,
      clicks_delta: r.clicks - r.prev_clicks,
      impressions: r.impressions,
      impressions_delta: r.impressions - r.prev_impressions,
      ctr: round2(ctr),
      ctr_delta: round2(ctr - prevCtr),
    };
  });

  // 5. Portfolio totals
  const totalClicks = properties.reduce((s, p) => s + p.clicks, 0);
  const totalImpressions = properties.reduce((s, p) => s + p.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const prevClicks = rows.reduce((s, r) => s + r.prev_clicks, 0);
  const prevImpressions = rows.reduce((s, r) => s + r.prev_impressions, 0);
  const prevAvgCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;

  const clicksPct = prevClicks > 0 ? ((totalClicks - prevClicks) / prevClicks) * 100 : (totalClicks > 0 ? 100 : 0);
  const impressionsPct = prevImpressions > 0 ? ((totalImpressions - prevImpressions) / prevImpressions) * 100 : (totalImpressions > 0 ? 100 : 0);

  // 6. Grade breakdown (CTR-based, matching Python thresholds)
  let excellent = 0, good = 0, needsImprovement = 0;
  for (const p of properties) {
    if (p.ctr > 5) excellent++;
    else if (p.ctr >= 3) good++;
    else needsImprovement++;
  }

  return c.json({
    current_start: curStart,
    current_end: curEnd,
    prev_start: prevStart,
    prev_end: prevEnd,
    property_count: properties.length,
    portfolio: {
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      avg_ctr: round2(avgCtr),
      clicks_pct: round1(clicksPct),
      impressions_pct: round1(impressionsPct),
      ctr_delta: round2(avgCtr - prevAvgCtr),
    },
    grades: { excellent, good, needs_improvement: needsImprovement },
    properties,
  });
});

/** Offset an ISO date string by N days. */
function dateOffset(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

export { gsc };
