import assert from "node:assert/strict";
import test from "node:test";
import type { Env } from "../../src/env";
import {
  extractHeroSourceFromHtml,
  runScheduledResiEdgeHeroFreshnessSync,
} from "../../src/platform/resi-edge/hero-freshness-sync";

class FakeR2Bucket {
  objects = new Map<string, string>();

  async put(key: string, value: string | ReadableStream | ArrayBuffer | ArrayBufferView | Blob | null): Promise<void> {
    this.objects.set(key, String(value ?? ""));
  }

  async get(key: string): Promise<{ text: () => Promise<string> } | null> {
    const value = this.objects.get(key);
    return value === undefined ? null : { text: async () => value };
  }
}

class FakeQueue {
  messages: unknown[] = [];

  async send(value: unknown): Promise<void> {
    this.messages.push(value);
  }
}

function env(bucket: FakeR2Bucket, overrides: Partial<Env> = {}): Env {
  return {
    POP_BRIEF_DB: {} as D1Database,
    POP_BRIEF_UPLOADS: {} as R2Bucket,
    RESI_EDGE_ASSETS: bucket as unknown as R2Bucket,
    RESEND_API_KEY: "test-resend",
    EMAIL_FROM: "test@example.com",
    SEMRUSH_API_KEY: "test-semrush",
    SESSION_SIGNING_SECRET: "test-secret",
    ENABLE_EMAIL_SEND: "false",
    OPENAI_API_KEY: "test-openai",
    RESI_EDGE_HERO_FRESHNESS_SYNC_ENABLED: "true",
    RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED: "false",
    ...overrides,
  };
}

test("hero source extractor prefers the native hero data-src", () => {
  const result = extractHeroSourceFromHtml(
    '<section data-page-section="hero"><div data-src="/media/current-hero.jpg"></div></section>',
    "https://example.com/"
  );

  assert.equal(result.method, "hero_data_src");
  assert.equal(result.url, "https://example.com/media/current-hero.jpg");
});

