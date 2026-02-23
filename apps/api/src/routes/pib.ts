/**
 * PIB (Property Intelligence Brief) dashboard routes.
 *
 * Endpoints:
 *   GET /portfolio?week_date=YYYY-MM-DD  — portfolio rollup with all KPIs
 *   GET /weeks                           — available snapshot dates
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";
import { errJson } from "../lib/validate";

const pib = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
pib.use("*", requireAuth);

/** GET /weeks — available snapshot dates */
pib.get("/weeks", async (c) => {
  const db = c.env.POP_BRIEF_DB;
  const rows = await queryAll<{ snapshot_date: string }>(
    db,
    `SELECT DISTINCT snapshot_date FROM pib_ga4_metrics
     ORDER BY snapshot_date DESC LIMIT 20`
  );
  return c.json({ weeks: rows.map((r) => r.snapshot_date) });
});

/** GET /portfolio?week_date=YYYY-MM-DD — full portfolio rollup */
pib.get("/portfolio", async (c) => {
  const db = c.env.POP_BRIEF_DB;
  let weekDate = c.req.query("week_date");

  // Default to latest available snapshot
  if (!weekDate) {
    const latest = await queryFirst<{ snapshot_date: string }>(
      db,
      `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics`
    );
    weekDate = latest?.snapshot_date ?? null;
    if (!weekDate) {
      return c.json(errJson("NOT_FOUND", "No PIB data available"), 404);
    }
  }

  // Main query: join all PIB tables + marketing_data for each community
  const sql = `
    SELECT
      c.id              AS community_id,
      c.name            AS community_name,
      c.ga4_property_id,

      -- GA4 metrics
      g.total_sessions,
      g.total_users,
      g.new_users,
      g.organic_sessions,
      g.direct_sessions,
      g.paid_sessions,
      g.sessions_trend_pct,
      g.users_trend_pct,
      g.tour_clicks,
      g.phone_calls     AS ga4_phone_calls,
      g.apply_clicks,

      -- Site Performance
      sp.mobile_score,
      sp.desktop_score,

      -- Local Presence (GBP)
      lp.total_profile_views,
      lp.website_clicks  AS gbp_website_clicks,
      lp.phone_calls     AS gbp_phone_calls,
      lp.direction_requests,
      lp.action_rate     AS gbp_action_rate,
      lp.views_trend_pct AS gbp_views_trend_pct,
      lp.actions_trend_pct AS gbp_actions_trend_pct,

      -- Search Performance (GSC)
      srch.total_clicks  AS gsc_clicks,
      srch.total_impressions AS gsc_impressions,
      srch.avg_ctr       AS gsc_avg_ctr,
      srch.avg_position  AS gsc_avg_position,

      -- CIR
      cir.cir_value,
      cir.cir_status,
      cir.intent_events,
      cir.cir_trend_pct,

      -- Reviews
      rv.total_reviews,
      rv.avg_rating,
      rv.recent_30d_count AS recent_reviews,
      rv.avg_rating_trend,
      rv.sentiment_score,

      -- Marketing data (occupancy, ads, GC per door)
      md.occupancy,
      md.atr,
      md.google_ppc,
      md.google_remarketing,
      md.t30_community_gc_per_door AS gc_per_door,
      md.t7_serp_traffic AS serp_traffic

    FROM communities c
    LEFT JOIN pib_ga4_metrics g
      ON g.community_id = c.id AND g.snapshot_date = ?1
    LEFT JOIN pib_site_performance sp
      ON sp.community_id = c.id AND sp.snapshot_date = ?1
    LEFT JOIN pib_local_presence lp
      ON lp.community_id = c.id AND lp.snapshot_date = ?1
    LEFT JOIN pib_search_performance srch
      ON srch.community_id = c.id AND srch.snapshot_date = ?1
    LEFT JOIN pib_cir cir
      ON cir.community_id = c.id AND cir.snapshot_date = ?1
    LEFT JOIN pib_reviews rv
      ON rv.community_id = c.id AND rv.snapshot_date = ?1
    LEFT JOIN marketing_data md
      ON md.community_id = c.id AND md.week_date = ?1

    WHERE c.deleted_at IS NULL
      AND c.ga4_property_id IS NOT NULL
    ORDER BY c.name ASC
  `;

  const communities = await queryAll(db, sql, [weekDate]);

  // Compute portfolio summary aggregates
  let count = 0;
  let sumOcc = 0, cntOcc = 0;
  let sumCir = 0, cntCir = 0;
  let sumSessions = 0;
  let sumMobile = 0, cntMobile = 0;
  let sumRating = 0, cntRating = 0;
  let sumAdSpend = 0;
  let sumSessionsTrend = 0, cntSessionsTrend = 0;
  let sumCirTrend = 0, cntCirTrend = 0;

  for (const row of communities as any[]) {
    count++;
    if (row.occupancy != null) { sumOcc += row.occupancy; cntOcc++; }
    if (row.cir_value != null) { sumCir += row.cir_value; cntCir++; }
    if (row.total_sessions != null) sumSessions += row.total_sessions;
    if (row.mobile_score != null) { sumMobile += row.mobile_score; cntMobile++; }
    if (row.avg_rating != null) { sumRating += row.avg_rating; cntRating++; }
    if (row.google_ppc != null) sumAdSpend += row.google_ppc;
    if (row.google_remarketing != null) sumAdSpend += row.google_remarketing;
    if (row.sessions_trend_pct != null) { sumSessionsTrend += row.sessions_trend_pct; cntSessionsTrend++; }
    if (row.cir_trend_pct != null) { sumCirTrend += row.cir_trend_pct; cntCirTrend++; }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const summary = {
    week_date: weekDate,
    community_count: count,
    avg_occupancy: cntOcc ? round2(sumOcc / cntOcc) : null,
    avg_cir: cntCir ? round2(sumCir / cntCir) : null,
    total_sessions: sumSessions,
    avg_mobile_pagespeed: cntMobile ? round2(sumMobile / cntMobile) : null,
    avg_review_score: cntRating ? round2(sumRating / cntRating) : null,
    total_ad_spend: round2(sumAdSpend),
    avg_sessions_trend_pct: cntSessionsTrend ? round2(sumSessionsTrend / cntSessionsTrend) : null,
    avg_cir_trend_pct: cntCirTrend ? round2(sumCirTrend / cntCirTrend) : null,
  };

  return c.json({ summary, communities });
});

export { pib };
