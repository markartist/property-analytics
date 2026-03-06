/**
 * PIB (Property Intelligence Brief) dashboard routes.
 *
 * Endpoints:
 *   GET /portfolio?week_date=YYYY-MM-DD       — portfolio rollup with all KPIs
 *   GET /weeks                                — available snapshot dates
 *   GET /:communityId?week_date=YYYY-MM-DD    — single-property full detail
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";
import { errJson } from "../lib/validate";
import { sendEmail } from "../email/resend";

const pib = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
pib.use("*", requireAuth);

const PibReportBody = z.object({
  community_id: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  email: z.string().email().optional(),
});

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function daySpanInclusive(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00Z").getTime();
  const e = new Date(endIso + "T00:00:00Z").getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

function dateOffset(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtSigned(v: number | null, decimals = 0): string {
  if (v == null) return "n/a";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}`;
}

function buildPibEmailHtml(report: {
  property: string;
  current_start: string;
  current_end: string;
  previous_start: string;
  previous_end: string;
  sessions: { value: number | null; delta: number | null };
  gsc_clicks: { value: number | null; delta: number | null };
  cir: { value: number | null; delta: number | null; status: string | null };
  avg_rating: { value: number | null; delta: number | null };
  occupancy: { value: number | null; delta: number | null };
  ad_spend: { value: number | null; delta: number | null };
  action_rate: number | null;
}): string {
  const money = (v: number | null) => (v == null ? "$n/a" : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  const n0 = (v: number | null) => (v == null ? "n/a" : v.toLocaleString(undefined, { maximumFractionDigits: 0 }));
  const n2 = (v: number | null) => (v == null ? "n/a" : v.toFixed(2));
  const pct2 = (v: number | null) => (v == null ? "n/a" : `${v.toFixed(2)}%`);
  const status = report.cir.status ?? "unknown";

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:860px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
    <h1 style="margin:0;color:#0f172a;font-size:44px;line-height:1.05;font-weight:800;">Property Intelligence Brief</h1>
    <h2 style="margin:8px 0 4px 0;color:#1e293b;font-size:28px;">${report.property}</h2>
    <p style="margin:0 0 18px 0;color:#64748b;font-size:14px;">
      Current: ${report.current_start} to ${report.current_end} | Previous: ${report.previous_start} to ${report.previous_end}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>
        <td style="padding:12px;border:1px solid #dbe2ea;"><strong>Sessions</strong><br>${n0(report.sessions.value)} (${fmtSigned(report.sessions.delta)})</td>
        <td style="padding:12px;border:1px solid #dbe2ea;"><strong>GSC Clicks</strong><br>${n0(report.gsc_clicks.value)} (${fmtSigned(report.gsc_clicks.delta)})</td>
        <td style="padding:12px;border:1px solid #dbe2ea;"><strong>CIR</strong><br>${n2(report.cir.value)} (${fmtSigned(report.cir.delta, 2)})</td>
      </tr>
      <tr>
        <td style="padding:12px;border:1px solid #dbe2ea;"><strong>Avg Rating</strong><br>${n2(report.avg_rating.value)} (${fmtSigned(report.avg_rating.delta, 2)})</td>
        <td style="padding:12px;border:1px solid #dbe2ea;"><strong>Occupancy %</strong><br>${n2(report.occupancy.value)} (${fmtSigned(report.occupancy.delta, 2)})</td>
        <td style="padding:12px;border:1px solid #dbe2ea;"><strong>Ad Spend</strong><br>${money(report.ad_spend.value)} (${money(report.ad_spend.delta)})</td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;color:#334155;font-size:16px;">
      CIR Status: <strong>${status}</strong> | Action Rate: <strong>${pct2(report.action_rate)}</strong>
    </p>
  </div>
</body>
</html>`;
}

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

/** GET /:communityId?week_date=YYYY-MM-DD — single-property full PIB detail */
pib.get("/:communityId", async (c) => {
  const db = c.env.POP_BRIEF_DB;
  const communityId = c.req.param("communityId");
  let weekDate = c.req.query("week_date");

  // Default to latest available snapshot for this community
  if (!weekDate) {
    const latest = await queryFirst<{ snapshot_date: string }>(
      db,
      `SELECT MAX(snapshot_date) as snapshot_date FROM pib_ga4_metrics WHERE community_id = ?`,
      [communityId]
    );
    weekDate = latest?.snapshot_date ?? null;
    if (!weekDate) {
      return c.json(errJson("NOT_FOUND", "No PIB data for this community"), 404);
    }
  }

  // Community info
  const community = await queryFirst(
    db,
    `SELECT id, name, ga4_property_id, unit_count, full_url, city, state, region
     FROM communities WHERE id = ? AND deleted_at IS NULL`,
    [communityId]
  );
  if (!community) {
    return c.json(errJson("NOT_FOUND", "Community not found"), 404);
  }

  // GA4 metrics (full detail)
  const ga4 = await queryFirst(
    db,
    `SELECT * FROM pib_ga4_metrics WHERE community_id = ? AND snapshot_date = ?`,
    [communityId, weekDate]
  );

  // Site performance (full CWV)
  const sitePerf = await queryFirst(
    db,
    `SELECT * FROM pib_site_performance WHERE community_id = ? AND snapshot_date = ?`,
    [communityId, weekDate]
  );

  // Local presence (GBP)
  const localPresence = await queryFirst(
    db,
    `SELECT * FROM pib_local_presence WHERE community_id = ? AND snapshot_date = ?`,
    [communityId, weekDate]
  );

  // Search performance (GSC + keywords)
  const searchPerf = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM pib_search_performance WHERE community_id = ? AND snapshot_date = ?`,
    [communityId, weekDate]
  );
  // Parse JSON fields
  let topKeywords: unknown[] = [];
  if (searchPerf?.top_keywords_json) {
    try { topKeywords = JSON.parse(searchPerf.top_keywords_json as string); } catch {}
  }

  // CIR
  const cir = await queryFirst(
    db,
    `SELECT * FROM pib_cir WHERE community_id = ? AND snapshot_date = ?`,
    [communityId, weekDate]
  );

  // Reviews & sentiment
  const reviews = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT * FROM pib_reviews WHERE community_id = ? AND snapshot_date = ?`,
    [communityId, weekDate]
  );
  let themes: Record<string, number> = {};
  let criticalReviews: unknown[] = [];
  if (reviews?.themes_json) {
    try { themes = JSON.parse(reviews.themes_json as string); } catch {}
  }
  if (reviews?.critical_reviews_json) {
    try { criticalReviews = JSON.parse(reviews.critical_reviews_json as string); } catch {}
  }

  // Marketing data (occupancy, ads, GC per door)
  const marketing = await queryFirst(
    db,
    `SELECT * FROM marketing_data WHERE community_id = ? AND week_date = ?`,
    [communityId, weekDate]
  );

  // Ad keyword performance by unit type
  const adKeywordRows = await queryAll<Record<string, unknown>>(
    db,
    `SELECT * FROM ad_keyword_performance
     WHERE community_id = ? AND week_date = ?
     ORDER BY spend DESC`,
    [communityId, weekDate]
  );
  const adKeywords = adKeywordRows.map((row) => {
    let topKeywords: unknown[] = [];
    if (row.top_keywords_json) {
      try { topKeywords = JSON.parse(row.top_keywords_json as string); } catch {}
    }
    return {
      ...row,
      top_keywords_json: undefined,
      top_keywords: topKeywords,
    };
  });

  // T7 + T30 leasing metrics
  const t7 = await queryFirst(
    db,
    `SELECT * FROM t7_metrics WHERE community_id = ? AND week_date = ? AND type = 'community'`,
    [communityId, weekDate]
  );
  const t7Portfolio = await queryFirst(
    db,
    `SELECT * FROM t7_metrics WHERE community_id = ? AND week_date = ? AND type = 'portfolio'`,
    [communityId, weekDate]
  );
  const t30 = await queryFirst(
    db,
    `SELECT * FROM t30_metrics WHERE community_id = ? AND week_date = ? AND type = 'community'`,
    [communityId, weekDate]
  );
  const t30Portfolio = await queryFirst(
    db,
    `SELECT * FROM t30_metrics WHERE community_id = ? AND week_date = ? AND type = 'portfolio'`,
    [communityId, weekDate]
  );

  return c.json({
    week_date: weekDate,
    community,
    ga4: ga4 ?? null,
    site_performance: sitePerf ?? null,
    local_presence: localPresence ?? null,
    search_performance: searchPerf ? {
      ...searchPerf,
      top_keywords_json: undefined,
      top_keywords: topKeywords,
    } : null,
    cir: cir ?? null,
    reviews: reviews ? {
      ...reviews,
      themes_json: undefined,
      critical_reviews_json: undefined,
      themes,
      critical_reviews: criticalReviews,
    } : null,
    marketing: marketing ?? null,
    ad_keywords: adKeywords,
    leasing: {
      t7: t7 ?? null,
      t7_portfolio: t7Portfolio ?? null,
      t30: t30 ?? null,
      t30_portfolio: t30Portfolio ?? null,
    },
  });
});

