"""
Site Audit Data Models
======================
Dataclasses for audit issues, page results, and property results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional


Severity = Literal["critical", "warning", "info"]
Category = Literal[
    "broken_image",
    "unloaded_tour",
    "js_error",
    "broken_link",
    "missing_meta",
]


@dataclass
class AuditIssue:
    """Single audit finding on a page."""

    severity: Severity
    category: Category
    page_url: str
    description: str
    detail: str = ""
    location: str = ""  # Visual context: "Gallery", "Hero", "Unit Card", etc.


@dataclass
class PageAuditResult:
    """Audit results for a single page."""

    url: str
    status_code: int
    load_time_ms: int
    issues: List[AuditIssue] = field(default_factory=list)

    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "critical")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "warning")


@dataclass
class PropertyAuditResult:
    """Aggregated audit results for one property (all pages)."""

    name: str
    site_type: str  # "resi" or "legacy"
    base_url: str
    pages: List[PageAuditResult] = field(default_factory=list)

    @property
    def all_issues(self) -> List[AuditIssue]:
        return [issue for page in self.pages for issue in page.issues]

    @property
    def total_issues(self) -> int:
        return len(self.all_issues)

    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == "critical")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == "warning")

    @property
    def info_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == "info")

    def issues_by_category(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for issue in self.all_issues:
            counts[issue.category] = counts.get(issue.category, 0) + 1
        return counts

    @property
    def status(self) -> str:
        if self.critical_count > 0:
            return "critical"
        if self.warning_count > 0:
            return "warning"
        return "pass"