test("scheduled hero freshness sync records current hero source", async () => {
  const bucket = new FakeR2Bucket();
  const sourceImage = "https://dam.getresi.co/100/current-hero.jpg";
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://current.example.com/")) {
      return new Response(`<section data-page-section="hero"><div data-src="${sourceImage}"></div></section>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === sourceImage) {
      return new Response("current-image-bytes", {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "19",
          etag: '"current"',
          "last-modified": "Mon, 31 Aug 2026 17:00:48 GMT",
        },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const summary = await runScheduledResiEdgeHeroFreshnessSync(env(bucket), new Date("2026-08-31T18:00:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "TX4TT", domain: "current.example.com", property_name: "Current Example" },
        mobile_shell: { hero: { source_image: sourceImage, image_mobile: "/assets/resi-edge-assets/TX4TT/home/hero-mobile-750x1000.avif" } },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.property_count, 1);
  assert.equal(summary.current_count, 1);
  assert.equal(summary.refresh_needed_count, 0);
  assert.equal(summary.write_count, 1);
  const record = JSON.parse(bucket.objects.get("resi-edge-hero-freshness/tx4tt-current-example-com/current.json") || "{}");
  assert.equal(record.schema_version, "resi_edge_hero_freshness_record.v1");
  assert.equal(record.status, "current");
  assert.equal(record.detected_source_image, sourceImage);
  assert.equal(record.recommended_action, "none");
  assert.ok(record.source_metadata.sha256);
  assert.ok(bucket.objects.has("resi-edge-hero-freshness/_latest-summary.json"));
});

test("scheduled hero freshness sync flags changed native hero source", async () => {
  const bucket = new FakeR2Bucket();
  const oldSourceImage = "https://dam.getresi.co/100/old-hero.jpg";
  const newSourceImage = "https://dam.getresi.co/100/new-hero.jpg";
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://changed.example.com/")) {
      return new Response(`<section data-page-section="hero"><div data-src="${newSourceImage}"></div></section>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === newSourceImage) {
      return new Response("new-image-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg", etag: '"new"' },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const summary = await runScheduledResiEdgeHeroFreshnessSync(env(bucket), new Date("2026-08-31T18:15:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "TX4TC", domain: "changed.example.com", property_name: "Changed Example" },
        mobile_shell: { hero: { source_image: oldSourceImage } },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.current_count, 0);
  assert.equal(summary.refresh_needed_count, 1);
  const record = JSON.parse(bucket.objects.get("resi-edge-hero-freshness/tx4tc-changed-example-com/current.json") || "{}");
  assert.equal(record.status, "refresh_needed");
  assert.equal(record.manifest_source_image, oldSourceImage);
  assert.equal(record.detected_source_image, newSourceImage);
  assert.equal(record.recommended_action, "regenerate_hero_assets");
});

test("scheduled hero freshness sync queues a new refresh-needed source when enabled", async () => {
  const bucket = new FakeR2Bucket();
  const queue = new FakeQueue();
  const oldSourceImage = "https://dam.getresi.co/100/old-hero.jpg";
  const newSourceImage = "https://dam.getresi.co/100/new-hero.jpg";
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://queued.example.com/")) {
      return new Response(`<section data-page-section="hero"><div data-src="${newSourceImage}"></div></section>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === newSourceImage) {
      return new Response("new-image-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg", etag: '"new"' },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const summary = await runScheduledResiEdgeHeroFreshnessSync(
    env(bucket, {
      RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED: "true",
      RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE: queue as unknown as Queue,
    }),
    new Date("2026-09-01T01:00:00.000Z"),
    {
      fetcher,
      manifests: [
        {
          package_contract_id: "resi-edge-canonical-upgrade-package",
          target: { source_property_code: "TX4TQ", domain: "queued.example.com", property_name: "Queued Example" },
          mobile_shell: { hero: { source_image: oldSourceImage, image_mobile: "/assets/resi-edge-assets/TX4TQ/home/hero-mobile-750x1000.avif" } },
        },
      ],
    }
  );

  assert.equal(summary.ok, true);
  assert.equal(summary.refresh_needed_count, 1);
  assert.equal(summary.media_refresh_queue?.enabled, true);
  assert.equal(summary.media_refresh_queue?.write_count, 1);
  assert.equal(queue.messages.length, 1);
  const message = queue.messages[0] as Record<string, unknown>;
  assert.equal(message.schema_version, "resi_edge_hero_media_refresh_queue.v1");
  assert.equal(message.action, "refresh_hero_assets");
  assert.equal(message.detected_source_image, newSourceImage);
  assert.equal(message.media_state_key, "resi-edge-media-state/tx4tq-queued-example-com/current.json");
});

test("scheduled hero freshness sync treats accepted media-state as the current baseline", async () => {
  const bucket = new FakeR2Bucket();
  const manifestSourceImage = "https://dam.getresi.co/100/old-hero.jpg";
  const acceptedSourceImage = "https://dam.getresi.co/100/cloudflare-accepted-hero.jpg";
  bucket.objects.set(
    "resi-edge-media-state/tx4tm-media-state-example-com/current.json",
    JSON.stringify({
      schema_version: "resi_edge_hero_media_state.v1",
      generated_at: "2026-09-01T00:30:00.000Z",
      property_code: "TX4TM",
      domain: "media-state.example.com",
      status: "accepted",
      source_image: acceptedSourceImage,
      source_sha256: "accepted-source-sha",
    })
  );
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://media-state.example.com/")) {
      return new Response(`<section data-page-section="hero"><div data-src="${acceptedSourceImage}"></div></section>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === acceptedSourceImage) {
      return new Response("accepted-source-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg", etag: '"accepted"' },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const sourceSha = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("accepted-source-bytes")))
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  bucket.objects.set(
    "resi-edge-media-state/tx4tm-media-state-example-com/current.json",
    JSON.stringify({
      schema_version: "resi_edge_hero_media_state.v1",
      generated_at: "2026-09-01T00:30:00.000Z",
      property_code: "TX4TM",
      domain: "media-state.example.com",
      status: "accepted",
      source_image: acceptedSourceImage,
      source_sha256: sourceSha,
    })
  );

  const summary = await runScheduledResiEdgeHeroFreshnessSync(env(bucket), new Date("2026-09-01T01:15:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "TX4TM", domain: "media-state.example.com", property_name: "Media State Example" },
        mobile_shell: { hero: { source_image: manifestSourceImage } },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.current_count, 1);
  assert.equal(summary.refresh_needed_count, 0);
  assert.equal(summary.rows[0].baseline_source, "media_state");
  const record = JSON.parse(bucket.objects.get("resi-edge-hero-freshness/tx4tm-media-state-example-com/current.json") || "{}");
  assert.equal(record.status, "current");
  assert.equal(record.baseline.system, "media_state");
  assert.equal(record.manifest_source_image, manifestSourceImage);
  assert.equal(record.detected_source_image, acceptedSourceImage);
});

test("scheduled hero freshness sync preserves manifest baseline hash for same-url source drift", async () => {
  const bucket = new FakeR2Bucket();
  const sourceImage = "https://dam.getresi.co/100/stable-url-hero.jpg";
  const previousSha = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("previous-image-bytes")))
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  bucket.objects.set(
    "resi-edge-hero-freshness/tx4ts-same-url-example-com/current.json",
    JSON.stringify({
      schema_version: "resi_edge_hero_freshness_record.v1",
      generated_at: "2026-09-01T00:30:00.000Z",
      property_code: "TX4TS",
      domain: "same-url.example.com",
      property_name: "Same URL Example",
      key: "resi-edge-hero-freshness/tx4ts-same-url-example-com/current.json",
      native_url: "https://same-url.example.com/?vtr_source_freshness_probe=previous",
      manifest_source_image: sourceImage,
      detected_source_image: sourceImage,
      status: "current",
      recommended_action: "none",
      source_metadata: { sha256: previousSha },
      edge_assets: {},
      source: {},
      baseline: {
        system: "manifest",
        source_image: sourceImage,
        source_sha256: previousSha,
        generated_at: "2026-09-01T00:30:00.000Z",
      },
    })
  );
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://same-url.example.com/")) {
      return new Response(`<section data-page-section="hero"><div data-src="${sourceImage}"></div></section>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === sourceImage) {
      return new Response("changed-image-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg", etag: '"changed"' },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const summary = await runScheduledResiEdgeHeroFreshnessSync(env(bucket), new Date("2026-09-01T02:00:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "TX4TS", domain: "same-url.example.com", property_name: "Same URL Example" },
        mobile_shell: { hero: { source_image: sourceImage } },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.current_count, 0);
  assert.equal(summary.refresh_needed_count, 1);
  assert.equal(summary.rows[0].baseline_source, "manifest");
  const record = JSON.parse(bucket.objects.get("resi-edge-hero-freshness/tx4ts-same-url-example-com/current.json") || "{}");
  assert.equal(record.status, "refresh_needed");
  assert.equal(record.recommended_action, "regenerate_hero_assets");
  assert.equal(record.baseline.source_sha256, previousSha);
  assert.notEqual(record.source_metadata.sha256, previousSha);
});

test("scheduled hero freshness sync hashes original image bytes instead of negotiated webp", async () => {
  const bucket = new FakeR2Bucket();
  const sourceImage = "https://dam.getresi.co/100/negotiated-hero.jpg";
  const originalSha = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("original-jpeg-bytes")))
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://negotiated.example.com/")) {
      return new Response(`<section data-page-section="hero"><div data-src="${sourceImage}"></div></section>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url === sourceImage) {
      const accept = new Headers(init?.headers).get("accept") || "";
      if (accept.includes("webp")) {
        return new Response("negotiated-webp-bytes", {
          status: 200,
          headers: { "content-type": "image/webp" },
        });
      }
      return new Response("original-jpeg-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const summary = await runScheduledResiEdgeHeroFreshnessSync(env(bucket), new Date("2026-09-01T02:15:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "TX4TN", domain: "negotiated.example.com", property_name: "Negotiated Example" },
        mobile_shell: { hero: { source_image: sourceImage } },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.current_count, 1);
  const record = JSON.parse(bucket.objects.get("resi-edge-hero-freshness/tx4tn-negotiated-example-com/current.json") || "{}");
  assert.equal(record.source_metadata.content_type, "image/jpeg");
  assert.equal(record.source_metadata.sha256, originalSha);
});
