const QUEUE_SCHEMA_VERSION = "resi_edge_hero_media_refresh_queue.v1";
const MEDIA_STATE_SCHEMA_VERSION = "resi_edge_hero_media_state.v1";
const FRESHNESS_SCHEMA_VERSION = "resi_edge_hero_freshness_record.v1";
const WORKER_VERSION = "2026-09-01.cloudflare-images-queue-v1";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

class NonRetryableRefreshError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "NonRetryableRefreshError";
    this.retryable = false;
    this.status = details.status || "refresh_failed_non_retryable";
    this.details = details;
  }
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function nowIso(options = {}) {
  return options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
}

function mediaStateKey(message) {
  return message.media_state_key || `resi-edge-media-state/${slug(message.property_code)}-${slug(message.domain)}/current.json`;
}

function runReceiptKey(message, status, generatedAt) {
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const runId = slug(message.run_id);
  const sourceHash = clean(message.source_sha256).slice(0, 12) || "nohash";
  const receiptId = runId && runId !== "unknown" ? runId : stamp;
  return `resi-edge-media-refresh/_runs/${receiptId}-${slug(message.property_code)}-${slug(message.domain)}-${status}-${sourceHash}.json`;
}

function candidatePrefix(message, generatedAt) {
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const runId = slug(message.run_id);
  const receiptId = runId && runId !== "unknown" ? runId : stamp;
  const sourceHash = clean(message.source_sha256).slice(0, 12) || "nohash";
  return `resi-edge-media-refresh/_candidates/${receiptId}-${slug(message.property_code)}-${slug(message.domain)}-${sourceHash}/`;
}

export function r2KeyFromAssetPath(path) {
  const value = clean(path);
  if (!value) throw new Error("Missing hero asset path.");
  let candidate = value;
  try {
    const url = new URL(value, "https://assets.venterradev.com");
    candidate = url.pathname;
  } catch {
    candidate = value;
  }
  candidate = candidate.replace(/^\/+/, "");
  if (candidate.startsWith("assets/")) candidate = candidate.slice("assets/".length);
  const marker = "resi-edge-assets/";
  const markerIndex = candidate.indexOf(marker);
  if (markerIndex >= 0) candidate = candidate.slice(markerIndex);
  if (!candidate.startsWith(marker)) {
    throw new Error(`Hero asset path does not resolve to ${marker}: ${path}`);
  }
  return candidate;
}

function contentTypeForFormat(format) {
  if (format === "avif") return "image/avif";
  if (format === "webp") return "image/webp";
  throw new Error(`Unsupported hero output format: ${format}`);
}

function qualityCandidates(startQuality, minQuality, step) {
  const candidates = [];
  for (let quality = startQuality; quality >= minQuality; quality -= step) {
    candidates.push(quality);
  }
  if (!candidates.includes(minQuality)) candidates.push(minQuality);
  return candidates;
}

function budgetQualityCandidates(format, startQuality, minQuality, step) {
  const floor = format === "webp" ? Math.min(minQuality, 2) : minQuality;
  return qualityCandidates(startQuality, floor, step);
}

