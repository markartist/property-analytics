import type { Env } from "../../env";

import anatole from "../../../../../config/portfolio_resi_edge_stabilization/anatoleatnorman-com.manifest.json";
import axial from "../../../../../config/portfolio_resi_edge_stabilization/axialbuckhead-com.manifest.json";
import balmoral from "../../../../../config/portfolio_resi_edge_stabilization/balmoralvillageapts-com.manifest.json";
import boulevard from "../../../../../config/portfolio_resi_edge_stabilization/blvdatlakeside-com.manifest.json";
import calais from "../../../../../config/portfolio_resi_edge_stabilization/calaismidtownapartments-com.manifest.json";
import canton from "../../../../../config/portfolio_resi_edge_stabilization/livecantonmill-com.manifest.json";
import carlyle from "../../../../../config/portfolio_resi_edge_stabilization/carlyleplacesa-com.manifest.json";
import champions from "../../../../../config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json";
import creekside from "../../../../../config/portfolio_resi_edge_stabilization/creeksideapt-com.manifest.json";
import forestView from "../../../../../config/portfolio_resi_edge_stabilization/liveatforestviewapts-com.manifest.json";
import harrison from "../../../../../config/portfolio_resi_edge_stabilization/theharrisonsandysprings-com.manifest.json";
import links from "../../../../../config/portfolio_resi_edge_stabilization/linksatwindsorparke-com.manifest.json";
import luma from "../../../../../config/portfolio_resi_edge_stabilization/lumaheadwaters-com.manifest.json";
import metropolitan from "../../../../../config/portfolio_resi_edge_stabilization/themetropolitankentuckyapts-com.manifest.json";
import parkOnWurzbach from "../../../../../config/portfolio_resi_edge_stabilization/parkonwurzbach-com.manifest.json";
import phoenix from "../../../../../config/portfolio_resi_edge_stabilization/phoenixfortworth-com.manifest.json";
import retreat from "../../../../../config/portfolio_resi_edge_stabilization/retreatatkedronvillage-com.manifest.json";
import sanPalmilla from "../../../../../config/portfolio_resi_edge_stabilization/sanpalmilla-houston-com.manifest.json";
import stonecreek from "../../../../../config/portfolio_resi_edge_stabilization/stonecreekranchapartments-com.manifest.json";
import theDistrict from "../../../../../config/portfolio_resi_edge_stabilization/thedistrictuniversal-com.manifest.json";
import theVine from "../../../../../config/portfolio_resi_edge_stabilization/thevinekyle-com.manifest.json";
import theWhitney from "../../../../../config/portfolio_resi_edge_stabilization/thewhitneysandysprings-com.manifest.json";
import timberlane from "../../../../../config/portfolio_resi_edge_stabilization/timberlanevillageapts-com.manifest.json";
import townestone from "../../../../../config/portfolio_resi_edge_stabilization/townestoneat359-com.manifest.json";
import tuscany from "../../../../../config/portfolio_resi_edge_stabilization/tuscanylindbergh-com.manifest.json";
import ventana from "../../../../../config/portfolio_resi_edge_stabilization/ventanaapts-com.manifest.json";
import villageWalk from "../../../../../config/portfolio_resi_edge_stabilization/villagewalkapts-com.manifest.json";

const SCHEMA_VERSION = "resi_edge_promo_record.v1";
const DEFAULT_FEED_URL = "https://online.venterraliving.com/encasa-external/ThirtyLines";
const SUMMARY_KEY = "resi-edge-promo/_latest-summary.json";

type ResiEdgeManifest = {
  package_contract_id?: string;
  target?: {
    property_code?: string;
    source_property_code?: string;
    domain?: string;
    property_name?: string;
  };
  mobile_shell?: {
    promo?: {
      disclaimer?: string;
      primary_cta_label?: string;
      primary_cta_url?: string;
      secondary_cta_label?: string;
      secondary_cta_url?: string;
    };
    navigation?: {
      tour_url?: string;
    };
  };
};

