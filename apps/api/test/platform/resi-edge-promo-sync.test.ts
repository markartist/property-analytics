import assert from "node:assert/strict";
import test from "node:test";
import type { Env } from "../../src/env";
import { runScheduledResiEdgePromoSync } from "../../src/platform/resi-edge/promo-record-sync";

class FakeR2Bucket {
  objects = new Map<string, string>();

  async put(key: string, value: string | ReadableStream | ArrayBuffer | ArrayBufferView | Blob | null): Promise<void> {
    this.objects.set(key, String(value ?? ""));
  }
}

function env(bucket: FakeR2Bucket): Env {
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
    RESI_EDGE_PROMO_SYNC_ENABLED: "true",
  };
}

test("scheduled promo sync writes propertyBannerSpecial records and summary to R2", async () => {
  const bucket = new FakeR2Bucket();
  const fetcher = async () =>
    new Response(
      JSON.stringify([
        { id: "FL4DU", name: "The District Universal Boulevard", propertyBannerSpecial: "$500 off move-in costs!" },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const summary = await runScheduledResiEdgePromoSync(env(bucket), new Date("2026-08-31T16:00:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "FL4DU", domain: "thedistrictuniversal.com", property_name: "The District Universal Boulevard" },
        mobile_shell: { promo: { primary_cta_label: "See Availability", primary_cta_url: "/apartments/" } },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.property_count, 1);
  assert.equal(summary.present_count, 1);
  assert.equal(summary.write_count, 1);
  const record = JSON.parse(bucket.objects.get("resi-edge-promo/fl4du-thedistrictuniversal-com/current.json") || "{}");
  assert.equal(record.schema_version, "resi_edge_promo_record.v1");
  assert.equal(record.propertyBannerSpecial, "$500 off move-in costs!");
  assert.equal(record.present, true);
  assert.equal(record.source.system, "thirtylines_feed_live");
  assert.ok(bucket.objects.has("resi-edge-promo/_latest-summary.json"));
});

test("scheduled promo sync writes explicit absent records when the feed has no banner special", async () => {
  const bucket = new FakeR2Bucket();
  const fetcher = async () =>
    new Response(JSON.stringify([{ id: "OK4CS", name: "Creekside", propertyBannerSpecial: "" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const summary = await runScheduledResiEdgePromoSync(env(bucket), new Date("2026-08-31T16:15:00.000Z"), {
    fetcher,
    manifests: [
      {
        package_contract_id: "resi-edge-canonical-upgrade-package",
        target: { source_property_code: "OK4CS", domain: "creeksideapt.com", property_name: "Creekside" },
      },
    ],
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.present_count, 0);
  const record = JSON.parse(bucket.objects.get("resi-edge-promo/ok4cs-creeksideapt-com/current.json") || "{}");
  assert.equal(record.present, false);
  assert.equal(record.propertyBannerSpecial, "");
});
