/**
 * Data Pond routes — landing page insights and surface conditions.
 *
 * Endpoints:
 *   GET /insights  — "Catch of the Day" auto-generated insights from latest snapshot
 */

import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";

const pond = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
pond.use("*", requireAuth);

interface Insight {
  id: string;
  icon: "trending-up" | "trending-down" | "alert" | "trophy" | "zap" | "bar-chart";
  color: "green" | "amber" | "red" | "teal" | "blue";
  title: string;
  detail: string;
}

/** GET /insights — Catch of the Day */
pond.get("/insights", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // Get latest snapshot date
  const latest = await queryFirst<{ snapshot_date: string }>(
    db,
    `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics`
  );
  const weekDate = latest?.snapshot_date ?? null;
  if (!weekDate) {
    return c.json({ week_date: null, insights: [], surface: null });
  }

  // Get previous snapshot date
  const prev = await queryFirst<{ snapshot_date: string }>(
    db,
    `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics WHERE snapshot_date < ?`,
    [weekDate]
  );
  const prevDate = prev?.snapshot_date ?? null;

  const insights: Insight[] = [];

  // 1. Portfolio session trend
  const sessionAgg = await queryFirst<{ total: number; avg_trend: number; count: number }>(
    db,
    `SELECT SUM(total_sessions) as total, AVG(sessions_trend_pct) as avg_trend, COUNT(*) as count
     FROM pib_ga4_metrics WHERE snapshot_date = ?`,
    [weekDate]
  );
  if (sessionAgg && sessionAgg.avg_trend != null) {
    const dir = sessionAgg.avg_trend >= 0 ? "up" : "down";
    const abs = Math.abs(sessionAgg.avg_trend).toFixed(1);
    insights.push({
      id: "sessions-trend",
      icon: dir === "up" ? "trending-up" : "trending-down",
      color: dir === "up" ? "green" : "red",
      title: `Portfolio sessions ${dir} ${abs}%`,
      detail: `${sessionAgg.total?.toLocaleString() ?? 0} total sessions across ${sessionAgg.count} properties this period.`,
    });
  }

  // 2. CIR movers — count properties with improving CIR
  const cirImproved = await queryFirst<{ improved: number; total: number; avg_cir: number }>(
    db,
    `SELECT 
       SUM(CASE WHEN cir_trend_pct > 0 THEN 1 ELSE 0 END) as improved,
       COUNT(*) as total,
       AVG(cir_value) as avg_cir
     FROM pib_cir WHERE snapshot_date = ?`,
    [weekDate]
  );
  if (cirImproved && cirImproved.total > 0) {
    const pct = Math.round((cirImproved.improved / cirImproved.total) * 100);
    insights.push({
      id: "cir-movers",
      icon: "zap",
      color: pct >= 50 ? "green" : "amber",
      title: `${cirImproved.improved} of ${cirImproved.total} properties improved CIR`,
      detail: `Portfolio avg CIR is ${cirImproved.avg_cir?.toFixed(1) ?? "—"}%. ${pct}% of properties trending upward.`,
    });
  }

  // 3. Low occupancy alert
  const lowOcc = await queryAll<{ name: string; occupancy: number }>(
    db,
    `SELECT c.name, md.occupancy
     FROM marketing_data md
     JOIN communities c ON c.id = md.community_id
     WHERE md.week_date = ? AND md.occupancy < 90 AND md.occupancy IS NOT NULL
     ORDER BY md.occupancy ASC LIMIT 5`,
    [weekDate]
  );
  if (lowOcc.length > 0) {
    const names = lowOcc.slice(0, 3).map((r) => r.name).join(", ");
    const suffix = lowOcc.length > 3 ? ` +${lowOcc.length - 3} more` : "";
    insights.push({
      id: "low-occupancy",
      icon: "alert",
      color: "red",
      title: `${lowOcc.length} ${lowOcc.length === 1 ? "property" : "properties"} below 90% occupancy`,
      detail: `${names}${suffix}. Lowest: ${lowOcc[0].name} at ${lowOcc[0].occupancy.toFixed(1)}%.`,
    });
  }

  // 4. Top performer — best CIR this week
  const topCir = await queryFirst<{ name: string; cir_value: number; cir_status: string }>(
    db,
    `SELECT c.name, cir.cir_value, cir.cir_status
     FROM pib_cir cir
     JOIN communities c ON c.id = cir.community_id
     WHERE cir.snapshot_date = ? AND cir.cir_value IS NOT NULL
     ORDER BY cir.cir_value DESC LIMIT 1`,
    [weekDate]
  );
  if (topCir) {
    insights.push({
      id: "top-cir",
      icon: "trophy",
      color: "teal",
      title: `${topCir.name} leads CIR at ${topCir.cir_value.toFixed(1)}%`,
      detail: `Status: ${topCir.cir_status ?? "—"}. Highest conversion intent rate in the portfolio.`,
    });
  }

  // 5. Ad spend summary
  const adSpend = await queryFirst<{ total_ppc: number; total_rm: number; count: number }>(
    db,
    `SELECT SUM(COALESCE(google_ppc,0)) as total_ppc, SUM(COALESCE(google_remarketing,0)) as total_rm, COUNT(*) as count
     FROM marketing_data WHERE week_date = ?`,
    [weekDate]
  );
  if (adSpend && (adSpend.total_ppc + adSpend.total_rm) > 0) {
    const total = adSpend.total_ppc + adSpend.total_rm;
    insights.push({
      id: "ad-spend",
      icon: "bar-chart",
      color: "blue",
      title: `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} total ad spend`,
      detail: `PPC: $${adSpend.total_ppc.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Remarketing: $${adSpend.total_rm.toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${adSpend.count} properties.`,
    });
  }

  // Surface conditions
  const communityCount = await queryFirst<{ cnt: number }>(
    db,
    `SELECT COUNT(*) as cnt FROM communities WHERE deleted_at IS NULL AND ga4_property_id IS NOT NULL`
  );

  // Try actual source freshness first (from canonical DB sync), fall back to D1 table dates
  const sourceFreshness = await queryAll<{ source_key: string; latest_date: string }>(
    db, `SELECT source_key, latest_date FROM data_freshness`
  ).catch(() => [] as { source_key: string; latest_date: string }[]);

  let freshness: Record<string, string | null>;
  if (sourceFreshness.length > 0) {
    freshness = Object.fromEntries(sourceFreshness.map((r) => [r.source_key, r.latest_date]));
  } else {
    // Fallback to D1 table dates
    const tableFreshness = await queryAll<{ tbl: string; latest: string }>(
      db,
      `SELECT 'ga4' as tbl, MAX(snapshot_date) as latest FROM pib_ga4_metrics
       UNION ALL SELECT 'gsc', MAX(snapshot_date) FROM pib_search_performance
       UNION ALL SELECT 'marketing', MAX(week_date) FROM marketing_data`
    );
    freshness = Object.fromEntries(tableFreshness.map((r) => [r.tbl, r.latest]));
  }

  const surface = {
    latest_snapshot: weekDate,
    prev_snapshot: prevDate,
    community_count: communityCount?.cnt ?? 0,
    freshness,
  };

  return c.json({ week_date: weekDate, insights: insights.slice(0, 5), surface });
});

