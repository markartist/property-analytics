# ADR-0002: Friday Week-Ending Rule

**Status**: Accepted
**Date**: 2026-02-20
**Author**: Mark Laufhutte

## Context

POP Brief aggregates weekly operational metrics across communities and the portfolio. Without a strict week-boundary standard, rolling windows, comparisons, and portfolio aggregations can silently misalign.

## Decision

All weekly metrics must use **Friday week-ending dates**. Non-Friday dates are rejected with a hard validation error at import time.

## Rationale

- **Weekly operational cadence standardization**: Venterra's operational reporting week ends on Friday.
- **Prevents misalignment in rolling windows**: Ensures T7 and T30 windows are anchored consistently.
- **Ensures consistent portfolio comparison**: All communities report against the same week boundary, making cross-community metrics directly comparable.

## Consequences

- **Import validation must enforce this rule.** Any record with a `week_date` that does not fall on a Friday must be rejected before persistence.
- **No override flag is permitted in v1.** This is a hard constraint, not a configurable preference.
- **Historical data imports** must be pre-aligned to Friday boundaries before ingestion.
