import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { getGbpMappingForPropertyId } from "../lib/gbp-mapping";
import { queryAll, queryFirst } from "../lib/db";
import { hasServiceAuthConfig, resolveServiceAccessMode } from "../lib/service-auth";
import { errJson } from "../lib/validate";
import { getMemoryContextForProperty } from "../platform/memory/governed-memory";

const vacs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

vacs.use("*", async (c, next) => {
  const configuredServiceAuth = {
    accessClientId: c.env.VACS_ACCESS_CLIENT_ID,
    accessClientSecret: c.env.VACS_ACCESS_CLIENT_SECRET,
    accessTeamDomain: c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
  };
  if (!hasServiceAuthConfig(configuredServiceAuth)) {
    return c.json(errJson("SERVICE_UNAVAILABLE", "VACS service auth is not configured"), 503);
  }
  if (!(await resolveServiceAccessMode(c.req.raw.headers, configuredServiceAuth))) {
    return c.json(errJson("UNAUTHORIZED", "Valid VACS service credentials required"), 401);
  }

  await next();
});

/** GET /v1/vacs/context/:communityId — normalized property context for standalone VACS */
vacs.get("/context/:communityId", async (c) => {
  const db = c.env.POP_BRIEF_DB;
  const communityId = c.req.param("communityId");

  const community = await queryFirst<any>(
    db,
    `SELECT id, name, city, state, full_url, ga4_property_id
     FROM communities
     WHERE id = ? AND deleted_at IS NULL`,
    [communityId]
  );
  if (!community) {
    return c.json(errJson("NOT_FOUND", "Community not found"), 404);
  }

  const latestSnapshot = await queryFirst<{ snapshot_date: string | null }>(
    db,
    `SELECT MAX(snapshot_date) as snapshot_date
     FROM pib_ga4_metrics
     WHERE community_id = ?`,
    [communityId]
  );
  const snapshotDate = latestSnapshot?.snapshot_date ?? null;

  const pib = snapshotDate
    ? await queryFirst<any>(
        db,
        `SELECT
           g.snapshot_date,
           g.sessions_trend_pct,
           lp.total_profile_views,
           lp.views_trend_pct AS gbp_views_trend_pct,
           cir.cir_value,
           rv.avg_rating
         FROM pib_ga4_metrics g
         LEFT JOIN pib_local_presence lp
           ON lp.community_id = g.community_id AND lp.snapshot_date = g.snapshot_date
         LEFT JOIN pib_cir cir
           ON cir.community_id = g.community_id AND cir.snapshot_date = g.snapshot_date
         LEFT JOIN pib_reviews rv
           ON rv.community_id = g.community_id AND rv.snapshot_date = g.snapshot_date
         WHERE g.community_id = ? AND g.snapshot_date = ?`,
        [communityId, snapshotDate]
      )
    : null;

  const marketing = await queryFirst<any>(
    db,
    `SELECT
       week_date,
       current_specials,
       most_common_floorplans,
       website_notes,
       seo_notes
     FROM marketing_data
     WHERE community_id = ?
     ORDER BY week_date DESC
     LIMIT 1`,
    [communityId]
  );

  const gbpMapping = getGbpMappingForPropertyId(community.ga4_property_id);
  const memory = await getMemoryContextForProperty(db, communityId).catch(() => null);

  const claims = await queryAll<any>(
    db,
    `SELECT id, claim_text, source, confidence, applicable_scope, status, created_at, updated_at
     FROM intelligence_claims
     WHERE status = 'active' AND applicable_scope = 'property' AND property_id = ?`,
    [communityId]
  );

  const claimEvidenceLinks = claims.length
    ? await queryAll<{ claim_id: string; evidence_id: string }>(
        db,
        `SELECT claim_id, evidence_id
         FROM intelligence_claim_evidence
         WHERE claim_id IN (${claims.map(() => "?").join(",")})`,
        claims.map((claim: any) => claim.id)
      )
    : [];

  const evidenceIds = [...new Set(claimEvidenceLinks.map((link) => link.evidence_id))];
  const evidenceItems = evidenceIds.length
    ? await queryAll<any>(
        db,
        `SELECT id, evidence_type, source_system, reference, summary, timestamp, status, created_at, updated_at
         FROM intelligence_evidence
         WHERE id IN (${evidenceIds.map(() => "?").join(",")})`,
        evidenceIds
      )
    : [];

  const evidenceIdsByClaim = claimEvidenceLinks.reduce<Record<string, string[]>>((acc, link) => {
    acc[link.claim_id] = acc[link.claim_id] ?? [];
    acc[link.claim_id].push(link.evidence_id);
    return acc;
  }, {});

  const payload = {
    community: {
      id: community.id,
      name: community.name,
      city: community.city ?? null,
      state: community.state ?? null,
      landing_page_url: community.full_url ?? null,
      gbp_account_id: gbpMapping?.account_id ?? null,
      gbp_location_id: gbpMapping?.location_id ?? null,
    },
    leasing: {
      availability_summary: marketing?.most_common_floorplans
        ? `${community.name} is currently highlighting ${marketing.most_common_floorplans}.`
        : null,
      concession_summary: marketing?.current_specials ?? null,
      concession_expires_on: null,
      amenity_highlights: extractHighlights(marketing?.website_notes),
      feature_highlights: extractHighlights(marketing?.seo_notes),
    },
    pib: {
      snapshot_date: pib?.snapshot_date ?? null,
      sessions_trend_pct: pib?.sessions_trend_pct ?? null,
      total_profile_views: pib?.total_profile_views ?? null,
      gbp_views_trend_pct: pib?.gbp_views_trend_pct ?? null,
      cir_value: pib?.cir_value ?? null,
      avg_rating: pib?.avg_rating ?? null,
    },
    memory: memory
      ? {
          captain: {
            display_name: memory.identity.display_name,
            internal_name: memory.identity.internal_name,
          },
          captains_log: memory.captainLog.slice(0, 5).map(({ entry, evidence, lineage }) => ({
            id: entry.id,
            scope: entry.scope,
            status: entry.status,
            summary: entry.summary,
            confidence: entry.confidence,
            source_system: entry.source_system,
            evidence_count: evidence.length,
            lineage_count: lineage.length,
            created_at: entry.created_at,
          })),
          fleet_brief: memory.fleetBrief.slice(0, 5).map(({ entry, evidence, lineage }) => ({
            id: entry.id,
            scope: entry.scope,
            status: entry.status,
            summary: entry.summary,
            confidence: entry.confidence,
            evidence_count: evidence.length,
            lineage_count: lineage.length,
            created_at: entry.created_at,
          })),
          ledger: memory.ledger.slice(0, 5).map(({ entry, evidence, lineage }) => ({
            id: entry.id,
            scope: entry.scope,
            status: entry.status,
            summary: entry.summary,
            confidence: entry.confidence,
            evidence_count: evidence.length,
            lineage_count: lineage.length,
            created_at: entry.created_at,
          })),
        }
      : null,
    intelligence: {
      claims: claims.map((claim: any) => ({
        ...claim,
        linked_evidence_ids: evidenceIdsByClaim[claim.id] ?? [],
      })),
      evidence: evidenceItems,
    },
    cta_url: community.full_url ?? null,
    source_label: "Data Pond",
  };

  return c.json(payload);
});

function extractHighlights(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[.;,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(0, 5);
}

export { vacs };
