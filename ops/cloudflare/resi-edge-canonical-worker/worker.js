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
  mobileShellHeaders,
  renderDesktopPassthrough,
  renderMobileShell,
  renderNativeContinuationResponse,
  serveContentsquareVerifySuppressed,
  serveNativeAssetRepair,
  serveResiEdgeAsset,
  serveLlmsTxt,
} from "../shared/resi-edge-package/runtime.mjs";

function isTargetHost(url) {
  return url.hostname === manifest.target.domain;
}

function isNativeContinuation(url) {
  return isTargetHost(url) && isHomepage(url) && url.searchParams.get("__resi_edge_native_continuation") === "1";
}

function isLlmsTxt(request, url) {
  return ["GET", "HEAD"].includes(request.method) && isTargetHost(url) && url.pathname === "/llms.txt";
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

function fetchOriginTransparent(request) {
  return fetch(new Request(request, { redirect: "manual" }), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/__resi-edge/health") {
      return Response.json({
        ok: true,
        package_id: RESI_EDGE_PACKAGE_ID,
        runtime_version: RESI_EDGE_RUNTIME_VERSION,
        release_token_version: RESI_EDGE_RELEASE_TOKEN_VERSION,
        manifest_property: manifest.target.property_name,
        manifest_domain: manifest.target.domain,
        desktop_topper_allowed: manifest.desktop.desktop_topper_allowed,
      });
    }

    if (isResiEdgeAssetRequest(url)) return serveResiEdgeAsset(request, env);
    if (isTargetHost(url) && isNativeAssetRepairRequest(url)) return serveNativeAssetRepair(request);

    if (isTargetHost(url) && isContentsquareVerifySuppressionRequest(url)) {
      return serveContentsquareVerifySuppressed(request);
    }

    if (isLlmsTxt(request, url)) return serveLlmsTxt(request, manifest);

    if (isTargetHost(url) && isWordPressControlRequest(request, url)) {
      return fetchOriginTransparent(request);
    }

    if (request.method !== "GET" || !isHtmlRequest(request) || !isTargetHost(url)) {
      return fetch(request);
    }

    if (isNativeContinuation(url)) return renderNativeContinuationResponse(request, manifest);

    if (isHomepage(url) && isMobileRequest(request)) {
      return new Response(renderMobileShell(request, manifest), {
        headers: mobileShellHeaders(),
      });
    }

    return renderDesktopPassthrough(request, manifest);
  },
};
