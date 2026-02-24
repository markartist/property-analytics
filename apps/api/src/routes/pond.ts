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

  const tableFreshness = await queryAll<{ tbl: string; latest: string }>(
    db,
    `SELECT 'ga4' as tbl, MAX(snapshot_date) as latest FROM pib_ga4_metrics
     UNION ALL SELECT 'site_perf', MAX(snapshot_date) FROM pib_site_performance
     UNION ALL SELECT 'local_presence', MAX(snapshot_date) FROM pib_local_presence
     UNION ALL SELECT 'search', MAX(snapshot_date) FROM pib_search_performance
     UNION ALL SELECT 'cir', MAX(snapshot_date) FROM pib_cir
     UNION ALL SELECT 'reviews', MAX(snapshot_date) FROM pib_reviews
     UNION ALL SELECT 'marketing', MAX(week_date) FROM marketing_data
     UNION ALL SELECT 't7', MAX(week_date) FROM t7_metrics
     UNION ALL SELECT 't30', MAX(week_date) FROM t30_metrics`
  );

  const surface = {
    latest_snapshot: weekDate,
    prev_snapshot: prevDate,
    community_count: communityCount?.cnt ?? 0,
    freshness: Object.fromEntries(tableFreshness.map((r) => [r.tbl, r.latest])),
  };

  return c.json({ week_date: weekDate, insights: insights.slice(0, 5), surface });
});

export { pond };
