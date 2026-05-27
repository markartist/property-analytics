#!/usr/bin/env python3
"""
Policy helpers for non-core summary email delivery.
"""

from __future__ import annotations

import os


def specialty_summary_emails_enabled() -> bool:
    # Specialty/pilot routine summaries are opt-in. The canonical daily routine
    # summary is Morning Full; specialty summaries should only send when
    # explicitly re-enabled.
    value = os.environ.get("PILOT_SUMMARY_EMAILS_ENABLED", "").strip().lower()
    return value in {"1", "true", "yes", "on"}
