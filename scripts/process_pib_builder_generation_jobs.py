#!/usr/bin/env python3
"""Process PIB Builder generation jobs with the locked canonical PIB generator.

This is orchestration glue only. It does not modify or reimplement PIB rendering;
it claims queued Builder jobs, runs the approved v2.2.1 generator, publishes the
resulting Outlook-safe HTML artifact to R2, and records the artifact key in D1.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
API_DIR = REPO_ROOT / "apps" / "api"
GENERATOR = REPO_ROOT / "Property_Intelligence_Brief" / "generate_property_intelligence_brief_v2_2_1.py"
WORK_DIR = REPO_ROOT / "tmp" / "pib_builder_generation"
D1_NAME = "pop-brief-db"
R2_BUCKET = "pop-brief-uploads"
WORKER_NAME = "pib-builder-generation-worker"

for import_path in [REPO_ROOT, API_DIR / "scripts"]:
    if str(import_path) not in sys.path:
        sys.path.insert(0, str(import_path))

from wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sql_quote(value: Any) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def slugify(value: str) -> str:
    value = value.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def extract_result_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("results"), list):
            return payload["results"]
        if isinstance(payload.get("result"), list):
            for item in payload["result"]:
                rows = extract_result_rows(item)
                if rows:
                    return rows
        for value in payload.values():
            rows = extract_result_rows(value)
            if rows:
                return rows
    if isinstance(payload, list):
        for item in payload:
            rows = extract_result_rows(item)
            if rows:
                return rows
    return []


class Wrangler:
    def __init__(self) -> None:
        self.env = build_runtime_env()
        self.prefix = npx_wrangler_prefix(self.env)
        if not self.env.get("CLOUDFLARE_API_TOKEN"):
            raise RuntimeError("Cloudflare API token was not resolved from Keeper/KSM.")

    def run(self, args: list[str], *, cwd: Path = API_DIR, capture: bool = True) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [*self.prefix, *args],
            cwd=str(cwd),
            env=self.env,
            text=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            check=False,
        )

    def d1(self, sql: str) -> list[dict[str, Any]]:
        result = self.run(["d1", "execute", D1_NAME, "--remote", "--json", "--command", sql])
        if result.returncode != 0:
            raise RuntimeError(f"D1 command failed: {result.stderr.strip() or result.stdout.strip()}")
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Unable to parse D1 JSON output: {result.stdout[:500]}") from exc
        return extract_result_rows(payload)

    def r2_put(self, key: str, file_path: Path) -> None:
        result = self.run(["r2", "object", "put", f"{R2_BUCKET}/{key}", "--file", str(file_path), "--remote"])
        if result.returncode != 0:
            raise RuntimeError(f"R2 upload failed: {result.stderr.strip() or result.stdout.strip()}")


def date_args(date_range: str) -> list[str]:
    label = date_range.lower()
    if "60" in label:
        return ["--days", "60"]
    if "90" in label:
        return ["--days", "90"]
    return []


def find_generated_html(outdir: Path, property_name: str) -> Path:
    slug = slugify(property_name)
    candidates = sorted(outdir.glob(f"{slug}/**/*.html"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        candidates = sorted(outdir.glob("**/*.html"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("Canonical generator completed without producing an HTML artifact.")
    return candidates[0]


def claim_jobs(wrangler: Wrangler, limit: int) -> list[dict[str, Any]]:
    return wrangler.d1(
        "SELECT * FROM pib_report_generation_jobs "
        "WHERE status = 'queued' "
        "ORDER BY created_at ASC "
        f"LIMIT {int(limit)}"
    )


def update_job(wrangler: Wrangler, job_id: str, fields: dict[str, Any]) -> None:
    assignments = ["updated_at = " + sql_quote(utc_now())]
    assignments.extend(f"{name} = {sql_quote(value)}" for name, value in fields.items())
    wrangler.d1(
        "UPDATE pib_report_generation_jobs "
        f"SET {', '.join(assignments)} "
        f"WHERE id = {sql_quote(job_id)}"
    )


def replace_artifact_chunks(wrangler: Wrangler, job_id: str, html: str, *, chunk_size: int = 12_000) -> None:
    created_at = utc_now()
    wrangler.d1(f"DELETE FROM pib_report_generation_artifact_chunks WHERE job_id = {sql_quote(job_id)}")
    for index, start in enumerate(range(0, len(html), chunk_size)):
        chunk = html[start:start + chunk_size]
        wrangler.d1(
            "INSERT INTO pib_report_generation_artifact_chunks (job_id, chunk_index, chunk_text, created_at) "
            f"VALUES ({sql_quote(job_id)}, {index}, {sql_quote(chunk)}, {sql_quote(created_at)})"
        )


def process_job(wrangler: Wrangler, job: dict[str, Any], *, python_bin: str) -> None:
    job_id = str(job["id"])
    property_name = str(job.get("community_name") or "").strip()
    if not property_name:
        raise RuntimeError("Queued PIB generation job is missing community_name.")

    started = utc_now()
    wrangler.d1(
        "UPDATE pib_report_generation_jobs "
        f"SET status = 'running', claimed_by = {sql_quote(WORKER_NAME)}, "
        f"started_at = {sql_quote(started)}, updated_at = {sql_quote(started)} "
        f"WHERE id = {sql_quote(job_id)} AND status = 'queued'"
    )

    outdir = WORK_DIR / job_id
    outdir.mkdir(parents=True, exist_ok=True)
    command = [
        python_bin,
        str(GENERATOR),
        "--property",
        property_name,
        "--outdir",
        str(outdir),
        *date_args(str(job.get("date_range") or "")),
    ]
    result = subprocess.run(
        command,
        cwd=str(REPO_ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stdout[-2000:])

    html_path = find_generated_html(outdir, property_name)
    key = f"pib/reports/{slugify(property_name)}/{html_path.name}"
    html = html_path.read_text(encoding="utf-8")
    r2_error = None
    try:
        wrangler.r2_put(key, html_path)
    except Exception as exc:  # noqa: BLE001 - D1 artifact fallback keeps the report usable.
        r2_error = str(exc)[-900:]
        print(f"R2 publish warning for job {job_id}: {r2_error}", file=sys.stderr)
    replace_artifact_chunks(wrangler, job_id, html)
    update_job(
        wrangler,
        job_id,
        {
            "status": "succeeded",
            "artifact_key": key,
            "artifact_filename": html_path.name,
            "artifact_html": None,
            "error_text": f"R2 publish warning: {r2_error}" if r2_error else None,
            "finished_at": utc_now(),
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Process queued PIB Builder canonical generation jobs.")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--python", default=sys.executable)
    args = parser.parse_args()

    wrangler = Wrangler()
    jobs = claim_jobs(wrangler, args.limit)
    if not jobs:
        print("No queued PIB generation jobs.")
        return 0

    failures = 0
    for job in jobs:
        job_id = str(job.get("id"))
        try:
            print(f"Processing PIB generation job {job_id} for {job.get('community_name')}")
            process_job(wrangler, job, python_bin=args.python)
            print(f"Generated canonical PIB artifact for job {job_id}")
        except Exception as exc:  # noqa: BLE001 - worker records sanitized failure context.
            failures += 1
            message = str(exc)[-1800:] or "PIB generation failed."
            update_job(
                wrangler,
                job_id,
                {
                    "status": "failed",
                    "error_text": message,
                    "finished_at": utc_now(),
                },
            )
            print(f"Job {job_id} failed: {message}", file=sys.stderr)

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
