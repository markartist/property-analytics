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

const SCHEMA_VERSION = "resi_edge_hero_freshness_record.v1";
const MEDIA_STATE_SCHEMA_VERSION = "resi_edge_hero_media_state.v1";
const MEDIA_REFRESH_QUEUE_SCHEMA_VERSION = "resi_edge_hero_media_refresh_queue.v1";
const SUMMARY_KEY = "resi-edge-hero-freshness/_latest-summary.json";
const HERO_FRESHNESS_SCAN_CONCURRENCY = 6;
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 ResiEdgeHeroFreshness/1.0";

type ResiEdgeManifest = {
  package_contract_id?: string;
  target?: {
    property_code?: string;
    source_property_code?: string;
    domain?: string;
    property_name?: string;
  };
  mobile_shell?: {
    hero?: {
      source_image?: string;
      image_mobile?: string;
    };
  };
};

type HeroFreshnessStatus = "current" | "refresh_needed" | "source_missing" | "source_error";

type SourceMetadata = {
  url: string;
  http_status: number;
  content_type: string;
  content_length: string;
  etag: string;
  last_modified: string;
  sha256: string;
};

type HeroFreshnessRecord = {
  schema_version: string;
  generated_at: string;
  property_code: string;
  domain: string;
  property_name: string;
  key: string;
  native_url: string;
  manifest_source_image: string;
  detected_source_image: string;
  status: HeroFreshnessStatus;
  recommended_action: "none" | "regenerate_hero_assets" | "check_native_source";
  source_metadata: SourceMetadata | null;
  edge_assets: {
    mobile_avif: string;
    mobile_webp: string;
  };
  source: Record<string, unknown>;
  previous?: {
    detected_source_image?: string;
    source_sha256?: string;
    generated_at?: string;
  };
  baseline?: {
    system: "manifest" | "media_state";
    key?: string;
    source_image: string;
    source_sha256?: string;
    generated_at?: string;
  };
  error?: string;
};

type HeroMediaStateRecord = {
  schema_version: string;
  generated_at: string;
  property_code: string;
  domain: string;
  status: "accepted";
  source_image: string;
  source_sha256?: string;
  source_metadata?: SourceMetadata | null;
};

type HeroMediaRefreshQueueMessage = {
  schema_version: string;
  action: "refresh_hero_assets";
  queued_at: string;
  run_id: string;
  property_code: string;
  domain: string;
  property_name: string;
  freshness_key: string;
  media_state_key: string;
  native_url: string;
  manifest_source_image: string;
  detected_source_image: string;
  source_sha256: string;
  source_metadata: SourceMetadata | null;
  edge_assets: HeroFreshnessRecord["edge_assets"];
  transform: {
    width: number;
    height: number;
    fit: "cover";
    gravity: "auto";
    strategy: "cloudflare-images-canary";
  };
  quality_policy: {
    avif_max_bytes: number;
    webp_max_bytes: number;
    start_quality: number;
    min_avif_quality: number;
    min_webp_quality: number;
  };
};

