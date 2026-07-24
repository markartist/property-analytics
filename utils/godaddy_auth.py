#!/usr/bin/env python3
"""Keeper-backed GoDaddy API credential resolution."""

from __future__ import annotations

from dataclasses import dataclass

from utils.ksm import KsmResolutionError, resolve_secret


DEFAULT_GODADDY_KEY_NOTATION = "keeper://FCaG6ON9q3_5Z-7ATYV5wQ/field/login"
DEFAULT_GODADDY_SECRET_NOTATION = "keeper://FCaG6ON9q3_5Z-7ATYV5wQ/field/password"
DEFAULT_GODADDY_CUSTOMER_ID_NOTATION = "keeper://FCaG6ON9q3_5Z-7ATYV5wQ/custom_field/customer_id"


@dataclass(frozen=True)
class GoDaddyCredentials:
    api_key: str
    api_secret: str
    source: str

    @property
    def authorization_header(self) -> str:
        return f"sso-key {self.api_key}:{self.api_secret}"


def resolve_godaddy_credentials() -> GoDaddyCredentials:
    """Resolve GoDaddy API credentials through Keeper/KSM first."""
    api_key = resolve_secret(
        description="GoDaddy API key",
        notation_env_var="KSM_GODADDY_API_KEY_NOTATION",
        default_notation=DEFAULT_GODADDY_KEY_NOTATION,
        direct_env_var="GODADDY_API_KEY",
        default_profile="marketingops",
    )
    api_secret = resolve_secret(
        description="GoDaddy API secret",
        notation_env_var="KSM_GODADDY_API_SECRET_NOTATION",
        default_notation=DEFAULT_GODADDY_SECRET_NOTATION,
        direct_env_var="GODADDY_API_SECRET",
        default_profile="marketingops",
    )
    return GoDaddyCredentials(
        api_key=api_key,
        api_secret=api_secret,
        source="Keeper/KSM",
    )


def resolve_godaddy_customer_id() -> tuple[str, str]:
    """Resolve the GoDaddy customer/shopper id needed by v2 domain endpoints."""
    try:
        customer_id = resolve_secret(
            description="GoDaddy customer/shopper id",
            notation_env_var="KSM_GODADDY_CUSTOMER_ID_NOTATION",
            default_notation=DEFAULT_GODADDY_CUSTOMER_ID_NOTATION,
            direct_env_var="GODADDY_CUSTOMER_ID",
            default_profile="marketingops",
        )
    except KsmResolutionError as exc:
        raise KsmResolutionError(
            "GoDaddy forwarding collection requires GODADDY_CUSTOMER_ID or "
            "KSM_GODADDY_CUSTOMER_ID_NOTATION. Add the customer/shopper id to "
            "Keeper/KSM before running forwarding collection."
        ) from exc
    return customer_id, "Keeper/KSM or current environment"
