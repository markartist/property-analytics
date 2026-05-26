/**
 * Search Intelligence report generation routes.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { queryAll, queryFirst } from "../lib/db";
import { errJson } from "../lib/validate";
import { sendEmail } from "../email/resend";

const searchIntelligence = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
searchIntelligence.use("*", requireAuth);

const VERSION = "1.0.0";
const SEMRUSH_URL = "https://api.semrush.com/";

const ReportBody = z.object({
  community_id: z.string().min(1),
  email: z.string().email().optional(),
});

type CommunityRow = {
  id: string;
  name: string;
  ga4_property_id: string | null;
  full_url: string | null;
  city: string | null;
  state: string | null;
};

type SemrushKeywordRow = {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc: number;
  url: string;
  trafficPct: number;
  competition: number;
};

type LocalSemrushRow = {
  keyword: string;
  position: number;
  search_volume: number;
  traffic_percent: number;
  keyword_type: string | null;
};

type GscRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  average_position: number;
};

type AdsRow = {
  keyword_text: string;
  match_type: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
};

type CompetitorSpec = {
  competitor_name: string;
  competitor_url: string;
};

type GapRow = {
  keyword: string;
  search_volume: number;
  best_competitor_position: number;
  property_position: number | null;
  competitors: string[];
  score: number;
};

const STOPWORDS = new Set([
  "apartments",
  "apartment",
  "the",
  "at",
  "and",
  "for",
  "rent",
  "luxury",
  "homes",
  "home",
  "living",
  "fl",
  "orlando",
  "kissimmee",
  "near",
]);

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function codeInline(input: string): string {
  return `<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input)}</code>`;
}

function toBase64String(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractDomainAndPath(fullUrl: string): { domain: string; path: string } {
  const parsed = new URL(fullUrl);
  const path = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  return { domain: parsed.hostname.toLowerCase(), path };
}

function tokenize(value: string): Set<string> {
  const tokens = (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  return new Set(tokens);
}

function isBranded(keyword: string, brandTokens: Set<string>): boolean {
  const kwTokens = tokenize(keyword);
  for (const token of kwTokens) {
    if (brandTokens.has(token)) return true;
  }
  return false;
}

function isNoiseKeyword(keyword: string): boolean {
  const lowered = keyword.toLowerCase();
  if (/\b\d{3,}\b/.test(lowered)) return true;
  return ["reviews", "photos", "address"].some((phrase) => lowered.includes(phrase));
}

function summarizeMix(rows: SemrushKeywordRow[], brandTokens: Set<string>) {
  const groups = {
    brand: rows.filter((row) => isBranded(row.keyword, brandTokens)),
    generic: rows.filter((row) => !isBranded(row.keyword, brandTokens)),
  };
  const pack = (items: SemrushKeywordRow[]) => ({
    keywords: items.length,
    top10: items.filter((item) => item.position > 0 && item.position <= 10).length,
    totalVolume: items.reduce((sum, item) => sum + item.searchVolume, 0),
    trafficPct: Number(items.reduce((sum, item) => sum + item.trafficPct, 0).toFixed(2)),
  });
  return { brand: pack(groups.brand), generic: pack(groups.generic) };
}

function keywordMap(rows: SemrushKeywordRow[]): Map<string, SemrushKeywordRow> {
  const out = new Map<string, SemrushKeywordRow>();
  for (const row of rows) {
    const key = row.keyword.toLowerCase();
    const current = out.get(key);
    if (!current || row.position < current.position) out.set(key, row);
  }
  return out;
}

function topGenericKeywords(rows: SemrushKeywordRow[], brandTokens: Set<string>): SemrushKeywordRow[] {
  return rows
    .filter((row) => !isBranded(row.keyword, brandTokens) && !isNoiseKeyword(row.keyword))
    .sort((a, b) => (b.trafficPct - a.trafficPct) || (b.searchVolume - a.searchVolume))
    .slice(0, 10);
}

function weakKeywords(rows: SemrushKeywordRow[], brandTokens: Set<string>): SemrushKeywordRow[] {
  return rows
    .filter((row) => !isBranded(row.keyword, brandTokens) && !isNoiseKeyword(row.keyword) && row.position >= 11 && row.position <= 40 && row.searchVolume >= 70)
    .sort((a, b) => (b.searchVolume - a.searchVolume) || (a.position - b.position))
    .slice(0, 10);
}

function buildGapTable(
  propertyRows: SemrushKeywordRow[],
  competitorRows: Record<string, SemrushKeywordRow[]>,
  propertyBrandTokens: Set<string>,
  competitorBrandTokens: Record<string, Set<string>>,
): GapRow[] {
  const propertyLookup = keywordMap(propertyRows);
  const allCompetitorBrandTokens = Object.values(competitorBrandTokens).reduce((acc, set) => {
    for (const token of set) acc.add(token);
    return acc;
  }, new Set<string>());
  const aggregate = new Map<string, GapRow>();

  for (const [competitorName, rows] of Object.entries(competitorRows)) {
    const competitorTokens = competitorBrandTokens[competitorName] ?? new Set<string>();
    for (const row of rows) {
      const key = row.keyword.toLowerCase();
      if (
        row.position <= 0 ||
        row.position > 20 ||
        row.searchVolume < 50 ||
        isBranded(row.keyword, propertyBrandTokens) ||
        isBranded(row.keyword, competitorTokens) ||
        isBranded(row.keyword, allCompetitorBrandTokens) ||
        isNoiseKeyword(row.keyword)
      ) {
        continue;
      }

      const propertyRow = propertyLookup.get(key);
      if (propertyRow && propertyRow.position > 0 && propertyRow.position <= 10) continue;

      const existing = aggregate.get(key);
      const score = Math.max(1, 21 - row.position) * Math.max(1, Math.floor(row.searchVolume / 50));
      if (!existing) {
        aggregate.set(key, {
          keyword: row.keyword,
          search_volume: row.searchVolume,
          best_competitor_position: row.position,
          property_position: propertyRow?.position ?? null,
          competitors: [competitorName],
          score,
        });
      } else {
        existing.best_competitor_position = Math.min(existing.best_competitor_position, row.position);
        existing.property_position = propertyRow?.position ?? existing.property_position;
        if (!existing.competitors.includes(competitorName)) existing.competitors.push(competitorName);
        existing.score += score;
      }
    }
  }

  return [...aggregate.values()]
    .sort((a, b) => (b.score - a.score) || (b.competitors.length - a.competitors.length) || (b.search_volume - a.search_volume))
    .slice(0, 12);
}

function buildMarketHeadTerms(
  propertyRows: SemrushKeywordRow[],
  competitorRows: Record<string, SemrushKeywordRow[]>,
  propertyBrandTokens: Set<string>,
  competitorBrandTokens: Record<string, Set<string>>,
): { keyword: string; overlap: number; propertyPosition: number | null }[] {
  const propertyLookup = keywordMap(propertyRows);
  const allCompetitorBrandTokens = Object.values(competitorBrandTokens).reduce((acc, set) => {
    for (const token of set) acc.add(token);
    return acc;
  }, new Set<string>());
  const counts = new Map<string, number>();

  for (const [competitorName, rows] of Object.entries(competitorRows)) {
    const competitorTokens = competitorBrandTokens[competitorName] ?? new Set<string>();
    for (const row of rows) {
      if (
        row.searchVolume < 90 ||
        isBranded(row.keyword, propertyBrandTokens) ||
        isBranded(row.keyword, competitorTokens) ||
        isBranded(row.keyword, allCompetitorBrandTokens) ||
        isNoiseKeyword(row.keyword)
      ) continue;
      counts.set(row.keyword.toLowerCase(), (counts.get(row.keyword.toLowerCase()) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword, overlap]) => ({
      keyword,
      overlap,
      propertyPosition: propertyLookup.get(keyword)?.position ?? null,
    }));
}

function classifyAdsIssues(rows: AdsRow[], propertyName: string): string[] {
  if (!rows.length) return ["No keyword-level Google Ads rows are present in the current warehouse slice for this property."];

  const propertyTokens = tokenize(propertyName);
  const suspicious = rows.filter((row) => {
    const keyword = row.keyword_text.toLowerCase();
    const tokens = tokenize(keyword);
    const explicitForeignBrand = ["tapestry ", "grandewood", "lucent", "burano", "camden", "addison", "alta "].some((phrase) => keyword.includes(phrase));
    if (keyword.includes("tapestry headwaters")) return true;
    return explicitForeignBrand && ![...tokens].some((token) => propertyTokens.has(token));
  });

  if (!suspicious.length) {
    return ["Paid terms are broadly aligned to market and product intent in the visible keyword rows."];
  }

  const labels = [...new Set(suspicious.slice(0, 4).map((row) => row.keyword_text))];
  const spend = suspicious.reduce((sum, row) => sum + row.cost, 0);
  return [
    `Spend is landing on likely non-current or competitor-brand terms such as ${labels.join(", ")} ($${spend.toFixed(2)} in the visible keyword rows).`,
  ];
}

function buildMarkdownTable(headers: string[], rows: (string | number | null)[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map((_, idx) => (idx === 0 ? "---" : "---:")).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => (cell == null ? "NR" : String(cell))).join(" | ")} |`).join("\n");
  return [head, rule, body].filter(Boolean).join("\n");
}

function renderHtmlTable(headers: string[], rows: (string | number | null)[][]): string {
  const thead = headers.map((header) => `<th style="padding:10px;text-align:left;border-bottom:2px solid #d9dee5;background:#f8f9fb;color:#495057;font-size:12px;text-transform:uppercase;">${escapeHtml(header)}</th>`).join("");
  const tbody = rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:10px;border-bottom:1px solid #edf1f5;font-size:13px;color:#2f3b45;vertical-align:top;">${escapeHtml(cell == null ? "NR" : String(cell))}</td>`).join("")}</tr>`).join("");
  return `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0 18px 0;"><tr>${thead}</tr>${tbody}</table>`;
}

async function fetchSemrushKeywords(apiKey: string, fullUrl: string, limit = 100): Promise<SemrushKeywordRow[]> {
  const { domain, path } = extractDomainAndPath(fullUrl);
  const url = new URL(SEMRUSH_URL);
  url.searchParams.set("type", "domain_organic");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("display_limit", String(limit));
  url.searchParams.set("export_columns", "Ph,Po,Nq,Cp,Ur,Tr,Co");
  url.searchParams.set("domain", domain);
  url.searchParams.set("display_filter", `+|Ur|Co|${path}`);
  url.searchParams.set("database", "us");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SEMrush API error (${res.status})`);
  const text = await res.text();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines[0].startsWith("ERROR")) return [];

  return lines.slice(1).map((line) => line.split(";")).filter((parts) => parts.length >= 7).map((parts) => ({
    keyword: parts[0] ?? "",
    position: Number.parseInt(parts[1] ?? "0", 10) || 0,
    searchVolume: Number.parseInt(parts[2] ?? "0", 10) || 0,
    cpc: Number.parseFloat(parts[3] ?? "0") || 0,
    url: parts[4] ?? "",
    trafficPct: Number.parseFloat(parts[5] ?? "0") || 0,
    competition: Number.parseFloat(parts[6] ?? "0") || 0,
  }));
}

async function generateReport(db: D1Database, communityId: string, semrushApiKey: string) {
  const community = await queryFirst<CommunityRow>(
    db,
    `SELECT id, name, ga4_property_id, full_url, city, state
     FROM communities
     WHERE id = ?`,
    [communityId],
  );
  if (!community?.ga4_property_id || !community.full_url) {
    throw new Error("Community is missing GA4 property id or full_url");
  }

  const ga4PropertyId = community.ga4_property_id;
  const latestGsc = await queryFirst<{ latest: string | null }>(db, "SELECT MAX(metric_date) AS latest FROM gsc_queries WHERE property_id = ?", [ga4PropertyId]);
  const currentEnd = latestGsc?.latest ?? new Date().toISOString().slice(0, 10);
  const end = new Date(`${currentEnd}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const currentStart = start.toISOString().slice(0, 10);

  const localSemrushDateRow = await queryFirst<{ latest: string | null }>(db, "SELECT MAX(metric_date) AS latest FROM semrush_keyword_rankings WHERE property_id = ?", [ga4PropertyId]);
  const localSemrushDate = localSemrushDateRow?.latest ?? null;

  const [localSemrushRows, gscRows, adsRows, competitorSpecs] = await Promise.all([
    localSemrushDate ? queryAll<LocalSemrushRow>(
      db,
      `SELECT keyword, position, search_volume, traffic_percent, keyword_type
       FROM semrush_keyword_rankings
       WHERE property_id = ? AND metric_date = ?
       ORDER BY traffic_percent DESC, search_volume DESC
       LIMIT 25`,
      [ga4PropertyId, localSemrushDate],
    ) : Promise.resolve([]),
    queryAll<GscRow>(
      db,
      `SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
              ROUND(SUM(clicks) * 1.0 / NULLIF(SUM(impressions),0), 4) AS ctr,
              ROUND(AVG(average_position), 2) AS average_position
       FROM gsc_queries
       WHERE property_id = ? AND metric_date BETWEEN ? AND ?
       GROUP BY query
       ORDER BY clicks DESC, impressions DESC
       LIMIT 12`,
      [ga4PropertyId, currentStart, currentEnd],
    ),
    queryAll<AdsRow>(
      db,
      `SELECT keyword_text, match_type,
              SUM(clicks) AS clicks,
              SUM(impressions) AS impressions,
              ROUND(SUM(cost_micros) / 1000000.0, 2) AS cost,
              ROUND(SUM(conversions), 2) AS conversions
       FROM google_ads_keywords
       WHERE property_id = ?
       GROUP BY keyword_text, match_type
       ORDER BY cost DESC, clicks DESC
       LIMIT 12`,
      [ga4PropertyId],
    ),
    queryAll<CompetitorSpec>(
      db,
      `SELECT c.competitor_name, c.competitor_url
       FROM property_competitors pc
       JOIN competitors c ON c.competitor_id = pc.competitor_id
       WHERE pc.property_id = ?
         AND c.competitor_url IS NOT NULL
       ORDER BY pc.competitor_rank ASC
       LIMIT 6`,
      [ga4PropertyId],
    ),
  ]);

  const propertyRows = await fetchSemrushKeywords(semrushApiKey, community.full_url, 100);
  const competitorRows: Record<string, SemrushKeywordRow[]> = {};
  for (const competitor of competitorSpecs) {
    competitorRows[competitor.competitor_name] = await fetchSemrushKeywords(semrushApiKey, competitor.competitor_url, 60);
  }

  const propertyBrandTokens = tokenize(community.name);
  const competitorBrandTokens = Object.fromEntries(Object.keys(competitorRows).map((name) => [name, tokenize(name)]));
  const mix = summarizeMix(propertyRows, propertyBrandTokens);
  const genericLeaders = topGenericKeywords(propertyRows, propertyBrandTokens);
  const weak = weakKeywords(propertyRows, propertyBrandTokens);
  const gaps = buildGapTable(propertyRows, competitorRows, propertyBrandTokens, competitorBrandTokens);
  const headTerms = buildMarketHeadTerms(propertyRows, competitorRows, propertyBrandTokens, competitorBrandTokens);
  const adsIssues = classifyAdsIssues(adsRows, community.name);

  const topGenericTable = buildMarkdownTable(["Keyword", "Pos", "Volume", "Traffic %"], genericLeaders.map((row) => [row.keyword, row.position, row.searchVolume, row.trafficPct.toFixed(2)]));
  const gscTable = buildMarkdownTable(["Query", "Clicks", "Impr.", "CTR", "Avg Pos"], gscRows.map((row) => [row.query, row.clicks, row.impressions, row.ctr.toFixed(2), row.average_position.toFixed(2)]));
  const localSemrushTable = buildMarkdownTable(["Keyword", "Pos", "Volume", "Traffic %", "Type"], localSemrushRows.map((row) => [row.keyword, row.position, row.search_volume, Number(row.traffic_percent ?? 0).toFixed(2), row.keyword_type ?? ""]));
  const gapTable = buildMarkdownTable(["Keyword", "Volume", "Best Comp Pos", "Our Pos", "Competitors"], gaps.map((row) => [row.keyword, row.search_volume, row.best_competitor_position, row.property_position ?? "NR", row.competitors.slice(0, 3).join(", ")]));
  const weakTable = buildMarkdownTable(["Keyword", "Pos", "Volume", "Traffic %"], weak.map((row) => [row.keyword, row.position, row.searchVolume, row.trafficPct.toFixed(2)]));
  const adsTable = adsRows.length
    ? buildMarkdownTable(["Keyword", "Match", "Clicks", "Impr.", "Cost", "Conv."], adsRows.map((row) => [row.keyword_text, row.match_type, row.clicks, row.impressions, row.cost.toFixed(2), row.conversions.toFixed(2)]))
    : "_No keyword-level Google Ads rows found._";

  const competitorList = competitorSpecs.map((row) => `- \`${row.competitor_name}\``).join("\n");
  const headTermList = headTerms.map((row) => `- \`${row.keyword}\` appears across \`${row.overlap}\` competitor sets; current property position: \`${row.propertyPosition ?? "NR"}\``).join("\n");

  const markdown = `# Search Intelligence Brief — ${community.name}

Version: ${VERSION}
Generated: ${new Date().toISOString()}
Window: ${currentStart} to ${currentEnd}

## Executive Read

- Brand demand is materially stronger than non-brand apartment-intent visibility for this property.
- Live SEMrush mix: \`${mix.brand.keywords}\` brand keywords vs \`${mix.generic.keywords}\` generic keywords.
- Estimated traffic share from live SEMrush: \`${mix.brand.trafficPct.toFixed(2)}%\` brand vs \`${mix.generic.trafficPct.toFixed(2)}%\` generic.
- The clearest growth path is stronger non-brand apartment-intent visibility, not more brand defense.

## Current Keyword Leaders

### Top generic live SEMrush keywords
${topGenericTable}

### Top local GSC queries, last 30 days
${gscTable}

### Local SEMrush warehouse leaders
${localSemrushTable}

## Competitor Set Used

${competitorList || "- No competitors available."}

## Competitor Keyword Gaps

${gapTable}

## Weak-but-Winnable Terms

${weakTable}

## Market Head Terms Competitors Are Winning

${headTermList || "- No shared market head terms identified."}

## Paid Search Alignment

${adsTable}

## Recommendation Stack

${gaps[0] ? `- Build or strengthen landing-page relevance around \`${gaps[0].keyword}\` and the other top generic gaps where competitors already rank on page one.` : "- Build new non-brand landing page coverage around the strongest apartment-intent terms in this market."}
${weak[0] ? `\n- Prioritize page and on-page improvements for \`${weak[0].keyword}\`-style queries where the property already ranks but is stuck in positions \`${weak[0].position}\` and beyond.` : ""}
${adsIssues.map((issue) => `\n- ${issue}`).join("")}
`;

  const genericHtmlRows = genericLeaders.map((row) => [row.keyword, row.position, row.searchVolume, row.trafficPct.toFixed(2)]);
  const gscHtmlRows = gscRows.map((row) => [row.query, row.clicks, row.impressions, row.ctr.toFixed(2), row.average_position.toFixed(2)]);
  const localSemrushHtmlRows = localSemrushRows.map((row) => [row.keyword, row.position, row.search_volume, Number(row.traffic_percent ?? 0).toFixed(2), row.keyword_type ?? ""]);
  const gapHtmlRows = gaps.map((row) => [row.keyword, row.search_volume, row.best_competitor_position, row.property_position ?? "NR", row.competitors.slice(0, 3).join(", ")]);
  const weakHtmlRows = weak.map((row) => [row.keyword, row.position, row.searchVolume, row.trafficPct.toFixed(2)]);
  const adsHtmlRows = adsRows.map((row) => [row.keyword_text, row.match_type, row.clicks, row.impressions, row.cost.toFixed(2), row.conversions.toFixed(2)]);

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1120px;margin:0 auto;background:#ffffff;">
    <tr><td style="padding:28px 24px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:18px;">
        <tr><td style="text-align:center;">
          <div style="color:#15284B;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Property Intelligence</div>
          <h1 style="margin:8px 0 6px 0;color:#15284B;font-size:30px;line-height:1.2;">Search Intelligence Brief</h1>
          <div style="color:#6c757d;font-size:14px;">${escapeHtml(community.name)} | Generated ${escapeHtml(new Date().toLocaleString())}</div>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 24px 0;border:3px solid #15284B;border-radius:8px;">
        <tr><td style="background:#15284B;padding:14px 18px;">
          <h2 style="margin:0;color:#fff;font-size:20px;text-align:center;">Executive At-a-Glance</h2>
        </td></tr>
        <tr><td style="padding:18px;">
          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="width:33.33%;padding:8px 10px;">
                <div style="font-size:11px;color:#868e96;text-transform:uppercase;">Brand Keywords</div>
                <div style="font-size:28px;font-weight:700;color:#1f2933;">${mix.brand.keywords}</div>
              </td>
              <td style="width:33.33%;padding:8px 10px;">
                <div style="font-size:11px;color:#868e96;text-transform:uppercase;">Generic Keywords</div>
                <div style="font-size:28px;font-weight:700;color:#1f2933;">${mix.generic.keywords}</div>
              </td>
              <td style="width:33.33%;padding:8px 10px;">
                <div style="font-size:11px;color:#868e96;text-transform:uppercase;">Primary Story</div>
                <div style="font-size:17px;font-weight:700;color:#1f2933;">Brand strength, non-brand gap</div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Executive Read</h2>
      <ul style="margin:10px 0 16px 20px;padding:0;">
        <li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">Brand demand is materially stronger than non-brand apartment-intent visibility for this property.</li>
        <li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">Live SEMrush mix: ${codeInline(String(mix.brand.keywords))} brand keywords vs ${codeInline(String(mix.generic.keywords))} generic keywords.</li>
        <li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">Estimated traffic share from live SEMrush: ${codeInline(`${mix.brand.trafficPct.toFixed(2)}%`)} brand vs ${codeInline(`${mix.generic.trafficPct.toFixed(2)}%`)} generic.</li>
        <li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">Window used for warehouse query context: ${codeInline(`${currentStart} to ${currentEnd}`)}.</li>
      </ul>

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Current Keyword Leaders</h2>
      <h3 style="color:#15284B;font-size:20px;margin:18px 0 8px 0;">Top generic live SEMrush keywords</h3>
      ${renderHtmlTable(["Keyword", "Pos", "Volume", "Traffic %"], genericHtmlRows)}
      <h3 style="color:#15284B;font-size:20px;margin:18px 0 8px 0;">Top local GSC queries, last 30 days</h3>
      ${renderHtmlTable(["Query", "Clicks", "Impr.", "CTR", "Avg Pos"], gscHtmlRows)}
      <h3 style="color:#15284B;font-size:20px;margin:18px 0 8px 0;">Local SEMrush warehouse leaders</h3>
      ${renderHtmlTable(["Keyword", "Pos", "Volume", "Traffic %", "Type"], localSemrushHtmlRows)}

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Competitor Set Used</h2>
      <ul style="margin:10px 0 16px 20px;padding:0;">
        ${competitorSpecs.map((row) => `<li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">${codeInline(row.competitor_name)}</li>`).join("")}
      </ul>

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Competitor Keyword Gaps</h2>
      ${renderHtmlTable(["Keyword", "Volume", "Best Comp Pos", "Our Pos", "Competitors"], gapHtmlRows)}

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Weak-but-Winnable Terms</h2>
      ${renderHtmlTable(["Keyword", "Pos", "Volume", "Traffic %"], weakHtmlRows)}

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Market Head Terms Competitors Are Winning</h2>
      <ul style="margin:10px 0 16px 20px;padding:0;">
        ${headTerms.map((row) => `<li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">${codeInline(row.keyword)} appears across ${codeInline(String(row.overlap))} competitor sets; current property position: ${codeInline(row.propertyPosition == null ? "NR" : String(row.propertyPosition))}</li>`).join("")}
      </ul>

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Paid Search Alignment</h2>
      ${adsHtmlRows.length ? renderHtmlTable(["Keyword", "Match", "Clicks", "Impr.", "Cost", "Conv."], adsHtmlRows) : '<p style="margin:10px 0 14px 0;color:#2f3b45;font-size:14px;line-height:1.7;">No keyword-level Google Ads rows found.</p>'}

      <h2 style="color:#15284B;font-size:24px;margin:24px 0 8px 0;">Recommendation Stack</h2>
      <ul style="margin:10px 0 16px 20px;padding:0;">
        ${gaps[0] ? `<li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">Build or strengthen landing-page relevance around ${codeInline(gaps[0].keyword)} and the other top generic gaps where competitors already rank on page one.</li>` : ""}
        ${weak[0] ? `<li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">Prioritize page and on-page improvements for ${codeInline(weak[0].keyword)}-style queries where the property already ranks but is stuck in positions ${codeInline(String(weak[0].position))} and beyond.</li>` : ""}
        ${adsIssues.map((issue) => `<li style="margin:0 0 8px 0;color:#2f3b45;font-size:14px;line-height:1.6;">${escapeHtml(issue)}</li>`).join("")}
      </ul>

      <div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;font-style:italic;text-align:center;">
        Search Intelligence v${VERSION} generated from live SEMrush and Data Pond warehouse data.
      </div>
    </td></tr>
  </table>
</body>
</html>`;

  const reportJson = {
    version: VERSION,
    generated_at: new Date().toISOString(),
    current_start: currentStart,
    current_end: currentEnd,
    community,
    mix,
    top_generic_keywords: genericLeaders,
    gsc_queries: gscRows,
    local_semrush_date: localSemrushDate,
    local_semrush_keywords: localSemrushRows,
    competitors: competitorSpecs.map((row) => row.competitor_name),
    gaps,
    weak_keywords: weak,
    market_head_terms: headTerms,
    ads_keywords: adsRows,
    ads_issues: adsIssues,
  };

  const baseSlug = `${currentEnd}__search-intelligence__${slugify(community.name)}__v${VERSION.replaceAll(".", "_")}`;
  return {
    version: VERSION,
    community,
    currentStart,
    currentEnd,
    summary: {
      brand_keywords: mix.brand.keywords,
      generic_keywords: mix.generic.keywords,
      top_gap: gaps[0]?.keyword ?? null,
      local_semrush_snapshot: localSemrushDate,
      competitors_used: competitorSpecs.length,
    },
    html,
    markdown,
    json: JSON.stringify(reportJson, null, 2),
    htmlFilename: `${baseSlug}.html`,
    markdownFilename: `${baseSlug}.md`,
    jsonFilename: `${baseSlug}.json`,
  };
}

searchIntelligence.post("/report", async (c) => {
  const parsed = ReportBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json(errJson("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request"), 400);
  if (!c.env.SEMRUSH_API_KEY) return c.json(errJson("CONFIG_ERROR", "SEMRUSH_API_KEY is not configured"), 500);

  try {
    const report = await generateReport(c.env.POP_BRIEF_DB, parsed.data.community_id, c.env.SEMRUSH_API_KEY);

    let email_sent = false;
    let email_error: string | null = null;
    if (parsed.data.email) {
      if (c.env.ENABLE_EMAIL_SEND !== "true") {
        email_error = "Email sending disabled by environment flag";
      } else {
        const send = await sendEmail(c.env.RESEND_API_KEY, c.env.EMAIL_FROM, {
          to: parsed.data.email,
          subject: `Search Intelligence Brief — ${report.community.name}`,
          html: report.html,
          attachments: [
            { filename: report.htmlFilename, contentBase64: toBase64String(report.html), contentType: "text/html" },
            { filename: report.markdownFilename, contentBase64: toBase64String(report.markdown), contentType: "text/markdown" },
            { filename: report.jsonFilename, contentBase64: toBase64String(report.json), contentType: "application/json" },
          ],
        });
        email_sent = send.ok;
        email_error = send.ok ? null : (send.error ?? "Failed to send email");
      }
    }

    return c.json({
      version: report.version,
      current_start: report.currentStart,
      current_end: report.currentEnd,
      community: {
        id: report.community.id,
        name: report.community.name,
        ga4_property_id: report.community.ga4_property_id,
        full_url: report.community.full_url,
        city: report.community.city,
        state: report.community.state,
      },
      summary: report.summary,
      report_html: report.html,
      html_filename: report.htmlFilename,
      html_base64: toBase64String(report.html),
      markdown_filename: report.markdownFilename,
      markdown_base64: toBase64String(report.markdown),
      json_filename: report.jsonFilename,
      json_base64: toBase64String(report.json),
      email_sent,
      email_error,
    });
  } catch (error) {
    return c.json(
      errJson("REPORT_GENERATION_FAILED", error instanceof Error ? error.message : "Failed to generate report"),
      500,
    );
  }
});

export { searchIntelligence };
