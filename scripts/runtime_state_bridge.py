from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
API_ROOT = REPO_ROOT / "apps" / "api"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import resolve_secret


DEFAULT_KSM_PROFILE = "marketingops"
DEFAULT_CLOUDFLARE_TOKEN_NOTATION = "keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password"
DEFAULT_ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"


def resolve_cloudflare_token() -> str:
    return resolve_secret(
        description="Cloudflare API token",
        notation_env_var="KSM_CLOUDFLARE_TOKEN_NOTATION",
        default_notation=DEFAULT_CLOUDFLARE_TOKEN_NOTATION,
        direct_env_var="CLOUDFLARE_API_TOKEN",
        default_profile=DEFAULT_KSM_PROFILE,
    )


def escape_sql(value: str) -> str:
    return value.replace("'", "''")


def wrangler_env(account_id: str, token: str | None = None) -> dict[str, str]:
    env = os.environ.copy()
    env["CLOUDFLARE_API_TOKEN"] = token or resolve_cloudflare_token()
    env["CLOUDFLARE_ACCOUNT_ID"] = account_id
    return env


def publish_runtime_state(
    *,
    state_key: str,
    payload: dict,
    source_mode: str,
    published_by: str,
    notes: str,
    account_id: str = DEFAULT_ACCOUNT_ID,
    token: str | None = None,
) -> None:
    payload_json = json.dumps(payload, separators=(",", ":"))
    sql = f"""
INSERT INTO runtime_release_state (state_key, payload_json, source_mode, updated_at, published_by, notes)
VALUES (
  '{escape_sql(state_key)}',
  '{escape_sql(payload_json)}',
  '{escape_sql(source_mode)}',
  datetime('now'),
  '{escape_sql(published_by)}',
  '{escape_sql(notes)}'
)
ON CONFLICT(state_key) DO UPDATE SET
  payload_json = excluded.payload_json,
  source_mode = excluded.source_mode,
  updated_at = excluded.updated_at,
  published_by = excluded.published_by,
  notes = excluded.notes;
""".strip()

    subprocess.run(
        [
            "npx",
            "wrangler",
            "d1",
            "execute",
            "pop-brief-db",
            "--remote",
            "--command",
            sql,
        ],
        cwd=API_ROOT,
        check=True,
        env=wrangler_env(account_id, token),
        capture_output=True,
        text=True,
    )
