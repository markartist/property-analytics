#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolveResiSourceAttribution } = require("../ops/cloudflare/shared/resi-source-attribution.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const lookupPath =
  process.argv[2] || path.join(root, "reports/resi_source_lookup/latest-resi-source-lookup.kv.json");
const lookup = JSON.parse(fs.readFileSync(lookupPath, "utf8"));

function check(url, expected) {
  const actual = resolveResiSourceAttribution(lookup, url);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(actual[key], value, `${url} expected ${key}=${value}, got ${actual[key]}`);
  }
  assert.ok(!actual.warnings.includes("missing_vws_default_phone"), `${url} missing VWS default`);
  return actual;
}

check("https://calaismidtownapartments.com/", {
  propertyCode: "TX4MI",
  selection: "default",
  selectedTrackingId: "TX4MI30L",
  selectedMarketingSourceCd: "VWS",
  phone: "(346) 414-0841",
});

check("https://calaismidtownapartments.com/?id=TX4MIGOA", {
  propertyCode: "TX4MI",
  selection: "source",
  selectedTrackingId: "TX4MIGOA",
  selectedMarketingSourceCd: "GOA",
  phone: "(346) 639-3361",
});

const invalidCalais = check("https://calaismidtownapartments.com/?id=NOPE", {
  propertyCode: "TX4MI",
  selection: "default",
  selectedTrackingId: "TX4MI30L",
  phone: "(346) 414-0841",
});
assert.ok(invalidCalais.warnings.includes("tracking_id_not_valid_for_property"));
assert.notEqual(invalidCalais.phone, "(713) 520-8300", "Calais office phone must not appear");

check("https://venterraliving.com/apartments/calais-midtown/?id=TX4MIALIST", {
  propertyCode: "TX4MI",
  selection: "source",
  selectedTrackingId: "TX4MIALIST",
  phone: "(844) 422-2513",
});

check("https://thevinekyle.com/", {
  propertyCode: "TX4EK",
  selection: "default",
  selectedTrackingId: "TX4EK30L",
  phone: "(737) 357-8867",
});

check("https://townestoneat359.com/?id=TX4FCGOA", {
  propertyCode: "TX4FC",
  selection: "source",
  selectedTrackingId: "TX4FCGOA",
  phone: "(512) 800-7701",
});

console.log(
  JSON.stringify(
    {
      ok: true,
      lookupPath,
      propertyCount: lookup.propertyCount,
      sourceCount: lookup.sourceCount,
    },
    null,
    2,
  ),
);