export type ResiEdgeHeroFreshnessSyncSummary = {
  ok: boolean;
  skipped?: boolean;
  run_id: string;
  generated_at: string;
  property_count: number;
  current_count: number;
  refresh_needed_count: number;
  source_missing_count: number;
  source_error_count: number;
  write_count: number;
  rows: Array<{
    property_code: string;
    domain: string;
    property_name: string;
    key: string;
    status: HeroFreshnessStatus;
    manifest_source_image: string;
    detected_source_image: string;
    source_sha256: string;
    recommended_action: HeroFreshnessRecord["recommended_action"];
    baseline_source?: "manifest" | "media_state";
    error?: string;
  }>;
  media_refresh_queue?: {
    enabled: boolean;
    write_count: number;
    skipped_count: number;
    errors: string[];
  };
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

function activeManifests(manifests = ACTIVE_MANIFESTS): ResiEdgeManifest[] {
  return manifests.filter((manifest) => {
    return manifest.package_contract_id === "resi-edge-canonical-upgrade-package" && sourceCode(manifest) && domain(manifest);
  });
}

function edgeHeroRecordKey(manifest: ResiEdgeManifest): string {
  return `resi-edge-hero-freshness/${slug(sourceCode(manifest))}-${slug(domain(manifest))}/current.json`;
}

function edgeHeroMediaStateKey(manifest: ResiEdgeManifest): string {
  return `resi-edge-media-state/${slug(sourceCode(manifest))}-${slug(domain(manifest))}/current.json`;
}

function edgeAssetPaths(manifest: ResiEdgeManifest): HeroFreshnessRecord["edge_assets"] {
  const imageMobile = clean(manifest.mobile_shell?.hero?.image_mobile);
  return {
    mobile_avif: imageMobile || `/assets/resi-edge-assets/${sourceCode(manifest)}/home/hero-mobile-750x1000.avif`,
    mobile_webp: imageMobile.replace(/\.avif(\?.*)?$/i, ".webp") || `/assets/resi-edge-assets/${sourceCode(manifest)}/home/hero-mobile-750x1000.webp`,
  };
}

function normalizeUrl(value: string, baseUrl: string): string {
  if (!value) return "";
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    if (url.pathname === "/__resi-edge/native-dam-asset") {
      const source = url.searchParams.get("src");
      if (source) return normalizeUrl(source, baseUrl);
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

function htmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function extractHeroSourceFromHtml(html: string, baseUrl: string): { url: string; method: string } {
  const patterns = [
    /data-page-section=["']hero["'][\s\S]{0,7000}?data-src=["']([^"']+)["']/i,
    /data-src=["']([^"']+)["'][\s\S]{0,7000}?data-page-section=["']hero["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return { url: normalizeUrl(htmlDecode(match[1]), baseUrl), method: "hero_data_src" };
    }
  }

  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (ogMatch?.[1]) {
    return { url: normalizeUrl(htmlDecode(ogMatch[1]), baseUrl), method: "og_image_fallback" };
  }
  return { url: "", method: "missing" };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sourceMetadata(url: string, fetcher: typeof fetch): Promise<SourceMetadata> {
  const response = await fetcher(url, {
    headers: {
      accept: "image/jpeg,image/png,image/*,*/*;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": DESKTOP_USER_AGENT,
    },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  const body = await response.arrayBuffer();
  return {
    url,
    http_status: response.status,
    content_type: clean(response.headers.get("content-type")),
    content_length: clean(response.headers.get("content-length")) || String(body.byteLength),
    etag: clean(response.headers.get("etag")),
    last_modified: clean(response.headers.get("last-modified")),
    sha256: await sha256Hex(body),
  };
}

async function previousRecord(bucket: R2Bucket, key: string): Promise<HeroFreshnessRecord | null> {
  try {
    const object = await bucket.get(key);
    if (!object) return null;
    return JSON.parse(await object.text()) as HeroFreshnessRecord;
  } catch {
    return null;
  }
}

async function mediaStateRecord(bucket: R2Bucket, key: string): Promise<HeroMediaStateRecord | null> {
  try {
    const object = await bucket.get(key);
    if (!object) return null;
    const record = JSON.parse(await object.text()) as HeroMediaStateRecord;
    if (record.schema_version !== MEDIA_STATE_SCHEMA_VERSION || record.status !== "accepted") return null;
    return record;
  } catch {
    return null;
  }
}

function baselineFor(manifestSource: string, mediaState: HeroMediaStateRecord | null, previous: HeroFreshnessRecord | null): HeroFreshnessRecord["baseline"] {
  if (mediaState?.source_image) {
    return {
      system: "media_state",
      key: `resi-edge-media-state/${slug(mediaState.property_code)}-${slug(mediaState.domain)}/current.json`,
      source_image: mediaState.source_image,
      source_sha256: mediaState.source_sha256 || mediaState.source_metadata?.sha256,
      generated_at: mediaState.generated_at,
    };
  }
  if (previous?.baseline?.system === "manifest" && previous.baseline.source_image === manifestSource) {
    return {
      system: "manifest",
      source_image: manifestSource,
      source_sha256: previous.baseline.source_sha256 || previous.source_metadata?.sha256,
      generated_at: previous.baseline.generated_at || previous.generated_at,
    };
  }
  return {
    system: "manifest",
    source_image: manifestSource,
    source_sha256: previous?.source_metadata?.sha256,
    generated_at: previous?.generated_at,
  };
}

function statusFor(args: {
  manifestSource: string;
  detectedSource: string;
  metadata: SourceMetadata | null;
  baseline: HeroFreshnessRecord["baseline"];
  sourceMethod: string;
}): HeroFreshnessStatus {
  if (!args.detectedSource) return "source_missing";
  if (!args.metadata || args.metadata.http_status < 200 || args.metadata.http_status >= 400) return "source_error";
  const baselineSource = args.baseline?.source_image || args.manifestSource;
  const baselineSha = args.baseline?.source_sha256 || "";
  if (args.detectedSource !== baselineSource) return "refresh_needed";
  if (baselineSha && baselineSha !== args.metadata.sha256) {
    return "refresh_needed";
  }
  if (args.sourceMethod === "og_image_fallback") return "source_missing";
  return "current";
}

async function buildRecord(manifest: ResiEdgeManifest, generatedAt: string, runId: string, fetcher: typeof fetch, bucket: R2Bucket): Promise<HeroFreshnessRecord> {
  const code = sourceCode(manifest);
  const targetDomain = domain(manifest);
  const key = edgeHeroRecordKey(manifest);
  const mediaStateKey = edgeHeroMediaStateKey(manifest);
  const nativeUrl = `https://${targetDomain}/?vtr_source_freshness_probe=${runId}`;
  const manifestSource = normalizeUrl(clean(manifest.mobile_shell?.hero?.source_image), nativeUrl);
  const previous = await previousRecord(bucket, key);
  const mediaState = await mediaStateRecord(bucket, mediaStateKey);
  const baseline = baselineFor(manifestSource, mediaState, previous);

  try {
    const response = await fetcher(nativeUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": DESKTOP_USER_AGENT,
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!response.ok) throw new Error(`Native homepage returned HTTP ${response.status}`);

    const html = await response.text();
    const extracted = extractHeroSourceFromHtml(html, nativeUrl);
    const metadata = extracted.url ? await sourceMetadata(extracted.url, fetcher) : null;
    const status = statusFor({
      manifestSource,
      detectedSource: extracted.url,
      metadata,
      baseline,
      sourceMethod: extracted.method,
    });
    return {
      schema_version: SCHEMA_VERSION,
      generated_at: generatedAt,
      property_code: code,
      domain: targetDomain,
      property_name: clean(manifest.target?.property_name),
      key,
      native_url: nativeUrl,
      manifest_source_image: manifestSource,
      detected_source_image: extracted.url,
      status,
      recommended_action: status === "refresh_needed" ? "regenerate_hero_assets" : status === "current" ? "none" : "check_native_source",
      source_metadata: metadata,
      edge_assets: edgeAssetPaths(manifest),
      source: {
        system: "native_homepage_html",
        selector: "data-page-section=hero data-src",
        extraction_method: extracted.method,
        fetched_at: generatedAt,
      },
      previous: previous
        ? {
            detected_source_image: previous.detected_source_image,
            source_sha256: previous.source_metadata?.sha256,
            generated_at: previous.generated_at,
          }
        : undefined,
      baseline,
    };
  } catch (error) {
    return {
      schema_version: SCHEMA_VERSION,
      generated_at: generatedAt,
      property_code: code,
      domain: targetDomain,
      property_name: clean(manifest.target?.property_name),
      key,
      native_url: nativeUrl,
      manifest_source_image: manifestSource,
      detected_source_image: "",
      status: "source_error",
      recommended_action: "check_native_source",
      source_metadata: null,
      edge_assets: edgeAssetPaths(manifest),
      source: {
        system: "native_homepage_html",
        selector: "data-page-section=hero data-src",
        fetched_at: generatedAt,
      },
      previous: previous
        ? {
            detected_source_image: previous.detected_source_image,
            source_sha256: previous.source_metadata?.sha256,
            generated_at: previous.generated_at,
          }
        : undefined,
      baseline,
      error: error instanceof Error ? error.message : "Unknown hero freshness source error",
    };
  }
}

async function writeJson(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(value, null, 2) + "\n", {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );
  return results;
}

function shouldQueueMediaRefresh(record: HeroFreshnessRecord): boolean {
  if (record.status !== "refresh_needed") return false;
  if (record.previous?.detected_source_image !== record.detected_source_image) return true;
  const previousSha = record.previous?.source_sha256 || "";
  const currentSha = record.source_metadata?.sha256 || "";
  return Boolean(currentSha && previousSha && currentSha !== previousSha);
}

function mediaRefreshQueueMessage(record: HeroFreshnessRecord, runId: string, generatedAt: string): HeroMediaRefreshQueueMessage {
  return {
    schema_version: MEDIA_REFRESH_QUEUE_SCHEMA_VERSION,
    action: "refresh_hero_assets",
    queued_at: generatedAt,
    run_id: runId,
    property_code: record.property_code,
    domain: record.domain,
    property_name: record.property_name,
    freshness_key: record.key,
    media_state_key: `resi-edge-media-state/${slug(record.property_code)}-${slug(record.domain)}/current.json`,
    native_url: record.native_url,
    manifest_source_image: record.manifest_source_image,
    detected_source_image: record.detected_source_image,
    source_sha256: record.source_metadata?.sha256 || "",
    source_metadata: record.source_metadata,
    edge_assets: record.edge_assets,
    transform: {
      width: 750,
      height: 1000,
      fit: "cover",
      gravity: "auto",
      strategy: "cloudflare-images-canary",
    },
    quality_policy: {
      avif_max_bytes: 80_000,
      webp_max_bytes: 80_000,
      start_quality: 78,
      min_avif_quality: 42,
      min_webp_quality: 8,
    },
  };
}

async function enqueueMediaRefreshes(
  env: Env,
  records: HeroFreshnessRecord[],
  runId: string,
  generatedAt: string
): Promise<NonNullable<ResiEdgeHeroFreshnessSyncSummary["media_refresh_queue"]>> {
  const enabled = env.RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED === "true";
  const result = { enabled, write_count: 0, skipped_count: 0, errors: [] as string[] };
  if (!enabled) return result;
  if (!env.RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE) {
    result.errors.push("RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE binding is required when RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED=true.");
    return result;
  }
  for (const record of records.filter((item) => item.status === "refresh_needed")) {
    if (!shouldQueueMediaRefresh(record)) {
      result.skipped_count += 1;
      continue;
    }
    try {
      await env.RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE.send(mediaRefreshQueueMessage(record, runId, generatedAt));
      result.write_count += 1;
    } catch (error) {
      result.errors.push(
        `${record.property_code} ${record.domain}: ${error instanceof Error ? error.message : "Unknown queue send error"}`
      );
    }
  }
  return result;
}

export async function runScheduledResiEdgeHeroFreshnessSync(
  env: Env,
  scheduledAt: Date,
  options: { manifests?: ResiEdgeManifest[]; fetcher?: typeof fetch } = {}
): Promise<ResiEdgeHeroFreshnessSyncSummary> {
  const generatedAt = scheduledAt.toISOString();
  const runId = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const fetcher = options.fetcher || fetch;

  if (env.RESI_EDGE_HERO_FRESHNESS_SYNC_ENABLED === "false") {
    return {
      ok: true,
      skipped: true,
      run_id: runId,
      generated_at: generatedAt,
      property_count: 0,
      current_count: 0,
      refresh_needed_count: 0,
      source_missing_count: 0,
      source_error_count: 0,
      write_count: 0,
      rows: [],
    };
  }

  if (!env.RESI_EDGE_ASSETS) {
    throw new Error("RESI_EDGE_ASSETS binding is required for Resi Edge hero freshness sync.");
  }
  const assetBucket = env.RESI_EDGE_ASSETS;

  try {
    const records = await mapWithConcurrency(
      activeManifests(options.manifests),
      HERO_FRESHNESS_SCAN_CONCURRENCY,
      (manifest) => buildRecord(manifest, generatedAt, runId, fetcher, assetBucket)
    );
    await Promise.all(records.map((record) => writeJson(assetBucket, record.key, record)));

    const rows = records.map((record) => ({
      property_code: record.property_code,
      domain: record.domain,
      property_name: record.property_name,
      key: record.key,
      status: record.status,
      manifest_source_image: record.manifest_source_image,
      detected_source_image: record.detected_source_image,
      source_sha256: record.source_metadata?.sha256 || "",
      recommended_action: record.recommended_action,
      baseline_source: record.baseline?.system,
      error: record.error,
    }));
    const queueResult = await enqueueMediaRefreshes(env, records, runId, generatedAt);
    const summary: ResiEdgeHeroFreshnessSyncSummary = {
      ok: rows.every((row) => row.status !== "source_error") && queueResult.errors.length === 0,
      run_id: runId,
      generated_at: generatedAt,
      property_count: rows.length,
      current_count: rows.filter((row) => row.status === "current").length,
      refresh_needed_count: rows.filter((row) => row.status === "refresh_needed").length,
      source_missing_count: rows.filter((row) => row.status === "source_missing").length,
      source_error_count: rows.filter((row) => row.status === "source_error").length,
      write_count: records.length,
      rows,
      media_refresh_queue: queueResult,
    };
    await writeJson(assetBucket, SUMMARY_KEY, summary);
    await writeJson(assetBucket, `resi-edge-hero-freshness/_runs/${runId}.json`, summary);
    return summary;
  } catch (error) {
    const summary: ResiEdgeHeroFreshnessSyncSummary = {
      ok: false,
      run_id: runId,
      generated_at: generatedAt,
      property_count: 0,
      current_count: 0,
      refresh_needed_count: 0,
      source_missing_count: 0,
      source_error_count: 0,
      write_count: 0,
      rows: [],
      error: error instanceof Error ? error.message : "Unknown Resi Edge hero freshness sync error",
    };
    await writeJson(assetBucket, SUMMARY_KEY, summary);
    await writeJson(assetBucket, `resi-edge-hero-freshness/_runs/${runId}.json`, summary);
    throw error;
  }
}
