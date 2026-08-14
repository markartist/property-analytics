# Resi Edge Package Readout Template

Use this file as the per-property `PACKAGE_READOUT.md`. Do not remove sections. If a section is not in scope, mark it `approved_exception` or `deferred_with_owner`.

## Reset Card

- Property:
- Property code:
- Live hostname:
- Goal:
- Approved pattern:
- Mobile lane:
- Desktop lane:
- Analytics ownership:
- Whole-property fix ledger:
- Live change scope:
- Required proof:
- Stop conditions:

## Decision

- Approval state: `not_started` | `in_progress` | `passed` | `blocked` | `approved_exception`
- What is live:
- What was done:
- What is running:
- What is blocked:
- Next action:
- Rollback path:

## Gate Ledger

| Gate | State | Evidence | Notes |
| --- | --- | --- | --- |
| Record intake | `not_started` |  |  |
| Governed identity | `not_started` |  |  |
| Source page audit | `not_started` |  |  |
| Search and indexing | `not_started` |  |  |
| `llms.txt` | `not_started` |  |  |
| Meta / OG / schema / icons | `not_started` |  |  |
| Consent management | `not_started` |  | Zaraz CMP purposes, tool assignments, UX, and network blocking proof |
| Analytics ownership | `not_started` |  |  |
| Baseline PSI/browser | `not_started` |  |  |
| Architecture equivalence | `not_started` | `architecture/mobile-shell-proof.json` | Must pass before PSI/readiness claims |
| Assets and R2 readback | `not_started` |  |  |
| Preview proof | `not_started` |  |  |
| CTA and source attribution | `not_started` |  |  |
| Production promotion | `not_started` |  | Requires explicit approval |
| Post-launch proof | `not_started` |  |  |
| Captain / Data Pond state | `not_started` |  |  |

## Architecture Contract

Required command:

```bash
node scripts/validate_resi_mobile_shell_contract.mjs \
  --url "{exact_url}" \
  --label "{property_name}" \
  --property-code "{property_code}" \
  --out "reports/resi_edge_performance/MM-DD-YYYY/{property_slug}/architecture/mobile-shell-proof.json"
```

Pass requirements:

- `pass: true`
- Mobile initial HTML `<=40000` bytes
- `0` stylesheet links
- `<=8` script tags
- `0` native runtime blockers
- `0` native DAM image references
- `0` direct native analytics blockers
- Desktop topper absent unless explicitly approved

If this fails, stop. Do not claim TowneStone/Vine equivalence.

## Required Evidence Links

- Baseline PSI:
- Baseline browser:
- Architecture proof:
- Browser continuation proof:
- R2 generated assets:
- R2 readback:
- Analytics ownership audit:
- Consent config audit:
- Consent UX proof:
- Consent accept/reject network proof:
- Google Consent Mode proof:
- Zaraz proof:
- GA4 realtime:
- Heap/Contentsquare passive and interaction proof:
- Ahrefs proof:
- Cloudflare analytics proof:
- CTA proof:
- Source-coded phone proof:
- Visual screenshots:
- Console/network proof:
- `llms.txt` proof:
- Meta/OG/schema proof:
- GSC/indexing proof:
- Rollback proof:
- Captain update:
- Data Pond update:

## Approved Exceptions

| Exception | Reason | Owner Approval | Expiration / Follow-Up |
| --- | --- | --- | --- |