async function sha256Hex(value) {
  const buffer = value instanceof ArrayBuffer ? value : await value.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readResponseBytes(response) {
  const bytes = await response.arrayBuffer();
  return {
    bytes,
    byteLength: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  };
}

function validateMessage(message) {
  const errors = [];
  if (!message || typeof message !== "object") errors.push("message must be an object");
  if (message?.schema_version !== QUEUE_SCHEMA_VERSION) errors.push("unsupported queue message schema_version");
  if (message?.action !== "refresh_hero_assets") errors.push("unsupported queue action");
  for (const field of ["property_code", "domain", "detected_source_image", "source_sha256", "edge_assets"]) {
    if (!message?.[field]) errors.push(`missing ${field}`);
  }
  if (!message?.edge_assets?.mobile_avif || !message?.edge_assets?.mobile_webp) {
    errors.push("edge_assets must include mobile_avif and mobile_webp");
  }
  return errors;
}

function policyFor(message, env) {
  const mode = clean(env.RESI_EDGE_HERO_MEDIA_REFRESH_MODE || "disabled").toLowerCase();
  if (mode !== "canary" && mode !== "auto") {
    return { allowed: false, mode, reason: "refresh_worker_disabled" };
  }
  if (mode === "auto") return { allowed: true, mode, reason: "auto_enabled" };

  const allowlist = clean(env.RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const tokens = [clean(message.property_code).toLowerCase(), clean(message.domain).toLowerCase()];
  const allowed = tokens.some((token) => allowlist.includes(token));
  return { allowed, mode, reason: allowed ? "canary_allowlist_match" : "canary_allowlist_miss" };
}

async function transformToBudget(env, sourceBytes, format, message) {
  if (!env.IMAGES) throw new Error("IMAGES binding is required.");
  const policy = message.quality_policy || {};
  const transform = message.transform || {};
  const maxBytes = Number(format === "avif" ? policy.avif_max_bytes : policy.webp_max_bytes) || 80000;
  const minQuality = Number(format === "avif" ? policy.min_avif_quality : policy.min_webp_quality) || (format === "avif" ? 42 : 8);
  const startQuality = Number(policy.start_quality) || 78;
  const step = format === "avif" ? 4 : 2;
  const contentType = contentTypeForFormat(format);
  const attempts = [];

  for (const quality of budgetQualityCandidates(format, startQuality, minQuality, step)) {
    const output = await env.IMAGES
      .input(sourceBytes.slice(0))
      .transform({
        width: Number(transform.width) || 750,
        height: Number(transform.height) || 1000,
        fit: "cover",
        gravity: transform.gravity || "auto",
      })
      .output({ format: contentType, quality });
    const response = output.response();
    const body = await readResponseBytes(response);
    attempts.push({ quality, bytes: body.byteLength, sha256: body.sha256 });
    if (body.byteLength <= maxBytes) {
      return {
        format,
        content_type: contentType,
        bytes: body.bytes,
        byte_length: body.byteLength,
        sha256: body.sha256,
        quality,
        max_bytes: maxBytes,
        attempts,
        transform: {
          width: Number(transform.width) || 750,
          height: Number(transform.height) || 1000,
          fit: "cover",
          gravity: transform.gravity || "auto",
          strategy: transform.strategy || "cloudflare-images-canary",
        },
      };
    }
  }
  throw new NonRetryableRefreshError(`${format.toUpperCase()} hero asset exceeded ${maxBytes} bytes after quality search.`, {
    status: "budget_exceeded",
    retryable: false,
    format,
    max_bytes: maxBytes,
    attempts,
  });
}

async function putAsset(bucket, key, asset) {
  await bucket.put(key, asset.bytes, {
    httpMetadata: {
      contentType: asset.content_type,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    },
  });
}

async function readbackAsset(bucket, key, expectedSha256) {
  const object = await bucket.get(key);
  if (!object) return { ok: false, key, error: "missing_r2_object" };
  const bytes = await object.arrayBuffer();
  const sha256 = await sha256Hex(bytes);
  return {
    ok: sha256 === expectedSha256,
    key,
    bytes: bytes.byteLength,
    sha256,
    expected_sha256: expectedSha256,
    error: sha256 === expectedSha256 ? undefined : "sha256_mismatch",
  };
}

async function writeJson(bucket, key, value) {
  await bucket.put(key, JSON.stringify(value, null, 2) + "\n", {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function writeReceipt(env, key, payload) {
  if (!env.RESI_EDGE_ASSETS) return;
  await writeJson(env.RESI_EDGE_ASSETS, key, payload);
}

function failureReadout(message, generatedAt, error) {
  const details = error?.details || {};
  return {
    ok: false,
    status: details.status || error?.status || "refresh_failed",
    retryable: error?.retryable !== false,
    schema_version: "resi_edge_hero_media_refresh_readout.v1",
    generated_at: generatedAt,
    worker_version: WORKER_VERSION,
    property_code: message?.property_code,
    domain: message?.domain,
    source_image: message?.detected_source_image,
    error: error instanceof Error ? error.message : "Unknown hero media refresh error",
    details,
    live_traffic_changed: false,
  };
}

async function writeFailureReceipt(env, message, generatedAt, error) {
  const readout = failureReadout(message, generatedAt, error);
  await writeReceipt(env, runReceiptKey(message || {}, readout.status, generatedAt), readout);
  return readout;
}

export async function processHeroMediaRefresh(message, env, options = {}) {
  const generatedAt = nowIso(options);
  const errors = validateMessage(message);
  if (errors.length) {
    const readout = {
      ok: false,
      status: "invalid_message",
      retryable: false,
      schema_version: "resi_edge_hero_media_refresh_readout.v1",
      generated_at: generatedAt,
      worker_version: WORKER_VERSION,
      property_code: message?.property_code,
      domain: message?.domain,
      errors,
      live_traffic_changed: false,
    };
    if (env.RESI_EDGE_ASSETS) await writeReceipt(env, runReceiptKey(message || {}, "invalid", generatedAt), readout);
    return readout;
  }
  if (!env.RESI_EDGE_ASSETS) throw new Error("RESI_EDGE_ASSETS binding is required.");

  try {
    const policy = policyFor(message, env);
    if (!policy.allowed) {
      const readout = {
        ok: true,
        status: "skipped",
        retryable: false,
        reason: policy.reason,
        mode: policy.mode,
        schema_version: "resi_edge_hero_media_refresh_readout.v1",
        generated_at: generatedAt,
        worker_version: WORKER_VERSION,
        property_code: message.property_code,
        domain: message.domain,
        source_image: message.detected_source_image,
        live_traffic_changed: false,
      };
      await writeReceipt(env, runReceiptKey(message, "skipped", generatedAt), readout);
      return readout;
    }

    const fetcher = options.fetcher || fetch;
    const sourceResponse = await fetcher(message.detected_source_image, {
      headers: {
        accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "ResiEdgeHeroMediaRefresh/2026-09-01",
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!sourceResponse.ok) throw new Error(`Source image returned HTTP ${sourceResponse.status}`);

    const source = await readResponseBytes(sourceResponse);
    if (message.source_sha256 && source.sha256 !== message.source_sha256) {
      const readout = {
        ok: true,
        status: "stale_message",
        retryable: false,
        reason: "source_changed_since_queue",
        schema_version: "resi_edge_hero_media_refresh_readout.v1",
        generated_at: generatedAt,
        worker_version: WORKER_VERSION,
        property_code: message.property_code,
        domain: message.domain,
        source_image: message.detected_source_image,
        queued_source_sha256: message.source_sha256,
        current_source_sha256: source.sha256,
        live_traffic_changed: false,
      };
      await writeReceipt(env, runReceiptKey(message, "stale", generatedAt), readout);
      return readout;
    }

    const avif = await transformToBudget(env, source.bytes, "avif", message);
    const webp = await transformToBudget(env, source.bytes, "webp", message);
    const avifKey = r2KeyFromAssetPath(message.edge_assets.mobile_avif);
    const webpKey = r2KeyFromAssetPath(message.edge_assets.mobile_webp);
    const candidates = {
      mobile_avif: `${candidatePrefix(message, generatedAt)}hero-mobile-750x1000.avif`,
      mobile_webp: `${candidatePrefix(message, generatedAt)}hero-mobile-750x1000.webp`,
    };

    await putAsset(env.RESI_EDGE_ASSETS, candidates.mobile_avif, avif);
    await putAsset(env.RESI_EDGE_ASSETS, candidates.mobile_webp, webp);
    const candidateReadbacks = [
      await readbackAsset(env.RESI_EDGE_ASSETS, candidates.mobile_avif, avif.sha256),
      await readbackAsset(env.RESI_EDGE_ASSETS, candidates.mobile_webp, webp.sha256),
    ];
    if (!candidateReadbacks.every((row) => row.ok)) {
      throw new Error(`Hero media candidate R2 readback failed: ${JSON.stringify(candidateReadbacks)}`);
    }

    await putAsset(env.RESI_EDGE_ASSETS, avifKey, avif);
    await putAsset(env.RESI_EDGE_ASSETS, webpKey, webp);

    const readbacks = [
      await readbackAsset(env.RESI_EDGE_ASSETS, avifKey, avif.sha256),
      await readbackAsset(env.RESI_EDGE_ASSETS, webpKey, webp.sha256),
    ];
    if (!readbacks.every((row) => row.ok)) {
      throw new Error(`Hero media R2 readback failed: ${JSON.stringify(readbacks)}`);
    }

    const stateKey = mediaStateKey(message);
    const sourceMetadata = {
      ...(message.source_metadata || {}),
      url: message.detected_source_image,
      sha256: source.sha256,
      content_length: String(source.byteLength),
    };
    const mediaState = {
    schema_version: MEDIA_STATE_SCHEMA_VERSION,
    generated_at: generatedAt,
    property_code: message.property_code,
    domain: message.domain,
    property_name: message.property_name,
    status: "accepted",
    source_image: message.detected_source_image,
    source_sha256: source.sha256,
    source_metadata: sourceMetadata,
    edge_assets: {
      mobile_avif: {
        public_url: message.edge_assets.mobile_avif,
        r2_key: avifKey,
        content_type: avif.content_type,
        bytes: avif.byte_length,
        sha256: avif.sha256,
        quality: avif.quality,
        max_bytes: avif.max_bytes,
        transform: avif.transform,
      },
      mobile_webp: {
        public_url: message.edge_assets.mobile_webp,
        r2_key: webpKey,
        content_type: webp.content_type,
        bytes: webp.byte_length,
        sha256: webp.sha256,
        quality: webp.quality,
        max_bytes: webp.max_bytes,
        transform: webp.transform,
      },
    },
    produced_by: {
      system: "cloudflare_hero_media_refresh_worker",
      worker_version: WORKER_VERSION,
      queue_schema_version: message.schema_version,
      run_id: message.run_id,
    },
    live_traffic_changed: false,
  };
    await writeJson(env.RESI_EDGE_ASSETS, stateKey, mediaState);

    const freshnessRecord = {
    schema_version: FRESHNESS_SCHEMA_VERSION,
    generated_at: generatedAt,
    property_code: message.property_code,
    domain: message.domain,
    property_name: message.property_name,
    key: message.freshness_key,
    native_url: message.native_url,
    manifest_source_image: message.manifest_source_image,
    detected_source_image: message.detected_source_image,
    status: "current",
    recommended_action: "none",
    source_metadata: sourceMetadata,
    edge_assets: message.edge_assets,
    source: {
      system: "cloudflare_hero_media_refresh_worker",
      media_state_key: stateKey,
      fetched_at: generatedAt,
    },
    baseline: {
      system: "media_state",
      key: stateKey,
      source_image: message.detected_source_image,
      source_sha256: source.sha256,
      generated_at: generatedAt,
    },
  };
    await writeJson(env.RESI_EDGE_ASSETS, message.freshness_key, freshnessRecord);

    const readout = {
    ok: true,
    status: "refreshed",
    schema_version: "resi_edge_hero_media_refresh_readout.v1",
    generated_at: generatedAt,
    worker_version: WORKER_VERSION,
    property_code: message.property_code,
    domain: message.domain,
    media_state_key: stateKey,
    freshness_key: message.freshness_key,
    assets: {
      mobile_avif: mediaState.edge_assets.mobile_avif,
      mobile_webp: mediaState.edge_assets.mobile_webp,
    },
      candidate_assets: candidates,
      candidate_readbacks: candidateReadbacks,
      readbacks,
    live_traffic_changed: false,
    };
    await writeReceipt(env, runReceiptKey(message, "refreshed", generatedAt), readout);
    return readout;
  } catch (error) {
    const readout = await writeFailureReceipt(env, message, generatedAt, error);
    if (readout.retryable) throw error;
    return readout;
  }
}

export default {
  async fetch(_request, _env) {
    return Response.json({
      ok: true,
      service: "resi-edge-hero-media-refresh-worker",
      worker_version: WORKER_VERSION,
      role: "queue_consumer_only",
      live_traffic_changed: false,
    });
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const readout = await processHeroMediaRefresh(message.body, env);
        if (readout?.retryable === true && readout?.ok === false) {
          if (typeof message.retry === "function") message.retry();
        } else if (typeof message.ack === "function") {
          message.ack();
        }
      } catch (error) {
        console.error("Resi Edge hero media refresh failed:", error);
        if (typeof message.retry === "function") message.retry();
      }
    }
  },
};
