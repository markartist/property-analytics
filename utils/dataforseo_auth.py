#!/usr/bin/env python3
"""Keeper-backed DataForSEO authentication helpers."""

from __future__ import annotations

import base64
from dataclasses import dataclass

from utils.ksm import resolve_secret

DEFAULT_DATAFORSEO_LOGIN_NOTATION = "keeper://8xxZUZB5ISyM1BhBrnaI2w/field/login"
DEFAULT_DATAFORSEO_PASSWORD_NOTATION = "keeper://8xxZUZB5ISyM1BhBrnaI2w/field/password"


@dataclass(frozen=True)
class DataForSeoCredentials:
    login: str
    password: str

    @property
    def basic_auth_token(self) -> str:
        return base64.b64encode(f"{self.login}:{self.password}".encode("utf-8")).decode("ascii")

    @property
    def authorization_header(self) -> str:
        return f"Basic {self.basic_auth_token}"


def resolve_dataforseo_credentials(default_profile: str = "marketingops") -> DataForSeoCredentials:
    login = resolve_secret(
        description="DataForSEO API login",
        notation_env_var="KSM_DATAFORSEO_LOGIN_NOTATION",
        default_notation=DEFAULT_DATAFORSEO_LOGIN_NOTATION,
        direct_env_var="DATAFORSEO_LOGIN",
        default_profile=default_profile,
    )
    password = resolve_secret(
        description="DataForSEO API password",
        notation_env_var="KSM_DATAFORSEO_PASSWORD_NOTATION",
        default_notation=DEFAULT_DATAFORSEO_PASSWORD_NOTATION,
        direct_env_var="DATAFORSEO_PASSWORD",
        default_profile=default_profile,
    )
    return DataForSeoCredentials(login=login, password=password)
