import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker(): Promise<{
  processHeroMediaRefresh: (message: Record<string, unknown>, env: Record<string, unknown>, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  r2KeyFromAssetPath: (path: string) => string;
}> {
  return (await import("../../../../ops/cloudflare/resi-edge-hero-media-refresh-worker/worker.mjs")) as {
    processHeroMediaRefresh: (message: Record<string, unknown>, env: Record<string, unknown>, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    r2KeyFromAssetPath: (path: string) => string;
  };
}

class FakeR2Object {
  constructor(private value: string | ArrayBuffer) {}

  async text(): Promise<string> {
    return typeof this.value === "string" ? this.value : new TextDecoder().decode(this.value);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    if (typeof this.value === "string") return new TextEncoder().encode(this.value).buffer;
    return this.value;
  }
}

class FakeR2Bucket {
  objects = new Map<string, string | ArrayBuffer>();

  async put(key: string, value: string | ArrayBuffer): Promise<void> {
    this.objects.set(key, value);
  }

  async get(key: string): Promise<FakeR2Object | null> {
    const value = this.objects.get(key);
    return value === undefined ? null : new FakeR2Object(value);
  }
}

class FakeImagePipeline {
  private transformOptions: Record<string, unknown> = {};

  constructor(private inputBytes: ArrayBuffer) {}

  transform(options: Record<string, unknown>): FakeImagePipeline {
    this.transformOptions = options;
    return this;
  }

  async output(options: { format: string; quality: number }): Promise<{ response: () => Response }> {
    const base = options.format === "image/avif" ? 90000 : 83000;
    const byteLength = Math.max(24000, base - (78 - options.quality) * (options.format === "image/avif" ? 7000 : 2500));
    const body = new Uint8Array(byteLength);
    body.fill(options.format === "image/avif" ? 11 : 22);
    body[0] = Number(this.transformOptions.width) === 750 ? body[0] : 99;
    body[1] = Number(this.transformOptions.height) === 1000 ? body[1] : 98;
    return {
      response: () => new Response(body, { headers: { "content-type": options.format } }),
    };
  }
}

class FakeImagesBinding {
  input(bytes: ArrayBuffer): FakeImagePipeline {
    return new FakeImagePipeline(bytes);
  }
}

class LargeWebpImagePipeline extends FakeImagePipeline {
  async output(options: { format: string; quality: number }): Promise<{ response: () => Response }> {
    if (options.format !== "image/webp") return super.output(options);
    const byteLength = options.quality <= 8 ? 76000 : 96000;
    const body = new Uint8Array(byteLength);
    body.fill(33);
    return {
      response: () => new Response(body, { headers: { "content-type": options.format } }),
    };
  }
}

class LargeWebpImagesBinding {
  input(bytes: ArrayBuffer): LargeWebpImagePipeline {
    return new LargeWebpImagePipeline(bytes);
  }
}

class BudgetExceededImagePipeline extends FakeImagePipeline {
  async output(options: { format: string; quality: number }): Promise<{ response: () => Response }> {
    const byteLength = 96000;
    const body = new Uint8Array(byteLength);
    body.fill(options.format === "image/avif" ? 44 : 55);
    return {
      response: () => new Response(body, { headers: { "content-type": options.format } }),
    };
  }
}

class BudgetExceededImagesBinding {
  input(bytes: ArrayBuffer): BudgetExceededImagePipeline {
    return new BudgetExceededImagePipeline(bytes);
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function baseMessage(sourceSha256: string): Record<string, unknown> {
  return {
    schema_version: "resi_edge_hero_media_refresh_queue.v1",
    action: "refresh_hero_assets",
    queued_at: "2026-09-01T01:00:00.000Z",
    run_id: "20260901T010000Z",
    property_code: "TX4TQ",
    domain: "queued.example.com",
    property_name: "Queued Example",
    freshness_key: "resi-edge-hero-freshness/tx4tq-queued-example-com/current.json",
    media_state_key: "resi-edge-media-state/tx4tq-queued-example-com/current.json",
    native_url: "https://queued.example.com/?vtr_source_freshness_probe=20260901T010000Z",
    manifest_source_image: "https://dam.getresi.co/100/old-hero.jpg",
    detected_source_image: "https://dam.getresi.co/100/new-hero.jpg",
    source_sha256: sourceSha256,
    source_metadata: {
      url: "https://dam.getresi.co/100/new-hero.jpg",
      http_status: 200,
      content_type: "image/jpeg",
      content_length: "18",
      etag: "\"new\"",
      last_modified: "Tue, 01 Sep 2026 01:00:00 GMT",
      sha256: sourceSha256,
    },
    edge_assets: {
      mobile_avif: "/assets/resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif",
      mobile_webp: "/assets/resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.webp",
    },
    transform: { width: 750, height: 1000, fit: "cover", gravity: "auto", strategy: "cloudflare-images-canary" },
    quality_policy: { avif_max_bytes: 80000, webp_max_bytes: 80000, start_quality: 78, min_avif_quality: 42, min_webp_quality: 8 },
  };
}

test("Cloudflare hero media refresh worker stores assets, media-state, and current freshness", async () => {
  const worker = await loadWorker();
  const sourceBody = "new-source-bytes";
  const sourceSha256 = await sha256(sourceBody);
  const bucket = new FakeR2Bucket();
  const env = {
    RESI_EDGE_ASSETS: bucket,
    IMAGES: new FakeImagesBinding(),
    RESI_EDGE_HERO_MEDIA_REFRESH_MODE: "canary",
    RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST: "TX4TQ",
  };
  const fetcher = async () =>
    new Response(sourceBody, {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });

  const readout = await worker.processHeroMediaRefresh(baseMessage(sourceSha256), env, {
    fetcher,
    now: new Date("2026-09-01T01:05:00.000Z"),
  });

  assert.equal(readout.ok, true);
  assert.equal(readout.status, "refreshed");
  assert.ok(bucket.objects.has("resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif"));
  assert.ok(bucket.objects.has("resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.webp"));
  assert.deepEqual(
    Object.keys(readout.candidate_assets as Record<string, unknown>).sort(),
    ["mobile_avif", "mobile_webp"]
  );
  assert.ok(bucket.objects.has("resi-edge-media-refresh/_candidates/20260901t010000z-tx4tq-queued-example-com-98b20fd9041b/hero-mobile-750x1000.avif"));
  assert.ok(bucket.objects.has("resi-edge-media-refresh/_candidates/20260901t010000z-tx4tq-queued-example-com-98b20fd9041b/hero-mobile-750x1000.webp"));
  assert.equal((readout.candidate_readbacks as Array<Record<string, unknown>>).every((row) => row.ok === true), true);
  assert.equal((readout.readbacks as Array<Record<string, unknown>>).every((row) => row.ok === true), true);
  const mediaState = JSON.parse(String(bucket.objects.get("resi-edge-media-state/tx4tq-queued-example-com/current.json")));
  assert.equal(mediaState.schema_version, "resi_edge_hero_media_state.v1");
  assert.equal(mediaState.status, "accepted");
  assert.equal(mediaState.source_image, "https://dam.getresi.co/100/new-hero.jpg");
  assert.equal(mediaState.live_traffic_changed, false);
  assert.ok(mediaState.edge_assets.mobile_avif.bytes <= 80000);
  assert.ok(mediaState.edge_assets.mobile_webp.bytes <= 80000);
  const freshness = JSON.parse(String(bucket.objects.get("resi-edge-hero-freshness/tx4tq-queued-example-com/current.json")));
  assert.equal(freshness.status, "current");
  assert.equal(freshness.recommended_action, "none");
  assert.equal(freshness.baseline.system, "media_state");
});

test("Cloudflare hero media refresh worker keeps searching WebP below the old quality floor", async () => {
  const worker = await loadWorker();
  const sourceBody = "large-webp-source";
  const sourceSha256 = await sha256(sourceBody);
  const bucket = new FakeR2Bucket();
  const env = {
    RESI_EDGE_ASSETS: bucket,
    IMAGES: new LargeWebpImagesBinding(),
    RESI_EDGE_HERO_MEDIA_REFRESH_MODE: "canary",
    RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST: "TX4TQ",
  };
  const fetcher = async () => new Response(sourceBody, { status: 200 });

  const readout = await worker.processHeroMediaRefresh(baseMessage(sourceSha256), env, {
    fetcher,
    now: new Date("2026-09-01T01:06:00.000Z"),
  });

  assert.equal(readout.ok, true);
  assert.equal(readout.status, "refreshed");
  const mediaState = JSON.parse(String(bucket.objects.get("resi-edge-media-state/tx4tq-queued-example-com/current.json")));
  assert.equal(mediaState.edge_assets.mobile_webp.quality, 8);
  assert.ok(mediaState.edge_assets.mobile_webp.bytes <= 80000);
});

test("Cloudflare hero media refresh worker records deterministic non-retryable budget failures without stable writes", async () => {
  const worker = await loadWorker();
  const sourceBody = "budget-source";
  const sourceSha256 = await sha256(sourceBody);
  const bucket = new FakeR2Bucket();
  const env = {
    RESI_EDGE_ASSETS: bucket,
    IMAGES: new BudgetExceededImagesBinding(),
    RESI_EDGE_HERO_MEDIA_REFRESH_MODE: "canary",
    RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST: "TX4TQ",
  };
  const fetcher = async () => new Response(sourceBody, { status: 200 });

  const readout = await worker.processHeroMediaRefresh(baseMessage(sourceSha256), env, {
    fetcher,
    now: new Date("2026-09-01T01:07:00.000Z"),
  });

  assert.equal(readout.ok, false);
  assert.equal(readout.status, "budget_exceeded");
  assert.equal(readout.retryable, false);
  assert.equal(bucket.objects.has("resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif"), false);
  assert.equal(bucket.objects.has("resi-edge-media-state/tx4tq-queued-example-com/current.json"), false);
  const failureReceipt = "resi-edge-media-refresh/_runs/20260901t010000z-tx4tq-queued-example-com-budget_exceeded-bab58e2d8a55.json";
  assert.ok(bucket.objects.has(failureReceipt));
  const failure = JSON.parse(String(bucket.objects.get(failureReceipt)));
  assert.equal(failure.live_traffic_changed, false);
  assert.equal(failure.details.status, "budget_exceeded");
});

test("Cloudflare hero media refresh worker records invalid messages as non-retryable", async () => {
  const worker = await loadWorker();
  const bucket = new FakeR2Bucket();

  const readout = await worker.processHeroMediaRefresh({}, { RESI_EDGE_ASSETS: bucket }, {
    now: new Date("2026-09-01T01:08:00.000Z"),
  });

  assert.equal(readout.ok, false);
  assert.equal(readout.status, "invalid_message");
  assert.equal(readout.retryable, false);
  assert.equal(bucket.objects.has("resi-edge-media-refresh/_runs/20260901T010800Z-unknown-unknown-invalid-nohash.json"), true);
});

test("Cloudflare hero media refresh worker skips stale queue messages", async () => {
  const worker = await loadWorker();
  const bucket = new FakeR2Bucket();
  const env = {
    RESI_EDGE_ASSETS: bucket,
    IMAGES: new FakeImagesBinding(),
    RESI_EDGE_HERO_MEDIA_REFRESH_MODE: "auto",
  };
  const fetcher = async () => new Response("newer-source-bytes", { status: 200 });

  const readout = await worker.processHeroMediaRefresh(baseMessage("queued-old-sha"), env, {
    fetcher,
    now: new Date("2026-09-01T01:10:00.000Z"),
  });

  assert.equal(readout.ok, true);
  assert.equal(readout.status, "stale_message");
  assert.equal(bucket.objects.has("resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif"), false);
  assert.equal(bucket.objects.has("resi-edge-media-state/tx4tq-queued-example-com/current.json"), false);
});

test("asset path conversion keeps stable same-origin R2 keys", async () => {
  const worker = await loadWorker();
  assert.equal(
    worker.r2KeyFromAssetPath("/assets/resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif"),
    "resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif"
  );
  assert.equal(
    worker.r2KeyFromAssetPath("https://assets.venterradev.com/resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.webp"),
    "resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.webp"
  );
});
