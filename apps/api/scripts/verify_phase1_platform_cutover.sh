#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
API_DIR="$ROOT/apps/api"
SCRIPT_DIR="$API_DIR/scripts"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/phase1-cutover-XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "${PLATFORM_BASE_URL:-}" ]]; then
  echo "PLATFORM_BASE_URL is required"
  exit 1
fi

if [[ -z "${PLATFORM_SHARED_TOKEN:-}" ]]; then
  echo "PLATFORM_SHARED_TOKEN is required"
  exit 1
fi

python3 - <<'PY' "$TMP_DIR"
import json
import sqlite3
import sys
from pathlib import Path

DB = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
OUT = Path(sys.argv[1])


def fnv1a32(value: str) -> str:
    h = 0x811C9DC5
    for ch in value:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def stable_hash(parts):
    return fnv1a32("|".join("" if part is None else str(part) for part in parts))


conn = sqlite3.connect(str(DB))
conn.row_factory = sqlite3.Row

ga4_date = conn.execute("SELECT MAX(metric_date) AS d FROM ga4_daily_metrics").fetchone()["d"]
psi_date = conn.execute("SELECT MAX(metric_date) AS d FROM pagespeed_metrics").fetchone()["d"]

ga4_rows = conn.execute(
    """
    SELECT property_id, metric_date, total_users, new_users, sessions, pageviews,
           avg_session_duration, bounce_rate
    FROM ga4_daily_metrics
    WHERE metric_date = ?
    ORDER BY property_id
    """,
    (ga4_date,),
).fetchall()

psi_rows = conn.execute(
    """
    SELECT property_id, metric_date, strategy, performance_score, accessibility_score,
           best_practices_score, seo_score, lcp_value, cls_value, fcp_value,
           total_blocking_time, fid_value, ttfb_value
    FROM pagespeed_metrics
    WHERE metric_date = ?
      AND strategy IN ('mobile', 'desktop')
    ORDER BY property_id, strategy
    """,
    (psi_date,),
).fetchall()


def build_ga4():
    records = []
    hashes = []
    for row in ga4_rows:
      record = {
          "propertyId": str(row["property_id"]),
          "metricDate": str(row["metric_date"])[:10],
          "ga4PropertyId": str(row["property_id"]),
          "totalUsers": row["total_users"],
          "newUsers": row["new_users"],
          "sessions": row["sessions"],
          "pageviews": row["pageviews"],
          "avgSessionDurationSeconds": row["avg_session_duration"],
          "bounceRate": row["bounce_rate"],
      }
      records.append(record)
      hashes.append(
          stable_hash([
              "ga4",
              record["propertyId"],
              record["metricDate"],
              record["ga4PropertyId"],
              record["totalUsers"],
              record["newUsers"],
              record["sessions"],
              record["pageviews"],
              record["avgSessionDurationSeconds"],
              record["bounceRate"],
          ])
      )
    slice_checksum = stable_hash([len(hashes), *sorted(hashes)])
    batch_checksum = stable_hash(["platform_ga4_daily_metrics", ga4_date, slice_checksum])
    return {
        "domainKey": "ga4",
        "mirrorBatchId": f"mb_ga4_cutover_{ga4_date}",
        "sourceValidationBatchId": f"val_ga4_cutover_{ga4_date}",
        "sourceSnapshotId": f"snap_ga4_cutover_{ga4_date}",
        "contractBundleId": "cb_phase1_v1",
        "schemaBundleVersion": "schema_v1",
        "validatorBundleVersion": "validator_v1",
        "mirrorBundleVersion": "mirror_v1",
        "payloadContractVersion": "payload_v1",
        "batchDateStart": ga4_date,
        "batchDateEnd": ga4_date,
        "rowCountTotalExpected": len(records),
        "checksumManifest": json.dumps({"batchChecksum": batch_checksum}),
        "payloadSlices": [{
            "mirrorBatchSliceId": f"slice_ga4_cutover_{ga4_date}",
            "targetTable": "platform_ga4_daily_metrics",
            "sliceKey": ga4_date,
            "rowCountExpected": len(records),
            "sliceChecksumExpected": slice_checksum,
            "recordsJson": json.dumps(records),
        }],
        "sourceHost": "local-mac",
        "operatorId": "mark",
    }


