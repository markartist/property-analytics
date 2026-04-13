/**
 * GSC Snapshot + Report generation routes.
 */

import { Hono } from "hono";
import { z } from "zod";
import * as XLSX from "xlsx";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";
import { errJson } from "../lib/validate";
import { sendEmail } from "../email/resend";

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

const ReportBody = z.object({
  scope: z.enum(["portfolio", "property"]),
  community_id: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
  email: z.string().email().optional(),
});

function dateOffset(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daySpanInclusive(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00Z").getTime();
  const e = new Date(endIso + "T00:00:00Z").getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(out);
}

function buildEmailHtml(params: {
  currentStart: string;
  currentEnd: string;
  prevStart: string;
  prevEnd: string;
  propertyCount: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  clicksPct: number;
  impressionsPct: number;
  ctrDelta: number;
}): string {
  const c = params;
  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
    <h1 style="margin:0 0 6px 0;color:#0f172a;font-size:24px;">Portfolio Google Search Console Snapshot</h1>
    <p style="margin:0 0 16px 0;color:#64748b;font-size:12px;">
      Current: ${c.currentStart} to ${c.currentEnd} | Previous: ${c.prevStart} to ${c.prevEnd}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>
        <td style="padding:10px;border:1px solid #e2e8f0;"><strong>Total Clicks</strong><br>${c.totalClicks.toLocaleString()} (${c.clicksPct >= 0 ? "+" : ""}${c.clicksPct.toFixed(1)}%)</td>
        <td style="padding:10px;border:1px solid #e2e8f0;"><strong>Total Impressions</strong><br>${c.totalImpressions.toLocaleString()} (${c.impressionsPct >= 0 ? "+" : ""}${c.impressionsPct.toFixed(1)}%)</td>
        <td style="padding:10px;border:1px solid #e2e8f0;"><strong>Average CTR</strong><br>${c.avgCtr.toFixed(2)}% (${c.ctrDelta >= 0 ? "+" : ""}${c.ctrDelta.toFixed(2)} pts)</td>
      </tr>
    </table>
    <p style="margin:14px 0 0 0;color:#334155;font-size:13px;">
      Properties in report: <strong>${c.propertyCount}</strong>. Excel companion is attached.
    </p>
  </div>
</body>
</html>`;
}

async function computeReport(
  db: D1Database,
  currentStart: string,
  currentEnd: string,
  prevStart: string,
  prevEnd: string,
  communityId?: string
) {
  const filterSql = communityId ? " AND community_id = ? " : "";
  const filterParams = communityId ? [communityId] : [];

  const rows = await queryAll<AggRow>(
    db,
    `WITH cur AS (
       SELECT community_id, SUM(clicks) AS clicks, SUM(impressions) AS impressions
       FROM gsc_daily_metrics
       WHERE metric_date BETWEEN ? AND ? ${filterSql}
       GROUP BY community_id
     ),
     prev AS (
       SELECT community_id, SUM(clicks) AS clicks, SUM(impressions) AS impressions
       FROM gsc_daily_metrics
       WHERE metric_date BETWEEN ? AND ? ${filterSql}
       GROUP BY community_id
     ),
     ids AS (
       SELECT community_id FROM cur
       UNION
       SELECT community_id FROM prev
     )
     SELECT ids.community_id,
            COALESCE(c.name, ids.community_id) AS name,
            COALESCE(cur.clicks, 0) AS clicks,
            COALESCE(cur.impressions, 0) AS impressions,
            COALESCE(prev.clicks, 0) AS prev_clicks,
            COALESCE(prev.impressions, 0) AS prev_impressions
     FROM ids
     LEFT JOIN cur ON cur.community_id = ids.community_id
     LEFT JOIN prev ON prev.community_id = ids.community_id
     LEFT JOIN communities c ON c.id = ids.community_id
     ORDER BY clicks DESC, impressions DESC`,
    [currentStart, currentEnd, ...filterParams, prevStart, prevEnd, ...filterParams]
  );

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
      previous_clicks: r.prev_clicks,
      previous_impressions: r.prev_impressions,
    };
  });

  const totalClicks = properties.reduce((s, p) => s + p.clicks, 0);
  const totalImpressions = properties.reduce((s, p) => s + p.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const prevClicks = rows.reduce((s, r) => s + r.prev_clicks, 0);
  const prevImpressions = rows.reduce((s, r) => s + r.prev_impressions, 0);
  const prevAvgCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
  const clicksPct = prevClicks > 0 ? ((totalClicks - prevClicks) / prevClicks) * 100 : (totalClicks > 0 ? 100 : 0);
  const impressionsPct = prevImpressions > 0 ? ((totalImpressions - prevImpressions) / prevImpressions) * 100 : (totalImpressions > 0 ? 100 : 0);

  let excellent = 0, good = 0, needsImprovement = 0;
  for (const p of properties) {
    if (p.ctr > 5) excellent++;
    else if (p.ctr >= 3) good++;
    else needsImprovement++;
  }

  return {
    propertyCount: properties.length,
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
  };
}

/** GET / — existing trailing-30 snapshot */
gsc.get("/", async (c) => {
  const db = c.env.POP_BRIEF_DB;
  const maxRow = await queryFirst<{ d: string }>(db, `SELECT MAX(metric_date) AS d FROM gsc_daily_metrics`);
  if (!maxRow?.d) {
    return c.json({ current_start: null, current_end: null, prev_start: null, prev_end: null, property_count: 0, portfolio: null, grades: null, properties: [] });
  }

  const curEnd = maxRow.d;
  const curStart = dateOffset(curEnd, -29);
  const prevEnd = dateOffset(curStart, -1);
  const prevStart = dateOffset(prevEnd, -29);
  const report = await computeReport(db, curStart, curEnd, prevStart, prevEnd);
  return c.json({
    current_start: curStart,
    current_end: curEnd,
    prev_start: prevStart,
    prev_end: prevEnd,
    property_count: report.propertyCount,
    portfolio: report.portfolio,
    grades: report.grades,
    properties: report.properties,
  });
});

/**
 * POST /report — configurable GSC report generation.
 * Supports:
 *  - portfolio or single property
 *  - custom date range
 *  - optional email send with XLSX attachment
 */
gsc.post("/report", async (c) => {
  const parsed = ReportBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json(errJson("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request"), 400);
  const body = parsed.data;

  if (!isIsoDate(body.start_date) || !isIsoDate(body.end_date)) {
    return c.json(errJson("VALIDATION_ERROR", "Dates must be YYYY-MM-DD"), 400);
  }
  if (body.start_date > body.end_date) {
    return c.json(errJson("VALIDATION_ERROR", "start_date must be on or before end_date"), 400);
  }
  if (body.scope === "property" && !body.community_id) {
    return c.json(errJson("VALIDATION_ERROR", "community_id is required for property scope"), 400);
  }

  const span = daySpanInclusive(body.start_date, body.end_date);
  if (span < 1 || span > 370) {
    return c.json(errJson("VALIDATION_ERROR", "Date range must be between 1 and 370 days"), 400);
  }

  const prevEnd = dateOffset(body.start_date, -1);
  const prevStart = dateOffset(prevEnd, -(span - 1));

  const report = await computeReport(
    c.env.POP_BRIEF_DB,
    body.start_date,
    body.end_date,
    prevStart,
    prevEnd,
    body.scope === "property" ? body.community_id : undefined
  );

  const sheetRows = report.properties.map((p) => ({
    Rank: p.rank,
    Property: p.name,
    "Current Clicks": p.clicks,
    "Previous Clicks": p.previous_clicks,
    "Clicks Delta": p.clicks_delta,
    "Current Impressions": p.impressions,
    "Previous Impressions": p.previous_impressions,
    "Impressions Delta": p.impressions_delta,
    "Current CTR %": p.ctr,
    "CTR Delta (pp)": p.ctr_delta,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, "GSC Report");
  const wbBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const xlsxBase64 = toBase64(wbBuf);
  const filename = `gsc_report_${body.start_date}_to_${body.end_date}.xlsx`;

  let email_sent = false;
  let email_error: string | null = null;
  if (body.email) {
    if (c.env.ENABLE_EMAIL_SEND !== "true") {
      email_error = "Email sending disabled by environment flag";
    } else {
      const html = buildEmailHtml({
        currentStart: body.start_date,
        currentEnd: body.end_date,
        prevStart,
        prevEnd,
        propertyCount: report.propertyCount,
        totalClicks: report.portfolio.total_clicks,
        totalImpressions: report.portfolio.total_impressions,
        avgCtr: report.portfolio.avg_ctr,
        clicksPct: report.portfolio.clicks_pct,
        impressionsPct: report.portfolio.impressions_pct,
        ctrDelta: report.portfolio.ctr_delta,
      });
      const subjectPrefix = body.scope === "property" ? "Property GSC Report" : "Portfolio GSC Report";
      const send = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
        to: body.email,
        subject: `${subjectPrefix} (${body.start_date} to ${body.end_date})`,
        html,
        attachments: [{ filename, contentBase64: xlsxBase64, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
      });
      email_sent = send.ok;
      email_error = send.ok ? null : (send.error ?? "Failed to send email");
    }
  }

  return c.json({
    current_start: body.start_date,
    current_end: body.end_date,
    prev_start: prevStart,
    prev_end: prevEnd,
    scope: body.scope,
    community_id: body.community_id ?? null,
    property_count: report.propertyCount,
    portfolio: report.portfolio,
    grades: report.grades,
    properties: report.properties,
    email_sent,
    email_error,
    excel_filename: filename,
    excel_base64: xlsxBase64,
  });
});

export { gsc };

