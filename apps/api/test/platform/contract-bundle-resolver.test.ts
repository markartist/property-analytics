import test from "node:test";
import assert from "node:assert/strict";

import { createContractBundleResolver } from "../../src/platform/contract-bundles/resolver";
import { queryAll } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { seedPhase1PlatformBasics } from "../helpers/platform-seeds";

test("contract bundle resolver blocks unknown bundle ids", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedPhase1PlatformBasics(db);
    const resolver = createContractBundleResolver(db);

    await assert.rejects(
      () =>
        resolver.resolve({
          contextType: "mirror_intake",
          requestedContractBundleId: "missing_bundle",
          contextObjectType: "mirror_batch",
          contextObjectId: "mb_missing",
        }),
      /Requested contract bundle could not be resolved/
    );

    const events = await queryAll<{ compatibility_posture: string; failure_code: string | null }>(
      db,
      `SELECT compatibility_posture, failure_code
       FROM contract_compatibility_events
       WHERE context_object_id = 'mb_missing'`
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.compatibility_posture, "blocked");
    assert.equal(events[0]?.failure_code, "BUNDLE_NOT_FOUND");
  } finally {
    close();
  }
});
