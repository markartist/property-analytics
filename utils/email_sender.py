#!/usr/bin/env python3
"""Backward-compatible shim for the centralized email sender.

Use `Data_Collection.utils.email_sender` for new code.
"""

from Data_Collection.utils.email_sender import (  # noqa: F401
    EmailConfigError,
    EmailSendError,
    EmailSender,
    EmailSenderError,
)

__all__ = [
    "EmailSender",
    "EmailSenderError",
    "EmailConfigError",
    "EmailSendError",
]
