# Architecture Decision Records (ADR)

## What is an ADR?

An Architecture Decision Record captures a single, significant architectural decision along with its context, rationale, and consequences. ADRs provide a durable, version-controlled log of *why* decisions were made — not just what was built.

## Why POP Brief Uses ADRs

POP Brief is a governed system. Architectural choices — hosting, data rules, permission models, schema design — are deliberate and non-accidental. ADRs ensure:

- Decisions are **explicit** and **traceable**.
- Future contributors understand **why** constraints exist.
- Superseding a decision requires a **new ADR**, not silent edits.
- The system remains **architecturally intentional** across maintainers.

## Naming Convention

```
ADR-XXXX-Title.md
```

- `XXXX`: Zero-padded sequential number (e.g., `0001`, `0002`).
- `Title`: Hyphenated short description of the decision.
- Example: `ADR-0001-Cloudflare-Hosting-Standard.md`

## Immutability Rule

**ADRs are immutable once accepted.**

- An accepted ADR must never be edited to change its decision or rationale.
- To reverse or modify a decision, create a **new ADR** that explicitly supersedes the old one.
- The superseded ADR's status is updated to `Superseded` with a reference to the new ADR.

## Status Lifecycle

| Status | Meaning |
|---|---|
| **Proposed** | Under discussion; not yet binding. |
| **Accepted** | Approved and binding. Immutable. |
| **Superseded** | Replaced by a newer ADR. Reference the successor. |
| **Deprecated** | No longer applicable. System has moved past this concern. |

## Index

- [ADR-0001](ADR-0001-Cloudflare-Hosting-Standard.md) — Cloudflare Hosting Standard
- [ADR-0002](ADR-0002-Friday-Week-Ending-Rule.md) — Friday Week-Ending Rule
- [ADR-0003](ADR-0003-Admin-Only-Destructive-Actions.md) — Admin-Only Destructive Actions
- [ADR-0004](ADR-0004-Unified-Weekly-Metrics-Table.md) — Unified Weekly Metrics Table
