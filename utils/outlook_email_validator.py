#!/usr/bin/env python3
"""Validate executive report HTML for Outlook-safe email delivery."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


OFFICIAL_VENTERRA_COLORS = {
    "000000",
    "FFFFFF",
    "F6F6F5",
    "D6D6D2",
    "9B9B96",
    "15284B",
    "3D66B9",
    "294782",
    "5A81CF",
    "7DCAC2",
    "E02472",
    "BD4830",
    "3B9189",
}


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    errors: list[str]
    warnings: list[str]
    checks: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _find_hex_colors(html: str) -> set[str]:
    return {match.upper() for match in re.findall(r"#([0-9a-fA-F]{6})\b", html)}


def _has_external_image(html: str) -> bool:
    return bool(re.search(r"<img\b[^>]*\bsrc=[\"']https?://", html, flags=re.I))


def _contains_any(html: str, patterns: Iterable[tuple[str, str]]) -> list[str]:
    found: list[str] = []
    for label, pattern in patterns:
        if re.search(pattern, html, flags=re.I):
            found.append(label)
    return found


def validate_outlook_email_html(html: str, *, max_width_px: int = 720) -> ValidationResult:
    """Return a strict Outlook safety result for report email HTML."""

    errors: list[str] = []
    warnings: list[str] = []
    checks: dict[str, object] = {}

    forbidden = _contains_any(
        html,
        [
            ("style tag", r"<\s*style\b"),
            ("script tag", r"<\s*script\b"),
            ("external stylesheet", r"<\s*link\b[^>]*stylesheet"),
            ("css flexbox", r"display\s*:\s*flex"),
            ("css grid", r"display\s*:\s*grid"),
            ("css variables", r"var\s*\("),
            ("media query", r"@media\b"),
            ("javascript url", r"javascript:"),
        ],
    )
    if forbidden:
        errors.extend(f"Forbidden email pattern present: {item}" for item in forbidden)
    checks["forbidden_patterns"] = forbidden

    table_count = len(re.findall(r"<\s*table\b", html, flags=re.I))
    checks["table_count"] = table_count
    if table_count < 3:
        errors.append("HTML must use a table-based email shell with repeated table components.")

    if re.search(r"\bclass\s*=", html, flags=re.I):
        errors.append("Class-dependent layout is not allowed for executive email HTML.")
    checks["class_attributes_present"] = bool(re.search(r"\bclass\s*=", html, flags=re.I))

    if _has_external_image(html):
        errors.append("External images are not allowed; use data URIs or omit images.")
    checks["external_images_present"] = _has_external_image(html)

    width_values = [int(value) for value in re.findall(r"(?:width| max-width)\s*:\s*(\d+)px", html, flags=re.I)]
    attr_width_values = [int(value) for value in re.findall(r"\bwidth=[\"']?(\d+)[\"']?", html, flags=re.I)]
    all_widths = width_values + attr_width_values
    checks["max_declared_width_px"] = max(all_widths) if all_widths else None
    if all_widths and max(all_widths) > max_width_px:
        errors.append(f"Declared email width exceeds {max_width_px}px.")
    if not all_widths:
        warnings.append("No explicit email width found; Outlook rendering may drift.")

    colors = _find_hex_colors(html)
    unknown_colors = sorted(color for color in colors if color not in OFFICIAL_VENTERRA_COLORS)
    checks["hex_colors"] = sorted(colors)
    checks["unknown_hex_colors"] = unknown_colors
    if unknown_colors:
        errors.append(f"Non-official Venterra colors present: {', '.join('#' + c for c in unknown_colors)}")

    if "Generated " not in html:
        warnings.append("Generated timestamp text was not found.")
    if "Sources" not in html and "Source" not in html:
        warnings.append("Source note was not found.")

    return ValidationResult(passed=not errors, errors=errors, warnings=warnings, checks=checks)


def validate_outlook_email_file(path: Path, *, max_width_px: int = 720) -> ValidationResult:
    return validate_outlook_email_html(path.read_text(encoding="utf-8"), max_width_px=max_width_px)


def write_validation_result(path: Path, result: ValidationResult) -> None:
    path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
