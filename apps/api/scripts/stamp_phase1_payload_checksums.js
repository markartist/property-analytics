#!/usr/bin/env node

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableHash(parts) {
  return fnv1a32(parts.map((part) => String(part ?? "")).join("|"));
}

function computeSliceChecksum(rowHashes) {
  return stableHash([rowHashes.length, ...rowHashes.slice().sort()]);
}

function computeBatchChecksum(sliceChecksums) {
  return stableHash(
    sliceChecksums
      .slice()
      .sort((a, b) => `${a.targetTable}:${a.sliceKey}`.localeCompare(`${b.targetTable}:${b.sliceKey}`))
      .flatMap((entry) => [entry.targetTable, entry.sliceKey, entry.checksum])
  );
}

function ga4RowHash(record) {
  return stableHash([
    "ga4",
    record.propertyId,
    record.metricDate,
    record.ga4PropertyId ?? null,
    record.totalUsers ?? null,
    record.newUsers ?? null,
    record.sessions ?? null,
    record.pageviews ?? null,
    record.avgSessionDurationSeconds ?? null,
    record.bounceRate ?? null,
  ]);
}

function psiRowHash(record) {
  return stableHash([
    "psi",
    record.propertyId,
    record.metricDate,
    record.strategy,
    record.performanceScore ?? null,
    record.accessibilityScore ?? null,
    record.bestPracticesScore ?? null,
    record.seoScore ?? null,
    record.lcpSeconds ?? null,
    record.clsValue ?? null,
    record.fcpSeconds ?? null,
    record.tbtMs ?? null,
    record.inpMs ?? null,
    record.ttfbMs ?? null,
  ]);
}

function rowHashesForSlice(targetTable, records) {
  switch (targetTable) {
    case "platform_ga4_daily_metrics":
      return records.map(ga4RowHash);
    case "platform_psi_daily_metrics":
      return records.map(psiRowHash);
    default:
      throw new Error(`Unsupported target table for checksum stamping: ${targetTable}`);
  }
}

function stampPayload(payload) {
  const sliceChecksums = [];
  for (const slice of payload.payloadSlices ?? []) {
    const records = JSON.parse(slice.recordsJson);
    const rowHashes = rowHashesForSlice(slice.targetTable, records);
    const sliceChecksum = computeSliceChecksum(rowHashes);
    slice.sliceChecksumExpected = sliceChecksum;
    sliceChecksums.push({
      targetTable: slice.targetTable,
      sliceKey: slice.sliceKey,
      checksum: sliceChecksum,
    });
  }

  const manifest = payload.checksumManifest ? JSON.parse(payload.checksumManifest) : {};
  manifest.batchChecksum = computeBatchChecksum(sliceChecksums);
  payload.checksumManifest = JSON.stringify(manifest);
  return payload;
}

function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error("Usage: stamp_phase1_payload_checksums.js <payload.json> [payload.json ...]");
    process.exit(1);
  }

  for (const path of paths) {
    const payload = JSON.parse(require("fs").readFileSync(path, "utf8"));
    const stamped = stampPayload(payload);
    require("fs").writeFileSync(path, JSON.stringify(stamped));
  }
}

main();
