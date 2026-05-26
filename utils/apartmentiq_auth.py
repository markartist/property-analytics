#!/usr/bin/env python3
"""Keeper-backed ApartmentIQ authentication helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass

from utils.ksm import KsmResolutionError, resolve_secret

DEFAULT_APARTMENTIQ_API_KEY_NOTATION = "keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password"
DEFAULT_APARTMENTIQ_ACCOUNT_ID_NOTATION = "keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/login"


@dataclass(frozen=True)
class ApartmentIqCredentials:
    api_key: str
    default_account_id: int | None = None

    @property
    def authorization_header(self) -> str:
        return f"Bearer {self.api_key}"


def resolve_apartmentiq_credentials(default_profile: str = "marketingops") -> ApartmentIqCredentials:
    api_key = resolve_secret(
        description="ApartmentIQ API key",
        notation_env_var="KSM_APARTMENTIQ_API_KEY_NOTATION",
        default_notation=DEFAULT_APARTMENTIQ_API_KEY_NOTATION,
        direct_env_var="APARTMENTIQ_API_KEY",
        default_profile=default_profile,
    )

    default_account_id = None
    try:
        raw_account_id = resolve_secret(
            description="ApartmentIQ default account id",
            notation_env_var="KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION",
            default_notation=DEFAULT_APARTMENTIQ_ACCOUNT_ID_NOTATION,
            direct_env_var="APARTMENTIQ_ACCOUNT_ID",
            default_profile=default_profile,
        )
        if raw_account_id.strip().isdigit():
            default_account_id = int(raw_account_id.strip())
    except KsmResolutionError:
        env_account_id = os.getenv("APARTMENTIQ_ACCOUNT_ID", "").strip()
        if env_account_id.isdigit():
            default_account_id = int(env_account_id)

    return ApartmentIqCredentials(api_key=api_key, default_account_id=default_account_id)
