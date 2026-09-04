import {
  RESI_EDGE_PACKAGE_ID,
  RESI_EDGE_RELEASE_TOKEN_VERSION,
  RESI_EDGE_RUNTIME_VERSION,
  loadEdgePromoRecord,
  mobileShellHeaders,
  renderMobileShell,
} from "../shared/resi-edge-package/runtime.mjs";

function configKeyFromRequest(request) {
  return request.headers.get("x-vtr-topper-config-key") || "";
}

async function loadTopperConfig(request, env) {
  const key = configKeyFromRequest(request);
  if (!key || !key.startsWith("resi-edge-topper-config/") || !key.endsWith("/current.json")) {
    return { key, manifest: null, error: "missing_or_invalid_topper_config_key" };
  }
  if (!env?.RESI_EDGE_ASSETS) {
    return { key, manifest: null, error: "missing_resi_edge_assets_binding" };
  }
  const object = await env.RESI_EDGE_ASSETS.get(key);
  if (!object) return { key, manifest: null, error: "missing_topper_config_record" };
  try {
    const record = await object.json();
    return { key, manifest: record, error: null };
  } catch {
    return { key, manifest: null, error: "invalid_topper_config_record_json" };
  }
}

function blockedConfigResponse(readout) {
  return Response.json(
    {
      ok: false,
      package_id: RESI_EDGE_PACKAGE_ID,
      runtime_version: RESI_EDGE_RUNTIME_VERSION,
      centralized_topper: true,
      config_key: readout.key,
      error: readout.error,
    },
    { status: 503, headers: { "cache-control": "no-store", "x-vtr-topper-config-state": readout.error || "unknown" } },
  );
}

function blockedRouteResponse(url) {
  return Response.json(
    {
      ok: false,
      package_id: RESI_EDGE_PACKAGE_ID,
      runtime_version: RESI_EDGE_RUNTIME_VERSION,
      centralized_topper: true,
      service_role: "render_only",
      path: url.pathname,
      error: "central_topper_service_render_endpoint_only",
    },
    {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "x-vtr-topper-service-role": "render-only",
      },
    },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const readout = await loadTopperConfig(request, env);
    if (!readout.manifest) return blockedConfigResponse(readout);
    const manifest = readout.manifest;

    if (url.pathname === "/__resi-edge/health") {
      const promoReadout = await loadEdgePromoRecord(env, manifest);
      return Response.json({
        ok: true,
        package_id: RESI_EDGE_PACKAGE_ID,
        runtime_version: RESI_EDGE_RUNTIME_VERSION,
        release_token_version: RESI_EDGE_RELEASE_TOKEN_VERSION,
        centralized_topper: true,
        service_role: "render_only",
        config_key: readout.key,
        manifest_property: manifest.target.property_name,
        manifest_domain: manifest.target.domain,
        desktop_topper_allowed: manifest.desktop.desktop_topper_allowed,
        promo_record: {
          key: promoReadout.key,
          status: promoReadout.status,
          source: promoReadout.source,
          fetched_at: promoReadout.fetched_at,
          present: promoReadout.promo?.present !== false,
        },
      });
    }

    if (url.pathname === "/__resi-edge/render/mobile-shell") {
      if (request.method !== "GET") {
        return Response.json(
          {
            ok: false,
            package_id: RESI_EDGE_PACKAGE_ID,
            runtime_version: RESI_EDGE_RUNTIME_VERSION,
            centralized_topper: true,
            service_role: "render_only",
            error: "method_not_allowed",
          },
          { status: 405, headers: { "cache-control": "no-store", allow: "GET" } },
        );
      }
      const promoReadout = await loadEdgePromoRecord(env, manifest);
      const headers = new Headers(mobileShellHeaders(promoReadout));
      headers.set("x-vtr-topper-mode", "central_render_only");
      headers.set("x-vtr-topper-service-role", "render-only");
      headers.set("x-vtr-topper-config-key", readout.key);
      return new Response(renderMobileShell(request, manifest, promoReadout.promo), {
        headers,
      });
    }

    return blockedRouteResponse(url);
  },
};
