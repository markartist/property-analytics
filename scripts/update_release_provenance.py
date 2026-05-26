#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import date
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
CONFIG_PATH = ROOT / "config" / "release_provenance.json"


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def current_dirty() -> bool:
    return bool(run_git("status", "--short"))


def infer_provenance_status(source_mode: str, source_branch: str, canonical_release_path: str) -> str:
    if source_mode == "clean_release_candidate" and source_branch == canonical_release_path:
        return "aligned"
    if source_mode in {"dirty_worktree_direct", "mixed_worktree_direct"}:
        return "transitional"
    return "review"


def infer_provenance_note(source_mode: str, source_branch: str, canonical_release_path: str) -> str:
    if source_mode == "clean_release_candidate" and source_branch == canonical_release_path:
        return "The currently deployed slice was promoted from the canonical clean release path."
    if source_mode == "dirty_worktree_direct":
        return (
            "The currently deployed slice was promoted directly from an active worktree instead of a clean "
            "release-shaped path. This is temporarily acceptable for guided enterprise-hardening work, but it is "
            "not the long-term standard."
        )
    if source_mode == "mixed_worktree_direct":
        return (
            "The currently deployed slice was promoted from a worktree that still carried unrelated open changes. "
            "Promotion should move back to a clean release-shaped path."
        )
    return (
        f"The deployed slice is not yet aligned to the canonical release path {canonical_release_path}. "
        "Treat this as a review-state release until provenance is cleaned up."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Update canonical release provenance record from current git/deploy state.")
    parser.add_argument("--release-lane", default="platform_app")
    parser.add_argument("--canonical-release-path", default="codex/release-reconcile")
    parser.add_argument("--source-mode", choices=["auto", "clean_release_candidate", "dirty_worktree_direct", "mixed_worktree_direct"], default="auto")
    parser.add_argument("--worker-version")
    parser.add_argument("--worker-url", default="https://pop-brief-api.mlaufhutte.workers.dev")
    parser.add_argument("--pages-url")
    parser.add_argument("--pages-watchtower-url")
    parser.add_argument("--pages-alias-url")
    parser.add_argument("--pages-runtime-id")
    args = parser.parse_args()

    data = json.loads(CONFIG_PATH.read_text())
    source_branch = run_git("branch", "--show-current")
    head_sha = run_git("rev-parse", "HEAD")
    short_sha = run_git("rev-parse", "--short", "HEAD")
    log_line = run_git("log", "-1", "--pretty=format:%cI%n%s")
    committed_at, subject = log_line.split("\n", 1)

    dirty = current_dirty()
    source_mode = args.source_mode
    if source_mode == "auto":
        source_mode = "dirty_worktree_direct" if dirty else "clean_release_candidate"

    provenance_status = infer_provenance_status(source_mode, source_branch, args.canonical_release_path)
    provenance_note = infer_provenance_note(source_mode, source_branch, args.canonical_release_path)

    data["updated_at"] = str(date.today())
    data["release_descriptor"] = {
        "source_branch": source_branch,
        "baseline_commit": {
            "sha": head_sha,
            "short_sha": short_sha,
            "committed_at": committed_at,
            "subject": subject,
        },
        "source_mode": source_mode,
        "release_lane": args.release_lane,
        "canonical_release_path": args.canonical_release_path,
        "provenance_status": provenance_status,
        "provenance_note": provenance_note,
    }

    deployment_by_service = {item["service_id"]: item for item in data.get("deployments", [])}

    if args.worker_version:
      deployment_by_service["data_pond_api"] = {
          "service_id": "data_pond_api",
          "target": "Cloudflare Workers",
          "deployed_at": str(date.today()),
          "runtime_identifier": args.worker_version,
          "public_url": args.worker_url,
      }

    if args.pages_runtime_id and args.pages_url:
      deployment_by_service["data_pond_web"] = {
          "service_id": "data_pond_web",
          "target": "Cloudflare Pages",
          "deployed_at": str(date.today()),
          "runtime_identifier": args.pages_runtime_id,
          "public_url": args.pages_url,
      }

    if args.pages_runtime_id and args.pages_watchtower_url and args.worker_version:
      deployment_by_service["watchtower_control_plane"] = {
          "service_id": "watchtower_control_plane",
          "target": "Cloudflare Pages + Workers",
          "deployed_at": str(date.today()),
          "runtime_identifier": f"{args.pages_runtime_id} + {args.worker_version}",
          "public_url": args.pages_watchtower_url,
      }

    data["deployments"] = sorted(deployment_by_service.values(), key=lambda item: item["service_id"])
    data["next_moves"] = [
        "Move production promotion back onto codex/release-reconcile or a clean release-shaped equivalent.",
        "Replace operator-maintained release pedigree with CI-issued provenance.",
        "Track clean commit-based promotion for Pages and Worker deploys instead of dirty worktree direct deploys.",
    ]

    CONFIG_PATH.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Updated {CONFIG_PATH}")
    print(f"source_branch={source_branch}")
    print(f"source_mode={source_mode}")
    print(f"provenance_status={provenance_status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
