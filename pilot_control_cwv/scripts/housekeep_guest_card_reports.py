from __future__ import annotations

import argparse
import re
import shutil
from datetime import datetime
from pathlib import Path


GUEST_CARD_REPORTS = Path(
    "/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports"
)
ARCHIVE_DIR = GUEST_CARD_REPORTS / "Archive"
MEASUREMENT_FILE_RE = re.compile(r"^Measurement_Dashboard(?:_(?P<version>[0-9.]+))?\.xlsx$", re.IGNORECASE)
WORKBOOK_PREFIX = "Pilot_KPI_Summary_Details_Full_"


def measurement_version(path: Path) -> tuple[int, ...]:
    match = MEASUREMENT_FILE_RE.match(path.name)
    if not match or not match.group("version"):
        return (0,)
    return tuple(int(part) for part in match.group("version").split(".") if part.isdigit()) or (0,)


def latest_measurement_workbook() -> Path | None:
    candidates = [
        path
        for path in GUEST_CARD_REPORTS.iterdir()
        if path.is_file() and not path.name.startswith("~$") and MEASUREMENT_FILE_RE.match(path.name)
    ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda path: (measurement_version(path), path.stat().st_mtime, path.name))[-1]


def build_keep_set(run_date: str | None) -> set[str]:
    keep: set[str] = set()
    measurement = latest_measurement_workbook()
    if measurement:
        keep.add(measurement.name)
    if run_date:
        keep.add(f"{WORKBOOK_PREFIX}{run_date}.xlsx")
    return keep


def archive_path_for(src: Path) -> Path:
    candidate = ARCHIVE_DIR / src.name
    if not candidate.exists():
        return candidate
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return ARCHIVE_DIR / f"{src.stem}_{stamp}{src.suffix}"


def move_consumed_files(run_date: str | None, dry_run: bool = False) -> list[tuple[str, str]]:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    keep = build_keep_set(run_date)
    moved: list[tuple[str, str]] = []

    for path in sorted(GUEST_CARD_REPORTS.iterdir()):
        if path.name.startswith("."):
            continue
        if path.is_dir():
            continue
        if path.name in keep:
            continue

        dest = archive_path_for(path)
        moved.append((str(path), str(dest)))
        if not dry_run:
            shutil.move(str(path), str(dest))

    return moved


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Move consumed Guest_Card_Reports source files into Archive, keeping the Measurement workbook and current exported pilot workbook in place."
    )
    parser.add_argument(
        "--run-date",
        default=None,
        help="Current workbook run date in YYYY-MM-DD format. Keeps Pilot_KPI_Summary_Details_Full_<run-date>.xlsx in place.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which files would be archived without moving them.",
    )
    args = parser.parse_args()

    moved = move_consumed_files(args.run_date, dry_run=args.dry_run)
    mode = "Would move" if args.dry_run else "Moved"
    print(f"{mode} {len(moved)} file(s).")
    for src, dest in moved:
        print(f"{src} -> {dest}")


if __name__ == "__main__":
    main()
