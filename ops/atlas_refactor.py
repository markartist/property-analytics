#!/usr/bin/env python3
"""
Atlas Refactor Runner (Safe, Single-Run)
- Scans three repos
- Replaces sqlite3.connect(...) with connect_db()
- Inserts "from src.db.db_helper import connect_db" if missing
- Creates .bak backups of modified files
- Commits & pushes changes per repo
"""

import os, re, sys, subprocess
from pathlib import Path
from typing import List, Tuple

# --- CONFIG ---
REPOS = [
    Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report"),
    Path("/Users/mark/Property_Analytics/Portfolio_Monitoring"),
    Path("/Users/mark/Property_Analytics/Portfolio_Dashboard"),
]
EXCLUDE_DIRS = {"venv", "__pycache__", ".git", "node_modules", "dist", "build", "migrations"}
IMPORT_LINE = "from src.db.db_helper import connect_db\n"
CONNECT_PATTERN = re.compile(r"sqlite3\.connect\([^)]*\)", flags=re.DOTALL)

# --- UTILITIES ---
def log(msg: str) -> None:
    print(msg, flush=True)

def run(cmd: str, cwd: Path = None) -> Tuple[int, str, str]:
    proc = subprocess.Popen(
        cmd, cwd=str(cwd) if cwd else None, shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    out, err = proc.communicate()
    return proc.returncode, out.strip(), err.strip()

def find_py_files(root: Path) -> List[Path]:
    """Return all .py files under root, excluding common artifact directories."""
    files: List[Path] = []
    for p in root.rglob("*.py"):
        if any(part in EXCLUDE_DIRS for part in p.parts):
            continue
        files.append(p)
    return files

def inject_import(content: str) -> str:
    """Insert the helper import near the top if it’s not already present."""
    if IMPORT_LINE.strip() in content:
        return content
    lines = content.splitlines(True)
    insert_idx = 0
    # Preserve shebang/encoding lines
    while insert_idx < len(lines) and (
        lines[insert_idx].startswith("#!") or "coding:" in lines[insert_idx]
    ):
        insert_idx += 1
    # Skip initial blanks/comments
    while insert_idx < len(lines) and (
        lines[insert_idx].strip() == "" or lines[insert_idx].lstrip().startswith("#")
    ):
        insert_idx += 1
    lines.insert(insert_idx, IMPORT_LINE)
    return "".join(lines)

def refactor_file(pyfile: Path) -> Tuple[bool, int]:
    """
    Returns (modified, replacements_count).
    Creates a .bak of the original file before writing changes.
    """
    text = pyfile.read_text(encoding="utf-8", errors="ignore")
    if "sqlite3.connect(" not in text:
        return (False, 0)

    new_text, count = CONNECT_PATTERN.subn("connect_db()", text)
    if count > 0:
        new_text = inject_import(new_text)
        bak = pyfile.with_suffix(pyfile.suffix + ".bak")
        bak.write_text(text, encoding="utf-8")
        pyfile.write_text(new_text, encoding="utf-8")
        return (True, count)
    return (False, 0)

def commit_repo(repo: Path, modified_files: List[Path]) -> None:
    """Stage, commit and push only when files were actually modified."""
    if not modified_files:
        log(f"INFO: No changes to commit in {repo.name}")
        return
    files_arg = " ".join(str(p) for p in modified_files)
    code, out, err = run(f"git add {files_arg}", cwd=repo)
    if err: log(f"git add stderr ({repo.name}): {err}")
    code, out, err = run(
        'git commit -m "Refactor: use env-var helper (connect_db) for SQLite connections"', cwd=repo
    )
    if code != 0:
        log(f"INFO: commit resulted in no changes in {repo.name}")
    else:
        log(f"Committed in {repo.name}: {out}")
    code, out, err = run("git push", cwd=repo)
    if code != 0:
        log(f"WARN: git push failed in {repo.name}: {err}")
    else:
        log(f"Pushed in {repo.name}: {out}")

# --- MAIN ---
def main() -> None:
    log("=== Atlas Refactor Runner: START ===")
    summary: List[Tuple[str, str, int]] = []
    total_files = 0
    total_replacements = 0

    for repo in REPOS:
        if not repo.exists():
            log(f"ERROR: Repo not found: {repo}")
            sys.exit(1)

        log(f"-- Scanning repo: {repo} --")
        py_files = find_py_files(repo)
        modified = []
        for f in py_files:
            changed, count = refactor_file(f)
            if changed:
                modified.append(f)
                total_files += 1
                total_replacements += count
                rel = f.relative_to(repo)
                summary.append((repo.name, str(rel), count))
                log(f"UPDATED: {repo.name}/{rel} (replaced {count} occurrence(s))")

        commit_repo(repo, modified)

    log("\n=== Summary ===")
    if summary:
        for repo_name, relpath, cnt in summary:
            log(f"  {repo_name}: {relpath} → {cnt} replacement(s)")
    else:
        log("  No files required changes.")
    log(f"Total files updated: {total_files}")
    log(f"Total connect() replacements: {total_replacements}")
    log("=== Atlas Refactor Runner: COMPLETE ===")

if __name__ == "__main__":
    main()
