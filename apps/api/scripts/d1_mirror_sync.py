#!/usr/bin/env python3
"""
Daily D1 Mirror Sync
====================
Ensures Cloudflare D1 mirrors the validated local canonical database.

Pipeline:
1. Validate local SQLite integrity/freshness.
2. Run lightweight local maintenance.
3. Sync Guest Cards, PIB, and Marketing datasets to D1.
4. Verify D1 freshness/sanity for the target Friday.
5. Write a JSON audit report.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, asdict
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import KsmResolutionError, resolve_secret
from wrangler_auth import build_runtime_env, npx_wrangler_prefix


SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
REPO_ROOT = API_DIR.parent.parent
WRANGLER_TOML = API_DIR / "wrangler.toml"
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"
GENERATED_DIR = SCRIPT_DIR / "generated"
PLATFORM_CLIENT = SCRIPT_DIR / "platform_phase1_client.py"
CHECKSUM_STAMPER = SCRIPT_DIR / "stamp_phase1_payload_checksums.js"


@dataclass
class StepResult:
    name: str
    ok: bool
    details: str


CORE_MIRROR_SYNC_SCRIPTS = {
    "guest_cards_to_d1.py",
    "gbp_reviews_to_d1.py",
    "gsc_daily_to_d1.py",
    "google_ads_to_d1.py",
    "pib_data_to_d1.py",
    "marketing_data_to_d1.py",
}

ADVISORY_MIRROR_SYNC_SCRIPTS = {
    "captain_sources_to_d1.py",
}


def _fnv1a32(value: str) -> str:
    hash_value = 0x811C9DC5
    for char in value:
        hash_value ^= ord(char)
        hash_value = (hash_value * 0x01000193) & 0xFFFFFFFF
    return f"{hash_value:08x}"


def _stable_hash(parts: List[object]) -> str:
    return _fnv1a32("|".join("" if part is None else str(part) for part in parts))


def _run_cmd(cmd: List[str], cwd: Optional[Path] = None, timeout: int = 900) -> Tuple[int, str, str]:
    env = build_runtime_env()
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        start_new_session=True,
    )
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
        return proc.returncode, stdout, stderr
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            stdout, stderr = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            stdout, stderr = proc.communicate()
        timeout_note = f"Command timed out after {timeout}s: {' '.join(cmd)}\n"
        return 124, (stdout or ""), timeout_note + (stderr or "")


def _is_friday(s: str) -> bool:
    return date.fromisoformat(s).weekday() == 4


def _floor_to_friday(d: date) -> date:
    while d.weekday() != 4:
        d -= timedelta(days=1)
    return d


def _table_has_column(conn: sqlite3.Connection, table: str, col: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == col for r in rows)


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def _guest_card_source_table(conn: sqlite3.Connection) -> str:
    if _table_exists(conn, "guest_card_metrics_dw_direct"):
        row = conn.execute(
            "SELECT COUNT(*) FROM guest_card_metrics_dw_direct"
        ).fetchone()
        if row and int(row[0] or 0) > 0:
            return "guest_card_metrics_dw_direct"
    return "guest_card_metrics"


def _max_date(conn: sqlite3.Connection, table: str, col: str) -> Optional[str]:
    if not _table_has_column(conn, table, col):
        return None
    row = conn.execute(f"SELECT MAX({col}) FROM {table}").fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])[:10]


def _platform_sync_enabled() -> bool:
    return os.environ.get("ENABLE_PHASE1_PLATFORM_SYNC", "").strip().lower() in {"1", "true", "yes"}


def _property_advocate_enabled() -> bool:
    return os.environ.get("ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN", "").strip().lower() in {"1", "true", "yes"}


def _phase1_local_simulation_only() -> bool:
    return os.environ.get("PHASE1_LOCAL_SIMULATION_ONLY", "").strip().lower() in {"1", "true", "yes"}


def _resolve_platform_access_client_id() -> str:
    try:
        return resolve_secret(
            description="Platform Access client id",
            notation_env_var="KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION",
            direct_env_var="PLATFORM_ACCESS_CLIENT_ID",
            default_profile="marketingops",
        )
    except KsmResolutionError:
        return ""


def _resolve_platform_access_client_secret() -> str:
    try:
        return resolve_secret(
            description="Platform Access client secret",
            notation_env_var="KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION",
            direct_env_var="PLATFORM_ACCESS_CLIENT_SECRET",
            default_profile="marketingops",
        )
    except KsmResolutionError:
        return ""


def _resolve_platform_shared_token() -> str:
    try:
        return resolve_secret(
            description="Platform shared token",
            notation_env_var="KSM_PLATFORM_SHARED_TOKEN_NOTATION",
            direct_env_var="PLATFORM_SHARED_TOKEN",
            default_profile="marketingops",
        )
    except KsmResolutionError:
        return ""


def _build_phase1_ga4_payload(conn: sqlite3.Connection, contract_bundle_id: str) -> Dict[str, object]:
    metric_date = _max_date(conn, "ga4_daily_metrics", "metric_date")
    if not metric_date:
        raise RuntimeError("No GA4 data available for Phase 1 mirror payload")

    rows = conn.execute(
        """
        SELECT property_id, metric_date, total_users, new_users, sessions, pageviews,
               avg_session_duration, bounce_rate
        FROM ga4_daily_metrics
        WHERE metric_date = ?
        ORDER BY property_id
        """,
        (metric_date,),
    ).fetchall()
    if not rows:
        raise RuntimeError(f"No GA4 rows found for latest metric_date {metric_date}")

    records: List[Dict[str, object]] = []
    row_hashes: List[str] = []
    for row in rows:
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
        row_hashes.append(
            _stable_hash(
                [
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
                ]
            )
        )

    slice_checksum = _stable_hash([len(row_hashes), *sorted(row_hashes)])
    batch_checksum = _stable_hash(["platform_ga4_daily_metrics", metric_date, slice_checksum])
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return {
        "domainKey": "ga4",
        "mirrorBatchId": f"mb_ga4_live_{metric_date}_{suffix}",
        "sourceValidationBatchId": f"val_ga4_live_{metric_date}_{suffix}",
        "sourceSnapshotId": f"snap_ga4_live_{metric_date}",
        "contractBundleId": contract_bundle_id,
        "schemaBundleVersion": "schema_v1",
        "validatorBundleVersion": "validator_v1",
        "mirrorBundleVersion": "mirror_v1",
        "payloadContractVersion": "payload_v1",
        "batchDateStart": metric_date,
        "batchDateEnd": metric_date,
        "rowCountTotalExpected": len(records),
        "checksumManifest": json.dumps({"batchChecksum": batch_checksum}),
        "payloadSlices": [
            {
                "mirrorBatchSliceId": f"slice_ga4_live_{metric_date}_{suffix}",
                "targetTable": "platform_ga4_daily_metrics",
                "sliceKey": metric_date,
                "rowCountExpected": len(records),
                "sliceChecksumExpected": slice_checksum,
                "recordsJson": json.dumps(records),
            }
        ],
        "sourceHost": "local-mac",
        "operatorId": os.environ.get("PLATFORM_OPERATOR_ID", os.environ.get("USER", "local_mac")),
    }


def _build_phase1_psi_payload(conn: sqlite3.Connection, contract_bundle_id: str) -> Dict[str, object]:
    metric_date = _max_date(conn, "pagespeed_metrics", "metric_date")
    if not metric_date:
        raise RuntimeError("No PSI data available for Phase 1 mirror payload")

    rows = conn.execute(
        """
        SELECT property_id, metric_date, strategy, performance_score, accessibility_score,
               best_practices_score, seo_score, lcp_value, cls_value, fcp_value,
               total_blocking_time, fid_value, ttfb_value
        FROM pagespeed_metrics
        WHERE metric_date = ?
        ORDER BY property_id, strategy
        """,
        (metric_date,),
    ).fetchall()
    if not rows:
        raise RuntimeError(f"No PSI rows found for latest metric_date {metric_date}")

    records: List[Dict[str, object]] = []
    row_hashes: List[str] = []
    for row in rows:
        strategy = str(row["strategy"]).strip().lower()
        if strategy not in {"mobile", "desktop"}:
            continue
        record = {
            "propertyId": str(row["property_id"]),
            "metricDate": str(row["metric_date"])[:10],
            "strategy": strategy,
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
        row_hashes.append(
            _stable_hash(
                [
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
                ]
            )
        )

    if not records:
        raise RuntimeError(f"No supported PSI rows found for latest metric_date {metric_date}")

    slice_checksum = _stable_hash([len(row_hashes), *sorted(row_hashes)])
    batch_checksum = _stable_hash(["platform_psi_daily_metrics", metric_date, slice_checksum])
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return {
        "domainKey": "psi",
        "mirrorBatchId": f"mb_psi_live_{metric_date}_{suffix}",
        "sourceValidationBatchId": f"val_psi_live_{metric_date}_{suffix}",
        "sourceSnapshotId": f"snap_psi_live_{metric_date}",
        "contractBundleId": contract_bundle_id,
        "schemaBundleVersion": "schema_v1",
        "validatorBundleVersion": "validator_v1",
        "mirrorBundleVersion": "mirror_v1",
        "payloadContractVersion": "payload_v1",
        "batchDateStart": metric_date,
        "batchDateEnd": metric_date,
        "rowCountTotalExpected": len(records),
        "checksumManifest": json.dumps({"batchChecksum": batch_checksum}),
        "payloadSlices": [
            {
                "mirrorBatchSliceId": f"slice_psi_live_{metric_date}_{suffix}",
                "targetTable": "platform_psi_daily_metrics",
                "sliceKey": metric_date,
                "rowCountExpected": len(records),
                "sliceChecksumExpected": slice_checksum,
                "recordsJson": json.dumps(records),
            }
        ],
        "sourceHost": "local-mac",
        "operatorId": os.environ.get("PLATFORM_OPERATOR_ID", os.environ.get("USER", "local_mac")),
    }


def _resolve_property_advocate_property_id(conn: sqlite3.Connection, preferred: Optional[str]) -> Optional[str]:
    if preferred:
        return preferred

    row = conn.execute(
        """
        SELECT g.property_id
        FROM ga4_daily_metrics g
        WHERE g.metric_date = (SELECT MAX(metric_date) FROM ga4_daily_metrics)
          AND EXISTS (
            SELECT 1 FROM pagespeed_metrics p
            WHERE p.property_id = g.property_id
          )
        ORDER BY g.property_id
        LIMIT 1
        """
    ).fetchone()
    return str(row[0]) if row and row[0] is not None else None


def _write_phase1_activity_report(activity: Dict[str, object]) -> Path:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = GENERATED_DIR / f"platform_phase1_activity_{ts}.json"
    path.write_text(json.dumps(activity, indent=2), encoding="utf-8")
    return path


def _run_platform_client(args: List[str]) -> Dict[str, object]:
    cmd = [sys.executable, str(PLATFORM_CLIENT), *args]
    rc, out, err = _run_cmd(cmd, cwd=API_DIR, timeout=1200)
    if rc != 0:
        tail = (err or out)[-1200:]
        raise RuntimeError(f"platform client failed ({rc}): {tail}")
    try:
        return json.loads(out)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"platform client returned non-JSON output: {exc}") from exc


def _stamp_phase1_payload_checksums(payload_path: Path) -> None:
    if not CHECKSUM_STAMPER.exists():
        raise RuntimeError(f"Missing checksum stamper: {CHECKSUM_STAMPER}")
    rc, out, err = _run_cmd(["node", str(CHECKSUM_STAMPER), str(payload_path)], cwd=API_DIR, timeout=120)
    if rc != 0:
        tail = (err or out)[-1200:]
        raise RuntimeError(f"checksum stamper failed ({rc}): {tail}")


def run_phase1_platform_sync() -> Tuple[StepResult, Dict[str, object]]:
    if not _platform_sync_enabled():
        return StepResult("phase1_platform_sync", True, "skipped (ENABLE_PHASE1_PLATFORM_SYNC not set)"), {
            "enabled": False,
            "skipped": True,
        }

    if not PLATFORM_CLIENT.exists():
        return StepResult("phase1_platform_sync", False, f"Missing platform client: {PLATFORM_CLIENT}"), {
            "enabled": True,
            "skipped": False,
        }

    base_url = os.environ.get("PLATFORM_BASE_URL")
    shared_token = _resolve_platform_shared_token()
    access_client_id = _resolve_platform_access_client_id()
    access_client_secret = _resolve_platform_access_client_secret()
    has_shared_auth = bool(shared_token)
    has_access_auth = bool(access_client_id and access_client_secret)
    if not base_url or not (has_shared_auth or has_access_auth):
        return StepResult(
            "phase1_platform_sync",
            False,
            "PLATFORM_BASE_URL and either PLATFORM_SHARED_TOKEN or PLATFORM_ACCESS_CLIENT_ID plus "
            "PLATFORM_ACCESS_CLIENT_SECRET are required when ENABLE_PHASE1_PLATFORM_SYNC is enabled",
        ), {"enabled": True, "skipped": False}

    conn = sqlite3.connect(str(CANONICAL_DB))
    conn.row_factory = sqlite3.Row
    temp_dir_obj = tempfile.TemporaryDirectory(prefix="phase1-platform-sync-")
    temp_dir = Path(temp_dir_obj.name)
    activity: Dict[str, object] = {
        "enabled": True,
        "base_url": base_url,
        "auth_mode": "access_service_token" if has_access_auth else "shared_token",
        "actor": os.environ.get("PLATFORM_ROUTE_ACTOR", "d1_mirror_sync"),
        "source": os.environ.get("PLATFORM_ROUTE_SOURCE", "d1_mirror_sync"),
        "runs": {},
    }
    try:
        contract_bundle_id = os.environ.get("PHASE1_CONTRACT_BUNDLE_ID", "cb_phase1_v1")
        shared_args = [
            "--base-url",
            base_url,
            "--actor",
            os.environ.get("PLATFORM_ROUTE_ACTOR", "d1_mirror_sync"),
            "--source",
            os.environ.get("PLATFORM_ROUTE_SOURCE", "d1_mirror_sync"),
        ]
        if has_access_auth:
            shared_args.extend(
                [
                    "--access-client-id",
                    access_client_id or "",
                    "--access-client-secret",
                    access_client_secret or "",
                ]
            )
        else:
            shared_args.extend(
                [
                    "--shared-token",
                    shared_token or "",
                ]
            )

        for domain_key, builder in (("ga4", _build_phase1_ga4_payload), ("psi", _build_phase1_psi_payload)):
            payload = builder(conn, contract_bundle_id)
            payload_path = temp_dir / f"{domain_key}_payload.json"
            payload_path.write_text(json.dumps(payload), encoding="utf-8")
            _stamp_phase1_payload_checksums(payload_path)
            result = _run_platform_client(
                [
                    "mirror-batch",
                    *shared_args,
                    "--input",
                    str(payload_path),
                ]
            )
            activity["runs"][domain_key] = result

        if _property_advocate_enabled():
            property_id = _resolve_property_advocate_property_id(
                conn, os.environ.get("PHASE1_PROPERTY_ADVOCATE_PROPERTY_ID")
            )
            if not property_id:
                raise RuntimeError("Could not resolve a property_id for the Phase 1 property advocate run")
            advocate_result = _run_platform_client(
                [
                    "property-advocate-run",
                    *shared_args,
                    "--property-id",
                    property_id,
                    "--agent-id",
                    os.environ.get("PHASE1_PROPERTY_ADVOCATE_AGENT_ID", "agent_prop_1"),
                    "--contract-bundle-id",
                    contract_bundle_id,
                    "--execution-policy-id",
                    os.environ.get("PHASE1_EXECUTION_POLICY_ID", "exec_policy_property_advocate"),
                    "--requested-by",
                    os.environ.get("PHASE1_REQUESTED_BY", "d1_mirror_sync"),
                    "--operator-id",
                    os.environ.get("PLATFORM_OPERATOR_ID", os.environ.get("USER", "local_mac")),
                    "--trigger-type",
                    os.environ.get("PHASE1_TRIGGER_TYPE", "scheduled"),
                    "--trigger-source",
                    os.environ.get("PHASE1_TRIGGER_SOURCE", "d1_mirror_sync"),
                ]
            )
            activity["property_advocate"] = {
                "property_id": property_id,
                "response": advocate_result,
            }
        else:
            activity["property_advocate"] = {"enabled": False, "skipped": True}

        activity_path = _write_phase1_activity_report(activity)
        activity["activity_report_path"] = str(activity_path)
        detail = f"mirrored ga4+psi via platform routes; activity={activity_path.name}"
        if _property_advocate_enabled():
            detail += "; property advocate executed"
        return StepResult("phase1_platform_sync", True, detail), activity
    except Exception as exc:
        activity["error"] = str(exc)
        activity_path = _write_phase1_activity_report(activity)
        activity["activity_report_path"] = str(activity_path)
        return StepResult("phase1_platform_sync", False, f"{exc} | activity={activity_path.name}"), activity
    finally:
        temp_dir_obj.cleanup()
        conn.close()


def validate_local_db() -> Tuple[StepResult, Dict[str, str]]:
    if not CANONICAL_DB.exists():
        return StepResult("local_db_validate", False, f"Missing DB: {CANONICAL_DB}"), {}

    conn = sqlite3.connect(str(CANONICAL_DB))
    try:
        quick = conn.execute("PRAGMA quick_check").fetchone()
        if not quick or quick[0] != "ok":
            return StepResult("local_db_validate", False, f"PRAGMA quick_check failed: {quick}"), {}

        full = conn.execute("PRAGMA integrity_check").fetchone()
        if not full or full[0] != "ok":
            return StepResult("local_db_validate", False, f"PRAGMA integrity_check failed: {full}"), {}

        recency = {
            "ga4_daily_metrics.metric_date": _max_date(conn, "ga4_daily_metrics", "metric_date") or "",
            "pagespeed_metrics.metric_date": _max_date(conn, "pagespeed_metrics", "metric_date") or "",
            "guest_cards.run_date": _max_date(conn, _guest_card_source_table(conn), "run_date") or "",
            "unit_availability.snapshot_date": _max_date(conn, "unit_availability", "snapshot_date") or "",
        }
        if any(not v for v in recency.values()):
            return StepResult("local_db_validate", False, f"Missing recency markers: {recency}"), recency

        return StepResult("local_db_validate", True, "Integrity checks passed"), recency
    finally:
        conn.close()


def maintenance_local_db(run_vacuum: bool) -> StepResult:
    conn = sqlite3.connect(str(CANONICAL_DB))
    try:
        conn.execute("PRAGMA optimize")
        conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
        conn.commit()
    finally:
        conn.close()

    if run_vacuum:
        conn = sqlite3.connect(str(CANONICAL_DB))
        try:
            conn.execute("VACUUM")
            conn.commit()
        finally:
            conn.close()
        return StepResult("local_db_maintenance", True, "optimize + wal_checkpoint + vacuum")

    return StepResult("local_db_maintenance", True, "optimize + wal_checkpoint")


def resolve_target_friday(explicit_date: Optional[str], recency: Dict[str, str]) -> Tuple[Optional[str], StepResult]:
    if explicit_date:
        try:
            if not _is_friday(explicit_date):
                return None, StepResult("resolve_target_friday", False, f"{explicit_date} is not a Friday")
            return explicit_date, StepResult("resolve_target_friday", True, f"Using explicit Friday {explicit_date}")
        except ValueError as exc:
            return None, StepResult("resolve_target_friday", False, f"Invalid --date: {exc}")

    latest_dates = [date.fromisoformat(v) for v in recency.values() if v]
    if not latest_dates:
        return None, StepResult("resolve_target_friday", False, "No source recency dates found")

    common_latest = min(latest_dates)
    friday = _floor_to_friday(common_latest)
    return friday.isoformat(), StepResult(
        "resolve_target_friday",
        True,
        f"Computed Friday {friday.isoformat()} from min latest source date {common_latest.isoformat()}",
    )


def run_sync_script(
    script_name: str,
    target_friday: str,
    use_explicit_date: bool,
    weeks: int,
    dry_run: bool,
) -> StepResult:
    script_path = SCRIPT_DIR / script_name
    if not script_path.exists():
        return StepResult(script_name, False, f"Missing script: {script_path}")

    cmd = [sys.executable, str(script_path)]
    # Explicit date mode for deterministic replay; weekly backfill for daily drift repair.
    if use_explicit_date:
        cmd.extend(["--date", target_friday])
    elif weeks > 0:
        cmd.extend(["--weeks", str(weeks)])
    if dry_run:
        cmd.append("--dry-run")

    attempts = 3 if script_name == "captain_sources_to_d1.py" else 1
    for attempt in range(1, attempts + 1):
        rc, out, err = _run_cmd(cmd, cwd=API_DIR, timeout=1800)
        if rc == 0:
            if attempt == 1:
                return StepResult(script_name, True, "sync completed")
            return StepResult(script_name, True, f"sync completed after retry {attempt}/{attempts}")

        tail = (err or out)[-600:]
        lowered_tail = tail.lower()
        transient = any(
            marker in lowered_tail
            for marker in (
                "fetch failed",
                "connectivity issue",
                "remote end closed connection",
                "connection reset",
                "timed out",
            )
        )
        if attempt < attempts and transient:
            time.sleep(2 * attempt)
            continue
        return StepResult(script_name, False, f"exit={rc} | attempt {attempt}/{attempts} | {tail}")

    return StepResult(script_name, False, f"exit=1 | exhausted retries for {script_name}")


def _d1_query(sql: str) -> Tuple[bool, List[Dict], str]:
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--command",
        sql,
        "--config",
        str(WRANGLER_TOML),
        "--json",
    ]
    rc, out, err = _run_cmd(cmd, cwd=API_DIR, timeout=120)
    if rc != 0:
        return False, [], err.strip()[-400:]
    try:
        parsed = json.loads(out)
        rows = parsed[0]["results"] if isinstance(parsed, list) else parsed.get("results", [])
        return True, rows, ""
    except Exception as exc:
        return False, [], f"JSON parse failed: {exc}"


def verify_wrangler_access() -> StepResult:
    """Fail fast if wrangler binary/auth is unavailable."""
    env = build_runtime_env()
    rc, out, err = _run_cmd([*npx_wrangler_prefix(env), "--version"], cwd=API_DIR, timeout=30)
    if rc != 0:
        tail = (err or out)[-300:]
        return StepResult("wrangler_access", False, f"Wrangler unavailable: {tail}")

    ok, rows, msg = _d1_query("SELECT 1 AS ok;")
    if not ok:
        return StepResult("wrangler_access", False, f"D1 access check failed: {msg}")
    if not rows:
        return StepResult("wrangler_access", False, "D1 access check returned no rows")
    return StepResult("wrangler_access", True, "Wrangler + D1 access OK")


def verify_local_source_freshness(recency: Dict[str, str], max_age_days: int = 2) -> StepResult:
    """Ensure critical local sources are fresh; report non-critical stale sources."""
    today = date.today()
    hard_stale: List[str] = []
    soft_stale: List[str] = []
    # Criticality policy:
    # - required=True sources block the mirror when stale.
    # - required=False sources are reported but do not block the mirror.
    source_policy = {
        "ga4_daily_metrics.metric_date": {"required": True, "max_age_days": max_age_days},
        "guest_cards.run_date": {"required": False, "max_age_days": max_age_days},
        "unit_availability.snapshot_date": {"required": False, "max_age_days": max_age_days},
    }

    for key, policy in source_policy.items():
        source_max_age = int(policy["max_age_days"])
        required = bool(policy["required"])
        val = recency.get(key) or ""
        if not val:
            target = hard_stale if required else soft_stale
            target.append(f"{key}=missing")
            continue
        try:
            age = (today - date.fromisoformat(val)).days
        except ValueError:
            target = hard_stale if required else soft_stale
            target.append(f"{key}=invalid({val})")
            continue
        if age > source_max_age:
            target = hard_stale if required else soft_stale
            target.append(f"{key}={val} (age={age}d)")

    if hard_stale:
        return StepResult("local_source_freshness", False, f"Critical stale sources: {', '.join(hard_stale)}")

    if soft_stale:
        return StepResult(
            "local_source_freshness",
            True,
            f"Critical sources fresh; non-blocking stale sources: {', '.join(soft_stale)}"
        )

    return StepResult("local_source_freshness", True, f"All sources <= {max_age_days} days old")


def verify_d1(target_friday: str) -> Tuple[StepResult, Dict[str, object]]:
    checks: Dict[str, object] = {"target_friday": target_friday}

    max_queries = {
        "t7_metrics": "SELECT MAX(week_date) AS max_date FROM t7_metrics;",
        "t30_metrics": "SELECT MAX(week_date) AS max_date FROM t30_metrics;",
        "marketing_data": "SELECT MAX(week_date) AS max_date FROM marketing_data;",
        "pib_ga4_metrics": "SELECT MAX(snapshot_date) AS max_date FROM pib_ga4_metrics;",
    }
    for key, sql in max_queries.items():
        ok, rows, msg = _d1_query(sql)
        if not ok:
            return StepResult("verify_d1", False, f"{key} max query failed: {msg}"), checks
        checks[f"{key}_max_date"] = rows[0]["max_date"] if rows else None

    count_queries = {
        "active_communities": "SELECT COUNT(*) AS c FROM communities WHERE deleted_at IS NULL;",
        "t7_rows": f"SELECT COUNT(*) AS c FROM t7_metrics WHERE week_date = '{target_friday}' AND type = 'community';",
        "t30_rows": f"SELECT COUNT(*) AS c FROM t30_metrics WHERE week_date = '{target_friday}' AND type = 'community';",
        "marketing_rows": f"SELECT COUNT(*) AS c FROM marketing_data WHERE week_date = '{target_friday}';",
        "pib_ga4_rows": f"SELECT COUNT(*) AS c FROM pib_ga4_metrics WHERE snapshot_date = '{target_friday}';",
    }
    for key, sql in count_queries.items():
        ok, rows, msg = _d1_query(sql)
        if not ok:
            return StepResult("verify_d1", False, f"{key} count query failed: {msg}"), checks
        checks[key] = int(rows[0]["c"]) if rows else 0

    # Freshness checks: mirrored tables must include target Friday.
    stale = []
    for key in ("t7_metrics", "t30_metrics", "marketing_data", "pib_ga4_metrics"):
        max_date = checks.get(f"{key}_max_date")
        if not max_date or str(max_date) < target_friday:
            stale.append(f"{key} max={max_date}")

    if stale:
        return StepResult("verify_d1", False, f"Freshness check failed: {', '.join(stale)}"), checks

    if checks["t7_rows"] == 0 or checks["t30_rows"] == 0:
        return StepResult(
            "verify_d1",
            False,
            f"No T7/T30 rows for {target_friday} (t7={checks['t7_rows']}, t30={checks['t30_rows']})",
        ), checks

    if checks["t7_rows"] != checks["t30_rows"]:
        return StepResult(
            "verify_d1",
            False,
            f"T7/T30 mismatch for {target_friday} (t7={checks['t7_rows']}, t30={checks['t30_rows']})",
        ), checks

    return StepResult("verify_d1", True, "D1 freshness and sanity checks passed"), checks


def expected_d1_max_dates(target_friday: str) -> Dict[str, Optional[str]]:
    """
    Compute expected D1 max dates by dataset from the resolved sync target Friday.
    The mirror intentionally syncs to a single Friday across datasets.
    """
    return {
        "pib_ga4_metrics": target_friday,
        "pib_search_performance": target_friday,
        "pib_site_performance": target_friday,
        "pib_local_presence": target_friday,
        "pib_cir": target_friday,
        "t7_metrics": target_friday,
        "t30_metrics": target_friday,
        "marketing_data": target_friday,
    }


def verify_d1_expected_max(expected: Dict[str, Optional[str]]) -> StepResult:
    """
    Enforce expected max snapshot/week dates per D1 table.
    """
    table_to_col = {
        "pib_ga4_metrics": "snapshot_date",
        "pib_search_performance": "snapshot_date",
        "pib_site_performance": "snapshot_date",
        "pib_local_presence": "snapshot_date",
        "pib_cir": "snapshot_date",
        "t7_metrics": "week_date",
        "t30_metrics": "week_date",
        "marketing_data": "week_date",
    }

    stale = []
    for table, exp in expected.items():
        if not exp:
            continue
        col = table_to_col[table]
        ok, rows, msg = _d1_query(f"SELECT MAX({col}) AS max_date FROM {table};")
        if not ok:
            return StepResult("verify_d1_expected_max", False, f"{table} query failed: {msg}")
        actual = rows[0]["max_date"] if rows else None
        if not actual or str(actual) < exp:
            stale.append(f"{table}: expected>={exp}, actual={actual}")

    if stale:
        return StepResult("verify_d1_expected_max", False, "; ".join(stale))
    return StepResult("verify_d1_expected_max", True, "All table max dates meet expected thresholds")


def write_report(report: Dict[str, object]) -> Path:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = GENERATED_DIR / f"d1_mirror_report_{ts}.json"
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return path


def _step_tier(step_name: str) -> str:
    if step_name in CORE_MIRROR_SYNC_SCRIPTS:
        return "core_sync"
    if step_name in ADVISORY_MIRROR_SYNC_SCRIPTS:
        return "advisory_sync"
    if step_name in {"verify_d1", "verify_d1_expected_max", "wrangler_access", "local_db_validate", "local_db_maintenance", "local_source_freshness", "resolve_target_friday"}:
        return "core"
    return "core"


def _report_success_fields(steps: List[StepResult]) -> Dict[str, object]:
    core_failures = [asdict(step) for step in steps if (not step.ok and _step_tier(step.name) in {"core", "core_sync"})]
    advisory_failures = [asdict(step) for step in steps if (not step.ok and _step_tier(step.name) == "advisory_sync")]
    core_success = not core_failures
    overall_success = core_success and not advisory_failures
    return {
        "core_success": core_success,
        "success": overall_success,
        "mirror_status": "success" if overall_success else ("degraded" if core_success else "failed"),
        "core_failures": core_failures,
        "advisory_failures": advisory_failures,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily D1 mirror sync")
    parser.add_argument("--date", help="Target Friday (YYYY-MM-DD). Defaults to computed safe Friday.")
    parser.add_argument("--weeks", type=int, default=2, help="Backfill window when date not supplied (default: 2)")
    parser.add_argument("--dry-run", action="store_true", help="Run sync scripts in dry-run mode")
    parser.add_argument("--vacuum", action="store_true", help="Run VACUUM after optimize/checkpoint")
    args = parser.parse_args()

    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    steps: List[StepResult] = []
    report: Dict[str, object] = {
        "started_at_utc": started,
        "canonical_db": str(CANONICAL_DB),
        "dry_run": args.dry_run,
        "steps": [],
    }

    print("\n============================================================")
    print("D1 MIRROR SYNC")
    print("============================================================")

    local_step, recency = validate_local_db()
    steps.append(local_step)
    report["local_recency"] = recency
    print(f"[{local_step.name}] {'OK' if local_step.ok else 'FAIL'} - {local_step.details}")
    if not local_step.ok:
        report["steps"] = [asdict(s) for s in steps]
        report["success"] = False
        path = write_report(report)
        print(f"Report: {path}")
        sys.exit(1)

    maintenance_step = maintenance_local_db(run_vacuum=args.vacuum)
    steps.append(maintenance_step)
    print(f"[{maintenance_step.name}] {'OK' if maintenance_step.ok else 'FAIL'} - {maintenance_step.details}")

    simulation_only = _phase1_local_simulation_only()
    report["phase1_local_simulation_only"] = simulation_only

    if simulation_only:
        source_freshness_step = verify_local_source_freshness(recency, max_age_days=2)
        steps.append(source_freshness_step)
        print(f"[{source_freshness_step.name}] {'OK' if source_freshness_step.ok else 'FAIL'} - {source_freshness_step.details}")
        if not source_freshness_step.ok:
            report["steps"] = [asdict(s) for s in steps]
            report["success"] = False
            path = write_report(report)
            print(f"Report: {path}")
            sys.exit(1)

        target_friday, friday_step = resolve_target_friday(args.date, recency)
        steps.append(friday_step)
        print(f"[{friday_step.name}] {'OK' if friday_step.ok else 'FAIL'} - {friday_step.details}")
        if not friday_step.ok or not target_friday:
            report["steps"] = [asdict(s) for s in steps]
            report["success"] = False
            path = write_report(report)
            print(f"Report: {path}")
            sys.exit(1)

        report["target_friday"] = target_friday
        expected_max = expected_d1_max_dates(target_friday)
        report["expected_max_dates"] = expected_max

        phase1_step, phase1_activity = run_phase1_platform_sync()
        steps.append(phase1_step)
        report["phase1_platform"] = phase1_activity
        print(f"[{phase1_step.name}] {'OK' if phase1_step.ok else 'FAIL'} - {phase1_step.details}")

        report["steps"] = [asdict(s) for s in steps]
        report["success"] = phase1_step.ok
        report["finished_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        report["mode"] = "phase1_local_simulation_only"
        path = write_report(report)
        print(f"Report: {path}")
        if not report["success"]:
            sys.exit(1)
        print("Phase 1 local simulation complete.")
        return

    wrangler_step = verify_wrangler_access()
    steps.append(wrangler_step)
    print(f"[{wrangler_step.name}] {'OK' if wrangler_step.ok else 'FAIL'} - {wrangler_step.details}")
    if not wrangler_step.ok:
        report["steps"] = [asdict(s) for s in steps]
        report["success"] = False
        path = write_report(report)
        print(f"Report: {path}")
        sys.exit(1)

    source_freshness_step = verify_local_source_freshness(recency, max_age_days=2)
    steps.append(source_freshness_step)
    print(f"[{source_freshness_step.name}] {'OK' if source_freshness_step.ok else 'FAIL'} - {source_freshness_step.details}")
    if not source_freshness_step.ok:
        report["steps"] = [asdict(s) for s in steps]
        report["success"] = False
        path = write_report(report)
        print(f"Report: {path}")
        sys.exit(1)

    target_friday, friday_step = resolve_target_friday(args.date, recency)
    steps.append(friday_step)
    print(f"[{friday_step.name}] {'OK' if friday_step.ok else 'FAIL'} - {friday_step.details}")
    if not friday_step.ok or not target_friday:
        report["steps"] = [asdict(s) for s in steps]
        report["success"] = False
        path = write_report(report)
        print(f"Report: {path}")
        sys.exit(1)

    report["target_friday"] = target_friday
    expected_max = expected_d1_max_dates(target_friday)
    report["expected_max_dates"] = expected_max

    phase1_step, phase1_activity = run_phase1_platform_sync()
    steps.append(phase1_step)
    report["phase1_platform"] = phase1_activity
    print(f"[{phase1_step.name}] {'OK' if phase1_step.ok else 'FAIL'} - {phase1_step.details}")
    if not phase1_step.ok:
        report["steps"] = [asdict(s) for s in steps]
        report["success"] = False
        path = write_report(report)
        print(f"Report: {path}")
        sys.exit(1)

    # Deterministic sync order.
    sync_scripts = [
        ("guest_cards_to_d1.py", True),
        ("gbp_reviews_to_d1.py", True),
        ("gsc_daily_to_d1.py", True),
        ("google_ads_to_d1.py", True),
        ("pib_data_to_d1.py", True),
        ("marketing_data_to_d1.py", True),
        ("captain_sources_to_d1.py", False),
    ]
    for script, required in sync_scripts:
        step = run_sync_script(
            script,
            target_friday=target_friday,
            use_explicit_date=bool(args.date),
            weeks=args.weeks,
            dry_run=args.dry_run,
        )
        steps.append(step)
        print(f"[{script}] {'OK' if step.ok else 'FAIL'} - {step.details}")
        if not step.ok and required:
            report["steps"] = [asdict(s) for s in steps]
            report.update(_report_success_fields(steps))
            report["finished_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            path = write_report(report)
            print(f"Report: {path}")
            sys.exit(1)

    verify_step, d1_checks = verify_d1(target_friday)
    steps.append(verify_step)
    report["d1_checks"] = d1_checks
    print(f"[{verify_step.name}] {'OK' if verify_step.ok else 'FAIL'} - {verify_step.details}")

    expected_step = verify_d1_expected_max(expected_max)
    steps.append(expected_step)
    print(f"[{expected_step.name}] {'OK' if expected_step.ok else 'FAIL'} - {expected_step.details}")

    report["steps"] = [asdict(s) for s in steps]
    report.update(_report_success_fields(steps))
    report["finished_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path = write_report(report)
    print(f"Report: {path}")

    if not bool(report["core_success"]):
        sys.exit(1)

    print("Mirror complete.")


if __name__ == "__main__":
    main()
