
#!/usr/bin/env python3
"""
Atlas Mini-Runner (Safe, Single-Run Automation)
- No shell sourcing
- No LaunchAgents
- No mass replaces
- Clear logs, idempotent commits
"""

import os, sys, shutil, subprocess, sqlite3, time
from pathlib import Path

# --- CONFIG (edit if your paths differ) ---
CANONICAL_DB = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
BACKUP_DIR   = Path("/Users/mark/Property_Analytics/data/backups")
ARCHIVE_DIR  = Path("/Users/mark/Property_Analytics/data/archive")

REPOS = [
    Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report"),
    Path("/Users/mark/Property_Analytics/Portfolio_Monitoring"),
    Path("/Users/mark/Property_Analytics/Portfolio_Dashboard"),
]

# Optional orphan DBs (copied if present)
ORPHANS = [
    Path("/Users/mark/Property_Analytics/Portfolio_Monitoring/data/portfolio_monitoring.db"),
    Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/data/analytics_database.db"),
    Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/data/portfolio_monitoring.db"),
    Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/platform/backend/data/analytics.db"),
    Path("/Users/mark/Property_Analytics/Portfolio_Dashboard/data/analytics.db"),
]

HELPER_CODE = """\
import os
import sqlite3

def get_db_path():
    env_path = os.getenv("PORTFOLIO_ANALYTICS_DB_PATH")
    fallback_path = "/Users/mark/Property_Analytics/data/portfolio_analytics.db"
    if env_path and os.path.exists(env_path):
        return env_path
    elif os.path.exists(fallback_path):
        return fallback_path
    else:
        raise FileNotFoundError(
            f"Database not found. Checked env var ({env_path}) and fallback ({fallback_path})."
        )

def connect_db():
    return sqlite3.connect(get_db_path())
"""

def log(msg): print(msg, flush=True)

def run(cmd, cwd=None):
    proc = subprocess.Popen(cmd, cwd=cwd, shell=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, err = proc.communicate()
    return proc.returncode, out.strip(), err.strip()

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def timestamp():
    return time.strftime("%Y%m%d_%H%M%S")

# --- PHASES ---
def preflight():
    if not CANONICAL_DB.exists():
        raise FileNotFoundError(f"Canonical DB not found: {CANONICAL_DB}")
    for r in REPOS:
        if not r.exists():
            raise FileNotFoundError(f"Repo path missing: {r}")
    log("Preflight: canonical DB and repo paths found.")

def phase_backups():
    ensure_dir(BACKUP_DIR); ensure_dir(ARCHIVE_DIR)
    bname = BACKUP_DIR / f"portfolio_analytics_backup_{timestamp()}.db"
    shutil.copy2(CANONICAL_DB, bname)
    log(f"Backup created: {bname}")
    for o in ORPHANS:
        if o.exists():
            shutil.copy2(o, ARCHIVE_DIR / o.name)
            log(f"Archived orphan: {o.name}")
        else:
            log(f"INFO: orphan not found (skipped): {o}")

def phase_helper_injection():
    for repo in REPOS:
        target_dir = repo / "src" / "db"
        ensure_dir(target_dir)
        helper_file = target_dir / "db_helper.py"
        helper_file.write_text(HELPER_CODE, encoding="utf-8")
        log(f"Helper added: {helper_file}")

def phase_verification():
    os.environ["PORTFOLIO_ANALYTICS_DB_PATH"] = str(CANONICAL_DB)
    conn = sqlite3.connect(str(CANONICAL_DB))
    cur = conn.cursor()
    cur.execute("PRAGMA integrity_check;")
    res = cur.fetchone()
    if not res or res[0] != "ok":
        raise RuntimeError(f"Integrity check failed: {res}")
    log("Integrity: ok")
    try:
        cur.execute("SELECT COUNT(*) FROM ga4_event_facts;")
        cnt = cur.fetchone()[0]
        log(f"ga4_event_facts count: {cnt}")
    except Exception:
        log("INFO: ga4_event_facts not present; continuing")
    conn.close()

def phase_commits():
    for repo in REPOS:
        readme = repo / "README.md"
        if not readme.exists():
            readme.write_text("", encoding="utf-8")
        content = readme.read_text(encoding="utf-8")
        if "PORTFOLIO_ANALYTICS_DB_PATH" not in content:
            content += "\nRequires PORTFOLIO_ANALYTICS_DB_PATH env var pointing to canonical DB.\n"
            readme.write_text(content, encoding="utf-8")
            log(f"README updated: {readme}")
        else:
            log(f"README already contains note: {readme}")

        code, out, err = run("git add src/db/db_helper.py README.md", cwd=str(repo))
        if err: log(f"git add stderr ({repo.name}): {err}")
        code, out, err = run('git commit -m "DB: add env-var helper + README note"', cwd=str(repo))
        if code != 0:
            log(f"INFO: no changes to commit in {repo.name}")
        else:
            log(f"Committed in {repo.name}: {out}")
        code, out, err = run("git push", cwd=str(repo))
        if code != 0:
            log(f"WARN: git push failed in {repo.name}: {err}")
        else:
            log(f"Pushed in {repo.name}: {out}")

def main():
    try:
        log("=== Atlas Mini-Runner: START ===")
        preflight()
        phase_backups()
        phase_helper_injection()
        phase_verification()
        phase_commits()
        log("=== Atlas Mini-Runner: COMPLETE ===")
        log("Next: import and use helper where you open DBs:\n  from src.db.db_helper import connect_db\n  conn = connect_db()")
    except Exception as e:
        log(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
