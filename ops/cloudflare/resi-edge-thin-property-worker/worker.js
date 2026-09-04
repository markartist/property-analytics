import manifest from "../../../config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json";
import {
  RESI_EDGE_PACKAGE_ID,
  RESI_EDGE_RELEASE_TOKEN_VERSION,
  RESI_EDGE_RUNTIME_VERSION,
  isHomepage,
  isHtmlRequest,
  isMobileRequest,
  isContentsquareVerifySuppressionRequest,
  isNativeAssetRepairRequest,
  isResiEdgeAssetRequest,
  renderDesktopPassthrough,
  renderNativeContinuationResponse,
  serveContentsquareVerifySuppressed,
  serveNativeAssetRepair,
  serveResiEdgeAsset,
  serveLlmsTxt,
} from "../shared/resi-edge-package/runtime.mjs";

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function targetHost(url) {
  return url.hostname === manifest.target.domain;
}

function configKey() {
  const code = manifest.target.source_property_code || manifest.target.property_code;
  return `resi-edge-topper-config/${slug(code)}-${slug(manifest.target.domain)}/current.json`;
}

function isNativeContinuation(url) {
  return targetHost(url) && isHomepage(url) && url.searchParams.get("__resi_edge_native_continuation") === "1";
}

function isLlmsTxt(request, url) {
  return ["GET", "HEAD"].includes(request.method) && targetHost(url) && url.pathname === "/llms.txt";
}

function isWordPressControlRequest(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return (
    url.pathname === "/wp-login.php" ||
    url.pathname === "/xmlrpc.php" ||
    url.pathname === "/wp-cron.php" ||
    url.pathname === "/wp-comments-post.php" ||
    url.pathname === "/wp-admin" ||
    url.pathname.startsWith("/wp-admin/") ||
    url.pathname === "/wp-json" ||
    url.pathname.startsWith("/wp-json/")
  );
}

function originTransparent(request) {
  return fetch(new Request(request, { redirect: "manual" }));
}

function renderOnlyRequest(request) {
  const url = new URL(request.url);
  url.pathname = "/__resi-edge/render/mobile-shell";
  url.search = "";
  const headers = new Headers(request.headers);
  headers.set("x-vtr-topper-config-key", configKey());
  headers.set("x-vtr-property-domain", manifest.target.domain);
  headers.set("x-vtr-property-code", manifest.target.source_property_code || manifest.target.property_code);
  return new Request(url.toString(), { method: "GET", headers });
}

async function renderMobileShellThroughTopper(request, env) {
  if (!env?.RESI_EDGE_TOPPER) return originTransparent(request);
  try {
    const response = await env.RESI_EDGE_TOPPER.fetch(renderOnlyRequest(request));
    const headers = new Headers(response.headers);
    headers.set("x-vtr-topper-config-key", configKey());
    headers.set("x-vtr-property-worker-role", "traffic-owner");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const response = await originTransparent(request);
    const headers = new Headers(response.headers);
    headers.set("x-vtr-topper-fallback", "origin-transparent");
    headers.set("x-vtr-topper-fallback-reason", "central_render_error");
    headers.set("x-vtr-property-worker-role", "traffic-owner");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/__resi-edge/thin-health") {
      return Response.json({
        ok: true,
        package_id: RESI_EDGE_PACKAGE_ID,
        runtime_version: RESI_EDGE_RUNTIME_VERSION,
        release_token_version: RESI_EDGE_RELEASE_TOKEN_VERSION,
        centralized_topper: true,
        property_worker_mode: "traffic_owner_render_delegate",
        config_key: configKey(),
        manifest_property: manifest.target.property_name,
        manifest_domain: manifest.target.domain,
        desktop_topper_allowed: manifest.desktop.desktop_topper_allowed,
      });
    }

    if (isResiEdgeAssetRequest(url)) return serveResiEdgeAsset(request, env);
    if (targetHost(url) && isNativeAssetRepairRequest(url)) return serveNativeAssetRepair(request);

    if (targetHost(url) && isContentsquareVerifySuppressionRequest(url)) {
      return serveContentsquareVerifySuppressed(request);
    }

    if (isLlmsTxt(request, url)) return serveLlmsTxt(request, manifest);

    if (targetHost(url) && isWordPressControlRequest(request, url)) {
      return originTransparent(request);
    }

    if (request.method !== "GET" || !isHtmlRequest(request) || !targetHost(url)) {
      return fetch(request);
    }

    if (isNativeContinuation(url)) return renderNativeContinuationResponse(request, manifest);

    if (isHomepage(url) && isMobileRequest(request)) {
      return renderMobileShellThroughTopper(request, env);
    }

    return renderDesktopPassthrough(request, manifest);
  },
};
