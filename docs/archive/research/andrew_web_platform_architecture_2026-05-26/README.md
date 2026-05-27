# Andrew Web Platform Architecture Research Archive

Status: Archived research packet
Archived: 05/27/2026
Original research date: 05/26/2026

This folder preserves the research project and Andrew-facing report materials for future reference. It is not an active system contract, deployment runbook, or canonical source of truth for current platform behavior.

## Contents

- `WEB_PLATFORM_ARCHITECTURE_FOR_ANDREW_2026-05-26.md`: Andrew-facing proposed web platform architecture report.
- `WEB_PLATFORM_INTERNAL_TECHNICAL_DOCUMENTATION_2026-05-26.md`: Internal technical baseline gathered during the research pass.
- `SSL_TECHNICAL_DOCUMENTATION_2026-05-26.md`: SSL/TLS and adjacent edge-security notes from the research pass.
- `RESI_PLATFORM_TECHNICAL_DOCUMENTATION_2026-05-26.md`: Broader Resi/Data Pond technical baseline captured during the same work.
- `build_andrew_web_architecture_docx.py`: Local renderer for regenerating the Andrew-facing DOCX from the Markdown source.

## Regenerating The Report

From the repository root:

```bash
python3 docs/archive/research/andrew_web_platform_architecture_2026-05-26/build_andrew_web_architecture_docx.py
```

The generated DOCX is intentionally ignored by git. Keep the Markdown source as the durable reference.
