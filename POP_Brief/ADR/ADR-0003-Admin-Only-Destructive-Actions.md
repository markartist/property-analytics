# ADR-0003: Admin-Only Destructive Actions

**Status**: Accepted
**Date**: 2026-02-20
**Author**: Mark Laufhutte

## Context

POP Brief stores operational metrics, community records, and user accounts. Destructive operations — deletions, deactivations — carry high risk of data loss or operational disruption if performed by unauthorized users.

## Decision

Only the **Admin** role may perform destructive operations:

- **Delete communities** (soft delete only).
- **Delete metrics** (removal of metric records).
- **Deactivate users** (revoke access without hard deletion).

## Rationale

- **Protect data integrity**: Prevents accidental or unauthorized removal of operational data.
- **Reduce accidental data loss**: Limits blast radius of user error.
- **Maintain operational control**: Ensures destructive changes are deliberate and traceable to authorized personnel.

## Consequences

- **Role enforcement at the API layer is mandatory.** Every destructive endpoint must verify `role === 'admin'` before execution.
- **UI must not expose delete actions to non-admin users.** Delete buttons, menu items, and confirmation dialogs must be hidden — not merely disabled — for non-admin roles.
- **Soft deletes are preferred** over hard deletes to preserve audit trails and enable recovery.
