#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / "config" / "release_reconcile_snapshot.json"
OPERATIONAL_ARTIFACTS = {
    "config/release_provenance.json",
    "config/release_reconcile_snapshot.json",
}

LANE_RULES = [
    (
        "platform_app",
        [
            "apps/api/src/routes/pond.ts",
            "apps/web/src/app/watchtower/",
            "apps/web/src/app/system/",
            "apps/web/src/app/page.tsx",
            "apps/web/src/app/dock/",
            "apps/web/src/components/shared/",
            "apps/web/src/lib/api.ts",
            "apps/web/src/lib/permissions.ts",
            "apps/api/src/lib/permissions.ts",
            "apps/api/src/routes/health.ts",
            "apps/api/src/routes/auth.ts",
            "apps/api/src/routes/platform.ts",
            "apps/api/src/env.ts",
            "apps/api/wrangler.toml",
            "apps/web/.env.production",
            "apps/web/src/app/layout.tsx",
            "apps/web/src/app/globals.css",
            "scripts/update_release_provenance.py",
            "scripts/generate_release_reconcile_snapshot.py",
        ],
    ),
    (
        "data_collection_hardening",
        [
            "Data_Collection/",
            "generate_morning_full_report.py",
            "send_morning_full_report.py",
            "send_daily_health_report.py",
            "run_collection_retry_cycle.sh",
        ],
    ),
    (
        "content_operations",
        [
            "apps/web/src/app/site-content/",
            "apps/web/src/components/site-content-creator-page.tsx",
            "apps/web/src/app/intelligence-office/",
            "apps/web/src/app/analysis/search-intelligence/",
            "apps/web/src/app/vacs/",
            "apps/api/src/routes/admin-site-content.ts",
            "apps/api/src/routes/admin-intelligence.ts",
            "apps/api/src/routes/search-intelligence.ts",
            "apps/api/src/routes/vacs.ts",
            "apps/api/src/platform/intelligence/",
            "apps/api/src/platform/shared/specs-property-marketing-v1.ts",
            "docs/INTELLIGENCE_OFFICE_MODEL.md",
            "docs/SITE_CONTENT_CREATOR_MODEL.md",
            "docs/CONTENT_OPERATIONS_MODEL.md",
        ],
    ),
    (
        "zero_trust_sso",
        [
            "docs/CLOUDFLARE_ZERO_TRUST_",
            "docs/KSM_",
            "docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md",
            "scripts/zero_trust_",
            "scripts/bootstrap_cloudflare.sh",
            "apps/api/src/middleware/auth.ts",
            "apps/web/src/components/auth-provider.tsx",
            "apps/web/src/app/login/",
        ],
    ),
    (
        "evs_browserstack",
        [
            "apps/web/src/app/evs/",
            "apps/api/src/routes/evs.ts",
            "apps/api/src/evs/",
            "ops/browserstack/",
            "evs/",
        ],
    ),
    (
        "pilot_reporting",
        [
            "pilot_control_cwv/",
            "pilot_roundup/",
            "apps/web/src/app/tracker/",
            "apps/web/src/components/tracker/",
            "apps/web/src/lib/pilot-kpi.ts",
            "apps/pilot-tracker-standalone/",
            "ops/pilot_roundup/",
            "ops/gtmetrix/",
            "run_pilot_",
        ],
    ),
]


def git_changed_files() -> list[str]:
    result = subprocess.run(
        ["git", "status", "--short"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    files: list[str] = []
    for raw_line in result.stdout.splitlines():
        if not raw_line.strip():
            continue
        parts = raw_line.split(maxsplit=1)
        if len(parts) < 2:
            continue
        path = parts[1].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if path in OPERATIONAL_ARTIFACTS:
            continue
        files.append(path)
    return files


def classify(path: str) -> str:
    for lane, prefixes in LANE_RULES:
        for prefix in prefixes:
            if path.startswith(prefix):
                return lane
    if path.startswith("docs/") or path == "ATLAS_WORKING_MEMORY.md":
        return "docs_and_memory"
    if path in {".env.production", "Project_Memory.md", "memory/MEMORY_INDEX.md", "memory/PROJECT_STATE.md", ".nvmrc"}:
        return "risky_local"
    return "unclassified"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the canonical release-reconcile snapshot from the current worktree."
    )
    parser.parse_args()

    changed = git_changed_files()
    grouped: dict[str, list[str]] = defaultdict(list)
    for path in changed:
        grouped[classify(path)].append(path)

    recommended_primary_slice = [
        "platform_app",
        "data_collection_hardening",
        "docs_and_memory",
    ]
    primary_count = sum(len(grouped.get(lane, [])) for lane in recommended_primary_slice)
    total_count = len(changed)

    data = {
      "version": "2026-04-18.release-reconcile-snapshot.v1",
      "updated_at": str(date.today()),
      "purpose": "Current dirty-tree release reconciliation snapshot grouped by canonical workstream lane.",
      "operational_artifacts_ignored": sorted(OPERATIONAL_ARTIFACTS),
      "working_tree": {
        "changed_file_count": total_count,
        "primary_release_slice_count": primary_count,
        "non_primary_count": max(0, total_count - primary_count),
      },
      "recommended_release_candidate": {
        "label": "platform_app + data_collection_hardening",
        "canonical_branch": "codex/release-reconcile",
        "included_lanes": recommended_primary_slice,
        "exclude_lanes": [
          "content_operations",
          "zero_trust_sso",
          "evs_browserstack",
          "pilot_reporting",
          "risky_local",
          "unclassified",
        ],
        "readiness_note": "The first clean enterprise release slice should converge on platform/app plus data-collection hardening, with the other lanes explicitly separated.",
      },
      "lane_counts": {
        lane: len(paths)
        for lane, paths in sorted(grouped.items())
      },
      "lane_examples": {
        lane: paths[:8]
        for lane, paths in sorted(grouped.items())
      },
    }

    OUTPUT_PATH.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Updated {OUTPUT_PATH}")
    print(f"changed_file_count={total_count}")
    print(f"primary_release_slice_count={primary_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
