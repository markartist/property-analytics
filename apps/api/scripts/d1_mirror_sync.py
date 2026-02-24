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
import sqlite3
import subprocess
import sys
from dataclasses import dataclass, asdict
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple


SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
REPO_ROOT = API_DIR.parent.parent
WRANGLER_TOML = API_DIR / "wrangler.toml"
CANONICAL_DB = REPO_ROOT / "data" / "portfolio_analytics.db"
GENERATED_DIR = SCRIPT_DIR / "generated"


@dataclass
class StepResult:
    name: str
    ok: bool
    details: str


def _run_cmd(cmd: List[str], cwd: Optional[Path] = None, timeout: int = 900) -> Tuple[int, str, str]:
    proc = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def _is_friday(s: str) -> bool:
    return date.fromisoformat(s).weekday() == 4


def _floor_to_friday(d: date) -> date:
    while d.weekday() != 4:
        d -= timedelta(days=1)
    return d


def _table_has_column(conn: sqlite3.Connection, table: str, col: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == col for r in rows)


def _max_date(conn: sqlite3.Connection, table: str, col: str) -> Optional[str]:
    if not _table_has_column(conn, table, col):
        return None
    row = conn.execute(f"SELECT MAX({col}) FROM {table}").fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])[:10]


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
            "guest_card_metrics.run_date": _max_date(conn, "guest_card_metrics", "run_date") or "",
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

    rc, out, err = _run_cmd(cmd, cwd=API_DIR, timeout=1800)
    if rc != 0:
        tail = (err or out)[-600:]
        return StepResult(script_name, False, f"exit={rc} | {tail}")
    return StepResult(script_name, True, "sync completed")


def _d1_query(sql: str) -> Tuple[bool, List[Dict], str]:
    cmd = [
        "npx",
        "wrangler",
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


def expected_d1_max_dates(recency: Dict[str, str]) -> Dict[str, Optional[str]]:
    """
    Compute expected D1 max dates by dataset from local recency.
    Uses Friday floor for weekly snapshot tables.
    """
    def _to_friday(v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        d = _floor_to_friday(date.fromisoformat(v))
        return d.isoformat()

    ga4_friday = _to_friday(recency.get("ga4_daily_metrics.metric_date"))
    guest_card_friday = _to_friday(recency.get("guest_card_metrics.run_date"))
    marketing_friday = _to_friday(recency.get("unit_availability.snapshot_date"))
    return {
        "pib_ga4_metrics": ga4_friday,
        "pib_search_performance": ga4_friday,
        "pib_site_performance": ga4_friday,
        "pib_local_presence": ga4_friday,
        "pib_cir": ga4_friday,
        "t7_metrics": guest_card_friday,
        "t30_metrics": guest_card_friday,
        "marketing_data": marketing_friday,
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
    expected_max = expected_d1_max_dates(recency)
    report["expected_max_dates"] = expected_max

    # Deterministic sync order.
    sync_scripts = [
        "guest_cards_to_d1.py",
        "pib_data_to_d1.py",
        "marketing_data_to_d1.py",
    ]
    for script in sync_scripts:
        step = run_sync_script(
            script,
            target_friday=target_friday,
            use_explicit_date=bool(args.date),
            weeks=args.weeks,
            dry_run=args.dry_run,
        )
        steps.append(step)
        print(f"[{script}] {'OK' if step.ok else 'FAIL'} - {step.details}")
        if not step.ok:
            report["steps"] = [asdict(s) for s in steps]
            report["success"] = False
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
    report["success"] = verify_step.ok and expected_step.ok
    report["finished_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path = write_report(report)
    print(f"Report: {path}")

    if not report["success"]:
        sys.exit(1)

    print("Mirror complete.")


if __name__ == "__main__":
    main()
