#!/usr/bin/env python3
"""
Compatibility shim for legacy Data_Collection email imports.

Canonical implementation lives at /Users/mark/Property_Analytics/utils/email_sender.py.
This module re-exports the canonical symbols so all callers use one code path.
"""

from utils.email_sender import (  # noqa: F401
    EmailSender,
    EmailSenderError,
    EmailConfigError,
    EmailSendError,
    main,
)


if __name__ == "__main__":
    main()
