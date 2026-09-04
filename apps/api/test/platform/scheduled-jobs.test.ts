import assert from "node:assert/strict";
import test from "node:test";
import { runIndependentScheduledJobs } from "../../src/scheduled";

test("independent scheduled jobs continue after another scheduled lane fails", async () => {
  const calls: string[] = [];

  const results = await runIndependentScheduledJobs([
    {
      label: "first",
      run: async () => {
        calls.push("first");
        throw new Error("planned failure");
      },
    },
    {
      label: "promo",
      run: async () => {
        calls.push("promo");
      },
    },
  ]);

  assert.deepEqual(calls.sort(), ["first", "promo"]);
  assert.deepEqual(
    results.map((result) => ({ label: result.label, ok: result.ok })),
    [
      { label: "first", ok: false },
      { label: "promo", ok: true },
    ]
  );
});