type ThirtyLinesProperty = {
  id?: unknown;
  name?: unknown;
  propertyBannerSpecial?: unknown;
};

type PromoRecord = {
  schema_version: string;
  generated_at: string;
  property_code: string;
  domain: string;
  property_name: string;
  key: string;
  present: boolean;
  propertyBannerSpecial: string;
  bar_label: string;
  title: string;
  body: string;
  disclaimer: string;
  primary_cta_label: string;
  primary_cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
  source: Record<string, unknown>;
};

export type ResiEdgePromoSyncSummary = {
  ok: boolean;
  skipped?: boolean;
  run_id: string;
  generated_at: string;
  feed_url: string;
  property_count: number;
  present_count: number;
  missing_feed_count: number;
  write_count: number;
  rows: Array<{
    property_code: string;
    domain: string;
    property_name: string;
    key: string;
    feed_property_found: boolean;
    present: boolean;
    propertyBannerSpecial: string;
  }>;
  error?: string;
};

const ACTIVE_MANIFESTS = [
  anatole,
  axial,
  balmoral,
  boulevard,
  calais,
  canton,
  carlyle,
  champions,
  creekside,
  forestView,
  harrison,
  links,
  luma,
  metropolitan,
  parkOnWurzbach,
  phoenix,
  retreat,
  sanPalmilla,
  stonecreek,
  theDistrict,
  theVine,
  theWhitney,
  timberlane,
  townestone,
  tuscany,
  ventana,
  villageWalk,
] as ResiEdgeManifest[];

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function sourceCode(manifest: ResiEdgeManifest): string {
  return clean(manifest.target?.source_property_code || manifest.target?.property_code).toUpperCase();
}

function domain(manifest: ResiEdgeManifest): string {
  return clean(manifest.target?.domain);
}

function edgePromoRecordKey(manifest: ResiEdgeManifest): string {
  return `resi-edge-promo/${slug(sourceCode(manifest))}-${slug(domain(manifest))}/current.json`;
}

function activeManifests(manifests = ACTIVE_MANIFESTS): ResiEdgeManifest[] {
  return manifests.filter((manifest) => {
    return manifest.package_contract_id === "resi-edge-canonical-upgrade-package" && sourceCode(manifest) && domain(manifest);
  });
}

function normalizeFeed(payload: unknown): ThirtyLinesProperty[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ThirtyLinesProperty => Boolean(item && typeof item === "object"));
  if (payload && typeof payload === "object" && Array.isArray((payload as { properties?: unknown }).properties)) {
    return (payload as { properties: unknown[] }).properties.filter((item): item is ThirtyLinesProperty => Boolean(item && typeof item === "object"));
  }
  throw new Error("Unexpected ThirtyLines payload shape.");
}

function buildRecord(manifest: ResiEdgeManifest, feedRow: ThirtyLinesProperty | undefined, generatedAt: string, feedUrl: string): PromoRecord {
  const target = manifest.target || {};
  const promo = manifest.mobile_shell?.promo || {};
  const nav = manifest.mobile_shell?.navigation || {};
  const special = clean(feedRow?.propertyBannerSpecial);
  const code = sourceCode(manifest);
  const targetDomain = domain(manifest);
  const primaryUrl = clean(promo.primary_cta_url) || `https://${targetDomain}/apartments/?has_specials=true`;
  const secondaryUrl = clean(promo.secondary_cta_url) || clean(nav.tour_url) || `https://${targetDomain}/contact/`;

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    property_code: code,
    domain: targetDomain,
    property_name: clean(target.property_name),
    key: edgePromoRecordKey(manifest),
    present: Boolean(special),
    propertyBannerSpecial: special,
    bar_label: special,
    title: special,
    body: special,
    disclaimer: clean(promo.disclaimer) || "*Restrictions apply. Contact us for details.",
    primary_cta_label: clean(promo.primary_cta_label) || "See Availability",
    primary_cta_url: primaryUrl,
    secondary_cta_label: clean(promo.secondary_cta_label) || "Contact Us",
    secondary_cta_url: secondaryUrl,
    source: {
      system: "thirtylines_feed_live",
      field: "propertyBannerSpecial",
      fetched_at: generatedAt,
      feed_url: feedUrl,
      feed_property_id: clean(feedRow?.id),
      feed_property_name: clean(feedRow?.name),
    },
  };
}

