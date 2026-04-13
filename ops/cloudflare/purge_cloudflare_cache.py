#!/usr/bin/env python3
"""
Manual Cloudflare purge helper for pilot rollout work.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_repo_root = str(Path(__file__).resolve().parents[2])
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from ops.cloudflare.cache_rules_manager import CloudflareCacheRulesManager


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge Cloudflare cache for a pilot zone.")
    parser.add_argument("--domain", required=True, help="Zone/domain to purge.")
    parser.add_argument("--url", action="append", dest="urls", help="Specific URL to purge. Repeatable.")
    parser.add_argument("--purge-everything", action="store_true", help="Purge the entire zone cache.")
    args = parser.parse_args()

    manager = CloudflareCacheRulesManager()
    zone = manager.resolve_zone(args.domain)
    result = manager.purge_zone(
        zone["id"],
        files=args.urls,
        purge_everything=args.purge_everything,
    )
    print(json.dumps({"domain": args.domain, "zone_tag": zone["id"], "result": result}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