/**
 * POST /report — single-property PIB report with configurable date window.
 */
pib.post("/report", async (c) => {
  const parsed = PibReportBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(errJson("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request"), 400);
  }
  const body = parsed.data;

  if (!isIsoDate(body.start_date) || !isIsoDate(body.end_date)) {
    return c.json(errJson("VALIDATION_ERROR", "Dates must be YYYY-MM-DD"), 400);
  }
  if (body.start_date > body.end_date) {
    return c.json(errJson("VALIDATION_ERROR", "start_date must be on or before end_date"), 400);
  }
  const span = daySpanInclusive(body.start_date, body.end_date);
  if (span < 1 || span > 370) {
    return c.json(errJson("VALIDATION_ERROR", "Date range must be between 1 and 370 days"), 400);
  }

  const prevEnd = dateOffset(body.start_date, -1);
  const prevStart = dateOffset(prevEnd, -(span - 1));
  const db = c.env.POP_BRIEF_DB;

  const currentSnap = await queryFirst<{ snapshot_date: string }>(
    db,
    `SELECT MAX(snapshot_date) AS snapshot_date
     FROM pib_ga4_metrics
     WHERE community_id = ? AND snapshot_date BETWEEN ? AND ?`,
    [body.community_id, body.start_date, body.end_date]
  );
  if (!currentSnap?.snapshot_date) {
    return c.json(errJson("NOT_FOUND", "No PIB snapshot found in selected date range"), 404);
  }

  let previousSnap = await queryFirst<{ snapshot_date: string }>(
    db,
    `SELECT MAX(snapshot_date) AS snapshot_date
     FROM pib_ga4_metrics
     WHERE community_id = ? AND snapshot_date BETWEEN ? AND ?`,
    [body.community_id, prevStart, prevEnd]
  );
  if (!previousSnap?.snapshot_date) {
    previousSnap = await queryFirst<{ snapshot_date: string }>(
      db,
      `SELECT MAX(snapshot_date) AS snapshot_date
       FROM pib_ga4_metrics
       WHERE community_id = ? AND snapshot_date < ?`,
      [body.community_id, body.start_date]
    );
  }

  const current = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT
       c.name AS community_name,
       g.total_sessions,
       srch.total_clicks AS gsc_clicks,
       cir.cir_value,
       cir.cir_status,
       rv.avg_rating,
       lp.action_rate AS gbp_action_rate,
       md.occupancy,
       md.google_ppc,
       md.google_remarketing
     FROM communities c
     LEFT JOIN pib_ga4_metrics g ON g.community_id = c.id AND g.snapshot_date = ?2
     LEFT JOIN pib_search_performance srch ON srch.community_id = c.id AND srch.snapshot_date = ?2
     LEFT JOIN pib_cir cir ON cir.community_id = c.id AND cir.snapshot_date = ?2
     LEFT JOIN pib_reviews rv ON rv.community_id = c.id AND rv.snapshot_date = ?2
     LEFT JOIN pib_local_presence lp ON lp.community_id = c.id AND lp.snapshot_date = ?2
     LEFT JOIN marketing_data md ON md.community_id = c.id AND md.week_date = ?2
     WHERE c.id = ?1 AND c.deleted_at IS NULL`,
    [body.community_id, currentSnap.snapshot_date]
  );

  if (!current) {
    return c.json(errJson("NOT_FOUND", "Community not found"), 404);
  }

  const previous = previousSnap?.snapshot_date
    ? await queryFirst<Record<string, unknown>>(
      db,
      `SELECT
         g.total_sessions,
         srch.total_clicks AS gsc_clicks,
         cir.cir_value,
         rv.avg_rating,
         md.occupancy,
         md.google_ppc,
         md.google_remarketing
       FROM pib_ga4_metrics g
       LEFT JOIN pib_search_performance srch ON srch.community_id = g.community_id AND srch.snapshot_date = g.snapshot_date
       LEFT JOIN pib_cir cir ON cir.community_id = g.community_id AND cir.snapshot_date = g.snapshot_date
       LEFT JOIN pib_reviews rv ON rv.community_id = g.community_id AND rv.snapshot_date = g.snapshot_date
       LEFT JOIN marketing_data md ON md.community_id = g.community_id AND md.week_date = g.snapshot_date
       WHERE g.community_id = ?1 AND g.snapshot_date = ?2`,
      [body.community_id, previousSnap.snapshot_date]
    )
    : null;

  const curAdSpend = (num(current.google_ppc) ?? 0) + (num(current.google_remarketing) ?? 0);
  const prevAdSpendRaw = previous ? ((num(previous.google_ppc) ?? 0) + (num(previous.google_remarketing) ?? 0)) : null;

  const report = {
    property: String(current.community_name ?? "Unknown Property"),
    current_start: body.start_date,
    current_end: body.end_date,
    previous_start: prevStart,
    previous_end: prevEnd,
    snapshot_date: currentSnap.snapshot_date,
    previous_snapshot_date: previousSnap?.snapshot_date ?? null,
    sessions: {
      value: num(current.total_sessions),
      delta: previous ? (num(current.total_sessions) ?? 0) - (num(previous.total_sessions) ?? 0) : null,
    },
    gsc_clicks: {
      value: num(current.gsc_clicks),
      delta: previous ? (num(current.gsc_clicks) ?? 0) - (num(previous.gsc_clicks) ?? 0) : null,
    },
    cir: {
      value: num(current.cir_value),
      delta: previous ? (num(current.cir_value) ?? 0) - (num(previous.cir_value) ?? 0) : null,
      status: (current.cir_status as string | null) ?? null,
    },
    avg_rating: {
      value: num(current.avg_rating),
      delta: previous ? (num(current.avg_rating) ?? 0) - (num(previous.avg_rating) ?? 0) : null,
    },
    occupancy: {
      value: num(current.occupancy),
      delta: previous ? (num(current.occupancy) ?? 0) - (num(previous.occupancy) ?? 0) : null,
    },
    ad_spend: {
      value: curAdSpend,
      delta: previous && prevAdSpendRaw != null ? curAdSpend - prevAdSpendRaw : null,
    },
    action_rate: num(current.gbp_action_rate),
  };

  const report_html = buildPibEmailHtml(report);

  let email_sent = false;
  let email_error: string | null = null;
  if (body.email) {
    if (c.env.ENABLE_EMAIL_SEND !== "true") {
      email_error = "Email sending disabled by environment flag";
    } else {
      const send = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
        to: body.email,
        subject: `Property Intelligence Brief: ${report.property} (${body.start_date} to ${body.end_date})`,
        html: report_html,
      });
      email_sent = send.ok;
      email_error = send.ok ? null : (send.error ?? "Failed to send email");
    }
  }

  return c.json({
    ...report,
    report_html,
    email_sent,
    email_error,
  });
});

export { pib };