async function writeJson(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(value, null, 2) + "\n", {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function runScheduledResiEdgePromoSync(
  env: Env,
  scheduledAt: Date,
  options: { manifests?: ResiEdgeManifest[]; fetcher?: typeof fetch } = {}
): Promise<ResiEdgePromoSyncSummary> {
  const generatedAt = scheduledAt.toISOString();
  const runId = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const feedUrl = clean(env.RESI_EDGE_PROMO_FEED_URL) || DEFAULT_FEED_URL;
  const fetcher = options.fetcher || fetch;

  if (env.RESI_EDGE_PROMO_SYNC_ENABLED === "false") {
    return {
      ok: true,
      skipped: true,
      run_id: runId,
      generated_at: generatedAt,
      feed_url: feedUrl,
      property_count: 0,
      present_count: 0,
      missing_feed_count: 0,
      write_count: 0,
      rows: [],
    };
  }

  if (!env.RESI_EDGE_ASSETS) {
    throw new Error("RESI_EDGE_ASSETS binding is required for Resi Edge promo sync.");
  }

  try {
    const response = await fetcher(feedUrl, {
      headers: { accept: "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!response.ok) throw new Error(`ThirtyLines feed returned HTTP ${response.status}`);

    const feedRows = normalizeFeed(await response.json());
    const feedByCode = new Map(feedRows.map((row) => [clean(row.id).toUpperCase(), row]));
    const rows: ResiEdgePromoSyncSummary["rows"] = [];

    for (const manifest of activeManifests(options.manifests)) {
      const code = sourceCode(manifest);
      const feedRow = feedByCode.get(code);
      const record = buildRecord(manifest, feedRow, generatedAt, feedUrl);
      await writeJson(env.RESI_EDGE_ASSETS, record.key, record);
      rows.push({
        property_code: code,
        domain: record.domain,
        property_name: record.property_name,
        key: record.key,
        feed_property_found: Boolean(feedRow),
        present: record.present,
        propertyBannerSpecial: record.propertyBannerSpecial,
      });
    }

    const summary: ResiEdgePromoSyncSummary = {
      ok: true,
      run_id: runId,
      generated_at: generatedAt,
      feed_url: feedUrl,
      property_count: rows.length,
      present_count: rows.filter((row) => row.present).length,
      missing_feed_count: rows.filter((row) => !row.feed_property_found).length,
      write_count: rows.length,
      rows,
    };
    await writeJson(env.RESI_EDGE_ASSETS, `resi-edge-promo/_runs/${runId}.json`, summary);
    await writeJson(env.RESI_EDGE_ASSETS, SUMMARY_KEY, summary);
    return summary;
  } catch (error) {
    const summary: ResiEdgePromoSyncSummary = {
      ok: false,
      run_id: runId,
      generated_at: generatedAt,
      feed_url: feedUrl,
      property_count: 0,
      present_count: 0,
      missing_feed_count: 0,
      write_count: 0,
      rows: [],
      error: error instanceof Error ? error.message : "Unknown Resi Edge promo sync error",
    };
    await writeJson(env.RESI_EDGE_ASSETS, `resi-edge-promo/_runs/${runId}.json`, summary);
    await writeJson(env.RESI_EDGE_ASSETS, SUMMARY_KEY, summary);
    throw error;
  }
}