def build_psi():
    records = []
    hashes = []
    for row in psi_rows:
      record = {
          "propertyId": str(row["property_id"]),
          "metricDate": str(row["metric_date"])[:10],
          "strategy": str(row["strategy"]).lower(),
          "performanceScore": row["performance_score"],
          "accessibilityScore": row["accessibility_score"],
          "bestPracticesScore": row["best_practices_score"],
          "seoScore": row["seo_score"],
          "lcpSeconds": row["lcp_value"],
          "clsValue": row["cls_value"],
          "fcpSeconds": row["fcp_value"],
          "tbtMs": row["total_blocking_time"],
          "inpMs": row["fid_value"],
          "ttfbMs": row["ttfb_value"],
      }
      records.append(record)
      hashes.append(
          stable_hash([
              "psi",
              record["propertyId"],
              record["metricDate"],
              record["strategy"],
              record["performanceScore"],
              record["accessibilityScore"],
              record["bestPracticesScore"],
              record["seoScore"],
              record["lcpSeconds"],
              record["clsValue"],
              record["fcpSeconds"],
              record["tbtMs"],
              record["inpMs"],
              record["ttfbMs"],
          ])
      )
    slice_checksum = stable_hash([len(hashes), *sorted(hashes)])
    batch_checksum = stable_hash(["platform_psi_daily_metrics", psi_date, slice_checksum])
    return {
        "domainKey": "psi",
        "mirrorBatchId": f"mb_psi_cutover_{psi_date}",
        "sourceValidationBatchId": f"val_psi_cutover_{psi_date}",
        "sourceSnapshotId": f"snap_psi_cutover_{psi_date}",
        "contractBundleId": "cb_phase1_v1",
        "schemaBundleVersion": "schema_v1",
        "validatorBundleVersion": "validator_v1",
        "mirrorBundleVersion": "mirror_v1",
        "payloadContractVersion": "payload_v1",
        "batchDateStart": psi_date,
        "batchDateEnd": psi_date,
        "rowCountTotalExpected": len(records),
        "checksumManifest": json.dumps({"batchChecksum": batch_checksum}),
        "payloadSlices": [{
            "mirrorBatchSliceId": f"slice_psi_cutover_{psi_date}",
            "targetTable": "platform_psi_daily_metrics",
            "sliceKey": psi_date,
            "rowCountExpected": len(records),
            "sliceChecksumExpected": slice_checksum,
            "recordsJson": json.dumps(records),
        }],
        "sourceHost": "local-mac",
        "operatorId": "mark",
    }


(OUT / "ga4_payload.json").write_text(json.dumps(build_ga4()))
(OUT / "psi_payload.json").write_text(json.dumps(build_psi()))
conn.close()
PY

node "$SCRIPT_DIR/stamp_phase1_payload_checksums.js" \
  "$TMP_DIR/ga4_payload.json" \
  "$TMP_DIR/psi_payload.json"

python3 "$SCRIPT_DIR/platform_phase1_client.py" mirror-batch \
  --base-url "$PLATFORM_BASE_URL" \
  --shared-token "$PLATFORM_SHARED_TOKEN" \
  --actor "phase1_cutover_check" \
  --source "phase1_cutover_check" \
  --input "$TMP_DIR/ga4_payload.json"

python3 "$SCRIPT_DIR/platform_phase1_client.py" mirror-batch \
  --base-url "$PLATFORM_BASE_URL" \
  --shared-token "$PLATFORM_SHARED_TOKEN" \
  --actor "phase1_cutover_check" \
  --source "phase1_cutover_check" \
  --input "$TMP_DIR/psi_payload.json"

curl -fsS \
  -H "Authorization: Bearer $PLATFORM_SHARED_TOKEN" \
  -H "X-Platform-Actor: phase1_cutover_check" \
  -H "X-Platform-Source: phase1_cutover_check" \
  -H "Content-Type: application/json" \
  -d '{"domainKey":"ga4","contractBundleId":"cb_phase1_v1"}' \
  "$PLATFORM_BASE_URL/v1/platform/pipeline-health/build" >/dev/null

curl -fsS \
  -H "Authorization: Bearer $PLATFORM_SHARED_TOKEN" \
  -H "X-Platform-Actor: phase1_cutover_check" \
  -H "X-Platform-Source: phase1_cutover_check" \
  -H "Content-Type: application/json" \
  -d '{"domainKey":"psi","contractBundleId":"cb_phase1_v1"}' \
  "$PLATFORM_BASE_URL/v1/platform/pipeline-health/build" >/dev/null

if [[ "${ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN:-false}" == "true" ]]; then
  python3 "$SCRIPT_DIR/platform_phase1_client.py" property-advocate-run \
    --base-url "$PLATFORM_BASE_URL" \
    --shared-token "$PLATFORM_SHARED_TOKEN" \
    --actor "phase1_cutover_check" \
    --source "phase1_cutover_check" \
    --property-id "${PHASE1_PROPERTY_ADVOCATE_PROPERTY_ID:-prop_1}" \
    --agent-id "${PHASE1_PROPERTY_ADVOCATE_AGENT_ID:-agent_prop_1}" \
    --contract-bundle-id "${PHASE1_CONTRACT_BUNDLE_ID:-cb_phase1_v1}" \
    --execution-policy-id "${PHASE1_EXECUTION_POLICY_ID:-exec_policy_property_advocate}" \
    --requested-by "phase1_cutover_check"
fi

echo "Phase 1 cutover verification completed successfully."
