from __future__ import annotations

import argparse
import json
import shutil
from datetime import date
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
REPORTS = ROOT / "pilot_control_cwv" / "reports"
DEPOSITORY = REPORTS / "depository"
TRACKER_SNAPSHOTS = ROOT / "apps" / "pilot-tracker-standalone" / "public" / "pilot-kpi" / "latest"


def ensure_dirs() -> dict[str, Path]:
    dirs = {
        "root": DEPOSITORY,
        "daily_packages": DEPOSITORY / "daily_packages",
        "snapshots_bi": DEPOSITORY / "snapshots" / "bi",
        "snapshots_dashboard": DEPOSITORY / "snapshots" / "dashboard",
        "email_previews": DEPOSITORY / "email" / "previews",
        "email_panels": DEPOSITORY / "email" / "panels",
        "diagnostics": DEPOSITORY / "diagnostics",
        "manifests": DEPOSITORY / "manifests",
        "qa": DEPOSITORY / "qa",
        "prototypes": DEPOSITORY / "prototypes",
        "scratch": DEPOSITORY / "scratch",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def copy_if_exists(src: Path, dest: Path) -> bool:
    if not src.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return True


def copy_tree_contents(src_dir: Path, dest_dir: Path, pattern: str = "*") -> list[str]:
    copied: list[str] = []
    if not src_dir.exists():
        return copied
    dest_dir.mkdir(parents=True, exist_ok=True)
    for src in src_dir.glob(pattern):
        if src.is_file():
            shutil.copy2(src, dest_dir / src.name)
            copied.append(src.name)
    return sorted(copied)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync the latest pilot reporting artifacts into a stable depository layout.")
    parser.add_argument("--run-date", default=date.today().isoformat(), help="Run/package date in YYYY-MM-DD format.")
    parser.add_argument(
        "--coverage-date",
        default=None,
        help="Underlying data coverage date in YYYY-MM-DD format. Defaults to run date if omitted.",
    )
    args = parser.parse_args()

    run_date = args.run_date
    coverage_date = args.coverage_date or run_date
    dirs = ensure_dirs()

    package_dir = dirs["daily_packages"] / run_date
    dashboard_dir = dirs["snapshots_dashboard"] / run_date
    email_panel_dir = dirs["email_panels"] / run_date
    diagnostic_dir = dirs["diagnostics"] / run_date
    package_dir.mkdir(parents=True, exist_ok=True)
    dashboard_dir.mkdir(parents=True, exist_ok=True)
    email_panel_dir.mkdir(parents=True, exist_ok=True)
    diagnostic_dir.mkdir(parents=True, exist_ok=True)

    workbook = REPORTS / f"Pilot_KPI_Summary_Details_Full_{run_date}.xlsx"
    bi_snapshot = REPORTS / f"pilot_bi_snapshot_normalized_{coverage_date}.csv"
    email_preview = REPORTS / f"pilot_kpi_email_preview_{run_date}.html"

    copied = {
        "workbook": copy_if_exists(workbook, package_dir / workbook.name),
        "bi_snapshot": copy_if_exists(bi_snapshot, dirs["snapshots_bi"] / bi_snapshot.name),
        "email_preview": copy_if_exists(email_preview, dirs["email_previews"] / email_preview.name),
        "dashboard_json": copy_tree_contents(TRACKER_SNAPSHOTS, dashboard_dir, "*.json"),
        "email_panels": copy_tree_contents(REPORTS / "email_panels", email_panel_dir, f"*_{run_date}.png"),
        "diagnostics": [],
    }

    for pattern in [
        f"*_{coverage_date}.md",
        f"*_{coverage_date}.csv",
        f"*_{coverage_date}.json",
    ]:
        copied["diagnostics"].extend(copy_tree_contents(REPORTS, diagnostic_dir, pattern))
    copied["diagnostics"] = sorted(set(copied["diagnostics"]))

    manifest = {
        "run_date": run_date,
        "coverage_date": coverage_date,
        "package_dir": str(package_dir),
        "copied": copied,
        "sources": {
            "workbook": str(workbook),
            "bi_snapshot": str(bi_snapshot),
            "email_preview": str(email_preview),
            "dashboard_snapshot_dir": str(TRACKER_SNAPSHOTS),
        },
    }

    manifest_path = dirs["manifests"] / f"pilot_report_package_{run_date}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    copy_if_exists(manifest_path, package_dir / manifest_path.name)

    print(f"Synced pilot report depository for run_date={run_date} coverage_date={coverage_date}")
    print(f"package={package_dir}")
    print(f"manifest={manifest_path}")


if __name__ == "__main__":
    main()
