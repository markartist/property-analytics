# ADR-0004: Unified Weekly Metrics Table

**Status**: Accepted
**Date**: 2026-02-20
**Author**: Mark Laufhutte

## Context

POP Brief tracks weekly metrics at two granularities — T7 (trailing 7-day) and T30 (trailing 30-day) — and at two scopes — community-level and portfolio-level. A naïve approach would create separate tables for each combination, leading to schema duplication and divergent query patterns.

## Decision

T7 and T30 metrics will be stored in a **single unified table** with the following discriminator fields:

- **`window_days`** — Integer field: `7` or `30`.
- **`type`** — String field: `community` or `portfolio`.

**Composite uniqueness constraint**:
```
(community_id, week_date, window_days, type)
```

## Rationale

- **Avoid schema duplication**: One table, one set of columns, one migration path.
- **Simplify API contract**: Consumers filter by `window_days` and `type` rather than hitting different endpoints or tables.
- **Preserve parity with v1 reporting logic**: The existing Excel-based reporting uses the same logical structure; this maps directly.

## Consequences

- **Import logic must reference `window_days`** when inserting or upserting records. Omitting this field will violate the uniqueness constraint or produce incorrect data.
- **Portfolio records are explicitly stored, not derived.** Portfolio-level aggregations are computed at import time and persisted as `type = 'portfolio'` rows, ensuring query-time simplicity.
- **Queries must always filter on `window_days` and `type`** to avoid mixing T7/T30 or community/portfolio data in results.
