#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const runtimePath = resolve(root, "ops/cloudflare/shared/resi-edge-package/runtime.mjs");
const workerPath = resolve(root, "ops/cloudflare/resi-edge-canonical-worker/worker.js");
const centralTopperContractPath = resolve(root, "config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json");
const centralTopperServicePath = resolve(root, "ops/cloudflare/resi-edge-topper-service/worker.js");
const thinPropertyWorkerPath = resolve(root, "ops/cloudflare/resi-edge-thin-property-worker/worker.js");
const heroMediaRefreshWorkerPath = resolve(root, "ops/cloudflare/resi-edge-hero-media-refresh-worker/worker.mjs");
const heroMediaRefreshCanaryRunnerPath = resolve(root, "scripts/run_resi_edge_hero_media_refresh_canary.py");
const apiHeroFreshnessSyncPath = resolve(root, "apps/api/src/platform/resi-edge/hero-freshness-sync.ts");
const apiWranglerPath = resolve(root, "apps/api/wrangler.toml");
const runnerPath = resolve(root, "scripts/run_resi_edge_upgrade.py");
const processAuditorPath = resolve(root, "scripts/audit_resi_edge_rollout_process.py");
const batchAuditorPath = resolve(root, "scripts/audit_resi_edge_rollout_batch.py");
const mobileShellByteForecastPath = resolve(root, "scripts/forecast_resi_edge_mobile_shell_bytes.mjs");
const mobileValidatorPath = resolve(root, "scripts/validate_resi_mobile_shell_contract.mjs");
const generatorPath = resolve(root, "scripts/generate_resi_edge_assets.py");
const uploaderPath = resolve(root, "scripts/upload_resi_edge_assets_to_r2.py");
const deployAdapterPath = resolve(root, "scripts/resi_edge_deploy_adapter.py");
const promoRecordSyncPath = resolve(root, "scripts/sync_resi_edge_promo_records.py");
const topperConfigRecordBuilderPath = resolve(root, "scripts/build_resi_edge_topper_config_records.py");
const zarazAnalyticsPackagePath = resolve(root, "scripts/apply_resi_zaraz_analytics_package.py");
const releaseControlValidatorPath = resolve(root, "scripts/validate_resi_edge_release_control.py");
const releaseTokensPath = resolve(root, "config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json");
const consentContractPath = resolve(root, "ops/cloudflare/shared/resi-consent-widget/contract.json");
const EXPECTED_LBLE_TITLE_TEXT = "Live Better. Live Easy.";
const manifestArgIndex = process.argv.indexOf("--manifest");
const hasManifestArg = manifestArgIndex >= 0;
const manifestRelativePath =
  manifestArgIndex >= 0 && process.argv[manifestArgIndex + 1]
    ? process.argv[manifestArgIndex + 1]
    : "config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json";