/** GET /dock-preview — lightweight headline metrics for the dock hub cards */
pond.get("/dock-preview", async (c) => {
  const db = c.env.POP_BRIEF_DB;

  // Latest snapshot date
  const latest = await queryFirst<{ snapshot_date: string }>(
    db, `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics`
  );
  const weekDate = latest?.snapshot_date ?? null;
  if (!weekDate) {
    return c.json({ week_date: null, pib: null, leasing: null, marketing: null, analysis: null });
  }

  // PIB metrics
  const pibAgg = await queryFirst<{ communities: number; avg_cir: number; total_sessions: number; avg_mobile: number; avg_rating: number }>(
    db,
    `SELECT
       COUNT(DISTINCT g.community_id) as communities,
       AVG(cir.cir_value) as avg_cir,
       SUM(g.total_sessions) as total_sessions,
       AVG(sp.mobile_score) as avg_mobile,
       AVG(rv.avg_rating) as avg_rating
     FROM pib_ga4_metrics g
     LEFT JOIN pib_cir cir ON cir.community_id = g.community_id AND cir.snapshot_date = g.snapshot_date
     LEFT JOIN pib_site_performance sp ON sp.community_id = g.community_id AND sp.snapshot_date = g.snapshot_date
     LEFT JOIN pib_reviews rv ON rv.community_id = g.community_id AND rv.snapshot_date = g.snapshot_date
     WHERE g.snapshot_date = ?`,
    [weekDate]
  );

  // Leasing
  const leasingAgg = await queryFirst<{ t7_communities: number; total_gc: number; avg_v_gc: number }>(
    db,
    `SELECT COUNT(DISTINCT community_id) as t7_communities, SUM(g_cards) as total_gc, AVG(v_gc_conv) as avg_v_gc
     FROM t7_metrics WHERE week_date = ? AND type = 'community'`,
    [weekDate]
  );

  // Marketing
  const mktAgg = await queryFirst<{ communities: number; avg_occ: number; total_ad_spend: number }>(
    db,
    `SELECT COUNT(*) as communities, AVG(occupancy) as avg_occ,
       SUM(COALESCE(google_ppc,0) + COALESCE(google_remarketing,0)) as total_ad_spend
     FROM marketing_data WHERE week_date = ?`,
    [weekDate]
  );

  return c.json({
    week_date: weekDate,
    pib: pibAgg ? {
      communities: pibAgg.communities,
      avg_cir: pibAgg.avg_cir != null ? Math.round(pibAgg.avg_cir * 10) / 10 : null,
      total_sessions: pibAgg.total_sessions,
      avg_mobile_score: pibAgg.avg_mobile != null ? Math.round(pibAgg.avg_mobile) : null,
      avg_rating: pibAgg.avg_rating != null ? Math.round(pibAgg.avg_rating * 100) / 100 : null,
    } : null,
    leasing: leasingAgg ? {
      communities: leasingAgg.t7_communities,
      total_guest_cards: leasingAgg.total_gc,
      avg_visit_conv: leasingAgg.avg_v_gc != null ? Math.round(leasingAgg.avg_v_gc * 10) / 10 : null,
    } : null,
    marketing: mktAgg ? {
      communities: mktAgg.communities,
      avg_occupancy: mktAgg.avg_occ != null ? Math.round(mktAgg.avg_occ * 10) / 10 : null,
      total_ad_spend: Math.round(mktAgg.total_ad_spend ?? 0),
    } : null,
  });
});

export { pond };
