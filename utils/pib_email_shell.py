#!/usr/bin/env python3
"""Shared PIB-style light-mode email wrapper for operational emails."""

from __future__ import annotations

from typing import Optional

VENTERRA_BLUE = "#15284B"


def wrap_pib_light_email(
    *,
    title: str,
    subtitle: str,
    body_html: str,
    badge_text: Optional[str] = None,
    badge_fg: str = "#1f2937",
    badge_bg: str = "#e2e8f0",
) -> str:
    """Render content inside a PIB-aligned light-only shell."""
    badge_html = ""
    if badge_text:
        badge_html = (
            f'<tr><td style="padding:14px 20px 0 20px;font-family:Arial, sans-serif;">'
            f'<span style="display:inline-block;padding:5px 10px;border-radius:4px;'
            f'font-size:12px;font-weight:700;color:{badge_fg};background:{badge_bg};">{badge_text}</span>'
            "</td></tr>"
        )

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="860" style="width:860px;border:1px solid #dbe2ea;background:#ffffff;">
          <tr>
            <td style="background:{VENTERRA_BLUE};color:#ffffff;padding:18px 20px;font-family:Arial, sans-serif;">
              <div style="font-size:22px;font-weight:700;">{title}</div>
              <div style="font-size:12px;opacity:0.95;margin-top:4px;">{subtitle}</div>
            </td>
          </tr>
          {badge_html}
          <tr>
            <td style="padding:14px 16px 18px 16px;background:#ffffff;">{body_html}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