const manifestPath = resolve(root, manifestRelativePath);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const runtime = readFileSync(runtimePath, "utf8");
const worker = readFileSync(workerPath, "utf8");
const centralTopperContract = JSON.parse(readFileSync(centralTopperContractPath, "utf8"));
const centralTopperService = readFileSync(centralTopperServicePath, "utf8");
const thinPropertyWorker = readFileSync(thinPropertyWorkerPath, "utf8");
const heroMediaRefreshWorker = readFileSync(heroMediaRefreshWorkerPath, "utf8");
const heroMediaRefreshCanaryRunner = readFileSync(heroMediaRefreshCanaryRunnerPath, "utf8");
const apiHeroFreshnessSync = readFileSync(apiHeroFreshnessSyncPath, "utf8");
const apiWrangler = readFileSync(apiWranglerPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
const processAuditor = readFileSync(processAuditorPath, "utf8");
const batchAuditor = readFileSync(batchAuditorPath, "utf8");
const mobileShellByteForecast = readFileSync(mobileShellByteForecastPath, "utf8");
const mobileValidator = readFileSync(mobileValidatorPath, "utf8");
const generator = readFileSync(generatorPath, "utf8");
const uploader = readFileSync(uploaderPath, "utf8");
const deployAdapter = readFileSync(deployAdapterPath, "utf8");
const promoRecordSync = readFileSync(promoRecordSyncPath, "utf8");
const topperConfigRecordBuilder = readFileSync(topperConfigRecordBuilderPath, "utf8");
const zarazAnalyticsPackage = readFileSync(zarazAnalyticsPackagePath, "utf8");
const releaseControlValidator = readFileSync(releaseControlValidatorPath, "utf8");
const releaseTokens = JSON.parse(readFileSync(releaseTokensPath, "utf8"));
const consentWidget = readFileSync(resolve(root, "ops/cloudflare/shared/resi-consent-widget/widget.mjs"), "utf8");
const consentContract = JSON.parse(readFileSync(consentContractPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const manifestHero = manifest.mobile_shell?.hero || {};
const heroTitleMode = manifestHero.title_mode || "shared_lble_svg";

const forbiddenRuntimeNeedles = [
  "Apex West Midtown",
  "Townestone",
  "Calais",
  "GA4AX",
  "TX4FC",
  "TX4EK",
  "TX4MI",
  "(470)",
  "(346)",
  "pilot.venterradev.com",
  "townestoneat359.com",
  "thevinekyle.com",
  "calaismidtownapartments.com",
];

for (const needle of forbiddenRuntimeNeedles) {
  if (runtime.includes(needle)) fail(`Runtime contains property-specific value: ${needle}`);
}

for (const needle of ["Apex West Midtown", "Now Offering", "(470)", "GA4AX"]) {
  if (worker.includes(needle)) fail(`Worker adapter contains manifest data instead of importing it: ${needle}`);
}

if (!worker.includes("../shared/resi-edge-package/runtime.mjs")) {
  fail("Worker does not import the shared runtime");
}
if (
  centralTopperContract.schema_version !== "resi_edge_central_topper_runtime_v1" ||
  centralTopperContract.non_deviation_contract?.one_shared_topper_runtime !== true ||
  centralTopperContract.non_deviation_contract?.property_specific_topper_scripts_allowed !== false ||
  centralTopperContract.non_deviation_contract?.unversioned_fleet_hotload_allowed !== false ||
  centralTopperContract.delivery_model?.production_default !== "bundled_until_mark_approves_central_canary" ||
  centralTopperContract.edge_record_contract?.config_key_pattern !== "resi-edge-topper-config/<property-code>-<domain>/current.json" ||
  centralTopperContract.edge_record_contract?.promo_key_pattern !== "resi-edge-promo/<property-code>-<domain>/current.json" ||
  centralTopperContract.edge_record_contract?.hero_freshness_key_pattern !== "resi-edge-hero-freshness/<property-code>-<domain>/current.json" ||
  centralTopperContract.edge_record_contract?.hero_media_state_key_pattern !== "resi-edge-media-state/<property-code>-<domain>/current.json" ||
  centralTopperContract.edge_record_contract?.hero_media_refresh_queue !== "resi-edge-hero-media-refresh"
) {
  fail("Central topper contract must preserve the versioned shared runtime plus tokenized config/freshness record model");
}
if (
  !apiWrangler.includes('crons = ["*/15 * * * *"]') ||
  !apiWrangler.includes('binding = "RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE"') ||
  !apiWrangler.includes('queue = "resi-edge-hero-media-refresh"') ||
  !apiWrangler.includes('RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED = "false"') ||
  !apiHeroFreshnessSync.includes("MEDIA_REFRESH_QUEUE_SCHEMA_VERSION") ||
  !apiHeroFreshnessSync.includes("resi_edge_hero_media_refresh_queue.v1") ||
  !apiHeroFreshnessSync.includes("edgeHeroMediaStateKey") ||
  !apiHeroFreshnessSync.includes("baselineFor") ||
  !apiHeroFreshnessSync.includes("RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED") ||
  !apiHeroFreshnessSync.includes("RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE.send") ||
  !apiHeroFreshnessSync.includes("shouldQueueMediaRefresh") ||
  !apiHeroFreshnessSync.includes("cloudflare-images-canary") ||
  !apiHeroFreshnessSync.includes("min_webp_quality: 8")
) {
  fail("Hero freshness sync must keep the 15-minute Cloudflare queue producer disabled by default and media-state aware");
}
if (
  !heroMediaRefreshWorker.includes("resi_edge_hero_media_refresh_queue.v1") ||
  !heroMediaRefreshWorker.includes("resi_edge_hero_media_state.v1") ||
  !heroMediaRefreshWorker.includes("env.IMAGES") ||
  !heroMediaRefreshWorker.includes("RESI_EDGE_HERO_MEDIA_REFRESH_MODE") ||
  !heroMediaRefreshWorker.includes("RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST") ||
  !heroMediaRefreshWorker.includes("NonRetryableRefreshError") ||
  !heroMediaRefreshWorker.includes("budgetQualityCandidates") ||
  !heroMediaRefreshWorker.includes("candidatePrefix") ||
  !heroMediaRefreshWorker.includes("candidate_readbacks") ||
  !heroMediaRefreshWorker.includes("retryable: false") ||
  !heroMediaRefreshWorker.includes("resi-edge-media-state/") ||
  !heroMediaRefreshWorker.includes("resi-edge-media-refresh/_runs/") ||
  !heroMediaRefreshWorker.includes("resi-edge-media-refresh/_candidates/") ||
  !heroMediaRefreshWorker.includes("live_traffic_changed: false") ||
  !heroMediaRefreshWorker.includes("message.retry") ||
  !heroMediaRefreshWorker.includes("RESI_EDGE_ASSETS") ||
  heroMediaRefreshWorker.includes("routes =") ||
  heroMediaRefreshWorker.includes("DNS")
) {
  fail("Hero media refresh Worker must be a Cloudflare Images queue consumer with media-state/readback evidence and no live traffic ownership");
}
if (
  !heroMediaRefreshCanaryRunner.includes("--apply") ||
  !heroMediaRefreshCanaryRunner.includes("worker_config_for_mode") ||
  !heroMediaRefreshCanaryRunner.includes("wrangler.{mode}.toml") ||
  !heroMediaRefreshCanaryRunner.includes("deploy_worker(env, \"disabled\", out_dir=out_dir)") ||
  !heroMediaRefreshCanaryRunner.includes("deploy_worker(env, \"canary\"") ||
  !heroMediaRefreshCanaryRunner.includes("purge_queue(env, QUEUE_NAME)") ||
  !heroMediaRefreshCanaryRunner.includes("purge_queue(env, DLQ_NAME)") ||
  !heroMediaRefreshCanaryRunner.includes("cloudflare_post_message") ||
  !heroMediaRefreshCanaryRunner.includes("read_r2_json") ||
  !heroMediaRefreshCanaryRunner.includes("same_origin_readback") ||
  !heroMediaRefreshCanaryRunner.includes("canary_passed") ||
  !heroMediaRefreshCanaryRunner.includes("resolve_property_identity") ||
  !heroMediaRefreshCanaryRunner.includes("build_runtime_env") ||
  !heroMediaRefreshCanaryRunner.includes("npx_wrangler_prefix") ||
  !heroMediaRefreshCanaryRunner.includes("live_traffic_changed") ||
  !heroMediaRefreshCanaryRunner.includes("mutation_performed")
) {
  fail("Hero media refresh canary runner must stay dry-run-first, Keeper-backed, identity-governed, and apply-capable");
}
if (
  !centralTopperService.includes("../shared/resi-edge-package/runtime.mjs") ||
  !centralTopperService.includes("loadTopperConfig") ||
  !centralTopperService.includes("x-vtr-topper-config-key") ||
  !centralTopperService.includes("/__resi-edge/render/mobile-shell") ||
  !centralTopperService.includes("renderMobileShell(request, manifest, promoReadout.promo)") ||
  centralTopperService.includes("renderDesktopPassthrough(request, manifest)") ||
  centralTopperService.includes("renderNativeContinuationResponse(request, manifest)") ||
  centralTopperService.includes("return fetch(request)") ||
  !centralTopperService.includes('service_role: "render_only"') ||
  !centralTopperService.includes("centralized_topper: true")
) {
  fail("Central topper service must be render-only and must not own desktop, native continuation, or origin fallback traffic");
}
if (
  !thinPropertyWorker.includes("../shared/resi-edge-package/runtime.mjs") ||
  !thinPropertyWorker.includes("env.RESI_EDGE_TOPPER.fetch") ||
  !thinPropertyWorker.includes("/__resi-edge/render/mobile-shell") ||
  !thinPropertyWorker.includes("resi-edge-topper-config/") ||
  !thinPropertyWorker.includes("isWordPressControlRequest") ||
  !thinPropertyWorker.includes("originTransparent") ||
  !thinPropertyWorker.includes("renderDesktopPassthrough(request, manifest)") ||
  !thinPropertyWorker.includes("renderNativeContinuationResponse(request, manifest)") ||
  !thinPropertyWorker.includes('property_worker_mode: "traffic_owner_render_delegate"') ||
  !thinPropertyWorker.includes("x-vtr-topper-config-key") ||
  !thinPropertyWorker.includes("centralized_topper: true")
) {
  fail("Centralized property Worker must own traffic/native/desktop paths and delegate only mobile shell rendering to the central service");
}
if (
  !topperConfigRecordBuilder.includes("resi-edge-topper-config/") ||
  !topperConfigRecordBuilder.includes("resi-edge-promo/") ||
  !topperConfigRecordBuilder.includes("resi-edge-hero-freshness/") ||
  !topperConfigRecordBuilder.includes("build_runtime_env") ||
  !topperConfigRecordBuilder.includes("npx_wrangler_prefix") ||
  !topperConfigRecordBuilder.includes("--upload") ||
  !topperConfigRecordBuilder.includes("compact_shell_pill_v29_2026_08_20") ||
  !topperConfigRecordBuilder.includes("286627304")
) {
  fail("Central topper config record builder must emit tokenized property records with promo/hero freshness keys and Keeper-backed optional upload");
}
if (!worker.includes("serveResiEdgeAsset") || !worker.includes("isResiEdgeAssetRequest")) {
  fail("Worker does not expose the canonical R2 asset route");
}
if (
  !runtime.includes("isYooThemeUploadThumbnailRepairRequest") ||
  !runtime.includes('x-vtr-native-asset-repair", "yootheme-upload-src') ||
  !runtime.includes('url.searchParams.get("src")')
) {
  fail("Runtime does not repair same-origin YooTheme generated upload thumbnail misses");
}
if (!runtime.includes("CONTENTSQUARE_VERIFY_SUPPRESS_PATH") || !runtime.includes("data-vtr-cs-verify-suppress")) {
  fail("Runtime does not include the canonical Contentsquare verify suppression guard");
}
if (
  !runtime.includes("function renderHeapEnvironmentScript") ||
  !runtime.includes("data-vtr-heap-environment") ||
  !runtime.includes("__vtrHeapEnvironment") ||
  !runtime.includes("HEAP_APP_ID") ||
  !runtime.includes("HEAP_ENVIRONMENT") ||
  !runtime.includes("HEAP_MODE") ||
  !runtime.includes("HEAP_JS_DEBUG") ||
  !runtime.includes('<script data-vtr-edge-analytics="1" data-vtr-heap-environment="1">') ||
  !runtime.includes('html.replace("</head>", `${renderHeapEnvironmentScript(manifest)}</head>`)') ||
  !runtime.includes("element.prepend(renderHeapEnvironmentScript(this.manifest)")
) {
  fail("Runtime must preserve Heap environment variables in the canonical header without reintroducing a direct Heap loader");
}
if (
  !runtime.includes("function trackingAttrs") ||
  !runtime.includes("data-vtr-action") ||
  !runtime.includes("data-vtr-surface") ||
  !runtime.includes("data-vtr-element") ||
  !runtime.includes("data-vtr-destination") ||
  !runtime.includes("vtrEdgeElementPayload") ||
  !runtime.includes("drawer_nav_${slug(label)}_${index + 1}") ||
  !runtime.includes("data-vtr-track")
) {
  fail("Runtime must render differentiated Heap/Zaraz tracking attributes for all mobile shell/topper actions");
}
if (
  !runtime.includes('emit("page_view"') ||
  !runtime.includes('vtr_event_family:"page_lifecycle"') ||
  !runtime.includes("vtr_resi_view_event:c[5]") ||
  !runtime.includes("w.__vtrEdgeQueue=w.__vtrEdgeQueue||[]") ||
  !runtime.includes("w.GA_MEASUREMENT_ID=w.GA_MEASUREMENT_ID||g") ||
  !runtime.includes('w.gtag("config",g)') ||
  !runtime.includes("w.vtrEdgeFlush=flush") ||
  !runtime.includes("emit(c[5]") ||
  !runtime.includes('vtr_event_family:"resi_edge_view"')
) {
  fail("Runtime must emit an explicit package-owned GA4 page_view before the Resi custom view event and queue Zaraz events until ready");
}
if (
  !zarazAnalyticsPackage.includes('"ResiEdgePageview"') ||
  !zarazAnalyticsPackage.includes('"value": "^page_view$"') ||
  !zarazAnalyticsPackage.includes('"value": "page_view"') ||
  !zarazAnalyticsPackage.includes('"firingTriggers": ["ResiEdgePageview"]')
) {
  fail("Zaraz analytics package must map package-owned page_view events to the GA4 pageview action without sending them as generic custom events");
}
if (
  !runtime.includes("function compactSameOriginUrl") ||
  !runtime.includes("function renderNavLinks(manifest)") ||
  !runtime.includes("manifest.mobile_shell.navigation?.links") ||
  !runtime.includes("filter((link) => link?.label && link?.url)") ||
  runtime.includes("DEFAULT_DRAWER_LINK_LIMIT") ||
  runtime.includes("DRAWER_LINK_PRIORITIES") ||
  runtime.includes(".slice(0, DEFAULT_DRAWER_LINK_LIMIT)") ||
  !runtime.includes('trackingAttrs(linkAction(label, href), "mobile_drawer", element, label, href)') ||
  !runtime.includes("function minifyShellHtml") ||
  !runtime.includes("return minifyShellHtml(shellHtml)") ||
  !runtime.includes("pathOrAbsolute(link.url, manifest)") ||
  !runtime.includes("renderReviewLink(rating, manifest)") ||
  !runtime.includes("pathOrAbsolute(block.cta_url, manifest)") ||
  !runtime.includes("pathOrAbsolute(hero.primary_cta_url, manifest)")
) {
  fail("Runtime must render the full manifest drawer nav with per-link tracking attributes, compact same-origin shell URLs, and minify the canonical mobile shell before live byte gates");
}
if (
  !runtime.includes("max-width:calc(100% - 174px)") ||
  !runtime.includes("white-space:normal") ||
  runtime.includes(".brand{height:var(--header-height);display:flex;align-items:center;font-size:10px;font-weight:700;line-height:16px;letter-spacing:var(--header-letter-spacing);text-transform:uppercase;white-space:nowrap")
) {
  fail("Runtime mobile header brand must wrap long property names inside the reserved action width instead of clipping");
}
if (
  !runtime.includes("function buildOriginRequest(request, options = {})") ||
  !runtime.includes("options.forceHomepage !== false") ||
  !runtime.includes('headers.set("accept-language", source.get("accept-language") || "en-US,en;q=0.9")') ||
  !runtime.includes('headers.set("sec-fetch-mode", source.get("sec-fetch-mode") || "navigate")') ||
  !runtime.includes("fetch(buildOriginRequest(request, { forceHomepage: false }), { cf: { cacheEverything: false, cacheTtl: 0 } })")
) {
  fail("Runtime desktop pass-through must use the canonical normalized origin request with browser-like navigation headers and no Cloudflare caching");
}
if (
  !runtime.includes("googletagmanager\\.com\\/gtm\\.js") ||
  !runtime.includes("/\\bGTM-[A-Z0-9]+\\b/i") ||
  !runtime.includes("/\\bdataLayer\\b/i") ||
  !runtime.includes("stripMatchingScriptBlocks(cleaned, (_attrs, body) => {")
) {
  fail("Runtime desktop pass-through must strip native GTM bootstrap scripts while preserving the Zaraz-owned analytics bridge");
}
if (
  !runner.includes("MOBILE_SHELL_BYTE_FORECAST") ||
  !runner.includes("MOBILE_SHELL_INITIAL_HTML_MAX_BYTES = 40_000") ||
  !runner.includes("DESKTOP_PSI_TARGET = 90") ||
  !runner.includes('"desktop_native_passthrough": DESKTOP_PSI_TARGET') ||
  runner.includes('"desktop": "recorded_only_native_passthrough_not_blocking"') ||
  !runner.includes('"below_target_scores_retry": True') ||
  !runner.includes("mobile_shell_byte_forecast") ||
  !runner.includes("--max-bytes") ||
  !runner.includes("existing_worker_no_delete") ||
  !runner.includes("audit_source_page") ||
  !runner.includes("mobile_browser_equivalent_fetch") ||
  !runner.includes("Resi Website Management Firewall") ||
  !mobileShellByteForecast.includes("renderMobileShell(request, manifest)") ||
  !mobileShellByteForecast.includes("initial_html_bytes") ||
  !mobileShellByteForecast.includes("drawer_links_rendered") ||
  !mobileShellByteForecast.includes("same_domain_absolute_url_count")
) {
  fail("Runner must forecast generated mobile shell bytes from the deploy bundle before live byte gates");
}
if (
  !runner.includes("heapEnvironmentScriptPresent") ||
  !runner.includes("trackedShellElements") ||
  !runner.includes("drawerNavLinks") ||
  !runner.includes("expected_drawer_labels") ||
  !runner.includes("mobile drawer nav labels missing from manifest order") ||
  !runner.includes("mobile drawer nav links have incomplete Heap/Zaraz attributes") ||
  !runner.includes("tracked_shell_event_proof") ||
  !runner.includes("mobile menu open event payload is not differentiated") ||
  !runner.includes("mobile shell tracked elements missing")
) {
  fail("Runner must browser-prove Heap environment preservation, full manifest drawer nav, and differentiated mobile shell/topper event payloads");
}
if (
  !runner.includes('EXPECTED_HEAP_APP_ID = "286627304"') ||
  !runner.includes("REQUIRED_MOBILE_NAV_LABELS") ||
  !runner.includes("promoted manifest must not retain draft-only field") ||
  !runner.includes("analytics.ga4.measurement_id_status must declare a configured/Zaraz-owned state") ||
  !runner.includes("analytics.heap.app_id must be production Heap app id") ||
  !runner.includes("mobile_shell.navigation.links missing required labels") ||
  !runner.includes("must not use the draft placeholder lato-regular.woff2 path") ||
  !runner.includes("analytics.ahrefs.existing_project_id must be a numeric verified vanity project id") ||
  !runner.includes("rollback.no_wordpress_mutation_required must be true for the Resi Edge package")
) {
  fail("Runner must include the promoted-manifest drift guard for stale draft fields, analytics ownership, Heap, nav, Ahrefs, and rollback");
}
if (!runner.includes('"--force-republish"') || !runner.includes('"republished"')) {
  fail("Runner must force-republish canonical Zaraz analytics config and accept the republished status before live proof");
}
if (
  !runner.includes("PROCESS_AUDITOR") ||
  !runner.includes("BATCH_AUDITOR") ||
  !runner.includes("batch_inventory_audit_passed") ||
  !runner.includes("process_scenario_audit_passed") ||
  !runner.includes("run_batch_inventory_audit") ||
  !runner.includes("run_process_scenario_audit") ||
  !runner.includes("run_dashboard_finalization") ||
  !runner.includes("dashboard-finalization.json") ||
  !runner.includes("phase-timings.json") ||
  !runner.includes("phase_timings") ||
  !processAuditor.includes("resi_edge_process_scenario_audit_v1") ||
  !processAuditor.includes("draft_stage_retained") ||
  !processAuditor.includes("stale_consent_version") ||
  !processAuditor.includes("ga4_status_wordpress_owned") ||
  !processAuditor.includes("wrong_heap_id") ||
  !processAuditor.includes("incomplete_drawer_nav_reviews_missing") ||
  !processAuditor.includes("bad_tour_url") ||
  !processAuditor.includes("desktop_topper_allowed") ||
  !processAuditor.includes("property_specific_variant_allowed") ||
  !processAuditor.includes("hero_asset_not_same_origin_avif") ||
  !batchAuditor.includes("resi_edge_batch_rollout_audit_v1") ||
  !batchAuditor.includes("duplicate active production domain manifest") ||
  !batchAuditor.includes("duplicate active production property-code manifest") ||
  !batchAuditor.includes("release token canary_manifest is not an active production manifest")
) {
  fail("Runner must include the blocking batch inventory and process scenario audits for known rollout drift states");
}
if (
  !runtime.includes("resi-edge-release-tokens.v1.json") ||
  !runtime.includes("RESI_EDGE_RELEASE_TOKEN_VERSION") ||
  !runtime.includes("data-vtr-release-token") ||
  !runtime.includes("x-vtr-release-token") ||
  !runtime.includes("--promo-bar-height") ||
  !runtime.includes("--header-height") ||
  !worker.includes("release_token_version")
) {
  fail("Runtime/worker do not consume and expose the canonical release token contract");
}
if (
  !runtime.includes("EDGE_PROMO_RECORD_SCHEMA_VERSION") ||
  !runtime.includes("EDGE_PROMO_RECORD_MAX_AGE_MS") ||
  !runtime.includes("export function edgePromoRecordKey") ||
  !runtime.includes("export async function loadEdgePromoRecord") ||
  !runtime.includes("normalizeEdgePromoRecord") ||
  !runtime.includes("propertyBannerSpecial") ||
  !runtime.includes("manifest_fallback_missing_record") ||
  !runtime.includes("edge_record_current") ||
  !runtime.includes("edge_record_absent") ||
  !runtime.includes("x-vtr-promo-state") ||
  !runtime.includes("x-vtr-promo-source") ||
  !worker.includes("loadEdgePromoRecord") ||
  !worker.includes("promo_record") ||
  !worker.includes("mobileShellHeaders(promoReadout)") ||
  !worker.includes("renderMobileShell(request, manifest, promoReadout.promo)") ||
  !runner.includes('startswith("manifest_fallback_")') ||
  !runner.includes("manifest fallback is not allowed for live proof") ||
  !promoRecordSync.includes("propertyBannerSpecial") ||
  !promoRecordSync.includes("thirtylines_feed_snapshots") ||
  !promoRecordSync.includes("edge_promo_record_key") ||
  !promoRecordSync.includes('"--upload"') ||
  !promoRecordSync.includes("build_runtime_env") ||
  !promoRecordSync.includes("npx_wrangler_prefix") ||
  !promoRecordSync.includes('"r2"') ||
  !promoRecordSync.includes('"object"') ||
  !promoRecordSync.includes('"put"')
) {
  fail("Runtime must read feed-backed promo records from edge storage and the sync tool must build/upload those records from Data Pond propertyBannerSpecial");
}
if (
  !runtime.includes('OFFICIAL_LBLE_SVG_PATH = "/assets/resi-edge-assets/shared/lble.svg"') ||
  !runtime.includes("SHARED_LBLE_TITLE_TEXT") ||
  !runtime.includes("function heroTitleMode") ||
  !runtime.includes("function heroTitleSvgPath") ||
  !runtime.includes("data-vtr-hero-title-mode") ||
  !runtime.includes("hero-title-art") ||
  !runtime.includes("hero-title-art img") ||
  !runtime.includes("--hero-title-max-width") ||
  !runtime.includes("hero-headline") ||
  runtime.includes("hero-title-text") ||
  runtime.includes("title_render_mode")
) {
  fail("Runtime does not enforce the approved same-origin SVG hero title contract");
}
if (
  !runtime.includes("../resi-consent-widget/widget.mjs") ||
  !runtime.includes("renderZarazConsentPillScript") ||
  consentWidget.includes("import contract from") ||
  !consentWidget.includes(`data-vtr-zaraz-consent-version="\${version}"`) ||
  !consentWidget.includes(consentContract.version) ||
  !consentWidget.includes(consentContract.visible_text) ||
  !consentWidget.includes("vtr-cookie-manage") ||
  !consentWidget.includes("showConsentModal")
) {
  fail("Runtime does not consume the shared finalized consent widget contract");
}
if (
  !consentWidget.includes("function compact()") ||
  !consentWidget.includes("function markCompact(el)") ||
  !consentWidget.includes("[data-vtr-edge-mobile-shell='1']") ||
  !consentWidget.includes("el.dataset.vtrCompact=\"1\"") ||
  !consentWidget.includes("#vtr-cookie-notice[data-vtr-compact='1']") ||
  !consentWidget.includes("#vtr-cookie-notice[data-vtr-compact='1'] #vtr-cookie-icon{width:26px;height:26px}") ||
  !consentWidget.includes("#vtr-cookie-notice[data-vtr-compact='1'] #vtr-cookie-icon svg{width:22px;height:22px}") ||
  !consentWidget.includes("#vtr-cookie-manage{min-width:198px;border:2px solid rgba(125,202,194,.24);background:#FFFFFF;color:#3D66B9") ||
  !consentWidget.includes("gap:8px") ||
  !consentWidget.includes("height:36px") ||
  !consentWidget.includes("flex:1 1 0;min-width:0;font-size:14px") ||
  !consentWidget.includes("flex:0 1 auto;gap:6px;max-width:51%;min-width:164px") ||
  !consentWidget.includes("#vtr-cookie-notice[data-vtr-compact='1'] #vtr-cookie-manage{width:92px;min-width:0;max-width:92px;color:#3D66B9}") ||
  !consentWidget.includes("#vtr-cookie-notice[data-vtr-compact='1'] #vtr-cookie-accept{width:66px;min-width:0;max-width:66px}") ||
  consentWidget.includes("body[data-vtr-edge-mobile-shell='1'] #vtr-cookie-notice") ||
  consentWidget.includes("#vtr-cookie-icon{display:none}") ||
  consentWidget.includes("grid-template-columns:auto 1fr")
) {
  fail("Shared consent widget must use the responsive compact mobile-shell layout with cookie icon, subdued Preferences label, and bounded action controls; stale tall mobile consent is forbidden");
}
if (
  !consentWidget.includes("visualViewport") ||
  !consentWidget.includes("__vtrZarazConsentViewportFit") ||
  !consentWidget.includes('el.style.bottom="auto"') ||
  !consentWidget.includes("offsetHeight")
) {
  fail("Shared consent widget must fit to the real mobile visual viewport so the Preferences control remains visible and provable");
}
if (
  runtime.includes("vtr-cookie-reject") ||
  runtime.includes("We use cookies to improve site performance and measure leasing activity") ||
  consentWidget.includes("vtr-cookie-reject") ||
  consentWidget.includes("We use cookies to improve site performance and measure leasing activity")
) {
  fail("Runtime contains local stale consent notice behavior instead of shared widget consumption");
}
if (
  !runner.includes("CONSENT_CONTRACT_PATH") ||
  !runner.includes("EXPECTED_CONSENT_WIDGET_VERSION") ||
  !runner.includes("CONSENT_WIDGET_GEOMETRY") ||
  !runner.includes("consent-widget-geometry.json") ||
  !runner.includes("vtr-cookie-manage") ||
  !runner.includes("showConsentModal") ||
  !runner.includes("rejectButtonPresent") ||
  !runner.includes("proofViewportHeight") ||
  !runner.includes("buttonHitTargetOk") ||
  !runner.includes('document.querySelector("#vtr-cookie-manage")?.click()')
) {
  fail("Runner does not enforce the shared finalized consent widget proof contract");
}
if (!runtime.includes("data-vtr-lazy-src") || !runtime.includes("data-vtr-deferred-shell-images")) {
  fail("Runtime does not defer shell content-block images through the canonical lazy image loader");
}
if (
  !runtime.includes("function renderAwards") ||
  !runtime.includes("data-vtr-shell-awards") ||
  !runtime.includes("panel-awards") ||
  !runtime.includes("/assets/resi-edge-assets/shared/kingsley-award.svg") ||
  !runtime.includes("asset?.src")
) {
  fail("Runtime does not render sourced awards/badges through the shared same-origin award contract");
}
if (
  !runtime.includes("function renderBullets") ||
  !runtime.includes("data-vtr-shell-bullets") ||
  !runtime.includes("panel-bullets")
) {
  fail("Runtime does not render manifest-backed content-block bullets");
}
if (
  !runtime.includes("@keyframes vtrFadeUp") ||
  !runtime.includes("prefers-reduced-motion") ||
  !runtime.includes("animation-delay") ||
  !runtime.includes(".hero .rating,.hero .hero-title-art,.hero .hero-headline,.hero .cta")
) {
  fail("Runtime does not enforce the native hero fade/stagger contract");
}
if (
  !runtime.includes("calc(100svh - var(--promo-bar-height) - var(--header-height))") ||
  !runtime.includes("body.no-promo .hero") ||
  runtime.includes(".hero{height:704px") ||
  runtime.includes(".hero{min-height:640px")
) {
  fail("Runtime must make the mobile hero fill the first viewport below the promo/header without fixed-height drift");
}
if (
  !runtime.includes("function preferredMobileHeroImage") ||
  !runtime.includes('match.replace(/\\.avif/i, ".webp")') ||
  !runtime.includes('width="750" height="1000"') ||
  runtime.includes('src="${escapeAttr(hero.image_mobile)}" width="640" height="900"')
) {
  fail("Runtime must use the generated WebP hero as the mobile LCP image with canonical 750x1000 dimensions");
}
if (!runtime.includes("content-visibility:auto") || !runtime.includes("contain-intrinsic-size")) {
  fail("Runtime must defer below-fold content-block rendering without changing the shell sequence");
}
if (/panel-media"><img\s+src=/i.test(runtime)) {
  fail("Runtime eagerly emits content-block image src attributes in the initial mobile shell");
}
if (
  !generator.includes("MOBILE_HERO_AVIF_MAX_BYTES = 80_000") ||
  !generator.includes("CONTENT_BLOCK_AVIF_MAX_BYTES = 55_000")
) {
  fail("Asset generator does not enforce canonical mobile hero/content-block AVIF budgets");
}
if (!runner.includes("run_asset_generation_and_upload") || !runner.includes("ASSET_UPLOADER") || !runner.includes("MOBILE_PSI_PARITY_TARGET = 98")) {
  fail("Runner does not enforce canonical asset generation/upload and mobile PSI parity gates");
}
if (
  !releaseControlValidator.includes("resi_edge_release_tokens_v1") ||
  !releaseControlValidator.includes("live_apply_without_stage_allowed") ||
  !releaseControlValidator.includes("analytics_direct_wp_scripts_allowed") ||
  !releaseControlValidator.includes("consent_widget_local_forks_allowed")
) {
  fail("Release-control validator does not enforce the current no-drift release rules");
}
if (!uploader.includes("build_runtime_env") || !uploader.includes("--apply")) {
  fail("R2 uploader must use Keeper-backed Wrangler auth and support governed apply mode");
}
if (uploader.includes("\"--force\"")) {
  fail("R2 uploader must not use obsolete Wrangler --force usage");
}
if (
  !uploader.includes("IMMUTABLE_CACHE_CONTROL = \"public, max-age=31536000, immutable\"") ||
  !uploader.includes("--content-type") ||
  !uploader.includes("--cache-control")
) {
  fail("R2 uploader must set canonical content-type and immutable cache metadata during upload");
}
if (
  !deployAdapter.includes("CONSENT_WIDGET") ||
  !deployAdapter.includes("RELEASE_TOKENS") ||
  !deployAdapter.includes("release-tokens.json") ||
  !deployAdapter.includes("UNASSIGNED_WORKER_SENTINELS") ||
  !deployAdapter.includes('"not_yet_recorded"') ||
  !deployAdapter.includes('return f"resi-edge-canonical-{slugify(domain)}"') ||
  !deployAdapter.includes("STALE_ROUTE_OWNER_SENTINELS") ||
  !deployAdapter.includes("remove_stale_sentinel_route") ||
  !deployAdapter.includes("selected_worker_name") ||
  !deployAdapter.includes('routing.get("existing_worker_script")') ||
  !deployAdapter.includes("def validate_deploy_bundle") ||
  !deployAdapter.includes("--validate-bundle") ||
  !deployAdapter.includes("./resi-consent-widget/widget.mjs") ||
  !deployAdapter.includes("--topper-mode") ||
  !deployAdapter.includes("topper_mode == \"centralized\"") ||
  !deployAdapter.includes("THIN_PROPERTY_WORKER") ||
  !deployAdapter.includes("CENTRAL_TOPPER_SERVICE") ||
  !deployAdapter.includes("validate_centralized_apply_proof") ||
  !deployAdapter.includes("latest-central-topper-local-proof.json") ||
  !deployAdapter.includes('binding = "RESI_EDGE_TOPPER"') ||
  !deployAdapter.includes('service = "resi-edge-topper-service"') ||
  !deployAdapter.includes("Centralized property Worker must delegate mobile shell rendering to the central service")
) {
  fail("Deploy adapter must prove generated bundle closure and canonical Worker naming before live route work");
}
if (
  releaseTokens.schema_version !== "resi_edge_release_tokens_v1" ||
  releaseTokens.package_contract_id !== "resi-edge-canonical-upgrade-package" ||
  !releaseTokens.active_token_version ||
  !releaseTokens.defaults?.mobile_shell?.promo_bar?.height_px ||
  !releaseTokens.defaults?.mobile_shell?.header?.height_px
) {
  fail("Release token file is missing the active tokenized mobile shell defaults");
}
if (!worker.includes("serveContentsquareVerifySuppressed") || !worker.includes("isContentsquareVerifySuppressionRequest")) {
  fail("Worker does not expose the canonical same-origin Contentsquare verify suppression endpoint");
}
if (
  !mobileValidator.includes("isStandaloneHeapDebugFlag") ||
  !mobileValidator.includes("HEAP_JS_DEBUG") ||
  !mobileValidator.includes("direct_native_analytics_blockers")
) {
  fail("Mobile shell validator must allow standalone Heap debug environment flags while still blocking direct native analytics loaders");
}
const wpBypassBranchIndex = worker.indexOf("if (isTargetHost(url) && isWordPressControlRequest(request, url))");
const mobileShellBranchIndex = worker.indexOf("isHomepage(url) && isMobileRequest(request)");
const nativeContinuationBranchIndex = worker.indexOf("if (isNativeContinuation(url))");
if (
  !worker.includes("function isWordPressControlRequest") ||
  !worker.includes('request.method !== "GET" && request.method !== "HEAD"') ||
  !worker.includes('url.pathname === "/wp-login.php"') ||
  !worker.includes('url.pathname === "/xmlrpc.php"') ||
  !worker.includes('url.pathname === "/wp-cron.php"') ||
  !worker.includes('url.pathname === "/wp-comments-post.php"') ||
  !worker.includes('url.pathname === "/wp-admin"') ||
  !worker.includes('url.pathname.startsWith("/wp-admin/")') ||
  !worker.includes('url.pathname === "/wp-json"') ||
  !worker.includes('url.pathname.startsWith("/wp-json/")') ||
  !worker.includes("function fetchOriginTransparent") ||
  !worker.includes('redirect: "manual"')
) {
  fail("Worker does not enforce the transparent WordPress control-path bypass contract");
}
const transparentFetchBody = worker.slice(
  worker.indexOf("function fetchOriginTransparent"),
  worker.indexOf("export default")
);
if (transparentFetchBody.includes("cacheEverything") || transparentFetchBody.includes("cacheTtl")) {
  fail("WordPress control-path bypass must not apply Cloudflare cache overrides");
}
if (
  wpBypassBranchIndex < 0 ||
  mobileShellBranchIndex < 0 ||
  nativeContinuationBranchIndex < 0 ||
  wpBypassBranchIndex > mobileShellBranchIndex ||
  wpBypassBranchIndex > nativeContinuationBranchIndex
) {
  fail("Worker must run the WordPress control-path bypass before mobile shell and native continuation routing");
}
if (!hasManifestArg && !worker.includes("championsgreen-ga-com.manifest.json")) {
  fail("Canonical worker does not import the Champions base manifest");
}
if (manifest.package_contract_id !== "resi-edge-canonical-upgrade-package") {
  fail("Base manifest has wrong package contract id");
}
if (manifest.desktop?.desktop_topper_allowed !== false) {
  fail("Base manifest must explicitly disallow desktop topper");
}
if (manifest.mobile_shell?.hero && Object.prototype.hasOwnProperty.call(manifest.mobile_shell.hero, "image_desktop")) {
  fail("Manifest must not declare mobile_shell.hero.image_desktop; desktop is native pass-through and has no package-owned hero asset");
}
if (Object.prototype.hasOwnProperty.call(manifest.mobile_shell?.hero || {}, "title_render_mode")) {
  fail("Manifest must not declare hero title_render_mode; use title_mode with the approved SVG title contract");
}
if (
  Object.prototype.hasOwnProperty.call(manifest.mobile_shell?.hero || {}, "title_asset") ||
  Object.prototype.hasOwnProperty.call(manifest.mobile_shell?.hero || {}, "title_asset_text")
) {
  fail("Manifest must not declare hero title_asset fields; use title_svg with the approved SVG title contract");
}
if (heroTitleMode === "shared_lble_svg") {
  if (manifestHero.title_text !== EXPECTED_LBLE_TITLE_TEXT) {
    fail(`Manifest shared hero title_text must be ${EXPECTED_LBLE_TITLE_TEXT}`);
  }
  if (manifestHero.title_svg) {
    fail("Manifest shared_lble_svg mode must not declare a property title_svg");
  }
} else if (heroTitleMode === "property_tagline_svg") {
  if (!manifestHero.title_text) {
    fail("Manifest property_tagline_svg mode requires title_text for the accessible label");
  }
  if (!/^\/assets\/resi-edge-assets\/[^"'<>\s]+\.svg$/i.test(manifestHero.title_svg || "")) {
    fail("Manifest property_tagline_svg mode requires a same-origin title_svg");
  }
  if (!Array.isArray(manifestHero.title_svg_lines) || manifestHero.title_svg_lines.length < 1) {
    fail("Manifest property_tagline_svg mode requires title_svg_lines");
  }
} else {
  fail(`Manifest hero title_mode is not approved: ${heroTitleMode}`);
}
if (manifest.analytics?.owner !== "cloudflare_zaraz") {
  fail("Base manifest must assign analytics owner to Cloudflare Zaraz");
}
if (manifest.analytics?.ga4?.measurement_id_status && !/configured|zaraz/i.test(manifest.analytics.ga4.measurement_id_status)) {
  fail("Manifest GA4 measurement_id_status must not declare a direct WordPress load requirement");
}
if (manifest.analytics?.heap?.mode !== "interaction_only_queue_v6_input_only_cs_verify_home_204") {
  fail("Manifest Heap mode must be interaction_only_queue_v6_input_only_cs_verify_home_204");
}
if (manifest.analytics?.heap?.passive_timer_allowed !== false) {
  fail("Manifest Heap passive timers must be disallowed");
}
if (
  manifest.analytics?.heap?.contentsquare_verify_guard?.enabled !== true ||
  manifest.analytics?.heap?.contentsquare_verify_guard?.same_origin_path !== "/?vtr_cs_verify_suppressed=1" ||
  manifest.analytics?.heap?.contentsquare_verify_guard?.expected_status !== 204
) {
  fail("Manifest must declare the canonical same-origin Contentsquare verify 204 guard");
}
if (manifest.consent?.owner !== "cloudflare_zaraz_consent") {
  fail("Base manifest must assign consent owner to Cloudflare Zaraz Consent");
}
if (manifest.consent?.widget_version !== consentContract.version) {
  fail(`Manifest must declare shared consent widget version ${consentContract.version}`);
}
if (manifest.phone_attribution?.default_source !== "VWS") {
  fail("Base manifest must default to VWS");
}
if (!Array.isArray(manifest.mobile_shell?.content_blocks) || manifest.mobile_shell.content_blocks.length < 2) {
  fail("Base manifest must include the first two content blocks");
}
if (manifest.mobile_shell?.hero?.tm_allowed !== false) {
  fail("Base manifest must explicitly disallow edge-added TM");
}
if (process.exitCode) process.exit();

const releaseControl = spawnSync("python3", [releaseControlValidatorPath], {
  cwd: root,
  encoding: "utf8",
});
if (releaseControl.status !== 0) {
  fail(`Release-control validation failed:\n${releaseControl.stdout || ""}${releaseControl.stderr || ""}`);
}
if (process.exitCode) process.exit();

console.log(JSON.stringify({
  pass: true,
  runtime: runtimePath,
  worker: workerPath,
  manifest: manifestPath,
  package_id: manifest.package_contract_id,
  release_token: releaseTokens.active_token_version,
  property: manifest.target.property_name,
  domain: manifest.target.domain
}, null, 2));
