#!/usr/bin/env python3
"""Keeper-backed Microsoft Graph OAuth helpers for Ops Watch."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from utils.ksm import resolve_secret

GRAPH_SCOPE = "https://graph.microsoft.com/.default"
GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
TOKEN_TIMEOUT_SECONDS = 30


class Ms365GraphAuthError(RuntimeError):
    """Raised when Microsoft Graph OAuth cannot be completed."""


@dataclass(frozen=True)
class Ms365GraphCredentials:
    tenant_id: str
    client_id: str
    client_secret: str
    mailbox_user: str


@dataclass(frozen=True)
class Ms365GraphToken:
    access_token: str
    token_type: str
    expires_in: int

    @property
    def authorization_header(self) -> str:
        return f"{self.token_type} {self.access_token}"


def resolve_ms365_graph_credentials(default_profile: str = "marketingops") -> Ms365GraphCredentials:
    """Resolve Microsoft Graph OAuth material strictly through Keeper notation env vars."""
    tenant_id = resolve_secret(
        description="Microsoft 365 tenant id",
        notation_env_var="KSM_MS365_TENANT_ID_NOTATION",
        default_profile=default_profile,
    )
    client_id = resolve_secret(
        description="Microsoft 365 Graph client id",
        notation_env_var="KSM_MS365_CLIENT_ID_NOTATION",
        default_profile=default_profile,
    )
    client_secret = resolve_secret(
        description="Microsoft 365 Graph client secret",
        notation_env_var="KSM_MS365_CLIENT_SECRET_NOTATION",
        default_profile=default_profile,
    )
    mailbox_user = resolve_secret(
        description="Microsoft 365 mailbox user principal name",
        notation_env_var="KSM_MS365_MAILBOX_USER_NOTATION",
        default_profile=default_profile,
    )
    return Ms365GraphCredentials(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
        mailbox_user=mailbox_user,
    )


def acquire_ms365_graph_token(credentials: Ms365GraphCredentials) -> Ms365GraphToken:
    token_url = f"https://login.microsoftonline.com/{urllib.parse.quote(credentials.tenant_id)}/oauth2/v2.0/token"
    body = urllib.parse.urlencode(
        {
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scope": GRAPH_SCOPE,
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        token_url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TOKEN_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = _safe_error_detail(exc)
        raise Ms365GraphAuthError(f"Microsoft Graph token request failed with HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise Ms365GraphAuthError(f"Microsoft Graph token request failed: {exc.reason}") from exc

    access_token = str(payload.get("access_token") or "")
    token_type = str(payload.get("token_type") or "Bearer")
    expires_in = int(payload.get("expires_in") or 0)
    if not access_token:
        raise Ms365GraphAuthError("Microsoft Graph token response did not include an access token.")
    return Ms365GraphToken(access_token=access_token, token_type=token_type, expires_in=expires_in)


def graph_get(token: Ms365GraphToken, path: str) -> dict[str, Any]:
    url = f"{GRAPH_BASE_URL}/{path.lstrip('/')}"
    request = urllib.request.Request(url, headers={"Authorization": token.authorization_header}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=TOKEN_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = _safe_error_detail(exc)
        raise Ms365GraphAuthError(f"Microsoft Graph GET failed with HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise Ms365GraphAuthError(f"Microsoft Graph GET failed: {exc.reason}") from exc


def _safe_error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode("utf-8"))
    except Exception:
        return "no sanitized JSON error body"
    error = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(error, dict):
        code = str(error.get("code") or "")
        message = str(error.get("message") or "")
        return f"{code}: {message}".strip(": ")
    return "sanitized error body unavailable"
