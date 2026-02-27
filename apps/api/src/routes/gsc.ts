/**
 * GSC Portfolio Snapshot — portfolio-wide Google Search Console performance.
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";

const gsc = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
gsc.use("*", requireAuth);

interface PropertyRow {
  community_id: string;
  name: string;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
  prev_clicks: number | null;
  prev_impressions: number | null;
  prev_ctr: number | null;
  prev_position: number | null;
}

/** GET / — full portfolio GSC snapshot with deltas */
gsc.get("/", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // Latest two snapshot dates
  const dates = await queryAll<{ snapshot_date: string }>(
    db,
    `SELECT DISTINCT snapshot_date FROM pib_search_performance ORDER BY snapshot_date DESC LIMIT 2`
  );
  if (dates.length === 0) {
    return c.json({ snapshot_date: null, prev_date: null, portfolio: null, grades: null, properties: [] });
  }

  const currentDate = dates[0].snapshot_date;
  const prevDate = dates.length > 1 ? dates[1].snapshot_date : null;

  // All properties with current + previous period data
  const properties = await queryAll<PropertyRow>(
    db,
    `SELECT
       cur.community_id,
       c.name,
       cur.total_clicks,
       cur.total_impressions,
       cur.avg_ctr,
       cur.avg_position,
       prev.total_clicks   AS prev_clicks,
       prev.total_impressions AS prev_impressions,
       prev.avg_ctr         AS prev_ctr,
       prev.avg_position    AS prev_position
     FROM pib_search_performance cur
     JOIN communities c ON c.id = cur.community_id
     LEFT JOIN pib_search_performance prev
       ON prev.community_id = cur.community_id AND prev.snapshot_date = ?
     WHERE cur.snapshot_date = ?
     ORDER BY cur.total_clicks DESC`,
    [prevDate, currentDate]
  );

  // Portfolio totals
  const totalClicks = properties.reduce((s, p) => s + (p.total_clicks ?? 0), 0);
  const totalImpressions = properties.reduce((s, p) => s + (p.total_impressions ?? 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const prevClicks = properties.reduce((s, p) => s + (p.prev_clicks ?? 0), 0);
  const prevImpressions = properties.reduce((s, p) => s + (p.prev_impressions ?? 0), 0);
  const prevAvgCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;

  // Grade breakdown
  let excellent = 0, good = 0, needsImprovement = 0;
  for (const p of properties) {
    if (p.avg_ctr >= 5) excellent++;
    else if (p.avg_ctr >= 3) good++;
    else needsImprovement++;
  }

  // Build property list with deltas
  const ranked = properties.map((p, i) => ({
    rank: i + 1,
    community_id: p.community_id,
    name: p.name,
    clicks: p.total_clicks,
    clicks_delta: p.prev_clicks != null ? p.total_clicks - p.prev_clicks : null,
    impressions: p.total_impressions,
    impressions_delta: p.prev_impressions != null ? p.total_impressions - p.prev_impressions : null,
    avg_ctr: round2(p.avg_ctr),
    ctr_delta: p.prev_ctr != null ? round2(p.avg_ctr - p.prev_ctr) : null,
    avg_position: round1(p.avg_position),
    position_delta: p.prev_position != null ? round1(p.avg_position - p.prev_position) : null,
  }));

  return c.json({
    snapshot_date: currentDate,
    prev_date: prevDate,
    portfolio: {
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      avg_ctr: round2(avgCtr),
      clicks_delta: prevDate ? totalClicks - prevClicks : null,
      impressions_delta: prevDate ? totalImpressions - prevImpressions : null,
      ctr_delta: prevDate ? round2(avgCtr - prevAvgCtr) : null,
    },
    grades: { excellent, good, needs_improvement: needsImprovement },
    properties: ranked,
  });
});

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

export { gsc };
