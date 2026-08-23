#!/usr/bin/env python3
"""Keeper-backed Resi API authentication helpers."""

from __future__ import annotations

from dataclasses import dataclass

from utils.ksm import resolve_secret

DEFAULT_RESI_API_TOKEN_NOTATION = "keeper://2tuAKQVuBYqp0PCipUQUyw/field/password"


@dataclass(frozen=True)
class ResiCredentials:
    api_token: str

    @property
    def authorization_header(self) -> str:
        return f"Bearer {self.api_token}"


def resolve_resi_credentials(default_profile: str = "marketingops") -> ResiCredentials:
    api_token = resolve_secret(
        description="Resi API token",
        notation_env_var="KSM_RESI_API_TOKEN_NOTATION",
        default_notation=DEFAULT_RESI_API_TOKEN_NOTATION,
        direct_env_var="RESI_API_TOKEN",
        default_profile=default_profile,
    )
    return ResiCredentials(api_token=api_token)
