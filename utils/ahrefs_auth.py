#!/usr/bin/env python3
"""Keeper-backed Ahrefs authentication helpers."""

from __future__ import annotations

from dataclasses import dataclass

from utils.ksm import resolve_secret

DEFAULT_AHREFS_API_KEY_NOTATION = "keeper://xbIaayyCqMfrzVFjRei5hA/field/password"


@dataclass(frozen=True)
class AhrefsCredentials:
    api_key: str

    @property
    def authorization_header(self) -> str:
        return f"Bearer {self.api_key}"


def resolve_ahrefs_credentials(default_profile: str = "marketingops") -> AhrefsCredentials:
    api_key = resolve_secret(
        description="Ahrefs API key",
        notation_env_var="KSM_AHREFS_API_KEY_NOTATION",
        default_notation=DEFAULT_AHREFS_API_KEY_NOTATION,
        direct_env_var="AHREFS_API_KEY",
        default_profile=default_profile,
    )
    return AhrefsCredentials(api_key=api_key)
