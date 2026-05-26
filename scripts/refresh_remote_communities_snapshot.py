#!/usr/bin/env python3
"""Refresh the local snapshot of remote D1 communities for identity reconciliation."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
API_DIR = ROOT / "apps" / "api"
DEFAULT_OUTPUT = ROOT / "config" / "generated" / "remote_communities_snapshot.json"

sys.path.insert(0, str(API_DIR / "scripts"))
from wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull remote D1 communities into a local generated snapshot.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    sql = """
    SELECT id, name, external_key, region, status, manager_name, unit_count,
           ga4_property_id, full_url, encasa_short_name, encasa_property_code,
           city, state, created_at, updated_at
    FROM communities
    WHERE deleted_at IS NULL
    ORDER BY name;
    """
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--command",
        sql,
        "--json",
        "--config",
        str(API_DIR / "wrangler.toml"),
    ]
    result = subprocess.run(cmd, cwd=str(API_DIR), env=env, text=True, capture_output=True, timeout=1800)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)

    payload = json.loads(result.stdout)
    rows = payload[0].get("results", []) if payload else []
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps({"source": "remote D1 pop-brief-db.communities", "rows": rows}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(output),
                "rows": len(rows),
                "with_ga4": sum(1 for row in rows if row.get("ga4_property_id")),
                "with_code": sum(1 for row in rows if row.get("encasa_property_code")),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
